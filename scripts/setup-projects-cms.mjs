// Projects CMS — OPTIONAL set-up for IMMEDIATE publishing.
//
// Not needed: with nothing set up, drafts are kept as files in Supabase Storage and
// publishing is queued for the cms-publish workflow (live within ~15 minutes, no
// token to renew). Run this only to publish while Sean waits instead (1–3 minutes),
// at the price of a GitHub token that expires yearly.
//
//   npm run cms:setup
//   node scripts/setup-projects-cms.mjs --dry-run   shows what it would do; changes nothing
//
// Run it yourself, in a terminal on your own computer. It does docs/PROJECTS-CMS.md
// §2.1–2.3 in one go. Tokens and passwords are asked for at hidden prompts (nothing
// shows as you type); none is saved, printed or sent anywhere except to the service
// it belongs to.
//
// What it does, in order:
//   1. Vercel: checks the token can see project scdesign-wirral and reads the NAMES of
//      its environment variables (never the values). Makes SC_ADMIN_SESSION_SECRET if
//      missing; asks for anything else that's missing; offers a new admin password.
//   2. Supabase: with a Supabase access token, checks for the sc_projects tables and
//      the project-media bucket and runs db/sc_projects.sql if any is missing (the SQL
//      is safe to run twice). Without one, opens the SQL editor and waits.
//   3. GitHub: opens the fine-grained token page, takes the pasted token, and proves it
//      can write to this repo by making one unreferenced blob (no branch changes).
//   4. Saves the variables (encrypted, Production and Preview), redeploys the API from
//      GitHub main and waits until it is ready.
// Running it again is safe: it only adds what is missing.
//
// Cloudflare (§2.4) needs nothing: GitHub shows a Cloudflare build on every push to main.
//
// run() takes everything it talks to as arguments, so scripts/tests/
// setup-projects-cms.test.mjs drives it with fake services.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The Vercel project the admin API lives in (ids, not secrets). */
export const VERCEL = Object.freeze({
  api: "https://api.vercel.com",
  teamId: "team_JoB84CwfK3PnrbDP9qdHR47s",
  projectId: "prj_fBnJPu2XEFYf62EgYWU6EaAOxLmY",
  projectName: "scdesign-wirral",
  repoId: 1262205324,
  branch: "main",
});

export const GITHUB = Object.freeze({ api: "https://api.github.com", owner: "mtaylor-afk", repo: "scdesign-wirral", branch: "main" });
/** A private repo the publishing token should NOT be able to see. */
const OTHER_REPO = "mtaylor-afk/QCbuild1";

export const SUPABASE = Object.freeze({ api: "https://api.supabase.com", defaultRef: "yxapzkiodjecladjziom" });
export const SQL_FILE = path.resolve(here, "../db/sc_projects.sql");

export const ADMIN_URL = "https://scdesignwirral.co.uk/admin/";
// GitHub fills the form in from these. Repository access can't be pre-filled, so the
// wizard says which to pick.
export const GITHUB_TOKEN_URL =
  "https://github.com/settings/personal-access-tokens/new?name=SC+Design+projects+publishing" +
  "&description=Lets+the+admin+publish+Sean%27s+project+pages&target_name=mtaylor-afk&expires_in=366&contents=write";
export const SUPABASE_TOKEN_URL = "https://supabase.com/dashboard/account/tokens";

const TARGETS = ["production", "preview"];
const MIN_PASSWORD = 12;
const DEPLOY_TIMEOUT_MS = 6 * 60 * 1000;
const POLL_MS = 5000;
const CHECK_SQL =
  "select to_regclass('public.sc_projects') is not null as projects, " +
  "to_regclass('public.sc_project_events') is not null as events, " +
  "exists (select 1 from storage.buckets where id = 'project-media') as bucket";

/**
 * A planned stop with a short result code. Its message is always our own plain
 * words, never anything a service sent back, so no secret can leak.
 */
export class Stop extends Error {
  /**
   * @param {string} code
   * @param {string} [message]
   */
  constructor(code, message) {
    super(message || "");
    this.code = code;
  }
}

