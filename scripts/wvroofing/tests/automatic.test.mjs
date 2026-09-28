// Automatic roof measurement as honest stubs, and the release checks (B4; plan D11).
import os from "node:os";
import path from "node:path";
process.env.WVR_ENV = "test";
process.env.WVR_FS_STORAGE_DIR = path.join(os.tmpdir(), "wvr-automatic-test-" + process.pid);
process.env.WVR_CAP_ADDRESS_LOOKUP = "on";
process.env.WVR_CAP_AERIAL_DISPLAY = "on";
process.env.WVR_CAP_ASSISTED_MEASUREMENT = "on";
process.env.WVR_PROJECTS_PER_IP_DAILY = "1000";
process.env.WVR_DAILY_UPLOADS = "1000";
process.env.WVR_ENQUIRIES_PER_IP_HOURLY = "1000";
process.env.WVR_ADDRESS_LOOKUPS_PER_IP = "1000";
process.env.WVR_ADDRESS_LOOKUPS_DAILY = "1000";

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { load, call, removeTempDir, apiFor, customerJourney } from "./helpers.mjs";

const app = load("api/wvroofing/app.js");
const db = load("serverlib/wvroofing/db.js");
const jobs = load("serverlib/wvroofing/jobs.js");
const adapters = load("serverlib/wvroofing/measure/adapters.js");
const capabilities = load("serverlib/wvroofing/capabilities.js");
const permissions = load("serverlib/wvroofing/permissions.js");
const api = apiFor(app);

after(async () => {
  await jobs.drain();
  await db.reset();
  removeTempDir(process.env.WVR_FS_STORAGE_DIR);
});

test("each automatic provider answers 'unsupported' for a Merseyside property, with its reason", async () => {
  const merseyside = { uprn: "100000000001", postcode: "CH45 1AB", lat: 53.4225, lng: -3.0478, coordSource: "rooftop" };
  const out = await adapters.automatic(merseyside);
  assert.deepEqual(
    out.map((r) => r.provider),
    ["google_solar", "vexcel", "bluesky"]
  );
  for (const r of out) {
    assert.equal(r.status, "unsupported", r.provider);
    assert.deepEqual(r.reasons, ["licence_unresolved"], r.provider);
    assert.ok(r.why.length > 20, r.provider + " says why in plain words");
    const rec = permissions.PROVIDERS[r.provider];
    assert.ok(rec && rec.display !== "yes", r.provider + ": the permissions record agrees it can't be shown");
  }
});

test("outside the Wirral and Liverpool: unsupported, and the geography is a reason too", async () => {
  for (const postcode of ["SW1A 1AA", "M1 1AE", "CH65 0AA", "L39 1AA", "", null]) {
    for (const r of await adapters.automatic({ postcode })) {
      assert.equal(r.status, "unsupported");
      assert.deepEqual(r.reasons, ["geography_unsupported", "licence_unresolved"], r.provider + " " + postcode);
    }
  }
  assert.equal(adapters.inServiceArea("ch45 1ab"), true);
  assert.equal(adapters.inServiceArea("L1 8JQ"), true);
  assert.equal(adapters.inServiceArea("L38 5AA"), true, "Hightown / Formby side");
  assert.equal(adapters.inServiceArea("CH64 3RY"), true, "Neston");
});

test("automatic measurement stays disabled, with its reason, even when a key is present", () => {
  const env = { WVR_ENV: "production", WVR_GOOGLE_SOLAR_KEY: "a-key", WVR_VEXCEL_KEY: "a-key", WVR_BLUESKY_KEY: "a-key", WVR_CAP_AUTO_MEASUREMENT: "on" };
  assert.deepEqual(capabilities.capability("auto_measurement", env), { state: "disabled", reason: "no_licensed_provider" });
});

