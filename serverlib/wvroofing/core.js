// WV Roofing (concept site) — shared server helpers (the catalogue's looks,
// allowed origins, JSON errors, request bodies, image sniffers, text helpers).
// The manufacturers' products and their specifications are in catalogue.js.
// CORS is applied by router.js; the render settings, prompt and OpenAI adapter
// live in openai.js.
//
// Deliberately self-contained: it does not import any other project's helpers,
// so the WV Roofing code can be lifted into its own project unchanged.
// Uses Node built-ins only.
"use strict";

const CATALOGUE = require("../../public/WVROOFING/data/catalogue.json");

/**
 * @typedef {import("http").IncomingMessage & { body?: unknown }} Req
 * @typedef {import("http").ServerResponse} Res
 * @typedef {{ id: string, name: string, colourName: string, hex: string[], prompt: Record<string, any>, [k: string]: any }} Visual
 */

/** The eight looks (swatches, previews, render prompts); they never produce quantities. @type {Map<string, Visual>} */
const VISUALS = new Map((CATALOGUE.visuals || []).map((/** @type {Visual} */ v) => [v.id, v]));

// ---------------------------------------------------------------------------
// HTTP helpers

const DEFAULT_ORIGINS = [
  "https://scdesignwirral.co.uk",
  "https://www.scdesignwirral.co.uk",
  "https://scdesign-wirral.vercel.app",
  "http://localhost:8772",
  "http://127.0.0.1:8772",
];

function allowedOrigins() {
  const extra = String(process.env.WVR_EXTRA_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return DEFAULT_ORIGINS.concat(extra);
}

/**
 * @param {Res} res
 * @param {number} status
 * @param {unknown} obj
 * @param {Record<string, string>} [headers]
 */
function json(res, status, obj, headers) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (headers) for (const k of Object.keys(headers)) res.setHeader(k, headers[k]);
  res.end(JSON.stringify(obj));
}

class HttpError extends Error {
  /**
   * @param {number} status   HTTP status to answer with
   * @param {string} code     machine-readable error code, e.g. "invalid_image"
   * @param {string} [message] plain-English message for the customer
   * @param {Record<string, any>} [extra] extra JSON fields (retryAfter becomes a Retry-After header)
   */
  constructor(status, code, message, extra) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.extra = extra || {};
  }
}

/**
 * Read a JSON body with a hard size cap (works with and without Vercel's parser).
 * @param {Req} req
 * @param {number} maxBytes
 * @returns {Promise<Record<string, any>>}
 */
async function readJson(req, maxBytes) {
  const len = Number(req.headers["content-length"] || 0);
  if (len && len > maxBytes) throw new HttpError(413, "too_large", "The request is too large.");
  /** @type {any} */
  let body = req.body;
  if (body === undefined || body === null) {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > maxBytes) throw new HttpError(413, "too_large", "The request is too large.");
      chunks.push(c);
    }
    body = Buffer.concat(chunks).toString("utf8");
  }
  if (Buffer.isBuffer(body)) body = body.toString("utf8");
  if (typeof body === "string") {
    if (body.length > maxBytes) throw new HttpError(413, "too_large", "The request is too large.");
    try {
      body = JSON.parse(body || "{}");
    } catch (err) {
      throw new HttpError(400, "invalid_json", "The request body isn't valid JSON.");
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "invalid_json", "Expected a JSON object.");
  return body;
}

/**
 * Client IP for rate limiting: the right-most value a proxy appended (not spoofable).
 * @param {Req} req
 */
function clientIp(req) {
  const h = req.headers || {};
  /** @param {string | string[]} v */
  const pick = (v) => (String(v).split(",").pop() || "").trim();
  if (h["x-real-ip"]) return pick(h["x-real-ip"]);
  if (h["x-vercel-forwarded-for"]) return pick(h["x-vercel-forwarded-for"]);
  if (h["x-forwarded-for"]) return pick(h["x-forwarded-for"]);
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

// ---------------------------------------------------------------------------
// image helpers

/**
 * Decode a base64 data URL of an allowed type, within a byte cap.
 * @param {unknown} s
 * @param {string[]} mimes
 * @param {number} maxBytes
 * @param {string} what  used in error codes/messages, e.g. "image"
 */
function parseDataUrl(s, mimes, maxBytes, what) {
  if (typeof s !== "string") throw new HttpError(400, "invalid_" + what, "Missing " + what + ".");
  const m = /^data:([a-z/+.-]+);base64,/.exec(s);
  if (!m || !mimes.includes(m[1])) throw new HttpError(400, "invalid_" + what, "The " + what + " must be a " + mimes.join(" or ") + " data URL.");
  const b64 = s.slice(m[0].length);
  if (b64.length > Math.ceil((maxBytes * 4) / 3) + 8) throw new HttpError(413, "too_large", "The " + what + " is too large.");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) throw new HttpError(400, "invalid_" + what, "The " + what + " isn't valid base64.");
  const buf = Buffer.from(b64, "base64");
  if (!buf.length || buf.length > maxBytes) throw new HttpError(413, "too_large", "The " + what + " is too large.");
  return { mime: m[1], buf };
}

/**
 * Width/height from a JPEG's SOF marker, or null.
 * @param {Buffer} buf
 * @returns {{ w: number, h: number } | null}
 */
function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xff) {
      i++;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xda || len < 2) return null;
    i += 2 + len;
  }
  return null;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** PNG chunk CRC. @param {Buffer} buf */
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// text helpers for email

/**
 * Strip control characters, trim and cap the length.
 * @param {unknown} v
 * @param {number} max
 */
function clean(v, max) {
  return String(v == null ? "" : v)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

/**
 * @param {unknown} v
 * @param {number} max
 */
function oneLine(v, max) {
  return clean(v, max).replace(/[\r\n]+/g, " ");
}

/** HTML-escape. @param {unknown} v */
function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = {
  CATALOGUE,
  VISUALS,
  allowedOrigins,
  json,
  HttpError,
  readJson,
  clientIp,
  parseDataUrl,
  jpegSize,
  crc32,
  clean,
  oneLine,
  esc,
};
