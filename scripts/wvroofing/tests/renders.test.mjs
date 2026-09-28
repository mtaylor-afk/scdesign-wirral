// Durable render jobs end to end through the router (PGlite, local storage and
// the test environment's OpenAI stand-in). (A3; brief §8, §15, plan D4)
import os from "node:os";
import path from "node:path";
process.env.WVR_ENV = "test";
process.env.WVR_FS_STORAGE_DIR = path.join(os.tmpdir(), "wvr-renders-test-" + process.pid);
process.env.WVR_CAP_IMAGE_GENERATION = "on";
// Generous limits, so each test only meets the limit it is about.
process.env.WVR_UPSTREAM_IPM = "1000";
process.env.WVR_IP_DAILY = "1000";
process.env.WVR_RENDERS_PER_PROJECT_DAILY = "1000";
process.env.WVR_DAILY_CAP = "10000";
process.env.WVR_DAILY_BUDGET_USD = "1000";
process.env.WVR_PROJECTS_PER_IP_DAILY = "1000";
process.env.WVR_DAILY_UPLOADS = "1000";

import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { load, call, SITE, removeTempDir } from "./helpers.mjs";

const app = load("api/wvroofing/app.js");
const db = load("serverlib/wvroofing/db.js");
const jobs = load("serverlib/wvroofing/jobs.js");
const openai = load("serverlib/wvroofing/openai.js");
const images = load("serverlib/wvroofing/images.js");
const { storage } = load("serverlib/wvroofing/storage.js");
const { crc32 } = load("serverlib/wvroofing/core.js");
const sharp = images.sharp();

after(async () => {
  await jobs.drain();
  await db.reset();
  removeTempDir(process.env.WVR_FS_STORAGE_DIR);
});

beforeEach(async () => {
  await jobs.drain();
  openai.setFixture({ mode: "ok", latencyMs: 0 });
  await db.query("DELETE FROM wvr_leases WHERE name = 'openai_blocked'");
});

function api(method, route, { token, body, origin = SITE } = {}) {
  const h = { origin };
  if (body !== undefined) h["content-type"] = "application/json";
  if (token) h.authorization = "Bearer " + token;
  return call(app, method, "/api/wvroofing/" + route, h, body);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Outline PNG (alpha 0 = roof): a band from x0 to x1 (fractions of the width). */
function outline(w, h, x0, x1) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w * 4 + 1) + 1 + x * 4 + 3] = x >= w * x0 && x < w * x1 && y > h * 0.2 && y < h * 0.6 ? 0 : 255;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  return "data:image/png;base64," + png.toString("base64");
}

async function photoJpeg(w = 900, h = 600) {
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 13 + ((i / 2999) | 0) * 7) & 255;
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();
}

