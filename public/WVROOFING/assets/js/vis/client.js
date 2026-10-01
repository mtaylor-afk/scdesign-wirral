// WV Roofing Roof Visualiser — the customer's project on the server: the photo
// and roof outline (A2) and the photo-real renders (A3).
//
// The project token is kept in sessionStorage: it survives a refresh and the
// tab being restored, and disappears when the tab is closed. It is never put
// in localStorage (this origin is shared with another site) and never in a URL.
import { API_BASE } from "../config.js";
import { sendEnquiry } from "../enquiry.js";

const KEY = "wvr.project.v1";
const MAX_BYTES = 20 * 1024 * 1024;

export class ClientError extends Error {
  constructor(status, code, message, retryAfter) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter || 0;
  }
}

function readStore() {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || "null");
    return v && v.id && v.token ? v : null;
  } catch (err) {
    return null;
  }
}

function writeStore(v) {
  try {
    if (v) sessionStorage.setItem(KEY, JSON.stringify(v));
    else sessionStorage.removeItem(KEY);
  } catch (err) {
    /* storage blocked (private mode): the project simply won't survive a refresh */
  }
}

/** The project this tab is working on, if any. */
export function currentProject() {
  const p = readStore();
  if (p && Date.parse(p.expiresAt) <= Date.now()) {
    writeStore(null);
    return null;
  }
  return p;
}

export function forgetProject() {
  writeStore(null);
}

async function call(method, path, opts) {
  const o = opts || {};
  const headers = {};
  if (o.body !== undefined) headers["Content-Type"] = "application/json";
  if (o.project) headers.Authorization = "Bearer " + o.project.token;
  let r;
  try {
    r = await fetch(API_BASE + "/api/wvroofing/" + path, {
      method,
      headers,
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
      cache: "no-store",
    });
  } catch (err) {
    throw new ClientError(0, "network", "We couldn't reach the server. Check your connection and try again.");
  }
  if (o.raw && r.ok) return r;
  let json = null;
  try {
    json = await r.json();
  } catch (err) {
    json = null;
  }
  if (!r.ok || !json || json.ok === false) {
    const code = (json && json.error) || "http_" + r.status;
    // The project is gone (deleted, expired, or from an older session): forget its key.
    if (o.project && (r.status === 401 || code === "project_not_found")) forgetProject();
    throw new ClientError(r.status, code, (json && json.message) || "Something went wrong. Please try again.", Number(r.headers.get("Retry-After")) || 0);
  }
  return json;
}

/**
 * What a chosen file really is, from its first bytes (the name and the
 * browser's type can't be trusted, and iPhones sometimes send HEIC).
 * @param {Blob} file
 * @returns {Promise<"jpeg"|"png"|"heic"|"other">}
 */
export async function sniffFile(file) {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  const ftyp = String.fromCharCode(b[4], b[5], b[6], b[7]);
  if (ftyp === "ftyp") return "heic";
  return "other";
}

export { MAX_BYTES };

/** Create the project on first use (no contact details, no account). */
export async function ensureProject(opts) {
  const have = currentProject();
  if (have) return have;
  const j = await call("POST", "projects", { body: { noticeShown: true, consentAi: !!(opts && opts.consentAi), site: "v1" } });
  const p = { id: j.id, token: j.token, expiresAt: j.expiresAt };
  writeStore(p);
  return p;
}

export async function getProject() {
  const p = currentProject();
  if (!p) return null;
  const j = await call("GET", "projects/" + p.id, { project: p });
  return j.project;
}

export async function setConsent(ai) {
  const p = currentProject();
  if (!p) return;
  await call("POST", "projects/" + p.id + "/consent", { body: { ai: !!ai }, project: p });
}

function putWithProgress(url, file, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const k of Object.keys(headers || {})) xhr.setRequestHeader(k, headers[k]);
    // A phone on a weak signal can stall for minutes: give up, so the page can say so.
    xhr.timeout = 180000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ClientError(xhr.status, "upload_failed", "The photo didn't upload. Please try again.")));
    xhr.onerror = () => reject(new ClientError(0, "network", "The photo didn't upload. Check your connection and try again."));
    xhr.ontimeout = () => reject(new ClientError(0, "network", "The photo took too long to upload. Check your connection and try again."));
    xhr.send(file);
  });
}

/** Is this a slow or data-saving connection (where a big photo would take minutes to send)? */
function slowLink() {
  const c = navigator.connection;
  return !!(c && (c.saveData || /^(slow-2g|2g|3g)$/.test(String(c.effectiveType || ""))));
}

const SEND_EDGE = 4096;

/**
 * A JPEG made on this device from a photo the store can't take as it is (an
 * iPhone HEIC the browser can open, a WebP, a photo over 20 MB or over 60
 * megapixels), at most 4096 px on its long edge and turned the right way up.
 * @param {Blob} file
 * @returns {Promise<Blob>}
 */
