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
import { withBase } from "@/lib/base";
import { whatsappLink, defaultWhatsAppMessage } from "@/lib/site";

/* ---- House illustrations (front + rear) ----
   Photo-real isometric illustrations supplied with Sean's Sep 2026 brief,
   replacing the earlier hand-drawn SVGs. Paths and sizes are inlined rather
   than imported from lib/media so this client component does not pull the whole
   work-images map into the browser bundle. Hotspot positions in houseFeatures.ts
   are percentages of this box, measured against these two images. */
const HOUSE_VIEWS = {
  front: {
    src: "/guide/house-front.jpg",
    width: 1198,
    height: 796,
    alt: "Illustration of a house from the front, showing a porch, garage, side extension, front dormer and rear extension",
  },
  rear: {
    src: "/guide/house-rear.jpg",
    width: 1379,
    height: 920,
    alt: "Illustration of the same house from the rear, showing a rear dormer, single-storey rear extension and a garden room",
  },
} as const;
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
  const visible = featureOrder.filter((id) => houseFeatures[id].view.includes(view));
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
          <div className="aspect-[3/2] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={withBase(HOUSE_VIEWS[view].src)}
              alt={HOUSE_VIEWS[view].alt}
              width={HOUSE_VIEWS[view].width}
              height={HOUSE_VIEWS[view].height}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
          {visible.map((id) => {
            const f = houseFeatures[id];
            const isActive = active === id;
            const pos = view === "rear" && f.posRear ? f.posRear : f.pos;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={isActive}
                aria-label={f.label}
                onClick={() => setActive(id)}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
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
                      // A feature on both views keeps whichever is showing.
                      if (!f.view.includes(view)) setView(f.view[0]);
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
