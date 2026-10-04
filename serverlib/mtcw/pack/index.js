'use strict';

// The build pack (FORMS-CONTRACT section 6): website-build-pack_<business-slug>_<UTC-date>_<short-id>_v01.zip, one
// top-level folder named like the zip, entries in a fixed order, STORE-only, UTF-8 (no BOM), LF line endings,
// generated deterministically from the model. Private reply details never enter it.

const { createZip } = require('../zip');
const { briefJson } = require('./brief-json');
const { assetManifest } = require('./manifest');
const { claudeCodePrompt } = require('./prompt');
const { readme } = require('./readme');
const { missingInformation, missingLines, missingInformationText, missingList } = require('./missing');
const { websiteBriefText } = require('../render');

/** Build every pack file and the zip. Returns { packName, folder, zip, files: {name: text}, missingGroups, briefTxt }. */
function buildPack(model) {
  const groups = missingInformation(model);
  const lines = missingLines(groups);
  const briefTxt = websiteBriefText(model, lines);
  const files = {
    'README.txt': readme(model),
    'website-brief.json': briefJson(model, missingList(groups)),
    'website-brief.txt': briefTxt,
    'claude-code-prompt.txt': claudeCodePrompt(model),
    'asset-manifest.json': assetManifest(model),
    'missing-information.txt': missingInformationText(model, groups),
  };
  const folder = model.packBase;
  const entries = [
    ...Object.entries(files).map(([name, text]) => ({ name: `${folder}/${name}`, data: Buffer.from(text, 'utf8') })),
    { name: `${folder}/assets/`, directory: true },
  ];
  return {
    packName: model.packName,
    folder,
    zip: createZip(entries, model.date),
    files,
    briefTxt,
    missingGroups: groups,
    missingLines: lines,
  };
}

module.exports = { buildPack };
