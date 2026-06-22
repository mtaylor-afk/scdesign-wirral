/**
 * SC Design Wirral — client error ingest.
 *
 * Public endpoint called by the site's error tracker (and the admin portal's
 * error-capture.js). Fire-and-forget, cookieless, no IP stored. Captures as much
 * context as possible for every error — message, stack, source, page, breadcrumbs
 * leading up to it, device/browser/geo — so a broken page or form can be found
 * and fixed before it costs a lead. Bots are flagged (never dropped) so the admin
 * can filter them out. Writes one row to the SC-isolated Supabase `sc_errors`.
 *
 * Unlike the analytics collector this does NOT skip /admin — admin-portal errors
 * are wanted too; each row carries `surface` = "public" | "admin".
 */

const {
  applyCors,
  isAllowedOrigin,
  readJsonBody,
  clientIp,
  getGeo,
  visitorHash,
  parseUA,
  hostOf,
  sanitizeProps,
  sbInsertError,
} = require("../serverlib/common");

function str(v, max) {
  if (v === undefined || v === null) return "";
  const s = String(v);
  return max ? s.slice(0, max) : s;
}

function int(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

const ALLOWED_TYPES = [
  "js_error",
  "resource_error",
  "unhandled_rejection",
  "react_error",
  "form_error",
  "console_error",
];

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }
  // Only accept reports from the live site (basic abuse guard).
  if (!isAllowedOrigin(req)) {
    res.statusCode = 403;
    return res.end("Forbidden");
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    res.statusCode = 400;
    return res.end("Bad Request");
  }

  // Need at least a message or a stack to be worth recording.
  const message = str(body.message, 2000);
  const stack = str(body.stack, 8000);
  if (!message && !stack) {
    res.statusCode = 204; // accept-and-ignore empty beacons
    return res.end();
  }

  let type = str(body.type, 40);
  if (!ALLOWED_TYPES.includes(type)) type = "js_error";
  const severity = body.severity === "warning" ? "warning" : "error";

  const path = str(body.p, 512) || "/";
  const surface =
    str(body.surface, 16) || (path.startsWith("/admin") ? "admin" : "public");

  const ua = str(req.headers["user-agent"], 512);
  const { browser, bv, os, osv, device, isBot } = parseUA(ua);
  const geo = getGeo(req);
  const ip = clientIp(req);
  const vid = visitorHash(ip, ua, "scdesign");

  const referrer = str(body.r, 1024);
  const referrerHost = hostOf(referrer);
  const utm = {
    source: str(body.us, 120),
    medium: str(body.um, 120),
    campaign: str(body.uc, 120),
    term: str(body.ut, 120),
    content: str(body.uo, 120),
  };
  const hasUtm = Object.values(utm).some(Boolean);

  const viewport =
    int(body.vw) && int(body.vh) ? `${int(body.vw)}x${int(body.vh)}` : null;
  const screen =
    int(body.sw) && int(body.sh) ? `${int(body.sw)}x${int(body.sh)}` : null;

  // Free-form rich context (breadcrumbs, connection, per-type extras, …).
  const extra = body.props && typeof body.props === "object" ? sanitizeProps(body.props) : {};

  // Server-derived keys are spread LAST so a client can't forge/override them.
  const props = Object.assign(
    {},
    extra || {},
    hasUtm ? { utm } : {},
    {
      ua: ua || null,
      ref: referrer || null,
      dpr: typeof body.dpr === "number" ? body.dpr : null,
      serverTs: new Date().toISOString(),
    }
  );

  // Defence-in-depth: only store a Page URL that is http(s). This endpoint is
  // public, so a hostile report can't plant a javascript:/data: value the admin
  // error view might otherwise render as a link.
  const reportedUrl = str(body.url, 1024);

  const row = {
    type,
    severity,
    message: message || null,
    source: str(body.source, 1024) || null,
    lineno: int(body.lineno),
    colno: int(body.colno),
    stack: stack || null,
    path,
    url: /^https?:\/\//i.test(reportedUrl) ? reportedUrl : null,
    referrer_host: referrerHost || null,
    vid,
    browser,
    bv: bv || null,
    os,
    osv: osv || null,
    device,
    is_bot: isBot,
    country: geo.country || null,
    region: geo.region || null,
    city: geo.city || null,
    lang: str(body.lang, 35) || null,
    tz: str(body.tz, 60) || geo.tz || null,
    viewport,
    screen,
    surface,
    props,
  };

  try {
    const result = await sbInsertError(row);
    if (!result.ok) {
      console.error("sc-error-collect insert failed", result.status, result.error);
      res.statusCode = 502;
      return res.end();
    }
  } catch (err) {
    console.error("sc-error-collect error", err && err.message);
    res.statusCode = 502;
    return res.end();
  }

  res.statusCode = 204;
  return res.end();
};
