/* global require, process, exports */
// ═══════════════════════════════════════════════════════════════
//  consentement.js — Preuve du consentement avant paiement.
//
//  Enregistre, pour le compte connecté (JWT vérifié), l'accord aux CGV et
//  la renonciation au droit de rétractation (art. L221-28 13° C. conso),
//  horodatés côté serveur, juste avant l'ouverture du paiement Stripe.
//  Table : consentements_achat (voir supabase/migrations). Si la table
//  n'existe pas encore, le consentement est au moins tracé dans les
//  journaux Netlify (ligne CONSENTEMENT).
//
//  Env requises : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ═══════════════════════════════════════════════════════════════
const { createClient } = require("@supabase/supabase-js");

// Version du texte affiché à côté de la case : à changer si le texte change.
const VERSION_TEXTE = "2026-10-02";
const OFFRES = ["recharge", "mensuel", "annuel"];

function reponse(statusCode, body) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

function creerHandler(deps) {
  return async (event) => {
    if (event.httpMethod !== "POST") return reponse(405, { ok: false, raison: "methode" });
    const { supabase } = deps();
    if (!supabase) return reponse(500, { ok: false, raison: "configuration" });

    let body;
    try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
    if (!OFFRES.includes(body.offre) || body.renonciation !== true || body.cgv !== true) {
      return reponse(400, { ok: false, raison: "donnees" });
    }

    const jwt = ((event.headers || {}).authorization || "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return reponse(401, { ok: false, raison: "connexion" });
    const auth = await supabase.auth.getUser(jwt);
    if (auth.error || !auth.data || !auth.data.user) return reponse(401, { ok: false, raison: "connexion" });

    const ligne = {
      user_id: auth.data.user.id,
      offre: body.offre,
      version_texte: VERSION_TEXTE,
      langue: body.lang === "en" ? "en" : "fr",
      accepte_le: new Date().toISOString(),
    };
    console.log("CONSENTEMENT " + JSON.stringify(ligne));

    const { error } = await supabase.from("consentements_achat").insert(ligne);
    if (error) {
      console.error("consentement : enregistrement en base impossible :", error.message);
      return reponse(202, { ok: true, stockage: "journal" });
    }
    return reponse(200, { ok: true, stockage: "base" });
  };
}

let cache = null;
function depsReelles() {
  if (cache) return cache;
  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cache = { supabase: url && service ? createClient(url, service, { auth: { persistSession: false } }) : null };
  return cache;
}

exports.handler = creerHandler(depsReelles);
exports.creerHandler = creerHandler;
exports.VERSION_TEXTE = VERSION_TEXTE;
