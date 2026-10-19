// Rate limiting and de-duplication (shared/form-schema.json limits.rateLimit / limits.dedupe).
// In memory per warm instance (below), plus the SHARED versions at the end of this file, which keep the same limits
// in SC's existing Supabase (store.js) so every instance sees them. If storage is unavailable the shared versions
// fall back to memory for that request (fail open) and health reports sharedLimits: 'memory-fallback'.

const { schema } = require('./schema');
const { state } = require('./state');

const RATE = schema.limits.rateLimit;
const DEDUPE = schema.limits.dedupe;
const WINDOW_MS = RATE.windowSeconds * 1000;
const MAX_KEYS = 5000;

function prune(list, now) {
  while (list.length && list[0] <= now - WINDOW_MS) list.shift();
  return list;
}

/**
 * Forget every rate-limit key whose newest hit is outside the window, and every expired de-duplication entry,
 * so nothing outlives its purpose for longer than the next request (the Privacy page says these notes are used
 * for at most 15 minutes and then cleared). At most MAX_KEYS + maxEntries items: cheap.
 */
function sweep(now) {
  const { hits, dedupe } = state();
  for (const [key, list] of hits) {
    if (!list.length || list[list.length - 1] <= now - WINDOW_MS) hits.delete(key);
  }
  for (const [key, entry] of dedupe) {
    if (entry.expires <= now) dedupe.delete(key);
  }
}

/**
 * Check several limits at once and, when all pass, record one hit on each.
 * `checks` = [{ key, limit }]. Returns { ok: true } or { ok: false, retryAfter } (seconds, >= 1).
 */
function take(checks, now) {
  sweep(now);
  const { hits } = state();
  let retryAfter = 0;
  for (const { key, limit } of checks) {
    const list = prune(hits.get(key) || [], now);
    if (list.length >= limit) {
      const wait = Math.ceil((list[0] + WINDOW_MS - now) / 1000);
      retryAfter = Math.max(retryAfter, wait, 1);
    }
  }
  if (retryAfter > 0) return { ok: false, retryAfter };
  for (const { key } of checks) {
    const list = prune(hits.get(key) || [], now);
    list.push(now);
    hits.delete(key);
    hits.set(key, list);
  }
  while (hits.size > MAX_KEYS) hits.delete(hits.keys().next().value);
  return { ok: true };
}

/** The limits for one action (client = HMAC of the IP; never the raw IP). */
function checksFor(action, client, extra) {
  const checks = [{ key: 'emails', limit: RATE.emailsPerInstance }];
  if (action === 'contact') checks.push({ key: `contact|${client}`, limit: RATE.contactPerClient });
  if (action === 'brief') checks.push({ key: `brief|${client}`, limit: RATE.briefPerClient });
  if (action === 'file') {
    checks.push({ key: `file|${client}`, limit: RATE.filePerClient });
    checks.push({ key: `file-index|${extra.ref}|${extra.index}`, limit: RATE.fileAttemptsPerIndex });
  }
  return checks;
}

/** A remembered successful response for this key, or null. */
function recall(key, now) {
  sweep(now);
  const { dedupe } = state();
  const entry = dedupe.get(key);
  if (!entry) return null;
  if (entry.expires <= now) {
    dedupe.delete(key);
    return null;
  }
  return entry.response;
}

/** Remember a successful response (only successes are remembered). */
function remember(key, response, now) {
  const { dedupe } = state();
  dedupe.delete(key);
  dedupe.set(key, { expires: now + DEDUPE.ttlSeconds * 1000, response });
  for (const [k, entry] of dedupe) {
    if (dedupe.size <= DEDUPE.maxEntries && entry.expires > now) break;
    dedupe.delete(k);
  }
}

