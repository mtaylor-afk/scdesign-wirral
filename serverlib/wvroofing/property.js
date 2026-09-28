// WV Roofing — the customer's property (A5; brief §6-7, plan D9-D10).
//
//   POST   projects/:id/address/lookup  { postcode }            -> { postcode, addresses: [{ label, newBuild, pinnable, token }] }
//   POST   projects/:id/address         { token } | { manual }  -> { address }
//   DELETE projects/:id/address                                  -> the address (and its confirmation) cleared
//   GET    projects/:id/property/view                            -> { view: aerial image URL | why not }
//   POST   projects/:id/property/confirm { pinConfirmed, propertyType, notes? } -> { property }
//
// Every lookup and map view is a paid call: rate-limited per project, per visitor
// and per day, and logged. A new address supersedes the old one and its
// confirmation (and, from Release B, its measurements).
"use strict";

const crypto = require("crypto");
const core = require("./core.js");
const db = require("./db.js");
const limits = require("./limits.js");
const address = require("./address.js");
const imagery = require("./imagery.js");
const { isEnabled, isTest } = require("./capabilities.js");

const { HttpError, json, readJson, clean } = core;
const DAY = 24 * 3600;
const PROPERTY_TYPES = ["detached", "semi", "end_terrace", "mid_terrace", "bungalow", "flat", "other", "not_sure"];
const LOOKUP_COST_GBP = 0.045; // the most a successful lookup costs (Ideal Postcodes, Sep 2026); an unfound postcode is free
const MAP_COST_USD = 0.002; // a Static Maps load beyond the monthly free allowance

/** @typedef {import("./projects.js").ProjectCtx} ProjectCtx */
/** @typedef {Record<string, any>} Row */

/** @param {string} name @param {number} dflt */
function envNum(name, dflt) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : dflt;
}

/**
 * Count one paid call against the project, the visitor and the day; refuse with a
 * plain message when any of them is spent.
 * @param {ProjectCtx} ctx
 * @param {string} what  "address" | "map"
 * @param {{ project: number, ip: number, day: number }} max
 * @param {string} message
 */
async function charge(ctx, what, max, message) {
  const checks = /** @type {[string, string, number][]} */ ([
    [what + "_project", ctx.project.id, max.project],
    [what + "_global", "all", max.day],
  ]);
  const ip = limits.ipHash(ctx.req);
  if (ip) checks.unshift([what + "_ip", ip, max.ip]);
  /** @type {[string, string][]} */
  const done = [];
  for (const [scope, key, n] of checks) {
    const r = await limits.hit(scope, key, n, DAY);
    done.push([scope, key]);
    if (!r.ok) {
      for (const [s, k] of done) await limits.undo(s, k, DAY);
      throw new HttpError(429, "rate_limited", message, { retryAfter: r.retryAfter });
    }
  }
}

/**
 * @param {string | null} projectId
 * @param {string} provider
 * @param {string} endpoint
 * @param {string} status
 * @param {number} t0
 * @param {number} cost
 * @param {string} currency
 */
async function logCall(projectId, provider, endpoint, status, t0, cost, currency) {
  try {
    await db.query(
      "INSERT INTO wvr_provider_calls (provider, endpoint, project_id, status, duration_ms, cost, currency) VALUES ($1, $2, (SELECT id FROM wvr_projects WHERE id = $3::uuid), $4, $5, $6::numeric, $7)",
      [provider, endpoint, projectId, status, Date.now() - t0, cost.toFixed(4), currency]
    );
  } catch (err) {
    console.error("[wvroofing] provider call log failed", err instanceof Error ? err.message : err);
  }
}

/** The address as the customer sees it. @param {Row} r */
function addressOut(r) {
  const lines = typeof r.lines === "string" ? JSON.parse(r.lines) : r.lines || [];
  return {
    label: address.label({ lines, postTown: r.post_town, postcode: r.postcode, uprn: r.uprn, udprn: null, umprn: null, lat: null, lng: null, coordSource: r.coord_source, dataset: r.dataset }),
    lines,
    postTown: r.post_town ? address.titleCase(r.post_town) : null,
    postcode: r.postcode,
    manual: r.provider === "manual",
    newBuild: r.dataset === "nyb",
    coordSource: r.coord_source,
  };
}

/** @param {Row} r */
function propertyOut(r) {
  return {
    propertyType: r.property_type,
    pinShown: r.pin_shown,
    pinConfirmed: r.pin_confirmed,
    ambiguous: r.ambiguous,
    reasons: typeof r.ambiguity_reasons === "string" ? JSON.parse(r.ambiguity_reasons) : r.ambiguity_reasons || [],
    confirmedAt: r.confirmed_at ? new Date(r.confirmed_at).toISOString() : null,
  };
}

