import { Container, Section, SectionHeading, LinkButton } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";
import { WorkGallery } from "@/components/ui/WorkGallery";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { portfolioImages, wi, type WorkImage } from "@/lib/media";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Design Visualisations & Concept Examples — Wirral",
  description:
    "Sean's design visualisations for extensions, garden rooms and conversions, plus illustrative AI before/after concepts. Clearly labelled — not photographs of completed projects.",
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

// Sean's OWN design visualisations (genuine design work) — renders of proposed
// schemes, NOT photographs of completed builds (those are on /before-and-after).
const visualisations: WorkImage[] = [
  { ...portfolioImages.gardenRoom, caption: "Brick garden room extension" },
  { ...portfolioImages.lanternExtension, caption: "Rear extension with roof lantern" },
  wi("vizFlatRoofLantern", "Flat-roof extension with corner glazing"),
  wi("vizBifold", "Rendered rear extension with bi-folds"),
  wi("vizTimberClad", "Timber-clad garden extension"),
  { ...portfolioImages.heroAfter, caption: "Rear extension & garden remodel" },
  { ...portfolioImages.chapelGallery, caption: "Chapel-to-gallery conversion" },
  { ...portfolioImages.singleStorey, caption: "Single-storey commercial building" },
  { ...portfolioImages.pharmacy, caption: "Pharmacy shopfront & fit-out" },
];

export default function PortfolioPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Design visualisations", path: "/portfolio" },
        ])}
      />
      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Design visualisations", path: "/portfolio" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">Design visualisations</h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            Sean&apos;s design visualisations show how a proposed scheme will look before anything is
            built, and the AI before/after sliders further down illustrate the kind of
            transformation good design makes possible. None of these are photographs of finished
            builds — for real completed work, see the before &amp; after photos and case studies.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <LinkButton href="/before-and-after">See real before &amp; after</LinkButton>
            <LinkButton href="/projects" variant="ghost">
              Read the case studies
            </LinkButton>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeading
            eyebrow="Our design work"
            title="Sean's design visualisations"
            intro="Extensions, garden rooms, conversions and commercial schemes — each one a visualisation of the proposed design, labelled as such."
          />
          <WorkGallery images={visualisations} className="mt-10" />
          <p className="mt-6 text-sm text-muted">
            Design visualisations only — illustrative of the design intent, not planning drawings
            and not photographs of completed work.
          </p>
        </Container>
      </Section>

      <Section tone="card">
        <Container>
          <SectionHeading
            eyebrow="Illustrative only"
            title="Before &amp; after concepts"
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
