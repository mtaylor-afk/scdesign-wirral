// WV Roofing operator screen — the roof measurement card (B3): the current
// measurement and what the customer would see, approve / reject / show or hide,
// the draft quantities for the enquiry's look, earlier measurements, the
// customer's plans and drawings, and the form for a new (or corrected) one.
import { api } from "./api.js";
import { h, kv, pill, when, shortDate } from "./dom.js";

export const METHOD_WORDS = {
  site_survey: "Site survey",
  drawings: "The property's drawings",
  customer_evidence: "Plans or photos from the customer",
  hover_report: "Hover report",
  desk_estimate: "Desk estimate",
};

const MEASURE_STATUS = {
  indicative_available: "Ready",
  needs_review: "Needs review",
  unavailable: "Rejected",
  processing: "Processing",
  awaiting_survey: "Awaiting survey",
};

export const MEASURE_REASONS = {
  no_rooftop_coordinate: "The address has no rooftop location",
  pitch_unknown: "A face in scope has no pitch",
  shared_roof: "The roof is shared (which part is this customer's?)",
  ambiguous_scope: "The scope is unclear",
  missing_faces: "A face in scope has no area",
  tree_cover: "Trees cover part of the roof",
  source_outdated: "The source is more than 5 years old",
  complex_geometry: "Complex roof shape",
  unreliable_pitch: "The pitch may be unreliable",
  licence_unresolved: "The data's licence doesn't allow this use",
  geography_unsupported: "Not available for this area",
  operator_rejected: "Rejected by the roofer",
};

const EDGE_KINDS = [
  ["ridge", "Ridge"],
  ["hip", "Hip"],
  ["valley", "Valley"],
  ["eaves", "Eaves"],
  ["verge", "Verge"],
  ["abutment", "Abutment"],
];

const LINE_WORDS = {
  ok: "ok",
  needs_pitch: "needs a pitch",
  below_min_pitch: "below the minimum pitch",
  outside_published_range: "outside the published table",
  no_area: "no area",
  excluded: "out of scope",
  no_verified_product: "not verified",
};

const NUM = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
const n2 = (v) => (v === null || v === undefined ? "–" : NUM.format(v));

function table(head, rows) {
  return h(
    "div",
    { class: "op-table-wrap" },
    h("table", { class: "op-table" }, h("thead", {}, h("tr", {}, head.map((t) => h("th", { scope: "col", text: t })))), h("tbody", {}, rows))
  );
}

/**
 * @param {object} e  the enquiry
 * @param {object} p  its project (with measurements, evidence, quantities)
 * @param {{ act: Function, confirmBox: Function, refresh: Function, productName: Function, status: Function }} ui
 */
export function measurementCard(e, p, ui) {
  const card = h("section", { class: "op-card", id: "op-measure" }, h("h3", { text: "Roof measurement" }));
  const current = p.measurements.find((m) => !m.supersededAt && !m.rejectedAt) || null;
  if (current) card.append(currentView(current, ui));
  else card.append(h("p", { class: "op-muted op-small", text: "Not measured yet. The customer sees that the roof is measured at a survey." }));
  if (current && p.quantities.length) card.append(quantitiesView(p.quantities, e, ui));
  const older = p.measurements.filter((m) => m !== current);
  if (older.length) {
    card.append(
      h("h4", { text: "Earlier measurements" }),
      table(
        ["Added", "Method", "Area", "Status"],
        older.map((m) =>
          h(
            "tr",
            { class: "is-old" },
            h("td", { text: when(m.createdAt) }),
            h("td", { text: METHOD_WORDS[m.method] || m.method }),
            h("td", { text: m.grossSurfaceM2 === null ? "–" : n2(m.grossSurfaceM2) + " m²" }),
            h("td", { text: m.rejectedAt ? "Rejected" : "Replaced" })
          )
        )
      )
    );
  }
  card.append(evidenceView(p, ui), entryForm(e, p, current, ui));
  return card;
}

