// WV Roofing — a measured roof: checking its faces and edges, surface areas, and
// what needs the roofer's review (B2; plan §6, brief §12 and §14).
//
//   - A face's surface area is worked out only from its plan area and pitch
//     (plan ÷ cos(pitch)). An area the source already gave on the slope is used as
//     it is: never corrected again.
//   - A missing value stays null, never 0. Nothing is subtracted (openings) without
//     an explicit rule; the gross figure and any adjustments are kept apart.
//   - Full precision is stored; the customer sees whole m² and whole degrees.
//   - Edge lengths are entered, never worked out from areas or perimeters.
"use strict";

const { EDGE_KINDS } = require("../catalogue.js");

const MAX_FACES = 50;
const MAX_EDGES = 100;
const MAX_PITCH = 75;
const MAX_AREA = 5000;
const MAX_EDGE_M = 500;
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const FACE_FLAGS = ["tree_cover", "unreliable_pitch", "complex_geometry"];
const STATUSES = ["indicative_available", "processing", "needs_review", "unavailable", "awaiting_survey"];
const REASONS = [
  "no_rooftop_coordinate",
  "pitch_unknown",
  "shared_roof",
  "ambiguous_scope",
  "missing_faces",
  "tree_cover",
  "source_outdated",
  "complex_geometry",
  "unreliable_pitch",
  "licence_unresolved",
  "geography_unsupported",
  "operator_rejected",
];
const METHODS = ["site_survey", "drawings", "customer_evidence", "hover_report", "desk_estimate"];
// Sources that find the roof from map coordinates rather than from the house itself.
const LOCATED_BY_COORDINATES = new Set(["desk_measure", "google_solar", "vexcel", "bluesky"]);
// Older sources may miss extensions and roof changes.
const SOURCE_MAX_AGE_YEARS = 5;

/**
 * @typedef {{ id: string, plan_area_m2: number | null, pitch_deg: number | null, surface_area_m2: number | null, slope_adjusted_by_source: boolean, azimuth_deg: number | null, included: boolean, flags: string[] }} Face
 * @typedef {{ id: string, kind: string, length_m: number, face_ids: string[], source: string | null }} Edge
 */

/** @param {unknown} v */
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * The sloped area of a face: the source's own figure if it gave one, otherwise
 * plan area ÷ cos(pitch); null when neither can be had.
 * @param {{ plan_area_m2: number | null, pitch_deg: number | null, surface_area_m2: number | null }} f
 */
function surfaceOf(f) {
  if (f.surface_area_m2 !== null) return f.surface_area_m2;
  if (f.plan_area_m2 === null || f.pitch_deg === null) return null;
  return f.plan_area_m2 / Math.cos((f.pitch_deg * Math.PI) / 180);
}

/**
 * Check and tidy a measurement's faces. surface_area_m2 comes back filled in
 * where it can be worked out (slope_adjusted_by_source says where it came from).
 * @param {unknown} input
 * @returns {{ ok: boolean, faces: Face[], problems: string[] }}
 */
