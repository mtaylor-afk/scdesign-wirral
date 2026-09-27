/* ============================================================
   SC Design Wirral — Admin analytics portal (client app)
   Self-contained: login -> fetch stats -> render reports.
   Talks to the SC-only Vercel API; auth via HttpOnly session cookie.
   ============================================================ */

/* If the Vercel production domain ever changes, update this one line. */
const API_BASE = "https://scdesign-wirral.vercel.app";
const LOGIN = API_BASE + "/api/sc-admin-login";
const LOGOUT = API_BASE + "/api/sc-admin-logout";
const STATS = API_BASE + "/api/sc-admin-stats";
const ENQUIRIES = API_BASE + "/api/sc-admin-enquiries";
const ERROR_LOGS = API_BASE + "/api/sc-admin-error-logs";
/* Projects CMS — read/write the editing store, and commit to the live repo. */
const PROJECTS = API_BASE + "/api/sc-admin-projects";
const PUBLISH = API_BASE + "/api/sc-admin-publish";

const state = {
  range: "7d",
  bots: false,
  // The PANEL currently shown. Panels are grouped into sidebar destinations by
  // DEST below, but every guard in this file still tests a panel id, so this
  // value means exactly what it always did.
  view: "today",
  // Last panel used within each multi-panel destination, so coming back to
  // Visitors returns you to the report you were reading, not to Overview.
  tabOf: {},
  // Counts shown beside a sidebar item. Loaded separately and best-effort: a
  // missing badge shows nothing rather than blocking the page.
  badges: {},
  today: null,
  trendMetric: "pageviews",
  data: null,
  realtime: null,
  rtTimer: null,
  journeys: null,
  journeyFilter: "all",
  flow: null,
  flowPage: null,
  // Which source the Sources page has been drilled into, and the journeys that came
  // from it. Held in memory, NOT in the hash: error-capture.js sends the full URL with
  // every client error, and a referrer or campaign name in a route would be written
  // into sc_errors on the next unrelated fault.
  srcSel: null,
  srcJourneys: null,
  srcOrder: "asc", // chronological by default, as asked for
  delivery: null,
  errTrend: null,
  enquiries: null,
  enqPage: 1,
  // Enquiries that were SAVED but whose notification email never sent. A silent
  // failure here means a real lead sits in the table with nobody told, which is
  // exactly what happened between Jul and Sep 2026 — so it gets said out loud.
  enqUnnotified: null,
  errorLogs: null,
  errPage: 1,
  errBots: "exclude", // exclude | include | only
  // Whose error: site | all | third. Extension faults are flagged, never
  // dropped — but they are not faults in the website, so they are out of the
  // way by default rather than burying the ones that matter.
  errParty: "site",
  // "Download all error logs": skip anything a previous download already took.
  errOnlyNew: true,
  errExporting: false,
  errExportNote: "", // one-line feedback under the button
  logins: null,
  health: null,
  loginPage: 1,
  loginKind: "logins", // logins | logins_failed | logins_success
  loginBots: "include",
};

/* ---------------- formatting helpers ---------------- */
const fmt = (n) => (n === null || n === undefined ? "–" : Number(n).toLocaleString("en-GB"));
const pct = (n) => (n === null || n === undefined ? "–" : n + "%");
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : s);
function dur(s) {
  s = Math.round(s || 0);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  const ss = s % 60;
  if (m < 60) return ss ? `${m}m ${ss}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
// Return the URL only if it uses an http(s) scheme. esc() escapes HTML but does
// NOT neutralise dangerous schemes (javascript:/data:), so every server-supplied
// value must pass through here before being rendered as a clickable href.
function safeHref(v) {
  return /^https?:\/\//i.test(String(v == null ? "" : v)) ? String(v) : null;
}
function ago(ts) {
  const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  return Math.floor(m / 60) + "h ago";
}
function delta(cur, prev, lowerIsBetter) {
  if (cur == null || prev == null) return "";
  if (prev === 0) return cur > 0 ? `<span class="delta up">▲ new</span>` : "";
  const ch = Math.round(((cur - prev) / prev) * 100);
  if (ch === 0) return `<span class="delta flat">● 0%</span>`;
  const up = ch > 0;
  const good = lowerIsBetter ? !up : up;
  return `<span class="delta ${good ? "up" : "down"}">${up ? "▲" : "▼"} ${Math.abs(ch)}%</span>`;
}
let _regionDN, _langDN;
try { _regionDN = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) {}
try { _langDN = new Intl.DisplayNames(["en"], { type: "language" }); } catch (e) {}
function countryName(cc) {
  if (!cc || cc.length !== 2) return cc || "(unknown)";
  try { return (_regionDN && _regionDN.of(cc)) || cc; } catch (e) { return cc; }
}
function langName(l) {
  if (!l) return l;
  try { return (_langDN && _langDN.of(l)) || l; } catch (e) { return l; }
}
function flag(cc) {
  if (!cc || cc.length !== 2) return "";
  try {
    return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  } catch (e) { return ""; }
}
function rangeLabel() {
  return { "24h": "Last 24 hours", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" }[state.range];
}
const EVENT_LABELS = {
  phone_click: "Phone click", email_click: "Email click", whatsapp_click: "WhatsApp click",
  cta_click: "CTA click", service_click: "Service click", location_click: "Area click",
  google_review_click: "Review click", form_submit: "Form submit", outbound_link: "Outbound link",
  visualiser_start: "Visualiser start", visualiser_complete: "Visualiser complete",
  visualiser_refine: "Visualiser refine", visualiser_error: "Visualiser error",
  visualiser_download: "Visualiser download",
  // The contact-form funnel. These have been recorded since June and had no names
  // here, so they appeared under their raw event ids.
  contact_form_submitted: "Enquiry sent", contact_form_success: "Enquiry delivered",
  contact_form_validation_error: "Enquiry form error",
  visualiser_handoff_submitted: "Concept sent to Sean",
  visualiser_estimate_shown: "Price estimate shown",
  visualiser_refine_submit: "Visualiser changes asked for",
  visualiser_refine_accept: "Visualiser changes accepted",
  cost_estimate_handoff_clicked: "Cost estimator → enquiry",
  reviews_carousel: "Reviews carousel",
  form_start: "Form started", form_abandon: "Form abandoned",
  page_not_found: "Page not found (404)", cta_view: "CTA seen",
};
const eventLabel = (n) => EVENT_LABELS[n] || cap((n || "").replace(/_/g, " "));

/* ---------------- chart helpers ---------------- */
function loader() { return `<div class="loader">Loading…</div>`; }

function fmtT(t) {
  if (!t) return "";
  if (t.length <= 10) {
    const d = new Date(t + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }
  return t.slice(11, 13) + ":00";
}

function lineChart(series, key) {
  if (!series || !series.length) return `<div class="empty">No data in this period yet.</div>`;
  const W = 760, H = 210, pad = 30;
  const vals = series.map((d) => d[key] || 0);
  const max = Math.max(1, ...vals);
  const n = series.length;
  const x = (i) => pad + (n <= 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (n - 1));
  const y = (v) => H - pad - (v / max) * (H - 2 * pad);
  const pts = series.map((d, i) => `${x(i).toFixed(1)},${y(d[key] || 0).toFixed(1)}`);
  const line = "M" + pts.join(" L");
  const area = `M${x(0).toFixed(1)},${H - pad} L` + pts.join(" L") + ` L${x(n - 1).toFixed(1)},${H - pad} Z`;
  const idx = [...new Set([0, Math.floor(n / 2), n - 1])];
  const xl = idx
    .map((i) => `<text class="gl" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${fmtT(series[i].t)}</text>`)
    .join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Time series chart">
    <line class="axis" x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}"/>
    <path class="area" d="${area}"/>
    <path class="line" d="${line}"/>
    <text class="gl" x="${pad}" y="${pad - 10}">${fmt(max)}</text>
    ${xl}
  </svg>`;
}

function barList(items, opt) {
  opt = opt || {};
  if (!items || !items.length) return `<div class="empty">${opt.empty || "No data yet."}</div>`;
  const list = items.slice(0, opt.limit || 10);
  const max = Math.max(...list.map((i) => i.count), 1);
  return (
    '<div class="barlist">' +
    list
      .map((i) => {
        const w = (i.count / max) * 100;
        const label = opt.fmt ? opt.fmt(i.key) : esc(String(i.key));
        return `<div class="barrow"><div class="bar" style="width:${w.toFixed(1)}%"></div><div class="lbl">${label}</div><div class="num">${fmt(i.count)}</div></div>`;
      })
      .join("") +
    "</div>"
  );
}

function vbars(values, labels) {
  const max = Math.max(1, ...values);
  const bars = values
    .map((v, i) => `<div class="vbarwrap"><div class="vbar" style="height:${((v / max) * 100).toFixed(1)}%" title="${esc(labels[i] || i)}: ${fmt(v)}"></div></div>`)
    .join("");
  const labs = labels.map((l) => `<span>${esc(l)}</span>`).join("");
  return `<div class="vbars">${bars}</div><div class="vbarlabels">${labs}</div>`;
}

function kpi(label, val, sub, deltaHtml) {
  return `<div class="card kpi"><div class="label">${label}</div><div class="val">${val}</div><div class="sub">${deltaHtml || ""} ${sub || ""}</div></div>`;
}

/* What actually counts as getting in touch. `form_submit` is deliberately absent:
   it fires before the form validates, so it also counts submissions that never
   sent and spam bots tripping the honeypot. */
function convItems(d) {
  const names = [
    "contact_form_success", "visualiser_handoff_submitted",
    "phone_click", "email_click", "whatsapp_click",
    "cta_click", "visualiser_start",
  ];
  return d.events.byName
    .filter((i) => names.includes(i.key))
    .sort((a, b) => names.indexOf(a.key) - names.indexOf(b.key));
}

/* ---------------- views ---------------- */
function viewOverview() {
  const d = state.data;
  if (!d) return loader();
  const m = d.metrics, p = d.prevMetrics;
  const hasLeads = m.enquiries !== undefined;
  const kpis = [
    // Leads first. The panel used to open with six figures about traffic and nothing
    // about whether any of it turned into work.
    hasLeads ? kpi("Enquiries", fmt(m.enquiries), "details reached us", delta(m.enquiries, p.enquiries)) : "",
    hasLeads ? kpi("Enquiry rate", m.enquiryRate + "%", "of visitors", delta(m.enquiryRate, p.enquiryRate)) : "",
    hasLeads ? kpi("Calls &amp; emails", fmt(m.intents), "phone, email, WhatsApp", delta(m.intents, p.intents)) : "",
    kpi("Unique visitors", fmt(m.visitors), "", delta(m.visitors, p.visitors)),
    kpi("Visits", fmt(m.sessions), "", delta(m.sessions, p.sessions)),
    kpi("Page views", fmt(m.pageviews), "", delta(m.pageviews, p.pageviews)),
    kpi("Bounce rate", pct(m.bounceRate), "", delta(m.bounceRate, p.bounceRate, true)),
    kpi("Avg. visit", dur(m.avgDuration), "", delta(m.avgDuration, p.avgDuration)),
    kpi("Pages / visit", m.pagesPerVisit, "", delta(m.pagesPerVisit, p.pagesPerVisit)),
  ].filter(Boolean).join("");
  return `
    <div class="grid kpis">${kpis}</div>
    <div class="card" style="margin-bottom:16px"><h3>Visitors &amp; page views</h3><div class="csub">${rangeLabel()} · by ${d.meta.range === "24h" ? "hour" : "day"}</div>${lineChart(d.timeseries, "pageviews")}</div>
    <div class="grid cols-2">
      <div class="card"><h3>Top pages</h3><div class="csub">Most-viewed pages</div>${barList(d.pages.map((p) => ({ key: p.path, count: p.views })), { limit: 7, empty: "No page views yet." })}</div>
      <div class="card"><h3>Top sources</h3><div class="csub">Where visitors come from</div>${barList(d.sources.channels, { limit: 7, fmt: cap })}</div>
      <div class="card"><h3>Top locations</h3><div class="csub">By country</div>${barList(d.locations.countries, { limit: 7, fmt: (k) => flag(k) + " " + countryName(k) })}</div>
      <div class="card"><h3>Conversions</h3><div class="csub">Key actions taken</div>${barList(convItems(d), { limit: 7, fmt: eventLabel, empty: "No conversions yet." })}</div>
    </div>`;
}

function viewTrends() {
  const d = state.data;
  if (!d) return loader();
  const m = state.trendMetric;
  return `
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div><h3>Traffic over time</h3><div class="csub">${rangeLabel()} · by ${d.meta.range === "24h" ? "hour" : "day"}</div></div>
        <div class="seg">
          <button data-m="pageviews" class="${m === "pageviews" ? "active" : ""}">Page views</button>
          <button data-m="visitors" class="${m === "visitors" ? "active" : ""}">Visitors</button>
        </div>
      </div>
      ${lineChart(d.timeseries, m)}
    </div>
    <div class="grid cols-2">
      <div class="card"><h3>By day of week</h3><div class="csub">Page views (UTC)</div>${vbars(d.patterns.dayOfWeek, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])}</div>
      <div class="card"><h3>By hour of day</h3><div class="csub">Page views (UTC, 00–23)</div>${vbars(d.patterns.hourOfDay, Array.from({ length: 24 }, (_, i) => (i % 6 === 0 ? String(i) : "")))}</div>
    </div>`;
}

function viewPages() {
  const d = state.data;
  if (!d) return loader();
  const rows = d.pages
    .map((p) => `<tr><td class="pathcell" title="${esc(p.path)}">${esc(p.path)}</td><td class="num">${fmt(p.views)}</td><td class="num">${fmt(p.visitors)}</td><td class="num">${dur(p.avgTime)}</td></tr>`)
    .join("");
  return `
    <div class="card" style="margin-bottom:16px"><h3>All pages</h3><div class="csub">${rangeLabel()}</div>
      <table class="tbl"><thead><tr><th>Page</th><th class="num">Views</th><th class="num">Visitors</th><th class="num">Avg. time</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" class="empty">No page views yet.</td></tr>'}</tbody></table>
    </div>
    <div class="grid cols-2">
      <div class="card"><h3>Entry pages</h3><div class="csub">Where visits start</div>${barList(d.entryPages, { limit: 10 })}</div>
      <div class="card"><h3>Exit pages</h3><div class="csub">Where visits end</div>${barList(d.exitPages, { limit: 10 })}</div>
    </div>`;
}

/* ---------------- Sources (and the drill-down into one source) ----------------
 *
 * Every row here is a way in. Clicking one asks the server for every visit that
 * arrived that way and shows them in order, with the enquiry or the visualiser
 * session it produced attached in full.
 *
 * The counts come from `*Perf`, not from the page-view lists beside them: those
 * answer "how much traffic", these answer "which traffic was worth having". They
 * are counted per VISITOR, and a visitor's channel comes from their first page
 * view — an event row's own channel is always "direct" because track() sends no
 * referrer, so counting conversions by their own row would report every lead on
 * the site as direct traffic.
 */
