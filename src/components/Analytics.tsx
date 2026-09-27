"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * SC Design Wirral — first-party, cookieless analytics tracker.
 *
 * Sends a pageview on load + on every client-side route change, plus an
 * "engaged" beacon (time on page + max scroll depth) when the page is left, plus
 * one "vitals" beacon per visit carrying the real loading-speed measurements.
 * No cookies, no localStorage, no personal data — the server derives coarse geo
 * and a daily-rotating visitor hash. Runs under legitimate interest (no consent
 * gate needed); the only consent-gated feature on the site is the reviews widget.
 *
 * Beacons are sent as text/plain so they're CORS-simple (no preflight) and work
 * with navigator.sendBeacon to the SC-only Vercel endpoint.
 */

const BASE =
  process.env.NEXT_PUBLIC_SC_ANALYTICS_BASE || "https://scdesign-wirral.vercel.app";
const COLLECT = `${BASE}/api/sc-analytics-collect`;

type Json = Record<string, unknown>;

/** Entry shapes the vitals observers need that the base PerformanceEntry lacks. */
type VitalEntry = PerformanceEntry & { hadRecentInput?: boolean; value?: number };

function isAdminPath(p: string) {
  return p.startsWith("/admin");
}

function send(body: Json) {
  if (typeof window === "undefined") return;
  try {
    const data = JSON.stringify(body);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(COLLECT, new Blob([data], { type: "text/plain" }));
    } else {
      fetch(COLLECT, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: data,
        keepalive: true,
        mode: "cors",
        credentials: "omit",
      }).catch(() => {});
    }
  } catch {
    /* never let analytics break the page */
  }
}

/**
 * A throwaway id for ONE page view.
 *
 * Engagement is now reported more than once for the same page (see flushEngaged),
 * and the server has to be able to tell "the same page, reported again with a bigger
 * total" from "a second page". Without it, two beacons for one page would be summed
 * and a six-minute read would be reported as nine.
 *
 * Not an identifier for a person: it is regenerated on every page view, is never
 * stored anywhere, and cannot be linked to anything else.
 */
function pageViewId() {
  try {
    const a = new Uint8Array(8);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return String(Date.now()) + String(Math.floor(Math.random() * 1e6));
  }
}

function context(): Json {
  const u = new URL(window.location.href);
  const q = (k: string) => u.searchParams.get(k) || undefined;
  return {
    p: window.location.pathname,
    title: document.title,
    r: document.referrer || undefined,
    sw: window.screen?.width,
    sh: window.screen?.height,
    vw: window.innerWidth,
    vh: window.innerHeight,
    dpr: window.devicePixelRatio,
    lang: navigator.language,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    us: q("utm_source"),
    um: q("utm_medium"),
    uc: q("utm_campaign"),
    ut: q("utm_term"),
    uo: q("utm_content"),
  };
}

/** Fire a custom event (e.g. phone_click) to the first-party endpoint. */
export function track(event: string, props?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  if (isAdminPath(window.location.pathname)) return;
  send({ t: "event", n: event, p: window.location.pathname, props: props || {} });
}

