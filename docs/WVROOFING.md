# WV Roofing — concept site (separate project)

WV Roofing is a **stand-alone concept** for a roof-replacement business covering the Wirral and
Liverpool. It is parked on this host only so the owner can test functionality, usability and design
before buying its own domain and address. **It is not part of SC Design Wirral**: nothing on the SC
site links to it, it is not listed in `robots.txt`, the sitemap or `llms.txt`, it sends no SC
analytics or error beacons, and its emails are sent as "WV Roofing".

- Live (hidden, noindex): `https://scdesignwirral.co.uk/WVROOFING/`
- Everything WV Roofing lives in: `public/WVROOFING/`, `api/wvroofing/app.js` (the one function),
  `serverlib/wvroofing/`, `db/wvroofing/`, `scripts/wvroofing/`, `docs/wvroofing/`, this file. The only
  shared-file touches are the `/WVROOFING` blocks in `public/_headers` (X-Robots-Tag and the
  Content-Security-Policy), the WV entries in `vercel.json` (function, rewrite `/api/wvroofing/:path*`,
  daily cron, X-Robots-Tag, Content-Security-Policy) and, in
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

## The visualiser's six steps

1. **Your home** (optional; "Photo only" skips it): postcode, address (or typed in), a satellite view with a
   pin where the location is rooftop-accurate, "is the pin on your house?", and the kind of property.
2. **Photo**, 3. **mark the roof**, 4. **compare** (below).
5. **Estimate**: says honestly that no licensed roof-measurement data is available online yet, with the
   survey disclaimer, and offers "Request a survey".
6. **Send**: the enquiry, saved with a reference (below).

Each step is a browser history entry, and a refresh carries on where the customer was.

## How the roof images are made

1. **Mark the roof** in the browser (outline / cut-out / brush tools; sample houses come pre-marked).
   An uploaded photo lives in the visitor's project on the server (checked, metadata removed, a
   lossless 1600 px working copy), and the outline is saved there too.
2. **Quick previews** (`assets/js/vis/preview.js`): the roof is re-coloured and re-patterned in the
   browser for all 8 products, keeping the photo's own shading. Instant, free, approximate.
3. **Photo-real renders** (optional, only after the visitor agrees; uploaded photos only): durable
   jobs (`POST /api/wvroofing/projects/:id/renders`, `serverlib/wvroofing/jobs.js`). The request
   answers at once; the render carries on in the background and the page polls for it. The chosen
   roof renders automatically, the others when tapped. The server builds the photo (PNG) and mask
   (PNG) from the working copy and calls OpenAI `v1/images/edits` with a **fixed, versioned prompt**
   (`serverlib/wvroofing/openai.js` `buildPrompt`, fields in `data/catalogue.json`). A render that
   times out is marked "uncertain" (it may have been charged) and is never repeated automatically.
4. **Compositing** (`serverlib/wvroofing/compose.js`, using the browser's own `mask-ops.js` and
   `composite.js`): OpenAI treats masks as guidance and regenerates the whole picture, so only the
   roof pixels are taken from the render, through a feathered mask, after a small alignment search
   and exposure match. On the lossless working copy every pixel outside the roof is the original,
   byte for byte (tested); a render whose edges don't line up is rejected rather than used.
   Sample houses never call OpenAI: they show pre-rendered results, composited in the browser.

The 8 products, their colours, swatch patterns and prompt wording all live in
`public/WVROOFING/data/catalogue.json` — edit that one file to change the range.

## Enquiries

Every quote request is **saved before anyone is emailed** (`serverlib/wvroofing/enquiries.js`) and
the customer gets a reference such as `WVR-2609-7K3Q`. The email to the roofer (WV Roofing's own
mailer, `mailer.js`) is a separate step: tried at once, once more a few seconds later, then by the
daily job, at most three times. A send that may have gone out before the connection dropped is
"uncertain" and isn't repeated automatically. The customer is told the truth: the roofer has been
notified, is being notified, or (while this is a concept and emails are switched off) isn't being
notified yet. An enquiry from the visualiser about the customer's own photo keeps that photo and its
renders for 12 months and can attach the before photo and the chosen render; enquiries are deleted
after 12 months. Without storage, the forms say the site isn't collecting enquiries yet and nothing is
saved or sent.

## Environment variables (Vercel project that runs `api/*`)

Set these in the Vercel dashboard (never in the repo), then redeploy. The complete list, including the
v02 storage and capability variables, is `docs/wvroofing/wvroofing.env.example`.

