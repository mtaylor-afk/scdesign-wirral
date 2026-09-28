// The operator screen's API (A6; brief §14, plan D5). Test environment only: the
// throwaway test password, PGlite, local storage and the OpenAI, email, address
// and imagery stand-ins.
import os from "node:os";
import path from "node:path";
process.env.WVR_ENV = "test";
process.env.WVR_FS_STORAGE_DIR = path.join(os.tmpdir(), "wvr-operator-test-" + process.pid);
process.env.WVR_CAP_IMAGE_GENERATION = "on";
process.env.WVR_CAP_ENQUIRY_DELIVERY = "on";
process.env.WVR_CAP_ADDRESS_LOOKUP = "on";
process.env.WVR_CAP_AERIAL_DISPLAY = "on";
process.env.WVR_UPSTREAM_IPM = "1000";
process.env.WVR_PROJECTS_PER_IP_DAILY = "1000";
process.env.WVR_DAILY_UPLOADS = "1000";
process.env.WVR_ENQUIRIES_PER_IP_HOURLY = "1000";
process.env.WVR_ADDRESS_LOOKUPS_PER_IP = "1000";
process.env.WVR_ADDRESS_LOOKUPS_DAILY = "1000";

import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { load, call, repo, removeTempDir, apiFor, customerJourney } from "./helpers.mjs";

const app = load("api/wvroofing/app.js");
const db = load("serverlib/wvroofing/db.js");
const jobs = load("serverlib/wvroofing/jobs.js");
const auth = load("serverlib/wvroofing/auth.js");
const mailer = load("serverlib/wvroofing/mailer.js");
const openai = load("serverlib/wvroofing/openai.js");
const router = load("serverlib/wvroofing/router.js");
const { storage } = load("serverlib/wvroofing/storage.js");

const PASSWORD = auth.TEST_OPERATOR_PASSWORD;
process.env.WVR_OPERATOR_PASSWORD_HASH = auth.hashPassword(PASSWORD);

after(async () => {
  await jobs.drain();
  await db.reset();
  removeTempDir(process.env.WVR_FS_STORAGE_DIR);
});

beforeEach(async () => {
  await jobs.drain();
  mailer.setFixture("ok");
  openai.setFixture({ mode: "ok", latencyMs: 0 });
  await db.query("DELETE FROM wvr_login_attempts");
});

const api = apiFor(app);

/** A customer's whole journey (helpers.mjs), with a render unless asked not to. */
const enquiryWithProject = ({ render = true, propertyType = "semi" } = {}) => customerJourney(api, { render, propertyType });

let ipN = 0;
const nextIp = () => "203.0.113." + ++ipN;
let keyN = 0;
const key = () => "opkey" + String(++keyN).padStart(8, "0");

async function login() {
  const r = await api("POST", "operator/login", { body: { password: PASSWORD }, ip: nextIp() });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json.token;
}

async function enquiryId(reference) {
  return (await db.query("SELECT id FROM wvr_enquiries WHERE reference = $1", [reference])).rows[0].id;
}

async function freeEnquiry() {
  const e = await api("POST", "enquiries", {
    body: { name: "Jo Test", phone: "0151 496 0001", postcode: "CH45 1AB", product: "welsh-slate", message: "Leaking.", consent: true, source: "roof-replacement", elapsedMs: 9000, idempotencyKey: key() },
  });
  assert.equal(e.status, 201, JSON.stringify(e.json));
  return { ref: e.json.reference, id: await enquiryId(e.json.reference) };
}

async function actions(targetId) {
  return (await db.query("SELECT action, target_type, before, after, session_id FROM wvr_operator_actions WHERE target_id = $1 ORDER BY id", [targetId])).rows;
}

// ---------------------------------------------------------------------------
// logging in

