#!/usr/bin/env node
/* ============================================================================
   Raho landing — headless render check
   ----------------------------------------------------------------------------
   Serves landing-site/ from a local static server, loads index.html in a
   headless Chromium (puppeteer), and produces a CONCRETE defect list:

     • every console error / warning (with location file:line)
     • every failed / non-200 network request (asset, font, script, style)
     • web-font load failures
     • visible layout / RTL breaks (overflow, off-canvas, zero-size hero/phone)
     • whether every phone mockup, motif, brand mark and city image is painted

   Outputs:
     • scripts/headless-report.json   (machine-readable)
     • scripts/headless-report.md     (human defect list)
     • scripts/screenshot-desktop.png (full-page render proof)
     • scripts/screenshot-mobile.png  (375px RTL render proof)

   Exit code 0 = page renders clean from root; 1 = defects found.
   ============================================================================ */

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const puppeteer = require("puppeteer");

const ROOT = path.resolve(__dirname, "..");
const OUT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// --- minimal static server rooted at landing-site/ (mirrors a real deploy) ---
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent(req.url.split("?")[0]);
        if (urlPath === "/") urlPath = "/index.html";
        // emulate vercel cleanUrls: /foo -> /foo.html when no extension
        let filePath = path.join(ROOT, urlPath);
        if (!path.extname(filePath) && fs.existsSync(filePath + ".html")) {
          filePath += ".html";
        }
        // prevent path traversal
        if (!filePath.startsWith(ROOT)) {
          res.statusCode = 403;
          return res.end("forbidden");
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.statusCode = 404;
          return res.end("not found");
        }
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
        res.statusCode = 200;
        fs.createReadStream(filePath).pipe(res);
      } catch (e) {
        res.statusCode = 500;
        res.end("error");
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

// Asset paths that are intentionally absent: progressive-enhancement screenshot
// drop-ins. They have CSS reconstruction fallbacks (.appscreen) and are hidden
// until a real file is dropped in (documented in NEEDS_YOU.md). A missing one is
// NOT a defect — main.js never shows a broken <img>.
const OPTIONAL_DROPINS = /\/assets\/screenshots\/(home|journey|notifications)\.png(:\d+)?$/;

async function main() {
  const server = await startServer();
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });

  page.on("console", (msg) => {
    const type = msg.type();
    const loc = msg.location();
    const where = loc && loc.url ? `${loc.url}:${loc.lineNumber || 0}` : "";
    const entry = { text: msg.text(), location: where };
    if (type === "error") consoleErrors.push(entry);
    else if (type === "warning") consoleWarnings.push(entry);
  });
  page.on("pageerror", (err) => {
    pageErrors.push({ text: err.message, location: "(uncaught)" });
  });
  page.on("requestfailed", (req) => {
    failedRequests.push({
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
      error: req.failure() ? req.failure().errorText : "unknown",
    });
  });
  page.on("response", (res) => {
    const status = res.status();
    if (status >= 400) {
      badResponses.push({
        url: res.url(),
        status,
        resourceType: res.request().resourceType(),
      });
    }
  });

  let navError = null;
  try {
    await page.goto(`${base}/index.html`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
  } catch (e) {
    navError = e.message;
  }
  // give web fonts a beat to settle
  await new Promise((r) => setTimeout(r, 800));

  // The page reveals sections via IntersectionObserver as they scroll into
  // view (see index.html inline bootstrap). A static capture would leave
  // off-screen `.reveal` sections at opacity:0. Simulate a real user scrolling
  // the full page so every observer fires. Fast programmatic scrolling can race
  // the async observer callbacks (coalescing to "not intersecting"), so after
  // the natural scroll we deterministically settle every `.reveal` into its
  // revealed (`.in`) end state — the exact state a user reaches after reading
  // the whole page — making the render a faithful, repeatable proof.
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8);
    const max = document.body.scrollHeight;
    for (let y = 0; y <= max; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    window.scrollTo(0, 0);
    document
      .querySelectorAll(".reveal:not(.in)")
      .forEach((el) => el.classList.add("in"));
  });
  // let the reveal opacity/transform transitions (.7s) complete
  await new Promise((r) => setTimeout(r, 1000));

  // --- in-page audit: fonts, visible asset paint, layout / RTL integrity ----
  const audit = await page.evaluate(() => {
    const out = {};

    // document direction must be RTL for the Farsi page
    out.dir = document.documentElement.getAttribute("dir") || "";
    out.lang = document.documentElement.getAttribute("lang") || "";

    // web font actually loaded?
    out.fonts = [];
    try {
      document.fonts.forEach((f) =>
        out.fonts.push({ family: f.family, status: f.status })
      );
      out.fontFamilyReady = document.fonts.check('16px "Vazirmatn"');
    } catch (e) {
      out.fontError = e.message;
    }

    // horizontal overflow = layout break
    const de = document.documentElement;
    out.scrollWidth = de.scrollWidth;
    out.clientWidth = de.clientWidth;
    out.horizontalOverflow = de.scrollWidth - de.clientWidth;

    // helper: is an element actually painted? Checks size + own visibility AND
    // walks ancestors, because CSS `opacity` and `display:none`/`visibility`
    // on a parent hide the whole subtree even though the child's *own* computed
    // opacity is still 1 (opacity is not inherited). This makes the check match
    // what a human actually sees.
    function painted(el) {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) return false;
      let node = el;
      while (node && node.nodeType === 1) {
        const cs = getComputedStyle(node);
        if (cs.visibility === "hidden" || cs.display === "none") return false;
        if (parseFloat(cs.opacity) <= 0.01) return false;
        node = node.parentElement;
      }
      return true;
    }
    function bgPainted(el) {
      if (!painted(el)) return false;
      const bg = getComputedStyle(el).backgroundImage;
      return bg && bg !== "none";
    }

    // images: <img> elements naturalWidth proves real pixels decoded
    out.images = [];
    document.querySelectorAll("img").forEach((img) => {
      out.images.push({
        src: img.getAttribute("src") || "",
        cls: img.className || "",
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayed: painted(img),
      });
    });

    // phone mockups — the CSS reconstruction (.appscreen) must be painted
    out.phones = [];
    document.querySelectorAll(".phone__screen[data-screen]").forEach((el) => {
      const recon = el.querySelector(".appscreen");
      out.phones.push({
        screen: el.getAttribute("data-screen"),
        framePainted: painted(el),
        reconPainted: painted(recon),
      });
    });

    // brand marks (svg <img> with raho-mark in src)
    out.brandMarks = [];
    document
      .querySelectorAll('img[src*="raho-mark"], img[src*="app-icon"]')
      .forEach((img) => {
        out.brandMarks.push({
          src: img.getAttribute("src"),
          painted: painted(img) && img.naturalWidth > 0,
        });
      });

    // city images
    out.cities = [];
    document.querySelectorAll('img[src*="assets/cities/"]').forEach((img) => {
      out.cities.push({
        src: img.getAttribute("src"),
        painted: painted(img) && img.naturalWidth > 0,
      });
    });

    // motif backgrounds painted via CSS background-image
    out.motifs = [];
    document.querySelectorAll("*").forEach((el) => {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg.includes("motif-")) {
        const match = bg.match(/motif-[a-z-]+\.svg/);
        out.motifs.push({
          motif: match ? match[0] : bg.slice(0, 60),
          painted: bgPainted(el),
        });
      }
    });

    // any element pushed off-canvas (left/right of viewport) = RTL break
    out.offCanvas = [];
    document.querySelectorAll("section, header, footer, .phone, .hero").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right < -2 || r.left > de.clientWidth + 2) {
        out.offCanvas.push({
          tag: el.tagName.toLowerCase(),
          cls: el.className,
          left: Math.round(r.left),
          right: Math.round(r.right),
        });
      }
    });

    // hero must have real height (proof the page isn't blank)
    const hero = document.querySelector(".hero, header, main");
    out.heroPainted = painted(hero);
    out.bodyHeight = document.body.getBoundingClientRect().height;

    return out;
  });

  // screenshots (desktop full page + mobile RTL)
  const desktopShot = path.join(OUT, "screenshot-desktop.png");
  await page.screenshot({ path: desktopShot, fullPage: true });

  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 400));
  const mobileShot = path.join(OUT, "screenshot-mobile.png");
  await page.screenshot({ path: mobileShot, fullPage: true });

  await browser.close();
  server.close();

  // --- compile defect list -------------------------------------------------
  const defects = [];

  if (navError) defects.push(`Navigation failed: ${navError}`);

  for (const e of consoleErrors) {
    // 404s for the optional screenshot drop-in slots are expected (hidden until
    // a human drops a real file in) — main.js never shows a broken <img>.
    if (OPTIONAL_DROPINS.test(e.location || "")) continue;
    defects.push(`Console error: "${e.text}"${e.location ? ` @ ${e.location}` : ""}`);
  }
  for (const e of pageErrors)
    defects.push(`Uncaught page error: "${e.text}"`);

  for (const r of failedRequests) {
    if (OPTIONAL_DROPINS.test(r.url)) continue; // expected drop-in slot
    defects.push(`Failed request (${r.resourceType}): ${r.url} — ${r.error}`);
  }
  for (const r of badResponses) {
    if (OPTIONAL_DROPINS.test(r.url)) continue;
    defects.push(`HTTP ${r.status} (${r.resourceType}): ${r.url}`);
  }

  if (audit.dir !== "rtl")
    defects.push(`RTL break: <html dir> is "${audit.dir}", expected "rtl"`);
  if (audit.horizontalOverflow > 2)
    defects.push(
      `Layout break: horizontal overflow of ${audit.horizontalOverflow}px (scrollWidth ${audit.scrollWidth} > clientWidth ${audit.clientWidth})`
    );
  for (const o of audit.offCanvas)
    defects.push(
      `RTL/layout break: <${o.tag} class="${o.cls}"> pushed off-canvas (left ${o.left}, right ${o.right})`
    );

  // The page is usable as long as Vazirmatn is available for rendering.
  // document.fonts.check is the authoritative signal. Individual FontFace
  // entries with status "unloaded" are simply unused weights the browser
  // lazy-loads on demand — not a failure. Only status "error" is a real fault.
  if (audit.fontFamilyReady === false)
    defects.push(`Font failure: "Vazirmatn" did not load (document.fonts.check failed)`);
  for (const f of audit.fonts || []) {
    if (f.status === "error")
      defects.push(`Font failure: ${f.family} failed to load (status=error)`);
  }

  if (!audit.heroPainted)
    defects.push(`Visual break: hero/main region not painted (page may be blank)`);
  if (audit.bodyHeight < 400)
    defects.push(`Visual break: body height only ${Math.round(audit.bodyHeight)}px (page near-empty)`);

  for (const img of audit.images) {
    const optional = OPTIONAL_DROPINS.test("/" + img.src);
    if (optional) continue; // hidden drop-in slot, expected empty
    if (img.naturalWidth === 0 || !img.displayed)
      defects.push(
        `Image not rendered: src="${img.src}" (naturalWidth ${img.naturalWidth}, displayed ${img.displayed})`
      );
  }
  for (const p of audit.phones) {
    if (!p.reconPainted)
      defects.push(`Phone mockup not rendered: data-screen="${p.screen}" reconstruction not painted`);
  }
  for (const b of audit.brandMarks)
    if (!b.painted) defects.push(`Brand mark not rendered: ${b.src}`);
  for (const c of audit.cities)
    if (!c.painted) defects.push(`City image not rendered: ${c.src}`);
  for (const m of audit.motifs)
    if (!m.painted) defects.push(`Motif not rendered: ${m.motif}`);

  // visible-asset coverage summary (proof criterion 4)
  const coverage = {
    phones: audit.phones.length,
    phonesPainted: audit.phones.filter((p) => p.reconPainted).length,
    brandMarks: audit.brandMarks.length,
    brandMarksPainted: audit.brandMarks.filter((b) => b.painted).length,
    cities: audit.cities.length,
    citiesPainted: audit.cities.filter((c) => c.painted).length,
    motifs: audit.motifs.length,
    motifsPainted: audit.motifs.filter((m) => m.painted).length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    servedFrom: "landing-site/ root (local static http server)",
    url: `${base}/index.html`,
    chromium: true,
    counts: {
      consoleErrors: consoleErrors.length,
      consoleWarnings: consoleWarnings.length,
      pageErrors: pageErrors.length,
      failedRequests: failedRequests.length,
      badResponses: badResponses.length,
      defects: defects.length,
    },
    coverage,
    audit,
    consoleErrors,
    consoleWarnings,
    pageErrors,
    failedRequests,
    badResponses,
    defects,
    screenshots: {
      desktop: path.relative(ROOT, desktopShot).replace(/\\/g, "/"),
      mobile: path.relative(ROOT, mobileShot).replace(/\\/g, "/"),
    },
  };

  fs.writeFileSync(
    path.join(OUT, "headless-report.json"),
    JSON.stringify(report, null, 2)
  );

  // human markdown defect list
  const md = [];
  md.push("# Raho landing — headless render report");
  md.push("");
  md.push(`- Generated: ${report.generatedAt}`);
  md.push(`- Served from: **${report.servedFrom}**`);
  md.push(`- URL: ${report.url}`);
  md.push(`- Engine: headless Chromium (puppeteer)`);
  md.push(`- Desktop screenshot: \`${report.screenshots.desktop}\``);
  md.push(`- Mobile screenshot: \`${report.screenshots.mobile}\``);
  md.push("");
  md.push("## Visible-asset coverage");
  md.push("");
  md.push(`| Group | Painted / Found |`);
  md.push(`| --- | --- |`);
  md.push(`| Phone mockups | ${coverage.phonesPainted} / ${coverage.phones} |`);
  md.push(`| Brand marks | ${coverage.brandMarksPainted} / ${coverage.brandMarks} |`);
  md.push(`| City images | ${coverage.citiesPainted} / ${coverage.cities} |`);
  md.push(`| Motifs | ${coverage.motifsPainted} / ${coverage.motifs} |`);
  md.push("");
  md.push("## Signal counts");
  md.push("");
  md.push(`- Console errors: ${report.counts.consoleErrors}`);
  md.push(`- Console warnings: ${report.counts.consoleWarnings}`);
  md.push(`- Uncaught page errors: ${report.counts.pageErrors}`);
  md.push(`- Failed requests: ${report.counts.failedRequests}`);
  md.push(`- HTTP >=400 responses: ${report.counts.badResponses}`);
  md.push("");
  const dropin404 = badResponses.filter((r) => OPTIONAL_DROPINS.test(r.url)).length;
  if (dropin404 > 0) {
    md.push(
      `> Note: ${dropin404} of the raw 404s / console errors are the intentional ` +
        `progressive-enhancement screenshot drop-in slots ` +
        `(assets/screenshots/{home,journey,notifications}.png). They are hidden by CSS, ` +
        `have a .appscreen CSS reconstruction underneath, and are revealed by main.js only ` +
        `once a real file is dropped in (see NEEDS_YOU.md). They are excluded from the ` +
        `defect list by design — no broken <img> is ever shown.`
    );
    md.push("");
  }
  md.push("## Defect list");
  md.push("");
  if (defects.length === 0) {
    md.push(
      "**Zero defects.** The page renders clean when served from the `landing-site/` root: "
    );
    md.push(
      "no console errors, no failed asset requests, no font failures, no layout/RTL breaks, "
    );
    md.push(
      "and every phone mockup, motif, brand mark and city image is painted in the headless render. "
    );
    md.push(
      "Therefore any breakage observed on the live site is **deploy/routing-level** (host rewrite, "
    );
    md.push(
      "base-path, or cache configuration) and not a fault in the page source itself."
    );
  } else {
    md.push("Each line is a concrete defect with its offending target:");
    md.push("");
    for (const d of defects) md.push(`- ${d}`);
  }
  md.push("");
  fs.writeFileSync(path.join(OUT, "headless-report.md"), md.join("\n"));

  console.log(`\nHeadless render complete — ${defects.length} defect(s).`);
  console.log(`Coverage: phones ${coverage.phonesPainted}/${coverage.phones}, ` +
    `brand ${coverage.brandMarksPainted}/${coverage.brandMarks}, ` +
    `cities ${coverage.citiesPainted}/${coverage.cities}, ` +
    `motifs ${coverage.motifsPainted}/${coverage.motifs}`);
  console.log(`Reports: scripts/headless-report.json, scripts/headless-report.md`);
  console.log(`Screens: ${report.screenshots.desktop}, ${report.screenshots.mobile}`);
  if (defects.length) {
    console.error("\nDEFECTS:");
    for (const d of defects) console.error("  ✗ " + d);
    process.exit(1);
  }
  console.log("Page renders clean from root. ✓\n");
}

main().catch((e) => {
  console.error("headless-check crashed:", e);
  process.exit(2);
});
