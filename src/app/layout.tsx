import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { MobileCtaBar } from "@/components/layout/MobileCtaBar";
import { ConsentBanner } from "@/components/ConsentBanner";
import { Analytics } from "@/components/Analytics";
import { ClickTracking } from "@/components/ClickTracking";
import { JsonLd } from "@/components/JsonLd";
import { localBusinessJsonLd, webSiteJsonLd, siteUrl } from "@/lib/seo";
import { site } from "@/lib/site";
import { IS_STATIC } from "@/lib/base";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${site.shortName} — Architectural Design across Wirral`,
    template: `%s | ${site.shortName}`,
  },
  description: site.positioning,
  applicationName: site.name,
  authors: [{ name: site.name }],
  // Static export is a test deployment on a borrowed domain — keep it out of search.
  robots: IS_STATIC ? { index: false, follow: false } : undefined,
  // favicon is provided by the file-based convention (app/icon.svg).
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${playfair.variable} ${inter.variable}`}>
      <body>
        <JsonLd data={[localBusinessJsonLd(), webSiteJsonLd()]} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
        >
          Skip to content
        </a>
        <Nav />
        <main id="main">{children}</main>
        <Footer />
        <MobileCtaBar />
        <ConsentBanner />
        <Analytics />
        <ClickTracking />
      </body>
    </html>
  );
}