test("password hashes are salted scrypt; malformed ones never match", async () => {
  const a = auth.hashPassword("correct horse battery");
  const b = auth.hashPassword("correct horse battery");
  assert.notEqual(a, b, "salted");
  assert.match(a, /^scrypt:16384:8:1:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{86}$/);
  assert.doesNotMatch(a, /\$/, "no '$' for a .env loader to expand");
  assert.equal(await auth.verifyPassword("correct horse battery", a), true);
  assert.equal(await auth.verifyPassword("correct horse batterY", a), false);
  for (const bad of ["", "nonsense", "scrypt:16384:8:1:abc", a.replace(/:[^:]+$/, ":AAAA"), "bcrypt" + a.slice(6)]) {
    assert.equal(await auth.verifyPassword("correct horse battery", bad), false, bad);
  }
});

test("login: 503 until the hash is set, 401 for a wrong password, a 12-hour session for the right one", async () => {
  const saved = process.env.WVR_OPERATOR_PASSWORD_HASH;
  delete process.env.WVR_OPERATOR_PASSWORD_HASH;
  try {
    const r = await api("POST", "operator/login", { body: { password: PASSWORD }, ip: nextIp() });
    assert.equal(r.status, 503);
    assert.equal(r.json.error, "not_configured");
  } finally {
    process.env.WVR_OPERATOR_PASSWORD_HASH = saved;
  }
  const ip = nextIp();
  const bad = await api("POST", "operator/login", { body: { password: "not the password" }, ip });
  assert.equal(bad.status, 401);
  assert.equal(bad.json.token, undefined);
  const ok = await api("POST", "operator/login", { body: { password: PASSWORD }, ip });
  assert.equal(ok.status, 200);
  assert.match(ok.json.token, /^[A-Za-z0-9_-]{43}$/);
  const hours = (new Date(ok.json.expiresAt).getTime() - Date.now()) / 3600000;
  assert.ok(hours > 11.9 && hours <= 12, String(hours));
  const s = await api("GET", "operator/session", { token: ok.json.token });
  assert.equal(s.status, 200);
  assert.equal(s.json.environment, "test");
  const stored = await db.query("SELECT token_hash FROM wvr_operator_sessions WHERE token_hash = $1", [auth.hashToken(ok.json.token)]);
  assert.equal(stored.rows.length, 1, "only the key's hash is stored");
  const attempts = await db.query("SELECT ok FROM wvr_login_attempts ORDER BY id");
  assert.deepEqual(
    attempts.rows.map((r) => r.ok),
    [false, true]
  );
});

test("five wrong passwords lock that visitor out for 15 minutes; twenty in all lock every login", async () => {
  const ip = nextIp();
  for (let i = 0; i < 5; i++) assert.equal((await api("POST", "operator/login", { body: { password: "wrong " + i }, ip })).status, 401);
  const locked = await api("POST", "operator/login", { body: { password: PASSWORD }, ip });
  assert.equal(locked.status, 429, "even the right password waits");
  assert.equal(locked.json.error, "locked");
  assert.equal(locked.headers["retry-after"], "900");
  assert.equal((await api("POST", "operator/login", { body: { password: PASSWORD }, ip: nextIp() })).status, 200, "another visitor can still log in");
  for (let i = 0; i < 15; i++) await api("POST", "operator/login", { body: { password: "wrong" }, ip: nextIp() });
  assert.equal((await api("POST", "operator/login", { body: { password: PASSWORD }, ip: nextIp() })).status, 429, "twenty failures in all lock every login");
  await db.query("UPDATE wvr_login_attempts SET created_at = now() - interval '16 minutes'");
  assert.equal((await api("POST", "operator/login", { body: { password: PASSWORD }, ip })).status, 200, "and they lift after 15 minutes");
});

test("the test environment's password never works anywhere else", async () => {
  process.env.WVR_ENV = "production-check";
  try {
    const r = await api("POST", "operator/login", { body: { password: PASSWORD }, ip: nextIp() });
    assert.equal(r.status, 401);
  } finally {
    process.env.WVR_ENV = "test";
  }
});

