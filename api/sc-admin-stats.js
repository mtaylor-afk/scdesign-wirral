/**
 * SC Design Wirral — admin stats API.
 *
 * Requires a valid admin session. Pulls events from Supabase for the requested
 * range (plus the preceding period for % comparisons) and aggregates everything
 * the admin dashboard needs in a single JSON bundle. Bots are excluded by
 * default (?bots=include to keep them). ?report=realtime returns a light
 * last-30-minutes view.
 */

const {
  applyCors,
  requireSession,
  sbSelectEvents,
  sbSelectEnquiriesSince,
  sbProbeTable,
  sbProbeStorage,
  sbLastTimestamp,
} = require("../serverlib/common");
const github = require("../serverlib/github");

const RANGES = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

const SESSION_GAP = 30 * 60 * 1000;

// ---- small helpers --------------------------------------------------------

function t(row) {
  return new Date(row.ts).getTime();
}
function durMs(row) {
  const d = row.props && row.props.dur;
  return Number.isFinite(d) ? d : 0;
}
function vidOf(row) {
  return (row.props && row.props.vid) || "anon";
}

function countBy(rows, keyFn, limit) {
  const map = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (k === null || k === undefined || k === "") continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  const arr = [...map.entries()].map(([key, count]) => ({ key, count }));
  arr.sort((a, b) => b.count - a.count);
  return limit ? arr.slice(0, limit) : arr;
}

function distinct(rows, keyFn) {
  const s = new Set();
  for (const r of rows) s.add(keyFn(r));
  return s.size;
}

/** A single reading can never be longer than a session — a tab left open all day is
 *  not six hours of reading. The journeys report already clamps this way (see
 *  closeStep below); coreMetrics used not to, which is how one abandoned tab could
 *  move the headline "Avg. visit". */
function clampMs(ms) {
  return ms > SESSION_GAP ? SESSION_GAP : ms < 0 ? 0 : ms;
}

/**
 * Group pageviews into visits, and — when given the "engaged" beacons — attribute
 * time to them.
 *
 * `engagedRows` is optional and is the ONLY source of time-on-page: a pageview beacon
 * has never carried a duration, so a session built from pageviews alone can only ever
 * measure the gap between the first and last page and knows nothing about the time
 * spent on the final one.
 *
 * The engaged rows deliberately do NOT become pages. Every bounced visit emits exactly
 * one of them, so counting them as pageviews would make `pages === 2` for every bounce
 * — collapsing bounce rate towards zero and inflating pages-per-visit. They only ever
 * add to the two duration accumulators.
 */
function buildSessions(pageviews, engagedRows) {
  const byVid = new Map();
  for (const r of pageviews) {
    const v = vidOf(r);
    if (!byVid.has(v)) byVid.set(v, []);
    byVid.get(v).push(r);
  }
  const sessions = [];
  const byVidSessions = new Map();
  for (const [v, evs] of byVid.entries()) {
    evs.sort((a, b) => t(a) - t(b));
    const mine = [];
    let cur = null;
    for (const e of evs) {
      const tt = t(e);
      if (!cur || tt - cur.lastT > SESSION_GAP) {
        if (cur) { sessions.push(cur); mine.push(cur); }
        cur = { entry: e.path, exit: e.path, pages: 1, startT: tt, lastT: tt, engagedSum: 0, lastEngaged: 0 };
      } else {
        cur.pages += 1;
        cur.exit = e.path;
        cur.lastT = tt;
      }
    }
    if (cur) { sessions.push(cur); mine.push(cur); }
    byVidSessions.set(v, mine);
  }

  for (const e of engagedRows || []) {
    const mine = byVidSessions.get(vidOf(e));
    if (!mine || !mine.length) continue;
    const tt = t(e);
    const d = clampMs(durMs(e));
    if (!d) continue;
    // Sessions are in ascending order: the beacon belongs to the last one that had
    // already begun when it fired.
    let target = null;
    for (const s of mine) {
      if (s.startT <= tt + 1000) target = s;
      else break;
    }
    if (!target || tt > target.lastT + SESSION_GAP) continue;
    target.engagedSum += d;
    // A beacon at or after the final pageview is that last page being left, which is
    // the one stretch of time the pageview timestamps cannot see.
    if (tt >= target.lastT && d > target.lastEngaged) target.lastEngaged = d;
  }
  return sessions;
}

/**
 * One visit's length in seconds.
 *
 * Multi-page: the gap between the first and last pageview, plus the measured time on
 * the last page. Single-page: there is no gap to measure, so it is entirely the one
 * engaged beacon — which is why a bounced visit used to count as zero seconds.
 *
 * No clamp on the total: a real visit across six pages can legitimately run past
 * half an hour. The clamp belongs on each individual reading (clampMs, applied as
 * the beacons are attributed), not on their sum.
 */
function sessionDurationS(s) {
  const ms = s.pages > 1 ? s.lastT - s.startT + (s.lastEngaged || 0) : s.engagedSum || 0;
  return Math.round(Math.max(0, ms) / 1000);
}

function coreMetrics(rows, sessionsIn) {
  const pv = rows.filter((r) => r.type === "pageview");
  // The internal measurement beacons are kept out of the event counts, but `engaged`
  // IS the only source of visit duration, so it has to reach buildSessions.
  const ev = rows.filter((r) => r.type === "event" && !INTERNAL_EVENTS.has(r.name));
  const engaged = dedupeEngaged(rows.filter((r) => r.type === "event" && r.name === "engaged"));
  const sessions = sessionsIn || buildSessions(pv, engaged);
  const bounces = sessions.filter((s) => s.pages === 1).length;
  const totalDur = sessions.reduce((a, s) => a + sessionDurationS(s), 0);
  const visitors = distinct(pv, vidOf);
  const count = (set) => ev.filter((e) => set.has(e.name)).length;
  const enquiries = count(ENQUIRY_EVENTS);
  const intents = count(INTENT_EVENTS);
  return {
    pageviews: pv.length,
    events: ev.length,
    visitors,
    sessions: sessions.length,
    bounceRate: sessions.length ? Math.round((bounces / sessions.length) * 100) : 0,
    avgDuration: sessions.length ? Math.round(totalDur / sessions.length) : 0,
    pagesPerVisit: sessions.length ? +(pv.length / sessions.length).toFixed(2) : 0,
    // An enquiry is a lead whose details reached us; an intent is somebody reaching
    // for the phone. Both are worth knowing and they are not the same thing, so
    // they are counted apart as well as together.
    enquiries,
    intents,
    engagementActions: count(ENGAGE_EVENTS),
    // Presses of a send button, including ones that failed validation or tripped the
    // honeypot — deliberately NOT counted as enquiries. See ENQUIRY_EVENTS.
    formAttempts: ev.filter((e) => e.name === "form_submit").length,
    enquiryRate: visitors ? +((enquiries / visitors) * 100).toFixed(1) : 0,
    conversions: enquiries + intents,
  };
}

function timeseries(pageviews, sinceMs, untilMs, byHour) {
  const step = byHour ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const buckets = new Map();
  // seed empty buckets so the chart has a continuous x-axis
  for (let s = sinceMs; s < untilMs; s += step) {
    const key = new Date(s).toISOString();
    buckets.set(bucketKey(key, byHour), { t: bucketKey(key, byHour), pageviews: 0, vids: new Set() });
  }
  for (const r of pageviews) {
    const key = bucketKey(r.ts, byHour);
    let b = buckets.get(key);
    if (!b) {
      b = { t: key, pageviews: 0, vids: new Set() };
      buckets.set(key, b);
    }
    b.pageviews += 1;
    b.vids.add(vidOf(r));
  }
  return [...buckets.values()]
    .sort((a, b) => (a.t < b.t ? -1 : 1))
    .map((b) => ({ t: b.t, pageviews: b.pageviews, visitors: b.vids.size }));
}

