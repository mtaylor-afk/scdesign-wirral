// WV Roofing Roof Visualiser — page controller.
//
// Flow: 1 photo (upload / camera / sample)  ->  2 mark the roof (MaskEditor)
//       ->  3 compare: eight instant quick previews, then photo-real AI renders
//          (optional, with consent) composited so only the roof changes.
import { loadCatalogue, priceBandNode } from "../catalogue.js";
import { ROOT, IS_LOCAL } from "../config.js";
import { preparePhoto, loadSample, photoWarnings, PhotoError } from "./photo.js";
import { MaskEditor } from "./mask-editor.js";
import { analyseRoof, renderPreview } from "./preview.js";
import { chooseAiSize, buildAiInputs } from "./ai-input.js";
import { compositeRender, decodeRenderToPhotoGrid } from "./composite.js";
import { getHealth, requestRender, mockAllowed } from "./api.js";
import { RenderQueue } from "./queue.js";
import { Lightbox } from "./lightbox.js";
import { watermarked, downloadCanvas } from "./watermark.js";
import { wireEnquiryForm, fillProductSelect } from "../enquiry.js";

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
  queue: null,
  aiInputs: null,
  priority: null,
  aiRequested: false,
  saveRenders: false,
  timer: 0,
  urls: [],
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

function showStep(step, focus) {
  $$("[data-panel]").forEach((p) => {
    p.hidden = p.dataset.panel !== step;
  });
  const order = ["photo", "mark", "compare"];
  $$(".vis-steps li").forEach((li) => {
    const i = order.indexOf(li.dataset.step);
    const cur = order.indexOf(step);
    if (i === cur) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
    li.classList.toggle("is-done", i < cur);
  });
  const steps = $(".vis-steps");
  if (steps) {
    const top = steps.getBoundingClientRect().top + window.scrollY - 90;
    if (window.scrollY > top + 40 || window.scrollY < top - 400) window.scrollTo({ top, behavior: "smooth" });
  }
  if (focus !== false) {
    const h = $('[data-panel="' + step + '"] .vis-h');
    if (h) {
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
    }
  }
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
  if (!file) return;
  try {
    announce("Preparing your photo…");
    const photo = await preparePhoto(file);
    startMarking(photo, null);
  } catch (err) {
    showError(err instanceof PhotoError ? err.message : "Sorry, that photo couldn't be opened. Please try a JPG or PNG.");
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
  if (S.queue) S.queue.cancelAll();
  S.queue = null;
  S.aiInputs = null;
  S.aiRequested = false;
  S.previews.clear();
  S.ai.clear();
  S.cards.clear();
  S.shapesKey = "";
  S.analysis = null;
  S.mask = null;
  clearInterval(S.timer);
  releaseUrls();
  $("#results-grid").replaceChildren();
  $("#render-banner").hidden = true;
}

function startMarking(photo, sample) {
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
  const warns = photoWarnings(photo);
  const w = $("#mark-warn");
  w.hidden = !warns.length;
  w.textContent = warns.join(" ");
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
  const photoWarns = S.photo ? photoWarnings(S.photo) : [];
  let msg = photoWarns.join(" ");
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

// ---------------------------------------------------------------------------
// step 3: compare

function productOrder() {
  const ids = S.cat.products.map((p) => p.id);
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
    open.addEventListener("click", () => S.lightbox.open(id));
    const body = document.createElement("div");
    body.className = "result-body";
    const h = document.createElement("h3");
    h.className = "result-title";
    h.textContent = p.name;
    const meta = document.createElement("div");
    meta.className = "result-meta";
    const colour = document.createElement("span");
    colour.textContent = p.colourName;
    meta.append(colour, priceBandNode(p.price));
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

async function goCompare() {
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
    showStep("compare");
    return;
  }
  resetResults();
  S.shapesKey = key;
  const gen = S.gen;
  const { w, h } = S.photo;
  const ctx = S.photo.canvas.getContext("2d", { willReadFrequently: true });
  S.orig = ctx.getImageData(0, 0, w, h);
  S.mask = ed.getMask();
  S.beforeUrl = await canvasToUrl(S.photo.canvas);
  buildGrid();
  showStep("compare");
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
  // Sample houses may carry pre-rendered photo-real results: free and instant.
  if (S.sample) {
    const meta = await loadPrerendered(S.sample);
    const sampleKey = JSON.stringify(
      S.sample.shapes.map((s) => ({ mode: s.mode, pts: s.pts.map((p) => [Math.round((p[0] * S.photo.w) / S.sample.w), Math.round((p[1] * S.photo.h) / S.sample.h)]) }))
    );
    if (meta && meta.products && sampleKey === S.shapesKey) {
      let done = 0;
      for (const id of productOrder()) {
        if (gen !== S.gen) return;
        if (!meta.products.includes(id)) continue;
        const src = ROOT + "samples/renders/" + S.sample.id + "/" + id + ".jpg";
        try {
          await compositeInto(id, src, meta.spec, gen, meta.model);
          done++;
        } catch (err) {
          /* fall back to live rendering below */
        }
      }
      if (done) {
        setRenderStatus(done + " of " + S.cat.products.length + " photo-real renders ready (pre-rendered sample).", done / S.cat.products.length);
        if (done >= S.cat.products.length) return;
      }
    }
  }
  const h = S.health || (await getHealth());
  const canRender = h.live || mockAllowed(h);
  $("#btn-start-ai").hidden = true;
  if (!canRender) {
    if (!S.ai.size) setRenderStatus("Showing quick previews. Photo-real rendering isn't switched on in this preview.");
    return;
  }
  if ($("#consent-ai").checked || S.aiRequested) {
    startAi(gen);
  } else {
    setRenderStatus("Want photo-real versions? This sends your photo and roof outline to OpenAI to create them.");
    $("#btn-start-ai").hidden = false;
  }
}

async function compositeInto(id, src, spec, gen, model) {
  const { w, h } = S.photo;
  const render = await decodeRenderToPhotoGrid(src, spec, w, h);
  if (gen !== S.gen) return;
  const out = compositeRender(S.orig, render, S.mask, S.analysis.alpha, w, h);
  const url = await pixelsToUrl(out.pixels, w, h);
  if (gen !== S.gen) return;
  S.ai.set(id, { url, seam: out.seam, model: model || "" });
  const c = S.cards.get(id);
  c.aiImg.src = url;
  c.aiImg.alt = "";
  requestAnimationFrame(() => c.aiImg.classList.add("is-in"));
  setBadge(id, "ai", "AI concept");
  c.action.hidden = true;
  S.lightbox.refresh(id);
}

function startAi(gen) {
  const h = S.health;
  S.aiRequested = true;
  $("#btn-start-ai").hidden = true;
  $("#btn-stop-ai").hidden = false;
  showBanner("");
  const spec = chooseAiSize(S.photo.w, S.photo.h, h.flex);
  S.aiInputs = buildAiInputs(S.photo.canvas, S.mask, spec);
  const mock = mockAllowed(h);
  S.queue = new RenderQueue({
    concurrency: Math.min(3, h.maxConcurrent || 2),
    run: async (job, signal) => {
      const res = await requestRender({
        productId: job.id,
        image: S.aiInputs.image,
        mask: S.aiInputs.mask,
        W: S.aiInputs.W,
        H: S.aiInputs.H,
        mock,
        signal,
      });
      if (gen !== S.gen) return null;
      if (S.saveRenders && S.sample) saveRender(job.id, res.image);
      await compositeInto(job.id, res.image, S.aiInputs.spec, gen, res.model);
      return true;
    },
    onChange: (job) => onJobChange(job, gen),
    onStop: (err) => onQueueStop(err),
  });
  const todo = productOrder().filter((id) => !S.ai.has(id));
  const auto = Math.max(0, Math.min(todo.length, h.autoRender || todo.length));
  todo.forEach((id, i) => {
    if (i < auto) S.queue.add(id);
    else offerRender(id);
  });
  clearInterval(S.timer);
  S.timer = setInterval(tickTimers, 1000);
  updateOverall();
}

function offerRender(id) {
  const c = S.cards.get(id);
  if (!c) return;
  c.action.hidden = false;
  c.action.textContent = "Create AI render";
  c.action.onclick = () => {
    c.action.hidden = true;
    S.queue.add(id);
  };
}

function onJobChange(job, gen) {
  if (gen !== S.gen) return;
  const c = S.cards.get(job.id);
  if (!c) return;
  if (job.state === "queued") setBadge(job.id, "", "Queued");
  else if (job.state === "running") setBadge(job.id, "busy", "Rendering 0:00");
  else if (job.state === "error") {
    setBadge(job.id, "error", "Couldn't render");
    c.action.hidden = false;
    c.action.textContent = "Try again";
    c.action.onclick = () => {
      c.action.hidden = true;
      S.queue.retry(job.id);
    };
  } else if (job.state === "stopped") {
    setBadge(job.id, "", "Quick preview");
  }
  updateOverall();
}

function tickTimers() {
  if (!S.queue) return;
  let any = false;
  for (const j of S.queue.jobs) {
    if (j.state !== "running") continue;
    any = true;
    const s = Math.floor((Date.now() - j.started) / 1000);
    setBadge(j.id, "busy", "Rendering " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"));
  }
  if (!any && S.queue.counts().queued === 0) clearInterval(S.timer);
}

function updateOverall() {
  const total = S.cat.products.length;
  const done = S.ai.size;
  const c = S.queue ? S.queue.counts() : { queued: 0, running: 0 };
  const busy = c.queued + c.running;
  if (busy) {
    const paused = S.queue && S.queue.pausedUntil > Date.now();
    setRenderStatus(
      done + " of " + total + " photo-real renders ready" + (paused ? " (the render service is busy, so continuing in a moment)" : ", about 20 to 60 seconds each") + ".",
      done / total
    );
  } else {
    setRenderStatus(done ? done + " of " + total + " photo-real renders ready." : "Showing quick previews.", done ? done / total : undefined);
    $("#btn-stop-ai").hidden = true;
    if (done) announce(done + " photo-real renders ready.");
  }
}

function onQueueStop(err) {
  const code = err && err.code;
  const msg =
    code === "budget"
      ? "Photo-real renders have reached their limit for now. Your quick previews are still here."
      : code === "disabled" || code === "not_configured"
        ? "Photo-real rendering is switched off at the moment, so you're seeing quick previews."
        : "Photo-real rendering stopped. Your quick previews are still here.";
  showBanner(msg);
  $("#btn-stop-ai").hidden = true;
  updateOverall();
}

async function saveRender(id, dataUrl) {
  // Local-only helper used to pre-render the sample houses (see docs/WVROOFING.md).
  try {
    await fetch("/__dev/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "samples/renders/" + S.sample.id + "/" + id + ".jpg", dataUrl }),
    });
    const done = S.cat.products.filter((p) => S.ai.has(p.id) || p.id === id).map((p) => p.id);
    await fetch("/__dev/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "samples/renders/" + S.sample.id + "/meta.json",
        data: { spec: S.aiInputs.spec, products: done, model: S.health.model },
      }),
    });
  } catch (err) {
    console.warn("save failed", err);
  }
}

