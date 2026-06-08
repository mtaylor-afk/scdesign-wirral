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

**Project:** Premium website for **SC Design & Construction** (Sean Corser, Wallasey/Wirral) + an AI "Extension Concept Visualiser" lead magnet.

> **Legal entity:** Sean trades as a **SOLE TRADER** under the business name "SC Design & Construction". There is **NO limited company** — never append "Ltd"/"Limited", never claim a Companies House registration, and never display a company number anywhere. (`site.name` is the bare business name; the `companiesHouseNumber` field has been removed.)

### Confirmed client decisions
- **Service stance: DESIGN-ONLY** (architectural design + planning drawings). The business does **NOT** carry out construction — never make build/construction claims.
- **Wording: "architect / architectural design" IS approved** by the client. Lead with "architectural design / architectural drawings".
  - ⚠️ **LEGAL FLAG (Architects Act 1997):** the bare title *"architect"* is protected — only an **ARB-registered** person may use it. "Architectural design / designer / drawings" is the safe form. **Confirm Sean's ARB registration before launch** if the bare title is used anywhere.

### Stack (verified June 2026)
- Next.js **16.x** (App Router, TS, Tailwind **v4**, ESLint) · Vercel · Supabase (DB/Storage/rate-limit/leads — service-role key **server-only**) · Resend (email, abstracted) · Plausible (consent-gated) · Cloudflare Turnstile · Visualiser API on **Node runtime** + **Sharp 0.34** · AI = `gemini-2.5-flash-image` (Replicate fallback deferred).

### Hard rules (carried from the brief)
- No fake testimonials / no invented certifications.
- Do not publish CH45 6TR address unless approved (`site.addressIsPublic = false` by default → service-area wording).
- **Sole trader, NOT a limited company** — never use "Ltd"/"Limited" or a Companies House number (a sole trader has none).
- No thin/duplicate location pages — each of the 12 must be unique.
- Visualiser output is a **concept only**, never presented as buildable/planning-ready.
- No non-consented analytics; server-side rate limiting only; Sharp on Node runtime (never Edge).
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
- **Trust:** `lib/projects.ts` (real list **empty** — never invent; placeholders are labelled "coming soon"); `/reviews` shows "coming soon" + a Google-review CTA that only renders once a real URL is set. Portfolio relabelled "Project examples & design visualisations", AI items all labelled illustrative.
- **Image SEO:** `BeforeAfterSlider` imgs carry `width`/`height`/`loading`/`decoding` + a `priority` opt-out (home hero is eager).
- `LOCAL_SEO_CHECKLIST.md` — internal GBP/citations/NAP doc.

### Visualiser — LIVE photoreal AI render (primary path since June 2026)
The `/visualiser` page (H1 + browser title **"See your idea come to life"**) produces a **photorealistic** extension render via OpenAI `gpt-image-1`, shown as the original and proposed images **side by side** on the result step. The old in-browser canvas overlay is retained ONLY as an automatic fallback. Runs with **zero owner action** by reusing TailoredQuote's existing infrastructure (explicitly owner-authorised for image-generation purposes — it does not affect TailoredQuote).

