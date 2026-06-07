import {
  Container,
  Section,
  Button,
  LinkButton,
  Card,
  Badge,
  StatCard,
  SectionHeading,
} from "@/components/ui";
import { Field, Input, Textarea, Select } from "@/components/ui/form";
import { ServiceCard } from "@/components/ui/ServiceCard";
import { TestimonialCard } from "@/components/ui/TestimonialCard";
import { FAQList } from "@/components/ui/FAQItem";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";

// Internal preview of UI primitives. Disallowed in robots.txt; do not link publicly.
export const metadata = { title: "Components Preview", robots: { index: false, follow: false } };

export default function ComponentsPreview() {
  return (
    <Section>
      <Container className="space-y-12">
        <SectionHeading
          eyebrow="Internal"
          title="Components preview"
          intro="A reference page that renders every UI primitive."
        />

        <div className="space-y-3">
          <h2 className="text-xl">Buttons</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="light">Light</Button>
            <LinkButton href="/">Link button</LinkButton>
            <Badge>Badge</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <StatCard value="18+" label="Years" />
          <StatCard value="Wirral" label="Service area" />
          <StatCard value="Local" label="Wallasey" />
          <StatCard value="Design" label="Concept to drawings" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <ServiceCard title="Service card" blurb="A short blurb describing a service." href="#" />
          <TestimonialCard
            quote="An example, clearly-marked placeholder review."
            name="Placeholder"
            context="not a real review"
          />
        </div>

        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Input" htmlFor="p-i">
              <Input id="p-i" placeholder="Type here" />
            </Field>
            <Field label="Select" htmlFor="p-s">
              <Select id="p-s">
                <option>Option A</option>
                <option>Option B</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Textarea" htmlFor="p-t">
                <Textarea id="p-t" rows={3} />
              </Field>
            </div>
          </div>
        </Card>

        <BeforeAfterSlider caption="Before/after slider shell" />

        <FAQList
          faqs={[
            { q: "An FAQ question?", a: "An FAQ answer." },
            { q: "Another question?", a: "Another answer." },
          ]}
        />
      </Container>
    </Section>
  );
}
