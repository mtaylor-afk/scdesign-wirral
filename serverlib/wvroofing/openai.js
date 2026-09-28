// WV Roofing — OpenAI image editing (A3; brief §11, plan D8).
//
// - Settings are server-side and per model: the model, an explicit quality (the
//   API's own default is "auto", which is never relied on) and a size the model
//   accepts. input_fidelity is sent only to the gpt-image-1 family: gpt-image-2
//   ignores it (fidelity is automatic) and it is undocumented for 2.5.
// - The photo is sent as a PNG, the same format as the mask, as OpenAI's guide
//   asks ("must be of the same format and size").
// - Every answer is classified. A timeout or a dropped connection is "uncertain":
//   the render may have been made and charged, so it is never repeated
//   automatically. Only an explicit server error (5xx) is retried, once.
// - The labelled test environment (WVR_ENV=test) uses a fixture instead of
//   OpenAI: it paints the product's colour into the masked area of the photo it
//   was sent. Production never loads it.
"use strict";

const { isTest } = require("./capabilities.js");

const ENDPOINT = "https://api.openai.com/v1/images/edits";
const PROMPT_VERSION = "2026-09-28.v2";

/**
 * @typedef {Record<string, string | undefined>} Env
 * @typedef {{ id: string, name: string, hex: string[], prompt: Record<string, any>, [k: string]: any }} Product
 * @typedef {"timeout" | "network" | "upstream_5xx" | "rate_limited" | "budget" | "not_configured" | "refused" | "bad_request" | "bad_response"} FailureKind
 * @typedef {{ key: string, model: string, quality: string, prompt: string, image: Buffer, mask: Buffer, W: number, H: number, compression: number, timeoutMs: number, product?: Product }} EditRequest
 * @typedef {{ jpeg: Buffer, usage: Record<string, any> | null, requestId: string | null, httpStatus: number }} EditResult
 */

class RenderError extends Error {
  /**
   * @param {FailureKind} kind
   * @param {string} message
   * @param {{ httpStatus?: number, retryAfter?: number, requestId?: string | null }} [extra]
   */
  constructor(kind, message, extra) {
    super(message);
    this.kind = kind;
    this.httpStatus = (extra && extra.httpStatus) || 0;
    this.retryAfter = (extra && extra.retryAfter) || 0;
    this.requestId = (extra && extra.requestId) || null;
  }
}

// ---------------------------------------------------------------------------
// configuration

/**
 * @param {Env} env
 * @param {string} name
 * @param {number} dflt
 * @param {number} min
 * @param {number} max
 */
function envNum(env, name, dflt, min, max) {
  const raw = env[name];
  const v = raw === undefined || raw === "" ? NaN : Number(raw);
  if (!Number.isFinite(v)) return dflt;
  return Math.max(min, Math.min(max, v));
}

/** @param {Env} env @param {string} name @param {number} dflt @param {number} min @param {number} max */
function envInt(env, name, dflt, min, max) {
  return Math.round(envNum(env, name, dflt, min, max));
}

/**
 * Render settings (Vercel -> Settings -> Environment Variables).
 * @param {Env} [env]
 */
function renderConfig(env) {
  const e = env || process.env;
  return {
    key: e.WVR_OPENAI_API_KEY || "",
    model: (e.WVR_IMAGE_MODEL || "gpt-image-2.5-sunburst").trim(),
    quality: (e.WVR_IMAGE_QUALITY || "high").trim(),
    compression: envInt(e, "WVR_OUTPUT_COMPRESSION", 90, 40, 100),
    timeoutMs: envInt(e, "WVR_OPENAI_TIMEOUT_MS", 240000, 30000, 270000),
    /** finishes rendered automatically once the customer has agreed (0 = only on tap) */
    autoRender: envInt(e, "WVR_AUTO_RENDER", 1, 0, 8),
    /** queued + running renders allowed per project */
    maxPending: envInt(e, "WVR_MAX_CONCURRENT", 3, 1, 8),
    /** OpenAI calls per minute across every instance (Tier 1 allows 5 images a minute) */
    upstreamIpm: envInt(e, "WVR_UPSTREAM_IPM", 5, 1, 500),
    ipDaily: envInt(e, "WVR_IP_DAILY", 40, 1, 10000),
    projectDaily: envInt(e, "WVR_RENDERS_PER_PROJECT_DAILY", 12, 1, 1000),
    dailyCap: envInt(e, "WVR_DAILY_CAP", 200, 1, 100000),
    budgetUsd: envNum(e, "WVR_DAILY_BUDGET_USD", 5, 0, 10000),
    /**
     * composites whose seam error (mean luma difference in a band round the roof) is above
     * this are rejected as misaligned. Uncalibrated until the A8 benchmark: set well above
     * the lightbox's 18 "edges may not line up" warning, because a real render redraws fine
     * texture round the roof even when it lines up.
     */
    maxSeam: envNum(e, "WVR_MAX_SEAM", 50, 1, 255),
  };
}

