// @ts-nocheck -- browser ES module shared with the server (serverlib/wvroofing/compose.js); outside the JSDoc type check.
// WV Roofing Roof Visualiser — composites a photo-real AI render back onto the
// ORIGINAL photo through the roof mask. The server composites customer renders
// with these same functions; the browser uses them for the pre-rendered samples.
//
// Image models regenerate the whole picture even when given a mask, so windows,
// brickwork or cars can drift slightly. Here only roof pixels are taken from the
// render; every pixel outside the (feathered) mask is the original, untouched.
// Before blending, the render is re-aligned (small shift search on edges in a
// ring of unchanged surroundings) and its exposure matched to the original.
import { clamp, ringMask } from "./mask-ops.js";

function lumaArray(data, w, h) {
  const L = new Float32Array(w * h);
  for (let i = 0, j = 0; i < L.length; i++, j += 4) {
    L[i] = 0.2126 * data[j] + 0.7152 * data[j + 1] + 0.0722 * data[j + 2];
  }
  return L;
}

function gradient(L, w, h) {
  const G = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      G[i] = Math.abs(L[i + 1] - L[i - 1]) + Math.abs(L[i + w] - L[i - w]);
    }
  }
  return G;
}

function downsample(L, w, h) {
  const w2 = w >> 1;
  const h2 = h >> 1;
  const out = new Float32Array(w2 * h2);
  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      const i = 2 * y * w + 2 * x;
      out[y * w2 + x] = (L[i] + L[i + 1] + L[i + w] + L[i + w + 1]) / 4;
    }
  }
  return { L: out, w: w2, h: h2 };
}

function samplePoints(ring, w, h, cap, margin) {
  const pts = [];
  for (let y = margin; y < h - margin; y++) {
    for (let x = margin; x < w - margin; x++) {
      if (ring[y * w + x]) pts.push(y * w + x);
    }
  }
  if (pts.length <= cap) return pts;
  const step = pts.length / cap;
  const out = [];
  for (let i = 0; i < cap; i++) out.push(pts[Math.floor(i * step)]);
  return out;
}

function cost(GO, GR, w, pts, dx, dy) {
  let s = 0;
  const off = dy * w + dx;
  for (let k = 0; k < pts.length; k++) s += Math.abs(GO[pts[k]] - GR[pts[k] + off]);
  // Prefer small shifts: repeating textures (brick courses, fences) can make a
  // far shift score almost as well as the true one.
  return pts.length ? (s / pts.length) * (1 + 0.004 * (dx * dx + dy * dy)) : Infinity;
}

/**
 * Find the shift (dx, dy) such that render(x+dx, y+dy) best matches the
 * original around the roof. Coarse search at half resolution, refined at full.
 */
export function alignRender(orig, render, ring, w, h, maxShift) {
  maxShift = maxShift || 6;
  const LO = lumaArray(orig.data, w, h);
  const LR = lumaArray(render.data, w, h);
  const hO = downsample(LO, w, h);
  const hR = downsample(LR, w, h);
  const GO2 = gradient(hO.L, hO.w, hO.h);
  const GR2 = gradient(hR.L, hR.w, hR.h);
  const ring2 = new Uint8Array(hO.w * hO.h);
  for (let y = 0; y < hO.h; y++) for (let x = 0; x < hO.w; x++) ring2[y * hO.w + x] = ring[2 * y * w + 2 * x] ? 1 : 0;
  const s2 = Math.ceil(maxShift / 2);
  const pts2 = samplePoints(ring2, hO.w, hO.h, 25000, s2 + 2);
  if (pts2.length < 50) return { dx: 0, dy: 0, confidence: 0 };
  const base = cost(GO2, GR2, hO.w, pts2, 0, 0);
  let best = { dx: 0, dy: 0, c: base };
  for (let dy = -s2; dy <= s2; dy++) {
    for (let dx = -s2; dx <= s2; dx++) {
      const c = cost(GO2, GR2, hO.w, pts2, dx, dy);
      if (c < best.c) best = { dx, dy, c };
    }
  }
  let dx0 = best.dx * 2;
  let dy0 = best.dy * 2;
  if (best.c > 0.97 * base) {
    dx0 = 0;
    dy0 = 0;
  }
  const GO = gradient(LO, w, h);
  const GR = gradient(LR, w, h);
  const pts = samplePoints(ring, w, h, 40000, maxShift + 3);
  if (!pts.length) return { dx: dx0, dy: dy0, confidence: 0 };
  let fine = { dx: dx0, dy: dy0, c: cost(GO, GR, w, pts, dx0, dy0) };
  for (let dy = dy0 - 1; dy <= dy0 + 1; dy++) {
    for (let dx = dx0 - 1; dx <= dx0 + 1; dx++) {
      if (Math.abs(dx) > maxShift || Math.abs(dy) > maxShift) continue;
      const c = cost(GO, GR, w, pts, dx, dy);
      if (c < fine.c) fine = { dx, dy, c };
    }
  }
  const zero = cost(GO, GR, w, pts, 0, 0);
  return { dx: fine.dx, dy: fine.dy, confidence: zero > 0 ? 1 - fine.c / zero : 0 };
}

/**
 * Per-channel gain/offset mapping the (shifted) render onto the original,
 * measured on unchanged surroundings; occluders that differ a lot are ignored.
 */
