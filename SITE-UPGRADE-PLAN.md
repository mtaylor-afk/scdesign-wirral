# SC Design & Construction — Site Upgrade Plan (June 2026)

Detailed, ordered implementation plan for the local-SEO + conversion + trust
upgrade. Scope is **`/sc/` only** (isolation rule). The brief's 21 sections are
re-grouped into 8 phases of small, independently-shippable chunks. Each chunk
keeps `npm run validate` (typecheck + lint + build) green and the static export
working. No fake reviews / projects / qualifications / approvals. "Architect" is
never used as the business title (Architects Act 1997).

## Architecture notes (why this is tractable)

The site is data-driven: `lib/services.ts`, `lib/locations.ts`, `lib/guides.ts`,
`lib/faqs.ts` arrays feed the dynamic routes (`/services/[slug]`,
`/areas/[slug]`, `/guides/[slug]`) and `sitemap.ts`/`robots.ts`. So most content
expansion = (a) richen the TS type, (b) author content in the array, (c) upgrade
the one page template. New top-level pages are added as folders under `src/app`.

Source order is already correct (skip-link → header → nav → `<main>` → footer).
FAQ accordions (`FAQItem`) and `BeforeAfterSlider` are already keyboard +
aria-expanded accessible. `IS_STATIC` already provides mailto fallbacks.

---

## PHASE A — Foundations (types, nav, breadcrumbs, schema, metadata map)

- **A1. Metadata map → data.** Add optional `metaTitle` / `metaDescription` to
  `Service`, `Location`, `Guide` types and to a central `lib/seo.ts` so every
  page can carry the exact section-19 title/description. Format = "Primary
  keyword Wirral | Brand". Fix the layout `template` so non-home titles read
  "Topic | SC Design & Construction" (no double-brand).
- **A2. WebSite + enriched LocalBusiness JSON-LD.** Add `webSiteJsonLd()`; expand
  `localBusinessJsonLd` areaServed to the full town list, serviceType list,
  knowsAbout, sameAs (only set socials). Keep `ProfessionalService` (design-only;
  not HomeAndConstructionBusiness — that implies construction).
- **A3. Breadcrumb UI component.** `components/ui/Breadcrumbs.tsx` — visible
  ordered trail (replaces the ad-hoc inline `<nav>`), paired with existing
  `breadcrumbJsonLd`. Roll into service/guide/area/legal pages.
- **A4. Nav restructure.** `lib/nav.ts` → grouped model: Services, Areas, Guides
  become hover/click dropdowns (desktop) / expandable groups (mobile). Add
  Projects, Reviews, Contact to nav model. Accessible (`aria-expanded`,
  `aria-controls`, button-driven, keyboard).
- **A5. Footer expansion.** 5 columns: About+name reassurance, Design services,
  Planning/approval services, Explore (Areas/Guides/Projects/Reviews/Process/
  About/FAQs/Visualiser), Get in touch. Add the "despite the name…" reassurance
  line. Legal row unchanged.
- **A6. Sticky mobile CTA bar.** `components/layout/MobileCtaBar.tsx` (client) —
  Call / WhatsApp / Send idea; shown < lg; respects safe-area; not over cookie
  banner. Mount in `layout.tsx`.

## PHASE B — Services (rich template, 4 rewrites, 6 new, hub, comparison)

- **B1. Rich `Service` type.** Add optional structured fields: `category`
  (`design|planning|builder`), `h1`, `whoFor[]`, `included[]`, `notIncluded[]`,
  `planningRoute`, `buildingRegsRoute`, `sendFirst[]`, `localConsiderations`,
  `sections[]`, `relatedServices[]`, `relatedGuides[]`. Optional → backward safe.
- **B2. Service page template v2.** Render the section-5 14-block structure when
  the rich fields exist; fall back to the current simple layout otherwise.
  Breadcrumbs, related services + guides, CTA top & bottom.
- **B3. Rewrite 4 existing services** (house-extensions, loft-conversions,
  residential-design, planning-building-regulations) to the rich structure +
  section-6 content + section-19 metadata. 900–1,400 words each.
- **B4. 6 new service pages** (data entries only — template already renders):
  planning-drawings-wirral, building-regulations-drawings-wirral,
  permitted-development-wirral, lawful-development-certificate-wirral,
  garage-conversion-drawings-wirral, conservation-area-design-wirral.
- **B5. Services hub v2.** Intro + grouped categories (Design / Planning &
  approval / Builder-ready) + plain-English "which service do I need?"
  situation→service comparison table.

## PHASE C — Areas (rich template, enrich 12, add 8, tiered hub)

- **C1. Rich `Location` type.** Add `tier` (`core|wider`), `propertyContext`,
  `localPlanning`, `sections[]`, `relevantServices[]`, `nearby[]`. Optional.
- **C2. Area page template v2.** Render richer sections (600–900 words for core),
  relevant services, nearby areas, breadcrumbs, CTA. Wider-tier pages get a
  genuinely useful (not thin) body.
