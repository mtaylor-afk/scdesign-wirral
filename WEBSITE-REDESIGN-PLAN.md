# SC Design — Website Redesign: Implementation Plan & Questions

_Prepared from Sean's brief ("Matt Website page" .docx) + a codebase gap-analysis and research on the three uncertain areas. Status: planning. Nothing is built yet — several items are blocked on answers from Sean (see the Questions section)._

---

## 1. Context — what the brief is asking for

The brief is a **whole-site evolution of the existing live site** (scdesignwirral.co.uk), not a rebuild. Sean even references his own current sections (the "what we help with" grid, the FAQ accordion) as things to keep and adapt. The major shifts:

- **Rebrand** to a **red / white / beige / light-grey** palette with the red "SC" logo, deliberately **less "polished/expensive"** than big architecture firms — aimed at **homeowners / growing families**.
- **Positioning** moves toward his real marketing identity — **"SC Design & Construction", "DESIGN · PLAN · BUILD", "concept to completion"** — which is in **direct tension** with the current site's strict *"design only — we don't build"* stance. **This is the single most important thing to resolve** (it changes copy, services and legal wording site-wide).
- **Credentials** he now wants stated: ~15 yrs in architectural design, 6 yrs as a builder, **BSc Architectural Technology**, **CIAT membership**. The current site deliberately claimed none of these.
- **Expanded service area** — from ~20 Wirral towns to **~59** across Wirral / Cheshire / North Wales / Warrington / Liverpool / Southport.
- **Revised services** — 10, several new (front porch, garden room, change of use, measured surveys, concept/feasibility, full architectural service).
- **Three substantial new features** — an **interactive clickable house** (planning rules per feature), a **rotating Google-reviews window**, and **estimated cost** in the visualiser.
- **Case studies / before-after** — real client projects Sean will supply later.

---

## 2. Hard constraints carried into every option (non-negotiable)

- **"Architect" is a protected title** (Architects Act 1997). Sean is **not** ARB-registered, so the word "architect" must never appear in the name, titles, headings, meta or copy. **"Architectural" / "architecture" are fine** (only "architect" is protected). We keep the existing ARB-safe rule.
- **No fabricated proof** — no invented reviews, ratings, testimonials, case-study outcomes, or `AggregateRating` schema. Real reviews come via a compliant widget or permissioned testimonials only.
- **CIAT wording depends on his grade** — only a **Chartered** member (MCIAT) may use "Chartered Architectural Technologist" + MCIAT. We confirm grade before writing any credential copy.
- **Advertising must not mislead** (ASA/CAP + consumer law + CIAT code) — so "Build / Construction / concept to completion" can only go live if it honestly reflects what Sean actually does.

---

## 3. Recommended approach

Evolve the existing **data-driven architecture** (services/locations/guides authored in `src/lib/*.ts` arrays, rendered by one template each; tokens in one `globals.css` block). This means most changes cascade and we avoid a rebuild. Roll out in phases; ship the visible rebrand early, tackle the big new features and blocked items separately.

