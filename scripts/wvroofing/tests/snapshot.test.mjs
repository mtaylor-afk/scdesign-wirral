// Snapshot mode (db.js) and the Supabase store (supabase.js, storage.js): WV
// Roofing running on the Supabase project already on the Vercel project, with
// nothing to set up. NOT the test environment: production code paths, against a
// pretend Supabase Storage held in memory (no network, no real keys). Instance A
// runs in this process, instance B in another (snapshot-instance.mjs), as on Vercel.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import http from "node:http";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { load, apiFor, call, outlinePng, SITE } from "./helpers.mjs";

const URL_BASE = "https://abcdefghijklmnop.supabase.co";
const KEY = "service-role-" + "k".repeat(40);

for (const k of ["WVR_ENV", "WVR_DATABASE_URL", "DATABASE_URL", "POSTGRES_URL", "BLOB_STORE_ID", "BLOB_READ_WRITE_TOKEN", "WVR_SESSION_SECRET", "WVR_OPERATOR_PASSWORD_HASH", "WVR_OPERATOR_USER", "WVR_SUPABASE_URL", "WVR_SUPABASE_SERVICE_ROLE_KEY", "WVR_SUPABASE_BUCKET"]) {
  delete process.env[k];
}
process.env.SC_SUPABASE_URL = URL_BASE;
process.env.SC_SUPABASE_SERVICE_ROLE_KEY = KEY;
process.env.SC_ADMIN_SESSION_SECRET = "sc-admin-session-" + "s".repeat(40);
process.env.WVR_PROJECTS_PER_IP_DAILY = "1000";
process.env.WVR_DAILY_UPLOADS = "1000";
// The production wait (25 s) shortened; the tests about a held lock shorten it further (shortWait).
process.env.WVR_SNAPSHOT_LOCK_WAIT_MS = "15000";
/** Run fn with a 1.5 s wait for the lock. @param {() => Promise<void>} fn */
async function shortWait(fn) {
  process.env.WVR_SNAPSHOT_LOCK_WAIT_MS = "1500";
  try {
    await fn();
  } finally {
    process.env.WVR_SNAPSHOT_LOCK_WAIT_MS = "15000";
  }
}

// ---------------------------------------------------------------------------
// a pretend Supabase Storage: buckets and objects in memory, the same replies
// (status codes and error shapes) as the real Storage API

