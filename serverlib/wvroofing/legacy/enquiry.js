// @ts-nocheck -- temporary v02 bridge (deleted in A4); not worth typing.
// WV Roofing (concept site) — quote / survey request.
//
// POST /api/wvroofing/enquiry  { name, phone?, email?, postcode?, product?, message?, consent,
//                                source?, elapsedMs?, company? (honeypot), attachments?, measure? }
// Emails the request to WVR_LEAD_TO. Nothing is stored. Until WVR_LEAD_TO (and
// the SMTP credentials) are configured it answers 200 { error: "not_configured" },
// and the form tells the visitor that this concept site isn't collecting enquiries yet.
//
// v02 bridge (A1): moved here unchanged from api/wvroofing/enquiry.js and served
// by the router until A4 replaces it (enquiries saved before any email is sent).
"use strict";

const W = require("../core.js");

const MAX_BODY = 2.6 * 1024 * 1024;
const MAX_ATTACHMENT = 450 * 1024;
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const PHONE_RE = /^[+()\d\s-]{7,20}$/;
const POSTCODE_RE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/;

const perIp = W.createLimiter(5, 60 * 60 * 1000);

function num(v, min, max, dp) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  const k = Math.pow(10, dp || 0);
  return Math.round(n * k) / k;
}

function sanitiseMeasure(m) {
  if (!m || typeof m !== "object") return null;
  const out = {
    postcode: W.oneLine(m.postcode, 10).toUpperCase(),
    planAreaM2: num(m.planAreaM2, 1, 2000, 1),
    pitchDeg: num(m.pitchDeg, 0, 70, 0),
    roofAreaM2: num(m.roofAreaM2, 1, 3000, 1),
    houseType: W.oneLine(m.houseType, 40),
    lat: num(m.lat, 49, 61, 5),
    lon: num(m.lon, -9, 3, 5),
    method: W.oneLine(m.method, 30),
    estimate: null,
  };
  if (m.estimate && typeof m.estimate === "object") {
    const e = m.estimate;
    out.estimate = {
      product: W.PRODUCTS.has(String(e.product)) ? String(e.product) : "",
      low: num(e.low, 0, 500000, 0),
      high: num(e.high, 0, 500000, 0),
      vat: W.oneLine(e.vat, 20),
    };
  }
  if (Array.isArray(m.polygon)) {
    out.points = m.polygon.length;
  }
  return out.planAreaM2 || out.roofAreaM2 ? out : null;
}

function sanitiseAttachments(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const a of list.slice(0, 3)) {
    if (!a || typeof a !== "object") continue;
    let parsed;
    try {
      parsed = W.parseDataUrl(a.dataUrl, ["image/jpeg"], MAX_ATTACHMENT, "attachment");
    } catch (err) {
      continue;
    }
    if (!W.jpegSize(parsed.buf)) continue;
    const name = W.oneLine(a.name, 60).replace(/[^a-z0-9._-]/gi, "-") || "image.jpg";
    out.push({ filename: /\.jpe?g$/i.test(name) ? name : name + ".jpg", content: parsed.buf, contentType: "image/jpeg" });
  }
  return out;
}

function money(n) {
  return n == null ? "-" : "£" + Number(n).toLocaleString("en-GB");
}

function buildEmail(d, measure, attachments) {
  const product = d.product && W.PRODUCTS.get(d.product);
  const rows = [
    ["Name", d.name],
    ["Phone", d.phone || "-"],
    ["Email", d.email || "-"],
    ["Postcode", d.postcode || "-"],
    ["Roof choice", product ? product.name + " - " + product.colourName : d.product === "not-sure" ? "Not sure yet" : "-"],
    ["Message", d.message || "-"],
    ["From page", d.source || "-"],
  ];
  if (measure) {
    rows.push(["Measured roof (plan)", measure.planAreaM2 != null ? measure.planAreaM2 + " m²" : "-"]);
    rows.push(["Pitch used", measure.pitchDeg != null ? measure.pitchDeg + "°" : "-"]);
    rows.push(["Roof area (sloped)", measure.roofAreaM2 != null ? measure.roofAreaM2 + " m²" : "-"]);
    if (measure.houseType) rows.push(["House type", measure.houseType]);
    if (measure.lat != null) rows.push(["Map location", measure.lat + ", " + measure.lon + " (https://www.google.com/maps?q=" + measure.lat + "," + measure.lon + ")"]);
    if (measure.estimate) {
      const ep = measure.estimate.product && W.PRODUCTS.get(measure.estimate.product);
      rows.push(["Online estimate", money(measure.estimate.low) + " to " + money(measure.estimate.high) + (ep ? " (" + ep.name + ")" : "") + (measure.estimate.vat ? ", " + measure.estimate.vat : "")]);
    }
    rows.push(["Measured with", measure.method || "aerial map"]);
  }
  const text =
    "New roof survey request from the WV Roofing concept site\n\n" +
    rows.map(([k, v]) => k + ": " + v).join("\n") +
    (attachments.length ? "\n\nAttached: " + attachments.map((a) => a.filename).join(", ") : "") +
    "\n\nEstimates and measurements are indicative and were produced automatically on the website.";
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1d2129">' +
    '<h2 style="font-family:Georgia,serif;color:#1b2a4a;margin:0 0 12px">New roof survey request</h2>' +
    '<p style="margin:0 0 14px;color:#555">From the WV Roofing concept site.</p>' +
    '<table cellpadding="6" style="border-collapse:collapse">' +
    rows
      .map(
        ([k, v]) =>
          '<tr><td style="border-bottom:1px solid #eee;color:#666;vertical-align:top;white-space:nowrap">' +
          W.esc(k) +
          '</td><td style="border-bottom:1px solid #eee;white-space:pre-wrap">' +
          W.esc(v) +
          "</td></tr>"
      )
      .join("") +
    "</table>" +
    (attachments.length ? '<p style="color:#555">Attached: ' + W.esc(attachments.map((a) => a.filename).join(", ")) + "</p>" : "") +
    '<p style="color:#888;font-size:12px;margin-top:18px">Estimates and measurements are indicative and were produced automatically on the website.</p></div>';
  return { text, html };
}

