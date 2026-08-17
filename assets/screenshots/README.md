# App screenshots — drop-in slots

The landing page showcases the app with polished **CSS-reconstructed** phone
screens that always render. Each phone mockup in `index.html` ships a static,
swappable `<img class="phone__shot" src="assets/screenshots/<name>.png">` slot
that sits on top of the reconstruction. The slot is hidden by CSS; `main.js`
reveals it **only once the file genuinely loads**. If the file is missing, the
slot stays hidden — no broken `<img>` ever appears, the reconstruction just
stays. So you "drop one image file" — nothing else.

## Drop these files here (exact names)

| File | Screen to capture |
|------|-------------------|
| `home.png`          | Home / roadmap tab (used in the hero + showcase row 1) |
| `journey.png`       | A city/journey detail screen (showcase row 2) |
| `notifications.png` | Notifications tab (showcase row 3) |

Optional extras you can add later — add a matching
`<img class="phone__shot" src="assets/screenshots/<name>.png">` slot to a
`.phone__screen` in `index.html` and drop `<name>.png` here: `onboarding.png`,
`profile.png`, `questions.png`.

## Capture specs

- **Portrait**, phone aspect ratio ~**9:19.5** (e.g. 1170×2532 from an iPhone,
  or 1080×2340 from Android). The frame uses `object-fit: cover`, so exact size
  isn't critical, but keep it portrait.
- Export as **PNG** (the slot `src` in `index.html` points at `.png`). Keep each
  file under ~400 KB for fast loads.
- Use the Persian (RTL) UI so it matches the page language.

That's it — commit the file, redeploy, done.
