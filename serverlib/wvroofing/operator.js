// WV Roofing — the operator screen's API (A6; brief §14, plan D5).
//
//   POST operator/login { password }                 -> { token, expiresAt }   (lockouts in auth.js)
//   POST operator/logout, GET operator/session
//   GET  operator/enquiries?status=                  -> the list
//   GET  operator/enquiries/:id                      -> everything about one enquiry and its project
//   GET  operator/enquiries/:id/aerial               -> the satellite view of its address
//   POST operator/enquiries/:id/scope | status | request-survey | resend | delete
//   GET  operator/projects/:id/photo | original, POST operator/projects/:id/delete
//   GET  operator/jobs?status=failed|uncertain, GET operator/jobs/:id/image, POST operator/jobs/:id/retry
//
// Every change is written to wvr_operator_actions with the state before and
// after; nothing the customer confirmed is overwritten (a correction is a new row).
"use strict";

const crypto = require("crypto");
const core = require("./core.js");
const db = require("./db.js");
const auth = require("./auth.js");
const jobs = require("./jobs.js");
const enquiries = require("./enquiries.js");
const images = require("./images.js");
const imagery = require("./imagery.js");
const openai = require("./openai.js");
const compose = require("./compose.js");
const property = require("./property.js");
const projects = require("./projects.js");
const { storage } = require("./storage.js");
const { isEnabled, isTest } = require("./capabilities.js");

const { HttpError, json, readJson, clean, PRODUCTS } = core;
const { UUID_RE } = auth;
const STATUSES = ["new", "contacted", "survey_requested", "quoted", "closed", "spam_suspected"];

/**
 * @typedef {import("./router.js").Ctx & { operator: Record<string, any> }} OperatorCtx
 * @typedef {Record<string, any>} Row
 */

/** @param {unknown} v */
function iso(v) {
  return v ? new Date(/** @type {any} */ (v)).toISOString() : null;
}

/** @param {unknown} v */
function parsed(v) {
  return typeof v === "string" ? JSON.parse(v) : v;
}

/**
 * Record what the operator did.
 * @param {{ query: import("./db.js").QueryFn }} q
 * @param {OperatorCtx} ctx
 * @param {string} targetType
 * @param {string} targetId
 * @param {string} action
 * @param {unknown} before
 * @param {unknown} after
 */
async function audit(q, ctx, targetType, targetId, action, before, after) {
  await q.query("INSERT INTO wvr_operator_actions (session_id, target_type, target_id, action, before, after) VALUES ($1, $2, $3, $4, $5, $6)", [
    ctx.operator.id,
    targetType,
    targetId,
    action,
    before == null ? null : JSON.stringify(before),
    after == null ? null : JSON.stringify(after),
  ]);
}

/** @param {OperatorCtx} ctx @param {string} name */
function idParam(ctx, name) {
  const id = String(ctx.params[name] || "");
  if (!UUID_RE.test(id)) throw new HttpError(404, "not_found", "Not found.");
  return id;
}

/** @param {OperatorCtx} ctx */
async function enquiryRow(ctx) {
  const { rows } = await db.query("SELECT * FROM wvr_enquiries WHERE id = $1", [idParam(ctx, "id")]);
  if (!rows[0]) throw new HttpError(404, "not_found", "That enquiry doesn't exist.");
  return rows[0];
}

/** @param {OperatorCtx} ctx */
async function projectRow(ctx) {
  const { rows } = await db.query("SELECT * FROM wvr_projects WHERE id = $1", [idParam(ctx, "id")]);
  if (!rows[0]) throw new HttpError(404, "not_found", "That project doesn't exist.");
  return rows[0];
}

/** Send an image back to the operator's page (never cached). @param {OperatorCtx} ctx @param {Buffer} buf @param {string} type */
function sendImage(ctx, buf, type) {
  ctx.res.statusCode = 200;
  ctx.res.setHeader("Content-Type", type);
  ctx.res.setHeader("Content-Length", String(buf.length));
  ctx.res.setHeader("Cache-Control", "private, no-store");
  ctx.res.end(buf);
}

// ---------------------------------------------------------------------------
// session

