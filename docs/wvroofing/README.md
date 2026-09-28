# WV Roofing v02 — documentation

The v02 build turns the concept visualiser into a persistent application: postcode-first journey, stored
enquiries, durable render jobs, an operator screen, and (Release B) honest measurement and material estimates.
The overview of the concept site itself is in `docs/WVROOFING.md`.

| File | What |
|---|---|
| `decisions.md` | Decision record (D1–D17) with evidence |
| `permissions-record.md` | Generated from `serverlib/wvroofing/permissions.js`: what each provider's terms allow |
| `wvroofing.env.example` | Every environment variable, names only |

Handover files (`handover-<date>-vN.md`, `setup-and-deploy.md`, `operator-guide.md`, `privacy-record.md`,
`cost-model.md`, `retention.md`) arrive with the increments that need them.

## Status by increment

| Increment | State |
|---|---|
| A1 Foundations and the function swap | Live (commit 110432b, verified 2026-09-28) |
| A2 Projects, uploads, photo pipeline, CSP, retention | Built and tested locally; goes live once Neon + Blob are connected (push gate D17) |
| A3 Durable render jobs, server compositing, budget ledger | Built and tested locally against the OpenAI stand-in; held with A2. Live renders also need the OpenAI key and `WVR_CAP_IMAGE_GENERATION=on` |
| A4 Enquiries saved first, notified second | Built and tested locally (test outbox, no email sent); held with A2. Emails also need `WVR_LEAD_TO` and `WVR_CAP_ENQUIRY_DELIVERY=on` |
| A5–A8, B1–B5 | Not started |

## Commands

```
node scripts/wvroofing/dev-server.mjs      # local test environment on http://localhost:8772/WVROOFING/
npm run wvr:test                           # node:test suites (PGlite, local storage)
npm run wvr:check                          # JSDoc type check of the WV server code
npm run wvr:selftest                       # maths, compositing and handler self-test
npm run wvr:qa                             # headless browser pass (needs the dev server running)
node scripts/wvroofing/gen-docs.mjs        # regenerate permissions-record.md
```
