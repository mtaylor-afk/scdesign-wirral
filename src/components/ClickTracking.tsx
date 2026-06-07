"use client";

import { useEffect } from "react";
import { track } from "./Analytics";

/**
 * Consent-gated conversion click tracking. Attaches one delegated listener and
 * fires Plausible events for the key conversion actions. Because `track()` only
 * fires when Plausible is loaded (which only happens after analytics consent),
 * this is inherently PECR-compliant — no events leave the browser pre-consent.
 */
export function ClickTracking() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";

      if (href.startsWith("tel:")) {
        track("phone_click");
      } else if (href.startsWith("mailto:")) {
        track("email_click");
      } else if (href.includes("wa.me") || href.includes("whatsapp")) {
        track("whatsapp_click");
      } else if (href.startsWith("/contact")) {
        track("cta_click", { dest: "contact" });
      } else if (href.startsWith("/visualiser")) {
        track("cta_click", { dest: "visualiser" });
      } else if (href.startsWith("/services/")) {
        track("service_click", { dest: href });
      } else if (href.startsWith("/areas/")) {
        track("location_click", { dest: href });
      }
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