// ---------------------------------------------------------------------------
// per-model rules (OpenAI image edit reference, checked 27-28 Sep 2026)

const FIXED_SIZES = ["1024x1024", "1536x1024", "1024x1536"];
const FLEX_MIN_PX = 655360;
const FLEX_MAX_PX = 8294400;

/**
 * What a model accepts. Unknown models are refused rather than guessed at.
 * @param {string} model
 */
function profile(model) {
  if (/^gpt-image-2\.5(-|$)/.test(model)) {
    return { known: true, family: "gpt-image-2.5", flex: true, qualities: ["low", "medium", "high", "xhigh", "max"], sendInputFidelity: false };
  }
  if (/^gpt-image-2(-|$)/.test(model)) {
    return { known: true, family: "gpt-image-2", flex: true, qualities: ["low", "medium", "high"], sendInputFidelity: false };
  }
  if (/^gpt-image-1(\.5)?(-|$)/.test(model)) {
    return { known: true, family: "gpt-image-1", flex: false, qualities: ["low", "medium", "high"], sendInputFidelity: !/mini/.test(model) };
  }
  return { known: false, family: "unknown", flex: false, qualities: [], sendInputFidelity: false };
}

/**
 * Throws a RenderError("not_configured") when the settings don't suit the model.
 * @param {{ model: string, quality: string, W: number, H: number }} p
 */
function validateParams(p) {
  const prof = profile(p.model);
  const bad = (/** @type {string} */ why) => new RenderError("not_configured", "Render settings rejected: " + why);
  if (!prof.known) throw bad("unsupported model " + p.model);
  if (!prof.qualities.includes(p.quality)) throw bad("quality " + p.quality + " isn't available for " + p.model);
  if (!Number.isInteger(p.W) || !Number.isInteger(p.H) || p.W < 1 || p.H < 1) throw bad("size");
  if (!prof.flex) {
    if (!FIXED_SIZES.includes(p.W + "x" + p.H)) throw bad("size " + p.W + "x" + p.H + " isn't one of " + FIXED_SIZES.join(", "));
    return true;
  }
  if (p.W % 16 || p.H % 16) throw bad("width and height must be multiples of 16");
  const px = p.W * p.H;
  if (px < FLEX_MIN_PX || px > FLEX_MAX_PX) throw bad("size must be " + FLEX_MIN_PX + "-" + FLEX_MAX_PX + " pixels");
  const ar = p.W / p.H;
  if (ar > 3 || ar < 1 / 3) throw bad("aspect ratio must be between 1:3 and 3:1");
  return true;
}

// ---------------------------------------------------------------------------
// cost

// Output cost in USD at 1536x1024 (1.57 MP) by quality. gpt-image-2: OpenAI's
// published table. gpt-image-2.5: the image-generation guide's cost calculator.
// gpt-image-1: the legacy table. Checked 27 Sep 2026; reconciled against the
// OpenAI dashboard in A8. Used only to RESERVE budget (deliberately generous);
// spending is settled from the usage OpenAI reports.
/** @type {Record<string, Record<string, number>>} */
const OUTPUT_USD_1536 = {
  "gpt-image-2.5": { medium: 0.01, high: 0.041, xhigh: 0.074 },
  "gpt-image-2": { medium: 0.041, high: 0.165 },
  "gpt-image-1": { low: 0.016, medium: 0.063, high: 0.25 },
};
const INPUT_ALLOWANCE_USD = 0.06; // photo + mask + prompt tokens: undocumented for 2.x, so generous