- **C3. Enrich 12 existing areas** to the rich structure.
- **C4. Add 8 new Wirral areas:** new-brighton, moreton, upton, greasby, oxton,
  port-sunlight, eastham, prenton. Oxton + Port Sunlight = conservation-careful,
  hedged claims ("parts of … are designated conservation areas — confirm with
  Wirral Council").
- **C5. Areas hub v2.** Split Core Wirral vs Wider surrounding; visually prioritise
  Wirral. Section-19 metadata.

## PHASE D — Guides (rich template, expand 4, add 7, grouped hub)

- **D1. Rich `Guide` type.** Add `category`, `summary`, optional `toc` (derived
  from section headings), keep sections/faqs/related/reviewed.
- **D2. Guide page template v2.** Summary box + table-of-contents (anchor links
  from headings) + existing advisory note + related + CTA.
- **D3. Expand 4 existing guides** to 900–1,500 words with Wirral examples.
- **D4. Add 7 new guides:** planning-drawings-vs-building-regulations-drawings,
  permitted-development-rights-wirral, lawful-development-certificate-explained,
  what-drawings-do-builders-need, how-long-does-planning-permission-take-wirral,
  conservation-area-extensions-wirral, loft-conversion-building-regulations.
- **D5. Guides hub v2.** Group into Planning / Building regs / Costs & process /
  Choosing a designer / Conservation & local. "Best next step" links.

## PHASE E — Trust & projects (portfolio restructure, projects, reviews)

- **E1. Portfolio v2.** Keep + relabel as "Project examples & design
  visualisations"; clearly separate "Real projects (coming soon)" placeholders
  from "Concept visualisations" (every AI item labelled illustrative).
- **E2. `/projects` + case-study data model.** `lib/projects.ts` (empty real list
  for now) + `/projects` hub showing clearly-labelled "coming soon" placeholders;
  case-study template renders only when real entries exist; route stays out of
  sitemap until populated (or noindex).
- **E3. `/reviews` page.** "Reviews coming soon" + "leave a Google review"
  placeholder CTA (TODO link). No invented reviews, no self-AggregateRating.

## PHASE F — Conversion pages (home, contact, thank-you, process, about, visualiser, faqs)

- **F1. Homepage v2** (section 3): hero H1/trust-bar, "What we help with" cards
  (link to services incl. new), "Not sure what drawings you need?", "Local design
  knowledge across Wirral", real-proof vs concept split, stronger bottom CTA.
- **F2. Contact form v2** (section 15): postcode*, area, project type, project
  stage, has-builder, timescale, budget(optional), preferred contact, message,
  consent, honeypot; client validation; `IS_STATIC` mailto carries all fields;
  on success → redirect to `/contact/thank-you`.
- **F3. `/contact/thank-you`** page (next steps + phone/WhatsApp).
- **F4. Process v2** (section 9): 10 stages w/ homeowner-does / SC-does / output;
  "what isn't included automatically" note.
- **F5. About v2** (section 10): Sean profile, philosophy, design-only +
  protected-title statement, TODO placeholders for quals/insurance/memberships/
  headshot, trust section.
- **F6. Visualiser page v2** (section 13): intro + strong disclaimer above/below
  the tool, post-generation "send to Sean" CTA (existing SendConceptForm), consent
  clarity + links to terms/privacy.
- **F7. FAQs v2** (section 14): categorised `faqs.ts` (category field) + page
  renders grouped sections; add the new questions.

## PHASE G — Legal, image SEO, accessibility polish

- **G1. Image SEO.** `BeforeAfterSlider` imgs get `width`/`height` + `loading`
  /`decoding`; meaningful alts already present; keep AI labels.
- **G2. Privacy / Cookie / Visualiser-terms review** (section 16): ensure copy
  matches actual behaviour (form, uploads, visualiser no-store, consent-gated
  analytics). Hedge anything not verifiable.
- **G3. Accessibility pass:** focus states, tap targets, nav dropdown keyboard,
  consistent single H1 per page, contrast spot-checks.

## PHASE H — Docs, validation, publish

- **H1. `LOCAL_SEO_CHECKLIST.md`** (section 18) — internal GBP/citation/NAP doc.
- **H2. Update `sitemap.ts`** for new static paths (projects/reviews/contact-
  thank-you) + ensure new services/areas/guides flow through automatically.
- **H3. Full validate** (`npm run typecheck && lint && build`) + static export.
- **H4. Update `sc/CLAUDE.md`** sitemap/route counts + this plan's outcomes.
- **H5. Publish** `/sc/` onto `claude/quote-builder-wv-construction-dwtaw`.

---

## Guardrails (every chunk)
- Wording: "architectural design / designer / drawings"; never "architect(s)" as
  the title. Design-only; no construction claims. No guaranteed approvals.
- Service area = `site.serviceArea` ("Wirral and the surrounding areas"); never
  "20-mile radius".
- New/uncertain facts (conservation areas, processing times) are hedged + carry
  the "confirm with Wirral Council / your local authority" advisory.
- Real business inputs that are missing → clearly-labelled TODO placeholders.
- Keep validate + static export green after each phase.

## TODO placeholders this upgrade will surface (need real client input)
ARB registration status · professional indemnity / public liability insurance ·
qualifications & memberships · publish CH45 6TR or not ·
real project photos + case studies · permissioned reviews + Google review link ·
real Facebook URL · Sean headshot.
