// Server-side render image work: the inputs sent to the model, and the composite
// that keeps every pixel outside the roof. (A3; brief §10)
import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers.mjs";

const compose = load("serverlib/wvroofing/compose.js");
const images = load("serverlib/wvroofing/images.js");
const sharp = images.sharp();

// deterministic pseudo-random texture, so the alignment search has edges to find
let seed = 99;
const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);

function scene(w, h) {
  const field = new Float32Array(w * h).fill(120);
  for (let k = 0; k < 120; k++) {
    const x0 = Math.floor(rnd() * w);
    const y0 = Math.floor(rnd() * h);
    const rw = 6 + Math.floor(rnd() * 40);
    const rh = 6 + Math.floor(rnd() * 30);
    const v = 30 + rnd() * 190;
    for (let y = y0; y < Math.min(h, y0 + rh); y++) for (let x = x0; x < Math.min(w, x0 + rw); x++) field[y * w + x] = v;
  }
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(field[i] + rnd() * 10);
    raw[i * 3] = v;
    raw[i * 3 + 1] = (v * 0.9) | 0;
    raw[i * 3 + 2] = (v * 0.8) | 0;
  }
  return raw;
}

async function setup(w = 480, h = 320) {
  const raw = scene(w, h);
  const workingPng = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  const { maskOps } = await compose.maths();
  const roof = maskOps.buildMask([{ mode: "add", pts: [[140, 210], [360, 210], [320, 90], [180, 90]] }], w, h);
  return { w, h, raw, workingPng, roof };
}

test("the shared browser maths loads on the server", async () => {
  assert.equal(await compose.ready(), true);
});

test("the model gets a PNG photo and a PNG mask of the same size, with the roof (grown) transparent", async () => {
  const { w, h, workingPng, roof } = await setup(900, 600);
  const spec = await compose.aiSpec(w, h, true);
  assert.equal(spec.mode, "stretch");
  assert.ok(spec.W % 16 === 0 && spec.H % 16 === 0 && spec.W * spec.H >= 655360);
  const { image, mask } = await compose.aiInputs(workingPng, roof, w, h, spec);
  assert.equal(images.sniff(image), "png", "the photo goes in the mask's format");
  const im = await sharp(image).metadata();
  const mm = await sharp(mask).metadata();
  assert.deepEqual([im.width, im.height, mm.width, mm.height], [spec.W, spec.H, spec.W, spec.H]);
  assert.equal(mm.channels, 4);
  assert.ok(mask.length < 4 * 1024 * 1024, "OpenAI's 4 MB mask limit");
  const info = images.maskInfo(mask, spec.W, spec.H);
  const roofFrac = roof.reduce((s, v) => s + (v ? 1 : 0), 0) / (w * h);
  assert.ok(info.transparentFrac > roofFrac && info.transparentFrac < roofFrac * 1.6, "grown a little, not a lot: " + info.transparentFrac + " vs " + roofFrac);
});

test("an extreme panorama is letterboxed, not cropped or stretched", async () => {
  const w = 1600;
  const h = 400;
  const raw = scene(w, h);
  const workingPng = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  const roof = new Uint8Array(w * h);
  for (let y = 100; y < 250; y++) for (let x = 500; x < 1100; x++) roof[y * w + x] = 255;
  const spec = await compose.aiSpec(w, h, true);
  assert.equal(spec.mode, "letterbox");
  const { image } = await compose.aiInputs(workingPng, roof, w, h, spec);
  const m = await sharp(image).metadata();
  assert.deepEqual([m.width, m.height], [spec.W, spec.H]);
});

test("the composite keeps every pixel outside the roof byte-identical (lossless working copy)", async () => {
  const { w, h, raw, workingPng, roof } = await setup();
  // A "render" that has drifted: shifted (4, -3), brighter, and a new roof colour.
  const r = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.min(w - 1, Math.max(0, x - 4));
      const sy = Math.min(h - 1, Math.max(0, y + 3));
      const i = (y * w + x) * 3;
      const j = (sy * w + sx) * 3;
      const inRoof = roof[sy * w + sx] >= 128;
      for (let c = 0; c < 3; c++) r[i + c] = inRoof ? 60 + c * 25 : Math.min(255, Math.round(raw[j + c] * 1.07 + 3));
    }
  const renderJpeg = await sharp(r, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
  const out = await compose.composite(workingPng, roof, renderJpeg, { W: w, H: h, mode: "stretch" }, w, h);
  let outside = 0;
  let changed = 0;
  let roofChanged = 0;
  for (let i = 0; i < w * h; i++) {
    const same = out.pixels[i * 4] === raw[i * 3] && out.pixels[i * 4 + 1] === raw[i * 3 + 1] && out.pixels[i * 4 + 2] === raw[i * 3 + 2];
    if (out.alpha[i] <= 0.002) {
      outside++;
      if (!same) changed++;
    } else if (out.alpha[i] > 0.99 && !same) roofChanged++;
  }
  assert.ok(outside > w * h * 0.5);
  assert.equal(changed, 0, "pixels outside the roof must be the original bytes");
  assert.ok(roofChanged > 5000, "the roof itself is replaced");
  assert.deepEqual([out.adj.dx, out.adj.dy], [4, -3], "the drift is found and corrected");
});

test("delivery JPEGs: away from the roof, the composite encodes exactly like the display copy", async () => {
  const { w, h, raw, workingPng, roof } = await setup();
  const r = Buffer.from(raw);
  for (let i = 0; i < w * h; i++) if (roof[i]) r[i * 3] = 200;
  const renderPng = await sharp(r, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  const out = await compose.composite(workingPng, roof, renderPng, { W: w, H: h, mode: "stretch" }, w, h);
  const a = await sharp(await images.displayJpeg(workingPng)).raw().toBuffer();
  const b = await sharp(await compose.jpegFromRgba(out.pixels, w, h)).raw().toBuffer();
  let blocks = 0;
  let bad = 0;
  for (let by = 0; by + 16 <= h; by += 16)
    for (let bx = 0; bx + 16 <= w; bx += 16) {
      let near = false;
      for (let y = Math.max(0, by - 32); y < Math.min(h, by + 48) && !near; y++) for (let x = Math.max(0, bx - 32); x < Math.min(w, bx + 48); x++) if (out.alpha[y * w + x] > 0.001) { near = true; break; }
      if (near) continue;
      blocks++;
      for (let y = by; y < by + 16; y++) for (let x = bx; x < bx + 16; x++) for (let c = 0; c < 3; c++) if (a[(y * w + x) * 3 + c] !== b[(y * w + x) * 3 + c]) { bad++; y = by + 16; x = bx + 16; break; }
    }
  assert.ok(blocks > 100);
  assert.equal(bad, 0);
});

test("the stored outline PNG (alpha 0 = roof) becomes the roof mask", async () => {
  const w = 20;
  const h = 10;
  const rgba = Buffer.alloc(w * h * 4, 255);
  for (let y = 0; y < h; y++) for (let x = 0; x < 5; x++) rgba[(y * w + x) * 4 + 3] = 0;
  const png = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  const m = await compose.roofMaskFromPng(png, w, h);
  assert.equal(m.reduce((s, v) => s + (v === 255 ? 1 : 0), 0), 50);
  await assert.rejects(() => compose.roofMaskFromPng(png, 21, 10));
});
