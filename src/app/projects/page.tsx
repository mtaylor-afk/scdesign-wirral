import Link from "next/link";
import { Container, Section, SectionHeading, Card, LinkButton } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { projects, projectPlaceholders } from "@/lib/projects";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Projects & Case Studies — Architectural Design Wirral",
  description:
    "Real architectural design case studies from across Wirral. Project case studies are being prepared — in the meantime, see our clearly-labelled concept visualisations.",
  path: "/projects",
});

// What a real, permissioned case study will set out — shown so the placeholders
// read as an honest "here's what's coming", not as completed work.
const caseStudyIncludes = [
  "The general area (never a full street address)",
  "The property type",
  "The project type",
  "The homeowner's brief",
  "The constraints we worked with",
  "The planning route taken",
  "The drawings prepared",
  "The outcome",
  "What other homeowners can learn from it",
];

export default function ProjectsPage() {
  const hasReal = projects.length > 0;
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Projects", path: "/projects" },
        ])}
      />
      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Projects", path: "/projects" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">Projects &amp; case studies</h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            Real project case studies from homes across Wirral — the brief, the design response, the
            planning route and the drawings prepared. We only show genuine projects here, with the
            homeowner&apos;s permission.
          </p>
        </Container>
      </Section>

      {hasReal ? (
        <Section>
          <Container>
            <div className="grid gap-6 sm:grid-cols-2">
              {projects.map((p) => (
                <Card key={p.slug} hover className="flex h-full flex-col">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-strong">
                    {p.town} · {p.projectType}
                  </p>
                  <h2 className="mt-2 text-xl">
                    <Link href={`/projects/${p.slug}`} className="hover:text-accent-strong">
                      {p.title}
                    </Link>
                  </h2>
                  <p className="mt-2 flex-1 text-sm text-muted">{p.brief}</p>
                  <Link
                    href={`/projects/${p.slug}`}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong"
                  >
                    Read case study <span aria-hidden>→</span>
                  </Link>
                </Card>
              ))}
            </div>
          </Container>
        </Section>
      ) : (
        <Section>
          <Container>
            <SectionHeading
              eyebrow="In preparation"
              title="Real project case studies are on the way"
              intro="We're preparing detailed, permissioned case studies of real Wirral projects. These placeholders show the kind of work we'll feature — they are not completed projects."
            />
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {projectPlaceholders.map((p) => (
                <Card key={p.title} className="flex h-full flex-col border-dashed">
                  <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-paper text-3xl text-muted-soft">
                    ✎
                  </div>
                  <span className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-accent-strong">
                    In preparation
                  </span>
                  <h3 className="mt-1 text-base">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted">{p.note}</p>
                </Card>
              ))}
            </div>

            <div className="mt-12">
              <h2 className="text-2xl">What each case study will include</h2>
              <p className="mt-2 text-pretty text-muted">
                When a homeowner is happy for us to share their project, each case study will set out
                the full story — honestly, and only with their permission:
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {caseStudyIncludes.map((c) => (
                  <li key={c} className="flex gap-3 text-pretty text-muted">
                    <span className="mt-1 shrink-0 text-accent-strong" aria-hidden>
                      ◆
                    </span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-10 rounded-[var(--radius)] border border-line bg-paper-card p-6">
              <h2 className="text-lg">In the meantime — concept visualisations</h2>
              <p className="mt-2 text-pretty text-muted">
                Our portfolio currently shows clearly-labelled AI concept visualisations — a useful
                way to picture the kind of transformation good design makes possible. They are
                illustrative only, not completed projects.
              </p>
              <div className="mt-5">
                <LinkButton href="/portfolio" variant="ghost">
                  View concept visualisations
                </LinkButton>
              </div>
            </div>
          </Container>
        </Section>
      )}

      <CTASection heading="Have a project in mind?" />
    </>
  );
}
