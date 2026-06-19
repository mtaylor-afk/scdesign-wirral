/**
 * Service catalogue — ARCHITECTURAL DESIGN services only (no construction).
 * Wording uses "architectural design / drawings". See LEGAL FLAG in site.ts
 * regarding the protected title "architect" (Architects Act 1997).
 *
 * Planning/building-regs statements are hedged ("often", "may", "subject to
 * confirmation with your local authority") — never guaranteed approvals.
 */

export type Service = {
  slug: string;
  title: string;
  short: string;
  blurb: string;
  intro: string;
  points: { title: string; body: string }[];
  faqs: { q: string; a: string }[];

  /* ---- Optional rich fields (drive the v2 service-page template) ---- */
  category?: "design" | "planning" | "builder";
  h1?: string; // page heading when it differs from `title`
  metaTitle?: string; // exact <title> keyword phrase (brand appended by pageMeta)
  metaDescription?: string; // exact meta description
  whoFor?: string[]; // "Who this service is for" bullets
  included?: string[]; // "What's included" bullets
  notIncluded?: string[]; // "What may be separate" bullets
  planningRoute?: string[]; // paragraphs
  buildingRegsRoute?: string[]; // paragraphs
  sendFirst?: string[]; // "What to send first" bullets
  localConsiderations?: string[]; // Wirral-specific paragraphs
  sections?: { heading: string; body: string[] }[]; // extra prose sections
  relatedServices?: string[]; // service slugs
  relatedGuides?: string[]; // guide/other paths
};

