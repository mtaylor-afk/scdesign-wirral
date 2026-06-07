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
  name: "SC Design & Construction Ltd",
  shortName: "SC Design & Construction",
  contactName: "Sean Corser",

  // Positioning (architectural design, design-only — no construction)
  tagline: "Architectural design for extensions, loft conversions and planning across Wirral.",
  positioning:
    "From first idea to planning-ready architectural drawings — bespoke home design for Wirral homeowners.",
  yearsExperience: 18,

  // NAP — address treated as SERVICE-AREA ONLY by default (Stage 0 decision pending).
  // Set addressIsPublic = true only once the client confirms it can be published.
  address: {
    street: "Ripon Rd",
    town: "Wallasey",
    region: "Merseyside",
    postcode: "CH45 6TR",
    country: "GB",
  },
  addressIsPublic: false,
  serviceArea: "Wirral and the surrounding areas",

  phoneDisplay: "07749 456528",
  phoneE164: "+447749456528",
  email: "scdesignandconstruction1@gmail.com",

  socials: {
    // Empty = unknown → the link is not rendered (avoids a broken/placeholder URL).
    // Set the exact SC Facebook page URL once confirmed.
    facebook: "",
    instagram: "https://www.instagram.com/sc.architectural.design",
  },

  // Companies House number intentionally omitted until the correct registered
  // entity is confirmed (Liverpool vs Wallasey ambiguity flagged in Stage 0).
  companiesHouseNumber: "" as string,

  // Google review link — set NEXT_PUBLIC_GOOGLE_REVIEW_URL once the Google
  // Business Profile is verified. Blank → the UI shows a placeholder, never a
  // broken link. NEVER pair with invented reviews or AggregateRating schema.
  googleReviewUrl: process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL || "",
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
  primary: { label: "Send Sean your project idea", href: "/contact" },
  whatsapp: { label: "WhatsApp Sean", href: whatsappLink(defaultWhatsAppMessage) },
  visualiser: { label: "Try the Extension Concept Visualiser", href: "/visualiser" },
  call: { label: "Call Sean", href: `tel:${site.phoneE164}` },
  emailCta: { label: "Email Sean", href: `mailto:${site.email}` },
} as const;
