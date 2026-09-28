// The customer's property: postcode, address, aerial view, confirmation. (A5; brief §6-7)
// Test environment: the address and imagery fixtures stand in for Ideal Postcodes and Google.
import os from "node:os";
import path from "node:path";
process.env.WVR_ENV = "test";
process.env.WVR_FS_STORAGE_DIR = path.join(os.tmpdir(), "wvr-property-test-" + process.pid);
process.env.WVR_CAP_ADDRESS_LOOKUP = "on";
process.env.WVR_CAP_AERIAL_DISPLAY = "on";
process.env.WVR_CAP_ENQUIRY_DELIVERY = "on";
process.env.WVR_PROJECTS_PER_IP_DAILY = "1000";
process.env.WVR_ADDRESS_LOOKUPS_PER_IP = "1000";
process.env.WVR_ADDRESS_LOOKUPS_DAILY = "1000";
process.env.WVR_ENQUIRIES_PER_IP_HOURLY = "1000";

import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { load, call, SITE, removeTempDir } from "./helpers.mjs";

const app = load("api/wvroofing/app.js");
const db = load("serverlib/wvroofing/db.js");
const jobs = load("serverlib/wvroofing/jobs.js");
const address = load("serverlib/wvroofing/address.js");
const imagery = load("serverlib/wvroofing/imagery.js");
const property = load("serverlib/wvroofing/property.js");
const mailer = load("serverlib/wvroofing/mailer.js");

after(async () => {
  await jobs.drain();
  await db.reset();
  removeTempDir(process.env.WVR_FS_STORAGE_DIR);
});

function api(method, route, { token, body, origin = SITE } = {}) {
  const h = { origin };
  if (body !== undefined) h["content-type"] = "application/json";
  if (token) h.authorization = "Bearer " + token;
  return call(app, method, "/api/wvroofing/" + route, h, body);
}

