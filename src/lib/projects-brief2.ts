/**
 * Case studies from Sean's September 2026 website brief ("Matt website changes 2").
 *
 * Same rules as the rest of projects.ts: every entry is genuine SC Design work,
 * the copy describes only what the supplied images and text actually show, the
 * location is the general area and never a street address, and nothing is
 * invented — no dates, planning references or testimonials.
 *
 * `stage` is load-bearing here. Roughly half of these are schemes in planning,
 * under construction or not yet started, and the brief says so plainly ("project
 * has not begun yet", "waiting for client photographs"). The stage badge carries
 * that onto the card and the page so a design visualisation is never mistaken
 * for a finished build.
 *
 * The running order is Sean's: his numbered one to eight first, then the three
 * he asked to sit high up, then the rest with completed work ahead of concepts.
 * Reorder by moving entries in this array — the home page's featured three and
 * the hub both read from it.
 */
import { wi } from "./media";
import type { Project } from "./projects";

/* ------------------------------------------------------------------ *
 * Shared text. The brief repeats these verbatim on most projects, so  *
 * they live here once rather than being retyped thirty times.          *
 * ------------------------------------------------------------------ */

const BR_ROUTE =
  "A full set of building-regulations drawings was prepared, covering the structure, insulation specifications, drainage layout and specification, windows and glazing, foundation details, floor, wall and roof build-ups, internal partitions and waterproofing, coordinated with a structural engineer.";

const BR_PACK = [
  "Measured building survey",
  "Existing ground & first floor plans",
  "Existing rear & side elevations",
  "Demolition ground floor plan",
  "Demolition rear & side elevations",
  "Proposed ground floor plan",
  "Proposed roof plan",
  "Proposed rafter plan",
  "Proposed rear & side elevations",
  "Proposed section details",
  "Proposed technical construction details",
  "Proposed drainage plan & details",
  "Proposed building regulations specification sheets",
];

const BR_PACK_LOFT = [
  "Measured building survey",
  "Existing ground & first floor plans",
  "Existing rear & side elevations",
  "Demolition first floor & loft plans",
  "Demolition rear & side elevations",
  "Proposed first floor & loft plans",
  "Proposed roof plan",
  "Proposed rafter plan",
  "Proposed rear & side elevations",
  "Proposed section details",
  "Proposed technical construction details",
  "Proposed drainage plan & details",
  "Proposed building regulations specification sheets",
];

const PLANNING_PACK = [
  "Measured building survey",
  "Location plan",
  "Site block plan",
  "Existing site plan",
  "Proposed site plan",
  "Proposed parking plan",
  "Existing floor & roof plans",
  "Existing side, rear & front elevations",
  "Proposed floor & roof plans",
  "Proposed side, rear & front elevations",
  "Shadow / daylight study",
  "Design & access statement",
];

const PLANNING_PACK_LOFT = [
  "Measured building survey",
  "Location plan",
  "Site block plan",
  "Existing floor & roof plans",
  "Existing side, rear & front elevations",
  "Proposed floor & roof plans",
  "Proposed side, rear & front elevations",
  "Shadow / daylight study",
  "Design & access statement",
];

const EXT_PLANNING =
  "Whether a single-storey extension of this kind needs full planning permission or falls within permitted development depends on its size, position and the property itself — we establish the route for each project and confirm it with the local authority before anything is submitted.";
const LOFT_PLANNING =
  "A loft conversion that adds dormers usually needs planning permission; one within the existing roofline often does not. The route is confirmed against the specific property and with the local authority.";
const GARAGE_PLANNING =
  "Converting a garage within the existing structure is often permitted development, but a change to the frontage or an old planning condition can mean permission is needed — always confirmed against the specific property first.";
const LOFT_REGS =
  "A habitable loft conversion always needs building-regulations approval — structure, fire safety and escape, stairs and insulation.";
const GARAGE_REGS =
  "A garage conversion needs building-regulations approval — insulation, damp-proofing, floor levels, ventilation and fire separation.";

const REVIEWED = "September 2026";

