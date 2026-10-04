'use strict';

// References (MTCW-YYMMDD-XXXX) and the signed file token (FORMS-CONTRACT section 5).
//
// token = base64url(payloadJSON) + "." + base64url(HMAC-SHA256(key, firstPart))
// payload = {"v":1,"r":ref,"n":expectedFiles,"e":expiry unix seconds,"b":business label,"f":[descriptor,...]}
// descriptor_i = base64url(first 12 bytes of SHA-256("<index>\n<sanitised name>\n<type>\n<size>\n<role>"))
//
// Key: MTCW_FORM_SECRET (>= 32 characters) when set; else HMAC-SHA256(key = SMTP_PASS, "mtcw-file-token/v1"), a
// derived sub-key that never exposes SMTP_PASS; in sink mode with neither, a random per-process key. Otherwise there
// is no key: health reports it and file sends are refused (mail_unavailable). Keys are never logged or returned.

const crypto = require('node:crypto');
const { schema } = require('./schema');
const { state } = require('./state');

const REFERENCE_ALPHABET = schema.reference.alphabet;
const REFERENCE_PATTERN = new RegExp(schema.reference.pattern);
const TOKEN_TTL_SECONDS = schema.limits.fileToken.ttlSeconds;
const FORM_SECRET_MIN_LENGTH = 32;

function b64url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function fromB64url(text) {
  if (typeof text !== 'string' || text === '' || !/^[A-Za-z0-9_-]+$/.test(text)) return null;
  return Buffer.from(text, 'base64url');
}

function isSinkMode() {
  return process.env.MTCW_MAIL_MODE === 'sink';
}

/** The file-token key and where it came from (never the value in any output). */
function tokenKey() {
  const secret = process.env.MTCW_FORM_SECRET;
  if (typeof secret === 'string' && secret.length >= FORM_SECRET_MIN_LENGTH) {
    return { key: Buffer.from(secret, 'utf8'), source: 'form-secret' };
  }
  const pass = process.env.SMTP_PASS;
  if (typeof pass === 'string' && pass !== '') {
    return { key: crypto.createHmac('sha256', pass).update('mtcw-file-token/v1').digest(), source: 'derived' };
  }
  if (isSinkMode()) {
    const s = state();
    if (!s.devTokenKey) s.devTokenKey = crypto.randomBytes(32);
    return { key: s.devTokenKey, source: 'dev-random' };
  }
  return { key: null, source: null };
}

/** Key for hashing client IPs in the rate limiter: a sub-key of the token key, else random per process. */
function ipHashKey() {
  const { key } = tokenKey();
  if (key) return crypto.createHmac('sha256', key).update('mtcw-ip-hash/v1').digest();
  const s = state();
  if (!s.ipKey) s.ipKey = crypto.randomBytes(32);
  return s.ipKey;
}

function hashClient(ip) {
  return crypto.createHmac('sha256', ipHashKey()).update(String(ip || 'unknown')).digest('hex').slice(0, 32);
}

/** MTCW-YYMMDD-XXXX: UTC date + 4 crypto-random characters from the schema alphabet. */
function makeReference(date) {
  const yy = String(date.getUTCFullYear() % 100).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  let suffix = '';
  for (let i = 0; i < 4; i += 1) suffix += REFERENCE_ALPHABET[crypto.randomInt(REFERENCE_ALPHABET.length)];
  return `MTCW-${yy}${mm}${dd}-${suffix}`;
}

function isReference(value) {
  return typeof value === 'string' && REFERENCE_PATTERN.test(value);
}

/** The token-bound descriptor of one file. */
function fileDescriptor(file) {
  const text = `${file.index}\n${file.name}\n${file.type}\n${file.size}\n${file.role}`;
  return b64url(crypto.createHash('sha256').update(text, 'utf8').digest().subarray(0, 12));
}

function mac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

/**
 * Sign a token. `nowMs` defaults to Date.now(). Throws when no key exists (callers check tokenKey() first).
 * Returns { token, expiresAt: Date }.
 */
function signFileToken({ ref, expectedFiles, businessLabel, descriptors, nowMs }, keyOverride) {
  const key = keyOverride || tokenKey().key;
  if (!key) throw new Error('mtcw token: no key');
  const now = nowMs === undefined ? Date.now() : nowMs;
  const e = Math.floor(now / 1000) + TOKEN_TTL_SECONDS;
  const payload = { v: 1, r: ref, n: expectedFiles, e, b: businessLabel, f: descriptors };
  const first = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  return { token: `${first}.${b64url(mac(key, first))}`, expiresAt: new Date(e * 1000) };
}

/**
 * Verify a token for a file post: MAC (constant-time), expiry, reference and file count.
 * Returns { ok: true, payload } or { ok: false, reason }.
 */
function verifyFileToken(token, { ref, total, nowMs }, keyOverride) {
  const key = keyOverride || tokenKey().key;
  if (!key) return { ok: false, reason: 'no-key' };
  if (typeof token !== 'string' || token.length > 4096) return { ok: false, reason: 'malformed' };
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [first, sig] = parts;
  const given = fromB64url(sig);
  if (!given || fromB64url(first) === null) return { ok: false, reason: 'malformed' };
  const expected = mac(key, first);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return { ok: false, reason: 'mac' };
  let payload;
  try {
    payload = JSON.parse(fromB64url(first).toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (
    !payload ||
    payload.v !== 1 ||
    !isReference(payload.r) ||
    !Number.isInteger(payload.n) ||
    !Number.isInteger(payload.e) ||
    typeof payload.b !== 'string' ||
    !Array.isArray(payload.f) ||
    payload.f.length !== payload.n ||
    !payload.f.every((d) => typeof d === 'string')
  ) {
    return { ok: false, reason: 'malformed' };
  }
  const now = nowMs === undefined ? Date.now() : nowMs;
  if (payload.e * 1000 <= now) return { ok: false, reason: 'expired' };
  if (payload.r !== ref) return { ok: false, reason: 'ref' };
  if (payload.n !== total) return { ok: false, reason: 'count' };
  return { ok: true, payload };
}

/** Constant-time string comparison (descriptors). */
function sameString(a, b) {
  const x = Buffer.from(String(a), 'utf8');
  const y = Buffer.from(String(b), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = {
  TOKEN_TTL_SECONDS,
  tokenKey,
  hashClient,
  makeReference,
  isReference,
  fileDescriptor,
  signFileToken,
  verifyFileToken,
  sameString,
};
