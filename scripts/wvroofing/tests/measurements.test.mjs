// Roof measurements and the customer's estimate (B2; plan §6, brief §12–§13).
// Test environment: PGlite, local storage and the stand-ins. Operator entry and
// approval arrive in B3; here measurements are recorded through the module.
import os from "node:os";
import path from "node:path";
process.env.WVR_ENV = "test";
process.env.WVR_FS_STORAGE_DIR = path.join(os.tmpdir(), "wvr-measure-test-" + process.pid);
process.env.WVR_CAP_ENQUIRY_DELIVERY = "on";
process.env.WVR_CAP_ADDRESS_LOOKUP = "on";
process.env.WVR_CAP_AERIAL_DISPLAY = "on";
process.env.WVR_PROJECTS_PER_IP_DAILY = "1000";
process.env.WVR_DAILY_UPLOADS = "1000";
process.env.WVR_ENQUIRIES_PER_IP_HOURLY = "1000";
process.env.WVR_ADDRESS_LOOKUPS_PER_IP = "1000";
process.env.WVR_ADDRESS_LOOKUPS_DAILY = "1000";

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { load, removeTempDir, apiFor, customerJourney } from "./helpers.mjs";

const app = load("api/wvroofing/app.js");
const db = load("serverlib/wvroofing/db.js");
const jobs = load("serverlib/wvroofing/jobs.js");
const auth = load("serverlib/wvroofing/auth.js");
const geometry = load("serverlib/wvroofing/measure/geometry.js");
const measurements = load("serverlib/wvroofing/measurements.js");
const catalogue = load("serverlib/wvroofing/catalogue.js");
const api = apiFor(app);

process.env.WVR_OPERATOR_PASSWORD_HASH = auth.hashPassword(auth.TEST_OPERATOR_PASSWORD);

after(async () => {
  await jobs.drain();
  await db.reset();
  removeTempDir(process.env.WVR_FS_STORAGE_DIR);
});

// A verified product for the slate-effect look, for these tests only.
const TEST_PRODUCT = {
  id: "test-verified-tile",
  visual_id: "slate-effect-grey",
  manufacturer: "Testco",
  product: "Slate-look tile",
  colour: "Smooth Grey",
  spec: {
    status: "verified",
    version: 1,
    unit: "tile",
    coverage: { type: "fixed", units_per_m2: 10 },
    min_pitch_deg: 17.5,
    pack_size: 1,
    allowance_default_pct: 5,
    per_metre: { ridge: { units_per_m: 2.2, product: "Test ridge" } },
    source_url: "https://example.com/datasheet.pdf",
    source_date: "2026-09-28",
    verified_by: "Test roofer",
    verified_at: "2026-09-28",
  },
};

const FACES = [
  { id: "front", plan_area_m2: 40, pitch_deg: 35 },
  { id: "back", plan_area_m2: 40, pitch_deg: 35 },
];

async function projectRow(id) {
  return (await db.query("SELECT * FROM wvr_projects WHERE id = $1", [id])).rows[0];
}

async function record(projectId, over) {
  const p = await projectRow(projectId);
  return db.tx((t) => measurements.create(t, p, Object.assign({ source: "operator_manual", method: "site_survey", faces: FACES, edges: [{ id: "r1", kind: "ridge", length_m: 9.5 }], source_date: "2026-09-20", created_by: "test" }, over || {})));
}

async function approve(measurementId, visible = true) {
  await db.query("UPDATE wvr_measurements SET approved_by = 'Test roofer', approved_at = now(), status = 'indicative_available', customer_visible = $2 WHERE id = $1", [measurementId, visible]);
}

const estimate = async (p, visual = "slate-effect-grey") => (await api("GET", "projects/" + p.id + "/estimate?visual=" + visual, { token: p.token })).json.estimate;

// ---------------------------------------------------------------------------
// the geometry

test("80 m² of plan at 35° is stored at full precision (97.66 m²) and shown as ≈ 98 m²", () => {
  const { faces } = geometry.checkFaces([{ id: "a", plan_area_m2: 80, pitch_deg: 35 }]);
  assert.ok(Math.abs(faces[0].surface_area_m2 - 97.66) < 0.005, String(faces[0].surface_area_m2));
  assert.notEqual(faces[0].surface_area_m2, 97.66, "full precision, not rounded");
  assert.equal(faces[0].slope_adjusted_by_source, false, "worked out here");
  assert.equal(geometry.wholeM2(faces[0].surface_area_m2), 98);
  const view = geometry.customerView({ faces, method: "site_survey", source_date: "2026-09-20", gross_surface_m2: geometry.grossSurface(faces) });
  assert.equal(view.area_m2, 98);
  assert.equal(view.pitch, "35°");
});