/* ------------------------------------------------------------------ shared (across instances) */
// When SC's Supabase is available (store.js), the same limits and the de-duplication memory are kept in the private
// bucket so every instance sees them. Object names carry only HMAC hashes and window numbers: no IP, no attempt id,
// no answers. Fixed windows: rl/<window>/<hash>-<slot> (slot claimed with create-if-absent, so two instances cannot
// both take the last slot); dd/<bucket>/<hash>.json holds the remembered response (the same name-free note kept in
// memory). FAILS OPEN: any storage problem falls back to the in-memory functions above for that request.

const store = require('./store');

const DEDUPE_MS = DEDUPE.ttlSeconds * 1000;
const SWEEP_CHANCE = 0.05;
let lastShared = { mode: 'memory', at: 0 };

function noteShared(mode, now) {
  lastShared = { mode, at: now };
}

/** 'shared' | 'memory-fallback' | 'memory' (storage not configured) for health. */
function sharedStatus() {
  if (!store.enabled()) return 'memory';
  return lastShared.mode === 'memory-fallback' ? 'memory-fallback' : 'shared';
}

async function sweepShared(now) {
  const current = Math.floor(now / WINDOW_MS);
  const currentDd = Math.floor(now / DEDUPE_MS);
  for (const [root, keep] of [
    ['rl', current],
    ['dd', currentDd - 1],
  ]) {
    const folders = await store.list(root, 100);
    for (const name of folders) {
      if (!/^\d+$/.test(name) || Number(name) >= keep) continue;
      const items = await store.list(`${root}/${name}`, 1000);
      await store.remove(items.map((i) => `${root}/${name}/${i}`));
    }
  }
}

/** Like take(), across instances. Falls back to take() if storage fails. */
async function takeShared(checks, now) {
  if (!store.enabled()) return take(checks, now);
  try {
    const w = Math.floor(now / WINDOW_MS);
    const folder = `rl/${w}`;
    const retryAfter = Math.max(1, Math.ceil(((w + 1) * WINDOW_MS - now) / 1000));
    const named = checks.map((c) => ({ ...c, h: store.hashName(`rl|${c.key}`) }));
    for (const c of named) {
      const used = (await store.list(folder, c.limit + 1, `${c.h}-`)).length;
      if (used >= c.limit) {
        noteShared('shared', now);
        return { ok: false, retryAfter };
      }
    }
    for (const c of named) {
      let claimed = false;
      for (let slot = 1; slot <= c.limit && !claimed; slot += 1) {
        claimed = (await store.put(`${folder}/${c.h}-${String(slot).padStart(4, '0')}`, '{}')) === 'ok';
      }
      if (!claimed) {
        noteShared('shared', now);
        return { ok: false, retryAfter };
      }
    }
    noteShared('shared', now);
    if (Math.random() < SWEEP_CHANCE) await sweepShared(now).catch(() => {});
    return { ok: true };
  } catch {
    noteShared('memory-fallback', now);
    return take(checks, now);
  }
}

/** Like recall(), across instances (memory first). */
async function recallShared(key, now) {
  const local = recall(key, now);
  if (local || !store.enabled()) return local;
  try {
    const h = store.hashName(`dd|${key}`);
    const b = Math.floor(now / DEDUPE_MS);
    for (const bucket of [b, b - 1]) {
      const entry = await store.get(`dd/${bucket}/${h}.json`);
      if (entry && typeof entry.expires === 'number' && entry.expires > now && entry.response) {
        noteShared('shared', now);
        return entry.response;
      }
    }
    noteShared('shared', now);
    return null;
  } catch {
    noteShared('memory-fallback', now);
    return null;
  }
}

/** Like remember(), in memory AND (when available) across instances. */
async function rememberShared(key, response, now) {
  remember(key, response, now);
  if (!store.enabled()) return;
  try {
    const h = store.hashName(`dd|${key}`);
    const b = Math.floor(now / DEDUPE_MS);
    await store.put(`dd/${b}/${h}.json`, { expires: now + DEDUPE_MS, response }, { upsert: true });
    noteShared('shared', now);
  } catch {
    noteShared('memory-fallback', now);
  }
}

module.exports = { take, checksFor, recall, remember, sweep, takeShared, recallShared, rememberShared, sharedStatus };