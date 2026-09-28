// WV Roofing operator screen — talking to the API.
// The session key is kept in sessionStorage: this tab only, gone when it closes.
// Every request sends it as a bearer token (no cookies, so no cross-site forms).
import { API_BASE } from "../config.js";

const KEY = "wvr.operator.session";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let onSignedOut = () => {};
// Fallback when sessionStorage is blocked: the session lasts until this page is left.
let memoryToken = "";

/** Called when the server says the session has ended (401). */
export function whenSignedOut(fn) {
  onSignedOut = fn;
}

export function getToken() {
  try {
    return sessionStorage.getItem(KEY) || memoryToken;
  } catch (e) {
    return memoryToken;
  }
}

export function setToken(token) {
  memoryToken = token || "";
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch (e) {
    /* storage blocked: memoryToken carries it */
  }
}

function token() {
  return getToken();
}

async function send(method, path, body) {
  const headers = {};
  const t = token();
  if (t) headers.Authorization = "Bearer " + t;
  if (method === "POST") headers["Content-Type"] = "application/json";
  try {
    return await fetch(API_BASE + "/api/wvroofing/" + path, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(body || {}) : undefined,
      cache: "no-store",
      credentials: "omit",
    });
  } catch (e) {
    throw new ApiError(0, "network", "The server can't be reached. Check the connection and try again.");
  }
}

function failed(r, j, path) {
  if (r.status === 401 && path !== "operator/login") {
    setToken("");
    onSignedOut((j && j.message) || "Your session has ended. Please log in again.");
  }
  return new ApiError(r.status, (j && j.error) || "server_error", (j && j.message) || "Something went wrong (" + r.status + "). Please try again.");
}

/** A JSON call. Resolves to the reply, or throws an ApiError with a plain message. */
export async function api(method, path, body) {
  const r = await send(method, path, body);
  let j = null;
  try {
    j = await r.json();
  } catch (e) {
    j = null;
  }
  if (!r.ok || !j || j.ok === false) throw failed(r, j, path);
  return j;
}

/** An image the API streams back: an object URL for an <img> (revoke it when done). */
export async function apiImage(path) {
  const r = await send("GET", path);
  if (!r.ok) {
    let j = null;
    try {
      j = await r.json();
    } catch (e) {
      j = null;
    }
    throw failed(r, j, path);
  }
  return URL.createObjectURL(await r.blob());
}