export function Analytics() {
  const pathname = usePathname();
  const scrollRef = useRef<number>(0);
  const prevPathRef = useRef<string>("");
  const pvidRef = useRef<string>("");

  // Time on page, counted only while the tab is actually visible.
  //
  // It used to be wall-clock from load to the first hide, reported once and never
  // again: someone who glanced at the page, switched tabs for an hour, came back and
  // read properly for six minutes was recorded as a few seconds. Both halves of that
  // are fixed here — background time is not counted, and a later beacon supersedes
  // the earlier one.
  const activeRef = useRef<number>(0);
  const resumedRef = useRef<number>(0);
  const reportedRef = useRef<number>(0);

  const vitalsRef = useRef<{ lcp?: number; cls?: number; inp?: number; ttfb?: number }>({});
  const vitalsPathRef = useRef<string>("");
  const vitalsSentRef = useRef<boolean>(false);

  /** Fold the stretch since the page last became visible into the total. */
  const settle = useCallback(() => {
    if (resumedRef.current) {
      activeRef.current += Date.now() - resumedRef.current;
      resumedRef.current = 0;
    }
  }, []);

  const flushEngaged = useCallback(() => {
    const p = prevPathRef.current;
    if (!p || isAdminPath(p)) return;
    settle();
    const d = activeRef.current;
    // Nothing new to report. (The first beacon always goes, even at zero, so a
    // bounce still produces one reading.)
    if (reportedRef.current && d <= reportedRef.current) return;
    reportedRef.current = d;
    send({
      t: "event",
      n: "engaged",
      p,
      props: { dur: d, scroll: scrollRef.current, pvid: pvidRef.current },
    });
  }, [settle]);

  /**
   * Loading speed, sent once per visit and attributed to the LANDING page.
   *
   * Deliberately not per-route: cumulative layout shift and interaction delay are
   * measured across the whole document lifetime and only settle when it ends, so
   * pinning them to whichever route happened to be open at that moment would report
   * the first page's problems against the last page the visitor saw.
   */
  const flushVitals = useCallback(() => {
    if (vitalsSentRef.current) return;
    const v = vitalsRef.current;
    const r3 = (n?: number) => (Number.isFinite(n) ? Math.round((n as number) * 1000) / 1000 : undefined);
    const ms = (n?: number) => (Number.isFinite(n) ? Math.round(n as number) : undefined);
    const props: Record<string, number> = {};
    const lcp = ms(v.lcp);
    if (lcp !== undefined) props.lcp = lcp;
    const cls = r3(v.cls);
    if (cls !== undefined) props.cls = cls;
    const inp = ms(v.inp);
    if (inp !== undefined) props.inp = inp;
    const ttfb = ms(v.ttfb);
    if (ttfb !== undefined) props.ttfb = ttfb;
    if (!Object.keys(props).length) return;
    const p = vitalsPathRef.current;
    if (!p || isAdminPath(p)) return;
    vitalsSentRef.current = true;
    send({ t: "event", n: "vitals", p, props });
  }, []);

  // Track max scroll depth (%) for the current page.
  useEffect(() => {
    function onScroll() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const pct = max > 0 ? Math.round((doc.scrollTop / max) * 100) : 0;
      if (pct > scrollRef.current) scrollRef.current = Math.min(100, pct);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Collect the loading-speed measurements. One set per document, buffered so
  // entries that happened before this ran are not lost.
  useEffect(() => {
    const observers: PerformanceObserver[] = [];
    const watch = (
      type: string,
      handle: (entries: VitalEntry[]) => void,
      durationThreshold?: number
    ) => {
      if (typeof PerformanceObserver === "undefined") return;
      try {
        const po = new PerformanceObserver((list) => handle(list.getEntries() as VitalEntry[]));
        const init: PerformanceObserverInit & { durationThreshold?: number } = {
          type,
          buffered: true,
        };
        if (durationThreshold) init.durationThreshold = durationThreshold;
        po.observe(init);
        observers.push(po);
      } catch {
        /* entry type not supported in this browser — that metric is simply absent */
      }
    };

    watch("largest-contentful-paint", (entries) => {
      const last = entries[entries.length - 1];
      if (last) vitalsRef.current.lcp = last.startTime;
    });
    watch("layout-shift", (entries) => {
      for (const e of entries) {
        // A shift the visitor caused by tapping something is not a layout fault.
        if (!e.hadRecentInput && typeof e.value === "number")
          vitalsRef.current.cls = (vitalsRef.current.cls || 0) + e.value;
      }
    });
    watch(
      "event",
      (entries) => {
        for (const e of entries) {
          if (Number.isFinite(e.duration) && e.duration > (vitalsRef.current.inp || 0))
            vitalsRef.current.inp = e.duration;
        }
      },
      40
    );
    try {
      const nav = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (nav && Number.isFinite(nav.responseStart)) vitalsRef.current.ttfb = nav.responseStart;
    } catch {
      /* navigation timing unavailable */
    }

    return () => {
      for (const po of observers) {
        try {
          po.disconnect();
        } catch {
          /* already gone */
        }
      }
    };
  }, []);

  // Pause the clock when the tab is hidden, restart it when it comes back, and
  // report what we have at each hide (in case the visitor never returns).
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        flushEngaged();
        flushVitals();
      } else if (!resumedRef.current) {
        resumedRef.current = Date.now();
      }
    }
    function onLeave() {
      flushEngaged();
      flushVitals();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [flushEngaged, flushVitals]);

  // On each route change: flush the previous page's engagement, then record the
  // new pageview and reset counters.
  useEffect(() => {
    if (!pathname || isAdminPath(pathname)) {
      prevPathRef.current = pathname || "";
      return;
    }
    // Flush engagement for the page we just left (client-side nav).
    if (prevPathRef.current && prevPathRef.current !== pathname) flushEngaged();

    const pvid = pageViewId();
    pvidRef.current = pvid;
    if (!vitalsPathRef.current) vitalsPathRef.current = pathname;

    // pvid rides in `props`, not at the top level: the collector only lifts named
    // top-level keys into the stored row, so anything else there is silently dropped.
    send({ t: "pageview", n: "pageview", props: { pvid }, ...context() });

    prevPathRef.current = pathname;
    activeRef.current = 0;
    reportedRef.current = 0;
    resumedRef.current = document.visibilityState === "hidden" ? 0 : Date.now();
    scrollRef.current = 0;
  }, [pathname, flushEngaged]);

  return null;
}
