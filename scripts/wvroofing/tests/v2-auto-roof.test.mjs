// WV Roofing v2: the Roof Cam's one-tap roof finder (public/WVROOFING/2/assets/js/engine/auto-roof.js),
// measured against the three sample houses' hand-marked roofs.
//
// One tap is meant to find the slope it lands on, not the whole roof (the visitor
// taps each slope), so the score that must pass is IoU against the hand-marked
// piece of roof containing the tap. IoU against the whole roof is printed too.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { repo } from "./helpers.mjs";

const engine = path.join(repo, "public", "WVROOFING", "2", "assets", "js", "engine");
const { suggestRoof, traceMask, TOLERANCES } = await import(pathToFileURL(path.join(engine, "auto-roof.js")).href);
const { buildMask, erode, dilate, maskStats, iou } = await import(pathToFileURL(path.join(engine, "mask-ops.js")).href);

const samplesDir = path.join(repo, "public", "WVROOFING", "samples");
const { samples } = JSON.parse(fs.readFileSync(path.join(samplesDir, "samples.json"), "utf8"));

/** Per-sample floors for the tapped piece (see the note at the top). */
const FLOOR = { "semi-1930s": 0.55, "detached-modern": 0.55, "detached-clay": 0.55 };

async function decode(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
}

/** The connected piece of a mask containing (x, y), as a new mask. */
function pieceAt(mask, w, h, x, y) {
  const out = new Uint8Array(w * h);
  const start = y * w + x;
  if (mask[start] < 128) return out;
  const q = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  q[tail++] = start;
  out[start] = 255;
  while (head < tail) {
    const p = q[head++];
    const px = p % w;
    const nb = [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, p - w, p + w];
    for (const n of nb) {
      if (n < 0 || n >= w * h || out[n] || mask[n] < 128) continue;
      out[n] = 255;
      q[tail++] = n;
    }
  }
  return out;
}

/** The point deepest inside the mask (erode until almost nothing is left). */
function deepest(mask, w, h) {
  let m = mask;
  let st = maskStats(m, w, h);
  for (let i = 0; i < 60; i++) {
    const next = erode(m, w, h, 6);
    const ns = maskStats(next, w, h);
    if (ns.empty) break;
    m = next;
    st = ns;
  }
  // The centroid of what's left can fall in a gap between two pieces: snap to a pixel that's in.
  let x = Math.round(st.cx);
  let y = Math.round(st.cy);
  if (m[y * w + x] < 128) {
    let best = Infinity;
    for (let yy = st.minY; yy <= st.maxY; yy++) {
      for (let xx = st.minX; xx <= st.maxX; xx++) {
        if (m[yy * w + xx] < 128) continue;
        const d = (xx - st.cx) ** 2 + (yy - st.cy) ** 2;
        if (d < best) {
          best = d;
          x = xx;
          y = yy;
        }
      }
    }
  }
  return [x, y];
}

const photos = new Map();
async function sample(s) {
  if (!photos.has(s.id)) {
    const photo = await decode(path.join(samplesDir, s.src));
    const truth = buildMask(s.shapes, photo.width, photo.height, photo.width / s.w, photo.height / s.h);
    photos.set(s.id, { photo, truth });
  }
  return photos.get(s.id);
}

test("one tap finds the tapped slope on each sample house", async () => {
  const rows = [];
  for (const s of samples) {
    const { photo, truth } = await sample(s);
    const { width: w, height: h } = photo;
    const seed = deepest(truth, w, h);
    const piece = pieceAt(truth, w, h, seed[0], seed[1]);
    const t0 = performance.now();
    const r = suggestRoof(photo, seed);
    const ms = performance.now() - t0;
    const scorePiece = iou(r.mask, piece);
    const scoreAll = iou(r.mask, truth);
    rows.push({ sample: s.id, tap: seed.join(","), "IoU (slope)": scorePiece.toFixed(3), "IoU (whole roof)": scoreAll.toFixed(3), frac: (r.frac * 100).toFixed(1) + "%", confidence: r.confidence, tolerance: r.tolerance, ms: Math.round(ms) });
    assert.ok(scorePiece >= FLOOR[s.id], s.id + ": IoU " + scorePiece.toFixed(3) + " is under " + FLOOR[s.id]);
    assert.ok(TOLERANCES.includes(r.tolerance), s.id + ": the tolerance used should be a rung of the ladder");
  }
  console.table(rows);
});

/** The same pixels in a new array, so nothing kept for the photo is reused. */
function freshCopy(photo) {
  return { data: new Uint8ClampedArray(photo.data), width: photo.width, height: photo.height };
}