function fakeSupabase() {
  const S = { buckets: new Set(), objects: new Map(), calls: [], failNext: null, onCall: null, latency: true };
  const reply = (status, body, type) =>
    new Response(body == null ? null : typeof body === "string" || body instanceof Uint8Array ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": type || "application/json" },
    });
  const err = (code, error, message) => reply(400, { statusCode: String(code), error, message });
  const key = (bucket, p) => bucket + "/" + decodeURIComponent(p);
  async function fetchFake(input, init = {}) {
    const u = new URL(String(input));
    const method = (init.method || "GET").toUpperCase();
    const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
    const route = u.pathname.replace(/^\/storage\/v1/, "");
    S.calls.push(method + " " + route);
    if (S.onCall) S.onCall(method, route);
    if (S.latency) await new Promise((r) => setTimeout(r, 1 + Math.floor(Math.random() * 6)));
    if (S.failNext && S.failNext(method, route)) {
      S.failNext = null;
      return reply(500, { statusCode: "500", error: "internal", message: "pretend failure" });
    }
    const signed = /^\/object\/upload\/sign\/([^/]+)\/(.+)$/.exec(route);
    if (signed && method === "PUT") {
      // The browser's upload: the token is the only credential. Like Supabase, a link
      // signed without x-upsert can be used again, but never over an existing object.
      if (u.searchParams.get("token") !== "t-" + key(signed[1], signed[2])) return err(400, "InvalidSignature", "bad token");
      if (S.objects.has(key(signed[1], signed[2]))) return err(409, "Duplicate", "The resource already exists");
      S.objects.set(key(signed[1], signed[2]), { buf: Buffer.from(await new Response(init.body).arrayBuffer()), type: headers["content-type"] || "application/octet-stream" });
      return reply(200, { Key: key(signed[1], signed[2]) });
    }
    if (headers.apikey !== KEY || headers.authorization !== "Bearer " + KEY) return reply(401, { statusCode: "401", error: "Unauthorized", message: "no key" });
    let m;
    if ((m = /^\/bucket\/([^/]+)$/.exec(route)) && method === "GET") return S.buckets.has(m[1]) ? reply(200, { id: m[1], public: false }) : err(404, "Bucket not found", "Bucket not found");
    if (route === "/bucket" && method === "POST") {
      const b = JSON.parse(init.body);
      assert.equal(b.public, false, "the bucket is private");
      if (S.buckets.has(b.id)) return err(409, "Duplicate", "The resource already exists");
      S.buckets.add(b.id);
      return reply(200, { name: b.id });
    }
    if (signed && method === "POST") return reply(200, { url: "/object/upload/sign/" + signed[1] + "/" + signed[2] + "?token=" + encodeURIComponent("t-" + key(signed[1], signed[2])) });
    if ((m = /^\/object\/sign\/([^/]+)\/(.+)$/.exec(route)) && method === "POST") return reply(200, { signedURL: "/object/sign/" + m[1] + "/" + m[2] + "?token=dl" });
    if ((m = /^\/object\/authenticated\/([^/]+)\/(.+)$/.exec(route)) && method === "GET") {
      const o = S.objects.get(key(m[1], m[2]));
      return o ? reply(200, new Uint8Array(o.buf), o.type) : err(404, "not_found", "Object not found");
    }
    if ((m = /^\/object\/list\/([^/]+)$/.exec(route)) && method === "POST") {
      const b = JSON.parse(init.body);
      const folder = b.prefix ? b.prefix + "/" : "";
      const names = new Map();
      for (const k of S.objects.keys()) {
        if (!k.startsWith(m[1] + "/" + folder)) continue;
        const rest = k.slice(m[1].length + 1 + folder.length);
        const slash = rest.indexOf("/");
        names.set(slash < 0 ? rest : rest.slice(0, slash), slash < 0 ? "id-" + rest : null);
      }
      const all = [...names.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([name, id]) => ({ name, id }));
      return reply(200, all.slice(b.offset || 0, (b.offset || 0) + (b.limit || 100)));
    }
    if ((m = /^\/object\/([^/]+)$/.exec(route)) && method === "DELETE") {
      for (const p of JSON.parse(init.body).prefixes) S.objects.delete(m[1] + "/" + p);
      return reply(200, []);
    }
    if ((m = /^\/object\/([^/]+)\/(.+)$/.exec(route)) && method === "POST") {
      if (!S.buckets.has(m[1])) return err(404, "Bucket not found", "Bucket not found");
      const k = key(m[1], m[2]);
      if (headers["x-upsert"] !== "true" && S.objects.has(k)) return err(409, "Duplicate", "The resource already exists");
      S.objects.set(k, { buf: Buffer.from(init.body), type: headers["content-type"] || "application/octet-stream" });
      return reply(200, { Key: k });
    }
    return err(404, "not_found", "no such route " + method + " " + route);
  }
  return { S, fetch: fetchFake };
}

const fake = fakeSupabase();
/** Where the pretend Supabase listens, for the other instance (set in before()). */
let LOCAL = "";
/** fetch to the pretend Supabase over local HTTP, as the other instance does. */
const viaHttp = (input, init) => fetch(String(input).replace(URL_BASE, LOCAL), init);

const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const r = await fake.fetch(URL_BASE + req.url, { method: req.method, headers: req.headers, body: hasBody ? Buffer.concat(chunks) : undefined });
    res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "application/json" });
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (err) {
    console.error("pretend Supabase failed:", err);
    res.writeHead(500, { "content-type": "application/json" });
    res.end("{}");
  }
});

// Instance A: this process. Instance B: another process (snapshot-instance.mjs).
const app = load("api/wvroofing/app.js");
const sb = load("serverlib/wvroofing/supabase.js");
const db = load("serverlib/wvroofing/db.js");
sb.setFetch(fake.fetch);
const A = { api: apiFor(app), reset: () => db.reset() };

