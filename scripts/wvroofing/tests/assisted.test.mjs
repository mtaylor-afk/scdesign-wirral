// Assisted measurement (B3; plan §6 B3): the roofer enters, approves, rejects and
// shows measurements; customers add plans and drawings; the Hover template.
import os from "node:os";
import path from "node:path";
process.env.WVR_ENV = "test";
process.env.WVR_FS_STORAGE_DIR = path.join(os.tmpdir(), "wvr-assisted-test-" + process.pid);
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
const images = load("serverlib/wvroofing/images.js");
const hover = load("serverlib/wvroofing/measure/hover.js");
const geometry = load("serverlib/wvroofing/measure/geometry.js");
const { storage } = load("serverlib/wvroofing/storage.js");
const api = apiFor(app);

process.env.WVR_OPERATOR_PASSWORD_HASH = auth.hashPassword(auth.TEST_OPERATOR_PASSWORD);

after(async () => {
  await jobs.drain();
  await db.reset();
  removeTempDir(process.env.WVR_FS_STORAGE_DIR);
});

let ipN = 0;
async function login() {
  const r = await api("POST", "operator/login", { body: { password: auth.TEST_OPERATOR_PASSWORD }, ip: "198.51.100." + ++ipN });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json.token;
}

const SURVEY = {
  method: "site_survey",
  sourceDate: "2026-09-20",
  faces: [
    { id: "front", plan_area_m2: 40, pitch_deg: 35 },
    { id: "back", plan_area_m2: 40, pitch_deg: 35 },
  ],
  edges: [{ id: "ridge", kind: "ridge", length_m: 9.5, face_ids: ["front", "back"] }],
  notes: "Measured on site.",
};

const estimate = async (j, visual = "slate-effect-grey") => (await api("GET", "projects/" + j.p.id + "/estimate?visual=" + visual, { token: j.p.token })).json.estimate;
const actions = async (targetId) => (await db.query("SELECT action FROM wvr_operator_actions WHERE target_id = $1 ORDER BY id", [targetId])).rows.map((r) => r.action);

// ---------------------------------------------------------------------------

test("the roofer's survey: added, approved, shown with a label that never says 'aerial'; every step audited", async () => {
  const t = await login();
  const j = await customerJourney(api, { propertyType: "detached" });
  const add = await api("POST", "operator/enquiries/" + j.id + "/measurement", { token: t, body: SURVEY });
  assert.equal(add.status, 201, JSON.stringify(add.json));
  const m = add.json.measurement;
  assert.equal(m.status, "indicative_available");
  assert.ok(Math.abs(m.grossSurfaceM2 - 2 * (40 / Math.cos((35 * Math.PI) / 180))) < 1e-9, "full precision for the operator");
  assert.equal(m.shown.area_m2, 98, "what the customer would see");
  assert.equal(m.canShow, true);
  assert.equal((await estimate(j)).status, "processing", "not approved yet");
  const ok = await api("POST", "operator/measurements/" + m.id + "/approve", { token: t });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.measurement.customerVisible, true, "the roofer's own survey is shown straight away");
  const e = await estimate(j);
  assert.equal(e.status, "indicative_available");
  assert.equal(e.measurement.label, "Measured by the roofer from a site survey on 20 September 2026");
  for (const method of geometry.METHODS) {
    const label = geometry.customerView({ faces: [], method, source_date: "2026-01-01", gross_surface_m2: null }).label;
    assert.doesNotMatch(label, /aerial|satellite/i, method);
  }
  assert.deepEqual(await actions(m.id), ["measurement_added", "measurement_approved"]);
  const detail = await api("GET", "operator/enquiries/" + j.id, { token: t });
  assert.equal(detail.json.project.measurements[0].id, m.id);
  assert.ok(detail.json.audit.some((a) => a.action === "measurement_approved"), "in the enquiry's history");
  const q = detail.json.project.quantities;
  assert.ok(q.length >= 1 && q.every((x) => x.spec_status === "draft"), "the draft quantities for the enquiry's look, labelled");
});

