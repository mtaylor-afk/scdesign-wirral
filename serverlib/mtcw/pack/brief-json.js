'use strict';

// website-brief.json: the machine-readable PUBLIC brief (FORMS-CONTRACT section 6). Explicit null for unanswered
// single values, [] for empty lists, booleans as booleans, every choice as { value, label }. No private reply details
// (brief.private keys), no attribution, no attempt id: only the separate public* contact fields, which the customer
// supplied explicitly for the website.

const S = require('../schema');

const nullable = (value) => (typeof value === 'string' && value !== '' ? value : null);

function choice(key, values) {
  const field = S.getField('brief', key);
  const value = values[key];
  return value ? { value, label: S.optionLabel(field.options, value, values) || value } : null;
}

function choices(key, values) {
  const field = S.getField('brief', key);
  return values[key].map((value) => ({ value, label: S.optionLabel(field.options, value) || value }));
}

const SPECIALIST = ['booking-link', 'selling', 'other'];

function briefJson(model, missingList) {
  const v = model.values;
  const specialist = v.features.filter((f) => SPECIALIST.includes(f));
  const proofSupplied = !!(v.proofDetails || v.proofLink);
  const permissionRequired = model.files.length > 0 || !!v.proofDetails;
  const data = {
    schemaVersion: model.schemaVersion,
    pack: { version: 'v01', fileName: model.packName, reference: model.ref, receivedAt: model.receivedIso },
    business: {
      name: v.businessName,
      offerings: v.offerings.map((o, i) => ({ position: i + 1, name: o.name, description: nullable(o.description) })),
      moreOfferings: nullable(v.moreOfferings),
      priorityOffering: choice('priorityOffering', v),
      serviceArea: v.serviceArea,
      audience: nullable(v.audience),
      about: nullable(v.aboutBusiness),
      whyChooseYou: nullable(v.whyChooseYou),
    },
    website: {
      mainAction: choice('mainAction', v),
      afterContact: nullable(v.afterContact),
      existingWebsites: [...v.existingWebsites],
      publicContact: {
        email: nullable(v.publicEmail),
        emailCopiedFromReplyAddress: v.publicEmailFromReply,
        phone: nullable(v.publicPhone),
        phoneCopiedFromReplyNumber: v.publicPhoneFromReply,
        address: nullable(v.publicAddress),
        customersVisit: choice('customersVisit', v),
        openingHours: nullable(v.openingHours),
      },
      pricing: { preference: choice('pricingPreference', v), details: nullable(v.pricingDetails) },
      proof: {
        available: choice('proofAvailable', v),
        details: nullable(v.proofDetails),
        link: nullable(v.proofLink),
        // Nothing the customer supplies is checked by the form: always unverified until Matt reviews it.
        reviewState: 'unverified',
        supplied: proofSupplied,
      },
      faqs: v.faqs.map((f, i) => ({ position: i + 1, question: f.question, answer: nullable(f.answer) })),
      contentWanted: choices('contentWanted', v),
      features: {
        selected: choices('features', v),
        bookingLink: nullable(v.bookingLink),
        details: nullable(v.featureDetails),
        note: 'Specialist features need to be discussed and agreed separately.',
      },
      style: { notes: nullable(v.styleNotes), mattToSuggest: v.styleSuggest },
      references: v.references.map((r, i) => ({
        position: i + 1,
        url: r.url,
        excludedOfferings: nullable(r.exclusions),
      })),
      referencePreferred: choice('referencePreferred', v),
      referenceLikes: nullable(v.referenceLikes),
    },
    scope: {
      isOrder: false,
      specialistFeaturesRequested: specialist.map((value) => ({ value, label: S.optionLabel('features', value) })),
      specialistFeaturesIncluded: false,
      note:
        'An enquiry and website brief, not an order or payment. Pages, features and content follow the scope agreed with the customer; specialist features (booking, selling, other) are not assumed to be part of the £250 package.',
    },
    files: {
      expected: model.files.length,
      manifest: 'asset-manifest.json',
      sharingLink: nullable(v.sharingLink),
      imagePreference: choice('imagePreference', v),
      items: model.files.map((f) => ({
        id: `file-${String(f.index).padStart(2, '0')}`,
        index: f.index,
        originalName: f.name,
        savedAs: f.savedAs,
        archivePath: `assets/${f.savedAs}`,
        type: f.type,
        typeLabel: f.typeDef.label,
        role: f.role || null,
        roleLabel: f.roleLabel,
        caption: nullable(f.caption),
        extraContext: nullable(f.extraContext),
        emailSubject: f.emailSubject,
      })),
    },
    additional: { anythingElse: nullable(v.anythingElse) },
    permissions: {
      materialPermission: {
        required: permissionRequired,
        confirmed: v.materialPermission,
        meaning:
          'Customer confirmed permission to share the supplied material for preparing the website. Not proof of every legal right.',
      },
    },
    conflicts: model.conflicts.map((c) => ({ field: c.field, label: c.label, note: c.note })),
    missing: missingList,
  };
  return `${JSON.stringify(data, null, 2)}\n`;
}

module.exports = { briefJson };
