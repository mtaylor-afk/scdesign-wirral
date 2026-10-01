// WV Roofing v2 — the bulletin (home page).
//
// Front 01: the page opens in a storm. Rain lands on the sample house's roof,
// runs down it and drips off the eaves. Then the front passes: the sky lifts,
// the photo warms, and the old roof re-tiles itself in Spanish slate, drawn on
// the visitor's own device. Calm (or reduced motion) shows the cleared frame.
// Front 02: the same house, any of the eight roofs, in any weather.
import { flash } from "./site.js";
import { isCalm, onCalmChange, probeQuality } from "./quality.js";
import { Weather } from "./weather.js";
import { Engine, isStale } from "./engine/engine.js";
import { loadCatalogue, loadSamples, loadImage } from "./data.js";
import { buildStations, buildDeck, initBeforeAfter, putImage, wearRoof } from "./ui.js";
import { conditionById } from "./engine/grade.js";

const $ = (s, r) => (r || document).querySelector(s);

const STORM = { sky: ["#0b1220", "#1b2a4a", "#24365e"], b: 0.62, s: 0.55, c: 1.08, t: 0.45, dawn: 0 };
const CLEAR = { sky: ["#14224a", "#2c4474", "#3e5c8f"], b: 1, s: 1, c: 1, t: 0, dawn: 1 };
const CLEAR_MS = 6000;
const LEAD_MS = 1400;
// The new roof cross-fades over this long (the planned fade runs from 60% to 86% of the clearance).
const FADE_MS = 0.26 * CLEAR_MS;
// How much of the house must be in view before the storm starts to clear.
const IN_VIEW = 0.55;
// The sample house is worked at the size it is shown, within these bounds (long edge, pixels).
const EDGE_MIN = 800;
const EDGE_MAX = 1600;

const lerp = (a, b, p) => a + (b - a) * p;
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

function mixHex(a, b, p) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(lerp((pa >> sh) & 255, (pb >> sh) & 255, p));
  return "rgb(" + ch(16) + ", " + ch(8) + ", " + ch(0) + ")";
}

/**
 * The long edge to work a sample house at: wide enough for the widest stage it
 * is shown on, at up to two device pixels per CSS pixel, between EDGE_MIN and
 * EDGE_MAX. A phone doesn't need the full 1600 pixels, and every pixel costs
 * time in the roof analysis.
 */
function workingEdge(sample, stages) {
  const css = Math.max(0, ...stages.filter(Boolean).map((el) => el.getBoundingClientRect().width));
  if (!(css > 0)) return EDGE_MAX;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const sw = sample.w > 0 ? sample.w : EDGE_MAX;
  const sh = sample.h > 0 ? sample.h : sw;
  const edge = (css * dpr * Math.max(sw, sh)) / sw;
  return Math.round(Math.min(EDGE_MAX, Math.max(EDGE_MIN, edge)));
}

/** Where `el` sits on `canvas`, in the canvas's CSS pixels. */
function rectOn(el, canvas) {
  const a = el.getBoundingClientRect();
  const b = canvas.getBoundingClientRect();
  return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
}

/** Keep a weather canvas's roof mask lined up with a picture as the layout changes. */
function followMask(weather, canvas, picture, scene) {
  const place = () => weather.setMask(scene.mask, scene.w, scene.h, rectOn(picture, canvas), scene.eaves ? { a: scene.eaves.a, b: scene.eaves.b } : undefined);
  place();
  let timer = 0;
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(place, 150);
  };
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(later);
    ro.observe(canvas);
    ro.observe(picture);
  }
  window.addEventListener("resize", later);
  return place;
}

// ---------------------------------------------------------------------------
// front 01

