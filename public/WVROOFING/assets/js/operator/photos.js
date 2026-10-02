// WV Roofing admin — the Photos tab: every photo customers have added on the
// site chosen at the top (version 1's Roof Visualiser, version 2's Roof Cam, or
// both), with or without an enquiry, newest first; and everything about one photo
// session: the photo (and any earlier ones), the previews the customer's device
// drew, any photo-real renders, the enquiry it led to, and deleting it.
import { api, apiImage } from "./api.js";
import { h, kv, when, bytes, sitePill, dateWithYear, cleanSite, keepFocus, SITE_WORDS, CONDITION_WORDS, STATUS_WORDS } from "./dom.js";

const $ = (id) => document.getElementById(id);

const P = {
  site: "", // set by the site switch at the top (setSite)
  enquiry: "",
  page: 0,
  total: 0,
  items: [],
  open: null, // the project shown in full
  urls: new Map(), // API path -> object URL for the grid's thumbnails, kept until the list is refreshed
  detailUrls: new Map(), // the same for the open photo session, kept while it stays open
  detailFor: null,
  observer: null,
  loaded: false,
  hooks: null,
};

const ENQUIRY_FILTERS = [
  ["", "All"],
  ["with", "With an enquiry"],
  ["without", "No enquiry yet"],
];

function revoke(cache) {
  for (const u of cache.values()) URL.revokeObjectURL(u);
  cache.clear();
}

/** An image the API streams, fetched once into an object URL (kept in `cache`). */
async function imageUrl(path, cache) {
  if (cache.has(path)) return cache.get(path);
  const url = await apiImage(path);
  if (cache.has(path)) {
    URL.revokeObjectURL(url);
    return cache.get(path);
  }
  cache.set(path, url);
  return url;
}

/** A grid thumbnail. */
function fill(slot, path, alt, enlarge) {
  return put(slot, path, alt, enlarge, P.urls);
}

/** A picture in the open photo session (its URLs outlive a refresh of the grid). */
function fillDetail(slot, path, alt, enlarge) {
  return put(slot, path, alt, enlarge, P.detailUrls);
}

async function put(slot, path, alt, enlarge, cache) {
  try {
    const url = await imageUrl(path, cache);
    const img = h("img", { src: url, alt, decoding: "async" });
    slot.replaceChildren(enlarge ? h("a", { href: url, target: "_blank", rel: "noopener", title: "Open full size" }, img) : img);
  } catch (ex) {
    if (ex.status === 401) return;
    slot.replaceChildren(h("span", { class: "op-muted op-small", text: ex.status === 404 ? "Image not available." : ex.message }));
  }
}

/** Thumbnails load as they come into view. */
function lazy(slot, path, alt) {
  if (!P.observer && "IntersectionObserver" in window) {
    P.observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          P.observer.unobserve(e.target);
          fill(e.target, e.target.dataset.path, e.target.dataset.alt, false);
        }
      },
      { rootMargin: "300px" }
    );
  }
  slot.dataset.path = path;
  slot.dataset.alt = alt;
  if (P.observer) P.observer.observe(slot);
  else fill(slot, path, alt, false);
}

function daysLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function keptText(x) {
  if (x.enquiry) return "Kept with the enquiry until " + dateWithYear(x.expiresAt);
  const d = daysLeft(x.expiresAt);
  return d <= 1 ? "Deleted within a day (no enquiry)" : "Deleted in " + d + " days unless an enquiry is sent";
}

// ---------------------------------------------------------------------------
// the grid

// Which site is chosen with the switch at the top of the admin (not here).
function renderFilters() {
  keepFocus($("op-photo-enquiry"), (box) => box.replaceChildren(
    ...ENQUIRY_FILTERS.map(([v, t]) =>
      h("button", {
        class: "op-chip",
        type: "button",
        "aria-pressed": String(P.enquiry === v),
        text: t,
        on: {
          click: () => {
            P.enquiry = v;
            renderFilters();
            loadPhotos({ reset: true });
          },
        },
      })
    )
  ));
}

function params(page) {
  const q = new URLSearchParams();
  if (P.site) q.set("site", P.site);
  if (P.enquiry) q.set("enquiry", P.enquiry);
  if (page) q.set("page", String(page));
  return q.toString();
}

