/**
 * Real project case studies. We never invent projects — every entry is genuine
 * SC Design work supplied by Sean (June 2026 design pack + the project photos and
 * drawings in his Sep 2026 website brief). Copy describes only what the images
 * and drawings show; general area only (no street address); no invented dates,
 * planning references or testimonials. Sean refines specifics via
 * PROJECTS-QUESTIONS.txt.
 *
 * Imagery is labelled by kind (see lib/media.ts): "photo" = real photograph,
 * "drawing" = Sean's drawings, "render" = design visualisation — a render is never
 * presented as a completed build.
 *
 * The /projects hub, /projects/[slug] template, /before-and-after page and the
 * sitemap all read from this array.
 */
import { portfolioImages, wi, type WorkImage } from "./media";
import { brief2Projects } from "./projects-brief2";
import { cmsProjects } from "./projects-cms";

export type BeforeAfterSet = {
  /** Short, minimal caption for the before & after page. */
  label: string;
  before?: WorkImage;
  drawing?: WorkImage;
  after: WorkImage;
  /** Same viewpoint → an interactive drag-to-compare slider is meaningful. */
  aligned?: boolean;
};

/**
 * How far along the project is. Half the case studies in Sean's Sep 2026 brief
 * are schemes that are in planning, under construction or not yet started, and
 * the honest thing is to say so on the card and the page rather than let a
 * design visualisation read as a finished build.
 */
export type ProjectStage = "completed" | "under-construction" | "in-planning" | "concept";

export const stageLabel: Record<ProjectStage, string> = {
  completed: "Completed",
  "under-construction": "Under construction",
  "in-planning": "In planning",
  concept: "Concept design",
};

export type Project = {
  slug: string;
  title: string;
  town: string; // general area, NOT a full street address
  propertyType: string;
  projectType: string;
  /** Defaults to "completed" when unset (the pre-Sep-2026 case studies). */
  stage?: ProjectStage;
  brief: string;
  challenge?: string;
  designResponse?: string;
  planningRoute?: string;
  buildingRegsRoute?: string;
  drawings: string[];
  outcome?: string;
  /** Hub card + page hero image (labelled by kind). */
  cover?: WorkImage;
  /** Further labelled photos / drawings / renders for the case-study page. */
  gallery?: WorkImage[];
  /** Feeds /before-and-after (minimal-caption visual comparison). */
  beforeAfter?: BeforeAfterSet;
  testimonial?: { quote: string; attribution: string }; // ONLY if real + permissioned
  reviewed: string;

  status?: "draft" | "published";
  summary?: string; // one-line teaser for the hub card
  constraints?: string;
  /** Sean supplied the images for the site; true once the homeowner's OK is confirmed. */
  homeownerPermissionConfirmed?: boolean;
  relatedServices?: string[]; // service slugs
  relatedAreas?: string[]; // area slugs
  seoTitle?: string;
  metaDescription?: string;
};

const GARAGE_PLANNING =
  "Converting a garage within the existing structure is often permitted development, but a change to the frontage or an old planning condition can mean permission is needed — always confirmed against the specific property first.";
const GARAGE_REGS =
  "A garage conversion needs building-regulations approval — insulation, damp-proofing, floor levels, ventilation and fire separation.";
const LOFT_REGS =
  "A habitable loft conversion always needs building-regulations approval — structure, fire safety and escape, stairs and insulation.";

/**
 * The earlier set, from Sean's June 2026 design pack. Kept as-is; the Sep 2026
 * case studies in projects-brief2.ts run ahead of these in Sean's order.
 */
