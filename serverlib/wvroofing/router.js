// WV Roofing — the router behind the single Vercel function api/wvroofing/app.js.
//
// vercel.json rewrites /api/wvroofing/:path* to that function. The router
// matches the ORIGINAL request path (Vercel keeps req.url through rewrites,
// as Express-on-Vercel apps rely on). If a request reaches the function by its
// own path (/api/wvroofing/app), the route comes from ?path=, accepted only
// as one string of safe characters. Either way the path is resolved once and
// that route's own auth rule is applied, so the two can never disagree.
"use strict";

const crypto = require("crypto");
const core = require("./core.js");

const { HttpError, json } = core;
const PREFIX = /^\/api\/wvroofing\/(.*)$/;
const SAFE_ROUTE = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/;

/**
 * @typedef {import("http").IncomingMessage & { body?: unknown, query?: unknown }} Req
 * @typedef {import("http").ServerResponse} Res
 * @typedef {{ req: Req, res: Res, params: Record<string, string>, url: URL, startedAt: number, project?: Record<string, any>, operator?: Record<string, any> }} Ctx
 * @typedef {"none" | "cron" | "project" | "operator"} Auth
 * @typedef {object} Route
 * @property {string} path            e.g. "health" or "projects/:id/renders"
 * @property {string[]} methods
 * @property {Auth} auth
 * @property {"any" | "allowed"} [origin]  "any": callers without an allowed Origin are served too (health, cron)
 * @property {"write"} [turn]  a GET whose change must be saved (an audit row, a paid-call cap, a render
 *   worker's claim) takes a write turn in snapshot mode (db.js), not a read turn
 * @property {(ctx: Ctx) => Promise<void>} handler
 */