- **Backend: `api/sc-visualise.js`** (repo-ROOT, NOT `/sc/`). The one authorised exception to the "/sc/-only" rule — Vercel only deploys serverless functions from the root `/api/`, so the function lives there while all UI/source stays in `/sc/`. Fully isolated: imports only `openai`, touches no TailoredQuote function/RPC/table, and is called cross-origin from the static SC site (the same static→`q-cbuild1.vercel.app` pattern the TQ demo uses). Deploys automatically on push to `claude/quote-builder-wv-construction-dwtaw` (Vercel production tracks that branch — confirmed live).
  - **OpenAI key resolution:** env `OPENAI_API_KEY` → fallback to `client_accounts.openai_key` read via `SUPABASE_SERVICE_ROLE_KEY` (read-only), mirroring the live TQ demo functions. TQ stores its key in the DB, not the env var, so the **DB fallback is what actually resolves** (health check returns `keyConfigured:true, envKey:false, serviceKey:true`). Reuses the SAME existing key — nothing to configure.
  - **CORS** locked to `tailoredquote.co.uk` (+ www + `q-cbuild1.vercel.app`). Best-effort in-memory rate limit (12/IP/hour, 200/day). `maxDuration:120` registered in root `vercel.json` (additive; no existing TQ entry changed).
  - **gpt-image-1 call:** `images.edit` with `input_fidelity:'high'`, `quality:'medium'`, at a **native size matching the input aspect ratio** (`pickNativeSize`/`pickOutputSize` → 1024², 1536×1024, 1024×1536) to avoid the documented room-shrinkage artefact. Returns base64; **the source photo is held in memory only, never persisted.**
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
- **Reviews:** `ui/ReviewCta.tsx` (Google button only when `site.googleReviewUrl` set, else honest placeholder) on home/contact/footer/reviews; `/reviews` rebuilt (themes, not fake quotes). `google_review_click` tracked.
- **Schema:** `personJsonLd()` (Sean, ARB-safe — **no** ARB/RIBA/quals/insurance) on `/about`; `articleJsonLd()` now has Person author + `mainEntityOfPage` + parsed `dateModified`.
- **Guides:** `ui/ReviewedBy.tsx` + "What to send Sean" checklist + category-driven official-source links (verified URLs only).
- **Projects:** 6 named draft placeholders with the exact "details to be added once homeowner permission…" note; `Project` type extended; real list stays empty (no draft pages indexed).
- **About:** qualifications/insurance/company-number/address owner-checklist (pending, never claimed).
- **Linking:** service→priority-area links; area→guides + honest per-area "case studies coming soon" + ReviewCta. **`Location.noindex`** flag is the owner switch for the 5 wider areas (liverpool/chester/crosby/ellesmere-port/neston) — default unset → indexed.
- **Forms:** contact funnel events `contact_form_submit | _success | _error` (replaced `contact_submit`).
- **Config knobs:** `NEXT_PUBLIC_GOOGLE_REVIEW_URL` (blank→placeholder) and `NEXT_PUBLIC_NOINDEX` (documented in `.env.example` / `.env.production`).
- **Owner TODOs (never invent):** GBP + Google review URL · address publish-vs-service-area · Sean's quals/memberships/insurance · confirm "18+ years" · profile photo · real projects/images/permission · real reviews · keep wider areas indexed? · analytics provider + consent. (See also `LOCAL_SEO_CHECKLIST.md`.) _(No Companies House number — sole trader.)_

#### Domain go-live polish (June 2026 — links, form routing, TailoredQuote attribution; all live)
Small targeted pass after `scdesignwirral.co.uk` went live. In-repo changes (built, pushed to `main`, verified live):
- **URL self-references:** `siteUrl` fallback in `src/lib/seo.ts` changed from `https://www.example.com` → `https://scdesignwirral.co.uk`, so canonical/OG/JSON-LD/`metadataBase` can never emit `example.com` even if `NEXT_PUBLIC_SITE_URL` is unset. Prod sets the env var anyway; verified `example.com` appears 0× in `out/`. The `q-cbuild1.vercel.app/api/sc-visualise` reference is the functional render endpoint, NOT a user-facing URL — left as-is.
- **Form routing → both inboxes:** new `site.formRecipients = [gmail, icloud]` single source of truth. The **contact** form (`ContactForm.tsx`) and **send-concept** form (`SendConceptForm.tsx`) static `mailto:` now address both `scdesignandconstruction1@gmail.com` + `matthewjtaylor1985@icloud.com` at once. `site.email` (public business address in JSON-LD / policy pages) unchanged. NOTE: the static site has no server, so the visitor's mail client shows both addresses in the To line.
- **TailoredQuote attribution link:** under the visualiser upload notice (`VisualiserApp.tsx`), "Visualised images powered by **TailoredQuote.co.uk**" → `https://tailoredquote.co.uk`. Wordmark style matches the TQ logo — `Tailored` = `text-ink`, `Quote` = `text-[#2563eb]` (same blue already on the homepage), `.co.uk` = `text-muted`, bold; prefix in the site's Inter/muted body style.
- **PENDING — visualiser EMAIL (lives in the TailoredQuote backend `api/sc-visualise.js`, NOT this repo — see Email workflow above; owner chose "skip backend for now"):**
  - **Result email styling:** add a prominent link to `https://scdesignwirral.co.uk` at the TOP of the customer result email; add a bottom line "Image generation powered by TailoredQuote.co.uk" linking to the site, using the same wordmark style as above.
  - **Recipients (owner: "keep all three"):** `NOTIFY_RECIPIENTS` should become gmail + icloud + outlook (i.e. **add** `scdesignandconstruction1@gmail.com` to the existing `matthewjtaylor1985@icloud.com` + `scdesignandconstruction@outlook.com`). Customer-result email (sent to the visitor) is unaffected.