async function newProject() {
  const r = await api("POST", "projects", { body: { noticeShown: true } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json;
}

async function lookup(p, postcode) {
  return api("POST", "projects/" + p.id + "/address/lookup", { token: p.token, body: { postcode } });
}

/** Look up a postcode and choose the address whose label starts with `start`. */
async function chooseAddress(p, start, postcode = "CH45 1AB") {
  const l = await lookup(p, postcode);
  assert.equal(l.status, 200, JSON.stringify(l.json));
  const a = l.json.addresses.find((x) => x.label.startsWith(start));
  assert.ok(a, "no address starting " + start);
  const c = await api("POST", "projects/" + p.id + "/address", { token: p.token, body: { token: a.token } });
  assert.equal(c.status, 200, JSON.stringify(c.json));
  return c.json.address;
}

test("postcodes are normalised before anything is looked up", () => {
  assert.equal(address.normalisePostcode("ch451ab"), "CH45 1AB");
  assert.equal(address.normalisePostcode("  l1  8jq "), "L1 8JQ");
  assert.equal(address.normalisePostcode("sw1a1aa"), "SW1A 1AA");
  assert.equal(address.normalisePostcode("CH45-1AB"), "CH45 1AB");
  assert.equal(address.normalisePostcode("12345"), null);
  assert.equal(address.normalisePostcode(""), null);
  assert.equal(address.normalisePostcode("id1 kfa"), "ID1 KFA", "Ideal Postcodes' test postcodes are allowed");
});

test("a postcode lookup lists the addresses, each with a signed token; nothing else is stored", async () => {
  const p = await newProject();
  const r = await lookup(p, "ch45 1ab");
  assert.equal(r.status, 200);
  assert.equal(r.json.postcode, "CH45 1AB");
  assert.equal(r.json.addresses.length, 4);
  assert.equal(r.json.addresses[0].label, "1 Test Road, Wallasey");
  assert.equal(r.json.addresses.filter((a) => a.newBuild).length, 1, "the not-yet-built address is labelled");
  assert.deepEqual(r.json.addresses.map((a) => a.pinnable), [true, true, false, true], "no UPRN, no pin");
  for (const a of r.json.addresses) assert.match(a.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const { rows } = await db.query("SELECT count(*)::int AS n FROM wvr_addresses WHERE project_id = $1", [p.id]);
  assert.equal(rows[0].n, 0, "a lookup stores nothing");
  const calls = await db.query("SELECT * FROM wvr_provider_calls WHERE project_id = $1 AND provider = 'ideal_postcodes'", [p.id]);
  assert.equal(calls.rows.length, 1);
  assert.equal(calls.rows[0].currency, "GBP");
});

test("invalid, unknown and unavailable postcodes get plain answers", async () => {
  const p = await newProject();
  const bad = await lookup(p, "not a postcode");
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error, "invalid_postcode");
  const missing = await lookup(p, "ID1 KFA");
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error, "postcode_not_found");
  assert.match(missing.json.message, /type your address/);
  const free = await db.query("SELECT cost FROM wvr_provider_calls WHERE project_id = $1 AND status = 'not_found'", [p.id]);
  assert.equal(Number(free.rows[0].cost), 0, "an unfound postcode costs nothing");
  for (const pc of ["ID1 CLIP", "ID1 CHOP"]) {
    const r = await lookup(p, pc);
    assert.equal(r.status, 503, pc);
    assert.equal(r.json.error, "address_unavailable");
  }
  delete process.env.WVR_CAP_ADDRESS_LOOKUP;
  try {
    const off = await lookup(p, "CH45 1AB");
    assert.equal(off.status, 503);
    assert.equal(off.json.error, "not_configured");
  } finally {
    process.env.WVR_CAP_ADDRESS_LOOKUP = "on";
  }
});

test("only a genuine, recent token for this project chooses an address", async () => {
  const p = await newProject();
  const q = await newProject();
  const l = await lookup(p, "CH45 1AB");
  const tok = l.json.addresses[0].token;
  assert.equal((await api("POST", "projects/" + q.id + "/address", { token: q.token, body: { token: tok } })).status, 400, "another project's token");
  const [payload, mac] = tok.split(".");
  const forged = Buffer.from(JSON.stringify(Object.assign(JSON.parse(Buffer.from(payload, "base64url").toString()), { a: { lines: ["10 Downing Street"] } }))).toString("base64url") + "." + mac;
  assert.equal((await api("POST", "projects/" + p.id + "/address", { token: p.token, body: { token: forged } })).status, 400, "an altered address");
  const realNow = Date.now;
  Date.now = () => realNow() + 2 * 3600 * 1000;
  try {
    assert.equal(address.verifyAddress(p.id, tok), null, "an old token");
  } finally {
    Date.now = realNow;
  }
  const ok = await api("POST", "projects/" + p.id + "/address", { token: p.token, body: { token: tok } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.address.label, "1 Test Road, Wallasey");
  assert.equal(ok.json.address.coordSource, "rooftop");
});

test("an address can be typed in; it has no location, so no aerial view or pin", async () => {
  const p = await newProject();
  const bad = await api("POST", "projects/" + p.id + "/address", { token: p.token, body: { manual: { line1: "", town: "", postcode: "nope" } } });
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.json.fields.sort(), ["line1", "postcode", "town"]);
  const r = await api("POST", "projects/" + p.id + "/address", { token: p.token, body: { manual: { line1: "12 Sea View", town: "New Brighton", postcode: "ch45 2aa" } } });
  assert.equal(r.status, 200);
  assert.equal(r.json.address.manual, true);
  assert.equal(r.json.address.postcode, "CH45 2AA");
  assert.equal(r.json.address.coordSource, "none");
  const v = await api("GET", "projects/" + p.id + "/property/view", { token: p.token });
  assert.deepEqual(v.json.view, { available: false, reason: "no_coordinates" });
  const c = await api("POST", "projects/" + p.id + "/property/confirm", { token: p.token, body: { propertyType: "detached", pinConfirmed: true } });
  assert.equal(c.json.property.pinShown, false);
  assert.equal(c.json.property.pinConfirmed, false, "no pin was shown, so none can be confirmed");
  assert.deepEqual(c.json.property.reasons, ["no_rooftop_coordinate"]);
});

test("the aerial view: a pin only for rooftop coordinates; nothing when switched off", async () => {
  const p = await newProject();
  await chooseAddress(p, "1 Test Road");
  const v = await api("GET", "projects/" + p.id + "/property/view", { token: p.token });
  assert.equal(v.json.view.available, true);
  assert.equal(v.json.view.pin, true);
  assert.match(v.json.view.url, /^data:image\/svg\+xml;base64,/, "the test environment's stand-in");
  await chooseAddress(p, "5 Test Road");
  const c = await api("GET", "projects/" + p.id + "/property/view", { token: p.token });
  assert.equal(c.json.view.available, true);
  assert.equal(c.json.view.pin, false, "a postcode centroid gets no pin");
  delete process.env.WVR_CAP_AERIAL_DISPLAY;
  try {
    const off = await api("GET", "projects/" + p.id + "/property/view", { token: p.token });
    assert.deepEqual(off.json.view, { available: false, reason: "not_configured" });
  } finally {
    process.env.WVR_CAP_AERIAL_DISPLAY = "on";
  }
});

test("every property type sets the right ambiguity", async () => {
  const p = await newProject();
  await chooseAddress(p, "1 Test Road");
  const want = {
    detached: [],
    bungalow: [],
    semi: ["shared_roof"],
    end_terrace: ["shared_roof"],
    mid_terrace: ["shared_roof"],
    flat: ["flat_or_shared_block"],
    other: ["property_type_unclear"],
    not_sure: ["property_type_unclear"],
  };
  for (const [type, reasons] of Object.entries(want)) {
    const r = await api("POST", "projects/" + p.id + "/property/confirm", { token: p.token, body: { propertyType: type, pinConfirmed: true } });
    assert.equal(r.status, 200, type);
    assert.deepEqual(r.json.property.reasons, reasons, type);
    assert.equal(r.json.property.ambiguous, reasons.length > 0, type);
  }
  const unpinned = await api("POST", "projects/" + p.id + "/property/confirm", { token: p.token, body: { propertyType: "detached", pinConfirmed: false } });
  assert.deepEqual(unpinned.json.property.reasons, ["pin_not_confirmed"]);
  assert.equal((await api("POST", "projects/" + p.id + "/property/confirm", { token: p.token, body: { propertyType: "castle" } })).status, 400);
  const bare = await newProject();
  assert.equal((await api("POST", "projects/" + bare.id + "/property/confirm", { token: bare.token, body: { propertyType: "detached" } })).status, 409, "no address yet");
  assert.deepEqual(property.ambiguityReasons({ coordSource: "postcode_centroid", pinShown: false, pinConfirmed: false, propertyType: "semi" }), ["no_rooftop_coordinate", "shared_roof"]);
});

test("a new address supersedes the confirmation; clearing it clears both", async () => {
  const p = await newProject();
  await chooseAddress(p, "1 Test Road");
  await api("POST", "projects/" + p.id + "/property/confirm", { token: p.token, body: { propertyType: "detached", pinConfirmed: true } });
  let g = await api("GET", "projects/" + p.id, { token: p.token });
  assert.equal(g.json.project.property.propertyType, "detached");
  await chooseAddress(p, "Flat 2");
  g = await api("GET", "projects/" + p.id, { token: p.token });
  assert.equal(g.json.project.address.label, "Flat 2, 3 Test Road, Wallasey");
  assert.equal(g.json.project.property, null, "the old confirmation doesn't carry over");
  const old = await db.query("SELECT count(*)::int AS n FROM wvr_property_confirmations WHERE project_id = $1 AND superseded_at IS NOT NULL", [p.id]);
  assert.equal(old.rows[0].n, 1, "kept, marked superseded");
  const d = await api("DELETE", "projects/" + p.id + "/address", { token: p.token });
  assert.equal(d.status, 200);
  g = await api("GET", "projects/" + p.id, { token: p.token });
  assert.equal(g.json.project.address, null);
});

test("the enquiry carries the address and what was confirmed; the email says what to check", async () => {
  mailer.setFixture("ok");
  const p = await newProject();
  await chooseAddress(p, "7 Test Road");
  await api("POST", "projects/" + p.id + "/property/confirm", { token: p.token, body: { propertyType: "semi", pinConfirmed: true } });
  const e = await api("POST", "projects/" + p.id + "/enquiry", {
    token: p.token,
    body: { name: "Pat Test", email: "pat@example.com", consent: true, elapsedMs: 9000, idempotencyKey: "propertykey-0001", product: "welsh-slate" },
  });
  assert.equal(e.status, 201, JSON.stringify(e.json));
  const row = (await db.query("SELECT snapshot FROM wvr_enquiries WHERE reference = $1", [e.json.reference])).rows[0];
  assert.equal(row.snapshot.address.uprn, "100000000007");
  assert.equal(row.snapshot.address.dataset, "nyb");
  assert.equal(row.snapshot.property.propertyType, "semi");
  const mail = mailer.outbox[mailer.outbox.length - 1];
  assert.match(mail.text, /Property address: 7 Test Road, WALLASEY, CH45 1AB \(new build\)/);
  assert.match(mail.text, /Property: Semi-detached house, confirmed on the aerial view/);
  assert.match(mail.text, /Check before quoting: the roof is shared with a neighbour/);
  const g = await api("GET", "projects/" + p.id, { token: p.token });
  assert.equal(g.json.project.enquiry.reference, e.json.reference);
});

test("address lookups are limited per project (each one is paid for)", async () => {
  const p = await newProject();
  process.env.WVR_ADDRESS_LOOKUPS_PER_PROJECT = "1";
  try {
    assert.equal((await lookup(p, "CH45 1AB")).status, 200);
    const second = await lookup(p, "CH45 1AB");
    assert.equal(second.status, 429);
    assert.match(second.json.message, /type your address/);
  } finally {
    delete process.env.WVR_ADDRESS_LOOKUPS_PER_PROJECT;
  }
});

test("Static Maps URLs are signed over the path and query (HMAC-SHA1, URL-safe)", () => {
  const secret = Buffer.from("not-a-real-secret-0123456789").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
  const url = imagery.staticMapUrl({ lat: 53.42251, lng: -3.04781, rooftop: true }, "AIza-test-key", secret);
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, "https://maps.googleapis.com/maps/api/staticmap");
  assert.equal(u.searchParams.get("maptype"), "satellite");
  assert.equal(u.searchParams.get("zoom"), "20");
  assert.equal(u.searchParams.get("markers"), "color:0x0071e3|53.422510,-3.047810");
  const signed = url.slice("https://maps.googleapis.com".length, url.indexOf("&signature="));
  const expect = crypto.createHmac("sha1", Buffer.from(secret.replace(/-/g, "+").replace(/_/g, "/"), "base64")).update(signed).digest("base64").replace(/\+/g, "-").replace(/\//g, "_");
  assert.equal(u.searchParams.get("signature"), expect);
  assert.match(u.searchParams.get("signature"), /^[A-Za-z0-9_-]{27}=$/, "20 bytes, URL-safe base64");
  const centroid = new URL(imagery.staticMapUrl({ lat: 53.42251, lng: -3.04781, rooftop: false }, "k", secret));
  assert.equal(centroid.searchParams.get("markers"), null, "no pin for a postcode centroid");
  assert.equal(centroid.searchParams.get("zoom"), "18");
  assert.notEqual(imagery.signature("/maps/api/staticmap?a=1", secret), imagery.signature("/maps/api/staticmap?a=1", "b3RoZXI="));
});
