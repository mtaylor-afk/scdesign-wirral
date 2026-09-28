// WV Roofing — roof measurements and the customer's estimate (B2; plan §6, brief §12–§13).
//
//   GET projects/:id/estimate?visual=<look>   -> what the estimate step shows
//
// A measurement is never edited: a new one supersedes the old. The customer sees
// one only when the operator has approved it and made it visible; then the
// estimate shows the roof's size in whole m² and degrees, who measured it from
// what and when, and quantities from VERIFIED products for the chosen look only.
// A new address supersedes the project's measurements; a scope correction by
// the operator sends the current one back for review.
"use strict";

const crypto = require("crypto");
const core = require("./core.js");
const db = require("./db.js");
const geometry = require("./measure/geometry.js");
const quantities = require("./quantities.js");

const { HttpError, json, VISUALS } = core;

/** The owner's switch for measurement (WVR_CAP_ASSISTED_MEASUREMENT, with storage). */
function enabled() {
  return require("./capabilities.js").isEnabled("assisted_measurement", process.env);
}

function requireEnabled() {
  if (!enabled()) throw new HttpError(503, "not_configured", "Roof measurement isn't switched on.");
}

/**
 * @typedef {import("./projects.js").ProjectCtx} ProjectCtx
 * @typedef {Record<string, any>} Row
 */

/** @param {unknown} v */
function parsed(v) {
  return typeof v === "string" ? JSON.parse(v) : v;
}

/**
 * A measurement row with its JSON parsed and its date as YYYY-MM-DD.
 * @param {Row} r
 * @returns {any}
 */
function fromRow(r) {
  return Object.assign({}, r, {
    faces: parsed(r.faces) || [],
    edges: parsed(r.edges) || [],
    reasons: parsed(r.reasons) || [],
    source_date: r.source_date ? new Date(r.source_date).toISOString().slice(0, 10) : null,
  });
}

/**
 * Record a measurement (checked, surface areas worked out, assessed) and
 * supersede the one before it. Used by the operator's entry (B3).
 * @param {import("./db.js").TxClient} t
 * @param {Row} project
 * @param {{ source: string, method: string, faces: unknown, edges?: unknown, source_date?: string | null, source_meta?: object, evidence?: unknown[], notes?: string | null, created_by: string }} input
 */
async function create(t, project, input) {
  if (!geometry.METHODS.includes(input.method)) throw new HttpError(400, "invalid_fields", "Choose how the roof was measured.", { fields: ["method"] });
  const f = geometry.checkFaces(input.faces);
  const e = geometry.checkEdges(input.edges, f.faces);
  if (!f.ok || !e.ok) throw new HttpError(400, "invalid_faces", "Please check the roof faces and edges.", { problems: f.problems.concat(e.problems) });
  const sourceDate = input.source_date ? String(input.source_date) : null;
  if (sourceDate && (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDate) || new Date(sourceDate).getTime() > Date.now() + 24 * 3600 * 1000)) {
    throw new HttpError(400, "invalid_fields", "The date measured isn't a valid date (or is in the future).", { fields: ["source_date"] });
  }
  const ctx = await context(t, project);
  const assessed = geometry.assess({ faces: f.faces, source: input.source, method: input.method, source_date: sourceDate }, ctx);
  const id = crypto.randomUUID();
  const prev = await t.query("SELECT id FROM wvr_measurements WHERE project_id = $1 AND superseded_at IS NULL", [project.id]);
  await t.query(
    "INSERT INTO wvr_measurements (id, project_id, property_confirmation_id, source, method, status, reasons, faces, edges, gross_surface_m2, source_date, source_meta, evidence, notes, created_by) " +
      "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)",
    [
      id,
      project.id,
      project.property_confirmation_id || null,
      input.source,
      input.method,
      assessed.status,
      JSON.stringify(assessed.reasons),
      JSON.stringify(f.faces),
      JSON.stringify(e.edges),
      geometry.grossSurface(f.faces),
      sourceDate,
      JSON.stringify(input.source_meta || {}),
      JSON.stringify(input.evidence || []),
      input.notes || null,
      input.created_by,
    ]
  );
  for (const old of prev.rows) {
    await t.query("UPDATE wvr_measurements SET superseded_by = $2, superseded_at = now() WHERE id = $1", [old.id, id]);
  }
  const { rows } = await t.query("SELECT * FROM wvr_measurements WHERE id = $1", [id]);
  return { measurement: fromRow(rows[0]), superseded: prev.rows.map((r) => r.id) };
}

