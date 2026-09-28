// WV Roofing — quote request form (roof-replacement page + visualiser dialog).
//
// Enquiries are saved on the server before anyone is emailed, and each gets a
// reference. The request key is kept in sessionStorage until the enquiry is
// saved, so sending again after a lost connection or a reload returns the same
// enquiry instead of making a second one.
import { API_BASE } from "./config.js";
import { loadCatalogue } from "./catalogue.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\d\s-]{7,20}$/;
const POSTCODE_RE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/;
const KEY_PREFIX = "wvr.enquiry-key.";

function randomKey() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** The request key for this form, kept until the enquiry is saved. */
function requestKey(source) {
  try {
    let k = sessionStorage.getItem(KEY_PREFIX + source);
    if (!k) {
      k = randomKey();
      sessionStorage.setItem(KEY_PREFIX + source, k);
    }
    return k;
  } catch (err) {
    return randomKey(); // storage blocked: still one key per attempt
  }
}

function forgetKey(source) {
  try {
    sessionStorage.removeItem(KEY_PREFIX + source);
  } catch (err) {
    /* nothing kept */
  }
}

/** Send an enquiry that isn't about an uploaded photo. Resolves with { status, json }. */
export async function sendEnquiry(payload) {
  const res = await fetch(API_BASE + "/api/wvroofing/enquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

/** What the customer is told once the enquiry is saved (always the truth about who's been told). */
export function savedMessage(name, json) {
  const first = name ? ", " + name.split(" ")[0] : "";
  if (!json.reference) return "Thank you" + first + " - your request has been sent.";
  const saved = (json.existing ? "You've already sent us this enquiry" + first + ". " : "Thank you" + first + ". Your enquiry is saved. ") + "Your reference is " + json.reference + ". ";
  if (json.delivery === "sent") return saved + "The roofer has been notified and will be in touch.";
  if (json.delivery === "pending") return saved + "We're notifying the roofer; your enquiry is safely stored.";
  return saved + "WV Roofing is a concept site, so no one is being notified yet, but your enquiry is stored safely.";
}

function field(form, name) {
  return form.elements.namedItem(name);
}

function value(form, name) {
  const el = field(form, name);
  if (!el) return "";
  if (el.type === "checkbox") return el.checked;
  return String(el.value || "").trim();
}

function setError(form, name, message) {
  const el = field(form, name);
  const out = form.querySelector('[data-error-for="' + name + '"]');
  if (el && el.setAttribute) {
    if (message) el.setAttribute("aria-invalid", "true");
    else el.removeAttribute("aria-invalid");
  }
  if (out) {
    out.textContent = message || "";
    out.hidden = !message;
  }
}

function showStatus(form, kind, message) {
  const box = form.querySelector(".form-status");
  if (!box) return;
  box.dataset.kind = kind;
  box.textContent = message;
  box.hidden = false;
}

/** Fill the "Which roof?" select from the catalogue and pre-select one. */
export async function fillProductSelect(select, selectedId) {
  if (!select) return;
  try {
    const cat = await loadCatalogue();
    const keep = select.querySelector('option[value=""]');
    select.replaceChildren();
    if (keep) select.appendChild(keep);
    for (const p of cat.visuals) {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name + " - " + p.colourName;
      select.appendChild(o);
    }
    const unsure = document.createElement("option");
    unsure.value = "not-sure";
    unsure.textContent = "Not sure yet - advise me";
    select.appendChild(unsure);
    if (selectedId) select.value = selectedId;
  } catch (err) {
    /* leave the static options */
  }
}

/**
 * @param {HTMLFormElement} form
 * @param {{getContext?: () => Promise<object>|object, send?: (payload: object) => Promise<{status:number, json:object}>, onSent?: (json: object) => void}} [opts]
 *   send: how to deliver the enquiry (default: the plain enquiries endpoint)
 */
export function wireEnquiryForm(form, opts) {
  opts = opts || {};
  if (form.dataset.wired) return;
  form.dataset.wired = "1";
  let started = Date.now();
  const select = field(form, "product");
  const urlTile = new URLSearchParams(window.location.search).get("tile");
  if (select && select.dataset.fill === "catalogue") fillProductSelect(select, urlTile);

  form.addEventListener("focusin", () => {
    if (!form.dataset.touched) {
      form.dataset.touched = "1";
      started = Date.now();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    ["name", "phone", "email", "postcode", "consent"].forEach((n) => setError(form, n, ""));

    const data = {
      name: value(form, "name"),
      phone: value(form, "phone"),
      email: value(form, "email"),
      postcode: value(form, "postcode"),
      product: value(form, "product"),
      message: value(form, "message"),
      consent: value(form, "consent") === true,
    };

    const errors = [];
    if (data.name.length < 2) errors.push(["name", "Please tell us your name."]);
    if (!data.phone && !data.email) errors.push(["phone", "Please give a phone number or an email address."]);
    if (data.phone && !PHONE_RE.test(data.phone)) errors.push(["phone", "That phone number doesn't look right."]);
    if (data.email && !EMAIL_RE.test(data.email)) errors.push(["email", "That email address doesn't look right."]);
    if (data.postcode && !POSTCODE_RE.test(data.postcode)) errors.push(["postcode", "Please check the postcode (e.g. CH45 1AB)."]);
    if (!data.consent) errors.push(["consent", "Please tick to let us contact you about your enquiry."]);
    if (errors.length) {
      errors.forEach(([n, m]) => setError(form, n, m));
      const first = field(form, errors[0][0]);
      if (first && first.focus) first.focus();
      showStatus(form, "err", "Please check the highlighted " + (errors.length === 1 ? "field." : "fields."));
      return;
    }

    // Honeypot: bots fill every field. Pretend it worked.
    if (value(form, "company")) {
      showStatus(form, "ok", "Thank you - your request has been sent.");
      form.reset();
      return;
    }

    const source = form.dataset.source || "roof-replacement";
    const payload = Object.assign({}, data, {
      source,
      elapsedMs: Date.now() - started,
      idempotencyKey: requestKey(source),
    });
    if (opts.getContext) {
      try {
        Object.assign(payload, await opts.getContext());
      } catch (err) {
        /* send without extras */
      }
    }

    if (submit) {
      submit.disabled = true;
      submit.dataset.label = submit.dataset.label || submit.textContent;
      submit.textContent = "Sending…";
    }
    showStatus(form, "warn", "Saving your enquiry…");
    try {
      const { status, json } = await (opts.send || sendEnquiry)(payload);
      if (status < 300 && json.ok) {
        showStatus(form, "ok", savedMessage(data.name, json));
        forgetKey(source);
        form.reset();
        if (opts.onSent) opts.onSent(json);
      } else if (json.error === "not_configured") {
        showStatus(
          form,
          "warn",
          "WV Roofing is a concept site, so enquiries aren't being collected yet. Nothing has been sent or stored. When it launches, this form will go straight to the team."
        );
      } else if (status === 429) {
        showStatus(form, "err", json.message || "You've sent a few requests already - please try again a little later.");
      } else if (status === 400) {
        showStatus(form, "err", json.message || "Something in the form wasn't accepted - please check and try again.");
      } else {
        showStatus(form, "err", "Sorry, your enquiry didn't go through. Please try again in a moment.");
      }
    } catch (err) {
      showStatus(form, "err", "We couldn't reach the server - check your connection and try again.");
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = submit.dataset.label || "Send";
      }
    }
  });
}