function currentView(m, ui) {
  const wrap = h("div", { class: "op-measure-current" });
  const state = m.status === "needs_review" ? "warn" : m.status === "indicative_available" ? (m.approvedAt ? "good" : null) : "bad";
  const shown = m.approvedAt ? (m.customerVisible ? "Shown to the customer" : "Hidden from the customer") : "Not approved yet";
  wrap.append(
    h("p", { class: "op-flags" }, pill(MEASURE_STATUS[m.status] || m.status, state), pill(shown, m.customerVisible ? "good" : null)),
    kv([
      ["Method", (METHOD_WORDS[m.method] || m.method) + (m.sourceDate ? ", " + shortDate(m.sourceDate + "T12:00:00Z") + " " + m.sourceDate.slice(0, 4) : "")],
      ["Area", m.grossSurfaceM2 === null ? "Not complete" : n2(m.grossSurfaceM2) + " m² (the customer sees " + (m.shown.area_m2 === null ? "no area" : "about " + m.shown.area_m2 + " m²") + ")"],
      ["Pitch", m.shown.pitch],
      ["Check first", m.reasons.length ? m.reasons.map((r) => MEASURE_REASONS[r] || r).join("; ") : null],
      ["Customer's label", m.shown.label],
      ["Can be shown", m.canShow ? "Yes" : "No: the terms of " + m.showBlockedBy.join(" and ") + " don't allow it"],
      ["Notes", m.notes],
      ["Added", when(m.createdAt)],
    ]),
    table(
      ["Face", "Plan m²", "Pitch", "Surface m²", "In scope"],
      m.faces.map((f) =>
        h(
          "tr",
          { class: f.included ? null : "is-old" },
          h("td", { text: f.id + (f.flags && f.flags.length ? " (" + f.flags.join(", ") + ")" : "") }),
          h("td", { text: n2(f.plan_area_m2) }),
          h("td", { text: f.pitch_deg === null ? "–" : n2(f.pitch_deg) + "°" }),
          h("td", { text: n2(f.surface_area_m2) + (f.slope_adjusted_by_source ? " (as given)" : "") }),
          h("td", { text: f.included ? "Yes" : "No" })
        )
      )
    )
  );
  if (m.edges.length) wrap.append(table(["Edge", "Kind", "Length m"], m.edges.map((x) => h("tr", {}, h("td", { text: x.id }), h("td", { text: x.kind }), h("td", { text: n2(x.length_m) })))));
  const actions = h("div", { class: "op-actions" });
  if (!m.approvedAt) {
    actions.append(
      h("button", {
        class: "btn btn-primary btn-sm",
        type: "button",
        text: "Approve",
        on: { click: () => approve(m, ui) },
      })
    );
  } else if (m.canShow) {
    actions.append(
      h("button", {
        class: "btn btn-neutral btn-sm",
        type: "button",
        text: m.customerVisible ? "Hide from the customer" : "Show to the customer",
        on: { click: () => ui.act(() => api("POST", "operator/measurements/" + m.id + "/visibility", { visible: !m.customerVisible }), m.customerVisible ? "Hidden from the customer." : "Shown to the customer.", true) },
      })
    );
  }
  actions.append(h("button", { class: "btn btn-neutral btn-sm", type: "button", text: "Reject", on: { click: () => reject(m, ui) } }));
  wrap.append(actions);
  return wrap;
}

async function approve(m, ui) {
  if (m.reasons.length) {
    const ok = await ui.confirmBox("Approve this measurement?", "It was flagged for: " + m.reasons.map((r) => MEASURE_REASONS[r] || r).join("; ") + ".\n\nApprove only once you've checked these.", "Approve");
    if (!ok) return;
  }
  const shows = m.canShow ? " It's now shown to the customer." : " It stays hidden: the customer is told the figures come with the quotation.";
  await ui.act(() => api("POST", "operator/measurements/" + m.id + "/approve", { confirm: true }), "Measurement approved." + shows, true);
}

async function reject(m, ui) {
  const ok = await ui.confirmBox("Reject this measurement?", "The customer won't see it. It's kept in the history; add a new measurement to replace it.", "Reject", true);
  if (!ok) return;
  await ui.act(() => api("POST", "operator/measurements/" + m.id + "/reject", {}), "Measurement rejected.", true);
}

function quantitiesView(list, e, ui) {
  return h(
    "div",
    { class: "op-measure-quantities" },
    h("h4", { text: "Quantities for " + (ui.productName(e.roof) || "the chosen roof") }),
    table(
      ["Product", "Figures", "Estimate", "Faces"],
      list.map((q) =>
        h(
          "tr",
          {},
          h("td", { text: q.product_name }),
          h("td", {}, pill(q.spec_status === "verified" ? "Verified" : "Draft", q.spec_status === "verified" ? "good" : "warn")),
          h("td", {
            text: q.total ? NUM.format(q.total.units) + " " + q.unit + "s (" + q.total.allowance_pct + "% allowance)" + (q.linear.length ? "; " + q.linear.map((l) => l.kind + " " + l.units).join(", ") : "") : "–",
          }),
          h("td", { text: q.lines.map((l) => l.face_id + ": " + (LINE_WORDS[l.status] || l.status)).join("; ") + (q.warnings.length ? ". " + q.warnings.join(" ") : "") })
        )
      )
    ),
    h("p", { class: "op-caption", text: "Draft figures come from the manufacturers' datasheets and aren't shown to customers until you verify the product." })
  );
}

