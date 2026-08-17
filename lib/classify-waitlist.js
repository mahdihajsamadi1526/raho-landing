/* classifyWaitlistResponse — maps a fetch Response to a string outcome.
   Used by main.js (browser) and classify-waitlist.test.js (Node.js). */
function classifyWaitlistResponse(response) {
  if (response.status === 409) return "duplicate";
  if (response.ok) return "success";
  return "error";
}

/* CommonJS export so Node test runner can require() this file directly. */
if (typeof module !== "undefined") {
  module.exports = { classifyWaitlistResponse: classifyWaitlistResponse };
}
