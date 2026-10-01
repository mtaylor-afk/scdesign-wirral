// WV Roofing v2 — the weather deck: a cheap colour grade for a whole preview
// (as shot, sun, drizzle, storm, dusk) plus a wet-roof sheen applied only where
// the roof alpha says so. Pure maths on RGBA pixels, so it runs in the worker.
// These are moods, not physics and not a forecast.
//
// A grade is { gain: [r, g, b], gamma, lift, sat, wet, vignette }:
//   gain      per-channel multiplier (warm = more red, cool = more blue)
//   gamma     < 1 brightens the mid-tones, > 1 darkens them
//   lift      adds a little to the shadows (haze, overcast flatness)
//   sat       1 = as is, < 1 muted, > 1 punchier
//   wet       0..1 how glossy the roof looks (darker, more contrast, a sheen from the shade map)
//   vignette  0..1 how far the corners sink (storm light)
//   weather   what the rain engine should do with this mood (weather.js setState)

/** The moods offered on the weather deck, in display order. */
export const CONDITIONS = [
  { id: "noon", name: "As shot", gain: [1, 1, 1], gamma: 1, lift: 0, sat: 1, wet: 0, vignette: 0, weather: { rain: 0, cloud: 0, storm: 0, warm: 0 } },
  { id: "sun", name: "Sun", gain: [1.1, 0.97, 0.84], gamma: 0.94, lift: 0.02, sat: 1.12, wet: 0, vignette: 0, weather: { rain: 0, cloud: 0, storm: 0, warm: 0 } },
  { id: "drizzle", name: "Drizzle", gain: [0.93, 0.97, 1.04], gamma: 1.05, lift: 0.05, sat: 0.8, wet: 0.7, vignette: 0.1, weather: { rain: 0.5, cloud: 0, storm: 0, warm: 0 } },
  { id: "storm", name: "Storm", gain: [0.74, 0.8, 0.95], gamma: 1.22, lift: 0.02, sat: 0.62, wet: 1, vignette: 0.45, weather: { rain: 1, cloud: 0, storm: 1, warm: 0 } },
  { id: "dusk", name: "Dusk", gain: [0.8, 0.78, 0.98], gamma: 1.28, lift: 0.03, sat: 0.9, wet: 0, vignette: 0.25, weather: { rain: 0.06, cloud: 0, storm: 0, warm: 1 } },
];

export function conditionById(id) {
  return CONDITIONS.find((c) => c.id === id) || CONDITIONS[0];
}

const LUT_CACHE = new Map();

/** Three 256-entry lookup tables for a grade (cached by its numbers). */
function lutsFor(g) {
  const key = g.gain.join(",") + "|" + g.gamma + "|" + g.lift;
  let luts = LUT_CACHE.get(key);
  if (luts) return luts;
  luts = [0, 1, 2].map((c) => {
    const t = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      const v = Math.pow(i / 255, g.gamma) * g.gain[c] + g.lift;
      t[i] = Math.round(Math.max(0, Math.min(1, v)) * 255);
    }
    return t;
  });
  LUT_CACHE.set(key, luts);
  return luts;
}

/**
 * Grade a copy of the pixels. `alpha` (0..1 per pixel, the feathered roof) and
 * `analysis` (its shading map over the roof's box) are only needed for wet.
 * @param {Uint8ClampedArray} px RGBA
 * @param {number} w
 * @param {number} h
 * @param {object} grade one of CONDITIONS
 * @param {{alpha?:Float32Array, analysis?:{bx:number,by:number,bw:number,bh:number,shade:Float32Array}}} [roof]
 * @returns {Uint8ClampedArray}
 */
export function gradePixels(px, w, h, grade, roof) {
  const g = grade || CONDITIONS[0];
  const out = new Uint8ClampedArray(px);
  const identity = g.gain[0] === 1 && g.gain[1] === 1 && g.gain[2] === 1 && g.gamma === 1 && g.lift === 0 && g.sat === 1;
  if (!identity) {
    const [lr, lg, lb] = lutsFor(g);
    const s = g.sat;
    for (let i = 0; i < out.length; i += 4) {
      let r = lr[out[i]];
      let gg = lg[out[i + 1]];
      let b = lb[out[i + 2]];
      if (s !== 1) {
        const l = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
        r = l + (r - l) * s;
        gg = l + (gg - l) * s;
        b = l + (b - l) * s;
      }
      out[i] = r;
      out[i + 1] = gg;
      out[i + 2] = b;
    }
  }
  if (g.wet && roof && roof.alpha && roof.analysis) {
    const A = roof.analysis;
    const wet = g.wet;
    for (let y = 0; y < A.bh; y++) {
      const gy = y + A.by;
      for (let x = 0; x < A.bw; x++) {
        const gx = x + A.bx;
        const gi = gy * w + gx;
        const a = roof.alpha[gi];
        if (a <= 0.003) continue;
        // Wet slate: darker, punchier, and the lit slopes pick up a sky-coloured sheen.
        const sh = A.shade[y * A.bw + x];
        const sheen = Math.max(0, sh - 1.05) * 90 * wet;
        const k = 1 - 0.18 * wet;
        const i4 = gi * 4;
        for (let c = 0; c < 3; c++) {
          const v = out[i4 + c];
          const contrasted = 128 + (v - 128) * (1 + 0.25 * wet);
          const tinted = contrasted * k + sheen * (c === 2 ? 1.15 : 1);
          out[i4 + c] = v + a * (tinted - v);
        }
      }
    }
  }
  if (g.vignette) {
    // Separable falloff: one table across, one down (no per-pixel square roots).
    const vx = new Float32Array(w);
    const vy = new Float32Array(h);
    for (let x = 0; x < w; x++) {
      const d = (x / (w - 1 || 1)) * 2 - 1;
      vx[x] = d * d;
    }
    for (let y = 0; y < h; y++) {
      const d = (y / (h - 1 || 1)) * 2 - 1;
      vy[y] = d * d;
    }
    const v = g.vignette;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = 1 - v * Math.min(1, 0.55 * (vx[x] + vy[y]));
        const i4 = (y * w + x) * 4;
        out[i4] *= k;
        out[i4 + 1] *= k;
        out[i4 + 2] *= k;
      }
    }
  }
  return out;
}
