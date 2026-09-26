/**
 * SC Design Wirral — GitHub commit client for the projects CMS publisher.
 *
 * WHY THIS EXISTS
 * The public site is a Next.js static export on Cloudflare Pages, which rebuilds
 * from the `main` branch on every push. Supabase is only the *editing* store: the
 * live site never queries it for project content. So "publish" means writing
 * `content/projects/<slug>.json` plus the project's images into the git repo, and
 * letting the Cloudflare build turn them into prerendered, indexable pages. This
 * module is the piece that does that writing.
 *
 * A commit pushed this way with a personal access token DOES fire the repository
 * push webhook, so the connected Cloudflare Pages build runs exactly as it would
 * for a human push. That is the whole reason publishing from the admin works at
 * all — and it is also why no commit message here may contain a CI-skip marker
 * (`[skip ci]`, `[CI Skip]`, `[no ci]`): Cloudflare Pages honours those, and the
 * publish would appear to succeed while never deploying. `commitChanges()`
 * strips them defensively.
 *
 * WHY THE GIT DATA API AND NOT THE CONTENTS API
 * `PUT /repos/{owner}/{repo}/contents/{path}` can only write ONE file per call,
 * and each call is its own commit — GitHub's own documentation warns that
 * parallel calls to it conflict. Publishing a case study is inherently a
 * multi-file change (one JSON file plus every image, and on unpublish a JSON
 * deletion plus every image deletion), and a half-applied publish is exactly the
 * state we must never leave the live site in: the build would either render a
 * page whose photos 404, or delete photos while the page still references them.
 *
 * The lower-level Git Data API lets us assemble the entire change off to one side
 * and land it as ONE atomic commit:
 *
 *   1. GET  /repos/{o}/{r}/commits/{branch}      → HEAD sha + base tree sha
 *   2. POST /repos/{o}/{r}/git/blobs             → one blob per file (base64)
 *   3. POST /repos/{o}/{r}/git/trees             → a new tree on top of base_tree
 *   4. POST /repos/{o}/{r}/git/commits           → a commit with parents:[HEAD]
 *   5. PATCH /repos/{o}/{r}/git/refs/heads/{br}  → move the branch (force:false)
 *
 * Nothing is visible to anybody — not to a clone, not to Cloudflare — until step
 * 5 succeeds. A failure at any earlier step leaves the branch exactly where it
 * was, and the orphaned blobs/trees are simply garbage collected. Step 5's
 * `force: false` is a compare-and-swap: it only succeeds if the branch has not
 * moved since step 1, which is the entire race defence against a second publish
 * (or a human push) landing in between. `force: true` would silently discard
 * that other work and must never appear in an unattended publisher.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO
 * It does not decide *which* paths may be written. The publish path allow-list
 * lives in `serverlib/cms.js` (`assertAllowedPaths`) and the calling endpoint must
 * apply it before handing paths over; requiring cms.js here would drag zod into a
 * module that is otherwise pure Node + global fetch. The only path checking done
 * below is a cheap structural sanity pass (no traversal, no absolute paths, no
 * backslashes) so a malformed path can never reach the API.
 *
 * Env vars (set in the SC `scdesign-wirral` Vercel project):
 *   SC_GITHUB_TOKEN   (required) — fine-grained PAT, Contents: Read and write
 *   SC_GITHUB_REPO    (optional) — "owner/repo", default mtaylor-afk/scdesign-wirral
 *   SC_GITHUB_BRANCH  (optional) — default "main" (the Cloudflare deploy branch)
 */

const API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";
/** GitHub rejects requests from some clients with no User-Agent, so always send one. */
const USER_AGENT = "scdesign-admin-publisher";

const DEFAULT_REPO = "mtaylor-afk/scdesign-wirral";
const DEFAULT_BRANCH = "main";

/**
 * Machine-made history: the author/committer are free-form on the Git Data API,
 * so use an unmistakable identity rather than impersonating Sean or Matthew.
 */
const COMMIT_IDENTITY = {
  name: "SC Design Admin Publisher",
  email: "admin-publisher@scdesignwirral.co.uk",
};