/** Load the first page (reset) or the next one. */
export async function loadPhotos(opts) {
  const reset = !opts || opts.reset !== false;
  const page = reset ? 0 : P.page + 1;
  const asked = params(page);
  const more = $("op-photo-more");
  more.disabled = true;
  try {
    const r = await api("GET", "operator/projects" + (asked ? "?" + asked : ""));
    if (asked !== params(page)) return; // a filter changed while this was loading
    if (reset) {
      if (P.observer) P.observer.disconnect();
      revoke(P.urls);
      P.items = [];
    }
    P.page = r.page;
    P.total = r.total;
    P.items = P.items.concat(r.projects);
    P.loaded = true;
    renderGrid(reset ? null : r.projects);
    // The tab's count: photos on the chosen site (not shown while "with/without an enquiry" narrows it).
    const count = $("op-photos-count");
    count.hidden = !(P.total > 0) || !!P.enquiry;
    count.textContent = String(P.total);
    // Only said when the Photos tab is open (the count is also loaded behind the Enquiries tab).
    if (P.hooks && !$("op-view-photos").hidden) P.hooks.status(P.total + (P.total === 1 ? " photo" : " photos") + (P.site ? " from " + SITE_WORDS[P.site].toLowerCase() : "") + (P.enquiry === "with" ? " with an enquiry" : P.enquiry === "without" ? " with no enquiry yet" : "") + ".");
  } catch (ex) {
    if (ex.status !== 401 && P.hooks) P.hooks.status(ex.message, true);
  } finally {
    more.disabled = false;
  }
}

function card(x) {
  const slot = h("span", { class: "op-photo-thumb", text: "…" });
  lazy(slot, "operator/projects/" + x.id + "/photo?size=thumb", "Customer photo, " + when(x.photo.at));
  const e = x.enquiry;
  const facts = [x.mockups ? x.mockups + (x.mockups === 1 ? " preview" : " previews") : "", x.renders ? x.renders + (x.renders === 1 ? " render" : " renders") : "", x.photos > 1 ? x.photos + " photos" : "", x.postcode || ""].filter(Boolean);
  return h(
    "li",
    {},
    h(
      "button",
      { class: "op-photo-card", type: "button", "data-id": x.id, "aria-current": P.open === x.id ? "true" : null, on: { click: () => openPhoto(x.id) } },
      slot,
      h(
        "span",
        { class: "op-photo-card-body" },
        h("span", { class: "op-item-top" }, sitePill(x.site, true), h("span", { class: "op-item-meta", text: when(x.photo.at) })),
        e
          ? h("span", { class: "op-item-name" }, h("span", { class: "op-ref", text: e.reference }), " " + e.name)
          : h("span", { class: "op-item-meta", text: "No enquiry yet" }),
        facts.length ? h("span", { class: "op-item-meta", text: facts.join(" · ") }) : null,
        h("span", { class: "op-caption", text: keptText(x) })
      )
    )
  );
}

function renderGrid(added) {
  const grid = $("op-photo-grid");
  if (added) grid.append(...added.map(card));
  else grid.replaceChildren(...P.items.map(card));
  $("op-photo-empty").hidden = P.items.length > 0;
  $("op-photo-more").hidden = P.items.length >= P.total;
}

// ---------------------------------------------------------------------------
// one photo session

function backToGrid() {
  P.open = null;
  P.detailFor = null;
  revoke(P.detailUrls);
  $("op-view-photos").dataset.show = "grid";
  $("op-photo-detail").replaceChildren();
  for (const b of document.querySelectorAll(".op-photo-card")) b.removeAttribute("aria-current");
  const first = document.querySelector(".op-photo-card");
  if (first) first.focus();
}

export async function openPhoto(id) {
  P.open = id;
  $("op-view-photos").dataset.show = "detail";
  const pane = $("op-photo-detail");
  pane.replaceChildren(h("p", { class: "op-empty op-muted", text: "Loading…" }));
  try {
    const d = await api("GET", "operator/projects/" + encodeURIComponent(id));
    if (P.open !== id) return;
    renderDetail(d);
    const head = $("op-photo-title");
    if (head) head.focus();
  } catch (ex) {
    if (ex.status === 401) return;
    pane.replaceChildren(
      h("button", { class: "btn btn-neutral btn-sm", type: "button", text: "All photos", on: { click: backToGrid } }),
      h("p", { class: "op-empty op-muted", text: ex.status === 404 ? "That photo has been deleted." : ex.message })
    );
  }
}

