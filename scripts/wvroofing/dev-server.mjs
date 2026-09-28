// WV Roofing — local development server (no dependencies).
//
//   node scripts/wvroofing/dev-server.mjs [--port 8772] [--simulate 429|503] [--proxy-live]
//
// - Serves public/ exactly as Cloudflare Pages would at /WVROOFING/ (directory
//   -> index.html, trailing-slash redirect), with caching disabled.
// - Routes every /api/wvroofing/* request to the single function
//   api/wvroofing/app.js with the original URL, exactly like the vercel.json
//   rewrite (modules are re-required on every request, so edits apply without
//   a restart; the database and storage modules are kept so their state lives on).
// - Runs as the labelled TEST ENVIRONMENT (WVR_ENV=test): PGlite instead of
//   Neon, a local folder instead of Vercel Blob, fixture adapters. Production
//   never uses any of these.
// - --simulate 429|503 makes every other render request fail that way, to test
//   the client's queue/back-off and banners.
// - --proxy-live forwards /api/wvroofing/* to the deployed API instead (used to
//   pre-render the sample houses once photo-real rendering is live).
// - POST /__dev/save writes a pre-rendered sample image under
//   public/WVROOFING/samples/renders/ (localhost only).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const publicDir = path.join(repo, "public");
const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf("--" + name);
  if (i === -1) return dflt;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : true;
};
const PORT = Number(arg("port", process.env.PORT || 8772));
const SIMULATE = arg("simulate", "");
const PROXY_LIVE = !!arg("proxy-live", false);
const LIVE_API = "https://scdesign-wirral.vercel.app";
if (!PROXY_LIVE && !process.env.WVR_ENV) process.env.WVR_ENV = "test";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

let simCounter = 0;

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ "Cache-Control": "no-store" }, headers || {}));
  res.end(body);
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new Error("too_large");
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

async function handleApi(req, res, name) {
  if (PROXY_LIVE) {
    const body = req.method === "POST" ? await readBody(req, 6 * 1024 * 1024) : undefined;
    const r = await fetch(LIVE_API + req.url, {
      method: req.method,
      headers: { "Content-Type": req.headers["content-type"] || "application/json", Origin: "https://scdesignwirral.co.uk" },
      body,
    });
    const buf = Buffer.from(await r.arrayBuffer());
    const h = { "Content-Type": r.headers.get("content-type") || "application/json" };
    const ra = r.headers.get("retry-after");
    if (ra) h["Retry-After"] = ra;
    return send(res, r.status, buf, h);
  }
  if (SIMULATE && name === "render" && req.method === "POST") {
    simCounter++;
    if (simCounter % 2 === 1) {
      await readBody(req, 8 * 1024 * 1024).catch(() => null);
      if (SIMULATE === "429") {
        return send(res, 429, JSON.stringify({ ok: false, error: "rate_limited", scope: "upstream", message: "Simulated rate limit" }), {
          "Content-Type": "application/json",
          "Retry-After": "3",
        });
      }
      return send(res, 503, JSON.stringify({ ok: false, error: "budget", message: "Simulated budget stop" }), {
        "Content-Type": "application/json",
      });
    }
  }
  // Fresh copy on every request (hot reload), except the modules that hold the
  // PGlite database and the storage driver, which must survive between requests.
  const keep = [path.join("serverlib", "wvroofing", "db.js"), path.join("serverlib", "wvroofing", "storage.js")];
  for (const k of Object.keys(require.cache)) {
    const ours = k.includes(path.sep + "api" + path.sep + "wvroofing") || k.includes(path.sep + "serverlib" + path.sep + "wvroofing");
    if (ours && !keep.some((p) => k.endsWith(p))) delete require.cache[k];
  }
  const handler = require(path.join(repo, "api", "wvroofing", "app.js"));
  await handler(req, res);
}

