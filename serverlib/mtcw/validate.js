'use strict';

// Server-side validation for both forms (FORMS-CONTRACT sections 4, 5 and 7). The function is authoritative: every
// limit, option and message comes from the schema; over-limit answers are REJECTED with the schema's message, never
// truncated. Values are sanitised (text rules), website addresses normalised without fetching.
//
// Validated value shapes: text -> string ('' when blank); radio/select -> option value or '' (unanswered; contact
// selects take their default); checkboxes -> array of option values in option order; checkbox -> boolean;
// urlList -> array of normalised addresses (kept entries only); group -> array of kept item objects.

const S = require('./schema');
const T = require('./text');

const { schema } = S;

function own(obj, key) {
  return obj !== null && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !Buffer.isBuffer(value);
}

/** "Filled" on VALIDATED values (lists hold only kept entries). */
function isFilledValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value !== '';
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.values(value).some(isFilledValue);
  return false;
}

/** Is a RAW value blank (missing, null, or text that sanitises to nothing)? Anything of another type is "filled". */
function isBlankRaw(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return T.sanitiseMultiLine(value) === '';
  return false;
}

/* ------------------------------------------------------------------ conditions */

function evaluateCondition(condition, ctx) {
  if (condition.anyOf) return condition.anyOf.some((c) => evaluateCondition(c, ctx));
  if (condition.allOf) return condition.allOf.every((c) => evaluateCondition(c, ctx));
  if (condition.files !== undefined) return (ctx.fileCount || 0) > 0;
  if (condition.sibling !== undefined) return isFilledValue(ctx.item ? ctx.item[condition.sibling] : undefined);
  const value = ctx.values[condition.field];
  if (own(condition, 'equals')) return value === condition.equals;
  if (own(condition, 'in')) return typeof value === 'string' && condition.in.includes(value);
  if (own(condition, 'includes')) return Array.isArray(value) && value.includes(condition.includes);
  return isFilledValue(value);
}

function isRequired(field, ctx) {
  if (field.required) return true;
  return field.requiredWhen ? evaluateCondition(field.requiredWhen, ctx) : false;
}

/** How a field's validated value reads in a sentence (labels for choices). */
function answerText(form, key, values) {
  const field = S.getField(form, key);
  const value = values[key];
  if (field.type === 'radio' || field.type === 'select') {
    return value ? S.optionLabel(field.options, value, values) || value : S.NOT_SUPPLIED;
  }
  if (field.type === 'checkboxes') {
    return Array.isArray(value) && value.length
      ? value.map((v) => S.optionLabel(field.options, v) || v).join('; ')
      : S.NOT_SUPPLIED;
  }
  if (field.type === 'checkbox') return value ? 'ticked' : 'not ticked';
  return typeof value === 'string' && value !== '' ? value : S.NOT_SUPPLIED;
}

/** Why a (false) showWhen condition is false, as short phrases. */
function describeFalse(form, condition, ctx) {
  if (condition.anyOf) return condition.anyOf.flatMap((c) => describeFalse(form, c, ctx));
  if (condition.allOf) {
    return condition.allOf.filter((c) => !evaluateCondition(c, ctx)).flatMap((c) => describeFalse(form, c, ctx));
  }
  if (condition.files !== undefined) return ['no photos or files were included'];
  if (condition.field) {
    const label = S.getField(form, condition.field).label;
    return [`"${label}" was "${answerText(form, condition.field, ctx.values)}"`];
  }
  return [];
}

/* ------------------------------------------------------------------ per-type parsers */

/** text / email / tel / url / textarea (also group items and list entries). */
function parseText(field, raw, n) {
  if (raw === undefined || raw === null) return { value: '' };
  if (typeof raw !== 'string') return { value: '', error: S.fieldMessage(field, 'invalid', { n }), filled: true };
  const value = field.type === 'textarea' ? T.sanitiseMultiLine(raw) : T.sanitiseSingleLine(raw);
  if (value === '') return { value: '' };
  if (field.type === 'url') {
    const max = field.maxLength !== undefined ? field.maxLength : field.itemMaxLength;
    const result = T.normaliseWebsite(value, max);
    if (!result.ok) {
      return { value, error: S.fieldMessage(field, result.reason === 'too-long' ? 'tooLong' : 'invalid', { n }) };
    }
    return { value: result.value };
  }
  if (field.maxLength !== undefined && T.charLength(value) > field.maxLength) {
    return { value, error: S.fieldMessage(field, 'tooLong', { n }) };
  }
  if (field.type === 'email' && !T.isValidEmail(value)) return { value, error: S.fieldMessage(field, 'invalid', { n }) };
  if (field.type === 'tel' && !T.isValidPhone(value)) return { value, error: S.fieldMessage(field, 'invalid', { n }) };
  return { value };
}

