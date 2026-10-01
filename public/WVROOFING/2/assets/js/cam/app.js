// WV Roofing v2 — the Roof Cam: the visualiser as an outside broadcast.
//
//   On air     a photo of your house (camera or library) or a sample house
//   Find       tap each roof slope; auto-roof.js finds its edges. "Cut out" and
//              tap a chimney to keep it, Tighter or Looser to adjust the last
//              tap. "Draw it myself" opens the classic editor with the outline
//              already in it.
//   On air     the eight roofs on your house, in sun, drizzle, storm and dusk,
//              with rain that lands on your roof. Hold to see the old one.
//
// The roofs are drawn on this device: the photo is opened by the browser and
// drawn on canvases, straight away. At the same time the visitor's own photo
// (never a sample) is saved in the background to WV Roofing's private store
// (store.js), so the roofer can see it; the "save light" under the controls
// says how that is going, with Try again or Delete. "Send it to the roofer"
// sends their details, and the preview of the roof they chose, as an enquiry.
import { flash, getGauge, holdGauge } from "../site.js";
import { isCalm, onCalmChange, probeQuality } from "../quality.js";
import { Weather } from "../weather.js";
import { Engine, isStale } from "../engine/engine.js";
import { suggestRoof, TOLERANCES } from "../engine/auto-roof.js";
import { buildMask, maskStats, erode, iou } from "../engine/mask-ops.js";
import { MaskEditor } from "../engine/mask-editor.js";
import { blobToCanvas, headerSize, loadSample, photoWarnings, PhotoError } from "../engine/photo.js";
import { watermarked, downloadCanvas } from "../engine/watermark.js";
import { conditionById } from "../engine/grade.js";
import { loadCatalogue, loadSamples, loadImage, SHARED } from "../data.js";
import { buildStations, buildDeck, putImage, wearRoof } from "../ui.js";
import { buildShareCard, canShareFile, shareFile, downloadBlob } from "./share.js";
import * as store from "./store.js";
// The enquiry form's checks, request key and messages are version 1's, so both
// versions send exactly the same enquiry.
import { wireEnquiryForm } from "/WVROOFING/assets/js/enquiry.js";

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const MAX_FILE = 40 * 1024 * 1024;
const QUICK_EDGE = 640;
// The find screen's amber tint is worked out at this size, then drawn up to the photo.
const TINT_EDGE = 480;
// How long the roof catalogue may take before the page offers to try again.
const CATALOGUE_WAIT_MS = 20000;

const emptyCard = () => ({ key: "", file: null, blob: null, building: null });

const S = {
  cat: null,
  samples: [],
  quality: "mid",
  engine: null,
  screen: "onair",
  photo: null, // { canvas, w, h, pixels: ImageData, sample, title, credit, warnings }
  loadTicket: 0, // bumps with every photo or sample chosen: only the latest one opens
  loading: false, // a photo or sample is being opened
  taps: [], // { mode: "add"|"sub", seed: [x, y], tol: index into TOLERANCES, result }
  drawn: null, // an outline that didn't come from taps: a sample's, or one drawn by hand
  shapes: [], // the roof outline in photo pixels (editor shapes): drawn + taps
  findFor: null, // the photo the find screen is set up for
  findStats: null,
  tapMode: "add",
  cursor: null, // keyboard cursor [x, y] on the find screen
  editor: null,
  finish: null, // the roof the visitor chose
  condition: "noon", // the weather the visitor chose
  scene: null, // the full-size scene: { w, h, mask, eaves, frac, stats, ... }
  quick: null,
  airPhoto: null, // the photo the on-air stage is set up for
  stations: null,
  deck: null,
  thumbsDrawn: new Set(),
  air: 0, // bumps whenever a new roof outline goes on air, so late answers are ignored
  redrawn: 0, // automatic redraws for this outline (if the drawing thread stops)
  front: 0, // which stage layer is showing (0 = a, 1 = b)
  shown: { finish: "", condition: "" }, // what the stage really shows (the choice may still be drawing)
  lastRender: null, // { ms, finish, condition }
  before: { condition: "", ready: false, wanted: false }, // what #air-before holds, and whether it's wanted
  held: false,
  weather: { onair: null, air: null },
  card: emptyCard(),
};

// ---------------------------------------------------------------------------
// little helpers

function announce(msg) {
  const live = $("#cam-live");
  if (!live) return;
  live.textContent = "";
  setTimeout(() => {
    live.textContent = msg;
  }, 40);
}

const statusSeq = new WeakMap();

/**
 * Put a message in one of the status lines. The line stays in the page even
 * when it's empty (it then takes no room), so screen readers hear each message.
 */
function setStatus(id, msg) {
  const el = $(id);
  if (!el) return;
  const text = msg || "";
  const seq = (statusSeq.get(el) || 0) + 1;
  statusSeq.set(el, seq);
  el.hidden = false;
  if (text && el.textContent === text) {
    // The same message again: clear it first, so it's read out again.
    el.textContent = "";
    setTimeout(() => {
      if (statusSeq.get(el) === seq) el.textContent = text;
    }, 40);
    return;
  }
  el.textContent = text;
}

const tick = () => new Promise((res) => setTimeout(res, 0));
const frame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));

function gauge(value, text) {
  const g = getGauge();
  if (g) g.set(value, text);
}

function params() {
  return new URLSearchParams(window.location.search);
}

/** A copy of a canvas, taken now (the original may be redrawn later). */
function snapshot(src) {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  c.getContext("2d").drawImage(src, 0, 0);
  return c;
}

/** Let a canvas's pixels go. */
function release(c) {
  if (!c) return;
  c.width = 0;
  c.height = 0;
}

/** A sample house's name in the page's words ("1920s-30s detached house"). */
function houseName(sample) {
  const t = String((sample && sample.title) || "sample house");
  return /detached$/i.test(t) ? t + " house" : t;
}

/** "the 1930s hipped semi" or "your house". */
function whose(lower) {
  if (S.photo && S.photo.sample) return (lower ? "the " : "The ") + houseName(S.photo.sample).toLowerCase();
  return lower ? "your house" : "Your house";
}

/** Keep ?sample= and ?tile= in the address, so a link reopens the same roof. */
function writeUrl() {
  const p = params();
  p.delete("selftest");
  if (S.photo && S.photo.sample) p.set("sample", S.photo.sample.id);
  else p.delete("sample");
  if (S.finish && S.screen === "air") p.set("tile", S.finish);
  const q = p.toString();
  history.replaceState(history.state, "", window.location.pathname + (q ? "?" + q : ""));
}

// ---------------------------------------------------------------------------
// screens

function show(screen, opts) {
  const o = opts || {};
  S.screen = screen;
  $$(".cam-screen").forEach((el) => {
    el.hidden = el.dataset.screen !== screen;
  });
  if (o.push !== false) history.pushState({ screen }, "", window.location.href);
  writeUrl();
  window.scrollTo(0, 0);
  if (o.focus !== false) {
    // On the find screen the roof finder itself takes focus: it's the keyboard's
    // way to mark the roof, and it comes before the sheet in the page.
    const el = screen === "find" ? overlayCanvas() : $('[data-screen="' + screen + '"] h1, [data-screen="' + screen + '"] h2');
    if (el) el.focus({ preventScroll: true });
  }
  // Weather only where it's on screen.
  if (S.weather.onair) {
    if (screen === "onair") S.weather.onair.start();
    else S.weather.onair.stop();
  }
  if (S.weather.air) {
    if (screen === "air") placeAirWeather();
    else S.weather.air.stop();
  }
  if (screen !== "draw" && S.editor) {
    S.editor.destroy();
    S.editor = null;
    $("#editor-stage").replaceChildren(); // let the editor's full-size canvases go
  }
  if (screen === "find") kickOverlay();
  else releaseFind();
  torch(); // on air at dusk only; anywhere else it stops and lets go
  if (screen === "onair") gauge(0, "Waiting for a photo");
  saveLight();
  stickHeight();
}

function canShow(screen) {
  if (screen === "onair") return true;
  if (screen === "find" || screen === "draw") return !!S.photo;
  if (screen === "air") return !!(S.photo && S.airPhoto === S.photo && S.shapes.length);
  return false;
}

window.addEventListener("popstate", (e) => {
  // A link within the page (the skip link) adds an entry with no screen: not a change of screen.
  if (!e.state || !e.state.screen) return;
  const want = e.state.screen;
  const go = canShow(want) ? want : "onair";
  if (go !== want) history.replaceState({ screen: go }, "", window.location.href);
  if (go === "draw") {
    openEditor(false);
    return;
  }
  // The find screen may still hold an earlier photo (a sample never goes through it).
  if (go === "find" && S.findFor !== S.photo) setupFind();
  show(go, { push: false });
});

/** How much of the top of the screen the sticky picture covers (for scrolling focus into view). */
function stickHeight() {
  const wrap = $(".cam-screen:not([hidden]) .cam-stagewrap");
  const h = wrap ? Math.round(wrap.getBoundingClientRect().height) : 0;
  document.documentElement.style.setProperty("--cam-stick", h + "px");
}

