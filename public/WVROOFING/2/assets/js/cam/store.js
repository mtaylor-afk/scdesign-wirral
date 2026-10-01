// WV Roofing v2 — keeping the visitor's photo for the roofer.
//
// The Roof Cam draws every roof on the visitor's own device, straight away; at
// the same time, the photo they chose is saved to WV Roofing's private store
// (the same one the first version's visualiser uses), so the roofer can see it
// in the operator screen. That happens in the background and never holds the
// Roof Cam up: if saving isn't switched on, or fails, the roofs still appear and
// the page says so plainly.
//
//   keepPhoto(file, canvas)   save a photo (every photo chosen is saved, one after another)
//   onSave(fn)                hear about { state, progress, message } as it changes
//   deletePhoto()             delete the photo (and everything with it) from the store
//   sendPreview(canvas, ...)  keep the preview of the roof they chose with the photo
//   sendEnquiry(payload)      the enquiry, about the saved photo when there is one
//
// The project's key is kept in sessionStorage (this tab only, gone when it
// closes), never in localStorage (this address is shared with another site) or
// a URL. Samples are never saved: they aren't the visitor's.

const KEY = "wvr2.project";
const MAX_BYTES = 20 * 1024 * 1024; // the store's limit for one photo
const MAX_PIXELS = 60e6;
const MAX_EDGE = 12000;
const PREVIEW_MAX_BYTES = 1150 * 1024;

/** Where the API lives: same origin on the Vercel copy and the local dev server, otherwise cross-origin. */
export const API_BASE = /^(localhost|127\.0\.0\.1|scdesign-wirral\.vercel\.app)$/.test(window.location.hostname) ? "" : "https://scdesign-wirral.vercel.app";

class StoreError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// the project key

function readKey() {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (v && v.id && v.token && Date.parse(v.expiresAt) > Date.now()) return v;
  } catch (err) {
    /* blocked or unreadable: no project */
  }
  return null;
}

function writeKey(v) {
  try {
    if (v) sessionStorage.setItem(KEY, JSON.stringify(v));
    else sessionStorage.removeItem(KEY);
  } catch (err) {
    /* storage blocked (private mode): the key lives in memory for this page */
  }
}

let memoryKey = null;

function project() {
  return readKey() || memoryKey;
}

function forget() {
  memoryKey = null;
  writeKey(null);
}

async function call(method, path, body, p) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (p) headers.Authorization = "Bearer " + p.token;
  let r;
  try {
    r = await fetch(API_BASE + "/api/wvroofing/" + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", credentials: "omit" });
  } catch (err) {
    throw new StoreError(0, "network", "No connection to WV Roofing just now.");
  }
  let j = null;
  try {
    j = await r.json();
  } catch (err) {
    j = null;
  }
  if (!r.ok || !j || j.ok === false) {
    const code = (j && j.error) || "http_" + r.status;
    if (p && (r.status === 401 || code === "project_not_found")) forget();
    throw new StoreError(r.status, code, (j && j.message) || "Something went wrong.");
  }
  return j;
}

async function ensureProject() {
  const have = project();
  if (have) return have;
  const j = await call("POST", "projects", { noticeShown: true, consentAi: false, site: "v2" });
  const p = { id: j.id, token: j.token, expiresAt: j.expiresAt };
  memoryKey = p;
  writeKey(p);
  return p;
}

// ---------------------------------------------------------------------------
// what is sent: the camera's own file where the store takes it, otherwise a
// JPEG made here from the photo as the Roof Cam opened it

async function sniff(file) {
  const b = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  return "other";
}

function slowLink() {
  const c = navigator.connection;
  return !!(c && (c.saveData || /^(slow-2g|2g|3g)$/.test(String(c.effectiveType || ""))));
}

function canvasJpeg(canvas, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", quality));
}

/**
 * @param {Blob} file      what the visitor chose
 * @param {HTMLCanvasElement} canvas  the photo as the Roof Cam opened it (turned upright, at most 1600 px)
 * @param {{w:number, h:number}|null} head  the file's own size, when its header was read
 */