/**
 * @typedef {{ status: number, data: any, headers?: Record<string, string> }} ApiReply
 * @typedef {(method: string, apiPath: string, body?: unknown) => Promise<ApiReply>} ApiRequest
 * @typedef {(token: string) => ApiRequest} ApiFactory
 * @typedef {object} Deps
 * @property {ApiFactory} [vercel]
 * @property {ApiFactory} [github]
 * @property {ApiFactory} [supabase]
 * @property {(question: string) => Promise<string>} [prompt]
 * @property {(question: string) => Promise<string>} [hiddenPrompt]
 * @property {(url: string) => void} [openUrl]
 * @property {(line: string) => void} [log]
 * @property {(text: string) => void} [write]
 * @property {() => string} [readSql]
 * @property {string[]} [argv]
 * @property {(ms: number) => Promise<void>} [sleep]
 * @property {() => number} [now]
 */

/**
 * A JSON REST client for one service and one token. A network failure becomes a
 * plain "NETWORK" stop, so the token never reaches an error message.
 * @param {string} base
 * @param {string} label
 * @param {Record<string, string>} [extra]
 * @returns {ApiFactory}
 */
function restApi(base, label, extra = {}) {
  return (token) => async (method, apiPath, body) => {
    /** @type {Record<string, string>} */
    const headers = Object.assign({ Authorization: "Bearer " + token, Accept: "application/json", "User-Agent": "sc-projects-setup" }, extra);
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let res;
    try {
      res = await fetch(base + apiPath, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });
    } catch (err) {
      throw new Stop("NETWORK", "Couldn't reach " + label + " (" + safeCode(err) + "). Check the internet or VPN, then run this again.");
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    const expiry = res.headers.get("github-authentication-token-expiration");
    return { status: res.status, data, headers: expiry ? { expiry } : {} };
  };
}

export const vercelApi = restApi(VERCEL.api, "Vercel");
export const githubApi = restApi(GITHUB.api, "GitHub", { "X-GitHub-Api-Version": "2022-11-28" });
export const supabaseApi = restApi(SUPABASE.api, "Supabase");

/**
 * A short, safe label for an unexpected error: its code or class name, never its message.
 * @param {unknown} err
 */
function safeCode(err) {
  const e = /** @type {any} */ (err);
  const code = e && e.cause && typeof e.cause.code === "string" ? e.cause.code : e && typeof e.code === "string" ? e.code : e && e.name;
  return typeof code === "string" && /^[A-Za-z0-9_]{1,40}$/.test(code) ? code : "unknown";
}

/** ?teamId=... for every project call. */
function team(extra = "") {
  return "?teamId=" + VERCEL.teamId + extra;
}

/**
 * The names of the project's variables that reach Production. Values are never kept.
 * @param {ApiRequest} request
 * @returns {Promise<Set<string>>}
 */
async function readNames(request) {
  const r = await request("GET", "/v10/projects/" + VERCEL.projectId + "/env" + team());
  if (r.status !== 200) throw new Stop("VERCEL_ERROR", "Couldn't read the project's settings (Vercel answered " + r.status + "). Try again in a minute.");
  const list = Array.isArray(r.data) ? r.data : r.data && Array.isArray(r.data.envs) ? r.data.envs : [];
  /** @type {Set<string>} */
  const names = new Set();
  for (const e of list) {
    if (!e || typeof e.key !== "string") continue;
    const targets = Array.isArray(e.target) ? e.target : [e.target];
    if (targets.includes("production")) names.add(e.key);
  }
  return names;
}

/**
 * @param {Required<Deps>} d
 * @param {string} question
 * @param {boolean} fallback
 */
async function yesNo(d, question, fallback) {
  const a = (await d.prompt(question)).trim().toLowerCase();
  if (!a) return fallback;
  return a === "y" || a === "yes";
}

/**
 * Ask for a new admin password twice. Empty = keep the current one (when there is one).
 * @param {Required<Deps>} d
 * @param {boolean} required
 * @returns {Promise<string>}
 */
async function askPassword(d, required) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const p = await d.hiddenPrompt("New admin password (at least " + MIN_PASSWORD + " characters" + (required ? "" : ", Enter keeps the current one") + "): ");
    if (!p && !required) return "";
    if (p.length < MIN_PASSWORD) {
      d.log("  Too short. A few unrelated words work well, e.g. four words with spaces.");
      continue;
    }
    if ((await d.hiddenPrompt("Type it again: ")) !== p) {
      d.log("  Those didn't match.");
      continue;
    }
    return p;
  }
  throw new Stop("NO_PASSWORD", "No admin password was set, so nothing was changed.");
}

