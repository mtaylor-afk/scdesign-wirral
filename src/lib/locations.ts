/**
 * Location data for the /areas/[slug] pages. Each entry carries UNIQUE local
 * content — no thin duplicates. Architectural-design wording, design-only.
 *
 * tier: "core" = Wirral (prioritised), "wider" = surrounding areas genuinely
 * served. Conservation/planning claims are hedged — confirm with Wirral Council.
 */

export type Location = {
  slug: string;
  name: string;
  intro: string;
  local: string; // unique local-flavour paragraph
  emphasis: string[]; // locally relevant service emphasis
  faqs: { q: string; a: string }[];

  /* ---- Optional rich fields (drive the v2 area-page template) ---- */
  tier?: "core" | "wider"; // core = Wirral, wider = surrounding (default core)
  metaTitle?: string;
  metaDescription?: string;
  propertyContext?: string[]; // paragraphs about local housing stock
  localPlanning?: string[]; // paragraphs about local planning/conservation context
  sections?: { heading: string; body: string[] }[];
  relevantServices?: string[]; // service slugs most relevant locally
  nearby?: string[]; // nearby area slugs
};

const designServices = ["house-extensions", "loft-conversions", "residential-design"];

export const locations: Location[] = [
  /* ============================ CORE WIRRAL ============================ */
  {
    slug: "wallasey",
    name: "Wallasey",
    tier: "core",
    metaTitle: "Architectural Designer Wallasey | Extensions & Planning Drawings",
    metaDescription:
      "Wallasey-based architectural design for extensions, loft conversions and planning drawings. Local studio covering Liscard, Egremont, New Brighton and Seacombe.",
    intro:
      "Architectural design for homeowners in Wallasey — extensions, loft conversions and planning drawings, from a studio based right here in the town.",
    local:
      "As a Wallasey-based studio, we know the local mix well — from the Edwardian and Victorian terraces around Liscard and Egremont to the semis of Wallasey Village and the seafront properties of New Brighton. Older homes often reward a sympathetic design approach, and that's exactly the kind of work we enjoy.",
    propertyContext: [
      "Wallasey's housing spans tightly-packed period terraces, bay-fronted Edwardian semis and inter-war housing further from the front. Rear extensions and loft conversions are the most common ways to add space, and the right approach depends a lot on the age and orientation of the house.",
      "On the New Brighton and Egremont seafront, light and outlook are a real asset — we design to make the most of them while keeping the work practical for a coastal setting.",
    ],
    localPlanning: [
      "Parts of Wallasey fall within designated conservation areas, and some streets may carry tighter controls — always confirm the position for your specific address with Wirral Council. We advise on the likely planning route and prepare the drawings your project needs.",
    ],
    emphasis: [
      "Period-property extensions",
      "Loft conversions in semis and terraces",
      "Planning drawings for conservation-sensitive streets",
    ],
    relevantServices: [...designServices, "planning-drawings-wirral"],
    nearby: ["new-brighton", "birkenhead", "moreton", "bebington"],
    faqs: [
      {
        q: "Do you cover all of Wallasey?",
        a: "Yes — Liscard, Egremont, New Brighton, Wallasey Village, Seacombe and the surrounding streets are all firmly within our core area.",
      },
      {
        q: "Can you help with older Wallasey homes?",
        a: "Definitely. A lot of our work is on period properties where the design needs to respect the original character while adding modern, usable space.",
      },
    ],
  },
  {
    slug: "birkenhead",
    name: "Birkenhead",
    tier: "core",
    metaTitle: "Architectural Designer Birkenhead | Extensions & Loft Conversions",
    metaDescription:
      "Architectural design and planning drawings for Birkenhead homeowners — extensions, loft conversions and building-regulations drawings across Oxton, Prenton and Claughton.",
    intro:
      "Architectural design and planning drawings for Birkenhead homeowners looking to extend, convert a loft or reimagine their space.",
    local:
      "Birkenhead's housing runs from grand Victorian villas near the park to compact terraces and post-war semis. Each calls for a different design response, and we tailor extensions and loft conversions to suit both the property and the street.",
    propertyContext: [
      "Around Birkenhead Park and Claughton you'll find larger Victorian and Edwardian homes that suit more ambitious extensions and well-proportioned loft conversions. Closer to the town centre, compact terraces benefit from clever rear and side-return design that adds light without losing the garden.",
    ],
    localPlanning: [
      "Birkenhead Park and several surrounding streets sit within conservation areas where design quality and materials matter — confirm your address with Wirral Council. We prepare sensitive, well-justified drawings where that context applies.",
    ],
    emphasis: ["Rear & side extensions", "Loft conversions", "Building-regulations drawings"],
    relevantServices: [...designServices, "conservation-area-design-wirral"],
    nearby: ["oxton", "prenton", "wallasey", "bebington"],
    faqs: [
      {
        q: "Do you work across Birkenhead and Oxton?",
        a: "Yes — Birkenhead, Oxton, Prenton and Claughton are all within easy reach of our Wallasey base.",
      },
      {
        q: "Can you design a larger extension on a villa?",
        a: "We regularly design more ambitious extensions on larger period homes, balancing scale, light and planning considerations.",
      },
    ],
  },
  {
    slug: "bebington",
    name: "Bebington",
    tier: "core",
    metaTitle: "Architectural Designer Bebington | Extensions & Home Design",
    metaDescription:
      "Bespoke architectural design for Bebington homes — extensions, loft conversions and design drawings, including conservation-sensitive work near Port Sunlight.",
    intro:
      "Bespoke architectural design for Bebington homes — thoughtfully planned extensions, loft conversions and design drawings.",
    local:
      "Bebington sits in one of Wirral's most attractive residential settings, close to Port Sunlight and its famously protected streets. We design extensions and alterations that sit comfortably within their surroundings, whether that's a 1930s semi in Higher Bebington or a home near a conservation area.",
    propertyContext: [
      "Lower and Higher Bebington offer a lot of generous inter-war and post-war family homes — ideal candidates for kitchen-diner extensions and loft conversions that genuinely improve day-to-day living.",
    ],
    localPlanning: [
      "Nearby Port Sunlight is a conservation area with strong design controls, and parts of Bebington may carry their own considerations — always confirm the position for your address with Wirral Council before assuming permitted development applies.",
    ],
    emphasis: [
      "Conservation-sensitive design",
      "Kitchen-living extensions",
      "Concept & space planning",
    ],
    relevantServices: [...designServices, "conservation-area-design-wirral"],
    nearby: ["port-sunlight", "bromborough", "eastham", "prenton"],
    faqs: [
      {
        q: "Can you design within a conservation area?",
        a: "Yes. Conservation-area work needs a sensitive, well-justified design — we prepare drawings with that context in mind and never promise approval.",
      },
      {
        q: "Do you cover Lower and Higher Bebington?",
        a: "Both, along with Spital and the surrounding area.",
      },
    ],
  },
  {
    slug: "heswall",
    name: "Heswall",
    tier: "core",
    metaTitle: "Architectural Designer Heswall | Extensions & View-Led Design",
    metaDescription:
      "Architectural design for Heswall homeowners — premium extensions, loft conversions and planning drawings designed around sloping sites and Dee Estuary views.",
    intro:
      "Architectural design for Heswall homeowners — premium extensions, loft conversions and planning drawings with a view.",
    local:
      "Heswall's elevated, leafy plots often come with sloping sites and fantastic outlooks across the Dee Estuary. We love designing extensions that make the most of those views and levels rather than fighting them.",
    propertyContext: [
      "Heswall has some of Wirral's largest and most individual homes, from substantial detached houses on the hill to characterful properties near the lower village. Split levels and changes in ground level are common — and a genuine design opportunity when handled from the start.",
    ],
    localPlanning: [
      "Some parts of Heswall fall within or near sensitive landscape and conservation designations — confirm your address with Wirral Council. We advise on the likely route and prepare the supporting drawings.",
    ],
    emphasis: ["View-led extension design", "Sloping-site design", "Premium residential design"],
    relevantServices: [...designServices, "planning-drawings-wirral"],
    nearby: ["west-kirby", "neston", "bebington", "greasby"],
    faqs: [
      {
        q: "Can you design for a sloping Heswall plot?",
        a: "Yes — split levels and changes in ground level are an opportunity for great design, and we plan them carefully from the start.",
      },
      {
        q: "Do you handle larger Heswall projects?",
        a: "We're well suited to more ambitious, design-led projects on Heswall's larger plots.",
      },
    ],
  },
  {
    slug: "west-kirby",
    name: "West Kirby",
    tier: "core",
    metaTitle: "Architectural Designer West Kirby | Coastal Extensions & Lofts",
    metaDescription:
      "Architectural design and planning drawings for West Kirby homes — coastal-aware extensions and loft conversions across West Kirby, Caldy and Newton.",
    intro:
      "Architectural design and planning drawings for West Kirby homes — coastal-aware extensions and loft conversions.",
    local:
      "West Kirby's coastal location and mix of characterful homes near the marine lake mean light, outlook and durability all matter. We design extensions that open up to the light while staying practical for a seaside setting.",
    propertyContext: [
      "From substantial homes in Caldy to family houses around the town and Newton, West Kirby rewards designs that maximise glazing and orientation toward the light and the estuary, while detailing sensibly for a coastal climate.",
    ],
    localPlanning: [
      "Parts of West Kirby and Caldy sit within conservation areas or sensitive landscape settings — confirm your address with Wirral Council. We prepare drawings with that context in mind.",
    ],
    emphasis: [
      "Light-led extension design",
      "Loft conversions",
      "Coastal-aware detailing in drawings",
    ],
    relevantServices: [...designServices, "conservation-area-design-wirral"],
    nearby: ["hoylake", "heswall", "greasby", "moreton"],
    faqs: [
      {
        q: "Do you cover West Kirby and Caldy?",
        a: "Yes — West Kirby, Caldy and Newton are all within our core Wirral area.",
      },
      {
        q: "Can you maximise light and views?",
        a: "That's a core part of how we design — orientation, glazing and layout all planned around light and outlook.",
      },
    ],
  },
  {
    slug: "hoylake",
    name: "Hoylake",
    tier: "core",
    metaTitle: "Architectural Designer Hoylake | Coastal Extensions & Design",
    metaDescription:
      "Architectural design for Hoylake and Meols homeowners — character-sensitive extensions, loft conversions and planning drawings by the coast.",
    intro:
      "Architectural design for Hoylake homeowners — extensions, loft conversions and design drawings by the coast.",
    local:
      "Hoylake and Meols have a strong seaside-town character, from cottages to substantial detached homes. We design extensions and conversions that respect that character while delivering the modern, light-filled space families want.",
    propertyContext: [
      "Hoylake's older streets and Meols' mix of period and newer homes both reward a context-aware approach — matching proportions and materials so an extension reads as part of the house, not bolted on.",
    ],
    localPlanning: [
      "Parts of Hoylake and Meols fall within conservation areas — confirm your address with Wirral Council, as permitted development rights are often reduced in those locations.",
    ],
    emphasis: ["Character-sensitive extensions", "Loft conversions", "Planning drawings"],
    relevantServices: [...designServices, "conservation-area-design-wirral"],
    nearby: ["west-kirby", "moreton", "greasby", "heswall"],
    faqs: [
      {
        q: "Do you work in Hoylake and Meols?",
        a: "Yes — both are firmly within our local area, along with neighbouring West Kirby.",
      },
      {
        q: "Can you design in keeping with the area?",
        a: "Absolutely — sympathetic, context-aware design is central to how we work.",
      },
    ],
  },
  {
    slug: "bromborough",
    name: "Bromborough",
    tier: "core",
    metaTitle: "Architectural Designer Bromborough | Family Extensions & Lofts",
    metaDescription:
      "Architectural design and planning drawings for Bromborough homeowners — practical, budget-aware extensions and loft conversions across south Wirral.",
    intro:
      "Architectural design and planning drawings for Bromborough homeowners — practical, well-planned extensions and loft conversions.",
    local:
      "Bromborough's family housing — much of it post-war and later estates — is ideal for value-adding extensions and loft conversions. We focus on practical, budget-aware design that genuinely improves day-to-day living.",
    propertyContext: [
      "Across Bromborough and into Eastham, semis and detached family homes lend themselves to single and two-storey rear extensions and straightforward loft conversions. We keep the design buildable and good value, so the project stays realistic.",
    ],
    localPlanning: [
      "Many Bromborough projects are straightforward for planning, though limits still apply and some areas carry their own conditions — we advise on the likely route, confirmed with Wirral Council.",
    ],
    emphasis: ["Family-home extensions", "Loft conversions", "Budget-aware design"],
    relevantServices: [...designServices, "garage-conversion-drawings-wirral"],
    nearby: ["eastham", "bebington", "port-sunlight", "ellesmere-port"],
    faqs: [
      {
        q: "Do you cover Bromborough and Eastham?",
        a: "Yes — Bromborough, Eastham and the surrounding south-Wirral area are all within reach.",
      },
      {
        q: "Can you design to add value?",
        a: "We design with everyday living and resale value both in mind, so the project works for you now and later.",
      },
    ],
  },
  {
    slug: "new-brighton",
    name: "New Brighton",
    tier: "core",
    metaTitle: "Architectural Designer New Brighton | Seafront Extensions & Lofts",
    metaDescription:
      "Architectural design for New Brighton homeowners — seafront and period-property extensions, loft conversions and planning drawings on the Wirral coast.",
    intro:
      "Architectural design for New Brighton homeowners — extensions, loft conversions and planning drawings on the Wirral coast.",
    local:
      "New Brighton blends Victorian seafront terraces with later homes and a lively, regenerating front. We design extensions and conversions that make the most of light and outlook while respecting the area's period character.",
    propertyContext: [
      "Many New Brighton homes are bay-fronted period terraces and semis where rear extensions and loft conversions add the most. Sea-facing properties benefit from designs that open up to the view and the light.",
    ],
    localPlanning: [
      "Parts of New Brighton sit within or near conservation areas — confirm your address with Wirral Council, as that affects permitted development and the design approach.",
    ],
    emphasis: ["Seafront-aware design", "Period-terrace extensions", "Loft conversions"],
    relevantServices: [...designServices, "planning-drawings-wirral"],
    nearby: ["wallasey", "moreton", "birkenhead"],
    faqs: [
      {
        q: "Do you cover New Brighton?",
        a: "Yes — New Brighton is part of our core Wallasey area, so we're very local to it.",
      },
      {
        q: "Can you design for a sea-facing home?",
        a: "Yes — we design to make the most of light and outlook while detailing sensibly for the coastal setting.",
      },
    ],
  },
  {
    slug: "moreton",
    name: "Moreton",
    tier: "core",
    metaTitle: "Architectural Designer Moreton | Family Extensions & Lofts",
    metaDescription:
      "Architectural design and planning drawings for Moreton homeowners — practical extensions, loft conversions and garage conversions across central Wirral.",
    intro:
      "Architectural design and planning drawings for Moreton homeowners — practical extensions, loft conversions and home improvements.",
    local:
      "Moreton's mix of inter-war and post-war family homes is well suited to extensions, loft conversions and garage conversions that add real space without overcomplicating things. We keep the design clear, buildable and good value.",
    propertyContext: [
      "Semis and detached homes across Moreton and Leasowe lend themselves to single and two-storey rear extensions and straightforward lofts. Integral garages are common here too, and converting them is one of the most cost-effective ways to gain a room.",
    ],
    localPlanning: [
      "Most Moreton projects are straightforward for planning, but limits still apply — we advise on the likely route and prepare the drawings, confirmed with Wirral Council.",
    ],
    emphasis: ["Family-home extensions", "Garage conversions", "Loft conversions"],
    relevantServices: [...designServices, "garage-conversion-drawings-wirral"],
    nearby: ["upton", "wallasey", "greasby", "hoylake"],
    faqs: [
      {
        q: "Do you cover Moreton and Leasowe?",
        a: "Yes — both are central to Wirral and very close to our base.",
      },
      {
        q: "Can you convert my integral garage?",
        a: "Yes — garage conversions are a popular, cost-effective way to add a room, and we prepare the design and building-regulations drawings.",
      },
    ],
  },
  {
    slug: "upton",
    name: "Upton",
    tier: "core",
    metaTitle: "Architectural Designer Upton | Extensions & Loft Conversions",
    metaDescription:
      "Architectural design and planning drawings for Upton homeowners — extensions, loft conversions and garage conversions across central Wirral.",
    intro:
      "Architectural design and planning drawings for Upton homeowners — extensions, loft conversions and home improvements.",
    local:
      "Upton's suburban family homes are ideal candidates for extensions and loft conversions that add the space a growing family needs. We design practically, with build cost and everyday living both in mind.",
    propertyContext: [
      "Upton has a lot of post-war and later semis and detached houses. Rear and two-storey extensions, loft conversions and garage conversions all feature regularly, and clear drawings let local builders price them accurately.",
    ],
    localPlanning: [
      "Most Upton projects follow a straightforward planning route, though limits apply and some plots carry their own considerations — confirmed with Wirral Council.",
    ],
    emphasis: ["Two-storey extensions", "Loft conversions", "Garage conversions"],
    relevantServices: [...designServices, "garage-conversion-drawings-wirral"],
    nearby: ["greasby", "moreton", "prenton", "birkenhead"],
    faqs: [
      {
        q: "Do you cover Upton and Woodchurch?",
        a: "Yes — Upton and the surrounding central-Wirral area are well within our patch.",
      },
      {
        q: "Can builders quote from your drawings?",
        a: "Yes — a clear drawing pack lets local builders price the same scope accurately.",
      },
    ],
  },
  {
    slug: "greasby",
    name: "Greasby",
    tier: "core",
    metaTitle: "Architectural Designer Greasby | Family Extensions & Lofts",
    metaDescription:
      "Architectural design and planning drawings for Greasby homeowners — practical, value-adding extensions, loft conversions and garage conversions.",
    intro:
      "Architectural design and planning drawings for Greasby homeowners — practical, value-adding extensions and conversions.",
    local:
      "Greasby is a popular family village with plenty of post-war and later housing that suits extensions and loft conversions. We design with everyday living and resale value both in mind.",
    propertyContext: [
      "Detached and semi-detached family homes across Greasby and Frankby lend themselves to rear and side extensions and straightforward loft conversions. Generous plots often allow a well-proportioned extension without crowding the garden.",
    ],
    localPlanning: [
      "Greasby projects are usually straightforward for planning, though the usual limits apply — we advise on the likely route, confirmed with Wirral Council.",
    ],
    emphasis: ["Family-home extensions", "Loft conversions", "Budget-aware design"],
    relevantServices: [...designServices, "garage-conversion-drawings-wirral"],
    nearby: ["upton", "west-kirby", "hoylake", "moreton"],
    faqs: [
      {
        q: "Do you cover Greasby and Frankby?",
        a: "Yes — both are within our core Wirral area.",
      },
      {
        q: "Can you design to add value?",
        a: "We design for everyday living and resale value, so the project works for you now and later.",
      },
    ],
  },
  {
    slug: "oxton",
    name: "Oxton",
    tier: "core",
    metaTitle: "Architectural Designer Oxton | Conservation-Sensitive Design",
    metaDescription:
      "Sensitive architectural design and planning drawings for Oxton homeowners — extensions and alterations handled carefully in a characterful, conservation-sensitive village.",
    intro:
      "Sensitive architectural design and planning drawings for Oxton homeowners — extensions and alterations handled with real care.",
    local:
      "Oxton is one of Wirral's most characterful areas, with handsome Victorian villas and a strong sense of place. Much of Oxton Village is designated as a conservation area, so design quality, materials and proportion matter a great deal — exactly the kind of careful work we enjoy.",
    propertyContext: [
      "Oxton's larger period homes can take well-considered extensions, but the design must respect the original architecture and the street. We focus on proportion, materials and detail so a proposal reads as a natural part of the house.",
    ],
    localPlanning: [
      "Much of Oxton Village is a designated conservation area, which usually reduces permitted development rights and means a full, well-justified planning application is more likely. The exact boundary and any controls must be confirmed for your address with Wirral Council — we then design and present the proposal sensitively, without ever promising approval.",
    ],
    emphasis: [
      "Conservation-sensitive extension design",
      "Period-villa alterations",
      "Well-justified planning drawings",
    ],
    relevantServices: ["conservation-area-design-wirral", "house-extensions", "residential-design"],
    nearby: ["birkenhead", "prenton", "bebington", "wallasey"],
    faqs: [
      {
        q: "Is Oxton a conservation area?",
        a: "Much of Oxton Village is designated as a conservation area, but boundaries vary street to street — always confirm your specific address with Wirral Council. We design sensitively for that context.",
      },
      {
        q: "Can I still extend a home in Oxton?",
        a: "Often yes, but the design needs to be sensitive and a full planning application is more likely. We prepare careful, well-justified drawings and never promise approval.",
      },
    ],
  },
  {
    slug: "port-sunlight",
    name: "Port Sunlight",
    tier: "core",
    metaTitle: "Architectural Designer Port Sunlight | Heritage-Sensitive Design",
    metaDescription:
      "Heritage-sensitive architectural design advice for Port Sunlight and nearby homeowners. A designated conservation village — confirm any works with Wirral Council first.",
    intro:
      "Heritage-sensitive architectural design advice for Port Sunlight and the surrounding area, where character and conservation come first.",
    local:
      "Port Sunlight is a designated conservation area of national significance — a planned model village with strict protections on its buildings and streetscape. Any alterations here are highly sensitive, and homeowners should always start by confirming what is and isn't possible with Wirral Council.",
    propertyContext: [
      "The village's cottages and terraces are an exceptional, protected ensemble. Where work is possible at all, the emphasis is entirely on preserving character, materials and proportion. We bring a careful, respectful approach to design in and around the village.",
    ],
    localPlanning: [
      "Because Port Sunlight is a designated conservation area (with many listed structures), permitted development rights are typically very limited and additional consents may apply. This is not a setting for assumptions — the council's guidance is the starting point for any project, and we work strictly within it. We never promise approval.",
    ],
    emphasis: [
      "Heritage-sensitive design advice",
      "Careful, well-justified proposals",
      "Work in and around the conservation village",
    ],
    relevantServices: ["conservation-area-design-wirral", "residential-design"],
    nearby: ["bebington", "bromborough", "eastham", "prenton"],
    faqs: [
      {
        q: "Can I extend a house in Port Sunlight?",
        a: "Port Sunlight is a highly protected conservation village, so options are very limited and additional consents may apply. Always begin by confirming what's possible with Wirral Council — we then work strictly within that.",
      },
      {
        q: "Do you guarantee approval here?",
        a: "No — and you should be wary of anyone who does. In a setting this sensitive, the council's guidance comes first and every proposal is judged on its merits.",
      },
    ],
  },
  {
    slug: "eastham",
    name: "Eastham",
    tier: "core",
    metaTitle: "Architectural Designer Eastham | Extensions & Loft Conversions",
    metaDescription:
      "Architectural design and planning drawings for Eastham homeowners — practical extensions, loft conversions and garage conversions across south Wirral.",
    intro:
      "Architectural design and planning drawings for Eastham homeowners — practical extensions, loft conversions and home improvements.",
    local:
      "Eastham combines established family housing with green surroundings near the country park and the Mersey. Its semis and detached homes are well suited to extensions and conversions that add space for a growing family.",
    propertyContext: [
      "Across Eastham and Eastham Village, post-war and later homes lend themselves to rear and two-storey extensions, loft conversions and garage conversions. We keep designs buildable and good value so local builders can price them accurately.",
    ],
    localPlanning: [
      "Eastham Village has historic character and may carry its own considerations — confirm your address with Wirral Council. Most projects elsewhere follow a straightforward planning route within the usual limits.",
    ],
    emphasis: ["Family-home extensions", "Loft conversions", "Garage conversions"],
    relevantServices: [...designServices, "garage-conversion-drawings-wirral"],
    nearby: ["bromborough", "bebington", "port-sunlight", "ellesmere-port"],
    faqs: [
      {
        q: "Do you cover Eastham and Eastham Village?",
        a: "Yes — both, along with the surrounding south-Wirral area.",
      },
      {
        q: "Can you design a two-storey extension?",
        a: "Yes — where the plot and street suit it, we design well-proportioned two-storey extensions and prepare the drawings.",
      },
    ],
  },
  {
    slug: "prenton",
    name: "Prenton",
    tier: "core",
    metaTitle: "Architectural Designer Prenton | Extensions & Home Design",
    metaDescription:
      "Architectural design and planning drawings for Prenton homeowners — extensions, loft conversions and bespoke residential design across central Wirral.",
    intro:
      "Architectural design and planning drawings for Prenton homeowners — extensions, loft conversions and bespoke home design.",
    local:
      "Prenton offers a real range of homes, from larger period and inter-war houses to post-war semis. That variety means each project benefits from a design tailored to the specific house and street rather than a one-size-fits-all approach.",
    propertyContext: [
      "Prenton's bigger homes can take ambitious, well-proportioned extensions and loft conversions, while its semis suit practical rear and side-return designs. We tailor the approach to the property in every case.",
    ],
    localPlanning: [
      "Parts of Prenton sit close to conservation areas around Oxton and Birkenhead — confirm your address with Wirral Council. We advise on the likely route and prepare the drawings.",
    ],
    emphasis: ["Period & semi extensions", "Loft conversions", "Bespoke residential design"],
    relevantServices: [...designServices, "conservation-area-design-wirral"],
    nearby: ["oxton", "birkenhead", "upton", "bebington"],
    faqs: [
      {
        q: "Do you cover Prenton?",
        a: "Yes — Prenton is central to Wirral and very close to our base.",
      },
      {
        q: "Can you design for a larger Prenton home?",
        a: "Yes — we're well suited to ambitious, design-led work on Prenton's larger properties as well as practical semi extensions.",
      },
    ],
  },

  /* ======================= WIDER SURROUNDING AREAS ======================= */
  {
    slug: "neston",
    name: "Neston",
    tier: "wider",
    metaTitle: "Architectural Designer Neston | Extensions & Planning Drawings",
    metaDescription:
      "Architectural design for Neston and Parkgate homes — extensions, loft conversions and planning drawings, with village-sensitive and rural-edge design.",
    intro:
      "Architectural design for Neston and Parkgate homes — extensions, loft conversions and planning drawings.",
    local:
      "Neston and Parkgate combine historic streets with newer developments and some lovely rural-edge plots near the Dee. We tailor each design to its specific setting, whether that's a sensitive village street or a more open site.",
    propertyContext: [
      "From period cottages in old Neston and Parkgate to modern family homes on the edges, the area rewards designs that respond to their setting. Rural-edge plots can allow more ambitious, view-led design when handled carefully.",
    ],
    localPlanning: [
      "Neston and Parkgate include conservation areas and sit within Cheshire West and Chester for planning, not Wirral — so the local authority and policies differ. We prepare drawings with the correct local context, confirmed with the relevant authority.",
    ],
    emphasis: ["Village-street-sensitive design", "Rural-edge extensions", "Planning drawings"],
    relevantServices: [...designServices, "conservation-area-design-wirral"],
    nearby: ["heswall", "ellesmere-port", "west-kirby"],
    faqs: [
      {
        q: "Do you cover Neston and Parkgate?",
        a: "Yes — both, along with Little Neston and the surrounding area.",
      },
      {
        q: "Which council handles Neston planning?",
        a: "Neston falls under Cheshire West and Chester rather than Wirral Council, so policies differ. We prepare drawings with the correct local context.",
      },
    ],
  },
  {
    slug: "ellesmere-port",
    name: "Ellesmere Port",
    tier: "wider",
    metaTitle: "Architectural Designer Ellesmere Port | Extensions & Lofts",
    metaDescription:
      "Architectural design and planning drawings for Ellesmere Port homeowners — practical, buildable extensions and loft conversions.",
    intro:
      "Architectural design and planning drawings for Ellesmere Port homeowners — practical extensions and loft conversions.",
    local:
      "Ellesmere Port's estates and family homes are perfect candidates for extensions and loft conversions that add real space without overcomplicating things. We keep the design clear, buildable and good value.",
    propertyContext: [
      "Across Ellesmere Port, Whitby and Little Sutton, semis and detached family homes suit single and two-storey extensions and straightforward loft conversions, with clear drawings for accurate builder quotes.",
    ],
    localPlanning: [
      "Ellesmere Port sits within Cheshire West and Chester for planning, not Wirral — the authority and policies differ. We prepare drawings with the correct local context.",
    ],
    emphasis: [
      "Single & two-storey extensions",
      "Loft conversions",
      "Straightforward, buildable design",
    ],
    relevantServices: [...designServices, "garage-conversion-drawings-wirral"],
    nearby: ["bromborough", "eastham", "neston"],
    faqs: [
      {
        q: "Do you cover Ellesmere Port and Whitby?",
        a: "Yes — Ellesmere Port, Whitby, Little Sutton and the surrounding area are within our service range.",
      },
      {
        q: "Can you keep the design cost-effective?",
        a: "Yes — we design with build cost in mind so your project stays realistic.",
      },
    ],
  },
  {
    slug: "liverpool",
    name: "Liverpool",
    tier: "wider",
    metaTitle: "Architectural Designer Liverpool | Extensions & Loft Conversions",
    metaDescription:
      "Architectural design and planning drawings for Liverpool homeowners — extensions, loft conversions and period-property design across the city.",
    intro:
      "Architectural design and planning drawings for Liverpool homeowners — extensions, loft conversions and bespoke home design across the water.",
    local:
      "Liverpool's housing is hugely varied — from Victorian terraces in the inner suburbs to larger homes in areas like Woolton, Allerton and Mossley Hill. We bring careful, design-led thinking to extensions and conversions across the city.",
    propertyContext: [
      "Period terraces and semis in south Liverpool reward sympathetic rear extensions and loft conversions, while larger suburban homes suit more ambitious schemes. We design to suit the original house in each case.",
    ],
    localPlanning: [
      "Liverpool projects fall under Liverpool City Council, with its own conservation areas and policies — separate from Wirral. We prepare drawings with the correct local context, confirmed with the council.",
    ],
    emphasis: ["Terraced-house extensions", "Loft conversions", "Period-property design"],
    relevantServices: [...designServices, "planning-drawings-wirral"],
    nearby: ["crosby", "wallasey", "birkenhead"],
    faqs: [
      {
        q: "Do you work across the water in Liverpool?",
        a: "Yes — Liverpool is well within our wider service area, including the south Liverpool suburbs.",
      },
      {
        q: "Can you design for a Victorian terrace?",
        a: "Period terraces are a regular part of our work — rear extensions and lofts designed to suit the original house.",
      },
    ],
  },
  {
    slug: "chester",
    name: "Chester",
    tier: "wider",
    metaTitle: "Architectural Designer Chester | Sensitive Extensions & Design",
    metaDescription:
      "Architectural design for Chester homeowners — sensitive, well-considered extensions, loft conversions and planning drawings in a heritage city.",
    intro:
      "Architectural design for Chester homeowners — sensitive, well-considered extensions, loft conversions and planning drawings.",
    local:
      "Chester's mix of historic and characterful homes means design quality and planning sensitivity are paramount, especially in and around conservation areas. We prepare carefully justified, context-aware drawings to support your project.",
    propertyContext: [
      "From period homes near the city to suburban family housing in the surrounding villages, Chester rewards a careful, context-led approach to extensions and conversions.",
    ],
    localPlanning: [
      "Chester falls under Cheshire West and Chester, with extensive conservation areas and heritage assets. The authority and policies differ from Wirral, and we prepare drawings with that context properly considered.",
    ],
    emphasis: ["Conservation-aware design", "Period-home extensions", "Planning drawings"],
    relevantServices: [...designServices, "conservation-area-design-wirral"],
    nearby: ["ellesmere-port", "neston"],
    faqs: [
      {
        q: "Is Chester within your area?",
        a: "Yes — Chester sits within our wider service area and we're happy to work across the area.",
      },
      {
        q: "Can you handle sensitive planning contexts?",
        a: "We prepare drawings with conservation and heritage context properly considered, and never promise approval.",
      },
    ],
  },
  {
    slug: "crosby",
    name: "Crosby",
    tier: "wider",
    metaTitle: "Architectural Designer Crosby | Extensions & Period-Home Design",
    metaDescription:
      "Architectural design and planning drawings for Crosby and Blundellsands homeowners — extensions, loft conversions and light-led period-home design.",
    intro:
      "Architectural design and planning drawings for Crosby homeowners — extensions, loft conversions and bespoke home design.",
    local:
      "Crosby and Blundellsands have some superb period and coastal-edge homes where good design really pays off. We design extensions and conversions that enhance the property and make the most of the light and setting.",
    propertyContext: [
      "Larger period homes in Blundellsands and family housing across Crosby both reward considered, light-led design — whether that's a rear extension opening to the garden or a well-planned loft conversion.",
    ],
    localPlanning: [
      "Crosby falls under Sefton Council, with its own conservation areas and policies — separate from Wirral. We prepare drawings with the correct local context.",
    ],
    emphasis: ["Period & coastal-edge extensions", "Loft conversions", "Light-led design"],
    relevantServices: [...designServices, "conservation-area-design-wirral"],
    nearby: ["liverpool"],
    faqs: [
      {
        q: "Do you cover Crosby and Blundellsands?",
        a: "Yes — both are within our wider service area across the Mersey.",
      },
      {
        q: "Can you design for larger Crosby homes?",
        a: "We're well suited to more ambitious, design-led work on Crosby's larger period properties.",
      },
    ],
  },
];

export function getLocation(slug: string): Location | undefined {
  return locations.find((l) => l.slug === slug);
}

export const coreLocations = locations.filter((l) => l.tier !== "wider");
export const widerLocations = locations.filter((l) => l.tier === "wider");