/**
 * Upper-bound estimate for one render, reserved before the call.
 * @param {string} model
 * @param {string} quality
 * @param {number} W
 * @param {number} H
 */
function estimateCost(model, quality, W, H) {
  const table = OUTPUT_USD_1536[profile(model).family];
  if (!table) return 0.5;
  const top = Math.max(...Object.values(table));
  const out = table[quality] !== undefined ? table[quality] : top * 2;
  const usd = (out * (W * H)) / (1536 * 1024) + INPUT_ALLOWANCE_USD;
  return Math.max(0.02, Math.ceil(usd * 1.25 * 1000) / 1000);
}

// USD per million tokens (OpenAI pricing page, 27 Sep 2026). The 2.5 models are
// assumed to share gpt-image-2's per-token prices until A8 checks the dashboard.
/** @type {Record<string, { text: number, imageIn: number, imageOut: number }>} */
const TOKEN_PRICES = {
  "gpt-image-2.5": { text: 5, imageIn: 8, imageOut: 30 },
  "gpt-image-2": { text: 5, imageIn: 8, imageOut: 30 },
  "gpt-image-1": { text: 5, imageIn: 10, imageOut: 40 },
};

/**
 * Cost from the usage block OpenAI returns, or null when it can't be worked out.
 * @param {string} model
 * @param {Record<string, any> | null | undefined} usage
 */
