// WV Roofing — address lookup (A5; brief §6, plan D9).
//
// - Postcodes are normalised before anything is looked up ("ch451ab" -> "CH45 1AB").
// - Ideal Postcodes is called by the server with a server-side key. Its answer is
//   never stored or cached (Royal Mail's terms don't allow caching whole responses):
//   each address goes back to the browser with a signed token, and only the one
//   the customer picks is stored, from that token.
// - Coordinates: rooftop when the address has a UPRN, otherwise the postcode
//   centroid. Only rooftop coordinates ever get a pin on the aerial view.
// - The labelled test environment uses a fixture instead of Ideal Postcodes.
//   Ideal Postcodes' own free test postcodes behave as they do there:
//   ID1 1QD found, ID1 KFA not found, ID1 CLIP no lookups left, ID1 CHOP limit hit.
"use strict";

const crypto = require("crypto");
const { oneLine } = require("./core.js");
const { isTest } = require("./capabilities.js");

const ENDPOINT = "https://api.ideal-postcodes.co.uk/v1/postcodes/";
const PC_RE = /^([A-Z]{1,2}[0-9][A-Z0-9]?)([0-9][A-Z]{2})$/;
/** Ideal Postcodes' free test postcodes (not in the normal UK format). */
const TEST_POSTCODES = /** @type {Record<string, string>} */ ({ ID11QD: "ID1 1QD", ID1KFA: "ID1 KFA", ID1CLIP: "ID1 CLIP", ID1CHOP: "ID1 CHOP" });
const TOKEN_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * @typedef {object} Address
 * @property {string[]} lines
 * @property {string | null} postTown
 * @property {string | null} postcode
 * @property {string | null} uprn
 * @property {string | null} udprn
 * @property {string | null} umprn
 * @property {number | null} lat
 * @property {number | null} lng
 * @property {"rooftop" | "postcode_centroid" | "none"} coordSource
 * @property {string | null} dataset  paf | mr | nyb (not yet built) | abp
 */

