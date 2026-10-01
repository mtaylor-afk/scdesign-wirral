// Rain Later (WV Roofing v2): isobars.
// Section backgrounds drawn as a synoptic pressure chart: thin contour lines
// traced through a field of smooth noise, with an "L" on the lowest point and
// an "H" on the highest. Each canvas is drawn once per size; nothing animates.

const FIELD_LONG = 40;
const FIELD_SHORT = 24;
const NARROW_BOX = 600;
const LEVELS_WIDE = 7;
const LEVELS_NARROW = 5;
const MAX_LEVELS = 24;
const MAX_BITMAP_SIDE = 4096;
const RESIZE_DEBOUNCE_MS = 150;
const LABEL_FONT = '500 12px "IBM Plex Mono", monospace';
const LABEL_INSET = 12;
const BASE_CELLS = 2;
const OCTAVES = 3;
const GAIN = 0.45;
const MIN_GAP = 0.4;
const SPECK_SIZE = 0.75;

const TONES = {
  dark: { line: "rgba(143,212,244,0.18)", label: "rgba(143,212,244,0.36)" },
  paper: { line: "rgba(11,18,32,0.09)", label: "rgba(11,18,32,0.18)" },
};

// Canvases that a live initIsobars() call is looking after.
const managed = new WeakSet();

/**
 * Where a contour crosses the edge between two grid nodes, as a fraction 0..1
 * measured from the first node.
 * @param {number} a value at the first node
 * @param {number} b value at the second node
 * @param {number} level
 * @returns {number}
 */
function crossing(a, b, level) {
  const d = b - a;
  if (d === 0) return 0.5;
  const t = (level - a) / d;
  if (t >= 0 && t <= 1) return t;
  if (t < 0) return 0;
  if (t > 1) return 1;
  return 0.5;
}

function pushSegment(out, x0, y0, x1, y1) {
  if (x0 === x1 && y0 === y1) return;
  out.push(x0, y0, x1, y1);
}

/**
 * Marching squares. Finds where `field` crosses `level` and returns the
 * crossing as short straight segments, linearly interpolated along cell edges.
 * A node counts as "inside" when its value is at or above the level; saddle
 * cells are settled by the average of their four corners.
 * @param {ArrayLike<number>} field rows x cols numbers, row-major (Float32Array)
 * @param {number} cols
 * @param {number} rows
 * @param {number} level
 * @returns {number[]} flat [x0, y0, x1, y1, ...] in grid units (0..cols-1, 0..rows-1)
 */
export function contours(field, cols, rows, level) {
  const out = [];
  if (!field || !(cols >= 2) || !(rows >= 2) || field.length < cols * rows) return out;
  if (!Number.isFinite(level)) return out;

  for (let y = 0; y < rows - 1; y++) {
    const r0 = y * cols;
    const r1 = r0 + cols;
    for (let x = 0; x < cols - 1; x++) {
      const tl = field[r0 + x];
      const tr = field[r0 + x + 1];
      const br = field[r1 + x + 1];
      const bl = field[r1 + x];

      let code = 0;
      if (tl >= level) code |= 8;
      if (tr >= level) code |= 4;
      if (br >= level) code |= 2;
      if (bl >= level) code |= 1;
      if (code === 0 || code === 15) continue;

      // Crossing points on the four edges. Each is worked out left-to-right or
      // top-to-bottom, so the two cells that share an edge get the same point.
      const topX = x + crossing(tl, tr, level);
      const bottomX = x + crossing(bl, br, level);
      const leftY = y + crossing(tl, bl, level);
      const rightY = y + crossing(tr, br, level);
      const x1 = x + 1;
      const y1 = y + 1;

      switch (code) {
        case 1:
        case 14:
          pushSegment(out, x, leftY, bottomX, y1);
          break;
        case 2:
        case 13:
          pushSegment(out, bottomX, y1, x1, rightY);
          break;
        case 3:
        case 12:
          pushSegment(out, x, leftY, x1, rightY);
          break;
        case 4:
        case 11:
          pushSegment(out, topX, y, x1, rightY);
          break;
        case 6:
        case 9:
          pushSegment(out, topX, y, bottomX, y1);
          break;
        case 7:
        case 8:
          pushSegment(out, topX, y, x, leftY);
          break;
        default: {
          // 5 and 10: two opposite corners are inside.
          const joined = (tl + tr + br + bl) / 4 >= level;
          if ((code === 5) === joined) {
            pushSegment(out, topX, y, x, leftY);
            pushSegment(out, bottomX, y1, x1, rightY);
          } else {
            pushSegment(out, topX, y, x1, rightY);
            pushSegment(out, x, leftY, bottomX, y1);
          }
        }
      }
    }
  }
  return out;
}