function wireStick() {
  if (typeof ResizeObserver === "undefined") {
    window.addEventListener("resize", stickHeight);
    return;
  }
  const ro = new ResizeObserver(stickHeight);
  $$(".cam-stagewrap").forEach((el) => ro.observe(el));
}

// ---------------------------------------------------------------------------
// the save light: how saving the visitor's photo for the roofer is going

const SAVE_WORDS = {
  saving: "Saving your photo for the roofer",
  saved: "Saved for the roofer. Kept privately for 30 days, or with your enquiry.",
  off: "Not saved: WV Roofing's photo store isn't switched on yet, so your photo stays on this device. The roofs work just the same.",
  deleted: "Deleted from WV Roofing. It's still on this screen until you start again.",
};

let lastSave = "";

function saveLight() {
  const s = store.status();
  const own = !!(S.photo && !S.photo.sample);
  const show = own && s.state !== "idle";
  const text = s.state === "failed" ? "Your photo couldn't be saved for the roofer: " + (s.message || "please try again.") + " The roofs still work." : SAVE_WORDS[s.state] || "";
  // The words change (and are read out) only when the state does; the percentage just moves.
  const words = s.state + "|" + text;
  for (const el of [$("#save-find"), $("#save-air")]) {
    if (!el) continue;
    el.hidden = !show;
    if (!show) continue;
    el.dataset.state = s.state;
    el.style.setProperty("--save", String(s.state === "saving" ? s.progress : 1));
    if (el.dataset.words !== words) {
      el.dataset.words = words;
      const msg = document.createElement("span");
      msg.className = "savelight-text";
      msg.textContent = text;
      const parts = [msg];
      if (s.state === "saving") {
        const pct = document.createElement("span");
        pct.className = "savelight-pct";
        pct.setAttribute("aria-hidden", "true");
        parts.push(pct);
      }
      if (s.state === "saved") parts.push(saveAction("Delete it", deleteSaved));
      if (s.state === "failed") parts.push(saveAction("Try again", () => store.retry()));
      el.replaceChildren(...parts);
    }
    const pct = el.querySelector(".savelight-pct");
    if (pct) pct.textContent = Math.round(s.progress * 100) + "%";
  }
  if (show && words !== lastSave && (s.state === "saved" || s.state === "failed" || s.state === "off")) announce(text);
  lastSave = words;
}

function saveAction(label, fn) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "link-btn savelight-btn";
  b.textContent = label;
  b.addEventListener("click", fn);
  return b;
}

