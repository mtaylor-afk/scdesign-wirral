// Capability states: a key alone never enables anything (brief §4). (A1)
import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers.mjs";

const { capability, capabilities, NAMES } = load("serverlib/wvroofing/capabilities.js");
const { PROVIDERS, REQUIREMENTS, rightsFor, toMarkdown } = load("serverlib/wvroofing/permissions.js");

const PROD_STORAGE = { DATABASE_URL: "postgres://x", BLOB_STORE_ID: "store_1", WVR_SESSION_SECRET: "s" };

test("no credential -> implemented", () => {
  assert.equal(capability("image_generation", {}).state, "implemented");
  assert.equal(capability("address_lookup", {}).state, "implemented");
  assert.equal(capability("enquiry_storage", {}).state, "implemented");
});

test("credential but switch off -> configured", () => {
  const c = capability("image_generation", { WVR_OPENAI_API_KEY: "k" });
  assert.equal(c.state, "configured");
  assert.match(c.reason, /WVR_CAP_IMAGE_GENERATION/);
  assert.equal(capability("address_lookup", { WVR_IDEAL_POSTCODES_KEY: "k" }).state, "configured");
});

test("credential + switch + rights -> enabled", () => {
  assert.equal(capability("image_generation", { WVR_OPENAI_API_KEY: "k", WVR_CAP_IMAGE_GENERATION: "on" }).state, "enabled");
  assert.equal(capability("address_lookup", { WVR_IDEAL_POSTCODES_KEY: "k", WVR_CAP_ADDRESS_LOOKUP: "on" }).state, "enabled");
});

test("aerial display needs both the key and the URL-signing secret", () => {
  assert.equal(capability("aerial_display", { WVR_GOOGLE_MAPS_STATIC_KEY: "k", WVR_CAP_AERIAL_DISPLAY: "on" }).state, "implemented");
  assert.equal(capability("aerial_display", { WVR_GOOGLE_MAPS_STATIC_KEY: "k", WVR_GOOGLE_MAPS_SIGNING_SECRET: "s", WVR_CAP_AERIAL_DISPLAY: "on" }).state, "enabled");
});

test("storage needs database, blob store and session secret; it has no switch", () => {
  assert.equal(capability("enquiry_storage", { DATABASE_URL: "postgres://x" }).state, "implemented");
  assert.equal(capability("enquiry_storage", PROD_STORAGE).state, "enabled");
});

test("kill switch disables every paid capability but not storage", () => {
  const env = Object.assign({ WVR_ENABLED: "0", WVR_OPENAI_API_KEY: "k", WVR_CAP_IMAGE_GENERATION: "on" }, PROD_STORAGE);
  assert.equal(capability("image_generation", env).state, "disabled");
  assert.equal(capability("image_generation", env).reason, "kill_switch");
  assert.equal(capability("enquiry_storage", env).state, "enabled");
});

test("unresolved rights disable a capability even with a key and the switch on", () => {
  const c = capability("desk_measure", { WVR_OS_DATAHUB_KEY: "k", WVR_CAP_DESK_MEASURE: "on" });
  assert.equal(c.state, "disabled");
  assert.match(c.reason, /rights_unresolved:.*ea_lidar/);
});

test("automatic measurement is always disabled: no licensed provider", () => {
  assert.deepEqual(capability("auto_measurement", { WVR_OPENAI_API_KEY: "k" }), { state: "disabled", reason: "no_licensed_provider" });
});

test("every capability is reported, and every requirement names a real provider and right", () => {
  const all = capabilities({});
  assert.deepEqual(Object.keys(all).sort(), [...NAMES].sort());
  for (const [cap, reqs] of Object.entries(REQUIREMENTS)) {
    for (const [p, right] of reqs) {
      assert.ok(PROVIDERS[p], cap + " needs unknown provider " + p);
      assert.ok(["display", "processing", "derivation", "retention", "export", "attribution", "thirdPartyAI"].includes(right), cap + " needs unknown right " + right);
    }
  }
});

test("the terms-based refusals hold: Google Solar and Google Static derivation", () => {
  assert.equal(PROVIDERS.google_solar.processing, "no");
  assert.equal(PROVIDERS.google_static_maps.derivation, "no");
  assert.equal(PROVIDERS.google_static_maps.thirdPartyAI, "no");
  assert.equal(PROVIDERS.hover.display, "no");
  assert.equal(rightsFor("aerial_display").ok, true);
});

test("the permissions record renders to Markdown with every provider", () => {
  const md = toMarkdown();
  for (const rec of Object.values(PROVIDERS)) assert.ok(md.includes(rec.name), rec.name);
});
