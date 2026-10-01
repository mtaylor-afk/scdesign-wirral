// @ts-nocheck -- browser ES module shared with the Node tests; outside the JSDoc type check.
// WV Roofing v2 — the Roof Cam's "tap your roof" automatic outline. It runs on
// the visitor's device (nothing here talks to a server).
//
// In plain English:
//   1. Shrink the photo to about 360 px on its long edge (box filter). That
//      keeps a tap to a fraction of a second, and it smooths the tile texture
//      away so we see slopes, not tiles. The shrunk photo and its features are
//      kept for each photo, so Tighter, Looser and more taps only re-grow.
//   2. Starting at the tapped pixel, grow a region outwards (breadth-first),
//      accepting a neighbour only when: (a) its colour balance (chromaticity) is
//      close to the tapped spot's — a roof keeps its hue while the shading
//      changes; (b) its brightness is continuous with the pixel it grew from —
//      gentle shading is followed, a hard jump is not; and (c) it is not sitting
//      on a strong edge. Thin bright or dark lines (ridge tiles, hips) are
//      stepped over when the pixel just beyond them still matches.
//   3. Nobody knows the right tolerance in advance, so a ladder of them is
//      tried and the loosest one before the region suddenly balloons wins: a
//      roof grows steadily as the tolerance loosens, a leak into the wall or
//      the sky is a jump. (A tap that lands on a ridge line is first slid to
//      the flattest spot nearby.)
//   4. Tidy up: open (cuts thin leaks such as gutters), keep the piece under the
//      tap, close (fills small gaps), fill tiny holes, and keep larger holes
//      (chimneys, roof windows) as cut-outs.
//   5. Trace the outline and the holes, simplify them (Douglas-Peucker, keeping
//      the extreme points so the bounding box is exact), scale back to photo
//      pixels and hand them over as editor shapes (see mask-editor setShapes).
//   6. Score confidence from how strong the edges are along the outline, how
//      much of the outline runs off the edge of the photo, the size of the
//      region and how stable the chosen tolerance was. A tap on a wall or the
//      sky gives a low confidence with a plain-English reason, never a throw.
// Pure maths on {data,width,height} — no DOM, so it is testable in Node.
import { buildMask, dilate, erode, closeMask } from "./mask-ops.js";

const TARGET_LONG_EDGE = 360;
/** The tolerance ladder, tightest first: the Roof Cam's Tighter and Looser step along it. */
export const TOLERANCES = Object.freeze([0.08, 0.11, 0.15, 0.2, 0.26, 0.34, 0.44, 0.56, 0.7, 0.86]);
const MAX_POINTS = 48;

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// ---- 1. Downscale + features -------------------------------------------------

/** Box-filter the RGBA photo down to sw x sh; returns Float32 r, g, b planes. */
function downscale(photo, sw, sh) {
  const W = photo.width;
  const H = photo.height;
  const d = photo.data;
  const n = sw * sh;
  const R = new Float32Array(n);
  const G = new Float32Array(n);
  const B = new Float32Array(n);
  const xb = new Int32Array(sw + 1);
  const yb = new Int32Array(sh + 1);
  for (let x = 0; x <= sw; x++) xb[x] = Math.min(W, Math.floor((x * W) / sw));
  for (let y = 0; y <= sh; y++) yb[y] = Math.min(H, Math.floor((y * H) / sh));
  for (let oy = 0; oy < sh; oy++) {
    const y0 = yb[oy];
    const y1 = Math.max(y0 + 1, yb[oy + 1]);
    for (let ox = 0; ox < sw; ox++) {
      const x0 = xb[ox];
      const x1 = Math.max(x0 + 1, xb[ox + 1]);
      let r = 0;
      let g = 0;
      let b = 0;
      let c = 0;
      for (let y = y0; y < y1; y++) {
        let i = (y * W + x0) * 4;
        for (let x = x0; x < x1; x++, i += 4) {
          r += d[i];
          g += d[i + 1];
          b += d[i + 2];
          c++;
        }
      }
      const o = oy * sw + ox;
      R[o] = r / c;
      G[o] = g / c;
      B[o] = b / c;
    }
  }
  return { R, G, B };
}

