// WV Roofing — the operator screen (A6; brief §14). Linked from nowhere and never
// indexed. After logging in: the enquiries (newest first, by status), everything
// about one (customer, property and what was confirmed, satellite view, photo,
// renders, paid calls, history), and what can be done with it (status, request a
// survey, correct the scope, send the email again, delete); plus the renders that
// failed or never came back, which can be tried again only when confirmed.
import { api, apiImage, getToken, setToken, whenSignedOut } from "./api.js";
import { loadCatalogue } from "../catalogue.js";
import {
  h,
  kv,
  pill,
  when,
  shortDate,
  money,
  STATUS_WORDS,
  DELIVERY_WORDS,
  PROPERTY_WORDS,
  REASON_WORDS,
  COORD_WORDS,
  JOB_WORDS,
  ACTION_WORDS,
  SOURCE_WORDS,
  PROVIDER_WORDS,
  AERIAL_WORDS,
} from "./dom.js";

const $ = (id) => document.getElementById(id);

const FILTERS = [["", "All"]].concat(Object.entries(STATUS_WORDS));

const S = {
  filter: "",
  q: "",
  enquiries: [],
  jobs: [],
  selected: null,
  // the open enquiry's images (API path -> object URL), kept while it stays open
  images: new Map(),
  imagesFor: null,
  products: new Map(),
};

// ---------------------------------------------------------------------------
// small helpers

function status(msg, isError) {
  const el = $("op-status");
  el.textContent = msg || "";
  el.classList.toggle("is-error", !!isError);
}

function loginError(msg) {
  const el = $("op-login-error");
  el.textContent = msg || "";
  el.hidden = !msg;
}

function setParam(id) {
  history.replaceState(null, "", id ? "?enquiry=" + encodeURIComponent(id) : location.pathname);
}

function revokeUrls() {
  for (const u of S.images.values()) URL.revokeObjectURL(u);
  S.images.clear();
  S.imagesFor = null;
}

function productName(id) {
  if (!id) return "";
  if (id === "not-sure") return "Not sure yet";
  const p = S.products.get(id);
  return p ? p.name + (p.colourName ? ", " + p.colourName : "") : id;
}

function addressText(a) {
  return (a.lines || []).concat(a.postTown ? [a.postTown] : [], a.postcode ? [a.postcode] : []).join(", ");
}

function badKind(s) {
  return s === "failed" || s === "uncertain" ? "bad" : null;
}

/** Ask before doing something. Resolves true only when confirmed. */
function confirmBox(title, text, okLabel, danger) {
  const dlg = $("op-confirm");
  if (typeof dlg.showModal !== "function") return Promise.resolve(window.confirm(title + "\n\n" + text));
  $("op-confirm-title").textContent = title;
  $("op-confirm-text").textContent = text;
  const ok = $("op-confirm-ok");
  ok.textContent = okLabel || "Confirm";
  ok.className = "btn btn-sm " + (danger ? "btn-danger" : "btn-primary");
  dlg.returnValue = "";
  return new Promise((resolve) => {
    dlg.addEventListener("close", () => resolve(dlg.returnValue === "ok"), { once: true });
    dlg.showModal();
  });
}

/**
 * Put an image the API streams (with the session key) into a slot, fetched once
 * while the enquiry stays open. With `enlarge`, a click opens it full size.
 */
async function loadImage(slot, path, alt, enlarge) {
  let url = S.images.get(path);
  if (!url) {
    try {
      url = await apiImage(path);
    } catch (ex) {
      slot.replaceChildren(h("span", { class: "op-muted op-small", text: ex.status === 404 ? "Image not available." : ex.message }));
      return;
    }
    if (S.images.has(path)) {
      URL.revokeObjectURL(url);
      url = S.images.get(path);
    } else {
      S.images.set(path, url);
    }
  }
  const img = h("img", { src: url, alt, decoding: "async" });
  slot.replaceChildren(enlarge ? h("a", { href: url, target: "_blank", rel: "noopener", title: "Open full size" }, img) : img);
}

// ---------------------------------------------------------------------------
// logging in and out

function showLogin(msg) {
  revokeUrls();
  S.selected = null;
  S.enquiries = [];
  S.jobs = [];
  S.q = "";
  $("op-q").value = "";
  $("op-costs").replaceChildren();
  $("op-app").hidden = true;
  $("op-logout").hidden = true;
  $("op-env").hidden = true;
  $("op-login").hidden = false;
  $("op-detail").replaceChildren();
  $("op-list").replaceChildren();
  loginError(msg);
  const pw = $("op-password");
  pw.value = "";
  pw.focus();
}