async function convertOnDevice(file) {
  let src;
  try {
    src = typeof createImageBitmap === "function" ? await createImageBitmap(file, { imageOrientation: "from-image" }) : null;
  } catch (err) {
    src = null;
  }
  if (!src) {
    src = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("decode failed"));
      };
      img.src = url;
    });
  }
  const w = src.naturalWidth || src.width;
  const h = src.naturalHeight || src.height;
  const k = Math.min(1, SEND_EDGE / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0, c.width, c.height);
  if (src.close) src.close();
  const blob = await new Promise((resolve) => c.toBlob(resolve, "image/jpeg", 0.9));
  c.width = 0;
  c.height = 0;
  if (!blob) throw new Error("encode failed");
  return blob;
}

/**
 * What to send for a chosen photo: the camera's own JPEG or PNG when the store
 * can take it, otherwise a JPEG made on this device. Resolves with
 * { blob, kind: "jpeg"|"png", clientResized }.
 * @param {Blob} file
 * @param {"jpeg"|"png"|"heic"|"other"} kind  from sniffFile
 * @param {{ force?: boolean }} [opts]  force: always make a copy (the store said the photo has too many pixels)
 */
export async function prepareForUpload(file, kind, opts) {
  const usable = (kind === "jpeg" || kind === "png") && file.size <= MAX_BYTES;
  const tooSlow = slowLink() && file.size > 4 * 1024 * 1024;
  if (usable && !tooSlow && !(opts && opts.force)) return { blob: file, kind, clientResized: false };
  try {
    return { blob: await convertOnDevice(file), kind: "jpeg", clientResized: true };
  } catch (err) {
    if (kind === "heic") {
      throw new ClientError(0, "heic", 'This photo is in the iPhone HEIC format, which this browser can\'t open. Choose it again from your photo library (your phone turns it into a JPEG), or set the camera to "Most Compatible".');
    }
    throw new ClientError(0, "unreadable", "This photo couldn't be opened. Please try a JPG or PNG.");
  }
}

/**
 * Upload a photo straight to private storage, then have the server check and
 * prepare it. A connection that drops is tried once more on its own.
 * Resolves with { id, w, h, origW, origH, warnings }.
 * @param {Blob} blob
 * @param {"jpeg"|"png"} kind
 * @param {(fraction: number) => void} [onProgress]
 * @param {{ clientResized?: boolean }} [opts]
 */
export async function uploadPhoto(blob, kind, onProgress, opts) {
  const p = currentProject();
  if (!p) throw new ClientError(0, "no_project", "Please choose your photo again.");
  const contentType = kind === "png" ? "image/png" : "image/jpeg";
  for (let attempt = 0; ; attempt++) {
    try {
      const pre = await call("POST", "projects/" + p.id + "/photo/presign", { body: { contentType, bytes: blob.size }, project: p });
      const url = /^https?:/i.test(pre.url) ? pre.url : API_BASE + pre.url;
      await putWithProgress(url, blob, pre.headers, onProgress);
      const c = await call("POST", "projects/" + p.id + "/photo/commit", { body: { uploadId: pre.uploadId, clientResized: !!(opts && opts.clientResized) }, project: p });
      return c.photo;
    } catch (err) {
      const blip = err instanceof ClientError && (err.code === "network" || (err.status >= 500 && err.code !== "not_configured"));
      if (!blip || attempt > 0) throw err;
      if (onProgress) onProgress(0);
      await new Promise((res) => setTimeout(res, 2500));
    }
  }
}

/**
 * Keep a preview drawn on this device (the roof the customer chose) with
 * their photo, so the roofer sees it with the enquiry.
 * @param {Blob} jpeg
 * @param {string} visualId
 */
export async function sendMockup(jpeg, visualId) {
  const p = requireProject();
  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(jpeg);
  });
  const j = await call("POST", "projects/" + p.id + "/mockups", { body: { visualId, jpeg: dataUrl }, project: p });
  return j.mockup;
}

/** The prepared photo (the working copy as a JPEG), for the editor. */
export async function fetchDisplay() {
  const p = currentProject();
  if (!p) throw new ClientError(0, "no_project", "Please choose your photo again.");
  const r = await call("GET", "projects/" + p.id + "/photo/display", { project: p, raw: true });
  return r.blob();
}

/** Save the roof outline: the mask (alpha 0 = roof) and the editable shapes. */
export async function saveOutline(pngDataUrl, shapes, w, h) {
  const p = currentProject();
  if (!p) return null;
  const j = await call("POST", "projects/" + p.id + "/mask", { body: { png: pngDataUrl, shapes, displayW: w, displayH: h }, project: p });
  return j.mask;
}

/** Delete the photo, outline and project from the server, and forget it here. */
export async function deleteProject() {
  const p = currentProject();
  if (!p) return;
  await call("POST", "projects/" + p.id + "/delete", { body: {}, project: p });
  forgetProject();
}

