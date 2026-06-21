/**
 * SC Design Wirral — admin login.
 *
 * Compares the posted username/password against the SC_ADMIN_USER / SC_ADMIN_PASS
 * environment variables (never shipped to the browser). On success, issues a
 * signed, HttpOnly, Secure, SameSite=None session cookie (cross-site so the
 * admin page on scdesignwirral.co.uk can authenticate to this vercel.app API).
 *
 * Includes a small in-memory per-IP rate limiter to deter brute-forcing the
 * intentionally short credentials.
 */

const {
  applyCors,
  isAllowedOrigin,
  readJsonBody,
  createSession,
  sessionCookie,
  clientIp,
  getGeo,
  parseUA,
  visitorHash,
  hostOf,
  sbInsertError,
} = require("../serverlib/common");

const crypto = require("node:crypto");

const SESSION_TTL = 12 * 60 * 60; // 12 hours

// Per-instance rate limiting (best-effort; resets on cold start).
const attempts = new Map(); // ip -> { count, first }
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function rateLimited(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Audit log of an admin sign-in attempt (success or failure). Stored in the
 * shared sc_errors table under a dedicated `type` so it shows in the admin
 * "Login attempts" view (and stays out of the error views). Best-effort —
 * never blocks or breaks the login. NEVER stores the password, only the
 * attempted username.
 */
async function logLogin(req, ip, outcome, username, reason) {
  try {
    const ua = String(req.headers["user-agent"] || "").slice(0, 512);
    const { browser, bv, os, osv, device, isBot } = parseUA(ua);
    const geo = getGeo(req);
    const vid = visitorHash(ip, ua, "scdesign");
    const ref = String(req.headers["referer"] || req.headers["referrer"] || "");
    const failed = outcome !== "success";
    const uname = String(username || "").slice(0, 80);
    await sbInsertError({
      type: failed ? "login_failed" : "login_success",
      severity: failed ? "warning" : "info",
      message: failed
        ? `Admin sign-in FAILED (user: ${uname || "—"})${reason ? " — " + reason : ""}`
        : `Admin sign-in succeeded (user: ${uname || "—"})`,
      path: "/admin/",
      url: ref || null,
      referrer_host: hostOf(ref) || null,
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
      surface: "admin",
      props: {
        outcome: failed ? "failed" : "success",
        username: uname,
        reason: reason || null,
        ua: ua || null,
        serverTs: new Date().toISOString(),
      },
    });
  } catch {
    /* audit logging must never block or break a login */
  }
}

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "method" }));
  }
  if (!isAllowedOrigin(req)) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ ok: false, error: "origin" }));
  }

  const ip = clientIp(req);
  res.setHeader("Content-Type", "application/json");

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    body = {};
  }
  const username = body && body.username ? String(body.username) : "";

  if (rateLimited(ip)) {
    await logLogin(req, ip, "failed", username, "rate_limited");
    res.statusCode = 429;
    return res.end(JSON.stringify({ ok: false, error: "Too many attempts. Try again later." }));
  }

  const secret = process.env.SC_ADMIN_SESSION_SECRET || "";
  const user = process.env.SC_ADMIN_USER || "";
  const pass = process.env.SC_ADMIN_PASS || "";

  if (!secret || !user || !pass) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "Server not configured." }));
  }

  const okUser = safeEqual(body.username || "", user);
  const okPass = safeEqual(body.password || "", pass);

  if (!okUser || !okPass) {
    await logLogin(req, ip, "failed", username, "bad_credentials");
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: "Incorrect username or password." }));
  }

  await logLogin(req, ip, "success", username, "");
  const token = createSession(secret, SESSION_TTL);
  res.setHeader("Set-Cookie", sessionCookie(token, SESSION_TTL));
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true }));
};