async function handleSave(req, res) {
  const body = JSON.parse((await readBody(req, 12 * 1024 * 1024)).toString("utf8"));
  const rel = String(body.path || "");
  if (!/^samples\/renders\/[a-z0-9-]+\/[a-z0-9-]+\.(jpg|png|json)$/.test(rel)) {
    return send(res, 400, "bad path");
  }
  const out = path.join(publicDir, "WVROOFING", rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (rel.endsWith(".json")) {
    fs.writeFileSync(out, JSON.stringify(body.data, null, 2) + "\n");
  } else {
    const m = /^data:image\/(?:jpeg|png);base64,(.+)$/.exec(String(body.dataUrl || ""));
    if (!m) return send(res, 400, "bad data url");
    fs.writeFileSync(out, Buffer.from(m[1], "base64"));
  }
  return send(res, 200, JSON.stringify({ ok: true, path: rel }), { "Content-Type": "application/json" });
}

// Cloudflare-style public/_headers: every matching rule's headers are sent
// (values for a repeated header are appended), so the CSP is exercised locally.
function headersFor(urlPath) {
  const out = {};
  let rule = null;
  for (const line of fs.readFileSync(path.join(publicDir, "_headers"), "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      const p = line.trim();
      rule = p.endsWith("/*") ? urlPath.startsWith(p.slice(0, -1)) : urlPath === p || urlPath === p + "/";
      continue;
    }
    const m = /^\s+([^:]+):\s*(.*)$/.exec(line);
    if (rule && m) {
      const k = m[1].trim();
      out[k] = out[k] ? out[k] + ", " + m[2].trim() : m[2].trim();
    }
  }
  delete out["Strict-Transport-Security"]; // meaningless on http://localhost
  return out;
}

// TEST ENVIRONMENT stand-in for Vercel Blob's presigned URLs (local-folder storage).
async function handleDevBlob(req, res, url) {
  const op = url.searchParams.get("op");
  const p = url.searchParams.get("path") || "";
  const until = Number(url.searchParams.get("until"));
  if (!p || !until || Date.now() > until) return send(res, 403, "expired or invalid link");
  const { storage } = require(path.join(repo, "serverlib", "wvroofing", "storage.js"));
  if (op === "put" && req.method === "PUT") {
    const types = (url.searchParams.get("types") || "").split(",");
    const max = Number(url.searchParams.get("max"));
    const type = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (!types.includes(type)) return send(res, 415, "content type not allowed");
    const body = await readBody(req, max).catch(() => null);
    if (!body) return send(res, 413, "too large");
    await storage().put(p, body, type);
    return send(res, 200, "{}", { "Content-Type": "application/json" });
  }
  if (op === "get" && req.method === "GET") {
    const obj = await storage().get(p);
    if (!obj) return send(res, 404, "not found");
    res.writeHead(200, { "Content-Type": obj.contentType, "Cache-Control": "no-store" });
    obj.stream.pipe(res);
    return;
  }
  return send(res, 405, "method not allowed");
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel.includes("\0")) return send(res, 400, "bad path");
  let file = path.join(publicDir, rel);
  if (!file.startsWith(publicDir)) return send(res, 403, "forbidden");
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!rel.endsWith("/")) return send(res, 301, "", { Location: rel + "/" });
    file = path.join(file, "index.html");
  }
  if (!fs.existsSync(file)) return send(res, 404, "Not found: " + rel, { "Content-Type": "text/plain; charset=utf-8" });
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, Object.assign({ "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" }, headersFor(rel)));
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const m = /^\/api\/wvroofing\/(.*?)\/?$/.exec(url.pathname);
    if (m) return await handleApi(req, res, m[1]);
    if (url.pathname === "/__dev/save" && req.method === "POST") return await handleSave(req, res);
    if (url.pathname === "/__dev/blob" && process.env.WVR_ENV === "test") return await handleDevBlob(req, res, url);
    if (url.pathname === "/") return send(res, 302, "", { Location: "/WVROOFING/" });
    return serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 500, JSON.stringify({ ok: false, error: "dev_server_error", message: String(err && err.message) }), { "Content-Type": "application/json" });
  }
});

server.listen(PORT, () => {
  console.log(`WV Roofing dev server: http://localhost:${PORT}/WVROOFING/` + (SIMULATE ? ` (simulating ${SIMULATE})` : "") + (PROXY_LIVE ? " (API proxied to live)" : ""));
  if (process.env.WVR_ENV === "test") console.log("TEST ENVIRONMENT: PGlite database, local-folder storage and fixture adapters (never used in production).");
});
