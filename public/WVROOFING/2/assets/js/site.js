// WV Roofing v2 — what every page does: the station bar and its menu, the
// Weather switch (Calm), the gust that leans the type, the ticker, the
// barometer, and the lightning flash. Each page's own module does the rest.
// (assets/js/calm-early.js has already settled Calm before the first paint.)
import { initCalm, isCalm, setCalm, onCalmChange } from "./quality.js";
import { wind } from "./wind.js";
import { initIsobars } from "./isobars.js";
import { mountGauge } from "./gauge.js";

// Typed as http://? Move to https, where sharing and copying are allowed to work.
if (window.location.protocol === "http:" && !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
  window.location.replace("https://" + window.location.host + window.location.pathname + window.location.search + window.location.hash);
}

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const root = document.documentElement;

initCalm();

// ---------------------------------------------------------------------------
// the lightning flash (weather.js calls this through each page's onFlash)

// However many storms a page runs (the bulletin has two), the whole page never
// flashes more often than once every six seconds.
const FLASH_GAP_MS = 6000;
let flashEl = null;
let flashTimer = 0;
let lastFlash = -Infinity;

/**
 * Brighten the whole page for a tenth of a second. Never when the page is
 * calm, and never within six seconds of the last flash (a call inside that
 * gap does nothing).
 */
export function flash() {
  if (isCalm()) return;
  const now = performance.now();
  if (now - lastFlash < FLASH_GAP_MS) return;
  lastFlash = now;
  if (!flashEl) {
    flashEl = document.createElement("div");
    flashEl.className = "flash";
    flashEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(flashEl);
  }
  flashEl.classList.add("is-on");
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => flashEl.classList.remove("is-on"), 90);
}

// ---------------------------------------------------------------------------
// the barometer (pages can take it over: the Roof Cam shows its rendering on it)

let gauge = null;
let gaugeManual = false;

/** The station bar's barometer: { set(value 0..1, text) }, or null on a page without one. */
export function getGauge() {
  return gauge;
}

/** A page takes the needle over (true) or gives it back to the scroll position (false). */
export function holdGauge(manual) {
  gaugeManual = !!manual;
  if (!gaugeManual) onScroll();
}

let scrollQueued = false;
function onScroll() {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    scrollQueued = false;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const v = Math.min(1, Math.max(0, window.scrollY / max));
    if (gauge && !gaugeManual) gauge.set(v, Math.round(v * 100) + "% of the way down");
    const dock = $("#dock");
    if (dock) {
      const on = window.scrollY > window.innerHeight * 0.9 && window.scrollY < max - 200;
      dock.classList.toggle("is-on", on);
      dock.setAttribute("aria-hidden", on ? "false" : "true");
      const link = dock.querySelector("a");
      if (link) link.tabIndex = on ? 0 : -1;
    }
  });
}

function initGauge() {
  const el = $("#gauge");
  if (!el) return;
  gauge = mountGauge(el, { label: el.dataset.label || "How far down the bulletin you are" });
  gauge.set(0, "0% of the way down");
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();
}

// ---------------------------------------------------------------------------
// station bar menu (phones)

function initMenu() {
  const toggle = $(".menu-toggle");
  const nav = $("#station-nav");
  if (!toggle || !nav) return;
  const bar = toggle.closest(".station") || nav.parentElement;
  const desktop = window.matchMedia("(min-width: 1024px)");
  const isOpen = () => toggle.getAttribute("aria-expanded") === "true";
  // What Tab can reach while the menu is open: the bar's own visible controls
  // (the ident, the menu's links, the weather switch, the menu button), in
  // page order. Everything else is under the menu.
  const reachable = () => $$("a[href], button", bar).filter((el) => !el.disabled && el.getClientRects().length > 0);
  let stilled = [];
  const set = (open) => {
    nav.classList.toggle("is-open", open);
    root.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    // The open menu covers the page, so the page behind it is made inert:
    // no focus, no clicks and nothing for a screen reader to land on.
    for (const el of stilled) el.inert = false;
    stilled = [];
    if (open) {
      stilled = Array.from(document.body.children).filter((el) => !el.contains(bar) && !el.inert);
      for (const el of stilled) el.inert = true;
    }
  };
  toggle.addEventListener("click", () => {
    const open = !isOpen();
    set(open);
    // Into the menu at its first link.
    const first = open ? $("a[href]", nav) : null;
    if (first) first.focus({ preventScroll: true });
  });
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) set(false);
  });
  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") {
      set(false);
      toggle.focus();
      return;
    }
    // Keep Tab and Shift+Tab going round the bar and the menu.
    if (e.key !== "Tab") return;
    const items = reachable();
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement);
    const step = e.shiftKey ? -1 : 1;
    const next = i < 0 ? (e.shiftKey ? items.length - 1 : 0) : (i + step + items.length) % items.length;
    items[next].focus();
  });
  const onDesktop = () => {
    if (desktop.matches) set(false);
  };
  if (desktop.addEventListener) desktop.addEventListener("change", onDesktop);
}

