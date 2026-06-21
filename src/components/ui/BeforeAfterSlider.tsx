"use client";

import { useCallback, useRef, useState } from "react";
import { withBase } from "@/lib/base";

/**
 * Accessible before/after slider. Works with mouse drag, touch and keyboard
 * (left/right arrows on the handle). `before`/`after` are image src strings;
 * when omitted, tasteful labelled placeholder panels are shown so the shell is
 * usable before real project photos are supplied.
 *
 * PLACEHOLDER NOTE: replace the placeholder panels with real before/after
 * project photos before launch. Never present placeholders as real projects.
 */
export function BeforeAfterSlider({
  before,
  after,
  beforeAlt = "Before",
  afterAlt = "After (concept)",
  caption,
  priority = false,
}: {
  before?: string;
  after?: string;
  beforeAlt?: string;
  afterAlt?: string;
  caption?: string;
  priority?: boolean;
}) {
  const imgLoading = priority ? "eager" : "lazy";
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }, []);

  return (
    <figure className="m-0">
      <div
        ref={ref}
        className="relative aspect-[3/2] w-full select-none overflow-hidden rounded-lg border border-line bg-paper-card"
        onMouseDown={(e) => {
          dragging.current = true;
          setFromClientX(e.clientX);
        }}
        onMouseMove={(e) => dragging.current && setFromClientX(e.clientX)}
        onMouseUp={() => (dragging.current = false)}
        onMouseLeave={() => (dragging.current = false)}
        onTouchStart={(e) => {
          dragging.current = true;
          setFromClientX(e.touches[0].clientX);
        }}
        onTouchMove={(e) => dragging.current && setFromClientX(e.touches[0].clientX)}
        onTouchEnd={() => (dragging.current = false)}
        onTouchCancel={() => (dragging.current = false)}
      >
        {/* AFTER (full) */}
        {after ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={withBase(after)}
            alt={afterAlt}
            width={1200}
            height={800}
            loading={imgLoading}
            fetchPriority={priority ? "high" : undefined}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <PlaceholderPanel label="After (concept)" tone="after" />
        )}

        {/* BEFORE (clipped via clip-path — no resizing/squish) */}
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {before ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={withBase(before)}
              alt={beforeAlt}
              width={1200}
              height={800}
              loading={imgLoading}
              fetchPriority={priority ? "high" : undefined}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <PlaceholderPanel label="Before" tone="before" />
          )}
        </div>

        {/* Handle */}
        <div
          role="slider"
          aria-label="Reveal before and after"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              setPos((p) => Math.max(0, p - 4));
            } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              setPos((p) => Math.min(100, p + 4));
            } else if (e.key === "Home") {
              e.preventDefault();
              setPos(0);
            } else if (e.key === "End") {
              e.preventDefault();
              setPos(100);
            }
          }}
          className="absolute top-0 bottom-0 z-10 -ml-0.5 w-1 cursor-ew-resize bg-white/90 shadow"
          style={{ left: `${pos}%` }}
        >
          <span className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow">
            ⇆
          </span>
        </div>
      </div>
      {caption && <figcaption className="mt-3 text-sm text-muted">{caption}</figcaption>}
    </figure>
  );
}

/**
 * Premium architectural line-art placeholder. Clearly labelled "placeholder" so
 * it is never mistaken for a real project. Replace with real before/after photos
 * before launch. `after` adds a glazed extension + warm tone to suggest the design.
 */
function PlaceholderPanel({ label, tone }: { label: string; tone: "before" | "after" }) {
  const after = tone === "after";
  return (
    <div className={"relative h-full w-full " + (after ? "bg-[#c9bca9]" : "bg-[#d8d2c6]")}>
      <svg
        viewBox="0 0 300 200"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <rect width="300" height="200" fill={after ? "#c9bca9" : "#d8d2c6"} />
        <rect x="0" y="150" width="300" height="50" fill={after ? "#bdae98" : "#cdc6b8"} />
        {/* existing house */}
        <g stroke="#5b5346" strokeWidth="1.6" fill="none" strokeLinejoin="round">
          <path d="M70 150 V95 L120 65 L170 95 V150 Z" fill={after ? "#e7e0d3" : "#e9e4d9"} />
          <path d="M70 95 L120 65 L170 95" />
          <rect x="88" y="110" width="20" height="22" fill="#cfd6d2" />
          <rect x="132" y="110" width="20" height="22" fill="#cfd6d2" />
          <rect x="110" y="128" width="16" height="22" fill="#9a8f79" />
        </g>
        {/* proposed glazed extension (after only) */}
        {after && (
          <g stroke="#a45f2d" strokeWidth="1.8" fill="none" strokeLinejoin="round">
            <path d="M170 150 V118 H235 V150 Z" fill="#cfe0e6" fillOpacity="0.85" />
            <path d="M170 118 H235" />
            <path d="M188 118 V150 M206 118 V150 M223 118 V150" strokeWidth="1.1" />
          </g>
        )}
      </svg>
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ink/70 px-3 py-1 text-[11px] font-medium text-paper">
        {label} · placeholder
      </span>
    </div>
  );
}
