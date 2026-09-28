// WV Roofing Roof Visualiser — page controller.
//
// Six steps (journey.js; each is a History API entry, so Back walks through them):
//   1 your home (property.js: postcode, address, satellite view; or "photo only")
//   2 photo (upload / camera / sample)  ->  3 mark the roof (MaskEditor)
//   4 compare: eight instant quick previews, then photo-real AI renders
//     (optional, with consent) composited so only the roof changes
//   5 estimate (honest: no licensed measurement data yet)  ->  6 send the enquiry
// The project id rides in the URL (?project=) and its key in sessionStorage, so
// a refresh resumes where the customer was: address, photo, outline, previews,
// renders and any enquiry are rebuilt from the server.
// An uploaded photo goes to the customer's project on the server (client.js):
// it is checked, stripped of metadata and prepared there, and the editor works
// on the server's prepared copy so the saved roof outline lines up exactly.
// Photo-real renders are durable jobs on the server: the chosen finish renders
// automatically once the customer agrees, the others when tapped, and the page
// polls until they're done. The server composites them, so what comes back is
// the customer's own photo with only the roof changed. Sample houses show
// pre-rendered results only; they never call the AI service.
import { loadCatalogue } from "../catalogue.js";
import { ROOT, IS_LOCAL } from "../config.js";
import { initJourney, show, stepFromUrl, setParam, currentStep } from "./journey.js";
import { initProperty, restoreProperty, propertyShown, propertyState, resetProperty } from "./property.js";
import { loadSample, photoWarnings, blobToCanvas } from "./photo.js";
import { MaskEditor } from "./mask-editor.js";
import { analyseRoof, renderPreview } from "./preview.js";
import { compositeRender, decodeRenderToPhotoGrid } from "./composite.js";
import { getHealth } from "./api.js";
import {
  ensureProject,
  uploadPhoto,
  fetchDisplay,
  saveOutline,
  deleteProject,
  setConsent,
  currentProject,
  forgetProject,
  getProject,
  sniffFile,
  submitRenders,
  listRenders,
  fetchRenderImage,
  cancelRender,
  newKey,
  sendProjectEnquiry,
  ClientError,
  MAX_BYTES,
} from "./client.js";
import { Lightbox } from "./lightbox.js";
import { watermarked, downloadCanvas } from "./watermark.js";
import { wireEnquiryForm, fillProductSelect, sendEnquiry, savedMessage } from "../enquiry.js";

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
// Yield to the browser between heavy steps (setTimeout, not rAF: rAF pauses in background tabs).
const nextFrame = () => new Promise((res) => setTimeout(res, 16));

const S = {
  cat: null,
  samples: [],
  health: null,
  photo: null,
  sample: null,
  editor: null,
  gen: 0,
  shapesKey: "",
  mask: null,
  orig: null,
  analysis: null,
  beforeUrl: "",
  previews: new Map(),
  ai: new Map(),
  cards: new Map(),
  jobs: new Map(), // finish id -> latest render job from the server
  loading: new Set(), // job ids whose image is being fetched
  runningSince: new Map(), // job id -> when this page first saw it running
  attempts: new Map(), // finish id -> requests made for it in this compare session
  renderKey: "",
  pollTimer: 0,
  priority: null,
  chosen: null, // the finish the customer picked last (lightbox, "Get a quote for this roof")
  enquiry: null, // { reference } once an enquiry about this project is saved
  aiRequested: false,
  timer: 0,
  urls: [],
  caps: {},
  photoWarns: [],
  outlineKey: "",
  outlineChain: null,
  uploading: false,
};

// ---------------------------------------------------------------------------
// small helpers

function announce(msg) {
  const live = $("#vis-live");
  if (!live) return;
  live.textContent = "";
  setTimeout(() => {
    live.textContent = msg;
  }, 30);
}

const shared = document.createElement("canvas");
function pixelsToUrl(px, w, h, type, quality) {
  shared.width = w;
  shared.height = h;
  const ctx = shared.getContext("2d");
  ctx.putImageData(new ImageData(px, w, h), 0, 0);
  return new Promise((resolve) => {
    shared.toBlob(
      (blob) => {
        const url = URL.createObjectURL(blob);
        S.urls.push(url);
        resolve(url);
      },
      type || "image/jpeg",
      quality || 0.92
    );
  });
}

function canvasToUrl(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        const url = URL.createObjectURL(blob);
        S.urls.push(url);
        resolve(url);
      },
      "image/jpeg",
      0.92
    );
  });
}

function releaseUrls() {
  for (const u of S.urls) URL.revokeObjectURL(u);
  S.urls = [];
}

function showError(msg) {
  const el = $("#photo-error");
  el.textContent = msg;
  el.hidden = !msg;
}

function showStatus(msg) {
  const el = $("#photo-status");
  if (!el) return;
  el.textContent = msg;
  el.hidden = !msg;
}

function storageReady() {
  const c = S.caps && S.caps.enquiry_storage;
  return !!c && c.state === "enabled";
}

function showStep(step, focus) {
  show(step, { focus });
}

/** Which steps make sense right now (Back, deep links and the summary's "Change" use this). */
function canShow(step) {
  if (step === "mark") return !!(S.photo && S.editor);
  if (step === "compare") return S.cards.size > 0;
  return true;
}

