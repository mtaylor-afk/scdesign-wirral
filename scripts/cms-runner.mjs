// The cms-publish workflow's one step: hand the admin API a short-lived GitHub
// token so Sean's queued publishes reach the website. Runs inside GitHub Actions
// only (.github/workflows/cms-publish.yml) — never on a computer.
//
// 1. Ask GitHub for an OIDC token (audience "scdesign-cms"). It proves to the API
//    that this call is the cms-publish workflow on main (serverlib/gh-oidc.js).
// 2. POST action "run-queue" with the job's own GITHUB_TOKEN. The API runs one
//    queued action and says how many are left; repeat until none are.
//
// Output lines starting "::" become notes on the workflow run, so a failed
// publish is visible on GitHub as well as in the admin.

const API = process.env.SC_CMS_API || "https://scdesign-wirral.vercel.app/api/sc-admin-publish";
const AUDIENCE = "scdesign-cms";
const MAX_ROUNDS = 25;

async function oidcToken() {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const bearer = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !bearer) throw new Error("No OIDC request URL: the workflow needs `permissions: id-token: write`.");
  const res = await fetch(`${url}&audience=${encodeURIComponent(AUDIENCE)}`, { headers: { Authorization: `bearer ${bearer}` } });
  if (!res.ok) throw new Error(`GitHub refused the OIDC token request (${res.status}).`);
  const body = await res.json();
  if (!body || typeof body.value !== "string") throw new Error("GitHub's OIDC answer had no token.");
  return body.value;
}

async function main() {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) throw new Error("GITHUB_TOKEN is not set.");
  let failures = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    // A fresh OIDC token each round: they are short-lived and a round can take 30 s.
    const jwt = await oidcToken();
    const res = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ action: "run-queue", githubToken }),
      signal: AbortSignal.timeout(60000),
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok || !body || !body.ok) {
      throw new Error(`The admin API answered ${res.status}${body && body.error ? ` (${body.error})` : ""}.`);
    }
    const p = body.processed;
    if (!p) {
      console.log(round === 0 ? "Nothing waiting to publish." : "Queue empty.");
      break;
    }
    if (p.ok) console.log(`::notice::${p.action} ${p.slug}: done`);
    else {
      failures++;
      console.log(`::warning::${p.action} ${p.slug}: failed (${p.status})${p.final ? "" : ", will retry"}`);
      // An entry that will be retried stays first in the queue; leave it for the next run.
      if (!p.final) break;
    }
    if (!body.remaining) break;
  }
  if (failures) console.log(`${failures} action(s) failed; the reason is shown on the project in the admin.`);
}

main().catch((err) => {
  console.log(`::error::${err.message}`);
  process.exitCode = 1;
});
