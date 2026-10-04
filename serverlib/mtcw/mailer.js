'use strict';

// MT Creative Works mailer: the SC Design Wirral iCloud SMTP route (serverlib/icloud-mailer.js in the scdesign-wirral
// repo), mirrored in MTCW's own file so MTCW never edits SC code, plus attachments and a development mail sink.
//
//   Transport (identical to SC's): nodemailer -> smtp.mail.me.com:587, secure false, requireTLS, auth from SMTP_USER /
//   SMTP_PASS (env only; never read into logs, responses or files), connectionTimeout 15000, greetingTimeout 10000,
//   socketTimeout 30000. CR/LF stripped from every header-bound field.
//   To: MTCW_LEAD_TO (one valid address) or matthewjtaylor1985@icloud.com - never from the request.
//   From: MTCW_MAIL_FROM or '"MT Creative Works website" <mail@tailoredquote.co.uk>' (SC's proven sender alias).
//   Reply-To: only a customer address that passed the strict email rule (<= 254, no CR/LF).
//   Attachments: { filename, content: Buffer, contentType } only (never path/href/raw/streams/URLs);
//   disableFileAccess + disableUrlAccess on every message; no list/headers/envelope/raw/icalEvent/amp.
//   Sent = the promise resolved AND accepted contains the recipient AND rejected is empty.
//
// MTCW_MAIL_MODE=sink (local harness and tests only): never opens an SMTP connection. Each message is built by
// nodemailer's streamTransport (the same MIME as production) and written to MTCW_MAIL_SINK_DIR as
// <UTC yyyymmddThhmmssZ>_<ref>_<label>.eml plus a .json summary beside it. Refused on Vercel.

const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');
const T = require('./text');

const DEFAULT_TO = 'matthewjtaylor1985@icloud.com';
const DEFAULT_FROM = '"MT Creative Works website" <mail@tailoredquote.co.uk>';

class MailError extends Error {
  constructor(code, detail) {
    super(`mtcw mail: ${code}`);
    this.code = code; // 'unavailable' | 'failed'
    this.detail = detail || null; // safe diagnostic (an error code), never an address or a secret
  }
}

function mailMode() {
  return process.env.MTCW_MAIL_MODE === 'sink' ? 'sink' : 'smtp';
}

/** Presence only: both SMTP variables are non-empty. Never their values or lengths. */
function smtpConfigured() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Can this instance deliver mail in its mode? */
function availability() {
  if (mailMode() === 'sink') {
    if (process.env.VERCEL) return { ok: false, reason: 'sink-on-vercel' };
    const dir = process.env.MTCW_MAIL_SINK_DIR;
    if (!dir || !path.isAbsolute(dir)) return { ok: false, reason: 'sink-dir' };
    return { ok: true };
  }
  return smtpConfigured() ? { ok: true } : { ok: false, reason: 'smtp-not-configured' };
}

/** The fixed recipient: MTCW_LEAD_TO when it is one valid address, else the owner's address. */
function recipient() {
  const override = T.sanitiseSingleLine(process.env.MTCW_LEAD_TO || '');
  return override && T.isValidEmail(override) ? override : DEFAULT_TO;
}

function sender() {
  const from = T.noCRLF(process.env.MTCW_MAIL_FROM || '').trim();
  return from || DEFAULT_FROM;
}

/** A Reply-To value only when it is a strictly valid single address. */
function safeReplyTo(value) {
  if (typeof value !== 'string' || value.length > T.EMAIL_MAX || /[\r\n]/.test(value)) return undefined;
  return T.isValidEmail(value) ? value : undefined;
}

function createSmtpTransport() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) throw new MailError('unavailable', 'smtp-not-configured');
  return nodemailer.createTransport({
    host: 'smtp.mail.me.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });
}

/** Build the nodemailer message object (header fields single-line; attachments as Buffers only). */
function buildMessage(message) {
  const attachments = (message.attachments || []).map((a) => {
    if (!a || typeof a.filename !== 'string' || !Buffer.isBuffer(a.content) || typeof a.contentType !== 'string') {
      throw new Error('mtcw mail: attachments must be { filename, content: Buffer, contentType }');
    }
    return { filename: T.noCRLF(a.filename), content: a.content, contentType: T.noCRLF(a.contentType) };
  });
  const out = {
    from: sender(),
    to: recipient(),
    subject: T.noCRLF(message.subject),
    text: message.text,
    html: message.html,
    attachments,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
  const replyTo = safeReplyTo(message.replyTo);
  if (replyTo) out.replyTo = replyTo;
  return out;
}

function sinkStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

async function writeToSink(built, meta) {
  const dir = process.env.MTCW_MAIL_SINK_DIR;
  fs.mkdirSync(dir, { recursive: true });
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const info = await transport.sendMail(built);
  const base = `${sinkStamp(meta.date || new Date())}_${meta.ref}_${meta.label}`;
  let name = base;
  for (let i = 2; fs.existsSync(path.join(dir, `${name}.eml`)); i += 1) name = `${base}-${i}`;
  fs.writeFileSync(path.join(dir, `${name}.eml`), info.message);
  const summary = {
    to: built.to,
    from: built.from,
    replyTo: built.replyTo || null,
    subject: built.subject,
    attachments: built.attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, size: a.content.length })),
    mode: 'sink',
  };
  fs.writeFileSync(path.join(dir, `${name}.json`), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return { mode: 'sink', file: `${name}.eml` };
}

/**
 * Send one message. `message` = { subject, text, html, replyTo?, attachments? }; `meta` = { ref, label, date }
 * (label: 'quick-message' | 'brief' | 'file-NN', used only for sink file names).
 * Resolves { mode } when the message was accepted; throws MailError otherwise.
 */
async function send(message, meta) {
  const available = availability();
  if (!available.ok) throw new MailError('unavailable', available.reason);
  const built = buildMessage(message);
  if (mailMode() === 'sink') return writeToSink(built, meta || {});

  let info;
  try {
    info = await createSmtpTransport().sendMail(built);
  } catch (error) {
    // Only an error code / SMTP response code is kept; messages can echo addresses.
    const detail = (error && (error.code || error.responseCode)) || 'send-error';
    throw new MailError('failed', String(detail));
  }
  const to = built.to.toLowerCase();
  const accepted = (info && Array.isArray(info.accepted) ? info.accepted : []).map((a) =>
    String(a && a.address ? a.address : a).toLowerCase(),
  );
  const rejected = info && Array.isArray(info.rejected) ? info.rejected : [];
  if (!accepted.includes(to) || rejected.length > 0) throw new MailError('failed', 'not-accepted');
  return { mode: 'smtp' };
}

module.exports = {
  DEFAULT_TO,
  DEFAULT_FROM,
  MailError,
  mailMode,
  smtpConfigured,
  availability,
  recipient,
  sender,
  safeReplyTo,
  buildMessage,
  send,
};
