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
  credentials: {
    jobTitle: "Chartered Architectural Technologist",
    postNominals: "MCIAT",
    degree: "BSc Architectural Science",
  },
  yearsAsBuilder: 6,

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
    "Architectural design for home extensions, loft conversions and planning across Wirral and selected surrounding areas.",
  positioning:
    "Friendly, practical architectural design for growing families across Wirral and selected surrounding areas — from first idea to clear planning, building-regulations and builder-quote drawings.",
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
  serviceArea: "Wirral and selected surrounding areas",

  phoneDisplay: "07749 456528",
  phoneE164: "+447749456528",
  email: "scdesignandconstruction1@gmail.com",

  // Where website FORM submissions are routed. The live site is a static export
  // with no server, so the contact + send-concept forms open the visitor's email
  // client (mailto) addressed to these. Sean wants every form copy delivered to
  // both addresses at once. NOTE: the visitor sees both addresses in the To line.
  formRecipients: ["scdesignandconstruction1@gmail.com", "matthewjtaylor1985@icloud.com"],

  socials: {
    facebook: "https://www.facebook.com/SCDesignAndConstruction",
    instagram: "https://www.instagram.com/sc.design.wirral",
  },

  // Google review link — set NEXT_PUBLIC_GOOGLE_REVIEW_URL once the Google
  // Business Profile is verified. Blank → the UI shows a placeholder, never a
  // broken link. NEVER pair with invented reviews or AggregateRating schema.
  googleReviewUrl: process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL || "",
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
  primary: { label: "Send Sean your idea", href: "/contact" },
  whatsapp: { label: "WhatsApp Sean", href: whatsappLink(defaultWhatsAppMessage) },
  visualiser: { label: "Try the Extension Concept Visualiser", href: "/visualiser" },
  call: { label: "Call Sean", href: `tel:${site.phoneE164}` },
  emailCta: { label: "Email Sean", href: `mailto:${site.email}` },
} as const;
