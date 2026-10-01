// WV Roofing v2 — the page's side of the preview engine.
//
// The heavy pixel work (roof analysis, re-tiling, the weather grade) runs in a
// module Web Worker (preview-worker.js). If the worker can't start (an older
// browser), the same maths runs on the page instead: slower, but it works.
//
// The engine sends the worker one job at a time from its own queue, so a roof
// the visitor has just tapped can jump ahead of the ones still waiting. A new
// outline (a scene) always goes first, and nothing is ever sent ahead of the
// scene it was asked for.
import { buildMask } from "./mask-ops.js";

// How long the worker may take to start before the page does the work itself.
// Generous: on a slow connection its four small modules can take a while, and
// a worker that can't load at all says so at once (its error event).
const READY_MS = 8000;

// Finished roofs kept per scene (the least recently used is let go first).
// Switching the weather on a roof re-uses its drawing, and three is enough for
// going back and forth without holding eight full-size copies in memory.
const KEEP_RENDERS = 3;

/** The same jobs as the worker, run on the page (the fallback). */
class LocalBackend {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.scenes = new Map();
    this.mods = null;
    this.loading = null;
    // Start fetching the maths now, before any photo arrives, so the first
    // roof doesn't wait for it (and nothing is fetched once a photo is in).
    this.load().catch(() => {});
  }

  load() {
    if (this.mods) return Promise.resolve(this.mods);
    if (!this.loading) {
      this.loading = Promise.all([import("./preview.js"), import("./grade.js"), import("./mask-ops.js")]).then(
        ([preview, grade, ops]) => {
          this.mods = { preview, grade, ops };
          return this.mods;
        },
        (err) => {
          this.loading = null; // the next job tries again
          throw err;
        }
      );
    }
    return this.loading;
  }

  async post(m) {
    try {
      const { preview, grade, ops } = await this.load();
      await new Promise((res) => setTimeout(res, 0)); // let the page paint first
      if (m.type === "scene") {
        const t0 = Date.now();
        const photo = { data: new Uint8ClampedArray(m.data), width: m.w, height: m.h };
        const mask = new Uint8Array(m.mask);
        const analysis = preview.analyseRoof(photo, mask);
        this.scenes.set(m.scene, { photo, analysis, rendered: new Map() });
        const st = ops.maskStats(mask, m.w, m.h);
        this.onMessage({ type: "scene", gen: m.gen, scene: m.scene, ok: !!analysis, frac: st.frac, eaves: analysis ? analysis.eaves : null, ms: Date.now() - t0 });
        return;
      }
      if (m.type === "drop") {
        this.scenes.delete(m.scene);
        return;
      }
      const s = this.scenes.get(m.scene);
      if (!s) throw new Error("no scene");
      const t0 = Date.now();
      const cond = grade.conditionById(m.condition);
      let px = s.photo.data;
      let productId = "";
      if (m.type === "render") {
        if (!s.analysis) throw new Error("no roof marked");
        productId = m.product.id;
        px = s.rendered.get(productId);
        if (px) {
          s.rendered.delete(productId); // most recently used goes to the back
        } else {
          px = preview.renderPreview(s.analysis, s.photo, m.product, 1);
        }
        s.rendered.set(productId, px);
        if (s.rendered.size > KEEP_RENDERS) s.rendered.delete(s.rendered.keys().next().value);
      }
      const roof = m.type === "render" ? { alpha: s.analysis.alpha, analysis: s.analysis } : null;
      const out = grade.gradePixels(px, s.photo.width, s.photo.height, cond, roof);
      this.onMessage({ type: m.type, gen: m.gen, scene: m.scene, id: m.id, productId, condition: cond.id, data: out.buffer, w: s.photo.width, h: s.photo.height, ms: Date.now() - t0 });
    } catch (err) {
      // A drop is not a job and expects no answer (an answer would free the queue early).
      if (m.type === "drop") return;
      this.onMessage({ type: "error", gen: m.gen, scene: m.scene, id: m.id, message: (err && err.message) || String(err) });
    }
  }
}

export class Engine {
  constructor() {
    this.seq = 0;
    this.gens = new Map(); // scene name -> generation (a new outline makes older answers stale)
    this.pending = new Map(); // job id -> { resolve, reject }
    this.queue = [];
    this.busy = false;
    this.mode = "starting"; // "worker" | "page"
    this.backend = null;
    this.ready = this.start();
  }

