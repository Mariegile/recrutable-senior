/* global require, process, exports */
// ═══════════════════════════════════════════════════════════════
//  portail-client.js — Résiliation / gestion en ligne de l'abonnement.
//
//  Crée une session du portail client Stripe pour le compte connecté :
//  JWT Supabase vérifié, puis stripe_customer_id lu dans profils (jamais
//  fourni par le navigateur). Le portail doit être activé dans Stripe
//  (Paramètres > Facturation > Portail client).
//
//  Env requises : STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ═══════════════════════════════════════════════════════════════
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const RETOUR_PAR_DEFAUT = "https://recrutable.com/";

function reponse(statusCode, body) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

// Retour vers l'origine de la page appelante si c'est un domaine connu.
function urlRetour(event) {
  const origine = (event.headers || {}).origin || "";
  if (/^https:\/\/([a-z0-9-]+--)?recrutables?\.(com|netlify\.app)$/.test(origine) || /^http:\/\/localhost:\d+$/.test(origine)) {
    return origine + "/";
  }
  return RETOUR_PAR_DEFAUT;
}

function creerHandler(deps) {
  return async (event) => {
    if (event.httpMethod !== "POST") return reponse(405, { ok: false, raison: "methode" });
    const { stripe, supabase } = deps();
    if (!stripe || !supabase) {
      console.error("portail-client : configuration Stripe ou Supabase manquante");
      return reponse(500, { ok: false, raison: "configuration" });
    }

    const jwt = ((event.headers || {}).authorization || "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return reponse(401, { ok: false, raison: "connexion" });
    const auth = await supabase.auth.getUser(jwt);
    if (auth.error || !auth.data || !auth.data.user) return reponse(401, { ok: false, raison: "connexion" });

    const { data, error } = await supabase
      .from("profils").select("stripe_customer_id").eq("id", auth.data.user.id).single();
    if (error) {
      console.error("portail-client profils :", error.message);
      return reponse(500, { ok: false, raison: "erreur" });
    }
    if (!data || !data.stripe_customer_id) return reponse(404, { ok: false, raison: "aucun_abonnement" });

    let body;
    try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: data.stripe_customer_id,
        return_url: urlRetour(event),
        locale: body.lang === "en" ? "en" : "fr",
      });
      return reponse(200, { ok: true, url: session.url });
    } catch (e) {
      // Cas typique : portail client non configuré dans le tableau de bord Stripe.
      console.error("portail-client Stripe :", e.message);
      return reponse(502, { ok: false, raison: "portail_indisponible" });
    }
  };
}

let cache = null;
function depsReelles() {
  if (cache) return cache;
  const cle = process.env.STRIPE_SECRET_KEY;
  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cache = {
    stripe: cle ? new Stripe(cle) : null,
    supabase: url && service ? createClient(url, service, { auth: { persistSession: false } }) : null,
  };
  return cache;
}

exports.handler = creerHandler(depsReelles);
exports.creerHandler = creerHandler;
