// Tests du webhook Stripe (netlify/functions/stripe-webhook.js), sans réseau :
// vraie vérification de signature Stripe, Stripe et Supabase simulés en mémoire
// (même sémantique que crediter_paiement : index unique sur transactions.details).
// Lancer : npm run tester-webhook
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Stripe = require("stripe");
const { _test } = require("../netlify/functions/stripe-webhook.js");

const SECRET = "whsec_test_local";
const PRIX = { recharge: "price_1Tc4VaJIuttoT5CIvTfOUxE1", mensuel: "price_1Tc4Q8JIuttoT5CI6Lri8gEb", annuel: "price_1Tc4GUJIuttoT5CIWxqO5EiI" };
const PROD = { recharge: "prod_UbH3qfHEKpOOJ8", mensuel: "prod_UbGyMlBSEw6fI5", annuel: "prod_UbGoOQAIDMMXYS" };
const U1 = "79e4c139-533e-4c23-a4ba-2ae724bc62e8";
const U2 = "11111111-2222-3333-4444-555555555555";

// ── Supabase simulé ─────────────────────────────────────────────────
function fauxSupabase({ panne = false } = {}) {
  const db = {
    profils: [
      { id: U1, email: "compte.google@gmail.com", stripe_customer_id: null, credits: 0 },
      { id: U2, email: "client.existant@exemple.fr", stripe_customer_id: "cus_EXISTANT", credits: 5 },
    ],
    transactions: [],
  };
  const sb = {
    db,
    from(table) {
      const filtres = [];
      const q = {
        select() { return q; },
        eq(col, val) { filtres.push([col, val]); return q; },
        limit(n) {
          if (panne) return Promise.resolve({ data: null, error: { message: "connexion refusée" } });
          const data = db[table].filter(r => filtres.every(([c, v]) => r[c] === v)).slice(0, n).map(r => ({ id: r.id }));
          return Promise.resolve({ data, error: null });
        },
      };
      return q;
    },
    rpc(nom, a) {
      if (panne) return Promise.resolve({ data: null, error: { message: "connexion refusée" } });
      if (nom === "crediter_paiement") {
        if (db.transactions.some(t => t.details === a.p_details)) return Promise.resolve({ data: -1, error: null });
        db.transactions.push({ user_id: a.p_user_id, montant: a.p_montant, type: "achat", details: a.p_details });
        const p = db.profils.find(x => x.id === a.p_user_id);
        if (p) p.credits += a.p_montant;
        return Promise.resolve({ data: p ? p.credits : 0, error: null });
      }
      if (nom === "lier_stripe_customer") {
        const p = db.profils.find(x => x.id === a.p_user_id);
        if (p && (!p.stripe_customer_id || p.stripe_customer_id === a.p_customer_id)) p.stripe_customer_id = a.p_customer_id;
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: { message: "rpc inconnue " + nom } });
    },
  };
  return sb;
}

// ── Stripe simulé (signature réelle, line items en mémoire) ─────────
function fauxStripe(lignesParSession, { panneApi = false } = {}) {
  const s = Stripe("sk_test_local");
  s.checkout = { sessions: { listLineItems: async (id) => {
    if (panneApi) throw new Error("API Stripe indisponible");
    return { data: lignesParSession[id] || [] };
  } } };
  return s;
}

