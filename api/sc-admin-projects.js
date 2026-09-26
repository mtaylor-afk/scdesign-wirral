/**
 * SC Design Wirral — projects CMS: the admin's read/write endpoint.
 *
 * Requires a valid admin session. Backs the Content → Projects screens: it lists
 * Sean's case studies, opens one for editing, saves drafts, stages photos in the
 * private `project-media` bucket and records his running order. Reads and writes
 * the Supabase `sc_projects` / `sc_project_events` tables (see db/sc_projects.sql).
 *
 * NOTHING here touches the live website. Supabase is the EDITING store; the
 * public site is built from content/projects/*.json in git, so going live —
 * and coming back off it, and deleting — is api/sc-admin-publish.js's job alone.
 * That separation is the whole point: a save can never publish by accident.
 *
 * Surface:
 *   GET  ?view=list                 → the running order, summary fields only
 *   GET  ?view=one&slug=<slug>      → the full content JSON + staged media
 *   POST {action:"save"|"upload"|"delete-media"|"reorder", ...}
 */

const {
  applyCors,
  isAllowedOrigin,
  requireSession,
  readJsonBody,
  clientIp,
  trustedClientIp,
  visitorHash,
  sbSelectProjects,
  sbGetProject,
  sbUpsertProject,
  sbSetProjectOrder,
  sbInsertProjectEvent,
  sbStorageUpload,
  sbStorageList,
  sbStorageDeleteMany,
  sbStorageSignedUrl,
} = require("../serverlib/common");

const {
  projectSchema,
  imageSchema,
  validateProject,
  MAX_IMAGE_BYTES,
  sniffImage,
} = require("../serverlib/cms");

/**
 * Writes dispatch on an explicit list and an unknown action is REJECTED (400),
 * not clamped to a default. This deliberately inverts the "clamp, don't reject"
 * rule the read endpoints follow (sc-admin-error-logs.js clamps `kind`): a
 * mistyped read gives you the wrong page, a mistyped write changes state.
 */
const VALID_ACTIONS = ["save", "upload", "delete-media", "reorder"];

/** Reads DO clamp: an unknown `view` is the harmless list. */
const VALID_VIEWS = ["list", "one"];

const LIST_PAGE_DEFAULT = 200; // a one-man practice; one request should cover it
const LIST_PAGE_MAX = 200;
const MAX_ORDER_SLUGS = 500;
const PREVIEW_TTL = 3600; // signed-URL lifetime, seconds
const MAX_PREVIEW_FILES = 60; // bound the work when a folder holds junk

/**
 * Cheap pre-check before decoding: base64 inflates by 4/3, so anything longer
 * than this cannot possibly fit under the cap. readJsonBody() has NO size limit
 * (Vercel rejects bodies over 4.5 MB before we run), so refusing on the encoded
 * length saves allocating a Buffer for a payload we are going to throw away.
 */
const MAX_BASE64_CHARS = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 8;

/** Content type is derived from the sniffed bytes, never from the client. */
const MIME = { jpg: "image/jpeg", png: "image/png" };

// ---------------------------------------------------------------------------
// Rate limiting (write branch only)
// ---------------------------------------------------------------------------
// Per-instance and best-effort — it resets on a cold start and each serverless
// instance keeps its own Map, exactly like the limiter in sc-admin-login.js.
// This is not a security control (the session already is one); it is a damper on
// a runaway client, e.g. an admin page stuck in a save loop. 120 writes per 10
// minutes is far more than a person editing prose and photos will ever need.
const writeHits = new Map(); // ip -> { count, first }
const RL_WINDOW_MS = 10 * 60 * 1000;
const RL_MAX_WRITES = 120;

