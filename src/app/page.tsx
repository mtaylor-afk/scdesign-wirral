import Link from "next/link";
import {
  Container,
  Section,
  LinkButton,
  SectionHeading,
  Card,
  Bento,
  BentoTile,
} from "@/components/ui";
import { ReviewsSummary, GoogleRatingLine, ReviewCard } from "@/components/ui/Testimonials";
import { CTA_MICROCOPY } from "@/components/ui/CTASection";
import { ReviewsCarousel } from "@/components/ui/ReviewsCarousel";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";
import { FAQList } from "@/components/ui/FAQItem";
import { MeetSean } from "@/components/ui/MeetSean";
import { EnquiryForm } from "@/components/EnquiryForm";
import { JsonLd } from "@/components/JsonLd";
import { withBase } from "@/lib/base";
import { homeFaqs } from "@/lib/faqs";
import { reviews } from "@/lib/reviews";
import { publishedProjects } from "@/lib/projects";
import { ProjectCardGrid } from "@/components/ui/ProjectCard";
import { KindTag } from "@/components/ui/WorkGallery";
import { getService } from "@/lib/services";
import { getServiceMedia, wi, type WorkImage } from "@/lib/media";
import { site, cta, whatsappLink, defaultWhatsAppMessage } from "@/lib/site";
import { faqJsonLd, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title:
    "Architectural Designer Wirral | Extensions, Lofts & Planning Drawings | SC Design & Construction",
  description:
    "Wirral architectural designer helping homeowners across Wirral, Liverpool, Cheshire, Warrington and North Wales with house extension drawings, loft conversion design, planning and building-regulations drawings. Led by a Chartered Architectural Technologist (MCIAT).",
  path: "/",
});

// Sean's main services (brief: "modified to the main service I offer") — each a
// photo tile that opens the full service breakdown.
const mainServiceSlugs = [
  "house-extensions",
  "loft-conversions",
  "garage-conversion-drawings-wirral",
  "front-porch-extension-design",
  "bespoke-garden-room-design",
  "planning-drawings-wirral",
  "building-regulations-drawings-wirral",
  "residential-design",
];
const mainServices = mainServiceSlugs
  .map((slug) => getService(slug))
  .filter((s): s is NonNullable<typeof s> => Boolean(s));

// The three projects shown on the home page. Takes the top of the published
// order, which is Sean's own running order on /projects — so re-ordering there
// re-orders the home page too, with nothing to keep in sync by hand.
const featuredProjects = publishedProjects.slice(0, 3);

/**
 * Sean's step-by-step plan (brief, Sep 2026). Hedged where it has to be: the
 * planning step only applies to some projects, and the build itself is carried
 * out by the homeowner's own builder, not by SC Design.
 */
const processSteps: { title: string; body: string }[] = [
  {
    title: "Free consultation",
    body: "A no-obligation conversation about what you want from the space, the likely planning route and a realistic budget.",
  },
  {
    title: "Measured survey",
    body: "We measure the property and draw it accurately as it exists today — the foundation everything else is built on.",
  },
  {
    title: "Design concepts",
    body: "Layout options to compare, developed around how you actually live and what the property will allow.",
  },
  {
    title: "Planning submission",
    body: "If your project needs permission, we prepare the drawings and supporting documents and manage the application with the council.",
  },
  {
    title: "Building regulations drawings",
    body: "The technical package — structure, insulation, fire safety, drainage and ventilation — for building control and your builder.",
  },
  {
    title: "Construction support",
    body: "We coordinate with a structural engineer for the calculations and answer builders' queries as the job progresses.",
  },
  {
    title: "Builder quotes",
    body: "With one clear drawing package, several builders can price the same scope so you compare like with like.",
  },
];

// Hero drag-to-compare. Sean's caption ("Side Elevation & Garage Conversions")
// describes the Wallasey Village side extension, which replaced the old garage
// and bin store — so the hero now uses that project's real before photo and its
// design visualisation rather than the generic pair.
const heroBefore = wi("wvSideExtExisting");
const heroAfter = wi("wvSideExtConcept");

// The three reviews Sean picked for the home page (brief, Sep 2026), shown side
// by side high up. Genuine Google reviews, verbatim — the array order follows
// Sean's list rather than reviews.ts order.
const featuredReviewAuthors = ["Graham Edge", "Ryan Hirst", "Ray Dyer"];
const featuredReviews = featuredReviewAuthors
  .map((author) => reviews.find((r) => r.author === author))
  .filter((r): r is NonNullable<typeof r> => Boolean(r));

