'use strict';

// One intermediate structure for every human-readable output (FORMS-CONTRACT sections 4-7), rendered to plain text
// and to escaped HTML, so the two never disagree.
//
// Row  = { label: string|null, lines: Line[], block?: true }
// Line = { text: string, indent?: number (extra spaces after the base indent), muted?: true }
// Text rule: a label that ends in '?' or a multi-line value goes on its own line with the value indented two spaces;
// otherwise 'Label: value'. A label written as a sentence (ending in '.', e.g. "I would like Matt to suggest a
// style.") is treated like a question, so it never reads "style.: Yes". Choices show their label; blanks show
// "Not supplied".
//
// HTML: every value goes through escapeHtml (no raw customer text), line breaks become separate blocks, "Not
// supplied" is grey, system font stack, no images, no remote content, no scripts.

const S = require('./schema');
const T = require('./text');
const F = require('./format');

const NS = S.NOT_SUPPLIED;
const FONT = "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const INK = '#1d1d1f';
const GREY = '#6e6e73';

/* ------------------------------------------------------------------ lines and rows */

function notSupplied(indent) {
  return { text: NS, indent: indent || 0, muted: true };
}

/** Lines for a (possibly multi-line) text value. */
function textLines(value, indent) {
  if (typeof value !== 'string' || value === '') return [notSupplied(indent)];
  return value.split('\n').map((text) => ({ text, indent: indent || 0 }));
}

function canInline(row) {
  return (
    row.label !== null &&
    !row.block &&
    !/[?.]$/.test(row.label) &&
    row.lines.length === 1 &&
    !(row.lines[0].indent > 0)
  );
}

/* ------------------------------------------------------------------ renderers */

function renderRowText(row) {
  if (canInline(row)) return [`${row.label}: ${row.lines[0].text}`];
  const out = row.label === null ? [] : [row.label];
  for (const line of row.lines) out.push(`${' '.repeat(2 + (line.indent || 0))}${line.text}`.replace(/\s+$/, ''));
  return out;
}

function renderRowsText(rows) {
  return rows.flatMap((row) => (row.spacer ? [''] : renderRowText(row)));
}

function htmlLine(line) {
  const pad = line.indent ? `padding-left:${(line.indent * 0.4).toFixed(1)}em;` : '';
  const colour = line.muted ? `color:${GREY};` : '';
  return `<div style="${pad}${colour}">${line.text === '' ? '&nbsp;' : T.escapeHtml(line.text)}</div>`;
}

function renderRowsHtml(rows) {
  const cells = rows
    .filter((row) => !row.spacer)
    .map((row) => {
      const value = row.lines.map(htmlLine).join('');
      if (row.label === null) {
        return `<tr><td colspan="2" style="padding:6px 0;vertical-align:top">${value}</td></tr>`;
      }
      return (
        `<tr><th scope="row" style="padding:6px 16px 6px 0;text-align:left;vertical-align:top;font-weight:600;width:38%">` +
        `${T.escapeHtml(row.label)}</th><td style="padding:6px 0;vertical-align:top">${value}</td></tr>`
      );
    })
    .join('');
  return `<table role="presentation" style="border-collapse:collapse;width:100%;font-size:14px;line-height:1.45">${cells}</table>`;
}

/** Paragraph lines (header/footer) as HTML. */
function paragraphsHtml(lines) {
  return lines
    .map((line) => (line === '' ? '' : `<p style="margin:0 0 6px">${T.escapeHtml(line)}</p>`))
    .join('');
}

function htmlDocument(title, inner) {
  return (
    '<!doctype html><html lang="en-GB"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<title>${T.escapeHtml(title)}</title></head>` +
    `<body style="margin:0;padding:24px;background:#ffffff;color:${INK};font-family:${FONT};font-size:15px;line-height:1.5">` +
    `<div style="max-width:760px">${inner}</div></body></html>`
  );
}