/**
 * Step 1: the token, the project and the admin's own settings.
 * @param {Required<Deps>} d
 * @param {{ key: string, value: string, note: string }[]} plan
 */
async function vercelStep(d, plan) {
  const { log } = d;
  log("STEP 1 of 3 — Vercel");
  log("Make a token at https://vercel.com/account/tokens : Scope = the team that owns");
  log("scdesign-wirral, Expiration = 1 day. Paste it below (right-click pastes); it won't show.");
  const token = (await d.hiddenPrompt("Vercel token: ")).trim();
  if (!token) throw new Stop("NO_TOKEN", "Nothing pasted, so nothing was changed.");
  const request = d.vercel(token);

  const user = await request("GET", "/v2/user");
  if (user.status === 401 || user.status === 403) {
    throw new Stop("TOKEN_REFUSED", "Vercel didn't accept that token. Check it was pasted in full, or make a new one. Nothing was changed.");
  }
  if (user.status !== 200) throw new Stop("VERCEL_ERROR", "Vercel answered " + user.status + " when checking the token. Try again in a minute.");
  const project = await request("GET", "/v9/projects/" + VERCEL.projectId + team());
  if (project.status === 401 || project.status === 403 || project.status === 404) {
    throw new Stop("NO_PROJECT_ACCESS", "That token can't see the project scdesign-wirral. Make one whose Scope is the team that owns it. Nothing was changed.");
  }
  if (project.status !== 200) throw new Stop("VERCEL_ERROR", "Vercel answered " + project.status + " when opening the project. Try again in a minute.");
  log("  Token accepted; project scdesign-wirral found.");
  // Turning protection off changes who can reach the project, so it's left to him.
  const p = project.data || {};
  if (p.ssoProtection || p.passwordProtection) {
    log("  WARNING: Deployment Protection is ON for scdesign-wirral. The admin can't reach its");
    log("  own API while it is. In Vercel: scdesign-wirral, Settings, Deployment Protection, off.");
  }

  const names = await readNames(request);
  /** @type {string} */
  let supabaseUrl = "";
  if (!names.has("SC_SUPABASE_URL") || !names.has("SC_SUPABASE_SERVICE_ROLE_KEY")) {
    log("  The Supabase connection isn't set. Find both in Supabase: project sc-analytics,");
    log("  Project Settings, API.");
    if (!names.has("SC_SUPABASE_URL")) {
      supabaseUrl = (await d.prompt("  Project URL (https://….supabase.co): ")).trim().replace(/\/+$/, "");
      if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(supabaseUrl)) throw new Stop("BAD_SUPABASE_URL", "That isn't a Supabase project URL. Nothing was changed.");
      plan.push({ key: "SC_SUPABASE_URL", value: supabaseUrl, note: "Supabase project" });
    }
    if (!names.has("SC_SUPABASE_SERVICE_ROLE_KEY")) {
      const key = (await d.hiddenPrompt("  service_role key (it won't show): ")).trim();
      if (key.length < 30) throw new Stop("BAD_SUPABASE_KEY", "That doesn't look like a service_role key. Nothing was changed.");
      plan.push({ key: "SC_SUPABASE_SERVICE_ROLE_KEY", value: key, note: "Supabase key" });
    }
  } else {
    log("  Supabase connection: already set.");
  }
  if (!names.has("SC_ADMIN_SESSION_SECRET")) {
    plan.push({ key: "SC_ADMIN_SESSION_SECRET", value: crypto.randomBytes(48).toString("base64url"), note: "new, random" });
  }
  if (!names.has("SC_ADMIN_USER")) {
    const u = (await d.prompt("  Admin username (Enter = sean): ")).trim() || "sean";
    plan.push({ key: "SC_ADMIN_USER", value: u, note: "admin username" });
  }
  if (!names.has("SC_ADMIN_PASS")) {
    plan.push({ key: "SC_ADMIN_PASS", value: await askPassword(d, true), note: "admin password" });
  } else {
    log("  The admin can now change the live site, so it deserves a strong password.");
    log("  (The same login opens the analytics pages, so you'd both use the new one.)");
    if (await yesNo(d, "  Set a new admin password now? (y/N) ", false)) {
      const pass = await askPassword(d, false);
      if (pass) plan.push({ key: "SC_ADMIN_PASS", value: pass, note: "admin password" });
    }
  }
  return { request, names, supabaseUrl };
}

