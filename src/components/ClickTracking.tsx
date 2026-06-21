"use client";

import { useEffect } from "react";
import { track } from "./Analytics";
import { site } from "@/lib/site";

/**
 * Conversion + interaction tracking. Attaches delegated listeners and fires
 * first-party events for the key actions (calls, emails, WhatsApp, CTAs,
 * service/area clicks, outbound links and form submits). Routes through
 * track() in Analytics.tsx -> the SC-only cookieless analytics endpoint.
 * The admin area is excluded inside track().
 */
export function ClickTracking() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";

      if (site.googleReviewUrl && href === site.googleReviewUrl) {
        track("google_review_click");
      } else if (href.startsWith("tel:")) {
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
      } else if (/^https?:\/\//i.test(href)) {
        try {
          const u = new URL(href);
          if (u.host !== window.location.host) {
            track("outbound_link", { dest: u.host });
          }
        } catch {
          /* ignore unparseable href */
        }
      }
    }

    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;
      const id =
        form.getAttribute("id") ||
        form.getAttribute("name") ||
        form.getAttribute("action") ||
        "form";
      track("form_submit", { form: id });
    }

    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("submit", onSubmit, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("submit", onSubmit, { capture: true });
    };
  }, []);

  return null;
}
