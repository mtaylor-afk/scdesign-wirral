// WV Roofing — sample-house showcases: the before/after hero and the
// "eight roofs, one house" colour-dot picker. Both are drawn live in the
// browser by the Roof Visualiser engine (or from a pre-rendered AI render of
// the sample when one exists), sharing one decoded photo and roof analysis per
// sample house.
import { loadCatalogue } from "../catalogue.js";
import { ROOT } from "../config.js";
import { paintSwatchElement } from "../tiles.js";
import { buildMask, featherAlpha } from "./mask-ops.js";
import { analyseRoof, renderPreview } from "./preview.js";
import { compositeRender, decodeRenderToPhotoGrid } from "./composite.js";

function idle() {
  return new Promise((res) => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(() => res(), { timeout: 1500 });
    else setTimeout(res, 200);
  });
}

let samplesPending = null;
function loadSamples() {
  if (!samplesPending) {
    samplesPending = fetch(ROOT + "samples/samples.json", { cache: "no-cache" })
      .then((r) => r.json())
      .then((j) => (Array.isArray(j.samples) ? j.samples : []));
  }
  return samplesPending;
}

const bases = new Map();

/** Decode a sample house once per page: its pixels, roof mask and (lazily) the roof analysis. */
function sampleBase(sampleId) {
  if (!bases.has(sampleId)) {
    bases.set(
      sampleId,
      (async () => {
        const sample = (await loadSamples()).find((s) => s.id === sampleId);
        if (!sample) throw new Error("Unknown sample house: " + sampleId);
        const img = new Image();
        img.src = ROOT + "samples/" + sample.src;
        await img.decode();
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const orig = ctx.getImageData(0, 0, w, h);
        const mask = buildMask(sample.shapes, w, h, w / sample.w, h / sample.h);
        let analysis;
        let meta;
        return {
          sample,
          w,
          h,
          orig,
          mask,
          analyse() {
            if (analysis === undefined) analysis = analyseRoof(orig, mask);
            return analysis;
          },
          meta() {
            if (!meta) {
              meta = sample.prerendered
                ? fetch(ROOT + "samples/renders/" + sample.id + "/meta.json", { cache: "no-cache" })
                    .then((r) => (r.ok ? r.json() : null))
                    .catch(() => null)
                : Promise.resolve(null);
            }
            return meta;
          },
        };
      })()
    );
  }
  return bases.get(sampleId);
}

/** The sample with the given roof: the AI render when one was pre-rendered, otherwise a quick preview. */
async function roofPixels(base, product) {
  try {
    const meta = await base.meta();
    if (meta && meta.products && meta.products.includes(product.id)) {
      const src = ROOT + "samples/renders/" + base.sample.id + "/" + product.id + ".jpg";
      const render = await decodeRenderToPhotoGrid(src, meta.spec, base.w, base.h);
      const alpha = featherAlpha(base.mask, base.w, base.h);
      return { pixels: compositeRender(base.orig, render, base.mask, alpha, base.w, base.h).pixels, label: "AI concept render" };
    }
  } catch (err) {
    /* fall back to a quick preview */
  }
  await idle();
  const analysis = base.analyse();
  if (!analysis) return null;
  return { pixels: renderPreview(analysis, base.orig, product), label: "quick preview (approximate)" };
}

// ---------------------------------------------------------------------------
// before/after hero

export async function renderHero(el) {
  const after = el.querySelector(".ba-after");
  if (!after) return;
  await idle();
  const [cat, base] = await Promise.all([loadCatalogue(), sampleBase(el.dataset.heroSample)]);
  const product = cat.byId.get(el.dataset.heroProduct);
  if (!product) return;
  const out = await roofPixels(base, product);
  if (!out) return;
  const c = document.createElement("canvas");
  c.width = base.w;
  c.height = base.h;
  c.getContext("2d").putImageData(new ImageData(out.pixels, base.w, base.h), 0, 0);
  c.setAttribute("role", "img");
  c.setAttribute("aria-label", "The same house with a " + product.name.toLowerCase() + " roof in " + product.colourName.toLowerCase() + " (" + out.label + ")");
  after.replaceChildren(c);
  const tag = el.querySelector(".ba-tag--after");
  if (tag) tag.textContent = product.name;
  const cap = el.querySelector("[data-hero-caption]");
  if (cap) cap.textContent = "Photo (stock). After: " + product.name + " in " + product.colourName + ", " + out.label + ". Drag the handle to compare.";
  el.classList.add("is-ready");
}

