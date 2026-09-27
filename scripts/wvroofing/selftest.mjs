// WV Roofing — self-test for the pure maths, the compositing guarantee, the
// server validators and both API handlers. No browser needed.
//
//   node scripts/wvroofing/selftest.mjs
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const M = await import("../../public/WVROOFING/assets/js/vis/mask-ops.js");
const P = await import("../../public/WVROOFING/assets/js/vis/preview.js");
const C = await import("../../public/WVROOFING/assets/js/vis/composite.js");
const A = await import("../../public/WVROOFING/assets/js/vis/ai-input.js");
const T = await import("../../public/WVROOFING/assets/js/tiles.js");
const S = require(path.join(repo, "serverlib/wvroofing.js"));

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) pass++;
  else fail++;
  console.log((cond ? "PASS " : "FAIL ") + name + (detail !== undefined ? " - " + detail : ""));
}

// deterministic pseudo-random
let seed = 12345;
const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);

// ---------------------------------------------------------------- mask-ops
{
  const w = 20;
  const h = 10;
  const m = new Uint8Array(w * h);
  M.fillPolygon(m, w, h, [[2, 2], [12, 2], [12, 8], [2, 8]], 255);
  const count = m.reduce((s, v) => s + (v ? 1 : 0), 0);
  check("fillPolygon fills an axis-aligned rectangle exactly", count === 60, count);

  const tri = new Uint8Array(100 * 100);
  M.fillPolygon(tri, 100, 100, [[0, 0], [100, 0], [0, 100]], 255);
  const tc = tri.reduce((s, v) => s + (v ? 1 : 0), 0);
  check("fillPolygon triangle area ~ 5000", Math.abs(tc - 5000) < 120, tc);

  const built = M.buildMask([{ mode: "add", pts: [[0, 0], [10, 0], [10, 10], [0, 10]] }, { mode: "sub", pts: [[2, 2], [5, 2], [5, 5], [2, 5]] }], 10, 10);
  check("buildMask add then subtract", built.reduce((s, v) => s + (v ? 1 : 0), 0) === 91, built.reduce((s, v) => s + (v ? 1 : 0), 0));

  const stroke = new Uint8Array(50 * 50);
  M.stampStroke(stroke, 50, 50, [[10, 25], [40, 25]], 3, 255);
  check("stampStroke paints a capsule", stroke[25 * 50 + 25] === 255 && stroke[10 * 50 + 25] === 0);

  // morphology vs naive
  function naive(src, w2, h2, r, isMax) {
    const out = new Uint8Array(w2 * h2);
    for (let y = 0; y < h2; y++)
      for (let x = 0; x < w2; x++) {
        let v = isMax ? 0 : 255;
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            const s = yy < 0 || xx < 0 || yy >= h2 || xx >= w2 ? (isMax ? 0 : 255) : src[yy * w2 + xx];
            v = isMax ? Math.max(v, s) : Math.min(v, s);
          }
        out[y * w2 + x] = v;
      }
    return out;
  }
  let morphOk = true;
  for (let t = 0; t < 12; t++) {
    const w2 = 17 + t * 3;
    const h2 = 11 + t * 2;
    const src = new Uint8Array(w2 * h2);
    for (let i = 0; i < src.length; i++) src[i] = rnd() < 0.3 ? 255 : 0;
    const r = 1 + (t % 5);
    const d1 = M.dilate(src, w2, h2, r);
    const d2 = naive(src, w2, h2, r, true);
    const e1 = M.erode(src, w2, h2, r);
    const e2 = naive(src, w2, h2, r, false);
    for (let i = 0; i < src.length; i++) if (d1[i] !== d2[i] || e1[i] !== e2[i]) morphOk = false;
  }
  check("dilate/erode match a naive implementation", morphOk);

  const flat = new Float32Array(30 * 30).fill(7);
  const bl = M.boxBlur(flat, 30, 30, 4, 3);
  check("boxBlur keeps a constant image constant", bl.every((v) => Math.abs(v - 7) < 1e-4));

  // eaves fit on a roof whose bottom edge slopes 5 degrees
  const W2 = 400;
  const H2 = 300;
  const roof = new Uint8Array(W2 * H2);
  const a = Math.tan((5 * Math.PI) / 180);
  M.fillPolygon(roof, W2, H2, [[50, 200 + 50 * a], [350, 200 + 350 * a], [300, 80], [100, 80]], 255);
  const ev = M.fitEaves(roof, W2, H2);
  check("fitEaves recovers a 5 degree eaves line", Math.abs((ev.angle * 180) / Math.PI - 5) < 1, ((ev.angle * 180) / Math.PI).toFixed(2));

  const ring = M.ringMask(roof, W2, H2, 3, 12);
  let ringBad = 0;
  for (let i = 0; i < roof.length; i++) if (ring[i] && roof[i]) ringBad++;
  check("ringMask never overlaps the roof", ringBad === 0);

  const alpha = M.featherAlpha(roof, W2, H2);
  check("featherAlpha is 1 inside and 0 far outside", alpha[150 * W2 + 200] > 0.99 && alpha[10 * W2 + 10] === 0);
  check("iou of identical masks is 1", M.iou(roof, roof) === 1);
}

