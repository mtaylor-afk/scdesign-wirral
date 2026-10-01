// WV Roofing — the operator screen's API (A6; brief §14, plan D5).
//
//   POST operator/login { password }                 -> { token, expiresAt }   (lockouts in auth.js)
//   POST operator/logout, GET operator/session
//   GET  operator/enquiries?status=&q=&site=         -> the list (q finds a name, email, phone, postcode, address or reference)
//   GET  operator/enquiries/:id                      -> everything about one enquiry and its project
//   GET  operator/enquiries/:id/aerial               -> the satellite view of its address
//   POST operator/enquiries/:id/scope | status | request-survey | resend | delete
//   GET  operator/projects?site=&enquiry=&page=      -> every customer photo, from both sites (v1 visualiser, v2 Roof Cam)
//   GET  operator/projects/:id                       -> one photo session in full, with or without an enquiry
//   GET  operator/projects/:id/photo[?size=thumb&photo=] | original, POST operator/projects/:id/delete
//   GET  operator/mockups/:id/image                  -> a preview drawn on the customer's device
//   GET  operator/jobs?status=failed|uncertain, GET operator/jobs/:id/image, POST operator/jobs/:id/retry
//   GET  operator/costs                              -> paid calls by month, today's budget, the last daily tidy-up
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
const mockups = require("./mockups.js");
const measurements = require("./measurements.js");
const geometry = require("./measure/geometry.js");
const quantities = require("./quantities.js");
const { PROVIDERS } = require("./permissions.js");
const { storage } = require("./storage.js");
const { isEnabled, isTest } = require("./capabilities.js");

const { HttpError, json, readJson, clean, VISUALS } = core;
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

/**
 * The enquiries, newest first: by status, and/or found by name, email, phone,
 * postcode, address or reference (for a customer asking for their data or for
 * it to be deleted).
 * @param {OperatorCtx} ctx
 */
async function listEnquiries(ctx) {
  const status = String(ctx.url.searchParams.get("status") || "");
  const filter = STATUSES.includes(status) ? status : null;
  const siteParam = ctx.url.searchParams.get("site");
  const site = siteParam === "v1" || siteParam === "v2" ? siteParam : null;
  const q = String(ctx.url.searchParams.get("q") || "")
    .trim()
    .slice(0, 100);
  const like = q.length >= 2 ? "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%" : null;
  const digits = q.replace(/\D/g, "");
  const phone = digits.length >= 4 ? "%" + digits + "%" : null;
  const { rows } = await db.query(
    "SELECT e.*, (SELECT count(*)::int FROM wvr_jobs j WHERE j.project_id = e.project_id AND j.status = 'succeeded' AND NOT j.quarantined) AS renders " +
      "FROM wvr_enquiries e WHERE ($1::text IS NULL OR e.status = $1) " +
      "AND ($2::text IS NULL OR e.reference ILIKE $2 OR e.contact_name ILIKE $2 OR e.contact_email ILIKE $2 OR e.postcode ILIKE $2 OR (e.snapshot -> 'address')::text ILIKE $2 " +
      "OR ($3::text IS NOT NULL AND regexp_replace(coalesce(e.contact_phone, ''), '\\D', '', 'g') LIKE $3)) " +
      "AND ($4::text IS NULL OR (e.source = ANY($5::text[])) = ($4 = 'v2')) " +
      "ORDER BY e.created_at DESC LIMIT 200",
    [filter, like, phone, site, enquiries.V2_SOURCES]
  );
  const list = rows.map((e) => {
    const snap = parsed(e.snapshot) || {};
    const p = e.visual_id && VISUALS.get(e.visual_id);
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
      site: enquiries.siteOf(e.source),
      hasProject: !!e.project_id,
      renders: e.renders,
      checkFirst: !!(snap.property && snap.property.ambiguous),
    };
  });
  return json(ctx.res, 200, { ok: true, enquiries: list });
}

