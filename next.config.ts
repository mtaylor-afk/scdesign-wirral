import type { NextConfig } from "next";

// Static export (GitHub Pages under a sub-path) is enabled via env so the same
// source still builds normally for Vercel (with API routes) when these are unset.
const isStatic = true; // standalone repo: always static export (Cloudflare Pages)
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    unoptimized: isStatic,
  },
  ...(isStatic
    ? { output: "export" as const, basePath, assetPrefix: basePath, trailingSlash: true }
    : {}),
};

export default nextConfig;
