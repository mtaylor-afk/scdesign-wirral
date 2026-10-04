'use strict';

// Text rules for the MT Creative Works forms function (shared/form-schema.json "text" block).
// A CommonJS mirror of src/server/enquiry-schema.ts (sanitiseSingleLine, sanitiseMultiLine, isValidEmail,
// isValidPhone, normaliseWebsite) so the function never imports site or SC code. Never fetches anything.
//
// Character classes are built from code points so this file contains no invisible characters and no escape
// sequences that tooling might decode.

const ch = (code) => String.fromCodePoint(code);
const span = (from, to) => `${ch(from)}-${ch(to)}`;

/** C0 controls except tab, LF and CR; DEL; C1 controls. */
const CONTROL = new RegExp(`[${span(0x00, 0x08)}${ch(0x0b)}${ch(0x0c)}${span(0x0e, 0x1f)}${span(0x7f, 0x9f)}]`, 'g');

/** Bidi embeddings/overrides/isolates and invisible formatting. ZWJ/ZWNJ are kept (some scripts need them). */
const INVISIBLE = new RegExp(
  `[${span(0x202a, 0x202e)}${span(0x2066, 0x2069)}${ch(0x200b)}${ch(0x2060)}${ch(0xfeff)}${ch(0x00ad)}]`,
  'g',
);

/** Every kind of line break, including NEL and the Unicode line and paragraph separators. */
const LINE_BREAKS = new RegExp(
  `${ch(0x0d)}${ch(0x0a)}|[${ch(0x0d)}${ch(0x0a)}${ch(0x0b)}${ch(0x0c)}${ch(0x85)}${ch(0x2028)}${ch(0x2029)}]`,
  'g',
);
const TAB = new RegExp(ch(0x09), 'g');
const NEWLINE = ch(0x0a);

const MIDDOT = ch(0xb7);
const ELLIPSIS = ch(0x2026);
const EM_DASH = ch(0x2014);

/** Number of Unicode code points. */
function charLength(value) {
  return [...value].length;
}

/** One-line answer: NFC, line breaks/tabs to spaces, controls and invisibles removed, whitespace collapsed, trimmed. */
function sanitiseSingleLine(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFC')
    .replace(LINE_BREAKS, ' ')
    .replace(TAB, ' ')
    .replace(CONTROL, '')
    .replace(INVISIBLE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Multi-line answer: NFC, line breaks to LF, controls/invisibles removed, trailing spaces per line, 3+ breaks to 2. */
function sanitiseMultiLine(value) {
  if (typeof value !== 'string') return '';
  const lines = value
    .normalize('NFC')
    .replace(LINE_BREAKS, NEWLINE)
    .replace(TAB, ' ')
    .replace(CONTROL, '')
    .replace(INVISIBLE, '')
    .split(NEWLINE)
    .map((line) => line.replace(/\s+$/, ''));
  return lines
    .join(NEWLINE)
    .replace(new RegExp(`${NEWLINE}{3,}`, 'g'), `${NEWLINE}${NEWLINE}`)
    .trim();
}

const EMAIL_MAX = 254;
const EMAIL_LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const TLD = /^(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})$/;

/**
 * A deliberately plain address check (the address may become Reply-To, so anything that could smuggle a second
 * address or a header is refused): dot-atom local part, one '@', a dotted DNS host with an alphabetic or punycode
 * top-level label. No quoted local parts, comments, spaces, commas, angle brackets, CR/LF or IP literals.
 */
function isValidEmail(value) {
  if (typeof value !== 'string' || value.length > EMAIL_MAX) return false;
  const at = value.lastIndexOf('@');
  if (at <= 0 || at !== value.indexOf('@')) return false;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length > 64 || !EMAIL_LOCAL.test(local)) return false;
  if (domain.length > 253) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  if (!labels.every((label) => DOMAIN_LABEL.test(label))) return false;
  return TLD.test(labels[labels.length - 1] || '');
}

const PHONE_CHARS = /^[0-9+()\s.-]+$/;

