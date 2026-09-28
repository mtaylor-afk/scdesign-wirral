// WV Roofing — rate limits shared by every function instance (Postgres-backed).
//
// Keys are HMAC-SHA256(WVR_SESSION_SECRET, utcDay + "|" + ip) cut to 16 hex
// characters: the same visitor maps to the same key for a day, and the raw IP
// address is never stored (an unsalted hash of an IPv4 address is reversible).
"use strict";

const crypto = require("crypto");
const db = require("./db.js");
const { clientIp } = require("./core.js");
const { isTest } = require("./capabilities.js");

/** @param {Record<string, string | undefined>} env */
function secret(env) {
  if (env.WVR_SESSION_SECRET) return env.WVR_SESSION_SECRET;
  if (isTest(env)) return "wvroofing-test-secret";
  return null;
}

/**
 * Keyed daily hash of the caller's IP address, or null when no secret is set.
 * @param {import("http").IncomingMessage} req
 * @param {Date} [now]
 */
function ipHash(req, now) {
  const s = secret(process.env);
  if (!s) return null;
  const day = (now || new Date()).toISOString().slice(0, 10);
  return crypto.createHmac("sha256", s).update(day + "|" + clientIp(req)).digest("hex").slice(0, 16);
}

/**
 * Count one hit in a fixed window.
 * @param {string} scope   what is being limited, e.g. "project_create"
 * @param {string} key     who, e.g. an ipHash or a project id
 * @param {number} max     hits allowed per window
 * @param {number} windowSeconds
 * @param {number} [nowMs]
 * @returns {Promise<{ ok: boolean, count: number, retryAfter: number }>}
 */
async function hit(scope, key, max, windowSeconds, nowMs) {
  const now = nowMs == null ? Date.now() : nowMs;
  const span = windowSeconds * 1000;
  const start = Math.floor(now / span) * span;
  const { rows } = await db.query(
    "INSERT INTO wvr_rate_limits (scope, key, window_start, count) VALUES ($1, $2, $3, 1) " +
      "ON CONFLICT (scope, key, window_start) DO UPDATE SET count = wvr_rate_limits.count + 1 RETURNING count",
    [scope, key, new Date(start).toISOString()]
  );
  const count = Number(rows[0].count);
  return { ok: count <= max, count, retryAfter: Math.max(1, Math.ceil((start + span - now) / 1000)) };
}

/**
 * Give back a hit (e.g. the request failed for a reason that isn't the caller's fault).
 * @param {string} scope
 * @param {string} key
 * @param {number} windowSeconds
 * @param {number} [nowMs]
 */
async function undo(scope, key, windowSeconds, nowMs) {
  const now = nowMs == null ? Date.now() : nowMs;
  const span = windowSeconds * 1000;
  const start = Math.floor(now / span) * span;
  await db.query("UPDATE wvr_rate_limits SET count = GREATEST(count - 1, 0) WHERE scope = $1 AND key = $2 AND window_start = $3", [
    scope,
    key,
    new Date(start).toISOString(),
  ]);
}

/** Delete windows that ended more than 48 hours ago. @returns {Promise<number>} rows removed */
async function purge() {
  const { rowCount } = await db.query("DELETE FROM wvr_rate_limits WHERE window_start < now() - interval '48 hours'");
  return rowCount;
}

module.exports = { ipHash, hit, undo, purge };
