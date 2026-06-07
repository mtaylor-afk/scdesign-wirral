import { Container, Section, Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { VisualiserApp } from "@/components/visualiser/VisualiserApp";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";
import { withBase } from "@/lib/base";

export const metadata = pageMeta({
  title: "See your idea come to life",
  description:
    "Upload a photo of your home and create an AI concept visualisation to explore possibilities before speaking to Sean. Concept only — not an architectural drawing or planning advice.",
  path: "/visualiser",
});

export default function VisualiserPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Visualiser", path: "/visualiser" },
        ])}
      />
      <Section tone="card" className="pt-8">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Visualiser", path: "/visualiser" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">See your idea come to life</h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            Upload a photo of your home and create an AI concept visualisation to explore
            possibilities before speaking to Sean. It&apos;s a fun, no-pressure first step toward a
            real conversation.
          </p>
        </Container>
      </Section>

      <Section className="pt-6">
        <Container>
          <p className="mx-auto mb-6 max-w-3xl text-sm text-muted">
            By uploading a photo you confirm you have the right to use it. Your image is processed to
            create the visualisation and is not stored after processing. Generate your concept below,
            then send it to Sean with your postcode and a few project notes if you&apos;d like an
            honest first view.
          </p>
          <VisualiserApp />

          <div className="mx-auto mt-8 max-w-3xl rounded-[var(--radius)] border border-accent-soft bg-accent-soft/40 p-4 text-sm text-ink-soft">
            <strong className="font-semibold">Concept visualisation only.</strong> This is not an
            architectural drawing, not planning advice, and not confirmation that a design is
            buildable or likely to receive approval. Real design always starts with a proper look at
            your property. See the{" "}
            <a href={withBase("/visualiser-terms")} className="underline">
              visualiser terms
            </a>{" "}
            and{" "}
            <a href={withBase("/privacy-policy")} className="underline">
              privacy policy
            </a>
            .
          </div>
        </Container>
      </Section>

      <Section tone="card">
        <Container className="max-w-3xl">
          <Card>
            <h2 className="text-lg">What happens next?</h2>
            <p className="mt-2 text-pretty text-muted">
              Like the direction? Send your concept to Sean with your postcode and a short note, and
              we&apos;ll give you an honest first view of the likely design route. From there, real
              design begins with a proper look at your property — the concept is only ever a starting
              point for the conversation.
            </p>
          </Card>
        </Container>
      </Section>

      <CTASection heading="Prefer to just talk it through?" />
    </>
  );
}