/** Digits, spaces, + ( ) . - only; '+' only first; 7-15 digits. No rigid UK-only pattern. */
function isValidPhone(value) {
  if (typeof value !== 'string' || !PHONE_CHARS.test(value)) return false;
  if (value.indexOf('+') > 0) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= 7 && digits <= 15;
}

const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):/;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * Normalise a typed website address WITHOUT fetching it. Returns {ok:true, value} ('' for blank) or
 * {ok:false, reason:'invalid'|'too-long'}.
 *   'yourbusiness.co.uk' -> 'https://yourbusiness.co.uk/'   'http://example.com' -> 'http://example.com/'
 *   '//example.com/x' -> 'https://example.com/x'
 * Refused: schemes other than http/https (javascript:, data:, file:, vbscript:, mailto:, ftp:...), spaces,
 * user:password@, IP addresses, single-label hosts (localhost), malformed hosts; over maxLength before or after
 * normalising.
 */
function normaliseWebsite(input, maxLength) {
  const text = sanitiseSingleLine(input);
  if (text === '') return { ok: true, value: '' };
  if (charLength(text) > maxLength) return { ok: false, reason: 'too-long' };
  if (/\s/.test(text)) return { ok: false, reason: 'invalid' };

  let candidate;
  const schemeMatch = SCHEME.exec(text);
  const scheme = schemeMatch ? schemeMatch[1] : undefined;
  if (text.startsWith('//')) {
    candidate = `https:${text}`;
  } else if (scheme && !scheme.includes('.')) {
    const lower = scheme.toLowerCase();
    if ((lower !== 'http' && lower !== 'https') || !text.slice(scheme.length + 1).startsWith('//')) {
      return { ok: false, reason: 'invalid' };
    }
    candidate = text;
  } else {
    candidate = `https://${text}`;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { ok: false, reason: 'invalid' };
  if (parsed.username !== '' || parsed.password !== '') return { ok: false, reason: 'invalid' };

  const host = parsed.hostname;
  if (host === '' || host.startsWith('[') || IPV4.test(host)) return { ok: false, reason: 'invalid' };
  const labels = host.replace(/\.$/, '').split('.');
  if (labels.length < 2) return { ok: false, reason: 'invalid' };
  if (!labels.every((label) => DOMAIN_LABEL.test(label))) return { ok: false, reason: 'invalid' };
  if (!TLD.test(labels[labels.length - 1] || '')) return { ok: false, reason: 'invalid' };

  const value = parsed.href;
  if (charLength(value) > maxLength) return { ok: false, reason: 'too-long' };
  return { ok: true, value };
}

/** Cut to at most `max` code points; a cut value ends with an ellipsis (counted in `max`). */
function cut(value, max) {
  const chars = [...value];
  if (chars.length <= max) return value;
  return `${chars.slice(0, Math.max(0, max - 1)).join('')}${ELLIPSIS}`;
}

/** Header-safe single line: never contains CR or LF (defence in depth on top of sanitiseSingleLine). */
function noCRLF(value) {
  return value == null ? '' : String(value).replace(/[\r\n]+/g, ' ');
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape text for HTML element content and attribute values. */
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

const COMBINING = new RegExp(`[${span(0x300, 0x36f)}]`, 'g');

/**
 * The slug rule (FORMS-CONTRACT section 6): NFKD, drop combining marks, lower case, '&' -> ' and ', runs outside
 * [a-z0-9] -> '-', trim '-', first 40 characters, trim a trailing '-' again, fallback when empty.
 */
function slugify(value, fallback) {
  const slug = String(value == null ? '' : value)
    .normalize('NFKD')
    .replace(COMBINING, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug === '' ? fallback : slug;
}

/** True when the text is empty after single-line sanitising. */
function isBlank(value) {
  return sanitiseSingleLine(value) === '';
}

module.exports = {
  MIDDOT,
  ELLIPSIS,
  EM_DASH,
  EMAIL_MAX,
  charLength,
  sanitiseSingleLine,
  sanitiseMultiLine,
  isValidEmail,
  isValidPhone,
  normaliseWebsite,
  cut,
  noCRLF,
  escapeHtml,
  slugify,
  isBlank,
};
