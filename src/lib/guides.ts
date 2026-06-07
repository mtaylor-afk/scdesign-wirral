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
  sections: { heading: string; body: string[] }[];
  faqs: { q: string; a: string }[];
  related: string[]; // related service/area/guide paths
  reviewed: string;

  /* ---- Optional rich fields (drive the v2 guide template + hub grouping) ---- */
  navLabel?: string; // short label for the nav dropdown
  category?: "planning" | "building-regs" | "cost-process" | "choosing" | "conservation";
  summary?: string; // one-paragraph "in short" box
  metaTitle?: string; // exact <title> keyword phrase (brand appended by pageMeta)
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
          "We talk through scope and fees up front, so you know what's included before you commit. Send a few photos and a description of what you'd like to do and we'll come back to you with an honest view.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can you give me a fixed price?",
        a: "Once we understand your property and what you'd like to achieve, we can set out a clear scope and fee. The honest first step is a quick chat and a few photos.",
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
    category: "choosing",
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
    category: "planning",
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
      "/services/permitted-development-wirral",
      "/services/lawful-development-certificate-wirral",
      "/guides/lawful-development-certificate-explained",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "lawful-development-certificate-explained",
    navLabel: "Lawful development certificate",
    category: "planning",
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
      "/services/lawful-development-certificate-wirral",
      "/services/permitted-development-wirral",
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
      "/services/planning-building-regulations",
      "/guides/do-i-need-planning-permission-for-an-extension",
    ],
    reviewed: "June 2026",
  },
  {
    slug: "conservation-area-extensions-wirral",
    navLabel: "Conservation area extensions",
    category: "conservation",
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
        a: "Wirral Council holds the designations and is the definitive source. Send us your postcode and we can help you check.",
      },
    ],
    related: [
      "/services/conservation-area-design-wirral",
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
];

export function getGuide(slug: string): Guide | undefined {
  return guides.find((g) => g.slug === slug);
}

/** Guide categories for the hub page grouping. */
export const guideCategories: { key: NonNullable<Guide["category"]>; label: string; blurb: string }[] =
  [
    {
      key: "planning",
      label: "Planning permission",
      blurb: "When you need it, when you don't, and how long it takes.",
    },
    {
      key: "building-regs",
      label: "Building regulations",
      blurb: "The 'how it's built' approvals most projects need.",
    },
    {
      key: "cost-process",
      label: "Costs & process",
      blurb: "What design costs, and what builders need to quote.",
    },
    {
      key: "choosing",
      label: "Choosing the right help",
      blurb: "Understanding titles and how to choose a designer.",
    },
    {
      key: "conservation",
      label: "Conservation & local",
      blurb: "Extending sensitively in Wirral's protected areas.",
    },
  ];