function perfTable(items, opt) {
  opt = opt || {};
  const label = opt.label || "Source";
  if (!items || !items.length)
    return `<div class="empty">${opt.empty || "Nothing recorded yet."}</div>`;
  const rows = items
    .slice(0, opt.limit || 25)
    .map((i) => {
      const shown = opt.fmt ? opt.fmt(i.key) : esc(i.key);
      // A <tr> given role="button" gets no name from its cells, so without this a
      // screen reader announces every row as just "button".
      const name = `${opt.kind === "channel" ? cap(i.key) : i.key}: ${i.visitors} ${i.visitors === 1 ? "visitor" : "visitors"}, ${i.enquiries} ${i.enquiries === 1 ? "enquiry" : "enquiries"}. Show visits`;
      return `<tr class="srcrow" data-srcgo="${esc(opt.kind + ":" + i.key)}" tabindex="0" role="button" aria-label="${esc(name)}">
        <td class="srckey" title="${esc(i.key)}">${shown}<span class="srcchev" aria-hidden="true">›</span></td>
        <td class="num">${fmt(i.visitors)}</td>
        <td class="num">${fmt(i.pageviews)}</td>
        <td class="num${i.enquiries ? " strong" : ""}">${fmt(i.enquiries)}</td>
        <td class="num">${fmt(i.intents)}</td>
        <td class="num">${i.visitors ? i.rate + "%" : "–"}</td>
      </tr>`;
    })
    .join("");
  return `<table class="tbl srctbl">
    <thead><tr><th>${esc(label)}</th><th class="num">Visitors</th><th class="num">Views</th><th class="num">Enquiries</th><th class="num">Calls / emails</th><th class="num">Rate</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function viewSources() {
  if (state.srcSel) return viewSourceDetail();
  const d = state.data;
  if (!d) return loader();
  const s = d.sources;
  // Older bundles (a cached response mid-deploy) have no *Perf — fall back rather
  // than throwing and showing "Could not load" on a page that has data.
  if (!s.channelPerf) {
    return `
      <div class="grid cols-2">
        <div class="card"><h3>Channels</h3><div class="csub">Traffic by type</div>${barList(s.channels, { limit: 8, fmt: cap })}</div>
        <div class="card"><h3>Referrers</h3><div class="csub">Sites linking to you</div>${barList(s.referrers, { limit: 12, empty: "No referrers yet (traffic is direct)." })}</div>
      </div>`;
  }
  return `
    <div class="callout">
      <strong>Click any row</strong> to see every visit that came in that way, in order — what they read,
      how long they stayed, and the enquiry or visualiser concept it turned into.
      <div class="callout-sub">Enquiries and calls are counted against the visitor's <em>first</em> page view, which is the only record of where they actually came from.</div>
    </div>
    <div class="card" style="margin-bottom:16px"><h3>Channels</h3><div class="csub">How visitors found you · ${rangeLabel()}</div>
      ${perfTable(s.channelPerf, { kind: "channel", label: "Channel", fmt: (k) => esc(cap(k)), empty: "No traffic in this period." })}
    </div>
    <div class="card" style="margin-bottom:16px"><h3>Referrers</h3><div class="csub">Sites sending you visitors</div>
      ${perfTable(s.referrerPerf, { kind: "referrer", label: "Site", empty: "No referrers yet — all traffic arrived direct or from search without a referrer." })}
    </div>
    <div class="card" style="margin-bottom:16px"><h3>Landing pages</h3><div class="csub">The first page each visitor saw</div>
      ${perfTable(s.entryPerf, { kind: "entry", label: "Page", empty: "No page views yet." })}
    </div>
    <div class="card"><h3>Campaigns (UTM)</h3><div class="csub">source / medium / campaign</div>
      ${perfTable(s.campaignPerf, { kind: "campaign", label: "Campaign", empty: "No UTM-tagged campaigns yet. Add <code>?utm_source=…&amp;utm_medium=…</code> to links you share so they can be told apart." })}
    </div>`;
}

const SRC_KIND_LABELS = { channel: "Channel", referrer: "Referrer", campaign: "Campaign", entry: "Landing page", all: "All traffic" };

function srcTitle(sel) {
  const kind = SRC_KIND_LABELS[sel.kind] || cap(sel.kind);
  const value = sel.kind === "channel" ? cap(sel.value) : sel.value;
  return `${kind}: ${value || "(none)"}`;
}

/* Props the collector stamps on every row itself. They describe the RECORD, not what
   the visitor did, so they are noise in a timeline ("Bot: false" on every step).
   Mirrors SERVER_PROPS in api/sc-admin-stats.js. */
const SERVER_PROP_KEYS = new Set([
  "vid", "ref", "channel", "title", "sw", "sh", "vw", "vh", "dpr", "lang", "tz",
  "region", "city", "bv", "osv", "bot", "dur", "scroll", "utm", "pvid",
]);

/** Everything the visualiser recorded during one visit. */
function visualiserBlock(v) {
  if (!v) return "";
  const stage = (on, label) => `<span class="pill ${on ? "green" : "grey"}">${on ? "✓" : "–"} ${label}</span>`;
  const steps = v.steps
    .map((a) => {
      const p = a.props || {};
      const bits = Object.keys(p)
        .filter((k) => !SERVER_PROP_KEYS.has(k) && p[k] !== null && p[k] !== "" && typeof p[k] !== "object")
        .map((k) => `${esc(cap(k.replace(/_/g, " ")))}: <strong>${esc(String(p[k]))}</strong>`);
      return `<li><span class="vtime">${clockTime(a.ts)}</span> <span class="vname">${esc(eventLabel(a.name))}</span>${bits.length ? `<span class="vprops">${bits.join(" · ")}</span>` : ""}</li>`;
    })
    .join("");
  return `<div class="sjblock">
    <h4>Visualiser session</h4>
    <div class="sjstages">
      ${stage(v.started, "Started")}${stage(v.refined, "Asked for changes")}${stage(v.completed, "Concept produced")}
      ${stage(v.downloaded, "Downloaded")}${stage(v.handedOff, "Sent to Sean")}
      ${v.errored ? '<span class="pill amber">Hit an error</span>' : ""}
    </div>
    <ol class="vsteps">${steps}</ol>
  </div>`;
}

function sourceJourneyCard(j, i) {
  const steps = (j.steps || [])
    .map((s) => {
      const acts = (s.actions || [])
        .map((a) => `<span class="actpill ${isConvName(a.name) || ENQ_ACT.has(a.name) ? "conv" : ""}" title="${esc(a.name)}">${esc(eventLabel(a.name))}${actDetail(a)}</span>`)
        .join("");
      const meta = [];
      if (s.timeOnPage) meta.push(dur(s.timeOnPage));
      if (s.scroll) meta.push("scrolled " + s.scroll + "%");
      meta.push(clockTime(s.ts));
      return `<li class="jstep${s.newSession ? " jstep-new" : ""}">
        <div class="jstep-top">
          <span class="jstep-path" title="${esc(s.path)}">${s.title ? esc(s.title) : esc(s.path)}</span>
          <span class="jstep-time">${s.timeOnPage ? dur(s.timeOnPage) : "&ndash;"}</span>
        </div>
        <div class="jstep-sub">${esc(s.path)} <span class="dot">·</span> ${meta.join(' <span class="dot">·</span> ')}</div>
        ${acts ? `<div class="jstep-acts">${acts}</div>` : ""}
      </li>`;
    })
    .join("");

  const o = j.outcome || {};
  const enq = j.enquiries || [];
  const badges = [
    o.enquiry ? '<span class="pill green">Enquiry</span>' : "",
    o.visualiser ? '<span class="pill blue">Visualiser</span>' : "",
    o.intent ? '<span class="pill amber">Called / emailed</span>' : "",
    // A send that produced no delivered enquiry is the single most useful thing on
    // this page, so it is said plainly rather than left as an absence.
    !o.enquiry && o.attempted ? '<span class="pill red">Tried to send</span>' : "",
    `<span class="pill grey">${j.pages} ${j.pages === 1 ? "page" : "pages"}</span>`,
    `<span class="pill grey">${dur(j.durationS)}</span>`,
  ].filter(Boolean).join("");

  const enqBlocks = enq
    .map(
      (m) => `<div class="sjblock">
        <h4>Enquiry received ${m.confidence === "confirmed"
          ? '<span class="pill green">matched to this visit</span>'
          : '<span class="pill amber" title="This enquiry was saved before visits were stamped, so it is matched on time alone">probably this visit</span>'}</h4>
        ${enquiryDetail(m.row)}
      </div>`
    )
    .join("");

  const techBits = [cap(j.device), j.browser, j.os].filter(Boolean).join(" · ");
  const src = j.referrerHost ? cap(j.channel) + " · " + esc(j.referrerHost) : cap(j.channel);
  const utm = j.utm && (j.utm.source || j.utm.campaign)
    ? ` <span class="dot">·</span> ${esc([j.utm.source, j.utm.campaign].filter(Boolean).join("/"))}`
    : "";

  return `<div class="journey${o.enquiry ? " is-lead" : j.converted ? " is-conv" : ""}" data-sjx="${i}">
    <button class="jhead" data-sjtoggle="${i}" type="button">
      <span class="javatar">${o.enquiry ? "✉" : o.visualiser ? "◈" : visitorShort(j.vid).slice(0, 1).toUpperCase()}</span>
      <span class="jident">
        <span class="jvisitor">${enq.length && enq[0].row.name ? esc(enq[0].row.name) : "Visitor " + esc(visitorShort(j.vid))}</span>
        <span class="jsub">${placeLabel(j)} <span class="dot">·</span> ${esc(techBits)}</span>
      </span>
      <span class="jbadges">${badges}</span>
      <span class="jwhen">${whenLabel(j.firstTs)}</span>
      <span class="jchev" aria-hidden="true">▾</span>
    </button>
    <div class="jbody">
      <div class="jsource">Arrived: ${src}${utm} <span class="dot">·</span> Landed on <code>${esc(j.entry)}</code> <span class="dot">·</span> ${j.sessions} ${j.sessions === 1 ? "session" : "sessions"}</div>
      <ol class="jsteps">${steps || '<li class="empty">No pages recorded.</li>'}</ol>
      ${j.stepsTruncated ? '<div class="csub" style="margin-top:8px">Timeline truncated to the first 60 steps.</div>' : ""}
      ${enqBlocks}
      ${visualiserBlock(j.visualiser)}
    </div>
  </div>`;
}

const ENQ_ACT = new Set(["contact_form_success", "contact_form_submitted", "visualiser_handoff_submitted"]);

function viewSourceDetail() {
  const sel = state.srcSel;
  const back = `<button class="btn btn-ghost srcback" data-srcback="1" type="button">← All sources</button>`;
  const d = state.srcJourneys;
  if (!d) return `<div class="srcheadrow">${back}<h3 class="srchead">${esc(srcTitle(sel))}</h3></div>${loader()}`;
  if (d.failed)
    return `<div class="srcheadrow">${back}<h3 class="srchead">${esc(srcTitle(sel))}</h3></div>
      <div class="card"><div class="empty">Could not load these visits. Try Refresh.</div></div>`;

  const s = d.summary;
  const list = state.srcOrder === "desc" ? (d.journeys || []).slice().reverse() : d.journeys || [];
  const cards = list.length
    ? list.map((j, i) => sourceJourneyCard(j, i)).join("")
    : '<div class="card"><div class="empty">No visits from this source in the selected period.</div></div>';

  return `
    <div class="srcheadrow">
      ${back}
      <h3 class="srchead">${esc(srcTitle(sel))}</h3>
      <div class="seg srcorder">
        <button data-srcorder="asc" class="${state.srcOrder === "asc" ? "active" : ""}">Oldest first</button>
        <button data-srcorder="desc" class="${state.srcOrder === "desc" ? "active" : ""}">Newest first</button>
      </div>
    </div>
    <div class="grid kpis">
      ${kpi("Visits", fmt(s.visitors), rangeLabel())}
      ${kpi("Enquiries", fmt(s.withEnquiry), s.visitors ? Math.round((s.withEnquiry / s.visitors) * 100) + "% of visits" : "")}
      ${kpi("Used the visualiser", fmt(s.withVisualiser), "")}
      ${kpi("Called or emailed", fmt(s.withIntent), "")}
      ${kpi("Avg. time", dur(s.avgDuration), "per visit")}
    </div>
    ${s.attempted > s.withEnquiry
      ? `<div class="callout callout-warn"><strong>${fmt(s.attempted - s.withEnquiry)} ${s.attempted - s.withEnquiry === 1 ? "visit" : "visits"} pressed send without an enquiry being delivered.</strong> Those are marked <em>Tried to send</em> below — check the Delivery tab under Conversions.</div>`
      : ""}
    <div class="journeys">${cards}</div>
    ${d.meta.matched > d.meta.returned
      ? `<div class="csub" style="margin-top:12px">Showing the ${fmt(d.meta.returned)} most recent of ${fmt(d.meta.matched)} visits from this source.</div>`
      : ""}`;
}

function viewLocations() {
  const d = state.data;
  if (!d) return loader();
  return `<div class="grid cols-3">
    <div class="card"><h3>Countries</h3>${barList(d.locations.countries, { limit: 15, fmt: (k) => flag(k) + " " + countryName(k) })}</div>
    <div class="card"><h3>Regions</h3>${barList(d.locations.regions, { limit: 15 })}</div>
    <div class="card"><h3>Cities</h3>${barList(d.locations.cities, { limit: 15 })}</div>
  </div>`;
}

function viewDevices() {
  const d = state.data;
  if (!d) return loader();
  const t = d.tech;
  return `<div class="grid cols-3">
    <div class="card"><h3>Device type</h3>${barList(t.devices, { fmt: cap })}</div>
    <div class="card"><h3>Browsers</h3>${barList(t.browsers, { limit: 10 })}</div>
    <div class="card"><h3>Operating systems</h3>${barList(t.os, { limit: 10 })}</div>
    <div class="card"><h3>Screen sizes</h3>${barList(t.screens, { limit: 10 })}</div>
    <div class="card"><h3>Languages</h3>${barList(t.languages, { limit: 10, fmt: langName })}</div>
    <div class="card"><h3>Timezones</h3>${barList(t.timezones, { limit: 10 })}</div>
  </div>`;
}

function viewEngagement() {
  const d = state.data;
  if (!d) return loader();
  const m = d.metrics;
  return `
    <div class="grid kpis">
      ${kpi("Avg. visit", dur(m.avgDuration), "")}
      ${kpi("Bounce rate", pct(m.bounceRate), "")}
      ${kpi("Pages / visit", m.pagesPerVisit, "")}
      ${kpi("Visits", fmt(m.sessions), "")}
    </div>
    <div class="grid cols-2">
      <div class="card"><h3>Time on page</h3><div class="csub">Engaged time per page view</div>${barList(d.engagement.timeOnPage, { limit: 6, empty: "No engagement data yet." })}</div>
      <div class="card"><h3>Scroll depth</h3><div class="csub">How far visitors scroll</div>${barList(d.engagement.scrollDepth, { limit: 6, empty: "No scroll data yet." })}</div>
    </div>`;
}

function viewRealtime() {
  const r = state.realtime;
  if (!r) return `<div class="loader">Loading real-time…</div>`;
  const feed = r.recent.length
    ? r.recent
        .map(
          (e) => `<div class="feeditem"><span class="ago">${ago(e.ts)}</span><span class="ev">${e.type === "event" ? eventLabel(e.name) : "Pageview"}</span><span class="pathcell" title="${esc(e.path || "")}">${esc(e.path || "")}</span><span style="margin-left:auto">${flag(e.country)} ${esc(cap(e.device || ""))}</span></div>`
        )
        .join("")
    : '<div class="empty">No activity in the last 30 minutes.</div>';
  return `
    <div class="grid kpis">
      ${kpi('<span class="rt-dot"></span>Now (5 min)', fmt(r.visitorsLast5), "visitors")}
      ${kpi("Last 30 min", fmt(r.visitorsLast30), "visitors")}
    </div>
    <div class="grid cols-2">
      <div class="card"><h3>Active pages</h3><div class="csub">Viewed in the last 5 minutes</div>${barList(r.activePages, { empty: "Nobody on the site right now." })}</div>
      <div class="card"><h3>Live activity</h3><div class="csub">Most recent events (auto-refreshes)</div><div class="feed">${feed}</div></div>
    </div>`;
}

function viewEvents() {
  const d = state.data;
  if (!d) return loader();
  const items = d.events.byName;
  const rows = items.length
    ? items
        .map((i) => `<tr><td>${eventLabel(i.key)}</td><td><code style="font-size:11px;color:var(--muted)">${esc(i.key)}</code></td><td class="num">${fmt(i.count)}</td></tr>`)
        .join("")
    : '<tr><td colspan="3" class="empty">No events recorded yet.</td></tr>';
  const conv = ["phone_click", "email_click", "whatsapp_click", "form_submit", "cta_click", "visualiser_start"];
  const perPage = conv
    .filter((n) => d.events.byPage[n])
    .map((n) => {
      const arr = Object.entries(d.events.byPage[n])
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count);
      return `<div class="card"><h3>${eventLabel(n)}</h3><div class="csub">Top pages</div>${barList(arr, { limit: 6 })}</div>`;
    })
    .join("");
  // The detail each event carries. Recorded since June and thrown away at the
  // aggregation step until now, which is why nobody could see that the contact form
  // had been falling back to a second-choice email route for three months.
  const props = d.events.props || {};
  const PROP_LABELS = {
    mode: "Mode", reason: "Why", dest: "Where to", project_type: "Project type",
    form_location: "Form location", work_type: "Work type", project: "Project", action: "Action",
    form: "Form", last_field: "Stopped at", filled: "Fields filled", from: "Came from",
  };
  // The same prop name means different things on different events: `mode` is the
  // delivery route on a sent enquiry but how the image was made on a concept.
  const PROP_LABELS_BY_EVENT = {
    contact_form_success: { mode: "How it was delivered" },
    visualiser_handoff_submitted: { mode: "How it was delivered" },
    visualiser_complete: { mode: "How the concept was made" },
  };
  const propLabel = (name, k) =>
    (PROP_LABELS_BY_EVENT[name] && PROP_LABELS_BY_EVENT[name][k]) || PROP_LABELS[k] || cap(k.replace(/_/g, " "));
  const detail = Object.keys(props)
    .sort((a, b) => {
      const ai = a.indexOf("contact_form") === 0 ? 0 : a.indexOf("visualiser") === 0 ? 1 : 2;
      const bi = b.indexOf("contact_form") === 0 ? 0 : b.indexOf("visualiser") === 0 ? 1 : 2;
      return ai - bi || (a < b ? -1 : 1);
    })
    .map((name) => {
      const keys = props[name];
      const blocks = Object.keys(keys)
        .map((k) => {
          const e = keys[k];
          const more = e.distinct > e.items.length ? `<div class="csub">and ${fmt(e.distinct - e.items.length)} more ${e.distinct - e.items.length === 1 ? "value" : "values"}</div>` : "";
          return `<div class="propblock">
            <div class="propkey">${esc(propLabel(name, k))}</div>
            ${barList(e.items.map((x) => ({ key: x.key, count: x.count })), { limit: 8 })}${more}
          </div>`;
        })
        .join("");
      return `<div class="card"><h3>${esc(eventLabel(name))}</h3><div class="csub"><code style="font-size:11px">${esc(name)}</code></div>${blocks}</div>`;
    })
    .join("");

  return `
    <div class="card" style="margin-bottom:16px"><h3>All events</h3><div class="csub">${rangeLabel()}</div>
      <table class="tbl"><thead><tr><th>Action</th><th>Event name</th><th class="num">Count</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
    ${detail ? `<h3 class="sechead">What each one recorded</h3><div class="grid cols-2" style="margin-bottom:16px">${detail}</div>` : ""}
    ${perPage ? `<h3 class="sechead">Where they happened</h3><div class="grid cols-3">${perPage}</div>` : ""}`;
}

function viewVisualiser() {
  const d = state.data;
  if (!d) return loader();
  const v = Object.fromEntries(d.visualiser.map((i) => [i.key, i.count]));
  const start = v.visualiser_start || 0,
    complete = v.visualiser_complete || 0,
    refine = v.visualiser_refine || 0,
    error = v.visualiser_error || 0,
    dl = v.visualiser_download || 0;
  const rate = start ? Math.round((complete / start) * 100) : 0;
  const funnel = [
    { key: "Started", count: start },
    { key: "Completed", count: complete },
    { key: "Refined (needs work)", count: refine },
    { key: "Downloaded", count: dl },
    { key: "Errors / safe-fail", count: error },
  ];
  return `
    <div class="grid kpis">
      ${kpi("Visualiser starts", fmt(start), "")}
      ${kpi("Completed", fmt(complete), "")}
      ${kpi("Completion rate", pct(rate), "")}
      ${kpi("Downloads", fmt(dl), "")}
    </div>
    <div class="card"><h3>Visualiser funnel</h3><div class="csub">Concept generation flow · ${rangeLabel()}</div>${barList(funnel, { empty: "No visualiser activity yet." })}</div>`;
}

/* ---------------- Content (does each part of the site earn its keep?) ---------------- */
function viewContent() {
  const d = state.data;
  if (!d) return loader();
  const groups = d.content || [];
  const rows = groups.length
    ? groups
        .map(
          (g) => `<tr>
            <td>${esc(g.label)}<div class="csub">${fmt(g.pageCount)} ${g.pageCount === 1 ? "page" : "pages"}</div></td>
            <td class="num">${fmt(g.views)}</td>
            <td class="num">${fmt(g.visitors)}</td>
            <td class="num">${g.avgTime ? dur(g.avgTime) : "–"}</td>
            <td class="num">${g.avgScroll ? g.avgScroll + "%" : "–"}</td>
            <td class="num${g.leads ? " strong" : ""}">${fmt(g.leads)}</td>
            <td class="num">${g.leads ? g.leadRate + "%" : "–"}</td>
          </tr>`
        )
        .join("")
    : '<tr><td colspan="7" class="empty">No page views yet.</td></tr>';

  const nf = d.notFound || [];
  const nfRows = nf.length
    ? nf
        .map(
          (n) => `<tr>
            <td class="pathcell" title="${esc(n.path)}">${esc(n.path)}</td>
            <td class="num">${fmt(n.count)}</td>
            <td class="srckey">${n.from.length ? n.from.map((f) => esc(f.key === "(none)" ? "typed or bookmarked" : f.key)).join(", ") : "–"}</td>
          </tr>`
        )
        .join("")
    : '<tr><td colspan="3" class="empty">No missing pages have been asked for. Recording starts from 27 September 2026 — earlier 404s were never captured.</td></tr>';

  const cta = d.ctaPerformance || [];
  const ctaRows = cta.filter((c) => c.views || c.clicks).length
    ? cta
        .filter((c) => c.views || c.clicks)
        .map(
          (c) => `<tr>
            <td class="pathcell" title="${esc(c.path)}">${esc(c.path)}</td>
            <td class="num">${c.views ? fmt(c.views) : "–"}</td>
            <td class="num">${fmt(c.clicks)}</td>
            <td class="num">${c.rate === null || c.rate === undefined ? "–" : c.rate + "%"}</td>
          </tr>`
        )
        .join("")
    : '<tr><td colspan="4" class="empty">No CTA impressions recorded yet. Recording starts from 27 September 2026.</td></tr>';

  return `
    <div class="callout">
      <strong>Which parts of the site do the work.</strong> Grouped over every page view, not just the top 50 —
      the long tail of 42 case studies and 20 area pages is exactly the part worth judging.
      <div class="callout-sub">“Led to enquiry” counts visitors who read that section and then sent an enquiry. One enquiry is credited to every section that person read, so the column is “part of how they decided” and won't add up to the total — crediting only the page the form was sent from would give Contact every lead and the case studies none.</div>
    </div>
    <div class="card" style="margin-bottom:16px"><h3>By section</h3><div class="csub">${rangeLabel()}</div>
      <div class="tblscroll"><table class="tbl"><thead><tr><th>Section</th><th class="num">Views</th><th class="num">Visitors</th><th class="num">Avg. time</th><th class="num">Avg. scroll</th><th class="num">Led to enquiry</th><th class="num">Rate</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    </div>
    <div class="card" style="margin-bottom:16px"><h3>Pages that don't exist</h3>
      <div class="csub">URLs real visitors asked for and didn't get · a crawler's 404s are never recorded here, because the tracker is JavaScript</div>
      <div class="tblscroll"><table class="tbl"><thead><tr><th>Asked for</th><th class="num">Times</th><th>Came from</th></tr></thead><tbody>${nfRows}</tbody></table></div>
    </div>
    <div class="card"><h3>Was the button even seen?</h3>
      <div class="csub">The first “get in touch” link on each page — impressions against clicks</div>
      <div class="tblscroll"><table class="tbl"><thead><tr><th>Page</th><th class="num">Seen</th><th class="num">Clicked</th><th class="num">Rate</th></tr></thead><tbody>${ctaRows}</tbody></table></div>
    </div>`;
}

/* ---------------- Speed (Core Web Vitals, measured on real visits) ---------------- */
const VITAL_META = {
  lcp: { label: "Largest content paint", sub: "how soon the main thing appears", good: 2500, poor: 4000, unit: "ms" },
  cls: { label: "Layout shift", sub: "how much the page jumps about", good: 0.1, poor: 0.25, unit: "" },
  inp: { label: "Interaction delay", sub: "worst response to a tap or click", good: 200, poor: 500, unit: "ms" },
  ttfb: { label: "Server response", sub: "time to the first byte", good: 800, poor: 1800, unit: "ms" },
};
function vitalVal(k, v) {
  if (v === null || v === undefined) return "–";
  if (k === "cls") return String(Math.round(v * 1000) / 1000);
  return v >= 1000 ? (v / 1000).toFixed(2) + "s" : Math.round(v) + "ms";
}
function vitalState(k, v) {
  if (v === null || v === undefined) return "";
  const m = VITAL_META[k];
  return v <= m.good ? "ok" : v <= m.poor ? "warn" : "bad";
}
function viewSpeed() {
  const d = state.data;
  if (!d) return loader();
  const v = d.vitals;
  if (!v || !v.samples) {
    return `<div class="callout">
        <strong>How fast the site actually is for real visitors</strong> — not a lab score. The four measurements
        Google grades sites on, taken in the visitor's own browser.
      </div>
      <div class="card"><div class="empty">No speed measurements yet. Recording started on 27 September 2026 and the first readings arrive as people visit — a few hours on a quiet site.</div></div>`;
  }
  const keys = ["lcp", "cls", "inp", "ttfb"];
  const kpis = keys
    .map((k) => {
      const o = v.overall[k] || {};
      const st = vitalState(k, o.p75);
      return kpi(
        VITAL_META[k].label,
        `<span class="vitalval ${st}">${vitalVal(k, o.p75)}</span>`,
        VITAL_META[k].sub + (o.samples ? ` · ${fmt(o.samples)} samples` : "")
      );
    })
    .join("");
  const devRows = (v.byDevice || [])
    .map(
      (r) => `<tr><td>${esc(cap(r.device))}</td>${keys.map((k) => `<td class="num ${vitalState(k, r[k])}">${vitalVal(k, r[k])}</td>`).join("")}<td class="num">${fmt(r.samples)}</td></tr>`
    )
    .join("");
  const pageRows = (v.pages || [])
    .map(
      (r) => `<tr><td class="pathcell" title="${esc(r.path)}">${esc(r.path)}</td>${keys.map((k) => `<td class="num ${vitalState(k, r[k])}">${vitalVal(k, r[k])}</td>`).join("")}<td class="num">${fmt(r.samples)}</td></tr>`
    )
    .join("");
  const head = `<th>Page</th>${keys.map((k) => `<th class="num">${esc(VITAL_META[k].label.split(" ")[0])}</th>`).join("")}<th class="num">Samples</th>`;
  return `
    <div class="callout">
      <strong>How fast the site is for real visitors</strong> — measured in their own browser, not a lab test.
      Each figure is the 75th percentile, which is how Google grades a site: three visitors in four did at least this well.
      <div class="callout-sub">Attributed to the page the visit <em>started</em> on. Layout shift and interaction delay build up over a whole visit and only settle when it ends, so pinning them to whichever page happened to be open at that moment would blame the wrong one.</div>
    </div>
    <div class="grid kpis">${kpis}</div>
    <div class="card" style="margin-bottom:16px"><h3>By device</h3><div class="csub">${rangeLabel()}</div>
      <div class="tblscroll"><table class="tbl"><thead><tr><th>Device</th>${keys.map((k) => `<th class="num">${esc(VITAL_META[k].label.split(" ")[0])}</th>`).join("")}<th class="num">Samples</th></tr></thead>
      <tbody>${devRows || '<tr><td colspan="6" class="empty">No samples yet.</td></tr>'}</tbody></table></div>
    </div>
    <div class="card"><h3>By landing page</h3><div class="csub">Busiest first</div>
      <div class="tblscroll"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${pageRows || '<tr><td colspan="6" class="empty">No samples yet.</td></tr>'}</tbody></table></div>
    </div>`;
}

/* ---------------- Delivery check (did the enquiry actually get through?) ---------------- */
function viewDelivery() {
  const d = state.delivery;
  if (!d) return loader();
  if (d.failed)
    return '<div class="card"><div class="empty">Could not run the delivery check. Try Refresh.</div></div>';
  const t = d.totals || {};
  const probs = (d.problems || [])
    .map(
      (p) => `<li class="dprob ${esc(p.severity)}"><span class="dprobtext">${p.text}</span>
        <span class="csub">${p.days.length === 1 ? "on " : "on "}${p.days.slice(0, 6).map((x) => esc(fmtT(x))).join(", ")}${p.days.length > 6 ? ` and ${p.days.length - 6} more days` : ""}</span></li>`
    )
    .join("");
  const rows = (d.days || [])
    .filter((x) => x.submitted || x.savedContact || x.savedOther || x.online || x.backup || x.mailto || x.thankYou)
    .reverse()
    .map(
      (x) => `<tr class="${x.mailto || x.submitted > x.savedContact ? "rowbad" : x.backup ? "rowwarn" : ""}">
        <td>${esc(fmtT(x.day))}</td>
        <td class="num">${fmt(x.submitted)}</td>
        <td class="num">${fmt(x.savedContact + x.savedOther)}</td>
        <td class="num">${fmt(x.online)}</td>
        <td class="num">${x.backup ? fmt(x.backup) : "–"}</td>
        <td class="num">${x.mailto ? fmt(x.mailto) : "–"}</td>
        <td class="num">${fmt(x.thankYou)}</td>
      </tr>`
    )
    .join("");

  return `
    <div class="callout">
      <strong>Four separate records of the same submission, side by side.</strong> Every enquiry leaves a trace in
      four places, and until now nothing compared them — which is how the main email route could fail for three
      months with only a line in a log nobody reads.
      <div class="callout-sub">Anything in the <strong>Backup</strong> or <strong>Own mail app</strong> columns means the main route did not work that day.</div>
    </div>
    <div class="grid kpis">
      ${kpi("Enquiries delivered", fmt(t.sent), `${fmt(t.online)} by the main route`)}
      ${kpi("Main route working", t.mainRouteRate === null ? "–" : t.mainRouteRate + "%", "of delivered enquiries")}
      ${kpi("Saved to the database", fmt(t.saved), "every one recoverable")}
      ${kpi("Send button pressed", fmt(t.attempts), `${fmt(t.validationErrors)} had a form error`)}
    </div>
    ${probs
      ? `<div class="card" style="margin-bottom:16px"><h3>What went wrong</h3><ul class="dprobs">${probs}</ul></div>`
      : `<div class="card" style="margin-bottom:16px"><h3>Nothing to report</h3><div class="csub">Every submission in this period was saved and delivered by the main route.</div></div>`}
    <div class="card">
      <h3>Day by day</h3>
      <div class="csub">${rangeLabel()} · days with no form activity are omitted${d.lastMainRouteSuccess ? ` · main route last worked ${esc(fmtT(d.lastMainRouteSuccess))}` : ""}</div>
      <table class="tbl dtbl"><thead><tr>
        <th>Day</th><th class="num">Sent</th><th class="num">Saved</th>
        <th class="num">Main route</th><th class="num">Backup</th><th class="num">Own mail app</th><th class="num">Thank-you page</th>
      </tr></thead><tbody>${rows || '<tr><td colspan="7" class="empty">No form activity in this period.</td></tr>'}</tbody></table>
    </div>`;
}

/* ---------------- Error trend ---------------- */
function viewErrTrend() {
  const d = state.errTrend;
  if (!d) return loader();
  if (d.failed)
    return '<div class="card"><div class="empty">Could not load the error trend. Try Refresh.</div></div>';
  const days = d.days || [];
  const values = days.map((x) => x.total);
  const labels = days.map((x, i) => (i % 5 === 0 ? x.day.slice(8) : ""));
  const worst = days.reduce((a, b) => (b.total > (a ? a.total : -1) ? b : a), null);
  return `
    <div class="callout">
      <strong>Is it getting worse?</strong> The list beside this says what broke; this says whether it is new.
      A fault that has always been there is a different problem from one that started on Tuesday.
    </div>
    <div class="grid kpis">
      ${kpi("Errors", fmt(d.total), `last ${d.days.length} days`)}
      ${kpi("Busiest day", worst ? fmt(worst.total) : "–", worst ? esc(fmtT(worst.day)) : "")}
      ${kpi("Kinds of fault", fmt((d.byType || []).length), "")}
      ${kpi("New this week", fmt((d.newTypes || []).length), (d.newTypes || []).length ? "not seen before" : "nothing new")}
    </div>
    ${(d.newTypes || []).length
      ? `<div class="callout callout-warn"><strong>New kinds of fault this week:</strong> ${d.newTypes.map((x) => esc(ERR_TYPE_LABELS[x] || x)).join(", ")}. These were not happening before, so something changed.</div>`
      : ""}
    <div class="card" style="margin-bottom:16px"><h3>Errors per day</h3><div class="csub">Same filters as the Errors list</div>${vbars(values, labels)}</div>
    <div class="card"><h3>By kind</h3><div class="csub">Across the whole period</div>
      ${barList((d.byType || []).map((x) => ({ key: ERR_TYPE_LABELS[x.key] || x.key, count: x.count })), { limit: 12, empty: "No errors recorded." })}
    </div>`;
}

/* ---------------- Journeys (per-visitor timelines) ---------------- */
function visitorShort(vid) {
  return vid && vid !== "anon" ? vid.slice(0, 6) : "anon";
}
function clockTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch (e) { return ""; }
}
function whenLabel(ts) {
  try {
    const d = new Date(ts);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const t = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return "Today " + t;
    const yest = new Date(today.getTime() - 86400000);
    if (d.toDateString() === yest.toDateString()) return "Yesterday " + t;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", " + t;
  } catch (e) { return ""; }
}
function placeLabel(j) {
  const city = j.city || "";
  const country = j.country || "";
  const name = city ? city : countryName(country);
  return (flag(country) + " " + esc(name)).trim();
}
function actDetail(a) {
  const p = a.props || {};
  const bits = [];
  if (p.dest) bits.push(String(p.dest));
  else if (p.form) bits.push(String(p.form));
  else if (p.project_type) bits.push(String(p.project_type));
  else if (p.href) bits.push(String(p.href));
  return bits.length ? ` <span class="actdest">${esc(bits.join(" · "))}</span>` : "";
}
function isConvName(n) {
  return ["phone_click", "email_click", "whatsapp_click", "form_submit", "cta_click", "visualiser_start", "visualiser_complete"].includes(n);
}

function journeyCard(j, i) {
  const steps = (j.steps || [])
    .map((s) => {
      const acts = (s.actions || [])
        .map((a) => `<span class="actpill ${isConvName(a.name) ? "conv" : ""}" title="${esc(a.name)}">${esc(eventLabel(a.name))}${actDetail(a)}</span>`)
        .join("");
      const meta = [];
      if (s.timeOnPage) meta.push(dur(s.timeOnPage));
      if (s.scroll) meta.push("scrolled " + s.scroll + "%");
      meta.push(clockTime(s.ts));
      const label = s.title ? esc(s.title) : esc(s.path);
      return `<li class="jstep${s.newSession ? " jstep-new" : ""}">
        <div class="jstep-top">
          <span class="jstep-path" title="${esc(s.path)}">${label}</span>
          <span class="jstep-time">${s.timeOnPage ? dur(s.timeOnPage) : "&ndash;"}</span>
        </div>
        <div class="jstep-sub">${esc(s.path)} <span class="dot">·</span> ${meta.join(' <span class="dot">·</span> ')}</div>
        ${acts ? `<div class="jstep-acts">${acts}</div>` : ""}
      </li>`;
    })
    .join("");
  const src = j.referrerHost ? cap(j.channel) + " · " + esc(j.referrerHost) : cap(j.channel);
  const utm = j.utm && (j.utm.source || j.utm.campaign)
    ? ` <span class="dot">·</span> ${esc([j.utm.source, j.utm.campaign].filter(Boolean).join("/"))}`
    : "";
  const badges = [
    j.converted ? '<span class="pill green">Converted</span>' : "",
    `<span class="pill grey">${j.pages} ${j.pages === 1 ? "page" : "pages"}</span>`,
    `<span class="pill grey">${dur(j.durationS)}</span>`,
    j.actionsCount ? `<span class="pill">${j.actionsCount} ${j.actionsCount === 1 ? "action" : "actions"}</span>` : "",
  ].join("");
  const techBits = [cap(j.device), j.browser, j.os].filter(Boolean).join(" · ");
  return `<div class="journey${j.converted ? " is-conv" : ""}" data-jx="${i}">
    <button class="jhead" data-jtoggle="${i}" type="button">
      <span class="javatar">${j.converted ? "★" : visitorShort(j.vid).slice(0, 1).toUpperCase()}</span>
      <span class="jident">
        <span class="jvisitor">Visitor ${esc(visitorShort(j.vid))}</span>
        <span class="jsub">${placeLabel(j)} <span class="dot">·</span> ${esc(techBits)}</span>
      </span>
      <span class="jbadges">${badges}</span>
      <span class="jwhen">${whenLabel(j.lastTs)}</span>
      <span class="jchev" aria-hidden="true">▾</span>
    </button>
    <div class="jbody">
      <div class="jsource">Source: ${src}${utm} <span class="dot">·</span> Entry: <code>${esc(j.entry)}</code> <span class="dot">·</span> ${j.sessions} ${j.sessions === 1 ? "session" : "sessions"}</div>
      <ol class="jsteps">${steps || '<li class="empty">No pages recorded.</li>'}</ol>
      ${j.stepsTruncated ? '<div class="csub" style="margin-top:8px">Timeline truncated to the first 60 steps.</div>' : ""}
    </div>
  </div>`;
}

function viewJourneys() {
  const j = state.journeys;
  if (!j) return loader();
  const s = j.summary;
  const all = j.journeys || [];
  let list = all;
  if (state.journeyFilter === "converters") list = all.filter((x) => x.converted);
  else if (state.journeyFilter === "multi") list = all.filter((x) => x.pages >= 2);

  const chip = (id, label, n) =>
    `<button class="jchip ${state.journeyFilter === id ? "active" : ""}" data-jfilter="${id}">${label}${n != null ? ` <span class="jchip-n">${fmt(n)}</span>` : ""}</button>`;

  const RENDER_CAP = 200;
  const shown = list.slice(0, RENDER_CAP);
  const cards = shown.length
    ? shown.map((x, i) => journeyCard(x, i)).join("")
    : '<div class="card"><div class="empty">No journeys match this filter for the selected period.</div></div>';

  return `
    <div class="callout">
      <strong>What this page is.</strong> Each card is one <strong>visitor's journey</strong> — the pages they viewed in order, how long they spent on each, and the actions they took. Time-on-page comes from when they moved to the next page (or the engaged beacon on the last page). <strong>Privacy by design:</strong> the visitor ID is cookieless and re-generated every day, so a journey covers one visitor <em>within a single day</em> — we don't follow people across days.
    </div>
    <div class="grid kpis">
      ${kpi("Visitors", fmt(s.visitors), "in this period")}
      ${kpi("Converted", fmt(s.converters), s.visitors ? Math.round((s.converters / s.visitors) * 100) + "% of visitors" : "")}
      ${kpi("Multi-page visits", fmt(s.multiPage), "saw 2+ pages")}
      ${kpi("Avg. pages / visitor", s.avgPages, "")}
      ${kpi("Avg. time", dur(s.avgDuration), "per visitor")}
    </div>
    <div class="jfilters">
      ${chip("all", "All visitors", s.visitors)}
      ${chip("converters", "Converters", s.converters)}
      ${chip("multi", "Multi-page", s.multiPage)}
    </div>
    <div class="journeys">${cards}</div>
    ${list.length > RENDER_CAP ? `<div class="csub" style="margin-top:12px">Showing the ${RENDER_CAP} most recent of ${fmt(list.length)} matching visitors${j.meta.returned < s.visitors ? ` (server returns the ${fmt(j.meta.returned)} most recent of ${fmt(s.visitors)} total)` : ""}.</div>` : ""}`;
}

/* ---------------- Path flow (page-to-page routes) ---------------- */
function flowList(items, opt) {
  opt = opt || {};
  if (!items || !items.length) return `<div class="empty">${opt.empty || "No data yet."}</div>`;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    '<div class="barlist">' +
    items
      .map((i) => {
        const w = (i.count / max) * 100;
        const clickable = !i.bucket;
        const go = clickable ? ` data-flowgo="${esc(i.path)}"` : "";
        const cls = "barrow" + (clickable ? " flow-go" : "");
        const label = i.bucket ? `<em>${esc(i.label)}</em>` : esc(i.label);
        return `<div class="${cls}"${go}><div class="bar" style="width:${w.toFixed(1)}%"></div><div class="lbl" title="${esc(i.title || i.label)}">${label}</div><div class="num">${fmt(i.count)}</div></div>`;
      })
      .join("") +
    "</div>"
  );
}

function viewFlow() {
  const d = state.flow;
  if (!d) return loader();
  const s = d.summary;
  const pages = d.pages || [];
  const intro = `<div class="callout"><strong>What this page is.</strong> The most common <strong>page-to-page routes</strong> visitors take, plus a flow explorer. Pick a page to see where visitors <em>came from</em> and where they <em>went next</em> — click any page in the columns to re-centre on it. Routes are counted between consecutive pages within a single visit.</div>`;
  if (!pages.length) {
    return intro + `<div class="card"><div class="empty">No multi-page visits in this period yet. Path flow appears once visitors move between pages.</div></div>`;
  }

  let sel = state.flowPage;
  if (!sel || !pages.find((p) => p.path === sel)) sel = pages[0].path;
  const page = pages.find((p) => p.path === sel) || pages[0];

  const before = page.in.map((x) => ({ label: x.key, title: x.key, path: x.key, count: x.count }));
  if (page.entries) before.push({ label: "Entered here (direct / search)", count: page.entries, bucket: true });
  before.sort((a, b) => b.count - a.count);

  const after = page.out.map((x) => ({ label: x.key, title: x.key, path: x.key, count: x.count }));
  if (page.exits) after.push({ label: "Left the site", count: page.exits, bucket: true });
  after.sort((a, b) => b.count - a.count);

  const routes = d.transitions.map((tr) => ({ key: `${tr.from}  →  ${tr.to}`, count: tr.count }));
  const options = pages
    .map((p) => `<option value="${esc(p.path)}" ${p.path === sel ? "selected" : ""}>${esc(p.path)} · ${fmt(p.views)} views</option>`)
    .join("");

  return `
    ${intro}
    <div class="grid kpis">
      ${kpi("Visits analysed", fmt(s.sessions), "")}
      ${kpi("Pages with traffic", fmt(s.pages), "")}
      ${kpi("Distinct routes", fmt(s.transitionTypes), "")}
      ${kpi("Top route", s.topRoute ? fmt(s.topRoute.count) : "–", s.topRoute ? esc(s.topRoute.from) + " → " + esc(s.topRoute.to) : "")}
    </div>
    <div class="card" style="margin-bottom:16px"><h3>Top routes</h3><div class="csub">Most common page-to-page steps · ${rangeLabel()}</div>${barList(routes, { limit: 14, empty: "Not enough multi-page visits yet to show routes." })}</div>
    <div class="card">
      <div class="flowtop">
        <div><h3>Flow explorer</h3><div class="csub">Where visitors come from and go next</div></div>
        <select class="flowsel" data-flowsel aria-label="Choose a page">${options}</select>
      </div>
      <div class="flowcols">
        <div class="flowcol"><div class="flowhead">Came from</div>${flowList(before, { empty: "No prior page (everyone entered here)." })}</div>
        <div class="flowmid">
          <div class="flownode">
            <div class="flownode-path" title="${esc(page.path)}">${esc(page.path)}</div>
            <div class="flownode-stats">${fmt(page.views)} views <span class="dot">·</span> ${fmt(page.entries)} entries <span class="dot">·</span> ${fmt(page.exits)} exits</div>
          </div>
        </div>
        <div class="flowcol"><div class="flowhead">Went to</div>${flowList(after, { empty: "No next page (everyone left from here)." })}</div>
      </div>
    </div>`;
}

/* ---------------- New customer enquiry (form submissions) ---------------- */
function fmtDateTime(ts) {
  try {
    return new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch (e) { return ts || ""; }
}
const ENQ_FORM_LABELS = { contact: "Contact form", visualiser_concept: "Visualiser concept" };
const ENQ_FIELD_LABELS = {
  name: "Name", email: "Email", phone: "Phone", contact: "Phone or email", postcode: "Postcode", area: "Area / town",
  projectType: "Project type", projectStage: "Project stage", hasBuilder: "Has a builder", timescale: "Timescale",
  budget: "Budget", preferredContact: "Preferred contact", message: "Message", notes: "Notes", consent: "Consent given",
  resultId: "Concept reference", resultUrl: "Concept image", page: "Submitted from",
};
const enqFieldLabel = (k) => ENQ_FIELD_LABELS[k] || cap(String(k).replace(/_/g, " "));
const ENQ_FIELD_ORDER = ["name", "email", "phone", "contact", "postcode", "area", "projectType", "projectStage", "hasBuilder", "timescale", "budget", "preferredContact", "message", "notes", "resultId", "resultUrl", "consent"];

function enquiryDetail(r) {
  const f = r.fields || {};
  const has = (k) => f[k] !== null && f[k] !== undefined && f[k] !== "";
  const keys = [
    ...ENQ_FIELD_ORDER.filter(has),
    ...Object.keys(f).filter((k) => !ENQ_FIELD_ORDER.includes(k) && has(k)),
  ];
  const fieldHtml = keys.length
    ? keys.map((k) => {
        let v = String(f[k]);
        if (k === "resultUrl" && safeHref(v)) v = `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer">View image</a>`;
        else v = esc(v);
        return `<div class="enqf"><dt>${esc(enqFieldLabel(k))}</dt><dd>${v}</dd></div>`;
      }).join("")
    : '<div class="empty">No field data captured.</div>';

  const loc = [r.city, r.region, r.country].filter(Boolean).join(", ");
  const ctx = [
    ["Received", fmtDateTime(r.created_at)],
    ["Form", ENQ_FORM_LABELS[r.form] || cap(r.form || "")],
    ["Submitted from", r.page],
    ["Channel", r.channel ? cap(r.channel) : ""],
    ["Referrer", r.referrer_host],
    ["Location", loc],
    ["Device", [cap(r.device || ""), r.browser, r.os].filter(Boolean).join(" · ")],
    ["Status", r.status],
  ].filter((x) => x[1]);
  const ctxHtml = ctx.map((x) => `<div class="enqf"><dt>${esc(x[0])}</dt><dd>${esc(String(x[1]))}</dd></div>`).join("");

  const actions = [];
  if (r.email) actions.push(`<a class="btn btn-ghost enqact" href="mailto:${esc(r.email)}">✉ Email</a>`);
  if (r.phone) actions.push(`<a class="btn btn-ghost enqact" href="tel:${esc(r.phone)}">✆ Call</a>`);

  return `<div class="enqdetail">
    <div class="enqcols">
      <div class="enqblock"><h4>Submitted fields</h4><dl class="enqdl">${fieldHtml}</dl></div>
      <div class="enqblock"><h4>Context</h4><dl class="enqdl">${ctxHtml}</dl></div>
    </div>
    ${actions.length ? `<div class="enqactions">${actions.join("")}</div>` : ""}
  </div>`;
}

