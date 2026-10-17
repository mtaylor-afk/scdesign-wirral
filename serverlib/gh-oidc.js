/**
 * SC Design Wirral — prove a request comes from THIS repo's cms-publish workflow.
 *
 * The publish queue (api/sc-admin-publish.js, action "run-queue") is driven by a
 * scheduled GitHub Actions job instead of a stored GitHub token. The job asks GitHub
 * for an OpenID Connect token (a JWT signed by GitHub) and sends it as a Bearer
 * token; this module checks the signature against GitHub's published keys and then
 * every claim that pins it to one workflow file, on main, in this repository.
 *
 * There is no shared secret to set up or leak. The ids below are the repository's
 * and owner's numeric ids, which survive a rename (names are checked as well).
 *
 * Pure Node (crypto + global fetch), no dependencies, like common.js.
 */

const crypto = require("node:crypto");

const ISSUER = "https://token.actions.githubusercontent.com";
const JWKS_URL = `${ISSUER}/.well-known/jwks`;

/** Must match the `audience` the workflow asks for (scripts/cms-runner.mjs). */
const AUDIENCE = "scdesign-cms";

const EXPECT = Object.freeze({
  repository: "mtaylor-afk/scdesign-wirral",
  repository_id: "1262205324",
  repository_owner_id: "264544788",
  ref: "refs/heads/main",
  workflow: "mtaylor-afk/scdesign-wirral/.github/workflows/cms-publish.yml@refs/heads/main",
});

/** Clock skew allowed either side, seconds. */
const LEEWAY = 60;

/** GitHub rotates keys rarely; refetch at most every 10 minutes, or on an unknown kid. */
const JWKS_TTL_MS = 10 * 60 * 1000;
let jwksCache = null; // { at, keys }

function b64urlJson(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

async function fetchKeys(fetchImpl) {
  const res = await fetchImpl(JWKS_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const body = await res.json();
  return Array.isArray(body && body.keys) ? body.keys : [];
}

async function keyFor(kid, fetchImpl, now) {
  if (!jwksCache || now - jwksCache.at > JWKS_TTL_MS || !jwksCache.keys.some((k) => k.kid === kid)) {
    jwksCache = { at: now, keys: await fetchKeys(fetchImpl) };
  }
  return jwksCache.keys.find((k) => k.kid === kid && k.kty === "RSA") || null;
}

/**
 * Verify a GitHub Actions OIDC token. Resolves to { ok:true, claims } or
 * { ok:false, reason } — never throws, and the reason never quotes the token.
 *
 * @param {string} jwt
 * @param {{ fetch?: typeof fetch, now?: () => number }} [opts]  injectable for tests
 */
async function verifyWorkflowToken(jwt, opts) {
  const fetchImpl = (opts && opts.fetch) || fetch;
  const now = (opts && opts.now ? opts.now() : Date.now());
  try {
    const parts = String(jwt || "").split(".");
    if (parts.length !== 3) return { ok: false, reason: "malformed" };
    const header = b64urlJson(parts[0]);
    // RS256 only: never let the token choose a weaker or "none" algorithm.
    if (!header || header.alg !== "RS256" || typeof header.kid !== "string") return { ok: false, reason: "alg" };
    const jwk = await keyFor(header.kid, fetchImpl, now);
    if (!jwk) return { ok: false, reason: "unknown_key" };
    const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
    const signed = crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${parts[0]}.${parts[1]}`),
      key,
      Buffer.from(parts[2], "base64url")
    );
    if (!signed) return { ok: false, reason: "signature" };

    const c = b64urlJson(parts[1]);
    const t = Math.floor(now / 1000);
    if (c.iss !== ISSUER) return { ok: false, reason: "iss" };
    const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
    if (!aud.includes(AUDIENCE)) return { ok: false, reason: "aud" };
    if (!(typeof c.exp === "number" && c.exp + LEEWAY > t)) return { ok: false, reason: "expired" };
    if (typeof c.nbf === "number" && c.nbf - LEEWAY > t) return { ok: false, reason: "not_yet" };
    if (c.repository !== EXPECT.repository) return { ok: false, reason: "repository" };
    if (String(c.repository_id) !== EXPECT.repository_id) return { ok: false, reason: "repository_id" };
    if (String(c.repository_owner_id) !== EXPECT.repository_owner_id) return { ok: false, reason: "owner" };
    if (c.ref !== EXPECT.ref) return { ok: false, reason: "ref" };
    // job_workflow_ref names the workflow FILE that ran, so another workflow in
    // the repo (or a pull request's copy of this one) is refused.
    if (c.job_workflow_ref !== EXPECT.workflow) return { ok: false, reason: "workflow" };
    if (c.event_name !== "schedule" && c.event_name !== "workflow_dispatch") return { ok: false, reason: "event" };
    return { ok: true, claims: c };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

module.exports = { verifyWorkflowToken, AUDIENCE, EXPECT, ISSUER, JWKS_URL };
