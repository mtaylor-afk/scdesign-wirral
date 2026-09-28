// WV Roofing — enquiries: saved first, notified second (A4; brief §5, plan D13).
//
//   POST enquiries                 { name, phone?, email?, postcode?, product?, message?, consent, source, idempotencyKey }
//   POST enquiry                   the same (kept permanently for older pages)
//   POST projects/:id/enquiry      the same fields + includeImages, from the visualiser
//   GET  projects/:id/enquiry      { enquiry: { reference, savedAt, delivery } | null }
//
// An enquiry is written to the database before anyone is emailed; the email is a
// separate step with bounded retries (a failed email never loses an enquiry).
// The customer gets a reference (WVR-YYMM-XXXX) and a truthful status: the roofer
// has been notified, is being notified, or (while this is a concept) isn't
// notified at all. One enquiry per project, and the same request key always
// returns the same enquiry, so a reload and a second tap never make two.
"use strict";

const crypto = require("crypto");
const core = require("./core.js");
const db = require("./db.js");
const limits = require("./limits.js");
const mailer = require("./mailer.js");
const images = require("./images.js");
const { storage } = require("./storage.js");
const { isEnabled, isTest } = require("./capabilities.js");
const { RETENTION } = require("./retention.js");

const { HttpError, json, readJson, PRODUCTS, oneLine, clean, esc } = core;

const PHONE_RE = /^[+()\d\s-]{7,20}$/;
const POSTCODE_RE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/;
const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;
const REF_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32: no I, L, O or U
const MAX_ATTEMPTS = 3;
const INLINE_WAIT_MS = 8000;
const QUICK_RETRY_MS = 11000;
const ATTACHMENT_MAX_BYTES = 450 * 1024;
const SOURCES = ["roof-replacement", "visualiser", "visualiser-sample"];

/**
 * @typedef {import("./router.js").Ctx} Ctx
 * @typedef {import("./projects.js").ProjectCtx} ProjectCtx
 * @typedef {Record<string, any>} Row
 * @typedef {{ name: string, phone: string, email: string, postcode: string, product: string, message: string, source: string }} Fields
 */

/** @param {string} name @param {number} dflt */
function envNum(name, dflt) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : dflt;
}

/** A new reference: WVR-YYMM-XXXX (UTC year and month, four random base32 characters). */
function newReference() {
  const d = new Date();
  const yymm = String(d.getUTCFullYear() % 100).padStart(2, "0") + String(d.getUTCMonth() + 1).padStart(2, "0");
  const bytes = crypto.randomBytes(4);
  let tail = "";
  for (let i = 0; i < 4; i++) tail += REF_ALPHABET[bytes[i] & 31];
  return "WVR-" + yymm + "-" + tail;
}

/**
 * The form's fields, cleaned, and what's wrong with them.
 * @param {Record<string, any>} body
 */
function validate(body) {
  /** @type {Fields} */
  const d = {
    name: oneLine(body.name, 80),
    phone: oneLine(body.phone, 24),
    email: oneLine(body.email, 120),
    postcode: oneLine(body.postcode, 10).toUpperCase(),
    product: oneLine(body.product, 40),
    message: clean(body.message, 2000),
    source: oneLine(body.source, 40),
  };
  /** @type {string[]} */
  const problems = [];
  if (d.name.length < 2) problems.push("name");
  if (!d.phone && !d.email) problems.push("contact");
  if (d.email && !mailer.EMAIL_RE.test(d.email)) problems.push("email");
  if (d.phone && !PHONE_RE.test(d.phone)) problems.push("phone");
  if (d.postcode && !POSTCODE_RE.test(d.postcode)) problems.push("postcode");
  if (d.product && d.product !== "not-sure" && !PRODUCTS.has(d.product)) problems.push("product");
  if (body.consent !== true) problems.push("consent");
  if (!SOURCES.includes(d.source)) d.source = "roof-replacement";
  return { d, problems };
}

