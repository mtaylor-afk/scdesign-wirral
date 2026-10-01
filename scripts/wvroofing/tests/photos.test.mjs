// Customer photos from both sites, kept for the roofer: the site each came from
// (v1 Roof Visualiser, v2 Roof Cam), the previews a customer's device drew, the
// version 2 enquiry sources, and the operator screen's Photos view.
// Test environment only: PGlite, local storage and the email stand-in.
import os from "node:os";
import path from "node:path";
process.env.WVR_ENV = "test";
process.env.WVR_FS_STORAGE_DIR = path.join(os.tmpdir(), "wvr-photos-test-" + process.pid);
process.env.WVR_CAP_ENQUIRY_DELIVERY = "on";
process.env.WVR_PROJECTS_PER_IP_DAILY = "1000";
process.env.WVR_DAILY_UPLOADS = "1000";
process.env.WVR_ENQUIRIES_PER_IP_HOURLY = "1000";

import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { load, removeTempDir, apiFor } from "./helpers.mjs";

const app = load("api/wvroofing/app.js");
const db = load("serverlib/wvroofing/db.js");
const jobs = load("serverlib/wvroofing/jobs.js");
const auth = load("serverlib/wvroofing/auth.js");
const mailer = load("serverlib/wvroofing/mailer.js");
const images = load("serverlib/wvroofing/images.js");
const enquiries = load("serverlib/wvroofing/enquiries.js");
const { storage } = load("serverlib/wvroofing/storage.js");

process.env.WVR_OPERATOR_PASSWORD_HASH = auth.hashPassword(auth.TEST_OPERATOR_PASSWORD);

after(async () => {
  await jobs.drain();
  await db.reset();
  removeTempDir(process.env.WVR_FS_STORAGE_DIR);
});

beforeEach(() => {
  mailer.setFixture("ok");
});

const api = apiFor(app);
let n = 0;
const key = () => "photokey" + String(++n).padStart(8, "0");
let ipN = 0;
const nextIp = () => "198.51.100." + ++ipN;

const ok = (r, want) => {
  assert.equal(r.status, want, JSON.stringify(r.json));
  return r.json;
};

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

/** A project on one site with a committed photo. */
async function photoProject(site, opts = {}) {
  const p = ok(await api("POST", "projects", { body: { noticeShown: true, site } }), 201);
  const buf = await jpeg(900, 600);
  const pre = ok(await api("POST", "projects/" + p.id + "/photo/presign", { token: p.token, body: { contentType: "image/jpeg", bytes: buf.length } }), 200);
  await storage().put(new URL(pre.url, "http://localhost").searchParams.get("path"), buf, "image/jpeg");
  const c = ok(await api("POST", "projects/" + p.id + "/photo/commit", { token: p.token, body: { uploadId: pre.uploadId, clientResized: !!opts.clientResized } }), 200);
  return { p, photo: c.photo };
}

async function mockupUrl(w = 800, h = 533) {
  return "data:image/jpeg;base64," + (await jpeg(w, h, 90)).toString("base64");
}

async function login() {
  return ok(await api("POST", "operator/login", { body: { password: auth.TEST_OPERATOR_PASSWORD }, ip: nextIp() }), 200).token;
}

// ---------------------------------------------------------------------------
// the site and the photo

test("a project remembers its site (v1 unless the Roof Cam says v2), and a photo the phone converted is marked", async () => {
  const v1 = ok(await api("POST", "projects", { body: { noticeShown: true } }), 201);
  assert.equal(ok(await api("GET", "projects/" + v1.id, { token: v1.token }), 200).project.site, "v1");
  const odd = ok(await api("POST", "projects", { body: { noticeShown: true, site: "v9" } }), 201);
  assert.equal(ok(await api("GET", "projects/" + odd.id, { token: odd.token }), 200).project.site, "v1", "anything else is v1");
  const { p, photo } = await photoProject("v2", { clientResized: true });
  assert.equal(ok(await api("GET", "projects/" + p.id, { token: p.token }), 200).project.site, "v2");
  const row = (await db.query("SELECT original_is_client_resized FROM wvr_photos WHERE id = $1", [photo.id])).rows[0];
  assert.equal(row.original_is_client_resized, true);
});

