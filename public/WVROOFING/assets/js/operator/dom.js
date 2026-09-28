// WV Roofing operator screen — building the page safely, and the words it uses.
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
};
