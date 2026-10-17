// The Projects CMS set-up wizard (scripts/setup-projects-cms.mjs), driven with fake
// Vercel, GitHub and Supabase and scripted answers. It never talks to the real
// services, and checks that no token, key or password ever reaches the screen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { run, VERCEL, GITHUB, SUPABASE, GITHUB_TOKEN_URL } from "../setup-projects-cms.mjs";

const VTOKEN = "vcp_FAKE_vercel_token_0123456789";
const GTOKEN = "github_pat_FAKE_publishing_token_0123456789";
const STOKEN = "sbp_FAKE_supabase_token_0123456789";
const PASSWORD = "copper ridge lantern quietly";
const ALL = ["SC_SUPABASE_URL", "SC_SUPABASE_SERVICE_ROLE_KEY", "SC_ADMIN_SESSION_SECRET", "SC_ADMIN_USER", "SC_ADMIN_PASS", "SC_GITHUB_TOKEN", "SC_GITHUB_REPO", "SC_GITHUB_BRANCH"];
const SECRETS = [VTOKEN, GTOKEN, STOKEN, PASSWORD];

/** @param {{ names?: string[], protection?: boolean }} [o] */
function fakeVercel(o = {}) {
  const names = new Set(o.names || []);
  const writes = [];
  const deploys = [];
  const team = "?teamId=" + VERCEL.teamId;
  const env = "/v10/projects/" + VERCEL.projectId + "/env";
  const factory = (token) => async (method, p, body) => {
    if (token !== VTOKEN) return { status: 403, data: null };
    const key = method + " " + p;
    if (key === "GET /v2/user") return { status: 200, data: { user: { username: "matthew" } } };
    if (key === "GET /v9/projects/" + VERCEL.projectId + team) return { status: 200, data: { id: VERCEL.projectId, ssoProtection: o.protection ? { deploymentType: "all" } : null } };
    if (key === "GET " + env + team) return { status: 200, data: { envs: [...names].map((k) => ({ key: k, target: ["production"], value: "ENC-" + k })) } };
    if (key === "POST " + env + team + "&upsert=true") {
      writes.push(body);
      names.add(body.key);
      return { status: 201, data: { failed: [] } };
    }
    if (key === "POST /v13/deployments" + team + "&forceNew=1") {
      deploys.push(body);
      return { status: 200, data: { id: "dpl_1", readyState: "QUEUED" } };
    }
    if (key === "GET /v13/deployments/dpl_1" + team) return { status: 200, data: { readyState: "READY" } };
    return { status: 404, data: null };
  };
  return { factory, writes, deploys };
}

/** @param {{ canWrite?: boolean, seesOther?: boolean }} [o] */
function fakeGithub(o = {}) {
  const blobs = [];
  const factory = (token) => async (method, p, body) => {
    if (token !== GTOKEN) return { status: 401, data: null };
    const repo = "/repos/" + GITHUB.owner + "/" + GITHUB.repo;
    if (method === "GET" && p === repo) return { status: 200, data: {}, headers: { expiry: "2027-10-18 00:00:00 UTC" } };
    if (method === "POST" && p === repo + "/git/blobs") {
      blobs.push(body);
      return o.canWrite === false ? { status: 403, data: null } : { status: 201, data: { sha: "abc" } };
    }
    if (method === "GET" && p === "/repos/mtaylor-afk/QCbuild1") return { status: o.seesOther ? 200 : 404, data: null };
    return { status: 404, data: null };
  };
  return { factory, blobs };
}

/** @param {{ present?: boolean }} [o] */
function fakeSupabase(o = {}) {
  let present = !!o.present;
  const ran = [];
  const factory = (token) => async (method, p, body) => {
    if (token !== STOKEN) return { status: 401, data: null };
    if (method !== "POST" || p !== "/v1/projects/" + SUPABASE.defaultRef + "/database/query") return { status: 404, data: null };
    if (/to_regclass/.test(body.query)) return { status: 201, data: [{ projects: present, events: present, bucket: present }] };
    ran.push(body.query);
    present = true;
    return { status: 201, data: [] };
  };
  return { factory, ran };
}

