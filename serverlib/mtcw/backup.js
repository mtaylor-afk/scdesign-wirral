'use strict';

// Safety-net copy of each sent brief and quick message (FORMS-CONTRACT section 15), in the private "mtcw-forms"
// bucket of SC's existing Supabase project (store.js). Written just BEFORE the email is sent, so a brief whose email
// is lost in transit is still recoverable by the owner. Photos and files: metadata only (name, type, size, SHA-256,
// caption) - never the image bytes.
//
// Objects: backup/<YYYY-MM>/<ref>/form.json and backup/<YYYY-MM>/<ref>/file-NN.json. Not publicly readable (private
// bucket, service key only). RETENTION: not yet decided by the owner - see docs/launch-checklist item "Backup
// retention period". Nothing deletes these copies automatically until that period is set.
//
// Fails open: if storage is unavailable the email is still sent and the response is unchanged; health reports it.

const store = require('./store');

let last = { state: 'none', at: 0 };

function month(date) {
  return date.toISOString().slice(0, 7);
}

async function write(path, record, now) {
  if (!store.enabled()) return false;
  try {
    await store.put(path, record, { upsert: true });
    last = { state: 'ok', at: now };
    return true;
  } catch {
    last = { state: 'failed', at: now };
    return false;
  }
}

/** A quick message or brief: the validated answers, attribution and file metadata. */
function saveForm({ action, ref, date, values, attribution, files, mode }) {
  const record = {
    kind: action === 'brief' ? 'website-brief' : 'quick-message',
    ref,
    receivedAt: date.toISOString(),
    mode,
    answers: values,
    attribution: attribution || null,
    files: (files || []).map((f, i) => ({
      index: i + 1,
      name: f.name,
      type: f.type,
      size: f.size,
      sha256: f.sha256 || null,
      caption: f.caption || null,
    })),
    retention: 'NOT SET - owner to decide (launch checklist: backup retention period)',
  };
  return write(`backup/${month(date)}/${ref}/form.json`, record, date.getTime());
}

/** One photo or file: metadata only, never the bytes. */
function saveFileMeta({ ref, date, index, total, file, savedAs, sha256Actual }) {
  const record = {
    kind: 'file-metadata',
    ref,
    receivedAt: date.toISOString(),
    index,
    total,
    name: file.name,
    savedAs,
    type: file.type,
    size: file.size,
    sha256: sha256Actual,
    bytesStored: false,
  };
  return write(`backup/${month(date)}/${ref}/file-${String(index).padStart(2, '0')}.json`, record, date.getTime());
}

/** 'ok' | 'failed' (last write in this instance failed) | 'not-configured' | 'off-in-sink-mode' | 'ready' */
function backupStatus() {
  const base = store.healthStatus();
  if (base === 'not-configured' || base === 'off-in-sink-mode') return base;
  if (last.state === 'failed') return 'failed';
  if (last.state === 'ok') return 'ok';
  return base === 'degraded' ? 'degraded' : 'ready';
}

function reset() {
  last = { state: 'none', at: 0 };
}

module.exports = { saveForm, saveFileMeta, backupStatus, reset };