/** @param {import("./router.js").Ctx} ctx */
async function login(ctx) {
  const body = await readJson(ctx.req, 4 * 1024);
  const s = await auth.operatorLogin(ctx.req, body.password);
  return json(ctx.res, 200, { ok: true, token: s.token, expiresAt: s.expiresAt });
}

/** @param {OperatorCtx} ctx */
async function logout(ctx) {
  await auth.operatorLogout(ctx.operator.id);
  return json(ctx.res, 200, { ok: true });
}

/** @param {OperatorCtx} ctx */
async function session(ctx) {
  return json(ctx.res, 200, { ok: true, expiresAt: iso(ctx.operator.expires_at), environment: isTest(process.env) ? "test" : "production" });
}

// ---------------------------------------------------------------------------
// enquiries

/** @param {OperatorCtx} ctx */
async function listEnquiries(ctx) {
  const status = String(ctx.url.searchParams.get("status") || "");
  const filter = STATUSES.includes(status) ? status : null;
  const { rows } = await db.query(
    "SELECT e.*, (SELECT count(*)::int FROM wvr_jobs j WHERE j.project_id = e.project_id AND j.status = 'succeeded' AND NOT j.quarantined) AS renders " +
      "FROM wvr_enquiries e WHERE ($1::text IS NULL OR e.status = $1) ORDER BY e.created_at DESC LIMIT 200",
    [filter]
  );
  const list = rows.map((e) => {
    const snap = parsed(e.snapshot) || {};
    const p = e.visual_id && PRODUCTS.get(e.visual_id);
    return {
      id: e.id,
      reference: e.reference,
      createdAt: iso(e.created_at),
      name: e.contact_name,
      postcode: e.postcode || (snap.address && snap.address.postcode) || null,
      address: snap.address ? snap.address.lines.join(", ") : null,
      roof: p ? p.name : e.visual_id === "not-sure" ? "Not sure" : null,
      status: e.status,
      delivery: e.delivery_status,
      source: e.source,
      hasProject: !!e.project_id,
      renders: e.renders,
      checkFirst: !!(snap.property && snap.property.ambiguous),
    };
  });
  return json(ctx.res, 200, { ok: true, enquiries: list });
}

/** Everything the operator needs about one project. @param {Row} p */
async function projectDetail(p) {
  const addresses = await db.query("SELECT * FROM wvr_addresses WHERE project_id = $1 ORDER BY created_at", [p.id]);
  const confirmations = await db.query("SELECT * FROM wvr_property_confirmations WHERE project_id = $1 ORDER BY confirmed_at", [p.id]);
  const photo = p.photo_id ? (await db.query("SELECT id, orig_w, orig_h, work_w, work_h, original_mime, original_bytes, quality, created_at FROM wvr_photos WHERE id = $1", [p.photo_id])).rows[0] : null;
  const mask = p.mask_id ? (await db.query("SELECT id, coverage, created_at FROM wvr_masks WHERE id = $1", [p.mask_id])).rows[0] : null;
  const js = await db.query("SELECT * FROM wvr_jobs WHERE project_id = $1 ORDER BY created_at", [p.id]);
  const costs = await db.query("SELECT provider, currency, count(*)::int AS calls, coalesce(sum(cost), 0)::float AS cost FROM wvr_provider_calls WHERE project_id = $1 GROUP BY provider, currency ORDER BY provider", [p.id]);
  return {
    id: p.id,
    createdAt: iso(p.created_at),
    expiresAt: iso(p.expires_at),
    consentAi: !!p.consent_ai_at,
    addresses: addresses.rows.map((a) => ({
      id: a.id,
      current: a.id === p.address_id,
      provider: a.provider,
      lines: parsed(a.lines),
      postTown: a.post_town,
      postcode: a.postcode,
      uprn: a.uprn,
      udprn: a.udprn,
      lat: a.lat === null ? null : Number(a.lat),
      lng: a.lng === null ? null : Number(a.lng),
      coordSource: a.coord_source,
      dataset: a.dataset,
      createdAt: iso(a.created_at),
      supersededAt: iso(a.superseded_at),
    })),
    confirmations: confirmations.rows.map((c) => ({
      id: c.id,
      current: c.id === p.property_confirmation_id,
      by: c.confirmed_by,
      propertyType: c.property_type,
      pinShown: c.pin_shown,
      pinConfirmed: c.pin_confirmed,
      ambiguous: c.ambiguous,
      reasons: parsed(c.ambiguity_reasons),
      notes: c.notes,
      at: iso(c.confirmed_at),
      supersededAt: iso(c.superseded_at),
    })),
    photo: photo
      ? { id: photo.id, origW: photo.orig_w, origH: photo.orig_h, w: photo.work_w, h: photo.work_h, mime: photo.original_mime, bytes: photo.original_bytes, warnings: (parsed(photo.quality) || {}).warnings || [], at: iso(photo.created_at) }
      : null,
    mask: mask ? { id: mask.id, coverage: Number(mask.coverage), at: iso(mask.created_at) } : null,
    jobs: js.rows.map((j) => ({
      id: j.id,
      visualId: j.visual_id,
      status: j.status,
      quarantined: j.quarantined,
      current: j.photo_id === p.photo_id && j.mask_id === p.mask_id,
      error: j.error_code,
      detail: j.error_detail,
      model: j.model,
      quality: j.quality,
      promptVersion: j.prompt_version,
      attempt: j.attempt,
      reserved: Number(j.cost_reserved_usd),
      settled: j.cost_settled_usd === null ? null : Number(j.cost_settled_usd),
      requestId: j.request_id,
      qa: parsed(j.qa),
      hasComposite: !!j.composite_path,
      hasRaw: !!j.raw_path,
      createdAt: iso(j.created_at),
      finishedAt: iso(j.finished_at),
    })),
    costs: costs.rows,
  };
}