/** "Why choose SC Design?" — Sean's list (brief, Sep 2026). */
const whyPoints: { title: string; body: string }[] = [
  { title: "MCIAT", body: "Chartered Architectural Technologist" },
  {
    title: `${site.yearsExperience}+ years`,
    body: "Designing homes across Merseyside, after six years on site as a builder",
  },
  {
    title: "Local Wirral specialist & surrounding areas",
    body: "Wirral, Liverpool, Cheshire, Warrington & North Wales",
  },
  {
    title: "Fixed fee quotations",
    body: "Agreed before we start, so you know the cost from the outset",
  },
  {
    title: "Friendly one-to-one service",
    body: "You deal with Sean directly, from the first call to the final drawing",
  },
  {
    title: "Builder-independent advice",
    body: "We design only and never carry out the build, so the advice stays impartial",
  },
  {
    title: "Builder-ready drawings",
    body: "Clear packages so several builders can price like for like",
  },
];

const drawingsHelp: { term: string; body: string; href: string; cta: string }[] = [
  {
    term: "Planning drawings",
    body: "Show the council what you want to build and how it looks. Needed when your project requires planning permission.",
    href: "/guides/do-i-need-planning-permission-for-an-extension",
    cta: "Do I need planning permission?",
  },
  {
    term: "Building-regulations drawings",
    body: "Show how the work is built and meets safety and energy standards. Needed for almost all building work.",
    href: "/guides/do-i-need-building-regulations-approval",
    cta: "Do I need building regs?",
  },
  {
    term: "Builder-quote drawings",
    body: "Let several builders price the same scope, so you compare like with like and the build matches what you agreed.",
    href: "/guides/what-drawings-do-builders-need",
    cta: "What drawings do builders need?",
  },
];

const homeGuides: { title: string; blurb: string; href: string }[] = [
  {
    title: "Full Plans vs Building Notice",
    blurb: "The two building-control routes — and which suits an extension, loft or garage conversion.",
    href: "/guides/full-plans-vs-building-notice-wirral",
  },
  {
    title: "Planning application drawings",
    blurb: "What drawings and documents a Wirral householder application needs to be valid.",
    href: "/guides/wirral-householder-planning-application-drawings-checklist",
  },
  {
    title: "Garage conversion rules",
    blurb: "Planning and building-regulations basics before you convert a garage in Wirral.",
    href: "/guides/garage-conversion-planning-building-regulations-wirral",
  },
  {
    title: "After planning permission",
    blurb: "The next steps once you're approved: building regs, calculations and builder quotes.",
    href: "/guides/after-planning-permission-next-steps",
  },
];

/** Image tile (Apple bento) — photo fills, gradient + label at the bottom.
 *  Non-photo images (drawings/renders) carry a KindTag so they're never passed
 *  off as completed builds, and a stronger gradient keeps the title legible over
 *  light line-art. */
function ImageTile({
  image,
  title,
  href,
  span,
  tall = false,
  track,
}: {
  image?: WorkImage;
  title: string;
  href?: string;
  span: number;
  tall?: boolean;
  track?: string;
}) {
  const drawing = image?.kind === "drawing";
  return (
    <BentoTile span={span} tone="ink" href={href} track={track} className={tall ? "min-h-72" : "min-h-56"}>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={withBase(image.src)}
          alt={image.alt}
          width={image.width}
          height={image.height}
          loading="lazy"
          decoding="async"
          className={
            "absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.04] " +
            (drawing ? "bg-white object-contain p-3" : "object-cover")
          }
        />
      )}
      {image && <KindTag kind={image.kind} />}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/45 to-transparent"
      />
      <div className="relative mt-auto p-5 sm:p-6">
        <h3 className={tall ? "text-2xl text-paper" : "text-xl text-paper"}>{title}</h3>
        {href && (
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-paper/90 transition-[gap] group-hover:gap-2.5">
            Explore <span aria-hidden>→</span>
          </span>
        )}
      </div>
    </BentoTile>
  );
}

