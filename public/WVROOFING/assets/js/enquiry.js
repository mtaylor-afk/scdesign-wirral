// WV Roofing — quote request form (roof-replacement page + visualiser dialog).
import { API_BASE } from "./config.js";
import { loadCatalogue } from "./catalogue.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\d\s-]{7,20}$/;
const POSTCODE_RE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/;

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
    for (const p of cat.products) {
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
 * @param {{getContext?: () => Promise<object>|object, onSent?: () => void}} [opts]
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

    const payload = Object.assign({}, data, {
      source: form.dataset.source || window.location.pathname,
      elapsedMs: Date.now() - started,
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
    showStatus(form, "warn", "Sending your request…");
    try {
      const res = await fetch(API_BASE + "/api/wvroofing/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        showStatus(
          form,
          "ok",
          "Thank you" + (data.name ? ", " + data.name.split(" ")[0] : "") + " - your request has been sent. We'll be in touch soon."
        );
        form.reset();
        if (opts.onSent) opts.onSent();
      } else if (json.error === "not_configured") {
        showStatus(
          form,
          "warn",
          "WV Roofing is a concept site, so enquiries aren't being collected yet. Nothing has been sent or stored. When it launches, this form will go straight to the team."
        );
      } else if (res.status === 429) {
        showStatus(form, "err", "You've sent a few requests already - please try again a little later.");
      } else if (res.status === 400) {
        showStatus(form, "err", json.message || "Something in the form wasn't accepted - please check and try again.");
      } else {
        showStatus(form, "err", "Sorry, the request didn't go through. Please try again in a moment.");
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
