// WV Roofing — material quantities from a measured roof (B1; plan D12, brief §13).
//
// Pure functions: the measurement goes in and is never changed; choosing another
// product simply calculates again.
//
//   - Only a product with a specification produces units. A look (a "visual")
//     never does, and a draft specification only when the operator asks for drafts.
//   - Lines are worked out per roof face, then added up per product, and only
//     then is the allowance applied (once, and shown) and the total rounded up to
//     whole units and packs. Two faces needing 0.4 of a pack each need 1 pack, not 2.
//   - A coverage figure that depends on pitch, on a face whose pitch isn't known,
//     marks that face needs_pitch. No default pitch is ever used.
//   - Ridge, hip, valley, eaves, verge and abutment lines appear only when an
//     entered length for that kind AND a per-metre figure in the specification
//     both exist. They are never worked out from areas or perimeters.
//   - Everything else is listed as not included.
"use strict";

const { EDGE_KINDS } = require("./catalogue.js");

// Never estimated here: listed on every estimate as not included.
const ALWAYS_NOT_INCLUDED = ["flashings", "gutters", "fixings", "underlay and battens"];

/**
 * @typedef {import("./catalogue.js").Product} Product
 * @typedef {import("./catalogue.js").Spec} Spec
 * @typedef {{ id: string, surface_m2: number | null, pitch_deg: number | null, included?: boolean }} Face
 * @typedef {{ id: string, kind: string, length_m: number }} Edge
 * @typedef {{ faces: Face[], edges?: Edge[] }} Measured
 * @typedef {"ok" | "needs_pitch" | "below_min_pitch" | "outside_published_range" | "no_area" | "excluded" | "no_verified_product"} LineStatus
 * @typedef {{ face_id: string, surface_m2: number | null, pitch_used_deg: number | null, units_per_m2_applied: number | null, units_before_rounding: number | null, status: LineStatus, reason: string | null }} Line
 */

/** @param {unknown} n */
function isNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Units per m² for a specification at a pitch.
 * @param {Spec} spec
 * @param {number | null} pitch
 * @returns {{ ok: true, units_per_m2: number, pitch_used_deg: number | null } | { ok: false, status: LineStatus, reason: string }}
 */
function coverageAt(spec, pitch) {
  const known = isNum(pitch);
  if (known && isNum(spec.min_pitch_deg) && /** @type {number} */ (pitch) < /** @type {number} */ (spec.min_pitch_deg)) {
    return { ok: false, status: "below_min_pitch", reason: "the face's pitch is below this product's minimum of " + spec.min_pitch_deg + "°" };
  }
  const c = spec.coverage;
  if (c.type === "fixed") return { ok: true, units_per_m2: c.units_per_m2, pitch_used_deg: known ? /** @type {number} */ (pitch) : null };
  if (!known) return { ok: false, status: "needs_pitch", reason: "this product's coverage depends on the pitch, and the face's pitch isn't known" };
  const p = /** @type {number} */ (pitch);
  const rows = c.rows;
  const last = rows.length - 1;
  const row = rows.find((r, i) => {
    const lo = isNum(r.min_pitch_deg) ? /** @type {number} */ (r.min_pitch_deg) : -Infinity;
    const hi = isNum(r.max_pitch_deg) ? /** @type {number} */ (r.max_pitch_deg) : Infinity;
    // bands are [min, max); the top band includes its maximum
    return p >= lo && (p < hi || (i === last && p === hi));
  });
  if (!row) return { ok: false, status: "outside_published_range", reason: "the face's pitch is outside the manufacturer's published table" };
  return { ok: true, units_per_m2: row.units_per_m2, pitch_used_deg: p };
}

/**
 * Quantities of one product over a measured roof.
 * @param {Measured} m
 * @param {Product} product
 * @param {{ allowancePct?: number, drafts?: boolean }} [opts]
 */
