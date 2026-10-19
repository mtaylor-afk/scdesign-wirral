'use strict';

// MT Creative Works forms: ONE Vercel Node function (deployed as api/mtcw.js on the scdesign-wirral project).
// Source of truth: this repo's functions/ folder; the exact behaviour is docs/build/FORMS-CONTRACT.md.
//
//   GET     /api/mtcw                  health: {ok, service, schemaVersion, mode, smtpConfigured, fileTokensConfigured,
//                                      backupStore, sharedLimits}
//   OPTIONS /api/mtcw                  CORS preflight (allowed origins only)
//   POST    /api/mtcw?action=contact   quick message   (JSON, or a native urlencoded post answered with HTML)
//   POST    /api/mtcw?action=brief     website brief   (JSON, or native urlencoded) -> one email with 3 attachments
//   POST    /api/mtcw?action=file      one photo/file  (JSON + base64) -> one email with exactly one attachment
//
// Email is the record. A private safety-net copy of each form (photos: metadata only) and the shared rate limits /
// de-duplication live in a private bucket of SC's existing Supabase (serverlib/mtcw/store.js); if that is
// unavailable everything fails open to per-instance memory and the email is still sent. No cookies.
// Uses only Node's own req/res API (no res.status/res.json/res.send; req.body ONLY as a fallback when a platform has
// already consumed the request stream, see serverlib/mtcw/http.js), so the local harness and Vercel behave alike.
// Logs: action, status, error code, reference, duration. Never bodies, names, addresses, files, IPs, tokens or env.

const crypto = require('node:crypto');
const S = require('../serverlib/mtcw/schema');
const T = require('../serverlib/mtcw/text');
const H = require('../serverlib/mtcw/http');
const V = require('../serverlib/mtcw/validate');
const N = require('../serverlib/mtcw/native');
const R = require('../serverlib/mtcw/render');
const F = require('../serverlib/mtcw/format');
const K = require('../serverlib/mtcw/token');
const L = require('../serverlib/mtcw/limits');
const M = require('../serverlib/mtcw/mailer');
const B = require('../serverlib/mtcw/backup');
const { buildBriefModel, businessLabelOf } = require('../serverlib/mtcw/brief-model');
const { buildPack } = require('../serverlib/mtcw/pack');

const ACTIONS = S.schema.endpoint.actions;
const ACTION_PARAM = S.schema.endpoint.actionParam;
const ATTEMPT_PATTERN = new RegExp(S.schema.attemptId.pattern);
const CAPS = S.schema.limits.bodyBytes;
const HONEYPOT = S.schema.honeypot.field;

/* ------------------------------------------------------------------ replies */

/** Response helpers bound to one request: JSON for fetch, HTML pages for native (no-JavaScript) posts. */
function replier(res, ctx) {
  return {
    error(status, code, headers, extra) {
      ctx.log.status = status;
      ctx.log.error = code;
      if (ctx.native) {
        let html;
        if (status === 422) html = N.validationPage(ctx.form, (extra && extra.fields) || {}, ctx.allowed, ctx.sink);
        else if (status === 429) html = N.rateLimitPage(ctx.allowed, ctx.sink);
        else html = N.failurePage(ctx.form, ctx.allowed, ctx.sink);
        H.sendHtml(res, status, html, ctx.allowed, headers);
        return;
      }
      H.sendJson(res, status, { ok: false, error: code, ...(extra || {}) }, ctx.allowed, headers);
    },
    success(body) {
      ctx.log.status = 200;
      ctx.log.ref = body.ref;
      if (ctx.native) {
        const html =
          ctx.form === 'brief'
            ? N.briefSuccessPage(body.ref, ctx.allowed, ctx.sink)
            : N.contactSuccessPage(body.ref, ctx.allowed, ctx.sink);
        H.sendHtml(res, 200, html, ctx.allowed);
        return;
      }
      H.sendJson(res, 200, body, ctx.allowed);
    },
  };
}

function mailErrorReply(reply, error) {
  if (error instanceof M.MailError) {
    if (error.code === 'unavailable') return reply.error(503, 'mail_unavailable');
    return reply.error(502, 'mail_failed');
  }
  throw error;
}

/*
 * The de-duplication note (serverlib/mtcw/limits.js) remembers a sent form's response for up to 15 minutes so a
 * repeat is not emailed twice. A brief's file token carries the business name (for the photo emails' subject
 * lines), and the Privacy page says the service keeps none of your answers after sending. So the note keeps the
 * token WITHOUT that name: the reference, file count, expiry and file descriptors (hashes) only. A repeat of the
 * same attempt re-signs the same token from the note and the repeated request's own (validated) business name.
 */