function evidenceView(p, ui) {
  const box = h("div", { class: "op-measure-evidence" }, h("h4", { text: "The customer's plans and drawings" }));
  if (!p.evidence.length) {
    box.append(h("p", { class: "op-muted op-small", text: "None added." }));
    return box;
  }
  const links = h("span", { class: "op-small" });
  box.append(
    h(
      "ul",
      { class: "op-evidence" },
      p.evidence.map((f) =>
        h(
          "li",
          {},
          h("span", { text: (f.kind === "pdf" ? "PDF" : "Photo") + ", " + NUM.format(Math.round(f.bytes / 1024)) + " KB, added " + when(f.addedAt) + " " }),
          h("button", {
            class: "op-linklike",
            type: "button",
            text: "Open",
            on: {
              click: async () => {
                const r = await ui.act(() => api("GET", "operator/evidence/" + f.id));
                if (r) links.replaceChildren(h("a", { href: r.url, target: "_blank", rel: "noopener noreferrer", text: "Open the file (this link works for 5 minutes)" }));
              },
            },
          })
        )
      )
    ),
    links
  );
  return box;
}

// ---------------------------------------------------------------------------
// the entry form

function faceRow(f) {
  const v = f || {};
  const input = (name, value, label, attrs) => h("input", Object.assign({ class: "op-input", name, value: value === undefined || value === null ? "" : String(value), "aria-label": label, inputmode: "decimal" }, attrs || {}));
  return h(
    "tr",
    { class: "op-face-row" },
    h("td", {}, input("id", v.id || "", "Face name", { inputmode: null, maxlength: "32" })),
    h("td", {}, input("plan", v.plan_area_m2, "Plan area, m²")),
    h("td", {}, input("pitch", v.pitch_deg, "Pitch, degrees")),
    h("td", {}, input("surface", v.slope_adjusted_by_source ? v.surface_area_m2 : "", "Area on the slope, m², if the source gives it")),
    h("td", {}, h("input", { type: "checkbox", name: "included", checked: v.included !== false, "aria-label": "In scope" })),
    h("td", {}, h("button", { class: "op-linklike", type: "button", text: "Remove", on: { click: (ev) => ev.currentTarget.closest("tr").remove() } }))
  );
}

function edgeRow(x) {
  const v = x || {};
  return h(
    "tr",
    { class: "op-edge-row" },
    h("td", {}, h("select", { class: "op-input", name: "kind", "aria-label": "Kind" }, EDGE_KINDS.map(([k, t]) => h("option", { value: k, text: t, selected: v.kind === k })))),
    h("td", {}, h("input", { class: "op-input", name: "length", value: v.length_m === undefined ? "" : String(v.length_m), inputmode: "decimal", "aria-label": "Length, m" })),
    h("td", {}, h("button", { class: "op-linklike", type: "button", text: "Remove", on: { click: (ev) => ev.currentTarget.closest("tr").remove() } }))
  );
}

const num = (s) => {
  const t = String(s || "").trim();
  return t === "" ? null : Number(t);
};

