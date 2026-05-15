// ═══════════════════════════════════════════════════════════════════
//   Netlify Function : proxy STREAMING vers l'API Anthropic
//   Endpoint appelé : /.netlify/functions/claude-stream
//   Permet l'effet "ChatGPT" (texte qui apparaît progressivement)
// ═══════════════════════════════════════════════════════════════════

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: { message: "Méthode non autorisée" } }),
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: {
          message: "Clé API Anthropic manquante. Configurer ANTHROPIC_API_KEY dans Netlify.",
        },
      }),
    };
  }

  try {
    const { model, max_tokens, system, userText } = JSON.parse(event.body || "{}");

    if (!model || !userText) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: { message: "Paramètres manquants (model, userText)" } }),
      };
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: max_tokens || 1024,
        system,
        stream: true,
        messages: [{ role: "user", content: [{ type: "text", text: userText }] }],
      }),
    });

    // Si erreur API, retourner le détail
    if (!response.ok) {
      const errorBody = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorBody);
      } catch {
        errorJson = { error: { message: errorBody } };
      }
      return {
        statusCode: response.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(errorJson),
      };
    }

    // Récupérer le flux complet (les Netlify Functions classiques bufferisent)
    // Le côté client va parser les chunks SSE de toute façon
    const text = await response.text();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: { message: err.message || "Erreur serveur inconnue" },
      }),
    };
  }
};
