import Link from "next/link";
import { Container, Section, Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CostEstimator } from "@/components/ui/CostEstimator";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Extension & Loft Cost Estimate — Wirral",
  description:
    "A quick, honest guide to the likely build cost of a home extension, loft conversion, garage conversion or garden room across Wirral and selected surrounding areas. Estimate only.",
  path: "/cost-estimate",
});

export default function CostEstimatePage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Cost estimate", path: "/cost-estimate" },
        ])}
      />
      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Cost estimate", path: "/cost-estimate" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">What might my project cost?</h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            Get a rough, honest idea of the likely build cost before you go any further. Pick your
            project, set the size and finish, and we&apos;ll show a typical range — clearly marked as
            an estimate, not a quote.
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl">
          <CostEstimator />
        </Container>
      </Section>

      <Section tone="card">
        <Container className="max-w-3xl">
          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <h2 className="text-lg">Why a range, not a number?</h2>
              <p className="mt-2 text-pretty text-muted">
                Every home and site is different. Foundations, drainage, access, the level of finish
                and unforeseen issues all move the cost. A genuine figure only comes from a builder
                pricing real drawings after a survey — which is exactly what our design pack lets them
                do, accurately.
              </p>
            </Card>
            <Card>
              <h2 className="text-lg">Where we fit in</h2>
              <p className="mt-2 text-pretty text-muted">
                We&apos;re design only — we prepare the drawings your project needs so builders can
                price and build from them. That keeps the costing honest: you compare like-for-like
                quotes against one clear set of drawings.{" "}
                <Link href="/services" className="font-medium text-accent-strong underline">
                  See our services
                </Link>
                .
              </p>
            </Card>
          </div>
          <p className="mt-6 text-center text-sm text-muted">
            Prefer to picture it first?{" "}
            <Link href="/visualiser" className="font-medium text-accent-strong underline">
              Try the concept visualiser
            </Link>
            .
          </p>
        </Container>
      </Section>

      <CTASection
        heading="Ready for a real view?"
        sub="Send Sean your name and one way to contact you for an honest first view of the design and likely route — with no obligation. The size, a postcode or a few photos help if you have them, but aren't required to start."
      />
    </>
  );
}
