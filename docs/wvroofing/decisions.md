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
  inflated, and inflation is capped at the size the header implies. (The endpoint itself went in A3.)

## Decisions made while building A3 (2026-09-28)

- **Renders are project jobs.** `POST projects/:id/renders` answers 202; a background worker (`waitUntil`)
  makes the render; the page polls. The pre-v02 `/render` endpoint and the browser's render queue are gone.
  Sample houses never call OpenAI: they show pre-rendered results only (none exist until A8, so for now
  they show quick previews and say that photo-real renders are made from your own photo).
- **When a render goes wrong.** A timeout or a dropped connection makes the job `uncertain`: its budget stays
  reserved and it is never repeated automatically ("Try again" starts a new job). Only an explicit 5xx is
  retried, once. A 429 from OpenAI puts the job back in the queue without counting an attempt. A
  moderation refusal fails the job. "Budget spent" pauses renders for everyone for 15 minutes; "key or
  model refused" for 5 minutes (a breaker row in `wvr_leases`), so a broken setup isn't hammered.
- **Budget ledger.** Each job reserves a deliberately generous estimate (published output price for the
  size and quality, plus $0.06 for inputs, times 1.25) and is settled from the `usage` OpenAI returns.
  gpt-image-2.5's per-token prices are assumed to equal gpt-image-2's until A8 checks the OpenAI dashboard.
- **Server-side compositing with the browser's own maths.** `compose.js` imports `mask-ops.js`,
  `ai-input.js` and `composite.js` with literal `import()` paths, so Vercel's file tracer bundles them.
  The three modules carry `// @ts-nocheck`, which keeps them out of the server's JSDoc type check (the
  type checker follows the literal imports).
