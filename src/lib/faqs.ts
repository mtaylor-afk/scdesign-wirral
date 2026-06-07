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

  /* Permitted development */
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
    q: "How much does architectural design cost?",
    a: "It varies with the size and complexity of the project and which drawings you need. Once we understand your property and goals, we set out a clear scope and fee up front. Our guide on design costs explains what drives the price.",
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
    a: "Yes — all of those are within our core Wirral area, along with New Brighton, Moreton, Upton, Greasby, Oxton, Port Sunlight, Eastham and Prenton. We also work across surrounding areas including Neston, Ellesmere Port, Liverpool, Chester and Crosby.",
  },

  /* What SC does / does not do */
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
];

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