async function deleteSaved() {
  if (!window.confirm("Delete your photo from WV Roofing's store? If you've sent it to the roofer, it's taken out of your enquiry too (an email that has already reached them stays in their inbox).")) return;
  try {
    await store.deletePhoto();
  } catch (err) {
    announce("Your photo couldn't be deleted just now. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// on air: the photo

async function sniff(file) {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (String.fromCharCode(b[4], b[5], b[6], b[7]) === "ftyp") return "heic";
  return "other";
}

/** The photo buttons work once the roofs have loaded (until then there's nothing to show). */
function setPhotoInputs(on) {
  ["#file-camera", "#file-library"].forEach((s) => {
    const input = $(s);
    if (input) input.disabled = !on;
  });
  $$(".file-btn").forEach((l) => l.classList.toggle("is-waiting", !on));
}

async function handleFile(file) {
  if (!file || !S.cat) return;
  // Turned away before it takes a ticket, so a load already under way carries on.
  if (file.size > MAX_FILE) {
    setStatus("#photo-error", "That photo is over 40 MB. Please choose a smaller copy.");
    return;
  }
  const ticket = ++S.loadTicket;
  setStatus("#photo-error", "");
  const labels = $$(".file-btn");
  labels.forEach((l) => l.classList.add("is-busy"));
  S.loading = true;
  setStatus("#photo-status", "Opening your photo");
  try {
    const kind = await sniff(file).catch(() => "other");
    let canvas;
    try {
      canvas = await blobToCanvas(file);
    } catch (err) {
      if (kind === "heic") throw new Error('This photo is in the iPhone HEIC format, which this browser can\'t open. Choose it again from your photo library (your phone turns it into a JPEG), or set the camera to "Most Compatible".');
      if (err instanceof PhotoError && err.message) throw err;
      throw new Error("This photo couldn't be opened. Please try a JPG or PNG.");
    }
    const head = await headerSize(file);
    if (ticket !== S.loadTicket) {
      release(canvas); // something newer was chosen meanwhile
      return;
    }
    // Saved for the roofer in the background, while the roof is being found.
    store.keepPhoto(file, canvas, head);
    await openPhoto(canvas, null);
  } catch (err) {
    if (ticket === S.loadTicket) setStatus("#photo-error", (err && err.message) || "This photo couldn't be opened.");
  } finally {
    if (ticket === S.loadTicket) {
      S.loading = false;
      setStatus("#photo-status", "");
      labels.forEach((l) => l.classList.remove("is-busy"));
    }
  }
}

async function openSample(sample) {
  // One at a time: a second tap while a house is on its way does nothing.
  if (!S.cat || S.loading) return;
  const ticket = ++S.loadTicket;
  S.loading = true;
  $("#samples").setAttribute("aria-busy", "true");
  setStatus("#photo-error", "");
  setStatus("#photo-status", "Fetching the " + houseName(sample).toLowerCase());
  try {
    const p = await loadSample(sample, SHARED + "samples/");
    if (ticket !== S.loadTicket) return;
    const k = p.w / (sample.w || p.w);
    const shapes = sample.shapes.map((s) => ({ mode: s.mode, pts: s.pts.map((q) => [q[0] * k, q[1] * k]), ...(s.r ? { r: s.r * k } : {}) }));
    // The house has arrived: the first screen is free again before its roofs are
    // drawn (Back while they draw finds the cards working). show("air") hides the
    // cards straight away, so a second tap can't land meanwhile.
    S.loading = false;
    setStatus("#photo-status", "");
    $("#samples").removeAttribute("aria-busy");
    await openPhoto(p.canvas, sample, shapes);
  } catch (err) {
    if (ticket === S.loadTicket) setStatus("#photo-error", "The sample house couldn't be loaded. Please try again.");
  } finally {
    if (ticket === S.loadTicket) {
      S.loading = false;
      setStatus("#photo-status", "");
    }
    $("#samples").removeAttribute("aria-busy");
  }
}

/** A photo is ready (the visitor's or a sample's): on to finding the roof, or straight on air. */
async function openPhoto(canvas, sample, shapes) {
  const w = canvas.width;
  const h = canvas.height;
  const pixels = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h);
  const warnings = sample ? [] : photoWarnings({ canvas, w, h, originalW: w, originalH: h, pixels });
  S.photo = { canvas, w, h, pixels, sample, title: sample ? houseName(sample) : "Your house", credit: sample ? sample.credit : "", warnings };
  S.taps = [];
  S.drawn = sample && shapes ? shapes : null;
  S.shapes = S.drawn ? S.drawn.slice() : [];
  S.scene = null;
  S.quick = null;
  S.findFor = null;
  S.air++;
  // The last house's drawings are no longer wanted anywhere.
  S.engine.drop("full");
  S.engine.drop("quick");
  // A sample house is never saved: the light is for the visitor's own photo.
  if (sample) store.clearSave();
  saveLight();
  if (sample && shapes) {
    await goAir();
    return;
  }
  setupFind();
  show("find");
  announce("Photo ready. Tap the middle of your roof.");
}

function renderSamples() {
  const box = $("#samples");
  if (!S.samples.length) {
    box.removeAttribute("role");
    box.innerHTML = '<p class="mono muted">The sample houses aren\'t available right now.</p>';
    return;
  }
  const items = S.samples.map((s) => {
    // The list item holds the button, so the button stays a button to screen readers.
    const item = document.createElement("div");
    item.className = "sample-item";
    item.setAttribute("role", "listitem");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sample-card";
    const name = houseName(s);
    b.setAttribute("aria-label", "Use the sample house: " + name + ". " + s.credit + ".");
    const img = document.createElement("img");
    img.src = s.thumb || s.url; // a small copy: the full photo is only fetched when it's chosen
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 480;
    img.height = 360;
    const t = document.createElement("span");
    t.textContent = name;
    const small = document.createElement("small");
    small.textContent = s.credit;
    t.appendChild(small);
    b.append(img, t);
    b.addEventListener("click", () => openSample(s));
    item.appendChild(b);
    return item;
  });
  box.replaceChildren(...items);
}

function wireOnAir() {
  const pick = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    handleFile(f);
  };
  $("#file-camera").addEventListener("change", pick);
  $("#file-library").addEventListener("change", pick);
  // Drop or paste a photo anywhere on the first screen (desktop).
  const onair = $('[data-screen="onair"]');
  onair.addEventListener("dragover", (e) => e.preventDefault());
  onair.addEventListener("drop", (e) => {
    e.preventDefault();
    if (!S.cat) return;
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
  window.addEventListener("paste", (e) => {
    if (S.screen !== "onair" || !S.cat) return;
    const item = Array.from((e.clipboardData && e.clipboardData.items) || []).find((i) => i.type.startsWith("image/"));
    if (item) handleFile(item.getAsFile());
  });
  $("#cam-retry").addEventListener("click", () => readyCatalogue());
}

// ---------------------------------------------------------------------------
// the roofs: nothing can go on air until they've loaded

let catalogueDone = () => {};
const catalogueReady = new Promise((res) => {
  catalogueDone = res;
});

function takeCatalogue(cat) {
  if (S.cat) return;
  if (!cat || !cat.visuals || !cat.visuals.length) {
    failCatalogue();
    return;
  }
  S.cat = cat;
  const tile = params().get("tile");
  S.finish = tile && cat.byId.has(tile) ? tile : "spanish-slate";
  if (!cat.byId.has(S.finish)) S.finish = cat.visuals[0].id;
  $("#cam-retry").hidden = true;
  setStatus("#photo-error", "");
  setStatus("#photo-status", "");
  setPhotoInputs(true);
  catalogueDone(cat);
}

function failCatalogue() {
  if (S.cat) return;
  setStatus("#photo-status", "");
  setStatus("#photo-error", "The roofs didn't load, so the Roof Cam can't start yet. Check your connection, then press Try again.");
  $("#cam-retry").hidden = false;
}

/** Load the roofs (again, after a failure). A slow answer offers a retry but is still used if it arrives. */
function readyCatalogue() {
  if (S.cat) return;
  $("#cam-retry").hidden = true;
  setStatus("#photo-error", "");
  // Only mention the wait if there is one.
  const note = setTimeout(() => {
    if (!S.cat) setStatus("#photo-status", "Getting the Roof Cam ready");
  }, 600);
  const slow = setTimeout(failCatalogue, CATALOGUE_WAIT_MS);
  const settle = () => {
    clearTimeout(note);
    clearTimeout(slow);
  };
  loadCatalogue().then(
    (cat) => {
      settle();
      takeCatalogue(cat);
    },
    (err) => {
      settle();
      console.warn(err);
      failCatalogue();
    }
  );
}

// ---------------------------------------------------------------------------
// find the roof: one tap at a time

const findCanvas = () => $("#find-photo");
const overlayCanvas = () => $("#find-overlay");

function fitStage(stage, w, h) {
  stage.style.setProperty("--ar", String(w / h));
  stage.style.aspectRatio = w + " / " + h;
}

function setupFind() {
  const { w, h } = S.photo;
  fitStage($("#find-stage"), w, h);
  const pc = findCanvas();
  pc.width = w;
  pc.height = h;
  S.findFor = S.photo;
  S.cursor = null;
  rebuildShapes();
  readout();
  setTapMode("add");
}

function combinedShapes() {
  const out = S.drawn ? S.drawn.slice() : [];
  for (const t of S.taps) {
    if (!t.result) continue;
    for (const s of t.result.shapes) {
      if (t.mode === "sub") {
        if (s.mode === "add") out.push({ mode: "sub", pts: s.pts });
      } else out.push(s);
    }
  }
  return out;
}

function rebuildShapes() {
  const { w, h } = S.photo;
  S.shapes = combinedShapes();
  // A small copy of the outline is plenty for the numbers and for the tint.
  const k = Math.min(1, TINT_EDGE / Math.max(w, h));
  const lw = Math.max(1, Math.round(w * k));
  const lh = Math.max(1, Math.round(h * k));
  const mask = buildMask(S.shapes, lw, lh, lw / w, lh / h);
  const st = maskStats(mask, lw, lh);
  paintFindPhoto(mask, lw, lh, st.empty);
  S.findStats = st;
  const last = S.taps[S.taps.length - 1];
  $("#find-undo").disabled = !S.taps.length;
  $("#tighter").disabled = !last || last.tol <= 0;
  $("#looser").disabled = !last || last.tol >= TOLERANCES.length - 1;
  $("#find-done").disabled = st.empty || st.frac < 0.003;
  const scale = $("#tune-scale");
  scale.replaceChildren(
    ...TOLERANCES.map((t, i) => {
      const el = document.createElement("i");
      if (last && i === last.tol) el.className = "is-on";
      el.style.height = 30 + (70 * i) / (TOLERANCES.length - 1) + "%";
      return el;
    })
  );
  drawOverlay(performance.now());
}

/** The photo with the amber tint over the roof: drawn once per change, under the moving outline. */
function paintFindPhoto(mask, lw, lh, empty) {
  if (S.findFor !== S.photo) return;
  const { canvas, w, h } = S.photo;
  const ctx = findCanvas().getContext("2d");
  ctx.drawImage(canvas, 0, 0);
  if (empty) return;
  const tint = document.createElement("canvas");
  tint.width = lw;
  tint.height = lh;
  const tctx = tint.getContext("2d");
  const img = tctx.createImageData(lw, lh);
  const d = img.data;
  for (let i = 0, j = 0; i < mask.length; i++, j += 4) {
    if (mask[i] < 128) continue;
    d[j] = 201;
    d[j + 1] = 168;
    d[j + 2] = 76;
    d[j + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalAlpha = 0.36;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tint, 0, 0, w, h);
  ctx.restore();
  release(tint);
}

// The outline layer is sized to the picture on screen (not the photo), so a
// frame of the crawling outline is cheap.
const overlayBox = { w: 0, h: 0, watched: false };
let overlayRaf = 0;
let antsOffset = 0;
let antsDrawn = 0;
let tapRing = null; // { p, start }: the ring that spreads from a tap

function drawOverlay(now) {
  const oc = overlayCanvas();
  if (!oc || !S.photo || S.findFor !== S.photo) return;
  if (!overlayBox.watched) {
    const r = oc.getBoundingClientRect();
    overlayBox.w = r.width;
    overlayBox.h = r.height;
  }
  if (!(overlayBox.w > 0 && overlayBox.h > 0)) return;
  const d = Math.min(2, window.devicePixelRatio || 1);
  const bw = Math.max(1, Math.round(overlayBox.w * d));
  const bh = Math.max(1, Math.round(overlayBox.h * d));
  if (oc.width !== bw) oc.width = bw;
  if (oc.height !== bh) oc.height = bh;
  const { w, h } = S.photo;
  const sx = bw / w;
  const k = d / sx; // photo pixels per screen pixel: lines keep their width on screen
  const ctx = oc.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, bw, bh);
  ctx.setTransform(sx, 0, 0, bh / h, 0, 0);
  ctx.lineJoin = "round";
  for (const s of S.shapes) {
    if (!s.pts || s.pts.length < 3 || s.r) continue;
    ctx.beginPath();
    s.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.setLineDash([]);
    ctx.lineWidth = 4 * k;
    ctx.strokeStyle = "rgba(11, 18, 32, 0.7)";
    ctx.stroke();
    ctx.setLineDash([9 * k, 7 * k]);
    ctx.lineDashOffset = -antsOffset * k;
    ctx.lineWidth = 2 * k;
    ctx.strokeStyle = s.mode === "sub" ? "#8fd4f4" : "#e9c462";
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (S.cursor) {
    const [x, y] = S.cursor;
    ctx.strokeStyle = "#f5f0e8";
    ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.moveTo(x - 14 * k, y);
    ctx.lineTo(x + 14 * k, y);
    ctx.moveTo(x, y - 14 * k);
    ctx.lineTo(x, y + 14 * k);
    ctx.stroke();
  }
  if (tapRing && now !== undefined) {
    const a = Math.max(0, Math.min(1, (now - tapRing.start) / 420));
    ctx.strokeStyle = "rgba(233, 196, 98, " + (1 - a) + ")";
    ctx.lineWidth = 3 * k;
    ctx.beginPath();
    ctx.arc(tapRing.p[0], tapRing.p[1], (8 + 46 * a) * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function kickOverlay() {
  if (!overlayRaf) overlayRaf = requestAnimationFrame(overlayFrame);
}

/** The "marching front line" round the roof: the dashes crawl (never when calm), at about 15 frames a second. */
function overlayFrame(t) {
  overlayRaf = 0;
  if (S.screen !== "find") return;
  const calm = isCalm();
  if (tapRing && (calm || t - tapRing.start >= 420)) tapRing = null;
  const crawling = !calm && S.shapes.length > 0;
  if (tapRing || !crawling || t - antsDrawn >= 66) {
    if (crawling) antsOffset = (t / 40) % 32;
    antsDrawn = t;
    drawOverlay(t);
  }
  if (tapRing || crawling) overlayRaf = requestAnimationFrame(overlayFrame);
}

function runAnts() {
  kickOverlay();
}

/** Let the find screen's canvases go (it's set up again when it's next shown). */
function releaseFind() {
  cancelAnimationFrame(overlayRaf);
  overlayRaf = 0;
  tapRing = null;
  if (!S.findFor) return;
  S.findFor = null;
  release(findCanvas());
  release(overlayCanvas());
}

function wireOverlaySize() {
  const oc = overlayCanvas();
  if (typeof ResizeObserver === "undefined") {
    window.addEventListener("resize", () => {
      if (S.screen === "find") drawOverlay(performance.now());
    });
    return;
  }
  overlayBox.watched = true;
  new ResizeObserver((entries) => {
    const r = entries[entries.length - 1].contentRect;
    overlayBox.w = r.width;
    overlayBox.h = r.height;
    if (S.screen === "find") drawOverlay(performance.now());
  }).observe(oc);
}

function shareOfPicture(st) {
  const pct = st && !st.empty ? Math.max(0.1, st.frac * 100) : 0;
  return pct >= 10 ? Math.round(pct) + "%" : pct.toFixed(1) + "%";
}

function readout() {
  const el = $("#find-readout");
  const st = S.findStats;
  const last = S.taps[S.taps.length - 1];
  const marked = !!(st && !st.empty);
  $("#find-prompt").hidden = !!last || marked;
  let text;
  let warn = false;
  if (!last) {
    const warnings = S.photo.warnings.join(" ");
    if (marked) text = "Roof marked · " + shareOfPicture(st) + " of the picture. Tap another slope to add it, or Looks right.";
    else {
      text = warnings || "Tap the middle of a roof slope.";
      warn = !!warnings;
    }
    el.textContent = text;
    el.classList.toggle("is-warn", warn);
    return;
  }
  const res = last.result;
  const slopes = S.taps.filter((t) => t.mode === "add").length;
  const cuts = S.taps.filter((t) => t.mode === "sub").length;
  text = "Roof found · " + shareOfPicture(st) + " of the picture · " + slopes + " slope" + (slopes === 1 ? "" : "s") + (cuts ? " · " + cuts + " cut out" : "");
  if (!res || !res.shapes.length) {
    text = "Nothing found there. Tap nearer the middle of the slope.";
    warn = true;
  } else if (res.confidence < 0.5) {
    text += ". Not sure about that one" + (res.reason ? " (" + res.reason + ")" : "") + ": try Tighter, or Undo and tap again.";
    warn = true;
  } else {
    text += ". Tap another slope to add it, or Looks right.";
  }
  el.textContent = text;
  el.classList.toggle("is-warn", warn);
}

async function runTap(t) {
  const photo = S.photo;
  $("#find-prompt").hidden = true;
  // The readout is a status line: screen readers hear this, then the result.
  const el = $("#find-readout");
  el.textContent = t.mode === "sub" ? "Cutting that out" : "Finding the roof";
  await frame();
  if (S.photo !== photo || S.taps.indexOf(t) < 0) return; // the photo changed, or the tap was undone
  const opts = t.mode === "sub" ? { maxFrac: 0.2, minFrac: 0.0003 } : {};
  if (t.tol !== null && t.tol !== undefined) opts.tolerance = TOLERANCES[t.tol];
  const t0 = performance.now();
  t.result = suggestRoof(photo.pixels, t.seed, opts);
  t.ms = Math.round(performance.now() - t0);
  if (t.tol === null || t.tol === undefined) {
    let best = 0;
    TOLERANCES.forEach((v, i) => {
      if (Math.abs(v - t.result.tolerance) < Math.abs(TOLERANCES[best] - t.result.tolerance)) best = i;
    });
    t.tol = best;
  }
  if (S.findFor !== photo) return;
  rebuildShapes();
  readout();
  runAnts();
}

function imagePoint(e) {
  const oc = overlayCanvas();
  const r = oc.getBoundingClientRect();
  const x = ((e.clientX - r.left) * S.photo.w) / r.width;
  const y = ((e.clientY - r.top) * S.photo.h) / r.height;
  return [Math.max(0, Math.min(S.photo.w - 1, x)), Math.max(0, Math.min(S.photo.h - 1, y))];
}

function tapAt(p) {
  const t = { mode: S.tapMode, seed: [Math.round(p[0]), Math.round(p[1])], tol: null, result: null };
  S.taps.push(t);
  if (!isCalm()) {
    tapRing = { p, start: performance.now() };
    kickOverlay();
  }
  runTap(t);
}

function setTapMode(mode) {
  S.tapMode = mode;
  $("#mode-add").setAttribute("aria-pressed", mode === "add" ? "true" : "false");
  $("#mode-remove").setAttribute("aria-pressed", mode === "sub" ? "true" : "false");
}

function wireFind() {
  const oc = overlayCanvas();
  let down = null;
  oc.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button > 0) return;
    down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
  });
  oc.addEventListener("pointercancel", () => {
    down = null;
  });
  oc.addEventListener("pointerup", (e) => {
    if (!down || down.id !== e.pointerId || S.findFor !== S.photo) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const long = performance.now() - down.t > 900;
    down = null;
    if (moved > 12 || long) return; // a scroll or a long press, not a tap
    tapAt(imagePoint(e));
  });
  oc.addEventListener("keydown", (e) => {
    if (!S.photo || S.findFor !== S.photo) return;
    const stepPx = (e.shiftKey ? 0.05 : 0.01) * S.photo.w;
    const move = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (move) {
      e.preventDefault();
      if (!S.cursor) S.cursor = [S.photo.w / 2, S.photo.h / 2];
      S.cursor = [Math.max(0, Math.min(S.photo.w - 1, S.cursor[0] + move[0] * stepPx)), Math.max(0, Math.min(S.photo.h - 1, S.cursor[1] + move[1] * stepPx))];
      drawOverlay(performance.now());
      announce("Cross at " + Math.round((100 * S.cursor[0]) / S.photo.w) + "% across, " + Math.round((100 * S.cursor[1]) / S.photo.h) + "% down.");
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!S.cursor) {
        // The first Enter puts the cross in the middle; the next one taps there.
        S.cursor = [S.photo.w / 2, S.photo.h / 2];
        drawOverlay(performance.now());
        announce("Cross in the middle of the picture. Move it with the arrow keys, then press Enter to tap there.");
        return;
      }
      tapAt(S.cursor);
    }
  });
  $("#mode-add").addEventListener("click", () => setTapMode("add"));
  $("#mode-remove").addEventListener("click", () => setTapMode("sub"));
  $("#find-undo").addEventListener("click", () => {
    S.taps.pop();
    rebuildShapes();
    readout(); // the readout is a status line, so the change is read out
    runAnts();
  });
  const retune = (d) => {
    const last = S.taps[S.taps.length - 1];
    if (!last) return;
    const next = Math.max(0, Math.min(TOLERANCES.length - 1, last.tol + d));
    if (next === last.tol) return;
    last.tol = next;
    runTap(last);
  };
  $("#tighter").addEventListener("click", () => retune(-1));
  $("#looser").addEventListener("click", () => retune(1));
  $("#find-done").addEventListener("click", () => goAir());
  $("#find-draw").addEventListener("click", () => openEditor(true));
  $("#find-back").addEventListener("click", () => show("onair"));
  wireOverlaySize();
}

// ---------------------------------------------------------------------------
// draw it yourself (the classic editor, with the outline already in it)

function openEditor(push) {
  if (!S.photo) return;
  show("draw", { push });
  if (S.editor) S.editor.destroy();
  // The editor's width follows its box: this keeps the whole photo on screen with the sheet.
  $("#editor-stage").style.setProperty("--ar", String(S.photo.w / S.photo.h));
  S.editor = new MaskEditor({
    root: $("#editor-stage"),
    photo: S.photo.canvas,
    onChange: drawUi,
    announce,
  });
  S.editor.setBrush(18);
  S.editor.setShapes(S.shapes);
  setTool("outline");
  // The picture takes focus: it's where the drawing happens (Enter closes a shape).
  S.editor.view.focus({ preventScroll: true });
  requestAnimationFrame(() => {
    if (S.editor) S.editor.fit();
    stickHeight();
  });
}

function setTool(tool) {
  $$(".tool").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tool === tool ? "true" : "false"));
  if (S.editor) S.editor.setTool(tool);
}

function drawUi(st) {
  const pct = st.empty ? "0%" : (st.frac * 100).toFixed(st.frac < 0.1 ? 1 : 0) + "%";
  let msg = "Roof marked: " + pct;
  if (st.warning === "small") msg += ". That's a very small area.";
  if (st.warning === "large") msg += ". That's more than half the picture: check it's only the roof.";
  const ro = $("#draw-readout");
  ro.textContent = msg;
  ro.classList.remove("is-warn");
  const ed = S.editor;
  const draft = !!(ed && ed.draft && ed.draft.pts.length >= 3);
  // With nothing marked yet, only a roof outline can go on air (a cut-out alone marks no roof).
  $("#draw-done").disabled = st.empty ? !(draft && ed.draft.mode === "add") : false;
  $("#draw-undo").disabled = !(ed && ed.canUndo());
  $("#draw-redo").disabled = !(ed && ed.canRedo());
  $("#draw-finish").disabled = !draft;
}

function wireDraw() {
  $$(".tool").forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool)));
  $("#draw-finish").addEventListener("click", () => S.editor && S.editor.finishDraft());
  $("#draw-undo").addEventListener("click", () => S.editor && S.editor.undo());
  $("#draw-redo").addEventListener("click", () => S.editor && S.editor.redo());
  $("#draw-clear").addEventListener("click", () => S.editor && S.editor.clear());
  $("#draw-back").addEventListener("click", () => {
    // Back to the outline the editor opened with (the drawn one, plus any taps).
    setupFind();
    show("find");
  });
  $("#draw-done").addEventListener("click", () => {
    const ed = S.editor;
    if (!ed) return;
    if (ed.draft && ed.draft.pts.length >= 3) ed.finishDraft();
    const shapes = ed.getShapes();
    if (!shapes.length || ed.stats().empty) {
      const ro = $("#draw-readout");
      ro.textContent = "No roof is marked yet. Outline a roof slope first, then Looks right.";
      ro.classList.add("is-warn");
      return;
    }
    S.drawn = shapes; // the drawing replaces the taps
    S.taps = [];
    S.shapes = shapes.slice();
    goAir();
  });
}