/** The customer's project, created on first use; its id goes in the URL so a refresh resumes it. */
async function projectReady(opts) {
  const p = await ensureProject(opts);
  setParam("project", p.id);
  return p;
}

// ---------------------------------------------------------------------------
// the summary of choices so far

function updateSummary() {
  const sheet = $("#summary-sheet");
  const { address } = propertyState();
  $("#sum-home").textContent = address ? address.label : currentProject() || S.photo ? "Photo only" : "Not added";
  $("#sum-photo").textContent = S.photo ? (S.sample ? "Sample: " + S.sample.title : "Your photo") : "Not added";
  const chosen = S.cat && (S.chosen || firstChoice());
  const p = chosen && S.cat.byId.get(chosen);
  $("#sum-roof").textContent = p ? p.name + ", " + p.colourName : "Not chosen yet";
  $("#btn-delete-project").hidden = !currentProject();
  const step = currentStep();
  sheet.hidden = !(["compare", "estimate", "enquiry"].includes(step) && (address || S.photo));
}

// ---------------------------------------------------------------------------
// step 1: photo

async function loadSamples() {
  try {
    const r = await fetch(ROOT + "samples/samples.json", { cache: "no-cache" });
    const j = await r.json();
    return Array.isArray(j.samples) ? j.samples : [];
  } catch (err) {
    return [];
  }
}

function renderSampleGrid() {
  const grid = $("#sample-grid");
  if (!S.samples.length) {
    grid.innerHTML = "";
    return;
  }
  const frag = document.createDocumentFragment();
  for (const s of S.samples) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sample-card";
    b.setAttribute("aria-label", "Use the sample house: " + s.title);
    const img = document.createElement("img");
    img.src = ROOT + "samples/" + s.src;
    img.alt = "";
    img.loading = "lazy";
    img.width = 400;
    img.height = 300;
    const t = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = s.title;
    const small = document.createElement("small");
    small.textContent = s.credit + " · roof already marked";
    t.append(strong, small);
    b.append(img, t);
    b.addEventListener("click", () => selectSample(s));
    frag.appendChild(b);
  }
  grid.replaceChildren(frag);
}

async function handleFile(file) {
  showError("");
  showStatus("");
  if (!file || S.uploading) return;
  const kind = await sniffFile(file).catch(() => "other");
  if (kind === "heic") {
    showError('This photo is in the iPhone HEIC format. Choose it again from your photo library (your phone converts it to JPEG), or set the camera to "Most Compatible".');
    return;
  }
  if (kind !== "jpeg" && kind !== "png") {
    showError("Please choose a JPG or PNG photo.");
    return;
  }
  if (file.size > MAX_BYTES) {
    showError("That photo is over 20 MB. Please choose a smaller copy.");
    return;
  }
  if (!storageReady()) {
    showError("Uploading your own photo isn't available right now. You can still try a sample house below.");
    return;
  }
  S.uploading = true;
  $("#dropzone").classList.add("is-busy");
  try {
    showStatus("Uploading your photo…");
    announce("Uploading your photo.");
    const opts = { consentAi: $("#consent-ai").checked };
    const progress = (f) => showStatus("Uploading your photo… " + Math.round(f * 100) + "%");
    await projectReady(opts);
    let photo;
    try {
      photo = await uploadPhoto(file, kind, progress);
    } catch (err) {
      // The project this tab remembered has gone: start a new one and try once more.
      if (!(err instanceof ClientError) || err.code !== "project_not_found") throw err;
      resetProperty();
      await projectReady(opts);
      photo = await uploadPhoto(file, kind, progress);
    }
    showStatus("Preparing your photo…");
    const canvas = await blobToCanvas(await fetchDisplay());
    if (canvas.width !== photo.w || canvas.height !== photo.h) throw new ClientError(0, "size_mismatch", "Your photo couldn't be prepared. Please try again.");
    showStatus("");
    startMarking({ canvas, w: photo.w, h: photo.h, name: file.name || "photo", originalW: photo.origW, originalH: photo.origH, warnings: photo.warnings, uploaded: true }, null);
  } catch (err) {
    showStatus("");
    showError(err instanceof ClientError ? err.message : "Sorry, that photo couldn't be added. Please try a JPG or PNG.");
  } finally {
    S.uploading = false;
    $("#dropzone").classList.remove("is-busy");
  }
}

async function selectSample(sample) {
  showError("");
  try {
    const photo = await loadSample(sample);
    startMarking(photo, sample);
  } catch (err) {
    showError("The sample house couldn't be loaded. Please try again.");
  }
}

function wireUpload() {
  const onPick = (e) => {
    const f = e.target.files && e.target.files[0];
    handleFile(f);
    e.target.value = "";
  };
  $("#file-camera").addEventListener("change", onPick);
  $("#file-library").addEventListener("change", onPick);
  const dz = $("#dropzone");
  ["dragenter", "dragover"].forEach((t) =>
    dz.addEventListener(t, (e) => {
      e.preventDefault();
      dz.classList.add("is-over");
    })
  );
  ["dragleave", "drop"].forEach((t) => dz.addEventListener(t, () => dz.classList.remove("is-over")));
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    handleFile(f);
  });
  window.addEventListener("paste", (e) => {
    if ($('[data-panel="photo"]').hidden) return;
    const item = Array.from((e.clipboardData && e.clipboardData.items) || []).find((i) => i.type.startsWith("image/"));
    if (item) handleFile(item.getAsFile());
  });
}

