/**
 * SC Design Wirral — first-party analytics ingest.
 *
 * Public endpoint called by the site's tiny tracker. Cookieless, no IP stored.
 * Adds coarse geo (Vercel edge headers), parses the user-agent, and computes a
 * daily-rotating salted visitor hash so we can count unique visitors + sessions
 * without cookies. Writes one row to the SC-isolated Supabase `sc_events` table.
 */

const {
  applyCors,
  isAllowedOrigin,
  readJsonBody,
  clientIp,
  getGeo,
  visitorHash,
  parseUA,
  classifyChannel,
  hostOf,
  sbInsert,
} = require("./_lib/common");

function str(v, max) {
  if (v === undefined || v === null) return "";
  const s = String(v);
  return max ? s.slice(0, max) : s;
}

function int(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }
  // Only accept beacons from the live site (basic abuse guard).
  if (!isAllowedOrigin(req)) {
    res.statusCode = 403;
    return res.end("Forbidden");
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    res.statusCode = 400;
    return res.end("Bad Request");
  }

  // Never record the admin area itself.
  const path = str(body.p, 512) || "/";
  if (path.startsWith("/admin")) {
    res.statusCode = 204;
    return res.end();
  }

  const type = body.t === "event" ? "event" : "pageview";
  const name = str(body.n, 80) || (type === "event" ? "event" : "pageview");

  const ua = str(req.headers["user-agent"], 512);
  const { browser, bv, os, osv, device, isBot } = parseUA(ua);
  const geo = getGeo(req);
  const ip = clientIp(req);
  const vid = visitorHash(ip, ua, "scdesign");

  const referrer = str(body.r, 1024);
  const referrerHost = hostOf(referrer);
  const utm = {
    source: str(body.us, 120),
    medium: str(body.um, 120),
    campaign: str(body.uc, 120),
    term: str(body.ut, 120),
    content: str(body.uo, 120),
  };
  const hasUtm = Object.values(utm).some(Boolean);
  const channel = classifyChannel(referrerHost, utm);

  // Per-event extra props (the tracker sends a small object for events).
  let extra = {};
  if (body.props && typeof body.props === "object") {
    try {
      extra = JSON.parse(JSON.stringify(body.props));
    } catch {
      extra = {};
    }
  }

  const props = Object.assign(
    {
      vid,
      ref: referrer || null,
      channel,
      title: str(body.title, 200) || null,
      sw: int(body.sw),
      sh: int(body.sh),
      vw: int(body.vw),
      vh: int(body.vh),
      dpr: typeof body.dpr === "number" ? body.dpr : null,
      lang: str(body.lang, 35) || null,
      tz: str(body.tz, 60) || geo.tz || null,
      region: geo.region || null,
      city: geo.city || null,
      bv: bv || null,
      osv: osv || null,
      bot: isBot,
      dur: int(body.dur),
      scroll: int(body.scroll),
    },
    hasUtm ? { utm } : {},
    extra
  );

  const row = {
    type,
    name,
    path,
    referrer_host: referrerHost || null,
    country: geo.country || null,
    browser,
    os,
    device,
    props,
  };

  try {
    const result = await sbInsert(row);
    if (!result.ok) {
      // Don't leak internals to the client; log for server diagnostics.
      console.error("sc-analytics-collect insert failed", result.status, result.error);
      res.statusCode = 502;
      return res.end();
    }
  } catch (err) {
    console.error("sc-analytics-collect error", err && err.message);
    res.statusCode = 502;
    return res.end();
  }

  res.statusCode = 204;
  return res.end();
};
