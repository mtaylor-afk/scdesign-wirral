// The Projects CMS with nothing set up: drafts kept as files in Supabase Storage
// (no tables), and publishing queued for the cms-publish workflow (no GitHub
// token). Drives the real handlers against a pretend Supabase and pretend GitHub
// keys; GitHub's write calls are replaced on the shared github.js module.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { Readable } from "node:stream";

const require = createRequire(import.meta.url);

process.env.SC_SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";
process.env.SC_SUPABASE_SERVICE_ROLE_KEY = "service-role-key-for-tests-only-0123456789";
process.env.SC_ADMIN_SESSION_SECRET = "session-secret-for-tests";
process.env.SC_ADMIN_USER = "sean";
delete process.env.SC_GITHUB_TOKEN;
delete process.env.SC_PROJECTS_STORE;

const common = require("../../serverlib/common.js");
const github = require("../../serverlib/github.js");
const oidc = require("../../serverlib/gh-oidc.js");
const publish = require("../../api/sc-admin-publish.js");
const projects = require("../../api/sc-admin-projects.js");

// ---------------------------------------------------------------------------
// A pretend Supabase (PostgREST probe + Storage) and GitHub's OIDC keys.

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const KID = "test-key";
const jwk = Object.assign(publicKey.export({ format: "jwk" }), { kid: KID, alg: "RS256", use: "sig" });

const store = new Map(); // key -> { body: Buffer, type }
const sb = { bucket: false, reads: [], nonceMissing: 0 };
const BASE = process.env.SC_SUPABASE_URL;
const BUCKET = "project-media";

function reply(status, body) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const method = (init.method || "GET").toUpperCase();
  if (url.href === oidc.JWKS_URL) return reply(200, { keys: [jwk] });
  if (url.origin !== BASE) throw new Error("unexpected fetch " + url.href);
  const p = url.pathname;
  if (p === "/rest/v1/sc_projects" && method === "HEAD") return new Response(null, { status: 404 });
  if (p === `/storage/v1/bucket/${BUCKET}` && method === "GET") return sb.bucket ? reply(200, { id: BUCKET }) : reply(400, { statusCode: "404", error: "Bucket not found" });
  if (p === "/storage/v1/bucket" && method === "POST") {
    const b = JSON.parse(init.body);
    assert.equal(b.public, false, "the bucket must be private");
    sb.bucket = true;
    return reply(200, { name: BUCKET });
  }
  if (!sb.bucket) return reply(400, { statusCode: "404", error: "Bucket not found" });
  const objPrefix = `/storage/v1/object/${BUCKET}/`;
  const authPrefix = `/storage/v1/object/authenticated/${BUCKET}/`;
  if (p.startsWith(objPrefix) && method === "POST") {
    const key = decodeURI(p.slice(objPrefix.length));
    if (init.headers["x-upsert"] === "false" && store.has(key)) return reply(400, { statusCode: "409", error: "Duplicate" });
    store.set(key, { body: Buffer.from(init.body), type: init.headers["Content-Type"] });
    return reply(200, { Key: key });
  }
  if (p.startsWith(authPrefix) && method === "GET") {
    const key = decodeURI(p.slice(authPrefix.length));
    sb.reads.push(key);
    if (!url.searchParams.get("cacheNonce")) sb.nonceMissing++;
    const o = store.get(key);
    return o ? new Response(o.body, { status: 200 }) : reply(400, { statusCode: "404", error: "not_found", message: "Object not found" });
  }
  if (p === `/storage/v1/object/list/${BUCKET}` && method === "POST") {
    const { prefix, limit, offset } = JSON.parse(init.body);
    const dir = prefix ? prefix + "/" : "";
    const names = new Map();
    for (const key of store.keys()) {
      if (!key.startsWith(dir)) continue;
      const rest = key.slice(dir.length);
      const i = rest.indexOf("/");
      if (i === -1) names.set(rest, { name: rest, id: "obj" });
      else names.set(rest.slice(0, i), { name: rest.slice(0, i), id: null });
    }
    return reply(200, [...names.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(offset, offset + limit));
  }
  if (p === `/storage/v1/object/${BUCKET}` && method === "DELETE") {
    const { prefixes } = JSON.parse(init.body);
    const gone = prefixes.filter((k) => store.delete(k)).map((name) => ({ name }));
    return reply(200, gone);
  }
  throw new Error("unexpected supabase call " + method + " " + p);
};

