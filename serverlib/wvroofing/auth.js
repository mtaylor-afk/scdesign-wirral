// WV Roofing — customer project tokens (brief §17: an unguessable path alone is
// not access control).
//
// Each project gets a 256-bit random bearer token when it is created. Only its
// SHA-256 hash is stored; the browser keeps the token in sessionStorage (not
// localStorage: the origin is shared with SC Design, which ships no CSP) and
// sends it as "Authorization: Bearer ...". A wrong, expired or foreign token
// gets the same 404 as a project that doesn't exist, so nothing can be learnt
// by guessing ids.
"use strict";

const crypto = require("crypto");
const db = require("./db.js");
const { HttpError } = require("./core.js");
const { isTest } = require("./capabilities.js");

const PROJECT_TTL_DAYS = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DUMMY_HASH = "0".repeat(64);

/** @param {string} token */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * @param {string} a
 * @param {string} b
 */
function sameHex(a, b) {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

/** @param {import("http").IncomingMessage} req */
function bearer(req) {
  const m = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(String(req.headers.authorization || ""));
  return m ? m[1] : null;
}

/**
 * Rough browser family for the operator (never the full user-agent string).
 * @param {import("http").IncomingMessage} req
 */
function uaFamily(req) {
  const ua = String(req.headers["user-agent"] || "");
  const os = /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "other";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "other";
  return os + "/" + br;
}

/**
 * Create a project and its token.
 * @param {{ ipHash: string | null, uaFamily: string, noticeShown: boolean, consentAi: boolean }} o
 */
async function createProject(o) {
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + PROJECT_TTL_DAYS * 24 * 3600 * 1000);
  await db.query(
    "INSERT INTO wvr_projects (id, token_hash, token_expires_at, expires_at, ip_hash, ua_family, storage_notice_shown_at, consent_ai_at) " +
      "VALUES ($1, $2, $3, $3, $4, $5, CASE WHEN $6 THEN now() END, CASE WHEN $7 THEN now() END)",
    [id, hashToken(token), expires.toISOString(), o.ipHash, o.uaFamily, o.noticeShown, o.consentAi]
  );
  return { id, token, expiresAt: expires.toISOString() };
}

/**
 * The project this request's bearer token opens, or an error.
 * @param {import("http").IncomingMessage} req
 * @param {string} id
 */
async function requireProject(req, id) {
  const token = bearer(req);
  if (!token) throw new HttpError(401, "unauthorised", "This request needs the project's token.");
  // Its own code, so the browser knows to drop its stored key and start a new project.
  const notFound = () => new HttpError(404, "project_not_found", "That project doesn't exist or has expired.");
  if (!UUID_RE.test(id)) throw notFound();
  const { rows } = await db.query("SELECT * FROM wvr_projects WHERE id = $1", [id]);
  const p = rows[0];
  // Compare even when there is no row, so the timing doesn't reveal which ids exist.
  const match = sameHex(p ? p.token_hash : DUMMY_HASH, hashToken(token));
  if (!p || !match || new Date(p.token_expires_at).getTime() <= Date.now()) throw notFound();
  return p;
}

// ---------------------------------------------------------------------------
// The operator (A6): one password, held only as a scrypt hash in
// WVR_OPERATOR_PASSWORD_HASH (made by scripts/wvroofing/operator-hash.mjs on the
// owner's own machine). A login opens a 12-hour session whose key is stored
// hashed and can be revoked; 5 failures from one visitor, or 20 in all, within
// 15 minutes lock logins for a while.

const OPERATOR_TTL_HOURS = 12;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
// The TEST ENVIRONMENT's throwaway operator password (dev server, QA and tests).
// Refused everywhere else, even if a hash of it were ever set in production.
const TEST_OPERATOR_PASSWORD = "wvr-test-operator-only";

/**
 * "scrypt:N:r:p:salt:hash" (base64url) for a password. Colons, not "$", so no
 * .env loader can mistake part of it for a variable.
 * @param {string} password
 * @param {Buffer} [salt]
 */
function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16);
  const key = crypto.scryptSync(String(password), s, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, s.toString("base64url"), key.toString("base64url")].join(":");
}

/**
 * @param {string} password
 * @param {string} stored  from hashPassword
 * @returns {Promise<boolean>}
 */
