# WV Roofing v02 — documentation

The v02 build turns the concept visualiser into a persistent application: postcode-first journey, stored
enquiries, durable render jobs, an operator screen, and (Release B) honest measurement and material estimates.
The overview of the concept site itself is in `docs/WVROOFING.md`.

| File | What |
|---|---|
| `decisions.md` | Decision record (D1–D20) with evidence; D18–D20 (2026-10-03) are the no-set-up admin on SC Design's Supabase and the 222 / 333 login |
| `permissions-record.md` | Generated from `serverlib/wvroofing/permissions.js`: what each provider's terms allow |
| `wvroofing.env.example` | Every environment variable, names only |
| `operator-guide.md` | The admin screen (formerly "the operator screen"): its three addresses, the site switch, Overview, Enquiries, Contacts and the spreadsheet download, every customer photo from both sites (Photos), search, scope corrections, renders to check, costs, deleting |
| `handover-2026-09-28-v2.md` | **Current.** Where things stand after Release B's required increments, in the brief's status words; commits; owner actions; flags; the test record |
| `handover-2026-09-28-v1.md` | The same at the end of Release A's A7 (kept) |
| `supplier-enquiries.md` | Draft enquiries for Matthew to send: Bluesky, Getmapping, Vexcel, Google (Solar API); and what to do if one says yes |
| `setup-and-deploy.md` | Running it locally; the two storage modes; going live with nothing to set up (since 2026-10-03: push, then log in with 222 / 333); the optional route to a database of its own (the Desktop **SET UP WV ROOFING ADMIN**, its result codes, and the steps by hand); live checks, switching off and rolling back |
| `privacy-record.md` | What is processed, lawful bases, the legitimate interests assessment, processors and transfers, requests |
| `retention.md` | Every retention period (from `retention.js`), deletion on request, copies outside our control |
| `cost-model.md` | Unit costs, the spending controls and their defaults, worst cases, typical costs |
| `screens/` | Screenshots from the test environment (QA run) |
| `version-2.md` | Version 2 at `/WVROOFING/2/` ("Rain Later", the weather report): a Roof Cam with one-tap roof finding that draws the roofs on the device; since 2026-10-01 it saves the visitor's photo and enquiries to the same store as version 1, shown in the admin screen, which has its own version 2 page at `/WVROOFING/2/admin/` |

Earlier handover versions are kept; a new version is a new file.

## Status by increment

**2026-10-03: storage no longer waits for anyone.** Where a row below says "waiting for storage", that wait
ends with the push of the 2026-10-03 commit. The live site then runs in snapshot mode on SC Design's
Supabase project (decisions D18–D20), with nothing to set up, and the admin login is 222 / 333. The keys
and switches each row mentions are still needed for emails, renders, address search and the satellite view.

