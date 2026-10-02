// WV Roofing — connect the admin screen and the private store on Vercel, step by step.
//
//   node scripts/wvroofing/setup-vercel.mjs              (or double-click the Desktop
//                                                         "SET UP WV ROOFING ADMIN.cmd")
//   node scripts/wvroofing/setup-vercel.mjs --dry-run    shows what it would do; changes nothing
//   node scripts/wvroofing/setup-vercel.mjs --rotate     also replaces the two secrets
//
// Run it yourself, in a terminal on your own computer. It asks for a Vercel token
// and the admin password at hidden prompts (nothing shows as you type). Neither is
// saved, printed or sent anywhere except to Vercel. Only a short result code, such
// as "RESULT=OK", is written to C:\dev\_wvroofing-src\setup-result.log.
//
// What it does, in order:
//   1. Checks the token can see project scdesign-wirral.
//   2. Reads the NAMES of the project's environment variables (never the values).
//   3. Database: opens Neon's page in the Vercel Marketplace and tells you what to
//      click (only you can accept Neon's terms), then checks it is connected.
//   4. Photo store: makes a private Blob store called wvroofing in London through
//      Vercel's documented API (POST /storage/stores/blob). Vercel's REST docs have
//      no call for connecting a store to chosen environments, so if the new store
//      doesn't show up on the project by itself, it opens the dashboard with the
//      clicks to make.
//   5. Makes WVR_SESSION_SECRET and CRON_SECRET if they're missing (never replaces
//      them unless you pass --rotate), and asks for the admin password.
//   6. Optionally sets the inbox for enquiry emails.
//   7. Saves the variables (encrypted, Production and Preview), redeploys the live
//      site from GitHub main, waits until it is ready and reads /health.
// Running it again is safe: it only adds what is missing.
//
// run() takes everything it talks to as arguments (the Vercel API, the prompts, the
// browser, the log), so scripts/wvroofing/tests/setup-vercel.test.mjs can drive it
// with a fake Vercel. The real Vercel API is only used by the command below.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const auth = require("../../serverlib/wvroofing/auth.js");

/** The one Vercel project and repository WV Roofing lives in (ids, not secrets). */
export const VERCEL = Object.freeze({
  api: "https://api.vercel.com",
  teamId: "team_JoB84CwfK3PnrbDP9qdHR47s",
  projectId: "prj_fBnJPu2XEFYf62EgYWU6EaAOxLmY",
  projectName: "scdesign-wirral",
  repoId: 1262205324,
  branch: "main",
});

export const HEALTH_URL = "https://scdesign-wirral.vercel.app/api/wvroofing/health";
export const NEON_URL = "https://vercel.com/marketplace/neon";
export const ADMIN_URLS = Object.freeze({
  v1: "https://scdesignwirral.co.uk/WVROOFING/admin/",
  v2: "https://scdesignwirral.co.uk/WVROOFING/2/admin/",
});
export const RESULT_LOG = "C:\\dev\\_wvroofing-src\\setup-result.log";

const TARGETS = ["production", "preview"];
const OTHER_DB_NAMES = ["DATABASE_URL", "POSTGRES_URL"];
const BLOB_NAMES = ["BLOB_STORE_ID", "BLOB_READ_WRITE_TOKEN"];
const BLOB_STORE = Object.freeze({ name: "wvroofing", access: "private", region: "lhr1" });
const MIN_PASSWORD = 12;
const DEPLOY_TIMEOUT_MS = 6 * 60 * 1000;
const POLL_MS = 5000;
const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/**
 * A planned stop with a short result code. Its message is always our own plain
 * words, never anything Vercel or the network sent back, so no secret can leak.
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
 * @typedef {{ status: number, data: any }} ApiReply
 * @typedef {(method: string, apiPath: string, body?: unknown) => Promise<ApiReply>} ApiRequest
 * @typedef {(token: string) => ApiRequest} ApiFactory
 * @typedef {object} Deps
 * @property {ApiFactory} [api]  makes a Vercel client for one token
 * @property {(question: string) => Promise<string>} [prompt]  an ordinary question
 * @property {(question: string) => Promise<string>} [hiddenPrompt]  a question whose answer doesn't show
 * @property {(url: string) => void} [openUrl]  opens a page in the browser
 * @property {(line: string) => void} [log]  one line of output
 * @property {(text: string) => void} [write]  output without a new line (progress dots)
 * @property {Record<string, string | undefined>} [env]  WVR_SETUP_RESULT_LOG moves the result log
 * @property {string[]} [argv]  --dry-run, --rotate
 * @property {() => Promise<any>} [health]  reads the live /health
 * @property {(ms: number) => Promise<void>} [sleep]
 * @property {() => number} [now]
 */