function checkFaces(input) {
  /** @type {string[]} */
  const problems = [];
  if (!Array.isArray(input) || input.length < 1) return { ok: false, faces: [], problems: ["at least one roof face is needed"] };
  if (input.length > MAX_FACES) return { ok: false, faces: [], problems: ["at most " + MAX_FACES + " faces"] };
  /** @type {Face[]} */
  const faces = [];
  const seen = new Set();
  for (const raw of input) {
    const r = raw && typeof raw === "object" ? /** @type {Record<string, any>} */ (raw) : {};
    const id = String(r.id === undefined ? "" : r.id);
    const where = "face " + (id || "(no id)");
    if (!ID_RE.test(id)) problems.push(where + ": id");
    else if (seen.has(id)) problems.push(where + ": duplicate id");
    seen.add(id);
    const plan = num(r.plan_area_m2);
    const surf = num(r.surface_area_m2);
    const pitch = num(r.pitch_deg);
    const az = num(r.azimuth_deg);
    if (Number.isNaN(plan) || (plan !== null && (plan <= 0 || plan > MAX_AREA))) problems.push(where + ": plan area");
    if (Number.isNaN(surf) || (surf !== null && (surf <= 0 || surf > MAX_AREA))) problems.push(where + ": surface area");
    if (Number.isNaN(pitch) || (pitch !== null && (pitch < 0 || pitch > MAX_PITCH))) problems.push(where + ": pitch must be 0–" + MAX_PITCH + "°");
    if (Number.isNaN(az) || (az !== null && (az < 0 || az >= 360))) problems.push(where + ": azimuth");
    if (r.slope_adjusted_by_source === true && (surf === null || Number.isNaN(surf))) problems.push(where + ": a sloped area from the source needs its figure");
    const flags = Array.isArray(r.flags) ? r.flags.filter((/** @type {unknown} */ x) => typeof x === "string" && FACE_FLAGS.includes(x)) : [];
    const f = {
      id,
      plan_area_m2: plan === null || Number.isNaN(plan) ? null : plan,
      pitch_deg: pitch === null || Number.isNaN(pitch) ? null : pitch,
      surface_area_m2: surf === null || Number.isNaN(surf) ? null : surf,
      slope_adjusted_by_source: surf !== null && !Number.isNaN(surf),
      azimuth_deg: az === null || Number.isNaN(az) ? null : az,
      included: r.included !== false,
      flags: [...new Set(/** @type {string[]} */ (flags))],
    };
    f.surface_area_m2 = surfaceOf(f);
    faces.push(f);
  }
  return { ok: problems.length === 0, faces, problems };
}

/**
 * Check a measurement's edges (entered lengths only).
 * @param {unknown} input
 * @param {Face[]} faces
 * @returns {{ ok: boolean, edges: Edge[], problems: string[] }}
 */
function checkEdges(input, faces) {
  if (input === undefined || input === null) return { ok: true, edges: [], problems: [] };
  if (!Array.isArray(input) || input.length > MAX_EDGES) return { ok: false, edges: [], problems: ["edges"] };
  const faceIds = new Set(faces.map((f) => f.id));
  /** @type {string[]} */
  const problems = [];
  /** @type {Edge[]} */
  const edges = [];
  const seen = new Set();
  for (const raw of input) {
    const r = raw && typeof raw === "object" ? /** @type {Record<string, any>} */ (raw) : {};
    const id = String(r.id === undefined ? "" : r.id);
    const where = "edge " + (id || "(no id)");
    if (!ID_RE.test(id)) problems.push(where + ": id");
    else if (seen.has(id)) problems.push(where + ": duplicate id");
    seen.add(id);
    if (!EDGE_KINDS.includes(r.kind)) problems.push(where + ": kind");
    const len = num(r.length_m);
    if (len === null || Number.isNaN(len) || len <= 0 || len > MAX_EDGE_M) problems.push(where + ": length");
    const fids = Array.isArray(r.face_ids) ? r.face_ids.map(String) : [];
    if (fids.some((/** @type {string} */ x) => !faceIds.has(x))) problems.push(where + ": unknown face");
    edges.push({ id, kind: String(r.kind), length_m: len === null || Number.isNaN(len) ? 0 : len, face_ids: fids, source: r.source ? String(r.source).slice(0, 60) : null });
  }
  return { ok: problems.length === 0, edges, problems };
}

/** The gross sloped area of the faces in scope; null if any of them has none. @param {Face[]} faces */
function grossSurface(faces) {
  const inScope = faces.filter((f) => f.included);
  if (!inScope.length || inScope.some((f) => f.surface_area_m2 === null)) return null;
  return inScope.reduce((n, f) => n + /** @type {number} */ (f.surface_area_m2), 0);
}