export const brief2Projects: Project[] = [
  /* ---------------- 1 ---------------- */
  {
    slug: "wallasey-village-side-extension",
    title: "Side extension with home office, utility and WC",
    town: "Wallasey Village",
    propertyType: "Semi-detached house",
    projectType: "Single-storey side extension",
    stage: "completed",
    summary:
      "A tired side garage and bin store replaced with a full-width flat-roof extension, opening the ground floor into a kitchen, utility, WC and dedicated home office.",
    brief:
      "The homeowners of this Wallasey Village family home wanted to modernise the rear and side elevation, replacing the brick bin store and garage with a small single-storey side extension that would work far harder than the space it replaced.",
    challenge:
      "The existing side return was taken up by a brick bin store and a garage that contributed nothing to the house. Internally the ground floor was cellular, with two walls separating the kitchen from the rest of the plan.",
    designResponse:
      "A low-profile flat-roof extension spans the full width of the former garage, kept deliberately modest and subservient to the house and finished in white pebble-dashed render. Two flat rooflights and a central roof lantern bring daylight deep into the plan, while large aluminium bi-fold doors and a full-height glazed window open the new space to the garden. Opening two internal walls into the extension created a generous open-plan kitchen, utility room, WC and a dedicated home office.",
    planningRoute: EXT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "A bright, contemporary ground floor that works far better for family life — a spacious kitchen and dining area, a practical utility and WC, and a home office that is connected to the house but private enough to work in. The glazing, rooflights and lantern bring in a level of daylight the original plan never had.",
    cover: wi("wvSideExtConcept", "Design visualisation of the completed side extension"),
    gallery: [
      wi("wvSideExtExisting", "Before — the rear and side elevation as it was"),
      wi("wvSideExtFoundations", "Foundations dug and the new floor level set out"),
      wi("wvSideExtDpm", "Damp-proof membrane laid"),
      wi("wvSideExtBeforePour", "The floor build-up before the concrete pour"),
      wi("wvSideExtAfterPour", "After the pour — the finished slab"),
      wi("wvSideExtSteel1", "First steel beam and supporting post"),
      wi("wvSideExtSteel2", "Second steel in position"),
      wi("wvSideExtFrontBuildUp", "The front wall building up"),
      wi("wvSideExtRooflights", "Rooflight openings formed in the new flat roof"),
      wi("wvSideExtDining", "Finished dining area"),
      wi("wvSideExtKitchen", "Finished kitchen"),
      wi("wvSideExtUtility", "Finished utility room"),
      wi("wvSideExtWc", "Finished ground-floor WC"),
      wi("wvSideExtExternal", "The completed extension from the garden"),
    ],
    beforeAfter: {
      label: "Side extension & garage conversion",
      before: wi("wvSideExtExisting"),
      after: wi("wvSideExtConcept"),
      aligned: true,
    },
    relatedServices: [
      "house-extensions",
      "building-regulations-drawings-wirral",
      "garage-conversion-drawings-wirral",
    ],
    relatedAreas: ["wallasey"],
    reviewed: REVIEWED,
    metaDescription:
      "Wallasey Village side extension case study — a garage and bin store replaced with a flat-roof extension housing a kitchen, utility, WC and home office. Design, planning and Building Regulations drawings by SC Design Wirral.",
  },

  /* ---------------- 2 ---------------- */
  {
    slug: "wallasey-village-rear-extension-lootility",
    title: "Full-width rear extension with 'lootility'",
    town: "Wallasey Village",
    propertyType: "Family home",
    projectType: "Single-storey rear extension",
    stage: "completed",
    summary:
      "A cramped rear projection replaced with a full-width flat-roof extension — open-plan kitchen and family space, plus a combined WC, utility and storage room.",
    brief:
      "This Wallasey Village renovation replaces the existing small rear extension with a spacious full-width single-storey flat-roof extension, creating a bright and contemporary open-plan living space.",
    challenge:
      "The original rear projection constrained the ground-floor layout and left the kitchen dark and disconnected from the garden. The household also needed somewhere for laundry, coats and boots that did not spill into the living space.",
    designResponse:
      "The outdated rear projection was removed entirely and replaced with a contemporary flat-roof extension spanning the full width of the house, complete with flat rooflights. Matching brickwork keeps the extension in character with the original property, while large aluminium-framed glazed doors give a strong connection to the garden. Internally the ground floor became a spacious open-plan kitchen, dining and family area, with a dedicated 'lootility' combining WC, utility and storage — purpose-built for laundry appliances, household storage, coats and boots.",
    planningRoute: EXT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "What was a stand-alone utility is now a generous, light-filled living area suited to everyday family life and entertaining. The separate 'lootility' keeps the main living space uncluttered, and the matching brickwork means the extension reads as part of the original house rather than an addition.",
    cover: wi("wvRearLootExternal", "The completed full-width rear extension"),
    gallery: [
      wi("wvRearLootExisting", "Before — the rear with the original small projection"),
      wi("wvRearLootConcept", "Design visualisation of the proposed extension"),
      wi("wvRearLootKitchenMid", "The extension and kitchen part-way through"),
      wi("wvRearLootKitchenMid2", "The new kitchen taking shape"),
      wi("wvRearLootInternalMid", "Inside the new extension during the build"),
      wi("wvRearLootLootility", "The combined WC, utility and storage space"),
      wi("wvRearLootExternal", "The completed extension from the garden"),
    ],
    beforeAfter: {
      label: "Full-width rear extension",
      before: wi("wvRearLootExisting"),
      after: wi("wvRearLootConceptAlt"),
      aligned: true,
    },
    relatedServices: ["house-extensions", "building-regulations-drawings-wirral"],
    relatedAreas: ["wallasey"],
    reviewed: REVIEWED,
    metaDescription:
      "Wallasey Village rear extension case study — a small rear projection replaced with a full-width flat-roof extension, open-plan kitchen and a combined WC, utility and storage room.",
  },

  /* ---------------- 3 ---------------- */
  {
    slug: "wallasey-village-rear-extension-open-plan",
    title: "Rear extension replacing an old outhouse and shed",
    town: "Wallasey Village",
    propertyType: "Family home",
    projectType: "Single-storey rear extension",
    stage: "completed",
    summary:
      "An old outside toilet and brick shed cleared to make way for an open-plan kitchen, dining and entertaining space with a separate utility.",
    brief:
      "The homeowners wanted to make better use of the rear of their property. An old outside toilet and brick-built shed occupied valuable garden space but offered very little practical use, and the existing kitchen and dining area felt cramped for entertaining family and friends.",
    challenge:
      "As well as the redundant outbuildings, the brief asked for a larger open-plan living space and a dedicated utility room to keep everyday appliances and laundry separate from the main living area — all while maximising natural light and improving the connection to the garden.",
    designResponse:
      "Following a detailed measured survey and close consultation with the homeowners, we designed a contemporary single-storey rear extension. The existing outside toilet and brick outbuilding were demolished to clear the footprint, making way for a spacious open-plan kitchen, dining and entertaining area and a dedicated utility room. Large aluminium-style glazed doors open directly onto the garden for a seamless indoor–outdoor connection, and strategically positioned rooflights draw daylight deep into the new living space. A clean rendered exterior with contrasting brick detailing complements the character of the existing property.",
    planningRoute: EXT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "The completed extension has transformed how the homeowners use their property. What was once an unused collection of small outbuildings is now a generous, light-filled living area designed for everyday family life and entertaining, with a separate utility room keeping the main living space uncluttered.",
    cover: wi("wvRearOpenConcept", "Design visualisation of the proposed rear extension"),
    gallery: [
      wi("wvRearOpenExisting", "Before — the old outside toilet and brick shed"),
      wi("wvRearOpenDemolition", "The outbuildings during demolition"),
      wi("wvRearOpenFootings", "Original footings beside the depth of the new foundations"),
      wi("wvRearOpenBeforePour", "The floor build-up before the concrete pour"),
      wi("wvRearOpenSteel", "Structural steel being set in place"),
      wi("wvRearOpenWallBuildUp", "Wall build-up with air vents for airflow"),
      wi("wvRearOpenExternalMid", "The extension externally, part-way through the finishes"),
      wi("wvRearOpenInternal", "The finished open-plan living space"),
      wi("wvRearOpenKitchen", "The finished kitchen"),
    ],
    beforeAfter: {
      label: "Rear extension & garden transformation",
      before: wi("wvRearOpenExisting"),
      after: wi("wvRearOpenConceptAlt"),
      aligned: true,
    },
    relatedServices: ["house-extensions", "building-regulations-drawings-wirral"],
    relatedAreas: ["wallasey"],
    reviewed: REVIEWED,
    metaDescription:
      "Wallasey Village rear extension case study — an old outside toilet and brick shed replaced with an open-plan kitchen, dining and entertaining space plus a separate utility room.",
  },

  /* ---------------- 4 ---------------- */
  {
    slug: "liscard-garage-conversion-kitchen",
    title: "Garage conversion to kitchen, utility and cloakroom",
    town: "Liscard, Wallasey",
    propertyType: "Family home",
    projectType: "Garage conversion & change of use",
    stage: "completed",
    summary:
      "An under-used garage turned into a modern kitchen, cloakroom and utility — with a new pitched roof, rooflights and a reconfigured ground floor.",
    brief:
      "Following an assessment of the existing property and discussions with the homeowners, the proposal set out to transform under-used ground-floor space into a series of practical, well-connected rooms that support everyday family living.",
    challenge:
      "The garage was doing little for the household, circulation between the kitchen and the rest of the ground floor was poor, and there was nowhere sensible for coats, shoes and laundry.",
    designResponse:
      "The garage was fully converted into insulated, habitable space, including a new pitched roof with Velux rooflights, new internal wall linings, upgraded flooring and improved thermal performance, integrated with the main dwelling. A new opening formed in the existing external wall created a dedicated cloakroom for coats, shoes and everyday items, and the footprint left room for a practical utility. The rear of the ground floor was reconfigured to improve flow between the kitchen, utility and living spaces, opening the main wall between the kitchen and garage and widening windows for more natural light, with space created for a new ground-floor WC.",
    planningRoute: GARAGE_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "A functional, well-planned and modern ground-floor layout that significantly improves day-to-day living. The garage conversion and the new service spaces make the home feel more organised and practical, and better aligned with the needs of a growing family.",
    cover: wi("liscGarageExternal", "The completed frontage after the garage conversion"),
    gallery: [
      wi("liscGarageExisting", "Before — the property with the original garage"),
      wi("liscGarageConcept", "Design visualisation of the converted frontage"),
      wi("liscGarageCeiling", "New ceiling on the underside of the new roof"),
      wi("liscGarageKitchen", "The new kitchen inside the former garage"),
      wi("liscGarageWcArea", "The area reconfigured to form the new WC"),
      wi("liscGarageWc", "The finished WC"),
      wi("liscGarageCloakroom", "The new cloakroom at the front of the former garage"),
      wi("liscGarageExternal", "The completed frontage"),
    ],
    beforeAfter: {
      label: "Garage conversion",
      before: wi("liscGarageVizBefore"),
      after: wi("liscGarageVizAfter"),
      aligned: true,
    },
    relatedServices: [
      "garage-conversion-drawings-wirral",
      "change-of-use-applications",
      "building-regulations-drawings-wirral",
    ],
    relatedAreas: ["wallasey"],
    reviewed: REVIEWED,
    metaDescription:
      "Liscard garage conversion case study — an under-used garage converted to a kitchen, utility and cloakroom with a new pitched roof and rooflights, by SC Design Wirral.",
  },

  /* ---------------- 5 ---------------- */
  {
    slug: "wallasey-village-side-rear-extension",
    title: "Two properties joined with a side and rear extension",
    town: "Wallasey Village",
    propertyType: "Two adjoining properties",
    projectType: "Side & rear extension",
    stage: "completed",
    summary:
      "Two properties connected into one cohesive family home — open-plan kitchen and dining, entrance lobby, utility, downstairs wet room and dedicated storage.",
    brief:
      "The proposal set out to transform and connect two existing properties through carefully considered rear and side extensions, creating a cohesive and naturally flowing family home.",
    challenge:
      "Joining two properties meant reworking the core of the plan — including internal sandstone walls and an existing staircase — while keeping circulation sensible and finding room for the storage and utility spaces a busy family needs.",
    designResponse:
      "Two internal sandstone walls and the existing staircase were removed to open the core of the home and improve circulation, with internal brick partitions taken out to form a seamless open-plan layout. The reconfigured ground floor provides a spacious kitchen and dining area to the rear, a welcoming entrance lobby with dedicated coat and shoe storage, a utility room, a downstairs wet room and a dedicated storage room. A contemporary flat-roof extension with two flat rooflights and a central roof lantern floods the interior with daylight, and large aluminium bi-fold doors with two full-height glazed windows connect the new living space to the garden. The design embraces a warm, rustic character, with exposed steelwork and stonework set against contemporary finishes.",
    planningRoute: EXT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "A bright, contemporary home that keeps the character of the original buildings while dramatically improving comfort, usability and everyday enjoyment. The layout is practical and well suited to family life.",
    cover: wi("wvSideRearExternal", "The completed extensions from the garden"),
    gallery: [
      wi("wvSideRearExisting", "Before — the two properties as they were"),
      wi("wvSideRearConcept", "Design visualisation of the proposed extensions"),
      wi("wvSideRearCoatStore", "The coat and shoe store during fit-out"),
      wi("wvSideRearHallway", "The new entrance hallway"),
      wi("wvSideRearBathroom", "The downstairs wet room"),
      wi("wvSideRearUtility", "The utility room"),
      wi("wvSideRearCirculation", "The new opening formed through the original sandstone wall"),
      wi("wvSideRearKitchen", "The finished open-plan kitchen with exposed steelwork"),
      wi("wvSideRearUnderStair", "Built-in storage under the new staircase"),
      wi("wvSideRearDiningBench", "The dining bench beside the kitchen"),
    ],
    beforeAfter: {
      label: "Side & rear extension",
      before: wi("wvSideRearExisting"),
      after: wi("wvSideRearConcept"),
      aligned: true,
    },
    relatedServices: [
      "house-extensions",
      "residential-design",
      "building-regulations-drawings-wirral",
    ],
    relatedAreas: ["wallasey"],
    reviewed: REVIEWED,
    metaDescription:
      "Wallasey Village side and rear extension case study — two properties connected into one family home with an open-plan kitchen, wet room, utility and dedicated storage.",
  },

  /* ---------------- 6 ---------------- */
  {
    slug: "bebington-rear-extension-loft",
    title: "Rear extension and loft conversion",
    town: "Bebington",
    propertyType: "Family home",
    projectType: "Rear extension & loft conversion",
    stage: "completed",
    summary:
      "A single-storey rear extension and a rear dormer loft conversion — an open-plan kitchen and family space below, a principal bedroom suite above.",
    brief:
      "The aim was to enhance the functionality of the home by creating larger, more practical living spaces at ground level while increasing the overall accommodation within the property.",
    challenge:
      "The existing kitchen was too small for the way the family lived, there was nowhere dedicated for laundry and household storage, and the roof space was standing empty.",
    designResponse:
      "At ground level the kitchen was extended and reconfigured into a spacious open-plan kitchen and family space, improving circulation, natural light and usability, with a new utility room inside the extension for laundry appliances, household storage and ancillary functions. Above, a rear dormer maximises usable floor area and headroom while keeping an appearance sympathetic to the existing dwelling, and provides a new principal bedroom suite with a walk-in wardrobe, en-suite bathroom and additional storage.",
    planningRoute: LOFT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "Together the two projects significantly improve the property's functionality, comfort and long-term value while respecting the character and appearance of the existing dwelling — a kitchen and utility tailored to modern family living, and a high-quality principal bedroom suite above.",
    cover: wi("bebExternal", "The completed rear extension and dormer"),
    gallery: [
      wi("bebConcept", "Design visualisation of the proposed extension and loft conversion"),
      wi("bebLiving1", "The finished open-plan kitchen, dining and sitting room"),
      wi("bebLiving2", "The open-plan living space looking towards the garden"),
      wi("bebLiving3", "Another view of the finished kitchen and dining area"),
      wi("bebLootility", "The combined WC and utility space"),
      wi("bebBedroom", "The new principal bedroom in the converted loft"),
      wi("bebEnsuite1", "The new loft en-suite"),
      wi("bebEnsuite2", "Another view of the en-suite"),
      wi("bebStairwell", "The new stairwell up to the loft level"),
      wi("bebStorage", "Built-in storage within the loft conversion"),
    ],
    relatedServices: [
      "house-extensions",
      "loft-conversions",
      "building-regulations-drawings-wirral",
    ],
    relatedAreas: ["bebington"],
    reviewed: REVIEWED,
    metaDescription:
      "Bebington rear extension and loft conversion case study — an open-plan kitchen and utility at ground level and a principal bedroom suite in a new rear dormer.",
  },

  /* ---------------- 7 ---------------- */
  {
    slug: "liscard-side-extension",
    title: "Side extension with living room and home office",
    town: "Liscard, Wallasey",
    propertyType: "Family home",
    projectType: "Single-storey side extension",
    stage: "in-planning",
    summary:
      "An outdated side garage and shed to be replaced with an integrated extension providing a rear living room, home office and streamlined storage.",
    brief:
      "This proposal sets out the creation of a small single-storey side extension designed to enhance the functionality and overall layout of the home, replacing the existing side garage and shed storage.",
    challenge:
      "The garage and shed were dated, poorly integrated and took up space that could work much harder. The new extension had to follow the existing building line and keep the street presence intact.",
    designResponse:
      "Removing the outdated garage and shed frees up valuable space and allows the new extension to integrate cleanly with the main building, positioned to follow the existing building line and maintain the established street presence. The design introduces a rear living room with improved natural light and a direct connection to the garden, a dedicated home office positioned for privacy while staying connected to the main circulation route, and a streamlined storage area replacing the former shed. Materials are deliberately aligned with the existing house — matching render, complementary roof tiles and consistent window styles — and the roof form is kept low and sympathetic to the first-floor windows, preventing overshadowing and maintaining neighbour amenity.",
    planningRoute:
      "A full set of planning drawings and supporting reports was prepared for this proposal, including a shadow and daylight study and a design and access statement.",
    buildingRegsRoute: BR_ROUTE,
    drawings: [...PLANNING_PACK, ...BR_PACK],
    outcome: "This is an ongoing project — further updates will follow.",
    cover: wi("liscSideRearConcept", "Design visualisation of the proposed side extension"),
    gallery: [
      wi("liscSideFrontExisting", "Before — the front with the original side garage and shed"),
      wi("liscSideFrontConcept", "Design visualisation from the front"),
      wi("liscSideRearConcept", "Design visualisation from the rear"),
    ],
    relatedServices: ["house-extensions", "planning-drawings-wirral", "residential-design"],
    relatedAreas: ["wallasey"],
    reviewed: REVIEWED,
    metaDescription:
      "Liscard side extension case study — an outdated garage and shed replaced with an integrated extension providing a rear living room, home office and storage. Planning and Building Regulations drawings by SC Design Wirral.",
  },

  /* ---------------- 8 ---------------- */
  {
    slug: "west-kirby-loft-conversion",
    title: "Dormer loft conversion with bedroom and en-suite",
    town: "West Kirby",
    propertyType: "Family home",
    projectType: "Loft conversion",
    stage: "in-planning",
    summary:
      "Two modestly scaled dormers proposed to turn the existing roof space into a well-proportioned bedroom, private en-suite and dedicated storage.",
    brief:
      "This West Kirby proposal sets out the design and construction of a loft conversion within the existing roof space, creating a comfortable, well-lit upper-floor living space that enhances the property's functionality and long-term value.",
    challenge:
      "The project required both planning approval and building control drawings because of the new dormer structures and the internal reconfiguration needed to reach the new level.",
    designResponse:
      "Two modestly scaled dormers are positioned to balance the roof composition and maintain the character of the existing dwelling, with pitched forms and matching roof tiles for visual continuity. Internally the layout maximises usable floor area and natural light, with the bedroom and en-suite arranged to take advantage of the dormer windows while maintaining privacy. The new staircase is carefully located to integrate with the existing circulation and minimise disruption to the floor below.",
    planningRoute:
      "A full set of planning drawings and supporting reports was prepared, including a shadow and daylight study and a design and access statement.",
    buildingRegsRoute: BR_ROUTE,
    drawings: [...PLANNING_PACK_LOFT, ...BR_PACK],
    outcome: "This is an ongoing project — further updates will follow.",
    cover: wi("wkLoftConceptFront", "Design visualisation of the proposed dormer loft conversion"),
    gallery: [
      wi("wkLoftConceptFront", "Design visualisation from the front"),
      wi("wkLoftConceptSide", "Design visualisation from the side"),
      wi("wkLoft3d", "Three-dimensional concept view"),
      wi("wkLoftExistingProposed3d", "Existing and proposed views side by side"),
    ],
    relatedServices: ["loft-conversions", "planning-drawings-wirral"],
    relatedAreas: ["west-kirby"],
    reviewed: REVIEWED,
    metaDescription:
      "West Kirby loft conversion case study — two sympathetic dormers proposed to create a bedroom, en-suite and storage, with planning and Building Regulations drawings by SC Design Wirral.",
  },

  /* ---------------- 9 ---------------- */
  {
    slug: "new-brighton-first-floor-extension",
    title: "First-floor extension to a crenelated sea-front building",
    town: "New Brighton",
    propertyType: "Period building with corner turret",
    projectType: "First-floor extension",
    stage: "in-planning",
    summary:
      "A new upper storey proposed above an existing sea-front building, with reconstructed crenelated parapets and a reduced circular corner turret.",
    brief:
      "The proposal involves constructing a new first-floor extension above the existing building, achieved by removing the existing roof and introducing additional accommodation within a carefully designed upper storey.",
    challenge:
      "The existing building has a distinctive architectural character — crenelated parapets and a circular corner turret — that the extension had to work with rather than against.",
    designResponse:
      "New facing brickwork closely matches the original building in colour, texture and dimensions, and the windows reflect the proportions and arrangement of the existing openings. Complementary sandstone heads and cills provide continuity across the elevations. The crenelated parapets are reconstructed with slightly reduced projections, and the circular turret is reduced in height and circumference to create a balanced and proportionate appearance. New concealed pitched roof sections keep the additional accommodation sympathetic to the original.",
    planningRoute: "Plans are currently going through the planning process.",
    drawings: PLANNING_PACK,
    outcome:
      "A sensitive and well-considered extension that provides additional accommodation while respecting the building's established character — through matching materials, traditional detailing and appropriately proportioned openings, it is designed to read as a cohesive addition rather than an afterthought.",
    cover: wi("nbFirstFloorConceptFront", "Design visualisation of the proposed first-floor extension"),
    gallery: [
      wi("nbFirstFloorExistingFront", "Before — the front of the building"),
      wi("nbFirstFloorExistingSide", "Before — the side of the building"),
      wi("nbFirstFloorConceptFront", "Design visualisation from the front"),
      wi("nbFirstFloorConceptSide", "Design visualisation from the side, with the reduced turret"),
    ],
    relatedServices: ["planning-drawings-wirral", "residential-design"],
    relatedAreas: ["new-brighton"],
    reviewed: REVIEWED,
    metaDescription:
      "New Brighton first-floor extension case study — a new upper storey above a crenelated sea-front building, with reconstructed parapets and a reduced corner turret.",
  },

  /* ---------------- 10 ---------------- */
  {
    slug: "poulton-social-club",
    title: "New social club function room",
    town: "Poulton, Wallasey",
    propertyType: "Community social club",
    projectType: "New-build community building",
    stage: "completed",
    summary:
      "An underused area of hardstanding turned into a permanent community venue — nine interconnected shipping containers unified behind composite cladding.",
    brief:
      "The site previously comprised an area of open hardstanding that provided limited functionality and made little contribution to community infrastructure. The building needed to provide flexible internal accommodation while making efficient use of the site.",
    challenge:
      "Delivering a durable, accessible public-facing venue on a constrained site, using a modular construction method, without the result looking industrial.",
    designResponse:
      "The building uses modular construction from nine interconnected shipping containers, unified through the application of a composite cladding system to all external elevations. The cladding creates a cohesive architectural form and conceals the original industrial appearance of the units, giving a clean, modern finish that is both durable and low maintenance. A low-profile roof keeps the building visually unobtrusive while delivering the required internal headroom and accommodation standards, and the external materials were selected for longevity, weather resistance and a professional appearance appropriate to a public-facing community facility. The layout is accessible throughout and supports a broad range of community uses.",
    drawings: [
      "Measured survey and existing site plan",
      "Proposed site and block plans",
      "Proposed floor plans",
      "Proposed elevations",
      "Construction and cladding details",
      "Accessibility and means-of-escape layouts",
    ],
    outcome:
      "A high-quality community development that turns an underused area of hardstanding into a valuable local facility. It delivers two function rooms with independent bar facilities, four accessible toilet facilities and substantial storage, creating a versatile venue for a broad range of social and community activities.",
    cover: wi("poultonFinish1", "The completed function room clad in composite panels"),
    gallery: [
      wi("poultonBefore", "Before — the area of open hardstanding"),
      wi("poultonFinish1", "The completed building"),
      wi("poultonInternal1", "Inside the completed function room"),
      wi("poultonInternal2", "The bar area"),
      wi("poultonFinish2", "Another external view"),
    ],
    relatedServices: ["residential-design", "planning-drawings-wirral"],
    relatedAreas: ["wallasey"],
    reviewed: REVIEWED,
    metaDescription:
      "Poulton social club case study — a new community function room built from nine interconnected shipping containers and unified behind composite cladding, designed by SC Design Wirral.",
  },

  /* ---------------- 11 ---------------- */
  {
    slug: "formby-rear-extension",
    title: "Full-width rear extension replacing a conservatory",
    town: "Formby, Liverpool",
    propertyType: "Family home",
    projectType: "Single-storey rear extension",
    stage: "concept",
    summary:
      "A dated conservatory to be replaced with a full-width brick extension, a central glazed roof lantern and bi-fold doors onto the garden.",
    brief:
      "The extension will significantly enhance the functionality of the property, increase levels of natural daylight and improve the connection between the dwelling and the rear garden, while remaining sympathetic to the overall scale and character of the existing house.",
    designResponse:
      "A contemporary but sympathetic design that complements the host dwelling. External walls use facing brickwork selected to closely match the existing property, ensuring visual continuity between the original dwelling and the extension, while a simple flat roof minimises visual impact and allows clean architectural lines. Key features include a full-width single-storey rear extension, a central glazed roof lantern, large aluminium-framed bi-fold doors, a feature kitchen window overlooking the rear garden, anthracite grey aluminium windows and doors, contemporary external wall lighting and matching brickwork and roof-edge detailing.",
    planningRoute: EXT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "Replacing the outdated conservatory with a high-quality contemporary extension will provide a spacious open-plan kitchen, dining and family living area better suited to modern living. The extensive glazing and central roof lantern will create bright, attractive internal spaces while the materials and proportions keep the extension in character with the original house.",
    cover: wi("formbyConcept", "Design visualisation of the proposed rear extension"),
    gallery: [
      wi("formbyBefore", "Before — the rear with the existing conservatory"),
      wi("formbyConcept", "Design visualisation of the proposed extension"),
    ],
    relatedServices: ["house-extensions", "building-regulations-drawings-wirral"],
    relatedAreas: ["crosby"],
    reviewed: REVIEWED,
    metaDescription:
      "Formby rear extension case study — a dated conservatory replaced with a full-width brick extension, central roof lantern and bi-fold doors. Design and drawings by SC Design Wirral.",
  },

  /* ---------------- 12 ---------------- */
  {
    slug: "wallasey-village-loft-conversion",
    title: "Loft conversion with Juliet balconies and views to Wales",
    town: "Wallasey Village",
    propertyType: "Family home",
    projectType: "Loft conversion",
    stage: "completed",
    summary:
      "A flat-roof dormer with two Juliet balconies and full-height glazing, creating a bedroom suite with en-suite, storage and panoramic views.",
    brief:
      "The proposal created a high-quality additional living space within the existing roof structure — a new bedroom suite with en-suite facilities, a dedicated storage area and a new stairwell providing safe and efficient access.",
    challenge:
      "Making the most of the outlook was central to the brief: the design needed to capture panoramic views across Wales and maximise natural light throughout the upper floor, while keeping the dormer sympathetic to the existing roof.",
    designResponse:
      "A contemporary flat-roof dormer complements the existing roof form while providing generous internal space, with composite cladding colour-matched to the roof tiles for a cohesive, refined appearance. Two Juliet balconies with full-height double doors create a strong visual connection to the surrounding landscape, offering uninterrupted views over Wales and flooding the new bedroom with daylight. Internally the layout is arranged for comfort and practicality, with the en-suite and storage positioned to maximise usable floor space, and the new stairwell integrates with the existing circulation. Structural alterations formed the new loft floor and dormer openings, with insulation, ventilation and fire-safety upgrades in accordance with Building Regulations.",
    planningRoute: LOFT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK_LOFT,
    outcome:
      "A bright, spacious bedroom suite with en-suite facilities, ample storage and striking views through full-height glazing. The flat-roof dormer and Juliet balconies create a modern architectural feature that improves both the usability and the appearance of the property while remaining sympathetic to its character.",
    cover: wi("wvLoftJulietExternal", "The completed flat-roof dormer"),
    gallery: [
      wi("wvLoftJulietExisting", "Before — the rear of the house"),
      wi("wvLoftJulietConcept", "Design visualisation of the proposed dormer"),
      wi("wvLoftJulietFinish1", "The finished loft bedroom looking towards the Juliet balconies"),
      wi("wvLoftJulietFinish2", "The finished loft suite"),
      wi("wvLoftJulietExternal", "The completed dormer from the garden"),
    ],
    relatedServices: ["loft-conversions", "building-regulations-drawings-wirral"],
    relatedAreas: ["wallasey"],
    reviewed: REVIEWED,
    metaDescription:
      "Wallasey Village loft conversion case study — a flat-roof dormer with two Juliet balconies and full-height glazing creating a bedroom suite with views across Wales.",
  },

  /* ---------------- 13 ---------------- */
  {
    slug: "new-brighton-loft-conversion",
    title: "Loft conversion with en-suite and walk-in wardrobe",
    town: "New Brighton",
    propertyType: "Family home",
    projectType: "Loft conversion",
    stage: "completed",
    summary:
      "The first floor reconfigured for a new staircase, opening up the loft as a spacious bedroom with private en-suite, walk-in wardrobe and storage.",
    brief:
      "The proposal involved reconfiguring the existing first floor to accommodate a new staircase providing access to a newly created loft level, making the most of the available roof space.",
    challenge:
      "Fitting a compliant new staircase meant rethinking the first-floor layout, and the design had to create a seamless flow between the existing and proposed accommodation.",
    designResponse:
      "The conversion creates a spacious bedroom with a private en-suite, walk-in wardrobe and dedicated storage space, maximising the available roof space while providing a comfortable and practical addition to the home. Careful consideration was given to natural light, functionality and overall layout, and the reconfigured first floor accommodates the new staircase with a natural connection up to the loft.",
    planningRoute: LOFT_PLANNING,
    buildingRegsRoute: LOFT_REGS,
    drawings: BR_PACK_LOFT,
    outcome:
      "A well-designed and functional loft conversion that significantly increases the usable living space within the property. The reconfigured first floor and new staircase create a natural connection to the loft, and the new bedroom, en-suite, walk-in wardrobe and storage form a comfortable private suite.",
    cover: wi("nbLoftFinish", "The finished loft room"),
    gallery: [
      wi("nbLoftExisting", "Before — the property prior to the conversion"),
      wi("nbLoftConcept", "Design visualisation of the proposed conversion"),
      wi("nbLoftExistingPlan", "Existing and demolition first floor & loft plan"),
      wi("nbLoftProposedPlan", "Proposed first floor & loft plan"),
      wi("nbLoftFinish", "The finished loft room"),
    ],
    relatedServices: ["loft-conversions", "building-regulations-drawings-wirral"],
    relatedAreas: ["new-brighton"],
    reviewed: REVIEWED,
    metaDescription:
      "New Brighton loft conversion case study — the first floor reconfigured for a new staircase, creating a loft bedroom with en-suite, walk-in wardrobe and storage.",
  },

  /* ---------------- 14 ---------------- */
  {
    slug: "wallasey-village-garage-conversion",
    title: "Garage conversion to utility and WC",
    town: "Wallasey Village",
    propertyType: "Family home",
    projectType: "Garage conversion & change of use",
    stage: "completed",
    summary:
      "An existing garage converted into a practical WC and dedicated storeroom, making better use of space the household already had.",
    brief:
      "Following an assessment of the existing property and discussions with the homeowners, the proposal transformed an under-used ground-floor garage into a series of practical, well-connected rooms supporting everyday family living.",
    designResponse:
      "The works focused on converting the garage, improving circulation and introducing new service spaces — a utility room and a new WC. The conversion provides essential additional facilities while creating a functional and organised area for everyday use, with the garage brought up to habitable standard for insulation, damp protection, ventilation and fire separation.",
    planningRoute: GARAGE_PLANNING,
    buildingRegsRoute: GARAGE_REGS,
    drawings: BR_PACK,
    outcome:
      "A functional, well-planned and modern ground-floor layout that improves day-to-day living. The conversion and the new service spaces make the home feel more organised and practical.",
    cover: wi("wvGarageWcExternal", "The completed frontage after the garage conversion"),
    gallery: [
      wi("wvGarageWcExisting", "Before — the property with the original garage"),
      wi("wvGarageWcConcept", "Design visualisation of the converted frontage"),
      wi("wvGarageWcBefore", "Inside the garage before the works"),
      wi("wvGarageWcNewWc", "The new WC within the former garage"),
      wi("wvGarageWcStorage", "The new storage space"),
      wi("wvGarageWcExternal", "The completed frontage"),
    ],
    relatedServices: [
      "garage-conversion-drawings-wirral",
      "change-of-use-applications",
      "building-regulations-drawings-wirral",
    ],
    relatedAreas: ["wallasey"],
    reviewed: REVIEWED,
    metaDescription:
      "Wallasey Village garage conversion case study — an existing garage converted into a WC and dedicated storeroom, with Building Regulations drawings by SC Design Wirral.",
  },

  /* ---------------- 15 ---------------- */
  {
    slug: "heswall-rear-extension-pitched",
    title: "Rear extension with a pitched tiled roof",
    town: "Heswall",
    propertyType: "Family home",
    projectType: "Single-storey rear extension",
    stage: "completed",
    summary:
      "A rendered rear extension with a pitched tiled roof, three rooflights and bi-fold doors — a spacious open-plan kitchen and dining area.",
    brief:
      "The proposal modernises the rear elevation, improves natural light levels throughout the ground floor and strengthens the connection between the house and garden through high-quality glazing and carefully selected materials.",
    designResponse:
      "The design respects the character of the existing dwelling while introducing contemporary elements. It comprises a single-storey rear extension with a pitched tiled roof, three rooflights integrated within the roof slope, large anthracite grey aluminium bi-fold doors opening onto the rear patio, a new kitchen window overlooking the garden, rendered external walls matched to the existing dwelling, anthracite grey fascia, soffit and rainwater goods, and integrated external lighting beneath the roof overhang. The pitched roof form helps the extension integrate naturally with the existing architecture while creating a more attractive and balanced rear elevation.",
    planningRoute: EXT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "A bright and spacious family living environment with a much better relationship between the dwelling and its garden. The design balances traditional elements with contemporary detailing to create an attractive and functional addition that complements the host property.",
    cover: wi("heswallPitchedKitchen", "The finished open-plan kitchen in the new extension"),
    gallery: [
      wi("heswallPitchedExisting", "Before — the rear of the property"),
      wi("heswallPitchedConcept", "Design visualisation of the proposed extension"),
      wi("heswallPitchedKitchen", "The finished kitchen"),
    ],
    relatedServices: ["house-extensions", "building-regulations-drawings-wirral"],
    relatedAreas: ["heswall"],
    reviewed: REVIEWED,
    metaDescription:
      "Heswall rear extension case study — a rendered extension with a pitched tiled roof, three rooflights and bi-fold doors creating an open-plan kitchen and dining area.",
  },

  /* ---------------- 16 ---------------- */
  {
    slug: "meols-loft-conversion",
    title: "Timber-clad dormer loft suite",
    town: "Meols",
    propertyType: "Family home",
    projectType: "Loft conversion",
    stage: "completed",
    summary:
      "A timber-clad rear dormer turning unused roof space into a self-contained upper-floor suite — bedroom, dressing room and en-suite.",
    brief:
      "The project set out to create a comfortable, private upper-floor living area comprising a bedroom and bathroom, enhancing both the functionality and the value of the home.",
    designResponse:
      "A new loft-level living suite formed within a timber-clad rear dormer, providing a bedroom, dressing room and en-suite bathroom. The design focuses on maximising headroom, natural light and a functional layout; the timber-clad dormer provides the space required while complementing the existing architecture. Internally the arrangement creates a seamless flow from the bedroom into a dedicated dressing area and a modern en-suite, forming a self-contained upper-floor suite.",
    planningRoute: LOFT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: [...PLANNING_PACK_LOFT, ...BR_PACK_LOFT],
    outcome:
      "The unused roof space is now a high-quality private living area. Internal photographs are still to follow from the homeowner.",
    cover: wi("meolsLoftFinish", "The completed timber-clad rear dormer"),
    gallery: [
      wi("meolsLoftConcept", "Design visualisation of the proposed dormer"),
      wi("meolsLoftFinish", "The completed dormer"),
    ],
    relatedServices: ["loft-conversions", "planning-drawings-wirral"],
    relatedAreas: ["hoylake"],
    reviewed: REVIEWED,
    metaDescription:
      "Meols loft conversion case study — a timber-clad rear dormer creating a bedroom, dressing room and en-suite, with planning and Building Regulations drawings.",
  },

  /* ---------------- 17 ---------------- */
  {
    slug: "prenton-rear-extension",
    title: "Rendered rear extension with bi-fold doors",
    town: "Prenton",
    propertyType: "Family home",
    projectType: "Single-storey rear extension",
    stage: "completed",
    summary:
      "A larger open-plan kitchen and dining area with anthracite bi-fold doors, improving the relationship between the house and the rear garden.",
    brief:
      "The proposal provides a larger open-plan kitchen and dining area, improving the relationship between the property and the rear garden while delivering accommodation that better reflects modern family living requirements.",
    designResponse:
      "The extension complements the existing property while introducing contemporary features. Key design elements include smooth rendered external walls to match the existing dwelling, a low-pitched roof finished with complementary roof tiles, anthracite grey aluminium bi-fold doors providing direct access to the rear garden, a new kitchen window overlooking the garden, contemporary external lighting and matching fascias, soffits, gutters and rainwater goods. The proposed glazing creates a well-proportioned rear elevation and significantly improves the visual connection between the internal living spaces and the outdoor environment.",
    planningRoute: EXT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "A larger, brighter and more functional living space. The development improves the appearance of the rear elevation, increases daylight levels and strengthens the connection between the home and the rear garden.",
    cover: wi("prentonRearFinish", "The completed rendered rear extension"),
    gallery: [
      wi("prentonRearConcept", "Design visualisation of the proposed extension"),
      wi("prentonRearFinish", "The completed extension"),
    ],
    relatedServices: ["house-extensions", "building-regulations-drawings-wirral"],
    relatedAreas: ["prenton"],
    reviewed: REVIEWED,
    metaDescription:
      "Prenton rear extension case study — a rendered single-storey extension with anthracite bi-fold doors creating a larger open-plan kitchen and dining area.",
  },

  /* ---------------- 18 ---------------- */
  {
    slug: "meols-rear-extension",
    title: "Rear extension with enlarged kitchen and dining space",
    town: "Meols",
    propertyType: "Family home",
    projectType: "Single-storey rear extension",
    stage: "completed",
    summary:
      "Additional ground-floor accommodation with an enlarged open-plan kitchen and dining area and better access to the rear garden.",
    brief:
      "The development provides additional ground floor accommodation, improves the functionality of the property and creates a more open and modern living environment while respecting the character and appearance of the existing house.",
    designResponse:
      "A single-storey rear extension designed with a scale and form that complements the existing dwelling and maintains a clear visual hierarchy between the original property and the new addition. Large glazed openings to the rear elevation maximise natural light and provide stronger visual and physical connections to the garden, and the roof design keeps the extension visually subordinate to the main house while providing adequate internal headroom. External materials were selected to complement the existing property and may include rendered external wall finishes to match, matching roof tiles, powder-coated aluminium or uPVC windows and doors, matching fascias, soffits and rainwater goods, and a parapet wall with flat roof.",
    planningRoute: EXT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "The outdated rear projection is replaced with a more functional and attractive extension providing valuable additional living space, increased natural daylight and improved connectivity to the rear garden. The scale, form and materials respect the character of the host property.",
    cover: wi("meolsRearFinish", "The completed single-storey rear extension"),
    gallery: [
      wi("meolsRearConcept", "Design visualisation of the proposed extension"),
      wi("meolsRearFinish", "The completed extension"),
    ],
    relatedServices: ["house-extensions", "building-regulations-drawings-wirral"],
    relatedAreas: ["hoylake"],
    reviewed: REVIEWED,
    metaDescription:
      "Meols rear extension case study — additional ground-floor accommodation with an enlarged open-plan kitchen and dining area and improved access to the garden.",
  },

  /* ---------------- 19 ---------------- */
  {
    slug: "wallasey-hmo-apartments",
    title: "Change of use — HMO to self-contained apartments",
    town: "Wallasey",
    propertyType: "House in multiple occupation",
    projectType: "Change of use & conversion",
    stage: "in-planning",
    summary:
      "Planning permission sought to convert an existing HMO into eight self-contained apartments, retaining the building's character and street presence.",
    brief:
      "This proposal seeks planning permission for the conversion of the existing House in Multiple Occupation into a number of high-quality self-contained residential apartments, providing much-needed accommodation through the sensitive redevelopment of the existing building.",
    challenge:
      "The scheme had to improve the standard of accommodation substantially while retaining the building's architectural character and its contribution to the surrounding street scene.",
    designResponse:
      "The proposal comprises the change of use and internal reconfiguration of the existing building to provide eight self-contained apartments. Each apartment benefits from its own private kitchen, living area, bathroom facilities and sleeping accommodation, with modern open-plan kitchen and living spaces, contemporary bathrooms, improved thermal and acoustic performance, enhanced natural light and ventilation, secure access arrangements and associated bin and cycle storage where applicable. Any external alterations are modest in scale and designed to complement the existing architectural style, with materials selected to match or complement the existing building.",
    planningRoute:
      "A change of use of this kind needs planning permission in its own right. The application was supported by existing and proposed drawings and a planning statement; whether permission is granted is a matter for the local planning authority.",
    drawings: [
      "Measured building survey",
      "Location plan and site block plan",
      "Existing floor plans",
      "Existing elevations",
      "Proposed floor plans",
      "Proposed elevations",
      "Planning statement",
    ],
    outcome:
      "A sustainable and beneficial form of residential development that makes effective use of the existing building, improves the standard of accommodation within it and adds well-designed homes to the local housing stock.",
    cover: wi("hmoProposedElevation", "Proposed elevation for the conversion"),
    gallery: [
      wi("hmoExistingElevation", "The existing building elevation"),
      wi("hmoExistingElevation2", "Another view of the existing building"),
      wi("hmoProposedElevation", "The proposed elevation"),
    ],
    relatedServices: ["change-of-use-applications", "planning-drawings-wirral"],
    relatedAreas: ["wallasey"],
    reviewed: REVIEWED,
    metaDescription:
      "Wallasey change of use case study — planning drawings and a supporting statement for the conversion of an HMO into eight self-contained apartments.",
  },

  /* ---------------- 20 ---------------- */
  {
    slug: "port-sunlight-measured-survey",
    title: "Listed building measured survey",
    town: "Port Sunlight",
    propertyType: "Grade-listed property",
    projectType: "Measured survey & listed building consent",
    stage: "in-planning",
    summary:
      "A detailed measured survey recording a listed Port Sunlight property, forming the basis of a Listed Building Consent application.",
    brief:
      "A detailed measured survey was required to accurately record the existing building, including its internal layout, dimensions, elevations and relevant architectural features, to support a Listed Building Consent application.",
    challenge:
      "Listed building work depends entirely on getting the existing building recorded correctly. The survey has to be accurate enough for the local planning authority and the conservation officer to assess how proposals would affect the building's historic character and significance.",
    designResponse:
      "We carried out a detailed measured survey recording the existing layout, dimensions, elevations and important architectural features, and prepared accurate existing drawings from it. These provide a reliable basis for the proposed drawings and form part of the Listed Building Consent application, allowing the proposals to be properly assessed.",
    planningRoute:
      "Works to a listed building need Listed Building Consent in addition to any planning permission. Whether consent is granted, and on what terms, is a matter for the local planning authority and its conservation officer.",
    drawings: [
      "Measured building survey",
      "Existing ground floor plan",
      "Existing first floor plan",
      "Existing elevations",
    ],
    outcome:
      "Accurate existing drawings that give the conservation officer and the local planning authority a reliable basis for assessing the proposals against the building's historic character and significance.",
    cover: wi("portSunlightFront", "The front of the listed Port Sunlight property"),
    gallery: [
      wi("portSunlightFront", "The front of the property"),
      wi("portSunlightRear", "The rear of the property"),
      wi("portSunlightGroundPlan", "Measured survey ground floor plan"),
      wi("portSunlightFirstPlan", "Measured survey first floor plan"),
    ],
    relatedServices: ["measured-building-surveys", "planning-drawings-wirral"],
    relatedAreas: ["port-sunlight"],
    reviewed: REVIEWED,
    metaDescription:
      "Port Sunlight measured survey case study — a detailed survey and accurate existing drawings of a listed property to support a Listed Building Consent application.",
  },

  /* ---------------- 21 ---------------- */
  {
    slug: "greasby-rear-side-extension",
    title: "Rear and side extension with lounge, gym and utility",
    town: "Greasby",
    propertyType: "Family home",
    projectType: "Rear & side extension",
    stage: "in-planning",
    summary:
      "A modern ground-floor arrangement proposed — lounge, open-plan kitchen, utility, gym and WC — with glazing connecting the house to the garden.",
    brief:
      "This proposal sets out the development of a rear and side extension to enhance the ground-floor layout of the property, introducing a modern, functional arrangement comprising a lounge, open-plan kitchen, utility room, gym and WC.",
    designResponse:
      "A contemporary approach with clean lines, high-quality materials and efficient spatial planning. Glazed doors and windows create strong visual connections between indoor and outdoor spaces, while the side elevation ensures privacy and balance in massing. The extension complements the existing property through sympathetic detailing and proportion, improving both daily usability and long-term value.",
    planningRoute:
      "A full set of planning drawings and supporting reports was prepared for this proposal, including a shadow and daylight study and a design and access statement.",
    buildingRegsRoute: BR_ROUTE,
    drawings: [...PLANNING_PACK, ...BR_PACK],
    outcome: "The project is in the latter stages — finished photographs are still to follow.",
    cover: wi("greasbyConceptRear", "Design visualisation of the proposed rear extension"),
    gallery: [
      wi("greasbyExistingRear", "Before — the rear of the property"),
      wi("greasbyExistingFront", "Before — the front of the property"),
      wi("greasbyConceptRear", "Design visualisation from the garden"),
      wi("greasbyConceptFront", "Design visualisation from the front"),
    ],
    relatedServices: [
      "house-extensions",
      "planning-drawings-wirral",
      "building-regulations-drawings-wirral",
    ],
    relatedAreas: ["greasby"],
    reviewed: REVIEWED,
    metaDescription:
      "Greasby rear and side extension case study — a lounge, open-plan kitchen, utility, gym and WC, with planning and Building Regulations drawings by SC Design Wirral.",
  },

  /* ---------------- 22 ---------------- */
  {
    slug: "bromborough-rear-extension-loft",
    title: "Rear extension and flat-roof dormer loft conversion",
    town: "Bromborough",
    propertyType: "Family home",
    projectType: "Rear extension & loft conversion",
    stage: "under-construction",
    summary:
      "A white rendered rear extension with a central roof lantern, paired with a rear flat-roof dormer clad in dark composite.",
    brief:
      "This proposal seeks permission for the construction of a single-storey rear extension together with a rear flat-roof dormer loft conversion, providing modern family accommodation at ground-floor level and a substantial increase in habitable accommodation within the roof space.",
    designResponse:
      "The rear extension replaces and extends the existing rear accommodation, creating a bright and spacious open-plan kitchen, dining and family living area. It adopts a contemporary flat roof that remains subordinate to the main dwelling while offering an efficient internal layout, prioritising natural light and connectivity with the rear garden through extensive glazing and a central roof lantern. Key features include a single-storey rear extension spanning the majority of the rear elevation, feature glazed roof lantern, large aluminium-framed bi-fold doors opening onto the rear patio, new full-height glazing and a white rendered external finish to complement the existing dwelling.",
    planningRoute: EXT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "Work is still under way on this project and updates will follow. The combination of a contemporary white rendered rear extension and a flat-roof dormer clad in dark composite materials is designed to read as a cohesive, modern addition that stays subordinate to the original dwelling.",
    cover: wi("bromConcept", "Design visualisation of the proposed extension and dormer"),
    gallery: [
      wi("bromConcept", "Design visualisation of the proposed scheme"),
      wi("bromMidFinish", "The extension and dormer part-way through construction"),
    ],
    relatedServices: [
      "house-extensions",
      "loft-conversions",
      "building-regulations-drawings-wirral",
    ],
    relatedAreas: ["bromborough"],
    reviewed: REVIEWED,
    metaDescription:
      "Bromborough rear extension and loft conversion case study — a white rendered extension with a roof lantern and a dark composite-clad rear dormer.",
  },

  /* ---------------- 23 ---------------- */
  {
    slug: "hoylake-rear-extension",
    title: "Mono-pitched rear extension with three rooflights",
    town: "Hoylake",
    propertyType: "Family home",
    projectType: "Single-storey rear extension",
    stage: "under-construction",
    summary:
      "The existing rear extension replaced with a near-full-width mono-pitched addition — open-plan kitchen, dining and family space.",
    brief:
      "The proposed extension provides modern, open-plan family accommodation while significantly enhancing the appearance and functionality of the rear elevation, responding to the character of the existing property in scale and proportion.",
    designResponse:
      "The existing rear extension is removed and replaced with a new single-storey extension across the majority of the rear elevation. The mono-pitched roof slopes away from the main dwelling, reducing its visual impact while providing generous internal ceiling heights, with three rooflights in the roof slope maximising daylight. A contemporary approach uses smooth light-coloured rendered external walls, a mono-pitched tiled roof, large aluminium-framed bi-fold doors providing direct garden access, generous window openings serving the kitchen, and anthracite grey frames, rainwater goods and roof-edge detailing. The combination of render, glazing and dark-framed openings gives a modern appearance while remaining sympathetic to the traditional brickwork of the original house.",
    planningRoute: EXT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "The project is in the early construction stage — client photographs will follow. The completed extension will create a spacious open-plan kitchen, dining and family area forming the primary living space within the home.",
    cover: wi("hoylakeConcept", "Design visualisation of the proposed rear extension"),
    gallery: [
      wi("hoylakeExisting", "Before — the rear of the property"),
      wi("hoylakeConcept", "Design visualisation of the proposed extension"),
    ],
    beforeAfter: {
      label: "Mono-pitched rear extension",
      before: wi("hoylakeExisting"),
      after: wi("hoylakeConcept"),
      aligned: true,
    },
    relatedServices: ["house-extensions", "building-regulations-drawings-wirral"],
    relatedAreas: ["hoylake"],
    reviewed: REVIEWED,
    metaDescription:
      "Hoylake rear extension case study — a near-full-width mono-pitched extension with three rooflights and bi-fold doors creating an open-plan kitchen and family area.",
  },

  /* ---------------- 24 ---------------- */
  {
    slug: "neston-rear-extension",
    title: "Gable-ended rear extension with feature glazing",
    town: "Neston",
    propertyType: "Family home",
    projectType: "Single-storey rear extension",
    stage: "in-planning",
    summary:
      "A plain rear wall replaced with a pitched gable extension, large feature glazing and bi-fold doors onto the garden.",
    brief:
      "The proposed development replaces a relatively plain rear wall with a carefully detailed extension that creates a more functional internal layout and improves the relationship between the house and garden.",
    designResponse:
      "The extension adopts a pitched gable roof design reflecting the traditional architectural style of the existing dwelling, with the ridge height carefully considered to remain subordinate to the main house while providing a generous internal ceiling height. It incorporates a new gable-ended rear projection, large feature glazing within the gable elevation, new glazed bi-fold doors providing direct access to the rear garden, rooflights within the pitched roof to enhance natural daylight, and matching brickwork, roof slates and rainwater goods to complement the existing property.",
    planningRoute: EXT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "A sensitive and well-designed addition. Through matching materials, a traditional gable roof form and contemporary glazing, the proposal balances modern living requirements with the established character of the property.",
    cover: wi("nestonConcept", "Design visualisation of the proposed gable rear extension"),
    gallery: [
      wi("nestonExisting", "Before — the plain rear elevation"),
      wi("nestonConcept", "Design visualisation of the proposed extension"),
    ],
    beforeAfter: {
      label: "Gable-ended rear extension",
      before: wi("nestonExisting"),
      after: wi("nestonConcept"),
      aligned: true,
    },
    relatedServices: ["house-extensions", "building-regulations-drawings-wirral"],
    relatedAreas: ["neston"],
    reviewed: REVIEWED,
    metaDescription:
      "Neston rear extension case study — a pitched gable extension with large feature glazing, bi-fold doors and rooflights, matching the existing brickwork and slates.",
  },

  /* ---------------- 25 ---------------- */
  {
    slug: "liscard-rear-extension",
    title: "Full-width rear extension replacing a conservatory",
    town: "Liscard, Wallasey",
    propertyType: "Family home",
    projectType: "Single-storey rear extension",
    stage: "concept",
    summary:
      "A dated conservatory to be replaced with a rendered full-width extension, central roof lantern and full-height feature glazing.",
    brief:
      "The proposed development replaces the outdated conservatory with a larger, more functional extension providing high-quality open-plan family accommodation, improving the relationship between the dwelling and the rear garden.",
    designResponse:
      "A contemporary design approach that respects the architectural character of the existing dwelling. External walls are finished in render to match the existing property, and a clean flat roof minimises visual impact while providing a modern and elegant appearance. Key features include demolition of the existing conservatory, a full-width single-storey rear extension, a central glazed roof lantern, large aluminium-framed sliding or bi-fold doors, full-height feature glazing adjacent to the main living space, a generous kitchen window overlooking the rear garden, anthracite grey aluminium frames, fascias and rainwater goods, and integrated external lighting to the rear elevation.",
    planningRoute: EXT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "The extensive glazing and central roof lantern will create a bright and spacious open-plan living environment suited to modern family life, while matching materials and carefully considered proportions keep the development sympathetic to the host dwelling.",
    cover: wi("liscRearConcept", "Design visualisation of the proposed rear extension"),
    gallery: [
      wi("liscRearBefore", "Before — the rear with the existing conservatory"),
      wi("liscRearConcept", "Design visualisation of the proposed extension"),
    ],
    relatedServices: ["house-extensions", "building-regulations-drawings-wirral"],
    relatedAreas: ["wallasey"],
    reviewed: REVIEWED,
    metaDescription:
      "Liscard rear extension case study — a dated conservatory replaced with a rendered full-width extension, central roof lantern and full-height feature glazing.",
  },

  /* ---------------- 26 ---------------- */
  {
    slug: "wallasey-village-rear-extension-monopitch",
    title: "Mono-pitched rear extension with flush rooflights",
    town: "Wallasey Village",
    propertyType: "Family home",
    projectType: "Single-storey rear extension",
    stage: "concept",
    summary:
      "The existing rear projection to be replaced with a full-width brick extension under a mono-pitched tiled roof with three flush rooflights.",
    brief:
      "The proposal replaces the existing rear projection with a more substantial and functional extension that enhances both the appearance and usability of the property while remaining sympathetic to the character of the host dwelling.",
    designResponse:
      "External walls use facing brickwork selected to closely match the existing dwelling, ensuring seamless integration between the original house and the extension. The pitched roof design reflects traditional architectural forms found in the surrounding area while incorporating contemporary detailing. Key features include a full-width single-storey rear extension, mono-pitched tiled roof construction, three flush-fitting rooflights, large anthracite grey aluminium bi-fold doors, a new feature kitchen window overlooking the rear garden, matching brickwork and roof tiles, contemporary external lighting and anthracite grey fascias, soffits and rainwater goods.",
    planningRoute: EXT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "Works have not started yet and further photographs will follow. Replacing the existing rear projection with a larger extension incorporating rooflights and extensive glazing is designed to create a bright and spacious open-plan living environment better suited to modern family life.",
    cover: wi("wvMonoConcept", "Design visualisation of the proposed rear extension"),
    gallery: [
      wi("wvMonoExisting", "Before — the existing rear projection"),
      wi("wvMonoConcept", "Design visualisation of the proposed extension"),
    ],
    relatedServices: ["house-extensions", "building-regulations-drawings-wirral"],
    relatedAreas: ["wallasey"],
    reviewed: REVIEWED,
    metaDescription:
      "Wallasey Village rear extension case study — a full-width brick extension under a mono-pitched tiled roof with three flush rooflights and bi-fold doors.",
  },

  /* ---------------- 27 ---------------- */
  {
    slug: "heswall-rear-extension-lantern",
    title: "Brick rear extension with a central roof lantern",
    town: "Heswall",
    propertyType: "Family home",
    projectType: "Single-storey rear extension",
    stage: "concept",
    summary:
      "A dated conservatory to be replaced with a thermally efficient brick extension under a flat roof with a central glazed lantern.",
    brief:
      "The proposed development replaces the dated conservatory with a larger, thermally efficient extension creating a modern open-plan kitchen, dining and family living area, significantly improving the functionality of the property.",
    designResponse:
      "The extension complements the existing dwelling through matching brickwork and contemporary architectural detailing. A modern flat-roof design with a slim fascia profile creates clean architectural lines while remaining subordinate to the host dwelling, and the roof lantern provides an attractive focal point that brings daylight into the centre of the floorplan. Key features include demolition of the existing conservatory, a full-width single-storey rear extension, flat roof construction with a central glazed roof lantern, matching facing brickwork, large anthracite grey aluminium bi-fold doors, a full-height glazed side panel, a feature kitchen window overlooking the garden, integrated soffit lighting and anthracite grey fascias, soffits and rainwater goods.",
    planningRoute: EXT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "The proposal will create a spacious open-plan kitchen, dining and family living area, improve daylight levels through the roof lantern and extensive glazing, and provide a stronger connection between the dwelling and the rear garden.",
    cover: wi("heswallLanternConcept", "Design visualisation of the proposed rear extension"),
    gallery: [
      wi("heswallLanternExisting", "Before — the rear with the dated conservatory"),
      wi("heswallLanternConcept", "Design visualisation of the proposed extension"),
    ],
    relatedServices: ["house-extensions", "building-regulations-drawings-wirral"],
    relatedAreas: ["heswall"],
    reviewed: REVIEWED,
    metaDescription:
      "Heswall rear extension case study — a dated conservatory replaced with a brick extension under a flat roof with a central glazed roof lantern and bi-fold doors.",
  },

  /* ---------------- 28 ---------------- */
  {
    slug: "wallasey-rear-extension",
    title: "Replacement rear extension with mono-pitched roof",
    town: "Wallasey",
    propertyType: "Family home",
    projectType: "Single-storey rear extension",
    stage: "under-construction",
    summary:
      "The existing rear projection demolished and replaced with a larger extension, three rooflights and large sliding or bi-fold doors.",
    brief:
      "The proposed development has been carefully designed to enhance the functionality and appearance of the property while remaining sympathetic to the scale, character and appearance of the host dwelling and surrounding residential area.",
    designResponse:
      "The existing rear projection is demolished and replaced with a larger single-storey rear extension extending across a substantial portion of the rear elevation. A contemporary mono-pitched roof slopes away from the existing dwelling, ensuring the addition remains visually subordinate to the main house while creating generous internal ceiling heights, with three rooflights in the roof slope maximising daylight. Key features include the replacement single-storey rear extension, contemporary mono-pitched roof design, three rooflights, large aluminium-framed sliding or bi-fold doors, a new kitchen window overlooking the rear garden, an improved open-plan family living arrangement and materials selected to complement the existing dwelling.",
    planningRoute: EXT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "The project is in the early construction stage — client photographs will follow. The extension will create a spacious kitchen, dining and family area, providing improved circulation and a stronger relationship between the home and rear garden.",
    cover: wi("wallaseyMonoConcept", "Design visualisation of the proposed rear extension"),
    gallery: [
      wi("wallaseyMonoExisting", "Before — the rear of the property"),
      wi("wallaseyMonoConcept", "Design visualisation of the proposed extension"),
    ],
    beforeAfter: {
      label: "Replacement rear extension",
      before: wi("wallaseyMonoExisting"),
      after: wi("wallaseyMonoConcept"),
      aligned: true,
    },
    relatedServices: ["house-extensions", "building-regulations-drawings-wirral"],
    relatedAreas: ["wallasey"],
    reviewed: REVIEWED,
    metaDescription:
      "Wallasey rear extension case study — the existing rear projection replaced with a larger mono-pitched extension with three rooflights and large glazed doors.",
  },

  /* ---------------- 29 ---------------- */
  {
    slug: "prenton-rear-extension-loft",
    title: "Brick rear extension and loft conversion",
    town: "Prenton",
    propertyType: "Family home",
    projectType: "Rear extension & loft conversion",
    stage: "under-construction",
    summary:
      "A matching brick rear extension under a mono-pitched tiled roof with three rooflights, alongside a loft conversion.",
    brief:
      "The proposal enhances the overall usability of the dwelling by creating a bright, open-plan environment better suited to modern family living, with an improved connection to the rear garden.",
    designResponse:
      "The extension complements the existing dwelling through matching brickwork, roof materials and traditional proportions. External walls use facing brickwork selected to closely match the existing property, creating a seamless transition between the original dwelling and the new extension, and the roof uses complementary tiles for visual consistency. Key features include a single-storey rear extension, a mono-pitched tiled roof, three rooflights incorporated into the roof plane, large glazed French doors providing direct garden access, a feature kitchen window overlooking the rear garden, matching facing brickwork, white framed windows and doors to complement the existing dwelling, and integrated soffit lighting to the rear elevation.",
    planningRoute: EXT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome:
      "This project is under construction and new images will appear here in future. The development will provide a spacious open-plan kitchen, dining and family area while improving natural light levels and strengthening the connection to the rear garden.",
    cover: wi("prentonLoftConcept", "Design visualisation of the proposed extension"),
    gallery: [
      wi("prentonLoftExisting", "Before — the rear of the property"),
      wi("prentonLoftConcept", "Design visualisation of the proposed extension"),
    ],
    relatedServices: [
      "house-extensions",
      "loft-conversions",
      "building-regulations-drawings-wirral",
    ],
    relatedAreas: ["prenton"],
    reviewed: REVIEWED,
    metaDescription:
      "Prenton rear extension and loft conversion case study — matching brickwork under a mono-pitched tiled roof with three rooflights and glazed French doors.",
  },

  /* ---------------- 30 ---------------- */
  {
    slug: "heswall-rear-extension-timber",
    title: "Timber-clad rear extension with corner glazing",
    town: "Heswall",
    propertyType: "Family home",
    projectType: "Single-storey rear extension",
    stage: "concept",
    summary:
      "A contemporary extension proposed in vertical timber cladding, with a multi-pitched hipped roof and a corner window framing the garden.",
    brief:
      "The extension adopts a modern architectural approach, incorporating high levels of glazing, premium external materials and an attractive roof design to create a bright and spacious family living environment that complements the existing dwelling.",
    designResponse:
      "A key feature is the use of high-quality vertical timber cladding to the exterior elevations, providing warmth, texture and character while allowing the extension to sit comfortably within the garden setting. The timber finish is complemented by anthracite aluminium windows, doors, fascias and rainwater goods for a refined and modern appearance. An extensive corner glazing arrangement and a large sliding door system maximise views towards the garden and create a seamless transition between internal and external spaces. Key design features include a multi-pitched hipped roof, a large rooflight within the roof plane, floor-to-ceiling aluminium glazing and a corner window detail providing panoramic garden views.",
    planningRoute: EXT_PLANNING,
    buildingRegsRoute: BR_ROUTE,
    drawings: BR_PACK,
    outcome: "The project has not begun yet — updates will follow.",
    cover: wi("heswallTimberConcept", "Design visualisation of the proposed timber-clad extension"),
    gallery: [wi("heswallTimberConcept", "Design visualisation of the proposed extension")],
    relatedServices: ["house-extensions", "residential-design"],
    relatedAreas: ["heswall"],
    reviewed: REVIEWED,
    metaDescription:
      "Heswall rear extension case study — a contemporary timber-clad extension with a multi-pitched hipped roof, corner glazing and large sliding doors.",
  },
];
