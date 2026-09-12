"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Apple-style scroll reveal — dependency-free, progressive-enhancement.
 *
 * On mount (browsers that allow motion) it adds `js-reveal` to <html> so the CSS
 * start-state applies, then a single IntersectionObserver marks each
 * `[data-reveal]` element `.is-visible` once as it enters the viewport and stops
 * observing it. Content is visible by default without JS or under
 * prefers-reduced-motion — nothing is ever left hidden. Re-scans on route change.
 */
export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) return;

    const root = document.documentElement;
    root.classList.add("js-reveal");

    const io = new IntersectionObserver(
      (entries, obs) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            obs.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );

    // Anything already in view (e.g. above the fold) reveals immediately.
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    for (const el of els) {
      if (el.classList.contains("is-visible")) continue;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("is-visible");
      else io.observe(el);
    }

    // Safety net: never leave content hidden if the observer ever misfires — after
    // a short grace period reveal anything still pending (it will simply fade in).
    const failsafe = window.setTimeout(() => {
      for (const el of els) el.classList.add("is-visible");
    }, 2500);

    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [pathname]);

  return null;
}