/**
 * Authenticated calls get 5,000 requests/hour, which a publish never approaches.
 * The limit that actually bites is the SECONDARY one: no more than 80
 * content-generating requests per minute, where each POST/PATCH counts as 5
 * points. A 40-image project is 40 blob POSTs (200 points) plus tree + commit +
 * ref (15) — fine sequentially, but firing them all at once is precisely the
 * burst shape GitHub throttles, and a 403 there would abort a publish that had
 * already uploaded half its images. Five at a time keeps a big publish inside the
 * budget while still being ~5x faster than serial.
 */
const BLOB_CONCURRENCY = 5;

/**
 * Retries of the whole 1–5 sequence after a lost compare-and-swap at step 5.
 * Re-PATCHing the same commit sha would fail forever (its parent is stale), so a
 * retry must rebuild the tree on the new base.
 */
const MAX_RETRIES = 3;

/** git blob mode for a normal non-executable file. MUST be the string, not 0o100644. */
const FILE_MODE = "100644";

/**
 * Last value seen in the (undocumented, opportunistic) token-expiry response
 * header, so the UI can warn Sean before the PAT lapses mid-month.
 */
let lastTokenExpiry = null;

/* ------------------------------------------------------------------ *
 * Configuration                                                       *
 * ------------------------------------------------------------------ */

function token() {
  return process.env.SC_GITHUB_TOKEN || "";
}

/** True when a publishing token is present. Callers gate on this before anything else. */
function isConfigured() {
  return !!token();
}

function configError() {
  const err = new Error("Publishing is not configured. Set SC_GITHUB_TOKEN in the Vercel project.");
  err.code = "github_not_configured";
  return err;
}

/**
 * The repository this publisher writes to.
 * @returns {{owner:string, repo:string, branch:string}}
 * @throws if SC_GITHUB_REPO is set but is not in "owner/repo" form.
 */
function repoInfo() {
  const raw = (process.env.SC_GITHUB_REPO || DEFAULT_REPO).trim();
  const m = /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/.exec(raw);
  if (!m) {
    const err = new Error('The SC_GITHUB_REPO setting is not in "owner/repo" form.');
    err.code = "github_not_configured";
    throw err;
  }
  const branch = (process.env.SC_GITHUB_BRANCH || DEFAULT_BRANCH).trim() || DEFAULT_BRANCH;
  return { owner: m[1], repo: m[2], branch };
}