/**
 * Why the roofer should check this property's scope before measuring or quoting.
 * @param {{ coordSource: string, pinShown: boolean, pinConfirmed: boolean, propertyType: string }} c
 */
function ambiguityReasons(c) {
  /** @type {string[]} */
  const reasons = [];
  if (c.coordSource !== "rooftop") reasons.push("no_rooftop_coordinate");
  else if (!c.pinShown) reasons.push("not_seen_from_above");
  else if (!c.pinConfirmed) reasons.push("pin_not_confirmed");
  if (["semi", "end_terrace", "mid_terrace"].includes(c.propertyType)) reasons.push("shared_roof");
  if (c.propertyType === "flat") reasons.push("flat_or_shared_block");
  if (c.propertyType === "other" || c.propertyType === "not_sure") reasons.push("property_type_unclear");
  return reasons;
}

/** The project's current address row, or null. @param {Row} p */
async function currentAddress(p) {
  if (!p.address_id) return null;
  const { rows } = await db.query("SELECT * FROM wvr_addresses WHERE id = $1 AND project_id = $2", [p.address_id, p.id]);
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// routes

/** @param {ProjectCtx} ctx */
async function lookup(ctx) {
  if (!isEnabled("address_lookup", process.env)) {
    throw new HttpError(503, "not_configured", "Address search isn't available right now. You can type your address instead.");
  }
  const body = await readJson(ctx.req, 4 * 1024);
  const postcode = address.normalisePostcode(body.postcode);
  if (!postcode) throw new HttpError(400, "invalid_postcode", "That doesn't look like a UK postcode. Please check it (for example CH45 1AB).");
  await charge(ctx, "address", { project: envNum("WVR_ADDRESS_LOOKUPS_PER_PROJECT", 10), ip: envNum("WVR_ADDRESS_LOOKUPS_PER_IP", 30), day: envNum("WVR_ADDRESS_LOOKUPS_DAILY", 300) }, "That's a lot of address searches today. You can type your address instead.");
  const t0 = Date.now();
  /** @type {import("./address.js").Address[]} */
  let found;
  try {
    found = await address.lookup(postcode);
  } catch (err) {
    const kind = err instanceof address.AddressError ? err.kind : "upstream";
    await logCall(ctx.project.id, "ideal_postcodes", "postcodes", kind, t0, 0, "GBP");
    if (kind === "not_found") throw new HttpError(404, "postcode_not_found", "We couldn't find that postcode. Please check it, or type your address instead.");
    throw new HttpError(503, "address_unavailable", "Address search isn't available right now. You can type your address instead.");
  }
  await logCall(ctx.project.id, "ideal_postcodes", "postcodes", "ok", t0, LOOKUP_COST_GBP, "GBP");
  const addresses = found.map((a) => ({ label: address.label(a), newBuild: a.dataset === "nyb", pinnable: a.coordSource === "rooftop", token: address.signAddress(ctx.project.id, a) }));
  return json(ctx.res, 200, { ok: true, postcode, addresses });
}

/** @param {ProjectCtx} ctx */
async function choose(ctx) {
  const body = await readJson(ctx.req, 16 * 1024);
  /** @type {import("./address.js").Address | null} */
  let a = null;
  let provider = "manual";
  if (body.token !== undefined) {
    a = address.verifyAddress(ctx.project.id, body.token);
    if (!a) throw new HttpError(400, "invalid_address", "That address has expired. Please search for your postcode again.");
    provider = isTest(process.env) ? "fixture" : "ideal_postcodes";
  } else {
    const m = address.manualAddress(body.manual || {});
    if (!m.address) throw new HttpError(400, "invalid_fields", "Please check the address and try again.", { fields: m.problems });
    a = m.address;
  }
  const chosen = a;
  const id = crypto.randomUUID();
  await db.tx(async (t) => {
    await t.query("UPDATE wvr_addresses SET superseded_at = now() WHERE project_id = $1 AND superseded_at IS NULL", [ctx.project.id]);
    await t.query("UPDATE wvr_property_confirmations SET superseded_at = now() WHERE project_id = $1 AND superseded_at IS NULL", [ctx.project.id]);
    await t.query(
      "INSERT INTO wvr_addresses (id, project_id, provider, postcode, lines, post_town, uprn, udprn, umprn, lat, lng, coord_source, dataset, fetched_at) " +
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)",
      [
        id,
        ctx.project.id,
        provider,
        chosen.postcode,
        JSON.stringify(chosen.lines),
        chosen.postTown,
        chosen.uprn,
        chosen.udprn,
        chosen.umprn,
        chosen.lat,
        chosen.lng,
        chosen.coordSource,
        chosen.dataset,
        provider === "manual" ? null : new Date().toISOString(),
      ]
    );
    await t.query("UPDATE wvr_projects SET address_id = $2, property_confirmation_id = NULL, updated_at = now() WHERE id = $1", [ctx.project.id, id]);
  });
  const { rows } = await db.query("SELECT * FROM wvr_addresses WHERE id = $1", [id]);
  return json(ctx.res, 200, { ok: true, address: addressOut(rows[0]) });
}