/**
 * Step 2: the tables and the photo bucket.
 * @param {Required<Deps>} d
 * @param {string} ref
 * @param {boolean} dry
 */
async function databaseStep(d, ref, dry) {
  const { log } = d;
  log("");
  log("STEP 2 of 3 — Supabase tables");
  log("Make an access token at " + SUPABASE_TOKEN_URL + " (any name). Paste it below,");
  log("or press Enter to run the SQL by hand instead.");
  const token = (await d.hiddenPrompt("Supabase access token: ")).trim();
  if (!token) return manualSql(d, ref);
  const request = d.supabase(token);
  /** @returns {Promise<boolean>} */
  const present = async () => {
    const r = await request("POST", "/v1/projects/" + ref + "/database/query", { query: CHECK_SQL });
    if (r.status === 401 || r.status === 403 || r.status === 404) {
      throw new Stop("SUPABASE_REFUSED", "Supabase didn't let that token into project " + ref + " (answer " + r.status + "). Check the token, or run this again and press Enter to do it by hand.");
    }
    if (r.status !== 200 && r.status !== 201) throw new Stop("SUPABASE_ERROR", "Supabase answered " + r.status + " to the check. Try again in a minute.");
    const row = Array.isArray(r.data) ? r.data[0] : null;
    return !!(row && row.projects && row.events && row.bucket);
  };
  if (await present()) {
    log("  Tables and photo bucket: already there.");
    return;
  }
  if (dry) {
    log("  Would run db/sc_projects.sql (tables or bucket missing).");
    return;
  }
  const r = await request("POST", "/v1/projects/" + ref + "/database/query", { query: d.readSql() });
  if (r.status !== 200 && r.status !== 201) throw new Stop("SQL_FAILED", "Supabase didn't run db/sc_projects.sql (answer " + r.status + "). Nothing else was changed; run this again.");
  if (!(await present())) throw new Stop("SQL_FAILED", "The SQL ran but the tables still aren't there. Run db/sc_projects.sql by hand in the SQL editor.");
  log("  Created the sc_projects tables and the private project-media bucket.");
}

/**
 * @param {Required<Deps>} d
 * @param {string} ref
 */
async function manualSql(d, ref) {
  const url = "https://supabase.com/dashboard/project/" + ref + "/sql/new";
  d.log("  Opening the SQL editor: " + url);
  d.log("  Paste in the whole of " + SQL_FILE);
  d.log("  and press Run. It is safe to run more than once.");
  d.openUrl(url);
  await d.prompt("  Press Enter once it says Success: ");
}

/**
 * Step 3: the publishing token.
 * @param {Required<Deps>} d
 * @param {Set<string>} names
 * @param {{ key: string, value: string, note: string }[]} plan
 * @param {boolean} dry
 */
async function githubStep(d, names, plan, dry) {
  const { log } = d;
  log("");
  log("STEP 3 of 3 — GitHub publishing token");
  if (names.has("SC_GITHUB_TOKEN") && !(await yesNo(d, "  A publishing token is already set. Replace it? (y/N) ", false))) {
    log("  Keeping the current token.");
  } else {
    log("  Opening GitHub's token page, mostly filled in. Check, then press Generate token:");
    log("    Repository access : Only select repositories -> scdesign-wirral");
    log("    Permissions       : Contents = Read and write (nothing else)");
    log("    Expiration        : one year (put a reminder in your diary)");
    d.openUrl(GITHUB_TOKEN_URL);
    const token = (await d.hiddenPrompt("Paste the token (starts github_pat_; it won't show): ")).trim();
    if (!token) throw new Stop("NO_GITHUB_TOKEN", "No GitHub token pasted, so nothing was saved.");
    if (!token.startsWith("github_pat_")) log("  That isn't a fine-grained token (github_pat_…). It will work, but can do more than it needs to.");
    const request = d.github(token);
    const repo = "/repos/" + GITHUB.owner + "/" + GITHUB.repo;
    const seen = await request("GET", repo);
    if (seen.status === 401) throw new Stop("GITHUB_REFUSED", "GitHub didn't accept that token. Copy it again in full. Nothing was saved.");
    if (seen.status !== 200) throw new Stop("GITHUB_NO_REPO", "That token can't see scdesign-wirral (answer " + seen.status + "). Under Repository access, pick it. Nothing was saved.");
    // A blob nothing points at: proves Contents write without touching any branch.
    if (!dry) {
      const blob = await request("POST", repo + "/git/blobs", { content: "projects-cms setup check", encoding: "utf-8" });
      if (blob.status !== 201) throw new Stop("GITHUB_NO_WRITE", "That token can read the repo but not write to it. Set Contents to Read and write. Nothing was saved.");
    }
    const other = await request("GET", "/repos/" + OTHER_REPO);
    if (other.status === 200) log("  Note: this token can also see " + OTHER_REPO + ". It works, but it only needs scdesign-wirral.");
    const expiry = seen.headers && seen.headers.expiry;
    log("  Token works" + (expiry ? "; it expires " + expiry + "." : "."));
    plan.push({ key: "SC_GITHUB_TOKEN", value: token, note: "publishing token" });
  }
  if (!names.has("SC_GITHUB_REPO")) plan.push({ key: "SC_GITHUB_REPO", value: GITHUB.owner + "/" + GITHUB.repo, note: "repo" });
  if (!names.has("SC_GITHUB_BRANCH")) plan.push({ key: "SC_GITHUB_BRANCH", value: GITHUB.branch, note: "branch" });
}