test("the result is well formed, repeatable, and its shapes rebuild its mask", async () => {
  for (const s of samples) {
    const { photo, truth } = await sample(s);
    const { width: w, height: h } = photo;
    const seed = deepest(truth, w, h);
    const a = suggestRoof(photo, seed);
    const b = suggestRoof(photo, seed);
    assert.deepEqual(a.shapes, b.shapes, s.id + ": not deterministic");
    assert.deepEqual(suggestRoof(freshCopy(photo), seed).shapes, a.shapes, s.id + ": a fresh start gives a different outline");
    assert.ok(a.shapes.length > 0, s.id + ": no shapes");
    for (const sh of a.shapes) {
      assert.ok(sh.mode === "add" || sh.mode === "sub");
      assert.ok(sh.pts.length >= 3 && sh.pts.length <= 48, s.id + ": polygon with " + sh.pts.length + " points");
      for (const [x, y] of sh.pts) assert.ok(x >= 0 && y >= 0 && x <= w && y <= h, s.id + ": point outside the photo");
    }
    const rebuilt = buildMask(a.shapes, w, h, 1, 1);
    assert.ok(iou(rebuilt, a.mask) >= 0.98, s.id + ": shapes and mask disagree");
  }
});

test("Tighter, Looser and more taps on the same photo match a fresh start exactly", async () => {
  // The shrunk photo and its features are kept per photo, so a later call only
  // re-grows. Whatever is kept must never change the answer.
  for (const s of samples) {
    const { photo, truth } = await sample(s);
    const { width: w, height: h } = photo;
    const seeds = [deepest(truth, w, h), [Math.round(w / 3), Math.round(h / 4)], [5, 5]];
    for (const seed of seeds) {
      for (const tolerance of [undefined, TOLERANCES[0], TOLERANCES[4], TOLERANCES[TOLERANCES.length - 1]]) {
        const opts = tolerance === undefined ? {} : { tolerance };
        const kept = suggestRoof(photo, seed, opts);
        const fresh = suggestRoof(freshCopy(photo), seed, opts);
        const where = s.id + " at " + seed.join(",") + ", tolerance " + tolerance;
        assert.deepEqual(kept.shapes, fresh.shapes, where + ": outline differs");
        assert.equal(kept.confidence, fresh.confidence, where + ": confidence differs");
        assert.equal(kept.reason, fresh.reason, where + ": reason differs");
        assert.equal(kept.tolerance, fresh.tolerance, where + ": tolerance differs");
        assert.deepEqual(kept.mask, fresh.mask, where + ": mask differs");
      }
    }
  }
});

test("a tap is quick enough", async () => {
  // node --test runs the test files in parallel, so a single wall-clock reading
  // is at the mercy of the other files. Take the best of three first-time calls
  // (each on a fresh copy of the pixels, so nothing kept is reused) and allow
  // generous headroom: this catches a real slowdown, not a busy machine.
  for (const s of samples) {
    const { photo, truth } = await sample(s);
    const seed = deepest(truth, photo.width, photo.height);
    let best = Infinity;
    for (let i = 0; i < 3; i++) {
      const copy = freshCopy(photo);
      const t0 = performance.now();
      suggestRoof(copy, seed);
      best = Math.min(best, performance.now() - t0);
    }
    assert.ok(best < 1000, s.id + ": the quickest of three took " + Math.round(best) + " ms");
  }
});

test("a tap on the sky or a wall is flagged as unsure, with a reason", async () => {
  const s = samples.find((x) => x.id === "semi-1930s");
  const { photo, truth } = await sample(s);
  const { width: w, height: h } = photo;
  const near = dilate(truth, w, h, 40);
  // The top-left corner region, away from the roof.
  let seed = null;
  for (let y = 10; y < h / 3 && !seed; y += 7) {
    for (let x = 10; x < w / 3; x += 7) {
      if (near[y * w + x] < 128) {
        seed = [x, y];
        break;
      }
    }
  }
  assert.ok(seed, "no pixel away from the roof");
  const r = suggestRoof(photo, seed);
  assert.ok(r.confidence < 0.5, "confidence " + r.confidence + " for a tap at " + seed.join(","));
  assert.ok(r.reason.length > 0, "no reason given");
});

test("odd inputs never throw", () => {
  const flat = { data: new Uint8ClampedArray(20 * 20 * 4).fill(128), width: 20, height: 20 };
  assert.doesNotThrow(() => suggestRoof(flat, [10, 10]));
  assert.doesNotThrow(() => suggestRoof({ data: new Uint8ClampedArray(4), width: 1, height: 1 }, [0, 0]));
  assert.doesNotThrow(() => suggestRoof(flat, [-50, 999]));
  assert.doesNotThrow(() => suggestRoof(flat, [10, 10], { tolerance: 0 }));
  assert.doesNotThrow(() => suggestRoof(flat, [10, 10], { tolerance: 1 }));
  assert.doesNotThrow(() => suggestRoof(null, [0, 0]));
  assert.deepEqual(traceMask(new Uint8Array(0), 0, 0), []);
  const r = suggestRoof({ data: new Uint8ClampedArray(4), width: 1, height: 1 }, [0, 0]);
  assert.equal(r.shapes.length, 0);
  assert.equal(typeof r.tolerance, "number");
});

test("the tolerance ladder runs from tight to loose", () => {
  assert.ok(TOLERANCES.length >= 5);
  for (let i = 1; i < TOLERANCES.length; i++) assert.ok(TOLERANCES[i] > TOLERANCES[i - 1]);
});
