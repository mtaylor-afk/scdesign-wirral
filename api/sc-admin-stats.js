/**
 * SC Design Wirral — admin stats API.
 *
 * Requires a valid admin session. Pulls events from Supabase for the requested
 * range (plus the preceding period for % comparisons) and aggregates everything
 * the admin dashboard needs in a single JSON bundle. Bots are excluded by
 * default (?bots=include to keep them). ?report=realtime returns a light
 * last-30-minutes view.
 */

const { applyCors, requireSession, sbSelectEvents } = require("../serverlib/common");

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

function buildSessions(pageviews) {
  const byVid = new Map();
  for (const r of pageviews) {
    const v = vidOf(r);
    if (!byVid.has(v)) byVid.set(v, []);
    byVid.get(v).push(r);
  }
  const sessions = [];
  for (const evs of byVid.values()) {
    evs.sort((a, b) => t(a) - t(b));
    let cur = null;
    for (const e of evs) {
      const tt = t(e);
      if (!cur || tt - cur.lastT > SESSION_GAP) {
        if (cur) sessions.push(cur);
        cur = { entry: e.path, exit: e.path, pages: 1, startT: tt, lastT: tt, durSum: durMs(e) };
      } else {
        cur.pages += 1;
        cur.exit = e.path;
        cur.lastT = tt;
        cur.durSum += durMs(e);
      }
    }
    if (cur) sessions.push(cur);
  }
  return sessions;
}

function sessionDurationS(s) {
  const ms = s.pages > 1 ? s.lastT - s.startT : s.durSum;
  return Math.round(ms / 1000);
}

function coreMetrics(rows) {
  const pv = rows.filter((r) => r.type === "pageview");
  // "engaged" is an internal time-on-page beacon, not a real user event.
  const ev = rows.filter((r) => r.type === "event" && r.name !== "engaged");
  const sessions = buildSessions(pv);
  const bounces = sessions.filter((s) => s.pages === 1).length;
  const totalDur = sessions.reduce((a, s) => a + sessionDurationS(s), 0);
  const convNames = new Set([
    "phone_click",
    "email_click",
    "whatsapp_click",
    "form_submit",
    "visualiser_start",
  ]);
  const conv = ev.filter((e) => convNames.has(e.name)).length;
  return {
    pageviews: pv.length,
    events: ev.length,
    visitors: distinct(pv, vidOf),
    sessions: sessions.length,
    bounceRate: sessions.length ? Math.round((bounces / sessions.length) * 100) : 0,
    avgDuration: sessions.length ? Math.round(totalDur / sessions.length) : 0,
    pagesPerVisit: sessions.length ? +(pv.length / sessions.length).toFixed(2) : 0,
    conversions: conv,
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

// ---- handler --------------------------------------------------------------

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  res.setHeader("Content-Type", "application/json");

  if (!requireSession(req)) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
  }

  if (!process.env.SC_SUPABASE_URL || !process.env.SC_SUPABASE_SERVICE_ROLE_KEY) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "Supabase not configured." }));
  }

  const url = new URL(req.url, "http://x");
  const includeBots = url.searchParams.get("bots") === "include";
  const report = url.searchParams.get("report") || "full";
  const now = Date.now();

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

      const byVid = new Map();
      for (const r of jrows) {
        const v = vidOf(r);
        if (!byVid.has(v)) byVid.set(v, []);
        byVid.get(v).push(r);
      }

      const CONV = new Set([
        "phone_click",
        "email_click",
        "whatsapp_click",
        "form_submit",
        "visualiser_start",
        "visualiser_complete",
        "cta_click",
      ]);
      const SESSION_GAP_S = SESSION_GAP / 1000;
      const MAX_STEPS = 60;
      const CAP = 300;

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
              const sc = (e.props && e.props.scroll) || 0;
              if (sc > cur.scroll) cur.scroll = sc;
            }
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
        const converted = steps.some((s) => s.actions.some((a) => CONV.has(a.name)));
        const totalTime = steps.reduce((a, s) => a + s.timeOnPage, 0);

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

      journeys.sort((a, b) => t({ ts: b.lastTs }) - t({ ts: a.lastTs }));

      const summary = {
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
    const engagedEv = curEv.filter((r) => r.name === "engaged");
    const realEv = curEv.filter((r) => r.name !== "engaged");
    const sessions = buildSessions(curPv);

    const metrics = coreMetrics(cur);
    const prevMetrics = coreMetrics(prev);

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
      events: { byName: eventsByName, byPage: eventByPage },
      visualiser,
    };

    return res.end(JSON.stringify(bundle));
  } catch (err) {
    console.error("sc-admin-stats error", err && err.message);
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: "stats_failed" }));
  }
};
