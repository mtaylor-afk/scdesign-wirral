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
  sanitizeProps,
  sbInsert,
} = require("../serverlib/common");

function str(v, max) {
  if (v === undefined || v === null) return "";
  const s = String(v);
  return max ? s.slice(0, max) : s;
}

function int(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Read a client MEASUREMENT that may arrive at the top level or nested in `props`.
 *
 * The "engaged" beacon nests dur/scroll inside props (see flushEngaged in
 * src/components/Analytics.tsx); nothing has ever sent them at the top level. The
 * server used to read only the top level, wrote null over the real values, and left
 * every engagement report empty from 22 Jun 2026 until this was fixed.
 *
 * `??` and not `||`: a scroll depth of 0 is a real reading (someone didn't scroll),
 * and `||` would discard it.
 */
function measured(top, nested) {
  return top ?? nested;
}

/** Scroll depth is a percentage; anything outside 0–100 is not a reading. */
function pct(v) {
  const n = int(v);
  if (n === null) return null;
  return n < 0 ? 0 : n > 100 ? 100 : n;
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

  // Per-event extra props (the tracker sends a small object for events). Bounded
  // so a hostile client can't write huge rows.
  const extra =
    body.props && typeof body.props === "object" ? sanitizeProps(body.props) || {} : {};

  // Server-derived keys are spread LAST so a client-supplied `props` can't forge
  // or override vid/bot/geo/channel/etc.
  //
  // CAREFUL: that ordering is a security property, not a style choice — do NOT
  // "fix" a missing value by moving `extra` back to the end of this list. The two
  // genuine client MEASUREMENTS below (dur, scroll) are read out of `extra`
  // explicitly instead, via measured(). Everything else here is server-derived and
  // is meant to win.
  const props = Object.assign(
    {},
    extra,
    hasUtm ? { utm } : {},
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
      // Client measurements, not server-derived — see measured() above.
      dur: int(measured(body.dur, extra.dur)),
      scroll: pct(measured(body.scroll, extra.scroll)),
    }
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
