/* waitlistSourceFromQuery — reads a `?src=` query string and returns a safe
   attribution tag for the waitlist `source` field, so each recruitment
   channel (Telegram group, Instagram post, etc.) gets its own link and shows
   up separately in beta_waitlist. Falls back to "landing" when absent/invalid.
   Used by main.js (browser) and waitlist-source.test.js (Node.js). */
function waitlistSourceFromQuery(search) {
  var qs = typeof search === "string" ? search : "";
  var match = /[?&]src=([^&]+)/.exec(qs);
  if (!match) return "landing";
  var raw = decodeURIComponent(match[1]).trim().toLowerCase();
  var safe = raw.replace(/[^a-z0-9_-]/g, "");
  if (!safe) return "landing";
  return safe.slice(0, 64);
}

/* CommonJS export so Node test runner can require() this file directly. */
if (typeof module !== "undefined") {
  module.exports = { waitlistSourceFromQuery: waitlistSourceFromQuery };
}