test("an area the source gave on the slope is never corrected again", () => {
  const { faces } = geometry.checkFaces([{ id: "a", surface_area_m2: 100, pitch_deg: 35, slope_adjusted_by_source: true }]);
  assert.equal(faces[0].surface_area_m2, 100);
  assert.equal(faces[0].slope_adjusted_by_source, true);
});

test("a roof with several pitches (4+ faces) adds up face by face", () => {
  const { ok, faces } = geometry.checkFaces([
    { id: "main-front", plan_area_m2: 30, pitch_deg: 35 },
    { id: "main-back", plan_area_m2: 30, pitch_deg: 35 },
    { id: "hip-end", plan_area_m2: 12, pitch_deg: 45 },
    { id: "extension", surface_area_m2: 8.4, slope_adjusted_by_source: true, pitch_deg: 15 },
    { id: "garage", plan_area_m2: 14, pitch_deg: 5, included: false },
  ]);
  assert.equal(ok, true);
  const want = (30 / Math.cos((35 * Math.PI) / 180)) * 2 + 12 / Math.cos((45 * Math.PI) / 180) + 8.4;
  assert.ok(Math.abs(geometry.grossSurface(faces) - want) < 1e-9, "the garage is out of scope");
  const view = geometry.customerView({ faces, method: "drawings", source_date: "2025-03-01", gross_surface_m2: geometry.grossSurface(faces) });
  assert.equal(view.pitch, "15–45°");
  assert.equal(view.faces, 4);
  assert.match(view.label, /^Measured by the roofer from the property's drawings on 1 March 2025$/);
  assert.doesNotMatch(view.label, /aerial/i, "never 'aerial'");
  assert.equal(view.changes_since_year, 2025);
});

test("faces are checked: unique ids, areas above 0, pitch 0–75° or unknown; missing values stay null", () => {
  const dup = geometry.checkFaces([{ id: "a", plan_area_m2: 10, pitch_deg: 30 }, { id: "a", plan_area_m2: 12, pitch_deg: 30 }]);
  assert.equal(dup.ok, false);
  assert.ok(dup.problems.some((p) => /duplicate/.test(p)));
  assert.equal(geometry.checkFaces([{ id: "a", plan_area_m2: 0, pitch_deg: 30 }]).ok, false);
  assert.equal(geometry.checkFaces([{ id: "a", plan_area_m2: 10, pitch_deg: 80 }]).ok, false);
  assert.equal(geometry.checkFaces([]).ok, false);
  const noPitch = geometry.checkFaces([{ id: "a", plan_area_m2: 10 }]);
  assert.equal(noPitch.ok, true);
  assert.equal(noPitch.faces[0].pitch_deg, null);
  assert.equal(noPitch.faces[0].surface_area_m2, null, "no pitch, no surface area: null, never 0");
  assert.equal(geometry.grossSurface(noPitch.faces), null);
  const a = geometry.assess({ faces: noPitch.faces, source: "operator_manual", method: "site_survey", source_date: null });
  assert.equal(a.status, "needs_review");
  assert.deepEqual(a.reasons, ["pitch_unknown"]);
});

test("edges are entered lengths, of known kinds, on known faces", () => {
  const { faces } = geometry.checkFaces(FACES);
  assert.equal(geometry.checkEdges([{ id: "r", kind: "ridge", length_m: 9.5, face_ids: ["front", "back"] }], faces).ok, true);
  assert.equal(geometry.checkEdges([{ id: "g", kind: "gutter", length_m: 9 }], faces).ok, false);
  assert.equal(geometry.checkEdges([{ id: "r", kind: "ridge", length_m: 0 }], faces).ok, false);
  assert.equal(geometry.checkEdges([{ id: "r", kind: "ridge", length_m: 5, face_ids: ["nope"] }], faces).ok, false);
});

test("a roof found from map coordinates needs rooftop-accurate ones; a site survey settles the scope", () => {
  const { faces } = geometry.checkFaces(FACES);
  for (const coordSource of ["postcode_centroid", "none"]) {
    const a = geometry.assess({ faces, source: "desk_measure", method: "desk_estimate", source_date: "2026-01-01" }, { coordSource });
    assert.equal(a.status, "needs_review", coordSource);
    assert.ok(a.reasons.includes("no_rooftop_coordinate"), coordSource);
  }
  const survey = geometry.assess({ faces, source: "operator_manual", method: "site_survey", source_date: "2026-01-01" }, { coordSource: "none", confirmationReasons: ["shared_roof"] });
  assert.deepEqual(survey, { status: "indicative_available", reasons: [] });
  const drawings = geometry.assess({ faces, source: "operator_manual", method: "drawings", source_date: "2026-01-01" }, { confirmationReasons: ["shared_roof", "property_type_unclear"] });
  assert.deepEqual(drawings.reasons, ["shared_roof", "ambiguous_scope"]);
  const old = geometry.assess({ faces, source: "hover", method: "hover_report", source_date: "2019-05-01" }, { now: new Date("2026-09-28") });
  assert.deepEqual(old.reasons, ["source_outdated"]);
  const flagged = geometry.checkFaces([{ id: "a", plan_area_m2: 20, pitch_deg: 30, flags: ["tree_cover", "nonsense"] }]);
  assert.deepEqual(flagged.faces[0].flags, ["tree_cover"]);
  assert.deepEqual(geometry.assess({ faces: flagged.faces, source: "desk_measure", method: "desk_estimate", source_date: null }, { coordSource: "rooftop" }).reasons, ["tree_cover"]);
});

// ---------------------------------------------------------------------------
// the customer's estimate

test("no measurement: the estimate says so, with the brief's not-included list", async () => {
  const j = await customerJourney(api, { enquiry: false });
  const e = await estimate(j.p);
  assert.equal(e.status, "unavailable");
  assert.equal(e.reason, "no_measurement");
  assert.equal(e.measurement, null);
  assert.deepEqual(e.not_included, ["ridges", "hips", "valleys", "verges", "flashings", "gutters", "fixings"]);
  assert.equal((await api("GET", "projects/" + j.p.id + "/estimate?visual=castle", { token: j.p.token })).status, 400);
  assert.equal((await api("GET", "projects/" + j.p.id + "/estimate?visual=welsh-slate", {})).status, 401, "the project's key is needed");
});

test("the customer sees a measurement only once it's approved and made visible", async () => {
  const j = await customerJourney(api, { enquiry: false });
  const { measurement: m } = await record(j.p.id);
  assert.equal(m.status, "indicative_available");
  assert.equal((await estimate(j.p)).status, "processing", "recorded, not yet approved");
  await approve(m.id, false);
  const notShown = await estimate(j.p);
  assert.equal(notShown.status, "measured_not_shown", "approved, but its figures aren't for showing online");
  assert.equal(notShown.measurement, null, "no figures");
  await approve(m.id, true);
  const e = await estimate(j.p);
  assert.equal(e.status, "indicative_available");
  assert.equal(e.measurement.area_m2, 98, "80 m² of plan at 35°, in whole m²");
  assert.equal(e.measurement.faces, 2);
  assert.match(e.measurement.label, /^Measured by the roofer from a site survey on 20 September 2026$/);
  assert.equal(e.measurement.changes_since_year, 2026);
  assert.equal(e.reason, "no_verified_product", "no product for this look is verified: no quantities");
  assert.deepEqual(e.products, []);
  assert.ok(!JSON.stringify(e).includes("97.6"), "no unrounded figures reach the customer");
  const noLook = (await api("GET", "projects/" + j.p.id + "/estimate", { token: j.p.token })).json.estimate;
  assert.equal(noLook.status, "indicative_available", "the roof's size doesn't depend on the look");
  assert.equal(noLook.measurement.area_m2, 98);
  assert.equal(noLook.reason, "no_look_chosen");
});

test("with a verified product: quantities, the allowance, a ridge from its entered length, and what isn't included", async () => {
  catalogue.PRODUCTS.set(TEST_PRODUCT.id, TEST_PRODUCT);
  try {
    const j = await customerJourney(api, { enquiry: false });
    const { measurement: m } = await record(j.p.id);
    await approve(m.id);
    const e = await estimate(j.p);
    assert.equal(e.products.length, 1);
    const p = e.products[0];
    assert.equal(p.name, "Testco Slate-look tile, Smooth Grey");
    assert.equal(p.total.allowance_pct, 5);
    const surface = (40 / Math.cos((35 * Math.PI) / 180)) * 2;
    assert.equal(p.total.units, Math.ceil(surface * 10 * 1.05 - 1e-9));
    assert.deepEqual(p.linear, [{ kind: "ridge", length_m: 9.5, units: 21, product: "Test ridge" }]);
    assert.ok(!e.not_included.includes("ridges"), "the ridge was estimated");
    for (const w of ["hips", "valleys", "verges", "flashings", "gutters", "fixings", "underlay", "battens"]) assert.ok(e.not_included.includes(w), w);
    const other = await estimate(j.p, "welsh-slate");
    assert.deepEqual(other.products, [], "a look without a verified product has no quantities");
    const draft = Object.assign({}, TEST_PRODUCT, { id: "test-draft", spec: Object.assign({}, TEST_PRODUCT.spec, { status: "draft", verified_by: null, verified_at: null }) });
    catalogue.PRODUCTS.set(draft.id, draft);
    assert.equal((await estimate(j.p)).products.length, 1, "drafts never reach the customer");
  } finally {
    catalogue.PRODUCTS.delete(TEST_PRODUCT.id);
    catalogue.PRODUCTS.delete("test-draft");
  }
});

test("a new measurement supersedes the old; a new address supersedes them all", async () => {
  const j = await customerJourney(api, { enquiry: false });
  const first = await record(j.p.id);
  const second = await record(j.p.id, { faces: [{ id: "all", surface_area_m2: 120, slope_adjusted_by_source: true, pitch_deg: 40 }] });
  assert.deepEqual(second.superseded, [first.measurement.id]);
  const old = (await db.query("SELECT superseded_by FROM wvr_measurements WHERE id = $1", [first.measurement.id])).rows[0];
  assert.equal(old.superseded_by, second.measurement.id, "kept, pointing at its replacement");
  await approve(second.measurement.id);
  assert.equal((await estimate(j.p)).measurement.area_m2, 120);
  const l = await api("POST", "projects/" + j.p.id + "/address/lookup", { token: j.p.token, body: { postcode: "CH45 1AB" } });
  const other = l.json.addresses.find((x) => x.label.startsWith("7 Test Road"));
  assert.equal((await api("POST", "projects/" + j.p.id + "/address", { token: j.p.token, body: { token: other.token } })).status, 200);
  const e = await estimate(j.p);
  assert.equal(e.status, "unavailable", "the measurement was of the old address");
  assert.equal((await db.query("SELECT count(*)::int AS n FROM wvr_measurements WHERE project_id = $1 AND superseded_at IS NULL", [j.p.id])).rows[0].n, 0);
});

test("the operator's scope correction sends the measurement back for review and hides it", async () => {
  const j = await customerJourney(api, { enquiry: true });
  const { measurement: m } = await record(j.p.id);
  await approve(m.id);
  assert.equal((await estimate(j.p)).status, "indicative_available");
  const login = await api("POST", "operator/login", { body: { password: auth.TEST_OPERATOR_PASSWORD }, ip: "203.0.113.200" });
  const r = await api("POST", "operator/enquiries/" + j.id + "/scope", { token: login.json.token, body: { propertyType: "end_terrace", notes: "Checked." } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const row = (await db.query("SELECT status, reasons, customer_visible FROM wvr_measurements WHERE id = $1", [m.id])).rows[0];
  assert.equal(row.status, "needs_review");
  assert.ok(row.reasons.includes("ambiguous_scope"));
  assert.equal(row.customer_visible, false);
  assert.equal((await estimate(j.p)).status, "processing", "the customer sees it's being checked, not the old figures");
  const trail = (await db.query("SELECT after FROM wvr_operator_actions WHERE action = 'scope_corrected' AND target_id = $1", [j.p.id])).rows[0];
  assert.equal(trail.after.measurementBackForReview, m.id, "the history says so");
});

test("an enquiry keeps the measurement and quantities the customer could see when they sent it", async () => {
  catalogue.PRODUCTS.set(TEST_PRODUCT.id, TEST_PRODUCT);
  try {
    const j = await customerJourney(api, { enquiry: false });
    const { measurement: m } = await record(j.p.id);
    await approve(m.id);
    const e = await api("POST", "projects/" + j.p.id + "/enquiry", {
      token: j.p.token,
      body: { name: "Sam Test", email: "sam@example.com", consent: true, elapsedMs: 9000, idempotencyKey: "measurekey-0001", product: "slate-effect-grey" },
    });
    assert.equal(e.status, 201, JSON.stringify(e.json));
    const snap = (await db.query("SELECT snapshot FROM wvr_enquiries WHERE reference = $1", [e.json.reference])).rows[0].snapshot;
    assert.equal(snap.measurement.id, m.id);
    assert.equal(snap.measurement.shown.area_m2, 98);
    assert.equal(snap.quantities[0].name, "Testco Slate-look tile, Smooth Grey");
  } finally {
    catalogue.PRODUCTS.delete(TEST_PRODUCT.id);
  }
  const hidden = await customerJourney(api, { enquiry: false });
  await record(hidden.p.id);
  const e2 = await api("POST", "projects/" + hidden.p.id + "/enquiry", {
    token: hidden.p.token,
    body: { name: "Sam Test", email: "sam@example.com", consent: true, elapsedMs: 9000, idempotencyKey: "measurekey-0002", product: "slate-effect-grey" },
  });
  const snap2 = (await db.query("SELECT snapshot FROM wvr_enquiries WHERE reference = $1", [e2.json.reference])).rows[0].snapshot;
  assert.equal(snap2.measurement, null, "one the customer couldn't see isn't recorded as shown");
});
