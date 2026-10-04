'use strict';

// HTTP plumbing for api/mtcw.js using ONLY Node's own req/res API (req.url, req.method, req.headers, the request
// stream; res.statusCode, res.setHeader, res.end), so it behaves the same in the local harness and on Vercel.
//
// Body reading: the stream is read here with the size cap enforced chunk by chunk. Over the cap (by Content-Length
// or while streaming) nothing more is kept; the rest of the upload is drained (bounded: 8 MB / 15 s, then
// Connection: close) and 413 is answered, so a browser reads the 413 instead of a connection reset.
// Defensive fallback: if a platform has ALREADY consumed the stream before the handler runs (Vercel's Node "helpers"
// buffer the body and expose a lazy req.body), the stream is empty and ended, so the platform's buffered body is used
// instead, with the cap enforced on Content-Length and on the re-measured size. SC's own functions rely on req.body
// for the same reason (serverlib/common.js readJsonBody). Whether Vercel pre-buffers is not verified here; both paths
// are tested.

const { schema } = require('./schema');

const ALLOWED_ORIGINS = schema.origins.allowed;
const DRAIN_MAX_BYTES = 8 * 1024 * 1024;
const DRAIN_MAX_MS = 15000;
const LOCAL_ORIGIN = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/;

/** Exact allowlist match; localhost origins only in sink mode. 'null' and missing are never allowed. */
function isAllowedOrigin(origin, sinkMode) {
  if (typeof origin !== 'string' || origin === '' || origin === 'null') return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return !!sinkMode && LOCAL_ORIGIN.test(origin);
}

/** Headers every response carries. `allowedOrigin` is the request's origin when it is allowed, else null. */
function baseHeaders(res, allowedOrigin) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Vary', 'Origin');
  if (allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
}

