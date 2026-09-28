// Customer projects end to end through the router (PGlite + local storage). (A2)
import os from "node:os";
import path from "node:path";
process.env.WVR_ENV = "test";
process.env.WVR_FS_STORAGE_DIR = path.join(os.tmpdir(), "wvr-projects-test-" + process.pid);

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import { load, call, SITE } from "./helpers.mjs";

const app = load("api/wvroofing/app.js");
const db = load("serverlib/wvroofing/db.js");
const images = load("serverlib/wvroofing/images.js");
const { storage } = load("serverlib/wvroofing/storage.js");
const { crc32 } = load("serverlib/wvroofing/core.js");
const sharp = images.sharp();

after(async () => {
  await db.reset();
  fs.rmSync(process.env.WVR_FS_STORAGE_DIR, { recursive: true, force: true });
});

function api(method, route, { token, body, origin = SITE, headers = {} } = {}) {
  const h = Object.assign({ origin }, headers);
  if (body !== undefined) h["content-type"] = "application/json";
  if (token) h.authorization = "Bearer " + token;
  return call(app, method, "/api/wvroofing/" + route, h, body);
}

async function newProject() {
  const r = await api("POST", "projects", { body: { noticeShown: true, consentAi: false } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json;
}

async function photoJpeg(w = 900, h = 600) {
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 13) & 255;
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();
}

/** Presign, "upload" to the local store as the browser would, and commit. */
async function uploadPhoto(p, buf, type = "image/jpeg") {
  const pre = await api("POST", "projects/" + p.id + "/photo/presign", { token: p.token, body: { contentType: type, bytes: buf.length } });
  assert.equal(pre.status, 200, JSON.stringify(pre.json));
  const target = new URL(pre.json.url, "http://localhost").searchParams.get("path");
  assert.match(target, new RegExp("^projects/" + p.id + "/incoming/"));
  await storage().put(target, buf, type);
  return { pre, commit: await api("POST", "projects/" + p.id + "/photo/commit", { token: p.token, body: { uploadId: pre.json.uploadId } }) };
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function maskDataUrl(w, h, frac) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w * 4 + 1) + 1 + x * 4 + 3] = x < w * frac ? 0 : 255;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  return "data:image/png;base64," + png.toString("base64");
}

test("create a project: 201 with a token; only JSON from an allowed origin", async () => {
  const p = await newProject();
  assert.match(p.id, /^[0-9a-f-]{36}$/);
  assert.ok(p.token.length >= 40);
  assert.equal(p.capabilities.enquiry_storage.state, "enabled");
  const evil = await api("POST", "projects", { body: {}, origin: "https://evil.example" });
  assert.equal(evil.status, 403);
  const form = await call(app, "POST", "/api/wvroofing/projects", { origin: SITE, "content-type": "application/x-www-form-urlencoded" }, "a=1");
  assert.equal(form.status, 415, "no simple cross-site form posts");
});

test("origin rule: same-origin GETs (no Origin header) work; other origins and Origin-less POSTs don't", async () => {
  const p = await newProject();
  const noOrigin = await call(app, "GET", "/api/wvroofing/projects/" + p.id, { authorization: "Bearer " + p.token });
  assert.equal(noOrigin.status, 200, "same-origin GET");
  const evil = await api("GET", "projects/" + p.id, { token: p.token, origin: "https://evil.example" });
  assert.equal(evil.status, 403, "disallowed origin");
  const post = await call(app, "POST", "/api/wvroofing/projects/" + p.id + "/consent", { authorization: "Bearer " + p.token, "content-type": "application/json" }, { ai: true });
  assert.equal(post.status, 403, "POST without Origin");
});

test("a project opens only with its own token", async () => {
  const a = await newProject();
  const b = await newProject();
  assert.equal((await api("GET", "projects/" + a.id, { token: a.token })).status, 200);
  assert.equal((await api("GET", "projects/" + a.id)).status, 401, "no token");
  assert.equal((await api("GET", "projects/" + a.id, { token: b.token })).status, 404, "another project's token");
  assert.equal((await api("GET", "projects/" + a.id, { token: "x".repeat(43) })).status, 404, "wrong token");
  assert.equal((await api("GET", "projects/not-a-uuid", { token: a.token })).status, 404);
  await db.query("UPDATE wvr_projects SET token_expires_at = now() - interval '1 minute' WHERE id = $1", [a.id]);
  assert.equal((await api("GET", "projects/" + a.id, { token: a.token })).status, 404, "expired token");
});

