import Link from "next/link";
import { Container, Section, SectionHeading } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";
import { WorkFigure, WorkGallery } from "@/components/ui/WorkGallery";
import { JsonLd } from "@/components/JsonLd";
import { beforeAfterProjects } from "@/lib/projects";
import { wi, type WorkImage } from "@/lib/media";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Before & After — Extensions, Lofts & Garage Conversions",
  description:
    "Before-and-after photos and drawings of real SC Design Wirral projects — loft conversions, garage conversions and extensions, from existing house to finished build.",
  path: "/before-and-after",
});

// More real completed work (photos) — minimal captions, visuals first.
const moreWork: WorkImage[] = [
  wi("loftTileHung", "Tile-hung dormer"),
  wi("loftTimberClad", "Timber-clad dormer"),
  wi("loftRear", "Rear loft conversion"),
  wi("extRearPebbledash", "Rear extension"),
  wi("extCorner", "Rear extension"),
  wi("garage2After", "Garage conversion & porch"),
];

function stageLabel(img: WorkImage, fallback: string) {
  return img.caption ?? fallback;
}

export default function BeforeAndAfterPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Before & after", path: "/before-and-after" },
        ])}
      />
      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Before & after", path: "/before-and-after" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">Before &amp; after</h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            Real projects, from the existing house or the proposed drawing to the finished result.
            Every image is labelled — for the full story behind each one, read the case study.
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="space-y-16">
          {beforeAfterProjects.map((p) => {
            const set = p.beforeAfter!;
            const panels = [
              set.before && { img: set.before, label: stageLabel(set.before, "Before") },
              set.drawing && { img: set.drawing, label: stageLabel(set.drawing, "Proposed drawing") },
              { img: set.after, label: stageLabel(set.after, "After") },
            ].filter((x): x is { img: WorkImage; label: string } => Boolean(x));
            return (
              <article key={p.slug} id={p.slug} aria-labelledby={`${p.slug}-title`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2 id={`${p.slug}-title`} className="text-2xl">
                    {set.label}
                  </h2>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-strong">
                    {p.town} · {p.projectType}
                  </p>
                </div>
                {set.aligned && set.before ? (
                  <div className="mt-6 max-w-3xl">
                    <BeforeAfterSlider
                      before={set.before.src}
                      after={set.after.src}
                      beforeAlt={set.before.alt}
                      afterAlt={set.after.alt}
                      caption={`Before → ${set.after.kind === "render" ? "design visualisation" : "after"}. Drag to compare.`}
                    />
                  </div>
                ) : (
                  <div
                    className={
                      "mt-6 grid gap-5 " + (panels.length >= 3 ? "md:grid-cols-3" : "sm:grid-cols-2")
                    }
                  >
                    {panels.map(({ img, label }) => (
                      <WorkFigure
                        key={img.src}
                        image={{ ...img, caption: label }}
                        zoom={img.kind === "drawing"}
                      />
                    ))}
                  </div>
                )}
                <Link
                  href={`/projects/${p.slug}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong"
                >
                  Read the case study <span aria-hidden>→</span>
                </Link>
              </article>
            );
          })}
        </Container>
      </Section>

      <Section tone="mist">
        <Container>
          <SectionHeading
            eyebrow="More of our work"
            title="Finished projects"
            intro="Completed lofts, extensions and conversions designed by SC Design Wirral and built by the homeowners' own builders."
          />
          <WorkGallery images={moreWork} className="mt-8" />
          <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/projects" className="font-medium text-accent-strong underline">
              Read the case studies
            </Link>
            <Link href="/portfolio" className="font-medium text-accent-strong underline">
              Design visualisations
            </Link>
          </p>
        </Container>
      </Section>

      <CTASection heading="Want results like these?" />
    </>
  );
}
