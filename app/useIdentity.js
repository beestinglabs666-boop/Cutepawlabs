// app/useIdentity.js
// Loads FingerprintJS, gets a stable device ID, then fetches
// the real credit state from the server.
// Returns { deviceId, credits, loading } for use throughout the app.

import { useState, useEffect, useCallback } from "react";

const DEFAULT_CREDITS = {
  free: 0, bonus: 0, total: 0,
  isPro: false, daysUntilReset: 30,
};

export function useIdentity() {
  const [deviceId, setDeviceId]   = useState(null);
  const [credits,  setCredits]    = useState(DEFAULT_CREDITS);
  const [loading,  setLoading]    = useState(true);

  // Load FingerprintJS and get visitor ID
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const FP = await import("@fingerprintjs/fingerprintjs");
        const fp = await FP.default.load();
        const { visitorId } = await fp.get();
        if (!cancelled) setDeviceId(visitorId);
      } catch {
        // Fallback: use a session-persistent random ID stored in sessionStorage
        // Less reliable than FingerprintJS but functional
        let id = sessionStorage.getItem("_cpid");
        if (!id) { id = crypto.randomUUID(); sessionStorage.setItem("_cpid", id); }
        if (!cancelled) setDeviceId(id);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Once we have a device ID, fetch credit state from server
  const syncCredits = useCallback(async (id) => {
    if (!id) return;
    try {
      const res  = await fetch("/api/credits", { headers: { "x-device-id": id } });
      const data = await res.json();
      if (data.ok) setCredits({
        free:          data.free   ?? 0,
        bonus:         data.bonus  ?? 0,
        total:         data.isPro  ? Infinity : (data.total ?? 0),
        isPro:         data.isPro  ?? false,
        daysUntilReset:data.daysUntilReset ?? 30,
      });
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { syncCredits(deviceId); }, [deviceId, syncCredits]);

  // Check referral param on first load
  useEffect(() => {
    if (!deviceId) return;
    const params     = new URLSearchParams(window.location.search);
    const referrerId = params.get("ref");
    if (!referrerId || referrerId === deviceId) return;

    // Claim referral server-side
    fetch("/api/referral", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId },
      body:    JSON.stringify({ referrerDeviceId: referrerId }),
    })
    .then(r => r.json())
    .then(d => { if (d.claimed) syncCredits(deviceId); })
    .catch(() => {});

    // Clean the URL
    window.history.replaceState({}, "", window.location.pathname);
  }, [deviceId, syncCredits]);

  return {
    deviceId,
    credits,
    loading,
    refreshCredits: () => syncCredits(deviceId),
  };
}
