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
  const disallow = ["/api/", "/admin/", "/admin", "/components-preview"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      ...ALLOWED_BOTS.map((userAgent) => ({ userAgent, allow: "/", disallow })),
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