function wireCompare() {
  $("#btn-start-ai").addEventListener("click", () => {
    $("#consent-ai").checked = true;
    startAi(S.gen);
  });
  $("#btn-stop-ai").addEventListener("click", () => {
    if (S.queue) S.queue.cancelAll();
    clearInterval(S.timer);
    for (const id of productOrder()) if (!S.ai.has(id)) setBadge(id, "", "Quick preview");
    $("#btn-stop-ai").hidden = true;
    S.aiRequested = false;
    S.queue = null;
    setRenderStatus("Renders stopped. " + S.ai.size + " photo-real render" + (S.ai.size === 1 ? "" : "s") + " kept.");
    $("#btn-start-ai").hidden = false;
  });
  $("#btn-edit-mark").addEventListener("click", () => showStep("mark"));
  $("#btn-restart").addEventListener("click", () => {
    resetResults();
    showStep("photo");
  });
  $("#btn-quote").addEventListener("click", () => openQuote(firstChoice()));
  // The local nav's "Get a quote" opens the quote form here, pre-filled with the favourite so far.
  $$("[data-open-quote]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      openQuote(S.cat ? firstChoice() : "");
    })
  );
}

function firstChoice() {
  if (S.priority) return S.priority;
  const withAi = productOrder().find((id) => S.ai.has(id));
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

async function smallJpeg(url, maxEdge, quality) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const s = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}

