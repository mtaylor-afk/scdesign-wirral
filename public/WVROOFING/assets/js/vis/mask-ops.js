// @ts-nocheck -- browser ES module shared with the server (serverlib/wvroofing/compose.js); outside the JSDoc type check.
// WV Roofing Roof Visualiser — pure mask maths. No DOM access, so the same code
// runs in the browser, on the server and in scripts/wvroofing/selftest.mjs.
//
// A mask is a Uint8Array of length w*h holding 0 (not roof) .. 255 (roof).

export function clamp(x, a, b) {
  return x < a ? a : x > b ? b : x;
}

/** Even-odd scanline fill of one polygon (pixel-centre sampling). */
export function fillPolygon(mask, w, h, pts, value) {
  const n = pts.length;
  if (n < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const y = pts[i][1];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(h - 1, Math.ceil(maxY));
  const xs = [];
  for (let y = y0; y <= y1; y++) {
    const sy = y + 0.5;
    xs.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yi = pts[i][1];
      const yj = pts[j][1];
      if (yi > sy !== yj > sy) {
        xs.push(pts[i][0] + ((sy - yi) / (yj - yi)) * (pts[j][0] - pts[i][0]));
      }
    }
    xs.sort((a, b) => a - b);
    const row = y * w;
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5));
      const xb = Math.min(w - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = xa; x <= xb; x++) mask[row + x] = value;
    }
  }
}

/** Paint a round-capped brush stroke (polyline of radius r). */
export function stampStroke(mask, w, h, pts, r, value) {
  if (!pts.length) return;
  const r2 = r * r;
  const segs = pts.length === 1 ? [[pts[0], pts[0]]] : pts.slice(1).map((p, i) => [pts[i], p]);
  for (const [a, b] of segs) {
    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0]) - r));
    const maxX = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0]) + r));
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r));
    const maxY = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1]) + r));
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        let t = len2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / len2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = px - (a[0] + t * dx);
        const ey = py - (a[1] + t * dy);
        if (ex * ex + ey * ey <= r2) mask[y * w + x] = value;
      }
    }
  }
}

/**
 * Rasterise editor shapes into a mask. Shapes apply in order:
 * { mode: "add"|"sub", pts: [[x,y],...], r?: number (brush stroke when set) }.
 * sx/sy scale the stored coordinates onto this w*h grid.
 */
export function buildMask(shapes, w, h, sx, sy) {
  sx = sx || 1;
  sy = sy || 1;
  const mask = new Uint8Array(w * h);
  for (const s of shapes || []) {
    if (!s || !s.pts || !s.pts.length) continue;
    const pts = s.pts.map((p) => [p[0] * sx, p[1] * sy]);
    const value = s.mode === "sub" ? 0 : 255;
    if (s.r) stampStroke(mask, w, h, pts, s.r * Math.max(sx, sy), value);
    else fillPolygon(mask, w, h, pts, value);
  }
  return mask;
}

// ---- Morphology (van Herk / Gil-Werman, O(n) per line) ----------------------

function lineFilter(src, dst, n, stride, offset, r, isMax, pad, g, hh) {
  const k = 2 * r + 1;
  const N = n + 2 * r;
  const neutral = isMax ? 0 : 255;
  for (let i = 0; i < N; i++) {
    const s = i - r;
    pad[i] = s >= 0 && s < n ? src[offset + s * stride] : neutral;
  }
  for (let i = 0; i < N; i++) {
    const v = pad[i];
    if (i % k === 0) g[i] = v;
    else g[i] = isMax ? (v > g[i - 1] ? v : g[i - 1]) : v < g[i - 1] ? v : g[i - 1];
  }
  for (let i = N - 1; i >= 0; i--) {
    const v = pad[i];
    if (i === N - 1 || (i + 1) % k === 0) hh[i] = v;
    else hh[i] = isMax ? (v > hh[i + 1] ? v : hh[i + 1]) : v < hh[i + 1] ? v : hh[i + 1];
  }
  for (let i = 0; i < n; i++) {
    const a = hh[i];
    const b = g[i + 2 * r];
    dst[offset + i * stride] = isMax ? (a > b ? a : b) : a < b ? a : b;
  }
}

function morph(src, w, h, r, isMax) {
  r = Math.max(0, Math.round(r));
  if (!r) return new Uint8Array(src);
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  const L = Math.max(w, h) + 2 * r;
  const pad = new Uint8Array(L);
  const g = new Uint8Array(L);
  const hh = new Uint8Array(L);
  for (let y = 0; y < h; y++) lineFilter(src, tmp, w, 1, y * w, r, isMax, pad, g, hh);
  for (let x = 0; x < w; x++) lineFilter(tmp, out, h, w, x, r, isMax, pad, g, hh);
  return out;
}

export function dilate(mask, w, h, r) {
  return morph(mask, w, h, r, true);
}

export function erode(mask, w, h, r) {
  return morph(mask, w, h, r, false);
}

/** Close small gaps: dilate then erode. */
export function closeMask(mask, w, h, r) {
  return erode(dilate(mask, w, h, r), w, h, r);
}

// ---- Blur ---------------------------------------------------------------------

