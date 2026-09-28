// WV Roofing — customer project routes (A2): create a project, upload and commit
// the photo, stream it back, save the roof outline, delete everything.
//
//   POST projects                          -> { id, token, expiresAt, capabilities }
//   GET  projects/:id                      -> project state (never contact details)
//   POST projects/:id/consent  { ai }      -> record or withdraw the OpenAI opt-in
//   POST projects/:id/photo/presign { contentType, bytes } -> { uploadId, url, method, headers }
//   POST projects/:id/photo/commit  { uploadId }           -> { photo }
//   GET  projects/:id/photo/display        -> JPEG of the working copy (bearer only)
//   POST projects/:id/mask { png, shapes, displayW, displayH } -> { mask }
//   POST projects/:id/delete               -> photos, outlines and the project, gone
"use strict";

const crypto = require("crypto");
const core = require("./core.js");
const db = require("./db.js");
const images = require("./images.js");
const limits = require("./limits.js");
const auth = require("./auth.js");
const jobs = require("./jobs.js");
const { storage } = require("./storage.js");
const { capabilities, isEnabled } = require("./capabilities.js");

const { HttpError, json, readJson } = core;
const UPLOAD_TTL_SECONDS = 15 * 60;
const PHOTO_TYPES = ["image/jpeg", "image/png"];

/**
 * @typedef {import("./router.js").Ctx & { project: Record<string, any> }} ProjectCtx
 */

function requireStorage() {
  if (!isEnabled("enquiry_storage", process.env)) {
    throw new HttpError(503, "not_configured", "Uploading your own photo isn't available right now. You can still try a sample house.");
  }
}

/** @param {string} name  @param {number} dflt */
function envNum(name, dflt) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : dflt;
}

/**
 * @param {{ ok: boolean, retryAfter: number }} r
 * @param {string} message
 */
function limited(r, message) {
  if (!r.ok) throw new HttpError(429, "rate_limited", message, { retryAfter: r.retryAfter });
}

/** @param {Record<string, any>} row */
function photoOut(row) {
  return { id: row.id, w: row.work_w, h: row.work_h, origW: row.orig_w, origH: row.orig_h, warnings: (row.quality && row.quality.warnings) || [] };
}

/** @param {import("./router.js").Ctx} ctx */
async function create(ctx) {
  requireStorage();
  const body = await readJson(ctx.req, 16 * 1024);
  const ip = limits.ipHash(ctx.req);
  if (ip) limited(await limits.hit("project_create", ip, envNum("WVR_PROJECTS_PER_IP_DAILY", 20), 24 * 3600), "That's a lot of new projects today. Please try again tomorrow.");
  const p = await auth.createProject({
    ipHash: ip,
    uaFamily: auth.uaFamily(ctx.req),
    noticeShown: body.noticeShown === true,
    consentAi: body.consentAi === true,
  });
  return json(ctx.res, 201, { ok: true, id: p.id, token: p.token, expiresAt: p.expiresAt, capabilities: capabilities(process.env) });
}

/** @param {ProjectCtx} ctx */
async function get(ctx) {
  const p = ctx.project;
  let photo = null;
  let mask = null;
  if (p.photo_id) {
    const { rows } = await db.query("SELECT * FROM wvr_photos WHERE id = $1 AND project_id = $2", [p.photo_id, p.id]);
    if (rows[0]) photo = photoOut(rows[0]);
  }
  if (p.mask_id) {
    const { rows } = await db.query("SELECT id, w, h, coverage, editor_meta FROM wvr_masks WHERE id = $1 AND project_id = $2", [p.mask_id, p.id]);
    if (rows[0]) mask = { id: rows[0].id, w: rows[0].w, h: rows[0].h, coverage: rows[0].coverage, shapes: rows[0].editor_meta.shapes };
  }
  // Everything a reloaded page needs to carry on where the customer left off (never contact details).
  const { address, property } = await require("./property.js").summary(p);
  const eq = await db.query("SELECT reference, created_at, delivery_status, status FROM wvr_enquiries WHERE project_id = $1", [p.id]);
  const enquiry = eq.rows[0] ? { reference: eq.rows[0].reference, savedAt: new Date(eq.rows[0].created_at).toISOString() } : null;
  return json(ctx.res, 200, {
    ok: true,
    project: { id: p.id, createdAt: p.created_at, expiresAt: p.expires_at, consentAi: !!p.consent_ai_at, address, property, photo, mask, enquiry },
  });
}

