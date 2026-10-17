// WV Roofing — GET /api/wvroofing/cron/daily (Vercel cron, once a day on Hobby).
//
// Vercel's cron delivery is best-effort: a run can be missed or arrive twice.
// So every step is "tidy whatever is due" (idempotent), and a lease stops two
// overlapping runs working at the same time. Every period is in retention.js.
//
//   1. Projects past expires_at (30 days, unless an enquiry extends it to 12
//      months) are deleted: their files first, then the rows (photos, outlines,
//      renders, uploads, address and answers cascade). This is what makes the
//      "kept for 30 days" promise true.
//   2. Uploads presigned but never committed are removed after 24 hours, with
//      their files; records of committed uploads go at the same age. Files whose
//      project no longer exists at all (a lost save) are removed too.
//   3. Rate-limit windows older than 48 hours are purged.
//   4. Enquiries: sends that never reported back become 'uncertain' (not
//      resent), failed emails due a retry are tried again (at most 3 attempts
//      in all), and enquiries older than 12 months are deleted.
//   5. Operator sessions that ended, and login attempts, go after 7 days; the
//      operator's history (who changed what) after 12 months.
//   6. Records that outlive their projects: the paid-call log and the budget
//      ledger after 13 months, this job's own record after 90 days, and leases
//      left by a crashed run.
//   7. Renders: expired leases are settled (queued again, or 'uncertain' if
//      OpenAI was called), jobs queued for over a day are dropped, files of
//      renders that were never shown go after 7 days, and any queue nobody is
//      polling is worked while this run has time for a whole render.
"use strict";

const core = require("../core.js");
const db = require("../db.js");
const limits = require("../limits.js");
const jobs = require("../jobs.js");
const enquiries = require("../enquiries.js");
const retention = require("../retention.js");

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
  const hours = retention.RETENTION.uploadHours;
  const { rows } = await db.query("SELECT id, pathname FROM wvr_uploads WHERE consumed_at IS NULL AND created_at < now() - make_interval(hours => $1) LIMIT $2", [hours, BATCH]);
  if (rows.length) {
    await storage().del(rows.map((r) => r.pathname));
    await db.query("DELETE FROM wvr_uploads WHERE id = ANY($1::uuid[])", [rows.map((r) => r.id)]);
  }
  // A committed upload's file was deleted when it was committed; its record isn't needed after a day either.
  const used = await db.query("DELETE FROM wvr_uploads WHERE consumed_at IS NOT NULL AND consumed_at < now() - make_interval(hours => $1)", [hours]);
  return { staleUploadsRemoved: rows.length, uploadRecordsPurged: used.rowCount };
}

/**
 * Files whose project no longer exists, e.g. the files of a save lost in snapshot
 * mode (2026-10-16): every file lives under projects/<projectId>/, so a folder
 * with no project row is removed. The files are listed first and the rows read
 * after: a project's row always exists before any of its files, so the folder of
 * a project being made at that moment can't be taken for an orphan.
 */
async function sweepOrphanFiles() {
  const { storage } = require("../storage.js");
  const { UUID_RE } = require("../auth.js");
  const st = storage();
  /** @type {Map<string, string[]>} */
  const byProject = new Map();
  for (const f of await st.list("projects/")) {
    const id = f.split("/")[1];
    if (!id || !UUID_RE.test(id)) continue;
    const list = byProject.get(id) || [];
    list.push(f);
    byProject.set(id, list);
  }
  if (!byProject.size) return { orphanFilesDeleted: 0 };
  const { rows } = await db.query("SELECT id::text AS id FROM wvr_projects WHERE id = ANY($1::uuid[])", [[...byProject.keys()]]);
  const known = new Set(rows.map((r) => String(r.id)));
  const doomed = [...byProject]
    .filter(([id]) => !known.has(id))
    .slice(0, BATCH)
    .flatMap(([, list]) => list);
  if (doomed.length) await st.del(doomed);
  return { orphanFilesDeleted: doomed.length };
}

/**
 * The whole tidy-up, once (a lease stops two at the same time).
 * @param {number} startedAt  when the request began (for the render queue's time limit)
 */
function runDaily(startedAt) {
  return db.withLease("cron_daily", 600, async () => {
    const started = new Date().toISOString();
    const detail = Object.assign({}, await expireProjects(), await sweepUploads(), await sweepOrphanFiles(), { rateLimitRowsPurged: await limits.purge() });
    Object.assign(detail, await enquiries.sweep());
    Object.assign(detail, await require("../auth.js").purgeOperatorRecords());
    Object.assign(detail, await retention.purgeRecords());
    Object.assign(detail, await jobs.sweep(jobs.deadlineFrom(startedAt)));
    await db.query("INSERT INTO wvr_retention_runs (kind, started_at, finished_at, detail) VALUES ($1, $2, now(), $3)", ["daily", started, JSON.stringify(detail)]);
    return detail;
  });
}

/** @param {import("../router.js").Ctx} ctx */
async function daily(ctx) {
  if (!db.configured(process.env)) return core.json(ctx.res, 200, { ok: true, skipped: "database_not_configured" });
  const out = await runDaily(ctx.startedAt);
  if (!out.held) return core.json(ctx.res, 200, { ok: true, skipped: "already_running" });
  return core.json(ctx.res, 200, { ok: true, ran: true, detail: out.result });
}

module.exports = { daily, runDaily, expireProjects, sweepUploads, sweepOrphanFiles };