/**
 * The real Vercel REST API for one token. A network failure becomes a plain
 * "NETWORK" stop, so the token (and anything else) never reaches an error message.
 * @param {string} token
 * @returns {ApiRequest}
 */
export function vercelApi(token) {
  return async (method, apiPath, body) => {
    /** @type {Record<string, string>} */
    const headers = { Authorization: "Bearer " + token, Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let res;
    try {
      res = await fetch(VERCEL.api + apiPath, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
    } catch (err) {
      throw new Stop("NETWORK", "Couldn't reach Vercel (" + safeCode(err) + "). Check the internet or VPN, then run this again.");
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  };
}

/** The live /health, or null when it can't be read. */
async function fetchHealth() {
  try {
    const res = await fetch(HEALTH_URL, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * A short, safe label for an unexpected error: its code or class name, never its
 * message (which could quote a URL or a response).
 * @param {unknown} err
 */
function safeCode(err) {
  const e = /** @type {any} */ (err);
  const code = e && e.cause && typeof e.cause.code === "string" ? e.cause.code : e && typeof e.code === "string" ? e.code : e && e.name;
  return typeof code === "string" && /^[A-Za-z0-9_]{1,40}$/.test(code) ? code : "unknown";
}

/** @param {string[]} argv */
function parseFlags(argv) {
  return { dryRun: argv.includes("--dry-run"), rotate: argv.includes("--rotate") };
}

/** ?teamId=... for every project call. */
function team(extra = "") {
  return "?teamId=" + VERCEL.teamId + extra;
}

/**
 * The names of the project's variables that reach Production. Values are never
 * kept: only each entry's key and target are read.
 * @param {ApiRequest} request
 * @returns {Promise<Set<string>>}
 */
async function readNames(request) {
  const r = await request("GET", "/v10/projects/" + VERCEL.projectId + "/env" + team());
  if (r.status !== 200) throw new Stop("VERCEL_ERROR", "Couldn't read the project's settings (Vercel answered " + r.status + "). Try again in a minute.");
  const data = r.data;
  const list = Array.isArray(data) ? data : data && Array.isArray(data.envs) ? data.envs : [];
  /** @type {Set<string>} */
  const names = new Set();
  for (const e of list) {
    if (!e || typeof e.key !== "string") continue;
    const targets = Array.isArray(e.target) ? e.target : [e.target];
    if (targets.includes("production")) names.add(e.key);
  }
  return names;
}

/** @param {Set<string>} names */
function hasBlob(names) {
  return BLOB_NAMES.some((n) => names.has(n));
}

/** @param {Set<string>} names */
function smtpReady(names) {
  return names.has("SMTP_USER") && names.has("SMTP_PASS");
}

/**
 * Ask a yes/no question. Enter gives the default.
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
 * After a browser step: re-read the names until `ready` says yes, or he gives up.
 * @param {Required<Deps>} d
 * @param {ApiRequest} request
 * @param {(names: Set<string>) => boolean} ready
 * @returns {Promise<Set<string> | null>}
 */
async function waitUntil(d, request, ready) {
  for (let attempt = 0; attempt < 4; attempt++) {
    let names = await readNames(request);
    if (ready(names)) return names;
    // Vercel can take a few seconds to add a new connection's variables.
    await d.sleep(3000);
    names = await readNames(request);
    if (ready(names)) return names;
    if (attempt === 3) break;
    const a = (await d.prompt("  Not there yet. Press Enter to check again, or type q to stop: ")).trim().toLowerCase();
    if (a === "q") break;
  }
  return null;
}

/**
 * Step 3: WV Roofing's own Neon database.
 * @param {Required<Deps>} d
 * @param {ApiRequest} request
 * @param {Set<string>} names
 * @param {boolean} dry
 * @returns {Promise<{ names: Set<string>, ready: boolean }>}
 */
async function databaseStep(d, request, names, dry) {
  const { log } = d;
  log("");
  log("DATABASE (Neon)");
  if (names.has("WVR_DATABASE_URL")) {
    log("  Already connected (WVR_DATABASE_URL).");
    return { names, ready: true };
  }
  const other = OTHER_DB_NAMES.filter((n) => names.has(n));
  if (other.length) {
    log("  The project already has a database address called " + other.join(" and ") + ".");
    log("  It may be SC Design's. WV Roofing must have its own database, never SC Design's.");
    if (await yesNo(d, "  Is " + other[0] + " WV Roofing's own Neon database (called wvroofing)? (y/N) ", false)) {
      log("  OK, using it.");
      return { names, ready: true };
    }
    log("  Then WV Roofing gets its own, under its own name: WVR_DATABASE_URL.");
  }
  if (dry) {
    log("  DRY RUN: would open Neon's page and wait for you to connect it.");
    return { names, ready: false };
  }
  log("  Only you can accept Neon's terms, so this part is clicks. Opening " + NEON_URL);
  log("    1. Click Install (or Create Database if Neon is already installed).");
  log("       Choose the team that owns scdesign-wirral.");
  log("    2. If asked, choose Create New Neon Account and accept the terms.");
  log("    3. Region: Europe (London), aws-eu-west-2.  Plan: Free.");
  log("       Database name: wvroofing.  Click Create.");
  log("    4. On the new database, click Connect Project and choose scdesign-wirral.");
  log("       Environments: tick Production and Preview. Untick Development.");
  log("    5. Custom Prefix (under Advanced Options if it is folded away): WVR");
  log("       That names the address WVR_DATABASE_URL. Leave preview branching off.");
  log("    6. Click Connect, then come back to this window.");
  d.openUrl(NEON_URL);
  await d.prompt("  Press Enter here once Neon says it is connected to scdesign-wirral: ");
  const after = await waitUntil(d, request, (n) => n.has("WVR_DATABASE_URL") || (!other.length && OTHER_DB_NAMES.some((x) => n.has(x))));
  if (!after) {
    throw new Stop(
      "NEEDS_NEON",
      "I can't see WVR_DATABASE_URL on scdesign-wirral yet, so nothing else was changed. Connect Neon as above (Custom Prefix WVR), then run this again."
    );
  }
  log("  Connected.");
  return { names: after, ready: true };
}

/**
 * Step 4: the private photo store (Vercel Blob, London).
 * @param {Required<Deps>} d
 * @param {ApiRequest} request
 * @param {Set<string>} names
 * @param {boolean} dry
 * @param {string} storesUrl
 * @returns {Promise<{ names: Set<string>, ready: boolean }>}
 */
async function blobStep(d, request, names, dry, storesUrl) {
  const { log } = d;
  log("");
  log("PHOTO STORE (Vercel Blob)");
  if (hasBlob(names)) {
    log("  Already connected (" + BLOB_NAMES.filter((n) => names.has(n)).join(", ") + ").");
    // SC Design's code doesn't use Vercel Blob, so a store here should be WV Roofing's own.
    log("  It should be WV Roofing's own private store called wvroofing. If it isn't, press Ctrl+C now and tell Claude.");
    return { names, ready: true };
  }
  if (dry) {
    log("  DRY RUN: would make a private Blob store called wvroofing in London (lhr1) and connect it.");
    return { names, ready: false };
  }
  let made = false;
  if (await yesNo(d, "  Shall I make it now: private, in London, called wvroofing? Answer n if one called wvroofing already exists. (Y/n) ", true)) {
    const r = await request("POST", "/storage/stores/blob" + team(), { ...BLOB_STORE, projectId: VERCEL.projectId });
    const store = r.data && r.data.store;
    if ((r.status === 200 || r.status === 201) && store) {
      if ((store.access && store.access !== "private") || (store.region && store.region !== BLOB_STORE.region)) {
        throw new Stop(
          "BLOB_NOT_PRIVATE",
          "Vercel made the store, but not as asked (it should be Private, in London). Delete it in Vercel (Storage, wvroofing, Settings), then run this again."
        );
      }
      made = true;
      log("  Made the store: private, London.");
      await d.sleep(2000);
      const now = await readNames(request);
      if (hasBlob(now)) {
        log("  It is connected to scdesign-wirral.");
        return { names: now, ready: true };
      }
    } else {
      log("  Vercel didn't make it (answer " + r.status + "). You can make it in the dashboard instead.");
    }
  }
  log("  Opening " + storesUrl);
  if (!made) {
    log("    If there is no store called wvroofing yet: click Create, choose Blob, name it wvroofing,");
    log("    set access to Private and the region to London (lhr1), then click Create.");
  }
  log("    1. Open the wvroofing store, then its Projects tab, then Connect Project.");
  log("    2. Choose scdesign-wirral. Tick Production and Preview. Leave any prefix as it is.");
  log("    3. Click Connect, then come back to this window.");
  d.openUrl(storesUrl);
  await d.prompt("  Press Enter here once the store is connected to scdesign-wirral: ");
  const after = await waitUntil(d, request, hasBlob);
  if (!after) {
    throw new Stop("NEEDS_BLOB", "I can't see BLOB_STORE_ID on scdesign-wirral yet, so nothing else was changed. Connect the wvroofing store as above, then run this again.");
  }
  log("  Connected.");
  return { names: after, ready: true };
}

/**
 * The admin password, typed twice at hidden prompts; returns its scrypt hash.
 * @param {Required<Deps>} d
 */
async function askPassword(d) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const first = await d.hiddenPrompt("  Admin password: ");
    if (first.length < MIN_PASSWORD) {
      d.log("  That's shorter than " + MIN_PASSWORD + " characters. Please try again.");
      continue;
    }
    if (first === auth.TEST_OPERATOR_PASSWORD) {
      d.log("  That's the test environment's password. Please choose your own.");
      continue;
    }
    const second = await d.hiddenPrompt("  Type it again: ");
    if (first !== second) {
      d.log("  The two didn't match. Please try again.");
      continue;
    }
    const hash = auth.hashPassword(first);
    if (!(await auth.verifyPassword(first, hash))) throw new Stop("ERROR", "The password's hash didn't check out. Nothing was changed; please run this again.");
    return hash;
  }
  throw new Stop("PASSWORD_NOT_SET", "No password after three tries, so nothing was changed. Run this again when you're ready.");
}

/**
 * The inbox for enquiry emails ("" = skip).
 * @param {Required<Deps>} d
 * @param {boolean} already
 */
async function askEmail(d, already) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const a = (
      await d.prompt(already ? "  Type a new address to change it, or press Enter to keep it: " : "  Email enquiries to which address? (Enter to skip): ")
    ).trim();
    if (!a) return "";
    if (a.split(",").every((x) => EMAIL_RE.test(x.trim()))) return a.split(",").map((x) => x.trim()).join(",");
    d.log("  That doesn't look like an email address. Please try again (or press Enter to skip).");
  }
  return "";
}

/**
 * Print what the live /health says, in plain words.
 * @param {Required<Deps>} d
 * @param {any} h
 */
function reportHealth(d, h) {
  const { log } = d;
  const setup = h && typeof h.setup === "object" && h.setup ? h.setup : null;
  /** @type {[string, string][]} */
  const rows = [
    ["database", "Database (Neon)"],
    ["photoStore", "Photo store (Vercel Blob)"],
    ["sessionSecret", "Session secret"],
    ["cronSecret", "Daily tidy-up secret"],
    ["adminPassword", "Admin password"],
    ["enquiryEmail", "Enquiry emails to the roofer"],
  ];
  if (setup) {
    for (const [key, label] of rows) log("  " + (label + " ").padEnd(32, ".") + " " + (setup[key] === true ? "yes" : "not yet"));
  }
  const cap = h && h.capabilities && h.capabilities.enquiry_storage;
  const state = cap && typeof cap.state === "string" ? cap.state : "unknown";
  const reason = cap && typeof cap.reason === "string" ? cap.reason : "";
  log("  " + "Saving photos and enquiries ".padEnd(32, ".") + " " + (state === "enabled" ? "on" : "off (" + state + (reason ? ", " + reason : "") + ")"));
}

/**
 * The whole wizard. Returns the result code.
 * @param {Required<Deps>} d
 * @param {{ dryRun: boolean, rotate: boolean }} flags
 */
async function wizard(d, flags) {
  const { log } = d;
  const dry = flags.dryRun;
  log("");
  log("Connect the WV Roofing admin to its private store on Vercel.");
  log("  1. You paste a Vercel token. It is used for this run only and never saved.");
  log("  2. It reads which settings scdesign-wirral has (names only, never values).");
  log("  3. Neon, and maybe the photo store: it opens the page and says what to click.");
  log("  4. It makes the two secrets and asks you for the admin password (hidden).");
  log("  5. It saves the settings, redeploys the live site and checks it.");
  if (dry) log("DRY RUN: nothing will be changed. It only shows what it would do.");
  if (flags.rotate) log("--rotate: the session and cron secrets will be replaced with new ones.");
  log("");
  log("Make a token at https://vercel.com/account/tokens : Scope = the team that owns");
  log("scdesign-wirral, Expiration = 1 day. Paste it below (right-click pastes); it won't show.");
  const token = (await d.hiddenPrompt("Vercel token: ")).trim();
  if (!token) throw new Stop("NO_TOKEN", "Nothing pasted, so nothing was changed.");
  const request = d.api(token);

  // 1. The token, and the project.
  const user = await request("GET", "/v2/user");
  if (user.status === 401 || user.status === 403) {
    throw new Stop("TOKEN_REFUSED", "Vercel didn't accept that token. Check it was pasted in full, or make a new one, then run this again. Nothing was changed.");
  }
  if (user.status !== 200) throw new Stop("VERCEL_ERROR", "Vercel answered " + user.status + " when checking the token. Try again in a minute.");
  const u = user.data && user.data.user;
  const who = u && typeof u.username === "string" && /^[\w.-]{1,64}$/.test(u.username) ? u.username : "";
  log("Token accepted" + (who ? " (Vercel user " + who + ")." : "."));
  const project = await request("GET", "/v9/projects/" + VERCEL.projectId + team());
  if (project.status === 401 || project.status === 403 || project.status === 404) {
    throw new Stop(
      "NO_PROJECT_ACCESS",
      "That token can't see the project scdesign-wirral. Make a new token whose Scope is the team that owns scdesign-wirral, then run this again. Nothing was changed."
    );
  }
  if (project.status !== 200) throw new Stop("VERCEL_ERROR", "Vercel answered " + project.status + " when opening the project. Try again in a minute.");
  log("Project scdesign-wirral found.");
  // The team's short name, for links straight to its Storage page.
  let storesUrl = "https://vercel.com/dashboard";
  try {
    const t = await request("GET", "/v2/teams/" + VERCEL.teamId);
    const slug = t.status === 200 && t.data && t.data.slug;
    if (typeof slug === "string" && /^[a-z0-9-]{1,64}$/i.test(slug)) storesUrl = "https://vercel.com/" + slug + "/~/stores";
  } catch {
    // only the link is affected
  }

  // 2. What is there now (names only).
  let names = await readNames(request);
  const before = new Set(names);
  log("");
  log("What scdesign-wirral has now (Production):");
  /** @type {[string, boolean][]} */
  const now = [
    ["Database (Neon)", names.has("WVR_DATABASE_URL") || OTHER_DB_NAMES.some((n) => names.has(n))],
    ["Photo store (Vercel Blob)", hasBlob(names)],
    ["Session secret", names.has("WVR_SESSION_SECRET")],
    ["Daily tidy-up secret", names.has("CRON_SECRET")],
    ["Admin password", names.has("WVR_OPERATOR_PASSWORD_HASH")],
    ["Enquiry email inbox", names.has("WVR_LEAD_TO")],
  ];
  for (const [label, yes] of now) log("  " + (label + " ").padEnd(32, ".") + " " + (yes ? "yes" : "not yet"));

  // 3 and 4. Storage.
  const db = await databaseStep(d, request, names, dry);
  names = db.names;
  const blob = await blobStep(d, request, names, dry, storesUrl);
  names = blob.names;

  // 5. Secrets and the admin password.
  /** @type {{ key: string, value: string, note: string }[]} */
  const plan = [];
  log("");
  log("SECRETS");
  for (const [key, make] of /** @type {[string, () => string][]} */ ([
    ["WVR_SESSION_SECRET", () => crypto.randomBytes(32).toString("hex")],
    ["CRON_SECRET", () => crypto.randomBytes(32).toString("base64url")],
  ])) {
    if (!names.has(key)) plan.push({ key, value: make(), note: "new" });
    else if (flags.rotate) plan.push({ key, value: make(), note: "replaced (--rotate)" });
    else log("  " + key + " is already set; leaving it as it is.");
  }
  for (const p of plan) log("  " + p.key + ": made a new random one.");
  log("");
  log("ADMIN PASSWORD");
  let changePassword = true;
  if (names.has("WVR_OPERATOR_PASSWORD_HASH")) {
    changePassword = await yesNo(d, "  An admin password is already set. Change it? (y/N) ", false);
  } else {
    log("  Choose the admin password: at least " + MIN_PASSWORD + " characters; a few unrelated words work well.");
    log("  Nothing shows as you type. Only its scrypt hash is saved, never the password.");
  }
  if (changePassword) {
    if (names.has("WVR_OPERATOR_PASSWORD_HASH")) log("  Type the new one. Anyone logged in with the old one is logged out.");
    plan.push({ key: "WVR_OPERATOR_PASSWORD_HASH", value: await askPassword(d), note: names.has("WVR_OPERATOR_PASSWORD_HASH") ? "changed" : "new" });
  }

  // 6. Enquiry emails.
  log("");
  log("ENQUIRY EMAILS (optional)");
  const hadLead = names.has("WVR_LEAD_TO");
  log(hadLead ? "  Enquiry emails already go to the address set before." : "  Each enquiry is always saved for the admin screen. It can also be emailed to the roofer.");
  const email = await askEmail(d, hadLead);
  if (email) {
    plan.push({ key: "WVR_LEAD_TO", value: email, note: hadLead ? "changed" : "new" });
    plan.push({ key: "WVR_CAP_ENQUIRY_DELIVERY", value: "on", note: "switches enquiry emails on" });
  }
  if (email || hadLead) {
    log(
      smtpReady(names)
        ? "  Emails go out through the email login already on the project (SMTP_USER, SMTP_PASS)."
        : "  Emails only go out once SMTP_USER and SMTP_PASS are set on the project. They aren't there, and this doesn't ask for them."
    );
  }

  // 7. Save and redeploy.
  const connectedNow = [...names].some((n) => !before.has(n));
  log("");
  if (dry) {
    if (!db.ready) log("DRY RUN: would wait for Neon (WVR_DATABASE_URL) before saving anything.");
    if (!blob.ready) log("DRY RUN: would wait for the photo store (BLOB_STORE_ID) before saving anything.");
    if (plan.length) {
      log("DRY RUN: would save on scdesign-wirral (Production and Preview, encrypted):");
      for (const p of plan) log("  " + p.key + " (" + p.note + ")");
    } else {
      log("DRY RUN: no settings to save.");
    }
    const wouldDeploy = plan.length > 0 || connectedNow || !db.ready || !blob.ready;
    log(
      wouldDeploy
        ? "DRY RUN: would then redeploy the live site from GitHub main and wait until it is ready."
        : "DRY RUN: everything is in place, so it would ask whether to redeploy anyway."
    );
  } else {
    let deploy = true;
    if (plan.length) {
      log("Ready to save on scdesign-wirral (Production and Preview, encrypted). Names only:");
      for (const p of plan) log("  " + p.key + " (" + p.note + ")");
      if (!(await yesNo(d, "Save these and redeploy the live site now? (Y/n) ", true))) {
        throw new Stop("CANCELLED", "Nothing was saved.");
      }
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
    } else if (connectedNow) {
      log("Nothing to save, but the store connections are new, so the live site needs a redeploy.");
    } else {
      log("Everything was already in place.");
      // After a redeploy that failed or timed out, running this again should finish the job, so Enter = yes.
      deploy = await yesNo(d, "Redeploy the live site now? (Y/n) ", true);
    }
    if (deploy) await redeploy(d, request);
  }

  // 8. What the live site says.
  log("");
  log("The live site's set-up (" + HEALTH_URL + "):");
  const h = await d.health();
  if (!h) {
    log("  Couldn't read it. Open the address above in a browser in a minute.");
    printAdmin(d);
    return dry ? "DRY_RUN" : "HEALTH_UNREACHABLE";
  }
  // The redeploy builds GitHub main. If main doesn't have the admin pages yet (they
  // weren't pushed first), the live site's /health has no set-up checklist.
  if (!h.setup || typeof h.setup !== "object") {
    log("  The live site doesn't have the admin pages yet: GitHub main is older than this work.");
    log("  Run PUSH WV ROOFING on the Desktop first, then run this again (it only adds what's missing).");
    return dry ? "DRY_RUN" : "NEEDS_PUSH";
  }
  reportHealth(d, h);
  printAdmin(d);
  if (dry) return "DRY_RUN";
  const on = h.capabilities && h.capabilities.enquiry_storage && h.capabilities.enquiry_storage.state === "enabled";
  if (!on) {
    log("");
    log("Saving isn't on yet. The line above says why; tell Claude the result code below.");
    return "NOT_LIVE_YET";
  }
  log("");
  log("Done. Photos and enquiries from both versions are now saved for the admin screen.");
  return "OK";
}

/**
 * Redeploy production from GitHub main and wait until it's ready.
 * @param {Required<Deps>} d
 * @param {ApiRequest} request
 */
async function redeploy(d, request) {
  const { log } = d;
  const r = await request("POST", "/v13/deployments" + team("&forceNew=1"), {
    name: VERCEL.projectName,
    project: VERCEL.projectId,
    target: "production",
    gitSource: { type: "github", repoId: VERCEL.repoId, ref: VERCEL.branch },
  });
  const id = r.data && typeof r.data.id === "string" ? r.data.id : "";
  if ((r.status !== 200 && r.status !== 201) || !id) {
    throw new Stop(
      "DEPLOY_FAILED",
      "Vercel didn't start the redeploy (answer " + r.status + "). The settings are saved. In Vercel open scdesign-wirral, Deployments, the latest Production one, then Redeploy."
    );
  }
  log("");
  d.write("Redeploying the live site from GitHub main (usually 2 to 4 minutes) ");
  const start = d.now();
  let state = String(r.data.readyState || r.data.status || "QUEUED");
  while (!["READY", "ERROR", "CANCELED"].includes(state)) {
    if (d.now() - start > DEPLOY_TIMEOUT_MS) {
      d.write("\n");
      throw new Stop("DEPLOY_TIMEOUT", "The redeploy is taking longer than 6 minutes. It carries on by itself: check Vercel, Deployments, then run this again.");
    }
    await d.sleep(POLL_MS);
    d.write(".");
    const g = await request("GET", "/v13/deployments/" + encodeURIComponent(id) + team());
    if (g.status === 200 && g.data) state = String(g.data.readyState || g.data.status || state);
  }
  d.write("\n");
  if (state !== "READY") {
    throw new Stop("DEPLOY_FAILED", "The redeploy ended as " + state + ". The settings are saved. Vercel, Deployments shows why; then run this again.");
  }
  log("The live site is redeployed.");
}

/** @param {Required<Deps>} d */
function printAdmin(d) {
  d.log("");
  d.log("The admin screens (log in with the admin password):");
  d.log("  Version 1: " + ADMIN_URLS.v1);
  d.log("  Version 2: " + ADMIN_URLS.v2);
}

/**
 * Append the result code, with the time, to the result log. Nothing else ever goes in it.
 * @param {Required<Deps>} d
 * @param {string} code
 */
function writeResult(d, code) {
  const file = d.env.WVR_SETUP_RESULT_LOG || RESULT_LOG;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, new Date(d.now()).toISOString() + " RESULT=" + code + "\r\n");
  } catch {
    d.log("(Couldn't write the result log; the code is " + code + ".)");
  }
}