async function onLogin(e) {
  e.preventDefault();
  const pw = $("op-password");
  if (!pw.value) {
    loginError("Please enter the password.");
    pw.focus();
    return;
  }
  const btn = $("op-login-btn");
  btn.disabled = true;
  loginError("");
  try {
    const r = await api("POST", "operator/login", { password: pw.value });
    pw.value = "";
    setToken(r.token);
    showApp(await api("GET", "operator/session"));
  } catch (ex) {
    loginError(ex.message);
    pw.select();
  } finally {
    btn.disabled = false;
  }
}

async function logout() {
  try {
    await api("POST", "operator/logout");
  } catch (ex) {
    /* the key is dropped here either way */
  }
  setToken("");
  setParam("");
  showLogin("");
}

function showApp(session) {
  $("op-login").hidden = true;
  $("op-app").hidden = false;
  $("op-logout").hidden = false;
  $("op-env").hidden = session.environment !== "test";
  renderFilters();
  refreshAll(new URLSearchParams(location.search).get("enquiry"));
}

async function refreshAll(selectId) {
  await Promise.all([loadList(), loadJobs()]);
  const id = selectId || S.selected;
  if (id) await openEnquiry(id, { quiet: !selectId });
}

// ---------------------------------------------------------------------------
// the enquiry list

function renderFilters() {
  $("op-filters").replaceChildren(
    ...FILTERS.map(([v, t]) =>
      h("button", {
        class: "op-chip",
        type: "button",
        "aria-pressed": String(S.filter === v),
        text: t,
        on: {
          click: () => {
            S.filter = v;
            renderFilters();
            loadList();
          },
        },
      })
    )
  );
}

async function loadList() {
  const asked = listParams();
  try {
    const r = await api("GET", "operator/enquiries" + (asked ? "?" + asked : ""));
    if (asked !== listParams()) return; // the filter or search changed while this was loading
    S.enquiries = r.enquiries;
    renderList();
    const n = r.enquiries.length;
    status(n + (n === 1 ? " enquiry" : " enquiries") + (S.filter ? " marked " + STATUS_WORDS[S.filter].toLowerCase() : "") + (S.q ? " matching “" + S.q + "”" : "") + ".");
  } catch (ex) {
    if (ex.status !== 401) status(ex.message, true);
  }
}

function listParams() {
  const params = new URLSearchParams();
  if (S.filter) params.set("status", S.filter);
  if (S.q) params.set("q", S.q);
  return params.toString();
}

let searchTimer = 0;

function onSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const q = $("op-q").value.trim();
    if (q === S.q) return;
    S.q = q;
    loadList();
  }, 300);
}

function flags(e) {
  const out = [];
  if (e.checkFirst) out.push(pill("Check scope first", "warn"));
  if (e.delivery === "failed" || e.delivery === "uncertain") out.push(pill(DELIVERY_WORDS[e.delivery], "bad"));
  if (e.renders) out.push(pill(e.renders + (e.renders === 1 ? " render" : " renders")));
  return out.length ? h("span", { class: "op-flags" }, out) : null;
}

function renderList() {
  $("op-list").replaceChildren(
    ...S.enquiries.map((e) =>
      h(
        "li",
        {},
        h(
          "button",
          { class: "op-item", type: "button", "data-id": e.id, "aria-current": e.id === S.selected ? "true" : null, on: { click: () => openEnquiry(e.id) } },
          h("span", { class: "op-item-top" }, h("span", { class: "op-ref", text: e.reference }), pill(STATUS_WORDS[e.status] || e.status, e.status), h("span", { class: "op-item-meta", text: shortDate(e.createdAt) })),
          h("span", { class: "op-item-name", text: e.name }),
          h("span", { class: "op-item-meta", text: [e.address || e.postcode || "No address", e.roof].filter(Boolean).join(" · ") }),
          flags(e)
        )
      )
    )
  );
  $("op-list-empty").hidden = S.enquiries.length > 0;
}

function markSelected() {
  for (const b of document.querySelectorAll(".op-item")) {
    if (b.dataset.id === S.selected) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  }
}

function backToList() {
  S.selected = null;
  setParam("");
  markSelected();
  $("op-view-enquiries").dataset.show = "list";
  const first = document.querySelector(".op-item");
  if (first) first.focus();
}

// ---------------------------------------------------------------------------
// one enquiry

async function openEnquiry(id, opts) {
  const quiet = !!(opts && opts.quiet);
  S.selected = id;
  markSelected();
  setParam(id);
  const pane = $("op-detail");
  $("op-view-enquiries").dataset.show = "detail";
  if (!quiet) pane.replaceChildren(h("p", { class: "op-empty op-muted", text: "Loading…" }));
  try {
    const d = await api("GET", "operator/enquiries/" + encodeURIComponent(id));
    if (S.selected !== id) return;
    renderDetail(d);
    if (!quiet) {
      const head = $("op-ref-title");
      if (head) head.focus();
    }
  } catch (ex) {
    if (ex.status === 401) return;
    if (ex.status === 404) {
      S.selected = null;
      setParam("");
      pane.replaceChildren(h("p", { class: "op-empty op-muted", text: "That enquiry no longer exists." }));
      return;
    }
    pane.replaceChildren(h("p", { class: "op-empty op-muted", text: ex.message }));
  }
}