const legacyProjects: Project[] = [
  {
    slug: "garage-conversion-living-room",
    title: "Garage conversion to a new living room",
    town: "North West",
    propertyType: "Semi-detached house",
    projectType: "Garage conversion",
    summary:
      "A cluttered integral garage turned into a bright, finished room — with a new window where the garage door used to be.",
    brief:
      "Turn an under-used, cluttered garage into a comfortable room that feels like part of the house.",
    designResponse:
      "The garage door was replaced with an insulated brick wall and a new window to match the house, and the space was insulated, lined and finished as a habitable room.",
    planningRoute: GARAGE_PLANNING,
    buildingRegsRoute: GARAGE_REGS,
    drawings: ["Proposed plans and elevations", "Building-regulations drawing package"],
    outcome:
      "A bright, finished room in place of a storage garage — and a tidier frontage with a window that sits naturally with the house.",
    cover: wi("garage1After", "After — new window in place of the garage door"),
    gallery: [
      wi("garage1BeforeInterior", "Before — the garage as it was"),
      wi("garage1During", "During — the new room taking shape"),
      wi("garage1AfterInterior", "After — the finished room"),
      wi("garage1After", "After — the new frontage"),
    ],
    beforeAfter: {
      label: "Garage conversion",
      before: wi("garage1BeforeInterior", "Before"),
      after: wi("garage1AfterInterior", "After"),
    },
    reviewed: "September 2026",
    status: "published",
    homeownerPermissionConfirmed: false,
    relatedServices: ["garage-conversion-drawings-wirral", "building-regulations-drawings-wirral"],
  },
  {
    slug: "dormer-loft-conversion",
    title: "Contemporary dormer loft conversion",
    town: "North West",
    propertyType: "Two-storey house",
    projectType: "Loft conversion (dormer)",
    summary:
      "A crisp, dark-clad dormer that adds a light-filled new room at the top of the house — from drawing to finished build.",
    brief: "Add a bright new room in the roof space with a clean, contemporary dormer.",
    designResponse:
      "A box dormer with full-height glazing and French doors, clad in dark grey to sit quietly against the roof, bringing daylight and views into the new room.",
    planningRoute:
      "Rear dormers are often achievable under permitted development within volume limits — always confirmed against the specific property first.",
    buildingRegsRoute: LOFT_REGS,
    drawings: ["Proposed elevations", "Building-regulations drawing package"],
    outcome:
      "The completed dormer adds a bright new room at the top of the house, with a contemporary finish that suits the roofline.",
    cover: wi("loftDormerAfter", "The completed dormer"),
    gallery: [
      wi("loftDormerDrawing", "Proposed elevation"),
      wi("loftDormerAfter", "The completed dormer"),
    ],
    beforeAfter: {
      label: "Dormer loft conversion",
      drawing: wi("loftDormerDrawing", "Proposed drawing"),
      after: wi("loftDormerAfter", "Completed"),
    },
    reviewed: "September 2026",
    status: "published",
    homeownerPermissionConfirmed: false,
    relatedServices: ["loft-conversions", "building-regulations-drawings-wirral"],
  },
  {
    slug: "single-storey-extension-roof-lantern",
    title: "Single-storey extension with roof lantern",
    town: "North West",
    propertyType: "Rendered family house",
    projectType: "Single-storey extension",
    summary:
      "A single-storey extension with a glazed roof lantern and bi-fold doors — the proposed drawing and the finished build.",
    brief: "Add a bright ground-floor living space that opens onto the garden.",
    designResponse:
      "A single-storey extension with a glazed roof lantern and bi-fold doors, rendered to match the house so it reads as part of the original building.",
    planningRoute:
      "Single-storey extensions are often achievable under permitted development or prior approval within the size limits — confirmed against the specific property first.",
    buildingRegsRoute:
      "Building-regulations drawings cover the structure, roof lantern, insulation, glazing and drainage.",
    drawings: ["Proposed rear elevation", "Building-regulations drawing package"],
    outcome: "The finished extension, built to the drawings, with its lantern and bi-folds in place.",
    cover: wi("extLanternAfter", "The finished extension"),
    gallery: [
      wi("extLanternDrawing", "Proposed rear elevation"),
      wi("extLanternAfter", "The finished extension"),
    ],
    beforeAfter: {
      label: "Single-storey extension",
      drawing: wi("extLanternDrawing", "Proposed drawing"),
      after: wi("extLanternAfter", "Completed"),
    },
    reviewed: "September 2026",
    status: "published",
    homeownerPermissionConfirmed: false,
    relatedServices: ["house-extensions", "planning-drawings-wirral"],
  },
  {
    slug: "rear-dormer-loft-conversion",
    title: "Rear dormer loft conversion with Juliet balconies",
    town: "North West",
    propertyType: "Semi-detached house",
    projectType: "Loft conversion (rear dormer)",
    summary:
      "A full-width rear dormer with two sets of French doors and Juliet balconies, adding a new top floor to a family semi.",
    brief: "Convert the loft into additional living space with a full-width rear dormer.",
    designResponse:
      "A full-width rear dormer with two sets of French doors behind Juliet balconies, bringing light and outlook into the new rooms — with the specification keyed onto the drawing for building control and the builder.",
    planningRoute:
      "Rear dormers are often achievable under permitted development within volume limits — always confirmed against the specific property first.",
    buildingRegsRoute: LOFT_REGS,
    drawings: [
      "Proposed rear elevation with keyed specification notes",
      "Building-regulations drawing package",
    ],
    cover: wi("loftRearDormerDrawing", "Proposed rear elevation"),
    gallery: [
      wi("loftRearDormerBefore", "Before — the rear of the house"),
      wi("loftRearDormerDrawing", "Proposed rear elevation"),
    ],
    reviewed: "September 2026",
    status: "published",
    homeownerPermissionConfirmed: false,
    relatedServices: ["loft-conversions", "building-regulations-drawings-wirral"],
  },
  {
    slug: "garage-conversion-boot-room",
    title: "Garage conversion & porch with boot room",
    town: "North West",
    propertyType: "Semi-detached house",
    projectType: "Garage conversion & porch",
    summary:
      "A garage turned into a practical boot room with built-in timber storage, under an extended porch canopy.",
    brief: "Convert the garage into practical, everyday space at the front of the house.",
    designResponse:
      "The garage door was replaced with a window and brick infill under a continued porch canopy, and the space fitted out with built-in timber seating and storage.",
    planningRoute: GARAGE_PLANNING,
    buildingRegsRoute: GARAGE_REGS,
    drawings: ["Proposed plans and elevations", "Building-regulations drawing package"],
    outcome: "A tidier frontage and a practical boot room with built-in storage.",
    cover: wi("garage2Interior", "The finished boot room"),
    gallery: [
      wi("garage2After", "The new frontage and porch canopy"),
      wi("garage2Interior", "Built-in seating and storage"),
    ],
    reviewed: "September 2026",
    status: "published",
    homeownerPermissionConfirmed: false,
    relatedServices: ["garage-conversion-drawings-wirral", "front-porch-extension-design"],
  },

  /* ---- Sean's June 2026 design pack ---- */
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
    cover: portfolioImages.heroAfter,
    gallery: [wi("heroDuring", "During the build — before rendering and landscaping")],
    beforeAfter: {
      label: "Rear extension & garden",
      before: { ...portfolioImages.heroBefore, caption: "Before" },
      after: { ...portfolioImages.heroAfter, caption: "Design visualisation" },
      aligned: true,
    },
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
    cover: portfolioImages.gardenRoom,
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
    cover: portfolioImages.lanternExtension,
    reviewed: "June 2026",
    status: "published",
    homeownerPermissionConfirmed: true,
    relatedServices: ["house-extensions", "residential-design"],
  },
  {
    slug: "new-detached-house-design",
    title: "New detached house design",
    town: "North West",
    propertyType: "New-build detached house",
    projectType: "New house — planning & technical drawings",
    summary:
      "A contemporary detached family home with glazed feature gables and a double garage — plans, elevations, sections, roof plan and 3D views.",
    brief:
      "Design a contemporary detached family home with feature glazed gables, open-plan living and a double garage.",
    designResponse:
      "Twin glazed gables anchor the design, with a finishes schedule keyed onto every elevation. The drawing set runs from floor and roof plans through elevations and sections to 3D line views, so the planning application, building control and builders all work from the same information.",
    planningRoute:
      "A new dwelling needs full planning permission — the plans, elevations and 3D views are prepared to support the application.",
    buildingRegsRoute:
      "The technical set — sections, a wall-type key and specification — carries the scheme through building control and into builders' quotations.",
    drawings: [
      "Ground-floor plan with wall key and room schedule",
      "Front, rear and side elevations with external finishes",
      "Sections through the house",
      "Roof plan",
      "3D line views",
    ],
    cover: wi("houseSketchViews", "3D line views"),
    gallery: [
      wi("houseSketchViews", "3D line views"),
      wi("houseFrontSide", "Front and side elevations"),
      wi("houseRearSide", "Rear and side elevations"),
      wi("houseFloorPlan", "Ground-floor plan"),
      wi("houseRoofPlan", "Roof plan"),
      wi("houseSectionsAB", "Sections A and B"),
      wi("houseSectionsCF", "Further sections"),
    ],
    reviewed: "September 2026",
    status: "published",
    homeownerPermissionConfirmed: false,
    relatedServices: ["residential-design", "planning-drawings-wirral", "building-regulations-drawings-wirral"],
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
    cover: portfolioImages.singleStorey,
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
    cover: portfolioImages.chapelGallery,
    gallery: [wi("chapelRender", "Design render of the conversion")],
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
    cover: portfolioImages.pharmacy,
    reviewed: "June 2026",
    status: "published",
    homeownerPermissionConfirmed: true,
    relatedServices: ["change-of-use-applications", "measured-building-surveys"],
  },
];

