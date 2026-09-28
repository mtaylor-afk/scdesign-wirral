// WV Roofing â€” end-to-end browser QA (headless Chromium via Playwright).
//
//   node scripts/wvroofing/qa.mjs [--base http://localhost:8772] [--out <dir>] [--live]
//
// Needs the dev server running (scripts/wvroofing/dev-server.mjs) unless --base
// points at a deployed copy. Checks every page at phone and desktop widths
// (console errors, failed requests, horizontal overflow, no prices), then
// drives the Roof Visualiser: the first step, "photo only" and Back; sample
// house -> quick previews (samples never call the AI service) -> the honest
// estimate step -> lightbox (Before / After buttons) -> enquiry step; and on a
// phone viewport: postcode -> address -> satellite view -> property type (test
// stand-ins), the photo notice, a HEIC refusal, an upload to the customer's
// project, a hand-drawn outline saved to the project, photo-real renders (none
// before the customer agrees; then the chosen roof automatically and the
// others on tap; the served composite is compared with the photo outside the
// roof), a refresh that brings everything back without rendering twice, an
// enquiry with a reference, and "Delete my photo". Pages are served with their
// real headers (incl. CSP), so a CSP violation shows up as a console error.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf("--" + n);
  return i === -1 ? d : args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
};
const BASE = String(opt("base", "http://localhost:8772")).replace(/\/$/, "");
const OUT = path.resolve(String(opt("out", path.join(os.tmpdir(), "wvroofing-qa"))));
const LIVE = !!opt("live", false);
fs.mkdirSync(OUT, { recursive: true });

const REF = /WVR-\d{4}-[0-9A-Z]{4}/;
const results = [];
const ok = (name, pass, detail) => {
  results.push({ name, pass: !!pass, detail: detail || "" });
  console.log((pass ? "PASS " : "FAIL ") + name + (detail ? " - " + detail : ""));
};

const PAGES = ["/WVROOFING/", "/WVROOFING/roof-replacement/", "/WVROOFING/privacy/", "/WVROOFING/visualiser/"];
const VIEWPORTS = [
  { name: "phone", width: 375, height: 812, isMobile: true, hasTouch: true },
  { name: "desktop", width: 1280, height: 860 },
];

async function shot(page, opts) {
  try {
    await page.screenshot(opts);
  } catch (err) {
    try {
      await page.screenshot(Object.assign({}, opts, { fullPage: false }));
    } catch (err2) {
      console.log("(screenshot skipped: " + err2.message.split("\n")[0] + ")");
    }
  }
}

function watch(page) {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return; // offline-tolerant
    errors.push("requestfailed: " + u + " " + (r.failure() && r.failure().errorText));
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("/api/wvroofing/")) errors.push("http " + r.status() + ": " + r.url());
  });
  return errors;
}