function renderDetail(d) {
  if (S.imagesFor !== d.enquiry.id) {
    revokeUrls();
    S.imagesFor = d.enquiry.id;
  }
  // After an action the detail is drawn again: keep the keyboard where it was.
  const active = document.activeElement;
  const refocus = active && active !== document.body && $("op-detail").contains(active) ? active.id || "op-ref-title" : null;
  const e = d.enquiry;
  const p = d.project;
  $("op-detail").replaceChildren(
    h(
      "div",
      { class: "op-detail" },
      h("button", { class: "btn btn-neutral btn-sm op-back", type: "button", text: "All enquiries", on: { click: backToList } }),
      headCard(e),
      h("div", { class: "op-grid-2" }, customerCard(e), propertyCard(e, p)),
      photoCard(p),
      p ? costsCard(p) : null,
      historyCard(d.audit),
      deleteCard(e, p)
    )
  );
  if (refocus) {
    const el = $(refocus) || $("op-ref-title");
    if (el) el.focus({ preventScroll: true });
  }
}

function headCard(e) {
  const select = h(
    "select",
    { class: "select", id: "op-status-select", "aria-label": "Status" },
    Object.entries(STATUS_WORDS).map(([v, t]) => h("option", { value: v, text: t, selected: v === e.status }))
  );
  select.addEventListener("change", () => changeStatus(e, select.value));
  const d = e.delivery;
  const deliveryNote = [d.deliveredAt ? "at " + when(d.deliveredAt) : "", d.attempts ? d.attempts + (d.attempts === 1 ? " attempt" : " attempts") : "", d.error || ""].filter(Boolean).join(" · ");
  return h(
    "section",
    { class: "op-head", "aria-labelledby": "op-ref-title" },
    h("h2", { id: "op-ref-title", tabindex: "-1" }, h("span", { class: "op-ref", text: e.reference }), pill(STATUS_WORDS[e.status] || e.status, e.status)),
    h("p", { class: "op-muted op-small", text: "Saved " + when(e.createdAt) + " · " + (SOURCE_WORDS[e.source] || e.source) }),
    h(
      "div",
      { class: "op-actions" },
      select,
      h("button", {
        class: "btn btn-secondary btn-sm",
        type: "button",
        text: e.surveyRequestedAt ? "Survey requested " + shortDate(e.surveyRequestedAt) : "Request a survey",
        disabled: !!e.surveyRequestedAt,
        on: { click: () => requestSurvey(e) },
      }),
      h("button", { class: "btn btn-neutral btn-sm", type: "button", text: "Send the email again", on: { click: () => resend(e) } })
    ),
    h("p", { class: "op-small" }, pill(DELIVERY_WORDS[d.status] || d.status, d.status === "sent" ? "good" : badKind(d.status)), deliveryNote ? " " + deliveryNote : "")
  );
}

function customerCard(e) {
  return h(
    "section",
    { class: "op-card" },
    h("h3", { text: "Customer" }),
    kv([
      ["Name", e.name],
      ["Phone", e.phone ? h("a", { href: "tel:" + e.phone.replace(/[^\d+]/g, ""), text: e.phone }) : null],
      ["Email", e.email ? h("a", { href: "mailto:" + e.email, text: e.email }) : null],
      ["Postcode", e.postcode],
      ["Roof choice", productName(e.roof)],
      ["Message", e.notes],
      ["Images in the email", e.includeImages ? "Yes" : "No"],
      ["Marketing", e.marketing ? "Opted in" : null],
      ["Lawful basis", e.lawfulBasis === "steps_before_contract" ? "Steps before a contract (a quote)" : e.lawfulBasis],
    ])
  );
}

