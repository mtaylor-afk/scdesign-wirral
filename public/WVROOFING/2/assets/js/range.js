// WV Roofing v2 — the range chart: the eight roofs as stations, each drawn
// from its numbers, a weather test with rain that runs off the tiles, and a
// plain table of which roof usually suits which house.
//
// Every picture here is maths on the page, so none of it is done in one long
// go: the chart's swatches are drawn one at a time while the browser is idle,
// and only as they come near the screen; the weather test is drawn at the
// size it is shown, keeps each roof's pixels so a change of weather only
// re-grades them, and lets the tap that asked for it show before it starts.
import { flash } from "./site.js";
import { isCalm, onCalmChange, probeQuality } from "./quality.js";
import { Weather } from "./weather.js";
import { loadCatalogue } from "./data.js";
import { drawSwatch } from "./engine/tiles.js";
import { gradePixels, conditionById } from "./engine/grade.js";
import { buildStations, buildDeck, wearRoof, idleQueue } from "./ui.js";

const $ = (s, r) => (r || document).querySelector(s);

/** How far ahead of the screen pictures start being drawn. */
const NEAR = "600px 0px";

/** Call fn once el comes near the screen (straight away without IntersectionObserver). */
function whenNear(el, fn) {
  if (!el || !("IntersectionObserver" in window)) {
    fn();
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((en) => en.isIntersecting)) {
        io.disconnect();
        fn();
      }
    },
    { rootMargin: NEAR }
  );
  io.observe(el);
}

/** Let the page paint what has just changed, then carry on in a fresh task. */
function yieldToPage() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function" && !document.hidden) requestAnimationFrame(() => setTimeout(resolve, 0));
    else setTimeout(resolve, 0);
  });
}

function chart(cat) {
  const list = $("#range-chart");
  const items = cat.visuals.map((p, i) => {
    const li = document.createElement("li");
    li.className = "range-station reveal is-in";
    li.id = p.id;
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 400;
    c.setAttribute("role", "img");
    c.setAttribute("aria-label", "Illustration of " + p.name.toLowerCase() + " in " + p.colourName.toLowerCase() + ", drawn from numbers");
    const no = document.createElement("span");
    no.className = "range-no mono";
    no.textContent = "Station " + String(i + 1).padStart(2, "0") + " · " + p.family;
    const h = document.createElement("h3");
    h.textContent = p.name;
    const col = document.createElement("p");
    col.className = "range-colour mono";
    col.textContent = p.colourName;
    const d = document.createElement("details");
    const s = document.createElement("summary");
    s.textContent = "Station report";
    const sum = document.createElement("p");
    sum.textContent = p.summary;
    const dl = document.createElement("dl");
    dl.className = "range-facts";
    for (const [k, v] of [
      ["Format", p.format],
      ["Finish", p.finish],
      ["Ridge", p.ridge],
      ["Suits", p.suits],
      ["Lifespan", p.lifespan],
      ["Comparable to", (p.comparable || []).join(", ")],
    ]) {
      if (!v) continue;
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      dl.append(dt, dd);
    }
    const links = document.createElement("p");
    links.className = "cta-row";
    const a1 = document.createElement("a");
    a1.className = "more";
    a1.href = "/WVROOFING/2/roof-cam/?tile=" + encodeURIComponent(p.id);
    a1.textContent = "On my house";
    const a2 = document.createElement("a");
    a2.className = "more";
    a2.href = "/WVROOFING/2/roof-cam/?sample=semi-1930s&tile=" + encodeURIComponent(p.id);
    a2.textContent = "On a sample house";
    links.append(a1, a2);
    d.append(s, sum, dl, links);
    li.append(c, no, h, col, d);
    return { li, c, p };
  });
  list.replaceChildren(...items.map((x) => x.li));

  // One 640 x 400 swatch is a few tens of milliseconds of maths: one per idle
  // moment, and only once its station is coming up the screen.
  const queue = idleQueue({ timeout: 1200, cost: 40 });
  const paint = (x) => queue.add(() => drawSwatch(x.c, x.p));
  if (!("IntersectionObserver" in window)) {
    items.forEach(paint);
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        const x = items.find((it) => it.c === en.target);
        if (x) paint(x);
      }
    },
    { rootMargin: NEAR }
  );
  items.forEach((x) => io.observe(x.c));
}

function suits(cat) {
  const body = $("#suits-body");
  body.replaceChildren(
    ...cat.visuals.map((p) => {
      const tr = document.createElement("tr");
      // The roof's name heads its row, so each cell is read out with it.
      const th = document.createElement("th");
      th.scope = "row";
      // Look like the display-type first column, not like the small column headings.
      Object.assign(th.style, {
        fontFamily: "var(--font-display)",
        fontWeight: "700",
        fontSize: "24px",
        lineHeight: "1",
        letterSpacing: "normal",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        color: "inherit",
      });
      th.textContent = p.name;
      const small = document.createElement("span");
      small.className = "mono";
      small.style.display = "block";
      small.style.fontSize = "12px";
      small.style.marginTop = "6px";
      small.textContent = p.colourName;
      th.appendChild(small);
      const td1 = document.createElement("td");
      td1.textContent = p.suits;
      const td2 = document.createElement("td");
      td2.textContent = p.lifespan;
      tr.append(th, td1, td2);
      return tr;
    })
  );
}

/** The close-up's whole surface is roof: a one-pixel mask that covers it all. */
const ALL_ROOF = new Uint8Array([255]);
/** Roofs whose pixels are kept, so going back to one only re-grades it. */
const KEEP_SWATCHES = 3;

