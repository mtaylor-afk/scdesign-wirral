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
 * Count hits in a fixed window.
 * @param {string} scope   what is being limited, e.g. "project_create"
 * @param {string} key     who, e.g. an ipHash or a project id
 * @param {number} max     hits allowed per window
 * @param {number} windowSeconds
 * @param {number} [nowMs]
 * @param {number} [n]     how many hits this is (default 1)
 * @returns {Promise<{ ok: boolean, count: number, retryAfter: number }>}
 */
async function hit(scope, key, max, windowSeconds, nowMs, n) {
  const now = nowMs == null ? Date.now() : nowMs;
  const by = n == null ? 1 : n;
  const span = windowSeconds * 1000;
  const start = Math.floor(now / span) * span;
  const { rows } = await db.query(
    "INSERT INTO wvr_rate_limits (scope, key, window_start, count) VALUES ($1, $2, $3, $4) " +
      "ON CONFLICT (scope, key, window_start) DO UPDATE SET count = wvr_rate_limits.count + EXCLUDED.count RETURNING count",
    [scope, key, new Date(start).toISOString(), by]
  );
  const count = Number(rows[0].count);
  return { ok: count <= max, count, retryAfter: Math.max(1, Math.ceil((start + span - now) / 1000)) };
}

/**
 * Give back hits (e.g. the request failed for a reason that isn't the caller's fault).
 * @param {string} scope
 * @param {string} key
 * @param {number} windowSeconds
 * @param {number} [nowMs]
 * @param {number} [n]  how many (default 1)
 */
async function undo(scope, key, windowSeconds, nowMs, n) {
  const now = nowMs == null ? Date.now() : nowMs;
  const span = windowSeconds * 1000;
  const start = Math.floor(now / span) * span;
  await db.query("UPDATE wvr_rate_limits SET count = GREATEST(count - $4, 0) WHERE scope = $1 AND key = $2 AND window_start = $3", [
    scope,
    key,
    new Date(start).toISOString(),
    n == null ? 1 : n,
  ]);
}

/** Delete windows that ended more than 48 hours ago. @returns {Promise<number>} rows removed */
async function purge() {
  const { rowCount } = await db.query("DELETE FROM wvr_rate_limits WHERE window_start < now() - interval '48 hours'");
  return rowCount;
}

// ---------------------------------------------------------------------------
// Daily budget ledger (UTC days). A render reserves its estimated cost before
// anything is sent to the provider; the reservation is settled from the
// provider's reported usage afterwards. A render whose outcome is unknown keeps
// its reservation (it may have been charged), so the ceiling stays honest.
// Each function takes the query function to use, so it can run inside a
// transaction (tx's t.query) or on its own (db.query).

/** @typedef {import("./db.js").QueryFn} QueryFn */

const TODAY = "(now() AT TIME ZONE 'UTC')::date";

/**
 * Reserve usd against today's ceiling; refused if reserved + spent would pass capUsd.
 * @param {QueryFn} q
 * @param {number} usd
 * @param {number} capUsd
 * @returns {Promise<{ ok: boolean, day: string | null }>}
 */
async function reserveBudget(q, usd, capUsd) {
  const { rows } = await q(
    "INSERT INTO wvr_budget_days (day, reserved_usd) SELECT " +
      TODAY +
      ", $1::numeric WHERE $1::numeric <= $2::numeric " +
      "ON CONFLICT (day) DO UPDATE SET reserved_usd = wvr_budget_days.reserved_usd + EXCLUDED.reserved_usd, updated_at = now() " +
      "WHERE wvr_budget_days.reserved_usd + wvr_budget_days.spent_usd + EXCLUDED.reserved_usd <= $2::numeric " +
      "RETURNING to_char(day, 'YYYY-MM-DD') AS day",
    [usd.toFixed(4), capUsd.toFixed(4)]
  );
  return rows.length ? { ok: true, day: rows[0].day } : { ok: false, day: null };
}

/**
 * Turn a reservation into spending (spentUsd 0 releases it).
 * @param {QueryFn} q
 * @param {string | null} day  the UTC day the reservation was made, 'YYYY-MM-DD'
 * @param {number} reservedUsd
 * @param {number} spentUsd
 */
async function settleBudget(q, day, reservedUsd, spentUsd) {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(String(day))) return;
  await q("UPDATE wvr_budget_days SET reserved_usd = GREATEST(reserved_usd - $2::numeric, 0), spent_usd = spent_usd + $3::numeric, updated_at = now() WHERE day = $1::date", [
    String(day),
    Number(reservedUsd || 0).toFixed(4),
    Number(spentUsd || 0).toFixed(4),
  ]);
}

/** Today's ledger. @returns {Promise<{ reserved: number, spent: number }>} */
async function budgetToday() {
  const { rows } = await db.query("SELECT reserved_usd, spent_usd FROM wvr_budget_days WHERE day = " + TODAY);
  return rows[0] ? { reserved: Number(rows[0].reserved_usd), spent: Number(rows[0].spent_usd) } : { reserved: 0, spent: 0 };
}

module.exports = { ipHash, hit, undo, purge, reserveBudget, settleBudget, budgetToday };
