/**
 * SC Design Wirral — first-party client error reporter.
 *
 * Fire-and-forget, mirrors the analytics/enquiry-backup pattern (text/plain →
 * CORS-simple, sendBeacon with a keepalive fetch fallback, every failure
 * swallowed so reporting can never break the page). Captures as much context as
 * possible for each error — message, stack, source, the breadcrumbs (clicks,
 * route changes, fetches, console errors) leading up to it, plus device / screen
 * / connection — so a broken page or form can be found and fixed before it costs
 * a lead.
 *
 * Volume-safe: identical errors are de-duped per page-load, distinct sends are
 * capped, and a small queue spaces bursts out. The server flags bots (it never
 * drops them) so the admin can filter them.
 */

const BASE =
  process.env.NEXT_PUBLIC_SC_ANALYTICS_BASE || "https://scdesign-wirral.vercel.app";
const ENDPOINT = `${BASE}/api/sc-error-collect`;

type Json = Record<string, unknown>;

export type ErrorReport = {
  type:
    | "js_error"
    | "resource_error"
    | "unhandled_rejection"
    | "react_error"
    | "form_error"
    | "console_error";
  severity?: "error" | "warning";
  message?: string;
  source?: string;
  lineno?: number | null;
  colno?: number | null;
  stack?: string;
  props?: Json;
};

type Crumb = { t: number; k: string; m: string };

const MAX_CRUMBS = 25;
const MAX_SENDS = 25; // hard cap on distinct reports per page-load
const MIN_INTERVAL = 300; // ms between sends, to smooth bursts

const crumbs: Crumb[] = [];
const sentSignatures = new Set<string>();
let totalSent = 0;
let loadTs = 0;
if (typeof window !== "undefined") loadTs = Date.now();

/** Push a breadcrumb onto the ring buffer (kept short; oldest dropped). */
export function recordBreadcrumb(kind: string, message: unknown) {
  if (typeof window === "undefined") return;
  let m: string;
  if (typeof message === "string") m = message;
  else {
    try {
      m = JSON.stringify(message);
    } catch {
      m = String(message);
    }
  }
  crumbs.push({ t: Date.now() - loadTs, k: kind, m: (m || "").slice(0, 240) });
  if (crumbs.length > MAX_CRUMBS) crumbs.shift();
}

/* ----------------------------- transport ----------------------------- */

function send(body: Json) {
  if (typeof window === "undefined") return;
  try {
    const data = JSON.stringify(body);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([data], { type: "text/plain" }));
    } else {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: data,
        keepalive: true,
        mode: "cors",
        credentials: "omit",
      }).catch(() => {});
    }
  } catch {
    /* never let error reporting break the page */
  }
}

const queue: Json[] = [];
let flushScheduled = false;
let lastSendAt = 0;

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  const wait = Math.max(0, MIN_INTERVAL - (Date.now() - lastSendAt));
  setTimeout(flush, wait);
}

function flush() {
  flushScheduled = false;
  const payload = queue.shift();
  if (!payload) return;
  lastSendAt = Date.now();
  send(payload);
  if (queue.length) scheduleFlush();
}

/* ----------------------------- context ----------------------------- */

function context(): Json {
  const u = new URL(window.location.href);
  const q = (k: string) => u.searchParams.get(k) || undefined;
  return {
    p: window.location.pathname,
    url: window.location.href,
    r: document.referrer || undefined,
    lang: navigator.language,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dpr: window.devicePixelRatio,
    sw: window.screen?.width,
    sh: window.screen?.height,
    vw: window.innerWidth,
    vh: window.innerHeight,
    us: q("utm_source"),
    um: q("utm_medium"),
    uc: q("utm_campaign"),
    ut: q("utm_term"),
    uo: q("utm_content"),
  };
}

