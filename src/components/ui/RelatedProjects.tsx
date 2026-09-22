import { Container, Section, SectionHeading, LinkButton } from "./index";
import { ProjectCardGrid } from "./ProjectCard";
import type { Project } from "@/lib/projects";

/**
 * "A few clickable links like the below from the projects page" — Sean's brief
 * asks for this on nearly every service page, and it's the obvious place for it
 * on area pages too. Renders nothing when there are no matching case studies, so
 * a service with no published work yet simply doesn't show an empty band.
 */
export function RelatedProjects({
  projects,
  heading = "Projects like this",
  intro = "Real SC Design Wirral projects of this type — the brief, the design response and the drawings prepared.",
  tone = "mist",
}: {
  projects: Project[];
  heading?: string;
  intro?: string;
  tone?: "paper" | "card" | "mist" | "fog";
}) {
  if (projects.length === 0) return null;
  return (
    <Section tone={tone}>
      <Container>
        <SectionHeading eyebrow="Case studies" title={heading} intro={intro} />
        <div data-reveal className="mt-10">
          <ProjectCardGrid projects={projects} />
        </div>
        <div className="mt-8">
          <LinkButton href="/projects" variant="ghost">
            See all projects &amp; portfolio
          </LinkButton>
        </div>
      </Container>
    </Section>
  );
}
