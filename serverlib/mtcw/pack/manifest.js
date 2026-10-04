'use strict';

// asset-manifest.json: the files the customer chose to send (FORMS-CONTRACT section 6). It records what was SELECTED;
// it cannot show whether every file email arrived. savedAs = the attachment name of that file's email.

const NOTE =
  'Each file arrives in its own email. This list is what the customer chose to send; it cannot show whether every email arrived. Save each attachment into assets/ under savedAs.';

function assetManifest(model) {
  const data = {
    schemaVersion: model.schemaVersion,
    reference: model.ref,
    expectedFiles: model.files.length,
    note: NOTE,
    files: model.files.map((f) => ({
      id: `file-${String(f.index).padStart(2, '0')}`,
      index: f.index,
      of: f.of,
      originalName: f.name,
      savedAs: f.savedAs,
      archivePath: `assets/${f.savedAs}`,
      type: f.type,
      typeLabel: f.typeDef.label,
      sizeBytes: f.size,
      originalSizeBytes: f.originalSize,
      resizedInBrowser: f.resized,
      role: f.role || null,
      roleLabel: f.roleLabel,
      caption: f.caption || null,
      extraContext: f.extraContext || null,
      sha256: f.sha256 || null,
      emailSubject: f.emailSubject,
      status: 'selected-by-customer',
      reviewState: 'unchecked',
      permission: 'confirmed',
    })),
  };
  return `${JSON.stringify(data, null, 2)}\n`;
}

module.exports = { assetManifest };
