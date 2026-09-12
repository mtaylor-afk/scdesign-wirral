/**
 * Full service-area coverage, grouped by region, for the /areas hub.
 *
 * SEO-safe approach: we keep a set of genuinely-unique local AREA PAGES
 * (src/lib/locations.ts) and list the WIDER coverage here as a simple
 * "we also cover" list — NO thin per-town pages (Google penalises templated
 * doorway pages). Towns that DO have a dedicated page link to it; the rest are
 * plain text.
 *
 * Tiers follow Sean's brief (Sep 2026): MAIN areas (Wirral, Cheshire West /
 * Halton / Warrington, North Wales) and SECONDARY areas (Liverpool & Merseyside).
 * Saltney sits under North Wales (it is in Flintshire) for planning accuracy.
 */

import { locations } from "./locations";

const pageSlugs = new Set(locations.map((l) => l.slug));

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export type AreaTier = "main" | "secondary";
export type AreaRegion = { region: string; tier: AreaTier; note?: string; towns: string[] };

export const serviceAreaRegions: AreaRegion[] = [
  {
    region: "Wirral peninsula",
    tier: "main",
    towns: [
      "Wallasey", "New Brighton", "Leasowe", "Moreton", "Meols", "Hoylake", "West Kirby",
      "Greasby", "Upton", "Birkenhead", "Oxton", "Prenton", "Bebington", "Port Sunlight",
      "Irby", "Pensby", "Heswall", "Bromborough", "Eastham", "Parkgate", "Neston",
      "Little Neston", "Willaston", "South Wirral",
    ],
  },
  {
    region: "Cheshire & Warrington",
    tier: "main",
    note: "Cheshire West and Chester, Halton (Runcorn) and Warrington councils — we prepare drawings to the right authority's requirements.",
    towns: [
      "Ellesmere Port", "Little Sutton", "Great Sutton", "Whitby", "Frodsham", "Chester",
      "Hoole", "Blacon", "Christleton", "Northwich", "Runcorn", "Warrington",
    ],
  },
  {
    region: "North Wales",
    tier: "main",
    note: "Permitted-development rules differ in Wales — we account for the right local authority in your drawings.",
    towns: ["Saltney", "Connah Quay", "Buckley", "Mold", "Wrexham"],
  },
  {
    region: "Liverpool & Merseyside",
    tier: "secondary",
    towns: [
      "Liverpool", "Crosby", "Waterloo", "Bootle", "Southport", "Walton", "Fazakerley",
      "Aintree", "Kirkby", "Knowsley", "West Derby", "Tuebrook", "Norris Green", "Croxteth",
      "Mossley Hill", "Woolton", "Wavertree", "Aigburth", "Childwall", "Belle Vale", "Huyton",
      "Prescot", "Kirkdale",
    ],
  },
];

/** Link for a town if it has a dedicated area page, else null. */
export function townLink(name: string): string | null {
  const s = slugify(name);
  return pageSlugs.has(s) ? `/areas/${s}` : null;
}
