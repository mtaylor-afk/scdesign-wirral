// WV Roofing — a small client for Supabase Storage (service-role key, server only).
//
// Matthew chose (2026-10-03) to run WV Roofing's storage on the Supabase project
// SC Design already has on this Vercel project, so nothing new has to be set up:
// SC_SUPABASE_URL and SC_SUPABASE_SERVICE_ROLE_KEY are already there. WV Roofing
// keeps to its OWN private bucket ("wvroofing", made here on first use) and never
// reads or writes SC Design's tables or buckets. WVR_SUPABASE_URL /
// WVR_SUPABASE_SERVICE_ROLE_KEY / WVR_SUPABASE_BUCKET override them, if WV Roofing
// ever gets a Supabase project of its own.
//
// The same Storage API calls SC Design's admin already makes (serverlib/common.js):
//   POST   /storage/v1/bucket                          make the bucket
//   POST   /storage/v1/object/<bucket>/<path>          upload (x-upsert true|false)
//   GET    /storage/v1/object/authenticated/<b>/<p>    download
//   DELETE /storage/v1/object/<bucket>                 delete { prefixes }
//   POST   /storage/v1/object/list/<bucket>            list one folder level
//   POST   /storage/v1/object/upload/sign/<b>/<p>      a one-off upload link for the browser
//   POST   /storage/v1/object/sign/<b>/<p>             a short-lived download link
// The key never appears in an error message or a log line.
"use strict";

const { HttpError } = require("./core.js");

/** @type {typeof fetch} */
let fetchImpl = (...args) => fetch(...args);

/** Test helper: answer the calls with a pretend Supabase. @param {typeof fetch | null} f */
function setFetch(f) {
  fetchImpl = f || ((...args) => fetch(...args));
  bucketReady = null;
}

/** @param {Record<string, string | undefined>} env */
function settings(env) {
  const url = String(env.WVR_SUPABASE_URL || env.SC_SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/, "");
  const key = String(env.WVR_SUPABASE_SERVICE_ROLE_KEY || env.SC_SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const bucket = String(env.WVR_SUPABASE_BUCKET || "wvroofing").trim();
  return { url, key, bucket };
}

/** Is a Supabase project (and its service key) available? @param {Record<string, string | undefined>} env */
function configured(env) {
  const s = settings(env);
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(s.url) && s.key.length > 20 && /^[a-z0-9_-]{3,63}$/.test(s.bucket);
}

function cfg() {
  const s = settings(process.env);
  if (!configured(process.env)) throw new HttpError(503, "not_configured", "Project storage isn't set up yet.");
  return s;
}

/** @param {Record<string, string>} [extra] */
function headers(extra) {
  const { key } = cfg();
  return Object.assign({ apikey: key, Authorization: "Bearer " + key }, extra || {});
}

/** The path inside the bucket, made safe for a URL (each part encoded, slashes kept). @param {string} p */
function enc(p) {
  return String(p)
    .replace(/^\/+/, "")
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
}

/**
 * One call to Supabase. A dropped connection is tried again twice (every call
 * here is safe to repeat: see acquireLock in db.js for the one that isn't
 * obviously so); then it becomes a plain 503 (never the URL or key).
 * @param {string} method
 * @param {string} apiPath  after /storage/v1
 * @param {{ headers?: Record<string, string>, body?: any }} [o]
 */
async function call(method, apiPath, o) {
  const { url } = cfg();
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchImpl(url + "/storage/v1" + apiPath, { method, headers: headers(o && o.headers), body: o && o.body, signal: AbortSignal.timeout(20000) });
    } catch (err) {
      if (attempt >= 2) throw new HttpError(503, "storage_unavailable", "The photo store couldn't be reached just now. Please try again.");
      await new Promise((resolve) => setTimeout(resolve, 150 + attempt * 350));
    }
  }
}

/** Read an error reply's code without trusting its shape. @param {Response} res */
async function errorOf(res) {
  const text = await res.text().catch(() => "");
  let j = null;
  try {
    j = JSON.parse(text);
  } catch (err) {
    j = null;
  }
  const code = String((j && (j.error || j.code)) || "");
  const status = String((j && j.statusCode) || res.status);
  return { status, code, message: String((j && j.message) || "") };
}

/** @param {{ status: string, code: string, message: string }} e */
function isNotFound(e) {
  // "Bucket not found" is not "object not found": a missing bucket must never read as "no saved data".
  if (/bucket/i.test(e.code) || /bucket/i.test(e.message)) return false;
  return e.status === "404" || /not.?found|NoSuchKey/i.test(e.code) || /not.?found/i.test(e.message);
}

/** @param {{ status: string, code: string, message: string }} e */
function isDuplicate(e) {
  return e.status === "409" || /duplicate|already exists/i.test(e.code) || /duplicate|already exists/i.test(e.message);
}

function fail(/** @type {string} */ what, /** @type {number} */ status) {
  return new HttpError(503, "storage_unavailable", "The photo store didn't answer as expected (" + what + ", " + status + ").");
}

/** @type {Promise<void> | null} */
let bucketReady = null;

/** Make the private bucket the first time it's needed (once per instance). */
function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { bucket } = cfg();
      const got = await call("GET", "/bucket/" + encodeURIComponent(bucket));
      if (got.ok) return;
      const made = await call("POST", "/bucket", {
        headers: { "Content-Type": "application/json" },
        // Private: every read needs the service key or a signed link. 21 MB covers the
        // largest photo or plan (20 MB); the saved rows are a few hundred KB (outlines
        // are files of their own, not rows), and db.js warns long before this limit.
        body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: 21 * 1024 * 1024 }),
      });
      if (made.ok) return;
      const e = await errorOf(made);
      if (isDuplicate(e)) return;
      throw fail("make bucket", made.status);
    })().catch((err) => {
      bucketReady = null;
      throw err;
    });
  }
  return bucketReady;
}

