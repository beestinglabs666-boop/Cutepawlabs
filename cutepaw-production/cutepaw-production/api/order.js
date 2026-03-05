// api/order.js
// POST /api/order — creates a Stripe Checkout session.
// The browser redirects to Stripe's hosted page; no card data touches our server.
// On success, Stripe calls /api/webhook which forwards to Printful.

import { withGuard, ok, fail } from "../lib/guard.js";

// Stripe product price IDs — create these in your Stripe dashboard
// and paste the price_xxx IDs here
const STRIPE_PRICES = {
  physsticker: "price_sticker_sheet",
  tshirt:      "price_tshirt",
  mug:         "price_mug",
  tote:        "price_tote",
  phone:       "price_phone_case",
  pillow:      "price_cushion",
  poster:      "price_poster",
  notebook:    "price_notebook",
};

export default withGuard("order", async (req, res, { deviceId }) => {
  if (req.method !== "POST") return fail(res, "Method not allowed.", 405);

  const { products, stickerUrl, shippingAddress, isDigitalOnly } = req.body;

  if (!products?.length) return fail(res, "No products selected.", 400);
  if (!stickerUrl)        return fail(res, "Missing sticker image.", 400);

  // Digital-only orders — no Stripe needed, just confirm and return download
  if (isDigitalOnly) {
    return ok(res, { digitalOnly: true, downloadUrl: stickerUrl });
  }

  // Validate shipping address for physical orders
  if (!shippingAddress?.name || !shippingAddress?.email) {
    return fail(res, "Shipping address required for physical products.", 400);
  }

  // Lazy-import Stripe so it only loads when needed
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const lineItems = products
    .filter(id => id !== "vsticker")
    .map(id => ({
      price:    STRIPE_PRICES[id],
      quantity: 1,
    }))
    .filter(item => item.price);

  if (!lineItems.length) return fail(res, "No valid physical products.", 400);

  const domain = `https://${process.env.VITE_APP_DOMAIN || "cutepawlabs.com"}`;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "payment",
    success_url: `${domain}/success?session={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${domain}/`,
    customer_email: shippingAddress.email,
    metadata: {
      deviceId,
      stickerUrl,
      products:        JSON.stringify(products),
      shippingName:    shippingAddress.name,
      shippingAddress: shippingAddress.address,
      shippingCity:    shippingAddress.city,
      shippingPostcode:shippingAddress.postcode,
    },
    shipping_address_collection: { allowed_countries: ["US","GB","CA","AU","DE","FR","NL","IE","NZ"] },
  });

  return ok(res, { checkoutUrl: session.url });
});
