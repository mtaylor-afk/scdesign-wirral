import { notFound } from "next/navigation";
import { Container, Section, Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";
import { JsonLd } from "@/components/JsonLd";
import { projects, getProject } from "@/lib/projects";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";

// Only the known (real) projects are built; no on-demand fallback.
export const dynamicParams = false;

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project)
    return pageMeta({ title: "Project", description: "", path: `/projects/${slug}`, noindex: true });
  return pageMeta({
    title: `${project.title} — ${project.town}`,
    description: project.summary ?? project.brief,
    path: `/projects/${slug}`,
  });
}

function Detail({ heading, body }: { heading: string; body: string }) {
  return (
    <div>
      <h2 className="text-xl">{heading}</h2>
      <p className="mt-2 text-pretty text-muted">{body}</p>
    </div>
  );
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  // A genuine before photo + after = an interactive comparison; a single design
  // render = a framed image clearly captioned as a design visualisation.
  const hasPair = Boolean(project.beforeImage && project.afterImage);
  const singleImage = !hasPair ? project.afterImage || project.beforeImage : undefined;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Projects", path: "/projects" },
          { name: project.title, path: `/projects/${slug}` },
        ])}
      />

      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Projects", path: "/projects" },
              { name: project.title, path: `/projects/${slug}` },
            ]}
          />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-strong">
            {project.town} · {project.propertyType} · {project.projectType}
          </p>
          <h1 className="mt-3 text-balance text-4xl sm:text-5xl">{project.title}</h1>
          <p className="mt-5 text-pretty text-lg text-muted">{project.brief}</p>
        </Container>
      </Section>

      {hasPair ? (
        <Section>
          <Container className="max-w-3xl">
            <BeforeAfterSlider
              before={project.beforeImage!}
              after={project.afterImage!}
              beforeAlt={`${project.title} — before`}
              afterAlt={`${project.title} — proposed design`}
              caption={`${project.title}, ${project.town} · drag to compare`}
            />
          </Container>
        </Section>
      ) : singleImage ? (
        <Section>
          <Container className="max-w-3xl">
            <figure className="overflow-hidden rounded-lg border border-line bg-paper-card shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={singleImage}
                alt={`${project.title} — design visualisation`}
                width={1200}
                height={800}
                loading="lazy"
                decoding="async"
                className="aspect-[3/2] w-full object-cover"
              />
              <figcaption className="px-4 py-3 text-sm text-muted">
                {project.title}, {project.town} · design visualisation
              </figcaption>
            </figure>
          </Container>
        </Section>
      ) : null}

      <Section tone="card">
        <Container className="max-w-3xl space-y-8">
          <Detail heading="The challenge" body={project.challenge} />
          <Detail heading="Our design response" body={project.designResponse} />
          <Detail heading="Planning route" body={project.planningRoute} />
          <Detail heading="Building regulations" body={project.buildingRegsRoute} />
          <div>
            <h2 className="text-xl">Drawings prepared</h2>
            <ul className="mt-3 space-y-2">
              {project.drawings.map((d) => (
                <li key={d} className="flex gap-3 text-ink-soft">
                  <span className="mt-1 text-accent-strong" aria-hidden>
                    ◆
                  </span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
          <Detail heading="Outcome" body={project.outcome} />

          {project.testimonial && (
            <Card>
              <blockquote className="text-pretty text-lg text-ink">
                “{project.testimonial.quote}”
              </blockquote>
              <p className="mt-3 text-sm text-muted">— {project.testimonial.attribution}</p>
            </Card>
          )}

          <p className="text-xs text-muted">
            Images are design visualisations prepared by SC Design Wirral to show the proposed
            scheme — indicative of the design intent.
          </p>
        </Container>
      </Section>

      <CTASection heading="Planning something similar?" />
    </>
  );
}
