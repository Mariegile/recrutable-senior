// ═══════════════════════════════════════════════════════════════════
//  Webhook Stripe — VERSION SÉCURISÉE (remplace l'ancienne)
//  Endpoint : /.netlify/functions/stripe-webhook
//  Env requises : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//                 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
//  Corrige : double crédit sur retry (idempotence atomique en SQL),
//  crédit non atomique, absence de payment_status, matching e-mail
//  fragile (client_reference_id d'abord), montants exacts par palier,
//  et RENOUVELLEMENTS d'abonnement jamais crédités (invoice.paid).
//
//  Événements à activer dans le Dashboard Stripe :
//    checkout.session.completed  ET  invoice.paid
// ═══════════════════════════════════════════════════════════════════
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Paliers EXACTS (centimes) -> crédits. Un montant inconnu n'est PAS crédité
// automatiquement : il est signalé dans les logs pour traitement manuel.
function creditsPourMontant(cents) {
  if (cents === 4999) return 60; // Annuel 49,99 €
  if (cents === 599) return 8;   // Mensuel 5,99 €
  if (cents === 299) return 3;   // Recharge 2,99 €
  return 0;
}

async function trouverProfil({ userId, customerId, email }) {
  if (userId) {
    const { data } = await supabase.from("profils").select("id").eq("id", userId).single();
    if (data) return data.id;
  }
  if (customerId) {
    const { data } = await supabase
      .from("profils").select("id").eq("stripe_customer_id", customerId).single();
    if (data) return data.id;
  }
  if (email) {
    const { data } = await supabase
      .from("profils").select("id").eq("email", email).single();
    if (data) return data.id;
  }
  return null;
}

// Crédit idempotent + atomique via RPC SQL (retourne -1 si déjà traité).
async function crediter(profilId, credits, refPaiement) {
  const { data, error } = await supabase.rpc("crediter_paiement", {
    p_user_id: profilId, p_montant: credits, p_details: refPaiement,
  });
  if (error) throw new Error("crediter_paiement: " + error.message);
  return data; // nouveau solde, ou -1 si doublon ignoré
}

exports.handler = async (event) => {
  const sig = event.headers["stripe-signature"];
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return { statusCode: 400, body: "Signature invalide" };
  }

  try {
    // ── 1. Premier paiement (Payment Link) ─────────────────────────
    if (stripeEvent.type === "checkout.session.completed") {
      const s = stripeEvent.data.object;

      // Paiements asynchrones (virement, etc.) : attendre le paiement effectif.
      if (s.payment_status !== "paid") {
        return { statusCode: 200, body: JSON.stringify({ received: true, attente: true }) };
      }

      const email = ((s.customer_details && s.customer_details.email) || s.customer_email || "").toLowerCase();
      const credits = creditsPourMontant(s.amount_total || 0);
      if (credits === 0) {
        console.warn("Montant non reconnu, crédit manuel requis:", s.amount_total, s.id, email);
        return { statusCode: 200, body: JSON.stringify({ received: true, inconnu: true }) };
      }

      const profilId = await trouverProfil({
        userId: s.client_reference_id || null,
        customerId: typeof s.customer === "string" ? s.customer : null,
        email,
      });

      if (!profilId) {
        console.warn("Aucun profil pour ce paiement, crédit manuel requis:", s.id, email);
        return { statusCode: 200, body: JSON.stringify({ received: true, orphelin: true }) };
      }

      // Lier le client Stripe au profil (permet de créditer les renouvellements).
      if (typeof s.customer === "string" && s.customer) {
        await supabase.rpc("lier_stripe_customer", {
          p_user_id: profilId, p_customer_id: s.customer,
        }).then(() => {}, () => {});
      }

      await crediter(profilId, credits, s.id);
    }

    // ── 2. Renouvellements d'abonnement (mensuel / annuel) ─────────
    if (stripeEvent.type === "invoice.paid") {
      const inv = stripeEvent.data.object;

      // La 1re facture d'un abonnement est déjà couverte par checkout.session.completed.
      if (inv.billing_reason && inv.billing_reason !== "subscription_cycle") {
        return { statusCode: 200, body: JSON.stringify({ received: true }) };
      }

      const credits = creditsPourMontant(inv.amount_paid || 0);
      if (credits === 0) {
        console.warn("Renouvellement montant non reconnu:", inv.amount_paid, inv.id);
        return { statusCode: 200, body: JSON.stringify({ received: true, inconnu: true }) };
      }

      const customerId = typeof inv.customer === "string" ? inv.customer : null;
      const email = (inv.customer_email || "").toLowerCase();
      const profilId = await trouverProfil({ userId: null, customerId, email });

      if (!profilId) {
        console.warn("Renouvellement sans profil, crédit manuel requis:", inv.id, email);
        return { statusCode: 200, body: JSON.stringify({ received: true, orphelin: true }) };
      }

      await crediter(profilId, credits, inv.id);
    }
  } catch (err) {
    // Erreur interne : on renvoie 500 pour que Stripe retente (l'idempotence
    // SQL garantit qu'un retry ne créditera jamais deux fois).
    console.error("Webhook erreur:", err.message);
    return { statusCode: 500, body: "Erreur interne" };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