function sectionHtml(title, rows, note) {
  return (
    `<h2 style="font-size:17px;margin:24px 0 8px;padding-top:12px;border-top:1px solid #d2d2d7">${T.escapeHtml(title)}</h2>` +
    (note ? `<p style="margin:0 0 8px;color:${GREY};font-size:13px">${T.escapeHtml(note)}</p>` : '') +
    renderRowsHtml(rows)
  );
}

/* ------------------------------------------------------------------ field rows */

const PUBLIC_COPY_TEXT = {
  publicEmailFromReply: 'Yes - copied from the reply email when ticked; the address shown is exactly what will be used',
  publicPhoneFromReply: 'Yes - copied from the reply phone number when ticked; the number shown is exactly what will be used',
};

/** The row for one field's validated value. `conflict` = note text when the field is a conflict. */
function fieldRow(form, key, values, conflict) {
  const field = S.getField(form, key);
  const value = values[key];
  let lines;
  let block = false;
  switch (field.type) {
    case 'radio':
    case 'select':
      lines = value ? [{ text: S.optionLabel(field.options, value, values) || value }] : [notSupplied()];
      break;
    case 'checkboxes':
      lines = value.length ? value.map((v) => ({ text: `- ${S.optionLabel(field.options, v) || v}` })) : [notSupplied()];
      block = value.length > 0;
      break;
    case 'checkbox':
      lines = [{ text: value ? PUBLIC_COPY_TEXT[key] || 'Yes' : 'No' }];
      break;
    case 'urlList':
      lines = value.length ? value.map((url, i) => ({ text: `${i + 1}. ${url}` })) : [notSupplied()];
      block = value.length > 0;
      break;
    case 'group':
      lines = groupLines(field, value);
      block = value.length > 0;
      break;
    default:
      lines = textLines(value);
  }
  if (conflict) lines = [...lines, { text: `(${conflict})`, muted: true }];
  return { label: field.label, lines, block };
}

function groupLines(field, items) {
  if (!items.length) return [notSupplied()];
  const lines = [];
  items.forEach((item, i) => {
    const n = i + 1;
    if (field.key === 'offerings') {
      const description = item.description ? item.description.split('\n') : [NS];
      lines.push({ text: `${n}. ${item.name}: ${description[0]}` });
      for (const more of description.slice(1)) lines.push({ text: more, indent: 3 });
    } else if (field.key === 'faqs') {
      lines.push({ text: `${n}. Q: ${item.question}` });
      const answer = item.answer ? item.answer.split('\n') : [NS];
      lines.push({ text: `A: ${answer[0]}`, indent: 3 });
      for (const more of answer.slice(1)) lines.push({ text: more, indent: 6 });
    } else if (field.key === 'references') {
      const [urlItem, exclusionsItem] = field.items;
      lines.push({ text: `${S.formatMessage(urlItem.label, { n })}: ${item.url}` });
      lines.push({ text: exclusionsItem.label, indent: 2 });
      lines.push(...textLines(item.exclusions, 4));
    } else {
      for (const it of field.items) lines.push({ text: `${n}. ${it.label}: ${item[it.key] || NS}` });
    }
  });
  return lines;
}

/* ------------------------------------------------------------------ quick message (email a) */

const CONTACT_ROWS = ['name', 'email', 'phone', 'businessName', 'businessArea', 'interest', 'meetingPreference', 'town', 'website'];