// ---------------------------------------------------------------------------
// Calm

// The switch is always called "Weather" (its visible label, at every width);
// aria-pressed alone says whether the moving weather is on ("true") or the
// page is calm ("false"). The name never changes with the state.
function initCalmToggle() {
  const b = $("#calm-toggle");
  if (!b) return;
  const show = (calm) => {
    b.setAttribute("aria-pressed", calm ? "false" : "true");
    b.title = calm ? "The moving weather is off. Press to switch it back on." : "The moving weather is on. Press to still the rain, the wind and the lightning.";
  };
  b.addEventListener("click", () => setCalm(!isCalm()));
  onCalmChange(show);
  show(isCalm());
}

// ---------------------------------------------------------------------------
// the gust: --wind on each .gust and .sway line, a few times a second, and
// only while one of them is on screen, the tab is showing and the page isn't
// calm. It's written on the lines themselves, so only they are restyled.

function initGust() {
  const lines = $$(".gust, .sway");
  if (!lines.length) return;
  const showing = new Set();
  let frame = 0;
  let raf = 0;
  const write = (els, t) => {
    const w = wind(t).toFixed(3);
    for (const el of els) el.style.setProperty("--wind", w);
  };
  const tick = (t) => {
    raf = requestAnimationFrame(tick);
    if (++frame % 4) return;
    write(showing, t);
  };
  const run = () => {
    const go = showing.size > 0 && !isCalm() && !document.hidden;
    if (go && !raf) {
      write(showing, performance.now());
      raf = requestAnimationFrame(tick);
    } else if (!go && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  if (typeof IntersectionObserver === "function") {
    // A line inside a hidden screen (the Roof Cam's) never counts as showing.
    const watch = new IntersectionObserver((entries) => {
      const arriving = [];
      for (const entry of entries) {
        if (entry.isIntersecting) {
          showing.add(entry.target);
          arriving.push(entry.target);
        } else {
          showing.delete(entry.target);
        }
      }
      // A line coming into view picks up the gust at once, not a stale lean.
      if (arriving.length) write(arriving, performance.now());
      run();
    });
    lines.forEach((el) => watch.observe(el));
  } else {
    lines.forEach((el) => showing.add(el));
  }
  onCalmChange(run);
  document.addEventListener("visibilitychange", run);
  run();
}

// ---------------------------------------------------------------------------
// tickers: the text is doubled so the loop has no seam, and paced by its length

function initTickers() {
  const tickers = $$(".ticker");
  if (!tickers.length) return;
  // The marquee only runs when the page isn't calm and the device doesn't ask
  // for reduced motion. Otherwise the ticker is a still, wrapped list with the
  // copies hidden, and its width says nothing about the loop's length.
  const still = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const moving = () => !isCalm() && !(still && still.matches);
  tickers.forEach((ticker) => {
    const track = $(".ticker-track", ticker);
    if (!track || track.dataset.wired) return;
    track.dataset.wired = "1";
    const items = Array.from(track.children);
    for (const item of items) {
      const copy = item.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      track.appendChild(copy);
    }
    // About 60 pixels a second, whatever the length.
    const pace = () => {
      if (!moving()) return;
      const half = track.scrollWidth / 2;
      if (half > 0) ticker.style.setProperty("--ticker-s", Math.max(12, Math.round(half / 60)) + "s");
    };
    pace();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(pace);
    onCalmChange((calm) => {
      if (!calm) requestAnimationFrame(pace);
    });
    if (still && still.addEventListener) still.addEventListener("change", () => requestAnimationFrame(pace));
    // A fixed name, "Pause the ticker"; aria-pressed says whether it's paused.
    const pause = $(".ticker-pause", ticker);
    if (pause) {
      pause.addEventListener("click", () => {
        const paused = ticker.classList.toggle("is-paused");
        pause.setAttribute("aria-pressed", paused ? "true" : "false");
      });
    }
  });
}

// ---------------------------------------------------------------------------
// isobars: ink lines on chart paper, rain-blue on the sky (and on the night chart)

function initCharts() {
  let stop = null;
  const dark = window.matchMedia("(prefers-color-scheme: dark)");
  const draw = () => {
    if (stop) stop();
    $$("[data-isobars]").forEach((el) => {
      const paper = el.classList.contains("front--paper") && !(dark.matches && root.dataset.theme !== "light") && root.dataset.theme !== "dark";
      el.dataset.isobarsTone = paper ? "paper" : "dark";
      const old = el.querySelector(":scope > canvas.isobars");
      if (old) old.remove();
    });
    stop = initIsobars(document);
  };
  draw();
  if (dark.addEventListener) dark.addEventListener("change", draw);
}

function initYear() {
  $$("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}

function boot() {
  initMenu();
  initCalmToggle();
  initGauge();
  initTickers();
  initGust();
  initYear();
  try {
    initCharts();
  } catch (err) {
    console.warn("isobars", err);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
