// WV Roofing — the Hover report template (B3; plan D11): turn the summary of a
// Hover roof report the roofer ordered into a measurement's faces and edges.
//
//   - Hover's roof area is the area on the slope: it becomes one face with
//     surface_area_m2 (slope_adjusted_by_source), never corrected again.
//   - Its pitch may be given as "x/12" (rise over run) or in degrees.
//   - Its lengths map to edges: ridges, hips, valleys, rakes (verges), eaves, and
//     flashing (abutments). Nothing is worked out from the area.
//   - Imperial reports (ft, ft²) are converted to metres.
// Hover's terms allow internal business use only, so a Hover measurement stays
// hidden from customers (permissions.js "hover": display "no").
"use strict";

const FT = 0.3048;
const FT2 = FT * FT;

const LENGTHS = /** @type {const} */ ([
  ["ridges", "ridge"],
  ["hips", "hip"],
  ["valleys", "valley"],
  ["rakes", "verge"],
  ["eaves", "eaves"],
  ["flashing", "abutment"],
]);

/** @param {unknown} v */
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : NaN;
}

/**
 * A pitch in degrees, from degrees or Hover's "x/12".
 * @param {unknown} v
 * @returns {number | null}  null when not given; NaN when unreadable
 */
function pitchDegrees(v) {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  const m = /^(\d+(?:\.\d+)?)\s*\/\s*12$/.exec(s);
  if (m) return (Math.atan(Number(m[1]) / 12) * 180) / Math.PI;
  const d = num(s.replace(/°$/, ""));
  return d === null ? null : d;
}

/**
 * @param {{ units?: "metric" | "imperial", total_area?: unknown, pitch?: unknown, ridges?: unknown, hips?: unknown, valleys?: unknown, rakes?: unknown, eaves?: unknown, flashing?: unknown }} h
 * @returns {{ ok: boolean, faces: object[], edges: object[], problems: string[] }}
 */
function fromHoverSummary(h) {
  const imperial = h.units === "imperial";
  /** @type {string[]} */
  const problems = [];
  const area = num(h.total_area);
  if (area === null || Number.isNaN(area) || area <= 0) problems.push("the report's total roof area");
  const pitch = pitchDegrees(h.pitch);
  if (pitch !== null && (Number.isNaN(pitch) || pitch < 0 || pitch > 75)) problems.push("the report's pitch (degrees, or x/12)");
  /** @type {object[]} */
  const edges = [];
  for (const [field, kind] of LENGTHS) {
    const len = num(/** @type {any} */ (h)[field]);
    if (len === null || len === 0) continue;
    if (Number.isNaN(len) || len < 0) {
      problems.push("the report's " + field);
      continue;
    }
    edges.push({ id: "hover-" + kind, kind, length_m: imperial ? len * FT : len, face_ids: [], source: "hover" });
  }
  const faces =
    area === null || Number.isNaN(area)
      ? []
      : [{ id: "hover-roof", surface_area_m2: imperial ? area * FT2 : area, slope_adjusted_by_source: true, pitch_deg: pitch === null || Number.isNaN(pitch) ? null : pitch, included: true }];
  return { ok: problems.length === 0, faces, edges, problems };
}

module.exports = { fromHoverSummary, pitchDegrees };