function contactEmail(m) {
  const v = m.values;
  const subject = F.contactSubject(m.ref, v, m.attemptTag);
  const intro = [
    'Quick message from the MT Creative Works website',
    `Reference: ${m.ref}`,
    `Received: ${F.receivedText(m.date)}`,
    `Reply to this email to answer ${v.name} directly.`,
  ];
  const rows = CONTACT_ROWS.map((key) => fieldRow('contact', key, v));
  const messageRow = fieldRow('contact', 'message', v);
  const footer = [`Source: ${F.attributionText(m.attribution)}`, `Attempt #${m.attemptTag} ${T.MIDDOT} Schema ${S.SCHEMA_VERSION} ${T.MIDDOT} Mode ${m.mode}`];
  const text = [...intro, '', ...renderRowsText(rows), '', ...renderRowText(messageRow), '', '--', ...footer, ''].join('\n');
  const html = htmlDocument(
    subject,
    `<h1 style="font-size:20px;margin:0 0 8px">${T.escapeHtml(intro[0])}</h1>` +
      paragraphsHtml(intro.slice(1)) +
      renderRowsHtml([...rows, messageRow]) +
      `<hr style="border:0;border-top:1px solid #d2d2d7;margin:20px 0 8px">` +
      `<div style="color:${GREY};font-size:13px">${paragraphsHtml(footer)}</div>`,
  );
  return { subject, text, html };
}

/* ------------------------------------------------------------------ brief sections */

function stageName(stage) {
  const def = S.schema.brief.stages.find((s) => s.stage === stage);
  return def.name.replace(new RegExp(`\\s*${T.EM_DASH}\\s*optional$`), '');
}

function conflictFor(model, key) {
  const c = model.conflicts.find((x) => x.field === key);
  return c ? c.note : null;
}

function stageRows(model, stage, skip) {
  return S.schema.brief.fields
    .filter((f) => f.stage === stage && f.type !== 'files' && !(skip || []).includes(f.key))
    .map((f) => fieldRow('brief', f.key, model.values, conflictFor(model, f.key)));
}

function fileLines(model) {
  if (!model.files.length) return [{ label: null, lines: [{ text: 'No photos or files were included.' }] }];
  const captionLabel = S.schema.files.fields.find((f) => f.key === 'caption').label;
  const extraField = S.schema.files.fields.find((f) => f.key === 'extraContext');
  return model.files.map((file) => {
    const sizeText = file.resized
      ? `${F.megabytes(file.size)} as sent; resized in the browser from ${F.megabytes(file.originalSize)}`
      : F.megabytes(file.size);
    const role = file.roleLabel || 'intended use not given';
    const extraLabel = file.typeDef.kind === 'document' ? extraField.labelForDocument : extraField.label;
    const lines = [
      { text: `${file.index} of ${file.of}: ${file.name} -> save as ${file.savedAs} (${file.typeDef.label}, ${sizeText}) - ${role}` },
      { text: `${captionLabel} ${file.caption || NS}`, indent: 3 },
    ];
    const extra = file.extraContext ? file.extraContext.split('\n') : [NS];
    if (extra.length === 1) lines.push({ text: `${extraLabel}: ${extra[0]}`, indent: 3 });
    else {
      lines.push({ text: `${extraLabel}:`, indent: 3 });
      for (const more of extra) lines.push({ text: more, indent: 5 });
    }
    lines.push({ text: `Arrives as: "${file.emailSubject}"`, indent: 3 });
    return { label: null, lines };
  });
}

function permissionRow(model) {
  const v = model.values;
  const hasFiles = model.files.length > 0;
  const hasProof = !!v.proofDetails;
  const needed = hasFiles || hasProof;
  let because = '';
  if (hasFiles && hasProof) because = 'files and review or proof details were supplied';
  else if (hasFiles) because = 'files were supplied';
  else if (hasProof) because = 'review or proof details were supplied';
  let text;
  if (needed && v.materialPermission) text = `Confirmed (needed because ${because})`;
  else if (needed) text = 'Not confirmed';
  else if (v.materialPermission) text = 'Confirmed (not needed: no files or review details were supplied)';
  else text = 'Not needed (no files or review details were supplied)';
  return { label: 'Permission to share the material supplied', lines: [{ text }] };
}

/** Sections 2-5 (public brief) as [{ title, rows }]. */
function publicSections(model) {
  return [
    { title: `2. ${stageName(2)}`, rows: stageRows(model, 2) },
    { title: `3. ${stageName(3)}`, rows: stageRows(model, 3) },
    { title: `4. ${stageName(4)}`, rows: [...fileLines(model), ...stageRows(model, 4)] },
    { title: `5. ${stageName(5)}`, rows: [...stageRows(model, 5, ['materialPermission']), permissionRow(model)] },
  ];
}

