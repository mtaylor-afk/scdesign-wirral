// WV Roofing Roof Visualiser — step 1, the customer's home: postcode, address
// (or typed in), the satellite view with a pin only where the location is
// rooftop-accurate, "is the pin on your house?", and the kind of property.
// "Photo only" skips all of it. Nothing here is required to use the visualiser.
import { lookupAddress, chooseAddress, clearAddress, propertyView, confirmProperty, ClientError } from "./client.js";

const $ = (s, r) => (r || document).querySelector(s);

const T = {
  address: null,
  property: null,
  view: null,
  viewFor: "",
  canSave: true,
  canSearch: true,
  ensureProject: async () => null,
  next: () => {},
  announce: () => {},
  onChange: () => {},
};

function showErr(el, msg) {
  el.textContent = msg || "";
  el.hidden = !msg;
}

function checked(name) {
  const el = document.querySelector('input[name="' + name + '"]:checked');
  return el ? el.value : "";
}

function setChecked(name, value) {
  document.querySelectorAll('input[name="' + name + '"]').forEach((el) => {
    el.checked = el.value === value;
  });
}

function message(err, fallback) {
  return err instanceof ClientError && err.message ? err.message : fallback;
}

/**
 * Run fn with a project. If the project this tab remembered has gone (deleted,
 * expired, or from an older session), its key is forgotten: start a new
 * project and try once more.
 */
async function withProject(fn) {
  await T.ensureProject();
  try {
    return await fn();
  } catch (ex) {
    if (!(ex instanceof ClientError) || ex.code !== "project_not_found") throw ex;
    await T.ensureProject();
    return fn();
  }
}

/**
 * @param {{ caps: object, ensureProject: () => Promise<object>, next: (withAddress: boolean) => void,
 *           announce: (msg: string) => void, onChange: () => void }} o
 */
export function initProperty(o) {
  Object.assign(T, o);
  const caps = o.caps || {};
  const state = (name) => (caps[name] && caps[name].state) || "implemented";
  T.canSave = state("enquiry_storage") === "enabled";
  T.canSearch = T.canSave && state("address_lookup") === "enabled";
  if (!T.canSave) {
    $(".property-card").hidden = true;
    $("#address-notice").hidden = true;
    $("#cap-line").textContent =
      "Saving an address isn't switched on in this preview yet. You can still try the visualiser with a photo, or one of our sample houses.";
  } else if (!T.canSearch) {
    $("#postcode-form").hidden = true;
    $("#manual-form").hidden = false;
    $("#manual-note").textContent = "Address search isn't switched on yet, so please type your address.";
  }
  $("#postcode-form").addEventListener("submit", onLookup);
  $("#addr-not-listed").addEventListener("click", showManual);
  $("#manual-form").addEventListener("submit", onManual);
  $("#addr-change").addEventListener("click", onChangeAddress);
  $("#btn-property-next").addEventListener("click", onContinue);
  $("#btn-photo-only").addEventListener("click", () => T.next(false));
  $("#ptype").addEventListener("change", () => showErr($("#ptype-err"), ""));
}

async function onLookup(e) {
  e.preventDefault();
  const input = $("#pc-input");
  const err = $("#pc-err");
  showErr(err, "");
  if (!input.value.trim()) {
    showErr(err, "Please enter your postcode.");
    input.focus();
    return;
  }
  const btn = $("#pc-find");
  btn.disabled = true;
  try {
    const r = await withProject(() => lookupAddress(input.value));
    renderList(r);
  } catch (ex) {
    showErr(err, message(ex, "Address search isn't available right now. You can type your address instead."));
    if (!(ex instanceof ClientError) || ex.code !== "invalid_postcode") {
      $("#address-pick").hidden = false;
      $("#address-list").replaceChildren();
      $("#address-count").textContent = "";
    }
  } finally {
    btn.disabled = false;
  }
}

function renderList(r) {
  const ul = $("#address-list");
  const frag = document.createDocumentFragment();
  for (const a of r.addresses) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    const label = document.createElement("span");
    label.textContent = a.label;
    b.appendChild(label);
    if (a.newBuild) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "New build";
      b.appendChild(badge);
    }
    b.addEventListener("click", () => pick(a));
    li.appendChild(b);
    frag.appendChild(li);
  }
  ul.replaceChildren(frag);
  $("#address-count").textContent = r.addresses.length + " address" + (r.addresses.length === 1 ? "" : "es") + " at " + r.postcode + ". Choose yours.";
  $("#address-pick").hidden = false;
  T.announce(r.addresses.length + " addresses found.");
  const first = ul.querySelector("button");
  if (first) first.focus();
}

async function pick(a) {
  try {
    const address = await chooseAddress({ token: a.token });
    setChosen(address, null);
    await loadView();
  } catch (ex) {
    showErr($("#pc-err"), message(ex, "That address couldn't be saved. Please try again."));
  }
}

function showManual() {
  $("#manual-form").hidden = false;
  $("#ma-postcode").value = $("#pc-input").value.trim();
  $("#ma-line1").focus();
}