function paintHero(hero, p) {
  const st = hero.style;
  st.setProperty("--sky-1", mixHex(STORM.sky[0], CLEAR.sky[0], p));
  st.setProperty("--sky-2", mixHex(STORM.sky[1], CLEAR.sky[1], p));
  st.setProperty("--sky-3", mixHex(STORM.sky[2], CLEAR.sky[2], p));
  st.setProperty("--dawn", lerp(STORM.dawn, CLEAR.dawn, smooth(0.35, 1, p)).toFixed(3));
  st.setProperty("--grade-b", lerp(STORM.b, CLEAR.b, p).toFixed(3));
  st.setProperty("--grade-s", lerp(STORM.s, CLEAR.s, p).toFixed(3));
  st.setProperty("--grade-c", lerp(STORM.c, CLEAR.c, p).toFixed(3));
  st.setProperty("--grade-t", lerp(STORM.t, CLEAR.t, p).toFixed(3));
}

async function initHero(engine, quality, cat, sample, edge) {
  const hero = $(".hero");
  const stage = $("#hero-stage");
  if (!hero || !stage || !sample) return null;
  const ba = $(".ba", stage);
  const photo = $("img", ba);
  const after = $("canvas.ba-after", ba);
  const range = $(".ba-range", ba);
  const handle = $(".ba-handle", ba);
  const caption = $("#hero-caption");
  const product = cat.byId.get(stage.dataset.finish) || cat.visuals[0];
  const stageStyle = stage.style;

  let weather = null;
  let sceneInfo = null;
  let done = false; // the storm has cleared (or calm cleared it)
  let afterReady = false; // the new roof has been drawn
  let failed = false; // ...or it couldn't be, so the old roof stays, still labelled Before
  let revealed = false; // "After" and the slider are showing
  let readyAt = null; // when the storm's loop first saw the new roof
  let raf = 0;
  let io = null;

  const showAfterCaption = () => {
    caption.innerHTML = "";
    const b = document.createElement("b");
    b.textContent = "After";
    caption.append(b, document.createTextNode(" · " + product.name + " · Approximate preview · " + sample.credit));
  };

  /** Bring the new roof up to full strength: at once when calm, otherwise a short fade. */
  const fadeIn = () => {
    const start = Number(stageStyle.getPropertyValue("--after")) || 0;
    if (isCalm() || start >= 1) {
      stageStyle.setProperty("--after", "1");
      return;
    }
    const from = performance.now();
    const step = (t) => {
      const p = Math.min(1, Math.max(0, (t - from) / 900));
      stageStyle.setProperty("--after", (start + (1 - start) * ease(p)).toFixed(3));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // "After" and the slider only appear once there is a new roof to show.
  const reveal = () => {
    if (revealed || !afterReady) return;
    revealed = true;
    fadeIn();
    showAfterCaption();
    range.hidden = false;
    handle.hidden = false;
    initBeforeAfter(stage);
    // The handle slides in from the left to the middle.
    const from = performance.now();
    const calm = isCalm();
    const slide = (t) => {
      const p = calm ? 1 : Math.min(1, Math.max(0, (t - from) / 900));
      range.value = String(Math.round(50 * ease(p)));
      range.dispatchEvent(new Event("input"));
      if (p < 1) requestAnimationFrame(slide);
    };
    requestAnimationFrame(slide);
  };

  const finish = () => {
    if (done) return;
    done = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (io) io.disconnect();
    paintHero(hero, 1);
    if (weather) {
      // A light shower after the storm. While calm nothing is drawn, so it is simply set.
      const settled = { rain: 0.12, cloud: 0.3, storm: 0 };
      if (isCalm()) weather.snap(settled);
      else weather.setState(settled, 0.03);
    }
    reveal();
  };

  // The storm is only staged when the weather is on.
  if (isCalm()) {
    paintHero(hero, 1);
  } else {
    paintHero(hero, 0);
    weather = new Weather($("#hero-weather"), { quality });
    weather.onFlash = () => flash();
    weather.snap({ rain: 1, cloud: 0.9, storm: 1, warm: 0 });
    weather.start();
  }
  onCalmChange((calm) => {
    if (calm) finish();
    else if (!weather) {
      weather = new Weather($("#hero-weather"), { quality });
      weather.onFlash = () => flash();
      weather.snap({ rain: 0.12, cloud: 0.3, storm: 0, warm: 0 });
      weather.start();
      if (sceneInfo) followMask(weather, $("#hero-weather"), ba, sceneInfo);
    }
  });

  // The new roof, drawn while the storm plays.
  const drawn = (async () => {
    if (!photo.complete || !photo.naturalWidth) await photo.decode().catch(() => undefined);
    sceneInfo = await engine.scene("house", photo, sample.shapes, { maxEdge: edge, sourceW: sample.w, sourceH: sample.h });
    if (weather) followMask(weather, $("#hero-weather"), ba, sceneInfo);
    const r = await engine.render("house", product, "noon", { first: true });
    putImage(after, r.image);
    afterReady = true;
    // Arriving after the storm has gone (calm, or a slow device): show it now.
    if (done) reveal();
  })().catch((err) => {
    failed = true;
    if (!isStale(err)) console.warn("hero render", err);
  });

  if (isCalm()) {
    await drawn;
    finish();
    return sceneInfo;
  }

  // The clearance: six seconds, starting a moment after the house comes into
  // view (on a phone it's below the headline, so the storm waits for you).
  // Nothing loops until then.
  let t0 = Infinity;
  const tick = (t) => {
    raf = 0;
    if (done) return;
    const raw = Math.min(1, Math.max(0, (t - t0) / CLEAR_MS));
    const p = ease(raw);
    paintHero(hero, p);
    if (weather) weather.setState({ rain: lerp(1, 0.08, p), cloud: lerp(0.9, 0.3, p), storm: raw < 0.42 ? 1 : 0 }, 0.08);
    // The roof only changes once it has been drawn; until then the old one waits.
    // On time it cross-fades with the clearance; late, it fades in from when it arrived.
    let a = 0;
    if (afterReady) {
      if (readyAt === null) readyAt = t;
      a = Math.min(smooth(0.6, 0.86, raw), smooth(0, FADE_MS, t - readyAt));
    }
    stageStyle.setProperty("--after", a.toFixed(3));
    if (raw >= 0.74 && a >= 0.5 && !caption.dataset.after) {
      caption.dataset.after = "1";
      showAfterCaption();
    }
    // Done once the sky has cleared and the new roof is fully in (or can't be drawn).
    if (raw >= 1 && (failed || a >= 1)) {
      finish();
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  const begin = () => {
    if (t0 !== Infinity || done) return;
    t0 = performance.now() + LEAD_MS;
    raf = requestAnimationFrame(tick);
  };
  if ("IntersectionObserver" in window) {
    // "In view" is most of the house, or most of the screen when the screen is
    // too short to show that much of it (a phone on its side, say).
    const steps = [];
    for (let k = 0; k <= 20; k++) steps.push(k / 20);
    io = new IntersectionObserver(
      (entries) => {
        const seen = entries.some((en) => {
          if (!en.isIntersecting) return false;
          const view = en.rootBounds ? en.rootBounds.height : window.innerHeight;
          return en.intersectionRect.height >= IN_VIEW * Math.min(en.boundingClientRect.height, view);
        });
        if (seen) {
          io.disconnect();
          begin();
        }
      },
      { threshold: steps }
    );
    io.observe(stage);
  } else {
    begin();
  }
  await drawn;
  return sceneInfo;
}

// ---------------------------------------------------------------------------
// front 02

function initPicker(engine, quality, cat, samples, sceneReady, edge) {
  const box = $("#picker");
  if (!box) return;
  const stage = $("#picker-stage");
  const canvas = $("#picker-canvas");
  const caption = $("#picker-caption");
  const nameEl = $("#picker-name");
  const colourEl = $("#picker-colour");
  const link = $("#picker-link");
  const sample = samples.find((s) => s.id === box.dataset.sample) || samples[0];
  let finish = cat.byId.has(box.dataset.finish) ? box.dataset.finish : cat.visuals[0].id;
  let condition = "noon";
  let weather = null;
  let scene = null;
  let turn = 0;
  let shown = false; // a new roof is on the canvas

  const label = () => {
    const p = cat.byId.get(finish);
    const c = conditionById(condition);
    nameEl.textContent = p.name;
    colourEl.textContent = p.colourName + (c.id === "noon" ? "" : " · " + c.name);
    link.href = "/WVROOFING/2/roof-cam/?tile=" + encodeURIComponent(p.id);
    canvas.setAttribute("aria-label", "The sample house re-roofed in " + p.name.toLowerCase() + ", " + p.colourName.toLowerCase() + (c.id === "noon" ? "" : ", in " + c.name.toLowerCase()) + " (approximate preview)");
    caption.textContent = sample.title + " · " + sample.credit + " · Approximate preview";
    wearRoof(p, box);
  };

  const draw = async () => {
    const mine = ++turn;
    label();
    const busy = setTimeout(() => stage.classList.add("is-busy"), 140);
    try {
      await sceneReady;
      const r = await engine.render("house", cat.byId.get(finish), condition, { first: true });
      if (mine === turn) {
        putImage(canvas, r.image);
        shown = true;
      }
    } catch (err) {
      if (!isStale(err)) console.warn("picker render", err);
    } finally {
      clearTimeout(busy);
      if (mine === turn) stage.classList.remove("is-busy");
    }
  };

  const setWeather = () => {
    const c = conditionById(condition);
    const wet = c.weather.rain > 0.02;
    if (isCalm()) {
      // Nothing moves while calm, but the weather keeps up with the choice, so
      // switching it back on never brings back rain (or lightning) from before.
      if (weather) weather.snap(c.weather);
      return;
    }
    if (!weather && wet) {
      weather = new Weather($("#picker-weather"), { quality });
      weather.onFlash = () => flash();
      weather.snap({ rain: 0, cloud: 0, storm: 0, warm: 0 });
      weather.start();
      if (scene) followMask(weather, $("#picker-weather"), canvas, scene);
    }
    if (weather) weather.setState(c.weather, 0.06);
  };
  // Weather switched back on: start the rain for a wet choice made while calm.
  onCalmChange((calm) => {
    if (!calm) setWeather();
  });

  buildStations($("#picker-stations"), cat.visuals, {
    selected: finish,
    onSelect: (id) => {
      finish = id;
      draw();
    },
  });
  buildDeck($("#picker-deck"), {
    selected: condition,
    onSelect: (id) => {
      condition = id;
      setWeather();
      draw();
    },
  });
  label();

  // The house as it is, at the size its new roofs will come in, until the first is ready.
  loadImage(sample.url)
    .then((img) => {
      if (shown) return;
      const k = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    })
    .catch(() => undefined);

  sceneReady.then((s) => {
    scene = s;
    if (weather && scene) followMask(weather, $("#picker-weather"), canvas, scene);
  });

  const start = () => draw();
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: "500px 0px" }
    );
    io.observe(box);
  } else {
    start();
  }
}

// ---------------------------------------------------------------------------

async function boot() {
  const engine = new Engine();
  // The storm shouldn't wait for the speed test: a slow answer means "middling".
  const quick = Promise.race([probeQuality(), new Promise((res) => setTimeout(() => res("mid"), 350))]);
  const [cat, samples, quality] = await Promise.all([loadCatalogue(), loadSamples(), quick]);
  // The hero and the picker share one scene of the hero's house, worked at the
  // size the larger of their two stages needs.
  const heroStage = $("#hero-stage");
  const sample = samples.find((s) => heroStage && s.id === heroStage.dataset.sample) || samples[0];
  const edge = sample ? workingEdge(sample, [heroStage, $("#picker-stage")]) : EDGE_MAX;
  const sceneReady = initHero(engine, quality, cat, sample, edge);
  initPicker(engine, quality, cat, samples, sceneReady, edge);
}

boot().catch((err) => console.error(err));
