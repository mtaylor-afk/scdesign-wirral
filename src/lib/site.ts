/**
 * Central site configuration — NAP, positioning, CTAs, socials.
 * ARCHITECTURAL DESIGN business (design-only): SC Design & Construction provides
 * architectural design and planning drawings. It does NOT carry out construction.
 *
 * LEGAL FLAG (Architects Act 1997): the protected TITLE "architect" may only be
 * used by an ARB-registered person. "Architectural design / architectural drawings
 * / architectural designer" is used here as the safe primary wording. Confirm
 * Sean's ARB registration before relying on the bare title "architect".
 */

export const site = {
  // LEGAL ENTITY: registered company "SC Design & Construction Ltd" (England &
  // Wales, company no. 11511225, incorporated 10 Aug 2018, status Active). `name`
  // is the full legal name (footer copyright / legal pages / JSON-LD / OG
  // siteName); `shortName` is the display brand used in the nav logo and
  // page-title suffixes (deliberately without "Ltd").
  name: "SC Design & Construction Ltd",
  shortName: "SC Design Wirral",
  contactName: "Sean Corser",

  // Credentials — ARB-safe ("architectural technologist"; NEVER "architect").
  // "Chartered Architectural Technologist" / MCIAT — CONFIRMED current (June 2026).
  // (A legally restricted title; valid only while CIAT membership stays current.)
  // Degree per Sean's own brief ("Bachelor of Science – Architectural Technology"),
  // confirmed by Matthew 2026-09-12. Single source — never hardcode it elsewhere.
  credentials: {
    jobTitle: "Chartered Architectural Technologist",
    postNominals: "MCIAT",
    degree: "BSc Architectural Technology",
    degreeSubject: "Architectural Technology",
  },
  yearsAsBuilder: 6,

  // Sean's own words (from his website brief) — shown as a first-person quote on
  // the homepage + About. ARB-safe as written ("architecture" is not protected).
  bioQuote: [
    "I have over 15 years of experience in architecture throughout Merseyside, specialising in residential design and helping homeowners unlock the full potential of their properties.",
    "Prior to this, I spent 6 years working as a builder on residential projects, giving me a strong understanding of how good design translates into successful construction. This combination of design expertise and hands-on building experience allows me to deliver creative, practical solutions tailored to each client's needs.",
  ],

  // Sean's professional headshot. null until he supplies one — every slot that
  // uses it falls back to the SC logo roundel, so there is never a visible
  // placeholder. Set e.g. { src: "/brand/sean-corser.jpg", alt: "Sean Corser MCIAT" }.
  headshot: null as { src: string; alt: string } | null,

  // Brand logo (Sean's red serif "SC" roundel) — avatar fallback + JSON-LD logo.
  logo: "/brand/sc-logo-roundel.png",

  // Design-only practice. Homeowners appoint their own builder to price and build
  // from Sean's drawings; a structural engineer covers any structural calculations.
  // Liability and contract for the built work sit with the builder, not SC Design.

  // Companies House registration — shown in the footer + legal/policy pages to
  // meet UK company-website disclosure. The registered office (below) is the
  // Liverpool address on the public register; the visible contact address is the
  // Wallasey trading office (see `address` / `addressDisplay`).
  companiesHouseNumber: "11511225",
  registeredOffice: "Seymour Chambers, 92 London Road, Liverpool, L3 5NW",

  // Positioning (architectural design, design-only — no construction)
  tagline:
    "Architectural design for home extensions, loft conversions and planning across Wirral, Liverpool, Cheshire, Warrington and North Wales.",
  positioning:
    "Friendly, practical architectural design for growing families across Wirral, Liverpool, Cheshire, Warrington and North Wales — from first idea to clear planning, building-regulations and builder-quote drawings.",
  yearsExperience: 15,

  // NAP — the Wallasey TRADING/contact address (distinct from the registered
  // office above). Confirmed public by the owner. `region` stays the county
  // (Merseyside) for schema addressRegion; `addressDisplay` is the visible block.
  address: {
    street: "20 Ripon Road",
    town: "Wallasey",
    region: "Merseyside",
    postcode: "CH45 6TR",
    country: "GB",
  },
  addressDisplay: "20 Ripon Road, Wallasey, Wirral, CH45 6TR",
  addressIsPublic: false, // service-area-only — the Wallasey trading address is NOT published

  // Service area — Sean's brief: "Wirral peninsula, North Wales, Liverpool,
  // Warrington, Southport" + "Wirral, Liverpool, Cheshire, Warrington, Merseyside".
  // `serviceArea` is the one-line form used in running copy; `regions` is the
  // list form (homepage strip, areas page). Full town lists: lib/serviceAreas.ts.
  serviceArea: "Wirral, Liverpool, Cheshire, Warrington & North Wales",
  regions: ["Wirral peninsula", "Liverpool & Merseyside", "Cheshire", "Warrington", "North Wales"],

  phoneDisplay: "07749 456528",
  phoneE164: "+447749456528",
  email: "scdesignandconstruction1@gmail.com",

  // Where website FORM submissions are routed. The live site is a static export
  // with no server, so the contact + send-concept forms open the visitor's email
  // client (mailto) addressed to these. Sean wants every form copy delivered to
  // both addresses at once. NOTE: the visitor sees both addresses in the To line.
  formRecipients: ["scdesignandconstruction1@gmail.com", "matthewjtaylor1985@icloud.com"],

  // Sean's three public profiles (brief, Sep 2026). `instagramWork` is the
  // second Instagram account, which posts site progress from the projects Sean
  // has designed — it is NOT a claim that SC Design carries out the building
  // work, so anywhere it is linked says whose site photos they are.
  socials: {
    facebook: "https://www.facebook.com/SCDesignAndConstruction",
    instagram: "https://www.instagram.com/sc.design.wirral",
    instagramWork: "https://www.instagram.com/sc.construction.work",
  },

  // Google review link — Sean's live Google Business reviews (provided by Matthew
  // 2026-06-22; volatile browser/session params trimmed, functional q + si kept).
  // NEXT_PUBLIC_GOOGLE_REVIEW_URL still overrides if ever needed. Blank → the UI
  // shows the invitation only, never a broken link. NEVER pair with invented
  // reviews or AggregateRating schema.
  googleReviewUrl:
    process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL ||
    "https://www.google.com/search?q=SC+Design+%26+Construction+Ltd+Reviews&si=APenkKm7iecQ4G6P-TsbSMFKIQtv3EFIqRAFw-i8uEbk55Z-_y_bWHzpSO07io5JSOvwzJVVGcPn-BWGu1evmfvBeiInsaw2SUV_sOwPG1ogWAMsjDkGOETsmi8Go_Hg-m14E6QN-qViBQVT6JBz_uEcQy89unQ50g%3D%3D",
  // Featurable rotating Google-reviews widget id (free tier). Blank → honest
  // "leave a review" fallback; set once Sean authorises the widget.
  featurableWidgetId: process.env.NEXT_PUBLIC_FEATURABLE_WIDGET_ID || "",
} as const;

/** WhatsApp deep link with an optional prefilled message. */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${site.phoneE164.replace("+", "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export const defaultWhatsAppMessage =
  "Hi Sean, I'm interested in discussing an architectural design project (extension / loft conversion / planning drawings).";

/** Canonical CTA copy used across the site. */
export const cta = {
  // Lower-friction primary project CTA — "capture first, qualify second".
  // Nav, hero and the mobile bar use this.
  primary: { label: "Send Sean your idea", href: "/contact" },
  // Bottom-of-page panels (CTASection default) + the homepage closing form —
  // Sean's own wording from his brief/flyers (owner-approved 2026-09-12).
  consultation: {
    label: "Book a free consultation",
    href: "/contact?source_type=consultation",
  },
  whatsapp: { label: "WhatsApp Sean", href: whatsappLink(defaultWhatsAppMessage) },
  // Sean's brief (Sep 2026) names this button "Try the Concept Visualiser", and
  // asks for it at the same size and in the same red as the primary, beside it.
  visualiser: { label: "Try the Concept Visualiser", href: "/visualiser" },
  call: { label: "Call Sean", href: `tel:${site.phoneE164}` },
  emailCta: { label: "Email Sean", href: `mailto:${site.email}` },
} as const;