// ---------------------------------------------------------------------------
// on your roof

const layers = () => [$("#air-a"), $("#air-b")];

function currentLayer() {
  return layers()[S.front];
}

/** Is the stage showing exactly the roof and the weather that are chosen? */
function stageCurrent() {
  return !!S.shown.finish && S.shown.finish === S.finish && S.shown.condition === S.condition;
}

async function goAir(opts) {
  if (!S.photo || !S.shapes.length) return;
  if (!S.cat) {
    announce("The Roof Cam is still getting ready. Please try again in a moment.");
    return;
  }
  if (!(opts && opts.again)) S.redrawn = 0;
  const mine = ++S.air;
  const photo = S.photo;
  const { canvas, w, h } = photo;
  fitStage($("#air-stage"), w, h);
  [...layers(), $("#air-before")].forEach((c) => {
    c.width = w;
    c.height = h;
  });
  // Until the new roof arrives, the house as it is. That is also the "before"
  // in As shot (its grade changes nothing), so a hold shows the real thing at once.
  currentLayer().getContext("2d").drawImage(canvas, 0, 0);
  $("#air-before").getContext("2d").drawImage(canvas, 0, 0);
  S.before = { condition: "noon", ready: true, wanted: false };
  S.scene = null;
  S.quick = null;
  S.airPhoto = photo;
  S.thumbsDrawn.clear();
  S.shown = { finish: "", condition: "" };
  S.card = emptyCard();
  clearTimeout(cardTimer);
  setHeld(false);
  setStatus("#air-status", "");
  if (S.weather.air) S.weather.air.setMask(null); // no raindrops on the last roof's shape
  S.stations = buildStations($("#air-stations"), S.cat.visuals, { selected: S.finish, onSelect: pickFinish });
  label();
  stageLabel();
  show("air", { push: S.screen !== "air" });
  holdGauge(true);
  gauge(0, "0 of 8 roofs drawn");
  $("#air-progress").textContent = "· drawing";
  announce("Drawing eight roofs on " + whose(true) + ".");

  try {
    const sc = await S.engine.scene("full", canvas, S.shapes, { maxEdge: Math.max(w, h) });
    if (mine !== S.air) return;
    if (!sc.ok) {
      noRoof();
      return;
    }
    sc.stats = maskStats(sc.mask, sc.w, sc.h);
    S.scene = sc;
    placeAirWeather();
    torch();
    await showRoof();
    if (mine !== S.air) return;
    const quick = await S.engine.scene("quick", canvas, S.shapes, { maxEdge: QUICK_EDGE });
    if (mine !== S.air) return;
    S.quick = quick;
    drawThumbs(mine);
  } catch (err) {
    if (mine === S.air) renderFailed(err);
  }
}