test("logging out ends the session; expired, revoked and made-up keys get 401", async () => {
  const t = await login();
  assert.equal((await api("GET", "operator/enquiries", { token: t })).status, 200);
  assert.equal((await api("POST", "operator/logout", { token: t })).status, 200);
  assert.equal((await api("GET", "operator/enquiries", { token: t })).status, 401);
  const t2 = await login();
  await db.query("UPDATE wvr_operator_sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1", [auth.hashToken(t2)]);
  assert.equal((await api("GET", "operator/enquiries", { token: t2 })).status, 401);
  assert.equal((await api("GET", "operator/enquiries", { token: "x".repeat(43) })).status, 401);
});

test("a new password hash ends every session opened under the old one", async () => {
  const t = await login();
  const saved = process.env.WVR_OPERATOR_PASSWORD_HASH;
  try {
    process.env.WVR_OPERATOR_PASSWORD_HASH = auth.hashPassword(PASSWORD); // the same password, freshly salted: a new hash
    assert.equal((await api("GET", "operator/session", { token: t })).status, 401);
    const t2 = await login();
    assert.equal((await api("GET", "operator/session", { token: t2 })).status, 200);
    delete process.env.WVR_OPERATOR_PASSWORD_HASH;
    assert.equal((await api("GET", "operator/session", { token: t2 })).status, 401, "no password set: no session works");
  } finally {
    process.env.WVR_OPERATOR_PASSWORD_HASH = saved;
  }
});

test("every operator route but login needs the operator's key; a customer's project key never works", async () => {
  const p = (await api("POST", "projects", { body: { noticeShown: true } })).json;
  const revoked = await login();
  await api("POST", "operator/logout", { token: revoked });
  const routes = router.ROUTES.filter((r) => r.path.startsWith("operator/"));
  assert.ok(routes.length >= 17, routes.length + " operator routes");
  for (const r of routes) {
    if (r.path === "operator/login") {
      assert.equal(r.auth, "none");
      continue;
    }
    assert.equal(r.auth, "operator", r.path);
    for (const token of [undefined, p.token, revoked]) {
      const res = await api(r.methods[0], r.path.replace(":id", p.id), { token });
      assert.equal(res.status, 401, r.methods[0] + " " + r.path + (token ? " with a wrong key" : " with no key"));
    }
  }
});

// ---------------------------------------------------------------------------
// enquiries

test("the list, and one enquiry in full: customer, property, photo, renders, costs", async () => {
  const t = await login();
  const { p, ref, id } = await enquiryWithProject();
  const list = await api("GET", "operator/enquiries", { token: t });
  const item = list.json.enquiries.find((e) => e.reference === ref);
  assert.ok(item, "listed");
  assert.equal(item.name, "Sam Test");
  assert.match(item.address, /1 Test Road/);
  assert.equal(item.checkFirst, true, "a semi: the roof is shared");
  assert.equal(item.renders, 1);
  assert.equal(item.delivery, "sent");
  const d = await api("GET", "operator/enquiries/" + id, { token: t });
  assert.equal(d.status, 200);
  assert.equal(d.json.enquiry.email, "sam@example.com");
  assert.equal(d.json.enquiry.phone, "0151 496 0000");
  assert.equal(d.json.project.id, p.id);
  assert.equal(d.json.project.addresses.length, 1);
  assert.equal(d.json.project.addresses[0].coordSource, "rooftop");
  assert.equal(d.json.project.confirmations[0].propertyType, "semi");
  assert.deepEqual(d.json.project.confirmations[0].reasons, ["shared_roof"]);
  assert.equal(d.json.project.jobs.length, 1);
  assert.equal(d.json.project.jobs[0].status, "succeeded");
  assert.ok(d.json.project.costs.some((c) => c.provider === "openai" && c.currency === "USD"));
  assert.ok(d.json.project.costs.some((c) => c.provider === "ideal_postcodes" && c.currency === "GBP"));
  assert.ok(!JSON.stringify(d.json).includes(p.token), "never the customer's key");
  const photo = await api("GET", "operator/projects/" + p.id + "/photo", { token: t });
  assert.equal(photo.status, 200);
  assert.equal(photo.headers["content-type"], "image/jpeg");
  assert.equal(photo.headers["cache-control"], "private, no-store");
  const img = await api("GET", "operator/jobs/" + d.json.project.jobs[0].id + "/image", { token: t });
  assert.equal(img.status, 200);
  assert.equal(img.headers["content-type"], "image/jpeg");
  const aerial = await api("GET", "operator/enquiries/" + id + "/aerial", { token: t });
  assert.equal(aerial.json.view.available, true);
  assert.equal(aerial.json.view.pin, true);
  const orig = await api("GET", "operator/projects/" + p.id + "/original", { token: t });
  assert.equal(orig.json.expiresIn, 300);
  assert.match(orig.json.url, /^\/__dev\/blob\?op=get&path=projects%2F/);
  assert.deepEqual(
    (await actions(p.id)).map((a) => a.action),
    ["original_downloaded"],
    "downloading the original is recorded"
  );
  const closed = await api("GET", "operator/enquiries?status=closed", { token: t });
  assert.ok(!closed.json.enquiries.some((e) => e.id === id), "the status filter works");
  assert.equal((await api("GET", "operator/enquiries/00000000-0000-4000-8000-000000000000", { token: t })).status, 404);
});

