// WV Roofing — the image work around a photo-real render (A3; brief §10, plan D6):
// the photo and mask sent to OpenAI, and the composite that takes ONLY the new
// roof from the render and keeps every other pixel of the customer's photo.
//
// It runs on the lossless working copy (images.js) and uses the same pure maths
// as the browser (mask-ops.js, ai-input.js, composite.js), loaded with import()
// so there is one implementation, tested once. JPEG appears only at the end, for
// storage and display, with the same settings as the display copy of the photo.
"use strict";

const images = require("./images.js");

/**
 * @typedef {{ data: Uint8ClampedArray, width: number, height: number }} Rgba
 * @typedef {{ x: number, y: number, w: number, h: number }} Rect
 * @typedef {{ W: number, H: number, mode: "stretch" | "letterbox", rect?: Rect }} AiSpec
 * @typedef {{ maskOps: any, aiInput: any, composite: any }} Maths
 */

/** @type {Promise<Maths> | null} */
let mathsPromise = null;

/** The browser's pure maths modules (ES modules shared with the server). */
function maths() {
  if (!mathsPromise) {
    mathsPromise = Promise.all([
      import("../../public/WVROOFING/assets/js/vis/mask-ops.js"),
      import("../../public/WVROOFING/assets/js/vis/ai-input.js"),
      import("../../public/WVROOFING/assets/js/vis/composite.js"),
    ])
      .then(([maskOps, aiInput, composite]) => ({ maskOps, aiInput, composite }))
      .catch((err) => {
        mathsPromise = null;
        throw err;
      });
  }
  return mathsPromise;
}

