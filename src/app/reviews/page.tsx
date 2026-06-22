import { Container, Section } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { ReviewCta } from "@/components/ui/ReviewCta";
import { ReviewsSummary, Testimonials } from "@/components/ui/Testimonials";
import { JsonLd } from "@/components/JsonLd";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";
import { reviewSummary } from "@/lib/reviews";

export const metadata = pageMeta({
  title: "Reviews for SC Design & Construction — Architectural Design Wirral",
  description:
    "Rated 5.0 from 30 genuine Google reviews. Read what Wirral homeowners and builders say about SC Design & Construction — extensions, loft conversions and planning drawings.",
  path: "/reviews",
});

export default function ReviewsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Reviews", path: "/reviews" },
        ])}
      />
      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Reviews", path: "/reviews" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">
            Reviews for SC Design &amp; Construction
          </h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            Sean&apos;s work is rated {reviewSummary.rating.toFixed(1)} from {reviewSummary.count}{" "}
            genuine Google reviews — from homeowners and from the builders who work to his drawings.
            Here&apos;s a selection; you can read every one on Google.
          </p>
          <div className="mt-8">
            <ReviewsSummary />
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <Testimonials />
        </Container>
      </Section>

      <Section tone="card">
        <Container className="max-w-3xl">
          <ReviewCta />
        </Container>
      </Section>

      <CTASection heading="Thinking about a project?" />
    </>
  );
}