/**
 * A repeatable pseudo-random number 0..1 for one lattice point.
 */
function latticeValue(ix, iy, seed, octave) {
  let h =
    (Math.imul(ix, 0x27d4eb2d) +
      Math.imul(iy, 0x165667b1) +
      Math.imul(seed, 0x9e3779b1) +
      Math.imul(octave + 1, 0x85ebca77)) |
    0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function valueNoise(u, v, seed, octave) {
  const ix = Math.floor(u);
  const iy = Math.floor(v);
  const fx = fade(u - ix);
  const fy = fade(v - iy);
  const a = latticeValue(ix, iy, seed, octave);
  const b = latticeValue(ix + 1, iy, seed, octave);
  const c = latticeValue(ix, iy + 1, seed, octave);
  const d = latticeValue(ix + 1, iy + 1, seed, octave);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return top + (bottom - top) * fy;
}

/**
 * A smooth, repeatable "pressure" field: three octaves of value noise,
 * stretched so the lowest value is 0 and the highest is 1. The same seed
 * always gives the same field. The broadest octave is two noise cells across
 * the longer side, whatever the resolution.
 * @param {number} cols
 * @param {number} rows
 * @param {number} seed
 * @returns {Float32Array} cols * rows values in 0..1, row-major
 */
export function noiseField(cols, rows, seed) {
  const w = cols > 0 ? Math.floor(cols) : 0;
  const h = rows > 0 ? Math.floor(rows) : 0;
  const out = new Float32Array(w * h);
  if (out.length === 0) return out;

  const s = Number.isFinite(seed) ? Math.floor(seed) | 0 : 0;
  const base = BASE_CELLS / (Math.max(w, h, 2) - 1);
  let min = Infinity;
  let max = -Infinity;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let total = 0;
      let amp = 1;
      let freq = base;
      for (let o = 0; o < OCTAVES; o++) {
        // The half-cell offset keeps lattice points off the grid nodes.
        sum += amp * valueNoise(x * freq + 0.5, y * freq + 0.5, s, o);
        total += amp;
        amp *= GAIN;
        freq *= 2;
      }
      const i = y * w + x;
      out[i] = sum / total;
      const stored = out[i];
      if (stored < min) min = stored;
      if (stored > max) max = stored;
    }
  }

  const range = max - min;
  for (let i = 0; i < out.length; i++) {
    const v = range > 0 ? (out[i] - min) / range : 0.5;
    out[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  return out;
}

// A number that is the same for two points in the same place.
function pointKey(x, y) {
  return Math.round(x * 1024) * 4194304 + Math.round(y * 1024);
}

function addEnd(ends, key, end) {
  const list = ends.get(key);
  if (list) list.push(end);
  else ends.set(key, [end]);
}

// Follow segments end to end, starting from one end of one segment.
function trace(segs, ends, used, startEnd) {
  const pts = [];
  let end = startEnd;
  const first = (end >> 1) * 4 + (end & 1) * 2;
  pts.push(segs[first], segs[first + 1]);
  const startKey = pointKey(segs[first], segs[first + 1]);
  let lastKey = startKey;

  while (end !== -1) {
    const seg = end >> 1;
    used[seg] = 1;
    const far = seg * 4 + ((end ^ 1) & 1) * 2;
    pts.push(segs[far], segs[far + 1]);
    lastKey = pointKey(segs[far], segs[far + 1]);
    end = -1;
    const list = ends.get(lastKey);
    for (let k = 0; k < list.length; k++) {
      if (!used[list[k] >> 1]) {
        end = list[k];
        break;
      }
    }
  }

  const closed = pts.length >= 8 && lastKey === startKey;
  if (closed) pts.length -= 2;
  return { pts: evenOut(pts, closed), closed };
}

// Where a line clips the corner of a cell it leaves two points almost on top
// of each other, and the curve would kink there. Swap each such pair for the
// point midway between them. The ends of an open line are left where they are.
function evenOut(pts, closed) {
  const n = pts.length >> 1;
  if (n < 4) return pts;
  const stop = closed ? n : n - 1;
  const out = [pts[0], pts[1]];
  let i = 1;
  while (i < stop) {
    const x = pts[i * 2];
    const y = pts[i * 2 + 1];
    if (i + 1 < stop) {
      const dx = pts[i * 2 + 2] - x;
      const dy = pts[i * 2 + 3] - y;
      if (dx * dx + dy * dy < MIN_GAP * MIN_GAP) {
        out.push(x + dx / 2, y + dy / 2);
        i += 2;
        continue;
      }
    }
    out.push(x, y);
    i += 1;
  }
  if (!closed) out.push(pts[(n - 1) * 2], pts[(n - 1) * 2 + 1]);
  return closed && out.length < 6 ? pts : out;
}

/**
 * Join loose segments into polylines. Lines that run off the edge of the
 * field come out open; rings come out closed (first point not repeated).
 * @param {number[]} segs flat [x0, y0, x1, y1, ...]
 * @returns {{ pts: number[], closed: boolean }[]}
 */
function joinSegments(segs) {
  const lines = [];
  const count = segs.length >> 2;
  if (count === 0) return lines;

  const ends = new Map();
  const used = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const a = pointKey(segs[i * 4], segs[i * 4 + 1]);
    const b = pointKey(segs[i * 4 + 2], segs[i * 4 + 3]);
    if (a === b) {
      // A speck where the line clips the very corner of a cell: its two
      // neighbours already meet at this point, so it can be left out.
      used[i] = 1;
      continue;
    }
    addEnd(ends, a, i * 2);
    addEnd(ends, b, i * 2 + 1);
  }

  // Open lines first: they start where only one segment ends.
  for (let end = 0; end < count * 2; end++) {
    if (used[end >> 1]) continue;
    const at = (end >> 1) * 4 + (end & 1) * 2;
    if (ends.get(pointKey(segs[at], segs[at + 1])).length !== 1) continue;
    lines.push(trace(segs, ends, used, end));
  }
  // Whatever is left belongs to closed rings.
  for (let seg = 0; seg < count; seg++) {
    if (!used[seg]) lines.push(trace(segs, ends, used, seg * 2));
  }
  return lines;
}

