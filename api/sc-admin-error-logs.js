/**
 * SC Design Wirral — admin error log API.
 *
 * Requires a valid admin session. Returns a page of captured client errors
 * (newest first) from the SC-isolated Supabase `sc_errors` table, with an exact
 * total so the admin UI can paginate (10 per page by default).
 *
 * Bots are excluded by default (`?bots=exclude`); pass `bots=include` for
 * everything or `bots=only` for just bot-generated errors. Also returns a cheap
 * last-24h count for the KPI tile.
 */

const {
  applyCors,
  requireSession,
  sbSelectErrors,
  sbCountErrors,
  sbSelectErrorTrend,
} = require("../serverlib/common");

/** Per-day counts, by row type, over a window — the Errors list plus a shape. */
function errorTrend(rows, days, nowMs) {
  const buckets = new Map();
  const dayMs = 24 * 60 * 60 * 1000;
  // Seed every day so a quiet day reads as zero rather than vanishing and making the
  // chart lie about its own x-axis.
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(nowMs - i * dayMs).toISOString().slice(0, 10);
    buckets.set(key, { day: key, total: 0, types: {} });
  }
  const types = new Map();
  for (const r of rows) {
    const key = String(r.ts || "").slice(0, 10);
    let b = buckets.get(key);
    if (!b) {
      b = { day: key, total: 0, types: {} };
      buckets.set(key, b);
    }
    b.total += 1;
    const ty = r.type || "unknown";
    b.types[ty] = (b.types[ty] || 0) + 1;
    types.set(ty, (types.get(ty) || 0) + 1);
  }
  const list = [...buckets.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  // Which kinds of fault are NEW this week — a fault that has always been there is a
  // different problem from one that started on Tuesday.
  const weekAgo = new Date(nowMs - 7 * dayMs).toISOString().slice(0, 10);
  const seenBefore = new Set();
  const seenRecent = new Set();
  for (const r of rows) {
    const key = String(r.ts || "").slice(0, 10);
    (key < weekAgo ? seenBefore : seenRecent).add(r.type || "unknown");
  }
  return {
    days: list,
    byType: [...types.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
    newTypes: [...seenRecent].filter((ty) => !seenBefore.has(ty)),
    total: rows.length,
  };
}

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
  let pageSize = parseInt(url.searchParams.get("pageSize"), 10);
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 10;
  // The on-screen table only ever asks for 10. The higher ceiling is for the
  // admin's "download the error log" export, which has to pull every row and
  // would otherwise need four times as many round trips.
  if (pageSize > 200) pageSize = 200;
  let page = parseInt(url.searchParams.get("page"), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;

  // Only return errors newer than this id — how the export skips everything
  // already downloaded. Clamped like every other input: a non-numeric or
  // negative value simply means "no watermark", never a malformed filter.
  let sinceId = parseInt(url.searchParams.get("sinceId"), 10);
  if (!Number.isSafeInteger(sinceId) || sinceId < 0) sinceId = null;

  // Whose error is it: the website's own ("site", the default — an extension
  // fault is not a fault in the site), everything, or only extension noise.
  // Clamped against a fixed list, like `kind` and `bots`.
  const VALID_PARTY = ["site", "all", "third"];
  let party = url.searchParams.get("party");
  if (!VALID_PARTY.includes(party)) party = "site";

  // `kind` selects what to return: client errors (default, login rows excluded),
  // admin login attempts ("logins" = all, or just failed/successful), or
  // "unnotified" — enquiries saved to the database that nobody was emailed about.
  const VALID_KINDS = ["errors", "logins", "logins_failed", "logins_success", "unnotified"];
  let kind = url.searchParams.get("kind");
  if (!VALID_KINDS.includes(kind)) kind = "errors";
  // Match on the prefix, not "anything that isn't errors": the login-only extras
  // below are meaningless for "unnotified" and would cost three wasted queries.
  const isLogins = kind.indexOf("logins") === 0;

  const botsParam = url.searchParams.get("bots");
  // Errors default to hiding bots; login attempts default to showing everything
  // (bot/script sign-in attempts are exactly what you want to see). "unnotified"
  // counts every saved-but-unemailed enquiry whatever the user-agent looked like —
  // undercounting a real lead is far worse than listing a spam one.
  const showAllAgents = isLogins || kind === "unnotified";
  const botMode =
    botsParam === "include" || botsParam === "only" || botsParam === "exclude"
      ? botsParam
      : showAllAgents
      ? "include"
      : "exclude";

  try {
    // A shape rather than a page: the list answers "what broke", this answers
    // "is it getting worse". Same bot/party/kind filters, so the two can never
    // disagree about what they are counting.
    if (url.searchParams.get("report") === "trend") {
      let days = parseInt(url.searchParams.get("days"), 10);
      if (!Number.isFinite(days) || days < 1) days = 30;
      if (days > 90) days = 90;
      const nowMs = Date.now();
      const sinceIso = new Date(nowMs - days * 24 * 60 * 60 * 1000).toISOString();
      const rows = await sbSelectErrorTrend(sinceIso, botMode, kind, party);
      return res.end(
        JSON.stringify(
          Object.assign(
            {
              ok: true,
              report: "trend",
              days,
              since: sinceIso,
              botMode,
              kind,
              party,
              generatedAt: new Date(nowMs).toISOString(),
            },
            errorTrend(rows, days, nowMs)
          )
        )
      );
    }

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { rows, total } = await sbSelectErrors(
      pageSize,
      (page - 1) * pageSize,
      botMode,
      kind,
      sinceId,
      party
    );
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const last24h = await sbCountErrors(since24h, botMode, kind, party);
    const payload = {
      ok: true,
      page,
      pageSize,
      total,
      totalPages,
      last24h,
      botMode,
      kind,
      // Echoed back so the export can confirm the watermark it asked for was
      // the one applied, matching how botMode and kind are already echoed.
      sinceId,
      party,
      rows,
      generatedAt: new Date().toISOString(),
    };
    if (isLogins) {
      payload.failedTotal = await sbCountErrors(null, botMode, "logins_failed");
      payload.successTotal = await sbCountErrors(null, botMode, "logins_success");
      payload.failed24h = await sbCountErrors(since24h, botMode, "logins_failed");
    }
    return res.end(JSON.stringify(payload));
  } catch (err) {
    console.error("sc-admin-error-logs error", err && err.message);
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: "error_logs_failed" }));
  }
};
