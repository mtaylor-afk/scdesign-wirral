// @ts-nocheck -- temporary v02 bridge (deleted in A3); not worth typing.
// WV Roofing (concept site) — photo-real roof render.
//
// GET  /api/wvroofing/render           -> capabilities (is photo-real rendering live?)
// POST /api/wvroofing/render           -> { productId, image, mask, W, H, mock? }
//                                        returns { ok, image: "data:image/jpeg;base64,...", model, usage }
//
// Prompts are fixed on the server per product (the client only sends an id), so
// the API key can't be used to generate anything else. The client composites
// the result back through the roof mask, so only the roof changes.
//
// v02 bridge (A1): moved here unchanged from api/wvroofing/render.js and served
// by the router until A3 replaces it with durable render jobs. One change: live
// renders also need the image_generation capability switched on
// (WVR_CAP_IMAGE_GENERATION=on), so an API key alone never enables them.
"use strict";

const W = require("../core.js");
const { isEnabled } = require("../capabilities.js");

/** The OpenAI key, but only when image generation is switched on. @param {{ key: string }} cfg */
function liveKey(cfg) {
  return cfg.key && isEnabled("image_generation", process.env) ? cfg.key : "";
}

const MAX_BODY = 3.6 * 1024 * 1024;
const MAX_IMAGE = 2.6 * 1024 * 1024;
const MAX_MASK = 512 * 1024;

// Per-instance limits (soft by design; the hard stop is the OpenAI project budget).
const cfg0 = W.config();
const ipWindow = W.createLimiter(cfg0.ipLimit, 15 * 60 * 1000);
const ipDay = W.createLimiter(cfg0.ipDaily, 24 * 60 * 60 * 1000);
const badRequests = W.createLimiter(30, 15 * 60 * 1000);
const upstream = W.createLimiter(cfg0.upstreamIpm, 60 * 1000);
let dayStart = Date.now();
let dayCount = 0;
let inFlight = 0;
let modelCheck = { at: 0, ok: null };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function health(req, res) {
  const cfg = W.config();
  const key = liveKey(cfg);
  const url = new URL(req.url, "http://x");
  const out = {
    ok: true,
    service: "wvroofing-render",
    live: !!key && cfg.enabled,
    mock: !key,
    model: cfg.model,
    flex: W.modelProfile(cfg.model).flex,
    maxConcurrent: Math.min(3, cfg.maxConcurrent),
    autoRender: cfg.autoRender,
    products: W.PRODUCTS.size,
  };
  if (url.searchParams.get("check") === "1" && key) {
    if (Date.now() - modelCheck.at > 10 * 60 * 1000) modelCheck = { at: Date.now(), ok: await W.checkModel(key, cfg.model) };
    out.modelOk = modelCheck.ok;
  }
  return W.json(res, 200, out);
}

function validate(body, cfg) {
  const product = W.PRODUCTS.get(String(body.productId || ""));
  if (!product) throw new W.HttpError(400, "invalid_product", "Unknown roof product.");
  const Wd = Number(body.W);
  const Ht = Number(body.H);
  const mock = body.mock === true;
  const flex = mock ? true : W.modelProfile(cfg.model).flex;
  if (!W.validSize(Wd, Ht, flex) && !(mock && W.validSize(Wd, Ht, false))) {
    throw new W.HttpError(400, "invalid_size", "Unsupported image size.");
  }
  const img = W.parseDataUrl(body.image, ["image/jpeg"], MAX_IMAGE, "image");
  const dims = W.jpegSize(img.buf);
  if (!dims) throw new W.HttpError(400, "invalid_image", "The photo must be a JPEG.");
  if (dims.w !== Wd || dims.h !== Ht) throw new W.HttpError(400, "invalid_image", "The photo size doesn't match.");
  const mask = W.parseDataUrl(body.mask, ["image/png"], MAX_MASK, "mask");
  const info = W.pngAlphaInfo(mask.buf);
  if (!info || !info.supported) throw new W.HttpError(400, "invalid_mask", "The roof mask must be an 8-bit PNG with transparency.");
  if (info.w !== Wd || info.h !== Ht) throw new W.HttpError(400, "invalid_mask", "The roof mask size doesn't match the photo.");
  if (info.transparentFrac < 0.005 || info.transparentFrac > 0.85) {
    throw new W.HttpError(400, "invalid_mask", "The marked roof area is too small or too large.");
  }
  return { product, Wd, Ht, image: img.buf, mask: mask.buf, mock };
}

