/* ============================================================================
   Raho landing — external connection config
   ----------------------------------------------------------------------------
   Every value Mahdi must supply lives HERE and nowhere else. The page is
   "one value away from live": paste the real value, redeploy, done.

   Anything left as a __PLACEHOLDER__ string is treated as "not connected yet":
   the matching UI degrades gracefully (store buttons → waitlist, analytics →
   off, links → "#"). See README.md for the NeedsYou checklist.
   ============================================================================ */

window.RAHO_CONFIG = {
  // --- App store listings -------------------------------------------------
  // Paste the full listing URLs once the apps are published.
  appStoreUrl: "__APP_STORE_URL__", // e.g. https://apps.apple.com/de/app/raho/id000000000
  playStoreUrl: "__PLAY_STORE_URL__", // e.g. https://play.google.com/store/apps/details?id=app.raho

  // --- Waitlist / email signup -------------------------------------------
  // Supabase edge function that inserts into beta_waitlist and returns 409
  // + { duplicate: true } for an email already on the list. See
  // supabase/functions/waitlist-join/index.ts.
  waitlistEndpoint: "https://cidgrqwqvodofcxzoiff.supabase.co/functions/v1/waitlist-join",

  // --- Analytics ----------------------------------------------------------
  // Plausible is privacy-first and matches Raho's stance. Set the domain you
  // register in Plausible. Leave as placeholder to disable analytics entirely.
  analytics: {
    provider: "plausible", // "plausible" | "none"
    domain: "__ANALYTICS_DOMAIN__", // e.g. raho.app
    scriptSrc: "https://plausible.io/js/script.js",
  },

  // --- Canonical / external links ----------------------------------------
  // The privacy-policy + impressum already live on the privacy-site Vercel
  // deploy at getraho.app (clean URLs: /privacy → privacy-policy.html). These
  // are real, live URLs — they work out of the box. Swap only if the domain
  // changes.
  links: {
    privacyPolicy: "https://getraho.app/privacy",
    impressum: "https://getraho.app/impressum",
    // social / contact — placeholders hide the icon until a real value is set.
    instagram: "__INSTAGRAM_URL__", // e.g. https://instagram.com/<handle>
    telegram: "__TELEGRAM_URL__", // e.g. https://t.me/<channel>
    email: "__CONTACT_EMAIL__", // public contact address, e.g. hi@getraho.app
  },

  // --- Site canonical domain (for <meta>/og) -----------------------------
  siteUrl: "__SITE_URL__", // e.g. https://raho.app
};