/** @param {OperatorCtx} ctx */
async function enquiryDetail(ctx) {
  const e = await enquiryRow(ctx);
  const p = e.project_id ? (await db.query("SELECT * FROM wvr_projects WHERE id = $1", [e.project_id])).rows[0] : null;
  const project = p ? await projectDetail(p) : null;
  const trail = await db.query(
    "SELECT action, target_type, before, after, created_at FROM wvr_operator_actions " +
      "WHERE (target_type = 'enquiry' AND target_id = $1) OR (target_type = 'project' AND target_id = $2) OR (target_type = 'job' AND target_id IN (SELECT id::text FROM wvr_jobs WHERE project_id::text = $2)) " +
      "ORDER BY created_at, id",
    [e.id, e.project_id || ""]
  );
  return json(ctx.res, 200, {
    ok: true,
    enquiry: {
      id: e.id,
      reference: e.reference,
      createdAt: iso(e.created_at),
      source: e.source,
      name: e.contact_name,
      email: e.contact_email,
      phone: e.contact_phone,
      postcode: e.postcode,
      roof: e.visual_id,
      notes: e.notes,
      includeImages: e.include_images,
      marketing: e.marketing_opt_in,
      lawfulBasis: e.lawful_basis,
      status: e.status,
      surveyRequestedAt: iso(e.survey_requested_at),
      delivery: { status: e.delivery_status, attempts: e.delivery_attempts, deliveredAt: iso(e.delivered_at), error: e.delivery_error },
      snapshot: parsed(e.snapshot),
    },
    project,
    audit: trail.rows.map((a) => ({ action: a.action, target: a.target_type, at: iso(a.created_at), before: parsed(a.before), after: parsed(a.after) })),
  });
}

/** @param {OperatorCtx} ctx */
async function enquiryAerial(ctx) {
  const e = await enquiryRow(ctx);
  const p = e.project_id ? (await db.query("SELECT address_id FROM wvr_projects WHERE id = $1", [e.project_id])).rows[0] : null;
  const a = p && p.address_id ? (await db.query("SELECT lat, lng, coord_source FROM wvr_addresses WHERE id = $1", [p.address_id])).rows[0] : null;
  if (!a) return json(ctx.res, 200, { ok: true, view: { available: false, reason: "no_address" } });
  const t0 = Date.now();
  const located = { lat: a.lat === null ? null : Number(a.lat), lng: a.lng === null ? null : Number(a.lng), coordSource: a.coord_source };
  const v = await imagery.view(located, isEnabled("aerial_display", process.env));
  if (v.available && v.provider === "google_static_maps") await property.logCall(e.project_id, "google_static_maps", "staticmap", "issued_operator", t0, property.MAP_COST_USD, "USD");
  return json(ctx.res, 200, { ok: true, view: v });
}

