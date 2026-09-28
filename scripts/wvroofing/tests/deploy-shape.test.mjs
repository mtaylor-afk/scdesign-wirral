// Deployment shape: the Hobby 12-function cap, vercel.json and the routes it points at. (A1)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repo, load, fakeReq } from "./helpers.mjs";

function jsFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...jsFiles(p));
    else if (/\.(c|m)?js$|\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

test("api/ holds 11 function files: WV Roofing adds exactly one (never a 13th)", () => {
  const files = jsFiles(path.join(repo, "api")).map((f) => path.relative(repo, f).split(path.sep).join("/"));
  const wv = files.filter((f) => f.startsWith("api/wvroofing/"));
  assert.deepEqual(wv, ["api/wvroofing/app.js"]);
  assert.equal(files.length, 11, files.join(", "));
});

test("vercel.json: every functions pattern matches a file, and the WV rewrite and cron exist", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(repo, "vercel.json"), "utf8"));
  for (const pattern of Object.keys(cfg.functions)) {
    if (pattern.includes("*")) continue; // globs such as api/*.js
    assert.ok(fs.existsSync(path.join(repo, pattern)), "functions entry has no file: " + pattern);
  }
  assert.equal(cfg.functions["api/wvroofing/app.js"].maxDuration, 300);
  // The render worker plans its time around the same limit.
  assert.equal(load("serverlib/wvroofing/jobs.js").FUNCTION_SECONDS, cfg.functions["api/wvroofing/app.js"].maxDuration);
  // The destination also carries the route as ?path= so routing works whether or not Vercel keeps req.url.
  assert.deepEqual(cfg.rewrites, [{ source: "/api/wvroofing/:path*", destination: "/api/wvroofing/app?path=:path*" }]);
  assert.ok(cfg.crons.some((c) => c.path === "/api/wvroofing/cron/daily" && c.schedule.split(" ").length === 5));
  assert.ok(!("regions" in cfg), "no project-wide region: that would move the SC functions too");
});

test("the cron path resolves to the cron route", () => {
  const router = load("serverlib/wvroofing/router.js");
  const r = router.resolvePath(fakeReq("GET", "/api/wvroofing/cron/daily"));
  assert.equal(r.path, "cron/daily");
  assert.equal(router.match(r.path).route.auth, "cron");
});

test("the migration folder that vercel.json bundles exists and is well formed", () => {
  const dir = path.join(repo, "db", "wvroofing");
  const files = fs.readdirSync(dir);
  assert.ok(files.length >= 1);
  for (const f of files) assert.match(f, /^\d{4}_[a-z0-9_]+\.sql$/);
  const nums = files.map((f) => Number(f.slice(0, 4)));
  assert.deepEqual(nums, nums.map((_, i) => i + 1), "migrations are numbered 0001, 0002, ... without gaps");
});
