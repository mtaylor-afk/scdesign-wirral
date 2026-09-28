// WV Roofing — shared page behaviour: global and local navigation, reveal on
// scroll, scrolling galleries, the "which roof is right for you" compare grid,
// swatches, before/after sliders, the home-page roof picker and quote forms.
import { loadCatalogue } from "./catalogue.js";
import { paintSwatchElement } from "./tiles.js";
import { ROOT } from "./config.js";
import { initBeforeAfter } from "./ba.js";

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

// ---------------------------------------------------------------------------
// navigation

function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;
  const wide = window.matchMedia("(min-width: 834px)");
  const isOpen = () => nav.classList.contains("is-open");
  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    document.documentElement.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  toggle.addEventListener("click", () => {
    setOpen(!isOpen());
    if (isOpen()) {
      const first = nav.querySelector("a");
      if (first) first.focus({ preventScroll: true });
    }
  });
  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") {
      setOpen(false);
      toggle.focus();
      return;
    }
    if (e.key !== "Tab") return;
    // Keep focus inside the open menu (the page behind is covered).
    const items = [toggle].concat(Array.from(nav.querySelectorAll("a")));
    const i = items.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) {
      e.preventDefault();
      items[items.length - 1].focus();
    } else if (!e.shiftKey && i === items.length - 1) {
      e.preventDefault();
      items[0].focus();
    }
  });
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
  wide.addEventListener("change", () => setOpen(false));
}