/**
 * Run the wizard. Every outside thing comes in through `deps`, with the real
 * terminal, browser and Vercel as defaults. Returns the result code.
 * @param {Deps} [deps]
 */
export async function run(deps = {}) {
  /** @type {Required<Deps>} */
  const d = {
    api: deps.api || vercelApi,
    prompt: deps.prompt || question,
    hiddenPrompt: deps.hiddenPrompt || hidden,
    openUrl: deps.openUrl || openInBrowser,
    log: deps.log || ((line) => console.log(line)),
    write: deps.write || ((text) => process.stdout.write(text)),
    env: deps.env || process.env,
    argv: deps.argv || [],
    health: deps.health || fetchHealth,
    sleep: deps.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    now: deps.now || Date.now,
  };
  let code;
  try {
    code = await wizard(d, parseFlags(d.argv));
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
      d.log('Tell Claude "set-up stopped" and the result code below.');
    }
  }
  writeResult(d, code);
  d.log("");
  d.log("Result code: " + code);
  return code;
}

// ---------------------------------------------------------------------------
// The real terminal and browser (not used by the tests).

/**
 * An ordinary question on the terminal.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
function question(prompt) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let answered = false;
    rl.on("SIGINT", () => {
      rl.close();
    });
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

/**
 * Read a line from the terminal without showing it (as operator-hash.mjs does).
 * @param {string} prompt
 * @returns {Promise<string>}
 */
function hidden(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY) {
      reject(new Stop("NO_TERMINAL", "Run this in a terminal window (double-click the Desktop file), so the token and password can be typed without showing."));
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

/**
 * Open a Vercel page in the default browser, without a shell.
 * @param {string} url
 */
function openInBrowser(url) {
  if (!/^https:\/\/vercel\.com\/[A-Za-z0-9/_~.-]*$/.test(url)) return;
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