/**
 * Everything the operator needs about one project.
 * @param {Row} p
 * @param {string | null} visualId  the look the enquiry is about (for the quantities)
 */
async function projectDetail(p, visualId) {
  const ms = await db.query("SELECT * FROM wvr_measurements WHERE project_id = $1 ORDER BY created_at DESC", [p.id]);
  const measured = ms.rows.map((r) => measurements.fromRow(r));
  const current = measured.find((m) => !m.superseded_at && !m.rejected_at) || null;
  const ev = await db.query("SELECT * FROM wvr_evidence WHERE project_id = $1 ORDER BY created_at", [p.id]);
  const addresses = await db.query("SELECT * FROM wvr_addresses WHERE project_id = $1 ORDER BY created_at", [p.id]);
  const confirmations = await db.query("SELECT * FROM wvr_property_confirmations WHERE project_id = $1 ORDER BY confirmed_at", [p.id]);
  const photos = (
    await db.query(
      "SELECT id, orig_w, orig_h, work_w, work_h, original_mime, original_bytes, original_is_client_resized, quality, created_at FROM wvr_photos WHERE project_id = $1 ORDER BY created_at DESC, id",
      [p.id]
    )
  ).rows;
  const photo = photos.find((x) => x.id === p.photo_id) || null;
  const mask = p.mask_id ? (await db.query("SELECT id, coverage, created_at FROM wvr_masks WHERE id = $1", [p.mask_id])).rows[0] : null;
  const js = await db.query("SELECT * FROM wvr_jobs WHERE project_id = $1 ORDER BY created_at", [p.id]);
  const costs = await db.query("SELECT provider, currency, count(*)::int AS calls, coalesce(sum(cost), 0)::float AS cost FROM wvr_provider_calls WHERE project_id = $1 GROUP BY provider, currency ORDER BY provider", [p.id]);
  /** @param {Row} x */
  const photoView = (x) => ({
    id: x.id,
    current: x.id === p.photo_id,
    origW: x.orig_w,
    origH: x.orig_h,
    w: x.work_w,
    h: x.work_h,
    mime: x.original_mime,
    bytes: x.original_bytes,
    clientResized: !!x.original_is_client_resized,
    warnings: (parsed(x.quality) || {}).warnings || [],
    at: iso(x.created_at),
  });
  return {
    id: p.id,
    site: p.site || "v1",
    createdAt: iso(p.created_at),
    expiresAt: iso(p.expires_at),
    consentAi: !!p.consent_ai_at,
    // Every photo uploaded in this session, newest first (the current one is marked).
    photos: photos.map(photoView),
    // Previews the customer's device drew and sent with their enquiry.
    mockups: await mockups.forProject(p.id),
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
    photo: photo ? photoView(photo) : null,
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
    measurementEnabled: measurements.enabled(),
    measurements: measured.map(operatorView),
    evidence: ev.rows.map((r) => ({ id: r.id, kind: r.kind, mime: r.mime, bytes: r.bytes, addedAt: iso(r.created_at) })),
    // What the current measurement gives for the enquiry's look, drafts included (labelled).
    quantities: current && visualId && VISUALS.has(visualId) ? quantities.estimateForVisual(measurements.forQuantities(current), visualId, { drafts: true }) : [],
  };
}