  /** Start the worker; fall back to the page if it hasn't said "ready" in time. */
  start() {
    return new Promise((resolve) => {
      let settled = false;
      const fallBack = () => {
        if (settled) return;
        settled = true;
        if (this.worker) {
          try {
            this.worker.terminate();
          } catch (err) {
            /* already gone */
          }
          this.worker = null;
        }
        this.mode = "page";
        this.backend = new LocalBackend((m) => this.receive(m));
        resolve(this.mode);
      };
      if (typeof Worker === "undefined") {
        fallBack();
        return;
      }
      try {
        this.worker = new Worker(new URL("./preview-worker.js", import.meta.url), { type: "module" });
      } catch (err) {
        fallBack();
        return;
      }
      const timer = setTimeout(fallBack, READY_MS);
      this.worker.onerror = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        clearTimeout(timer);
        if (!settled) {
          fallBack();
          return;
        }
        // It broke after starting (out of memory, say): fail what was asked of it,
        // and draw on the page from now on. The page's next scene() starts afresh.
        try {
          this.worker.terminate();
        } catch (err) {
          /* already gone */
        }
        this.worker = null;
        this.mode = "page";
        this.backend = new LocalBackend((m) => this.receive(m));
        this.busy = false;
        for (const job of this.pending.values()) job.reject(new Error("The drawing thread stopped"));
        this.pending.clear();
        this.queue = [];
      };
      const t0 = typeof performance !== "undefined" ? performance.now() : 0;
      this.worker.onmessage = (e) => {
        const m = e.data || {};
        if (m.type === "ready") {
          this.readyMs = Math.round(performance.now() - t0);
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.mode = "worker";
          this.backend = { post: (msg, transfer) => this.worker.postMessage(msg, transfer || []) };
          resolve(this.mode);
          return;
        }
        this.receive(m);
      };
    });
  }

  receive(m) {
    // Scene answers (and errors while setting a scene up) carry no job id.
    const key = m.id != null ? m.id : "scene:" + m.scene + ":" + m.gen;
    const job = this.pending.get(key);
    this.busy = false;
    if (job) {
      this.pending.delete(key);
      if (m.type === "error") job.reject(new Error(m.message));
      else if (m.gen !== this.gens.get(m.scene)) job.reject(new Error("stale"));
      else job.resolve(m);
    }
    this.pump();
  }

  /** Reject one job's promise (if it is still waiting). */
  fail(key, err) {
    const job = this.pending.get(key);
    if (!job) return;
    this.pending.delete(key);
    job.reject(err);
  }

  pump() {
    if (this.busy || !this.backend) return;
    for (;;) {
      const next = this.queue.shift();
      if (!next) return;
      if (next.msg.gen !== this.gens.get(next.msg.scene)) {
        // Asked for before the outline changed, or an outline a newer one has
        // replaced: no longer wanted, and never sent.
        this.fail(next.key, new Error("stale"));
        continue;
      }
      this.busy = true;
      this.backend.post(next.msg, next.transfer);
      return;
    }
  }

  enqueue(key, msg, transfer, first) {
    return new Promise((resolve, reject) => {
      this.pending.set(key, { resolve, reject });
      const item = { key, msg, transfer };
      if (msg.type === "scene") {
        // A new outline goes to the front. An older one for the same scene
        // that is still waiting is dropped, so the worker never gets them in
        // the wrong order.
        this.queue = this.queue.filter((q) => {
          if (q.msg.type !== "scene" || q.msg.scene !== msg.scene) return true;
          this.fail(q.key, new Error("stale"));
          return false;
        });
        this.queue.unshift(item);
      } else if (first) {
        // Ahead of the other roofs, but behind any outline still waiting: a
        // job must run on the outline it was asked for, not the one before.
        const i = this.queue.findIndex((q) => q.msg.type !== "scene");
        this.queue.splice(i < 0 ? this.queue.length : i, 0, item);
      } else {
        this.queue.push(item);
      }
      this.ready.then(() => this.pump());
    });
  }

  /**
   * Set (or replace) a scene: the photo and its roof outline at one size.
   * @param {string} name  e.g. "quick" or "full"
   * @param {HTMLCanvasElement|HTMLImageElement} source the photo
   * @param {Array<{mode:string,pts:number[][],r?:number}>} shapes in the source's own pixels
   * @param {{maxEdge?:number, sourceW?:number, sourceH?:number}} [opts]
   * @returns {Promise<{ok:boolean, frac:number, eaves:object|null, w:number, h:number, mask:Uint8Array, scale:number, ms:number}>}
   */
  async scene(name, source, shapes, opts) {
    const o = opts || {};
    const sw = o.sourceW || source.naturalWidth || source.width;
    const sh = o.sourceH || source.naturalHeight || source.height;
    const scale = Math.min(1, (o.maxEdge || Math.max(sw, sh)) / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, sw, sh, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    c.width = 0;
    const mask = buildMask(shapes, w, h, w / sw, h / sh);
    const keep = mask.slice();
    const gen = (this.gens.get(name) || 0) + 1;
    this.gens.set(name, gen);
    // Anything still queued for the old outline is dropped by pump().
    const transfer = [img.data.buffer, mask.buffer];
    const m = await this.enqueue("scene:" + name + ":" + gen, { type: "scene", gen, scene: name, data: img.data.buffer, w, h, mask: mask.buffer }, transfer, true);
    return { ok: m.ok, frac: m.frac, eaves: m.eaves, w, h, mask: keep, scale, ms: m.ms };
  }

  /**
   * One finish under one mood.
   * @returns {Promise<{image:ImageData, ms:number, productId:string, condition:string}>}
   */
  async render(name, product, condition, opts) {
    const id = "r" + ++this.seq;
    const gen = this.gens.get(name);
    const m = await this.enqueue(id, { type: "render", gen, scene: name, id, product, condition: condition || "noon" }, null, !!(opts && opts.first));
    return { image: new ImageData(new Uint8ClampedArray(m.data), m.w, m.h), ms: m.ms, productId: m.productId, condition: m.condition };
  }

  /** The untouched photo under one mood (for "hold to see before"). */
  async before(name, condition, opts) {
    const id = "b" + ++this.seq;
    const gen = this.gens.get(name);
    const m = await this.enqueue(id, { type: "before", gen, scene: name, id, condition: condition || "noon" }, null, !!(opts && opts.first));
    return { image: new ImageData(new Uint8ClampedArray(m.data), m.w, m.h), ms: m.ms, condition: m.condition };
  }

  drop(name) {
    this.gens.set(name, (this.gens.get(name) || 0) + 1);
    this.ready.then(() => this.backend && this.backend.post({ type: "drop", scene: name }));
  }

  dispose() {
    if (this.worker) this.worker.terminate();
    this.worker = null;
    this.queue = [];
    for (const job of this.pending.values()) job.reject(new Error("disposed"));
    this.pending.clear();
  }
}

/** True when an engine promise was rejected only because a newer outline replaced it. */
export function isStale(err) {
  return !!err && (err.message === "stale" || err.message === "disposed");
}
