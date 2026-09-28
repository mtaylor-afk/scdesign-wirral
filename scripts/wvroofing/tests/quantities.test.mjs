// Material quantities from a measured roof (B1; plan D12, brief §13). Pure functions
// over made-up specifications, so the rules are tested apart from any real product.
process.env.WVR_ENV = "test";

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { load, repo } from "./helpers.mjs";

const Q = load("serverlib/wvroofing/quantities.js");
const catalogue = load("serverlib/wvroofing/catalogue.js");

/** A made-up product. */
function product(o = {}) {
  return {
    id: o.id || "test-tile",
    visual_id: o.visual_id || "slate-effect-grey",
    manufacturer: o.manufacturer || "Testco",
    product: o.product || "Test tile",
    colour: o.colour === undefined ? "Grey" : o.colour,
    spec: Object.assign(
      {
        status: "verified",
        version: 1,
        unit: "tile",
        coverage: { type: "fixed", units_per_m2: 10 },
        min_pitch_deg: 17.5,
        pack_size: 1,
        allowance_default_pct: 0,
        source_url: "https://example.com/datasheet.pdf",
        source_date: "2026-09-28",
        verified_by: "Test roofer",
        verified_at: "2026-09-28",
      },
      o.spec || {}
    ),
  };
}

const BY_PITCH = {
  type: "by_pitch",
  rows: [
    { min_pitch_deg: 20, max_pitch_deg: 25, headlap_mm: 100, gauge_mm: 200, units_per_m2: 19.6 },
    { min_pitch_deg: 25, max_pitch_deg: 30, headlap_mm: 90, gauge_mm: 205, units_per_m2: 19.1 },
    { min_pitch_deg: 30, max_pitch_deg: 90, headlap_mm: 75, gauge_mm: 212, units_per_m2: 18.5 },
  ],
};

const face = (id, surface_m2, pitch_deg, extra) => Object.assign({ id, surface_m2, pitch_deg }, extra || {});

function deepFreeze(o) {
  Object.freeze(o);
  for (const v of Object.values(o)) if (v && typeof v === "object" && !Object.isFrozen(v)) deepFreeze(v);
  return o;
}

test("the formula: each face's area times the product's coverage, at full precision", () => {
  const e = Q.estimate({ faces: [face("f1", 50, 35), face("f2", 12.345, 35)] }, product());
  assert.equal(e.lines[0].units_before_rounding, 500);
  assert.equal(e.lines[1].units_before_rounding, 123.45, "no rounding per face");
  assert.equal(e.lines[0].units_per_m2_applied, 10);
  assert.equal(e.total.units_before_allowance, 623.45);
  assert.equal(e.total.units, 624, "rounded up once, at the end");
  assert.equal(e.complete, true);
});

test("rounding to packs happens after adding the faces up: two faces at 0.4 of a pack need 1 pack", () => {
  const p = product({ spec: { pack_size: 100 } });
  const e = Q.estimate({ faces: [face("front", 4, 35), face("back", 4, 35)] }, p);
  assert.deepEqual(
    e.lines.map((l) => l.units_before_rounding / 100),
    [0.4, 0.4]
  );
  assert.equal(e.total.units, 80);
  assert.equal(e.total.packs, 1, "not 2");
  assert.equal(e.total.pack_size, 100);
});

test("the allowance is applied once, to the total, and shown", () => {
  const p = product({ spec: { allowance_default_pct: 5 } });
  const e = Q.estimate({ faces: [face("f1", 50, 35), face("f2", 30, 35)] }, p);
  assert.ok(
    e.lines.every((l) => l.units_before_rounding === l.surface_m2 * 10),
    "no allowance on the face lines"
  );
  assert.equal(e.total.units_before_allowance, 800);
  assert.equal(e.total.allowance_pct, 5);
  assert.equal(e.total.units_with_allowance, 840);
  assert.equal(e.total.units, 840);
  const custom = Q.estimate({ faces: [face("f1", 50, 35)] }, p, { allowancePct: 10 });
  assert.equal(custom.total.allowance_pct, 10);
  assert.equal(custom.total.units, 550);
});

test("choosing another product calculates again without touching the measurement", () => {
  const m = deepFreeze({ faces: [face("f1", 40, 35), face("f2", 40, 35)], edges: [{ id: "e1", kind: "ridge", length_m: 8 }] });
  const copy = JSON.parse(JSON.stringify(m));
  const a = Q.estimate(m, product({ id: "a", product: "Tile A" }));
  const b = Q.estimate(m, product({ id: "b", product: "Tile B", spec: { coverage: { type: "fixed", units_per_m2: 15.5 } } }));
  assert.notEqual(a.total.units, b.total.units);
  assert.deepEqual(m, copy, "the measurement is unchanged");
});