function estimate(m, product, opts) {
  const o = opts || {};
  const spec = product.spec;
  const usable = spec.status === "verified" || !!o.drafts;
  /** @type {Line[]} */
  const lines = [];
  for (const f of m.faces || []) {
    const base = { face_id: f.id, surface_m2: isNum(f.surface_m2) ? f.surface_m2 : null, pitch_used_deg: null, units_per_m2_applied: null, units_before_rounding: null };
    if (f.included === false) {
      lines.push(Object.assign(base, { status: /** @type {LineStatus} */ ("excluded"), reason: "left out of the scope" }));
      continue;
    }
    if (!usable) {
      lines.push(Object.assign(base, { status: /** @type {LineStatus} */ ("no_verified_product"), reason: "this product's figures haven't been checked by the roofer yet" }));
      continue;
    }
    if (base.surface_m2 === null || /** @type {number} */ (base.surface_m2) <= 0) {
      lines.push(Object.assign(base, { status: /** @type {LineStatus} */ ("no_area"), reason: "the face's area isn't known" }));
      continue;
    }
    const cov = coverageAt(spec, isNum(f.pitch_deg) ? f.pitch_deg : null);
    if (!cov.ok) {
      lines.push(Object.assign(base, { pitch_used_deg: isNum(f.pitch_deg) ? f.pitch_deg : null, status: cov.status, reason: cov.reason }));
      continue;
    }
    lines.push(
      Object.assign(base, {
        pitch_used_deg: cov.pitch_used_deg,
        units_per_m2_applied: cov.units_per_m2,
        units_before_rounding: /** @type {number} */ (base.surface_m2) * cov.units_per_m2,
        status: /** @type {LineStatus} */ ("ok"),
        reason: null,
      })
    );
  }

  const counted = lines.filter((l) => l.status === "ok");
  const open = lines.filter((l) => l.status !== "ok" && l.status !== "excluded");
  /** @type {null | { surface_m2: number, units_before_allowance: number, allowance_pct: number, units_with_allowance: number, units: number, packs: number, pack_size: number, pack_name: string | null }} */
  let total = null;
  if (usable && counted.length) {
    const before = counted.reduce((n, l) => n + /** @type {number} */ (l.units_before_rounding), 0);
    const pct = isNum(o.allowancePct) ? /** @type {number} */ (o.allowancePct) : spec.allowance_default_pct;
    const withAllowance = before * (1 + pct / 100);
    // Round once, at the end; a hair's tolerance so 100.0000000001 doesn't become 101.
    const units = Math.ceil(withAllowance - 1e-9);
    total = {
      surface_m2: counted.reduce((n, l) => n + /** @type {number} */ (l.surface_m2), 0),
      units_before_allowance: before,
      allowance_pct: pct,
      units_with_allowance: withAllowance,
      units,
      packs: Math.ceil(units / spec.pack_size),
      pack_size: spec.pack_size,
      pack_name: spec.pack_name || null,
    };
  }

  // Linear items: an entered length and a per-metre figure, or not at all.
  /** @type {Map<string, number>} */
  const lengths = new Map();
  for (const e of m.edges || []) {
    if (EDGE_KINDS.includes(e.kind) && isNum(e.length_m) && e.length_m > 0) lengths.set(e.kind, (lengths.get(e.kind) || 0) + e.length_m);
  }
  /** @type {{ kind: string, length_m: number, units_per_m: number, units: number, product: string | null }[]} */
  const linear = [];
  /** @type {{ item: string, reason: string }[]} */
  const notIncluded = [];
  for (const kind of EDGE_KINDS) {
    const len = lengths.get(kind);
    const pm = spec.per_metre && spec.per_metre[kind];
    if (!len) notIncluded.push({ item: kind, reason: "no length has been entered" });
    else if (!usable || !pm) notIncluded.push({ item: kind, reason: "there's no per-metre figure for this product" });
    else linear.push({ kind, length_m: len, units_per_m: pm.units_per_m, units: Math.ceil(len * pm.units_per_m - 1e-9), product: pm.product || null });
  }
  for (const item of ALWAYS_NOT_INCLUDED) notIncluded.push({ item, reason: "not estimated online" });

  // A fixed coverage figure works without a pitch, but the minimum pitch can't then be checked.
  /** @type {string[]} */
  const warnings = [];
  if (usable && isNum(spec.min_pitch_deg)) {
    const unknown = counted.filter((l) => l.pitch_used_deg === null).map((l) => l.face_id);
    if (unknown.length) warnings.push("The pitch of " + unknown.join(", ") + " isn't known: check it's at least " + spec.min_pitch_deg + "° for this product.");
  }

  return {
    product_id: product.id,
    product_name: product.manufacturer + " " + product.product + (product.colour ? ", " + product.colour : ""),
    visual_id: product.visual_id,
    spec_version: spec.version,
    spec_status: spec.status,
    unit: spec.unit,
    complete: usable && counted.length > 0 && open.length === 0,
    lines,
    total,
    linear,
    not_included: notIncluded,
    warnings,
  };
}

/**
 * The estimate for every product behind a look (verified ones only, unless the
 * operator asks for drafts). An empty list means no product can be estimated:
 * a look alone never produces quantities.
 * @param {Measured} m
 * @param {string} visualId
 * @param {{ allowancePct?: number, drafts?: boolean, products?: Product[] }} [opts]  products: instead of the catalogue's (tests)
 */
function estimateForVisual(m, visualId, opts) {
  const o = opts || {};
  const all = o.products || require("./catalogue.js").productsFor(visualId, { drafts: true });
  return all.filter((p) => p.visual_id === visualId && (o.drafts || p.spec.status === "verified")).map((p) => estimate(m, p, o));
}

module.exports = { estimate, estimateForVisual, coverageAt, ALWAYS_NOT_INCLUDED };