test("photo round trip: presign, upload, commit, display; GPS never stored", async () => {
  const p = await newProject();
  const secret = Buffer.from("SECRET-GPS-53.40N", "latin1");
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([0, secret.length + 8]), Buffer.from("Exif\u0000\u0000", "latin1"), secret]);
  const jpg = await photoJpeg();
  const withGps = Buffer.concat([jpg.subarray(0, 2), app1, jpg.subarray(2)]);
  const { commit } = await uploadPhoto(p, withGps);
  assert.equal(commit.status, 200, JSON.stringify(commit.json));
  assert.deepEqual([commit.json.photo.w, commit.json.photo.h], [900, 600]);
  const files = await storage().list("projects/" + p.id + "/");
  assert.equal(files.filter((f) => f.includes("/incoming/")).length, 0, "the raw upload is deleted");
  for (const f of files) assert.ok(!(await storage().getBuffer(f)).includes("SECRET"), "no stored file keeps the GPS block: " + f);
  const disp = await api("GET", "projects/" + p.id + "/photo/display", { token: p.token });
  assert.equal(disp.status, 200);
  assert.equal(disp.headers["content-type"], "image/jpeg");
  assert.match(disp.headers["cache-control"], /no-store/);
  const g = await api("GET", "projects/" + p.id, { token: p.token });
  assert.equal(g.json.project.photo.w, 900);
  assert.equal(g.json.project.mask, null);
});

test("uploads are bound to their project and can be committed once, before they expire", async () => {
  const a = await newProject();
  const b = await newProject();
  const jpg = await photoJpeg();
  const { pre, commit } = await uploadPhoto(a, jpg);
  assert.equal(commit.status, 200);
  const again = await api("POST", "projects/" + a.id + "/photo/commit", { token: a.token, body: { uploadId: pre.json.uploadId } });
  assert.equal(again.status, 409, "second commit");
  const foreign = await api("POST", "projects/" + b.id + "/photo/commit", { token: b.token, body: { uploadId: pre.json.uploadId } });
  assert.equal(foreign.status, 404, "another project's upload");
  const pre2 = await api("POST", "projects/" + a.id + "/photo/presign", { token: a.token, body: { contentType: "image/jpeg", bytes: jpg.length } });
  await db.query("UPDATE wvr_uploads SET expires_at = now() - interval '1 minute' WHERE id = $1", [pre2.json.uploadId]);
  const late = await api("POST", "projects/" + a.id + "/photo/commit", { token: a.token, body: { uploadId: pre2.json.uploadId } });
  assert.equal(late.status, 410, "expired upload");
  const missing = await api("POST", "projects/" + a.id + "/photo/presign", { token: a.token, body: { contentType: "image/jpeg", bytes: jpg.length } });
  const none = await api("POST", "projects/" + a.id + "/photo/commit", { token: a.token, body: { uploadId: missing.json.uploadId } });
  assert.equal(none.status, 400, "nothing was uploaded");
  assert.equal(none.json.error, "upload_missing");
});

test("presign refuses other types and oversize files", async () => {
  const p = await newProject();
  const gif = await api("POST", "projects/" + p.id + "/photo/presign", { token: p.token, body: { contentType: "image/gif", bytes: 1000 } });
  assert.equal(gif.status, 400);
  const big = await api("POST", "projects/" + p.id + "/photo/presign", { token: p.token, body: { contentType: "image/jpeg", bytes: 21 * 1024 * 1024 } });
  assert.equal(big.status, 413);
});

test("a HEIC file that slips through the browser is refused with a helpful message", async () => {
  const p = await newProject();
  const heic = Buffer.alloc(4096);
  heic.writeUInt32BE(24, 0);
  heic.write("ftypheic", 4, "ascii");
  const { commit } = await uploadPhoto(p, heic);
  assert.equal(commit.status, 400);
  assert.match(commit.json.message, /HEIC/);
});

test("roof outline: must match the photo; valid outlines are stored with their shapes", async () => {
  const p = await newProject();
  const nophoto = await api("POST", "projects/" + p.id + "/mask", { token: p.token, body: { png: maskDataUrl(10, 10, 0.3), shapes: [], displayW: 10, displayH: 10 } });
  assert.equal(nophoto.status, 409);
  await uploadPhoto(p, await photoJpeg());
  const shapes = [{ mode: "add", pts: [[10, 10], [300, 10], [300, 200]] }];
  const wrong = await api("POST", "projects/" + p.id + "/mask", { token: p.token, body: { png: maskDataUrl(800, 600, 0.3), shapes, displayW: 800, displayH: 600 } });
  assert.equal(wrong.status, 409, "outline for a different photo size");
  const tiny = await api("POST", "projects/" + p.id + "/mask", { token: p.token, body: { png: maskDataUrl(900, 600, 0.001), shapes, displayW: 900, displayH: 600 } });
  assert.equal(tiny.status, 400);
  const ok = await api("POST", "projects/" + p.id + "/mask", { token: p.token, body: { png: maskDataUrl(900, 600, 0.3), shapes, displayW: 900, displayH: 600 } });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  const g = await api("GET", "projects/" + p.id, { token: p.token });
  assert.deepEqual(g.json.project.mask.shapes, shapes);
  // a new photo never reuses the old outline
  await uploadPhoto(p, await photoJpeg(1000, 700));
  const g2 = await api("GET", "projects/" + p.id, { token: p.token });
  assert.equal(g2.json.project.mask, null);
});

