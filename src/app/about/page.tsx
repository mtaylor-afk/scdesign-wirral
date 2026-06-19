import { Container, Section, StatCard, Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { site } from "@/lib/site";
import { pageMeta, breadcrumbJsonLd, personJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "About — Sean Corser MCIAT, Architectural Designer",
  description:
    "SC Design Wirral is led by Sean Corser MCIAT, a Chartered Architectural Technologist (BSc Architectural Science) with 15+ years designing homes for families across Wirral, Cheshire, Merseyside and North Wales. Design only; we work with trusted builders.",
  path: "/about",
});

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
            Local architectural design you can talk to
          </h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            Led by {site.contactName} {site.credentials.postNominals} — a Chartered Architectural
            Technologist with {site.yearsExperience}+ years in architectural design — {site.shortName}{" "}
            helps growing families across {site.serviceArea} get more from their homes.
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl space-y-6 text-pretty text-lg text-muted">
          <h2 className="text-2xl text-ink">Meet Sean</h2>
          {/* TODO (real business input): add Sean's professional headshot here. */}
          <p>
            {site.contactName} is a <strong className="text-ink">Chartered Architectural Technologist
            (MCIAT)</strong> with a <strong className="text-ink">BSc in Architectural Science</strong>{" "}
            and over 15 years designing homes across Merseyside. Before that he spent six years working
            on site as a builder — so he understands not just how a design should look, but how it
            actually gets built. That combination means practical, buildable designs and drawings a
            contractor can price and construct with confidence.
          </p>
          <p>
            The approach is simple: good home design starts with a proper conversation. Every property
            and every family is different, so Sean takes the time to understand how you actually live —
            from the period terraces of Wallasey and Birkenhead to the larger plots of Heswall and West
            Kirby, and out across Cheshire and North Wales — before putting pen to paper.
          </p>

          <h2 className="pt-2 text-2xl text-ink">Design-led, with the right people to build it</h2>
          <p>
            We focus purely on design — exploring what&apos;s possible, shaping the concept and
            preparing clear, accurate drawings for planning and building regulations. We don&apos;t
            carry out the building work ourselves, which keeps our advice impartial and focused on
            getting your design right. When you&apos;re ready to build, we can recommend{" "}
            <strong className="text-ink">trusted, certified contractors (including WV Construction
            Ltd)</strong> to price and build from the drawings, and we work alongside a{" "}
            <strong className="text-ink">structural engineer</strong> for any calculations your project
            needs.
          </p>
        </Container>
      </Section>

      <Section tone="card" className="py-12">
        <Container>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <StatCard value="MCIAT" label="Chartered Architectural Technologist" />
            <StatCard value={`${site.yearsExperience}+`} label="Years in architectural design" />
            <StatCard value="6 yrs" label="Prior on-site building experience" />
            <StatCard value="BSc" label="Architectural Science" />
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
                <li>Carry out the building work — a trusted contractor does that</li>
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

      <Section tone="card">
        <Container className="max-w-3xl">
          <Card>
            <h2 className="text-xl">Company details, qualifications &amp; insurance</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="font-semibold text-ink">Lead designer</dt>
              <dd className="text-muted">
                {site.contactName} {site.credentials.postNominals}
              </dd>
              <dt className="font-semibold text-ink">Professional</dt>
              <dd className="text-muted">{site.credentials.jobTitle} (CIAT)</dd>
              <dt className="font-semibold text-ink">Qualification</dt>
              <dd className="text-muted">{site.credentials.degree}</dd>
              <dt className="font-semibold text-ink">Registered name</dt>
              <dd className="text-muted">{site.name}</dd>
              <dt className="font-semibold text-ink">Company number</dt>
              <dd className="text-muted">
                {site.companiesHouseNumber} (registered in England &amp; Wales)
              </dd>
              <dt className="font-semibold text-ink">Registered office</dt>
              <dd className="text-muted">{site.registeredOffice}</dd>
            </dl>
            <p className="mt-4 text-pretty text-muted">
              {site.shortName} is an independent architectural design and drawing practice. Sean is a{" "}
              {site.credentials.jobTitle} (MCIAT) — we are <strong>not</strong> registered architects
              (&ldquo;architect&rdquo; is a title protected by law in the UK), and we design only:
              your project is built by trusted, certified contractors who price and construct from our
              drawings, with a structural engineer for the calculations.
            </p>
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
