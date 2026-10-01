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

// Version 2 (served at /WVROOFING/2/) lives under the same policy.
const V2 = path.join(repo, "public/WVROOFING/2");
const V2_PAGES = ["2/index.html", "2/roof-cam/index.html", "2/range/index.html", "2/about/index.html"];

/** Every file under a folder. */
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

test("every inline script in the WV pages is allowed by its hash, and nothing else inline", () => {
  const policy = cloudflarePolicies()["/WVROOFING/*"];
  const pages = ["index.html", "visualiser/index.html", "roof-replacement/index.html", "privacy/index.html", "operator/index.html", ...V2_PAGES];
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

test("version 2 runs only its own script files, and never builds code from a string", () => {
  // script-src is 'self' plus that one hash, so a script from anywhere else,
  // eval, new Function or a timer handed a string would all be blocked.
  for (const p of V2_PAGES) {
    const html = fs.readFileSync(path.join(repo, "public/WVROOFING", p), "utf8");
    for (const m of html.matchAll(/<script\b([^>]*)>/g)) {
      const src = /\bsrc="([^"]*)"/.exec(m[1]);
      if (!src) continue;
      assert.match(src[1], /^\/WVROOFING\/2\/[^:]*$/, p + ": a script from outside version 2: " + src[1]);
      const file = path.join(repo, "public", src[1].split(/[?#]/)[0]);
      assert.ok(fs.existsSync(file), p + ": the script " + src[1] + " doesn't exist");
    }
  }
  const scripts = walk(V2).filter((f) => f.endsWith(".js"));
  assert.ok(scripts.length > 5, "version 2's scripts were found");
  for (const file of scripts) {
    const code = fs.readFileSync(file, "utf8");
    const name = path.relative(repo, file);
    assert.doesNotMatch(code, /\beval\s*\(/, name + ": eval(");
    assert.doesNotMatch(code, /\bnew\s+Function\s*\(/, name + ": new Function(");
    assert.doesNotMatch(code, /\bset(?:Timeout|Interval)\s*\(\s*["'`]/, name + ": a timer handed a string of code");
    // Workers must be same-origin files (no blob: or data: workers under this policy).
    for (const w of code.matchAll(/\bnew\s+(?:Shared)?Worker\s*\(([^)]*)/g)) {
      assert.match(w[1], /^\s*new URL\(\s*["']\.\.?\//, name + ": a worker that isn't a file next to it: " + w[0]);
    }
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