// ---------------------------------------------------------------- ai-input sizing
{
  const s1 = A.chooseAiSize(1600, 1145, true);
  check("flex size multiples of 16", s1.W % 16 === 0 && s1.H % 16 === 0, s1.W + "x" + s1.H);
  check("flex size within pixel budget", s1.W * s1.H >= 655360 && s1.W * s1.H <= 1572864 + 16 * 1600, s1.W * s1.H);
  check("flex size keeps aspect", Math.abs(s1.W / s1.H - 1600 / 1145) < 0.02, (s1.W / s1.H).toFixed(3));
  check("flex size accepted by server", S.validSize(s1.W, s1.H, true));
  const s2 = A.chooseAiSize(1280, 1600, true);
  check("flex portrait accepted by server", S.validSize(s2.W, s2.H, true), s2.W + "x" + s2.H);
  const small = A.chooseAiSize(640, 480, true);
  check("flex small photo meets minimum pixels", small.W * small.H >= 655360 && S.validSize(small.W, small.H, true), small.W + "x" + small.H);
  const pano = A.chooseAiSize(4000, 800, true);
  check("flex panorama letterboxed within 3:1", pano.mode === "letterbox" && S.validSize(pano.W, pano.H, true), pano.W + "x" + pano.H);
  const l1 = A.chooseAiSize(1600, 1145, false);
  check("legacy landscape -> 1536x1024", l1.W === 1536 && l1.H === 1024 && l1.mode === "letterbox");
  const l2 = A.chooseAiSize(1280, 1600, false);
  check("legacy portrait -> 1024x1536", l2.W === 1024 && l2.H === 1536);
  check("legacy rect inside canvas", l1.rect.x >= 0 && l1.rect.y >= 0 && l1.rect.x + l1.rect.w <= l1.W && l1.rect.y + l1.rect.h <= l1.H);
}

// ---------------------------------------------------------------- tiles + preview
{
  const cat = JSON.parse(fs.readFileSync(path.join(repo, "public/WVROOFING/data/catalogue.json"), "utf8"));
  check("catalogue has 8 products", cat.products.length === 8);
  const ids = new Set(cat.products.map((p) => p.id));
  check("catalogue ids unique", ids.size === 8);
  let ok = true;
  for (const p of cat.products) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(p.hex[0]) || !/^#[0-9A-Fa-f]{6}$/.test(p.hex[1])) ok = false;
    if (!["slate", "flat", "plain", "roman", "pantile", "granular"].includes(p.pattern.type)) ok = false;
    for (const k of ["material", "profile", "colourWords", "finish", "bond", "courses", "ridge"]) if (!p.prompt[k]) ok = false;
    for (let i = 0; i < 200; i++) {
      const t = T.tileAt(rnd() * 40, rnd() * 40, p.pattern);
      if (!(t.k > 0.2 && t.k < 1.8) || !(t.t >= 0 && t.t < 1)) ok = false;
    }
  }
  check("catalogue entries valid and tile maths bounded", ok);

  const w = 240;
  const h = 180;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = 90 + Math.round(40 * Math.sin(i / 37)) + Math.round(rnd() * 20);
    data[i * 4] = v;
    data[i * 4 + 1] = v - 10;
    data[i * 4 + 2] = v - 20;
    data[i * 4 + 3] = 255;
  }
  const photo = { data, width: w, height: h };
  const mask = M.buildMask([{ mode: "add", pts: [[40, 120], [200, 120], [160, 40], [80, 40]] }], w, h);
  const an = P.analyseRoof(photo, mask);
  check("analyseRoof returns an analysis", !!an);
  const out = P.renderPreview(an, photo, cat.products[0]);
  let outsideChanged = 0;
  let insideChanged = 0;
  for (let i = 0; i < w * h; i++) {
    const same = out[i * 4] === data[i * 4] && out[i * 4 + 1] === data[i * 4 + 1] && out[i * 4 + 2] === data[i * 4 + 2];
    if (an.alpha[i] === 0 && !same) outsideChanged++;
    if (an.alpha[i] > 0.99 && !same) insideChanged++;
  }
  check("preview leaves pixels outside the roof untouched", outsideChanged === 0, outsideChanged);
  check("preview changes the roof", insideChanged > 1000, insideChanged);
}

