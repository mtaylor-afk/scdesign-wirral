"use client";

import Script from "next/script";
import { useConsent, useMounted } from "@/lib/consent";
import { site } from "@/lib/site";
import { ReviewCta } from "./ReviewCta";

/**
 * Rotating Google-reviews window via Featurable (free tier — no API key, no
 * server, fits the static export). Displays Sean's GENUINE Google reviews only.
 *
 * - Renders the live widget only when a widget id is configured
 *   (NEXT_PUBLIC_FEATURABLE_WIDGET_ID) AND the visitor has accepted cookies
 *   (it's a third-party embed, so it's consent-gated like the analytics script).
 * - Until configured (or if cookies are declined) it shows the genuine
 *   "leave a review" invitation — never a fabricated review or rating.
 *
 * To go live: Sean signs in at featurable.com with the Google account that
 * manages the SC Design business listing, creates a free widget, and sets
 * NEXT_PUBLIC_FEATURABLE_WIDGET_ID to the widget id.
 */
export function ReviewsWidget() {
  const id = site.featurableWidgetId;
  const consent = useConsent();
  const mounted = useMounted();

  if (!id) return <ReviewCta />;

  if (!mounted || consent !== "accepted") {
    return (
      <div>
        <ReviewCta />
        <p className="mt-3 text-center text-xs text-muted">
          Live Google reviews load once you accept cookies.
        </p>
      </div>
    );
  }

  return (
    <>
      <div id={`featurable-${id}`} data-featurable-async />
      <Script
        src="https://featurable.com/assets/bundle.js"
        strategy="afterInteractive"
      />
    </>
  );
}