test("a scope correction is a new record; the customer's answer stays; both sides are audited", async () => {
  const t = await login();
  const { p, id } = await enquiryWithProject({ render: false, propertyType: "detached" });
  assert.equal((await api("POST", "operator/enquiries/" + id + "/scope", { token: t, body: { propertyType: "castle" } })).status, 400);
  const r = await api("POST", "operator/enquiries/" + id + "/scope", { token: t, body: { propertyType: "end_terrace", notes: "Checked on site." } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.property.reasons, ["shared_roof"]);
  const rows = (await db.query("SELECT * FROM wvr_property_confirmations WHERE project_id = $1 ORDER BY confirmed_at", [p.id])).rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].confirmed_by, "customer");
  assert.equal(rows[0].property_type, "detached");
  assert.ok(rows[0].superseded_at, "the customer's answer is kept, marked replaced");
  assert.equal(rows[1].confirmed_by, "operator");
  assert.equal(rows[1].pin_confirmed, true, "what the customer confirmed on the map stays");
  assert.equal(rows[1].notes, "Checked on site.");
  const proj = (await db.query("SELECT property_confirmation_id FROM wvr_projects WHERE id = $1", [p.id])).rows[0];
  assert.equal(proj.property_confirmation_id, rows[1].id);
  const d = await api("GET", "operator/enquiries/" + id, { token: t });
  const a = d.json.audit.find((x) => x.action === "scope_corrected");
  assert.equal(a.before.propertyType, "detached");
  assert.equal(a.after.propertyType, "end_terrace");
  assert.equal(a.after.notes, "Checked on site.");
  assert.equal(d.json.enquiry.snapshot.property.propertyType, "detached", "what the customer sent is unchanged");
  assert.deepEqual(
    d.json.project.confirmations.map((c) => [c.by, c.current]),
    [
      ["customer", false],
      ["operator", true],
    ]
  );
});

test("status changes and survey requests are recorded with before and after", async () => {
  const t = await login();
  const { id } = await freeEnquiry();
  assert.equal((await api("POST", "operator/enquiries/" + id + "/status", { token: t, body: { status: "nonsense" } })).status, 400);
  assert.equal((await api("POST", "operator/enquiries/" + id + "/status", { token: t, body: { status: "contacted" } })).status, 200);
  assert.equal((await api("POST", "operator/enquiries/" + id + "/request-survey", { token: t })).status, 200);
  const row = (await db.query("SELECT status, survey_requested_at FROM wvr_enquiries WHERE id = $1", [id])).rows[0];
  assert.equal(row.status, "survey_requested");
  assert.ok(row.survey_requested_at);
  const trail = await actions(id);
  assert.deepEqual(
    trail.map((x) => x.action),
    ["status_changed", "survey_requested"]
  );
  assert.deepEqual(trail[0].before, { status: "new" });
  assert.deepEqual(trail[0].after, { status: "contacted" });
  assert.deepEqual(trail[1].before, { status: "contacted" });
  assert.ok(trail.every((x) => x.session_id), "each action names the session");
  const list = await api("GET", "operator/enquiries?status=survey_requested", { token: t });
  assert.ok(list.json.enquiries.some((x) => x.id === id));
  assert.equal((await api("POST", "operator/enquiries/" + id + "/scope", { token: t, body: { propertyType: "detached" } })).status, 409, "no project to correct");
});

