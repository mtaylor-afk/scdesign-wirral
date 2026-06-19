"use client";

import { useState } from "react";
import Link from "next/link";
import { cta } from "@/lib/site";

/**
 * Indicative BUILD-cost estimator (the contractor's price, NOT our design fee
 * and NOT a quote). Ranges are rough North-West-of-England guides per m² of new
 * floor area — heavily hedged. Real cost depends on site, spec and access and is
 * only confirmed by a builder after a survey. No fabricated precision.
 *
 * (If the TailoredQuote pricing service is later wired in, this self-contained
 * model can be swapped for it — the UI + disclaimers stay the same.)
 */
const PROJECTS: { key: string; label: string; low: number; high: number; defaultArea: number }[] = [
  { key: "single", label: "Single-storey extension", low: 2200, high: 3200, defaultArea: 20 },
  { key: "double", label: "Two-storey extension", low: 2000, high: 3000, defaultArea: 36 },
  { key: "loft", label: "Loft conversion (dormer)", low: 1500, high: 2500, defaultArea: 25 },
  { key: "garage", label: "Garage conversion", low: 1100, high: 1900, defaultArea: 15 },
  { key: "garden", label: "Garden room", low: 1800, high: 3200, defaultArea: 15 },
];

const FINISHES: { key: string; label: string; mult: number }[] = [
  { key: "standard", label: "Standard", mult: 1 },
  { key: "high", label: "High spec", mult: 1.25 },
];

function round(n: number) {
  return Math.round(n / 1000) * 1000;
}
function gbp(n: number) {
  return "£" + n.toLocaleString("en-GB");
}

export function CostEstimator() {
  const [projectKey, setProjectKey] = useState(PROJECTS[0].key);
  const [area, setArea] = useState(PROJECTS[0].defaultArea);
  const [finishKey, setFinishKey] = useState("standard");

  const project = PROJECTS.find((p) => p.key === projectKey)!;
  const finish = FINISHES.find((f) => f.key === finishKey)!;
  const low = round(area * project.low * finish.mult);
  const high = round(area * project.high * finish.mult);

  return (
    <div className="rounded-lg border border-line bg-paper-card p-6 shadow-card">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="font-medium text-ink">Project</span>
          <select
            value={projectKey}
            onChange={(e) => {
              const p = PROJECTS.find((x) => x.key === e.target.value)!;
              setProjectKey(p.key);
              setArea(p.defaultArea);
            }}
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-ink"
          >
            {PROJECTS.map((p) => (
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
              min={6}
              max={80}
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
          Indicative build cost — estimate only
        </p>
        <p className="mt-1 font-display text-3xl text-ink sm:text-4xl">
          {gbp(low)} – {gbp(high)}
        </p>
        <p className="mt-1 text-sm text-muted">
          for a {area} m² {project.label.toLowerCase()} ({finish.label.toLowerCase()} finish)
        </p>
      </div>

      <p className="mt-4 text-pretty text-xs text-muted">
        A rough guide to typical <strong>build costs</strong> in the North West — this is the
        contractor&apos;s price, <strong>not</strong> our design fee and <strong>not a quote</strong>.
        Real costs vary widely with site conditions, specification, access and finishes, and are only
        confirmed by a builder after a proper survey. Figures exclude VAT, professional fees, planning
        and building-control fees, and any structural or party-wall work.
      </p>

      <div className="mt-5">
        <Link
          href={cta.primary.href}
          data-conversion="service-cta"
          className="inline-flex h-11 items-center rounded-full bg-accent-strong px-5 text-sm font-medium text-white hover:bg-accent-deep"
        >
          Send your project for a proper view
        </Link>
      </div>
    </div>
  );
}