/**
 * @param {Required<Deps>} d
 * @param {{ dryRun: boolean }} flags
 */
async function wizard(d, flags) {
  const { log } = d;
  const dry = flags.dryRun;
  log("");
  log("Set up the Projects page in the SC Design admin, so Sean can publish case studies.");
  log("Three tokens are pasted along the way. Each is used for this run only, and none shows.");
  if (dry) log("DRY RUN: nothing will be changed. It only shows what it would do.");
  log("");

  /** @type {{ key: string, value: string, note: string }[]} */
  const plan = [];
  const { request, names, supabaseUrl } = await vercelStep(d, plan);
  const ref = supabaseUrl ? supabaseUrl.slice(8, 28) : SUPABASE.defaultRef;
  await databaseStep(d, ref, dry);
  await githubStep(d, names, plan, dry);

  log("");
  if (!plan.length) {
    log("Everything was already in place.");
    if (!dry && !(await yesNo(d, "Redeploy the admin API anyway? (y/N) ", false))) return finish(d, "OK");
  } else {
    log("Ready to save on scdesign-wirral (encrypted, Production and Preview). Names only:");
    for (const p of plan) log("  " + p.key + " (" + p.note + ")");
    if (dry) return "DRY_RUN";
    if (!(await yesNo(d, "Save these and redeploy now? (Y/n) ", true))) throw new Stop("CANCELLED", "Nothing was saved.");
    for (const p of plan) {
      const r = await request("POST", "/v10/projects/" + VERCEL.projectId + "/env" + team("&upsert=true"), {
        key: p.key,
        value: p.value,
        type: "encrypted",
        target: TARGETS,
      });
      const failed = r.data && Array.isArray(r.data.failed) && r.data.failed.length > 0;
      if ((r.status !== 200 && r.status !== 201) || failed) {
        throw new Stop("ENV_WRITE_FAILED", "Vercel didn't save " + p.key + " (answer " + r.status + "). Any above it were saved. Run this again to finish.");
      }
      log("  saved " + p.key);
    }
  }
  if (dry) return "DRY_RUN";
  await redeploy(d, request);
  return finish(d, "OK");
}

/**
 * @param {Required<Deps>} d
 * @param {string} code
 */
function finish(d, code) {
  d.log("");
  d.log("Done. Sign in at " + ADMIN_URL + " and open Content, Projects.");
  d.log("Try it first with a throwaway project (docs/PROJECTS-CMS.md section 6), then delete it.");
  return code;
}

/**
 * Redeploy production from GitHub main and wait until it's ready.
 * @param {Required<Deps>} d
 * @param {ApiRequest} request
 */
