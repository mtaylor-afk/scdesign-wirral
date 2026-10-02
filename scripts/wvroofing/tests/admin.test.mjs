// The admin pages' API: the owner's set-up checklist on /health, the enquiry list
// with contact details, the Overview counts (one site or both) and the enquiries
// as a spreadsheet (CSV), with formula-safe cells and an audit row per download.
// Test environment only: the throwaway test password, PGlite, local storage and
// the email and address stand-ins.
import os from "node:os";
import path from "node:path";
process.env.WVR_ENV = "test";
process.env.WVR_FS_STORAGE_DIR = path.join(os.tmpdir(), "wvr-admin-test-" + process.pid);
process.env.WVR_CAP_ENQUIRY_DELIVERY = "on";
process.env.WVR_CAP_ADDRESS_LOOKUP = "on";
process.env.WVR_CAP_AERIAL_DISPLAY = "on";
process.env.WVR_UPSTREAM_IPM = "1000";
process.env.WVR_PROJECTS_PER_IP_DAILY = "1000";
process.env.WVR_DAILY_UPLOADS = "1000";
process.env.WVR_ENQUIRIES_PER_IP_HOURLY = "1000";
process.env.WVR_ADDRESS_LOOKUPS_PER_IP = "1000";
process.env.WVR_ADDRESS_LOOKUPS_DAILY = "1000";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { load, removeTempDir, apiFor, customerJourney } from "./helpers.mjs";

const app = load("api/wvroofing/app.js");
const db = load("serverlib/wvroofing/db.js");
const jobs = load("serverlib/wvroofing/jobs.js");
const auth = load("serverlib/wvroofing/auth.js");
const mailer = load("serverlib/wvroofing/mailer.js");
const images = load("serverlib/wvroofing/images.js");
const router = load("serverlib/wvroofing/router.js");
const operator = load("serverlib/wvroofing/operator.js");
const health = load("serverlib/wvroofing/health.js");
const { capabilities } = load("serverlib/wvroofing/capabilities.js");
const { VISUALS } = load("serverlib/wvroofing/core.js");
const { storage } = load("serverlib/wvroofing/storage.js");

const HASH = auth.hashPassword(auth.TEST_OPERATOR_PASSWORD);
process.env.WVR_OPERATOR_PASSWORD_HASH = HASH;

const api = apiFor(app);
let n = 0;
const key = () => "adminkey" + String(++n).padStart(8, "0");
let ipN = 0;
const nextIp = () => "192.0.2." + ++ipN;

const ok = (r, want) => {
  assert.equal(r.status, want, JSON.stringify(r.json));
  return r.json;
};

async function login() {
  return ok(await api("POST", "operator/login", { body: { password: auth.TEST_OPERATOR_PASSWORD }, ip: nextIp() }), 200).token;
}

async function jpeg(w, h, shade = 120) {
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const v = shade + 40 * Math.sin(x / 37) + 25 * Math.cos(y / 23);
      raw[i] = v;
      raw[i + 1] = v * 0.9;
      raw[i + 2] = v * 0.8;
    }
  return images.sharp()(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 85 }).toBuffer();
}

/** A project on one site with a committed photo (as photos.test.mjs). */
async function photoProject(site) {
  const p = ok(await api("POST", "projects", { body: { noticeShown: true, site } }), 201);
  const buf = await jpeg(900, 600);
  const pre = ok(await api("POST", "projects/" + p.id + "/photo/presign", { token: p.token, body: { contentType: "image/jpeg", bytes: buf.length } }), 200);
  await storage().put(new URL(pre.url, "http://localhost").searchParams.get("path"), buf, "image/jpeg");
  ok(await api("POST", "projects/" + p.id + "/photo/commit", { token: p.token, body: { uploadId: pre.uploadId } }), 200);
  return p;
}

async function idOf(reference) {
  return (await db.query("SELECT id FROM wvr_enquiries WHERE reference = $1", [reference])).rows[0].id;
}