function propertyCard(e, p) {
  const card = h("section", { class: "op-card" }, h("h3", { text: "Property" }));
  if (!p) {
    const snap = e.snapshot && e.snapshot.address;
    card.append(
      h("p", { class: "op-muted op-small", text: e.source === "visualiser" ? "The customer has since deleted their photo and project." : "This enquiry came without a visualiser project." }),
      snap ? kv([["Address when sent", addressText(snap)]]) : null
    );
    return card;
  }
  const a = p.addresses.find((x) => x.current);
  const c = p.confirmations.find((x) => x.current);
  if (!a) {
    card.append(h("p", { class: "op-muted op-small", text: "No address given (the customer used the photo-only route)." }));
    return card;
  }
  const source = a.provider === "manual" ? "Typed in by the customer" : a.provider === "fixture" ? "Test addresses (test environment)" : "Ideal Postcodes";
  card.append(
    kv([
      ["Address", addressText(a)],
      ["Location", COORD_WORDS[a.coordSource] || a.coordSource],
      ["UPRN", a.uprn],
      ["Source", source + (a.dataset === "nyb" ? " (not yet built)" : "")],
    ])
  );
  const slot = h("div", {});
  const btn = h("button", { class: "btn btn-neutral btn-sm", type: "button", text: "Show the satellite view" });
  btn.addEventListener("click", () => showAerial(e, slot, btn));
  card.append(h("div", {}, btn), slot);
  if (c) {
    card.append(
      h("h4", { text: "What was confirmed" }),
      kv([
        ["Kind", PROPERTY_WORDS[c.propertyType] || c.propertyType],
        ["Pin", c.pinShown ? (c.pinConfirmed ? "Confirmed by the customer" : "Shown, not confirmed") : "No pin shown"],
        ["Check first", c.reasons.length ? c.reasons.map((r) => REASON_WORDS[r] || r).join("; ") : "Nothing flagged"],
        ["By", (c.by === "operator" ? "Operator" : "Customer") + ", " + when(c.at)],
        ["Notes", c.notes],
      ])
    );
  } else {
    card.append(h("p", { class: "op-muted op-small", text: "The customer didn't say what kind of property it is." }));
  }
  if (p.confirmations.length > 1) card.append(confirmationsTable(p.confirmations));
  card.append(scopeForm(e, c));
  return card;
}

function confirmationsTable(list) {
  return h(
    "div",
    { class: "op-table-wrap" },
    h(
      "table",
      { class: "op-table" },
      h("caption", { class: "sr-only", text: "Confirmation history" }),
      h("thead", {}, h("tr", {}, ["When", "By", "Kind", "Check first", ""].map((t) => h("th", { scope: "col", text: t })))),
      h(
        "tbody",
        {},
        list
          .slice()
          .reverse()
          .map((c) =>
            h(
              "tr",
              { class: c.current ? null : "is-old" },
              h("td", { text: when(c.at) }),
              h("td", { text: c.by === "operator" ? "Operator" : "Customer" }),
              h("td", { text: PROPERTY_WORDS[c.propertyType] || c.propertyType }),
              h("td", { text: c.reasons.map((r) => REASON_WORDS[r] || r).join("; ") || "-" }),
              h("td", { text: c.current ? "Current" : "Replaced" })
            )
          )
      )
    )
  );
}

function scopeForm(e, c) {
  const sel = h(
    "select",
    { class: "select", id: "op-scope-type" },
    Object.entries(PROPERTY_WORDS).map(([v, t]) => h("option", { value: v, text: t, selected: !!c && c.propertyType === v }))
  );
  const notes = h("textarea", { class: "textarea", id: "op-scope-notes", rows: "3", maxlength: "1000", placeholder: "For example: checked on site, it's an end of terrace" });
  const err = h("p", { class: "field-error", role: "alert", hidden: true });
  const btn = h("button", { class: "btn btn-primary btn-sm", type: "submit", text: "Save the correction" });
  const form = h(
    "form",
    { class: "op-form", id: "op-scope-form" },
    h("h4", { text: "Correct the scope" }),
    h("p", { class: "op-muted op-small", text: "Adds a new record. The customer's answer stays in the history." }),
    h("label", { class: "op-label", for: "op-scope-type", text: "Kind of property" }),
    sel,
    h("label", { class: "op-label", for: "op-scope-notes", text: "Why (optional)" }),
    notes,
    err,
    btn
  );
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    err.hidden = true;
    btn.disabled = true;
    try {
      await api("POST", "operator/enquiries/" + e.id + "/scope", { propertyType: sel.value, notes: notes.value });
      status("Scope corrected for " + e.reference + ".");
      await refreshAfterChange(e.id);
    } catch (ex) {
      if (ex.status === 401) return;
      err.textContent = ex.message;
      err.hidden = false;
      btn.disabled = false;
    }
  });
  return form;
}

async function showAerial(e, slot, btn) {
  btn.disabled = true;
  try {
    const { view } = await api("GET", "operator/enquiries/" + e.id + "/aerial");
    if (view.available) {
      slot.replaceChildren(
        h(
          "figure",
          { class: "op-aerial" },
          h("img", { src: view.url, alt: "Satellite view of the address" + (view.pin ? ", with a pin on the property" : "") }),
          h("figcaption", { class: "op-caption", text: view.attribution + (view.pin ? "" : ". No pin: only the postcode's area is known.") })
        )
      );
    } else {
      slot.replaceChildren(h("p", { class: "op-muted op-small", text: AERIAL_WORDS[view.reason] || "The satellite view isn't available." }));
    }
    btn.hidden = true;
  } catch (ex) {
    if (ex.status === 401) return;
    slot.replaceChildren(h("p", { class: "op-muted op-small", text: ex.message }));
    btn.disabled = false;
  }
}

