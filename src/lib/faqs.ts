/** Site-wide FAQ content (architectural design, design-only). Categorised. */

export type FaqCategory =
  | "starting"
  | "planning"
  | "permitted-development"
  | "building-regs"
  | "drawings"
  | "costs"
  | "conservation"
  | "visualiser"
  | "areas"
  | "scope";

export type Faq = { q: string; a: string; category: FaqCategory };

export const generalFaqs: Faq[] = [
  /* Starting a project */
  {
    category: "starting",
    q: "Can you help before I know exactly what I want?",
    a: "Yes — that is often the best time to involve us. We help you explore what is possible and shape the brief, turning a rough idea into a clear architectural design you feel confident about.",
  },
  {
    category: "starting",
    q: "Can I send photos of my home first?",
    a: "Please do. A few photos and a short description of what you're hoping to achieve let us give you an honest first view before any commitment. You can send them by WhatsApp, email or the contact form.",
  },
  {
    category: "starting",
    q: "How quickly can you give an initial view?",
    a: "Usually quickly. Once we've seen a few photos and your postcode, we aim to come back to you with an honest first view of the likely route — there's no obligation.",
  },

  /* Planning permission */
  {
    category: "planning",
    q: "Do I need planning permission?",
    a: "It depends on the size, position and type of your project, and on your property. Many home projects fall under permitted development, but plenty do not. We advise on the likely route and prepare the drawings you need — always confirmed with your local planning authority.",
  },
  {
    category: "planning",
    q: "Do you submit applications to Wirral Council?",
    a: "We prepare the drawings and support the submission. The application is made in your name (or your builder's), and we guide you through the process and any requested changes.",
  },

  {
    category: "planning",
    q: "How long does planning permission take?",
    a: "For a straightforward householder application the council's target is eight weeks from validation, and most Wirral decisions land in that window. Allow time before that for the measured survey, the design and preparing the application, and a little longer if the council asks for amendments or your property sits in a conservation area. We'll give you a realistic timeline for your project at the first conversation.",
  },

  /* Permitted development */
  {
    category: "permitted-development",
    q: "Can I extend under permitted development?",
    a: "Often yes, within limits. Single-storey rear extensions, many loft conversions and most garage conversions can fall under permitted development if they stay inside the size, height and position rules for your property. Flats, conservation areas, listed buildings and homes with an Article 4 direction have reduced rights or none. We check your property against the rules and tell you honestly which route to take, confirming it with the council.",
  },
  {
    category: "permitted-development",
    q: "What is permitted development?",
    a: "Permitted development rights let you build certain things without a full planning application, within strict limits. Whether your project qualifies depends on its size, position and your property — and some homes (flats, conservation areas, Article 4 areas) have reduced or no rights.",
  },
  {
    category: "permitted-development",
    q: "Can you help with lawful development certificates?",
    a: "Yes — where it's sensible, we prepare drawings for a Lawful Development Certificate, which is a formal council confirmation that your works are permitted development. It's useful for certainty and for a future sale.",
  },

  /* Building regulations */
  {
    category: "building-regs",
    q: "Do I need building regulations approval?",
    a: "Most extensions and habitable loft conversions require building-regulations approval, which is separate from planning permission. We prepare the architectural and building-regulations drawings needed for that process.",
  },
  {
    category: "building-regs",
    q: "What's included in Building Regulations drawings?",
    a: "A building-regulations package shows how the work is actually built. Ours typically covers foundations, floor, wall and roof build-ups, structure and steelwork positions, insulation and thermal performance, drainage layout and details, windows and glazing, internal partitions, fire safety and escape, ventilation, waterproofing, technical construction details and the written specification — coordinated with a structural engineer where calculations are needed. It's what building control assess and what your builder prices and works from.",
  },
  {
    category: "building-regs",
    q: "Do I need structural calculations?",
    a: "Often, where there are new beams or openings. A structural engineer provides the calculations, which sit alongside our building-regulations drawings.",
  },

  /* Drawings & deliverables */
  {
    category: "drawings",
    q: "What drawings do builders need to quote?",
    a: "Clear proposed plans and elevations, building-regulations drawings with construction details, and structural information where relevant. A clear pack lets several builders price the same scope, so you compare like with like.",
  },
  {
    category: "drawings",
    q: "What's the difference between planning and building-regs drawings?",
    a: "Planning drawings show what you want to build and how it looks; building-regulations drawings show how it's constructed and meets safety and energy standards. Most projects need both, at different stages.",
  },

  /* Costs & fees */
  {
    category: "costs",
    q: "How much does an architect cost?",
    a: "Registered architects commonly charge a percentage of the build cost, which on a home extension can run into several thousand pounds. We work differently: SC Design Wirral is an architectural design practice led by a Chartered Architectural Technologist, and we quote a fixed fee for an agreed scope of drawings, so you know the cost before anything starts. Tell us about the project and we'll put a figure to it.",
  },
  {
    category: "costs",
    q: "How much does architectural design cost?",
    a: "It varies with the size and complexity of the project and which drawings you need. Once we understand your property and goals, we set out a clear scope and fixed fee up front. Our guide on design costs explains what drives the price.",
  },

  /* Conservation areas */
  {
    category: "conservation",
    q: "What if my home is in a conservation area?",
    a: "Conservation areas usually reduce permitted development and call for a more sensitive, well-justified design — a full planning application is more likely. We design with that context in mind and never promise approval. Always confirm your designation with Wirral Council.",
  },

  /* Visualiser */
  {
    category: "visualiser",
    q: "How does the AI Extension Concept Visualiser work?",
    a: "You upload a photo of your home, choose a few options, and our tool generates a concept-style visualisation of how an extension idea might look. It's a quick way to picture possibilities before speaking to Sean.",
  },
  {
    category: "visualiser",
    q: "Is the visualiser an architectural drawing?",
    a: "No. It's an AI-generated concept visualisation only — not an architectural drawing, planning application, structural design or confirmation that the design can be built. Real design always starts with a proper look at your property.",
  },

  /* Areas covered */
  {
    category: "areas",
    q: "Do you cover Wallasey, Birkenhead, Heswall, West Kirby, Hoylake, Bebington and Bromborough?",
    a: "Yes — all of those are within our core Wirral area, along with New Brighton, Moreton, Upton, Greasby, Oxton, Port Sunlight, Eastham, Prenton and the rest of the peninsula. We also cover Neston, Ellesmere Port and Chester, Warrington, Runcorn and Northwich, Liverpool, Crosby and Southport, and North Wales including Wrexham, Mold and Connah Quay.",
  },

  /* What SC does / does not do */
  {
    category: "scope",
    q: "Do I need an architect for an extension?",
    a: "For a typical house extension, no — there is no legal requirement to use a registered architect. What you do need is someone who can design the scheme properly and produce accurate planning and building-regulations drawings. That work is carried out by Sean Corser MCIAT, a Chartered Architectural Technologist: qualified in the technical design and detailing of buildings, and a member of CIAT. We are not registered architects, because 'architect' is a title protected by UK law and reserved for those on the ARB register.",
  },
  {
    category: "scope",
    q: "Are you architects?",
    a: "We provide architectural design and drawing services. In the UK, the title 'architect' is protected by law and reserved for those registered with the ARB. We describe ourselves as an architectural design studio, not as registered architects, unless ARB registration is expressly confirmed.",
  },
  {
    category: "scope",
    q: "What's the difference between an architect and an architectural designer?",
    a: "'Architect' is a protected UK title for ARB-registered professionals; 'architectural designer' is not protected in the same way. For most home extensions and lofts, the design and drawings can be provided by either — what matters is the quality of the work and the experience behind it.",
  },
  {
    category: "scope",
    q: "Do you carry out the building work?",
    a: "No — we are design-only. We design your project and prepare planning and building-regulations drawings. You then take those drawings to builders to quote and carry out the work, and we're happy to explain that stage.",
  },

  /* House-feature questions (interactive planning guide, Sep 2026). Appended at
     the END so the homepage's generalFaqs.slice(0, 6) is unchanged. England
     guidance — always confirm with the local planning authority. */
  {
    category: "permitted-development",
    q: "Does a front porch need planning permission?",
    a: "Often not. In England a small porch is usually permitted development if its external footprint is no more than 3m², no part is higher than 3m and it's at least 2m from any boundary facing a road. Flats, conservation areas and Article 4 areas differ, and a porch outside those limits needs a planning application. Porches are often exempt from building regulations too, if under 30m² and the front door stays in place.",
  },
  {
    category: "permitted-development",
    q: "Do I need planning permission for a dormer loft conversion?",
    a: "A rear dormer is often permitted development within volume limits — 40m³ for terraced homes and 50m³ for semi-detached and detached — but a front dormer facing the road usually needs planning permission. Either way, a habitable loft conversion always needs building-regulations approval.",
  },
  {
    category: "planning",
    q: "Is a garage conversion a 'change of use'?",
    a: "Not normally in planning terms. Turning an attached garage into a room for your own home is usually permitted development, provided the work stays within the existing structure and no planning condition has removed those rights; changing the frontage can sometimes need permission. It does need building-regulations approval — insulation, damp-proofing, ventilation and fire safety.",
  },
  {
    category: "planning",
    q: "What is 'prior approval' for a larger rear extension?",
    a: "It's a lighter-touch route for single-storey rear extensions beyond the normal permitted-development depths — up to 6m on a semi-detached or terraced house and 8m on a detached house. You notify the council, which consults your neighbours before deciding. It isn't available on designated land such as conservation areas.",
  },
  {
    category: "planning",
    q: "Are the rules different in Wales?",
    a: "Yes. Permitted-development rights in Wales differ from England in several respects, so the planning guidance on this site is for England. If your home is in North Wales, send us your postcode and we'll confirm the right route with your local authority.",
  },
];

/**
 * The six questions Sean chose for the home page (brief, Sep 2026), in his
 * order. Looked up by question text so the home page and the FAQPage structured
 * data always match what /faqs actually says — edit the answer once, above.
 */
const homeFaqQuestions = [
  "Do I need an architect for an extension?",
  "How long does planning permission take?",
  "What drawings do builders need to quote?",
  "Can I extend under permitted development?",
  "What's included in Building Regulations drawings?",
  "How much does an architect cost?",
];

export const homeFaqs: Faq[] = homeFaqQuestions
  .map((q) => generalFaqs.find((f) => f.q === q))
  .filter((f): f is Faq => Boolean(f));

export const faqCategories: { key: FaqCategory; label: string }[] = [
  { key: "starting", label: "Starting a project" },
  { key: "planning", label: "Planning permission" },
  { key: "permitted-development", label: "Permitted development" },
  { key: "building-regs", label: "Building regulations" },
  { key: "drawings", label: "Drawings & deliverables" },
  { key: "costs", label: "Costs & fees" },
  { key: "conservation", label: "Conservation areas" },
  { key: "visualiser", label: "The visualiser" },
  { key: "areas", label: "Areas covered" },
  { key: "scope", label: "What we do / don't do" },
];
