# WV Roofing v02 — documentation

The v02 build turns the concept visualiser into a persistent application: postcode-first journey, stored
enquiries, durable render jobs, an operator screen, and (Release B) honest measurement and material estimates.
The overview of the concept site itself is in `docs/WVROOFING.md`.

| File | What |
|---|---|
| `decisions.md` | Decision record (D1–D17) with evidence |
| `permissions-record.md` | Generated from `serverlib/wvroofing/permissions.js`: what each provider's terms allow |
| `wvroofing.env.example` | Every environment variable, names only |
| `operator-guide.md` | The operator screen: setting the password, enquiries, search, scope corrections, renders to check, costs, deleting |
| `handover-2026-09-28-v2.md` | **Current.** Where things stand after Release B's required increments, in the brief's status words; commits; owner actions; flags; the test record |
| `handover-2026-09-28-v1.md` | The same at the end of Release A's A7 (kept) |
| `supplier-enquiries.md` | Draft enquiries for Matthew to send: Bluesky, Getmapping, Vexcel, Google (Solar API); and what to do if one says yes |
| `setup-and-deploy.md` | Running it locally, the owner's go-live steps, pushing, live checks, switching off and rolling back |
| `privacy-record.md` | What is processed, lawful bases, the legitimate interests assessment, processors and transfers, requests |
| `retention.md` | Every retention period (from `retention.js`), deletion on request, copies outside our control |
| `cost-model.md` | Unit costs, the spending controls and their defaults, worst cases, typical costs |
| `screens/` | Screenshots from the test environment (QA run) |
| `version-2.md` | Version 2 at `/WVROOFING/2/` ("Rain Later", the weather report): an on-device Roof Cam with one-tap roof finding; version 1 is unchanged |

Earlier handover versions are kept; a new version is a new file.

## Status by increment

| Increment | State |
|---|---|
| A1 Foundations and the function swap | Live (commit 110432b, verified 2026-09-28) |
| A2 Projects, uploads, photo pipeline, CSP, retention | Built and tested locally; on `main` since 2026-09-29, pushed ahead of storage. Uploads and saving switch on by themselves once Neon, Blob, `WVR_SESSION_SECRET` and `CRON_SECRET` are all set |
| A3 Durable render jobs, server compositing, budget ledger | Built and tested locally against the OpenAI stand-in; on `main` since 2026-09-29, waiting for storage like A2. Live renders also need the OpenAI key and `WVR_CAP_IMAGE_GENERATION=on` |
| A4 Enquiries saved first, notified second | Built and tested locally (test outbox, no email sent); on `main` since 2026-09-29, waiting for storage like A2. Emails also need `WVR_LEAD_TO` and `WVR_CAP_ENQUIRY_DELIVERY=on` |
| A5 Journey: your home first, resume, estimate and enquiry steps, no prices | Built and tested locally against the address and satellite stand-ins; on `main` since 2026-09-29, waiting for storage like A2. Live lookups need `WVR_IDEAL_POSTCODES_KEY` + `WVR_CAP_ADDRESS_LOOKUP=on`; the satellite view needs the Google key, the signing secret and `WVR_CAP_AERIAL_DISPLAY=on` |
| A6 Operator screen | Built and tested locally with the test password; on `main` since 2026-09-29, waiting for storage like A2. Live use needs `WVR_OPERATOR_PASSWORD_HASH` (made with `scripts/wvroofing/operator-hash.mjs`) |
| A7 Retention, search for data requests, costs, handover v1 | Built and tested locally; on `main` since 2026-09-29, waiting for storage like A2. The daily tidy-up needs `CRON_SECRET` |
| A8 Live integration | Waits for the owner steps in `setup-and-deploy.md` (storage, secrets, keys) and his OK on spend |
| B1 Catalogue v2 and quantities | Built and tested locally; on `main` since 2026-09-29, waiting for storage like A2. Looks in the public catalogue, products server-only (nine draft specifications from manufacturers' datasheets, one or more per look). None is verified yet, so no quantities reach customers |
| B2 Measurement core and the estimate step | Built and tested locally; on `main` since 2026-09-29, waiting for storage like A2 |
| B3 Assisted measurement | Built and tested locally; on `main` since 2026-09-29, waiting for storage like A2. The roofer enters, approves and shows measurements (Hover and desk estimates stay hidden); customers add plans and drawings; Hover template. B3b (OS reference panel) not built: optional |
| B4 Automatic measurement as honest stubs, release checks | Built and tested locally; on `main` since 2026-09-29, waiting for storage like A2. Automatic measurement stays disabled (no licensed provider); the measurement switch is enforced; permissions record complete; supplier enquiries drafted |
| B5 Desk-measure tool (optional) | Not started: needs a separate approval and 20–30 reference properties |

## Commands

```
node scripts/wvroofing/dev-server.mjs      # local test environment on http://localhost:8772/WVROOFING/
npm run wvr:test                           # node:test suites (PGlite, local storage)
npm run wvr:check                          # JSDoc type check of the WV server code
npm run wvr:selftest                       # maths, compositing and handler self-test
npm run wvr:qa                             # headless browser pass (needs the dev server running)
node scripts/wvroofing/gen-docs.mjs        # regenerate permissions-record.md
```