/** The outline marks no roof at all: back to where it was made, saying so. */
function noRoof() {
  S.airPhoto = null;
  $("#air-progress").textContent = "";
  gauge(0, "No roof marked");
  const msg = "No roof is marked yet. Mark a roof slope, then press Looks right.";
  if (S.taps.length) {
    setupFind();
    show("find", { push: false });
    history.replaceState({ screen: "find" }, "", window.location.href);
    const ro = $("#find-readout");
    ro.textContent = msg;
    ro.classList.add("is-warn");
  } else {
    openEditor(false);
    history.replaceState({ screen: "draw" }, "", window.location.href);
    const ro = $("#draw-readout");
    ro.textContent = msg;
    ro.classList.add("is-warn");
  }
}

/**
 * A drawing failed for some reason other than a newer outline. If the drawing
 * thread stopped, the engine has started afresh without this house, so send
 * the house again, once; after that, say so and point at what still works.
 */
function renderFailed(err) {
  if (isStale(err)) return;
  console.warn(err);
  $("#air-stage").classList.remove("is-busy");
  if (!S.photo || !S.shapes.length) return;
  if (S.screen === "air" && S.redrawn < 1) {
    S.redrawn++;
    goAir({ again: true });
    return;
  }
  setStatus("#air-status", "The roofs couldn't be drawn on this device just now. Try Edit the roof outline, then Looks right, or Start again.");
}

/** Where the roof is, for the rain on the stage. */
function placeAirWeather() {
  const cond = conditionById(S.condition);
  const wet = cond.weather.rain > 0.02 || cond.weather.storm > 0;
  if (!S.weather.air && (!wet || isCalm())) return;
  if (!S.weather.air) {
    S.weather.air = new Weather($("#air-weather"), { quality: S.quality });
    S.weather.air.onFlash = () => {
      flash();
      if (!isCalm() && navigator.vibrate) navigator.vibrate(30);
    };
    S.weather.air.snap({ rain: 0, cloud: 0, storm: 0, warm: 0 });
  }
  if (S.scene && S.screen === "air") {
    const wc = $("#air-weather");
    const lr = layers()[0].getBoundingClientRect();
    const br = wc.getBoundingClientRect();
    if (lr.width > 0 && lr.height > 0) {
      S.weather.air.setMask(S.scene.mask, S.scene.w, S.scene.h, { x: lr.left - br.left, y: lr.top - br.top, w: lr.width, h: lr.height }, S.scene.eaves ? { a: S.scene.eaves.a, b: S.scene.eaves.b } : undefined);
    }
  }
  S.weather.air.setState(cond.weather, 0.05);
  if (S.screen === "air") S.weather.air.start();
}

/** The heading, the page's colours and the report follow the choice; the caption follows the picture. */
function label() {
  const p = S.cat.byId.get(S.finish);
  const c = conditionById(S.condition);
  $("#air-name").textContent = p.name;
  $("#air-colour").textContent = p.colourName + " · " + c.name;
  caption();
  wearRoof(p);
  const meta = $("#theme-color");
  if (meta) meta.setAttribute("content", p.hex[0]);
  report(p);
}

/** The lower third says what the stage is showing right now. */
function caption() {
  if (!S.photo || !S.cat) return;
  const cap = $("#air-caption");
  const b = document.createElement("b");
  let bits;
  if (S.held) {
    const c = conditionById(S.before.condition || "noon");
    b.textContent = "Before";
    bits = ["The roof as it is", c.id === "noon" ? "" : c.name];
  } else if (S.shown.finish) {
    const p = S.cat.byId.get(S.shown.finish);
    const c = conditionById(S.shown.condition);
    b.textContent = "After";
    bits = [p.name, c.id === "noon" ? "" : c.name, "Approximate preview"];
  } else {
    b.textContent = "Before";
    bits = ["The roof as it is", "The new roof is being drawn"];
  }
  bits.push(S.photo.credit);
  cap.replaceChildren(b, document.createTextNode(" · " + bits.filter(Boolean).join(" · ")));
}

/** The picture that's showing is the one screen readers are told about. */
function stageLabel() {
  const front = currentLayer();
  const back = layers()[S.front === 0 ? 1 : 0];
  let text = whose(false) + " as it is, while the new roofs are drawn";
  if (S.shown.finish) {
    const p = S.cat.byId.get(S.shown.finish);
    const c = conditionById(S.shown.condition);
    text = whose(false) + " with a " + p.name.toLowerCase() + " roof in " + p.colourName.toLowerCase() + (c.id === "noon" ? "" : ", in " + c.name.toLowerCase()) + " (approximate preview)";
  }
  front.setAttribute("role", "img");
  front.setAttribute("aria-label", text);
  front.removeAttribute("aria-hidden");
  back.removeAttribute("role");
  back.removeAttribute("aria-label");
  back.setAttribute("aria-hidden", "true");
}

function report(p) {
  $("#report-summary").textContent = p.summary;
  const facts = [
    ["Format", p.format],
    ["Finish", p.finish],
    ["Ridge", p.ridge],
    ["Suits", p.suits],
    ["Lifespan", p.lifespan],
    ["Comparable to", (p.comparable || []).join(", ")],
  ];
  const fill = (dl, rows) => {
    const frag = document.createDocumentFragment();
    for (const [k, v] of rows) {
      if (!v) continue;
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      frag.append(dt, dd);
    }
    dl.replaceChildren(frag);
  };
  fill($("#report-facts"), facts);
  const sc = S.scene;
  const lr = S.lastRender;
  fill($("#report-engine"), [
    ["Picture", S.photo.w + " × " + S.photo.h + " px"],
    ["Roof", sc ? (sc.frac * 100).toFixed(1) + "% of the picture" : ""],
    ["Eaves", sc && sc.eaves ? ((sc.eaves.angle * 180) / Math.PI).toFixed(1) + "° from level" : ""],
    ["Courses", p.pattern && p.pattern.courses ? p.pattern.courses + " up the slope" : ""],
    ["Drawn in", lr && lr.finish === p.id ? lr.ms + " ms" : "…"],
    ["Where", S.engine.mode === "worker" ? "A background thread on this device" : "This page, on this device"],
  ]);
}

