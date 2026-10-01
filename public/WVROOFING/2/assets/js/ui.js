// WV Roofing v2 — small interface pieces shared by the pages: the roof
// "stations" (the eight looks as a radio group of chips), the weather deck
// (the five moods as a radio group), the before/after slider, "the page wears
// the roof", and a queue for drawing things while the browser is idle.
import { drawSwatch, hexToRgb } from "./engine/tiles.js";
import { CONDITIONS } from "./engine/grade.js";

const ICONS = {
  noon: '<path d="M4 17V9l8-5 8 5v8"/><path d="M9 17v-5h6v5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  drizzle: '<path d="M7 15a4 4 0 0 1 .6-7.9A5.5 5.5 0 0 1 18 8.5 3.3 3.3 0 0 1 17.5 15z"/><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3"/>',
  storm: '<path d="M7 14a4 4 0 0 1 .6-7.9A5.5 5.5 0 0 1 18 7.5 3.3 3.3 0 0 1 17.5 14z"/><path d="M13 12l-3 5h4l-2 5"/>',
  dusk: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
};

function svgIcon(paths) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + "</svg>";
}

/**
 * Run small jobs when the browser is idle: at least one per idle period, and
 * more only while the period has time left for another, so no single task
 * holds the page up for long. Without requestIdleCallback, one job per timer.
 * @param {{timeout?:number, cost?:number}} [opts] timeout: the longest a job may wait (ms);
 *   cost: roughly how long one job takes (ms), so a second one only starts if it fits
 * @returns {{add:(job:()=>void)=>void, cancel:()=>void}}
 */
export function idleQueue(opts) {
  const o = opts || {};
  const timeout = o.timeout > 0 ? o.timeout : 800;
  const cost = o.cost > 0 ? o.cost : 8;
  const hasIdle = typeof window.requestIdleCallback === "function";
  const jobs = [];
  let handle = 0;
  let cancelled = false;
  const run = (deadline) => {
    handle = 0;
    do {
      const job = jobs.shift();
      if (!job) break;
      try {
        job();
      } catch (err) {
        console.warn("idle job", err);
      }
    } while (jobs.length && deadline && !deadline.didTimeout && deadline.timeRemaining() > cost);
    schedule();
  };
  const schedule = () => {
    if (handle || cancelled || !jobs.length) return;
    handle = hasIdle ? window.requestIdleCallback(run, { timeout }) : window.setTimeout(run, 16);
  };
  return {
    add(job) {
      if (cancelled || typeof job !== "function") return;
      jobs.push(job);
      schedule();
    },
    cancel() {
      cancelled = true;
      jobs.length = 0;
      if (handle) {
        if (hasIdle) window.cancelIdleCallback(handle);
        else window.clearTimeout(handle);
      }
      handle = 0;
    },
  };
}

// What each group box was last built with (its key handler and its pending
// swatches), so building it again replaces them rather than piling up more.
const BUILT = new WeakMap();

function takeOver(box, onKey, queue) {
  const old = BUILT.get(box);
  if (old) {
    box.removeEventListener("keydown", old.onKey);
    if (old.queue) old.queue.cancel();
  }
  box.addEventListener("keydown", onKey);
  BUILT.set(box, { onKey, queue });
}

/** Which way a key moves through a radio group: a step, "first", "last", or 0 for none. */
function radioStep(e) {
  if (e.altKey || e.ctrlKey || e.metaKey) return 0;
  if (e.key === "Home") return "first";
  if (e.key === "End") return "last";
  return { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key] || 0;
}

function radioTarget(step, i, n) {
  if (step === "first") return 0;
  if (step === "last") return n - 1;
  return (Math.max(0, i) + step + n) % n;
}

/**
 * The eight looks as a radio group. Arrow keys move and select, like radios.
 * Safe to call again on the same box: the new chips and key handler replace the old.
 * @param {HTMLElement} box  an element with role="radiogroup"
 * @param {Array<object>} visuals  the catalogue's looks
 * @param {{selected?:string, onSelect:(id:string)=>void}} opts
 */