export function exposureMatch(orig, render, ring, w, h, dx, dy) {
  const sum = [0, 0, 0];
  const sum2 = [0, 0, 0];
  const rs = [0, 0, 0];
  const rs2 = [0, 0, 0];
  let n = 0;
  const O = orig.data;
  const R = render.data;
  for (let y = 0; y < h; y += 2) {
    const sy = y + dy;
    if (sy < 0 || sy >= h) continue;
    for (let x = 0; x < w; x += 2) {
      const i = y * w + x;
      if (!ring[i]) continue;
      const sx = x + dx;
      if (sx < 0 || sx >= w) continue;
      const o4 = i * 4;
      const r4 = (sy * w + sx) * 4;
      const lo = 0.2126 * O[o4] + 0.7152 * O[o4 + 1] + 0.0722 * O[o4 + 2];
      const lr = 0.2126 * R[r4] + 0.7152 * R[r4 + 1] + 0.0722 * R[r4 + 2];
      if (Math.abs(lo - lr) > 60) continue;
      for (let c = 0; c < 3; c++) {
        sum[c] += O[o4 + c];
        sum2[c] += O[o4 + c] * O[o4 + c];
        rs[c] += R[r4 + c];
        rs2[c] += R[r4 + c] * R[r4 + c];
      }
      n++;
    }
  }
  const gain = [1, 1, 1];
  const off = [0, 0, 0];
  if (n < 200) return { gain, off, samples: n };
  for (let c = 0; c < 3; c++) {
    const mo = sum[c] / n;
    const mr = rs[c] / n;
    const so = Math.sqrt(Math.max(1, sum2[c] / n - mo * mo));
    const sr = Math.sqrt(Math.max(1, rs2[c] / n - mr * mr));
    gain[c] = clamp(so / sr, 0.85, 1.15);
    off[c] = clamp(mo - gain[c] * mr, -20, 20);
  }
  return { gain, off, samples: n };
}

/**
 * Blend: out = orig + alpha * (adjusted render - orig). Pixels with alpha ~0
 * are copied from the original byte-for-byte.
 */
export function blendThroughMask(orig, render, alpha, w, h, adj) {
  const O = orig.data;
  const R = render.data;
  const out = new Uint8ClampedArray(O);
  const dx = adj.dx || 0;
  const dy = adj.dy || 0;
  const gain = adj.gain || [1, 1, 1];
  const off = adj.off || [0, 0, 0];
  for (let y = 0; y < h; y++) {
    const sy = clamp(y + dy, 0, h - 1);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const a = alpha[i];
      if (a <= 0.002) continue;
      const sx = clamp(x + dx, 0, w - 1);
      const r4 = (sy * w + sx) * 4;
      const o4 = i * 4;
      for (let c = 0; c < 3; c++) {
        const v = gain[c] * R[r4 + c] + off[c];
        out[o4 + c] = O[o4 + c] + a * (v - O[o4 + c]);
      }
    }
  }
  return out;
}

/** Mean absolute luma difference in the ring after adjustment (lower = better seam). */
export function seamError(orig, render, ring, w, h, adj) {
  let s = 0;
  let n = 0;
  const O = orig.data;
  const R = render.data;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = y * w + x;
      if (!ring[i]) continue;
      const sx = clamp(x + adj.dx, 0, w - 1);
      const sy = clamp(y + adj.dy, 0, h - 1);
      const o4 = i * 4;
      const r4 = (sy * w + sx) * 4;
      let lo = 0;
      let lr = 0;
      const wts = [0.2126, 0.7152, 0.0722];
      for (let c = 0; c < 3; c++) {
        lo += wts[c] * O[o4 + c];
        lr += wts[c] * (adj.gain[c] * R[r4 + c] + adj.off[c]);
      }
      s += Math.abs(lo - lr);
      n++;
    }
  }
  return n ? s / n : 0;
}

/**
 * Full pipeline for one render already mapped to the photo's size.
 * @returns {{pixels:Uint8ClampedArray, adj:object, seam:number}}
 */
export function compositeRender(orig, render, mask, alpha, w, h) {
  const ring = ringMask(mask, w, h, Math.max(4, Math.round(0.004 * Math.max(w, h))), Math.max(20, Math.round(0.03 * Math.max(w, h))));
  const shift = alignRender(orig, render, ring, w, h, 6);
  const ex = exposureMatch(orig, render, ring, w, h, shift.dx, shift.dy);
  const adj = { dx: shift.dx, dy: shift.dy, gain: ex.gain, off: ex.off };
  const pixels = blendThroughMask(orig, render, alpha, w, h, adj);
  const seam = seamError(orig, render, ring, w, h, adj);
  return { pixels, adj, seam, confidence: shift.confidence };
}

/**
 * Browser helper: decode a render (data URL or Blob URL) and map it back onto
 * the photo grid according to the spec used to build the AI inputs.
 */
export async function decodeRenderToPhotoGrid(src, spec, w, h) {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // The model may answer at a different size; scale the rect proportionally.
  const kx = img.naturalWidth / spec.W;
  const ky = img.naturalHeight / spec.H;
  const r = spec.mode === "letterbox" ? spec.rect : { x: 0, y: 0, w: spec.W, h: spec.H };
  ctx.drawImage(img, r.x * kx, r.y * ky, r.w * kx, r.h * ky, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}