/** Draw the chosen roof under the chosen weather on the stage (cross-fading). */
async function showRoof() {
  if (!S.scene) return; // goAir draws it as soon as the house is ready
  const mine = S.air;
  const finish = S.finish;
  const condition = S.condition;
  const stage = $("#air-stage");
  if (S.shown.finish === finish && S.shown.condition === condition) {
    stage.classList.remove("is-busy");
    return;
  }
  const product = S.cat.byId.get(finish);
  stage.classList.add("is-busy");
  const r = await S.engine.render("full", product, condition, { first: true });
  if (mine !== S.air || finish !== S.finish || condition !== S.condition) return;
  const [a, b] = layers();
  const back = S.front === 0 ? b : a;
  const front = S.front === 0 ? a : b;
  putImage(back, r.image);
  back.classList.add("is-on");
  front.classList.remove("is-on");
  S.front = S.front === 0 ? 1 : 0;
  S.shown = { finish, condition };
  S.lastRender = { ms: r.ms, finish, condition };
  stage.classList.remove("is-busy");
  stageLabel();
  caption();
  report(product);
  torch();
  if (S.held || S.before.wanted) prepareBefore();
  scheduleCard();
}

async function drawThumbs(mine) {
  const st = maskStats(S.quick.mask, S.quick.w, S.quick.h);
  const pad = 0.3;
  const bw = st.maxX - st.minX + 1;
  const bh = st.maxY - st.minY + 1;
  const crop = {
    x: Math.max(0, st.minX - bw * pad),
    y: Math.max(0, st.minY - bh * pad),
    w: Math.min(S.quick.w, bw * (1 + 2 * pad)),
    h: Math.min(S.quick.h, bh * (1 + 2 * pad)),
  };
  crop.w = Math.min(crop.w, S.quick.w - crop.x);
  crop.h = Math.min(crop.h, S.quick.h - crop.y);
  const order = [S.finish].concat(S.cat.visuals.map((v) => v.id).filter((id) => id !== S.finish));
  const total = order.length;
  order.forEach((id) => S.stations.setBusy(id, true));
  let failed = 0;
  let lastErr = null;
  for (const id of order) {
    try {
      const r = await S.engine.render("quick", S.cat.byId.get(id), "noon");
      if (mine !== S.air) return;
      S.stations.setThumb(id, r.image, crop);
      S.thumbsDrawn.add(id);
      const n = S.thumbsDrawn.size;
      gauge(n / total, n + " of " + total + " roofs drawn");
      $("#air-progress").textContent = n < total ? "· " + n + " of " + total + " drawn" : "· all " + total + " on your roof";
    } catch (err) {
      if (isStale(err) || mine !== S.air) return;
      failed++;
      lastErr = err;
      S.stations.setBusy(id, false); // it keeps its plain swatch
    }
  }
  if (!failed) {
    announce("All eight roofs drawn. Choose one, then choose the weather.");
    return;
  }
  const n = S.thumbsDrawn.size;
  gauge(n / total, n + " of " + total + " roofs drawn");
  $("#air-progress").textContent = "· " + n + " of " + total + " drawn";
  if (!n) {
    renderFailed(lastErr); // none at all: the drawing thread has probably stopped
    return;
  }
  announce(failed + " of the small pictures couldn't be drawn. Those roofs keep their plain swatch, and you can still choose them.");
}

function pickFinish(id) {
  // The radio group itself tells screen readers which roof is chosen.
  S.finish = id;
  label();
  writeUrl();
  showRoof().catch(renderFailed);
}

function pickCondition(id) {
  S.condition = id;
  label();
  placeAirWeather();
  showRoof().catch(renderFailed);
  torch();
  if (S.held) prepareBefore();
}

// ---- hold to see the old roof

let beforeJob = null; // { key, promise }: the "before" being drawn now

/** Keep a "before" picture on #air-before (it's also the share card's BEFORE). */
function takeBefore(cond, image) {
  putImage($("#air-before"), image);
  S.before = { condition: cond, ready: true, wanted: S.before.wanted };
  if (S.held) {
    caption();
    torch();
  }
}

/** The untouched house under one mood, from the engine (asked once, however many want it). */
function fetchBefore(cond) {
  const key = S.air + "|" + cond;
  if (beforeJob && beforeJob.key === key) return beforeJob.promise;
  const mine = S.air;
  const promise = S.engine.before("full", cond, { first: true }).then((r) => {
    if (mine === S.air && cond === S.condition && !(S.before.ready && S.before.condition === cond)) takeBefore(cond, r.image);
    return r;
  });
  const job = { key, promise };
  beforeJob = job;
  const done = () => {
    if (beforeJob === job) beforeJob = null;
  };
  promise.then(done, done);
  return promise;
}

/** Make sure #air-before holds the house under the chosen weather. */
async function prepareBefore() {
  const cond = S.condition;
  if (S.before.ready && S.before.condition === cond) return true;
  if (cond === "noon" && S.photo) {
    // As shot changes nothing: the "before" is the photo itself, straight away.
    const bc = $("#air-before");
    if (bc.width !== S.photo.w) bc.width = S.photo.w;
    if (bc.height !== S.photo.h) bc.height = S.photo.h;
    bc.getContext("2d").drawImage(S.photo.canvas, 0, 0);
    S.before = { condition: "noon", ready: true, wanted: S.before.wanted };
    if (S.held) {
      caption();
      torch();
    }
    return true;
  }
  if (!S.scene) return false;
  try {
    await fetchBefore(cond);
    return S.before.ready && S.before.condition === cond;
  } catch (err) {
    return false; // the next hold tries again
  }
}

function setHeld(on) {
  S.held = !!on;
  const b = $("#air-hold");
  if (!S.held) b.dataset.sticky = "";
  $("#air-before").classList.toggle("is-held", S.held);
  $("#air-stage").classList.toggle("is-before", S.held);
  // The button always reads "Show the old roof": pressed means the old roof is showing.
  b.setAttribute("aria-pressed", S.held ? "true" : "false");
  caption();
  if (S.held) {
    S.before.wanted = true;
    prepareBefore();
  }
  torch();
}

function wireHold() {
  const stage = $("#air-stage");
  let down = null;
  let timer = 0;
  stage.addEventListener("contextmenu", (e) => e.preventDefault());
  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button > 0) return;
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    moveTorch(e); // a tap moves the torch too
    S.before.wanted = true;
    prepareBefore();
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (down) setHeld(true);
    }, 140);
  });
  stage.addEventListener("pointermove", (e) => {
    if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10 && !S.held) {
      clearTimeout(timer);
      down = null;
    }
    moveTorch(e);
  });
  const up = () => {
    clearTimeout(timer);
    down = null;
    if (S.held && $("#air-hold").dataset.sticky !== "1") setHeld(false);
  };
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", up);
  stage.addEventListener("pointerleave", (e) => {
    up();
    if (e.pointerType === "mouse") torchPoint = null;
  });
  $("#air-hold").addEventListener("click", () => {
    const on = !S.held;
    setHeld(on);
    $("#air-hold").dataset.sticky = on ? "1" : "";
  });
}

// ---- torch: at dusk, a warm light follows your finger and looks closer

let torchPoint = null; // [x, y, time]: x and y from 0 to 1 across the picture
let torchRaf = 0;
let torchLive = null; // { t0, drawn, dirty, d } while the torch is on

function moveTorch(e) {
  if (!torchLive) return;
  const r = $("#air-torch").getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return;
  const fx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  const fy = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
  torchPoint = [fx, fy, performance.now()];
  // Calm: no loop, so draw this one frame now. Otherwise the loop draws it.
  if (isCalm()) drawTorch(performance.now());
  else torchLive.dirty = true;
}

function torch() {
  const c = $("#air-torch");
  cancelAnimationFrame(torchRaf);
  torchRaf = 0;
  const on = S.condition === "dusk" && S.screen === "air" && !!S.scene && !!S.photo;
  c.hidden = !on;
  $("#air-stage").classList.toggle("is-dusk", on);
  if (!on) {
    torchLive = null;
    if (c.width) release(c);
    return;
  }
  // The beam is drawn at the size the picture is on screen, not at the photo's size.
  const d = Math.min(2, window.devicePixelRatio || 1);
  const bw = Math.max(1, Math.round((c.clientWidth || 0) * d));
  const bh = Math.max(1, Math.round((c.clientHeight || 0) * d));
  if (c.width !== bw) c.width = bw;
  if (c.height !== bh) c.height = bh;
  torchLive = { t0: performance.now(), drawn: -Infinity, dirty: true, d };
  drawTorch(performance.now());
  if (!isCalm()) torchRaf = requestAnimationFrame(sweep);
}