test("a look on its own never produces units; drafts only when the operator asks", () => {
  const m = { faces: [face("f1", 50, 35)] };
  assert.deepEqual(Q.estimateForVisual(m, "welsh-slate", { products: [] }), [], "no product, no quantities");
  const draft = product({ visual_id: "welsh-slate", spec: { status: "draft", verified_by: null, verified_at: null } });
  assert.deepEqual(Q.estimateForVisual(m, "welsh-slate", { products: [draft] }), [], "customers never get a draft's figures");
  const direct = Q.estimate(m, draft);
  assert.equal(direct.total, null);
  assert.equal(direct.lines[0].status, "no_verified_product");
  assert.equal(direct.complete, false);
  const forOperator = Q.estimateForVisual(m, "welsh-slate", { products: [draft], drafts: true });
  assert.equal(forOperator.length, 1);
  assert.equal(forOperator[0].spec_status, "draft", "labelled as a draft");
  assert.equal(forOperator[0].total.units, 500);
});

test("two verified products on one look give different totals, each labelled with its product", () => {
  const m = { faces: [face("f1", 60, 35)] };
  const products = [
    product({ id: "a", manufacturer: "Maker A", product: "Slate-look tile", colour: "Smooth Grey" }),
    product({ id: "b", manufacturer: "Maker B", product: "Thin-edge tile", colour: "Slate Grey", spec: { coverage: { type: "fixed", units_per_m2: 9.7 } } }),
    product({ id: "c", visual_id: "welsh-slate" }),
  ];
  const out = Q.estimateForVisual(m, "slate-effect-grey", { products });
  assert.deepEqual(
    out.map((e) => e.product_name),
    ["Maker A Slate-look tile, Smooth Grey", "Maker B Thin-edge tile, Slate Grey"]
  );
  assert.notEqual(out[0].total.units, out[1].total.units);
});

test("coverage that depends on pitch: the right band, and needs_pitch when the pitch isn't known (no default)", () => {
  const p = product({ spec: { coverage: BY_PITCH, min_pitch_deg: 20 } });
  const e = Q.estimate({ faces: [face("a", 10, 22.5), face("b", 10, 25), face("c", 10, 45), face("d", 10, null), face("e", 10, 15)] }, p);
  const by = Object.fromEntries(e.lines.map((l) => [l.face_id, l]));
  assert.equal(by.a.units_per_m2_applied, 19.6);
  assert.equal(by.b.units_per_m2_applied, 19.1, "a band starts at its minimum");
  assert.equal(by.c.units_per_m2_applied, 18.5);
  assert.equal(by.d.status, "needs_pitch");
  assert.equal(by.d.units_before_rounding, null, "no default pitch is used");
  assert.equal(by.d.units_per_m2_applied, null);
  assert.equal(by.e.status, "below_min_pitch");
  assert.equal(e.complete, false, "part of the roof couldn't be estimated");
  assert.equal(e.total.surface_m2, 30, "the total covers only the faces that could be");
  const noMin = product({ spec: { coverage: BY_PITCH, min_pitch_deg: null } });
  assert.equal(Q.estimate({ faces: [face("low", 10, 15)] }, noMin).lines[0].status, "outside_published_range");
  assert.equal(Q.estimate({ faces: [face("top", 10, 90)] }, noMin).lines[0].units_per_m2_applied, 18.5, "the top band includes its maximum");
});

test("a fixed coverage figure works without a pitch, with a warning to check the minimum pitch", () => {
  const e = Q.estimate({ faces: [face("f1", 20, null)] }, product());
  assert.equal(e.lines[0].status, "ok");
  assert.equal(e.total.units, 200);
  assert.match(e.warnings[0], /isn't known: check it's at least 17\.5°/);
});

test("faces left out of the scope are skipped; a face without an area stops the estimate being complete", () => {
  const e = Q.estimate({ faces: [face("main", 30, 35), face("garage", 12, 10, { included: false })] }, product());
  assert.equal(e.lines[1].status, "excluded");
  assert.equal(e.total.units, 300);
  assert.equal(e.complete, true, "an excluded face isn't missing");
  const gap = Q.estimate({ faces: [face("main", 30, 35), face("rear", null, 35)] }, product());
  assert.equal(gap.lines[1].status, "no_area");
  assert.equal(gap.complete, false);
});