- **Delivery JPEGs** (the photo's display copy and every composite) use plain libjpeg at quality 88,
  without mozjpeg's trellis quantisation, so areas a composite leaves untouched encode identically block
  for block. The QA compares the served composite with the served photo this way. Files are about 10 %
  larger.
- **Misaligned renders are rejected**, not used: a composite whose seam error (mean luma difference in a
  band round the roof) is above `WVR_MAX_SEAM` fails as `misaligned`. The default, 50, is uncalibrated
  until the A8 benchmark; it sits well above the lightbox's 18 "edges may not line up" warning because a
  real render redraws fine texture round the roof even when it lines up (raised from 35 in A4 after a
  noisy test photo showed how large that effect can be). The model's raw answer is kept for the operator
  either way.
- **Stopping and consent.** "Stop renders" cancels renders not yet sent; one already sent can't be
  recalled (it is paid for) and still appears. Withdrawing consent cancels queued renders. The first time
  consent was given is kept.
- **Limits** are database-backed and shared by every instance: per visitor per day (`WVR_IP_DAILY`), per
  project per day (`WVR_RENDERS_PER_PROJECT_DAILY`), in total per day (`WVR_DAILY_CAP`), pending per
  project (`WVR_MAX_CONCURRENT`) and per minute to OpenAI (`WVR_UPSTREAM_IPM`). `WVR_IP_LIMIT` and
  `WVR_ALLOW_MOCK` are gone. `WVR_AUTO_RENDER=0` now really means "only when tapped" (default 1).
- **Files and names.** The AI inputs and the composite are in `compose.js` (not `images.js`), and the
  polling lives in `vis/app.js` until A5 splits the page into journey modules. The dev server's stand-in
  renderer (`--fixture <mode>`) replaces the old mock mode; `--simulate` and the `?save=1` sample
  pre-render path are removed (A8 adds a pre-render tool that runs with the owner's approval).
- **Retention.** Files of renders that were never shown (failed, cancelled, quarantined) are deleted
  after 7 days; queued jobs older than a day are dropped and their budget released (daily job).

## Decisions made while building A4 (2026-09-28)

- **Saved first, notified second.** `POST enquiries` (and the permanent `enquiry` alias) and
  `POST projects/:id/enquiry` write the enquiry to Postgres, then email. References are `WVR-YYMM-XXXX`
  in Crockford base32 (no I, L, O or U), shown to the customer and used in emails, never used to look
  anything up. One enquiry per project; a form's request key lives in `sessionStorage` until the
  enquiry is saved, and unique indexes make a double tap or a reload return the same enquiry.
- **Truthful status.** The request waits up to 8 seconds for the email, so "the roofer has been
  notified" is said only once the SMTP server has accepted it; otherwise "we're notifying the roofer;
  your enquiry is safely stored". While `WVR_CAP_ENQUIRY_DELIVERY` is off, enquiries are still saved and
  the customer is told no one is being notified yet (this is a concept).
- **Bounded delivery.** One quick retry after about 11 seconds, then the daily job, at most three
  attempts in all. A connection lost after the message was handed over (during or after DATA) is
  `uncertain` and never repeated automatically; a send that never reported back is settled as
  `uncertain` by the daily job. The operator screen (A6) will show and resend these.
- **Bots.** A filled honeypot is dropped with a fake "thank you". A form completed in under 2.5 seconds
  is now kept as `spam_suspected` and never emailed (it used to be dropped, which could silently lose a
  real enquiry filled by autofill).
- **The email** comes from WV Roofing's own mailer (never SC's), with 15/10/30-second connection,
  greeting and socket timeouts. A `WVR_MAIL_FROM` that doesn't name "WV Roofing", or names SC Design, is
  ignored in favour of the default. No links or keys in the email. Images are attached only if the
  customer asked, at most two JPEGs of at most 450 KB (the before photo and the chosen photo-real
  render), read from storage on the server; the browser no longer uploads base64 images, and quick
  previews (browser-only) are not attached. The link to the operator page arrives with A6.
- **Retention now, not in A7.** An enquiry keeps its project (photo, outline, renders) for 12 months
  instead of 30 days, and the daily job deletes enquiries older than 12 months, so the privacy notice is
  true from the day enquiries are stored. Deleting the photo keeps the enquiry (its project link is
  cleared).
- **Clean-up.** The `legacy/` bridge is gone, and so are core.js's bridge-only helpers (`cors`, `ipKey`,
  `createLimiter`) and the "£ estimate" block. nodemailer has no types: one `@ts-ignore` at its
  `require` (a `.d.ts` would join SC's own type check, which includes every `.ts` file in the repo).
  `public/WVROOFING/assets/js/package.json` marks the browser scripts as ES modules for Node.
- **Render seam threshold.** `WVR_MAX_SEAM` default raised from 35 to 50 (see A3).

## Decisions made while building A5 (2026-09-28)

- **Six steps, one page.** Your home, photo, mark, compare, estimate, send (`vis/journey.js`). Each step is
  a History API entry, so the browser's and Android's Back walk through the steps. `?sample=` still lands on
  the marking panel and `?tile=` still picks the first roof. Phones show "Step 2 of 6: Photo" instead of the
  six-part control.
- **Resume.** The URL carries `?project=<id>` (useless without the key, which stays in `sessionStorage`).
  A refresh rebuilds the address and property answers, the photo (from the server's copy), the outline, the
  previews and the renders (each repeat request is answered from the existing job, so nothing is rendered
  twice), and an enquiry's reference instead of the form. The page returns to the step in the URL, or the
  furthest step reached.
- **A project that has gone** (deleted, expired, or from an older session) now answers `project_not_found`.
  The browser forgets the key, starts a new project and retries once; an enquiry about a photo that has gone
  is still sent, as a plain enquiry.
- **Address lookup** (Ideal Postcodes, server-side key). Postcodes are normalised first; Ideal Postcodes' free
  test postcodes pass through. The list is never stored or cached (Royal Mail's terms): each address goes back
  with a signed token (HMAC with `WVR_SESSION_SECRET`, bound to the project, valid for an hour) and only the
  address chosen from a token is stored. Typing an address is always possible. `nyb` addresses show "New
  build". Coordinates count as rooftop only when the address has a UPRN. The customer says what kind of
  property it is.
- **Satellite view** (Google Maps Static API). The server signs the URL (HMAC-SHA1 over the path and query,
  the secret never leaves the server) and the browser loads the image straight from Google, so the CSP's
  `img-src` now allows `maps.googleapis.com` on both hosts. Pin and zoom 20 only for rooftop coordinates, zoom
  18 and no pin for a postcode centroid. Display only: never stored, proxied, traced or sent to OpenAI.
  Every lookup and every signed view is rate-limited and logged in `wvr_provider_calls` (`cost` and
  `currency`: lookups in GBP, maps in USD; migration 0003's column was renamed before it reached any
  database).
- **Ambiguity** is stored as reasons, not a score: `no_rooftop_coordinate`, `not_seen_from_above`,
  `pin_not_confirmed`, `shared_roof` (semi, end or mid terrace), `flat_or_shared_block`,
  `property_type_unclear`. A new address supersedes the confirmation (kept, marked superseded). The enquiry
  snapshot and email carry the address, the confirmation and "check before quoting" in plain words.
- **No prices anywhere.** The £ / ££ / £££ bands are gone from the visualiser, lightbox, compare grid and home
  picker (the catalogue's `price` field goes in B1). The home page's "£0 survey" statistic now reads "Free …
  (concept wording, to be confirmed)": the owner should confirm the offer. The QA checks every page for "£".
- **The estimate step** says "Suitable data unavailable", why, the brief's disclaimer verbatim and what's not
  included, and offers "Request a survey". **The enquiry step** replaces the quote dialog (contact details are
  only asked for here); the lightbox gained Before / Side by side / After buttons.
- **Smaller things.** The watermark uses the site's font (it named Barlow, which never loaded).
  `#compare-sub` now describes what's on screen. The health request waits up to 15 seconds (a cold function
  also wakes the database), and the dev server starts the test database when it starts. Nested ES-module
  imports are not versioned: this host revalidates static assets by default, and the page-level assets carry
  a new `?v=`.

## Decisions made while building A6 (2026-09-28)

- **One operator password, held only as a hash.** `WVR_OPERATOR_PASSWORD_HASH` is
  `scrypt:N:r:p:salt:hash` (scrypt N=16384, r=8, p=1, 16-byte salt, 64-byte key, base64url). Colons rather
  than `$`, so no `.env` loader can expand part of it. The owner makes it with
  `node scripts/wvroofing/operator-hash.mjs` on his own machine: it reads the password twice without
  showing it, needs at least 12 characters, refuses the test password and prints only the hash. Claude
  never sees or types the real password.
- **Sessions.** A login opens a 12-hour session. Its 256-bit key is stored only as a SHA-256 hash; the
  browser keeps it in `sessionStorage` (this tab only) and sends it as a bearer token, so there are no
  cookies and no cross-site form can act as the operator. Logging out revokes the session on the server.
  Each session records which password hash it was opened under, so **a new password ends every session**.
  With no hash set, the login answers `not_configured` and no session works.
- **Lockouts.** Five failed logins from one visitor (the daily IP hash), or twenty in all, within 15 minutes
  lock logins, even with the right password, until the window passes. Every attempt is recorded. Attempts
  and ended sessions are deleted after 7 days.
- **The test password.** The labelled test environment (dev server, QA, tests) logs in with
  `TEST_OPERATOR_PASSWORD` in `serverlib/wvroofing/auth.js`. Outside the test environment that password is
  refused even if a hash of it were ever set.
- **Every route declares `operator` auth** except `operator/login`. A customer's project key, a revoked key
  and an expired key all get 401; the test suite checks every operator route in the table.
- **Audit.** Every change (status, survey requested, scope corrected, email sent again, render tried again,
  original downloaded, deleted) is written to `wvr_operator_actions` with the state before and after and
  the session that did it. The history is never edited and is deleted after 12 months, like enquiries.
- **Scope correction** adds a new confirmation (`confirmed_by = operator`) and marks the customer's as
  replaced. What the customer saw and answered on the satellite view (pin shown or confirmed) is carried
  over unchanged. The enquiry's snapshot, which is what the customer sent, never changes. From Release B a
  correction also sends any measurement back to `needs_review`.
- **Status** is one field: `new`, `contacted`, `survey_requested`, `quoted`, `closed`, or
  `spam_suspected`. Automatic email retries only run while an enquiry is `new`. Once the operator has
  moved it on, it isn't emailed again unless he asks. "Request a survey" records the date; it doesn't
  contact the customer.
- **Sending the email again** needs `{confirm: true}`. It sends whatever the delivery state, even `sent`
  (the roofer says it never arrived), but never while a send is in progress. The outcome is recorded.
- **Trying a render again** needs `{confirm: true}`, and an uncertain render's message says it may already
  have been charged. It is a new job with its own budget reservation, keyed on the old job, so a double
  click makes one render. It is refused if the customer has since withdrawn their OK to use OpenAI, or if
  the photo or outline has changed. The old job is left as it was.
- **Deleting.** "Photo and project only" keeps the enquiry and contact details, for example when the
  customer asks for their photo to be removed. "Enquiry and project" removes both, for example on an
  erasure request. The history keeps the reference, not the contact details.
- **The page** (`/WVROOFING/operator/`) is noindexed, linked from nowhere (a test searches `public/` and
  `src/` for links) and served under the same CSP with no inline script. All customer text is put on the
  page as text, never as HTML. Images are fetched with the operator's key, shown as object URLs, and kept
  while that enquiry is open.
- **Satellite views opened by the operator** are logged as paid calls (`issued_operator`), like the
  customer's.

## Decisions made while building A7 (2026-09-28)

- **Every retention period lives in `retention.js`, and not in environment variables.** The plan said the
  periods would be configurable. They are, in that one place, but not per deployment. The privacy notice
  states them, so changing one is a code change made together with the notice.
  `retention.test.mjs` checks the privacy notice, the photo notice and `retention.md` against the numbers.
  The scattered SQL literals now use `make_interval` with these values.
- **New purges in the daily tidy-up.**
  - The paid-call log and the budget ledger after 13 months. They hold no personal data once the project
    has gone, and 13 months gives a year of cost history.
  - The tidy-up's own record after 90 days.
  - Leases left by a crashed run, a day after they ran out.
  - Records of committed uploads after 24 hours.
- **Copies outside our control, checked 28 September 2026** (recorded in `retention.md` and the privacy
  record):
  - Neon Free keeps 6 hours of point-in-time history. This is fixed; paid plans keep 7 or 30 days.
  - After a delete, Vercel Blob's CDN cache "may take up to 60 seconds" to stop serving a copy. The copy is
    readable only with our credentials, and our routes check the database first.
  - Vercel describes no backups of deleted blobs.
- **Search for data requests.** `operator/enquiries?q=` matches the reference, name, email, postcode, the
  chosen address, or the phone number's digits (4 or more).
  - Wildcards typed in the search are matched literally.
  - This is how the operator finds everything from one person for an access or erasure request.
- **Costs.** `operator/costs` reports:
  - the paid calls by provider for the last 30 days and by month for 12 months (UTC);
  - today's render budget;
  - the render outcomes, counted from the paid-call log (render records go with deleted projects);
  - how many projects are held;
  - the last daily tidy-up.

  The operator screen has a Costs tab for it.
- **Live QA sends nothing.** Until now, `qa.mjs --live` submitted both enquiry forms. Once storage and
  email are on, that would be a real enquiry and a real email to the roofer. On a deployed copy it now
  fills the forms in but never sends them. It still uploads one test photo and deletes it again.
- **Known gap.** Contact details can't be edited on the operator screen. For now, a correction is noted in
  the reply, or the enquiry is deleted and sent again.
- **Handover v1** is in `handover-2026-09-28-v1.md`, `setup-and-deploy.md`, `privacy-record.md`,
  `cost-model.md`, `retention.md` and `screens/`. The screenshots are from the test environment: the
  names are QA stand-ins and the photos are stock.

## Decisions made while building B1 (2026-09-28)

- **Catalogue v2 separates looks from products.**
  - The public `data/catalogue.json` (`version: 2`) now holds only the eight **looks** (`visuals`),
    without the old price bands.
  - The looks drive the swatches, the previews and the render prompts, and never produce a quantity or a
    price.
  - The server's map of looks is now `VISUALS` (core.js), matching the `visual_id` columns.
- **Manufacturers' products are server-only**, in `serverlib/wvroofing/products.json`. The plan had put
  them in the public catalogue. This change keeps draft figures off the public site, and the browser
  never needs them.
  - `catalogue.js` checks every entry when it loads. If any entry is faulty, no products are used and the
    problem is logged; the looks carry on regardless.
- **A specification** records:
  - coverage per m², either fixed or by pitch band (a band is [min, max); the top band includes its
    maximum);
  - the minimum pitch, the pack size and the default allowance;
  - optional figures per metre by edge kind;
  - the source URL and the date it was checked;
  - `status` (`draft` or `verified`, with `verified_by` and `verified_at`).

  Drafts produce figures only when the operator asks for them; customers get verified products only.
- **Quantities** (`quantities.js`, pure functions; the measurement is never changed):
  - **Faces and totals.**
    - Each face is worked out first, then the faces are added up for the product.
    - The allowance is applied once, to that total, and shown.
    - The total is rounded up once, to whole units and then packs.
  - **Face statuses.** `needs_pitch` (coverage depends on pitch and the pitch isn't known; no default is
    ever used), `below_min_pitch`, `outside_published_range`, `no_area`, `excluded`, and
    `no_verified_product`.
    - An estimate is `complete` only when every face in scope was estimated.
    - With a fixed coverage and an unknown pitch, a warning says to check the minimum pitch.
  - **Linear items.** Ridges, hips, valleys, eaves, verges and abutments come only from lengths entered
    for that kind, times a per-metre figure. Otherwise each is listed as not included, with the reason.
  - **Never estimated online:** flashings, gutters, fixings, underlay and battens. Battens would need a
    length worked out from the area, which the rules forbid.
- **Dev server.** It now reloads `catalogue.json` with the server modules, so catalogue edits apply
  without a restart.

## Decisions made while building B2 (2026-09-28)

- **Measurements** are in `wvr_measurements` (migration 0007).
  - A measurement is never edited: a new one supersedes the old, which points at its replacement
    (`superseded_by`).
  - A new or cleared address supersedes all the project's measurements.
  - The operator's scope correction sends the current one back to `needs_review` (reason
    `ambiguous_scope`) and hides it, until it's approved again.
- **Geometry** (`measure/geometry.js`).
  - **Faces** are checked: unique ids, areas above 0, pitch 0–75° or unknown, azimuth 0–360°, at most 50
    faces.
  - **Surface area** is worked out only as plan area ÷ cos(pitch). An area the source already gave on the
    slope is used as it is and never corrected again. Missing values stay null, never 0.
  - **Edges** are entered lengths of a known kind, on known faces.
  - **Storage and display.** Full precision is stored; the customer sees whole m² and whole degrees.
  - **Labels** read "Measured by the roofer from `<method>` on `<date>`", never "aerial".
- **Assessment** gives the reasons for review:
  - `pitch_unknown` or `missing_faces` for faces without an area;
  - face flags (`tree_cover`, `unreliable_pitch`, `complex_geometry`);
  - `no_rooftop_coordinate`, for sources that find the roof from map coordinates;
  - `shared_roof` and `ambiguous_scope`, from the customer's answers, unless the method is a site
    survey, which settles the scope;
  - `source_outdated`, for sources more than 5 years old.

  No reasons means `indicative_available`.
- **The customer's estimate** (`GET projects/:id/estimate?visual=`) has four states:
  - `unavailable`: nothing measured, with the brief's list of what isn't included.
  - `processing`: measured but not yet approved, or back for review.
  - `measured_not_shown`: approved but not made visible. This is the plan's "figures will be in your
    quotation", for sources without display rights.
  - `indicative_available`: whole-m² area, the pitches, who measured it from what and when, and
    quantities from verified products for the chosen look.

  The "not included" line comes from the estimate. It never shows a draft. It asks about extensions or
  changes since the source year.
- **No separate quantity-estimate table.** Estimates are recalculated from the current measurement and the
  product's specification version, so they're always consistent. What the customer could see when they
  sent an enquiry is kept in the enquiry's snapshot (`measurement` and `quantities`), only if they could
  see it.
- **No `measurement/request` route.** The estimate step's "Request a survey" is the enquiry itself.
  Contact details are needed to arrange a visit, and the enquiry already records the request.