function drawTorch(t) {
  const c = $("#air-torch");
  if (!torchLive || !S.scene || !c.width || !c.height) return;
  const st = S.scene.stats;
  let fx;
  let fy;
  if (torchPoint && t - torchPoint[2] < 2500) {
    fx = torchPoint[0];
    fy = torchPoint[1];
  } else if (isCalm() || st.empty) {
    fx = st.empty ? 0.5 : st.cx / S.scene.w;
    fy = st.empty ? 0.5 : st.cy / S.scene.h;
  } else {
    // Idle: the beam sweeps slowly across the roof.
    const u = 0.5 + 0.5 * Math.sin((t - torchLive.t0) / 1800);
    fx = (st.minX + (st.maxX - st.minX) * (0.15 + 0.7 * u)) / S.scene.w;
    fy = (st.minY + (st.maxY - st.minY) * 0.55) / S.scene.h;
  }
  // While the old roof is held, the beam looks at the old roof too.
  const src = S.held ? $("#air-before") : currentLayer();
  const cw = c.width;
  const ch = c.height;
  const ctx = c.getContext("2d");
  const R = Math.min(cw, ch) * 0.2;
  const x = fx * cw;
  const y = fy * ch;
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = "rgba(5, 8, 15, 0.38)";
  ctx.fillRect(0, 0, cw, ch);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.clearRect(0, 0, cw, ch);
  if (src.width && src.height) {
    const z = 1.6;
    const rx = (R / z) * (src.width / cw);
    const ry = (R / z) * (src.height / ch);
    ctx.drawImage(src, fx * src.width - rx, fy * src.height - ry, 2 * rx, 2 * ry, x - R, y - R, 2 * R, 2 * R);
  }
  const g = ctx.createRadialGradient(x, y, R * 0.2, x, y, R);
  g.addColorStop(0, "rgba(233, 196, 98, 0.22)");
  g.addColorStop(1, "rgba(233, 196, 98, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
  ctx.restore();
  ctx.strokeStyle = "rgba(245, 240, 232, 0.8)";
  ctx.lineWidth = 1.5 * torchLive.d;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.stroke();
  torchLive.drawn = t;
  torchLive.dirty = false;
}

function sweep(t) {
  torchRaf = 0;
  if (!torchLive || S.condition !== "dusk" || S.screen !== "air" || isCalm()) return;
  const following = torchPoint && t - torchPoint[2] < 2500;
  // Following a finger: redraw when it moves. Idle: the sweep steps on at about 20 frames a second.
  if (following ? torchLive.dirty : t - torchLive.drawn >= 50) drawTorch(t);
  torchRaf = requestAnimationFrame(sweep);
}

// ---- share and save

let cardTimer = 0;
function scheduleCard() {
  clearTimeout(cardTimer);
  cardTimer = setTimeout(() => {
    if (stageCurrent()) buildCard().catch(() => undefined);
  }, 700);
}

/** The card is keyed on what the stage shows, never on a choice still being drawn. */
function cardKey() {
  return S.air + "|" + S.shown.finish + "|" + S.shown.condition;
}

/**
 * The share card for what the stage shows now. The pictures are copied before
 * anything is awaited, so a roof that lands meanwhile can't get into it.
 * @returns {Promise<{key:string, finish:string, file:File, blob:Blob}|null>}
 */
function buildCard() {
  if (!S.photo || !S.cat || !S.shown.finish) return Promise.resolve(null);
  const key = cardKey();
  if (S.card.key === key && S.card.file) return Promise.resolve(S.card);
  if (S.card.key === key && S.card.building) return S.card.building;
  const photo = S.photo;
  const finish = S.shown.finish;
  const p = S.cat.byId.get(finish);
  const c = conditionById(S.shown.condition);
  const st = S.scene ? S.scene.stats : null;
  const after = snapshot(currentLayer());
  // BEFORE is the house under the same weather as AFTER (As shot is the photo itself).
  let before = null;
  let ownBefore = false;
  let wait = null;
  if (c.id === "noon") before = photo.canvas;
  else if (S.before.ready && S.before.condition === c.id) {
    before = snapshot($("#air-before"));
    ownBefore = true;
  } else wait = fetchBefore(c.id);
  const job = (async () => {
    try {
      if (wait) {
        const b = await wait;
        before = document.createElement("canvas");
        putImage(before, b.image);
        ownBefore = true;
      }
      const r = await buildShareCard({
        before,
        after,
        width: photo.w,
        height: photo.h,
        finishName: p.name,
        colourName: p.colourName,
        conditionName: c.name,
        credit: photo.credit || undefined,
        focus: st && !st.empty ? { x: st.cx, y: st.cy } : undefined,
      });
      release(r.canvas); // the JPEG is made: the card's canvas can go
      return { key, finish, file: r.file, blob: r.blob };
    } finally {
      release(after);
      if (ownBefore) release(before);
    }
  })();
  S.card = { key, file: null, blob: null, building: job };
  job.then(
    (card) => {
      if (S.card.key === key) S.card = { key, finish: card.finish, file: card.file, blob: card.blob, building: null };
    },
    () => {
      // A card that failed isn't kept: the next Share tries again.
      if (S.card.key === key) S.card = emptyCard();
    }
  );
  return job;
}

function wireShare() {
  const shareBtn = $("#air-share");
  const saveBtn = $("#air-save");
  let sharing = false;
  let saving = false;
  const stillDrawing = () => setStatus("#air-status", "The new roof is still being drawn. Try again in a moment.");
  const changed = () => setStatus("#air-status", "The roof changed while the card was being made. Press Share card again for the new one.");
  const saveCard = (card, done) => {
    const ok = downloadBlob(card.blob, "wv-roof-cam-" + card.finish + "-card.jpg");
    setStatus("#air-status", ok ? done : "The card couldn't be saved on this device.");
  };

  shareBtn.addEventListener("click", async () => {
    if (sharing) return;
    if (!S.photo || !S.cat || !stageCurrent()) {
      stillDrawing();
      return;
    }
    const p = S.cat.byId.get(S.shown.finish);
    const own = !S.photo.sample;
    const data = {
      title: own ? "My roof, in the weather" : "A sample house, in the weather",
      text: p.name + " on " + (own ? "my house" : "a sample house") + ". An approximate preview from the WV Roofing Roof Cam (a concept).",
    };
    const key = cardKey();
    const ready = S.card.key === key && S.card.file ? S.card : null;
    sharing = true;
    shareBtn.setAttribute("aria-busy", "true");
    try {
      if (ready && canShareFile(ready.file)) {
        // Nothing is awaited before this, so the tap still counts as the visitor's own.
        const res = await shareFile(ready.file, data);
        if (res === "shared") setStatus("#air-status", "Shared.");
        else if (res === "cancelled") setStatus("#air-status", "");
        else saveCard(ready, "Sharing isn't available here, so the card was saved instead.");
        return;
      }
      let card = ready;
      if (!card) {
        setStatus("#air-status", "Preparing the card");
        card = await buildCard();
        if (!card || !card.file || card.key !== cardKey() || !stageCurrent()) {
          changed();
          return;
        }
        if (canShareFile(card.file)) {
          const res = await shareFile(card.file, data);
          if (res === "shared" || res === "cancelled") {
            setStatus("#air-status", res === "shared" ? "Shared." : "");
            return;
          }
        }
      }
      saveCard(card, "Card saved to your downloads.");
    } catch (err) {
      if (isStale(err)) changed();
      else setStatus("#air-status", "The card couldn't be made just now. Please try again.");
    } finally {
      sharing = false;
      shareBtn.removeAttribute("aria-busy");
    }
  });

  saveBtn.addEventListener("click", async () => {
    if (saving || !S.photo || !S.cat) return;
    const beforeReady = S.before.ready && S.before.condition === S.condition;
    if (S.held ? !beforeReady : !stageCurrent()) {
      stillDrawing();
      return;
    }
    const c = conditionById(S.condition);
    const mood = c.id === "noon" ? "" : " · " + c.name;
    const label = S.held ? "Before · the roof as it is" + mood : "Approximate concept preview · " + S.cat.byId.get(S.shown.finish).name + mood;
    const name = "wv-roof-cam-" + (S.held ? "before" : S.shown.finish) + ".jpg";
    // watermarked() copies the picture now: nothing drawn later can get into the file.
    const pic = watermarked(S.held ? $("#air-before") : currentLayer(), label, S.photo.credit || undefined);
    saving = true;
    saveBtn.setAttribute("aria-busy", "true");
    try {
      const ok = await downloadCanvas(pic, name);
      setStatus("#air-status", ok === false ? "The image couldn't be saved on this device." : "Image saved to your downloads.");
    } catch (err) {
      setStatus("#air-status", "The image couldn't be saved on this device.");
    } finally {
      saving = false;
      saveBtn.removeAttribute("aria-busy");
      release(pic);
    }
  });
}

// ---- send it to the roofer: the visitor's details, the roof they chose and (for their own photo) the photo and a preview

function openAsk() {
  if (!S.photo || !S.cat) return;
  const dlg = $("#ask");
  const own = !S.photo.sample;
  const id = S.shown.finish || S.finish;
  const p = S.cat.byId.get(id);
  $("#ask-what").textContent = (p ? p.name + ", " + p.colourName.toLowerCase() : "Your new roof") + " · on " + whose(true);
  // The photo can only go with the enquiry if it's saved (or still being saved).
  const st = store.status().state;
  const canInclude = own && (st === "saving" || st === "saved");
  $("#ask-images-row").hidden = !canInclude;
  $("#ask-nophoto").hidden = !own || canInclude;
  $("#ask-form").hidden = false;
  $("#ask-done").hidden = true;
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "");
  const first = $("#ask-name");
  if (first) first.focus();
}

