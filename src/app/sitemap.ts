import type { MetadataRoute } from "next";

import { siteUrl, absUrl } from "@/lib/seo";
import { services } from "@/lib/services";
import { locations } from "@/lib/locations";
import { guides } from "@/lib/guides";
import { publishedProjects as projects } from "@/lib/projects";

export const dynamic = "force-static";

// URLs only: no lastModified (it was the build time on every page, so search
// engines learn to ignore it), and no priority / changeFrequency (ignored by
// Google and Bing). SEO audit 2.6. Never "fall back to the build date".
export default function sitemap(): MetadataRoute.Sitemap {
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
    "/socials",
    "/cost-estimate",
    // Legal pages (privacy, cookie, visualiser-terms) are intentionally excluded
    // from the sitemap — still crawlable via footer links, just not promoted.
  ];

  const entries: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: absUrl(p),
  }));

  for (const s of services) {
    entries.push({
      url: absUrl(`/services/${s.slug}`),
    });
  }
  for (const g of guides) {
    if (g.draft) continue; // incomplete guides stay out of the sitemap (and are noindex)
    entries.push({
      url: absUrl(`/guides/${g.slug}`),
    });
  }
  for (const l of locations) {
    if (l.noindex) continue; // owner-flagged areas stay out of the sitemap
    entries.push({
      url: absUrl(`/areas/${l.slug}`),
    });
  }
  for (const p of projects) {
    entries.push({
      url: absUrl(`/projects/${p.slug}`),
    });
  }
  // Static AI-readable summary page (a real .html file, not a trailing-slash route).
  entries.push({
    url: `${siteUrl}/llms`,
  });
  return entries;
}
