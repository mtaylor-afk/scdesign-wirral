// WV Roofing v2 — the quick-preview engine in a Web Worker, so the page stays
// smooth while eight roofs are drawn. It is a module worker loaded from this
// same origin (the site's security policy allows no blob: workers).
//
// A "scene" is one photo with one roof outline at one size. The page keeps two:
// a quick one (about 800 px) for thumbnails and first paint, and a full one
// (the photo's working size) for the big view, the saved image and the card.
//
// Messages in (every one carries `gen`, echoed back, so the page can ignore stale answers):
//   { type: "scene", gen, scene, data: ArrayBuffer (RGBA), w, h, mask: ArrayBuffer (Uint8, 0/255) }
//   { type: "render", gen, scene, id, product, condition }   one finish under one mood
//   { type: "before", gen, scene, id, condition }             the untouched photo under that mood
//   { type: "drop", scene }                                    forget a scene (frees its memory)
// Messages out:
//   { type: "ready" }                                          once, when the worker has loaded
//   { type: "scene", gen, scene, ok, frac, eaves, ms }
//   { type: "render" | "before", gen, scene, id, productId, condition, data: ArrayBuffer, w, h, ms }
//   { type: "error", gen, scene, id, message }
import { analyseRoof, renderPreview } from "./preview.js";
import { gradePixels, conditionById } from "./grade.js";
import { maskStats } from "./mask-ops.js";

const scenes = new Map(); // name -> { photo, analysis, rendered: Map(productId -> pixels) }

// Finished roofs kept per scene (the least recently used is let go first).
// Switching the weather on a roof re-uses its drawing, and three is enough for
// going back and forth without holding eight full-size copies in memory.
const KEEP_RENDERS = 3;

function handle(m) {
  if (m.type === "scene") {
    const t0 = Date.now();
    const photo = { data: new Uint8ClampedArray(m.data), width: m.w, height: m.h };
    const mask = new Uint8Array(m.mask);
    const analysis = analyseRoof(photo, mask);
    // The analysis carries everything the roofs need; the mask itself isn't kept.
    scenes.set(m.scene, { photo, analysis, rendered: new Map() });
    const st = maskStats(mask, m.w, m.h);
    self.postMessage({ type: "scene", gen: m.gen, scene: m.scene, ok: !!analysis, frac: st.frac, eaves: analysis ? analysis.eaves : null, ms: Date.now() - t0 });
    return;
  }
  if (m.type === "drop") {
    scenes.delete(m.scene);
    return;
  }
  const s = scenes.get(m.scene);
  if (!s) throw new Error("no scene");
  const t0 = Date.now();
  const { photo } = s;
  const cond = conditionById(m.condition);
  let px;
  let productId = "";
  if (m.type === "before") {
    px = photo.data;
  } else {
    if (!s.analysis) throw new Error("no roof marked");
    productId = m.product.id;
    px = s.rendered.get(productId);
    if (px) {
      s.rendered.delete(productId); // most recently used goes to the back
    } else {
      px = renderPreview(s.analysis, photo, m.product, 1);
    }
    s.rendered.set(productId, px);
    if (s.rendered.size > KEEP_RENDERS) s.rendered.delete(s.rendered.keys().next().value);
  }
  // The "before" stays dry: only a new roof gets the wet sheen.
  const roof = m.type === "render" && s.analysis ? { alpha: s.analysis.alpha, analysis: s.analysis } : null;
  const out = gradePixels(px, photo.width, photo.height, cond, roof);
  const buf = out.buffer;
  self.postMessage({ type: m.type, gen: m.gen, scene: m.scene, id: m.id, productId, condition: cond.id, data: buf, w: photo.width, h: photo.height, ms: Date.now() - t0 }, [buf]);
}

self.onmessage = (e) => {
  const m = e.data || {};
  try {
    handle(m);
  } catch (err) {
    self.postMessage({ type: "error", gen: m.gen, scene: m.scene, id: m.id, message: (err && err.message) || String(err) });
  }
};

self.postMessage({ type: "ready" });