export const services: Service[] = [
  {
    slug: "house-extensions",
    title: "House Extension Design",
    short: "Extensions",
    category: "design",
    h1: "House Extension Drawings & Design in Wirral",
    metaTitle: "House Extension Drawings Wirral",
    metaDescription:
      "House extension design and planning drawings for Wirral homeowners, including rear, side, wraparound and kitchen-diner extensions. 15+ years' experience.",
    blurb:
      "Architectural design drawings for rear, side, wraparound and kitchen-diner extensions — planned around how you actually live.",
    intro:
      "A well-designed extension can transform how a home works without the upheaval of moving. We prepare the design and the drawings — concept, planning and building-regulations — so Wirral homeowners can take a clear, accurate scheme to builders to price and build. We design only; we don't carry out the building work, which keeps our advice focused on getting your design right.",
    whoFor: [
      "Homeowners who want more space, light or a better layout without moving",
      "Families needing an open-plan kitchen-diner or extra ground-floor room",
      "Owners of period or post-war Wirral homes weighing up what's realistic",
      "Anyone who has an idea but isn't sure what drawings or approvals they need",
    ],
    included: [
      "An initial review of your property, photos and goals",
      "Existing and proposed plans and elevations",
      "A considered design developed with you, with options where useful",
      "Planning drawings to support an application or lawful development certificate",
      "Building-regulations drawings where your project needs them",
      "A clear drawing pack builders can quote from accurately",
    ],
    notIncluded: [
      "The building work itself (we are design-only — you appoint a builder)",
      "Structural engineer calculations, where a beam or opening needs them",
      "Local authority planning and building-control fees",
      "Party wall matters, which may need a party wall surveyor",
    ],
    points: [
      {
        title: "Rear extensions",
        body: "Open up the back of your home with a brighter kitchen-diner or living space designed around your garden and light.",
      },
      {
        title: "Side & wraparound",
        body: "Reclaim awkward side returns and corners to add genuinely usable, light-filled rooms that suit the plot.",
      },
      {
        title: "Kitchen-diner extensions",
        body: "Layouts that put cooking, dining and family life at the heart of the home, with sightlines and storage planned in.",
      },
      {
        title: "Two-storey extensions",
        body: "Where the plot and street allow, adding space above and below in one considered, well-proportioned design.",
      },
    ],
    planningRoute: [
      "Many single-storey rear extensions fall within permitted development, which means a full planning application may not be needed — but the size, height and position limits are strict and don't apply to every home. Flats, maisonettes and some converted houses don't have the same rights.",
      "Larger, two-storey, side or front extensions, and homes in conservation areas or with an Article 4 direction, are more likely to need a full householder planning application. We advise on the likely route for your specific property and prepare the drawings it needs — always subject to confirmation with Wirral Council (or your local planning authority).",
      "Where it's useful, a Lawful Development Certificate gives formal confirmation that works are permitted development, which can be reassuring for future sale or mortgage.",
    ],
    buildingRegsRoute: [
      "Building regulations are separate from planning. Almost all extensions need building-regulations approval covering structure, insulation, fire safety, drainage and ventilation — even when planning permission isn't required.",
      "We prepare the technical drawings that support a building-control application, so your builder and building control both work from the same clear information.",
    ],
    localConsiderations: [
      "Wirral's housing is varied — Edwardian and Victorian terraces around Wallasey and Birkenhead, post-war semis across Bromborough and Moreton, and larger plots in Heswall and West Kirby. Each calls for a slightly different approach to scale, light and how the extension meets the existing house.",
      "Boundary positions, neighbouring windows and overlooking all matter for both design quality and planning. We design with those considerations in mind from the first sketch rather than as an afterthought.",
    ],
    sendFirst: [
      "A few photos of the area you'd like to extend, inside and out",
      "Your postcode and rough idea of what you'd like to achieve",
      "Any existing plans or an estate-agent floorplan if you have one",
      "A sense of your budget and timescale",
    ],
    faqs: [
      {
        q: "Do I need planning permission for a rear extension?",
        a: "Often a single-storey rear extension is permitted development, but not always — it depends on size, height, position and your property. We advise on the likely route and prepare the drawings, always confirmed with your local authority.",
      },
      {
        q: "Can you help with permitted development?",
        a: "Yes. We'll advise whether your project is likely to fall under permitted development and can prepare drawings for a Lawful Development Certificate so you have formal confirmation.",
      },
      {
        q: "Can you design a kitchen-diner extension?",
        a: "Absolutely — open-plan kitchen-diners are one of the most common projects we design, planned around light, flow, storage and how your family uses the space.",
      },
      {
        q: "Do I need building regulations drawings?",
        a: "Almost all extensions need building-regulations approval, which is separate from planning. We prepare the technical drawings for that process.",
      },
      {
        q: "Can builders quote from your drawings?",
        a: "Yes — that's the point of a clear drawing pack. Builders can price accurately from the same information, rather than guessing.",
      },
      {
        q: "Can you help if I'm in a conservation area?",
        a: "Yes. Conservation-area work needs a sensitive, well-justified design — see our conservation area design service. We prepare drawings with that context in mind.",
      },
    ],
    relatedServices: [
      "planning-drawings-wirral",
      "building-regulations-drawings-wirral",
      "concept-design-feasibility",
    ],
    relatedGuides: [
      "/guides/do-i-need-planning-permission-for-an-extension",
      "/guides/do-i-need-building-regulations-approval",
      "/guides/what-drawings-do-builders-need",
      "/guides/rear-side-wraparound-extension-planning-rules",
      "/guides/how-to-brief-architectural-designer-extension",
      "/guides/after-planning-permission-next-steps",
    ],
  },
  {
    slug: "loft-conversions",
    title: "Loft Conversion Design",
    short: "Loft Conversions",
    category: "design",
    h1: "Loft Conversion Drawings & Design in Wirral",
    metaTitle: "Loft Conversion Drawings Wirral",
    metaDescription:
      "Loft conversion design and building-regulations drawings for Wirral homes, including dormer, rooflight and hip-to-gable conversions. 15+ years' experience.",
    blurb:
      "Dormer, rooflight and hip-to-gable loft designs that add a bedroom, office or bathroom without losing what makes a loft feel special.",
    intro:
      "A loft conversion is often the most cost-effective way to add a bedroom, home office or en-suite to a Wirral home. We design the layout, staircase and rooflines to make the most of head height and light, and prepare the planning and building-regulations drawings your project needs — ready for a builder to price and build.",
    whoFor: [
      "Homeowners needing an extra bedroom, office or bathroom",
      "Owners of semis and terraces with usable roof space",
      "Anyone unsure whether their loft has the head height to convert",
      "Families who'd rather build up than move",
    ],
    included: [
      "An honest first view on whether your loft is suitable",
      "Layout design covering staircase position and head height",
      "Dormer, rooflight or hip-to-gable design as appropriate",
      "Planning drawings where permission is needed",
      "Building-regulations drawings, including fire-safety considerations",
      "A clear pack for builders to quote and build from",
    ],
    notIncluded: [
      "The building work itself (we design only)",
      "Structural engineer calculations for new beams and floor structure",
      "Building-control and any planning fees",
      "Party wall agreements with neighbours where required",
    ],
    points: [
      {
        title: "Dormer conversions",
        body: "Add floor area and head height with a dormer designed to suit your roof, your street and the space you need.",
      },
      {
        title: "Rooflight (Velux) conversions",
        body: "A simpler, often cost-effective route where your existing roof already has the height for it.",
      },
      {
        title: "Hip-to-gable",
        body: "Where suitable, squaring off a hipped roof to unlock significantly more usable space.",
      },
      {
        title: "Staircase & head-height planning",
        body: "Designed early so the finished loft is comfortable, compliant and genuinely usable rather than an afterthought.",
      },
    ],
    planningRoute: [
      "Many loft conversions are permitted development, particularly rooflight conversions that don't alter the roof shape. Dormers and other changes have volume and position limits, and homes in conservation areas or with an Article 4 direction often lose those rights.",
      "We advise on the likely route and, where a full householder application or Lawful Development Certificate is the sensible step, prepare the drawings to support it — subject to confirmation with your local authority.",
    ],
    buildingRegsRoute: [
      "Habitable loft conversions always need building-regulations approval. This covers structure, fire safety and means of escape (often including protected stairways and fire doors), insulation and stair design.",
      "We prepare the building-regulations drawings, and where new beams or floor structure are involved a structural engineer provides the supporting calculations.",
    ],
    localConsiderations: [
      "Wirral's terraces and semis vary in roof pitch and ridge height, which affects how much usable space a conversion really gains. We assess that early so you have a realistic picture before committing.",
      "On streets with a consistent roofline, dormer design needs to be handled sympathetically — both for planning and so the finished home still looks right.",
    ],
    sendFirst: [
      "Photos of the loft inside, including the roof structure if you can see it",
      "A photo of the house from the street and rear",
      "Where you'd like the new stairs to come up from",
      "What you want the loft to become — bedroom, office, bathroom",
    ],
    faqs: [
      {
        q: "Will my loft have enough head height?",
        a: "Most do, but it depends on roof pitch, ridge height and structure. Send a few photos and we'll give you an honest first view before any commitment.",
      },
      {
        q: "Does a loft conversion need planning permission?",
        a: "Often it's permitted development, especially rooflight conversions — but dormers and homes in conservation areas may need permission. We advise on the likely route, confirmed with your local authority.",
      },
      {
        q: "Does a loft conversion need building regulations?",
        a: "Yes — habitable loft conversions always require building-regulations approval, including fire-safety and structural requirements. We prepare those drawings.",
      },
      {
        q: "Can you help with a dormer design?",
        a: "Yes — dormers are a common way to add head height and floor area, and we design them to suit your roof and street.",
      },
      {
        q: "Do I need structural calculations?",
        a: "Usually yes — new beams and floor structure need a structural engineer's calculations, which sit alongside our drawings.",
      },
      {
        q: "Can builders quote from the drawing pack?",
        a: "Yes — a clear pack lets builders price the same scope accurately rather than guessing.",
      },
    ],
    relatedServices: ["building-regulations-drawings-wirral", "planning-drawings-wirral"],
    relatedGuides: [
      "/guides/loft-conversion-building-regulations",
      "/guides/loft-conversion-stairs-head-height-fire-safety",
      "/guides/do-i-need-planning-permission-for-an-extension",
    ],
  },
  {
    slug: "residential-design",
    title: "Full Architectural Design Services",
    short: "Full Design Service",
    category: "design",
    h1: "Full Architectural Design Services in Wirral (Concept to Approval)",
    metaTitle: "Full Architectural Design Services Wirral",
    metaDescription:
      "Bespoke residential design, concept layouts and space planning for Wirral homeowners looking to improve, extend or reconfigure their homes.",
    blurb:
      "Concept design, space planning and architectural drawings for homeowners who want their project shaped properly before committing.",
    intro:
      "Our full architectural design service takes your project from first idea to approval-ready drawings. We help you explore what's possible, plan the space, weigh up options and turn a vague idea into a clear, considered design you can take forward with confidence — whether that's an extension, a reconfiguration, or making an awkward house finally work.",
    whoFor: [
      "Homeowners with a rough idea who want to explore it properly",
      "Anyone wrestling with an awkward layout or wasted space",
      "Owners planning a whole-home reconfiguration, not just one room",
      "People who want options compared before committing to a direction",
    ],
    included: [
      "A proper look at how you live and what's not working",
      "Concept design and space planning",
      "Layout options compared side by side",
      "A clear design direction you understand and feel confident about",
      "A basis to move into planning and building-regulations drawings",
    ],
    notIncluded: [
      "The building work itself (design only)",
      "Detailed structural design (provided by a structural engineer when needed)",
      "Interior styling, furnishing and decoration",
    ],
    points: [
      {
        title: "Concept design",
        body: "Explore layouts and ideas before committing to a single direction.",
      },
      {
        title: "Space planning",
        body: "Make every square metre work — light, movement, storage and sightlines.",
      },
      {
        title: "Design options",
        body: "Compare approaches side by side so you make an informed decision.",
      },
      {
        title: "Whole-home reconfiguration",
        body: "Rethink how the whole house flows, not just add a single room onto the back.",
      },
    ],
    sections: [
      {
        heading: "When bespoke design is useful before planning drawings",
        body: [
          "It's often best to involve us before you've fixed on a single answer. Exploring the design first means the planning drawings are based on the right scheme — not a decision you've already half-committed to.",
          "A clear brief and a considered concept also make the later stages smoother and help builders understand exactly what you're trying to achieve.",
        ],
      },
    ],
    sendFirst: [
      "Photos of the rooms or spaces that aren't working",
      "An estate-agent floorplan if you have one",
      "A short note on what you wish the house did better",
    ],
    faqs: [
      {
        q: "Can you help if I only have a rough idea?",
        a: "Yes — that's often the best time to involve us. We help you explore the options and shape the brief, not just draw a decision you've already made.",
      },
      {
        q: "Can you give multiple layout options?",
        a: "Yes. Comparing a few approaches side by side usually leads to a better, more confident decision.",
      },
      {
        q: "Can you help make an awkward house work better?",
        a: "That's a big part of what we do — rethinking flow, light and storage so the whole home works harder.",
      },
      {
        q: "Is this separate from planning drawings?",
        a: "It can be a first step on its own, or flow straight into planning and building-regulations drawings once the design is settled.",
      },
      {
        q: "Can you design around a budget?",
        a: "Yes — we design with build cost in mind so the project stays realistic, and the drawings let builders quote accurately.",
      },
    ],
    relatedServices: ["house-extensions", "loft-conversions"],
    relatedGuides: ["/guides/how-much-does-architectural-design-cost", "/guides/architect-vs-architectural-designer"],
  },

  /* ---------------- New dedicated planning/approval pages ---------------- */
  {
    slug: "planning-drawings-wirral",
    title: "Planning Drawings",
    short: "Planning Drawings",
    category: "planning",
    h1: "Planning Drawings in Wirral",
    metaTitle: "Planning Drawings Wirral | Householder Planning Support",
    metaDescription:
      "Planning drawings for Wirral home extensions, loft conversions and alterations, including existing and proposed plans, elevations and site plans.",
    blurb:
      "Existing and proposed plans, elevations and site plans prepared to support a householder planning application in Wirral.",
    intro:
      "If you've been told you need 'planning drawings', this is the page for you. We prepare the accurate, scaled drawings a householder planning application needs and explain what each one is for — so your application to Wirral Council is well presented and easy to understand.",
    whoFor: [
      "Homeowners told their extension or loft needs planning permission",
      "Anyone preparing a householder planning application",
      "People who want their proposal presented clearly to the council",
    ],
    included: [
      "Existing plans and elevations of your property as it is now",
      "Proposed plans and elevations showing the design",
      "A site/location plan identifying the property",
      "A design and access statement where the application calls for one",
    ],
    notIncluded: [
      "Building-regulations (technical) drawings — a separate stage",
      "The planning application fee paid to the council",
      "Specialist reports a council may request for sensitive sites",
    ],
    points: [
      {
        title: "Existing & proposed plans",
        body: "Scaled floor plans showing the property now and as designed, so the change is clear at a glance.",
      },
      {
        title: "Elevations",
        body: "How the proposal looks from each side, in proportion and in context with the existing house.",
      },
      {
        title: "Site / location plan",
        body: "The plan that identifies your property and its boundaries for the application.",
      },
      {
        title: "Design & access statement",
        body: "Where required, a short statement explaining and justifying the design.",
      },
    ],
    sections: [
      {
        heading: "What a householder application usually needs",
        body: [
          "A typical householder planning application is supported by existing and proposed plans and elevations, a location plan and a site plan. Some proposals also need a design and access statement, particularly in sensitive locations.",
          "Wirral Council, like all local planning authorities, validates the application against its requirements before assessing it. Well-prepared drawings reduce the risk of delays at validation.",
        ],
      },
    ],
    sendFirst: [
      "Your postcode and what you'd like to build",
      "Photos of the property and the area affected",
      "Any existing plans or floorplans you already have",
    ],
    faqs: [
      {
        q: "What drawings do I need for a planning application?",
        a: "Usually existing and proposed plans and elevations, plus a location and site plan. Some applications also need a design and access statement. We prepare the set your application requires.",
      },
      {
        q: "Do you deal with Wirral Council?",
        a: "We prepare the drawings and support your submission. The application is made in your name, and we guide you through the process and any requested changes.",
      },
      {
        q: "Are planning drawings the same as building-regs drawings?",
        a: "No — planning drawings show what you want to build; building-regulations drawings show how it's built. Most projects need both, at different stages. See our guide on the difference.",
      },
    ],
    relatedServices: [
      "building-regulations-drawings-wirral",
      "house-extensions",
      "change-of-use-applications",
    ],
    relatedGuides: [
      "/guides/planning-drawings-vs-building-regulations-drawings",
      "/guides/do-i-need-planning-permission-for-an-extension",
      "/guides/wirral-householder-planning-application-drawings-checklist",
      "/guides/invalid-planning-application-drawings-wirral",
      "/guides/planning-permission-vs-lawful-development-certificate",
    ],
  },
  {
    slug: "building-regulations-drawings-wirral",
    title: "Building Regulations Drawings",
    short: "Building Regs Drawings",
    category: "planning",
    h1: "Building Regulations Drawings in Wirral",
    metaTitle: "Building Regulations Drawings Wirral",
    metaDescription:
      "Building-regulations drawings for Wirral extensions, loft conversions and alterations — technical sections, details and specifications for building control.",
    blurb:
      "Technical drawings and details prepared for building-control approval — the 'how it's built' stage that follows planning.",
    intro:
      "Building-regulations drawings are the technical drawings that show how your project is built — structure, insulation, fire safety, drainage and ventilation. They're separate from planning drawings and are what building control (and your builder) work from. We prepare them clearly so the standards are met and quotes are accurate.",
    whoFor: [
      "Homeowners moving from planning to the build stage",
      "Anyone whose builder or building control has asked for technical drawings",
      "Projects that are permitted development but still need building regs",
    ],
    included: [
      "Construction sections and technical details",
      "Specifications for insulation, fire safety, drainage and ventilation",
      "Stair and structural arrangement (with engineer input where needed)",
      "A drawing pack suitable for a full plans building-control application",
    ],
    notIncluded: [
      "Structural engineer calculations (a specialist provides these)",
      "Building-control fees",
      "The building work itself",
    ],
    points: [
      {
        title: "Technical sections & details",
        body: "Drawings that show how the construction works — foundations, walls, roof and junctions.",
      },
      {
        title: "Insulation & energy",
        body: "Specifications to meet current standards for thermal performance.",
      },
      {
        title: "Fire, drainage & ventilation",
        body: "The safety and servicing requirements that building control checks.",
      },
      {
        title: "Builder-ready information",
        body: "A clear pack so builders quote and build to the same standard.",
      },
    ],
    sections: [
      {
        heading: "Why building-regs drawings matter even without planning",
        body: [
          "A project can be permitted development for planning purposes and still need building-regulations approval. Skipping this stage causes problems on site and at sale, when a buyer's solicitor asks for the completion certificate.",
          "Approval is obtained through local authority building control or an approved inspector, with inspections at key stages. We prepare the drawings that support a full plans application.",
        ],
      },
    ],
    sendFirst: [
      "Your planning drawings or agreed design, if you have them",
      "Photos of the existing property",
      "Details of any builder already involved",
    ],
    faqs: [
      {
        q: "How are building-regs drawings different from planning drawings?",
        a: "Planning drawings show what you want to build and how it looks; building-regulations drawings show how it's constructed and meets safety and energy standards.",
      },
      {
        q: "Do I need a structural engineer?",
        a: "Often yes, where there are new beams or openings. The engineer's calculations sit alongside our drawings.",
      },
      {
        q: "Will builders quote from these?",
        a: "Yes — building-regulations drawings give builders the technical detail to price accurately and build correctly.",
      },
    ],
    relatedServices: ["planning-drawings-wirral", "loft-conversions", "garage-conversion-drawings-wirral"],
    relatedGuides: [
      "/guides/do-i-need-building-regulations-approval",
      "/guides/loft-conversion-building-regulations",
      "/guides/full-plans-vs-building-notice-wirral",
      "/guides/after-planning-permission-next-steps",
      "/guides/structural-calculations-vs-architectural-drawings",
    ],
  },
  {
    slug: "garage-conversion-drawings-wirral",
    title: "Garage Conversion Drawings",
    short: "Garage Conversions",
    category: "design",
    h1: "Garage Conversion Drawings in Wirral",
    metaTitle: "Garage Conversion Drawings Wirral",
    metaDescription:
      "Garage conversion design and building-regulations drawings for Wirral homeowners turning an integral or attached garage into usable living space.",
    blurb:
      "Design and drawings to turn an under-used garage into a usable room — office, snug, playroom or extra bedroom.",
    intro:
      "Converting a garage is one of the most cost-effective ways to gain a room, because the structure is largely there already. We design the new space and prepare the building-regulations drawings — covering insulation, damp, floor levels and fire separation — so a Wirral builder can quote and build with confidence.",
    whoFor: [
      "Homeowners with an integral or attached garage they rarely use for the car",
      "Anyone needing a home office, snug, playroom or extra bedroom",
      "People who want to add space without extending the footprint",
    ],
    included: [
      "Design of the new room and how it connects to the house",
      "Building-regulations drawings covering insulation, damp and floor levels",
      "Fire-separation detailing where the garage adjoins the house",
      "A clear pack for builders to quote from",
    ],
    notIncluded: [
      "The building work itself",
      "Structural calculations if the opening is widened or altered",
      "Building-control and any planning fees",
    ],
    points: [
      {
        title: "Integral garage conversions",
        body: "The most common case — converting a garage built into the house into a warm, usable room.",
      },
      {
        title: "Detached garages",
        body: "Where a separate garage becomes an office or studio, with its own considerations.",
      },
      {
        title: "Insulation, damp & floor levels",
        body: "The technical essentials that turn a cold garage into a comfortable, compliant room.",
      },
      {
        title: "Fire separation",
        body: "Detailing where the converted space adjoins the rest of the house.",
      },
    ],
    planningRoute: [
      "Converting a garage within the existing structure is often permitted development, particularly where the external appearance changes little. However, replacing the garage door with a window or wall changes the frontage, and some areas have conditions (or Article 4 directions) that remove these rights.",
      "We advise on the likely route and, where useful, prepare drawings for a Lawful Development Certificate — subject to confirmation with your local authority.",
    ],
    buildingRegsRoute: [
      "Garage conversions need building-regulations approval. The key areas are insulation and damp-proofing, raising and insulating the floor, ventilation, and fire separation where the garage adjoins the house.",
      "We prepare the drawings and specifications that building control needs.",
    ],
    sendFirst: [
      "Photos of the garage inside and the front of the house",
      "Whether the garage is integral (built into the house) or detached",
      "What you'd like the new room to be",
    ],
    faqs: [
      {
        q: "Does a garage conversion need planning permission?",
        a: "Often it's permitted development if it stays within the existing structure, but changing the frontage or an Article 4 area can change that. We advise on the likely route, confirmed with your local authority.",
      },
      {
        q: "Does it need building regulations?",
        a: "Yes — insulation, damp, floor levels, ventilation and fire separation all fall under building regulations. We prepare those drawings.",
      },
      {
        q: "Can I keep some of the garage for storage?",
        a: "Often yes — a partial conversion keeping storage at the front is a popular approach, and we can design for it.",
      },
    ],
    relatedServices: ["building-regulations-drawings-wirral", "house-extensions", "change-of-use-applications"],
    relatedGuides: [
      "/guides/garage-conversion-planning-building-regulations-wirral",
      "/guides/do-i-need-building-regulations-approval",
      "/guides/permitted-development-rights-wirral",
    ],
  },
  {
    "slug": "front-porch-extension-design",
    "title": "Front Porch Extension Design",
    "short": "Front Porches",
    "category": "design",
    "h1": "Front Porch Extension Drawings & Design in Wirral",
    "metaTitle": "Front Porch Extension Design Wirral",
    "metaDescription": "Front porch design and drawings for Wirral homes — better kerb appeal, a sheltered entrance and handy storage. Design-only, builder-ready plans. 15+ years' experience.",
    "blurb": "Architectural design and drawings for front porches that lift kerb appeal, shelter your door and add genuinely useful storage.",
    "intro": "A well-designed front porch does more than look smart — it shelters your entrance from Wirral weather, keeps draughts out of the hallway and gives you somewhere to drop coats, boots and parcels. We prepare the design and the drawings so you can take a clear, accurate scheme to a builder to price and build. We design only; we don't carry out the building work, which keeps our advice focused on getting the look, proportions and detailing right.",
    "whoFor": [
      "Homeowners who want to lift the kerb appeal and first impression of their home",
      "Families wanting a sheltered entrance and somewhere to store coats, shoes and parcels",
      "Owners of homes with an exposed or draughty front door",
      "Anyone who wants a porch that looks like it was always part of the house, not bolted on"
    ],
    "included": [
      "An initial review of your frontage, photos and what you'd like the porch to do",
      "Existing and proposed plans and elevations",
      "A design that picks up the materials, proportions and detailing of your house",
      "Advice on whether your porch is likely to fall within permitted development, subject to confirmation with the council",
      "Building-regulations drawings where your project needs them",
      "A clear drawing pack a builder can quote from accurately"
    ],
    "notIncluded": [
      "The building work itself (we are design-only — you appoint a builder)",
      "Structural engineer calculations, where an opening or lintel needs them",
      "Local authority planning and building-control fees, where they apply",
      "Party wall matters, which may apply if you build close to a boundary"
    ],
    "points": [
      {
        "title": "Materials that match the house",
        "body": "Brick, render, tile and joinery chosen to pick up the existing frontage, so the porch reads as part of the home rather than an add-on."
      },
      {
        "title": "Glazed or solid",
        "body": "An open, glazed porch to keep light in the hall, or a more enclosed, solid design for warmth and privacy — we design around how you'll use it."
      },
      {
        "title": "Storage & boot-room porches",
        "body": "A slightly deeper porch can swallow coats, shoes, the dog lead and parcels, keeping the hallway clear and the family organised."
      },
      {
        "title": "A sheltered, welcoming entrance",
        "body": "A proper roof and threshold to keep rain off you and the door, cut draughts and give visitors a clear, welcoming way in."
      }
    ],
    "sections": [
      {
        "heading": "Planning permission",
        "body": [
          "Many small front porches are permitted development, which can mean a full planning application isn't needed — but only if the project stays within the limits. As a general guide, the rules often allow a porch where the external ground-floor area doesn't exceed 3 square metres, no part is higher than 3 metres, and no part sits within 2 metres of a boundary that fronts a highway (such as the pavement or road). These figures are a guide, not a promise, and the exact position of your boundary matters.",
          "Some homes don't have these rights in the same way — flats and maisonettes are treated differently, and properties in conservation areas, or with an Article 4 direction, may have reduced permitted development rights. We advise on the likely route for your specific home and prepare the drawings it needs, always subject to confirmation with Wirral Council (or your local planning authority)."
        ]
      },
      {
        "heading": "Building regulations",
        "body": [
          "Building regulations are separate from planning. Front porches are often exempt from building-regulations approval — typically where the porch is built at ground level, has a floor area under 30 square metres, the existing front door between the house and the porch stays in place, and any glazing meets the safety glazing requirements. Electrical work and heating can bring their own requirements.",
          "Those conditions don't fit every project, so we'll flag where building-regulations drawings are likely to be needed and prepare them if so. The aim is that your builder and building control, where involved, both work from the same clear information."
        ]
      }
    ],
    "sendFirst": [
      "A few photos of your front door and the frontage, straight-on and from an angle",
      "Your postcode and a rough idea of the size of porch you'd like",
      "What you mainly want it to do — kerb appeal, shelter, storage, or all three",
      "Any existing plans or an estate-agent floorplan if you have one"
    ],
    "faqs": [
      {
        "q": "Do I need planning permission for a front porch?",
        "a": "Often a small front porch is permitted development, but not always. It commonly needs to stay within limits — broadly under 3 square metres, no higher than 3 metres, and at least 2 metres from a boundary fronting a highway. Flats, conservation areas and homes with an Article 4 direction can differ. We advise on the likely route and confirm it with your local authority."
      },
      {
        "q": "Will my porch need building regulations approval?",
        "a": "Front porches are often exempt — typically if they're at ground level, under 30 square metres, the existing front door stays in place and any glazing meets safety requirements. Conditions apply, and things like electrics or heating can change that, so we'll flag whether you need building-regulations drawings."
      },
      {
        "q": "Should I go for a glazed or a solid porch?",
        "a": "It depends on what you want from it. A glazed porch keeps more light in the hallway and feels open, while a more solid, enclosed design gives extra warmth, privacy and wall space for storage. We'll design around how you'll actually use the entrance."
      },
      {
        "q": "Can a porch give me extra storage?",
        "a": "Yes — a slightly deeper porch can work like a small boot room for coats, shoes, the dog lead and parcels, keeping the hallway clear. We plan the depth and any built-in storage into the design from the start."
      },
      {
        "q": "Will the porch match the rest of my house?",
        "a": "That's the aim. We pick up the brick, render, roof tiles, proportions and joinery details of your existing frontage so the porch looks like it was always meant to be there rather than added on later."
      },
      {
        "q": "Can a builder price from your drawings?",
        "a": "Yes — a clear drawing pack means a builder can quote accurately from the same information, rather than guessing. We design only and don't carry out the building work, so the advice stays focused on getting your design right."
      }
    ],
    "relatedServices": [
      "house-extensions",
      "planning-drawings-wirral",
      "building-regulations-drawings-wirral"
    ],
    "relatedGuides": [
      "/guides/do-i-need-planning-permission-for-an-extension",
      "/guides/permitted-development-rights-wirral",
      "/guides/what-drawings-do-builders-need"
    ]
  },
  {
    "slug": "bespoke-garden-room-design",
    "title": "Bespoke Garden Room Design",
    "short": "Garden Rooms",
    "category": "design",
    "h1": "Bespoke Garden Room Design in Wirral",
    "metaTitle": "Bespoke Garden Room Design Wirral",
    "metaDescription": "Bespoke garden room, studio and home-office design for Wirral homes — year-round insulated outbuildings designed for work, leisure or a gym, ready to build.",
    "blurb": "Design and drawings for a standalone garden room, studio or home office — a comfortable, year-round space at the bottom of the garden.",
    "intro": "A well-designed garden room gives you a genuine extra space — a quiet home office, a studio, a gym or a garden lounge — without extending the house itself. We prepare the design and the drawings so you have a considered, properly insulated building that works all year round, ready for a builder to price and construct. We design only; we don't carry out the building work, which keeps our advice focused on getting the layout, siting and specification right for how you'll actually use it.",
    "whoFor": [
      "Homeowners wanting a dedicated home office away from the main house",
      "Anyone needing a studio, gym, hobby space or quiet garden retreat",
      "Families short on indoor space but with usable garden to spare",
      "People who want a building designed for year-round use, not a summer shed"
    ],
    "included": [
      "A review of your garden, orientation and how you'd like to use the space",
      "A bespoke design sized and sited around light, access and the plot",
      "Existing and proposed drawings showing the building and its position",
      "Guidance on whether it's likely to be permitted development as an outbuilding",
      "Drawings for a Lawful Development Certificate where that's a sensible step",
      "Building-regulations drawings where your project needs them",
      "A clear pack a builder can quote and build from"
    ],
    "notIncluded": [
      "The building work itself (we are design-only — you appoint a builder)",
      "Structural engineer calculations, where the structure needs them",
      "Local authority planning and building-control fees",
      "Connecting services such as power, water or drainage runs (your contractor's trades)"
    ],
    "points": [
      {
        "title": "Home office vs gym vs garden lounge",
        "body": "We design around the actual use — a quiet, well-lit office needs different glazing, layout and acoustics from a gym or a relaxed garden room."
      },
      {
        "title": "Year-round insulation & glazing",
        "body": "Properly insulated walls, roof and floor plus the right glazing make the difference between a cold summerhouse and a space you'll use in January."
      },
      {
        "title": "Siting for light & outlook",
        "body": "Where the building sits, which way it faces and where the doors and windows go all shape how bright and pleasant it feels through the day."
      },
      {
        "title": "A building that suits the garden",
        "body": "Proportions, materials and roof form chosen so the garden room sits comfortably in your plot rather than dominating it."
      }
    ],
    "sections": [
      {
        "heading": "Planning permission — is a garden room permitted development?",
        "body": [
          "A garden room is usually treated as an outbuilding that's incidental to the house, and many fall within permitted development — which can mean a full planning application isn't needed. The limits are specific, though: it should be single storey, with a maximum eaves height of around 2.5m and an overall height of up to 4m for a dual-pitched roof, 3m for other roofs, or 2.5m where it sits within 2m of a boundary. It also shouldn't sit forward of the principal elevation, and outbuildings together shouldn't cover more than half the land around the original house. These are general limits and may not all apply to your property.",
          "Designated land — conservation areas, and similar — has tighter rules, and flats and some properties don't have the same rights at all. Importantly, a garden room used for sleeping, or as primary or self-contained living accommodation, is not 'incidental' and would need planning permission. We advise on the likely route for your specific garden and prepare the drawings it needs — always subject to confirmation with Wirral Council (or your local planning authority)."
        ]
      },
      {
        "heading": "Building regulations — when they apply",
        "body": [
          "Building regulations are separate from planning. A small, detached, single-storey garden room often falls outside them — many are exempt below around 15 square metres of floor area, and up to about 30 square metres can sometimes avoid full approval depending on proximity to boundaries and the materials used. Above those thresholds, or where the building contains sleeping accommodation, the regulations are more likely to apply.",
          "Any garden room intended for habitable or self-contained living use will need building-regulations approval covering structure, insulation, fire safety, drainage and ventilation. Where your project needs them, we prepare the technical drawings, and a structural engineer provides any supporting calculations. We'll give you an honest steer on which side of these thresholds your project is likely to fall — confirmed with building control."
        ]
      }
    ],
    "sendFirst": [
      "A few photos of the garden and where you picture the room",
      "Your postcode and a rough idea of the size you have in mind",
      "What you'd use it for — office, gym, studio, garden lounge",
      "Whether you'd want it heated and used all year round"
    ],
    "faqs": [
      {
        "q": "Do I need planning permission for a garden room?",
        "a": "Often a garden room is permitted development as an outbuilding incidental to the house, provided it stays within the height, position and coverage limits — but that depends on your property and isn't guaranteed. We advise on the likely route and prepare the drawings, always confirmed with your local planning authority."
      },
      {
        "q": "Can I sleep in it or use it as an annexe?",
        "a": "Not under permitted development. A garden room used for sleeping, or as primary or self-contained living accommodation, isn't 'incidental' to the house, so it would need planning permission and building-regulations approval. We can advise on what that route involves."
      },
      {
        "q": "Does a garden room need building regulations?",
        "a": "Often a small, single-storey garden room is exempt — many are below the floor-area thresholds where the regulations bite. Larger buildings, those close to a boundary, or any with habitable or sleeping use are more likely to need approval. We'll give you an honest view, confirmed with building control."
      },
      {
        "q": "Can you design it for year-round use?",
        "a": "Yes — that's usually the point. We design with proper insulation, glazing and heating in mind so the room is comfortable in winter as well as summer, not just a fair-weather space."
      },
      {
        "q": "Where's the best place to put it in my garden?",
        "a": "It depends on orientation, light, access and how you'll use the space. We look at all of that when siting the building — a home office and a garden lounge often want quite different positions and outlooks."
      },
      {
        "q": "Can builders quote from your drawings?",
        "a": "Yes — a clear drawing pack lets builders price the same scheme accurately rather than guessing, and gives you a fair comparison between quotes."
      }
    ],
    "relatedServices": [
      "residential-design",
      "concept-design-feasibility",
      "building-regulations-drawings-wirral"
    ],
    "relatedGuides": [
      "/guides/permitted-development-rights-wirral",
      "/guides/do-i-need-building-regulations-approval",
      "/guides/do-i-need-planning-permission-for-an-extension"
    ]
  },
  {
    "slug": "change-of-use-applications",
    "title": "Change of Use Applications",
    "short": "Change of Use",
    "category": "planning",
    "h1": "Change of Use Planning Support & Drawings in Wirral",
    "metaTitle": "Change of Use Applications Wirral",
    "metaDescription": "Change of use drawings and planning support for Wirral — annexes, garage-to-room, commercial-to-residential and self-contained units. Hedged, plain-English help.",
    "blurb": "Supporting drawings and planning statements to change how a property or space is used — annexes, commercial-to-residential, outbuildings and self-contained units.",
    "intro": "Changing the way a building or part of a building is used — its planning \"use class\" — can need permission in its own right, even when you aren't building much. We prepare the supporting drawings and the planning statement, and liaise on your behalf, so you can put a clear, honest case to Wirral Council (or your local planning authority). We're design-only: we don't carry out building work, and whether any particular change needs permission depends entirely on the property, the local plan and how the use is actually changing — so everything here is a starting point to confirm with the council, not a promise of approval.",
    "whoFor": [
      "Homeowners wanting an annexe or ancillary accommodation for family",
      "Owners turning a garage, outbuilding or store into habitable space",
      "People converting a commercial unit, shop or office to residential",
      "Anyone creating a self-contained flat or separate unit within a property",
      "Landlords weighing up HMO use and what consent it may involve"
    ],
    "included": [
      "A plain-English view on whether your change is likely to need permission",
      "Existing and proposed drawings showing the change of use clearly",
      "A planning statement setting out the proposal and its context",
      "Liaison with the planning authority through the application",
      "Pointers on the building-regulations work that usually follows"
    ],
    "notIncluded": [
      "The building work itself (we are design-only — you appoint a builder)",
      "Structural engineer calculations where openings or loadings change",
      "Local authority planning and building-control fees",
      "Specialist reports the council may request (e.g. acoustic, contamination, transport)",
      "Party wall matters, which may need a party wall surveyor"
    ],
    "points": [
      {
        "title": "Annexe & multigenerational living",
        "body": "Drawings and a planning case for an annexe or ancillary accommodation — for a relative, an older child or live-in care — where the use stays tied to the main home."
      },
      {
        "title": "Commercial to residential",
        "body": "Support for turning a shop, office or other commercial space into a home or homes, via a full application or a prior-approval route where one applies."
      },
      {
        "title": "Garage or outbuilding to a room",
        "body": "Where an outbuilding or garage becomes habitable space, the change of use may matter as much as the building work. See our garage conversion service for the technical side."
      },
      {
        "title": "Self-contained units & HMO considerations",
        "body": "Creating a separate flat or shared house often counts as a material change of use — we help you understand the likely position before you commit."
      }
    ],
    "sections": [
      {
        "heading": "Use classes and when permission is needed",
        "body": [
          "Most homes sit in use class C3 (a dwellinghouse), while shops, offices, cafés and the like fall into other classes. Planning is concerned with a 'material change of use' — a meaningful change in how a building or part of it is used — and that, rather than the amount of building work, is often what triggers the need for permission.",
          "Some changes stay within the same use and need nothing; some are genuinely permitted; and some need a full planning application. An annexe that's clearly ancillary to your home is treated differently from a fully self-contained, independent unit, for example. Whether a particular change is 'material' depends on the property, the scale and the local plan — so we treat every case on its own facts and confirm the route with the council."
        ]
      },
      {
        "heading": "Prior approval routes and building regulations",
        "body": [
          "For certain changes — some commercial-to-residential conversions among them — there are prior-approval routes that can be quicker than a full application, where the change qualifies. These routes carry their own conditions and limits, and they don't apply to every building or every area, so they need checking carefully against your property and current rules before you rely on them.",
          "Building regulations are separate from planning and usually follow a change of use. Bringing a space up to residential standards — insulation, fire safety, ventilation, drainage, sound and means of escape — typically needs building-control approval, and creating a new dwelling can raise the bar further. We prepare the supporting drawings and flag where this work will be needed; outcomes always depend on your local planning authority and building control."
        ]
      }
    ],
    "sendFirst": [
      "Your postcode and a clear description of the current use and the use you want",
      "Photos of the property or space, inside and out",
      "Whether it's a flat, listed, in a conservation area or has an Article 4 direction, if you know",
      "Any existing drawings, floorplans or planning history you hold",
      "A sense of whether the new space will be tied to the main home or fully independent"
    ],
    "faqs": [
      {
        "q": "Do I always need planning permission for a change of use?",
        "a": "Not always — it depends on whether the change is 'material' and on the property and local plan. Some changes need nothing, some are permitted, and some need a full application. We advise on the likely position and confirm it with the council; we can't guarantee an outcome."
      },
      {
        "q": "Is an annexe for a relative treated as a change of use?",
        "a": "It depends on how it's used. An annexe that stays clearly ancillary to your main home is often viewed differently from a fully self-contained, independent dwelling. We help you understand the likely position before you commit — subject to confirmation with your local planning authority."
      },
      {
        "q": "Can a shop or office be converted to a home?",
        "a": "Often, yes — sometimes through a full application and sometimes via a prior-approval route where the change qualifies. The route depends on the building, its location and current rules, so it needs checking carefully with the council rather than assuming."
      },
      {
        "q": "Will building regulations apply as well?",
        "a": "Usually. A change of use to residential typically needs building-control approval covering things like fire safety, insulation, ventilation and escape. Planning and building regulations are separate consents, and most change-of-use projects need both."
      },
      {
        "q": "Do you handle HMO use?",
        "a": "We can help with the design and drawings and flag the likely planning position, as creating a shared house can be a material change of use. Licensing and HMO standards are a separate matter handled by the council, and the requirements vary — so it's worth confirming early."
      },
      {
        "q": "Do you do the building work too?",
        "a": "No — we're design-only. We prepare the supporting drawings and planning statement and liaise with the council. Trusted, certified contractor partners price and build from the drawings, with a structural engineer covering any calculations needed."
      }
    ],
    "relatedServices": [
      "garage-conversion-drawings-wirral",
      "planning-drawings-wirral",
      "residential-design"
    ],
    "relatedGuides": [
      "/guides/do-i-need-planning-permission-for-an-extension",
      "/guides/do-i-need-building-regulations-approval",
      "/guides/what-drawings-do-builders-need"
    ]
  },
  {
    "slug": "measured-building-surveys",
    "title": "Measured Building Surveys & Existing Drawings",
    "short": "Measured Surveys",
    "category": "design",
    "h1": "Measured Building Surveys & Existing Drawings in Wirral",
    "metaTitle": "Measured Building Surveys Wirral",
    "metaDescription": "Accurate measured building surveys and scaled \"existing\" plans and elevations for Wirral homes — the reliable basis for any extension, planning or building-regs design.",
    "blurb": "An accurate measured survey of your home and a set of scaled \"existing\" drawings — the dependable starting point for any extension, conversion or planning design.",
    "intro": "Every good design starts with knowing exactly what's already there. We carry out a measured survey of your property and turn it into a set of accurate, scaled \"existing\" drawings — plans and elevations — that everything else is built on. Getting this right first avoids costly mistakes later and lets builders price from real measurements rather than guesswork. We're design-only: we prepare the survey and drawings, and the building work is carried out by your chosen contractor.",
    "whoFor": [
      "Homeowners planning an extension, loft or conversion who need accurate base drawings",
      "Anyone whose only floorplan is an estate-agent sketch that isn't to scale",
      "Owners of older Wirral homes where walls are rarely straight or square",
      "People who want a reliable starting point before committing to a design",
      "Builders or owners who've found existing drawings don't match the real building"
    ],
    "included": [
      "A site visit to measure the relevant rooms, openings and external faces",
      "Room dimensions, wall thicknesses, window and door positions and ceiling heights",
      "Key features such as chimney breasts, stairs, services and changes in level",
      "Scaled existing floor plans of the areas your project affects",
      "Existing elevations showing the outside of the property as it stands",
      "A tidy drawing pack supplied as PDF, with DWG/CAD available where needed"
    ],
    "notIncluded": [
      "A structural, condition or RICS-style survey — this is a measured (dimensional) survey, not a survey of structural soundness, defects or valuation",
      "Structural engineer calculations, where a beam or opening needs them",
      "Drains, services tracing or below-ground investigation",
      "Topographical or full land surveys for larger or sloping sites (these can be arranged separately)",
      "The concept, planning or building-regs design — the survey is the first step before that work"
    ],
    "points": [
      {
        "title": "Accurate existing plans & elevations",
        "body": "Measured on site and drawn to scale, so your starting drawings reflect the real building rather than an approximate sketch."
      },
      {
        "title": "The basis for your proposed design",
        "body": "Concept, planning and building-regulations drawings all build on these existing drawings, so a clean, accurate base saves time and rework later."
      },
      {
        "title": "Lets builders price correctly",
        "body": "Real dimensions mean contractors can quote against what's actually there, reducing surprises and mid-project cost changes."
      },
      {
        "title": "Captures the detail that matters",
        "body": "Openings, levels, wall positions and key features are recorded properly, so awkward older homes are designed around reality, not assumptions."
      }
    ],
    "sections": [
      {
        "heading": "What a measured survey captures",
        "body": [
          "A measured survey records the property as it physically exists. On site we take room-by-room dimensions, wall thicknesses, the position and size of windows and doors, ceiling and floor-to-floor heights, and changes in level between rooms or across a sloping plot.",
          "We also note the features that shape a design — chimney breasts, staircases, structural openings, visible services and anything that affects how a new layout can work. For external work we measure the relevant faces of the building so the elevations are accurate.",
          "The aim is simple: capture enough, accurately enough, that nobody designing or pricing from the drawings later has to guess."
        ]
      },
      {
        "heading": "The deliverable: your existing drawings",
        "body": [
          "We turn the survey into a clean set of scaled drawings of how the property is now — existing floor plans of the areas your project affects, plus existing elevations of the outside.",
          "These are normally supplied as PDFs you can share easily, and as DWG/CAD files where a structural engineer or other party needs to work in the same drawings.",
          "This pack becomes the shared reference point for everyone involved, so your design, your builder's quote and any approvals all start from the same accurate information."
        ]
      },
      {
        "heading": "Why it's the sensible first step",
        "body": [
          "It's tempting to skip straight to ideas, but a design drawn on inaccurate base information is risky — a wall that's 200mm off can change whether a layout fits, what a beam needs to span, or how an extension meets the existing roof.",
          "Accurate existing drawings remove that risk early. They let us develop a proposed design with confidence, help builders price against reality, and give planning and building-control submissions a credible, consistent foundation.",
          "For most projects we'd recommend starting here, then moving into concept and design once the base drawings are in place."
        ]
      }
    ],
    "sendFirst": [
      "Your full address and postcode so we can plan the visit",
      "A rough idea of what you're hoping to do (extend, convert, reconfigure)",
      "Any existing plans or an estate-agent floorplan, even if you think they're inaccurate",
      "Which parts of the home the project will affect, so we measure the right areas",
      "A few photos inside and out if you have them"
    ],
    "faqs": [
      {
        "q": "Is this the same as a structural or homebuyer's survey?",
        "a": "No. A measured survey records the building's dimensions to produce accurate drawings — it isn't a structural, condition or RICS-style survey and doesn't assess defects, soundness or value. Those are separate surveys carried out by other professionals."
      },
      {
        "q": "Why can't you just design from my estate-agent floorplan?",
        "a": "Marketing floorplans are usually approximate and rarely to scale, especially in older homes where walls aren't straight or square. Designing from inaccurate base information can lead to costly errors, so accurate measured drawings are a much safer starting point."
      },
      {
        "q": "Do you measure the whole house or just part of it?",
        "a": "Usually just the areas your project affects, plus anything that connects to them — but it depends on the scheme. For a rear extension we'd typically survey the ground floor and the relevant elevations; we'll confirm the scope with you beforehand."
      },
      {
        "q": "What format do I get the drawings in?",
        "a": "Existing plans and elevations are normally supplied as PDFs you can share easily with builders, and as DWG/CAD files where a structural engineer or other party needs to work in the same drawings."
      },
      {
        "q": "Do I need a measured survey before applying for planning?",
        "a": "It's strongly recommended. Planning and building-control submissions need accurate existing drawings to sit alongside the proposed ones, so a measured survey is usually the sensible first step before any application — though requirements can vary, so we'll advise for your project."
      },
      {
        "q": "What happens after the survey?",
        "a": "Once the existing drawings are ready, they become the basis for your concept, planning and building-regulations design. Many clients move straight into the design stage from here, working from accurate base drawings."
      }
    ],
    "relatedServices": [
      "concept-design-feasibility",
      "house-extensions",
      "planning-drawings-wirral"
    ],
    "relatedGuides": [
      "/guides/what-drawings-do-builders-need",
      "/guides/how-to-brief-architectural-designer-extension",
      "/guides/do-i-need-planning-permission-for-an-extension"
    ]
  },
  {
    "slug": "concept-design-feasibility",
    "title": "Concept Design & Feasibility Studies",
    "short": "Concept & Feasibility",
    "category": "design",
    "h1": "Concept Design & Feasibility Studies in Wirral",
    "metaTitle": "Concept Design & Feasibility Studies Wirral",
    "metaDescription": "Early concept design and feasibility advice for Wirral homeowners — explore options, test what fits your plot and budget, and see the likely planning route before you commit.",
    "blurb": "Before you spend on a full set of drawings, it pays to know what's actually possible. We sketch the options, weigh up the likely planning route, and give you an honest steer on what fits your home, your plot and your budget.",
    "intro": "It's easy to fall in love with an idea before knowing whether it will work on your plot, win approval, or sit within your budget. A concept and feasibility stage answers those questions early. We explore a few design options, sketch how they could look and work, and give you a clear, honest view of the likely planning route and any constraints — so you can decide with confidence. We design only; we don't carry out the building work, which keeps our advice focused and impartial. Think of it as a low-cost way to test the idea before committing to a full project.",
    "whoFor": [
      "Homeowners weighing up an extension, loft or remodel but unsure what's realistically possible",
      "Growing families deciding between options — extend, convert the loft, or reconfigure what's there",
      "Anyone who wants an honest read on planning likelihood before spending on full drawings",
      "Buyers assessing a property's potential before they commit",
      "People with a tricky plot, a conservation area, or possible Article 4 / permitted development questions"
    ],
    "included": [
      "A short briefing chat to understand how you want the home to work and your rough budget",
      "Initial concept sketches showing one or more design options",
      "Feasibility view on planning likelihood and the probable route (full application or permitted development)",
      "A plain-English note on key constraints — site limits, conservation area, Article 4, overlooking, access",
      "A clear recommendation on the preferred direction and sensible next steps",
      "Budget-aware guidance so options are grounded in reality, not wishful thinking"
    ],
    "notIncluded": [
      "The building work itself (we are design-only — you appoint a builder)",
      "Full planning or building-regulations drawings (these follow once you choose a direction)",
      "Structural engineer calculations where needed",
      "Local authority planning or building-control fees",
      "A formal measured survey (a feasibility study uses indicative sizes unless a survey is commissioned)",
      "Any guarantee of planning approval — likelihood is always subject to your local planning authority"
    ],
    "points": [
      {
        "title": "Explore the options properly",
        "body": "Rather than locking onto the first idea, we put two or three concepts on the table — different layouts, footprints or approaches — so you can see and compare what each would give you before choosing a direction."
      },
      {
        "title": "Test what fits the plot and budget",
        "body": "We sanity-check ideas against your site, its constraints and a realistic budget. That keeps the conversation honest and stops you designing something that won't fit, won't get approved, or won't add up financially."
      },
      {
        "title": "Avoid wasted spend",
        "body": "Finding out early that a scheme is unlikely to gain approval — or won't deliver what you hoped — saves far more than the feasibility stage costs. It de-risks the decision before the bigger fees and the builder's quotes come into play."
      },
      {
        "title": "A clear path into the full project",
        "body": "You finish with a recommended option and a likely planning route, ready to move smoothly into full design and the drawings your builder will price and build from — no false starts."
      }
    ],
    "sections": [
      {
        "heading": "How a feasibility study works",
        "body": [
          "We start with a short conversation about what's frustrating you about the current home, how you'd like it to work, and roughly what you'd like to spend. The more honest the brief, the more useful the outcome.",
          "From there we produce initial concept sketches — usually a couple of options — so you can picture the possibilities rather than imagine them. These are deliberately loose and quick; the aim is to explore and compare, not to finalise every detail.",
          "Alongside the sketches we give you a plain-English feasibility note: how likely each option is to gain approval, the probable planning route, and any constraints we can see. You come away with a recommended direction and a clear sense of the next steps."
        ]
      },
      {
        "heading": "Planning likelihood and constraints",
        "body": [
          "Part of the value of this stage is flagging the things that affect what's possible. Depending on your property and location, that may include permitted development limits, conservation area status, Article 4 directions that remove some PD rights, or site-specific issues like boundaries, access, trees and overlooking.",
          "We'll give you an honest, hedged view of how each option is likely to be treated — but planning outcomes are never guaranteed and depend on the assessment of your local planning authority. Where a point is genuinely uncertain, we'll say so and suggest confirming it with Wirral Council (or your local authority) before you commit. The point of feasibility is to surface these questions early, while they're cheap to answer."
        ]
      }
    ],
    "sendFirst": [
      "Your address or postcode (so we can check the property and its planning context)",
      "A rough idea of what you'd like to achieve — more space, a better layout, a specific room",
      "Any photos of the property, inside and out, that help us understand it",
      "A ballpark budget, even a broad range — it keeps the options realistic",
      "Anything you already know about the site — conservation area, previous applications, restrictions"
    ],
    "faqs": [
      {
        "q": "What's the difference between concept design and a full design?",
        "a": "Concept design is the early, exploratory stage — quick sketches and options to test what's possible and which direction is best. A full design develops the chosen option into the detailed planning and building-regulations drawings your builder needs to price and build. Feasibility comes first and feeds straight into it."
      },
      {
        "q": "Do I really need a feasibility study, or can I go straight to drawings?",
        "a": "If you're already confident about the design and the route, you can go straight to a full design. But where there's real uncertainty — about what fits, what's likely to be approved, or whether the budget stacks up — a feasibility stage often saves money overall by avoiding a false start. It's most useful when the answer isn't obvious."
      },
      {
        "q": "Will this tell me whether I'll get planning permission?",
        "a": "It gives you an honest, informed view of how likely each option is and the probable route, but it can't guarantee an outcome — that always rests with your local planning authority. Where something is genuinely uncertain we'll flag it and may suggest confirming it with Wirral Council before you commit further."
      },
      {
        "q": "Does a feasibility study include a measured survey of my house?",
        "a": "Not by default. Concept work usually uses indicative sizes and the information available so we can explore options quickly and affordably. A formal measured survey comes later, once you've chosen a direction and want accurate drawings — though we can arrange one earlier if your project needs it."
      },
      {
        "q": "How does budget come into it?",
        "a": "We keep options grounded in a realistic budget so you're not falling for something that won't add up. We don't carry out or price the building work ourselves — that's done by your builder from the final drawings — but we'll give budget-aware guidance so the concepts you're choosing between are sensible from the outset."
      },
      {
        "q": "What do I actually get at the end?",
        "a": "You get concept sketches of the option or options, a plain-English feasibility note on planning likelihood and constraints, and a clear recommendation on the best direction and likely route. From there it's a smooth step into the full design and drawings."
      }
    ],
    "relatedServices": [
      "residential-design",
      "house-extensions",
      "planning-drawings-wirral"
    ],
    "relatedGuides": [
      "/guides/do-i-need-planning-permission-for-an-extension",
      "/guides/permitted-development-rights-wirral",
      "/guides/how-to-brief-architectural-designer-extension"
    ]
  },
];

export function getService(slug: string): Service | undefined {
  return services.find((s) => s.slug === slug);
}

/** Services grouped by category for the hub page. */
export const serviceCategories: { key: Service["category"]; label: string; blurb: string }[] = [
  {
    key: "design",
    label: "Design services",
    blurb: "Shaping your project and the spaces themselves.",
  },
  {
    key: "planning",
    label: "Planning & approval",
    blurb: "Drawings and support for planning and building control.",
  },
];