/** A scope correction: a new confirmation row; the customer's is kept. @param {OperatorCtx} ctx */
async function scope(ctx) {
  const e = await enquiryRow(ctx);
  const body = await readJson(ctx.req, 8 * 1024);
  if (!e.project_id) throw new HttpError(409, "conflict", "This enquiry has no project to correct.");
  const propertyType = String(body.propertyType || "");
  if (!property.PROPERTY_TYPES.includes(propertyType)) throw new HttpError(400, "invalid_fields", "Choose the kind of property.", { fields: ["propertyType"] });
  const notes = clean(body.notes, 1000) || null;
  const out = await db.tx(async (t) => {
    const p = (await t.query("SELECT * FROM wvr_projects WHERE id = $1 FOR UPDATE", [e.project_id])).rows[0];
    const a = p && p.address_id ? (await t.query("SELECT * FROM wvr_addresses WHERE id = $1", [p.address_id])).rows[0] : null;
    if (!p || !a) throw new HttpError(409, "conflict", "This project has no address to correct.");
    const prev = p.property_confirmation_id ? (await t.query("SELECT * FROM wvr_property_confirmations WHERE id = $1", [p.property_confirmation_id])).rows[0] : null;
    // What the customer saw and answered on the aerial view stays as it was; the operator corrects the scope.
    const pinShown = !!(prev && prev.pin_shown);
    const pinConfirmed = !!(prev && prev.pin_confirmed);
    const reasons = property.ambiguityReasons({ coordSource: a.coord_source, pinShown, pinConfirmed, propertyType });
    const id = crypto.randomUUID();
    await t.query("UPDATE wvr_property_confirmations SET superseded_at = now() WHERE project_id = $1 AND superseded_at IS NULL", [p.id]);
    await t.query(
      "INSERT INTO wvr_property_confirmations (id, project_id, address_id, imagery_provider, pin_shown, pin_confirmed, property_type, ambiguous, ambiguity_reasons, notes, confirmed_by) " +
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'operator')",
      [id, p.id, a.id, prev ? prev.imagery_provider : null, pinShown, pinConfirmed, propertyType, reasons.length > 0, JSON.stringify(reasons), notes]
    );
    await t.query("UPDATE wvr_projects SET property_confirmation_id = $2, updated_at = now() WHERE id = $1", [p.id, id]);
    // Release B: any measurement of this property goes back to needs_review here.
    const before = prev ? { id: prev.id, propertyType: prev.property_type, by: prev.confirmed_by, reasons: parsed(prev.ambiguity_reasons), notes: prev.notes } : null;
    const after = { id, propertyType, by: "operator", reasons, notes };
    await audit(t, ctx, "project", p.id, "scope_corrected", before, after);
    return after;
  });
  return json(ctx.res, 200, { ok: true, property: out });
}

/** @param {OperatorCtx} ctx */
async function setStatus(ctx) {
  const e = await enquiryRow(ctx);
  const body = await readJson(ctx.req, 4 * 1024);
  const status = String(body.status || "");
  if (!STATUSES.includes(status)) throw new HttpError(400, "invalid_fields", "Unknown status.", { fields: ["status"] });
  await db.tx(async (t) => {
    await t.query("UPDATE wvr_enquiries SET status = $2, updated_at = now() WHERE id = $1", [e.id, status]);
    await audit(t, ctx, "enquiry", e.id, "status_changed", { status: e.status }, { status });
  });
  return json(ctx.res, 200, { ok: true, status });
}

/** @param {OperatorCtx} ctx */
async function requestSurvey(ctx) {
  const e = await enquiryRow(ctx);
  await db.tx(async (t) => {
    await t.query("UPDATE wvr_enquiries SET status = 'survey_requested', survey_requested_at = now(), updated_at = now() WHERE id = $1", [e.id]);
    await audit(t, ctx, "enquiry", e.id, "survey_requested", { status: e.status }, { status: "survey_requested" });
  });
  return json(ctx.res, 200, { ok: true, status: "survey_requested" });
}