/**
 * Bots fill the hidden "company" field; nobody completes the form in under 2.5 s.
 * A honeypot hit is dropped; a very fast form is kept but never emailed.
 * @param {Record<string, any>} body
 * @returns {"honeypot" | "fast" | null}
 */
function botSignal(body) {
  if (clean(body.company, 100)) return "honeypot";
  const ms = Number(body.elapsedMs);
  if (Number.isFinite(ms) && ms > 0 && ms < 2500) return "fast";
  return null;
}

/** @param {unknown} v */
function iso(v) {
  return v ? new Date(/** @type {any} */ (v)).toISOString() : null;
}

/** How the customer's enquiry stands, in the customer's terms. @param {Row} row */
function deliveryState(row) {
  if (row.delivery_status === "sent") return "sent";
  if (row.status !== "new" || !isEnabled("enquiry_delivery", process.env)) return "off";
  return "pending";
}

/** @param {Row} row @param {boolean} existing */
function view(row, existing) {
  return { ok: true, reference: row.reference, savedAt: iso(row.created_at), delivery: deliveryState(row), existing: existing || undefined };
}

/**
 * Count one enquiry against the per-visitor hourly and overall daily limits.
 * @param {Ctx} ctx
 */
async function chargeLimits(ctx) {
  const ip = limits.ipHash(ctx.req);
  if (ip) {
    const a = await limits.hit("enquiry_ip", ip, envNum("WVR_ENQUIRIES_PER_IP_HOURLY", 5), 3600);
    if (!a.ok) throw new HttpError(429, "rate_limited", "You've sent a few requests already. Please try again a little later.", { retryAfter: a.retryAfter });
  }
  const g = await limits.hit("enquiry_global", "all", envNum("WVR_ENQUIRIES_DAILY", 200), 24 * 3600);
  if (!g.ok) {
    if (ip) await limits.undo("enquiry_ip", ip, 3600);
    throw new HttpError(429, "rate_limited", "We've had a lot of requests today. Please try again tomorrow, or call us.", { retryAfter: g.retryAfter });
  }
  return ip;
}

/** @param {unknown} err */
function isUniqueViolation(err) {
  return !!err && typeof err === "object" && String(/** @type {any} */ (err).code) === "23505";
}

/**
 * Save an enquiry (a new reference is drawn if one is already taken). For a
 * project enquiry the project, its photo and renders are kept for 12 months,
 * with the enquiry, instead of 30 days.
 * @param {{ projectId: string | null, key: string, d: Fields, includeImages: boolean, snapshot: object, status: string, ipHash: string | null }} o
 * @returns {Promise<{ row: Row, existing: boolean }>}
 */
async function save(o) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const row = await db.tx(async (t) => {
        const ins = await t.query(
          "INSERT INTO wvr_enquiries (id, reference, project_id, idempotency_key, source, contact_name, contact_email, contact_phone, postcode, visual_id, notes, include_images, snapshot, status, ip_hash) " +
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *",
          [
            crypto.randomUUID(),
            newReference(),
            o.projectId,
            o.key,
            o.d.source,
            o.d.name,
            o.d.email || null,
            o.d.phone || null,
            o.d.postcode || null,
            o.d.product || null,
            o.d.message || null,
            o.includeImages,
            JSON.stringify(o.snapshot),
            o.status,
            o.ipHash,
          ]
        );
        if (o.projectId) {
          await t.query("UPDATE wvr_projects SET expires_at = GREATEST(expires_at, now() + make_interval(months => $2)), updated_at = now() WHERE id = $1", [o.projectId, RETENTION.enquiryMonths]);
        }
        return ins.rows[0];
      });
      return { row, existing: false };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Another request saved this enquiry first (same key, or the project's one enquiry)...
      const again = o.projectId
        ? await db.query("SELECT * FROM wvr_enquiries WHERE project_id = $1", [o.projectId])
        : await db.query("SELECT * FROM wvr_enquiries WHERE project_id IS NULL AND idempotency_key = $1", [o.key]);
      if (again.rows[0]) return { row: again.rows[0], existing: true };
      // ...or the reference was taken: draw another.
    }
  }
  throw new HttpError(500, "server_error", "Your enquiry couldn't be saved. Please try again.");
}

