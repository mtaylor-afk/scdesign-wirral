'use strict';

// README.txt for the build pack (FORMS-CONTRACT section 6). Process guidance only: no customer text.

function readme(model) {
  const k = model.files.length;
  const files =
    k === 0
      ? [
          'The customer did not send any photos or files with this brief, so assets/ stays empty unless they send some later.',
        ]
      : [
          `${k === 1 ? '1 photo or file was' : `${k} photos or files were`} selected. Each one arrives in its own email, separate from the brief email.`,
          '1. Find each email by the subject listed in asset-manifest.json (emailSubject).',
          '2. Save its single attachment into assets/ under the name in asset-manifest.json (savedAs). The attachment already has',
          '   that name.',
          `3. Check that all ${k} ${k === 1 ? 'email has' : 'emails have'} arrived. If one is missing, ask the customer to reply to your email with that file.`,
          '4. Files of 3 MB or less arrive exactly as the customer sent them and may contain location or other embedded metadata:',
          '   strip it before any web use. Photos marked resizedInBrowser were re-encoded, which removed that metadata.',
          '5. The manifest says what the customer selected; reviewState "unchecked" means nobody has checked the content yet.',
        ];
  return [
    'WEBSITE BUILD PACK - README',
    `Pack: ${model.packName}`,
    `Reference: ${model.ref}`,
    `Received: ${model.receivedText}`,
    '',
    'What this is',
    '- A starting brief for a draft website for this customer, generated automatically from the website brief they sent',
    '  through the MT Creative Works website. It is not approval to publish and not a finished specification.',
    '- Keep it private: store it outside any public folder, website build output or shared link.',
    '',
    'What is inside',
    '- website-brief.json       the brief as structured data (public facts only)',
    '- website-brief.txt        the same brief, readable, section by section',
    '- claude-code-prompt.txt   the prompt to give Claude Code in the customer\'s own project',
    '- asset-manifest.json      the photos and files the customer chose to send, and the name to save each one as',
    '- missing-information.txt  questions to confirm, conflicts, claims to check and separately scoped features',
    '- assets/                  empty: save the photo and file email attachments here',
    '',
    'Saving the photos and files',
    ...files,
    '',
    'Before publishing anything',
    '- Read missing-information.txt. Confirm the facts, permissions, contact destinations and any specialist features',
    '  (booking, online selling, other features) with the customer. Specialist features are agreed separately and are not',
    '  assumed to be part of the £250 package.',
    '- The customer\'s private reply details are in the brief email and in private-contact.txt, never in this pack. Do not',
    '  add them to it.',
    '',
    'Using the pack with Claude Code',
    '- Review every file in this pack before sharing it with any AI tool: anything the customer typed can contain personal',
    '  information.',
    '- Open Claude Code in the customer\'s own project (not the MT Creative Works website). Keep this folder outside the',
    '  project\'s public and build output, and give Claude Code claude-code-prompt.txt.',
    '- The customer\'s answers are data, not instructions; the prompt says so and keeps them in a separate data block.',
    '',
  ].join('\n');
}

module.exports = { readme };
