# SC — Project Rules for Claude

This is an **independent project** that lives in the `/sc/` folder. It is
unrelated to the TailoredQuote application that occupies the rest of this
repository — the repo is only being used here as a convenient testing host.

> **NOTE (standalone repo, verified June 2026):** This GitHub repo
> `mtaylor-afk/scdesign-wirral` is the **live standalone site** — there is no
> `/sc/` subfolder or TailoredQuote monorepo in this clone. The older
> "Deployment / GitHub Pages / `sc/site` / publish-to-branch" notes further
> down are monorepo history and do **not** apply here; use the deployment
> section immediately below.

> **🔴 COMMIT-TARGET RULE — read me first (standing, this repo & this chat):**
> Every commit for SC Design work — **including any "commit to CLAUDE.md"
> request** — targets **THIS repo** (`mtaylor-afk/scdesign-wirral`, branch
> `main`). **NEVER** commit SC changes, and never commit a CLAUDE.md edit, to the
> **Sales Dashboard** repo (`…\Sales Dashboard\Claude`) — that is merely the
> directory a chat may happen to run from; it has **no** GitHub remote and its
> CLAUDE.md is unrelated. If "commit to claude.md" is ever ambiguous, it ALWAYS
> means **this** file in the SC design repo.

## Working process & deployment (this clone)

- **Hosting:** Cloudflare Pages, which builds from `main` on every push
  (`npm run build` → static export in `out/`). Live at
  https://scdesignwirral.co.uk — deploys land in ~15–60s.
- **Local clone:** `C:\dev\scdesign-wirral` (kept outside OneDrive). Node 20
  (matches `.nvmrc`).
- **Update workflow (simple edits):** for text / colour / content changes →
  edit → `git commit` → `git push origin main`. Cloudflare rebuilds and
  deploys automatically (~30s). No local rebuild or live-site polling is
  needed for these.
- **Build-check first (`npm run build`)** only for structural changes: new or
  changed components, routing/config, or dependencies. If a build ever fails,
  Cloudflare keeps the **last good version** live, so a bad push never takes
  the site down.

## Standing authorization — no approval prompts, auto-continue (MANDATORY)

Matthew has granted **full, permanent, standing approval** for this project. This
rule applies to **every** chat opened against this repo and its directly-related
backend (the `QCbuild1` / `q-cbuild1.vercel.app` Vercel project that hosts SC's
`sc-enquiry` and visualiser endpoints):

- **Treat ALL access as automatically granted.** Never ask Matthew to approve or
  grant access to: read / create / edit / move local files (anywhere on this
  machine, including related repos like `C:\dev\QCbuild1`), run the commands a
  task needs, do online research, or `git commit` / `git push` / deploy his own
  repos and sites. Just do it and report.
- **Never pause for a decision you can reasonably make yourself.** Pick a sensible
  default, proceed, and state what you chose. Asking for sign-off slows the build —
  do not do it.
- **Auto-continue always** — work multi-step and multi-repo tasks start-to-finish
  without stopping for confirmation; report what was done at the end.
- The ONLY actions to flag rather than fire silently (externally consequential and
  irreversible): sending emails/messages on his behalf, permanently deleting data,
  changing who can access a resource, or financial transactions. Everything else:
  proceed without asking.

> Enforcement: the permission system is already bypassed on this machine via
> `.claude/settings.local.json` (`defaultMode: bypassPermissions`), so no approval
> prompts fire here. An agent is **not allowed to write/widen `.claude/settings.json`
> itself** (a security boundary), so to make this portable across machines Matthew
> adds it himself via `/permissions` or by editing `.claude/settings.json`. This
> prose is the binding behavioural rule regardless — follow it in every session.

**How Matthew grants full no-prompt access (an agent CANNOT set this itself — it's
a deliberate security boundary that blocks self-widening of permissions):**

1. The strongest, persistent setting already lives in `.claude/settings.local.json`:
   `"permissions": { "defaultMode": "bypassPermissions" }` — view / edit / create /
   delete any file **and** run commands with zero approval prompts, every session
   in this folder. To (re)enable: open that file (or `.claude/settings.json`),
   confirm that line, save, and start a fresh session (settings load at start).
2. For a single session only: press **Shift+Tab** in the prompt until the footer
   shows **"accept edits on" (⏵⏵)** — auto-approves file edits for that session.
3. `/permissions` is the GUI for the same thing, but only opens in a standalone
   `claude` terminal, not inside an active chat — so the settings-file edit is the
   most direct route.

Even with bypass on, only the four genuinely irreversible external actions (sending
messages as Matthew, deleting data, access changes, financial) get a one-line
heads-up; everything else just proceeds.

## Recent changes — lead capture, backup email, favicon (June 2026)

Logged for future sessions. Commits on `main` unless noted:

- **Low-friction lead capture, site-wide** (`fda05e3`) — "capture first, qualify
  second". Single-page contact form (required: name + phone-OR-email + consent;
  optional: project type/postcode/message; submit "Send enquiry to Sean"); two-tier
  "What to send Sean" (minimum vs helpful extras) on service/guide pages; softened
  CTAs (central `cta.primary.label` = "Send Sean your idea"); cost-estimate handoff
  (still ungated) that carries `calculator_*` context to `/contact`; server-side
  visualiser concept handoff with required consent.
- **Enquiry endpoint relaxed** — `QCbuild1/api/sc-enquiry.js` (`c8c7dd1`, branch
  `claude/quote-builder-wv-construction-dwtaw` — separate repo) now accepts
  name + (phone OR email) + consent; phone/postcode optional.
- **Server-side backup email** (`e2fb46f`) — `api/sc-enquiry-backup.js` now emails
  Sean via `serverlib/icloud-mailer.js` (nodemailer/iCloud SMTP — the TailoredQuote
  framework) to gmail+icloud (Reply-To = enquirer) after the SQL insert. Forms
  count a submit as successful if the primary endpoint **or** the backup email
  succeeds; `mailto:` only as a true last resort (To + CC, not a comma-joined To).
  **Action: set `SMTP_USER`/`SMTP_PASS` (+ optional `SC_MAIL_FROM`/
  `SC_LEAD_RECIPIENTS`) in the scdesign-wirral Vercel project** (see `.env.example`).
  Without them, SQL capture + the external endpoint still work; only the extra
  backup email is skipped.
- **Correct-logo favicon** (`13b7c83`) — `public/favicon.ico` (7 sizes) +
  `public/apple-touch-icon.png` (180×180), wired via `metadata.icons` in
  `layout.tsx` to emit `<link rel="icon" href="/favicon.ico" sizes="any">` and
  `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`. Removed the old
  placeholder `app/icon.svg` (browsers preferred the SVG over the `.ico`).

## Scope & Isolation (MANDATORY)

1. **This `CLAUDE.md` governs the `/sc/` project ONLY.** It does not apply to
   anything outside the `/sc/` folder.
2. **Never edit the root `/CLAUDE.md`** (the TailoredQuote project rules) or any
   file outside `/sc/` as part of work on this project. The TailoredQuote rules
   do not apply here, and this project's rules do not apply there.
3. **Keep all SC work inside `/sc/`.** New files, assets, and subfolders for this
   project go under `/sc/`. Do not scatter SC files into the repo root.

## Working Conventions

- Branch: develop on `claude/sc-clause-file-9bP8D` (the current branch for this
  project) unless told otherwise.
- Commit messages: clear and descriptive; scope them to the `sc/` changes.
- Ask before making assumptions when a requirement is ambiguous.

## Project Notes

**Project:** Premium website for **SC Design & Construction Ltd** (Sean Corser, Wallasey/Wirral) + an AI "Extension Concept Visualiser" lead magnet.

> **Legal entity (confirmed June 2026):** Registered company **SC Design & Construction Ltd** — England & Wales, **company no. 11511225**, incorporated 10 Aug 2018, status **Active** (verified on the Companies House public register). `site.name` is the full legal name (footer copyright / legal pages / JSON-LD / OG siteName); `site.shortName` = "SC Design & Construction" is the display brand (nav logo + page-title suffixes, deliberately no "Ltd"). The **registered office** on the public register is in Liverpool (Seymour Chambers, 92 London Road, Liverpool, L3 5NW); the **published trading/contact address** is 20 Ripon Road, Wallasey, Wirral, CH45 6TR. (This REVERSES the earlier "sole trader, no Ltd" note that was previously here.) **Owner explicitly confirmed (June 2026) that the earlier "sole trader" description was their own mistake — the Ltd entity is SETTLED: do not re-question or revert it.**

