// WV Roofing v2 — where things live, and the two small data files.
//
// The eight roof looks and the three sample houses are the first version's own
// files, read from where they already are, so there is one catalogue and one
// set of sample houses (with their credits) for both versions. Version 2 keeps
// only what it must of its own: small thumbnails of the three photos, a copy of
// one photo with the house number on its gate post blurred, and its own short
// descriptions of the looks (no talk of price, value or speed).

export const ROOT = "/WVROOFING/2/";
export const SHARED = "/WVROOFING/";

/** Version 2's own copies of sample photos, by sample id (the shared file shows a house number). */
const PHOTOS = {
  "detached-clay": ROOT + "assets/samples/detached-clay.jpg",
};

/** Sample ids with a small (480 x 360) thumbnail in assets/samples/thumbs/. */
const THUMBS = new Set(["semi-1930s", "detached-modern", "detached-clay"]);

/**
 * Version 2's descriptions of the looks, by id, used in place of the shared
 * catalogue's. This is a concept that gives no prices, so a description says
 * what a roof looks like and where it belongs, never what it costs, whether it
 * is good value or how quickly it goes on.
 */
const SUMMARIES = {
  "spanish-slate": "The classic Merseyside roof: thin blue-black slates in fine, straight courses. Natural stone that typically lasts for generations.",
  "welsh-slate": "The original Victorian roof, quarried in North Wales. A distinctive purple-grey 'heather blue' that weathers beautifully: the like-for-like choice for period homes first roofed in it.",
  "slate-effect-grey": "The look of small slates in a concrete tile. A slim 'false joint' down each tile makes it read as slate from the street, and it is hard-wearing.",
  "granular-tawny": "The everyday Wirral re-roof: a neat, small-format concrete tile with a sandy granular face that looks like plain tiles from the pavement.",
};

// A safety net for looks added to the shared catalogue later: any sentence
// that talks about price, cost, value or speed of fitting is left out.
const SALES_TALK = /\b(price[sd]?|pricing|cost[sy]?|cheap(er|est)?|value|premium|budget|afford\w*|bargain|quick(er|ly)? to fit|fast(er)? to fit)\b/i;

function v2Summary(v) {
  const own = Object.prototype.hasOwnProperty.call(SUMMARIES, v.id) ? SUMMARIES[v.id] : String(v.summary || "");
  const sentences = own.match(/[^.!?]+[.!?]*/g) || [];
  return sentences
    .filter((s) => !SALES_TALK.test(s))
    .join("")
    .trim();
}

/** Concept placeholders. The phone number is from Ofcom's drama range, so it can never ring anyone. */
export const CONTACT = {
  phone: "0151 496 0321",
  phoneHref: "tel:+441514960321",
  email: "hello@wvroofing.co.uk",
};

let cataloguePending = null;
let samplesPending = null;

/** The eight looks, each with version 2's own summary. Resolves to { visuals: [...], byId: Map }. */
export function loadCatalogue() {
  if (!cataloguePending) {
    // A request that hangs is given up after 18 s, so it fails, the cache below
    // clears, and the Roof Cam's "Try again" really sends a new one.
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 18000) : 0;
    cataloguePending = fetch(SHARED + "data/catalogue.json", { cache: "no-cache", signal: ctl ? ctl.signal : undefined })
      .finally(() => clearTimeout(timer))
      .then((r) => {
        if (!r.ok) throw new Error("The roof catalogue didn't load (" + r.status + ")");
        return r.json();
      })
      .then((data) => {
        const visuals = (Array.isArray(data.visuals) ? data.visuals : []).map((v) => Object.assign({}, v, { summary: v2Summary(v) }));
        return { visuals, byId: new Map(visuals.map((v) => [v.id, v])) };
      })
      .catch((err) => {
        cataloguePending = null;
        throw err;
      });
  }
  return cataloguePending;
}

/**
 * The three sample houses, each with `url` (the full photo, version 2's own
 * copy where it has one) and `thumb` (a small 480 x 360 picture for cards,
 * or the full photo when there is no thumbnail) added.
 */
export function loadSamples() {
  if (!samplesPending) {
    samplesPending = fetch(SHARED + "samples/samples.json", { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error("The sample houses didn't load (" + r.status + ")");
        return r.json();
      })
      .then((j) =>
        (Array.isArray(j.samples) ? j.samples : []).map((s) => {
          const url = Object.prototype.hasOwnProperty.call(PHOTOS, s.id) ? PHOTOS[s.id] : SHARED + "samples/" + s.src;
          const thumb = THUMBS.has(s.id) ? ROOT + "assets/samples/thumbs/" + s.id + ".jpg" : url;
          return Object.assign({}, s, { url, thumb });
        })
      )
      .catch((err) => {
        samplesPending = null;
        throw err;
      });
  }
  return samplesPending;
}

/** Decode an image URL (same origin) and resolve with the <img>. */
export async function loadImage(url) {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return img;
}
