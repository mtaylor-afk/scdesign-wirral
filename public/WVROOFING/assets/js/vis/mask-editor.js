// WV Roofing Roof Visualiser — the "mark your roof" editor.
//
// Tools: outline (tap round a roof slope to add it), cut-out (tap round a
// chimney / roof window to remove it), brush and erase (touch-ups). Points snap
// to strong edges nearby; on touch screens a magnifier loupe shows exactly
// where the point will land and the point is placed when the finger lifts.
// Shapes are kept in photo pixel coordinates, so the same outline can be
// re-rasterised at any resolution (see mask-ops buildMask).
import { buildMask, maskStats } from "./mask-ops.js";

const LOUPE_CSS = 132;
const LOUPE_ZOOM = 3;

export class MaskEditor {
  /**
   * @param {{root:HTMLElement, photo:HTMLCanvasElement, onChange?:(s:object)=>void,
   *          announce?:(msg:string)=>void}} opts
   */
  constructor(opts) {
    this.root = opts.root;
    this.photo = opts.photo;
    this.w = this.photo.width;
    this.h = this.photo.height;
    this.onChange = opts.onChange || (() => {});
    this.announce = opts.announce || (() => {});
    this.shapes = [];
    this.past = [];
    this.future = [];
    this.draft = null;
    this.stroke = null;
    this.tool = "outline";
    this.snap = true;
    this.brushR = Math.max(4, Math.round(Math.max(this.w, this.h) * 0.012));
    this.hover = null;
    this.press = null;
    this.mask = null;
    this.grad = null;
    this.raf = 0;

    this.view = document.createElement("canvas");
    this.view.width = this.w;
    this.view.height = this.h;
    this.view.className = "editor-canvas";
    this.view.tabIndex = 0;
    this.view.setAttribute("role", "img");
    this.view.setAttribute(
      "aria-label",
      "Your photo. Tap round the edge of each roof slope to mark it; tap the first point again to close the shape."
    );
    this.overlay = document.createElement("canvas");
    this.overlay.width = this.w;
    this.overlay.height = this.h;
    this.loupe = document.createElement("canvas");
    this.loupe.className = "editor-loupe";
    this.loupe.hidden = true;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.loupe.width = Math.round(LOUPE_CSS * dpr);
    this.loupe.height = Math.round(LOUPE_CSS * dpr);
    this.root.replaceChildren(this.view, this.loupe);

    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onLeave = this.onLeave.bind(this);
    this.onKey = this.onKey.bind(this);
    this.fit = this.fit.bind(this);
    this.view.addEventListener("pointerdown", this.onDown);
    this.view.addEventListener("pointermove", this.onMove);
    this.view.addEventListener("pointerup", this.onUp);
    this.view.addEventListener("pointercancel", this.onUp);
    this.view.addEventListener("pointerleave", this.onLeave);
    this.view.addEventListener("dblclick", (e) => {
      e.preventDefault();
      this.finishDraft();
    });
    this.view.addEventListener("keydown", this.onKey);
    window.addEventListener("resize", this.fit);
    this.fit();
    this.rebuildOverlay();
    this.render();
  }

  destroy() {
    window.removeEventListener("resize", this.fit);
    cancelAnimationFrame(this.raf);
  }

  /** Keep the whole photo visible: limit the canvas height on tall photos. */
  fit() {
    const maxH = Math.max(260, window.innerHeight * 0.7);
    const avail = this.root.clientWidth || this.w;
    const cssW = Math.min(avail, (maxH * this.w) / this.h);
    this.view.style.width = Math.round(cssW) + "px";
  }

  /** Image pixels per CSS pixel (line widths and hit radii stay constant on screen). */
  scale() {
    const r = this.view.getBoundingClientRect();
    return r.width ? this.w / r.width : 1;
  }

  toImage(e) {
    const r = this.view.getBoundingClientRect();
    const x = ((e.clientX - r.left) * this.w) / r.width;
    const y = ((e.clientY - r.top) * this.h) / r.height;
    return [Math.max(0, Math.min(this.w - 0.01, x)), Math.max(0, Math.min(this.h - 0.01, y))];
  }

  setTool(tool) {
    if (this.draft && tool !== this.tool) this.cancelDraft();
    this.tool = tool;
    this.view.dataset.tool = tool;
    this.requestRender();
  }

