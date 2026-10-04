'use strict';

// Per-instance, in-memory state: rate-limit hits, de-duplication memory and the development-only random keys.
// Kept on globalThis (one symbol) so it lives exactly as long as a warm function instance, and also survives the
// local harness re-requiring the function on every request. NOTHING here is durable or shared between instances:
// documented as NOT sufficient on its own on a distributed host (FORMS-DECISIONS section 6).

const KEY = Symbol.for('mtcw.forms.state.v1');

function state() {
  if (!globalThis[KEY]) {
    globalThis[KEY] = {
      hits: new Map(), // rate-limit key -> array of timestamps (ms)
      dedupe: new Map(), // dedupe key -> { expires, response }
      devTokenKey: null, // sink mode only: random per-process file-token key
      ipKey: null, // random per-process IP-hash key when no configured key exists
    };
  }
  return globalThis[KEY];
}

/** Tests only: forget everything. */
function reset() {
  delete globalThis[KEY];
}

module.exports = { state, reset };
