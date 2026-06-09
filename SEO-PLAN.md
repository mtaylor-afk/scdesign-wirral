# SC Design & Construction — SEO Review & Plan

_Last updated: June 2026. Scope: the SC architectural-design site under `/sc/`._

## Where the SEO stands now (baseline — good foundations)

**Already in place (strong):**
- Unique `<title>` + meta description + canonical on every page (`pageMeta`).
- Open Graph + Twitter cards + a generated OG image.
- Valid JSON-LD: `ProfessionalService` (LocalBusiness-style), `Service`, `BreadcrumbList`, `FAQPage`, and now `Article` on guides.
- `sitemap.xml` + `robots.txt` (auto-generated, env-aware).
- Clean information architecture: Home → Services (4) → Areas (hub + 12 unique local pages) → Guides (hub + 4) → Portfolio/Process/About/FAQs/Contact/Visualiser.
- Mobile-first, fast (next/font, static export), accessible (semantic headings, labels, focus states).
- Service-area wording (no published address until approved), honest "illustrative" image labelling.

**Deliberately not done (correct calls):**
- No fake reviews / `AggregateRating` schema (none until real, permissioned reviews exist).
- No thin/duplicate location or service×location pages.
- Exact Facebook URL omitted until confirmed. (Registered company SC Design & Construction Ltd, company no. 11511225.)
- The test deployment on `tailoredquote.co.uk/sc/site` is `noindex` (borrowed domain) — the real, indexable site is the future own-domain Vercel deploy.

## Improvements shipped in this pass
1. Replaced "20-mile radius" with **"Wirral and the surrounding areas"** site-wide.
2. Added a **Guides hub + 4 cornerstone guides** (planning permission, building regs, design cost, architect vs designer) — strong informational + local intent, FAQ-rich, internally linked to services. Added to nav, footer, sitemap.
3. Added an **`/areas` hub** (was missing) for cleaner IA + internal linking.
4. Removed a broken placeholder social link.

## Local-SEO priorities (highest impact first)

### 1. Google Business Profile (off-site, biggest local lever)
- Claim/verify the **Google Business Profile** for SC Design & Construction.
- Keep **NAP consistent** with the site (name, phone `07749 456528`, service-area). Decide public address vs service-area-only (matches `site.addressIsPublic`).
- Category: "Architectural designer" / "Building design". Add services, photos of real projects, and collect genuine reviews.
- This single item typically outweighs most on-page work for local "near me" queries.

### 2. Real content signals
- **Real project photos + short case studies** (with permission) → replace the illustrative examples; add `ImageObject`/project pages. This is the #1 trust + ranking gap.
- **Genuine reviews** (Google + on-site testimonials with permission) → only then add review schema.

### 3. Additional pages worth creating (no thin content — each needs unique copy)

**Guides (next batch) — informational intent, low competition, high trust:**
- `permitted-development-rights-explained`
- `how-long-does-a-house-extension-take` (design → planning → build timeline)
- `single-storey-vs-two-storey-extension`
- `dormer-vs-velux-loft-conversion`
- `what-drawings-do-i-need-for-an-extension`
- `party-wall-agreements-explained` (link out to GOV.UK)
- `extension-ideas-for-a-[semi/terrace/bungalow]` (3 property-type guides)

**Service depth (only if each is genuinely unique):**
- Sub-pages under House Extensions: `rear`, `side-return`, `wraparound`, `kitchen` — each with its own considerations, FAQs, examples. (Defer until real photos exist, or they risk thin content.)

**Local depth (carefully):**
- Keep the 12 area pages unique (done). Only add new towns when there's genuine local detail to write (property types, local planning context). Avoid mass service×location pages.

### 4. Technical / on-page polish (cheap wins)
- Add `sameAs` to Organization JSON-LD once the real Facebook URL + GBP URL exist.
- Consider an `Organization` + `WebSite` (with `SearchAction`) block on the homepage once on the real domain.
- Add `BreadcrumbList` is present; add visible breadcrumbs on more pages for UX (services + guides have them).
- Image `alt` text is descriptive; add width/height on real `<img>` to reduce CLS when real photos land.
- Internal linking: services ↔ guides ↔ areas loop is started; deepen it as content grows.

### 5. Measurement (set up on the real domain)
- Google Search Console (verify, submit sitemap, watch Core Web Vitals + queries).
- Privacy-friendly analytics already wired (consent-gated Plausible) — set the domain.

## Keyword themes to target (Wirral + intent)
- **Transactional/local:** "architectural designer Wirral", "house extension design Wirral / Wallasey / Birkenhead …", "loft conversion drawings Wirral", "planning drawings Wirral".
- **Informational (guides):** "do I need planning permission for an extension", "do I need building regs", "how much do architect drawings cost", "architect vs architectural designer".
- **Visual/AI hook:** "extension visualiser", "what would an extension look like on my house" — the visualiser is a differentiator + link magnet.

## Things blocking full launch (need client input)
- Own domain + Vercel deploy (so the site is indexable with working forms/visualiser server).
- ARB status (confirms safe use of "architect"), public-address decision.
- Real project photography + permissioned reviews.
- Google Business Profile claim + the real Facebook URL.
