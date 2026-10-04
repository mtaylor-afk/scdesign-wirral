'use strict';

// No-JavaScript posts (FORMS-CONTRACT section 8): urlencoded field names -> the same answers object as JSON, and the
// small accessible HTML pages the function answers native posts with (lang en-GB, no scripts, no external resources,
// strict CSP set in http.js, a link back to the site).

const S = require('./schema');
const T = require('./text');

const MAX_POSITION = 20;
const TRUE_VALUES = new Set(['yes', 'on', 'true']);

/**
 * Turn urlencoded pairs into { schemaVersion, attemptId, honeypot, attribution, answers }.
 * First occurrence of a non-list name wins; checkboxes repeat their name; groups use key.n.item and lists key.n;
 * unknown names are ignored.
 */
function nativeToBody(form, pairs) {
  const first = new Map();
  const all = new Map();
  for (const [name, value] of pairs) {
    if (!all.has(name)) all.set(name, []);
    all.get(name).push(value);
    if (!first.has(name)) first.set(name, value);
  }
  const answers = {};
  for (const field of S.fieldsOf(form)) {
    const key = field.key;
    if (field.type === 'files') continue;
    if (field.type === 'checkboxes') {
      if (all.has(key)) answers[key] = all.get(key);
    } else if (field.type === 'checkbox') {
      if (first.has(key)) {
        const raw = first.get(key);
        answers[key] = TRUE_VALUES.has(raw.trim().toLowerCase()) ? true : raw;
      } else {
        answers[key] = false;
      }
    } else if (field.type === 'urlList') {
      const list = [];
      for (let n = 1; n <= MAX_POSITION; n += 1) if (first.has(`${key}.${n}`)) list.push(first.get(`${key}.${n}`));
      answers[key] = list;
    } else if (field.type === 'group') {
      const items = [];
      for (let n = 1; n <= MAX_POSITION; n += 1) {
        const item = {};
        let present = false;
        for (const it of field.items) {
          const name = `${key}.${n}.${it.key}`;
          if (first.has(name)) {
            item[it.key] = first.get(name);
            present = true;
          }
        }
        if (present) items.push(item);
      }
      answers[key] = items;
    } else if (first.has(key)) {
      answers[key] = first.get(key);
    }
  }
  const attribution = {};
  for (const param of Object.keys(S.schema.attribution.params)) {
    if (first.has(`attr_${param}`)) attribution[param] = first.get(`attr_${param}`);
  }
  return {
    schemaVersion: first.has('schemaVersion') ? first.get('schemaVersion') : undefined,
    attemptId: first.has('attemptId') ? first.get('attemptId') : undefined,
    honeypot: first.has(S.schema.honeypot.field) ? first.get(S.schema.honeypot.field) : undefined,
    attribution,
    answers,
  };
}

/** A readable label for an error path (offerings.2.name -> "Service or product 2 (Service or product name)"). */
function labelForPath(form, path) {
  const [key, n, itemKey] = path.split('.');
  if (key === S.schema.files.field) return S.getField('brief', 'files').label;
  const field = S.fieldsOf(form).find((f) => f.key === key);
  if (!field) return path;
  if (n === undefined) return field.label;
  const itemLabel = field.itemLabel ? S.formatMessage(field.itemLabel, { n: Number(n) }) : `${field.label} ${n}`;
  if (itemKey === undefined || !field.items) return itemLabel;
  const item = field.items.find((it) => it.key === itemKey);
  const inner = item ? S.formatMessage(item.label, { n: Number(n) }) : itemKey;
  return inner === itemLabel ? itemLabel : `${itemLabel} (${inner})`;
}

/* ------------------------------------------------------------------ pages */

const DEV_NOTICE = "Development mode: this went to a local mail sink, not to Matt's inbox.";
const CONTACT_THANKS_BODY =
  "We'll review the details and get in touch about your website. No order, subscription or meeting has been confirmed by submitting the form.";

/** Where the "back" link goes: the preview's /MTCW/ base on scdesignwirral.co.uk, the origin's root elsewhere. */
function homeHref(origin) {
  if (!origin) return null;
  return origin === 'https://scdesignwirral.co.uk' ? `${origin}/MTCW/` : `${origin}/`;
}

function page({ heading, paragraphs = [], list = [], origin, sink }) {
  const href = homeHref(origin);
  const body = [
    sink ? `<p class="dev">${T.escapeHtml(DEV_NOTICE)}</p>` : '',
    `<h1>${T.escapeHtml(heading)}</h1>`,
    ...paragraphs.map((p) => `<p>${T.escapeHtml(p)}</p>`),
    list.length ? `<ul>${list.map((item) => `<li>${T.escapeHtml(item)}</li>`).join('')}</ul>` : '',
    href ? `<p><a href="${T.escapeHtml(href)}">Back to the MT Creative Works website</a></p>` : '',
  ].join('');
  return (
    '<!doctype html><html lang="en-GB"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer">' +
    `<title>${T.escapeHtml(heading)}</title>` +
    '<style>body{margin:0;padding:2rem 1rem;font-family:system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
    'font-size:1.0625rem;line-height:1.55;color:#1d1d1f;background:#fff}main{max-width:40rem;margin:0 auto}' +
    'h1{font-size:1.75rem;line-height:1.2;margin:0 0 1rem}a{color:#0852d4}li{margin:.25rem 0}' +
    '.dev{padding:.75rem 1rem;border:1px solid #86868b;border-radius:10px;font-size:.9375rem}</style>' +
    `</head><body><main>${body}</main></body></html>`
  );
}

function contactSuccessPage(ref, origin, sink) {
  return page({ heading: 'Thanks — your enquiry has been sent.', paragraphs: [CONTACT_THANKS_BODY, `Your reference: ${ref}`], origin, sink });
}

function briefSuccessPage(ref, origin, sink) {
  return page({
    heading: 'Thank you — your website brief has been received.',
    paragraphs: [
      'Matt will review what you have sent and contact you using your reply details.',
      `Your reference: ${ref}`,
      "Photos and files can't be sent from this page without JavaScript. When Matt replies, you can attach them to your reply.",
    ],
    origin,
    sink,
  });
}

function validationPage(form, errors, origin, sink) {
  return page({
    heading: 'Your form has not been sent yet',
    list: Object.entries(errors).map(([path, message]) => `${labelForPath(form, path)}: ${message}`),
    paragraphs: ["Go back to the form to correct these. Your browser's Back button usually keeps your answers."],
    origin,
    sink,
  });
}

function rateLimitPage(origin, sink) {
  return page({ heading: "We couldn't send another enquiry just now. Please try again later.", origin, sink });
}

function failurePage(form, origin, sink) {
  return page({
    heading: form === 'brief' ? "Your brief hasn't been sent. Please try again." : "Your enquiry hasn't been sent. Please try again.",
    origin,
    sink,
  });
}

module.exports = {
  DEV_NOTICE,
  nativeToBody,
  labelForPath,
  homeHref,
  contactSuccessPage,
  briefSuccessPage,
  validationPage,
  rateLimitPage,
  failurePage,
};