### ⭐ FULL REDESIGN (June 2026) — branch `redesign`, SUPERSEDES the older notes below
A complete, conversion-led redesign was built on the **`redesign`** branch (Cloudflare **preview** deploys; cut over to `main` only on owner go/no-go). Where this conflicts with older notes, **this wins**:
- **Brand:** display name **"SC Design Wirral"** (`site.shortName`); legal `site.name` = "SC Design & Construction Ltd" kept for footer/legal/JSON-LD. Nav logo = `|SC` mark.
- **Design system:** red/cream/white tokens in `globals.css @theme` (`--color-accent-strong #9b1b1b` AA-safe, `--color-paper #f5efe5`). All components inherit it.
- **Credentials (CONFIRMED current June 2026):** Sean Corser **MCIAT — Chartered Architectural Technologist**, **BSc Architectural Science**, 15+ yrs design, 6 yrs prior on-site. In `site.credentials`; rendered in footer site-wide + hero + about + Person JSON-LD (`hasCredential`).
- **ARB-safety is now STRICT:** NEVER the bare title "architect" for Sean/SC. "Architectural technologist/designer/design/drawings" only. (The older "architect IS approved" line is **revoked** — the new client brief requires the protected-title-safe form. The `architect-vs-architectural-designer` guide uses "architect" only comparatively/educationally.)
- **Address is now PRIVATE:** `site.addressIsPublic = false`. The Wallasey trading address is **removed from all visible copy + JSON-LD** (no `PostalAddress` emitted). Only the **Liverpool registered office** (Seymour Chambers) + company no. remain, as the legally-required Ltd disclosure. Wallasey still appears only as a **served town**. (Revokes the older "address IS published" rule.)
- **Services reduced to 11:** removed permitted-development / LDC / conservation-area / planning-building-regulations **as services** (folded into guides; `public/_redirects` 301s the old `/services/*` URLs to the matching guides). `residential-design` renamed "Full Architectural Design Services" (slug kept). Added: front-porch-extension-design, bespoke-garden-room-design, change-of-use-applications, measured-building-surveys, concept-design-feasibility.
- **Lead capture is REAL (not mailto):** new multi-step **`EnquiryForm.tsx`** POSTs to an isolated serverless endpoint **`api/sc-enquiry.js`** (QCbuild1 repo, branch `claude/quote-builder-wv-construction-dwtaw`, live at `q-cbuild1.vercel.app/api/sc-enquiry`) which emails Sean instantly (reply-to = enquirer) + auto-acknowledges the enquirer; honeypot + rate-limit + optional Turnstile (`TURNSTILE_SECRET_KEY`); reuses the shared `icloud-mailer`; **nothing stored server-side**. Mailto fallback only if the POST fails. Endpoint override: `NEXT_PUBLIC_SC_ENQUIRY_ENDPOINT`. The old single-step `ContactForm.tsx` was deleted.
- **New pages/features:** `/homeowners-guide` (interactive house, `InteractiveHouse.tsx` + `lib/houseFeatures.ts`, England-only PD content), `/cost-estimate` (`CostEstimator.tsx`, in-browser NW £/m² ranges — estimate-only, no data sent), `/areas` "everywhere we work" coverage list (`lib/serviceAreas.ts`), `/portfolio` "Design visualisations" gallery of Sean's genuine renders (labelled "Concept"). Reviews via consent-gated **`ReviewsWidget`** (Featurable; `NEXT_PUBLIC_FEATURABLE_WIDGET_ID`).
- **Legal updated** for the new backend: privacy policy names processors (Cloudflare/Vercel/Apple iCloud/OpenAI/Featurable/Plausible) + describes the email-not-stored enquiry flow; cookie policy covers Featurable + Turnstile.
- **Projects case studies (LIVE):** `lib/projects.ts` now holds **6 real projects** from Sean's design pack (owner instruction "feature all") — 3 residential (rear extension/garden remodel with a real `hero-before`+`hero-after` pair, brick garden room, roof-lantern extension) + 3 commercial/conversion (single-storey commercial unit, chapel→gallery, **Rowlands pharmacy fit-out** — branded render, owner reviewing whether to name/genericise/remove). Route `app/projects/[slug]/page.tsx` renders a before/after slider when a real before photo exists, else a single "design visualisation" image; the `/projects` hub shows image-thumbnail cards (placeholders branch is now dead-but-kept); 6 URLs added to the sitemap. Copy is **honest scaffold** — general area only (`Wirral`/`North West`), no invented testimonials/dates/planning refs — owner is refining specifics via **`PROJECTS-QUESTIONS.txt`** (repo root).
- **LAUNCHED to production (June 2026):** cut over `redesign` → `main`; live on scdesignwirral.co.uk and verified end-to-end (multi-step form, 301 redirects, project pages, JSON-LD, no address leak). `main` and `redesign` kept in sync. **Remaining owner actions:** answer `PROJECTS-QUESTIONS.txt` (real project details + any completed-build photos), set `NEXT_PUBLIC_FEATURABLE_WIDGET_ID` + GBP Place ID, optionally `TURNSTILE_SECRET_KEY`.
- **QA verified:** `tsc` + `lint` 0 problems, 88-page build, ARB-safe sweep clean, 0 `PostalAddress`/`AggregateRating`, `_redirects` resolve, images carry width/height.

### 📊 ANALYTICS & ADMIN PORTAL (LIVE — Jun 2026) + STANDING RULE
First-party, **cookieless** analytics + a login-gated admin dashboard. **This supersedes the "DEFERRED — visitor/error logging + admin panel" note further down** (that work is now built and live).

**🔴 STANDING RULE — every page must send analytics, as standard. Applies to ALL future work on this site:**
- The tracker is **`<Analytics />` mounted in the root layout** (`src/app/layout.tsx`), so **every Next route inherits it automatically** — new pages added under `src/app/**` need **no extra work** to be tracked. **Never remove `<Analytics />` or `<ClickTracking />` from the root layout, and never add a separate root layout / route group that bypasses it.** After creating a new page, the only check is that it lives under the shared root layout (it will, by default).
- **The one case that needs manual work:** a standalone static page added under `public/**` (e.g. `public/foo.html`) is NOT wrapped by the React layout, so it must get the tracking beacon added by hand — a small `sendBeacon`/`fetch` POST to `${NEXT_PUBLIC_SC_ANALYTICS_BASE}/api/sc-analytics-collect` mirroring `Analytics.tsx`. (`public/admin/**` is deliberately EXCLUDED — the admin self-excludes and is its own app.)
- **New key actions** (a new button / form / CTA / tool) → fire `track('<event_name>', {…})` from `Analytics.tsx` / `ClickTracking.tsx` so they appear in the admin Events/Conversions reports.
- Pageviews appear in the admin within seconds — confirm a new page via **Traffic → Real-time**.

