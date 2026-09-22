import { Container, Section, LinkButton } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { ProjectCardGrid } from "@/components/ui/ProjectCard";
import { publishedProjects as projects } from "@/lib/projects";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Projects & Portfolio — Architectural Design Wirral",
  description:
    "Architectural design projects across Wirral and Merseyside — house extensions, loft and garage conversions, garden rooms and feasibility studies. Each case study shows the brief, the design response and the drawings prepared.",
  path: "/projects",
});

export default function ProjectsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Projects & Portfolio", path: "/projects" },
        ])}
      />
      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Projects & Portfolio", path: "/projects" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">Projects and Portfolio</h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            Explore our portfolio of architectural design projects across Wirral and Merseyside.
            From loft conversions, house extensions and bespoke garden rooms to garage conversions
            and feasibility studies. Each case study demonstrates our approach to considered design,
            detailed architectural drawings and creating practical, well-designed spaces tailored to
            our clients&apos; homes.
          </p>
          <p className="mt-4 text-sm text-muted">
            Every image is labelled: real photographs, Sean&apos;s drawings, or design visualisations
            of the proposed scheme.
          </p>
          <div className="mt-6">
            <LinkButton href="/portfolio" variant="ghost">
              See design visualisations
            </LinkButton>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <ProjectCardGrid projects={projects} headingLevel="h2" />
        </Container>
      </Section>

      <CTASection heading="Have a project in mind?" />
    </>
  );
}