/** @param {ProjectCtx} ctx */
async function consent(ctx) {
  const body = await readJson(ctx.req, 4 * 1024);
  if (typeof body.ai !== "boolean") throw new HttpError(400, "invalid_fields", "Say whether photo-real renders are allowed.");
  await db.tx(async (t) => {
    // Keep the first time it was given; withdrawing it stops any render not yet sent.
    await t.query("UPDATE wvr_projects SET consent_ai_at = CASE WHEN $2 THEN COALESCE(consent_ai_at, now()) END, updated_at = now() WHERE id = $1", [ctx.project.id, body.ai]);
    if (!body.ai) await jobs.closeQueued(t, ctx.project.id, "cancelled", "consent_withdrawn");
  });
  return json(ctx.res, 200, { ok: true, consentAi: body.ai });
}

/** @param {ProjectCtx} ctx */
async function presign(ctx) {
  requireStorage();
  const body = await readJson(ctx.req, 4 * 1024);
  const contentType = String(body.contentType || "").toLowerCase();
  const bytes = Number(body.bytes);
  if (!PHOTO_TYPES.includes(contentType)) throw new HttpError(400, "invalid_image", "Please choose a JPG or PNG photo.");
  if (!Number.isInteger(bytes) || bytes < 1) throw new HttpError(400, "invalid_fields", "The photo's size is missing.");
  if (bytes > images.LIMITS.maxUploadBytes) throw new HttpError(413, "too_large", "That photo is over 20 MB. Please choose a smaller copy.");
  limited(await limits.hit("upload_project", ctx.project.id, envNum("WVR_UPLOADS_PER_PROJECT_DAILY", 10), 24 * 3600), "That's the upload limit for today on this project.");
  limited(await limits.hit("upload_global", "all", envNum("WVR_DAILY_UPLOADS", 40), 24 * 3600), "Photo uploads have reached today's limit. Please try again tomorrow, or use a sample house.");

  const id = crypto.randomUUID();
  const ext = contentType === "image/png" ? "png" : "jpg";
  const pathname = "projects/" + ctx.project.id + "/incoming/" + id + "." + ext;
  const expires = new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000);
  await db.query("INSERT INTO wvr_uploads (id, project_id, kind, pathname, content_type, max_bytes, expires_at) VALUES ($1, $2, 'photo', $3, $4, $5, $6)", [
    id,
    ctx.project.id,
    pathname,
    contentType,
    bytes,
    expires.toISOString(),
  ]);
  const url = await storage().presignPut(pathname, { contentTypes: [contentType], maxBytes: bytes, ttlSeconds: UPLOAD_TTL_SECONDS });
  return json(ctx.res, 200, { ok: true, uploadId: id, url, method: "PUT", headers: { "content-type": contentType }, expiresAt: expires.toISOString() });
}

/** @param {ProjectCtx} ctx */
async function commit(ctx) {
  requireStorage();
  const body = await readJson(ctx.req, 4 * 1024);
  const uploadId = String(body.uploadId || "");
  if (!auth.UUID_RE.test(uploadId)) throw new HttpError(404, "not_found", "That upload doesn't exist.");
  // Claim the upload atomically: only an unconsumed, unexpired upload of THIS project.
  const claim = await db.query(
    "UPDATE wvr_uploads SET consumed_at = now() WHERE id = $1 AND project_id = $2 AND kind = 'photo' AND consumed_at IS NULL AND expires_at > now() RETURNING pathname, content_type, max_bytes",
    [uploadId, ctx.project.id]
  );
  if (!claim.rows.length) {
    const { rows } = await db.query("SELECT consumed_at, expires_at FROM wvr_uploads WHERE id = $1 AND project_id = $2", [uploadId, ctx.project.id]);
    if (!rows.length) throw new HttpError(404, "not_found", "That upload doesn't exist.");
    if (rows[0].consumed_at) throw new HttpError(409, "conflict", "That photo has already been added.");
    throw new HttpError(410, "expired", "That upload link has expired. Please choose the photo again.");
  }
  const up = claim.rows[0];
  const st = storage();
  const buf = await st.getBuffer(up.pathname);
  try {
    if (!buf) throw new HttpError(400, "upload_missing", "The photo didn't finish uploading. Please try again.");
    if (buf.length > up.max_bytes) throw new HttpError(413, "too_large", "The uploaded file is larger than announced.");
    const out = await images.processUpload(buf);
    const photoId = crypto.randomUUID();
    const base = "projects/" + ctx.project.id;
    const originalPath = base + "/originals/" + photoId + "." + out.ext;
    const workingPath = base + "/working/" + photoId + ".png";
    await st.put(originalPath, out.original, out.mime);
    await st.put(workingPath, out.working, "image/png");
    const sha = crypto.createHash("sha256").update(out.original).digest("hex");
    await db.tx(async (t) => {
      await t.query(
        "INSERT INTO wvr_photos (id, project_id, original_path, original_sha256, original_mime, original_bytes, orig_w, orig_h, exif_orientation, working_path, work_w, work_h, quality) " +
          "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
        [photoId, ctx.project.id, originalPath, sha, out.mime, out.original.length, out.origW, out.origH, out.orientation, workingPath, out.workW, out.workH, JSON.stringify(out.quality)]
      );
      // A new photo never reuses the old outline or its renders (brief §15).
      await t.query("UPDATE wvr_projects SET photo_id = $2, mask_id = NULL, updated_at = now() WHERE id = $1", [ctx.project.id, photoId]);
      await jobs.closeQueued(t, ctx.project.id, "superseded", null);
    });
    const { rows } = await db.query("SELECT * FROM wvr_photos WHERE id = $1", [photoId]);
    return json(ctx.res, 200, { ok: true, photo: photoOut(rows[0]) });
  } finally {
    // The raw upload (which may still carry GPS data) never outlives this request.
    await st.del([up.pathname]).catch(() => undefined);
  }
}

