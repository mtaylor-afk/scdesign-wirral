// WV Roofing Roof Visualiser — full-size before/after comparison dialog. The
// Before / Side by side / After buttons give the same comparison without a drag.
import { paintSwatchElement } from "../tiles.js";
import { initBeforeAfter } from "../ba.js";

export class Lightbox {
  /**
   * @param {{dialog:HTMLDialogElement, getItem:(id:string)=>object, order:()=>string[],
   *          onQuote:(id:string)=>void, onDownload:(id:string, view:string)=>void}} opts
   */
  constructor(opts) {
    this.opts = opts;
    this.d = opts.dialog;
    this.id = null;
    this.view = "ai";
    const $ = (s) => this.d.querySelector(s);
    this.el = {
      kind: $("#lb-kind"),
      title: $("#lb-title"),
      before: $("#lb-before"),
      after: $("#lb-after"),
      afterTag: $("#lb-after-tag"),
      ba: $("#lb-ba"),
      range: $("#lb-ba .ba-range"),
      sw: $("#lb-switch"),
      qa: $("#lb-qa"),
      swatch: $("#lb-swatch"),
      colour: $("#lb-colour"),
      summary: $("#lb-summary"),
      spec: $("#lb-spec"),
      toggle: $("#lb-ba-toggle"),
    };
    initBeforeAfter(this.d);
    this.el.toggle.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ba]");
      if (b) this.setSplit(Number(b.dataset.ba));
    });
    this.el.range.addEventListener("input", () => this.markSplit());
    $("#lb-close").addEventListener("click", () => this.d.close());
    $("#lb-prev").addEventListener("click", () => this.step(-1));
    $("#lb-next").addEventListener("click", () => this.step(1));
    $("#lb-quote").addEventListener("click", () => {
      const id = this.id;
      this.d.close();
      opts.onQuote(id);
    });
    $("#lb-download").addEventListener("click", () => opts.onDownload(this.id, this.currentView()));
    this.el.sw.addEventListener("click", (e) => {
      const b = e.target.closest("[data-view]");
      if (!b) return;
      this.view = b.dataset.view;
      this.render();
    });
    this.d.addEventListener("click", (e) => {
      if (e.target === this.d) this.d.close();
    });
    this.d.addEventListener("keydown", (e) => {
      if (e.target === this.el.range) return;
      if (e.key === "ArrowRight") this.step(1);
      if (e.key === "ArrowLeft") this.step(-1);
    });
  }

  open(id) {
    this.id = id;
    this.view = "ai";
    this.setSplit(50);
    this.render();
    if (!this.d.open) this.d.showModal();
  }

  /** 100 = all before, 0 = all after (the slider's own scale). */
  setSplit(pos) {
    this.el.range.value = String(pos);
    this.el.range.dispatchEvent(new Event("input"));
  }

  markSplit() {
    const v = this.el.range.value;
    this.el.toggle.querySelectorAll("[data-ba]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.ba === v ? "true" : "false"));
  }

  isOpen() {
    return this.d.open;
  }

  /** Re-render if the given product is on show (e.g. its AI render just arrived). */
  refresh(id) {
    if (this.d.open && this.id === id) this.render();
  }

  step(dir) {
    const ids = this.opts.order();
    const i = ids.indexOf(this.id);
    if (i < 0) return;
    this.open(ids[(i + dir + ids.length) % ids.length]);
  }

  currentView() {
    const item = this.opts.getItem(this.id);
    return this.view === "ai" && item.aiUrl ? "ai" : "preview";
  }

  render() {
    const item = this.opts.getItem(this.id);
    if (!item) return;
    const p = item.product;
    const view = this.currentView();
    const url = view === "ai" ? item.aiUrl : item.previewUrl;
    this.el.kind.textContent = view === "ai" ? "AI concept render" : "Quick preview (approximate)";
    this.el.title.textContent = p.name + ", " + p.colourName;
    if (this.el.before.src !== item.beforeUrl) this.el.before.src = item.beforeUrl;
    if (url && this.el.after.src !== url) this.el.after.src = url;
    this.el.after.alt = "Your house with " + p.name + " in " + p.colourName + " (" + (view === "ai" ? "AI concept render" : "quick preview") + ")";
    this.el.afterTag.textContent = view === "ai" ? "AI render" : "Preview";
    this.el.sw.hidden = !(item.aiUrl && item.previewUrl);
    this.el.sw.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.view === view ? "true" : "false"));
    if (view === "ai" && item.seam > 18) {
      this.el.qa.hidden = false;
      this.el.qa.textContent = "The edges of this render may not line up perfectly with your photo. Try another photo or a tighter roof outline for a cleaner result.";
    } else {
      this.el.qa.hidden = true;
    }
    this.el.colour.textContent = p.colourName + " · " + p.family;
    this.el.summary.textContent = p.summary;
    const rows = [
      ["Format", p.format],
      ["Finish", p.finish],
      ["Ridge", p.ridge],
      ["Suits", p.suits],
      ["Lifespan", p.lifespan],
      ["Comparable to", (p.comparable || []).join(", ")],
    ];
    const frag = document.createDocumentFragment();
    for (const [k, v] of rows) {
      if (!v) continue;
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      frag.append(dt, dd);
    }
    this.el.spec.replaceChildren(frag);
    requestAnimationFrame(() => paintSwatchElement(this.el.swatch, p, 240));
  }
}
