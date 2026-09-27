// WV Roofing — the 8-product roof range (single source: data/catalogue.json).
import { ROOT } from "./config.js";

let pending = null;

/** Fetch the catalogue once per page. Resolves to { products: [...] }. */
export function loadCatalogue() {
  if (!pending) {
    pending = fetch(ROOT + "data/catalogue.json", { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error("Catalogue request failed (" + r.status + ")");
        return r.json();
      })
      .then((data) => {
        const products = Array.isArray(data.products) ? data.products : [];
        return { products, byId: new Map(products.map((p) => [p.id, p])) };
      })
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

/** £ / ££ / £££ as a DOM fragment (unused pounds dimmed, with a text alternative). */
export function priceBandNode(level) {
  const span = document.createElement("span");
  span.className = "price-band";
  const n = Math.max(1, Math.min(3, Number(level) || 1));
  span.setAttribute("aria-label", ["Budget", "Mid-range", "Premium"][n - 1] + " price band");
  span.setAttribute("title", ["Budget", "Mid-range", "Premium"][n - 1]);
  for (let i = 1; i <= 3; i++) {
    const s = document.createElement("span");
    s.textContent = "£";
    s.setAttribute("aria-hidden", "true");
    if (i > n) s.className = "dim";
    span.appendChild(s);
  }
  return span;
}

export function priceWord(level) {
  return ["Budget", "Mid-range", "Premium"][Math.max(1, Math.min(3, Number(level) || 1)) - 1];
}
