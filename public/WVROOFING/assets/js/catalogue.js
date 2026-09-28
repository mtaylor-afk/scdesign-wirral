// WV Roofing — the eight roof looks (single source: data/catalogue.json, v2).
// The looks drive the swatches, quick previews and photo-real prompts; they
// never produce quantities or prices. The manufacturers' products and their
// specifications, in the same file, are used only on the server.
import { ROOT } from "./config.js";

let pending = null;

/** Fetch the catalogue once per page. Resolves to { visuals: [...], byId }. */
export function loadCatalogue() {
  if (!pending) {
    pending = fetch(ROOT + "data/catalogue.json", { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error("Catalogue request failed (" + r.status + ")");
        return r.json();
      })
      .then((data) => {
        const visuals = Array.isArray(data.visuals) ? data.visuals : [];
        return { visuals, byId: new Map(visuals.map((v) => [v.id, v])) };
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