/** Another server instance, in its own process. */
function spawnInstance() {
  const child = fork(path.join(path.dirname(fileURLToPath(import.meta.url)), "snapshot-instance.mjs"), [], {
    env: Object.assign({}, process.env, { WVR_FAKE_SUPABASE: LOCAL }),
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  const waiting = new Map();
  let n = 0;
  const ready = new Promise((resolve) => {
    child.on("message", (m) => {
      if (m.ready) return resolve();
      const done = waiting.get(m.id);
      waiting.delete(m.id);
      if (m.error) throw new Error("instance B: " + m.error);
      done(m);
    });
  });
  const send = (msg) =>
    new Promise((resolve) => {
      const id = ++n;
      waiting.set(id, resolve);
      child.send(Object.assign({ id }, msg));
    });
  return { ready, api: (method, route, opts) => send({ method, route, opts }), reset: () => send({ reset: true }), stop: () => child.disconnect() };
}

/** @type {ReturnType<typeof spawnInstance>} */
let B;

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  LOCAL = "http://127.0.0.1:" + server.address().port;
  assert.equal(db.snapshotMode(process.env), true);
  assert.equal(db.mode(), "snapshot");
  B = spawnInstance();
  await B.ready;
});

after(async () => {
  if (B) B.stop();
  await db.reset();
  await new Promise((resolve) => server.close(resolve));
});

let ipN = 0;
const nextIp = () => "198.51.100." + ((++ipN % 250) + 1);

const head = () => {
  const o = fake.S.objects.get("wvroofing/db/head.json");
  return o ? JSON.parse(o.buf.toString("utf8")) : null;
};

const LOCK = "wvroofing/db/lock.json";
const holdLock = (owner, at) => fake.S.objects.set(LOCK, { buf: Buffer.from(JSON.stringify({ owner, at })), type: "application/json" });

