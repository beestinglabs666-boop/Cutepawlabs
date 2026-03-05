// api/webhook.js
// Stripe webhook handler. Verifies signature, then:
//   - payment_intent.succeeded  → create Printful order
//   - checkout.session.completed → same, plus activate Pro if applicable
//   - invoice.paid               → renew Pro subscription
//
// IMPORTANT: In Vercel, disable body parsing for this route (see config export).

import { activatePro } from "../lib/credits.js";

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end",  () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function createPrintfulOrder(meta, lineItems) {
  const items = JSON.parse(meta.products || "[]")
    .filter(id => id !== "vsticker")
    .map(id => ({
      // Map product IDs to Printful variant IDs
      // Fill these in after setting up your Printful catalogue
      sync_variant_id: PRINTFUL_VARIANTS[id],
      quantity: 1,
      files: [{ type: "default", url: meta.stickerUrl }],
    }))
    .filter(i => i.sync_variant_id);

  if (!items.length) return;

  await fetch("https://api.printful.com/orders", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.PRINTFUL_API_KEY}`,
    },
    body: JSON.stringify({
      recipient: {
        name:     meta.shippingName,
        address1: meta.shippingAddress,
        city:     meta.shippingCity,
        zip:      meta.shippingPostcode,
        country_code: meta.shippingCountry || "GB",
        email:    meta.email,
      },
      items,
      confirm: true, // auto-confirm so it goes straight to production
    }),
  });
}

// Printful sync variant IDs — fill in after catalogue setup
const PRINTFUL_VARIANTS = {
  physsticker: null,
  tshirt:      null,
  mug:         null,
  tote:        null,
  phone:       null,
  pillow:      null,
  poster:      null,
  notebook:    null,
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const rawBody = await getRawBody(req);
  const sig     = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const meta    = session.metadata || {};

        // Fire Printful order
        await createPrintfulOrder(meta, session.line_items);

        // Activate Pro if this was a Pro purchase (detected by metadata flag)
        if (meta.isPro === "true") {
          await activatePro(meta.deviceId);
        }
        break;
      }

      case "invoice.paid": {
        // Pro subscription renewal
        const invoice = event.data.object;
        const deviceId = invoice.metadata?.deviceId;
        if (deviceId) await activatePro(deviceId);
        break;
      }

      case "invoice.payment_failed": {
        // Pro lapsed — credits will expire naturally after 35 days
        console.log("Pro payment failed for:", event.data.object.metadata?.deviceId);
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    // Still return 200 so Stripe doesn't retry indefinitely
  }

  res.status(200).json({ received: true });
}
