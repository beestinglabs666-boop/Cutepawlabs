// api/referral.js
// Handles referral claim. Called when a new user opens a referral link.
// Awards 1 credit to both referrer and claimer, once per pair.

import { withGuard, ok, fail } from "../lib/guard.js";
import { claimReferral }       from "../lib/referral.js";

export default withGuard("referral", async (req, res, { deviceId }) => {
  if (req.method !== "POST") return fail(res, "Method not allowed.", 405);

  const { referrerDeviceId } = req.body;

  if (!referrerDeviceId) {
    return fail(res, "Missing referrer ID.", 400);
  }

  const result = await claimReferral(deviceId, referrerDeviceId);

  if (!result.success) {
    // Not an error per se — just already claimed or self-referral
    return ok(res, { claimed: false, reason: result.reason });
  }

  return ok(res, { claimed: true, creditsAdded: result.creditsAdded });
});
