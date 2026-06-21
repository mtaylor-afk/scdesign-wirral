import { notFound } from "next/navigation";
import Link from "next/link";
import { Container, Section, LinkButton } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { FAQList } from "@/components/ui/FAQItem";
import { JsonLd } from "@/components/JsonLd";
import { guides, getGuide } from "@/lib/guides";
import { services } from "@/lib/services";
import { locations } from "@/lib/locations";
import { ReviewedBy } from "@/components/ui/ReviewedBy";
import { cta } from "@/lib/site";
import { pageMeta, breadcrumbJsonLd, faqJsonLd, articleJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide)
    return pageMeta({ title: "Guide", description: "", path: `/guides/${slug}`, noindex: true });
  return pageMeta({
    title: guide.metaTitle ?? guide.title,
    description: guide.description,
    path: `/guides/${slug}`,
    noindex: guide.draft, // incomplete drafts are noindex (and excluded from the sitemap)
  });
}

function anchorId(heading: string) {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function relatedLabel(href: string) {
  const g = guides.find((gg) => `/guides/${gg.slug}` === href);
  if (g) return g.navLabel ?? g.title;
  const s = services.find((ss) => `/services/${ss.slug}` === href);
  if (s) return s.title;
  const l = locations.find((ll) => `/areas/${ll.slug}` === href);
  if (l) return `${l.name} (area we cover)`;
  const staticLabels: Record<string, string> = {
    "/process": "Our design process",
    "/about": "About SC Design",
    "/contact": "Contact Sean",
    "/visualiser": "Extension Concept Visualiser",
  };
  if (staticLabels[href]) return staticLabels[href];
  return href.replace(/^\//, "").replace(/-/g, " ").replace(/\//g, " · ");
}

// The bare minimum to start a useful conversation — shown on every guide.
const sendMinimum = [
  "Your name",
  "A phone number or email address",
  "A sentence about what you're thinking of doing",
];

// Helpful extras — useful if you already have them, but never required to start.
const sendHelpful = [
  "Your property postcode (helps Sean check the local planning context)",
  "A few photos of the area affected, inside and outside",
  "An estate-agent floorplan or any existing drawings, if you have them",
  "Any council, building-control or builder letters or emails, if relevant",
  "Whether the property is in a conservation area, listed, or has an Article 4 direction, if you know",
  "Whether you already have planning permission, building-control comments or builder quotes",
];

// Genuinely-useful official sources, chosen per guide category. URLs verified live.
const OFFICIAL = {
  planningPortal: { label: "Planning Portal", href: "https://www.planningportal.co.uk/" },
  govPlanning: {
    label: "GOV.UK — planning permission",
    href: "https://www.gov.uk/planning-permission-england-wales",
  },
  govBuildingRegs: {
    label: "GOV.UK — building regulations approval",
    href: "https://www.gov.uk/building-regulations-approval",
  },
  wirralPlanning: {
    label: "Wirral Council — planning & building control",
    href: "https://www.wirral.gov.uk/planning-and-building",
  },
  arb: { label: "Architects Registration Board (ARB)", href: "https://arb.org.uk/" },
} as const;

// Fallback official-source links by category. A guide can override these with its
// own `officialSources` array for page-specific sources.
function officialLinksFor(category?: string): { label: string; href: string }[] {
  switch (category) {
    case "planning":
      return [OFFICIAL.planningPortal, OFFICIAL.govPlanning, OFFICIAL.wirralPlanning];
    case "pd-ldc":
      return [OFFICIAL.planningPortal, OFFICIAL.govPlanning, OFFICIAL.wirralPlanning];
    case "building-regs":
      return [OFFICIAL.govBuildingRegs, OFFICIAL.planningPortal, OFFICIAL.wirralPlanning];
    case "project":
      return [OFFICIAL.planningPortal, OFFICIAL.wirralPlanning];
    case "local-buying":
      return [OFFICIAL.wirralPlanning, OFFICIAL.govPlanning];
    default:
      return [];
  }
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  // Per-guide sources take priority over the category fallback.
  const official = guide.officialSources ?? officialLinksFor(guide.category);
  // Optional mid-page (Zone B) contextual CTA target.
  const ctaService = guide.ctaService
    ? services.find((s) => `/services/${s.slug}` === guide.ctaService)
    : undefined;

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Guides", path: "/guides" },
            { name: guide.title, path: `/guides/${slug}` },
          ]),
          articleJsonLd({
            title: guide.title,
            description: guide.description,
            path: `/guides/${slug}`,
            reviewed: guide.reviewed,
          }),
          faqJsonLd(guide.faqs),
        ]}
      />

      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Guides", path: "/guides" },
              { name: guide.navLabel ?? guide.title, path: `/guides/${slug}` },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">{guide.title}</h1>
          <p className="mt-5 text-pretty text-lg text-muted">{guide.intro}</p>
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl">
          {/* In short */}
          {guide.summary && (
            <div className="rounded-[var(--radius)] border border-line bg-paper-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-strong">
                In short
              </p>
              <p className="mt-2 text-pretty text-ink-soft">{guide.summary}</p>
            </div>
          )}

          {/* CTA Zone A — early contact nudge */}
          <div className="mt-6 rounded-[var(--radius)] border border-accent-soft bg-accent-soft/30 p-5">
            <p className="text-pretty text-ink-soft">
              Not sure which route applies to your property? Send Sean your name and one way to
              contact you for an honest first view — with no obligation. A postcode, a few photos and
              a short description help if you have them, but aren&apos;t required to start.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <LinkButton href={cta.primary.href}>{cta.primary.label}</LinkButton>
              <LinkButton href={cta.whatsapp.href} variant="ghost" external>
                {cta.whatsapp.label}
              </LinkButton>
            </div>
          </div>

          {/* Author / reviewer attribution (E-E-A-T) */}
          <div className="mt-6">
            <ReviewedBy date={guide.reviewed} />
          </div>

          {/* Table of contents */}
          {guide.sections.length > 2 && (
            <nav aria-label="On this page" className="mt-6 rounded-[var(--radius)] border border-line p-5">
              <p className="text-sm font-semibold text-ink">On this page</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {guide.sections.map((s) => (
                  <li key={s.heading}>
                    <a href={`#${anchorId(s.heading)}`} className="text-accent-strong hover:underline">
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <div className="mt-10 space-y-10">
            {guide.sections.map((s) => (
              <div key={s.heading} id={anchorId(s.heading)} className="scroll-mt-24">
                <h2 className="text-2xl">{s.heading}</h2>
                {s.body.map((p, i) => (
                  <p key={i} className="mt-3 text-pretty text-muted">
                    {p}
                  </p>
                ))}
                {s.table && (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                      {s.table.caption && (
                        <caption className="mb-2 text-left text-sm text-muted">
                          {s.table.caption}
                        </caption>
                      )}
                      <thead>
                        <tr className="border-b border-line">
                          {s.table.headers.map((h) => (
                            <th key={h} scope="col" className="py-2 pr-4 font-semibold text-ink">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {s.table.rows.map((row, ri) => (
                          <tr key={ri} className="border-b border-line/60 align-top">
                            {row.map((cell, ci) => (
                              <td key={ci} className="py-2.5 pr-4 text-pretty text-muted">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* What to send Sean — minimum vs helpful extras */}
          <div className="mt-10 rounded-[var(--radius)] border border-line bg-paper-card p-5">
            <h2 className="text-xl">What to send Sean</h2>
            <p className="mt-2 text-sm text-muted">
              You don&apos;t need a full brief or drawings to get started — just your name and one way
              to contact you. The rest is optional, and you can send more whenever it suits you.
            </p>

            <h3 className="mt-5 text-sm font-semibold text-ink">Minimum to start</h3>
            <ul className="mt-2 space-y-2">
              {sendMinimum.map((t) => (
                <li key={t} className="flex gap-3 text-pretty text-muted">
                  <span className="mt-1 shrink-0 text-accent-strong" aria-hidden>
                    ◆
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <h3 className="mt-5 text-sm font-semibold text-ink">Helpful if you have them</h3>
            <ul className="mt-2 space-y-2">
              {sendHelpful.map((t) => (
                <li key={t} className="flex gap-3 text-pretty text-muted">
                  <span className="mt-1 shrink-0 text-accent-soft" aria-hidden>
                    ◇
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Advisory note */}
          <div className="mt-10 rounded-[var(--radius)] border border-accent-soft bg-accent-soft/40 p-4 text-sm text-ink-soft">
            This guide is general information for England and is not formal planning, legal or
            structural advice. Rules vary by property and location — always confirm your specific
            project with your local authority. Last reviewed {guide.reviewed}.
          </div>

          {/* CTA Zone B — mid-page, context-specific to the relevant service */}
          <div className="mt-10 rounded-[var(--radius)] border border-line bg-paper-card p-5">
            {ctaService && (
              <p className="text-pretty text-ink-soft">
                Need {ctaService.title.toLowerCase()}? We can prepare them — clear, coordinated and
                ready for builders and building control.
              </p>
            )}
            <div className={ctaService ? "mt-4 flex flex-wrap gap-3" : "flex flex-wrap gap-3"}>
              <LinkButton href={cta.primary.href}>{cta.primary.label}</LinkButton>
              {ctaService ? (
                <LinkButton href={`/services/${ctaService.slug}`} variant="ghost">
                  See our {ctaService.title} service
                </LinkButton>
              ) : (
                <LinkButton href={cta.visualiser.href} variant="ghost">
                  {cta.visualiser.label}
                </LinkButton>
              )}
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="card">
        <Container className="max-w-3xl">
          <h2 className="text-2xl">Common questions</h2>
          <div className="mt-6">
            <FAQList faqs={guide.faqs} />
          </div>

          <h2 className="mt-12 text-xl">Related</h2>
          <ul className="mt-4 flex flex-wrap gap-2.5">
            {guide.related.map((href) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex rounded-full border border-line bg-paper-card px-4 py-2 text-sm text-ink-soft hover:border-accent hover:text-accent-strong"
                >
                  {relatedLabel(href)}
                </Link>
              </li>
            ))}
          </ul>

          {official.length > 0 && (
            <>
              <h2 className="mt-12 text-xl">Useful official sources</h2>
              <ul className="mt-4 space-y-2 text-sm">
                {official.map((o) => (
                  <li key={o.href}>
                    <a
                      href={o.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-strong underline"
                    >
                      {o.label}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">
                External links open in a new tab. Always confirm your specific project with the
                relevant authority.
              </p>
            </>
          )}
        </Container>
      </Section>

      <CTASection track="guide-cta" />
    </>
  );
}