function envProps(): Json {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
    deviceMemory?: number;
  };
  const c = nav.connection;
  const buildId = (window as unknown as { __NEXT_DATA__?: { buildId?: string } }).__NEXT_DATA__
    ?.buildId;
  return {
    surface: "public",
    online: navigator.onLine,
    connection: c
      ? { effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: c.saveData }
      : undefined,
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    title: document.title,
    visibility: document.visibilityState,
    sinceLoadMs: Date.now() - loadTs,
    buildId,
    breadcrumbs: crumbs.slice(-MAX_CRUMBS),
  };
}

/* ----------------------------- public API ----------------------------- */

/**
 * Report one error. Enriches with page + environment context and the current
 * breadcrumb trail, de-dupes identical errors, caps total sends per page-load,
 * and queues so a burst can't flood the endpoint.
 */
export function reportError(report: ErrorReport) {
  if (typeof window === "undefined") return;
  try {
    const message = (report.message || "").slice(0, 2000);
    const source = report.source || "";
    const sig = `${report.type}|${message}|${source}|${report.lineno ?? ""}`;
    if (sentSignatures.has(sig)) return; // identical error already reported this page-load
    if (totalSent >= MAX_SENDS) return; // safety cap
    sentSignatures.add(sig);
    totalSent++;

    const props = Object.assign(envProps(), report.props || {});
    const payload: Json = Object.assign(context(), {
      type: report.type,
      severity: report.severity || "error",
      message: message || undefined,
      source: source || undefined,
      lineno: report.lineno ?? undefined,
      colno: report.colno ?? undefined,
      stack: report.stack ? String(report.stack).slice(0, 8000) : undefined,
      props,
    });
    queue.push(payload);
    scheduleFlush();
  } catch {
    /* never throw from the reporter */
  }
}

/* ----------------------------- installers ----------------------------- */

function describeEl(el: HTMLElement): string {
  const tag = el.tagName ? el.tagName.toLowerCase() : "?";
  const id = el.id ? `#${el.id}` : "";
  const cls =
    typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
  const href = el.getAttribute && el.getAttribute("href") ? ` ${el.getAttribute("href")}` : "";
  const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
  return `${tag}${id}${cls}${href}${text ? ` "${text}"` : ""}`.slice(0, 160);
}

function shortUrl(u: string): string {
  try {
    const url = new URL(u, window.location.href);
    return url.origin === window.location.origin
      ? url.pathname + url.search
      : url.host + url.pathname;
  } catch {
    return String(u).slice(0, 120);
  }
}

function onErrorEvent(ev: Event) {
  const target = ev.target as (HTMLElement & { src?: string; href?: string }) | null;
  // Resource-load failure (img / script / link / media) — target is the element,
  // and there's no error message on the event.
  if (target && (target as unknown) !== window && target.tagName) {
    const tag = target.tagName.toLowerCase();
    if (["img", "script", "link", "audio", "video", "source", "track"].includes(tag)) {
      const resUrl = target.src || target.href || "";
      reportError({
        type: "resource_error",
        severity: "error",
        message: `Failed to load ${tag}${resUrl ? `: ${resUrl}` : ""}`,
        source: resUrl,
        props: { resourceUrl: resUrl, tagName: tag },
      });
      return;
    }
  }
  // Uncaught JS error.
  const e = ev as ErrorEvent;
  reportError({
    type: "js_error",
    severity: "error",
    message: e.message || "Uncaught error",
    source: e.filename,
    lineno: e.lineno,
    colno: e.colno,
    stack: e.error && e.error.stack ? String(e.error.stack) : undefined,
  });
}

function onRejection(ev: PromiseRejectionEvent) {
  const reason: unknown = ev.reason;
  let message = "Unhandled promise rejection";
  let stack: string | undefined;
  if (reason instanceof Error) {
    message = reason.message || message;
    stack = reason.stack;
  } else if (typeof reason === "string") {
    message = reason;
  } else if (reason) {
    try {
      message = JSON.stringify(reason);
    } catch {
      message = String(reason);
    }
  }
  reportError({ type: "unhandled_rejection", severity: "error", message, stack });
}

