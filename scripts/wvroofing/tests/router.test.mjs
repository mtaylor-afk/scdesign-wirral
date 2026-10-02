// Router: path resolution, per-route auth, CORS, errors. (A1)
process.env.WVR_ENV = "test";
delete process.env.CRON_SECRET;

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { load, call, fakeReq, SITE } from "./helpers.mjs";

const router = load("serverlib/wvroofing/router.js");
const db = load("serverlib/wvroofing/db.js");
const app = load("api/wvroofing/app.js");

after(() => db.reset());

test("resolvePath uses the original request path", () => {
  assert.deepEqual(router.resolvePath(fakeReq("GET", "/api/wvroofing/render")).path, "render");
  assert.deepEqual(router.resolvePath(fakeReq("GET", "/api/wvroofing/cron/daily/")).path, "cron/daily");
});

test("a caller-supplied ?path= cannot change the route when the original path is present", () => {
  const r = router.resolvePath(fakeReq("GET", "/api/wvroofing/health?path=cron/daily"));
  assert.equal(r.path, "health");
});

test("the function's own path takes the route from one ?path= value only", () => {
  assert.equal(router.resolvePath(fakeReq("GET", "/api/wvroofing/app?path=projects%2Fabc")).path, "projects/abc");
  assert.equal(router.resolvePath(fakeReq("GET", "/api/wvroofing/app?path=a&path=b")).error, "invalid_path");
  assert.equal(router.resolvePath(fakeReq("GET", "/api/wvroofing/app")).error, "not_found");
  assert.equal(router.resolvePath(fakeReq("GET", "/api/wvroofing/app?path=..%2Fsecret")).error, "invalid_path");
  assert.equal(router.resolvePath(fakeReq("GET", "/api/wvroofing/app?path=a%20b")).error, "invalid_path");
});

test("works whichever way Vercel hands over a rewritten request", () => {
  // req.url kept as the original (plus the rewrite's own ?path=): the original path wins
  assert.equal(router.resolvePath(fakeReq("GET", "/api/wvroofing/projects/p1/renders?path=projects/p1/renders")).path, "projects/p1/renders");
  // req.url replaced by the destination: the route comes from ?path= (encoded or not)
  assert.equal(router.resolvePath(fakeReq("GET", "/api/wvroofing/app?path=projects/p1/renders&check=1")).path, "projects/p1/renders");
  assert.equal(router.resolvePath(fakeReq("GET", "/api/wvroofing/app?path=projects%2Fp1%2Frenders")).path, "projects/p1/renders");
  // a caller who also sends ?path= to the destination form gets a 400, never another route
  assert.equal(router.resolvePath(fakeReq("GET", "/api/wvroofing/app?path=health&path=cron/daily")).error, "invalid_path");
});

test("unknown routes are a JSON 404", async () => {
  const r = await call(app, "GET", "/api/wvroofing/nope", { origin: SITE });
  assert.equal(r.status, 404);
  assert.equal(r.json.error, "not_found");
});

test("health: capabilities, environment and schema, with CORS for the site", async () => {
  const r = await call(app, "GET", "/api/wvroofing/health", { origin: SITE });
  assert.equal(r.status, 200);
  assert.equal(r.json.environment, "test");
  assert.equal(r.json.schema.ok, true);
  assert.ok(r.json.schema.version >= 1);
  assert.equal(r.json.capabilities.auto_measurement.state, "disabled");
  assert.equal(r.headers["access-control-allow-origin"], SITE);
  // The set-up checklist names its settings (sessionSecret, adminPassword...) but only ever says yes or no.
  const { setup, ...rest } = r.json;
  assert.ok(setup && Object.keys(setup).length >= 6, "the set-up checklist is there");
  assert.ok(Object.values(setup).every((v) => typeof v === "boolean"), "the set-up checklist holds only true/false");
  assert.ok(!JSON.stringify(rest).match(/sk-|secret|password/i), "health must not leak secrets");
});

test("health refuses other methods with 405 and an Allow header", async () => {
  const r = await call(app, "POST", "/api/wvroofing/health", { origin: SITE, "content-type": "application/json" }, {});
  assert.equal(r.status, 405);
  assert.match(r.headers.allow, /GET/);
});

test("preflight: allowed origin 204, other origin 403 with no CORS headers", async () => {
  const ok = await call(app, "OPTIONS", "/api/wvroofing/health", { origin: SITE });
  assert.equal(ok.status, 204);
  assert.match(ok.headers["access-control-allow-headers"], /Authorization/);
  const bad = await call(app, "OPTIONS", "/api/wvroofing/health", { origin: "https://evil.example" });
  assert.equal(bad.status, 403);
  assert.equal(bad.headers["access-control-allow-origin"], undefined);
});

test("cron: 503 without CRON_SECRET, 401 with a wrong bearer, runs with the right one", async () => {
  const none = await call(app, "GET", "/api/wvroofing/cron/daily", {});
  assert.equal(none.status, 503);
  process.env.CRON_SECRET = "test-cron-secret-123456";
  try {
    const wrong = await call(app, "GET", "/api/wvroofing/cron/daily", { authorization: "Bearer nope" });
    assert.equal(wrong.status, 401);
    const right = await call(app, "GET", "/api/wvroofing/cron/daily", { authorization: "Bearer test-cron-secret-123456" });
    assert.equal(right.status, 200);
    assert.equal(right.json.ran, true);
    // a second run is fine (idempotent)
    const again = await call(app, "GET", "/api/wvroofing/cron/daily", { authorization: "Bearer test-cron-secret-123456" });
    assert.equal(again.status, 200);
  } finally {
    delete process.env.CRON_SECRET;
  }
});

test("the pre-v02 render endpoint is gone (A3): renders are project jobs now", async () => {
  const r = await call(app, "GET", "/api/wvroofing/render", { origin: SITE });
  assert.equal(r.status, 404);
  const post = await call(app, "POST", "/api/wvroofing/render", { origin: SITE, "content-type": "application/json" }, { productId: "welsh-slate" });
  assert.equal(post.status, 404);
});

test("one path, one route per method: GET and POST renders, and 405 lists both", async () => {
  assert.equal(router.match("projects/p1/renders", "GET").route.handler === router.match("projects/p1/renders", "POST").route.handler, false);
  const r = await call(app, "DELETE", "/api/wvroofing/projects/00000000-0000-4000-8000-000000000000/renders", { origin: SITE });
  assert.equal(r.status, 405);
  assert.match(r.headers.allow, /POST/);
  assert.match(r.headers.allow, /GET/);
});
