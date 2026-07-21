// ═══════════════════════════════════════════════════════════════
//  claude.js — Endpoint IA SECURISE (non-streaming).
//  Le client envoie : { action, payload } + header Authorization: Bearer <JWT>.
//  Les prompts, modeles et plafonds sont exclusivement COTE SERVEUR.
// ═══════════════════════════════════════════════════════════════
const { autoriserAppel } = require("./_securite");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST")
    return { statusCode: 405, body: JSON.stringify({ error: { message: "Methode non autorisee" } }) };

  let ctx;
  try {
    ctx = await autoriserAppel(event);
  } catch (e) {
    return { statusCode: e.code || 500, body: JSON.stringify({ error: { message: e.message || "Erreur" } }) };
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ctx.conf.model,
        max_tokens: ctx.conf.maxTokens,
        system: ctx.system,
        messages: [{ role: "user", content: [{ type: "text", text: ctx.userText }] }],
      }),
    });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      await ctx.rembourser();
      return { statusCode: 502, body: JSON.stringify({ error: { message: "Service IA indisponible. Reessayez." } }) };
    }
    // Reponse minimale : le texte + le solde de credits (si debite)
    return {
      statusCode: 200,
      body: JSON.stringify({ content: data.content, credits: ctx.solde }),
    };
  } catch (err) {
    await ctx.rembourser();
    return { statusCode: 502, body: JSON.stringify({ error: { message: "Service IA indisponible. Reessayez." } }) };
  }
};
