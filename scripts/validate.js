#!/usr/bin/env node
/* ============================================================================
   Raho landing — build/integration validator
   ----------------------------------------------------------------------------
   Run with `npm run validate`. Asserts the landing page is internally
   consistent and "one value away from live":

     1. required files all exist
     2. legal links (privacy + impressum) are real, working https URLs
     3. every phone mockup is a swappable screen slot under assets/screenshots/
     4. external connections are present as graceful __PLACEHOLDER__ tokens

   Exits 0 when everything passes, 1 (with a report) on the first failure set.
   No dependencies — plain Node fs + string checks.
   ============================================================================ */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const errors = [];
const checks = [];

function pass(msg) {
  checks.push(msg);
}
function fail(msg) {
  errors.push(msg);
}
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}
function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

// ---------------------------------------------------------------------------
// 1. Required files
// ---------------------------------------------------------------------------
const REQUIRED_FILES = [
  "index.html",
  "styles.css",
  "main.js",
  "config.js",
  "vercel.json",
  "package.json",
  "assets/screenshots/README.md",
  "assets/brand/favicon.svg",
];
for (const f of REQUIRED_FILES) {
  if (exists(f)) pass(`required file present: ${f}`);
  else fail(`missing required file: ${f}`);
}

// ---------------------------------------------------------------------------
// 2. Working privacy + impressum links
// ---------------------------------------------------------------------------
const config = exists("config.js") ? read("config.js") : "";
const LEGAL = {
  privacyPolicy: /privacyPolicy:\s*"(https:\/\/[^"]+)"/,
  impressum: /impressum:\s*"(https:\/\/[^"]+)"/,
};
for (const [name, re] of Object.entries(LEGAL)) {
  const m = config.match(re);
  if (!m) {
    fail(`legal link ${name} is not a real https:// URL in config.js`);
    continue;
  }
  const url = m[1];
  if (url.includes("__") || url.includes("PLACEHOLDER")) {
    fail(`legal link ${name} is still a placeholder: ${url}`);
  } else {
    pass(`legal link ${name} wired to ${url}`);
  }
}

// ---------------------------------------------------------------------------
// 3. Phone mockups — CSS reconstructions render by default; real screenshots
//    are an optional drop-in that main.js layers on (never a broken <img>).
// ---------------------------------------------------------------------------
const html = exists("index.html") ? read("index.html") : "";
const REQUIRED_SLOTS = ["home", "journey", "notifications"];

// 3a. No forbidden absolute-path asset references may remain in index.html.
//     A leading-slash src/href breaks under Vercel clean-URL rewrites and was
//     the source of the broken phone frames.
const FORBIDDEN = [
  'src="/assets',
  'href="/assets',
  'href="/styles.css',
  'src="/config.js',
  'src="/main.js',
];
for (const pat of FORBIDDEN) {
  if (html.includes(pat)) fail(`forbidden absolute path in index.html: ${pat}`);
  else pass(`no forbidden absolute path: ${pat}`);
}

// 3b. Every required screen is wired as a .phone__screen[data-screen] slot whose
//     frame opens a CSS reconstruction (.appscreen) — so the frame is never
//     empty even before a real screenshot is provided.
const SCREEN_RE = /<div class="phone__screen" data-screen="([^"]+)">/g;
const foundNames = new Set();
let m;
while ((m = SCREEN_RE.exec(html)) !== null) {
  const name = m[1];
  // the reconstruction must be the first child rendered in the frame
  const after = html.slice(m.index + m[0].length, m.index + m[0].length + 600);
  if (!/class="appscreen"/.test(after)) {
    fail(`phone__screen[data-screen="${name}"] has no .appscreen reconstruction`);
    continue;
  }
  foundNames.add(name);
  pass(`reconstructed phone screen wired: ${name}`);
}
if (foundNames.size === 0) {
  fail("no phone__screen[data-screen] reconstruction slots found in index.html");
}

for (const want of REQUIRED_SLOTS) {
  if (foundNames.has(want)) pass(`required phone screen present: ${want}`);
  else fail(`required phone screen missing in index.html: ${want}`);
}

