import Link from "next/link";
import { Container, Section } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { FAQList } from "@/components/ui/FAQItem";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { generalFaqs, faqCategories } from "@/lib/faqs";
import { pageMeta, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Frequently Asked Questions — Architectural Design Wirral",
  description:
    "Answers to common questions about planning permission, permitted development, building regulations, drawings, costs, conservation areas, service areas and the visualiser.",
  path: "/faqs",
});

export default function FaqsPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "FAQs", path: "/faqs" },
          ]),
          faqJsonLd(generalFaqs),
        ]}
      />
      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "FAQs", path: "/faqs" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">Frequently asked questions</h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            Honest answers to the questions Wirral homeowners ask most. Can&apos;t see yours? Just{" "}
            <Link href="/contact" className="font-medium text-accent-strong underline">
              send Sean your question
            </Link>
            .
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl space-y-12">
          {faqCategories.map((cat) => {
            const group = generalFaqs.filter((f) => f.category === cat.key);
            if (group.length === 0) return null;
            return (
              <div key={cat.key}>
                <h2 className="text-2xl">{cat.label}</h2>
                <div className="mt-4">
                  <FAQList faqs={group} />
                </div>
              </div>
            );
          })}

          <p className="text-pretty text-muted">
            Want more detail? Read our{" "}
            <Link href="/guides" className="font-medium text-accent-strong underline">
              guides on planning permission, building regulations and design costs
            </Link>
            .
          </p>
        </Container>
      </Section>

      <CTASection />
    </>
  );
}