function closeAsk() {
  const dlg = $("#ask");
  if (typeof dlg.close === "function" && dlg.open) dlg.close();
  else dlg.removeAttribute("open");
}

/** The preview the roofer is sent: what the stage shows now, labelled as a concept. */
function previewForRoofer() {
  if (!S.photo || !S.cat || !S.shown.finish) return null;
  const c = conditionById(S.shown.condition);
  const label = "Approximate concept preview · " + S.cat.byId.get(S.shown.finish).name + (c.id === "noon" ? "" : " · " + c.name);
  return { canvas: watermarked(currentLayer(), label, S.photo.credit || undefined), finish: S.shown.finish, condition: S.shown.condition };
}

function wireAsk() {
  const dlg = $("#ask");
  const form = $("#ask-form");
  $("#air-ask").addEventListener("click", openAsk);
  $("#ask-close").addEventListener("click", closeAsk);
  $("#ask-done-close").addEventListener("click", closeAsk);
  // A tap on the dimmed page outside the form closes it, like the close button.
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) closeAsk();
  });
  // Whether the photo was meant to go with the enquiry, and whether it did.
  let sent = { wanted: false, withPhoto: false };
  wireEnquiryForm(form, {
    getContext: () => {
      const own = !!(S.photo && !S.photo.sample);
      return {
        source: own ? "roof-cam" : "roof-cam-sample",
        product: S.shown.finish || S.finish || "",
        includeImages: own && !$("#ask-images-row").hidden ? $("#ask-images").checked : undefined,
      };
    },
    send: async (payload) => {
      const own = !!(S.photo && !S.photo.sample);
      sent = { wanted: own && payload.includeImages === true, withPhoto: false };
      // Copied now, before anything is awaited: a roof chosen meanwhile can't get into it.
      const shot = sent.wanted ? previewForRoofer() : null;
      try {
        if (own) {
          // A photo still uploading is waited for (a little), so the enquiry can carry it.
          await store.whenSettled(25000);
          if (shot && store.photoSaved()) {
            try {
              await store.sendPreview(shot.canvas, shot.finish, shot.condition);
            } catch (err) {
              /* the enquiry still goes, with the photo */
            }
          }
        }
        const r = await store.sendEnquiry(payload);
        sent.withPhoto = !!r.withPhoto;
        return r;
      } finally {
        if (shot) release(shot.canvas);
      }
    },
    onSent: () => {
      // Said plainly when the photo they asked to include couldn't go with it.
      const without = sent.wanted && !sent.withPhoto ? " Your photo couldn't go with it, because it isn't saved; the roof you chose is in your enquiry." : "";
      const msg = form.querySelector(".form-status").textContent + without;
      $("#ask-done-text").textContent = msg;
      form.hidden = true;
      $("#ask-done").hidden = false;
      $("#ask-done-text").focus();
      setStatus("#air-status", msg);
    },
  });
}

function restart() {
  S.photo = null;
  S.scene = null;
  S.quick = null;
  S.airPhoto = null;
  S.taps = [];
  S.drawn = null;
  S.shapes = [];
  S.air++;
  S.loadTicket++; // a photo still opening is no longer wanted
  S.loading = false;
  $$(".file-btn").forEach((l) => l.classList.remove("is-busy"));
  setStatus("#photo-status", "");
  // The photo stays saved (it can be deleted from the next one's light, or by asking); the light goes.
  store.clearSave();
  S.shown = { finish: "", condition: "" };
  S.card = emptyCard();
  clearTimeout(cardTimer);
  setHeld(false);
  setStatus("#air-status", "");
  S.engine.drop("full");
  S.engine.drop("quick");
  // Let the stage's full-size pictures go.
  [...layers(), $("#air-before")].forEach(release);
  holdGauge(true);
  show("onair");
}

function wireAir() {
  wireHold();
  wireShare();
  S.deck = buildDeck($("#air-deck"), { selected: S.condition, onSelect: pickCondition });
  $("#air-edit").addEventListener("click", () => {
    if (!S.photo) return;
    if (S.taps.length) {
      setupFind();
      show("find");
    } else openEditor(true);
  });
  $("#air-restart").addEventListener("click", restart);
  // The stage changes size with the layout, not only with the window: keep the
  // rain on the roof and the torch the size of the picture.
  const resized = () => {
    if (S.screen !== "air") return;
    if (S.weather.air) placeAirWeather();
    if (torchLive) torch();
  };
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resized).observe($("#air-stage"));
  else window.addEventListener("resize", resized);
}

// ---------------------------------------------------------------------------
// ?selftest=1: how well does one tap find each sample's hand-marked roof?

async function selftest() {
  const out = $("#selftest");
  out.hidden = false;
  out.textContent = "Self-test: one tap on each sample house, against its hand-marked roof\n\n";
  const rows = [];
  for (const s of S.samples) {
    const img = await loadImage(s.url);
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, c.width, c.height);
    const truth = buildMask(s.shapes, c.width, c.height, c.width / s.w, c.height / s.h);
    // The tap: the point deepest inside the marked roof.
    let m = truth;
    let last = maskStats(m, c.width, c.height);
    for (let i = 0; i < 40; i++) {
      const next = erode(m, c.width, c.height, 6);
      const st = maskStats(next, c.width, c.height);
      if (st.empty) break;
      m = next;
      last = st;
    }
    const seed = [Math.round(last.cx), Math.round(last.cy)];
    await tick();
    const t0 = performance.now();
    const r = suggestRoof(px, seed);
    const ms = Math.round(performance.now() - t0);
    rows.push([s.id.padEnd(16), iou(r.mask, truth).toFixed(3), (r.frac * 100).toFixed(1) + "%", r.confidence.toFixed(2), String(ms) + " ms", r.reason || "-"]);
    out.textContent += rows[rows.length - 1].join("  ") + "\n";
  }
  out.textContent += "\n(IoU against the whole hand-marked roof; one tap finds one slope, so multi-slope roofs score lower.)";
}

// ---------------------------------------------------------------------------
// boot

async function boot() {
  if (/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) window.__wvr2 = S; // test hook (local only)
  history.replaceState({ screen: "onair" }, "", window.location.href);
  holdGauge(true);
  gauge(0, "Waiting for a photo");
  store.onSave(saveLight);
  S.engine = new Engine();
  // Fetch the typefaces this page uses now, so none arrives after a photo does.
  if (document.fonts && document.fonts.load) {
    ['500 14px "IBM Plex Mono"', '600 14px "IBM Plex Mono"', '400 14px "IBM Plex Mono"', '700 26px "Big Shoulders Display"', '900 60px "Big Shoulders Display"', '400 17px "Archivo"', '700 17px "Archivo"'].forEach((f) =>
      document.fonts.load(f).catch(() => undefined)
    );
  }
  setPhotoInputs(false);
  wireOnAir();
  wireFind();
  wireDraw();
  wireAir();
  wireAsk();
  wireStick();
  onCalmChange(() => {
    kickOverlay();
    torch();
  });
  readyCatalogue();
  const quick = Promise.race([probeQuality(), new Promise((res) => setTimeout(() => res("mid"), 350))]);
  const [samples, quality] = await Promise.all([loadSamples().catch(() => []), quick]);
  S.samples = samples;
  S.quality = quality;

  if (!isCalm()) {
    S.weather.onair = new Weather($("#onair-weather"), { quality, lightning: false });
    S.weather.onair.snap({ rain: 0.35, cloud: 0.5, storm: 0, warm: 0 });
    if (S.screen === "onair") S.weather.onair.start();
  }
  onCalmChange((calm) => {
    if (!calm && !S.weather.onair) {
      S.weather.onair = new Weather($("#onair-weather"), { quality, lightning: false });
      S.weather.onair.snap({ rain: 0.35, cloud: 0.5, storm: 0, warm: 0 });
      if (S.screen === "onair") S.weather.onair.start();
    }
    if (!calm && S.screen === "air") placeAirWeather();
  });

  // The sample houses can only go on air once the roofs are here.
  await catalogueReady;
  renderSamples();
  const p = params();
  const want = p.get("sample");
  const sample = want && samples.find((s) => s.id === want);
  if (sample && !S.photo) openSample(sample);
  if (p.get("selftest") === "1") selftest().catch((err) => console.error(err));
}

boot().catch((err) => {
  console.error(err);
  setStatus("#photo-error", "The Roof Cam couldn't start. Please refresh the page.");
});