async function newProject(i) {
  const r = await i.api("POST", "projects", { body: { noticeShown: true }, ip: nextIp() });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json;
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------

test("supabase.js: the private bucket is made once; duplicates, missing objects, folders and links", async () => {
  assert.equal(sb.configured(process.env), true);
  assert.equal(sb.configured({ SC_SUPABASE_URL: "https://evil.example.com", SC_SUPABASE_SERVICE_ROLE_KEY: KEY }), false, "only a supabase.co project");
  assert.equal(sb.configured({ SC_SUPABASE_URL: URL_BASE, SC_SUPABASE_SERVICE_ROLE_KEY: "short" }), false);
  assert.deepEqual(await sb.upload("t/one.txt", "1", "text/plain"), { ok: true });
  assert.ok(fake.S.buckets.has("wvroofing"));
  assert.deepEqual(await sb.upload("t/one.txt", "2", "text/plain"), { ok: false, duplicate: true }, "no overwrite without upsert");
  assert.deepEqual(await sb.upload("t/one.txt", "3", "text/plain", { upsert: true }), { ok: true });
  assert.equal((await sb.download("t/one.txt")).buf.toString(), "3");
  assert.equal(await sb.download("t/none.txt"), null);
  await sb.upload("t/a/b/deep.txt", "x", "text/plain");
  assert.deepEqual(await sb.list("t/"), ["t/a/b/deep.txt", "t/one.txt"], "every depth");
  const up = await sb.signUpload("t/up.jpg");
  assert.ok(up.startsWith(URL_BASE + "/storage/v1/object/upload/sign/wvroofing/t/up.jpg?token="), up);
  assert.ok((await sb.signDownload("t/one.txt", 300)).startsWith(URL_BASE + "/storage/v1/object/sign/"));
  await sb.remove(["t/one.txt", "t/a/b/deep.txt", "t/missing"]);
  assert.deepEqual(await sb.list("t/"), []);
  // A network failure says so plainly, and never shows the key.
  sb.setFetch(() => Promise.reject(new Error("socket hang up " + KEY)));
  try {
    await assert.rejects(sb.download("t/x"), (e) => e.status === 503 && !String(e.message).includes(KEY) && !String(e.message).includes("hang up"));
  } finally {
    sb.setFetch(fake.fetch);
  }
});

test("the set-up is complete with nothing set but SC Design's Supabase", async () => {
  const h = await A.api("GET", "health");
  assert.equal(h.status, 200);
  assert.equal(h.json.store, "snapshot");
  assert.equal(h.json.environment, "production");
  assert.deepEqual(h.json.setup, { database: true, photoStore: true, sessionSecret: true, cronSecret: true, adminPassword: true, enquiryEmail: false });
  assert.equal(h.json.capabilities.enquiry_storage.state, "enabled");
  assert.ok(!JSON.stringify(h.json).includes(KEY));
});

test("a project is saved to the bucket, and another instance (and a restart) finds it", async () => {
  const p = await newProject(A);
  const hd = head();
  assert.ok(hd && hd.version >= 1 && /^db\/rows-\d+\.json\.gz$/.test(hd.key), JSON.stringify(hd));
  const rows = JSON.parse(zlib.gunzipSync(fake.S.objects.get("wvroofing/" + hd.key).buf).toString("utf8"));
  assert.ok(rows.tables.wvr_projects.rows.includes(p.id), "the row is in the snapshot");
  assert.ok(!rows.tables.wvr_projects.rows.includes(p.token), "the project key itself is never stored, only its hash");
  const got = await B.api("GET", "projects/" + p.id, { token: p.token });
  assert.equal(got.status, 200, JSON.stringify(got.json));
  await A.reset();
  assert.equal((await A.api("GET", "projects/" + p.id, { token: p.token })).status, 200);
});

test("two instances writing at once lose nothing (the lock in the bucket)", async () => {
  const made = await Promise.all([0, 1, 2, 3, 4, 5].map((n) => newProject(n % 2 ? A : B)));
  await B.reset();
  for (const p of made) assert.equal((await B.api("GET", "projects/" + p.id, { token: p.token })).status, 200, "project " + p.id);
  assert.ok(!fake.S.objects.has(LOCK), "the lock is given back");
  const kept = [...fake.S.objects.keys()].filter((k) => k.startsWith("wvroofing/db/rows-"));
  assert.ok(kept.length <= 2, "only the newest snapshot and one spare are kept: " + kept.join(", "));
});

test("a read sees another instance's change within 2 seconds; a write always works from the newest rows", async () => {
  const p = await newProject(B);
  await pause(2100);
  assert.equal((await A.api("GET", "projects/" + p.id, { token: p.token })).status, 200);
  const q = await newProject(B);
  const del = await A.api("POST", "projects/" + q.id + "/delete", { token: q.token });
  assert.equal(del.status, 200, JSON.stringify(del.json));
  await pause(2100);
  assert.equal((await B.api("GET", "projects/" + q.id, { token: q.token })).status, 404, "B sees A's delete");
});

test("reads that change nothing never save", async () => {
  await A.api("GET", "health");
  const before = head().version;
  const saves = () => fake.S.calls.filter((c) => c.startsWith("POST /object/wvroofing/db/rows-")).length;
  const uploads = saves();
  for (let i = 0; i < 5; i++) assert.equal((await A.api("GET", "health")).status, 200);
  assert.equal(head().version, before);
  assert.equal(saves(), uploads);
});

test("the admin logs in with 222 / 333, and the session works on another instance", async () => {
  assert.equal((await A.api("POST", "operator/login", { body: { username: "222", password: "334" }, ip: nextIp() })).status, 401);
  assert.equal((await A.api("POST", "operator/login", { body: { username: "223", password: "333" }, ip: nextIp() })).status, 401);
  const t = load("serverlib/wvroofing/auth.js").TEST_OPERATOR_PASSWORD;
  assert.equal((await A.api("POST", "operator/login", { body: { username: "222", password: t }, ip: nextIp() })).status, 401, "never the test password in production");
  const r = await A.api("POST", "operator/login", { body: { username: "222", password: "333" }, ip: nextIp() });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  await B.reset();
  const s = await B.api("GET", "operator/session", { token: r.json.token });
  assert.equal(s.status, 200, JSON.stringify(s.json));
  assert.equal(s.json.environment, "production");
  assert.equal((await B.api("GET", "operator/overview", { token: r.json.token })).status, 200);
  assert.equal((await B.api("POST", "operator/logout", { token: r.json.token })).status, 200);
  await pause(2100);
  assert.equal((await A.api("GET", "operator/session", { token: r.json.token })).status, 401, "logged out everywhere");
});

test("a photo goes from the phone straight to the bucket, and the admin can see it", async () => {
  const p = await newProject(A);
  const sharp = load("serverlib/wvroofing/images.js").sharp();
  const jpg = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 120, g: 110, b: 100 } } })
    .jpeg({ quality: 85 })
    .toBuffer();
  const pre = await A.api("POST", "projects/" + p.id + "/photo/presign", { token: p.token, body: { contentType: "image/jpeg", bytes: jpg.length }, ip: nextIp() });
  assert.equal(pre.status, 200, JSON.stringify(pre.json));
  assert.ok(pre.json.url.startsWith(URL_BASE + "/storage/v1/object/upload/sign/wvroofing/projects/" + p.id + "/"), pre.json.url);
  // What the browser does with it: a plain PUT with the link's token, no key.
  const put = await viaHttp(pre.json.url, { method: "PUT", headers: pre.json.headers, body: jpg });
  assert.equal(put.status, 200);
  const commit = await B.api("POST", "projects/" + p.id + "/photo/commit", { token: p.token, body: { uploadId: pre.json.uploadId }, ip: nextIp() });
  assert.equal(commit.status, 200, JSON.stringify(commit.json));
  // The link can't be used again: the finished upload's place is taken by an empty file.
  const again = await viaHttp(pre.json.url, { method: "PUT", headers: pre.json.headers, body: jpg });
  assert.equal(again.status, 400, "a used upload link is refused");
  const incoming = [...fake.S.objects.keys()].filter((k) => k.startsWith("wvroofing/projects/" + p.id + "/incoming/"));
  assert.equal(incoming.length, 1);
  assert.equal(fake.S.objects.get(incoming[0]).buf.length, 1, "the raw upload is gone; only a one-byte placeholder is left");
  const login = await B.api("POST", "operator/login", { body: { username: "222", password: "333" }, ip: nextIp() });
  assert.equal(login.status, 200);
  await pause(2100);
  const photos = await A.api("GET", "operator/projects", { token: login.json.token });
  assert.equal(photos.status, 200, JSON.stringify(photos.json));
  assert.ok(JSON.stringify(photos.json).includes(p.id), "the photo is listed");
  const thumb = await A.api("GET", "operator/projects/" + p.id + "/photo?size=thumb", { token: login.json.token });
  assert.equal(thumb.status, 200);
  assert.match(String(thumb.headers["content-type"]), /^image\//);
});