test("finding a customer's enquiries by name, email, phone, postcode, address or reference", async () => {
  const t = await login();
  const free = await freeEnquiry();
  const full = await enquiryWithProject({ render: false });
  const find = async (q) => (await api("GET", "operator/enquiries?q=" + encodeURIComponent(q), { token: t })).json.enquiries.map((e) => e.id);
  assert.ok((await find("jo TEST")).includes(free.id), "name, any case");
  assert.ok((await find(free.ref.toLowerCase())).includes(free.id), "reference");
  assert.ok((await find("01514960001")).includes(free.id), "phone digits, spaces ignored");
  assert.ok((await find("+44 151 496 0001".slice(4))).includes(free.id));
  assert.ok((await find("sam@example")).includes(full.id), "email");
  assert.ok((await find("1 test road")).includes(full.id), "the address the customer chose");
  assert.ok((await find("ch45 1ab")).includes(free.id), "postcode");
  assert.deepEqual(await find("nobody by this name"), []);
  assert.deepEqual(await find("_%"), [], "wildcards are matched literally");
  const both = await api("GET", "operator/enquiries?status=contacted&q=" + encodeURIComponent("jo test"), { token: t });
  assert.ok(!both.json.enquiries.some((e) => e.id === free.id), "search and status filter together");
});

test("costs: paid calls by month and provider, today's render budget, the last daily tidy-up", async () => {
  const t = await login();
  await enquiryWithProject({ render: true });
  const c = await api("GET", "operator/costs", { token: t });
  assert.equal(c.status, 200, JSON.stringify(c.json));
  assert.ok(c.json.last30Days.byProvider.some((x) => x.provider === "openai" && x.currency === "USD" && x.calls >= 1));
  assert.ok(c.json.byMonth.some((x) => x.provider === "ideal_postcodes" && x.currency === "GBP" && /^\d{4}-\d{2}$/.test(x.month)));
  assert.ok(c.json.budget.spent > 0, "a settled render counts against today's budget");
  assert.equal(c.json.budget.cap, 5);
  assert.ok(c.json.last30Days.renderCalls.ok >= 1, "renders counted from the paid-call log");
  assert.ok(c.json.held.withPhoto >= 1);
  assert.equal(c.json.retention.projectDays, 30);
  process.env.CRON_SECRET = "test-cron-secret-operator";
  try {
    const run = await call(app, "GET", "/api/wvroofing/cron/daily", { authorization: "Bearer test-cron-secret-operator" });
    assert.equal(run.status, 200);
  } finally {
    delete process.env.CRON_SECRET;
  }
  const after2 = await api("GET", "operator/costs", { token: t });
  assert.ok(after2.json.lastSweep && after2.json.lastSweep.at, "the last tidy-up is shown");
  assert.ok("projectsDeleted" in after2.json.lastSweep.detail);
});

