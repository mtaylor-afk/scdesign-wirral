// How long everything is kept, and that deleting really deletes (A7; plan §4.5,
// docs/wvroofing/retention.md). Test environment: PGlite, local storage, stand-ins.
import os from "node:os";
import path from "node:path";
process.env.WVR_ENV = "test";
process.env.WVR_FS_STORAGE_DIR = path.join(os.tmpdir(), "wvr-retention-test-" + process.pid);
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
process.env.CRON_SECRET = "test-cron-secret-retention";

import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { load, call, repo, removeTempDir, apiFor, customerJourney } from "./helpers.mjs";

const app = load("api/wvroofing/app.js");
const db = load("serverlib/wvroofing/db.js");
const jobs = load("serverlib/wvroofing/jobs.js");
const mailer = load("serverlib/wvroofing/mailer.js");
const openai = load("serverlib/wvroofing/openai.js");
const { RETENTION } = load("serverlib/wvroofing/retention.js");
const { storage } = load("serverlib/wvroofing/storage.js");
const api = apiFor(app);

after(async () => {
  await jobs.drain();
  await db.reset();
  removeTempDir(process.env.WVR_FS_STORAGE_DIR);
});

beforeEach(async () => {
  await jobs.drain();
  mailer.setFixture("ok");
  openai.setFixture({ mode: "ok", latencyMs: 0 });
});

async function tidyUp() {
  const r = await call(app, "GET", "/api/wvroofing/cron/daily", { authorization: "Bearer " + process.env.CRON_SECRET });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.ran, true);
  return r.json.detail;
}

async function count(table, where, params) {
  return (await db.query("SELECT count(*)::int AS n FROM " + table + " WHERE " + where, params)).rows[0].n;
}

const PROJECT_TABLES = ["wvr_uploads", "wvr_photos", "wvr_masks", "wvr_jobs", "wvr_addresses", "wvr_property_confirmations"];

/** Everything a project owned is gone: rows in every table, and every file under its folder. */
async function assertGone(projectId) {
  assert.equal(await count("wvr_projects", "id = $1", [projectId]), 0, "the project");
  for (const t of PROJECT_TABLES) assert.equal(await count(t, "project_id = $1", [projectId]), 0, t);
  assert.deepEqual(await storage().list("projects/" + projectId + "/"), [], "its files");
}

// ---------------------------------------------------------------------------

test("the privacy notice, the photo notice and the retention record state the periods the code uses", () => {
  const privacy = fs.readFileSync(path.join(repo, "public/WVROOFING/privacy/index.html"), "utf8");
  assert.match(privacy, new RegExp("kept for " + RETENTION.projectDays + " days \\(" + RETENTION.enquiryMonths + " months if you send an enquiry\\)"));
  assert.match(privacy, new RegExp("deleted automatically after " + RETENTION.projectDays + " days"));
  assert.match(privacy, new RegExp("for " + RETENTION.enquiryMonths + " months, then delete them automatically"));
  const vis = fs.readFileSync(path.join(repo, "public/WVROOFING/visualiser/index.html"), "utf8");
  assert.match(vis, new RegExp(RETENTION.projectDays + " days"), "the photo notice");
  // Version 2 keeps photos in the same store, so its pages state the same periods.
  const about2 = fs.readFileSync(path.join(repo, "public/WVROOFING/2/about/index.html"), "utf8");
  assert.match(about2, new RegExp("deleted automatically after " + RETENTION.projectDays + " days"), "v2 About");
  assert.match(about2, new RegExp("kept with your enquiry for " + RETENTION.enquiryMonths + " months"), "v2 About");
  assert.match(about2, new RegExp("kept for " + RETENTION.enquiryMonths + " months, then deleted automatically"), "v2 About: enquiries");
  const cam = fs.readFileSync(path.join(repo, "public/WVROOFING/2/roof-cam/index.html"), "utf8");
  assert.match(cam, new RegExp("for " + RETENTION.projectDays + " days, or with your enquiry"), "the Roof Cam's photo notice");
  const home2 = fs.readFileSync(path.join(repo, "public/WVROOFING/2/index.html"), "utf8");
  assert.match(home2, new RegExp("kept for " + RETENTION.projectDays + " days, or for " + RETENTION.enquiryMonths + " months with your enquiry"), "v2 bulletin FAQ");
  const record = fs.readFileSync(path.join(repo, "docs/wvroofing/retention.md"), "utf8");
  const units = { Days: "days", Months: "months", Hours: "hours" };
  for (const [name, value] of Object.entries(RETENTION)) {
    const unit = Object.entries(units).find(([suffix]) => name.endsWith(suffix))[1];
    assert.ok(record.includes("`" + name + "`") && record.includes(value + " " + unit), "retention.md: " + name + " = " + value + " " + unit);
  }
});

