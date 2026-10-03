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
 * Is the Supabase project SC Design already has on this Vercel project (or one
 * named for WV Roofing) available? Then WV Roofing runs on it with nothing to
 * set up (db.js snapshot mode, storage.js Supabase driver). Same check as
 * supabase.js, kept here so this file stays free of requires.
 * @param {Env} env
 */
function supabaseReady(env) {
  const url = String(env.WVR_SUPABASE_URL || env.SC_SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/, "");
  const key = String(env.WVR_SUPABASE_SERVICE_ROLE_KEY || env.SC_SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && key.length > 20;
}

/**
 * Storage needs somewhere for the records and the files, a session secret, and
 * the daily tidy-up (without it nothing would be deleted after 30 days):
 * - the full set-up: a database URL, the private Blob store, WVR_SESSION_SECRET
 *   and CRON_SECRET; or
 * - the Supabase project already on Vercel (snapshot mode), where the secret is
 *   derived from a secret already there and the tidy-up runs inside requests.
 * @param {Env} env
 */
function storageCredentials(env) {
  if (isTest(env)) return true; // PGlite + local file storage
  const blob = !!(env.BLOB_STORE_ID || env.BLOB_READ_WRITE_TOKEN);
  if (!!databaseUrl(env) && blob && !!env.WVR_SESSION_SECRET && !!env.CRON_SECRET) return true;
  return !databaseUrl(env) && supabaseReady(env) && !!sessionSecret(env);
}

/**
 * The secret behind visitor hashes and address tokens: WVR_SESSION_SECRET, or
 * (when it isn't set) one derived from a secret already on this Vercel project,
 * so nothing new has to be set. The derivation is one-way, and labelled for WV
 * Roofing, so it can't be turned back into the secret it came from.
 * @param {Env} env
 * @returns {string}
 */
function sessionSecret(env) {
  if (env.WVR_SESSION_SECRET) return env.WVR_SESSION_SECRET;
  const base = env.SC_ADMIN_SESSION_SECRET || env.WVR_SUPABASE_SERVICE_ROLE_KEY || env.SC_SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base) return "";
  return require("crypto").createHmac("sha256", base).update("wvroofing session secret v1").digest("hex");
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
    // test environment: the in-memory outbox in mailer.js (never SMTP)
    credential: (env) => isTest(env) || (!!env.WVR_LEAD_TO && (!!(env.SMTP_USER && env.SMTP_PASS) || env.WVR_MAIL_DRYRUN === "1")),
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

module.exports = { NAMES, capability, capabilities, isEnabled, databaseUrl, isTest, supabaseReady, sessionSecret };