/**
 * What the project looked like when the enquiry was sent: ids and versions,
 * never images or links.
 * @param {Row} p  the project row
 * @param {string} visualId
 */
async function snapshotFor(p, visualId) {
  /** @type {Record<string, any>} */
  const snap = { takenAt: new Date().toISOString(), project: { id: p.id, createdAt: iso(p.created_at) }, consentAi: !!p.consent_ai_at, visualId: visualId || null };
  if (p.photo_id) {
    const ph = await db.query("SELECT id, work_w, work_h, orig_w, orig_h, quality FROM wvr_photos WHERE id = $1 AND project_id = $2", [p.photo_id, p.id]);
    const r = ph.rows[0];
    if (r) snap.photo = { id: r.id, w: r.work_w, h: r.work_h, origW: r.orig_w, origH: r.orig_h, warnings: (r.quality && r.quality.warnings) || [] };
  }
  if (p.mask_id) {
    const mk = await db.query("SELECT id, coverage FROM wvr_masks WHERE id = $1 AND project_id = $2", [p.mask_id, p.id]);
    if (mk.rows[0]) snap.mask = { id: mk.rows[0].id, coverage: Math.round(Number(mk.rows[0].coverage) * 1000) / 1000 };
  }
  if (p.photo_id && p.mask_id) {
    const js = await db.query(
      "SELECT id, visual_id, model, quality, prompt_version, catalogue_version FROM wvr_jobs WHERE project_id = $1 AND photo_id = $2 AND mask_id = $3 AND status = 'succeeded' AND NOT quarantined ORDER BY finished_at",
      [p.id, p.photo_id, p.mask_id]
    );
    snap.renders = js.rows.map((j) => ({ id: j.id, visualId: j.visual_id, model: j.model, quality: j.quality, promptVersion: j.prompt_version, catalogueVersion: j.catalogue_version }));
  }
  snap.address = null;
  snap.property = null;
  if (p.address_id) {
    const ad = await db.query("SELECT * FROM wvr_addresses WHERE id = $1 AND project_id = $2", [p.address_id, p.id]);
    const r = ad.rows[0];
    if (r) {
      const lines = typeof r.lines === "string" ? JSON.parse(r.lines) : r.lines || [];
      snap.address = { id: r.id, provider: r.provider, lines, postTown: r.post_town, postcode: r.postcode, uprn: r.uprn, udprn: r.udprn, lat: r.lat, lng: r.lng, coordSource: r.coord_source, dataset: r.dataset };
    }
  }
  if (p.property_confirmation_id) {
    const pc = await db.query("SELECT * FROM wvr_property_confirmations WHERE id = $1 AND project_id = $2", [p.property_confirmation_id, p.id]);
    const r = pc.rows[0];
    if (r) {
      const reasons = typeof r.ambiguity_reasons === "string" ? JSON.parse(r.ambiguity_reasons) : r.ambiguity_reasons || [];
      snap.property = { id: r.id, propertyType: r.property_type, pinShown: r.pin_shown, pinConfirmed: r.pin_confirmed, ambiguous: r.ambiguous, reasons };
    }
  }
  // Filled in by Release B: measurement and quantities (only when shown to the customer).
  snap.measurement = null;
  return snap;
}

const PROPERTY_WORDS = /** @type {Record<string, string>} */ ({
  detached: "Detached house",
  semi: "Semi-detached house",
  end_terrace: "End of terrace",
  mid_terrace: "Mid terrace",
  bungalow: "Bungalow",
  flat: "Flat or maisonette",
  other: "Other",
  not_sure: "Not sure",
});