/** Send the roofer's email again (after a failure, or when it may not have gone). @param {OperatorCtx} ctx */
async function resend(ctx) {
  const e = await enquiryRow(ctx);
  const body = await readJson(ctx.req, 4 * 1024);
  if (body.confirm !== true) throw new HttpError(400, "confirm_required", "Confirm that the email should be sent again (it may already have arrived).");
  if (!isEnabled("enquiry_delivery", process.env)) throw new HttpError(503, "not_configured", "Enquiry emails aren't switched on.");
  const outcome = await enquiries.deliver(e.id, { force: true });
  if (!outcome) throw new HttpError(409, "conflict", "This enquiry's email is being sent right now. Check again in a few minutes.");
  await audit(db, ctx, "enquiry", e.id, "email_resent", { delivery: e.delivery_status }, { outcome });
  const { rows } = await db.query("SELECT delivery_status, delivery_error FROM wvr_enquiries WHERE id = $1", [e.id]);
  return json(ctx.res, 200, { ok: true, outcome, delivery: rows[0].delivery_status, error: rows[0].delivery_error });
}

/** Delete an enquiry and, if it has one, its project (photo, outline, renders, address). @param {OperatorCtx} ctx */
async function deleteEnquiry(ctx) {
  const e = await enquiryRow(ctx);
  const files = e.project_id ? (await projects.deleteProject(e.project_id)).files : 0;
  await db.tx(async (t) => {
    await t.query("DELETE FROM wvr_enquiries WHERE id = $1", [e.id]);
    await audit(t, ctx, "enquiry", e.id, "deleted", { reference: e.reference, project: e.project_id, files }, null);
  });
  return json(ctx.res, 200, { ok: true, deleted: true });
}

// ---------------------------------------------------------------------------
// projects and files

/** @param {OperatorCtx} ctx */
async function projectPhoto(ctx) {
  const p = await projectRow(ctx);
  const ph = p.photo_id ? (await db.query("SELECT working_path FROM wvr_photos WHERE id = $1", [p.photo_id])).rows[0] : null;
  const png = ph ? await storage().getBuffer(ph.working_path) : null;
  if (!png) throw new HttpError(404, "not_found", "This project has no photo.");
  return sendImage(ctx, await images.displayJpeg(png), "image/jpeg");
}

/** A five-minute link to download the customer's original file. @param {OperatorCtx} ctx */
async function projectOriginal(ctx) {
  const p = await projectRow(ctx);
  const ph = p.photo_id ? (await db.query("SELECT original_path FROM wvr_photos WHERE id = $1", [p.photo_id])).rows[0] : null;
  if (!ph) throw new HttpError(404, "not_found", "This project has no photo.");
  const url = await storage().presignGet(ph.original_path, 300);
  await audit(db, ctx, "project", p.id, "original_downloaded", null, null);
  return json(ctx.res, 200, { ok: true, url, expiresIn: 300 });
}

/** @param {OperatorCtx} ctx */
async function deleteProjectRoute(ctx) {
  const p = await projectRow(ctx);
  const out = await projects.deleteProject(p.id);
  await audit(db, ctx, "project", p.id, "deleted", { files: out.files }, null);
  return json(ctx.res, 200, { ok: true, deleted: true });
}

// ---------------------------------------------------------------------------
// render jobs

/** @param {OperatorCtx} ctx */
async function listJobs(ctx) {
  const want = String(ctx.url.searchParams.get("status") || "");
  const statuses = want === "failed" || want === "uncertain" ? [want] : ["failed", "uncertain"];
  const { rows } = await db.query(
    "SELECT j.*, e.reference, e.id AS enquiry_id FROM wvr_jobs j LEFT JOIN wvr_enquiries e ON e.project_id = j.project_id " +
      "WHERE j.status = ANY($1::text[]) AND j.created_at > now() - interval '30 days' ORDER BY j.created_at DESC LIMIT 200",
    [statuses]
  );
  return json(ctx.res, 200, {
    ok: true,
    jobs: rows.map((j) => ({
      id: j.id,
      projectId: j.project_id,
      enquiryId: j.enquiry_id,
      reference: j.reference,
      visualId: j.visual_id,
      status: j.status,
      error: j.error_code,
      detail: j.error_detail,
      mayHaveBeenCharged: j.status === "uncertain",
      reserved: Number(j.cost_reserved_usd),
      requestId: j.request_id,
      createdAt: iso(j.created_at),
    })),
  });
}