class AddressError extends Error {
  /**
   * @param {"not_found" | "exhausted" | "limited" | "not_configured" | "upstream"} kind
   * @param {string} message
   */
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

/**
 * "ch451ab", "CH45  1AB" -> "CH45 1AB"; null if it isn't a UK postcode.
 * @param {unknown} input
 */
function normalisePostcode(input) {
  const s = String(input == null ? "" : input)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (TEST_POSTCODES[s]) return TEST_POSTCODES[s];
  const m = PC_RE.exec(s);
  return m ? m[1] + " " + m[2] : null;
}

/** @param {unknown} v */
function num(v) {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n;
}

/** @param {unknown} v */
function idText(v) {
  const s = oneLine(v, 20);
  return /^[0-9]{1,15}$/.test(s) ? s : null;
}

/**
 * One address from Ideal Postcodes, in our shape.
 * @param {Record<string, any>} a
 * @returns {Address}
 */
function shape(a) {
  const lines = [a.line_1, a.line_2, a.line_3].map((l) => oneLine(l, 80)).filter(Boolean);
  const uprn = idText(a.uprn);
  const lat = num(a.latitude);
  const lng = num(a.longitude);
  const has = lat !== null && lng !== null && lat > 49 && lat < 61 && lng > -9 && lng < 3;
  return {
    lines,
    postTown: oneLine(a.post_town, 40) || null,
    postcode: normalisePostcode(a.postcode),
    uprn,
    udprn: idText(a.udprn),
    umprn: idText(a.umprn),
    lat: has ? lat : null,
    lng: has ? lng : null,
    coordSource: has ? (uprn ? "rooftop" : "postcode_centroid") : "none",
    dataset: /^(paf|mr|nyb|abp)$/.test(String(a.dataset || "")) ? String(a.dataset) : null,
  };
}

/**
 * Ideal Postcodes: every address at a postcode.
 * @param {string} postcode  normalised
 * @param {string} key
 * @returns {Promise<Address[]>}
 */
async function idealLookup(postcode, key) {
  let res;
  try {
    res = await fetch(ENDPOINT + encodeURIComponent(postcode) + "?api_key=" + encodeURIComponent(key), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    throw new AddressError("upstream", "Address search couldn't be reached.");
  }
  /** @type {any} */
  let body = {};
  try {
    body = await res.json();
  } catch (err) {
    body = {};
  }
  const code = Number(body && body.code);
  if (res.ok && code === 2000 && Array.isArray(body.result)) return body.result.map(shape);
  if (code === 4040 || res.status === 404) throw new AddressError("not_found", "We couldn't find that postcode.");
  if (code === 4020) throw new AddressError("exhausted", "Address search has no lookups left.");
  if (code === 4021) throw new AddressError("limited", "Address search has reached its limit for today.");
  if (res.status === 401 || res.status === 403 || (code >= 4010 && code < 4020)) throw new AddressError("not_configured", "The address search key was refused.");
  console.warn("[wvroofing] address lookup error", res.status, code);
  throw new AddressError("upstream", "Address search had a problem.");
}

/**
 * TEST ENVIRONMENT ONLY: a street of addresses at any postcode (and Ideal
 * Postcodes' test postcodes behave as they do there).
 * @param {string} postcode
 * @returns {Promise<Address[]>}
 */
async function fixtureLookup(postcode) {
  if (!isTest(process.env)) throw new Error("The address fixture exists only in the test environment.");
  if (postcode === "ID1 KFA") throw new AddressError("not_found", "We couldn't find that postcode.");
  if (postcode === "ID1 CLIP") throw new AddressError("exhausted", "Address search has no lookups left.");
  if (postcode === "ID1 CHOP") throw new AddressError("limited", "Address search has reached its limit for today.");
  const at = (/** @type {number} */ n) => ({ lat: 53.4225 + n * 0.00012, lng: -3.0478 + n * 0.00015 });
  /** @param {string[]} lines @param {string | null} uprn @param {number} n @param {string} [dataset] @returns {Address} */
  const a = (lines, uprn, n, dataset) => ({
    lines,
    postTown: "WALLASEY",
    postcode,
    uprn,
    udprn: uprn ? String(Number(uprn.slice(-6)) + 50000000) : null,
    umprn: null,
    lat: uprn ? at(n).lat : 53.4226,
    lng: uprn ? at(n).lng : -3.0476,
    coordSource: uprn ? "rooftop" : "postcode_centroid",
    dataset: dataset || "paf",
  });
  return [
    a(["1 Test Road"], "100000000001", 1),
    a(["Flat 2", "3 Test Road"], "100000000003", 3),
    a(["5 Test Road"], null, 5),
    a(["7 Test Road"], "100000000007", 7, "nyb"),
  ];
}

/**
 * The lookup for this environment.
 * @param {string} postcode
 * @returns {Promise<Address[]>}
 */
function lookup(postcode) {
  if (isTest(process.env)) return fixtureLookup(postcode);
  return idealLookup(postcode, process.env.WVR_IDEAL_POSTCODES_KEY || "");
}

// ---------------------------------------------------------------------------
// signed tokens: the chosen address comes back from the browser, unaltered

function secret() {
  if (process.env.WVR_SESSION_SECRET) return process.env.WVR_SESSION_SECRET;
  if (isTest(process.env)) return "wvroofing-test-secret";
  throw new Error("WVR_SESSION_SECRET is not set.");
}

/** @param {string} payload */
function mac(payload) {
  return crypto.createHmac("sha256", secret()).update("wvr-address|" + payload).digest("base64url");
}

/**
 * A token the browser can send back to choose this address (for this project, within an hour).
 * @param {string} projectId
 * @param {Address} a
 */
function signAddress(projectId, a) {
  const payload = Buffer.from(JSON.stringify({ p: projectId, t: Date.now(), a })).toString("base64url");
  return payload + "." + mac(payload);
}

/**
 * The address inside a token, if the token is genuine, for this project and recent.
 * @param {string} projectId
 * @param {unknown} token
 * @returns {Address | null}
 */
function verifyAddress(projectId, token) {
  const t = String(token || "");
  if (t.length > 4096) return null;
  const dot = t.indexOf(".");
  if (dot < 1) return null;
  const payload = t.slice(0, dot);
  const want = Buffer.from(mac(payload));
  const got = Buffer.from(t.slice(dot + 1));
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    const o = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (o.p !== projectId || !(Date.now() - Number(o.t) < TOKEN_MAX_AGE_MS)) return null;
    return o.a;
  } catch (err) {
    return null;
  }
}

/**
 * A typed-in address. Postcode optional, but valid if given.
 * @param {Record<string, any>} m
 * @returns {{ address: Address | null, problems: string[] }}
 */
function manualAddress(m) {
  const line1 = oneLine(m && m.line1, 80);
  const line2 = oneLine(m && m.line2, 80);
  const town = oneLine(m && m.town, 40);
  const rawPostcode = oneLine(m && m.postcode, 10);
  const postcode = rawPostcode ? normalisePostcode(rawPostcode) : null;
  /** @type {string[]} */
  const problems = [];
  if (line1.length < 2) problems.push("line1");
  if (town.length < 2) problems.push("town");
  if (rawPostcode && !postcode) problems.push("postcode");
  if (problems.length) return { address: null, problems };
  return {
    address: { lines: [line1, line2].filter(Boolean), postTown: town, postcode, uprn: null, udprn: null, umprn: null, lat: null, lng: null, coordSource: "none", dataset: null },
    problems,
  };
}

/** "WALLASEY" -> "Wallasey". @param {string | null} s */
function titleCase(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
}

/** One line for the address list. @param {Address} a */
function label(a) {
  return a.lines.concat(a.postTown ? [titleCase(a.postTown)] : []).join(", ");
}

module.exports = { AddressError, normalisePostcode, shape, lookup, idealLookup, signAddress, verifyAddress, manualAddress, label, titleCase };
