// lib/referral.js
// Referral system — each device can claim one credit per unique referrer.
// A referrer only gets credit when a NEW device (not previously seen) claims.

import { redis }        from "./redis.js";
import { addBonusCredits } from "./credits.js";

const k = {
  // Has this claimer already claimed from this referrer?
  claimed:  (claimerDeviceId, referrerDeviceId) =>
    `ref:claimed:${referrerDeviceId}:${claimerDeviceId}`,
  // Has this device been seen before? (prevents self-referral loop)
  seen:     (deviceId) => `ref:seen:${deviceId}`,
  // Total referrals earned by this device
  earned:   (deviceId) => `ref:earned:${deviceId}`,
};

/**
 * Claim a referral reward.
 * @param {string} claimerDeviceId  - device claiming the reward
 * @param {string} referrerDeviceId - device that shared the link
 * @returns {{ success, reason, creditsAdded }}
 */
export async function claimReferral(claimerDeviceId, referrerDeviceId) {
  // Can't refer yourself
  if (claimerDeviceId === referrerDeviceId) {
    return { success: false, reason: "Nice try 😄 You can't refer yourself." };
  }

  // Has this claimer already used this referrer's link?
  const alreadyClaimed = await redis.exists(k.claimed(claimerDeviceId, referrerDeviceId));
  if (alreadyClaimed) {
    return { success: false, reason: "You've already claimed this referral." };
  }

  // Mark claim immediately (idempotent — prevents race condition double-claims)
  const TTL = 365 * 24 * 60 * 60; // remember for 1 year
  await redis.set(k.claimed(claimerDeviceId, referrerDeviceId), "1", "EX", TTL);

  // Mark claimer as "seen" so they can become a referrer themselves
  await redis.set(k.seen(claimerDeviceId), "1", "EX", TTL);

  // Award 1 credit to the referrer
  await addBonusCredits(referrerDeviceId, 1);

  // Track referrer's total earned (useful for admin dashboard later)
  await redis.incrWithExpiry(k.earned(referrerDeviceId), TTL);

  // Also give claimer 1 bonus credit for being a new user
  await addBonusCredits(claimerDeviceId, 1);

  return { success: true, creditsAdded: 1 };
}

export async function getReferralStats(deviceId) {
  const earned = parseInt((await redis.get(k.earned(deviceId))) || "0");
  return { totalReferrals: earned, creditsEarned: earned };
}
