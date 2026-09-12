"use client";

import { useState } from "react";
import Link from "next/link";
import {
  houseFeatures,
  featureOrder,
  needLabel,
  needTone,
  type FeatureId,
  type HouseView,
  type NeedLevel,
} from "@/lib/houseFeatures";
import { getService } from "@/lib/services";
import { whatsappLink, defaultWhatsAppMessage } from "@/lib/site";

/* ---- Simple, friendly flat-illustration houses (front + rear) ----
   Every hotspot sits on a drawn feature (porch, dormers, garage, side and rear
   extensions, garden room) — positions in houseFeatures.ts are % of 400x300. */
const GLASS = "#cfe0ea";
const WALL = "#fbf7f0";
const WALL_ALT = "#f1ebe0";

function HouseFront() {
  return (
    <svg viewBox="0 0 400 300" className="h-full w-full" role="presentation" aria-hidden>
      <rect width="400" height="300" fill="var(--color-paper)" />
      <rect y="250" width="400" height="50" fill="#e3e7e0" />
      {/* garage block (new garage / garage conversion) */}
      <rect x="20" y="170" width="90" height="80" fill={WALL} stroke="var(--color-line)" />
      <polygon points="15,170 65,140 115,170" fill="var(--color-accent)" />
      <rect x="30" y="195" width="70" height="55" fill="#ede6da" stroke="var(--color-line)" />
      <line x1="30" y1="208" x2="100" y2="208" stroke="var(--color-line)" />
      <line x1="30" y1="222" x2="100" y2="222" stroke="var(--color-line)" />
      <line x1="30" y1="236" x2="100" y2="236" stroke="var(--color-line)" />
      {/* main house */}
      <rect x="120" y="120" width="180" height="130" fill={WALL} stroke="var(--color-line)" />
      <polygon points="112,120 210,60 308,120" fill="var(--color-accent)" />
      <rect x="252" y="70" width="16" height="30" fill="#7a1414" />
      {/* front dormer */}
      <polygon points="186,86 210,72 234,86" fill="#7a1414" />
      <rect x="190" y="86" width="40" height="24" fill={WALL_ALT} stroke="var(--color-line)" />
      <rect x="197" y="91" width="26" height="15" fill={GLASS} stroke="var(--color-line)" />
      {/* first-floor windows */}
      <rect x="140" y="140" width="40" height="34" fill={GLASS} stroke="var(--color-line)" />
      <rect x="240" y="140" width="40" height="34" fill={GLASS} stroke="var(--color-line)" />
      {/* ground-floor window */}
      <rect x="140" y="200" width="40" height="34" fill={GLASS} stroke="var(--color-line)" />
      {/* front porch around the door */}
      <polygon points="182,198 213,182 244,198" fill="var(--color-accent)" />
      <rect x="186" y="198" width="54" height="52" fill={WALL_ALT} stroke="var(--color-line)" />
      <rect x="201" y="208" width="24" height="42" fill="#6b4a2b" />
      <rect x="190" y="210" width="8" height="22" fill={GLASS} stroke="var(--color-line)" />
      <rect x="228" y="210" width="8" height="22" fill={GLASS} stroke="var(--color-line)" />
      {/* single-storey side extension */}
      <rect x="300" y="186" width="72" height="64" fill={WALL_ALT} stroke="var(--color-line)" />
      <polygon points="296,186 300,178 372,178 376,186" fill="#7a1414" />
      <rect x="318" y="202" width="36" height="28" fill={GLASS} stroke="var(--color-line)" />
    </svg>
  );
}

