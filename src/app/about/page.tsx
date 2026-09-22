import { Container, Section, StatCard, Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { withBase } from "@/lib/base";
import { wi } from "@/lib/media";
import { site } from "@/lib/site";
import { pageMeta, breadcrumbJsonLd, personJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "About — Sean Corser MCIAT, Architectural Designer",
  description: `SC Design Wirral is led by Sean Corser MCIAT, a Chartered Architectural Technologist (${site.credentials.degree}) with 15+ years designing homes for families across ${site.serviceArea}. Design only — we prepare drawings so you can approach builders for like-for-like quotations.`,
  path: "/about",
});

/** Sean's portrait, supplied with his Sep 2026 brief. */
const portrait = wi("seanPortrait");

const trustPoints = [
  {
    title: "Design-only, builder-independent advice",
    body: "Because we don't carry out the building work, our advice stays focused on getting your design right — not on selling you a build.",
  },
  {
    title: "Local to Wirral",
    body: "Working right across Wirral, we understand the local housing and planning context, and we're easy to reach by phone or WhatsApp.",
  },
  {
    title: "Clear, buildable drawings",
    body: "Our drawings let builders quote accurately against the same information, so you compare like with like and the build matches what you agreed.",
  },
  {
    title: "15+ years of experience",
    body: "From simple rear extensions to whole-home reconfigurations, we bring practical knowledge and a genuine eye for design.",
  },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
          personJsonLd(),
        ]}
      />
      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "About", path: "/about" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">
            Local Architectural Designs, Built Around You
          </h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            {site.shortName} helps homeowners across Wirral and surrounding areas create practical,
            thoughtfully designed spaces that make more of their homes and increase the value of
            their property.
          </p>
        </Container>
      </Section>

      {/* ABOUT SEAN — Sean's photo with the copy running down the side, which is
          how his brief asks for it. Stacks above the text on narrow screens. */}
      <Section>
        <Container>
          <h2 className="text-2xl text-ink">About Sean</h2>
          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-12">
            <div data-reveal className="mx-auto w-full max-w-sm lg:mx-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={withBase(portrait.src)}
                alt={portrait.alt}
                width={portrait.width}
                height={portrait.height}
                loading="lazy"
                decoding="async"
                className="w-full rounded-[var(--radius-xl)] border border-line object-cover shadow-tile"
              />
            </div>
            <div className="space-y-5 text-pretty text-lg text-muted">
              <p>
                {site.contactName} is a Chartered Architectural Technologist (
                {site.credentials.postNominals}) with a {site.credentials.degree} and more than{" "}
                {site.yearsExperience} years&apos; experience designing homes across Merseyside.
              </p>
              <p>
                As the founder and lead designer of {site.shortName}, Sean brings more than
                professional design experience to every project. Before moving into architecture, he
                spent {site.yearsAsBuilder} years working as a builder on residential extensions,
                loft conversions, garage conversions and new-build homes. This gives him a practical
                understanding of how a design should look and function for a family — as well as how
                it will actually be built.
              </p>
              <p>
                This combination of architectural knowledge and hands-on construction experience
                results in attractive, practical and buildable designs, supported by clear drawings
                that contractors can price and construct with confidence.
              </p>
              <p>
                Sean&apos;s approach is simple: good home design begins with a proper conversation.
                Every property and every family is different, so he takes the time to understand how
                you live, what is not working and what you want your home to become.
              </p>
              <p>
                From the period terraces of Wallasey and Birkenhead to the larger properties and
                plots of Heswall and West Kirby, every proposal is carefully developed around the
                character of the property and the needs of the people who live there.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="card">
        <Container className="max-w-3xl space-y-5 text-pretty text-lg text-muted">
          <h2 className="text-2xl text-ink">Independent Design Advice, Ready for Construction</h2>
          <p>
            {site.shortName} focuses exclusively on architectural design — exploring what is
            possible, developing the concept and preparing clear, accurate drawings for Planning
            Permission and Building Regulations approval.
          </p>
          <p>
            We do not undertake the building work ourselves. This keeps our advice impartial and
            ensures the focus remains on developing the right design for your home. When you are
            ready to build, the completed drawings can be issued to contractors to obtain clear,
            comparable quotations. Where structural calculations are required, we work alongside a
            trusted <strong className="text-ink">structural engineer</strong> to help provide the
            technical information needed to progress your project.
          </p>
          <p className="text-base">
            Sean is a Chartered Architectural Technologist (MCIAT) and a member of CIAT. We are{" "}
            <strong className="text-ink">not registered architects</strong> — &ldquo;architect&rdquo;
            is a title protected by law in the UK — and we design only: your project is built by
            builders you appoint, who price and construct from our drawings.
          </p>
          <p>
            Planning an extension, loft conversion or home alteration? Get in touch to arrange an
            initial conversation about your project.
          </p>
        </Container>
      </Section>

      <Section tone="card" className="py-12">
        <Container>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <StatCard value="MCIAT" label="Chartered Architectural Technologist" />
            <StatCard value={`${site.yearsExperience}+`} label="Years in architectural design" />
            <StatCard
              value={`${site.yearsAsBuilder} yrs`}
              label="Prior on-site building experience"
            />
            <StatCard value="BSc" label={site.credentials.degreeSubject} />
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <h2 className="text-2xl">Why homeowners involve us early</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {trustPoints.map((t) => (
              <Card key={t.title}>
                <h3 className="text-lg">{t.title}</h3>
                <p className="mt-2 text-pretty text-muted">{t.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl">
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <h2 className="text-xl">What we do</h2>
              <ul className="mt-3 space-y-2 text-pretty text-muted">
                <li>Concept design &amp; space planning</li>
                <li>Planning drawings &amp; application support</li>
                <li>Building-regulations &amp; technical drawing packages</li>
                <li>Extension, loft, porch &amp; garden-room design</li>
                <li>Measured surveys &amp; accurate existing drawings</li>
                <li>Clear, builder-ready drawing packs</li>
              </ul>
            </Card>
            <Card>
              <h2 className="text-xl">What we don&apos;t do</h2>
              <ul className="mt-3 space-y-2 text-pretty text-muted">
                <li>Carry out the building work — the builder you appoint does that</li>
                <li>
                  Call ourselves &ldquo;architects&rdquo; — we&apos;re Chartered Architectural
                  Technologists
                </li>
                <li>Structural calculations — our structural engineer handles those</li>
                <li>Guarantee planning approval — but we design to give it the best chance</li>
              </ul>
            </Card>
          </div>
        </Container>
      </Section>

      {/* The "Company details, qualifications & insurance" card was removed at
          Sean's request (brief, Sep 2026). The Companies Act disclosure is
          unaffected — the footer carries the registered name, company number and
          registered office on every page — and the ARB wording now sits in the
          "Independent Design Advice" section above. Insurance stays here, since
          homeowners do ask. */}
      <Section tone="card">
        <Container className="max-w-3xl">
          <Card>
            <h2 className="text-xl">Insurance</h2>
            <p className="mt-3 text-pretty text-muted">
              Professional indemnity and public liability insurance cover our design work; further
              details can be provided on request where relevant to your project.
            </p>
          </Card>
        </Container>
      </Section>

      <CTASection heading="Let's talk about your home" />
    </>
  );
}