const REASON_WORDS = /** @type {Record<string, string>} */ ({
  no_rooftop_coordinate: "the address has no rooftop location (postcode area only)",
  not_seen_from_above: "the house wasn't checked on an aerial view",
  pin_not_confirmed: "the customer didn't confirm the pin on the aerial view",
  shared_roof: "the roof is shared with a neighbour",
  flat_or_shared_block: "a flat, so the roof may belong to the block",
  property_type_unclear: "the kind of property is unclear",
});

// ---------------------------------------------------------------------------
// routes

/** @param {Record<string, any>} body */
function requestKey(body) {
  const key = String(body.idempotencyKey || "");
  if (!KEY_RE.test(key)) throw new HttpError(400, "invalid_fields", "The request key is missing. Please reload the page and try again.", { fields: ["idempotencyKey"] });
  return key;
}

/**
 * Enquiries without a project: the roof-replacement form, and the visualiser
 * when a sample house was used.
 * @param {Ctx} ctx
 */
async function createFree(ctx) {
  const body = await readJson(ctx.req, 64 * 1024);
  const bot = botSignal(body);
  if (bot === "honeypot") return json(ctx.res, 200, { ok: true });
  const { d, problems } = validate(body);
  if (problems.length) throw new HttpError(400, "invalid_fields", "Please check the form and try again.", { fields: problems });
  // 200, not 503: a concept site that isn't collecting enquiries yet is an expected state.
  if (!isEnabled("enquiry_storage", process.env)) return json(ctx.res, 200, { ok: false, error: "not_configured", message: "This concept site isn't collecting enquiries yet." });
  const key = requestKey(body);
  const have = await db.query("SELECT * FROM wvr_enquiries WHERE project_id IS NULL AND idempotency_key = $1", [key]);
  if (have.rows[0]) return json(ctx.res, 200, view(have.rows[0], true));
  const ipHash = await chargeLimits(ctx);
  const saved = await save({ projectId: null, key, d, includeImages: false, snapshot: { takenAt: new Date().toISOString(), source: d.source }, status: bot ? "spam_suspected" : "new", ipHash });
  return answer(ctx, saved);
}

/**
 * The visualiser's enquiry about the customer's own photo.
 * @param {ProjectCtx} ctx
 */
async function createForProject(ctx) {
  const body = await readJson(ctx.req, 64 * 1024);
  const bot = botSignal(body);
  if (bot === "honeypot") return json(ctx.res, 200, { ok: true });
  const { d, problems } = validate(Object.assign({}, body, { source: "visualiser" }));
  if (problems.length) throw new HttpError(400, "invalid_fields", "Please check the form and try again.", { fields: problems });
  const key = requestKey(body);
  const p = ctx.project;
  const have = await db.query("SELECT * FROM wvr_enquiries WHERE project_id = $1", [p.id]);
  if (have.rows[0]) return json(ctx.res, 200, view(have.rows[0], true));
  const ipHash = await chargeLimits(ctx);
  const saved = await save({
    projectId: p.id,
    key: "p:" + p.id + ":" + key,
    d,
    includeImages: body.includeImages === true,
    snapshot: await snapshotFor(p, d.product),
    status: bot ? "spam_suspected" : "new",
    ipHash,
  });
  return answer(ctx, saved);
}

/** @param {ProjectCtx} ctx */
async function getForProject(ctx) {
  const { rows } = await db.query("SELECT * FROM wvr_enquiries WHERE project_id = $1", [ctx.project.id]);
  const r = rows[0];
  return json(ctx.res, 200, { ok: true, enquiry: r ? { reference: r.reference, savedAt: iso(r.created_at), delivery: deliveryState(r) } : null });
}

/**
 * Reply once the enquiry is saved: try to notify the roofer straight away
 * (a few seconds at most), and carry on in the background if it takes longer.
 * @param {Ctx} ctx
 * @param {{ row: Row, existing: boolean }} saved
 */
