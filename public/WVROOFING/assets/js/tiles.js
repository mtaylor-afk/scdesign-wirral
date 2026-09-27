// WV Roofing — procedural roof-tile maths, shared by the swatches on every page
// and the Roof Visualiser's instant "quick previews". Nothing here is a
// manufacturer image: every tile is drawn from the numbers in catalogue.json.

export function clamp(x, a, b) {
  return x < a ? a : x > b ? b : x;
}

export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Deterministic integer hash -> [0, 1). */
export function hash2(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Brightness multiplier (k) and per-tile colour mix (t) at a point in
 * tile space. u runs across the roof in course-height units; v runs DOWN the
 * roof in courses (each course's visible band starts just under the leading
 * edge of the course above, which casts the shadow modelled by lapDark).
 */
export function tileAt(u, v, p) {
  const row = Math.floor(v);
  const fv = v - row;
  const offset = row & 1 ? p.bond || 0 : 0;
  const uu = u / (p.tileAspect || 1) + offset;
  const col = Math.floor(uu);
  const fu = uu - col;
  const t = hash2(row, col);
  let k = 1 + (p.jitter || 0) * (hash2(col * 7 + 3, row * 13 + 1) - 0.5) * 2;

  const lapW = p.lapW || 0.15;
  k *= 1 - (p.lapDark || 0) * (1 - smoothstep(0, lapW, fv));
  k *= 0.95 + 0.08 * fv;

  if (p.jointDark) {
    const dj = Math.min(fu, 1 - fu);
    k *= 1 - p.jointDark * (1 - smoothstep(0, p.jointW || 0.03, dj));
  }

  if (p.type === "pantile" || p.type === "roman" || p.type === "granular") {
    const ph = fu * (p.waves || 1);
    const f = ph - Math.floor(ph);
    let slope;
    let height;
    if (p.type === "roman") {
      // narrow round rolls separated by flat pans
      const x = (f - 0.5) / 0.32;
      if (Math.abs(x) < 1) {
        const s = Math.sqrt(1 - x * x);
        height = s;
        slope = clamp(-x / Math.max(0.2, s), -2.5, 2.5) / 2.5;
      } else {
        height = 0;
        slope = 0;
      }
    } else {
      height = 0.5 + 0.5 * Math.sin(2 * Math.PI * f);
      slope = Math.cos(2 * Math.PI * f);
    }
    // light from the upper left; troughs slightly occluded
    k *= 1 + (p.amp || 0) * (0.55 * slope - 0.35 * (1 - height));
  }
  if (p.type === "plain") {
    k *= 1 - 0.06 * Math.pow(Math.abs(fu - 0.5) * 2, 2); // camber
  }
  return { k, t, row, col };
}

/** Per-pixel surface texture (riven slate, sand-faced / granular finishes). */
export function grainAt(x, y, p) {
  const g = hash2(x * 3 + 17, y * 5 + 11) - 0.5;
  if (p.type === "granular") return 1 + 0.1 * g;
  if (p.type === "plain") return 1 + 0.06 * g;
  if (p.type === "slate") return 1 + 0.035 * g;
  return 1 + 0.025 * g;
}

/** How many courses a ~1.4 m swatch shows (keeps real-world proportions). */
export function swatchCourses(p) {
  return clamp((p.courses || 14) / 3.2, 4, 14);
}

/**
 * Draw a product swatch into a canvas at its current pixel size.
 * @param {HTMLCanvasElement} canvas
 * @param {{hex:string[], pattern:object}} product
 */
export function drawSwatch(canvas, product) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || !w || !h) return;
  const p = product.pattern || {};
  const c1 = hexToRgb(product.hex && product.hex[0]);
  const c2 = hexToRgb(product.hex && product.hex[1]);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const p0 = h / swatchCourses(p);
  for (let y = 0; y < h; y++) {
    const v = y / p0 + 0.35;
    const light = 1.06 - 0.12 * (y / h); // soft sky light from above
    for (let x = 0; x < w; x++) {
      const s = tileAt(x / p0 + 0.2, v, p);
      const g = grainAt(x, y, p);
      const k = s.k * g * light;
      const i = (y * w + x) * 4;
      d[i] = clamp((c1[0] + (c2[0] - c1[0]) * s.t) * k, 0, 255);
      d[i + 1] = clamp((c1[1] + (c2[1] - c1[1]) * s.t) * k, 0, 255);
      d[i + 2] = clamp((c1[2] + (c2[2] - c1[2]) * s.t) * k, 0, 255);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Size a canvas to its CSS box (capped) and draw the swatch. */
export function paintSwatchElement(canvas, product, maxW) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = rect.width || 240;
  const cssH = rect.height || cssW * 0.75;
  const scale = Math.min(dpr, (maxW || 480) / cssW);
  canvas.width = Math.max(40, Math.round(cssW * scale));
  canvas.height = Math.max(30, Math.round(cssH * scale));
  drawSwatch(canvas, product);
}