function bucketKey(iso, byHour) {
  // YYYY-MM-DD or YYYY-MM-DDTHH
  return byHour ? iso.slice(0, 13) : iso.slice(0, 10);
}

function dayOfWeekHist(pageviews) {
  const days = [0, 0, 0, 0, 0, 0, 0]; // Sun..Sat
  for (const r of pageviews) days[new Date(r.ts).getUTCDay()] += 1;
  return days;
}
function hourHist(pageviews) {
  const hours = new Array(24).fill(0);
  for (const r of pageviews) hours[new Date(r.ts).getUTCHours()] += 1;
  return hours;
}

function pageStats(pageviews, engaged) {
  // Per-page average time comes from the "engaged" beacons (ms), keyed by path.
  const durByPath = new Map();
  for (const e of engaged) {
    const p = e.path || "/";
    const d = durMs(e);
    if (d > 0) {
      if (!durByPath.has(p)) durByPath.set(p, []);
      durByPath.get(p).push(d);
    }
  }
  const map = new Map();
  for (const r of pageviews) {
    const p = r.path || "/";
    if (!map.has(p)) map.set(p, { path: p, views: 0, vids: new Set() });
    const m = map.get(p);
    m.views += 1;
    m.vids.add(vidOf(r));
  }
  const arr = [...map.values()].map((m) => {
    const durs = durByPath.get(m.path) || [];
    return {
      path: m.path,
      views: m.views,
      visitors: m.vids.size,
      avgTime: durs.length
        ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length / 1000)
        : 0,
    };
  });
  arr.sort((a, b) => b.views - a.views);
  return arr.slice(0, 50);
}

function bucketDist(values, edges, labels) {
  const counts = new Array(labels.length).fill(0);
  for (const v of values) {
    let placed = false;
    for (let i = 0; i < edges.length; i++) {
      if (v <= edges[i]) {
        counts[i] += 1;
        placed = true;
        break;
      }
    }
    if (!placed) counts[counts.length - 1] += 1;
  }
  return labels.map((label, i) => ({ key: label, count: counts[i] }));
}

function screenLabel(r) {
  const w = r.props && r.props.sw;
  const h = r.props && r.props.sh;
  return w && h ? `${w}×${h}` : "";
}

function scrollOf(row) {
  const s = row.props && row.props.scroll;
  return Number.isFinite(s) ? s : 0;
}

// ---- what counts as what --------------------------------------------------

/**
 * Props the COLLECTOR writes itself, which therefore say nothing about the event.
 *
 * Mirrors the server-derived block in api/sc-analytics-collect.js. Kept as a list
 * here so the prop breakdowns below don't offer you a "breakdown of visitor id" with
 * one row per visitor, and don't leak the visitor hash into a chart.
 */
const SERVER_PROPS = new Set([
  "vid", "ref", "channel", "title", "sw", "sh", "vw", "vh", "dpr", "lang", "tz",
  "region", "city", "bv", "osv", "bot", "dur", "scroll", "utm", "pvid",
]);

/**
 * Internal measurements, not things a person did. Excluded from every event count
 * and from the events table, exactly as `engaged` always has been — each of these
 * fires automatically once (or more) per page view, so counting them would swamp
 * the real actions.
 */
const INTERNAL_EVENTS = new Set(["engaged", "vitals", "cta_view"]);

/**
 * A real enquiry: somebody's details actually reached us.
 *
 * NOT `form_submit`. That one comes from a document-level capture listener in
 * ClickTracking.tsx which runs BEFORE the form's own validation, so it also fires
 * for a submission that failed validation and never sent, and for a spam bot that
 * tripped the honeypot. It stays in the events table (it is a genuine record of
 * "somebody pressed send") but it is not a lead.
 */
const ENQUIRY_EVENTS = new Set(["contact_form_success", "visualiser_handoff_submitted"]);

/** Somebody reaching for the phone. A lead signal, but not a captured enquiry. */
const INTENT_EVENTS = new Set(["phone_click", "email_click", "whatsapp_click"]);

/** Interest, short of making contact. `visualiser_start` lives here, not in leads. */
const ENGAGE_EVENTS = new Set([
  "cta_click", "service_click", "location_click", "google_review_click", "outbound_link",
  "visualiser_start", "visualiser_complete", "visualiser_download", "visualiser_refine",
  "visualiser_estimate_shown", "cost_estimate_handoff_clicked", "reviews_carousel",
]);

function campaignKey(utm) {
  if (!utm) return "";
  return `${utm.source || "(none)"} / ${utm.medium || "(none)"} / ${utm.campaign || "(none)"}`;
}

/**
 * Collapse repeated "engaged" beacons for the same page view.
 *
 * The tracker can now report engagement more than once for one page — it sends what
 * it has when the tab is hidden, and again with the cumulative total if the visitor
 * comes back and carries on reading. Each beacon carries a `pvid` identifying the
 * page view it belongs to, and the LATER one supersedes the earlier: its `dur` is a
 * running total, so adding them would count the first stretch twice and report a
 * six-minute read as nine.
 *
 * Beacons with no `pvid` pass through untouched. That is every row written before
 * this shipped, and it keeps their behaviour bit-for-bit identical.
 */
function dedupeEngaged(rows) {
  const best = new Map();
  const plain = [];
  for (const r of rows) {
    const pv = r.props && r.props.pvid;
    if (!pv) {
      plain.push(r);
      continue;
    }
    const d = durMs(r);
    const s = scrollOf(r);
    const cur = best.get(pv);
    if (!cur) {
      best.set(pv, { row: r, dur: d, scroll: s });
      continue;
    }
    // Longest reading wins outright, and scroll is a high-water mark either way.
    if (d > cur.dur) {
      cur.row = r;
      cur.dur = d;
    }
    if (s > cur.scroll) cur.scroll = s;
  }
  const merged = [];
  for (const b of best.values()) {
    if (b.dur === durMs(b.row) && b.scroll === scrollOf(b.row)) merged.push(b.row);
    else
      merged.push(
        Object.assign({}, b.row, {
          props: Object.assign({}, b.row.props, { dur: b.dur, scroll: b.scroll }),
        })
      );
  }
  // Timestamp order is load-bearing: buildSessions attributes a beacon to the
  // session that had already begun when it fired.
  return plain.concat(merged).sort((a, b) => t(a) - t(b));
}

/**
 * Where each visitor actually came from, taken from their FIRST page view.
 *
 * This exists because `track()` does not send a referrer, so the collector sees none
 * and every EVENT row is stamped `channel: "direct"`. Attributing a conversion to
 * its own row's channel would therefore report every single lead as direct traffic.
 * The visitor's first page view is the only row that knows the truth.
 */
function attribution(pageviews) {
  const first = new Map();
  for (const r of pageviews) {
    const v = vidOf(r);
    const tt = t(r);
    const prev = first.get(v);
    if (!prev || tt < prev.tt) first.set(v, { tt, row: r });
  }
  const out = new Map();
  for (const [v, f] of first.entries()) {
    const p = f.row.props || {};
    out.set(v, {
      channel: p.channel || "direct",
      referrerHost: f.row.referrer_host || "",
      campaign: campaignKey(p.utm),
      utm: p.utm || null,
      entry: f.row.path || "/",
      device: f.row.device || "",
      country: f.row.country || "",
      firstTs: f.row.ts,
    });
  }
  return out;
}

