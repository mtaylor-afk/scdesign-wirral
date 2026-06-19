import Link from "next/link";
import { Container, Section, SectionHeading, Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { InteractiveHouse } from "@/components/ui/InteractiveHouse";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";

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
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Homeowners Guide", path: "/homeowners-guide" },
        ])}
      />

      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Homeowners Guide", path: "/homeowners-guide" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">Will my project need planning permission?</h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            Click a feature on the house — a porch, dormer, garage, extension or garden room — for a
            plain-English answer on whether it usually needs planning permission and building
            regulations, with a link to the official guidance.
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
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-white">
                {pdRows.map((r) => (
                  <tr key={r.project}>
                    <td className="px-4 py-3 text-ink-soft">{r.project}</td>
                    <td className="px-4 py-3 text-muted">{r.planning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 rounded-[var(--radius)] border border-accent-soft bg-accent-soft/40 p-4 text-sm text-ink-soft">
            <strong className="text-ink">Cover Wales too?</strong> We design for homes across North
            Wales as well — permitted-development rules differ there, so the guidance above is for
            England. Send us your address and we&apos;ll confirm the right route for your property.
          </p>
        </Container>
      </Section>

      {/* Deeper guides */}
      <Section>
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
        sub="Send Sean your postcode and a short description — you'll get an honest first view of the likely planning route, with no obligation."
      />
    </>
  );
}