// ---------------------------------------------------------------------------
// step 2: mark the roof

function resetResults() {
  S.gen++;
  // Renders already asked for carry on on the server; a new outline or photo
  // supersedes them there, so this page just stops listening.
  clearTimeout(S.pollTimer);
  S.aiRequested = false;
  S.previews.clear();
  S.ai.clear();
  S.cards.clear();
  S.jobs.clear();
  S.loading.clear();
  S.runningSince.clear();
  S.attempts.clear();
  S.renderKey = "";
  S.shapesKey = "";
  S.analysis = null;
  S.mask = null;
  clearInterval(S.timer);
  releaseUrls();
  $("#results-grid").replaceChildren();
  $("#render-banner").hidden = true;
}

/**
 * @param {object} photo
 * @param {object | null} sample
 * @param {{ quiet?: boolean }} [opts]  quiet: set up without moving to the step (resuming)
 */
function startMarking(photo, sample, opts) {
  const quiet = !!(opts && opts.quiet);
  resetResults();
  if (S.editor) S.editor.destroy();
  S.photo = photo;
  S.sample = sample;
  S.orig = null;
  S.beforeUrl = "";
  const stage = $("#editor-stage");
  S.editor = new MaskEditor({ root: stage, photo: photo.canvas, onChange: updateMarkUI, announce });
  S.editor.setBrush(Number($("#brush-size").value));
  S.editor.setSnap($("#snap-edges").checked);
  setTool("outline");
  if (sample && sample.shapes) {
    const kx = photo.w / (sample.w || photo.w);
    const ky = photo.h / (sample.h || photo.h);
    S.editor.setShapes(sample.shapes.map((s) => ({ mode: s.mode, pts: s.pts.map((p) => [p[0] * kx, p[1] * ky]), r: s.r ? s.r * kx : undefined })));
    $("#mark-lede").textContent =
      "We've already marked this roof for you. Adjust it if you like, or go straight to your eight roofs.";
  } else {
    $("#mark-lede").textContent =
      "Tap round the edge of each roof slope, then tap the first point again to close the shape. Cut out chimneys and roof windows so they stay as they are.";
  }
  // Photo warnings are worked out once (the server's for uploads, the browser's for samples).
  S.photoWarns = photo.warnings || photoWarnings(photo);
  S.outlineKey = "";
  const w = $("#mark-warn");
  w.hidden = !S.photoWarns.length;
  w.textContent = S.photoWarns.join(" ");
  $("#btn-delete-photo").hidden = !photo.uploaded;
  updateSummary();
  if (quiet) return;
  showStep("mark");
  S.editor.fit();
  announce("Photo ready. Now mark your roof.");
}

function setTool(tool) {
  $$(".tool").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tool === tool ? "true" : "false"));
  if (S.editor) S.editor.setTool(tool);
}

function updateMarkUI(st) {
  $("#mark-pct").textContent = st.empty ? "0%" : (st.frac * 100).toFixed(st.frac < 0.1 ? 1 : 0) + "%";
  const warn = $("#mark-warn");
  let msg = (S.photoWarns || []).join(" ");
  if (st.warning === "small") msg = "That's a very small area. Make sure you've marked the whole roof.";
  if (st.warning === "large") msg = "That's more than half the photo. Check you've only marked the roof.";
  warn.hidden = !msg;
  warn.textContent = msg;
  $("#btn-compare").disabled = st.empty && !(st.drafting && S.editor && S.editor.draft && S.editor.draft.pts.length >= 3);
  $("#btn-undo").disabled = !(S.editor && S.editor.canUndo());
  $("#btn-redo").disabled = !(S.editor && S.editor.canRedo());
  $("#btn-finish").disabled = !(S.editor && S.editor.draft && S.editor.draft.pts.length >= 3);
}

function wireMarkTools() {
  $$(".tool").forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool)));
  $("#btn-finish").addEventListener("click", () => S.editor && S.editor.finishDraft());
  $("#btn-undo").addEventListener("click", () => S.editor && S.editor.undo());
  $("#btn-redo").addEventListener("click", () => S.editor && S.editor.redo());
  $("#btn-clear").addEventListener("click", () => S.editor && S.editor.clear());
  $("#brush-size").addEventListener("input", (e) => S.editor && S.editor.setBrush(Number(e.target.value)));
  $("#snap-edges").addEventListener("change", (e) => S.editor && S.editor.setSnap(e.target.checked));
  $("#btn-change-photo").addEventListener("click", () => showStep("photo"));
  $("#btn-compare").addEventListener("click", goCompare);
  $("#btn-delete-photo").addEventListener("click", deleteMyPhoto);
  if (IS_LOCAL) {
    const b = $("#btn-copy-shapes");
    b.hidden = false;
    b.addEventListener("click", async () => {
      const out = JSON.stringify({ w: S.photo.w, h: S.photo.h, shapes: S.editor.getShapes() });
      console.log(out);
      try {
        await navigator.clipboard.writeText(out);
        announce("Outline copied.");
      } catch (err) {
        announce("Outline logged to the console.");
      }
    });
  }
}

