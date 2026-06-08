import { Card, LinkButton } from "./index";
import { site } from "@/lib/site";

/**
 * Reusable "leave a review" module. Shows a Google review button ONLY when a real
 * URL is configured (`site.googleReviewUrl` ← NEXT_PUBLIC_GOOGLE_REVIEW_URL);
 * otherwise it renders an honest placeholder — never a broken link, never an
 * invented review or rating. `google_review_click` is tracked in ClickTracking by
 * matching the href against site.googleReviewUrl.
 *
 *  - tone="card"   → light card for the homepage / contact / reviews pages
 *  - tone="footer" → compact dark-friendly block for the footer
 */
const PLACEHOLDER =
  "Google review link to be added once the Google Business Profile is verified.";

export function ReviewCta({ tone = "card" }: { tone?: "card" | "footer" }) {
  const hasUrl = Boolean(site.googleReviewUrl);

  if (tone === "footer") {
    return (
      <div className="mt-5 max-w-xs">
        <p className="text-sm text-paper/70">
          Worked with Sean? Your honest review helps other Wirral homeowners.
        </p>
        {hasUrl ? (
          <a
            href={site.googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-sm font-medium text-paper/80 underline hover:text-white"
          >
            Leave a Google review
          </a>
        ) : (
          <p className="mt-1 text-xs text-paper/60">{PLACEHOLDER}</p>
        )}
      </div>
    );
  }

  return (
    <Card>
      <h2 className="text-xl">Worked with Sean?</h2>
      <p className="mt-2 text-pretty text-muted">
        Your honest review helps other Wirral homeowners choosing who to trust with their project.
      </p>
      {hasUrl ? (
        <div className="mt-4">
          <LinkButton href={site.googleReviewUrl} external>
            Leave a Google review
          </LinkButton>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">{PLACEHOLDER}</p>
      )}
    </Card>
  );
}
