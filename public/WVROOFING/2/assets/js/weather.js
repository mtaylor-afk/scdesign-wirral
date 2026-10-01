// WV Roofing v2 — the atmospheric engine: rain that leans on a gusting wind and
// knows where the roof is (it lands on the roof, runs down it and drips off the
// eaves), drifting noise clouds, and lightning that is strictly rationed.
// Everything is drawn on one transparent canvas laid over a section of the page.
//
// The top half of this file is pure maths (the roof lookup, the rain's state
// machine, the bolt, the cloud texture) and runs in Node for testing. The
// Weather class at the bottom is the only part that touches a canvas, and it
// stops by itself when the tab is hidden, the canvas is off screen or the page
// is calm.
import { wind } from "./wind.js";
import { BUDGETS, isCalm, onCalmChange } from "./quality.js";

/** Particle states. */
export const FALLING = 0;
export const RUNNING = 1;
export const DRIPPING = 2;

const RAIN_RGB = [143, 212, 244]; // #8FD4F4
const DUSK_RGB = [233, 196, 98]; // #E9C462
const CLOUD_RGB = [58, 76, 118]; // #3A4C76
const CREAM_RGB = [245, 240, 232]; // #F5F0E8
const BOLT_GLOW = "rgba(143, 212, 244, 0.25)";
const BOLT_CORE = "#FFFFFF";

const FRAME_MS = 1000 / 60;
const MAX_STEP_MS = 50;
const LEAN_MAX = (14 * Math.PI) / 180;
const AREA_PER_DROP = 4500;
const MIN_DROPS = 120;
const BUDGET_FLOOR = 80;
const BUDGET_CUT = 0.7;
const SLOW_MS = 24;
const SLOW_RATIO = SLOW_MS / FRAME_MS;
const SLOW_WORK_MS = 12;
const SLOW_FOR_MS = 2000;
const PACE_BINS = 4;
const PACE_BIN_MS = 250;
const PACE_MIN_MS = 3;
const RECOVER_MS = 8000;
const CLOUD_FADE_MS = 1000;
const MAX_BITMAP = 3000000;

const BUCKET_ALPHA = [0.25, 0.45, 0.7];
const BUCKET_WIDTH = [1, 1.2, 1.5];
const BUCKET_PATTERN = [0, 1, 0, 2, 1, 0];
const EDGE_PAD = 24;
const RUN_FACTOR = 0.35;
const RUN_ALPHA = 0.5;
const RUN_LENGTH = 6;
const RUN_DRIFT = 30;
const DRIP_ALPHA = 0.6;
const DRIP_SECONDS = 0.6;
const DRIP_GRAVITY = 1800;
const SPLASH_SECONDS = 0.12;
const SPLASH_GRAVITY = 1500;
const SPLASH_SLOTS = 240;

const STRIKE_MIN_MS = 6000;
const STRIKE_MAX_MS = 14000;
// The flash lights the whole page, so the ration is the page's, not each canvas's:
// the last strike by any Weather on this page (rAF timestamps share one clock).
let lastStrikeAt = -Infinity;
const BOLT_SEGMENTS = 32;
const BRANCH_SEGMENTS = 8;
const FLASH_FRAMES = 3;

const CLOUD_W = 512;
const CLOUD_H = 256;
const CLOUD_SEEDS = [0x1a2b3c, 0x5d6e7f];
const CLOUD_TALL = [0.62, 0.85];
const CLOUD_WIDE = [1, 1.35];
const CLOUD_SPEED = [1, 0.55];
const CLOUD_ALPHA = [0.9, 0.6];