function entryForm(e, p, current, ui) {
  const details = h("details", { class: "op-measure-entry" }, h("summary", { text: current ? "Correct it with a new measurement" : "Add a measurement" }));
  const method = h("select", { class: "select", id: "op-m-method" }, Object.entries(METHOD_WORDS).map(([k, t]) => h("option", { value: k, text: t })));
  const date = h("input", { class: "op-input", id: "op-m-date", type: "date", value: new Date().toISOString().slice(0, 10) });
  const faces = h("tbody", {}, current ? current.faces.map(faceRow) : [faceRow({ id: "front" }), faceRow({ id: "back" })]);
  const edges = h("tbody", {}, current ? current.edges.map(edgeRow) : []);
  const manual = h(
    "div",
    { class: "op-m-manual" },
    h("h4", { text: "Roof faces" }),
    h("p", { class: "op-muted op-small", text: "Give each face its plan area and pitch, or the area on the slope if the source gives it (that's never adjusted again). Leave a value empty if it isn't known." }),
    h("div", { class: "op-table-wrap" }, h("table", { class: "op-table op-entry" }, h("thead", {}, h("tr", {}, ["Face", "Plan m²", "Pitch °", "On slope m²", "In scope", ""].map((t) => h("th", { scope: "col", text: t })))), faces)),
    h("button", { class: "btn btn-neutral btn-xs", type: "button", text: "Add a face", on: { click: () => faces.append(faceRow({ id: "face-" + (faces.rows.length + 1) })) } }),
    h("h4", { text: "Edge lengths (optional)" }),
    h("p", { class: "op-muted op-small", text: "Only lengths you've measured: they're never worked out from the areas." }),
    h("div", { class: "op-table-wrap" }, h("table", { class: "op-table op-entry" }, h("thead", {}, h("tr", {}, ["Kind", "Length m", ""].map((t) => h("th", { scope: "col", text: t })))), edges)),
    h("button", { class: "btn btn-neutral btn-xs", type: "button", text: "Add an edge", on: { click: () => edges.append(edgeRow({ kind: "ridge" })) } })
  );
  const hv = (name, label, hint) => h("label", { class: "op-hover-field" }, h("span", { text: label }), h("input", { class: "op-input", name, inputmode: "decimal", placeholder: hint || "" }));
  const hoverUnits = h("select", { class: "select", name: "units", "aria-label": "Units" }, [h("option", { value: "metric", text: "Metric (m, m²)" }), h("option", { value: "imperial", text: "Imperial (ft, ft²)" })]);
  const hover = h(
    "div",
    { class: "op-m-hover", hidden: true },
    h("h4", { text: "From the Hover report's summary" }),
    h("p", { class: "op-muted op-small", text: "The report's total roof area is on the slope. Its figures stay hidden from the customer (Hover's terms allow internal use only)." }),
    h("div", { class: "op-hover-grid" }, h("label", { class: "op-hover-field" }, h("span", { text: "Units" }), hoverUnits), hv("total_area", "Total roof area"), hv("pitch", "Pitch", "35 or 8/12"), hv("ridges", "Ridges"), hv("hips", "Hips"), hv("valleys", "Valleys"), hv("rakes", "Rakes (verges)"), hv("eaves", "Eaves"), hv("flashing", "Flashing"))
  );
  method.addEventListener("change", () => {
    const isHover = method.value === "hover_report";
    hover.hidden = !isHover;
    manual.hidden = isHover;
  });
  const evidence = p.evidence.length
    ? h(
        "fieldset",
        { class: "op-m-evidence" },
        h("legend", { text: "Measured from these files (optional)" }),
        p.evidence.map((f) => h("label", { class: "op-check" }, h("input", { type: "checkbox", name: "evidence", value: f.id }), " " + (f.kind === "pdf" ? "PDF" : "Photo") + " added " + when(f.addedAt)))
      )
    : null;
  const notes = h("textarea", { class: "textarea", id: "op-m-notes", rows: "2", maxlength: "1000", placeholder: "Anything the next person should know" });
  const err = h("div", { class: "field-error", role: "alert", hidden: true });
  const save = h("button", { class: "btn btn-primary btn-sm", type: "submit", text: "Save the measurement" });
  const form = h(
    "form",
    { class: "op-form op-measure-form" },
    h("label", { class: "op-label", for: "op-m-method", text: "How it was measured" }),
    method,
    h("label", { class: "op-label", for: "op-m-date", text: "Date measured" }),
    date,
    manual,
    hover,
    evidence,
    h("label", { class: "op-label", for: "op-m-notes", text: "Notes (optional)" }),
    notes,
    err,
    save
  );
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    err.hidden = true;
    const body = { method: method.value, sourceDate: date.value || null, notes: notes.value, evidence: [...form.querySelectorAll('input[name="evidence"]:checked')].map((x) => x.value) };
    if (method.value === "hover_report") {
      const get = (n) => hover.querySelector('[name="' + n + '"]').value;
      body.hover = { units: hoverUnits.value, total_area: get("total_area"), pitch: get("pitch"), ridges: get("ridges"), hips: get("hips"), valleys: get("valleys"), rakes: get("rakes"), eaves: get("eaves"), flashing: get("flashing") };
    } else {
      body.faces = [...faces.rows].map((r) => {
        const val = (n) => r.querySelector('[name="' + n + '"]');
        const surface = num(val("surface").value);
        return { id: val("id").value.trim(), plan_area_m2: num(val("plan").value), pitch_deg: num(val("pitch").value), surface_area_m2: surface, slope_adjusted_by_source: surface !== null, included: val("included").checked };
      });
      body.edges = [...edges.rows].map((r, i) => ({ id: "edge-" + (i + 1), kind: r.querySelector('[name="kind"]').value, length_m: num(r.querySelector('[name="length"]').value) })).filter((x) => x.length_m !== null);
    }
    save.disabled = true;
    try {
      await api("POST", "operator/enquiries/" + e.id + "/measurement", body);
      ui.status("Measurement saved for " + e.reference + ". Approve it when you've checked it.");
      await ui.refresh();
    } catch (ex) {
      if (ex.status === 401) return;
      err.textContent = ex.message + (ex.problems && ex.problems.length ? " " + ex.problems.join("; ") + "." : "");
      err.hidden = false;
      save.disabled = false;
    }
  });
  details.append(form);
  return details;
}