  setBrush(cssPx) {
    this.brushR = Math.max(2, Math.round(cssPx * this.scale()));
    this.requestRender();
  }

  setSnap(on) {
    this.snap = !!on;
  }

  // ---- history ----------------------------------------------------------------

  commit(next) {
    this.past.push(this.shapes);
    if (this.past.length > 60) this.past.shift();
    this.shapes = next;
    this.future = [];
    this.changed();
  }

  setShapes(shapes) {
    this.shapes = (shapes || []).map((s) => ({ mode: s.mode === "sub" ? "sub" : "add", pts: s.pts.map((p) => [p[0], p[1]]), r: s.r }));
    this.past = [];
    this.future = [];
    this.draft = null;
    this.changed();
  }

  getShapes() {
    return this.shapes.map((s) => ({ mode: s.mode, pts: s.pts.map((p) => [Math.round(p[0]), Math.round(p[1])]), ...(s.r ? { r: s.r } : {}) }));
  }

  undo() {
    if (this.draft) {
      this.draft.pts.pop();
      if (!this.draft.pts.length) this.draft = null;
      this.announce(this.draft ? "Last point removed." : "Shape cancelled.");
      this.requestRender();
      return;
    }
    if (!this.past.length) return;
    this.future.push(this.shapes);
    this.shapes = this.past.pop();
    this.changed();
    this.announce("Undone.");
  }

  redo() {
    if (!this.future.length) return;
    this.past.push(this.shapes);
    this.shapes = this.future.pop();
    this.changed();
    this.announce("Redone.");
  }

  clear() {
    if (!this.shapes.length && !this.draft) return;
    this.draft = null;
    this.commit([]);
    this.announce("Roof marking cleared. You can undo this.");
  }

  canUndo() {
    return !!this.draft || this.past.length > 0;
  }

  canRedo() {
    return this.future.length > 0;
  }

  changed() {
    this.mask = null;
    this.rebuildOverlay();
    this.requestRender();
    this.onChange(this.stats());
  }

  getMask() {
    if (!this.mask) this.mask = buildMask(this.shapes, this.w, this.h, 1, 1);
    return this.mask;
  }

  stats() {
    const st = maskStats(this.getMask(), this.w, this.h);
    let warning = "";
    if (!st.empty && st.frac < 0.005) warning = "small";
    else if (st.frac > 0.6) warning = "large";
    return Object.assign(st, { warning, shapes: this.shapes.length, drafting: !!this.draft });
  }

  // ---- drafting ----------------------------------------------------------------

  addPoint(p) {
    const q = this.snap ? this.snapPoint(p) : p;
    if (!this.draft) {
      this.draft = { mode: this.tool === "cutout" ? "sub" : "add", pts: [q] };
      this.announce("First point placed. Keep tapping round the edge, then tap the first point to finish.");
    } else {
      const first = this.draft.pts[0];
      const k = this.scale();
      const near = Math.hypot(first[0] - p[0], first[1] - p[1]) <= 18 * k;
      if (this.draft.pts.length >= 3 && near) {
        this.finishDraft();
        return;
      }
      this.draft.pts.push(q);
      this.announce("Point " + this.draft.pts.length + " placed.");
    }
    this.requestRender();
    this.onChange(this.stats());
  }

  finishDraft() {
    if (!this.draft) return;
    if (this.draft.pts.length < 3) {
      this.announce("A shape needs at least three points.");
      return;
    }
    const shape = this.draft;
    this.draft = null;
    this.commit(this.shapes.concat([shape]));
    this.announce(shape.mode === "sub" ? "Area cut out of the roof." : "Roof area added.");
  }

  cancelDraft() {
    if (!this.draft) return;
    this.draft = null;
    this.requestRender();
    this.onChange(this.stats());
  }

  // ---- snapping ----------------------------------------------------------------

