// WV Roofing Roof Visualiser — the customer's project on the server (A2).
//
// The project token is kept in sessionStorage: it survives a refresh and the
// tab being restored, and disappears when the tab is closed. It is never put
// in localStorage (this origin is shared with another site) and never in a URL.
import { API_BASE } from "../config.js";

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
    if (o.project && (r.status === 401 || (r.status === 404 && code === "not_found" && o.projectRoute))) forgetProject();
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
  const j = await call("POST", "projects", { body: { noticeShown: true, consentAi: !!(opts && opts.consentAi) } });
  const p = { id: j.id, token: j.token, expiresAt: j.expiresAt };
  writeStore(p);
  return p;
}

export async function getProject() {
  const p = currentProject();
  if (!p) return null;
  const j = await call("GET", "projects/" + p.id, { project: p, projectRoute: true });
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
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ClientError(xhr.status, "upload_failed", "The photo didn't upload. Please try again.")));
    xhr.onerror = () => reject(new ClientError(0, "network", "The photo didn't upload. Check your connection and try again."));
    xhr.send(file);
  });
}

/**
 * Upload a photo straight to private storage, then have the server check and
 * prepare it. Resolves with { id, w, h, origW, origH, warnings }.
 */
export async function uploadPhoto(file, kind, onProgress) {
  const p = currentProject();
  if (!p) throw new ClientError(0, "no_project", "Please choose your photo again.");
  const contentType = kind === "png" ? "image/png" : "image/jpeg";
  const pre = await call("POST", "projects/" + p.id + "/photo/presign", { body: { contentType, bytes: file.size }, project: p });
  const url = /^https?:/i.test(pre.url) ? pre.url : API_BASE + pre.url;
  await putWithProgress(url, file, pre.headers, onProgress);
  const c = await call("POST", "projects/" + p.id + "/photo/commit", { body: { uploadId: pre.uploadId }, project: p });
  return c.photo;
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
