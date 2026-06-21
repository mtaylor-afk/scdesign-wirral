/**
 * Cornerstone SEO guide content (architectural design, design-only, England-
 * focused). Each guide is unique, genuinely useful, and carries advisory notes —
 * not thin/duplicate content. Wording uses "architectural design / designer".
 * Planning/building-regs statements are hedged — confirm with the local authority.
 */

export type Guide = {
  slug: string;
  title: string; // page <h1> / <title>
  description: string; // meta description (120–160)
  intro: string;
  // Each section is an H2 + paragraphs, with an optional responsive comparison table.
  sections: {
    heading: string;
    body: string[];
    table?: { caption?: string; headers: string[]; rows: string[][] };
  }[];
  faqs: { q: string; a: string }[];
  related: string[]; // related service/area/guide paths
  reviewed: string;

  /* ---- Optional rich fields (drive the guide template + hub grouping) ---- */
  navLabel?: string; // short label for the nav dropdown
  category?:
    | "planning" // Planning permission & applications
    | "pd-ldc" // Permitted development & lawful development
    | "building-regs" // Building regulations & building control
    | "project" // Project-specific (extensions, lofts, garages, conservation)
    | "cost-process" // Costs, builders & process
    | "local-buying"; // Local checks & buying/selling
  summary?: string; // one-paragraph "in short" box
  metaTitle?: string; // exact <title> keyword phrase (brand appended by pageMeta)
  officialSources?: { label: string; href: string }[]; // per-guide sources (overrides category fallback)
  ctaService?: string; // /services/... path for the mid-page contextual CTA (Zone B)
  draft?: boolean; // incomplete → noindex + excluded from sitemap, hub and nav
};