function enquiryRow(r, i) {
  const contact = [r.phone, r.email].filter(Boolean).join("  ·  ") || "—";
  const f = r.fields || {};
  const proj = r.project_type || f.projectType || "—";
  const formL = ENQ_FORM_LABELS[r.form] || cap(r.form || "");
  return `<tr class="enqrow" data-enqtoggle="${i}">
      <td class="enqdate">${esc(fmtDateTime(r.created_at))}</td>
      <td>${esc(r.name || "—")}</td>
      <td class="enqcontact" title="${esc(contact)}">${esc(contact)}</td>
      <td>${esc(proj)}</td>
      <td class="enqformcell"><span class="pill grey">${esc(formL)}</span><span class="enqchev" aria-hidden="true">▾</span></td>
    </tr>
    <tr class="enqdetailrow" id="enqd-${i}" hidden><td colspan="5">${enquiryDetail(r)}</td></tr>`;
}

function enqPager(d) {
  if (d.totalPages <= 1) return "";
  const prev = d.page > 1 ? `data-enqpage="${d.page - 1}"` : "disabled";
  const next = d.page < d.totalPages ? `data-enqpage="${d.page + 1}"` : "disabled";
  return `<div class="pager">
    <button class="btn btn-ghost" ${prev}>← Prev</button>
    <span class="pageinfo">Page ${d.page} of ${d.totalPages} · ${fmt(d.total)} total</span>
    <button class="btn btn-ghost" ${next}>Next →</button>
  </div>`;
}