test("a project with no enquiry lasts 30 days, then goes: rows in every table, and every file", async () => {
  const j = await customerJourney(api, { render: true, enquiry: false });
  const p = (await db.query("SELECT created_at, expires_at FROM wvr_projects WHERE id = $1", [j.p.id])).rows[0];
  assert.equal(Math.round((new Date(p.expires_at) - new Date(p.created_at)) / 86400000), RETENTION.projectDays);
  assert.ok((await storage().list("projects/" + j.p.id + "/")).length >= 4, "original, working copy, render and composite");
  await tidyUp();
  assert.equal(await count("wvr_projects", "id = $1", [j.p.id]), 1, "not yet due");
  const calls = await count("wvr_provider_calls", "project_id = $1", [j.p.id]);
  assert.ok(calls >= 2, "an address lookup and a render were logged");
  await db.query("UPDATE wvr_projects SET expires_at = now() - interval '1 minute' WHERE id = $1", [j.p.id]);
  const d = await tidyUp();
  assert.ok(d.projectsDeleted >= 1);
  assert.ok(d.filesDeleted >= 4);
  await assertGone(j.p.id);
  assert.equal((await api("GET", "projects/" + j.p.id, { token: j.p.token })).status, 404, "the customer's key opens nothing");
  assert.equal(await count("wvr_provider_calls", "project_id IS NULL AND provider = 'openai'", []) >= 1, true, "the paid-call log stays, without the project");
});

test("an enquiry keeps its project for 12 months; then both go", async () => {
  const j = await customerJourney(api, { render: true, enquiry: true });
  const p = (await db.query("SELECT expires_at FROM wvr_projects WHERE id = $1", [j.p.id])).rows[0];
  const days = (new Date(p.expires_at) - Date.now()) / 86400000;
  assert.ok(days > 360 && days < 370, "kept about a year: " + days);
  await db.query("UPDATE wvr_projects SET created_at = now() - interval '40 days' WHERE id = $1", [j.p.id]);
  await tidyUp();
  assert.equal(await count("wvr_projects", "id = $1", [j.p.id]), 1, "past 30 days, but it has an enquiry");
  await db.query("UPDATE wvr_enquiries SET created_at = now() - make_interval(months => $2, days => 1) WHERE id = $1", [j.id, RETENTION.enquiryMonths]);
  await db.query("UPDATE wvr_projects SET expires_at = now() - interval '1 day' WHERE id = $1", [j.p.id]);
  const d = await tidyUp();
  assert.ok(d.enquiriesDeleted >= 1);
  assert.equal(await count("wvr_enquiries", "id = $1", [j.id]), 0);
  await assertGone(j.p.id);
});

test("a customer who deletes their photo and project keeps their enquiry", async () => {
  const j = await customerJourney(api, { render: true, enquiry: true });
  const r = await api("POST", "projects/" + j.p.id + "/delete", { token: j.p.token });
  assert.equal(r.status, 200);
  await assertGone(j.p.id);
  const e = (await db.query("SELECT project_id, snapshot, contact_name FROM wvr_enquiries WHERE id = $1", [j.id])).rows[0];
  assert.equal(e.project_id, null, "kept, without its project");
  assert.equal(e.contact_name, "Sam Test");
  assert.match(e.snapshot.address.lines[0], /1 Test Road/, "what was sent can still be read");
});

