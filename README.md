# SC Design & Construction Ltd — website + AI Extension Concept Visualiser

Premium, mobile-first website for **SC Design & Construction Ltd** (Sean Corser, Wallasey/Wirral),
an **architectural design** practice (design only — no construction), plus an AI "Extension Concept
Visualiser" lead magnet.

> **Legal note (Architects Act 1997):** the bare title *"architect"* is protected and may only be
> used by an ARB-registered person. Copy leads with "architectural design / drawings". Confirm
> Sean's ARB status before using the bare title anywhere.

## Stack (verified June 2026)

- **Next.js 16** (App Router, TypeScript, Tailwind **v4**, ESLint)
- **Vercel** hosting
- **Supabase** — leads, visualiser jobs, rate-limit store, private results bucket (service-role key, **server-only**)
- **Resend** — transactional lead emails (abstracted behind `src/lib/email.ts`)
- **Plausible** — consent-gated, cookieless analytics
- **Cloudflare Turnstile** — spam protection
- **Google Gemini** (`gemini-2.5-flash-image`) — image-to-image concept generation
- **Sharp 0.34** — watermark + EXIF strip (Node.js runtime only)

## Getting started

```bash
cp .env.example .env.local   # fill in what you have (all optional in dev)
npm install
npm run dev                  # http://localhost:3000
```

Everything degrades gracefully when env vars are missing:

- **No Supabase** → leads/jobs are logged, rate-limit uses an in-memory fallback (NOT production-safe), visualiser returns the result as a data URL.
- **No Resend** → email sends are skipped (logged).
- **No `GEMINI_API_KEY`** → the visualiser returns a **watermarked echo** of the upload so the full UX (watermark, download, send-to-Sean) still works.
- **No Turnstile** → spam check is skipped in dev.

## Validation

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # production build
npm run validate    # all three in sequence
npm run test:e2e    # Playwright smoke tests (desktop + mobile)
```

## Environment variables

See `.env.example`. Key ones for production:

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, sitemap, OG |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | DB + storage (service key **server-only**) |
| `RESEND_API_KEY` / `LEAD_NOTIFICATION_EMAIL` | Lead emails to Sean |
| `GEMINI_API_KEY` / `GEMINI_IMAGE_MODEL` | Visualiser model |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Spam protection |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Consent-gated analytics |
| `VISUALISER_PER_IP_CAP` / `VISUALISER_DAILY_CAP` / `VISUALISER_RESULT_EXPIRY_DAYS` | Visualiser limits + retention |

## Supabase setup

Run the migrations in `supabase/migrations/` (SQL editor or CLI):

1. `0001_init.sql` — `leads`, `visualiser_jobs`, `visualiser_leads`, `visualiser_rate_limits` (RLS on, no policies → service-role only).
2. `0002_storage.sql` — private `visualiser-results` bucket.

## Visualiser architecture

Browser → **Node.js Route Handler** (`/api/visualise`) → validate + Turnstile + shared-store rate
limit → Gemini image edit → **Sharp** (resize / watermark bottom-right / strip EXIF) → Supabase
private bucket → short-lived signed URL → result UI (before/after, download, send-to-Sean).

- The **source image is never persisted** — held in memory only.
- Results expire after `VISUALISER_RESULT_EXPIRY_DAYS` (default 7).
- Sharp is a native addon → the route is pinned to `runtime = "nodejs"` (never Edge).

## Deployment (Vercel)

1. Import the `/sc` directory as the project root.
2. Set the env vars above (Production + Preview).
3. Deploy. Sitemap at `/sitemap.xml`, robots at `/robots.txt`.

## Pre-launch checklist (outstanding client decisions)

- [ ] Confirm ARB registration status (use of the bare title "architect").
- [ ] Confirm Companies House number (then set `companiesHouseNumber` in `src/lib/site.ts`).
- [ ] Decide whether to publish the CH45 6TR address (`addressIsPublic` in `src/lib/site.ts`).
- [ ] Supply real project photos to replace clearly-marked placeholders.
- [ ] Confirm Resend sender domain + verify it.
- [ ] Confirm Plausible domain + Turnstile keys.
- [ ] Supply any permissioned testimonials.

## Project structure

```
src/
  app/            App Router pages + api/ route handlers + sitemap/robots/og
  components/     ui/ (primitives) · layout/ (nav, footer) · visualiser/
  lib/            site, services, locations, faqs, seo, supabase, email, ratelimit, visualiser
supabase/migrations/   SQL schema + storage bucket
tests/e2e/        Playwright smoke tests
```
