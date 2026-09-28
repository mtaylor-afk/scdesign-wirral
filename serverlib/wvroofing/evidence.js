// WV Roofing — plans, drawings and extra photos the customer adds so the roofer
// can measure the roof from them (B3; plan §6 B3).
//
//   POST projects/:id/evidence/presign { contentType, bytes }   -> { uploadId, url, method, headers }
//   POST projects/:id/evidence/commit  { uploadId }             -> { evidence }
//   GET  projects/:id/evidence                                   -> { evidence[] }
//   POST projects/:id/evidence/:evidenceId/delete
//
// Same rules as the house photo: presigned private uploads of a stated type and
// size, the file checked by its first bytes, random server-side names, private
// storage. Photos have their hidden details (GPS, camera) removed; PDFs are
// checked for a PDF header and kept as uploaded, never opened by the server.
// The files go with the project.
"use strict";

const crypto = require("crypto");
const core = require("./core.js");
const db = require("./db.js");
const images = require("./images.js");
const limits = require("./limits.js");
const { UUID_RE } = require("./auth.js");
const { storage } = require("./storage.js");
const { isEnabled } = require("./capabilities.js");

const { HttpError, json, readJson } = core;
const TYPES = /** @type {Record<string, { kind: "image" | "pdf", ext: string }>} */ ({
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/png": { kind: "image", ext: "png" },
  "application/pdf": { kind: "pdf", ext: "pdf" },
});
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 10;
const UPLOAD_TTL_SECONDS = 15 * 60;

/** @typedef {import("./projects.js").ProjectCtx} ProjectCtx */

/** @param {number} n @param {number} dflt */
function envNum(n, dflt) {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : dflt;
}

// Plans and drawings are for measuring the roof: they need storage and the measurement switch.
function requireStorage() {
  if (!isEnabled("enquiry_storage", process.env) || !isEnabled("assisted_measurement", process.env)) {
    throw new HttpError(503, "not_configured", "Adding plans and drawings isn't available right now.");
  }
}

/** @param {Record<string, any>} r */
function out(r) {
  return { id: r.id, kind: r.kind, mime: r.mime, bytes: r.bytes, addedAt: new Date(r.created_at).toISOString() };
}