function privateSection(model) {
  return {
    title: `1. ${stageName(1)}: PRIVATE (reply details; not for the website; not in the build pack)`,
    rows: stageRows(model, 1),
  };
}

function sectionText(section) {
  return [`== ${section.title} ==`, ...renderRowsText(section.rows)];
}

/* ------------------------------------------------------------------ brief email (b) */

function filesSummaryLine(model) {
  const k = model.files.length;
  if (k === 0) return 'Photos and files: none.';
  if (k === 1) return `Photos and files: 1 to follow, in its own email ("${model.files[0].emailSubject}").`;
  return `Photos and files: ${k} to follow, each in its own email (the subject lines are listed in section 4).`;
}

function briefEmail(model, missingLines, attachmentNames) {
  const v = model.values;
  const subject = F.briefSubject(model.ref, v.businessName, model.files.length, model.attemptTag);
  const intro = [
    'Website brief from the MT Creative Works website',
    `Reference: ${model.ref}`,
    `Received: ${model.receivedText}`,
    filesSummaryLine(model),
    `Attached: ${attachmentNames.join(', ')}`,
    `Reply to this email to answer ${v.name} directly.`,
  ];
  const sections = [privateSection(model), ...publicSections(model)];
  const checkTitle = 'To check before building (also in missing-information.txt)';
  const footer = [
    `Source: ${F.attributionText(model.attribution)}`,
    `Attempt #${model.attemptTag} ${T.MIDDOT} Schema ${S.SCHEMA_VERSION} ${T.MIDDOT} Mode ${model.mode}`,
  ];
  const text = [
    ...intro,
    '',
    ...sections.flatMap((s) => [...sectionText(s), '']),
    `== ${checkTitle} ==`,
    ...missingLines,
    '',
    '--',
    ...footer,
    '',
  ].join('\n');
  const html = htmlDocument(
    subject,
    `<h1 style="font-size:20px;margin:0 0 8px">${T.escapeHtml(intro[0])}</h1>` +
      paragraphsHtml(intro.slice(1)) +
      sections
        .map((s, i) =>
          sectionHtml(
            s.title,
            s.rows,
            i === 0 ? 'Private project contact. Not for the website and not in the build pack.' : null,
          ),
        )
        .join('') +
      `<h2 style="font-size:17px;margin:24px 0 8px;padding-top:12px;border-top:1px solid #d2d2d7">${T.escapeHtml(checkTitle)}</h2>` +
      `<div style="font-size:14px">${paragraphsHtml(missingLines)}</div>` +
      `<hr style="border:0;border-top:1px solid #d2d2d7;margin:20px 0 8px">` +
      `<div style="color:${GREY};font-size:13px">${paragraphsHtml(footer)}</div>`,
  );
  return { subject, text, html };
}

/** website-brief.txt (inside the pack and attached on its own): no private contact block. */
function websiteBriefText(model, missingLines) {
  const v = model.values;
  return [
    `WEBSITE BRIEF - ${T.sanitiseSingleLine(v.businessName)}`,
    `Reference: ${model.ref}`,
    `Received: ${model.receivedText}`,
    `Schema: ${model.schemaVersion}`,
    `Build pack: ${model.packName}`,
    '',
    'What the customer supplied, section by section. Blank answers mean unknown or not supplied. Every similar website is',
    'listed with its own exclusions. The questions and checks at the end are unresolved, not facts.',
    '',
    `== 1. ${stageName(1)} ==`,
    '  Private reply details are in the brief email and private-contact.txt only, never in this pack.',
    '',
    ...publicSections(model).flatMap((s) => [...sectionText(s), '']),
    '== To check before building (also in missing-information.txt) ==',
    ...missingLines,
    '',
  ].join('\n');
}

