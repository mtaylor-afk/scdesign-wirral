// WV Roofing Roof Visualiser — client for /api/wvroofing/render.
import { API_BASE, IS_LOCAL } from "../config.js";

export class ApiError extends Error {
  constructor(status, code, message, retryAfterMs) {
    super(message || code || "Request failed");
    this.status = status;
    this.code = code || "error";
    this.retryAfterMs = retryAfterMs || 0;
    // 429 / 5xx upstream hiccups can be retried; 503 means "stopped" (no retry).
    this.retryable = status === 429 || status === 502 || status === 504 || status === 0;
    this.stopsQueue = status === 503;
  }
}

let healthPromise = null;

/** Server capabilities; never throws (an unreachable API means "not live"). */
export function getHealth(force) {
  if (healthPromise && !force) return healthPromise;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 7000);
  healthPromise = fetch(API_BASE + "/api/wvroofing/render", { cache: "no-store", signal: ctl.signal })
    .then((r) => (r.ok ? r.json() : { ok: false }))
    .then((j) => ({
      reachable: !!j && j.ok !== false,
      live: !!(j && j.live),
      mock: !!(j && j.mock),
      model: (j && j.model) || "",
      flex: j && typeof j.flex === "boolean" ? j.flex : true,
      maxConcurrent: Math.max(1, Math.min(3, Number(j && j.maxConcurrent) || 2)),
      autoRender: Math.max(0, Math.min(8, Number(j && j.autoRender) || 8)),
    }))
    .catch(() => ({ reachable: false, live: false, mock: false, model: "", flex: true, maxConcurrent: 2, autoRender: 8 }))
    .finally(() => clearTimeout(timer));
  return healthPromise;
}

/** Mock mode is only offered on a local dev server with no key configured. */
export function mockAllowed(health) {
  const q = new URLSearchParams(window.location.search);
  return IS_LOCAL && !health.live && (q.get("mock") === "1" || !!health.mock);
}

function parseRetryAfter(res) {
  const v = res.headers.get("Retry-After");
  if (!v) return 0;
  const s = Number(v);
  if (!Number.isNaN(s)) return Math.max(0, s * 1000);
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : Math.max(0, t - Date.now());
}

/**
 * Request one photo-real render.
 * @returns {Promise<{image:string, model?:string, usage?:object}>}
 */
export async function requestRender({ productId, image, mask, W, H, mock, signal }) {
  let res;
  try {
    res = await fetch(API_BASE + "/api/wvroofing/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, image, mask, W, H, mock: !!mock }),
      signal,
    });
  } catch (err) {
    if (err && err.name === "AbortError") throw err;
    throw new ApiError(0, "network", "We couldn't reach the render service.");
  }
  let json = {};
  try {
    json = await res.json();
  } catch (err) {
    json = {};
  }
  if (!res.ok || !json.ok) {
    throw new ApiError(res.status, json.error, json.message, parseRetryAfter(res) || (json.retryAfter ? json.retryAfter * 1000 : 0));
  }
  if (!json.image || !/^data:image\/(jpeg|png|webp);base64,/.test(json.image)) {
    throw new ApiError(502, "bad_image", "The render came back in an unexpected format.");
  }
  return json;
}