function viewEnquiries() {
  const d = state.enquiries;
  if (!d) return loader();
  const rows = d.rows || [];
  const body = rows.length
    ? rows.map((r, i) => enquiryRow(r, i)).join("")
    : '<tr><td colspan="5" class="empty">No enquiries saved yet. New website form submissions will appear here automatically.</td></tr>';
  return `
    ${unnotifiedBanner()}
    <div class="callout"><strong>Every website enquiry is saved here</strong>, whether or not a notification email got through — so the contact details survive even when nobody was told at the time. Newest first; <strong>click a row</strong> to see every field captured.</div>
    <div class="grid kpis">
      ${kpi("Total enquiries", fmt(d.total), "saved all-time")}
      ${kpi("Showing", fmt(rows.length), `page ${d.page} of ${d.totalPages}`)}
    </div>
    <div class="card">
      <table class="tbl enqtbl">
        <thead><tr><th>Received</th><th>Name</th><th>Contact</th><th>Project</th><th>Form</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      ${enqPager(d)}
    </div>`;
}

/* ---------------- Error logs (client errors on the live site) ---------------- */
const ERR_TYPE_LABELS = {
  js_error: "JS error",
  resource_error: "Resource",
  unhandled_rejection: "Promise",
  react_error: "React crash",
  form_error: "Form fail",
  console_error: "console.error",
};
// props keys rendered elsewhere (page/visitor block, breadcrumbs) — excluded
// from the generic "Extra context" dump so we don't show them twice.
const ERR_KNOWN_PROPS = [
  "surface", "online", "connection", "deviceMemory", "hardwareConcurrency",
  "title", "visibility", "sinceLoadMs", "buildId", "breadcrumbs", "ua", "ref",
  "dpr", "serverTs", "utm",
];

function fmtCrumbT(ms) {
  ms = ms || 0;
  return ms < 1000 ? "+" + ms + "ms" : "+" + Math.round(ms / 100) / 10 + "s";
}
function errBadge(e) {
  const label = ERR_TYPE_LABELS[e.type] || e.type || "error";
  return `<span class="errtype errtype-${esc(e.type)}">${esc(label)}</span>`;
}

function errExtras(p) {
  return Object.keys(p).filter(
    (k) => ERR_KNOWN_PROPS.indexOf(k) === -1 && p[k] !== null && p[k] !== undefined && p[k] !== ""
  );
}
// surface may live in a top-level column or (if that column is absent) in props.
function rowSurface(r) {
  return r.surface || (r.props && r.props.surface) || "";
}

function errorDetail(e, i) {
  const p = e.props || {};
  const errF = (label, value) =>
    value === null || value === undefined || value === ""
      ? ""
      : `<div class="errf"><dt>${esc(label)}</dt><dd>${esc(String(value))}</dd></div>`;

  const srcLine = e.source
    ? e.source + (e.lineno ? ":" + e.lineno : "") + (e.colno ? ":" + e.colno : "")
    : "";
  const errBlock = [
    errF("Message", e.message),
    errF("Type", ERR_TYPE_LABELS[e.type] || e.type),
    errF("Severity", e.severity || "error"),
    errF("Surface", rowSurface(e)),
    srcLine ? `<div class="errf"><dt>Source</dt><dd><code>${esc(srcLine)}</code></dd></div>` : "",
  ].join("");
  const stackHtml = e.stack ? `<pre class="errstack">${esc(e.stack)}</pre>` : "";

  const loc = [e.city, e.region, e.country].filter(Boolean).join(", ");
  const conn =
    p.connection && typeof p.connection === "object"
      ? [
          p.connection.effectiveType,
          p.connection.downlink != null ? p.connection.downlink + " Mbps" : "",
          p.connection.rtt != null ? p.connection.rtt + " ms" : "",
        ].filter(Boolean).join(" · ")
      : "";
  const safeUrl = safeHref(e.url);
  const ctx =
    (e.url
      ? `<div class="errf"><dt>Page URL</dt><dd>${
          safeUrl
            ? `<a href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer">${esc(e.url)}</a>`
            : `<code>${esc(e.url)}</code>`
        }</dd></div>`
      : errF("Path", e.path)) +
    [
      errF("Referrer", e.referrer_host),
      errF("Browser", [e.browser, e.bv].filter(Boolean).join(" ")),
      errF("Operating system", [e.os, e.osv].filter(Boolean).join(" ")),
      errF("Device", cap(e.device || "")),
      errF("Bot", e.is_bot ? "yes" : "no"),
      errF("Location", loc),
      errF("Viewport", e.viewport),
      errF("Screen", e.screen),
      errF("Pixel ratio", p.dpr),
      errF("Language", e.lang),
      errF("Timezone", e.tz),
      errF("Online", p.online === undefined ? "" : p.online ? "yes" : "no"),
      errF("Connection", conn),
      errF("Device memory", p.deviceMemory != null ? p.deviceMemory + " GB" : ""),
      errF("CPU cores", p.hardwareConcurrency),
      errF("Page title", p.title),
      errF("Tab visibility", p.visibility),
      errF("Time since load", p.sinceLoadMs != null ? Math.round(p.sinceLoadMs / 100) / 10 + "s" : ""),
      errF("Build ID", p.buildId),
      errF("Visitor", e.vid),
      errF("Logged at", fmtDateTime(e.ts)),
    ].join("");

  const extras = errExtras(p);
  const extraHtml = extras.length
    ? extras
        .map((k) => {
          let v = p[k];
          if (typeof v === "object") { try { v = JSON.stringify(v); } catch (er) { v = String(v); } }
          return `<div class="errf"><dt>${esc(enqFieldLabel(k))}</dt><dd>${esc(String(v))}</dd></div>`;
        })
        .join("")
    : "";

  const crumbs = Array.isArray(p.breadcrumbs) ? p.breadcrumbs : [];
  const crumbHtml = crumbs.length
    ? `<ol class="crumbs">${crumbs
        .map(
          (c) =>
            `<li><span class="crumbt">${esc(fmtCrumbT(c.t))}</span><span class="crumbk">${esc(c.k)}</span><span class="crumbm">${esc(c.m)}</span></li>`
        )
        .join("")}</ol>`
    : '<div class="empty">No breadcrumbs captured.</div>';

  const json = esc(JSON.stringify(e, null, 2));

  return `<div class="errdetail">
    <div class="errcols">
      <div class="errblock"><h4>Error</h4><dl class="errdl">${errBlock}</dl>${stackHtml}</div>
      <div class="errblock"><h4>Page &amp; visitor</h4><dl class="errdl">${ctx}</dl></div>
    </div>
    ${extraHtml ? `<div class="errblock errblock-wide"><h4>Extra context</h4><dl class="errdl errdl-grid">${extraHtml}</dl></div>` : ""}
    <div class="errblock errblock-wide"><h4>Breadcrumbs <span class="errsub">— actions leading up to the error (most recent last)</span></h4>${crumbHtml}</div>
    <details class="errjson"><summary>Full data (JSON)</summary><pre>${json}</pre></details>
    <div class="erractions">
      <button class="btn copybtn" data-errcopy="${i}">⧉ Copy all error data</button>
      <span class="errcopyhint">Pastes a full report into Claude Code to identify &amp; fix.</span>
    </div>
  </div>`;
}

function errorRow(e, i) {
  const msg = e.message || (e.stack ? String(e.stack).split("\n")[0] : "(no message)");
  const where = [cap(e.device || ""), e.browser].filter(Boolean).join(" · ");
  const surf = rowSurface(e) === "admin" ? `<span class="pill grey errtag">admin</span>` : "";
  const bot = e.is_bot ? `<span class="pill grey errtag">bot</span>` : "";
  return `<tr class="errrow" data-errtoggle="${i}">
      <td class="errdate">${esc(fmtDateTime(e.ts))}</td>
      <td class="errtypecell">${errBadge(e)}${surf}${bot}</td>
      <td class="errmsg" title="${esc(msg)}">${esc(msg)}</td>
      <td class="pathcell" title="${esc(e.path || "")}">${esc(e.path || "—")}</td>
      <td class="errwhere">${esc(where || "—")}<span class="enqchev" aria-hidden="true">▾</span></td>
    </tr>
    <tr class="errdetailrow" id="errd-${i}" hidden><td colspan="5">${errorDetail(e, i)}</td></tr>`;
}

function errPager(d) {
  if (d.totalPages <= 1) return "";
  const prev = d.page > 1 ? `data-errpage="${d.page - 1}"` : "disabled";
  const next = d.page < d.totalPages ? `data-errpage="${d.page + 1}"` : "disabled";
  return `<div class="pager">
    <button class="btn btn-ghost" ${prev}>← Prev</button>
    <span class="pageinfo">Page ${d.page} of ${d.totalPages} · ${fmt(d.total)} total</span>
    <button class="btn btn-ghost" ${next}>Next →</button>
  </div>`;
}

/**
 * Does this row look like a browser-extension fault?
 *
 * The server filters on props.thirdParty, which the reporter sets at capture
 * time — so it only exists on rows logged after that shipped. Everything older
 * still counts as the website's own, which is exactly wrong for the four
 * extension errors already in the table.
 *
 * Rather than require a database backfill before the filter is any use, the
 * same test is applied here to whatever the server returned. Belt and braces:
 * new rows are caught server-side (so the counts and paging are right), old
 * ones are caught here.
 */
const EXT_URL_RE = /\b(?:chrome|chrome-untrusted|moz|safari-web|safari|ms-browser|opera|edge)-extension:\/\//i;
function looksThirdParty(e) {
  if (!e) return false;
  if (e.props && e.props.thirdParty === true) return true;
  return EXT_URL_RE.test(e.stack || "") || EXT_URL_RE.test(e.source || "");
}

/** Apply the on-screen party choice to rows the server has already returned. */
function applyPartyFilter(rows) {
  if (state.errParty === "all") return { rows: rows, hidden: 0 };
  const want = state.errParty === "third";
  const kept = rows.filter((e) => looksThirdParty(e) === want);
  return { rows: kept, hidden: rows.length - kept.length };
}

function viewErrors() {
  const d = state.errorLogs;
  if (!d) return loader();
  // errorRow / the Copy button index into d.rows, so the filtered set replaces
  // it wholesale rather than being filtered at render time — otherwise the
  // indexes and the rows would disagree and Copy would return the wrong error.
  const filtered = applyPartyFilter(d.rows || []);
  d.rows = filtered.rows;
  const rows = d.rows;
  const hiddenNote =
    filtered.hidden > 0
      ? ` · ${filtered.hidden} older browser-extension ${filtered.hidden === 1 ? "error" : "errors"} hidden on this page`
      : "";
  const body = rows.length
    ? rows.map((e, i) => errorRow(e, i)).join("")
    : `<tr><td colspan="5" class="empty">No errors logged for this filter — good news, or none captured yet.</td></tr>`;
  const chip = (id, label) =>
    `<button class="jchip ${state.errBots === id ? "active" : ""}" data-errfilter="${id}">${label}</button>`;
  const pchip = (id, label) =>
    `<button class="jchip ${state.errParty === id ? "active" : ""}" data-errparty="${id}">${label}</button>`;
  const filterNote =
    d.botMode === "only"
      ? "Bot-generated errors only"
      : d.botMode === "include"
      ? "All errors incl. bots"
      : "Real-visitor errors (bots hidden)";
  const partyNote =
    d.party === "third"
      ? "Browser-extension errors only"
      : d.party === "all"
      ? "Including browser extensions"
      : "The website's own errors";
  return `
    <div class="callout"><strong>Every error captured on the live website.</strong> Each row is a JavaScript error, a failed page resource, a broken form submit, or a React crash — saved with full context. <strong>Bots and browser-extension errors are hidden by default</strong> — an extension crashing inside someone's browser is not a fault in the website, and mixing the two buries the ones that matter. Click a row to see everything captured, then <strong>Copy all error data</strong> to paste straight into Claude Code to identify and fix it.</div>
    <div class="grid kpis">
      ${kpi("Errors logged", fmt(d.total), filterNote)}
      ${kpi("Last 24 hours", fmt(d.last24h), "same filter")}
      ${kpi("Showing", fmt(rows.length), `page ${d.page} of ${d.totalPages} · ${esc(partyNote)}${esc(hiddenNote)}`)}
    </div>
    <div class="jfilters">
      ${chip("exclude", "Humans only")}
      ${chip("include", "All")}
      ${chip("only", "Bots only")}
    </div>
    <div class="jfilters">
      ${pchip("site", "Our website")}
      ${pchip("all", "Include extensions")}
      ${pchip("third", "Extensions only")}
    </div>
    ${errExportRow()}
    <div class="card">
      <table class="tbl errtbl">
        <thead><tr><th>Time</th><th>Type</th><th>Message</th><th>Page</th><th>Where</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      ${errPager(d)}
    </div>`;
}

/* ---- Download every error as one text file ------------------------------ *
 * The per-row "Copy all error data" button is fine for one error, but handing
 * a batch back for diagnosis meant expanding and copying each row by hand. This
 * writes the same report for every logged error into a single .txt, with a
 * summary on top so a few hundred errors can be triaged rather than read.
 *
 * The watermark (the highest error id already downloaded) lives in
 * localStorage: it is one person's "how far have I got" marker, so it is not
 * worth a database table. The cost is that it is per-browser -- downloading
 * from another machine re-sends everything -- so the status line always shows
 * where the mark is, and Reset clears it.
 * ------------------------------------------------------------------------- */
const ERR_EXPORT_KEY = "sc_admin_err_export";
const ERR_EXPORT_PAGE = 200; // matches the endpoint's raised ceiling
const ERR_EXPORT_CAP = 5000; // refuse to build an unusable file silently

/** The last download's watermark, or null. Never throws. */
function errExportMark() {
  try {
    const raw = localStorage.getItem(ERR_EXPORT_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw);
    return m && Number.isFinite(m.id) ? m : null;
  } catch (e) {
    return null;
  }
}

function errExportSave(mark) {
  try {
    localStorage.setItem(ERR_EXPORT_KEY, JSON.stringify(mark));
  } catch (e) {
    /* private window, or storage full -- the download still worked */
  }
}

function errExportClear() {
  try {
    localStorage.removeItem(ERR_EXPORT_KEY);
  } catch (e) {
    /* nothing to do */
  }
}

function errExportRow() {
  const m = errExportMark();
  // The note and the watermark line are shown TOGETHER, not one instead of the
  // other: the note appears right after a download, which is precisely when
  // someone is most likely to want Reset, and an earlier version hid the link
  // at that moment.
  const bits = [];
  if (state.errExportNote) bits.push(esc(state.errExportNote));
  if (m) {
    bits.push(
      `Last download: ${esc(fmtDateTime(m.at))} · ${fmt(m.count)} error${m.count === 1 ? "" : "s"} · <button class="linkbtn" data-errexportreset>Reset</button>`
    );
  } else if (!state.errExportNote) {
    bits.push("Nothing downloaded yet — the first file will contain every error.");
  }
  const status = bits.join("<br />");
  return `
    <div class="card errexport">
      <div class="errexport-main">
        <button class="btn" data-errexport ${state.errExporting ? "disabled" : ""}>${
          state.errExporting ? "Preparing…" : "⬇ Download all error logs"
        }</button>
        <label class="toggle"><input type="checkbox" id="errOnlyNew" ${
          state.errOnlyNew ? "checked" : ""
        } /> Only errors I haven’t downloaded before</label>
      </div>
      <div class="errexport-note">${status}</div>
    </div>`;
}

/** Pull every matching row, paging until the server says there are no more. */
async function fetchAllErrorRows(sinceId, onProgress) {
  const rows = [];
  let page = 1;
  let total = 0;
  let fetched = 0; // raw rows seen, before the party filter
  let maxSeenId = 0;
  let truncated = false;
  for (;;) {
    let url = `${ERROR_LOGS}?page=${page}&pageSize=${ERR_EXPORT_PAGE}&bots=${state.errBots}&party=${state.errParty}&kind=errors`;
    if (sinceId !== null && sinceId !== undefined) url += `&sinceId=${encodeURIComponent(sinceId)}`;
    const r = await apiGet(url);
    if (r.status === 401) {
      showLogin();
      return null;
    }
    if (!r.ok) throw new Error("errors " + r.status);
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "export failed");
    total = j.total || 0;
    const batch = j.rows || [];
    // The paging loop must count what the SERVER returned, not what survives
    // the filter — otherwise hiding older extension rows makes rows.length lag
    // total forever and the loop never terminates.
    fetched += batch.length;
    // The watermark advances past everything SEEN, including rows the filter
    // drops. Taking it from the kept rows instead would leave the hidden ones
    // below the mark, so every future download would fetch them again.
    batch.forEach((x) => {
      if (Number.isFinite(x.id) && x.id > maxSeenId) maxSeenId = x.id;
    });
    applyPartyFilter(batch).rows.forEach((x) => rows.push(x));
    if (onProgress) onProgress(fetched, total);
    if (!batch.length || fetched >= total) break;
    if (fetched >= ERR_EXPORT_CAP) {
      truncated = true;
      break;
    }
    page += 1;
  }
  return { rows, total, fetched, maxSeenId, truncated };
}

/**
 * Counts by type, page and message. With a few hundred errors this is what
 * makes the file triageable instead of a wall of stack traces, and it is free:
 * every row is already in memory.
 */
function errExportSummary(rows) {
  const byType = {};
  const byPage = {};
  const byMsg = {};
  rows.forEach((e) => {
    const t = ERR_TYPE_LABELS[e.type] || e.type || "error";
    byType[t] = (byType[t] || 0) + 1;
    const p = e.path || String(e.url || "").replace(/^https?:\/\/[^/]+/, "") || "(unknown)";
    byPage[p] = (byPage[p] || 0) + 1;
    const m = String(e.message || "(no message)").slice(0, 90);
    byMsg[m] = (byMsg[m] || 0) + 1;
  });
  const top = (o, n) =>
    Object.keys(o)
      .sort((a, b) => o[b] - o[a])
      .slice(0, n)
      .map((k) => `${k} (${o[k]})`);
  const L = [];
  L.push("SUMMARY");
  L.push("  By type:      " + (top(byType, 10).join("  ·  ") || "none"));
  L.push("  Top pages:    " + (top(byPage, 8).join("  ·  ") || "none"));
  L.push("  Top messages:");
  top(byMsg, 8).forEach((s) => L.push("    - " + s));
  if (rows.length) {
    // Rows arrive newest-first (order=ts.desc).
    L.push("  Newest:       " + fmtDateTime(rows[0].ts));
    L.push("  Oldest:       " + fmtDateTime(rows[rows.length - 1].ts));
  }
  return L.join("\n");
}

function errExportFilename(d) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    "sc-design-errors-" +
    d.getFullYear() +
    "-" +
    p(d.getMonth() + 1) +
    "-" +
    p(d.getDate()) +
    "-" +
    p(d.getHours()) +
    p(d.getMinutes()) +
    ".txt"
  );
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke late: some browsers cancel an in-flight download if it goes too soon.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function exportErrorLogs() {
  if (state.errExporting) return;
  const mark = errExportMark();
  const sinceId = state.errOnlyNew && mark ? mark.id : null;

  state.errExporting = true;
  state.errExportNote = "Fetching errors…";
  document.getElementById("view").innerHTML = viewErrors();

  try {
    const result = await fetchAllErrorRows(sinceId, (got, total) => {
      state.errExportNote = `Fetching errors… ${fmt(got)} of ${fmt(total)}`;
      const el = document.querySelector(".errexport-note");
      if (el) el.textContent = state.errExportNote;
    });
    if (!result) return; // 401 -> login screen, nothing more to do

    const rows = result.rows;
    if (!rows.length) {
      state.errExporting = false;
      // Everything fetched could have been filtered out as extension noise —
      // that is a different answer from "nothing new happened", and saying the
      // wrong one would have Sean thinking the site was quiet when it was not.
      state.errExportNote =
        result.fetched > 0
          ? `Nothing to send — the ${fmt(result.fetched)} error${result.fetched === 1 ? " was a browser-extension fault" : "s were all browser-extension faults"}, not the website.`
          : sinceId
          ? "No new errors since your last download — nothing to send."
          : "No errors logged for this filter — nothing to download.";
      if (state.view === "errors") document.getElementById("view").innerHTML = viewErrors();
      showToast(sinceId ? "No new errors" : "No errors to download");
      return;
    }

    const now = new Date();
    const filterNote =
      state.errBots === "only"
        ? "Bot-generated errors only"
        : state.errBots === "include"
        ? "All errors, including bots"
        : "Real-visitor errors (bots hidden)";
    const head = [];
    head.push("SC Design Wirral — website error log export");
    head.push("===========================================");
    head.push("Generated:      " + fmtDateTime(now.toISOString()));
    head.push("Filter:         " + filterNote);
    head.push(
      "Source:         " +
        (state.errParty === "third"
          ? "Browser-extension errors ONLY (not faults in the website)"
          : state.errParty === "all"
          ? "The website's own errors AND browser-extension errors"
          : "The website's own errors (browser-extension errors excluded)")
    );
    head.push(
      "Range:          " +
        (sinceId
          ? `errors after id ${sinceId} (previous download ${fmtDateTime(mark.at)})`
          : "every error held for this filter")
    );
    head.push("Errors in file: " + rows.length);
    if (result.fetched > rows.length) {
      head.push(
        "Excluded:       " +
          (result.fetched - rows.length) +
          " browser-extension error(s) — faults inside a visitor's browser, not the website"
      );
    }
    if (result.truncated) {
      head.push("");
      head.push(
        `NOTE: capped at ${ERR_EXPORT_CAP} errors of ${result.total}. Tick "Only errors I ` +
          "haven’t downloaded before" +
          " and download again to continue from where this file ends."
      );
    }
    head.push("");
    head.push(errExportSummary(rows));
    head.push("");

    const parts = [head.join("\n")];
    rows.forEach((e, i) => {
      parts.push(
        "\n================================================================\n" +
          `[${i + 1} of ${rows.length}]  id ${e.id}\n` +
          "================================================================\n"
      );
      parts.push(formatErrorForClipboard(e));
    });

    downloadTextFile(errExportFilename(now), parts.join("\n"));

    // Advance the watermark to the highest id actually in the file.
    const maxId = result.maxSeenId || rows.reduce((a, e) => (Number.isFinite(e.id) && e.id > a ? e.id : a), 0);
    if (maxId > 0) errExportSave({ id: maxId, at: now.toISOString(), count: rows.length });

    state.errExporting = false;
    state.errExportNote = `Downloaded ${fmt(rows.length)} error${rows.length === 1 ? "" : "s"}. The next download will start after this one.`;
    if (state.view === "errors") document.getElementById("view").innerHTML = viewErrors();
    showToast("Error log downloaded");
  } catch (e) {
    state.errExporting = false;
    state.errExportNote = "Could not build the file — try Refresh, then download again.";
    if (state.view === "errors") document.getElementById("view").innerHTML = viewErrors();
  }
}

