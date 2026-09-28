// WV Roofing Roof Visualiser — the six steps and moving between them.
//
// Each step change is a History API entry (?step=...), so the browser's and
// Android's Back button walk back through the steps. The project id rides in
// the URL too (?project=...) so a refresh resumes where the customer was; the
// project's key stays in sessionStorage, never in the URL.
export const STEPS = ["property", "photo", "mark", "compare", "estimate", "enquiry"];
const NAMES = {
  property: "Your home",
  photo: "Photo",
  mark: "Mark roof",
  compare: "Compare",
  estimate: "Estimate",
  enquiry: "Send",
};

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

let current = "";
let guard = () => true;
let onShow = () => {};

/**
 * @param {{ canShow: (step: string) => boolean, onShow?: (step: string) => void }} o
 *   canShow: whether a step can be shown now (e.g. "mark" needs a photo)
 */
export function initJourney(o) {
  guard = o.canShow;
  onShow = o.onShow || onShow;
  window.addEventListener("popstate", () => {
    const want = stepFromUrl();
    show(guard(want) ? want : furthestAllowed(), { history: "none" });
  });
}

export function currentStep() {
  return current;
}

export function stepFromUrl() {
  const s = new URLSearchParams(window.location.search).get("step");
  return STEPS.includes(s) ? s : "property";
}

/** The furthest step that can be shown now (for Back into a step that no longer applies). */
export function furthestAllowed() {
  for (let i = STEPS.length - 1; i >= 0; i--) if (guard(STEPS[i]) && STEPS[i] !== "estimate" && STEPS[i] !== "enquiry") return STEPS[i];
  return "property";
}

/** Put a query parameter in the URL without adding a history entry (null removes it). */
export function setParam(name, value) {
  const u = new URL(window.location.href);
  if (value === null || value === undefined || value === "") u.searchParams.delete(name);
  else u.searchParams.set(name, value);
  window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
}

/**
 * Show a step.
 * @param {string} step
 * @param {{ history?: "push" | "replace" | "none", focus?: boolean }} [opts]
 */
export function show(step, opts) {
  const o = opts || {};
  if (!STEPS.includes(step)) step = "property";
  const mode = o.history || "push";
  if (mode !== "none") {
    const u = new URL(window.location.href);
    u.searchParams.set("step", step);
    const url = u.pathname + u.search + u.hash;
    if (mode === "push" && step !== current) window.history.pushState({ step }, "", url);
    else window.history.replaceState({ step }, "", url);
  }
  current = step;
  $$("[data-panel]").forEach((p) => {
    p.hidden = p.dataset.panel !== step;
  });
  const idx = STEPS.indexOf(step);
  $$(".vis-steps li").forEach((li) => {
    const i = STEPS.indexOf(li.dataset.step);
    if (i === idx) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
    li.classList.toggle("is-done", i < idx);
  });
  const count = $("#vis-step-count");
  if (count) count.textContent = "Step " + (idx + 1) + " of " + STEPS.length + ": " + NAMES[step];
  const steps = $(".vis-steps");
  if (steps) {
    const top = steps.getBoundingClientRect().top + window.scrollY - 90;
    if (window.scrollY > top + 40 || window.scrollY < top - 400) window.scrollTo({ top, behavior: "smooth" });
  }
  if (o.focus !== false) {
    const h = $('[data-panel="' + step + '"] .vis-h');
    if (h) {
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
    }
  }
  onShow(step);
}
