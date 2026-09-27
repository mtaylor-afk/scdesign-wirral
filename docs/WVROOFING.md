# WV Roofing — concept site (separate project)

WV Roofing is a **stand-alone concept** for a roof-replacement business covering the Wirral and
Liverpool. It is parked on this host only so the owner can test functionality, usability and design
before buying its own domain and address. **It is not part of SC Design Wirral**: nothing on the SC
site links to it, it is not listed in `robots.txt`, the sitemap or `llms.txt`, it sends no SC
analytics or error beacons, and its emails are sent as "WV Roofing".

- Live (hidden, noindex): `https://scdesignwirral.co.uk/WVROOFING/`
- Everything WV Roofing lives in: `public/WVROOFING/`, `api/wvroofing/`, `serverlib/wvroofing.js`,
  `scripts/wvroofing/`, this file. The only shared-file touches are the `/WVROOFING` blocks in
  `public/_headers` (X-Robots-Tag) and `vercel.json` (function timeouts + X-Robots-Tag).
- To move it to its own domain later: copy those folders to a new repo, serve `public/` at the root
  (update `ROOT` in `assets/js/config.js` and the absolute `/WVROOFING/` links), deploy the two
  functions, and set the env vars below on the new project.

## Pages

| Path | What |
|---|---|
| `/WVROOFING/` | Home: hero before/after, the visualiser, the 8 roofs, services, process, areas, FAQ |
| `/WVROOFING/roof-replacement/` | Roof replacement detail + quote form |
| `/WVROOFING/visualiser/` | The Roof Visualiser app |
| `/WVROOFING/privacy/` | Privacy notice (concept draft) |

## How the roof images are made

1. **Mark the roof** in the browser (outline / cut-out / brush tools; sample houses come pre-marked).
2. **Quick previews** (`assets/js/vis/preview.js`): the roof is re-coloured and re-patterned in the
   browser for all 8 products, keeping the photo's own shading. Instant, free, approximate.
3. **Photo-real renders** (optional, with the visitor's consent): the photo + a PNG roof mask go to
   `POST /api/wvroofing/render`, which calls OpenAI `v1/images/edits` with a **fixed server-side
   prompt per product** (`serverlib/wvroofing.js` `buildPrompt`, fields in `data/catalogue.json`).
4. **Compositing** (`assets/js/vis/composite.js`): OpenAI treats masks as guidance and regenerates
   the whole picture, so the browser pastes back only the roof pixels through a feathered mask,
   after a small alignment search and exposure match. Everything outside the roof stays the
   original photo.

The 8 products, their colours, swatch patterns and prompt wording all live in
`public/WVROOFING/data/catalogue.json` — edit that one file to change the range.

## Environment variables (Vercel project that runs `api/*`)

Set these in the Vercel dashboard (never in the repo), then redeploy.

| Variable | Needed for | Default |
|---|---|---|
| `WVR_OPENAI_API_KEY` | photo-real renders (use a dedicated OpenAI project with a hard budget) | unset = previews only |
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
node scripts/wvroofing/dev-server.mjs            # http://localhost:8772/WVROOFING/ (API mounted, mock renders)
node scripts/wvroofing/selftest.mjs              # maths, compositing guarantee, validators, handlers
node scripts/wvroofing/qa.mjs                    # headless browser pass over every page + the visualiser
node scripts/wvroofing/prepare-samples.mjs <dir> # rebuild the sample photos from the originals
```

With no key set, the local server returns stand-in "mock" renders so the whole pipeline can be
tested. `--simulate 429|503` exercises the back-off and banners.

**Pre-rendering the sample houses** (after the key is live, costs about 7p a render): run the dev
server with `--proxy-live`, open `/WVROOFING/visualiser/?sample=<id>&save=1`, create the photo-real
renders; each raw render and a `meta.json` are written to `samples/renders/<id>/`. Then set
`"prerendered": true` for that sample in `samples/samples.json` and commit.
