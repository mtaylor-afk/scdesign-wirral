'use strict';

// Small formatting helpers shared by the emails and the build pack (FORMS-CONTRACT sections 4-7).

const T = require('./text');
const S = require('./schema');

const SEP = ` ${T.MIDDOT} `;
const SUBJECT_TEXT_MAX = 60;

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** '2026-10-03 14:05 UTC' */
function receivedText(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${pad2(date.getUTCHours())}:${pad2(
    date.getUTCMinutes(),
  )} UTC`;
}

/** '2026-10-03T14:05:09Z' (no milliseconds) */
function isoSeconds(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** '2026-10-03' */
function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

/** '2.1 MB' (bytes / 1,000,000 to one decimal place); 'less than 0.1 MB' instead of a misleading '0.0 MB'. */
function megabytes(bytes) {
  if (bytes > 0 && bytes < 50000) return 'less than 0.1 MB';
  return `${(bytes / 1000000).toFixed(1)} MB`;
}

/** '2,100,000 bytes' */
function bytesText(bytes) {
  return `${Number(bytes).toLocaleString('en-GB')} bytes`;
}

function attemptTag(attemptId) {
  return typeof attemptId === 'string' && attemptId !== ''
    ? attemptId.slice(0, S.schema.attemptId.subjectTagLength)
    : 'no-js';
}

/** 'from=websites, area=wirral (allowlisted link parameters only)' or 'none' */
function attributionText(attribution) {
  const order = Object.keys(S.schema.attribution.params);
  const parts = order.filter((k) => attribution && attribution[k]).map((k) => `${k}=${attribution[k]}`);
  return parts.length ? `${parts.join(', ')} (allowlisted link parameters only)` : 'none';
}

/** A customer value placed in a subject: single line, cut to 60 code points. */
function subjectText(value) {
  return T.cut(T.sanitiseSingleLine(value), SUBJECT_TEXT_MAX);
}

function contactSubject(ref, values, tag) {
  const parts = [ref, 'Quick message', subjectText(values.name)];
  if (values.businessName) parts.push(subjectText(values.businessName));
  parts.push(`#${tag}`);
  return parts.join(SEP);
}

function briefSubject(ref, businessName, fileCount, tag) {
  const parts = [ref, 'Website brief', subjectText(businessName)];
  if (fileCount === 1) parts.push('1 file to follow');
  else if (fileCount > 1) parts.push(`${fileCount} files to follow`);
  parts.push(`#${tag}`);
  return parts.join(SEP);
}

function kindWord(typeDef) {
  return typeDef && typeDef.kind === 'document' ? 'File' : 'Photo';
}

/** The subject of one file's email (also listed in the brief email and asset-manifest.json). */
function fileSubject(ref, index, total, typeDef, businessLabel) {
  return [ref, `${kindWord(typeDef)} ${index} of ${total}`, subjectText(businessLabel)].join(SEP);
}

/** '<NN>-<role or file>-<name-slug><canonical extension of the declared type>' */
function savedAs(file, typeDef) {
  const stem = T.slugify(S.fileStem(file.name), 'file');
  return `${pad2(file.index)}-${file.role || 'file'}-${stem}${typeDef.canonicalExtension}`;
}

function packBaseName(businessName, ref, date) {
  return `website-build-pack_${T.slugify(businessName, 'business')}_${isoDate(date)}_${ref.slice(-4).toLowerCase()}_v01`;
}

module.exports = {
  SEP,
  pad2,
  receivedText,
  isoSeconds,
  isoDate,
  megabytes,
  bytesText,
  attemptTag,
  attributionText,
  subjectText,
  contactSubject,
  briefSubject,
  kindWord,
  fileSubject,
  savedAs,
  packBaseName,
};