function evenement(stripe, type, objet, id = "evt_" + Math.random().toString(36).slice(2)) {
  const payload = JSON.stringify({ id, object: "event", type, data: { object: objet } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return { headers: { "stripe-signature": header }, body: payload };
}

const ligne = (cle, qte = 1) => ({ price: { id: PRIX[cle], product: PROD[cle] }, quantity: qte });
const session = (o) => ({ object: "checkout.session", payment_status: "paid", amount_total: 299, customer: null,
  customer_details: { email: "compte.google@gmail.com" }, client_reference_id: U1, ...o });
const facture = (o) => ({ object: "invoice", billing_reason: "subscription_cycle", customer: "cus_EXISTANT",
  customer_email: "client.existant@exemple.fr", amount_paid: 599,
  lines: { data: [{ amount: 599, quantity: 1, pricing: { price_details: { price: PRIX.mensuel, product: PROD.mensuel } } }] }, ...o });

function banc(lignes = {}, opts = {}) {
  const stripe = fauxStripe(lignes, opts);
  const supabase = fauxSupabase(opts);
  const handler = _test.creerHandler(() => ({ stripe, supabase, webhookSecret: SECRET }));
  return { stripe, supabase, handler, solde: (id) => supabase.db.profils.find(p => p.id === id).credits };
}

// ═══ Signature et configuration ═════════════════════════════════════
test("01 sans signature -> 400, rien crédité", async () => {
  const b = banc();
  const r = await b.handler({ headers: {}, body: "{}" });
  assert.equal(r.statusCode, 400);
  assert.equal(b.supabase.db.transactions.length, 0);
});
test("02 signature falsifiée -> 400", async () => {
  const b = banc({ cs_1: [ligne("recharge")] });
  const ev = evenement(b.stripe, "checkout.session.completed", session({ id: "cs_1" }));
  ev.body = ev.body.replace("299", "29900");
  assert.equal((await b.handler(ev)).statusCode, 400);
});
test("03 signature d'un autre secret -> 400", async () => {
  const b = banc();
  const payload = JSON.stringify({ id: "evt_x", type: "checkout.session.completed", data: { object: session({ id: "cs_x" }) } });
  const header = b.stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_autre" });
  assert.equal((await b.handler({ headers: { "stripe-signature": header }, body: payload })).statusCode, 400);
});
test("04 config Stripe absente -> 500 (Stripe retente)", async () => {
  const h = _test.creerHandler(() => ({ stripe: null, supabase: fauxSupabase(), webhookSecret: null }));
  assert.equal((await h({ headers: {}, body: "{}" })).statusCode, 500);
});
test("05 corps encodé en base64 accepté", async () => {
  const b = banc({ cs_b64: [ligne("recharge")] });
  const ev = evenement(b.stripe, "checkout.session.completed", session({ id: "cs_b64" }));
  const r = await b.handler({ ...ev, body: Buffer.from(ev.body).toString("base64"), isBase64Encoded: true });
  assert.equal(r.statusCode, 200);
  assert.equal(b.solde(U1), 3);
});

// ═══ Crédits par offre ══════════════════════════════════════════════
for (const [cle, credits, montant] of [["recharge", 3, 299], ["mensuel", 8, 599], ["annuel", 60, 4999]]) {
  test(`06 ${cle} : ${credits} crédits`, async () => {
    const b = banc({ ["cs_" + cle]: [ligne(cle)] });
    const r = await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_" + cle, amount_total: montant, mode: cle === "recharge" ? "payment" : "subscription", customer: cle === "recharge" ? null : "cus_NOUVEAU" })));
    assert.equal(r.statusCode, 200);
    assert.equal(b.solde(U1), credits);
  });
}
test("07 quantité 2 -> crédits doublés", async () => {
  const b = banc({ cs_q2: [ligne("recharge", 2)] });
  await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_q2", amount_total: 598 })));
  assert.equal(b.solde(U1), 6);
});
test("08 code promo 100 % (no_payment_required, 0 €) -> crédité selon le prix", async () => {
  const b = banc({ cs_promo: [ligne("recharge")] });
  await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_promo", amount_total: 0, payment_status: "no_payment_required" })));
  assert.equal(b.solde(U1), 3);
});
test("09 code promo partiel (montant 1,49 €) -> crédité selon le prix, pas le montant", async () => {
  const b = banc({ cs_p50: [ligne("recharge")] });
  await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_p50", amount_total: 149 })));
  assert.equal(b.solde(U1), 3);
});
test("10 prix inconnu mais montant exact -> repli sur le montant", async () => {
  const b = banc({ cs_inc: [{ price: { id: "price_nouveau", product: "prod_nouveau" }, quantity: 1 }] });
  await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_inc", amount_total: 599 })));
  assert.equal(b.solde(U1), 8);
});
test("11 prix et montant inconnus -> 200 sans crédit (journal NON_CREDITE)", async () => {
  const b = banc({ cs_x: [{ price: { id: "price_x", product: "prod_x" }, quantity: 1 }] });
  const r = await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_x", amount_total: 1234 })));
  assert.equal(r.statusCode, 200);
  assert.equal(b.solde(U1), 0);
});
test("12 paiement en attente (unpaid, ex. virement) -> rien maintenant", async () => {
  const b = banc({ cs_att: [ligne("recharge")] });
  const r = await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_att", payment_status: "unpaid" })));
  assert.equal(r.statusCode, 200);
  assert.equal(b.solde(U1), 0);
});

test("12b paiement différé : session unpaid puis async_payment_succeeded -> crédité une fois", async () => {
  const b = banc({ cs_async: [ligne("recharge")] });
  await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_async", payment_status: "unpaid" })));
  assert.equal(b.solde(U1), 0);
  await b.handler(evenement(b.stripe, "checkout.session.async_payment_succeeded", session({ id: "cs_async" })));
  await b.handler(evenement(b.stripe, "checkout.session.async_payment_succeeded", session({ id: "cs_async" })));
  assert.equal(b.solde(U1), 3);
});

// ═══ Identification du compte ═══════════════════════════════════════
test("13 client_reference_id présent, e-mail Stripe différent (cas Google) -> bon compte", async () => {
  const b = banc({ cs_g: [ligne("recharge")] });
  await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_g", customer_details: { email: "autre.adresse@yahoo.fr" } })));
  assert.equal(b.solde(U1), 3);
});
test("14 client_reference_id ABSENT + e-mail Stripe différent -> NON crédité (orphelin, 200)", async () => {
  const b = banc({ cs_orph: [ligne("recharge")] });
  const r = await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_orph", client_reference_id: null, customer_details: { email: "autre.adresse@yahoo.fr" } })));
  assert.equal(r.statusCode, 200);
  assert.match(r.body, /orphelin/);
  assert.equal(b.solde(U1), 0);
});
test("15 client_reference_id absent + même e-mail (casse différente) -> crédité par e-mail", async () => {
  const b = banc({ cs_mail: [ligne("recharge")] });
  await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_mail", client_reference_id: null, customer_details: { email: "Compte.Google@Gmail.com" } })));
  assert.equal(b.solde(U1), 3);
});
test("16 client existant (stripe_customer_id) sans référence ni e-mail -> crédité", async () => {
  const b = banc({ cs_ex: [ligne("recharge")] });
  await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_ex", client_reference_id: null, customer: "cus_EXISTANT", customer_details: { email: "" } })));
  assert.equal(b.solde(U2), 8);
});
test("17 nouveau client -> stripe_customer_id lié au compte (pour les renouvellements)", async () => {
  const b = banc({ cs_new: [ligne("mensuel")] });
  await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_new", amount_total: 599, mode: "subscription", customer: "cus_NOUVEAU" })));
  assert.equal(b.supabase.db.profils.find(p => p.id === U1).stripe_customer_id, "cus_NOUVEAU");
});
test("18 client_reference_id non-UUID (bricolé) -> ignoré, pas d'erreur SQL en boucle", async () => {
  const b = banc({ cs_bad: [ligne("recharge")] });
  const r = await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_bad", client_reference_id: "pas-un-uuid" })));
  assert.equal(r.statusCode, 200);
  assert.equal(b.solde(U1), 3); // retrouvé par e-mail
});
test("19 client_reference_id d'un compte inexistant + e-mail inconnu -> orphelin", async () => {
  const b = banc({ cs_inex: [ligne("recharge")] });
  const r = await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_inex", client_reference_id: "99999999-9999-9999-9999-999999999999", customer_details: { email: "x@y.z" } })));
  assert.match(r.body, /orphelin/);
});

// ═══ Abonnements ════════════════════════════════════════════════════
test("20 renouvellement mensuel (invoice.paid, subscription_cycle) -> +8", async () => {
  const b = banc();
  await b.handler(evenement(b.stripe, "invoice.paid", facture({ id: "in_m1" })));
  assert.equal(b.solde(U2), 13);
});
test("21 renouvellement annuel, ancien format API (line.price) -> +60", async () => {
  const b = banc();
  await b.handler(evenement(b.stripe, "invoice.paid", facture({ id: "in_a1", amount_paid: 4999,
    lines: { data: [{ amount: 4999, quantity: 1, price: { id: PRIX.annuel, product: PROD.annuel } }] } })));
  assert.equal(b.solde(U2), 65);
});
test("22 1re facture d'abonnement (subscription_create) -> ignorée (déjà créditée par la session)", async () => {
  const b = banc();
  await b.handler(evenement(b.stripe, "invoice.paid", facture({ id: "in_c1", billing_reason: "subscription_create" })));
  assert.equal(b.solde(U2), 5);
});
test("23 abonnement : session + 1re facture, quel que soit l'ordre -> crédité une seule fois", async () => {
  const b = banc({ cs_sub: [ligne("mensuel")] });
  await b.handler(evenement(b.stripe, "invoice.paid", facture({ id: "in_c2", billing_reason: "subscription_create", customer: "cus_NEW2" })));
  await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_sub", amount_total: 599, mode: "subscription", customer: "cus_NEW2" })));
  assert.equal(b.solde(U1), 8);
});
test("24 renouvellement avec ligne de crédit négative (prorata) -> ligne ignorée", async () => {
  const b = banc();
  await b.handler(evenement(b.stripe, "invoice.paid", facture({ id: "in_pr", lines: { data: [
    { amount: 599, quantity: 1, pricing: { price_details: { price: PRIX.mensuel, product: PROD.mensuel } } },
    { amount: -200, quantity: 1, pricing: { price_details: { price: "price_credit", product: "prod_credit" } } }] } })));
  assert.equal(b.solde(U2), 13);
});
test("25 renouvellement d'un client inconnu -> orphelin 200, rien crédité", async () => {
  const b = banc();
  const r = await b.handler(evenement(b.stripe, "invoice.paid", facture({ id: "in_inc", customer: "cus_INCONNU", customer_email: "inconnu@x.fr" })));
  assert.match(r.body, /orphelin/);
});

// ═══ Idempotence, doublons, désordre, pannes ════════════════════════
test("26 même événement reçu 2 fois -> crédité une fois", async () => {
  const b = banc({ cs_dup: [ligne("recharge")] });
  const ev = evenement(b.stripe, "checkout.session.completed", session({ id: "cs_dup" }), "evt_dup");
  await b.handler(ev); await b.handler(ev);
  assert.equal(b.solde(U1), 3);
});
test("27 deux événements différents pour la même session (renvoi manuel) -> une fois", async () => {
  const b = banc({ cs_dup2: [ligne("recharge")] });
  await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_dup2" }), "evt_a"));
  await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_dup2" }), "evt_b"));
  assert.equal(b.solde(U1), 3);
});
test("28 10 livraisons simultanées du même paiement -> une fois", async () => {
  const b = banc({ cs_conc: [ligne("recharge")] });
  const ev = evenement(b.stripe, "checkout.session.completed", session({ id: "cs_conc" }));
  await Promise.all(Array.from({ length: 10 }, () => b.handler(ev)));
  assert.equal(b.solde(U1), 3);
});
test("29 panne Supabase -> 500 (Stripe retente), puis retry OK -> crédité une fois", async () => {
  const lignes = { cs_panne: [ligne("recharge")] };
  const stripe = fauxStripe(lignes);
  const sbPanne = fauxSupabase({ panne: true });
  const ev = evenement(stripe, "checkout.session.completed", session({ id: "cs_panne" }));
  const r1 = await _test.creerHandler(() => ({ stripe, supabase: sbPanne, webhookSecret: SECRET }))(ev);
  assert.equal(r1.statusCode, 500);
  const sb = fauxSupabase();
  const h = _test.creerHandler(() => ({ stripe, supabase: sb, webhookSecret: SECRET }));
  await h(ev); await h(ev);
  assert.equal(sb.db.profils.find(p => p.id === U1).credits, 3);
});
test("30 panne API Stripe (line items) -> 500, rien crédité", async () => {
  const b = banc({}, { panneApi: true });
  const r = await b.handler(evenement(b.stripe, "checkout.session.completed", session({ id: "cs_api" })));
  assert.equal(r.statusCode, 500);
  assert.equal(b.solde(U1), 0);
});

// ═══ Événements non gérés (pas de crédit, pas d'erreur) ═════════════
for (const type of ["invoice.payment_failed", "charge.refunded", "charge.dispute.created", "customer.subscription.deleted", "payment_intent.payment_failed"]) {
  test(`31 ${type} -> 200, solde inchangé (traitement manuel)`, async () => {
    const b = banc();
    const r = await b.handler(evenement(b.stripe, type, { id: "obj_" + type, customer: "cus_EXISTANT", amount: 299 }));
    assert.equal(r.statusCode, 200);
    assert.equal(b.solde(U2), 5);
  });
}

// ═══ Catalogue ══════════════════════════════════════════════════════
test("32 catalogue : crédits du webhook = crédits annoncés dans l'app", async () => {
  const { readFileSync } = await import("node:fs");
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const annonce = (k) => Number(app.match(new RegExp(`${k}:\\s*(\\d+)`))[1]);
  assert.equal(_test.creditsPourArticles([{ priceId: PRIX.recharge }]).credits, annonce("recharge"));
  assert.equal(_test.creditsPourArticles([{ priceId: PRIX.mensuel }]).credits, annonce("mensuel"));
  assert.equal(_test.creditsPourArticles([{ priceId: PRIX.annuel }]).credits, annonce("annuel"));
});
