// api/credits.js
// Returns current credit state for a device.
// Called on app load so browser state always reflects server truth.

import { withGuard, ok, fail } from "../lib/guard.js";
import { getCredits }          from "../lib/credits.js";

export default withGuard("analyse", async (req, res, { deviceId }) => {
  if (req.method !== "GET") return fail(res, "Method not allowed.", 405);

  const state = await getCredits(deviceId);

  return ok(res, {
    free:          state.free,
    bonus:         state.bonus,
    total:         state.isPro ? null : state.total,  // null = unlimited
    isPro:         state.isPro,
    daysUntilReset: state.daysUntilReset,
  });
});
