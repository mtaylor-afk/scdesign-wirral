import { Container, Section, Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { ReviewCta } from "@/components/ui/ReviewCta";
import { JsonLd } from "@/components/JsonLd";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Reviews for SC Design & Construction — Architectural Design Wirral",
  description:
    "Genuine homeowner feedback for SC Design & Construction will be published here as it's available, with permission. Worked with Sean? Leave an honest Google review.",
  path: "/reviews",
});

// Themes a genuine review would naturally cover — listed as topics, NOT as
// invented testimonial quotes. We never fabricate reviews or ratings.
const reviewThemes: { title: string; body: string }[] = [
  {
    title: "Communication",
    body: "How clearly Sean explained the options, kept in touch and answered questions in plain English.",
  },
  {
    title: "Clarity of the drawings",
    body: "Whether the drawings were clear and accurate enough for planning, building control and builders to work from.",
  },
  {
    title: "Help with the planning route",
    body: "How much the guidance helped in understanding the planning and building-regulations route for their project.",
  },
  {
    title: "Builder quotation pack",
    body: "Whether the drawing pack let builders quote like-for-like, so prices could be compared fairly.",
  },
  {
    title: "Local Wirral knowledge",
    body: "How useful Sean's knowledge of local homes and the Wirral planning context proved to be.",
  },
];

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
            We&apos;d rather show a handful of genuine reviews than a wall of invented ones. As
            homeowners give their permission, their honest feedback will be published here. In the
            meantime, here&apos;s how you can help — and what genuine reviews tend to focus on.
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl space-y-6">
          {/* Leave a review — Google button if configured, honest placeholder if not */}
          <ReviewCta />

          {/* Recently worked with Sean? */}
          <Card>
            <h2 className="text-xl">Recently worked with Sean?</h2>
            <p className="mt-2 text-pretty text-muted">
              If SC Design &amp; Construction has helped with your extension, loft conversion or
              planning drawings, an honest review genuinely helps other Wirral homeowners decide who
              to trust with their project. We&apos;re grateful for a few minutes of your time — good
              or bad, your feedback helps us improve too.
            </p>
          </Card>

          {/* What future reviews will cover — themes, not quotes */}
          <div>
            <h2 className="text-2xl">What genuine reviews tend to cover</h2>
            <p className="mt-2 text-pretty text-muted">
              These are the things homeowners usually comment on — shown as topics, not as
              testimonials. We won&apos;t publish a review until it&apos;s real and shared with
              permission.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {reviewThemes.map((t) => (
                <Card key={t.title}>
                  <h3 className="text-lg">{t.title}</h3>
                  <p className="mt-2 text-sm text-muted">{t.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <CTASection heading="Thinking about a project?" />
    </>
  );
}