test("health reports automatic measurement as disabled, with the reason", async () => {
  process.env.WVR_GOOGLE_SOLAR_KEY = "a-key";
  try {
    const h = await call(app, "GET", "/api/wvroofing/health", {});
    assert.equal(h.status, 200);
    assert.deepEqual(h.json.capabilities.auto_measurement, { state: "disabled", reason: "no_licensed_provider" });
    assert.ok(!JSON.stringify(h.json).includes("a-key"), "never a key");
  } finally {
    delete process.env.WVR_GOOGLE_SOLAR_KEY;
  }
});

test("the estimate says unavailable, with the automatic providers' reasons, and offers a survey (the enquiry)", async () => {
  const j = await customerJourney(api, { enquiry: false });
  const e = (await api("GET", "projects/" + j.p.id + "/estimate?visual=welsh-slate", { token: j.p.token })).json.estimate;
  assert.equal(e.status, "unavailable");
  assert.deepEqual(e.automatic, { status: "unsupported", reasons: ["licence_unresolved"] });
  const typed = await api("POST", "projects/" + j.p.id + "/address", { token: j.p.token, body: { manual: { line1: "1 High Street", town: "Manchester", postcode: "M1 1AE" } } });
  assert.equal(typed.status, 200);
  const far = (await api("GET", "projects/" + j.p.id + "/estimate", { token: j.p.token })).json.estimate;
  assert.deepEqual(far.automatic.reasons, ["geography_unsupported", "licence_unresolved"]);
});

test("measurement switched off: the customer sees nothing measured, and the roofer can't add any", async () => {
  const j = await customerJourney(api, { enquiry: true });
  const saved = process.env.WVR_CAP_ASSISTED_MEASUREMENT;
  delete process.env.WVR_CAP_ASSISTED_MEASUREMENT;
  try {
    const e = (await api("GET", "projects/" + j.p.id + "/estimate?visual=welsh-slate", { token: j.p.token })).json.estimate;
    assert.equal(e.status, "unavailable");
    const pre = await api("POST", "projects/" + j.p.id + "/evidence/presign", { token: j.p.token, body: { contentType: "application/pdf", bytes: 100 } });
    assert.equal(pre.status, 503, "no plans and drawings either");
    const auth = load("serverlib/wvroofing/auth.js");
    process.env.WVR_OPERATOR_PASSWORD_HASH = auth.hashPassword(auth.TEST_OPERATOR_PASSWORD);
    const login = await api("POST", "operator/login", { body: { password: auth.TEST_OPERATOR_PASSWORD }, ip: "192.0.2.10" });
    const add = await api("POST", "operator/enquiries/" + j.id + "/measurement", {
      token: login.json.token,
      body: { method: "site_survey", faces: [{ id: "a", plan_area_m2: 40, pitch_deg: 35 }] },
    });
    assert.equal(add.status, 503);
    const d = await api("GET", "operator/enquiries/" + j.id, { token: login.json.token });
    assert.equal(d.json.project.measurementEnabled, false, "the operator screen says it's switched off");
  } finally {
    process.env.WVR_CAP_ASSISTED_MEASUREMENT = saved;
  }
});

test("the permissions record covers every provider in the plan, each with sources and a date", () => {
  const want = [
    "openai",
    "ideal_postcodes",
    "google_static_maps",
    "esri_world_imagery",
    "os_ngd",
    "os_linked_identifiers",
    "ea_lidar",
    "google_solar",
    "bluesky",
    "getmapping",
    "vexcel",
    "hover",
    "vercel",
    "neon",
    "apple_icloud_mail",
    "cloudflare",
    "google_fonts",
  ];
  assert.deepEqual(Object.keys(permissions.PROVIDERS).sort(), want.slice().sort());
  for (const [k, rec] of Object.entries(permissions.PROVIDERS)) {
    assert.match(rec.checked, /^2026-\d{2}-\d{2}$/, k);
    for (const right of ["display", "processing", "derivation", "retention", "export", "attribution", "thirdPartyAI"]) {
      assert.ok(["yes", "no", "unresolved", "n/a"].includes(rec[right]), k + "." + right);
    }
  }
});
