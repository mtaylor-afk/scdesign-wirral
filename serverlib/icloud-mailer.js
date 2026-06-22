/**
 * SC Design Wirral — server-side iCloud SMTP mailer.
 *
 * Mirrors the TailoredQuote transactional-email framework (nodemailer over
 * Apple iCloud+ SMTP, smtp.mail.me.com:587 / requireTLS) so SC enquiry
 * notifications are sent the same proven way. Used by api/sc-enquiry-backup.js
 * to email Sean a copy of every website enquiry — independent of the external
 * q-cbuild1 endpoint.
 *
 * Env vars (set in the SC `scdesign-wirral` Vercel project):
 *   SMTP_USER       (required) — iCloud account email (the authenticated sender)
 *   SMTP_PASS       (required) — iCloud app-specific password
 *   SC_MAIL_FROM    (optional) — From header; MUST be an address/alias on the
 *                                SMTP_USER iCloud account. Defaults to the
 *                                TailoredQuote sender if those creds are reused.
 *
 * If SMTP_USER / SMTP_PASS are not set, send() throws and the caller treats the
 * email as "not sent" (the SQL backup + the external endpoint still apply), so a
 * missing config never breaks a submission.
 */

const nodemailer = require("nodemailer");

const DEFAULT_FROM =
  process.env.SC_MAIL_FROM || '"SC Design Wirral" <mail@tailoredquote.co.uk>';

function isConfigured() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransport() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error("icloud-mailer: SMTP_USER and SMTP_PASS must be set");
  }
  return nodemailer.createTransport({
    host: "smtp.mail.me.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });
}

/**
 * Send one email through iCloud SMTP.
 * @param {{to:string|string[], subject:string, html:string, text:string, replyTo?:string, from?:string}} opts
 * @returns {Promise<{messageId:string|null, accepted:string[], rejected:string[]}>}
 */
async function send(opts) {
  if (!opts || !opts.to || !opts.subject || !opts.html || !opts.text) {
    throw new Error("icloud-mailer: to, subject, html and text are all required");
  }
  const transporter = createTransport();
  // Strip CR/LF from header-bound fields so no caller (incl. the shared q-cbuild1
  // backend) can inject extra SMTP/MIME headers via from/replyTo/subject — header
  // injection protection that holds regardless of the nodemailer version.
  const noCRLF = (s) => (s == null ? s : String(s).replace(/[\r\n]+/g, " "));
  const info = await transporter.sendMail({
    from: noCRLF(opts.from) || DEFAULT_FROM,
    replyTo: noCRLF(opts.replyTo) || undefined,
    to: opts.to,
    subject: noCRLF(opts.subject),
    html: opts.html,
    text: opts.text,
  });
  return {
    messageId: info.messageId || null,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
  };
}

module.exports = { send, isConfigured };
