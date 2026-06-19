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
      "conservation-area-design-wirral",
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
    title: "Bespoke Residential Design",
    short: "Residential Design",
    category: "design",
    h1: "Bespoke Residential Design in Wirral",
    metaTitle: "Bespoke Residential Design Wirral",
    metaDescription:
      "Bespoke residential design, concept layouts and space planning for Wirral homeowners looking to improve, extend or reconfigure their homes.",
    blurb:
      "Concept design, space planning and architectural drawings for homeowners who want their project shaped properly before committing.",
    intro:
      "Bespoke residential design is for homeowners who want to get the thinking right first. We help you explore what's possible, plan the space, weigh up options and turn a vague idea into a clear, considered design you can take forward with confidence — whether that's an extension, a reconfiguration, or making an awkward house finally work.",
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
  {
    slug: "planning-building-regulations",
    title: "Planning & Building Regulations",
    short: "Planning & Building Regs",
    category: "planning",
    h1: "Planning Drawings & Building Regulations Drawings in Wirral",
    metaTitle: "Planning & Building Regulations Drawings Wirral",
    metaDescription:
      "Planning drawings, building-regulations drawings and submission support for extensions, loft conversions and home alterations across Wirral.",
    blurb:
      "Planning drawings, building-regulations drawings and submission support so your project moves forward smoothly.",
    intro:
      "The drawings and paperwork behind a home project can feel daunting. This is our hub for the two different things people often confuse — planning permission and building regulations. We prepare clear drawings for both, explain which your project needs, and support the submission so the process is far less stressful.",
    whoFor: [
      "Homeowners unsure whether they need planning, building regs, or both",
      "Anyone whose builder or building control has asked for drawings",
      "People who want the application process explained in plain English",
    ],
    included: [
      "An honest view on what your specific project is likely to need",
      "Planning drawings (existing and proposed plans, elevations, site plan)",
      "Building-regulations drawings and technical details",
      "Practical support through the submission process",
    ],
    notIncluded: [
      "The building work itself (design only)",
      "Structural engineer calculations where required",
      "Local authority planning and building-control fees",
      "Specialist reports (e.g. drainage, ecology) where a council requests them",
    ],
    points: [
      {
        title: "Planning drawings",
        body: "Accurate existing and proposed drawings prepared to support a householder planning application.",
      },
      {
        title: "Building-regulations drawings",
        body: "Technical drawings prepared for building-control approval where your project needs it.",
      },
      {
        title: "Submission support",
        body: "Practical guidance through the application process so you know what happens and when.",
      },
      {
        title: "Plain-English guidance",
        body: "Clear answers about what your specific project is likely to need — and what it doesn't.",
      },
    ],
    sections: [
      {
        heading: "Planning permission vs building regulations — the difference",
        body: [
          "Planning permission is about whether you can build — the size, appearance and impact on neighbours and the area. Building regulations are about how it's built — structure, fire safety, insulation, drainage and more.",
          "Many projects need one, both, or neither. A loft conversion might be permitted development for planning but still need building-regulations approval; a small internal change might need neither. We help you work out which applies.",
        ],
      },
      {
        heading: "Full plans vs building notice, and lawful development certificates",
        body: [
          "For building control there are two routes: a full plans application (drawings approved before work starts) or a building notice (less paperwork, more risk if something needs changing on site). We usually recommend full plans for extensions and loft conversions.",
          "Where a project is permitted development, a Lawful Development Certificate gives formal confirmation — useful for peace of mind and future sale.",
        ],
      },
    ],
    sendFirst: [
      "Your postcode and a description of the project",
      "Photos of the property and the area affected",
      "Any letters from the council or your builder asking for drawings",
    ],
    faqs: [
      {
        q: "Do I need planning permission or building regulations?",
        a: "Many projects need one, both or neither depending on scale and location. We advise on the likely route for your project and prepare the drawings it needs — confirmed with the relevant authority.",
      },
      {
        q: "Can you submit the application for me?",
        a: "We prepare the drawings and support the submission. The application itself sits with you as the homeowner (or your builder), and we guide you through it.",
      },
      {
        q: "What drawings are included?",
        a: "For planning: existing and proposed plans, elevations and a site/location plan. For building regs: technical sections, construction details and specifications.",
      },
      {
        q: "How long does it usually take?",
        a: "Householder planning decisions in England typically target around eight weeks once validated, though it varies. We'll give you a realistic picture for your project — see our guide on planning timescales.",
      },
      {
        q: "What happens if the council asks for changes?",
        a: "It's common for minor amendments to be requested. We help you respond and adjust the drawings as needed.",
      },
      {
        q: "Do I need a structural engineer?",
        a: "Often, where there are new beams or openings. The engineer's calculations sit alongside our building-regulations drawings.",
      },
    ],
    relatedServices: [
      "planning-drawings-wirral",
      "building-regulations-drawings-wirral",
      "lawful-development-certificate-wirral",
    ],
    relatedGuides: [
      "/guides/planning-drawings-vs-building-regulations-drawings",
      "/guides/how-long-does-planning-permission-take-wirral",
    ],
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
      "permitted-development-wirral",
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
    slug: "permitted-development-wirral",
    title: "Permitted Development Advice",
    short: "Permitted Development",
    category: "planning",
    h1: "Permitted Development Advice for Wirral Homeowners",
    metaTitle: "Permitted Development Advice Wirral",
    metaDescription:
      "Plain-English permitted development guidance and drawings for Wirral homeowners planning extensions, loft conversions and alterations.",
    blurb:
      "Plain-English help working out whether your project is likely to be permitted development — and the drawings to prove it.",
    intro:
      "Permitted development rights let you carry out certain works without a full planning application, within strict limits. Whether your project qualifies depends on its size, position and your property. We help you understand the likely position and, where it's sensible, prepare drawings for a Lawful Development Certificate so you have formal confirmation.",
    whoFor: [
      "Homeowners hoping to avoid a full planning application",
      "Anyone unsure whether their extension or loft is 'permitted development'",
      "People who want certainty before they build or sell",
    ],
    included: [
      "A plain-English view on whether your project is likely to qualify",
      "Guidance on the limits and conditions that apply",
      "Drawings for a Lawful Development Certificate where useful",
    ],
    notIncluded: [
      "A guarantee — only the council can formally confirm the position",
      "Building-regulations approval, which is still needed separately",
      "Application and certificate fees",
    ],
    points: [
      {
        title: "Is it permitted development?",
        body: "We help you understand whether your project is likely to fall within the limits.",
      },
      {
        title: "Limits & conditions",
        body: "Size, height, position and materials all matter — and the rules differ for the side, rear and front.",
      },
      {
        title: "Restricted properties",
        body: "Flats, maisonettes, listed buildings, conservation areas and Article 4 areas often have reduced or no rights.",
      },
      {
        title: "Lawful Development Certificate",
        body: "Where useful, formal confirmation that your works are permitted development.",
      },
    ],
    sections: [
      {
        heading: "Why a Lawful Development Certificate can be sensible",
        body: [
          "Permitted development isn't a single yes/no — it's a set of detailed limits, and 'I think it's permitted development' isn't proof. A Lawful Development Certificate is a formal council decision confirming the works are lawful.",
          "That certainty is valuable when you sell or remortgage, and it protects you if the interpretation is ever questioned. We prepare the drawings a certificate application needs.",
        ],
      },
    ],
    sendFirst: [
      "Your postcode and a description of the project",
      "Photos showing the property and surroundings",
      "Whether the home is a flat, listed, or in a conservation area, if you know",
    ],
    faqs: [
      {
        q: "Can you guarantee my project is permitted development?",
        a: "No one can guarantee it except the council. We advise on the likely position and can prepare drawings for a Lawful Development Certificate, which gives formal confirmation.",
      },
      {
        q: "Does permitted development mean I can skip building regs?",
        a: "No — building regulations are separate and still apply to most building work.",
      },
      {
        q: "What removes permitted development rights?",
        a: "Being a flat or maisonette, a listed building, in a conservation area, or having an Article 4 direction can all reduce or remove rights. Always confirm with your local authority.",
      },
    ],
    relatedServices: ["lawful-development-certificate-wirral", "house-extensions", "planning-drawings-wirral"],
    relatedGuides: [
      "/guides/permitted-development-rights-wirral",
      "/guides/lawful-development-certificate-explained",
    ],
  },
  {
    slug: "lawful-development-certificate-wirral",
    title: "Lawful Development Certificate Drawings",
    short: "Lawful Development Certificates",
    category: "planning",
    h1: "Lawful Development Certificate Drawings in Wirral",
    metaTitle: "Lawful Development Certificate Drawings Wirral",
    metaDescription:
      "Lawful development certificate drawings and guidance for Wirral homeowners who want formal confirmation their project is permitted development.",
    blurb:
      "Drawings and guidance for a Lawful Development Certificate — formal confirmation that your works are permitted development.",
    intro:
      "A Lawful Development Certificate (LDC) is a formal decision from the council confirming that a project is lawful — usually because it's permitted development. It's not the same as planning permission; it's proof that you don't need it. Many Wirral homeowners use one for peace of mind and to make a future sale or remortgage straightforward.",
    whoFor: [
      "Homeowners relying on permitted development who want certainty",
      "Anyone planning to sell or remortgage after building work",
      "People who want a formal record that works were lawful",
    ],
    included: [
      "Drawings showing the existing and proposed works",
      "Guidance on the evidence and information an LDC application needs",
      "Support through the submission",
    ],
    notIncluded: [
      "Planning permission (an LDC confirms you don't need it)",
      "Building-regulations approval (separate and still required)",
      "Council fees",
    ],
    points: [
      {
        title: "What an LDC is",
        body: "A formal council decision confirming a project is lawful and doesn't need planning permission.",
      },
      {
        title: "Why homeowners use one",
        body: "Certainty now, and a clean answer for buyers and lenders later.",
      },
      {
        title: "Evidence & drawings",
        body: "We prepare the drawings; some applications also rely on supporting evidence.",
      },
      {
        title: "Not the same as permission",
        body: "An LDC proves permission isn't needed — it isn't a planning approval.",
      },
    ],
    sendFirst: [
      "Your postcode and a description of the works (proposed or already done)",
      "Photos of the property",
      "Any existing drawings or documents you hold",
    ],
    faqs: [
      {
        q: "What is a Lawful Development Certificate?",
        a: "A formal council decision confirming that a project is lawful — usually because it's permitted development — so you don't need planning permission for it.",
      },
      {
        q: "Why would I want one?",
        a: "For certainty, and because buyers' and lenders' solicitors often ask for proof that works were lawful when you sell or remortgage.",
      },
      {
        q: "Is it the same as planning permission?",
        a: "No. Planning permission grants the right to build something that needs it; an LDC confirms your works don't need permission in the first place.",
      },
    ],
    relatedServices: ["permitted-development-wirral", "house-extensions", "planning-drawings-wirral"],
    relatedGuides: ["/guides/lawful-development-certificate-explained", "/guides/permitted-development-rights-wirral"],
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
    relatedServices: ["building-regulations-drawings-wirral", "house-extensions", "permitted-development-wirral"],
    relatedGuides: [
      "/guides/garage-conversion-planning-building-regulations-wirral",
      "/guides/do-i-need-building-regulations-approval",
      "/guides/permitted-development-rights-wirral",
    ],
  },
  {
    slug: "conservation-area-design-wirral",
    title: "Conservation Area Extension Design",
    short: "Conservation Area Design",
    category: "design",
    h1: "Conservation Area Extension Design in Wirral",
    metaTitle: "Conservation Area Extension Design Wirral",
    metaDescription:
      "Sensitive architectural design and planning drawings for Wirral homes in conservation areas and characterful settings, prepared with local context in mind.",
    blurb:
      "Sensitive, well-justified design and drawings for extensions and alterations to homes in Wirral conservation areas.",
    intro:
      "Extending a home in a conservation area calls for a careful, sensitive approach — to materials, proportions and how the proposal sits within its surroundings. Wirral has several designated conservation areas, and homes within them usually have reduced permitted development rights. We design with that context in mind and prepare the well-justified drawings these applications need.",
    whoFor: [
      "Homeowners in or near a Wirral conservation area",
      "Owners of characterful or period properties",
      "Anyone whose project needs a particularly sensitive design approach",
    ],
    included: [
      "A design that respects materials, proportion and local character",
      "Planning drawings prepared with conservation context in mind",
      "Supporting justification where the application calls for it",
    ],
    notIncluded: [
      "A guarantee of approval — conservation applications are assessed on merit",
      "Listed building consent work (a specialist area; ask if relevant)",
      "Council fees and any specialist heritage reports requested",
    ],
    points: [
      {
        title: "Sensitive design",
        body: "Proposals shaped to sit comfortably within their setting rather than fight it.",
      },
      {
        title: "Materials & proportions",
        body: "Choices that respect the character of the street and the original home.",
      },
      {
        title: "Reduced permitted development",
        body: "Conservation areas usually restrict permitted development — more often needs a full application.",
      },
      {
        title: "Well-justified drawings",
        body: "Clear drawings and justification to support a sensitive application.",
      },
    ],
    sections: [
      {
        heading: "Wirral conservation areas — a careful, local approach",
        body: [
          "Wirral has a number of designated conservation areas — Port Sunlight and parts of Oxton are well-known examples — where the council pays particular attention to design quality and materials. Whether a specific street is designated, and exactly what restrictions apply, must be confirmed with Wirral Council for your address.",
          "Our role is to design sympathetically and present the proposal well. We never promise approval — conservation applications are judged on their merits — but a sensitive, well-justified design gives a project its best chance.",
        ],
      },
    ],
    sendFirst: [
      "Your postcode (so the conservation context can be checked with the council)",
      "Photos of the house and neighbouring properties",
      "What you'd like to achieve",
    ],
    faqs: [
      {
        q: "Can I extend a house in a conservation area?",
        a: "Often yes, but the design needs to be sensitive and a full planning application is more likely, as permitted development rights are usually reduced. We design with that in mind.",
      },
      {
        q: "Will my conservation-area application be approved?",
        a: "We can't promise approval — these applications are assessed on merit. A sensitive, well-justified design gives the best chance, and we present it carefully.",
      },
      {
        q: "How do I know if my home is in a conservation area?",
        a: "Wirral Council holds the designations. Send us your postcode and we can help you check, but the council's record is the definitive source.",
      },
    ],
    relatedServices: ["house-extensions", "planning-drawings-wirral", "residential-design"],
    relatedGuides: [
      "/guides/check-wirral-conservation-area-map",
      "/guides/conservation-area-extensions-wirral",
      "/guides/do-i-need-planning-permission-for-an-extension",
    ],
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
