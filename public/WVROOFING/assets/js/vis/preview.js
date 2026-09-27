// WV Roofing Roof Visualiser — instant, in-browser "quick previews".
//
// Replaces the roof's colour and pattern with each product's while keeping the
// photo's own light: a large-scale shading map (normalised convolution of the
// roof's luminance) carries the sun, shadows and exposure across, and a little
// of the original fine detail is added back. Courses run parallel to the eaves
// line fitted from the mask and tighten slightly towards the ridge.
// Pure maths on {data,width,height} — no DOM, so it is testable in Node.
import { boxBlur, fitEaves, maskStats, featherAlpha, clamp } from "./mask-ops.js";
import { tileAt, grainAt, hexToRgb } from "../tiles.js";

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * One-off analysis of the photo + roof mask, shared by all eight previews.
 * @param {{data:Uint8ClampedArray,width:number,height:number}} photo
 * @param {Uint8Array} mask
 */
export function analyseRoof(photo, mask) {
  const w = photo.width;
  const h = photo.height;
  const d = photo.data;
  const st = maskStats(mask, w, h);
  if (st.empty) return null;
  const pad = Math.round(0.03 * Math.max(w, h));
  const bx = Math.max(0, st.minX - pad);
  const by = Math.max(0, st.minY - pad);
  const bw = Math.min(w, st.maxX + pad + 1) - bx;
  const bh = Math.min(h, st.maxY + pad + 1) - by;

  const L = new Float32Array(bw * bh);
  const LM = new Float32Array(bw * bh);
  const M = new Float32Array(bw * bh);
  const roofL = [];
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const gi = (y + by) * w + (x + bx);
      const i4 = gi * 4;
      const l = luma(d[i4], d[i4 + 1], d[i4 + 2]);
      const m = mask[gi] / 255;
      const li = y * bw + x;
      L[li] = l;
      M[li] = m;
      LM[li] = l * m;
      if (m > 0.5 && (x + y) % 3 === 0) roofL.push(l);
    }
  }
  roofL.sort((p, q) => p - q);
  const med = Math.max(8, roofL[Math.floor(roofL.length / 2)] || 64);

  const R = Math.max(4, Math.round(0.02 * Math.max(w, h)));
  const bLM = boxBlur(LM, bw, bh, R, 2);
  const bM = boxBlur(M, bw, bh, R, 2);
  const shade = new Float32Array(bw * bh);
  const detail = new Float32Array(bw * bh);
  for (let i = 0; i < shade.length; i++) {
    const s = bM[i] > 1e-3 ? bLM[i] / bM[i] : med;
    shade[i] = clamp(s / med, 0.45, 1.6);
    detail[i] = clamp((L[i] - s) / med, -0.4, 0.4);
  }

  // Overall exposure from the whole photo (not the old roof's own colour).
  const all = [];
  for (let i = 0; i < w * h; i += 97) all.push(luma(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]));
  all.sort((p, q) => p - q);
  const exposure = clamp((all[Math.floor(all.length / 2)] || 118) / 118, 0.72, 1.18);

  const eaves = fitEaves(mask, w, h, st);
  return {
    w,
    h,
    bx,
    by,
    bw,
    bh,
    shade,
    detail,
    med,
    exposure,
    eaves,
    alpha: featherAlpha(mask, w, h),
  };
}

/**
 * Render one product onto a copy of the photo.
 * @returns {Uint8ClampedArray} RGBA pixels (same size as the photo)
 */
export function renderPreview(analysis, photo, product, courseScale) {
  const A = analysis;
  const w = A.w;
  const out = new Uint8ClampedArray(photo.data);
  const p = product.pattern || {};
  const c1 = hexToRgb(product.hex && product.hex[0]);
  const c2 = hexToRgb(product.hex && product.hex[1]);
  const courses = (p.courses || 14) * (courseScale || 1);
  const p0 = A.eaves.roofH / courses;
  const patterned = p0 >= 3;
  const cos = Math.cos(A.eaves.angle);
  const sin = Math.sin(A.eaves.angle);
  const roofH = A.eaves.roofH;
  // origin on the eaves line, left edge of the analysed box
  const x0 = A.bx;
  const y0 = A.eaves.a * x0 + A.eaves.b;
  const expo = A.exposure;

  for (let y = 0; y < A.bh; y++) {
    const gy = y + A.by;
    for (let x = 0; x < A.bw; x++) {
      const gx = x + A.bx;
      const gi = gy * w + gx;
      const a = A.alpha[gi];
      if (a <= 0.003) continue;
      const li = y * A.bw + x;
      let r;
      let g;
      let b;
      if (patterned) {
        const dx = gx - x0;
        const dy = gy - y0;
        const along = dx * cos + dy * sin;
        const up = -(-dx * sin + dy * cos); // distance above the eaves
        const s = clamp(up / roofH, 0, 1.2);
        const vCourses = (up / p0) * (1 + 0.15 * s);
        const t = tileAt(along / p0 + 0.37, -vCourses + 0.5, p);
        const k = t.k * grainAt(gx, gy, p);
        r = c1[0] + (c2[0] - c1[0]) * t.t;
        g = c1[1] + (c2[1] - c1[1]) * t.t;
        b = c1[2] + (c2[2] - c1[2]) * t.t;
        const f = k * Math.pow(A.shade[li], 0.9) * expo;
        r *= f;
        g *= f;
        b *= f;
      } else {
        const f = Math.pow(A.shade[li], 0.9) * expo;
        r = ((c1[0] + c2[0]) / 2) * f;
        g = ((c1[1] + c2[1]) / 2) * f;
        b = ((c1[2] + c2[2]) / 2) * f;
      }
      const det = 0.25 * A.detail[li] * A.med;
      r += det;
      g += det;
      b += det;
      const i4 = gi * 4;
      out[i4] = out[i4] + a * (r - out[i4]);
      out[i4 + 1] = out[i4 + 1] + a * (g - out[i4 + 1]);
      out[i4 + 2] = out[i4 + 2] + a * (b - out[i4 + 2]);
    }
  }
  return out;
}
