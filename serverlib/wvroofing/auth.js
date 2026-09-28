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

module.exports = { createProject, requireProject, hashToken, uaFamily, UUID_RE, PROJECT_TTL_DAYS };