/** The composite (or, with ?kind=raw, what OpenAI sent back). @param {OperatorCtx} ctx */
async function jobImage(ctx) {
  const { rows } = await db.query("SELECT raw_path, composite_path FROM wvr_jobs WHERE id = $1", [idParam(ctx, "id")]);
  const j = rows[0];
  const path = j && (ctx.url.searchParams.get("kind") === "raw" ? j.raw_path : j.composite_path);
  const buf = path ? await storage().getBuffer(path) : null;
  if (!buf) throw new HttpError(404, "not_found", "That image doesn't exist.");
  return sendImage(ctx, buf, /\.png$/.test(path) ? "image/png" : "image/jpeg");
}

/**
 * Try a failed or uncertain render again, as a new job. An uncertain one may
 * already have been charged, so the operator has to confirm; the customer's OK
 * to send the photo to OpenAI must still stand.
 * @param {OperatorCtx} ctx
 */
async function retryJob(ctx) {
  const id = idParam(ctx, "id");
  const body = await readJson(ctx.req, 4 * 1024);
  const j = (await db.query("SELECT * FROM wvr_jobs WHERE id = $1", [id])).rows[0];
  if (!j) throw new HttpError(404, "not_found", "That render doesn't exist.");
  if (j.status !== "failed" && j.status !== "uncertain") throw new HttpError(409, "conflict", "Only a failed or uncertain render can be tried again.");
  if (body.confirm !== true) {
    throw new HttpError(400, "confirm_required", j.status === "uncertain" ? "This render may already have been charged. Confirm to make a new one." : "Confirm to make a new render.");
  }
  const cfg = openai.renderConfig(process.env);
  if (!isEnabled("image_generation", process.env) || !openai.profile(cfg.model).known) throw new HttpError(503, "not_configured", "Photo-real rendering isn't switched on.");
  const p = (await db.query("SELECT * FROM wvr_projects WHERE id = $1", [j.project_id])).rows[0];
  if (!p || p.photo_id !== j.photo_id || p.mask_id !== j.mask_id) throw new HttpError(409, "superseded", "The photo or roof outline has changed since this render.");
  if (!p.consent_ai_at) throw new HttpError(409, "consent_required", "The customer has withdrawn their OK to send the photo to OpenAI.");
  const blocked = await jobs.breaker();
  if (blocked) throw new HttpError(503, blocked, jobs.MESSAGES[blocked] || jobs.MESSAGES.not_configured);
  const ph = (await db.query("SELECT work_w, work_h FROM wvr_photos WHERE id = $1", [p.photo_id])).rows[0];
  if (!ph) throw new HttpError(409, "conflict", "The photo couldn't be found.");
  const spec = await compose.aiSpec(ph.work_w, ph.work_h, openai.profile(cfg.model).flex);
  openai.validateParams({ model: cfg.model, quality: cfg.quality, W: spec.W, H: spec.H });
  // The same key every time, so a double click makes one new render, not two.
  const made = await jobs.create(p, [j.visual_id], "op-retry-" + j.id, cfg, spec);
  if (made.created) jobs.kick(p.id, ctx.startedAt);
  const fresh = made.rows[0];
  if (made.created) await audit(db, ctx, "job", j.id, "retried", { status: j.status, error: j.error_code }, { newJob: fresh.id });
  return json(ctx.res, 200, { ok: true, job: { id: fresh.id, status: fresh.status }, created: made.created > 0 });
}

module.exports = {
  login,
  logout,
  session,
  listEnquiries,
  enquiryDetail,
  enquiryAerial,
  scope,
  setStatus,
  requestSurvey,
  resend,
  deleteEnquiry,
  projectPhoto,
  projectOriginal,
  deleteProjectRoute,
  listJobs,
  jobImage,
  retryJob,
  STATUSES,
};