async function onManual(e) {
  e.preventDefault();
  const f = e.currentTarget;
  const line1 = $("#ma-line1").value.trim();
  const town = $("#ma-town").value.trim();
  showErr($("#ma-line1-err"), line1.length < 2 ? "Please enter the house number and street." : "");
  showErr($("#ma-town-err"), town.length < 2 ? "Please enter the town." : "");
  showErr($("#ma-postcode-err"), "");
  if (line1.length < 2 || town.length < 2) return;
  try {
    const manual = { line1, line2: $("#ma-line2").value.trim(), town, postcode: $("#ma-postcode").value.trim() };
    const address = await withProject(() => chooseAddress({ manual }));
    f.reset();
    setChosen(address, null);
    await loadView();
  } catch (ex) {
    if (ex instanceof ClientError && ex.code === "invalid_fields") showErr($("#ma-postcode-err"), "Please check the postcode (for example CH45 1AB), or leave it out.");
    else showErr($("#ma-postcode-err"), message(ex, "That address couldn't be saved. Please try again."));
  }
}

async function onChangeAddress() {
  try {
    await clearAddress();
  } catch (ex) {
    /* the next address replaces it anyway */
  }
  resetProperty();
  T.onChange();
  $("#pc-input").focus();
}

function setChosen(address, property) {
  T.address = address;
  T.property = property;
  $("#postcode-form").hidden = true;
  $("#address-pick").hidden = true;
  $("#manual-form").hidden = true;
  $("#address-chosen").hidden = false;
  $("#address-label").textContent = address.label + (address.postcode && !address.label.includes(address.postcode) ? ", " + address.postcode : "");
  $("#address-newbuild").hidden = !address.newBuild;
  setChecked("ptype", property ? property.propertyType : "");
  setChecked("pin", property ? (property.pinConfirmed ? "yes" : "no") : "");
  $("#btn-property-next").hidden = false;
  $("#btn-photo-only").hidden = true;
  T.onChange();
}

async function loadView() {
  if (!T.address) return;
  if (T.view && T.viewFor === T.address.label) return renderView(T.view);
  let v;
  try {
    v = await propertyView();
  } catch (ex) {
    v = { available: false, reason: ex instanceof ClientError && ex.status === 429 ? "limited" : "error" };
  }
  T.view = v;
  T.viewFor = T.address.label;
  renderView(v);
}

const REASONS = {
  not_configured: "The satellite view isn't switched on yet.",
  no_coordinates: "We don't have a map location for this address, so there's no satellite view.",
  limited: "The satellite view has reached its limit for today.",
  error: "The satellite view couldn't be loaded.",
};

function renderView(v) {
  const fig = $("#aerial");
  const note = $("#aerial-note");
  if (v.available) {
    $("#aerial-img").src = v.url;
    $("#aerial-caption").textContent = v.attribution + (v.pin ? "" : ". There's no pin: we only know the postcode's area for this address.");
    fig.hidden = false;
    note.hidden = true;
    $("#pin-q").hidden = !v.pin;
  } else {
    fig.hidden = true;
    $("#pin-q").hidden = true;
    note.hidden = false;
    note.textContent = REASONS[v.reason] || REASONS.error;
  }
}

async function onContinue() {
  const type = checked("ptype");
  if (!type) {
    showErr($("#ptype-err"), "Please choose the kind of property (or \"Not sure\").");
    const first = $('input[name="ptype"]');
    if (first) first.focus();
    return;
  }
  const btn = $("#btn-property-next");
  btn.disabled = true;
  try {
    T.property = await confirmProperty({ propertyType: type, pinConfirmed: checked("pin") === "yes" });
    T.onChange();
    T.next(true);
  } catch (ex) {
    showErr($("#ptype-err"), message(ex, "That couldn't be saved. Please try again."));
  } finally {
    btn.disabled = false;
  }
}

/** Put back what the project already holds (after a refresh). */
export function restoreProperty(address, property) {
  if (address) setChosen(address, property);
}

/** The step is on screen: show the satellite view (fetched once per page and address). */
export function propertyShown() {
  if (T.address) loadView();
}

export function propertyState() {
  return { address: T.address, property: T.property };
}

/** Back to an empty step (a new project, or the address removed). */
export function resetProperty() {
  T.address = null;
  T.property = null;
  T.view = null;
  T.viewFor = "";
  $("#address-chosen").hidden = true;
  $("#address-pick").hidden = true;
  $("#aerial").hidden = true;
  $("#aerial-note").hidden = true;
  $("#pin-q").hidden = true;
  setChecked("ptype", "");
  setChecked("pin", "");
  $("#btn-property-next").hidden = true;
  $("#btn-photo-only").hidden = false;
  if (T.canSearch) {
    $("#postcode-form").hidden = false;
    $("#manual-form").hidden = true;
  } else if (T.canSave) {
    $("#manual-form").hidden = false;
  }
}
