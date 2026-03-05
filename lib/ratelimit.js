// lib/ratelimit.js
// Sliding window rate limiter using Redis.
// Identifies requests by device fingerprint + IP (both required to match).

import { redis } from "./redis.js";

// Limits per window — adjust as needed after launch
const LIMITS = {
  generate:  { max: 10, windowSecs: 3600  },  // 10 generations/hour per device
  analyse:   { max: 15, windowSecs: 3600  },  // 15 analyses/hour per device
  referral:  { max: 3,  windowSecs: 86400 },  // 3 referral claims/day per device
  order:     { max: 5,  windowSecs: 3600  },  // 5 orders/hour per device
};

/**
 * Check rate limit. Returns { allowed: bool, remaining: int, resetIn: int }
 * @param {string} action   - key from LIMITS
 * @param {string} deviceId - FingerprintJS visitor ID
 * @param {string} ip       - request IP
 */
export async function checkLimit(action, deviceId, ip) {
  const limit = LIMITS[action];
  if (!limit) return { allowed: true, remaining: 999, resetIn: 0 };

  // Combine device + IP so neither alone can be spoofed
  const key   = `rl:${action}:${deviceId}:${ip}`;
  const count = await redis.incrWithExpiry(key, limit.windowSecs);
  const ttl   = await redis.ttl(key);

  return {
    allowed:   count <= limit.max,
    remaining: Math.max(0, limit.max - count),
    resetIn:   ttl,
  };
}

/**
 * Convenience — throws a 429 Response if rate limited.
 * Use inside API routes: await enforceLimit("generate", deviceId, ip)
 */
export async function enforceLimit(action, deviceId, ip) {
  const result = await checkLimit(action, deviceId, ip);
  if (!result.allowed) {
    const mins = Math.ceil(result.resetIn / 60);
    throw new RateLimitError(`Too many requests. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`, result.resetIn);
  }
  return result;
}

export class RateLimitError extends Error {
  constructor(message, resetIn) {
    super(message);
    this.name    = "RateLimitError";
    this.resetIn = resetIn;
    this.status  = 429;
  }
}
