// WV Roofing Roof Visualiser — step 5, the roof's size and materials (B2).
//
// Figures appear only from a measurement the roofer approved and made visible,
// and quantities only from products the roofer has verified; otherwise the step
// says why there are none and offers a survey. Whole m² and whole degrees only,
// always with the brief's disclaimer and what isn't included.
import { getEstimate } from "./client.js";

const $ = (s) => document.querySelector(s);
const NUM = new Intl.NumberFormat("en-GB");
const BRIEF_NOT_INCLUDED = ["ridges", "hips", "valleys", "verges", "flashings", "gutters", "fixings"];

const STATES = {
  unavailable: [
    "Suitable data unavailable",
    "We can't work out your roof's size or the materials it needs online yet: no licensed roof-measurement data is available for your area. The roofer measures the roof at a survey instead.",
  ],
  processing: ["Being checked", "The roofer has measurements for your roof and is checking them. The figures will appear here once they're confirmed."],
  measured_not_shown: ["Measured", "The roofer has measured your roof. The figures will be in your quotation."],
  indicative_available: ["Indicative estimate", ""],
};

const UNIT_WORDS = { tile: ["tile", "tiles"], slate: ["slate", "slates"] };
const EDGE_WORDS = { ridge: "Ridge", hip: "Hips", valley: "Valleys", eaves: "Eaves", verge: "Verges", abutment: "Abutments" };

function count(n, unit) {
  const w = UNIT_WORDS[unit] || [unit, unit + "s"];
  return NUM.format(n) + " " + (n === 1 ? w[0] : w[1]);
}

/** "a, b and c" */
function listWords(items) {
  return items.length <= 1 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

function li(text) {
  const el = document.createElement("li");
  el.textContent = text;
  return el;
}

function productLine(p) {
  const parts = [];
  if (p.total) {
    let t = p.name + ": about " + count(p.total.units, p.unit) + ", including a " + p.total.allowance_pct + "% allowance";
    if (p.total.pack_size > 1) t += " (" + NUM.format(p.total.packs) + " " + (p.total.pack_name || "pack") + (p.total.packs === 1 ? "" : "s") + " of " + NUM.format(p.total.pack_size) + ")";
    parts.push(t + ".");
  } else {
    parts.push(p.name + ": the quantity couldn't be worked out for your roof.");
  }
  for (const l of p.linear) parts.push((EDGE_WORDS[l.kind] || l.kind) + ": about " + NUM.format(l.units) + (l.product ? " " + l.product : "") + " for " + NUM.format(l.length_m) + " m.");
  if (p.total && !p.complete) parts.push("Part of your roof couldn't be estimated for this product, so the figure is incomplete.");
  if (p.warnings && p.warnings.length) parts.push("The roofer will check it suits your roof's pitch.");
  return parts.join(" ");
}

function notIncluded(items) {
  const list = items && items.length ? items : BRIEF_NOT_INCLUDED;
  $("#estimate-not-included").textContent = "Not included in this estimate: " + listWords(list) + ".";
}

function render(e, visualName) {
  const status = e && STATES[e.status] ? e.status : "unavailable";
  const [badge, text] = STATES[status];
  $("#estimate-badge").textContent = badge;
  const reason = $("#estimate-reason");
  const figures = $("#estimate-figures");
  if (status !== "indicative_available" || !e.measurement) {
    reason.textContent = text;
    reason.hidden = false;
    figures.hidden = true;
    notIncluded(e && e.not_included);
    return;
  }
  const m = e.measurement;
  reason.hidden = true;
  figures.hidden = false;
  const area = m.area_m2 === null ? "Roof area to be confirmed" : "About " + NUM.format(m.area_m2) + " m² of roof";
  $("#estimate-area").textContent = area + " (" + m.faces + (m.faces === 1 ? " roof face" : " roof faces") + (m.pitch ? ", pitch " + m.pitch : "") + ").";
  $("#estimate-source").textContent = m.label + ".";
  const items = e.products.length ? e.products.map((p) => li(productLine(p))) : [li("The roofer hasn't confirmed the materials for " + visualName + " yet, so there are no quantities for it.")];
  $("#estimate-products").replaceChildren(...items);
  const changes = $("#estimate-changes");
  changes.hidden = !m.changes_since_year;
  changes.textContent = m.changes_since_year ? "Any extensions or roof changes since " + m.changes_since_year + "? Please mention them in your enquiry." : "";
  notIncluded(e.not_included);
}

let seq = 0;

/**
 * The step is on screen: show the estimate for the chosen look (a sample house
 * or a photo without a project keeps the plain message).
 * @param {{ visualId: string | null, visualName: string }} o
 */
export async function showEstimate(o) {
  const mine = ++seq;
  let e = null;
  try {
    e = o.visualId ? await getEstimate(o.visualId) : null;
  } catch (err) {
    e = null;
  }
  if (mine !== seq) return; // a newer request has taken over
  render(e, o.visualName);
}