async function sendMail({ to, replyTo, subject, text, html, attachments }) {
  if (process.env.WVR_MAIL_DRYRUN === "1") {
    console.log("[wvroofing] DRY RUN email to", to, subject, attachments.map((a) => a.filename + ":" + a.content.length).join(","));
    return { dryRun: true };
  }
  const nodemailer = require("nodemailer");
  const transport = nodemailer.createTransport({
    host: "smtp.mail.me.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const from = W.oneLine(process.env.WVR_MAIL_FROM || '"WV Roofing (concept)" <mail@tailoredquote.co.uk>', 200);
  await transport.sendMail({ from, to, replyTo, subject, text, html, attachments });
  return { dryRun: false };
}

module.exports = async (req, res) => {
  const corsState = W.cors(req, res);
  if (corsState === "preflight") return;
  try {
    if (req.method !== "POST") return W.json(res, 405, { ok: false, error: "method_not_allowed" }, { Allow: "POST, OPTIONS" });
    if (corsState === "forbidden") return W.json(res, 403, { ok: false, error: "origin" });
    const body = await W.readJson(req, MAX_BODY);

    const d = {
      name: W.oneLine(body.name, 80),
      phone: W.oneLine(body.phone, 24),
      email: W.oneLine(body.email, 120),
      postcode: W.oneLine(body.postcode, 10).toUpperCase(),
      product: W.oneLine(body.product, 40),
      message: W.clean(body.message, 2000),
      source: W.oneLine(body.source, 60),
    };
    // Bots: honeypot filled, or the form was completed impossibly fast. Pretend success.
    if (W.clean(body.company, 100) || (Number(body.elapsedMs) > 0 && Number(body.elapsedMs) < 2500)) {
      return W.json(res, 200, { ok: true });
    }
    const problems = [];
    if (d.name.length < 2) problems.push("name");
    if (!d.phone && !d.email) problems.push("contact");
    if (d.email && !EMAIL_RE.test(d.email)) problems.push("email");
    if (d.phone && !PHONE_RE.test(d.phone)) problems.push("phone");
    if (d.postcode && !POSTCODE_RE.test(d.postcode)) problems.push("postcode");
    if (d.product && d.product !== "not-sure" && !W.PRODUCTS.has(d.product)) problems.push("product");
    if (body.consent !== true) problems.push("consent");
    if (problems.length) return W.json(res, 400, { ok: false, error: "invalid_fields", fields: problems, message: "Please check the form and try again." });

    const lim = perIp.hit(W.ipKey(req));
    if (!lim.ok) return W.json(res, 429, { ok: false, error: "rate_limited" }, { "Retry-After": String(lim.retryAfter) });

    const to = String(process.env.WVR_LEAD_TO || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => EMAIL_RE.test(s));
    const smtpReady = !!(process.env.SMTP_USER && process.env.SMTP_PASS) || process.env.WVR_MAIL_DRYRUN === "1";
    if (!to.length || !smtpReady) {
      perIp.undo(W.ipKey(req));
      // 200 (not 503): a concept site that isn't collecting enquiries yet is an
      // expected state, not a server fault. The client reads `error`.
      return W.json(res, 200, { ok: false, error: "not_configured", message: "This concept site isn't collecting enquiries yet." });
    }

    const measure = sanitiseMeasure(body.measure);
    const attachments = sanitiseAttachments(body.attachments);
    const { text, html } = buildEmail(d, measure, attachments);
    const subject = W.oneLine("WV Roofing survey request: " + d.name + (d.postcode ? " (" + d.postcode + ")" : ""), 140);
    const result = await sendMail({
      to,
      replyTo: d.email && EMAIL_RE.test(d.email) ? d.email : undefined,
      subject,
      text,
      html,
      attachments,
    });
    return W.json(res, 200, { ok: true, dryRun: result.dryRun || undefined });
  } catch (err) {
    if (err instanceof W.HttpError) return W.json(res, err.status, { ok: false, error: err.code, message: err.message });
    console.error("[wvroofing] enquiry failure", err && err.message);
    return W.json(res, 502, { ok: false, error: "send_failed", message: "The request couldn't be sent. Please try again." });
  }
};
