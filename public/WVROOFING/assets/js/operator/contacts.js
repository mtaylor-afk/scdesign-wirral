// WV Roofing admin — the Contacts tab: everyone who has sent an enquiry on the
// site chosen at the top, as one table (phone and email a tap away), found by
// name, phone, email, postcode or reference, and the same list as a spreadsheet
// (CSV) to download. Everything a customer typed goes on the page as text.
import { api, getToken } from "./api.js";
import { API_BASE } from "../config.js";
import { h, pill, when, plural, sitePill, dateWithYear, keepFocus, mailto, STATUS_WORDS, SITE_WORDS } from "./dom.js";

const $ = (id) => document.getElementById(id);

const LIMIT = 1000; // the table shows up to this many; the spreadsheet has up to 5,000
const SHORT = 80; // longer messages are shortened, with the full text a click away
const FILTERS = [["", "All"]].concat(Object.entries(STATUS_WORDS));

const C = {
  hooks: null,
  filter: "",
  q: "",
  rows: [],
  asked: null, // the query the newest load is for (an older answer is dropped)
  timer: 0,
};

function shown() {
  return !$("op-view-contacts").hidden;
}

function say(msg, isError) {
  if (shown()) C.hooks.status(msg, isError);
}

/** The filters as a query string (with the row limit for the table, without it for the spreadsheet). */
function params(withLimit) {
  const p = new URLSearchParams();
  if (withLimit) p.set("limit", String(LIMIT));
  const site = C.hooks.site();
  if (site) p.set("site", site);
  if (C.filter) p.set("status", C.filter);
  if (C.q) p.set("q", C.q);
  return p.toString();
}

function renderFilters() {
  keepFocus($("op-contacts-filters"), (box) => box.replaceChildren(
    ...FILTERS.map(([v, t]) =>
      h("button", {
        class: "op-chip",
        type: "button",
        "aria-pressed": String(C.filter === v),
        text: t,
        on: {
          click: () => {
            C.filter = v;
            renderFilters();
            loadContacts();
          },
        },
      })
    )
  ));
}

/** Load (or reload) the table for the chosen site, status and search. */
export async function loadContacts() {
  const asked = params(true);
  C.asked = asked;
  try {
    const r = await api("GET", "operator/enquiries?" + asked);
    if (C.asked !== asked) return; // a filter or the search changed while this was loading
    C.rows = Array.isArray(r.enquiries) ? r.enquiries : [];
    renderTable();
    const n = C.rows.length;
    const site = C.hooks.site();
    say(
      plural(n, "contact", "contacts") +
        (C.filter ? " marked " + STATUS_WORDS[C.filter].toLowerCase() : "") +
        (site ? " from " + SITE_WORDS[site] : " from both sites") +
        (C.q ? " matching “" + C.q + "”" : "") +
        "." +
        (n >= LIMIT ? " The table shows the newest " + LIMIT.toLocaleString("en-GB") + ": the spreadsheet has up to 5,000." : "")
    );
  } catch (ex) {
    if (ex.status !== 401) say(ex.message, true);
  }
}

/** Signed out: forget everything. */
export function resetContacts() {
  clearTimeout(C.timer);
  C.rows = [];
  C.q = "";
  C.asked = null;
  const q = $("op-contacts-q");
  if (q) q.value = "";
  const list = $("op-contacts-list");
  if (list) list.replaceChildren();
  const empty = $("op-contacts-empty");
  if (empty) empty.hidden = true;
}

// ---------------------------------------------------------------------------
// the table

function phoneLink(phone) {
  if (!phone) return "";
  const dial = String(phone).replace(/[^\d+]/g, "");
  return dial ? h("a", { href: "tel:" + dial, text: phone }) : String(phone);
}

function emailLink(email) {
  return email ? h("a", { href: mailto(email), text: email }) : "";
}

/** A long message is shortened; the whole of it opens underneath. */
function messageCell(text) {
  const t = String(text || "").trim();
  if (!t) return h("span", { class: "op-muted", text: "-" });
  if (t.length <= SHORT) return h("span", { class: "op-msg", text: t });
  return h("details", { class: "op-msg" }, h("summary", { text: t.slice(0, SHORT - 20).trimEnd() + "…" }), h("p", { text: t }));
}