/**
 * What the assessment needs to know about the property: where its location
 * came from, and the doubts the customer's answers left.
 * @param {{ query: import("./db.js").QueryFn }} q
 * @param {Row} project
 */
async function context(q, project) {
  const a = project.address_id ? (await q.query("SELECT coord_source FROM wvr_addresses WHERE id = $1", [project.address_id])).rows[0] : null;
  const c = project.property_confirmation_id ? (await q.query("SELECT ambiguity_reasons FROM wvr_property_confirmations WHERE id = $1", [project.property_confirmation_id])).rows[0] : null;
  return { coordSource: a ? a.coord_source : null, confirmationReasons: c ? parsed(c.ambiguity_reasons) || [] : [] };
}

/**
 * A measurement in the shape quantities.js takes (surface areas as worked out, never again).
 * @param {any} m
 * @returns {import("./quantities.js").Measured}
 */
function forQuantities(m) {
  return { faces: m.faces.map((/** @type {any} */ f) => ({ id: f.id, surface_m2: f.surface_area_m2, pitch_deg: f.pitch_deg, included: f.included })), edges: m.edges };
}

/**
 * What the automatic measurement providers say about this property: always
 * "unsupported" today, with the reasons (measure/adapters.js).
 * @param {string} projectId
 */
async function automaticFor(projectId) {
  const { rows } = await db.query(
    "SELECT a.postcode, a.uprn, a.lat, a.lng, a.coord_source FROM wvr_projects p LEFT JOIN wvr_addresses a ON a.id = p.address_id WHERE p.id = $1",
    [projectId]
  );
  const a = rows[0] || {};
  const results = await require("./measure/adapters.js").automatic({ postcode: a.postcode, uprn: a.uprn, lat: a.lat, lng: a.lng, coordSource: a.coord_source });
  return { status: "unsupported", reasons: [...new Set(results.flatMap((r) => r.reasons))] };
}

/** The project's current measurement (any state), or null. @param {string} projectId */
async function current(projectId) {
  const { rows } = await db.query("SELECT * FROM wvr_measurements WHERE project_id = $1 AND superseded_at IS NULL ORDER BY created_at DESC LIMIT 1", [projectId]);
  return rows[0] ? fromRow(rows[0]) : null;
}

/** The measurement the customer may see: approved, visible and still current. @param {string} projectId */
async function visible(projectId) {
  const m = await current(projectId);
  if (!m || m.rejected_at || !m.approved_at || !m.customer_visible || m.status !== "indicative_available") return null;
  return m;
}

/**
 * A new address (or none): the project's measurements no longer describe it.
 * @param {import("./db.js").TxClient} t
 * @param {string} projectId
 */
async function supersedeAll(t, projectId) {
  await t.query("UPDATE wvr_measurements SET superseded_at = now() WHERE project_id = $1 AND superseded_at IS NULL", [projectId]);
}

/**
 * The operator corrected the scope: the current measurement goes back for review
 * and is hidden from the customer until it's approved again.
 * @param {import("./db.js").TxClient} t
 * @param {string} projectId
 * @returns {Promise<string | null>} the measurement sent back, if any
 */
