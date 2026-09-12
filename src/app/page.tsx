import Link from "next/link";
import { Container, Section, LinkButton, StatCard, SectionHeading, Card } from "@/components/ui";
import { ReviewsSummary, GoogleRatingLine } from "@/components/ui/Testimonials";
import { ReviewsCarousel } from "@/components/ui/ReviewsCarousel";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";
import { FAQList } from "@/components/ui/FAQItem";
import { ServiceCard } from "@/components/ui/ServiceCard";
import { MeetSean } from "@/components/ui/MeetSean";
import { WorkFigure } from "@/components/ui/WorkGallery";
import { EnquiryForm } from "@/components/EnquiryForm";
import { JsonLd } from "@/components/JsonLd";
import { generalFaqs } from "@/lib/faqs";
import { getService } from "@/lib/services";
import { getServiceMedia, wi } from "@/lib/media";
import { site, cta, whatsappLink, defaultWhatsAppMessage } from "@/lib/site";
import { faqJsonLd, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title:
    "Architectural Designer Wirral | Extensions, Lofts & Planning Drawings | SC Design & Construction",
  description:
    "Wirral architectural designer helping homeowners across Wirral, Liverpool, Cheshire, Warrington and North Wales with house extension drawings, loft conversion design, planning and building-regulations drawings. Led by a Chartered Architectural Technologist (MCIAT).",
  path: "/",
});

// Sean's main services (brief: "modified to the main service I offer") — each a
// photo card that opens the full service breakdown.
const mainServiceSlugs = [
  "house-extensions",
  "loft-conversions",
  "garage-conversion-drawings-wirral",
  "front-porch-extension-design",
  "bespoke-garden-room-design",
  "planning-drawings-wirral",
  "building-regulations-drawings-wirral",
  "residential-design",
];
const mainServices = mainServiceSlugs
  .map((slug) => getService(slug))
  .filter((s): s is NonNullable<typeof s> => Boolean(s));

// "A few project images" (brief) — real photographs of completed work.
const recentWork = [
  wi("loftDormerAfter", "Dormer loft conversion"),
  wi("garage1After", "Garage conversion"),
  wi("extRearPebbledash", "Single-storey rear extension"),
  wi("loftTileHung", "Tile-hung dormer"),
];

const drawingsHelp: { term: string; body: string; href: string; cta: string }[] = [
  {
    term: "Planning drawings",
    body: "Show the council what you want to build and how it looks. Needed when your project requires planning permission.",
    href: "/guides/do-i-need-planning-permission-for-an-extension",
    cta: "Do I need planning permission?",
  },
  {
    term: "Building-regulations drawings",
    body: "Show how the work is built and meets safety and energy standards. Needed for almost all building work.",
    href: "/guides/do-i-need-building-regulations-approval",
    cta: "Do I need building regs?",
  },
  {
    term: "Builder-quote drawings",
    body: "Let several builders price the same scope, so you compare like with like and the build matches what you agreed.",
    href: "/guides/what-drawings-do-builders-need",
    cta: "What drawings do builders need?",
  },
];

// A small selection of the most useful homeowner guides for the homepage.
const homeGuides: { title: string; blurb: string; href: string }[] = [
  {
    title: "Full Plans vs Building Notice",
    blurb: "The two building-control routes — and which suits an extension, loft or garage conversion.",
    href: "/guides/full-plans-vs-building-notice-wirral",
  },
  {
    title: "Planning application drawings",
    blurb: "What drawings and documents a Wirral householder application needs to be valid.",
    href: "/guides/wirral-householder-planning-application-drawings-checklist",
  },
  {
    title: "Garage conversion rules",
    blurb: "Planning and building-regulations basics before you convert a garage in Wirral.",
    href: "/guides/garage-conversion-planning-building-regulations-wirral",
  },
  {
    title: "After planning permission",
    blurb: "The next steps once you're approved: building regs, calculations and builder quotes.",
    href: "/guides/after-planning-permission-next-steps",
  },
];

