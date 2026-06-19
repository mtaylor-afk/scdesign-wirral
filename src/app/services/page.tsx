import Link from "next/link";
import { Container, Section, SectionHeading } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ServiceCard } from "@/components/ui/ServiceCard";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { services, serviceCategories } from "@/lib/services";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Architectural Design Services Wirral",
  description:
    "Architectural design services for Wirral homeowners: house extension drawings, loft conversion design, planning drawings, building-regulations drawings and more.",
  path: "/services",
});

// Situation → recommended service (plain-English "which do I need?" table).
const situations: { when: string; service: string; href: string }[] = [
  {
    when: "I have an idea but want to explore what's possible",
    service: "Concept & feasibility",
    href: "/services/concept-design-feasibility",
  },
  {
    when: "I want one designer from concept to approval",
    service: "Full architectural design",
    href: "/services/residential-design",
  },
  {
    when: "I need accurate drawings of my existing home",
    service: "Measured building survey",
    href: "/services/measured-building-surveys",
  },
  {
    when: "I need planning permission",
    service: "Planning drawings",
    href: "/services/planning-drawings-wirral",
  },
  {
    when: "I want a builder to quote, or building control asked for drawings",
    service: "Building regulations drawings",
    href: "/services/building-regulations-drawings-wirral",
  },
  {
    when: "I think it's permitted development",
    service: "Permitted development guide",
    href: "/guides/permitted-development-rights-wirral",
  },
  {
    when: "I want a garden room or studio",
    service: "Bespoke garden room design",
    href: "/services/bespoke-garden-room-design",
  },
  {
    when: "My home is in a conservation area",
    service: "Conservation area guide",
    href: "/guides/conservation-area-extensions-wirral",
  },
];

export default function ServicesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
        ])}
      />
      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Services", path: "/services" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">
            Architectural Design Services in Wirral
          </h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            From first ideas to planning drawings and building-regulations drawings, we help
            homeowners across Wirral understand what their project needs and prepare clear
            information for planning, building control and builders. We design only — we don&apos;t
            carry out the building work.
          </p>
        </Container>
      </Section>

      {serviceCategories.map((cat, idx) => {
        const group = services.filter((s) => s.category === cat.key);
        if (group.length === 0) return null;
        return (
          <Section key={cat.key} tone={idx % 2 === 0 ? "paper" : "card"}>
            <Container>
              <SectionHeading eyebrow={cat.label} title={cat.label} intro={cat.blurb} />
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                {group.map((s) => (
                  <ServiceCard
                    key={s.slug}
                    title={s.h1 ?? s.title}
                    blurb={s.blurb}
                    href={`/services/${s.slug}`}
                  />
                ))}
              </div>
            </Container>
          </Section>
        );
      })}

      {/* Which service do I need? */}
      <Section tone="card">
        <Container className="max-w-3xl">
          <SectionHeading
            eyebrow="Not sure where to start?"
            title="Which service do I need?"
            intro="Find your situation below — it points you to the most relevant service. If in doubt, just send Sean your project idea and we'll point you the right way."
          />
          <div className="mt-8 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold text-ink">
                    Your situation
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-ink">
                    Where to look
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-white">
                {situations.map((row) => (
                  <tr key={row.when}>
                    <td className="px-4 py-3 text-ink-soft">{row.when}</td>
                    <td className="px-4 py-3">
                      <Link href={row.href} className="font-medium text-accent-strong hover:underline">
                        {row.service}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </Section>

      <CTASection />
    </>
  );
}