// 3c. Every required screen also has a STATIC swappable <img class="phone__shot">
//     slot in index.html whose single src path maps to a screenshot named in
//     NEEDS_YOU.md. The slot is hidden until the file loads (no broken <img>).
const SHOT_RE = /<img class="phone__shot" src="(assets\/screenshots\/([^".]+)\.png)"/g;
const shotPaths = new Set();
const shotNames = new Set();
let sm;
while ((sm = SHOT_RE.exec(html)) !== null) {
  shotPaths.add(sm[1]);
  shotNames.add(sm[2]);
}
if (shotNames.size === 0) {
  fail('no static <img class="phone__shot" src="assets/screenshots/…"> slots in index.html');
}
for (const want of REQUIRED_SLOTS) {
  if (shotNames.has(want)) pass(`static phone__shot slot present: assets/screenshots/${want}.png`);
  else fail(`missing static phone__shot slot for assets/screenshots/${want}.png in index.html`);
}

// 3d. main.js must drive those static slots (reveal only when the file loads).
const mainJs = exists("main.js") ? read("main.js") : "";
if (/phone__shot/.test(mainJs) && /is-loaded/.test(mainJs)) {
  pass("main.js reveals phone__shot slots on successful load");
} else {
  fail("main.js does not wire the phone__shot screenshot slots");
}

// 3e. each slot's path must be documented in NEEDS_YOU.md so a human knows
//     exactly which file to drop where.
const needs = exists("NEEDS_YOU.md") ? read("NEEDS_YOU.md") : "";
for (const p of shotPaths) {
  if (needs.includes(p)) pass(`NEEDS_YOU.md documents screenshot path: ${p}`);
  else fail(`NEEDS_YOU.md is missing screenshot path used in index.html: ${p}`);
}

// the drop-in directory + its instructions must exist
if (exists("assets/screenshots")) pass("assets/screenshots/ directory exists");
else fail("assets/screenshots/ directory does not exist");

// ---------------------------------------------------------------------------
// 4. External placeholders present (graceful "not connected yet" tokens)
// ---------------------------------------------------------------------------
const PLACEHOLDER_KEYS = [
  "appStoreUrl",
  "playStoreUrl",
  "siteUrl",
];
for (const key of PLACEHOLDER_KEYS) {
  const re = new RegExp(key + ':\\s*"(__[A-Z_]+__)"');
  if (re.test(config)) pass(`external placeholder present: ${key}`);
  else fail(`expected external __PLACEHOLDER__ token for ${key} in config.js`);
}

// waitlistEndpoint is expected to be wired to a real endpoint (the whole
// point of going live) — assert it's a real https:// URL, not a placeholder.
const WAITLIST_RE = /waitlistEndpoint:\s*"(https:\/\/[^"]+)"/;
const waitlistMatch = config.match(WAITLIST_RE);
if (!waitlistMatch) {
  fail("waitlistEndpoint is not a real https:// URL in config.js");
} else if (waitlistMatch[1].includes("__") || waitlistMatch[1].includes("PLACEHOLDER")) {
  fail(`waitlistEndpoint is still a placeholder: ${waitlistMatch[1]}`);
} else {
  pass(`waitlistEndpoint wired to ${waitlistMatch[1]}`);
}

// ---------------------------------------------------------------------------
// 5. No-JS robustness — content must NEVER be blank without JavaScript.
//    The reveal animation hides content (opacity:0) and only un-hides it via
//    script. That hiding MUST be gated behind a `.js` class that an inline,
//    self-contained bootstrap adds — otherwise a failed/blocked main.js (or
//    disabled JS) renders the whole page blank. This was the reported "broken"
//    (empty) page. These checks make that regression loud.
// ---------------------------------------------------------------------------
const css = exists("styles.css") ? read("styles.css") : "";

// 5a. The reveal-hide rule must be scoped under `.js` …
if (/\.js\s+\.reveal\s*\{[^}]*opacity:\s*0/.test(css)) {
  pass("reveal hide rule is gated behind `.js` (visible without JS)");
} else {
  fail("`.reveal` opacity:0 hide rule must be scoped under `.js` in styles.css");
}

