"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * SC Design Wirral — first-party, cookieless analytics tracker.
 *
 * Sends a pageview on load + on every client-side route change, plus an
 * "engaged" beacon (time on page + max scroll depth) when the page is left.
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
  const startRef = useRef<number>(0);
  const scrollRef = useRef<number>(0);
  const sentEngagedRef = useRef<boolean>(false);
  const prevPathRef = useRef<string>("");

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

  // Send an "engaged" beacon (duration + scroll) for the page being left.
  function flushEngaged() {
    const p = prevPathRef.current;
    if (!p || sentEngagedRef.current || isAdminPath(p)) return;
    const dur = startRef.current ? Date.now() - startRef.current : 0;
    sentEngagedRef.current = true;
    send({
      t: "event",
      n: "engaged",
      p,
      props: { dur, scroll: scrollRef.current },
    });
  }

  // Flush engagement when the tab is hidden or the page unloads.
  useEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden") flushEngaged();
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushEngaged);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushEngaged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On each route change: flush the previous page's engagement, then record the
  // new pageview and reset counters.
  useEffect(() => {
    if (!pathname || isAdminPath(pathname)) {
      prevPathRef.current = pathname || "";
      return;
    }
    // Flush engagement for the page we just left (client-side nav).
    if (prevPathRef.current && prevPathRef.current !== pathname) flushEngaged();

    send({ t: "pageview", n: "pageview", ...context() });

    prevPathRef.current = pathname;
    startRef.current = Date.now();
    scrollRef.current = 0;
    sentEngagedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