/** @param {OperatorCtx} ctx */
async function enquiryDetail(ctx) {
  const e = await enquiryRow(ctx);
  const p = e.project_id ? (await db.query("SELECT * FROM wvr_projects WHERE id = $1", [e.project_id])).rows[0] : null;
  const project = p ? await projectDetail(p, e.visual_id) : null;
  const trail = await db.query(
    "SELECT action, target_type, before, after, created_at FROM wvr_operator_actions " +
      "WHERE (target_type = 'enquiry' AND target_id = $1) OR (target_type = 'project' AND target_id = $2) " +
      "OR (target_type = 'job' AND target_id IN (SELECT id::text FROM wvr_jobs WHERE project_id::text = $2)) " +
      "OR (target_type = 'measurement' AND target_id IN (SELECT id::text FROM wvr_measurements WHERE project_id::text = $2)) " +
      "OR (target_type = 'evidence' AND target_id IN (SELECT id::text FROM wvr_evidence WHERE project_id::text = $2)) " +
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
      site: enquiries.siteOf(e.source),
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
    // The current measurement may not match the corrected scope: back for review, hidden until approved again.
    const measurementBack = await require("./measurements.js").sendBackForReview(t, p.id);
    const before = prev ? { id: prev.id, propertyType: prev.property_type, by: prev.confirmed_by, reasons: parsed(prev.ambiguity_reasons), notes: prev.notes } : null;
    const after = { id, propertyType, by: "operator", reasons, notes, measurementBackForReview: measurementBack };
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

const PAGE = 48;
const THUMB_EDGE = 420;

/**
 * Every customer photo, from both sites, newest first: the project's current
 * photo, with its site, its enquiry (if any) and how many previews it has.
 *   ?site=v1|v2  ?enquiry=with|without  ?page=0,1,...
 * @param {OperatorCtx} ctx
 */
async function listProjects(ctx) {
  const sp = ctx.url.searchParams;
  const site = sp.get("site") === "v1" || sp.get("site") === "v2" ? sp.get("site") : null;
  const withEnquiry = sp.get("enquiry") === "with" || sp.get("enquiry") === "without" ? sp.get("enquiry") : null;
  const page = Math.max(0, Math.min(1000, Math.floor(Number(sp.get("page")) || 0)));
  const where =
    "FROM wvr_projects p JOIN wvr_photos ph ON ph.id = p.photo_id LEFT JOIN wvr_enquiries e ON e.project_id = p.id " +
    "WHERE ($1::text IS NULL OR p.site = $1) AND ($2::text IS NULL OR ($2 = 'with' AND e.id IS NOT NULL) OR ($2 = 'without' AND e.id IS NULL)) ";
  const total = (await db.query("SELECT count(*)::int AS n " + where, [site, withEnquiry])).rows[0].n;
  const { rows } = await db.query(
    "SELECT p.id, p.site, p.created_at, p.expires_at, p.consent_ai_at, p.address_id, " +
      "ph.id AS photo_id, ph.work_w, ph.work_h, ph.orig_w, ph.orig_h, ph.original_bytes, ph.original_is_client_resized, ph.created_at AS photo_at, " +
      "(SELECT count(*)::int FROM wvr_photos x WHERE x.project_id = p.id) AS photo_count, " +
      "(SELECT count(*)::int FROM wvr_mockups m WHERE m.project_id = p.id) AS mockups, " +
      "(SELECT count(*)::int FROM wvr_jobs j WHERE j.project_id = p.id AND j.status = 'succeeded' AND NOT j.quarantined) AS renders, " +
      "e.id AS enquiry_id, e.reference, e.contact_name, e.status AS enquiry_status, " +
      "(SELECT a.postcode FROM wvr_addresses a WHERE a.id = p.address_id) AS postcode " +
      where +
      "ORDER BY ph.created_at DESC, p.id LIMIT $3 OFFSET $4",
    [site, withEnquiry, PAGE, page * PAGE]
  );
  return json(ctx.res, 200, {
    ok: true,
    total,
    page,
    pageSize: PAGE,
    projects: rows.map((r) => ({
      id: r.id,
      site: r.site || "v1",
      createdAt: iso(r.created_at),
      expiresAt: iso(r.expires_at),
      photo: { id: r.photo_id, w: r.work_w, h: r.work_h, origW: r.orig_w, origH: r.orig_h, bytes: r.original_bytes, clientResized: !!r.original_is_client_resized, at: iso(r.photo_at) },
      photos: r.photo_count,
      mockups: r.mockups,
      renders: r.renders,
      consentAi: !!r.consent_ai_at,
      postcode: r.postcode || null,
      enquiry: r.enquiry_id ? { id: r.enquiry_id, reference: r.reference, name: r.contact_name, status: r.enquiry_status } : null,
    })),
  });
}

/** Everything about one customer's photo session, with or without an enquiry. @param {OperatorCtx} ctx */
async function projectView(ctx) {
  const p = await projectRow(ctx);
  const e = (await db.query("SELECT id, reference, contact_name, status, visual_id, created_at FROM wvr_enquiries WHERE project_id = $1", [p.id])).rows[0] || null;
  const project = await projectDetail(p, e ? e.visual_id : null);
  return json(ctx.res, 200, {
    ok: true,
    project,
    enquiry: e ? { id: e.id, reference: e.reference, name: e.contact_name, status: e.status, roof: e.visual_id, createdAt: iso(e.created_at) } : null,
  });
}

/**
 * The project's photo as a JPEG (?size=thumb for a small one; ?photo=<id> for
 * an earlier photo of the same project).
 * @param {OperatorCtx} ctx
 */
async function projectPhoto(ctx) {
  const p = await projectRow(ctx);
  const want = String(ctx.url.searchParams.get("photo") || "");
  const photoId = UUID_RE.test(want) ? want : p.photo_id;
  const ph = photoId ? (await db.query("SELECT working_path FROM wvr_photos WHERE id = $1 AND project_id = $2", [photoId, p.id])).rows[0] : null;
  const png = ph ? await storage().getBuffer(ph.working_path) : null;
  if (!png) throw new HttpError(404, "not_found", "This project has no photo.");
  if (ctx.url.searchParams.get("size") === "thumb") {
    const thumb = await images.sharp()(png).resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: false }).toBuffer();
    return sendImage(ctx, thumb, "image/jpeg");
  }
  return sendImage(ctx, await images.displayJpeg(png), "image/jpeg");
}

