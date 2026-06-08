import Link from "next/link";
import { Container, Section, Card, LinkButton } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { cta } from "@/lib/site";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Our Architectural Design Process",
  description:
    "How we work — from your first idea through to planning-ready drawings, building-regulations drawings and a builder handover. A clear, homeowner-friendly process for Wirral.",
  path: "/process",
});

const stages: { title: string; you: string; us: string; output: string }[] = [
  {
    title: "Send Sean your project idea",
    you: "Send a few photos, your postcode and a short description of what you'd like to achieve.",
    us: "We give you an honest first view of what's realistic — with no obligation.",
    output: "A quick, no-pressure first reply.",
  },
  {
    title: "Initial review of property & photos",
    you: "Share any existing plans or an estate-agent floorplan if you have one.",
    us: "We look at the property, its setting and the likely planning context.",
    output: "An early sense of the options and route.",
  },
  {
    title: "Brief & design discussion",
    you: "Tell us how you live and what matters most — light, space, budget, priorities.",
    us: "We shape the brief with you so the design solves the right problem.",
    output: "A clear, agreed brief.",
  },
  {
    title: "Measured survey / property information",
    you: "Give us access or accurate measurements of the area affected.",
    us: "We gather the information needed to draw the property accurately.",
    output: "Reliable measured information.",
  },
  {
    title: "Existing drawings",
    you: "Confirm the existing layout is correct.",
    us: "We prepare accurate existing plans and elevations.",
    output: "Existing drawings of the property as it is.",
  },
  {
    title: "Concept design & layout options",
    you: "React to the options — what you love, what you'd change.",
    us: "We develop the concept and, where useful, compare a few approaches.",
    output: "A design direction you understand and feel confident about.",
  },
  {
    title: "Planning route check",
    you: "Let us know of any constraints you're aware of (e.g. conservation area).",
    us: "We advise on the likely route — permitted development, full application or a lawful development certificate — subject to confirmation with the local authority.",
    output: "A clear view of the likely planning route.",
  },
  {
    title: "Planning drawings or lawful development drawings",
    you: "Approve the proposed design.",
    us: "We prepare the drawings to support a planning application or certificate, and support the submission.",
    output: "Planning-ready drawings.",
  },
  {
    title: "Building-regulations drawings (if needed)",
    you: "Confirm you're ready for the build stage.",
    us: "We prepare the technical drawings for building control, coordinating with a structural engineer where calculations are needed.",
    output: "Building-control drawings.",
  },
  {
    title: "Builder quotation pack & handover",
    you: "Take the drawings to builders to quote.",
    us: "We hand over a clear drawing pack and are happy to explain the build stage.",
    output: "A complete pack builders can quote and build from.",
  },
];

const notIncluded = [
  "Structural engineer calculations may be a separate, specialist cost.",
  "Local authority planning application fees are paid to the council.",
  "Building-control fees are paid to building control or an approved inspector.",
  "Party wall matters may need a party wall surveyor.",
  "The construction work itself — we are design-only and don't carry out the build.",
];

export default function ProcessPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Process", path: "/process" },
        ])}
      />
      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Process", path: "/process" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">
            How our architectural design process works
          </h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            No jargon, no pressure — a clear path from your first idea to drawings a builder can
            quote and build from. Here&apos;s what happens at each stage, what you do, and what you
            get.
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl">
          <ol className="list-none space-y-8">
            {stages.map((s, i) => (
              <li key={s.title} className="relative border-l border-line pl-8">
                <span className="absolute -left-4 flex h-8 w-8 items-center justify-center rounded-full bg-accent-strong text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <h2 className="text-2xl">{s.title}</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-semibold text-ink">You:</dt>
                    <dd className="text-muted">{s.you}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-semibold text-ink">We:</dt>
                    <dd className="text-muted">{s.us}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-semibold text-accent-strong">Output:</dt>
                    <dd className="text-ink-soft">{s.output}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>

          <div className="mt-8">
            <LinkButton href={cta.primary.href}>{cta.primary.label}</LinkButton>
          </div>
        </Container>
      </Section>

      <Section tone="card">
        <Container className="max-w-3xl">
          <Card>
            <h2 className="text-xl">What isn&apos;t included automatically</h2>
            <ul className="mt-4 space-y-2.5">
              {notIncluded.map((n) => (
                <li key={n} className="flex gap-3 text-pretty text-muted">
                  <span className="mt-1 shrink-0 text-accent-strong" aria-hidden>
                    ◆
                  </span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </Card>

          <h2 className="mt-10 text-xl">Helpful guides</h2>
          <ul className="mt-4 flex flex-wrap gap-2.5">
            {[
              {
                label: "How to brief a designer",
                href: "/guides/how-to-brief-architectural-designer-extension",
              },
              {
                label: "Builder quote pack checklist",
                href: "/guides/builder-quote-drawing-pack-checklist",
              },
              {
                label: "After planning permission",
                href: "/guides/after-planning-permission-next-steps",
              },
            ].map((g) => (
              <li key={g.href}>
                <Link
                  href={g.href}
                  className="inline-flex rounded-full border border-line bg-paper-card px-4 py-2 text-sm text-ink-soft hover:border-accent hover:text-accent-strong"
                >
                  {g.label}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <CTASection />
    </>
  );
}