#### Sole-trader entity + footer attribution + full QA pass (June 2026 — all live)
- **"Ltd" removed everywhere (Sean is a sole trader, no limited company):** `site.name` "SC Design & Construction Ltd" → "SC Design & Construction" (cascades to footer, page titles, OpenGraph `siteName`, all JSON-LD). Removed the `companiesHouseNumber` field + the footer "Company No." line + the About page Companies-House checklist item; legal-pages "Ltd" wording dropped; "company name" → "business name" (footer + About). Standing rule now at the top of these Project Notes. Verified 0 `Ltd`/`Company No`/`Companies House` in `out/`.
- **TailoredQuote attribution in the global footer (site-wide, centred):** the "Visualised images powered by **TailoredQuote.co.uk**" wordmark link now also sits in `Footer.tsx`'s bottom bar (centre-aligned) so it shows on every page. Dark-footer colour adaptation: `Tailored` = `text-paper`, `.co.uk` = `text-paper/50`; `Quote` started at `#2563eb` but failed AA on `bg-ink` (3.26:1) so is now **`#7aa2f7`** (6.7:1). The visualiser-page wordmark on light bg keeps `#2563eb`.
- **Full QA review (multi-agent, adversarially verified — 11 confirmed fixes, 11 false positives rejected):**
  - **Contrast (WCAG AA):** primary CTA buttons used `bg-accent` `#b9743f` + white = 3.73:1 (fail) site-wide → switched to `bg-accent-strong` `#a45f2d` (4.94:1) with a NEW `--color-accent-deep #8f4f24` hover token (6.34:1), applied to the shared `Button` primary variant + the hardcoded copies (Nav ×2, MobileCtaBar, ConsentBanner, error, process step badge). Form placeholders `--color-muted-soft` (2.80:1) → `--color-muted` (5.15:1). Footer review-CTA placeholder `text-paper/40` → `/60`. **Design rule learned:** `--color-accent` `#b9743f` is AA only on *dark* surfaces / decorative use; use `--color-accent-strong` for white text or text on light, and the lighter `--color-accent` for accent text on `bg-ink` (e.g. `page.tsx` visualiser-teaser eyebrow, correctly left as `text-accent` = 4.56:1).
  - **Keyboard / focus:** `ServiceCard` had `focus-visible:outline-none` with no replacement → removed so the global accent outline shows. Mobile nav now closes on **Escape** and restores focus to the toggle.
  - **Mobile / touch:** `MobileCtaBar` spacer now `calc(4rem + env(safe-area-inset-bottom))` so the fixed bar can't hide the footer tail on notched phones. `BeforeAfterSlider` touch handlers are press-gated by the `dragging` ref (+ `onTouchEnd/Cancel`) so the divider no longer jumps on a tap or a scroll-from-image.
  - **Cross-browser:** `Select` dropped `appearance-none` (it had no replacement chevron → looked like a text box) so the native arrow renders on Chrome/Safari/Firefox/Edge.
  - **Minor:** visualiser revokes the upload blob URL on unmount; guide "Related" chips map `/process`,`/about`,`/contact`,`/visualiser` to friendly labels instead of raw lowercase.
  - Verified: `tsc` + ESLint + build all clean; live DOM/CSS spot-check on `scdesignwirral.co.uk` confirms all shipped. NOTE: automated cross-browser *visual* rendering was not run (no Chrome extension / preview server bound to this repo) — correctness rests on the computed contrast ratios, code review, and the live DOM/CSS check.

