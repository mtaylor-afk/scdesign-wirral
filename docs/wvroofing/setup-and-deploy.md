# WV Roofing: set-up and deploy (v1, 2026-09-28)

## How it's hosted

WV Roofing borrows SC Design's hosting and shares nothing else with it.

- **The pages** are in `public/WVROOFING/`, served by Cloudflare Pages at
  `https://scdesignwirral.co.uk/WVROOFING/`.
- **The API** is a single Vercel function, `api/wvroofing/app.js`, on project `scdesign-wirral`.
  - `vercel.json` rewrites `/api/wvroofing/*` to it.
  - It has 300 seconds and includes the migrations (`db/wvroofing/**`).
  - `api/` holds 11 files. Never add a 12th for WV Roofing: Hobby allows 12 functions.
- **The daily tidy-up** runs at 03:17 UTC as `GET /api/wvroofing/cron/daily`, set in `vercel.json` `crons`.
- **Storage**: Neon Postgres and a private Vercel Blob store, both in London, used only by WV Roofing.
  - Migrations apply themselves on first use.
  - `/api/wvroofing/health` reports the schema version.

## Run it locally (the labelled test environment)

```
npm install                                   # once
node scripts/wvroofing/dev-server.mjs         # http://localhost:8772/WVROOFING/
```

**Stand-ins.** The dev server runs with `WVR_ENV=test`, and production refuses every one of these:

- **Database**: PGlite in memory, so data resets on a restart; `WVR_PGLITE_DIR` keeps it on disk.
- **Storage**: a local folder.
- **OpenAI**: paints the roof colour. `--fixture timeout|5xx|refused|…` tries the failure states.
- **Email**: goes to a console outbox; nothing is sent.
- **Addresses**: a street of test addresses at any postcode.
  - Ideal Postcodes' own test postcodes behave as they do there: `ID1 KFA` isn't found; `ID1 CLIP` and
    `ID1 CHOP` are unavailable.
- **Satellite view**: a drawn stand-in.

**Operator screen.** `http://localhost:8772/WVROOFING/operator/`. It logs in with `TEST_OPERATOR_PASSWORD`
from `serverlib/wvroofing/auth.js`, which is refused anywhere else.

**The checks (all must pass before a commit):**

```
npm run wvr:test        # node:test suites
npm run wvr:check       # JSDoc type check of the WV server code
npm run wvr:selftest    # maths, compositing and handler self-test
npm run wvr:qa          # headless browser pass (dev server running)
npm run validate        # SC's own build and checks; then: git restore -- src/lib/projects-cms.ts
npx eslint public/WVROOFING api/wvroofing serverlib/wvroofing scripts/wvroofing
```

## Going live: the owner's steps, in order

None of these involve pasting anything into a chat. Keys, secrets and the password go straight into
Vercel.

**Step 0: Vercel checks.** In project `scdesign-wirral`, go to **Settings**.

- Note the plan (Hobby or Pro), whether **Fluid compute** is on, and the **Function Region**.
- Set **Node.js Version** to **24.x**: Vercel deprecates Node 20 on 1 October 2026.

**Step 1: storage.**

1. **Storage → Create → Blob**:
   - name `wvroofing`, access **Private**, region **London**;
   - connect it to Production and Preview.
2. **Marketplace → Neon**:
   - free plan, name `wvroofing`, region **Europe (London)**;
   - connect it.

**Step 2: core variables** (Production), then **Redeploy**.

| Variable | What to put | How to make it (on your own computer) |
|---|---|---|
| `WVR_SESSION_SECRET` | 64 random hex characters | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CRON_SECRET` | Another random string | The same command again |
| `WVR_OPERATOR_PASSWORD_HASH` | The `scrypt:…` line | `node scripts/wvroofing/operator-hash.mjs` (see `operator-guide.md`) |
| `WVR_LEAD_TO` | The inbox for enquiry emails | n/a |
| `WVR_MAIL_FROM` (optional) | An alias on the iCloud account that names "WV Roofing" | n/a |
| `WVR_DAILY_BUDGET_USD` | `5` | n/a |

**Step 3: push the held work.** Increments A2–A7 are committed on `feat/wvroofing` but held until steps 1
and 2 are done (push gate D17). Pushing them earlier would turn today's working live visualiser into "not
available". Push them with the Desktop **PUSH WV ROOFING.cmd**:

- it fetches, rebases, and pushes `HEAD:main`;
- you paste the GitHub token when it asks; Claude never types tokens;
- never force-push.

Then run the live checks below.

**Step 4: switch on one capability at a time.**

A key alone turns nothing on. Each capability also needs its switch set to `on`, and its rights resolved in
`permissions.js`. That is recorded in `permissions-record.md`.

| Capability | Key(s) | Switch |
|---|---|---|
| Enquiry emails | `WVR_LEAD_TO` (and the existing `SMTP_USER`/`SMTP_PASS`) | `WVR_CAP_ENQUIRY_DELIVERY=on` |
| Address search | `WVR_IDEAL_POSTCODES_KEY` (set a daily lookup limit in their dashboard) | `WVR_CAP_ADDRESS_LOOKUP=on` |
| Satellite view | `WVR_GOOGLE_MAPS_STATIC_KEY` and `WVR_GOOGLE_MAPS_SIGNING_SECRET` (URL signing on, a daily quota and a budget alert) | `WVR_CAP_AERIAL_DISPLAY=on` |
| Photo-real renders | `WVR_OPENAI_API_KEY`, from a "WV Roofing concept" project with a hard monthly budget | `WVR_CAP_IMAGE_GENERATION=on` |
| Roof measurement (the roofer's own, shown once approved) and customers' plans and drawings | none beyond storage | `WVR_CAP_ASSISTED_MEASUREMENT=on` |

Photo uploads and enquiry storage come on by themselves once Neon, Blob, `WVR_SESSION_SECRET` and
`CRON_SECRET` are all present.

**Step 5: A8, live integration.** Tell Claude which keys are in, and OK the spend. Claude then runs:

- the render benchmark (at most 16 renders, about $3);
- pre-rendering the sample houses (at most 24 renders, about $2–3);
- one real enquiry email, flagged before it's sent.

## After every push: live checks

1. The Cloudflare Pages and Vercel deployments are green.
2. `https://scdesign-wirral.vercel.app/api/wvroofing/health` shows:
   - `environment: "production"`;
   - schema version 6;
   - the expected capability states;
   - no secrets.
3. `https://scdesignwirral.co.uk/WVROOFING/` loads with `X-Robots-Tag: noindex` and the content security
   policy.
4. SC Design's home page returns 200, and one SC API still works.
5. `node scripts/wvroofing/qa.mjs --base https://scdesignwirral.co.uk --live`. On a deployed copy it
   fills in the enquiry forms but never sends them, makes no renders and doesn't log in to the operator
   screen. The one test photo it uploads is deleted again at the end.
6. Once storage is live, a smoke test on the live site: a sample photo, mark the roof, a render only if
   allowed, then **Delete my photo and project**.
7. Matthew logs in to `/WVROOFING/operator/` himself and checks the **Costs** tab. "Daily tidy-up" shows a
   run within a day of `CRON_SECRET` being set.

## Switching off and rolling back

- **One capability**: set its `WVR_CAP_…` switch to anything but `on`, then redeploy.
- **Every paid call at once**: `WVR_ENABLED=0`, then redeploy.
- **The API code**: in Vercel, promote the previous production deployment (instant rollback).
- **The pages**: in Cloudflare Pages, roll back to the previous deployment.
- **Git**: revert the commit and push. Never force-push.
