import { Container, Section, StatCard, Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { site } from "@/lib/site";
import { pageMeta, breadcrumbJsonLd, personJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "About — Architectural Designer in Wirral",
  description:
    "Led by Sean Corser, SC Design & Construction is a Wallasey-based architectural design studio with 15+ years' experience helping Wirral homeowners design extensions and lofts.",
  path: "/about",
});

const trustPoints = [
  {
    title: "Design-only, builder-independent advice",
    body: "Because we don't carry out the building work, our advice stays focused on getting your design right — not on selling you a build.",
  },
  {
    title: "Local to Wirral",
    body: "Based in Wallasey, we understand the local housing and planning context, and we're easy to reach by phone or WhatsApp.",
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
            Led by {site.contactName}, SC Design &amp; Construction is a Wallasey-based architectural
            design studio with {site.yearsExperience}+ years of experience designing homes across
            Wirral.
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl space-y-6 text-pretty text-lg text-muted">
          <h2 className="text-2xl text-ink">Meet Sean</h2>
          <p>
            {site.contactName} has spent {site.yearsExperience}+ years helping homeowners turn ideas
            into clear, well-considered designs. The approach is simple: good home design starts with
            a proper conversation. Every property and every family is different, so we take the time
            to understand how you actually live before putting pen to paper.
          </p>
          {/* TODO (real business input): add Sean's headshot and a short personal bio. */}
          <p>
            From the period terraces of Wallasey and Birkenhead to the larger plots of Heswall and
            West Kirby, Sean knows the kinds of homes Wirral homeowners live in — and the planning
            context that shapes what&apos;s achievable.
          </p>

          <h2 className="pt-2 text-2xl text-ink">Our philosophy</h2>
          <p>
            We focus purely on design — exploring what&apos;s possible, shaping the concept, and
            preparing clear, accurate architectural drawings for planning and building regulations.
            We don&apos;t carry out the building work ourselves, which keeps our advice focused on
            getting the design right for you. When you&apos;re ready to build, you&apos;ll have
            professional drawings that let builders quote accurately and work with confidence.
          </p>

          <h2 className="pt-2 text-2xl text-ink">A note on the company name</h2>
          <p>
            Despite the company name, this website is focused on architectural design and drawing
            services. We do not carry out the building work ourselves; our role is to help you design
            the project and prepare the drawings needed for planning, building control and builder
            quotations.
          </p>
        </Container>
      </Section>

      <Section tone="card" className="py-12">
        <Container>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <StatCard value={`${site.yearsExperience}+`} label="Years' experience" />
            <StatCard value="Wallasey" label="Based on Wirral" />
            <StatCard value="Design" label="Concept to drawings" />
            <StatCard value="Local" label="Wirral &amp; nearby" />
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