test("a correction is a new measurement: the old one is kept, pointing at it, and the new one waits for approval", async () => {
  const t = await login();
  const j = await customerJourney(api, { propertyType: "detached" });
  const first = (await api("POST", "operator/enquiries/" + j.id + "/measurement", { token: t, body: SURVEY })).json.measurement;
  await api("POST", "operator/measurements/" + first.id + "/approve", { token: t });
  const fix = await api("POST", "operator/enquiries/" + j.id + "/measurement", { token: t, body: Object.assign({}, SURVEY, { faces: [{ id: "front", plan_area_m2: 42, pitch_deg: 35 }, { id: "back", plan_area_m2: 42, pitch_deg: 35 }] }) });
  assert.equal(fix.status, 201);
  const old = (await db.query("SELECT superseded_by, approved_at FROM wvr_measurements WHERE id = $1", [first.id])).rows[0];
  assert.equal(old.superseded_by, fix.json.measurement.id, "never erased");
  assert.ok(old.approved_at, "its approval stays on record");
  assert.equal((await estimate(j)).status, "processing", "the correction needs approving before the customer sees it");
  assert.equal((await api("POST", "operator/measurements/" + first.id + "/approve", { token: t })).status, 409, "the old one can't be approved again");
  const added = (await db.query("SELECT before FROM wvr_operator_actions WHERE target_id = $1 AND action = 'measurement_added'", [fix.json.measurement.id])).rows[0];
  assert.deepEqual(added.before, { superseded: [first.id] });
});

test("flagged measurements need the roofer's confirmation to approve", async () => {
  const t = await login();
  const j = await customerJourney(api, { propertyType: "semi" });
  const add = await api("POST", "operator/enquiries/" + j.id + "/measurement", { token: t, body: Object.assign({}, SURVEY, { method: "drawings" }) });
  const m = add.json.measurement;
  assert.equal(m.status, "needs_review");
  assert.deepEqual(m.reasons, ["shared_roof"], "drawings of a semi: which half is ours?");
  const unconfirmed = await api("POST", "operator/measurements/" + m.id + "/approve", { token: t });
  assert.equal(unconfirmed.status, 400);
  assert.equal(unconfirmed.json.error, "confirm_required");
  assert.deepEqual(unconfirmed.json.reasons, ["shared_roof"]);
  assert.equal((await api("POST", "operator/measurements/" + m.id + "/approve", { token: t, body: { confirm: true } })).status, 200);
  assert.equal((await estimate(j)).status, "indicative_available");
  const bad = await api("POST", "operator/enquiries/" + j.id + "/measurement", { token: t, body: Object.assign({}, SURVEY, { faces: [{ id: "a", plan_area_m2: 10 }, { id: "a", plan_area_m2: 12 }] }) });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error, "invalid_faces");
  assert.equal((await api("POST", "operator/enquiries/" + j.id + "/measurement", { token: t, body: Object.assign({}, SURVEY, { method: "aerial_guess" }) })).status, 400);
});

test("a Hover report stays hidden: its terms allow internal use only", async () => {
  const t = await login();
  const j = await customerJourney(api, { propertyType: "detached" });
  const add = await api("POST", "operator/enquiries/" + j.id + "/measurement", {
    token: t,
    body: { method: "hover_report", sourceDate: "2026-09-01", hover: { units: "imperial", total_area: 1100, pitch: "8/12", ridges: 32, hips: 0, rakes: 40, eaves: 64, flashing: 12 } },
  });
  assert.equal(add.status, 201, JSON.stringify(add.json));
  const m = add.json.measurement;
  assert.equal(m.faces.length, 1);
  assert.ok(Math.abs(m.faces[0].surface_area_m2 - 1100 * 0.09290304) < 1e-9, "ft² to m², on the slope");
  assert.equal(m.faces[0].slope_adjusted_by_source, true, "never corrected again");
  assert.ok(Math.abs(m.faces[0].pitch_deg - 33.69) < 0.01, "8/12 is about 33.7°");
  assert.deepEqual(
    m.edges.map((x) => [x.kind, Math.round(x.length_m * 100) / 100]),
    [
      ["ridge", 9.75],
      ["verge", 12.19],
      ["eaves", 19.51],
      ["abutment", 3.66],
    ]
  );
  assert.equal(m.canShow, false);
  const ok = await api("POST", "operator/measurements/" + m.id + "/approve", { token: t });
  assert.equal(ok.json.measurement.customerVisible, false);
  assert.equal((await estimate(j)).status, "measured_not_shown", "the customer is told the figures come with the quotation");
  const show = await api("POST", "operator/measurements/" + m.id + "/visibility", { token: t, body: { visible: true } });
  assert.equal(show.status, 409);
  assert.equal(show.json.error, "rights_unresolved");
  assert.match(show.json.message, /Hover/);
  assert.equal((await api("POST", "operator/enquiries/" + j.id + "/measurement", { token: t, body: { method: "site_survey", hover: { total_area: 10 } } })).status, 400, "a Hover report only with its method");
});

