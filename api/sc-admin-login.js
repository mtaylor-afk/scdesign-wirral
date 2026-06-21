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
} = require("./_lib/common");

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
  if (rateLimited(ip)) {
    res.statusCode = 429;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Too many attempts. Try again later." }));
  }

  const secret = process.env.SC_ADMIN_SESSION_SECRET || "";
  const user = process.env.SC_ADMIN_USER || "";
  const pass = process.env.SC_ADMIN_PASS || "";

  res.setHeader("Content-Type", "application/json");

  if (!secret || !user || !pass) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "Server not configured." }));
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    body = {};
  }

  const okUser = safeEqual(body.username || "", user);
  const okPass = safeEqual(body.password || "", pass);

  if (!okUser || !okPass) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: "Incorrect username or password." }));
  }

  const token = createSession(secret, SESSION_TTL);
  res.setHeader("Set-Cookie", sessionCookie(token, SESSION_TTL));
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true }));
};
