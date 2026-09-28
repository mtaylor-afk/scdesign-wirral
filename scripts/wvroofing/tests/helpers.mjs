// Shared helpers for the WV Roofing node:test suites (TEST ENVIRONMENT only).
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const require = createRequire(import.meta.url);

/** Load a repo module (CommonJS) by repo-relative path. */
export function load(rel) {
  return require(path.join(repo, rel));
}

export function fakeReq(method, url, headers, body) {
  const buf = body === undefined ? Buffer.alloc(0) : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
  const req = Readable.from(buf.length ? [buf] : []);
  req.method = method;
  req.url = url;
  req.headers = Object.assign({ "content-length": String(buf.length) }, headers || {});
  req.socket = { remoteAddress: "127.0.0.1" };
  return req;
}

export function fakeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    headersSent: false,
    ended: false,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    getHeader(k) {
      return this.headers[k.toLowerCase()];
    },
    end(b) {
      this.body = b ? String(b) : "";
      this.ended = true;
      this.headersSent = true;
    },
  };
}

/** Call a (req, res) handler and parse the JSON reply. */
export async function call(handler, method, url, headers, body) {
  const res = fakeRes();
  await handler(fakeReq(method, url, headers, body), res);
  let json = null;
  try {
    json = JSON.parse(res.body);
  } catch (e) {
    json = null;
  }
  return { status: res.statusCode, json, headers: res.headers, res };
}

export const SITE = "https://scdesignwirral.co.uk";

/**
 * Remove a suite's temporary storage folder. On Windows a virus scanner can
 * briefly hold a file just written (EBUSY/EPERM), so retry, and never fail the
 * suite over leftover temp files.
 */
export function removeTempDir(dir) {
  if (!dir) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
  } catch (err) {
    console.warn("(temp folder left behind: " + dir + " - " + err.code + ")");
  }
}
