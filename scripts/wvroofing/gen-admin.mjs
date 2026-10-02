// WV Roofing — the admin pages, made from one template so they never drift apart.
//
//   node scripts/wvroofing/gen-admin.mjs          write the three pages
//   node scripts/wvroofing/gen-admin.mjs --check  exit 1 (listing them) if any page is out of date
//
// The pages:
//   public/WVROOFING/admin/index.html     "Admin · Version 1", starts on version 1, version 1's look
//   public/WVROOFING/2/admin/index.html   "Admin · Roof Cam (version 2)", starts on version 2, version 2's look
//   public/WVROOFING/operator/index.html  both sites, version 1's look (the old address, kept for bookmarks)
// One script runs all three (assets/js/operator/app.js): <body data-site> says
// which site a page starts on, and the switch at the top changes it. There's no
// inline script and no inline event handler: the Content-Security-Policy runs
// script files from this site only (plus one hashed line the public pages use).
// To change a page, change the template here and run this script; a test
// (scripts/wvroofing/tests/admin-pages.test.mjs) fails if they're out of step.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Cache-buster for the admin's own stylesheets and script. Change it when they change. */
export const VERSION = "20261002a";

const V1_FONTS = "https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&amp;display=swap";
const V2_FONTS =
  "https://fonts.googleapis.com/css2?family=Archivo:wght@400..800&amp;family=Big+Shoulders+Display:wght@500;700;900&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;display=swap";

const V1_MARK =
  '<svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="15" fill="#1b2a4a"/><path d="M14 30 32 14l18 16" fill="none" stroke="#c9a84c" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><text x="32" y="52" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Inter, \'Segoe UI\', Arial, sans-serif" font-weight="700" font-size="21" letter-spacing="-0.5" fill="#ffffff">WV</text></svg>';
const V2_MARK =
  '<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" fill="#1b2a4a"/><path d="M7 24 20 11l13 13" fill="none" stroke="#c9a84c" stroke-width="4.5" stroke-linecap="square"/><path d="M14 29l-2 5M21 29l-2 5M28 29l-2 5" fill="none" stroke="#8fd4f4" stroke-width="2.2" stroke-linecap="round"/></svg>';

/**
 * The three pages.
 * file: where it's written; site: where it starts ("" is both); look: whose
 * stylesheets; name: the page's name (in its title); sub: under the brand;
 * home: the "Back to the site" link; intro: the line under the login heading.
 */
export const VARIANTS = [
  {
    file: "public/WVROOFING/admin/index.html",
    site: "v1",
    look: "v1",
    name: "Admin · Version 1",
    sub: "Version 1 · Visualiser",
    home: "/WVROOFING/",
    intro: "For the WV Roofing team only: enquiries, contact details and photos from version 1 of the site, the Roof Visualiser. The switch at the top also shows version 2, or both.",
  },
  {
    file: "public/WVROOFING/2/admin/index.html",
    site: "v2",
    look: "v2",
    name: "Admin · Roof Cam (version 2)",
    sub: "Version 2 · Roof Cam",
    home: "/WVROOFING/2/",
    intro: "For the WV Roofing team only: enquiries, contact details and photos from version 2 of the site, the Roof Cam. The switch at the top also shows version 1, or both.",
  },
  {
    file: "public/WVROOFING/operator/index.html",
    site: "",
    look: "v1",
    name: "Admin · Both sites",
    sub: "Both sites",
    home: "/WVROOFING/",
    intro: "For the WV Roofing team only: enquiries, contact details and photos from both versions of the site, the Roof Visualiser (version 1) and the Roof Cam (version 2).",
  },
];

/** Text or an attribute value, made safe for HTML. */
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Everything in <head> that differs between the two looks. */
function head(v) {
  if (v.look === "v2") {
    return `  <meta name="theme-color" content="#0b1220">
  <link rel="icon" href="/WVROOFING/2/assets/img/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="/WVROOFING/assets/css/site.css?v=${VERSION}">
  <link rel="stylesheet" href="/WVROOFING/assets/css/operator.css?v=${VERSION}">
  <link rel="stylesheet" href="${V2_FONTS}">
  <link rel="stylesheet" href="/WVROOFING/2/assets/css/admin.css?v=${VERSION}">`;
  }
  return `  <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="/WVROOFING/assets/img/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${V1_FONTS}">
  <link rel="stylesheet" href="/WVROOFING/assets/css/site.css?v=${VERSION}">
  <link rel="stylesheet" href="/WVROOFING/assets/css/operator.css?v=${VERSION}">`;
}

