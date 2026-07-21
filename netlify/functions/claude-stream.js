// ═══════════════════════════════════════════════════════════════
//  claude-stream.js — Endpoint IA SECURISE (streaming SSE).
//  Memes controles que claude.js (auth, quota, credits serveur).
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
        stream: true,
        system: ctx.system,
        messages: [{ role: "user", content: [{ type: "text", text: ctx.userText }] }],
      }),
    });
    if (!res.ok || !res.body) {
      await ctx.rembourser();
      return { statusCode: 502, body: JSON.stringify({ error: { message: "Service IA indisponible. Reessayez." } }) };
    }

    // Retransmission SSE simplifiee : on ne relaie que les deltas de texte.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let out = "";
    let buffer = "";
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      buffer += decoder.decode(r.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const piece = line.slice(6).trim();
        if (piece === "[DONE]") continue;
        try {
          const evt = JSON.parse(piece);
          const text = (evt.delta && evt.delta.text) || "";
          if (text) out += "data: " + JSON.stringify({ text: text }) + "\n\n";
        } catch (e) {}
      }
    }
    out += "data: [DONE]\n\n";
    return {
      statusCode: 200,
      headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
      body: out,
    };
  } catch (err) {
    await ctx.rembourser();
    return { statusCode: 502, body: JSON.stringify({ error: { message: "Service IA indisponible. Reessayez." } }) };
  }
};