/** radio / select (static or dynamic options). '' = unanswered (contact selects take their default). */
function parseChoice(field, raw, values) {
  const fallback = typeof field.default === 'string' ? field.default : '';
  if (raw === undefined || raw === null) return { value: fallback };
  if (typeof raw !== 'string') return { value: '', error: S.fieldMessage(field, 'invalid') };
  const value = T.sanitiseSingleLine(raw);
  if (value === '') return { value: fallback };
  const options = S.enumOptions(field.options, values);
  if (!options.some((o) => o.value === value)) return { value, error: S.fieldMessage(field, 'invalid') };
  return { value };
}

function parseCheckboxes(field, raw) {
  if (raw === undefined || raw === null) return { value: [] };
  if (!Array.isArray(raw)) return { value: [], error: S.fieldMessage(field, 'invalid') };
  const allowed = S.enumValues(field.options);
  const picked = [];
  for (const entry of raw) {
    if (entry === null || entry === undefined) continue;
    if (typeof entry !== 'string') return { value: picked, error: S.fieldMessage(field, 'invalid') };
    const value = T.sanitiseSingleLine(entry);
    if (value === '') continue;
    if (!allowed.includes(value)) return { value: picked, error: S.fieldMessage(field, 'invalid') };
    if (!picked.includes(value)) picked.push(value);
  }
  picked.sort((a, b) => allowed.indexOf(a) - allowed.indexOf(b));
  const exclusive = field.exclusive || [];
  if (picked.length > 1 && picked.some((v) => exclusive.includes(v))) {
    return { value: picked, error: S.fieldMessage(field, 'exclusive') };
  }
  return { value: picked };
}

function parseCheckbox(field, raw) {
  if (raw === undefined || raw === null) return { value: false };
  if (typeof raw !== 'boolean') return { value: false, error: S.fieldMessage(field, 'invalid') };
  return { value: raw };
}

/** urlList: blank entries dropped; positions renumbered 1..k; more than maxItems kept -> tooMany. */
function parseUrlList(field, raw) {
  if (raw === undefined || raw === null) return { value: [], errors: [] };
  if (!Array.isArray(raw)) return { value: [], errors: [[field.key, S.fieldMessage(field, 'invalid')]] };
  const kept = raw.filter((entry) => !isBlankRaw(entry));
  if (kept.length > field.maxItems) return { value: [], errors: [[field.key, S.fieldMessage(field, 'tooMany')]] };
  const errors = [];
  const value = kept.map((entry, i) => {
    const n = i + 1;
    const itemField = { ...field, type: 'url', maxLength: field.itemMaxLength };
    const result = parseText(itemField, entry, n);
    if (result.error) errors.push([`${field.key}.${n}`, result.error]);
    return result.value;
  });
  return { value, errors };
}

/** group: blank items dropped; positions renumbered; item fields validated; a filled item needs its required fields. */
function parseGroup(field, raw) {
  if (raw === undefined || raw === null) return { value: [], errors: [] };
  if (!Array.isArray(raw)) return { value: [], errors: [[field.key, S.fieldMessage(field, 'invalid')]] };
  const kept = [];
  for (const item of raw) {
    if (item === null || item === undefined) continue;
    if (!isPlainObject(item)) return { value: [], errors: [[field.key, S.fieldMessage(field, 'invalid')]] };
    if (field.items.some((it) => own(item, it.key) && !isBlankRaw(item[it.key]))) kept.push(item);
  }
  if (kept.length > field.maxItems) return { value: [], errors: [[field.key, S.fieldMessage(field, 'tooMany')]] };
  const errors = [];
  const value = kept.map((item, i) => {
    const n = i + 1;
    const out = {};
    for (const it of field.items) {
      const result = parseText(it, own(item, it.key) ? item[it.key] : undefined, n);
      out[it.key] = result.value;
      const path = `${field.key}.${n}.${it.key}`;
      if (result.error) errors.push([path, result.error]);
      else if (it.required && result.value === '') errors.push([path, S.fieldMessage(it, 'required', { n })]);
    }
    return out;
  });
  return { value, errors };
}

/* ------------------------------------------------------------------ files */

