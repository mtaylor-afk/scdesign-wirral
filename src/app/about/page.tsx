import { Container, Section, StatCard, Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { site } from "@/lib/site";
import { pageMeta, breadcrumbJsonLd, personJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "About — Architectural Designer in Wirral",
  description:
    "Led by Sean Corser, SC Design & Construction is a Wallasey-based architectural design studio with 18+ years' experience helping Wirral homeowners design extensions and lofts.",
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
    title: "18+ years of experience",
    body: "From simple rear extensions to whole-home reconfigurations, we bring practical knowledge and a genuine eye for design.",
  },
];

// Owner-confirmable details. We publish each only once it's verified — never a
// claim we can't back up (ARB/RIBA, memberships, insurance all stay pending here).
const credentialsTodo = [
  "Relevant design qualifications — to be confirmed",
  "Professional memberships, if any — to be confirmed",
  "Professional indemnity and public liability insurance — to be confirmed",
  "Companies House registration number, if it is to be shown — to be confirmed",
  "Whether to publish a business address or remain service-area only — to be confirmed",
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
            <h2 className="text-xl">Qualifications, insurance &amp; professional details</h2>
            <p className="mt-2 text-pretty text-muted">
              SC Design &amp; Construction provides architectural design and drawing services. We do
              not describe ourselves as registered architects unless ARB registration is expressly
              confirmed — &ldquo;architect&rdquo; is a title protected by law in the UK.
            </p>
            <p className="mt-3 text-pretty text-muted">
              We&apos;d rather publish details once they&apos;re confirmed than make claims we
              can&apos;t back up. The following will be added here as they&apos;re verified:
            </p>
            <ul className="mt-4 space-y-2.5">
              {credentialsTodo.map((c) => (
                <li key={c} className="flex gap-3 text-pretty text-muted">
                  <span className="mt-1 shrink-0 text-accent-strong" aria-hidden>
                    ◆
                  </span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
            {/* TODO (real business input): replace each item above with the confirmed
                detail once verified. Do NOT claim any of these until confirmed. */}
          </Card>
        </Container>
      </Section>

      <CTASection heading="Let's talk about your home" />
    </>
  );
}
