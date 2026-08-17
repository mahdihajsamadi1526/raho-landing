/* ============================================================================
   Raho landing — interactions + config wiring
   Reads window.RAHO_CONFIG (config.js). Anything still set to a
   "__PLACEHOLDER__" string is treated as not-yet-connected and degrades
   gracefully instead of producing a broken link.
   ============================================================================ */
(function () {
  "use strict";
  var CFG = window.RAHO_CONFIG || {};

  // A value counts as "live" only if it's a non-empty string with no __PLACEHOLDER__ markers.
  function isLive(v) {
    return typeof v === "string" && v.length > 0 && v.indexOf("__") === -1;
  }

  /* ---- Footer + dynamic year -------------------------------------------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Store badges ------------------------------------------------------ */
  // If a store URL is live, link out; otherwise keep the badge but route it to
  // the waitlist and mark it visually disabled.
  function wireStore(selector, url) {
    var el = document.querySelector(selector);
    if (!el) return;
    if (isLive(url)) {
      el.setAttribute("href", url);
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener");
    } else {
      el.classList.add("is-disabled");
      el.setAttribute("href", "#download");
      el.setAttribute("title", "به‌زودی — به لیست انتظار بپیوندید");
    }
  }
  wireStore('.store-badge[data-store="apple"]', CFG.appStoreUrl);
  wireStore('.store-badge[data-store="google"]', CFG.playStoreUrl);

  // Hero note reflects whether the app is actually downloadable yet.
  var heroNote = document.getElementById("heroNote");
  if (heroNote) {
    heroNote.textContent = (isLive(CFG.appStoreUrl) || isLive(CFG.playStoreUrl))
      ? "دانلودش رایگان است."
      : "هنوز در حال آماده‌سازی است — ایمیل‌تان را بگذارید تا خبرتان کنیم.";
  }

  /* ---- Links (privacy / impressum / social) ----------------------------- */
  var links = CFG.links || {};
  function wireLink(id, url, hideIfDead) {
    var el = document.getElementById(id);
    if (!el) return;
    if (isLive(url)) {
      el.setAttribute("href", url);
    } else if (hideIfDead) {
      el.style.display = "none";
    } else {
      el.setAttribute("href", "#");
      el.setAttribute("aria-disabled", "true");
    }
  }
  wireLink("linkPrivacy", links.privacyPolicy);
  wireLink("linkImpressum", links.impressum);
  wireLink("faqPrivacy", links.privacyPolicy);
  wireLink("gdprPrivacy", links.privacyPolicy);
  wireLink("footInstagram", links.instagram, true);
  wireLink("footTelegram", links.telegram, true);
  var emailEl = document.getElementById("footEmail");
  if (emailEl) {
    if (isLive(links.email)) emailEl.setAttribute("href", "mailto:" + links.email);
    else emailEl.style.display = "none";
  }

  /* ---- og:url / canonical ----------------------------------------------- */
  if (isLive(CFG.siteUrl)) {
    var og = document.createElement("meta");
    og.setAttribute("property", "og:url");
    og.setAttribute("content", CFG.siteUrl);
    document.head.appendChild(og);
  }

  /* ---- Analytics (Plausible, privacy-first) ----------------------------- */
  var an = CFG.analytics || {};
  if (an.provider === "plausible" && isLive(an.domain) && isLive(an.scriptSrc)) {
    var s = document.createElement("script");
    s.defer = true;
    s.setAttribute("data-domain", an.domain);
    s.src = an.scriptSrc;
    document.head.appendChild(s);
  }

  /* ---- Mobile nav toggle ------------------------------------------------- */
  var toggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");
  if (toggle && navLinks) {
    toggle.addEventListener("click", function () {
      var open = navLinks.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    navLinks.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        navLinks.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---- Nav shadow on scroll --------------------------------------------- */
  var nav = document.getElementById("nav");
  if (nav) {
    var onScroll = function () { nav.classList.toggle("scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- FAQ accordion ----------------------------------------------------- */
  document.querySelectorAll(".faq-item").forEach(function (item) {
    var q = item.querySelector(".faq-q");
    var a = item.querySelector(".faq-a");
    if (!q || !a) return;
    q.addEventListener("click", function () {
      var isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach(function (o) {
        o.classList.remove("open");
        o.querySelector(".faq-a").style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add("open");
        a.style.maxHeight = a.scrollHeight + "px";
      }
    });
  });

  /* ---- Reveal on scroll --------------------------------------------------
     Handled by the self-contained inline bootstrap in <head> (index.html) so
     that page content is never blank if this external file fails to load. */

  /* ---- Real screenshot slots (progressive enhancement) ------------------
     Each phone mockup ships a static <img class="phone__shot"> slot in
     index.html pointing at assets/screenshots/<name>.png (see NEEDS_YOU.md).
     The slot is hidden by CSS; we reveal it only once the file genuinely
     loads. A missing file fires onerror and stays hidden, so the CSS
     reconstruction underneath remains and no broken <img> is ever shown. */
  document.querySelectorAll(".phone__shot").forEach(function (shot) {
    function reveal() { shot.classList.add("is-loaded"); }
    function hide() { shot.classList.remove("is-loaded"); }
    if (shot.complete) {
      if (shot.naturalWidth > 0) reveal();
      else hide();
    } else {
      shot.addEventListener("load", reveal);
      shot.addEventListener("error", hide);
    }
  });

  /* ---- Waitlist form ----------------------------------------------------- */
  var form = document.getElementById("waitlistForm");
  var input = document.getElementById("waitlistEmail");
  var msg = document.getElementById("waitlistMsg");
  function say(text, ok) {
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = ok === false ? "#FFE2D6" : "rgba(255,255,255,.95)";
  }
  if (form && input) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = (input.value || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        say("لطفاً یک ایمیل معتبر وارد کنید.", false);
        return;
      }
      var endpoint = CFG.waitlistEndpoint;
      if (!isLive(endpoint)) {
        // Not connected yet — acknowledge gracefully so the page is never "broken".
        say("ممنون! ثبت‌نام لیست انتظار به‌زودی فعال می‌شود.", true);
        input.value = "";
        return;
      }
      var btn = form.querySelector("button");
      if (btn) btn.disabled = true;
      say("در حال ثبت…", true);
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ email: email, source: waitlistSourceFromQuery(location.search) })
      })
        .then(function (r) {
          var outcome = classifyWaitlistResponse(r);
          if (outcome === "duplicate") {
            say("این ایمیل قبلاً ثبت شده — لحظه‌ی انتشار خبرتان می‌کنیم.", true);
            input.value = "";
            return;
          }
          if (outcome === "error") throw new Error("bad status");
          say("ثبت شد! لحظه‌ی انتشار خبرتان می‌کنیم.", true);
          input.value = "";
        })
        .catch(function () {
          say("مشکلی پیش آمد. کمی بعد دوباره تلاش کنید.", false);
        })
        .finally(function () { if (btn) btn.disabled = false; });
    });
  }
})();
