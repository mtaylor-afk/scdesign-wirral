// Enquiries: saved first, notified second (A4; brief §5, §15). PGlite, local
// storage, the OpenAI stand-in and the test outbox (no email is ever sent).
import os from "node:os";
import path from "node:path";
process.env.WVR_ENV = "test";
process.env.WVR_FS_STORAGE_DIR = path.join(os.tmpdir(), "wvr-enquiries-test-" + process.pid);
process.env.WVR_CAP_IMAGE_GENERATION = "on";
process.env.WVR_CAP_ENQUIRY_DELIVERY = "on";
process.env.WVR_UPSTREAM_IPM = "1000";
process.env.WVR_PROJECTS_PER_IP_DAILY = "1000";
process.env.WVR_DAILY_UPLOADS = "1000";
process.env.WVR_ENQUIRIES_PER_IP_HOURLY = "1000";

import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { load, call, SITE, removeTempDir } from "./helpers.mjs";

const app = load("api/wvroofing/app.js");
const db = load("serverlib/wvroofing/db.js");
const jobs = load("serverlib/wvroofing/jobs.js");
const mailer = load("serverlib/wvroofing/mailer.js");
const enquiries = load("serverlib/wvroofing/enquiries.js");
const images = load("serverlib/wvroofing/images.js");
const { storage } = load("serverlib/wvroofing/storage.js");
const { crc32 } = load("serverlib/wvroofing/core.js");
const sharp = images.sharp();
const REF = /^WVR-\d{4}-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}$/;

after(async () => {
  await jobs.drain();
  await db.reset();
  removeTempDir(process.env.WVR_FS_STORAGE_DIR);
});

beforeEach(async () => {
  await jobs.drain();
  mailer.setFixture("ok");
});

function api(method, route, { token, body, origin = SITE } = {}) {
  const h = { origin };
  if (body !== undefined) h["content-type"] = "application/json";
  if (token) h.authorization = "Bearer " + token;
  return call(app, method, "/api/wvroofing/" + route, h, body);
}

let n = 0;
const key = () => "enqkey" + String(++n).padStart(8, "0");
const form = (extra) => Object.assign({ name: "Jane Test", email: "jane@example.com", phone: "0151 496 0000", postcode: "CH45 1AB", product: "welsh-slate", message: "Slipped tiles.", consent: true, source: "roof-replacement", elapsedMs: 9000, idempotencyKey: key() }, extra);

async function row(reference) {
  return (await db.query("SELECT * FROM wvr_enquiries WHERE reference = $1", [reference])).rows[0];
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function outline(w, h) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w * 4 + 1) + 1 + x * 4 + 3] = x > w * 0.2 && x < w * 0.6 && y > h * 0.2 && y < h * 0.6 ? 0 : 255;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return "data:image/png;base64," + Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]).toString("base64");
}

