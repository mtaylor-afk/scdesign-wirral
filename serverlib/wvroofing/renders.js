// WV Roofing — customer render routes (A3).
//
//   POST projects/:id/renders { visualIds[], idempotencyKey } -> 202 { renders[] }
//   GET  projects/:id/renders                                 -> { renders[] } (and reconciles)
//   GET  projects/:id/renders/:jobId/image                    -> the composite JPEG (bearer only)
//   POST projects/:id/renders/:jobId/cancel                   -> a queued render, cancelled
//
// Renders need the customer's recorded OK to send the photo to OpenAI, a photo
// and a saved roof outline, and the image_generation capability switched on.
"use strict";

const core = require("./core.js");
const limits = require("./limits.js");
const openai = require("./openai.js");
const compose = require("./compose.js");
const jobs = require("./jobs.js");
const db = require("./db.js");
const { storage } = require("./storage.js");
const { capability } = require("./capabilities.js");
const { UUID_RE } = require("./auth.js");

const { HttpError, json, readJson, PRODUCTS } = core;
const DAY = 24 * 3600;

/** @typedef {import("./projects.js").ProjectCtx} ProjectCtx */

/** @param {ReturnType<typeof openai.renderConfig>} cfg */
function requireRendering(cfg) {
  const c = capability("image_generation", process.env);
  if (c.state !== "enabled") {
    const off = c.reason === "kill_switch";
    throw new HttpError(503, off ? "disabled" : "not_configured", off ? "Photo-real rendering is switched off at the moment." : "Photo-real rendering isn't available right now.");
  }
  if (!openai.profile(cfg.model).known) throw new HttpError(503, "not_configured", "Photo-real rendering isn't available right now.");
}

/**
 * Count n new renders against the per-visitor, per-project and daily limits.
 * Returns a function that gives them back.
 * @param {ProjectCtx} ctx
 * @param {number} n
 * @param {ReturnType<typeof openai.renderConfig>} cfg
 */
async function chargeLimits(ctx, n, cfg) {
  const ip = limits.ipHash(ctx.req);
  /** @type {[string, string, number, string][]} */
  const checks = [
    ["render_project", ctx.project.id, cfg.projectDaily, "That's today's limit of photo-real renders for this photo."],
    ["render_global", "all", cfg.dailyCap, "Photo-real renders have reached today's limit. Please try again tomorrow."],
  ];
  if (ip) checks.unshift(["render_ip", ip, cfg.ipDaily, "That's today's limit of photo-real renders for one visitor."]);
  /** @type {[string, string][]} */
  const done = [];
  const giveBack = async (/** @type {number} */ k) => {
    for (const [scope, key] of done) await limits.undo(scope, key, DAY, undefined, k);
  };
  for (const [scope, key, max, message] of checks) {
    const r = await limits.hit(scope, key, max, DAY, undefined, n);
    done.push([scope, key]);
    if (!r.ok) {
      await giveBack(n);
      throw new HttpError(429, "rate_limited", message, { retryAfter: r.retryAfter });
    }
  }
  return giveBack;
}

/** @param {ProjectCtx} ctx */
async function submit(ctx) {
  const cfg = openai.renderConfig(process.env);
  requireRendering(cfg);
  const body = await readJson(ctx.req, 8 * 1024);
  const p = ctx.project;
  if (!p.consent_ai_at) throw new HttpError(409, "consent_required", "Photo-real renders need your OK to send your photo to OpenAI.");
  if (!p.photo_id || !p.mask_id) throw new HttpError(409, "conflict", "Mark your roof before asking for photo-real renders.");
  const ids = Array.isArray(body.visualIds) ? body.visualIds.map(String) : [];
  if (!ids.length || ids.length > 8 || new Set(ids).size !== ids.length || !ids.every((v) => PRODUCTS.has(v))) {
    throw new HttpError(400, "invalid_fields", "Choose between one and eight roofs from the range.");
  }
  const key = String(body.idempotencyKey || "");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(key)) throw new HttpError(400, "invalid_fields", "The request key is missing.");
  const blocked = await jobs.breaker();
  if (blocked) throw new HttpError(503, blocked, jobs.MESSAGES[blocked] || jobs.MESSAGES.not_configured);

  const ph = await db.query("SELECT work_w, work_h FROM wvr_photos WHERE id = $1 AND project_id = $2", [p.photo_id, p.id]);
  if (!ph.rows[0]) throw new HttpError(409, "conflict", "Add a photo first.");
  const spec = await compose.aiSpec(ph.rows[0].work_w, ph.rows[0].work_h, openai.profile(cfg.model).flex);
  try {
    openai.validateParams({ model: cfg.model, quality: cfg.quality, W: spec.W, H: spec.H });
  } catch (err) {
    console.error("[wvroofing] render settings rejected", err instanceof Error ? err.message : err);
    throw new HttpError(503, "not_configured", "Photo-real rendering isn't available right now.");
  }

  // Only renders that don't exist yet count against the limits and the budget.
  const todo = await jobs.fresh(p, ids, key);
  const giveBack = todo.length ? await chargeLimits(ctx, todo.length, cfg) : async () => undefined;
  let made;
  try {
    made = await jobs.create(p, ids, key, cfg, spec);
  } catch (err) {
    await giveBack(todo.length);
    throw err;
  }
  if (made.created < todo.length) await giveBack(todo.length - made.created);
  if (made.created) jobs.kick(p.id, ctx.startedAt || Date.now());
  return json(ctx.res, 202, { ok: true, renders: made.rows.map(jobs.out) });
}

/** @param {ProjectCtx} ctx */
async function list(ctx) {
  await jobs.reconcile(ctx.project.id, ctx.startedAt || Date.now());
  const rows = await jobs.list(ctx.project);
  const cfg = openai.renderConfig(process.env);
  return json(ctx.res, 200, { ok: true, renders: rows.map(jobs.out), autoRender: cfg.autoRender });
}

/** @param {ProjectCtx} ctx */
async function jobFor(ctx) {
  const jobId = String(ctx.params.jobId || "");
  if (!UUID_RE.test(jobId)) throw new HttpError(404, "not_found", "That render doesn't exist.");
  const { rows } = await db.query("SELECT * FROM wvr_jobs WHERE id = $1 AND project_id = $2", [jobId, ctx.project.id]);
  if (!rows[0]) throw new HttpError(404, "not_found", "That render doesn't exist.");
  return rows[0];
}

/** @param {ProjectCtx} ctx */
async function image(ctx) {
  const j = await jobFor(ctx);
  if (j.status !== "succeeded" || j.quarantined || !j.composite_path) throw new HttpError(404, "not_found", "That render isn't ready.");
  const jpg = await storage().getBuffer(j.composite_path);
  if (!jpg) throw new HttpError(404, "not_found", "That render couldn't be found.");
  ctx.res.statusCode = 200;
  ctx.res.setHeader("Content-Type", "image/jpeg");
  ctx.res.setHeader("Content-Length", String(jpg.length));
  ctx.res.setHeader("Cache-Control", "private, no-store");
  ctx.res.end(jpg);
}

/** @param {ProjectCtx} ctx */
async function cancel(ctx) {
  const j = await jobFor(ctx);
  const done = await jobs.cancel(ctx.project.id, j.id);
  if (!done) {
    if (j.status === "running") throw new HttpError(409, "conflict", "That render is already being made and will finish shortly.");
    throw new HttpError(409, "conflict", "That render has already finished.");
  }
  return json(ctx.res, 200, { ok: true, render: jobs.out(done) });
}

module.exports = { submit, list, image, cancel };