// 5b. … and there must be NO ungated `.reveal { … opacity:0 }` that hides
//     content regardless of JS.
if (/(?<!\.js\s)\.reveal\s*\{[^}]*opacity:\s*0/.test(css)) {
  fail("found ungated `.reveal{opacity:0}` in styles.css — page is blank without JS");
} else {
  pass("no ungated `.reveal` hide rule (content shows without JS)");
}

// 5c. index.html must inline-add the `.js` class (self-contained, can't 404).
if (/classList\.add\(\s*["']js["']\s*\)/.test(html)) {
  pass("index.html inline bootstrap arms `.js` (reveal works without main.js)");
} else {
  fail("index.html must add the `js` class inline so reveal never blanks the page");
}

// ---------------------------------------------------------------------------
// 6. Asset reference integrity — enumerate EVERY local asset path referenced in
//    index.html and styles.css (src="…", href="…", and url(…)) and assert each
//    one exists on disk. Fails if any referenced asset is missing. This is what
//    guarantees no broken <img>/<link>/background ships.
//
//    The only documented exception: the progressive-enhancement screenshot
//    drop-in slots (assets/screenshots/{home,journey,notifications}.png). They
//    are intentionally absent until a human drops real screenshots in; they are
//    hidden by CSS, have a .appscreen CSS reconstruction underneath, and are
//    only revealed by main.js once the real file loads (never a broken <img>).
// ---------------------------------------------------------------------------
const OPTIONAL_DROPIN_RE = /^assets\/screenshots\/(home|journey|notifications)\.png$/;

function collectRefs(source, label) {
  const refs = [];
  // src="…" and href="…"
  const attrRe = /\b(?:src|href)\s*=\s*"([^"]+)"/g;
  let a;
  while ((a = attrRe.exec(source)) !== null) refs.push({ raw: a[1], label });
  // url(…) — handles optional single/double quotes
  const urlRe = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
  let u;
  while ((u = urlRe.exec(source)) !== null) refs.push({ raw: u[1], label });
  return refs;
}

// Only local, on-disk asset paths matter here. Skip external URLs, anchors,
// data: URIs, mailto:/tel:, and protocol-relative links.
function isLocalAsset(p) {
  if (!p) return false;
  if (/^(https?:|data:|mailto:|tel:|#|\/\/|javascript:)/i.test(p)) return false;
  return true;
}

const allRefs = [
  ...collectRefs(html, "index.html"),
  ...collectRefs(css, "styles.css"),
];
const checkedAssets = new Set();
let assetRefCount = 0;
for (const { raw, label } of allRefs) {
  if (!isLocalAsset(raw)) continue;
  // strip any query string / fragment
  const clean = raw.split("?")[0].split("#")[0].replace(/^\.\//, "");
  if (!clean) continue;
  // CSS url() paths are relative to styles.css which sits at the root, same as
  // index.html — so both resolve from ROOT.
  const key = `${label}::${clean}`;
  if (checkedAssets.has(key)) continue;
  checkedAssets.add(key);
  assetRefCount++;

  if (exists(clean)) {
    pass(`asset exists (${label}): ${clean}`);
  } else if (OPTIONAL_DROPIN_RE.test(clean)) {
    // documented optional drop-in — must be documented in NEEDS_YOU.md
    if (needs.includes(clean)) {
      pass(`optional drop-in absent but documented (${label}): ${clean}`);
    } else {
      fail(`optional drop-in ${clean} is absent AND undocumented in NEEDS_YOU.md`);
    }
  } else {
    fail(`missing asset referenced in ${label}: ${clean}`);
  }
}
if (assetRefCount === 0) {
  fail("no local asset references found to verify in index.html/styles.css");
} else {
  pass(`enumerated ${assetRefCount} local asset reference(s) across index.html + styles.css`);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log(`\nRaho landing validation — ${checks.length} checks passed`);
if (errors.length) {
  console.error(`\n${errors.length} FAILED:`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("All landing-page invariants hold. ✓\n");
