/**
 * Real project case studies. EMPTY until SC supplies real, permissioned project
 * details and photos — we never invent projects. When a real case study is
 * added here, the /projects hub and /projects/[slug] template render it and the
 * sitemap picks it up automatically.
 *
 * The `placeholders` below are clearly-labelled "coming soon" cards shown while
 * the real list is empty. They are NOT presented as completed projects.
 *
 * CASE-STUDY ROUTE: the per-project page template lives in
 * `project-templates/case-study-page.tsx.txt`. The static export can't build an
 * empty dynamic route, so the `/projects/[slug]` route is intentionally NOT
 * present while this array is empty. When you add a real project below, copy the
 * template to `src/app/projects/[slug]/page.tsx` to enable the case-study pages
 * (and add the route to `sitemap.ts`).
 */

export type Project = {
  slug: string;
  title: string;
  town: string;
  propertyType: string;
  projectType: string;
  brief: string;
  challenge: string;
  designResponse: string;
  planningRoute: string;
  buildingRegsRoute: string;
  drawings: string[];
  outcome: string;
  beforeImage?: string; // public path
  afterImage?: string; // public path
  testimonial?: { quote: string; attribution: string }; // ONLY if real + permissioned
  reviewed: string;
};

export const projects: Project[] = [
  // Intentionally empty — add real, permissioned case studies here.
];

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

/** Clearly-labelled "coming soon" cards shown while `projects` is empty. */
export const projectPlaceholders: { title: string; note: string }[] = [
  { title: "Wallasey rear extension", note: "Real case study coming soon" },
  { title: "Wirral loft conversion", note: "Real case study coming soon" },
  { title: "Bebington kitchen-diner extension", note: "Real case study coming soon" },
  { title: "Heswall whole-home reconfiguration", note: "Real case study coming soon" },
];
