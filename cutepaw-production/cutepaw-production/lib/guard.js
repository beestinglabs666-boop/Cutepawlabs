// lib/guard.js
// Call at the top of every API route to extract identity and enforce limits.

import { enforceLimit, RateLimitError } from "./ratelimit.js";

/**
 * Extract device fingerprint and IP from request.
 * FingerprintJS visitor ID is sent by the frontend in X-Device-Id header.
 */
export function getIdentity(req) {
  const deviceId = req.headers["x-device-id"] || "unknown";
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "0.0.0.0";
  return { deviceId, ip };
}

/**
 * Standard API response helpers
 */
export const ok      = (res, data, status = 200) => res.status(status).json({ ok: true,  ...data });
export const fail    = (res, message, status = 400) => res.status(status).json({ ok: false, error: message });
export const limited = (res, message, resetIn) =>
  res.status(429).json({ ok: false, error: message, resetIn });

/**
 * Wrap an API handler with identity extraction + rate limiting.
 * Usage:
 *   export default withGuard("generate", async (req, res, { deviceId, ip }) => { ... })
 */
export function withGuard(action, handler) {
  return async (req, res) => {
    try {
      const identity = getIdentity(req);

      // Block obviously missing fingerprints
      if (!identity.deviceId || identity.deviceId === "unknown") {
        return fail(res, "Missing device identity.", 400);
      }

      // Enforce rate limit for this action
      await enforceLimit(action, identity.deviceId, identity.ip);

      // Run the actual handler
      return await handler(req, res, identity);

    } catch (err) {
      if (err instanceof RateLimitError) {
        return limited(res, err.message, err.resetIn);
      }
      console.error(`[${action}] Error:`, err.message);
      return fail(res, "Something went wrong. Please try again.", 500);
    }
  };
}