**A key alone never switches a feature on.** Each capability needs its credential, its rights resolved
in `serverlib/wvroofing/permissions.js`, and its owner switch: live photo-real renders need
`WVR_CAP_IMAGE_GENERATION=on` as well as the key. `GET /api/wvroofing/health` shows every capability's
state and the reason.

| Variable | Needed for | Default |
|---|---|---|
| `WVR_OPENAI_API_KEY` | photo-real renders (use a dedicated OpenAI project with a hard budget); also needs `WVR_CAP_IMAGE_GENERATION=on` and project storage | unset = previews only |
| `WVR_LEAD_TO` | where enquiry notifications are emailed (comma-separated); also needs `WVR_CAP_ENQUIRY_DELIVERY=on` | unset = saved, not emailed |
| `WVR_IDEAL_POSTCODES_KEY` | address lookup; also needs `WVR_CAP_ADDRESS_LOOKUP=on` | unset = type the address |
| `WVR_GOOGLE_MAPS_STATIC_KEY` + `WVR_GOOGLE_MAPS_SIGNING_SECRET` | the satellite view; also needs `WVR_CAP_AERIAL_DISPLAY=on` | unset = no satellite view |
| `WVR_IMAGE_MODEL` | image model; unknown models are refused, not guessed at | `gpt-image-2.5-sunburst` |
| `WVR_IMAGE_QUALITY` | a quality the model accepts (always sent explicitly) | `high` |
| `WVR_ENABLED` | `0` switches every paid call off | on |
| `WVR_AUTO_RENDER` | how many finishes render automatically once agreed (`0` = only on tap) | 1 |
| `WVR_MAX_CONCURRENT` | queued + running renders per project | 3 |
| `WVR_UPSTREAM_IPM` | renders per minute sent to OpenAI, across every instance (Tier 1 = 5) | 5 |
| `WVR_IP_DAILY` / `WVR_RENDERS_PER_PROJECT_DAILY` / `WVR_DAILY_CAP` | renders per visitor / per project / in total, per day | 40 / 12 / 200 |
| `WVR_DAILY_BUDGET_USD` | spending ceiling per UTC day, counting renders in flight | 5 |
| `WVR_OPENAI_TIMEOUT_MS` | how long one render may take | 240000 |
| `WVR_MAX_SEAM` | renders whose edges miss the photo by more than this are rejected (uncalibrated until A8) | 50 |
| `WVR_MAIL_FROM` | From header for quote emails | `"WV Roofing (concept)" <mail@tailoredquote.co.uk>` |
| `WVR_EXTRA_ORIGINS` | extra allowed browser origins (comma-separated) | — |

Quote emails reuse the project's existing `SMTP_USER` / `SMTP_PASS` (iCloud SMTP), sent by WV
Roofing's own mailer as "WV Roofing"; per-visitor and daily limits: `WVR_ENQUIRIES_PER_IP_HOURLY` (5),
`WVR_ENQUIRIES_DAILY` (200).
The instant kill switch for spend is `WVR_ENABLED=0` (or disabling the key in the OpenAI
dashboard); the site then falls back to quick previews. If OpenAI reports the key refused or the
budget spent, renders pause for everyone for a few minutes rather than retrying.

## Local development and tests

```
node scripts/wvroofing/dev-server.mjs            # http://localhost:8772/WVROOFING/ (labelled test environment)
npm run wvr:test                                 # node:test suites: router, projects, renders, images, OpenAI rules, compositing, deploy shape
npm run wvr:check                                # JSDoc type check of serverlib/wvroofing (strict)
node scripts/wvroofing/selftest.mjs              # maths, compositing guarantee, validators, render settings
node scripts/wvroofing/qa.mjs                    # headless browser pass over every page + the visualiser
node scripts/wvroofing/prepare-samples.mjs <dir> # rebuild the sample photos from the originals
```

The dev server runs as the **test environment** (`WVR_ENV=test`): PGlite instead of Neon, a local
folder instead of Vercel Blob, and a stand-in for OpenAI that paints the product's colour into the
marked roof (about 1.5 s a render); production never uses these. `--fixture <mode>` makes the
stand-in time out, fail, refuse the photo, run out of budget or return a misaligned picture, to try
each render state in the browser (modes listed in `scripts/wvroofing/dev-server.mjs`).

**Pre-rendering the sample houses** (photo-real results for the demo houses) is part of the owner-
approved live integration (A8, at most 24 renders). Until then the sample houses show quick previews,
and only a visitor's own photo can be rendered photo-real.