function costFromUsage(model, usage) {
  const price = TOKEN_PRICES[profile(model).family];
  if (!price || !usage || !Number.isFinite(Number(usage.output_tokens))) return null;
  const det = usage.input_tokens_details || {};
  const input = Number(usage.input_tokens) || 0;
  const imageIn = Number.isFinite(Number(det.image_tokens)) ? Number(det.image_tokens) : input;
  const textIn = Number.isFinite(Number(det.text_tokens)) ? Number(det.text_tokens) : Math.max(0, input - imageIn);
  const usd = (textIn * price.text + imageIn * price.imageIn + Number(usage.output_tokens) * price.imageOut) / 1e6;
  return Math.round(usd * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// prompt (versioned; the customer never writes any of it)

/** @param {Product} p */
function buildPrompt(p) {
  const q = p.prompt || {};
  return [
    // The v02 brief's editing instruction (§10), verbatim.
    "Edit the supplied original house photograph. Replace only the selected visible roof covering with the chosen material and finish. " +
      "Preserve the existing roof silhouette, slopes, ridges, eaves, architecture, fixtures, camera position, lighting and surroundings. " +
      "Do not add or remove structural features. Produce a realistic appearance preview, not a survey drawing.",
    "The selected roof covering is the transparent area of the mask. Do not change any neighbour's roof.",
    "Chosen material and finish: " + p.name + " - " + q.material + "; " + q.profile + "; colour " + q.colourWords + " (around " + p.hex[0] + " to " + p.hex[1] + "); " + q.finish + ".",
    "Lay it " + q.bond + ", in straight courses parallel to the eaves, roughly " + q.courses + " courses from eaves to ridge on a roof this size, with " + q.ridge + " on the ridges and hips." + (q.extra ? " " + q.extra : ""),
    "Keep unchanged: chimneys and pots, flashings, rooflights, vents, solar panels, aerials, satellite dishes, gutters, fascias, soffits, bargeboards, walls, windows, doors, gardens, vehicles, people, neighbouring buildings, trees and sky. " +
      "Match the photo's light, shadows, exposure, white balance and grain. No text or watermark.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// the real adapter

/**
 * The multipart body for one edit (exported for the parameter tests).
 * @param {EditRequest} o
 */
function buildForm(o) {
  const form = new FormData();
  form.append("model", o.model);
  form.append("prompt", o.prompt);
  // Node Buffers are valid Blob parts; the casts only satisfy TypeScript's DOM typing.
  form.append("image", new Blob([/** @type {BlobPart} */ (/** @type {unknown} */ (o.image))], { type: "image/png" }), "photo.png");
  form.append("mask", new Blob([/** @type {BlobPart} */ (/** @type {unknown} */ (o.mask))], { type: "image/png" }), "mask.png");
  form.append("size", o.W + "x" + o.H);
  form.append("n", "1");
  form.append("quality", o.quality);
  form.append("output_format", "jpeg");
  form.append("output_compression", String(o.compression));
  if (profile(o.model).sendInputFidelity) form.append("input_fidelity", "high");
  return form;
}

/** @param {Headers} headers */
function retryAfterSeconds(headers) {
  const ms = Number(headers.get("retry-after-ms"));
  if (Number.isFinite(ms) && ms > 0) return Math.ceil(ms / 1000);
  const s = Number(headers.get("retry-after"));
  if (Number.isFinite(s) && s > 0) return Math.ceil(s);
  return 20;
}

/** @param {unknown} err */
function isTimeout(err) {
  const name = err instanceof Error ? err.name : "";
  return name === "TimeoutError" || name === "AbortError";
}

/**
 * One call to OpenAI's image edits endpoint.
 * @param {EditRequest} o
 * @returns {Promise<EditResult>}
 */
async function realEdit(o) {
  if (!o.key) throw new RenderError("not_configured", "No OpenAI key is set.");
  validateParams(o);
  let res;
  try {
    res = await fetch(ENDPOINT, { method: "POST", headers: { Authorization: "Bearer " + o.key }, body: buildForm(o), signal: AbortSignal.timeout(o.timeoutMs) });
  } catch (err) {
    // Either way the request may have reached OpenAI: never retried automatically.
    if (isTimeout(err)) throw new RenderError("timeout", "The render took too long.");
    throw new RenderError("network", "The render service couldn't be reached.");
  }
  const requestId = res.headers.get("x-request-id");
  const extra = { httpStatus: res.status, requestId };
  /** @type {any} */
  let body = {};
  try {
    body = await res.json();
  } catch (err) {
    if (isTimeout(err)) throw new RenderError("timeout", "The render took too long.", extra);
    body = {};
  }
  if (res.ok) {
    const b64 = body && body.data && body.data[0] && body.data[0].b64_json;
    if (!b64) throw new RenderError("bad_response", "The render service returned no image.", extra);
    return { jpeg: Buffer.from(b64, "base64"), usage: body.usage || null, requestId, httpStatus: res.status };
  }
  const e = (body && body.error) || {};
  const code = String(e.code || e.type || "");
  const msg = String(e.message || "");
  if (res.status === 401 || res.status === 403) throw new RenderError("not_configured", "The OpenAI key was refused.", extra);
  if (res.status === 404) throw new RenderError("not_configured", "The configured image model isn't available to this account.", extra);
  if (res.status === 429) {
    if (/insufficient_quota|billing|spend|budget/i.test(code + " " + msg)) throw new RenderError("budget", "The OpenAI project's budget is used up.", extra);
    throw new RenderError("rate_limited", "The render service is busy.", Object.assign({ retryAfter: retryAfterSeconds(res.headers) }, extra));
  }
  if (res.status === 400 && /moderation|safety|content_policy|rejected/i.test(code + " " + msg)) {
    throw new RenderError("refused", "The render service couldn't process this photo.", extra);
  }
  console.warn("[wvroofing] openai error", res.status, code, msg.slice(0, 300));
  if (res.status >= 500) throw new RenderError("upstream_5xx", "The render service had a problem.", extra);
  throw new RenderError("bad_request", "The render request wasn't accepted.", extra);
}

// ---------------------------------------------------------------------------
// the fixture (TEST ENVIRONMENT ONLY)

/**
 * @typedef {object} FixtureBehaviour
 * @property {"ok" | "timeout" | "network" | "5xx" | "5xx_once" | "429_once" | "refused" | "budget" | "misaligned"} mode
 * @property {number} latencyMs
 * @property {((o: EditRequest) => Promise<void>) | null} hook  runs before the answer (tests use it to change things mid-render)
 * @property {number} calls
 */

/** @returns {FixtureBehaviour} */
function defaultFixture() {
  const mode = /** @type {FixtureBehaviour["mode"]} */ (process.env.WVR_FIXTURE_OPENAI || "ok");
  return { mode, latencyMs: Number(process.env.WVR_FIXTURE_LATENCY_MS) || 0, hook: null, calls: 0 };
}

/** @type {FixtureBehaviour | null} */
let fixture = null;

function assertTestEnv() {
  if (!isTest(process.env)) throw new Error("The OpenAI fixture exists only in the test environment.");
}

/**
 * Tests: choose how the fixture answers. Refused outside the test environment.
 * @param {Partial<FixtureBehaviour>} [b]
 */
function setFixture(b) {
  assertTestEnv();
  fixture = Object.assign(defaultFixture(), b || {}, { calls: 0 });
  return fixture;
}

/** How many times the fixture has been called since the last setFixture(). */
function fixtureCalls() {
  return fixture ? fixture.calls : 0;
}

/**
 * Stand-in for OpenAI: the photo it was sent, with a course pattern in the
 * product's colours painted where the mask is transparent.
 * @param {EditRequest} o
 * @returns {Promise<EditResult>}
 */
async function fixtureEdit(o) {
  assertTestEnv();
  validateParams(o);
  if (!fixture) fixture = defaultFixture();
  const f = fixture;
  f.calls++;
  if (f.latencyMs) await new Promise((r) => setTimeout(r, f.latencyMs));
  if (f.hook) await f.hook(o);
  const id = "fixture-" + f.calls;
  if (f.mode === "timeout") throw new RenderError("timeout", "The render took too long.");
  if (f.mode === "network") throw new RenderError("network", "The render service couldn't be reached.");
  if (f.mode === "5xx" || (f.mode === "5xx_once" && f.calls === 1)) throw new RenderError("upstream_5xx", "The render service had a problem.", { httpStatus: 500, requestId: id });
  if (f.mode === "429_once" && f.calls === 1) throw new RenderError("rate_limited", "The render service is busy.", { httpStatus: 429, retryAfter: 1, requestId: id });
  if (f.mode === "refused") throw new RenderError("refused", "The render service couldn't process this photo.", { httpStatus: 400, requestId: id });
  if (f.mode === "budget") throw new RenderError("budget", "The OpenAI project's budget is used up.", { httpStatus: 429, requestId: id });

  const sharp = require("./images.js").sharp();
  const photo = await sharp(o.image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const mask = await sharp(o.mask).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = photo.info;
  const mc = mask.info.channels;
  const hex = (o.product && o.product.hex) || ["#6b6b6b", "#4a4a4a"];
  const rgb = hex.map((h) => {
    const n = parseInt(String(h).replace("#", ""), 16) || 0x777777;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  });
  const course = Math.max(8, Math.round(H / 40));
  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const roof = mask.data[i * mc + mc - 1] < 128;
      // "misaligned": the surroundings come back shifted and inverted, as a bad render might
      const sx = f.mode === "misaligned" ? Math.min(W - 1, x + 40) : x;
      for (let c = 0; c < 3; c++) {
        const src = photo.data[(y * W + sx) * 3 + c];
        let v = f.mode === "misaligned" ? 255 - src : src;
        if (roof) {
          const off = Math.floor(y / course) % 2 ? course : 0;
          const joint = y % course < 2 || (x + off) % (course * 2) < 2;
          v = Math.round((joint ? rgb[1][c] : rgb[0][c]) * (0.85 + 0.15 * (src / 255)));
        }
        out[i * 3 + c] = v;
      }
    }
  }
  const jpeg = await sharp(out, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: o.compression }).toBuffer();
  return {
    jpeg,
    usage: { input_tokens: 1400, input_tokens_details: { text_tokens: 250, image_tokens: 1150 }, output_tokens: 1367, total_tokens: 2767, fixture: true },
    requestId: id,
    httpStatus: 200,
  };
}

/**
 * The adapter for this environment: the fixture in the test environment,
 * OpenAI everywhere else.
 * @param {Env} [env]
 * @returns {(o: EditRequest) => Promise<EditResult>}
 */
function adapter(env) {
  return isTest(env || process.env) ? fixtureEdit : realEdit;
}

module.exports = {
  PROMPT_VERSION,
  RenderError,
  renderConfig,
  profile,
  validateParams,
  estimateCost,
  costFromUsage,
  buildPrompt,
  buildForm,
  realEdit,
  adapter,
  setFixture,
  fixtureCalls,
  FIXED_SIZES,
  FLEX_MIN_PX,
};
