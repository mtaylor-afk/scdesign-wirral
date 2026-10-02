// WV Roofing admin — the Overview tab, the first thing after logging in: what has
// come in on the site chosen at the top (enquiries and photos), whether the live
// site is set up to save anything, and the newest enquiries and photos, each a
// click away from everything about it.
import { api, apiImage } from "./api.js";
import { h, kv, pill, when, plural, sitePill, STATUS_WORDS, SOURCE_WORDS, SITE_WORDS, SETUP_WORDS, STORAGE_SETUP, SETUP_HELP } from "./dom.js";

const $ = (id) => document.getElementById(id);

const LATEST_PHOTOS = 6;

const O = {
  hooks: null,
  asked: null, // the site the newest load is for (an older answer is dropped)
  urls: new Map(), // thumbnail path -> object URL, kept while it's still on the page
};

/**
 * @param {{ site: () => string, status: (msg: string, isError?: boolean) => void, productName: (id: string) => string,
 *           openEnquiry: (id: string) => void, openPhoto: (id: string) => void, showEnquiries: (status?: string) => void,
 *           showTab: (tab: string) => void }} hooks
 */
export function initOverview(hooks) {
  O.hooks = hooks;
}

/**
 * What the live site has set up (yes or no for each setting, never a value), or
 * null when it can't be checked just now. Needs no login.
 */
export async function getSetup() {
  try {
    const r = await api("GET", "health");
    return r && r.setup && typeof r.setup === "object" ? r.setup : null;
  } catch (ex) {
    return null;
  }
}

/** Load (or reload) the overview for the chosen site. */
export async function loadOverview() {
  const site = O.hooks.site();
  O.asked = site;
  const box = $("op-overview");
  if (!box.childElementCount) box.replaceChildren(h("p", { class: "op-empty op-muted", text: "Loading…" }));
  const q = site ? "?site=" + site : "";
  try {
    const [ov, photos, setup] = await Promise.all([
      api("GET", "operator/overview" + q),
      // The newest photos are a nice-to-have: the overview still shows without them.
      api("GET", "operator/projects" + q).catch((ex) => {
        if (ex.status === 401) throw ex;
        return null;
      }),
      getSetup(),
    ]);
    if (O.asked !== site) return; // the site was switched while this was loading
    render(ov, photos && Array.isArray(photos.projects) ? photos.projects.slice(0, LATEST_PHOTOS) : null, setup);
    O.hooks.status("Updated " + when(ov.generatedAt) + ".");
  } catch (ex) {
    if (O.asked !== site || ex.status === 401) return;
    box.replaceChildren(h("p", { class: "op-empty op-muted", text: ex.message }));
  }
}

/** Signed out: forget everything. */
export function resetOverview() {
  O.asked = null;
  for (const u of O.urls.values()) URL.revokeObjectURL(u);
  O.urls.clear();
  const box = $("op-overview");
  if (box) box.replaceChildren();
}

// ---------------------------------------------------------------------------
// the cards

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** One figure: a label and its number (a problem is marked in words as well as colour). */
function stat(label, value, bad) {
  const n = num(value);
  return h("div", { class: "op-stat" + (bad && n ? " is-bad" : "") }, h("dt", { class: "op-stat-label", text: label }), h("dd", { class: "op-stat-value", text: String(n) }));
}

function head(title, id) {
  return h("h3", { id, text: title });
}

