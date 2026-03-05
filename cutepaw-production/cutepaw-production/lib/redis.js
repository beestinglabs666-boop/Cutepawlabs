// lib/redis.js
// Upstash Redis via HTTP REST — works in Vercel Edge & serverless functions.
// No persistent TCP connection needed.

const BASE  = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function cmd(...args) {
  const res = await fetch(`${BASE}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`Redis error: ${res.status}`);
  const { result } = await res.json();
  return result;
}

export const redis = {
  get:    (key)           => cmd("GET", key),
  set:    (key, val, ...opts) => cmd("SET", key, val, ...opts),
  incr:   (key)           => cmd("INCR", key),
  decr:   (key)           => cmd("DECR", key),
  expire: (key, secs)     => cmd("EXPIRE", key, secs),
  del:    (key)           => cmd("DEL", key),
  exists: (key)           => cmd("EXISTS", key),
  ttl:    (key)           => cmd("TTL", key),
  // Atomic increment with expiry — used for rate limiting
  async incrWithExpiry(key, ttlSeconds) {
    const val = await this.incr(key);
    if (val === 1) await this.expire(key, ttlSeconds);
    return val;
  },
};
