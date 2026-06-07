import type { Metadata } from "next";
import { site } from "./site";

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.example.com";

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
    // Static export is a TEST deployment on a borrowed domain — never index it.
    robots: noindex ? { index: false, follow: false } : undefined,
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
  // Only expose a postal address when the client has approved publishing it.
  if (site.addressIsPublic) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      addressLocality: site.address.town,
      addressRegion: site.address.region,
      postalCode: site.address.postcode,
      addressCountry: site.address.country,
    };
  } else {
    data.address = {
      "@type": "PostalAddress",
      addressLocality: site.address.town,
      addressRegion: site.address.region,
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

export function articleJsonLd(opts: {
  title: string;
  description: string;
  path: string;
  reviewed?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    url: `${siteUrl}${opts.path}`,
    author: { "@type": "Organization", name: site.name, url: siteUrl },
    publisher: { "@type": "Organization", name: site.name, url: siteUrl },
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