test("uploads never committed go after 24 hours with their file; records of committed ones too", async () => {
  const p = (await api("POST", "projects", { body: { noticeShown: true } })).json;
  const pre = (await api("POST", "projects/" + p.id + "/photo/presign", { token: p.token, body: { contentType: "image/jpeg", bytes: 3 } })).json;
  const pathname = new URL(pre.url, "http://localhost").searchParams.get("path");
  await storage().put(pathname, Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg");
  await tidyUp();
  assert.ok((await storage().list("projects/" + p.id + "/incoming/")).includes(pathname), "not yet due");
  await db.query("UPDATE wvr_uploads SET created_at = now() - make_interval(hours => $2 + 1) WHERE id = $1", [pre.uploadId, RETENTION.uploadHours]);
  const d = await tidyUp();
  assert.ok(d.staleUploadsRemoved >= 1);
  assert.deepEqual(await storage().list("projects/" + p.id + "/incoming/"), [], "the file");
  assert.equal(await count("wvr_uploads", "id = $1", [pre.uploadId]), 0, "the record");

  const j = await customerJourney(api, { enquiry: false });
  const used = (await db.query("SELECT id FROM wvr_uploads WHERE project_id = $1 AND consumed_at IS NOT NULL", [j.p.id])).rows[0];
  await db.query("UPDATE wvr_uploads SET consumed_at = now() - make_interval(hours => $2 + 1) WHERE id = $1", [used.id, RETENTION.uploadHours]);
  const d2 = await tidyUp();
  assert.ok(d2.uploadRecordsPurged >= 1);
  assert.equal(await count("wvr_uploads", "id = $1", [used.id]), 0);
  assert.equal(await count("wvr_photos", "project_id = $1", [j.p.id]), 1, "the photo itself stays");
});

test("records that outlive their projects: paid calls and the budget after 13 months, the sweep's own record after 90 days, dead leases", async () => {
  await db.query(
    "INSERT INTO wvr_provider_calls (provider, endpoint, status, cost, created_at) VALUES ('openai', 'images/edits', 'ok', 0.05, now() - interval '14 months'), ('openai', 'images/edits', 'ok', 0.05, now() - interval '12 months')"
  );
  await db.query(
    "INSERT INTO wvr_budget_days (day, spent_usd) VALUES ((now() - interval '14 months')::date, 1), ((now() - interval '12 months')::date, 1) ON CONFLICT (day) DO NOTHING"
  );
  await db.query("INSERT INTO wvr_retention_runs (kind, started_at) VALUES ('test-old', now() - interval '91 days'), ('test-recent', now() - interval '89 days')");
  await db.query("INSERT INTO wvr_leases (name, holder, until) VALUES ('test:dead', 'x', now() - interval '2 days'), ('test:live', 'y', now() + interval '1 hour')");
  const d = await tidyUp();
  assert.ok(d.providerCallsPurged >= 1);
  assert.equal(await count("wvr_provider_calls", "created_at < now() - interval '13 months'", []), 0);
  assert.ok((await count("wvr_provider_calls", "created_at < now() - interval '11 months'", [])) >= 1, "a year's cost history stays");
  assert.equal(await count("wvr_budget_days", "day < (now() - interval '13 months')::date", []), 0);
  assert.ok((await count("wvr_budget_days", "day < (now() - interval '11 months')::date", [])) >= 1);
  assert.equal(await count("wvr_retention_runs", "kind = 'test-old'", []), 0);
  assert.equal(await count("wvr_retention_runs", "kind = 'test-recent'", []), 1);
  assert.deepEqual(
    (await db.query("SELECT name FROM wvr_leases WHERE name LIKE 'test:%' ORDER BY name")).rows.map((r) => r.name),
    ["test:live"]
  );
});

test("the tidy-up can run twice (a missed or repeated cron) and every run is recorded", async () => {
  const before = await count("wvr_retention_runs", "kind = 'daily'", []);
  await tidyUp();
  await tidyUp();
  assert.equal(await count("wvr_retention_runs", "kind = 'daily'", []), before + 2);
  const last = (await db.query("SELECT detail FROM wvr_retention_runs WHERE kind = 'daily' ORDER BY id DESC LIMIT 1")).rows[0].detail;
  for (const k of ["projectsDeleted", "staleUploadsRemoved", "uploadRecordsPurged", "rateLimitRowsPurged", "enquiriesDeleted", "operatorSessionsPurged", "providerCallsPurged", "renderFilesDeleted"]) {
    assert.ok(k in last, k);
  }
});