/** A small CSV reader (quoted fields, doubled quotes, CRLF lines) for checking the export. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" && text[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else cell += ch;
  }
  if (cell || row.length) rows.push(row.concat([cell]));
  return rows;
}

async function exportCsv(query, token) {
  const r = await api("GET", "operator/export/enquiries" + (query ? "?" + query : ""), { token });
  assert.equal(r.status, 200, r.res.body);
  const rows = parseCsv(r.res.body.replace(/^﻿/, ""));
  const head = rows[0];
  return { r, head, rows: rows.slice(1).map((cells) => Object.fromEntries(head.map((h, i) => [h, cells[i]]))) };
}

async function exportAudits() {
  return (await db.query("SELECT after, session_id FROM wvr_operator_actions WHERE target_type = 'enquiry' AND target_id = 'export' AND action = 'exported' ORDER BY id")).rows;
}

// ---------------------------------------------------------------------------
// The customers both sites have, made once:
//   A  version 1: the Roof Visualiser with their own photo (sent 10 days ago)
//   B  version 2: the Roof Cam, photo, one preview from their device, an enquiry
//      (its email may not have arrived; they said yes to marketing)
//   C  version 2: the bulletin's form, no photo, already contacted, a name that
//      looks like a spreadsheet formula and a phone number starting "+"
//   D  version 1: a photo (taken 8 days ago) with no enquiry

const f = {};
let token;

before(async () => {
  mailer.setFixture("ok");
  const a = await customerJourney(api, { render: false });
  f.A = { id: a.id, ref: a.ref, p: a.p };

  const b = await photoProject("v2");
  const mock = "data:image/jpeg;base64," + (await jpeg(800, 533, 90)).toString("base64");
  ok(await api("POST", "projects/" + b.id + "/mockups", { token: b.token, body: { visualId: "spanish-slate", condition: "dusk", jpeg: mock } }), 201);
  const be = ok(
    await api("POST", "projects/" + b.id + "/enquiry", {
      token: b.token,
      body: { name: "Robin Cam", phone: "0151 496 0002", postcode: "CH45 1AB", product: "spanish-slate", message: "Front slope only.", consent: true, elapsedMs: 9000, includeImages: true, idempotencyKey: key() },
    }),
    201
  );
  f.B = { id: await idOf(be.reference), ref: be.reference, p: b };

  const ce = ok(
    await api("POST", "enquiries", {
      body: { name: '=HYPERLINK("x")', phone: "+44 151 496 0003", email: "c@example.com", message: "Ring after 5pm.", consent: true, source: "bulletin", elapsedMs: 9000, idempotencyKey: key() },
    }),
    201
  );
  f.C = { id: await idOf(ce.reference), ref: ce.reference };

  f.D = { p: await photoProject("v1") };
  await jobs.drain();

  await db.query("UPDATE wvr_enquiries SET created_at = now() - interval '10 days' WHERE id = $1", [f.A.id]);
  await db.query("UPDATE wvr_enquiries SET delivery_status = 'uncertain', marketing_opt_in = true WHERE id = $1", [f.B.id]);
  await db.query("UPDATE wvr_photos SET created_at = now() - interval '8 days' WHERE project_id = $1", [f.D.p.id]);
  token = await login();
  ok(await api("POST", "operator/enquiries/" + f.C.id + "/status", { token, body: { status: "contacted" } }), 200);
});

after(async () => {
  await jobs.drain();
  await db.reset();
  removeTempDir(process.env.WVR_FS_STORAGE_DIR);
});

// ---------------------------------------------------------------------------
// the set-up checklist on /health

test("health: the set-up checklist is yes or no for each setting, never a value", async () => {
  const h = ok(await api("GET", "health"), 200);
  assert.deepEqual(Object.keys(h.setup).sort(), ["adminPassword", "cronSecret", "database", "enquiryEmail", "photoStore", "sessionSecret"]);
  assert.ok(Object.values(h.setup).every((v) => typeof v === "boolean"), "booleans only");
  assert.deepEqual(h.setup, { database: true, photoStore: true, sessionSecret: true, cronSecret: true, adminPassword: true, enquiryEmail: true }, "the test environment's stand-ins count as set");

  const saved = { secret: process.env.WVR_SESSION_SECRET, cron: process.env.CRON_SECRET };
  process.env.WVR_SESSION_SECRET = "session-value-" + process.pid + "-abcdef";
  process.env.CRON_SECRET = "cron-value-" + process.pid + "-abcdef";
  try {
    const raw = (await api("GET", "health")).res.body;
    for (const v of [process.env.WVR_SESSION_SECRET, process.env.CRON_SECRET, HASH, HASH.split(":")[4], HASH.split(":")[5]]) assert.ok(!raw.includes(v), "no setting's value is shown");
  } finally {
    if (saved.secret === undefined) delete process.env.WVR_SESSION_SECRET;
    else process.env.WVR_SESSION_SECRET = saved.secret;
    if (saved.cron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved.cron;
  }

  try {
    delete process.env.WVR_OPERATOR_PASSWORD_HASH;
    assert.equal(ok(await api("GET", "health"), 200).setup.adminPassword, false, "no admin password yet");
    process.env.WVR_OPERATOR_PASSWORD_HASH = "pasted the password itself";
    assert.equal(ok(await api("GET", "health"), 200).setup.adminPassword, false, "a value that isn't a hash can never log in, so it isn't set");
    delete process.env.WVR_CAP_ENQUIRY_DELIVERY;
    assert.equal(ok(await api("GET", "health"), 200).setup.enquiryEmail, false, "enquiry emails switched off");
  } finally {
    process.env.WVR_OPERATOR_PASSWORD_HASH = HASH;
    process.env.WVR_CAP_ENQUIRY_DELIVERY = "on";
  }
});

test("the set-up checklist outside the test environment follows each setting", () => {
  const bare = {};
  assert.deepEqual(health.setupState(bare, capabilities(bare)), { database: false, photoStore: false, sessionSecret: false, cronSecret: false, adminPassword: false, enquiryEmail: false });
  const full = {
    WVR_DATABASE_URL: "postgres://user@db.example/wvr",
    BLOB_READ_WRITE_TOKEN: "x",
    WVR_SESSION_SECRET: "x",
    CRON_SECRET: "x",
    WVR_OPERATOR_PASSWORD_HASH: HASH,
    WVR_LEAD_TO: "roofer@example.com",
    WVR_MAIL_DRYRUN: "1",
    WVR_CAP_ENQUIRY_DELIVERY: "on",
  };
  assert.deepEqual(health.setupState(full, capabilities(full)), { database: true, photoStore: true, sessionSecret: true, cronSecret: true, adminPassword: true, enquiryEmail: true });
  const noBlob = Object.assign({}, full, { BLOB_READ_WRITE_TOKEN: "" });
  assert.equal(health.setupState(noBlob, capabilities(noBlob)).photoStore, false);
  // Email set up but no storage yet: email says yes (storage has its own lines saying no).
  const emailOnly = { WVR_LEAD_TO: "roofer@example.com", WVR_MAIL_DRYRUN: "1", WVR_CAP_ENQUIRY_DELIVERY: "on" };
  const s = health.setupState(emailOnly, capabilities(emailOnly));
  assert.equal(s.enquiryEmail, true);
  assert.equal(s.database, false);
});

test("logins sent all at once can't get round the lockout", async () => {
  await db.query("DELETE FROM wvr_login_attempts");
  const ip = nextIp();
  const answers = await Promise.all(Array.from({ length: 30 }, (_, i) => api("POST", "operator/login", { body: { password: "wrong guess " + i }, ip })));
  const wrong = answers.filter((r) => r.status === 401).length;
  const locked = answers.filter((r) => r.status === 429).length;
  assert.ok(wrong <= 5, wrong + " passwords were checked (the limit is 5)");
  assert.equal(wrong + locked, 30);
  const { rows } = await db.query("SELECT count(*)::int AS n FROM wvr_login_attempts WHERE NOT ok");
  assert.equal(rows[0].n, wrong, "only the checked ones are recorded");
  // The right password from elsewhere still works, and its record turns into a success.
  await login();
  const okRows = await db.query("SELECT count(*)::int AS n FROM wvr_login_attempts WHERE ok");
  assert.equal(okRows.rows[0].n, 1);
  await db.query("DELETE FROM wvr_login_attempts");
});

// ---------------------------------------------------------------------------
// the list, with contact details

test("the enquiry list carries each customer's email, phone, message, photo, previews and marketing choice", async () => {
  const list = ok(await api("GET", "operator/enquiries", { token }), 200).enquiries;
  assert.deepEqual(
    list.map((e) => e.reference),
    [f.C.ref, f.B.ref, f.A.ref],
    "newest first"
  );
  const by = Object.fromEntries(list.map((e) => [e.reference, e]));
  const pick = (e) => ({ email: e.email, phone: e.phone, message: e.message, hasPhoto: e.hasPhoto, previews: e.previews, marketing: e.marketing, site: e.site });
  assert.deepEqual(pick(by[f.A.ref]), { email: "sam@example.com", phone: "0151 496 0000", message: null, hasPhoto: true, previews: 0, marketing: false, site: "v1" });
  assert.deepEqual(pick(by[f.B.ref]), { email: null, phone: "0151 496 0002", message: "Front slope only.", hasPhoto: true, previews: 1, marketing: true, site: "v2" });
  assert.deepEqual(pick(by[f.C.ref]), { email: "c@example.com", phone: "+44 151 496 0003", message: "Ring after 5pm.", hasPhoto: false, previews: 0, marketing: false, site: "v2" });
  // The fields that were there before are still there.
  assert.equal(by[f.A.ref].name, "Sam Test");
  assert.match(by[f.A.ref].address, /1 Test Road/);
  assert.equal(by[f.A.ref].hasProject, true);
  assert.equal(by[f.C.ref].status, "contacted");

  const one = ok(await api("GET", "operator/enquiries?limit=1", { token }), 200).enquiries;
  assert.deepEqual(
    one.map((e) => e.reference),
    [f.C.ref]
  );
  for (const limit of ["0", "-3", "abc", "100000"]) {
    const r = ok(await api("GET", "operator/enquiries?limit=" + limit, { token }), 200).enquiries;
    assert.equal(r.length, limit === "-3" ? 1 : 3, "limit=" + limit);
  }
});

// ---------------------------------------------------------------------------
// the Overview

test("overview: counts and the newest enquiries for both sites", async () => {
  for (const q of ["", "?site=both", "?site=v3"]) {
    const o = ok(await api("GET", "operator/overview" + q, { token }), 200);
    assert.equal(o.site, null, q);
    assert.ok(Math.abs(Date.parse(o.generatedAt) - Date.now()) < 60000);
    assert.deepEqual(o.enquiries, {
      total: 3,
      last7Days: 2,
      last30Days: 3,
      awaitingContact: 2,
      emailProblems: 1,
      byStatus: { new: 2, contacted: 1, survey_requested: 0, quoted: 0, closed: 0, spam_suspected: 0 },
      bySource: { "roof-replacement": 0, visualiser: 1, "visualiser-sample": 0, "roof-cam": 1, "roof-cam-sample": 0, bulletin: 1 },
    });
    assert.deepEqual(o.photos, { held: 3, withEnquiry: 2, withoutEnquiry: 1, last7Days: 2, previews: 1 });
    assert.deepEqual(
      o.recent.map((e) => e.reference),
      [f.C.ref, f.B.ref, f.A.ref]
    );
  }
  const o = ok(await api("GET", "operator/overview", { token }), 200);
  const a = o.recent.find((e) => e.reference === f.A.ref);
  assert.deepEqual(Object.keys(a).sort(), ["createdAt", "hasPhoto", "id", "name", "postcode", "reference", "roof", "site", "source", "status"]);
  assert.deepEqual(
    { id: a.id, name: a.name, site: a.site, source: a.source, status: a.status, roof: a.roof, postcode: a.postcode, hasPhoto: a.hasPhoto },
    { id: f.A.id, name: "Sam Test", site: "v1", source: "visualiser", status: "new", roof: "welsh-slate", postcode: "CH45 1AB", hasPhoto: true }
  );
  const c = o.recent.find((e) => e.reference === f.C.ref);
  assert.deepEqual({ site: c.site, source: c.source, status: c.status, roof: c.roof, postcode: c.postcode, hasPhoto: c.hasPhoto }, { site: "v2", source: "bulletin", status: "contacted", roof: null, postcode: null, hasPhoto: false });
});

test("overview: one site at a time (enquiries by where they were sent from, photos by their project)", async () => {
  const v1 = ok(await api("GET", "operator/overview?site=v1", { token }), 200);
  assert.equal(v1.site, "v1");
  assert.deepEqual(v1.enquiries, {
    total: 1,
    last7Days: 0,
    last30Days: 1,
    awaitingContact: 1,
    emailProblems: 0,
    byStatus: { new: 1, contacted: 0, survey_requested: 0, quoted: 0, closed: 0, spam_suspected: 0 },
    bySource: { "roof-replacement": 0, visualiser: 1, "visualiser-sample": 0 },
  });
  assert.deepEqual(v1.photos, { held: 2, withEnquiry: 1, withoutEnquiry: 1, last7Days: 1, previews: 0 });
  assert.deepEqual(
    v1.recent.map((e) => e.reference),
    [f.A.ref]
  );

  const v2 = ok(await api("GET", "operator/overview?site=v2", { token }), 200);
  assert.equal(v2.site, "v2");
  assert.deepEqual(v2.enquiries, {
    total: 2,
    last7Days: 2,
    last30Days: 2,
    awaitingContact: 1,
    emailProblems: 1,
    byStatus: { new: 1, contacted: 1, survey_requested: 0, quoted: 0, closed: 0, spam_suspected: 0 },
    bySource: { "roof-cam": 1, "roof-cam-sample": 0, bulletin: 1 },
  });
  assert.deepEqual(v2.photos, { held: 1, withEnquiry: 1, withoutEnquiry: 0, last7Days: 1, previews: 1 });
  assert.deepEqual(
    v2.recent.map((e) => e.reference),
    [f.C.ref, f.B.ref]
  );
  // The Photos tab lists the same photos the Overview counts.
  assert.equal(ok(await api("GET", "operator/projects?site=v1", { token }), 200).total, v1.photos.held);
  assert.equal(ok(await api("GET", "operator/projects?site=v2", { token }), 200).total, v2.photos.held);
});

// ---------------------------------------------------------------------------
// the spreadsheet

test("spreadsheet cells: always quoted, quotes doubled, formulas made harmless", () => {
  assert.equal(operator.csvCell("plain"), '"plain"');
  assert.equal(operator.csvCell('say "hi", then go'), '"say ""hi"", then go"');
  assert.equal(operator.csvCell(null), '""');
  assert.equal(operator.csvCell(undefined), '""');
  assert.equal(operator.csvCell(3), '"3"');
  for (const lead of ["=", "+", "-", "@", "\t", "\r"]) assert.equal(operator.csvCell(lead + "SUM(A1)"), "\"'" + lead + 'SUM(A1)"', JSON.stringify(lead));
  assert.equal(operator.csvCell(" =1"), '" =1"', "only a leading character counts");
  assert.equal(operator.csvRow(["a", 'b"c', 2]), '"a","b""c","2"\r\n');
  // UK time, whether GMT or BST.
  assert.equal(operator.londonTime("2026-01-15T09:05:00Z"), "2026-01-15 09:05");
  assert.equal(operator.londonTime("2026-07-01T23:30:00Z"), "2026-07-02 00:30");
  assert.equal(operator.londonTime(null), "");
});

test("export: every enquiry as a CSV download, in the agreed columns, safe to open in a spreadsheet", async () => {
  const auditsBefore = (await exportAudits()).length;
  const { r, head, rows } = await exportCsv("", token);
  assert.equal(r.headers["content-type"], "text/csv; charset=utf-8");
  assert.match(r.headers["content-disposition"], /^attachment; filename="wv-roofing-enquiries-\d{4}-\d{2}-\d{2}\.csv"$/);
  assert.equal(r.headers["content-disposition"], 'attachment; filename="wv-roofing-enquiries-' + operator.londonTime(new Date()).slice(0, 10) + '.csv"');
  assert.equal(r.headers["cache-control"], "private, no-store");
  assert.equal(Number(r.headers["content-length"]), Buffer.byteLength(r.res.body, "utf8"));
  const body = r.res.body;
  assert.ok(body.startsWith("﻿"), "a byte-order mark, so Excel reads it as UTF-8");
  assert.ok(body.endsWith("\r\n"));
  assert.doesNotMatch(body, /[^\r]\n/, "every line ends CRLF");
  const lines = body.slice(1).split("\r\n").slice(0, -1);
  assert.equal(lines.length, 4, "a header and three enquiries");
  for (const line of lines) assert.match(line, /^"(?:[^"]|"")*"(?:,"(?:[^"]|"")*")*$/, "every field in double quotes: " + line);
  assert.deepEqual(head, [
    "Reference",
    "Saved",
    "Site",
    "From page",
    "Status",
    "Name",
    "Phone",
    "Email",
    "Postcode",
    "Address",
    "Roof choice",
    "Message",
    "Photo",
    "Previews",
    "Email to roofer",
    "Marketing",
  ]);
  assert.deepEqual(head, operator.EXPORT_COLUMNS);
  assert.deepEqual(
    rows.map((x) => x.Reference),
    [f.C.ref, f.B.ref, f.A.ref],
    "newest first"
  );

  const welsh = VISUALS.get("welsh-slate");
  const spanish = VISUALS.get("spanish-slate");
  const created = (await db.query("SELECT created_at FROM wvr_enquiries WHERE id = $1", [f.A.id])).rows[0].created_at;
  assert.deepEqual(rows[2], {
    Reference: f.A.ref,
    Saved: operator.londonTime(created),
    Site: "Version 1",
    "From page": "Roof Visualiser, own photo (version 1)",
    Status: "New",
    Name: "Sam Test",
    Phone: "0151 496 0000",
    Email: "sam@example.com",
    Postcode: "CH45 1AB",
    Address: "1 Test Road, WALLASEY, CH45 1AB",
    "Roof choice": welsh.name + " - " + welsh.colourName,
    Message: "",
    Photo: "Yes",
    Previews: "0",
    "Email to roofer": "Sent",
    Marketing: "No",
  });
  assert.match(rows[2].Saved, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.deepEqual(
    [rows[1].Site, rows[1]["From page"], rows[1]["Roof choice"], rows[1].Message, rows[1].Photo, rows[1].Previews, rows[1]["Email to roofer"], rows[1].Marketing, rows[1].Address, rows[1].Email],
    ["Version 2", "Roof Cam, own photo (version 2)", spanish.name + " - " + spanish.colourName, "Front slope only.", "Yes", "1", "May not have arrived", "Yes", "", ""]
  );
  // The bulletin's customer: a name that looks like a formula, and a phone number starting "+".
  assert.equal(rows[0].Name, "'=HYPERLINK(\"x\")");
  assert.ok(lines[1].includes('"\'=HYPERLINK(""x"")"'), lines[1]);
  assert.equal(rows[0].Phone, "'+44 151 496 0003");
  assert.deepEqual([rows[0]["From page"], rows[0].Status, rows[0].Photo, rows[0]["Roof choice"]], ["Bulletin contact form (version 2)", "Contacted", "No", ""]);

  const audits = await exportAudits();
  assert.equal(audits.length, auditsBefore + 1, "each download is recorded");
  assert.deepEqual(audits[audits.length - 1].after, { count: 3, site: null, status: null, searched: false, truncated: false });
  assert.ok(audits[audits.length - 1].session_id, "with the session that took it");
});

test("export: the same filters as the list (site, status, search), and the site in the file name", async () => {
  const refs = async (query) => (await exportCsv(query, token)).rows.map((x) => x.Reference);
  const listed = async (query) => ok(await api("GET", "operator/enquiries?" + query, { token }), 200).enquiries.map((e) => e.reference);

  const v1 = await exportCsv("site=v1", token);
  assert.deepEqual(
    v1.rows.map((x) => x.Reference),
    [f.A.ref]
  );
  assert.match(v1.r.headers["content-disposition"], /filename="wv-roofing-enquiries-\d{4}-\d{2}-\d{2}-v1\.csv"$/);
  const v2 = await exportCsv("site=v2", token);
  assert.deepEqual(
    v2.rows.map((x) => x.Reference),
    [f.C.ref, f.B.ref]
  );
  assert.match(v2.r.headers["content-disposition"], /-v2\.csv"$/);
  assert.match((await exportCsv("site=everywhere", token)).r.headers["content-disposition"], /\d{2}\.csv"$/, "no site: both, and no suffix");
  assert.deepEqual(await refs("status=contacted"), [f.C.ref]);
  assert.deepEqual(await refs("q=hyperlink"), [f.C.ref]);
  assert.deepEqual(await refs("q=" + encodeURIComponent("0151 4960000")), [f.A.ref], "phone digits, spaces ignored");
  assert.deepEqual(await refs("site=v2&status=new"), [f.B.ref]);
  assert.deepEqual(await refs("q=nobody-at-all"), [], "no match: just the header row");

  for (const query of ["site=v1", "site=v2", "status=contacted", "q=sam", "q=ch45", "site=v2&q=0151"]) {
    assert.deepEqual(await refs(query), await listed(query), "the list and the export agree: " + query);
  }

  const last = (await exportAudits()).pop();
  assert.deepEqual(last.after, { count: 1, site: "v2", status: null, searched: true, truncated: false });
  const filtered = (await exportAudits()).find((a) => a.after.status === "contacted");
  assert.deepEqual(filtered.after, { count: 1, site: null, status: "contacted", searched: false, truncated: false });
});

test("the Overview and the export need the operator's session; nothing is recorded without one", async () => {
  for (const route of ["operator/overview", "operator/export/enquiries"]) {
    const r = router.ROUTES.find((x) => x.path === route);
    assert.ok(r, route);
    assert.equal(r.auth, "operator");
    assert.deepEqual(r.methods, ["GET"]);
  }
  const p = ok(await api("POST", "projects", { body: { noticeShown: true } }), 201);
  const auditsBefore = (await exportAudits()).length;
  for (const t of [undefined, p.token, "x".repeat(43)]) {
    for (const route of ["operator/overview", "operator/export/enquiries", "operator/export/enquiries?site=v1"]) {
      const r = await api("GET", route, { token: t });
      assert.equal(r.status, 401, route);
      assert.equal(r.json.error, "unauthorised");
      assert.doesNotMatch(r.res.body, /Sam Test|HYPERLINK/, "no customer details");
    }
  }
  assert.equal((await exportAudits()).length, auditsBefore);
  assert.equal((await api("POST", "operator/export/enquiries", { token })).status, 405, "GET only");
});

test("an enquiry whose project was deleted no longer counts as having a photo", async () => {
  ok(await api("POST", "operator/projects/" + f.A.p.id + "/delete", { token }), 200);
  const a = ok(await api("GET", "operator/enquiries?site=v1", { token }), 200).enquiries.find((e) => e.reference === f.A.ref);
  assert.equal(a.hasPhoto, false);
  assert.equal(a.hasProject, false);
  const o = ok(await api("GET", "operator/overview?site=v1", { token }), 200);
  assert.deepEqual(o.photos, { held: 1, withEnquiry: 0, withoutEnquiry: 1, last7Days: 0, previews: 0 });
  assert.equal(o.recent[0].hasPhoto, false);
  const { rows } = await exportCsv("site=v1", token);
  assert.equal(rows[0].Photo, "No");
  assert.equal(rows[0].Address, "1 Test Road, WALLASEY, CH45 1AB", "what the customer sent is still in the enquiry");
});