// A ring smaller than one grid cell would only show as a stray dot.
function isSpeck(pts) {
  let minX = pts[0];
  let maxX = pts[0];
  let minY = pts[1];
  let maxY = pts[1];
  for (let i = 2; i < pts.length; i += 2) {
    if (pts[i] < minX) minX = pts[i];
    if (pts[i] > maxX) maxX = pts[i];
    if (pts[i + 1] < minY) minY = pts[i + 1];
    if (pts[i + 1] > maxY) maxY = pts[i + 1];
  }
  return maxX - minX < SPECK_SIZE && maxY - minY < SPECK_SIZE;
}

// Add polylines to the current path as smooth curves: each corner becomes the
// control point of a curve that runs between the middles of its two sides.
function addSmoothLines(ctx, lines, sx, sy) {
  for (let l = 0; l < lines.length; l++) {
    const p = lines[l].pts;
    const n = p.length >> 1;
    if (n < 2) continue;

    if (lines[l].closed && n >= 3) {
      if (n <= 8 && isSpeck(p)) continue;
      ctx.moveTo(((p[(n - 1) * 2] + p[0]) / 2) * sx, ((p[(n - 1) * 2 + 1] + p[1]) / 2) * sy);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        ctx.quadraticCurveTo(
          p[i * 2] * sx,
          p[i * 2 + 1] * sy,
          ((p[i * 2] + p[j * 2]) / 2) * sx,
          ((p[i * 2 + 1] + p[j * 2 + 1]) / 2) * sy
        );
      }
      ctx.closePath();
      continue;
    }

    ctx.moveTo(p[0] * sx, p[1] * sy);
    if (n === 2) {
      ctx.lineTo(p[2] * sx, p[3] * sy);
      continue;
    }
    for (let i = 1; i < n - 1; i++) {
      const j = i + 1;
      const last = j === n - 1;
      ctx.quadraticCurveTo(
        p[i * 2] * sx,
        p[i * 2 + 1] * sy,
        (last ? p[j * 2] : (p[i * 2] + p[j * 2]) / 2) * sx,
        (last ? p[j * 2 + 1] : (p[i * 2 + 1] + p[j * 2 + 1]) / 2) * sy
      );
    }
  }
}

