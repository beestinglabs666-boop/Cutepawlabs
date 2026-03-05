// lib/pixels.js
// Retargeting pixel manager. Fires Meta (Facebook) and Google events
// based on user actions. Completely invisible — no UI, no consent banner
// needed for basic analytics (check your jurisdiction — GDPR may require consent).
//
// HOW IT WORKS:
// When a user visits, their browser ID is added to your Meta/Google ad audiences.
// When you run ads for CutePaw Labs (or any future product), you can target:
//   - Everyone who visited but didn't generate a sticker  → "Come back, 3 free stickers!"
//   - Everyone who generated but didn't order            → "Your sticker is waiting to be printed"
//   - Everyone who ordered once                          → "Order another, 20% off"
//   - Pro users                                          → don't waste ad spend on them
//
// SETUP:
//   1. Create a Meta Business account → Events Manager → get your Pixel ID
//   2. Create a Google Ads account → Audience Manager → get your Tag ID
//   3. Add VITE_META_PIXEL_ID and VITE_GTAG_ID to your .env

const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID;
const GTAG_ID       = import.meta.env.VITE_GTAG_ID;

let metaLoaded  = false;
let gtagLoaded  = false;

// ── Load scripts once ────────────────────────────────────────────────────────

function loadMeta() {
  if (metaLoaded || !META_PIXEL_ID) return;
  metaLoaded = true;

  const script = document.createElement("script");
  script.async = true;
  script.src   = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  window.fbq = window.fbq || function() {
    (window.fbq.q = window.fbq.q || []).push(arguments);
  };
  window.fbq.loaded = true;
  window.fbq.version = "2.0";
  window.fbq("init", META_PIXEL_ID);
}

function loadGtag() {
  if (gtagLoaded || !GTAG_ID) return;
  gtagLoaded = true;

  const s = document.createElement("script");
  s.async = true;
  s.src   = `https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GTAG_ID, { send_page_view: false });
}

// ── Public API ───────────────────────────────────────────────────────────────

export const pixels = {
  /**
   * Call once on app mount. Fires PageView and sets up audiences.
   */
  init() {
    loadMeta();
    loadGtag();
    this.fire("PageView");
  },

  /**
   * Fire a named event on both pixels.
   * Standard events: PageView, ViewContent, AddToCart, Purchase, Lead
   * Custom events: anything else (StickerGenerated, StyleChanged, etc.)
   */
  fire(event, params = {}) {
    try {
      if (window.fbq) window.fbq("track", event, params);
      if (window.gtag) window.gtag("event", event, params);
    } catch {}
  },

  // ── Semantic helpers — call these at the right moments in the app ──────────

  /** User lands on the app */
  pageView()                     { this.fire("PageView"); },

  /** User uploads a photo */
  photoUploaded()                { this.fire("ViewContent", { content_name: "photo_uploaded" }); },

  /** AI sticker generated successfully */
  stickerGenerated(styleId)      { this.fire("StickerGenerated", { style: styleId }); },

  /** User reaches product selection */
  reachedProducts()              { this.fire("AddToCart"); },

  /** User selects a specific product */
  productSelected(productId, price) {
    this.fire("AddToCart", { content_ids: [productId], value: price, currency: "GBP" });
  },

  /** User completes checkout */
  purchase(total, products)      {
    this.fire("Purchase", {
      value:       total,
      currency:    "GBP",
      content_ids: products,
      content_type:"product",
    });
  },

  /** User views Pro paywall */
  paywallViewed(trigger)         { this.fire("Lead", { content_name: trigger }); },

  /** User starts Pro trial / purchase */
  proStarted()                   { this.fire("Subscribe", { value: 7.99, currency: "GBP" }); },

  /** User shares referral link */
  referralShared()               { this.fire("ReferralShared"); },

  /** Used to suppress ads for paying customers */
  markAsPayer()                  { this.fire("Purchase"); },
};
