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
  // Never let a response be cached (browser, CDN or proxy) — the admin must
  // always see live data, and ingest responses carry nothing worth caching.
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
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
  const secret = process.env.SC_ADMIN_SESSION_SECRET || "";
  // No secret => return the 'anon' sentinel (the admin UI already special-cases it)
  // rather than hashing under a publicly-known fallback salt, which would make the
  // daily hash brute-forceable back to an IP. Don't throw (callers have no
  // try/catch) and don't use a random per-process salt (would fragment unique /
  // journey counts across serverless instances).
  if (!secret) return "anon";
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const salt = crypto.createHmac("sha256", secret).update(`salt:${day}`).digest("hex");
  return crypto
    .createHash("sha256")
    .update(`${salt}|${ip}|${ua}|${host || "scdesign"}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Trusted client IP for SECURITY decisions (rate limiting / audit) only — never
 * feeds the cookieless visitor hash. Unlike clientIp() it never trusts the
 * LEFTMOST X-Forwarded-For entry (fully client-controlled). On Vercel the real
 * client IP is the platform-injected x-real-ip / x-vercel-forwarded-for, or the
 * RIGHTMOST (proxy-appended) hop of x-forwarded-for.
 */
function trustedClientIp(req) {
  const h = req.headers || {};
  const real = h["x-real-ip"];
  if (real) return String(real).split(",").pop().trim();
  const vff = h["x-vercel-forwarded-for"];
  if (vff) return String(vff).split(",").pop().trim();
  const xff = h["x-forwarded-for"];
  if (xff) return String(xff).split(",").pop().trim();
  return (req.socket && req.socket.remoteAddress) || "";
}

/**
 * Recursively cap the size of a free-form props object so a hostile or runaway
 * client can't write huge jsonb rows. Strings truncated, arrays/objects bounded.
 * Shared by the analytics / error / enquiry ingest endpoints.
 */
function sanitizeProps(v, depth) {
  depth = depth || 0;
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.slice(0, 2000);
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (depth >= 5) return null;
  if (Array.isArray(v)) return v.slice(0, 40).map((x) => sanitizeProps(x, depth + 1));
  if (typeof v === "object") {
    const out = {};
    let n = 0;
    for (const k of Object.keys(v)) {
      if (n++ >= 50) break;
      out[String(k).slice(0, 80)] = sanitizeProps(v[k], depth + 1);
    }
    return out;
  }
  return null;
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

/**
 * Insert one row into sc_errors (the client error log + admin login audit).
 * Retries transient failures (cold Supabase compute / schema-cache reload) with
 * a short backoff so a low-traffic error or login row isn't silently dropped on
 * the first hit. Returns {ok, status, error}.
 */
async function sbInsertError(row) {
  const url = `${sbBase()}/rest/v1/sc_errors`;
  const current = Object.assign({}, row);
  if (!current.props || typeof current.props !== "object") current.props = {};
  let lastStatus = 0;
  let lastError = "";
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: sbHeaders({ Prefer: "return=minimal" }),
        body: JSON.stringify(current),
      });
      if (res.ok) return { ok: true, status: res.status };
      lastStatus = res.status;
      lastError = await res.text().catch(() => "");
      // Self-heal: if the table is missing a column (e.g. it was created from an
      // older schema), keep that value inside props and retry without it — so
      // logging works regardless of the exact table shape, with no data lost.
      const miss = /Could not find the '([^']+)' column/.exec(lastError);
      if (miss && miss[1] && Object.prototype.hasOwnProperty.call(current, miss[1])) {
        const col = miss[1];
        if (col !== "props" && current[col] !== undefined && current[col] !== null) {
          current.props[col] = current[col];
        }
        delete current[col];
        continue; // retry immediately with the offending column removed
      }
      // Other 4xx are permanent — don't waste retries.
      if (res.status < 500 && res.status !== 404) break;
    } catch (e) {
      lastError = e && e.message ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  return { ok: false, status: lastStatus, error: lastError };
}

// Restrict by row "kind". Admin login attempts share the sc_errors table but use
// dedicated `type`s; this keeps them out of the error views and powers the
// separate "Login attempts" view.
function errKindFilter(kind) {
  if (kind === "logins") return "&type=in.(login_success,login_failed)";
  if (kind === "logins_failed") return "&type=eq.login_failed";
  if (kind === "logins_success") return "&type=eq.login_success";
  if (kind === "errors") return "&type=not.in.(login_success,login_failed)";
  return ""; // all
}

/**
 * Select a page of errors, newest first. `botMode` is "exclude" (default — only
 * human errors), "only" (just bots), or "include" (everything). `kind` filters
 * by row type ("errors" excludes login rows; "logins"/"logins_failed"/
 * "logins_success" select them). Uses PostgREST's exact count so the admin can
 * paginate. Returns { rows, total }.
 */
async function sbSelectErrors(limit, offset, botMode, kind) {
  limit = limit || 10;
  offset = offset || 0;
  let botFilter = "";
  if (botMode === "only") botFilter = "&is_bot=eq.true";
  else if (botMode !== "include") botFilter = "&is_bot=eq.false"; // default = exclude bots
  const url =
    `${sbBase()}/rest/v1/sc_errors?select=*` +
    `${botFilter}${errKindFilter(kind)}&order=ts.desc&limit=${limit}&offset=${offset}`;
  const res = await fetch(url, {
    headers: sbHeaders({ Prefer: "count=exact", Range: `${offset}-${offset + limit - 1}` }),
  });
  if (!res.ok) {
    const error = await res.text().catch(() => "");
    throw new Error(`Supabase errors select failed (${res.status}): ${error}`);
  }
  const rows = await res.json();
  let total = rows.length;
  const cr = res.headers.get("content-range");
  if (cr && cr.includes("/")) {
    const n = parseInt(cr.split("/")[1], 10);
    if (Number.isFinite(n)) total = n;
  }
  return { rows, total };
}

/**
 * Exact count of error rows since `sinceIso` (HEAD request, no body fetched).
 * Honours the same botMode as sbSelectErrors. Returns a number (0 on failure).
 */
async function sbCountErrors(sinceIso, botMode, kind) {
  let botFilter = "";
  if (botMode === "only") botFilter = "&is_bot=eq.true";
  else if (botMode !== "include") botFilter = "&is_bot=eq.false";
  const since = sinceIso ? `&ts=gte.${encodeURIComponent(sinceIso)}` : "";
  const url = `${sbBase()}/rest/v1/sc_errors?select=id${since}${botFilter}${errKindFilter(kind)}`;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: sbHeaders({ Prefer: "count=exact", Range: "0-0" }),
    });
    const cr = res.headers.get("content-range");
    if (cr && cr.includes("/")) {
      const n = parseInt(cr.split("/")[1], 10);
      if (Number.isFinite(n)) return n;
    }
  } catch {
    /* best-effort KPI only */
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Projects CMS — Postgres (sc_projects + sc_project_events)
// ---------------------------------------------------------------------------
// The EDITING store for Sean's case studies. Publishing copies the content and
// images into the git repo, so nothing here is ever read by the public site.

/**
 * The one true slug shape, kept identical to serverlib/cms.js's `slug` regex.
 * Duplicated (not imported) on purpose: cms.js pulls in zod, and this file is
 * deliberately dependency-free. It exists so that every helper which puts a
 * slug into a URL can prove the slug is safe FIRST — see sbDeleteProject.
 */
const PROJECT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isProjectSlug(v) {
  return typeof v === "string" && PROJECT_SLUG_RE.test(v);
}

/**
 * Select a page of projects in Sean's running order. Returns { rows, total }.
 *
 * `select=*` rather than a column list: the list view needs the summary columns
 * AND `content` (the caller derives the image count from content.images), which
 * is all but two columns — so naming them buys nothing and would need editing
 * every time the table grows one. Throws on failure, like sbSelectEnquiries.
 */
async function sbSelectProjects(limit, offset) {
  limit = limit || 50;
  offset = offset || 0;
  const url =
    `${sbBase()}/rest/v1/sc_projects?select=*` +
    `&order=sort_order.asc.nullslast,updated_at.desc` +
    `&limit=${limit}&offset=${offset}`;
  const res = await fetch(url, {
    headers: sbHeaders({ Prefer: "count=exact", Range: `${offset}-${offset + limit - 1}` }),
  });
  if (!res.ok) {
    const error = await res.text().catch(() => "");
    throw new Error(`Supabase projects select failed (${res.status}): ${error}`);
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

/** One project row by slug, or null if there is no such row. Throws on failure. */
async function sbGetProject(slug) {
  const url =
    `${sbBase()}/rest/v1/sc_projects?select=*` +
    `&slug=eq.${encodeURIComponent(slug)}&limit=1`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) {
    const error = await res.text().catch(() => "");
    throw new Error(`Supabase project select failed (${res.status}): ${error}`);
  }
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0];
}

/**
 * Insert-or-update one project row (keyed on slug). Returns {ok, status, error}.
 *
 * POST + `resolution=merge-duplicates`, not PUT: PostgREST's PUT replaces the
 * whole row and demands the full primary key in the query string, so a save
 * that omitted a column would blank it. The two Prefer tokens must travel as
 * ONE comma-separated value — a second `Prefer` key would just overwrite the
 * first in the headers object.
 */
async function sbUpsertProject(row) {
  const url = `${sbBase()}/rest/v1/sc_projects?on_conflict=slug`;
  const res = await fetch(url, {
    method: "POST",
    headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const error = await res.text().catch(() => "");
    return { ok: false, status: res.status, error };
  }
  return { ok: true, status: res.status };
}

/**
 * Delete one project row. Returns {ok, status, error, deleted} where `deleted`
 * is the number of rows actually removed — so a caller can tell "gone" from
 * "there was nothing there".
 *
 * HAZARD, and the reason for the guard below: PostgREST treats a DELETE with no
 * filter in the query string as "delete every row in this table". There is no
 * confirmation and no undo. So the slug is validated against the strict slug
 * pattern BEFORE the URL is built: an empty string, undefined, or a value
 * carrying `&`/`?` can never reach the wire as a missing or broken filter.
 */
async function sbDeleteProject(slug) {
  if (!isProjectSlug(slug)) return { ok: false, status: 0, error: "bad slug", deleted: 0 };
  const url = `${sbBase()}/rest/v1/sc_projects?slug=eq.${encodeURIComponent(slug)}`;
  const res = await fetch(url, {
    method: "DELETE",
    // return=representation so the response body is the rows that went, which
    // is the only way to distinguish "deleted 1" from "matched 0" (both 200).
    headers: sbHeaders({ Prefer: "return=representation" }),
  });
  if (!res.ok) {
    const error = await res.text().catch(() => "");
    return { ok: false, status: res.status, error, deleted: 0 };
  }
  const rows = await res.json().catch(() => []);
  return { ok: true, status: res.status, deleted: Array.isArray(rows) ? rows.length : 0 };
}

/**
 * Write Sean's running order: each slug's sort_order becomes its array index.
 * Returns {ok, updated} (plus {status, error} when a row failed).
 *
 * Same unfiltered-write hazard as sbDeleteProject — an unfiltered PATCH would
 * renumber the ENTIRE table — so every slug is validated before any request is
 * sent, and the whole call is refused if one is bad rather than half-applied.
 * These are separate requests, not a transaction: if one fails mid-list the
 * earlier rows keep their new numbers. That is safe because the operation is
 * idempotent — the caller can simply send the same order again.
 */
async function sbSetProjectOrder(slugs) {
  if (!Array.isArray(slugs) || !slugs.length) return { ok: false, updated: 0, error: "no slugs" };
  for (const s of slugs) {
    if (!isProjectSlug(s)) return { ok: false, updated: 0, error: "bad slug" };
  }
  let updated = 0;
  for (let i = 0; i < slugs.length; i++) {
    const url = `${sbBase()}/rest/v1/sc_projects?slug=eq.${encodeURIComponent(slugs[i])}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ sort_order: i }),
    });
    if (!res.ok) {
      const error = await res.text().catch(() => "");
      return { ok: false, status: res.status, error, updated };
    }
    updated++;
  }
  return { ok: true, updated };
}