function verifyPassword(password, stored) {
  const parts = String(stored || "").trim().split(":");
  const [kind, N, r, p, salt, hash] = parts;
  const want = Buffer.from(hash || "", "base64url");
  if (parts.length !== 6 || kind !== "scrypt" || want.length < 32) return Promise.resolve(false);
  return new Promise((resolve) => {
    crypto.scrypt(String(password), Buffer.from(salt, "base64url"), want.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 }, (err, got) => {
      resolve(!err && got.length === want.length && crypto.timingSafeEqual(got, want));
    });
  });
}

/**
 * Which password hash a session was opened under: a new password (a new hash
 * in WVR_OPERATOR_PASSWORD_HASH) ends every session opened with the old one.
 * @param {string | undefined} stored
 */
function hashTag(stored) {
  return crypto.createHash("sha256").update(String(stored || "").trim()).digest("hex").slice(0, 16);
}

/**
 * Check the operator password and open a session.
 * @param {import("http").IncomingMessage} req
 * @param {unknown} password
 */
async function operatorLogin(req, password) {
  const stored = process.env.WVR_OPERATOR_PASSWORD_HASH;
  if (!stored) throw new HttpError(503, "not_configured", "The operator login isn't set up yet.");
  const ip = require("./limits.js").ipHash(req);
  const { rows } = await db.query(
    "SELECT count(*) FILTER (WHERE ip_hash = $1)::int AS mine, count(*)::int AS total FROM wvr_login_attempts WHERE NOT ok AND created_at > now() - interval '15 minutes'",
    [ip]
  );
  if (rows[0].mine >= 5 || rows[0].total >= 20) {
    throw new HttpError(429, "locked", "Too many wrong passwords. Please wait 15 minutes and try again.", { retryAfter: 900 });
  }
  const allowed = typeof password === "string" && password.length <= 200 && (isTest(process.env) || password !== TEST_OPERATOR_PASSWORD);
  const ok = allowed && (await verifyPassword(/** @type {string} */ (password), stored));
  await db.query("INSERT INTO wvr_login_attempts (ip_hash, ok) VALUES ($1, $2)", [ip, ok]);
  if (!ok) throw new HttpError(401, "unauthorised", "That password isn't right.");
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + OPERATOR_TTL_HOURS * 3600 * 1000);
  const id = crypto.randomUUID();
  await db.query("INSERT INTO wvr_operator_sessions (id, token_hash, hash_tag, expires_at, ip_hash, ua_family) VALUES ($1, $2, $3, $4, $5, $6)", [
    id,
    hashToken(token),
    hashTag(stored),
    expires.toISOString(),
    ip,
    uaFamily(req),
  ]);
  return { token, expiresAt: expires.toISOString() };
}

/**
 * The operator session this request's bearer key opens, or 401 (no key, an
 * unknown, revoked or expired one, or one from before the password changed).
 * @param {import("http").IncomingMessage} req
 */
async function requireOperator(req) {
  const token = bearer(req);
  if (!token) throw new HttpError(401, "unauthorised", "Please log in.");
  const { rows } = await db.query("SELECT * FROM wvr_operator_sessions WHERE token_hash = $1", [hashToken(token)]);
  const s = rows[0];
  const stored = process.env.WVR_OPERATOR_PASSWORD_HASH;
  if (!s || s.revoked_at || new Date(s.expires_at).getTime() <= Date.now() || !stored || s.hash_tag !== hashTag(stored)) {
    throw new HttpError(401, "unauthorised", "Your session has ended. Please log in again.");
  }
  return s;
}

/** @param {string} sessionId */
async function operatorLogout(sessionId) {
  await db.query("UPDATE wvr_operator_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL", [sessionId]);
}

/**
 * The daily sweep: sessions that ended and login attempts go after 7 days, the
 * operator's history after 12 months (as enquiries do).
 */
async function purgeOperatorRecords() {
  const s = await db.query("DELETE FROM wvr_operator_sessions WHERE coalesce(revoked_at, expires_at) < now() - interval '7 days'");
  const a = await db.query("DELETE FROM wvr_login_attempts WHERE created_at < now() - interval '7 days'");
  const h = await db.query("DELETE FROM wvr_operator_actions WHERE created_at < now() - interval '12 months'");
  return { operatorSessionsPurged: s.rowCount, loginAttemptsPurged: a.rowCount, operatorActionsPurged: h.rowCount };
}

module.exports = {
  createProject,
  requireProject,
  hashToken,
  uaFamily,
  UUID_RE,
  PROJECT_TTL_DAYS,
  hashPassword,
  verifyPassword,
  operatorLogin,
  requireOperator,
  operatorLogout,
  purgeOperatorRecords,
  OPERATOR_TTL_HOURS,
  TEST_OPERATOR_PASSWORD,
};