function photoCard(p) {
  const card = h("section", { class: "op-card" }, h("h3", { text: "Photo and renders" }));
  if (!p || !p.photo) {
    card.append(h("p", { class: "op-muted op-small", text: p ? "No photo was uploaded." : "There's no photo: no visualiser project." }));
    return card;
  }
  const ph = p.photo;
  const slot = h("div", { class: "op-photo" }, h("span", { class: "op-muted op-small", text: "Loading the photo…" }));
  slot.style.aspectRatio = ph.w + " / " + ph.h; // its space is kept while it loads, so nothing jumps
  loadImage(slot, "operator/projects/" + p.id + "/photo", "The customer's photo of the house", true);
  const link = h("span", { class: "op-small" });
  const dl = h("button", { class: "btn btn-neutral btn-sm", type: "button", text: "Get the original file" });
  dl.addEventListener("click", () => originalLink(p, link, dl));
  const outline = p.mask ? "the roof outline covers " + Math.round(p.mask.coverage * 100) + "% of it" : "roof not marked";
  card.append(
    slot,
    h("p", { class: "op-caption", text: "Original " + ph.origW + " × " + ph.origH + " px; " + outline + "." + (ph.warnings.length ? " " + ph.warnings.join(" ") : "") }),
    h("div", { class: "op-actions" }, dl, link)
  );
  const jobs = p.jobs.slice().sort((a, b) => Number(b.current) - Number(a.current));
  if (!jobs.length) {
    card.append(h("p", { class: "op-muted op-small", text: p.consentAi ? "No photo-real renders yet." : "The customer didn't ask for photo-real renders (OpenAI)." }));
  } else {
    card.append(h("h4", { text: "Photo-real renders" }), h("div", { class: "op-renders" }, jobs.map((j) => renderTile(j))));
  }
  return card;
}

function renderTile(j) {
  const slot = h("div", { class: "op-render-img", text: j.hasComposite ? "Loading…" : JOB_WORDS[j.status] || j.status });
  if (j.hasComposite) loadImage(slot, "operator/jobs/" + j.id + "/image", productName(j.visualId) + " (AI concept render)", true);
  const seam = j.qa && Number.isFinite(Number(j.qa.seam)) ? "seam score " + Number(j.qa.seam).toFixed(1) + " (lower is better)" : "";
  const cost = j.settled !== null ? money(j.settled, "USD") + " charged" : j.status === "uncertain" ? "up to " + money(j.reserved, "USD") + " may have been charged" : "";
  return h(
    "figure",
    { class: "op-render" + (j.current ? "" : " is-old") },
    slot,
    h(
      "figcaption",
      { class: "op-render-body" },
      h("strong", { text: productName(j.visualId) }),
      h("span", {}, pill(JOB_WORDS[j.status] || j.status, j.status === "succeeded" ? "good" : badKind(j.status)), j.quarantined ? " " : "", j.quarantined ? pill("Set aside", "warn") : null),
      h("span", { class: "op-muted", text: [when(j.createdAt), j.model + " (" + j.quality + ")", cost, seam, j.current ? "" : "older photo or outline"].filter(Boolean).join(" · ") }),
      j.error ? h("span", { class: "op-muted", text: "Error: " + j.error + (j.detail ? ": " + j.detail : "") }) : null,
      j.status === "failed" || j.status === "uncertain" ? h("button", { class: "btn btn-neutral btn-xs", type: "button", text: "Try again", on: { click: () => retryJob(j) } }) : null
    )
  );
}

async function originalLink(p, slot, btn) {
  btn.disabled = true;
  try {
    const r = await api("GET", "operator/projects/" + p.id + "/original");
    slot.replaceChildren(h("a", { href: r.url, target: "_blank", rel: "noopener noreferrer", text: "Open the original (this link works for 5 minutes)" }));
  } catch (ex) {
    if (ex.status !== 401) slot.textContent = ex.message;
  } finally {
    btn.disabled = false;
  }
}

function costsCard(p) {
  if (!p.costs.length) return null;
  return h(
    "section",
    { class: "op-card" },
    h("h3", { text: "Paid calls for this project" }),
    h(
      "div",
      { class: "op-table-wrap" },
      h(
        "table",
        { class: "op-table" },
        h("thead", {}, h("tr", {}, ["Service", "Calls", "Cost (estimate)"].map((t) => h("th", { scope: "col", text: t })))),
        h(
          "tbody",
          {},
          p.costs.map((c) => h("tr", {}, h("td", { text: PROVIDER_WORDS[c.provider] || c.provider }), h("td", { text: String(c.calls) }), h("td", { text: money(c.cost, c.currency) })))
        )
      )
    ),
    h("p", { class: "op-caption", text: "Recorded at the time of each call, at the most it could cost; the provider's own bill is the final word." })
  );
}

