// WV Roofing — GET /api/wvroofing/cron/daily (Vercel cron, once a day on Hobby).
//
// Vercel's cron delivery is best-effort: a run can be missed or arrive twice.
// So this is idempotent (every step is "tidy whatever is due") and guarded by
// a lease so two overlapping runs never work at the same time.
// A1: purges expired rate-limit windows. Later increments add the job sweep,
// enquiry delivery retries and retention here.
"use strict";

const core = require("../core.js");
const db = require("../db.js");
const limits = require("../limits.js");

/** @param {import("../router.js").Ctx} ctx */
async function daily(ctx) {
  if (!db.configured(process.env)) return core.json(ctx.res, 200, { ok: true, skipped: "database_not_configured" });
  const out = await db.withLease("cron_daily", 600, async () => {
    const started = new Date().toISOString();
    const detail = { rateLimitRowsPurged: await limits.purge() };
    await db.query("INSERT INTO wvr_retention_runs (kind, started_at, finished_at, detail) VALUES ($1, $2, now(), $3)", ["daily", started, JSON.stringify(detail)]);
    return detail;
  });
  if (!out.held) return core.json(ctx.res, 200, { ok: true, skipped: "already_running" });
  return core.json(ctx.res, 200, { ok: true, ran: true, detail: out.result });
}

module.exports = { daily };
