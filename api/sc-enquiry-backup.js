/**
 * SC Design Wirral — enquiry backup ingest.
 *
 * A SAFETY NET, not the primary path. The website's forms still email Sean
 * exactly as before (the contact form posts to the QCbuild1 endpoint; the
 * visualiser concept form uses mailto). This endpoint additionally stores a
 * copy of every submission in the SC-isolated Supabase `sc_enquiries` table so
 * there's a durable record even if an email is missed.
 *
 * Public POST from the live site only (allowed Origin). Captures every field
 * the form sends (named columns for the common ones + a `fields` jsonb for the
 * complete set), plus server-derived context (coarse geo, device, channel).
 * No raw IP is stored — consistent with the rest of the analytics stack.
 */

const {
  applyCors,
  isAllowedOrigin,
  readJsonBody,
  getGeo,
  parseUA,
  classifyChannel,
  hostOf,
  sbInsertEnquiry,
} = require("../serverlib/common");

function str(v, max) {
  if (v === undefined || v === null) return "";
  const s = typeof v === "string" ? v : String(v);
  return max ? s.slice(0, max) : s;
}

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }
  // Only accept submissions relayed from the live site.
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

  // Fields may arrive nested under `fields` or flat on the body.
  const F = body.fields && typeof body.fields === "object" ? body.fields : body;
  const pick = (k) => {
    const v = F[k];
    if (v === undefined || v === null || v === "") return null;
    return str(v, 4000);
  };

  // Best-effort mapping to searchable columns; everything is also kept in jsonb.
  let email = pick("email");
  let phone = pick("phone");
  const contact = pick("contact"); // visualiser form uses a single "phone or email" field
  if (contact) {
    if (!email && contact.includes("@")) email = contact;
    else if (!phone && !contact.includes("@")) phone = contact;
  }

  const ua = str(req.headers["user-agent"], 512);
  const { browser, os, device, isBot } = parseUA(ua);
  const geo = getGeo(req);

  const ref = str(body.ref || body.referrer, 1024);
  const referrerHost = hostOf(ref);
  const utm =
    body.utm && typeof body.utm === "object"
      ? body.utm
      : {
          source: str(body.us, 120),
          medium: str(body.um, 120),
          campaign: str(body.uc, 120),
          term: str(body.ut, 120),
          content: str(body.uo, 120),
        };
  const hasUtm = Object.values(utm).some(Boolean);
  const channel = classifyChannel(referrerHost, hasUtm ? utm : null);

  // Keep a clean copy of every field, minus the honeypot and the (large,
  // single-use) bot-challenge token.
  let cleanFields = {};
  try {
    cleanFields = JSON.parse(JSON.stringify(F));
  } catch {
    cleanFields = {};
  }
  delete cleanFields.company; // honeypot
  delete cleanFields["cf-turnstile-response"];

  const row = {
    form: str(body.form, 80) || "contact",
    name: pick("name"),
    email,
    phone,
    postcode: pick("postcode"),
    area: pick("area"),
    project_type: pick("projectType") || pick("project_type"),
    project_stage: pick("projectStage") || pick("project_stage"),
    has_builder: pick("hasBuilder") || pick("has_builder"),
    timescale: pick("timescale"),
    budget: pick("budget"),
    preferred_contact: pick("preferredContact") || pick("preferred_contact"),
    message: pick("message") || pick("notes"),
    page: str(body.page || F.page, 1024) || null,
    referrer_host: referrerHost || null,
    channel,
    country: geo.country || null,
    region: geo.region || null,
    city: geo.city || null,
    device,
    browser,
    os,
    status: "new",
    fields: cleanFields,
    meta: {
      page: str(body.page || F.page, 1024) || null,
      ref: ref || null,
      utm: hasUtm ? utm : null,
      lang: str(F.lang || body.lang, 35) || null,
      tz: str(F.tz || body.tz, 60) || geo.tz || null,
      userAgent: ua || null,
      bot: isBot,
    },
  };

  try {
    const result = await sbInsertEnquiry(row);
    if (!result.ok) {
      console.error("sc-enquiry-backup insert failed", result.status, result.error);
      res.statusCode = 502;
      return res.end();
    }
  } catch (err) {
    console.error("sc-enquiry-backup error", err && err.message);
    res.statusCode = 502;
    return res.end();
  }

  res.statusCode = 204;
  return res.end();
};