export function buildStations(box, visuals, opts) {
  let current = opts.selected && visuals.some((v) => v.id === opts.selected) ? opts.selected : visuals[0].id;
  const chips = visuals.map((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "station-chip";
    b.setAttribute("role", "radio");
    b.dataset.id = p.id;
    b.setAttribute("aria-label", p.name + ", " + p.colourName);
    const c = document.createElement("canvas");
    c.width = 264;
    c.height = 128;
    c.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.className = "sc-name";
    name.textContent = p.name;
    const small = document.createElement("small");
    small.textContent = p.colourName;
    name.appendChild(small);
    b.append(c, name);
    b.addEventListener("click", () => choose(p.id, true));
    return { b, c, p, thumbed: false };
  });
  box.setAttribute("role", "radiogroup");
  box.replaceChildren(...chips.map((x) => x.b));

  function mark() {
    chips.forEach((x) => {
      const on = x.p.id === current;
      x.b.setAttribute("aria-checked", on ? "true" : "false");
      x.b.tabIndex = on ? 0 : -1;
    });
  }

  function choose(id, fromUser) {
    if (!visuals.some((v) => v.id === id)) return;
    const changed = id !== current;
    current = id;
    mark();
    const chip = chips.find((x) => x.p.id === id);
    if (chip && fromUser && chip.b.scrollIntoView) chip.b.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (fromUser && (changed || opts.always)) opts.onSelect(id);
  }

  const onKey = (e) => {
    const step = radioStep(e);
    if (!step) return;
    e.preventDefault();
    const j = radioTarget(step, chips.findIndex((x) => x.p.id === current), chips.length);
    choose(chips[j].p.id, true);
    chips[j].b.focus();
  };

  // Swatches are drawn when the browser is idle, a few small canvases at a time.
  // A chip that already shows the house wearing its roof keeps that picture.
  const queue = idleQueue({ timeout: 800, cost: 6 });
  takeOver(box, onKey, queue);
  chips.forEach((x) =>
    queue.add(() => {
      if (!x.thumbed) drawSwatch(x.c, x.p);
    })
  );
  mark();

  return {
    select: (id) => choose(id, false),
    current: () => current,
    /** Swap a chip's swatch for a small picture of the house wearing that roof. */
    setThumb(id, image, crop) {
      const chip = chips.find((x) => x.p.id === id);
      if (!chip) return;
      const src = document.createElement("canvas");
      src.width = image.width;
      src.height = image.height;
      src.getContext("2d").putImageData(image, 0, 0);
      const r = crop || { x: 0, y: 0, w: image.width, h: image.height };
      const ctx = chip.c.getContext("2d");
      // Cover-fit the roof's box into the chip.
      const k = Math.max(chip.c.width / r.w, chip.c.height / r.h);
      const dw = r.w * k;
      const dh = r.h * k;
      ctx.drawImage(src, r.x, r.y, r.w, r.h, (chip.c.width - dw) / 2, (chip.c.height - dh) / 2, dw, dh);
      src.width = 0;
      chip.thumbed = true;
      chip.b.classList.remove("is-busy");
    },
    setBusy(id, on) {
      const chip = chips.find((x) => x.p.id === id);
      if (chip) chip.b.classList.toggle("is-busy", !!on);
    },
  };
}

/**
 * The weather deck: a radio group of the five moods, one checked at a time.
 * Arrow keys move and select, like radios; only the checked one is a Tab stop.
 * Safe to call again on the same box: the new buttons and key handler replace the old.
 * @param {HTMLElement} box  labelled by the page (aria-labelledby); given role="radiogroup" here
 * @param {{selected?:string, onSelect:(id:string)=>void}} opts
 */
export function buildDeck(box, opts) {
  const known = (id) => CONDITIONS.some((c) => c.id === id);
  let current = known(opts.selected) ? opts.selected : "noon";
  const buttons = CONDITIONS.map((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.setAttribute("role", "radio");
    b.dataset.condition = c.id;
    b.innerHTML = svgIcon(ICONS[c.id] || ICONS.noon);
    b.append(document.createTextNode(c.name));
    b.addEventListener("click", () => choose(c.id, true));
    return b;
  });

  function mark() {
    buttons.forEach((b) => {
      const on = b.dataset.condition === current;
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
  }

  function choose(id, fromUser) {
    if (!known(id)) return;
    const changed = id !== current;
    current = id;
    mark();
    if (fromUser && changed) opts.onSelect(id);
  }

  const onKey = (e) => {
    const step = radioStep(e);
    if (!step) return;
    e.preventDefault();
    const j = radioTarget(step, buttons.findIndex((b) => b.dataset.condition === current), buttons.length);
    choose(buttons[j].dataset.condition, true);
    buttons[j].focus();
  };

  box.setAttribute("role", "radiogroup");
  box.replaceChildren(...buttons);
  takeOver(box, onKey, null);
  mark();
  return {
    select: (id) => choose(id, false),
    current: () => current,
  };
}

/** Wire every before/after slider inside root (safe to call again). */
export function initBeforeAfter(root) {
  (root || document).querySelectorAll(".ba").forEach((ba) => {
    const range = ba.querySelector(".ba-range");
    if (!range || range.dataset.wired) return;
    range.dataset.wired = "1";
    const update = () => {
      ba.style.setProperty("--pos", range.value + "%");
      range.setAttribute("aria-valuetext", range.value + "% before, " + (100 - range.value) + "% after");
    };
    range.addEventListener("input", update);
    update();
  });
}

/** Draw an ImageData onto a canvas at the image's own size. */
export function putImage(canvas, image) {
  if (canvas.width !== image.width) canvas.width = image.width;
  if (canvas.height !== image.height) canvas.height = image.height;
  canvas.getContext("2d").putImageData(image, 0, 0);
}

/**
 * The page wears the roof: the chosen finish's two colours become --finish and
 * --finish-2 (lifted so they stay visible on the dark stage), and the phone's
 * browser bar takes the darker one.
 */
export function wearRoof(product, el) {
  const target = el || document.documentElement;
  if (!product || !product.hex) return;
  const lift = (hex, floor) => {
    const [r, g, b] = hexToRgb(hex);
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const k = l < floor ? floor / Math.max(1, l) : 1;
    const f = (v) => Math.min(255, Math.round(v * k + (k > 1 ? 18 : 0)));
    return "rgb(" + f(r) + ", " + f(g) + ", " + f(b) + ")";
  };
  target.style.setProperty("--finish", lift(product.hex[0], 120));
  target.style.setProperty("--finish-2", lift(product.hex[1] || product.hex[0], 150));
}
