// ═══════════════════════════════════════════════════════════════════
//  Webhook Stripe
//  Endpoint : /.netlify/functions/stripe-webhook
//  Env requises : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//                 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
//  Événements à activer dans le Dashboard Stripe :
//    checkout.session.completed, checkout.session.async_payment_succeeded
//    ET invoice.paid
//
//  Crédits déterminés par le PRODUIT/PRIX acheté (robuste aux codes promo
//  et aux changements de prix), avec repli sur le montant exact si le
//  prix est inconnu. Idempotence : crediter_paiement (index unique sur
//  transactions.details = id de session / facture Stripe).
//
//  Codes retour :
//    400  signature invalide (rien n'est lu ni crédité)
//    500  erreur interne ou config manquante -> Stripe retente (3 jours)
//    200  traité, ou non crédité mais définitif (journal "NON_CREDITE")
// ═══════════════════════════════════════════════════════════════════
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

// ── Catalogue : crédits par prix, puis par produit ─────────────────
// IDs relevés dans le Dashboard Stripe (compte Recrutable, mode live).
const CREDITS_PAR_PRIX = {
  price_1Tc4VaJIuttoT5CIvTfOUxE1: 3,  // recrutable de suite (recharge 2,99 €)
  price_1Tc4Q8JIuttoT5CI6Lri8gEb: 8,  // recrutable mensuel (5,99 €/mois)
  price_1Tc4GUJIuttoT5CIWxqO5EiI: 60, // recrutable annuel (49,99 €/an)
};
const CREDITS_PAR_PRODUIT = {
  prod_UbH3qfHEKpOOJ8: 3,  // recrutable de suite
  prod_UbGyMlBSEw6fI5: 8,  // recrutable mensuel
  prod_UbGoOQAIDMMXYS: 60, // recrutable annuel
};

// Repli : montants EXACTS (centimes) -> crédits, si le prix est inconnu.
function creditsPourMontant(cents) {
  if (cents === 4999) return 60;
  if (cents === 599) return 8;
  if (cents === 299) return 3;
  return 0;
}

function idDe(x) {
  if (!x) return null;
  return typeof x === "string" ? x : x.id || null;
}

// Crédits d'un article { priceId, productId, quantite }. 0 si inconnu.
function creditsPourArticle({ priceId, productId, quantite }) {
  const unit = CREDITS_PAR_PRIX[priceId] || CREDITS_PAR_PRODUIT[productId] || 0;
  return unit * (quantite || 1);
}

// Somme des crédits d'une liste d'articles. Si UN article est inconnu,
// on ne devine pas : on renvoie { credits: 0, inconnus } pour déclencher
// le repli sur le montant.
function creditsPourArticles(articles) {
  const inconnus = [];
  let total = 0;
  for (const a of articles) {
    const c = creditsPourArticle(a);
    if (c === 0) inconnus.push(a.priceId || a.productId || "?");
    total += c;
  }
  return inconnus.length ? { credits: 0, inconnus } : { credits: total, inconnus };
}

// Articles d'une session Checkout (API Stripe, peut lever -> 500 -> retry).
async function articlesSession(stripe, sessionId) {
  const res = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100 });
  return (res.data || []).map((li) => ({
    priceId: idDe(li.price),
    productId: li.price ? idDe(li.price.product) : null,
    quantite: li.quantity || 1,
  }));
}

// Articles d'une facture. API 2025-03-31.basil et suivantes (dont
// 2026-03-25.dahlia) : le prix est dans line.pricing.price_details ;
// line.price n'existe plus. On lit les deux formats par sécurité.
function articlesFacture(inv) {
  const lignes = (inv.lines && inv.lines.data) || [];
  return lignes
    .filter((l) => (l.amount || 0) >= 0) // ignore les lignes de crédit / prorata négatives
    .map((l) => {
      const pd = l.pricing && l.pricing.price_details;
      return {
        priceId: pd ? idDe(pd.price) : idDe(l.price),
        productId: pd ? pd.product || null : l.price ? idDe(l.price.product) : null,
        quantite: l.quantity || 1,
      };
    });
}

// Journal structuré des paiements non crédités automatiquement.
function nonCredite(raison, infos) {
  console.warn("NON_CREDITE " + JSON.stringify({ raison, ...infos }));
}