test("someone else's turn is waited for; a lock left by a crash is cleared; a lock held too long answers 503 busy", async () => {
  try {
    holdLock("other", Date.now());
    setTimeout(() => fake.S.objects.delete(LOCK), 400);
    const t0 = Date.now();
    await newProject(A);
    assert.ok(Date.now() - t0 >= 350, "it waited for the other turn");
    holdLock("crashed", Date.now() - 120000);
    await newProject(A);
    holdLock("busy", Date.now());
    /** @type {any} */
    let busy;
    await shortWait(async () => {
      busy = await A.api("POST", "projects", { body: { noticeShown: true }, ip: nextIp() });
    });
    assert.equal(busy.status, 503);
    assert.equal(busy.json.error, "busy");
    assert.equal(busy.headers["retry-after"], "3");
    assert.equal(fake.S.objects.has(LOCK) && JSON.parse(fake.S.objects.get(LOCK).buf.toString()).owner, "busy", "someone else's lock is left alone");
  } finally {
    fake.S.objects.delete(LOCK);
  }
});

test("a save that fails is never reported as saved, and the next request starts from what was saved", async () => {
  const before = head().version;
  fake.S.failNext = (method, route) => method === "POST" && route === "/object/wvroofing/db/head.json";
  const r = await A.api("POST", "projects", { body: { noticeShown: true }, ip: nextIp() });
  assert.equal(r.status, 503, JSON.stringify(r.json));
  assert.equal(r.json.error, "busy");
  assert.equal(r.json.id, undefined, "no project is handed out");
  assert.equal(head().version, before);
  assert.ok(!fake.S.objects.has(LOCK), "the lock is given back after a failure");
  const p = await newProject(A);
  assert.equal((await A.api("GET", "projects/" + p.id, { token: p.token })).status, 200);
});

