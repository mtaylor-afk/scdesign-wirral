// WV Roofing — its own email sender (A4). Never SC Design's mailer.
//
// - iCloud SMTP (the project's SMTP_USER / SMTP_PASS), with connection, greeting
//   and socket timeouts of 15, 10 and 30 seconds.
// - The From header always names "WV Roofing" and never "SC Design": a
//   WVR_MAIL_FROM that doesn't is ignored in favour of the default.
// - Every outcome is classified. "sent" means the server accepted the message.
//   A failure before the message was handed over is "failed" (safe to retry).
//   A connection lost after it was handed over is "uncertain": it may have
//   gone, so it isn't repeated automatically.
// - WVR_MAIL_DRYRUN=1 logs instead of sending. The labelled test environment
//   (WVR_ENV=test) never touches SMTP: messages go to an in-memory outbox.
"use strict";

const { isTest } = require("./capabilities.js");
const { oneLine } = require("./core.js");

const DEFAULT_FROM = '"WV Roofing (concept)" <mail@tailoredquote.co.uk>';
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/**
 * @typedef {Record<string, string | undefined>} Env
 * @typedef {{ filename: string, content: Buffer, contentType: string }} Attachment
 * @typedef {{ to: string[], replyTo?: string, subject: string, text: string, html: string, attachments?: Attachment[] }} Message
 * @typedef {{ outcome: "sent" | "failed" | "uncertain", messageId?: string | null, error?: string, dryRun?: boolean }} SendResult
 */

/**
 * The From header: WVR_MAIL_FROM if it names WV Roofing (and not SC Design), else the default.
 * @param {Env} [env]
 */
function fromAddress(env) {
  const e = env || process.env;
  const want = oneLine(e.WVR_MAIL_FROM || "", 200);
  if (want && /WV Roofing/i.test(want) && !/SC\s*Design/i.test(want) && /<[^\s@<>"]+@[^\s@<>"]+>/.test(want)) return want;
  return DEFAULT_FROM;
}

/**
 * Where enquiries go (WVR_LEAD_TO, comma-separated). The test environment has a placeholder.
 * @param {Env} [env]
 */
function recipients(env) {
  const e = env || process.env;
  const list = String(e.WVR_LEAD_TO || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => EMAIL_RE.test(s));
  if (!list.length && isTest(e)) return ["roofer@example.test"];
  return list;
}

// ---------------------------------------------------------------------------
// the test environment's outbox

/** @type {(Message & { from: string, at: string })[]} */
const outbox = [];
/** @type {{ mode: "ok" | "fail" | "uncertain", calls: number }} */
let fixture = { mode: "ok", calls: 0 };

/**
 * Tests: make the next sends fail or go uncertain. Refused outside the test environment.
 * @param {"ok" | "fail" | "uncertain"} mode
 */
function setFixture(mode) {
  if (!isTest(process.env)) throw new Error("The mail fixture exists only in the test environment.");
  fixture = { mode, calls: 0 };
  outbox.length = 0;
}

// ---------------------------------------------------------------------------
// sending

/**
 * Could the message already have gone when this error happened? nodemailer
 * reports the SMTP command that failed. An explicit rejection means nothing was
 * delivered; a lost connection before DATA (CONN, EHLO, AUTH, MAIL FROM, RCPT
 * TO...) means it wasn't sent; a lost connection during or after DATA, or at an
 * unknown point, might have been.
 * @param {any} err
 */
function afterHandover(err) {
  const command = String((err && err.command) || "").toUpperCase();
  const code = String((err && err.code) || "");
  const lost = /ETIMEDOUT|ESOCKET|ECONNRESET|EPIPE/.test(code) || /timeout|closed unexpectedly/i.test(String((err && err.message) || ""));
  if (!lost) return false;
  return command === "" || command === "DATA";
}

/**
 * Send one message.
 * @param {Message} m
 * @returns {Promise<SendResult>}
 */
async function send(m) {
  const from = fromAddress();
  const to = m.to.filter((s) => EMAIL_RE.test(s));
  if (!to.length) return { outcome: "failed", error: "no recipients" };
  if (isTest(process.env)) {
    fixture.calls++;
    if (fixture.mode === "fail") return { outcome: "failed", error: "fixture: connection refused" };
    if (fixture.mode === "uncertain") return { outcome: "uncertain", error: "fixture: connection lost after the message was sent" };
    outbox.push(Object.assign({}, m, { to, from, at: new Date().toISOString() }));
    console.log("[wvroofing] TEST ENVIRONMENT email (not sent):", m.subject);
    return { outcome: "sent", messageId: "fixture-" + outbox.length };
  }
  if (process.env.WVR_MAIL_DRYRUN === "1") {
    console.log("[wvroofing] DRY RUN email to", to.join(","), m.subject, (m.attachments || []).map((a) => a.filename + ":" + a.content.length).join(","));
    return { outcome: "sent", messageId: null, dryRun: true };
  }
  // @ts-ignore -- nodemailer ships no types (and a .d.ts here would leak into SC's own type check)
  const nodemailer = /** @type {{ createTransport(o: object): { sendMail(o: object): Promise<{ messageId?: string }>, close(): void } }} */ (require("nodemailer"));
  const transport = nodemailer.createTransport({
    host: "smtp.mail.me.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });
  try {
    const info = await transport.sendMail({ from, to, replyTo: m.replyTo, subject: m.subject, text: m.text, html: m.html, attachments: m.attachments || [] });
    return { outcome: "sent", messageId: info && info.messageId ? String(info.messageId) : null };
  } catch (err) {
    const detail = (err && /** @type {any} */ (err).code ? /** @type {any} */ (err).code + ": " : "") + (err instanceof Error ? err.message : String(err));
    console.warn("[wvroofing] email failed", detail.slice(0, 300));
    return { outcome: afterHandover(err) ? "uncertain" : "failed", error: detail.slice(0, 500) };
  } finally {
    transport.close();
  }
}

module.exports = { send, fromAddress, recipients, setFixture, outbox, afterHandover, EMAIL_RE, DEFAULT_FROM };
