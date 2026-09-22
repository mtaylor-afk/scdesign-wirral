import Link from "next/link";
import { Container, Section, SectionHeading, Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { KindTag } from "@/components/ui/WorkGallery";
import { coreLocations, widerLocations } from "@/lib/locations";
import { projectsForArea } from "@/lib/projects";
import { getService } from "@/lib/services";
import { serviceAreaRegions, townLink } from "@/lib/serviceAreas";
import { withBase } from "@/lib/base";
import { site } from "@/lib/site";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Areas Covered — Architectural Design Across Wirral & Surrounding Areas",
  description:
    "SC Design Wirral provides architectural design for homes across Wirral, Liverpool, Cheshire, Warrington and North Wales — from Wallasey, Birkenhead and Heswall to Chester, Warrington and Wrexham.",
  path: "/areas",
});

/**
 * Area card — Sean's brief asks for a strong local image, the town name, a
 * property-focused line, the most relevant services and a link.
 *
 * The image is the cover of a real SC Design project in that area rather than a
 * stock or third-party photograph: it is Sean's own work, it is genuinely local,
 * and there is no licensing question. Areas with no published project yet simply
 * show the text card.
 */
function AreaCard({
  name,
  slug,
  emphasis,
  relevantServices,
}: {
  name: string;
  slug: string;
  emphasis: string;
  relevantServices?: string[];
}) {
  const localProject = projectsForArea(slug, 1)[0];
  const cover = localProject?.cover;
  const topServices = (relevantServices ?? [])
    .map(getService)
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .slice(0, 3);

  return (
    <Card hover className="flex h-full flex-col overflow-hidden !p-0">
      {cover && (
        <Link href={`/areas/${slug}`} className="group relative block aspect-[3/2] w-full bg-paper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={withBase(cover.src)}
            alt={cover.alt}
            width={cover.width}
            height={cover.height}
            loading="lazy"
            decoding="async"
            className={
              "absolute inset-0 h-full w-full " +
              (cover.kind === "drawing" ? "bg-white object-contain p-2" : "object-cover")
            }
          />
          <KindTag kind={cover.kind} />
        </Link>
      )}
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-lg">
          <Link href={`/areas/${slug}`} className="hover:text-accent-strong">
            Architectural design in {name}
          </Link>
        </h3>
        <p className="mt-2 flex-1 text-pretty text-sm text-muted">{emphasis}</p>
        {topServices.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {topServices.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/services/${s.slug}`}
                  className="inline-flex rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft hover:border-accent hover:text-accent-strong"
                >
                  {s.short}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/areas/${slug}`}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong"
        >
          View {name} services <span aria-hidden>→</span>
        </Link>
      </div>
    </Card>
  );
}

export default function AreasPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Areas", path: "/areas" },
        ])}
      />
      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Areas", path: "/areas" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">
            Architectural Design Across Wirral &amp; Surrounding Areas
          </h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            We provide architectural design across {site.serviceArea}. Choose your area below for
            local detail, or just send Sean your postcode and we&apos;ll confirm we cover you.
          </p>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeading
            eyebrow="Our home patch"
            title="Core Wirral areas"
            intro="Where we're most local — Wallasey and the surrounding Wirral towns and villages."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coreLocations.map((l) => (
              <AreaCard
                key={l.slug}
                name={l.name}
                slug={l.slug}
                emphasis={l.emphasis[0]}
                relevantServices={l.relevantServices}
              />
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="card">
        <Container>
          <SectionHeading
            eyebrow="Further afield"
            title="Wider surrounding areas"
            intro="We also work across these neighbouring areas. Note that some fall under a different local planning authority, which we account for in your drawings."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {widerLocations.map((l) => (
              <AreaCard
                key={l.slug}
                name={l.name}
                slug={l.slug}
                emphasis={l.emphasis[0]}
                relevantServices={l.relevantServices}
              />
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeading
            eyebrow="Full coverage"
            title="Everywhere we work"
            intro="We design for homes across the Wirral peninsula, Liverpool, Cheshire, Warrington and North Wales. Towns with a link have a local page; we cover the rest too — just send your postcode."
          />
          {(["main", "secondary"] as const).map((tier) => (
          <div key={tier} className="mt-10">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-strong">
            {tier === "main" ? "Main areas" : "Also covering"}
          </h3>
          <div className="mt-4 grid gap-8 sm:grid-cols-2">
            {serviceAreaRegions.filter((r) => r.tier === tier).map((r) => (
              <div key={r.region}>
                <h3 className="text-lg text-ink">{r.region}</h3>
                {r.note && <p className="mt-1 text-xs text-muted">{r.note}</p>}
                <ul className="mt-3 flex flex-wrap gap-2">
                  {r.towns.map((t) => {
                    const href = townLink(t);
                    return (
                      <li key={t}>
                        {href ? (
                          <Link
                            href={href}
                            className="inline-flex rounded-full border border-line bg-paper-card px-3 py-1 text-sm text-accent-strong hover:border-accent"
                          >
                            {t}
                          </Link>
                        ) : (
                          <span className="inline-flex rounded-full border border-line bg-paper-card px-3 py-1 text-sm text-ink-soft">
                            {t}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          </div>
          ))}
        </Container>
      </Section>

      <CTASection
        heading="Not sure if we cover you?"
        sub="Send Sean your name and one way to contact you — he'll confirm and give you an honest first view. A postcode helps him check, but isn't required to start."
      />
    </>
  );
}