test("saved rows that can't be read stop everything rather than starting empty", async () => {
  const hd = head();
  const saved = fake.S.objects.get("wvroofing/" + hd.key);
  fake.S.objects.delete("wvroofing/" + hd.key);
  try {
    await A.reset();
    const r = await A.api("POST", "projects", { body: { noticeShown: true }, ip: nextIp() });
    assert.equal(r.status, 503);
    assert.equal(head().version, hd.version, "the saved rows weren't overwritten with empty ones");
    assert.equal((await A.api("GET", "health")).status, 503);
  } finally {
    fake.S.objects.set("wvroofing/" + hd.key, saved);
  }
  assert.equal((await A.api("POST", "projects", { body: { noticeShown: true }, ip: nextIp() })).status, 201);
});

test("if the pointer to the newest save goes missing, the newest saved rows are used, never empty tables", async () => {
  const p = await newProject(A);
  const pointer = fake.S.objects.get("wvroofing/db/head.json");
  fake.S.objects.delete("wvroofing/db/head.json");
  try {
    await A.reset();
    assert.equal((await A.api("GET", "projects/" + p.id, { token: p.token })).status, 200, "found from the newest rows-N file");
    const q = await newProject(A);
    assert.ok(head() && head().version > JSON.parse(pointer.buf.toString()).version - 1, "saving again writes a new pointer");
    await A.reset();
    assert.equal((await A.api("GET", "projects/" + q.id, { token: q.token })).status, 200);
  } finally {
    if (!fake.S.objects.has("wvroofing/db/head.json")) fake.S.objects.set("wvroofing/db/head.json", pointer);
  }
});

test("only a definite 'not found' counts as missing: any other error stops rather than starting empty", async () => {
  const saved = fake.S.failNext;
  // Supabase sends most errors as HTTP 400 with the real code inside.
  sb.setFetch(async (input, init) => {
    if (/db\/head\.json$/.test(String(input)) && (init.method || "GET") === "GET") {
      return new Response(JSON.stringify({ statusCode: "400", error: "InvalidJWT", message: "Invalid Compact JWS" }), { status: 400, headers: { "content-type": "application/json" } });
    }
    return fake.fetch(input, init);
  });
  try {
    await A.reset();
    const r = await A.api("POST", "projects", { body: { noticeShown: true }, ip: nextIp() });
    assert.equal(r.status, 503, JSON.stringify(r.json));
  } finally {
    sb.setFetch(fake.fetch);
    fake.S.failNext = saved;
  }
  assert.equal((await A.api("POST", "projects", { body: { noticeShown: true }, ip: nextIp() })).status, 201);
});

/** A project with a committed 900 x 600 photo, through instance i. */
async function projectWithPhoto(i) {
  const p = await newProject(i);
  const sharp = load("serverlib/wvroofing/images.js").sharp();
  const jpg = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 120, g: 110, b: 100 } } })
    .jpeg({ quality: 85 })
    .toBuffer();
  const pre = await i.api("POST", "projects/" + p.id + "/photo/presign", { token: p.token, body: { contentType: "image/jpeg", bytes: jpg.length }, ip: nextIp() });
  assert.equal(pre.status, 200, JSON.stringify(pre.json));
  assert.equal((await viaHttp(pre.json.url, { method: "PUT", headers: pre.json.headers, body: jpg })).status, 200);
  const c = await i.api("POST", "projects/" + p.id + "/photo/commit", { token: p.token, body: { uploadId: pre.json.uploadId }, ip: nextIp() });
  assert.equal(c.status, 200, JSON.stringify(c.json));
  return p;
}