let quoteWired = false;
function openQuote(productId) {
  const dlg = $("#quote-dialog");
  const form = $("#quote-form");
  const select = $("#v-product");
  fillProductSelect(select, productId || "");
  $("#v-images-row").hidden = !S.beforeUrl;
  if (!quoteWired) {
    quoteWired = true;
    wireEnquiryForm(form, {
      getContext: async () => {
        const ctx = {};
        if (!$("#v-images").checked || !S.beforeUrl) return ctx;
        const chosen = select.value && S.cat.byId.has(select.value) ? select.value : firstChoice();
        const item = chosen ? lightboxItem(chosen) : null;
        const after = item && (item.aiUrl || item.previewUrl);
        const atts = [{ name: "before.jpg", dataUrl: await smallJpeg(S.beforeUrl, 1100, 0.8) }];
        if (after) atts.push({ name: "after-" + chosen + (item.aiUrl ? "-ai" : "-preview") + ".jpg", dataUrl: await smallJpeg(after, 1100, 0.8) });
        ctx.attachments = atts;
        return ctx;
      },
    });
  }
  dlg.showModal();
}

function wireDialogs() {
  S.lightbox = new Lightbox({
    dialog: $("#lightbox"),
    getItem: lightboxItem,
    order: productOrder,
    onQuote: openQuote,
    onDownload: download,
  });
  const qd = $("#quote-dialog");
  $("#qd-close").addEventListener("click", () => qd.close());
  qd.addEventListener("click", (e) => {
    if (e.target === qd) qd.close();
  });
}