/**
 * Luma, chromaticity (r and g shares of r+g+b, pulled towards grey for very
 * dark pixels where the shares are just noise) and a Sobel gradient of luma.
 */
function features(R, G, B, w, h) {
  const n = w * h;
  const L = new Float32Array(n);
  const CR = new Float32Array(n);
  const CG = new Float32Array(n);
  const FLOOR = 60;
  for (let i = 0; i < n; i++) {
    const r = R[i];
    const g = G[i];
    const b = B[i];
    L[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const s = r + g + b;
    const k = s < FLOOR ? FLOOR : s;
    const pad = (k - s) / 3;
    CR[i] = (r + pad) / k;
    CG[i] = (g + pad) / k;
  }
  const GR = new Float32Array(n);
  if (w >= 3 && h >= 3) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1];
        const gy = L[i + w - 1] + 2 * L[i + w] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - w] - L[i - w + 1];
        GR[i] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    // Replicate the gradient onto the one-pixel frame.
    for (let x = 0; x < w; x++) {
      GR[x] = GR[w + Math.min(w - 2, Math.max(1, x))];
      GR[(h - 1) * w + x] = GR[(h - 2) * w + Math.min(w - 2, Math.max(1, x))];
    }
    for (let y = 0; y < h; y++) {
      GR[y * w] = GR[y * w + 1];
      GR[y * w + w - 1] = GR[y * w + w - 2];
    }
  }
  return { L, CR, CG, GR };
}

// The shrunk photo's features, kept per photo. Keyed on the pixel array, so a
// new photo (a new array) starts afresh and an old one is let go with its
// pixels. The pixels must not be changed in place between calls.
const featureCache = new WeakMap();

function photoFeatures(photo, w, h) {
  const key = photo.data;
  const cacheable = key !== null && typeof key === "object";
  if (cacheable) {
    const hit = featureCache.get(key);
    if (hit && hit.W === photo.width && hit.H === photo.height && hit.w === w && hit.h === h) return hit.F;
  }
  const { R, G, B } = downscale(photo, w, h);
  const F = features(R, G, B, w, h);
  if (cacheable) featureCache.set(key, { W: photo.width, H: photo.height, w, h, F });
  return F;
}

// ---- 2. Region growing --------------------------------------------------------

/** Thresholds for a tolerance t in 0..1. */
function thresholds(t) {
  return {
    tolC: 0.018 + 0.1 * t, // chromaticity distance to the tapped spot
    tolL: 5 + 50 * t, // luma step to the pixel we grow from
    tolG: 40 + 280 * t, // Sobel magnitude that counts as an edge
  };
}

/**
 * Breadth-first growth from the seed. Writes 1 into `lab` for accepted pixels
 * and returns the count. `queue` is scratch space of length w*h.
 */
