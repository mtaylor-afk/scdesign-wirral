/**
 * Indicative BUILD-cost rates — the single source for the /cost-estimate tool and
 * the visualiser's "Estimated build price" card. This is the contractor's price,
 * NOT SC's design fee and NOT a quote. Rough North-West/North-Wales guides per m²
 * of new floor area (standard spec, excl. VAT), heavily hedged.
 *
 * Reviewed Sep 2026 against published 2026 guides (North of England single-storey
 * ≈ £1,800–£2,400/m²; UK dormer lofts ≈ £40k–£70k; garage conversions ≈ £12k–£25k)
 * — our ranges sit at or above those. Sean's brief noted extensions "cost more
 * than" the £50k TailoredQuote demo figure: the gap is usually VAT + contingency,
 * so a "typical total budget" line (incl. VAT + 10% contingency) is shown too.
 * Sean to sanity-check the rates.
 */

export type CostKey = "single" | "double" | "loft" | "garage" | "garden";

export type CostProject = {
  key: CostKey;
  label: string;
  low: number; // £/m² excl. VAT, standard spec
  high: number;
  defaultArea: number; // m²
};

export const COST_PROJECTS: CostProject[] = [
  { key: "single", label: "Single-storey extension", low: 2200, high: 3200, defaultArea: 20 },
  { key: "double", label: "Two-storey extension", low: 2000, high: 3000, defaultArea: 36 },
  { key: "loft", label: "Loft conversion (dormer)", low: 1500, high: 2500, defaultArea: 25 },
  { key: "garage", label: "Garage conversion", low: 1100, high: 1900, defaultArea: 15 },
  { key: "garden", label: "Garden room", low: 1800, high: 3200, defaultArea: 15 },
];

export const FINISHES: { key: string; label: string; mult: number }[] = [
  { key: "standard", label: "Standard", mult: 1 },
  { key: "high", label: "High spec", mult: 1.25 },
];

export const RATES_REVIEWED = "September 2026";
export const VAT_RATE = 0.2;
export const CONTINGENCY = 0.1;
export const AREA_MIN = 6;
export const AREA_MAX = 80;

const ROUND_TO = 1000; // indicative figures are rounded to the nearest £1,000
export function roundTo1k(n: number) {
  return Math.round(n / ROUND_TO) * ROUND_TO;
}

export function gbp(n: number) {
  return "£" + n.toLocaleString("en-GB");
}

export function getCostProject(key: CostKey): CostProject {
  return COST_PROJECTS.find((p) => p.key === key) ?? COST_PROJECTS[0];
}

export type Range = { low: number; high: number };

/** Build-cost range (excl. VAT) for an area and finish multiplier. */
export function estimateRange(key: CostKey, areaM2: number, finishMult = 1): Range {
  const p = getCostProject(key);
  return {
    low: roundTo1k(areaM2 * p.low * finishMult),
    high: roundTo1k(areaM2 * p.high * finishMult),
  };
}

/** Typical total budget: build range + VAT (if charged) + a 10% contingency. */
export function totalBudgetRange(r: Range): Range {
  const f = (1 + VAT_RATE) * (1 + CONTINGENCY);
  return { low: roundTo1k(r.low * f), high: roundTo1k(r.high * f) };
}

export function formatRange(r: Range) {
  return `${gbp(r.low)} – ${gbp(r.high)}`;
}

/** /contact link that pre-fills the enquiry with the estimate (EnquiryForm reads these). */
export function costHandoffHref(opts: {
  project: string;
  areaM2: number;
  finish: string;
  range: string;
}) {
  return (
    `/contact?source_type=cost_estimate` +
    `&calculator_project=${encodeURIComponent(opts.project)}` +
    `&calculator_area_m2=${opts.areaM2}` +
    `&calculator_finish=${encodeURIComponent(opts.finish)}` +
    `&calculator_estimate_range=${encodeURIComponent(opts.range)}`
  );
}

/**
 * Map the visualiser's options to a cost project + a typical size. Returns null
 * for "general design idea" (no sensible single figure — link to the estimator).
 */
export function visualiserCostKey(
  projectType: string,
  storeys: string
): { key: CostKey; defaultArea: number } | null {
  const t = projectType.toLowerCase();
  if (t.includes("general")) return null;
  if (t.includes("loft") || t.includes("dormer")) return { key: "loft", defaultArea: 25 };
  const twoStorey = /two|double|2/.test(storeys.toLowerCase());
  if (twoStorey) return { key: "double", defaultArea: t.includes("wrap") ? 48 : 36 };
  if (t.includes("wrap")) return { key: "single", defaultArea: 30 };
  if (t.includes("side")) return { key: "single", defaultArea: 15 };
  return { key: "single", defaultArea: 20 };
}
