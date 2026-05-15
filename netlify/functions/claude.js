// ═══════════════════════════════════════════════════════════════════
//   Netlify Function : proxy vers l'API Anthropic (Claude)
//   Endpoint appelé : /.netlify/functions/claude
//   Pourquoi : contourne le blocage CORS du navigateur
// ═══════════════════════════════════════════════════════════════════

exports.handler = async (event) => {
  // CORS preflight
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: { message: "Méthode non autorisée" } }),
    };
  }

  // Vérifier la présence de la clé API
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: {
          message: "Clé API Anthropic manquante. Configurer ANTHROPIC_API_KEY dans Netlify.",
        },
      }),
    };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const { model, max_tokens, system, messages } = payload;

    if (!model || !messages) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: { message: "Paramètres manquants (model, messages)" } }),
      };
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model,
        max_tokens: max_tokens || 1024,
        system,
        messages,
      }),
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data),
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
