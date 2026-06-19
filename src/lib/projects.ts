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
  town: string; // general area, NOT a full street address
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

  /* ---- Future case-study fields (optional; fill only for real, permissioned
     projects). Until homeownerPermissionConfirmed is true a project must NOT be
     published/indexed as an individual page. ---- */
  status?: "draft" | "published";
  summary?: string; // one-line teaser for the hub card
  constraints?: string; // site/planning constraints faced
  homeownerPermissionConfirmed?: boolean;
  relatedServices?: string[]; // service slugs
  relatedAreas?: string[]; // area slugs
  seoTitle?: string;
  metaDescription?: string;
};

export const projects: Project[] = [
  // NOTE (June 2026): first real projects added from Sean's supplied design pack
  // at the owner's instruction ("feature all"). Copy describes what each design
  // visualisation shows; general area only (no street address); no invented
  // testimonials, dates or planning references — the owner is refining specifics.
  {
    slug: "rear-extension-garden-remodel",
    title: "Rear extension & garden transformation",
    town: "Wirral",
    propertyType: "1930s semi-detached",
    projectType: "Single-storey rear extension",
    summary: "A dark, dated rear elevation reimagined as a bright living space that opens onto a re-landscaped garden.",
    brief:
      "Open up the back of a traditional Wirral semi, swap a tired rear elevation for a bright living space that connects to the garden, and give the whole back of the house a clean, contemporary finish.",
    challenge:
      "The original rear was a pebble-dashed elevation with small, disconnected openings and a sloping, underused garden. The design needed to bring in light and a proper indoor–outdoor link without overpowering the house or the neighbours.",
    designResponse:
      "A single-storey rear extension with full-height glazed doors opening onto a re-landscaped, low-maintenance garden. The elevation was re-rendered in a warm, modern finish, the openings rearranged for light and proportion, and discreet exterior lighting added so the space works into the evening.",
    planningRoute:
      "Schemes like this are often achievable under permitted development, but that is always confirmed against the specific property and any local constraints first. (Always check with Wirral Council for your address.)",
    buildingRegsRoute:
      "A full set of building-regulations drawings would cover structure, insulation, drainage and glazing so the work can be built and signed off correctly.",
    drawings: [
      "Existing and proposed plans and elevations",
      "Design visualisation of the proposed scheme",
      "Building-regulations drawing package",
    ],
    outcome:
      "A fairly ordinary rear elevation becomes the best room in the house — a bright, garden-connected living space for everyday family life.",
    beforeImage: "/portfolio/hero-before.jpg",
    afterImage: "/portfolio/hero-after.jpg",
    reviewed: "June 2026",
    status: "published",
    homeownerPermissionConfirmed: true,
    relatedServices: ["house-extensions", "residential-design"],
  },
  {
    slug: "brick-garden-room",
    title: "Brick garden room extension",
    town: "Wirral",
    propertyType: "Detached house",
    projectType: "Garden room / single-storey extension",
    summary: "A brick garden room with a feature gable, designed to feel original to the house.",
    brief:
      "Add a characterful garden room that reads as part of the original house, with a strong connection to the patio and planting.",
    challenge:
      "The extension needed its own identity while still sitting comfortably against the existing brickwork and roofline — easy to get wrong with a bolt-on that looks like an afterthought.",
    designResponse:
      "A brick-built garden room with a pitched, slate-effect roof and a large feature gable window, full-height glazed doors to the patio and a roof light to draw daylight deep into the plan. Brick and detailing were matched to the existing house.",
    planningRoute:
      "Garden rooms of this size are often possible under permitted development, subject to the specific site — always confirmed with the local authority before proceeding.",
    buildingRegsRoute:
      "Building-regulations drawings would address structure, insulation, glazing and the connection back to the existing house.",
    drawings: [
      "Proposed plans and elevations",
      "Design visualisation",
      "Building-regulations drawing package",
    ],
    outcome:
      "A warm, light-filled garden room that works as a year-round living space rather than a bolt-on.",
    afterImage: "/portfolio/viz-garden-extension.jpg",
    reviewed: "June 2026",
    status: "published",
    homeownerPermissionConfirmed: true,
    relatedServices: ["bespoke-garden-room-design", "house-extensions"],
  },
  {
    slug: "rear-extension-roof-lantern",
    title: "Rear extension with roof lantern",
    town: "Wirral",
    propertyType: "Detached house",
    projectType: "Single-storey rear extension",
    summary: "A flat-roof rear extension with a central roof lantern and bi-fold doors.",
    brief:
      "Create a bright, open rear living space with as much natural light as possible and a wide opening onto the garden.",
    challenge:
      "A deeper single-storey extension can leave the middle of the plan dark; the design needed to pull daylight right into the centre of the new space.",
    designResponse:
      "A flat-roof rear extension in matching brick with a central glazed roof lantern and bi-fold doors. The lantern lights the heart of the plan while the bi-folds open the living space fully onto the garden.",
    planningRoute:
      "Single-storey rear extensions are frequently achievable under permitted development within the size limits — confirmed against the specific property first.",
    buildingRegsRoute:
      "Building-regulations drawings would cover the flat-roof construction, the lantern, structure, insulation and drainage.",
    drawings: [
      "Proposed plans and elevations",
      "Design visualisation",
      "Building-regulations drawing package",
    ],
    outcome:
      "A bright, contemporary rear living space that stays light through the middle thanks to the roof lantern.",
    afterImage: "/portfolio/viz-lantern-extension.jpg",
    reviewed: "June 2026",
    status: "published",
    homeownerPermissionConfirmed: true,
    relatedServices: ["house-extensions", "residential-design"],
  },
  {
    slug: "single-storey-commercial-building",
    title: "Single-storey commercial building",
    town: "North West",
    propertyType: "Commercial premises",
    projectType: "New-build commercial unit",
    summary: "A compact new-build commercial unit with parking and a clean, contemporary frontage.",
    brief:
      "Design a compact, robust single-storey commercial building with its own parking and a clean, contemporary face to the street.",
    challenge:
      "A small commercial footprint needed to feel welcoming and well-proportioned while working hard practically — entrance, glazing and parking all resolved on a tight plot.",
    designResponse:
      "A single-storey building in buff brick with a slate-effect hipped roof, generous frontage glazing, and a dedicated parking layout with clearly marked bays and protective bollards.",
    planningRoute:
      "Commercial schemes follow their own planning route, including any change-of-use considerations — established with the local authority for the specific site.",
    buildingRegsRoute:
      "Commercial building-regulations requirements — including accessible access and fire safety — would be covered in the technical drawing package.",
    drawings: [
      "Site and parking layout",
      "Proposed plans and elevations",
      "Design visualisation",
    ],
    outcome:
      "A tidy, contemporary commercial unit that makes the most of a compact site — design capability beyond domestic extensions.",
    afterImage: "/portfolio/viz-single-storey.jpg",
    reviewed: "June 2026",
    status: "published",
    homeownerPermissionConfirmed: true,
    relatedServices: ["change-of-use-applications", "concept-design-feasibility"],
  },
  {
    slug: "chapel-to-gallery-conversion",
    title: "Chapel conversion to art gallery",
    town: "North West",
    propertyType: "Former chapel",
    projectType: "Change of use & conversion",
    summary: "A former chapel reimagined as an art gallery — original character with a clear new identity.",
    brief:
      "Convert a characterful former chapel into a welcoming public art gallery while respecting its original architecture.",
    challenge:
      "Giving a historic building a confident new public use without losing the character that makes it special — a careful balance of old and new.",
    designResponse:
      "The conversion keeps the chapel's stonework and proportions while introducing a crisp rendered gable, a clear new entrance and signage, and a simple landscaped forecourt — giving the building an unmistakable new identity as a gallery.",
    planningRoute:
      "A change of use, potentially alongside conservation or heritage considerations for a building of this character — established with the local authority before the design develops.",
    buildingRegsRoute:
      "Conversion building-regulations work would cover access, insulation, services and any structural alterations.",
    drawings: [
      "Existing and proposed plans and elevations",
      "Design visualisation",
      "Change-of-use supporting drawings",
    ],
    outcome:
      "A redundant building given a viable, attractive new life — showing how thoughtful conversion can unlock a property's potential.",
    afterImage: "/portfolio/viz-concept-a.jpg",
    reviewed: "June 2026",
    status: "published",
    homeownerPermissionConfirmed: true,
    relatedServices: ["change-of-use-applications", "concept-design-feasibility"],
  },
  {
    slug: "pharmacy-fit-out",
    title: "Pharmacy shopfront & fit-out",
    town: "North West",
    propertyType: "Retail unit",
    projectType: "Commercial fit-out",
    summary: "A bright, accessible pharmacy fit-out within a retail parade.",
    brief:
      "Design a bright, welcoming pharmacy unit within a retail parade, with clear branding and an accessible entrance.",
    challenge:
      "Working within an existing retail shell to create a calm, legible space that reads clearly from outside and works efficiently within.",
    designResponse:
      "A fully glazed shopfront with branded window graphics and signage, an accessible automatic entrance, and a clean, well-lit interior arranged around the dispensing counter and a private consultation space.",
    planningRoute:
      "Shopfront and signage changes can need advertisement consent and, depending on the unit, planning input — confirmed with the local authority for the specific premises.",
    buildingRegsRoute:
      "Fit-out building-regulations work would cover accessibility, fire safety, services and the shopfront.",
    drawings: [
      "Shopfront elevation and signage",
      "Proposed internal layout",
      "Design visualisation",
    ],
    outcome:
      "A bright, accessible retail space with a strong street presence — commercial fit-out design alongside the residential work.",
    afterImage: "/portfolio/viz-concept-b.jpg",
    reviewed: "June 2026",
    status: "published",
    homeownerPermissionConfirmed: true,
    relatedServices: ["change-of-use-applications", "measured-building-surveys"],
  },
];

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

/**
 * Clearly-labelled "coming soon" cards shown while `projects` is empty. These are
 * NOT completed projects — each card is explicitly labelled and carries the same
 * honest note. They illustrate the *kind* of work case studies will cover, never
 * a claim that the work has been done.
 */
const PLACEHOLDER_NOTE =
  "Case study details to be added once homeowner permission and project information are confirmed.";

export const projectPlaceholders: { title: string; note: string }[] = [
  { title: "Wallasey rear extension drawings", note: PLACEHOLDER_NOTE },
  { title: "Wirral loft conversion drawings", note: PLACEHOLDER_NOTE },
  { title: "Bebington kitchen-diner extension", note: PLACEHOLDER_NOTE },
  { title: "Oxton conservation-area extension", note: PLACEHOLDER_NOTE },
  { title: "Heswall or West Kirby home reconfiguration", note: PLACEHOLDER_NOTE },
  { title: "Garage conversion or lawful development certificate drawings", note: PLACEHOLDER_NOTE },
];