/**
 * Break every event down by the values of its own props.
 *
 * The props have been collected since June and were thrown away at this step: the
 * aggregator grouped events by name and by page and nothing else. `contact_form_
 * success.mode` alone is a per-submission record of whether the email chain worked,
 * which is the thing nobody could see while six leads went unanswered.
 *
 * Bounded deliberately: six prop keys per event, twelve values per key, and the
 * distinct count kept so the page can say how much it is not showing.
 */
function propBreakdowns(events) {
  const byName = new Map();
  for (const e of events) {
    const p = e.props;
    if (!p) continue;
    let keys = byName.get(e.name);
    if (!keys) {
      keys = new Map();
      byName.set(e.name, keys);
    }
    for (const k of Object.keys(p)) {
      if (SERVER_PROPS.has(k)) continue;
      const v = p[k];
      if (v === null || v === undefined || v === "" || typeof v === "object") continue;
      let vals = keys.get(k);
      if (!vals) {
        vals = new Map();
        keys.set(k, vals);
      }
      const s = String(v).slice(0, 160);
      vals.set(s, (vals.get(s) || 0) + 1);
    }
  }
  const out = {};
  for (const [name, keys] of byName.entries()) {
    const ranked = [...keys.entries()].map(([k, vals]) => {
      let total = 0;
      for (const n of vals.values()) total += n;
      return { k, vals, total };
    });
    ranked.sort((a, b) => b.total - a.total);
    const entry = {};
    for (const { k, vals, total } of ranked.slice(0, 6)) {
      const items = [...vals.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count);
      entry[k] = { total, distinct: items.length, items: items.slice(0, 12) };
    }
    if (Object.keys(entry).length) out[name] = entry;
  }
  return out;
}

// ---- content, sources, speed, quality ------------------------------------

/** The site's own shape. Order matters — the first match wins. */
const CONTENT_GROUPS = [
  { key: "home", label: "Home", re: /^\/$/ },
  { key: "services", label: "Services", re: /^\/services(\/|$)/ },
  { key: "areas", label: "Areas covered", re: /^\/areas(\/|$)/ },
  { key: "projects", label: "Case studies", re: /^\/(projects|portfolio)(\/|$)/ },
  { key: "guides", label: "Guides & advice", re: /^\/(guides|homeowners-guide|faqs|process)(\/|$)/ },
  { key: "visualiser", label: "Visualiser", re: /^\/(visualiser|cost-estimate)/ },
  { key: "contact", label: "Contact", re: /^\/contact/ },
  { key: "about", label: "About & reviews", re: /^\/(about|reviews|socials)(\/|$)/ },
  { key: "legal", label: "Legal", re: /^\/(privacy-policy|cookie-policy|visualiser-terms)(\/|$)/ },
];

function groupOf(path) {
  for (const g of CONTENT_GROUPS) if (g.re.test(path)) return g;
  return { key: "other", label: "Other pages" };
}

/**
 * Do the 42 case studies and 20 area pages earn their keep?
 *
 * Grouped server-side and over EVERY page view, not over the top-50 `pages` list the
 * bundle already carries — the site has 78 URLs, so a client-side grouping of that
 * list would quietly omit the long tail, which is exactly the part being judged.
 */