function enquiriesCard(e) {
  const byStatus = Object.keys(STATUS_WORDS)
    .filter((k) => num(e.byStatus && e.byStatus[k]) > 0)
    .map((k) => [STATUS_WORDS[k], String(num(e.byStatus[k]))]);
  const bySource = Object.entries(e.bySource || {})
    .filter(([, n]) => num(n) > 0)
    .sort((a, b) => num(b[1]) - num(a[1]))
    .map(([k, n]) => [SOURCE_WORDS[k] || k, String(num(n))]);
  const waiting = num(e.awaitingContact);
  return h(
    "section",
    { class: "op-card op-ov-card", "aria-labelledby": "op-ov-enquiries" },
    head("Enquiries", "op-ov-enquiries"),
    h("p", { class: "op-ov-total" }, h("span", { class: "op-ov-num op-big", text: String(num(e.total)) }), h("span", { class: "op-muted", text: num(e.total) === 1 ? " enquiry in all" : " enquiries in all" })),
    h(
      "dl",
      { class: "op-stats" },
      stat("Last 7 days", e.last7Days),
      stat("Last 30 days", e.last30Days),
      stat("Awaiting contact", waiting),
      stat("Email problems", e.emailProblems, true)
    ),
    num(e.emailProblems) ? h("p", { class: "op-small" }, pill("Check these", "bad"), " The roofer's email about " + plural(num(e.emailProblems), "enquiry", "enquiries") + " failed or may not have arrived: open it and send the email again.") : null,
    byStatus.length ? h("div", {}, h("h4", { text: "By status" }), kv(byStatus)) : null,
    bySource.length ? h("div", {}, h("h4", { text: "Where they came from" }), kv(bySource)) : null,
    h(
      "div",
      { class: "op-actions" },
      waiting ? h("button", { class: "btn btn-primary btn-sm", type: "button", text: "Show the " + waiting + " awaiting contact", on: { click: () => O.hooks.showEnquiries("new") } }) : null,
      h("button", { class: "btn btn-neutral btn-sm", type: "button", text: "All enquiries", on: { click: () => O.hooks.showEnquiries("") } }),
      h("button", { class: "btn btn-neutral btn-sm", type: "button", text: "Contact details", on: { click: () => O.hooks.showTab("contacts") } })
    )
  );
}

function photosCard(p) {
  return h(
    "section",
    { class: "op-card op-ov-card", "aria-labelledby": "op-ov-photos" },
    head("Photos saved", "op-ov-photos"),
    h("p", { class: "op-ov-total" }, h("span", { class: "op-ov-num op-big", text: String(num(p.held)) }), h("span", { class: "op-muted", text: num(p.held) === 1 ? " photo session held" : " photo sessions held" })),
    h(
      "dl",
      { class: "op-stats" },
      stat("With an enquiry", p.withEnquiry),
      stat("No enquiry yet", p.withoutEnquiry),
      stat("New in the last 7 days", p.last7Days),
      stat("Previews drawn", p.previews)
    ),
    h("p", { class: "op-muted op-small", text: "A photo without an enquiry is deleted after 30 days; with one, it's kept with the enquiry." }),
    h("div", { class: "op-actions" }, h("button", { class: "btn btn-neutral btn-sm", type: "button", text: "All photos", on: { click: () => O.hooks.showTab("photos") } }))
  );
}

/**
 * The owner's checklist: is each setting there? (yes or no from GET health, never a value)
 * @param {Record<string, boolean> | null} setup
 */
function setupCard(setup) {
  const card = h("section", { class: "op-card op-ov-card", "aria-labelledby": "op-ov-setup" }, head("Set-up", "op-ov-setup"));
  if (!setup) {
    card.append(h("p", { class: "op-muted op-small", text: "The set-up couldn't be checked just now. Refresh to try again." }));
    return card;
  }
  card.append(
    h(
      "ul",
      { class: "op-setup-list" },
      SETUP_WORDS.map(([k, label]) =>
        // Enquiry emails are optional: everything is saved here either way.
        h("li", {}, h("span", { text: label }), setup[k] ? pill("✓ Set up", "good") : k === "enquiryEmail" ? pill("Optional: off") : pill("Not set up yet", "warn"))
      )
    )
  );
  const storageMissing = STORAGE_SETUP.some((k) => !setup[k]);
  if (storageMissing) {
    card.append(h("p", { class: "notice notice--warn op-small", text: "Nothing is saved on the live site until everything marked “Not set up yet” is. " + SETUP_HELP }));
  } else if (!setup.enquiryEmail) {
    card.append(
      h("p", {
        class: "op-muted op-small",
        text: "Enquiries and photos are saved here. The roofer isn't emailed about new ones: that needs an inbox (the set-up script asks for one) and an email login (SMTP_USER and SMTP_PASS) on the Vercel project.",
      })
    );
  } else {
    card.append(h("p", { class: "op-muted op-small", text: "Everything is set up: enquiries and photos are saved, and the roofer is emailed about each enquiry." }));
  }
  return card;
}