/** One page from the template. */
export function render(v) {
  const bodyClass = v.look === "v2" ? "op op--v2" : "op";
  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(v.name)} | WV Roofing (concept)</title>
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
${head(v)}
  <script type="module" src="/WVROOFING/assets/js/operator/app.js?v=${VERSION}"></script>
</head>
<body class="${bodyClass}" data-site="${esc(v.site)}">
  <!-- Generated by scripts/wvroofing/gen-admin.mjs: change the template there, not this file. -->
  <a class="skip-link" href="#main">Skip to content</a>

  <header class="op-bar">
    <div class="op-bar-inner">
      <span class="op-brand">
        ${v.look === "v2" ? V2_MARK : V1_MARK}
        <span class="op-brand-text"><span class="op-brand-name">WV Roofing Admin</span> <span class="op-brand-sub" id="op-brand-sub">${esc(v.sub)}</span></span>
      </span>
      <span class="op-env" id="op-env" hidden>Test environment</span>
      <a class="op-backlink" href="${esc(v.home)}">Back to the site</a>
      <button class="btn btn-neutral btn-sm op-logout" id="op-logout" type="button" hidden>Log out</button>
    </div>
  </header>

  <main id="main" class="op-main">
    <noscript><p class="notice notice--warn op-noscript">The admin needs JavaScript.</p></noscript>

    <section id="op-login" class="op-login" aria-labelledby="op-login-title" hidden>
      <h1 id="op-login-title" class="op-login-title">Admin login</h1>
      <p class="op-muted">${esc(v.intro)}</p>
      <div class="op-setup" id="op-setup" role="status" hidden></div>
      <form id="op-login-form" class="form op-login-form" method="post" novalidate>
        <div class="field">
          <input class="input" id="op-password" name="password" type="password" autocomplete="current-password" placeholder="Password" required>
          <label class="fl-label" for="op-password">Password</label>
        </div>
        <p class="field-error" id="op-login-error" role="alert" hidden></p>
        <button class="btn btn-primary" id="op-login-btn" type="submit">Log in</button>
      </form>
      <p class="op-muted op-small">Logins lock for 15 minutes after five wrong passwords. You stay logged in for up to 12 hours in this tab.</p>
    </section>

    <section id="op-app" class="op-app" aria-label="Admin" hidden>
      <div class="op-toolbar">
        <div class="op-site" id="op-site" role="group" aria-label="Which site"></div>
        <button class="btn btn-neutral btn-sm" id="op-refresh" type="button">Refresh</button>
        <div class="op-tabs" role="tablist" aria-label="Views">
          <button class="op-tab" id="tab-overview" type="button" role="tab" aria-selected="true" aria-controls="op-view-overview" data-tab="overview">Overview</button>
          <button class="op-tab" id="tab-enquiries" type="button" role="tab" aria-selected="false" aria-controls="op-view-enquiries" data-tab="enquiries">Enquiries</button>
          <button class="op-tab" id="tab-contacts" type="button" role="tab" aria-selected="false" aria-controls="op-view-contacts" data-tab="contacts">Contacts</button>
          <button class="op-tab" id="tab-photos" type="button" role="tab" aria-selected="false" aria-controls="op-view-photos" data-tab="photos">Photos <span class="op-count op-count--quiet" id="op-photos-count" hidden></span></button>
          <button class="op-tab" id="tab-jobs" type="button" role="tab" aria-selected="false" aria-controls="op-view-jobs" data-tab="jobs">Renders to check <span class="op-count" id="op-jobs-count" hidden></span></button>
          <button class="op-tab" id="tab-costs" type="button" role="tab" aria-selected="false" aria-controls="op-view-costs" data-tab="costs">Costs</button>
        </div>
      </div>
      <p class="op-status" id="op-status" role="status" aria-live="polite"></p>

      <div id="op-view-overview" class="op-overview-view" role="tabpanel" aria-labelledby="tab-overview">
        <div id="op-overview"></div>
      </div>

      <div id="op-view-enquiries" class="op-split" role="tabpanel" aria-labelledby="tab-enquiries" data-show="list" hidden>
        <div class="op-list-pane">
          <form class="op-search" id="op-search" role="search">
            <label class="sr-only" for="op-q">Find an enquiry</label>
            <input class="op-search-input" id="op-q" name="q" type="search" maxlength="100" autocomplete="off" placeholder="Find a customer or reference">
          </form>
          <div class="op-filters" id="op-filters" role="group" aria-label="Show enquiries"></div>
          <ul class="op-list" id="op-list" aria-label="Enquiries"></ul>
          <p class="op-empty op-muted" id="op-list-empty" hidden>No enquiries here yet.</p>
        </div>
        <div class="op-detail-pane" id="op-detail" aria-live="polite">
          <p class="op-empty op-muted">Choose an enquiry to see everything about it.</p>
        </div>
      </div>

      <div id="op-view-contacts" class="op-contacts-view" role="tabpanel" aria-labelledby="tab-contacts" hidden>
        <p class="op-muted op-intro">Everyone who has sent an enquiry on the site chosen at the top, newest first. Tap a phone number to call, an email address to write, or a reference to see everything about the enquiry. The spreadsheet has the same list, with the full address and message.</p>
        <div class="op-contacts-tools">
          <form class="op-search" id="op-contacts-search" role="search">
            <label class="sr-only" for="op-contacts-q">Find a contact</label>
            <input class="op-search-input" id="op-contacts-q" name="q" type="search" maxlength="100" autocomplete="off" placeholder="Find a name, phone, email or postcode">
          </form>
          <button class="btn btn-primary btn-sm" id="op-contacts-csv" type="button">Download spreadsheet (CSV)</button>
        </div>
        <div class="op-filters" id="op-contacts-filters" role="group" aria-label="Show contacts"></div>
        <div class="op-card op-contacts-card">
          <div class="op-table-wrap" id="op-contacts-list" role="region" aria-label="Contacts (the table scrolls sideways)" tabindex="0"></div>
          <p class="op-empty op-muted" id="op-contacts-empty" hidden>No contacts here yet.</p>
        </div>
      </div>

      <div id="op-view-photos" class="op-photos-view" role="tabpanel" aria-labelledby="tab-photos" data-show="grid" hidden>
        <div class="op-photos-grid-pane">
          <p class="op-muted op-intro">Every photo customers have added on the site chosen at the top: the Roof Visualiser (version 1), the Roof Cam (version 2), or both. Photos without an enquiry are deleted after 30 days; with an enquiry, they're kept with it.</p>
          <div class="op-filters" id="op-photo-enquiry" role="group" aria-label="With or without an enquiry"></div>
          <ul class="op-photo-grid" id="op-photo-grid" aria-label="Customer photos"></ul>
          <p class="op-empty op-muted" id="op-photo-empty" hidden>No photos here yet.</p>
          <div class="op-more"><button class="btn btn-neutral btn-sm" id="op-photo-more" type="button" hidden>Show more</button></div>
        </div>
        <div class="op-photo-detail-pane" id="op-photo-detail" aria-live="polite"></div>
      </div>

      <div id="op-view-jobs" class="op-jobs-view" role="tabpanel" aria-labelledby="tab-jobs" hidden>
        <p class="op-muted op-intro">Photo-real renders from the last 30 days that failed, or whose result never came back. An uncertain render may already have been charged by OpenAI, so trying again always makes a new one, and only when you confirm.</p>
        <ul class="op-joblist" id="op-jobs"></ul>
        <p class="op-empty op-muted" id="op-jobs-empty" hidden>Nothing to check.</p>
      </div>

      <div id="op-view-costs" class="op-costs-view" role="tabpanel" aria-labelledby="tab-costs" hidden>
        <div id="op-costs"></div>
      </div>
    </section>
  </main>

  <dialog class="op-dialog" id="op-confirm" aria-labelledby="op-confirm-title">
    <form method="dialog">
      <h2 class="op-dialog-title" id="op-confirm-title"></h2>
      <p class="op-dialog-text" id="op-confirm-text"></p>
      <div class="op-dialog-actions">
        <button class="btn btn-neutral btn-sm" value="cancel" type="submit">Cancel</button>
        <button class="btn btn-primary btn-sm" value="ok" type="submit" id="op-confirm-ok">Confirm</button>
      </div>
    </form>
  </dialog>
</body>
</html>
`;
}

/** Which pages on disk differ from the template (line endings aside). */
export function outOfDate() {
  return VARIANTS.filter((v) => {
    const file = path.join(repo, v.file);
    const have = fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n") : "";
    return have !== render(v);
  }).map((v) => v.file);
}

function main() {
  if (process.argv.includes("--check")) {
    const stale = outOfDate();
    if (stale.length) {
      console.error("These admin pages are out of date: run node scripts/wvroofing/gen-admin.mjs\n  " + stale.join("\n  "));
      process.exit(1);
    }
    console.log("the admin pages are up to date");
    return;
  }
  for (const v of VARIANTS) {
    const file = path.join(repo, v.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, render(v));
    console.log("wrote " + v.file);
  }
}

// Run when called as a script (a test imports VARIANTS and render without writing anything).
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
