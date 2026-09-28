// WV Roofing (concept site) — shared server helpers (config, CORS/origins, JSON
// errors, image sniffers, prompt builder, OpenAI adapter, mock renders).
//
// Deliberately self-contained: it does not import any other project's helpers,
// so the WV Roofing code can be lifted into its own project unchanged.
// Uses Node built-ins only (fetch, FormData, Blob, zlib, crypto).
"use strict";

const zlib = require("zlib");
const crypto = require("crypto");
const CATALOGUE = require("../../public/WVROOFING/data/catalogue.json");

/**
 * @typedef {import("http").IncomingMessage & { body?: unknown }} Req
 * @typedef {import("http").ServerResponse} Res
 * @typedef {{ id: string, name: string, colourName: string, hex: string[], prompt: Record<string, any>, [k: string]: any }} Product
 */

/** @type {Map<string, Product>} */
const PRODUCTS = new Map((CATALOGUE.products || []).map((/** @type {Product} */ p) => [p.id, p]));

// ---------------------------------------------------------------------------
// configuration

/**
 * An integer env var, clamped to [min, max], or dflt when unset/invalid.
 * @param {string} name
 * @param {number} dflt
 * @param {number} min
 * @param {number} max
 */
function envInt(name, dflt, min, max) {
  const v = Number(process.env[name]);
  if (!Number.isFinite(v)) return dflt;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function config() {
  const key = process.env.WVR_OPENAI_API_KEY || "";
  const model = (process.env.WVR_IMAGE_MODEL || "gpt-image-2").trim();
  return {
    key,
    model,
    quality: (process.env.WVR_IMAGE_QUALITY || "medium").trim(),
    compression: envInt("WVR_OUTPUT_COMPRESSION", 88, 40, 100),
    enabled: process.env.WVR_ENABLED !== "0" && process.env.WVR_ENABLED !== "false",
    autoRender: envInt("WVR_AUTO_RENDER", 8, 0, 8),
    maxConcurrent: envInt("WVR_MAX_CONCURRENT", 2, 1, 6),
    upstreamIpm: envInt("WVR_UPSTREAM_IPM", 5, 1, 500),
    ipLimit: envInt("WVR_IP_LIMIT", 12, 1, 1000),
    ipDaily: envInt("WVR_IP_DAILY", 40, 1, 10000),
    dailyCap: envInt("WVR_DAILY_CAP", 200, 1, 100000),
    timeoutMs: envInt("WVR_OPENAI_TIMEOUT_MS", 150000, 10000, 280000),
    allowMock: process.env.WVR_ALLOW_MOCK === "1",
  };
}

/**
 * gpt-image-2 / 2.5 accept any size (multiples of 16); older models use fixed sizes.
 * @param {string} model
 */
function modelProfile(model) {
  const flex = /^gpt-image-2/.test(model);
  return { flex, sendInputFidelity: /^gpt-image-1/.test(model) };
}

const FIXED_SIZES = ["1024x1024", "1536x1024", "1024x1536"];

/**
 * @param {number} W
 * @param {number} H
 * @param {boolean} flex
 */
function validSize(W, H, flex) {
  if (!Number.isInteger(W) || !Number.isInteger(H)) return false;
  if (!flex) return FIXED_SIZES.includes(W + "x" + H);
  if (W % 16 || H % 16) return false;
  const px = W * H;
  if (px < 655360 || px > 2359296) return false;
  const ar = W / H;
  return ar <= 3 && ar >= 1 / 3;
}

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

/** @param {string | undefined} origin */
function isLocalOrigin(origin) {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");
}

/**
 * CORS. Returns "preflight" (already answered), "forbidden" or "ok".
 * Disallowed origins get no CORS headers at all.
 * @param {Req} req
 * @param {Res} res
 * @returns {"preflight" | "forbidden" | "ok"}
 */
function cors(req, res) {
  const origin = req.headers.origin || "";
  const allowed = origin && allowedOrigins().includes(origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Expose-Headers", "Retry-After");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  if (req.method === "OPTIONS") {
    res.statusCode = allowed ? 204 : 403;
    res.end();
    return "preflight";
  }
  return allowed ? "ok" : "forbidden";
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

/**
 * Hashed IP (never logged raw). Used only by the pre-v02 in-memory limiters;
 * persisted keys use limits.ipHash (keyed, rotated daily).
 * @param {Req} req
 */
function ipKey(req) {
  return crypto.createHash("sha256").update("wvr:" + clientIp(req)).digest("hex").slice(0, 16);
}

/**
 * In-memory fixed-window limiter (per server instance — a soft limit by design).
 * @param {number} max
 * @param {number} windowMs
 */
function createLimiter(max, windowMs) {
  /** @type {Map<string, { start: number, count: number }>} */
  const hits = new Map();
  return {
    /** @param {string} key */
    hit(key) {
      const now = Date.now();
      let rec = hits.get(key);
      if (!rec || now - rec.start >= windowMs) {
        rec = { start: now, count: 0 };
        hits.set(key, rec);
      }
      rec.count++;
      if (hits.size > 5000) {
        for (const [k, r] of hits) if (now - r.start >= windowMs) hits.delete(k);
      }
      if (rec.count > max) return { ok: false, retryAfter: Math.ceil((rec.start + windowMs - now) / 1000) };
      return { ok: true, retryAfter: 0 };
    },
    /** @param {string} key */
    undo(key) {
      const rec = hits.get(key);
      if (rec && rec.count > 0) rec.count--;
    },
  };
}

// ---------------------------------------------------------------------------
// image validation

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

/**
 * Decode a PNG mask (8-bit RGBA or grey+alpha, non-interlaced) and measure how
 * much of it is transparent (= the area the model may edit).
 * Pre-v02 validator used by the legacy render bridge; A2 replaces it with a
 * version that checks the header dimensions before inflating anything.
 * When expectW/expectH are given, a PNG of any other size is reported without
 * being inflated, and inflation is always capped at the size the header implies.
 * @param {Buffer} buf
 * @param {number} [expectW]
 * @param {number} [expectH]
 * @returns {{ w: number, h: number, supported: boolean, transparentFrac?: number } | null}
 */
function pngAlphaInfo(buf, expectW, expectH) {
  const SIG = "89504e470d0a1a0a";
  if (buf.length < 33 || buf.subarray(0, 8).toString("hex") !== SIG) return null;
  let pos = 8;
  let w = 0;
  let h = 0;
  let depth = 0;
  let ctype = 0;
  let interlace = 0;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      ctype = data[9];
      interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (!w || !h || depth !== 8 || interlace !== 0 || (ctype !== 6 && ctype !== 4)) return { w, h, supported: false };
  // Size first: a mask of the wrong (or an absurd) size is refused without inflating anything.
  if ((expectW && w !== expectW) || (expectH && h !== expectH)) return { w, h, supported: true, transparentFrac: NaN };
  if (w * h > 4096 * 4096) return { w, h, supported: false };
  const bpp = ctype === 6 ? 4 : 2;
  let raw;
  try {
    raw = zlib.inflateSync(Buffer.concat(idat), { maxOutputLength: h * (w * bpp + 1) });
  } catch (err) {
    return { w, h, supported: false };
  }
  const stride = w * bpp;
  if (raw.length < h * (stride + 1)) return { w, h, supported: false };
  let prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  let transparent = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 255;
    }
    for (let x = bpp - 1; x < stride; x += bpp) if (cur[x] === 0) transparent++;
    prev = Buffer.from(cur);
  }
  return { w, h, supported: true, transparentFrac: transparent / (w * h) };
}

