"use client";

import Script from "next/script";
import { getConsent, useMounted } from "@/lib/consent";

/**
 * Self-hosted Plausible analytics — privacy-friendly and COOKIELESS, so the
 * script loads whenever it is configured (no cookie/consent is needed merely to
 * count page views anonymously). Consent only controls how much DETAIL we record
 * — see `track()` below ("track always, collect more on consent"). Loads only
 * when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set; point NEXT_PUBLIC_PLAUSIBLE_SRC at
 * the self-hosted instance, e.g. https://analytics.scdesignwirral.co.uk/js/script.js.
 */
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const src = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || "https://plausible.io/js/script.js";
  const mounted = useMounted();

  if (!domain || !mounted) return null;

  return <Script defer data-domain={domain} src={src} strategy="afterInteractive" />;
}

/**
 * Fire a custom analytics event if Plausible is loaded. Two-tier by consent:
 * the event itself ALWAYS fires (cookieless, anonymous); the richer `props`
 * (destinations, feature detail) are only attached once the visitor has accepted
 * analytics in the consent banner.
 */
export function track(event: string, props?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    plausible?: (e: string, o?: { props?: Record<string, unknown> }) => void;
  };
  if (typeof w.plausible !== "function") return;
  const consented = getConsent() === "accepted";
  w.plausible(event, consented && props ? { props } : undefined);
}