/** Encode a path for a URL while leaving its "/" separators intact. */
function encodePath(p) {
  return String(p)
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

/* ------------------------------------------------------------------ *
 * Low-level request + error mapping                                   *
 * ------------------------------------------------------------------ */

/**
 * One GitHub API call. Never throws on an HTTP status — returns the response plus
 * its body text so callers can decide (step 5 retries rather than throws).
 */
async function ghRequest(method, path, body) {
  if (!isConfigured()) throw configError();
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token()}`,
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": USER_AGENT,
  };
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, init);
  // Opportunistic: not formally documented, present on fine-grained PAT calls.
  const exp = res.headers.get("github-authentication-token-expiration");
  if (exp) lastTokenExpiry = exp;
  const text = await res.text().catch(() => "");
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { ok: res.ok, status: res.status, res, text, json };
}

/** The `message` GitHub returned, trimmed to something safe to show. */
function apiMessage(r) {
  const m = r && r.json && typeof r.json.message === "string" ? r.json.message : "";
  return m ? m.slice(0, 200) : "";
}

/**
 * Turn a failed GitHub response into an Error whose message can be shown to Sean
 * verbatim: sentence-case, ending in a full stop, and saying what to do next.
 * `err.code` is the snake_case machine code and `err.status` the HTTP status.
 */
function ghError(what, r) {
  const { owner, repo } = safeRepoLabel();
  // States exactly which permission the endpoint wanted — quote it verbatim, it
  // is the single most useful line when a fine-grained PAT is scoped wrongly.
  const accepted = r.res && r.res.headers ? r.res.headers.get("x-accepted-github-permissions") : "";
  const need = accepted ? ` GitHub says the required permission is: ${accepted}` : "";
  const detail = apiMessage(r);
  let code = "github_failed";
  let message;

  if (r.status === 401) {
    code = "github_unauthorized";
    message =
      "GitHub rejected the publishing token (401 Bad credentials). It is invalid or has expired — " +
      "create a new fine-grained personal access token with Contents: Read and write and set it as " +
      "SC_GITHUB_TOKEN.";
  } else if (r.status === 403) {
    code = "github_forbidden";
    message =
      "The publishing token is not allowed to do this (403). It is most likely missing the " +
      "Contents: Read and write permission on the repository.";
  } else if (r.status === 404) {
    // GitHub deliberately returns 404 rather than 403 for resources a token
    // cannot see, so a 404 here is a PERMISSIONS problem. Never report it as a
    // missing repository or a missing branch — that sends Sean hunting for a
    // problem that does not exist.
    code = "github_no_access";
    message =
      `The publishing token cannot see ${owner}/${repo} (404). GitHub returns 404 instead of 403 ` +
      "for anything a token has no access to, so this is a token permissions problem: check the " +
      "token is granted access to this repository with Contents: Read and write.";
  } else if (r.status === 422 && what === "tree") {
    code = "github_tree_rejected";
    message =
      "Could not assemble the commit (422). One of the files to be removed no longer exists in " +
      "the repository — refresh and try again.";
  } else if (r.status === 409 || r.status === 422) {
    code = "github_conflict";
    message =
      "Somebody else changed the website at the same moment, so the change was not applied. " +
      "Nothing was changed — try again.";
  } else if (r.status === 429 || (r.status === 403 && /rate limit/i.test(detail))) {
    code = "github_rate_limited";
    message = "GitHub is rate limiting the publisher. Nothing was changed — wait a minute and try again.";
  } else if (r.status >= 500) {
    code = "github_unavailable";
    message = `GitHub is temporarily unavailable (${r.status}). Nothing was changed — try again shortly.`;
  } else {
    message = `GitHub refused the request (${r.status}).`;
  }

  const err = new Error(`${message}${need}${detail ? ` (GitHub: ${detail})` : ""} [step: ${what}]`);
  err.code = code;
  err.status = r.status;
  err.step = what;
  if (accepted) err.acceptedPermissions = accepted;
  return err;
}

/** Repo label for messages, tolerant of a malformed SC_GITHUB_REPO. */
function safeRepoLabel() {
  try {
    return repoInfo();
  } catch {
    return { owner: "the", repo: "repository", branch: DEFAULT_BRANCH };
  }
}

/* ------------------------------------------------------------------ *
 * Path + content hygiene                                             *
 * ------------------------------------------------------------------ */

/**
 * Structural sanity only — the real allow-list is `assertAllowedPaths` in
 * serverlib/cms.js and the calling endpoint is responsible for it.
 */
function assertSafePath(p) {
  const bad =
    typeof p !== "string" ||
    !p ||
    p.length > 300 ||
    p.startsWith("/") ||
    p.startsWith(".") ||
    p.includes("..") ||
    p.includes("\\") ||
    p.includes("//") ||
    p.includes("\0");
  if (bad) {
    const err = new Error(`Refusing to commit an unsafe path: ${String(p).slice(0, 120)}`);
    err.code = "path_not_permitted";
    throw err;
  }
}

/**
 * Normalise caller-supplied base64: a browser-produced value often arrives as a
 * `data:image/jpeg;base64,...` URL, and GitHub's blob endpoint will reject the
 * prefix. Whitespace (including the newlines some encoders insert) is dropped.
 */
function normaliseBase64(value, label) {
  if (typeof value !== "string" || !value) {
    const err = new Error(`Missing file contents for ${label}.`);
    err.code = "github_bad_input";
    throw err;
  }
  const cleaned = value.replace(/^data:[^;,]*;base64,/i, "").replace(/\s+/g, "");
  if (!cleaned || !/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned) || cleaned.length % 4 !== 0) {
    const err = new Error(`File contents for ${label} are not valid base64.`);
    err.code = "github_bad_input";
    throw err;
  }
  return cleaned;
}

/**
 * Keep CI-skip markers out of the history. Cloudflare Pages honours them, so one
 * in a publish commit would mean the site silently never rebuilds.
 */
function sanitiseMessage(message) {
  const cleaned = String(message == null ? "" : message)
    .replace(/\0/g, "")
    .replace(/\[\s*(?:skip[\s-]*ci|ci[\s-]*skip|no[\s-]*ci|skip[\s-]*deploy)\s*\]/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .slice(0, 2000);
  return cleaned || "Update project content";
}

/* ------------------------------------------------------------------ *
 * The five steps                                                      *
 * ------------------------------------------------------------------ */

/**
 * Step 1 — head commit sha AND base tree sha in a single call. Cheaper than
 * `GET /git/ref/heads/{branch}` followed by `GET /git/commits/{sha}`.
 */
async function readHead() {
  const { owner, repo, branch } = repoInfo();
  const r = await ghRequest("GET", `/repos/${owner}/${repo}/commits/${encodePath(branch)}`);
  if (!r.ok) throw ghError("head", r);
  const headSha = r.json && r.json.sha;
  const baseTreeSha = r.json && r.json.commit && r.json.commit.tree && r.json.commit.tree.sha;
  if (!headSha || !baseTreeSha) {
    const err = new Error("GitHub did not return the current state of the website branch.");
    err.code = "github_failed";
    throw err;
  }
  return { headSha, baseTreeSha };
}

/** Step 2 — one blob per file. Binary images go the same way: base64 of raw bytes. */
async function createBlob(contentBase64) {
  const { owner, repo } = repoInfo();
  const r = await ghRequest("POST", `/repos/${owner}/${repo}/git/blobs`, {
    content: contentBase64,
    encoding: "base64",
  });
  if (!r.ok) throw ghError("blob", r);
  const sha = r.json && r.json.sha;
  if (!sha) {
    const err = new Error("GitHub did not return an id for an uploaded file.");
    err.code = "github_failed";
    throw err;
  }
  return sha;
}

/** Run `fn` over `items` with at most `limit` in flight. Preserves input order. */
async function mapWithLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Step 3 — the tree. `base_tree` is MANDATORY: without it the entry list is read
 * as the complete repository contents, i.e. everything not listed is deleted.
 * A deletion is the same entry shape with `sha: null` — it still needs `path`,
 * `mode` and `type`. Git has no directory objects, so there is no "delete a
 * folder" entry: delete the leaves and the directory stops existing.
 */
async function createTree(baseTreeSha, entries) {
  const { owner, repo } = repoInfo();
  const r = await ghRequest("POST", `/repos/${owner}/${repo}/git/trees`, {
    base_tree: baseTreeSha,
    tree: entries,
  });
  if (!r.ok) throw ghError("tree", r);
  const sha = r.json && r.json.sha;
  if (!sha) {
    const err = new Error("GitHub did not return an id for the assembled change.");
    err.code = "github_failed";
    throw err;
  }
  return sha;
}

/**
 * Step 4 — the commit. `parents` must be exactly `[headSha]`: omitting it creates
 * a ROOT commit, which would orphan the entire history behind the new branch tip.
 */
async function createCommit(message, treeSha, headSha) {
  const { owner, repo } = repoInfo();
  const now = new Date().toISOString();
  const identity = Object.assign({ date: now }, COMMIT_IDENTITY);
  const r = await ghRequest("POST", `/repos/${owner}/${repo}/git/commits`, {
    message,
    tree: treeSha,
    parents: [headSha],
    author: identity,
    committer: identity,
  });
  if (!r.ok) throw ghError("commit", r);
  const sha = r.json && r.json.sha;
  if (!sha) {
    const err = new Error("GitHub did not return an id for the new commit.");
    err.code = "github_failed";
    throw err;
  }
  return { sha, htmlUrl: (r.json && r.json.html_url) || null };
}

/**
 * Step 5 — move the branch. Note the asymmetry in GitHub's URLs: reading is
 * `/git/ref/...` (singular) but updating is `/git/refs/...` (PLURAL). Getting
 * that wrong is the number-one cause of a spurious 404 here.
 *
 * `force: false` makes this a compare-and-swap against the sha read in step 1.
 * Returns the raw result so the caller can retry instead of failing.
 */
async function updateRef(newCommitSha) {
  const { owner, repo, branch } = repoInfo();
  return ghRequest("PATCH", `/repos/${owner}/${repo}/git/refs/heads/${encodePath(branch)}`, {
    sha: newCommitSha,
    force: false,
  });
}

/* ------------------------------------------------------------------ *
 * Reading the repository                                              *
 * ------------------------------------------------------------------ */

/** All blob paths in a tree. Throws if GitHub truncated the listing. */
async function treeBlobPaths(baseTreeSha) {
  const { owner, repo } = repoInfo();
  const r = await ghRequest(
    "GET",
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(baseTreeSha)}?recursive=1`
  );
  if (!r.ok) throw ghError("list", r);
  // A truncated listing would make a delete incomplete — leaving orphaned images
  // on the live site — so refuse to work from a partial answer.
  if (r.json && r.json.truncated) {
    const err = new Error(
      "GitHub returned only part of the file list for the website, so the change was not applied. " +
        "Nothing was changed — try again."
    );
    err.code = "github_tree_truncated";
    throw err;
  }
  const entries = (r.json && Array.isArray(r.json.tree) ? r.json.tree : []).filter(
    (e) => e && e.type === "blob" && typeof e.path === "string"
  );
  return entries.map((e) => e.path);
}