test("the roofer's email can be sent again, only when confirmed, and the history says so", async () => {
  const t = await login();
  mailer.setFixture("fail");
  const { id } = await freeEnquiry();
  await jobs.drain();
  assert.equal((await db.query("SELECT delivery_status FROM wvr_enquiries WHERE id = $1", [id])).rows[0].delivery_status, "failed");
  mailer.setFixture("ok");
  const unconfirmed = await api("POST", "operator/enquiries/" + id + "/resend", { token: t });
  assert.equal(unconfirmed.status, 400);
  assert.equal(unconfirmed.json.error, "confirm_required");
  assert.equal(mailer.outbox.length, 0);
  const r = await api("POST", "operator/enquiries/" + id + "/resend", { token: t, body: { confirm: true } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.outcome, "sent");
  assert.equal(r.json.delivery, "sent");
  assert.equal(mailer.outbox.length, 1);
  const again = await api("POST", "operator/enquiries/" + id + "/resend", { token: t, body: { confirm: true } });
  assert.equal(again.json.outcome, "sent", "even once sent (the roofer says it never arrived)");
  assert.equal(mailer.outbox.length, 2);
  assert.deepEqual(
    (await actions(id)).map((x) => [x.action, x.after.outcome]),
    [
      ["email_resent", "sent"],
      ["email_resent", "sent"],
    ]
  );
  await db.query("UPDATE wvr_enquiries SET delivery_status = 'sending', delivery_lease_until = now() + interval '3 minutes' WHERE id = $1", [id]);
  assert.equal((await api("POST", "operator/enquiries/" + id + "/resend", { token: t, body: { confirm: true } })).status, 409, "not while a send is in progress");
});

// ---------------------------------------------------------------------------
// renders

test("a render that never came back is tried again only when confirmed, once, as a new job", async () => {
  const t = await login();
  const { p, id } = await enquiryWithProject({ render: false });
  openai.setFixture({ mode: "timeout" });
  const r = await api("POST", "projects/" + p.id + "/renders", { token: p.token, body: { visualIds: ["welsh-slate"], idempotencyKey: key() } });
  assert.equal(r.status, 202);
  await jobs.drain();
  const jobId = r.json.renders[0].id;
  const listed = await api("GET", "operator/jobs?status=uncertain", { token: t });
  const j = listed.json.jobs.find((x) => x.id === jobId);
  assert.ok(j, "listed under renders to check");
  assert.equal(j.mayHaveBeenCharged, true);
  assert.equal(j.enquiryId, id);
  openai.setFixture({ mode: "ok" });
  const unconfirmed = await api("POST", "operator/jobs/" + jobId + "/retry", { token: t });
  assert.equal(unconfirmed.status, 400);
  assert.match(unconfirmed.json.message, /may already have been charged/);
  assert.equal(openai.fixtureCalls(), 0, "nothing sent without the operator's OK");
  const ok = await api("POST", "operator/jobs/" + jobId + "/retry", { token: t, body: { confirm: true } });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.created, true);
  assert.notEqual(ok.json.job.id, jobId);
  const twice = await api("POST", "operator/jobs/" + jobId + "/retry", { token: t, body: { confirm: true } });
  assert.equal(twice.json.created, false, "a double click makes one new render, not two");
  assert.equal(twice.json.job.id, ok.json.job.id);
  await jobs.drain();
  assert.equal((await db.query("SELECT status FROM wvr_jobs WHERE id = $1", [ok.json.job.id])).rows[0].status, "succeeded");
  assert.equal((await db.query("SELECT status FROM wvr_jobs WHERE id = $1", [jobId])).rows[0].status, "uncertain", "the old one is left as it was");
  assert.deepEqual(
    (await actions(jobId)).map((x) => x.action),
    ["retried"]
  );
  assert.equal((await api("POST", "operator/jobs/" + ok.json.job.id + "/retry", { token: t, body: { confirm: true } })).status, 409, "a finished render isn't retried");
  await api("POST", "projects/" + p.id + "/consent", { token: p.token, body: { ai: false } });
  const withdrawn = await api("POST", "operator/jobs/" + jobId + "/retry", { token: t, body: { confirm: true } });
  assert.equal(withdrawn.status, 409);
  assert.equal(withdrawn.json.error, "consent_required", "the customer's OK to use OpenAI must still stand");
});

// ---------------------------------------------------------------------------
// deleting