function describe(a) {
  const b = a.before || {};
  const f = a.after || {};
  if (a.action === "status_changed") return ": " + (STATUS_WORDS[b.status] || b.status) + " to " + (STATUS_WORDS[f.status] || f.status);
  if (a.action === "scope_corrected") {
    const from = b.propertyType ? (PROPERTY_WORDS[b.propertyType] || b.propertyType) + " to " : "";
    return ": " + from + (PROPERTY_WORDS[f.propertyType] || f.propertyType) + (f.notes ? " (" + f.notes + ")" : "");
  }
  if (a.action === "email_resent") return ": " + (f.outcome === "sent" ? "sent" : f.outcome === "uncertain" ? "may not have gone" : "failed");
  if (a.action === "retried") return " as a new render";
  if (a.action === "deleted" && a.target === "project") return ": the photo and project";
  return "";
}

function historyCard(audit) {
  return h(
    "section",
    { class: "op-card" },
    h("h3", { text: "What's been done" }),
    audit.length
      ? h("ol", { class: "op-audit" }, audit.map((a) => h("li", {}, h("time", { datetime: a.at, text: when(a.at) }), h("span", { text: (ACTION_WORDS[a.action] || a.action) + describe(a) }))))
      : h("p", { class: "op-muted op-small", text: "Nothing yet. Every change made here is recorded, with what it was before." })
  );
}

function deleteCard(e, p) {
  return h(
    "section",
    { class: "op-card op-danger" },
    h("h3", { text: "Delete" }),
    h("p", { class: "op-muted op-small", text: "This can't be undone. Emails the roofer has already received stay in their inbox." }),
    h(
      "div",
      { class: "op-actions" },
      p ? h("button", { class: "btn btn-neutral btn-sm", type: "button", text: "Delete the photo and project only", on: { click: () => deleteProject(e, p) } }) : null,
      h("button", { class: "btn btn-danger btn-sm", type: "button", text: p ? "Delete the enquiry and its project" : "Delete the enquiry", on: { click: () => deleteEnquiry(e, p) } })
    )
  );
}

// ---------------------------------------------------------------------------
// actions

async function refreshAfterChange(id) {
  await Promise.all([loadList(), loadJobs(), id ? openEnquiry(id, { quiet: true }) : null]);
}

async function act(fn, done) {
  try {
    const r = await fn();
    if (done) status(typeof done === "function" ? done(r) : done);
    return r;
  } catch (ex) {
    if (ex.status !== 401) status(ex.message, true);
    return null;
  }
}

async function changeStatus(e, value) {
  if (value === e.status) return;
  await act(() => api("POST", "operator/enquiries/" + e.id + "/status", { status: value }), e.reference + " marked " + STATUS_WORDS[value].toLowerCase() + ".");
  await refreshAfterChange(e.id);
}

async function requestSurvey(e) {
  const ok = await confirmBox(
    "Request a survey?",
    "Marks " + e.reference + " as survey requested, with today's date. It doesn't contact the customer: arrange the visit with them.",
    "Request a survey"
  );
  if (!ok) return;
  await act(() => api("POST", "operator/enquiries/" + e.id + "/request-survey"), "Survey requested for " + e.reference + ".");
  await refreshAfterChange(e.id);
}

async function resend(e) {
  const ok = await confirmBox(
    "Send the email again?",
    "The roofer's email about " + e.reference + " goes out again now. If the first one did arrive, it will arrive twice.",
    "Send it again"
  );
  if (!ok) return;
  status("Sending…");
  const r = await act(() => api("POST", "operator/enquiries/" + e.id + "/resend", { confirm: true }));
  if (r) {
    if (r.outcome === "sent") status("Email sent for " + e.reference + ".");
    else if (r.outcome === "uncertain") status("The mail server didn't answer in time, so the email may not have gone.", true);
    else status("The email failed: " + (r.error || "no reason given") + ".", true);
  }
  await refreshAfterChange(e.id);
}

async function retryJob(j) {
  const charged = j.status === "uncertain" ? "OpenAI may already have charged for the last attempt: its result never came back.\n\n" : "";
  const ok = await confirmBox(
    "Make a new render?",
    charged + "A new photo-real render of " + productName(j.visualId) + " will be made, and charged at up to " + money(j.reserved, "USD") + ".",
    "Make a new render"
  );
  if (!ok) return;
  const r = await act(
    () => api("POST", "operator/jobs/" + j.id + "/retry", { confirm: true }),
    (x) => (x.created ? "A new render is on its way." : "A render of that roof is already on its way or done.")
  );
  if (r) await refreshAfterChange(S.selected);
}