// ---------------------------------------------------------------------------
// boot

async function boot() {
  if (IS_LOCAL) window.__wvr = S; // test hook (local dev only)
  const params = new URLSearchParams(window.location.search);
  S.priority = params.get("tile");
  S.saveRenders = IS_LOCAL && params.get("save") === "1";
  wireUpload();
  wireMarkTools();
  wireCompare();
  wireDialogs();
  const [cat, samples, health] = await Promise.all([loadCatalogue(), loadSamples(), getHealth()]);
  S.cat = cat;
  S.samples = samples;
  S.health = health;
  if (S.priority && !cat.byId.has(S.priority)) S.priority = null;
  renderSampleGrid();
  const note = $("#ai-availability");
  if (health.live) note.textContent = "Photo-real rendering is available. Each render takes about 20 to 60 seconds.";
  else if (mockAllowed(health)) note.textContent = "Local test mode: renders use a stand-in image instead of the AI service.";
  else note.textContent = "Photo-real rendering isn't switched on in this preview yet, so you'll see quick previews.";
  const wanted = params.get("sample");
  const s = wanted && samples.find((x) => x.id === wanted);
  if (s) selectSample(s);
}

boot().catch((err) => {
  console.error(err);
  showError("The visualiser couldn't start. Please refresh the page.");
});