function rateLimited(ip) {
  const now = Date.now();
  // Keep the Map from growing without bound on a long-lived instance.
  if (writeHits.size > 500) {
    for (const [k, v] of writeHits) if (now - v.first > RL_WINDOW_MS) writeHits.delete(k);
  }
  const rec = writeHits.get(ip);
  if (!rec || now - rec.first > RL_WINDOW_MS) {
    writeHits.set(ip, { count: 1, first: now });
    return false;
  }
  rec.count += 1;
  return rec.count > RL_MAX_WRITES;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * Validate against the very schema pieces the content JSON is checked with, so
 * this endpoint and serverlib/cms.js can never disagree about what a slug or an
 * image filename is.
 */
function isSlug(v) {
  return projectSchema.shape.slug.safeParse(v).success;
}

function isImageFile(v) {
  return imageSchema.shape.file.safeParse(v).success;
}

function fail(res, status, error) {
  res.statusCode = status;
  return res.end(JSON.stringify({ ok: false, error }));
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Append one row to the sc_project_events audit trail. `actor` is read from the
 * environment server-side: the session token carries only {exp}, so a username
 * in the request body would be attacker-chosen. `ip_hash` is the cookieless
 * daily hash — never a raw IP.
 */
async function logEvent(req, entry) {
  try {
    const ua = String(req.headers["user-agent"] || "").slice(0, 512);
    await sbInsertProjectEvent({
      slug: entry.slug || null,
      action: entry.action || null,
      outcome: entry.outcome || null,
      detail: entry.detail || null,
      commit_sha: null, // only publishing produces a commit
      actor: process.env.SC_ADMIN_USER || null,
      ip_hash: visitorHash(clientIp(req), ua, "scdesign"),
    });
  } catch {
    /* audit logging must never block or break an edit */
  }
}

/**
 * Decode a base64 image payload. Accepts a bare base64 string or a
 * `data:image/...;base64,` data URL, because a browser FileReader hands back the
 * latter. Returns { ok, buf } or { ok:false, status, error } with a message
 * written for Sean to read.
 */
function decodeImage(dataBase64) {
  if (typeof dataBase64 !== "string" || !dataBase64) {
    return { ok: false, status: 400, error: "No image data was sent." };
  }
  const comma = dataBase64.indexOf(",");
  const body = /^data:/i.test(dataBase64) && comma !== -1 ? dataBase64.slice(comma + 1) : dataBase64;
  const clean = body.replace(/\s+/g, "");
  if (clean.length > MAX_BASE64_CHARS) {
    return { ok: false, status: 413, error: "That image is too large. Please use one under 1.2 MB." };
  }
  // Buffer.from(…, "base64") silently ignores anything it doesn't recognise, so
  // check the alphabet first rather than decoding whatever it feels like.
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) {
    return { ok: false, status: 400, error: "That image could not be read. Please try again." };
  }
  let buf;
  try {
    buf = Buffer.from(clean, "base64");
  } catch {
    return { ok: false, status: 400, error: "That image could not be read. Please try again." };
  }
  if (!buf.length) {
    return { ok: false, status: 400, error: "That image file is empty." };
  }
  return { ok: true, buf };
}

/**
 * What is ACTUALLY staged in the bucket for this slug, with a preview URL and a
 * byte count where we can get one.
 *
 * Listing the bucket rather than reading content.images is the point: it is the
 * only way the editor can show an orphaned upload (staged but not in the JSON)
 * or a missing file (in the JSON but never uploaded). A failed signature yields
 * `url: null` — a broken thumbnail must never break the whole editor screen.
 */
async function stagedMedia(slug) {
  const keys = (await sbStorageList(slug)).slice(0, MAX_PREVIEW_FILES);
  return Promise.all(
    keys.map(async (key) => {
      const file = key.startsWith(`${slug}/`) ? key.slice(slug.length + 1) : key;
      const url = await sbStorageSignedUrl(key, PREVIEW_TTL);
      return { file, url, bytes: await measure(url) };
    })
  );
}

/**
 * Best-effort size of a staged object, via a HEAD on its signed URL.
 *
 * sbStorageList() returns keys only (it drops Storage's per-object metadata), and
 * the honest alternative — downloading every image to measure it — would pull up
 * to 48 MB every time Sean opens a project. So the size is nice-to-have: null
 * whenever the HEAD is unsupported, slow or unsigned, never an error.
 */
async function measure(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const n = parseInt(res.headers.get("content-length") || "", 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * The running order. Summary fields only — the list must stay small, so the
 * `content` jsonb is read (for the title, town, stage and image count) but never
 * returned. Order comes from the query: sort_order ascending, nulls last, then
 * most recently edited first.
 */
async function viewList(req, res) {
  const url = new URL(req.url, "http://x");
  let pageSize = parseInt(url.searchParams.get("pageSize"), 10);
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = LIST_PAGE_DEFAULT;
  if (pageSize > LIST_PAGE_MAX) pageSize = LIST_PAGE_MAX;
  let page = parseInt(url.searchParams.get("page"), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;

  const { rows, total } = await sbSelectProjects(pageSize, (page - 1) * pageSize);
  const out = (rows || []).map((r) => {
    const c = r && r.content && typeof r.content === "object" ? r.content : {};
    return {
      slug: r.slug,
      title: typeof c.title === "string" ? c.title : "",
      town: typeof c.town === "string" ? c.town : "",
      stage: typeof c.stage === "string" ? c.stage : "",
      status: r.status === "published" ? "published" : "draft",
      sortOrder: Number.isFinite(r.sort_order) ? r.sort_order : null,
      imageCount: Array.isArray(c.images) ? c.images.length : 0,
      updatedAt: r.updated_at || null,
      publishedAt: r.published_at || null,
      lastPublishSha: r.last_publish_sha || null,
    };
  });

  return res.end(
    JSON.stringify({
      ok: true,
      rows: out,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      generatedAt: nowIso(),
    })
  );
}

/** One project: the full content JSON, its publication meta, and staged media. */
async function viewOne(req, res) {
  const url = new URL(req.url, "http://x");
  const slug = url.searchParams.get("slug") || "";
  if (!isSlug(slug)) return fail(res, 400, "slug");

  const row = await sbGetProject(slug);
  if (!row) return fail(res, 404, "not_found");

  // Storage is listed independently of the JSON; a failure there must not hide
  // the prose Sean came to edit, so it degrades to "nothing staged".
  let media = [];
  let mediaError = null;
  try {
    media = await stagedMedia(slug);
  } catch (err) {
    mediaError = "Staged photos could not be listed.";
    console.error("sc-admin-projects media list error", err && err.message);
  }

  const content = row.content && typeof row.content === "object" ? row.content : null;
  const declared = content && Array.isArray(content.images) ? content.images : [];
  const staged = new Set(media.map((m) => m.file));
  const declaredNames = new Set(declared.map((i) => i && i.file).filter(Boolean));

  return res.end(
    JSON.stringify({
      ok: true,
      project: content,
      meta: {
        status: row.status === "published" ? "published" : "draft",
        sortOrder: Number.isFinite(row.sort_order) ? row.sort_order : null,
        updatedAt: row.updated_at || null,
        publishedAt: row.published_at || null,
        lastPublishSha: row.last_publish_sha || null,
      },
      // `inContent: false` is an orphan (staged but unused); `missingFiles` are
      // referenced by the JSON with nothing staged behind them. Both are shown
      // rather than quietly reconciled — only Sean knows which is the mistake.
      media: media.map((m) => Object.assign({}, m, { inContent: declaredNames.has(m.file) })),
      missingFiles: [...declaredNames].filter((f) => !staged.has(f)),
      mediaError,
      generatedAt: nowIso(),
    })
  );
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Save a draft. Never touches the live site and never changes publication state.
 *
 * The body's `status` is IGNORED — not trusted and not merged. The effective
 * status is read from the stored row (a new project is always a draft), so a
 * client cannot promote anything to "published" here; that word only means
 * something once api/sc-admin-publish.js has committed the file to git. Keeping
 * an already-live project's status as "published" also means an edit to a page
 * the public can see is held to the full publish-grade content rules (homeowner
 * permission included), which is right: the next publish overwrites that page.
 */
async function actionSave(req, res, body) {
  const input = body.project;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    await logEvent(req, { action: "save", outcome: "refused", detail: "no project object" });
    return fail(res, 400, "project");
  }

  const claimed = typeof input.status === "string" ? input.status : null;

  // 422 with the problems VERBATIM: these messages are written for Sean, and
  // paraphrasing them here would lose the field path the form highlights.
  const refuse = async (slug, problems) => {
    await logEvent(req, {
      slug: slug || null,
      action: "save",
      outcome: "refused",
      detail: JSON.stringify(problems),
    });
    res.statusCode = 422;
    return res.end(JSON.stringify({ ok: false, problems }));
  };

  // Validate at draft grade FIRST, before any database round trip. Server-derived
  // keys are spread LAST so the client cannot forge them (sc-error-collect.js:
  // 110-121 is the precedent). Draft rules are a strict subset of published-grade
  // rules — homeowner permission is the only publish-only check — so nothing
  // reported here is a false alarm, and a content mistake comes back as a 422
  // even if Supabase is having a bad minute.
  const first = validateProject(Object.assign({}, input, { status: "draft" }));
  if (!first.ok) return refuse(typeof input.slug === "string" ? input.slug : null, first.problems);

  // Only now is the row read, to derive the status. The schema has already proved
  // the slug is a slug, so this cannot put anything odd into the query.
  const existing = await sbGetProject(first.project.slug);
  const status = existing && existing.status === "published" ? "published" : "draft";

  // An edit to a page the public can already see is re-checked at publish grade.
  let result = first;
  if (status === "published") {
    result = validateProject(Object.assign({}, input, { status }));
    if (!result.ok) return refuse(first.project.slug, result.problems);
  }

  const project = result.project;
  const up = await sbUpsertProject({
    slug: project.slug,
    content: project,
    status,
    updated_by: process.env.SC_ADMIN_USER || null,
    // sc_projects has a touch trigger for updates; setting this covers the
    // insert path too and doesn't depend on the trigger being in place.
    updated_at: nowIso(),
    // published_at, last_publish_sha and sort_order are deliberately absent:
    // merge-duplicates only writes the columns sent, so a save leaves the
    // publication record and Sean's running order exactly as they were.
  });
  if (!up.ok) {
    await logEvent(req, {
      slug: project.slug,
      action: "save",
      outcome: "error",
      detail: `upsert ${up.status}: ${String(up.error || "").slice(0, 500)}`,
    });
    throw new Error(`upsert failed (${up.status}): ${up.error}`);
  }

  await logEvent(req, {
    slug: project.slug,
    action: "save",
    outcome: "ok",
    detail: existing ? "updated" : "created",
  });

  const payload = {
    ok: true,
    action: "save",
    slug: project.slug,
    status,
    created: !existing,
    generatedAt: nowIso(),
  };
  if (claimed === "published" && status !== "published") {
    payload.note = "Saved as a draft. Publishing it is a separate step.";
  }
  return res.end(JSON.stringify(payload));
}

/**
 * Stage one prepared photo in the private bucket at `<slug>/<file>`.
 *
 * The slug does NOT have to exist as a row yet, and that is on purpose: a
 * project cannot be saved without at least one image, so the first upload always
 * precedes the first successful save.
 */
async function actionUpload(req, res, body) {
  const slug = body.slug;
  const file = body.file;

  // Order matters — cheapest and most specific first, and the bytes are never
  // trusted over the filename's claim.
  if (!isSlug(slug)) return fail(res, 400, "slug");
  if (!isImageFile(file)) {
    return fail(
      res,
      400,
      "That filename isn't allowed. Use lower-case letters, numbers and hyphens, ending .jpg or .png."
    );
  }

  const decoded = decodeImage(body.dataBase64);
  if (!decoded.ok) return fail(res, decoded.status, decoded.error);
  const buf = decoded.buf;

  const sniffed = sniffImage(buf);
  if (!sniffed) return fail(res, 400, "That file isn't a JPEG or PNG image.");
  const ext = String(file).slice(String(file).lastIndexOf(".") + 1).toLowerCase();
  const declared = ext === "jpeg" ? "jpg" : ext;
  if (sniffed !== declared) {
    // A .jpg that is really a PNG would be served with the wrong type and break
    // the image pipeline at build time, so it is refused rather than renamed.
    return fail(
      res,
      400,
      `That file is named .${ext} but is actually a ${sniffed.toUpperCase()}. Save it as .${sniffed} and try again.`
    );
  }
  if (buf.length > MAX_IMAGE_BYTES) {
    return fail(res, 413, "That image is too large. Please use one under 1.2 MB.");
  }

  const key = `${slug}/${file}`;
  const put = await sbStorageUpload(key, buf, MIME[sniffed]);
  if (!put.ok) {
    await logEvent(req, {
      slug,
      action: "save",
      outcome: "error",
      detail: `upload ${file}: ${String(put.error || "").slice(0, 300)}`,
    });
    throw new Error(`storage upload failed (${put.status}): ${put.error}`);
  }

  await logEvent(req, { slug, action: "save", outcome: "ok", detail: `uploaded ${file}` });

  return res.end(
    JSON.stringify({
      ok: true,
      action: "upload",
      slug,
      file,
      bytes: buf.length,
      url: await sbStorageSignedUrl(key, PREVIEW_TTL),
      generatedAt: nowIso(),
    })
  );
}

/**
 * Remove one staged photo. Nothing published is affected — the committed copy in
 * the repo only goes when the project is unpublished or deleted.
 */
async function actionDeleteMedia(req, res, body) {
  const slug = body.slug;
  const file = body.file;
  if (!isSlug(slug)) return fail(res, 400, "slug");
  if (!isImageFile(file)) return fail(res, 400, "file");

  const key = `${slug}/${file}`;
  // Storage answers 200 for a delete that matched nothing, so check what is
  // there first: it makes removing an already-gone file a quiet success instead
  // of a spurious 502 from sbStorageDeleteMany's count mismatch.
  const keys = await sbStorageList(slug);
  if (!keys.includes(key)) {
    return res.end(
      JSON.stringify({
        ok: true,
        action: "delete-media",
        slug,
        file,
        deleted: 0,
        generatedAt: nowIso(),
      })
    );
  }

  const del = await sbStorageDeleteMany([key]);
  if (!del.ok) throw new Error(`storage delete failed: ${del.error}`);

  await logEvent(req, { slug, action: "save", outcome: "ok", detail: `removed ${file}` });

  return res.end(
    JSON.stringify({
      ok: true,
      action: "delete-media",
      slug,
      file,
      deleted: del.deleted,
      generatedAt: nowIso(),
    })
  );
}

/** Sean's running order on /projects: each slug's sort_order becomes its index. */
async function actionReorder(req, res, body) {
  const order = body.order;
  if (!Array.isArray(order) || !order.length) return fail(res, 400, "order");
  if (order.length > MAX_ORDER_SLUGS) return fail(res, 400, "order");
  if (!order.every(isSlug)) return fail(res, 400, "order");
  if (new Set(order).size !== order.length) return fail(res, 400, "order");

  const set = await sbSetProjectOrder(order);
  if (!set.ok) throw new Error(`reorder failed: ${set.error}`);

  await logEvent(req, { action: "save", outcome: "ok", detail: `reordered ${set.updated} projects` });

  return res.end(
    JSON.stringify({ ok: true, action: "reorder", count: set.updated, generatedAt: nowIso() })
  );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

module.exports = async (req, res) => {
  if (applyCors(req, res)) return; // ALWAYS first; handles the OPTIONS preflight
  res.setHeader("Content-Type", "application/json"); // ALWAYS second, so every branch is typed

  const isWrite = req.method === "POST";

  // CORS advertises GET, POST, OPTIONS only, so anything else is refused here
  // rather than being read as a GET.
  if (!isWrite && req.method !== "GET") return fail(res, 405, "method");

  // The ONLY CSRF defence on the write branch: the session cookie is
  // SameSite=None (the admin page and this API are on different sites), so the
  // browser will attach it to a cross-site POST from anywhere.
  if (isWrite && !isAllowedOrigin(req)) return fail(res, 403, "origin");

  // 401, never 403 — the admin client shows the login screen only on a 401.
  if (!requireSession(req)) return fail(res, 401, "unauthorized");

  if (!process.env.SC_SUPABASE_URL || !process.env.SC_SUPABASE_SERVICE_ROLE_KEY) {
    return fail(res, 500, "Supabase not configured.");
  }

  if (!isWrite) {
    // Reads clamp an unrecognised view to the harmless list.
    const view = new URL(req.url, "http://x").searchParams.get("view");
    const safe = VALID_VIEWS.includes(view) ? view : "list";
    try {
      return safe === "one" ? await viewOne(req, res) : await viewList(req, res);
    } catch (err) {
      console.error("sc-admin-projects read error", err && err.message);
      return fail(res, 502, safe === "one" ? "project_failed" : "projects_failed");
    }
  }

  // Limit before the body is read: an upload is up to 1.2 MB of base64 to parse.
  if (rateLimited(trustedClientIp(req))) {
    return fail(res, 429, "Too many changes at once. Wait a moment and try again.");
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    body = {};
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) body = {};

  const action = typeof body.action === "string" ? body.action : "";
  if (!VALID_ACTIONS.includes(action)) return fail(res, 400, "action");

  try {
    if (action === "save") return await actionSave(req, res, body);
    if (action === "upload") return await actionUpload(req, res, body);
    if (action === "delete-media") return await actionDeleteMedia(req, res, body);
    return await actionReorder(req, res, body);
  } catch (err) {
    console.error(`sc-admin-projects ${action} error`, err && err.message);
    return fail(res, 502, `${action.replace(/-/g, "_")}_failed`);
  }
};
