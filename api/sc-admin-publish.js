/**
 * SC Design Wirral — publish, unpublish and delete a CMS case study.
 *
 * Requires a valid admin session. This is the ONLY code in the projects CMS that
 * changes the live public website, so it is deliberately explicit and defensive.
 * It reads sc_projects / the `project-media` Storage bucket, writes the git repo
 * through serverlib/github.js, and records every attempt in sc_project_events.
 *
 * ── THE TWO PLATFORMS ─────────────────────────────────────────────────────────
 * The public site is a Next.js static export on Cloudflare Pages, which rebuilds
 * from `main` on every push. This API is a separate Vercel project. Supabase is
 * the EDITING store, not what the website reads: the live site never queries it
 * for project content, which is exactly what keeps every case study
 * prerendered and indexable.
 *
 * So "publish" means: commit `content/projects/<slug>.json` plus the images into
 * the repo, and let the Cloudflare build (npm "prebuild" →
 * scripts/sync-cms-projects.mjs) turn them into a real page. That build
 * re-validates everything with serverlib/cms.js, so this endpoint and the build
 * enforce one identical set of rules.
 *
 * The consequence to keep in mind everywhere below: nothing here is instant and
 * nothing here is live when we answer. A successful response means a commit was
 * made and the site is rebuilding — usually 1–3 minutes. We never say "live".
 *
 * ── ORDERING, WHICH IS THE WHOLE GAME ────────────────────────────────────────
 * PUBLISH — images first, commit second.
 *   Every declared image is downloaded from Storage BEFORE the commit, and a
 *   declared image that is not in Storage refuses the publish by name. The
 *   commit that introduces the JSON therefore always lands together with the
 *   photos it references, in ONE commit, so the build never sees a case study
 *   whose images 404.
 *
 * DELETE / UNPUBLISH — commit first, storage second. The OPPOSITE order, on
 *   purpose, and it is easy to get backwards:
 *     · remove-from-site first, then delete the bytes → if the Storage delete
 *       then fails we are left with orphaned objects in a private bucket:
 *       cheap, invisible to the public, and sweepable (see the housekeeping
 *       query at the foot of db/sc_projects.sql).
 *     · bytes first, then remove-from-site → if the commit then fails, the live
 *       page stays up pointing at images we just destroyed, and the next
 *       republish cannot even rebuild it. Strictly worse. Never do this.
 *   The same logic is why the Supabase row is deleted LAST: while the row
 *   exists, the admin can see the project and retry; every step here is
 *   idempotent, so a retry after a partial failure completes the job.
 *
 * ── THE ORPHAN SWEEP (non-obvious, and it protects the whole site) ───────────
 * scripts/sync-cms-projects.mjs FAILS THE BUILD if a file in
 * public/work/cms/<slug>/ is not referenced by that project's JSON — an
 * unreferenced photo stays publicly reachable while nothing on the site reviews
 * it. So a republish that drops a photo must also delete the committed file in
 * the same commit, or the next build fails and no change of any kind reaches the
 * site until someone fixes the repo by hand. Hence: enumerate what is really
 * committed, and delete what the new content no longer declares.
 *
 * ── THE TOMBSTONE ───────────────────────────────────────────────────────────
 * Taking a page down would leave its URL 404ing for anyone holding a link and
 * for anything Google indexed, so unpublish/delete add the slug to
 * content/removed-projects.json and the build turns that into a 301 to
 * /projects/. Publishing REMOVES the slug from that file: a slug that is both
 * live and listed as removed fails the build hard, which would block every
 * later change to the site. That file is the only routing-adjacent thing the
 * admin may write, and public/_redirects itself stays outside the allow-list.
 *
 * Env: SC_SUPABASE_URL, SC_SUPABASE_SERVICE_ROLE_KEY, SC_ADMIN_SESSION_SECRET,
 * SC_ADMIN_USER, SC_GITHUB_TOKEN (+ optional SC_GITHUB_REPO, SC_GITHUB_BRANCH,
 * SC_PROJECT_MEDIA_BUCKET).
 */

const {
  applyCors,
  isAllowedOrigin,
  requireSession,
  readJsonBody,
  clientIp,
  visitorHash,
  sbGetProject,
  sbUpsertProject,
  sbDeleteProject,
  sbInsertProjectEvent,
  sbStorageDownload,
  sbStorageList,
  sbStorageDeleteMany,
} = require("../serverlib/common");

const {
  projectSchema,
  validateProject,
  assertAllowedPaths,
  isAllowedPath,
  contentPathFor,
  mediaPathFor,
  REMOVED_PROJECTS_PATH,
  parseRemovedSlugs,
  MAX_REMOVED_SLUGS,
  MAX_IMAGE_BYTES,
  sniffImage,
} = require("../serverlib/cms");