async function answer(ctx, saved) {
  let row = saved.row;
  if (!saved.existing && row.status === "new" && isEnabled("enquiry_delivery", process.env)) {
    const jobs = require("./jobs.js");
    const work = jobs.background(() => deliverWithRetry(row.id));
    await within(work, INLINE_WAIT_MS);
    const fresh = await db.query("SELECT * FROM wvr_enquiries WHERE id = $1", [row.id]);
    if (fresh.rows[0]) row = fresh.rows[0];
  }
  return json(ctx.res, saved.existing ? 200 : 201, view(row, saved.existing));
}

/**
 * Wait for p, but no longer than ms.
 * @param {Promise<unknown>} p
 * @param {number} ms
 */
function within(p, ms) {
  /** @type {NodeJS.Timeout | undefined} */
  let timer;
  return Promise.race([p, new Promise((r) => (timer = setTimeout(r, ms)))]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------
// delivery

/**
 * When a failed send may be tried again: 10 seconds after the first attempt,
 * then the next daily sweep. (Immediately in the test environment.)
 * @param {number} attempts  attempts made so far
 */
function retryDelaySeconds(attempts) {
  if (isTest(process.env)) return 0;
  return attempts <= 1 ? 10 : 6 * 3600;
}

/**
 * Deliver an enquiry, and if that fails outright, try once more shortly after.
 * @param {string} id
 */
async function deliverWithRetry(id) {
  const first = await deliver(id);
  if (first !== "failed") return first;
  await new Promise((r) => setTimeout(r, isTest(process.env) ? 20 : QUICK_RETRY_MS));
  return deliver(id);
}

/**
 * One delivery attempt, if one is due. Returns the outcome, or null when there
 * was nothing to do (already sent, not due, out of attempts, delivery off).
 * The operator's resend ({ force: true }) sends whatever the state, unless a
 * send is in progress right now.
 * @param {string} id
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<"sent" | "failed" | "uncertain" | null>}
 */
async function deliver(id, opts) {
  if (!isEnabled("enquiry_delivery", process.env)) return null;
  const set = "UPDATE wvr_enquiries SET delivery_status = 'sending', delivery_attempts = delivery_attempts + 1, delivery_lease_until = now() + interval '3 minutes', updated_at = now() ";
  const claim =
    opts && opts.force
      ? await db.query(set + "WHERE id = $1 AND (delivery_status <> 'sending' OR delivery_lease_until < now()) RETURNING *", [id])
      : await db.query(
          set + "WHERE id = $1 AND status = 'new' AND delivery_status IN ('pending', 'failed') AND delivery_attempts < $2 AND (next_attempt_at IS NULL OR next_attempt_at <= now()) RETURNING *",
          [id, MAX_ATTEMPTS]
        );
  const e = claim.rows[0];
  if (!e) return null;
  /** @type {import("./mailer.js").SendResult} */
  let r;
  try {
    r = await mailer.send(await buildMessage(e));
  } catch (err) {
    r = { outcome: "failed", error: "building the email: " + (err instanceof Error ? err.message : String(err)) };
  }
  if (r.outcome === "sent") {
    await db.query(
      "UPDATE wvr_enquiries SET delivery_status = 'sent', delivered_at = now(), message_id = $2, delivery_error = NULL, delivery_lease_until = NULL, next_attempt_at = NULL, updated_at = now() WHERE id = $1",
      [id, r.messageId || null]
    );
  } else if (r.outcome === "uncertain") {
    // It may have been sent: never repeated automatically (the operator can resend).
    await db.query("UPDATE wvr_enquiries SET delivery_status = 'uncertain', delivery_error = $2, delivery_lease_until = NULL, updated_at = now() WHERE id = $1", [id, r.error || null]);
  } else {
    await db.query(
      "UPDATE wvr_enquiries SET delivery_status = 'failed', delivery_error = $2, delivery_lease_until = NULL, next_attempt_at = now() + make_interval(secs => $3), updated_at = now() WHERE id = $1",
      [id, r.error || null, retryDelaySeconds(Number(e.delivery_attempts))]
    );
  }
  return r.outcome;
}

/**
 * A JPEG of at most 1100 px and 450 KB, for attaching.
 * @param {Buffer} buf
 */
async function smallJpeg(buf) {
  for (let q = 80; ; q -= 15) {
    const out = await images.sharp()(buf).resize({ width: 1100, height: 1100, fit: "inside", withoutEnlargement: true }).jpeg({ quality: q }).toBuffer();
    if (out.length <= ATTACHMENT_MAX_BYTES || q <= 35) return out;
  }
}

/**
 * The before photo and the chosen roof's photo-real render, as they were when
 * the enquiry was sent (if the customer asked for them and they still exist).
 * @param {Row} e
 */
async function attachmentsFor(e) {
  /** @type {import("./mailer.js").Attachment[]} */
  const out = [];
  if (!e.include_images || !e.project_id) return out;
  const snap = typeof e.snapshot === "string" ? JSON.parse(e.snapshot) : e.snapshot || {};
  const st = storage();
  if (snap.photo && snap.photo.id) {
    const ph = await db.query("SELECT working_path FROM wvr_photos WHERE id = $1 AND project_id = $2", [snap.photo.id, e.project_id]);
    const png = ph.rows[0] ? await st.getBuffer(ph.rows[0].working_path) : null;
    if (png) out.push({ filename: "before.jpg", content: await smallJpeg(png), contentType: "image/jpeg" });
  }
  const render = (snap.renders || []).find((/** @type {any} */ r) => r.visualId === e.visual_id);
  if (render) {
    const j = await db.query("SELECT composite_path FROM wvr_jobs WHERE id = $1 AND project_id = $2 AND status = 'succeeded' AND NOT quarantined", [render.id, e.project_id]);
    const jpg = j.rows[0] && j.rows[0].composite_path ? await st.getBuffer(j.rows[0].composite_path) : null;
    if (jpg) out.push({ filename: "after-" + e.visual_id + "-ai-concept.jpg", content: await smallJpeg(jpg), contentType: "image/jpeg" });
  }
  return out;
}

/**
 * The email to the roofer: a summary, and at most two images. No links or keys.
 * @param {Row} e
 * @returns {Promise<import("./mailer.js").Message>}
 */
async function buildMessage(e) {
  const snap = typeof e.snapshot === "string" ? JSON.parse(e.snapshot) : e.snapshot || {};
  const product = e.visual_id && PRODUCTS.get(e.visual_id);
  const renderNames = (snap.renders || [])
    .map((/** @type {any} */ r) => PRODUCTS.get(r.visualId))
    .filter(Boolean)
    .map((/** @type {any} */ p) => p.name);
  /** @type {[string, string][]} */
  const rows = [
    ["Reference", e.reference],
    ["Name", e.contact_name],
    ["Phone", e.contact_phone || "-"],
    ["Email", e.contact_email || "-"],
    ["Postcode", e.postcode || "-"],
    ["Roof choice", product ? product.name + " - " + product.colourName : e.visual_id === "not-sure" ? "Not sure yet" : "-"],
    ["Message", e.notes || "-"],
    ["From page", e.source],
  ];
  if (snap.address) {
    const a = snap.address;
    rows.push(["Property address", a.lines.concat(a.postTown ? [a.postTown] : [], a.postcode ? [a.postcode] : []).join(", ") + (a.provider === "manual" ? " (typed in)" : "") + (a.dataset === "nyb" ? " (new build)" : "")]);
  }
  if (snap.property) {
    const pr = snap.property;
    rows.push(["Property", (PROPERTY_WORDS[pr.propertyType] || pr.propertyType) + (pr.pinConfirmed ? ", confirmed on the aerial view" : "")]);
    if (pr.reasons.length) rows.push(["Check before quoting", pr.reasons.map((/** @type {string} */ r) => REASON_WORDS[r] || r).join("; ")]);
  }
  if (snap.photo) {
    rows.push(["Their photo", snap.photo.origW + " x " + snap.photo.origH + " px" + (snap.mask ? ", roof outline covers " + Math.round(snap.mask.coverage * 100) + "% of it" : ", roof not marked")]);
    rows.push(["Photo-real renders", renderNames.length ? renderNames.join(", ") : "none"]);
  }
  const attachments = await attachmentsFor(e);
  const saved = new Date(e.created_at).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const foot = "Saved in the WV Roofing enquiry store at " + saved + ", before this email was sent. Visualiser images are AI concept illustrations, not photographs of finished work.";
  const text =
    "New roof survey request from the WV Roofing concept site\n\n" +
    rows.map(([k, v]) => k + ": " + v).join("\n") +
    (attachments.length ? "\n\nAttached: " + attachments.map((a) => a.filename).join(", ") : "") +
    "\n\n" +
    foot;
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1d2129">' +
    '<h2 style="font-family:Georgia,serif;color:#1b2a4a;margin:0 0 12px">New roof survey request ' +
    esc(e.reference) +
    "</h2>" +
    '<p style="margin:0 0 14px;color:#555">From the WV Roofing concept site.</p>' +
    '<table cellpadding="6" style="border-collapse:collapse">' +
    rows
      .map(
        ([k, v]) =>
          '<tr><td style="border-bottom:1px solid #eee;color:#666;vertical-align:top;white-space:nowrap">' +
          esc(k) +
          '</td><td style="border-bottom:1px solid #eee;white-space:pre-wrap">' +
          esc(v) +
          "</td></tr>"
      )
      .join("") +
    "</table>" +
    (attachments.length ? '<p style="color:#555">Attached: ' + esc(attachments.map((a) => a.filename).join(", ")) + "</p>" : "") +
    '<p style="color:#888;font-size:12px;margin-top:18px">' +
    esc(foot) +
    "</p></div>";
  return {
    to: mailer.recipients(),
    replyTo: e.contact_email && mailer.EMAIL_RE.test(e.contact_email) ? e.contact_email : undefined,
    subject: oneLine("WV Roofing enquiry " + e.reference + ": " + e.contact_name + (e.postcode ? " (" + e.postcode + ")" : ""), 160),
    text,
    html,
    attachments,
  };
}

// ---------------------------------------------------------------------------
// the daily sweep (cron)

/**
 * Settle stuck sends, retry failed ones that are due, and delete enquiries
 * older than 12 months.
 */
async function sweep() {
  // A send that never reported back may have gone out: uncertain, not resent.
  const stuck = await db.query(
    "UPDATE wvr_enquiries SET delivery_status = 'uncertain', delivery_error = coalesce(delivery_error, 'no answer from the send'), delivery_lease_until = NULL, updated_at = now() " +
      "WHERE delivery_status = 'sending' AND delivery_lease_until < now()"
  );
  let delivered = 0;
  if (isEnabled("enquiry_delivery", process.env)) {
    const due = await db.query(
      "SELECT id FROM wvr_enquiries WHERE status = 'new' AND delivery_status IN ('pending', 'failed') AND delivery_attempts < $1 AND (next_attempt_at IS NULL OR next_attempt_at <= now()) " +
        "AND created_at > now() - interval '7 days' ORDER BY created_at LIMIT 20",
      [MAX_ATTEMPTS]
    );
    for (const r of due.rows) if ((await deliver(r.id)) === "sent") delivered++;
  }
  const old = await db.query("DELETE FROM wvr_enquiries WHERE created_at < now() - make_interval(months => $1)", [RETENTION.enquiryMonths]);
  return { enquiriesUncertain: stuck.rowCount, enquiriesDelivered: delivered, enquiriesDeleted: old.rowCount };
}

module.exports = { createFree, createForProject, getForProject, deliver, sweep, newReference, validate, buildMessage, MAX_ATTEMPTS };
