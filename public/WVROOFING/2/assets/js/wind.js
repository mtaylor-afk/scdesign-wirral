// WV Roofing v2 — the wind. One smooth "gust" number that everything leans on:
// the rain's angle, the clouds' drift, the headline's sway. It is two octaves
// of one-dimensional value noise (a slow swell of about 0.25 Hz with a quicker
// flutter on top), so it never jumps and it never repeats in a way you notice.
// Pure maths: the same time always gives the same gust, in a browser or in Node.

const BASE_HZ = 0.25;
const FLUTTER_HZ = 0.61;
const BASE_WEIGHT = 0.7;
const FLUTTER_WEIGHT = 0.3;
const SEED_BASE = 0x2f6b1d;
const SEED_FLUTTER = 0x51c0de;

/** A fixed pseudo-random value in [-1, 1] for a whole-number position. */
function lattice(i, seed) {
  let h = Math.imul((i | 0) ^ seed, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca77);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae3d);
  h ^= h >>> 16;
  return (h >>> 0) / 2147483647.5 - 1;
}

/** One octave of value noise at position x, in [-1, 1]. */
function octave(x, seed) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = lattice(i, seed);
  const b = lattice(i + 1, seed);
  return a + (b - a) * u;
}

/**
 * The gust at a moment in time.
 * @param {number} [t] milliseconds (defaults to performance.now())
 * @returns {number} a smooth value in [-1, 1]; the same t always gives the same answer
 */
export function wind(t) {
  let ms = t;
  if (ms === undefined) ms = typeof performance !== "undefined" ? performance.now() : 0;
  if (typeof ms !== "number" || !Number.isFinite(ms)) return 0;
  const s = ms / 1000;
  const v = BASE_WEIGHT * octave(s * BASE_HZ, SEED_BASE) + FLUTTER_WEIGHT * octave(s * FLUTTER_HZ + 19.19, SEED_FLUTTER);
  // A gentle S-curve: gusts reach further towards the ends without ever leaving [-1, 1].
  const g = v * (1.5 - 0.5 * v * v);
  return g < -1 ? -1 : g > 1 ? 1 : g;
}
