import Link from "next/link";
import { Container, Section, SectionHeading, Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { coreLocations, widerLocations } from "@/lib/locations";
import { site } from "@/lib/site";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Areas Covered — Architectural Designer Wirral & Surrounding Areas",
  description:
    "SC Design & Construction is based in Wallasey and provides architectural design across Wirral and nearby areas — Wallasey, Birkenhead, Bebington, Heswall, West Kirby and more.",
  path: "/areas",
});

function AreaCard({
  name,
  slug,
  emphasis,
}: {
  name: string;
  slug: string;
  emphasis: string;
}) {
  return (
    <Card hover className="flex h-full flex-col">
      <h3 className="text-lg">
        <Link href={`/areas/${slug}`} className="hover:text-accent-strong">
          Architectural design in {name}
        </Link>
      </h3>
      <p className="mt-2 flex-1 text-sm text-muted">{emphasis}</p>
      <Link
        href={`/areas/${slug}`}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong"
      >
        {name} <span aria-hidden>→</span>
      </Link>
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
            Based in Wallasey, we provide architectural design across {site.serviceArea}. Choose your
            area below for local detail, or just send Sean your postcode and we&apos;ll confirm we
            cover you.
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
              <AreaCard key={l.slug} name={l.name} slug={l.slug} emphasis={l.emphasis[0]} />
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
              <AreaCard key={l.slug} name={l.name} slug={l.slug} emphasis={l.emphasis[0]} />
            ))}
          </div>
        </Container>
      </Section>

      <CTASection
        heading="Not sure if we cover you?"
        sub="Send Sean your postcode and a few photos — we'll confirm and give you an honest first view."
      />
    </>
  );
}