async function redeploy(d, request) {
  const r = await request("POST", "/v13/deployments" + team("&forceNew=1"), {
    name: VERCEL.projectName,
    project: VERCEL.projectId,
    target: "production",
    gitSource: { type: "github", repoId: VERCEL.repoId, ref: VERCEL.branch },
  });
  const id = r.data && typeof r.data.id === "string" ? r.data.id : "";
  if ((r.status !== 200 && r.status !== 201) || !id) {
    throw new Stop("DEPLOY_FAILED", "Vercel didn't start the redeploy (answer " + r.status + "). The settings are saved. In Vercel: scdesign-wirral, Deployments, latest Production, Redeploy.");
  }
  d.log("");
  d.write("Redeploying the admin API from GitHub main (usually 1 to 3 minutes) ");
  const start = d.now();
  let state = String(r.data.readyState || r.data.status || "QUEUED");
  while (!["READY", "ERROR", "CANCELED"].includes(state)) {
    if (d.now() - start > DEPLOY_TIMEOUT_MS) {
      d.write("\n");
      throw new Stop("DEPLOY_TIMEOUT", "The redeploy is taking longer than 6 minutes. It carries on by itself: check Vercel, Deployments.");
    }
    await d.sleep(POLL_MS);
    d.write(".");
    const g = await request("GET", "/v13/deployments/" + encodeURIComponent(id) + team());
    if (g.status === 200 && g.data) state = String(g.data.readyState || g.data.status || state);
  }
  d.write("\n");
  if (state !== "READY") throw new Stop("DEPLOY_FAILED", "The redeploy ended as " + state + ". The settings are saved. Vercel, Deployments shows why; then run this again.");
  d.log("Redeployed.");
}

/**
 * Run the wizard. Returns the result code.
 * @param {Deps} [deps]
 */
export async function run(deps = {}) {
  /** @type {Required<Deps>} */
  const d = {
    vercel: deps.vercel || vercelApi,
    github: deps.github || githubApi,
    supabase: deps.supabase || supabaseApi,
    prompt: deps.prompt || question,
    hiddenPrompt: deps.hiddenPrompt || hidden,
    openUrl: deps.openUrl || openInBrowser,
    log: deps.log || ((line) => console.log(line)),
    write: deps.write || ((text) => process.stdout.write(text)),
    readSql: deps.readSql || (() => fs.readFileSync(SQL_FILE, "utf8")),
    argv: deps.argv || [],
    sleep: deps.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    now: deps.now || Date.now,
  };
  let code;
  try {
    code = await wizard(d, { dryRun: d.argv.includes("--dry-run") });
  } catch (err) {
    if (err instanceof Stop) {
      code = err.code;
      if (err.message) {
        d.log("");
        d.log(err.message);
      }
    } else {
      code = "ERROR";
      d.log("");
      d.log("Something unexpected stopped the set-up (" + safeCode(err) + "). Nothing secret was shown or saved.");
    }
  }
  d.log("");
  d.log("Result code: " + code);
  return code;
}

// ---------------------------------------------------------------------------
// The real terminal and browser (not used by the tests).

/** @param {string} prompt @returns {Promise<string>} */
function question(prompt) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let answered = false;
    rl.on("SIGINT", () => rl.close());
    rl.on("close", () => {
      if (!answered) reject(new Stop("CANCELLED", "Cancelled."));
    });
    rl.question(prompt, (answer) => {
      answered = true;
      rl.close();
      resolve(answer);
    });
  });
}

/** Read a line without showing it. @param {string} prompt @returns {Promise<string>} */
function hidden(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY) {
      reject(new Stop("NO_TERMINAL", "Run this in a terminal window (npm run cms:setup), so tokens can be typed without showing."));
      return;
    }
    process.stdout.write(prompt);
    let value = "";
    const done = () => {
      input.setRawMode(false);
      input.pause();
      input.removeListener("data", onData);
      process.stdout.write("\n");
    };
    /** @param {string} chunk */
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          done();
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          done();
          reject(new Stop("CANCELLED", "Cancelled."));
          return;
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    };
    input.setRawMode(true);
    input.setEncoding("utf8");
    input.on("data", onData);
    input.resume();
  });
}

/** Open one of the three services' pages in the default browser, without a shell. @param {string} url */
function openInBrowser(url) {
  if (!/^https:\/\/(vercel\.com|github\.com|supabase\.com)\/[A-Za-z0-9/_~.?=&%+-]*$/.test(url)) return;
  const [cmd, args] = process.platform === "win32" ? ["explorer.exe", [url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    const child = spawn(cmd, args, { shell: false, detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {
    // The address is printed above, so it can be opened by hand.
  }
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
const self = fileURLToPath(import.meta.url);
if (invoked && (process.platform === "win32" ? invoked.toLowerCase() === self.toLowerCase() : invoked === self)) {
  run({ argv: process.argv.slice(2) }).then((code) => {
    process.exitCode = code === "OK" || code === "DRY_RUN" ? 0 : 1;
  });
}