function grow(F, w, h, seed, ref, t, lab, queue) {
  const { L, CR, CG, GR } = F;
  const { tolC, tolL, tolG } = thresholds(t);
  const tolC2 = tolC * tolC;
  const cr0 = ref.cr;
  const cg0 = ref.cg;
  lab.fill(0);
  let head = 0;
  let tail = 0;
  queue[tail++] = seed;
  lab[seed] = 1;
  let count = 1;
  const DX = [1, -1, 0, 0];
  const DY = [0, 0, 1, -1];
  const STEP = [1, -1, w, -w];
  while (head < tail) {
    const p = queue[head++];
    const px = p % w;
    const py = (p - px) / w;
    const lp = L[p];
    for (let k = 0; k < 4; k++) {
      const nx = px + DX[k];
      const ny = py + DY[k];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const q = p + STEP[k];
      if (lab[q]) continue;
      const dr = CR[q] - cr0;
      const dg = CG[q] - cg0;
      const chromaOk = dr * dr + dg * dg <= tolC2;
      const lumaOk = Math.abs(L[q] - lp) <= tolL;
      if (chromaOk && lumaOk && GR[q] <= tolG) {
        lab[q] = 1;
        queue[tail++] = q;
        count++;
        continue;
      }
      // Blocked by an edge: try to step over a thin line (1-2 px at this scale)
      // when the pixel just beyond it still looks like the pixel we came from.
      if (GR[q] > tolG || !lumaOk) {
        for (let j = 2; j <= 3; j++) {
          const jx = px + DX[k] * j;
          const jy = py + DY[k] * j;
          if (jx < 0 || jy < 0 || jx >= w || jy >= h) break;
          const q2 = p + STEP[k] * j;
          if (lab[q2]) break;
          const dr2 = CR[q2] - cr0;
          const dg2 = CG[q2] - cg0;
          if (dr2 * dr2 + dg2 * dg2 <= tolC2 && Math.abs(L[q2] - lp) <= tolL && GR[q2] <= tolG) {
            // Accept the far pixel and the line pixels between (they are part of the roof).
            for (let m = 1; m <= j; m++) {
              const qm = p + STEP[k] * m;
              if (!lab[qm]) {
                lab[qm] = 1;
                count++;
                if (m === j) queue[tail++] = qm;
              }
            }
            break;
          }
        }
      }
    }
  }
  return count;
}

// ---- 3-4. Components and holes -----------------------------------------------

/**
 * Label connected components of `mask` (>=128) in scan order (so component 1
 * has the top-left-most start pixel). Returns { lab, count, starts, areas }.
 */
function labelComponents(mask, w, h, conn8, queue) {
  const n = w * h;
  const lab = new Int32Array(n);
  const starts = [];
  const areas = [];
  let count = 0;
  for (let s = 0; s < n; s++) {
    if (mask[s] < 128 || lab[s]) continue;
    count++;
    let head = 0;
    let tail = 0;
    queue[tail++] = s;
    lab[s] = count;
    let area = 0;
    while (head < tail) {
      const p = queue[head++];
      area++;
      const px = p % w;
      const py = (p - px) / w;
      const x0 = px > 0 ? -1 : 0;
      const x1 = px < w - 1 ? 1 : 0;
      const y0 = py > 0 ? -1 : 0;
      const y1 = py < h - 1 ? 1 : 0;
      for (let dy = y0; dy <= y1; dy++) {
        for (let dx = x0; dx <= x1; dx++) {
          if (!dx && !dy) continue;
          if (!conn8 && dx && dy) continue;
          const q = p + dy * w + dx;
          if (mask[q] >= 128 && !lab[q]) {
            lab[q] = count;
            queue[tail++] = q;
          }
        }
      }
    }
    starts.push(s);
    areas.push(area);
  }
  return { lab, count, starts, areas };
}

