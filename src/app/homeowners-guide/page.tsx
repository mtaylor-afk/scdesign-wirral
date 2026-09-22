import Link from "next/link";
import { Container, Section, SectionHeading, Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { InteractiveHouse } from "@/components/ui/InteractiveHouse";
import { CTASection } from "@/components/ui/CTASection";
import { FAQList } from "@/components/ui/FAQItem";
import { JsonLd } from "@/components/JsonLd";
import { generalFaqs } from "@/lib/faqs";
import { pageMeta, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo";

// Planning / PD / building-regs / conservation FAQs (incl. the house-feature ones).
const guideFaqs = generalFaqs.filter((f) =>
  ["planning", "permitted-development", "building-regs", "conservation"].includes(f.category)
);

export const metadata = pageMeta({
  title: "Homeowners Guide — Do I Need Planning Permission?",
  description:
    "An interactive guide to home projects across Wirral — click a porch, dormer, extension, garage or garden room to see whether it usually needs planning permission and building regulations (England).",
  path: "/homeowners-guide",
});

// Permitted-development quick-reference (England, householder). Hedged guidance.
const pdRows: { project: string; planning: string }[] = [
  { project: "Single-storey rear, 3m (semi/terrace)", planning: "Often permitted development" },
  { project: "Single-storey rear, 4m (detached)", planning: "Often permitted development" },
  { project: "Single-storey rear, up to 6m (semi/terrace)", planning: "Prior approval route" },
  { project: "Single-storey rear, up to 8m (detached)", planning: "Prior approval route" },
  { project: "Single-storey rear, larger than 6m / 8m", planning: "Planning permission needed" },
  { project: "Two-storey rear, up to 3m (7m from boundary)", planning: "Can be permitted development" },
  { project: "Two-storey rear, over 3m", planning: "Planning permission needed" },
  { project: "Two-storey side extension", planning: "Planning permission needed" },
  { project: "Anything on designated land (e.g. conservation area)", planning: "Usually needs permission" },
];

// Deeper homeowner guides (existing).
const deeperGuides: { label: string; href: string }[] = [
  { label: "Do I need planning permission?", href: "/guides/do-i-need-planning-permission-for-an-extension" },
  { label: "Do I need building regulations?", href: "/guides/do-i-need-building-regulations-approval" },
  { label: "Permitted development rights in Wirral", href: "/guides/permitted-development-rights-wirral" },
  { label: "Planning drawings vs building regulations", href: "/guides/planning-drawings-vs-building-regulations-drawings" },
  { label: "What drawings do builders need?", href: "/guides/what-drawings-do-builders-need" },
  { label: "All homeowner guides", href: "/guides" },
];

export default function HomeownersGuidePage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Homeowners Guide", path: "/homeowners-guide" },
          ]),
          faqJsonLd(guideFaqs),
        ]}
      />

      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Homeowners Guide", path: "/homeowners-guide" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">
            Will My Project Need Planning Permission?
          </h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            Explore the house below and select a porch, dormer, garage conversion, extension or
            garden room for straightforward guidance on whether planning permission and Building
            Regulations approval are likely to be required. Each section also includes a link to the
            relevant official guidance, helping you understand the requirements before starting your
            project.
          </p>
          <p className="mt-4 text-pretty text-muted">
            Click a feature on our interactive house and see whether your proposed design needs
            planning permission and/or building regulations, with links to the official guidance.
          </p>
        </Container>
      </Section>

      {/* Interactive house */}
      <Section>
        <Container>
          <InteractiveHouse />
        </Container>
      </Section>

      {/* PD quick-reference table */}
      <Section tone="card">
        <Container className="max-w-3xl">
          <SectionHeading
            eyebrow="Quick reference"
            title="Rear extensions — at a glance"
            intro="A rough guide for England. Limits on height, coverage and boundaries also apply, and the prior-approval route means the council notifies neighbours first. Always confirm with Wirral Council (or your local planning authority)."
          />
          <div className="mt-8 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold text-ink">Project</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-ink">Planning</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-ink">Building regs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-white">
                {pdRows.map((r) => (
                  <tr key={r.project}>
                    <td className="px-4 py-3 text-ink-soft">{r.project}</td>
                    <td className="px-4 py-3 text-muted">{r.planning}</td>
                    <td className="px-4 py-3 text-muted">Needed</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm font-medium text-ink-soft">
            All of these need building-regulations approval — even when planning permission
            isn&apos;t required.
          </p>
          <p className="mt-4 rounded-[var(--radius)] border border-accent-soft bg-accent-soft/40 p-4 text-sm text-ink-soft">
            <strong className="text-ink">Cover Wales too?</strong> We design for homes across North
            Wales as well — permitted-development rules differ there, so the guidance above is for
            England. Get in touch and we&apos;ll confirm the right route for your property — a
            postcode helps, but isn&apos;t required to start.
          </p>
        </Container>
      </Section>

      {/* FAQs — accordions (Sean's brief: "add these at the bottom") */}
      <Section>
        <Container className="max-w-3xl">
          <SectionHeading
            eyebrow="Good to know"
            title="Planning & building regs — common questions"
            align="center"
          />
          <div className="mt-8">
            <FAQList faqs={guideFaqs} />
          </div>
          <p className="mt-8 text-center text-sm text-muted">
            <Link href="/faqs" className="font-medium text-accent-strong underline">
              See all FAQs
            </Link>
          </p>
        </Container>
      </Section>

      {/* Deeper guides */}
      <Section tone="card">
        <Container className="max-w-3xl">
          <SectionHeading eyebrow="Go deeper" title="Homeowner guides" />
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {deeperGuides.map((g) => (
              <Card key={g.href} hover>
                <Link href={g.href} className="font-medium text-ink hover:text-accent-strong">
                  {g.label} <span aria-hidden>→</span>
                </Link>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <CTASection
        heading="Not sure what applies to your property?"
        sub="Send Sean your name and one way to contact you — you'll get an honest first view of the likely planning route, with no obligation. A postcode and photos help if you have them, but aren't required to start."
        ctaHref="/contact?source_type=consultation&source_page=/homeowners-guide"
      />
    </>
  );
}
