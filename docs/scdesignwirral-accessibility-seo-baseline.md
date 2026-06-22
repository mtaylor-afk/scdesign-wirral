# scdesignwirral.co.uk — Accessibility / SEO / Conversion baseline

**Prepared:** 22 June 2026
**Method:** read-only verification pass over the codebase (`C:\dev\scdesign-wirral`,
Next.js 16 App Router static export → Cloudflare Pages; API on Vercel). Three parallel
audits — (1) global layout & a11y internals, (2) routes + SEO infra + area-page
uniqueness, (3) forms + reviews + projects/proof. This is the Phase 0 deliverable from
the *Final Proposed Changes* brief: **verify, document, then change.**

> Headline: the three "major concerns" in the brief are **largely already handled**.
> This is a small, safe punch-list — **not** a rewrite. No destructive SEO changes are
> made until Google Search Console data is reviewed.

---

## 1. The three "major concerns" — verified

| Brief's concern | Reality in the code | Evidence |
|---|---|---|
| **#1 Global nav/footer/CTA before `<main>` H1** ("most important") | **Non-issue.** Source order is correct: skip-link → `<Nav>` → `<main id="main">` → `<Footer>` → `<MobileCtaBar>`. The "global content before content" seen in text extraction is an *extraction artifact*, not the DOM. | `src/app/layout.tsx:53-69` |
| **#2 Proof gaps / misleading trust** | **Already ethical.** No fabricated reviews, no `Review`/`AggregateRating` schema, reviews page is honest, projects page already splits 6 real (permission-confirmed) case studies from AI concepts and labels AI as "illustrative only." | reviews/projects pages; `src/lib/seo.ts` |
| **#3 Area-page doorway risk** | **Non-issue.** All 22 area pages carry genuinely unique intro / local / property-context / planning / FAQ content — no "town-swap" template. | `src/lib/locations` data |

---

## 2. As-found state

### Accessibility (global layout)
- ✅ Skip link → `#main` works and sits above the sticky nav (`layout.tsx:55-62`).
- ✅ Visible focus styles via `:focus-visible`; **no** `outline:none` resets (`globals.css:70-74`).
- ✅ `prefers-reduced-motion` respected (`globals.css`).
- ✅ Mobile menu toggle is a real `<button>` with `aria-expanded`; Escape closes; focus returns to toggle on close.
- ✅ Mobile CTA bar reserves space via a spacer (no content overlap); buttons have text names.
- ⚠️ Mobile toggle lacked `aria-controls`; desktop dropdowns lacked arrow-key handling; no `aria-current="page"`; no print suppression of fixed chrome. **→ fixed in Batch 1 (see changelog).**

### Technical SEO
- ✅ `src/app/sitemap.ts` emits ~57 canonical URLs (services, guides, areas, projects), excludes legal pages intentionally, and is referenced by `src/app/robots.ts`.
- ✅ `robots.ts` disallows only `/api`, `/admin`, `/components-preview`; lists search + AI bots; references the sitemap.
- ✅ Per-page canonicals via `alternates.canonical`; unique titles/descriptions (templated branding, never double-branded) — `src/lib/seo.ts pageMeta()`.
- ✅ JSON-LD on every page incl. `ProfessionalService` (LocalBusiness) + `WebSite` (`layout.tsx:54`), plus `BreadcrumbList`, `FAQPage`, `Article`, `Service`, `Person`.
- ✅ No fake `Review`/`AggregateRating` schema (correct).
- ⚠️ Minor: areas-served list in `seo.ts` (21) vs locations data (22) — reconcile. Verify `/portfolio/*` image paths. Image `width`/`height` + alt audit for CLS. Measure Core Web Vitals. **→ Batch 2.**

### Forms (contact + concept)
- ✅ Every input has a visible associated `<label>`; consent uses a valid implicit label.
- ✅ `autocomplete` on name/tel/email/postal-code.
- ✅ `required` on name + consent; phone-or-email enforced in validation.
- ✅ Error summary (`role="alert"`, focused) + inline field errors (`aria-describedby`).
- ✅ Consent checkbox required and linked to the Privacy Policy.
- ✅ Honeypot hidden + `aria-hidden` + `tabindex=-1`.
- ✅ Backend chain preserved-as-is: primary (QCbuild1 `sc-enquiry`) → Supabase backup + dual email → mailto fallback. **Not** mailto-only. **Do not change this.**

### Proof / conversion
- ✅ Reviews page honest; `ReviewsWidget` shows live Google reviews **or** a "leave a review" CTA — never fabricated. Lights up when `NEXT_PUBLIC_FEATURABLE_WIDGET_ID` / `site.googleReviewUrl` is set.
- ✅ Projects page: 6 real case studies (`homeownerPermissionConfirmed: true`) + clearly-labelled AI concepts.
- ✅ `/contact/thank-you` exists.
- ✅ Click tracking (call / WhatsApp / form_submit) already live via `ClickTracking.tsx`.

---

## 3. Remaining work (the real punch-list)