// ---------------------------------------------------------------------------
// prompt

/** @param {Product} p */
function buildPrompt(p) {
  const q = p.prompt || {};
  return [
    "Edit this photograph of a house. Re-roof it: replace ONLY the existing roof covering inside the transparent area of the mask with " +
      p.name +
      ": " +
      q.material +
      "; " +
      q.profile +
      "; colour " +
      q.colourWords +
      " (around " +
      p.hex[0] +
      " to " +
      p.hex[1] +
      "); " +
      q.finish +
      ".",
    "Lay it " + q.bond + ", in straight courses parallel to the eaves, roughly " + q.courses + " courses from eaves to ridge on a roof this size, with " + q.ridge + " on the ridges and hips. " + (q.extra || ""),
    "Geometry: keep the roof's exact outline, pitch, ridge line, hips, valleys, verges and eaves. The courses follow each roof plane in true perspective, narrowing slightly towards the ridge and converging to the house's own vanishing points.",
    "Light: match the original photo exactly - sun direction, shadow shapes and positions (including shadows cast on the roof by chimneys, dormers and trees), exposure, white balance, haze, sharpness, grain and lens.",
    "Keep unchanged and in place: chimneys and pots, lead flashings, roof windows, vents, solar panels, aerials, satellite dishes, gutters, fascias, soffits, bargeboards, dormer cheeks, walls, windows, doors, gardens, vehicles, people, neighbouring buildings, trees and sky.",
    "Do not add or remove anything, do not restyle the house, no text or watermark, no moss or debris on the new roof. It must look like an unedited photograph of the same house at the same moment, newly re-roofed.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// OpenAI adapter

/** @param {Headers} headers */
function retryAfterSeconds(headers) {
  const ms = Number(headers.get("retry-after-ms"));
  if (Number.isFinite(ms) && ms > 0) return Math.ceil(ms / 1000);
  const s = Number(headers.get("retry-after"));
  if (Number.isFinite(s) && s > 0) return Math.ceil(s);
  return 20;
}

/**
 * One call to OpenAI's image edits endpoint.
 * @param {{ key: string, model: string, prompt: string, image: Buffer, mask: Buffer, W: number, H: number, quality?: string, compression: number, timeoutMs: number }} opts
 * @returns {Promise<{ b64: string, usage: any }>}
 */
async function openaiEdit(opts) {
  const form = new FormData();
  form.append("model", opts.model);
  form.append("prompt", opts.prompt);
  // Node Buffers are valid Blob parts; the cast only satisfies TypeScript's DOM typing.
  form.append("image", new Blob([/** @type {BlobPart} */ (/** @type {unknown} */ (opts.image))], { type: "image/jpeg" }), "photo.jpg");
  form.append("mask", new Blob([/** @type {BlobPart} */ (/** @type {unknown} */ (opts.mask))], { type: "image/png" }), "mask.png");
  form.append("size", opts.W + "x" + opts.H);
  form.append("n", "1");
  if (opts.quality) form.append("quality", opts.quality);
  form.append("output_format", "jpeg");
  form.append("output_compression", String(opts.compression));
  if (modelProfile(opts.model).sendInputFidelity) form.append("input_fidelity", "high");

  let res;
  try {
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: "Bearer " + opts.key },
      body: form,
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") throw new HttpError(504, "timeout", "The render took too long.");
    throw new HttpError(502, "upstream", "The render service couldn't be reached.");
  }
  /** @type {any} */
  let body = {};
  try {
    body = await res.json();
  } catch (err) {
    body = {};
  }
  if (res.ok) {
    const b64 = body && body.data && body.data[0] && body.data[0].b64_json;
    if (!b64) throw new HttpError(502, "upstream", "The render service returned no image.");
    return { b64, usage: body.usage || null };
  }
  const e = (body && body.error) || {};
  const code = String(e.code || e.type || "");
  const msg = String(e.message || "");
  if (res.status === 401 || res.status === 403) throw new HttpError(503, "not_configured", "Photo-real rendering isn't available right now.");
  if (res.status === 404) throw new HttpError(503, "not_configured", "The configured image model isn't available.");
  if (res.status === 429) {
    if (/insufficient_quota|billing|spend|budget/i.test(code + " " + msg)) {
      throw new HttpError(503, "budget", "Photo-real renders have reached their limit for now.");
    }
    throw new HttpError(429, "rate_limited", "The render service is busy.", { scope: "upstream", retryAfter: retryAfterSeconds(res.headers) });
  }
  if (res.status === 400 && /moderation|safety|content_policy|rejected/i.test(code + " " + msg)) {
    throw new HttpError(422, "refused", "The render service couldn't process this photo. Please try a different photo.");
  }
  console.warn("[wvroofing] openai error", res.status, code, msg.slice(0, 300));
  if (res.status >= 500) throw new HttpError(502, "upstream", "The render service had a problem. Please try again.");
  throw new HttpError(502, "upstream", "The render request wasn't accepted.");
}

/**
 * @param {string} key
 * @param {string} model
 */
async function checkModel(key, model) {
  try {
    const r = await fetch("https://api.openai.com/v1/models/" + encodeURIComponent(model), {
      headers: { Authorization: "Bearer " + key },
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch (err) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// mock image (local testing without a key): a flat product-coloured tile pattern

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** @param {Buffer} buf */
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * @param {string} type
 * @param {Buffer} data
 */
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/**
 * @param {number} W
 * @param {number} H
 * @param {string} hex
 */
function mockPng(W, H, hex) {
  const n = parseInt(String(hex || "#777777").replace("#", ""), 16) || 0x777777;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const course = Math.max(8, Math.round(H / 40));
  const raw = Buffer.alloc(H * (W * 3 + 1));
  for (let y = 0; y < H; y++) {
    const row = y * (W * 3 + 1);
    raw[row] = 0;
    const dark = y % course < 2 ? 0.7 : 1;
    const off = Math.floor(y / course) % 2 ? course : 0;
    for (let x = 0; x < W; x++) {
      const joint = (x + off) % (course * 2) < 2 ? 0.8 : 1;
      const k = dark * joint;
      const i = row + 1 + x * 3;
      raw[i] = Math.round(r * k);
      raw[i + 1] = Math.round(g * k);
      raw[i + 2] = Math.round(b * k);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
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
  PRODUCTS,
  config,
  modelProfile,
  validSize,
  allowedOrigins,
  cors,
  isLocalOrigin,
  json,
  HttpError,
  readJson,
  clientIp,
  ipKey,
  createLimiter,
  parseDataUrl,
  jpegSize,
  pngAlphaInfo,
  buildPrompt,
  openaiEdit,
  checkModel,
  mockPng,
  crc32,
  clean,
  oneLine,
  esc,
};
