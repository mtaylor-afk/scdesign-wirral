"use client";

import { useEffect } from "react";
import Link from "next/link";
import { track } from "@/components/Analytics";
import {
  AREA_MIN,
  AREA_MAX,
  RATES_REVIEWED,
  getCostProject,
  estimateRange,
  totalBudgetRange,
  formatRange,
  type CostKey,
} from "@/lib/costRates";

/**
 * "Estimated build price" shown alongside a visualiser concept (Sean's brief:
 * add cost info "calling it an estimated price"). Uses the same shared rates as
 * /cost-estimate. Controlled: the parent owns the area so the figure can travel
 * with the "send this concept to Sean" message. Estimate only — never a quote.
 */
export function EstimatedPriceCard({
  costKey,
  area,
  onAreaChange,
}: {
  costKey: CostKey | null;
  area: number;
  onAreaChange: (m2: number) => void;
}) {
  useEffect(() => {
    track("visualiser_estimate_shown", { project: costKey ?? "general" });
  }, [costKey]);

  if (!costKey) {
    return (
      <div className="rounded-lg border border-line bg-paper-card p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-strong">
          Estimated build price
        </p>
        <p className="mt-2 text-sm text-muted">
          For a general design idea there&apos;s no single sensible figure — try the cost estimate
          to pick the kind of project and its size.
        </p>
        <Link
          href="/cost-estimate"
          className="mt-3 inline-flex text-sm font-medium text-accent-strong underline"
        >
          Open the cost estimate
        </Link>
      </div>
    );
  }

  const project = getCostProject(costKey);
  const range = estimateRange(costKey, area);
  const budget = totalBudgetRange(range);

  return (
    <div className="rounded-lg border border-accent-soft bg-accent-soft/30 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-strong">
        Estimated build price — guide only
      </p>
      <p className="mt-1 font-display text-2xl text-ink sm:text-3xl">
        {formatRange(range)} <span className="text-base text-muted">+ VAT</span>
      </p>
      <p className="mt-1 text-sm text-muted">
        for a {area} m² {project.label.toLowerCase()} (standard finish)
      </p>
      <label className="mt-3 block text-sm">
        <span className="font-medium text-ink">Adjust the approximate size</span>
        <span className="mt-1 flex items-center gap-2">
          <input
            type="range"
            min={AREA_MIN}
            max={AREA_MAX}
            value={area}
            onChange={(e) => onAreaChange(Number(e.target.value))}
            className="w-full accent-[var(--color-accent-strong)]"
            aria-label="Approximate new floor area in square metres"
          />
          <span className="w-16 shrink-0 text-right font-medium text-ink">{area} m²</span>
        </span>
      </label>
      <p className="mt-3 text-sm text-ink-soft">
        Typical total budget incl. VAT (if charged) and a 10% contingency:{" "}
        <strong className="text-ink">{formatRange(budget)}</strong>
      </p>
      <p className="mt-3 text-pretty text-xs text-muted">
        A rough North-West guide to the <strong>builder&apos;s price</strong> — not our design fee
        and not a quote. Real costs depend on your site, specification and access. Rates reviewed{" "}
        {RATES_REVIEWED}.{" "}
        <Link href="/cost-estimate" className="underline">
          More detail in the cost estimate
        </Link>
        .
      </p>
    </div>
  );
}