#### DEFERRED (planning only, not started) — visitor/error logging + admin panel (June 2026)
Owner asked what's needed before commissioning an in-site admin panel that logs visitors + errors. Analysis to carry forward when the work is picked up:
- **Core blocker:** the site is a **static export** (`next.config.ts` → `output: "export"`, Cloudflare Pages) with **no backend** — it cannot write to a DB or host a protected `/admin` page on its own. A real solution needs three things, only one of which is a database: (1) a datastore, (2) server-side compute, (3) admin authentication.
- **Already in the repo but dormant:** consent-gated **Plausible** (`Analytics.tsx`; activates when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set; `track()` already fires custom events) and a **server-only Supabase** client (`supabase.ts` — dead under static export, no server to run it).
- **Lowest-effort path (recommended first):** hosted dashboards — turn on Plausible (or Cloudflare Web Analytics, free/privacy-first) for visitors + **Sentry** (free tier, ingests browser errors directly) for errors. These need no backend and may remove the need to build a panel at all.
- **If a custom in-site `/admin` is genuinely wanted:** Cloudflare-native is the best fit (same host) — **Pages Functions** + **D1** (SQLite SQL DB) or Analytics Engine + **Cloudflare Access** for admin auth; alternatively reactivate **Supabase** (Postgres + auth); last resort, drop static export for a server deploy.
- **Owner must provide before build:** chosen path; provisioned account/DB; credentials as **Cloudflare Pages env vars** (never committed); admin auth (Cloudflare Access = simplest); what to log + retention; **GDPR/PECR** decision — IP addresses are personal data, so decide anonymisation/consent and update the privacy + cookie policy to match the existing consent-banner stance.

### Deployment & how to view it (no own domain yet)
- **Static export** for GitHub Pages: `./scripts/build-static.sh` → writes `sc/site/` (env-driven `output: export` + `basePath=/sc/site` + `trailingSlash`; API routes moved aside during the build). `next.config.ts` reads `SC_STATIC_EXPORT` / `NEXT_PUBLIC_BASE_PATH` / `NEXT_PUBLIC_STATIC` / `NEXT_PUBLIC_SITE_URL`.
- **`src/lib/base.ts`** — `withBase()` prefixes raw asset/anchor paths; `IS_STATIC` toggles the no-server form fallbacks (contact + send-concept open a prefilled email).
- **Live viewing** (GitHub Pages serves only `main` + `claude/quote-builder-wv-construction-dwtaw`): develop on `claude/sc-clause-file-9bP8D`, then **publish** by copying `/sc/` onto `claude/quote-builder-wv-construction-dwtaw` (additive, `/sc/` only) → deploys via `.github/workflows/pages.yml`.
  - Test hub: `https://tailoredquote.co.uk/sc/index.html` · Full site: `…/sc/site/` · Visualiser: `…/sc/demo/extension-visualiser.html`
- The normal `npm run validate` (Vercel build, API routes intact) and the static export must both stay green.

### Standalone artefacts (static, no build — under `/sc/`)
- `index.html` — mobile test hub (links to full site + visualiser, 8 real before/after sliders).
- `demo/extension-visualiser.html` — self-contained visualiser (canvas concept + bring-your-own-key real AI).
- `demo/real/` + `public/examples/` — genuine before/after example image pairs (illustrative, not SC's own projects).

### Structure
- `src/app` (App Router pages + `api/` route handlers + sitemap/robots/opengraph), `src/components` (`ui/` incl. `Breadcrumbs`, `layout/` incl. `MobileCtaBar`, `visualiser/`), `src/lib` (site, services, locations, faqs, guides, **projects**, seo, base, supabase, email, ratelimit, concept-canvas, consent, nav), `supabase/migrations`, `scripts/build-static.sh`, `project-templates/case-study-page.tsx.txt` (restore-to-route template).
- Docs: `sc/SITE-UPGRADE-PLAN.md` (June 2026 upgrade plan + outcomes), `sc/LOCAL_SEO_CHECKLIST.md` (GBP/NAP), `sc/STAGE-0-DISCOVERY.md`, `sc/SEO-PLAN.md`, `sc/README.md`, `sc/demo/README.md`.
- **Data-driven content rule:** services/areas/guides are authored in `src/lib/*.ts` arrays (rich optional fields) and rendered by one template each. To add a page, add a data entry — the template, nav dropdown and sitemap pick it up automatically. Keep planning/conservation claims hedged ("often/may", "confirm with Wirral Council/your local authority"); never invent projects/reviews/quals; never use "architect" as the business title.

### Outstanding client decisions (block full launch)
Own domain + Vercel deploy · ARB registration status · publish CH45 6TR vs service-area-only · real project photos + permissioned reviews · Google Business Profile + real Facebook URL · analytics (Plausible) domain + Turnstile/Resend/Gemini/Supabase keys.