/** Whether the shared maths loads in this deployment (reported by /health). */
async function ready() {
  try {
    const m = await maths();
    return typeof m.composite.compositeRender === "function" && typeof m.aiInput.chooseAiSize === "function";
  } catch (err) {
    console.error("[wvroofing] render maths failed to load", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * The size and placement of the image sent to the model for a w x h photo.
 * @param {number} w
 * @param {number} h
 * @param {boolean} flex  true for models that accept any size (multiples of 16)
 * @returns {Promise<AiSpec>}
 */
async function aiSpec(w, h, flex) {
  return (await maths()).aiInput.chooseAiSize(w, h, flex);
}

/**
 * Decode an image to RGBA pixels.
 * @param {Buffer} buf
 * @returns {Promise<Rgba>}
 */
async function rgba(buf) {
  const { data, info } = await images.sharp()(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
}

/**
 * The saved outline (a PNG where alpha 0 marks the roof) as a roof mask:
 * 255 = roof, 0 = not roof, on the working copy's pixel grid.
 * @param {Buffer} png
 * @param {number} w
 * @param {number} h
 */
async function roofMaskFromPng(png, w, h) {
  const { data, info } = await images.sharp()(png).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  if (info.width !== w || info.height !== h) throw new Error("The outline doesn't match the photo size.");
  if (ch !== 2 && ch !== 4) throw new Error("The outline has no transparency.");
  const m = new Uint8Array(w * h);
  for (let i = 0; i < m.length; i++) m[i] = data[i * ch + ch - 1] < 128 ? 255 : 0;
  return m;
}

/** @param {AiSpec} spec @returns {Rect} */
function rectOf(spec) {
  return spec.mode === "letterbox" && spec.rect ? spec.rect : { x: 0, y: 0, w: spec.W, h: spec.H };
}

/**
 * The photo (PNG) and mask (PNG, alpha 0 = edit here) sent to the model: the
 * working copy at the model's size (letterboxed on a soft blurred copy of itself
 * when the shape is too extreme), and the roof grown slightly so the model
 * redraws the roof's edges.
 * @param {Buffer} workingPng
 * @param {Uint8Array} roof
 * @param {number} w
 * @param {number} h
 * @param {AiSpec} spec
 */
async function aiInputs(workingPng, roof, w, h, spec) {
  const { maskOps, aiInput } = await maths();
  const s = images.sharp();
  const { W, H } = spec;
  const rect = rectOf(spec);
  let image;
  if (spec.mode === "letterbox") {
    const bg = await s(workingPng).resize(W, H, { fit: "fill" }).blur(24).toBuffer();
    const fg = await s(workingPng).resize(rect.w, rect.h, { fit: "fill" }).toBuffer();
    image = await s(bg).composite([{ input: fg, left: rect.x, top: rect.y }]).png().toBuffer();
  } else {
    image = await s(workingPng).resize(W, H, { fit: "fill" }).png().toBuffer();
  }
  const grown = maskOps.dilate(roof, w, h, aiInput.aiMaskDilation(w, h));
  const raw = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    const sy = Math.floor(((y - rect.y + 0.5) * h) / rect.h);
    for (let x = 0; x < W; x++) {
      const sx = Math.floor(((x - rect.x + 0.5) * w) / rect.w);
      const inside = sx >= 0 && sy >= 0 && sx < w && sy < h;
      raw[(y * W + x) * 4 + 3] = inside && grown[sy * w + sx] >= 128 ? 0 : 255;
    }
  }
  const mask = await s(raw, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
  return { image, mask };
}

/**
 * Map the model's answer back onto the photo's grid and blend it in through the
 * feathered roof mask (after re-aligning it and matching its exposure on the
 * unchanged surroundings). Pixels outside the roof are the working copy's own.
 * @param {Buffer} workingPng
 * @param {Uint8Array} roof
 * @param {Buffer} renderBuf  JPEG or PNG as returned by the model
 * @param {AiSpec} spec
 * @param {number} w
 * @param {number} h
 */
async function composite(workingPng, roof, renderBuf, spec, w, h) {
  const { maskOps, composite: C } = await maths();
  const s = images.sharp();
  const orig = await rgba(workingPng);
  if (orig.width !== w || orig.height !== h) throw new Error("The working copy isn't the expected size.");
  const meta = await s(renderBuf).metadata();
  const rw = meta.width || spec.W;
  const rh = meta.height || spec.H;
  // The model may answer at a different size: scale the placement proportionally.
  const r = rectOf(spec);
  const kx = rw / spec.W;
  const ky = rh / spec.H;
  const left = Math.min(rw - 1, Math.max(0, Math.round(r.x * kx)));
  const top = Math.min(rh - 1, Math.max(0, Math.round(r.y * ky)));
  const width = Math.max(1, Math.min(rw - left, Math.round(r.w * kx)));
  const height = Math.max(1, Math.min(rh - top, Math.round(r.h * ky)));
  const { data } = await s(renderBuf).extract({ left, top, width, height }).resize(w, h, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const render = { data: new Uint8ClampedArray(data), width: w, height: h };
  const alpha = maskOps.featherAlpha(roof, w, h);
  const out = C.compositeRender(orig, render, roof, alpha, w, h);
  return {
    /** @type {Uint8ClampedArray} */ pixels: out.pixels,
    /** @type {Float32Array} */ alpha,
    orig,
    adj: /** @type {{ dx: number, dy: number, gain: number[], off: number[] }} */ (out.adj),
    /** @type {number} */ seam: out.seam,
    /** @type {number} */ confidence: out.confidence,
  };
}

/**
 * Encode RGBA pixels as the delivery JPEG (the same settings as the photo's
 * display copy, so untouched areas encode identically).
 * @param {Uint8ClampedArray} pixels
 * @param {number} w
 * @param {number} h
 */
function jpegFromRgba(pixels, w, h) {
  const buf = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  return images.sharp()(buf, { raw: { width: w, height: h, channels: 4 } }).removeAlpha().jpeg(images.JPEG_OPTIONS).toBuffer();
}

module.exports = { maths, ready, aiSpec, rgba, roofMaskFromPng, aiInputs, composite, jpegFromRgba };