/** A project with a photo, a saved outline and (by default) consent to renders. */
async function readyProject({ consent = true } = {}) {
  const r = await api("POST", "projects", { body: { noticeShown: true, consentAi: consent } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const p = r.json;
  const jpg = await photoJpeg();
  const pre = await api("POST", "projects/" + p.id + "/photo/presign", { token: p.token, body: { contentType: "image/jpeg", bytes: jpg.length } });
  await storage().put(new URL(pre.json.url, "http://localhost").searchParams.get("path"), jpg, "image/jpeg");
  const c = await api("POST", "projects/" + p.id + "/photo/commit", { token: p.token, body: { uploadId: pre.json.uploadId } });
  assert.equal(c.status, 200, JSON.stringify(c.json));
  await saveOutline(p, 0.2, 0.6);
  return p;
}

async function saveOutline(p, x0, x1) {
  const m = await api("POST", "projects/" + p.id + "/mask", { token: p.token, body: { png: outline(900, 600, x0, x1), shapes: [{ mode: "add", pts: [[180, 120], [540, 120], [540, 360]] }], displayW: 900, displayH: 600 } });
  assert.equal(m.status, 200, JSON.stringify(m.json));
  return m.json.mask;
}

let keyN = 0;
const key = () => "testkey" + String(++keyN).padStart(6, "0");

function submit(p, visualIds, k = key()) {
  return api("POST", "projects/" + p.id + "/renders", { token: p.token, body: { visualIds, idempotencyKey: k } });
}

async function list(p) {
  const r = await api("GET", "projects/" + p.id + "/renders", { token: p.token });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json.renders;
}

async function row(id) {
  return (await db.query("SELECT * FROM wvr_jobs WHERE id = $1", [id])).rows[0];
}

/**
 * The provider's per-minute window, made deterministic: allow `max` calls in the
 * current minute and none in the next two, so nothing slips through if a minute
 * boundary passes mid-test. max = 0 holds every render in the queue.
 */
async function limitUpstream(max) {
  process.env.WVR_UPSTREAM_IPM = String(Math.max(1, max));
  await db.query("DELETE FROM wvr_rate_limits WHERE scope = 'upstream_openai'");
  const ms = Date.now() % 60000;
  if (ms > 50000) await new Promise((r) => setTimeout(r, 60000 - ms + 50)); // start well inside a minute
  const start = Math.floor(Date.now() / 60000) * 60000;
  const rows = [[start, max ? 0 : 1000000], [start + 60000, 1000000], [start + 120000, 1000000]];
  for (const [t, n] of rows) await db.query("INSERT INTO wvr_rate_limits (scope, key, window_start, count) VALUES ('upstream_openai', 'global', $1, $2)", [new Date(t).toISOString(), n]);
}

async function unlimitUpstream() {
  process.env.WVR_UPSTREAM_IPM = "1000";
  await db.query("DELETE FROM wvr_rate_limits WHERE scope = 'upstream_openai'");
}

async function budget() {
  const { rows } = await db.query("SELECT reserved_usd, spent_usd FROM wvr_budget_days WHERE day = (now() AT TIME ZONE 'UTC')::date");
  return rows[0] ? { reserved: Number(rows[0].reserved_usd), spent: Number(rows[0].spent_usd) } : { reserved: 0, spent: 0 };
}

test("renders need the customer's OK, a saved outline and the capability switched on", async () => {
  const noConsent = await readyProject({ consent: false });
  const r = await submit(noConsent, ["welsh-slate"]);
  assert.equal(r.status, 409);
  assert.equal(r.json.error, "consent_required");

  const bare = (await api("POST", "projects", { body: { consentAi: true } })).json;
  assert.equal((await submit(bare, ["welsh-slate"])).status, 409, "no photo or outline yet");

  const p = await readyProject();
  assert.equal((await submit(p, ["not-a-roof"])).status, 400);
  delete process.env.WVR_CAP_IMAGE_GENERATION;
  try {
    const off = await submit(p, ["welsh-slate"]);
    assert.equal(off.status, 503);
    assert.equal(off.json.error, "not_configured");
  } finally {
    process.env.WVR_CAP_IMAGE_GENERATION = "on";
  }
});

test("a render: 202 at once, finished in the background, composite served to its project only", async () => {
  const p = await readyProject();
  const b0 = await budget();
  const r = await submit(p, ["welsh-slate"]);
  assert.equal(r.status, 202, JSON.stringify(r.json));
  assert.equal(r.json.renders.length, 1);
  const id = r.json.renders[0].id;
  assert.ok(["queued", "running"].includes(r.json.renders[0].status));
  await jobs.drain();
  const [j] = await list(p);
  assert.equal(j.status, "succeeded");
  assert.equal(j.image, true);
  assert.equal(typeof j.seam, "number");
  const saved = await row(id);
  assert.equal(saved.prompt_version, openai.PROMPT_VERSION);
  assert.equal(saved.model, "gpt-image-2.5-sunburst");
  assert.equal(saved.quality, "high");
  assert.match(saved.size, /^\d+x\d+$/);
  assert.equal(saved.request_id, "fixture-1");
  assert.equal(Number(saved.cost_settled_usd), 0.0515, "settled from the reported usage");
  const b1 = await budget();
  assert.equal(Math.round((b1.reserved - b0.reserved) * 1e4), 0, "the reservation is released once settled");
  assert.equal(Math.round((b1.spent - b0.spent) * 1e4), 515);
  const { rows: calls } = await db.query("SELECT * FROM wvr_provider_calls WHERE job_id = $1", [id]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].status, "ok");

  const img = await api("GET", "projects/" + p.id + "/renders/" + id + "/image", { token: p.token });
  assert.equal(img.status, 200);
  assert.equal(img.headers["content-type"], "image/jpeg");
  assert.match(img.headers["cache-control"], /no-store/);
  const other = await readyProject();
  assert.equal((await api("GET", "projects/" + other.id + "/renders/" + id + "/image", { token: other.token })).status, 404, "another project can't see it");
  assert.equal((await api("GET", "projects/" + p.id + "/renders/" + id + "/image")).status, 401);
  const files = await storage().list("projects/" + p.id + "/renders/");
  assert.equal(files.length, 2, "the model's answer and the composite");
});

test("two identical submits make one job; a repeat tap for the same roof never pays twice", async () => {
  const p = await readyProject();
  openai.setFixture({ mode: "ok", latencyMs: 30 });
  const k = key();
  const a = await submit(p, ["spanish-slate"], k);
  const b = await submit(p, ["spanish-slate"], k);
  assert.equal(a.json.renders[0].id, b.json.renders[0].id);
  const c = await submit(p, ["spanish-slate"]); // a new key, but the same roof is already on its way
  assert.equal(c.json.renders[0].id, a.json.renders[0].id);
  await jobs.drain();
  const d = await submit(p, ["spanish-slate"]); // ...or already done
  assert.equal(d.json.renders[0].id, a.json.renders[0].id);
  assert.equal(openai.fixtureCalls(), 1);
  const { rows } = await db.query("SELECT count(*)::int AS n FROM wvr_jobs WHERE project_id = $1", [p.id]);
  assert.equal(rows[0].n, 1);
});

test("a new outline while a render is running: the late result is quarantined, never shown", async () => {
  const p = await readyProject();
  openai.setFixture({
    mode: "ok",
    hook: async () => {
      await saveOutline(p, 0.3, 0.7); // the customer redraws while OpenAI is working
    },
  });
  const r = await submit(p, ["welsh-slate"]);
  const id = r.json.renders[0].id;
  await jobs.drain();
  const j = await row(id);
  assert.equal(j.status, "superseded");
  assert.equal(j.quarantined, true);
  assert.ok(Number(j.cost_settled_usd) > 0, "it was paid for, so it is still costed");
  assert.equal((await list(p)).length, 0, "not listed for the new outline");
  assert.equal((await api("GET", "projects/" + p.id + "/renders/" + id + "/image", { token: p.token })).status, 404);
});

test("a new outline supersedes renders still queued, and releases their budget", async () => {
  const p = await readyProject();
  await limitUpstream(0);
  try {
    const r = await submit(p, ["welsh-slate", "spanish-slate"]);
    assert.equal(r.status, 202);
    await jobs.drain();
    for (const x of r.json.renders) assert.equal((await row(x.id)).status, "queued", "held back by the provider's rate limit");
    const before = await budget();
    await saveOutline(p, 0.25, 0.65);
    for (const x of r.json.renders) assert.equal((await row(x.id)).status, "superseded");
    assert.ok((await budget()).reserved < before.reserved, "their reservations were released");
    assert.equal(openai.fixtureCalls(), 0);
  } finally {
    await unlimitUpstream();
  }
});

test("the provider's rate limit: extra renders wait in the queue and are never sent early", async () => {
  const p = await readyProject();
  await limitUpstream(1);
  let r;
  try {
    r = await submit(p, ["clay-pantile-terracotta", "welsh-slate"]);
    await jobs.drain();
    assert.equal(openai.fixtureCalls(), 1, "one call allowed in this minute");
    const ls = await list(p);
    await jobs.drain();
    const waiting = ls.find((x) => x.status === "queued");
    assert.ok(waiting && waiting.waitingUntil, "the other waits, and says until when");
    assert.equal(ls.filter((x) => x.status === "succeeded").length, 1);
    assert.equal(openai.fixtureCalls(), 1, "a poll doesn't send it early either");
  } finally {
    await unlimitUpstream();
  }
  // once the window allows it, the next poll sends it
  await db.query("UPDATE wvr_jobs SET run_after = now() WHERE project_id = $1 AND status = 'queued'", [p.id]);
  await list(p);
  await jobs.drain();
  assert.equal((await list(p)).filter((x) => x.status === "succeeded").length, 2);
  assert.equal(r.json.renders.length, 2);
});

test("a timeout is 'uncertain': kept reserved, never retried automatically; Try again makes a new job", async () => {
  const p = await readyProject();
  openai.setFixture({ mode: "timeout" });
  const r = await submit(p, ["welsh-slate"]);
  const id = r.json.renders[0].id;
  await jobs.drain();
  const j = await row(id);
  assert.equal(j.status, "uncertain");
  assert.equal(j.cost_settled_usd, null);
  assert.equal(openai.fixtureCalls(), 1, "no automatic repeat");
  const [shown] = await list(p);
  assert.equal(shown.status, "uncertain");
  assert.match(shown.error.message, /Try again to start a new one/);
  const { rows } = await db.query("SELECT count(*)::int AS n FROM wvr_jobs WHERE project_id = $1 AND status = 'queued'", [p.id]);
  assert.equal(rows[0].n, 0);
  openai.setFixture({ mode: "ok" });
  const again = await submit(p, ["welsh-slate"]);
  assert.notEqual(again.json.renders[0].id, id, "a new job, as the copy says");
  await jobs.drain();
  assert.equal((await row(again.json.renders[0].id)).status, "succeeded");
});

test("an explicit server error is retried once; a second one fails the job", async () => {
  const p = await readyProject();
  openai.setFixture({ mode: "5xx_once" });
  const r = await submit(p, ["welsh-slate"]);
  const id = r.json.renders[0].id;
  await jobs.drain();
  let j = await row(id);
  assert.equal(j.status, "queued", "back in the queue after the 500");
  assert.ok(new Date(j.run_after).getTime() > Date.now());
  await db.query("UPDATE wvr_jobs SET run_after = now() WHERE id = $1", [id]);
  await list(p); // a poll restarts the queue
  await jobs.drain();
  j = await row(id);
  assert.equal(j.status, "succeeded");
  assert.equal(j.attempt, 2);
  assert.equal(openai.fixtureCalls(), 2);

  const q = await readyProject();
  openai.setFixture({ mode: "5xx" });
  const r2 = await submit(q, ["welsh-slate"]);
  const id2 = r2.json.renders[0].id;
  await jobs.drain();
  await db.query("UPDATE wvr_jobs SET run_after = now() WHERE id = $1", [id2]);
  await list(q);
  await jobs.drain();
  const j2 = await row(id2);
  assert.equal(j2.status, "failed");
  assert.equal(j2.error_code, "upstream");
  assert.equal(openai.fixtureCalls(), 2, "exactly one retry");
});

test("expired leases: never sent -> queued again; sent -> uncertain", async () => {
  const p = await readyProject();
  // Two jobs abandoned mid-way by a crashed invocation.
  await limitUpstream(0);
  const r = await submit(p, ["welsh-slate", "spanish-slate"]);
  await jobs.drain();
  await unlimitUpstream();
  const [a, b] = r.json.renders.map((x) => x.id);
  await db.query("UPDATE wvr_jobs SET status = 'running', lease_until = now() - interval '1 second', called_at = now() - interval '5 minutes', lease_token = 'dead' WHERE id = $1", [a]);
  await db.query("UPDATE wvr_jobs SET status = 'running', lease_until = now() - interval '1 second', called_at = NULL, lease_token = 'dead', run_after = NULL WHERE id = $1", [b]);
  await db.query("DELETE FROM wvr_leases WHERE name = $1", ["render:" + p.id]);
  await list(p); // reconcile
  assert.equal((await row(a)).status, "uncertain");
  await jobs.drain();
  assert.equal((await row(b)).status, "succeeded", "picked up again and finished");
});

test("budget: refused before anything is sent when the day's ceiling is reached", async () => {
  const p = await readyProject();
  process.env.WVR_DAILY_BUDGET_USD = "0.01";
  try {
    const r = await submit(p, ["welsh-slate"]);
    assert.equal(r.status, 503);
    assert.equal(r.json.error, "budget");
    assert.equal(openai.fixtureCalls(), 0);
    const { rows } = await db.query("SELECT count(*)::int AS n FROM wvr_jobs WHERE project_id = $1", [p.id]);
    assert.equal(rows[0].n, 0);
    const h = await api("GET", "health");
    assert.equal(h.json.renders.budget, "limited");
  } finally {
    process.env.WVR_DAILY_BUDGET_USD = "1000";
  }
});

test("OpenAI says the budget is spent: the job fails and renders pause for everyone", async () => {
  const p = await readyProject();
  openai.setFixture({ mode: "budget" });
  const r = await submit(p, ["welsh-slate"]);
  await jobs.drain();
  const j = await row(r.json.renders[0].id);
  assert.equal(j.status, "failed");
  assert.equal(j.error_code, "budget");
  const again = await submit(await readyProject(), ["spanish-slate"]);
  assert.equal(again.status, 503);
  assert.equal(again.json.error, "budget");
});

test("a refused photo fails without a retry; a misaligned render is not used", async () => {
  const p = await readyProject();
  openai.setFixture({ mode: "refused" });
  const r = await submit(p, ["welsh-slate"]);
  await jobs.drain();
  const j = await row(r.json.renders[0].id);
  assert.equal(j.status, "failed");
  assert.equal(j.error_code, "refused");
  assert.equal(openai.fixtureCalls(), 1);

  const q = await readyProject();
  openai.setFixture({ mode: "misaligned" });
  const r2 = await submit(q, ["welsh-slate"]);
  await jobs.drain();
  const j2 = await row(r2.json.renders[0].id);
  assert.equal(j2.status, "failed");
  assert.equal(j2.error_code, "misaligned");
  assert.ok(j2.raw_path && !j2.composite_path, "the model's answer is kept for the operator, no composite");
  assert.ok(Number(j2.qa.seam) > Number(j2.qa.maxSeam));
});

test("queued renders can be cancelled (budget released); running or finished ones can't", async () => {
  const p = await readyProject();
  await limitUpstream(0);
  try {
    const r = await submit(p, ["welsh-slate", "spanish-slate"]);
    await jobs.drain();
    const [a, b] = r.json.renders;
    const before = await budget();
    const c = await api("POST", "projects/" + p.id + "/renders/" + a.id + "/cancel", { token: p.token, body: {} });
    assert.equal(c.status, 200);
    assert.equal(c.json.render.status, "cancelled");
    assert.ok((await budget()).reserved < before.reserved);
    await db.query("UPDATE wvr_jobs SET status = 'running', lease_until = now() + interval '5 minutes', lease_token = 'someone' WHERE id = $1", [b.id]);
    const running = await api("POST", "projects/" + p.id + "/renders/" + b.id + "/cancel", { token: p.token, body: {} });
    assert.equal(running.status, 409);
    assert.match(running.json.message, /already being made/);
    await db.query("UPDATE wvr_jobs SET status = 'succeeded', lease_until = NULL WHERE id = $1", [b.id]);
    assert.equal((await api("POST", "projects/" + p.id + "/renders/" + b.id + "/cancel", { token: p.token, body: {} })).status, 409);
  } finally {
    await unlimitUpstream();
  }
});

test("withdrawing consent cancels renders not yet sent", async () => {
  const p = await readyProject();
  await limitUpstream(0);
  try {
    await submit(p, ["welsh-slate", "spanish-slate"]);
    await jobs.drain();
    await api("POST", "projects/" + p.id + "/consent", { token: p.token, body: { ai: false } });
    const ls = await list(p);
    assert.equal(ls.filter((x) => x.status === "queued").length, 0);
    assert.equal(ls.length, 2);
    for (const x of ls) assert.equal(x.error.code, "consent_withdrawn");
    assert.equal(openai.fixtureCalls(), 0);
  } finally {
    await unlimitUpstream();
  }
});

test("deleting the project mid-render leaves no files behind", async () => {
  const p = await readyProject();
  openai.setFixture({
    mode: "ok",
    hook: async () => {
      await api("POST", "projects/" + p.id + "/delete", { token: p.token, body: {} });
    },
  });
  await submit(p, ["welsh-slate"]);
  await jobs.drain();
  assert.deepEqual(await storage().list("projects/" + p.id + "/"), []);
});

test("per-project pending cap and daily limits apply to new renders only", async () => {
  const p = await readyProject();
  process.env.WVR_MAX_CONCURRENT = "1";
  try {
    const r = await submit(p, ["welsh-slate", "spanish-slate"]);
    assert.equal(r.status, 429, "only one render may be pending");
    assert.equal((await db.query("SELECT count(*)::int AS n FROM wvr_jobs WHERE project_id = $1", [p.id])).rows[0].n, 0, "all or nothing");
  } finally {
    delete process.env.WVR_MAX_CONCURRENT;
  }
  process.env.WVR_RENDERS_PER_PROJECT_DAILY = "1";
  try {
    const q = await readyProject();
    assert.equal((await submit(q, ["welsh-slate"])).status, 202);
    await jobs.drain();
    assert.equal((await submit(q, ["welsh-slate"])).status, 202, "the same roof again is not a new render");
    const third = await submit(q, ["spanish-slate"]);
    assert.equal(third.status, 429);
  } finally {
    process.env.WVR_RENDERS_PER_PROJECT_DAILY = "1000";
  }
});

test("the daily sweep: stale queued renders dropped, stranded ones worked", async () => {
  const p = await readyProject();
  await limitUpstream(0);
  const r = await submit(p, ["welsh-slate", "spanish-slate"]);
  await jobs.drain();
  await unlimitUpstream();
  const q = await readyProject();
  const old = await submit(q, ["welsh-slate"]);
  await jobs.drain();
  // q's render is done; make a stale queued one for q, and leave p's second one stranded
  await db.query("UPDATE wvr_jobs SET status = 'queued', created_at = now() - interval '25 hours', composite_path = NULL WHERE id = $1", [old.json.renders[0].id]);
  const stranded = r.json.renders.find((x) => x.visualId === "spanish-slate").id;
  await db.query("UPDATE wvr_jobs SET run_after = now() WHERE id = $1", [stranded]);
  process.env.CRON_SECRET = "test-cron-secret-123456";
  try {
    const c = await call(app, "GET", "/api/wvroofing/cron/daily", { authorization: "Bearer test-cron-secret-123456" });
    assert.equal(c.status, 200, JSON.stringify(c.json));
    assert.ok(c.json.detail.staleFailed >= 1);
    assert.ok(c.json.detail.rendersRun >= 1);
  } finally {
    delete process.env.CRON_SECRET;
  }
  assert.equal((await row(old.json.renders[0].id)).error_code, "stale");
  assert.equal((await row(stranded)).status, "succeeded");
});

test("health reports the render settings and that the compositing maths loads", async () => {
  const h = await api("GET", "health");
  assert.equal(h.json.capabilities.image_generation.state, "enabled");
  assert.equal(h.json.renders.model, "gpt-image-2.5-sunburst");
  assert.equal(h.json.renders.autoRender, 1);
  assert.equal(h.json.renders.renderer, "ready");
  assert.equal(h.json.renders.budget, "ok");
});
