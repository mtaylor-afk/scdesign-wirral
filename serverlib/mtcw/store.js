'use strict';

// Shared storage for the forms function: a PRIVATE bucket ("mtcw-forms") in the Supabase project SC Design already
// has on this Vercel project (SC_SUPABASE_URL + SC_SUPABASE_SERVICE_ROLE_KEY, the same pair WV Roofing's "snapshot
// mode" reuses), so the owner sets nothing up. Only the Storage API is used (no table has to be created): the same
// calls serverlib/wvroofing/supabase.js already proved with these credentials. MTCW_SUPABASE_BUCKET overrides the
// bucket name.
//
// Used for two things (FORMS-CONTRACT section 15):
//   1. shared rate limits and de-duplication across instances (keys are HMAC hashes only, never personal data);
//   2. a private safety-net copy of each sent brief / quick message (photos: metadata only, never the bytes).
//
// FAILS OPEN: every call has a short timeout; any failure is caught by the caller, which falls back to the
// in-memory behaviour. Never in sink (local) mode unless a test injects a pretend Supabase with setFetch().
// The key never appears in an error, a log line or the health response.

const crypto = require('node:crypto');

const TIMEOUT_MS = 4000;

let fetchImpl = null; // tests only
let bucketReady = null;
const status = { lastError: null, lastErrorAt: null, lastOkAt: null };

function setFetch(f) {
  fetchImpl = f || null;
  bucketReady = null;
  status.lastError = null;
  status.lastErrorAt = null;
  status.lastOkAt = null;
}

function settings() {
  const url = String(process.env.SC_SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/, '');
  const key = String(process.env.SC_SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const bucket = String(process.env.MTCW_SUPABASE_BUCKET || 'mtcw-forms').trim();
  return { url, key, bucket };
}

function configured() {
  const s = settings();
  if (!/^[a-z0-9_-]{3,63}$/.test(s.bucket) || s.key.length <= 20) return false;
  if (fetchImpl) return /^https?:\/\//.test(s.url);
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(s.url);
}

/** Is shared storage in use for this request? (Never in sink mode, except with a test's pretend Supabase.) */
function enabled() {
  if (!configured()) return false;
  if (fetchImpl) return true;
  return String(process.env.MTCW_MAIL_MODE || '').trim().toLowerCase() !== 'sink';
}

class StoreError extends Error {
  constructor(what) {
    super(`store: ${what}`);
    this.name = 'StoreError';
  }
}

function noteError(what) {
  status.lastError = what;
  status.lastErrorAt = Date.now();
}

function noteOk() {
  status.lastOkAt = Date.now();
}

function enc(p) {
  return String(p)
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');
}

async function call(method, apiPath, { headers, body } = {}) {
  const { url, key } = settings();
  const f = fetchImpl || ((...a) => fetch(...a));
  try {
    return await f(`${url}/storage/v1${apiPath}`, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${key}`, ...(headers || {}) },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    noteError('unreachable');
    throw new StoreError('unreachable');
  }
}

async function errorOf(res) {
  const text = await res.text().catch(() => '');
  let j = null;
  try {
    j = JSON.parse(text);
  } catch {
    j = null;
  }
  return {
    status: String((j && j.statusCode) || res.status),
    code: String((j && (j.error || j.code)) || ''),
    message: String((j && j.message) || ''),
  };
}

function isDuplicate(e) {
  return e.status === '409' || /duplicate|already exists/i.test(e.code) || /duplicate|already exists/i.test(e.message);
}

function isNotFound(e) {
  if (/bucket/i.test(e.code) || /bucket/i.test(e.message)) return false;
  return e.status === '404' || /not.?found|NoSuchKey/i.test(e.code) || /not.?found/i.test(e.message);
}

function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { bucket } = settings();
      const got = await call('GET', `/bucket/${encodeURIComponent(bucket)}`);
      if (got.ok) return;
      const made = await call('POST', '/bucket', {
        headers: { 'Content-Type': 'application/json' },
        // Private: nothing in it can be read without the service key. Objects are small JSON notes.
        body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: 1024 * 1024 }),
      });
      if (made.ok) return;
      if (isDuplicate(await errorOf(made))) return;
      noteError('bucket');
      throw new StoreError('bucket');
    })().catch((err) => {
      bucketReady = null;
      throw err;
    });
  }
  return bucketReady;
}

/** Create (or, with upsert, replace) one object. Returns 'ok' or 'exists'. */
async function put(path, value, { upsert = false } = {}) {
  await ensureBucket();
  const { bucket } = settings();
  const res = await call('POST', `/object/${encodeURIComponent(bucket)}/${enc(path)}`, {
    headers: { 'Content-Type': 'application/json', 'x-upsert': upsert ? 'true' : 'false', 'cache-control': 'no-store' },
    body: typeof value === 'string' ? value : JSON.stringify(value),
  });
  if (res.ok) {
    noteOk();
    return 'ok';
  }
  const e = await errorOf(res);
  if (!upsert && isDuplicate(e)) return 'exists';
  noteError('upload');
  throw new StoreError('upload');
}

/** Read one JSON object, or null when it is not there. */
async function get(path) {
  await ensureBucket();
  const { bucket } = settings();
  const nonce = `?cacheNonce=${crypto.randomBytes(9).toString('hex')}`; // defeat Supabase's CDN cache (as WV Roofing)
  const res = await call('GET', `/object/authenticated/${encodeURIComponent(bucket)}/${enc(path)}${nonce}`);
  if (res.ok) {
    noteOk();
    try {
      return JSON.parse(await res.text());
    } catch {
      return null;
    }
  }
  const e = await errorOf(res);
  if (isNotFound(e)) return null;
  noteError('download');
  throw new StoreError('download');
}

/** Names directly inside one folder (objects and sub-folders), up to `limit`. */
async function list(folder, limit = 100, search = '') {
  await ensureBucket();
  const { bucket } = settings();
  const res = await call('POST', `/object/list/${encodeURIComponent(bucket)}`, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: folder, limit, offset: 0, search, sortBy: { column: 'name', order: 'asc' } }),
  });
  if (!res.ok) {
    noteError('list');
    throw new StoreError('list');
  }
  const page = await res.json().catch(() => []);
  noteOk();
  return (Array.isArray(page) ? page : []).filter((i) => i && typeof i.name === 'string' && i.name).map((i) => i.name);
}

async function remove(paths) {
  if (!paths.length) return;
  await ensureBucket();
  const { bucket } = settings();
  const res = await call('DELETE', `/object/${encodeURIComponent(bucket)}`, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: paths.slice(0, 500) }),
  });
  if (!res.ok && !isNotFound(await errorOf(res))) {
    noteError('delete');
    throw new StoreError('delete');
  }
}

/** A one-way, keyed hash for object names (so no key, IP hash or attempt id appears in a path as-is). */
function hashName(text) {
  const { key } = settings();
  return crypto.createHmac('sha256', `mtcw-store|${key}`).update(String(text)).digest('hex').slice(0, 40);
}

/** Health summary for this instance: no secrets, no URLs. */
function healthStatus() {
  if (!configured()) return 'not-configured';
  if (!enabled()) return 'off-in-sink-mode';
  if (status.lastErrorAt && (!status.lastOkAt || status.lastErrorAt > status.lastOkAt)) return 'degraded';
  return 'ok';
}

module.exports = { enabled, configured, put, get, list, remove, hashName, healthStatus, setFetch, StoreError, settings };
