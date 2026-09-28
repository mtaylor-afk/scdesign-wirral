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
  // Photo-real renders (A3): durable jobs, polled by the customer.
  { path: "projects/:id/renders", methods: ["POST"], auth: "project", handler: (ctx) => require("./renders.js").submit(/** @type {any} */ (ctx)) },
  { path: "projects/:id/renders", methods: ["GET"], auth: "project", handler: (ctx) => require("./renders.js").list(/** @type {any} */ (ctx)) },
  { path: "projects/:id/renders/:jobId/image", methods: ["GET"], auth: "project", handler: (ctx) => require("./renders.js").image(/** @type {any} */ (ctx)) },
  { path: "projects/:id/renders/:jobId/cancel", methods: ["POST"], auth: "project", handler: (ctx) => require("./renders.js").cancel(/** @type {any} */ (ctx)) },
  // The property (A5): address lookup and choice, the aerial view, the customer's confirmation.
  { path: "projects/:id/address/lookup", methods: ["POST"], auth: "project", handler: (ctx) => require("./property.js").lookup(/** @type {any} */ (ctx)) },
  { path: "projects/:id/address", methods: ["POST"], auth: "project", handler: (ctx) => require("./property.js").choose(/** @type {any} */ (ctx)) },
  { path: "projects/:id/address", methods: ["DELETE"], auth: "project", handler: (ctx) => require("./property.js").clear(/** @type {any} */ (ctx)) },
  { path: "projects/:id/property/view", methods: ["GET"], auth: "project", handler: (ctx) => require("./property.js").view(/** @type {any} */ (ctx)) },
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
  // The operator screen (A6). Every route but login needs the operator's session key.
  { path: "operator/login", methods: ["POST"], auth: "none", handler: (ctx) => op().login(ctx) },
  { path: "operator/logout", methods: ["POST"], auth: "operator", handler: (ctx) => op().logout(/** @type {any} */ (ctx)) },
  { path: "operator/session", methods: ["GET"], auth: "operator", handler: (ctx) => op().session(/** @type {any} */ (ctx)) },
  { path: "operator/enquiries", methods: ["GET"], auth: "operator", handler: (ctx) => op().listEnquiries(/** @type {any} */ (ctx)) },
  { path: "operator/enquiries/:id", methods: ["GET"], auth: "operator", handler: (ctx) => op().enquiryDetail(/** @type {any} */ (ctx)) },
  { path: "operator/enquiries/:id/aerial", methods: ["GET"], auth: "operator", handler: (ctx) => op().enquiryAerial(/** @type {any} */ (ctx)) },
  { path: "operator/enquiries/:id/scope", methods: ["POST"], auth: "operator", handler: (ctx) => op().scope(/** @type {any} */ (ctx)) },
  { path: "operator/enquiries/:id/status", methods: ["POST"], auth: "operator", handler: (ctx) => op().setStatus(/** @type {any} */ (ctx)) },
  { path: "operator/enquiries/:id/request-survey", methods: ["POST"], auth: "operator", handler: (ctx) => op().requestSurvey(/** @type {any} */ (ctx)) },
  { path: "operator/enquiries/:id/resend", methods: ["POST"], auth: "operator", handler: (ctx) => op().resend(/** @type {any} */ (ctx)) },
  { path: "operator/enquiries/:id/delete", methods: ["POST"], auth: "operator", handler: (ctx) => op().deleteEnquiry(/** @type {any} */ (ctx)) },
  { path: "operator/projects/:id/photo", methods: ["GET"], auth: "operator", handler: (ctx) => op().projectPhoto(/** @type {any} */ (ctx)) },
  { path: "operator/projects/:id/original", methods: ["GET"], auth: "operator", handler: (ctx) => op().projectOriginal(/** @type {any} */ (ctx)) },
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
  { path: "operator/evidence/:id", methods: ["GET"], auth: "operator", handler: (ctx) => op().evidenceLink(/** @type {any} */ (ctx)) },
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
 * The function entry point.
 * @param {Req} req
 * @param {Res} res
 */
async function handle(req, res) {
  const startedAt = Date.now();
  try {
    const resolved = resolvePath(req);
    if ("error" in resolved) {
      applyCors(req, res);
      return json(res, resolved.status, { ok: false, error: resolved.error });
    }
    const m = match(resolved.path, String(req.method));
    if (!m) {
      applyCors(req, res);
      return json(res, 404, { ok: false, error: "not_found" });
    }
    const route = m.route;
    const allowed = applyCors(req, res);
    const methods = route.methods;
    if (req.method === "OPTIONS") {
      res.statusCode = allowed ? 204 : 403;
      res.end();
      return;
    }
    if (!methods.includes(String(req.method))) {
      return json(res, 405, { ok: false, error: "method_not_allowed" }, { Allow: [...new Set(m.allowed.concat(["OPTIONS"]))].join(", ") });
    }
    // Origin rule: a disallowed Origin is always refused. Browsers send no Origin on
    // same-origin GETs, so a missing one is accepted for GET/HEAD (no side effects,
    // and project routes still need the bearer token) but never for POST.
    const hasOrigin = !!req.headers.origin;
    const safeMethod = req.method === "GET" || req.method === "HEAD";
    if (route.origin !== "any" && (hasOrigin ? !allowed : !safeMethod)) {
      return json(res, 403, { ok: false, error: "origin", message: "Requests from this site aren't allowed." });
    }
    // JSON only: a cross-site HTML form can't send it without a CORS preflight, which only our origins pass.
    if (req.method === "POST" && !/^application\/json\b/i.test(String(req.headers["content-type"] || ""))) {
      return json(res, 415, { ok: false, error: "invalid_content_type", message: "Send JSON." });
    }
    /** @type {Ctx} */
    const ctx = { req, res, params: m.params, url: resolved.url, startedAt };
    await authorise(route.auth, ctx);
    await route.handler(ctx);
  } catch (err) {
    if (err instanceof HttpError) {
      const extra = err.extra || {};
      const headers = extra.retryAfter ? { "Retry-After": String(extra.retryAfter) } : undefined;
      if (!res.headersSent) return json(res, err.status, Object.assign({ ok: false, error: err.code, message: err.message }, extra), headers);
      return;
    }
    console.error("[wvroofing] unhandled error", err instanceof Error ? err.message : err);
    if (!res.headersSent) return json(res, 500, { ok: false, error: "server_error", message: "Something went wrong." });
  }
}

module.exports = { handle, resolvePath, match, ROUTES };
