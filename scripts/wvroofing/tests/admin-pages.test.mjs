// The admin pages: made from one template (scripts/wvroofing/gen-admin.mjs),
// never indexed, no inline script, each starting on its own site in its own
// look, and every element the admin's scripts look up is on every page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { repo } from "./helpers.mjs";
import { VARIANTS, VERSION } from "../gen-admin.mjs";

const read = (rel) => fs.readFileSync(path.join(repo, rel), "utf8").replace(/\r\n/g, "\n");

const V1_FONTS = "https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&amp;display=swap";
const V2_FONTS =
  "https://fonts.googleapis.com/css2?family=Archivo:wght@400..800&amp;family=Big+Shoulders+Display:wght@500;700;900&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;display=swap";
const SITE_CSS = "/WVROOFING/assets/css/site.css?v=" + VERSION;
const OPERATOR_CSS = "/WVROOFING/assets/css/operator.css?v=" + VERSION;
const V2_ADMIN_CSS = "/WVROOFING/2/assets/css/admin.css?v=" + VERSION;
const APP_JS = "/WVROOFING/assets/js/operator/app.js?v=" + VERSION;

const PAGES = {
  "public/WVROOFING/admin/index.html": { site: "v1", title: "Admin · Version 1", home: "/WVROOFING/", css: [V1_FONTS, SITE_CSS, OPERATOR_CSS], bodyClass: "op" },
  "public/WVROOFING/2/admin/index.html": {
    site: "v2",
    title: "Admin · Roof Cam (version 2)",
    home: "/WVROOFING/2/",
    css: [SITE_CSS, OPERATOR_CSS, V2_FONTS, V2_ADMIN_CSS],
    bodyClass: "op op--v2",
  },
  "public/WVROOFING/operator/index.html": { site: "", title: "Admin · Both sites", home: "/WVROOFING/", css: [V1_FONTS, SITE_CSS, OPERATOR_CSS], bodyClass: "op" },
};

const TABS = ["overview", "enquiries", "contacts", "photos", "jobs", "costs"];

test("the three admin pages match their template (node scripts/wvroofing/gen-admin.mjs)", () => {
  assert.deepEqual(VARIANTS.map((v) => v.file).sort(), Object.keys(PAGES).sort(), "the generator makes exactly these pages");
  const r = spawnSync(process.execPath, [path.join(repo, "scripts/wvroofing/gen-admin.mjs"), "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, (r.stderr || "") + (r.stdout || ""));
});

test("each admin page: never indexed, its own site, title and look, the admin script and nothing inline", () => {
  for (const [file, want] of Object.entries(PAGES)) {
    const html = read(file);
    assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">/, file + ": robots meta");
    const body = /<body class="([^"]*)" data-site="([^"]*)">/.exec(html);
    assert.ok(body, file + ": <body class data-site>");
    assert.equal(body[1], want.bodyClass, file + ": body class");
    assert.equal(body[2], want.site, file + ": data-site");
    const title = (/<title>([^<]*)<\/title>/.exec(html) || [])[1] || "";
    assert.equal(title, want.title + " | WV Roofing (concept)", file + ": title");

    // The stylesheets, in order (version 2's look loads last, over version 1's layout).
    const css = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
    assert.deepEqual(css, want.css, file + ": stylesheets");
    if (want.site === "v2") assert.match(html, /<meta name="theme-color" content="#0b1220">/, file + ": version 2's theme colour");
    for (const href of css.filter((x) => x.startsWith("/"))) {
      assert.ok(fs.existsSync(path.join(repo, "public", href.split("?")[0])), file + ": " + href + " exists");
    }

    // One script: the admin's module, from this site. No inline script, no inline handlers.
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 1, file + ": one script");
    assert.match(scripts[0][1], /^ type="module" src="([^"]+)"$/, file + ": a module script");
    assert.equal(/src="([^"]+)"/.exec(scripts[0][1])[1], APP_JS, file + ": the admin script");
    assert.equal(scripts[0][2], "", file + ": no inline script");
    assert.ok(fs.existsSync(path.join(repo, "public", APP_JS.split("?")[0])));
    assert.doesNotMatch(html, /\son[a-z]+=/i, file + ": no inline event handlers");

    // The header: the brand, its site, and the way back to the site it belongs to.
    assert.match(html, /<span class="op-brand-name">WV Roofing Admin<\/span>/, file + ": brand");
    assert.ok(html.includes(`<a class="op-backlink" href="${want.home}">Back to the site</a>`), file + ": back to " + want.home);

    // The site switch (filled by the script) and the set-up note on the login screen.
    assert.ok(html.includes('<div class="op-site" id="op-site" role="group" aria-label="Which site"></div>'), file + ": the site switch");
    // A status region, so a screen reader hears it even after the keyboard has moved to the password.
    assert.ok(html.includes('<div class="op-setup" id="op-setup" role="status" hidden></div>'), file + ": the set-up note");
    // The per-tab site chips of 2026-10-01 are replaced by the switch.
    assert.doesNotMatch(html, /id="op-site-filters"|id="op-photo-site"/, file + ": no per-tab site chips");

    // The tabs, in order, Overview first and selected, each with its panel.
    const tabs = [...html.matchAll(/<button class="op-tab" id="tab-([a-z]+)"[^>]*aria-selected="(true|false)" aria-controls="([^"]+)" data-tab="([a-z]+)"/g)];
    assert.deepEqual(
      tabs.map((m) => m[1]),
      TABS,
      file + ": tab order"
    );
    assert.deepEqual(
      tabs.map((m) => m[2]),
      TABS.map((t) => String(t === "overview")),
      file + ": Overview is the first tab shown"
    );
    for (const m of tabs) {
      assert.equal(m[4], m[1], file + ": data-tab");
      assert.ok(html.includes(`id="${m[3]}"`), file + ": panel " + m[3]);
    }
    assert.match(html, /<div id="op-view-overview" [^>]*role="tabpanel"[^>]*>/, file + ": the overview panel");
    assert.doesNotMatch(/<div id="op-view-overview"[^>]*>/.exec(html)[0], /\shidden/, file + ": the overview panel is the one showing");

    // Ids are unique on the page.
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(
      ids.filter((x, i) => ids.indexOf(x) !== i),
      [],
      file + ": duplicate ids"
    );
  }
});

