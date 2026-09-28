// WV Roofing — durable photo-real render jobs (A3; brief §8 and §15, plan D4).
//
//   queued -> running -> succeeded | failed | uncertain
//   queued -> cancelled | superseded (new photo or outline) | failed (stale)
//
// - A POST creates the jobs, reserves their budget and answers 202 at once; the
//   same invocation then works the project's queue in the background
//   (waitUntil). One worker per project at a time (a lease), one render at a time.
// - Customer polls reconcile: an expired lease on a job that never reached
//   OpenAI puts it back in the queue; on one that did, it becomes 'uncertain'
//   (it may have been made and charged) and is never repeated automatically.
//   Queued work with no live worker is picked up again. The daily cron sweeps
//   whatever is left. Pro's per-minute cron would tighten this with no change here.
// - Only an explicit server error from OpenAI is retried, once. A result that
//   arrives after the photo or outline changed is kept but quarantined, never shown.
// - Each job records the photo, outline, product, prompt version, model, quality
//   and size it was made from, and what it cost.
"use strict";

const crypto = require("crypto");
const db = require("./db.js");
const limits = require("./limits.js");
const openai = require("./openai.js");
const compose = require("./compose.js");
const images = require("./images.js");
const { storage } = require("./storage.js");
const { isEnabled } = require("./capabilities.js");
const { PRODUCTS, CATALOGUE } = require("./core.js");

/** vercel.json maxDuration for api/wvroofing/app.js (deploy-shape.test keeps the two equal). */
const FUNCTION_SECONDS = 300;
const WORKER_LEASE_SECONDS = FUNCTION_SECONDS + 15;
const RETRY_DELAY_SECONDS = 15;
const MAX_REQUEUES = 6;
const START_MARGIN_MS = 20000;

/**
 * @typedef {Record<string, any>} Row
 * @typedef {ReturnType<typeof openai.renderConfig>} RenderConfig
 * @typedef {import("./db.js").TxClient} TxClient
 */

/** What the customer is told for each way a render can end without a picture. */
const MESSAGES = /** @type {Record<string, string>} */ ({
  timeout: "This render didn't finish in time. Try again to start a new one.",
  network: "We lost touch with the render service. Try again to start a new one.",
  upstream: "The render service had a problem. Try again to start a new one.",
  busy: "The render service is busy. Please try again in a few minutes.",
  budget: "Photo-real renders have reached today's limit. Your quick previews are still here.",
  not_configured: "Photo-real rendering isn't available right now.",
  refused: "The render service couldn't use this photo. Please try a different photo.",
  misaligned: "This render didn't line up with your photo, so it wasn't used. Try again to start a new one.",
  stale: "This render waited too long and was cancelled. Try again to start a new one.",
  consent_withdrawn: "Cancelled because photo-real renders were switched off.",
  cancelled: "Cancelled.",
  server_error: "Something went wrong making this render. Try again to start a new one.",
});

// ---------------------------------------------------------------------------
// background work

/** @type {Set<Promise<unknown>>} */
const pending = new Set();

/**
 * Run fn after the response has gone: Vercel's waitUntil keeps the invocation
 * alive for it. Tracked here too, so tests (and the dev server) can drain().
 * @param {() => Promise<unknown>} fn
 */
function background(fn) {
  const p = Promise.resolve()
    .then(fn)
    .catch((err) => console.error("[wvroofing] background render work failed", err instanceof Error ? err.message : err));
  pending.add(p);
  p.finally(() => pending.delete(p));
  try {
    require("@vercel/functions").waitUntil(p);
  } catch (err) {
    // not on Vercel: the promise simply runs on
  }
  return p;
}

/** Tests: wait until every piece of background work has finished. */
async function drain() {
  while (pending.size) await Promise.all([...pending]);
}

/**
 * When this invocation will be stopped (ms since epoch).
 * @param {number} startedAt
 */
function deadlineFrom(startedAt) {
  try {
    const d = require("@vercel/functions").getDeadline();
    if (d) return d.getTime();
  } catch (err) {
    // not on Vercel
  }
  return startedAt + FUNCTION_SECONDS * 1000;
}

