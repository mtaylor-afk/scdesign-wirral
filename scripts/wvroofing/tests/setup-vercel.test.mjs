// The owner's set-up wizard (scripts/wvroofing/setup-vercel.mjs), driven with a fake
// Vercel and scripted answers. It never talks to the real Vercel, and checks that no
// token, password, hash or secret ever reaches the screen or the result log.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { load } from "./helpers.mjs";
import { run, VERCEL, NEON_URL, ADMIN_URLS } from "../setup-vercel.mjs";

const auth = load("serverlib/wvroofing/auth.js");

const TOKEN = "vcp_FAKE_token_for_tests_0123456789abcdef";
const PASSWORD = "copper ridge lantern quietly";
const EMAIL = "roofer@example.com";
const EVERYTHING = ["WVR_DATABASE_URL", "BLOB_STORE_ID", "WVR_SESSION_SECRET", "CRON_SECRET", "WVR_OPERATOR_PASSWORD_HASH", "WVR_LEAD_TO", "SMTP_USER", "SMTP_PASS"];
const HEALTHY = {
  ok: true,
  setup: { database: true, photoStore: true, sessionSecret: true, cronSecret: true, adminPassword: true, enquiryEmail: true },
  capabilities: { enquiry_storage: { state: "enabled", reason: "ok" } },
};

/**
 * A pretend Vercel: just enough of the REST API, recording every call.
 * @param {{ names?: string[], status?: number, blobConnects?: boolean, deployStates?: string[] }} [o]
 */
function fakeVercel(o = {}) {
  const names = new Set(o.names || []);
  const calls = [];
  const writes = [];
  const states = (o.deployStates || ["BUILDING", "READY"]).slice();
  const team = "?teamId=" + VERCEL.teamId;
  const projectEnv = "/v10/projects/" + VERCEL.projectId + "/env";
  const request = async (method, apiPath, body) => {
    calls.push({ method, path: apiPath, body });
    if (o.status) return { status: o.status, data: { error: { code: "forbidden", message: "Not authorized" } } };
    const key = method + " " + apiPath;
    if (key === "GET /v2/user") return { status: 200, data: { user: { username: "matthew" } } };
    if (key === "GET /v9/projects/" + VERCEL.projectId + team) return { status: 200, data: { id: VERCEL.projectId, name: VERCEL.projectName } };
    if (key === "GET /v2/teams/" + VERCEL.teamId) return { status: 200, data: { slug: "mtaylor-team" } };
    if (key === "GET " + projectEnv + team) {
      // Values come back from the real API too; the wizard must ignore them.
      return { status: 200, data: { envs: [...names].map((k) => ({ key: k, target: ["production", "preview"], type: "encrypted", value: "ENCRYPTED-" + k })) } };
    }
    if (key === "POST " + projectEnv + team + "&upsert=true") {
      writes.push(body);
      names.add(body.key);
      return { status: 201, data: { created: { key: body.key }, failed: [] } };
    }
    if (key === "POST /storage/stores/blob" + team) {
      if (o.blobConnects !== false) names.add("BLOB_STORE_ID");
      return { status: 200, data: { store: { id: "store_fake", access: body.access, region: body.region, status: "available", projectsMetadata: [] } } };
    }
    if (key === "POST /v13/deployments" + team + "&forceNew=1") return { status: 200, data: { id: "dpl_fake", readyState: "QUEUED" } };
    if (key === "GET /v13/deployments/dpl_fake" + team) return { status: 200, data: { id: "dpl_fake", readyState: states.length > 1 ? states.shift() : states[0] } };
    return { status: 404, data: { error: { code: "not_found" } } };
  };
  const tokens = [];
  return {
    names,
    calls,
    writes,
    tokens,
    api: (token) => {
      tokens.push(token);
      return request;
    },
    posts: () => calls.filter((c) => c.method !== "GET"),
  };
}

/**
 * Answers in order; each must match the question it answers, so an unexpected
 * question fails the test instead of being answered blindly.
 * @param {[RegExp, string][]} script
 */
function answers(script) {
  const queue = script.slice();
  const asked = [];
  const fn = async (q) => {
    asked.push(q);
    const next = queue.shift();
    assert.ok(next, "unexpected question: " + q);
    assert.match(q, next[0]);
    return next[1];
  };
  fn.asked = asked;
  fn.left = () => queue.length;
  return fn;
}