async function uploadable(file, canvas, head) {
  const kind = await sniff(file).catch(() => "other");
  const fits = file.size <= MAX_BYTES && (!head || (head.w * head.h <= MAX_PIXELS && Math.max(head.w, head.h) <= MAX_EDGE));
  // On a slow or data-saving connection a big photo would take minutes: send the working copy.
  const tooSlow = slowLink() && file.size > 3 * 1024 * 1024;
  if ((kind === "jpeg" || kind === "png") && fits && !tooSlow) return { blob: file, type: kind === "png" ? "image/png" : "image/jpeg", clientResized: false };
  return { blob: await canvasJpeg(canvas, 0.92), type: "image/jpeg", clientResized: true };
}

function put(url, blob, type, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", type);
    xhr.timeout = 180000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new StoreError(xhr.status, "upload_failed", "The photo didn't upload.")));
    xhr.onerror = () => reject(new StoreError(0, "network", "The connection dropped while the photo was uploading."));
    xhr.ontimeout = () => reject(new StoreError(0, "network", "The upload took too long."));
    xhr.onabort = () => reject(new StoreError(0, "aborted", "aborted"));
    if (signal) signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

// ---------------------------------------------------------------------------
// the save, and who's listening

const listeners = new Set();
let ticket = 0;
// The latest photo's save: { ticket, state, progress, message, ctl, file, canvas, head,
// p (the project it was saved into, kept for Delete even after the tab starts a new one) }.
let current = null;
// Saves run one after another, so the photo chosen last is always the project's current one.
let queue = Promise.resolve();
let settled = Promise.resolve();

function emit() {
  const s = status();
  for (const fn of listeners) fn(s);
}

/** What the save is doing now: { state: "idle"|"saving"|"saved"|"off"|"failed"|"deleted", progress, message }. */
export function status() {
  if (!current) return { state: "idle", progress: 0, message: "" };
  return { state: current.state, progress: current.progress, message: current.message };
}

