// SC Design Wirral — live smoke check of the deployed site and its API, read-only.
//
//   node scripts/live-smoke.mjs [--site https://scdesignwirral.co.uk] [--api https://scdesign-wirral.vercel.app]
//
// - Every URL in the sitemap, plus the unlisted areas (admin, WV Roofing, MTCW, the sandbox),
//   answers 200 with its page (an <h1>, no server-error page).
// - Every serverless function starts: a CORS preflight (OPTIONS) to each answers below 500,
//   the admin endpoints refuse a request with no session (401), and the health endpoints answer.
// Nothing is written: no form, no event, no login attempt (the login is only preflighted).
// Prints PASS / FAIL lines and a total, in the browser QA's format (scripts/wvroofing/qa-annotate.mjs).
const opt = (n, d) => {
  const i = process.argv.indexOf("--" + n);
  return i === -1 ? d : process.argv[i + 1];
};
const SITE = String(opt("site", "https://scdesignwirral.co.uk")).replace(/\/$/, "");
const API = String(opt("api", "https://scdesign-wirral.vercel.app")).replace(/\/$/, "");
const ORIGIN = "https://scdesignwirral.co.uk";

let passed = 0;
let total = 0;
const ok = (name, pass, detail) => {
  total++;
  if (pass) passed++;
  console.log((pass ? "PASS " : "FAIL ") + name + (detail ? " - " + detail : ""));
};
const get = async (url, init) => {
  try {
    const r = await fetch(url, Object.assign({ redirect: "follow", headers: { "user-agent": "sc-live-smoke" } }, init || {}));
    return { status: r.status, text: await r.text(), type: r.headers.get("content-type") || "" };
  } catch (e) {
    return { status: 0, text: String(e && e.message), type: "" };
  }
};

// ---- pages ----------------------------------------------------------------------------
const sitemap = await get(SITE + "/sitemap.xml");
const locs = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
ok("sitemap.xml lists the site's pages", sitemap.status === 200 && locs.length > 20, sitemap.status + ", " + locs.length + " URLs");
const extra = ["/admin/", "/WVROOFING/", "/WVROOFING/roof-replacement/", "/WVROOFING/visualiser/", "/WVROOFING/privacy/", "/WVROOFING/admin/", "/WVROOFING/2/", "/WVROOFING/2/admin/", "/MTCW/", "/samantha/"];
const pages = [...new Set(locs.map((u) => u.replace(/^https?:\/\/[^/]+/, "")).concat(extra))];
const bad = [];
const queue = pages.slice();
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const p = queue.shift();
      const r = await get(SITE + p);
      const html = /text\/html/.test(r.type);
      if (r.status !== 200 || (html && (!/<h1[\s>]/i.test(r.text) || /Application error|Internal Server Error/i.test(r.text)))) bad.push(p + " (" + r.status + (html && r.status === 200 ? ", no <h1> or an error page" : "") + ")");
    }
  })
);
ok("every page answers 200 with its content (" + pages.length + " pages)", bad.length === 0, bad.slice(0, 12).join("; "));
for (const f of ["/robots.txt", "/favicon.ico", "/apple-touch-icon.png"]) {
  const r = await get(SITE + f);
  ok(f + " is served", r.status === 200, String(r.status));
}

// ---- functions --------------------------------------------------------------------------
const FUNCTIONS = ["sc-admin-enquiries", "sc-admin-error-logs", "sc-admin-login", "sc-admin-logout", "sc-admin-projects", "sc-admin-publish", "sc-admin-stats", "sc-analytics-collect", "sc-enquiry-backup", "sc-error-collect", "mtcw"];
for (const fn of FUNCTIONS) {
  const r = await get(API + "/api/" + fn, { method: "OPTIONS", headers: { origin: ORIGIN, "access-control-request-method": "POST" } });
  ok("function " + fn + " starts (preflight)", r.status > 0 && r.status < 500, String(r.status));
}
for (const fn of ["sc-admin-enquiries", "sc-admin-error-logs", "sc-admin-projects", "sc-admin-stats"]) {
  const r = await get(API + "/api/" + fn, { headers: { origin: ORIGIN } });
  ok("function " + fn + " refuses a request with no session", r.status === 401, String(r.status));
}
const mtcw = await get(API + "/api/mtcw", { headers: { origin: ORIGIN } });
ok("MTCW health answers", mtcw.status === 200 && /"ok"\s*:\s*true/.test(mtcw.text), String(mtcw.status));
const wv = await get(API + "/api/wvroofing/health");
ok("WV Roofing health answers (the one routed function)", wv.status === 200 && /"ok"\s*:\s*true/.test(wv.text), String(wv.status));

console.log(passed + "/" + total + " checks passed.");
process.exit(passed === total ? 0 : 1);
