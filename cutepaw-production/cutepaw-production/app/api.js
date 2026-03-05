// app/api.js
// All client → server API calls live here.
// Automatically attaches the device ID header so every request is identifiable.
// API keys never appear in this file — they live in server-side env vars.

let _deviceId = null;
export function setDeviceId(id) { _deviceId = id; }

function headers(extra = {}) {
  return {
    "Content-Type": "application/json",
    ...(  _deviceId ? { "x-device-id": _deviceId } : {}),
    ...extra,
  };
}

async function post(path, body) {
  const res  = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  const data = await res.json();
  if (!data.ok) throw new ApiError(data.error || "Request failed", res.status);
  return data;
}

async function get(path) {
  const res  = await fetch(path, { headers: headers() });
  const data = await res.json();
  if (!data.ok) throw new ApiError(data.error || "Request failed", res.status);
  return data;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name   = "ApiError";
    this.status = status;
  }
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * Analyse a pet photo. Returns a description object + spends 1 credit.
 * @param {string} base64  - base64-encoded image data (no data: prefix)
 * @param {string} mimeType
 */
export async function analysePhoto(base64, mimeType) {
  return post("/api/analyse", { image: base64, mimeType });
}

/**
 * Generate a sticker for a given style and caption.
 * Returns { url } — the generated PNG URL from fal.ai.
 */
export async function generateSticker(description, styleId, caption, isPro = false) {
  return post("/api/generate", { description, styleId, caption, isPro });
}

/**
 * Generate all 3 free styles in parallel.
 * Returns [kawaii_url, comic_url, watercolour_url] — nulls on failure.
 */
export async function generateAllStyles(description, caption, isPro) {
  const FREE = ["kawaii", "comic", "watercolour"];
  const results = await Promise.allSettled(
    FREE.map(styleId => generateSticker(description, styleId, caption, isPro))
  );
  return results.map(r => r.status === "fulfilled" ? r.value.url : null);
}

/**
 * Create a Stripe Checkout session for physical products.
 * Returns { checkoutUrl } — redirect the browser there.
 * For digital-only returns { digitalOnly: true, downloadUrl }.
 */
export async function createOrder({ products, stickerUrl, shippingAddress, isDigitalOnly }) {
  return post("/api/order", { products, stickerUrl, shippingAddress, isDigitalOnly });
}

/**
 * Get current credit state from server.
 */
export async function fetchCredits() {
  return get("/api/credits");
}
