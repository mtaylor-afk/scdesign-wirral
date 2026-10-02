// WV Roofing — GET /api/wvroofing/health: what is switched on, and why not.
// Public by design: it reports states and reasons only, never secrets or figures.
// "setup" is the owner's checklist for the admin login screen: yes or no for
// each setting, never a value (not even part of one).
"use strict";

const core = require("./core.js");
const db = require("./db.js");
const openai = require("./openai.js");
const storage = require("./storage.js");
const { capabilities, capability, isTest } = require("./capabilities.js");

/** @type {{ at: number, value: { ok: boolean, version?: number } | null }} */
let schemaCache = { at: 0, value: null };

async function schemaStatus() {
  if (Date.now() - schemaCache.at < 60 * 1000 && schemaCache.value) return schemaCache.value;
  let value;
  try {
    value = { ok: true, version: await db.ensureSchema() };
  } catch (err) {
    console.error("[wvroofing] schema check failed", err instanceof Error ? err.message : err);
    value = { ok: false };
  }
  schemaCache = { at: Date.now(), value };
  return value;
}

/**
 * "limited" when today's spending ceiling can't take another typical render.
 * @param {ReturnType<typeof openai.renderConfig>} cfg
 */
async function budgetState(cfg) {
  try {
    const today = await require("./limits.js").budgetToday();
    const next = openai.estimateCost(cfg.model, cfg.quality, 1536, 1024);
    return today.reserved + today.spent + next > cfg.budgetUsd ? "limited" : "ok";
  } catch (err) {
    return null;
  }
}

/**
 * Does the admin password setting look like a hash made by
 * scripts/wvroofing/operator-hash.mjs ("scrypt:N:r:p:salt:hash")? A value pasted
 * wrongly can never open a session, so it counts as not set.
 * @param {string | undefined} stored
 */
function passwordHashSet(stored) {
  const parts = String(stored || "").trim().split(":");
  return parts.length === 6 && parts[0] === "scrypt" && parts.every((x) => x.length > 0);
}

/**
 * What the owner has set up: one yes or no per setting, for the admin login
 * screen. In the test environment the database, photo store and the two secrets
 * are stand-ins, so they always count as set; the admin password never does
 * until a hash is set, and enquiry emails follow their capability (after the
 * needs_storage check below).
 * @param {Record<string, string | undefined>} env
 * @param {Record<string, import("./capabilities.js").Capability>} caps
 */
function setupState(env, caps) {
  const test = isTest(env);
  return {
    database: db.configured(env),
    photoStore: storage.configured(env),
    sessionSecret: test || !!env.WVR_SESSION_SECRET,
    cronSecret: test || !!env.CRON_SECRET,
    adminPassword: passwordHashSet(env.WVR_OPERATOR_PASSWORD_HASH),
    // Its own settings (inbox, email login, switch), not whether storage is there
    // yet: missing storage has its own lines above.
    enquiryEmail: capability("enquiry_delivery", env).state === "enabled" || caps.enquiry_delivery.state === "enabled",
  };
}

/** @param {import("./router.js").Ctx} ctx */
async function health(ctx) {
  const env = process.env;
  const caps = capabilities(env);
  const cfg = openai.renderConfig(env);
  let schema = null;
  if (db.configured(env)) {
    schema = await schemaStatus();
    if (!schema.ok) {
      for (const name of ["enquiry_storage", "assisted_measurement"]) {
        if (caps[name].state === "enabled") caps[name] = { state: "configured", reason: "database_unreachable" };
      }
    }
  }
  // Renders and enquiry emails also need storage (projects, and enquiries are saved
  // before anyone is emailed); renders need a model whose settings we know.
  if (caps.image_generation.state === "enabled" && caps.enquiry_storage.state !== "enabled") caps.image_generation = { state: "configured", reason: "needs_storage" };
  if (caps.enquiry_delivery.state === "enabled" && caps.enquiry_storage.state !== "enabled") caps.enquiry_delivery = { state: "configured", reason: "needs_storage" };
  if (caps.image_generation.state === "enabled" && !openai.profile(cfg.model).known) caps.image_generation = { state: "disabled", reason: "unsupported_model" };
  const rendering = caps.image_generation.state === "enabled";
  return core.json(ctx.res, 200, {
    ok: true,
    service: "wvroofing",
    environment: isTest(env) ? "test" : "production",
    region: env.VERCEL_REGION || null,
    schema,
    capabilities: caps,
    setup: setupState(env, caps),
    imageModel: cfg.model,
    renders: {
      model: cfg.model,
      quality: cfg.quality,
      autoRender: cfg.autoRender,
      budget: rendering && schema && schema.ok ? await budgetState(cfg) : null,
      renderer: (await require("./compose.js").ready()) ? "ready" : "unavailable",
    },
  });
}

module.exports = { health, setupState };