/** @param {ProjectCtx} ctx */
async function display(ctx) {
  const p = ctx.project;
  if (!p.photo_id) throw new HttpError(404, "not_found", "This project has no photo yet.");
  const { rows } = await db.query("SELECT working_path FROM wvr_photos WHERE id = $1 AND project_id = $2", [p.photo_id, p.id]);
  if (!rows.length) throw new HttpError(404, "not_found", "This project has no photo yet.");
  const png = await storage().getBuffer(rows[0].working_path);
  if (!png) throw new HttpError(404, "not_found", "The photo couldn't be found.");
  const jpg = await images.displayJpeg(png);
  ctx.res.statusCode = 200;
  ctx.res.setHeader("Content-Type", "image/jpeg");
  ctx.res.setHeader("Content-Length", String(jpg.length));
  ctx.res.setHeader("Cache-Control", "private, no-store");
  ctx.res.end(jpg);
}

/** @param {ProjectCtx} ctx */
async function mask(ctx) {
  const body = await readJson(ctx.req, 1536 * 1024);
  const p = ctx.project;
  if (!p.photo_id) throw new HttpError(409, "conflict", "Add a photo before marking the roof.");
  const { rows } = await db.query("SELECT id, work_w, work_h FROM wvr_photos WHERE id = $1 AND project_id = $2", [p.photo_id, p.id]);
  const photo = rows[0];
  if (!photo) throw new HttpError(409, "conflict", "Add a photo before marking the roof.");
  if (Number(body.displayW) !== photo.work_w || Number(body.displayH) !== photo.work_h) {
    throw new HttpError(409, "superseded", "The photo has changed since this outline was drawn.");
  }
  const png = core.parseDataUrl(body.png, ["image/png"], images.LIMITS.maskMaxBytes, "mask").buf;
  const info = images.maskInfo(png, photo.work_w, photo.work_h);
  if (info.transparentFrac < 0.005 || info.transparentFrac > 0.85) {
    throw new HttpError(400, "invalid_mask", "The marked roof area is too small or too large.");
  }
  const shapes = images.cleanShapes(body.shapes, photo.work_w, photo.work_h);
  const id = crypto.randomUUID();
  await db.tx(async (t) => {
    await t.query("INSERT INTO wvr_masks (id, project_id, photo_id, png, w, h, coverage, editor_meta) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [
      id,
      p.id,
      photo.id,
      png,
      photo.work_w,
      photo.work_h,
      info.transparentFrac,
      JSON.stringify({ shapes, displayW: photo.work_w, displayH: photo.work_h, editorVersion: 1 }),
    ]);
    await t.query("UPDATE wvr_projects SET mask_id = $2, updated_at = now() WHERE id = $1", [p.id, id]);
    // Renders not yet sent were for the old outline; running ones are quarantined when they finish.
    await jobs.closeQueued(t, p.id, "superseded", null);
  });
  return json(ctx.res, 200, { ok: true, mask: { id, coverage: info.transparentFrac } });
}

/**
 * Delete a project's files and rows. Shared by the customer route and retention.
 * @param {string} projectId
 */
async function deleteProject(projectId) {
  // Release the budget held by renders that will now never be sent.
  await db.tx((t) => jobs.closeQueued(t, projectId, "cancelled", "project_deleted"));
  const st = storage();
  const files = await st.list("projects/" + projectId + "/");
  if (files.length) await st.del(files);
  const { rowCount } = await db.query("DELETE FROM wvr_projects WHERE id = $1", [projectId]);
  return { files: files.length, rows: rowCount };
}

/** @param {ProjectCtx} ctx */
async function remove(ctx) {
  const out = await deleteProject(ctx.project.id);
  return json(ctx.res, 200, { ok: true, deleted: true, files: out.files });
}

module.exports = { create, get, consent, presign, commit, display, mask, remove, deleteProject };
