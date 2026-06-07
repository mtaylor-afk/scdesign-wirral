import { Container, Section, SectionHeading, Card, LinkButton } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Architectural Design Reviews Wirral",
  description:
    "Reviews from homeowners who've worked with SC Design & Construction. Genuine reviews only — if you've worked with us, we'd be grateful for an honest Google review.",
  path: "/reviews",
});

// TODO (real business input): paste the live Google review link here once the
// Google Business Profile is set up. Until then the button is not rendered —
// we never link to a placeholder, and we never invent reviews.
const GOOGLE_REVIEW_URL = "";

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
          <h1 className="text-balance text-4xl sm:text-5xl">Reviews</h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            We&apos;d rather show a handful of genuine reviews than a wall of invented ones. As we
            publish verified feedback from Wirral homeowners, it will appear here.
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl">
          <Card>
            <h2 className="text-xl">Reviews coming soon</h2>
            <p className="mt-2 text-pretty text-muted">
              We&apos;re gathering honest feedback from recent clients, with their permission. Check
              back soon — or get in touch and we&apos;ll happily put you in contact with previous
              homeowners where we can.
            </p>
            {GOOGLE_REVIEW_URL && (
              <div className="mt-5">
                <LinkButton href={GOOGLE_REVIEW_URL} external>
                  Leave a Google review
                </LinkButton>
              </div>
            )}
          </Card>

          <Card className="mt-6">
            <h2 className="text-xl">Worked with SC Design &amp; Construction?</h2>
            <p className="mt-2 text-pretty text-muted">
              If we&apos;ve helped with your project, an honest review genuinely helps other Wirral
              homeowners decide. We&apos;ll share our Google review link here as soon as it&apos;s
              live.
            </p>
          </Card>
        </Container>
      </Section>

      <CTASection heading="Thinking about a project?" />
    </>
  );
}