/** A close-up of one roof, graded for the weather, with rain running off it. */
function weatherTest(cat, quality) {
  const section = $("#weather-test");
  const canvas = $("#test-canvas");
  const layer = $("#test-weather");
  const caption = $("#test-caption");
  let finish = cat.byId.has("welsh-slate") ? "welsh-slate" : cat.visuals[0].id;
  let condition = "drizzle";
  let weather = null;
  let size = null;
  let turn = 0;
  let started = false;
  const swatches = new Map();

  // The bitmap follows the close-up's shown width (sharp on dense screens), at most 960 x 640.
  const wantWidth = () => {
    const css = canvas.getBoundingClientRect().width;
    if (!(css > 0)) return 960;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    return Math.max(240, Math.min(960, Math.round(css * dpr)));
  };

  // Rebuilds the working size only. The visible canvas keeps its old picture until
  // paint() has the new one ready (resizing a canvas wipes it).
  const setSize = (w) => {
    const h = Math.round((w * 2) / 3);
    const shade = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      // Sky light from above: the top of the patch catches the sheen.
      const v = 1.22 - 0.3 * (y / h);
      for (let x = 0; x < w; x++) shade[y * w + x] = v - 0.06 * Math.abs(x / w - 0.5);
    }
    size = { w, h, alpha: new Float32Array(w * h).fill(1), analysis: { bx: 0, by: 0, bw: w, bh: h, shade } };
    swatches.clear();
  };

  /** A roof's plain swatch at the current size, drawn once and then kept. */
  const swatchFor = (p) => {
    let px = swatches.get(p.id);
    if (px) {
      swatches.delete(p.id);
      swatches.set(p.id, px);
      return px;
    }
    const scratch = document.createElement("canvas");
    scratch.width = size.w;
    scratch.height = size.h;
    // Read back once, so ask for a context that keeps its pixels handy.
    const ctx = scratch.getContext("2d", { willReadFrequently: true });
    drawSwatch(scratch, p);
    px = ctx.getImageData(0, 0, size.w, size.h).data;
    scratch.width = 0;
    swatches.set(p.id, px);
    while (swatches.size > KEEP_SWATCHES) swatches.delete(swatches.keys().next().value);
    return px;
  };

  const place = () => {
    if (!weather) return;
    const a = canvas.getBoundingClientRect();
    const b = layer.getBoundingClientRect();
    // All roof, so the rain lands anywhere on it (scatter), runs straight down
    // and drips off the bottom edge.
    weather.setMask(ALL_ROOF, 1, 1, { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }, { a: 0, b: 0 }, { scatter: true });
  };

  const setWeather = () => {
    const c = conditionById(condition);
    if (isCalm()) {
      // Still: nothing moves now, but the weather is ready for when it may.
      if (weather) weather.snap(c.weather);
      return;
    }
    if (!weather && c.weather.rain > 0.02) {
      weather = new Weather(layer, { quality });
      weather.onFlash = () => flash();
      weather.snap({ rain: 0, cloud: 0, storm: 0, warm: 0 });
      place();
      weather.start();
    }
    if (weather) weather.setState(c.weather, 0.06);
  };

  const label = () => {
    const p = cat.byId.get(finish);
    const c = conditionById(condition);
    canvas.setAttribute("aria-label", "A close-up of " + p.name.toLowerCase() + " in " + p.colourName.toLowerCase() + ", " + c.name.toLowerCase() + " (drawn from numbers, approximate)");
    caption.textContent = p.name + " · " + c.name + " · Drawn from numbers · Approximate";
    wearRoof(p, section);
  };

  const paint = async () => {
    started = true;
    const mine = ++turn;
    label();
    setWeather();
    // The chosen chip shows as chosen before the maths starts.
    await yieldToPage();
    if (mine !== turn) return;
    const want = wantWidth();
    if (!size || want > size.w * 1.15) setSize(want);
    const p = cat.byId.get(finish);
    if (!swatches.has(p.id)) {
      swatchFor(p);
      await yieldToPage();
      if (mine !== turn) return;
    }
    const px = swatchFor(p);
    const c = conditionById(condition);
    const out = gradePixels(px, size.w, size.h, c, { alpha: size.alpha, analysis: size.analysis });
    // Resize only now, straight before drawing, so the close-up never sits blank.
    if (canvas.width !== size.w) canvas.width = size.w;
    if (canvas.height !== size.h) canvas.height = size.h;
    canvas.getContext("2d").putImageData(new ImageData(out, size.w, size.h), 0, 0);
  };

  // Keep the rain on the picture as the layout moves, and redraw sharper if it grows a lot.
  let timer = 0;
  const relayout = () => {
    place();
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (started && size && wantWidth() > size.w * 1.15) paint();
    }, 250);
  };
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(relayout).observe(canvas);
  else window.addEventListener("resize", relayout);
  onCalmChange((calm) => {
    if (!calm && started) setWeather();
  });

  buildStations($("#test-stations"), cat.visuals, {
    selected: finish,
    onSelect: (id) => {
      finish = id;
      paint();
    },
  });
  buildDeck($("#test-deck"), {
    selected: condition,
    onSelect: (id) => {
      condition = id;
      paint();
    },
  });
  label();
  // Nothing is drawn until the test is coming up the screen.
  whenNear(section, () => {
    if (!started) paint();
  });
}

async function boot() {
  const quick = Promise.race([probeQuality(), new Promise((res) => setTimeout(() => res("mid"), 350))]);
  const [cat, quality] = await Promise.all([loadCatalogue(), quick]);
  chart(cat);
  suits(cat);
  weatherTest(cat, quality);
  if (window.location.hash) {
    const el = document.getElementById(window.location.hash.slice(1));
    if (el) {
      const d = el.querySelector("details");
      if (d) d.open = true;
      el.scrollIntoView();
    }
  }
}

boot().catch((err) => console.error(err));
