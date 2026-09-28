// WV Roofing — local development server (no dependencies).
//
//   node scripts/wvroofing/dev-server.mjs [--port 8772] [--fixture <mode>] [--proxy-live]
//
// - Serves public/ exactly as Cloudflare Pages would at /WVROOFING/ (directory
//   -> index.html, trailing-slash redirect), with caching disabled.
// - Routes every /api/wvroofing/* request to the single function
//   api/wvroofing/app.js with the original URL, exactly like the vercel.json
//   rewrite (modules are re-required on every request, so edits apply without
//   a restart; the database and storage modules are kept so their state lives on).
// - Runs as the labelled TEST ENVIRONMENT (WVR_ENV=test): PGlite instead of
//   Neon, a local folder instead of Vercel Blob, a stand-in for OpenAI that
//   paints the product's colour into the marked roof (switched on here, ~1.5 s
//   a render), an in-memory outbox instead of email (enquiry emails are logged
//   to this console, never sent), a street of test addresses at any postcode
//   (Ideal Postcodes' own test postcodes behave as they do there: ID1 KFA not
//   found, ID1 CLIP / ID1 CHOP unavailable) and a drawn stand-in for the
//   satellite view. Production never uses any of these.
// - --fixture <mode> makes the stand-in answer another way, to try the render
//   states in the browser: timeout | network | 5xx | 5xx_once | 429_once |
//   refused | budget | misaligned.
// - --proxy-live forwards /api/wvroofing/* to the deployed API instead.
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
const FIXTURE = arg("fixture", "");
const PROXY_LIVE = !!arg("proxy-live", false);
const LIVE_API = "https://scdesign-wirral.vercel.app";
if (!PROXY_LIVE && !process.env.WVR_ENV) process.env.WVR_ENV = "test";
if (process.env.WVR_ENV === "test") {
  // The test environment's stand-ins (renderer, email outbox) are switched on here,
  // like the owner switches in production.
  if (!process.env.WVR_CAP_IMAGE_GENERATION) process.env.WVR_CAP_IMAGE_GENERATION = "on";
  if (!process.env.WVR_CAP_ENQUIRY_DELIVERY) process.env.WVR_CAP_ENQUIRY_DELIVERY = "on";
  if (!process.env.WVR_CAP_ADDRESS_LOOKUP) process.env.WVR_CAP_ADDRESS_LOOKUP = "on";
  if (!process.env.WVR_CAP_AERIAL_DISPLAY) process.env.WVR_CAP_AERIAL_DISPLAY = "on";
  // Repeated QA runs send several enquiries an hour from one address (the limits have their own tests).
  if (!process.env.WVR_ENQUIRIES_PER_IP_HOURLY) process.env.WVR_ENQUIRIES_PER_IP_HOURLY = "200";
  if (!process.env.WVR_FIXTURE_LATENCY_MS) process.env.WVR_FIXTURE_LATENCY_MS = "1500";
  if (typeof FIXTURE === "string" && FIXTURE) process.env.WVR_FIXTURE_OPENAI = FIXTURE;
  // The operator screen logs in with the test environment's throwaway password
  // (TEST_OPERATOR_PASSWORD in serverlib/wvroofing/auth.js), never a real one.
  if (!process.env.WVR_OPERATOR_PASSWORD_HASH) {
    const auth = require(path.join(repo, "serverlib", "wvroofing", "auth.js"));
    process.env.WVR_OPERATOR_PASSWORD_HASH = auth.hashPassword(auth.TEST_OPERATOR_PASSWORD);
  }
}

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

async function handleApi(req, res) {
  if (PROXY_LIVE) {
    const body = req.method === "POST" ? await readBody(req, 6 * 1024 * 1024) : undefined;
    const headers = { "Content-Type": req.headers["content-type"] || "application/json", Origin: "https://scdesignwirral.co.uk" };
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;
    const r = await fetch(LIVE_API + req.url, { method: req.method, headers, body });
    const buf = Buffer.from(await r.arrayBuffer());
    const h = { "Content-Type": r.headers.get("content-type") || "application/json" };
    const ra = r.headers.get("retry-after");
    if (ra) h["Retry-After"] = ra;
    return send(res, r.status, buf, h);
  }
  // Fresh copy on every request (hot reload), except the modules that hold the
  // PGlite database, the storage driver and the render stand-in's settings,
  // which must survive between requests.
  const keep = [path.join("serverlib", "wvroofing", "db.js"), path.join("serverlib", "wvroofing", "storage.js"), path.join("serverlib", "wvroofing", "openai.js")];
  for (const k of Object.keys(require.cache)) {
    const ours =
      k.includes(path.sep + "api" + path.sep + "wvroofing") ||
      k.includes(path.sep + "serverlib" + path.sep + "wvroofing") ||
      k.endsWith(path.join("WVROOFING", "data", "catalogue.json"));
    if (ours && !keep.some((p) => k.endsWith(p))) delete require.cache[k];
  }
  const handler = require(path.join(repo, "api", "wvroofing", "app.js"));
  await handler(req, res);
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
    if (/^\/api\/wvroofing\//.test(url.pathname)) return await handleApi(req, res);
    if (url.pathname === "/__dev/blob" && process.env.WVR_ENV === "test") return await handleDevBlob(req, res, url);
    if (url.pathname === "/") return send(res, 302, "", { Location: "/WVROOFING/" });
    return serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 500, JSON.stringify({ ok: false, error: "dev_server_error", message: String(err && err.message) }), { "Content-Type": "application/json" });
  }
});

server.listen(PORT, () => {
  console.log(`WV Roofing dev server: http://localhost:${PORT}/WVROOFING/` + (PROXY_LIVE ? " (API proxied to live)" : ""));
  if (process.env.WVR_ENV === "test") {
    // Start the test database now, so the first page load doesn't wait for it.
    require(path.join(repo, "serverlib", "wvroofing", "db.js"))
      .ensureSchema()
      .catch((err) => console.error("test database failed to start:", err.message));
    console.log("TEST ENVIRONMENT: PGlite database, local-folder storage and stand-ins for OpenAI, email, address lookup and the satellite view (never used in production).");
    console.log(`Operator screen: http://localhost:${PORT}/WVROOFING/operator/ (test password: TEST_OPERATOR_PASSWORD in serverlib/wvroofing/auth.js)`);
    if (process.env.WVR_FIXTURE_OPENAI) console.log("Render stand-in mode: " + process.env.WVR_FIXTURE_OPENAI);
  }
});