// ---------------------------------------------------------------- composite
{
  const w = 320;
  const h = 240;
  const orig = new Uint8ClampedArray(w * h * 4);
  // textured, non-periodic scene (random rectangles + noise) so edges exist for alignment
  const field = new Float32Array(w * h).fill(110);
  for (let k = 0; k < 90; k++) {
    const x0 = Math.floor(rnd() * w);
    const y0 = Math.floor(rnd() * h);
    const rw = 6 + Math.floor(rnd() * 40);
    const rh = 6 + Math.floor(rnd() * 30);
    const val = 40 + rnd() * 170;
    for (let y = y0; y < Math.min(h, y0 + rh); y++) for (let x = x0; x < Math.min(w, x0 + rw); x++) field[y * w + x] = val;
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = Math.round(field[y * w + x] + rnd() * 12);
      orig[i] = v;
      orig[i + 1] = (v * 0.9) | 0;
      orig[i + 2] = (v * 0.8) | 0;
      orig[i + 3] = 255;
    }
  const mask = M.buildMask([{ mode: "add", pts: [[90, 150], [230, 150], [200, 70], [120, 70]] }], w, h);
  const DX = 5;
  const DY = -3;
  const render = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.min(w - 1, Math.max(0, x - DX));
      const sy = Math.min(h - 1, Math.max(0, y - DY));
      const i = (y * w + x) * 4;
      const j = (sy * w + sx) * 4;
      const inRoof = mask[sy * w + sx] >= 128;
      for (let c = 0; c < 3; c++) render[i + c] = inRoof ? 40 + c * 30 : Math.min(255, orig[j + c] * 1.06 + 4);
      render[i + 3] = 255;
    }
  const O = { data: orig, width: w, height: h };
  const R = { data: render, width: w, height: h };
  const alpha = M.featherAlpha(mask, w, h);
  const out = C.compositeRender(O, R, mask, alpha, w, h);
  check("alignRender recovers the (5,-3) shift", out.adj.dx === DX && out.adj.dy === DY, out.adj.dx + "," + out.adj.dy);
  check("exposure gain corrects the render", out.adj.gain.every((g) => g < 1 && g > 0.85), out.adj.gain.map((g) => g.toFixed(3)).join("/"));
  let diff = 0;
  for (let i = 0; i < w * h; i++) {
    if (alpha[i] <= 0.002) {
      for (let c = 0; c < 3; c++) if (out.pixels[i * 4 + c] !== orig[i * 4 + c]) diff++;
    }
  }
  check("composite keeps every pixel outside the mask byte-identical", diff === 0, diff);
  let roofChanged = 0;
  for (let i = 0; i < w * h; i++) if (alpha[i] > 0.99 && out.pixels[i * 4] !== orig[i * 4]) roofChanged++;
  check("composite replaces the roof", roofChanged > 3000, roofChanged);
}

