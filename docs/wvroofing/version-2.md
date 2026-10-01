# WV Roofing version 2: "Rain Later", the weather report (2026-09-30)

A second, deliberately theatrical version of the concept site at `/WVROOFING/2/`
(`public/WVROOFING/2/`), built alongside version 1, which is unchanged. Matthew asked for something "wild
and off the wall" with a simpler visualiser, as a hobby project.

## What it is

- **The bulletin** (`/WVROOFING/2/`). A late-night weather report. The page opens in a storm; rain lands on
  the sample house's roof, runs down it and drips off the eaves. Then the front clears and the old roof
  re-tiles itself in Spanish slate, drawn on the visitor's device. Then:
  - the eight roofs on one house in any weather;
  - the Roof Cam in three beats;
  - the stages of a re-roof;
  - the areas read as a shipping forecast ("not a real forecast");
  - questions, the placeholder contacts and (since 2026-10-01) a short contact form.
- **The Roof Cam** (`/WVROOFING/2/roof-cam/`). The visualiser, cut down to a photo and a tap. The roofs are
  drawn on the device; since 2026-10-01 the visitor's own photo is also saved for the roofer (see
  "Saving photos and enquiries" below). No address and no account.
  - One tap finds the roof (`engine/auto-roof.js`). Visitors can add slopes, cut out chimneys, adjust with
    Tighter/Looser, or draw the outline themselves (version 1's editor).
  - The eight roofs are drawn in a Web Worker.
  - A weather deck (as shot, sun, drizzle, storm, dusk) re-grades the picture and rains on the visitor's own
    roof.
  - Hold the picture (or use the button) to see the old roof. At dusk a torch magnifies the new roof.
  - A share card (1080 × 1350) and a watermarked save.
  - A "save light" under the controls says how saving the photo is going (it replaced the first build's
    "network light", which counted requests to show that nothing was uploaded).
  - "Send it to the roofer": the visitor's details, the roof they chose and, for their own photo, the photo
    and a preview.
  - `?sample=` and `?tile=` deep links; `?selftest=1` measures the one-tap finder on the three samples.
- **The range** (`/WVROOFING/2/range/`). The eight looks drawn from numbers, each with its station report, a
  weather test, and which roof suits which house.
- **About** (`/WVROOFING/2/about/`). What it is, what happens to the photo and the details sent, what the
  browser stores, how the roofs are drawn, and the credits.

## Saving photos and enquiries (2026-10-01)

Matthew asked for every customer photo, and the contact details sent with it, to be saved and shown in the
admin screen for both versions. Version 2 now uses version 1's store and operator screen:

- **The photo.** When a visitor takes or chooses a photo, the Roof Cam opens it and draws the roofs on the
  device straight away, and `assets/js/cam/store.js` saves it in the background: a project with
  `site = 'v2'`, a presigned upload (the camera's own JPEG or PNG, or a JPEG made on the device from
  anything else), then the server's usual checks and metadata stripping. Every photo chosen is saved, one
  after another. The save light shows Saving (with a percentage), Saved (with Delete it), Not saved (when
  storage isn't switched on: the roofs still work) or a failure (with Try again). Sample houses are never
  saved.
- **Send it to the roofer.** A dialog on the "On your roof" screen, using version 1's form code
  (`/WVROOFING/assets/js/enquiry.js`) so both versions save the same enquiry. For the visitor's own saved
  photo it first sends a watermarked preview of the roof on screen (`POST projects/:id/mockups`), then the
  enquiry about the project (source `roof-cam`); the roofer's email attaches the photo and that preview.
  For a sample house it sends a plain enquiry (source `roof-cam-sample`).
- **The bulletin** has a contact form in its sign-off (source `bulletin`).
- **The operator screen** (`/WVROOFING/operator/`) has a **Photos** tab listing every photo from both
  sites, and the Enquiries tab can be filtered by site. See `operator-guide.md`.
- The copy that promised "nothing is uploaded" (the bulletin, the Roof Cam, About) was rewritten, and the
  privacy notice at `/WVROOFING/privacy/` now covers the Roof Cam too.
- On the live site nothing is saved until the owner's storage steps in `setup-and-deploy.md` (Neon, Blob,
  `WVR_SESSION_SECRET`, `CRON_SECRET`) are done; until then the save light says "Not saved" and the forms
  say enquiries aren't being collected yet.

## How it's built

- Static HTML, CSS and ES modules, with no build step and no third-party code. Only the typefaces come from
  Google Fonts: Big Shoulders Display, Archivo and IBM Plex Mono.
- It reads version 1's catalogue and sample list where they are (`/WVROOFING/data/catalogue.json`,
  `/WVROOFING/samples/samples.json`), with three version 2 additions in `assets/samples/` and `data.js`:
  - small thumbnails of the three sample photos for the cards;
  - a copy of the 1920s-30s detached house with the number on its gate post blurred. Version 1's photo is
    left as it is, at Matthew's request (2026-10-01).
  - its own short descriptions of the looks, without price, value or speed wording.
- Version 1's image engine is adapted in `assets/js/engine/`:
  - `preview` and `tiles` are copied unchanged.
  - `mask-ops` is adapted: the feathering works only round the roof, with identical output.
  - `mask-editor` is adapted: closing it releases everything.
  - `photo` is adapted: it reads the size from the header, refuses photos over 40 MP, and decodes straight
    to the working size where it can.
  - `watermark` is adapted: it adds a concept line and the stock credit, in IBM Plex Mono.
  - `grade`, `engine`, `preview-worker` and `auto-roof` are new.
  - Version 1's `composite` (AI renders) isn't used.
- The existing headers for `/WVROOFING/*` (noindex and the content security policy) cover it, and it keeps
  to that policy (its uploads go to the same API and storage hosts as version 1's). The CSP test now checks the version 2 pages too. `public/_redirects` sends the lowercase
  `/wvroofing/2` to `/WVROOFING/2/`, because Cloudflare paths are case-sensitive.
- **Calm.** A "Weather" switch in every page's top bar stills every animation, and `calm-early.js` applies
  the choice before the first paint. The page starts calm when the device asks for reduced motion or data
  saving. Lightning flashes at most once every 6 seconds page-wide, at no more than 28% brightness.

## Review

- A seven-angle review (Roof Cam behaviour, the weather engine, the other scripts, the share card, honesty,
  accessibility and platform) found 98 problems, each verified by a second reviewer.
- Four fixers then worked on separate files, followed by an integration check and an independent
  re-check of every fix.
- The most serious problems were:
  - the share card could name one roof over a picture of another;
  - on short or landscape phones the pinned picture could hide every control;
  - one sample showed a house number although the pages say numbers are blurred;
  - two layouts spilled off the screen;
  - some touch targets and text sizes were too small.

## Checks

- `node --test scripts/wvroofing/tests/v2-auto-roof.test.mjs` tests the one-tap finder against the samples'
  hand-marked roofs: IoU for the tapped slope, determinism, speed and unsure taps.
- It is also covered by `npm run wvr:test` (the whole suite, including the operator-link and CSP tests) and
  by `npx eslint public/WVROOFING/2`.
- It was checked in the browser on desktop and at phone size (emulated): each page, a sample house, an
  own-photo tap, the weather deck, the torch, hold-to-see-before and the share card.

## Not claimed

- Real phones haven't been tried (emulation only), including the camera button and the background save.
- The one-tap finder finds most of the tapped slope, not every roof. The outline can always be adjusted or
  drawn.
- Previews are approximate, and the weather is a colour grade, not physics or a forecast.