export function onSave(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function set(job, patch) {
  Object.assign(job, patch);
  if (job === current) emit();
}

/** Stop showing the save (a sample house, or Start again). A save under way still finishes. */
export function clearSave() {
  current = null;
  emit();
}

/**
 * Save the visitor's photo to the store, in the background. Every photo they
 * choose is saved, one after another; the page shows how the latest is going.
 * @param {Blob} file
 * @param {HTMLCanvasElement} canvas
 * @param {{w:number, h:number}|null} [head]
 */
export function keepPhoto(file, canvas, head) {
  const t = ++ticket;
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const job = { ticket: t, state: "saving", progress: 0, message: "", ctl, file, canvas, head: head || null, p: null };
  current = job;
  emit();
  const run = queue.then(() => save(job));
  queue = run.catch(() => undefined);
  settled = queue;
  return run;
}

/** Try the last photo again (after a failure). */
export function retry() {
  if (!current || current.state !== "failed" || !current.file) return Promise.resolve();
  return keepPhoto(current.file, current.canvas, current.head);
}

async function save(job) {
  try {
    let up = await uploadable(job.file, job.canvas, job.head);
    let attempt = 0;
    for (;;) {
      if (job.ctl && job.ctl.signal.aborted) return;
      try {
        const p = await ensureProject();
        const pre = await call("POST", "projects/" + p.id + "/photo/presign", { contentType: up.type, bytes: up.blob.size }, p);
        const url = /^https?:/i.test(pre.url) ? pre.url : API_BASE + pre.url;
        await put(url, up.blob, up.type, (f) => set(job, { progress: Math.min(0.97, f) }), job.ctl ? job.ctl.signal : null);
        set(job, { progress: 0.98 });
        await call("POST", "projects/" + p.id + "/photo/commit", { uploadId: pre.uploadId, clientResized: up.clientResized }, p);
        set(job, { state: "saved", progress: 1, message: "", ctl: null, p });
        return;
      } catch (err) {
        if (err.code === "aborted") return;
        // Too many pixels for the store (its header said otherwise, or couldn't be read): send the working copy.
        if (err.code === "invalid_image" && /megapixels/i.test(err.message) && !up.clientResized) {
          up = { blob: await canvasJpeg(job.canvas, 0.92), type: "image/jpeg", clientResized: true };
          continue;
        }
        // The project this tab remembered has gone: start a new one, once.
        if (err.code === "project_not_found" && attempt === 0) {
          attempt++;
          continue;
        }
        // One quiet retry when the connection blinked.
        if ((err.code === "network" || err.status >= 500) && err.code !== "not_configured" && attempt === 0) {
          attempt++;
          await new Promise((res) => setTimeout(res, 2500));
          continue;
        }
        throw err;
      }
    }
  } catch (err) {
    if (err.code === "aborted") return;
    if (err.code === "not_configured") set(job, { state: "off", message: "", ctl: null });
    else set(job, { state: "failed", message: err.message || "The photo couldn't be saved.", ctl: null });
  }
}

/** Wait (at most ms) for the save in progress to finish. */
export function whenSettled(ms) {
  return Promise.race([settled, new Promise((res) => setTimeout(res, ms))]);
}

/** Is there a saved photo the enquiry can be about? */
export function photoSaved() {
  return !!(current && current.state === "saved" && current.p);
}

/**
 * Delete the photo on screen (and everything saved with it) from the store.
 * It runs in the queue: a photo chosen meanwhile is saved after it, into a new project.
 */
export function deletePhoto() {
  const job = current;
  const p = (job && job.p) || project();
  if (!p) return Promise.resolve();
  // An upload of this photo still under way stops first, so nothing arrives after the delete.
  if (job && job.ctl) job.ctl.abort();
  const run = queue.then(async () => {
    await call("POST", "projects/" + p.id + "/delete", {}, p);
    const now = project();
    if (now && now.id === p.id) forget();
    if (job) set(job, { state: "deleted", progress: 0, ctl: null, p: null });
  });
  queue = run.catch(() => undefined);
  settled = queue;
  return run;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

/**
 * Keep a preview (the roof they chose, as drawn here) with the saved photo.
 * @param {HTMLCanvasElement} canvas
 * @param {string} visualId
 * @param {string} condition
 */
export async function sendPreview(canvas, visualId, condition) {
  const p = photoSaved() ? current.p : null;
  if (!p) return null;
  let blob = await canvasJpeg(canvas, 0.85);
  if (blob.size > PREVIEW_MAX_BYTES) blob = await canvasJpeg(canvas, 0.68);
  if (blob.size > PREVIEW_MAX_BYTES) return null;
  const j = await call("POST", "projects/" + p.id + "/mockups", { visualId, condition, jpeg: await blobToDataUrl(blob) }, p);
  return j.mockup;
}

/**
 * Send the enquiry: about the saved photo when there is one (the server adds
 * the photo and the preview), otherwise on its own.
 * @returns {Promise<{status:number, json:object}>} for the shared form code
 */
export async function sendEnquiry(payload) {
  const job = photoSaved() ? current : null;
  const p = job ? job.p : null;
  const post = async (path, body, auth) => {
    const headers = { "Content-Type": "application/json" };
    if (auth) headers.Authorization = "Bearer " + auth.token;
    const res = await fetch(API_BASE + "/api/wvroofing/" + path, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store", credentials: "omit" });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  };
  if (p) {
    const r = await post("projects/" + p.id + "/enquiry", payload, p);
    if (r.json.ok) {
      // This photo now belongs to that enquiry: the next photo starts a new project (the light
      // can still delete this one, through job.p).
      const now = project();
      if (now && now.id === p.id) forget();
      return Object.assign(r, { withPhoto: true });
    }
    if (r.json.error !== "project_not_found") return r;
    // The photo has gone (deleted, or expired): still send the enquiry, without it.
    forget();
    job.p = null;
  }
  const free = Object.assign({}, payload);
  delete free.includeImages;
  return Object.assign(await post("enquiries", free, null), { withPhoto: false });
}