/** private-contact.txt (attached to the brief email, never inside the zip). */
function privateContactText(model) {
  const v = model.values;
  const line = (key) => {
    const field = S.getField('brief', key);
    const value = v[key];
    const text =
      field.type === 'radio' ? (value ? S.optionLabel(field.options, value) : NS) : value === '' ? NS : value;
    return `${field.label}: ${text}`;
  };
  return [
    `PRIVATE - reply details for website brief ${model.ref}`,
    'Do not add this file to the build pack or share it with AI tools.',
    '',
    ...S.schema.brief.private.map(line),
    `Received: ${model.receivedText}`,
    `Source: ${F.attributionText(model.attribution)}`,
    '',
  ].join('\n');
}

/* ------------------------------------------------------------------ one file (email c) */

/**
 * @param {{ref, businessLabel, index, total, file, typeDef, savedAs, sha256Actual}} m
 */
function fileEmail(m) {
  const { file, typeDef } = m;
  const kind = F.kindWord(typeDef);
  const subject = F.fileSubject(m.ref, m.index, m.total, typeDef, m.businessLabel);
  const business = F.subjectText(m.businessLabel);
  const sizeLine = file.resized
    ? `Size: ${F.megabytes(file.size)} (${F.bytesText(file.size)}) as sent. Resized in the browser before sending (JPEG, longest edge at most ${S.schema.files.resize.longestEdgePx.toLocaleString(
        'en-GB',
      )} px); the original was ${F.megabytes(file.originalSize)} (${F.bytesText(file.originalSize)}). Re-encoding removed embedded metadata such as location.`
    : `Size: ${F.megabytes(file.size)} (${F.bytesText(file.size)})`;
  let shaNote;
  if (!file.sha256) shaNote = '[browser declared: not declared]';
  else shaNote = `[browser declared: ${file.sha256} - ${file.sha256 === m.sha256Actual ? 'match' : 'does not match'}]`;
  const captionLabel = S.schema.files.fields.find((f) => f.key === 'caption').label;
  const extraField = S.schema.files.fields.find((f) => f.key === 'extraContext');
  const extraLabel = typeDef.kind === 'document' ? extraField.labelForDocument : extraField.label;

  const head = [
    `${kind} ${m.index} of ${m.total} for website brief ${m.ref} (${business}).`,
    'Sent on its own, as one file per email. The customer\'s reply details are in the brief email.',
  ];
  const facts = [
    `Original file name: ${file.name}`,
    `Save as: ${m.savedAs}  (in the build pack's assets/ folder)`,
    `Type: ${typeDef.label} (${typeDef.mime}), checked from the file's content`,
    sizeLine,
    `Intended use: ${file.role ? S.optionLabel('fileRole', file.role) : NS}`,
    `SHA-256 (as received): ${m.sha256Actual}   ${shaNote}`,
  ];
  const captionRow = { label: captionLabel, lines: textLines(file.caption), block: true };
  const extraRow = { label: `${extraLabel}:`, lines: textLines(file.extraContext), block: true };
  const text = [...head, '', ...facts, '', ...renderRowText(captionRow), '', ...renderRowText(extraRow), ''].join('\n');
  const html = htmlDocument(
    subject,
    paragraphsHtml(head) +
      `<div style="margin:12px 0;font-size:14px">${paragraphsHtml(facts)}</div>` +
      `<h2 style="font-size:16px;margin:16px 0 4px">${T.escapeHtml(captionLabel)}</h2>` +
      captionRow.lines.map(htmlLine).join('') +
      `<h2 style="font-size:16px;margin:16px 0 4px">${T.escapeHtml(extraLabel)}</h2>` +
      extraRow.lines.map(htmlLine).join(''),
  );
  return { subject, text, html };
}

module.exports = {
  fieldRow,
  renderRowsText,
  renderRowText,
  contactEmail,
  briefEmail,
  websiteBriefText,
  privateContactText,
  fileEmail,
  publicSections,
};