test("every element the admin's scripts look up by id is on every admin page", () => {
  const dir = path.join(repo, "public/WVROOFING/assets/js/operator");
  const lookedUp = new Set();
  const made = new Set();
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    const code = fs.readFileSync(path.join(dir, name), "utf8");
    if (["app.js", "photos.js", "overview.js", "contacts.js"].includes(name)) {
      for (const m of code.matchAll(/\$\(\s*"([^"]+)"\s*\)|getElementById\(\s*"([^"]+)"\s*\)/g)) lookedUp.add(m[1] || m[2]);
      // The tab panels are also named in a table (looked up as $(id)).
      for (const m of code.matchAll(/"(op-view-[a-z]+)"/g)) lookedUp.add(m[1]);
    }
    // Elements the scripts make themselves (an enquiry's heading, say) aren't in the page.
    for (const m of code.matchAll(/\bid:\s*"([^"]+)"/g)) made.add(m[1]);
  }
  const needed = [...lookedUp].filter((id) => !made.has(id)).sort();
  assert.ok(needed.length > 30, "the ids were found: " + needed.length);
  for (const want of ["op-site", "op-setup", "op-overview", "op-contacts-list", "op-contacts-csv", "op-brand-sub"]) assert.ok(needed.includes(want), want + " is looked up");
  for (const file of Object.keys(PAGES)) {
    const html = read(file);
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    assert.deepEqual(
      needed.filter((id) => !ids.has(id)),
      [],
      file + ": ids the scripts look up but the page doesn't have"
    );
  }
  // The script starts on the page's own site.
  assert.match(fs.readFileSync(path.join(dir, "app.js"), "utf8"), /document\.body\.dataset\.site/);
});

test("the admin pages link only to their own site, never to the old /operator/ address", () => {
  for (const file of ["public/WVROOFING/admin/index.html", "public/WVROOFING/2/admin/index.html"]) {
    const html = read(file);
    assert.doesNotMatch(html, /WVROOFING\/operator/, file);
    assert.doesNotMatch(html, /SC Design|scdesign/i, file + ": nothing of SC Design");
    for (const m of html.matchAll(/\shref="([^"]+)"/g)) {
      assert.match(m[1], /^(\/WVROOFING\/|#main$|https:\/\/fonts\.(googleapis|gstatic)\.com)/, file + ": a link that isn't WV Roofing's: " + m[1]);
    }
  }
});