function recentCard(list) {
  const card = h("section", { class: "op-card op-ov-card op-ov-wide", "aria-labelledby": "op-ov-recent" }, head("Latest enquiries", "op-ov-recent"));
  if (!list.length) {
    card.append(h("p", { class: "op-muted op-small", text: "No enquiries yet." }));
    return card;
  }
  card.append(
    h(
      "ul",
      { class: "op-ov-list" },
      list.map((e) =>
        h(
          "li",
          {},
          h(
            "button",
            { class: "op-ov-item", type: "button", on: { click: () => O.hooks.openEnquiry(e.id) } },
            h(
              "span",
              { class: "op-item-top" },
              h("span", { class: "op-ref", text: e.reference }),
              pill(STATUS_WORDS[e.status] || e.status, e.status),
              sitePill(e.site),
              h("span", { class: "op-item-meta", text: when(e.createdAt) })
            ),
            h("span", { class: "op-item-name", text: e.name }),
            h("span", {
              class: "op-item-meta",
              text: [e.postcode || "No postcode", e.roof ? O.hooks.productName(e.roof) : "", e.hasPhoto ? "with a photo" : "no photo", SOURCE_WORDS[e.source] || e.source].filter(Boolean).join(" · "),
            })
          )
        )
      )
    )
  );
  return card;
}

/** The newest photos, as thumbnails that open the photo session. */
function photosStrip(list) {
  const card = h("section", { class: "op-card op-ov-card op-ov-wide", "aria-labelledby": "op-ov-latest-photos" }, head("Latest photos", "op-ov-latest-photos"));
  if (!list) {
    card.append(h("p", { class: "op-muted op-small", text: "The photos couldn't be loaded just now." }));
    return card;
  }
  if (!list.length) {
    card.append(h("p", { class: "op-muted op-small", text: "No photos yet." }));
    return card;
  }
  const keep = new Set();
  card.append(
    h(
      "ul",
      { class: "op-ov-photos" },
      list.map((x) => {
        const path = "operator/projects/" + x.id + "/photo?size=thumb";
        keep.add(path);
        const slot = h("span", { class: "op-photo-thumb", text: "…" });
        thumb(slot, path, "Customer photo, " + when(x.photo && x.photo.at));
        const e = x.enquiry;
        return h(
          "li",
          {},
          h(
            "button",
            { class: "op-ov-photo", type: "button", on: { click: () => O.hooks.openPhoto(x.id) } },
            slot,
            h(
              "span",
              { class: "op-ov-photo-body" },
              h("span", { class: "op-item-top" }, sitePill(x.site), h("span", { class: "op-item-meta", text: when(x.photo && x.photo.at) })),
              e ? h("span", { class: "op-item-meta" }, h("span", { class: "op-ref", text: e.reference }), " " + e.name) : h("span", { class: "op-item-meta", text: "No enquiry yet" })
            )
          )
        );
      })
    )
  );
  // Let go of thumbnails no longer shown.
  for (const [p, u] of O.urls) {
    if (!keep.has(p)) {
      URL.revokeObjectURL(u);
      O.urls.delete(p);
    }
  }
  return card;
}

async function thumb(slot, path, alt) {
  try {
    let url = O.urls.get(path);
    if (!url) {
      url = await apiImage(path);
      if (O.urls.has(path)) {
        URL.revokeObjectURL(url);
        url = O.urls.get(path);
      } else {
        O.urls.set(path, url);
      }
    }
    slot.replaceChildren(h("img", { src: url, alt, decoding: "async" }));
  } catch (ex) {
    if (ex.status === 401) return;
    slot.replaceChildren(h("span", { class: "op-muted op-small", text: ex.status === 404 ? "Image not available." : "Couldn't load." }));
  }
}

function render(ov, photos, setup) {
  const site = ov.site === "v1" || ov.site === "v2" ? ov.site : "";
  $("op-overview").replaceChildren(
    h(
      "div",
      { class: "op-ov-head" },
      h("h2", { class: "op-ov-title", text: "Overview: " + (site ? SITE_WORDS[site] : "both sites") }),
      h(
        "p",
        { class: "op-small op-muted op-ov-links" },
        "Open the site: ",
        h("a", { href: "/WVROOFING/", target: "_blank", rel: "noopener", text: "Version 1 (Visualiser)" }),
        " · ",
        h("a", { href: "/WVROOFING/2/", target: "_blank", rel: "noopener", text: "Version 2 (Roof Cam)" })
      )
    ),
    h("div", { class: "op-ov-grid" }, enquiriesCard(ov.enquiries || {}), photosCard(ov.photos || {}), setupCard(setup), recentCard(Array.isArray(ov.recent) ? ov.recent : []), photosStrip(photos))
  );
}
