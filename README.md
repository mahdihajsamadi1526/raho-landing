# Raho landing site

Static marketing landing page for the Raho app (راهو). Persian-primary, RTL.
Sibling to `privacy-site/` — same "plain static files on Vercel" pattern, its
own Vercel project. No build step, no framework.

```
landing-site/
  index.html        — the page
  styles.css        — all styling (brand tokens mirrored from social-design/tokens.css)
  main.js           — interactions + reads config.js
  config.js         — ⭐ the ONLY file with external values to fill in
  vercel.json       — clean URLs + asset caching
  assets/
    brand/          — logo marks, wordmarks, favicon, app icon (copied from brand/assets)
    cities/         — city photos (copied from mobile/assets/cities)
    screenshots/    — drop real app screenshots here (see its README)
```

## Local preview

```bash
cd landing-site
python -m http.server 8080    # then open http://localhost:8080
# or:  npx serve .
```

## Deploy (Vercel)

Same flow as `privacy-site/`. From inside `landing-site/`:

```bash
vercel          # first run: links/creates a NEW project (don't reuse privacy-site)
vercel --prod   # promote to production
```

This creates a local `.vercel/` (gitignored, like privacy-site's).

## Going live — fill in `config.js`

The page is built to run with placeholders (store buttons fall back to the
waitlist, analytics stays off, legal links are inert). To make it fully live,
edit **`config.js`** and replace each `__PLACEHOLDER__`:

| Key | What to paste |
|-----|----------------|
| `appStoreUrl` / `playStoreUrl` | Store listing URLs (once published) |
| `waitlistEndpoint` | A POST endpoint accepting `{ email }` (Formspree, Buttondown, Supabase fn…) |
| `analytics.domain` | Domain registered in Plausible (or set `provider: "none"`) |
| `links.instagram`, `links.telegram`, `links.email` | Social/contact (placeholders hide the icon until set) |
| `siteUrl` | This landing's canonical domain (for og:url) |

Legal links (`links.privacyPolicy`, `links.impressum`) are already wired to the
live `getraho.app/privacy` and `/impressum` — no action needed.

See [`NEEDS_YOU.md`](./NEEDS_YOU.md) for the full go-live checklist.

## Real screenshots

The phones render polished CSS reconstructions out of the box. Each mockup has a
static `<img class="phone__shot">` slot. See `assets/screenshots/README.md`: drop
`home.png`, `journey.png`, `notifications.png` there and `main.js` reveals each
slot once it loads, layering it over the matching reconstruction. No code change,
and a missing file never breaks the frame.

## Validation

```bash
cd landing-site
npm run validate   # asserts required files, legal links, screen slots, placeholders
```
