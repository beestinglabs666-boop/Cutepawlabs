// lib/credits.js
// Server-side credit system. All state lives in Redis — browser state is
// display-only and re-synced on every page load.

import { redis } from "./redis.js";

const FREE_CREDITS    = 3;
const CYCLE_DAYS      = 30;
const CYCLE_SECS      = CYCLE_DAYS * 24 * 60 * 60;

// Monthly API spend tracking — blocks ALL generation if cap is exceeded
const SPEND_CAP       = parseFloat(process.env.MONTHLY_SPEND_CAP_USD || "50");
const COST_PER_GEN    = 0.023; // $0.02 Anthropic + $0.003 fal.ai

// Redis key helpers
const k = {
  credits:    id => `credits:free:${id}`,
  bonus:      id => `credits:bonus:${id}`,
  cycleStart: id => `credits:cycle:${id}`,
  pro:        id => `credits:pro:${id}`,
  spend:      ()  => `spend:${new Date().toISOString().slice(0,7)}`, // spend:2025-01
};

export async function getCredits(deviceId) {
  const [free, bonus, cycleStart, isPro] = await Promise.all([
    redis.get(k.credits(deviceId)),
    redis.get(k.bonus(deviceId)),
    redis.get(k.cycleStart(deviceId)),
    redis.get(k.pro(deviceId)),
  ]);

  const now      = Date.now();
  const start    = parseInt(cycleStart || "0");
  const elapsed  = now - start;

  // Reset free credits if 30-day cycle has elapsed
  let freeCount = parseInt(free ?? FREE_CREDITS);
  if (!cycleStart || elapsed > CYCLE_SECS * 1000) {
    freeCount = FREE_CREDITS;
    await Promise.all([
      redis.set(k.credits(deviceId), FREE_CREDITS),
      redis.set(k.cycleStart(deviceId), now),
    ]);
  }

  const daysUntilReset = Math.ceil(Math.max(0, CYCLE_SECS * 1000 - elapsed) / (24 * 60 * 60 * 1000));
  const bonusCount     = parseInt(bonus || "0");

  return {
    free:          freeCount,
    bonus:         bonusCount,
    total:         isPro ? Infinity : freeCount + bonusCount,
    isPro:         !!isPro,
    daysUntilReset,
  };
}

/**
 * Attempt to spend 1 credit. Returns { success, reason }
 * Also checks the monthly spend cap.
 */
export async function spendCredit(deviceId) {
  // Check global spend cap first
  const monthSpend = parseFloat((await redis.get(k.spend())) || "0");
  if (monthSpend >= SPEND_CAP) {
    return { success: false, reason: "Service temporarily unavailable. Try again later." };
  }

  const { free, bonus, isPro } = await getCredits(deviceId);

  if (isPro) {
    // Pro users: just track spend, no credit deduction
    await redis.set(k.spend(), (monthSpend + COST_PER_GEN).toFixed(4), "EX", CYCLE_SECS * 2);
    return { success: true };
  }

  if (free > 0) {
    await Promise.all([
      redis.decr(k.credits(deviceId)),
      redis.set(k.spend(), (monthSpend + COST_PER_GEN).toFixed(4), "EX", CYCLE_SECS * 2),
    ]);
    return { success: true };
  }

  if (bonus > 0) {
    await Promise.all([
      redis.decr(k.bonus(deviceId)),
      redis.set(k.spend(), (monthSpend + COST_PER_GEN).toFixed(4), "EX", CYCLE_SECS * 2),
    ]);
    return { success: true };
  }

  return { success: false, reason: "No credits remaining." };
}

export async function addBonusCredits(deviceId, amount) {
  const current = parseInt((await redis.get(k.bonus(deviceId))) || "0");
  await redis.set(k.bonus(deviceId), current + amount);
  return current + amount;
}

export async function activatePro(deviceId) {
  // Expires in 35 days — Stripe webhook re-sets it each billing cycle
  await redis.set(k.pro(deviceId), "1", "EX", 35 * 24 * 60 * 60);
}

export async function getMonthlySpend() {
  return parseFloat((await redis.get(k.spend())) || "0");
}