/**
 * Real committed paths under `prefix` (e.g. "public/work/cms/kitchen-extension/").
 * Deletes must be built from this — GitHub errors the WHOLE tree creation if a
 * delete names a path that does not exist, so filenames are never guessed.
 *
 * @param {string} prefix "" for every file in the repository.
 * @returns {Promise<string[]>}
 */
async function listTree(prefix) {
  const p = typeof prefix === "string" ? prefix : "";
  const { baseTreeSha } = await readHead();
  const paths = await treeBlobPaths(baseTreeSha);
  return p ? paths.filter((x) => x.startsWith(p)) : paths;
}

/**
 * Decoded text of one committed file, or null if it is not there.
 * Used to read and update `content/removed-projects.json`.
 *
 * Reading through the Contents API is fine — it is only WRITING through it that
 * this module avoids (one commit per file, and conflicting parallel calls).
 *
 * @param {string} path
 * @returns {Promise<string|null>}
 */
async function readTextFile(path) {
  assertSafePath(path);
  const { owner, repo, branch } = repoInfo();
  const r = await ghRequest(
    "GET",
    `/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`
  );
  if (r.status === 404) return null;
  if (!r.ok) throw ghError("read", r);
  const body = r.json;
  if (!body || body.type !== "file") {
    const err = new Error(`"${path}" is not a file in the repository.`);
    err.code = "github_failed";
    throw err;
  }
  if (body.encoding === "base64" && typeof body.content === "string") {
    return Buffer.from(body.content.replace(/\s+/g, ""), "base64").toString("utf8");
  }
  if (typeof body.content === "string" && body.content) return body.content;
  // Files over 1 MB come back with encoding "none" and no content.
  const err = new Error(`"${path}" is too large for the publisher to read.`);
  err.code = "github_failed";
  throw err;
}