function rememberable(response, tokenParts) {
  if (!tokenParts) return response;
  return { ...response, fileToken: null, tokenParts };
}

function fromRemembered(prior, values) {
  if (!prior.tokenParts) return prior;
  const { tokenParts, ...rest } = prior;
  const signed = K.signFileToken({
    ref: rest.ref,
    expectedFiles: tokenParts.n,
    businessLabel: businessLabelOf(values),
    descriptors: tokenParts.f,
    expiresAtSec: tokenParts.e,
  });
  return { ...rest, fileToken: signed.token };
}

function honeypotFilled(value) {
  if (value === undefined || value === null) return false;
  return typeof value !== 'string' || T.sanitiseSingleLine(value) !== '';
}

/* ------------------------------------------------------------------ GET / OPTIONS */

function health(res, allowed, log) {
  log.status = 200;
  H.sendJson(
    res,
    200,
    {
      ok: true,
      service: 'mtcw-forms',
      schemaVersion: S.SCHEMA_VERSION,
      mode: M.mailMode(),
      smtpConfigured: M.smtpConfigured(),
      fileTokensConfigured: K.tokenKey().key !== null,
      backupStore: B.backupStatus(),
      sharedLimits: L.sharedStatus(),
    },
    allowed,
  );
}

function preflight(res, allowed, log) {
  if (!allowed) {
    log.status = 403;
    log.error = 'origin';
    H.sendJson(res, 403, { ok: false, error: 'origin' }, null);
    return;
  }
  log.status = 204;
  H.sendEmpty(res, 204, allowed, {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
  });
}

/* ------------------------------------------------------------------ contact and brief */

async function handleForm(action, kind, body, req, reply, ctx) {
  let envelope;
  if (kind === 'json') {
    const data = H.parseJsonBody(body);
    if (!data) return reply.error(400, 'bad_request');
    if (data.schemaVersion !== S.SCHEMA_VERSION) return reply.error(400, 'bad_request');
    if (typeof data.attemptId !== 'string' || !ATTEMPT_PATTERN.test(data.attemptId)) return reply.error(400, 'bad_request');
    if (!V.isPlainObject(data.answers)) return reply.error(400, 'bad_request');
    envelope = {
      attemptId: data.attemptId,
      honeypot: V.own(data, HONEYPOT) ? data[HONEYPOT] : undefined,
      attribution: V.parseAttribution(data.attribution),
      answers: data.answers,
      files: data.files,
    };
  } else {
    const pairs = H.parseFormBody(body);
    if (!pairs) return reply.error(400, 'bad_request');
    const native = N.nativeToBody(action, pairs);
    if (native.schemaVersion !== undefined && native.schemaVersion !== S.SCHEMA_VERSION) return reply.error(400, 'bad_request');
    const attemptId = native.attemptId === undefined || native.attemptId === '' ? null : native.attemptId;
    if (attemptId !== null && !ATTEMPT_PATTERN.test(attemptId)) return reply.error(400, 'bad_request');
    envelope = {
      attemptId,
      honeypot: native.honeypot,
      attribution: V.parseAttribution(native.attribution),
      answers: native.answers,
      files: undefined,
    };
  }
  // Honeypot: never a success, nothing sent.
  if (honeypotFilled(envelope.honeypot)) return reply.error(400, 'bad_request');

  const result = V.validateForm(action, envelope.answers, envelope.files);
  if (!result.ok) return reply.error(422, 'validation', undefined, { fields: result.errors });

  const now = Date.now();
  const dedupeKey = envelope.attemptId ? `${action}|${envelope.attemptId}` : null;
  if (dedupeKey) {
    const prior = await L.recallShared(dedupeKey, now);
    if (prior) {
      if (prior.tokenParts && !K.tokenKey().key) return reply.error(503, 'mail_unavailable');
      return reply.success({ ...fromRemembered(prior, result.values), duplicate: true });
    }
  }
  const limited = await L.takeShared(L.checksFor(action, K.hashClient(H.clientIp(req))), now);
  if (!limited.ok) {
    return reply.error(429, 'rate_limited', { 'Retry-After': String(limited.retryAfter) }, { retryAfter: limited.retryAfter });
  }

  const date = new Date(now);
  const ref = K.makeReference(date);
  ctx.log.ref = ref;
  const mode = M.mailMode();
  let response;
  let tokenParts = null;

  if (action === 'contact') {
    const email = R.contactEmail({
      ref,
      date,
      values: result.values,
      attribution: envelope.attribution,
      attemptTag: F.attemptTag(envelope.attemptId),
      mode,
    });
    await B.saveForm({ action, ref, date, values: result.values, attribution: envelope.attribution, files: [], mode });
    try {
      await M.send({ ...email, replyTo: result.values.email }, { ref, label: 'quick-message', date });
    } catch (error) {
      return mailErrorReply(reply, error);
    }
    response = { ok: true, ref, sent: true, mode };
  } else {
    const files = result.files;
    if (files.length > 0 && !K.tokenKey().key) return reply.error(503, 'mail_unavailable');
    const model = buildBriefModel({
      ref,
      date,
      values: result.values,
      files,
      conflicts: result.conflicts,
      attribution: envelope.attribution,
      attemptId: envelope.attemptId,
      mode,
    });
    const pack = buildPack(model);
    const attachments = [
      { filename: pack.packName, content: pack.zip, contentType: 'application/zip' },
      { filename: 'website-brief.txt', content: Buffer.from(pack.briefTxt, 'utf8'), contentType: 'text/plain; charset=utf-8' },
      {
        filename: 'private-contact.txt',
        content: Buffer.from(R.privateContactText(model), 'utf8'),
        contentType: 'text/plain; charset=utf-8',
      },
    ];
    // Sign before sending, so a sent brief always comes back with its token.
    let fileToken = null;
    let tokenExpiresAt = null;
    if (files.length > 0) {
      const descriptors = files.map((file) => K.fileDescriptor(file));
      const signed = K.signFileToken({
        ref,
        expectedFiles: files.length,
        businessLabel: model.businessLabel,
        descriptors,
        nowMs: now,
      });
      fileToken = signed.token;
      tokenExpiresAt = F.isoSeconds(signed.expiresAt);
      tokenParts = { n: files.length, e: Math.floor(signed.expiresAt.getTime() / 1000), f: descriptors };
    }
    await B.saveForm({ action, ref, date, values: result.values, attribution: envelope.attribution, files, mode });
    const email = R.briefEmail(model, pack.missingLines, attachments.map((a) => a.filename));
    try {
      await M.send({ ...email, replyTo: result.values.email, attachments }, { ref, label: 'brief', date });
    } catch (error) {
      return mailErrorReply(reply, error);
    }
    response = { ok: true, ref, sent: true, mode, fileToken, expectedFiles: files.length, tokenExpiresAt };
  }

  if (dedupeKey) await L.rememberShared(dedupeKey, rememberable(response, tokenParts), now);
  return reply.success(response);
}

