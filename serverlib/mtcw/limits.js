'use strict';

// Per-instance, in-memory rate limiting and de-duplication (shared/form-schema.json limits.rateLimit / limits.dedupe).
// HONEST LIMITATION: this only sees one warm instance. On a distributed host a determined sender can exceed these
// limits, and a repeat that reaches another instance can send twice (the subject's #tag lets Matt spot it). Real
// limits would need shared storage, which the owner has not chosen (FORMS-DECISIONS section 6).

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

module.exports = { take, checksFor, recall, remember, sweep };