// Cherche UN profil par colonne. Toute erreur Supabase est levée (-> 500,
// Stripe retente) au lieu de conclure à tort « aucun profil ».
async function chercherProfil(supabase, colonne, valeur) {
  const { data, error } = await supabase
    .from("profils").select("id").eq(colonne, valeur).limit(2);
  if (error) throw new Error(`profils.${colonne}: ${error.message}`);
  if (!data || data.length === 0) return null;
  if (data.length > 1) {
    console.warn(`Plusieurs profils pour ${colonne}:`, valeur);
    return null;
  }
  return data[0].id;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function trouverProfil(supabase, { userId, customerId, email }) {
  // Un client_reference_id non-UUID ferait échouer la requête (22P02) en boucle.
  if (userId && UUID_RE.test(userId)) {
    const id = await chercherProfil(supabase, "id", userId);
    if (id) return id;
  }
  if (customerId) {
    const id = await chercherProfil(supabase, "stripe_customer_id", customerId);
    if (id) return id;
  }
  if (email) {
    const id = await chercherProfil(supabase, "email", email);
    if (id) return id;
  }
  return null;
}

// Crédit idempotent + atomique via RPC SQL (retourne -1 si déjà traité).
async function crediter(supabase, profilId, credits, refPaiement) {
  const { data, error } = await supabase.rpc("crediter_paiement", {
    p_user_id: profilId, p_montant: credits, p_details: refPaiement,
  });
  if (error) throw new Error("crediter_paiement: " + error.message);
  if (data === -1) console.log("Déjà crédité (retry Stripe ignoré):", refPaiement);
  return data;
}

function ok(extra) {
  return { statusCode: 200, body: JSON.stringify({ received: true, ...(extra || {}) }) };
}

// Dépendances injectables pour les tests locaux.
function creerHandler(deps) {
  return async (event) => {
    const { stripe, supabase, webhookSecret } = deps();

    const sig = (event.headers || {})["stripe-signature"];
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : event.body || "";

    let stripeEvent;
    try {
      if (!stripe || !webhookSecret) throw new Error("config Stripe absente");
      stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      if (!stripe || !webhookSecret) {
        console.error("Webhook: STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET manquante");
        return { statusCode: 500, body: "Configuration manquante" };
      }
      return { statusCode: 400, body: "Signature invalide" };
    }

    if (!supabase) {
      console.error("Webhook: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante (Stripe retentera)");
      return { statusCode: 500, body: "Configuration manquante" };
    }

    try {
      // ── 1. Paiement via Payment Link / Checkout ────────────────────
      // async_payment_succeeded : moyens de paiement différés (la session
      // s'est terminée en "unpaid", le paiement arrive plus tard).
      if (stripeEvent.type === "checkout.session.completed" ||
          stripeEvent.type === "checkout.session.async_payment_succeeded") {
        const s = stripeEvent.data.object;

        // "no_payment_required" = code promo à 100 % : on crédite aussi.
        if (s.payment_status !== "paid" && s.payment_status !== "no_payment_required") {
          return ok({ attente: true });
        }

        const email = ((s.customer_details && s.customer_details.email) || s.customer_email || "").toLowerCase();
        const articles = await articlesSession(stripe, s.id);
        let { credits, inconnus } = creditsPourArticles(articles);
        let source = "prix";
        if (credits === 0) {
          credits = creditsPourMontant(s.amount_total || 0);
          source = "montant";
        }
        if (credits === 0) {
          nonCredite("prix_et_montant_inconnus", { ref: s.id, email, montant: s.amount_total, inconnus });
          return ok({ inconnu: true });
        }

        const customerId = idDe(s.customer);
        const profilId = await trouverProfil(supabase, {
          userId: s.client_reference_id || null, customerId, email,
        });
        if (!profilId) {
          nonCredite("profil_introuvable", { ref: s.id, email, credits });
          return ok({ orphelin: true });
        }

        if (customerId) {
          await supabase.rpc("lier_stripe_customer", {
            p_user_id: profilId, p_customer_id: customerId,
          }).then(() => {}, () => {});
        }

        if (source === "montant") console.warn("Crédit par repli montant (prix inconnu):", s.id, inconnus);
        await crediter(supabase, profilId, credits, s.id);
      }

      // ── 2. Renouvellements d'abonnement ────────────────────────────
      if (stripeEvent.type === "invoice.paid") {
        const inv = stripeEvent.data.object;

        // La 1re facture d'un abonnement est couverte par checkout.session.completed.
        if (inv.billing_reason && inv.billing_reason !== "subscription_cycle") {
          return ok();
        }

        const email = (inv.customer_email || "").toLowerCase();
        let { credits, inconnus } = creditsPourArticles(articlesFacture(inv));
        let source = "prix";
        if (credits === 0) {
          credits = creditsPourMontant(inv.amount_paid || 0);
          source = "montant";
        }
        if (credits === 0) {
          nonCredite("prix_et_montant_inconnus", { ref: inv.id, email, montant: inv.amount_paid, inconnus });
          return ok({ inconnu: true });
        }

        const profilId = await trouverProfil(supabase, {
          userId: null, customerId: idDe(inv.customer), email,
        });
        if (!profilId) {
          nonCredite("profil_introuvable", { ref: inv.id, email, credits });
          return ok({ orphelin: true });
        }

        if (source === "montant") console.warn("Crédit par repli montant (prix inconnu):", inv.id, inconnus);
        await crediter(supabase, profilId, credits, inv.id);
      }
    } catch (err) {
      // 500 -> Stripe retente ; l'idempotence SQL empêche tout double crédit.
      console.error("Webhook erreur:", err.message);
      return { statusCode: 500, body: "Erreur interne" };
    }

    return ok();
  };
}

// Clients créés à la demande : une variable manquante donne un 500 explicite
// dans les logs au lieu d'un crash au chargement du module (502 opaque).
let cache = null;
function depsProduction() {
  if (cache) return cache;
  const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;
  const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;
  const deps = { stripe, supabase, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null };
  if (stripe && supabase && deps.webhookSecret) cache = deps;
  return deps;
}

exports.handler = creerHandler(depsProduction);
exports._test = { creerHandler, creditsPourArticles, articlesFacture, creditsPourMontant };
