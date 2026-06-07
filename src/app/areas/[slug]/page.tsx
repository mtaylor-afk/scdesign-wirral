import { notFound } from "next/navigation";
import Link from "next/link";
import { Container, Section, SectionHeading, Card, LinkButton, Badge } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { FAQList } from "@/components/ui/FAQItem";
import { JsonLd } from "@/components/JsonLd";
import { locations, getLocation } from "@/lib/locations";
import { services, getService } from "@/lib/services";
import { cta, site } from "@/lib/site";
import { pageMeta, breadcrumbJsonLd, serviceJsonLd, faqJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return locations.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loc = getLocation(slug);
  if (!loc)
    return pageMeta({ title: "Area", description: "", path: `/areas/${slug}`, noindex: true });
  return pageMeta({
    title: loc.metaTitle ?? `Architectural Design in ${loc.name}`,
    description:
      loc.metaDescription ??
      `Architectural design, house extensions, loft conversions and planning drawings for ${loc.name} homeowners. ${site.yearsExperience}+ years' experience, based on Wirral.`,
    path: `/areas/${slug}`,
  });
}

function Prose({ heading, paras }: { heading: string; paras?: string[] }) {
  if (!paras || paras.length === 0) return null;
  return (
    <div>
      <h2 className="text-xl">{heading}</h2>
      {paras.map((p, i) => (
        <p key={i} className="mt-3 text-pretty text-muted">
          {p}
        </p>
      ))}
    </div>
  );
}

export default async function AreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loc = getLocation(slug);
  if (!loc) notFound();

  // Relevant services: explicit list if set, else all.
  const relevant = (loc.relevantServices?.map(getService).filter(Boolean) as typeof services) ?? services;

  // Nearby: explicit list if set, else first few other areas.
  const nearby = (loc.nearby
    ?.map((s) => locations.find((l) => l.slug === s))
    .filter(Boolean) as typeof locations) ?? locations.filter((l) => l.slug !== slug).slice(0, 6);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Areas", path: "/areas" },
            { name: loc.name, path: `/areas/${slug}` },
          ]),
          serviceJsonLd(`Architectural design in ${loc.name}`, loc.intro, `/areas/${slug}`),
          faqJsonLd(loc.faqs),
        ]}
      />

      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Areas", path: "/areas" },
              { name: loc.name, path: `/areas/${slug}` },
            ]}
          />
          <Badge>Architectural design · {loc.name}</Badge>
          <h1 className="mt-4 text-balance text-4xl sm:text-5xl">
            Architectural design in {loc.name}
          </h1>
          <p className="mt-5 text-pretty text-lg text-muted">{loc.intro}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <LinkButton href={cta.primary.href}>{cta.primary.label}</LinkButton>
            <LinkButton href={cta.visualiser.href} variant="ghost">
              {cta.visualiser.label}
            </LinkButton>
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl space-y-10">
          <p className="text-pretty text-lg text-muted">{loc.local}</p>
          <Prose heading={`Homes in ${loc.name}`} paras={loc.propertyContext} />
          <Prose heading="Local planning context" paras={loc.localPlanning} />
          {loc.sections?.map((s) => <Prose key={s.heading} heading={s.heading} paras={s.body} />)}
          <div>
            <h2 className="text-xl">How we help in {loc.name}</h2>
            <ul className="mt-4 space-y-2">
              {loc.emphasis.map((e) => (
                <li key={e} className="flex gap-3 text-ink">
                  <span className="text-accent-strong" aria-hidden>
                    ◆
                  </span>
                  {e}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      <Section tone="card">
        <Container>
          <SectionHeading eyebrow="Services" title={`Our services for ${loc.name} homes`} />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {relevant.map((s) => (
              <Card key={s.slug} hover>
                <h3 className="text-lg">
                  <Link href={`/services/${s.slug}`} className="hover:text-accent-strong">
                    {s.h1 ?? s.title}
                  </Link>
                </h3>
                <p className="mt-2 text-sm text-muted">{s.blurb}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl">
          <SectionHeading eyebrow="Questions" title={`${loc.name} — common questions`} />
          <div className="mt-8">
            <FAQList faqs={loc.faqs} />
          </div>
        </Container>
      </Section>

      <Section tone="card">
        <Container>
          <h2 className="text-xl">Nearby areas we cover</h2>
          <ul className="mt-4 flex flex-wrap gap-2.5">
            {nearby.map((o) => (
              <li key={o.slug}>
                <Link
                  href={`/areas/${o.slug}`}
                  className="inline-flex rounded-full border border-line bg-paper-card px-4 py-2 text-sm text-ink-soft hover:border-accent hover:text-accent-strong"
                >
                  {o.name}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <CTASection
        heading={`Designing a project in ${loc.name}?`}
        sub={`Send Sean your ${loc.name} postcode and a few photos — you'll get an honest first view with no obligation.`}
      />
    </>
  );
}
