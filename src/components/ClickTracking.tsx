"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "./Analytics";
import { site } from "@/lib/site";

/**
 * Conversion + interaction tracking. Attaches delegated listeners and fires
 * first-party events for the key actions (calls, emails, WhatsApp, CTAs,
 * service/area clicks, outbound links and form submits), plus two things a click
 * count alone cannot tell you: whether the main CTA was ever SEEN, and whether
 * somebody started filling a form and then walked away.
 *
 * Everything here is delegated at the document, so the live lead path
 * (EnquiryForm.tsx) needs no changes to be measured.
 *
 * Routes through track() in Analytics.tsx -> the SC-only cookieless analytics
 * endpoint. The admin area is excluded inside track().
 */
export function ClickTracking() {
  const pathname = usePathname();

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

    // --- form start / abandon ------------------------------------------------
    // Which forms get started and then left, and at which field. The submit event
    // below already says who finished; this says who didn't.
    const started = new Set<string>();
    let lastField = "";
    let submitted = false;

    function formId(form: HTMLFormElement) {
      return (
        form.getAttribute("id") ||
        form.getAttribute("name") ||
        form.getAttribute("action") ||
        "form"
      );
    }

    function onFocusIn(e: FocusEvent) {
      const el = e.target as HTMLElement | null;
      if (!el || !el.closest) return;
      const field = el.closest("input, textarea, select") as HTMLElement | null;
      if (!field) return;
      const form = field.closest("form");
      if (!form) return;
      const name = field.getAttribute("name") || field.getAttribute("id") || "";
      // The honeypot is hidden from people; a focus there is a bot, and naming it
      // would make the abandon data read as if a real person stalled on it.
      if (name !== "company") lastField = name;
      const id = formId(form as HTMLFormElement);
      if (started.has(id)) return;
      started.add(id);
      track("form_start", { form: id });
    }

    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;
      submitted = true;
      track("form_submit", { form: formId(form) });
    }

    function onLeave() {
      if (submitted || !started.size) return;
      submitted = true; // a pagehide can fire twice; only report once
      const filled = document.querySelectorAll(
        "form input:not([type=hidden]), form textarea, form select"
      );
      let n = 0;
      filled.forEach((f) => {
        const v = (f as HTMLInputElement).value;
        if (v && String(v).trim()) n += 1;
      });
      track("form_abandon", {
        form: Array.from(started).join(","),
        last_field: lastField || "unknown",
        filled: n,
      });
    }

    // --- CTA impressions ----------------------------------------------------
    // One event per page for the first "get in touch" link that actually scrolls
    // into view, so the admin can report a real click-through rate. Deliberately
    // ONE and not every CTA: at three or four per page it would become the largest
    // row in the events table and tell you nothing extra.
    let ctaObserver: IntersectionObserver | null = null;
    let ctaSeen = false;
    function watchCta() {
      if (typeof IntersectionObserver === "undefined") return;
      const cta = document.querySelector('a[href^="/contact"]');
      if (!cta) return;
      ctaObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting || ctaSeen) continue;
            ctaSeen = true;
            track("cta_view", { dest: "contact" });
            if (ctaObserver) ctaObserver.disconnect();
          }
        },
        { threshold: 0.5 }
      );
      ctaObserver.observe(cta);
    }
    // After paint, so the link exists and its position is settled.
    const ctaTimer = window.setTimeout(watchCta, 600);

    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("submit", onSubmit, { capture: true });
    document.addEventListener("focusin", onFocusIn, { capture: true });
    window.addEventListener("pagehide", onLeave);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("submit", onSubmit, { capture: true });
      document.removeEventListener("focusin", onFocusIn, { capture: true });
      window.removeEventListener("pagehide", onLeave);
      window.clearTimeout(ctaTimer);
      if (ctaObserver) ctaObserver.disconnect();
      // A route change unmounts this effect: report an abandoned form now, because
      // the next page has its own fresh state and would never know.
      onLeave();
    };
    // Re-runs per route so "started", "seen" and the CTA observer are per-page.
  }, [pathname]);

  return null;
}