function stringifyArg(a: unknown): string {
  if (a instanceof Error) return a.message;
  if (typeof a === "string") return a;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

let installed = false;

/**
 * Install every capture path once: uncaught errors, resource failures, promise
 * rejections, a console.error wrapper, plus passive breadcrumb listeners
 * (clicks, route changes, fetches, console.warn). Safe to call repeatedly.
 */
export function initErrorTracking() {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  loadTs = loadTs || Date.now();

  window.addEventListener("error", onErrorEvent, true);
  window.addEventListener("unhandledrejection", onRejection);

  // console.error → standalone report + breadcrumb (keeps original behaviour).
  const origError = console.error;
  console.error = function (...args: unknown[]) {
    try {
      const msg = args.map(stringifyArg).join(" ").slice(0, 2000);
      recordBreadcrumb("console.error", msg);
      const errArg = args.find((a) => a instanceof Error) as Error | undefined;
      reportError({
        type: "console_error",
        severity: "error",
        message: msg || "console.error",
        stack: errArg ? errArg.stack : undefined,
      });
    } catch {
      /* ignore */
    }
    return origError.apply(console, args as []);
  };

  // console.warn → breadcrumb only (context, not a reported error).
  const origWarn = console.warn;
  console.warn = function (...args: unknown[]) {
    try {
      recordBreadcrumb("console.warn", args.map(stringifyArg).join(" ").slice(0, 240));
    } catch {
      /* ignore */
    }
    return origWarn.apply(console, args as []);
  };

  // Click breadcrumbs (capture phase, passive).
  document.addEventListener(
    "click",
    (ev) => {
      try {
        const t = ev.target as HTMLElement | null;
        if (!t || !t.closest) return;
        const el =
          (t.closest("a,button,[role=button],input,select,textarea") as HTMLElement | null) || t;
        recordBreadcrumb("click", describeEl(el));
      } catch {
        /* ignore */
      }
    },
    true
  );

  // Route-change breadcrumbs (App Router uses history API).
  const recordNav = (to: string) => recordBreadcrumb("navigate", to);
  try {
    const origPush = history.pushState;
    history.pushState = function (this: History, ...args: Parameters<History["pushState"]>) {
      try {
        recordNav(String(args[2] ?? window.location.pathname));
      } catch {
        /* ignore */
      }
      return origPush.apply(this, args);
    };
    const origReplace = history.replaceState;
    history.replaceState = function (this: History, ...args: Parameters<History["replaceState"]>) {
      try {
        recordNav(String(args[2] ?? window.location.pathname));
      } catch {
        /* ignore */
      }
      return origReplace.apply(this, args);
    };
    window.addEventListener("popstate", () =>
      recordNav(window.location.pathname + window.location.search)
    );
  } catch {
    /* history not patchable — skip nav breadcrumbs */
  }

  // Fetch breadcrumbs (skip our own telemetry endpoints to avoid noise).
  try {
    const origFetch = window.fetch;
    window.fetch = function (...args: Parameters<typeof fetch>) {
      const first = args[0];
      const url =
        typeof first === "string"
          ? first
          : first instanceof Request
          ? first.url
          : String(first);
      if (/\/api\/sc-(error|analytics|enquiry)/.test(url)) {
        return origFetch.apply(window, args);
      }
      const method = (
        (args[1] && args[1].method) ||
        (first instanceof Request ? first.method : "GET") ||
        "GET"
      ).toUpperCase();
      const t0 = Date.now();
      return origFetch.apply(window, args).then(
        (res) => {
          recordBreadcrumb("fetch", `${method} ${shortUrl(url)} → ${res.status} (${Date.now() - t0}ms)`);
          return res;
        },
        (err) => {
          recordBreadcrumb(
            "fetch",
            `${method} ${shortUrl(url)} → network error (${Date.now() - t0}ms)`
          );
          throw err;
        }
      );
    };
  } catch {
    /* fetch not patchable — skip fetch breadcrumbs */
  }
}