test("rejecting, hiding and showing; each recorded", async () => {
  const t = await login();
  const j = await customerJourney(api, { propertyType: "detached" });
  const m = (await api("POST", "operator/enquiries/" + j.id + "/measurement", { token: t, body: SURVEY })).json.measurement;
  assert.equal((await api("POST", "operator/measurements/" + m.id + "/visibility", { token: t, body: { visible: true } })).status, 409, "approve first");
  await api("POST", "operator/measurements/" + m.id + "/approve", { token: t });
  assert.equal((await api("POST", "operator/measurements/" + m.id + "/visibility", { token: t, body: { visible: false } })).status, 200);
  assert.equal((await estimate(j)).status, "measured_not_shown");
  assert.equal((await api("POST", "operator/measurements/" + m.id + "/visibility", { token: t, body: { visible: true } })).status, 200);
  assert.equal((await estimate(j)).status, "indicative_available");
  assert.equal((await api("POST", "operator/measurements/" + m.id + "/reject", { token: t, body: { notes: "Wrong house." } })).status, 200);
  const row = (await db.query("SELECT status, reasons, customer_visible, rejected_at FROM wvr_measurements WHERE id = $1", [m.id])).rows[0];
  assert.equal(row.status, "unavailable");
  assert.ok(row.reasons.includes("operator_rejected"));
  assert.equal(row.customer_visible, false);
  assert.equal((await estimate(j)).status, "unavailable");
  assert.equal((await api("POST", "operator/measurements/" + m.id + "/approve", { token: t })).status, 409, "a rejected one isn't approved later");
  assert.deepEqual(await actions(m.id), ["measurement_added", "measurement_approved", "measurement_visibility", "measurement_visibility", "measurement_rejected"]);
});

test("a desk estimate from map coordinates: a postcode-only location is flagged, and it stays hidden", async () => {
  const t = await login();
  const j = await customerJourney(api, { propertyType: "detached" });
  const l = await api("POST", "projects/" + j.p.id + "/address/lookup", { token: j.p.token, body: { postcode: "CH45 1AB" } });
  const centroid = l.json.addresses.find((x) => !x.pinnable);
  await api("POST", "projects/" + j.p.id + "/address", { token: j.p.token, body: { token: centroid.token } });
  const m = (await api("POST", "operator/enquiries/" + j.id + "/measurement", { token: t, body: Object.assign({}, SURVEY, { method: "desk_estimate" }) })).json.measurement;
  assert.ok(m.reasons.includes("no_rooftop_coordinate"));
  assert.equal(m.canShow, false, "OS and Environment Agency display rights are unresolved");
});

// ---------------------------------------------------------------------------
// customers' plans and drawings

async function addEvidence(j, buf, contentType, bytes) {
  const pre = await api("POST", "projects/" + j.p.id + "/evidence/presign", { token: j.p.token, body: { contentType, bytes: bytes || buf.length } });
  if (pre.status !== 200) return pre;
  await storage().put(new URL(pre.json.url, "http://localhost").searchParams.get("path"), buf, contentType);
  return api("POST", "projects/" + j.p.id + "/evidence/commit", { token: j.p.token, body: { uploadId: pre.json.uploadId } });
}

