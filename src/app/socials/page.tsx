import { Container, Section, LinkButton, Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CTASection } from "@/components/ui/CTASection";
import { JsonLd } from "@/components/JsonLd";
import { site } from "@/lib/site";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Follow SC Design Wirral — Facebook & Instagram",
  description:
    "Follow SC Design Wirral on Facebook and Instagram for new extension, loft and garage conversion designs, drawings in progress and photos from site across Wirral, Cheshire and Merseyside.",
  path: "/socials",
});

/**
 * Sean's public profiles, with an honest line on what each one actually shows.
 * `sc.construction.work` posts progress photos from builds of Sean's designs —
 * described as exactly that, so it never reads as SC Design doing the building.
 */
const accounts = [
  {
    platform: "Facebook",
    handle: "SC Design & Construction",
    href: site.socials.facebook,
    what: "Project updates, finished extensions and loft conversions, and the occasional planning win. The best place to see what we've been working on recently.",
  },
  {
    platform: "Instagram",
    handle: "@sc.design.wirral",
    href: site.socials.instagram,
    what: "The design side — concept visualisations, plans and elevations, and before-and-after comparisons of Wirral homes.",
  },
  {
    platform: "Instagram",
    handle: "@sc.construction.work",
    href: site.socials.instagramWork,
    what: "Progress photos from site as builders construct schemes we've designed — steels going in, foundations, first fix and finished rooms. Useful if you like seeing how a drawing turns into a building.",
  },
];

export default function SocialsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Socials", path: "/socials" },
        ])}
      />

      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Socials", path: "/socials" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">Follow SC Design Wirral</h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            New designs, drawings in progress and photos from site — across Wirral, Cheshire and
            Merseyside. If you&apos;re weighing up an extension, a loft or a garage conversion,
            these are the quickest way to see the kind of work we do.
          </p>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => (
              <Card key={a.href} hover className="flex h-full flex-col">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-strong">
                  {a.platform}
                </p>
                <h2 className="mt-2 text-xl">{a.handle}</h2>
                <p className="mt-3 flex-1 text-pretty text-muted">{a.what}</p>
                <div className="mt-6">
                  <LinkButton href={a.href} variant="ghost" external track="social-click">
                    Open on {a.platform}
                  </LinkButton>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-12 rounded-[var(--radius)] border border-line bg-paper-card p-6">
            <h2 className="text-lg">Rather see the full projects?</h2>
            <p className="mt-2 max-w-2xl text-pretty text-muted">
              Social posts are snapshots. The case studies set out the whole story — the brief, the
              design response, the drawings prepared and how it turned out.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <LinkButton href="/projects" variant="ghost">
                Projects &amp; portfolio
              </LinkButton>
              <LinkButton href="/reviews" variant="ghost">
                Read the reviews
              </LinkButton>
            </div>
          </div>
        </Container>
      </Section>

      <CTASection heading="Thinking about a project of your own?" />
    </>
  );
}
