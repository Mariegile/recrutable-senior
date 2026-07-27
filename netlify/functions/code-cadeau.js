// ═══════════════════════════════════════════════════════════════
//  code-cadeau.js — Validation SÉCURISÉE des codes cadeau.
//
//  Corrige la faille S5 : les codes n'existent plus dans le JS client
//  (ils étaient lisibles via F12) et l'usage unique ne repose plus sur
//  localStorage (effaçable → réutilisation infinie).
//
//  Ici : JWT vérifié, rate-limit par IP, puis RPC SQL atomique qui
//  contrôle existence / activation / expiration / quota / usage unique
//  par compte, et crédite dans la même transaction.
//
//  Env requises : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ═══════════════════════════════════════════════════════════════
const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Anti-force brute : 8 tentatives / minute / IP (les codes sont devinables).
const hits = new Map();
function rateLimitOk(ip, max = 8, windowMs = 60000) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return true;
}

function reponse(statusCode, body) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return reponse(405, { ok: false, raison: "methode" });

  const ip =
    event.headers["x-nf-client-connection-ip"] ||
    (event.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    "inconnu";
  if (!rateLimitOk(ip)) return reponse(429, { ok: false, raison: "trop_de_tentatives" });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { body = {}; }

  const code = String(body.code || "").trim().toUpperCase().slice(0, 40);
  if (!code || !/^[A-Z0-9_-]{3,40}$/.test(code)) return reponse(400, { ok: false, raison: "inconnu" });

  // Authentification : un code cadeau se rattache à un COMPTE.
  const jwt = (event.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return reponse(401, { ok: false, raison: "connexion" });

  const auth = await supabaseAdmin.auth.getUser(jwt);
  if (auth.error || !auth.data || !auth.data.user) return reponse(401, { ok: false, raison: "connexion" });
  const user = auth.data.user;

  // RPC atomique : vérifie et crédite en une seule transaction.
  const { data, error } = await supabaseAdmin.rpc("utiliser_code_cadeau", {
    p_user_id: user.id,
    p_code: code,
  });

  if (error) {
    console.error("utiliser_code_cadeau:", error.message);
    return reponse(500, { ok: false, raison: "erreur" });
  }

  // data = { ok, raison, credits, total }
  if (!data || !data.ok) return reponse(200, { ok: false, raison: (data && data.raison) || "inconnu" });

  return reponse(200, { ok: true, credits: data.credits, total: data.total });
};