/** Background (4-connected) not reachable from the photo border = holes. */
function findHoles(mask, w, h, queue) {
  const n = w * h;
  const bg = new Uint8Array(n);
  for (let i = 0; i < n; i++) bg[i] = mask[i] >= 128 ? 0 : 255;
  const reached = new Uint8Array(n);
  let tail = 0;
  const push = (i) => {
    if (bg[i] && !reached[i]) {
      reached[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  let head = 0;
  while (head < tail) {
    const p = queue[head++];
    const px = p % w;
    if (px > 0) push(p - 1);
    if (px < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p + w < n) push(p + w);
  }
  const holes = new Uint8Array(n);
  for (let i = 0; i < n; i++) holes[i] = bg[i] && !reached[i] ? 255 : 0;
  return holes;
}

// ---- 5. Contour tracing + simplification -------------------------------------

/**
 * Crack-following boundary trace. Walks the pixel edges of the region
 * described by isIn(x, y) keeping the region on the right, starting at the
 * top-left corner of its top-left-most pixel (sx, sy). conn8 treats
 * diagonally-touching pixels as connected (foreground); holes use 4-connectivity.
 * Returns corner coordinates (a pixel (x,y) spans [x,x+1] x [y,y+1]).
 */
function traceBoundary(isIn, w, h, sx, sy, conn8) {
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  const pts = [[sx, sy]];
  let x = sx;
  let y = sy;
  let d = 0;
  let guard = 4 * w * h + 16;
  for (;;) {
    x += DX[d];
    y += DY[d];
    let alx;
    let aly;
    let arx;
    let ary;
    if (d === 0) {
      arx = x;
      ary = y;
      alx = x;
      aly = y - 1;
    } else if (d === 1) {
      arx = x - 1;
      ary = y;
      alx = x;
      aly = y;
    } else if (d === 2) {
      arx = x - 1;
      ary = y - 1;
      alx = x - 1;
      aly = y;
    } else {
      arx = x;
      ary = y - 1;
      alx = x - 1;
      aly = y - 1;
    }
    const al = isIn(alx, aly);
    const ar = isIn(arx, ary);
    let nd;
    if (conn8 ? al : al && ar) nd = (d + 3) & 3;
    else if (ar) nd = d;
    else nd = (d + 1) & 3;
    if (x === sx && y === sy && nd === 0) break;
    if (nd !== d) pts.push([x, y]);
    d = nd;
    if (--guard < 0) break;
  }
  return pts;
}

/** Douglas-Peucker on an open polyline (both ends kept), iterative. */
function simplifyOpen(pts, eps) {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const e2 = eps * eps;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const ax = pts[a][0];
    const ay = pts[a][1];
    const dx = pts[b][0] - ax;
    const dy = pts[b][1] - ay;
    const len2 = dx * dx + dy * dy;
    let best = -1;
    let bestD = e2;
    for (let i = a + 1; i < b; i++) {
      const px = pts[i][0] - ax;
      const py = pts[i][1] - ay;
      let d2;
      if (len2 === 0) d2 = px * px + py * py;
      else {
        const cross = px * dy - py * dx;
        d2 = (cross * cross) / len2;
      }
      if (d2 > bestD) {
        bestD = d2;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

/**
 * Douglas-Peucker for a closed polygon. The extreme points (min/max x and y)
 * are always kept, so the simplified polygon has the same bounding box.
 */
function simplifyClosed(pts, eps) {
  const n = pts.length;
  if (n <= 3) return pts.slice();
  let iMinX = 0;
  let iMaxX = 0;
  let iMinY = 0;
  let iMaxY = 0;
  for (let i = 1; i < n; i++) {
    if (pts[i][0] < pts[iMinX][0]) iMinX = i;
    if (pts[i][0] > pts[iMaxX][0]) iMaxX = i;
    if (pts[i][1] < pts[iMinY][1]) iMinY = i;
    if (pts[i][1] > pts[iMaxY][1]) iMaxY = i;
  }
  const anchors = Array.from(new Set([iMinX, iMaxX, iMinY, iMaxY])).sort((a, b) => a - b);
  if (anchors.length < 2) return pts.slice(0, 3);
  const out = [];
  for (let k = 0; k < anchors.length; k++) {
    const a = anchors[k];
    const b = anchors[(k + 1) % anchors.length];
    const seg = [];
    for (let i = a; ; i = (i + 1) % n) {
      seg.push(pts[i]);
      if (i === b) break;
    }
    const s = simplifyOpen(seg, eps);
    for (let i = 0; i < s.length - 1; i++) out.push(s[i]);
  }
  return out;
}

/** Simplify a closed polygon to at most maxPts points, never fewer than 3. */
function simplifyCapped(raw, eps, maxPts) {
  let out = simplifyClosed(raw, eps);
  let e = eps;
  while (out.length > maxPts && e < 1e6) {
    e *= 1.4;
    out = simplifyClosed(raw, e);
  }
  if (out.length < 3) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of raw) {
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
    out = [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ];
  }
  return out;
}

/**
 * Raw contours of a mask: one outer polygon per 8-connected component (in scan
 * order of their top-left pixel) with that component's holes (4-connected
 * background not reachable from the border). Corner coordinates, unsimplified.
 */
function traceContours(mask, w, h) {
  const n = w * h;
  const queue = new Int32Array(n);
  const comps = labelComponents(mask, w, h, true, queue);
  const holes = findHoles(mask, w, h, queue);
  const hc = labelComponents(holes, w, h, false, queue);
  const out = [];
  const byComp = new Map();
  for (let i = 1; i <= comps.count; i++) byComp.set(i, []);
  for (let i = 1; i <= hc.count; i++) {
    const s = hc.starts[i - 1];
    // The pixel above a hole's top-left pixel is foreground: the surrounding component.
    const owner = s >= w ? comps.lab[s - w] : 0;
    if (owner) byComp.get(owner).push(i);
  }
  const compLab = comps.lab;
  const holeLab = hc.lab;
  for (let i = 1; i <= comps.count; i++) {
    const s = comps.starts[i - 1];
    const sx = s % w;
    const sy = (s - sx) / w;
    const isIn = (x, y) => x >= 0 && y >= 0 && x < w && y < h && compLab[y * w + x] === i;
    out.push({ mode: "add", pts: traceBoundary(isIn, w, h, sx, sy, true), area: comps.areas[i - 1] });
    for (const hid of byComp.get(i)) {
      const hs = hc.starts[hid - 1];
      const hx = hs % w;
      const hy = (hs - hx) / w;
      const inHole = (x, y) => x >= 0 && y >= 0 && x < w && y < h && holeLab[y * w + x] === hid;
      out.push({ mode: "sub", pts: traceBoundary(inHole, w, h, hx, hy, false), area: hc.areas[hid - 1] });
    }
  }
  return out;
}

/**
 * Trace a 0/255 mask into editor shapes: outer contours as "add" polygons and
 * holes as "sub" polygons (in an order buildMask reproduces), each simplified
 * with Douglas-Peucker at `epsilon` pixels and capped at 48 points.
 * @param {Uint8Array} mask
 * @param {number} w
 * @param {number} h
 * @param {number} epsilon
 * @returns {Array<{mode:"add"|"sub", pts:number[][]}>}
 */
export function traceMask(mask, w, h, epsilon) {
  if (!mask || !w || !h) return [];
  const eps = epsilon === undefined ? 0.006 * Math.max(w, h) : Math.max(0, epsilon);
  return traceContours(mask, w, h).map((c) => ({ mode: c.mode, pts: simplifyCapped(c.pts, eps, MAX_POINTS) }));
}

// ---- 6. The suggestion --------------------------------------------------------

function emptyResult(W, H, reason, tolerance) {
  return { shapes: [], mask: new Uint8Array(W * H), frac: 0, confidence: 0, reason, tolerance: tolerance === undefined ? TOLERANCES[4] : tolerance };
}

/**
 * Suggest a roof outline from one tap.
 * @param {{data:Uint8ClampedArray, width:number, height:number}} photo RGBA pixels
 * @param {number[]} seed [x, y] in photo pixels
 * @param {{tolerance?:number, maxFrac?:number, minFrac?:number, onScan?:(scan:object)=>void}} [opts]
 *   tolerance 0..1 (omit to let the ladder pick the most stable one); onScan, for tests and
 *   tuning, receives the area found at every rung of the ladder.
 * @returns {{shapes:Array<{mode:"add"|"sub",pts:number[][]}>, mask:Uint8Array, frac:number, confidence:number, reason:string, tolerance:number}}
 */
export function suggestRoof(photo, seed, opts) {
  opts = opts || {};
  const W = photo ? photo.width | 0 : 0;
  const H = photo ? photo.height | 0 : 0;
  if (!photo || !photo.data || W < 2 || H < 2 || photo.data.length < W * H * 4) {
    return emptyResult(Math.max(0, W), Math.max(0, H), "no usable photo");
  }
  const maxFrac = opts.maxFrac === undefined ? 0.6 : opts.maxFrac;
  const minFrac = opts.minFrac === undefined ? 0.01 : opts.minFrac;
  const sxIn = Number(seed && seed[0]);
  const syIn = Number(seed && seed[1]);
  const seedX = Math.min(W - 1, Math.max(0, Math.floor(Number.isFinite(sxIn) ? sxIn : W / 2)));
  const seedY = Math.min(H - 1, Math.max(0, Math.floor(Number.isFinite(syIn) ? syIn : H / 2)));

  // 1. Downscale (once per photo: see photoFeatures).
  const long = Math.max(W, H);
  const scale = long > TARGET_LONG_EDGE ? TARGET_LONG_EDGE / long : 1;
  const w = Math.max(2, Math.round(W * scale));
  const h = Math.max(2, Math.round(H * scale));
  const n = w * h;
  const kx = W / w;
  const ky = H / h;
  const F = photoFeatures(photo, w, h);
  let sx = Math.min(w - 1, Math.floor(seedX / kx));
  let sy = Math.min(h - 1, Math.floor(seedY / ky));
  // A finger often lands on a ridge, a hip or a line of tiles: growing from a
  // line finds only the line. Slide the tap to the flattest spot close by
  // (within about 1.5% of the picture), preferring nearer spots.
  {
    const r = Math.max(2, Math.round(0.015 * Math.max(w, h)));
    const here = F.GR[sy * w + sx];
    let best = here;
    let bx = sx;
    let by = sy;
    for (let y = Math.max(0, sy - r); y <= Math.min(h - 1, sy + r); y++) {
      for (let x = Math.max(0, sx - r); x <= Math.min(w - 1, sx + r); x++) {
        const d2 = (x - sx) * (x - sx) + (y - sy) * (y - sy);
        if (d2 > r * r) continue;
        const g = F.GR[y * w + x] * (1 + (0.6 * d2) / (r * r));
        if (g < best) {
          best = g;
          bx = x;
          by = y;
        }
      }
    }
    if (best < here * 0.7) {
      sx = bx;
      sy = by;
    }
  }
  const seedIdx = sy * w + sx;

  // Reference chromaticity: a small window round the tap.
  let cr = 0;
  let cg = 0;
  let cnt = 0;
  for (let y = Math.max(0, sy - 1); y <= Math.min(h - 1, sy + 1); y++) {
    for (let x = Math.max(0, sx - 1); x <= Math.min(w - 1, sx + 1); x++) {
      cr += F.CR[y * w + x];
      cg += F.CG[y * w + x];
      cnt++;
    }
  }
  const ref = { cr: cr / cnt, cg: cg / cnt };

  // 2-3. Grow at one tolerance, or scan for the most stable one.
  const queue = new Int32Array(n);
  const lab = new Uint8Array(n);
  let tol;
  let stability = 0; // relative change of area between neighbouring tolerances
  let inRange = true;
  if (opts.tolerance !== undefined && Number.isFinite(opts.tolerance)) {
    tol = clamp01(opts.tolerance);
    grow(F, w, h, seedIdx, ref, tol, lab, queue);
  } else {
    const areas = TOLERANCES.map((t) => grow(F, w, h, seedIdx, ref, t, lab, queue));
    // Walk up the ladder and take the loosest rung before the region suddenly
    // balloons (more than LEAK times the rung before): a roof grows steadily as
    // the tolerance loosens; a leak into the walls or the sky is a jump.
    // (Measured on the sample houses: this beat "the most stable rung".)
    const LEAK = 2.2;
    const cap = Math.min(maxFrac, 0.4);
    let best = -1;
    const last = TOLERANCES.length - 1;
    for (let i = 0; i <= last; i++) {
      const fr = areas[i] / n;
      if (fr < minFrac) continue;
      if (fr > cap) break;
      if (best >= 0 && areas[i] > LEAK * areas[best]) break;
      best = i;
    }
    let bestScore = 0;
    if (best >= 0) {
      // How much the region changes around the chosen rung feeds the confidence.
      const prev = best > 0 && areas[best - 1] / n >= minFrac ? Math.abs(areas[best] - areas[best - 1]) / areas[best] : 0.15;
      const next = best < last ? Math.abs(areas[best + 1] - areas[best]) / areas[best] : 0.15;
      bestScore = Math.min(prev, next) + 0.01 * best;
    }
    if (best < 0) {
      // Nothing in range: take the tolerance whose area is nearest the range.
      inRange = false;
      let bestDist = Infinity;
      for (let i = 0; i <= last; i++) {
        const fr = Math.max(1e-9, areas[i] / n);
        const dist = fr < minFrac ? Math.log(minFrac / fr) : fr > maxFrac ? Math.log(fr / maxFrac) : 0;
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }
      stability = 1;
    } else {
      stability = Math.min(1, bestScore - 0.01 * best);
    }
    tol = TOLERANCES[best];
    if (typeof opts.onScan === "function") opts.onScan({ fracs: areas.map((a) => +(a / n).toFixed(4)), best, tol, stability: +stability.toFixed(3) });
    grow(F, w, h, seedIdx, ref, tol, lab, queue);
  }

  // 4. Clean up.
  let m = new Uint8Array(n);
  for (let i = 0; i < n; i++) m[i] = lab[i] ? 255 : 0;
  const r1 = Math.max(1, Math.round(0.005 * Math.max(w, h)));
  let opened = dilate(erode(m, w, h, r1), w, h, r1);
  let comps = labelComponents(opened, w, h, true, queue);
  let keep = comps.lab[seedIdx];
  if (!keep && comps.count) {
    // The tap sat on a sliver the opening removed: nearest opened pixel, else the largest piece.
    let bestD = Infinity;
    for (let y = Math.max(0, sy - 3 * r1); y <= Math.min(h - 1, sy + 3 * r1); y++) {
      for (let x = Math.max(0, sx - 3 * r1); x <= Math.min(w - 1, sx + 3 * r1); x++) {
        const l = comps.lab[y * w + x];
        if (!l) continue;
        const dd = (x - sx) * (x - sx) + (y - sy) * (y - sy);
        if (dd < bestD) {
          bestD = dd;
          keep = l;
        }
      }
    }
    if (!keep) {
      let bestA = -1;
      for (let i = 0; i < comps.count; i++) if (comps.areas[i] > bestA) {
        bestA = comps.areas[i];
        keep = i + 1;
      }
    }
  }
  // Opening is meant to cut thin leaks off. On a stripy roof (Roman tiles,
  // pantiles) it can instead chop the roof itself into slivers; when the piece
  // it would keep is under 40% of what was found, keep the region whole.
  let rawArea = 0;
  for (let i = 0; i < n; i++) if (m[i]) rawArea++;
  if (keep && comps.areas[keep - 1] < 0.4 * rawArea) keep = 0;
  if (!keep) {
    // Opening wiped the tapped piece: fall back to the raw region under the tap.
    opened = m;
    comps = labelComponents(opened, w, h, true, queue);
    keep = comps.lab[seedIdx];
  }
  if (!keep) return emptyResult(W, H, "no area found around the tap", tol);
  for (let i = 0; i < n; i++) m[i] = comps.lab[i] === keep ? 255 : 0;
  m = closeMask(m, w, h, r1);
  // Closing can rejoin a neighbour: keep the tap's piece once more.
  comps = labelComponents(m, w, h, true, queue);
  keep = comps.lab[seedIdx] || keep;
  if (comps.count > 1) {
    const k2 = comps.lab[seedIdx];
    if (k2) for (let i = 0; i < n; i++) m[i] = comps.lab[i] === k2 ? 255 : 0;
  }
  let area = 0;
  for (let i = 0; i < n; i++) if (m[i]) area++;
  // Fill tiny holes; larger ones (chimneys, roof windows) stay as cut-outs.
  const holes = findHoles(m, w, h, queue);
  const hc = labelComponents(holes, w, h, false, queue);
  const holeMin = Math.max(6, 0.004 * area);
  for (let i = 0; i < n; i++) {
    const l = hc.lab[i];
    if (l && hc.areas[l - 1] < holeMin) {
      m[i] = 255;
      area++;
    }
  }

  // 6. Confidence, measured on the low-res mask.
  const GR = F.GR;
  let edgeSum = 0;
  let edgeN = 0;
  let inSum = 0;
  let inN = 0;
  let borderN = 0;
  let outlineN = 0;
  let lumaSum = 0;
  let crSum = 0;
  let cgSum = 0;
  let topTouch = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!m[i]) continue;
      lumaSum += F.L[i];
      crSum += F.CR[i];
      cgSum += F.CG[i];
      const onBorder = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      let g = -1;
      if (x > 0 && !m[i - 1]) g = Math.max(g, GR[i - 1]);
      if (x < w - 1 && !m[i + 1]) g = Math.max(g, GR[i + 1]);
      if (y > 0 && !m[i - w]) g = Math.max(g, GR[i - w]);
      if (y < h - 1 && !m[i + w]) g = Math.max(g, GR[i + w]);
      if (g >= 0 || onBorder) {
        outlineN++;
        if (onBorder) {
          borderN++;
          if (y === 0) topTouch++;
        }
        if (g >= 0) {
          edgeSum += Math.max(g, GR[i]);
          edgeN++;
        }
      } else {
        inSum += GR[i];
        inN++;
      }
    }
  }
  const meanEdge = edgeN ? edgeSum / edgeN : 0;
  const meanIn = inN ? inSum / inN : 0;
  const lowFrac = area / n;
  const borderFrac = outlineN ? borderN / outlineN : 0;
  const meanLuma = area ? lumaSum / area : 0;
  const meanCb = area ? 1 - crSum / area - cgSum / area : 1 / 3;

  const eStrength = clamp01(meanEdge / 150);
  const eContrast = clamp01((meanEdge / (meanIn + 8) - 1) / 2.5);
  const edgeScore = 0.5 * eStrength + 0.5 * eContrast;
  const stabilityScore = 1 - clamp01(stability / 0.5) * 0.6;
  const borderScore = 1 - clamp01(borderFrac / 0.3) * 0.8;
  let sizeScore = 1;
  if (!inRange) sizeScore = 0.1;
  else if (lowFrac < 0.03) sizeScore = Math.max(0.1, (lowFrac - minFrac) / Math.max(1e-6, 0.03 - minFrac));
  else if (lowFrac > 0.45) sizeScore = Math.max(0.1, (maxFrac - lowFrac) / Math.max(1e-6, maxFrac - 0.45));
  const skyLike = topTouch > 0 && (meanLuma > 185 || (meanCb > 0.36 && meanLuma > 110));
  let confidence = edgeScore * stabilityScore * borderScore * sizeScore;
  if (skyLike) confidence *= 0.4;
  confidence = Math.round(clamp01(confidence) * 100) / 100;

  const reasons = [];
  if (skyLike) reasons.push("looks like the sky");
  if (!inRange && lowFrac > maxFrac) reasons.push("very large area");
  else if (!inRange) reasons.push("very small area");
  else if (sizeScore < 0.75) reasons.push(lowFrac < 0.03 ? "very small area" : "very large area");
  if (borderFrac >= 0.15) reasons.push("touches the edge of the photo");
  if (edgeScore < 0.4) reasons.push("weak edges around the outline");
  if (stabilityScore < 0.75) reasons.push("the outline changes a lot with the tolerance");
  if (confidence < 0.5 && !reasons.length) reasons.push("the outline is uncertain");
  const reason = confidence < 0.6 || reasons.length > 1 ? reasons.join("; ") : "";

  // 5. Trace, scale back to photo pixels, simplify.
  const epsPhoto = 0.006 * long;
  const shapes = [];
  for (const c of traceContours(m, w, h)) {
    const raw = c.pts.map((p) => [p[0] * kx, p[1] * ky]);
    const pts = simplifyCapped(raw, epsPhoto, MAX_POINTS).map((p) => [
      Math.min(W, Math.max(0, Math.round(p[0]))),
      Math.min(H, Math.max(0, Math.round(p[1]))),
    ]);
    const dedup = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
    if (dedup.length >= 3) shapes.push({ mode: c.mode, pts: dedup });
  }
  const mask = buildMask(shapes, W, H, 1, 1);
  let count = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) count++;
  return { shapes, mask, frac: count / (W * H), confidence, reason, tolerance: tol };
}