// ---------------------------------------------------------------- server validators
{
  const jpg = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#808080" } }).jpeg().toBuffer();
  const js = S.jpegSize(jpg);
  check("jpegSize reads SOF dimensions", js && js.w === 64 && js.h === 48, JSON.stringify(js));
  const prog = await sharp({ create: { width: 33, height: 21, channels: 3, background: "#123456" } }).jpeg({ progressive: true }).toBuffer();
  const pjs = S.jpegSize(prog);
  check("jpegSize handles progressive JPEG", pjs && pjs.w === 33 && pjs.h === 21);
  check("jpegSize rejects a PNG", S.jpegSize(await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } }).png().toBuffer()) === null);

  const w = 97;
  const h = 53;
  const raw = Buffer.alloc(w * h * 4);
  let transparent = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const t = x > 20 && x < 70 && y > 10 && y < 40;
      raw[i] = (x * 5) & 255;
      raw[i + 1] = (y * 7) & 255;
      raw[i + 2] = ((x + y) * 3) & 255;
      raw[i + 3] = t ? 0 : 255;
      if (t) transparent++;
    }
  const png = await sharp(raw, { raw: { width: w, height: h, channels: 4 } }).png({ adaptiveFiltering: true, compressionLevel: 9 }).toBuffer();
  const info = S.pngAlphaInfo(png);
  check("pngAlphaInfo measures transparency through PNG filters", info && info.supported && Math.abs(info.transparentFrac - transparent / (w * h)) < 1e-9, info && info.transparentFrac);
  const rgbPng = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } }).png().toBuffer();
  check("pngAlphaInfo flags a PNG without alpha as unsupported", S.pngAlphaInfo(rgbPng).supported === false);

  const url = "data:image/jpeg;base64," + jpg.toString("base64");
  check("parseDataUrl accepts a JPEG data URL", S.parseDataUrl(url, ["image/jpeg"], 1e6, "image").buf.length === jpg.length);
  let threw = "";
  try {
    S.parseDataUrl("data:image/png;base64,AAAA", ["image/jpeg"], 1e6, "image");
  } catch (e) {
    threw = e.code;
  }
  check("parseDataUrl rejects the wrong type", threw === "invalid_image", threw);
  threw = "";
  try {
    S.parseDataUrl(url, ["image/jpeg"], 100, "image");
  } catch (e) {
    threw = e.code;
  }
  check("parseDataUrl enforces the size cap", threw === "too_large", threw);
  threw = "";
  try {
    S.parseDataUrl("data:image/jpeg;base64,@@@@", ["image/jpeg"], 1e6, "image");
  } catch (e) {
    threw = e.code;
  }
  check("parseDataUrl rejects invalid base64", threw === "invalid_image", threw);

  check("validSize flex rules", S.validSize(1440, 1024, true) && !S.validSize(1441, 1024, true) && !S.validSize(3200, 800, true) && !S.validSize(512, 512, true));
  check("validSize legacy rules", S.validSize(1536, 1024, false) && !S.validSize(1440, 1024, false));

  const p = S.PRODUCTS.get("spanish-slate");
  const prompt = S.buildPrompt(p);
  check("prompt names the product and restricts the edit to the roof", prompt.includes("Natural Spanish slate") && prompt.includes("ONLY") && prompt.includes("Keep unchanged"));

  const mock = S.mockPng(160, 96, "#A1523A");
  const meta = await sharp(mock).metadata();
  check("mockPng is a valid PNG of the right size", meta.width === 160 && meta.height === 96 && meta.format === "png");

  const lim = S.createLimiter(2, 60000);
  check("limiter allows then blocks", lim.hit("a").ok && lim.hit("a").ok && !lim.hit("a").ok && lim.hit("b").ok);
  lim.undo("a");
  lim.undo("a");
  check("limiter undo frees a slot", lim.hit("a").ok);
}

