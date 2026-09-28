// Generated docs stay in sync with the code they describe. (A1)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repo, load } from "./helpers.mjs";

test("docs/wvroofing/permissions-record.md matches serverlib/wvroofing/permissions.js", () => {
  const { toMarkdown } = load("serverlib/wvroofing/permissions.js");
  const have = fs.readFileSync(path.join(repo, "docs/wvroofing/permissions-record.md"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(have, toMarkdown() + "\n", "run: node scripts/wvroofing/gen-docs.mjs");
});

test("the env example names every WVR_CAP switch the code reads, and holds no values", () => {
  const example = fs.readFileSync(path.join(repo, "docs/wvroofing/wvroofing.env.example"), "utf8");
  const caps = fs.readFileSync(path.join(repo, "serverlib/wvroofing/capabilities.js"), "utf8");
  for (const m of caps.matchAll(/"(WVR_CAP_[A-Z_]+)"/g)) assert.ok(example.includes(m[1] + "="), "missing " + m[1]);
  for (const line of example.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    assert.match(line, /^[A-Z0-9_]+=$/, "example lines must be NAME= with no value: " + line);
  }
});
