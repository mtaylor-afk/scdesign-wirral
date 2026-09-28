// WV Roofing — the manufacturers' products behind the looks (B1; plan D12).
//
//   public/WVROOFING/data/catalogue.json (v2)   the eight looks (core.js VISUALS):
//       swatches, previews, prompts. A look never produces a quantity or a price.
//   serverlib/wvroofing/products.json (server only, never served)   real
//       manufacturers' products, each linked to a look, each with a specification:
//       coverage per m² (fixed, or by pitch band), the minimum pitch, the pack size,
//       the default allowance and, optionally, a figure per metre by edge kind.
//
// A specification is "draft" until the roofer checks it against the datasheet and
// marks it "verified" (verified_by, verified_at). Drafts are only ever shown on the
// operator screen; customers see quantities from verified products only.
"use strict";

const { CATALOGUE, VISUALS } = require("./core.js");
const PRODUCTS_DOC = require("./products.json");

const EDGE_KINDS = ["ridge", "hip", "valley", "eaves", "verge", "abutment"];

/**
 * @typedef {{ min_pitch_deg: number | null, max_pitch_deg: number | null, headlap_mm?: number | null, gauge_mm?: number | null, units_per_m2: number }} CoverageRow
 * @typedef {{ type: "fixed", units_per_m2: number, gauge_mm?: number | null, note?: string } | { type: "by_pitch", rows: CoverageRow[], note?: string }} Coverage
 * @typedef {{ units_per_m: number, product?: string, source_url?: string }} PerMetre
 * @typedef {object} Spec
 * @property {"draft" | "verified"} status
 * @property {number} version
 * @property {string} unit                 e.g. "slate", "tile"
 * @property {Coverage} coverage
 * @property {number | null} min_pitch_deg
 * @property {number} pack_size            units per pack (1 = sold singly)
 * @property {string} [pack_name]
 * @property {number} allowance_default_pct
 * @property {Partial<Record<string, PerMetre>>} [per_metre]   by edge kind
 * @property {string} source_url
 * @property {string} source_date          when the source was checked, YYYY-MM-DD
 * @property {string | null} verified_by
 * @property {string | null} verified_at
 * @typedef {{ id: string, visual_id: string, manufacturer: string, product: string, colour: string | null, spec: Spec, [k: string]: any }} Product
 */

/** @param {unknown} n */
function positive(n) {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** @param {unknown} n */
function pitchOrNull(n) {
  return n === null || (typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 90);
}

/**
 * Everything wrong with one product's entry (empty when it's usable).
 * @param {any} p
 * @param {Map<string, any>} visuals
 * @returns {string[]}
 */
function problemsWith(p, visuals) {
  /** @type {string[]} */
  const out = [];
  const where = (p && p.id) || "(no id)";
  const add = (/** @type {string} */ m) => out.push(where + ": " + m);
  if (!p || typeof p !== "object") return ["(not an object)"];
  if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(String(p.id || ""))) add("id");
  if (!visuals.has(p.visual_id)) add("visual_id " + p.visual_id + " isn't a look");
  for (const k of ["manufacturer", "product"]) if (!p[k] || typeof p[k] !== "string") add(k);
  const s = p.spec;
  if (!s || typeof s !== "object") return out.concat([where + ": spec"]);
  if (s.status !== "draft" && s.status !== "verified") add("spec.status");
  if (!Number.isInteger(s.version) || s.version < 1) add("spec.version");
  if (!s.unit || typeof s.unit !== "string") add("spec.unit");
  if (!/^https:\/\//.test(String(s.source_url || ""))) add("spec.source_url");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s.source_date || ""))) add("spec.source_date");
  if (!Number.isInteger(s.pack_size) || s.pack_size < 1) add("spec.pack_size");
  if (typeof s.allowance_default_pct !== "number" || s.allowance_default_pct < 0 || s.allowance_default_pct > 30) add("spec.allowance_default_pct");
  if (!pitchOrNull(s.min_pitch_deg)) add("spec.min_pitch_deg");
  const c = s.coverage;
  if (!c || (c.type !== "fixed" && c.type !== "by_pitch")) add("spec.coverage.type");
  else if (c.type === "fixed" && !positive(c.units_per_m2)) add("spec.coverage.units_per_m2");
  else if (c.type === "by_pitch") {
    if (!Array.isArray(c.rows) || !c.rows.length) add("spec.coverage.rows");
    else {
      for (const r of c.rows) {
        if (!positive(r.units_per_m2) || !pitchOrNull(r.min_pitch_deg) || !pitchOrNull(r.max_pitch_deg)) add("spec.coverage.rows: bad row");
        else if (r.min_pitch_deg !== null && r.max_pitch_deg !== null && r.min_pitch_deg > r.max_pitch_deg) add("spec.coverage.rows: min above max");
      }
    }
  }
  for (const [kind, m] of Object.entries(s.per_metre || {})) {
    if (!EDGE_KINDS.includes(kind)) add("spec.per_metre." + kind + " isn't an edge kind");
    else if (!m || !positive(m.units_per_m)) add("spec.per_metre." + kind + ".units_per_m");
  }
  if (s.status === "verified" && (!s.verified_by || !/^\d{4}-\d{2}-\d{2}/.test(String(s.verified_at || "")))) add("a verified spec needs verified_by and verified_at");
  return out;
}

/**
 * Check the looks and the products: v2 looks without prices, products with
 * unique ids, each linked to a look and with a complete specification.
 * @param {any} catalogue  the public looks file
 * @param {any[]} products
 * @returns {string[]}  problems (empty when all is well)
 */
function validate(catalogue, products) {
  const visuals = new Map((catalogue.visuals || []).map((/** @type {any} */ v) => [v.id, v]));
  /** @type {string[]} */
  const out = [];
  if (catalogue.version !== 2) out.push("catalogue version isn't 2");
  if ("products" in catalogue) out.push("products belong in serverlib/wvroofing/products.json, not the public catalogue");
  if (visuals.size !== (catalogue.visuals || []).length) out.push("duplicate look ids");
  for (const v of catalogue.visuals || []) if ("price" in v) out.push(v.id + ": looks carry no price");
  const seen = new Set();
  for (const p of products || []) {
    if (seen.has(p.id)) out.push(p.id + ": duplicate product id");
    seen.add(p.id);
    out.push(...problemsWith(p, visuals));
  }
  return out;
}

const problems = validate(CATALOGUE, PRODUCTS_DOC.products);
/** The products, or none at all if any entry is faulty (the looks carry on regardless). @type {Map<string, Product>} */
const PRODUCTS = new Map(problems.length ? [] : (PRODUCTS_DOC.products || []).map((/** @type {Product} */ p) => [p.id, p]));
if (problems.length) console.error("[wvroofing] products ignored:", problems.join("; "));

/**
 * The products for a look. Customers get verified ones only; the operator can
 * also see drafts (labelled as such).
 * @param {string} visualId
 * @param {{ drafts?: boolean }} [opts]
 * @returns {Product[]}
 */
function productsFor(visualId, opts) {
  const drafts = !!(opts && opts.drafts);
  return [...PRODUCTS.values()].filter((p) => p.visual_id === visualId && (drafts || p.spec.status === "verified"));
}

module.exports = { PRODUCTS, VISUALS, EDGE_KINDS, validate, problemsWith, productsFor };