// ---------------------------------------------------------------------------
// colour-dot picker

export async function initPicker(el) {
  const dotsBox = el.querySelector("[data-picker-dots]");
  const layers = Array.from(el.querySelectorAll(".picker-layer"));
  const nameEl = el.querySelector("[data-picker-name]");
  const colourEl = el.querySelector("[data-picker-colour]");
  const linkEl = el.querySelector("[data-picker-link]");
  if (!dotsBox || layers.length < 2) return;
  const cat = await loadCatalogue();
  const products = cat.visuals;
  const urls = new Map();
  let current = cat.byId.has(el.dataset.pickerProduct) ? el.dataset.pickerProduct : products[0].id;
  let front = 0;
  let fadeTimer = 0;
  let started = false;

  const dots = products.map((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dot";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-label", p.name + ", " + p.colourName);
    b.style.setProperty("--c1", p.hex[0]);
    b.style.setProperty("--c2", p.hex[1] || p.hex[0]);
    const fill = document.createElement("span");
    fill.className = "dot-fill";
    const sw = document.createElement("canvas");
    sw.setAttribute("aria-hidden", "true");
    fill.appendChild(sw);
    b.appendChild(fill);
    b.addEventListener("click", () => select(p.id));
    b.addEventListener("pointerenter", () => urlFor(p).catch(() => null), { once: true });
    return { b, sw, p };
  });
  dotsBox.replaceChildren(...dots.map((d) => d.b));
  requestAnimationFrame(() => dots.forEach((d) => paintSwatchElement(d.sw, d.p, 96)));

  dotsBox.addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const n = products.length;
    const i = products.findIndex((p) => p.id === current);
    const j = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : (i + step + n) % n;
    select(products[j].id);
    dots[j].b.focus();
  });

  function showLabel(p) {
    if (nameEl) nameEl.textContent = p.name;
    if (colourEl) colourEl.textContent = p.colourName;
    if (linkEl) linkEl.href = ROOT + "visualiser/?tile=" + encodeURIComponent(p.id);
    dots.forEach((d) => {
      const on = d.p.id === p.id;
      d.b.setAttribute("aria-checked", on ? "true" : "false");
      d.b.tabIndex = on ? 0 : -1;
    });
  }

  function urlFor(p) {
    if (!urls.has(p.id)) {
      const job = (async () => {
        const base = await sampleBase(el.dataset.pickerSample);
        const out = await roofPixels(base, p);
        if (!out) throw new Error("No roof marked on the sample house");
        const c = document.createElement("canvas");
        c.width = base.w;
        c.height = base.h;
        c.getContext("2d").putImageData(new ImageData(out.pixels, base.w, base.h), 0, 0);
        const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.9));
        c.width = 0;
        return { url: URL.createObjectURL(blob), label: out.label };
      })();
      job.catch(() => urls.delete(p.id));
      urls.set(p.id, job);
    }
    return urls.get(p.id);
  }

  async function select(id) {
    const p = cat.byId.get(id);
    if (!p) return;
    current = id;
    showLabel(p);
    if (!started) return;
    const busy = setTimeout(() => el.classList.add("is-busy"), 120);
    let r;
    try {
      r = await urlFor(p);
    } catch (err) {
      r = null;
    }
    clearTimeout(busy);
    if (current !== id) return;
    el.classList.remove("is-busy");
    if (!r) return;
    const back = layers[1 - front];
    back.src = r.url;
    try {
      await back.decode();
    } catch (err) {
      /* show it anyway */
    }
    if (current !== id) return;
    const prev = layers[front];
    front = 1 - front;
    back.alt = "The same house re-roofed in " + p.name.toLowerCase() + ", " + p.colourName.toLowerCase() + " (" + r.label + ")";
    prev.alt = "";
    back.style.zIndex = "2";
    prev.style.zIndex = "1";
    back.classList.add("is-on");
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => prev.classList.remove("is-on"), 750);
    el.dataset.showing = id;
  }

  async function prefetchAll() {
    for (const p of products) {
      await idle();
      try {
        await urlFor(p);
      } catch (err) {
        return;
      }
    }
  }

  const start = () => {
    if (started) return;
    started = true;
    select(current).then(prefetchAll);
  };
  showLabel(cat.byId.get(current));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: "400px 0px" }
    );
    io.observe(el);
  } else {
    start();
  }
}