**How it's built (ALL SC-isolated from TailoredQuote / QCbuild1):**
- **Tracker:** `src/components/Analytics.tsx` (cookieless pageview on load + on route change + an `engaged` beacon for time-on-page/scroll) and `src/components/ClickTracking.tsx` (phone/email/whatsapp/cta/service/area/`form_submit`/`outbound_link` + the visualiser events). Endpoint base = `.env.production` **`NEXT_PUBLIC_SC_ANALYTICS_BASE`** (`https://scdesign-wirral.vercel.app`). **No cookies, no IP stored, no consent gate** (legitimate interest; cookieless). The consent banner / privacy / cookie pages were updated to describe it.
- **API:** Vercel project **`scdesign-wirral`** (separate from QCbuild1/TQ; prod `https://scdesign-wirral.vercel.app`). Functions in `api/`: `sc-analytics-collect` (public ingest), `sc-admin-login`, `sc-admin-logout`, `sc-admin-stats`. Shared code in **`serverlib/common.js`** (deliberately OUTSIDE `api/`). `vercel.json` uses **zero-config function routing** (`framework:null` + `outputDirectory:public` + `functions`) — do **NOT** switch to legacy `builds` (it deploys but won't route → 404). **Vercel Deployment Protection must stay OFF** (the site must reach the API; admin has its own login).
- **Data:** Supabase project **`sc-analytics`** (`https://yxapzkiodjecladjziom.supabase.co`), table `sc_events` (core columns + `props` jsonb; RLS on, service-role only). Cookieless daily-rotating salted visitor hash; IP never stored.
- **Admin app:** self-contained at `public/admin/` → **https://scdesignwirral.co.uk/admin/** (noindex + robots-disallowed). Login **222 / 333**. Side menu: Overview · Traffic (Trends/Pages/Sources/Locations/Devices/Engagement/Real-time) · Conversions (Events/Visualiser) · Reference (**Data available** — catalogue of every field + how to add reports). Inline SVG charts, no external deps.
- **Change the login:** edit `SC_ADMIN_PASS` / `SC_ADMIN_USER` in the Vercel project env vars (no code change). **Move the API domain:** update `API_BASE` in `public/admin/admin.js` + `NEXT_PUBLIC_SC_ANALYTICS_BASE`.
- **Vercel env vars (owner-set, NOT in repo):** `SC_SUPABASE_URL`, `SC_SUPABASE_SERVICE_ROLE_KEY`, `SC_ADMIN_USER`, `SC_ADMIN_PASS`, `SC_ADMIN_SESSION_SECRET`. **NOTE (Jun 2026):** a live test login with the long-documented **222 / 333** returned 401 — the live `SC_ADMIN_USER`/`SC_ADMIN_PASS` were changed at some point, so do **not** assume 222/333; only the owner has the current value.

### 🐞 ERROR LOGGING + LOGIN AUDIT + ALWAYS-LIVE ADMIN (LIVE — Jun 2026)
Site-wide client **error capture** + an admin **Error logs** view, an admin sign-in **audit trail**, and a hardened **no-cache** admin. Same first-party stack as the analytics above (same Vercel `scdesign-wirral` project, same Supabase `sc-analytics` project). **Supersedes the "error logging deferred / use Sentry" note below.**

**🔴 STANDING RULE — every page must capture errors, like analytics.** The tracker is **`<ErrorTracking />` mounted in the root layout** (`src/app/layout.tsx`, beside `<Analytics />`), so **every Next route is covered automatically** — new pages need no extra work. **Never remove it.** The one manual case mirrors analytics: a standalone `public/**` page isn't wrapped by the React layout (the admin app handles its own via `public/admin/error-capture.js`, tagged `surface:"admin"`).

**What's captured (every page):** uncaught JS errors, failed resource loads, unhandled promise rejections, React render crashes (`src/app/error.tsx` calls `reportError`), explicit **form-submit failures** (EnquiryForm + SendConceptForm both-failed/mailto branch), and `console.error`. Each row carries a **breadcrumb trail** (recent clicks / route changes / fetches / console) + device/geo/connection context, tagged `surface` = `public` | `admin`. Engine = **`src/lib/error-report.ts`** (`reportError` / `recordBreadcrumb` / `initErrorTracking`); fire-and-forget text/plain + `sendBeacon` (mirrors `enquiry-backup.ts`); de-dupes + caps + queues to stay volume-safe.

**Admin login audit:** `api/sc-admin-login.js` logs EVERY sign-in outcome (success / bad_credentials / rate_limited) server-side — time, IP-derived geo, device, attempted **username (NEVER the password)** — into the same `sc_errors` table under types `login_success` / `login_failed`. A wrong password is a normal handled 401, NOT a JS error, so it only appears under **Login attempts**, never under Error logs (this confused the owner during build — by design).

**Backend (Vercel `scdesign-wirral`, `api/*.js`):**
- `api/sc-error-collect.js` — public cookieless ingest (no IP stored; bots flagged not dropped; does NOT skip `/admin`).
- `api/sc-admin-error-logs.js` — session-gated paginated read. `?kind=errors` (default; excludes login rows) | `logins` | `logins_failed` | `logins_success`; `?bots=exclude|include|only` (errors default exclude bots; logins default include).
- `serverlib/common.js` — `sbInsertError` / `sbSelectErrors` / `sbCountErrors`. **`sbInsertError` SELF-HEALS:** on a PostgREST "Could not find the 'X' column" error it preserves that value inside `props` and retries without the column, so inserts work even if the live table is behind the schema. *(This fixed a real incident: the live `sc_errors` table was missing the `surface` column → every insert 502'd → Error logs showed 0. Diagnosed with Playwright + a temporary 502-error echo.)*

**Data:** Supabase `sc-analytics` table **`sc_errors`** (schema of record: **`db/sc_errors.sql`**; RLS on, service-role only). **Dependency:** the table must exist (run `db/sc_errors.sql` once in the Supabase SQL editor). With the self-heal, column drift no longer breaks logging.

**Admin UI (`public/admin/`):** new **System** nav group → **Error logs** (newest-first table, Humans/All/Bots chips, expandable full-context rows + breadcrumb timeline, a **"Copy all error data"** button → Claude-Code-ready report — the first clipboard code in the admin) and **Login attempts** (outcome badges, attempted username, location, device; All/Failed/Successful chips). Read `surface` via `rowSurface(r)` = `r.surface || r.props.surface`.

**🔴 ALWAYS-LIVE ADMIN — no cache, no in-memory reuse** (owner requirement: never show stale data). Keep ALL of this for any new admin view:
- **No in-memory reuse:** `renderView()` clears every cached `state.*` then re-fetches on each view switch (a brief loader on nav is intentional).
- **No HTTP cache (data):** all admin fetches go through **`apiGet()`** = `cache:"no-store"` + a `?_=<ts>` cache-buster.
- **Server:** `applyCors()` sets `Cache-Control: no-store` on every API response.
- **Assets:** **`public/_headers`** serves `/admin/*` as `no-store` (Cloudflare Pages) so the app shell/JS/CSS are always the latest.
- A **"Live · updated HH:MM:SS"** stamp (`#lastUpdated` / `markFresh()`) makes freshness visible.

**Debugging tip:** Playwright IS installed (`@playwright/test`) — drive the LIVE site headless to reproduce client behaviour. `sendBeacon` bodies are NOT exposed by `request.postData()`; wrap `navigator.sendBeacon` in an `addInitScript` to capture them.

### ⭐ GENUINE GOOGLE REVIEWS — proudly displayed (LIVE — Jun 2026)
Sean's real Google reviews (**5.0 average, 30 reviews, all 5★**) are now shown as verbatim testimonials across the site. **This SUPERSEDES the older "ReviewsWidget (Featurable) / review *themes* / honest-fallback copy" approach** for `/reviews` and the homepage (those notes lower down are history).

**🔴 STANDING RULE — reviews are GENUINE-ONLY and shown WITHOUT self-review schema.** Applies to all future review work on this (or any client) site:
- **Never fabricate** a review, rating, author or count. Only display reviews that genuinely exist on Google.
- Show them **verbatim with attribution** and always **link to the live Google profile for validation** (`site.googleReviewUrl`).
- **NEVER emit `Review` or `AggregateRating` JSON-LD for the business's own reviews on its own site** — Google disallows self-hosted self-review structured data *even when the reviews are genuine* (self-serving rich-snippet stars are a guidelines violation / manual-action risk). Display them **visually only**. For star rich-snippets, a third-party collector (Trustpilot / Featurable) is the compliant route — owner action, not ours to fake.

**What's built (commits `996f105` + `e9a1112`):**
- **`src/lib/reviews.ts`** — `reviewSummary` (`rating 5.0`, `count 30`, `source "Google"`, `url = site.googleReviewUrl`, `capturedOn`) + `reviews[]` = **14 curated verbatim reviews** (first 3 are the homepage feature). One reviewer (**Stephanie Corser — same surname as Sean**) was deliberately **omitted** to avoid any conflict-of-interest perception. The header comment documents this policy + how to refresh.
- **`src/components/ui/Testimonials.tsx`** — `ReviewStars` (accessible 5-star row), `ReviewCard` (verbatim quote + author + optional `tag` Badge + "Verified Google review"), `ReviewsSummary` (`5.0 ★★★★★ · 30 genuine reviews on Google` + a "Read all 30 on Google" link), and `Testimonials` (responsive grid; pass `limit` to feature a subset).
- **`/reviews`** (`src/app/reviews/page.tsx`) leads with `ReviewsSummary` + all 14 cards, then `ReviewCta` (leave a review) + `CTASection`.
- **Homepage** (`src/app/page.tsx`) shows `ReviewsSummary align="center"` + `Testimonials limit={3}` + a "read more" link to `/reviews`.
- **Footer** (`Footer.tsx`) shows a `5.0 / 30 Google reviews` badge linking to Google.
- **`site.googleReviewUrl`** default is now Sean's **live Google reviews link** (commit `996f105`), lighting up the site-wide "Leave a Google review" `ReviewCta`; `NEXT_PUBLIC_GOOGLE_REVIEW_URL` overrides. `featurableWidgetId` (`NEXT_PUBLIC_FEATURABLE_WIDGET_ID`) stays optional/unset.

**How the reviews were captured:** via the **connected Chrome browser** — Google search reviews are **consent-walled** (WebFetch 302s to `consent.google.com`), so they're only readable through Matthew's logged-in browser. **Caveat — STATIC SNAPSHOT:** the 15 quotes + the 5.0/30 summary go **stale** as new reviews arrive. To refresh: re-read the Google profile via Chrome and update `reviews.ts`, **or** wire a Featurable widget id for live auto-updating cards.

**Owner-approved follow-ups — DONE (Jun 2026, "yes please all suggestions above"):** (1) rating stars are now **gold** — `--color-gold #e0a01f` token in `globals.css`; `ReviewStars` (cards + summary) and the `Footer` badge use `text-gold`, brand red kept everywhere else; (2) a compact **`GoogleRatingLine`** ("★★★★★ 5.0 · 30 Google reviews" → Google, exported from `Testimonials.tsx`) now sits by the **contact form** and at the top of every **service page**; (3) obvious typos lightly tidied ("heart beat"→"heartbeat", "drawing are"→"drawings are") — otherwise verbatim; (4) the **"J P" initials-only** card dropped → **14 displayed** (`count` stays the true Google total of 30). Still owner-only: GBP category "Architect"→"Architectural designer"; optional Featurable/Trustpilot.

**Pass to Sean (owner actions):** Google lists his business category as **"Architect"** — conflicts with the deliberate protected-title-safe "architectural **designer**, not an architect" positioning → change the **GBP primary category to "Architectural designer"**. Optional: set up **Featurable** (live cards + `NEXT_PUBLIC_FEATURABLE_WIDGET_ID`) and/or **Trustpilot** (compliant star rich-snippets).

#### Accessibility / SEO verify-first pass (Jun 2026, commits `fca79f8` + `10285d6`)
A 6-phase "accessibility / all-device / SEO / conversion" brief — but a **verify-first audit found the site already well-built**, so this was a small safe punch-list, not a rewrite (the brief's three "major concerns" were non-issues). Changes: `Nav.tsx` — `aria-controls` + a stable `#mobile-menu` (hidden when closed), ArrowDown-to-open / blur-to-close desktop dropdowns, `aria-current` on links; `globals.css` print `.no-print` on header/CTA/cookie banner; `MobileCtaBar` aria-labels; `BeforeAfterSlider` `fetchPriority="high"` on the hero (LCP). Baseline report: **`docs/scdesignwirral-accessibility-seo-baseline.md`**. **Still owner-blocked:** area-page keep/merge/noindex decisions need a **Google Search Console export first** — do not touch the 20 area pages until that's reviewed.

### 🔒 FULL CODE AUDIT + REMEDIATION (Jun 2026)
A read-only multi-agent audit (57 reviewers + adversarial verification of every finding) of every file, then an adversarial review of the remediation plan itself, then the auto-fixable fixes shipped in 4 commits. `tsc`+ESLint+build clean throughout. Full reports are **LOCAL + UNCOMMITTED** at `docs/CODE-AUDIT-2026-06-22.md` + `docs/REMEDIATION-PLAN-2026-06-22.md` — deliberately NOT committed because they enumerate live security weaknesses and this repo is public.

**Shipped — auto-fixable (commits `95e45eb` a11y/quality · `dad6f60` admin · `5d4d208` backend · `cd62614` config):**
- **Security:** admin stored-XSS fixed via a `safeHref()` http(s)-scheme allow-list (the error-log Page-URL sink rendered an attacker-controlled `javascript:` url as a live admin link); `sc-error-collect` also stores a url only when http(s). Admin-login brute-force limiter re-keyed on a non-spoofable `trustedClientIp()` (x-real-ip / RIGHTMOST forwarded-for) + a global backstop — the shared `clientIp()`/analytics `vid` is deliberately untouched (no re-bucketing). `visitorHash()` returns the `'anon'` sentinel instead of a public fallback salt when `SC_ADMIN_SESSION_SECRET` is unset. `sanitizeProps` lifted into `serverlib/common.js` + reused by all 3 ingest endpoints, with server-derived keys spread LAST (a client can't forge vid/bot/geo). Mailer strips CR/LF from from/replyTo/subject + the enquiry reply-to is length/CRLF-validated (header-injection defence, version-independent). Conservative headers in `public/_headers` — nosniff/referrer/permissions + `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` set ONCE globally (Cloudflare Pages *appends* per-path rules, so duplicating them on /admin produced double headers — set once on /*; /admin adds only `Cache-Control: no-store`).
- **A11y:** Nav Esc focus-return + guarded mouseleave + exact `aria-current`; project-type chips `role=group`+`aria-pressed`; sr-only live regions (InteractiveHouse / VisualiserApp); `Field` auto-wires `aria-describedby`/`aria-invalid`; admin sidebar `aria-expanded`/`aria-controls` + mobile-only `inert`.
- **Quality/CI:** deduped guide `related[]` (duplicate React keys/chips); admin single boot fetch; deleted stale `scripts/build-static.sh`; `.github/workflows/ci.yml` (validate + `npm audit` report); documented the SC_* env vars.

**🔴 DO NOT:** run `npm audit fix --force` (downgrades Next 16 → 9.3.3). Do NOT add a **content** CSP to `_headers` (breaks inline JSON-LD / Google Fonts / cross-origin analytics+enquiry POSTs) or HSTS `includeSubDomains`/`preload` (started at `max-age=300` only; irreversible). Do NOT move the enquiry backup into the `!primaryOk` branch (would empty the admin Enquiries view + falsify the H1 privacy fix). Do NOT "fix" the XSS by re-`esc()`-ing (esc was already applied; the gap was a missing scheme allow-list).

**⚠️ STILL NEEDS OWNER SIGN-OFF (Batch 4 — NOT shipped):** **H1** privacy-policy rewrite + a real `sc_enquiries` retention period (the policy currently denies a DB that *does* store enquiry PII — a UK-GDPR accuracy gap; lawful-basis section is already fine); **M6** store-always/notify-on-fallback for the duplicate Sean emails — gated on confirming whether the q-cbuild1 primary endpoint emails (if it does NOT, suppressing notify would zero Sean's emails); **M16** enquiry-endpoint abuse cap + optional Turnstile; the **nodemailer ^6→9 upgrade** (7 advisories incl. a HIGH addressparser ReDoS — interim CR/LF sanitisation already shipped, breaking major is owner-timed + cross-repo with q-cbuild1); and confirming **SC_SUPABASE_* / SC_ADMIN_SESSION_SECRET** are set in the SC Vercel project (decides whether storage happens / the salt fallback is live). Add `db/sc_enquiries.sql` DDL (field list = `sc-enquiry-backup.js` insert object).

### 🔧 PROCESSING THE RETURNED PROJECTS QUESTIONNAIRE (fresh-session handoff)
The 6 `/projects` pages are live with honest **placeholder** copy. The owner is returning **`PROJECTS-QUESTIONS.txt`** (repo root) filled in — they paste text following the `PROJECT 1…6` structure. A session with no chat history should use this to apply the answers. (If `PROJECTS-QUESTIONS.txt` is missing, its full content is recoverable from this map; `PROJECTS-CONTENT-QUESTIONNAIRE.md` is the same in markdown.)

**Edit here:** project data `src/lib/projects.ts` (one object per `slug`); page template `src/app/projects/[slug]/page.tsx` (before/after slider when `beforeImage`+`afterImage` both set, else a single image captioned "design visualisation"); hub `src/app/projects/page.tsx`.

**Project map — slug · image(s) · placeholders to replace:**
| # | slug | image(s) | placeholders |
|---|------|----------|--------------|
| 1 | `rear-extension-garden-remodel` | `hero-before.jpg`+`hero-after.jpg` (before/after) | Wirral · 1930s semi-detached · Single-storey rear extension |
| 2 | `brick-garden-room` | `viz-garden-extension.jpg` | Wirral · Detached house · Garden room |
| 3 | `rear-extension-roof-lantern` | `viz-lantern-extension.jpg` | Wirral · Detached house · Single-storey rear extension |
| 4 | `single-storey-commercial-building` | `viz-single-storey.jpg` | North West · Commercial premises · New-build commercial unit |
| 5 | `chapel-to-gallery-conversion` | `viz-concept-a.jpg` | North West · Former chapel · Change of use & conversion |
| 6 | `pharmacy-fit-out` | `viz-concept-b.jpg` (branded "Rowlands") | North West · Retail unit · Commercial fit-out |

**Answer → field mapping** (numbered questions in the .txt):
Q1→`town` (general area only, NEVER a street address) · Q2→`propertyType` (P4: kind of building; P5: confirm chapel; **P6: branding decision, see below**) · Q3→`projectType` (P4/P6: new-build vs conversion/fit-out) · Q4→image **photo or render** (see labelling) · Q5→`brief` · Q6→`challenge` · Q7→`planningRoute` (keep `buildingRegsRoute` sensible) · Q8→`outcome` · Q9→`testimonial` **only if a real quote + permission is given (never invent)** · Q10/extra photos→copy to `public/portfolio/`, set `beforeImage`/`afterImage`.

**Photo-vs-render labelling (Q4):** renders stay "design visualisation". If the owner confirms an image is a real **completed-build photo**, relabel it: change the `[slug]` page single-image `<figcaption>` + the bottom disclaimer paragraph, and the hub `alt`, from "design visualisation" to "completed project". Cleanest implementation: add optional `imageType?: "photo" | "render"` to the `Project` type and drive the caption from it.

**Project 6 (pharmacy) — apply the owner's Q2 branding answer:** "keep named" → may name Rowlands; "genericise" → keep copy generic ("a high-street pharmacy"); "remove" → delete the object from `projects`, remove `public/portfolio/viz-concept-b.jpg`, and add `public/_redirects`: `/projects/pharmacy-fit-out  /projects  301`.

**Multiple photos per project:** the `Project` type currently supports only `beforeImage`+`afterImage`. If several photos are supplied for one project, extend the type with `gallery?: { src; alt; caption }[]` and render it in the `[slug]` page.

**New projects (owner "ADD" answers):** copy an existing `projects` object's shape (fill all required fields), drop images in `public/portfolio/` — hub + sitemap pick them up automatically.

**After ANY edit — verify + ship:** (1) `cd /c/dev/scdesign-wirral` — **Bash cwd does NOT persist between tool calls; prefix every call.** (2) `npx tsc --noEmit` + `npm run lint` (both must be 0 problems) + `npm run build`. (3) commit → `git push origin main` → sync redesign (`git checkout redesign && git merge --ff-only main && git push origin redesign && git checkout main`). (4) verify live (~1–3 min Cloudflare build): `curl -s "https://scdesignwirral.co.uk/projects/<slug>/?cb=$(date +%s)"`. **Guardrails:** never "architect"; general area only; no invented testimonials/dates/planning refs.

### Confirmed client decisions (PRE-REDESIGN — see the redesign block above for current overrides)
- **Service stance: DESIGN-ONLY** (architectural design + planning drawings). The business does **NOT** carry out construction — never make build/construction claims.
- **Wording: "architect / architectural design" IS approved** by the client. Lead with "architectural design / architectural drawings".
  - ⚠️ **LEGAL FLAG (Architects Act 1997):** the bare title *"architect"* is protected — only an **ARB-registered** person may use it. "Architectural design / designer / drawings" is the safe form. **Confirm Sean's ARB registration before launch** if the bare title is used anywhere.

### Stack (verified June 2026)
- Next.js **16.x** (App Router, TS, Tailwind **v4**, ESLint) · Vercel · Supabase (DB/Storage/rate-limit/leads — service-role key **server-only**) · Resend (email, abstracted) · Plausible (consent-gated) · Cloudflare Turnstile · Visualiser API on **Node runtime** + **Sharp 0.34** · AI = `gemini-2.5-flash-image` (Replicate fallback deferred).

### Hard rules (carried from the brief)
- No fake testimonials / no invented certifications.
- Address IS published (`site.addressIsPublic = true`): trading address 20 Ripon Road, Wallasey, CH45 6TR (distinct from the Liverpool registered office).
- **Registered LTD company** — use "SC Design & Construction Ltd" + company no. 11511225 in formal placements (footer / legal pages / JSON-LD). Keep the display brand "SC Design & Construction" (no "Ltd") in the nav logo + page titles.
- No thin/duplicate location pages — each of the 12 must be unique.
- Visualiser output is a **concept only**, never presented as buildable/planning-ready.
- Analytics: the first-party SC analytics is **cookieless, stores no IP and runs without consent** (legitimate interest) — see "ANALYTICS & ADMIN PORTAL" above; only third-party scripts (the reviews widget) stay consent-gated. (Supersedes the earlier blanket "no non-consented analytics" line.) Server-side rate limiting only; Sharp on Node runtime (never Edge).
- Never expose the Supabase service-role key or any API key client-side.

### Content rules
- **Service area wording:** always "**Wirral and the surrounding areas**" (or "across Wirral"). **Never** "20-mile radius" / "20 miles" — removed globally (the user's directive). `site.serviceArea` is the single source of truth; don't hardcode radius copy.
- Social links render only when a real URL is set (`site.socials.facebook` is `""` until confirmed — empty links are not rendered).
- Guides + planning content carry an advisory "general guidance for England, confirm with your local authority" note.

### Current sitemap (~60 routes — upgraded June 2026)
The full site-upgrade plan + outcomes is in **`sc/SITE-UPGRADE-PLAN.md`**.
- Marketing: `/` · `/services` (+ **10** service detail) · `/portfolio` · `/process` · `/about` · `/faqs` · `/contact` · `/contact/thank-you` (noindex) · `/projects` (+ `/projects/[slug]` template, off-route until real projects exist) · `/reviews`
- **Services (10):** house-extensions, loft-conversions, residential-design, planning-building-regulations (hub) + planning-drawings-wirral, building-regulations-drawings-wirral, permitted-development-wirral, lawful-development-certificate-wirral, garage-conversion-drawings-wirral, conservation-area-design-wirral. Each carries rich structured fields (`whoFor`/`included`/`notIncluded`/`planningRoute`/`buildingRegsRoute`/`sendFirst`/`localConsiderations`/`relatedServices`/`relatedGuides`); grouped by `category` (design/planning) on the hub + a "which service do I need?" table.
- **Areas:** `/areas` hub + **20** unique local pages, `tier`-split **core Wirral (15)** vs **wider (5)**. New core pages: new-brighton, moreton, upton, greasby, oxton, port-sunlight, eastham, prenton (Oxton + Port Sunlight conservation-hedged). Each has `propertyContext`/`localPlanning`/`relevantServices`/`nearby`.
- **Guides (SEO):** `/guides` hub (grouped by `category`) + **11** guides. New: planning-drawings-vs-building-regulations-drawings, permitted-development-rights-wirral, lawful-development-certificate-explained, what-drawings-do-builders-need, how-long-does-planning-permission-take-wirral, conservation-area-extensions-wirral, loft-conversion-building-regulations. Each has summary box + TOC.
- Visualiser: `/visualiser` (+ `/visualiser-terms`) — page now has H1 + above/below disclaimers + consent/rights note.
- Legal: `/privacy-policy` · `/cookie-policy`
- Internal: `/components-preview` (noindex)
- Generated: `sitemap.xml`, `robots.txt`, `opengraph-image`, `icon.svg`

### Global components/SEO added in the upgrade
- **Nav** = grouped dropdowns (Services/Areas/Guides) — accessible (`aria-expanded`/`aria-controls`, button-driven, Esc + outside-click close); children derive from the data arrays. **Footer** = 5 columns (design services / planning services / explore / contact + "despite the name…" reassurance). **`MobileCtaBar`** = sticky bottom Call/WhatsApp/Send-idea (< lg, below the consent dialog). **`Breadcrumbs`** UI component on every inner page (paired with `breadcrumbJsonLd`).
- **SEO helpers:** `pageMeta` now returns `title:{absolute}` (kills the double-brand bug) + supports per-page `metaTitle`/`metaDescription` (on Service/Location/Guide). `webSiteJsonLd()` added (in layout alongside the `@id`-linked `ProfessionalService`); `localBusinessJsonLd` areaServed expanded to the full town list + `serviceType`. Every page has exactly one H1 (pages that used `SectionHeading` as the title were fixed: contact/faqs/process/about + the hubs).
- **Contact form** expanded (postcode\*, area, project type/stage, has-builder, timescale, budget, preferred contact); extra fields fold into the message so the API/DB stay unchanged; server path redirects to `/contact/thank-you`; static path keeps the mailto fallback.
- **Trust:** `lib/projects.ts` (was empty; now holds 6 real projects — see the redesign block above; the "In preparation" placeholder branch is retained but no longer rendered); `/reviews` shows honest fallback copy + a Google-review CTA that only renders once a real URL is set. Portfolio relabelled "Project examples & design visualisations", AI items all labelled illustrative.
- **Image SEO:** `BeforeAfterSlider` imgs carry `width`/`height`/`loading`/`decoding` + a `priority` opt-out (home hero is eager).
- `LOCAL_SEO_CHECKLIST.md` — internal GBP/citations/NAP doc.

### Visualiser — LIVE photoreal AI render (primary path since June 2026)
The `/visualiser` page (H1 + browser title **"See your idea come to life"**) produces a **photorealistic** extension render via OpenAI `gpt-image-1`, shown as the original and proposed images **side by side** on the result step. The old in-browser canvas overlay is retained ONLY as an automatic fallback. Runs with **zero owner action** by reusing TailoredQuote's existing infrastructure (explicitly owner-authorised for image-generation purposes — it does not affect TailoredQuote).

#### V4 pipeline (LATEST — live since June 2026; supersedes the v1/v2 description below for the live site)
A new **SC-only** endpoint **`api/sc-visualise-v4.js`** (QCbuild1, same Vercel project + production branch) is what the live site now calls. The legacy `api/sc-visualise.js` is kept **untouched for rollback**. V4 is fully additive — **no TailoredQuote file/prompt/flow changed**; CORS is restricted to `scdesignwirral.co.uk` (+ www + `q-cbuild1.vercel.app` + localhost), deliberately **excluding** the TQ origins.

- **Pipeline (high-risk = extension / canopy-porch / loft-dormer / garage-conversion / general-structural):** Stage 0 deterministic `classifyWorkTypeV4` (pure helper `api/_lib/sc-visualise-v4-classify.js`, unit-tested in `api/__tests__/sc-visualise-v4.routing.test.js`) → work-type + risk tier (structural keyword hits force high-risk). Stage 1 `gpt-4o` authors a buildable, conservative design plan (JSON). Stage 2 builds a clean subtype prompt → `gpt-image-1` `images.edit` **from the ORIGINAL photo** (`input_fidelity:'high'`, quality `high` for structural). Stage 3 `gpt-4o` validates output-vs-original (strict canopy/extension/loft hard-fail rules). Stage 4 retries **from the ORIGINAL** with a correction appendix (`SC_VISUALISER_MAX_ATTEMPTS_STRUCTURAL`, default 2). **Low-risk** (cosmetic / doors-windows / unclear) = single fast pass, no validation.
- **No dead-ends:** if validation never passes but an image WAS produced, V4 returns the best **draft** `{ ok:true, b64, needsRefinement:true, suggestions:[...], score }` (NOT a safe-fail). The frontend shows a **refine screen** — draft image + "what we'd improve" + an editable instructions box **pre-filled with the previous request**; user edits → **Regenerate** (re-runs from the original photo) or **Use this draft**. A safe-fail (`{ ok:false, safeFailure:true, message }`, no image) now happens ONLY when no image could be produced at all. If analysis is unavailable for high-risk work, a conservative plan is **synthesised** from the deterministic work-type so a draft is still produced.
- **Email EVERY render** (success AND draft/needs-refinement): internal copy → `matthewjtaylor1985@icloud.com` + `scdesignandconstruction@outlook.com` with **all form data** + before/after + plan + prompt + validation; customer also gets the (draft) image. No-image safe-fail → internal diagnostic only. Same shared iCloud mailer; never blocks the render.
- **Config / env (optional, safe defaults):** `SC_VISUALISER_PIPELINE_VERSION` (`v4`|`legacy`), `SC_VISUALISER_IMAGE_MODEL_DEFAULT`/`_STRUCTURAL` (both default `gpt-image-1`; set `_STRUCTURAL=gpt-image-1.5` ONLY if confirmed available — graceful fallback to known-good params, never crashes), `SC_VISUALISER_IMAGE_QUALITY_DEFAULT`/`_STRUCTURAL` (medium/high), `SC_VISUALISER_MAX_ATTEMPTS_STRUCTURAL` (2). **The shared `openai` SDK (`^4.52.7`) is NOT bumped** — V4 uses only gpt-4o + gpt-image-1 + `response_format:json_object`. `maxDuration:300` (additive `vercel.json` line + in-file). `GET /api/sc-visualise-v4` = health (`version:"v4-classify-analyse-validate-retry"`).
- **Frontend:** `VisualiserApp.tsx` default + `.env.production` `NEXT_PUBLIC_SC_VISUALISER_ENDPOINT` → `…/api/sc-visualise-v4`; handles `needsRefinement` (new `"refine"` status/view) and `safeFailure` (shows the server message, suppresses the misleading canvas overlay for high-risk). Disclaimers, watermark and the mailto lead flow unchanged; photo-tips strengthened for structural work.
- **Rollback:** set `NEXT_PUBLIC_SC_VISUALISER_ENDPOINT` back to `…/api/sc-visualise`, or `SC_VISUALISER_PIPELINE_VERSION=legacy`. Legacy endpoint unchanged.
- **Deploy:** backend → QCbuild1 production branch `claude/quote-builder-wv-construction-dwtaw` (Vercel); frontend → scdesign `main` (Cloudflare). Both verified live (V4 + legacy + tailoredquote.co.uk all 200).

The original **v1/v2 single-endpoint design** (still the rollback target) is documented below:

- **Backend: `api/sc-visualise.js`** (repo-ROOT, NOT `/sc/`). The one authorised exception to the "/sc/-only" rule — Vercel only deploys serverless functions from the root `/api/`, so the function lives there while all UI/source stays in `/sc/`. Fully isolated: imports only `openai`, touches no TailoredQuote function/RPC/table, and is called cross-origin from the static SC site (the same static→`q-cbuild1.vercel.app` pattern the TQ demo uses). Deploys automatically on push to `claude/quote-builder-wv-construction-dwtaw` (Vercel production tracks that branch — confirmed live).
  - **OpenAI key resolution:** env `OPENAI_API_KEY` → fallback to `client_accounts.openai_key` read via `SUPABASE_SERVICE_ROLE_KEY` (read-only), mirroring the live TQ demo functions. TQ stores its key in the DB, not the env var, so the **DB fallback is what actually resolves** (health check returns `keyConfigured:true, envKey:false, serviceKey:true`). Reuses the SAME existing key — nothing to configure.
  - **CORS** locked to `tailoredquote.co.uk` (+ www + `q-cbuild1.vercel.app`). Best-effort in-memory rate limit (12/IP/hour, 200/day). `maxDuration:120` registered in root `vercel.json` (additive; no existing TQ entry changed).
  - **gpt-image-1 call:** `images.edit` with `input_fidelity:'high'`, `quality:'medium'`, at a **native size matching the input aspect ratio** (`pickNativeSize`/`pickOutputSize` → 1024², 1536×1024, 1024×1536) to avoid the documented room-shrinkage artefact. Returns base64; **the source photo is held in memory only, never persisted.**
  - **Two-step prompt pipeline (June 2026 — health check `version:two-step-vision-v1`):** BEFORE the `images.edit` call, a **gpt-4o vision pass** (`authorEditPrompt` in `api/sc-visualise.js`) reads the actual uploaded photo + the homeowner's options and authors a precise, **project-type-aware**, structure-preserving edit instruction in a Change/Preserve/Constraints shape (returns JSON `{editPrompt, observed, summary, warnings}`). This fixed the loft-conversion bug where the old **single generic template** (one `buildPrompt` for every project type, with a blanket "preserve the roofline" rule + the homeowner's notes appended) made gpt-image-1 **clad over the existing top floor** instead of adding a dormer. Loft prompts now ADD a dormer ABOVE the roof and PRESERVE every storey below; extensions add alongside. **Fallback:** `buildStaticPrompt` branches by project type (loft vs extension) and is used if the vision step fails — still far better than the old template. The internal QA email now shows the vision step's `observed`/`summary`/`warnings`. Both calls reuse the existing resolved OpenAI key (no new config); CORS/rate-limit/customer-email untouched. The repo lives at `mtaylor-afk/QCbuild1` (clone `C:\dev\QCbuild1`), deploy branch `claude/quote-builder-wv-construction-dwtaw`. The frontend `buildPrompt()` in `sc/src/lib/visualiser-options.ts` was **dead code** (never sent) and has been removed.
  - **Hardening pass (`version:two-step-vision-v2`, from an adversarial code review):** (1) the vision call is bounded (`timeout 20s, maxRetries 0`) and the `images.edit` call gets `timeout 90s` (client `maxRetries 1`) so a slow vision call can't eat the 120s budget and 504; (2) the loft static-fallback notes line is **dormer-scoped** so a "grey cladding" note can't re-clad the whole house on the fallback path; (3) `LOFT_HARD_CONSTRAINT` is appended to the vision-authored prompt too (guardrail on BOTH paths); (4) `projectType:'general'` is no longer coerced to "extension" — neutral label + a conservative `buildStaticPrompt` general branch that defers to notes; (5) vision image uses `detail:'low'`; (6) option keys are whitelisted at parse (also keeps the QA email subject clean); (7) `max_tokens 1200` + `finish_reason==='length'` handling. **The vision model stays `gpt-4o`** (a structure-reading vision task — do NOT downgrade to `gpt-4o-mini`).
  - **`GET` health check:** `https://q-cbuild1.vercel.app/api/sc-visualise` → `{ok, service, keyConfigured, envKey, serviceKey, ts}`.
- **Frontend** (`src/components/visualiser/VisualiserApp.tsx` + `src/lib/concept-canvas.ts` + `src/lib/visualiser-options.ts`): `presizeToNative()` cover-fits the photo to a native size (also used as the displayed "before"), POSTs JSON `{imageBase64,mime,size,projectType,storeys,style,notes,email,phone}` to `NEXT_PUBLIC_SC_VISUALISER_ENDPOINT` (defaults to the deployed URL, baked into the static export at build time), renders **side by side** (original | proposed), watermarks on download via `addWatermark()`, and **automatically falls back to the in-browser canvas concept** (`renderConcept`) if the endpoint errors/refuses so the page never breaks. Loading copy warns it can take up to a minute.
- **Contact capture (required email + optional phone):** the upload form has an **Email address** field (required, hint "This is where your results will be sent.") and an optional **Telephone** field. `generate()` will NOT process the form until the email passes a basic format check (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`); the phone is never required. The server re-validates the email (returns `400 invalid_email` if missing/malformed) as defence-in-depth. Both values are sent in the POST body.
- **Upload UX:** the photo box supports drag-and-drop plus two explicit buttons — **Take a photo** (a hidden input carrying `accept="image/*" capture="environment"` so phones/tablets open the camera app directly; desktop ignores `capture` and shows a file picker) and **Choose from library** (`fileInput`). **There is no "sample photo" option** (removed June 2026 — do not re-add). The free-text field is labelled **"Give me more detail of what you want"** (was "Notes (optional)"). The **"Concept visualisation only."** disclaimer box lives on `src/app/visualiser/page.tsx` **below** the `<VisualiserApp />` (i.e. under the Generate button), not in the hero — and the hero top padding is tightened (`pt-8`) so the page sits higher.
- Output is always watermarked "Concept visualisation by SC Design & Construction · powered by TailoredQuote".

#### Email workflow (every render — `api/sc-visualise.js` via the shared iCloud SMTP mailer `api/_lib/icloud-mailer.js`)
- **On success → internal copy:** emails the **prompt + `before.jpg` + `after.png`** (attached) plus the **lead's email + phone**, form fields / output size / IP / user agent to **`matthewjtaylor1985@icloud.com`** AND **`scdesignandconstruction@outlook.com`** (`emailType: sc_visualiser_copy`).
- **On success → customer result:** emails the visitor (the email they entered) their **`before` + `proposed-concept.png`** (attached) plus **Sean Corser's contact details** (SC Design & Construction · 07749 456528 · scdesignandconstruction1@gmail.com) and the concept-only disclaimer. **No prompt, no form/option data** is included (`emailType: sc_visualiser_customer`, `SEAN_CONTACT` const). Sent via `emailCustomerResult()`, awaited + `.catch()` so a mail failure never breaks the render.
- **On any server-side failure** (`server_misconfigured` / model refusal / exception): emails a full diagnostic report — stage, HTTP + OpenAI error status, error message + stack, prompt, form fields, input dimensions/bytes, IP, user agent, and the **failed input photo attached** (`emailType: sc_visualiser_error`).
- Recipients are the `NOTIFY_RECIPIENTS` const in `api/sc-visualise.js`. Emails are **awaited** (Vercel tears down the function after the HTTP response, so fire-and-forget would be cancelled) but wrapped in `.catch()` so a mail failure can never break the render. Both log to TQ's `sent_emails` table (visible on the admin Sent Emails page).
- **Deliverability note:** sends are from `mail@tailoredquote.co.uk` via iCloud SMTP. `@icloud.com` inboxes fine; `@outlook.com` may junk the first few from a new-sender pattern — mark "not junk" / add to safe senders once.
- The client-side canvas *fallback* render does NOT email (the server function isn't involved). Only real server renders + server failures notify.

#### Legacy (present but unused by the live site)
- Standalone `demo/extension-visualiser.html` — BYO-key OpenAI/Gemini in-browser visualiser.
- Gemini server route `src/app/api/visualise/route.ts` (Node + Sharp + Gemini + Supabase) — kept for a future standalone SC Vercel deploy; excluded from the static export.

#### Rollback (owner-authorised feature)
Delete `api/sc-visualise.js`, revert the single additive `vercel.json` line, revert the `/sc/` source edits (`src/components/visualiser/VisualiserApp.tsx`, `src/app/visualiser/page.tsx`, `src/lib/concept-canvas.ts`, `src/lib/visualiser-options.ts`, `.env.example`), and rebuild `sc/site`. The only TailoredQuote-shared touches are: the additive `vercel.json` line, the read-only DB key lookup, and the shared (rate-capped) OpenAI key + SMTP mailer. The function cannot alter TQ behaviour.

### SEO
- Per-page metadata + canonical + OG/Twitter; JSON-LD: ProfessionalService, Service, Article (guides), BreadcrumbList, FAQPage. `sitemap.ts` + `robots.ts` (env-aware).
- **Index-safety:** the live own-domain deploy (`scdesignwirral.co.uk`, Cloudflare Pages) is **indexable**. Indexing is controlled by an explicit `NEXT_PUBLIC_NOINDEX` flag (`src/lib/base.ts`, decoupled from `IS_STATIC`) — set it to `1` only for preview/non-production builds, and the layout + `pageMeta` then emit `noindex,nofollow`. `robots.txt` allows crawling (disallows only `/api/` + `/components-preview`) and references the sitemap. Legal pages (privacy / cookie / visualiser-terms) stay crawlable via footer links but are excluded from `sitemap.xml`.
- Full review + roadmap: **`sc/SEO-PLAN.md`** (GBP, real photos/reviews, next guide + service sub-pages, measurement).

#### Final SEO gap-closure pass (June 2026 — phases 1–10, all live)
A focused pass on the already-mature site (no rebuild). What it added/changed:
- **Indexing:** explicit `NEXT_PUBLIC_NOINDEX` flag (see Index-safety above); legal pages dropped from `sitemap.ts` (still crawlable). Validated: 56 indexable pages all carry title+description+self-canonical (prod host only); 114 JSON-LD blocks valid; **0** fake Review/AggregateRating.
- **Trust/polish:** contact + thank-you "what happens next" use real `<ol>` numbering (no manual numbers); `ui/LegalLayout.tsx` banner is live-safe wording (no "draft/before launch").
- **Reviews:** `ui/ReviewCta.tsx` (Google button only when `site.googleReviewUrl` set; since the June 2026 audit gap-closure pass, NO public "link to be added" placeholder — just the genuine invitation copy) on home/contact/footer/reviews; `/reviews` rebuilt (themes, not fake quotes). `google_review_click` tracked.
- **Schema:** `personJsonLd()` (Sean, ARB-safe — **no** ARB/RIBA/quals/insurance) on `/about`; `articleJsonLd()` now has Person author + `mainEntityOfPage` + parsed `dateModified`.
- **Guides:** `ui/ReviewedBy.tsx` + "What to send Sean" checklist + category-driven official-source links (verified URLs only).
- **Projects:** 6 named draft placeholders with the exact "details to be added once homeowner permission…" note; `Project` type extended; real list stays empty (no draft pages indexed).
- **About:** qualifications/insurance owner-checklist (pending, never claimed). *Superseded June 2026 (audit gap-closure):* the visible "to be confirmed" list was replaced with one line — "Professional and insurance details can be provided on request where relevant to your project." The factual company-details `<dl>` + ARB note stay.
- **Linking:** service→priority-area links; area→guides + honest per-area "case studies coming soon" + ReviewCta. **`Location.noindex`** flag is the owner switch for the 5 wider areas (liverpool/chester/crosby/ellesmere-port/neston) — default unset → indexed.
- **Forms:** contact funnel events `contact_form_submit | _success | _error` (replaced `contact_submit`).
- **Config knobs:** `NEXT_PUBLIC_GOOGLE_REVIEW_URL` (blank→placeholder) and `NEXT_PUBLIC_NOINDEX` (documented in `.env.example` / `.env.production`).
- **Owner TODOs (never invent):** GBP + Google review URL · Sean's quals/memberships/insurance · confirm "18+ years" · profile photo · real projects/images/permission · real reviews · keep wider areas indexed? · analytics provider + consent. (See also `LOCAL_SEO_CHECKLIST.md`.)

#### Domain go-live polish (June 2026 — links, form routing, TailoredQuote attribution; all live)
Small targeted pass after `scdesignwirral.co.uk` went live. In-repo changes (built, pushed to `main`, verified live):
- **URL self-references:** `siteUrl` fallback in `src/lib/seo.ts` changed from `https://www.example.com` → `https://scdesignwirral.co.uk`, so canonical/OG/JSON-LD/`metadataBase` can never emit `example.com` even if `NEXT_PUBLIC_SITE_URL` is unset. Prod sets the env var anyway; verified `example.com` appears 0× in `out/`. The `q-cbuild1.vercel.app/api/sc-visualise` reference is the functional render endpoint, NOT a user-facing URL — left as-is.
- **Form routing → both inboxes:** new `site.formRecipients = [gmail, icloud]` single source of truth. The **contact** form (`ContactForm.tsx`) and **send-concept** form (`SendConceptForm.tsx`) static `mailto:` now address both `scdesignandconstruction1@gmail.com` + `matthewjtaylor1985@icloud.com` at once. `site.email` (public business address in JSON-LD / policy pages) unchanged. NOTE: the static site has no server, so the visitor's mail client shows both addresses in the To line.
- **TailoredQuote attribution link:** under the visualiser upload notice (`VisualiserApp.tsx`), "Visualised images powered by **TailoredQuote.co.uk**" → `https://tailoredquote.co.uk`. Wordmark style matches the TQ logo — `Tailored` = `text-ink`, `Quote` = `text-[#2563eb]` (same blue already on the homepage), `.co.uk` = `text-muted`, bold; prefix in the site's Inter/muted body style.
- **PENDING — visualiser EMAIL (lives in the TailoredQuote backend `api/sc-visualise.js`, NOT this repo — see Email workflow above; owner chose "skip backend for now"):**
  - **Result email styling:** add a prominent link to `https://scdesignwirral.co.uk` at the TOP of the customer result email; add a bottom line "Image generation powered by TailoredQuote.co.uk" linking to the site, using the same wordmark style as above.
  - **Recipients (owner: "keep all three"):** `NOTIFY_RECIPIENTS` should become gmail + icloud + outlook (i.e. **add** `scdesignandconstruction1@gmail.com` to the existing `matthewjtaylor1985@icloud.com` + `scdesignandconstruction@outlook.com`). Customer-result email (sent to the visitor) is unaffected.

#### Sole-trader entity + footer attribution + full QA pass (June 2026)
> ⚠️ **The ENTITY part of this entry was LATER REVERSED** — the owner confirmed the registered company SC Design & Construction Ltd (no. 11511225). See "Ltd entity adopted + address published" below. The footer-attribution + full-QA-pass parts of this entry still stand.
- **"Ltd" removed everywhere (at the time believed a sole trader — since corrected):** `site.name` "SC Design & Construction Ltd" → "SC Design & Construction" (cascades to footer, page titles, OpenGraph `siteName`, all JSON-LD). Removed the `companiesHouseNumber` field + the footer "Company No." line + the About page Companies-House checklist item; legal-pages "Ltd" wording dropped; "company name" → "business name" (footer + About). Standing rule now at the top of these Project Notes. Verified 0 `Ltd`/`Company No`/`Companies House` in `out/`.
- **TailoredQuote attribution in the global footer (site-wide, centred):** the "Visualised images powered by **TailoredQuote.co.uk**" wordmark link now also sits in `Footer.tsx`'s bottom bar (centre-aligned) so it shows on every page. Dark-footer colour adaptation: `Tailored` = `text-paper`, `.co.uk` = `text-paper/50`; `Quote` started at `#2563eb` but failed AA on `bg-ink` (3.26:1) so is now **`#7aa2f7`** (6.7:1). The visualiser-page wordmark on light bg keeps `#2563eb`.
- **Full QA review (multi-agent, adversarially verified — 11 confirmed fixes, 11 false positives rejected):**
  - **Contrast (WCAG AA):** primary CTA buttons used `bg-accent` `#b9743f` + white = 3.73:1 (fail) site-wide → switched to `bg-accent-strong` `#a45f2d` (4.94:1) with a NEW `--color-accent-deep #8f4f24` hover token (6.34:1), applied to the shared `Button` primary variant + the hardcoded copies (Nav ×2, MobileCtaBar, ConsentBanner, error, process step badge). Form placeholders `--color-muted-soft` (2.80:1) → `--color-muted` (5.15:1). Footer review-CTA placeholder `text-paper/40` → `/60`. **Design rule learned:** `--color-accent` `#b9743f` is AA only on *dark* surfaces / decorative use; use `--color-accent-strong` for white text or text on light, and the lighter `--color-accent` for accent text on `bg-ink` (e.g. `page.tsx` visualiser-teaser eyebrow, correctly left as `text-accent` = 4.56:1).
  - **Keyboard / focus:** `ServiceCard` had `focus-visible:outline-none` with no replacement → removed so the global accent outline shows. Mobile nav now closes on **Escape** and restores focus to the toggle.
  - **Mobile / touch:** `MobileCtaBar` spacer now `calc(4rem + env(safe-area-inset-bottom))` so the fixed bar can't hide the footer tail on notched phones. `BeforeAfterSlider` touch handlers are press-gated by the `dragging` ref (+ `onTouchEnd/Cancel`) so the divider no longer jumps on a tap or a scroll-from-image.
  - **Cross-browser:** `Select` dropped `appearance-none` (it had no replacement chevron → looked like a text box) so the native arrow renders on Chrome/Safari/Firefox/Edge.
  - **Minor:** visualiser revokes the upload blob URL on unmount; guide "Related" chips map `/process`,`/about`,`/contact`,`/visualiser` to friendly labels instead of raw lowercase.
  - Verified: `tsc` + ESLint + build all clean; live DOM/CSS spot-check on `scdesignwirral.co.uk` confirms all shipped. NOTE: automated cross-browser *visual* rendering was not run (no Chrome extension / preview server bound to this repo) — correctness rests on the computed contrast ratios, code review, and the live DOM/CSS check.

#### Homeowner guide cluster — 15 new guides (June 2026 — all live)
Added a researched, people-first guide cluster (not a Blog; no thin service×town pages) to the existing data-driven guides system. **26 guides total now** (11 existing + 15 new), all ARB-safe and design-only.
- **Scaffolding (additive, non-breaking):** `Guide` type extended — `category` now 6 values (`planning | pd-ldc | building-regs | project | cost-process | local-buying`), plus optional `officialSources`, `ctaService` (Zone B target), `draft` (→ noindex + excluded from sitemap/hub/nav), and a section-level `table`. The `[slug]` template gained CTA **Zone A** (early contact, top) + **Zone B** (contextual service CTA) — Zone C reuses `CTASection`; responsive comparison tables; per-guide official sources (fallback to `officialLinksFor`). Hub regrouped into **6 sections with category badges** (single best-fit placement — a guide appears once; no duplicate cards). `sendToSean` text expanded.
- **The 15 guides** (all `category`/`navLabel`/`ctaService`/`officialSources`/`related` set; ~700–950 words, hedged, UK English): full-plans-vs-building-notice-wirral (table), after-planning-permission-next-steps, structural-calculations-vs-architectural-drawings, loft-conversion-stairs-head-height-fire-safety, wirral-householder-planning-application-drawings-checklist, invalid-planning-application-drawings-wirral, planning-permission-vs-lawful-development-certificate, change-extension-design-after-planning-permission, garage-conversion-planning-building-regulations-wirral, rear-side-wraparound-extension-planning-rules, builder-quote-drawing-pack-checklist (table), how-to-brief-architectural-designer-extension, wirral-pre-application-advice-home-extension, check-wirral-conservation-area-map, buying-house-extension-loft-conversion-certificates.
- **Wiring:** curated Guides dropdown (`nav.ts`, no longer auto-sliced); homepage "Helpful homeowner guides" section; service `relatedGuides` cross-links on 6 services; `/process` + `/contact` guide links.
- **Official sources verified live** (Wirral Full Plans/Building Notice/forms+checklists/pre-app/conservation+Article 4; GOV.UK building-regs when+how, LDC `/guidance/lawful-development-certificates`, appeal; Planning Portal garage/loft-stairs/loft-fire/extensions/non-material-amendment; Google people-first/spam/review-snippet). No copied official text — paraphrased.
- **Adversarial QA** (one agent per new guide): 0 high, 1 medium + 8 low — all fixed (de-duplicated the loft-stairs guide vs `loft-conversion-building-regulations`, the planning-vs-LDC FAQ vs `lawful-development-certificate-explained`, and the conservation-map line vs `conservation-area-extensions-wirral`; softened "price it accurately"/"buildable"/"always"; removed the unverified "26" count).
- **Verified:** `tsc`+ESLint+build clean (79 pages); 15/15 in sitemap with production canonicals; **0** Review/AggregateRating schema; 0 broken internal `/guides`+`/services` links (34 checked); ARB "architect" mentions only in the existing architect-vs-designer explainer; /process+/contact numbering still correct.
- **Draft mechanism** built but unused (all 15 complete + indexable). To unpublish a future guide: set `draft: true` → noindex + out of sitemap/hub/nav.

#### Ltd entity adopted + address published (June 2026 — all live)
Owner confirmed the business is the registered company **SC Design & Construction Ltd (no. 11511225)** and asked to publish a physical address — **reversing** the earlier sole-trader pass. Verified the number on Companies House (Active, incorporated 10 Aug 2018).
- **`site.ts`:** `name` → full legal name; re-added `companiesHouseNumber: "11511225"` + `registeredOffice` (Liverpool); `address.street` → "20 Ripon Road" (owner wrote "Rippon" — corrected to the real spelling via postcode lookup) + `addressDisplay`; `addressIsPublic: true`. `shortName` unchanged (display brand).
- **Display:** footer shows the Ltd copyright + a registered-details disclosure line (name · no. 11511225 · Liverpool registered office) + the Wallasey trading address; the visible NAP/contact address is **Wallasey** (contact "Our office" card, footer); legal pages + About show the registered details. `localBusinessJsonLd` now emits the Wallasey `PostalAddress` (via `addressIsPublic`).
- **Owner decisions:** Wallasey shown as the contact address, Liverpool registered office only in the small legal line; "Ltd" in formal placements only (nav logo + page titles keep "SC Design & Construction"). **Design-only positioning preserved** (the company's registered SIC codes include construction — flagged to the owner, not changed). Confirm the house number "20" is correct.
- Verified: build clean; JSON-LD `PostalAddress` = 20 Ripon Road/Wallasey/CH45 6TR; "…Ltd" + no. 11511225 render in footer/legal/About/contact; **0** remaining "sole trader" assertions repo-wide.

#### 32-phase audit gap-closure (June 2026 — all live)
Owner supplied a 32-phase "full live-site audit + implementation" brief (ARB-safe, design-only, no fabricated proof, data-conversion hooks, placeholder removal). A three-front codebase audit found the site **already satisfied ~90% of it** — so this was a surgical 5-commit gap-closure (`ee0fdf3`→`2a40f21`), NOT a rebuild. Owner-approved scope decisions: **lean nav kept** (Contact stays a CTA button; Process/FAQs in footer — brief's fuller top-level nav rejected); **"Extension Concept Visualiser"** and **"Projects & case studies"** names kept; only the primary CTA label adopted from the brief.
- **Conversion hooks (passive, additive):** `data-conversion` attributes on every key CTA — `phone-click`/`whatsapp-click`/`email-click` (footer, MobileCtaBar, contact sidebar, thank-you, homepage hero), `contact-cta` (primary CTAs + mobile bar), `contact-submit`, `visualiser-start` (generate button + homepage visualiser CTAs), `visualiser-submit` (send-concept; client-rendered so it lives in the JS bundle, not prerendered HTML), and per-page-type `service-cta`/`area-cta`/`guide-cta` via a new optional `track` prop on `CTASection` + `LinkButton` (`Button` takes a plain `data-conversion` attr). These COMPLEMENT the existing consent-gated Plausible `ClickTracking` — do not remove either layer.
- **Visible placeholders now ZERO site-wide** (verified in `out/`): About "to be confirmed" credentials list → "available on request" line; ReviewCta public placeholder removed; homepage + projects "coming soon" labels → "In preparation"/"Real project examples" with permission-aware copy.
- **Primary CTA label** is now **"Send Your Project Details"** (`cta.primary.label`, owner-approved) — the contact form submit button reuses `cta.primary.label`, so the label changes in ONE place. The contact page H1/meta + process step 1 still say "Send Sean your project idea" deliberately (prose, not buttons).
- **Visualiser retention copy unified:** page + in-app upload note now match privacy/terms (source photo not stored after processing; generated concept kept briefly, env-driven `VISUALISER_RESULT_EXPIRY_DAYS` ≈ 7 days). Added "Photo tips for the best concept" (good vs poor uploads) + a "Want to turn a concept into planning or builder drawings?" CTA card on `/visualiser`. Never revert the copy to the oversimplified "not stored" wording — it must keep matching the terms.
- **Verified:** `tsc`+ESLint+build clean; `out/` grep = all 9 `data-conversion` values present (and `visualiser-submit` in the bundle), 0 "to be confirmed"/"coming soon"/"link to be added", 0 Review/AggregateRating schema, 0 unsafe protected-title forms, 0 "sole trader"; live WebFetch spot-checks confirmed the hero CTA, photo tips, 7-day note + concept→drawings CTA deployed. (Honesty note: code-based audit + build + live spot-checks — not a full automated browser crawl.)
- **Still owner-blocked (unchanged):** GBP review URL, real reviews, approved project photos, quals/insurance details, ARB status, Lighthouse + real form/visualiser submission tests.

#### ✅ BUILT (Jun 2026) — visitor logging + admin panel — was DEFERRED, now LIVE
**See "📊 ANALYTICS & ADMIN PORTAL (LIVE)" near the top of these Project Notes — that is the current, authoritative description.** The chosen solution was **first-party cookieless analytics on a separate Vercel project (`scdesign-wirral`) + a Supabase project (`sc-analytics`) + a static admin app at `/admin/`** — not the Cloudflare D1 / Pages Functions route floated below. The original deferral analysis is kept for history only:
- **Core blocker:** the site is a **static export** (`next.config.ts` → `output: "export"`, Cloudflare Pages) with **no backend** — it cannot write to a DB or host a protected `/admin` page on its own. A real solution needs three things, only one of which is a database: (1) a datastore, (2) server-side compute, (3) admin authentication.
- **Already in the repo but dormant:** consent-gated **Plausible** (`Analytics.tsx`; activates when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set; `track()` already fires custom events) and a **server-only Supabase** client (`supabase.ts` — dead under static export, no server to run it).
- **Lowest-effort path (recommended first):** hosted dashboards — turn on Plausible (or Cloudflare Web Analytics, free/privacy-first) for visitors + **Sentry** (free tier, ingests browser errors directly) for errors. These need no backend and may remove the need to build a panel at all.
- **If a custom in-site `/admin` is genuinely wanted:** Cloudflare-native is the best fit (same host) — **Pages Functions** + **D1** (SQLite SQL DB) or Analytics Engine + **Cloudflare Access** for admin auth; alternatively reactivate **Supabase** (Postgres + auth); last resort, drop static export for a server deploy.
- **Owner must provide before build:** chosen path; provisioned account/DB; credentials as **Cloudflare Pages env vars** (never committed); admin auth (Cloudflare Access = simplest); what to log + retention; **GDPR/PECR** decision — IP addresses are personal data, so decide anonymisation/consent and update the privacy + cookie policy to match the existing consent-banner stance.

### Deployment & how to view it (no own domain yet)
- **Static export** (this standalone repo): `next build` → `out/`, served by Cloudflare Pages. (The old `scripts/build-static.sh` for the GitHub-Pages `/sc/site` sub-path was **removed June 2026** — it targeted a deploy topology that no longer exists.) `next.config.ts` hardcodes `isStatic = true` (`output: export` + `trailingSlash`); `NEXT_PUBLIC_BASE_PATH` defaults to `""`.
- **`src/lib/base.ts`** — `withBase()` prefixes raw asset/anchor paths; `IS_STATIC` toggles the no-server form fallbacks (contact + send-concept open a prefilled email).
- **Live viewing** (GitHub Pages serves only `main` + `claude/quote-builder-wv-construction-dwtaw`): develop on `claude/sc-clause-file-9bP8D`, then **publish** by copying `/sc/` onto `claude/quote-builder-wv-construction-dwtaw` (additive, `/sc/` only) → deploys via `.github/workflows/pages.yml`.
  - Test hub: `https://tailoredquote.co.uk/sc/index.html` · Full site: `…/sc/site/` · Visualiser: `…/sc/demo/extension-visualiser.html`
- The normal `npm run validate` (Vercel build, API routes intact) and the static export must both stay green.

### Standalone artefacts (static, no build — under `/sc/`)
- `index.html` — mobile test hub (links to full site + visualiser, 8 real before/after sliders).
- `demo/extension-visualiser.html` — self-contained visualiser (canvas concept + bring-your-own-key real AI).
- `demo/real/` + `public/examples/` — genuine before/after example image pairs (illustrative, not SC's own projects).

### Structure
- `src/app` (App Router pages + `api/` route handlers + sitemap/robots/opengraph), `src/components` (`ui/` incl. `Breadcrumbs`, `layout/` incl. `MobileCtaBar`, `visualiser/`), `src/lib` (site, services, locations, faqs, guides, **projects**, seo, base, supabase, email, ratelimit, concept-canvas, consent, nav), `supabase/migrations`, `project-templates/case-study-page.tsx.txt` (restore-to-route template).
- Docs: `sc/SITE-UPGRADE-PLAN.md` (June 2026 upgrade plan + outcomes), `sc/LOCAL_SEO_CHECKLIST.md` (GBP/NAP), `sc/STAGE-0-DISCOVERY.md`, `sc/SEO-PLAN.md`, `sc/README.md`, `sc/demo/README.md`.
- **Data-driven content rule:** services/areas/guides are authored in `src/lib/*.ts` arrays (rich optional fields) and rendered by one template each. To add a page, add a data entry — the template, nav dropdown and sitemap pick it up automatically. Keep planning/conservation claims hedged ("often/may", "confirm with Wirral Council/your local authority"); never invent projects/reviews/quals; never use "architect" as the business title.

### Outstanding client decisions (block full launch)
Own domain + Vercel deploy · ARB registration status · publish CH45 6TR vs service-area-only · real project photos + permissioned reviews · Google Business Profile + real Facebook URL · analytics (Plausible) domain + Turnstile/Resend/Gemini/Supabase keys.
