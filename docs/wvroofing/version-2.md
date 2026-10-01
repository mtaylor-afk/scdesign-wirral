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
  - questions and the placeholder contacts.
- **The Roof Cam** (`/WVROOFING/2/roof-cam/`). The visualiser, cut down to a photo and a tap, and entirely
  on the device: no address, no upload, no account, no server.
  - One tap finds the roof (`engine/auto-roof.js`). Visitors can add slopes, cut out chimneys, adjust with
    Tighter/Looser, or draw the outline themselves (version 1's editor).
  - The eight roofs are drawn in a Web Worker.
  - A weather deck (as shot, sun, drizzle, storm, dusk) re-grades the picture and rains on the visitor's own
    roof.
  - Hold the picture (or use the button) to see the old roof. At dusk a torch magnifies the new roof.
  - A share card (1080 × 1350) and a watermarked save.
  - A "network light" counts every request after the photo arrives.
  - `?sample=` and `?tile=` deep links; `?selftest=1` measures the one-tap finder on the three samples.
- **The range** (`/WVROOFING/2/range/`). The eight looks drawn from numbers, each with its station report, a
  weather test, and which roof suits which house.
- **About** (`/WVROOFING/2/about/`). What it is, what stays on the device (everything) and what is stored (only
  the Calm choice), how the roofs are drawn, and the credits.

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
  to that policy. The CSP test now checks the version 2 pages too. `public/_redirects` sends the lowercase
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

- Real phones haven't been tried (emulation only).
- The one-tap finder finds most of the tapped slope, not every roof. The outline can always be adjusted or
  drawn.
- Previews are approximate, and the weather is a colour grade, not physics or a forecast.
