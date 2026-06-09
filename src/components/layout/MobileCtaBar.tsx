"use client";

import Link from "next/link";
import { site, whatsappLink, defaultWhatsAppMessage } from "@/lib/site";

/**
 * Sticky bottom action bar shown on small screens only. Sits below the cookie
 * consent dialog (z-[100]) so it never covers it. A matching spacer reserves
 * room so the fixed bar never hides the bottom of the page content.
 */
export function MobileCtaBar() {
  return (
    <>
      <div
        aria-hidden
        className="lg:hidden"
        style={{ height: "calc(4rem + env(safe-area-inset-bottom))" }}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-line bg-paper/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <a
          href={`tel:${site.phoneE164}`}
          data-conversion="phone-click"
          className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium text-ink-soft"
        >
          <span aria-hidden className="text-base">
            📞
          </span>
          Call
        </a>
        <a
          href={whatsappLink(defaultWhatsAppMessage)}
          data-conversion="whatsapp-click"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center gap-0.5 border-x border-line py-2.5 text-xs font-medium text-ink-soft"
        >
          <span aria-hidden className="text-base">
            💬
          </span>
          WhatsApp
        </a>
        <Link
          href="/contact"
          data-conversion="contact-cta"
          className="flex flex-col items-center justify-center gap-0.5 bg-accent-strong py-2.5 text-xs font-semibold text-white"
        >
          <span aria-hidden className="text-base">
            ✉️
          </span>
          Send idea
        </Link>
      </div>
    </>
  );
}