/**
 * Answers are consumed in order; each is matched loosely to its question so a
 * reordering fails loudly rather than answering the wrong thing.
 * @param {[RegExp, string][]} script
 */
function answers(script) {
  const asked = [];
  const next = async (q) => {
    asked.push(q);
    const a = script.shift();
    assert.ok(a, "unexpected question: " + q);
    assert.match(q, a[0]);
    return a[1];
  };
  return { next, asked, left: () => script.length };
}

function harness(o) {
  const lines = [];
  const opened = [];
  const a = answers(o.script);
  const deps = {
    vercel: o.vercel.factory,
    github: o.github.factory,
    supabase: o.supabase.factory,
    prompt: a.next,
    hiddenPrompt: a.next,
    openUrl: (u) => opened.push(u),
    log: (l) => lines.push(l),
    write: (t) => lines.push(t),
    readSql: () => "create table if not exists public.sc_projects ();",
    sleep: async () => {},
    now: () => 0,
    argv: o.argv || [],
  };
  return { deps, lines, opened, answers: a };
}

function assertNoSecrets(lines) {
  const out = lines.join("\n");
  for (const s of SECRETS) assert.ok(!out.includes(s), "a secret reached the screen");
}

test("fresh project: saves every setting, creates the tables, redeploys", async () => {
  const vercel = fakeVercel({ names: ["SC_SUPABASE_URL", "SC_SUPABASE_SERVICE_ROLE_KEY"] });
  const github = fakeGithub();
  const supabase = fakeSupabase();
  const h = harness({
    vercel,
    github,
    supabase,
    script: [
      [/Vercel token/, VTOKEN],
      [/username/, ""],
      [/New admin password/, PASSWORD],
      [/again/, PASSWORD],
      [/Supabase access token/, STOKEN],
      [/github_pat_/, GTOKEN],
      [/Save these/, ""],
    ],
  });
  assert.equal(await run(h.deps), "OK");
  const saved = Object.fromEntries(vercel.writes.map((w) => [w.key, w.value]));
  assert.deepEqual(Object.keys(saved).sort(), ["SC_ADMIN_PASS", "SC_ADMIN_SESSION_SECRET", "SC_ADMIN_USER", "SC_GITHUB_BRANCH", "SC_GITHUB_REPO", "SC_GITHUB_TOKEN"]);
  assert.equal(saved.SC_ADMIN_USER, "sean");
  assert.equal(saved.SC_ADMIN_PASS, PASSWORD);
  assert.equal(saved.SC_GITHUB_TOKEN, GTOKEN);
  assert.equal(saved.SC_GITHUB_REPO, "mtaylor-afk/scdesign-wirral");
  assert.ok(saved.SC_ADMIN_SESSION_SECRET.length >= 48);
  for (const w of vercel.writes) assert.equal(w.type, "encrypted");
  assert.equal(supabase.ran.length, 1);
  assert.equal(github.blobs.length, 1);
  assert.equal(vercel.deploys.length, 1);
  assert.deepEqual(h.opened, [GITHUB_TOKEN_URL]);
  assert.equal(h.answers.left(), 0);
  assertNoSecrets(h.lines);
});

test("already set up: nothing saved, SQL not re-run, no redeploy", async () => {
  const vercel = fakeVercel({ names: ALL });
  const supabase = fakeSupabase({ present: true });
  const h = harness({
    vercel,
    github: fakeGithub(),
    supabase,
    script: [
      [/Vercel token/, VTOKEN],
      [/new admin password/, ""],
      [/Supabase access token/, STOKEN],
      [/Replace it/, ""],
      [/Redeploy/, ""],
    ],
  });
  assert.equal(await run(h.deps), "OK");
  assert.equal(vercel.writes.length, 0);
  assert.equal(supabase.ran.length, 0);
  assert.equal(vercel.deploys.length, 0);
  assert.ok(h.lines.some((l) => /already there/.test(l)));
});