function boxLine(src, dst, n, stride, offset, r) {
  const k = 2 * r + 1;
  let acc = 0;
  for (let i = -r; i <= r; i++) acc += src[offset + clamp(i, 0, n - 1) * stride];
  for (let i = 0; i < n; i++) {
    dst[offset + i * stride] = acc / k;
    const add = src[offset + clamp(i + r + 1, 0, n - 1) * stride];
    const sub = src[offset + clamp(i - r, 0, n - 1) * stride];
    acc += add - sub;
  }
}

/** Separable box blur (edge-clamped); several passes approximate a Gaussian. */
export function boxBlur(src, w, h, r, passes) {
  r = Math.max(0, Math.round(r));
  passes = passes || 1;
  let a = Float32Array.from(src);
  if (!r) return a;
  let b = new Float32Array(w * h);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) boxLine(a, b, w, 1, y * w, r);
    for (let x = 0; x < w; x++) boxLine(b, a, h, w, x, r);
  }
  return a;
}

// ---- Measurements -------------------------------------------------------------

export function maskStats(mask, w, h) {
  let count = 0;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (mask[row + x] >= 128) {
        count++;
        sx += x;
        sy += y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return {
    count,
    frac: count / (w * h),
    minX,
    minY,
    maxX,
    maxY,
    cx: count ? sx / count : 0,
    cy: count ? sy / count : 0,
    empty: count === 0,
  };
}

/** Pixels in a band outside the mask: dilate(rOut) AND NOT dilate(rIn). */
export function ringMask(mask, w, h, rIn, rOut) {
  const outer = dilate(mask, w, h, rOut);
  const inner = rIn > 0 ? dilate(mask, w, h, rIn) : mask;
  const ring = new Uint8Array(w * h);
  for (let i = 0; i < ring.length; i++) ring[i] = outer[i] >= 128 && inner[i] < 128 ? 255 : 0;
  return ring;
}

/**
 * Estimate the eaves line (the lowest edge of the roof) and roof height.
 * Robust line fit (RANSAC) through the bottom-most roof pixel of each column.
 * Returns { angle (radians, clamped to +-15deg), a, b (y = a*x + b), roofH }.
 */
export function fitEaves(mask, w, h, stats) {
  const st = stats || maskStats(mask, w, h);
  if (st.empty) return { angle: 0, a: 0, b: h, roofH: h / 3 };
  const pts = [];
  const heights = [];
  const step = Math.max(1, Math.floor((st.maxX - st.minX + 1) / 160));
  for (let x = st.minX; x <= st.maxX; x += step) {
    let top = -1;
    let bottom = -1;
    for (let y = st.minY; y <= st.maxY; y++) {
      if (mask[y * w + x] >= 128) {
        if (top < 0) top = y;
        bottom = y;
      }
    }
    if (bottom >= 0) {
      pts.push([x, bottom]);
      heights.push(bottom - top + 1);
    }
  }
  heights.sort((p, q) => p - q);
  const roofH = Math.max(8, heights[Math.floor(heights.length * 0.75)] || st.maxY - st.minY);
  if (pts.length < 2) return { angle: 0, a: 0, b: st.maxY, roofH };

  // Deterministic RANSAC: try pairs spread across the roof.
  const tol = Math.max(3, roofH * 0.03);
  let best = { a: 0, b: st.maxY, inliers: -1 };
  const n = pts.length;
  const tries = Math.min(300, (n * (n - 1)) / 2);
  for (let t = 0; t < tries; t++) {
    const i = (t * 7919) % n;
    const j = (t * 104729 + 13) % n;
    if (i === j) continue;
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[j];
    if (Math.abs(x2 - x1) < (st.maxX - st.minX) * 0.15) continue;
    const a = (y2 - y1) / (x2 - x1);
    if (Math.abs(a) > 0.6) continue;
    const b = y1 - a * x1;
    let inl = 0;
    for (const [x, y] of pts) if (Math.abs(a * x + b - y) <= tol) inl++;
    if (inl > best.inliers) best = { a, b, inliers: inl };
  }
  // Refine with least squares on inliers.
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let m = 0;
  for (const [x, y] of pts) {
    if (Math.abs(best.a * x + best.b - y) <= tol) {
      sx += x;
      sy += y;
      sxx += x * x;
      sxy += x * y;
      m++;
    }
  }
  let a = best.a;
  let b = best.b;
  if (m >= 2) {
    const den = m * sxx - sx * sx;
    if (Math.abs(den) > 1e-6) {
      a = (m * sxy - sx * sy) / den;
      b = (sy - a * sx) / m;
    }
  }
  const lim = Math.tan((15 * Math.PI) / 180);
  a = clamp(a, -lim, lim);
  return { angle: Math.atan(a), a, b, roofH };
}

/** Feathered compositing alpha (0..1) for a mask: eroded, then softened. */
export function featherAlpha(mask, w, h) {
  const f = Math.max(1, Math.round(0.0018 * Math.max(w, h)));
  const er = erode(mask, w, h, Math.floor(f / 2));
  const src = new Float32Array(w * h);
  for (let i = 0; i < src.length; i++) src[i] = er[i] / 255;
  return boxBlur(src, w, h, f, 3);
}

/** Intersection-over-union of two masks (used by the self-test and QA). */
export function iou(a, b) {
  let inter = 0;
  let uni = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] >= 128;
    const y = b[i] >= 128;
    if (x && y) inter++;
    if (x || y) uni++;
  }
  return uni ? inter / uni : 1;
}
