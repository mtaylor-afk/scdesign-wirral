// The sample houses' example figures: generated from products.json, kept in step, labelled.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const gen = path.join(repo, "scripts/wvroofing/gen-sample-estimates.mjs");

test("samples/estimates.json matches products.json (re-run gen-sample-estimates.mjs after editing it)", () => {
  const r = spawnSync(process.execPath, [gen, "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test("every sample house has example figures for every look, marked as examples and drafts", () => {
  const d = JSON.parse(fs.readFileSync(path.join(repo, "public/WVROOFING/samples/estimates.json"), "utf8"));
  const samples = JSON.parse(fs.readFileSync(path.join(repo, "public/WVROOFING/samples/samples.json"), "utf8")).samples;
  const looks = JSON.parse(fs.readFileSync(path.join(repo, "public/WVROOFING/data/catalogue.json"), "utf8")).visuals;
  for (const s of samples) {
    const e = d.samples[s.id];
    assert.ok(e, s.id);
    assert.match(e.measurement.label, /^Example figures for this sample house/, s.id + ": never presented as a measurement");
    for (const v of looks) {
      const products = e.byVisual[v.id].products;
      assert.ok(products.length > 0, s.id + " / " + v.id);
      for (const p of products) {
        assert.equal(p.draft, true, p.name + ": every specification is still a draft");
        assert.ok((p.total && p.total.units > 0) || p.too_shallow, p.name + ": a quantity, or the reason there isn't one");
      }
    }
  }
  // Plain clay tiles need 35°: the 30° modern house says so rather than giving a figure.
  const plain = d.samples["detached-modern"].byVisual["clay-plain-red"].products[0];
  assert.equal(plain.total, null);
  assert.equal(plain.too_shallow, 35);
});