// ---------------------------------------------------------------------------
// previews drawn on the customer's device

test("a preview is checked, re-encoded and kept with the photo", async () => {
  const bare = ok(await api("POST", "projects", { body: { noticeShown: true, site: "v2" } }), 201);
  const first = await api("POST", "projects/" + bare.id + "/mockups", { token: bare.token, body: { visualId: "welsh-slate", jpeg: await mockupUrl() } });
  assert.equal(first.status, 409, "no photo yet");

  const { p, photo } = await photoProject("v2");
  const send = (body) => api("POST", "projects/" + p.id + "/mockups", { token: p.token, body });
  assert.equal((await send({ visualId: "thatch", jpeg: await mockupUrl() })).status, 400, "unknown roof");
  assert.equal((await send({ visualId: "welsh-slate", condition: "hail", jpeg: await mockupUrl() })).status, 400, "unknown weather");
  const png = "data:image/png;base64," + (await images.sharp()(await jpeg(200, 150)).png().toBuffer()).toString("base64");
  assert.equal((await send({ visualId: "welsh-slate", jpeg: png })).status, 400, "JPEG only");
  assert.equal((await send({ visualId: "welsh-slate", jpeg: "data:image/jpeg;base64," + Buffer.from("not a picture at all").toString("base64") })).status, 400, "not a picture");
  assert.equal((await send({ visualId: "welsh-slate", jpeg: await mockupUrl(2400, 1600) })).status, 400, "too big in pixels");

  const made = ok(await send({ visualId: "welsh-slate", condition: "storm", jpeg: await mockupUrl() }), 201);
  const row = (await db.query("SELECT * FROM wvr_mockups WHERE id = $1", [made.mockup.id])).rows[0];
  assert.equal(row.project_id, p.id);
  assert.equal(row.photo_id, photo.id);
  assert.equal(row.condition, "storm");
  assert.match(row.pathname, new RegExp("^projects/" + p.id + "/mockups/[0-9a-f-]{36}\\.jpg$"));
  const stored = await storage().getBuffer(row.pathname);
  assert.equal(images.sniff(stored), "jpeg");
  assert.equal(row.w, 800);

  const other = (await photoProject("v2")).p;
  const theirs = await api("POST", "projects/" + p.id + "/mockups", { token: other.token, body: { visualId: "welsh-slate", jpeg: await mockupUrl() } });
  assert.equal(theirs.status, 404, "another project's key never opens this one");
});

test("a photo keeps at most twelve previews", async () => {
  const { p } = await photoProject("v1");
  const url = await mockupUrl(320, 240);
  for (let i = 0; i < 10; i++) ok(await api("POST", "projects/" + p.id + "/mockups", { token: p.token, body: { visualId: "spanish-slate", jpeg: url } }), 201);
  // Four at once with two places left: exactly two are kept, and the others leave no file behind.
  const burst = await Promise.all(Array.from({ length: 4 }, () => api("POST", "projects/" + p.id + "/mockups", { token: p.token, body: { visualId: "spanish-slate", jpeg: url } })));
  assert.deepEqual(burst.map((r) => r.status).sort(), [201, 201, 409, 409]);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM wvr_mockups WHERE project_id = $1", [p.id])).rows[0].n, 12);
  assert.equal((await storage().list("projects/" + p.id + "/mockups/")).length, 12);
  const more = await api("POST", "projects/" + p.id + "/mockups", { token: p.token, body: { visualId: "spanish-slate", jpeg: url } });
  assert.equal(more.status, 409);
  assert.equal(more.json.error, "too_many");
});

// ---------------------------------------------------------------------------
// enquiries from version 2

