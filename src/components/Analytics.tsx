"use client";

import Script from "next/script";
import { useConsent, useMounted } from "@/lib/consent";

/**
 * Consent-gated Plausible analytics. Only injects the script after the user has
 * accepted, and only when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is configured.
 */
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const src = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || "https://plausible.io/js/script.js";
  const consent = useConsent();
  const mounted = useMounted();

  if (!domain || !mounted || consent !== "accepted") return null;

  return <Script defer data-domain={domain} src={src} strategy="afterInteractive" />;
}

/** Fire a custom analytics event if Plausible is loaded + consent given. */
export function track(event: string, props?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    plausible?: (e: string, o?: { props?: Record<string, unknown> }) => void;
  };
  if (typeof w.plausible === "function") {
    w.plausible(event, props ? { props } : undefined);
  }
}