function row(e) {
  return h(
    "tr",
    {},
    h("td", { class: "op-nowrap" }, h("time", { datetime: e.createdAt, title: when(e.createdAt), text: dateWithYear(e.createdAt) })),
    h("td", { class: "op-nowrap" }, h("button", { class: "op-linklike op-ref", type: "button", text: e.reference, title: "Open this enquiry", on: { click: () => C.hooks.openEnquiry(e.id) } })),
    h("td", { text: e.name || "" }),
    h("td", { class: "op-nowrap" }, phoneLink(e.phone)),
    h("td", { class: "op-nowrap" }, emailLink(e.email)),
    h("td", { class: "op-nowrap", text: e.postcode || "" }),
    h("td", { text: e.roof || "" }),
    h("td", {}, sitePill(e.site)),
    h("td", {}, pill(STATUS_WORDS[e.status] || e.status, e.status)),
    h("td", { class: "op-nowrap", text: e.hasPhoto ? "Yes" + (e.previews ? " (" + plural(e.previews, "preview", "previews") + ")" : "") : "No" }),
    h("td", { class: "op-msg-cell" }, messageCell(e.message))
  );
}

const HEADINGS = ["Saved", "Reference", "Name", "Phone", "Email", "Postcode", "Roof", "Site", "Status", "Photo", "Message"];

function renderTable() {
  const list = $("op-contacts-list");
  $("op-contacts-empty").hidden = C.rows.length > 0;
  if (!C.rows.length) {
    list.replaceChildren();
    return;
  }
  list.replaceChildren(
    h(
      "table",
      { class: "op-table op-contacts" },
      h("caption", { class: "sr-only", text: "Contact details from enquiries, newest first" }),
      h("thead", {}, h("tr", {}, HEADINGS.map((t) => h("th", { scope: "col", text: t })))),
      h("tbody", {}, C.rows.map(row))
    )
  );
}

// ---------------------------------------------------------------------------
// the spreadsheet

/** Rows in a CSV (not counting the header), allowing for line breaks inside quoted fields. */
function csvRows(text) {
  let rows = 0;
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') quoted = !quoted;
    else if (c === "\n" && !quoted) rows++;
  }
  if (text.length && !text.endsWith("\n")) rows++;
  return Math.max(0, rows - 1);
}

/** The file name the server gave, or the same pattern made here (the header can't always be read cross-site). */
function fileName(r) {
  const m = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") || "");
  if (m && /^[\w.-]+\.csv$/.test(m[1])) return m[1];
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/London" }).format(new Date());
  const site = C.hooks.site();
  return "wv-roofing-enquiries-" + today + (site ? "-" + site : "") + ".csv";
}

async function download() {
  const btn = $("op-contacts-csv");
  btn.disabled = true;
  say("Making the spreadsheet…");
  const asked = params(false);
  try {
    let r;
    try {
      r = await fetch(API_BASE + "/api/wvroofing/operator/export/enquiries" + (asked ? "?" + asked : ""), {
        headers: { Authorization: "Bearer " + getToken() },
        cache: "no-store",
        credentials: "omit",
      });
    } catch (e) {
      throw new Error("The server can't be reached. Check the connection and try again.");
    }
    if (r.status === 401) {
      // The session has ended: asking for it again signs out the usual way (back to the login).
      await api("GET", "operator/session").catch(() => null);
      return;
    }
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      throw new Error((j && j.message) || "The spreadsheet couldn't be made (" + r.status + "). Please try again.");
    }
    const blob = await r.blob();
    const rows = csvRows(await blob.text());
    const name = fileName(r);
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: name, hidden: true });
    document.body.append(a);
    a.click();
    a.remove();
    // Let the browser start saving it before the object URL goes.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    say("Downloaded " + plural(rows, "enquiry", "enquiries") + " as a spreadsheet: " + name + ".");
  } catch (ex) {
    say(ex.message, true);
  } finally {
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// set up

/**
 * @param {{ site: () => string, status: (msg: string, isError?: boolean) => void, openEnquiry: (id: string) => void }} hooks
 */
export function initContacts(hooks) {
  C.hooks = hooks;
  renderFilters();
  const input = $("op-contacts-q");
  input.addEventListener("input", () => {
    clearTimeout(C.timer);
    C.timer = setTimeout(() => {
      const q = input.value.trim();
      if (q === C.q) return;
      C.q = q;
      loadContacts();
    }, 300);
  });
  $("op-contacts-search").addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(C.timer);
    C.q = input.value.trim();
    loadContacts();
  });
  $("op-contacts-csv").addEventListener("click", download);
}