/** A preview the customer's device drew. @param {OperatorCtx} ctx */
async function mockupImage(ctx) {
  const { rows } = await db.query("SELECT pathname FROM wvr_mockups WHERE id = $1", [idParam(ctx, "id")]);
  const buf = rows[0] ? await storage().getBuffer(rows[0].pathname) : null;
  if (!buf) throw new HttpError(404, "not_found", "That preview doesn't exist.");
  return sendImage(ctx, buf, "image/jpeg");
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

// ---------------------------------------------------------------------------
// costs and housekeeping

/**
 * What the outside services have cost (as recorded at each call), today's
 * render budget, recent activity and the last daily tidy-up.
 * @param {OperatorCtx} ctx
 */
async function costs(ctx) {
  const cfg = openai.renderConfig(process.env);
  const today = await require("./limits.js").budgetToday();
  const byMonth = await db.query(
    "SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month, provider, currency, count(*)::int AS calls, coalesce(sum(cost), 0)::float AS cost " +
      "FROM wvr_provider_calls WHERE created_at > now() - interval '12 months' GROUP BY 1, 2, 3 ORDER BY 1 DESC, 2, 3"
  );
  const recent = await db.query(
    "SELECT provider, currency, count(*)::int AS calls, coalesce(sum(cost), 0)::float AS cost FROM wvr_provider_calls WHERE created_at > now() - interval '30 days' GROUP BY 1, 2 ORDER BY 1, 2"
  );
  // From the paid-call log, which outlives deleted projects (their render records go with them).
  const renders = await db.query(
    "SELECT status, count(*)::int AS n FROM wvr_provider_calls WHERE provider = 'openai' AND created_at > now() - interval '30 days' GROUP BY status ORDER BY status"
  );
  const enq = await db.query(
    "SELECT count(*)::int AS total, count(*) FILTER (WHERE delivery_status = 'sent')::int AS emailed, count(*) FILTER (WHERE delivery_status IN ('failed', 'uncertain'))::int AS email_problems " +
      "FROM wvr_enquiries WHERE created_at > now() - interval '30 days'"
  );
  const held = await db.query("SELECT count(*)::int AS projects, count(*) FILTER (WHERE photo_id IS NOT NULL)::int AS with_photo FROM wvr_projects");
  const run = await db.query("SELECT started_at, finished_at, detail FROM wvr_retention_runs WHERE kind = 'daily' ORDER BY started_at DESC LIMIT 1");
  const r = run.rows[0];
  return json(ctx.res, 200, {
    ok: true,
    budget: { reserved: today.reserved, spent: today.spent, cap: cfg.budgetUsd, currency: "USD" },
    last30Days: {
      byProvider: recent.rows,
      renderCalls: Object.fromEntries(renders.rows.map((x) => [x.status, x.n])),
      enquiries: { total: enq.rows[0].total, emailed: enq.rows[0].emailed, emailProblems: enq.rows[0].email_problems },
    },
    byMonth: byMonth.rows,
    held: { projects: held.rows[0].projects, withPhoto: held.rows[0].with_photo },
    lastSweep: r ? { at: iso(r.finished_at || r.started_at), detail: parsed(r.detail) } : null,
    retention: require("./retention.js").RETENTION,
  });
}

// ---------------------------------------------------------------------------
// roof measurements (B3): entered by the roofer, approved, shown or not

const SOURCE_FOR_METHOD = /** @type {Record<string, string>} */ ({
  site_survey: "operator_manual",
  drawings: "operator_manual",
  customer_evidence: "customer_evidence",
  hover_report: "hover",
  desk_estimate: "desk_measure",
});
// Whose terms decide whether a measurement's figures may be shown to the customer
// (permissions.js). The roofer's own measurements and the customer's own plans need none.
const RIGHTS_FOR_METHOD = /** @type {Record<string, string[]>} */ ({
  site_survey: [],
  drawings: [],
  customer_evidence: [],
  hover_report: ["hover"],
  desk_estimate: ["os_ngd", "ea_lidar"],
});

/** @param {string} method */
function displayRights(method) {
  const providers = RIGHTS_FOR_METHOD[method];
  if (!providers) return { ok: false, ref: null, missing: ["unknown method"] };
  const missing = providers.filter((k) => !PROVIDERS[k] || PROVIDERS[k].display !== "yes").map((k) => (PROVIDERS[k] ? PROVIDERS[k].name : k));
  return { ok: missing.length === 0, ref: providers.length ? providers.join("+") : "own_data", missing };
}

/** A measurement for the operator: full precision, what the customer would see, and whether it may be shown. @param {any} m */
function operatorView(m) {
  const rights = displayRights(m.method);
  return {
    id: m.id,
    method: m.method,
    source: m.source,
    status: m.status,
    reasons: m.reasons,
    faces: m.faces,
    edges: m.edges,
    grossSurfaceM2: m.gross_surface_m2 === null ? null : Number(m.gross_surface_m2),
    sourceDate: m.source_date,
    notes: m.notes,
    evidence: parsed(m.evidence) || [],
    createdAt: iso(m.created_at),
    createdBy: m.created_by,
    approvedAt: iso(m.approved_at),
    rejectedAt: iso(m.rejected_at),
    customerVisible: m.customer_visible,
    displayRightsRef: m.display_rights_ref,
    supersededAt: iso(m.superseded_at),
    supersededBy: m.superseded_by,
    shown: geometry.customerView(m),
    canShow: rights.ok,
    showBlockedBy: rights.missing,
  };
}

/** @param {OperatorCtx} ctx */
async function measurementRow(ctx) {
  const { rows } = await db.query("SELECT * FROM wvr_measurements WHERE id = $1", [idParam(ctx, "id")]);
  if (!rows[0]) throw new HttpError(404, "not_found", "That measurement doesn't exist.");
  return measurements.fromRow(rows[0]);
}

/**
 * A new measurement of the enquiry's roof (a correction is simply a new one: the
 * old is kept, pointing at it). Faces and edges as entered, or from a Hover report.
 * @param {OperatorCtx} ctx
 */
async function addMeasurement(ctx) {
  measurements.requireEnabled();
  const e = await enquiryRow(ctx);
  if (!e.project_id) throw new HttpError(409, "conflict", "This enquiry has no project to measure.");
  const body = await readJson(ctx.req, 64 * 1024);
  const method = String(body.method || "");
  let faces = body.faces;
  let edges = body.edges;
  if (body.hover !== undefined) {
    if (method !== "hover_report") throw new HttpError(400, "invalid_fields", "A Hover report goes with the method 'Hover report'.", { fields: ["method"] });
    const h = require("./measure/hover.js").fromHoverSummary(body.hover || {});
    if (!h.ok) throw new HttpError(400, "invalid_faces", "Please check the Hover report's figures.", { problems: h.problems });
    faces = h.faces;
    edges = h.edges;
  }
  const ids = Array.isArray(body.evidence) ? body.evidence.map(String).filter((/** @type {string} */ x) => UUID_RE.test(x)) : [];
  const known = ids.length ? (await db.query("SELECT id FROM wvr_evidence WHERE project_id = $1 AND id = ANY($2::uuid[])", [e.project_id, ids])).rows.map((r) => r.id) : [];
  if (known.length !== ids.length) throw new HttpError(400, "invalid_fields", "A file listed as evidence isn't one of this customer's.", { fields: ["evidence"] });
  const made = await db.tx(async (t) => {
    const p = (await t.query("SELECT * FROM wvr_projects WHERE id = $1 FOR UPDATE", [e.project_id])).rows[0];
    if (!p) throw new HttpError(409, "conflict", "This enquiry's project has gone.");
    const out = await measurements.create(t, p, {
      source: SOURCE_FOR_METHOD[method] || "operator_manual",
      method,
      faces,
      edges,
      source_date: body.sourceDate ? String(body.sourceDate) : null,
      notes: clean(body.notes, 1000) || null,
      evidence: known,
      created_by: "operator",
    });
    const m = out.measurement;
    await audit(t, ctx, "measurement", m.id, "measurement_added", out.superseded.length ? { superseded: out.superseded } : null, {
      method,
      status: m.status,
      reasons: m.reasons,
      faces: m.faces.length,
      grossSurfaceM2: m.gross_surface_m2 === null ? null : Math.round(Number(m.gross_surface_m2) * 100) / 100,
    });
    return m;
  });
  return json(ctx.res, 201, { ok: true, measurement: operatorView(made) });
}

/** @param {any} m */
function assertCurrent(m) {
  if (m.superseded_at) throw new HttpError(409, "superseded", "A newer measurement has replaced this one.");
  if (m.rejected_at) throw new HttpError(409, "conflict", "This measurement was rejected. Add a new one instead.");
}

/**
 * Approve: the roofer has checked it. One from the roofer's own survey or the
 * customer's plans is shown to the customer straight away; one whose source's
 * terms don't allow that stays hidden ("figures will be in your quotation").
 * @param {OperatorCtx} ctx
 */
async function approveMeasurement(ctx) {
  measurements.requireEnabled();
  const m = await measurementRow(ctx);
  const body = await readJson(ctx.req, 4 * 1024);
  assertCurrent(m);
  const reasons = m.reasons || [];
  if (reasons.length && body.confirm !== true) {
    throw new HttpError(400, "confirm_required", "Confirm you've checked what this measurement was flagged for.", { reasons });
  }
  const rights = displayRights(m.method);
  await db.tx(async (t) => {
    await t.query("UPDATE wvr_measurements SET status = 'indicative_available', approved_by = 'operator', approved_at = now(), customer_visible = $2, display_rights_ref = $3 WHERE id = $1", [
      m.id,
      rights.ok,
      rights.ok ? rights.ref : null,
    ]);
    await audit(t, ctx, "measurement", m.id, "measurement_approved", { status: m.status, reasons }, { status: "indicative_available", customerVisible: rights.ok });
  });
  return json(ctx.res, 200, { ok: true, measurement: operatorView(measurements.fromRow((await db.query("SELECT * FROM wvr_measurements WHERE id = $1", [m.id])).rows[0])) });
}

/** @param {OperatorCtx} ctx */
async function rejectMeasurement(ctx) {
  const m = await measurementRow(ctx);
  const body = await readJson(ctx.req, 4 * 1024);
  assertCurrent(m);
  const note = clean(body.notes, 500) || null;
  await db.tx(async (t) => {
    await t.query(
      "UPDATE wvr_measurements SET rejected_at = now(), status = 'unavailable', customer_visible = false, " +
        "reasons = (SELECT jsonb_agg(DISTINCT x) FROM jsonb_array_elements(reasons || '[\"operator_rejected\"]'::jsonb) AS x) WHERE id = $1",
      [m.id]
    );
    await audit(t, ctx, "measurement", m.id, "measurement_rejected", { status: m.status }, { status: "unavailable", notes: note });
  });
  return json(ctx.res, 200, { ok: true, rejected: true });
}

/**
 * Show the figures to the customer, or hide them. Showing needs an approved
 * measurement whose source allows it (permissions.js).
 * @param {OperatorCtx} ctx
 */
async function measurementVisibility(ctx) {
  measurements.requireEnabled();
  const m = await measurementRow(ctx);
  const body = await readJson(ctx.req, 4 * 1024);
  if (typeof body.visible !== "boolean") throw new HttpError(400, "invalid_fields", "Say whether the figures should be shown.", { fields: ["visible"] });
  assertCurrent(m);
  const rights = displayRights(m.method);
  if (body.visible) {
    if (!m.approved_at || m.status !== "indicative_available") throw new HttpError(409, "conflict", "Approve the measurement first.");
    if (!rights.ok) {
      throw new HttpError(409, "rights_unresolved", "The terms of " + rights.missing.join(" and ") + " don't allow showing these figures to the customer; they'll see that the figures come with the quotation.", {
        missing: rights.missing,
      });
    }
  }
  await db.tx(async (t) => {
    await t.query("UPDATE wvr_measurements SET customer_visible = $2, display_rights_ref = $3 WHERE id = $1", [m.id, body.visible, body.visible ? rights.ref : null]);
    await audit(t, ctx, "measurement", m.id, "measurement_visibility", { customerVisible: m.customer_visible }, { customerVisible: body.visible });
  });
  return json(ctx.res, 200, { ok: true, customerVisible: body.visible });
}

/** A five-minute link to one of the customer's plans, drawings or photos. @param {OperatorCtx} ctx */
async function evidenceLink(ctx) {
  const { rows } = await db.query("SELECT * FROM wvr_evidence WHERE id = $1", [idParam(ctx, "id")]);
  if (!rows[0]) throw new HttpError(404, "not_found", "That file doesn't exist.");
  const url = await storage().presignGet(rows[0].pathname, 300);
  await audit(db, ctx, "evidence", rows[0].id, "evidence_downloaded", null, null);
  return json(ctx.res, 200, { ok: true, url, expiresIn: 300, mime: rows[0].mime });
}

module.exports = {
  addMeasurement,
  approveMeasurement,
  rejectMeasurement,
  measurementVisibility,
  evidenceLink,
  costs,
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
  listProjects,
  projectView,
  projectPhoto,
  mockupImage,
  projectOriginal,
  deleteProjectRoute,
  listJobs,
  jobImage,
  retryJob,
  STATUSES,
};