/* ------------------------------------------------------------------ *
 * The public commit call                                              *
 * ------------------------------------------------------------------ */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Commit many writes and deletions as ONE atomic commit, then move the branch.
 *
 * @param {{writes?:Array<{path:string,contentBase64:string}>, deletes?:string[], message?:string}} opts
 * @returns {Promise<{sha:string|null, htmlUrl:string|null, tokenExpiry:string|null, noop?:boolean, skippedDeletes?:string[]}>}
 *   `sha` is null (with `noop: true`) when there was nothing to do.
 * @throws an Error with a Sean-readable `message` plus `code`/`status`. A throw
 *   from any step before the ref update means the branch was never touched.
 */
async function commitChanges(opts) {
  if (!isConfigured()) throw configError();
  const o = opts || {};
  const writes = Array.isArray(o.writes) ? o.writes : [];
  const deletes = Array.isArray(o.deletes) ? o.deletes : [];

  // Nothing to do: never create an empty commit (it would trigger a pointless
  // Cloudflare rebuild and add a meaningless entry to the history).
  if (!writes.length && !deletes.length) {
    return { sha: null, htmlUrl: null, tokenExpiry: lastTokenExpiry, noop: true };
  }

  const prepared = writes.map((w) => {
    const path = w && w.path;
    assertSafePath(path);
    return { path, contentBase64: normaliseBase64(w && w.contentBase64, path) };
  });
  let deletePaths = deletes.slice();
  deletePaths.forEach(assertSafePath);
  // Last write/delete wins if a caller listed the same path twice, and a path
  // being written is never also deleted in the same commit.
  const writtenPaths = new Set(prepared.map((p) => p.path));
  deletePaths = Array.from(new Set(deletePaths.filter((p) => !writtenPaths.has(p))));

  const message = sanitiseMessage(o.message);

  // Blobs are content-addressed and independent of the base tree, so they are
  // created ONCE and reused across retries; re-uploading identical content would
  // also be safe (GitHub returns the same sha), just wasteful.
  const blobShas = await mapWithLimit(prepared, BLOB_CONCURRENCY, (p) =>
    createBlob(p.contentBase64)
  );

  const skippedDeletes = [];
  let lastFailure = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Step 1 runs again on every attempt: a retry must rebuild the tree on the
    // base the branch actually has now, otherwise the compare-and-swap in step 5
    // can never succeed.
    const { headSha, baseTreeSha } = await readHead();

    const entries = prepared
      .map((p, i) => ({ path: p.path, mode: FILE_MODE, type: "blob", sha: blobShas[i] }))
      // A deletion is the same entry with sha: null.
      .concat(deletePaths.map((path) => ({ path, mode: FILE_MODE, type: "blob", sha: null })));

    let treeSha;
    try {
      treeSha = await createTree(baseTreeSha, entries);
    } catch (err) {
      // "422 on tree creation" almost always means one of the paths we are
      // deleting has already gone (a concurrent unpublish, or a stale list).
      // Refresh against the real tree, drop what is no longer there, and retry.
      if (err.code === "github_tree_rejected" && deletePaths.length && attempt < MAX_RETRIES) {
        const existing = new Set(await treeBlobPaths(baseTreeSha));
        const kept = deletePaths.filter((p) => existing.has(p));
        if (kept.length !== deletePaths.length) {
          for (const p of deletePaths) if (!existing.has(p)) skippedDeletes.push(p);
          deletePaths = kept;
          if (!prepared.length && !deletePaths.length) {
            return {
              sha: null,
              htmlUrl: null,
              tokenExpiry: lastTokenExpiry,
              noop: true,
              skippedDeletes,
            };
          }
          lastFailure = err;
          continue;
        }
      }
      throw err;
    }

    const commit = await createCommit(message, treeSha, headSha);

    const patched = await updateRef(commit.sha);
    if (patched.ok) {
      return {
        sha: commit.sha,
        htmlUrl: commit.htmlUrl,
        tokenExpiry: lastTokenExpiry,
        skippedDeletes: skippedDeletes.length ? skippedDeletes : undefined,
      };
    }

    // The branch moved under us (expect 409 or 422, but do not pin on the status
    // or on an error string — GitHub has changed both). Nothing is live yet: the
    // commit exists but no ref points at it, so start over from step 1.
    lastFailure = ghError("ref", patched);
    if (attempt < MAX_RETRIES) {
      await sleep(250 * (attempt + 1));
      continue;
    }
  }

  const err = new Error(
    "The website was being changed by something else and the update could not be applied after " +
      `${MAX_RETRIES + 1} attempts. Nothing was changed — try again in a moment.` +
      (lastFailure ? ` (Last problem: ${lastFailure.message})` : "")
  );
  err.code = "github_conflict";
  err.status = lastFailure && lastFailure.status ? lastFailure.status : 409;
  throw err;
}

module.exports = {
  isConfigured,
  repoInfo,
  commitChanges,
  listTree,
  readTextFile,
};
