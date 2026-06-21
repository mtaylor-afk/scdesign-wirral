/**
 * SC Design Wirral — shared helpers for the first-party analytics + admin API.
 *
 * Dependency-free on purpose: uses only Node built-ins (node:crypto) and the
 * global `fetch` (Node 18+ on Vercel). Nothing here is shared with the
 * TailoredQuote backend — this lives only in the SC `scdesign-wirral` repo and
 * deploys to the SC-only `scdesign-wirral` Vercel project.
 */

const crypto = require("node:crypto");

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  "https://scdesignwirral.co.uk",
  "https://www.scdesignwirral.co.uk",
];

/**
 * Apply CORS headers. Echoes the request Origin only when it's on the allow
 * list (required for credentialed requests — wildcard isn't allowed with
 * credentials). Returns true if the caller should stop (OPTIONS preflight).
 */
function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  return !!origin && ALLOWED_ORIGINS.includes(origin);
}

// ---------------------------------------------------------------------------
// Request body
// ---------------------------------------------------------------------------

/** Read + JSON-parse the request body, tolerating pre-parsed bodies and beacons. */
async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Base64url + HMAC session cookies (signed, stateless)
// ---------------------------------------------------------------------------

function b64urlEncode(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function hmac(secret, data) {
  return crypto.createHmac("sha256", secret).update(data).digest();
}

const SESSION_COOKIE = "sc_admin";

/** Create a signed session token valid for ttlSeconds. */
function createSession(secret, ttlSeconds) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = b64urlEncode(JSON.stringify({ exp }));
  const sig = b64urlEncode(hmac(secret, payload));
  return `${payload}.${sig}`;
}

/** Verify a signed session token. Returns true only if intact and unexpired. */
function verifySession(secret, token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = b64urlEncode(hmac(secret, payload));
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const { exp } = JSON.parse(b64urlDecode(payload).toString("utf8"));
    return typeof exp === "number" && exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

/** Build a cross-site session cookie (admin page on the apex, API on vercel.app). */
function sessionCookie(token, ttlSeconds) {
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    `Max-Age=${ttlSeconds}`,
  ];
  return attrs.join("; ");
}

function clearCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`;
}

function requireSession(req) {
  const secret = process.env.SC_ADMIN_SESSION_SECRET || "";
  if (!secret) return false;
  const token = parseCookies(req)[SESSION_COOKIE];
  return verifySession(secret, token);
}

// ---------------------------------------------------------------------------
// Client IP, geo, visitor hash (cookieless, IP never stored)
// ---------------------------------------------------------------------------

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return (
    req.headers["x-real-ip"] ||
    req.headers["x-vercel-forwarded-for"] ||
    (req.socket && req.socket.remoteAddress) ||
    ""
  );
}

function safeDecode(v) {
  if (!v) return "";
  try {
    return decodeURIComponent(String(v));
  } catch {
    return String(v);
  }
}

/** Coarse geo from Vercel's edge headers (IP-derived; the IP itself is not stored). */
function getGeo(req) {
  return {
    country: (req.headers["x-vercel-ip-country"] || "").toString().toUpperCase(),
    region: safeDecode(req.headers["x-vercel-ip-country-region"]),
    city: safeDecode(req.headers["x-vercel-ip-city"]),
    tz: safeDecode(req.headers["x-vercel-ip-timezone"]),
  };
}

/**
 * Daily-rotating, salted visitor hash (the Plausible-style method). Lets us
 * count unique visitors + sessions WITHOUT cookies and WITHOUT ever storing an
 * IP. The salt rotates each UTC day, so the value can't be correlated across
 * days or reversed back to an IP.
 */
function visitorHash(ip, ua, host) {
  const secret = process.env.SC_ADMIN_SESSION_SECRET || "sc-fallback-salt";
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const salt = crypto.createHmac("sha256", secret).update(`salt:${day}`).digest("hex");
  return crypto
    .createHash("sha256")
    .update(`${salt}|${ip}|${ua}|${host || "scdesign"}`)
    .digest("hex")
    .slice(0, 16);
}

// ---------------------------------------------------------------------------
// User-agent parsing (compact, dependency-free)
// ---------------------------------------------------------------------------

const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|crawler|monitoring|monitor|headless|lighthouse|pingdom|gtmetrix|curl|wget|python-requests|axios|node-fetch|go-http|phantomjs|ahrefs|semrush|mj12|dataprovider|petalbot|applebot|googlebot|bingbot|yandex|duckduckbot/i;

function parseUA(ua) {
  ua = ua || "";
  const isBot = BOT_RE.test(ua);

  // Device class
  let device = "desktop";
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) device = "tablet";
  else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|webOS|BlackBerry/i.test(ua))
    device = "mobile";

  // Browser
  let browser = "Other";
  let bv = "";
  const m = (re) => {
    const x = ua.match(re);
    return x ? x[1] : "";
  };
  if (/Edg\//.test(ua)) {
    browser = "Edge";
    bv = m(/Edg\/(\d+)/);
  } else if (/OPR\/|Opera/.test(ua)) {
    browser = "Opera";
    bv = m(/(?:OPR|Opera)\/(\d+)/);
  } else if (/SamsungBrowser/.test(ua)) {
    browser = "Samsung Internet";
    bv = m(/SamsungBrowser\/(\d+)/);
  } else if (/Firefox\/|FxiOS/.test(ua)) {
    browser = "Firefox";
    bv = m(/(?:Firefox|FxiOS)\/(\d+)/);
  } else if (/CriOS/.test(ua)) {
    browser = "Chrome";
    bv = m(/CriOS\/(\d+)/);
  } else if (/Chrome\//.test(ua)) {
    browser = "Chrome";
    bv = m(/Chrome\/(\d+)/);
  } else if (/Safari\//.test(ua) && /Version\//.test(ua)) {
    browser = "Safari";
    bv = m(/Version\/(\d+)/);
  } else if (/MSIE |Trident/.test(ua)) {
    browser = "Internet Explorer";
    bv = m(/(?:MSIE |rv:)(\d+)/);
  }

  // OS
  let os = "Other";
  let osv = "";
  if (/Windows NT/.test(ua)) {
    os = "Windows";
    const map = { "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7" };
    osv = map[m(/Windows NT (\d+\.\d+)/)] || "";
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    os = "iOS";
    osv = m(/OS (\d+)/).replace(/_/g, ".");
  } else if (/Mac OS X/.test(ua)) {
    os = "macOS";
    osv = m(/Mac OS X (\d+[._]\d+)/).replace(/_/g, ".");
  } else if (/Android/.test(ua)) {
    os = "Android";
    osv = m(/Android (\d+)/);
  } else if (/CrOS/.test(ua)) {
    os = "ChromeOS";
  } else if (/Linux/.test(ua)) {
    os = "Linux";
  }

  return { browser, bv, os, osv, device, isBot };
}

// ---------------------------------------------------------------------------
// Referrer channel classification
// ---------------------------------------------------------------------------

const SEARCH_RE = /google\.|bing\.|yahoo\.|duckduckgo\.|ecosia\.|baidu\.|yandex\.|ask\.com|qwant\./i;
const SOCIAL_RE =
  /facebook\.|fb\.com|instagram\.|t\.co|twitter\.|x\.com|linkedin\.|youtube\.|youtu\.be|pinterest\.|reddit\.|tiktok\.|wa\.me|whatsapp|messenger\.|nextdoor\./i;

function classifyChannel(referrerHost, utm) {
  const medium = (utm && utm.medium ? String(utm.medium) : "").toLowerCase();
  if (medium) {
    if (/cpc|ppc|paid|ad|ads|adwords/.test(medium)) return "paid";
    if (/email|newsletter/.test(medium)) return "email";
    if (/social/.test(medium)) return "social";
    if (/referral/.test(medium)) return "referral";
    if (/organic|search/.test(medium)) return "search";
  }
  if (!referrerHost) return "direct";
  if (SEARCH_RE.test(referrerHost)) return "search";
  if (SOCIAL_RE.test(referrerHost)) return "social";
  return "referral";
}

function hostOf(url) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Supabase REST (PostgREST) helpers — service-role key, server-side only
// ---------------------------------------------------------------------------

function sbBase() {
  return (process.env.SC_SUPABASE_URL || "").replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
}

function sbHeaders(extra) {
  const key = process.env.SC_SUPABASE_SERVICE_ROLE_KEY || "";
  return Object.assign(
    {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    extra || {}
  );
}

/** Insert one row into sc_events. Returns {ok, status, error}. */
async function sbInsert(row) {
  const url = `${sbBase()}/rest/v1/sc_events`;
  const res = await fetch(url, {
    method: "POST",
    headers: sbHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const error = await res.text().catch(() => "");
    return { ok: false, status: res.status, error };
  }
  return { ok: true, status: res.status };
}

/**
 * Select rows from sc_events for a time window, paginating to `cap`.
 * `sinceIso` inclusive. Returns an array of rows (selected columns only).
 */
async function sbSelectEvents(sinceIso, cap) {
  cap = cap || 100000;
  const select =
    "select=ts,type,name,path,referrer_host,country,browser,os,device,props";
  const pageSize = 1000;
  let offset = 0;
  const all = [];
  while (true) {
    const url =
      `${sbBase()}/rest/v1/sc_events?${select}` +
      `&ts=gte.${encodeURIComponent(sinceIso)}` +
      `&order=ts.asc&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, { headers: sbHeaders() });
    if (!res.ok) {
      const error = await res.text().catch(() => "");
      throw new Error(`Supabase select failed (${res.status}): ${error}`);
    }
    const rows = await res.json();
    all.push(...rows);
    if (rows.length < pageSize || all.length >= cap) break;
    offset += pageSize;
  }
  return all;
}