test("consent can be given and withdrawn", async () => {
  const p = await newProject();
  assert.equal((await api("POST", "projects/" + p.id + "/consent", { token: p.token, body: { ai: true } })).json.consentAi, true);
  assert.equal((await api("GET", "projects/" + p.id, { token: p.token })).json.project.consentAi, true);
  await api("POST", "projects/" + p.id + "/consent", { token: p.token, body: { ai: false } });
  assert.equal((await api("GET", "projects/" + p.id, { token: p.token })).json.project.consentAi, false);
});

test("delete removes the files and the project; the token stops working", async () => {
  const p = await newProject();
  await uploadPhoto(p, await photoJpeg());
  assert.ok((await storage().list("projects/" + p.id + "/")).length >= 2);
  const d = await api("POST", "projects/" + p.id + "/delete", { token: p.token, body: {} });
  assert.equal(d.status, 200);
  assert.equal((await storage().list("projects/" + p.id + "/")).length, 0);
  assert.equal((await api("GET", "projects/" + p.id, { token: p.token })).status, 404);
  const { rows } = await db.query("SELECT count(*)::int AS n FROM wvr_photos WHERE project_id = $1", [p.id]);
  assert.equal(rows[0].n, 0);
});

test("the global daily upload cap is enforced", async () => {
  const p = await newProject();
  process.env.WVR_DAILY_UPLOADS = "1";
  try {
    const r = await api("POST", "projects/" + p.id + "/photo/presign", { token: p.token, body: { contentType: "image/jpeg", bytes: 1000 } });
    assert.equal(r.status, 429);
  } finally {
    delete process.env.WVR_DAILY_UPLOADS;
  }
});

test("the daily job deletes expired projects and stale uploads, and leaves live ones alone", async () => {
  const old = await newProject();
  await uploadPhoto(old, await photoJpeg());
  const live = await newProject();
  await uploadPhoto(live, await photoJpeg());
  // a presigned upload whose file arrived but was never committed, over a day ago
  const jpg = await photoJpeg();
  const pre = await api("POST", "projects/" + live.id + "/photo/presign", { token: live.token, body: { contentType: "image/jpeg", bytes: jpg.length } });
  const stalePath = new URL(pre.json.url, "http://localhost").searchParams.get("path");
  await storage().put(stalePath, jpg, "image/jpeg");
  await db.query("UPDATE wvr_uploads SET created_at = now() - interval '25 hours' WHERE id = $1", [pre.json.uploadId]);
  await db.query("UPDATE wvr_projects SET expires_at = now() - interval '1 minute' WHERE id = $1", [old.id]);

  process.env.CRON_SECRET = "test-cron-secret-123456";
  try {
    const r = await call(app, "GET", "/api/wvroofing/cron/daily", { authorization: "Bearer test-cron-secret-123456" });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.ok(r.json.detail.projectsDeleted >= 1);
    assert.ok(r.json.detail.staleUploadsRemoved >= 1);
  } finally {
    delete process.env.CRON_SECRET;
  }
  assert.equal((await storage().list("projects/" + old.id + "/")).length, 0, "expired project's files gone");
  assert.equal((await api("GET", "projects/" + old.id, { token: old.token })).status, 404);
  assert.equal(await storage().getBuffer(stalePath), null, "stale upload's file gone");
  assert.equal((await api("GET", "projects/" + live.id, { token: live.token })).status, 200, "live project untouched");
  assert.ok((await storage().list("projects/" + live.id + "/working/")).length === 1, "live project's photo untouched");
});

test("without storage configured, project routes say so plainly", async () => {
  process.env.WVR_ENV = "";
  try {
    const r = await api("POST", "projects", { body: {} });
    assert.equal(r.status, 503);
    assert.equal(r.json.error, "not_configured");
  } finally {
    process.env.WVR_ENV = "test";
  }
});
