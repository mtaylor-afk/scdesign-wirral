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

// No prices or price bands are shown anywhere (brief §5 and §13): prices come
// only from the roofer, after a survey.
