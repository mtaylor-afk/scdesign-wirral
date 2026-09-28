// Database layer on PGlite: migrations, leases, rate limits. (A1)
process.env.WVR_ENV = "test";

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { load, fakeReq } from "./helpers.mjs";

const db = load("serverlib/wvroofing/db.js");
const limits = load("serverlib/wvroofing/limits.js");

after(() => db.reset());

test("migrations apply once and report the latest version", async () => {
  const files = fs.readdirSync(db.MIGRATIONS_DIR).filter((f) => /^\d{4}_.+\.sql$/.test(f));
  const latest = Math.max(...files.map((f) => Number(f.slice(0, 4))));
  assert.equal(await db.ensureSchema(), latest);
  const { rows } = await db.query("SELECT count(*)::int AS n FROM wvr_schema_migrations");
  assert.equal(rows[0].n, files.length);
});

test("running the migrations again (as a second instance would) applies nothing twice", async () => {
  const before = (await db.query("SELECT count(*)::int AS n FROM wvr_schema_migrations")).rows[0].n;
  const v1 = await db.migrate();
  const v2 = await db.migrate();
  const after = (await db.query("SELECT count(*)::int AS n FROM wvr_schema_migrations")).rows[0].n;
  assert.equal(v1, v2);
  assert.equal(after, before);
});

test("a lease is exclusive until released", async () => {
  let inner = null;
  const outer = await db.withLease("t1", 60, async () => {
    inner = await db.withLease("t1", 60, async () => "should not run");
    return "outer ran";
  });
  assert.deepEqual(outer, { held: true, result: "outer ran" });
  assert.deepEqual(inner, { held: false });
  const later = await db.withLease("t1", 60, async () => "free again");
  assert.deepEqual(later, { held: true, result: "free again" });
});

test("an expired lease can be taken over", async () => {
  await db.query("INSERT INTO wvr_leases (name, holder, until) VALUES ('t2', 'crashed', now() - interval '1 minute')");
  const r = await db.withLease("t2", 60, async () => "took over");
  assert.deepEqual(r, { held: true, result: "took over" });
});

test("rate limits count per scope and key within a window, and can be undone", async () => {
  const now = Date.UTC(2026, 8, 28, 10, 0, 30);
  for (let i = 1; i <= 3; i++) assert.equal((await limits.hit("s", "k1", 3, 60, now)).ok, true);
  const fourth = await limits.hit("s", "k1", 3, 60, now);
  assert.equal(fourth.ok, false);
  assert.equal(fourth.retryAfter, 30);
  assert.equal((await limits.hit("s", "k2", 3, 60, now)).ok, true, "other keys are independent");
  assert.equal((await limits.hit("s", "k1", 3, 60, now + 60 * 1000)).ok, true, "a new window starts afresh");
  await limits.undo("s", "k1", 60, now);
  assert.equal((await limits.hit("s", "k1", 3, 60, now)).ok, false, "undo gives back exactly one hit");
});

test("IP keys are keyed daily hashes, never the raw address", () => {
  const req = fakeReq("GET", "/", { "x-forwarded-for": "203.0.113.9" });
  const a = limits.ipHash(req, new Date("2026-09-28T10:00:00Z"));
  const b = limits.ipHash(req, new Date("2026-09-28T23:59:00Z"));
  const c = limits.ipHash(req, new Date("2026-09-29T00:01:00Z"));
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(a, b, "stable within a day");
  assert.notEqual(a, c, "rotates daily");
  assert.ok(!a.includes("203"));
});

test("old rate-limit windows are purged", async () => {
  await db.query("INSERT INTO wvr_rate_limits (scope, key, window_start, count) VALUES ('old', 'k', now() - interval '3 days', 1)");
  assert.ok((await limits.purge()) >= 1);
  const { rows } = await db.query("SELECT count(*)::int AS n FROM wvr_rate_limits WHERE scope = 'old'");
  assert.equal(rows[0].n, 0);
});
