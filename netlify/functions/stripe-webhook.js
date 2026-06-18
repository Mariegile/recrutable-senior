// Netlify Function — Webhook Stripe (credite le compte apres un paiement verifie)
// Endpoint : /.netlify/functions/stripe-webhook
// Variables d'environnement requises (Netlify) :
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Montant paye (en centimes) -> nombre de credits
function creditsPourMontant(cents) {
  if (cents >= 4000) return 60; // Annuel 49,99 EUR
  if (cents >= 500) return 8;   // Mensuel 5,99 EUR
  if (cents >= 100) return 3;   // Recharge 2,99 EUR
  return 0;
}

exports.handler = async (event) => {
  const sig = event.headers["stripe-signature"];
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return { statusCode: 400, body: "Signature invalide: " + err.message };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const obj = stripeEvent.data.object;
    const email = ((obj.customer_details && obj.customer_details.email) || obj.customer_email || "").toLowerCase();
    const credits = creditsPourMontant(obj.amount_total || 0);

    if (email && credits > 0) {
      // Idempotence : ne pas crediter deux fois la meme session de paiement
      const { data: deja } = await supabase
        .from("transactions").select("id").eq("details", obj.id).limit(1);

      if (!deja || deja.length === 0) {
        // On retrouve le compte par son e-mail
        const { data: prof } = await supabase
          .from("profils").select("id, credits").eq("email", email).single();

        if (prof) {
          await supabase.from("profils")
            .update({ credits: prof.credits + credits }).eq("id", prof.id);
          await supabase.from("transactions")
            .insert({ user_id: prof.id, montant: credits, type: "achat", details: obj.id });
        }
        // Si aucun compte ne correspond a cet e-mail : on ne fait rien (a crediter a la main).
      }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
