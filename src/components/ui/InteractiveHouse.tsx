"use client";

import { useState } from "react";
import Link from "next/link";
import {
  houseFeatures,
  featureOrder,
  type FeatureId,
  type HouseView,
} from "@/lib/houseFeatures";
import { getService } from "@/lib/services";
import { cta } from "@/lib/site";

/* ---- Simple, friendly flat-illustration houses (front + rear) ---- */
function HouseFront() {
  return (
    <svg viewBox="0 0 400 300" className="h-full w-full" role="presentation" aria-hidden>
      <rect width="400" height="300" fill="var(--color-paper)" />
      <rect y="250" width="400" height="50" fill="#e3e7e0" />
      {/* garage block */}
      <rect x="20" y="170" width="90" height="80" fill="#fbf7f0" stroke="var(--color-line)" />
      <rect x="30" y="195" width="70" height="55" fill="#ede6da" stroke="var(--color-line)" />
      <polygon points="15,170 65,140 115,170" fill="var(--color-accent)" />
      {/* main house */}
      <rect x="120" y="120" width="180" height="130" fill="#fbf7f0" stroke="var(--color-line)" />
      <polygon points="112,120 210,60 308,120" fill="var(--color-accent)" />
      <rect x="252" y="74" width="16" height="26" fill="#7a1414" />
      {/* door + windows */}
      <rect x="196" y="185" width="34" height="65" fill="#6b4a2b" />
      <rect x="140" y="150" width="40" height="34" fill="#cfe0ea" stroke="var(--color-line)" />
      <rect x="240" y="150" width="40" height="34" fill="#cfe0ea" stroke="var(--color-line)" />
      <rect x="140" y="200" width="40" height="34" fill="#cfe0ea" stroke="var(--color-line)" />
    </svg>
  );
}

function HouseRear() {
  return (
    <svg viewBox="0 0 400 300" className="h-full w-full" role="presentation" aria-hidden>
      <rect width="400" height="300" fill="var(--color-paper)" />
      <rect y="250" width="400" height="50" fill="#cfe0c4" />
      {/* main house */}
      <rect x="90" y="120" width="190" height="130" fill="#fbf7f0" stroke="var(--color-line)" />
      <polygon points="82,120 185,60 288,120" fill="var(--color-accent)" />
      {/* rear dormer */}
      <rect x="160" y="80" width="50" height="40" fill="#5b6066" stroke="#3a3d42" />
      {/* bi-fold doors + windows */}
      <rect x="120" y="180" width="80" height="70" fill="#cfe0ea" stroke="var(--color-line)" />
      <rect x="220" y="150" width="40" height="34" fill="#cfe0ea" stroke="var(--color-line)" />
      {/* garden room */}
      <rect x="310" y="195" width="70" height="55" fill="#eef0ec" stroke="var(--color-line)" />
      <rect x="318" y="205" width="54" height="38" fill="#cfe0ea" stroke="var(--color-line)" />
    </svg>
  );
}

export function InteractiveHouse() {
  const [view, setView] = useState<HouseView>("front");
  const [active, setActive] = useState<FeatureId | null>(null);
  const feat = active ? houseFeatures[active] : null;
  const visible = featureOrder.filter((id) => houseFeatures[id].view === view);
  const service = feat ? getService(feat.service) : undefined;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        {/* View toggle */}
        <div
          className="mb-4 inline-flex rounded-full border border-line bg-paper-card p-1"
          role="group"
          aria-label="Choose house view"
        >
          {(["front", "rear"] as HouseView[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => {
                setView(v);
                setActive(null);
              }}
              className={
                "rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors " +
                (view === v ? "bg-accent-strong text-white" : "text-ink-soft hover:bg-paper")
              }
            >
              {v} of house
            </button>
          ))}
        </div>

        {/* House + hotspots */}
        <div
          className="relative overflow-hidden rounded-lg border border-line bg-paper"
          role="group"
          aria-label={`Interactive ${view} of a house — select a feature to see its planning rules.`}
        >
          <div className="aspect-[4/3] w-full">
            {view === "front" ? <HouseFront /> : <HouseRear />}
          </div>
          {visible.map((id) => {
            const f = houseFeatures[id];
            const isActive = active === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={isActive}
                aria-label={f.label}
                onClick={() => setActive(id)}
                style={{ left: `${f.pos.x}%`, top: `${f.pos.y}%` }}
                className={
                  "absolute z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-sm font-bold shadow-card transition-transform hover:scale-110 " +
                  (isActive
                    ? "border-white bg-accent-deep text-white"
                    : "border-white bg-accent-strong text-white")
                }
              >
                +
              </button>
            );
          })}
        </div>

        {/* Text-equivalent list (accessibility + mobile) */}
        <div className="mt-4">
          <p className="text-sm font-semibold text-ink">Or pick a project:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {featureOrder.map((id) => {
              const f = houseFeatures[id];
              return (
                <li key={id}>
                  <button
                    type="button"
                    aria-pressed={active === id}
                    onClick={() => {
                      setView(f.view);
                      setActive(id);
                    }}
                    className={
                      "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                      (active === id
                        ? "border-accent-strong bg-accent-soft text-accent-deep"
                        : "border-line bg-paper-card text-ink-soft hover:border-accent")
                    }
                  >
                    {f.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Detail panel */}
      <div className="lg:pt-12">
        {feat ? (
          <div className="rounded-lg border border-line bg-paper-card p-6 shadow-card">
            <h3 className="text-xl">{feat.label}</h3>
            <p className="mt-1 font-medium text-accent-strong">{feat.headline}</p>
            <p className="mt-3 text-pretty text-muted">{feat.summary}</p>
            <p className="mt-3 text-pretty text-sm text-muted">
              <strong className="text-ink">Building control:</strong> {feat.buildingRegs}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <a
                href={feat.planningPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent-strong underline"
              >
                Planning Portal guidance
              </a>
              {service && (
                <Link
                  href={`/services/${service.slug}`}
                  className="font-medium text-accent-strong underline"
                >
                  Our {service.short.toLowerCase()} service
                </Link>
              )}
            </div>
            <div className="mt-5 rounded-[var(--radius)] border border-accent-soft bg-accent-soft/40 p-4">
              <p className="text-sm text-ink-soft">
                Not sure how this applies to your home? Send your postcode and a few photos for an
                honest first view — with no obligation.
              </p>
              <Link
                href={cta.primary.href}
                data-conversion="guide-cta"
                className="mt-3 inline-flex h-10 items-center rounded-full bg-accent-strong px-5 text-sm font-medium text-white hover:bg-accent-deep"
              >
                {cta.primary.label}
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted">
              General guidance for England only — rules vary by property and differ in Wales. Always
              confirm with your local planning authority.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-line bg-paper-card p-6 text-pretty text-muted">
            <h3 className="text-xl text-ink">Tap a + on the house</h3>
            <p className="mt-2">
              Select a feature — porch, dormer, garage, extension or garden room — to see whether it
              usually needs planning permission and building regulations, with a link to the official
              guidance.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