/**
 * Every case study, in the order they appear on /projects and in the sitemap:
 * the ones Sean publishes himself through /admin/ first (newest work leads),
 * then Sean's Sep 2026 running order, then the June 2026 set. Reordering the
 * hand-authored sets is a matter of moving entries within brief2Projects — the
 * hub, the home page's featured three and the sitemap all follow this array.
 *
 * cmsProjects is GENERATED from content/projects/*.json by
 * scripts/sync-cms-projects.mjs (npm "prebuild"). It is an empty array until
 * Sean publishes something, so this costs nothing until it is used.
 */
export const projects: Project[] = [...cmsProjects, ...brief2Projects, ...legacyProjects];

export const publishedProjects = projects.filter((p) => p.status !== "draft");

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

/**
 * Case studies to show on a service page — the "few clickable links from the
 * projects page" Sean's brief asks for on nearly every service. Reads
 * `relatedServices`, which was already on every project but had nothing using
 * it. Order follows the published order, so the strongest work comes first.
 */
export function projectsForService(serviceSlug: string, limit = 3): Project[] {
  return publishedProjects
    .filter((p) => p.relatedServices?.includes(serviceSlug))
    .slice(0, limit);
}

/** Case studies in or near a given area — used at the foot of an area page. */
export function projectsForArea(areaSlug: string, limit = 3): Project[] {
  return publishedProjects.filter((p) => p.relatedAreas?.includes(areaSlug)).slice(0, limit);
}

/**
 * Other case studies to show at the foot of one — same service first, then the
 * same project type, so a visitor reading about a loft conversion is offered
 * more loft conversions rather than a random commercial fit-out.
 */
export function relatedCaseStudies(project: Project, limit = 3): Project[] {
  const others = publishedProjects.filter((p) => p.slug !== project.slug);
  const sameService = others.filter((p) =>
    p.relatedServices?.some((s) => project.relatedServices?.includes(s))
  );
  const sameType = others.filter(
    (p) => p.projectType === project.projectType && !sameService.includes(p)
  );
  return [...sameService, ...sameType].slice(0, limit);
}

// The "coming soon" placeholder cards and the /projects empty state they fed
// were removed in Sep 2026 — with 40+ real case studies published, that branch
// was unreachable dead code.