/* ------------------------------------------------------------------ one file */

const BASE64_CHARS = /^[A-Za-z0-9+/]*={0,2}$/;

function decodeStrictBase64(text) {
  if (typeof text !== 'string' || text.length === 0 || text.length % 4 !== 0 || !BASE64_CHARS.test(text)) return null;
  const bytes = Buffer.from(text, 'base64');
  return bytes.toString('base64') === text ? bytes : null;
}

async function handleFile(body, req, reply, ctx) {
  const data = H.parseJsonBody(body);
  if (!data) return reply.error(400, 'bad_request');
  if (data.schemaVersion !== S.SCHEMA_VERSION) return reply.error(400, 'bad_request');
  if (typeof data.attemptId !== 'string' || !ATTEMPT_PATTERN.test(data.attemptId)) return reply.error(400, 'bad_request');
  if (!K.tokenKey().key) return reply.error(503, 'mail_unavailable');

  const now = Date.now();
  const { ref, total } = data;
  if (K.isReference(ref)) ctx.log.ref = ref;
  const verified = K.verifyFileToken(data.fileToken, { ref, total, nowMs: now });
  if (!verified.ok) return reply.error(403, 'token');

  const sequence = { fields: { file: S.fileMessage('sequence') } };
  const { index } = data;
  if (!Number.isInteger(index) || index < 1 || index > total) return reply.error(422, 'validation', undefined, sequence);

  const checked = V.validateFileFields(data, index, `files.${index}`);
  if (checked.errors.length) return reply.error(422, 'validation', undefined, { fields: Object.fromEntries(checked.errors) });
  const file = checked.value;
  if (!K.sameString(K.fileDescriptor(file), verified.payload.f[index - 1])) {
    return reply.error(422, 'validation', undefined, sequence);
  }

  const bytes = decodeStrictBase64(data.dataBase64);
  if (!bytes || bytes.length !== file.size) {
    return reply.error(422, 'validation', undefined, { fields: { file: S.genericMessage('invalid') } });
  }
  const sniffed = S.sniffFileType(bytes);
  if (!sniffed || !S.sameFileFamily(sniffed.mime, file.type)) {
    return reply.error(422, 'validation', undefined, { fields: { file: S.fileMessage('mismatch') } });
  }

  const dedupeKey = `file|${ref}|${index}|${data.attemptId}`;
  const prior = await L.recallShared(dedupeKey, now);
  if (prior) return reply.success({ ...prior, duplicate: true });
  const limited = await L.takeShared(L.checksFor('file', K.hashClient(H.clientIp(req)), { ref, index }), now);
  if (!limited.ok) {
    return reply.error(429, 'rate_limited', { 'Retry-After': String(limited.retryAfter) }, { retryAfter: limited.retryAfter });
  }

  const typeDef = S.fileTypeByMime(file.type);
  const savedAs = F.savedAs(file, typeDef);
  const email = R.fileEmail({
    ref,
    businessLabel: verified.payload.b,
    index,
    total,
    file,
    typeDef,
    savedAs,
    sha256Actual: crypto.createHash('sha256').update(bytes).digest('hex'),
  });
  const date = new Date(now);
  const sha256Actual = crypto.createHash('sha256').update(bytes).digest('hex');
  await B.saveFileMeta({ ref, date, index, total, file, savedAs, sha256Actual });
  try {
    await M.send(
      { ...email, attachments: [{ filename: savedAs, content: bytes, contentType: file.type }] },
      { ref, label: `file-${F.pad2(index)}`, date },
    );
  } catch (error) {
    return mailErrorReply(reply, error);
  }
  const response = { ok: true, ref, index, sent: true, mode: M.mailMode() };
  await L.rememberShared(dedupeKey, response, now);
  return reply.success(response);
}