const WARM_STEPS = 32;
const RAIN_COLOURS = [];
for (let k = 0; k <= WARM_STEPS; k++) {
  const t = k / WARM_STEPS;
  const r = Math.round(RAIN_RGB[0] + (DUSK_RGB[0] - RAIN_RGB[0]) * t);
  const g = Math.round(RAIN_RGB[1] + (DUSK_RGB[1] - RAIN_RGB[1]) * t);
  const b = Math.round(RAIN_RGB[2] + (DUSK_RGB[2] - RAIN_RGB[2]) * t);
  RAIN_COLOURS.push("rgb(" + r + ", " + g + ", " + b + ")");
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smooth(a, b, v) {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/**
 * The rain colour for a given warmth: rain-blue at 0, amber at 1.
 * @param {number} warm 0..1
 * @returns {string} a CSS colour (one of 33 ready-made strings)
 */
export function rainColour(warm) {
  return RAIN_COLOURS[Math.round(clamp01(Number(warm) || 0) * WARM_STEPS)];
}

// ---------------------------------------------------------------- the roof

/**
 * Bundle a roof mask with where it sits on the canvas, ready for fast lookups.
 * @param {Uint8Array|null} mask mw*mh values, >= 128 is roof
 * @param {number} mw mask width in pixels
 * @param {number} mh mask height in pixels
 * @param {{x:number, y:number, w:number, h:number}} rect where the mask sits on the canvas, CSS pixels
 * @param {{a:number, b:number}} [eaves] the eaves line y = a*x + b in mask pixels; water runs at right angles to it
 * @param {{scatter?:boolean}} [opts] scatter: the surface is all roof, so each falling drop
 *   lands at its own random depth inside it rather than on the first roof pixel it meets
 * @returns {object|null} null when there is no usable mask
 */
export function createMaskFrame(mask, mw, mh, rect, eaves, opts) {
  if (!mask || !rect) return null;
  const w = Math.floor(mw);
  const h = Math.floor(mh);
  if (!(w > 0) || !(h > 0) || mask.length < w * h) return null;
  if (!(rect.w > 0) || !(rect.h > 0) || !Number.isFinite(rect.x) || !Number.isFinite(rect.y)) return null;
  const scatter = Boolean(opts && opts.scatter);
  const frame = { data: mask, mw: w, mh: h, x: rect.x, y: rect.y, rh: rect.h, sx: w / rect.w, sy: h / rect.h, nx: 0, ny: 1, scatter };
  if (eaves && Number.isFinite(eaves.a)) {
    // The eaves' slope on the canvas; "down the roof" is at right angles to it.
    const a = (eaves.a * frame.sx) / frame.sy;
    const tilt = a < -0.6 ? -0.6 : a > 0.6 ? 0.6 : a;
    const inv = 1 / Math.sqrt(1 + tilt * tilt);
    frame.nx = -tilt * inv;
    frame.ny = inv;
  }
  return frame;
}

/**
 * Is this canvas point on the roof? One multiply and one array read.
 * @param {object} frame from createMaskFrame
 * @param {number} x canvas x, CSS pixels
 * @param {number} y canvas y, CSS pixels
 * @returns {boolean}
 */
export function maskHit(frame, x, y) {
  const mx = Math.floor((x - frame.x) * frame.sx);
  const my = Math.floor((y - frame.y) * frame.sy);
  if (mx < 0 || my < 0 || mx >= frame.mw || my >= frame.mh) return false;
  return frame.data[my * frame.mw + mx] >= 128;
}

// ---------------------------------------------------------------- the rain

/**
 * A pool of raindrops as parallel typed arrays, plus a ring of splash droplets.
 * @param {number} capacity the most drops this pool will ever hold
 * @returns {object}
 */
export function createRain(capacity) {
  const n = Math.max(1, Math.floor(capacity) || 1);
  return {
    capacity: n,
    x: new Float32Array(n),
    y: new Float32Array(n),
    vx: new Float32Array(n),
    vy: new Float32Array(n),
    speed: new Float32Array(n),
    len: new Float32Array(n),
    age: new Float32Array(n),
    /** 0..1: how far down a scattering roof (see createMaskFrame) each drop lands. */
    land: new Float32Array(n),
    state: new Uint8Array(n),
    bucket: new Uint8Array(n),
    splashSlots: SPLASH_SLOTS,
    splashHead: 0,
    sx: new Float32Array(SPLASH_SLOTS),
    sy: new Float32Array(SPLASH_SLOTS),
    svx: new Float32Array(SPLASH_SLOTS),
    svy: new Float32Array(SPLASH_SLOTS),
    slife: new Float32Array(SPLASH_SLOTS),
    landed: 0,
    recycled: 0,
  };
}

/**
 * The shared conditions one step of rain needs. One object, reused every frame.
 * @returns {{w:number, h:number, gust:number, tan:number, speedScale:number, mask:object|null}}
 */
export function createRainEnv() {
  return { w: 0, h: 0, gust: 0, tan: 0, speedScale: 1, mask: null };
}

/**
 * Put a drop back at the top as fresh falling rain.
 * @param {object} pool from createRain
 * @param {number} i which drop
 * @param {number} w canvas width, CSS pixels
 * @param {number} h canvas height, CSS pixels
 * @param {boolean} stagger true spreads the drops over a whole canvas height above the top, so they arrive over time
 */
export function resetDrop(pool, i, w, h, stagger) {
  const b = BUCKET_PATTERN[i % BUCKET_PATTERN.length];
  pool.bucket[i] = b;
  pool.len[i] = 10 + b * 3.5 + Math.random() * 5;
  pool.speed[i] = 900 + b * 150 + Math.random() * 200;
  pool.x[i] = -EDGE_PAD + Math.random() * (w + 2 * EDGE_PAD);
  pool.y[i] = stagger ? -Math.random() * h : -Math.random() * 40;
  pool.vx[i] = 0;
  pool.vy[i] = 0;
  pool.age[i] = 0;
  pool.land[i] = Math.random();
  pool.state[i] = FALLING;
}

function addSplash(pool, x, y, gust) {
  for (let k = 0; k < 3; k++) {
    const j = pool.splashHead;
    pool.splashHead = (j + 1) % pool.splashSlots;
    pool.sx[j] = x;
    pool.sy[j] = y;
    pool.svx[j] = (k - 1) * 70 + (Math.random() - 0.5) * 60 + gust * 40;
    pool.svy[j] = -(70 + Math.random() * 80);
    pool.slife[j] = SPLASH_SECONDS;
  }
}

/**
 * Move the first `count` drops on by dt seconds.
 * FALLING until the tip enters the roof (on a scattering roof, until it reaches
 * its own landing depth inside it), then a splash and RUNNING down the roof,
 * then DRIPPING off the eaves under gravity, then back to the top.
 * No memory is allocated here.
 * @param {object} pool from createRain
 * @param {number} count how many drops are live (the first `count` of the pool)
 * @param {number} dt seconds since the last step
 * @param {object} env from createRainEnv
 */
export function stepRain(pool, count, dt, env) {
  const px = pool.x;
  const py = pool.y;
  const state = pool.state;
  const mask = env.mask;
  const w = env.w;
  const h = env.h;
  const gust = env.gust;
  const scale = env.speedScale;
  const span = w + 2 * EDGE_PAD;
  const n = count < pool.capacity ? count : pool.capacity;

  for (let i = 0; i < n; i++) {
    const st = state[i];
    if (st === FALLING) {
      const dy = pool.speed[i] * scale * dt;
      const dx = dy * env.tan;
      let nx = px[i] + dx;
      const ny = py[i] + dy;
      let hit = mask !== null && maskHit(mask, nx, ny);
      // A roof that fills the view: the drop falls on over it until its own depth.
      const landY = hit && mask.scatter ? mask.y + pool.land[i] * mask.rh : 0;
      if (hit && mask.scatter && ny < landY) hit = false;
      if (hit) {
        let hi = 1;
        if (mask.scatter) {
          // Stop where it crosses its landing depth (at once, if it is already past it).
          const t = py[i] < landY ? (landY - py[i]) / dy : 0;
          if (maskHit(mask, px[i] + dx * t, py[i] + dy * t)) hi = t;
        } else if (maskHit(mask, px[i], py[i])) {
          // Walk back to the edge of the roof so the splash sits on it.
          hi = 0;
        } else {
          let lo = 0;
          for (let k = 0; k < 3; k++) {
            const mid = (lo + hi) * 0.5;
            if (maskHit(mask, px[i] + dx * mid, py[i] + dy * mid)) hi = mid;
            else lo = mid;
          }
        }
        px[i] += dx * hi;
        py[i] += dy * hi;
        pool.age[i] = 0;
        state[i] = RUNNING;
        pool.landed += 1;
        addSplash(pool, px[i], py[i], gust);
      } else if (ny - pool.len[i] > h) {
        resetDrop(pool, i, w, h, false);
        pool.recycled += 1;
      } else {
        if (nx > w + EDGE_PAD) nx -= span;
        else if (nx < -EDGE_PAD) nx += span;
        px[i] = nx;
        py[i] = ny;
      }
    } else if (st === RUNNING) {
      const v = pool.speed[i] * scale * RUN_FACTOR;
      const dirX = mask !== null ? mask.nx : 0;
      const dirY = mask !== null ? mask.ny : 1;
      const vx = dirX * v + gust * RUN_DRIFT;
      const vy = dirY * v;
      const nx = px[i] + vx * dt;
      const ny = py[i] + vy * dt;
      px[i] = nx;
      py[i] = ny;
      pool.age[i] += dt;
      if (mask === null || !maskHit(mask, nx, ny)) {
        // Past the eaves: let go.
        state[i] = DRIPPING;
        pool.age[i] = 0;
        pool.vx[i] = vx * 0.4;
        pool.vy[i] = vy * 0.4;
      }
    } else {
      pool.age[i] += dt;
      pool.vy[i] += DRIP_GRAVITY * scale * dt;
      px[i] += (pool.vx[i] + gust * 20) * dt;
      py[i] += pool.vy[i] * dt;
      if (pool.age[i] >= DRIP_SECONDS || py[i] > h + 12) {
        resetDrop(pool, i, w, h, false);
        pool.recycled += 1;
      }
    }
  }

  const life = pool.slife;
  for (let j = 0; j < pool.splashSlots; j++) {
    if (life[j] <= 0) continue;
    life[j] -= dt;
    pool.svy[j] += SPLASH_GRAVITY * dt;
    pool.sx[j] += pool.svx[j] * dt;
    pool.sy[j] += pool.svy[j] * dt;
  }
}

// ---------------------------------------------------------------- the bolt

/**
 * A jagged line by midpoint displacement, written into arrays that already exist.
 * @param {Float32Array} px x values (needs off + n + 1 entries)
 * @param {Float32Array} py y values
 * @param {number} off where in the arrays this line starts
 * @param {number} n segments, a power of two
 * @param {number} x0 start x
 * @param {number} y0 start y
 * @param {number} x1 end x
 * @param {number} y1 end y
 * @param {number} jitter the largest sideways kick, in pixels
 */
export function buildBolt(px, py, off, n, x0, y0, x1, y1, jitter) {
  px[off] = x0;
  py[off] = y0;
  px[off + n] = x1;
  py[off + n] = y1;
  let amp = jitter;
  for (let step = n; step > 1; step >>= 1) {
    const half = step >> 1;
    for (let i = half; i < n; i += step) {
      const a = off + i - half;
      const b = off + i + half;
      px[off + i] = (px[a] + px[b]) * 0.5 + (Math.random() - 0.5) * amp;
      py[off + i] = (py[a] + py[b]) * 0.5 + (Math.random() - 0.5) * amp * 0.3;
    }
    amp *= 0.55;
  }
}

// ---------------------------------------------------------------- the clouds

function hash2(ix, iy, seed) {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca77);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae3d);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

/**
 * One cloud layer as RGBA pixels: four octaves of value noise that tile left
 * to right, tinted a lighter navy with a faint cream rim on the upper edges,
 * and fading to nothing towards the bottom (clouds belong to the sky).
 * @param {number} seed
 * @param {number} w width in pixels (512)
 * @param {number} h height in pixels (256)
 * @returns {Uint8ClampedArray} w*h*4 values
 */
export function cloudPixels(seed, w, h) {
  const density = new Float32Array(w * h);
  const col0 = new Uint16Array(w);
  const col1 = new Uint16Array(w);
  const colU = new Float32Array(w);
  let cols = 4;
  let amp = 1;
  let total = 0;
  for (let o = 0; o < 4; o++) {
    const rows = cols / 2;
    const lat = new Float32Array(cols * (rows + 1));
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i < cols; i++) lat[j * cols + i] = hash2(i, j, seed + o * 1013);
    }
    for (let x = 0; x < w; x++) {
      const fx = (x * cols) / w;
      const i0 = Math.floor(fx);
      const t = fx - i0;
      col0[x] = i0 % cols;
      col1[x] = (i0 + 1) % cols;
      colU[x] = t * t * (3 - 2 * t);
    }
    for (let y = 0; y < h; y++) {
      const fy = (y * rows) / h;
      const j0 = Math.floor(fy);
      const t = fy - j0;
      const uy = t * t * (3 - 2 * t);
      const r0 = j0 * cols;
      const r1 = (j0 + 1) * cols;
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const a = lat[r0 + col0[x]];
        const b = lat[r0 + col1[x]];
        const c = lat[r1 + col0[x]];
        const d = lat[r1 + col1[x]];
        const top = a + (b - a) * colU[x];
        const bottom = c + (d - c) * colU[x];
        density[row + x] += amp * (top + (bottom - top) * uy);
      }
    }
    total += amp;
    amp *= 0.5;
    cols *= 2;
  }

  // Shape the noise into cloud: thicker near the top, gone before the bottom.
  for (let y = 0; y < h; y++) {
    const v = h > 1 ? y / (h - 1) : 0;
    const fade = 1 - smooth(0.4, 1, v);
    const lift = (0.5 - v) * 0.22;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      density[row + x] = smooth(0.44, 0.74, density[row + x] / total + lift) * fade;
    }
  }

  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const d = density[row + x];
      const above = y >= 4 ? density[row + x - 4 * w] : d;
      const rim = clamp01((d - above) * 3);
      const k = 0.08 + 0.34 * rim;
      const o4 = (row + x) * 4;
      out[o4] = CLOUD_RGB[0] + (CREAM_RGB[0] - CLOUD_RGB[0]) * k;
      out[o4 + 1] = CLOUD_RGB[1] + (CREAM_RGB[1] - CLOUD_RGB[1]) * k;
      out[o4 + 2] = CLOUD_RGB[2] + (CREAM_RGB[2] - CLOUD_RGB[2]) * k;
      out[o4 + 3] = d * 0.9 * 255;
    }
  }
  return out;
}