/** @param {ProjectCtx} ctx */
async function clear(ctx) {
  await db.tx(async (t) => {
    await t.query("UPDATE wvr_addresses SET superseded_at = now() WHERE project_id = $1 AND superseded_at IS NULL", [ctx.project.id]);
    await t.query("UPDATE wvr_property_confirmations SET superseded_at = now() WHERE project_id = $1 AND superseded_at IS NULL", [ctx.project.id]);
    await t.query("UPDATE wvr_projects SET address_id = NULL, property_confirmation_id = NULL, updated_at = now() WHERE id = $1", [ctx.project.id]);
  });
  return json(ctx.res, 200, { ok: true, address: null });
}

/** @param {ProjectCtx} ctx */
async function viewRoute(ctx) {
  const a = await currentAddress(ctx.project);
  if (!a) throw new HttpError(409, "conflict", "Choose your address first.");
  const located = { lat: a.lat === null ? null : Number(a.lat), lng: a.lng === null ? null : Number(a.lng), coordSource: a.coord_source };
  const enabled = isEnabled("aerial_display", process.env);
  if (enabled && located.lat !== null) {
    await charge(ctx, "map", { project: envNum("WVR_MAP_VIEWS_PER_PROJECT", 20), ip: envNum("WVR_MAP_VIEWS_PER_IP", 60), day: envNum("WVR_MAP_VIEWS_DAILY", 300) }, "That's a lot of map views today. You can carry on without the aerial view.");
  }
  const t0 = Date.now();
  const v = await imagery.view(located, enabled);
  if (v.available && v.provider === "google_static_maps") await logCall(ctx.project.id, "google_static_maps", "staticmap", "issued", t0, MAP_COST_USD, "USD");
  return json(ctx.res, 200, { ok: true, view: v });
}

/** @param {ProjectCtx} ctx */
async function confirm(ctx) {
  const body = await readJson(ctx.req, 8 * 1024);
  const a = await currentAddress(ctx.project);
  if (!a) throw new HttpError(409, "conflict", "Choose your address first.");
  const propertyType = String(body.propertyType || "");
  if (!PROPERTY_TYPES.includes(propertyType)) throw new HttpError(400, "invalid_fields", "Please choose the kind of property.", { fields: ["propertyType"] });
  const imageryShown = isEnabled("aerial_display", process.env) && a.lat !== null && a.coord_source !== "none";
  const pinShown = imageryShown && a.coord_source === "rooftop";
  // A pin is only confirmed where one was shown: postcode centroids never get one.
  const pinConfirmed = pinShown && body.pinConfirmed === true;
  const reasons = ambiguityReasons({ coordSource: a.coord_source, pinShown, pinConfirmed, propertyType });
  const id = crypto.randomUUID();
  await db.tx(async (t) => {
    await t.query("UPDATE wvr_property_confirmations SET superseded_at = now() WHERE project_id = $1 AND superseded_at IS NULL", [ctx.project.id]);
    await t.query(
      "INSERT INTO wvr_property_confirmations (id, project_id, address_id, imagery_provider, pin_shown, pin_confirmed, property_type, ambiguous, ambiguity_reasons, notes, confirmed_by) " +
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'customer')",
      [
        id,
        ctx.project.id,
        a.id,
        imageryShown ? (isTest(process.env) ? "fixture" : "google_static_maps") : null,
        pinShown,
        pinConfirmed,
        propertyType,
        reasons.length > 0,
        JSON.stringify(reasons),
        clean(body.notes, 500) || null,
      ]
    );
    await t.query("UPDATE wvr_projects SET property_confirmation_id = $2, updated_at = now() WHERE id = $1", [ctx.project.id, id]);
  });
  const { rows } = await db.query("SELECT * FROM wvr_property_confirmations WHERE id = $1", [id]);
  return json(ctx.res, 200, { ok: true, property: propertyOut(rows[0]) });
}

/**
 * The address and confirmation for GET projects/:id.
 * @param {Row} p
 */
async function summary(p) {
  const a = await currentAddress(p);
  let property = null;
  if (a && p.property_confirmation_id) {
    const { rows } = await db.query("SELECT * FROM wvr_property_confirmations WHERE id = $1 AND project_id = $2", [p.property_confirmation_id, p.id]);
    if (rows[0]) property = propertyOut(rows[0]);
  }
  return { address: a ? addressOut(a) : null, property };
}

module.exports = { lookup, choose, clear, view: viewRoute, confirm, summary, ambiguityReasons, PROPERTY_TYPES };
