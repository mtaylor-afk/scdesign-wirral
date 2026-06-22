import { Card, LinkButton, Badge } from "./index";
import { reviews as allReviews, reviewSummary, type Review } from "@/lib/reviews";

const STARS = "★★★★★";

/** Accessible 5-star row. Brand-red on light surfaces; pass className to override. */
export function ReviewStars({ count = 5, className = "" }: { count?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`Rated ${count} out of 5`}
      className={`tracking-[0.12em] text-accent-strong ${className}`}
    >
      {STARS.slice(0, count)}
    </span>
  );
}

/** One genuine review, shown verbatim with attribution. */
export function ReviewCard({ review }: { review: Review }) {
  return (
    <Card className="flex h-full flex-col">
      <ReviewStars />
      <blockquote className="mt-3 flex-1 text-pretty text-ink-soft">
        &ldquo;{review.text}&rdquo;
      </blockquote>
      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-sm font-semibold text-ink">{review.author}</span>
        {review.tag && <Badge>{review.tag}</Badge>}
      </div>
      <span className="mt-1 text-xs text-muted">Verified Google review</span>
    </Card>
  );
}

/**
 * "5.0 ★★★★★ · 30 genuine reviews on Google" summary with a validation link to
 * the live Google profile. The href matches site.googleReviewUrl, so ClickTracking
 * records it as google_review_click automatically.
 */
export function ReviewsSummary({ align = "left" }: { align?: "left" | "center" }) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      <div className={`flex items-center gap-4 ${align === "center" ? "justify-center" : ""}`}>
        <span className="font-display text-5xl leading-none text-ink">
          {reviewSummary.rating.toFixed(1)}
        </span>
        <div>
          <ReviewStars className="text-xl" />
          <p className="mt-1 text-sm text-muted">
            {reviewSummary.count} genuine reviews on {reviewSummary.source}
          </p>
        </div>
      </div>
      {reviewSummary.url && (
        <div className={`mt-5 ${align === "center" ? "flex justify-center" : ""}`}>
          <LinkButton href={reviewSummary.url} variant="ghost" external>
            Read all {reviewSummary.count} reviews on Google
          </LinkButton>
        </div>
      )}
    </div>
  );
}

/** Responsive grid of review cards. Pass `limit` to feature a subset (homepage). */
export function Testimonials({ limit, className = "" }: { limit?: number; className?: string }) {
  const list = typeof limit === "number" ? allReviews.slice(0, limit) : allReviews;
  return (
    <div className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {list.map((r) => (
        <ReviewCard key={`${r.author}-${r.text.slice(0, 16)}`} review={r} />
      ))}
    </div>
  );
}