/**
 * The previews a customer's device drew, as a gallery (also used on the
 * enquiry screen).
 * @param {object} p  a project from the API
 * @param {(id: string) => string} productName
 * @param {(slot: Element, path: string, alt: string, enlarge: boolean) => void} [load]
 */
export function mockupGallery(p, productName, load) {
  const list = (p.mockups || []).slice().reverse();
  if (!list.length) return null;
  const loader = load || fillDetail;
  return h(
    "div",
    {},
    h("h4", { text: "Previews from the customer's device" }),
    h(
      "div",
      { class: "op-renders" },
      list.map((m) => {
        const slot = h("div", { class: "op-render-img", text: "Loading…" });
        const name = productName(m.visualId) + (m.condition && m.condition !== "noon" ? ", " + (CONDITION_WORDS[m.condition] || m.condition) : "");
        loader(slot, "operator/mockups/" + m.id + "/image", name + " (approximate preview drawn on the customer's device)", true);
        const older = p.photo && m.photoId !== p.photo.id;
        return h(
          "figure",
          { class: "op-render" + (older ? " is-old" : "") },
          slot,
          h("figcaption", { class: "op-render-body" }, h("strong", { text: name }), h("span", { class: "op-muted", text: [when(m.createdAt), "approximate preview", older ? "on an earlier photo" : ""].filter(Boolean).join(" · ") }))
        );
      })
    ),
    h("p", { class: "op-caption", text: "Drawn on the customer's phone or computer from numbers, keeping their photo's light and shadow. Approximate, not a render or a photograph of finished work." })
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

function renderDetail(d) {
  const p = d.project;
  // A different photo session: let the last one's pictures go.
  if (P.detailFor !== p.id) {
    revoke(P.detailUrls);
    P.detailFor = p.id;
  }
  const e = d.enquiry;
  const hooks = P.hooks;
  const cur = p.photos.find((x) => x.current) || p.photos[0];
  const big = h("div", { class: "op-photo", text: "Loading the photo…" });
  if (cur) {
    big.style.aspectRatio = cur.w + " / " + cur.h;
    fillDetail(big, "operator/projects/" + p.id + "/photo", "The customer's photo of the house", true);
  }
  const link = h("span", { class: "op-small" });
  const dl = h("button", { class: "btn btn-neutral btn-sm", type: "button", text: "Get the original file" });
  dl.addEventListener("click", () => originalLink(p, link, dl));
  const earlier = p.photos.filter((x) => !x.current);
  const address = (p.addresses || []).find((a) => a.current);

  const enquiryCard = h("section", { class: "op-card" }, h("h3", { text: "Enquiry" }));
  if (e) {
    enquiryCard.append(
      kv([
        ["Reference", e.reference],
        ["Name", e.name],
        ["Status", STATUS_WORDS[e.status] || e.status],
        ["Roof choice", e.roof ? hooks.productName(e.roof) : null],
        ["Sent", when(e.createdAt)],
      ]),
      h("div", {}, h("button", { class: "btn btn-primary btn-sm", type: "button", text: "Open the enquiry", on: { click: () => hooks.openEnquiry(e.id) } }))
    );
  } else {
    enquiryCard.append(h("p", { class: "op-muted op-small", text: "The customer hasn't sent an enquiry about this photo (yet). There are no contact details: this is only what they added." }));
  }

  const del = h("button", {
    class: "btn btn-danger btn-sm",
    type: "button",
    text: "Delete this photo session",
    on: {
      click: async () => {
        const ok = await hooks.confirmBox(
          "Delete this photo session?",
          "Deletes the customer's photo" + (p.photos.length > 1 ? "s" : "") + ", previews, renders and anything else in this session." + (e ? " The enquiry " + e.reference + " and the contact details stay." : ""),
          "Delete",
          true
        );
        if (!ok) return;
        try {
          await api("POST", "operator/projects/" + p.id + "/delete");
          hooks.status("Photo session deleted.");
          backToGrid();
          await loadPhotos({ reset: true });
        } catch (ex) {
          if (ex.status !== 401) hooks.status(ex.message, true);
        }
      },
    },
  });

  $("op-photo-detail").replaceChildren(
    h(
      "div",
      { class: "op-detail" },
      h("button", { class: "btn btn-neutral btn-sm op-photo-back", type: "button", text: "All photos", on: { click: backToGrid } }),
      h(
        "section",
        { class: "op-head", "aria-labelledby": "op-photo-title" },
        h("h2", { id: "op-photo-title", tabindex: "-1" }, "Photo from " + dateWithYear(cur ? cur.at : p.createdAt), sitePill(p.site, true)),
        h("p", { class: "op-muted op-small", text: keptText({ enquiry: e, expiresAt: p.expiresAt }) + (address ? " · " + (address.lines || []).concat(address.postcode ? [address.postcode] : []).join(", ") : "") })
      ),
      h(
        "section",
        { class: "op-card" },
        h("h3", { text: "The photo" }),
        big,
        cur
          ? h(
              "p",
              { class: "op-caption", text: "Original " + cur.origW + " × " + cur.origH + " px" + (cur.bytes ? ", " + bytes(cur.bytes) : "") + (cur.clientResized ? ", converted to a JPEG on the customer's phone before it was sent" : "") + "." + (cur.warnings.length ? " " + cur.warnings.join(" ") : "") }
            )
          : null,
        h("div", { class: "op-actions" }, dl, link),
        earlier.length
          ? h(
              "div",
              {},
              h("h4", { text: "Earlier photos in this session" }),
              h(
                "div",
                { class: "op-renders" },
                earlier.map((x) => {
                  const slot = h("div", { class: "op-render-img", text: "Loading…" });
                  fillDetail(slot, "operator/projects/" + p.id + "/photo?photo=" + x.id, "An earlier photo, " + when(x.at), true);
                  return h("figure", { class: "op-render" }, slot, h("figcaption", { class: "op-render-body op-muted", text: when(x.at) + " · " + x.origW + " × " + x.origH + " px" }));
                })
              )
            )
          : null,
        mockupGallery(p, hooks.productName),
        p.jobs.length ? h("div", {}, h("h4", { text: "Photo-real renders" }), h("div", { class: "op-renders" }, p.jobs.map((j) => hooks.renderTile(j)))) : null
      ),
      enquiryCard,
      h("section", { class: "op-card op-danger" }, h("h3", { text: "Delete" }), h("p", { class: "op-muted op-small", text: "This can't be undone." }), h("div", { class: "op-actions" }, del))
    )
  );
}

// ---------------------------------------------------------------------------
// set up, shown, signed out

/**
 * @param {{ productName: (id: string) => string, confirmBox: Function, status: (msg: string, isError?: boolean) => void,
 *           openEnquiry: (id: string) => void, renderTile: (job: object) => Element }} hooks
 */
export function initPhotos(hooks) {
  P.hooks = hooks;
  renderFilters();
  $("op-photo-more").addEventListener("click", () => loadPhotos({ reset: false }));
}

/**
 * The site switch at the top of the admin changed: forget this site's grid (and
 * any photo session left open). The caller loads the photos again.
 * @param {string} site  "v1", "v2" or "" (both sites)
 */
export function setSite(site) {
  const next = cleanSite(site);
  if (next === P.site) return;
  P.site = next;
  if (P.open) {
    P.open = null;
    P.detailFor = null;
    revoke(P.detailUrls);
    $("op-view-photos").dataset.show = "grid";
    $("op-photo-detail").replaceChildren();
  }
}

/** The tab was opened: load the photos the first time, and refresh after that. */
export function photosShown() {
  loadPhotos({ reset: true });
  if (P.open) openPhoto(P.open);
}

/** Signed out: forget everything. */
export function resetPhotos() {
  if (P.observer) P.observer.disconnect();
  revoke(P.urls);
  revoke(P.detailUrls);
  P.detailFor = null;
  P.items = [];
  P.open = null;
  P.loaded = false;
  P.total = 0;
  const grid = $("op-photo-grid");
  if (grid) grid.replaceChildren();
  const pane = $("op-photo-detail");
  if (pane) pane.replaceChildren();
  const v = $("op-view-photos");
  if (v) v.dataset.show = "grid";
  const count = $("op-photos-count");
  if (count) count.hidden = true;
}
