"use client";

import { useConsent, useMounted, setConsent } from "@/lib/consent";
import { withBase } from "@/lib/base";

export function ConsentBanner() {
  const consent = useConsent();
  const mounted = useMounted();

  // Render nothing on the server, and nothing once a choice has been made.
  if (!mounted || consent) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl rounded-lg border border-line bg-paper-card p-5 shadow-card-hover no-print"
    >
      <p className="text-sm text-ink">
        We use privacy-friendly, <strong>cookieless</strong> analytics (Cloudflare Web Analytics and
        our own first-party analytics) that count page views anonymously — no cookies, no stored IP
        addresses, no cross-site tracking. Accepting also turns on our Google reviews widget. See our{" "}
        <a href={withBase("/cookie-policy")} className="underline">
          Cookie Policy
        </a>
        .
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setConsent("accepted")}
          className="inline-flex h-10 items-center rounded-full bg-accent-strong px-5 text-sm font-medium text-white hover:bg-accent-deep"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => setConsent("rejected")}
          className="inline-flex h-10 items-center rounded-full border border-line px-5 text-sm font-medium text-ink hover:bg-paper"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