const CLOUD_LAYERS = [null, null];
const CLOUD_TRIED = [false, false];

/** The off-screen canvas for a cloud layer, painted once and shared. */
function cloudLayer(doc, index) {
  if (CLOUD_TRIED[index]) return CLOUD_LAYERS[index];
  CLOUD_TRIED[index] = true;
  try {
    if (!doc || typeof doc.createElement !== "function") return null;
    const c = doc.createElement("canvas");
    c.width = CLOUD_W;
    c.height = CLOUD_H;
    const g = c.getContext("2d");
    if (!g) return null;
    const img = g.createImageData(CLOUD_W, CLOUD_H);
    img.data.set(cloudPixels(CLOUD_SEEDS[index], CLOUD_W, CLOUD_H));
    g.putImageData(img, 0, 0);
    CLOUD_LAYERS[index] = c;
  } catch {
    CLOUD_LAYERS[index] = null;
  }
  return CLOUD_LAYERS[index];
}

// ---------------------------------------------------------------- the weather

function cleanLevel(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? clamp01(n) : fallback;
}

/**
 * The weather over one section of the page, drawn on a transparent canvas.
 * The page styles and places the canvas; this class only paints inside it.
 */
export class Weather {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{quality?: "high"|"mid"|"low", lightning?: boolean}} [opts] quality defaults to "mid", lightning to true
   */
  constructor(canvas, opts) {
    const o = opts || {};
    const q = typeof o.quality === "string" && Object.prototype.hasOwnProperty.call(BUDGETS, o.quality) ? o.quality : "mid";
    this.canvas = canvas;
    this.quality = q;
    this.lightning = o.lightning !== false;
    /** Set by the page: called once per lightning strike with a strength 0..1. */
    this.onFlash = null;

    this._ctx = canvas && typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
    this._doc = (canvas && canvas.ownerDocument) || (typeof document !== "undefined" ? document : null);
    this._budgetMax = BUDGETS[q].particles;
    this._budget = this._budgetMax;
    this._cloudMax = BUDGETS[q].clouds;
    /** Layers drawn, including one that is fading out. */
    this._cloudLayers = this._cloudMax;
    /** Layers the budget allows; the rest fade out (or back in) over CLOUD_FADE_MS. */
    this._cloudWant = this._cloudMax;
    this._cloudFade = new Float32Array(2);
    for (let k = 0; k < this._cloudMax; k++) this._cloudFade[k] = 1;
    this._pool = createRain(this._budget);
    this._env = createRainEnv();
    this._count = 0;

    this._live = { rain: 0, cloud: 0, storm: 0, warm: 0 };
    this._target = { rain: 0, cloud: 0, storm: 0, warm: 0 };
    this._rate = 0.03;

    const dpr = typeof window !== "undefined" && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
    this._maxScale = q === "high" ? Math.min(1.5, Math.max(1, dpr)) : 1;
    this._scale = 1;
    this._w = 0;
    this._h = 0;
    this._bw = 0;
    this._bh = 0;

    this._wanted = false;
    this._dead = false;
    this._onScreen = true;
    this._raf = 0;
    this._inFrame = false;
    this._last = 0;
    this._painted = false;
    this._mean = FRAME_MS;
    this._work = 0;
    this._slowFor = 0;
    this._fastFor = 0;
    this._sinceRaise = Infinity;
    this._recover = true;
    this._paceBins = new Float32Array(PACE_BINS).fill(Infinity);
    this._paceBin = 0;
    this._paceAge = 0;

    this._cloudOff = new Float32Array(2);
    this._patterns = [null, null];

    this._boltX = new Float32Array(BOLT_SEGMENTS + 1);
    this._boltY = new Float32Array(BOLT_SEGMENTS + 1);
    this._branchX = new Float32Array(2 * (BRANCH_SEGMENTS + 1));
    this._branchY = new Float32Array(2 * (BRANCH_SEGMENTS + 1));
    this._branches = 0;
    this._flashLeft = 0;
    this._stormy = false;
    this._lastStrike = 0;
    this._nextStrike = 0;

    this._tick = (now) => this._frame(now);
    this._onVisibility = () => this._sync();
    this._onResize = () => {
      this._measure();
      this._sync();
    };

    this._ro = null;
    this._io = null;
    if (canvas && typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(this._onResize);
      this._ro.observe(canvas);
    } else if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("resize", this._onResize);
    }
    if (canvas && typeof IntersectionObserver !== "undefined") {
      this._io = new IntersectionObserver((entries) => {
        if (!entries.length) return;
        this._onScreen = Boolean(entries[entries.length - 1].isIntersecting);
        this._sync();
      });
      this._io.observe(canvas);
    }
    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
      document.addEventListener("visibilitychange", this._onVisibility);
    }
    this._offCalm = onCalmChange(() => this._sync());

    this._measure();
    this._prebuildClouds();
  }

  /** Paint the cloud textures while the page is idle, one per callback, so no frame pays for both. */
  _prebuildClouds() {
    if (this._cloudLayers <= 0 || !this._doc) return;
    const idle = typeof requestIdleCallback === "function" ? (fn) => requestIdleCallback(fn, { timeout: 1500 }) : (fn) => setTimeout(fn, 300);
    const build = () => {
      if (this._dead) return;
      for (let k = 0; k < this._cloudLayers; k++) {
        if (CLOUD_TRIED[k]) continue;
        cloudLayer(this._doc, k);
        idle(build);
        return;
      }
    };
    idle(build);
  }

  /**
   * Ease the weather towards new levels.
   * @param {{rain?:number, cloud?:number, storm?:number, warm?:number}} target any of the four, each 0..1
   * @param {number} [rate] how much of the gap closes per frame at 60 fps (default 0.03)
   */
  setState(target, rate) {
    const t = target || {};
    const to = this._target;
    if (t.rain !== undefined) to.rain = cleanLevel(t.rain, to.rain);
    if (t.cloud !== undefined) to.cloud = cleanLevel(t.cloud, to.cloud);
    if (t.storm !== undefined) to.storm = cleanLevel(t.storm, to.storm);
    if (t.warm !== undefined) to.warm = cleanLevel(t.warm, to.warm);
    const r = Number(rate);
    this._rate = Number.isFinite(r) && r > 0 ? Math.min(1, r) : 0.03;
  }

  /**
   * Set the weather immediately, with no easing.
   * @param {{rain?:number, cloud?:number, storm?:number, warm?:number}} state
   */
  snap(state) {
    const s = state || {};
    const live = this._live;
    const to = this._target;
    if (s.rain !== undefined) to.rain = live.rain = cleanLevel(s.rain, live.rain);
    if (s.cloud !== undefined) to.cloud = live.cloud = cleanLevel(s.cloud, live.cloud);
    if (s.storm !== undefined) to.storm = live.storm = cleanLevel(s.storm, live.storm);
    if (s.warm !== undefined) to.warm = live.warm = cleanLevel(s.warm, live.warm);
  }

  /**
   * The weather as it is right now.
   * @returns {{rain:number, cloud:number, storm:number, warm:number}} a copy
   */
  getState() {
    const s = this._live;
    return { rain: s.rain, cloud: s.cloud, storm: s.storm, warm: s.warm };
  }

  /**
   * Tell the rain where the roof is. Call again whenever the layout changes.
   * @param {Uint8Array|null} mask mw*mh values, >= 128 is roof; null clears the roof
   * @param {number} [mw] mask width
   * @param {number} [mh] mask height
   * @param {{x:number, y:number, w:number, h:number}} [rect] where the mask image sits on the canvas, CSS pixels
   * @param {{a:number, b:number}} [eaves] the eaves line y = a*x + b in mask pixels
   * @param {{scatter?:boolean}} [opts] scatter: true for a surface that is all roof (a close-up),
   *   so rain lands anywhere on it rather than along its top edge
   */
  setMask(mask, mw, mh, rect, eaves, opts) {
    this._env.mask = createMaskFrame(mask, mw, mh, rect, eaves, opts);
  }

  /** Start the weather. Safe to call more than once. */
  start() {
    if (this._dead) return;
    this._wanted = true;
    this._sync();
  }

  /** Stop the weather and clear the canvas. start() brings it back. */
  stop() {
    this._wanted = false;
    this._sync();
  }

  /** Stop for good and let go of everything. */
  destroy() {
    if (this._dead) return;
    this.stop();
    this._dead = true;
    if (this._ro) this._ro.disconnect();
    else if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
      window.removeEventListener("resize", this._onResize);
    }
    if (this._io) this._io.disconnect();
    if (typeof document !== "undefined" && typeof document.removeEventListener === "function") {
      document.removeEventListener("visibilitychange", this._onVisibility);
    }
    if (this._offCalm) this._offCalm();
    this._ro = null;
    this._io = null;
    this._offCalm = null;
    this._env.mask = null;
    this._patterns[0] = null;
    this._patterns[1] = null;
    this.onFlash = null;
  }

  /** Match the bitmap to the canvas's CSS box. */
  _measure() {
    const c = this.canvas;
    if (!c || !this._ctx) return;
    const w = Math.round(c.clientWidth || 0);
    const h = Math.round(c.clientHeight || 0);
    if (!(w > 0) || !(h > 0)) {
      this._w = 0;
      this._h = 0;
      return;
    }
    // If the CSS box is simply following the bitmap, a scale above 1 would grow for ever.
    if (this._maxScale > 1 && this._bw > 0 && w === this._bw && h === this._bh && (w !== this._w || h !== this._h)) {
      this._maxScale = 1;
    }
    let scale = this._maxScale;
    if (w * h * scale * scale > MAX_BITMAP) scale = 1;
    const bw = Math.max(1, Math.round(w * scale));
    const bh = Math.max(1, Math.round(h * scale));
    if (c.width !== bw) c.width = bw;
    if (c.height !== bh) c.height = bh;
    const changed = w !== this._w || h !== this._h;
    this._w = w;
    this._h = h;
    this._bw = bw;
    this._bh = bh;
    this._scale = scale;
    const env = this._env;
    env.w = w;
    env.h = h;
    const k = h / 900;
    env.speedScale = k < 0.5 ? 0.5 : k > 1.6 ? 1.6 : k;
    if (changed) {
      const pool = this._pool;
      for (let i = 0; i < this._count; i++) {
        if (pool.x[i] > w + EDGE_PAD || pool.y[i] > h) resetDrop(pool, i, w, h, true);
      }
    }
  }

  _shouldRun() {
    if (!this._wanted || this._dead || !this._onScreen || !this._ctx) return false;
    if (!(this._w > 0) || !(this._h > 0)) return false;
    if (typeof document !== "undefined" && document.hidden) return false;
    return !isCalm();
  }

  /** Start or pause the loop to match the page. */
  _sync() {
    if (this._dead) return;
    if (this._wanted && !(this._w > 0)) this._measure();
    const run = this._shouldRun();
    if (run) {
      // Inside a frame (start() from onFlash, say) the frame itself books the next one.
      if (!this._raf && !this._inFrame && typeof requestAnimationFrame === "function") {
        this._last = 0;
        // Judge the pace afresh: a battery saver may have come on while we were paused.
        this._slowFor = 0;
        this._fastFor = 0;
        this._paceBins.fill(Infinity);
        this._paceAge = 0;
        if (this._nextStrike > 0 && typeof performance !== "undefined") {
          const soonest = performance.now() + 1500;
          if (this._nextStrike < soonest) this._nextStrike = soonest;
        }
        this._raf = requestAnimationFrame(this._tick);
      }
      return;
    }
    if (this._raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._flashLeft = 0;
    this._clear();
  }

  _clear() {
    if (!this._painted || !this._ctx) return;
    const ctx = this._ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._painted = false;
  }

  _frame(now) {
    this._raf = 0;
    if (!this._shouldRun()) {
      this._flashLeft = 0;
      this._clear();
      return;
    }
    let t = now;
    if (typeof t !== "number" || !Number.isFinite(t)) {
      t = typeof performance !== "undefined" ? performance.now() : this._last + FRAME_MS;
    }
    let dt = FRAME_MS;
    if (this._last > 0) {
      dt = t - this._last;
      if (dt < 0) dt = 0;
      this._watch(dt);
    }
    this._last = t;
    if (dt > MAX_STEP_MS) dt = MAX_STEP_MS;
    const clock = typeof performance !== "undefined" && typeof performance.now === "function" ? performance : null;
    const began = clock ? clock.now() : 0;
    this._inFrame = true;
    try {
      this._update(dt, t);
    } finally {
      this._inFrame = false;
    }
    // The page's onFlash may have stopped (or destroyed) the weather meanwhile.
    if (!this._shouldRun()) {
      this._flashLeft = 0;
      this._clear();
      return;
    }
    this._draw();
    if (clock) {
      const work = clock.now() - began;
      this._work += ((work > 100 ? 100 : work) - this._work) * 0.08;
    }
    // One loop only, however often start() was called during this frame.
    if (!this._raf) this._raf = requestAnimationFrame(this._tick);
  }

  /**
   * Keep an eye on the frame rate; give ground if the device is struggling and
   * take it back once it copes. Frames are judged against the quickest pace of
   * the last second rather than against 60 fps, so a browser that holds every
   * page to 30 fps to save battery (iOS Low Power Mode, Chrome's Energy Saver)
   * is not mistaken for one that can't keep up. Our own work per frame is timed
   * as well, which catches a device held steadily slow by the rain itself.
   */
  _watch(delta) {
    const d = delta > 100 ? 100 : delta;
    this._mean += (d - this._mean) * 0.08;
    this._sinceRaise += d;
    const pace = this._pace(d);
    const limit = pace * SLOW_RATIO > SLOW_MS ? pace * SLOW_RATIO : SLOW_MS;
    if (this._mean <= limit && this._work <= SLOW_WORK_MS) {
      this._slowFor = 0;
      this._fastFor += d;
      if (this._fastFor >= RECOVER_MS) {
        this._fastFor = 0;
        this._raise();
      }
      return;
    }
    this._fastFor = 0;
    this._slowFor += d;
    if (this._slowFor < SLOW_FOR_MS) return;
    this._slowFor = 0;
    this._cut();
  }

  /** The shortest frame interval of about the last second: the pace the browser is allowing. */
  _pace(d) {
    const bins = this._paceBins;
    if (d >= PACE_MIN_MS && d < bins[this._paceBin]) bins[this._paceBin] = d;
    this._paceAge += d;
    if (this._paceAge >= PACE_BIN_MS) {
      this._paceAge = 0;
      this._paceBin = (this._paceBin + 1) % PACE_BINS;
      bins[this._paceBin] = Infinity;
    }
    let min = Infinity;
    for (let k = 0; k < PACE_BINS; k++) if (bins[k] < min) min = bins[k];
    return min;
  }

  /** Fewer drops and one cloud layer fewer (it fades out rather than vanishing). */
  _cut() {
    // Struggling again soon after taking ground back: that ground was too much, so stop trying.
    if (this._sinceRaise < RECOVER_MS) this._recover = false;
    const cut = Math.floor(this._budget * BUDGET_CUT);
    this._budget = cut < BUDGET_FLOOR ? BUDGET_FLOOR : cut;
    if (this._cloudWant > 0) this._cloudWant -= 1;
  }

  /** Undo one cut, never beyond this tier's own budget. */
  _raise() {
    if (!this._recover) return;
    if (this._budget >= this._budgetMax && this._cloudWant >= this._cloudMax) return;
    const up = Math.ceil(this._budget / BUDGET_CUT);
    this._budget = up > this._budgetMax ? this._budgetMax : up;
    if (this._cloudWant < this._cloudMax) {
      this._cloudWant += 1;
      if (this._cloudLayers < this._cloudWant) this._cloudLayers = this._cloudWant;
    }
    this._sinceRaise = 0;
  }

  _update(dt, now) {
    const live = this._live;
    const to = this._target;
    const k = 1 - Math.pow(1 - this._rate, dt / FRAME_MS);
    live.rain += (to.rain - live.rain) * k;
    live.cloud += (to.cloud - live.cloud) * k;
    live.storm += (to.storm - live.storm) * k;
    live.warm += (to.warm - live.warm) * k;
    if (Math.abs(to.rain - live.rain) < 0.0005) live.rain = to.rain;
    if (Math.abs(to.cloud - live.cloud) < 0.0005) live.cloud = to.cloud;
    if (Math.abs(to.storm - live.storm) < 0.0005) live.storm = to.storm;
    if (Math.abs(to.warm - live.warm) < 0.0005) live.warm = to.warm;

    const env = this._env;
    const gust = wind(now);
    env.gust = gust;
    env.tan = Math.tan(gust * LEAN_MAX);

    let n = (this._w * this._h) / AREA_PER_DROP;
    if (n < MIN_DROPS) n = MIN_DROPS;
    if (n > this._budget) n = this._budget;
    n = Math.floor(n * live.rain + 0.5);
    const pool = this._pool;
    if (n > pool.capacity) n = pool.capacity;
    for (let i = this._count; i < n; i++) resetDrop(pool, i, env.w, env.h, true);
    this._count = n;
    stepRain(pool, n, dt / 1000, env);

    const drift = (0.4 + 0.3 * gust) * (dt / FRAME_MS);
    this._cloudOff[0] += drift * CLOUD_SPEED[0];
    this._cloudOff[1] += drift * CLOUD_SPEED[1];
    if (this._cloudOff[0] > 1e6) this._cloudOff[0] -= 1e6;
    if (this._cloudOff[1] > 1e6) this._cloudOff[1] -= 1e6;

    // A cloud layer the budget no longer allows fades out; one it allows again fades in.
    const fade = this._cloudFade;
    const step = dt / CLOUD_FADE_MS;
    for (let c = 0; c < this._cloudLayers; c++) {
      const f = c < this._cloudWant ? fade[c] + step : fade[c] - step;
      fade[c] = f < 0 ? 0 : f > 1 ? 1 : f;
    }
    while (this._cloudLayers > this._cloudWant && fade[this._cloudLayers - 1] <= 0) this._cloudLayers -= 1;

    this._storm(now);
  }

  /** Lightning: rationed to one strike every 6 to 14 seconds at the very most, across the whole page. */
  _storm(now) {
    if (!this.lightning || !(this._live.storm > 0.5)) {
      this._stormy = false;
      return;
    }
    if (!this._stormy) {
      // A storm that has just arrived strikes soon, but never sooner than the ration allows.
      this._stormy = true;
      const soon = now + 1200 + Math.random() * 2600;
      const ration = this._lastStrike > 0 ? this._lastStrike + STRIKE_MIN_MS + Math.random() * (STRIKE_MAX_MS - STRIKE_MIN_MS) : 0;
      const next = soon > ration ? soon : ration;
      if (next > this._nextStrike) this._nextStrike = next;
    }
    if (now < this._nextStrike || isCalm()) return;
    if (Math.abs(now - lastStrikeAt) < STRIKE_MIN_MS) {
      // Another Weather on this page struck less than 6 s ago: take a fresh slot
      // after that strike, at a random point so the canvases don't fall into step.
      this._nextStrike = lastStrikeAt + STRIKE_MIN_MS + Math.random() * (STRIKE_MAX_MS - STRIKE_MIN_MS);
      return;
    }

    const w = this._w;
    const h = this._h;
    const jitter = Math.min(w, h) * 0.22;
    const x0 = w * (0.12 + Math.random() * 0.76);
    const x1 = x0 + (Math.random() - 0.5) * w * 0.35;
    const y1 = h * (0.45 + Math.random() * 0.3);
    buildBolt(this._boltX, this._boltY, 0, BOLT_SEGMENTS, x0, -4, x1, y1, jitter);
    this._branches = Math.random() < 0.5 ? 1 : 2;
    for (let b = 0; b < this._branches; b++) {
      const at = Math.floor(BOLT_SEGMENTS * (0.25 + Math.random() * 0.45));
      const side = Math.random() < 0.5 ? -1 : 1;
      const bx = this._boltX[at];
      const by = this._boltY[at];
      const ex = bx + side * (40 + Math.random() * 0.18 * w);
      const ey = by + h * (0.1 + Math.random() * 0.14);
      buildBolt(this._branchX, this._branchY, b * (BRANCH_SEGMENTS + 1), BRANCH_SEGMENTS, bx, by, ex, ey, jitter * 0.45);
    }
    this._flashLeft = FLASH_FRAMES;
    this._lastStrike = now;
    lastStrikeAt = now;
    this._nextStrike = now + STRIKE_MIN_MS + Math.random() * (STRIKE_MAX_MS - STRIKE_MIN_MS);
    if (typeof this.onFlash === "function") {
      try {
        this.onFlash(1);
      } catch {
        // The page's flash is the page's business; the weather carries on.
      }
    }
  }

  _draw() {
    const ctx = this._ctx;
    const s = this._scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._drawClouds(ctx, s);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    this._drawBolt(ctx);
    this._drawRain(ctx);
    ctx.globalAlpha = 1;
    this._painted = true;
  }

  _drawClouds(ctx, s) {
    const alpha = this._live.cloud;
    if (this._cloudLayers <= 0 || alpha < 0.004) return;
    const w = this._w;
    const h = this._h;
    let built = false;
    for (let k = this._cloudLayers - 1; k >= 0; k--) {
      const fade = this._cloudFade[k];
      if (fade <= 0) continue;
      let tex = CLOUD_LAYERS[k];
      if (!tex && !CLOUD_TRIED[k]) {
        // Not ready yet: paint at most one texture per frame.
        if (built) continue;
        built = true;
        tex = cloudLayer(this._doc, k);
      }
      if (!tex) continue;
      const th = Math.max(k === 0 ? 200 : 280, h * CLOUD_TALL[k]);
      const tw = th * 2 * CLOUD_WIDE[k];
      const off = this._cloudOff[k] % tw;
      const top = -th * 0.06;
      ctx.globalAlpha = alpha * CLOUD_ALPHA[k] * fade;
      let pattern = this._patterns[k];
      if (!pattern && typeof ctx.createPattern === "function") {
        pattern = ctx.createPattern(tex, "repeat-x");
        this._patterns[k] = pattern;
      }
      if (pattern) {
        // One fill per layer; the pattern tiles without seams at any offset.
        const kx = tw / CLOUD_W;
        const ky = th / CLOUD_H;
        ctx.setTransform(s * kx, 0, 0, s * ky, s * (off - tw), s * top);
        ctx.fillStyle = pattern;
        ctx.fillRect((tw - off) / kx, 0, w / kx, CLOUD_H);
      } else {
        ctx.setTransform(s, 0, 0, s, 0, 0);
        for (let x = Math.round(off - tw); x < w; x += Math.round(tw)) {
          ctx.drawImage(tex, x, top, Math.round(tw), th);
        }
      }
    }
  }

  _drawBolt(ctx) {
    if (this._flashLeft <= 0) return;
    this._flashLeft -= 1;
    const bx = this._boltX;
    const by = this._boltY;
    ctx.beginPath();
    ctx.moveTo(bx[0], by[0]);
    for (let i = 1; i <= BOLT_SEGMENTS; i++) ctx.lineTo(bx[i], by[i]);
    for (let b = 0; b < this._branches; b++) {
      const o = b * (BRANCH_SEGMENTS + 1);
      ctx.moveTo(this._branchX[o], this._branchY[o]);
      for (let i = 1; i <= BRANCH_SEGMENTS; i++) ctx.lineTo(this._branchX[o + i], this._branchY[o + i]);
    }
    ctx.globalAlpha = 1;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = BOLT_GLOW;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = BOLT_CORE;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  _drawRain(ctx) {
    const n = this._count;
    const pool = this._pool;
    const colour = rainColour(this._live.warm);
    const px = pool.x;
    const py = pool.y;
    const state = pool.state;
    const env = this._env;
    const lean = env.gust * LEAN_MAX;
    const sin = Math.sin(lean);
    const cos = Math.cos(lean);

    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineJoin = "miter";
    ctx.lineCap = "butt";

    if (n > 0) {
      const bucket = pool.bucket;
      const len = pool.len;
      for (let b = 0; b < 3; b++) {
        ctx.globalAlpha = BUCKET_ALPHA[b];
        ctx.lineWidth = BUCKET_WIDTH[b];
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          if (state[i] !== FALLING || bucket[i] !== b) continue;
          ctx.moveTo(px[i], py[i]);
          ctx.lineTo(px[i] - sin * len[i], py[i] - cos * len[i]);
        }
        ctx.stroke();
      }

      // Water on the roof: slower, shorter, following the slope.
      const mask = env.mask;
      const rx = (mask !== null ? mask.nx : 0) * RUN_LENGTH;
      const ry = (mask !== null ? mask.ny : 1) * RUN_LENGTH;
      ctx.globalAlpha = RUN_ALPHA;
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (state[i] !== RUNNING) continue;
        ctx.moveTo(px[i], py[i]);
        ctx.lineTo(px[i] - rx, py[i] - ry);
      }
      ctx.stroke();

      // Drips off the eaves: they stretch as they gather speed.
      ctx.globalAlpha = DRIP_ALPHA;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (state[i] !== DRIPPING) continue;
        let tail = pool.vy[i] * 0.016;
        if (tail < 2.5) tail = 2.5;
        ctx.moveTo(px[i], py[i]);
        ctx.lineTo(px[i] - pool.vx[i] * 0.016, py[i] - tail);
      }
      ctx.stroke();
    }

    // Splashes outlive the drop that made them, so they are drawn even as the rain eases off.
    const life = pool.slife;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (let j = 0; j < pool.splashSlots; j++) {
      if (life[j] <= 0) continue;
      ctx.rect(pool.sx[j] - 0.8, pool.sy[j] - 0.8, 1.6, 1.6);
    }
    ctx.fill();
  }
}
