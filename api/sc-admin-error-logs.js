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
  if (pageSize > 50) pageSize = 50;
  let page = parseInt(url.searchParams.get("page"), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;

  const botsParam = url.searchParams.get("bots");
  const botMode =
    botsParam === "include" || botsParam === "only" ? botsParam : "exclude";

  try {
    const { rows, total } = await sbSelectErrors(pageSize, (page - 1) * pageSize, botMode);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const last24h = await sbCountErrors(since24h, botMode);
    return res.end(
      JSON.stringify({
        ok: true,
        page,
        pageSize,
        total,
        totalPages,
        last24h,
        botMode,
        rows,
        generatedAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error("sc-admin-error-logs error", err && err.message);
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: "error_logs_failed" }));
  }
};