/* ------------------------------------------------------------------ entry */

function readAction(rawUrl) {
  try {
    return new URL(rawUrl || '/', 'http://localhost').searchParams.get(ACTION_PARAM);
  } catch {
    return null;
  }
}

async function handle(req, res, ctx) {
  const action = readAction(req.url);
  ctx.log.action = action === null ? '-' : ACTIONS.includes(action) ? action : 'other';

  if (req.method === 'GET') return health(res, ctx.allowed, ctx.log);
  if (req.method === 'OPTIONS') return preflight(res, ctx.allowed, ctx.log);

  const kind = H.contentKind(req.headers['content-type']);
  ctx.native = req.method === 'POST' && kind === 'form' && (action === 'contact' || action === 'brief');
  ctx.form = action === 'brief' ? 'brief' : 'contact';
  const reply = replier(res, ctx);

  if (req.method !== 'POST') return reply.error(405, 'method', { Allow: 'GET, POST, OPTIONS' });
  if (!ctx.allowed) return reply.error(403, 'origin');
  if (!ACTIONS.includes(action)) return reply.error(400, 'bad_request');
  if (kind === 'other' || (kind === 'form' && action === 'file')) return reply.error(415, 'bad_request');
  if (!M.availability().ok) return reply.error(503, 'mail_unavailable');

  const cap = CAPS[`${action}${kind === 'json' ? 'Json' : 'Urlencoded'}`];
  const body = await H.readBody(req, cap);
  const closeHeader = body.close ? { Connection: 'close' } : undefined;
  if (body.error === 'too_large') return reply.error(413, 'too_large', closeHeader);
  if (body.error) return reply.error(400, 'bad_request', closeHeader);

  if (action === 'file') return handleFile(body, req, reply, ctx);
  return handleForm(action, kind, body, req, reply, ctx);
}

module.exports = async function mtcwHandler(req, res) {
  const started = Date.now();
  const sink = M.mailMode() === 'sink';
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : null;
  const ctx = {
    sink,
    allowed: H.isAllowedOrigin(origin, sink) ? origin : null,
    native: false,
    form: 'contact',
    log: { action: '-', status: 0, error: null, ref: null },
  };
  try {
    await handle(req, res, ctx);
  } catch (error) {
    ctx.log.status = 500;
    ctx.log.error = 'server';
    ctx.log.fault = error && error.name ? String(error.name) : 'Error';
    if (!res.headersSent) {
      if (ctx.native) H.sendHtml(res, 500, N.failurePage(ctx.form, ctx.allowed, ctx.sink), ctx.allowed);
      else H.sendJson(res, 500, { ok: false, error: 'server' }, ctx.allowed);
    } else if (!res.writableEnded) {
      res.end();
    }
  } finally {
    const { action, status, error, ref, fault } = ctx.log;
    console.log(
      `[mtcw] action=${action} status=${status} error=${error || '-'} ref=${ref || '-'} ms=${Date.now() - started}${
        fault ? ` fault=${fault}` : ''
      }`,
    );
  }
};
