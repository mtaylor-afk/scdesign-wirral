import Link from "next/link";
import { Container, Section, SectionHeading, Card, Badge } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { guides, guideCategories, type Guide } from "@/lib/guides";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";

// Short badge labels per section (the full category labels are too long for a chip).
const categoryBadge: Record<NonNullable<Guide["category"]>, string> = {
  planning: "Planning",
  "pd-ldc": "PD & LDC",
  "building-regs": "Building regs",
  project: "Project",
  "cost-process": "Costs & process",
  "local-buying": "Local & buying",
};

export const metadata = pageMeta({
  title: "Guides — Planning, Building Regs & Home Design in Wirral",
  description:
    "Plain-English guides for Wirral homeowners on planning permission, building regulations, architectural design costs, conservation areas and choosing the right help.",
  path: "/guides",
});

export default function GuidesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
        ])}
      />
      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Guides", path: "/guides" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">Helpful guides for your project</h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            Honest, plain-English answers to the questions Wirral homeowners ask most — planning,
            building regulations, costs, conservation areas and how the design stage works.
          </p>
        </Container>
      </Section>

      <Section>
        <Container>
          <Link href="/homeowners-guide" className="group block">
            <Card
              hover
              className="flex flex-col gap-3 border-accent-soft bg-accent-soft/30 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <Badge className="self-start">Interactive</Badge>
                <h2 className="mt-2 text-2xl">Will my project need planning permission?</h2>
                <p className="mt-1 text-pretty text-muted">
                  Click a porch, dormer, extension, garage or garden room on our interactive house
                  for a plain-English answer.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-accent-strong transition-[gap] group-hover:gap-2.5">
                Open the guide <span aria-hidden>→</span>
              </span>
            </Card>
          </Link>
        </Container>
      </Section>

      {guideCategories.map((cat, idx) => {
        const group = guides.filter((g) => g.category === cat.key && !g.draft);
        if (group.length === 0) return null;
        return (
          <Section key={cat.key} tone={idx % 2 === 0 ? "paper" : "card"}>
            <Container>
              <SectionHeading eyebrow={cat.label} title={cat.label} intro={cat.blurb} />
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                {group.map((g) => (
                  <Link key={g.slug} href={`/guides/${g.slug}`} className="group block">
                    <Card hover className="flex h-full flex-col">
                      <Badge className="self-start">{categoryBadge[cat.key]}</Badge>
                      <h3 className="mt-3 text-xl">{g.title}</h3>
                      <p className="mt-3 flex-1 text-pretty text-muted">
                        {g.summary ?? g.description}
                      </p>
                      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong transition-[gap] group-hover:gap-2.5">
                        Read the guide <span aria-hidden>→</span>
                      </span>
                    </Card>
                  </Link>
                ))}
              </div>
            </Container>
          </Section>
        );
      })}

      <CTASection />
    </>
  );
}
