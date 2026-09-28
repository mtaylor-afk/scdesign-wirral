// WV Roofing — GET /api/wvroofing/health: what is switched on, and why not.
// Public by design: it reports states and reasons only, never secrets or figures.
"use strict";

const core = require("./core.js");
const db = require("./db.js");
const openai = require("./openai.js");
const { capabilities, isTest } = require("./capabilities.js");

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
  // Renders also need storage (projects) and a model whose settings we know.
  if (caps.image_generation.state === "enabled" && caps.enquiry_storage.state !== "enabled") caps.image_generation = { state: "configured", reason: "needs_storage" };
  if (caps.image_generation.state === "enabled" && !openai.profile(cfg.model).known) caps.image_generation = { state: "disabled", reason: "unsupported_model" };
  const rendering = caps.image_generation.state === "enabled";
  return core.json(ctx.res, 200, {
    ok: true,
    service: "wvroofing",
    environment: isTest(env) ? "test" : "production",
    region: env.VERCEL_REGION || null,
    schema,
    capabilities: caps,
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

module.exports = { health };