function initLocalNav() {
  const lnav = document.querySelector(".lnav");
  const toggle = lnav && lnav.querySelector(".lnav-toggle");
  if (!toggle) return;
  const isOpen = () => lnav.classList.contains("is-open");
  const setOpen = (open) => {
    lnav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  };
  toggle.addEventListener("click", () => setOpen(!isOpen()));
  lnav.addEventListener("click", (e) => {
    if (e.target.closest(".lnav-links a")) setOpen(false);
  });
  document.addEventListener("click", (e) => {
    if (isOpen() && !lnav.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });
}

function initFooter() {
  const cols = Array.from(document.querySelectorAll(".dir-col"));
  if (!cols.length) return;
  const wide = window.matchMedia("(min-width: 834px)");
  const apply = () => cols.forEach((d) => {
    d.open = wide.matches;
  });
  cols.forEach((d) => {
    const s = d.querySelector("summary");
    if (s) {
      s.addEventListener("click", (e) => {
        if (wide.matches) e.preventDefault();
      });
    }
  });
  apply();
  wide.addEventListener("change", apply);
}

// ---------------------------------------------------------------------------
// motion

function initReveal() {
  const els = Array.from(document.querySelectorAll(".reveal"));
  if (!els.length) return;
  if (reduceMotion() || !("IntersectionObserver" in window)) {
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

// ---------------------------------------------------------------------------
// galleries (horizontal scroll with paddles)

function initGalleries() {
  document.querySelectorAll("[data-gallery]").forEach((g) => {
    const track = g.querySelector(".gallery-track");
    if (!track || g.dataset.wired) return;
    g.dataset.wired = "1";
    const prev = g.querySelector('.paddle[data-dir="-1"]');
    const next = g.querySelector('.paddle[data-dir="1"]');
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      g.classList.toggle("is-static", max <= 2);
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max - 2;
    };
    const step = (dir) => {
      const item = track.firstElementChild;
      const gap = parseFloat(window.getComputedStyle(track).columnGap) || 20;
      const w = item ? item.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
      const per = Math.max(1, Math.floor((track.clientWidth * 0.9) / w));
      track.scrollBy({ left: dir * w * per, behavior: reduceMotion() ? "auto" : "smooth" });
    };
    if (prev) prev.addEventListener("click", () => step(-1));
    if (next) next.addEventListener("click", () => step(1));
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    g.addEventListener("gallery:update", update);
    update();
  });
}

// ---------------------------------------------------------------------------
// the roof range

function compareCard(p) {
  const col = make("li", "cmp-col");
  col.style.setProperty("--c1", p.hex[0]);
  const canvas = make("canvas", "cmp-swatch");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", p.name + ", " + p.colourName + " (illustration)");
  const dots = make("div", "cmp-dots");
  dots.setAttribute("aria-hidden", "true");
  for (const hex of p.hex) {
    const d = make("span");
    d.style.background = hex;
    dots.appendChild(d);
  }
  const actions = make("div", "cmp-actions");
  const tryIt = make("a", "btn btn-primary btn-sm", "Try it on your house");
  tryIt.href = ROOT + "visualiser/?tile=" + encodeURIComponent(p.id);
  tryIt.setAttribute("aria-label", "Try " + p.name + " on your house");
  const ask = make("a", "more", "Ask about this roof");
  ask.href = "#contact";
  ask.setAttribute("aria-label", "Ask about " + p.name);
  ask.addEventListener("click", () => {
    const select = document.querySelector('form[data-enquiry] select[name="product"]');
    if (select) select.value = p.id;
  });
  actions.append(tryIt, ask);
  const spec = make("dl", "cmp-spec");
  for (const [k, v] of [
    ["Suits", p.suits],
    ["Lifespan", p.lifespan],
    ["Format", p.format],
    ["Finish", p.finish],
  ]) {
    if (!v) continue;
    const row = make("div");
    row.append(make("dt", "", k), make("dd", "", v));
    spec.appendChild(row);
  }
  col.append(canvas, dots, make("h3", "cmp-name", p.name), make("p", "cmp-colour", p.colourName), actions, spec);
  return { col, canvas };
}

async function initCompare() {
  const boxes = document.querySelectorAll("[data-compare]");
  if (!boxes.length) return;
  let cat;
  try {
    cat = await loadCatalogue();
  } catch (err) {
    boxes.forEach((b) => {
      b.textContent = "The roof range could not be loaded - please refresh the page.";
    });
    return;
  }
  for (const box of boxes) {
    const frag = document.createDocumentFragment();
    const painters = [];
    for (const p of cat.products) {
      const { col, canvas } = compareCard(p);
      frag.appendChild(col);
      painters.push(() => paintSwatchElement(canvas, p, 520));
    }
    box.replaceChildren(frag);
    // paint after layout so canvases know their size
    requestAnimationFrame(() => painters.forEach((fn) => fn()));
    const g = box.closest("[data-gallery]");
    if (g) g.dispatchEvent(new Event("gallery:update"));
  }
}

async function initSwatches() {
  const els = document.querySelectorAll("canvas[data-swatch]");
  if (!els.length) return;
  const cat = await loadCatalogue().catch(() => null);
  if (!cat) return;
  requestAnimationFrame(() => {
    els.forEach((c) => {
      const p = cat.byId.get(c.getAttribute("data-swatch"));
      if (p) paintSwatchElement(c, p, Number(c.dataset.swatchMax) || 480);
    });
  });
}

// ---------------------------------------------------------------------------
// forms and the sample-house showcases (loaded on demand)

function initEnquiryForms() {
  const forms = document.querySelectorAll("form[data-enquiry]");
  if (!forms.length) return;
  import("./enquiry.js")
    .then((m) => forms.forEach((f) => m.wireEnquiryForm(f)))
    .catch(() => {
      /* the form still shows the phone/email alternatives */
    });
}

function initShowcases() {
  const heroes = document.querySelectorAll("[data-hero-sample]");
  const picker = document.querySelector("[data-picker]");
  if (!heroes.length && !picker) return;
  import("./vis/hero.js")
    .then((m) => {
      heroes.forEach((h) => m.renderHero(h));
      if (picker) m.initPicker(picker);
    })
    .catch(() => {
      heroes.forEach((h) => h.classList.add("hero-static"));
    });
}

initNav();
initLocalNav();
initFooter();
initReveal();
initYear();
initGalleries();
initCompare();
initSwatches();
initBeforeAfter();
initEnquiryForms();
initShowcases();