test("a Roof Cam enquiry is saved as version 2, with its preview in the snapshot and the roofer's email", async () => {
  const { p } = await photoProject("v2");
  ok(await api("POST", "projects/" + p.id + "/mockups", { token: p.token, body: { visualId: "spanish-slate", condition: "dusk", jpeg: await mockupUrl() } }), 201);
  const e = ok(
    await api("POST", "projects/" + p.id + "/enquiry", {
      token: p.token,
      body: { name: "Robin Cam", phone: "0151 496 0002", postcode: "CH45 1AB", product: "spanish-slate", message: "Front slope only.", consent: true, elapsedMs: 9000, includeImages: true, idempotencyKey: key() },
    }),
    201
  );
  const row = (await db.query("SELECT * FROM wvr_enquiries WHERE reference = $1", [e.reference])).rows[0];
  assert.equal(row.source, "roof-cam");
  assert.equal(enquiries.siteOf(row.source), "v2");
  const snap = typeof row.snapshot === "string" ? JSON.parse(row.snapshot) : row.snapshot;
  assert.equal(snap.site, "v2");
  assert.equal(snap.mockups.length, 1);
  assert.equal(snap.mockups[0].visualId, "spanish-slate");
  const mail = mailer.outbox.find((m) => m.subject.includes(e.reference));
  assert.ok(mail, "the roofer was emailed");
  assert.deepEqual(
    mail.attachments.map((a) => a.filename),
    ["before.jpg", "after-spanish-slate-preview.jpg"]
  );
  assert.match(mail.text, /Roof Cam, own photo \(version 2\)/);
  assert.match(mail.text, /Previews from their device: Natural Spanish slate/);
});

test("version 2's other forms are accepted as their own sources; anything unknown is the roof-replacement form", async () => {
  for (const source of ["roof-cam-sample", "bulletin"]) {
    const e = ok(await api("POST", "enquiries", { body: { name: "Alex Form", email: "alex@example.com", consent: true, source, elapsedMs: 9000, idempotencyKey: key() } }), 201);
    const row = (await db.query("SELECT source FROM wvr_enquiries WHERE reference = $1", [e.reference])).rows[0];
    assert.equal(row.source, source);
  }
  const e = ok(await api("POST", "enquiries", { body: { name: "Alex Form", email: "alex@example.com", consent: true, source: "elsewhere", elapsedMs: 9000, idempotencyKey: key() } }), 201);
  assert.equal((await db.query("SELECT source FROM wvr_enquiries WHERE reference = $1", [e.reference])).rows[0].source, "roof-replacement");
});

// ---------------------------------------------------------------------------
// the operator's Photos view