async function deleteProject(e, p) {
  const ok = await confirmBox(
    "Delete the photo and project?",
    "Deletes the customer's photo, roof outline, renders and address for " + e.reference + ". The enquiry and their contact details stay.",
    "Delete",
    true
  );
  if (!ok) return;
  const r = await act(() => api("POST", "operator/projects/" + p.id + "/delete"), "Photo and project deleted for " + e.reference + ".");
  if (r) await refreshAfterChange(e.id);
}

async function deleteEnquiry(e, p) {
  const ok = await confirmBox(
    "Delete " + e.reference + "?",
    "Deletes the enquiry and the customer's contact details" + (p ? ", with their photo, roof outline, renders and address" : "") + ".",
    "Delete",
    true
  );
  if (!ok) return;
  const r = await act(() => api("POST", "operator/enquiries/" + e.id + "/delete"), e.reference + " deleted.");
  if (!r) return;
  S.selected = null;
  setParam("");
  revokeUrls();
  $("op-detail").replaceChildren(h("p", { class: "op-empty op-muted", text: e.reference + " was deleted." }));
  $("op-view-enquiries").dataset.show = "list";
  await Promise.all([loadList(), loadJobs()]);
}

// ---------------------------------------------------------------------------
// renders to check

async function loadJobs() {
  try {
    const r = await api("GET", "operator/jobs");
    S.jobs = r.jobs;
    renderJobs();
  } catch (ex) {
    if (ex.status !== 401) status(ex.message, true);
  }
}

function renderJobs() {
  const n = S.jobs.length;
  const count = $("op-jobs-count");
  count.hidden = n === 0;
  count.textContent = String(n);
  $("op-jobs").replaceChildren(
    ...S.jobs.map((j) =>
      h(
        "li",
        { class: "op-job" },
        h("div", { class: "op-job-top" }, pill(JOB_WORDS[j.status] || j.status, "bad"), h("strong", { text: productName(j.visualId) }), h("span", { class: "op-muted op-small", text: when(j.createdAt) })),
        h(
          "p",
          { class: "op-small" },
          j.enquiryId
            ? h("button", { class: "op-linklike", type: "button", text: "Enquiry " + j.reference, on: { click: () => showJobEnquiry(j.enquiryId) } })
            : h("span", { class: "op-muted", text: "No enquiry (yet) from this customer." })
        ),
        h("p", { class: "op-muted op-small", text: [j.error, j.detail, j.mayHaveBeenCharged ? "up to " + money(j.reserved, "USD") + " may have been charged" : ""].filter(Boolean).join(" · ") }),
        h("div", {}, h("button", { class: "btn btn-neutral btn-xs", type: "button", text: "Try again", on: { click: () => retryJob(j) } }))
      )
    )
  );
  $("op-jobs-empty").hidden = n > 0;
}

function switchTab(tab) {
  for (const b of document.querySelectorAll(".op-tab")) b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  $("op-view-enquiries").hidden = tab !== "enquiries";
  $("op-view-jobs").hidden = tab !== "jobs";
  $("op-view-costs").hidden = tab !== "costs";
  if (tab === "costs") loadCosts();
}

// ---------------------------------------------------------------------------
// costs and housekeeping

/** Calls to OpenAI in words: made, timed out (may have been charged), or failed. */
function renderCounts(calls) {
  const made = calls.ok || 0;
  const timedOut = calls.timeout || 0;
  const failed = Object.entries(calls).reduce((n, [k, v]) => (k === "ok" || k === "timeout" ? n : n + v), 0);
  const parts = [made + " made"];
  if (timedOut) parts.push(timedOut + " timed out (may have been charged)");
  if (failed) parts.push(failed + " failed");
  return made || timedOut || failed ? parts.join(", ") : "None";
}

const SWEEP_WORDS = [
  ["projectsDeleted", "projects deleted"],
  ["filesDeleted", "files deleted"],
  ["enquiriesDeleted", "enquiries deleted"],
  ["staleUploadsRemoved", "unfinished uploads removed"],
  ["renderFilesDeleted", "files of unused renders deleted"],
  ["enquiriesDelivered", "emails sent"],
  ["enquiriesUncertain", "emails marked uncertain"],
  ["rendersRun", "renders made"],
];

async function loadCosts() {
  const box = $("op-costs");
  if (!box.childElementCount) box.replaceChildren(h("p", { class: "op-empty op-muted", text: "Loading…" }));
  try {
    renderCosts(await api("GET", "operator/costs"));
  } catch (ex) {
    if (ex.status !== 401) box.replaceChildren(h("p", { class: "op-empty op-muted", text: ex.message }));
  }
}

