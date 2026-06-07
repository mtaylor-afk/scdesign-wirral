import Link from "next/link";
import { Container, Section, LinkButton, StatCard, SectionHeading, Card } from "@/components/ui";
import { CTASection } from "@/components/ui/CTASection";
import { ReviewCta } from "@/components/ui/ReviewCta";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";
import { FAQList } from "@/components/ui/FAQItem";
import { JsonLd } from "@/components/JsonLd";
import { generalFaqs } from "@/lib/faqs";
import { site, cta, whatsappLink, defaultWhatsAppMessage } from "@/lib/site";
import { faqJsonLd, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title:
    "Architectural Designer Wirral | Extensions, Lofts & Planning Drawings | SC Design & Construction",
  description:
    "Wallasey-based architectural designer helping Wirral homeowners with house extension drawings, loft conversion design, planning drawings and building-regulations drawings.",
  path: "/",
});

// "What we help with" — maps to the service pages.
const helpWith: { label: string; href: string }[] = [
  { label: "House extension drawings", href: "/services/house-extensions" },
  { label: "Loft conversion design", href: "/services/loft-conversions" },
  { label: "Planning permission drawings", href: "/services/planning-drawings-wirral" },
  {
    label: "Building-regulations drawings",
    href: "/services/building-regulations-drawings-wirral",
  },
  { label: "Permitted development advice", href: "/services/permitted-development-wirral" },
  {
    label: "Lawful development certificate drawings",
    href: "/services/lawful-development-certificate-wirral",
  },
  { label: "Garage conversion drawings", href: "/services/garage-conversion-drawings-wirral" },
  { label: "Conservation-area home design", href: "/services/conservation-area-design-wirral" },
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
                Architectural design · {site.serviceArea}
              </p>
              <h1 className="text-balance text-4xl leading-[1.08] sm:text-5xl lg:text-[3.4rem]">
                <span className="text-[#2563eb]">Architectural Designer</span>{" "}
                in Wirral for Extensions, Loft Conversions{" "}
                <span className="text-[#2563eb]">&amp;</span>{" "}
                Planning Drawings
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-lg text-muted">
                Wallasey-based architectural design for Wirral homeowners — from your first idea to
                planning-ready drawings, building-regulations drawings and builder-quotation packs.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href={cta.primary.href} size="lg">
                  {cta.primary.label}
                </LinkButton>
                <LinkButton
                  href={whatsappLink(defaultWhatsAppMessage)}
                  variant="ghost"
                  size="lg"
                  external
                >
                  {cta.whatsapp.label}
                </LinkButton>
              </div>
              <p className="mt-4 text-sm text-muted">
                Prefer to picture it first?{" "}
                <Link href="/visualiser" className="font-medium text-accent-strong underline">
                  Try the Extension Concept Visualiser
                </Link>
              </p>
            </div>

            <div className="lg:pl-4">
              <BeforeAfterSlider
                before="/examples/househront-before.jpg"
                after="/examples/househront-after.jpg"
                beforeAlt="House front before — existing home"
                afterAlt="House front after — AI concept visualisation"
                caption="AI concept visualisation — drag to compare. Illustrative only."
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
            <StatCard value={`${site.yearsExperience}+`} label="Years' design experience" />
            <StatCard value="Wallasey" label="Based on Wirral" />
            <StatCard value="Design-led" label="Concept to planning drawings" />
            <StatCard value="Builders" label="Clear drawings to quote from" />
          </div>
        </Container>
      </Section>

      {/* WHAT WE HELP WITH */}
      <Section tone="card">
        <Container>
          <SectionHeading
            eyebrow="What we help with"
            title="From a first idea to planning-ready drawings"
            intro="Whatever stage you're at, there's a service to suit. Design only — we don't carry out the building work, which keeps our advice focused on getting your design right."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {helpWith.map((h) => (
              <Link key={h.href} href={h.href} className="group block">
                <Card hover className="flex h-full items-start gap-3">
                  <span className="mt-0.5 text-accent-strong" aria-hidden>
                    ◆
                  </span>
                  <span className="font-medium text-ink group-hover:text-accent-strong">
                    {h.label}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
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
        </Container>
      </Section>

      {/* LOCAL DESIGN KNOWLEDGE */}
      <Section tone="card">
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <SectionHeading
              eyebrow="Local knowledge"
              title="Local design knowledge across Wirral"
              intro="Based in Wallasey, we know the local housing and the planning context that shapes what's achievable — and where to take extra care."
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
                <strong className="text-ink">Family extensions</strong> across Bromborough, Moreton,
                Upton and Greasby that add real, everyday space.
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
                in moments. A fun, no-pressure way to picture possibilities — and an easy first step
                toward a real conversation.
              </p>
              <p className="mt-3 text-sm text-paper/50">
                Concept visualisation only — not an architectural drawing or planning advice.
              </p>
              <div className="mt-7">
                <LinkButton href="/visualiser" variant="primary" size="lg">
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

      {/* PROJECT EXAMPLES VS REAL */}
      <Section tone="card">
        <Container>
          <SectionHeading
            eyebrow="See the possibilities"
            title="Project examples &amp; design visuals"
            intro="We keep these two things separate and honest: illustrative concept visualisations now, and real project case studies as they're ready."
          />
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <Card className="flex h-full flex-col">
              <h3 className="text-xl">Concept visualisations</h3>
              <p className="mt-2 flex-1 text-pretty text-muted">
                AI before/after examples that show the kind of transformation good design makes
                possible. Clearly labelled as illustrative — not completed projects.
              </p>
              <div className="mt-4">
                <LinkButton href="/portfolio" variant="ghost">
                  View concept visualisations
                </LinkButton>
              </div>
            </Card>
            <Card className="flex h-full flex-col border-dashed">
              <h3 className="text-xl">Real project case studies</h3>
              <p className="mt-2 flex-1 text-pretty text-muted">
                Detailed, permissioned case studies of real Wirral projects are being prepared —
                with the brief, the design response, the planning route and the drawings.
              </p>
              <div className="mt-4">
                <LinkButton href="/projects" variant="ghost">
                  Real projects (coming soon)
                </LinkButton>
              </div>
            </Card>
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

      {/* REVIEWS PROMPT */}
      <Section>
        <Container className="max-w-2xl">
          <ReviewCta />
        </Container>
      </Section>

      <CTASection
        heading="Ready to see what's possible for your home?"
        sub="Send Sean your postcode, a few photos and a short description. You'll get an honest first view of the likely design route, with no obligation."
      />
    </>
  );
}