test("roof outlines are files next to the photo, never rows in the saved snapshot; old ones go; a daily limit per project", async () => {
  const p = await projectWithPhoto(A);
  const png = outlinePng(900, 600);
  const send = () =>
    A.api("POST", "projects/" + p.id + "/mask", { token: p.token, body: { png, shapes: [{ mode: "add", pts: [[180, 120], [540, 120], [540, 360]] }], displayW: 900, displayH: 600 }, ip: nextIp() });
  const m1 = await send();
  assert.equal(m1.status, 200, JSON.stringify(m1.json));
  const m2 = await send();
  assert.equal(m2.status, 200, JSON.stringify(m2.json));
  const files = [...fake.S.objects.keys()].filter((k) => k.startsWith("wvroofing/projects/" + p.id + "/masks/"));
  assert.deepEqual(files, ["wvroofing/projects/" + p.id + "/masks/" + m2.json.mask.id + ".png"], "the earlier outline went with its row");
  const rows = JSON.parse(zlib.gunzipSync(fake.S.objects.get("wvroofing/" + head().key).buf).toString("utf8"));
  assert.ok(rows.tables.wvr_masks.rows.includes(m2.json.mask.id), "the outline's row is saved");
  assert.ok(!/\\\\x89504e47/i.test(rows.tables.wvr_masks.rows), "but not its picture");
  process.env.WVR_MASKS_PER_PROJECT_DAILY = "3";
  try {
    assert.equal((await send()).status, 200);
    const over = await send();
    assert.equal(over.status, 429, JSON.stringify(over.json));
  } finally {
    delete process.env.WVR_MASKS_PER_PROJECT_DAILY;
  }
});

test("requests refused without the database never take the lock", async () => {
  const locks = () => fake.S.calls.filter((c) => c === "POST /object/wvroofing/db/lock.json").length;
  const before = locks();
  assert.equal((await A.api("POST", "nothing-here", { body: {} })).status, 404);
  assert.equal((await A.api("POST", "projects", { body: {}, origin: "https://evil.example" })).status, 403);
  assert.equal((await call(app, "POST", "/api/wvroofing/projects", { origin: SITE, "content-type": "text/plain" }, "x")).status, 415);
  assert.equal((await A.api("GET", "cron/daily")).status, 503, "no CRON_SECRET: refused before any turn");
  assert.equal(locks(), before);
});

test("a 'busy' answer carries CORS headers, so the pages (on another origin) can read it", async () => {
  holdLock("busy2", Date.now());
  try {
    /** @type {any} */
    let r;
    await shortWait(async () => {
      r = await A.api("POST", "projects", { body: { noticeShown: true }, ip: nextIp() });
    });
    assert.equal(r.status, 503);
    assert.equal(r.headers["access-control-allow-origin"], SITE);
    assert.equal(r.headers["retry-after"], "3");
  } finally {
    fake.S.objects.delete(LOCK);
  }
});

test("a save never overwrites one made meanwhile by another instance", async () => {
  await newProject(A);
  const before = head();
  let heads = 0;
  fake.S.onCall = (method, route) => {
    // The turn reads the pointer twice: when it starts, and again just before saving.
    if (method === "GET" && route === "/object/authenticated/wvroofing/db/head.json" && ++heads === 2) {
      const next = head().version + 1;
      const key = "db/rows-" + next + ".json.gz";
      fake.S.objects.set("wvroofing/" + key, fake.S.objects.get("wvroofing/" + head().key));
      fake.S.objects.set("wvroofing/db/head.json", { buf: Buffer.from(JSON.stringify({ version: next, key })), type: "application/json" });
    }
  };
  let r;
  try {
    r = await A.api("POST", "projects", { body: { noticeShown: true }, ip: nextIp() });
  } finally {
    fake.S.onCall = null;
  }
  assert.equal(r.status, 503, JSON.stringify(r.json));
  assert.equal(head().version, before.version + 1, "the other instance's save stands");
  const p = await newProject(A);
  assert.equal(head().version, before.version + 2, "and the next save follows on from it");
  assert.equal((await A.api("GET", "projects/" + p.id, { token: p.token })).status, 200);
});

