"use client";

import { useState } from "react";
import Link from "next/link";
import { whatsappLink } from "@/lib/site";
import { track } from "@/components/Analytics";
import {
  COST_PROJECTS,
  FINISHES,
  AREA_MIN,
  AREA_MAX,
  RATES_REVIEWED,
  estimateRange,
  totalBudgetRange,
  formatRange,
  costHandoffHref,
} from "@/lib/costRates";

/**
 * Indicative BUILD-cost estimator (the contractor's price, NOT our design fee
 * and NOT a quote). Rates live in lib/costRates.ts (shared with the visualiser's
 * estimated-price card). Real cost depends on site, spec and access and is only
 * confirmed by a builder after a survey. No fabricated precision.
 */
export function CostEstimator() {
  const [projectKey, setProjectKey] = useState(COST_PROJECTS[0].key);
  const [area, setArea] = useState(COST_PROJECTS[0].defaultArea);
  const [finishKey, setFinishKey] = useState("standard");

  const project = COST_PROJECTS.find((p) => p.key === projectKey)!;
  const finish = FINISHES.find((f) => f.key === finishKey)!;
  const range = estimateRange(project.key, area, finish.mult);
  const budget = totalBudgetRange(range);

  // Low-friction handoff: carry the (non-sensitive) estimate context to the
  // streamlined contact page so the message is pre-filled — no separate form,
  // and the calculator itself stays instant and ungated.
  const estimateText = `${formatRange(range)} + VAT`;
  const contactHref = costHandoffHref({
    project: project.label,
    areaM2: area,
    finish: finish.label,
    range: estimateText,
  });
  const whatsAppMessage =
    `Hi Sean, I used the cost estimate for a ${area} m² ${project.label.toLowerCase()} ` +
    `(${finish.label.toLowerCase()} finish) — estimated ${estimateText}. ` +
    `Could you sense-check this for my project?`;

  return (
    <div className="rounded-lg border border-line bg-paper-card p-6 shadow-card">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="font-medium text-ink">Project</span>
          <select
            value={projectKey}
            onChange={(e) => {
              const p = COST_PROJECTS.find((x) => x.key === e.target.value)!;
              setProjectKey(p.key);
              setArea(p.defaultArea);
            }}
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-ink"
          >
            {COST_PROJECTS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="font-medium text-ink">Approx. new floor area</span>
          <span className="mt-1 flex items-center gap-2">
            <input
              type="range"
              min={AREA_MIN}
              max={AREA_MAX}
              value={area}
              onChange={(e) => setArea(Number(e.target.value))}
              className="w-full accent-[var(--color-accent-strong)]"
              aria-label="Approximate new floor area in square metres"
            />
            <span className="w-16 shrink-0 text-right font-medium text-ink">{area} m²</span>
          </span>
        </label>

        <label className="text-sm">
          <span className="font-medium text-ink">Finish</span>
          <select
            value={finishKey}
            onChange={(e) => setFinishKey(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-ink"
          >
            {FINISHES.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 rounded-[var(--radius)] bg-accent-soft/40 p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-strong">
          Estimated build price — guide only
        </p>
        <p className="mt-1 font-display text-3xl text-ink sm:text-4xl">
          {formatRange(range)} <span className="text-lg text-muted">+ VAT</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          for a {area} m² {project.label.toLowerCase()} ({finish.label.toLowerCase()} finish)
        </p>
        <p className="mt-3 text-sm text-ink-soft">
          Typical total budget, allowing for VAT (if your builder charges it) and a 10% contingency:{" "}
          <strong className="text-ink">{formatRange(budget)}</strong>
        </p>
      </div>

      <p className="mt-4 text-pretty text-xs text-muted">
        A rough guide to typical <strong>build costs</strong> in the North West — this is the
        contractor&apos;s price, <strong>not</strong> our design fee and <strong>not a quote</strong>.
        Real costs vary widely with site conditions, specification, access and finishes, and are only
        confirmed by a builder after a proper survey. The build price excludes VAT, professional fees,
        planning and building-control fees, and any structural or party-wall work. Rates reviewed{" "}
        {RATES_REVIEWED}.
      </p>

      <div className="mt-6 rounded-[var(--radius)] border border-line bg-paper p-5">
        <p className="font-medium text-ink">Want Sean to sense-check this?</p>
        <p className="mt-1 text-sm text-muted">
          No need to enter anything to use the estimate. If it&apos;s useful, you can send these
          figures to Sean for an honest first view — just your name and one way to contact you.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={contactHref}
            onClick={() =>
              track("cost_estimate_handoff_clicked", {
                project: project.label,
                area_m2: area,
                finish: finish.label,
              })
            }
            data-conversion="cost-estimate-handoff"
            className="inline-flex h-11 items-center rounded-full bg-accent-strong px-5 text-sm font-medium text-white hover:bg-accent-deep"
          >
            Send this estimate to Sean
          </Link>
          <a
            href={whatsappLink(whatsAppMessage)}
            target="_blank"
            rel="noopener noreferrer"
            data-conversion="whatsapp-click"
            className="inline-flex h-11 items-center rounded-full border border-line bg-white px-5 text-sm font-medium text-ink hover:bg-paper-card"
          >
            WhatsApp Sean
          </a>
        </div>
      </div>
    </div>
  );
}
