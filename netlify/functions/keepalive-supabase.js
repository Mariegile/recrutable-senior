// ═══════════════════════════════════════════════════════════════════
//  Fonction planifiée (quotidienne, voir netlify.toml) : lecture légère
//  sur Supabase pour éviter la mise en pause du projet (offre gratuite,
//  pause après ~7 jours sans activité).
//
//  - Ne renvoie aucune donnée (comptage "head", aucune ligne lue).
//  - Une fonction planifiée n'est pas appelable publiquement en production.
//  - Si la configuration manque ou si Supabase répond mal : simple
//    avertissement dans les logs, réponse 200, jamais de plantage.
// ═══════════════════════════════════════════════════════════════════
const { createClient } = require("@supabase/supabase-js");

async function ping(supabase) {
  const { error } = await supabase
    .from("profils")
    .select("id", { count: "exact", head: true });
  return error ? error.message : null;
}

function creerHandler(fabriqueClient) {
  return async () => {
    const url = process.env.SUPABASE_URL;
    const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !cle) {
      console.warn("keepalive-supabase: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante, ping ignoré");
      return { statusCode: 200, body: "ignoré" };
    }
    try {
      const erreur = await ping(fabriqueClient(url, cle));
      if (erreur) {
        console.warn("keepalive-supabase: réponse en erreur:", erreur);
        return { statusCode: 200, body: "erreur" };
      }
      console.log("keepalive-supabase: ok");
      return { statusCode: 200, body: "ok" };
    } catch (err) {
      console.warn("keepalive-supabase: échec:", err.message);
      return { statusCode: 200, body: "échec" };
    }
  };
}

exports.handler = creerHandler((url, cle) =>
  createClient(url, cle, { auth: { persistSession: false } })
);
exports._test = { creerHandler };