/** A project with a photo, an outline, and (optionally) a finished render of welsh-slate. */
async function projectWithPhoto({ render = false } = {}) {
  const p = (await api("POST", "projects", { body: { noticeShown: true, consentAi: true } })).json;
  // a smooth, photo-like picture (soft light plus a few hard edges)
  const raw = Buffer.alloc(900 * 600 * 3);
  for (let y = 0; y < 600; y++)
    for (let x = 0; x < 900; x++) {
      const i = (y * 900 + x) * 3;
      const v = 110 + 50 * Math.sin(x / 41) + 30 * Math.cos(y / 29) + (((x >> 6) + (y >> 6)) % 3 === 0 ? 40 : 0);
      raw[i] = v;
      raw[i + 1] = v * 0.92;
      raw[i + 2] = v * 0.85;
    }
  const jpg = await sharp(raw, { raw: { width: 900, height: 600, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();
  const pre = await api("POST", "projects/" + p.id + "/photo/presign", { token: p.token, body: { contentType: "image/jpeg", bytes: jpg.length } });
  await storage().put(new URL(pre.json.url, "http://localhost").searchParams.get("path"), jpg, "image/jpeg");
  assert.equal((await api("POST", "projects/" + p.id + "/photo/commit", { token: p.token, body: { uploadId: pre.json.uploadId } })).status, 200);
  const m = await api("POST", "projects/" + p.id + "/mask", { token: p.token, body: { png: outline(900, 600), shapes: [{ mode: "add", pts: [[180, 120], [540, 120], [540, 360]] }], displayW: 900, displayH: 600 } });
  assert.equal(m.status, 200, JSON.stringify(m.json));
  if (render) {
    const r = await api("POST", "projects/" + p.id + "/renders", { token: p.token, body: { visualIds: ["welsh-slate"], idempotencyKey: key() } });
    assert.equal(r.status, 202, JSON.stringify(r.json));
    await jobs.drain();
    const j = (await db.query("SELECT status, error_code, error_detail, qa FROM wvr_jobs WHERE project_id = $1", [p.id])).rows[0];
    assert.equal(j.status, "succeeded", JSON.stringify(j));
  }
  return p;
}

test("an enquiry is saved, then the roofer is emailed; the customer gets a reference", async () => {
  const r = await api("POST", "enquiries", { body: form() });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.match(r.json.reference, REF);
  assert.equal(r.json.delivery, "sent");
  const e = await row(r.json.reference);
  assert.equal(e.delivery_status, "sent");
  assert.equal(e.contact_name, "Jane Test");
  assert.equal(e.lawful_basis, "steps_before_contract");
  assert.equal(mailer.outbox.length, 1);
  const mail = mailer.outbox[0];
  assert.match(mail.subject, new RegExp(r.json.reference));
  assert.match(mail.from, /WV Roofing/);
  assert.doesNotMatch(mail.from, /SC\s*Design/i);
  assert.match(mail.text, /Saved in the WV Roofing enquiry store/);
  assert.doesNotMatch(mail.text + mail.html, /https?:\/\//, "no links in the email");
  assert.equal(mail.replyTo, "jane@example.com");
});

test("the enquiry is kept when the email fails; retries are bounded", async () => {
  mailer.setFixture("fail");
  const r = await api("POST", "enquiries", { body: form() });
  assert.equal(r.status, 201);
  await jobs.drain();
  assert.equal(r.json.delivery, "pending", "the customer is told we're still notifying the roofer");
  let e = await row(r.json.reference);
  assert.ok(e, "saved even though the email failed");
  assert.equal(e.delivery_status, "failed");
  assert.equal(e.delivery_attempts, 2, "the first try and one quick retry");
  process.env.CRON_SECRET = "test-cron-secret-123456";
  try {
    for (let i = 0; i < 3; i++) await call(app, "GET", "/api/wvroofing/cron/daily", { authorization: "Bearer test-cron-secret-123456" });
  } finally {
    delete process.env.CRON_SECRET;
  }
  e = await row(r.json.reference);
  assert.equal(e.delivery_attempts, enquiries.MAX_ATTEMPTS, "never more than " + enquiries.MAX_ATTEMPTS + " attempts");
  assert.equal(e.delivery_status, "failed");
  mailer.setFixture("ok");
  process.env.CRON_SECRET = "test-cron-secret-123456";
  try {
    const c = await call(app, "GET", "/api/wvroofing/cron/daily", { authorization: "Bearer test-cron-secret-123456" });
    assert.equal(c.json.detail.enquiriesDelivered, 0, "out of attempts: left for the operator");
  } finally {
    delete process.env.CRON_SECRET;
  }
});

test("a send that may have gone out is 'uncertain' and never repeated automatically", async () => {
  mailer.setFixture("uncertain");
  const r = await api("POST", "enquiries", { body: form() });
  await jobs.drain();
  const e = await row(r.json.reference);
  assert.equal(e.delivery_status, "uncertain");
  assert.equal(e.delivery_attempts, 1);
  assert.equal(await enquiries.deliver(e.id), null, "nothing more is attempted");
});

test("a reload and a second tap make one enquiry (same key, same reference)", async () => {
  const body = form();
  const a = await api("POST", "enquiries", { body });
  const b = await api("POST", "enquiries", { body });
  assert.equal(a.status, 201);
  assert.equal(b.status, 200);
  assert.equal(b.json.reference, a.json.reference);
  assert.equal(b.json.existing, true);
  const both = await Promise.all([api("POST", "enquiries", { body: form({ idempotencyKey: "racekey-000001" }) }), api("POST", "enquiries", { body: form({ idempotencyKey: "racekey-000001" }) })]);
  assert.equal(both[0].json.reference, both[1].json.reference, "two taps at once: still one");
  const { rows } = await db.query("SELECT count(*)::int AS n FROM wvr_enquiries WHERE idempotency_key = 'racekey-000001'");
  assert.equal(rows[0].n, 1);
});

test("the pre-v02 /enquiry path is kept and saves too", async () => {
  const r = await api("POST", "enquiry", { body: form() });
  assert.equal(r.status, 201);
  assert.match(r.json.reference, REF);
  assert.ok(await row(r.json.reference));
});

test("an enquiry about the customer's photo: one per project, images attached only if asked", async () => {
  const p = await projectWithPhoto({ render: true });
  const r = await api("POST", "projects/" + p.id + "/enquiry", { token: p.token, body: form({ includeImages: true }) });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const e = await row(r.json.reference);
  assert.equal(e.project_id, p.id);
  assert.equal(e.source, "visualiser");
  assert.equal(e.snapshot.visualId, "welsh-slate");
  assert.equal(e.snapshot.renders.length, 1);
  assert.ok(e.snapshot.photo && e.snapshot.mask);
  const mail = mailer.outbox[mailer.outbox.length - 1];
  assert.deepEqual(mail.attachments.map((a) => a.filename), ["before.jpg", "after-welsh-slate-ai-concept.jpg"]);
  for (const a of mail.attachments) {
    assert.equal(images.sniff(a.content), "jpeg");
    assert.ok(a.content.length <= 450 * 1024);
  }
  assert.doesNotMatch(mail.text + mail.html, new RegExp(p.token), "the project's key is never emailed");
  // the photo, outline and renders are now kept with the enquiry (12 months), not 30 days
  const pr = (await db.query("SELECT expires_at FROM wvr_projects WHERE id = $1", [p.id])).rows[0];
  assert.ok(new Date(pr.expires_at).getTime() > Date.now() + 300 * 24 * 3600 * 1000);
  // a second send, even with a new key, returns the same enquiry
  const again = await api("POST", "projects/" + p.id + "/enquiry", { token: p.token, body: form() });
  assert.equal(again.json.reference, r.json.reference);
  assert.equal(again.json.existing, true);
  const g = await api("GET", "projects/" + p.id + "/enquiry", { token: p.token });
  assert.equal(g.json.enquiry.reference, r.json.reference);
  assert.equal(g.json.enquiry.delivery, "sent");
  assert.equal(g.json.enquiry.contact_email, undefined, "contact details are never sent back");

  const q = await projectWithPhoto();
  await api("POST", "projects/" + q.id + "/enquiry", { token: q.token, body: form({ includeImages: false }) });
  assert.deepEqual(mailer.outbox[mailer.outbox.length - 1].attachments, [], "no images unless asked");
});

test("deleting the photo keeps the enquiry itself", async () => {
  const p = await projectWithPhoto();
  const r = await api("POST", "projects/" + p.id + "/enquiry", { token: p.token, body: form() });
  assert.equal((await api("POST", "projects/" + p.id + "/delete", { token: p.token, body: {} })).status, 200);
  const e = await row(r.json.reference);
  assert.ok(e, "the enquiry is still there");
  assert.equal(e.project_id, null);
  assert.deepEqual(await storage().list("projects/" + p.id + "/"), []);
});

test("while delivery is off the enquiry is still saved, and the customer is told no one is notified", async () => {
  delete process.env.WVR_CAP_ENQUIRY_DELIVERY;
  try {
    const r = await api("POST", "enquiries", { body: form() });
    assert.equal(r.status, 201);
    assert.equal(r.json.delivery, "off");
    assert.equal(mailer.outbox.length, 0);
    assert.equal((await row(r.json.reference)).delivery_status, "pending");
  } finally {
    process.env.WVR_CAP_ENQUIRY_DELIVERY = "on";
  }
});

test("without storage nothing is saved or sent, and the form says so", async () => {
  process.env.WVR_ENV = "";
  try {
    const r = await api("POST", "enquiries", { body: form() });
    assert.equal(r.status, 200);
    assert.equal(r.json.error, "not_configured");
  } finally {
    process.env.WVR_ENV = "test";
  }
  assert.equal(mailer.outbox.length, 0);
});

test("fields are checked; bots are dropped or kept aside, never emailed", async () => {
  const bad = await api("POST", "enquiries", { body: form({ name: "J", email: "", phone: "", consent: false }) });
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.json.fields.sort(), ["consent", "contact", "name"]);
  const before = (await db.query("SELECT count(*)::int AS n FROM wvr_enquiries")).rows[0].n;
  const honeypot = await api("POST", "enquiries", { body: form({ company: "Spam Ltd" }) });
  assert.equal(honeypot.status, 200);
  assert.equal(honeypot.json.reference, undefined);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM wvr_enquiries")).rows[0].n, before, "a honeypot hit isn't stored");
  const fast = await api("POST", "enquiries", { body: form({ elapsedMs: 800 }) });
  assert.equal(fast.status, 201);
  assert.equal(fast.json.delivery, "off");
  assert.equal((await row(fast.json.reference)).status, "spam_suspected");
  assert.equal(mailer.outbox.length, 0, "a suspiciously fast form is kept but not emailed");
  assert.equal((await api("POST", "enquiries", { body: form({ idempotencyKey: "short" }) })).status, 400);
});

test("enquiries are rate-limited per visitor", async () => {
  process.env.WVR_ENQUIRIES_PER_IP_HOURLY = "1";
  try {
    await db.query("DELETE FROM wvr_rate_limits WHERE scope = 'enquiry_ip'");
    assert.equal((await api("POST", "enquiries", { body: form() })).status, 201);
    const second = await api("POST", "enquiries", { body: form() });
    assert.equal(second.status, 429);
  } finally {
    process.env.WVR_ENQUIRIES_PER_IP_HOURLY = "1000";
  }
});

test("the From header always names WV Roofing and never SC Design", () => {
  assert.equal(mailer.fromAddress({}), mailer.DEFAULT_FROM);
  assert.equal(mailer.fromAddress({ WVR_MAIL_FROM: '"SC Design Wirral" <hello@scdesignwirral.co.uk>' }), mailer.DEFAULT_FROM);
  assert.equal(mailer.fromAddress({ WVR_MAIL_FROM: "just-an-address@example.com" }), mailer.DEFAULT_FROM);
  assert.equal(mailer.fromAddress({ WVR_MAIL_FROM: '"WV Roofing" <quotes@example.com>' }), '"WV Roofing" <quotes@example.com>');
  assert.match(mailer.DEFAULT_FROM, /WV Roofing/);
});

test("an email lost after the message was handed over counts as uncertain", () => {
  assert.equal(mailer.afterHandover({ code: "ETIMEDOUT", command: "DATA" }), true);
  assert.equal(mailer.afterHandover({ code: "ETIMEDOUT", command: "CONN" }), false, "never connected: not sent");
  assert.equal(mailer.afterHandover({ code: "EAUTH", command: "AUTH PLAIN" }), false);
  assert.equal(mailer.afterHandover({ code: "EMESSAGE", command: "DATA", responseCode: 550 }), false, "an explicit rejection: not sent");
});

test("references look like WVR-YYMM-XXXX", () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const r = enquiries.newReference();
    assert.match(r, REF);
    seen.add(r);
  }
  assert.ok(seen.size > 480);
  const d = new Date();
  assert.ok(enquiries.newReference().startsWith("WVR-" + String(d.getUTCFullYear() % 100).padStart(2, "0") + String(d.getUTCMonth() + 1).padStart(2, "0")));
});

test("the daily job: stuck sends become uncertain, enquiries over 12 months old are deleted", async () => {
  const a = await api("POST", "enquiries", { body: form() });
  const b = await api("POST", "enquiries", { body: form() });
  await db.query("UPDATE wvr_enquiries SET delivery_status = 'sending', delivery_lease_until = now() - interval '1 minute' WHERE reference = $1", [a.json.reference]);
  await db.query("UPDATE wvr_enquiries SET created_at = now() - interval '13 months' WHERE reference = $1", [b.json.reference]);
  process.env.CRON_SECRET = "test-cron-secret-123456";
  try {
    const c = await call(app, "GET", "/api/wvroofing/cron/daily", { authorization: "Bearer test-cron-secret-123456" });
    assert.equal(c.status, 200, JSON.stringify(c.json));
    assert.ok(c.json.detail.enquiriesUncertain >= 1);
    assert.ok(c.json.detail.enquiriesDeleted >= 1);
  } finally {
    delete process.env.CRON_SECRET;
  }
  assert.equal((await row(a.json.reference)).delivery_status, "uncertain");
  assert.equal(await row(b.json.reference), undefined);
});
