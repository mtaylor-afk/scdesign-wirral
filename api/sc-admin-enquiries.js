/**
 * SC Design Wirral — admin enquiries API.
 *
 * Requires a valid admin session. Returns a page of saved form submissions
 * (newest first) from the SC-isolated Supabase `sc_enquiries` table, with an
 * exact total so the admin UI can paginate (10 per page by default).
 */

const { applyCors, requireSession, sbSelectEnquiries } = require("../serverlib/common");

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

  try {
    const { rows, total } = await sbSelectEnquiries(pageSize, (page - 1) * pageSize);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return res.end(
      JSON.stringify({
        ok: true,
        page,
        pageSize,
        total,
        totalPages,
        rows,
        generatedAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error("sc-admin-enquiries error", err && err.message);
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: "enquiries_failed" }));
  }
};
