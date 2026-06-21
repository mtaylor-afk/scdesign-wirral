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

const state = {
  range: "7d",
  bots: false,
  view: "overview",
  trendMetric: "pageviews",
  data: null,
  realtime: null,
  rtTimer: null,
  journeys: null,
  journeyFilter: "all",
  flow: null,
  flowPage: null,
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

function convItems(d) {
  const names = ["phone_click", "email_click", "whatsapp_click", "form_submit", "cta_click", "visualiser_start"];
  return d.events.byName.filter((i) => names.includes(i.key));
}

/* ---------------- views ---------------- */
function viewOverview() {
  const d = state.data;
  if (!d) return loader();
  const m = d.metrics, p = d.prevMetrics;
  const kpis = [
    kpi("Unique visitors", fmt(m.visitors), "", delta(m.visitors, p.visitors)),
    kpi("Visits", fmt(m.sessions), "", delta(m.sessions, p.sessions)),
    kpi("Page views", fmt(m.pageviews), "", delta(m.pageviews, p.pageviews)),
    kpi("Bounce rate", pct(m.bounceRate), "", delta(m.bounceRate, p.bounceRate, true)),
    kpi("Avg. visit", dur(m.avgDuration), "", delta(m.avgDuration, p.avgDuration)),
    kpi("Pages / visit", m.pagesPerVisit, "", delta(m.pagesPerVisit, p.pagesPerVisit)),
  ].join("");
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

function viewSources() {
  const d = state.data;
  if (!d) return loader();
  const camp = d.sources.campaigns;
  const campRows = camp.length
    ? camp.map((c) => `<tr><td>${esc(c.key)}</td><td class="num">${fmt(c.count)}</td></tr>`).join("")
    : '<tr><td colspan="2" class="empty">No UTM-tagged campaigns yet. Add ?utm_source=…&utm_medium=… to links you share.</td></tr>';
  return `
    <div class="grid cols-2">
      <div class="card"><h3>Channels</h3><div class="csub">Traffic by type</div>${barList(d.sources.channels, { limit: 8, fmt: cap })}</div>
      <div class="card"><h3>Referrers</h3><div class="csub">Sites linking to you</div>${barList(d.sources.referrers, { limit: 12, empty: "No referrers yet (traffic is direct)." })}</div>
    </div>
    <div class="card" style="margin-top:16px"><h3>Campaigns (UTM)</h3><div class="csub">source / medium / campaign</div>
      <table class="tbl"><thead><tr><th>Campaign</th><th class="num">Views</th></tr></thead><tbody>${campRows}</tbody></table>
    </div>`;
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
  return `
    <div class="card" style="margin-bottom:16px"><h3>All events</h3><div class="csub">${rangeLabel()}</div>
      <table class="tbl"><thead><tr><th>Action</th><th>Event name</th><th class="num">Count</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
    ${perPage ? `<div class="grid cols-3">${perPage}</div>` : ""}`;
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

const VIEWS = {
  overview: viewOverview, trends: viewTrends, pages: viewPages, journeys: viewJourneys, flow: viewFlow, sources: viewSources,
  locations: viewLocations, devices: viewDevices, engagement: viewEngagement,
  realtime: viewRealtime, events: viewEvents, visualiser: viewVisualiser, data: viewDataAvailable,
};
const TITLES = {
  overview: "Overview", trends: "Traffic trends", pages: "Pages", journeys: "Visitor journeys", flow: "Path flow", sources: "Sources",
  locations: "Locations", devices: "Devices & technology", engagement: "Engagement",
  realtime: "Real-time", events: "Events & conversions", visualiser: "Visualiser", data: "Data available",
};
const NAV = [
  { items: [{ id: "overview", label: "Overview" }] },
  { group: "Traffic", items: [
    { id: "trends", label: "Trends" }, { id: "pages", label: "Pages" }, { id: "journeys", label: "Journeys" },
    { id: "flow", label: "Path flow" }, { id: "sources", label: "Sources" },
    { id: "locations", label: "Locations" }, { id: "devices", label: "Devices & Tech" },
    { id: "engagement", label: "Engagement" }, { id: "realtime", label: "Real-time" },
  ]},
  { group: "Conversions", items: [{ id: "events", label: "Events" }, { id: "visualiser", label: "Visualiser" }] },
  { group: "Reference", items: [{ id: "data", label: "Data available" }] },
];

/* ---------------- shell + nav ---------------- */
function renderSidebar() {
  const groups = NAV.map((g) => {
    const links = g.items
      .map((it) => `<button class="navlink ${state.view === it.id ? "active" : ""}" data-view="${it.id}">${esc(it.label)}</button>`)
      .join("");
    return `<div class="navgroup">${g.group ? `<div class="glabel">${esc(g.group)}</div>` : ""}${links}</div>`;
  }).join("");
  document.getElementById("sidebar").innerHTML = `
    <div class="brand">SC Design <span>Wirral</span></div>
    <div class="tag">Admin &amp; analytics</div>
    ${groups}
    <div class="spacer"></div>
    <button class="navlink logout" id="logoutBtn">↩ Log out</button>`;
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
  if (state.view === "data") txt = "Reference";
  else if (state.view === "journeys") {
    txt = state.journeys
      ? `${rangeLabel()} · ${fmt(state.journeys.summary.visitors)} visitors${state.journeys.meta.botsExcluded ? " · bots excluded" : ""}`
      : rangeLabel();
  } else if (state.view === "flow") {
    txt = state.flow
      ? `${rangeLabel()} · ${fmt(state.flow.summary.sessions)} visits${state.flow.meta.botsExcluded ? " · bots excluded" : ""}`
      : rangeLabel();
  } else if (state.data) {
    txt = `${rangeLabel()} · ${fmt(state.data.meta.rowsScanned)} events scanned${state.data.meta.botsExcluded ? " · bots excluded" : ""}`;
  }
  document.getElementById("pageMeta").textContent = txt;
}

function renderView() {
  clearRt();
  document.getElementById("pageTitle").textContent = TITLES[state.view];
  setPageMeta();
  const el = document.getElementById("view");
  el.innerHTML = (VIEWS[state.view] || viewOverview)();
  if (state.view === "realtime") {
    loadRealtime();
    state.rtTimer = setInterval(loadRealtime, 15000);
  }
  if (state.view === "journeys" && !state.journeys) loadJourneys();
  if (state.view === "flow" && !state.flow) loadFlow();
}

function setView(id) {
  state.view = id;
  document.getElementById("app").classList.remove("nav-open");
  renderSidebar();
  renderView();
  window.scrollTo(0, 0);
}

/* ---------------- API ---------------- */
async function loadStats() {
  const url = `${STATS}?range=${state.range}&bots=${state.bots ? "include" : "exclude"}`;
  const r = await fetch(url, { credentials: "include" });
  if (r.status === 401) { showLogin(); return false; }
  if (!r.ok) throw new Error("stats " + r.status);
  state.data = await r.json();
  return true;
}

async function loadRealtime() {
  try {
    const url = `${STATS}?report=realtime&bots=${state.bots ? "include" : "exclude"}`;
    const r = await fetch(url, { credentials: "include" });
    if (r.status === 401) { showLogin(); return; }
    if (r.ok) {
      state.realtime = await r.json();
      if (state.view === "realtime") document.getElementById("view").innerHTML = viewRealtime();
    }
  } catch (e) { /* ignore transient */ }
}

async function loadJourneys() {
  try {
    const url = `${STATS}?report=journeys&range=${state.range}&bots=${state.bots ? "include" : "exclude"}`;
    const r = await fetch(url, { credentials: "include" });
    if (r.status === 401) { showLogin(); return; }
    if (!r.ok) throw new Error("journeys " + r.status);
    state.journeys = await r.json();
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
    const r = await fetch(url, { credentials: "include" });
    if (r.status === 401) { showLogin(); return; }
    if (!r.ok) throw new Error("flow " + r.status);
    state.flow = await r.json();
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

async function refresh() {
  try {
    await loadStats();
    state.journeys = null; // range/bots may have changed — reload on demand
    state.flow = null;
    if (state.view === "realtime") await loadRealtime();
    renderView();
  } catch (e) { /* keep current */ }
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
      await refresh();
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
    const link = e.target.closest("[data-view]");
    if (link) return setView(link.getAttribute("data-view"));
    if (e.target.closest("#logoutBtn")) {
      fetch(LOGOUT, { method: "POST", credentials: "include" }).finally(showLogin);
    }
  });
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
    document.getElementById("app").classList.toggle("nav-open");
  });
  document.getElementById("view").addEventListener("click", (e) => {
    const m = e.target.closest("[data-m]");
    if (m) { state.trendMetric = m.getAttribute("data-m"); renderView(); return; }
    const jt = e.target.closest("[data-jtoggle]");
    if (jt) { jt.closest(".journey").classList.toggle("open"); return; }
    const jf = e.target.closest("[data-jfilter]");
    if (jf) {
      state.journeyFilter = jf.getAttribute("data-jfilter");
      document.getElementById("view").innerHTML = viewJourneys();
      return;
    }
    const fg = e.target.closest("[data-flowgo]");
    if (fg) {
      state.flowPage = fg.getAttribute("data-flowgo");
      document.getElementById("view").innerHTML = viewFlow();
      window.scrollTo(0, 0);
      return;
    }
  });
  document.getElementById("view").addEventListener("change", (e) => {
    const fs = e.target.closest("[data-flowsel]");
    if (fs) {
      state.flowPage = fs.value;
      document.getElementById("view").innerHTML = viewFlow();
    }
  });
}

async function boot() {
  wire();
  renderRangeSeg();
  // Try existing session; if valid, go straight to the dashboard.
  try {
    const ok = await loadStats();
    if (ok) {
      showApp();
      renderSidebar();
      renderView();
    }
  } catch (e) {
    showLogin();
  }
}

boot();