test("deleting the project keeps the enquiry; deleting the enquiry takes its project; both are recorded", async () => {
  const t = await login();
  const a = await enquiryWithProject();
  assert.equal((await api("POST", "operator/projects/" + a.p.id + "/delete", { token: t })).status, 200);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM wvr_projects WHERE id = $1", [a.p.id])).rows[0].n, 0);
  assert.equal((await db.query("SELECT project_id FROM wvr_enquiries WHERE id = $1", [a.id])).rows[0].project_id, null, "the enquiry stays, without its project");
  assert.deepEqual(await storage().list("projects/" + a.p.id + "/"), [], "its files are gone");
  const d = await api("GET", "operator/enquiries/" + a.id, { token: t });
  assert.equal(d.json.project, null);
  assert.match(d.json.enquiry.snapshot.address.lines[0], /1 Test Road/, "what was sent can still be read");

  const b = await enquiryWithProject({ render: false });
  assert.equal((await api("POST", "operator/enquiries/" + b.id + "/delete", { token: t })).status, 200);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM wvr_enquiries WHERE id = $1", [b.id])).rows[0].n, 0);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM wvr_projects WHERE id = $1", [b.p.id])).rows[0].n, 0);
  assert.deepEqual(await storage().list("projects/" + b.p.id + "/"), []);
  assert.equal((await api("GET", "operator/enquiries/" + b.id, { token: t })).status, 404);
  assert.equal((await api("GET", "projects/" + b.p.id, { token: b.p.token })).status, 404, "the customer's key opens nothing now");
  assert.deepEqual(
    (await actions(a.p.id)).map((x) => x.target_type + ":" + x.action),
    ["project:deleted"]
  );
  const gone = await actions(b.id);
  assert.deepEqual(
    gone.map((x) => x.target_type + ":" + x.action),
    ["enquiry:deleted"]
  );
  assert.equal(gone[0].before.reference, b.ref, "the history outlives what was deleted");
});

test("the daily sweep drops ended sessions and login attempts after 7 days, the history after 12 months", async () => {
  const t = await login();
  await db.query("UPDATE wvr_operator_sessions SET expires_at = now() - interval '8 days' WHERE token_hash = $1", [auth.hashToken(t)]);
  await db.query("INSERT INTO wvr_login_attempts (ip_hash, ok, created_at) VALUES ('old', false, now() - interval '8 days')");
  await db.query("INSERT INTO wvr_operator_actions (target_type, target_id, action, created_at) VALUES ('enquiry', 'old', 'status_changed', now() - interval '13 months')");
  await db.query("INSERT INTO wvr_operator_actions (target_type, target_id, action, created_at) VALUES ('enquiry', 'recent', 'status_changed', now() - interval '11 months')");
  const out = await auth.purgeOperatorRecords();
  assert.ok(out.operatorSessionsPurged >= 1);
  assert.ok(out.loginAttemptsPurged >= 1);
  assert.equal(out.operatorActionsPurged, 1);
  assert.deepEqual(
    (await db.query("SELECT target_id FROM wvr_operator_actions WHERE target_id IN ('old', 'recent')")).rows.map((r) => r.target_id),
    ["recent"]
  );
  assert.equal((await db.query("SELECT count(*)::int AS n FROM wvr_operator_sessions WHERE token_hash = $1", [auth.hashToken(t)])).rows[0].n, 0);
  const live = await login();
  assert.equal((await auth.purgeOperatorRecords()).operatorSessionsPurged, 0, "a live session is kept");
  assert.equal((await api("GET", "operator/session", { token: live })).status, 200);
});

// ---------------------------------------------------------------------------
// the page

test("the operator page is never indexed, and nothing links to it", () => {
  const html = fs.readFileSync(path.join(repo, "public/WVROOFING/operator/index.html"), "utf8");
  assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, "no inline script");
  const walk = (dir, out) => {
    for (const name of fs.readdirSync(dir)) {
      const f = path.join(dir, name);
      if (fs.statSync(f).isDirectory()) walk(f, out);
      else if (/\.(html|js|mjs|ts|tsx|txt|xml|json)$/.test(name)) out.push(f);
    }
    return out;
  };
  const own = [path.join(repo, "public", "WVROOFING", "operator"), path.join(repo, "public", "WVROOFING", "assets", "js", "operator")];
  const files = walk(path.join(repo, "public"), []).concat(walk(path.join(repo, "src"), []));
  const linking = files.filter((f) => !own.some((d) => f.startsWith(d)) && /WVROOFING\/operator/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(linking, [], "linked from nowhere");
});
