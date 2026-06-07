import { notFound } from "next/navigation";
import Link from "next/link";
import { Container, Section, SectionHeading, Card, LinkButton } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { FAQList } from "@/components/ui/FAQItem";
import { JsonLd } from "@/components/JsonLd";
import { services, getService } from "@/lib/services";
import { guides } from "@/lib/guides";
import { cta } from "@/lib/site";
import { pageMeta, breadcrumbJsonLd, serviceJsonLd, faqJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service)
    return pageMeta({
      title: "Service",
      description: "",
      path: `/services/${slug}`,
      noindex: true,
    });
  return pageMeta({
    title: service.metaTitle ?? service.title,
    description: service.metaDescription ?? service.blurb,
    path: `/services/${slug}`,
  });
}

function relatedServiceCards(slugs: string[] = []) {
  return slugs.map((s) => getService(s)).filter((s): s is NonNullable<typeof s> => Boolean(s));
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2.5">
      {items.map((it) => (
        <li key={it} className="flex gap-3 text-pretty text-ink-soft">
          <span className="mt-1 shrink-0 text-accent-strong" aria-hidden>
            ◆
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Prose({ heading, paras }: { heading: string; paras?: string[] }) {
  if (!paras || paras.length === 0) return null;
  return (
    <div>
      <h2 className="text-2xl">{heading}</h2>
      {paras.map((p, i) => (
        <p key={i} className="mt-3 text-pretty text-muted">
          {p}
        </p>
      ))}
    </div>
  );
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const related = relatedServiceCards(service.relatedServices);
  const relatedGuidePaths = service.relatedGuides ?? [];
  const heading = service.h1 ?? service.title;

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Services", path: "/services" },
            { name: service.title, path: `/services/${slug}` },
          ]),
          serviceJsonLd(service.title, service.blurb, `/services/${slug}`),
          faqJsonLd(service.faqs),
        ]}
      />

      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Services", path: "/services" },
              { name: service.title, path: `/services/${slug}` },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">{heading}</h1>
          <p className="mt-5 text-pretty text-lg text-muted">{service.intro}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <LinkButton href={cta.primary.href}>{cta.primary.label}</LinkButton>
            <LinkButton href={cta.visualiser.href} variant="ghost">
              {cta.visualiser.label}
            </LinkButton>
          </div>
        </Container>
      </Section>

      {/* Who this is for / what's included / what may be separate */}
      {(service.whoFor || service.included || service.notIncluded) && (
        <Section>
          <Container className="max-w-3xl space-y-10">
            {service.whoFor && (
              <div>
                <h2 className="text-2xl">Who this is for</h2>
                <BulletList items={service.whoFor} />
              </div>
            )}
            <div className="grid gap-6 sm:grid-cols-2">
              {service.included && (
                <Card>
                  <h2 className="text-xl">What&apos;s included</h2>
                  <BulletList items={service.included} />
                </Card>
              )}
              {service.notIncluded && (
                <Card>
                  <h2 className="text-xl">What may be separate</h2>
                  <BulletList items={service.notIncluded} />
                </Card>
              )}
            </div>
          </Container>
        </Section>
      )}

      {/* Points grid (always present) */}
      <Section tone={service.whoFor ? "card" : "paper"}>
        <Container>
          <SectionHeading eyebrow="What we do" title={`How we help — ${service.short}`} />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {service.points.map((p) => (
              <Card key={p.title}>
                <h3 className="text-xl">{p.title}</h3>
                <p className="mt-2 text-pretty text-muted">{p.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* Planning / building regs / local / send-first / extra prose */}
      {(service.planningRoute ||
        service.buildingRegsRoute ||
        service.localConsiderations ||
        service.sendFirst ||
        service.sections) && (
        <Section>
          <Container className="max-w-3xl space-y-10">
            <Prose heading="Planning permission route" paras={service.planningRoute} />
            <Prose heading="Building regulations route" paras={service.buildingRegsRoute} />
            {service.sections?.map((s) => <Prose key={s.heading} heading={s.heading} paras={s.body} />)}
            <Prose
              heading={`Local considerations across ${"Wirral"}`}
              paras={service.localConsiderations}
            />
            {service.sendFirst && (
              <div>
                <h2 className="text-2xl">What to send us first</h2>
                <BulletList items={service.sendFirst} />
              </div>
            )}
          </Container>
        </Section>
      )}

      <Section tone="card">
        <Container className="max-w-3xl">
          <SectionHeading eyebrow="Questions" title={`${service.short} — common questions`} />
          <div className="mt-8">
            <FAQList faqs={service.faqs} />
          </div>
        </Container>
      </Section>

      {/* Related services + guides */}
      {(related.length > 0 || relatedGuidePaths.length > 0) && (
        <Section>
          <Container className="max-w-3xl">
            {related.length > 0 && (
              <>
                <h2 className="text-xl">Related services</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {related.map((r) => (
                    <Card key={r.slug} hover>
                      <h3 className="text-lg">
                        <Link
                          href={`/services/${r.slug}`}
                          className="hover:text-accent-strong"
                        >
                          {r.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-sm text-muted">{r.blurb}</p>
                    </Card>
                  ))}
                </div>
              </>
            )}
            {relatedGuidePaths.length > 0 && (
              <>
                <h2 className="mt-10 text-xl">Helpful guides</h2>
                <ul className="mt-4 flex flex-wrap gap-2.5">
                  {relatedGuidePaths.map((href) => {
                    const g = guides.find((gg) => `/guides/${gg.slug}` === href);
                    const label = g
                      ? (g.navLabel ?? g.title)
                      : href.replace(/^\//, "").replace(/-/g, " ").replace(/\//g, " · ");
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          className="inline-flex rounded-full border border-line bg-paper-card px-4 py-2 text-sm text-ink-soft hover:border-accent hover:text-accent-strong"
                        >
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Container>
        </Section>
      )}

      <CTASection />
    </>
  );
}