function sendJson(res, status, body, allowedOrigin, extraHeaders) {
  if (res.headersSent) return;
  res.statusCode = status;
  baseHeaders(res, allowedOrigin);
  for (const [name, value] of Object.entries(extraHeaders || {})) res.setHeader(name, value);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

function sendHtml(res, status, html, allowedOrigin, extraHeaders) {
  if (res.headersSent) return;
  res.statusCode = status;
  baseHeaders(res, allowedOrigin);
  for (const [name, value] of Object.entries(extraHeaders || {})) res.setHeader(name, value);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', PAGE_CSP);
  res.end(html);
}

function sendEmpty(res, status, allowedOrigin, extraHeaders) {
  if (res.headersSent) return;
  res.statusCode = status;
  baseHeaders(res, allowedOrigin);
  for (const [name, value] of Object.entries(extraHeaders || {})) res.setHeader(name, value);
  res.end();
}

/**
 * Classify the Content-Type: 'json' (application/json, charset utf-8 or none), 'form'
 * (application/x-www-form-urlencoded, charset utf-8 or none) or 'other' (everything else, incl. multipart).
 */
function contentKind(header) {
  if (typeof header !== 'string') return 'other';
  const [type, ...params] = header.split(';').map((p) => p.trim().toLowerCase());
  for (const param of params) {
    if (param === '') continue;
    const [name, rawValue = ''] = param.split('=').map((s) => s.trim());
    const value = rawValue.replace(/^"(.*)"$/, '$1');
    if (name !== 'charset' || (value !== 'utf-8' && value !== 'utf8')) return 'other';
  }
  if (type === 'application/json') return 'json';
  if (type === 'application/x-www-form-urlencoded') return 'form';
  return 'other';
}

/** Let the rest of an over-cap body drain without keeping it (the response says Connection: close). */
function discard(req) {
  try {
    req.removeAllListeners('data');
    req.resume();
  } catch {
    /* nothing to do */
  }
}

/**
 * Read the request body with a byte cap. Resolves one of:
 *   { raw: Buffer }               the bytes as sent
 *   { parsed: object|string }     the platform had already consumed the stream and parsed it (see the header note)
 *   { error: 'too_large' | 'bad_request', close?: true }   (close: answer with Connection: close)
 */
function readBody(req, cap) {
  const declared = req.headers['content-length'];
  let overDeclared = false;
  if (declared !== undefined) {
    const n = Number(declared);
    if (!Number.isInteger(n) || n < 0) return Promise.resolve({ error: 'bad_request' });
    overDeclared = n > cap;
  }
  // Already consumed before the handler ran (a platform buffered it): use the platform's copy.
  if (req.readableEnded) return Promise.resolve(overDeclared ? { error: 'too_large' } : platformBody(req, cap));

  // Over the cap (declared, or found while streaming): stop KEEPING bytes at once, but let the rest of the upload
  // arrive and be thrown away before answering 413, so the client reads the 413 instead of a connection reset. The
  // drain is bounded; past DRAIN_MAX_BYTES / DRAIN_MAX_MS the answer carries Connection: close (close: true).
  return new Promise((resolve) => {
    const chunks = [];
    let total = 0;
    let over = overDeclared;
    let done = false;
    let timer = null;
    const finish = (result) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      if (result.close) discard(req);
      resolve(result);
    };
    const startDrain = () => {
      over = true;
      chunks.length = 0;
      timer = setTimeout(() => finish({ error: 'too_large', close: true }), DRAIN_MAX_MS);
    };
    function onData(chunk) {
      total += chunk.length;
      if (over) {
        if (total > cap + DRAIN_MAX_BYTES) finish({ error: 'too_large', close: true });
        return;
      }
      if (total > cap) {
        startDrain();
        return;
      }
      chunks.push(chunk);
    }
    function onEnd() {
      finish(over ? { error: 'too_large' } : { raw: Buffer.concat(chunks, total) });
    }
    function onError() {
      finish({ error: 'bad_request', close: true });
    }
    if (overDeclared) startDrain();
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

/** The platform's buffered body (Vercel helpers), with the cap re-checked. */
function platformBody(req, cap) {
  let value;
  try {
    value = req.body; // Vercel's lazy getter throws on invalid JSON
  } catch {
    return { error: 'bad_request' };
  }
  if (value === undefined || value === null) return { raw: Buffer.alloc(0) };
  if (Buffer.isBuffer(value)) return value.length > cap ? { error: 'too_large' } : { raw: value };
  if (typeof value === 'string') {
    const raw = Buffer.from(value, 'utf8');
    return raw.length > cap ? { error: 'too_large' } : { raw };
  }
  if (typeof value === 'object') {
    let size = 0;
    try {
      size = Buffer.byteLength(JSON.stringify(value), 'utf8');
    } catch {
      return { error: 'bad_request' };
    }
    return size > cap ? { error: 'too_large' } : { parsed: value };
  }
  return { error: 'bad_request' };
}

/** Parse a JSON body into a plain object, or null. */
function parseJsonBody(body) {
  let value = body.parsed;
  if (body.raw) {
    try {
      value = JSON.parse(body.raw.toString('utf8'));
    } catch {
      return null;
    }
  }
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

/**
 * Parse an urlencoded body into ordered [name, value] pairs (UTF-8; '+' is a space). A platform-parsed object
 * (querystring.parse: string or string[] values) is turned back into pairs.
 */
function parseFormBody(body) {
  if (body.raw) return [...new URLSearchParams(body.raw.toString('utf8')).entries()];
  const value = body.parsed;
  if (value === null || typeof value !== 'object') return null;
  const pairs = [];
  for (const [name, v] of Object.entries(value)) {
    if (Array.isArray(v)) for (const item of v) pairs.push([name, String(item)]);
    else pairs.push([name, String(v)]);
  }
  return pairs;
}

/** First X-Forwarded-For entry (Vercel sets it), else the socket address. Used only for an HMAC key, never stored. */
function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim() !== '') return xff.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = {
  PAGE_CSP,
  isAllowedOrigin,
  sendJson,
  sendHtml,
  sendEmpty,
  contentKind,
  readBody,
  parseJsonBody,
  parseFormBody,
  clientIp,
};
