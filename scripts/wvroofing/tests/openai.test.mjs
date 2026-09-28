// OpenAI image editing: settings checked per model, the request body, cost and errors. (A3)
import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers.mjs";

const openai = load("serverlib/wvroofing/openai.js");
const { VISUALS } = load("serverlib/wvroofing/core.js");

const kind = (fn) => {
  try {
    fn();
  } catch (e) {
    return e.kind;
  }
  return null;
};

test("the default is gpt-image-2.5-sunburst at high quality, and settings come from the environment", () => {
  const d = openai.renderConfig({});
  assert.equal(d.model, "gpt-image-2.5-sunburst");
  assert.equal(d.quality, "high");
  assert.equal(d.autoRender, 1);
  assert.equal(d.budgetUsd, 5);
  const c = openai.renderConfig({ WVR_IMAGE_MODEL: "gpt-image-2", WVR_IMAGE_QUALITY: "medium", WVR_AUTO_RENDER: "0", WVR_OPENAI_TIMEOUT_MS: "999999" });
  assert.equal(c.model, "gpt-image-2");
  assert.equal(c.autoRender, 0, "0 means renders only on tap (and really is 0)");
  assert.equal(c.timeoutMs, 270000, "clamped inside the 300 s function limit");
});

test("parameters are validated per model", () => {
  const ok = (p) => openai.validateParams(p) === true;
  assert.ok(ok({ model: "gpt-image-2.5-sunburst", quality: "high", W: 1536, H: 1024 }));
  assert.ok(ok({ model: "gpt-image-2.5-flare", quality: "xhigh", W: 1008, H: 672 }));
  assert.equal(kind(() => openai.validateParams({ model: "gpt-image-2", quality: "xhigh", W: 1536, H: 1024 })), "not_configured", "xhigh is 2.5-only");
  assert.equal(kind(() => openai.validateParams({ model: "gpt-image-2.5-sunburst", quality: "auto", W: 1536, H: 1024 })), "not_configured", "quality is always explicit");
  assert.equal(kind(() => openai.validateParams({ model: "gpt-image-2.5-sunburst", quality: "high", W: 1000, H: 1000 })), "not_configured", "multiples of 16");
  assert.equal(kind(() => openai.validateParams({ model: "gpt-image-2.5-sunburst", quality: "high", W: 1008, H: 640 })), "not_configured", "below the 655,360 px floor");
  assert.ok(ok({ model: "gpt-image-2.5-sunburst", quality: "high", W: 1024, H: 640 }), "exactly 655,360 px is allowed");
  assert.equal(kind(() => openai.validateParams({ model: "gpt-image-2.5-sunburst", quality: "high", W: 3200, H: 800 })), "not_configured", "wider than 3:1");
  assert.ok(ok({ model: "gpt-image-1.5", quality: "high", W: 1536, H: 1024 }));
  assert.equal(kind(() => openai.validateParams({ model: "gpt-image-1", quality: "high", W: 1440, H: 1024 })), "not_configured", "fixed sizes only");
  assert.equal(kind(() => openai.validateParams({ model: "dall-e-9", quality: "high", W: 1536, H: 1024 })), "not_configured", "unknown models are refused");
});

test("the request body: PNG photo and mask, explicit quality, no input_fidelity for 2.x", () => {
  const base = { key: "k", prompt: "p", image: Buffer.from("png"), mask: Buffer.from("png"), W: 1536, H: 1024, compression: 90, timeoutMs: 1000 };
  const f = openai.buildForm(Object.assign({ model: "gpt-image-2.5-sunburst", quality: "high" }, base));
  assert.equal(f.get("model"), "gpt-image-2.5-sunburst");
  assert.equal(f.get("quality"), "high");
  assert.equal(f.get("size"), "1536x1024");
  assert.equal(f.get("output_format"), "jpeg");
  assert.equal(f.get("image").type, "image/png", "the photo is sent in the mask's format");
  assert.equal(f.get("mask").type, "image/png");
  assert.equal(f.has("input_fidelity"), false);
  assert.equal(openai.buildForm(Object.assign({ model: "gpt-image-2", quality: "medium" }, base)).has("input_fidelity"), false);
  assert.equal(openai.buildForm(Object.assign({ model: "gpt-image-1.5", quality: "high" }, base)).get("input_fidelity"), "high");
});