/* ---- Copy-to-clipboard (Claude-Code-ready report) ---- */
function formatErrorForClipboard(e) {
  const p = e.props || {};
  const L = [];
  L.push("SC Design — Website error report");
  L.push("=================================");
  L.push("Time:      " + fmtDateTime(e.ts));
  L.push(
    "Type:      " + (ERR_TYPE_LABELS[e.type] || e.type) +
      "   Severity: " + (e.severity || "error") +
      "   Surface: " + (rowSurface(e) || "public")
  );
  L.push("Message:   " + (e.message || ""));
  L.push("");
  if (e.url) L.push("Page:      " + e.url);
  L.push("Path:      " + (e.path || ""));
  const srcLine = e.source
    ? e.source + (e.lineno ? ":" + e.lineno : "") + (e.colno ? ":" + e.colno : "")
    : "";
  if (srcLine) L.push("Source:    " + srcLine);
  if (e.referrer_host) L.push("Referrer:  " + e.referrer_host);
  L.push("");
  L.push("Browser:   " + [e.browser, e.bv].filter(Boolean).join(" "));
  L.push("OS:        " + [e.os, e.osv].filter(Boolean).join(" "));
  L.push("Device:    " + (e.device || "") + (e.is_bot ? "   (BOT)" : ""));
  const loc = [e.city, e.region, e.country].filter(Boolean).join(", ");
  if (loc) L.push("Location:  " + loc);
  L.push(
    "Viewport:  " + (e.viewport || "?") +
      "   Screen: " + (e.screen || "?") +
      (p.dpr ? "   dpr " + p.dpr : "")
  );
  L.push("Language:  " + (e.lang || "") + "   Timezone: " + (e.tz || ""));
  const netBits = [
    p.connection && p.connection.effectiveType ? p.connection.effectiveType : "",
    p.online === false ? "OFFLINE" : "",
  ].filter(Boolean).join(" ");
  if (netBits) L.push("Network:   " + netBits);
  if (p.buildId) L.push("Build:     " + p.buildId);
  if (e.vid) L.push("Visitor:   " + e.vid + " (cookieless daily hash)");

  const extras = errExtras(p);
  if (extras.length) {
    L.push("");
    L.push("Extra context:");
    extras.forEach((k) => {
      let v = p[k];
      if (typeof v === "object") { try { v = JSON.stringify(v); } catch (er) { v = String(v); } }
      L.push("  " + k + ": " + v);
    });
  }

  if (e.stack) {
    L.push("");
    L.push("Stack trace:");
    L.push(e.stack);
  }

  const crumbs = Array.isArray(p.breadcrumbs) ? p.breadcrumbs : [];
  if (crumbs.length) {
    L.push("");
    L.push("Breadcrumbs (most recent last):");
    crumbs.forEach((c) => L.push("  [" + fmtCrumbT(c.t) + "] " + c.k + " → " + c.m));
  }

  L.push("");
  L.push("Full context (JSON):");
  L.push("```json");
  L.push(JSON.stringify(e, null, 2));
  L.push("```");
  return L.join("\n");
}

function showToast(msg) {
  let el = document.getElementById("copytoast");
  if (!el) {
    el = document.createElement("div");
    el.id = "copytoast";
    el.className = "copytoast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("show"), 2200);
}

function fallbackCopy(text, done) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) done();
    else showToast("Could not copy — open Full data (JSON) and copy it manually.");
  } catch (e) {
    showToast("Could not copy — open Full data (JSON) and copy it manually.");
  }
}