// ---------------------------------------------------------------------------
// Requests

function fakeReq(method, url, headers, body) {
  const buf = body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body));
  const req = Readable.from(buf.length ? [buf] : []);
  req.method = method;
  req.url = url;
  req.headers = Object.assign({ "content-length": String(buf.length), "user-agent": "test" }, headers || {});
  req.socket = { remoteAddress: "127.0.0.1" };
  return req;
}

async function call(handler, method, url, headers, body) {
  const res = {
    statusCode: 200,
    body: "",
    setHeader() {},
    end(b) {
      this.body = b ? String(b) : "";
    },
  };
  await handler(fakeReq(method, url, headers, body), res);
  return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : null };
}

const ADMIN = {
  origin: "https://scdesignwirral.co.uk",
  cookie: `${common.SESSION_COOKIE}=${common.createSession(process.env.SC_ADMIN_SESSION_SECRET, 3600)}`,
};

function jwt(overrides = {}, header = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = Object.assign(
    {
      iss: oidc.ISSUER,
      aud: oidc.AUDIENCE,
      exp: now + 300,
      nbf: now - 5,
      repository: "mtaylor-afk/scdesign-wirral",
      repository_id: "1262205324",
      repository_owner_id: "264544788",
      ref: "refs/heads/main",
      job_workflow_ref: oidc.EXPECT.workflow,
      event_name: "schedule",
    },
    overrides
  );
  const h = Buffer.from(JSON.stringify(Object.assign({ alg: "RS256", kid: KID, typ: "JWT" }, header))).toString("base64url");
  const b = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${h}.${b}`), privateKey).toString("base64url");
  return `${h}.${b}.${sig}`;
}

const LENT = "ghs_lentWorkflowToken0123456789abcdef";

function runQueue(token = jwt()) {
  return call(publish, "POST", "/api/sc-admin-publish", { authorization: `Bearer ${token}` }, { action: "run-queue", githubToken: LENT });
}

// GitHub's side of publishing, replaced on the module the API itself uses.
const gh = { commits: [], tree: [], failNext: 0, sawToken: [] };
before(() => {
  github.listTree = async () => {
    gh.sawToken.push(github.isConfigured());
    return gh.tree.slice();
  };
  github.readTextFile = async () => null;
  github.commitChanges = async (change) => {
    gh.sawToken.push(github.isConfigured());
    if (gh.failNext > 0) {
      gh.failNext--;
      const err = new Error("GitHub is having a moment.");
      err.code = "github_failed";
      throw err;
    }
    gh.commits.push(change);
    return { sha: "c0ffee" + gh.commits.length, htmlUrl: null, skippedDeletes: [] };
  };
});

async function seed(slug, extra = {}) {
  const r = await common.sbUpsertProject(Object.assign({ slug, content: { slug, title: "Test " + slug, images: [] } }, extra));
  assert.ok(r.ok, JSON.stringify(r));
}

// ---------------------------------------------------------------------------

test("with no sc_projects table, rows are kept as files in a private bucket it makes itself", async () => {
  assert.equal(await common.projectStoreMode(), "files");
  await seed("alpha");
  await seed("bravo", { sort_order: 0 });
  assert.ok(sb.bucket, "bucket made on first use");
  const got = await common.sbGetProject("alpha");
  assert.equal(got.status, "draft");
  assert.equal(got.content.title, "Test alpha");
  assert.ok(got.created_at && got.updated_at);
  // merge, like the table's upsert: an update without content keeps the content
  assert.ok((await common.sbUpsertProject({ slug: "alpha", status: "published" })).ok);
  assert.equal((await common.sbGetProject("alpha")).content.title, "Test alpha");
  const { rows, total } = await common.sbSelectProjects(50, 0);
  assert.equal(total, 2);
  assert.deepEqual(rows.map((r) => r.slug), ["bravo", "alpha"], "sort_order first, nulls last");
  assert.ok((await common.sbSetProjectOrder(["alpha", "bravo"])).ok);
  assert.deepEqual((await common.sbSelectProjects(50, 0)).rows.map((r) => r.slug), ["alpha", "bravo"]);
  assert.equal(sb.nonceMissing, 0, "every read carries a cache-buster");
  assert.equal((await common.sbDeleteProject("bravo")).deleted, 1);
  assert.equal((await common.sbDeleteProject("bravo")).deleted, 0);
  assert.equal(await common.sbGetProject("bravo"), null);
  assert.equal((await common.sbDeleteProject("../x")).ok, false, "a bad slug never reaches storage");
  // a new row with no content is refused, as the table's NOT NULL would
  assert.equal((await common.sbUpsertProject({ slug: "charlie" })).ok, false);
  assert.ok((await common.sbInsertProjectEvent({ slug: "alpha", action: "save", outcome: "ok" })).ok);
  assert.ok([...store.keys()].some((k) => k.startsWith("_cms/events/")));
});

test("publish without a GitHub token is queued, and the list says so", async () => {
  await seed("delta");
  const r = await call(publish, "POST", "/api/sc-admin-publish", ADMIN, { action: "publish", slug: "delta" });
  assert.equal(r.status, 200);
  assert.equal(r.json.queued, true);
  assert.match(r.json.note, /15 minutes/);
  const q = await common.cmsQueueGet("delta");
  assert.equal(q.action, "publish");
  assert.equal(q.attempts, 0);
  const list = await call(projects, "GET", "/api/sc-admin-projects?view=list", ADMIN);
  const row = list.json.rows.find((x) => x.slug === "delta");
  assert.equal(row.pending.action, "publish");
  assert.equal(row.status, "draft", "not live until the workflow has run");
  await common.cmsQueueRemove("delta");
});

test("deleting a draft that was never published happens at once, and drops its queued publish", async () => {
  await seed("echo");
  store.set("echo/photo.jpg", { body: Buffer.from("jpeg"), type: "image/jpeg" });
  await common.cmsQueuePut({ slug: "echo", action: "publish", requestedAt: new Date().toISOString(), attempts: 0 });
  const before = gh.commits.length;
  const r = await call(publish, "POST", "/api/sc-admin-publish", ADMIN, { action: "delete", slug: "echo", confirm: "echo" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.queued, undefined);
  assert.equal(r.json.commitSha, null);
  assert.equal(await common.sbGetProject("echo"), null);
  assert.ok(!store.has("echo/photo.jpg"), "staged photo gone");
  assert.equal(await common.cmsQueueGet("echo"), null);
  assert.equal(gh.commits.length, before, "no GitHub work");
});

test("run-queue refuses anything but this repo's workflow on main", async () => {
  await common.cmsQueuePut({ slug: "alpha", action: "unpublish", requestedAt: new Date().toISOString(), attempts: 0 });
  const bad = [
    jwt({ job_workflow_ref: "mtaylor-afk/scdesign-wirral/.github/workflows/ci.yml@refs/heads/main" }),
    jwt({ ref: "refs/heads/feature" }),
    jwt({ repository: "someone/fork", repository_id: "1" }),
    jwt({ aud: "something-else" }),
    jwt({ exp: Math.floor(Date.now() / 1000) - 3600 }),
    jwt({ event_name: "pull_request" }),
    jwt({}, { alg: "none" }),
    jwt().slice(0, -4) + "AAAA",
    "not-a-jwt",
  ];
  for (const t of bad) {
    const r = await runQueue(t);
    assert.equal(r.status, 401, "refused: " + t.slice(0, 20));
  }
  assert.equal(gh.commits.length, 0);
  assert.ok(await common.cmsQueueGet("alpha"), "nothing ran");
  // A browser request with no session can't run it either.
  const r = await call(publish, "POST", "/api/sc-admin-publish", { origin: ADMIN.origin }, { action: "run-queue" });
  assert.equal(r.status, 401);
});

test("run-queue runs the oldest entry with the lent token, records the result and empties the queue", async () => {
  // alpha was marked published above; pretend its page is in the repo.
  await common.sbUpsertProject({ slug: "alpha", status: "published", published_at: new Date().toISOString() });
  gh.tree = ["content/projects/alpha.json", "public/work/cms/alpha/a.jpg"];
  gh.sawToken = [];
  const r = await runQueue();
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.processed, { slug: "alpha", action: "unpublish", ok: true, status: 200, final: true });
  assert.equal(r.json.remaining, 0);
  assert.ok(gh.sawToken.length && gh.sawToken.every(Boolean), "github.js had the lent token");
  assert.equal(github.isConfigured(), false, "and only for that run");
  const c = gh.commits.at(-1);
  assert.deepEqual(c.deletes.sort(), ["content/projects/alpha.json", "public/work/cms/alpha/a.jpg"]);
  assert.equal((await common.sbGetProject("alpha")).status, "draft");
  assert.equal(await common.cmsQueueGet("alpha"), null);
  const results = await common.cmsResultsAll();
  assert.ok(results.find((x) => x.slug === "alpha" && x.ok));
  assert.equal((await runQueue()).json.processed, null, "nothing left");
  gh.tree = [];
});

test("an upstream failure is retried, then reported on the project", async () => {
  await seed("foxtrot", { status: "published", published_at: new Date().toISOString() });
  gh.tree = ["content/projects/foxtrot.json"];
  await common.cmsQueuePut({ slug: "foxtrot", action: "unpublish", requestedAt: new Date().toISOString(), attempts: 0 });
  gh.failNext = 3;
  for (let i = 1; i <= 3; i++) {
    const r = await runQueue();
    assert.equal(r.json.processed.ok, false);
    assert.equal(r.json.processed.final, i === 3);
  }
  assert.equal(await common.cmsQueueGet("foxtrot"), null);
  const list = await call(projects, "GET", "/api/sc-admin-projects?view=list", ADMIN);
  const row = list.json.rows.find((x) => x.slug === "foxtrot");
  assert.equal(row.pending, null);
  assert.equal(row.lastResult.ok, false);
  assert.match(row.lastResult.message, /GitHub is having a moment/);
  gh.tree = [];
});

test("a newer request made while one runs is kept", async () => {
  await seed("golf", { status: "published", published_at: new Date().toISOString() });
  gh.tree = ["content/projects/golf.json"];
  await common.cmsQueuePut({ slug: "golf", action: "unpublish", requestedAt: "2026-01-01T00:00:00.000Z", attempts: 0 });
  const real = github.commitChanges;
  github.commitChanges = async (change) => {
    // Sean presses Delete while the unpublish is committing.
    await common.cmsQueuePut({ slug: "golf", action: "delete", requestedAt: "2026-01-01T00:05:00.000Z", attempts: 0 });
    return real(change);
  };
  try {
    await runQueue();
  } finally {
    github.commitChanges = real;
  }
  assert.equal((await common.cmsQueueGet("golf")).action, "delete");
  await common.cmsQueueRemove("golf");
  gh.tree = [];
});

test("oidc: a valid token passes and names the workflow", async () => {
  const v = await oidc.verifyWorkflowToken(jwt({ event_name: "workflow_dispatch" }));
  assert.equal(v.ok, true, v.reason);
  assert.equal((await oidc.verifyWorkflowToken(jwt({ event_name: "push" }))).ok, true);
  assert.equal(v.claims.job_workflow_ref, oidc.EXPECT.workflow);
});
