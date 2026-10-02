// Tests des fonctions de conformité (consentement avant paiement, portail
// client Stripe) avec des doubles de Stripe et Supabase : aucun appel réseau.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const consentement = require("../netlify/functions/consentement.js");
const portail = require("../netlify/functions/portail-client.js");

const UTILISATEUR = { id: "11111111-1111-1111-1111-111111111111", email: "a@b.fr" };

function fauxSupabase({ jwtValide = true, profil = { stripe_customer_id: "cus_123" }, erreurInsert = null } = {}) {
  const inserts = [];
  return {
    inserts,
    auth: { getUser: async (jwt) => (jwtValide && jwt === "bon" ? { data: { user: UTILISATEUR }, error: null } : { data: null, error: { message: "jwt" } }) },
    from: (table) => ({
      insert: async (ligne) => { inserts.push({ table, ligne }); return { error: erreurInsert }; },
      select: () => ({ eq: (col, val) => ({ single: async () => {
        assert.equal(col, "id"); assert.equal(val, UTILISATEUR.id);
        return { data: profil, error: null };
      } }) }),
    }),
  };
}
const evt = (o = {}) => ({ httpMethod: "POST", headers: { authorization: "Bearer bon", origin: "https://recrutable.com" }, body: "{}", ...o });
const lire = (r) => JSON.parse(r.body);

// ── consentement ───────────────────────────────────────────────────
test("consentement : GET refusé (405)", async () => {
  const h = consentement.creerHandler(() => ({ supabase: fauxSupabase() }));
  assert.equal((await h(evt({ httpMethod: "GET" }))).statusCode, 405);
});
test("consentement : case non cochée ou offre inconnue -> 400", async () => {
  const h = consentement.creerHandler(() => ({ supabase: fauxSupabase() }));
  assert.equal((await h(evt({ body: JSON.stringify({ offre: "recharge", cgv: true }) }))).statusCode, 400);
  assert.equal((await h(evt({ body: JSON.stringify({ offre: "gratuit", cgv: true, renonciation: true }) }))).statusCode, 400);
});
test("consentement : sans JWT ou JWT invalide -> 401", async () => {
  const h = consentement.creerHandler(() => ({ supabase: fauxSupabase() }));
  const body = JSON.stringify({ offre: "recharge", cgv: true, renonciation: true });
  assert.equal((await h(evt({ body, headers: {} }))).statusCode, 401);
  assert.equal((await h(evt({ body, headers: { authorization: "Bearer faux" } }))).statusCode, 401);
});
test("consentement : enregistré en base, horodaté côté serveur, pour le compte du JWT", async () => {
  const sb = fauxSupabase();
  const h = consentement.creerHandler(() => ({ supabase: sb }));
  const r = await h(evt({ body: JSON.stringify({ offre: "mensuel", cgv: true, renonciation: true, lang: "en", user_id: "pirate" }) }));
  assert.equal(r.statusCode, 200);
  assert.equal(lire(r).stockage, "base");
  const { table, ligne } = sb.inserts[0];
  assert.equal(table, "consentements_achat");
  assert.equal(ligne.user_id, UTILISATEUR.id);
  assert.equal(ligne.offre, "mensuel");
  assert.equal(ligne.langue, "en");
  assert.equal(ligne.version_texte, consentement.VERSION_TEXTE);
  assert.ok(Math.abs(Date.parse(ligne.accepte_le) - Date.now()) < 5000);
});
test("consentement : table absente -> trace en journal (202), paiement non bloqué", async () => {
  const h = consentement.creerHandler(() => ({ supabase: fauxSupabase({ erreurInsert: { message: "relation does not exist" } }) }));
  const r = await h(evt({ body: JSON.stringify({ offre: "recharge", cgv: true, renonciation: true }) }));
  assert.equal(r.statusCode, 202);
  assert.equal(lire(r).stockage, "journal");
});

// ── portail client ─────────────────────────────────────────────────
function fauxStripe({ echec = false } = {}) {
  const appels = [];
  return {
    appels,
    billingPortal: { sessions: { create: async (p) => {
      appels.push(p);
      if (echec) throw new Error("No configuration provided");
      return { url: "https://billing.stripe.com/p/session/test_123" };
    } } },
  };
}
test("portail : GET refusé (405), sans JWT (401)", async () => {
  const h = portail.creerHandler(() => ({ stripe: fauxStripe(), supabase: fauxSupabase() }));
  assert.equal((await h(evt({ httpMethod: "GET" }))).statusCode, 405);
  assert.equal((await h(evt({ headers: {} }))).statusCode, 401);
  assert.equal((await h(evt({ headers: { authorization: "Bearer faux" } }))).statusCode, 401);
});
test("portail : session créée pour le stripe_customer_id du compte (jamais celui du navigateur)", async () => {
  const st = fauxStripe();
  const h = portail.creerHandler(() => ({ stripe: st, supabase: fauxSupabase() }));
  const r = await h(evt({ body: JSON.stringify({ lang: "en", customer: "cus_pirate" }) }));
  assert.equal(r.statusCode, 200);
  assert.match(lire(r).url, /^https:\/\/billing\.stripe\.com\//);
  assert.equal(st.appels[0].customer, "cus_123");
  assert.equal(st.appels[0].locale, "en");
  assert.equal(st.appels[0].return_url, "https://recrutable.com/");
});
test("portail : origine inconnue -> retour sur recrutable.com ; Deploy Preview acceptée", async () => {
  const st = fauxStripe();
  const h = portail.creerHandler(() => ({ stripe: st, supabase: fauxSupabase() }));
  await h(evt({ headers: { authorization: "Bearer bon", origin: "https://phishing.example" } }));
  await h(evt({ headers: { authorization: "Bearer bon", origin: "https://deploy-preview-3--recrutables.netlify.app" } }));
  assert.equal(st.appels[0].return_url, "https://recrutable.com/");
  assert.equal(st.appels[1].return_url, "https://deploy-preview-3--recrutables.netlify.app/");
});
test("portail : compte sans client Stripe -> 404 aucun_abonnement", async () => {
  const h = portail.creerHandler(() => ({ stripe: fauxStripe(), supabase: fauxSupabase({ profil: { stripe_customer_id: null } }) }));
  const r = await h(evt());
  assert.equal(r.statusCode, 404);
  assert.equal(lire(r).raison, "aucun_abonnement");
});
test("portail : portail non configuré dans Stripe -> 502 portail_indisponible", async () => {
  const h = portail.creerHandler(() => ({ stripe: fauxStripe({ echec: true }), supabase: fauxSupabase() }));
  const r = await h(evt());
  assert.equal(r.statusCode, 502);
  assert.equal(lire(r).raison, "portail_indisponible");
});
