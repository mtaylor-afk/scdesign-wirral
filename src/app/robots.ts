import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/seo";

export const dynamic = "force-static";

// Search + AI answer-engine crawlers we explicitly welcome. The wildcard rule
// already allows everyone; naming these reassures owners/auditors and makes the
// AI-crawler stance auditable. The internal preview + (build-time) API routes
// stay disallowed for every agent — nothing that blocks CSS/JS/images.
const ALLOWED_BOTS = [
  "Googlebot",
  "Bingbot",
  "Applebot",
  "OAI-SearchBot",
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
];

export default function robots(): MetadataRoute.Robots {
  // /samantha is a private design sandbox (Wallasey Trusted Home Cleans draft),
  // deliberately orphaned — nothing on the site links to it and it is not in the
  // sitemap. Disallowed here for well-behaved crawlers; bots that ignore
  // robots.txt still get X-Robots-Tag: noindex from public/_headers plus the
  // page's own <meta name="robots">. Keep all three in step.
  const disallow = [
    "/api/",
    "/admin/",
    "/admin",
    "/components-preview",
    "/samantha",
    "/samantha/",
  ];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      ...ALLOWED_BOTS.map((userAgent) => ({ userAgent, allow: "/", disallow })),
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
