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
} = require("../serverlib/common");

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

  // `kind` selects what to return: client errors (default, login rows excluded)
  // or admin login attempts ("logins" = all, or just failed/successful).
  const VALID_KINDS = ["errors", "logins", "logins_failed", "logins_success"];
  let kind = url.searchParams.get("kind");
  if (!VALID_KINDS.includes(kind)) kind = "errors";
  const isLogins = kind !== "errors";

  const botsParam = url.searchParams.get("bots");
  // Errors default to hiding bots; login attempts default to showing everything
  // (bot/script sign-in attempts are exactly what you want to see).
  const botMode =
    botsParam === "include" || botsParam === "only" || botsParam === "exclude"
      ? botsParam
      : isLogins
      ? "include"
      : "exclude";

  try {
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
