import { Container, Section, SectionHeading, LinkButton } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Project Examples & Design Visualisations — Wirral",
  description:
    "Concept visualisations showing the kind of transformation thoughtful architectural design makes possible. Clearly labelled as illustrative AI examples, not completed projects.",
  path: "/portfolio",
});

// AI before/after example outputs — illustrative ONLY, never presented as SC's
// own completed projects. Real project case studies live on /projects.
const concepts = [
  {
    before: "/examples/househront-before.jpg",
    after: "/examples/househront-after.jpg",
    caption: "House front — new windows & composite door",
  },
  {
    before: "/examples/conservatory-before.jpg",
    after: "/examples/conservatory-after.jpg",
    caption: "Conservatory — new warm tiled roof",
  },
  {
    before: "/examples/kitchen-before.jpg",
    after: "/examples/kitchen-after.jpg",
    caption: "Open-plan kitchen-diner",
  },
  {
    before: "/examples/garage-before.jpg",
    after: "/examples/garage-after.jpg",
    caption: "Garage — new anthracite door",
  },
  {
    before: "/examples/bathroom-before.jpg",
    after: "/examples/bathroom-after.jpg",
    caption: "Bathroom refit",
  },
  {
    before: "/examples/driveway-before.jpg",
    after: "/examples/driveway-after.jpg",
    caption: "Driveway & frontage",
  },
];

export default function PortfolioPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Portfolio", path: "/portfolio" },
        ])}
      />
      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Portfolio", path: "/portfolio" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">
            Project examples &amp; design visualisations
          </h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            The before/after sliders below are AI concept visualisations — a useful way to picture
            the kind of transformation thoughtful design makes possible. They are illustrative only,
            not SC&apos;s own completed projects. Real, permissioned project case studies are being
            prepared.
          </p>
          <div className="mt-7">
            <LinkButton href="/projects" variant="ghost">
              See real project case studies
            </LinkButton>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeading
            eyebrow="Illustrative only"
            title="Concept visualisations"
            intro="Drag each slider to compare. Every image here is an AI concept visualisation — illustrative only, not a planning drawing or a completed project."
          />
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {concepts.map((p) => (
              <BeforeAfterSlider
                key={p.before}
                before={p.before}
                after={p.after}
                beforeAlt={`${p.caption} — before`}
                afterAlt={`${p.caption} — AI concept visualisation`}
                caption={`${p.caption} · AI concept visualisation (illustrative only)`}
              />
            ))}
          </div>
        </Container>
      </Section>

      <CTASection heading="Picture your project" />
    </>
  );
}