// ---------------------------------------------------------------------------
// customer view

/** @param {unknown} v */
function iso(v) {
  return v ? new Date(/** @type {any} */ (v)).toISOString() : null;
}

/**
 * A job as the customer sees it (no paths, costs or provider details).
 * @param {Row} r
 */
function out(r) {
  const waiting = r.status === "queued" && r.run_after && new Date(r.run_after).getTime() > Date.now();
  const code = r.error_code === "project_deleted" ? "cancelled" : r.error_code;
  const qa = typeof r.qa === "string" ? JSON.parse(r.qa) : r.qa;
  const image = r.status === "succeeded" && !r.quarantined && !!r.composite_path;
  return {
    id: r.id,
    visualId: r.visual_id,
    status: r.status,
    image,
    // how well the render's edges met the photo (mean luma difference round the roof; lower is better)
    seam: image && qa && Number.isFinite(Number(qa.seam)) ? Number(qa.seam) : null,
    error: r.status === "failed" || r.status === "uncertain" || r.status === "cancelled" ? { code: code || r.status, message: MESSAGES[code] || MESSAGES.server_error } : null,
    waitingUntil: waiting ? iso(r.run_after) : null,
    createdAt: iso(r.created_at),
    startedAt: iso(r.started_at),
    finishedAt: iso(r.finished_at),
  };
}

/**
 * The project's renders for its current photo and outline, oldest first.
 * @param {Row} p  the project row
 */