  gradient() {
    if (this.grad) return this.grad;
    const { w, h } = this;
    const d = this.photo.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const L = new Float32Array(w * h);
    for (let i = 0, j = 0; i < L.length; i++, j += 4) L[i] = 0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2];
    const G = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1];
        const gy = L[i + w - 1] + 2 * L[i + w] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - w] - L[i - w + 1];
        G[i] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    this.grad = G;
    return G;
  }

  snapPoint(p) {
    const G = this.gradient();
    const { w, h } = this;
    const R = Math.max(2, Math.round(7 * this.scale()));
    const px = Math.round(p[0]);
    const py = Math.round(p[1]);
    const here = G[Math.max(0, Math.min(h - 1, py)) * w + Math.max(0, Math.min(w - 1, px))] || 0;
    let best = here;
    let bx = p[0];
    let by = p[1];
    for (let y = Math.max(1, py - R); y <= Math.min(h - 2, py + R); y++) {
      for (let x = Math.max(1, px - R); x <= Math.min(w - 2, px + R); x++) {
        const dd = (x - px) * (x - px) + (y - py) * (y - py);
        if (dd > R * R) continue;
        // prefer nearer edges slightly
        const g = G[y * w + x] * (1 - (0.25 * dd) / (R * R));
        if (g > best) {
          best = g;
          bx = x + 0.5;
          by = y + 0.5;
        }
      }
    }
    return best > 60 && best > here * 1.3 ? [bx, by] : p;
  }

  // ---- pointer + keyboard -----------------------------------------------------

  onDown(e) {
    if (e.button !== undefined && e.button > 0) return;
    e.preventDefault();
    this.view.focus({ preventScroll: true });
    try {
      this.view.setPointerCapture(e.pointerId);
    } catch (err) {
      /* not all browsers allow capture for every pointer */
    }
    const p = this.toImage(e);
    this.hover = p;
    this.press = { x: e.clientX, y: e.clientY, type: e.pointerType, p };
    if (this.tool === "brush" || this.tool === "erase") {
      this.stroke = { mode: this.tool === "brush" ? "add" : "sub", r: this.brushR, pts: [p] };
    } else if (e.pointerType !== "mouse") {
      this.showLoupe(e);
    }
    this.requestRender();
  }

  onMove(e) {
    const p = this.toImage(e);
    this.hover = p;
    if (this.stroke) {
      const last = this.stroke.pts[this.stroke.pts.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= this.stroke.r / 3) this.stroke.pts.push(p);
    } else if (this.press && this.press.type !== "mouse") {
      this.showLoupe(e);
    }
    this.requestRender();
  }

  onUp(e) {
    const press = this.press;
    this.press = null;
    this.loupe.hidden = true;
    if (this.stroke) {
      const s = this.stroke;
      this.stroke = null;
      this.commit(this.shapes.concat([s]));
      return;
    }
    if (!press || e.type === "pointercancel") return;
    if (this.tool !== "outline" && this.tool !== "cutout") return;
    if (press.type === "mouse" && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) return;
    this.addPoint(press.type === "mouse" ? this.toImage(e) : this.hover || press.p);
  }

  onLeave(e) {
    if (e.pointerType === "mouse" && !this.stroke) {
      this.hover = null;
      this.requestRender();
    }
  }

  onKey(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === "Enter") {
      e.preventDefault();
      this.finishDraft();
    } else if (e.key === "Escape") {
      if (this.draft) {
        e.preventDefault();
        this.cancelDraft();
        this.announce("Shape cancelled.");
      }
    } else if ((e.key === "Backspace" || e.key === "Delete") && this.draft) {
      e.preventDefault();
      this.undo();
    } else if (mod && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    } else if (mod && (e.key === "y" || e.key === "Y")) {
      e.preventDefault();
      this.redo();
    }
  }

  showLoupe(e) {
    const r = this.root.getBoundingClientRect();
    const lx = e.clientX - r.left;
    const ly = e.clientY - r.top;
    let left = lx - LOUPE_CSS - 24;
    let top = ly - LOUPE_CSS - 24;
    if (left < 4) left = lx + 24;
    if (top < 4) top = ly + 24;
    this.loupe.style.left = Math.round(left) + "px";
    this.loupe.style.top = Math.round(top) + "px";
    this.loupe.hidden = false;
  }

  // ---- drawing ----------------------------------------------------------------

  rebuildOverlay() {
    const { w, h } = this;
    const mask = this.getMask();
    const ctx = this.overlay.getContext("2d");
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (mask[i] < 128) continue;
        const edge =
          x === 0 || y === 0 || x === w - 1 || y === h - 1 || mask[i - 1] < 128 || mask[i + 1] < 128 || mask[i - w] < 128 || mask[i + w] < 128;
        const j = i * 4;
        if (edge) {
          d[j] = 255;
          d[j + 1] = 214;
          d[j + 2] = 92;
          d[j + 3] = 255;
        } else {
          d[j] = 201;
          d[j + 1] = 168;
          d[j + 2] = 76;
          d[j + 3] = 105;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  requestRender() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.render();
    });
  }

  render() {
    const ctx = this.view.getContext("2d");
    const k = this.scale();
    ctx.drawImage(this.photo, 0, 0);
    ctx.drawImage(this.overlay, 0, 0);

    const drawPath = (pts, close) => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      if (close) ctx.closePath();
    };

    if (this.stroke) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = this.stroke.r * 2;
      ctx.strokeStyle = this.stroke.mode === "add" ? "rgba(201,168,76,0.55)" : "rgba(47,111,222,0.5)";
      drawPath(this.stroke.pts.length > 1 ? this.stroke.pts : [this.stroke.pts[0], this.stroke.pts[0]]);
      ctx.stroke();
      ctx.restore();
    }

    if (this.draft) {
      const sub = this.draft.mode === "sub";
      const col = sub ? "#5b9cff" : "#ffd65c";
      const pts = this.draft.pts.slice();
      ctx.save();
      ctx.lineJoin = "round";
      if (pts.length >= 3) {
        ctx.fillStyle = sub ? "rgba(47,111,222,0.25)" : "rgba(201,168,76,0.28)";
        drawPath(pts, true);
        ctx.fill();
      }
      ctx.lineWidth = 2.5 * k;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      drawPath(pts);
      ctx.stroke();
      ctx.lineWidth = 1.6 * k;
      ctx.strokeStyle = col;
      drawPath(pts);
      ctx.stroke();
      if (this.hover && (this.tool === "outline" || this.tool === "cutout")) {
        const last = pts[pts.length - 1];
        ctx.setLineDash([6 * k, 5 * k]);
        ctx.beginPath();
        ctx.moveTo(last[0], last[1]);
        ctx.lineTo(this.hover[0], this.hover[1]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      pts.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p[0], p[1], (i === 0 ? 6.5 : 4.2) * k, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? "#ffffff" : col;
        ctx.fill();
        ctx.lineWidth = 1.5 * k;
        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.stroke();
      });
      if (pts.length >= 3 && this.hover) {
        const f = pts[0];
        if (Math.hypot(f[0] - this.hover[0], f[1] - this.hover[1]) <= 18 * k) {
          ctx.beginPath();
          ctx.arc(f[0], f[1], 12 * k, 0, Math.PI * 2);
          ctx.lineWidth = 2 * k;
          ctx.strokeStyle = "#ffffff";
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    if (this.hover && (this.tool === "brush" || this.tool === "erase") && !this.stroke) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.hover[0], this.hover[1], this.brushR, 0, Math.PI * 2);
      ctx.lineWidth = 1.5 * k;
      ctx.strokeStyle = this.tool === "brush" ? "#ffd65c" : "#5b9cff";
      ctx.stroke();
      ctx.restore();
    }

    if (!this.loupe.hidden && this.hover) {
      const lctx = this.loupe.getContext("2d");
      const lw = this.loupe.width;
      const src = lw / LOUPE_ZOOM / (lw / LOUPE_CSS) * k;
      lctx.imageSmoothingEnabled = false;
      lctx.fillStyle = "#000";
      lctx.fillRect(0, 0, lw, lw);
      lctx.drawImage(this.view, this.hover[0] - src / 2, this.hover[1] - src / 2, src, src, 0, 0, lw, lw);
      lctx.strokeStyle = "#ffffff";
      lctx.lineWidth = Math.max(1, lw / 90);
      lctx.beginPath();
      lctx.moveTo(lw / 2, lw * 0.3);
      lctx.lineTo(lw / 2, lw * 0.7);
      lctx.moveTo(lw * 0.3, lw / 2);
      lctx.lineTo(lw * 0.7, lw / 2);
      lctx.stroke();
    }
  }
}
