import { notFound } from "next/navigation";
import Link from "next/link";
import { Container, Section, Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";
import { WorkFigure, WorkGallery } from "@/components/ui/WorkGallery";
import { StageBadge } from "@/components/ui/StageBadge";
import { RelatedProjects } from "@/components/ui/RelatedProjects";
import { JsonLd } from "@/components/JsonLd";
import {
  publishedProjects,
  getProject,
  relatedCaseStudies,
  type Project,
} from "@/lib/projects";
import type { WorkImage } from "@/lib/media";
import { pageMeta, breadcrumbJsonLd, articleJsonLd } from "@/lib/seo";

// Only the known (real) projects are built; no on-demand fallback.
export const dynamicParams = false;

export function generateStaticParams() {
  return publishedProjects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project)
    return pageMeta({ title: "Project", description: "", path: `/projects/${slug}`, noindex: true });
  return pageMeta({
    // seoTitle / metaDescription were on the type but nothing read them; a
    // case study can now set its own without touching this template.
    title: project.seoTitle ?? `${project.title} — ${project.town}`,
    description: project.metaDescription ?? project.summary ?? project.brief,
    path: `/projects/${slug}`,
  });
}

function Detail({ heading, body }: { heading: string; body?: string }) {
  if (!body) return null;
  return (
    <div>
      <h2 className="text-xl">{heading}</h2>
      <p className="mt-2 text-pretty text-muted">{body}</p>
    </div>
  );
}

/** Honest image note generated from the kinds of image actually shown. */
function imageNote(p: Project): string {
  const imgs: WorkImage[] = [
    ...(p.cover ? [p.cover] : []),
    ...(p.gallery ?? []),
    ...(p.beforeAfter ? [p.beforeAfter.before, p.beforeAfter.drawing, p.beforeAfter.after] : []),
  ].filter((i): i is WorkImage => Boolean(i));
  const kinds = new Set(imgs.map((i) => i.kind));
  const parts: string[] = [];
  if (kinds.has("photo"))
    parts.push(
      "Photos show the real project — designed by SC Design Wirral and built by the homeowner's own builder."
    );
  if (kinds.has("drawing")) parts.push("Drawings are SC Design Wirral's own.");
  if (kinds.has("render"))
    parts.push(
      "Images labelled “Design visualisation” show the proposed design, not a photograph of a finished build."
    );
  return parts.join(" ");
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const ba = project.beforeAfter;
  const showSlider = Boolean(ba?.aligned && ba.before);
  const note = imageNote(project);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Projects & Portfolio", path: "/projects" },
            { name: project.title, path: `/projects/${slug}` },
          ]),
          articleJsonLd({
            title: project.seoTitle ?? `${project.title} — ${project.town}`,
            description: project.metaDescription ?? project.summary ?? project.brief,
            path: `/projects/${slug}`,
            reviewed: project.reviewed,
          }),
        ]}
      />

      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Projects & Portfolio", path: "/projects" },
              { name: project.title, path: `/projects/${slug}` },
            ]}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-strong">
              {project.town} · {project.propertyType} · {project.projectType}
            </p>
            <StageBadge stage={project.stage} />
          </div>
          <h1 className="mt-3 text-balance text-4xl sm:text-5xl">{project.title}</h1>
          <p className="mt-5 text-pretty text-lg text-muted">{project.brief}</p>
        </Container>
      </Section>

      {showSlider && ba?.before ? (
        <Section>
          <Container className="max-w-3xl">
            <BeforeAfterSlider
              before={ba.before.src}
              after={ba.after.src}
              beforeAlt={ba.before.alt}
              afterAlt={ba.after.alt}
              caption={`Before → ${ba.after.kind === "render" ? "design visualisation" : "after"}. Drag to compare.`}
            />
          </Container>
        </Section>
      ) : project.cover ? (
        <Section>
          <Container className="max-w-3xl">
            <WorkFigure
              image={project.cover}
              aspect="3 / 2"
              zoom={project.cover.kind === "drawing"}
              priority
            />
          </Container>
        </Section>
      ) : null}

      {project.gallery && project.gallery.length > 0 && (
        <Section tone="mist">
          <Container>
            <h2 className="text-2xl">Project images</h2>
            <WorkGallery images={project.gallery} className="mt-6" />
          </Container>
        </Section>
      )}

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

          {note && <p className="text-xs text-muted">{note}</p>}
          <p className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/projects" className="font-medium text-accent-strong underline">
              All projects &amp; portfolio
            </Link>
            <Link href="/portfolio" className="font-medium text-accent-strong underline">
              Design visualisations
            </Link>
          </p>
        </Container>
      </Section>

      <RelatedProjects
        projects={relatedCaseStudies(project)}
        heading="More projects like this"
        intro="Other SC Design Wirral case studies of a similar type."
      />

      <CTASection heading="Planning something similar?" />
    </>
  );
}