export default function HomePage() {
  return (
    <>
      <JsonLd data={faqJsonLd(homeFaqs)} />

      {/* HERO — larger, more breathing room; the before/after is the LCP media. */}
      <Section tone="card" className="relative overflow-hidden pt-16 pb-24 sm:pt-24">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent-strong">
                Architectural Design — Wirral, Cheshire and Merseyside plus surrounding areas
              </p>
              {/* Sean's wording (brief, Sep 2026): short red H1, the keyword-rich
                  service line in black beneath it, then the grey lead. */}
              <h1 className="text-balance text-5xl leading-[1.03] text-accent-strong sm:text-6xl lg:text-[4.2rem]">
                Architectural Design Services in Wirral
              </h1>
              <p className="mt-5 max-w-2xl text-pretty text-xl leading-snug font-medium text-ink sm:text-2xl">
                Surveys, Planning, Building Regulations Packages including Home Extensions, Loft
                &amp; Garage Conversion, Garden Rooms, Front Porch Extension and all Architectural
                Services Across Wirral, Cheshire &amp; Merseyside.
              </p>
              <p className="mt-6 max-w-xl text-pretty text-lg text-muted">
                Friendly, practical, family-focused architectural design across Wirral and Cheshire.
                Led by Sean Corser MCIAT, Chartered Architectural Technologist, we guide homeowners
                from first ideas through planning permission, building regulations and detailed
                construction drawings — giving builders everything they need to price and build with
                confidence.
              </p>
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
                  Main areas we cover
                </p>
                <ul className="mt-2 flex flex-wrap gap-2" aria-label="Main areas we cover">
                  {site.regions.map((r) => (
                    <li
                      key={r}
                      className="rounded-full border border-line bg-paper px-3 py-1 text-sm text-ink-soft"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <LinkButton href="/areas" size="md">
                    See all the areas we cover
                  </LinkButton>
                </div>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href={cta.primary.href} size="lg" track="contact-cta">
                  {cta.primary.label}
                </LinkButton>
                <LinkButton href={cta.visualiser.href} size="lg" track="visualiser-start">
                  {cta.visualiser.label}
                </LinkButton>
                <LinkButton
                  href={whatsappLink(defaultWhatsAppMessage)}
                  variant="ghost"
                  size="lg"
                  external
                  track="whatsapp-click"
                >
                  {cta.whatsapp.label}
                </LinkButton>
              </div>
              <p className="mt-4 text-sm text-ink-soft">{CTA_MICROCOPY}</p>
            </div>

            <div className="lg:pl-4">
              <div className="overflow-hidden rounded-[var(--radius-xl)] shadow-tile">
                <BeforeAfterSlider
                  before={heroBefore.src}
                  after={heroAfter.src}
                  beforeAlt={heroBefore.alt}
                  afterAlt={heroAfter.alt}
                  caption="Side Elevation & Garage Conversions Before & After — drag to compare. The ‘after’ is a design visualisation of the approved scheme."
                  priority
                />
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* WHY CHOOSE SC DESIGN? — credentials + the promises from Sean's brief */}
      <Section tone="fog" className="py-14">
        <Container>
          <SectionHeading
            eyebrow="Credentials"
            title="Why choose SC Design?"
            align="center"
          />
          <div
            data-reveal
            className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4"
          >
            {whyPoints.map((p) => (
              <div
                key={p.title}
                className="rounded-[var(--radius-xl)] border border-line bg-paper-card p-6 text-center shadow-tile"
              >
                <p className="font-display text-xl text-balance text-ink">{p.title}</p>
                <p className="mt-2 text-sm text-pretty text-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* REVIEWS — Sean asked for these to be the 2nd/3rd thing a visitor sees. */}
      <Section tone="card" className="py-14">
        <Container>
          <SectionHeading
            eyebrow="Reviews"
            title="What homeowners and builders say"
            intro="Genuine, verified reviews from the SC Design Google profile."
            align="center"
          />
          <div className="mt-6 flex justify-center">
            <ReviewsSummary align="center" />
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {featuredReviews.map((r) => (
              <ReviewCard key={r.author} review={r} />
            ))}
          </div>
          <p className="mt-8 text-center text-sm">
            <Link href="/reviews" className="font-medium text-accent-strong underline">
              See all reviews
            </Link>
          </p>
        </Container>
      </Section>

      {/* OUR MAIN SERVICES — Apple bento grid */}
      <Section tone="card">
        <Container>
          <SectionHeading
            eyebrow="What we help with"
            title="Our main services"
            intro="Tap a service to see what's involved. Design only — we don't carry out the building work, which keeps our advice focused on getting your design right."
          />
          <Bento className="mt-12">
            {mainServices.map((s, i) => (
              <ImageTile
                key={s.slug}
                image={getServiceMedia(s.slug).card}
                title={s.title}
                href={`/services/${s.slug}`}
                span={i < 2 ? 3 : 2}
                tall={i < 2}
                track="service-cta"
              />
            ))}
          </Bento>
          <div className="mt-8">
            <LinkButton href="/services" variant="ghost">
              See all services
            </LinkButton>
          </div>
        </Container>
      </Section>

      {/* FEATURED PROJECTS — Sean's brief: three recent projects, each with a
          large image, the town, the project type, a short description and a link
          to the full case study. Project pages perform well in local search. */}
      <Section tone="mist">
        <Container>
          <SectionHeading
            eyebrow="Recent work"
            title="Real projects, designed by Sean"
            intro="Extensions, loft and garage conversions designed by SC Design Wirral and built by the homeowners' own builders. Each one has a full case study — the brief, the design response and the drawings prepared."
          />
          <div data-reveal className="mt-12">
            <ProjectCardGrid projects={featuredProjects} />
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/projects">See all projects &amp; portfolio</LinkButton>
            <LinkButton href="/portfolio" variant="ghost">
              Design visualisations
            </LinkButton>
          </div>
        </Container>
      </Section>

      {/* OUR PROCESS — Sean's step-by-step plan (brief, Sep 2026) */}
      <Section>
        <Container>
          <SectionHeading
            eyebrow="How it works"
            title="Your project, step by step"
            intro="Most homeowner projects follow the same route. Not every step applies to every job — we'll tell you which ones yours needs at the first conversation."
          />
          <ol data-reveal className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {processSteps.map((s, i) => (
              <li
                key={s.title}
                className="flex h-full flex-col rounded-[var(--radius-xl)] border border-line bg-paper-card p-6 shadow-tile"
              >
                <span className="font-display text-3xl text-accent-strong">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg">{s.title}</h3>
                <p className="mt-2 text-pretty text-sm text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <LinkButton href="/process" variant="ghost">
              See the full process
            </LinkButton>
          </div>
        </Container>
      </Section>

      {/* MEET SEAN */}
      <Section>
        <Container className="max-w-4xl">
          <SectionHeading eyebrow="Meet Sean" title="Design experience — backed by years on site" />
          <div data-reveal className="mt-12">
            <MeetSean />
          </div>
        </Container>
      </Section>

      {/* MORE REVIEWS — the rotating window of every genuine Google review.
          The three Sean picked sit high up the page; this keeps the rest. */}
      <Section tone="fog">
        <Container>
          <SectionHeading
            eyebrow="More reviews"
            title="More from homeowners and builders"
            intro="Every review below is genuine and published on the SC Design Google profile."
            align="center"
          />
          <ReviewsCarousel className="mt-10" />
          <p className="mt-8 text-center text-sm text-muted">
            <Link href="/reviews" className="font-medium text-accent-strong underline">
              See all reviews
            </Link>
          </p>
        </Container>
      </Section>

      {/* NOT SURE WHAT DRAWINGS YOU NEED */}
      <Section>
        <Container>
          <SectionHeading
            eyebrow="Plain English"
            title="Not sure what drawings you need?"
            intro="Most projects involve one or two different sets of drawings, prepared at different stages. Here's the quick version — and a guide for each."
          />
          <div data-reveal className="mt-12 grid gap-6 lg:grid-cols-3">
            {drawingsHelp.map((d) => (
              <Card key={d.term} className="flex h-full flex-col">
                <h3 className="text-xl">{d.term}</h3>
                <p className="mt-2 flex-1 text-pretty text-muted">{d.body}</p>
                <Link
                  href={d.href}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong"
                >
                  {d.cta} <span aria-hidden>→</span>
                </Link>
              </Card>
            ))}
          </div>
          <p className="mt-8 text-sm text-muted">
            Wondering whether your project needs permission at all?{" "}
            <Link href="/homeowners-guide" className="font-medium text-accent-strong underline">
              Try the interactive planning guide
            </Link>
          </p>
        </Container>
      </Section>

      {/* VISUALISER TEASER — full-bleed dark "product" band */}
      <Section tone="ink">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div data-reveal>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                AI Extension Concept Visualiser
              </p>
              <h2 className="text-balance text-4xl text-paper sm:text-5xl">
                See a concept-style extension idea before you speak to Sean
              </h2>
              <p className="mt-5 max-w-lg text-pretty text-lg text-paper/70">
                Upload a photo of your home, choose a few options and get an AI concept visualisation
                — with an estimated build-cost guide — in moments. A fun, no-pressure way to picture
                possibilities and an easy first step toward a real conversation.
              </p>
              <p className="mt-3 text-sm text-paper/50">
                Concept visualisation only — not an architectural drawing or planning advice.
              </p>
              <div className="mt-8">
                <LinkButton href="/visualiser" variant="primary" size="lg" track="visualiser-start">
                  {cta.visualiser.label}
                </LinkButton>
              </div>
            </div>
            <div
              data-reveal
              className="overflow-hidden rounded-[var(--radius-xl)] border border-white/10 bg-white/5 p-6"
            >
              <BeforeAfterSlider
                before="/examples/conservatory-before.jpg"
                after="/examples/conservatory-after.jpg"
                beforeAlt="Conservatory before — tired existing conservatory"
                afterAlt="Conservatory after — AI concept visualisation"
                caption="AI concept visualisation (illustrative)."
              />
            </div>
          </div>
        </Container>
      </Section>

      {/* FAQs */}
      <Section tone="fog">
        <Container className="max-w-3xl">
          <SectionHeading eyebrow="Good to know" title="Frequently asked questions" align="center" />
          <div data-reveal className="mt-8">
            <FAQList faqs={homeFaqs} />
          </div>
          <p className="mt-8 text-center text-sm text-muted">
            <Link href="/faqs" className="font-medium text-accent-strong underline">
              See all FAQs
            </Link>
          </p>
        </Container>
      </Section>

      {/* HELPFUL HOMEOWNER GUIDES — bento tiles */}
      <Section tone="card">
        <Container>
          <SectionHeading
            eyebrow="Homeowner guides"
            title="Helpful homeowner guides"
            intro="Plain-English answers to the planning and building-control questions homeowners ask most — written to help you decide before you get in touch."
          />
          <Bento className="mt-12">
            {homeGuides.map((g) => (
              <BentoTile key={g.href} span={3} tone="card" href={g.href} className="p-6 lg:col-span-3">
                <h3 className="text-lg">{g.title}</h3>
                <p className="mt-2 flex-1 text-pretty text-muted">{g.blurb}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong transition-[gap] group-hover:gap-2.5">
                  Read the guide <span aria-hidden>→</span>
                </span>
              </BentoTile>
            ))}
          </Bento>
          <div className="mt-8">
            <LinkButton href="/guides" variant="ghost">
              See all homeowner guides
            </LinkButton>
          </div>
        </Container>
      </Section>

      {/* BOOK A FREE CONSULTATION — Sean's closing CTA + quick form */}
      <Section tone="ink" id="book">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div data-reveal>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Free &amp; no obligation
              </p>
              <h2 className="text-balance text-4xl text-paper sm:text-5xl">{cta.consultation.label}</h2>
              <p className="mt-5 max-w-md text-pretty text-lg text-paper/70">
                Tell Sean about your project — your name, one way to contact you and a brief
                description is all it takes. You&apos;ll get an honest first view of the likely design
                and planning route, with no obligation.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-paper/80">
                <li className="flex gap-2">
                  <span aria-hidden className="text-accent">✓</span>
                  Only your name and a phone number or email are required
                </li>
                <li className="flex gap-2">
                  <span aria-hidden className="text-accent">✓</span>
                  Photos and a postcode help, but can follow later
                </li>
                <li className="flex gap-2">
                  <span aria-hidden className="text-accent">✓</span>
                  Design only — impartial advice, no sales pitch for a build
                </li>
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href={`tel:${site.phoneE164}`} variant="light" track="phone-click">
                  Call {site.phoneDisplay}
                </LinkButton>
                <LinkButton
                  href={whatsappLink(defaultWhatsAppMessage)}
                  variant="light"
                  external
                  track="whatsapp-click"
                >
                  {cta.whatsapp.label}
                </LinkButton>
              </div>
            </div>
            <div
              data-reveal
              className="rounded-[var(--radius-xl)] bg-paper-card p-6 text-ink shadow-tile sm:p-8"
            >
              <GoogleRatingLine className="mb-5" />
              <EnquiryForm
                source="home_consultation"
                heading="Tell us about your project"
                intro="Name, one way to contact you and a brief description — that's all Sean needs to get started."
                compact
              />
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
