import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/seo";
import { services } from "@/lib/services";
import { locations } from "@/lib/locations";
import { guides } from "@/lib/guides";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPaths = [
    "/",
    "/services",
    "/areas",
    "/guides",
    "/projects",
    "/reviews",
    "/portfolio",
    "/process",
    "/about",
    "/faqs",
    "/contact",
    "/visualiser",
    // Legal pages (privacy, cookie, visualiser-terms) are intentionally excluded
    // from the sitemap — still crawlable via footer links, just not promoted.
  ];

  const entries: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: `${siteUrl}${p === "/" ? "" : p}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: p === "/" ? 1 : 0.7,
  }));

  for (const s of services) {
    entries.push({
      url: `${siteUrl}/services/${s.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }
  for (const g of guides) {
    entries.push({
      url: `${siteUrl}/guides/${g.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }
  for (const l of locations) {
    if (l.noindex) continue; // owner-flagged areas stay out of the sitemap
    entries.push({
      url: `${siteUrl}/areas/${l.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }
  return entries;
}