async function list(p) {
  if (!p.photo_id || !p.mask_id) return [];
  const { rows } = await db.query(
    "SELECT * FROM wvr_jobs WHERE project_id = $1 AND photo_id = $2 AND mask_id = $3 AND status <> 'superseded' AND NOT quarantined ORDER BY created_at",
    [p.id, p.photo_id, p.mask_id]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// creating jobs

/**
 * Jobs that already answer these requests: the same idempotency key, or a
 * queued, running or finished render of the same finish for the same photo and
 * outline (a repeat tap never pays twice).
 * @param {{ query: import("./db.js").QueryFn }} q
 * @param {Row} p
 * @param {string} visualId
 * @param {string} key
 */
async function existingFor(q, p, visualId, key) {
  const { rows } = await q.query(
    "SELECT * FROM wvr_jobs WHERE project_id = $1 AND (idempotency_key = $2 OR (photo_id = $3 AND mask_id = $4 AND visual_id = $5 AND status IN ('queued', 'running', 'succeeded') AND NOT quarantined)) " +
      "ORDER BY (idempotency_key = $2) DESC, created_at DESC LIMIT 1",
    [p.id, key, p.photo_id, p.mask_id, visualId]
  );
  return rows[0] || null;
}

/** @param {string} clientKey @param {Row} p @param {string} visualId */
function jobKey(clientKey, p, visualId) {
  return clientKey + ":" + p.mask_id + ":" + visualId;
}

/**
 * Which of these finishes would need a new job.
 * @param {Row} p
 * @param {string[]} visualIds
 * @param {string} clientKey
 */
async function fresh(p, visualIds, clientKey) {
  /** @type {string[]} */
  const outIds = [];
  for (const v of visualIds) if (!(await existingFor(db, p, v, jobKey(clientKey, p, v)))) outIds.push(v);
  return outIds;
}

/**
 * Create the jobs (or return the ones that already exist), reserving each new
 * job's budget, in one transaction that holds the project row.
 * @param {Row} p
 * @param {string[]} visualIds
 * @param {string} clientKey
 * @param {RenderConfig} cfg
 * @param {{ W: number, H: number, mode: string, rect?: object }} spec
 * @returns {Promise<{ rows: Row[], created: number }>}
 */
async function create(p, visualIds, clientKey, cfg, spec) {
  const { HttpError } = require("./core.js");
  return db.tx(async (t) => {
    // Hold the project, and make sure the photo and outline are still the ones this request saw.
    const lock = await t.query("SELECT photo_id, mask_id FROM wvr_projects WHERE id = $1 FOR UPDATE", [p.id]);
    const now = lock.rows[0];
    if (!now || now.photo_id !== p.photo_id || now.mask_id !== p.mask_id) {
      throw new HttpError(409, "superseded", "Your photo or roof outline changed just now. Please try again.");
    }
    const open = await t.query("SELECT count(*)::int AS n FROM wvr_jobs WHERE project_id = $1 AND status IN ('queued', 'running')", [p.id]);
    let openCount = Number(open.rows[0].n);
    /** @type {Row[]} */
    const rows = [];
    let created = 0;
    for (const v of visualIds) {
      const key = jobKey(clientKey, p, v);
      const have = await existingFor(t, p, v, key);
      if (have) {
        rows.push(have);
        continue;
      }
      if (openCount >= cfg.maxPending) {
        throw new HttpError(429, "rate_limited", "Please wait for the renders already on their way.", { scope: "busy", retryAfter: 20 });
      }
      const usd = openai.estimateCost(cfg.model, cfg.quality, spec.W, spec.H);
      const r = await limits.reserveBudget(t.query, usd, cfg.budgetUsd);
      if (!r.ok) throw new HttpError(503, "budget", MESSAGES.budget);
      const ins = await t.query(
        "INSERT INTO wvr_jobs (id, project_id, photo_id, mask_id, visual_id, catalogue_version, prompt_version, model, quality, size, spec, idempotency_key, budget_day, cost_reserved_usd) " +
          "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::numeric) RETURNING *",
        [
          crypto.randomUUID(),
          p.id,
          p.photo_id,
          p.mask_id,
          v,
          Number(CATALOGUE.version) || 1,
          openai.PROMPT_VERSION,
          cfg.model,
          cfg.quality,
          spec.W + "x" + spec.H,
          JSON.stringify(spec),
          key,
          r.day,
          usd.toFixed(4),
        ]
      );
      rows.push(ins.rows[0]);
      created++;
      openCount++;
    }
    return { rows, created };
  });
}

// ---------------------------------------------------------------------------
// state changes

/**
 * Cancel or supersede a project's queued jobs and release their budget
 * (a new photo or outline, consent withdrawn, the project deleted).
 * @param {TxClient} t
 * @param {string} projectId
 * @param {"superseded" | "cancelled"} status
 * @param {string | null} code
 */
async function closeQueued(t, projectId, status, code) {
  const { rows } = await t.query(
    "UPDATE wvr_jobs SET status = $2, error_code = $3, finished_at = now(), updated_at = now() WHERE project_id = $1 AND status = 'queued' RETURNING budget_day, cost_reserved_usd",
    [projectId, status, code]
  );
  for (const r of rows) await limits.settleBudget(t.query, r.budget_day, Number(r.cost_reserved_usd), 0);
  return rows.length;
}

/**
 * Cancel one queued job.
 * @param {string} projectId
 * @param {string} jobId
 * @returns {Promise<Row | null>} the cancelled job, or null if it wasn't queued
 */
async function cancel(projectId, jobId) {
  return db.tx(async (t) => {
    const { rows } = await t.query(
      "UPDATE wvr_jobs SET status = 'cancelled', error_code = 'cancelled', finished_at = now(), updated_at = now() WHERE id = $1 AND project_id = $2 AND status = 'queued' RETURNING *",
      [jobId, projectId]
    );
    if (!rows[0]) return null;
    await limits.settleBudget(t.query, rows[0].budget_day, Number(rows[0].cost_reserved_usd), 0);
    return rows[0];
  });
}

/**
 * Leases that ran out: never sent to OpenAI -> back in the queue; sent ->
 * 'uncertain' (the reservation stays: it may have been charged). The worker
 * keeps its token, so a result that still arrives can complete the job.
 * @param {string | null} projectId  null = every project (the daily sweep)
 */
async function reconcileExpired(projectId) {
  const scope = projectId ? " AND project_id = $1" : "";
  const params = projectId ? [projectId] : [];
  const back = await db.query(
    "UPDATE wvr_jobs SET status = 'queued', lease_token = NULL, lease_until = NULL, attempt = GREATEST(attempt - 1, 0), updated_at = now() " +
      "WHERE status = 'running' AND lease_until < now() AND called_at IS NULL" +
      scope,
    params
  );
  const lost = await db.query(
    "UPDATE wvr_jobs SET status = 'uncertain', error_code = 'timeout', lease_until = NULL, finished_at = now(), updated_at = now() " +
      "WHERE status = 'running' AND lease_until < now() AND called_at IS NOT NULL" +
      scope,
    params
  );
  return { requeued: back.rowCount, uncertain: lost.rowCount };
}

/**
 * Take the next due job of a project (or null).
 * @param {string} projectId
 * @param {string} token
 * @param {RenderConfig} cfg
 */
async function claim(projectId, token, cfg) {
  const { rows } = await db.query(
    "UPDATE wvr_jobs SET status = 'running', attempt = attempt + 1, lease_token = $2, lease_until = now() + make_interval(secs => $3), " +
      "started_at = COALESCE(started_at, now()), run_after = NULL, updated_at = now() " +
      "WHERE id = (SELECT id FROM wvr_jobs WHERE project_id = $1 AND status = 'queued' AND (run_after IS NULL OR run_after <= now()) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) " +
      "RETURNING *",
    [projectId, token, Math.ceil(cfg.timeoutMs / 1000) + 60]
  );
  return rows[0] || null;
}

/**
 * Put a running job back in the queue for later.
 * @param {Row} job
 * @param {string} token
 * @param {{ seconds: number, notCharged: boolean }} o  notCharged: this attempt doesn't count
 * @returns {Promise<"paused">}
 */
async function requeue(job, token, o) {
  await db.query(
    "UPDATE wvr_jobs SET status = 'queued', run_after = now() + make_interval(secs => $3), lease_token = NULL, lease_until = NULL, called_at = NULL, " +
      "attempt = CASE WHEN $4 THEN GREATEST(attempt - 1, 0) ELSE attempt END, requeues = requeues + 1, updated_at = now() " +
      "WHERE id = $1 AND lease_token = $2 AND status = 'running'",
    [job.id, token, Math.max(1, Math.ceil(o.seconds)), o.notCharged]
  );
  return "paused";
}

/**
 * @typedef {object} Finish
 * @property {"succeeded" | "failed" | "cancelled" | "uncertain" | "superseded"} status
 * @property {string} [code]
 * @property {string} [detail]
 * @property {number} [spent]            settle the reservation as this much spending
 * @property {boolean} [keepReservation] outcome unknown: leave the reservation counted
 * @property {Record<string, any> | null} [usage]
 * @property {string | null} [requestId]
 * @property {string} [rawPath]
 * @property {string} [compositePath]
 * @property {Record<string, any>} [qa]
 */

/**
 * Close a job, but only while this worker still holds it, and settle its
 * budget. A render that finishes after the photo or outline changed is kept
 * quarantined (it was paid for) and never shown.
 * @param {Row} job
 * @param {string} token
 * @param {Finish} o
 * @returns {Promise<{ updated: boolean, status?: string }>}
 */
async function finish(job, token, o) {
  return db.tx(async (t) => {
    const cur = await t.query(
      "SELECT j.status, j.lease_token, j.budget_day, j.cost_reserved_usd, p.photo_id, p.mask_id FROM wvr_jobs j JOIN wvr_projects p ON p.id = j.project_id WHERE j.id = $1 FOR UPDATE OF j",
      [job.id]
    );
    const c = cur.rows[0];
    if (!c || c.lease_token !== token || (c.status !== "running" && c.status !== "uncertain")) return { updated: false };
    let status = o.status;
    let quarantined = false;
    if ((status === "succeeded" || status === "failed") && (c.photo_id !== job.photo_id || c.mask_id !== job.mask_id)) {
      status = "superseded";
      quarantined = true;
    }
    await t.query(
      "UPDATE wvr_jobs SET status = $2, quarantined = $3, error_code = $4, error_detail = $5, usage = $6, request_id = $7, raw_path = $8, composite_path = $9, qa = $10, " +
        "cost_settled_usd = $11::numeric, lease_token = CASE WHEN $2 = 'uncertain' THEN lease_token ELSE NULL END, lease_until = NULL, finished_at = now(), updated_at = now() WHERE id = $1",
      [
        job.id,
        status,
        quarantined,
        o.code || null,
        o.detail ? String(o.detail).slice(0, 500) : null,
        o.usage ? JSON.stringify(o.usage) : null,
        o.requestId || null,
        o.rawPath || null,
        o.compositePath || null, // kept when quarantined, so the 7-day clean-up deletes the file
        o.qa ? JSON.stringify(o.qa) : null,
        o.keepReservation ? null : Number(o.spent || 0).toFixed(4),
      ]
    );
    if (!o.keepReservation) await limits.settleBudget(t.query, c.budget_day, Number(c.cost_reserved_usd), o.spent || 0);
    return { updated: true, status };
  });
}

// ---------------------------------------------------------------------------
// provider circuit breaker: after "no budget" or "key refused", stop calling for a while

async function breaker() {
  const { rows } = await db.query("SELECT holder FROM wvr_leases WHERE name = 'openai_blocked' AND until > now()");
  return rows[0] ? String(rows[0].holder) : null;
}

/** @param {string} code @param {number} seconds */
async function trip(code, seconds) {
  await db.query(
    "INSERT INTO wvr_leases (name, holder, until) VALUES ('openai_blocked', $1, now() + make_interval(secs => $2)) " +
      "ON CONFLICT (name) DO UPDATE SET holder = EXCLUDED.holder, until = EXCLUDED.until",
    [code, seconds]
  );
}

/**
 * @param {Row} job
 * @param {string} status
 * @param {number | null} httpStatus
 * @param {number} t0
 * @param {number | null} cost
 * @param {string | null} requestId
 */
async function logCall(job, status, httpStatus, t0, cost, requestId) {
  try {
    // project_id only while the project exists (it may have been deleted mid-render); the cost is kept either way
    await db.query(
      "INSERT INTO wvr_provider_calls (provider, endpoint, project_id, job_id, model, status, http_status, duration_ms, cost_usd, request_id) " +
        "VALUES ('openai', 'images/edits', (SELECT id FROM wvr_projects WHERE id = $1::uuid), $2, $3, $4, $5, $6, $7::numeric, $8)",
      [job.project_id, job.id, job.model, status, httpStatus, Date.now() - t0, cost == null ? null : cost.toFixed(4), requestId]
    );
  } catch (err) {
    console.error("[wvroofing] provider call log failed", err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// running one job

/** @param {unknown} v */
function toBuffer(v) {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
  if (typeof v === "string" && v.startsWith("\\x")) return Buffer.from(v.slice(2), "hex");
  throw new Error("Unexpected bytea value.");
}

/** @param {unknown} err */
function errText(err) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Everything a job needs before the call: its size, the working copy, the roof
 * mask, the photo and mask for the model, and the product.
 * @param {Row} job
 */
async function prepare(job) {
  const product = PRODUCTS.get(job.visual_id);
  /** @type {import("./compose.js").AiSpec} */
  const spec = typeof job.spec === "string" ? JSON.parse(job.spec) : job.spec;
  const ph = await db.query("SELECT working_path, work_w, work_h FROM wvr_photos WHERE id = $1 AND project_id = $2", [job.photo_id, job.project_id]);
  const mk = await db.query("SELECT png FROM wvr_masks WHERE id = $1 AND project_id = $2", [job.mask_id, job.project_id]);
  /** @type {Row | undefined} */
  const photo = ph.rows[0];
  if (!photo || !mk.rows[0] || !product || !spec) throw new Error("photo, outline or product missing");
  openai.validateParams({ model: job.model, quality: job.quality, W: spec.W, H: spec.H });
  const working = await storage().getBuffer(photo.working_path);
  if (!working) throw new Error("working copy missing from storage");
  const roof = await compose.roofMaskFromPng(toBuffer(mk.rows[0].png), photo.work_w, photo.work_h);
  const inputs = await compose.aiInputs(working, roof, photo.work_w, photo.work_h, spec);
  return { spec, photo, working, roof, inputs, product };
}

/**
 * @param {Row} job
 * @param {string} token
 * @param {RenderConfig} cfg
 * @returns {Promise<"done" | "paused" | "blocked">}
 */
async function runJob(job, token, cfg) {
  const t0 = Date.now();
  // 1. Still wanted, for the photo and outline the project has now?
  const pr = await db.query("SELECT photo_id, mask_id, consent_ai_at FROM wvr_projects WHERE id = $1", [job.project_id]);
  const p = pr.rows[0];
  if (!p) return "done";
  if (p.photo_id !== job.photo_id || p.mask_id !== job.mask_id) {
    await finish(job, token, { status: "superseded" });
    return "done";
  }
  if (!p.consent_ai_at) {
    await finish(job, token, { status: "cancelled", code: "consent_withdrawn" });
    return "done";
  }
  const blocked = !isEnabled("image_generation", process.env) ? "not_configured" : await breaker();
  if (blocked) {
    await finish(job, token, { status: "failed", code: blocked });
    return "blocked";
  }
  // 2. The provider's own rate limit, shared by every instance.
  const window = await limits.hit("upstream_openai", "global", cfg.upstreamIpm, 60);
  if (!window.ok) return requeue(job, token, { seconds: window.retryAfter, notCharged: true });

  // 3. The inputs, from the lossless working copy and the saved outline.
  let prep;
  try {
    prep = await prepare(job);
  } catch (err) {
    await limits.undo("upstream_openai", "global", 60);
    const settings = err instanceof openai.RenderError;
    await finish(job, token, { status: "failed", code: settings ? "not_configured" : "server_error", detail: errText(err) });
    return settings ? "blocked" : "done";
  }
  const { spec, photo, working, roof, inputs, product } = prep;

  // 4. The call. From here on the render may be charged.
  await db.query("UPDATE wvr_jobs SET called_at = now(), updated_at = now() WHERE id = $1 AND lease_token = $2", [job.id, token]);
  /** @type {import("./openai.js").EditResult} */
  let result;
  try {
    result = await openai.adapter(process.env)({
      key: cfg.key,
      model: job.model,
      quality: job.quality,
      prompt: openai.buildPrompt(product),
      image: inputs.image,
      mask: inputs.mask,
      W: spec.W,
      H: spec.H,
      compression: cfg.compression,
      timeoutMs: cfg.timeoutMs,
      product,
    });
  } catch (err) {
    return callFailed(job, token, err, t0);
  }
  const reported = openai.costFromUsage(job.model, result.usage);
  const spent = reported == null ? Number(job.cost_reserved_usd) : reported;
  await logCall(job, "ok", result.httpStatus, t0, spent, result.requestId);

  // 5. Composite through the outline on the lossless working copy, and check the seam.
  const paid = { spent, usage: result.usage, requestId: result.requestId };
  let comp;
  try {
    comp = await compose.composite(working, roof, result.jpeg, spec, photo.work_w, photo.work_h);
  } catch (err) {
    await finish(job, token, Object.assign({ status: /** @type {const} */ ("failed"), code: "server_error", detail: "composite: " + errText(err) }, paid));
    return "done";
  }
  const r3 = (/** @type {number} */ v) => Math.round(v * 1000) / 1000;
  const qa = { dx: comp.adj.dx, dy: comp.adj.dy, gain: comp.adj.gain.map(r3), off: comp.adj.off.map(r3), seam: Math.round(comp.seam * 100) / 100, confidence: r3(comp.confidence), maxSeam: cfg.maxSeam };
  const accepted = comp.seam <= cfg.maxSeam;

  // 6. Store the model's answer (for the operator) and, if accepted, the composite.
  const base = "projects/" + job.project_id + "/renders/" + job.id;
  const rawExt = images.sniff(result.jpeg) === "png" ? "png" : "jpg";
  const rawPath = base + "-raw." + rawExt;
  const compositePath = base + ".jpg";
  /** @type {string[]} */
  const stored = [];
  const st = storage();
  try {
    await st.put(rawPath, result.jpeg, rawExt === "png" ? "image/png" : "image/jpeg");
    stored.push(rawPath);
    if (accepted) {
      await st.put(compositePath, await compose.jpegFromRgba(comp.pixels, photo.work_w, photo.work_h), "image/jpeg");
      stored.push(compositePath);
    }
  } catch (err) {
    await st.del(stored).catch(() => undefined);
    await finish(job, token, Object.assign({ status: /** @type {const} */ ("failed"), code: "server_error", detail: "storage: " + errText(err) }, paid));
    return "done";
  }
  const done = await finish(
    job,
    token,
    Object.assign(accepted ? { status: /** @type {const} */ ("succeeded"), rawPath, compositePath, qa } : { status: /** @type {const} */ ("failed"), code: "misaligned", rawPath, qa }, paid)
  );
  // The project was deleted (or the job taken over) meanwhile: don't leave its files behind.
  if (!done.updated) await st.del(stored).catch(() => undefined);
  return "done";
}

/**
 * Sort out a call that didn't produce a picture.
 * @param {Row} job
 * @param {string} token
 * @param {unknown} err
 * @param {number} t0
 * @returns {Promise<"done" | "paused" | "blocked">}
 */
async function callFailed(job, token, err, t0) {
  const e = err instanceof openai.RenderError ? err : new openai.RenderError("network", errText(err));
  await logCall(job, e.kind, e.httpStatus || null, t0, e.kind === "bad_response" ? Number(job.cost_reserved_usd) : null, e.requestId);
  switch (e.kind) {
    case "timeout":
    case "network":
      // It may have been made and charged: keep the reservation, never repeat it automatically.
      await finish(job, token, { status: "uncertain", code: e.kind, detail: e.message, keepReservation: true, requestId: e.requestId });
      return "done";
    case "upstream_5xx":
      if (job.attempt < job.max_attempts) return requeue(job, token, { seconds: RETRY_DELAY_SECONDS, notCharged: false });
      await finish(job, token, { status: "failed", code: "upstream", detail: e.message, requestId: e.requestId });
      return "done";
    case "rate_limited":
      if (job.requeues < MAX_REQUEUES) return requeue(job, token, { seconds: e.retryAfter || 20, notCharged: true });
      await finish(job, token, { status: "failed", code: "busy", detail: e.message, requestId: e.requestId });
      return "done";
    case "budget":
      await trip("budget", 15 * 60);
      await finish(job, token, { status: "failed", code: "budget", detail: e.message, requestId: e.requestId });
      return "blocked";
    case "not_configured":
      await trip("not_configured", 5 * 60);
      await finish(job, token, { status: "failed", code: "not_configured", detail: e.message, requestId: e.requestId });
      return "blocked";
    case "refused":
      await finish(job, token, { status: "failed", code: "refused", detail: e.message, requestId: e.requestId });
      return "done";
    case "bad_response":
      // It answered "OK" without a picture: assume it was charged.
      await finish(job, token, { status: "failed", code: "upstream", detail: e.message, spent: Number(job.cost_reserved_usd), requestId: e.requestId });
      return "done";
    default:
      await finish(job, token, { status: "failed", code: "upstream", detail: e.message, requestId: e.requestId });
      return "done";
  }
}

// ---------------------------------------------------------------------------
// workers

/**
 * Work through a project's due jobs, one at a time, while there is time left
 * in this invocation for a whole render. One worker per project (a lease).
 * @param {string} projectId
 * @param {number} deadline  ms since epoch
 */
async function work(projectId, deadline) {
  const cfg = openai.renderConfig(process.env);
  const token = crypto.randomBytes(12).toString("hex");
  const held = await db.withLease("render:" + projectId, WORKER_LEASE_SECONDS, async () => {
    let ran = 0;
    for (;;) {
      if (Date.now() + cfg.timeoutMs + START_MARGIN_MS > deadline) break;
      const job = await claim(projectId, token, cfg);
      if (!job) break;
      const outcome = await runJob(job, token, cfg);
      ran++;
      if (outcome !== "done") break;
    }
    return ran;
  });
  return held.held ? held.result : 0;
}

/**
 * Start a background worker for the project if none is running.
 * @param {string} projectId
 * @param {number} startedAt  when this invocation began
 */
function kick(projectId, startedAt) {
  return background(() => work(projectId, deadlineFrom(startedAt)));
}

/**
 * What a customer poll does: settle expired leases, and restart the queue if
 * work is due and nobody is on it.
 * @param {string} projectId
 * @param {number} startedAt
 */
async function reconcile(projectId, startedAt) {
  await reconcileExpired(projectId);
  const due = await db.query("SELECT 1 FROM wvr_jobs WHERE project_id = $1 AND status = 'queued' AND (run_after IS NULL OR run_after <= now()) LIMIT 1", [projectId]);
  if (!due.rows.length) return false;
  const busy = await db.query("SELECT 1 FROM wvr_leases WHERE name = $1 AND until > now()", ["render:" + projectId]);
  if (busy.rows.length) return false;
  kick(projectId, startedAt);
  return true;
}

// ---------------------------------------------------------------------------
// the daily sweep (cron)

/** Jobs queued for over a day are dropped and their budget released. */
async function failStale() {
  return db.tx(async (t) => {
    const { rows } = await t.query(
      "UPDATE wvr_jobs SET status = 'failed', error_code = 'stale', finished_at = now(), updated_at = now() WHERE status = 'queued' AND created_at < now() - interval '24 hours' RETURNING budget_day, cost_reserved_usd"
    );
    for (const r of rows) await limits.settleBudget(t.query, r.budget_day, Number(r.cost_reserved_usd), 0);
    return rows.length;
  });
}

/** Files of renders that were never shown (failed, cancelled, quarantined...) go after 7 days. */
async function purgeUnusedFiles() {
  const { rows } = await db.query(
    "SELECT id, raw_path, composite_path FROM wvr_jobs WHERE (status <> 'succeeded' OR quarantined) AND finished_at < now() - interval '7 days' AND (raw_path IS NOT NULL OR composite_path IS NOT NULL) LIMIT 200"
  );
  if (!rows.length) return 0;
  const files = rows.flatMap((r) => [r.raw_path, r.composite_path].filter(Boolean));
  await storage().del(files);
  await db.query("UPDATE wvr_jobs SET raw_path = NULL, composite_path = NULL, updated_at = now() WHERE id = ANY($1::uuid[])", [rows.map((r) => r.id)]);
  return files.length;
}

/**
 * The cron's share: tidy up, then work any queue nobody is polling.
 * @param {number} deadline
 */
async function sweep(deadline) {
  const cfg = openai.renderConfig(process.env);
  const reconciled = await reconcileExpired(null);
  const staleFailed = await failStale();
  const renderFilesDeleted = await purgeUnusedFiles();
  const { rows } = await db.query("SELECT DISTINCT project_id FROM wvr_jobs WHERE status = 'queued' AND (run_after IS NULL OR run_after <= now()) LIMIT 50");
  let rendersRun = 0;
  for (const r of rows) {
    if (Date.now() + cfg.timeoutMs + START_MARGIN_MS > deadline) break;
    rendersRun += await work(r.project_id, deadline);
  }
  return { rendersRequeued: reconciled.requeued, rendersUncertain: reconciled.uncertain, staleFailed, renderFilesDeleted, rendersRun };
}

module.exports = {
  FUNCTION_SECONDS,
  MESSAGES,
  background,
  drain,
  deadlineFrom,
  out,
  list,
  fresh,
  create,
  closeQueued,
  cancel,
  reconcileExpired,
  reconcile,
  work,
  kick,
  breaker,
  trip,
  sweep,
  toBuffer,
};