async function sendBackForReview(t, projectId) {
  const { rows } = await t.query(
    "UPDATE wvr_measurements SET status = 'needs_review', reasons = (SELECT jsonb_agg(DISTINCT x) FROM jsonb_array_elements(reasons || '[\"ambiguous_scope\"]'::jsonb) AS x), customer_visible = false " +
      "WHERE project_id = $1 AND superseded_at IS NULL RETURNING id",
    [projectId]
  );
  return rows[0] ? rows[0].id : null;
}

// The brief's own list, shown whenever there are no figures.
const BRIEF_NOT_INCLUDED = ["ridges", "hips", "valleys", "verges", "flashings", "gutters", "fixings"];

const NOT_INCLUDED_WORDS = /** @type {Record<string, string>} */ ({
  ridge: "ridges",
  hip: "hips",
  valley: "valleys",
  eaves: "eaves",
  verge: "verges",
  abutment: "abutments",
  flashings: "flashings",
  gutters: "gutters",
  fixings: "fixings",
  underlay: "underlay",
  battens: "battens",
});

/**
 * The estimate step's content for one look. Statuses the customer can get:
 *   unavailable           nothing measured (or the measurement was rejected)
 *   processing            measured, and the roofer is checking it
 *   measured_not_shown    approved, but its figures can't be shown online: they come with the quotation
 *   indicative_available  the roof's size, and quantities from verified products
 * The roof's size doesn't depend on the look; the materials do (no look chosen
 * yet: the size alone, reason "no_look_chosen").
 * @param {string} projectId
 * @param {string | null} visualId
 */
async function estimateFor(projectId, visualId) {
  // Switched off: nothing measured is shown (the roofer measures at a survey).
  const on = enabled();
  const m = on ? await visible(projectId) : null;
  if (!m) {
    const cur = on ? await current(projectId) : null;
    const none = { measurement: null, products: [], not_included: BRIEF_NOT_INCLUDED };
    if (!cur || cur.rejected_at) return Object.assign({ status: "unavailable", reason: "no_measurement", automatic: await automaticFor(projectId) }, none);
    if (cur.approved_at && cur.status === "indicative_available") return Object.assign({ status: "measured_not_shown", reason: "figures_in_quotation" }, none);
    return Object.assign({ status: "processing", reason: "being_checked" }, none);
  }
  const ests = visualId ? quantities.estimateForVisual(forQuantities(m), visualId) : [];
  const notIncluded = new Set();
  for (const e of ests) for (const n of e.not_included) notIncluded.add(NOT_INCLUDED_WORDS[n.item] || n.item);
  if (!ests.length) for (const w of Object.values(NOT_INCLUDED_WORDS)) notIncluded.add(w);
  return {
    status: "indicative_available",
    reason: !visualId ? "no_look_chosen" : ests.length ? null : "no_verified_product",
    measurement: geometry.customerView(m),
    products: ests.map((e) => ({
      name: e.product_name,
      unit: e.unit,
      complete: e.complete,
      total: e.total ? { units: e.total.units, allowance_pct: e.total.allowance_pct, packs: e.total.packs, pack_size: e.total.pack_size, pack_name: e.total.pack_name } : null,
      linear: e.linear.map((l) => ({ kind: l.kind, length_m: Math.round(l.length_m * 10) / 10, units: l.units, product: l.product })),
      warnings: e.warnings,
    })),
    not_included: [...notIncluded],
  };
}

// ---------------------------------------------------------------------------
// route

/** @param {ProjectCtx} ctx */
async function estimateRoute(ctx) {
  const visualId = String(ctx.url.searchParams.get("visual") || "");
  if (visualId && !VISUALS.has(visualId)) throw new HttpError(400, "invalid_fields", "Choose a roof from the range.", { fields: ["visual"] });
  return json(ctx.res, 200, { ok: true, estimate: await estimateFor(ctx.project.id, visualId || null) });
}

module.exports = { create, current, visible, supersedeAll, sendBackForReview, estimateFor, estimate: estimateRoute, fromRow, forQuantities, enabled, requireEnabled };