const github = require("../serverlib/github");

/* ------------------------------------------------------------------ *
 * Constants                                                           *
 * ------------------------------------------------------------------ */

/** State-changing verbs only. An unknown action is refused, never defaulted. */
const ACTIONS = ["publish", "unpublish", "delete"];

/** Must match the third argument pattern of mediaPathFor / the ALLOWED_PATHS entry. */
const MEDIA_ROOT = "public/work/cms";

/** Supabase downloads run in parallel; small enough not to look like abuse. */
const DOWNLOAD_CONCURRENCY = 4;

/**
 * vercel.json gives these functions maxDuration 30. A project may carry up to 40
 * images at up to MAX_IMAGE_BYTES each (48 MB), and every one has to be pulled
 * out of Storage and pushed to GitHub as base64 (+33%) inside that window. Two
 * guards, both applied BEFORE anything is committed, so a refusal always means
 * nothing changed:
 *   1. TOTAL_BYTES_BUDGET — an honest ceiling rather than a mid-commit timeout.
 *   2. RESERVE_MS — if the download phase alone has eaten the budget, stop. The
 *      dangerous moment is being killed between "branch moved" and "Supabase
 *      updated": the site would be right and the admin's own record wrong.
 */
const FUNCTION_BUDGET_MS = 30_000;
const RESERVE_MS = 9_000;
const TOTAL_BYTES_BUDGET = 30 * 1024 * 1024;

/** The build refuses anything larger (images.unoptimized + sharp measurement). */
const MAX_IMAGE_EDGE = 1600;

/* ------------------------------------------------------------------ *
 * Small helpers                                                       *
 * ------------------------------------------------------------------ */

/** Run `fn` over `items` with at most `limit` in flight, preserving order. */
async function mapWithLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** One problem in the same shape validateProject produces, so the UI renders it. */
function problem(field, rule, message) {
  return { field, rule, message };
}

/** Sean-written prose on a single commit-subject line. */
function oneLine(value, max) {
  return String(value == null ? "" : value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max || 72);
}

/**
 * `Project slug:` and `Published by:` are a free audit trail in git history.
 * Never add a CI-skip marker — Cloudflare Pages honours those and the publish
 * would appear to work while the site never rebuilt. (github.js strips them too.)
 */
function commitMessage(subject, slug, actor, extra) {
  const lines = [oneLine(subject, 100), "", `Project slug: ${slug}`, `Published by: ${actor}`];
  for (const line of extra || []) if (line) lines.push(line);
  return lines.join("\n");
}

/** The admin username, always server-side: the session token carries only {exp}. */
function actorName() {
  return process.env.SC_ADMIN_USER || "unknown admin";
}

/**
 * Cookieless actor hash for the audit row — never a raw IP. Deliberately the
 * same input api/sc-admin-login.js records as `vid`, so a publish can be lined
 * up against the sign-in that preceded it. It is derived from a client-supplied
 * header, so treat it as a correlation aid, not as evidence.
 */
function ipHash(req) {
  const ua = String(req.headers["user-agent"] || "").slice(0, 512);
  return visitorHash(clientIp(req), ua, "scdesign");
}

/**
 * Append one sc_project_events row. NEVER allowed to fail the operation: the
 * audit is how you find out why a page appeared or disappeared, but losing the
 * note must not undo a commit that has already landed.
 */
async function audit(req, row) {
  try {
    const res = await sbInsertProjectEvent({
      slug: row.slug || null,
      action: row.action,
      outcome: row.outcome,
      detail: row.detail || null,
      commit_sha: row.commitSha || null,
      actor: actorName(),
      ip_hash: ipHash(req),
    });
    if (!res || !res.ok) {
      console.error("sc-admin-publish audit insert rejected", res && res.error);
    }
  } catch (err) {
    console.error("sc-admin-publish audit insert failed", err && err.message);
  }
}

/** Compact, capped summary of a problems array for the audit `detail` column. */
function problemsDetail(problems) {
  return problems
    .slice(0, 12)
    .map((p) => `${p.field}: ${p.message}`)
    .join(" | ");
}

/* ------------------------------------------------------------------ *
 * Image dimensions, read from the bytes we are about to commit        *
 *                                                                     *
 * The build measures every committed image with sharp and fails if an  *
 * edge exceeds 1600px — and a failed build blocks EVERY later change   *
 * to the site, which is the one failure Sean cannot diagnose. sharp is  *
 * far too heavy for a serverless function, so read the header instead. *
 *                                                                     *
 * Deliberately one-sided: refuse only on a dimension positively read   *
 * as too large. An unparsed header returns null and the publish        *
 * proceeds — a bug in this reader must never block a legitimate        *
 * publish, it can only ever catch an obvious one.                      *
 * ------------------------------------------------------------------ */

