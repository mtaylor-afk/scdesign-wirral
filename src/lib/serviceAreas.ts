/**
 * Full service-area coverage, grouped by region, for the /areas hub.
 *
 * SEO-safe approach: we keep a set of genuinely-unique local AREA PAGES
 * (src/lib/locations.ts) and list the WIDER coverage here as a simple
 * "we also cover" list — NO thin per-town pages (Google penalises templated
 * doorway pages). Towns that DO have a dedicated page link to it; the rest are
 * plain text.
 */

import { locations } from "./locations";

const pageSlugs = new Set(locations.map((l) => l.slug));

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export type AreaRegion = { region: string; note?: string; towns: string[] };

export const serviceAreaRegions: AreaRegion[] = [
  {
    region: "Wirral",
    towns: [
      "Wallasey", "New Brighton", "Leasowe", "Moreton", "Meols", "Hoylake", "West Kirby",
      "Greasby", "Upton", "Birkenhead", "Oxton", "Prenton", "Bebington", "Port Sunlight",
      "Irby", "Pensby", "Heswall", "Bromborough", "Eastham", "Parkgate", "Neston",
      "Little Neston", "Willaston",
    ],
  },
  {
    region: "Cheshire",
    towns: [
      "Ellesmere Port", "Little Sutton", "Great Sutton", "Frodsham", "Whitby", "Chester",
      "Hoole", "Blacon", "Christleton", "Northwich", "Runcorn", "Warrington",
    ],
  },
  {
    region: "North Wales",
    note: "Permitted-development rules differ in Wales — we account for the right local authority in your drawings.",
    towns: ["Saltney", "Connah Quay", "Buckley", "Mold", "Wrexham"],
  },
  {
    region: "Liverpool & Merseyside",
    towns: [
      "Liverpool", "Crosby", "Waterloo", "Bootle", "Walton", "Fazakerley", "Aintree", "Kirkby",
      "Knowsley", "West Derby", "Tuebrook", "Norris Green", "Croxteth", "Mossley Hill", "Woolton",
      "Wavertree", "Aigburth", "Childwall", "Belle Vale", "Huyton", "Prescot", "Kirkdale",
    ],
  },
];

/** Link for a town if it has a dedicated area page, else null. */
export function townLink(name: string): string | null {
  const s = slugify(name);
  return pageSlugs.has(s) ? `/areas/${s}` : null;
}