function clamp(v, lo, hi) {
  if (hi < lo) return (lo + hi) / 2;
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Draw one pressure chart into a canvas. Sizes the bitmap to the canvas's CSS
 * box at devicePixelRatio 1 and draws once. Does nothing (and returns false)
 * while the canvas has no size, for example inside a hidden section.
 * @param {HTMLCanvasElement} canvas
 * @param {{ seed: number, tone: "dark" | "paper", levels?: number, labels?: boolean }} opts
 *   seed picks the chart; tone picks the ink; levels is the number of contour
 *   levels (7, or 5 when the box is under 600 px wide); labels (default true)
 *   draws the "L" and "H".
 * @returns {boolean} true when something was drawn
 */
export function drawIsobars(canvas, opts) {
  const o = opts || {};
  if (!canvas || typeof canvas.getContext !== "function") return false;

  const boxW = Math.round(canvas.clientWidth || 0);
  const boxH = Math.round(canvas.clientHeight || 0);
  if (boxW < 2 || boxH < 2) return false;

  const shrink = Math.min(1, MAX_BITMAP_SIDE / Math.max(boxW, boxH));
  const w = Math.max(2, Math.round(boxW * shrink));
  const h = Math.max(2, Math.round(boxH * shrink));
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const tone = o.tone === "paper" ? TONES.paper : TONES.dark;
  const asked = Math.floor(Number(o.levels));
  const levels =
    asked >= 1 ? Math.min(asked, MAX_LEVELS) : boxW < NARROW_BOX ? LEVELS_NARROW : LEVELS_WIDE;

  // 40 x 24 for a wide box; turned on its side for a tall one (a phone
  // section), so the curves are not stretched into vertical stripes.
  const cols = boxH > boxW ? FIELD_SHORT : FIELD_LONG;
  const rows = boxH > boxW ? FIELD_LONG : FIELD_SHORT;
  const field = noiseField(cols, rows, Number(o.seed));

  let lowAt = 0;
  let highAt = 0;
  for (let i = 1; i < field.length; i++) {
    if (field[i] < field[lowAt]) lowAt = i;
    if (field[i] > field[highAt]) highAt = i;
  }
  const low = field[lowAt];
  const high = field[highAt];

  const sx = w / (cols - 1);
  const sy = h / (rows - 1);

  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = tone.line;
  ctx.beginPath();
  for (let i = 0; i < levels; i++) {
    const level = low + ((high - low) * (i + 1)) / (levels + 1);
    addSmoothLines(ctx, joinSegments(contours(field, cols, rows, level)), sx, sy);
  }
  ctx.stroke();

  if (o.labels !== false && high > low) {
    ctx.font = LABEL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = tone.label;
    ctx.fillText(
      "L",
      clamp((lowAt % cols) * sx, LABEL_INSET, w - LABEL_INSET),
      clamp(Math.floor(lowAt / cols) * sy, LABEL_INSET, h - LABEL_INSET)
    );
    ctx.fillText(
      "H",
      clamp((highAt % cols) * sx, LABEL_INSET, w - LABEL_INSET),
      clamp(Math.floor(highAt / cols) * sy, LABEL_INSET, h - LABEL_INSET)
    );
  }
  return true;
}

function ownCanvas(host) {
  for (let child = host.firstElementChild; child; child = child.nextElementSibling) {
    if (child.tagName === "CANVAS" && child.classList.contains("isobars")) return child;
  }
  return null;
}

function namesPlexMono(faces) {
  if (!faces) return false;
  for (let i = 0; i < faces.length; i++) {
    if (/IBM Plex Mono/i.test(String(faces[i].family))) return true;
  }
  return false;
}

/**
 * Give every [data-isobars] element its pressure-chart background. The
 * attribute's value is the integer seed; data-isobars-tone is "dark" (the
 * default) or "paper". A <canvas class="isobars" aria-hidden="true"> goes in
 * as the element's first child, is drawn, and is redrawn when its box changes
 * size (debounced by 150 ms). Elements that already have a canvas in the care
 * of an earlier call are skipped.
 * @param {Document | Element} [root] where to look; defaults to document
 * @returns {() => void} call it to stop watching (the canvases stay in place)
 */
export function initIsobars(root) {
  const scope = root || (typeof document !== "undefined" ? document : null);
  if (!scope || typeof scope.querySelectorAll !== "function") return function disconnect() {};

  const doc = scope.nodeType === 9 ? scope : scope.ownerDocument;
  const view = doc.defaultView;
  const hosts = [];
  if (scope.nodeType === 1 && scope.hasAttribute("data-isobars")) hosts.push(scope);
  const found = scope.querySelectorAll("[data-isobars]");
  for (let i = 0; i < found.length; i++) hosts.push(found[i]);

  const items = [];
  let timer = 0;
  let repaintAll = false;

  const paint = (item) => {
    item.w = item.canvas.clientWidth;
    item.h = item.canvas.clientHeight;
    drawIsobars(item.canvas, item.opts);
  };

  const flush = () => {
    timer = 0;
    const all = repaintAll;
    repaintAll = false;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (all || item.canvas.clientWidth !== item.w || item.canvas.clientHeight !== item.h) {
        paint(item);
      }
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, RESIZE_DEBOUNCE_MS);
  };

  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;

  for (let i = 0; i < hosts.length; i++) {
    const host = hosts[i];
    let canvas = ownCanvas(host);
    if (canvas && managed.has(canvas)) continue;
    if (!canvas) {
      canvas = doc.createElement("canvas");
      canvas.className = "isobars";
      canvas.setAttribute("aria-hidden", "true");
      host.insertBefore(canvas, host.firstChild);
    }
    managed.add(canvas);
    const item = {
      canvas,
      opts: {
        seed: parseInt(host.getAttribute("data-isobars"), 10) || 0,
        tone: host.getAttribute("data-isobars-tone") === "paper" ? "paper" : "dark",
      },
      w: 0,
      h: 0,
    };
    items.push(item);
    paint(item);
    if (observer) observer.observe(canvas);
  }

  if (!observer && view) view.addEventListener("resize", schedule);

  // The letters are drawn in IBM Plex Mono; if that font turns up after the
  // first draw, draw again so they are not left in the fallback face.
  const fonts = doc.fonts && typeof doc.fonts.addEventListener === "function" ? doc.fonts : null;
  const onFonts = (event) => {
    if (items.length === 0 || !namesPlexMono(event && event.fontfaces)) return;
    repaintAll = true;
    schedule();
  };
  if (fonts) fonts.addEventListener("loadingdone", onFonts);

  return function disconnect() {
    if (timer) clearTimeout(timer);
    timer = 0;
    if (observer) observer.disconnect();
    else if (view) view.removeEventListener("resize", schedule);
    if (fonts) fonts.removeEventListener("loadingdone", onFonts);
    for (let i = 0; i < items.length; i++) managed.delete(items[i].canvas);
    items.length = 0;
  };
}