/**
 * What needs the roofer's review before anyone relies on this measurement.
 * @param {{ faces: Face[], source: string, method: string, source_date: string | null }} m
 * @param {{ coordSource?: string | null, confirmationReasons?: string[], now?: Date }} [ctx]
 * @returns {{ status: string, reasons: string[] }}
 */
function assess(m, ctx) {
  const c = ctx || {};
  /** @type {Set<string>} */
  const reasons = new Set();
  const inScope = m.faces.filter((f) => f.included);
  if (!inScope.length) reasons.add("missing_faces");
  for (const f of inScope) {
    if (f.surface_area_m2 === null) reasons.add(f.plan_area_m2 !== null && f.pitch_deg === null ? "pitch_unknown" : "missing_faces");
    for (const flag of f.flags) reasons.add(flag);
  }
  if (LOCATED_BY_COORDINATES.has(m.source) && c.coordSource !== "rooftop") reasons.add("no_rooftop_coordinate");
  // A roofer who surveyed the roof on site settles its scope; anything else keeps the customer's doubts.
  if (m.method !== "site_survey") {
    const cr = c.confirmationReasons || [];
    if (cr.includes("shared_roof")) reasons.add("shared_roof");
    if (cr.some((r) => ["flat_or_shared_block", "property_type_unclear", "pin_not_confirmed", "not_seen_from_above"].includes(r))) reasons.add("ambiguous_scope");
  }
  if (m.source_date) {
    const age = ((c.now || new Date()).getTime() - new Date(m.source_date).getTime()) / (365.25 * 24 * 3600 * 1000);
    if (age > SOURCE_MAX_AGE_YEARS) reasons.add("source_outdated");
  }
  const list = REASONS.filter((r) => reasons.has(r));
  return { status: list.length ? "needs_review" : "indicative_available", reasons: list };
}

// ---------------------------------------------------------------------------
// what the customer sees

const METHOD_WORDS = /** @type {Record<string, string>} */ ({
  site_survey: "a site survey",
  drawings: "the property's drawings",
  customer_evidence: "the plans and photos you sent",
  hover_report: "a report made from photos taken around the house",
  desk_estimate: "a desk estimate",
});

/** Whole square metres, for display. @param {number} m2 */
function wholeM2(m2) {
  return Math.round(m2);
}

/** Whole degrees, for display. @param {number} deg */
function wholeDeg(deg) {
  return Math.round(deg);
}

/**
 * A measurement as the customer sees it: whole m² and degrees, who measured it
 * from what, and when (never "aerial").
 * @param {{ faces: Face[], method: string, source_date: string | null, gross_surface_m2: number | null }} m
 */
function customerView(m) {
  const inScope = m.faces.filter((f) => f.included);
  const pitches = [...new Set(inScope.map((f) => f.pitch_deg).filter((p) => p !== null).map((p) => wholeDeg(/** @type {number} */ (p))))].sort((a, b) => a - b);
  const date = m.source_date ? new Date(m.source_date + "T12:00:00Z") : null;
  return {
    area_m2: m.gross_surface_m2 === null ? null : wholeM2(m.gross_surface_m2),
    faces: inScope.length,
    pitch: pitches.length ? (pitches.length === 1 ? pitches[0] + "°" : pitches[0] + "–" + pitches[pitches.length - 1] + "°") : null,
    label: "Measured by the roofer from " + (METHOD_WORDS[m.method] || "their own measurements") + (date ? " on " + new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date) : ""),
    changes_since_year: date ? date.getUTCFullYear() : null,
  };
}

module.exports = {
  checkFaces,
  checkEdges,
  surfaceOf,
  grossSurface,
  assess,
  customerView,
  wholeM2,
  wholeDeg,
  REASONS,
  STATUSES,
  METHODS,
  FACE_FLAGS,
  LOCATED_BY_COORDINATES,
  METHOD_WORDS,
};
