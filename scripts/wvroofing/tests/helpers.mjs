// Shared helpers for the WV Roofing node:test suites (TEST ENVIRONMENT only).
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const require = createRequire(import.meta.url);

/** Load a repo module (CommonJS) by repo-relative path. */
export function load(rel) {
  return require(path.join(repo, rel));
}

export function fakeReq(method, url, headers, body) {
  const buf = body === undefined ? Buffer.alloc(0) : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
  const req = Readable.from(buf.length ? [buf] : []);
  req.method = method;
  req.url = url;
  req.headers = Object.assign({ "content-length": String(buf.length) }, headers || {});
  req.socket = { remoteAddress: "127.0.0.1" };
  return req;
}

export function fakeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    headersSent: false,
    ended: false,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    getHeader(k) {
      return this.headers[k.toLowerCase()];
    },
    end(b) {
      this.body = b ? String(b) : "";
      this.ended = true;
      this.headersSent = true;
    },
  };
}

/** Call a (req, res) handler and parse the JSON reply. */
export async function call(handler, method, url, headers, body) {
  const res = fakeRes();
  await handler(fakeReq(method, url, headers, body), res);
  let json = null;
  try {
    json = JSON.parse(res.body);
  } catch (e) {
    json = null;
  }
  return { status: res.statusCode, json, headers: res.headers, res };
}

export const SITE = "https://scdesignwirral.co.uk";

/**
 * A caller for the WV function's routes: JSON in and out; POSTs always carry a
 * JSON body; `ip` sets the visitor's address (x-real-ip).
 */
export function apiFor(app) {
  return (method, route, { token, body, ip, origin = SITE } = {}) => {
    const h = { origin };
    if (method === "POST") h["content-type"] = "application/json";
    if (token) h.authorization = "Bearer " + token;
    if (ip) h["x-real-ip"] = ip;
    return call(app, method, "/api/wvroofing/" + route, h, method === "POST" ? body || {} : undefined);
  };
}

/** A roof outline as the browser sends it: a PNG data URL, transparent (the roof) inside the box. */
export function outlinePng(w, h, box = [0.2, 0.2, 0.6, 0.6]) {
  const zlib = require("node:zlib");
  const { crc32 } = load("serverlib/wvroofing/core.js");
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const [x0, y0, x1, y1] = box;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w * 4 + 1) + 1 + x * 4 + 3] = x > w * x0 && x < w * x1 && y > h * y0 && y < h * y1 ? 0 : 255;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return "data:image/png;base64," + Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]).toString("base64");
}

let journeyN = 0;

/**
 * A customer's whole journey through the API (test environment): 1 Test Road
 * (a rooftop location), the kind of property, a smooth photo, an outline, then
 * optionally a render of welsh-slate and an enquiry. Returns the project (with
 * its key) and, if one was sent, the enquiry's reference and id.
 */
export async function customerJourney(api, { render = false, enquiry = true, propertyType = "semi" } = {}) {
  const ok = (r, want) => {
    if (r.status !== want) throw new Error("journey step failed: " + r.status + " " + JSON.stringify(r.json));
    return r.json;
  };
  const key = () => "journey" + process.pid + "x" + String(++journeyN).padStart(6, "0");
  const p = ok(await api("POST", "projects", { body: { noticeShown: true, consentAi: true } }), 201);
  const l = ok(await api("POST", "projects/" + p.id + "/address/lookup", { token: p.token, body: { postcode: "CH45 1AB" } }), 200);
  const a = l.addresses.find((x) => x.label.startsWith("1 Test Road"));
  ok(await api("POST", "projects/" + p.id + "/address", { token: p.token, body: { token: a.token } }), 200);
  ok(await api("POST", "projects/" + p.id + "/property/confirm", { token: p.token, body: { propertyType, pinConfirmed: true } }), 200);
  const raw = Buffer.alloc(900 * 600 * 3);
  for (let y = 0; y < 600; y++)
    for (let x = 0; x < 900; x++) {
      const i = (y * 900 + x) * 3;
      const v = 110 + 50 * Math.sin(x / 41) + 30 * Math.cos(y / 29);
      raw[i] = v;
      raw[i + 1] = v * 0.92;
      raw[i + 2] = v * 0.85;
    }
  const jpg = await load("serverlib/wvroofing/images.js").sharp()(raw, { raw: { width: 900, height: 600, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();
  const pre = ok(await api("POST", "projects/" + p.id + "/photo/presign", { token: p.token, body: { contentType: "image/jpeg", bytes: jpg.length } }), 200);
  await load("serverlib/wvroofing/storage.js").storage().put(new URL(pre.url, "http://localhost").searchParams.get("path"), jpg, "image/jpeg");
  ok(await api("POST", "projects/" + p.id + "/photo/commit", { token: p.token, body: { uploadId: pre.uploadId } }), 200);
  ok(
    await api("POST", "projects/" + p.id + "/mask", {
      token: p.token,
      body: { png: outlinePng(900, 600), shapes: [{ mode: "add", pts: [[180, 120], [540, 120], [540, 360]] }], displayW: 900, displayH: 600 },
    }),
    200
  );
  if (render) {
    ok(await api("POST", "projects/" + p.id + "/renders", { token: p.token, body: { visualIds: ["welsh-slate"], idempotencyKey: key() } }), 202);
    await load("serverlib/wvroofing/jobs.js").drain();
  }
  if (!enquiry) return { p };
  const e = ok(
    await api("POST", "projects/" + p.id + "/enquiry", {
      token: p.token,
      body: { name: "Sam Test", email: "sam@example.com", phone: "0151 496 0000", consent: true, elapsedMs: 9000, idempotencyKey: key(), product: "welsh-slate", includeImages: true },
    }),
    201
  );
  const { rows } = await load("serverlib/wvroofing/db.js").query("SELECT id FROM wvr_enquiries WHERE reference = $1", [e.reference]);
  return { p, ref: e.reference, id: rows[0].id };
}

/**
 * Remove a suite's temporary storage folder. On Windows a virus scanner can
 * briefly hold a file just written (EBUSY/EPERM), so retry, and never fail the
 * suite over leftover temp files.
 */
export function removeTempDir(dir) {
  if (!dir) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
  } catch (err) {
    console.warn("(temp folder left behind: " + dir + " - " + err.code + ")");
  }
}
