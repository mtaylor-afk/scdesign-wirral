// WV Roofing admin (the operator screen) — building the page safely, and the words it uses.
// Everything a customer typed is put on the page as text (never as HTML).

/**
 * Make an element. attrs: { class, text, on: { click: fn }, ...attributes };
 * children: nodes, strings (as text) or falsy (skipped).
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = String(v);
    else if (k === "on") for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === "hidden") el.hidden = !!v;
    else if (k === "disabled") el.disabled = !!v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false || c === "") continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** A definition list from [label, value] pairs (value: text or a node; empty pairs skipped). */
export function kv(pairs) {
  const dl = h("dl", { class: "op-kv" });
  for (const [k, v] of pairs) {
    if (v === null || v === undefined || v === "") continue;
    dl.append(h("dt", { text: k }), h("dd", {}, v instanceof Node ? v : String(v)));
  }
  return dl;
}

export function pill(text, kind) {
  return h("span", { class: "op-pill" + (kind ? " op-pill--" + kind : ""), text });
}

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });

export function when(iso) {
  return iso ? DATE.format(new Date(iso)) : "";
}

export function shortDate(iso) {
  return iso ? DAY.format(new Date(iso)) : "";
}

const DAY_YEAR = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });

/** "1 Oct 2026" (UK time). */
export function dateWithYear(iso) {
  return iso ? DAY_YEAR.format(new Date(iso)) : "";
}

/** A number with a word that agrees with it: "1 enquiry", "3 enquiries". */
export function plural(n, one, many) {
  return n + " " + (n === 1 ? one : many);
}

export function money(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "USD", minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(n);
}

export const STATUS_WORDS = {
  new: "New",
  contacted: "Contacted",
  survey_requested: "Survey requested",
  quoted: "Quoted",
  closed: "Closed",
  spam_suspected: "Spam suspected",
};

export const DELIVERY_WORDS = {
  pending: "Email waiting to send",
  sending: "Email sending",
  sent: "Email sent",
  failed: "Email failed",
  uncertain: "Email may not have arrived",
};

export const PROPERTY_WORDS = {
  detached: "Detached house",
  semi: "Semi-detached house",
  end_terrace: "End of terrace",
  mid_terrace: "Mid terrace",
  bungalow: "Bungalow",
  flat: "Flat or maisonette",
  other: "Other",
  not_sure: "Not sure",
};

export const REASON_WORDS = {
  no_rooftop_coordinate: "No rooftop location (postcode area only)",
  not_seen_from_above: "Not checked on an aerial view",
  pin_not_confirmed: "Customer didn't confirm the pin",
  shared_roof: "Roof shared with a neighbour",
  flat_or_shared_block: "A flat: the roof may belong to the block",
  property_type_unclear: "Kind of property unclear",
};

export const COORD_WORDS = {
  rooftop: "Rooftop (from the property's UPRN)",
  postcode_centroid: "Postcode area only",
  none: "None (typed in)",
};

export const JOB_WORDS = {
  queued: "Queued",
  running: "Rendering",
  succeeded: "Done",
  failed: "Failed",
  uncertain: "Uncertain: may have been charged",
  cancelled: "Cancelled",
  superseded: "Replaced by a newer photo or outline",
};

export const ACTION_WORDS = {
  scope_corrected: "Scope corrected",
  status_changed: "Status changed",
  survey_requested: "Survey requested",
  email_resent: "Email sent again",
  deleted: "Deleted",
  original_downloaded: "Original photo downloaded",
  retried: "Render tried again",
  measurement_added: "Measurement added",
  measurement_approved: "Measurement approved",
  measurement_rejected: "Measurement rejected",
  measurement_visibility: "Measurement",
  evidence_downloaded: "Customer's file opened",
};

/** File sizes in words: "3.4 MB", "820 KB". */
export function bytes(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "";
  return v >= 1024 * 1024 ? (v / (1024 * 1024)).toFixed(1) + " MB" : Math.max(1, Math.round(v / 1024)) + " KB";
}

export const PROVIDER_WORDS = {
  openai: "OpenAI (photo-real renders)",
  ideal_postcodes: "Ideal Postcodes (address search)",
  google_static_maps: "Google (satellite views)",
};

export const AERIAL_WORDS = {
  not_configured: "The satellite view isn't switched on.",
  no_coordinates: "There's no map location for this address (it was typed in).",
  no_address: "No address was given.",
};

export const SOURCE_WORDS = {
  visualiser: "Roof Visualiser (own photo)",
  "visualiser-sample": "Roof Visualiser (sample house)",
  "roof-replacement": "Roof replacement form",
  "roof-cam": "Roof Cam (own photo)",
  "roof-cam-sample": "Roof Cam (sample house)",
  bulletin: "Bulletin contact form",
};

/** The two versions of the site, which share one store and this screen. */
export const SITE_WORDS = {
  v1: "Version 1 · Visualiser",
  v2: "Version 2 · Roof Cam",
};

/** The switch at the top of the admin: one site, or both ("" is both). */
export const SITE_CHOICES = [
  ["", "Both sites"],
  ["v1", SITE_WORDS.v1],
  ["v2", SITE_WORDS.v2],
];

/** Only "v1", "v2" or "" (both sites). */
export function cleanSite(v) {
  return v === "v1" || v === "v2" ? v : "";
}

/** A small "v1" / "v2" label (with the full name for screen readers and on hover). */
export function sitePill(site, long) {
  const s = site === "v2" ? "v2" : "v1";
  if (long) return pill(SITE_WORDS[s], s);
  // The short "v1"/"v2" is for the eye; a screen reader hears the full name instead.
  const el = h("span", { class: "op-pill op-pill--" + s, title: SITE_WORDS[s] }, h("span", { "aria-hidden": "true", text: s }), h("span", { class: "sr-only", text: SITE_WORDS[s] }));
  return el;
}

/**
 * Rebuild a group of choice buttons (aria-pressed). If the keyboard was on one
 * of them, it stays on the group: on the button that is now chosen.
 * @param {HTMLElement} box
 * @param {(box: HTMLElement) => void} render
 */
export function keepFocus(box, render) {
  const had = box.contains(document.activeElement);
  render(box);
  if (!had) return;
  const chosen = box.querySelector('[aria-pressed="true"]') || box.querySelector("button");
  if (chosen) chosen.focus();
}

/** A customer's email address as a mailto: link that can't carry anything else (no ?cc=, ?bcc=, ?body=). */
export function mailto(email) {
  return "mailto:" + encodeURIComponent(String(email || "")).replace(/%40/g, "@");
}

/** The set-up checklist the admin shows (from GET health -> setup: yes or no, never a value). */
export const SETUP_WORDS = [
  ["database", "Database (Neon)"],
  ["photoStore", "Photo store (Vercel Blob)"],
  ["sessionSecret", "Session secret"],
  ["cronSecret", "Daily tidy-up secret (CRON_SECRET)"],
  ["adminPassword", "Admin password"],
  ["enquiryEmail", "Enquiry emails to the roofer"],
];

/** Without these, nothing a customer sends is saved. */
export const STORAGE_SETUP = ["database", "photoStore", "sessionSecret", "cronSecret"];

/** Where the site owner sets everything up. */
export const SETUP_HELP = "The site owner sets this up with the SET UP WV ROOFING ADMIN script.";

/** The Roof Cam's weather, for its previews. */
export const CONDITION_WORDS = {
  noon: "As shot",
  sun: "Sun",
  drizzle: "Drizzle",
  storm: "Storm",
  dusk: "Dusk",
};
