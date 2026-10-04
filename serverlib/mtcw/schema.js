'use strict';

// Typed-ish access to the shared form schema for the function. The JSON is a byte-identical copy of
// shared/form-schema.json (npm run sync:form-schema); every limit, option, label and message comes from it, so the
// browser and the function agree. Mirrors the relevant parts of src/lib/forms.ts.

const schema = require('./form-schema.json');

const SCHEMA_VERSION = schema.schemaVersion;
const NOT_SUPPLIED = schema.text.notSupplied;

function formDef(form) {
  return form === 'contact' ? schema.contact : schema.brief;
}

function fieldsOf(form) {
  return formDef(form).fields;
}

function getField(form, key) {
  const field = formDef(form).fields.find((f) => f.key === key);
  if (!field) throw new Error(`mtcw schema: the ${form} form has no field "${key}"`);
  return field;
}

function enumDef(name) {
  const def = schema.enums[name];
  if (!def) throw new Error(`mtcw schema: unknown option list "${name}"`);
  return def;
}

/**
 * Options of a list. Dynamic lists (priorityOffering, referencePreferred) get one option per kept item of their
 * group first ('offering-<n>' / 'reference-<n>', n = 1-based kept position), labelled from the item, then the fixed
 * options. `items` are the VALIDATED kept items of that group; `usable(item)` says whether an item may be chosen.
 */
function enumOptions(name, values) {
  const def = enumDef(name);
  if (!def.dynamic || !values) return def.options;
  const items = Array.isArray(values[def.dynamic.fromGroup]) ? values[def.dynamic.fromGroup] : [];
  const dynamic = [];
  items.forEach((item, i) => {
    const label = item && item[def.dynamic.labelFromItem];
    if (typeof label === 'string' && label !== '') {
      dynamic.push({ value: `${def.dynamic.valuePrefix}${i + 1}`, label });
    }
  });
  return [...dynamic, ...def.options];
}

function optionLabel(name, value, values) {
  const option = enumOptions(name, values).find((o) => o.value === value);
  return option ? option.label : null;
}

function enumValues(name) {
  return enumDef(name).options.map((o) => o.value);
}

/** Fill {max} (en-GB thousands separators) and {n}. */
function formatMessage(template, vars) {
  const v = vars || {};
  return String(template)
    .replace(/\{max\}/g, v.max === undefined ? '{max}' : Number(v.max).toLocaleString('en-GB'))
    .replace(/\{n\}/g, v.n === undefined ? '{n}' : String(v.n));
}

/** A field's (or group item's) message for an error kind, falling back to the generic wording. */
function fieldMessage(field, kind, vars) {
  const v = vars || {};
  const own = field.errors && field.errors[kind];
  const generic = schema.messages.generic;
  let fallback = generic[kind];
  if (fallback === undefined) fallback = kind === 'exclusive' ? generic.invalidOption : generic.invalid;
  let max = v.max;
  if (max === undefined && kind === 'tooLong') max = field.maxLength !== undefined ? field.maxLength : field.itemMaxLength;
  if (max === undefined && kind === 'tooMany') max = field.maxItems;
  return formatMessage(own || fallback, { max, n: v.n });
}

function fileMessage(kind, vars) {
  return formatMessage(schema.messages.files[kind], vars);
}

function genericMessage(kind, vars) {
  return formatMessage(schema.messages.generic[kind], vars);
}

/* ------------------------------------------------------------------ files */

function fileTypeByMime(mime) {
  return schema.files.types.find((t) => t.mime === mime) || null;
}

/** Lower-case extension with the dot ('.jpg'), or ''. */
function fileExtension(name) {
  const base = String(name).split(/[\\/]/).pop() || '';
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot).toLowerCase();
}

/** The name without its extension. */
function fileStem(name) {
  const base = String(name).split(/[\\/]/).pop() || '';
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? base : base.slice(0, dot);
}

function isAcceptedExtension(name) {
  const ext = fileExtension(name);
  return ext !== '' && schema.files.types.some((t) => t.extensions.includes(ext));
}

function sameFileFamily(a, b) {
  if (a === b) return true;
  const ta = fileTypeByMime(a);
  const tb = fileTypeByMime(b);
  return ta !== null && tb !== null && ta.family === tb.family;
}

function bytesAt(bytes, offset, length) {
  if (offset < 0 || offset + length > bytes.length) return null;
  return bytes.subarray(offset, offset + length);
}

function asciiAt(bytes, offset, length) {
  const slice = bytesAt(bytes, offset, length);
  return slice ? String.fromCharCode(...slice) : null;
}

function magicMatches(bytes, magic) {
  if (magic.hex !== undefined) {
    const expected = Buffer.from(magic.hex, 'hex');
    const actual = bytesAt(bytes, magic.offset, expected.length);
    return actual !== null && Buffer.compare(Buffer.from(actual), expected) === 0;
  }
  return asciiAt(bytes, magic.offset, magic.ascii.length) === magic.ascii;
}

/** ISO BMFF ftyp compatible brands (4-byte entries from offset 16 to the box size), capped at 64 bytes. */
function compatibleBrands(bytes) {
  if (bytes.length < 16) return [];
  const size = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  const end = Math.min(size, bytes.length, 64);
  const brands = [];
  for (let offset = 16; offset + 4 <= end; offset += 4) {
    const brand = asciiAt(bytes, offset, 4);
    if (brand) brands.push(brand);
  }
  return brands;
}

/** Identify bytes by content (files._sniffRule). Returns the accepted type or null. Never trusts a declared type. */
function sniffFileType(input) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const head = bytes.subarray(0, 64);
  for (const type of schema.files.types) {
    if (!type.magic.every((m) => magicMatches(head, m))) continue;
    if (type.majorBrands) {
      const major = asciiAt(head, 8, 4);
      if (major === null || !type.majorBrands.includes(major)) continue;
      const reject = type.rejectCompatibleBrands || [];
      if (reject.length > 0 && compatibleBrands(head).some((b) => reject.includes(b))) continue;
    }
    return type;
  }
  return null;
}

module.exports = {
  schema,
  SCHEMA_VERSION,
  NOT_SUPPLIED,
  fieldsOf,
  getField,
  enumDef,
  enumOptions,
  enumValues,
  optionLabel,
  formatMessage,
  fieldMessage,
  fileMessage,
  genericMessage,
  fileTypeByMime,
  fileExtension,
  fileStem,
  isAcceptedExtension,
  sameFileFamily,
  sniffFileType,
};
