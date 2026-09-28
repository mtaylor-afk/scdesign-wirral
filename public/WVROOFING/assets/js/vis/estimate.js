// WV Roofing Roof Visualiser — step 5, the roof's size and materials (B2).
//
// Figures appear only from a measurement the roofer approved and made visible,
// and quantities only from products the roofer has verified; otherwise the step
// says why there are none and offers a survey. Whole m² and whole degrees only,
// always with the brief's disclaimer and what isn't included.
import { getEstimate, uploadEvidence, listEvidence, deleteEvidence, sniffFile, ClientError } from "./client.js";

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
    const outside = e && e.automatic && e.automatic.reasons.includes("geography_unsupported");
    reason.textContent = text + (outside ? " Your address also looks to be outside the Wirral and Liverpool, the areas we cover." : "");
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
  const none =
    e.reason === "no_look_chosen"
      ? "Choose a roof in the comparison to see the materials it would need."
      : "The roofer hasn't confirmed the materials for " + visualName + " yet, so there are no quantities for it.";
  const items = e.products.length ? e.products.map((p) => li(productLine(p))) : [li(none)];
  $("#estimate-products").replaceChildren(...items);
  // Only worth asking when the measurement comes from an earlier year.
  const older = m.changes_since_year && m.changes_since_year < new Date().getFullYear();
  const changes = $("#estimate-changes");
  changes.hidden = !older;
  changes.textContent = older ? "Any extensions or roof changes since " + m.changes_since_year + "? Please mention them in your enquiry." : "";
  notIncluded(e.not_included);
}

// ---------------------------------------------------------------------------
// plans, drawings and extra photos for the roofer to measure from (B3)

const FILE_TYPES = { jpeg: "image/jpeg", png: "image/png", pdf: "application/pdf" };
const MAX_FILE = 20 * 1024 * 1024;
let evidenceWired = false;

async function fileKind(file) {
  const b = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...b) === "%PDF-") return "pdf";
  return sniffFile(file);
}

async function renderFiles() {
  let files = [];
  try {
    files = await listEvidence();
  } catch (err) {
    files = [];
  }
  $("#evidence-list").replaceChildren(
    ...files.map((f) => {
      const item = li((f.kind === "pdf" ? "PDF" : "Photo") + ", " + NUM.format(Math.max(1, Math.round(f.bytes / 1024))) + " KB ");
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "link-btn";
      remove.textContent = "Remove";
      remove.addEventListener("click", async () => {
        remove.disabled = true;
        try {
          await deleteEvidence(f.id);
          await renderFiles();
        } catch (err) {
          remove.disabled = false;
        }
      });
      item.append(remove);
      return item;
    })
  );
}

async function onFile(e) {
  const input = e.currentTarget;
  const file = input.files && input.files[0];
  input.value = "";
  if (!file) return;
  const status = $("#evidence-status");
  const kind = await fileKind(file);
  if (kind === "heic") {
    status.textContent = "That's a HEIC photo, which can't be read here. On an iPhone, set the camera to Most Compatible, or send a JPG.";
    return;
  }
  if (!FILE_TYPES[kind]) {
    status.textContent = "Please choose a JPG, PNG or PDF file.";
    return;
  }
  if (file.size > MAX_FILE) {
    status.textContent = "That file is over 20 MB. Please choose a smaller copy.";
    return;
  }
  const btn = $("#btn-evidence");
  btn.disabled = true;
  status.textContent = "Uploading…";
  try {
    await uploadEvidence(file, FILE_TYPES[kind], (f) => {
      status.textContent = "Uploading… " + Math.round(f * 100) + "%";
    });
    status.textContent = "Added. Send your enquiry and the roofer will see it with your photo.";
    await renderFiles();
  } catch (err) {
    status.textContent = err instanceof ClientError && err.message ? err.message : "That file couldn't be added. Please try again.";
  } finally {
    btn.disabled = false;
  }
}

function showFiles(canAdd) {
  $("#estimate-evidence").hidden = !canAdd;
  if (!canAdd) return;
  if (!evidenceWired) {
    evidenceWired = true;
    $("#btn-evidence").addEventListener("click", () => $("#evidence-file").click());
    $("#evidence-file").addEventListener("change", onFile);
  }
  renderFiles();
}

let seq = 0;

/**
 * The step is on screen: show the estimate for the chosen look (a sample house
 * or a photo without a project keeps the plain message), and, for the
 * customer's own project, a place to add plans and drawings.
 * @param {{ visualId: string | null, visualName: string, canAddFiles?: boolean }} o
 */
export async function showEstimate(o) {
  showFiles(!!o.canAddFiles);
  const mine = ++seq;
  let e = null;
  try {
    e = await getEstimate(o.visualId);
  } catch (err) {
    e = null;
  }
  if (mine !== seq) return; // a newer request has taken over
  render(e, o.visualName);
}