function pngSize(buf) {
  if (buf.length < 24) return null;
  if (buf.toString("latin1", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpegSize(buf) {
  let i = 2; // past SOI
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++; // resync rather than give up: padding between segments is legal
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xff || marker === 0x00) {
      i++;
      continue;
    }
    // Standalone markers carry no length payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // end, or scan data begins
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) return null;
    // SOF0–SOF15 (any baseline/progressive/lossless frame), excluding DHT/JPG/DAC.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

/** `{width, height}` or null when it cannot be read with confidence. */
function imageSize(buf, kind) {
  try {
    const size = kind === "png" ? pngSize(buf) : jpegSize(buf);
    if (!size || !size.width || !size.height) return null;
    if (size.width > 60000 || size.height > 60000) return null; // nonsense: don't trust it
    return size;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Repo reads                                                          *
 * ------------------------------------------------------------------ */

/**
 * Every blob path committed on the deploy branch, as a Set.
 *
 * github.js's listTree() always fetches the whole recursive tree and filters in
 * JS, so asking it for each prefix separately would fetch the same large listing
 * twice. One call, filtered locally, is identical in cost and gives both the
 * project's JSON path and its media folder. Its truncation guard still applies —
 * an incomplete listing throws rather than producing an incomplete delete.
 */
async function committedPaths() {
  return new Set(await github.listTree(""));
}

/**
 * The tombstone file as it stands. Malformed or hostile entries are dropped
 * rather than propagated (see parseRemovedSlugs) so a bad file cannot wedge Sean
 * out of removing a project — the rewrite heals it.
 */
async function readRemovedSlugs() {
  const text = await github.readTextFile(REMOVED_PROJECTS_PATH);
  if (text === null) return { slugs: [], dropped: [], existed: false };
  let raw = null;
  let unparsed = false;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    // An unparseable file is rebuilt from scratch rather than left to fail the
    // build — but that discards the redirects it held, so say so loudly: those
    // URLs will start 404ing until someone restores them.
    raw = null;
    unparsed = true;
  }
  const parsed = parseRemovedSlugs(raw);
  return { slugs: parsed.slugs, dropped: parsed.dropped, existed: true, unparsed };
}

/** Log whatever the tombstone file lost on the way in, so it is discoverable. */
function reportTombstoneDamage(removed) {
  if (removed.unparsed) {
    console.error(
      `sc-admin-publish ${REMOVED_PROJECTS_PATH} was not valid JSON and is being rewritten from scratch — any redirects it held are lost`
    );
  }
  if (removed.dropped.length) {
    console.error("sc-admin-publish removed-projects.json had invalid entries", removed.dropped.join(","));
  }
}

/** `{ "slugs": [...] }` and nothing else, sorted for a reviewable diff. */
function removedSlugsFile(slugs) {
  return `${JSON.stringify({ slugs }, null, 2)}\n`;
}

function textWrite(path, text) {
  return { path, contentBase64: Buffer.from(text, "utf8").toString("base64") };
}

/* ------------------------------------------------------------------ *
 * Responses                                                           *
 * ------------------------------------------------------------------ */

function json(res, status, payload) {
  // Success never sets a status: an implicit 200 is the house convention.
  if (status && status !== 200) res.statusCode = status;
  return res.end(JSON.stringify(payload));
}

/** A content refusal: 422 plus the problems array the editor renders inline. */
async function sendProblems(req, res, action, slug, problems) {
  await audit(req, { slug, action, outcome: "refused", detail: problemsDetail(problems) });
  return json(res, 422, { ok: false, problems, generatedAt: new Date().toISOString() });
}

/** A refusal with a single message or machine code. */
async function sendRefusal(req, res, action, slug, status, error, detail) {
  await audit(req, { slug, action, outcome: "refused", detail: detail || error });
  return json(res, status, { ok: false, error, generatedAt: new Date().toISOString() });
}

/**
 * An upstream failure. Two things matter here:
 *
 *  1. NEVER return 401 or 403 for a GitHub or Supabase failure. To the admin
 *     client a 401 from this endpoint means "your session expired", so GitHub's
 *     own 401/403/404 (all of which mean "the publishing token is wrong") would
 *     bounce Sean to the login screen mid-publish and hide the real cause. Every
 *     upstream failure is reported as 502.
 *  2. serverlib/github.js writes its error messages to be shown to Sean
 *     verbatim, so those are passed through with the machine code alongside.
 *     Anything else collapses to the contract's `<action>_failed` code.
 */
async function sendFailure(req, res, action, slug, err, commitSha) {
  const code = (err && err.code) || "";
  console.error(`sc-admin-publish ${action} failed`, err && err.message);
  await audit(req, {
    slug,
    action,
    outcome: "error",
    detail: `${code || "error"}: ${(err && err.message) || "unknown"}`.slice(0, 3800),
    commitSha,
  });
  const readable = code.startsWith("github_") && err.message ? err.message : `${action}_failed`;
  return json(res, 502, {
    ok: false,
    error: readable,
    code: code || `${action}_failed`,
    generatedAt: new Date().toISOString(),
  });
}

/* ------------------------------------------------------------------ *
 * Shared: what is committed for this slug right now                   *
 * ------------------------------------------------------------------ */

/**
 * Enumerate the real committed paths for one slug. Never guess filenames from
 * the content JSON: GitHub errors the ENTIRE tree creation if a deletion names a
 * path that does not exist, so a guessed filename would fail the whole action.
 */
function committedForSlug(paths, slug, contentPath) {
  const prefix = `${MEDIA_ROOT}/${slug}/`;
  const media = [];
  for (const p of paths) if (p.startsWith(prefix)) media.push(p);
  media.sort();
  return { contentCommitted: paths.has(contentPath), media };
}

/* ------------------------------------------------------------------ *
 * publish                                                             *
 * ------------------------------------------------------------------ */

async function doPublish(req, res, slug, deadline) {
  const row = await sbGetProject(slug);
  if (!row) return sendRefusal(req, res, "publish", slug, 404, "not_found");

  let content = row.content;
  if (typeof content === "string") {
    try {
      content = JSON.parse(content);
    } catch {
      content = null;
    }
  }
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return sendProblems(req, res, "publish", slug, [
      problem("(root)", "unreadable", "This project's saved content could not be read. Open it, check it and save it again."),
    ]);
  }

  // The filename IS the slug, and the build refuses a JSON whose slug disagrees
  // with its filename — so one project can never masquerade as another. Refuse
  // rather than silently rewriting what Sean saved.
  if (typeof content.slug === "string" && content.slug !== slug) {
    return sendProblems(req, res, "publish", slug, [
      problem(
        "slug",
        "slug-mismatch",
        `This project is stored as "${slug}" but its content says "${oneLine(content.slug, 80)}". Save it again before publishing.`
      ),
    ]);
  }

  /**
   * Publishing IS the act of setting the status: a committed JSON with
   * status:"draft" is filtered out of publishedProjects, so it would build to
   * nothing at all. Forcing it here is also what makes the
   * homeowner-permission rule fire — lintProject only requires
   * homeownerPermissionConfirmed when status is "published".
   */
  const candidate = Object.assign({}, content, { slug, status: "published" });

  // Re-validate on every publish, never trust the stored row: it may predate a
  // rule change, and the build applies the same checks to what we commit.
  const validated = validateProject(candidate);
  if (!validated.ok) return sendProblems(req, res, "publish", slug, validated.problems);
  const project = validated.project;

  const contentPath = contentPathFor(slug);

  // ---- Storage first. The images must exist before the commit references them.
  const declared = [];
  const seenFiles = new Set();
  for (const img of project.images) {
    if (seenFiles.has(img.file)) continue; // two entries may share one file
    seenFiles.add(img.file);
    declared.push({ file: img.file, path: mediaPathFor(slug, img.file) });
  }

  const staged = new Set(await sbStorageList(slug));
  const missing = declared.filter((d) => !staged.has(`${slug}/${d.file}`));
  if (missing.length) {
    // Naming the files is the whole point: a case study whose photos 404 is
    // worse than one that is not published yet.
    return sendProblems(
      req,
      res,
      "publish",
      slug,
      missing.slice(0, 10).map((d) =>
        problem(
          "images",
          "missing-upload",
          `"${d.file}" has not been uploaded, so it cannot be published. Upload it again, or remove it from the project.`
        )
      )
    );
  }

  const buffers = await mapWithLimit(declared, DOWNLOAD_CONCURRENCY, (d) =>
    sbStorageDownload(`${slug}/${d.file}`)
  );

  const imageProblems = [];
  let totalBytes = 0;
  const writes = [];
  for (let i = 0; i < declared.length; i++) {
    const { file, path } = declared[i];
    const buf = buffers[i];
    if (!buf || !buf.length) {
      imageProblems.push(problem("images", "missing-upload", `"${file}" is empty. Upload it again.`));
      continue;
    }
    const kind = sniffImage(buf);
    if (!kind) {
      imageProblems.push(problem("images", "not-an-image", `"${file}" is not a valid JPEG or PNG. Upload it again.`));
      continue;
    }
    const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
    if (kind !== ext) {
      imageProblems.push(
        problem("images", "wrong-extension", `"${file}" is actually a ${kind.toUpperCase()} file. Re-save it as .${kind} and upload it again.`)
      );
      continue;
    }
    if (buf.length > MAX_IMAGE_BYTES) {
      imageProblems.push(
        problem(
          "images",
          "too-large",
          `"${file}" is ${Math.round(buf.length / 1024)}KB, over the ${Math.round(MAX_IMAGE_BYTES / 1024)}KB limit. Upload a smaller version.`
        )
      );
      continue;
    }
    const size = imageSize(buf, kind);
    if (size && (size.width > MAX_IMAGE_EDGE || size.height > MAX_IMAGE_EDGE)) {
      // The build would reject this too — but there it fails the whole deploy,
      // taking every other pending change with it.
      imageProblems.push(
        problem(
          "images",
          "too-big-on-screen",
          `"${file}" is ${size.width}x${size.height} pixels, over the ${MAX_IMAGE_EDGE}px limit. Upload a smaller version.`
        )
      );
      continue;
    }
    totalBytes += buf.length;
    writes.push({ path, contentBase64: buf.toString("base64") });
  }
  if (imageProblems.length) return sendProblems(req, res, "publish", slug, imageProblems);

  if (totalBytes > TOTAL_BYTES_BUDGET) {
    return sendRefusal(
      req,
      res,
      "publish",
      slug,
      413,
      `This project's photos come to ${Math.round(totalBytes / 1048576)}MB, which is more than can be published in one go. Nothing was changed — remove or shrink some photos and try again.`,
      `total_bytes ${totalBytes}`
    );
  }

  // ---- What is already committed, so the commit can be complete and exact.
  const paths = await committedPaths();
  const { media } = committedForSlug(paths, slug, contentPath);
  const keep = new Set(writes.map((w) => w.path));

  /**
   * The orphan sweep. The build FAILS if a file under public/work/cms/<slug>/ is
   * not referenced by the JSON, and a failed build blocks every later change to
   * the site — so a photo Sean removed must leave the repo in the same commit.
   */
  const deletes = [];
  const blocked = [];
  for (const p of media) {
    if (keep.has(p)) continue;
    // A hand-committed file that is outside the allow-list cannot be removed
    // from here, and leaving it would fail the build anyway — so say so plainly
    // rather than publishing something that cannot build.
    if (isAllowedPath(p)) deletes.push(p);
    else blocked.push(p);
  }
  if (blocked.length) {
    return sendRefusal(
      req,
      res,
      "publish",
      slug,
      409,
      `The website has a file this publisher is not allowed to change (${oneLine(blocked[0], 90)}), and publishing would fail the site build. Nothing was changed — ask Matthew to remove it.`,
      `blocked: ${blocked.join(", ")}`
    );
  }

  // ---- The tombstone: republishing must not leave a redirect shadowing the page.
  const removed = await readRemovedSlugs();
  reportTombstoneDamage(removed);
  const nextRemoved = removed.slugs.filter((s) => s !== slug);
  // A damaged file is rewritten here as well as when removing: an unparseable or
  // invalid removed-projects.json FAILS THE BUILD, which would block every later
  // change to the site, so healing it while we are already committing is free.
  const tombstoneChanged =
    nextRemoved.length !== removed.slugs.length || removed.dropped.length > 0 || removed.unparsed;
  if (tombstoneChanged) writes.push(textWrite(REMOVED_PROJECTS_PATH, removedSlugsFile(nextRemoved)));

  // The content JSON goes in last so it is easy to see in the write list; order
  // within one commit is irrelevant — the commit is atomic.
  writes.push(textWrite(contentPath, `${JSON.stringify(project, null, 2)}\n`));

  /**
   * THE gate. Every path in this action is checked against the closed allow-list
   * in serverlib/cms.js before a single GitHub write happens — writes and
   * deletions alike. This is the control that stops a compromised admin password
   * committing to src/, package.json, .github/ or public/_redirects. The paths
   * were built by contentPathFor/mediaPathFor, which self-check; this is the
   * authority, and it would catch a bug in either of them.
   */
  assertAllowedPaths(writes.map((w) => w.path).concat(deletes));

  if (deadline() < RESERVE_MS) {
    return sendRefusal(
      req,
      res,
      "publish",
      slug,
      504,
      "Preparing this project's photos took too long, so nothing was published. Try again, or publish it with fewer photos.",
      `deadline exhausted before commit (${Math.round(deadline())}ms left)`
    );
  }

  const result = await github.commitChanges({
    writes,
    deletes,
    message: commitMessage(`Publish case study: ${project.title}`, slug, actorName(), [
      `Action: publish`,
      `Files: ${writes.length} written, ${deletes.length} removed`,
    ]),
  });

  // ---- The commit landed. From here on, failures must not lose the record.
  const publishedAt = new Date().toISOString();
  const update = await sbUpsertProject({
    slug,
    status: "published",
    content: project,
    published_at: publishedAt,
    last_publish_sha: result.sha,
  });
  if (!update.ok) {
    // The site is correct and rebuilding; only our own bookkeeping is behind.
    // Say so rather than reporting a failure Sean cannot act on, and leave the
    // audit row as the record of what really happened.
    console.error("sc-admin-publish row update failed after commit", update.error);
  }

  await audit(req, {
    slug,
    action: "publish",
    outcome: "ok",
    commitSha: result.sha,
    detail:
      `${writes.length} file(s) written, ${deletes.length} removed` +
      (tombstoneChanged ? ", removed-projects.json updated" : "") +
      // github.js drops a deletion whose path vanished under us (a concurrent
      // change); harmless, but worth having in the log.
      (result.skippedDeletes && result.skippedDeletes.length
        ? ` — already gone: ${result.skippedDeletes.join(", ")}`
        : "") +
      (update.ok ? "" : " — WARNING: sc_projects row not updated"),
  });

  return json(res, 200, {
    ok: true,
    action: "publish",
    slug,
    commitSha: result.sha,
    commitUrl: result.htmlUrl || null,
    status: "published",
    imageCount: project.images.length,
    filesWritten: writes.length,
    filesRemoved: deletes.length,
    rebuilding: true,
    rowUpdated: !!update.ok,
    tokenExpiry: result.tokenExpiry || null,
    note: "Committed to the website. Cloudflare is rebuilding it now — the page is usually live within a few minutes.",
    generatedAt: new Date().toISOString(),
  });
}

/* ------------------------------------------------------------------ *
 * Removal shared by unpublish and delete                              *
 * ------------------------------------------------------------------ */

/**
 * Build and land the ONE commit that takes a case study off the live site:
 * delete its JSON, delete every committed image, and add its slug to the
 * tombstone so the old URL 301s to the hub.
 *
 * Returns `{ sha, htmlUrl, deleted, notRemoved, tombstoned }`. `sha` is null
 * when there was nothing on the site to remove (a draft that was never
 * published), which is exactly the "commitSha: null" case in the contract.
 */
async function commitRemoval(slug, subject, actor, extra) {
  const contentPath = contentPathFor(slug);
  const paths = await committedPaths();
  const { contentCommitted, media } = committedForSlug(paths, slug, contentPath);

  const deletes = [];
  const notRemoved = [];
  if (contentCommitted) deletes.push(contentPath);
  for (const p of media) {
    if (isAllowedPath(p)) deletes.push(p);
    // Unlike publish, do NOT refuse here. Taking the page down matters more than
    // tidiness: remove everything permitted and report what was left behind so
    // the orphan is visible rather than silent.
    else notRemoved.push(p);
  }

  const writes = [];
  let tombstoned = false;
  // Only tombstone something that was actually reachable. A draft that never
  // reached the site has no URL to redirect, and an invented redirect would be a
  // permanent line in the site's routing for a page that never existed.
  if (contentCommitted) {
    const removed = await readRemovedSlugs();
    reportTombstoneDamage(removed);
    if (!removed.slugs.includes(slug) && removed.slugs.length >= MAX_REMOVED_SLUGS) {
      const err = new Error(
        `The list of removed projects is full (${MAX_REMOVED_SLUGS}). Nothing was changed — ask Matthew to prune content/removed-projects.json.`
      );
      err.code = "github_failed"; // a readable message, reported as-is
      throw err;
    }
    const next = [...new Set(removed.slugs.concat(slug))].sort();
    writes.push(textWrite(REMOVED_PROJECTS_PATH, removedSlugsFile(next)));
    tombstoned = true;
  }

  // The gate, on writes and deletions alike, before any GitHub write.
  assertAllowedPaths(writes.map((w) => w.path).concat(deletes));

  if (!writes.length && !deletes.length) {
    return { sha: null, htmlUrl: null, deleted: [], notRemoved, tombstoned: false, skipped: [] };
  }

  const result = await github.commitChanges({
    writes,
    deletes,
    message: commitMessage(subject, slug, actor, extra),
  });
  return {
    sha: result.sha,
    htmlUrl: result.htmlUrl || null,
    deleted: deletes,
    notRemoved,
    tombstoned,
    // Deletions github.js found had already gone: nothing to fix, but it belongs
    // in the audit trail when a file disappears unexpectedly.
    skipped: (result.skippedDeletes || []).slice(),
    tokenExpiry: result.tokenExpiry || null,
  };
}

/* ------------------------------------------------------------------ *
 * unpublish                                                           *
 * ------------------------------------------------------------------ */

async function doUnpublish(req, res, slug) {
  const row = await sbGetProject(slug);
  if (!row) return sendRefusal(req, res, "unpublish", slug, 404, "not_found");

  const removal = await commitRemoval(slug, `Unpublish case study: ${slug}`, actorName(), [
    "Action: unpublish",
    "The Supabase draft and its staged photos are kept so it can be fixed and published again.",
  ]);

  // Keep the row and the staged images: unpublish is "take it down while I fix
  // it", not "get rid of it". last_publish_sha is left alone deliberately — it
  // records the commit that last put the page live, which is still true history.
  const patch = { slug, status: "draft", published_at: null };
  let content = row.content;
  if (typeof content === "string") {
    try {
      content = JSON.parse(content);
    } catch {
      content = null;
    }
  }
  // Keep the stored content's own status honest with the column, so reopening
  // the editor does not show it as published.
  if (content && typeof content === "object" && !Array.isArray(content)) {
    patch.content = Object.assign({}, content, { status: "draft" });
  }
  const update = await sbUpsertProject(patch);
  if (!update.ok) console.error("sc-admin-publish row update failed after unpublish", update.error);

  await audit(req, {
    slug,
    action: "unpublish",
    outcome: "ok",
    commitSha: removal.sha,
    detail:
      (removal.sha ? `${removal.deleted.length} file(s) removed` : "nothing was on the website") +
      (removal.tombstoned ? ", slug added to removed-projects.json" : "") +
      (removal.notRemoved.length ? ` — left behind: ${removal.notRemoved.join(", ")}` : "") +
      (removal.skipped.length ? ` — already gone: ${removal.skipped.join(", ")}` : "") +
      (update.ok ? "" : " — WARNING: sc_projects row not updated"),
  });

  return json(res, 200, {
    ok: true,
    action: "unpublish",
    slug,
    commitSha: removal.sha,
    commitUrl: removal.htmlUrl,
    status: "draft",
    filesRemoved: removal.deleted.length,
    redirected: removal.tombstoned,
    notRemoved: removal.notRemoved,
    rebuilding: !!removal.sha,
    rowUpdated: !!update.ok,
    note: removal.sha
      ? "Removed from the website and the old address now points at the projects page. Cloudflare is rebuilding now. Your draft and photos are kept."
      : "This project was not on the website, so nothing needed changing. It is saved as a draft.",
    generatedAt: new Date().toISOString(),
  });
}

/* ------------------------------------------------------------------ *
 * delete                                                              *
 * ------------------------------------------------------------------ */

async function doDelete(req, res, slug) {
  const row = await sbGetProject(slug);
  if (!row) return sendRefusal(req, res, "delete", slug, 404, "not_found");

  // 1. Off the site first. See the header: if the Storage delete below then
  //    fails we are left with orphaned private bytes, not a live page pointing
  //    at images that no longer exist.
  const removal = await commitRemoval(slug, `Delete case study: ${slug}`, actorName(), [
    "Action: delete",
    "The draft and its staged photos are being deleted as well.",
  ]);

  // 2. The staged images. A failure here is reported but does not undo the
  //    removal — the bucket is private, so the leftovers are invisible and the
  //    housekeeping query at the foot of db/sc_projects.sql sweeps them up.
  let storageWarning = null;
  try {
    const keys = await sbStorageList(slug);
    if (keys.length) {
      // sbStorageDeleteMany matches each entry as an EXACT key despite the API
      // calling them "prefixes" — hence the list first, never "<slug>/".
      const del = await sbStorageDeleteMany(keys);
      if (!del.ok) storageWarning = `staged photos: ${del.error || "delete failed"}`;
    }
  } catch (err) {
    storageWarning = `staged photos: ${(err && err.message) || "delete failed"}`;
  }
  if (storageWarning) console.error("sc-admin-publish delete storage cleanup", storageWarning);

  // 3. The row last: while it exists Sean can still see the project and retry,
  //    and every step above is idempotent so a retry finishes the job.
  const removedRow = await sbDeleteProject(slug);
  if (!removedRow.ok) {
    // The page is already gone from the site, so leave the row marked draft
    // rather than showing it as published, and ask for a retry.
    await sbUpsertProject({ slug, status: "draft", published_at: null }).catch(() => {});
    await audit(req, {
      slug,
      action: "delete",
      outcome: "error",
      commitSha: removal.sha,
      detail: `removed from the website but the draft could not be deleted: ${removedRow.error || removedRow.status}`,
    });
    return json(res, 502, {
      ok: false,
      error:
        "The project was removed from the website, but its draft could not be deleted. Nothing is live — press Delete again to finish clearing it.",
      code: "delete_failed",
      commitSha: removal.sha,
      generatedAt: new Date().toISOString(),
    });
  }

  await audit(req, {
    slug,
    action: "delete",
    outcome: "ok",
    commitSha: removal.sha,
    detail:
      (removal.sha ? `${removal.deleted.length} file(s) removed` : "nothing was on the website") +
      (removal.tombstoned ? ", slug added to removed-projects.json" : "") +
      (removal.notRemoved.length ? ` — left behind: ${removal.notRemoved.join(", ")}` : "") +
      (removal.skipped.length ? ` — already gone: ${removal.skipped.join(", ")}` : "") +
      (storageWarning ? ` — ${storageWarning}` : ""),
  });

  return json(res, 200, {
    ok: true,
    action: "delete",
    slug,
    commitSha: removal.sha,
    commitUrl: removal.htmlUrl,
    filesRemoved: removal.deleted.length,
    redirected: removal.tombstoned,
    notRemoved: removal.notRemoved,
    rebuilding: !!removal.sha,
    warning: storageWarning,
    note: removal.sha
      ? "Deleted. It has been removed from the website, the old address now points at the projects page, and Cloudflare is rebuilding now."
      : "Deleted. It had never been published, so the website did not need changing.",
    generatedAt: new Date().toISOString(),
  });
}

/* ------------------------------------------------------------------ *
 * Handler                                                             *
 * ------------------------------------------------------------------ */

module.exports = async (req, res) => {
  const startedAt = Date.now();
  const msLeft = () => FUNCTION_BUDGET_MS - (Date.now() - startedAt);

  if (applyCors(req, res)) return;
  res.setHeader("Content-Type", "application/json");

  // Every mutation is a POST with an `action` in the body: CORS advertises only
  // GET, POST and OPTIONS, so a DELETE or PATCH verb would fail preflight.
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "method" }));
  }
  // The only CSRF defence — the session cookie is SameSite=None by necessity.
  if (!isAllowedOrigin(req)) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ ok: false, error: "origin" }));
  }
  // 401, never 403: the admin client shows the login screen only on a 401.
  if (!requireSession(req)) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
  }
  if (!process.env.SC_SUPABASE_URL || !process.env.SC_SUPABASE_SERVICE_ROLE_KEY) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "Supabase not configured." }));
  }
  // Checked up front so a missing token is explained before any work is done,
  // rather than failing halfway through a publish.
  if (!github.isConfigured()) {
    res.statusCode = 500;
    return res.end(
      JSON.stringify({
        ok: false,
        error: "Publishing is not configured. Set SC_GITHUB_TOKEN in the Vercel project.",
      })
    );
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    body = {};
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) body = {};

  const action = typeof body.action === "string" ? body.action : "";
  const slug = typeof body.slug === "string" ? body.slug : "";

  // An unrecognised action is refused outright — these are state-changing, so
  // there is no safe default to fall back to.
  if (!ACTIONS.includes(action)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "action" }));
  }
  // The single source of truth for the slug shape, reused rather than re-written.
  if (!projectSchema.shape.slug.safeParse(slug).success) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "slug" }));
  }
  // Deleting is irreversible for the draft, so the client must echo the slug.
  if (action === "delete" && body.confirm !== slug) {
    return sendRefusal(req, res, "delete", slug, 400, "confirm", "confirm did not match the slug");
  }

  try {
    if (action === "publish") return await doPublish(req, res, slug, msLeft);
    if (action === "unpublish") return await doUnpublish(req, res, slug);
    return await doDelete(req, res, slug);
  } catch (err) {
    // The allow-list refusing a path is a 400, not an upstream failure: it means
    // this request tried to touch something the publisher may never write.
    if (err && err.code === "path_not_permitted") {
      console.error(`sc-admin-publish ${action} path refused`, err.message);
      await audit(req, {
        slug,
        action,
        outcome: "refused",
        detail: `path_not_permitted: ${err.message}`.slice(0, 500),
      });
      return json(res, 400, {
        ok: false,
        error: "That change would touch a file the publisher is not allowed to write. Nothing was changed.",
        code: "path_not_permitted",
        generatedAt: new Date().toISOString(),
      });
    }
    if (err && err.code === "github_not_configured") {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return sendFailure(req, res, action, slug, err);
  }
};