/** Everything the wizard needs, faked. */
function harness(fake, { prompts = [], hidden = [], argv = [], health = HEALTHY, onOpen } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wvr-setup-"));
  const logFile = path.join(dir, "setup-result.log");
  const lines = [];
  const opened = [];
  let clock = 1_800_000_000_000;
  const prompt = answers(prompts);
  const hiddenPrompt = answers(hidden);
  return {
    lines,
    opened,
    logFile,
    prompt,
    hiddenPrompt,
    deps: {
      api: fake.api,
      prompt,
      hiddenPrompt,
      openUrl: (url) => {
        opened.push(url);
        if (onOpen) onOpen(url, fake);
      },
      log: (line) => lines.push(String(line)),
      write: (text) => lines.push(String(text)),
      env: { WVR_SETUP_RESULT_LOG: logFile },
      argv,
      health: async () => health,
      sleep: async (ms) => {
        clock += ms;
      },
      now: () => clock,
    },
  };
}

/** Nothing secret may appear on screen, in the questions or in the result log. */
function assertNoSecrets(h, secrets) {
  const screen = h.lines.join("\n") + "\n" + h.prompt.asked.join("\n") + "\n" + h.hiddenPrompt.asked.join("\n");
  const log = fs.existsSync(h.logFile) ? fs.readFileSync(h.logFile, "utf8") : "";
  for (const s of secrets.filter(Boolean)) {
    assert.ok(!screen.includes(s), "a secret value reached the screen");
    assert.ok(!log.includes(s), "a secret value reached the result log");
    // Not even a recognisable piece of it.
    if (s.length >= 24) assert.ok(!screen.includes(s.slice(-16)) && !log.includes(s.slice(-16)), "part of a secret value reached the output");
  }
}

function resultLine(h) {
  const text = fs.readFileSync(h.logFile, "utf8");
  const lines = text.split("\r\n").filter(Boolean);
  assert.equal(lines.length, 1, "one line per run");
  assert.match(lines[0], /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z RESULT=[A-Z_]+$/);
  return lines[0].split("RESULT=")[1];
}