function table(head, body) {
  return h(
    "div",
    { class: "op-table-wrap" },
    h("table", { class: "op-table" }, h("thead", {}, h("tr", {}, head.map((t) => h("th", { scope: "col", text: t })))), h("tbody", {}, body))
  );
}

function renderCosts(c) {
  const b = c.budget;
  const last = c.last30Days;
  const enq = last.enquiries;
  $("op-costs").replaceChildren(
    h(
      "div",
      { class: "op-grid-2" },
      h(
        "section",
        { class: "op-card" },
        h("h3", { text: "Today's render budget" }),
        h("p", { class: "op-big", text: money(b.spent + b.reserved, b.currency) + " of " + money(b.cap, b.currency) }),
        h("p", {
          class: "op-muted op-small",
          text: money(b.spent, b.currency) + " spent and " + money(b.reserved, b.currency) + " held for renders in progress or uncertain. Photo-real renders pause for the rest of the day (UTC) at the limit.",
        })
      ),
      h(
        "section",
        { class: "op-card" },
        h("h3", { text: "The last 30 days" }),
        kv([
          ["Enquiries", enq.total + (enq.total ? " (" + enq.emailed + " emailed" + (enq.emailProblems ? ", " + enq.emailProblems + " with email problems" : "") + ")" : "")],
          ["Photo-real renders", renderCounts(last.renderCalls)],
          ["Projects held now", c.held.projects + " (" + c.held.withPhoto + " with a photo)"],
        ]),
        last.byProvider.length
          ? table(
              ["Service", "Calls", "Cost (estimate)"],
              last.byProvider.map((x) => h("tr", {}, h("td", { text: PROVIDER_WORDS[x.provider] || x.provider }), h("td", { text: String(x.calls) }), h("td", { text: money(x.cost, x.currency) })))
            )
          : h("p", { class: "op-muted op-small", text: "No paid calls." })
      )
    ),
    h(
      "section",
      { class: "op-card" },
      h("h3", { text: "By month" }),
      c.byMonth.length
        ? table(
            ["Month (UTC)", "Service", "Calls", "Cost (estimate)"],
            c.byMonth.map((x) =>
              h("tr", {}, h("td", { text: x.month }), h("td", { text: PROVIDER_WORDS[x.provider] || x.provider }), h("td", { text: String(x.calls) }), h("td", { text: money(x.cost, x.currency) }))
            )
          )
        : h("p", { class: "op-muted op-small", text: "No paid calls in the last 12 months." }),
      h("p", { class: "op-caption", text: "Recorded at the time of each call, at the most it could cost; the providers' own bills are the final word." })
    ),
    sweepCard(c.lastSweep, c.retention)
  );
}

function sweepCard(s, r) {
  const card = h("section", { class: "op-card" }, h("h3", { text: "Daily tidy-up" }));
  if (s) {
    const d = s.detail || {};
    const done = SWEEP_WORDS.filter(([k]) => d[k]).map(([k, t]) => d[k] + " " + t);
    card.append(h("p", { class: "op-small", text: "Last ran " + when(s.at) + ". " + (done.length ? done.join(", ") + "." : "Nothing was due.") }));
  } else {
    card.append(h("p", { class: "op-small", text: "It hasn't run yet. It runs once a day on Vercel's schedule, once CRON_SECRET is set." }));
  }
  card.append(
    h("p", {
      class: "op-muted op-small",
      text:
        "Projects without an enquiry are deleted after " +
        r.projectDays +
        " days; enquiries and their projects after " +
        r.enquiryMonths +
        " months; files of renders that were never shown after " +
        r.unusedRenderFileDays +
        " days; this screen's history after " +
        r.operatorHistoryMonths +
        " months.",
    })
  );
  return card;
}

function showJobEnquiry(id) {
  switchTab("enquiries");
  openEnquiry(id);
}

// ---------------------------------------------------------------------------
// start

async function boot() {
  whenSignedOut((msg) => showLogin(msg));
  $("op-login-form").addEventListener("submit", onLogin);
  $("op-logout").addEventListener("click", logout);
  $("op-refresh").addEventListener("click", () => {
    refreshAll();
    if (!$("op-view-costs").hidden) loadCosts();
  });
  $("op-q").addEventListener("input", onSearch);
  $("op-search").addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(searchTimer);
    S.q = $("op-q").value.trim();
    loadList();
  });
  for (const b of document.querySelectorAll(".op-tab")) b.addEventListener("click", () => switchTab(b.dataset.tab));
  loadCatalogue()
    .then((c) => {
      S.products = c.byId;
      if (S.enquiries.length) renderList();
    })
    .catch(() => {});
  if (!getToken()) {
    showLogin("");
    return;
  }
  try {
    showApp(await api("GET", "operator/session"));
  } catch (ex) {
    if (ex.status !== 401) showLogin(ex.message);
  }
}

boot();
