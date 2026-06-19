import type { Metadata } from "next";
import { site } from "./site";
import { NOINDEX } from "./base";

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://scdesignwirral.co.uk";

type PageMetaInput = {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
};

/** Build per-page metadata with canonical + Open Graph + Twitter. */
export function pageMeta({ title, description, path, noindex }: PageMetaInput): Metadata {
  const url = `${siteUrl}${path === "/" ? "" : path}`;
  const fullTitle = path === "/" ? `${title}` : `${title} | ${site.shortName}`;
  return {
    // `absolute` bypasses the layout title.template so the brand is never
    // appended twice (the section-1.2 double-brand bug).
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: url },
    // Explicit per-page robots so indexability never depends on metadata-merge
    // behaviour. NEXT_PUBLIC_NOINDEX forces noindex for preview/non-prod builds.
    robots: noindex || NOINDEX ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: site.name,
      locale: "en_GB",
      type: "website",
      // og image is provided by the file-based convention (app/opengraph-image.tsx).
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
  };
}

/** Towns/areas SC genuinely serves — used for LocalBusiness areaServed. */
export const areasServed = [
  "Wallasey",
  "Wirral",
  "Birkenhead",
  "Bebington",
  "Heswall",
  "West Kirby",
  "Hoylake",
  "Bromborough",
  "New Brighton",
  "Moreton",
  "Upton",
  "Greasby",
  "Oxton",
  "Port Sunlight",
  "Eastham",
  "Prenton",
  "Neston",
  "Ellesmere Port",
  "Liverpool",
  "Chester",
  "Crosby",
];

const serviceTypes = [
  "Architectural design",
  "House extension drawings",
  "Loft conversion design",
  "Planning drawings",
  "Building regulations drawings",
  "Permitted development advice",
  "Lawful development certificate drawings",
  "Garage conversion drawings",
];

/** WebSite JSON-LD — pairs with the LocalBusiness entity for site identity. */
export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: siteUrl,
    inLanguage: "en-GB",
    publisher: { "@id": `${siteUrl}/#business` },
  };
}

/** LocalBusiness / GeneralContractor-style JSON-LD (service-area aware). */
export function localBusinessJsonLd() {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${siteUrl}/#business`,
    name: site.name,
    description: site.positioning,
    url: siteUrl,
    telephone: site.phoneE164,
    email: site.email,
    image: `${siteUrl}/opengraph-image`,
    areaServed: areasServed.map((name) => ({ "@type": "Place", name })),
    serviceType: serviceTypes,
    knowsAbout: serviceTypes,
    sameAs: [site.socials.facebook, site.socials.instagram].filter(Boolean),
  };
  // Service-area business: only expose a postal address when the client has
  // approved publishing it. Otherwise omit `address` entirely (Google's guidance
  // for service-area businesses that work from home) and rely on areaServed —
  // we do NOT expose the home town as a business locality.
  if (site.addressIsPublic) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      addressLocality: site.address.town,
      addressRegion: site.address.region,
      postalCode: site.address.postcode,
      addressCountry: site.address.country,
    };
  }
  return data;
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${siteUrl}${it.path === "/" ? "" : it.path}`,
    })),
  };
}

export function faqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
/** "June 2026" → "2026-06" (valid schema.org Date). undefined if unparseable. */
function monthYearToIso(s?: string): string | undefined {
  if (!s) return undefined;
  const m = s.trim().toLowerCase().match(/^([a-z]+)\s+(\d{4})$/);
  if (!m) return undefined;
  const i = MONTHS.indexOf(m[1]);
  return i < 0 ? undefined : `${m[2]}-${String(i + 1).padStart(2, "0")}`;
}

export function articleJsonLd(opts: {
  title: string;
  description: string;
  path: string;
  reviewed?: string;
}) {
  const url = `${siteUrl}${opts.path}`;
  const iso = monthYearToIso(opts.reviewed);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    // Sean is the named author/reviewer — safe Person ref (no ARB/RIBA claims).
    author: { "@type": "Person", "@id": `${siteUrl}/about#sean-corser`, name: site.contactName },
    publisher: { "@id": `${siteUrl}/#business` },
    // dateModified only when the stated review month parses — never fabricated.
    ...(iso ? { dateModified: iso } : {}),
  };
}

export function serviceJsonLd(name: string, description: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    serviceType: "Architectural design",
    areaServed: site.serviceArea,
    provider: { "@type": "ProfessionalService", "@id": `${siteUrl}/#business`, name: site.name },
    url: `${siteUrl}${path}`,
  };
}

/**
 * Person JSON-LD for Sean Corser. ARB-safe: "Chartered Architectural Technologist"
 * (CIAT / MCIAT) — NEVER the protected title "architect" (Architects Act 1997).
 * MCIAT/"Chartered Architectural Technologist" — confirmed current (June 2026).
 */
export function personJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${siteUrl}/about#sean-corser`,
    name: site.contactName,
    jobTitle: site.credentials.jobTitle, // "Chartered Architectural Technologist"
    hasCredential: [
      {
        "@type": "EducationalOccupationalCredential",
        credentialCategory: "Professional membership",
        name: `${site.credentials.postNominals} — ${site.credentials.jobTitle}`,
        recognizedBy: {
          "@type": "Organization",
          name: "Chartered Institute of Architectural Technologists (CIAT)",
        },
      },
      {
        "@type": "EducationalOccupationalCredential",
        credentialCategory: "degree",
        name: site.credentials.degree, // "BSc Architectural Science"
      },
    ],
    worksFor: { "@id": `${siteUrl}/#business` },
    url: `${siteUrl}/about`,
  };
}
