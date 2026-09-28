# WV Roofing — concept site (separate project)

WV Roofing is a **stand-alone concept** for a roof-replacement business covering the Wirral and
Liverpool. It is parked on this host only so the owner can test functionality, usability and design
before buying its own domain and address. **It is not part of SC Design Wirral**: nothing on the SC
site links to it, it is not listed in `robots.txt`, the sitemap or `llms.txt`, it sends no SC
analytics or error beacons, and its emails are sent as "WV Roofing".

- Live (hidden, noindex): `https://scdesignwirral.co.uk/WVROOFING/`
- Everything WV Roofing lives in: `public/WVROOFING/`, `api/wvroofing/app.js` (the one function),
  `serverlib/wvroofing/`, `db/wvroofing/`, `scripts/wvroofing/`, `docs/wvroofing/`, this file. The only
  shared-file touches are the `/WVROOFING` blocks in `public/_headers` (X-Robots-Tag), the WV entries
  in `vercel.json` (function, rewrite `/api/wvroofing/:path*`, daily cron, X-Robots-Tag) and, in
  `package.json`, five packages (`pg`, `@vercel/blob`, `@vercel/functions`; dev: `@electric-sql/pglite`,
  `@types/pg`) plus the `wvr:*` scripts.
- **Never add another file under `api/wvroofing/`.** The project allows 12 functions per deployment on
  Hobby and `api/` holds 11; new endpoints are routes in `serverlib/wvroofing/router.js`
  (`npm run wvr:test` asserts the count).
- v02 build (postcode-first journey, stored enquiries, operator screen): see `docs/wvroofing/`.
- To move it to its own domain later: copy those folders to a new repo, serve `public/` at the root
  (update `ROOT` in `assets/js/config.js` and the absolute `/WVROOFING/` links), deploy the function
  with its rewrite and cron, and set the env vars in `docs/wvroofing/wvroofing.env.example`.

## Pages

| Path | What |
|---|---|
| `/WVROOFING/` | Home: hero before/after, "eight roofs, one house" colour picker, how it works, services, process gallery, areas, FAQ |
| `/WVROOFING/roof-replacement/` | Product-page layout with a sticky local nav: signs, what's included, "which roof is right for you" compare gallery, other work, regulations, quote form |
| `/WVROOFING/visualiser/` | The Roof Visualiser app |
| `/WVROOFING/privacy/` | Privacy notice (concept draft) |

## Design

Apple's design language (September 2026 redesign): San Francisco via the system font stack on
Apple devices and Inter (optical sizing, Google Fonts) elsewhere; white / `#f5f5f7` / black bands;
pill buttons in one action blue; 28px tiles separated by tone; translucent global nav plus a
sticky local nav on product pages; a grey concept ribbon and Apple-style footnotes. WV identity
stays in the navy squircle monogram and the gold eyebrow text. All colours are tokens at the top
of `assets/css/site.css` (dark mode included); swap `--blue` for navy there to go more on-brand.
The home picker and heroes are drawn live by `assets/js/vis/hero.js` from the sample houses.

## How the roof images are made

1. **Mark the roof** in the browser (outline / cut-out / brush tools; sample houses come pre-marked).
2. **Quick previews** (`assets/js/vis/preview.js`): the roof is re-coloured and re-patterned in the
   browser for all 8 products, keeping the photo's own shading. Instant, free, approximate.
3. **Photo-real renders** (optional, with the visitor's consent): the photo + a PNG roof mask go to
   `POST /api/wvroofing/render`, which calls OpenAI `v1/images/edits` with a **fixed server-side
   prompt per product** (`serverlib/wvroofing/core.js` `buildPrompt`, fields in `data/catalogue.json`).
4. **Compositing** (`assets/js/vis/composite.js`): OpenAI treats masks as guidance and regenerates
   the whole picture, so the browser pastes back only the roof pixels through a feathered mask,
   after a small alignment search and exposure match. Everything outside the roof stays the
   original photo.

The 8 products, their colours, swatch patterns and prompt wording all live in
`public/WVROOFING/data/catalogue.json` — edit that one file to change the range.

## Environment variables (Vercel project that runs `api/*`)

Set these in the Vercel dashboard (never in the repo), then redeploy. The complete list, including the
v02 storage and capability variables, is `docs/wvroofing/wvroofing.env.example`.

**A key alone never switches a feature on.** Each capability needs its credential, its rights resolved
in `serverlib/wvroofing/permissions.js`, and its owner switch: live photo-real renders need
`WVR_CAP_IMAGE_GENERATION=on` as well as the key. `GET /api/wvroofing/health` shows every capability's
state and the reason.

| Variable | Needed for | Default |
|---|---|---|
| `WVR_OPENAI_API_KEY` | photo-real renders (use a dedicated OpenAI project with a hard budget); also needs `WVR_CAP_IMAGE_GENERATION=on` | unset = previews only |
| `WVR_LEAD_TO` | where quote requests are emailed (comma-separated) | unset = "not collecting yet" |
| `WVR_IMAGE_MODEL` | image model | `gpt-image-2` |
| `WVR_IMAGE_QUALITY` | `low` / `medium` / `high` | `medium` |
| `WVR_ENABLED` | `0` switches renders off | on |
| `WVR_AUTO_RENDER` | how many of the 8 render automatically | 8 |
| `WVR_MAX_CONCURRENT` | in-flight renders per server instance | 2 |
| `WVR_UPSTREAM_IPM` | images per minute sent to OpenAI (Tier 1 = 5) | 5 |
| `WVR_IP_LIMIT` / `WVR_IP_DAILY` | renders per visitor per 15 min / per day | 12 / 40 |
| `WVR_DAILY_CAP` | renders per server instance per day | 200 |
| `WVR_MAIL_FROM` | From header for quote emails | `"WV Roofing (concept)" <mail@tailoredquote.co.uk>` |
| `WVR_EXTRA_ORIGINS` | extra allowed browser origins (comma-separated) | — |

Quote emails reuse the project's existing `SMTP_USER` / `SMTP_PASS` (iCloud SMTP).
The instant kill switch for spend is disabling the key in the OpenAI dashboard; the site then falls
back to quick previews automatically.

## Local development and tests

```
node scripts/wvroofing/dev-server.mjs            # http://localhost:8772/WVROOFING/ (labelled test environment)
npm run wvr:test                                 # node:test suites: router, capabilities, database, limits, deploy shape
npm run wvr:check                                # JSDoc type check of serverlib/wvroofing (strict)
node scripts/wvroofing/selftest.mjs              # maths, compositing guarantee, validators, handlers
node scripts/wvroofing/qa.mjs                    # headless browser pass over every page + the visualiser
node scripts/wvroofing/prepare-samples.mjs <dir> # rebuild the sample photos from the originals
```

The dev server runs as the **test environment** (`WVR_ENV=test`): PGlite instead of Neon, a local
folder instead of Vercel Blob, fixture adapters; production never uses these. With no key set it
returns stand-in "mock" renders so the whole pipeline can be tested. `--simulate 429|503` exercises
the back-off and banners.

**Pre-rendering the sample houses** (after the key is live, costs about 7p a render): run the dev
server with `--proxy-live`, open `/WVROOFING/visualiser/?sample=<id>&save=1`, create the photo-real
renders; each raw render and a `meta.json` are written to `samples/renders/<id>/`. Then set
`"prerendered": true` for that sample in `samples/samples.json` and commit.
