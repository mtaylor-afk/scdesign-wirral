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
const mailer = require("../serverlib/icloud-mailer");

// SC enquiry notifications go to BOTH of Sean's addresses (the existing pair —
// the same two used by the site's mailto fallback). Overridable via
// SC_LEAD_RECIPIENTS (comma-separated) without code changes.
const SC_RECIPIENTS = (
  process.env.SC_LEAD_RECIPIENTS ||
  "scdesignandconstruction1@gmail.com,matthewjtaylor1985@icloud.com"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Build + send Sean's notification email for one enquiry row. Best-effort. */
async function notifySean(row) {
  if (!mailer.isConfigured()) {
    return { emailed: false, emailError: "smtp_not_configured" };
  }
  const formLabel =
    row.form === "visualiser_concept"
      ? "visualiser enquiry"
      : row.form === "cost_estimate"
        ? "cost estimate enquiry"
        : "enquiry";
  const name = row.name || "someone";
  const subject = `New SC Design Wirral ${formLabel} from ${name}`;
  const replyValid = EMAIL_RE.test(row.email || "");

  const fieldRows = [
    ["Name", row.name],
    ["Email", row.email],
    ["Phone", row.phone],
    ["Postcode", row.postcode],
    ["Project type", row.project_type],
    ["Source", row.form],
    ["Page", row.page],
    ["Location", [row.city, row.region, row.country].filter(Boolean).join(", ")],
  ].filter((r) => r[1]);

  const tableHtml =
    '<table style="border-collapse:collapse;font-size:14px">' +
    fieldRows
      .map(
        (r) =>
          `<tr><td style="padding:4px 16px 4px 0;color:#645f58;vertical-align:top;white-space:nowrap">${esc(
            r[0]
          )}</td><td style="padding:4px 0;color:#211e1b">${esc(r[1])}</td></tr>`
      )
      .join("") +
    "</table>";
  const messageHtml = row.message ? esc(row.message).replace(/\n/g, "<br>") : "(no message)";
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#211e1b;line-height:1.5">' +
    `<h2 style="margin:0 0 4px">New website ${esc(formLabel)}</h2>` +
    `<p style="margin:0 0 14px;color:#645f58;font-size:13px">via scdesignwirral.co.uk${
      replyValid ? ` — reply to this email to respond to ${esc(name)} directly.` : "."
    }</p>` +
    tableHtml +
    '<h3 style="margin:18px 0 6px">Their message</h3>' +
    `<div style="background:#f5efe5;padding:14px 16px;border-radius:10px;font-size:14px">${messageHtml}</div>` +
    "</div>";
  const text =
    `New website ${formLabel} (scdesignwirral.co.uk)\n\n` +
    fieldRows.map((r) => `${r[0]}: ${r[1]}`).join("\n") +
    `\n\nMessage:\n${row.message || "(no message)"}`;

  try {
    await mailer.send({
      to: SC_RECIPIENTS,
      replyTo: replyValid ? row.email : undefined,
      subject,
      html,
      text,
    });
    return { emailed: true, emailError: null };
  } catch (err) {
    const emailError = (err && err.message) || "send_failed";
    console.error("sc-enquiry-backup email failed:", emailError);
    return { emailed: false, emailError };
  }
}

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

  let stored = false;
  try {
    const result = await sbInsertEnquiry(row);
    stored = !!result.ok;
    if (!result.ok) {
      console.error("sc-enquiry-backup insert failed", result.status, result.error);
    }
  } catch (err) {
    console.error("sc-enquiry-backup error", err && err.message);
  }

  // Server-side notification email to Sean (both addresses), independent of the
  // external q-cbuild1 enquiry endpoint. Best-effort — never throws.
  const { emailed, emailError } = await notifySean(row);

  // ok if the lead was captured by EITHER durable path (SQL row or email).
  const ok = stored || emailed;
  res.statusCode = ok ? 200 : 502;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify({ ok, stored, emailed, emailError }));
};