export const guides: Guide[] = [
  {
    slug: "do-i-need-planning-permission-for-an-extension",
    navLabel: "Do I need planning permission?",
    category: "planning",
    title: "Do I Need Planning Permission for an Extension?",
    description:
      "A plain-English guide to planning permission and permitted development for house extensions in England — when you need it, when you don't, and how the design stage helps.",
    summary:
      "Many smaller extensions are permitted development and don't need a full planning application — but not all. Size, position, your property type and where you live all matter. We advise on the likely route and prepare the drawings, always confirmed with your local authority.",
    intro:
      "One of the first questions homeowners ask is whether an extension needs planning permission. The honest answer is: sometimes. Many smaller extensions fall under 'permitted development', but plenty still need a full planning application — and the rules change depending on your property and where you live. Here's how to think about it.",
    sections: [
      {
        heading: "Permitted development vs planning permission",
        body: [
          "Permitted development rights let you carry out certain works without a full planning application, within strict size and position limits. A modest single-storey rear extension on a typical house will often fall within these limits.",
          "However, permitted development does not apply everywhere or to every home. Flats, maisonettes and converted houses usually don't have the same rights, and the limits are tighter on the side and front of a property.",
        ],
      },
      {
        heading: "When you're more likely to need planning permission",
        body: [
          "You're more likely to need a full planning application if your extension is large or two-storey, sits forward of the principal elevation, is close to a boundary, or significantly changes the roof.",
          "Where your home sits matters too: conservation areas, Article 4 directions, listed buildings and Areas of Outstanding Natural Beauty all reduce or remove permitted development rights, and the design needs to be handled sensitively.",
        ],
      },
      {
        heading: "Local context across Wirral",
        body: [
          "Wirral has a number of conservation areas — Port Sunlight and parts of Oxton are well-known examples — where permitted development is usually restricted. Whether a specific street is designated must be confirmed with Wirral Council for your address.",
          "Even outside those areas, the position relative to boundaries and neighbouring windows shapes what's achievable. We design with that in mind from the first sketch.",
        ],
      },
      {
        heading: "How the design stage helps",
        body: [
          "Good architectural design isn't just about how the extension looks — it's about choosing an approach that's realistic for your property and the planning route it's likely to need.",
          "We prepare clear existing and proposed drawings, advise on the likely route, and where a Lawful Development Certificate or full application is the sensible step, we prepare the drawings that support it.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can you tell me for certain whether I need permission?",
        a: "We can advise on the likely route based on your property and plans, but the definitive position always rests with your local planning authority. Where it's useful, a Lawful Development Certificate gives formal confirmation that works are permitted development.",
      },
      {
        q: "Does a conservation area change things?",
        a: "Yes — conservation areas typically restrict permitted development and call for a more sensitive, well-justified design. We prepare drawings with that context in mind.",
      },
    ],
    related: [
      "/services/house-extensions",
      "/services/planning-drawings-wirral",
      "/guides/permitted-development-rights-wirral",
      "/guides/do-i-need-building-regulations-approval",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "do-i-need-building-regulations-approval",
    navLabel: "Do I need building regs?",
    category: "building-regs",
    title: "Do I Need Building Regulations Approval?",
    description:
      "Building regulations vs planning permission explained for homeowners in England — why most extensions and habitable loft conversions need building-regs approval, and what drawings are involved.",
    summary:
      "Planning is about whether you can build; building regulations are about how it's built. Most extensions and habitable loft conversions need building-regs approval even when planning permission isn't required — and the two are entirely separate processes.",
    intro:
      "Planning permission and building regulations are two different things, and it's easy to confuse them. Planning is about whether you can build; building regulations are about how it's built — structure, safety, insulation, fire and more. Most extensions and habitable loft conversions need building-regulations approval even when planning permission isn't required.",
    sections: [
      {
        heading: "What building regulations cover",
        body: [
          "Building regulations set minimum standards for the work itself: structural stability, fire safety, insulation and energy efficiency, ventilation, drainage, stairs and access, and more.",
          "They apply to most building work — extensions, loft conversions, structural alterations and many internal changes — regardless of whether planning permission is needed.",
        ],
      },
      {
        heading: "The drawings involved",
        body: [
          "Building-control approval is usually supported by technical drawings and specifications showing how the work meets the regulations — construction details, sections, insulation and structural information.",
          "We prepare clear architectural and building-regulations drawings for your project, so building control and your builder both have what they need.",
        ],
      },
      {
        heading: "Full plans vs building notice",
        body: [
          "There are two routes. A full plans application means your drawings are checked and approved before work starts — the safer option for extensions and loft conversions. A building notice involves less paperwork but more risk, as issues are only caught during inspection.",
          "We generally recommend the full plans route for anything structural, so problems are designed out rather than discovered on site.",
        ],
      },
      {
        heading: "How approval works",
        body: [
          "Approval is obtained either through your local authority building control or an approved inspector, and the work is inspected at key stages.",
          "We help you understand the process and what each stage involves, so it feels far less daunting. Keep the completion certificate safe — a buyer's solicitor will ask for it.",
        ],
      },
    ],
    faqs: [
      {
        q: "Do I need building regs if I don't need planning permission?",
        a: "Very often, yes. The two are separate. A loft conversion or extension can be permitted development for planning purposes and still require building-regulations approval.",
      },
      {
        q: "Do you submit the building-regs application for me?",
        a: "We prepare the drawings and support the process. The application itself sits with you as the homeowner (or your builder), and we guide you through it.",
      },
    ],
    related: [
      "/services/building-regulations-drawings-wirral",
      "/services/loft-conversions",
      "/guides/planning-drawings-vs-building-regulations-drawings",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "how-much-does-architectural-design-cost",
    navLabel: "Architectural design cost",
    category: "cost-process",
    title: "How Much Does Architectural Design Cost?",
    description:
      "What affects the cost of architectural design and drawings for a house extension or loft conversion — a plain-English guide to design fees for UK homeowners. Guide only.",
    summary:
      "Design fees vary because every project is different. The main drivers are the size and complexity of the work, how much design exploration you want, the property itself, and which drawings you need. This is general guidance, not a quote.",
    intro:
      "Design fees vary because every project is different. Rather than quote a single figure, it's more useful to understand what actually drives the cost of architectural design — so you can budget sensibly and know what you're paying for. This is a general guide, not a quote.",
    sections: [
      {
        heading: "What affects the cost",
        body: [
          "The main factors are the size and complexity of the project, how much design exploration you want, the property itself (period homes and tricky sites take more care), and which drawings you need — concept only, planning drawings, building-regulations drawings, or the full set.",
          "A straightforward single-storey rear extension involves less work than a two-storey wraparound or a whole-home reconfiguration, and the fee reflects that.",
        ],
      },
      {
        heading: "What you're paying for",
        body: [
          "You're paying for the thinking as much as the drawings: someone who helps you explore what's possible, avoids costly mistakes, and turns a rough idea into a clear, buildable design.",
          "Good drawings also save money later — they let builders quote accurately against the same information, rather than guessing. The difference between two builders' prices is often down to how clearly the work is specified.",
        ],
      },
      {
        heading: "Other costs to budget for",
        body: [
          "Design fees are only one part. You may also need to budget for local authority planning fees, building-control fees, a structural engineer's calculations where there are beams or openings, and possibly a party wall surveyor if you build near a shared boundary.",
          "We'll flag which of these are likely to apply to your project so there are no surprises.",
        ],
      },
      {
        heading: "How we keep it transparent",
        body: [
          "We talk through scope and fees up front, so you know what's included before you commit. Send Sean your name and one way to contact you and we'll come back with an honest view — a few photos and a short description help if you have them, but aren't required to start.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can you give me a fixed price?",
        a: "Once we understand your property and what you'd like to achieve, we can set out a clear scope and fee. The honest first step is just a quick message — photos help if you have them, but aren't needed to start.",
      },
      {
        q: "Is design worth it for a small extension?",
        a: "Even on smaller projects, considered design and accurate drawings usually pay for themselves — in better use of space and in builders being able to quote and build from clear information.",
      },
    ],
    related: ["/services/residential-design", "/process", "/guides/what-drawings-do-builders-need"],
    reviewed: "June 2026",
  },
  {
    slug: "architect-vs-architectural-designer",
    navLabel: "Architect vs designer",
    category: "cost-process",
    officialSources: [
      { label: "Architects Registration Board (ARB)", href: "https://arb.org.uk/" },
    ],
    title: "Architect vs Architectural Designer — What's the Difference?",
    description:
      "Architect, architectural designer, architectural technologist — what the titles mean in the UK, what each does for a home project, and how to choose the right help for your extension or loft.",
    summary:
      "In the UK 'architect' is a title protected by law — only ARB-registered people may use it. 'Architectural designer' and 'architectural technologist' are not protected in the same way. For most home extensions and lofts, the design and drawings can be provided by more than one of these. What matters is the quality of the work and the experience behind it.",
    intro:
      "When you're planning an extension you'll come across several job titles — architect, architectural designer, architectural technologist. They overlap, and for most home projects the design and drawings you need can be provided by more than one of them. Here's what the terms mean and how to choose.",
    sections: [
      {
        heading: "What the titles mean",
        body: [
          "In the UK the title 'architect' is protected by law (the Architects Act 1997) and may only be used by someone registered with the Architects Registration Board (ARB). 'Architectural designer' and 'architectural technologist' are not protected titles in the same way.",
          "That protection is about the title, not the work. Plenty of skilled professionals who design and draw home extensions are not registered architects, and the law doesn't require a registered architect for that work.",
        ],
      },
      {
        heading: "What each typically does for a home project",
        body: [
          "For a typical extension or loft conversion, the work is similar: exploring the design, preparing planning drawings, and preparing building-regulations drawings. Different professionals may emphasise different parts of that.",
          "The right choice depends on the complexity of your project and the relationship — someone local who takes the time to understand how you live is often worth more than a title alone.",
        ],
      },
      {
        heading: "How to choose",
        body: [
          "Look at the quality of previous work, how clearly they explain things, and whether they understand your property and the local planning context. Ask what's included, what isn't, and how they handle the planning and building-regulations stages.",
          "For larger, more complex or higher-risk projects, a registered architect or a chartered professional may be the right call. For a typical home extension or loft, an experienced architectural designer is a common and sensible choice.",
        ],
      },
      {
        heading: "How we describe ourselves",
        body: [
          "We provide architectural design and drawings for Wirral homeowners — concept design, planning drawings and building-regulations drawings — with 18+ years of experience. We focus purely on design, so our advice stays centred on getting it right for you.",
          "We describe ourselves as an architectural design studio, not as registered architects, unless ARB registration is expressly confirmed.",
        ],
      },
    ],
    faqs: [
      {
        q: "Do I need a registered architect for a house extension?",
        a: "Not necessarily. Many home extensions and loft conversions are designed and drawn by architectural designers and technologists. What matters is the quality of the design and drawings and the experience behind them.",
      },
      {
        q: "What do you provide?",
        a: "Architectural design and drawings — concept design, planning drawings and building-regulations drawings. We design your project; you take the drawings to builders to quote and build.",
      },
    ],
    related: ["/services/residential-design", "/about", "/process"],
    reviewed: "June 2026",
  },

  /* ============================ NEW GUIDES ============================ */
  {
    slug: "planning-drawings-vs-building-regulations-drawings",
    navLabel: "Planning vs building-regs drawings",
    category: "planning",
    title: "Planning Drawings vs Building Regulations Drawings: What's the Difference?",
    description:
      "Planning drawings show what you want to build; building-regulations drawings show how it's built. A clear guide to the two sets of drawings most home projects need.",
    summary:
      "Planning drawings are about what you want to build and how it looks; building-regulations drawings are about how it's constructed and meets safety and energy standards. Most extensions and loft conversions need both, at different stages.",
    intro:
      "People often hear they need 'drawings' and assume it's one thing. In fact most home projects involve two distinct sets, prepared at different stages for different purposes: planning drawings and building-regulations drawings. Knowing the difference helps you understand what you're paying for and when.",
    sections: [
      {
        heading: "Planning drawings — what and how it looks",
        body: [
          "Planning drawings support a planning application. They show what you want to build and its impact: existing and proposed floor plans, elevations (how it looks from each side), and a location/site plan identifying the property.",
          "Their job is to let the council assess the proposal's size, appearance and effect on neighbours and the area. They are not detailed enough to build from.",
        ],
      },
      {
        heading: "Building-regulations drawings — how it's built",
        body: [
          "Building-regulations drawings come later and are far more technical. They show how the work is constructed and how it meets the regulations: construction sections, junction details, insulation, fire safety, drainage, ventilation and structure.",
          "These are what building control checks and what a builder needs to construct the project correctly.",
        ],
      },
      {
        heading: "Do I need both?",
        body: [
          "Often, yes. A project might need planning permission (so planning drawings) and will almost always need building-regulations approval (so building-regs drawings) — even if it's permitted development and skips the planning stage.",
          "Some small internal projects need neither; some need only building regs. We advise on which applies to your specific project.",
        ],
      },
      {
        heading: "The order they happen in",
        body: [
          "Typically you settle the design, obtain planning permission (or confirm permitted development), then prepare building-regulations drawings for the build. Doing them in the right order avoids paying to detail a scheme that later has to change for planning.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can one set of drawings do both jobs?",
        a: "No — they serve different purposes and contain different information. Planning drawings show what and how it looks; building-regs drawings show how it's built. We prepare both as your project needs them.",
      },
      {
        q: "Which do I need first?",
        a: "Usually planning (or confirming permitted development) comes first, then building-regulations drawings for the build. We'll guide you through the right order.",
      },
    ],
    related: [
      "/services/planning-drawings-wirral",
      "/services/building-regulations-drawings-wirral",
      "/guides/do-i-need-planning-permission-for-an-extension",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "permitted-development-rights-wirral",
    navLabel: "Permitted development in Wirral",
    category: "pd-ldc",
    title: "Permitted Development Rights in Wirral: A Homeowner's Guide",
    description:
      "What permitted development means for Wirral homeowners, the limits that apply to extensions and loft conversions, and why a lawful development certificate can be worth having.",
    summary:
      "Permitted development lets you build certain things without a full planning application, within strict limits. Many Wirral homes have these rights — but flats, conservation areas and Article 4 directions can reduce or remove them. A lawful development certificate gives formal proof.",
    intro:
      "Permitted development rights are a useful shortcut — they let you carry out certain works without a full planning application. But they come with detailed limits and plenty of exceptions, and 'I think it's permitted development' isn't the same as proof. Here's what Wirral homeowners should know.",
    sections: [
      {
        heading: "What permitted development covers",
        body: [
          "Permitted development can include certain single-storey rear extensions, some loft conversions, porches and outbuildings, all within size, height and position limits set out in national legislation.",
          "The limits differ for the rear, side and front of a property, and the front of a house is far more restricted than the rear.",
        ],
      },
      {
        heading: "What reduces or removes the rights in Wirral",
        body: [
          "Flats and maisonettes don't have the same householder rights. Listed buildings, conservation areas (such as Port Sunlight and parts of Oxton) and properties subject to an Article 4 direction often have reduced or removed permitted development rights.",
          "Whether your specific address is affected must be confirmed with Wirral Council — designations vary street to street, and assumptions are risky.",
        ],
      },
      {
        heading: "Why a lawful development certificate is sensible",
        body: [
          "A Lawful Development Certificate (LDC) is a formal council decision confirming that your works are permitted development. It turns 'we think it's fine' into a documented fact.",
          "That matters when you sell or remortgage — a buyer's solicitor may ask for proof — and it protects you if anyone questions the works later. We prepare the drawings an LDC application needs.",
        ],
      },
    ],
    faqs: [
      {
        q: "How do I know if my Wirral home has permitted development rights?",
        a: "Most houses do, but flats, listed buildings, conservation areas and Article 4 areas are exceptions. The only definitive source is Wirral Council for your specific address — we can help you check and prepare a lawful development certificate.",
      },
      {
        q: "Does permitted development mean I can skip building regulations?",
        a: "No — building regulations are entirely separate and still apply to most building work.",
      },
    ],
    related: [
      "/services/planning-drawings-wirral",
      "/services/planning-drawings-wirral",
      "/guides/lawful-development-certificate-explained",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "lawful-development-certificate-explained",
    navLabel: "Lawful development certificate",
    category: "pd-ldc",
    title: "What Is a Lawful Development Certificate?",
    description:
      "A lawful development certificate explained for homeowners — what it is, why people get one, and how it differs from planning permission. General guidance for England.",
    summary:
      "A Lawful Development Certificate (LDC) is a formal council decision confirming that works are lawful — usually because they're permitted development. It isn't planning permission; it's proof you don't need it. Useful for certainty and for a smooth future sale.",
    intro:
      "A Lawful Development Certificate is one of the most useful — and least understood — documents in home improvement. It's not planning permission. It's a formal confirmation that your project is lawful and doesn't need permission. Here's when and why it's worth having.",
    sections: [
      {
        heading: "What an LDC actually is",
        body: [
          "An LDC is a decision from your local planning authority confirming that a proposed (or existing) development is lawful. For most homeowners that means confirming the works are permitted development and therefore don't need planning permission.",
          "It's a legal document, not an opinion — which is exactly why it's valuable.",
        ],
      },
      {
        heading: "Why homeowners get one",
        body: [
          "The biggest reasons are certainty and resale. If you rely on permitted development and build without confirmation, a future buyer's solicitor may ask how you know it was lawful. An LDC answers that cleanly.",
          "It also protects you if an interpretation is ever challenged — for example if a neighbour queries the works.",
        ],
      },
      {
        heading: "How it differs from planning permission",
        body: [
          "Planning permission grants the right to build something that needs consent. An LDC confirms your works don't need consent in the first place. They're opposite ends of the same question.",
          "You apply with drawings (and sometimes supporting evidence). We prepare the drawings; the application is made in your name.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is a lawful development certificate the same as planning permission?",
        a: "No. Planning permission grants the right to build something that needs it; an LDC confirms your works don't need permission at all.",
      },
      {
        q: "Do I need one?",
        a: "It's optional, but many homeowners find it worthwhile for certainty and for a smooth future sale or remortgage, especially when relying on permitted development.",
      },
    ],
    related: [
      "/services/planning-drawings-wirral",
      "/services/planning-drawings-wirral",
      "/guides/permitted-development-rights-wirral",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "what-drawings-do-builders-need",
    navLabel: "Drawings builders need",
    category: "cost-process",
    title: "What Drawings Does a Builder Need to Quote Accurately?",
    description:
      "Why builders quote so differently, and what drawings give them the information to price your extension or loft conversion accurately and fairly.",
    summary:
      "Builders can only price what they can see. Vague information produces wildly different quotes; a clear drawing pack lets several builders quote the same scope, so you can compare like with like — and the eventual build matches what you agreed.",
    intro:
      "Ever had three builders quote wildly different prices for 'the same' job? Usually it's because they weren't quoting the same job at all — each filled the gaps with their own assumptions. Clear drawings fix that. Here's what builders actually need to price your project properly.",
    sections: [
      {
        heading: "Why quotes vary so much",
        body: [
          "When the information is vague, every builder makes their own assumptions about specification, structure and finishes — and prices accordingly. One assumes a basic spec, another a premium one, and you're left comparing numbers that aren't comparable.",
          "A clear set of drawings removes the guesswork, so the prices reflect the same work.",
        ],
      },
      {
        heading: "What a useful drawing pack contains",
        body: [
          "For an accurate quote, builders benefit from proposed plans and elevations, building-regulations drawings with construction details and specifications, and structural information where beams or openings are involved.",
          "Together these define the scope: what's being built, how, and to what standard.",
        ],
      },
      {
        heading: "How it protects you on site",
        body: [
          "Drawings aren't just for quoting — they're the reference during the build. If a question comes up, the answer is on the drawings rather than decided on the spot, which keeps cost and quality under control.",
          "It also makes the final result match what you agreed, not what someone assumed.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can a builder just quote from a sketch?",
        a: "They can, but the quote will be full of assumptions and the price may move once details are decided. Clear drawings let builders price the same defined scope.",
      },
      {
        q: "Do you provide drawings builders can quote from?",
        a: "Yes — that's the point of the drawing pack we prepare. Several builders can price the same information, so you compare like with like.",
      },
    ],
    related: [
      "/services/building-regulations-drawings-wirral",
      "/services/house-extensions",
      "/process",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "how-long-does-planning-permission-take-wirral",
    navLabel: "Planning timescales in Wirral",
    category: "planning",
    title: "How Long Does Planning Permission Take in Wirral?",
    description:
      "How long a householder planning application typically takes in England and Wirral, what affects the timeline, and how to keep your project moving. General guidance.",
    summary:
      "Householder planning applications in England usually target a decision within around eight weeks of being validated — but validation, consultation and any requested changes all affect the real timeline. Well-prepared drawings reduce avoidable delays.",
    intro:
      "Once you've decided to apply, the natural next question is 'how long will this take?'. There's a standard target, but the real answer depends on several things. Here's a realistic picture for Wirral homeowners, with the usual caveat that timelines vary.",
    sections: [
      {
        heading: "The standard target",
        body: [
          "For most householder applications in England, local planning authorities aim to decide within around eight weeks of validating the application. Wirral Council, like others, works to that kind of target.",
          "That clock starts at validation — not when you submit — which is an important distinction.",
        ],
      },
      {
        heading: "What affects the timeline",
        body: [
          "Validation can take time if the application isn't complete or the drawings don't meet requirements — which is why well-prepared drawings matter. After validation there's usually a consultation period for neighbours and consultees.",
          "If the officer requests minor amendments, responding promptly keeps things moving. Sensitive sites — conservation areas, for example — can take longer.",
        ],
      },
      {
        heading: "How to keep it moving",
        body: [
          "The biggest avoidable delays come from incomplete submissions and slow responses to queries. A clear, complete drawing set and a quick turnaround on any requested changes are the two things most within your control.",
          "We prepare the drawings to reduce validation hold-ups and help you respond to any council queries.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is eight weeks guaranteed?",
        a: "No — it's a target, not a guarantee. Validation, consultation and any requested changes all affect the real timeline, and it varies by application.",
      },
      {
        q: "Can I do anything to speed it up?",
        a: "Submitting a complete, well-prepared application and responding quickly to any council queries are the two biggest things within your control.",
      },
    ],
    related: [
      "/services/planning-drawings-wirral",
      "/services/building-regulations-drawings-wirral",
      "/guides/do-i-need-planning-permission-for-an-extension",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "conservation-area-extensions-wirral",
    navLabel: "Conservation area extensions",
    category: "project",
    title: "Extending a Home in a Wirral Conservation Area",
    description:
      "How extending a home in a Wirral conservation area differs — reduced permitted development, sensitive design, and why a well-justified application matters. General guidance.",
    summary:
      "Conservation areas protect the character of a place, so extensions are assessed more carefully and permitted development is usually reduced. Sensitive design, appropriate materials and a well-justified application give a project its best chance — but approval is never guaranteed.",
    intro:
      "Wirral has several conservation areas — Port Sunlight and parts of Oxton among the best known — where the character of the place is protected. Extending a home in one of these areas is absolutely possible, but it works differently. Here's what to expect.",
    sections: [
      {
        heading: "What a conservation area means for your project",
        body: [
          "A conservation area designation means the council pays particular attention to design quality, materials and how a proposal affects the character of the area. It usually reduces or removes permitted development rights, so a full planning application is more likely.",
          "The exact boundary and any additional controls (such as an Article 4 direction) must be confirmed with Wirral Council for your specific address.",
        ],
      },
      {
        heading: "Designing sensitively",
        body: [
          "A successful conservation-area extension respects the proportions, materials and detailing of the original home and its surroundings. That doesn't mean it can't be contemporary — but it has to be considered.",
          "We design to sit comfortably within the setting and prepare drawings and justification that present the proposal well.",
        ],
      },
      {
        heading: "Managing expectations",
        body: [
          "Conservation applications are judged on their merits, and no one can promise approval — be cautious of anyone who does. What a good design and a careful application do is give your project the best possible chance.",
          "Starting with the council's guidance, and designing within it, is always the sensible first step.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I extend a house in a Wirral conservation area?",
        a: "Often yes, but the design must be sensitive and a full planning application is more likely. We design with that context in mind and present a well-justified proposal — never promising approval.",
      },
      {
        q: "How do I know if I'm in a conservation area?",
        a: "Wirral Council holds the designations and is the definitive source. A postcode helps Sean check the local planning context, but it isn't required to start — get in touch and he can help you check.",
      },
    ],
    related: [
      "/services/residential-design",
      "/areas/oxton",
      "/areas/port-sunlight",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "loft-conversion-building-regulations",
    navLabel: "Loft conversion building regs",
    category: "building-regs",
    title: "Loft Conversion Building Regulations: What Homeowners Need to Know",
    description:
      "Why every habitable loft conversion needs building-regulations approval, and what's involved — fire safety, stairs, structure and insulation. General guidance for England.",
    summary:
      "Every habitable loft conversion needs building-regulations approval, even when it's permitted development for planning. The big areas are fire safety and means of escape, the new staircase, structure (new floor and beams), and insulation. A structural engineer usually provides the calculations.",
    intro:
      "A loft conversion is one of the most popular ways to add space to a Wirral home — but it's also one where building regulations really matter. Even when planning permission isn't needed, building-regulations approval always is. Here's what's involved.",
    sections: [
      {
        heading: "Fire safety and means of escape",
        body: [
          "Adding a habitable room in the roof changes how people would escape a fire, so fire safety is central. This often means a protected stairway, fire doors to rooms off the stairs, and mains-linked smoke alarms.",
          "These requirements shape the design from the start, which is why we plan them in early rather than bolting them on.",
        ],
      },
      {
        heading: "The staircase",
        body: [
          "A loft conversion needs a proper, compliant staircase — not a loft ladder. Fitting it in while keeping head height and not sacrificing a whole room below is one of the key design challenges, and we work it out early.",
        ],
      },
      {
        heading: "Structure and insulation",
        body: [
          "The existing ceiling joists usually aren't strong enough for a floor, so new structural members are needed. A structural engineer typically provides the calculations that sit alongside our drawings.",
          "Insulation, ventilation and the like all need to meet current standards too — building control checks all of it.",
        ],
      },
      {
        heading: "How approval works",
        body: [
          "We prepare the building-regulations drawings; the application goes to local authority building control or an approved inspector, with inspections at key stages. Keep the completion certificate — a future buyer will want it.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does every loft conversion need building regulations?",
        a: "Yes — any habitable loft conversion needs building-regulations approval, covering fire safety, stairs, structure and insulation, even when planning permission isn't required.",
      },
      {
        q: "Do I need a structural engineer for a loft conversion?",
        a: "Usually yes — new floor structure and beams need an engineer's calculations, which sit alongside our building-regulations drawings.",
      },
    ],
    related: [
      "/services/loft-conversions",
      "/services/building-regulations-drawings-wirral",
      "/guides/do-i-need-building-regulations-approval",
    ],
    reviewed: "June 2026",
  },

  /* ===================== BATCH 1 — BUILDING CONTROL ===================== */
  {
    slug: "full-plans-vs-building-notice-wirral",
    navLabel: "Full Plans vs Building Notice",
    category: "building-regs",
    ctaService: "/services/building-regulations-drawings-wirral",
    title: "Full Plans vs Building Notice: Which Building Control Route Should Wirral Homeowners Choose?",
    metaTitle: "Full Plans vs Building Notice Wirral | Building Regs Drawings",
    description:
      "Understand the difference between Full Plans and Building Notice routes for Wirral home projects, and when building-regulations drawings may help before work starts.",
    summary:
      "There are two building-control routes. A Full Plans application has your drawings checked and approved before work starts — the safer choice for extensions, lofts and garage conversions. A Building Notice has no plan check, so problems usually only surface on site. SC Design prepares the building-regulations drawings; we don't carry out the build or act as building control.",
    intro:
      "Most building work needs building-regulations approval, and in England there are two ways to get it: a Full Plans application or a Building Notice. They sound similar but work very differently, and the right choice affects how much certainty you have before work begins. Here's how Wirral homeowners can think about it.",
    sections: [
      {
        heading: "What is a Full Plans application?",
        body: [
          "With a Full Plans application you submit detailed drawings and specifications before work starts, and building control checks them against the regulations. Wirral Council asks for full, detailed drawings and specifications — plus structural calculations where they apply — so the proposal can be assessed properly.",
          "The advantage is that problems are identified on paper, before anyone is on site. You get a documented decision you can rely on, and your builder is pricing and building from approved information.",
        ],
      },
      {
        heading: "What is a Building Notice?",
        body: [
          "A Building Notice is a lighter-touch route that can be used for many domestic alterations and extensions. You give notice of the work and pay the charge, but there is no plan-checking stage.",
          "Wirral Council is clear that a Building Notice is not subjected to any plan assessment — and even if you do submit plans with it, they will not be checked for compliance. Compliance is confirmed through inspection as the work proceeds, which means an issue may only come to light after that part of the work is built.",
        ],
      },
      {
        heading: "Why drawings still matter before work starts",
        body: [
          "Even on a Building Notice, clear drawings are worth having: your builder needs to know exactly what they're pricing and building, and structural calculations may still be required separately for beams and openings.",
          "Drawings are what turn 'roughly this' into a defined, comparable scope — which is how you avoid surprises on cost and quality once the work is under way.",
        ],
      },
      {
        heading: "Which route usually suits extensions, lofts and garage conversions?",
        body: [
          "For anything structural — extensions, loft conversions and garage conversions — the Full Plans route is usually the safer choice, because the detail is checked before you commit money and time. Wirral points homeowners who want the peace of mind of an approved plan before works commence towards Full Plans.",
          "A Building Notice can suit simpler, well-understood work, but it may be unsuitable for complex projects. The table below sums up the trade-off — but the right call always depends on your specific project.",
        ],
        table: {
          caption: "A simple comparison — confirm the right route for your project with building control.",
          headers: ["", "Full Plans", "Building Notice"],
          rows: [
            ["Plans checked before work?", "Yes — assessed against the regulations", "No — not plan-assessed"],
            ["Certainty before starting", "A documented decision up front", "Confirmed by inspection as work proceeds"],
            ["Usually suits", "Extensions, lofts, garage conversions, structural work", "Simpler, well-understood alterations"],
            ["Main risk", "More paperwork up front", "Issues may surface after work is built"],
          ],
        },
      },
      {
        heading: "What SC Design can — and can't — do here",
        body: [
          "We prepare clear building-regulations drawings for your project, whichever route you choose, and we coordinate with a structural engineer where calculations are needed. We can also explain how each route works so the decision feels straightforward.",
          "What we don't do is carry out the building work or act as your building-control body — the application sits with you (or your builder), and inspections are carried out by building control. We focus purely on getting the design and drawings right.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is a Building Notice cheaper than Full Plans?",
        a: "The charges differ and depend on the work, so confirm current fees with building control. The bigger difference is risk, not price: a Building Notice has no plan check, so problems can surface on site rather than on paper.",
      },
      {
        q: "Can I start work sooner with a Building Notice?",
        a: "Sometimes, because there's no plan-checking stage — but that's exactly why issues may only be caught during inspection. For structural work, the certainty of an approved Full Plans application is usually worth the wait.",
      },
      {
        q: "Do I still need drawings for a Building Notice?",
        a: "It's strongly advisable. Wirral won't check plans submitted with a Building Notice, but your builder still needs clear drawings to price and build correctly, and structural calculations may be required separately.",
      },
      {
        q: "Which route is safer for an extension?",
        a: "For extensions and other structural work, Full Plans is generally the safer route because the detail is approved before work starts. We can prepare the drawings either way and help you decide.",
      },
    ],
    officialSources: [
      {
        label: "Wirral Council — Full Plans applications",
        href: "https://www.wirral.gov.uk/planning-and-building/building-control/types-applications/full-plans-applications",
      },
      {
        label: "Wirral Council — Building Notice",
        href: "https://www.wirral.gov.uk/planning-and-building/building-control/types-applications/building-notice",
      },
      {
        label: "GOV.UK — Building regulations approval: how to apply",
        href: "https://www.gov.uk/building-regulations-approval/how-to-apply",
      },
    ],
    related: [
      "/services/building-regulations-drawings-wirral",
      "/services/building-regulations-drawings-wirral",
      "/guides/do-i-need-building-regulations-approval",
      "/guides/after-planning-permission-next-steps",
      "/contact",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "after-planning-permission-next-steps",
    navLabel: "After planning permission",
    category: "building-regs",
    ctaService: "/services/building-regulations-drawings-wirral",
    title: "What Happens After Planning Permission Is Granted? Building Regs, Structural Calculations and Builder Quotes",
    metaTitle: "After Planning Permission: Building Regs, Calculations & Quotes",
    description:
      "What happens after planning permission is granted, including building-regulations drawings, structural calculations and builder quotation packs. General guidance for England.",
    summary:
      "Planning permission isn't the finish line — it's permission to build, not approval of how it's built. Next come any planning conditions, building-regulations drawings, structural calculations where needed, a building-control route, and a clear pack for builders to quote from. SC Design prepares the drawings and design-stage support, not the build itself.",
    intro:
      "Getting planning permission feels like the big milestone — and it is — but it's the start of the next stage, not the end. Planning permission and building regulations are separate things, and a project usually needs both. Here's what typically happens next, so you can plan the move from approval to build.",
    sections: [
      {
        heading: "Check the decision notice and any conditions",
        body: [
          "Your planning decision notice often comes with conditions — things that must be done or agreed before or during the work, such as approving materials. Some need to be 'discharged' (formally signed off) before you start.",
          "Read the notice carefully and keep it safe. We can help you understand what the conditions mean for your drawings and timeline.",
        ],
      },
      {
        heading: "Move from planning drawings to building-regs drawings",
        body: [
          "Planning drawings show what you're building and how it looks; they aren't detailed enough to construct from. The next step is building-regulations drawings, which show how the work is built — construction details, insulation, fire safety, drainage and structure.",
          "These are what building control checks and what your builder needs on site. We prepare them so both have clear, consistent information.",
        ],
      },
      {
        heading: "Structural calculations and engineer input",
        body: [
          "Where there are beams, widened openings, loft floors or other structural changes, a structural engineer's calculations are usually needed alongside the drawings. The engineer provides the calculations; we coordinate the design around them.",
          "Building control may request these calculations, so it's worth sorting them at this stage rather than mid-build.",
        ],
      },
      {
        heading: "Choose a building-control route, then get comparable quotes",
        body: [
          "You'll apply for building-regulations approval via a Full Plans application or a Building Notice (for structural work, Full Plans is usually safer). We can explain the difference and prepare the drawings either way.",
          "With a clear drawing pack, several builders can quote against the same information — so the prices are genuinely comparable, rather than each builder guessing a different specification. Keep your completion certificate safe once the work is signed off; a future buyer's solicitor will ask for it.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I start building straight after planning permission?",
        a: "Not usually. You'll typically need building-regulations approval first, and any pre-commencement planning conditions discharged. Planning permission allows the development in principle; it doesn't cover how it's built.",
      },
      {
        q: "What are planning conditions?",
        a: "Requirements attached to your permission — for example agreeing materials or details before or during the work. Some must be discharged before you start, so check the decision notice carefully.",
      },
      {
        q: "Do I need building regulations after planning?",
        a: "Almost always, yes. They're separate processes: most extensions and habitable loft conversions need building-regulations approval even when planning permission is already granted.",
      },
      {
        q: "When do I get builders to quote?",
        a: "Once you have a clear drawing pack (ideally with any structural calculations), so every builder prices the same defined scope and you can compare like with like.",
      },
    ],
    officialSources: [
      {
        label: "GOV.UK — Building regulations approval: when you need it",
        href: "https://www.gov.uk/building-regulations-approval",
      },
      {
        label: "GOV.UK — Building regulations approval: how to apply",
        href: "https://www.gov.uk/building-regulations-approval/how-to-apply",
      },
      {
        label: "Wirral Council — Full Plans applications",
        href: "https://www.wirral.gov.uk/planning-and-building/building-control/types-applications/full-plans-applications",
      },
    ],
    related: [
      "/services/building-regulations-drawings-wirral",
      "/services/building-regulations-drawings-wirral",
      "/guides/full-plans-vs-building-notice-wirral",
      "/guides/structural-calculations-vs-architectural-drawings",
      "/guides/builder-quote-drawing-pack-checklist",
      "/contact",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "structural-calculations-vs-architectural-drawings",
    navLabel: "Structural calcs vs drawings",
    category: "building-regs",
    ctaService: "/services/building-regulations-drawings-wirral",
    title: "Do I Need Structural Calculations as Well as Architectural Drawings?",
    metaTitle: "Structural Calculations vs Architectural Drawings",
    description:
      "Understand when architectural drawings may need to be supported by structural engineer calculations for extensions, lofts and alterations. General guidance for England.",
    summary:
      "Architectural drawings show the design and how the work is built; structural calculations are a structural engineer's evidence that load-bearing elements are strong enough. Many projects need both — calculations are common for beams, widened openings and loft floors. SC Design prepares and coordinates the drawings; calculations come from a structural engineer.",
    intro:
      "Homeowners often ask whether architectural drawings are 'enough', or whether they also need structural calculations. They do different jobs, and many projects need both. Here's the difference, when calculations are usually required, and how the two work together.",
    sections: [
      {
        heading: "What architectural drawings do",
        body: [
          "Architectural drawings set out the design: layout, appearance, dimensions and — at building-regulations stage — how the work is constructed, including junctions, insulation, fire safety and drainage.",
          "They tell the story of the whole project and give building control and your builder the information they need to assess and build it.",
        ],
      },
      {
        heading: "What structural calculations do",
        body: [
          "Structural calculations are specialist engineering evidence that the load-bearing parts of the work are strong enough and stable. They size beams, lintels and other members and demonstrate the structure performs safely.",
          "They're a different discipline from design drawing, which is why a structural engineer usually prepares them.",
        ],
      },
      {
        heading: "When calculations are commonly needed",
        body: [
          "Calculations are commonly required for steel or timber beams, widening or forming openings (for example removing a wall or knocking through), new loft floors, roof alterations, and changes to foundations or other significant structural work.",
          "Planning Portal guidance notes that wider openings may need beams and padstones, and that calculations may be required — so it's worth establishing early whether your project triggers them.",
        ],
      },
      {
        heading: "How drawings and calculations work together",
        body: [
          "The two are coordinated: the engineer's calculations confirm the structure, and the drawings show how it all fits into the design and construction. Building control may ask to see the calculations alongside the drawings.",
          "We prepare the architectural and building-regulations drawings and coordinate with a structural engineer so the two sets line up. We don't present ourselves as the structural engineer unless that's expressly confirmed — the calculations are the engineer's specialist work.",
        ],
      },
    ],
    faqs: [
      {
        q: "Are structural calculations part of architectural drawings?",
        a: "No — they're a separate, specialist piece of work. Architectural drawings show the design and construction; calculations are the engineer's evidence that load-bearing elements are strong enough. Many projects need both.",
      },
      {
        q: "Who provides structural calculations?",
        a: "A structural engineer. We coordinate our drawings with their calculations, but we don't claim to provide the engineering ourselves unless that's expressly agreed.",
      },
      {
        q: "When are beam calculations needed?",
        a: "Typically when you form or widen an opening, remove a load-bearing wall, or add a new loft floor — anywhere a beam carries load. The engineer sizes the beam and confirms it works.",
      },
      {
        q: "Can building control ask for calculations?",
        a: "Yes. For structural work, building control commonly expects to see the calculations alongside the drawings, which is why it's best to arrange them early.",
      },
    ],
    officialSources: [
      {
        label: "Planning Portal — Building regulations for extensions",
        href: "https://www.planningportal.co.uk/permission/common-projects/extensions/is-building-regulations-approval-needed-for-an-extension/",
      },
      {
        label: "Planning Portal — Loft conversion building regulations: stairs",
        href: "https://www.planningportal.co.uk/permission/common-projects/loft-conversion/building-regulations-stairs/",
      },
      {
        label: "GOV.UK — Building regulations approval",
        href: "https://www.gov.uk/building-regulations-approval",
      },
    ],
    related: [
      "/services/building-regulations-drawings-wirral",
      "/services/house-extensions",
      "/services/loft-conversions",
      "/guides/after-planning-permission-next-steps",
      "/guides/full-plans-vs-building-notice-wirral",
      "/contact",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "loft-conversion-stairs-head-height-fire-safety",
    navLabel: "Loft stairs, head height & fire",
    category: "building-regs",
    ctaService: "/services/loft-conversions",
    title: "Loft Conversion Stairs, Head Height, Fire Safety and Building Regulations",
    metaTitle: "Loft Conversion Stairs, Head Height & Fire Safety",
    description:
      "Key loft conversion design issues for homeowners, including stairs, head height, fire safety, structure and building regulations. General guidance for England.",
    summary:
      "Whether a loft conversion works often comes down to a few design constraints: fitting a proper staircase, keeping usable head height, and meeting fire-safety requirements. Habitable loft conversions always need building-regulations approval, and a structural engineer is usually needed for the new floor. SC Design assesses whether a layout can work and prepares the drawings.",
    intro:
      "A loft conversion can be the best-value space in the house — or a frustrating non-starter — and the difference is usually decided early by a handful of design constraints. Before drawings, it helps to understand the staircase, head height and fire-safety issues that shape what's possible. (This goes deeper than our general loft building-regs guide.)",
    sections: [
      {
        heading: "Why the staircase is often the first design problem",
        body: [
          "A habitable loft conversion needs a proper, compliant staircase — retractable ladders or fold-down stairs are not normally acceptable. Where space is tight, a 'space-saving' stair may be possible, but it has to be worked out carefully.",
          "Because the new stair usually lands in a room or landing below, its position ripples through the whole layout. That's why we resolve the staircase first, not last.",
        ],
      },
      {
        heading: "Head height and usable floor area",
        body: [
          "The usable part of a loft is where there's enough height to stand and move comfortably, which is governed by the roof shape and the new floor build-up. A steeper roof generally gives more usable space than a shallow one.",
          "Head height over the staircase is a particular pinch point. Getting it right early avoids designing a room that technically exists but doesn't really work.",
        ],
      },
      {
        heading: "Fire safety and the escape route",
        body: [
          "Fire safety is where loft layouts most often live or die, because the escape route usually has to run down a protected stairway to a final exit. That single requirement dictates where the new stair can land and what it can open onto — so it directly shapes the floor plan, not just the safety detail.",
          "The general requirements (fire doors, alarms and any upgrades) are covered in our loft conversion building regulations guide. The design point here is that the escape route is worked out first, because the staircase and the rooms around it have to follow it.",
        ],
      },
      {
        heading: "Roof form, and when planning applies",
        body: [
          "Roof form is the other big lever on whether a layout works. A dormer adds standing space and head height where you need it; rooflights keep the existing roofline but add less usable height; and a hip-to-gable change can open up a whole side of the loft. Each affects head height, light and the planning position differently.",
          "New floor structure and a structural engineer's calculations are part of the picture too — our loft conversion building regulations guide covers those basics. Many loft conversions are permitted development if the limits and conditions are met and rights haven't been removed, but habitable conversions always need building-regulations approval. We assess whether the layout can work and prepare the drawings.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I use a loft ladder for a habitable loft conversion?",
        a: "Not normally. A habitable loft conversion needs a proper fixed staircase; retractable ladders and fold-down stairs aren't usually acceptable. Where space is tight, a space-saving stair may be an option.",
      },
      {
        q: "Why does the staircase affect the whole layout?",
        a: "Because the stair has to land somewhere below and needs head height over it, its position drives the rooms around it — both upstairs and on the floor below. Resolving it first avoids reworking the design later.",
      },
      {
        q: "Is there a minimum head height for a loft conversion?",
        a: "There's no single fixed figure in the regulations, but you need enough usable height to stand and move comfortably — and, critically, enough head height over the new staircase. The roof shape largely decides how much usable space you get, so it's worth checking early.",
      },
      {
        q: "Do loft conversions need fire doors?",
        a: "Often, yes. Depending on the property, fire doors to rooms off the stairs, a protected stairway and interlinked smoke alarms may be required. The exact requirements depend on your home, so they're confirmed case by case.",
      },
    ],
    officialSources: [
      {
        label: "Planning Portal — Loft conversion building regulations: stairs",
        href: "https://www.planningportal.co.uk/permission/common-projects/loft-conversion/building-regulations-stairs/",
      },
      {
        label: "Planning Portal — Loft conversion building regulations: fire safety",
        href: "https://www.planningportal.co.uk/permission/common-projects/loft-conversion/building-regulations-fire-safety/",
      },
      {
        label: "Planning Portal — Is building regulations approval needed for a loft conversion?",
        href: "https://www.planningportal.co.uk/permission/common-projects/loft-conversion/is-building-regulations-approval-needed-for-a-loft-conversion/",
      },
      {
        label: "GOV.UK — Building regulations approval",
        href: "https://www.gov.uk/building-regulations-approval",
      },
    ],
    related: [
      "/services/loft-conversions",
      "/services/building-regulations-drawings-wirral",
      "/guides/loft-conversion-building-regulations",
      "/guides/structural-calculations-vs-architectural-drawings",
      "/contact",
    ],
    reviewed: "June 2026",
  },

  /* ================= BATCH 2 — PLANNING & APPLICATIONS ================= */
  {
    slug: "wirral-householder-planning-application-drawings-checklist",
    navLabel: "Planning application drawings",
    category: "planning",
    ctaService: "/services/planning-drawings-wirral",
    title: "What Drawings Do I Need for a Wirral Householder Planning Application?",
    metaTitle: "Wirral Householder Planning Application Drawings Checklist",
    description:
      "A practical guide to the drawings and documents Wirral homeowners may need for a householder planning application, including validation risks.",
    summary:
      "A householder planning application has to be 'valid' before the council will consider it. That usually means the right form, ownership certificate and fee, a correct location plan, and clear existing and proposed drawings. Missing or inaccurate drawings are a common cause of delay. SC Design prepares the drawings; Wirral validates and decides the application.",
    intro:
      "If you're applying for planning permission for an extension or alteration, the council first checks your application is complete — 'validation' — before the clock on a decision really starts. Getting the drawings and documents right first time avoids weeks of avoidable delay. Here's what a Wirral householder application typically needs.",
    sections: [
      {
        heading: "What is a householder planning application?",
        body: [
          "A householder application is the route for most home improvements that need permission — extensions, some alterations, and similar works to a single house (not flats). Wirral checks each application against national requirements and its own local validation checklist.",
          "If important information is missing, Wirral cannot register the application as valid — so completeness matters as much as the design.",
        ],
      },
      {
        heading: "Core documents Wirral expects",
        body: [
          "Typically you'll need the correct application form, a signed ownership certificate, the fee, a location plan, and the other plans required for your proposal.",
          "The exact list depends on the project, which is why it's worth checking the validation checklist before submitting rather than after.",
        ],
      },
      {
        heading: "Location plan, red lines and blue lines",
        body: [
          "A location plan identifies the site on an up-to-date map at a recognised scale, with the application site outlined in red. If you own other nearby land, that is usually outlined in blue.",
          "Getting the scale, extent and red/blue lines right is a small detail that often trips applications up.",
        ],
      },
      {
        heading: "Existing and proposed drawings (and common mistakes)",
        body: [
          "Householder applications usually need existing and proposed drawings — floor plans and elevations that show the property as it is and as you intend it to be. They let the council assess size, appearance and the effect on neighbours.",
          "Common causes of delay are an incorrect location plan, missing existing or proposed drawings, inconsistent measurements, and a description that doesn't match the drawings. We prepare clear, consistent drawings to reduce those validation hold-ups — though the council always validates and decides.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I submit my own drawings?",
        a: "You can, but they must meet the council's requirements to be valid — correct scale, consistent measurements and the right set of plans. Inaccurate or incomplete drawings are a common reason applications stall at validation.",
      },
      {
        q: "What scale do planning drawings need to be?",
        a: "Plans are drawn to recognised scales, and the location plan must be at an appropriate scale on an up-to-date map. We prepare drawings to the expected standards; confirm any specific requirement with Wirral.",
      },
      {
        q: "What is a red line on a location plan?",
        a: "It's the outline of your application site on the location plan. Any other nearby land you own is usually outlined in blue. Getting these right is part of a valid submission.",
      },
      {
        q: "What happens if drawings are missing?",
        a: "Wirral can't register the application as valid, so it isn't formally considered until the missing information is provided. Clear, complete drawings up front avoid that delay.",
      },
    ],
    officialSources: [
      {
        label: "Wirral Council — Planning application forms and checklists",
        href: "https://www.wirral.gov.uk/planning-and-building/planning/planning-application-forms-and-checklists",
      },
      {
        label: "Wirral Council — Things to check before applying for planning permission",
        href: "https://www.wirral.gov.uk/planning-and-building/planning/apply-planning-permission/things-check-applying-planning-permission",
      },
      { label: "Planning Portal", href: "https://www.planningportal.co.uk/" },
    ],
    related: [
      "/services/planning-drawings-wirral",
      "/services/house-extensions",
      "/services/loft-conversions",
      "/guides/do-i-need-planning-permission-for-an-extension",
      "/guides/how-long-does-planning-permission-take-wirral",
      "/contact",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "invalid-planning-application-drawings-wirral",
    navLabel: "Invalid planning application",
    category: "planning",
    ctaService: "/services/planning-drawings-wirral",
    title: "Why Was My Planning Application Marked Invalid? Common Drawing and Validation Problems",
    metaTitle: "Invalid Planning Application Wirral | Drawing & Validation Problems",
    description:
      "Common reasons a Wirral planning application may be marked invalid, including missing drawings, location plan issues and validation checklist problems.",
    summary:
      "'Invalid' is not the same as 'refused' — it means the application isn't yet complete enough to be registered and considered. Common causes are an incorrect location plan, missing existing or proposed drawings, an unclear description, or a missing ownership certificate. Clear, consistent drawings reduce avoidable delay, but no one can promise to rescue every application.",
    intro:
      "Finding out your planning application has been marked 'invalid' is frustrating, but it's usually fixable — and it's different from a refusal. It means the council can't yet register and consider it. Here are the common reasons, especially the drawing-related ones, and how to put them right.",
    sections: [
      {
        heading: "What 'invalid' actually means",
        body: [
          "Validation is the completeness check that happens before the formal decision period begins. If important information is missing, Wirral can't register the application as valid — so it simply isn't considered yet.",
          "That's good news in one sense: invalid is a paperwork problem, not a judgement on your design. It's usually correctable.",
        ],
      },
      {
        heading: "Why validation matters",
        body: [
          "The decision clock (the target for a decision) starts at validation, not when you press submit. An application stuck at validation isn't progressing at all.",
          "There can be a cost too: Wirral may retain a portion of the fee (commonly cited as around 10%) if an invalid application isn't corrected in time and has to be returned — so it pays to get it right.",
        ],
      },
      {
        heading: "Common drawing and document problems",
        body: [
          "On the drawings side, the usual culprits are an incorrect or wrongly-scaled location plan, missing existing or proposed drawings, inconsistent measurements between drawings, and a description that doesn't match what's drawn.",
          "On the paperwork side, a missing or unsigned ownership certificate or missing items from the local validation list are common. Each is avoidable with a careful, complete submission.",
        ],
      },
      {
        heading: "What to do if Wirral asks for more information",
        body: [
          "If the council asks for revised or additional drawings, respond promptly and precisely — partial fixes can mean another round of delay. Make sure the resubmitted drawings are internally consistent and match the description.",
          "We can help prepare corrected drawings clearly, which reduces avoidable delay — though we can't promise any particular outcome, and some applications raise genuine planning issues that drawings alone won't resolve.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does invalid mean refused?",
        a: "No. Invalid means the application isn't complete enough to be registered and considered yet — it's a paperwork issue, usually fixable. Refused means it was considered and turned down.",
      },
      {
        q: "Does the 8-week decision period start before validation?",
        a: "No — the decision target starts once the application is validated, not when you submit it. An application stuck at validation isn't progressing.",
      },
      {
        q: "Can I correct an invalid application?",
        a: "Usually yes, by providing the missing or corrected information promptly. Bear in mind a portion of the fee may be retained if it isn't corrected in time and has to be returned.",
      },
      {
        q: "Can SC Design help if Wirral asks for revised drawings?",
        a: "Yes — we can prepare clear, consistent corrected drawings to address validation queries. We can't guarantee an outcome, but good drawings remove avoidable delay.",
      },
    ],
    officialSources: [
      {
        label: "Wirral Council — Planning application forms and checklists",
        href: "https://www.wirral.gov.uk/planning-and-building/planning/planning-application-forms-and-checklists",
      },
      {
        label: "Wirral Council — Things to check before applying for planning permission",
        href: "https://www.wirral.gov.uk/planning-and-building/planning/apply-planning-permission/things-check-applying-planning-permission",
      },
      { label: "Planning Portal", href: "https://www.planningportal.co.uk/" },
    ],
    related: [
      "/services/planning-drawings-wirral",
      "/guides/wirral-householder-planning-application-drawings-checklist",
      "/guides/how-long-does-planning-permission-take-wirral",
      "/guides/planning-drawings-vs-building-regulations-drawings",
      "/contact",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "planning-permission-vs-lawful-development-certificate",
    navLabel: "Planning vs LDC",
    category: "pd-ldc",
    ctaService: "/services/planning-drawings-wirral",
    title: "Planning Permission vs Lawful Development Certificate: Which One Do I Need?",
    metaTitle: "Planning Permission vs Lawful Development Certificate",
    description:
      "Understand the difference between planning permission and a lawful development certificate, and which route may suit your home project.",
    summary:
      "Planning permission grants the right to do something that needs consent. A Lawful Development Certificate (LDC) confirms your works don't need consent — usually because they're permitted development. They answer opposite ends of the same question. Either way, building regulations may still apply. SC Design prepares the drawings; the council makes the formal decision.",
    intro:
      "Two routes often get confused: full planning permission and a Lawful Development Certificate. They're not alternatives to be picked freely — which one applies depends on whether your project needs consent in the first place. Here's the difference, and how to tell which fits.",
    sections: [
      {
        heading: "What planning permission is for",
        body: [
          "Planning permission is consent for development that the planning system requires approval for. You apply, the council assesses the proposal on its merits, and it grants or refuses (sometimes with conditions).",
          "If your project goes beyond permitted development — for example a larger or two-storey extension, or where rights are restricted — this is usually the route.",
        ],
      },
      {
        heading: "What a Lawful Development Certificate is for",
        body: [
          "An LDC is a formal council decision confirming that an existing or proposed development is lawful for planning purposes — most often because it's permitted development and doesn't need permission. It's evidence and legal certainty, not permission.",
          "GOV.UK distinguishes between a proposed LDC (for works not yet carried out) and an existing LDC (for works already done or a current use).",
        ],
      },
      {
        heading: "Proposed vs existing LDC — an important caveat",
        body: [
          "A proposed LDC confirms that what you describe would be lawful. Crucially, it only protects works carried out exactly as described, and it can be affected by a relevant material change before the work begins — so the works must match the certificate.",
          "An existing LDC deals with works already completed or an established use, and relies on clear evidence. Which is right depends on your situation.",
        ],
      },
      {
        heading: "When each is the safer choice — and building regs still matter",
        body: [
          "An LDC is useful when you're relying on permitted development and want documented certainty (handy for a future sale or remortgage). Full planning permission is the safer route when the project clearly needs consent, or where there's genuine doubt about whether it's permitted development.",
          "Either way, building regulations are separate and may still be required. We can prepare LDC or planning drawings and help you understand the likely route — but the formal decision rests with the council.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is an LDC the same as planning permission?",
        a: "No — and which one you need depends on whether your works require consent at all. If they do, that's planning permission; if they don't (usually because they're permitted development), an LDC is how you prove it.",
      },
      {
        q: "Is an LDC compulsory?",
        a: "No — it's optional. Many homeowners get one for certainty when relying on permitted development, especially with a future sale in mind, but it isn't required.",
      },
      {
        q: "Do I still need building regulations if I get an LDC?",
        a: "Quite possibly. An LDC only concerns the planning position; building regulations are separate and apply to most building work regardless.",
      },
      {
        q: "Can an LDC help when selling the house?",
        a: "Yes — it gives a buyer's solicitor documented proof that the works were lawful, which can make a sale smoother than relying on 'we think it was permitted development'.",
      },
    ],
    officialSources: [
      {
        label: "GOV.UK — Lawful development certificates",
        href: "https://www.gov.uk/guidance/lawful-development-certificates",
      },
      {
        label: "GOV.UK — Planning permission",
        href: "https://www.gov.uk/planning-permission-england-wales",
      },
      { label: "Planning Portal", href: "https://www.planningportal.co.uk/" },
    ],
    related: [
      "/services/planning-drawings-wirral",
      "/services/planning-drawings-wirral",
      "/services/planning-drawings-wirral",
      "/guides/lawful-development-certificate-explained",
      "/guides/permitted-development-rights-wirral",
      "/contact",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "change-extension-design-after-planning-permission",
    navLabel: "Changing design after approval",
    category: "planning",
    ctaService: "/services/planning-drawings-wirral",
    title: "Can I Change My Extension Design After Planning Permission?",
    metaTitle: "Changing Extension Design After Planning Permission",
    description:
      "What homeowners should know before changing an approved extension design, including non-material amendments and updated drawings.",
    summary:
      "Once you have planning permission, the work should generally follow the approved drawings and conditions. Small changes may be handled through a non-material amendment; bigger ones may need a fresh application. Whether a change counts as 'non-material' is the council's judgement. Don't just build something different — check first. SC Design prepares the updated drawings.",
    intro:
      "It's common to want a tweak after permission is granted — a different window, a rooflight, a change of materials, or a slightly different size. Some changes are straightforward to handle; others aren't. Here's how to change an approved design without undermining your permission.",
    sections: [
      {
        heading: "Why the approved drawings matter",
        body: [
          "Planning permission is granted for the specific scheme shown on the approved drawings, subject to any conditions. Building something materially different can put you outside your permission, which causes problems later — including when you sell.",
          "So the starting point is simple: the build should follow what was approved, unless a change is properly handled.",
        ],
      },
      {
        heading: "What a non-material amendment is",
        body: [
          "A non-material amendment is a route for minor changes that don't conflict with the permission or its conditions. Planning Portal notes these applications may require revised drawings and details of exactly what's changing.",
          "There's no statutory definition of 'non-material' — it's for the local planning authority to be satisfied a change is minor. Decisions should usually be made within 28 days of a valid application.",
        ],
      },
      {
        heading: "Examples that usually need checking",
        body: [
          "Changes people often ask about include moving or resizing a window, adding a rooflight, swapping materials, or small dimensional changes. Whether each is 'non-material' depends entirely on the specific permission — a change that's minor on one scheme can be material on another.",
          "Listed building consent, where it applies, can't be altered through the non-material amendment route, so listed properties need particular care.",
        ],
      },
      {
        heading: "When a new application is needed — and how we help",
        body: [
          "If a change isn't minor, a non-material amendment won't cover it and a new or different application may be required. The honest answer is often 'it depends', so it's worth checking before building rather than after.",
          "We prepare the updated drawings and clearly set out what's changed, which is exactly what an amendment or fresh application needs. We won't advise anyone to just build something different and hope.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I move a window after planning permission?",
        a: "Sometimes, via a non-material amendment — but it depends on the specific permission and the council's judgement. Check before building; don't assume a change is automatically fine.",
      },
      {
        q: "What is a non-material amendment?",
        a: "A route for minor changes that don't conflict with the permission or its conditions. It may need revised drawings and a description of the differences, and decisions are usually made within about 28 days.",
      },
      {
        q: "Who decides if a change is non-material?",
        a: "The local planning authority. There's no fixed legal definition, so the same change can be treated differently on different schemes.",
      },
      {
        q: "Do I need updated drawings?",
        a: "Usually yes — an amendment or new application needs drawings showing the change and details of what differs from the approved scheme. We prepare those for you.",
      },
    ],
    officialSources: [
      {
        label: "Planning Portal — Non-material amendment of an existing planning permission",
        href: "https://www.planningportal.co.uk/planning/planning-applications/consent-types/non-material-amendment-of-an-existing-planning-permission/",
      },
      {
        label: "GOV.UK — Appeal against a planning decision",
        href: "https://www.gov.uk/appeal-planning-decision",
      },
      {
        label: "Wirral Council — Planning and building",
        href: "https://www.wirral.gov.uk/planning-and-building",
      },
    ],
    related: [
      "/services/planning-drawings-wirral",
      "/services/house-extensions",
      "/guides/after-planning-permission-next-steps",
      "/guides/wirral-householder-planning-application-drawings-checklist",
      "/contact",
    ],
    reviewed: "June 2026",
  },

  /* ================= BATCH 3 — PROJECT-SPECIFIC ================= */
  {
    slug: "garage-conversion-planning-building-regulations-wirral",
    navLabel: "Garage conversion rules",
    category: "project",
    ctaService: "/services/garage-conversion-drawings-wirral",
    title: "Garage Conversion Planning Permission and Building Regulations in Wirral",
    metaTitle: "Garage Conversion Planning Permission & Building Regs Wirral",
    description:
      "A homeowner guide to garage conversion planning permission, permitted development checks and building regulations approval in Wirral.",
    summary:
      "Converting an integral garage into a usable room is often possible without planning permission when the work is internal and doesn't enlarge the building — but permitted development rights are sometimes removed, and conservation areas or listed status change things. Building regulations almost always apply to habitable space. SC Design prepares the design and drawings only.",
    intro:
      "A garage that's become a dumping ground is one of the easiest wins in a home — turning it into a study, playroom or extra bedroom. The good news is many garage conversions are relatively straightforward; the important part is checking the planning position and getting building regulations right. Here's what Wirral homeowners should know.",
    sections: [
      {
        heading: "Does a garage conversion usually need planning permission?",
        body: [
          "Planning permission is not usually required where the conversion is internal and doesn't enlarge the building — you're changing how existing space is used, not extending. Many integral garage conversions fall into this category.",
          "That's the general position, not a guarantee for your home, so the specifics always need confirming for your address.",
        ],
      },
      {
        heading: "When planning permission may be needed",
        body: [
          "Permission is more likely if you're creating a separate dwelling (for example a self-contained annexe or flat), which is a material change of use. It can also be needed where permitted development rights have been removed — common on some newer housing developments and in conservation areas.",
          "Listed buildings may need listed building consent, and any parking conditions attached to the property can be relevant. Where rights have been removed, contact the council before proceeding.",
        ],
      },
      {
        heading: "Why building regulations usually apply",
        body: [
          "Converting a garage, or part of one, into habitable space will normally require building-regulations approval. A garage isn't built to the standards of a living space, so the conversion has to bring it up to scratch.",
          "Typical areas include the foundations and the new wall where the garage door is in-filled, a damp-proof membrane and thermal insulation, ventilation, drainage, electrics, fire safety, and the floor, walls and roof.",
        ],
      },
      {
        heading: "What drawings help — and what SC Design provides",
        body: [
          "Useful drawings usually include existing and proposed plans, and building-regulations drawings showing how the new room meets the standards. Where the work is structural, a structural engineer's input may be needed.",
          "We prepare the design and drawings for your garage conversion — we don't carry out the building work itself. That keeps our advice focused on getting the design and the approvals right.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does a garage conversion need planning permission?",
        a: "Often not, when the work is internal and doesn't enlarge the building. But permission may be needed for a separate dwelling, or where permitted development rights have been removed — confirm for your specific property.",
      },
      {
        q: "Does a garage conversion need building regulations?",
        a: "Converting a garage into habitable space normally requires building-regulations approval, covering insulation, ventilation, drainage, electrics, fire safety and the new wall and floor.",
      },
      {
        q: "Can I convert a garage in a conservation area?",
        a: "Often yes, but permitted development rights are more likely to be restricted, so a planning application may be needed and the design handled sensitively. Check the position for your address with Wirral Council.",
      },
      {
        q: "Do I need drawings for a garage conversion?",
        a: "Yes — existing and proposed plans plus building-regulations drawings help the work get approved and built correctly, and give a builder a clearer basis to price from. We prepare these for you.",
      },
    ],
    officialSources: [
      {
        label: "Planning Portal — Garage conversion: planning permission",
        href: "https://www.planningportal.co.uk/permission/common-projects/garage-conversion/planning-permission/",
      },
      {
        label: "Planning Portal — Garage conversion: building regulations",
        href: "https://www.planningportal.co.uk/permission/common-projects/garage-conversion/building-regulations/",
      },
      {
        label: "GOV.UK — Building regulations approval",
        href: "https://www.gov.uk/building-regulations-approval",
      },
    ],
    related: [
      "/services/garage-conversion-drawings-wirral",
      "/services/building-regulations-drawings-wirral",
      "/services/planning-drawings-wirral",
      "/guides/do-i-need-building-regulations-approval",
      "/guides/full-plans-vs-building-notice-wirral",
      "/contact",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "rear-side-wraparound-extension-planning-rules",
    navLabel: "Rear, side & wraparound rules",
    category: "project",
    ctaService: "/services/house-extensions",
    title: "Rear, Side and Wraparound Extensions: Why the Position of the Extension Changes the Planning Route",
    metaTitle: "Rear, Side & Wraparound Extension Planning Rules",
    description:
      "Why rear, side and wraparound extensions can follow different planning routes, and what homeowners should check before drawings.",
    summary:
      "Where an extension sits — rear, side, two-storey or wraparound — changes the planning rules that apply. Position, height, projection, materials, your property type, designated land and any previous extensions all matter. There's no honest yes/no without checking the specific property. SC Design checks the likely route and prepares the drawings.",
    intro:
      "Two extensions of the same size can follow completely different planning routes simply because of where they sit on the house. Rear, side and wraparound extensions are treated differently, which is why a blanket 'yes, that's permitted development' is rarely safe. Here's how position shapes the route.",
    sections: [
      {
        heading: "Why position matters so much",
        body: [
          "Whether an extension is permitted development depends on a combination of factors: its type and position, height and projection, the materials, whether the property is on designated land, any previous extensions, and the type of property.",
          "Position is one of the biggest levers — the rules are far more generous at the rear than the side or front — which is why the same footprint can be permitted development in one spot and need an application in another.",
        ],
      },
      {
        heading: "Rear, side and wraparound",
        body: [
          "Single-storey rear extensions often have the most headroom under permitted development, within set depth, height and other limits. Side extensions are more tightly controlled — there are stricter width and height limits, and extra care is needed on designated land.",
          "A wraparound extension combines rear and side, so it frequently goes beyond permitted development limits and needs a full planning application. Two-storey extensions have their own, stricter set of conditions again.",
        ],
      },
      {
        heading: "Property type, conservation areas and previous extensions",
        body: [
          "Flats and maisonettes don't have the same householder permitted development rights as houses, so the route is different from the outset. Conservation areas and Article 4 directions reduce or remove rights and call for sensitive design.",
          "Previous extensions count too — earlier additions can use up the 'allowance', so what would have been permitted development on the original house may not be now. All of this has to be checked for your specific property.",
        ],
      },
      {
        heading: "How SC Design helps",
        body: [
          "Rather than guess, we look at your property, its position and history, and advise on the likely route — permitted development, a Lawful Development Certificate, or a full application — then prepare the drawings to suit.",
          "We won't give a yes/no answer without checking the specifics, because that's how people end up building the wrong thing. The definitive position always rests with Wirral Council.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is a rear extension always permitted development?",
        a: "No. Rear extensions often have the most generous permitted development limits, but only within set depth and height conditions — and rights can be reduced by your property type, designated land or previous extensions.",
      },
      {
        q: "Do side extensions have different rules?",
        a: "Yes — side extensions are more tightly controlled than rear ones, with stricter width and height limits, and extra care is needed on designated land such as conservation areas.",
      },
      {
        q: "Are wraparound extensions harder to approve?",
        a: "They combine rear and side, so they often exceed permitted development limits and need a full planning application. They're very achievable, but usually via the application route with a considered design.",
      },
      {
        q: "Do conservation areas change the rules?",
        a: "Yes — conservation areas and Article 4 directions reduce or remove permitted development rights and call for a more sensitive design. Confirm the position for your address with Wirral Council.",
      },
    ],
    officialSources: [
      {
        label: "Planning Portal — Extensions: planning permission",
        href: "https://www.planningportal.co.uk/permission/common-projects/extensions/planning-permission/",
      },
      {
        label: "Wirral Council — Article 4 directions",
        href: "https://www.wirral.gov.uk/planning-and-building/built-conservation/article-4-directions",
      },
      {
        label: "Wirral Council — Conservation areas",
        href: "https://www.wirral.gov.uk/planning-and-building/built-conservation/conservation-areas",
      },
    ],
    related: [
      "/services/house-extensions",
      "/services/planning-drawings-wirral",
      "/services/planning-drawings-wirral",
      "/guides/do-i-need-planning-permission-for-an-extension",
      "/guides/permitted-development-rights-wirral",
      "/contact",
    ],
    reviewed: "June 2026",
  },

  /* ============= BATCH 4 — COSTS/PROCESS + LOCAL CHECKS ============= */
  {
    slug: "builder-quote-drawing-pack-checklist",
    navLabel: "Builder quote pack checklist",
    category: "cost-process",
    ctaService: "/services/building-regulations-drawings-wirral",
    title: "Builder Quote Drawing Pack Checklist",
    metaTitle: "Builder Quote Drawing Pack Checklist",
    description:
      "A practical checklist for homeowners who want builders to quote from the same clear drawings, specifications and assumptions.",
    summary:
      "If every builder prices a different version of your project, the quotes can't be compared. This is a practical checklist for putting together a drawing pack so several builders quote the same defined scope — and the build matches what you agreed. It won't fix a price, but it removes the guesswork that makes quotes drift.",
    intro:
      "This is a hands-on checklist, not another explainer — use it to gather everything builders need before you ask them to quote. The aim is simple: give every builder the same clear information so their prices are genuinely comparable, and so the finished work matches what you signed off. (For the 'why', see our guide on what drawings builders need.)",
    sections: [
      {
        heading: "Before you ask builders to quote",
        body: [
          "Get your drawings and key decisions to a settled point first. Quoting from a rough sketch invites assumptions, and assumptions are where prices diverge — and where disputes start once work is under way.",
          "Aim to hand each builder an identical pack and ask them to price the same scope. Work through the checklist below and fill the gaps before you send anything out.",
        ],
      },
      {
        heading: "Your drawing-pack checklist",
        body: [
          "Tick off each item you can provide. The more of these a builder has, the tighter and more comparable the quote.",
        ],
        table: {
          caption: "A practical pack to gather before requesting quotes.",
          headers: ["Include in your pack", "Why it matters"],
          rows: [
            ["Existing plans and elevations", "Shows the starting point accurately"],
            ["Proposed plans and elevations", "Defines exactly what's being built"],
            ["Sections where needed", "Clarifies heights, levels and construction"],
            ["Building-regulations details (where available)", "Sets the construction standard being priced"],
            ["Structural engineer drawings/calculations (where needed)", "Removes risk around beams and openings"],
            ["Specification notes", "Pins down quality and materials"],
            ["Drainage and utility assumptions (if relevant)", "Avoids a common source of extra cost"],
            ["Windows and doors scope", "A big cost item that's easy to leave vague"],
            ["Insulation, roof, floor and wall assumptions", "Stops builders pricing different build-ups"],
            ["Fixtures and finishes exclusions", "Makes clear what's not in the builder's price"],
            ["Planning decision notice and conditions (if approved)", "Confirms what's actually permitted"],
            ["Site constraints (access, parking, neighbours)", "Affects programme and cost"],
          ],
        },
      },
      {
        heading: "Questions to ask each builder — and red flags",
        body: [
          "Ask each builder the same questions: what's included and excluded, how they handle changes (variations), what their programme looks like, whether the price is fixed or an estimate, and how stage payments work. Asking everyone the same things keeps the comparison fair.",
          "Be wary of red flags: a quote far lower than the others (often because something's been left out), a price with no breakdown, reluctance to work to your drawings, or pressure to start immediately. A clear pack makes these easier to spot.",
        ],
      },
      {
        heading: "Comparing the quotes",
        body: [
          "Line the quotes up against the same headings rather than just comparing bottom-line totals — the cheapest number isn't always the cheapest job.",
        ],
        table: {
          headers: ["What to compare", "Good sign", "Watch out for"],
          rows: [
            ["Scope priced", "Matches your drawing pack", "Vague 'allowances' for big items"],
            ["Breakdown", "Itemised by element", "A single lump sum only"],
            ["Exclusions", "Clearly listed", "Not stated — gaps appear later"],
            ["Price basis", "Fixed against the drawings", "Open-ended 'estimate' that can move"],
          ],
        },
      },
      {
        heading: "How SC Design can help",
        body: [
          "We prepare the drawing pack builders quote from — clear existing and proposed drawings, building-regulations drawings, and coordination with a structural engineer where needed.",
          "We don't set builders' prices or carry out the work, and we won't promise a fixed cost — but a clear, complete pack is the single best way to get comparable quotes and keep control on site.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can builders quote from planning drawings only?",
        a: "They can, but planning drawings don't show how the work is built, so the price will rely on assumptions. Building-regulations drawings and a specification give a far more accurate, comparable quote.",
      },
      {
        q: "Why are builder quotes so different?",
        a: "Usually because each builder is pricing a slightly different job — different specs, structure and finishes filled in by assumption. A shared drawing pack removes the guesswork so prices reflect the same scope.",
      },
      {
        q: "Should I give every builder the same drawing pack?",
        a: "Yes — it's the whole point. Identical information means genuinely comparable quotes, rather than numbers that can't be lined up against each other.",
      },
      {
        q: "Should structural calculations be included?",
        a: "Where the project has beams or openings, yes — including the engineer's calculations removes a big area of pricing risk and avoids surprises once work starts.",
      },
    ],
    officialSources: [
      {
        label: "GOV.UK — Building regulations approval",
        href: "https://www.gov.uk/building-regulations-approval",
      },
      {
        label: "Wirral Council — Full Plans applications",
        href: "https://www.wirral.gov.uk/planning-and-building/building-control/types-applications/full-plans-applications",
      },
    ],
    related: [
      "/guides/what-drawings-do-builders-need",
      "/services/building-regulations-drawings-wirral",
      "/services/house-extensions",
      "/services/loft-conversions",
      "/process",
      "/contact",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "how-to-brief-architectural-designer-extension",
    navLabel: "How to brief a designer",
    category: "cost-process",
    title: "How to Brief an Architectural Designer for a House Extension",
    metaTitle: "How to Brief an Architectural Designer for an Extension",
    description:
      "What to send before speaking to an architectural designer about a house extension, including photos, postcode, aims, budget and drawings.",
    summary:
      "You don't need finished drawings or a perfect brief to get started — a few photos, your postcode and a short description of what you'd like to achieve are plenty for a first conversation. This guide sets out exactly what helps Sean give you an honest first view, and what you genuinely don't need to worry about yet.",
    intro:
      "Plenty of homeowners put off making contact because they think they need everything worked out first. You don't. The most useful thing you can do is share a clear picture of your home and what you'd like to change — the design thinking is our job. Here's how to make that first message count.",
    sections: [
      {
        heading: "You don't need everything worked out first",
        body: [
          "A common worry is needing drawings, measurements or a fixed budget before getting in touch. You don't — a rough idea and a few photos are enough to start a useful conversation.",
          "Our job is to turn that rough idea into a clear, realistic design, so don't let 'it's not ready' hold you back.",
        ],
      },
      {
        heading: "What to include in your first message",
        body: [
          "The items below help Sean give you an honest first view quickly. Share what you have — none of it needs to be perfect or complete.",
        ],
        table: {
          caption: "Helpful to include — but don't wait until you have everything.",
          headers: ["What to share", "Why it helps"],
          rows: [
            ["Property postcode", "Lets us check the local planning context"],
            ["Photos inside and outside", "Shows the space and the opportunities"],
            ["What you want to achieve", "The goal matters more than the solution"],
            ["Project type (extension, loft, etc.)", "Frames the likely route"],
            ["Project stage", "Tells us how far along you are"],
            ["Whether you already have a builder", "Affects what drawings you'll need"],
            ["Rough timescale", "Helps us plan around your plans"],
            ["Rough budget (only if comfortable)", "Keeps the design realistic"],
            ["Estate-agent floorplan or existing drawings", "A useful starting point if you have them"],
            ["Conservation area / listed / Article 4 (if known)", "Flags where extra care is needed"],
          ],
        },
      },
      {
        heading: "Photos that are most useful, and what to think about",
        body: [
          "The most helpful photos show the area you want to change from a few angles, the rooms next to it, and the outside of the house including the part you'd extend. Wide shots beat close-ups.",
          "Before a design call, it's worth thinking about how you want the space to feel and work: light, how you live day to day, storage, access, privacy and neighbours. There are no wrong answers — it just helps us design around you.",
        ],
      },
      {
        heading: "What happens next",
        body: [
          "Once you send your details, Sean takes a look and comes back with an honest first view — what's likely possible, the route it may take, and how we'd approach it. There's no obligation.",
          "From there, we turn the idea into clear drawings: concept design, then planning drawings, then building-regulations drawings as your project needs them. If it's helpful, our concept visualiser can show an illustrative idea — clearly a concept, not a final design.",
        ],
      },
    ],
    faqs: [
      {
        q: "Do I need drawings before contacting Sean?",
        a: "No. A few photos, your postcode and a short description are plenty to start. If you happen to have an estate-agent floorplan or old drawings, they're a bonus — but not required.",
      },
      {
        q: "What photos should I send?",
        a: "Wide shots of the area you want to change, the rooms next to it, and the outside of the house including where you'd extend. A few angles are more useful than lots of close-ups.",
      },
      {
        q: "Should I mention budget?",
        a: "Only if you're comfortable. Even a rough range helps keep the design realistic, but it's not essential to get an honest first view.",
      },
      {
        q: "What happens after I send the enquiry?",
        a: "Sean reviews it and comes back with an honest first view — what's likely possible and how we'd approach it — with no obligation. If it's a fit, we talk through the design.",
      },
    ],
    officialSources: [
      { label: "Planning Portal", href: "https://www.planningportal.co.uk/" },
      {
        label: "GOV.UK — Planning permission",
        href: "https://www.gov.uk/planning-permission-england-wales",
      },
    ],
    related: [
      "/process",
      "/services/house-extensions",
      "/services/residential-design",
      "/visualiser",
      "/contact",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "wirral-pre-application-advice-home-extension",
    navLabel: "Wirral pre-application advice",
    category: "local-buying",
    ctaService: "/services/building-regulations-drawings-wirral",
    title: "Do I Need Pre-Application Advice from Wirral Council?",
    metaTitle: "Wirral Pre-Application Advice for Home Extensions",
    description:
      "When Wirral Council pre-application advice may be useful for a house extension or home project, and what information is usually needed.",
    summary:
      "Pre-application advice is an optional, paid service where Wirral gives a view on your proposal before you apply. It can be worth it for sensitive, conservation-area or uncertain schemes — helping you understand policy and avoid costly amendments. For straightforward projects where the route is already clear, it may be unnecessary. It's advice, not permission.",
    intro:
      "If you're unsure whether your idea will fly, Wirral Council's pre-application advice service lets you test it before committing to a full application. It isn't free and it isn't a decision — but for the right project it can save time and money. Here's when it's worth using.",
    sections: [
      {
        heading: "What pre-application advice is",
        body: [
          "Pre-application advice is a service where the council looks at your proposal and gives a considered view before you submit a formal application. Wirral offers it for development proposals and welcomes early discussion.",
          "It can help you understand relevant policy, identify problems early, reduce costly or time-consuming amendments later, and clarify what information a future application will need.",
        ],
      },
      {
        heading: "When it can be worth using",
        body: [
          "Pre-app advice tends to earn its keep on proposals that are sensitive or uncertain — conservation-area schemes, larger or more unusual extensions, or anything where the planning position genuinely isn't clear.",
          "Getting an early steer on these can stop you investing in a design that was always going to struggle, and shape it in the right direction from the start.",
        ],
      },
      {
        heading: "When it may not be necessary",
        body: [
          "For straightforward schemes where the route is already clear — a modest extension well within the usual limits, for example — pre-application advice may simply add cost and time without changing much.",
          "We can help you judge whether your project is one where pre-app is likely to add value, or one where you can sensibly proceed straight to drawings and an application.",
        ],
      },
      {
        heading: "What Wirral asks for, and how long it takes",
        body: [
          "As a minimum, Wirral generally expects a location plan and existing and proposed drawings so it can give meaningful advice. The better the information, the more useful the response.",
          "Based on the council's current published service, Wirral aims to provide a written response within around 20 working days (longer where a site visit or meeting is included). A charge applies, and timescales and fees can change — confirm the current details with Wirral. We can prepare the early drawings and supporting information to make a pre-app enquiry worthwhile.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is pre-app advice compulsory?",
        a: "No — it's an optional service. Many straightforward projects go straight to a planning application, while sensitive or uncertain ones often benefit from early advice first.",
      },
      {
        q: "Does pre-app advice guarantee approval?",
        a: "No. It's a considered view to help shape your proposal, not a decision or a guarantee. The formal outcome still rests with a full planning application.",
      },
      {
        q: "What should I send with a pre-app enquiry?",
        a: "As a minimum, a location plan and existing and proposed drawings. We can prepare these so the council can give genuinely useful advice.",
      },
      {
        q: "How long does Wirral pre-app advice take?",
        a: "Based on the current published service, Wirral aims for a written response within around 20 working days (longer where a meeting is included). Confirm current timescales and fees with the council.",
      },
    ],
    officialSources: [
      {
        label: "Wirral Council — Pre-application advice",
        href: "https://www.wirral.gov.uk/planning-and-building/planning-permission/applying-planning-permission/pre-application-advice",
      },
      {
        label: "Wirral Council — Planning application forms and checklists",
        href: "https://www.wirral.gov.uk/planning-and-building/planning/planning-application-forms-and-checklists",
      },
      { label: "Planning Portal", href: "https://www.planningportal.co.uk/" },
    ],
    related: [
      "/services/building-regulations-drawings-wirral",
      "/services/planning-drawings-wirral",
      "/guides/do-i-need-planning-permission-for-an-extension",
      "/guides/wirral-householder-planning-application-drawings-checklist",
      "/guides/how-long-does-planning-permission-take-wirral",
      "/contact",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "check-wirral-conservation-area-map",
    navLabel: "Check the conservation map",
    category: "local-buying",
    ctaService: "/services/residential-design",
    title: "Wirral Conservation Area Map Check: How to Find Out If Your Home Is Affected",
    metaTitle: "Wirral Conservation Area Map Check for Homeowners",
    description:
      "How to check whether your Wirral home is in a conservation area and why this matters before planning an extension or alteration.",
    summary:
      "Wirral has a large number of conservation areas, and the council provides an online map you can check by address. If your home is in one, extra planning controls usually apply and design quality matters more. Being in a conservation area rarely means you can't extend — but it does mean a more careful, well-justified approach. SC Design helps with sensitive design and drawings.",
    intro:
      "Before you get too far into extension plans, it's worth a five-minute check: is your home in a conservation area? It changes what's likely to be possible and how a proposal is assessed. Here's how to check your address on Wirral's map and what to do with the answer.",
    sections: [
      {
        heading: "What a conservation area is",
        body: [
          "A conservation area is a place designated for its special architectural or historic interest, where the character and appearance are worth preserving or enhancing. Wirral has a large number of them — including nationally important examples like Port Sunlight and Hamilton Square — and the council's published list is the definitive source for your area.",
          "Designation doesn't freeze an area — but it does mean change is managed more carefully.",
        ],
      },
      {
        heading: "How to check your address on the Wirral map",
        body: [
          "Wirral Council provides an online conservation-areas resource where you can look up an address and see whether it falls within a designated area. It's the quickest way to get a reliable answer for your specific home.",
          "Because boundaries can run down the middle of a street, don't assume based on a neighbour — check your own address, and confirm anything borderline with the council.",
        ],
      },
      {
        heading: "Why it matters, and what needs more care",
        body: [
          "In a conservation area, extra planning controls usually apply and permitted development rights are often reduced — so a full application is more likely. The council pays particular attention to design, materials and the effect on the area's character.",
          "Even small changes can add up over time, so things like windows, materials, rooflights and the proportions of an extension are looked at more closely than they would be elsewhere.",
        ],
      },
      {
        heading: "What helps — and how SC Design can support you",
        body: [
          "A successful conservation-area proposal usually needs sensitive design, appropriate materials and clear drawings that justify the approach. For sensitive or uncertain schemes, pre-application advice from the council can also be worthwhile.",
          "The practical sequence for a page like this is simple: confirm the designation, understand the extra controls, then commission a design that genuinely responds to the setting. We can't guarantee approval — no one honestly can — but a considered, well-presented proposal gives your project its best chance.",
        ],
      },
    ],
    faqs: [
      {
        q: "How do I check if my Wirral home is in a conservation area?",
        a: "Use Wirral Council's online conservation-areas resource to look up your address. Check your own property rather than relying on a neighbour, as boundaries can run mid-street.",
      },
      {
        q: "Does conservation area mean I cannot extend?",
        a: "No — it rarely means you can't extend. It means the design is assessed more carefully and a full application is more likely. A sensitive, well-justified scheme is the way to approach it.",
      },
      {
        q: "Do permitted development rights still apply?",
        a: "Often they're reduced or removed in conservation areas, and an Article 4 direction can restrict them further. Confirm the position for your address with Wirral Council.",
      },
      {
        q: "Why does design quality matter more?",
        a: "Because the council assesses how a proposal affects the area's special character. Materials, proportions and detailing carry more weight, so a considered design makes a real difference.",
      },
    ],
    officialSources: [
      {
        label: "Wirral Council — Conservation areas",
        href: "https://www.wirral.gov.uk/planning-and-building/built-conservation/conservation-areas",
      },
      {
        label: "Wirral Council — Information and advice on conservation areas",
        href: "https://www.wirral.gov.uk/planning-and-building/built-conservation/information-and-advice-conservation-areas",
      },
      {
        label: "Wirral Council — Article 4 directions",
        href: "https://www.wirral.gov.uk/planning-and-building/built-conservation/article-4-directions",
      },
    ],
    related: [
      "/services/residential-design",
      "/guides/conservation-area-extensions-wirral",
      "/services/planning-drawings-wirral",
      "/guides/wirral-pre-application-advice-home-extension",
      "/contact",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "buying-house-extension-loft-conversion-certificates",
    navLabel: "Buying a home: paperwork",
    category: "local-buying",
    ctaService: "/services/building-regulations-drawings-wirral",
    title: "Buying a House with an Extension, Loft Conversion or Garage Conversion: What Paperwork Should You Ask For?",
    metaTitle: "Buying a House with an Extension or Loft Conversion",
    description:
      "A practical guide to paperwork buyers may ask about for extensions, loft conversions and garage conversions, including approvals and certificates.",
    summary:
      "If a home you're buying has been extended or converted, it's worth checking the paperwork behind that work — planning permission or a lawful development certificate, building-regulations completion certificate, and any structural or service certificates. This is general information, not legal or conveyancing advice: your solicitor is the right person to act on it. SC Design can help you understand the drawings and physical work.",
    intro:
      "An extension or loft conversion can add real value to a home you're buying — provided the work was done properly and documented. Missing paperwork isn't necessarily a deal-breaker, but it's something to understand before you commit. Here's what to ask for, with an important caveat about whose advice to rely on.",
    sections: [
      {
        heading: "Important: this isn't legal or conveyancing advice",
        body: [
          "This guide is general information to help you ask the right questions. It is not legal, conveyancing or structural advice, and it doesn't replace your solicitor or conveyancer — they are the people who should review documents and advise on the purchase.",
          "Treat the points below as a checklist to raise with your solicitor and the seller, not as a substitute for professional advice.",
        ],
      },
      {
        heading: "What paperwork to ask for",
        body: [
          "Depending on the work, useful documents include any planning permission or Lawful Development Certificate, a building-regulations approval and completion certificate, structural calculations for beams or new floors, and certificates for electrical and gas work.",
          "It's also worth asking for the approved drawings and any planning conditions, plus warranties for elements like flat roofs or windows where they exist.",
        ],
      },
      {
        heading: "Extension, loft and garage paperwork",
        body: [
          "For an extension, look for the planning position (permission or an LDC), building-regulations completion certificate and any structural calculations. For a loft conversion, building regulations almost always apply to habitable space, so a completion certificate and the fire-safety and structural details matter.",
          "For a garage conversion, habitable space normally needs building-regulations approval, so again a completion certificate is the key document to ask about.",
        ],
      },
      {
        heading: "What missing paperwork might mean — and how we help",
        body: [
          "Missing documents don't automatically mean the work is unsafe, but they can create questions on a future sale. GOV.UK notes that without building-regulations approval, a homeowner may not have the certificates of compliance a buyer's solicitor expects. Where works were lawful, an LDC can sometimes confirm the planning position, and a building-control regularisation route can exist for some situations — but those are matters to explore with the council and your solicitor, not from a guide.",
          "We can help you understand the drawings and the physical work — what was built and how — which can inform the questions you and your solicitor ask. The legal and conveyancing side stays firmly with your solicitor.",
        ],
      },
    ],
    faqs: [
      {
        q: "What certificates should I ask for?",
        a: "Typically a building-regulations completion certificate, the planning permission or lawful development certificate, structural calculations where relevant, and electrical/gas certificates. Ask your solicitor to confirm what's needed for the specific property.",
      },
      {
        q: "What if a loft conversion has no building-regs certificate?",
        a: "Raise it with your solicitor. Habitable loft conversions need building-regulations approval, so a missing completion certificate is worth understanding — there can be routes to address it, but that's a matter for the council and your conveyancer.",
      },
      {
        q: "Is missing paperwork a legal issue?",
        a: "It can affect a sale and is a question for your solicitor or conveyancer. This guide is general information to help you ask the right questions, not legal advice.",
      },
      {
        q: "Can SC Design check the drawings?",
        a: "We can help you understand the drawings and the physical work — what was built and how — to inform your questions. We don't provide legal, conveyancing or formal structural advice.",
      },
    ],
    officialSources: [
      {
        label: "GOV.UK — Building regulations approval",
        href: "https://www.gov.uk/building-regulations-approval",
      },
      {
        label: "GOV.UK — Lawful development certificates",
        href: "https://www.gov.uk/guidance/lawful-development-certificates",
      },
      { label: "Planning Portal", href: "https://www.planningportal.co.uk/" },
    ],
    related: [
      "/services/building-regulations-drawings-wirral",
      "/services/planning-drawings-wirral",
      "/services/building-regulations-drawings-wirral",
      "/guides/planning-permission-vs-lawful-development-certificate",
      "/guides/do-i-need-building-regulations-approval",
      "/contact",
    ],
    reviewed: "June 2026",
  },
];

export function getGuide(slug: string): Guide | undefined {
  return guides.find((g) => g.slug === slug);
}

/** Guide categories for the hub page grouping. */
export const guideCategories: { key: NonNullable<Guide["category"]>; label: string; blurb: string }[] =
  [
    {
      key: "planning",
      label: "Planning permission & applications",
      blurb: "When you need it, what to submit, and what changes after approval.",
    },
    {
      key: "pd-ldc",
      label: "Permitted development & lawful development",
      blurb: "Building without a full application — and proving it's lawful.",
    },
    {
      key: "building-regs",
      label: "Building regulations & building control",
      blurb: "The 'how it's built' approvals most projects need.",
    },
    {
      key: "project",
      label: "Project-specific guides",
      blurb: "Extensions, lofts, garages and conservation-area homes.",
    },
    {
      key: "cost-process",
      label: "Costs, builders & process",
      blurb: "What design costs, briefing a designer, and builder quote packs.",
    },
    {
      key: "local-buying",
      label: "Local checks & buying or selling",
      blurb: "Wirral conservation checks, pre-application advice and property paperwork.",
    },
  ];
