# WV Roofing v02 — decision record

Version 2026-09-28 (v02 build brief of 2026-09-27). Each decision names its evidence; external facts were
checked against official documentation on 27–28 September 2026. Reversible decisions were made rather than
asked, as the brief requires.

| # | Decision | Why |
|---|---|---|
| D1 | Keep the stack: static vanilla-JS pages on Cloudflare, Node functions on Vercel. Server code is CommonJS JavaScript with JSDoc types, checked by `npm run wvr:check` (`tsconfig.wvroofing.json`, strict). | Brief §2 (keep the working stack). No TypeScript build: local Node 20 can't run `.ts`, the pages have no build step, and the maths modules are shared between browser and server. |
| D2 | Persistence: Neon Postgres and a private Vercel Blob store, both in London, used only by WV Roofing. | Durable storage the host supports, UK data at rest, and complete separation from SC Design's Supabase. |
| D3 | A labelled test environment (`WVR_ENV=test`): PGlite, a local-folder store and fixture adapters. Production refuses them. | Brief §8: fixtures only in a separate test environment; production adapters are never fake. |
| D4 | Durable jobs in Postgres: `POST` answers 202, the work continues with `waitUntil`, polls reconcile, a daily cron sweeps. A timed-out OpenAI call is `uncertain` and never repeated automatically. | Brief §8/§15; Hobby crons run once a day; Vercel Queues is in beta; the Images API is synchronous. |
| D5 | Access control: per-project bearer tokens (hashed, 30 days) in `sessionStorage`; images streamed through the function; operator sessions stored in the database and revocable; a CSP for `/WVROOFING/*`. | Brief §17; the origin is shared with SC Design, which has no CSP. |
| D6 | Image pipeline on the server: presigned upload, header checks before decoding, lossless metadata stripping, an immutable original, a lossless working copy, server-side compositing. | Brief §9–10; OWASP upload guidance. |
| D7 | JPEG/PNG uploads only; HEIC is converted by iOS Safari when the input doesn't accept HEIC, otherwise refused with a message. | sharp can't decode HEIC; the brief allows conversion only where verified. |
| D8 | Default image model `gpt-image-2.5-sunburst` at `high`; only the chosen finish renders automatically; benchmark after the key exists. | OpenAI docs; `gpt-image-2` at high timed out in SC's pipeline. |
| D9 | Address lookup: Ideal Postcodes through our API; only the chosen address is stored. | UPRN and rooftop coordinates included; Royal Mail terms forbid caching whole responses. |
| D10 | Aerial confirmation: a signed Google Static Maps satellite image, display-only. | Google's terms allow display and forbid derivation, storage and AI use. |
| D11 | Measurement: no automated supplier could be verified for Merseyside, so the roofer's assisted route comes first; automatic measurement is an unresolved requirement. | Brief §3; supplier survey (Solar API limited to energy uses; EagleView no Merseyside; Bluesky/Getmapping licences forbid web display). |
| D12 | Quantities only for manufacturer-verified products; generic looks never produce quantities; no prices at all. | Brief §5 and §13. |
| D13 | Postcode-first journey with an equal photo-only route; information notice, not a checkbox; the only opt-in is OpenAI processing. | Brief §5 and §17; ICO lawful-basis guidance. |
| D14 | One WV function (`api/wvroofing/app.js`) behind a `vercel.json` rewrite; never a 13th file under `api/`. | Hobby allows 12 functions per deployment and `api/` already held 12. |
| D15 | CommonJS server modules; additive `package.json` changes; migration SQL bundled with `includeFiles`. | Matches the repo; SC code paths untouched. |
| D16 | Capability states implemented → configured → enabled → disabled; enabling needs the credential, resolved rights and the owner's `WVR_CAP_*` switch. | Brief §4: a key alone never enables anything. |
| D17 | A1 goes live straight away; A2–A4 wait until Neon and Blob are connected. | Keeps the live concept working at every push. |

**Deviation, 2026-09-28:** the `lhr1` region pin moved from A1 to A2. A1 makes no database calls, and on Hobby a
per-function region may fail the deployment, so it waits for the owner's answer on the Vercel plan.

**Rewrite detail:** the rewrite destination also carries the route (`/api/wvroofing/app?path=:path*`). The router
prefers the original request path and falls back to that single `path` value, so routing works whichever way
Vercel hands over a rewritten request.

## Decisions made while building A2 (2026-09-28)

- **sharp stays at 0.34.5, locked down.** npm audit reports libvips CVEs (GIF, TIFF and VIPS loaders; fixed in
  sharp 0.35.0) and libheif CVEs (fixed in 0.35.4). sharp is a shared dependency of SC Design's own build scripts,
  so the upgrade is SC's decision. WV Roofing only ever hands sharp JPEG or PNG buffers it has already sniffed by
  magic bytes, and `images.js` blocks every other libvips loader (`sharp.block({operation: ["VipsForeignLoad"]})`,
  then unblocks the JPEG and PNG loaders only). Recommended: upgrade the repo to sharp ≥ 0.35.5.
- **Storage needs `CRON_SECRET`.** The photo notice promises deletion after 30 days, and only the daily job keeps
  that promise, so `enquiry_storage` is not enabled until the cron can run.
- **Origin rule.** A disallowed `Origin` is always refused. A missing `Origin` is accepted for `GET`/`HEAD` (browsers
  omit it on same-origin GETs; project routes still need the bearer token) but never for `POST`.
- **POSTs must be JSON** (415 otherwise), so a cross-site HTML form can't reach the API without a CORS preflight.
- **Content Security Policy** for `/WVROOFING/*` on both hosts; the pages' one inline script is allowed by hash
  (`scripts/wvroofing/tests/csp.test.mjs` recomputes it). `style-src` keeps `'unsafe-inline'` for the pages'
  inline `style` attributes.
- **Legacy mask check hardened** (live render endpoint): the PNG header size is checked before anything is
  inflated, and inflation is capped at the size the header implies.