test("the operator sees every photo from both sites, with or without an enquiry, filtered by site", async () => {
  await db.query("DELETE FROM wvr_projects");
  const a = await photoProject("v1");
  const b = await photoProject("v2");
  const c = await photoProject("v2");
  ok(await api("POST", "projects/" + c.p.id + "/mockups", { token: c.p.token, body: { visualId: "welsh-slate", jpeg: await mockupUrl() } }), 201);
  const sent = ok(
    await api("POST", "projects/" + c.p.id + "/enquiry", {
      token: c.p.token,
      body: { name: "Casey Photo", email: "casey@example.com", consent: true, elapsedMs: 9000, includeImages: true, product: "welsh-slate", idempotencyKey: key() },
    }),
    201
  );
  // A project with no photo isn't a photo.
  ok(await api("POST", "projects", { body: { noticeShown: true, site: "v2" } }), 201);

  const t = await login();
  const all = ok(await api("GET", "operator/projects", { token: t }), 200);
  assert.equal(all.total, 3);
  assert.deepEqual(new Set(all.projects.map((x) => x.id)), new Set([a.p.id, b.p.id, c.p.id]));
  assert.equal(all.projects[0].id, c.p.id, "newest first");
  const cItem = all.projects[0];
  assert.equal(cItem.site, "v2");
  assert.equal(cItem.mockups, 1);
  assert.equal(cItem.enquiry.reference, sent.reference);
  assert.equal(cItem.enquiry.name, "Casey Photo");
  assert.equal(cItem.photo.w, 900);

  assert.deepEqual(ok(await api("GET", "operator/projects?site=v1", { token: t }), 200).projects.map((x) => x.id), [a.p.id]);
  assert.equal(ok(await api("GET", "operator/projects?site=v2", { token: t }), 200).total, 2);
  assert.deepEqual(ok(await api("GET", "operator/projects?enquiry=with", { token: t }), 200).projects.map((x) => x.id), [c.p.id]);
  assert.equal(ok(await api("GET", "operator/projects?enquiry=without", { token: t }), 200).total, 2);

  const view = ok(await api("GET", "operator/projects/" + c.p.id, { token: t }), 200);
  assert.equal(view.project.site, "v2");
  assert.equal(view.project.photos.length, 1);
  assert.equal(view.project.photos[0].current, true);
  assert.equal(view.project.mockups.length, 1);
  assert.equal(view.enquiry.reference, sent.reference);
  assert.equal(ok(await api("GET", "operator/projects/" + b.p.id, { token: t }), 200).enquiry, null);

  const full = await api("GET", "operator/projects/" + b.p.id + "/photo", { token: t });
  const thumb = await api("GET", "operator/projects/" + b.p.id + "/photo?size=thumb", { token: t });
  assert.equal(full.status, 200);
  assert.equal(thumb.status, 200);
  assert.equal(thumb.headers["content-type"], "image/jpeg");
  assert.ok(Number(thumb.headers["content-length"]) < Number(full.headers["content-length"]), "the thumbnail is smaller");
  const pic = await api("GET", "operator/mockups/" + view.project.mockups[0].id + "/image", { token: t });
  assert.equal(pic.status, 200);
  assert.equal(pic.headers["content-type"], "image/jpeg");
  assert.equal((await api("GET", "operator/mockups/" + c.p.id + "/image", { token: t })).status, 404);

  // The enquiry list can be narrowed to one site, and says which site each came from.
  const v2List = ok(await api("GET", "operator/enquiries?site=v2", { token: t }), 200).enquiries;
  assert.ok(v2List.some((e) => e.reference === sent.reference));
  assert.ok(v2List.every((e) => e.site === "v2"));
  const v1List = ok(await api("GET", "operator/enquiries?site=v1", { token: t }), 200).enquiries;
  assert.ok(v1List.every((e) => e.site === "v1"));
  assert.ok(!v1List.some((e) => e.reference === sent.reference));
  const detail = ok(await api("GET", "operator/enquiries/" + cItem.enquiry.id, { token: t }), 200);
  assert.equal(detail.enquiry.site, "v2");
  assert.equal(detail.project.mockups.length, 1);
});

test("an earlier photo of the same session stays viewable; deleting the project takes its previews too", async () => {
  const { p, photo } = await photoProject("v2");
  ok(await api("POST", "projects/" + p.id + "/mockups", { token: p.token, body: { visualId: "welsh-slate", jpeg: await mockupUrl() } }), 201);
  // A second photo in the same session.
  const buf = await jpeg(1000, 700, 100);
  const pre = ok(await api("POST", "projects/" + p.id + "/photo/presign", { token: p.token, body: { contentType: "image/jpeg", bytes: buf.length } }), 200);
  await storage().put(new URL(pre.url, "http://localhost").searchParams.get("path"), buf, "image/jpeg");
  ok(await api("POST", "projects/" + p.id + "/photo/commit", { token: p.token, body: { uploadId: pre.uploadId } }), 200);

  const t = await login();
  const view = ok(await api("GET", "operator/projects/" + p.id, { token: t }), 200);
  assert.equal(view.project.photos.length, 2);
  assert.equal(view.project.photos.filter((x) => x.current).length, 1);
  assert.equal(view.project.photos.find((x) => !x.current).id, photo.id);
  assert.equal(view.project.mockups[0].photoId, photo.id, "the preview stays tied to the photo it was drawn on");
  assert.equal((await api("GET", "operator/projects/" + p.id + "/photo?photo=" + photo.id + "&size=thumb", { token: t })).status, 200);
  const stranger = (await photoProject("v1")).photo;
  assert.equal((await api("GET", "operator/projects/" + p.id + "/photo?photo=" + stranger.id, { token: t })).status, 404, "never another project's photo");

  ok(await api("POST", "operator/projects/" + p.id + "/delete", { token: t }), 200);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM wvr_mockups WHERE project_id = $1", [p.id])).rows[0].n, 0);
  assert.deepEqual(await storage().list("projects/" + p.id + "/"), []);
});
