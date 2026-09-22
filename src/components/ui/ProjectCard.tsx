import Link from "next/link";
import { KindTag } from "./WorkGallery";
import { withBase } from "@/lib/base";
import type { Project } from "@/lib/projects";

/**
 * The "clickable link" card Sean's brief asks for on the projects hub, the home
 * page, the service pages and the area pages — one definition so they stay
 * identical. Non-photo covers keep their KindTag, so a design visualisation is
 * never presented as a finished build.
 */
export function ProjectCard({
  project: p,
  headingLevel = "h3",
  priority = false,
}: {
  project: Project;
  /** h2 on the projects hub (cards are the page's main list), h3 elsewhere. */
  headingLevel?: "h2" | "h3";
  /** Eager-load the image — only for a card that is above the fold. */
  priority?: boolean;
}) {
  const Heading = headingLevel;
  const drawing = p.cover?.kind === "drawing";
  return (
    <Link href={`/projects/${p.slug}`} className="group block h-full">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-paper-card shadow-tile transition-shadow hover:shadow-tile-hover">
        {p.cover && (
          <div className={"relative aspect-[3/2] w-full " + (drawing ? "bg-white" : "bg-paper")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={withBase(p.cover.src)}
              alt={p.cover.alt}
              width={p.cover.width}
              height={p.cover.height}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : undefined}
              decoding="async"
              className={
                "absolute inset-0 h-full w-full " +
                (drawing ? "object-contain p-2" : "object-cover")
              }
            />
            <KindTag kind={p.cover.kind} />
          </div>
        )}
        <div className="flex flex-1 flex-col p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-strong">
            {p.town} · {p.projectType}
          </p>
          <Heading className="mt-2 text-xl group-hover:text-accent-strong">{p.title}</Heading>
          <p className="mt-2 flex-1 text-pretty text-sm text-muted">{p.summary ?? p.brief}</p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong transition-[gap] group-hover:gap-2.5">
            Read case study <span aria-hidden>→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Responsive grid of project cards — 1 / 2 / 3 across. */
export function ProjectCardGrid({
  projects,
  headingLevel = "h3",
  className = "",
}: {
  projects: Project[];
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  if (projects.length === 0) return null;
  return (
    <div className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {projects.map((p) => (
        <ProjectCard key={p.slug} project={p} headingLevel={headingLevel} />
      ))}
    </div>
  );
}
