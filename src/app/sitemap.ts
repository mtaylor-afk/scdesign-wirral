import type { MetadataRoute } from "next";

import { siteUrl, absUrl } from "@/lib/seo";
import { services } from "@/lib/services";
import { locations } from "@/lib/locations";
import { guides } from "@/lib/guides";
import { projects } from "@/lib/projects";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPaths = [
    "/",
    "/services",
    "/areas",
    "/guides",
    "/homeowners-guide",
    "/projects",
    "/reviews",
    "/portfolio",
    "/process",
    "/about",
    "/faqs",
    "/contact",
    "/visualiser",
    "/cost-estimate",
    // Legal pages (privacy, cookie, visualiser-terms) are intentionally excluded
    // from the sitemap — still crawlable via footer links, just not promoted.
  ];

  const entries: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: absUrl(p),
    lastModified: now,
    changeFrequency: "monthly",
    priority: p === "/" ? 1 : 0.7,
  }));

  for (const s of services) {
    entries.push({
      url: absUrl(`/services/${s.slug}`),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }
  for (const g of guides) {
    if (g.draft) continue; // incomplete guides stay out of the sitemap (and are noindex)
    entries.push({
      url: absUrl(`/guides/${g.slug}`),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }
  for (const l of locations) {
    if (l.noindex) continue; // owner-flagged areas stay out of the sitemap
    entries.push({
      url: absUrl(`/areas/${l.slug}`),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }
  for (const p of projects) {
    entries.push({
      url: absUrl(`/projects/${p.slug}`),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }
  // Static AI-readable summary page (a real .html file, not a trailing-slash route).
  entries.push({
    url: `${siteUrl}/llms.html`,
    lastModified: now,
    changeFrequency: "yearly",
    priority: 0.3,
  });
  return entries;
}