| Increment | State |
|---|---|
| A1 Foundations and the function swap | Live (commit 110432b, verified 2026-09-28) |
| A2 Projects, uploads, photo pipeline, CSP, retention | Built and tested locally; on `main` since 2026-09-29, pushed ahead of storage. Uploads and saving switch on by themselves once Neon, Blob, `WVR_SESSION_SECRET` and `CRON_SECRET` are all set |
| A3 Durable render jobs, server compositing, budget ledger | Built and tested locally against the OpenAI stand-in; on `main` since 2026-09-29, waiting for storage like A2. Live renders also need the OpenAI key and `WVR_CAP_IMAGE_GENERATION=on` |
| A4 Enquiries saved first, notified second | Built and tested locally (test outbox, no email sent); on `main` since 2026-09-29, waiting for storage like A2. Emails also need `WVR_LEAD_TO` and `WVR_CAP_ENQUIRY_DELIVERY=on` |
| A5 Journey: your home first, resume, estimate and enquiry steps, no prices | Built and tested locally against the address and satellite stand-ins; on `main` since 2026-09-29, waiting for storage like A2. Live lookups need `WVR_IDEAL_POSTCODES_KEY` + `WVR_CAP_ADDRESS_LOOKUP=on`; the satellite view needs the Google key, the signing secret and `WVR_CAP_AERIAL_DISPLAY=on` |
| A6 Operator screen | Built and tested locally with the test password; on `main` since 2026-09-29, waiting for storage like A2. Live use needs `WVR_OPERATOR_PASSWORD_HASH` (set by the Desktop **SET UP WV ROOFING ADMIN**, or made by hand with `scripts/wvroofing/operator-hash.mjs`). Since 2026-10-01 it is "the admin screen", with Overview and Contacts tabs and pages at `/WVROOFING/admin/` and `/WVROOFING/2/admin/` |
| A7 Retention, search for data requests, costs, handover v1 | Built and tested locally; on `main` since 2026-09-29, waiting for storage like A2. The daily tidy-up needs `CRON_SECRET` |
| A8 Live integration | Waits for the owner steps in `setup-and-deploy.md` (storage, secrets, keys) and his OK on spend |
| B1 Catalogue v2 and quantities | Built and tested locally; on `main` since 2026-09-29, waiting for storage like A2. Looks in the public catalogue, products server-only (nine draft specifications from manufacturers' datasheets, one or more per look). None is verified; since 2026-10-18 customers see the draft figures, each marked as unchecked (`WVR_CUSTOMER_DRAFTS=off` for verified-only) |
| B2 Measurement core and the estimate step | Built and tested locally; on `main` since 2026-09-29, waiting for storage like A2 |
| B3 Assisted measurement | Built and tested locally; on `main` since 2026-09-29, waiting for storage like A2. The roofer enters, approves and shows measurements (Hover and desk estimates stay hidden); customers add plans and drawings; Hover template. B3b (OS reference panel) not built: optional |
| B4 Automatic measurement as honest stubs, release checks | Built and tested locally; on `main` since 2026-09-29, waiting for storage like A2. Automatic measurement stays disabled (no licensed provider); the measurement switch is enforced; permissions record complete; supplier enquiries drafted |
| B5 Desk-measure tool (optional) | Not started: needs a separate approval and 20–30 reference properties |

## The admin pages (2026-10-01)

One admin screen, one login (username 222, password 333 since 2026-10-03), three addresses (see
`operator-guide.md`):

| Address | Starts on | Look |
|---|---|---|
| `/WVROOFING/admin/` | Version 1 | Version 1 |
| `/WVROOFING/2/admin/` | Version 2 | Version 2 (the Roof Cam's weather report) |
| `/WVROOFING/operator/` | Both sites | Version 1; kept for old bookmarks |

Each public page links to its version's admin page with a small **Admin** link at the end of the footer.
The three pages are generated from one template by `scripts/wvroofing/gen-admin.mjs`.

## Commands

```
node scripts/wvroofing/dev-server.mjs      # local test environment on http://localhost:8772/WVROOFING/
npm run wvr:test                           # node:test suites (PGlite, local storage)
npm run wvr:check                          # JSDoc type check of the WV server code
npm run wvr:selftest                       # maths, compositing and handler self-test
npm run wvr:qa                             # headless browser pass (needs the dev server running)
node scripts/wvroofing/gen-docs.mjs        # regenerate permissions-record.md
node scripts/wvroofing/gen-admin.mjs       # regenerate the three admin pages (--check: fail if out of date)
node scripts/wvroofing/gen-pglite-base.mjs # remake snapshot mode's starting database after a new migration or
                                           # PGlite upgrade (--check: fail if out of date; a test runs it)
node scripts/wvroofing/setup-vercel.mjs    # NOT NEEDED since 2026-10-03 (snapshot mode). Matthew only, and
                                           # only to move to a database of its own (ask Claude first: the
                                           # saved rows need copying). Desktop: SET UP WV ROOFING ADMIN.cmd
node scripts/wvroofing/operator-hash.mjs   # Matthew only: print the admin password's hash (the manual way)
```
