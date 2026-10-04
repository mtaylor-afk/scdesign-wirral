'use strict';

// The accepted brief as one deterministic model, from which the brief email, private-contact.txt and every build-pack
// file are rendered. Same validated answers + same reference + same time = same output bytes.

const S = require('./schema');
const T = require('./text');
const F = require('./format');

const BUSINESS_LABEL_MAX = S.schema.limits.fileToken.businessLabelMaxLength;

/**
 * @param {{ref:string, date:Date, values:object, files:object[], conflicts:object[], attribution:object,
 *          attemptId:string|null, mode:'smtp'|'sink'}} input
 */
function buildBriefModel(input) {
  const { ref, date, values, conflicts, attribution, attemptId, mode } = input;
  const total = input.files.length;
  const businessLabel = T.cut(values.businessName, BUSINESS_LABEL_MAX);
  const files = input.files.map((file) => {
    const typeDef = S.fileTypeByMime(file.type);
    return {
      ...file,
      typeDef,
      of: total,
      roleLabel: file.role ? S.optionLabel('fileRole', file.role) : null,
      savedAs: F.savedAs(file, typeDef),
      emailSubject: F.fileSubject(ref, file.index, total, typeDef, businessLabel),
    };
  });
  const packBase = F.packBaseName(values.businessName, ref, date);
  return {
    ref,
    date,
    receivedText: F.receivedText(date),
    receivedIso: F.isoSeconds(date),
    schemaVersion: S.SCHEMA_VERSION,
    values,
    files,
    conflicts: conflicts || [],
    attribution: attribution || {},
    attemptTag: F.attemptTag(attemptId),
    mode,
    businessLabel,
    packBase,
    packName: `${packBase}.zip`,
  };
}

module.exports = { buildBriefModel };