test("customers can add plans (PDF) and photos; each is checked; they go with the project", async () => {
  const t = await login();
  const j = await customerJourney(api, { propertyType: "detached" });
  const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(200, 32)]);
  const a = await addEvidence(j, pdf, "application/pdf");
  assert.equal(a.status, 200, JSON.stringify(a.json));
  assert.equal(a.json.evidence.kind, "pdf");
  const jpg = await images.sharp()({ create: { width: 800, height: 600, channels: 3, background: "#777777" } }).jpeg().toBuffer();
  const b = await addEvidence(j, jpg, "image/jpeg");
  assert.equal(b.status, 200, JSON.stringify(b.json));
  assert.equal(b.json.evidence.kind, "image");
  assert.equal((await addEvidence(j, Buffer.concat([Buffer.from("not a pdf"), Buffer.alloc(100)]), "application/pdf")).status, 400, "checked by its first bytes");
  assert.equal((await addEvidence(j, jpg, "image/heic")).status, 400);
  assert.equal((await addEvidence(j, pdf, "application/pdf", 21 * 1024 * 1024)).status, 413);
  const photoUpload = await api("POST", "projects/" + j.p.id + "/photo/presign", { token: j.p.token, body: { contentType: "image/jpeg", bytes: jpg.length } });
  assert.equal((await api("POST", "projects/" + j.p.id + "/evidence/commit", { token: j.p.token, body: { uploadId: photoUpload.json.uploadId } })).status, 404, "a photo upload can't be committed as evidence");
  const other = await customerJourney(api, { enquiry: false });
  const theirs = await api("POST", "projects/" + other.p.id + "/evidence/presign", { token: other.p.token, body: { contentType: "application/pdf", bytes: pdf.length } });
  assert.equal((await api("POST", "projects/" + j.p.id + "/evidence/commit", { token: j.p.token, body: { uploadId: theirs.json.uploadId } })).status, 404, "another project's upload");
  const list = await api("GET", "projects/" + j.p.id + "/evidence", { token: j.p.token });
  assert.equal(list.json.evidence.length, 2);
  assert.equal((await api("GET", "projects/" + j.p.id + "/evidence", {})).status, 401, "needs the project's key");
  const link = await api("GET", "operator/evidence/" + a.json.evidence.id, { token: t });
  assert.equal(link.status, 200);
  assert.match(link.json.url, /^\/__dev\/blob\?op=get&path=projects%2F.+%2Fevidence%2F/);
  assert.deepEqual(await actions(a.json.evidence.id), ["evidence_downloaded"]);
  const m = await api("POST", "operator/enquiries/" + j.id + "/measurement", { token: t, body: Object.assign({}, SURVEY, { method: "customer_evidence", evidence: [a.json.evidence.id] }) });
  assert.equal(m.status, 201);
  assert.deepEqual(m.json.measurement.evidence, [a.json.evidence.id]);
  assert.equal((await api("POST", "operator/enquiries/" + j.id + "/measurement", { token: t, body: Object.assign({}, SURVEY, { evidence: [other.p.id] }) })).status, 400, "only this customer's files");
  const del = await api("POST", "projects/" + j.p.id + "/evidence/" + b.json.evidence.id + "/delete", { token: j.p.token });
  assert.equal(del.status, 200);
  assert.equal((await storage().list("projects/" + j.p.id + "/evidence/")).length, 1);
  await api("POST", "projects/" + j.p.id + "/delete", { token: j.p.token });
  assert.deepEqual(await storage().list("projects/" + j.p.id + "/"), [], "the files go with the project");
});

test("at most ten files per project", async () => {
  const j = await customerJourney(api, { enquiry: false });
  const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(50, 32)]);
  for (let i = 0; i < 10; i++) assert.equal((await addEvidence(j, pdf, "application/pdf")).status, 200, "file " + (i + 1));
  const eleventh = await api("POST", "projects/" + j.p.id + "/evidence/presign", { token: j.p.token, body: { contentType: "application/pdf", bytes: pdf.length } });
  assert.equal(eleventh.status, 409);
  assert.equal(eleventh.json.error, "too_many");
});

// ---------------------------------------------------------------------------

test("the Hover template: pitch as x/12 or degrees, metric or imperial, and plain problems", () => {
  assert.ok(Math.abs(hover.pitchDegrees("6/12") - 26.565) < 0.001);
  assert.equal(hover.pitchDegrees("35"), 35);
  assert.equal(hover.pitchDegrees("35°"), 35);
  assert.equal(hover.pitchDegrees(""), null);
  const metric = hover.fromHoverSummary({ units: "metric", total_area: 120, pitch: 40, ridges: 9, valleys: 3 });
  assert.equal(metric.ok, true);
  assert.equal(metric.faces[0].surface_area_m2, 120);
  assert.deepEqual(
    metric.edges.map((e) => [e.kind, e.length_m]),
    [
      ["ridge", 9],
      ["valley", 3],
    ]
  );
  const bad = hover.fromHoverSummary({ total_area: 0, pitch: "steep", eaves: -3 });
  assert.equal(bad.ok, false);
  assert.equal(bad.problems.length, 3);
  assert.equal(hover.fromHoverSummary({ total_area: 100, pitch: 80 }).ok, false, "pitch 0–75°");
});
