// WV Roofing — Home page hero: the sample house before/after, generated live in
// the browser from the Roof Visualiser engine (or from a pre-rendered AI render
// of the sample when one exists).
import { loadCatalogue } from "../catalogue.js";
import { ROOT } from "../config.js";
import { buildMask, featherAlpha } from "./mask-ops.js";
import { analyseRoof, renderPreview } from "./preview.js";
import { compositeRender, decodeRenderToPhotoGrid } from "./composite.js";

function idle() {
  return new Promise((res) => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(() => res(), { timeout: 1500 });
    else setTimeout(res, 200);
  });
}

export async function renderHero(el) {
  const sampleId = el.dataset.heroSample;
  const productId = el.dataset.heroProduct;
  const img = el.querySelector(".ba > img");
  const after = el.querySelector(".ba-after");
  if (!img || !after) return;
  await idle();
  const [cat, samplesJson] = await Promise.all([
    loadCatalogue(),
    fetch(ROOT + "samples/samples.json", { cache: "no-cache" }).then((r) => r.json()),
  ]);
  const sample = (samplesJson.samples || []).find((s) => s.id === sampleId);
  const product = cat.byId.get(productId);
  if (!sample || !product) return;
  if (!img.complete) await img.decode();
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const orig = ctx.getImageData(0, 0, w, h);
  const mask = buildMask(sample.shapes, w, h, w / sample.w, h / sample.h);

  let pixels = null;
  let label = "quick preview (approximate)";
  try {
    const r = sample.prerendered ? await fetch(ROOT + "samples/renders/" + sample.id + "/meta.json", { cache: "no-cache" }) : null;
    if (r && r.ok) {
      const meta = await r.json();
      if (meta.products && meta.products.includes(productId)) {
        const render = await decodeRenderToPhotoGrid(ROOT + "samples/renders/" + sample.id + "/" + productId + ".jpg", meta.spec, w, h);
        pixels = compositeRender(orig, render, mask, featherAlpha(mask, w, h), w, h).pixels;
        label = "AI concept render";
      }
    }
  } catch (err) {
    pixels = null;
  }
  if (!pixels) {
    await idle();
    const analysis = analyseRoof(orig, mask);
    if (!analysis) return;
    pixels = renderPreview(analysis, orig, product);
  }
  ctx.putImageData(new ImageData(pixels, w, h), 0, 0);
  c.setAttribute("role", "img");
  c.setAttribute("aria-label", "The same house with a " + product.name.toLowerCase() + " roof in " + product.colourName.toLowerCase() + " (" + label + ")");
  after.replaceChildren(c);
  const tag = el.querySelector(".ba-tag--after");
  if (tag) tag.textContent = product.name;
  const cap = el.querySelector("[data-hero-caption]");
  if (cap) cap.textContent = "Photo (stock). After: " + product.name + " in " + product.colourName + ", " + label + ". Drag the handle to compare.";
  el.classList.add("is-ready");
}
