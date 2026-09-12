"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { reviews as allReviews, type Review } from "@/lib/reviews";
import { track } from "@/components/Analytics";
import { cn } from "@/lib/utils";
import { ReviewCard } from "./Testimonials";

/**
 * Small rotating "window" of Sean's GENUINE Google reviews (brief: "a small window
 * with my google reviews that keeps changing between them all"). Self-hosted —
 * no third-party script, no cookies, no Review/AggregateRating schema.
 *
 * Accessibility: visible Pause/Play (WCAG 2.2.2), pauses on hover/focus/touch,
 * no autoplay under prefers-reduced-motion (and none during static render),
 * inactive slides are aria-hidden + inert, and all slides share one grid cell so
 * the height never jumps (no layout shift).
 */

const RM_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(RM_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getReduced = () => window.matchMedia(RM_QUERY).matches;
// Server/static render: treat as reduced → never autoplays before hydration.
const getReducedServer = () => true;

export function ReviewsCarousel({
  reviews = allReviews,
  intervalMs = 7000,
  label = "Google reviews",
  className,
}: {
  reviews?: Review[];
  intervalMs?: number;
  label?: string;
  className?: string;
}) {
  const count = reviews.length;
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, getReduced, getReducedServer);
  const playing = !reduced && !userPaused && !interacting && count > 1;
  const touchX = useRef<number | null>(null);

  // Advance on a timer; re-arms after any manual change (index in deps).
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => window.clearTimeout(id);
  }, [playing, index, count, intervalMs]);

  function go(next: number, action: string) {
    setIndex(((next % count) + count) % count);
    track("reviews_carousel", { action });
  }

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className={cn("mx-auto w-full max-w-3xl", className)}
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setInteracting(false);
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
        setUserPaused(true);
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        const end = e.changedTouches[0]?.clientX;
        if (start == null || end == null) return;
        const dx = end - start;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1), dx < 0 ? "swipe_next" : "swipe_prev");
      }}
    >
      <div className="grid" aria-live={playing ? "off" : "polite"}>
        {reviews.map((r, i) => {
          const active = i === index;
          return (
            <div
              key={`${r.author}-${r.text.slice(0, 16)}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={!active}
              inert={!active}
              className={cn(
                "col-start-1 row-start-1 transition-opacity duration-500",
                active ? "opacity-100" : "pointer-events-none invisible opacity-0"
              )}
            >
              <ReviewCard review={r} />
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            const next = !userPaused;
            setUserPaused(next);
            track("reviews_carousel", { action: next ? "pause" : "play" });
          }}
          disabled={reduced}
          className="inline-flex h-11 items-center rounded-full border border-line bg-paper-card px-4 text-sm font-medium text-ink hover:bg-paper disabled:opacity-60"
        >
          {playing || (!userPaused && !reduced) ? "Pause reviews" : "Play reviews"}
        </button>
        <button
          type="button"
          onClick={() => go(index - 1, "prev")}
          aria-label="Previous review"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper-card text-ink hover:bg-paper"
        >
          <span aria-hidden>←</span>
        </button>
        <span className="min-w-[4.5rem] text-center text-sm tabular-nums text-muted">
          {index + 1} / {count}
        </span>
        <button
          type="button"
          onClick={() => go(index + 1, "next")}
          aria-label="Next review"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper-card text-ink hover:bg-paper"
        >
          <span aria-hidden>→</span>
        </button>
      </div>
      <div className="mt-3 hidden justify-center gap-1.5 sm:flex">
        {reviews.map((r, i) => (
          <button
            key={`dot-${r.author}-${i}`}
            type="button"
            onClick={() => go(i, "dot")}
            aria-label={`Show review ${i + 1} of ${count}`}
            aria-current={i === index ? "true" : undefined}
            className="flex h-6 w-6 items-center justify-center"
          >
            <span
              aria-hidden
              className={cn(
                "block h-2 w-2 rounded-full transition-colors",
                i === index ? "bg-accent-strong" : "bg-line hover:bg-muted-soft"
              )}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
