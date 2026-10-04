'use strict';

// missing-information.txt (and the brief email's "To check before building" block): unanswered useful questions,
// conflicts, missing destinations, claims to verify, files to save and check, separately scoped features, references
// without exclusions. Only lines that apply. It never says an optional blank blocks a first draft.

const S = require('../schema');

// The brief's own umbrella question for the public-contact block (brief section 6, stage 3 D), word for word.
const PUBLIC_CONTACT_QUESTION = 'Which contact details can appear on your website?';

function label(key) {
  return S.getField('brief', key).label;
}

function choiceLabel(key, values) {
  const field = S.getField('brief', key);
  const value = values[key];
  return value ? S.optionLabel(field.options, value, values) || value : null;
}

/** Groups of { title, lines } that apply to this brief (empty groups are left out). */
function missingInformation(model) {
  const v = model.values;
  const groups = [];
  const add = (title, lines) => {
    if (lines.length) groups.push({ title, lines });
  };

  // Useful questions not answered (optional questions from stages 2-4).
  const questions = [];
  if (v.offerings.length > 1 && !v.priorityOffering) questions.push(label('priorityOffering'));
  for (const key of ['audience', 'aboutBusiness', 'whyChooseYou', 'afterContact']) {
    if (!v[key]) questions.push(label(key));
  }
  if (!v.existingWebsites.length) questions.push(label('existingWebsites'));
  if (!v.publicEmail && !v.publicPhone && !v.publicAddress) questions.push(PUBLIC_CONTACT_QUESTION);
  if (v.publicAddress && !v.customersVisit) questions.push(label('customersVisit'));
  if (!v.openingHours) questions.push(label('openingHours'));
  if (!v.pricingPreference) questions.push(label('pricingPreference'));
  if (!v.proofAvailable) questions.push(label('proofAvailable'));
  if (!v.faqs.length) questions.push(label('faqs'));
  if (!v.contentWanted.length) questions.push(label('contentWanted'));
  if (!v.features.length) questions.push(label('features'));
  if (!v.styleNotes && !v.styleSuggest) questions.push(label('styleNotes'));
  if (!v.references.length) questions.push(label('references'));
  if (v.references.length && !v.referencePreferred) questions.push(label('referencePreferred'));
  if (!model.files.length && !v.imagePreference) questions.push(label('imagePreference'));
  add('Useful questions not answered', questions);

  // Conflicts (an answered follow-up whose controlling answer would normally hide it).
  add(
    'Conflicts',
    model.conflicts.map((c) => `"${c.label}" ${c.note}.`),
  );

  // Missing destinations for the main visitor action and the booking link.
  const destinations = [];
  const action = choiceLabel('mainAction', v);
  if (v.mainAction === 'call' && !v.publicPhone) {
    destinations.push(`The main thing visitors should do is "${action}", but no phone number to show on the website was supplied.`);
  }
  if (['quote', 'enquiry', 'appointment'].includes(v.mainAction) && !v.publicEmail && !v.publicPhone) {
    destinations.push(
      `The main thing visitors should do is "${action}", but neither an email address nor a phone number to show on the website was supplied.`,
    );
  }
  if (v.mainAction === 'visit' && !v.publicAddress) {
    destinations.push(`The main thing visitors should do is "${action}", but no address to show on the website was supplied.`);
  }
  if (v.features.includes('booking-link') && !v.bookingLink) {
    destinations.push(`"${S.optionLabel('features', 'booking-link')}" was chosen, but no booking-service address was supplied.`);
  }
  add('Missing destinations', destinations);

  // Claims to verify before publishing.
  const claims = [];
  if (v.proofDetails || v.proofLink) {
    claims.push('Reviews, qualifications, memberships or guarantees were supplied: check each one, and the permission to use it, before publishing.');
  }
  if (v.whyChooseYou) claims.push(`"${label('whyChooseYou')}" was answered: check any factual claims in it before publishing.`);
  if (v.aboutBusiness) {
    claims.push(`"${label('aboutBusiness')}" was answered: check experience, history and other factual claims before publishing.`);
  }
  if (v.pricingDetails) claims.push('Prices or offers were supplied: confirm the amounts, currency, VAT and conditions before publishing.');
  add('Claims to verify before publishing', claims);

  // Files.
  const files = [];
  const k = model.files.length;
  if (k === 1) files.push('1 photo or file was selected; check that its email arrived (subject in asset-manifest.json).');
  if (k > 1) files.push(`${k} photos or files were selected; check that all ${k} file emails arrived (subjects in asset-manifest.json).`);
  for (const file of model.files) files.push(`Save the attachment of "${file.emailSubject}" into assets/ as ${file.savedAs}.`);
  if (k === 0) {
    files.push(`No photos or files were supplied. ${label('imagePreference')} ${choiceLabel('imagePreference', v) || S.NOT_SUPPLIED}.`);
  }
  if (v.sharingLink) files.push(`A sharing link was supplied (${v.sharingLink}): open it yourself and check access. It was not fetched or checked.`);
  add('Files', files);

  // Specialist features: never assumed to be included.
  const specialist = [];
  for (const value of ['booking-link', 'selling', 'other']) {
    if (v.features.includes(value)) {
      specialist.push(`${S.optionLabel('features', value)}: to be discussed and agreed separately (not assumed to be part of the £250 package).`);
    }
  }
  if (v.features.includes('not-sure')) specialist.push(`"${S.optionLabel('features', 'not-sure')}" was chosen for extra features: discuss with the customer.`);
  add('Specialist features', specialist);

  // References without exclusions.
  add(
    'References without exclusions',
    v.references
      .map((ref, i) => ({ ref, n: i + 1 }))
      .filter(({ ref }) => !ref.exclusions)
      .map(({ ref, n }) => `Similar website ${n} (${ref.url}) has no exclusions: a blank box is not approval to use that business's services.`),
  );

  return groups;
}

/** The groups as text lines (title, then '- item' lines, blank line between groups). */
function missingLines(groups) {
  if (!groups.length) return ['Nothing to flag.'];
  const lines = [];
  groups.forEach((group, i) => {
    if (i > 0) lines.push('');
    lines.push(group.title);
    for (const line of group.lines) lines.push(`- ${line}`);
  });
  return lines;
}

/** missing-information.txt */
function missingInformationText(model, groups) {
  return [
    `MISSING INFORMATION AND CHECKS - website brief ${model.ref}`,
    'None of these stops a first draft. They are questions and checks to settle with the customer before anything is published.',
    '',
    ...missingLines(groups),
    '',
  ].join('\n');
}

/** Flat list for website-brief.json: '<group>: <line>'. */
function missingList(groups) {
  return groups.flatMap((group) => group.lines.map((line) => `${group.title}: ${line}`));
}

module.exports = { missingInformation, missingLines, missingInformationText, missingList, PUBLIC_CONTACT_QUESTION };