/**
 * Append one row to the sc_project_events audit trail. Returns {ok, status,
 * error}. Modelled on sbInsertEnquiry: publishing and deleting both change the
 * live website, so every attempt is recorded whether it succeeded or not.
 *
 * The payload is assembled from the known columns only, so a stray field from a
 * caller can't 400 the insert and lose the trail. `actor` must come from
 * process.env.SC_ADMIN_USER server-side — the session token carries only {exp},
 * and a username from the request body would be attacker-chosen.
 */
async function sbInsertProjectEvent(row) {
  const src = row || {};
  const detail = src.detail === undefined || src.detail === null ? null : String(src.detail);
  const payload = {
    slug: src.slug || null,
    action: src.action || null,
    outcome: src.outcome || null,
    // A refusal detail can be a whole list of validation problems; cap it so one
    // bad save can't write a huge audit row.
    detail: detail === null ? null : detail.slice(0, 4000),
    commit_sha: src.commit_sha || null,
    actor: src.actor || null,
    ip_hash: src.ip_hash || null,
  };
  const url = `${sbBase()}/rest/v1/sc_project_events`;
  const res = await fetch(url, {
    method: "POST",
    headers: sbHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.text().catch(() => "");
    return { ok: false, status: res.status, error };
  }
  return { ok: true, status: res.status };
}

// ---------------------------------------------------------------------------
// Projects CMS — Supabase Storage (private `project-media` bucket)
// ---------------------------------------------------------------------------
// Staging area for uploaded photos while Sean works. Publishing downloads them
// from here and commits them to the repo, so the bucket is a workbench, not a
// CDN — the admin previews through short-lived signed URLs.

function sbBucket() {
  return process.env.SC_PROJECT_MEDIA_BUCKET || "project-media";
}

// sbBase() already strips a trailing /rest/v1, so this is the Storage root.
function sbStorageBase() {
  return `${sbBase()}/storage/v1`;
}

// Keys are "<slug>/<file>". encodeURI, never encodeURIComponent: the latter
// would escape the "/" and create one oddly-named object instead of a file
// inside the slug's folder.
function sbStorageKeyPath(key) {
  return encodeURI(String(key || "").replace(/^\/+/, ""));
}

/**
 * Upload one object. Returns {ok, status, error, key}.
 *
 * Two things to note. (1) sbHeaders() defaults Content-Type to
 * application/json; for a binary upload that lie is stored as the object's own
 * content type and served back later, so it MUST be overridden here. (2) The
 * body is the raw Buffer — JSON.stringify()ing it would store a JSON rendering
 * of the byte array, not an image.
 */
async function sbStorageUpload(key, bytes, contentType) {
  const url = `${sbStorageBase()}/object/${sbBucket()}/${sbStorageKeyPath(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: sbHeaders({
      "Content-Type": contentType || "application/octet-stream",
      // Re-uploading the same key is a correction, not an error: fixing a photo
      // or republishing reuses "<slug>/<file>", so upsert keeps it idempotent.
      "x-upsert": "true",
      "cache-control": "max-age=3600",
    }),
    body: bytes,
  });
  if (!res.ok) {
    const error = await res.text().catch(() => "");
    return { ok: false, status: res.status, error, key };
  }
  return { ok: true, status: res.status, key };
}

/**
 * Download one staged object as a Buffer. Throws on failure — publishing must
 * abort rather than commit a project with a missing image.
 */
async function sbStorageDownload(key) {
  const url = `${sbStorageBase()}/object/authenticated/${sbBucket()}/${sbStorageKeyPath(key)}`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) {
    const error = await res.text().catch(() => "");
    throw new Error(`Supabase storage download failed (${res.status}): ${error}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Every object key under `prefix` (e.g. a slug's folder). Returns an array of
 * FULL keys, ready to pass to sbStorageDeleteMany or sbStorageDownload. Throws
 * on failure.
 *
 * Two traps the loops below exist to avoid:
 *  1. Listing is NON-recursive, and each returned `name` is relative to the
 *     prefix — not a full key. Entries with `id: null` are sub-folders, not
 *     objects. Returning `name` as-is would point every later download or
 *     delete at the bucket root, where it silently matches nothing.
 *  2. Listing is PAGINATED. Without looping on `offset` until a short page
 *     arrives, anything past the first page is invisible here — which for a
 *     delete means orphaned files left behind in the bucket for ever.
 */
async function sbStorageList(prefix) {
  const url = `${sbStorageBase()}/object/list/${sbBucket()}`;
  const pageSize = 100;
  const out = [];
  const queue = [String(prefix || "").replace(/^\/+/, "").replace(/\/+$/, "")];
  const seen = Object.create(null); // a folder is only ever walked once
  while (queue.length) {
    const dir = queue.shift();
    if (seen[dir]) continue;
    seen[dir] = true;
    let offset = 0;
    while (true) {
      const res = await fetch(url, {
        method: "POST",
        headers: sbHeaders(),
        body: JSON.stringify({
          prefix: dir,
          limit: pageSize,
          offset,
          sortBy: { column: "name", order: "asc" },
        }),
      });
      if (!res.ok) {
        const error = await res.text().catch(() => "");
        throw new Error(`Supabase storage list failed (${res.status}): ${error}`);
      }
      const rows = await res.json();
      if (!Array.isArray(rows) || !rows.length) break;
      for (const row of rows) {
        const name = row && row.name ? String(row.name) : "";
        if (!name) continue;
        const full = dir ? `${dir}/${name}` : name;
        if (!row.id) queue.push(full); // id === null => sub-folder, walk into it
        else out.push(full);
      }
      if (rows.length < pageSize) break; // a short page is the last page
      offset += pageSize;
    }
  }
  return out;
}

/**
 * Delete objects by exact key. Returns {ok, deleted, error}.
 *
 * TRAP: despite the request field being called `prefixes`, Storage matches each
 * entry as an EXACT object key — it is not a wildcard. "my-slug/" deletes
 * nothing at all and still answers 200, so a caller clearing a folder must
 * sbStorageList() first and pass the full keys. The length comparison below is
 * what turns a silent partial delete into a reported one.
 */
async function sbStorageDeleteMany(keys) {
  const list = Array.isArray(keys) ? keys.filter((k) => typeof k === "string" && k) : [];
  if (!list.length) return { ok: true, deleted: 0 };
  const res = await fetch(`${sbStorageBase()}/object/${sbBucket()}`, {
    method: "DELETE",
    headers: sbHeaders(),
    body: JSON.stringify({ prefixes: list }),
  });
  if (!res.ok) {
    const error = await res.text().catch(() => "");
    return { ok: false, deleted: 0, error };
  }
  const rows = await res.json().catch(() => []);
  const deleted = Array.isArray(rows) ? rows.length : 0;
  if (deleted !== list.length) {
    return { ok: false, deleted, error: `deleted ${deleted} of ${list.length} objects` };
  }
  return { ok: true, deleted };
}

/**
 * A short-lived signed URL for previewing a staged image, or null. The bucket is
 * private, so this is the only way the admin page can show an unpublished photo.
 *
 * Never throws: a preview that can't be signed must degrade to a missing
 * thumbnail, not break the whole editor screen. The API's `signedURL` comes back
 * as a path relative to the Storage root, so it is made absolute here.
 */
async function sbStorageSignedUrl(key, expiresIn) {
  const ttl = Number.isFinite(expiresIn) && expiresIn > 0 ? Math.floor(expiresIn) : 3600;
  try {
    const url = `${sbStorageBase()}/object/sign/${sbBucket()}/${sbStorageKeyPath(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({ expiresIn: ttl }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    const rel = body && body.signedURL ? String(body.signedURL) : "";
    if (!rel) return null;
    return `${sbStorageBase()}${rel.charAt(0) === "/" ? "" : "/"}${rel}`;
  } catch {
    return null;
  }
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
  trustedClientIp,
  getGeo,
  visitorHash,
  sanitizeProps,
  parseUA,
  classifyChannel,
  hostOf,
  sbInsert,
  sbSelectEvents,
  sbInsertEnquiry,
  sbSelectEnquiries,
  sbInsertError,
  sbSelectErrors,
  sbCountErrors,
  // Projects CMS — Postgres
  sbSelectProjects,
  sbGetProject,
  sbUpsertProject,
  sbDeleteProject,
  sbSetProjectOrder,
  sbInsertProjectEvent,
  // Projects CMS — Storage
  sbStorageUpload,
  sbStorageDownload,
  sbStorageList,
  sbStorageDeleteMany,
  sbStorageSignedUrl,
};
