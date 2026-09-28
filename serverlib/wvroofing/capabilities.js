// WV Roofing — capability states (brief §4: separate states per capability;
// never enable a capability just because an API key exists).
//
//   implemented  code exists, but the credential it needs is missing
//   configured   the credential is present, but it is not switched on
//   enabled      credential present + every right it needs is "yes" in
//                permissions.js + the owner switch WVR_CAP_<NAME>=on
//   disabled     a right is unresolved or refused, the kill switch is on,
//                or the capability has no licensed provider at all
//
// Pure: everything is computed from the env object passed in.
"use strict";

const { rightsFor } = require("./permissions.js");

/** @typedef {Record<string, string | undefined>} Env */
/** @typedef {"implemented" | "configured" | "enabled" | "disabled"} CapState */
/** @typedef {{ state: CapState, reason: string }} Capability */

/** @param {Env} env */
function isTest(env) {
  return env.WVR_ENV === "test";
}

/** @param {Env} env */
function databaseUrl(env) {
  return env.WVR_DATABASE_URL || env.DATABASE_URL || env.POSTGRES_URL || "";
}

/**
 * Storage needs the database, the private Blob store, the session secret AND
 * the cron secret: without the daily job nothing would be deleted after 30
 * days, so uploads stay off until it can run.
 * @param {Env} env
 */
function storageCredentials(env) {
  if (isTest(env)) return true; // PGlite + local file storage
  const blob = !!(env.BLOB_STORE_ID || env.BLOB_READ_WRITE_TOKEN);
  return !!databaseUrl(env) && blob && !!env.WVR_SESSION_SECRET && !!env.CRON_SECRET;
}

/** @param {Env} env */
function killed(env) {
  return env.WVR_ENABLED === "0" || env.WVR_ENABLED === "false";
}

/**
 * name -> credential check, owner switch (null = none), and whether the kill
 * switch (WVR_ENABLED=0, which stops every paid outside call) applies.
 * @type {Record<string, { credential: (env: Env) => boolean, switch: string | null, paid: boolean }>}
 */
const DEFS = {
  address_lookup: {
    credential: (env) => isTest(env) || !!env.WVR_IDEAL_POSTCODES_KEY,
    switch: "WVR_CAP_ADDRESS_LOOKUP",
    paid: true,
  },
  aerial_display: {
    credential: (env) => isTest(env) || !!(env.WVR_GOOGLE_MAPS_STATIC_KEY && env.WVR_GOOGLE_MAPS_SIGNING_SECRET),
    switch: "WVR_CAP_AERIAL_DISPLAY",
    paid: true,
  },
  image_generation: {
    // test environment: the OpenAI fixture in openai.js (never in production)
    credential: (env) => isTest(env) || !!env.WVR_OPENAI_API_KEY,
    switch: "WVR_CAP_IMAGE_GENERATION",
    paid: true,
  },
  enquiry_storage: {
    credential: storageCredentials,
    switch: null,
    paid: false,
  },
  enquiry_delivery: {
    credential: (env) => !!env.WVR_LEAD_TO && (!!(env.SMTP_USER && env.SMTP_PASS) || env.WVR_MAIL_DRYRUN === "1"),
    switch: "WVR_CAP_ENQUIRY_DELIVERY",
    paid: false,
  },
  assisted_measurement: {
    credential: storageCredentials,
    switch: "WVR_CAP_ASSISTED_MEASUREMENT",
    paid: false,
  },
  os_reference: {
    credential: (env) => !!env.WVR_OS_DATAHUB_KEY,
    switch: "WVR_CAP_OS_REFERENCE",
    paid: true,
  },
  desk_measure: {
    credential: (env) => !!env.WVR_OS_DATAHUB_KEY,
    switch: "WVR_CAP_DESK_MEASURE",
    paid: true,
  },
};

const NAMES = Object.freeze(Object.keys(DEFS).concat(["auto_measurement"]));

/**
 * State of one capability.
 * @param {string} name
 * @param {Env} env
 * @returns {Capability}
 */
function capability(name, env) {
  if (name === "auto_measurement") {
    return { state: "disabled", reason: "no_licensed_provider" };
  }
  const def = DEFS[name];
  if (!def) return { state: "disabled", reason: "unknown_capability" };
  const rights = rightsFor(name);
  if (!rights.ok) return { state: "disabled", reason: "rights_unresolved:" + rights.missing.join(",") };
  if (def.paid && killed(env)) return { state: "disabled", reason: "kill_switch" };
  if (!def.credential(env)) return { state: "implemented", reason: "no_credentials" };
  if (def.switch && env[def.switch] !== "on") return { state: "configured", reason: "switch_off:" + def.switch };
  return { state: "enabled", reason: isTest(env) ? "test_environment" : "ok" };
}

/**
 * Every capability, keyed by name.
 * @param {Env} env
 * @returns {Record<string, Capability>}
 */
function capabilities(env) {
  /** @type {Record<string, Capability>} */
  const out = {};
  for (const n of NAMES) out[n] = capability(n, env);
  return out;
}

/**
 * @param {string} name
 * @param {Env} env
 */
function isEnabled(name, env) {
  return capability(name, env).state === "enabled";
}

module.exports = { NAMES, capability, capabilities, isEnabled, databaseUrl, isTest };