/** @type {Route[]} */
const ROUTES = [
  { path: "health", methods: ["GET"], auth: "none", origin: "any", handler: (ctx) => require("./health.js").health(ctx) },
  { path: "cron/daily", methods: ["GET"], auth: "cron", origin: "any", handler: (ctx) => require("./cron/daily.js").daily(ctx) },
  // Customer projects (A2). The token in "Authorization: Bearer" opens one project only.
  { path: "projects", methods: ["POST"], auth: "none", handler: (ctx) => require("./projects.js").create(ctx) },
  { path: "projects/:id", methods: ["GET"], auth: "project", handler: (ctx) => require("./projects.js").get(/** @type {any} */ (ctx)) },
  { path: "projects/:id/consent", methods: ["POST"], auth: "project", handler: (ctx) => require("./projects.js").consent(/** @type {any} */ (ctx)) },
  { path: "projects/:id/photo/presign", methods: ["POST"], auth: "project", handler: (ctx) => require("./projects.js").presign(/** @type {any} */ (ctx)) },
  { path: "projects/:id/photo/commit", methods: ["POST"], auth: "project", handler: (ctx) => require("./projects.js").commit(/** @type {any} */ (ctx)) },
  { path: "projects/:id/photo/display", methods: ["GET"], auth: "project", handler: (ctx) => require("./projects.js").display(/** @type {any} */ (ctx)) },
  { path: "projects/:id/mask", methods: ["POST"], auth: "project", handler: (ctx) => require("./projects.js").mask(/** @type {any} */ (ctx)) },
  { path: "projects/:id/delete", methods: ["POST"], auth: "project", handler: (ctx) => require("./projects.js").remove(/** @type {any} */ (ctx)) },
  // A preview drawn on the customer's device, kept with the photo for the roofer.
  { path: "projects/:id/mockups", methods: ["POST"], auth: "project", handler: (ctx) => require("./mockups.js").add(/** @type {any} */ (ctx)) },
  // Photo-real renders (A3): durable jobs, polled by the customer.
  { path: "projects/:id/renders", methods: ["POST"], auth: "project", handler: (ctx) => require("./renders.js").submit(/** @type {any} */ (ctx)) },
  { path: "projects/:id/renders", methods: ["GET"], auth: "project", turn: "write", handler: (ctx) => require("./renders.js").list(/** @type {any} */ (ctx)) },
  { path: "projects/:id/renders/:jobId/image", methods: ["GET"], auth: "project", handler: (ctx) => require("./renders.js").image(/** @type {any} */ (ctx)) },
  { path: "projects/:id/renders/:jobId/cancel", methods: ["POST"], auth: "project", handler: (ctx) => require("./renders.js").cancel(/** @type {any} */ (ctx)) },
  // The property (A5): address lookup and choice, the aerial view, the customer's confirmation.
  { path: "projects/:id/address/lookup", methods: ["POST"], auth: "project", handler: (ctx) => require("./property.js").lookup(/** @type {any} */ (ctx)) },
  { path: "projects/:id/address", methods: ["POST"], auth: "project", handler: (ctx) => require("./property.js").choose(/** @type {any} */ (ctx)) },
  { path: "projects/:id/address", methods: ["DELETE"], auth: "project", handler: (ctx) => require("./property.js").clear(/** @type {any} */ (ctx)) },
  { path: "projects/:id/property/view", methods: ["GET"], auth: "project", turn: "write", handler: (ctx) => require("./property.js").view(/** @type {any} */ (ctx)) },
  { path: "projects/:id/property/confirm", methods: ["POST"], auth: "project", handler: (ctx) => require("./property.js").confirm(/** @type {any} */ (ctx)) },
  // The estimate step (B2): the roof's size and materials, only from a measurement the roofer approved and made visible.
  { path: "projects/:id/estimate", methods: ["GET"], auth: "project", handler: (ctx) => require("./measurements.js").estimate(/** @type {any} */ (ctx)) },
  // Plans, drawings and extra photos the customer adds for the roofer to measure from (B3).
  { path: "projects/:id/evidence/presign", methods: ["POST"], auth: "project", handler: (ctx) => require("./evidence.js").presign(/** @type {any} */ (ctx)) },
  { path: "projects/:id/evidence/commit", methods: ["POST"], auth: "project", handler: (ctx) => require("./evidence.js").commit(/** @type {any} */ (ctx)) },
  { path: "projects/:id/evidence", methods: ["GET"], auth: "project", handler: (ctx) => require("./evidence.js").list(/** @type {any} */ (ctx)) },
  { path: "projects/:id/evidence/:evidenceId/delete", methods: ["POST"], auth: "project", handler: (ctx) => require("./evidence.js").remove(/** @type {any} */ (ctx)) },
  // Enquiries (A4): saved first, then the roofer is notified. "enquiry" is the pre-v02
  // path, kept permanently so older pages keep working.
  { path: "enquiries", methods: ["POST"], auth: "none", handler: (ctx) => require("./enquiries.js").createFree(ctx) },
  { path: "enquiry", methods: ["POST"], auth: "none", handler: (ctx) => require("./enquiries.js").createFree(ctx) },
  { path: "projects/:id/enquiry", methods: ["POST"], auth: "project", handler: (ctx) => require("./enquiries.js").createForProject(/** @type {any} */ (ctx)) },
  { path: "projects/:id/enquiry", methods: ["GET"], auth: "project", handler: (ctx) => require("./enquiries.js").getForProject(/** @type {any} */ (ctx)) },
  // The operator screen (A6) and the admin pages built on it (/WVROOFING/admin/,
  // /WVROOFING/2/admin/). Every route but login needs the operator's session key.
  { path: "operator/login", methods: ["POST"], auth: "none", handler: (ctx) => op().login(ctx) },
  { path: "operator/logout", methods: ["POST"], auth: "operator", handler: (ctx) => op().logout(/** @type {any} */ (ctx)) },
  { path: "operator/session", methods: ["GET"], auth: "operator", handler: (ctx) => op().session(/** @type {any} */ (ctx)) },
  // The admin pages' home (counts for one site or both) and the enquiries as a
  // spreadsheet (no ".csv" in the path: routes are plain words, see SAFE_ROUTE).
  { path: "operator/overview", methods: ["GET"], auth: "operator", handler: (ctx) => op().overview(/** @type {any} */ (ctx)) },
  { path: "operator/export/enquiries", methods: ["GET"], auth: "operator", turn: "write", handler: (ctx) => op().exportEnquiries(/** @type {any} */ (ctx)) },
  { path: "operator/enquiries", methods: ["GET"], auth: "operator", handler: (ctx) => op().listEnquiries(/** @type {any} */ (ctx)) },
  { path: "operator/enquiries/:id", methods: ["GET"], auth: "operator", handler: (ctx) => op().enquiryDetail(/** @type {any} */ (ctx)) },
  { path: "operator/enquiries/:id/aerial", methods: ["GET"], auth: "operator", turn: "write", handler: (ctx) => op().enquiryAerial(/** @type {any} */ (ctx)) },
  { path: "operator/enquiries/:id/scope", methods: ["POST"], auth: "operator", handler: (ctx) => op().scope(/** @type {any} */ (ctx)) },
  { path: "operator/enquiries/:id/status", methods: ["POST"], auth: "operator", handler: (ctx) => op().setStatus(/** @type {any} */ (ctx)) },
  { path: "operator/enquiries/:id/request-survey", methods: ["POST"], auth: "operator", handler: (ctx) => op().requestSurvey(/** @type {any} */ (ctx)) },
  { path: "operator/enquiries/:id/resend", methods: ["POST"], auth: "operator", handler: (ctx) => op().resend(/** @type {any} */ (ctx)) },
  { path: "operator/enquiries/:id/delete", methods: ["POST"], auth: "operator", handler: (ctx) => op().deleteEnquiry(/** @type {any} */ (ctx)) },
  // Every customer photo from both sites, with or without an enquiry.
  { path: "operator/projects", methods: ["GET"], auth: "operator", handler: (ctx) => op().listProjects(/** @type {any} */ (ctx)) },
  { path: "operator/projects/:id", methods: ["GET"], auth: "operator", handler: (ctx) => op().projectView(/** @type {any} */ (ctx)) },
  { path: "operator/projects/:id/photo", methods: ["GET"], auth: "operator", handler: (ctx) => op().projectPhoto(/** @type {any} */ (ctx)) },
  { path: "operator/mockups/:id/image", methods: ["GET"], auth: "operator", handler: (ctx) => op().mockupImage(/** @type {any} */ (ctx)) },
  { path: "operator/projects/:id/original", methods: ["GET"], auth: "operator", turn: "write", handler: (ctx) => op().projectOriginal(/** @type {any} */ (ctx)) },
  { path: "operator/projects/:id/delete", methods: ["POST"], auth: "operator", handler: (ctx) => op().deleteProjectRoute(/** @type {any} */ (ctx)) },
  { path: "operator/jobs", methods: ["GET"], auth: "operator", handler: (ctx) => op().listJobs(/** @type {any} */ (ctx)) },
  { path: "operator/jobs/:id/image", methods: ["GET"], auth: "operator", handler: (ctx) => op().jobImage(/** @type {any} */ (ctx)) },
  { path: "operator/jobs/:id/retry", methods: ["POST"], auth: "operator", handler: (ctx) => op().retryJob(/** @type {any} */ (ctx)) },
  { path: "operator/costs", methods: ["GET"], auth: "operator", handler: (ctx) => op().costs(/** @type {any} */ (ctx)) },
  // Roof measurements (B3): entered by the roofer, approved, shown to the customer or not.
  { path: "operator/enquiries/:id/measurement", methods: ["POST"], auth: "operator", handler: (ctx) => op().addMeasurement(/** @type {any} */ (ctx)) },
  { path: "operator/measurements/:id/approve", methods: ["POST"], auth: "operator", handler: (ctx) => op().approveMeasurement(/** @type {any} */ (ctx)) },
  { path: "operator/measurements/:id/reject", methods: ["POST"], auth: "operator", handler: (ctx) => op().rejectMeasurement(/** @type {any} */ (ctx)) },
  { path: "operator/measurements/:id/visibility", methods: ["POST"], auth: "operator", handler: (ctx) => op().measurementVisibility(/** @type {any} */ (ctx)) },
  { path: "operator/evidence/:id", methods: ["GET"], auth: "operator", turn: "write", handler: (ctx) => op().evidenceLink(/** @type {any} */ (ctx)) },
];