/**
 * Upload one object.
 * @param {string} path
 * @param {Buffer | Uint8Array | string} body
 * @param {string} contentType
 * @param {{ upsert?: boolean }} [opts]
 * @returns {Promise<{ ok: true } | { ok: false, duplicate: true }>}
 */
async function upload(path, body, contentType, opts) {
  await ensureBucket();
  const { bucket } = cfg();
  const res = await call("POST", "/object/" + encodeURIComponent(bucket) + "/" + enc(path), {
    headers: { "Content-Type": contentType || "application/octet-stream", "x-upsert": opts && opts.upsert ? "true" : "false", "cache-control": "no-store" },
    body,
  });
  if (res.ok) return { ok: true };
  const e = await errorOf(res);
  if (isDuplicate(e)) return { ok: false, duplicate: true };
  throw fail("upload", res.status);
}

/**
 * Download one object, or null when it isn't there.
 * @param {string} path
 * @returns {Promise<{ buf: Buffer, contentType: string } | null>}
 */
async function download(path) {
  await ensureBucket();
  const { bucket } = cfg();
  const res = await call("GET", "/object/authenticated/" + encodeURIComponent(bucket) + "/" + enc(path));
  if (res.ok) return { buf: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") || "application/octet-stream" };
  // Only a definite "not found" means missing. Supabase answers most errors with HTTP 400 and the real
  // code inside (e.g. {"statusCode":"400","error":"InvalidJWT"}, checked 2026-10-04): reading any other
  // error as "missing" could make the saved rows look absent, and an empty copy would then overwrite them.
  const e = await errorOf(res);
  if (isNotFound(e)) return null;
  throw fail("download", res.status);
}

/**
 * Delete objects (missing ones are fine).
 * @param {string[]} paths
 */
async function remove(paths) {
  if (!paths.length) return;
  await ensureBucket();
  const { bucket } = cfg();
  for (let i = 0; i < paths.length; i += 500) {
    const res = await call("DELETE", "/object/" + encodeURIComponent(bucket), {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: paths.slice(i, i + 500) }),
    });
    if (!res.ok) {
      const e = await errorOf(res);
      if (!isNotFound(e)) throw fail("delete", res.status);
    }
  }
}

/**
 * Every object key under a folder, at any depth (the API lists one level at a
 * time, a page at a time; folders come back with id null).
 * @param {string} prefix  e.g. "projects/<id>/"
 * @returns {Promise<string[]>}
 */
async function list(prefix) {
  await ensureBucket();
  const { bucket } = cfg();
  /** @type {string[]} */
  const out = [];
  /**
   * @param {string} folder  without a trailing slash ("" for the root)
   * @param {number} depth
   */
  const walk = async (folder, depth) => {
    if (depth > 8) return;
    for (let offset = 0; ; offset += 100) {
      const res = await call("POST", "/object/list/" + encodeURIComponent(bucket), {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: folder, limit: 100, offset, sortBy: { column: "name", order: "asc" } }),
      });
      if (!res.ok) throw fail("list", res.status);
      const page = /** @type {any[]} */ (await res.json().catch(() => []));
      for (const item of Array.isArray(page) ? page : []) {
        if (!item || typeof item.name !== "string" || !item.name) continue;
        const full = folder ? folder + "/" + item.name : item.name;
        if (item.id === null || item.id === undefined) await walk(full, depth + 1);
        else out.push(full);
      }
      if (!Array.isArray(page) || page.length < 100) break;
    }
  };
  const p = String(prefix || "");
  const folder = p.endsWith("/") ? p.slice(0, -1) : p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
  await walk(folder, 0);
  return out.filter((k) => k.startsWith(p)).sort();
}

/**
 * A one-off link the browser PUTs one file to (valid for about two hours; the
 * server still checks the file when it is committed).
 * @param {string} path
 * @returns {Promise<string>}
 */
async function signUpload(path) {
  await ensureBucket();
  const { url, bucket } = cfg();
  const res = await call("POST", "/object/upload/sign/" + encodeURIComponent(bucket) + "/" + enc(path), { headers: { "Content-Type": "application/json" }, body: "{}" });
  if (!res.ok) throw fail("upload link", res.status);
  const j = /** @type {any} */ (await res.json().catch(() => ({})));
  const rel = typeof j.url === "string" ? j.url : "";
  if (!/^\/object\/upload\/sign\//.test(rel) || !/[?&]token=/.test(rel)) throw fail("upload link", res.status);
  return url + "/storage/v1" + rel;
}

/**
 * A short-lived link to download one object (for the operator's "original file").
 * @param {string} path
 * @param {number} seconds
 */
async function signDownload(path, seconds) {
  await ensureBucket();
  const { url, bucket } = cfg();
  const res = await call("POST", "/object/sign/" + encodeURIComponent(bucket) + "/" + enc(path), {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: Math.max(30, Math.min(3600, Math.round(seconds))) }),
  });
  if (!res.ok) throw fail("download link", res.status);
  const j = /** @type {any} */ (await res.json().catch(() => ({})));
  const rel = typeof j.signedURL === "string" ? j.signedURL : typeof j.signedUrl === "string" ? j.signedUrl : "";
  if (!/^\/object\/sign\//.test(rel)) throw fail("download link", res.status);
  return url + "/storage/v1" + rel;
}

module.exports = { configured, settings, ensureBucket, upload, download, remove, list, signUpload, signDownload, setFetch };