test("a read-only GitHub token is refused and nothing is saved", async () => {
  const vercel = fakeVercel({ names: ALL.filter((n) => !n.startsWith("SC_GITHUB")) });
  const h = harness({
    vercel,
    github: fakeGithub({ canWrite: false }),
    supabase: fakeSupabase({ present: true }),
    script: [
      [/Vercel token/, VTOKEN],
      [/new admin password/, "n"],
      [/Supabase access token/, STOKEN],
      [/github_pat_/, GTOKEN],
    ],
  });
  assert.equal(await run(h.deps), "GITHUB_NO_WRITE");
  assert.equal(vercel.writes.length, 0);
  assertNoSecrets(h.lines);
});

test("a token that can see other repos still works, with a note", async () => {
  const vercel = fakeVercel({ names: ALL.filter((n) => n !== "SC_GITHUB_TOKEN") });
  const h = harness({
    vercel,
    github: fakeGithub({ seesOther: true }),
    supabase: fakeSupabase({ present: true }),
    script: [
      [/Vercel token/, VTOKEN],
      [/new admin password/, ""],
      [/Supabase access token/, STOKEN],
      [/github_pat_/, GTOKEN],
      [/Save these/, "y"],
    ],
  });
  assert.equal(await run(h.deps), "OK");
  assert.ok(h.lines.some((l) => /also see mtaylor-afk\/QCbuild1/.test(l)));
  assert.deepEqual(vercel.writes.map((w) => w.key), ["SC_GITHUB_TOKEN"]);
});

test("no Supabase token: opens the SQL editor and waits", async () => {
  const supabase = fakeSupabase();
  const h = harness({
    vercel: fakeVercel({ names: ALL }),
    github: fakeGithub(),
    supabase,
    script: [
      [/Vercel token/, VTOKEN],
      [/new admin password/, ""],
      [/Supabase access token/, ""],
      [/Success/, ""],
      [/Replace it/, ""],
      [/Redeploy/, "n"],
    ],
  });
  assert.equal(await run(h.deps), "OK");
  assert.equal(supabase.ran.length, 0);
  assert.deepEqual(h.opened, ["https://supabase.com/dashboard/project/" + SUPABASE.defaultRef + "/sql/new"]);
});

test("dry run writes nothing anywhere", async () => {
  const vercel = fakeVercel({ names: ["SC_SUPABASE_URL", "SC_SUPABASE_SERVICE_ROLE_KEY"] });
  const github = fakeGithub();
  const supabase = fakeSupabase();
  const h = harness({
    vercel,
    github,
    supabase,
    argv: ["--dry-run"],
    script: [
      [/Vercel token/, VTOKEN],
      [/username/, "sean"],
      [/New admin password/, PASSWORD],
      [/again/, PASSWORD],
      [/Supabase access token/, STOKEN],
      [/github_pat_/, GTOKEN],
    ],
  });
  assert.equal(await run(h.deps), "DRY_RUN");
  assert.equal(vercel.writes.length, 0);
  assert.equal(vercel.deploys.length, 0);
  assert.equal(supabase.ran.length, 0);
  assert.equal(github.blobs.length, 0);
  assertNoSecrets(h.lines);
});

test("deployment protection is reported, not changed", async () => {
  const h = harness({
    vercel: fakeVercel({ names: ALL, protection: true }),
    github: fakeGithub(),
    supabase: fakeSupabase({ present: true }),
    script: [
      [/Vercel token/, VTOKEN],
      [/new admin password/, ""],
      [/Supabase access token/, STOKEN],
      [/Replace it/, ""],
      [/Redeploy/, "n"],
    ],
  });
  assert.equal(await run(h.deps), "OK");
  assert.ok(h.lines.some((l) => /Deployment Protection is ON/.test(l)));
});

test("a wrong Vercel token stops before anything else", async () => {
  const h = harness({
    vercel: fakeVercel(),
    github: fakeGithub(),
    supabase: fakeSupabase(),
    script: [[/Vercel token/, "vcp_wrong"]],
  });
  assert.equal(await run(h.deps), "TOKEN_REFUSED");
});
