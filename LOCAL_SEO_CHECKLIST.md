# Local SEO Checklist — SC Design & Construction

Internal owner checklist (not a public page). Covers Google Business Profile
(GBP), citations and the consistency that local ranking depends on. Pair this
with the on-site work already done (LocalBusiness schema, area pages, service
pages, guides).

## NAP — keep it identical everywhere

Use this exact information on the website, GBP, and every directory/citation.
Inconsistent NAP (name, address, phone) is one of the most common local-SEO
problems.

- **Business name:** SC Design & Construction Ltd (registered company no. 11511225,
  England & Wales). The display brand "SC Design & Construction" is fine for the GBP /
  branding; use the full "Ltd" name where the legal entity is stated. **Do not**
  keyword-stuff it (e.g. not "SC Design & Construction | Architectural Designer Wirral").
- **Contact:** Sean Corser
- **Phone:** 07749 456528 (display) / +447749456528 (tel:)
- **Email:** scdesignandconstruction1@gmail.com
- **Service area:** Wirral and the surrounding areas (Wallasey base)
  - **Trading address (published):** 20 Ripon Road, Wallasey, Wirral, CH45 6TR
    (`site.addressIsPublic = true`). NOTE the Companies House **registered office** is
    different (Seymour Chambers, 92 London Road, Liverpool, L3 5NW) — keep the GBP / NAP
    on the Wallasey trading address, consistently across all citations.

## Google Business Profile (GBP)

- [ ] Create / claim the GBP for the real business name (no keyword stuffing).
- [ ] **Primary category:** choose the closest legitimate option — likely
      *Architectural designer* or *Architectural design firm* (avoid "Architect"
      as a category if it implies ARB registration that isn't confirmed).
- [ ] Add relevant secondary categories only where genuinely accurate.
- [ ] Set the service area to the Wirral towns served (match the site's areas).
- [ ] If running service-area-only, hide the street address in GBP.
- [ ] Add services that mirror the website service pages:
      house extension drawings, loft conversion design, planning drawings,
      building-regulations drawings, permitted development advice, lawful
      development certificate drawings, garage conversion drawings,
      conservation-area design.
- [ ] Write a description consistent with the site positioning (design-only;
      "architectural design", not "architect" unless ARB-confirmed).
- [ ] Add real photos (real projects/headshot/logo) and keep adding them
      regularly — fresh photos help.
- [ ] Link the GBP website field to the homepage (or the best landing page).
      Optionally add a UTM-tagged link later for tracking.
- [ ] Add the Instagram and (once confirmed) Facebook links consistently.

## Reviews

- [ ] Request genuine reviews from happy clients. **Never** post fake reviews or
      add self-serving AggregateRating schema to the site.
- [ ] Respond to every review, positive or negative, professionally.
- [ ] Once the GBP review link exists, paste it into:
      - `src/app/reviews/page.tsx` (`GOOGLE_REVIEW_URL`)
      - any "leave a review" prompts.

## Citations & directories

- [ ] Build citations with **identical NAP** on reputable UK directories
      (e.g. Yell, Bark, Houzz, Checkatrade if joined, local Wirral directories).
- [ ] Audit existing mentions for NAP consistency and fix mismatches.
- [ ] Use the same business description tone across listings.

## Social

- [ ] Keep Instagram active; confirm and add the real Facebook page URL
      (`site.socials.facebook` — currently empty so the link is not rendered).
- [ ] Cross-link social profiles to the website.

## On-site (already done — maintain)

- LocalBusiness (`ProfessionalService`) + WebSite JSON-LD on every page.
- Service schema on service pages; Article schema on guides; BreadcrumbList on
  inner pages; FAQPage where visible FAQs exist.
- Unique title + meta description + canonical + OG/Twitter per page.
- Unique, genuinely-useful area pages (no thin duplicates), tiered core vs wider.
- Internal linking: services ↔ guides ↔ areas ↔ contact.

## Measurement (later)

- [ ] Add Google Search Console (verify the production domain) and submit the
      sitemap.
- [ ] Track GBP insights (calls, direction requests, website clicks).
- [ ] Keep Plausible (consent-gated) configured on the production domain.

## Compliance reminders

- Never use "architect / architects / architectural practice" as the business
  title unless ARB registration is confirmed.
- No fake reviews, projects, awards, qualifications, ARB/RIBA membership or
  insurance claims.
- No guaranteed planning approval / permitted development claims.
- Keep the address decision (publish vs service-area) consistent between the
  site and GBP.
