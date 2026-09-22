"use client";

import { useConsent, useMounted, setConsent } from "@/lib/consent";
import { withBase } from "@/lib/base";

export function ConsentBanner() {
  const consent = useConsent();
  const mounted = useMounted();

  // Render nothing on the server, and nothing once a choice has been made.
  if (!mounted || consent) return null;

  return (
    // A shallow full-width bar rather than the old floating panel: on desktop
    // that one covered a good part of the first screen and obscured the hero.
    // The full wording lives behind "Details" (the Cookie Policy page).
    // On mobile it sits above MobileCtaBar (h-16 + safe area, z-40) so the two
    // never overlap; on desktop that bar is hidden, so it drops to the edge.
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[100] border-t border-line bg-paper-card/95 backdrop-blur-md no-print lg:bottom-0"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3 sm:px-6 lg:px-8">
        <p className="min-w-[16rem] flex-1 text-sm text-ink">
          We use <strong>cookieless</strong> analytics — no cookies, no stored IP addresses, no
          cross-site tracking. Accepting also turns on our Google reviews widget.{" "}
          <a href={withBase("/cookie-policy")} className="font-medium underline">
            Details
          </a>
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConsent("accepted")}
            className="inline-flex h-9 items-center rounded-full bg-accent-strong px-5 text-sm font-medium text-white hover:bg-accent-deep"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => setConsent("rejected")}
            className="inline-flex h-9 items-center rounded-full border border-line px-5 text-sm font-medium text-ink hover:bg-paper"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