export default function HomePage() {
  return (
    <>
      <JsonLd data={faqJsonLd(generalFaqs.slice(0, 6))} />

      {/* HERO */}
      <Section tone="card" className="relative overflow-hidden pt-16 pb-20 sm:pt-20">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent-strong">
                Architectural design · Wirral &amp; beyond
              </p>
              <h1 className="text-balance text-4xl leading-[1.08] sm:text-5xl lg:text-[3.4rem]">
                <span className="text-accent-strong">Architectural Designer</span>{" "}
                in Wirral for Extensions, Loft Conversions{" "}
                <span className="text-accent-strong">&amp;</span>{" "}
                Planning Drawings
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-lg text-muted">
                Friendly, practical home design for growing families — led by Sean Corser MCIAT,
                Chartered Architectural Technologist. From your first idea to clear planning,
                building-regulations and builder-quote drawings.
              </p>
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
                  Main areas we cover
                </p>
                <ul className="mt-2 flex flex-wrap gap-2" aria-label="Main areas we cover">
                  {site.regions.map((r) => (
                    <li
                      key={r}
                      className="rounded-full border border-line bg-paper px-3 py-1 text-sm text-ink-soft"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href={cta.primary.href} size="lg" track="contact-cta">
                  {cta.primary.label}
                </LinkButton>
                <LinkButton
                  href={whatsappLink(defaultWhatsAppMessage)}
                  variant="ghost"
                  size="lg"
                  external
                  track="whatsapp-click"
                >
                  {cta.whatsapp.label}
                </LinkButton>
              </div>
              <p className="mt-4 text-sm text-muted">
                Prefer to picture it first?{" "}
                <Link
                  href="/visualiser"
                  data-conversion="visualiser-start"
                  className="font-medium text-accent-strong underline"
                >
                  Try the Extension Concept Visualiser
                </Link>
              </p>
            </div>

            <div className="lg:pl-4">
              <BeforeAfterSlider
                before="/portfolio/hero-before.jpg"
                after="/portfolio/hero-after.jpg"
                beforeAlt="Tired rear elevation of a Wirral home before redesign"
                afterAlt="Concept visualisation of the same home with a single-storey rear extension"
                caption="Before → concept visualisation. Drag to compare."
                priority
              />
            </div>
          </div>
        </Container>
      </Section>

      {/* TRUST BAR */}
      <Section className="py-12">
        <Container>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <StatCard value="MCIAT" label="Chartered Architectural Technologist" />
            <StatCard value={`${site.yearsExperience}+`} label="Years in architectural design" />
            <StatCard value="Local" label="Wirral, Liverpool, Cheshire & N. Wales" />
            <StatCard value="Builder-ready" label="Clear drawings for like-for-like quotations" />
          </div>
        </Container>
      </Section>

      {/* OUR MAIN SERVICES — photo cards */}
      <Section tone="card">
        <Container>
          <SectionHeading
            eyebrow="What we help with"
            title="Our main services"
            intro="Tap a service to see what's involved. Design only — we don't carry out the building work, which keeps our advice focused on getting your design right."
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {mainServices.map((s) => (
              <ServiceCard
                key={s.slug}
                title={s.title}
                href={`/services/${s.slug}`}
                image={getServiceMedia(s.slug).card}
                compact
              />
            ))}
          </div>
          <div className="mt-8">
            <LinkButton href="/services" variant="ghost">
              See all services
            </LinkButton>
          </div>
        </Container>
      </Section>

      {/* RECENT WORK — real project photos */}
      <Section tone="mist">
        <Container>
          <SectionHeading
            eyebrow="Recent work"
            title="Real projects, designed by Sean"
            intro="A few completed extensions, loft and garage conversions designed by SC Design Wirral and built by the homeowners' own builders."
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {recentWork.map((img) => (
              <WorkFigure key={img.src} image={img} />
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/before-and-after">See before &amp; after</LinkButton>
            <LinkButton href="/projects" variant="ghost">
              Read the case studies
            </LinkButton>
            <LinkButton href="/portfolio" variant="ghost">
              Design visualisations
            </LinkButton>
          </div>
        </Container>
      </Section>

      {/* MEET SEAN */}
      <Section>
        <Container className="max-w-4xl">
          <SectionHeading eyebrow="Meet Sean" title="Design experience — backed by years on site" />
          <MeetSean className="mt-12" />
        </Container>
      </Section>

      {/* REVIEWS — rotating window of genuine Google reviews */}
      <Section tone="card">
        <Container>
          <SectionHeading
            eyebrow="Reviews"
            title="What homeowners and builders say"
            intro="Genuine, verified reviews from the SC Design Google profile."
            align="center"
          />
          <div className="mt-8 flex justify-center">
            <ReviewsSummary align="center" />
          </div>
          <ReviewsCarousel className="mt-10" />
          <p className="mt-8 text-center text-sm text-muted">
            <Link href="/reviews" className="font-medium text-accent-strong underline">
              See all reviews
            </Link>
          </p>
        </Container>
      </Section>

      {/* NOT SURE WHAT DRAWINGS YOU NEED */}
      <Section>
        <Container>
          <SectionHeading
            eyebrow="Plain English"
            title="Not sure what drawings you need?"
            intro="Most projects involve one or two different sets of drawings, prepared at different stages. Here's the quick version — and a guide for each."
          />
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {drawingsHelp.map((d) => (
              <Card key={d.term} className="flex h-full flex-col">
                <h3 className="text-xl">{d.term}</h3>
                <p className="mt-2 flex-1 text-pretty text-muted">{d.body}</p>
                <Link
                  href={d.href}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong"
                >
                  {d.cta} <span aria-hidden>→</span>
                </Link>
              </Card>
            ))}
          </div>
          <p className="mt-8 text-sm text-muted">
            Wondering whether your project needs permission at all?{" "}
            <Link href="/homeowners-guide" className="font-medium text-accent-strong underline">
              Try the interactive planning guide
            </Link>
          </p>
        </Container>
      </Section>

      {/* VISUALISER TEASER */}
      <Section tone="ink">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                AI Extension Concept Visualiser
              </p>
              <h2 className="text-balance text-3xl text-paper sm:text-4xl">
                See a concept-style extension idea before you speak to Sean
              </h2>
              <p className="mt-4 max-w-lg text-pretty text-paper/70">
                Upload a photo of your home, choose a few options and get an AI concept visualisation
                — with an estimated build-cost guide — in moments. A fun, no-pressure way to picture
                possibilities and an easy first step toward a real conversation.
              </p>
              <p className="mt-3 text-sm text-paper/50">
                Concept visualisation only — not an architectural drawing or planning advice.
              </p>
              <div className="mt-7">
                <LinkButton href="/visualiser" variant="primary" size="lg" track="visualiser-start">
                  {cta.visualiser.label}
                </LinkButton>
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-6">
              <BeforeAfterSlider
                before="/examples/conservatory-before.jpg"
                after="/examples/conservatory-after.jpg"
                beforeAlt="Conservatory before — tired existing conservatory"
                afterAlt="Conservatory after — AI concept visualisation"
                caption="AI concept visualisation (illustrative)."
              />
            </div>
          </div>
        </Container>
      </Section>

      {/* LOCAL DESIGN KNOWLEDGE */}
      <Section tone="card">
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <SectionHeading
              eyebrow="Local knowledge"
              title="Local design knowledge across Wirral and beyond"
              intro="Based on the Wirral and working across Liverpool, Cheshire, Warrington and North Wales, we know the local housing and the planning context that shapes what's achievable — and where to take extra care."
            />
            <ul className="space-y-3 text-pretty text-muted">
              <li>
                <strong className="text-ink">Period homes</strong> in Wallasey, Birkenhead and Oxton
                that reward a sympathetic design approach.
              </li>
              <li>
                <strong className="text-ink">Conservation sensitivity</strong> around Port Sunlight,
                Oxton and parts of Bebington — confirmed with Wirral Council for your address.
              </li>
              <li>
                <strong className="text-ink">Coastal &amp; sloping sites</strong> in Heswall, West
                Kirby and Hoylake, designed around light, levels and outlook.
              </li>
              <li>
                <strong className="text-ink">Different councils, different rules</strong> — from
                Cheshire West and Chester to Liverpool, Warrington and the Welsh authorities, where
                permitted-development rules differ.
              </li>
            </ul>
          </div>
          <div className="mt-8">
            <LinkButton href="/areas" variant="ghost">
              See all the areas we cover
            </LinkButton>
          </div>
        </Container>
      </Section>

      {/* FAQs */}
      <Section>
        <Container className="max-w-3xl">
          <SectionHeading eyebrow="Good to know" title="Frequently asked questions" align="center" />
          <div className="mt-8">
            <FAQList faqs={generalFaqs.slice(0, 6)} />
          </div>
          <p className="mt-8 text-center text-sm text-muted">
            <Link href="/faqs" className="font-medium text-accent-strong underline">
              See all FAQs
            </Link>
          </p>
        </Container>
      </Section>

      {/* HELPFUL HOMEOWNER GUIDES */}
      <Section tone="card">
        <Container>
          <SectionHeading
            eyebrow="Homeowner guides"
            title="Helpful homeowner guides"
            intro="Plain-English answers to the planning and building-control questions homeowners ask most — written to help you decide before you get in touch."
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {homeGuides.map((g) => (
              <Link key={g.href} href={g.href} className="group block">
                <Card hover className="flex h-full flex-col">
                  <h3 className="text-lg">{g.title}</h3>
                  <p className="mt-2 flex-1 text-pretty text-sm text-muted">{g.blurb}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong transition-[gap] group-hover:gap-2.5">
                    Read the guide <span aria-hidden>→</span>
                  </span>
                </Card>
              </Link>
            ))}
          </div>
          <div className="mt-8">
            <LinkButton href="/guides" variant="ghost">
              See all homeowner guides
            </LinkButton>
          </div>
        </Container>
      </Section>

      {/* BOOK A FREE CONSULTATION — Sean's closing CTA + quick form */}
      <Section tone="ink" id="book">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Free &amp; no obligation
              </p>
              <h2 className="text-balance text-3xl text-paper sm:text-4xl">
                {cta.consultation.label}
              </h2>
              <p className="mt-4 max-w-md text-pretty text-paper/70">
                Tell Sean about your project — your name, one way to contact you and a brief
                description is all it takes. You&apos;ll get an honest first view of the likely
                design and planning route, with no obligation.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-paper/80">
                <li className="flex gap-2">
                  <span aria-hidden className="text-accent">
                    ✓
                  </span>
                  Only your name and a phone number or email are required
                </li>
                <li className="flex gap-2">
                  <span aria-hidden className="text-accent">
                    ✓
                  </span>
                  Photos and a postcode help, but can follow later
                </li>
                <li className="flex gap-2">
                  <span aria-hidden className="text-accent">
                    ✓
                  </span>
                  Design only — impartial advice, no sales pitch for a build
                </li>
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href={`tel:${site.phoneE164}`} variant="light" track="phone-click">
                  Call {site.phoneDisplay}
                </LinkButton>
                <LinkButton
                  href={whatsappLink(defaultWhatsAppMessage)}
                  variant="light"
                  external
                  track="whatsapp-click"
                >
                  {cta.whatsapp.label}
                </LinkButton>
              </div>
            </div>
            <div className="rounded-lg bg-paper-card p-6 text-ink shadow-card sm:p-8">
              <GoogleRatingLine className="mb-5" />
              <EnquiryForm
                source="home_consultation"
                heading="Tell us about your project"
                intro="Name, one way to contact you and a brief description — that's all Sean needs to get started."
                compact
              />
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