### Decisions I'll take autonomously (no need to ask)
- Reuse the data-driven structure + existing templates; no framework change.
- **Reviews:** Featurable free embed for the rotating window (no API key, fits the static export, carries the Google ToS/attribution itself) — not the Places API (key can't be hidden in a static bundle; 5-review cap; caching limits).
- **Interactive house:** a **custom inline SVG with native `<button>` hotspots** + a typed `houseFeatures` data file + a detail panel — the most accessible, on-brand, maintainable option (not a stock 3D raster + image-map).
- Keep ARB-safe wording; never "architect". No fabricated content. England-based PD guidance with "confirm with your council" disclaimers.
- Phased rollout; blocked items (cost engine, real reviews, real case studies) are scaffolded now and populated later.

---

## 4. Phased implementation plan

| Phase | Scope | Effort | Blocked by |
|---|---|---|---|
| **1 — Rebrand / tokens** | New red/beige/white/light-grey palette in `globals.css` `@theme`; swap to the SC red logo; AA-contrast pass; flatter/"friendlier" tweaks to drop the premium feel. Cascades to all components. | S–M | Final red hex + logo choice |
| **2 — Config + positioning + credentials** | `site.ts`: add credentials (BSc, CIAT grade), fix socials (Instagram `sc.design.wirral`, Facebook), service-area copy. Apply the confirmed **design-vs-build** wording site-wide. Update Person/JSON-LD (no "architect"). | S–M | **Positioning answer**, **CIAT grade** |
| **3 — Services restructure** | Add 3 new services (Front Porch, Change of Use, Measured Surveys); resolve Garden Room vs Garage Conversion; rename `residential-design` → "Full Architectural Design / Concept & Feasibility"; update nav/footer/sitemap/cross-links. | M | Final service list |
| **4 — Homepage** | New headline (residential/growing families); adapt the "what we help with" grid so cards open a **service breakdown with example photos**; **rotating reviews** widget; a few project images; bio paragraph; consultation CTA / enquiry form. | M | About-on-home decision; example photos; reviews setup |
| **5 — Interactive house guide** (NEW) | Custom SVG house + button hotspots + `houseFeatures` data file + detail panel + PD rules table + guide accordion. England-focused, disclaimers, lead-gen CTA. | M–L | Artwork choice, feature list, views, **Wales PD note** |
| **6 — Areas expansion** | Add ~39 locations (N Wales, mid-Cheshire, Warrington, Southport, Knowsley/Sefton), tiered. **SEO risk:** 59 near-duplicate town pages can be flagged as thin — recommend **main towns = full pages, secondary = a covered-areas list**, each page genuinely local. | L | Final town lists; page-per-town vs list decision |
| **7 — Visualiser restyle + cost** | Reskin to new brand; **estimated-cost output**. The cost engine is **not** in the current SC backend; needs the TailoredQuote/QCbuild1 pricing logic (if any) or a new parametric £/m² model. | M–L | **Is a cost engine available?** scope/data |
| **8 — Case studies** | Build the case-study + before/after gallery templates now; populate when Sean supplies real briefs + photos. AI can draft copy + concept renders; **real before/after photos must be his own** (no fabrication). | M | Sean's content |
| **9 — Contacts + final QA** | Consolidate links/credentials; full build + a11y + AA contrast + mobile pass; deploy. | S–M | — |

**Rough order:** ship Phases 1–4 first (the visible "new website"), then 5–8 (big new features / blocked items), then 9. Realistically a few weeks of build once the questions below are answered.

---

## 5. Open questions for Sean

> These are the things I genuinely cannot decide for him — business facts, legal/credential facts, and content only he has. Grouped by theme; the **bold** ones block the most work.

### A. Positioning — design vs build _(biggest one; blocks copy, services, legal)_
1. **Do you physically carry out construction yourself, or manage/coordinate builds through trusted contractor partners, or is it design-only (the client hires their own builder)?**
2. **Should "Construction" / "Build" stay in the brand and headlines?** Is "SC Design & Construction Ltd" definitely the trading name going forward?
3. Do named builder/contractor partnerships genuinely exist that we could reference (and evidence if challenged)?
4. Who holds the **liability/contract** for any built work — you, the contractor, or the client directly?
5. Does your **insurance** (professional indemnity / public liability) cover construction, or design only?

### B. Credentials & titles _(blocks the About copy + schema)_
6. **Exact CIAT grade — Chartered (MCIAT), Associate (ACIAT), student, or affiliate? And is it current/in good standing?** _(Only MCIAT can be called "Chartered Architectural Technologist" with MCIAT post-nominals; an Associate cannot.)_
7. Confirm you are **not** ARB-registered (so we lock out "architect" everywhere).
8. Exact **degree** wording + institution + year (e.g. "BSc (Hons) Architectural Technology, [Uni], [year]").
9. Any other CIAT roles (e.g. CIAT-registered **Principal Designer**) you'd like featured?
10. OK to phrase your experience as **"15+ years in architectural design / architectural technology"** (not "as an architect")?

### C. Brand & visual style
11. The palette — do you have an exact **brand red** (hex), or shall I match it from your collateral? Is the final logo the **red "SC" circle**, the **"SC Design & Construction"** lockup, or both (icon + wordmark)?
12. "Less polished than the big firms" — happy with a **friendlier, flatter, lightly-illustrated** look (vs the current premium style)?
13. Brand fonts — any you want used, or keep the current ones tuned to the new palette?

### D. Pages & structure
14. **About** — its own page, or merged into the Home page? _(You asked this.)_
15. A **photo of you** on About/Home? _(You asked — I'd recommend yes; it builds trust for a small/personal practice.)_
16. Consultation — a **"Book a free consultation" button** (linking to what — a booking tool, email, or phone?), a **project enquiry form** (name / email / phone / description), or both?

### E. Service area
17. Confirm the final **Main** vs **Secondary** town lists (I have ~37 + ~22 from your doc).
18. **One page per town** (better local SEO, but ~59 pages risks being flagged as thin/duplicate) **or** main towns as full pages + secondary as a "covered areas" list? _(I recommend the latter.)_
19. Keep **service-area-only** (no published street address)? The current live site publishes the **Wallasey trading address** — remove it from the footer/About?

### F. Services
20. Confirm the final **10 services**, and which current ones to drop or merge (e.g. should Conservation-Area, Lawful-Development-Certificate, and Permitted-Development stay as standalone services?).
21. **"Bespoke Garden Room"** — a separate service, or is this your current "Garage Conversion"? Do you want **both**?
22. The "what we help with" cards opening a **service breakdown with example photos** — can you supply 1–3 example photos per service?

### G. Visualiser & cost estimate
23. On the home page: the **AI visualiser** or a **"real render"** style — which? _(You asked.)_ Or both?
24. **Cost / estimated-price feature** — do you want this in the visualiser? It needs a pricing engine. Does the **TailoredQuote / QCbuild1** system already produce cost estimates we can reuse (the "£50k" demo was a TailoredQuote/Hartwell example), or is this a **new build**?
25. If new: what **cost ranges** are realistic now (you said extensions cost more than that)? Rough **£/m²** or per-project "from £X" ranges, with an "estimate only" disclaimer?

### H. Reviews
26. Is your **Google Business Profile** live with reviews? Please share the **profile link / Place ID**. _(You'll authorise the widget by signing in with the Google account that manages the listing.)_
27. The rotating reviews widget — OK with the **free Featurable** plan (small "Powered by" badge), or pay (~$29/mo) to remove branding / use Elfsight?
28. _(Note: we will only show your genuine Google reviews via the widget, or testimonials you collect with permission — no fabricated reviews and no self-serving star-rating schema, which Google disqualifies anyway.)_

### I. Interactive house
29. **Artwork** — a **custom illustrated SVG house** (my recommendation: on-brand, you own it, accessible, themeable) or the **photoreal 3D cutaway** from your reference image (needs a stock licence, less flexible, can look generic)?
30. Confirm the **feature hotspots**: front porch, front dormer, rear dormer, garage conversion, side extension, single-storey rear, two-storey rear — anything to add (garden room / outbuilding, solar panels, render/cladding, dropped kerb, boundary walls)?
31. **Views** — one three-quarter view, or also a **separate rear view** and/or **interior cutaway**? (More views = more artwork + a view-switcher.)
32. **Content depth** per feature — a short "do I need permission?" summary, or full PD limits + building-regs + caveats + a Planning Portal link?
33. **⚠️ Wales note:** you cover **North Wales** (Wrexham, Mold, Buckley, Connah Quay), and permitted-development rules **differ in Wales vs England**. Should the house guide be **England-only** (with a "Wales differs — ask us" note), or do you want Welsh rules covered too?

### J. Case studies
34. You'll send previous projects (Anto, Lee, others) with brief descriptions + before/after photos on a separate file — confirm. **Can AI build it?** AI can draft the write-ups and generate *concept* renders, but the **before/after photos must be your real ones** (we won't fabricate client outcomes).
35. Structure — a **minimal before/after gallery** page _plus_ a more detailed **case-studies** page (your suggested two-tier split)? Confirm.

### K. Details to confirm
36. **Instagram** — your doc says `sc.design.wirral`; the current site has `sc.architectural.design`. Which is correct?
37. **Facebook** `/SCDesignAndConstruction` — confirm.
38. Keep displaying **Company no. 11511225**? (Assume yes.)

---

## 6. Things I'll handle without needing input
- Reskin mechanics, AA-contrast fixes, the data-file scaffolding, templates, nav/sitemap wiring, the interactive-house component + PD data model, the reviews widget integration, and all QA.
- Keeping every change ARB-safe and free of fabricated proof.
- Documenting decisions in `CLAUDE.md` as we go.

## 7. Key references (research sources)
- Title/credentials: ARB title-protection guidance; CIAT "recommended titles and descriptors"; ASA/CAP misleading-advertising code; CIAT Code of Conduct.
- Reviews: Google Places API policies (attribution/caching/5-review cap); Featurable / Elfsight; Google review-snippet & self-serving-schema rules.
- Interactive house: accessible-SVG patterns (native buttons, not SVG `<title>` for names); WCAG target-size; Planning Portal common projects + GOV.UK householder PD technical guidance.