const FILES = schema.files;
const SHA256_PATTERN = new RegExp(FILES.sha256Pattern);
const ROLE_VALUES = S.enumValues('fileRole');

/**
 * The per-file rules shared by the brief's manifest and the file action. `prefix` is the error path prefix
 * ('files.<index>'). Returns {value, errors}.
 */
function validateFileFields(entry, index, prefix) {
  const errors = [];
  const at = (key) => `${prefix}.${key}`;
  const get = (key) => (own(entry, key) ? entry[key] : undefined);

  // name
  const rawName = get('name');
  const name = typeof rawName === 'string' ? T.sanitiseSingleLine(rawName) : '';
  if (name === '') errors.push([at('name'), S.fileMessage('name')]);
  else if (T.charLength(name) > FILES.nameMaxLength) errors.push([at('name'), S.fileMessage('nameTooLong', { max: FILES.nameMaxLength })]);
  else if (!S.isAcceptedExtension(name)) errors.push([at('name'), S.fileMessage('type')]);

  // type
  const type = get('type');
  const typeDef = typeof type === 'string' ? S.fileTypeByMime(type) : null;
  if (!typeDef) errors.push([at('type'), S.fileMessage('type')]);

  // size
  const size = get('size');
  if (!Number.isInteger(size) || size < 0) errors.push([at('size'), S.genericMessage('invalid')]);
  else if (size === 0) errors.push([at('size'), S.fileMessage('empty')]);
  else if (size > FILES.maxBytes) errors.push([at('size'), S.fileMessage('tooLarge')]);

  // resized / originalSize
  const rawResized = get('resized');
  let resized = false;
  if (rawResized !== undefined && rawResized !== null) {
    if (typeof rawResized !== 'boolean') errors.push([at('resized'), S.genericMessage('invalid')]);
    else resized = rawResized;
  }
  const rawOriginal = get('originalSize');
  let originalSize = Number.isInteger(size) ? size : 0;
  if (rawOriginal !== undefined && rawOriginal !== null) {
    if (!Number.isInteger(rawOriginal) || rawOriginal < 1) errors.push([at('originalSize'), S.genericMessage('invalid')]);
    else if (resized ? rawOriginal < size : rawOriginal !== size) errors.push([at('originalSize'), S.genericMessage('invalid')]);
    else originalSize = rawOriginal;
  } else if (resized) {
    errors.push([at('originalSize'), S.genericMessage('invalid')]);
  }

  // role
  const rawRole = get('role');
  let role = '';
  if (rawRole !== undefined && rawRole !== null) {
    const value = typeof rawRole === 'string' ? T.sanitiseSingleLine(rawRole) : null;
    if (value === null || (value !== '' && !ROLE_VALUES.includes(value))) errors.push([at('role'), S.fileMessage('role')]);
    else role = value;
  }

  // caption (single line) and extra context (multi-line)
  const rawCaption = get('caption');
  let caption = '';
  if (rawCaption !== undefined && rawCaption !== null) {
    if (typeof rawCaption !== 'string') errors.push([at('caption'), S.genericMessage('invalid')]);
    else {
      caption = T.sanitiseSingleLine(rawCaption);
      if (T.charLength(caption) > FILES.captionMaxLength) {
        errors.push([at('caption'), S.fileMessage('captionTooLong', { max: FILES.captionMaxLength })]);
      }
    }
  }
  const rawExtra = get('extraContext');
  let extraContext = '';
  if (rawExtra !== undefined && rawExtra !== null) {
    if (typeof rawExtra !== 'string') errors.push([at('extraContext'), S.genericMessage('invalid')]);
    else {
      extraContext = T.sanitiseMultiLine(rawExtra);
      if (T.charLength(extraContext) > FILES.extraContextMaxLength) {
        errors.push([at('extraContext'), S.fileMessage('extraContextTooLong', { max: FILES.extraContextMaxLength })]);
      }
    }
  }

  // sha256 (optional, as declared by the browser)
  const rawSha = get('sha256');
  let sha256 = null;
  if (rawSha !== undefined && rawSha !== null && rawSha !== '') {
    if (typeof rawSha !== 'string' || !SHA256_PATTERN.test(rawSha)) errors.push([at('sha256'), S.genericMessage('invalid')]);
    else sha256 = rawSha;
  }

  return {
    value: { index, name, type: typeDef ? typeDef.mime : '', typeDef, size, originalSize, resized, role, caption, extraContext, sha256 },
    errors,
  };
}