/** Addresses at a postcode: [{ label, newBuild, pinnable, token }]. */
export async function lookupAddress(postcode) {
  const p = requireProject();
  return call("POST", "projects/" + p.id + "/address/lookup", { body: { postcode }, project: p });
}

/** Choose a looked-up address ({ token }) or a typed one ({ manual: { line1, line2, town, postcode } }). */
export async function chooseAddress(choice) {
  const p = requireProject();
  const j = await call("POST", "projects/" + p.id + "/address", { body: choice, project: p });
  return j.address;
}

export async function clearAddress() {
  const p = currentProject();
  if (!p) return;
  await call("DELETE", "projects/" + p.id + "/address", { project: p });
}

/** The aerial view of the chosen address: { available, url, pin, attribution } or { available: false, reason }. */
export async function propertyView() {
  const p = requireProject();
  const j = await call("GET", "projects/" + p.id + "/property/view", { project: p });
  return j.view;
}

/** Record what the customer confirmed: { pinConfirmed, propertyType }. */
export async function confirmProperty(o) {
  const p = requireProject();
  const j = await call("POST", "projects/" + p.id + "/property/confirm", { body: o, project: p });
  return j.property;
}

/** A random request key, so a repeated tap or a reload never makes a second render. */
export function newKey() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function requireProject() {
  const p = currentProject();
  if (!p) throw new ClientError(0, "no_project", "Please choose your photo again.");
  return p;
}

/**
 * Ask for photo-real renders of these finishes. The same key always answers
 * with the same render; a new key after a failure starts a new one.
 * Resolves with the renders: [{ id, visualId, status, image, error, ... }].
 */
export async function submitRenders(visualIds, idempotencyKey) {
  const p = requireProject();
  const j = await call("POST", "projects/" + p.id + "/renders", { body: { visualIds, idempotencyKey }, project: p });
  return j.renders;
}

/** The project's renders for its current photo and roof outline. */
export async function listRenders() {
  const p = currentProject();
  if (!p) return [];
  const j = await call("GET", "projects/" + p.id + "/renders", { project: p });
  return j.renders;
}

/** A finished render: the composite (only the roof changed) as a JPEG blob. */
export async function fetchRenderImage(jobId) {
  const p = requireProject();
  const r = await call("GET", "projects/" + p.id + "/renders/" + jobId + "/image", { project: p, raw: true });
  return r.blob();
}

/** Cancel a render that hasn't started yet. */
export async function cancelRender(jobId) {
  const p = requireProject();
  const j = await call("POST", "projects/" + p.id + "/renders/" + jobId + "/cancel", { body: {}, project: p });
  return j.render;
}

/**
 * Add a plan, drawing or extra photo for the roofer (B3): straight to private
 * storage, then checked by the server. Resolves with { id, kind, bytes, addedAt }.
 */
export async function uploadEvidence(file, contentType, onProgress) {
  const p = requireProject();
  const pre = await call("POST", "projects/" + p.id + "/evidence/presign", { body: { contentType, bytes: file.size }, project: p });
  const url = /^https?:/i.test(pre.url) ? pre.url : API_BASE + pre.url;
  await putWithProgress(url, file, pre.headers, onProgress);
  const c = await call("POST", "projects/" + p.id + "/evidence/commit", { body: { uploadId: pre.uploadId }, project: p });
  return c.evidence;
}

export async function listEvidence() {
  const p = currentProject();
  if (!p) return [];
  const j = await call("GET", "projects/" + p.id + "/evidence", { project: p });
  return j.evidence;
}

export async function deleteEvidence(id) {
  const p = requireProject();
  await call("POST", "projects/" + p.id + "/evidence/" + id + "/delete", { body: {}, project: p });
}

/**
 * The estimate step for a look (B2): { status, reason, measurement, products, not_included }.
 * Null when there's no project (a sample house, or photo only).
 */
export async function getEstimate(visualId) {
  const p = currentProject();
  if (!p) return null;
  const j = await call("GET", "projects/" + p.id + "/estimate" + (visualId ? "?visual=" + encodeURIComponent(visualId) : ""), { project: p });
  return j.estimate;
}

/**
 * Send the enquiry about this project's photo (saved before anyone is emailed).
 * Resolves with { status, json } for the shared enquiry form code.
 */
export async function sendProjectEnquiry(payload) {
  const p = requireProject();
  const res = await fetch(API_BASE + "/api/wvroofing/projects/" + p.id + "/enquiry", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + p.token },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (json.error === "project_not_found") {
    // The project has gone: still send the enquiry, just without the photo.
    forgetProject();
    return sendEnquiry(Object.assign({}, payload, { source: "visualiser", includeImages: undefined }));
  }
  return { status: res.status, json };
}