test("(i) nothing set: connects storage, makes the secrets, saves them encrypted, redeploys, OK", async () => {
  const fake = fakeVercel();
  const h = harness(fake, {
    hidden: [
      [/Vercel token/, TOKEN],
      [/Admin password/, PASSWORD],
      [/again/, PASSWORD],
    ],
    prompts: [
      [/Neon says it is connected/, ""],
      [/make it now: private, in London/, ""],
      [/Email enquiries to which address/, EMAIL],
      [/Save these and redeploy/, "y"],
    ],
    // Matthew's clicks on the Neon page connect the database with the WVR prefix.
    onOpen: (url, f) => {
      if (url === NEON_URL) f.names.add("WVR_DATABASE_URL");
    },
  });
  const code = await run(h.deps);
  assert.equal(code, "OK", h.lines.join("\n"));
  assert.equal(h.prompt.left(), 0);
  assert.equal(h.hiddenPrompt.left(), 0);
  assert.deepEqual(fake.tokens, [TOKEN]);
  assert.deepEqual(h.opened, [NEON_URL]);

  // The Blob store: private, London, for this project only.
  const blob = fake.calls.find((c) => c.path.startsWith("/storage/stores/blob"));
  assert.deepEqual(blob.body, { name: "wvroofing", access: "private", region: "lhr1", projectId: VERCEL.projectId });

  // Exactly the expected variables, encrypted, for Production and Preview.
  const byKey = Object.fromEntries(fake.writes.map((w) => [w.key, w]));
  assert.deepEqual(Object.keys(byKey).sort(), ["CRON_SECRET", "WVR_CAP_ENQUIRY_DELIVERY", "WVR_LEAD_TO", "WVR_OPERATOR_PASSWORD_HASH", "WVR_SESSION_SECRET"]);
  for (const w of fake.writes) {
    assert.equal(w.type, "encrypted");
    assert.deepEqual(w.target, ["production", "preview"]);
  }
  assert.match(byKey.WVR_SESSION_SECRET.value, /^[0-9a-f]{64}$/);
  assert.match(byKey.CRON_SECRET.value, /^[A-Za-z0-9_-]{43}$/);
  assert.match(byKey.WVR_OPERATOR_PASSWORD_HASH.value, /^scrypt:16384:8:1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
  assert.equal(await auth.verifyPassword(PASSWORD, byKey.WVR_OPERATOR_PASSWORD_HASH.value), true);
  assert.equal(byKey.WVR_LEAD_TO.value, EMAIL);
  assert.equal(byKey.WVR_CAP_ENQUIRY_DELIVERY.value, "on");

  // The redeploy: production, from GitHub main, then polled until READY.
  const dep = fake.calls.find((c) => c.method === "POST" && c.path.startsWith("/v13/deployments"));
  assert.deepEqual(dep.body, {
    name: "scdesign-wirral",
    project: VERCEL.projectId,
    target: "production",
    gitSource: { type: "github", repoId: 1262205324, ref: "main" },
  });
  assert.ok(fake.calls.some((c) => c.method === "GET" && c.path.startsWith("/v13/deployments/dpl_fake")));
  // Settings are saved before the redeploy that picks them up.
  const lastWrite = fake.calls.findLastIndex((c) => c.path.includes("/env?") && c.method === "POST");
  assert.ok(lastWrite < fake.calls.indexOf(dep));

  const screen = h.lines.join("\n");
  assert.ok(screen.includes(ADMIN_URLS.v1) && screen.includes(ADMIN_URLS.v2));
  assert.match(screen, /Saving photos and enquiries \.+ on/);
  assertNoSecrets(h, [TOKEN, PASSWORD, EMAIL, ...fake.writes.map((w) => (w.value === "on" ? "" : w.value))]);
  assert.equal(resultLine(h), "OK");
});

test("(ii) everything already set: no secret is replaced and nothing is written or redeployed", async () => {
  const fake = fakeVercel({ names: EVERYTHING });
  const h = harness(fake, {
    hidden: [[/Vercel token/, TOKEN]],
    prompts: [
      [/already set\. Change it\?/, "n"],
      [/Type a new address to change it/, ""],
      [/Redeploy the live site now\? \(Y\/n\)/, "n"],
    ],
  });
  const code = await run(h.deps);
  assert.equal(code, "OK", h.lines.join("\n"));
  assert.deepEqual(fake.posts(), [], "no writes, no store, no redeploy");
  assert.deepEqual(h.opened, []);
  assert.match(h.lines.join("\n"), /WVR_SESSION_SECRET is already set/);
  assertNoSecrets(h, [TOKEN]);
  assert.equal(resultLine(h), "OK");
});

test("a run after a failed redeploy redeploys when Enter is pressed", async () => {
  const fake = fakeVercel({ names: EVERYTHING });
  const h = harness(fake, {
    hidden: [[/Vercel token/, TOKEN]],
    prompts: [
      [/already set\. Change it\?/, ""],
      [/Type a new address to change it/, ""],
      [/Redeploy the live site now\? \(Y\/n\)/, ""],
    ],
  });
  assert.equal(await run(h.deps), "OK", h.lines.join("\n"));
  assert.ok(fake.calls.some((c) => c.method === "POST" && c.path.startsWith("/v13/deployments")), "redeployed");
});

test("GitHub main without the admin pages (not pushed yet): NEEDS_PUSH, never OK", async () => {
  const fake = fakeVercel({ names: EVERYTHING });
  const h = harness(fake, {
    hidden: [[/Vercel token/, TOKEN]],
    prompts: [
      [/already set\. Change it\?/, ""],
      [/Type a new address to change it/, ""],
      [/Redeploy the live site now\?/, ""],
    ],
    // An older live site: its /health has no set-up checklist.
    health: { ok: true, capabilities: { enquiry_storage: { state: "enabled", reason: "ok" } } },
  });
  assert.equal(await run(h.deps), "NEEDS_PUSH");
  const screen = h.lines.join("\n");
  assert.match(screen, /PUSH WV ROOFING/);
  assert.ok(!screen.includes(ADMIN_URLS.v1), "doesn't point at admin pages that aren't there yet");
  assert.equal(resultLine(h), "NEEDS_PUSH");
});

test("(ii) everything already set, but a new admin password: only its hash is written", async () => {
  const fake = fakeVercel({ names: EVERYTHING });
  const h = harness(fake, {
    hidden: [
      [/Vercel token/, TOKEN],
      [/Admin password/, "short"],
      [/Admin password/, PASSWORD],
      [/again/, PASSWORD],
    ],
    prompts: [
      [/already set\. Change it\?/, "y"],
      [/Type a new address to change it/, ""],
      [/Save these and redeploy/, ""],
    ],
  });
  const code = await run(h.deps);
  assert.equal(code, "OK", h.lines.join("\n"));
  assert.deepEqual(
    fake.writes.map((w) => w.key),
    ["WVR_OPERATOR_PASSWORD_HASH"]
  );
  assert.match(h.lines.join("\n"), /shorter than 12 characters/);
  assert.ok(fake.calls.some((c) => c.method === "POST" && c.path.startsWith("/v13/deployments")));
  assertNoSecrets(h, [TOKEN, PASSWORD, fake.writes[0].value]);
});

test("(ii) --rotate replaces both secrets even when they exist", async () => {
  const fake = fakeVercel({ names: EVERYTHING });
  const h = harness(fake, {
    argv: ["--rotate"],
    hidden: [[/Vercel token/, TOKEN]],
    prompts: [
      [/already set\. Change it\?/, ""],
      [/Type a new address to change it/, ""],
      [/Save these and redeploy/, "y"],
    ],
  });
  assert.equal(await run(h.deps), "OK");
  assert.deepEqual(fake.writes.map((w) => w.key).sort(), ["CRON_SECRET", "WVR_SESSION_SECRET"]);
  assertNoSecrets(h, [TOKEN, ...fake.writes.map((w) => w.value)]);
});

test("(iii) a refused token (403): TOKEN_REFUSED, no writes, nothing else asked", async () => {
  const fake = fakeVercel({ status: 403 });
  const h = harness(fake, { hidden: [[/Vercel token/, TOKEN]] });
  const code = await run(h.deps);
  assert.equal(code, "TOKEN_REFUSED");
  assert.deepEqual(fake.posts(), []);
  assert.equal(fake.calls.length, 1, "stops at the first check");
  assert.deepEqual(h.opened, []);
  assert.match(h.lines.join("\n"), /didn't accept that token/);
  assertNoSecrets(h, [TOKEN]);
  assert.equal(resultLine(h), "TOKEN_REFUSED");
});

test("(iv) --dry-run: asks the same questions but writes nothing, opens nothing and doesn't redeploy", async () => {
  const fake = fakeVercel();
  const h = harness(fake, {
    argv: ["--dry-run"],
    hidden: [
      [/Vercel token/, TOKEN],
      [/Admin password/, PASSWORD],
      [/again/, PASSWORD],
    ],
    prompts: [[/Email enquiries to which address/, EMAIL]],
  });
  const code = await run(h.deps);
  assert.equal(code, "DRY_RUN", h.lines.join("\n"));
  assert.deepEqual(fake.posts(), [], "no writes, no store, no redeploy");
  assert.deepEqual(h.opened, []);
  const screen = h.lines.join("\n");
  for (const key of ["WVR_SESSION_SECRET", "CRON_SECRET", "WVR_OPERATOR_PASSWORD_HASH", "WVR_LEAD_TO", "WVR_CAP_ENQUIRY_DELIVERY"]) {
    assert.ok(screen.includes("  " + key + " ("), "lists " + key);
  }
  assert.match(screen, /would make a private Blob store called wvroofing in London/);
  assert.match(screen, /would then redeploy/);
  assertNoSecrets(h, [TOKEN, PASSWORD, EMAIL]);
  assert.equal(resultLine(h), "DRY_RUN");
});

test("SC Design's database address is never taken for WV Roofing's: NEEDS_NEON and nothing written", async () => {
  const fake = fakeVercel({ names: ["POSTGRES_URL", "SMTP_USER", "SMTP_PASS"] });
  const h = harness(fake, {
    hidden: [[/Vercel token/, TOKEN]],
    prompts: [
      [/Is POSTGRES_URL WV Roofing's own Neon database/, ""],
      [/Neon says it is connected/, ""],
      [/Not there yet/, ""],
      [/Not there yet/, "q"],
    ],
  });
  const code = await run(h.deps);
  assert.equal(code, "NEEDS_NEON");
  assert.deepEqual(h.opened, [NEON_URL]);
  assert.deepEqual(fake.posts(), []);
  assert.match(h.lines.join("\n"), /never SC Design's/);
  assert.equal(resultLine(h), "NEEDS_NEON");
});

test("a new Blob store that isn't connected by itself: opens the Storage page, then carries on", async () => {
  const fake = fakeVercel({ names: ["WVR_DATABASE_URL", "WVR_SESSION_SECRET", "CRON_SECRET", "WVR_OPERATOR_PASSWORD_HASH"], blobConnects: false });
  const h = harness(fake, {
    hidden: [[/Vercel token/, TOKEN]],
    prompts: [
      [/make it now: private, in London/, "y"],
      [/store is connected to scdesign-wirral/, ""],
      [/already set\. Change it\?/, ""],
      [/Email enquiries to which address/, ""],
    ],
    onOpen: (url, f) => {
      if (url.includes("/~/stores")) f.names.add("BLOB_STORE_ID");
    },
  });
  const code = await run(h.deps);
  assert.equal(code, "OK", h.lines.join("\n"));
  assert.deepEqual(h.opened, ["https://vercel.com/mtaylor-team/~/stores"]);
  assert.deepEqual(fake.writes, [], "nothing to save");
  // The connection is new, so the live site is redeployed to pick it up.
  assert.ok(fake.calls.some((c) => c.method === "POST" && c.path.startsWith("/v13/deployments")));
});

test("a failed redeploy is reported as DEPLOY_FAILED", async () => {
  const fake = fakeVercel({ names: EVERYTHING.filter((n) => n !== "CRON_SECRET"), deployStates: ["BUILDING", "ERROR"] });
  const h = harness(fake, {
    hidden: [[/Vercel token/, TOKEN]],
    prompts: [
      [/already set\. Change it\?/, "n"],
      [/Type a new address to change it/, ""],
      [/Save these and redeploy/, "y"],
    ],
  });
  assert.equal(await run(h.deps), "DEPLOY_FAILED");
  assert.deepEqual(
    fake.writes.map((w) => w.key),
    ["CRON_SECRET"]
  );
  assertNoSecrets(h, [TOKEN, fake.writes[0].value]);
});