/** The brief's files manifest (rule 8). */
function validateManifest(raw) {
  if (raw === undefined || raw === null) return { files: [], errors: [], declared: 0 };
  if (!Array.isArray(raw)) return { files: [], errors: [[FILES.field, S.genericMessage('invalid')]], declared: 0 };
  const declared = raw.length;
  if (raw.length > FILES.maxFiles) {
    return { files: [], errors: [[FILES.field, S.fileMessage('tooMany', { max: FILES.maxFiles })]], declared };
  }
  for (let i = 0; i < raw.length; i += 1) {
    if (!isPlainObject(raw[i]) || raw[i].index !== i + 1) {
      return { files: [], errors: [[FILES.field, S.fileMessage('sequence')]], declared };
    }
  }
  const files = [];
  const errors = [];
  raw.forEach((entry, i) => {
    const result = validateFileFields(entry, i + 1, `${FILES.field}.${i + 1}`);
    files.push(result.value);
    errors.push(...result.errors);
  });
  return { files, errors, declared };
}

/* ------------------------------------------------------------------ forms */

/**
 * Validate one form's answers. `rawFiles` is the brief's manifest (ignored for the quick message).
 * Returns { ok, values, files, errors (path -> message, in field order), conflicts }.
 */
function validateForm(form, answers, rawFiles) {
  const fields = S.fieldsOf(form);
  const values = {};
  const fieldErrors = new Map();
  const manifest = form === 'brief' ? validateManifest(rawFiles) : { files: [], errors: [], declared: 0 };
  const fileCount = manifest.declared;

  // Pass 1: types, sanitising, limits, formats, options (dynamic options use the groups validated before them).
  for (const field of fields) {
    if (field.type === 'files') {
      fieldErrors.set(field.key, manifest.errors);
      continue;
    }
    const raw = own(answers, field.key) ? answers[field.key] : undefined;
    let result;
    switch (field.type) {
      case 'radio':
      case 'select':
        result = parseChoice(field, raw, values);
        break;
      case 'checkboxes':
        result = parseCheckboxes(field, raw);
        break;
      case 'checkbox':
        result = parseCheckbox(field, raw);
        break;
      case 'urlList':
        result = parseUrlList(field, raw);
        break;
      case 'group':
        result = parseGroup(field, raw);
        break;
      default:
        result = parseText(field, raw);
    }
    values[field.key] = result.value;
    const list = result.errors ? [...result.errors] : [];
    if (result.error) list.push([field.key, result.error]);
    fieldErrors.set(field.key, list);
  }

  // Pass 2: required / requiredWhen on the values exactly as received (nothing dropped because of showWhen).
  const ctx = { values, fileCount };
  for (const field of fields) {
    if (field.type === 'files') continue;
    const list = fieldErrors.get(field.key);
    if (list.some(([path]) => path === field.key)) continue;
    if (isRequired(field, ctx) && !isFilledValue(values[field.key])) {
      list.unshift([field.key, S.fieldMessage(field, 'required')]);
    }
  }

  // Conflicts: a follow-up answered while its showWhen is false is KEPT and reported (rule 7).
  const conflicts = [];
  for (const field of fields) {
    if (!field.showWhen || !isFilledValue(values[field.key])) continue;
    if (evaluateCondition(field.showWhen, ctx)) continue;
    const reasons = [...new Set(describeFalse(form, field.showWhen, ctx))];
    conflicts.push({ field: field.key, label: field.label, note: `answered although ${reasons.join(' and ')}` });
  }

  const errors = {};
  for (const field of fields) {
    for (const [path, message] of fieldErrors.get(field.key)) {
      if (!own(errors, path)) errors[path] = message;
    }
  }
  return { ok: Object.keys(errors).length === 0, values, files: manifest.files, errors, conflicts, fileCount };
}

/* ------------------------------------------------------------------ attribution */

/** Keep only allowlisted attribution parameters with allowlisted values; drop everything else silently. */
function parseAttribution(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [name, rule] of Object.entries(schema.attribution.params)) {
    if (!own(raw, name) || typeof raw[name] !== 'string') continue;
    const allowed = typeof rule.options === 'string' ? S.enumValues(rule.options) : rule.options;
    if (allowed.includes(raw[name])) out[name] = raw[name];
  }
  return out;
}

module.exports = {
  own,
  isPlainObject,
  isFilledValue,
  evaluateCondition,
  isRequired,
  answerText,
  validateForm,
  validateManifest,
  validateFileFields,
  parseAttribution,
};