/** Insert one row into sc_enquiries (the form-submission backup). Returns {ok, status, error}. */
async function sbInsertEnquiry(row) {
  const url = `${sbBase()}/rest/v1/sc_enquiries`;
  const res = await fetch(url, {
    method: "POST",
    headers: sbHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const error = await res.text().catch(() => "");
    return { ok: false, status: res.status, error };
  }
  return { ok: true, status: res.status };
}

/**
 * Select a page of enquiries, newest first. Uses PostgREST's exact count so the
 * admin can paginate. Returns { rows, total }.
 */
async function sbSelectEnquiries(limit, offset) {
  limit = limit || 10;
  offset = offset || 0;
  const url =
    `${sbBase()}/rest/v1/sc_enquiries?select=*` +
    `&order=created_at.desc&limit=${limit}&offset=${offset}`;
  const res = await fetch(url, {
    headers: sbHeaders({ Prefer: "count=exact", Range: `${offset}-${offset + limit - 1}` }),
  });
  if (!res.ok) {
    const error = await res.text().catch(() => "");
    throw new Error(`Supabase enquiries select failed (${res.status}): ${error}`);
  }
  const rows = await res.json();
  // Content-Range looks like "0-9/123"; the part after "/" is the total.
  let total = rows.length;
  const cr = res.headers.get("content-range");
  if (cr && cr.includes("/")) {
    const n = parseInt(cr.split("/")[1], 10);
    if (Number.isFinite(n)) total = n;
  }
  return { rows, total };
}

module.exports = {
  ALLOWED_ORIGINS,
  applyCors,
  isAllowedOrigin,
  readJsonBody,
  createSession,
  verifySession,
  parseCookies,
  sessionCookie,
  clearCookie,
  requireSession,
  SESSION_COOKIE,
  clientIp,
  getGeo,
  visitorHash,
  parseUA,
  classifyChannel,
  hostOf,
  sbInsert,
  sbSelectEvents,
  sbInsertEnquiry,
  sbSelectEnquiries,
};