test("the prompt is the brief's instruction plus the product's fields, and is versioned", () => {
  const p = openai.buildPrompt(VISUALS.get("spanish-slate"));
  assert.match(p, /^Edit the supplied original house photograph\. Replace only the selected visible roof covering/);
  assert.match(p, /Produce a realistic appearance preview, not a survey drawing\./);
  assert.match(p, /Natural Spanish slate/);
  assert.match(openai.PROMPT_VERSION, /^\d{4}-\d{2}-\d{2}\.v2$/);
});

test("costs: a generous reservation, settled from the reported usage", () => {
  const est = openai.estimateCost("gpt-image-2.5-sunburst", "high", 1536, 1024);
  assert.ok(est > 0.09 && est < 0.2, "sunburst high reservation " + est);
  assert.ok(openai.estimateCost("gpt-image-2", "high", 1536, 1024) > est, "gpt-image-2 high costs more");
  const cost = openai.costFromUsage("gpt-image-2.5-sunburst", { input_tokens: 1400, input_tokens_details: { text_tokens: 250, image_tokens: 1150 }, output_tokens: 1367 });
  assert.equal(cost, 0.0515);
  assert.ok(cost < est);
  assert.equal(openai.costFromUsage("gpt-image-2.5-sunburst", null), null);
});

test("the fixture exists only in the test environment", () => {
  assert.equal(openai.adapter({ WVR_ENV: "test" }).name, "fixtureEdit");
  assert.equal(openai.adapter({}).name, "realEdit");
  const before = process.env.WVR_ENV;
  delete process.env.WVR_ENV;
  try {
    assert.throws(() => openai.setFixture({ mode: "ok" }), /only in the test environment/);
  } finally {
    if (before !== undefined) process.env.WVR_ENV = before;
  }
});

/** Run realEdit against a fake fetch. */
async function withFetch(fake, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = fake;
  try {
    return await fn();
  } finally {
    globalThis.fetch = real;
  }
}

const REQ = { key: "sk-test", model: "gpt-image-2.5-sunburst", quality: "high", prompt: "p", image: Buffer.from("x"), mask: Buffer.from("y"), W: 1536, H: 1024, compression: 90, timeoutMs: 5000 };

function reply(status, body, headers) {
  return new Response(JSON.stringify(body), { status, headers: Object.assign({ "content-type": "application/json" }, headers || {}) });
}

test("a successful call returns the image, the usage and the request id", async () => {
  let seen = null;
  const out = await withFetch(
    async (url, init) => {
      seen = { url, init };
      return reply(200, { data: [{ b64_json: Buffer.from("JPEGDATA").toString("base64") }], usage: { output_tokens: 10 } }, { "x-request-id": "req_123" });
    },
    () => openai.realEdit(REQ)
  );
  assert.equal(seen.url, "https://api.openai.com/v1/images/edits");
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers.Authorization, "Bearer sk-test");
  assert.equal(seen.init.body.has("input_fidelity"), false);
  assert.equal(out.jpeg.toString(), "JPEGDATA");
  assert.equal(out.requestId, "req_123");
  assert.deepEqual(out.usage, { output_tokens: 10 });
});

test("answers are classified: timeouts are uncertain, only 5xx is retryable", async () => {
  const cases = [
    [async () => Promise.reject(Object.assign(new Error("t"), { name: "TimeoutError" })), "timeout"],
    [async () => Promise.reject(new TypeError("fetch failed")), "network"],
    [async () => reply(500, { error: { message: "oops" } }), "upstream_5xx"],
    [async () => reply(429, { error: { code: "insufficient_quota", message: "quota" } }), "budget"],
    [async () => reply(429, { error: { code: "rate_limit_exceeded" } }, { "retry-after": "7" }), "rate_limited"],
    [async () => reply(400, { error: { code: "moderation_blocked", message: "rejected by the safety system" } }), "refused"],
    [async () => reply(401, { error: { message: "bad key" } }), "not_configured"],
    [async () => reply(404, { error: { message: "no such model" } }), "not_configured"],
    [async () => reply(400, { error: { message: "size must be..." } }), "bad_request"],
    [async () => reply(200, { data: [] }), "bad_response"],
  ];
  for (const [fake, want] of cases) {
    const err = await withFetch(fake, () => openai.realEdit(REQ).then(() => null, (e) => e));
    assert.equal(err && err.kind, want, "expected " + want);
    if (want === "rate_limited") assert.equal(err.retryAfter, 7);
  }
});
