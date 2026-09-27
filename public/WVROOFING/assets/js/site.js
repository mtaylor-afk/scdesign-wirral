// WV Roofing — shared page behaviour: navigation, reveal-on-scroll, the tile
// range strip, swatches, before/after sliders and the quote form.
import { loadCatalogue, priceBandNode } from "./catalogue.js";
import { paintSwatchElement } from "./tiles.js";
import { ROOT } from "./config.js";
import { initBeforeAfter } from "./ba.js";

function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;
  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) {
      setOpen(false);
      toggle.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!nav.classList.contains("is-open")) return;
    if (nav.contains(e.target) || toggle.contains(e.target)) return;
    setOpen(false);
  });
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
}

function initReveal() {
  const els = Array.from(document.querySelectorAll(".reveal"));
  if (!els.length) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
  );
  els.forEach((el) => io.observe(el));
  // Failsafe: content must never stay hidden.
  window.setTimeout(() => els.forEach((el) => el.classList.add("is-in")), 1500);
}

function initYear() {
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}

function tileCard(product, linkBase) {
  const el = document.createElement(linkBase ? "a" : "div");
  el.className = "tile-card";
  if (linkBase) {
    el.href = linkBase + "?tile=" + encodeURIComponent(product.id);
    el.setAttribute("aria-label", "Try " + product.name + " in " + product.colourName + " on your house");
  }
  const canvas = document.createElement("canvas");
  canvas.className = "tile-swatch";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", product.name + ", " + product.colourName + " (illustration)");
  const body = document.createElement("div");
  body.className = "tile-body";
  const name = document.createElement("span");
  name.className = "tile-name";
  name.textContent = product.name;
  const meta = document.createElement("span");
  meta.className = "tile-meta";
  const colour = document.createElement("span");
  colour.textContent = product.colourName;
  meta.append(colour, priceBandNode(product.price));
  body.append(name, meta);
  el.append(canvas, body);
  return { el, canvas };
}

async function initTileStrips() {
  const strips = document.querySelectorAll("[data-tile-strip]");
  if (!strips.length) return;
  let cat;
  try {
    cat = await loadCatalogue();
  } catch (err) {
    strips.forEach((s) => {
      s.textContent = "The roof range could not be loaded - please refresh the page.";
    });
    return;
  }
  for (const strip of strips) {
    const link = strip.getAttribute("data-link") === "visualiser" ? ROOT + "visualiser/" : "";
    const frag = document.createDocumentFragment();
    const painters = [];
    for (const p of cat.products) {
      const { el, canvas } = tileCard(p, link);
      frag.appendChild(el);
      painters.push(() => paintSwatchElement(canvas, p, 420));
    }
    strip.replaceChildren(frag);
    // paint after layout so canvases know their size
    requestAnimationFrame(() => painters.forEach((fn) => fn()));
  }
}

async function initSwatches() {
  const els = document.querySelectorAll("canvas[data-swatch]");
  if (!els.length) return;
  const cat = await loadCatalogue().catch(() => null);
  if (!cat) return;
  els.forEach((c) => {
    const p = cat.byId.get(c.getAttribute("data-swatch"));
    if (p) paintSwatchElement(c, p, 480);
  });
}

function initEnquiryForms() {
  const forms = document.querySelectorAll("form[data-enquiry]");
  if (!forms.length) return;
  import("./enquiry.js")
    .then((m) => forms.forEach((f) => m.wireEnquiryForm(f)))
    .catch(() => {
      /* the form still shows the phone/email alternatives */
    });
}

function initHeroPreview() {
  const hero = document.querySelector("[data-hero-sample]");
  if (!hero) return;
  import("./vis/hero.js")
    .then((m) => m.renderHero(hero))
    .catch(() => {
      hero.classList.add("hero-static");
    });
}

initNav();
initReveal();
initYear();
initTileStrips();
initSwatches();
initBeforeAfter();
initEnquiryForms();
initHeroPreview();