test("no edges entered: nothing linear, and every edge kind is listed as not included", () => {
  const p = product({ spec: { per_metre: { ridge: { units_per_m: 2.2 } } } });
  const e = Q.estimate({ faces: [face("f1", 80, 35)] }, p);
  assert.deepEqual(e.linear, [], "never worked out from areas or perimeters");
  const missing = e.not_included.filter((n) => n.reason === "no length has been entered").map((n) => n.item);
  assert.deepEqual(missing, ["ridge", "hip", "valley", "eaves", "verge", "abutment"]);
  for (const always of ["flashings", "gutters", "fixings", "underlay and battens"]) assert.ok(e.not_included.some((n) => n.item === always), always);
});

test("an entered length with a per-metre figure is estimated; without the figure it still isn't", () => {
  const edges = [
    { id: "r1", kind: "ridge", length_m: 5.5 },
    { id: "r2", kind: "ridge", length_m: 4 },
    { id: "h1", kind: "hip", length_m: 6 },
  ];
  const p = product({ spec: { per_metre: { ridge: { units_per_m: 2.2, product: "Test ridge" } } } });
  const e = Q.estimate({ faces: [face("f1", 50, 35)], edges }, p);
  assert.deepEqual(e.linear, [{ kind: "ridge", length_m: 9.5, units_per_m: 2.2, units: 21, product: "Test ridge" }], "ridge lengths added up, then rounded up once");
  const hip = e.not_included.find((n) => n.item === "hip");
  assert.equal(hip.reason, "there's no per-metre figure for this product");
  const none = Q.estimate({ faces: [face("f1", 50, 35)], edges }, product());
  assert.deepEqual(none.linear, []);
});

test("the pre-filled specifications: every look has one, all are drafts with their sources, none reaches customers", () => {
  const all = [...catalogue.PRODUCTS.values()];
  assert.equal(new Set(all.map((p) => p.visual_id)).size, 8, "every look has at least one product");
  for (const p of all) {
    assert.equal(p.spec.status, "draft", p.id + " stays a draft until the roofer verifies it");
    assert.equal(p.spec.verified_by, null, p.id);
    assert.ok(Array.isArray(p.sources) && p.sources.length && p.sources.every((s) => /^https:\/\//.test(s.url)), p.id + " lists its sources");
    const rows = p.spec.coverage.type === "by_pitch" ? p.spec.coverage.rows : [];
    for (const r of rows) assert.ok(["printed", "manufacturer formula"].includes(r.basis), p.id + ": each figure says where it came from");
  }
  const roof = { faces: [{ id: "f", surface_m2: 50, pitch_deg: 35 }] };
  for (const v of new Set(all.map((p) => p.visual_id))) {
    assert.deepEqual(Q.estimateForVisual(roof, v), [], v + ": no quantities for customers from drafts");
    assert.ok(Q.estimateForVisual(roof, v, { drafts: true }).every((e) => e.spec_status === "draft" && e.total.units > 0), v + ": the operator can see the drafts");
  }
});

test("the catalogue: v2 looks without prices; products server-side only, every entry checked", () => {
  const cat = JSON.parse(fs.readFileSync(path.join(repo, "public/WVROOFING/data/catalogue.json"), "utf8"));
  const doc = JSON.parse(fs.readFileSync(path.join(repo, "serverlib/wvroofing/products.json"), "utf8"));
  assert.deepEqual(catalogue.validate(cat, doc.products), []);
  assert.equal(cat.version, 2);
  assert.equal(cat.visuals.length, 8);
  assert.ok(!("products" in cat), "the public file carries no products or draft figures");
  assert.equal(catalogue.PRODUCTS.size, doc.products.length, "every product loaded");
  const looks = new Map(cat.visuals.map((v) => [v.id, v]));
  const bad = [
    product({ visual_id: "no-such-look" }),
    product({ spec: { status: "verified", verified_by: null } }),
    product({ spec: { coverage: { type: "by_pitch", rows: [{ min_pitch_deg: 30, max_pitch_deg: 20, units_per_m2: 10 }] } } }),
    product({ spec: { source_url: "http://insecure.example" } }),
    product({ spec: { per_metre: { gutter: { units_per_m: 1 } } } }),
    product({ spec: { pack_size: 0 } }),
  ];
  for (const b of bad) assert.ok(catalogue.problemsWith(b, looks).length > 0, JSON.stringify(b.spec).slice(0, 80));
  assert.deepEqual(catalogue.problemsWith(product(), looks), [], "a good entry passes");
  assert.ok(catalogue.validate(Object.assign({}, cat, { visuals: cat.visuals.map((v) => Object.assign({ price: 2 }, v)) }), []).length > 0, "a price on a look is refused");
  assert.ok(catalogue.validate(Object.assign({}, cat, { products: [] }), []).length > 0, "products in the public file are refused");
  assert.ok(catalogue.validate(cat, [product({ id: "dup" }), product({ id: "dup" })]).some((m) => /duplicate/.test(m)));
});