function contentGroups(pageviews, engaged, leadVids) {
  const durByPath = new Map();
  const scrollByPath = new Map();
  for (const e of engaged) {
    const p = e.path || "/";
    const d = durMs(e);
    if (d > 0) {
      if (!durByPath.has(p)) durByPath.set(p, []);
      durByPath.get(p).push(d);
    }
    const s = scrollOf(e);
    if (s > 0) {
      if (!scrollByPath.has(p)) scrollByPath.set(p, []);
      scrollByPath.get(p).push(s);
    }
  }
  const mean = (a) => (a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

  const groups = new Map();
  const G = (g) => {
    if (!groups.has(g.key))
      groups.set(g.key, {
        key: g.key, label: g.label, views: 0, vids: new Set(),
        pageMap: new Map(), durs: [], scrolls: [],
      });
    return groups.get(g.key);
  };
  for (const r of pageviews) {
    const path = r.path || "/";
    const g = G(groupOf(path));
    g.views += 1;
    g.vids.add(vidOf(r));
    g.pageMap.set(path, (g.pageMap.get(path) || 0) + 1);
    const ds = durByPath.get(path);
    if (ds) g.durs.push(mean(ds));
    const ss = scrollByPath.get(path);
    if (ss) g.scrolls.push(mean(ss));
  }

  // "Leads" = visitors who READ this section and then enquired, counted once each.
  //
  // Not the page the form was sent from: that is always the contact page, so it
  // would credit Contact with every lead on the site and Case studies with none —
  // which answers nothing about whether the case studies earn their keep. One
  // enquiry is credited to every section that visitor read, so the column is "part
  // of how N leads decided", and it deliberately does not sum to the lead total.
  const leadsOf = (g) => {
    let n = 0;
    for (const v of g.vids) if (leadVids.has(v)) n += 1;
    return n;
  };

  return [...groups.values()]
    .map((g) => ({
      key: g.key,
      label: g.label,
      views: g.views,
      visitors: g.vids.size,
      pages: [...g.pageMap.entries()]
        .map(([path, views]) => ({ path, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 12),
      pageCount: g.pageMap.size,
      avgTime: Math.round(mean(g.durs) / 1000),
      avgScroll: Math.round(mean(g.scrolls)),
      leads: leadsOf(g),
      leadRate: g.vids.size ? +((leadsOf(g) / g.vids.size) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.views - a.views);
}

/**
 * Visitors, leads and lead rate for one way of slicing the audience.
 *
 * `keyOf` turns a vid's attribution into a bucket name. Conversions are counted
 * against the visitor's bucket, never the event row's own — see attribution().
 */
function sourcePerformance(attrib, pvByVid, leadVids, intentVids, keyOf, limit) {
  const rows = new Map();
  const R = (k) => {
    if (!rows.has(k)) rows.set(k, { key: k, visitors: 0, pageviews: 0, enquiries: 0, intents: 0 });
    return rows.get(k);
  };
  for (const [vid, a] of attrib.entries()) {
    const k = keyOf(a);
    if (k === null || k === undefined || k === "") continue;
    const r = R(k);
    r.visitors += 1;
    r.pageviews += pvByVid.get(vid) || 0;
    if (leadVids.has(vid)) r.enquiries += 1;
    if (intentVids.has(vid)) r.intents += 1;
  }
  const out = [...rows.values()].map((r) =>
    Object.assign(r, {
      rate: r.visitors ? +((r.enquiries / r.visitors) * 100).toFixed(1) : 0,
    })
  );
  out.sort((a, b) => b.enquiries - a.enquiries || b.visitors - a.visitors);
  return limit ? out.slice(0, limit) : out;
}

/** 75th percentile — the figure Core Web Vitals is scored on, not the average. */
function p75(arr) {
  if (!arr || !arr.length) return null;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.75))];
}

const VITAL_KEYS = ["lcp", "cls", "inp", "ttfb"];

function vitalsSummary(rows) {
  const pick = (list, k) =>
    list.map((r) => (r.props ? r.props[k] : null)).filter((v) => Number.isFinite(v));
  const overall = {};
  for (const k of VITAL_KEYS) {
    const vals = pick(rows, k);
    overall[k] = { p75: p75(vals), samples: vals.length };
  }
  const devices = {};
  for (const r of rows) {
    const d = r.device || "unknown";
    (devices[d] = devices[d] || []).push(r);
  }
  const byDevice = Object.keys(devices).map((d) => {
    const entry = { device: d, samples: devices[d].length };
    for (const k of VITAL_KEYS) entry[k] = p75(pick(devices[d], k));
    return entry;
  });
  const byPath = new Map();
  for (const r of rows) {
    const p = r.path || "/";
    if (!byPath.has(p)) byPath.set(p, []);
    byPath.get(p).push(r);
  }
  const pages = [...byPath.entries()]
    .map(([path, list]) => {
      const entry = { path, samples: list.length };
      for (const k of VITAL_KEYS) entry[k] = p75(pick(list, k));
      return entry;
    })
    .sort((a, b) => b.samples - a.samples)
    .slice(0, 25);
  return { overall, byDevice, pages, samples: rows.length };
}

/**
 * How much of this traffic is plausibly a person?
 *
 * The bot filter is a user-agent regex, and a growing share of automated traffic
 * does not announce itself. A visit of one page with no measured time and no scroll
 * is not proof of a crawler — it is also what a real person who left immediately
 * looks like — so this is reported as an open question, never subtracted from the
 * headline figures.
 */
function trafficQuality(sessions) {
  const unverified = sessions.filter((s) => s.pages === 1 && !s.engagedSum).length;
  return {
    sessions: sessions.length,
    unverified,
    pct: sessions.length ? Math.round((unverified / sessions.length) * 100) : 0,
  };
}

// ---- journeys -------------------------------------------------------------

const JOURNEY_CONV = new Set([
  "phone_click", "email_click", "whatsapp_click", "form_submit",
  "visualiser_start", "visualiser_complete", "cta_click",
]);

/** Actions that mean a form actually went through — used to tie a journey to a
 *  saved enquiry when the row predates visitor stamping. */
const FORM_ACTIONS = new Set([
  "contact_form_success", "visualiser_handoff_submitted", "form_submit",
]);

const SESSION_GAP_S = SESSION_GAP / 1000;
const MAX_STEPS = 60;

/**
 * One visitor's ordered timeline, from their raw rows.
 *
 * Extracted from the `report=journeys` branch unchanged so the source drill-down can
 * build the same objects rather than growing a second, subtly different notion of
 * what a journey is.
 *
 * A journey = one cookieless visitor (vid) within the range. The visitor hash
 * re-salts every UTC day, so in practice that is one visitor on one day — there is
 * no cross-day tracking, by design.
 */
function buildJourneys(jrows) {
  const byVid = new Map();
  for (const r of jrows) {
    const v = vidOf(r);
    if (!byVid.has(v)) byVid.set(v, []);
    byVid.get(v).push(r);
  }

  // Close out the current step, choosing the most accurate time-on-page:
  // navigation delta to the next pageview within a session, otherwise the
  // measured "engaged" duration (last page of a session / end of data).
  function closeStep(cur, steps, nextTs, endedSession) {
    let tp;
    if (!endedSession && nextTs != null) tp = Math.round((nextTs - cur.startTs) / 1000);
    else tp = Math.round((cur.engagedDur || 0) / 1000);
    if (!Number.isFinite(tp) || tp < 0) tp = 0;
    if (tp > SESSION_GAP_S) tp = SESSION_GAP_S; // guard against tab-left-open outliers
    cur.timeOnPage = tp;
    delete cur.startTs;
    delete cur.engagedDur;
    steps.push(cur);
  }

  const journeys = [];
  for (const [vid, evs] of byVid.entries()) {
    evs.sort((a, b) => t(a) - t(b));
    const steps = [];
    let cur = null;
    let prevPvTs = null;
    let sessionCount = 0;

    for (const e of evs) {
      const tt = t(e);
      if (e.type === "pageview") {
        const newSession = prevPvTs === null || tt - prevPvTs > SESSION_GAP;
        if (newSession) sessionCount++;
        if (cur) closeStep(cur, steps, tt, newSession);
        cur = {
          path: e.path || "/",
          title: (e.props && e.props.title) || "",
          ts: e.ts,
          startTs: tt,
          engagedDur: 0,
          scroll: 0,
          newSession,
          actions: [],
        };
        prevPvTs = tt;
      } else if (e.type === "event" && e.name === "engaged") {
        if (cur) {
          const d = durMs(e);
          if (d > cur.engagedDur) cur.engagedDur = d;
          const sc = scrollOf(e);
          if (sc > cur.scroll) cur.scroll = sc;
        }
      } else if (e.type === "event" && INTERNAL_EVENTS.has(e.name)) {
        // A measurement, not something the visitor did — it belongs on the page's
        // numbers (handled above for `engaged`), never in the visible timeline.
      } else if (e.type === "event") {
        const act = { name: e.name, ts: e.ts, props: e.props || {} };
        if (cur) cur.actions.push(act);
        else {
          cur = {
            path: e.path || "/",
            title: "",
            ts: e.ts,
            startTs: tt,
            engagedDur: 0,
            scroll: 0,
            newSession: true,
            actions: [act],
          };
        }
      }
    }
    if (cur) closeStep(cur, steps, null, true);

    const pvCount = evs.filter((r) => r.type === "pageview").length;
    const pv0 = evs.find((r) => r.type === "pageview") || evs[0] || {};
    const allActions = steps.reduce((a, s) => a + s.actions.length, 0);
    const converted = steps.some((s) => s.actions.some((a) => JOURNEY_CONV.has(a.name)));
    const totalTime = steps.reduce((a, s) => a + s.timeOnPage, 0);

    // What KIND of outcome, and when. The drill-down needs this to label a journey
    // and to find the enquiry that belongs to it.
    const acts = steps.reduce((a, s) => a.concat(s.actions), []);
    const formTs = acts
      .filter((a) => FORM_ACTIONS.has(a.name))
      .map((a) => new Date(a.ts).getTime())
      .filter((n) => Number.isFinite(n));
    const outcome = {
      enquiry: acts.some((a) => ENQUIRY_EVENTS.has(a.name)),
      intent: acts.some((a) => INTENT_EVENTS.has(a.name)),
      visualiser: acts.some((a) => /^visualiser/.test(a.name)),
      attempted: acts.some((a) => a.name === "form_submit"),
    };

    journeys.push({
      vid,
      firstTs: evs[0].ts,
      lastTs: evs[evs.length - 1].ts,
      date: (evs[0].ts || "").slice(0, 10),
      durationS: totalTime,
      pages: pvCount,
      sessions: sessionCount || (steps.length ? 1 : 0),
      actionsCount: allActions,
      converted,
      outcome,
      formTs,
      entry: steps.length ? steps[0].path : pv0.path || "/",
      exit: steps.length ? steps[steps.length - 1].path : "",
      device: pv0.device || "",
      browser: pv0.browser || "",
      bv: (pv0.props && pv0.props.bv) || "",
      os: pv0.os || "",
      country: pv0.country || "",
      region: (pv0.props && pv0.props.region) || "",
      city: (pv0.props && pv0.props.city) || "",
      channel: (pv0.props && pv0.props.channel) || "direct",
      referrerHost: pv0.referrer_host || "",
      utm: (pv0.props && pv0.props.utm) || null,
      steps: steps.slice(0, MAX_STEPS),
      stepsTruncated: steps.length > MAX_STEPS,
    });
  }

  journeys.sort((a, b) => new Date(b.lastTs).getTime() - new Date(a.lastTs).getTime());
  return journeys;
}

function journeySummary(journeys) {
  return {
    visitors: journeys.length,
    converters: journeys.filter((j) => j.converted).length,
    multiPage: journeys.filter((j) => j.pages >= 2).length,
    avgPages: journeys.length
      ? +(journeys.reduce((a, j) => a + j.pages, 0) / journeys.length).toFixed(1)
      : 0,
    avgDuration: journeys.length
      ? Math.round(journeys.reduce((a, j) => a + j.durationS, 0) / journeys.length)
      : 0,
    totalActions: journeys.reduce((a, j) => a + j.actionsCount, 0),
  };
}

// ---- tying journeys to saved enquiries ------------------------------------

function srcMatches(j, kind, value) {
  if (kind === "all") return true;
  if (kind === "channel") return (j.channel || "direct") === value;
  if (kind === "referrer") return (j.referrerHost || "") === value;
  if (kind === "campaign") return campaignKey(j.utm) === value;
  if (kind === "entry") return (j.entry || "") === value;
  return false;
}

/**
 * Put the saved enquiry next to the visit that produced it.
 *
 * Two passes, and the difference between them is stated on screen rather than
 * quietly averaged away:
 *
 *  1. STAMPED. Enquiries saved from now on carry the same cookieless visitor hash
 *     the analytics uses, so the join is exact and there is nothing to guess.
 *  2. HISTORY. Every row written before that carries no visitor id, so the only
 *     evidence is the clock — the journey's own send event and the saved row are the
 *     same interaction if they are minutes apart. Reported as "likely", never as
 *     fact, because on a busy day two visitors could genuinely overlap.
 */
function attachEnquiries(journeys, enquiries) {
  const byVid = new Map();
  for (const e of enquiries) {
    const v = e.meta && e.meta.vid;
    if (!v) continue;
    if (!byVid.has(v)) byVid.set(v, []);
    byVid.get(v).push(e);
  }
  const claimed = new Set();
  for (const j of journeys) {
    const mine = byVid.get(j.vid) || [];
    j.enquiries = mine.map((row) => ({ row, confidence: "confirmed" }));
    for (const e of mine) claimed.add(e.id);
  }
  const legacy = enquiries.filter((e) => !(e.meta && e.meta.vid) && !claimed.has(e.id));
  if (legacy.length) {
    const NEAR = 5 * 60 * 1000;
    for (const j of journeys) {
      if (!j.formTs || !j.formTs.length) continue;
      for (const e of legacy) {
        const et = new Date(e.created_at).getTime();
        if (!Number.isFinite(et)) continue;
        if (j.formTs.some((ts) => Math.abs(et - ts) <= NEAR))
          j.enquiries.push({ row: e, confidence: "likely" });
      }
    }
  }
  return journeys;
}

/** Everything the visualiser recorded during one visit, in order. */
function visualiserDetail(j) {
  const acts = [];
  for (const s of j.steps || []) {
    for (const a of s.actions || []) {
      if (/^(visualiser|cost_estimate)/.test(a.name)) acts.push(Object.assign({ path: s.path }, a));
    }
  }
  if (!acts.length) return null;
  acts.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  const counts = {};
  for (const a of acts) counts[a.name] = (counts[a.name] || 0) + 1;
  return {
    steps: acts,
    counts,
    started: !!counts.visualiser_start,
    refined: !!counts.visualiser_refine,
    completed: !!counts.visualiser_complete,
    downloaded: !!counts.visualiser_download,
    handedOff: !!counts.visualiser_handoff_submitted,
    errored: !!counts.visualiser_error,
  };
}

// ---- delivery check (the reconciliation) ----------------------------------

const THANKYOU_PATHS = new Set(["/contact/thank-you", "/contact/thank-you/"]);

/**
 * Four independent records of the same submission, lined up day by day.
 *
 * A contact submission leaves the tracker's `contact_form_submitted`, its
 * `contact_form_success` with the route that actually worked, a row in
 * `sc_enquiries`, and a view of the thank-you page. Nothing compared them, so
 * between July and September 2026 the main email route failed and the only trace was
 * a line in a log nobody reads. Comparing them costs one extra query.
 */
function deliveryReport(rows, enquiries, sinceMs) {
  const day = (iso) => String(iso || "").slice(0, 10);
  const days = new Map();
  const D = (k) => {
    if (!days.has(k))
      days.set(k, {
        day: k, submitted: 0, attempts: 0, validationErrors: 0,
        online: 0, backup: 0, mailto: 0, handoffs: 0,
        savedContact: 0, savedOther: 0, thankYou: 0,
      });
    return days.get(k);
  };

  for (const r of rows) {
    if (t(r) < sinceMs) continue;
    const k = day(r.ts);
    if (r.type === "pageview") {
      if (THANKYOU_PATHS.has(r.path || "")) D(k).thankYou += 1;
      continue;
    }
    const n = r.name;
    const mode = (r.props && r.props.mode) || "";
    if (n === "contact_form_submitted") D(k).submitted += 1;
    else if (n === "form_submit") D(k).attempts += 1;
    else if (n === "contact_form_validation_error") D(k).validationErrors += 1;
    else if (n === "contact_form_success" || n === "visualiser_handoff_submitted") {
      if (n === "visualiser_handoff_submitted") D(k).handoffs += 1;
      if (mode === "online") D(k).online += 1;
      else if (mode === "backup_email") D(k).backup += 1;
      else D(k).mailto += 1;
    }
  }
  for (const e of enquiries) {
    const k = day(e.created_at);
    if ((e.form || "contact") === "contact") D(k).savedContact += 1;
    else D(k).savedOther += 1;
  }

  const list = [...days.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const sum = (f) => list.reduce((a, d) => a + f(d), 0);
  const totals = {
    submitted: sum((d) => d.submitted),
    attempts: sum((d) => d.attempts),
    validationErrors: sum((d) => d.validationErrors),
    online: sum((d) => d.online),
    backup: sum((d) => d.backup),
    mailto: sum((d) => d.mailto),
    handoffs: sum((d) => d.handoffs),
    saved: sum((d) => d.savedContact + d.savedOther),
    savedContact: sum((d) => d.savedContact),
    savedOther: sum((d) => d.savedOther),
    thankYou: sum((d) => d.thankYou),
  };
  const sent = totals.online + totals.backup + totals.mailto;
  totals.sent = sent;
  totals.mainRouteRate = sent ? Math.round((totals.online / sent) * 100) : null;

  const problems = [];
  const lostDays = list.filter((d) => d.submitted > d.savedContact);
  if (lostDays.length) {
    const n = lostDays.reduce((a, d) => a + (d.submitted - d.savedContact), 0);
    problems.push({
      severity: "bad",
      text: `${n} contact ${n === 1 ? "submission" : "submissions"} left no saved record at all — the database write itself failed.`,
      days: lostDays.map((d) => d.day),
    });
  }
  const fallbackDays = list.filter((d) => d.backup + d.mailto > 0);
  if (fallbackDays.length) {
    const n = fallbackDays.reduce((a, d) => a + d.backup + d.mailto, 0);
    problems.push({
      severity: "warn",
      text: `The main email route failed for ${n} ${n === 1 ? "enquiry" : "enquiries"} and a fallback had to be used.`,
      days: fallbackDays.map((d) => d.day),
    });
  }
  const mailtoDays = list.filter((d) => d.mailto > 0);
  if (mailtoDays.length) {
    const n = mailtoDays.reduce((a, d) => a + d.mailto, 0);
    problems.push({
      severity: "bad",
      text: `${n} ${n === 1 ? "enquiry" : "enquiries"} sent no notification from the server at all — the visitor was handed their own email app, and may never have pressed send.`,
      days: mailtoDays.map((d) => d.day),
    });
  }
  // The reverse gap is informative rather than alarming: a saved enquiry with no
  // analytics event means the tracker was blocked in that browser, not that
  // anything was lost.
  const untrackedDays = list.filter((d) => d.savedContact > d.submitted);
  if (untrackedDays.length) {
    const n = untrackedDays.reduce((a, d) => a + (d.savedContact - d.submitted), 0);
    problems.push({
      severity: "info",
      text: `${n} saved ${n === 1 ? "enquiry" : "enquiries"} had no matching analytics event — usually an ad-blocker or JavaScript turned off. The enquiry itself is safe.`,
      days: untrackedDays.map((d) => d.day),
    });
  }

  const good = list.filter((d) => d.online > 0);
  return {
    days: list,
    totals,
    problems,
    lastMainRouteSuccess: good.length ? good[good.length - 1].day : null,
    firstFallback: fallbackDays.length ? fallbackDays[0].day : null,
  };
}

// ---- health report --------------------------------------------------------

/** Every setting the site reads, grouped by what stops working without it. */
const HEALTH_ENV_KEYS = [
  "SMTP_USER", "SMTP_PASS", "SC_MAIL_FROM", "SC_LEAD_TO", "SC_LEAD_CC", "SC_LEAD_RECIPIENTS",
  "SC_SUPABASE_URL", "SC_SUPABASE_SERVICE_ROLE_KEY",
  "SC_ADMIN_USER", "SC_ADMIN_PASS", "SC_ADMIN_SESSION_SECRET",
  "SC_GITHUB_TOKEN", "SC_GITHUB_REPO", "SC_GITHUB_BRANCH", "SC_PROJECT_MEDIA_BUCKET",
];

const HEALTH_TABLES = ["sc_events", "sc_errors", "sc_enquiries", "sc_projects"];

/**
 * What is configured, and what silently isn't.
 *
 * This exists because between July and September 2026 six real enquiries were
 * saved and nobody was emailed, and nothing anywhere said so — the setting that
 * caused it was simply absent, and absence has no error message. Everything here
 * is a question the server can answer about itself.
 *
 * BOOLEANS ONLY for every secret. A value must never enter this payload: it is
 * rendered in a browser by whoever is signed in to the admin. The two strings that
 * do appear — the repo slug and the bucket name — are not secrets (the repository
 * is public), and naming them is the difference between "misconfigured" and
 * "pointing at the wrong place".
 */
async function healthReport(now) {
  const env = {};
  for (const k of HEALTH_ENV_KEYS) {
    const v = process.env[k];
    env[k] = !!(v && String(v).trim());
  }

  const tables = {};
  await Promise.all(
    HEALTH_TABLES.map(async (name) => {
      tables[name] = await sbProbeTable(name);
    })
  );

  const storage = await sbProbeStorage();

  // Publishing. isConfigured() is local, but a token that is present can still be
  // expired or revoked — which looks identical from the settings alone — so when
  // one is set we actually ask GitHub a question.
  const gh = { configured: github.isConfigured(), repo: null, branch: null, reachable: false, error: null };
  if (gh.configured) {
    try {
      const info = github.repoInfo();
      gh.repo = `${info.owner}/${info.repo}`;
      gh.branch = info.branch;
      await github.readTextFile("package.json");
      gh.reachable = true;
    } catch (e) {
      gh.error = (e && e.code) || (e && e.message) || "unreachable";
    }
  }

  // "Is it configured" is only half the question. The other half — did it STOP — has
  // no error message either, and a site that quietly recorded nothing for a fortnight
  // looks exactly like a quiet fortnight. Four timestamps answer it.
  const [lastEvent, lastEnquiry, lastError, lastOnline] = await Promise.all([
    sbLastTimestamp("sc_events", "ts"),
    sbLastTimestamp("sc_enquiries", "created_at"),
    sbLastTimestamp("sc_errors", "ts"),
    sbLastTimestamp("sc_events", "ts", "&name=eq.contact_form_success&props->>mode=eq.online"),
  ]);
  const activity = {
    lastEvent: lastEvent.ts,
    lastEnquiry: lastEnquiry.ts,
    lastError: lastError.ts,
    lastMainRouteEmail: lastOnline.ts,
  };

  return {
    ok: true,
    report: "health",
    generatedAt: new Date(now).toISOString(),
    env,
    tables,
    storage,
    github: gh,
    activity,
  };
}

// ---- handler --------------------------------------------------------------

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  res.setHeader("Content-Type", "application/json");

  if (!requireSession(req)) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
  }

  const url = new URL(req.url, "http://x");
  const includeBots = url.searchParams.get("bots") === "include";
  const report = url.searchParams.get("report") || "full";
  const now = Date.now();

  // Deliberately ABOVE the Supabase guard: "the database is not configured" is one
  // of the things this report exists to tell you, and a 500 here would hide the
  // exact fault the page was opened to diagnose.
  if (report === "health") {
    try {
      return res.end(JSON.stringify(await healthReport(now)));
    } catch (err) {
      console.error("sc-admin-stats health error", err && err.message);
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "health_failed" }));
    }
  }

  if (!process.env.SC_SUPABASE_URL || !process.env.SC_SUPABASE_SERVICE_ROLE_KEY) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "Supabase not configured." }));
  }

  try {
    // ---- Real-time view (last 30 minutes) --------------------------------
    if (report === "realtime") {
      const sinceIso = new Date(now - 35 * 60 * 1000).toISOString();
      let rows = await sbSelectEvents(sinceIso, 20000);
      if (!includeBots) rows = rows.filter((r) => !(r.props && r.props.bot));
      const last5 = rows.filter((r) => t(r) >= now - 5 * 60 * 1000);
      const last30 = rows.filter((r) => t(r) >= now - 30 * 60 * 1000);
      const recent = rows
        .slice()
        .sort((a, b) => t(b) - t(a))
        .slice(0, 30)
        .map((r) => ({
          ts: r.ts,
          type: r.type,
          name: r.name,
          path: r.path,
          country: r.country,
          device: r.device,
          channel: r.props && r.props.channel,
        }));
      return res.end(
        JSON.stringify({
          ok: true,
          report: "realtime",
          visitorsLast5: distinct(last5.filter((r) => r.type === "pageview"), vidOf),
          visitorsLast30: distinct(last30.filter((r) => r.type === "pageview"), vidOf),
          activePages: countBy(
            last5.filter((r) => r.type === "pageview"),
            (r) => r.path,
            10
          ),
          recent,
        })
      );
    }

    // ---- Journeys (per-visitor timelines) --------------------------------
    // One "journey" = one cookieless visitor (vid) within the selected range.
    // Because the visitor hash re-salts every UTC day, a journey is effectively
    // a single visitor's activity on one day (no cross-day tracking — by design).
    if (report === "journeys") {
      const jDur = RANGES[url.searchParams.get("range")] || RANGES["7d"];
      const jSince = now - jDur;
      let jrows = await sbSelectEvents(new Date(jSince).toISOString(), 100000);
      if (!includeBots) jrows = jrows.filter((r) => !(r.props && r.props.bot));
      jrows = jrows.filter((r) => t(r) >= jSince);

      const CAP = 300;
      const journeys = buildJourneys(jrows);
      const summary = journeySummary(journeys);

      return res.end(
        JSON.stringify({
          ok: true,
          report: "journeys",
          meta: {
            range: url.searchParams.get("range") || "7d",
            since: new Date(jSince).toISOString(),
            until: new Date(now).toISOString(),
            botsExcluded: !includeBots,
            rowsScanned: jrows.length,
            returned: Math.min(journeys.length, CAP),
            generatedAt: new Date(now).toISOString(),
          },
          summary,
          journeys: journeys.slice(0, CAP),
        })
      );
    }

    // ---- Path flow (page-to-page routes across all visitors) -------------
    // Counts consecutive pageview transitions within sessions, plus per-page
    // incoming/outgoing pages and entry/exit buckets, so the admin can explore
    // how visitors move through the site.
    if (report === "flow") {
      const fDur = RANGES[url.searchParams.get("range")] || RANGES["7d"];
      const fSince = now - fDur;
      let frows = await sbSelectEvents(new Date(fSince).toISOString(), 100000);
      if (!includeBots) frows = frows.filter((r) => !(r.props && r.props.bot));
      const pv = frows.filter((r) => r.type === "pageview" && t(r) >= fSince);

      const byVid = new Map();
      for (const r of pv) {
        const v = vidOf(r);
        if (!byVid.has(v)) byVid.set(v, []);
        byVid.get(v).push(r);
      }

      const pageInfo = new Map(); // path -> { path, views, entries, exits, inMap, outMap }
      const P = (path) => {
        if (!pageInfo.has(path))
          pageInfo.set(path, { path, views: 0, entries: 0, exits: 0, inMap: new Map(), outMap: new Map() });
        return pageInfo.get(path);
      };
      const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
      const topOf = (map, n) =>
        [...map.entries()]
          .map(([key, count]) => ({ key, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, n);

      let sessionsCount = 0;
      for (const evs of byVid.values()) {
        evs.sort((a, b) => t(a) - t(b));
        let session = [];
        let lastT = null;
        const flush = () => {
          if (!session.length) return;
          sessionsCount++;
          const paths = session.map((e) => e.path || "/");
          for (let i = 0; i < paths.length; i++) {
            const cur = P(paths[i]);
            cur.views++;
            if (i === 0) cur.entries++;
            if (i === paths.length - 1) cur.exits++;
            if (i < paths.length - 1) {
              const from = paths[i];
              const to = paths[i + 1];
              if (from !== to) {
                // ignore refresh self-loops
                bump(P(from).outMap, to);
                bump(P(to).inMap, from);
              }
            }
          }
          session = [];
        };
        for (const e of evs) {
          const tt = t(e);
          if (lastT !== null && tt - lastT > SESSION_GAP) flush();
          session.push(e);
          lastT = tt;
        }
        flush();
      }

      const allTransitions = [];
      for (const p of pageInfo.values()) {
        for (const [to, count] of p.outMap.entries()) {
          allTransitions.push({ from: p.path, to, count });
        }
      }
      allTransitions.sort((a, b) => b.count - a.count);
      const transitions = allTransitions.slice(0, 40);

      const pages = [...pageInfo.values()]
        .map((p) => ({
          path: p.path,
          views: p.views,
          entries: p.entries,
          exits: p.exits,
          in: topOf(p.inMap, 12),
          out: topOf(p.outMap, 12),
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 60);

      return res.end(
        JSON.stringify({
          ok: true,
          report: "flow",
          meta: {
            range: url.searchParams.get("range") || "7d",
            since: new Date(fSince).toISOString(),
            until: new Date(now).toISOString(),
            botsExcluded: !includeBots,
            rowsScanned: frows.length,
            generatedAt: new Date(now).toISOString(),
          },
          summary: {
            sessions: sessionsCount,
            pages: pageInfo.size,
            transitionTypes: allTransitions.length,
            topRoute: transitions[0] || null,
          },
          transitions,
          pages,
        })
      );
    }

    // ---- Delivery check (four records of the same submission) -------------
    if (report === "delivery") {
      const dDur = RANGES[url.searchParams.get("range")] || RANGES["30d"];
      const dSince = now - dDur;
      const sinceIso = new Date(dSince).toISOString();
      let drows = await sbSelectEvents(sinceIso, 100000);
      if (!includeBots) drows = drows.filter((r) => !(r.props && r.props.bot));
      let enq = await sbSelectEnquiriesSince(sinceIso);
      if (!includeBots) enq = enq.filter((e) => !(e.meta && e.meta.bot));
      const rep = deliveryReport(drows, enq, dSince);
      return res.end(
        JSON.stringify(
          Object.assign(
            {
              ok: true,
              report: "delivery",
              meta: {
                range: url.searchParams.get("range") || "30d",
                since: sinceIso,
                until: new Date(now).toISOString(),
                botsExcluded: !includeBots,
                rowsScanned: drows.length,
                enquiriesScanned: enq.length,
                generatedAt: new Date(now).toISOString(),
              },
            },
            rep
          )
        )
      );
    }

    // ---- Journeys from one source ----------------------------------------
    // Clicking a channel, referrer or campaign on the Sources page asks for every
    // visit that came that way, in order, with the enquiry or visualiser session it
    // produced attached in full.
    if (report === "sourcejourneys") {
      const raw = String(url.searchParams.get("src") || "all:");
      const ci = raw.indexOf(":");
      const kind = ci === -1 ? raw : raw.slice(0, ci);
      const value = ci === -1 ? "" : raw.slice(ci + 1);
      if (["all", "channel", "referrer", "campaign", "entry"].indexOf(kind) === -1) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: "bad_source" }));
      }

      const sDur = RANGES[url.searchParams.get("range")] || RANGES["7d"];
      const sSince = now - sDur;
      const sinceIso = new Date(sSince).toISOString();
      let srows = await sbSelectEvents(sinceIso, 100000);
      if (!includeBots) srows = srows.filter((r) => !(r.props && r.props.bot));
      srows = srows.filter((r) => t(r) >= sSince);

      const all = buildJourneys(srows).filter((j) => srcMatches(j, kind, value));
      // Chronological, as asked: oldest first. When capped it is the most RECENT
      // window that is kept, still in order.
      all.sort((a, b) => new Date(a.firstTs).getTime() - new Date(b.firstTs).getTime());
      const CAP = 150;
      const shown = all.length > CAP ? all.slice(all.length - CAP) : all;

      // Only pay for the enquiry table if something here actually sent a form.
      let enq = [];
      if (shown.some((j) => j.formTs && j.formTs.length)) {
        enq = await sbSelectEnquiriesSince(sinceIso);
        if (!includeBots) enq = enq.filter((e) => !(e.meta && e.meta.bot));
      }
      attachEnquiries(shown, enq);
      for (const j of shown) j.visualiser = visualiserDetail(j);

      return res.end(
        JSON.stringify({
          ok: true,
          report: "sourcejourneys",
          meta: {
            src: { kind, value },
            range: url.searchParams.get("range") || "7d",
            since: sinceIso,
            until: new Date(now).toISOString(),
            botsExcluded: !includeBots,
            rowsScanned: srows.length,
            matched: all.length,
            returned: shown.length,
            generatedAt: new Date(now).toISOString(),
          },
          summary: Object.assign(journeySummary(all), {
            withEnquiry: all.filter((j) => j.outcome.enquiry).length,
            withVisualiser: all.filter((j) => j.outcome.visualiser).length,
            withIntent: all.filter((j) => j.outcome.intent).length,
            attempted: all.filter((j) => j.outcome.attempted).length,
          }),
          journeys: shown,
        })
      );
    }

    // ---- Full bundle -----------------------------------------------------
    const dur = RANGES[url.searchParams.get("range")] || RANGES["7d"];
    const byHour = dur <= RANGES["24h"];
    const curSince = now - dur;
    const prevSince = now - 2 * dur;

    let rows = await sbSelectEvents(new Date(prevSince).toISOString(), 100000);
    if (!includeBots) rows = rows.filter((r) => !(r.props && r.props.bot));

    const cur = rows.filter((r) => t(r) >= curSince);
    const prev = rows.filter((r) => t(r) >= prevSince && t(r) < curSince);

    const curPv = cur.filter((r) => r.type === "pageview");
    const curEv = cur.filter((r) => r.type === "event");
    // Deduped once, here: every figure derived from engagement — visit duration, the
    // per-page average time, the time-on-page distribution — has to see the same
    // readings, or they will quietly disagree with each other.
    const engagedEv = dedupeEngaged(curEv.filter((r) => r.name === "engaged"));
    const realEv = curEv.filter((r) => !INTERNAL_EVENTS.has(r.name));
    const sessions = buildSessions(curPv, engagedEv);

    const metrics = coreMetrics(cur, sessions);
    const prevMetrics = coreMetrics(prev);

    // Who came from where, taken from each visitor's first page view — an event row's
    // own channel is always "direct" because track() sends no referrer.
    const attrib = attribution(curPv);
    const pvByVid = new Map();
    for (const r of curPv) {
      const v = vidOf(r);
      pvByVid.set(v, (pvByVid.get(v) || 0) + 1);
    }
    const leadVids = new Set();
    const intentVids = new Set();
    for (const e of realEv) {
      if (ENQUIRY_EVENTS.has(e.name)) leadVids.add(vidOf(e));
      else if (INTENT_EVENTS.has(e.name)) intentVids.add(vidOf(e));
    }
    const perf = (keyOf, limit) =>
      sourcePerformance(attrib, pvByVid, leadVids, intentVids, keyOf, limit);

    // Pages people asked for that do not exist. Recorded by the 404 page itself, so
    // this is "bad links real visitors followed" — a crawler never runs the tracker.
    const notFoundRows = curEv.filter((r) => r.name === "page_not_found");
    const notFoundMap = new Map();
    for (const r of notFoundRows) {
      const p = r.path || "/";
      if (!notFoundMap.has(p)) notFoundMap.set(p, { path: p, count: 0, from: new Map() });
      const n = notFoundMap.get(p);
      n.count += 1;
      const f = (r.props && r.props.from) || "";
      if (f) n.from.set(f, (n.from.get(f) || 0) + 1);
    }
    const notFound = [...notFoundMap.values()]
      .map((n) => ({
        path: n.path,
        count: n.count,
        from: [...n.from.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, 6),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);

    // Was the button even seen? A click count alone cannot tell you whether a CTA is
    // ignored or simply never reached.
    const ctaMap = new Map();
    const C = (p) => {
      if (!ctaMap.has(p)) ctaMap.set(p, { path: p, views: 0, clicks: 0 });
      return ctaMap.get(p);
    };
    for (const r of curEv) {
      if (r.name === "cta_view") C(r.path || "/").views += 1;
      else if (r.name === "cta_click") C(r.path || "/").clicks += 1;
    }
    const ctaPerformance = [...ctaMap.values()]
      .map((c) => Object.assign(c, { rate: c.views ? Math.round((c.clicks / c.views) * 100) : null }))
      .sort((a, b) => b.views - a.views || b.clicks - a.clicks)
      .slice(0, 25);

    // Campaigns (UTM)
    const campMap = new Map();
    for (const r of curPv) {
      const u = r.props && r.props.utm;
      if (!u) continue;
      const key = `${u.source || "(none)"} / ${u.medium || "(none)"} / ${u.campaign || "(none)"}`;
      campMap.set(key, (campMap.get(key) || 0) + 1);
    }
    const campaigns = [...campMap.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);

    // Events by name + by page (excludes the internal "engaged" beacon)
    const eventsByName = countBy(realEv, (r) => r.name, 50);
    const eventByPage = {};
    for (const e of realEv) {
      (eventByPage[e.name] = eventByPage[e.name] || {});
      const p = e.path || "/";
      eventByPage[e.name][p] = (eventByPage[e.name][p] || 0) + 1;
    }
    const visualiser = countBy(
      curEv.filter((r) => /^visualiser/.test(r.name || "")),
      (r) => r.name,
      20
    );

    const bundle = {
      ok: true,
      report: "full",
      meta: {
        range: url.searchParams.get("range") || "7d",
        since: new Date(curSince).toISOString(),
        until: new Date(now).toISOString(),
        botsExcluded: !includeBots,
        rowsScanned: rows.length,
        generatedAt: new Date(now).toISOString(),
      },
      metrics,
      prevMetrics,
      timeseries: timeseries(curPv, curSince, now, byHour),
      patterns: {
        dayOfWeek: dayOfWeekHist(curPv),
        hourOfDay: hourHist(curPv),
      },
      pages: pageStats(curPv, engagedEv),
      entryPages: countBy(sessions, (s) => s.entry, 25),
      exitPages: countBy(sessions, (s) => s.exit, 25),
      sources: {
        referrers: countBy(curPv, (r) => r.referrer_host, 30),
        channels: countBy(curPv, (r) => (r.props && r.props.channel) || "direct", 10),
        campaigns,
        // Same three lists again, but per VISITOR and with what they went on to do —
        // the page-view counts above answer "how much traffic", these answer "which
        // traffic was worth having".
        channelPerf: perf((a) => a.channel || "direct"),
        referrerPerf: perf((a) => a.referrerHost, 25),
        campaignPerf: perf((a) => a.campaign, 25),
        entryPerf: perf((a) => a.entry, 25),
      },
      locations: {
        countries: countBy(curPv, (r) => r.country, 50),
        regions: countBy(curPv, (r) => r.props && r.props.region, 50),
        cities: countBy(curPv, (r) => r.props && r.props.city, 50),
      },
      tech: {
        devices: countBy(curPv, (r) => r.device, 10),
        browsers: countBy(curPv, (r) => r.browser, 15),
        os: countBy(curPv, (r) => r.os, 15),
        screens: countBy(curPv, screenLabel, 15),
        languages: countBy(curPv, (r) => r.props && r.props.lang, 15),
        timezones: countBy(curPv, (r) => r.props && r.props.tz, 15),
      },
      engagement: {
        timeOnPage: bucketDist(
          engagedEv.map(durMs).filter((d) => d > 0).map((d) => d / 1000),
          [10, 30, 60, 180],
          ["0–10s", "10–30s", "30–60s", "1–3m", "3m+"]
        ),
        scrollDepth: bucketDist(
          engagedEv
            .map((r) => (r.props && r.props.scroll) || 0)
            .filter((s) => s > 0),
          [25, 50, 75],
          ["≤25%", "26–50%", "51–75%", "76–100%"]
        ),
      },
      // The props have been recorded since June and were discarded at this step.
      events: { byName: eventsByName, byPage: eventByPage, props: propBreakdowns(realEv) },
      visualiser,
      content: contentGroups(curPv, engagedEv, leadVids),
      notFound,
      ctaPerformance,
      vitals: vitalsSummary(curEv.filter((r) => r.name === "vitals")),
      quality: trafficQuality(sessions),
    };

    return res.end(JSON.stringify(bundle));
  } catch (err) {
    console.error("sc-admin-stats error", err && err.message);
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: "stats_failed" }));
  }
};