/** @param {ProjectCtx} ctx */
async function presign(ctx) {
  requireStorage();
  const body = await readJson(ctx.req, 4 * 1024);
  const contentType = String(body.contentType || "").toLowerCase();
  const bytes = Number(body.bytes);
  const t = TYPES[contentType];
  if (!t) throw new HttpError(400, "invalid_type", "Please choose a JPG, PNG or PDF file.");
  if (!Number.isInteger(bytes) || bytes < 1) throw new HttpError(400, "invalid_fields", "The file's size is missing.");
  if (bytes > MAX_BYTES) throw new HttpError(413, "too_large", "That file is over 20 MB. Please choose a smaller copy.");
  const { rows } = await db.query("SELECT count(*)::int AS n FROM wvr_evidence WHERE project_id = $1", [ctx.project.id]);
  if (rows[0].n >= MAX_FILES) throw new HttpError(409, "too_many", "That's " + MAX_FILES + " files already. Please remove one first.");
  const day = 24 * 3600;
  const a = await limits.hit("evidence_project", ctx.project.id, envNum(Number(process.env.WVR_EVIDENCE_PER_PROJECT_DAILY), 20), day);
  if (!a.ok) throw new HttpError(429, "rate_limited", "That's the limit for today on this project.", { retryAfter: a.retryAfter });
  const g = await limits.hit("upload_global", "all", envNum(Number(process.env.WVR_DAILY_UPLOADS), 40), day);
  if (!g.ok) {
    await limits.undo("evidence_project", ctx.project.id, day);
    throw new HttpError(429, "rate_limited", "Uploads have reached today's limit. Please try again tomorrow.", { retryAfter: g.retryAfter });
  }
  const id = crypto.randomUUID();
  const pathname = "projects/" + ctx.project.id + "/incoming/" + id + "." + t.ext;
  const expires = new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000);
  await db.query("INSERT INTO wvr_uploads (id, project_id, kind, pathname, content_type, max_bytes, expires_at) VALUES ($1, $2, 'evidence', $3, $4, $5, $6)", [
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

/**
 * The stored bytes for an uploaded file: photos without their hidden details;
 * PDFs as they are, once they're known to be PDFs.
 * @param {Buffer} buf
 * @param {string} contentType
 */
async function prepare(buf, contentType) {
  const t = TYPES[contentType];
  if (t.kind === "pdf") {
    if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new HttpError(400, "invalid_type", "That file isn't a PDF.");
    return { body: buf, mime: "application/pdf", ext: "pdf", kind: "pdf" };
  }
  const got = await images.processUpload(buf);
  return { body: got.original, mime: got.mime, ext: got.ext, kind: "image" };
}

/** @param {ProjectCtx} ctx */
async function commit(ctx) {
  requireStorage();
  const body = await readJson(ctx.req, 4 * 1024);
  const uploadId = String(body.uploadId || "");
  if (!UUID_RE.test(uploadId)) throw new HttpError(404, "not_found", "That upload doesn't exist.");
  const claim = await db.query(
    "UPDATE wvr_uploads SET consumed_at = now() WHERE id = $1 AND project_id = $2 AND kind = 'evidence' AND consumed_at IS NULL AND expires_at > now() RETURNING pathname, content_type, max_bytes",
    [uploadId, ctx.project.id]
  );
  if (!claim.rows.length) throw new HttpError(404, "not_found", "That upload doesn't exist or has expired. Please choose the file again.");
  const up = claim.rows[0];
  const st = storage();
  const buf = await st.getBuffer(up.pathname);
  try {
    if (!buf) throw new HttpError(400, "upload_missing", "The file didn't finish uploading. Please try again.");
    if (buf.length > up.max_bytes) throw new HttpError(413, "too_large", "The uploaded file is larger than announced.");
    const got = await prepare(buf, up.content_type);
    const id = crypto.randomUUID();
    const pathname = "projects/" + ctx.project.id + "/evidence/" + id + "." + got.ext;
    await st.put(pathname, got.body, got.mime);
    await db.query("INSERT INTO wvr_evidence (id, project_id, kind, mime, bytes, sha256, pathname) VALUES ($1, $2, $3, $4, $5, $6, $7)", [
      id,
      ctx.project.id,
      got.kind,
      got.mime,
      got.body.length,
      crypto.createHash("sha256").update(got.body).digest("hex"),
      pathname,
    ]);
    const { rows } = await db.query("SELECT * FROM wvr_evidence WHERE id = $1", [id]);
    return json(ctx.res, 200, { ok: true, evidence: out(rows[0]) });
  } finally {
    // The raw upload (a photo may still carry GPS data) never outlives this request.
    await st.del([up.pathname]).catch(() => undefined);
  }
}

/** @param {ProjectCtx} ctx */
async function list(ctx) {
  const { rows } = await db.query("SELECT * FROM wvr_evidence WHERE project_id = $1 ORDER BY created_at", [ctx.project.id]);
  return json(ctx.res, 200, { ok: true, evidence: rows.map(out) });
}

/** @param {ProjectCtx} ctx */
async function remove(ctx) {
  const id = String(ctx.params.evidenceId || "");
  if (!UUID_RE.test(id)) throw new HttpError(404, "not_found", "That file doesn't exist.");
  const { rows } = await db.query("DELETE FROM wvr_evidence WHERE id = $1 AND project_id = $2 RETURNING pathname", [id, ctx.project.id]);
  if (!rows[0]) throw new HttpError(404, "not_found", "That file doesn't exist.");
  await storage().del([rows[0].pathname]);
  return json(ctx.res, 200, { ok: true, deleted: true });
}

module.exports = { presign, commit, list, remove, TYPES, MAX_FILES };