/** The roof as a PNG where alpha 0 marks the roof (the saved outline). */
function maskToPngDataUrl(mask, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) img.data[i * 4 + 3] = mask[i] >= 128 ? 0 : 255;
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

/**
 * Save the outline to the project (uploaded photos only; samples stay on this
 * device). Saves run one after another, so the last outline drawn is always the
 * one the project keeps (renders are made for the project's current outline).
 */
function saveOutlineIfChanged() {
  if (!S.photo || !S.photo.uploaded || !S.mask || !S.editor) return Promise.resolve();
  const key = S.shapesKey;
  const mask = S.mask;
  const shapes = S.editor.getShapes();
  const { w, h } = S.photo;
  S.outlineChain = (S.outlineChain || Promise.resolve()).then(async () => {
    if (key === S.outlineKey) return;
    try {
      await saveOutline(maskToPngDataUrl(mask, w, h), shapes, w, h);
      S.outlineKey = key;
    } catch (err) {
      showBanner("Your roof outline couldn't be saved just now. Your previews are fine; we'll try again when you next compare.");
    }
  });
  return S.outlineChain;
}

/** Delete the whole project: photo, outline, renders and address. (An enquiry already sent is kept.) */
async function deleteMyPhoto() {
  if (!currentProject()) return;
  if (!window.confirm("Delete your photo, roof outline, renders and address from WV Roofing? This can't be undone.")) return;
  try {
    await deleteProject();
    resetResults();
    if (S.editor) S.editor.destroy();
    S.editor = null;
    S.photo = null;
    S.sample = null;
    S.enquiry = null;
    resetProperty();
    setParam("project", null);
    showEnquiryDone(null);
    showStep("photo");
    showStatus("Your photo, roof outline, renders and address have been deleted.");
    announce("Your photo has been deleted.");
  } catch (err) {
    window.alert(err instanceof ClientError ? err.message : "Your photo couldn't be deleted just now. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// step 3: compare

function productOrder() {
  const ids = S.cat.visuals.map((p) => p.id);
  if (S.priority && ids.includes(S.priority)) return [S.priority].concat(ids.filter((i) => i !== S.priority));
  return ids;
}

function buildGrid() {
  const grid = $("#results-grid");
  const frag = document.createDocumentFragment();
  for (const id of productOrder()) {
    const p = S.cat.byId.get(id);
    const card = document.createElement("article");
    card.className = "result-card" + (id === S.priority ? " is-priority" : "");
    card.dataset.id = id;
    const open = document.createElement("button");
    open.type = "button";
    open.className = "result-open";
    open.setAttribute("aria-label", "Compare " + p.name + " in " + p.colourName + " before and after");
    const base = document.createElement("img");
    base.alt = "";
    base.src = S.beforeUrl;
    base.width = S.photo.w;
    base.height = S.photo.h;
    const aiImg = document.createElement("img");
    aiImg.className = "result-ai";
    aiImg.alt = "";
    open.append(base, aiImg);
    open.addEventListener("click", () => {
      S.chosen = id; // the roof looked at last is the one the summary and the enquiry start from
      updateSummary();
      S.lightbox.open(id);
    });
    const body = document.createElement("div");
    body.className = "result-body";
    const h = document.createElement("h3");
    h.className = "result-title";
    h.textContent = p.name;
    const meta = document.createElement("div");
    meta.className = "result-meta";
    const colour = document.createElement("span");
    colour.textContent = p.colourName;
    meta.append(colour);
    const foot = document.createElement("div");
    foot.className = "result-foot";
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "Preparing…";
    const action = document.createElement("button");
    action.type = "button";
    action.className = "link-btn";
    action.hidden = true;
    foot.append(badge, action);
    body.append(h, meta, foot);
    card.append(open, body);
    frag.appendChild(card);
    S.cards.set(id, { card, base, aiImg, badge, action });
  }
  grid.replaceChildren(frag);
}

function setBadge(id, kind, text) {
  const c = S.cards.get(id);
  if (!c) return;
  c.badge.className = "badge" + (kind ? " badge--" + kind : "");
  c.badge.textContent = text;
}

/**
 * Build the eight previews for the current outline and move to the compare step.
 * @param {{ show?: boolean }} [opts]  show: false rebuilds without changing step (resuming)
 */
async function goCompare(opts) {
  const o = opts && opts.type ? {} : opts || {};
  const ed = S.editor;
  if (!ed) return;
  if (ed.draft && ed.draft.pts.length >= 3) ed.finishDraft();
  const st = ed.stats();
  if (st.empty) {
    announce("Mark at least part of the roof first.");
    return;
  }
  const key = JSON.stringify(ed.getShapes());
  if (key === S.shapesKey && S.cards.size) {
    if (o.show !== false) showStep("compare");
    return;
  }
  resetResults();
  S.shapesKey = key;
  const gen = S.gen;
  const { w, h } = S.photo;
  const ctx = S.photo.canvas.getContext("2d", { willReadFrequently: true });
  S.orig = ctx.getImageData(0, 0, w, h);
  S.mask = ed.getMask();
  saveOutlineIfChanged(); // not awaited: the previews don't depend on it
  S.beforeUrl = await canvasToUrl(S.photo.canvas);
  buildGrid();
  $("#compare-sub").textContent = S.sample
    ? "Quick previews of a sample house. Tap any roof to compare before and after."
    : "Tap any roof to compare before and after. Photo-real renders appear as they're ready.";
  if (o.show !== false) showStep("compare");
  setRenderStatus("Drawing quick previews…");
  await nextFrame();
  S.analysis = analyseRoof(S.orig, S.mask);
  if (!S.analysis) {
    setRenderStatus("No roof was marked.");
    return;
  }
  for (const id of productOrder()) {
    if (gen !== S.gen) return;
    await nextFrame();
    const px = renderPreview(S.analysis, S.orig, S.cat.byId.get(id));
    const url = await pixelsToUrl(px, w, h);
    if (gen !== S.gen) return;
    S.previews.set(id, { url });
    const c = S.cards.get(id);
    c.base.src = url;
    if (!S.ai.has(id)) setBadge(id, "", "Quick preview");
    S.lightbox.refresh(id);
  }
  announce("Eight quick previews ready. Tap any roof to compare before and after.");
  await startAiIfPossible(gen);
}

function setRenderStatus(text, progress) {
  $("#render-status").textContent = text;
  const bar = $("#render-progress");
  if (typeof progress === "number") {
    bar.hidden = false;
    bar.firstElementChild.style.width = Math.round(progress * 100) + "%";
  } else {
    bar.hidden = true;
  }
}

function showBanner(text) {
  const b = $("#render-banner");
  b.textContent = text;
  b.hidden = !text;
}

async function loadPrerendered(sample) {
  if (!sample.prerendered) return null;
  try {
    const r = await fetch(ROOT + "samples/renders/" + sample.id + "/meta.json", { cache: "no-cache" });
    if (!r.ok) return null;
    return await r.json();
  } catch (err) {
    return null;
  }
}

async function startAiIfPossible(gen) {
  $("#btn-start-ai").hidden = true;
  // Sample houses show pre-rendered photo-real results only (free and instant);
  // they never call the AI service from the public site.
  if (S.sample) {
    const meta = await loadPrerendered(S.sample);
    const sampleKey = JSON.stringify(
      S.sample.shapes.map((s) => ({ mode: s.mode, pts: s.pts.map((p) => [Math.round((p[0] * S.photo.w) / S.sample.w), Math.round((p[1] * S.photo.h) / S.sample.h)]) }))
    );
    let done = 0;
    if (meta && meta.products && sampleKey === S.shapesKey) {
      for (const id of productOrder()) {
        if (gen !== S.gen) return;
        if (!meta.products.includes(id)) continue;
        const src = ROOT + "samples/renders/" + S.sample.id + "/" + id + ".jpg";
        try {
          await compositeInto(id, src, meta.spec, gen);
          done++;
        } catch (err) {
          /* that one stays a quick preview */
        }
      }
    }
    if (gen !== S.gen) return;
    if (done) setRenderStatus(done + " of " + S.cat.visuals.length + " photo-real renders ready (pre-rendered sample).", done / S.cat.visuals.length);
    else setRenderStatus("Showing quick previews. Photo-real renders are made from your own photo: upload one to see your house.");
    return;
  }
  const h = S.health || (await getHealth());
  if (gen !== S.gen) return;
  if (!h.renders.live) {
    setRenderStatus("Showing quick previews. Photo-real rendering isn't switched on yet.");
    return;
  }
  if ($("#consent-ai").checked || S.aiRequested) {
    startAi(gen);
  } else {
    setRenderStatus("Want photo-real versions? This sends your photo and roof outline to OpenAI to create them.");
    $("#btn-start-ai").hidden = false;
  }
}

/** Sample houses: composite a pre-rendered result in the browser. */
async function compositeInto(id, src, spec, gen) {
  const { w, h } = S.photo;
  const render = await decodeRenderToPhotoGrid(src, spec, w, h);
  if (gen !== S.gen) return;
  const out = compositeRender(S.orig, render, S.mask, S.analysis.alpha, w, h);
  const url = await pixelsToUrl(out.pixels, w, h);
  if (gen !== S.gen) return;
  showAi(id, url, out.seam);
}

function showAi(id, url, seam) {
  S.ai.set(id, { url, seam: seam || 0 });
  const c = S.cards.get(id);
  if (!c) return;
  c.aiImg.src = url;
  c.aiImg.alt = "";
  requestAnimationFrame(() => c.aiImg.classList.add("is-in"));
  setBadge(id, "ai", "AI concept");
  c.action.hidden = true;
  S.lightbox.refresh(id);
}

/** The customer has agreed: record it, make sure the outline is saved, then render. */
async function startAi(gen) {
  S.aiRequested = true;
  $("#btn-start-ai").hidden = true;
  showBanner("");
  setRenderStatus("Getting photo-real renders ready…");
  try {
    $("#consent-ai").checked = true;
    await setConsent(true);
    await saveOutlineIfChanged();
    if (S.outlineKey !== S.shapesKey) throw new Error("outline not saved");
  } catch (err) {
    if (gen !== S.gen) return;
    S.aiRequested = false;
    showBanner("Photo-real renders couldn't start just now. Your quick previews are still here, so please try again.");
    setRenderStatus("Showing quick previews.");
    $("#btn-start-ai").hidden = false;
    return;
  }
  if (gen !== S.gen) return;
  S.renderKey = newKey();
  const todo = productOrder().filter((id) => !S.ai.has(id));
  const auto = todo.slice(0, S.health.renders.auto);
  for (const id of todo) if (!auto.includes(id)) offerRender(id);
  if (auto.length) await requestRenders(auto, gen);
  updateOverall();
}

/** One request per finish, each with its own key: a repeat tap returns the same render. */
async function requestRenders(ids, gen) {
  for (const id of ids) {
    if (gen !== S.gen) return;
    const n = (S.attempts.get(id) || 0) + 1;
    S.attempts.set(id, n);
    const c = S.cards.get(id);
    if (c) c.action.hidden = true;
    setBadge(id, "", "Queued");
    try {
      const jobs = await submitRenders([id], S.renderKey + "-" + id + "-" + n);
      for (const j of jobs) applyJob(j, gen);
    } catch (err) {
      if (gen !== S.gen) return;
      const e = err instanceof ClientError ? err : new ClientError(0, "network", "We couldn't reach the render service.");
      failCard(id, { code: e.code, message: e.message });
      if (["budget", "not_configured", "disabled", "consent_required"].includes(e.code)) {
        showBanner(e.message);
        break;
      }
    }
  }
  updateOverall();
  schedulePoll(gen, 1500);
}

function offerRender(id) {
  const c = S.cards.get(id);
  if (!c || S.ai.has(id)) return;
  setBadge(id, "", "Quick preview");
  c.action.hidden = false;
  c.action.textContent = "Create AI render";
  c.action.onclick = () => requestRenders([id], S.gen);
}

function failCard(id, error) {
  const c = S.cards.get(id);
  if (!c || S.ai.has(id)) return;
  setBadge(id, "error", "Couldn't render");
  c.badge.title = (error && error.message) || "";
  c.action.hidden = false;
  c.action.textContent = "Try again";
  c.action.onclick = () => requestRenders([id], S.gen);
  if (error && error.message) announce(error.message);
}

/** Show what the server says about one render. */
function applyJob(j, gen) {
  if (gen !== S.gen) return;
  const prev = S.jobs.get(j.visualId);
  if (prev && prev.id !== j.id && Date.parse(prev.createdAt) > Date.parse(j.createdAt)) return; // an older try
  S.jobs.set(j.visualId, j);
  const id = j.visualId;
  if (S.ai.has(id)) return;
  if (j.status === "queued") {
    setBadge(id, "", j.waitingUntil ? "Waiting…" : "Queued");
  } else if (j.status === "running") {
    if (!S.runningSince.has(j.id)) S.runningSince.set(j.id, Date.now());
    tickTimers();
    if (!S.timer) S.timer = setInterval(tickTimers, 1000);
  } else if (j.status === "succeeded") {
    if (j.image) loadRender(j, gen);
  } else if (j.status === "cancelled") {
    offerRender(id);
  } else {
    failCard(id, j.error);
  }
}

async function loadRender(j, gen) {
  if (S.loading.has(j.id)) return;
  S.loading.add(j.id);
  setBadge(j.visualId, "busy", "Finishing…");
  try {
    const blob = await fetchRenderImage(j.id);
    if (gen !== S.gen) return;
    const url = URL.createObjectURL(blob);
    S.urls.push(url);
    showAi(j.visualId, url, j.seam);
    updateOverall();
  } catch (err) {
    /* the next poll tries again */
  } finally {
    S.loading.delete(j.id);
  }
}

function schedulePoll(gen, ms) {
  clearTimeout(S.pollTimer);
  S.pollTimer = setTimeout(() => pollRenders(gen), ms);
}

async function pollRenders(gen) {
  if (gen !== S.gen) return;
  let list;
  try {
    list = await listRenders();
  } catch (err) {
    if (gen === S.gen) schedulePoll(gen, 6000);
    return;
  }
  if (gen !== S.gen) return;
  for (const j of list) applyJob(j, gen);
  updateOverall();
  const latest = [...S.jobs.values()];
  const more = latest.some((j) => j.status === "queued" || j.status === "running" || (j.status === "succeeded" && j.image && !S.ai.has(j.visualId)));
  if (more) schedulePoll(gen, document.hidden ? 8000 : 2500);
}

function tickTimers() {
  let any = false;
  for (const j of S.jobs.values()) {
    if (j.status !== "running" || S.ai.has(j.visualId)) continue;
    any = true;
    const s = Math.floor((Date.now() - (S.runningSince.get(j.id) || Date.now())) / 1000);
    setBadge(j.visualId, "busy", "Rendering " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"));
  }
  if (!any) {
    clearInterval(S.timer);
    S.timer = 0;
  }
}

function updateOverall() {
  const total = S.cat.visuals.length;
  const done = S.ai.size;
  const latest = [...S.jobs.values()].filter((j) => !S.ai.has(j.visualId));
  const busy = latest.filter((j) => j.status === "queued" || j.status === "running").length;
  const waiting = latest.some((j) => j.status === "queued" && j.waitingUntil);
  $("#btn-stop-ai").hidden = !latest.some((j) => j.status === "queued");
  if (busy) {
    setRenderStatus(
      done + " of " + total + " photo-real renders ready" + (waiting ? " (the render service is busy, so continuing in a moment)" : ", about 20 to 60 seconds each") + ".",
      done / total
    );
  } else if (S.aiRequested) {
    setRenderStatus(
      (done ? done + " of " + total + " photo-real renders ready. " : "") + (done < total ? "Tap “Create AI render” on any roof to make it photo-real." : ""),
      done ? done / total : undefined
    );
    if (done) announce(done + " photo-real render" + (done === 1 ? "" : "s") + " ready.");
  }
}

/** Cancel renders that haven't started (one already being made will still arrive). */
async function stopRenders() {
  const gen = S.gen;
  const queued = [...S.jobs.values()].filter((j) => j.status === "queued");
  for (const j of queued) {
    try {
      const r = await cancelRender(j.id);
      if (r) applyJob(r, gen);
    } catch (err) {
      /* it may have started meanwhile */
    }
  }
  updateOverall();
  schedulePoll(gen, 500);
}

function wireCompare() {
  $("#btn-start-ai").addEventListener("click", () => startAi(S.gen));
  $("#btn-stop-ai").addEventListener("click", stopRenders);
  $("#btn-edit-mark").addEventListener("click", () => {
    // Renders belong to an outline: a changed outline means making them again.
    if (S.ai.size && S.photo && S.photo.uploaded && !window.confirm("If you change the outline, your photo-real renders will need making again. Carry on?")) return;
    showStep("mark");
  });
  $("#btn-restart").addEventListener("click", () => {
    resetResults();
    showStep("photo");
  });
  $("#btn-quote").addEventListener("click", () => openQuote(firstChoice()));
  $("#btn-to-estimate").addEventListener("click", () => showStep("estimate"));
  $("#btn-estimate-back").addEventListener("click", () => showStep(canShow("compare") ? "compare" : "photo"));
  $("#btn-request-survey").addEventListener("click", () => openQuote(firstChoice(), "Please arrange a roof survey."));
  $("#btn-enquiry-back").addEventListener("click", () => showStep(canShow("compare") ? "compare" : "photo"));
  // The local nav's "Get a quote" opens the enquiry step, pre-filled with the favourite so far.
  $$("[data-open-quote]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      openQuote(S.cat ? firstChoice() : "");
    })
  );
  // The summary's "Change" links.
  $$("[data-goto]").forEach((b) =>
    b.addEventListener("click", () => {
      const step = b.dataset.goto;
      if (canShow(step)) showStep(step);
      else showStep(S.photo ? "mark" : "photo");
    })
  );
  $("#btn-delete-project").addEventListener("click", deleteMyPhoto);
}

function firstChoice() {
  if (S.chosen) return S.chosen;
  if (S.priority) return S.priority;
  const withAi = S.cat ? productOrder().find((id) => S.ai.has(id)) : "";
  return withAi || "";
}

// ---------------------------------------------------------------------------
// lightbox, download, quote

function lightboxItem(id) {
  const product = S.cat.byId.get(id);
  const pv = S.previews.get(id);
  const ai = S.ai.get(id);
  return {
    product,
    beforeUrl: S.beforeUrl,
    previewUrl: pv ? pv.url : "",
    aiUrl: ai ? ai.url : "",
    seam: ai ? ai.seam : 0,
  };
}

async function download(id, view) {
  const item = lightboxItem(id);
  const url = view === "ai" ? item.aiUrl : item.previewUrl;
  if (!url) return;
  const img = new Image();
  img.src = url;
  await img.decode();
  const label = view === "ai" ? "AI concept render, not completed work" : "Quick preview, approximate";
  downloadCanvas(watermarked(img, label), "wv-roofing-" + id + (view === "ai" ? "-ai" : "-preview") + ".jpg");
}

/** An enquiry about the customer's own photo goes with their project (the server attaches the images). */
function aboutMyPhoto() {
  return !!(S.photo && S.photo.uploaded && currentProject());
}

/** Go to the enquiry step with a roof (and, from "Request a survey", a message) filled in. */
function openQuote(productId, message) {
  if (productId) S.chosen = productId;
  fillProductSelect($("#v-product"), productId || "");
  if (message && !$("#v-message").value) $("#v-message").value = message;
  $("#v-images-row").hidden = !aboutMyPhoto();
  updateSummary();
  showStep("enquiry");
}

function wireEnquiry() {
  const form = $("#quote-form");
  wireEnquiryForm(form, {
    getContext: () => (aboutMyPhoto() ? { includeImages: $("#v-images").checked } : { source: S.sample ? "visualiser-sample" : "visualiser" }),
    send: (payload) => (aboutMyPhoto() ? sendProjectEnquiry(payload) : sendEnquiry(payload)),
    onSent: (json) => {
      if (aboutMyPhoto() && json.reference) S.enquiry = { reference: json.reference };
      showEnquiryDone({ text: form.querySelector(".form-status").textContent });
    },
  });
  $("#v-product").addEventListener("change", (e) => {
    if (S.cat && S.cat.byId.has(e.target.value)) {
      S.chosen = e.target.value;
      updateSummary();
    }
  });
}

/** Once the enquiry is saved, the step shows its reference instead of the form (never the form again). */
function showEnquiryDone(done) {
  const box = $("#enquiry-done");
  if (!done) {
    box.hidden = true;
    $("#enquiry-card").hidden = false;
    return;
  }
  box.textContent = done.text;
  box.hidden = false;
  $("#enquiry-card").hidden = true;
}

function wireDialogs() {
  S.lightbox = new Lightbox({
    dialog: $("#lightbox"),
    getItem: lightboxItem,
    order: productOrder,
    onQuote: openQuote,
    onDownload: download,
  });
}

// ---------------------------------------------------------------------------
// resume after a refresh (the project named in the URL, if this tab holds its key)

/** Rebuild everything the project holds; resolves with the furthest step reached. */
async function resume() {
  const proj = await getProject();
  if (!proj) return null;
  $("#consent-ai").checked = !!proj.consentAi;
  restoreProperty(proj.address, proj.property);
  if (proj.enquiry) {
    S.enquiry = proj.enquiry;
    showEnquiryDone({ text: "You've already sent us an enquiry about this photo. Your reference is " + proj.enquiry.reference + "." });
  }
  if (proj.photo) {
    const canvas = await blobToCanvas(await fetchDisplay());
    const p = proj.photo;
    startMarking({ canvas, w: p.w, h: p.h, name: "photo", originalW: p.origW, originalH: p.origH, warnings: p.warnings, uploaded: true }, null, { quiet: true });
    if (proj.mask && proj.mask.shapes && proj.mask.shapes.length) {
      S.editor.setShapes(proj.mask.shapes);
      // This outline is already saved: saving it again would make a new outline and set its renders aside.
      S.outlineKey = JSON.stringify(S.editor.getShapes());
      await goCompare({ show: false });
      schedulePoll(S.gen, 0); // renders made (or still being made) before the refresh
    }
  }
  updateSummary();
  if (proj.enquiry) return "enquiry";
  if (S.cards.size) return "compare";
  if (proj.photo) return "mark";
  return proj.address ? "photo" : "property";
}

// ---------------------------------------------------------------------------
// boot

async function boot() {
  if (IS_LOCAL) window.__wvr = S; // test hook (local dev only)
  const params = new URLSearchParams(window.location.search);
  S.priority = params.get("tile");
  initJourney({
    canShow,
    onShow: (step) => {
      if (step === "property") propertyShown();
      if (step === "mark" && S.editor) requestAnimationFrame(() => S.editor && S.editor.fit());
      updateSummary();
    },
  });
  wireUpload();
  wireMarkTools();
  wireCompare();
  wireDialogs();
  wireEnquiry();
  const [cat, samples, health] = await Promise.all([loadCatalogue(), loadSamples(), getHealth()]);
  S.cat = cat;
  S.samples = samples;
  S.health = health;
  S.caps = health.caps;
  // Record a change of mind about photo-real renders on the project, if there is one.
  $("#consent-ai").addEventListener("change", (e) => {
    if (currentProject()) setConsent(e.target.checked).catch(() => undefined);
  });
  if (S.priority && !cat.byId.has(S.priority)) S.priority = null;
  renderSampleGrid();
  const note = $("#ai-availability");
  if (health.renders.live && health.renders.test) note.textContent = "Test environment: photo-real renders use a stand-in image instead of the AI service.";
  else if (health.renders.live) note.textContent = "Photo-real rendering is available for your own photo. Each render takes about 20 to 60 seconds.";
  else note.textContent = "Photo-real rendering isn't switched on yet, so you'll see quick previews.";
  initProperty({
    caps: health.caps,
    ensureProject: () => projectReady({ consentAi: $("#consent-ai").checked }),
    next: () => showStep("photo"),
    announce,
    onChange: updateSummary,
  });

  // A refresh (or a restored tab) carries on with the project named in the URL.
  const pid = params.get("project");
  const saved = currentProject();
  let resumed = null;
  if (pid && saved && saved.id === pid) {
    resumed = await resume().catch((err) => {
      console.warn("resume failed", err);
      forgetProject();
      return null;
    });
  }
  if (!resumed && pid) setParam("project", null); // another tab's, deleted or expired: start afresh

  const wanted = params.get("sample");
  const s = wanted && samples.find((x) => x.id === wanted);
  if (s && !resumed) {
    show("photo", { history: "replace", focus: false });
    selectSample(s);
    return;
  }
  const fromUrl = stepFromUrl();
  const start = resumed ? (params.get("step") && canShow(fromUrl) ? fromUrl : resumed) : canShow(fromUrl) && fromUrl !== "mark" && fromUrl !== "compare" ? fromUrl : "property";
  show(start, { history: "replace", focus: false });
}

boot().catch((err) => {
  console.error(err);
  showError("The visualiser couldn't start. Please refresh the page.");
});