function copyErrorToClipboard(i, btn) {
  const e = state.errorLogs && state.errorLogs.rows && state.errorLogs.rows[i];
  if (!e) return;
  const text = formatErrorForClipboard(e);
  const done = () => {
    showToast("Full error report copied — paste it into Claude Code.");
    if (btn) {
      btn.classList.add("copied");
      const label = btn.textContent;
      btn.textContent = "Copied ✓";
      setTimeout(() => { btn.classList.remove("copied"); btn.textContent = label; }, 1600);
    }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

/* ---------------- Login attempts (admin sign-in audit trail) ---------------- */
const LOGIN_REASON_LABELS = {
  bad_credentials: "wrong username or password",
  rate_limited: "too many attempts (rate-limited)",
};
function loginFailed(l) {
  return (l.props && l.props.outcome === "failed") || l.type === "login_failed";
}
function loginOutcomeBadge(l) {
  return loginFailed(l) ? `<span class="pill red">Failed</span>` : `<span class="pill green">Success</span>`;
}
function loginUsername(l) {
  return (l.props && l.props.username) || "—";
}

function loginDetail(l) {
  const p = l.props || {};
  const failed = loginFailed(l);
  const f = (label, value) =>
    value === null || value === undefined || value === ""
      ? ""
      : `<div class="errf"><dt>${esc(label)}</dt><dd>${esc(String(value))}</dd></div>`;
  const loc = [l.city, l.region, l.country].filter(Boolean).join(", ");
  const block = [
    f("Outcome", failed ? "Failed" : "Success"),
    f("Username tried", p.username),
    f("Reason", p.reason ? LOGIN_REASON_LABELS[p.reason] || p.reason : failed ? "" : "—"),
    f("When", fmtDateTime(l.ts)),
    f("Location", loc),
    f("Device", [cap(l.device || ""), l.browser, l.os].filter(Boolean).join(" · ")),
    f("Looks like a bot/script", l.is_bot ? "yes" : "no"),
    f("Referrer", l.referrer_host),
    f("User agent", p.ua),
    f("Visitor", l.vid),
  ].join("");
  const json = esc(JSON.stringify(l, null, 2));
  return `<div class="errdetail">
    <div class="errblock"><h4>Sign-in attempt</h4><dl class="errdl errdl-grid">${block}</dl></div>
    <details class="errjson"><summary>Full data (JSON)</summary><pre>${json}</pre></details>
  </div>`;
}

function loginRow(l, i) {
  const loc = [l.city, l.region, l.country].filter(Boolean).join(", ") || "—";
  const dev = [cap(l.device || ""), l.browser].filter(Boolean).join(" · ") || "—";
  const botTag = l.is_bot ? `<span class="pill grey errtag">bot</span>` : "";
  return `<tr class="errrow${loginFailed(l) ? " login-failed" : ""}" data-logintoggle="${i}">
      <td class="errdate">${esc(fmtDateTime(l.ts))}</td>
      <td>${loginOutcomeBadge(l)}${botTag}</td>
      <td class="loginuser">${esc(loginUsername(l))}</td>
      <td class="pathcell" title="${esc(loc)}">${esc(loc)}</td>
      <td class="errwhere">${esc(dev)}<span class="enqchev" aria-hidden="true">▾</span></td>
    </tr>
    <tr class="errdetailrow" id="logind-${i}" hidden><td colspan="5">${loginDetail(l)}</td></tr>`;
}

function loginPager(d) {
  if (d.totalPages <= 1) return "";
  const prev = d.page > 1 ? `data-loginpage="${d.page - 1}"` : "disabled";
  const next = d.page < d.totalPages ? `data-loginpage="${d.page + 1}"` : "disabled";
  return `<div class="pager">
    <button class="btn btn-ghost" ${prev}>← Prev</button>
    <span class="pageinfo">Page ${d.page} of ${d.totalPages} · ${fmt(d.total)} total</span>
    <button class="btn btn-ghost" ${next}>Next →</button>
  </div>`;
}

function viewLogins() {
  const d = state.logins;
  if (!d) return loader();
  const rows = d.rows || [];
  const body = rows.length
    ? rows.map((l, i) => loginRow(l, i)).join("")
    : `<tr><td colspan="5" class="empty">No sign-in attempts recorded for this filter yet.</td></tr>`;
  const chip = (id, label) =>
    `<button class="jchip ${state.loginKind === id ? "active" : ""}" data-loginfilter="${id}">${label}</button>`;
  return `
    <div class="callout"><strong>Every admin sign-in attempt.</strong> A full access trail — successful and failed logins to this panel, with time, approximate location and device, so you can spot anyone trying to get in. <strong>Passwords are never recorded</strong> — only the username that was tried.</div>
    <div class="grid kpis">
      ${kpi("Failed sign-ins", fmt(d.failedTotal), "all-time")}
      ${kpi("Successful sign-ins", fmt(d.successTotal), "all-time")}
      ${kpi("Failed (24h)", fmt(d.failed24h), "last 24 hours")}
      ${kpi("Showing", fmt(rows.length), `page ${d.page} of ${d.totalPages}`)}
    </div>
    <div class="jfilters">
      ${chip("logins", "All")}
      ${chip("logins_failed", "Failed")}
      ${chip("logins_success", "Successful")}
    </div>
    <div class="card">
      <table class="tbl errtbl">
        <thead><tr><th>Time</th><th>Outcome</th><th>Username tried</th><th>Location</th><th>Device</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      ${loginPager(d)}
    </div>`;
}

/* ---------------- Data available (reference catalogue) ---------------- */
const REF = [
  {
    group: "Page & URL",
    desc: "Which pages are viewed and how visitors move through the site.",
    rows: [
      ["path", "Browser", "/services/house-extensions/", "Top pages, entry/exit pages, page trends"],
      ["title", "Browser", "House Extensions | SC Design", "Friendly page labels"],
      ["pageview / engaged", "Computed", "1 per view; engaged on leave", "Page views, time on page, scroll depth"],
    ],
  },
  {
    group: "Referrer & channel",
    desc: "Where each visit originated.",
    rows: [
      ["referrer_host", "Browser", "google.com", "Referrers report"],
      ["channel", "Computed", "search / social / referral / direct / paid / email", "Channel mix"],
    ],
  },
  {
    group: "Campaign (UTM)",
    desc: "Tag links you share so you can see what each campaign drove. Add ?utm_source=facebook&utm_medium=social&utm_campaign=spring to a link.",
    rows: [
      ["utm_source", "Browser", "facebook", "Campaigns report"],
      ["utm_medium", "Browser", "social / cpc / email", "Channel + campaigns"],
      ["utm_campaign", "Browser", "spring-extensions", "Campaigns report"],
      ["utm_term / utm_content", "Browser", "keyword / ad-variant", "Campaign detail (future)"],
    ],
  },
  {
    group: "Location",
    desc: "Approximate location from the visitor's IP at the edge. The IP itself is never stored.",
    rows: [
      ["country", "Edge (Vercel)", "GB", "Countries report"],
      ["region", "Edge (Vercel)", "England", "Regions report"],
      ["city", "Edge (Vercel)", "Liverpool", "Cities report"],
      ["timezone", "Browser/Edge", "Europe/London", "Audience timezone"],
    ],
  },
  {
    group: "Device & browser",
    desc: "Derived from the User-Agent string plus a few browser values.",
    rows: [
      ["device", "Computed (UA)", "desktop / mobile / tablet", "Device split"],
      ["browser (+ version)", "Computed (UA)", "Chrome 124", "Browsers report"],
      ["os (+ version)", "Computed (UA)", "iOS 17", "Operating systems report"],
      ["screen / viewport", "Browser", "1920×1080 / 1440×900", "Screen sizes, responsive design checks"],
      ["language", "Browser", "en-GB", "Languages report"],
      ["is_bot", "Computed (UA)", "true / false", "Bot filtering (toggle in the header)"],
    ],
  },
  {
    group: "Visitor & session (cookieless)",
    desc: "A salted hash that rotates every day lets us count unique visitors and group views into visits — with no cookies and no stored IP.",
    rows: [
      ["visitor hash (vid)", "Computed", "16-char daily hash", "Unique visitors, sessions, bounce, journeys"],
      ["session", "Computed", "views grouped within 30 min", "Visits, pages/visit, entry/exit, duration, journeys"],
    ],
  },
  {
    group: "Engagement",
    desc: "Captured by an 'engaged' beacon sent when a page is left.",
    rows: [
      ["dur (time on page)", "Browser", "42000 ms", "Time-on-page report, per-page avg time"],
      ["scroll", "Browser", "75 (%)", "Scroll-depth report"],
    ],
  },
  {
    group: "Events (conversions)",
    desc: "Key actions, each stored with the page it happened on and optional extra props.",
    rows: [
      ["phone_click / email_click / whatsapp_click", "Browser", "—", "Conversions, Events report"],
      ["cta_click", "Browser", "{dest: contact|visualiser}", "CTA performance"],
      ["form_submit", "Browser", "{form: contact}", "Enquiry submissions"],
      ["service_click / location_click", "Browser", "{dest: /services/…}", "Interest by service/area"],
      ["outbound_link", "Browser", "{dest: host}", "Outbound clicks"],
      ["visualiser_start/complete/refine/error/download", "Browser", "{project_type, mode}", "Visualiser funnel"],
    ],
  },
  {
    group: "Time",
    desc: "Every row is timestamped server-side; patterns are bucketed by day and hour.",
    rows: [
      ["server timestamp (ts)", "Edge", "ISO datetime", "All trends, real-time"],
      ["day-of-week / hour-of-day", "Computed", "Mon … / 00–23", "When-people-visit patterns"],
    ],
  },
];

/* ---------------- Today ---------------- */
/* The landing page. Ordered by what needs a person, not by what is easiest to
   measure — the traffic summary is real but it is not a task, so it sits last. */

function todoRow(tone, title, body, dest) {
  const go = dest ? `<button class="linkbtn tgo" data-dest="${esc(dest)}">Open →</button>` : "";
  return `<li class="todo todo-${tone}">
    <span class="todo-dot" aria-hidden="true"></span>
    <div class="todo-body"><div class="todo-title">${title}</div><div class="todo-sub">${body}</div></div>
    ${go}
  </li>`;
}

/** Problems worth a person's time, newest concern first. Empty is a real answer. */
function todayTasks(t) {
  const out = [];

  if (t.unnotified && t.unnotified.count) {
    const n = t.unnotified.count;
    out.push(todoRow("bad",
      `At least ${fmt(n)} ${n === 1 ? "enquiry was" : "enquiries were"} never emailed to anyone`,
      `${n === 1 ? "It is" : "They are"} saved and the contact details are safe, but nobody was told at the time${t.unnotified.oldest ? `. The earliest was ${esc(fmtDateTime(t.unnotified.oldest))}` : ""}.`,
      "enquiries"));
  }

  if (t.healthProblems && t.healthProblems.length) {
    out.push(todoRow("warn",
      t.healthProblems.length === 1 ? "One thing is not set up" : `${t.healthProblems.length} things are not set up`,
      esc(t.healthProblems.join(" · ")) + ".",
      "health"));
  }

  if (t.newErrors > 0) {
    out.push(todoRow("warn",
      `${fmt(t.newErrors)} new ${t.newErrors === 1 ? "error" : "errors"} since your last download`,
      "From the website itself — browser-extension faults are already filtered out.",
      "errors"));
  }

  if (!out.length) {
    out.push(todoRow("ok", "Nothing needs you right now",
      "No unsent enquiries, nothing misconfigured, and no new errors since you last looked.", null));
  }
  return out.join("");
}

function viewToday() {
  const t = state.today;
  if (!t) return loader();

  const m = t.stats && t.stats.metrics;
  const p = t.stats && t.stats.prevMetrics;
  const kpis = m
    ? `<div class="grid kpis">
        ${kpi("Unique visitors", fmt(m.visitors), "", delta(m.visitors, p && p.visitors))}
        ${kpi("Visits", fmt(m.sessions), "", delta(m.sessions, p && p.sessions))}
        ${kpi("Page views", fmt(m.pageviews), "", delta(m.pageviews, p && p.pageviews))}
        ${kpi("Conversions", fmt(m.conversions), "calls, emails, forms", delta(m.conversions, p && p.conversions))}
      </div>`
    : '<div class="card"><div class="empty">Traffic figures could not be loaded. Try Refresh.</div></div>';

  const latest = t.latestEnquiry;
  const latestCard = latest
    ? `<div class="card">
        <div class="cardhead"><div><h3>Latest enquiry</h3><div class="csub">${esc(fmtDateTime(latest.created_at))}</div></div>
          <button class="btn btn-ghost prj-sm" data-dest="enquiries">See all ${t.enquiryTotal ? fmt(t.enquiryTotal) : ""}</button></div>
        <div class="tlatest">
          <div class="tlatest-name">${esc(latest.name || "(no name given)")}</div>
          <div class="tlatest-meta">${esc([latest.project_type, latest.area || latest.postcode].filter(Boolean).join(" · ") || "No project details given")}</div>
          <div class="tlatest-acts">
            ${latest.phone ? `<a class="btn btn-ghost prj-sm" href="tel:${esc(latest.phone)}">Call ${esc(latest.phone)}</a>` : ""}
            ${latest.email ? `<a class="btn btn-ghost prj-sm" href="mailto:${esc(latest.email)}">Email</a>` : ""}
          </div>
        </div>
      </div>`
    : `<div class="card"><h3>Latest enquiry</h3><div class="csub">Form submissions</div><div class="empty">No enquiries saved yet.</div></div>`;

  return `
    <div class="card tcard">
      <div class="cardhead"><div><h3>Needs you</h3><div class="csub">Checked live, every time this page opens</div></div></div>
      <ul class="todos">${todayTasks(t)}</ul>
    </div>
    <div class="secthead">Last 7 days</div>
    ${kpis}
    <div class="grid cols-2">
      ${latestCard}
      <div class="card">
        <div class="cardhead"><div><h3>Busiest pages</h3><div class="csub">Last 7 days</div></div>
          <button class="btn btn-ghost prj-sm" data-dest="visitors">All reports</button></div>
        ${t.stats ? barList((t.stats.pages || []).map((x) => ({ key: x.path, count: x.views })), { limit: 6, empty: "No page views yet." }) : '<div class="empty">Could not load.</div>'}
      </div>
    </div>`;
}

/**
 * Today pulls from four places. Each is independent and best-effort: one failing
 * greys out its own card instead of emptying the page, because the whole point of
 * this screen is that it is the one you can trust to be honest about problems.
 */
async function loadToday() {
  const get = (url) => apiGet(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [stats, enq, unnotified, health] = await Promise.all([
    get(`${STATS}?range=7d&bots=exclude`),
    get(`${ENQUIRIES}?page=1&pageSize=1`),
    countUnnotifiedEnquiries(),
    get(`${STATS}?report=health`),
  ]);

  // Errors logged since the last time the log was downloaded — the same
  // watermark the export uses, so "new" means new to you, not new to the table.
  let newErrors = 0;
  try {
    const mark = errExportMark();
    const q = `${ERROR_LOGS}?kind=errors&bots=exclude&party=site&pageSize=1${mark ? `&sinceId=${mark}` : ""}`;
    const j = await get(q);
    if (j && j.ok && Number.isFinite(j.total)) newErrors = j.total;
  } catch (e) { /* best effort */ }

  state.today = {
    stats: stats && stats.ok ? stats : null,
    enquiryTotal: enq && enq.ok ? enq.total : null,
    latestEnquiry: enq && enq.ok && enq.rows && enq.rows[0] ? enq.rows[0] : null,
    unnotified: unnotified && !unnotified.failed ? unnotified : null,
    healthProblems: health && health.ok ? healthProblemList(health) : [],
    newErrors: newErrors,
  };
  // The stats bundle Today just fetched is the same one the Visitors reports use.
  if (stats && stats.ok) state.data = stats;
  markFresh();
  if (state.view === "today") {
    document.getElementById("view").innerHTML = viewToday();
    setPageMeta();
  }
}

/* ---------------- Health & setup ---------------- */
/* What is configured and what silently isn't. Everything here comes from
   ?report=health, which reports booleans for secrets and never their values. */

const HEALTH_STATE_LABELS = { ok: "Working", warn: "Check", bad: "Not working", off: "Not set" };

function healthPill(s) {
  const cls = s === "ok" ? "green" : s === "bad" ? "red" : s === "warn" ? "amber" : "grey";
  return `<span class="pill ${cls}">${esc(HEALTH_STATE_LABELS[s] || s)}</span>`;
}

function healthRow(label, s, note) {
  return `<div class="hrow"><div class="hrow-l">${esc(label)}</div><div class="hrow-s">${healthPill(s)}</div><div class="hrow-n">${note || ""}</div></div>`;
}

function healthCard(g) {
  return `
    <div class="card hcard hcard-${g.status}">
      <div class="hhead">
        <div><h3>${esc(g.title)}</h3><div class="csub">${esc(g.headline)}</div></div>
        ${healthPill(g.status)}
      </div>
      ${g.detail ? `<p class="hdetail">${g.detail}</p>` : ""}
      <div class="hrows">${g.rows.join("")}</div>
      ${g.fix ? `<div class="hfix"><strong>To fix:</strong> ${g.fix}</div>` : ""}
    </div>`;
}

/** Row count if the table answered, so "working" is visibly backed by something. */
function tableNote(t) {
  if (!t) return "";
  if (t.ok) return t.count === null || t.count === undefined ? "answering" : `${fmt(t.count)} rows`;
  if (t.error === "missing") return "this table does not exist yet";
  if (t.error === "not_configured") return "the database connection is not set up";
  return "could not be reached";
}

function tableState(t) {
  return t && t.ok ? "ok" : "bad";
}

/**
 * Short plain-English names for whatever is wrong, from a health payload.
 *
 * Shared by the Health page's badge and by Today, so the sidebar count and the
 * list of problems can never disagree with each other.
 */
function healthProblemList(h) {
  if (!h || h.failed || !h.env) return [];
  const e = h.env, tb = h.tables || {}, gh = h.github || {}, st = h.storage || {};
  const out = [];
  if (!(e.SMTP_USER && e.SMTP_PASS)) out.push("the backup email cannot send");
  const missing = ["sc_events", "sc_errors", "sc_enquiries", "sc_projects"].filter((k) => !(tb[k] && tb[k].ok));
  if (missing.length) out.push(missing.length === 1 ? "a database table is missing" : `${missing.length} database tables are missing`);
  if (!(gh.configured && gh.reachable)) out.push("the Projects editor cannot publish");
  else if (!st.ok) out.push("photo storage is unavailable");
  if (!(e.SC_ADMIN_USER && e.SC_ADMIN_PASS && e.SC_ADMIN_SESSION_SECRET)) out.push("a sign-in setting is missing");
  return out;
}

/**
 * When each thing last happened.
 *
 * "Is it configured" is only half the question. Nothing here could answer "did it
 * STOP" — and a site that quietly recorded nothing for a fortnight looks exactly like
 * a quiet fortnight. A threshold is given for each so silence can be judged rather
 * than just reported.
 */
function activityCard(a) {
  if (!a) return "";
  const rows = [
    ["Last visitor recorded", a.lastEvent, 6 * 3600e3, "analytics has stopped reaching the database"],
    ["Last enquiry saved", a.lastEnquiry, 21 * 86400e3, "three weeks without one is unusual — worth a test submission"],
    ["Last email by the main route", a.lastMainRouteEmail, 21 * 86400e3, "enquiries may be arriving without anyone being told"],
    ["Last error logged", a.lastError, null, "quiet is good here"],
  ];
  const html = rows.map(([label, ts, limit, note]) => {
    if (!ts) return healthRow(label, "off", "never");
    const age = Date.now() - new Date(ts).getTime();
    const stale = limit !== null && age > limit;
    return healthRow(label, stale ? "warn" : "ok", `${esc(whenLabel(ts))}${stale ? " — " + note : ""}`);
  });
  const anyStale = rows.some(([, ts, limit]) => limit !== null && (!ts || Date.now() - new Date(ts).getTime() > limit));
  return healthCard({
    title: "Still running?",
    status: anyStale ? "warn" : "ok",
    headline: anyStale ? "Something has gone quiet." : "Everything has reported recently.",
    detail: "",
    rows: html,
    fix: "",
  });
}

function viewHealth() {
  const h = state.health;
  if (!h) return loader();
  if (h.failed) {
    return '<div class="card"><div class="empty">Could not load the health check. Try Refresh.</div></div>';
  }
  const e = h.env || {};
  const tb = h.tables || {};
  const gh = h.github || {};
  const st = h.storage || {};
  const groups = [];

  /* --- Email --- */
  const smtpOk = !!(e.SMTP_USER && e.SMTP_PASS);
  groups.push({
    title: "Email notifications",
    status: smtpOk ? "ok" : "bad",
    headline: smtpOk ? "The backup email can send." : "The backup email cannot send.",
    detail: smtpOk
      ? "When an enquiry misses the main notification route, this sends it on so somebody is still told."
      : "Enquiries are still saved here in full and nothing is lost — but if one misses the main notification route, <strong>nobody is emailed about it</strong>. That is what happened between July and September 2026.",
    rows: [
      healthRow("Mail username (SMTP_USER)", e.SMTP_USER ? "ok" : "off", ""),
      healthRow("Mail password (SMTP_PASS)", e.SMTP_PASS ? "ok" : "off", e.SMTP_PASS ? "" : "must be an app-specific password"),
      healthRow("Sent from (SC_MAIL_FROM)", e.SC_MAIL_FROM ? "ok" : "off", e.SC_MAIL_FROM ? "" : "falls back to a built-in address"),
      healthRow("Sent to (SC_LEAD_TO)", e.SC_LEAD_TO || e.SC_LEAD_RECIPIENTS ? "ok" : "off", e.SC_LEAD_TO || e.SC_LEAD_RECIPIENTS ? "" : "falls back to the built-in recipients"),
    ],
    fix: smtpOk
      ? ""
      : "Set <code>SMTP_USER</code> and <code>SMTP_PASS</code> in the <strong>scdesign-wirral</strong> Vercel project and redeploy. <code>SMTP_PASS</code> has to be an app-specific password generated at appleid.apple.com — not the account password.",
  });

  /* --- Database --- */
  const tableRows = [
    ["Website analytics", "sc_events"],
    ["Error log", "sc_errors"],
    ["Customer enquiries", "sc_enquiries"],
    // Not "Projects editor" — that is the name of the card below, and the same
    // label meaning two different things on one page reads as a fault.
    ["Case studies", "sc_projects"],
  ];
  const dbBad = tableRows.filter(([, k]) => !(tb[k] && tb[k].ok));
  groups.push({
    title: "Database",
    status: dbBad.length === 0 ? "ok" : dbBad.length === tableRows.length ? "bad" : "warn",
    headline:
      dbBad.length === 0
        ? "All four tables are answering."
        // "1 of 4 tables is…" — the noun agrees with the total, the verb with the count.
        : `${dbBad.length} of ${tableRows.length} tables ${dbBad.length === 1 ? "is" : "are"} not available.`,
    detail: "",
    rows: tableRows.map(([label, key]) => healthRow(label, tableState(tb[key]), tableNote(tb[key]))),
    fix:
      tb.sc_projects && tb.sc_projects.error === "missing"
        ? "The Projects editor needs its table before it can save anything. Run <code>db/sc_projects.sql</code> once in the Supabase SQL editor."
        : "",
  });

  /* --- Publishing --- */
  const canPublish = gh.configured && gh.reachable && st.ok && tb.sc_projects && tb.sc_projects.ok;
  const publishRows = [
    healthRow("GitHub token (SC_GITHUB_TOKEN)", gh.configured ? (gh.reachable ? "ok" : "bad") : "off",
      gh.configured ? (gh.reachable ? "accepted by GitHub" : esc(gh.error || "GitHub refused it")) : "no token set"),
    healthRow("Repository", gh.repo ? "ok" : "off", gh.repo ? esc(gh.repo + " · " + (gh.branch || "")) : "uses the built-in default"),
    healthRow("Photo storage", st.ok ? "ok" : "bad", st.ok ? esc(st.bucket || "") : st.error === "missing" ? "the bucket does not exist" : "could not be reached"),
    healthRow("Projects table", tableState(tb.sc_projects), tableNote(tb.sc_projects)),
  ];
  groups.push({
    title: "Projects editor",
    status: canPublish ? "ok" : "bad",
    headline: canPublish ? "Sean can add and publish case studies." : "The Projects editor cannot publish yet.",
    detail: canPublish
      ? ""
      : "The editor will open, but it cannot save a project or put one on the website until everything below is in place.",
    rows: publishRows,
    fix: canPublish
      ? ""
      : "Create <code>SC_GITHUB_TOKEN</code> in the scdesign-wirral Vercel project (a fine-grained GitHub token with <strong>Contents: Read and write</strong> on this repository), and run <code>db/sc_projects.sql</code> once in Supabase.",
  });

  /* --- Sign-in --- */
  const authOk = !!(e.SC_ADMIN_USER && e.SC_ADMIN_PASS && e.SC_ADMIN_SESSION_SECRET);
  groups.push({
    title: "Admin sign-in",
    status: authOk ? "ok" : "warn",
    headline: authOk ? "Sign-in is configured." : "One of the sign-in settings is missing.",
    detail: "",
    rows: [
      healthRow("Username", e.SC_ADMIN_USER ? "ok" : "off", ""),
      healthRow("Password", e.SC_ADMIN_PASS ? "ok" : "off", ""),
      healthRow("Session signing key", e.SC_ADMIN_SESSION_SECRET ? "ok" : "off", e.SC_ADMIN_SESSION_SECRET ? "" : "sessions cannot be verified without this"),
    ],
    fix: "",
  });

  return `
    <div class="callout">
      <strong>What this page is.</strong> Every setting the website depends on, and whether it is actually
      working right now. It exists because a setting that is simply missing produces no error anywhere —
      which is how six enquiries were saved with nobody told for three months.
      <div class="callout-sub">Passwords and keys are never shown here — only whether each one is set.</div>
    </div>
    ${groups.map(healthCard).join("")}
    ${activityCard(h.activity)}
    <div class="card">
      <h3>What this page cannot see</h3>
      <div class="csub" style="margin-bottom:10px">Worth knowing, so a clean page isn't read as more than it is.</div>
      <ul class="hnotes">
        <li>The <strong>main</strong> enquiry notification runs on a separate service, outside this project. Its settings can't be read from here, so "Email notifications" above covers the backup route only.</li>
        <li>A setting can be present and still be wrong — the wrong password will show as set. Where a live check is possible (the GitHub token, the database, photo storage) one has been made and is shown above.</li>
        <li>The surest test is still an end-to-end one: send a real enquiry through the contact form and confirm it arrives.</li>
      </ul>
    </div>`;
}

function viewDataAvailable() {
  const groups = REF.map((g) => {
    const rows = g.rows
      .map(
        (r) => `<tr><td class="field">${esc(r[0])}</td><td class="src">${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`
      )
      .join("");
    return `<div class="ref-group"><h3>${esc(g.group)}</h3><div class="gd">${esc(g.desc)}</div>
      <div class="card"><table class="tbl ref-table"><thead><tr><th>Field</th><th>Source</th><th>Example</th><th>Powers</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }).join("");
  return `
    <div class="callout">
      <strong>What this page is.</strong> A catalogue of every data point the analytics collects, where it comes from, and which reports it can power — so when you want a new report later, you can see exactly what's already available to build it from. Everything is <strong>cookieless</strong>, with <strong>no IP stored</strong> and no cross-site tracking.
    </div>
    ${groups}
    <div class="card">
      <h3>Want a new report?</h3>
      <div class="csub" style="margin-bottom:8px">Two ways to extend this:</div>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:var(--ink-soft);line-height:1.7">
        <li><strong>From existing fields above</strong> — e.g. "show me phone clicks by city", "extensions vs lofts interest over time", "mobile vs desktop bounce". No new tracking needed.</li>
        <li><strong>New data</strong> — e.g. a custom event on a specific button, or a new field. Tell me what to capture and I'll add it to the tracker + a report here.</li>
      </ul>
      <div class="csub" style="margin-top:12px">Scaling note: reports currently aggregate raw events live. If volume grows very large, we can add indexed columns + nightly rollups for speed — no change to what's collected.</div>
    </div>`;
}

/* The Projects section lives in its own file (projects.js, loaded first). Every
   hook is guarded so this dashboard still works if that file fails to load. */
function viewProjectsSection() {
  return window.SCProjects
    ? window.SCProjects.view()
    : '<div class="card"><div class="empty">The projects editor did not load. Reload the page and try again.</div></div>';
}

const VIEWS = {
  today: viewToday,
  overview: viewOverview, enquiries: viewEnquiries, projects: viewProjectsSection, trends: viewTrends, pages: viewPages, journeys: viewJourneys, flow: viewFlow, sources: viewSources,
  locations: viewLocations, devices: viewDevices, engagement: viewEngagement,
  realtime: viewRealtime, events: viewEvents, visualiser: viewVisualiser, errors: viewErrors, logins: viewLogins,
  health: viewHealth, data: viewDataAvailable,
  content: viewContent, speed: viewSpeed, delivery: viewDelivery, errtrend: viewErrTrend,
};
/* The label for each panel. Used on tabs, and as the page title where a
   destination holds only one panel. */
const TITLES = {
  today: "Today",
  overview: "Overview", enquiries: "Customer enquiries",
  projects: (window.SCProjects && window.SCProjects.title) || "Projects & portfolio",
  trends: "Trends", pages: "Pages", journeys: "Journeys", flow: "Path flow", sources: "Sources",
  locations: "Locations", devices: "Devices", engagement: "Engagement",
  realtime: "Live", events: "Events", visualiser: "Visualiser", errors: "Error logs", logins: "Sign-ins",
  // Matches its sidebar label. The page's own callout explains what it catalogues,
  // so a title that disagrees with the nav item would only be a second name for
  // the same thing.
  health: "Health & setup", data: "Reference",
  content: "Content", speed: "Speed", delivery: "Delivery", errtrend: "Trend",
};

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ *
 * DESTINATIONS are what the sidebar lists. PANELS are the individual
 * reports, and a panel id is still what `state.view` holds — unchanged from
 * before this was grouped.
 *
 * That separation is deliberate. Every guard in this file and in projects.js
 * tests a panel id (STATS_VIEWS, the "am I still on this view?" checks in each
 * load function, `state.view === "projects"`), so grouping them under
 * destinations adds a layer ABOVE those without touching any of them. Renaming
 * the panel ids instead would have meant a fetch that succeeds while the paint
 * is silently skipped — a permanent "Loading…" with nothing in the console.
 *
 * `range`/`bots` declare which toolbar controls a destination actually uses.
 * They used to render on all seventeen views, including the ten where they
 * changed nothing but still forced a full reload.
 */
const DEST = [
  { id: "today", label: "Today", icon: "today", panels: ["today"] },

  { group: "Work" },
  { id: "enquiries", label: "Enquiries", icon: "inbox", panels: ["enquiries"], badge: "enquiries" },
  { id: "projects", label: "Projects", icon: "layers", panels: ["projects"] },

  { group: "Audience" },
  { id: "visitors", label: "Visitors", icon: "chart", range: true, bots: true,
    panels: ["overview", "trends", "pages", "content", "sources", "locations", "devices", "engagement"] },
  { id: "journeys", label: "Journeys", icon: "route", range: true, bots: true, panels: ["journeys", "flow"] },
  { id: "live", label: "Live", icon: "live", bots: true, panels: ["realtime"] },

  { group: "Results" },
  // "delivery" reads its own report rather than the shared bundle, so it is NOT in
  // STATS_VIEWS and gets its own loader — the tab still switches instantly, it just
  // fetches what it needs instead of silently painting nothing.
  { id: "results", label: "Conversions", icon: "target", range: true, bots: true, panels: ["events", "delivery", "visualiser"] },

  { group: "System" },
  { id: "health", label: "Health", icon: "pulse", range: true, bots: true, only: ["speed"], panels: ["health", "speed"], badge: "health" },
  { id: "errors", label: "Errors", icon: "warning", panels: ["errors", "errtrend"], badge: "errors" },
  { id: "logins", label: "Sign-ins", icon: "key", panels: ["logins"] },
  { id: "reference", label: "Reference", icon: "book", panels: ["data"] },
];

const DESTS = DEST.filter((d) => d.id);

/** The destination that owns a panel. */
function destOf(panel) {
  for (const d of DESTS) if (d.panels.indexOf(panel) !== -1) return d;
  return DESTS[0];
}
function destById(id) {
  for (const d of DESTS) if (d.id === id) return d;
  return null;
}
/** Which panel to open when a destination is clicked — the last one you used. */
function panelFor(dest) {
  const remembered = state.tabOf[dest.id];
  return remembered && dest.panels.indexOf(remembered) !== -1 ? remembered : dest.panels[0];
}

/* 16x16 line icons, stroke: currentColor so they take the row's colour and the
   sidebar stays monochrome. SF Symbols is not licensed for the web, and a
   bitmap could not invert against the selected row. */
const ICONS = {
  today: '<path d="M3 5.5h10M3 8.5h10M3 11.5h6"/><circle cx="12.5" cy="11.5" r="2.2"/><path d="M11.6 11.5l.7.7 1.3-1.4"/>',
  inbox: '<path d="M2 9.5V4.2A1.2 1.2 0 0 1 3.2 3h9.6A1.2 1.2 0 0 1 14 4.2v5.3"/><path d="M2 9.5h3.2l1 1.8h3.6l1-1.8H14v2.3A1.2 1.2 0 0 1 12.8 13H3.2A1.2 1.2 0 0 1 2 11.8z"/>',
  layers: '<path d="M8 2.2 2.2 5.3 8 8.4l5.8-3.1z"/><path d="m2.2 8.6 5.8 3.1 5.8-3.1"/><path d="m2.2 11.6 5.8 3.1 5.8-3.1"/>',
  chart: '<path d="M2.4 13.6h11.2"/><path d="M4.4 13.6V8.4M7.5 13.6V4.6M10.6 13.6v-3.4M13.6 13.6V6.8" stroke-width="1.8"/>',
  route: '<circle cx="4" cy="4" r="1.8"/><circle cx="12" cy="12" r="1.8"/><path d="M4 5.8v2.4A2.4 2.4 0 0 0 6.4 10.6h3.2A2.4 2.4 0 0 1 12 13v-2.8"/>',
  live: '<circle cx="8" cy="8" r="1.8"/><path d="M4.6 4.6a4.8 4.8 0 0 0 0 6.8M11.4 11.4a4.8 4.8 0 0 0 0-6.8"/>',
  target: '<circle cx="8" cy="8" r="5.6"/><circle cx="8" cy="8" r="2.4"/>',
  pulse: '<path d="M2 8h2.6l1.6-3.6L9 12l1.7-4h3.3"/>',
  warning: '<path d="M8 2.8 1.9 13.2h12.2z"/><path d="M8 6.4v3.1"/><circle cx="8" cy="11.3" r=".5" fill="currentColor" stroke="none"/>',
  key: '<circle cx="5.4" cy="5.4" r="2.9"/><path d="m7.6 7.6 5.3 5.3M10.6 10.6l1.3-1.3M12.3 12.3l1.2-1.2"/>',
  book: '<path d="M3 3.4h4.2A1.8 1.8 0 0 1 9 5.2v8a1.4 1.4 0 0 0-1.4-1.4H3z"/><path d="M13 3.4H8.8A1.8 1.8 0 0 0 7 5.2v8a1.4 1.4 0 0 1 1.4-1.4H13z"/>',
  // Log out gets its own mark rather than reusing the key: two rows with the same
  // icon read as two versions of the same thing.
  exit: '<path d="M9.6 3.4H4.2A1.2 1.2 0 0 0 3 4.6v6.8a1.2 1.2 0 0 0 1.2 1.2h5.4"/><path d="M11 5.6 13.6 8 11 10.4M13.6 8H6.4"/>',
};

function icon(name) {
  const d = ICONS[name];
  if (!d) return "";
  return `<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

/**
 * The count beside a destination, or "" for none.
 *
 * A badge is the ONLY colour in the sidebar, so it only ever appears when
 * something genuinely wants a person — never as decoration, and never as a
 * running total of things that are fine.
 */
function badgeFor(dest) {
  if (!dest.badge) return "";
  const n = state.badges[dest.badge];
  if (!n) return "";
  const label = n === 1 ? "1 item needs attention" : `${n} items need attention`;
  return `<span class="navbadge" title="${esc(label)}">${fmt(n)}</span>`;
}

/* ---------------- shell + nav ---------------- */
function renderSidebar() {
  const active = destOf(state.view).id;
  const items = DEST.map((d) => {
    if (d.group) return `<div class="glabel">${esc(d.group)}</div>`;
    return `<button class="navlink${d.id === active ? " active" : ""}" data-dest="${d.id}"${d.id === active ? ' aria-current="page"' : ""}>
      ${icon(d.icon)}<span class="navtext">${esc(d.label)}</span>${badgeFor(d)}
    </button>`;
  }).join("");
  document.getElementById("sidebar").innerHTML = `
    <div class="brand">SC Design <span>Wirral</span></div>
    <div class="tag">Admin &amp; analytics</div>
    <nav class="navlist">${items}</nav>
    <div class="spacer"></div>
    <button class="navlink navlink-quiet" id="logoutBtn">${icon("exit")}<span class="navtext">Log out</span></button>`;
}

/** The tab strip for a destination with more than one panel. */
function renderTabs() {
  const el = document.getElementById("tabbar");
  if (!el) return;
  const d = destOf(state.view);
  if (!d.panels || d.panels.length < 2) {
    el.innerHTML = "";
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.innerHTML = d.panels
    .map((p) => `<button class="tab${p === state.view ? " active" : ""}" data-panel="${p}"${p === state.view ? ' aria-current="true"' : ""}>${esc(TITLES[p] || p)}</button>`)
    .join("");
}

/**
 * Show only the toolbar controls this destination actually uses.
 *
 * The range picker and the bots toggle used to render on every view, including
 * the ten where they changed nothing — and touching one there still triggered a
 * full reload. A control that cannot affect what you are looking at should not
 * be on the screen.
 */
function renderToolbar() {
  const d = destOf(state.view);
  // A destination can hold one panel that reads a date range and another that does
  // not — Health & Speed is exactly that. `only` names the panels that use the
  // controls, so the other tab doesn't grow a picker that changes nothing.
  const applies = !d.only || d.only.indexOf(state.view) !== -1;
  const seg = document.getElementById("rangeSeg");
  const bots = document.getElementById("botsWrap");
  if (seg) seg.hidden = !(d.range && applies);
  if (bots) bots.hidden = !(d.bots && applies);
}

function renderRangeSeg() {
  const ranges = [["24h", "24h"], ["7d", "7d"], ["30d", "30d"], ["90d", "90d"]];
  document.getElementById("rangeSeg").innerHTML = ranges
    .map(([v, l]) => `<button data-range="${v}" class="${state.range === v ? "active" : ""}">${l}</button>`)
    .join("");
}

function clearRt() {
  if (state.rtTimer) { clearInterval(state.rtTimer); state.rtTimer = null; }
}

function setPageMeta() {
  let txt = "";
  if (state.view === "today") {
    try { txt = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }); }
    catch (e) { txt = ""; }
  }
  else if (state.view === "data") txt = "Reference";
  else if (state.view === "health") {
    txt = state.health && !state.health.failed ? "Checked just now" : "Configuration";
  }
  else if (state.view === "journeys") {
    txt = state.journeys
      ? `${rangeLabel()} · ${fmt(state.journeys.summary.visitors)} visitors${state.journeys.meta.botsExcluded ? " · bots excluded" : ""}`
      : rangeLabel();
  } else if (state.view === "flow") {
    txt = state.flow
      ? `${rangeLabel()} · ${fmt(state.flow.summary.sessions)} visits${state.flow.meta.botsExcluded ? " · bots excluded" : ""}`
      : rangeLabel();
  } else if (state.view === "enquiries") {
    txt = state.enquiries ? `${fmt(state.enquiries.total)} enquiries saved` : "Form submissions";
  } else if (state.view === "errors") {
    txt = state.errorLogs
      ? `${fmt(state.errorLogs.total)} errors${state.errorLogs.botMode === "exclude" ? " · bots excluded" : state.errorLogs.botMode === "only" ? " · bots only" : ""}`
      : "Client errors";
  } else if (state.view === "logins") {
    txt = state.logins
      ? `${fmt(state.logins.failedTotal)} failed · ${fmt(state.logins.successTotal)} successful`
      : "Admin sign-ins";
  } else if (state.data) {
    txt = `${rangeLabel()} · ${fmt(state.data.meta.rowsScanned)} events scanned${state.data.meta.botsExcluded ? " · bots excluded" : ""}`;
  }
  document.getElementById("pageMeta").textContent = txt;
}

/**
 * Render the current panel.
 *
 * `opts.reuse` keeps the stats bundle when moving between two reports that read
 * it — the seven Visitors tabs all come from one fetch, so switching between
 * them is instant instead of re-downloading the whole event history.
 *
 * This is a deliberate, narrow relaxation of the rule that the admin never shows
 * a cached response. Refresh, the date range and the bots toggle all still force
 * a full refetch, and the toolbar stamp shows the real age of what is on screen.
 * Reuse is only ever granted between two STATS_VIEWS panels.
 */
function renderView(opts) {
  clearRt();
  const reuse = !!(opts && opts.reuse) && !!state.data;
  // Always start from a clean slate — never display cached/in-memory results.
  // Each view re-fetches its data live below.
  if (!reuse) state.data = null;
  state.realtime = null;
  state.journeys = null;
  state.flow = null;
  // Like `flow` and `journeys`, these read their own reports and are refetched on
  // arrival. `srcSel` (WHICH source you drilled into) is deliberately not cleared —
  // it is a filter, and it belongs with trendMetric and flowPage below.
  state.srcJourneys = null;
  state.delivery = null;
  state.errTrend = null;
  state.enquiries = null;
  state.enqUnnotified = null;
  state.errorLogs = null;
  // The one-line download feedback is about the last action, not the data, so
  // it goes when you navigate away. The saved watermark is NOT touched here —
  // that has to survive, or "only new errors" would forget on every click.
  state.errExportNote = "";
  state.errExporting = false;
  state.logins = null;
  state.health = null;
  if (!reuse) state.today = null;
  // Clears the fetched project list only — the open editor is deliberately kept,
  // because Refresh and the topbar controls come through here too.
  if (window.SCProjects) window.SCProjects.reset();

  // The title is the DESTINATION, because the panel's own name is already on its
  // tab. A single-panel destination falls back to the panel label.
  const d = destOf(state.view);
  document.getElementById("pageTitle").textContent =
    d.panels.length > 1 ? d.label : TITLES[state.view] || d.label;
  renderTabs();
  renderToolbar();
  setPageMeta();
  const el = document.getElementById("view");
  el.innerHTML = (VIEWS[state.view] || viewToday)(); // shows a loader (state is null)
  const v = state.view;
  // Drilled into one source: that panel reads its own report and does not need the
  // shared bundle at all, so it loads one thing instead of two.
  if (v === "sources" && state.srcSel) {
    loadSourceJourneys();
    return;
  }
  // Already holding the bundle this panel reads: paint it and ask for nothing.
  if (reuse && STATS_VIEWS.indexOf(v) !== -1) {
    setPageMeta();
    return;
  }
  if (v === "today") loadToday();
  else if (v === "realtime") {
    loadRealtime();
    state.rtTimer = setInterval(loadRealtime, 15000);
  } else if (v === "projects") {
    if (window.SCProjects) window.SCProjects.load();
  } else if (v === "journeys") loadJourneys();
  else if (v === "flow") loadFlow();
  else if (v === "enquiries") loadEnquiries(state.enqPage);
  else if (v === "errors") loadErrors(state.errPage);
  else if (v === "logins") loadLogins(state.loginPage);
  else if (v === "health") loadHealth();
  else if (v === "delivery") loadDelivery();
  else if (v === "errtrend") loadErrTrend();
  else if (v === "data") {
    /* static reference catalogue — nothing to fetch */
  } else loadStatsView();
}

// Mobile-aware sidebar open/close: keeps aria-expanded in sync and marks the
// off-screen sidebar `inert` so keyboard users can't Tab into hidden nav links
// (mobile only; the desktop sidebar is always visible and operable).
const mqMobile = window.matchMedia("(max-width: 860px)");
function setNavOpen(open) {
  const app = document.getElementById("app");
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("menuToggle");
  if (app) app.classList.toggle("nav-open", open);
  if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
  if (sidebar) {
    if (mqMobile.matches && !open) sidebar.setAttribute("inert", "");
    else sidebar.removeAttribute("inert");
  }
  // Return focus to the toggle when closing on mobile (don't strand it on inert).
  if (!open && mqMobile.matches && sidebar && toggle && sidebar.contains(document.activeElement))
    toggle.focus();
}
mqMobile.addEventListener("change", () => {
  const app = document.getElementById("app");
  setNavOpen(!!(app && app.classList.contains("nav-open")));
});

/* ---------------- routing ---------------- *
 * Every panel has an address: #/visitors, #/visitors/pages, #/enquiries. Refresh
 * keeps your place, Back steps between views, and a link can be shared.
 *
 * Identifiers stay OUT of the hash on purpose: error-capture.js sends the full
 * window.location.href with every client error, so anything in a route is
 * written to sc_errors. A view name is fine; a customer reference would not be.
 */

/** "#/visitors/pages" -> "pages". Unknown routes fall back to Today. */
function panelFromHash() {
  const raw = String(location.hash || "").replace(/^#\/?/, "");
  if (!raw) return null;
  const parts = raw.split("/").filter(Boolean).map((s) => s.toLowerCase());
  const d = destById(parts[0]);
  if (!d) return null;
  if (parts[1] && d.panels.indexOf(parts[1]) !== -1) return parts[1];
  return panelFor(d);
}

function hashForPanel(panel) {
  const d = destOf(panel);
  // The first panel is the destination's default, so it needs no second segment —
  // that keeps #/journeys rather than the repetitive #/journeys/journeys.
  if (d.panels.length < 2 || d.panels[0] === panel) return `#/${d.id}`;
  return `#/${d.id}/${panel}`;
}

function syncHash(panel) {
  const want = hashForPanel(panel);
  // Only write when it differs. setView writes the hash and the hashchange
  // listener calls setView, so without this guard every click would render — and
  // fetch — twice.
  if (location.hash !== want) {
    try { location.hash = want; } catch (e) { /* non-fatal */ }
  }
}

function setView(id, opts) {
  if (!VIEWS[id]) id = "today";
  const prev = state.view;
  // Moving between two reports that read the same bundle: keep it.
  const sameBundle =
    prev !== id && STATS_VIEWS.indexOf(prev) !== -1 && STATS_VIEWS.indexOf(id) !== -1 && !!state.data;
  state.view = id;
  // Remember the tab within its destination, so returning to Visitors brings you
  // back to the report you were reading.
  const d = destOf(id);
  if (d.panels.length > 1) state.tabOf[d.id] = id;
  if (!(opts && opts.fromHash)) syncHash(id);
  setNavOpen(false);
  renderSidebar();
  renderView({ reuse: sameBundle });
  window.scrollTo(0, 0);
}

function onHashChange() {
  const panel = panelFromHash();
  if (!panel) {
    // An unrecognised route. Stay where we are, but correct the address so it
    // stops claiming to point at a page that does not exist. (syncHash writes
    // only when it differs, so this settles after one pass.)
    syncHash(state.view);
    return;
  }
  // Already there — the hash we just wrote ourselves. Stop, or this renders twice.
  if (panel === state.view) return;
  setView(panel, { fromHash: true });
}

/* ---------------- API ---------------- */
/* Always fetch live: a per-request cache-buster + `cache: no-store` defeats any
   browser/CDN cache, so the admin can never show a stale response. */
function apiGet(url) {
  const sep = url.indexOf("?") === -1 ? "?" : "&";
  return fetch(url + sep + "_=" + Date.now(), { credentials: "include", cache: "no-store" });
}
/* Every mutation is a POST with an `action` in the body: the API advertises only
   GET/POST/OPTIONS and only the Content-Type header, so PUT/PATCH/DELETE and any
   custom header would fail the CORS preflight. */
function apiPost(url, body) {
  return fetch(url, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
}
function markFresh() {
  const el = document.getElementById("lastUpdated");
  if (el) el.textContent = "Live · updated " + new Date().toLocaleTimeString("en-GB");
}

// Views that all read from the shared stats bundle (state.data).
const STATS_VIEWS = ["overview", "trends", "pages", "content", "sources", "locations", "devices", "engagement", "events", "visualiser", "speed"];

async function loadStats() {
  const url = `${STATS}?range=${state.range}&bots=${state.bots ? "include" : "exclude"}`;
  const r = await apiGet(url);
  if (r.status === 401) { showLogin(); return false; }
  if (!r.ok) throw new Error("stats " + r.status);
  state.data = await r.json();
  markFresh();
  return true;
}

async function loadStatsView() {
  try {
    const ok = await loadStats();
    if (ok && STATS_VIEWS.indexOf(state.view) !== -1) {
      document.getElementById("view").innerHTML = (VIEWS[state.view] || viewOverview)();
      setPageMeta();
    }
  } catch (e) {
    if (STATS_VIEWS.indexOf(state.view) !== -1) {
      document.getElementById("view").innerHTML = '<div class="card"><div class="empty">Could not load. Try Refresh.</div></div>';
    }
  }
}

async function loadRealtime() {
  try {
    const url = `${STATS}?report=realtime&bots=${state.bots ? "include" : "exclude"}`;
    const r = await apiGet(url);
    if (r.status === 401) { showLogin(); return; }
    if (r.ok) {
      state.realtime = await r.json();
      markFresh();
      if (state.view === "realtime") document.getElementById("view").innerHTML = viewRealtime();
    }
  } catch (e) { /* ignore transient */ }
}

async function loadJourneys() {
  try {
    const url = `${STATS}?report=journeys&range=${state.range}&bots=${state.bots ? "include" : "exclude"}`;
    const r = await apiGet(url);
    if (r.status === 401) { showLogin(); return; }
    if (!r.ok) throw new Error("journeys " + r.status);
    state.journeys = await r.json();
    markFresh();
    if (state.view === "journeys") {
      document.getElementById("view").innerHTML = viewJourneys();
      setPageMeta();
    }
  } catch (e) {
    if (state.view === "journeys") {
      document.getElementById("view").innerHTML = '<div class="card"><div class="empty">Could not load journeys. Try Refresh.</div></div>';
    }
  }
}

async function loadFlow() {
  try {
    const url = `${STATS}?report=flow&range=${state.range}&bots=${state.bots ? "include" : "exclude"}`;
    const r = await apiGet(url);
    if (r.status === 401) { showLogin(); return; }
    if (!r.ok) throw new Error("flow " + r.status);
    state.flow = await r.json();
    markFresh();
    if (state.view === "flow") {
      document.getElementById("view").innerHTML = viewFlow();
      setPageMeta();
    }
  } catch (e) {
    if (state.view === "flow") {
      document.getElementById("view").innerHTML = '<div class="card"><div class="empty">Could not load path flow. Try Refresh.</div></div>';
    }
  }
}

/**
 * Every visit that arrived from one source, with what it turned into.
 *
 * Its own report rather than a filter over the journeys bundle, because it also has
 * to join the saved enquiry rows — and those live in a different table.
 */
async function loadSourceJourneys() {
  const sel = state.srcSel;
  if (!sel) return;
  const src = `${sel.kind}:${sel.value}`;
  try {
    const url = `${STATS}?report=sourcejourneys&src=${encodeURIComponent(src)}&range=${state.range}&bots=${state.bots ? "include" : "exclude"}`;
    const r = await apiGet(url);
    if (r.status === 401) { showLogin(); return; }
    if (!r.ok) throw new Error("sourcejourneys " + r.status);
    const data = await r.json();
    // A slow answer for a source you have since navigated away from must not paint
    // over the one you are looking at now.
    if (!state.srcSel || `${state.srcSel.kind}:${state.srcSel.value}` !== src) return;
    state.srcJourneys = data;
    markFresh();
    if (state.view === "sources") {
      document.getElementById("view").innerHTML = viewSources();
      setPageMeta();
    }
  } catch (e) {
    state.srcJourneys = { failed: true, meta: {}, summary: {}, journeys: [] };
    if (state.view === "sources") document.getElementById("view").innerHTML = viewSources();
  }
}

async function loadDelivery() {
  try {
    const url = `${STATS}?report=delivery&range=${state.range}&bots=${state.bots ? "include" : "exclude"}`;
    const r = await apiGet(url);
    if (r.status === 401) { showLogin(); return; }
    if (!r.ok) throw new Error("delivery " + r.status);
    state.delivery = await r.json();
    markFresh();
    if (state.view === "delivery") {
      document.getElementById("view").innerHTML = viewDelivery();
      setPageMeta();
    }
  } catch (e) {
    state.delivery = { failed: true };
    if (state.view === "delivery") document.getElementById("view").innerHTML = viewDelivery();
  }
}

async function loadErrTrend() {
  try {
    // Same filters as the Errors list, so the two can never disagree about what
    // they are counting.
    const url = `${ERROR_LOGS}?report=trend&days=30&kind=errors&bots=${state.errBots}&party=${state.errParty}`;
    const r = await apiGet(url);
    if (r.status === 401) { showLogin(); return; }
    if (!r.ok) throw new Error("errtrend " + r.status);
    state.errTrend = await r.json();
    markFresh();
    if (state.view === "errtrend") {
      document.getElementById("view").innerHTML = viewErrTrend();
      setPageMeta();
    }
  } catch (e) {
    state.errTrend = { failed: true };
    if (state.view === "errtrend") document.getElementById("view").innerHTML = viewErrTrend();
  }
}

/**
 * How many enquiries reached the database but never reached an inbox.
 *
 * The form logs a form_error whenever it has to fall back to mailto, and those
 * rows carry backupStored / backupEmailed. Between July and September 2026 six
 * of them were stored with nobody emailed, and the only way anyone found out
 * was by reading the raw error log months later. Counting them here puts it on
 * the screen Sean actually looks at.
 *
 * Best-effort and non-blocking: if this fails the enquiries list still renders.
 */
/** The amber banner: enquiries that arrived but that nobody was told about. */
function unnotifiedBanner() {
  const u = state.enqUnnotified;
  if (!u) return "";
  // A failed check must never look like a clean bill of health. Rendering nothing
  // on error is indistinguishable from "all fine", which is the whole failure mode
  // this banner exists to prevent.
  if (u.failed) {
    return `
      <div class="callout callout-warn">
        <strong>Couldn't check whether these enquiries were emailed.</strong>
        The enquiries below are safe — it is only the notification check that failed. Try Refresh.
      </div>`;
  }
  if (!u.count) return "";
  const one = u.count === 1;
  const when = u.oldest ? ` The earliest was ${esc(fmtDateTime(u.oldest))}.` : "";
  const why =
    u.reason === "smtp_not_configured"
      ? " The backup email can't send because <strong>SMTP_USER and SMTP_PASS are not set</strong> in the scdesign-wirral Vercel project."
      : u.reason
      ? ` The mail server reported: <code>${esc(u.reason)}</code>.`
      : "";
  return `
    <div class="callout callout-warn">
      <strong>At least ${fmt(u.count)} ${one ? "enquiry" : "enquiries"} below ${one ? "was" : "were"} saved here but nobody was emailed about ${one ? "it" : "them"}.</strong>
      ${one ? "It is" : "They are"} in the list and the contact details are safe — but nobody was told at the time, so ${one ? "it" : "they"} may never have been answered.${when}${why}
      <div class="callout-sub">This is a minimum, not a total: the website only records the failure when <em>both</em> notification routes failed for the same enquiry, so one that slipped through on only one route is not counted here.</div>
    </div>`;
}

async function countUnnotifiedEnquiries() {
  try {
    // kind=unnotified filters server-side and returns an EXACT total. It used to
    // pull one 200-row page of the whole error log and filter it here, which meant
    // the warning quietly vanished once those rows aged out of the first page.
    const r = await apiGet(`${ERROR_LOGS}?kind=unnotified&bots=include&party=all&pageSize=200`);
    if (!r.ok) return { failed: true };
    const j = await r.json();
    if (!j.ok) return { failed: true };
    const rows = j.rows || [];
    const total = Number.isFinite(j.total) ? j.total : rows.length;
    if (!total) return { count: 0 };
    return {
      count: total,
      newest: (rows[0] || {}).ts || null,
      // Rows arrive newest-first, so the last one is the earliest — but only when
      // this page holds every match. Beyond that, say nothing rather than name a
      // date that is really just the oldest of the most recent 200.
      oldest: total <= rows.length ? (rows[rows.length - 1] || {}).ts || null : null,
      // "smtp_not_configured" is the usual culprit and names its own fix.
      reason: rows.map((h) => (h.props || {}).emailError).find(Boolean) || null,
    };
  } catch (e) {
    return { failed: true };
  }
}

async function loadHealth() {
  try {
    const r = await apiGet(`${STATS}?report=health`);
    if (r.status === 401) { showLogin(); return; }
    if (!r.ok) throw new Error("health " + r.status);
    const j = await r.json();
    state.health = j && j.ok ? j : { failed: true };
    markFresh();
  } catch (e) {
    // A health check that fails must say so, not render an empty page that reads
    // as "nothing wrong".
    state.health = { failed: true };
  }
  if (state.view === "health") {
    document.getElementById("view").innerHTML = viewHealth();
    setPageMeta();
  }
}

async function loadEnquiries(page) {
  state.enqPage = page || state.enqPage || 1;
  try {
    const url = `${ENQUIRIES}?page=${state.enqPage}&pageSize=10`;
    const r = await apiGet(url);
    if (r.status === 401) { showLogin(); return; }
    if (!r.ok) throw new Error("enquiries " + r.status);
    state.enquiries = await r.json();
    state.enqPage = state.enquiries.page;
    state.enqUnnotified = await countUnnotifiedEnquiries();
    markFresh();
    if (state.view === "enquiries") {
      document.getElementById("view").innerHTML = viewEnquiries();
      setPageMeta();
    }
  } catch (e) {
    if (state.view === "enquiries") {
      document.getElementById("view").innerHTML = '<div class="card"><div class="empty">Could not load enquiries. Try Refresh.</div></div>';
    }
  }
}

async function loadErrors(page) {
  state.errPage = page || state.errPage || 1;
  try {
    const url = `${ERROR_LOGS}?page=${state.errPage}&pageSize=10&bots=${state.errBots}&party=${state.errParty}`;
    const r = await apiGet(url);
    if (r.status === 401) { showLogin(); return; }
    if (!r.ok) throw new Error("errors " + r.status);
    state.errorLogs = await r.json();
    state.errPage = state.errorLogs.page;
    markFresh();
    if (state.view === "errors") {
      document.getElementById("view").innerHTML = viewErrors();
      setPageMeta();
    }
  } catch (e) {
    if (state.view === "errors") {
      document.getElementById("view").innerHTML = '<div class="card"><div class="empty">Could not load error logs. Try Refresh.</div></div>';
    }
  }
}

async function loadLogins(page) {
  state.loginPage = page || state.loginPage || 1;
  try {
    const url = `${ERROR_LOGS}?kind=${state.loginKind}&page=${state.loginPage}&pageSize=10&bots=${state.loginBots}`;
    const r = await apiGet(url);
    if (r.status === 401) { showLogin(); return; }
    if (!r.ok) throw new Error("logins " + r.status);
    state.logins = await r.json();
    state.loginPage = state.logins.page;
    markFresh();
    if (state.view === "logins") {
      document.getElementById("view").innerHTML = viewLogins();
      setPageMeta();
    }
  } catch (e) {
    if (state.view === "logins") {
      document.getElementById("view").innerHTML = '<div class="card"><div class="empty">Could not load login attempts. Try Refresh.</div></div>';
    }
  }
}

// Refresh = re-render the current view, which always re-fetches live data.
function refresh() {
  renderView();
  // The badges are counts of things that need doing, so they have to move when
  // the underlying thing does — downloading the error log should drop the Errors
  // badge without needing a page reload.
  loadBadges();
}

/* ---------------- auth / boot ---------------- */
function showLogin() {
  clearRt();
  document.getElementById("app").classList.add("hidden");
  document.getElementById("login").classList.remove("hidden");
}
function showApp() {
  document.getElementById("login").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
}

async function doLogin(username, password) {
  const errEl = document.getElementById("loginErr");
  const btn = document.getElementById("loginBtn");
  errEl.textContent = "";
  btn.disabled = true;
  btn.textContent = "Signing in…";
  try {
    const r = await fetch(LOGIN, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok) {
      showApp();
      renderSidebar();
      renderRangeSeg();
      // refresh() goes through renderView(), which DOES dispatch the per-view
      // loaders — so a deep link that hit the login screen lands on the right
      // page with its data, not on an empty one.
      await refresh();
      loadBadges();
    } else {
      errEl.textContent = j.error || "Sign in failed.";
    }
  } catch (e) {
    errEl.textContent = "Could not reach the server. Check your connection.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
}

function wire() {
  document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    doLogin(document.getElementById("username").value, document.getElementById("password").value);
  });

  // delegated nav + logout + in-view controls
  document.getElementById("sidebar").addEventListener("click", (e) => {
    // Logout first: it is a .navlink too, and only its id distinguishes it.
    if (e.target.closest("#logoutBtn")) {
      fetch(LOGOUT, { method: "POST", credentials: "include" }).finally(showLogin);
      return;
    }
    const link = e.target.closest("[data-dest]");
    if (!link) return;
    const d = destById(link.getAttribute("data-dest"));
    if (d) setView(panelFor(d));
  });

  // Tabs within a destination.
  const tabbar = document.getElementById("tabbar");
  if (tabbar) {
    tabbar.addEventListener("click", (e) => {
      const b = e.target.closest("[data-panel]");
      if (b) setView(b.getAttribute("data-panel"));
    });
  }

  window.addEventListener("hashchange", onHashChange);
  document.getElementById("rangeSeg").addEventListener("click", (e) => {
    const b = e.target.closest("[data-range]");
    if (!b) return;
    state.range = b.getAttribute("data-range");
    renderRangeSeg();
    refresh();
  });
  document.getElementById("botsToggle").addEventListener("change", (e) => {
    state.bots = e.target.checked;
    refresh();
  });
  document.getElementById("refreshBtn").addEventListener("click", refresh);
  document.getElementById("menuToggle").addEventListener("click", () => {
    const app = document.getElementById("app");
    setNavOpen(!(app && app.classList.contains("nav-open")));
  });
  document.getElementById("view").addEventListener("click", (e) => {
    // The Projects section handles its own clicks and says so by returning true.
    if (window.SCProjects && window.SCProjects.onClick(e)) return;
    // "Open →" / "See all" links on Today, which jump to a destination.
    const jump = e.target.closest("[data-dest]");
    if (jump) {
      const d = destById(jump.getAttribute("data-dest"));
      if (d) { setView(panelFor(d)); return; }
    }
    const m = e.target.closest("[data-m]");
    if (m) { state.trendMetric = m.getAttribute("data-m"); document.getElementById("view").innerHTML = viewTrends(); return; }
    const jt = e.target.closest("[data-jtoggle]");
    if (jt) { jt.closest(".journey").classList.toggle("open"); return; }
    const jf = e.target.closest("[data-jfilter]");
    if (jf) {
      state.journeyFilter = jf.getAttribute("data-jfilter");
      document.getElementById("view").innerHTML = viewJourneys();
      return;
    }
    // Sources: drill into one source, come back out, or flip the order.
    const sg = e.target.closest("[data-srcgo]");
    if (sg) {
      const raw = sg.getAttribute("data-srcgo") || "";
      const ci = raw.indexOf(":");
      state.srcSel = { kind: ci === -1 ? raw : raw.slice(0, ci), value: ci === -1 ? "" : raw.slice(ci + 1) };
      state.srcJourneys = null;
      document.getElementById("view").innerHTML = viewSources();
      loadSourceJourneys();
      window.scrollTo(0, 0);
      return;
    }
    if (e.target.closest("[data-srcback]")) {
      state.srcSel = null;
      state.srcJourneys = null;
      // The bundle was never fetched while drilled in, so ask for it now rather
      // than painting an empty page.
      if (state.data) document.getElementById("view").innerHTML = viewSources();
      else { document.getElementById("view").innerHTML = loader(); loadStatsView(); }
      window.scrollTo(0, 0);
      return;
    }
    const so = e.target.closest("[data-srcorder]");
    if (so) {
      state.srcOrder = so.getAttribute("data-srcorder");
      document.getElementById("view").innerHTML = viewSources();
      return;
    }
    const sjt = e.target.closest("[data-sjtoggle]");
    if (sjt) { sjt.closest(".journey").classList.toggle("open"); return; }
    const fg = e.target.closest("[data-flowgo]");
    if (fg) {
      state.flowPage = fg.getAttribute("data-flowgo");
      document.getElementById("view").innerHTML = viewFlow();
      window.scrollTo(0, 0);
      return;
    }
    const ep = e.target.closest("[data-enqpage]");
    if (ep) {
      const p = parseInt(ep.getAttribute("data-enqpage"), 10);
      if (Number.isFinite(p)) { loadEnquiries(p); window.scrollTo(0, 0); }
      return;
    }
    const et = e.target.closest("[data-enqtoggle]");
    if (et) {
      const det = document.getElementById("enqd-" + et.getAttribute("data-enqtoggle"));
      if (det) det.hidden = !det.hidden;
      et.classList.toggle("open");
      return;
    }
    const errc = e.target.closest("[data-errcopy]");
    if (errc) {
      copyErrorToClipboard(parseInt(errc.getAttribute("data-errcopy"), 10), errc);
      return;
    }
    if (e.target.closest("[data-errexport]")) {
      exportErrorLogs();
      return;
    }
    if (e.target.closest("[data-errexportreset]")) {
      errExportClear();
      state.errExportNote = "Cleared — the next download will contain every error again.";
      document.getElementById("view").innerHTML = viewErrors();
      return;
    }
    const errf = e.target.closest("[data-errfilter]");
    if (errf) {
      state.errBots = errf.getAttribute("data-errfilter");
      state.errPage = 1;
      state.errorLogs = null;
      loadErrors(1);
      return;
    }
    const errpa = e.target.closest("[data-errparty]");
    if (errpa) {
      state.errParty = errpa.getAttribute("data-errparty");
      state.errPage = 1;
      state.errorLogs = null;
      loadErrors(1);
      return;
    }
    const errp = e.target.closest("[data-errpage]");
    if (errp) {
      const p = parseInt(errp.getAttribute("data-errpage"), 10);
      if (Number.isFinite(p)) { loadErrors(p); window.scrollTo(0, 0); }
      return;
    }
    const errt = e.target.closest("[data-errtoggle]");
    if (errt) {
      const det = document.getElementById("errd-" + errt.getAttribute("data-errtoggle"));
      if (det) det.hidden = !det.hidden;
      errt.classList.toggle("open");
      return;
    }
    const lf = e.target.closest("[data-loginfilter]");
    if (lf) {
      state.loginKind = lf.getAttribute("data-loginfilter");
      state.loginPage = 1;
      state.logins = null;
      loadLogins(1);
      return;
    }
    const lp = e.target.closest("[data-loginpage]");
    if (lp) {
      const p = parseInt(lp.getAttribute("data-loginpage"), 10);
      if (Number.isFinite(p)) { loadLogins(p); window.scrollTo(0, 0); }
      return;
    }
    const lt = e.target.closest("[data-logintoggle]");
    if (lt) {
      const det = document.getElementById("logind-" + lt.getAttribute("data-logintoggle"));
      if (det) det.hidden = !det.hidden;
      lt.classList.toggle("open");
      return;
    }
  });
  // The source rows are table rows acting as buttons, and a <tr> does not fire a
  // click from the keyboard the way a real button does.
  document.getElementById("view").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const sg = e.target.closest && e.target.closest("[data-srcgo]");
    if (!sg) return;
    e.preventDefault();
    sg.click();
  });
  document.getElementById("view").addEventListener("change", (e) => {
    if (window.SCProjects && window.SCProjects.onChange(e)) return;
    if (e.target && e.target.id === "errOnlyNew") {
      // Kept in state, not read off the DOM at download time: the view is
      // re-rendered wholesale on refresh and the tick would otherwise reset.
      state.errOnlyNew = !!e.target.checked;
      return;
    }
    const fs = e.target.closest("[data-flowsel]");
    if (fs) {
      state.flowPage = fs.value;
      document.getElementById("view").innerHTML = viewFlow();
    }
  });
}

/**
 * Counts for the sidebar badges. Best-effort and never blocking: if one fails
 * its badge simply does not appear.
 */
async function loadBadges() {
  const get = (url) => apiGet(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const mark = errExportMark();
  const [unnotified, health, errs] = await Promise.all([
    countUnnotifiedEnquiries(),
    get(`${STATS}?report=health`),
    get(`${ERROR_LOGS}?kind=errors&bots=exclude&party=site&pageSize=1${mark ? `&sinceId=${mark}` : ""}`),
  ]);
  const badges = {};
  if (unnotified && !unnotified.failed && unnotified.count) badges.enquiries = unnotified.count;
  if (health && health.ok) {
    const probs = healthProblemList(health).length;
    if (probs) badges.health = probs;
  }
  if (errs && errs.ok && errs.total) badges.errors = errs.total;
  state.badges = badges;
  // Repaint only the sidebar — the content area may be mid-edit in Projects.
  if (!document.getElementById("app").classList.contains("hidden")) renderSidebar();
}

async function boot() {
  wire();
  renderRangeSeg();
  // Parse the route BEFORE anything else, so a deep link survives the session
  // check and the sign-in round trip below.
  const routed = panelFromHash();
  if (routed) state.view = routed;
  // Try existing session; if valid, go straight to the dashboard. loadStats also
  // serves as the auth probe — its 401 is how an expired session reaches the
  // login screen.
  try {
    const ok = await loadStats();
    if (ok) {
      showApp();
      renderSidebar();
      setNavOpen(false);
      // boot() used to hand-render the default view to avoid a second stats
      // fetch. That skipped every per-view loader, so a deep link to anything
      // other than a stats report sat on "Loading…" for ever. It now goes
      // through renderView() and simply reuses the bundle it already has.
      renderView({ reuse: STATS_VIEWS.indexOf(state.view) !== -1 });
      syncHash(state.view);
      loadBadges();
    }
  } catch (e) {
    showLogin();
  }
}

boot();