const browser = await chromium.launch();
try {
  // ---- every page, both widths ----------------------------------------------
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
    for (const p of PAGES) {
      const page = await ctx.newPage();
      const errors = watch(page);
      await page.goto(BASE + p, { waitUntil: "load", timeout: 45000 });
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const h1 = await page.locator("h1").count();
      ok(`${vp.name} ${p} loads cleanly`, errors.length === 0, errors.join(" | "));
      ok(`${vp.name} ${p} no horizontal overflow`, overflow <= 0, "overflow " + overflow + "px");
      ok(`${vp.name} ${p} exactly one h1`, h1 === 1, "h1 count " + h1);
      const robots = await page.locator('meta[name="robots"]').getAttribute("content");
      ok(`${vp.name} ${p} noindex meta`, /noindex/.test(robots || ""), robots || "missing");
      const sc = await page.evaluate(() => /SC Design|scdesign/i.test(document.body.innerText));
      ok(`${vp.name} ${p} no SC Design mention in visible text`, !sc);
      // No prices anywhere (brief §5, §13): prices come from the roofer after a survey.
      const pounds = await page.evaluate(() => (document.body.innerText.match(/.{0,30}£.{0,30}/) || [""])[0]);
      ok(`${vp.name} ${p} shows no prices (no "£")`, !pounds, pounds);
      await shot(page, { path: path.join(OUT, `${vp.name}-${p.replace(/\//g, "_") || "home"}.png`), fullPage: true });
      await page.close();
    }
    await ctx.close();
  }

  // ---- hero renders its "after" ------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/WVROOFING/", { waitUntil: "load", timeout: 45000 });
    const ready = await page.waitForSelector(".hero-visual.is-ready", { timeout: 20000 }).then(() => true).catch(() => false);
    ok("home hero builds its before/after", ready);
    await ctx.close();
  }

  // ---- home: "eight roofs, one house" colour picker ----------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await ctx.newPage();
    const errors = watch(page);
    await page.goto(BASE + "/WVROOFING/", { waitUntil: "load", timeout: 45000 });
    await page.locator("[data-picker]").scrollIntoViewIfNeeded();
    const dots = page.locator('[data-picker-dots] [role="radio"]');
    ok("picker offers 8 roof colours", (await dots.count()) === 8, (await dots.count()) + " dots");
    const first = await page
      .waitForFunction(() => document.querySelector("[data-picker]").dataset.showing || null, null, { timeout: 30000 })
      .then((h) => h.jsonValue())
      .catch(() => "");
    ok("picker draws its first roof", !!first, first);
    await dots.nth(0).click();
    const next = await page
      .waitForFunction((prev) => {
        const d = document.querySelector("[data-picker]").dataset.showing;
        return d && d !== prev ? d : null;
      }, first, { timeout: 30000 })
      .then((h) => h.jsonValue())
      .catch(() => "");
    ok("tapping a colour re-roofs the house", !!next && next !== first, first + " -> " + next);
    ok("exactly one colour is marked as chosen", (await page.locator('[data-picker-dots] [aria-checked="true"]').count()) === 1);
    await shot(page, { path: path.join(OUT, "home-picker-desktop.png") });
    ok("home picker has no console errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  // ---- roof replacement: compare grid, gallery paddles, local nav --------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/WVROOFING/roof-replacement/", { waitUntil: "load", timeout: 45000 });
    await page.waitForSelector("[data-compare] .cmp-name", { timeout: 15000 });
    await page.waitForTimeout(1600);
    const cols = await page.locator("[data-compare] .cmp-col").count();
    ok("compare grid lists all 8 roofs", cols === 8, cols + " columns");
    const track = page.locator("[data-compare]");
    const x0 = await track.evaluate((t) => t.scrollLeft);
    await page.locator('.gallery:has([data-compare]) .paddle[data-dir="1"]').click();
    await page.waitForTimeout(1000);
    const x1 = await track.evaluate((t) => t.scrollLeft);
    ok("gallery paddle scrolls the roofs", x1 > x0, x0 + " -> " + x1);
    await page.locator("[data-compare] .cmp-col").nth(1).locator("a.more").click();
    await page.waitForTimeout(300);
    const sel = await page.inputValue("#q-product");
    ok("'Ask about this roof' pre-selects it in the quote form", sel === "welsh-slate", sel);
    // The survey request is saved first and answered with a reference.
    await page.fill("#q-name", "QA Tester");
    await page.fill("#q-email", "qa@example.com");
    await page.check("#q-consent");
    await page.waitForTimeout(2700);
    await page.click('form[data-enquiry] button[type="submit"]');
    await page.waitForFunction(() => {
      const s = document.querySelector("form[data-enquiry] .form-status");
      return s && !s.hidden && !/Saving/.test(s.textContent);
    }, null, { timeout: 20000 });
    const rr = await page.textContent("form[data-enquiry] .form-status");
    ok("roof-replacement form: the enquiry is saved with a reference", (/saved/i.test(rr) && REF.test(rr)) || (LIVE && /concept site/i.test(rr)), rr);
    await page.evaluate(() => window.scrollTo(0, 3000));
    await page.waitForTimeout(400);
    const top = await page.locator(".lnav").evaluate((n) => n.getBoundingClientRect().top);
    ok("local nav stays pinned while scrolling", Math.abs(top) < 1, "top " + top);
    await ctx.close();
  }

  // ---- phone: global menu --------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(BASE + "/WVROOFING/", { waitUntil: "load", timeout: 45000 });
    await page.click(".nav-toggle");
    const opened = await page.waitForSelector("#site-nav.is-open", { timeout: 3000 }).then(() => true).catch(() => false);
    ok("phone: menu opens with its links", opened && (await page.isVisible('#site-nav a[href="/WVROOFING/visualiser/"]')));
    await page.waitForTimeout(600);
    const menuH = await page.$eval("#site-nav", (n) => Math.round(n.getBoundingClientRect().height));
    const lastLink = await page.$eval("#site-nav .gnav-cta", (a) => Math.round(a.getBoundingClientRect().bottom));
    ok("phone: menu fills the screen below the bar", menuH > 600 && lastLink < 844, "menu height " + menuH + "px, last item ends at " + lastLink + "px");
    await shot(page, { path: path.join(OUT, "menu-phone.png") });
    await page.keyboard.press("Escape");
    ok("phone: Escape closes the menu", await page.$eval("#site-nav", (n) => !n.classList.contains("is-open")));
    await ctx.close();
  }

  // ---- visualiser: first step, "photo only", and the local nav's "Get a quote" ---------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/WVROOFING/visualiser/", { waitUntil: "load", timeout: 45000 });
    await page.waitForTimeout(800);
    const first = await page.isVisible('[data-panel="property"]');
    const capLine = (await page.textContent("#cap-line")) || "";
    ok("visualiser: it starts with your address, and says measurement isn't available online", first && /measurement isn't available/i.test(capLine), capLine);
    await page.click("#btn-photo-only");
    const photoStep = await page.waitForSelector('[data-panel="photo"]:not([hidden])', { timeout: 5000 }).then(() => true).catch(() => false);
    ok("visualiser: 'Photo only' skips straight to the photo", photoStep && /step=photo/.test(page.url()), page.url());
    await page.goBack();
    const back = await page.waitForSelector('[data-panel="property"]:not([hidden])', { timeout: 5000 }).then(() => true).catch(() => false);
    ok("visualiser: the browser's Back button goes back a step", back);
    await page.click("[data-open-quote]");
    const open = await page.waitForSelector('[data-panel="enquiry"]:not([hidden])', { timeout: 5000 }).then(() => true).catch(() => false);
    ok("visualiser: local nav 'Get a quote' opens the enquiry step", open);
    await ctx.close();
  }

  // ---- visualiser: sample -> previews -> mock AI -> lightbox -> quote ---------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = watch(page);
    await page.goto(BASE + "/WVROOFING/visualiser/?sample=semi-1930s", { waitUntil: "load", timeout: 45000 });
    await page.waitForSelector('[data-panel="mark"]:not([hidden])', { timeout: 15000 });
    const pct = await page.textContent("#mark-pct");
    ok("sample house arrives pre-marked", pct && pct !== "0%", pct);
    await shot(page, { path: path.join(OUT, "vis-mark-desktop.png") });
    const t0 = Date.now();
    await page.click("#btn-compare");
    await page.waitForFunction(() => Array.from(document.querySelectorAll(".result-card .badge")).filter((b) => /Quick preview|AI concept/.test(b.textContent)).length === 8, null, { timeout: 60000 });
    ok("8 quick previews", true, Date.now() - t0 + " ms");
    await shot(page, { path: path.join(OUT, "vis-previews-desktop.png"), fullPage: true });

    // Sample houses show pre-rendered results only: no AI render is ever requested for them.
    const startHidden = !(await page.isVisible("#btn-start-ai"));
    const renderNote = (await page.textContent("#render-status")) || "";
    ok("sample houses never call the AI service", startHidden && /own photo|pre-rendered/.test(renderNote), renderNote);

    // The estimate step says honestly that there's no measurement data, and offers a survey.
    await page.click("#btn-to-estimate");
    await page.waitForSelector('[data-panel="estimate"]:not([hidden])', { timeout: 5000 });
    const est = (await page.textContent('[data-panel="estimate"]')) || "";
    ok(
      "estimate: 'suitable data unavailable', the survey disclaimer and what's not included",
      /Suitable data unavailable/.test(est) && /Final quantities, specification and price are subject to a roof survey/.test(est) && /ridges, hips, valleys/.test(est)
    );
    await page.click("#btn-estimate-back");
    await page.waitForSelector('[data-panel="compare"]:not([hidden])', { timeout: 5000 });

    await page.click(".result-card .result-open");
    await page.waitForSelector("#lightbox[open]");
    const title = await page.textContent("#lb-title");
    ok("lightbox opens", !!title, title);
    await page.keyboard.press("ArrowRight");
    const title2 = await page.textContent("#lb-title");
    ok("lightbox next works", title2 !== title, title2);
    await page.click('#lb-ba-toggle [data-ba="0"]');
    const after = await page.evaluate(() => ({ v: document.querySelector("#lb-ba .ba-range").value, pos: document.querySelector("#lb-ba").style.getPropertyValue("--pos") }));
    await page.click('#lb-ba-toggle [data-ba="100"]');
    const before = await page.evaluate(() => document.querySelector("#lb-ba").style.getPropertyValue("--pos"));
    ok("lightbox: Before / After buttons compare without dragging", after.v === "0" && after.pos === "0%" && before === "100%", JSON.stringify({ after, before }));
    await shot(page, { path: path.join(OUT, "vis-lightbox-desktop.png") });
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }).catch(() => null), page.click("#lb-download")]);
    ok("download produces a file", !!download, download ? download.suggestedFilename() : "none");
    await page.click("#lb-quote");
    await page.waitForSelector('[data-panel="enquiry"]:not([hidden])', { timeout: 5000 });
    const sel = await page.inputValue("#v-product");
    ok("'Get a quote for this roof' opens the enquiry step with that roof chosen", !!sel && sel === (await page.evaluate(() => window.__wvr.chosen)), sel);
    await page.fill("#v-name", "QA Tester");
    await page.fill("#v-email", "qa@example.com");
    await page.check("#v-consent");
    await page.waitForTimeout(2700);
    await page.click('#quote-form button[type="submit"]');
    await page.waitForFunction(() => {
      const s = document.querySelector("#quote-form .form-status");
      return s && !s.hidden && !/Saving|Sending/.test(s.textContent);
    }, null, { timeout: 20000 });
    const status = (await page.isVisible("#enquiry-done")) ? await page.textContent("#enquiry-done") : await page.textContent("#quote-form .form-status");
    // Saved first, with a reference; a deployed copy without storage says it isn't collecting yet.
    ok("quote form: the enquiry is saved with a reference", (/saved/i.test(status) && REF.test(status)) || (LIVE && /concept site/i.test(status)), status);
    await shot(page, { path: path.join(OUT, "vis-quote-desktop.png") });
    ok("visualiser flow has no console errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  // ---- phone: upload to the project, hand-drawn outline, outline saved, delete ------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = watch(page);
    page.on("dialog", (d) => d.accept());
    const isPath = (r, re) => re.test(new URL(r.url()).pathname);
    let renderPosts = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && isPath(r, /\/renders$/)) renderPosts++;
    });
    await page.goto(BASE + "/WVROOFING/visualiser/", { waitUntil: "load", timeout: 45000 });
    await page.waitForTimeout(500);
    // Step 1: postcode -> address -> satellite view -> "is the pin on your house?" -> kind of property.
    if (!LIVE) {
      await page.fill("#pc-input", "ch45 1ab");
      await page.click("#pc-find");
      await page.waitForSelector("#address-list button", { timeout: 15000 });
      const listed = await page.locator("#address-list button").count();
      const newBuild = await page.locator("#address-list .badge", { hasText: "New build" }).count();
      ok("phone: a postcode lists its addresses (a new build labelled)", listed === 4 && newBuild === 1, listed + " addresses");
      await page.locator("#address-list button").first().click();
      await page.waitForSelector("#aerial:not([hidden])", { timeout: 10000 });
      const pinAsked = await page.isVisible("#pin-q");
      ok("phone: the satellite view shows, with the pin question for a rooftop location", pinAsked && (await page.isVisible("#aerial-img")));
      await page.click('label.choice:has(input[name="pin"][value="yes"])');
      await page.click('label.choice:has(input[name="ptype"][value="semi"])');
      await shot(page, { path: path.join(OUT, "vis-property-phone.png"), fullPage: true });
      const confirmed = page.waitForResponse((r) => isPath(r, /\/property\/confirm$/), { timeout: 15000 }).catch(() => null);
      await page.click("#btn-property-next");
      const cRes = await confirmed;
      await page.waitForSelector('[data-panel="photo"]:not([hidden])', { timeout: 10000 });
      ok("phone: the property is confirmed and the photo step follows", !!cRes && cRes.status() === 200 && /project=/.test(page.url()), cRes ? String(cRes.status()) : "no request");
    } else {
      await page.click("#btn-photo-only");
      await page.waitForSelector('[data-panel="photo"]:not([hidden])', { timeout: 10000 });
    }
    const notice = (await page.isVisible("#storage-notice")) ? await page.textContent("#storage-notice") : "";
    ok("phone: the photo notice explains upload, 30-day keeping and deletion", /uploaded/.test(notice) && /30 days/.test(notice) && /delete/.test(notice));
    // A HEIC file is caught in the browser with a clear message; nothing is uploaded.
    const heic = Buffer.alloc(64);
    heic.writeUInt32BE(24, 0);
    heic.write("ftypheic", 4, "ascii");
    await page.setInputFiles("#file-library", { name: "IMG_0001.HEIC", mimeType: "image/heic", buffer: heic });
    await page.waitForSelector("#photo-error:not([hidden])", { timeout: 5000 }).catch(() => null);
    ok("phone: a HEIC photo gets a clear message", /HEIC/.test((await page.textContent("#photo-error")) || ""));
    const photo = path.resolve(here, "../../public/WVROOFING/samples/detached-modern.jpg");
    const committed = page.waitForResponse((r) => isPath(r, /\/photo\/commit$/), { timeout: 60000 }).catch(() => null);
    await page.setInputFiles("#file-library", photo);
    const commitRes = await committed;
    ok("phone: the photo is uploaded to the project and prepared by the server", !!commitRes && commitRes.status() === 200, commitRes ? String(commitRes.status()) : "no commit");
    await page.waitForSelector('[data-panel="mark"]:not([hidden])', { timeout: 30000 });
    const box = await page.locator(".editor-canvas").boundingBox();
    const pts = [
      [0.1, 0.33],
      [0.47, 0.18],
      [0.9, 0.24],
      [0.95, 0.31],
      [0.53, 0.26],
      [0.05, 0.34],
    ];
    for (const [fx, fy] of pts) await page.touchscreen.tap(box.x + fx * box.width, box.y + fy * box.height);
    await page.touchscreen.tap(box.x + pts[0][0] * box.width, box.y + pts[0][1] * box.height);
    await page.waitForTimeout(300);
    const pct = await page.textContent("#mark-pct");
    ok("phone: tapping an outline marks the roof", pct && pct !== "0%", pct);
    await shot(page, { path: path.join(OUT, "vis-mark-phone.png") });
    const enabled = await page.isEnabled("#btn-compare");
    ok("phone: compare enabled after outlining", enabled);
    if (enabled) {
      const saved = page.waitForResponse((r) => isPath(r, /\/mask$/) && r.request().method() === "POST", { timeout: 30000 }).catch(() => null);
      await page.click("#btn-compare");
      await page.waitForFunction(() => Array.from(document.querySelectorAll(".result-card .badge")).filter((b) => /Quick preview|AI concept/.test(b.textContent)).length === 8, null, { timeout: 60000 });
      ok("phone: 8 previews from an uploaded photo", true);
      const maskRes = await saved;
      ok("phone: the roof outline is saved to the project", !!maskRes && maskRes.status() === 200, maskRes ? String(maskRes.status()) : "not sent");
      await shot(page, { path: path.join(OUT, "vis-previews-phone.png"), fullPage: true });

      // Photo-real renders: nothing goes to the AI service until the customer agrees.
      const offered = await page.isVisible("#btn-start-ai");
      ok("phone: no photo-real render is requested before the customer agrees", renderPosts === 0 && offered, renderPosts + " requests, offer shown: " + offered);
      // Renders are driven only against the local test environment's stand-in, never a deployed
      // copy (--live): a real render costs money and goes to OpenAI.
      const live = await page.evaluate(() => !!(window.__wvr && window.__wvr.health && window.__wvr.health.renders.live && window.__wvr.health.renders.test));
      if (live && offered && !LIVE) {
        const t1 = Date.now();
        await page.click("#btn-start-ai");
        await page.waitForFunction(() => document.querySelectorAll(".result-card .badge--ai").length >= 1, null, { timeout: 60000 });
        await page.waitForTimeout(3000); // long enough for a second automatic render to show, if there were one
        const rendered = await page.locator(".result-card .badge--ai").count();
        const offers = await page.locator(".result-card .link-btn:visible", { hasText: "Create AI render" }).count();
        ok("phone: once agreed, the chosen roof renders automatically and the other 7 offer a render", rendered === 1 && offers === 7, rendered + " rendered, " + offers + " offered, " + (Date.now() - t1) + " ms");
        await page.locator(".result-card .link-btn:visible", { hasText: "Create AI render" }).first().click();
        const second = await page
          .waitForFunction(() => document.querySelectorAll(".result-card .badge--ai").length >= 2, null, { timeout: 60000 })
          .then(() => true)
          .catch(() => false);
        ok("phone: tapping 'Create AI render' renders that roof too", second);
        // The composite the server serves must equal the photo it served, block for block, away from the roof.
        const exact = await page.evaluate(async () => {
          const S = window.__wvr;
          const p = JSON.parse(sessionStorage.getItem("wvr.project.v1"));
          const job = [...S.jobs.values()].find((j) => j.status === "succeeded" && j.image);
          const pixels = async (u) => {
            const r = await fetch(u, { headers: { Authorization: "Bearer " + p.token } });
            const bm = await createImageBitmap(await r.blob());
            const c = document.createElement("canvas");
            c.width = bm.width;
            c.height = bm.height;
            const x = c.getContext("2d");
            x.drawImage(bm, 0, 0);
            return x.getImageData(0, 0, c.width, c.height);
          };
          const a = await pixels("/api/wvroofing/projects/" + p.id + "/photo/display");
          const b = await pixels("/api/wvroofing/projects/" + p.id + "/renders/" + job.id + "/image");
          const w = a.width;
          const h = a.height;
          const alpha = S.analysis.alpha;
          let blocks = 0;
          let bad = 0;
          for (let by = 0; by + 16 <= h; by += 16) {
            for (let bx = 0; bx + 16 <= w; bx += 16) {
              let near = false;
              for (let y = by - 32; y < by + 48 && !near; y++) for (let x = bx - 32; x < bx + 48; x++) if (y >= 0 && x >= 0 && y < h && x < w && alpha[y * w + x] > 0.001) { near = true; break; }
              if (near) continue;
              blocks++;
              let diff = 0;
              for (let y = by; y < by + 16; y++) for (let x = bx; x < bx + 16; x++) { const i = (y * w + x) * 4; diff += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]); }
              if (diff > 0) bad++;
            }
          }
          return { blocks, bad, size: w + "x" + h, sameSize: w === b.width && h === b.height };
        });
        ok("phone: the served composite matches the photo outside the roof", exact.sameSize && exact.blocks > 100 && exact.bad === 0, JSON.stringify(exact));
        await shot(page, { path: path.join(OUT, "vis-ai-phone.png"), fullPage: true });

        // A refresh carries on where the customer was: address, photo, outline, previews and renders.
        const posts = renderPosts;
        await page.reload({ waitUntil: "load" });
        const back = await page
          .waitForFunction(() => {
            const cmp = document.querySelector('[data-panel="compare"]');
            return cmp && !cmp.hidden && document.querySelectorAll(".result-card").length === 8 && document.querySelectorAll(".result-card .badge--ai").length >= 2;
          }, null, { timeout: 60000 })
          .then(() => true)
          .catch(() => false);
        const home = (await page.textContent("#sum-home")) || "";
        ok("phone: after a refresh the address, previews and photo-real renders are all back", back && /Test Road/.test(home), home);
        await page.click("#btn-edit-mark");
        await page.waitForSelector('[data-panel="mark"]:not([hidden])', { timeout: 10000 });
        const pctAfter = await page.textContent("#mark-pct");
        ok("phone: after a refresh the outline is still there to edit", pctAfter && pctAfter !== "0%", pctAfter);
        await page.click("#btn-compare");
        await page.waitForSelector('[data-panel="compare"]:not([hidden])', { timeout: 10000 });
        await page.waitForTimeout(1500);
        const jobs = await page.evaluate(async () => {
          const p = JSON.parse(sessionStorage.getItem("wvr.project.v1"));
          const r = await fetch("/api/wvroofing/projects/" + p.id + "/renders", { headers: { Authorization: "Bearer " + p.token } });
          return (await r.json()).renders.length;
        });
        ok("phone: nothing was rendered twice because of the refresh", jobs === 2, jobs + " render jobs on the server (" + (renderPosts - posts) + " repeat requests answered from the existing job)");
      }
      // An enquiry about this photo: sent with the project (the server attaches the images).
      if (!LIVE) {
        await page.click("#btn-quote");
        await page.waitForSelector('[data-panel="enquiry"]:not([hidden])', { timeout: 5000 });
        const imagesOffered = await page.isVisible("#v-images-row");
        await page.fill("#v-name", "QA Phone");
        await page.fill("#v-phone", "0151 496 0000");
        await page.check("#v-consent");
        await page.waitForTimeout(2700);
        const sent = page.waitForResponse((r) => isPath(r, /\/projects\/[^/]+\/enquiry$/) && r.request().method() === "POST", { timeout: 30000 }).catch(() => null);
        await page.click('#quote-form button[type="submit"]');
        const sentRes = await sent;
        await page.waitForSelector("#enquiry-done:not([hidden])", { timeout: 20000 }).catch(() => null);
        const st = (await page.textContent("#enquiry-done")) || "";
        ok("phone: an enquiry about my photo is saved with a reference and the images offered", imagesOffered && !!sentRes && sentRes.status() === 201 && REF.test(st) && /notified/.test(st), (sentRes ? sentRes.status() : "no request") + " " + st);
        await shot(page, { path: path.join(OUT, "vis-enquiry-phone.png"), fullPage: true });
      }
      // Delete it all again from the summary (this also tidies up the project the check created).
      await page.waitForSelector("#btn-delete-project:not([hidden])", { timeout: 5000 }).catch(() => null);
      const del = page.waitForResponse((r) => isPath(r, /\/delete$/), { timeout: 30000 }).catch(() => null);
      await page.click("#btn-delete-project");
      const delRes = await del;
      await page.waitForSelector('[data-panel="photo"]:not([hidden])', { timeout: 10000 }).catch(() => null);
      const kept = await page.evaluate(() => sessionStorage.getItem("wvr.project.v1"));
      const gone = !/project=/.test(page.url());
      ok("phone: 'Delete my photo and project' deletes it all and forgets it", !!delRes && delRes.status() === 200 && kept === null && gone, delRes ? String(delRes.status()) : "no delete");
    }
    ok("phone visualiser has no console errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${OUT}`);
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
