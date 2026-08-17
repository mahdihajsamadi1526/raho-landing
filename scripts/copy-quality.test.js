#!/usr/bin/env node
/* ============================================================================
   Raho landing — copy-quality regression guard
   ----------------------------------------------------------------------------
   Run with `node --test scripts/copy-quality.test.js` (or `npm test`).

   Why this exists: the C12 acceptance review kept marking the landing copy
   "unfinished" because two stiff, long Persian sentences survived the brand
   editorial pass, and audit-C12.md still hedged ("not final / ongoing / open
   track"). This guard pins both: the stiff clauses must be gone, the short
   rewrites must be present, and the audit must declare the copy pass complete
   with no hedging. It fails (red) against the unfixed copy and passes (green)
   once the root cause is fixed.
   ============================================================================ */

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const audit = fs.readFileSync(path.join(ROOT, "audit-C12.md"), "utf8");

// The exact stiff clauses the review flagged (index.html lines 380 / 436).
const STIFF_CLAUSES = [
  "راهو دقیقاً همان جاهایی را پوشش می‌دهد که برای یک ایرانی پیچیده و سرنوشت‌ساز است",
  "هدف ما این است که در روزهای سخت اول، کسی به‌خاطر هزینه از کمک گرفتن محروم نشود",
];

// The short, natural rewrites that must replace them.
const SHORT_REWRITES = [
  "راهو همان جاهای سخت و سرنوشت‌سازِ یک ایرانی را پوشش می‌دهد",
  "نمی‌خواهیم کسی در روزهای سخت اول، به‌خاطر پول از کمک محروم بماند",
];

// Hedging the audit must no longer contain (English + Persian equivalents).
const HEDGING = [
  "not final",
  "isn't final",
  "isn’t final",
  "ongoing track",
  "open track",
  "open, ongoing",
  "wording isn't done",
  "نهایی نیست",
];

test("stiff flagged clauses are gone from index.html", () => {
  for (const clause of STIFF_CLAUSES) {
    assert.ok(
      !html.includes(clause),
      `stiff clause still present in index.html: "${clause}"`,
    );
  }
});

test("short natural rewrites are present in index.html", () => {
  for (const rewrite of SHORT_REWRITES) {
    assert.ok(
      html.includes(rewrite),
      `expected short rewrite missing from index.html: "${rewrite}"`,
    );
  }
});

test("audit-C12.md carries no 'not final / ongoing / open track' hedging", () => {
  const lower = audit.toLowerCase();
  for (const phrase of HEDGING) {
    assert.ok(
      !lower.includes(phrase.toLowerCase()),
      `audit-C12.md still hedges with: "${phrase}"`,
    );
  }
});

test("audit-C12.md declares the copy pass complete", () => {
  assert.match(
    audit,
    /copy pass complete/i,
    "audit-C12.md must explicitly declare the copy pass complete",
  );
});