// ---------------------------------------------------------------- handlers
function fakeReq(method, headers, body) {
  const buf = body === undefined ? Buffer.alloc(0) : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
  const req = Readable.from(buf.length ? [buf] : []);
  req.method = method;
  req.url = "/api/wvroofing/x";
  req.headers = Object.assign({ "content-length": String(buf.length) }, headers || {});
  req.socket = { remoteAddress: "127.0.0.1" };
  return req;
}
function fakeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(b) {
      this.body = b ? String(b) : "";
      this.ended = true;
    },
  };
  return res;
}
async function call(handler, method, headers, body) {
  const res = fakeRes();
  await handler(fakeReq(method, headers, body), res);
  let json = null;
  try {
    json = JSON.parse(res.body);
  } catch (e) {
    json = null;
  }
  return { status: res.statusCode, json, headers: res.headers };
}
{
  delete process.env.WVR_OPENAI_API_KEY;
  const render = require(path.join(repo, "api/wvroofing/render.js"));
  const LOCAL = { origin: "http://localhost:8772", "content-type": "application/json" };
  const h = await call(render, "GET", {});
  check("render GET health", h.status === 200 && h.json.ok && h.json.live === false && h.json.products === 8);
  const pre = await call(render, "OPTIONS", { origin: "https://scdesignwirral.co.uk" });
  check("render preflight from the site origin", pre.status === 204 && pre.headers["access-control-allow-origin"] === "https://scdesignwirral.co.uk");
  const evil = await call(render, "POST", { origin: "https://evil.example", "content-type": "application/json" }, {});
  check("render rejects other origins", evil.status === 403 && !evil.headers["access-control-allow-origin"]);
  const bad = await call(render, "POST", LOCAL, { productId: "nope" });
  check("render rejects an unknown product", bad.status === 400 && bad.json.error === "invalid_product");

  const Wd = 1024;
  const Ht = 640;
  const img = await sharp({ create: { width: Wd, height: Ht, channels: 3, background: "#777" } }).jpeg().toBuffer();
  const mraw = Buffer.alloc(Wd * Ht * 4, 255);
  for (let y = 200; y < 400; y++) for (let x = 200; x < 800; x++) mraw[(y * Wd + x) * 4 + 3] = 0;
  const mpng = await sharp(mraw, { raw: { width: Wd, height: Ht, channels: 4 } }).png().toBuffer();
  const payload = {
    productId: "welsh-slate",
    image: "data:image/jpeg;base64," + img.toString("base64"),
    mask: "data:image/png;base64," + mpng.toString("base64"),
    W: Wd,
    H: Ht,
    mock: true,
  };
  const ok = await call(render, "POST", LOCAL, payload);
  check("render mock returns an image from a local origin", ok.status === 200 && ok.json.ok && /^data:image\/png;base64,/.test(ok.json.image), ok.status + " " + (ok.json && ok.json.error));
  const nokey = await call(render, "POST", { origin: "https://scdesignwirral.co.uk", "content-type": "application/json" }, payload);
  check("render without a key refuses live requests", nokey.status === 503 && nokey.json.error === "not_configured", nokey.status);
  const wrongSize = await call(render, "POST", LOCAL, Object.assign({}, payload, { W: 1040 }));
  check("render rejects a size mismatch", wrongSize.status === 400, wrongSize.json && wrongSize.json.error);
  const full = Buffer.alloc(Wd * Ht * 4, 0);
  const fullPng = await sharp(full, { raw: { width: Wd, height: Ht, channels: 4 } }).png().toBuffer();
  const tooBig = await call(render, "POST", LOCAL, Object.assign({}, payload, { mask: "data:image/png;base64," + fullPng.toString("base64") }));
  check("render rejects a mask that edits the whole picture", tooBig.status === 400 && tooBig.json.error === "invalid_mask", tooBig.json && tooBig.json.error);

  const enquiry = require(path.join(repo, "api/wvroofing/enquiry.js"));
  delete process.env.WVR_LEAD_TO;
  const good = { name: "Test Person", email: "test@example.com", consent: true, elapsedMs: 8000, product: "clay-pantile-terracotta" };
  const nc = await call(enquiry, "POST", LOCAL, good);
  check("enquiry reports not_configured without WVR_LEAD_TO", nc.status === 200 && nc.json.ok === false && nc.json.error === "not_configured");
  process.env.WVR_LEAD_TO = "owner@example.com";
  process.env.WVR_MAIL_DRYRUN = "1";
  const sent = await call(enquiry, "POST", LOCAL, Object.assign({}, good, { measure: { planAreaM2: 62.4, pitchDeg: 35, roofAreaM2: 76.2, estimate: { product: "clay-pantile-terracotta", low: 7000, high: 9500 } } }));
  check("enquiry dry-run send succeeds", sent.status === 200 && sent.json.ok === true && sent.json.dryRun === true, JSON.stringify(sent.json));
  const invalid = await call(enquiry, "POST", LOCAL, { name: "X", consent: false });
  check("enquiry validates fields", invalid.status === 400 && invalid.json.fields.includes("consent"));
  const bot = await call(enquiry, "POST", LOCAL, Object.assign({}, good, { company: "spam" }));
  check("enquiry honeypot pretends success", bot.status === 200 && bot.json.ok === true);
  delete process.env.WVR_MAIL_DRYRUN;
}

// ---------------------------------------------------------------- samples
{
  const sj = JSON.parse(fs.readFileSync(path.join(repo, "public/WVROOFING/samples/samples.json"), "utf8"));
  let ok = true;
  for (const s of sj.samples) {
    const f = path.join(repo, "public/WVROOFING/samples", s.src);
    if (!fs.existsSync(f)) ok = false;
    else {
      const m = await sharp(f).metadata();
      if (m.width !== s.w || m.height !== s.h) ok = false;
    }
    for (const sh of s.shapes) for (const [x, y] of sh.pts) if (x < 0 || y < 0 || x > s.w || y > s.h) ok = false;
  }
  check("sample photos exist, sizes match and outlines are in bounds", ok);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