| Batch | Work | Status |
|---|---|---|
| 1 | Nav `aria-controls` + keyboard dropdowns + `aria-current`; print styles | **Done** (this commit) |
| 2 | Reconcile areas list; verify portfolio images; image dims/alt; Lighthouse CWV | Pending |
| 3 | Protected-title sweep + "Are you architects?" FAQ; service-page structure check | **Done — verified clean** |
| 4 | Trust-signal consistency; review env var | **Verified** (needs Matthew's review URL) |
| 5 | `/contact/thank-you` noindex check; CTA-label consistency | **Done — verified clean** |
| 6 | Cross-device + keyboard + schema + broken-link QA; release report | **Done — verified live + static** |

## 4. Blocked on Matthew (will not guess or fabricate)
1. **Google Search Console export** (top queries/pages, indexed status, CWV, mobile usability) — **required before any area-page keep / merge / noindex decision.** Until then, zero area pages are touched.
2. **Google Business Profile review link** (or Featurable widget id) — needed to surface real reviews. The UI is already wired to light up once the env var is set. No reviews are invented.
3. *(Optional)* ARB registration status — default is to keep "architectural designer" / "Chartered Architectural Technologist" / "MCIAT" wording unchanged.

---

## Changelog
- **2026-06-22 — Batch 1 (accessibility):** `Nav.tsx` — added `aria-controls` to the
  mobile toggle and a stable `id="mobile-menu"` (menu now always-rendered, hidden via the
  `[hidden]` attribute when closed); ArrowDown-to-open + blur-to-close keyboard handling on
  desktop dropdowns; `aria-current="page"` + active styling on desktop & mobile nav links.
  `globals.css` — `@media print { .no-print { display:none } }`; applied `no-print` to the
  sticky header, `MobileCtaBar`, and `ConsentBanner`. `MobileCtaBar.tsx` — explicit
  `aria-label`s (Call Sean / Message Sean on WhatsApp / Send Sean your project idea).
- **2026-06-22 — Batch 2 (technical SEO):** verification came back clean — `areasServed`
  (20 towns + "Wirral") already maps 1:1 to the 20 area-page slugs (the "21 vs 22" was a
  miscount); all 7 project `/portfolio/*` images and the `/examples/*` refs exist on disk
  (no broken paths; the `househront` filename typo is consistent in code + disk so it
  resolves); every static/crawlable image already has explicit `width`/`height` + meaningful
  `alt`, and the runtime visualiser images use `aspect-[3/2]` to reserve space (no CLS).
  **One fix:** `BeforeAfterSlider.tsx` now sets `fetchPriority="high"` on the hero (priority)
  images for a faster LCP. **CWV note:** PageSpeed Insights' anonymous API was rate-limited
  (429) and a reliable local Lighthouse run wasn't available in this environment — Matthew
  can run PSI in-browser for live numbers; the structural CWV risk factors (lazy LCP image,
  missing image dims, render-blocking fonts/CSS, layout-shifting media) are all already
  mitigated in the code.
- **2026-06-22 — Batch 3 (content quality):** verification clean, no changes. Protected-title
  compliance is already exemplary — every standalone "architect" use is the deliberate
  disclaimer/education context ("we are **not** registered architects"), an ARB reference, or
  a legal-flag code comment; the **"Are you architects?" FAQ already exists** (`faqs.ts`), plus
  an "architect vs architectural designer" FAQ and full guide. All **11** service pages
  (`services.ts` is 1160 lines — Grep truncates it, so it was read directly) carry the full
  recommended structure: *Who this is for* (`whoFor`), *What's included* (`included`), *What
  may be separate* (`notIncluded`) and a *What to send Sean* next-step (`sendFirst` + CTAs);
  services 7–11 use the generic `sections` field for the planning/building-regs prose.
- **2026-06-22 — Batch 4/5 (trust + conversion):** verification clean, no changes.
  `/contact/thank-you` is `noindex` with a 3-step "What happens next" + Call/WhatsApp;
  CTA copy is centralised in `site.ts` (`Send Sean your idea` / `WhatsApp Sean` / `Call Sean`)
  and reused; trust signals (Sean Corser MCIAT, company no. 11511225 + registered office,
  design-only scope) are consistent. The Google-reviews path is already wired — set
  **`NEXT_PUBLIC_GOOGLE_REVIEW_URL`** (and optionally `NEXT_PUBLIC_FEATURABLE_WIDGET_ID`) in
  the **Cloudflare Pages** build env once the Google Business Profile is verified, then
  redeploy; blank stays an honest "leave a review" fallback (never fake reviews/ratings).
- **2026-06-22 — Batch 6 (final QA & release):** the production export was served locally
  (`python -m http.server` on `out/`) and exercised in a headless browser.
  **Live accessibility — all pass:** mobile menu toggles correctly (`aria-expanded` and
  `aria-label` flip, the `[hidden]` attribute toggles, and links leave the a11y tree when
  closed); **Escape** closes it; the desktop dropdown **ArrowDown** opens the panel *and*
  moves focus to the first link ("Extensions"); the dropdown **blur-closes** when focus
  leaves it (Tab-out); `aria-current="page"` renders correctly (0 on home, 3 on a service
  page). **Layout:** no horizontal scroll at 320px (0 px overflow); the mobile CTA bar
  (Call / WhatsApp / Send idea) renders cleanly. **No console errors.**
  **Static SEO/QA checks:** `out/404.html` present; `robots.txt` correct (Allow `/`, Disallow
  `/api` `/admin` `/components-preview`, sitemap referenced); `sitemap.xml` = 78 URLs; homepage
  emits 4 JSON-LD blocks; `/contact/thank-you` carries `noindex`; the hero `<img>` carries
  `fetchpriority="high"`. *Note:* the `__next.*.txt` 404s seen under the bare static file
  server are harmless — they're Next's client-router RSC prefetch payloads; real navigation
  falls back to the 200 HTML pages, and Cloudflare Pages serves the export correctly.
