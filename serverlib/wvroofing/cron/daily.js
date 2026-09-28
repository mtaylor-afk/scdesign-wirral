// WV Roofing — GET /api/wvroofing/cron/daily (Vercel cron, once a day on Hobby).
//
// Vercel's cron delivery is best-effort: a run can be missed or arrive twice.
// So every step is "tidy whatever is due" (idempotent), and a lease stops two
// overlapping runs working at the same time.
//
//   1. Projects past expires_at (30 days, unless an enquiry extends it) are
//      deleted: their files first, then the rows (photos, outlines, uploads
//      cascade). This is what makes the "kept for 30 days" promise true.
//   2. Uploads presigned but never committed are removed after 24 hours.
//   3. Rate-limit windows older than 48 hours are purged.
"use strict";

const core = require("../core.js");
const db = require("../db.js");
const limits = require("../limits.js");

const BATCH = 200;

async function expireProjects() {
  const { deleteProject } = require("../projects.js");
  const { rows } = await db.query("SELECT id FROM wvr_projects WHERE expires_at < now() ORDER BY expires_at LIMIT $1", [BATCH]);
  let files = 0;
  for (const r of rows) files += (await deleteProject(r.id)).files;
  return { projectsDeleted: rows.length, filesDeleted: files };
}

async function sweepUploads() {
  const { storage } = require("../storage.js");
  const { rows } = await db.query("SELECT id, pathname FROM wvr_uploads WHERE consumed_at IS NULL AND created_at < now() - interval '24 hours' LIMIT $1", [BATCH]);
  if (rows.length) {
    await storage().del(rows.map((r) => r.pathname));
    await db.query("DELETE FROM wvr_uploads WHERE id = ANY($1::uuid[])", [rows.map((r) => r.id)]);
  }
  return { staleUploadsRemoved: rows.length };
}

/** @param {import("../router.js").Ctx} ctx */
async function daily(ctx) {
  if (!db.configured(process.env)) return core.json(ctx.res, 200, { ok: true, skipped: "database_not_configured" });
  const out = await db.withLease("cron_daily", 600, async () => {
    const started = new Date().toISOString();
    const detail = Object.assign({}, await expireProjects(), await sweepUploads(), { rateLimitRowsPurged: await limits.purge() });
    await db.query("INSERT INTO wvr_retention_runs (kind, started_at, finished_at, detail) VALUES ($1, $2, now(), $3)", ["daily", started, JSON.stringify(detail)]);
    return detail;
  });
  if (!out.held) return core.json(ctx.res, 200, { ok: true, skipped: "already_running" });
  return core.json(ctx.res, 200, { ok: true, ran: true, detail: out.result });
}

module.exports = { daily, expireProjects, sweepUploads };
