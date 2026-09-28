// The WV Roofing content CSP: same policy on both hosts, and it allows exactly
// the pages' inline script and the services the pages really use. (A2)
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { repo } from "./helpers.mjs";

function cloudflarePolicies() {
  const txt = fs.readFileSync(path.join(repo, "public/_headers"), "utf8");
  const out = {};
  let cur = null;
  for (const line of txt.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      cur = line.trim();
      continue;
    }
    const m = /^\s+Content-Security-Policy:\s*(.+)$/.exec(line);
    if (m) out[cur] = m[1].trim();
  }
  return out;
}

function vercelPolicies() {
  const cfg = JSON.parse(fs.readFileSync(path.join(repo, "vercel.json"), "utf8"));
  const out = {};
  for (const h of cfg.headers) {
    const csp = h.headers.find((x) => x.key === "Content-Security-Policy");
    if (csp) out[h.source] = csp.value;
  }
  return out;
}

test("both hosts send the same CSP on every WV Roofing path", () => {
  const cf = cloudflarePolicies();
  const vc = vercelPolicies();
  assert.ok(cf["/WVROOFING"] && cf["/WVROOFING/*"], "Cloudflare _headers");
  assert.ok(vc["/WVROOFING"] && vc["/WVROOFING/(.*)"], "vercel.json");
  const all = new Set([cf["/WVROOFING"], cf["/WVROOFING/*"], vc["/WVROOFING"], vc["/WVROOFING/(.*)"]]);
  assert.equal(all.size, 1, "one policy everywhere");
});

test("every inline script in the WV pages is allowed by its hash, and nothing else inline", () => {
  const policy = cloudflarePolicies()["/WVROOFING/*"];
  const pages = ["index.html", "visualiser/index.html", "roof-replacement/index.html", "privacy/index.html", "operator/index.html"];
  for (const p of pages) {
    const html = fs.readFileSync(path.join(repo, "public/WVROOFING", p), "utf8");
    for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
      const attrs = m[1] || "";
      if (/\bsrc=/.test(attrs)) continue;
      const hash = "'sha256-" + crypto.createHash("sha256").update(m[2]).digest("base64") + "'";
      assert.ok(policy.includes(hash), p + ": inline script not in the CSP: " + m[2].slice(0, 60));
    }
    assert.ok(!/\son[a-z]+=/i.test(html.replace(/<script[\s\S]*?<\/script>/g, "")), p + ": no inline event handlers");
  }
});

test("the policy allows the API, Blob uploads and fonts, and blocks plugins and framing", () => {
  const policy = cloudflarePolicies()["/WVROOFING/*"];
  assert.match(policy, /connect-src 'self' https:\/\/scdesign-wirral\.vercel\.app https:\/\/vercel\.com/);
  assert.match(policy, /font-src 'self' https:\/\/fonts\.gstatic\.com/);
  assert.match(policy, /img-src 'self' data: blob: https:\/\/maps\.googleapis\.com;/, "the aerial view is loaded straight from Google");
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.doesNotMatch(policy, /script-src[^;]*'unsafe-inline'/);
});