function HouseRear() {
  return (
    <svg viewBox="0 0 400 300" className="h-full w-full" role="presentation" aria-hidden>
      <rect width="400" height="300" fill="var(--color-paper)" />
      <rect y="250" width="400" height="50" fill="#cfe0c4" />
      {/* main house */}
      <rect x="90" y="120" width="190" height="130" fill={WALL} stroke="var(--color-line)" />
      <polygon points="82,120 185,60 288,120" fill="var(--color-accent)" />
      {/* rear dormer */}
      <rect x="150" y="82" width="50" height="38" fill="#5b6066" stroke="#3a3d42" />
      <rect x="158" y="90" width="34" height="20" fill={GLASS} stroke="#3a3d42" />
      {/* two-storey rear projection with its own gable */}
      <polygon points="210,122 245,94 280,122" fill="#7a1414" />
      <rect x="214" y="122" width="62" height="128" fill={WALL_ALT} stroke="var(--color-line)" />
      <rect x="229" y="136" width="32" height="30" fill={GLASS} stroke="var(--color-line)" />
      <rect x="229" y="196" width="32" height="30" fill={GLASS} stroke="var(--color-line)" />
      {/* single-storey rear extension with roof lantern + bi-folds */}
      <rect x="96" y="190" width="110" height="60" fill={WALL_ALT} stroke="var(--color-line)" />
      <rect x="92" y="184" width="118" height="8" fill="#5b6066" />
      <polygon points="128,184 138,174 164,174 174,184" fill={GLASS} stroke="#5b6066" />
      <rect x="108" y="202" width="86" height="48" fill={GLASS} stroke="var(--color-line)" />
      <line x1="129" y1="202" x2="129" y2="250" stroke="var(--color-line)" />
      <line x1="151" y1="202" x2="151" y2="250" stroke="var(--color-line)" />
      <line x1="173" y1="202" x2="173" y2="250" stroke="var(--color-line)" />
      {/* garden room */}
      <rect x="306" y="192" width="78" height="58" fill="#eef0ec" stroke="var(--color-line)" />
      <rect x="302" y="186" width="86" height="7" fill="#5b6066" />
      <rect x="314" y="202" width="62" height="40" fill={GLASS} stroke="var(--color-line)" />
    </svg>
  );
}

const toneClass = {
  strong: "border-accent-strong/30 bg-accent-soft text-accent-deep",
  mid: "border-line bg-paper text-ink",
  light: "border-success/30 bg-success/10 text-success",
} as const;

function NeedBadge({ label, level }: { label: string; level: NeedLevel }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium " +
        toneClass[needTone(level)]
      }
    >
      <span className="font-semibold">{label}:</span> {needLabel[level]}
    </span>
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
        {/* Announce the selected feature to screen readers without stealing focus. */}
        <p className="sr-only" role="status" aria-live="polite">
          {feat ? `Showing ${feat.label}: ${feat.headline}.` : ""}
        </p>
        {feat ? (
          <div className="rounded-lg border border-line bg-paper-card p-6 shadow-card">
            <h3 className="text-xl">{feat.label}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <NeedBadge label="Planning" level={feat.needs.planning} />
              <NeedBadge label="Building regs" level={feat.needs.buildingRegs} />
            </div>
            <p className="mt-3 font-medium text-accent-strong">{feat.headline}</p>
            <p className="mt-3 text-pretty text-muted">{feat.summary}</p>
            <p className="mt-3 text-pretty text-sm text-muted">
              <strong className="text-ink">Building control:</strong> {feat.buildingRegs}
            </p>
            <p className="mt-3 text-pretty text-sm text-muted">
              <strong className="text-ink">What we&apos;d typically prepare:</strong>{" "}
              {feat.scPackage}
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
                Not sure how this applies to your home? Send Sean your name and one way to contact you
                for an honest first view — with no obligation. A postcode and photos help if you have
                them, but aren&apos;t required to start.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link
                  href="/contact?source_type=guide&source_page=/homeowners-guide"
                  data-conversion="guide-cta"
                  className="inline-flex h-10 items-center rounded-full bg-accent-strong px-5 text-sm font-medium text-white hover:bg-accent-deep"
                >
                  Ask Sean for an honest first view
                </Link>
                <a
                  href={whatsappLink(defaultWhatsAppMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-conversion="whatsapp-click"
                  className="inline-flex h-10 items-center rounded-full border border-line bg-white px-5 text-sm font-medium text-ink hover:bg-paper-card"
                >
                  WhatsApp Sean
                </a>
              </div>
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
