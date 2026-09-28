// WV Roofing — GET /api/wvroofing/health: what is switched on, and why not.
// Public by design: it reports states and reasons only, never secrets or figures.
"use strict";

const core = require("./core.js");
const db = require("./db.js");
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

/** @param {import("./router.js").Ctx} ctx */
async function health(ctx) {
  const env = process.env;
  const caps = capabilities(env);
  let schema = null;
  if (db.configured(env)) {
    schema = await schemaStatus();
    if (!schema.ok) {
      for (const name of ["enquiry_storage", "assisted_measurement"]) {
        if (caps[name].state === "enabled") caps[name] = { state: "configured", reason: "database_unreachable" };
      }
    }
  }
  return core.json(ctx.res, 200, {
    ok: true,
    service: "wvroofing",
    environment: isTest(env) ? "test" : "production",
    region: env.VERCEL_REGION || null,
    schema,
    capabilities: caps,
    imageModel: core.config().model,
  });
}

module.exports = { health };
