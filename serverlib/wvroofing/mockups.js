// WV Roofing — previews drawn on the customer's own device (the Roof Cam's roofs,
// the visualiser's quick previews), kept with their project so the roofer sees
// the roof they chose.
//
//   POST projects/:id/mockups { visualId, condition?, jpeg }  -> { mockup: { id } }
//
// The browser sends the preview as a JPEG data URL, at most 1600 px and 1.2 MB.
// It is decoded and encoded again here (which also proves it's a picture), with
// nothing of the original file kept but its pixels. A project keeps at most
// MAX_PER_PROJECT of them; they go with the project (30 days, or 12 months once
// an enquiry is sent).
"use strict";

const crypto = require("crypto");
const core = require("./core.js");
const db = require("./db.js");
const images = require("./images.js");
const limits = require("./limits.js");
const { storage } = require("./storage.js");
const { isEnabled } = require("./capabilities.js");

const { HttpError, json, readJson, VISUALS } = core;

const MAX_BYTES = 1200 * 1024;
const MAX_EDGE = 2000;
const MAX_PER_PROJECT = 12;
// The Roof Cam's weather (version 2); version 1's quick previews have none.
const CONDITIONS = ["noon", "sun", "drizzle", "storm", "dusk"];

/**
 * @typedef {import("./projects.js").ProjectCtx} ProjectCtx
 */

/** @param {ProjectCtx} ctx */
async function add(ctx) {
  if (!isEnabled("enquiry_storage", process.env)) throw new HttpError(503, "not_configured", "Saving previews isn't available right now.");
  const body = await readJson(ctx.req, Math.ceil((MAX_BYTES * 4) / 3) + 4096);
  const p = ctx.project;
  const visualId = String(body.visualId || "");
  if (!VISUALS.has(visualId)) throw new HttpError(400, "invalid_fields", "Unknown roof.", { fields: ["visualId"] });
  const condition = body.condition == null || body.condition === "" ? null : String(body.condition);
  if (condition !== null && !CONDITIONS.includes(condition)) throw new HttpError(400, "invalid_fields", "Unknown weather.", { fields: ["condition"] });
  if (!p.photo_id) throw new HttpError(409, "conflict", "Add a photo before saving a preview of it.");

  const raw = core.parseDataUrl(body.jpeg, ["image/jpeg"], MAX_BYTES, "mockup").buf;
  const dims = core.jpegSize(raw);
  if (!dims || !dims.w || !dims.h) throw new HttpError(400, "invalid_mockup", "The preview isn't a readable JPEG.");
  if (Math.max(dims.w, dims.h) > MAX_EDGE || Math.min(dims.w, dims.h) < 64) throw new HttpError(400, "invalid_mockup", "The preview is an unexpected size.");

  const have = await db.query("SELECT count(*)::int AS n FROM wvr_mockups WHERE project_id = $1", [p.id]);
  if (have.rows[0].n >= MAX_PER_PROJECT) throw new HttpError(409, "too_many", "That's as many previews as one photo keeps.");
  const r = await limits.hit("mockup_project", p.id, MAX_PER_PROJECT * 2, 24 * 3600);
  if (!r.ok) throw new HttpError(429, "rate_limited", "That's a lot of previews today. Please try again tomorrow.", { retryAfter: r.retryAfter });

  /** @type {{ data: Buffer, info: { width: number, height: number } }} */
  let out;
  try {
    out = await images
      .sharp()(raw, { limitInputPixels: MAX_EDGE * MAX_EDGE, failOn: "error" })
      .flatten({ background: "#ffffff" })
      .toColourspace("srgb")
      .jpeg({ quality: 86, mozjpeg: false })
      .toBuffer({ resolveWithObject: true });
  } catch (err) {
    throw new HttpError(400, "invalid_mockup", "The preview isn't a readable JPEG.");
  }

  const id = crypto.randomUUID();
  const pathname = "projects/" + p.id + "/mockups/" + id + ".jpg";
  await storage().put(pathname, out.data, "image/jpeg");
  /** @type {boolean} */
  let kept;
  try {
    // Counted and added under a lock on the project, so two at once can't both be the twelfth.
    kept = await db.tx(async (t) => {
      await t.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["wvr_mockups:" + p.id]);
      const n = (await t.query("SELECT count(*)::int AS n FROM wvr_mockups WHERE project_id = $1", [p.id])).rows[0].n;
      if (n >= MAX_PER_PROJECT) return false;
      await t.query("INSERT INTO wvr_mockups (id, project_id, photo_id, visual_id, condition, pathname, bytes, w, h) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [
        id,
        p.id,
        p.photo_id,
        visualId,
        condition,
        pathname,
        out.data.length,
        out.info.width,
        out.info.height,
      ]);
      return true;
    });
  } catch (err) {
    await storage().del([pathname]).catch(() => undefined);
    throw err;
  }
  if (!kept) {
    await storage().del([pathname]).catch(() => undefined);
    throw new HttpError(409, "too_many", "That's as many previews as one photo keeps.");
  }
  return json(ctx.res, 201, { ok: true, mockup: { id, visualId, condition } });
}

/**
 * A project's previews, oldest first.
 * @param {string} projectId
 */
async function forProject(projectId) {
  const { rows } = await db.query("SELECT id, photo_id, visual_id, condition, bytes, w, h, created_at FROM wvr_mockups WHERE project_id = $1 ORDER BY created_at, id", [projectId]);
  return rows.map((m) => ({ id: m.id, photoId: m.photo_id, visualId: m.visual_id, condition: m.condition, bytes: m.bytes, w: m.w, h: m.h, createdAt: new Date(m.created_at).toISOString() }));
}

module.exports = { add, forProject, CONDITIONS, MAX_PER_PROJECT, MAX_BYTES };