function op() {
  return require("./operator.js");
}

/** @param {string} pattern */
function compile(pattern) {
  /** @type {string[]} */
  const names = [];
  const src = pattern
    .split("/")
    .map((seg) => {
      if (seg.startsWith(":")) {
        names.push(seg.slice(1));
        return "([A-Za-z0-9_-]{1,64})";
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { re: new RegExp("^" + src + "$"), names };
}

const COMPILED = ROUTES.map((r) => ({ route: r, ...compile(r.path) }));

/**
 * Work out which route a request is for.
 * @param {Req} req
 * @returns {{ path: string, url: URL } | { error: string, status: number }}
 */
function resolvePath(req) {
  let url;
  try {
    url = new URL(req.url || "/", "http://localhost");
  } catch (err) {
    return { error: "invalid_path", status: 400 };
  }
  const m = PREFIX.exec(url.pathname);
  let route = m ? m[1].replace(/\/+$/, "") : "";
  if (!route || route === "app") {
    // Reached the function directly (or Vercel handed us the rewritten path):
    // take the route from ?path=, which must be one plain string.
    const q = url.searchParams.getAll("path");
    if (q.length === 0) return { error: "not_found", status: 404 };
    if (q.length !== 1) return { error: "invalid_path", status: 400 };
    route = q[0].replace(/^\/+|\/+$/g, "");
  }
  if (route.length > 200 || !SAFE_ROUTE.test(route)) return { error: "invalid_path", status: 400 };
  return { path: route, url };
}

/**
 * The route for a path (and method: one path can have a route per method).
 * `allowed` lists the path's methods, for a 405's Allow header.
 * @param {string} path
 * @param {string} [method]
 * @returns {{ route: Route, params: Record<string, string>, allowed: string[] } | null}
 */
function match(path, method) {
  /** @type {{ route: Route, params: Record<string, string>, allowed: string[] } | null} */
  let first = null;
  /** @type {string[]} */
  const allowed = [];
  for (const c of COMPILED) {
    const m = c.re.exec(path);
    if (!m) continue;
    /** @type {Record<string, string>} */
    const params = {};
    c.names.forEach((n, i) => {
      params[n] = m[i + 1];
    });
    const hit = { route: c.route, params, allowed };
    if (!first) first = hit;
    allowed.push(...c.route.methods);
    if (method && c.route.methods.includes(method)) return hit;
  }
  return first;
}

/**
 * CORS for v02 routes (the legacy handlers keep their own). Disallowed
 * origins get no CORS headers at all.
 * @param {Req} req
 * @param {Res} res
 */
function applyCors(req, res) {
  const origin = String(req.headers.origin || "");
  const allowed = !!origin && core.allowedOrigins().includes(origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key");
    res.setHeader("Access-Control-Expose-Headers", "Retry-After");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  return allowed;
}

/**
 * Constant-time comparison of two strings.
 * @param {string} a
 * @param {string} b
 */
function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * Apply a route's auth rule; for "project" routes, load the project into ctx.
 * @param {Auth} auth
 * @param {Ctx} ctx
 */
async function authorise(auth, ctx) {
  if (auth === "none") return;
  if (auth === "cron") {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new HttpError(503, "not_configured", "The scheduled job isn't set up yet.");
    if (!safeEqual(String(ctx.req.headers.authorization || ""), "Bearer " + secret)) throw new HttpError(401, "unauthorised", "Not allowed.");
    return;
  }
  if (auth === "project") {
    ctx.project = await require("./auth.js").requireProject(ctx.req, ctx.params.id);
    return;
  }
  if (auth === "operator") {
    ctx.operator = await require("./auth.js").requireOperator(ctx.req);
    return;
  }
  throw new HttpError(500, "server_error", "Unknown auth rule.");
}

/**
 * Answer with an error (an HttpError's own status and message, anything else a 500).
 * @param {Res} res
 * @param {unknown} err
 */
function respondError(res, err) {
  if (err instanceof HttpError) {
    const extra = err.extra || {};
    const headers = extra.retryAfter ? { "Retry-After": String(extra.retryAfter) } : undefined;
    if (!res.headersSent) json(res, err.status, Object.assign({ ok: false, error: err.code, message: err.message }, extra), headers);
    return;
  }
  console.error("[wvroofing] unhandled error", err instanceof Error ? err.message : err);
  if (!res.headersSent) json(res, 500, { ok: false, error: "server_error", message: "Something went wrong." });
}

/**
 * Everything decided without the database: the path, the method, CORS, the Origin
 * rule, JSON for POSTs, and the cron key. Answers the request itself when one of
 * them settles it (or for OPTIONS) and returns null; otherwise the route and its ctx.
 * In snapshot mode this runs before any database turn, so a request that will be
 * refused anyway never takes the lock.
 * @param {Req} req
 * @param {Res} res
 * @param {number} startedAt
 * @returns {{ route: Route, ctx: Ctx } | null}
 */
function precheck(req, res, startedAt) {
  const resolved = resolvePath(req);
  if ("error" in resolved) {
    applyCors(req, res);
    json(res, resolved.status, { ok: false, error: resolved.error });
    return null;
  }
  const m = match(resolved.path, String(req.method));
  if (!m) {
    applyCors(req, res);
    json(res, 404, { ok: false, error: "not_found" });
    return null;
  }
  const route = m.route;
  const allowed = applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = allowed ? 204 : 403;
    res.end();
    return null;
  }
  if (!route.methods.includes(String(req.method))) {
    json(res, 405, { ok: false, error: "method_not_allowed" }, { Allow: [...new Set(m.allowed.concat(["OPTIONS"]))].join(", ") });
    return null;
  }
  // Origin rule: a disallowed Origin is always refused. Browsers send no Origin on
  // same-origin GETs, so a missing one is accepted for GET/HEAD (no side effects,
  // and project routes still need the bearer token) but never for POST.
  const hasOrigin = !!req.headers.origin;
  const safeMethod = req.method === "GET" || req.method === "HEAD";
  if (route.origin !== "any" && (hasOrigin ? !allowed : !safeMethod)) {
    json(res, 403, { ok: false, error: "origin", message: "Requests from this site aren't allowed." });
    return null;
  }
  // JSON only: a cross-site HTML form can't send it without a CORS preflight, which only our origins pass.
  if (req.method === "POST" && !/^application\/json\b/i.test(String(req.headers["content-type"] || ""))) {
    json(res, 415, { ok: false, error: "invalid_content_type", message: "Send JSON." });
    return null;
  }
  /** @type {Ctx} */
  const ctx = { req, res, params: m.params, url: resolved.url, startedAt };
  return { route, ctx };
}

/**
 * The cron key needs no database, so it is checked before any turn, when there is
 * one. In snapshot mode CRON_SECRET is unset: Vercel's daily call then still gets
 * a (read) turn, so the tidy-up that runs inside requests (db.js maybeDaily)
 * happens on schedule even when nobody visits.
 * @param {{ route: Route, ctx: Ctx }} pre
 */
async function precheckCron(pre) {
  if (pre.route.auth === "cron" && process.env.CRON_SECRET) await authorise("cron", pre.ctx);
}

// Snapshot mode: requests that may write take the one lock all instances share, so
// each visitor (keyed by IP, in this instance's memory) gets a fair share of them.
const WRITE_WINDOW_MS = 60 * 1000;
/** @type {Map<string, { start: number, count: number }>} */
const writeCounts = new Map();

/** @param {Req} req @returns {number} seconds to wait, or 0 */
function writeAllowance(req) {
  const max = Number(process.env.WVR_WRITES_PER_IP_MINUTE) || 60;
  const ip = core.clientIp(req) || "unknown";
  const now = Date.now();
  if (writeCounts.size > 5000) for (const [k, v] of writeCounts) if (now - v.start > WRITE_WINDOW_MS) writeCounts.delete(k);
  const c = writeCounts.get(ip);
  if (!c || now - c.start > WRITE_WINDOW_MS) {
    writeCounts.set(ip, { start: now, count: 1 });
    return 0;
  }
  c.count++;
  return c.count > max ? Math.max(1, Math.ceil((c.start + WRITE_WINDOW_MS - now) / 1000)) : 0;
}

/**
 * The function entry point. In snapshot mode (db.js) the request's database work
 * is one turn (a read turn for a GET, unless its route says otherwise), and the
 * reply is held back until any change it made is saved, so "saved" is never said
 * about something that wasn't. Requests refused without the database never take a turn.
 * @param {Req} req
 * @param {Res} res
 */
async function handle(req, res) {
  const db = require("./db.js");
  if (!db.snapshotMode(process.env)) return route(req, res);
  const startedAt = Date.now();
  /** @type {{ route: Route, ctx: Ctx } | null} */
  let pre = null;
  try {
    pre = precheck(req, res, startedAt);
    if (pre) await precheckCron(pre);
  } catch (err) {
    return respondError(res, err);
  }
  if (!pre) return;
  const checked = pre;
  const method = String(req.method || "GET").toUpperCase();
  // Vercel's daily call without CRON_SECRET: answered in a read turn, after which db.session runs the tidy-up.
  const cronWithoutKey = checked.route.auth === "cron" && !process.env.CRON_SECRET;
  // With the key (checked above) the cron job itself runs, and its deletions must be saved: a write turn.
  const write = checked.route.turn === "write" || (checked.route.auth === "cron" && !cronWithoutKey) || (method !== "GET" && method !== "HEAD");
  if (write) {
    const wait = writeAllowance(req);
    if (wait) return json(res, 429, { ok: false, error: "rate_limited", message: "That's a lot of requests at once. Please wait a moment." }, { "Retry-After": String(wait) });
  }
  const realEnd = res.end.bind(res);
  const pending = { args: /** @type {any[] | null} */ (null), done: false };
  // @ts-ignore: hold the reply (status and headers are already set on res) until the save is done
  res.end = (/** @type {any[]} */ ...args) => {
    // @ts-ignore: passed on exactly as given
    if (pending.done) return realEnd(...args);
    pending.args = args;
    return res;
  };
  try {
    await db.session(
      async () => {
        if (cronWithoutKey) {
          json(res, 200, { ok: true, skipped: "snapshot_mode", message: "The daily tidy-up runs inside requests in snapshot mode." });
          return;
        }
        try {
          await authorise(checked.route.auth, checked.ctx);
          await checked.route.handler(checked.ctx);
        } catch (err) {
          respondError(res, err);
        }
      },
      { write }
    );
  } catch (err) {
    pending.done = true;
    // The turn couldn't be had, or the save failed: whatever the handler wrote is replaced by a 503.
    res.end = realEnd;
    pending.args = null;
    if (res.headersSent) return;
    for (const h of ["content-type", "content-length", "content-disposition", "cache-control"]) {
      if (typeof res.removeHeader === "function") res.removeHeader(h);
    }
    // Set again, so the pages (on another origin) can read the reason and Retry-After.
    applyCors(req, res);
    const e = err instanceof HttpError ? err : new HttpError(503, "busy", "WV Roofing is busy for a moment. Please try again.");
    const retry = e.extra && e.extra.retryAfter ? { "Retry-After": String(e.extra.retryAfter) } : undefined;
    return json(res, e.status, { ok: false, error: e.code, message: e.message }, retry);
  }
  pending.done = true;
  res.end = realEnd;
  if (pending.args) realEnd(...pending.args);
}

/**
 * One request, routed (every mode but snapshot, where handle() runs the same steps around a turn).
 * @param {Req} req
 * @param {Res} res
 */
async function route(req, res) {
  try {
    const pre = precheck(req, res, Date.now());
    if (!pre) return;
    await authorise(pre.route.auth, pre.ctx);
    await pre.route.handler(pre.ctx);
  } catch (err) {
    respondError(res, err);
  }
}

module.exports = { handle, resolvePath, match, ROUTES };
