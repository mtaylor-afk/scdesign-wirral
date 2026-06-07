/** Primary navigation structure (shared by desktop + mobile). */

import { services } from "./services";
import { locations } from "./locations";
import { guides } from "./guides";

export type NavLink = { label: string; href: string };
export type NavNode = NavLink & { children?: NavLink[] };

/**
 * Top-level nav. Groups (Services / Areas / Guides) carry children that derive
 * from the data arrays, so adding a service/area/guide auto-updates the menu.
 */
export const primaryNav: NavNode[] = [
  {
    label: "Services",
    href: "/services",
    children: [
      ...services.map((s) => ({ label: s.short, href: `/services/${s.slug}` })),
      { label: "All services", href: "/services" },
    ],
  },
  {
    label: "Areas",
    href: "/areas",
    children: [
      ...locations
        .filter((l) => l.tier !== "wider")
        .slice(0, 10)
        .map((l) => ({ label: l.name, href: `/areas/${l.slug}` })),
      { label: "All areas", href: "/areas" },
    ],
  },
  {
    label: "Guides",
    href: "/guides",
    children: [
      ...guides
        .slice(0, 6)
        .map((g) => ({ label: g.navLabel ?? g.title, href: `/guides/${g.slug}` })),
      { label: "All guides", href: "/guides" },
    ],
  },
  { label: "Projects", href: "/projects" },
  { label: "About", href: "/about" },
  { label: "Visualiser", href: "/visualiser" },
];

/** Flat list of every top-level destination (used by the footer "Explore" col). */
export const exploreLinks: NavLink[] = [
  { label: "Services", href: "/services" },
  { label: "Areas we cover", href: "/areas" },
  { label: "Guides", href: "/guides" },
  { label: "Projects", href: "/projects" },
  { label: "Reviews", href: "/reviews" },
  { label: "Process", href: "/process" },
  { label: "About", href: "/about" },
  { label: "FAQs", href: "/faqs" },
  { label: "Visualiser", href: "/visualiser" },
  { label: "Contact", href: "/contact" },
];

export const footerDesignServices: NavLink[] = [
  { label: "House extension drawings", href: "/services/house-extensions" },
  { label: "Loft conversion design", href: "/services/loft-conversions" },
  { label: "Bespoke residential design", href: "/services/residential-design" },
  { label: "Garage conversion drawings", href: "/services/garage-conversion-drawings-wirral" },
];

export const footerPlanningServices: NavLink[] = [
  { label: "Planning drawings", href: "/services/planning-drawings-wirral" },
  {
    label: "Building regulations drawings",
    href: "/services/building-regulations-drawings-wirral",
  },
  { label: "Permitted development advice", href: "/services/permitted-development-wirral" },
  {
    label: "Lawful development certificates",
    href: "/services/lawful-development-certificate-wirral",
  },
  { label: "Conservation area design", href: "/services/conservation-area-design-wirral" },
];

export const footerLegalLinks: NavLink[] = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Cookie Policy", href: "/cookie-policy" },
  { label: "Visualiser Terms", href: "/visualiser-terms" },
];