test("only one waiter clears a lock left by a crash", async () => {
  const at = Date.now() - 120000;
  holdLock("crashed2", at);
  // Another waiter has already claimed the right to clear it (its takeover marker).
  fake.S.objects.set("wvroofing/db/takeover-crashed2-" + at + ".json", { buf: Buffer.from("{}"), type: "application/json" });
  try {
    /** @type {any} */
    let r;
    await shortWait(async () => {
      r = await A.api("POST", "projects", { body: { noticeShown: true }, ip: nextIp() });
    });
    assert.equal(r.status, 503, "it leaves the lock to the waiter that claimed it");
    assert.equal(JSON.parse(fake.S.objects.get(LOCK).buf.toString()).owner, "crashed2");
  } finally {
    fake.S.objects.delete(LOCK);
  }
  assert.equal((await A.api("POST", "projects", { body: { noticeShown: true }, ip: nextIp() })).status, 201);
});

test("each visitor gets a fair share of the requests that take the lock", async () => {
  process.env.WVR_WRITES_PER_IP_MINUTE = "3";
  try {
    const ip = "203.0.113.77";
    for (let n = 0; n < 3; n++) assert.equal((await A.api("POST", "projects", { body: { noticeShown: true }, ip })).status, 201);
    const r = await A.api("POST", "projects", { body: { noticeShown: true }, ip });
    assert.equal(r.status, 429);
    assert.ok(Number(r.headers["retry-after"]) >= 1);
    assert.equal((await A.api("POST", "projects", { body: { noticeShown: true }, ip: nextIp() })).status, 201, "other visitors aren't held up");
  } finally {
    delete process.env.WVR_WRITES_PER_IP_MINUTE;
  }
});

test("the roofer is emailed only once the enquiry is saved", async () => {
  Object.assign(process.env, { WVR_LEAD_TO: "roofer@example.com", WVR_CAP_ENQUIRY_DELIVERY: "on", WVR_MAIL_DRYRUN: "1" });
  const jobs = load("serverlib/wvroofing/jobs.js");
  /** @type {string[]} */
  const said = [];
  const log = console.log;
  console.log = (...a) => said.push(a.join(" "));
  const emails = () => said.filter((l) => /DRY RUN email/.test(l)).length;
  const form = (k) => ({ name: "Sam Test", phone: "+44 151 496 0003", email: "sam@example.com", message: "Hello", consent: true, source: "bulletin", elapsedMs: 9000, idempotencyKey: k });
  try {
    fake.S.failNext = (method, route) => method === "POST" && route === "/object/wvroofing/db/head.json";
    const failed = await A.api("POST", "enquiries", { body: form("snapkey00000001"), ip: nextIp() });
    assert.equal(failed.status, 503, JSON.stringify(failed.json));
    await jobs.drain();
    assert.equal(emails(), 0, "no email about an enquiry that wasn't saved");
    const ok = await A.api("POST", "enquiries", { body: form("snapkey00000002"), ip: nextIp() });
    assert.equal(ok.status, 201, JSON.stringify(ok.json));
    await jobs.drain();
    assert.equal(emails(), 1, "emailed once saved");
  } finally {
    console.log = log;
    fake.S.failNext = null;
    for (const k of ["WVR_LEAD_TO", "WVR_CAP_ENQUIRY_DELIVERY", "WVR_MAIL_DRYRUN"]) delete process.env[k];
  }
});

test("the daily tidy-up runs inside requests, once a day", async () => {
  const count = async () => (await db.query("SELECT count(*)::int AS n FROM wvr_retention_runs WHERE kind = 'daily'")).rows[0].n;
  const first = await count();
  assert.equal(first, 1, "it ran once, on the first request");
  await newProject(A);
  await A.reset();
  await newProject(A);
  assert.equal(await count(), 1, "a new instance checks, but it isn't due again the same day");
});