module.exports = async (req, res) => {
  const corsState = W.cors(req, res);
  if (corsState === "preflight") return;
  try {
    if (req.method === "GET") return await health(req, res);
    if (req.method !== "POST") return W.json(res, 405, { ok: false, error: "method_not_allowed" }, { Allow: "GET, POST, OPTIONS" });
    if (corsState === "forbidden") return W.json(res, 403, { ok: false, error: "origin", message: "Requests from this site aren't allowed." });
    if (!/application\/json/i.test(req.headers["content-type"] || "")) {
      return W.json(res, 400, { ok: false, error: "invalid_content_type", message: "Send JSON." });
    }

    const cfg = W.config();
    const key = W.ipKey(req);
    let v;
    try {
      const body = await W.readJson(req, MAX_BODY);
      v = validate(body, cfg);
    } catch (err) {
      const b = badRequests.hit(key);
      if (!b.ok) return W.json(res, 429, { ok: false, error: "rate_limited", scope: "ip" }, { "Retry-After": String(b.retryAfter) });
      throw err;
    }

    if (!cfg.enabled) throw new W.HttpError(503, "disabled", "Photo-real rendering is switched off at the moment.");
    const apiKey = liveKey(cfg);
    const mockAllowed = !apiKey && v.mock && (cfg.allowMock || W.isLocalOrigin(req.headers.origin));
    if (!apiKey && !mockAllowed) throw new W.HttpError(503, "not_configured", "Photo-real rendering isn't switched on yet.");

    // limits (applied only to valid requests)
    const a = ipWindow.hit(key);
    if (!a.ok) return W.json(res, 429, { ok: false, error: "rate_limited", scope: "ip", message: "You've made a lot of renders. Please wait a little." }, { "Retry-After": String(a.retryAfter) });
    const d = ipDay.hit(key);
    if (!d.ok) {
      ipWindow.undo(key);
      return W.json(res, 429, { ok: false, error: "rate_limited", scope: "ip_daily", message: "That's today's limit of renders for one visitor." }, { "Retry-After": String(d.retryAfter) });
    }
    if (Date.now() - dayStart > 24 * 60 * 60 * 1000) {
      dayStart = Date.now();
      dayCount = 0;
    }
    if (dayCount >= cfg.dailyCap) throw new W.HttpError(503, "budget", "Photo-real renders have reached today's limit.");
    if (inFlight >= cfg.maxConcurrent) {
      ipWindow.undo(key);
      ipDay.undo(key);
      return W.json(res, 429, { ok: false, error: "rate_limited", scope: "busy" }, { "Retry-After": "6" });
    }
    if (!mockAllowed) {
      const u = upstream.hit("global");
      if (!u.ok) {
        ipWindow.undo(key);
        ipDay.undo(key);
        return W.json(res, 429, { ok: false, error: "rate_limited", scope: "upstream" }, { "Retry-After": String(Math.max(3, u.retryAfter)) });
      }
    }

    inFlight++;
    const t0 = Date.now();
    try {
      if (mockAllowed) {
        await sleep(700);
        const png = W.mockPng(v.Wd, v.Ht, v.product.hex[0]);
        return W.json(res, 200, { ok: true, image: "data:image/png;base64," + png.toString("base64"), model: "mock", mock: true });
      }
      dayCount++;
      const out = await W.openaiEdit({
        key: apiKey,
        model: cfg.model,
        prompt: W.buildPrompt(v.product),
        image: v.image,
        mask: v.mask,
        W: v.Wd,
        H: v.Ht,
        quality: cfg.quality,
        compression: cfg.compression,
        timeoutMs: cfg.timeoutMs,
      });
      console.log("[wvroofing] render ok", v.product.id, v.Wd + "x" + v.Ht, cfg.model, Date.now() - t0 + "ms", out.usage ? JSON.stringify(out.usage) : "");
      return W.json(res, 200, { ok: true, image: "data:image/jpeg;base64," + out.b64, model: cfg.model, usage: out.usage });
    } finally {
      inFlight--;
    }
  } catch (err) {
    if (err instanceof W.HttpError) {
      const headers = err.extra && err.extra.retryAfter ? { "Retry-After": String(err.extra.retryAfter) } : undefined;
      return W.json(res, err.status, Object.assign({ ok: false, error: err.code, message: err.message }, err.extra || {}), headers);
    }
    console.error("[wvroofing] render failure", err && err.message);
    return W.json(res, 500, { ok: false, error: "server_error", message: "Something went wrong." });
  }
};
