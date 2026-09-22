import { Container, Section, LinkButton } from "./index";
import { cta, whatsappLink, defaultWhatsAppMessage } from "@/lib/site";

/**
 * The reassurance line under every CTA button row (Sean's brief, Sep 2026).
 * Exported so the home hero and any other button row can use the same wording.
 */
export const CTA_MICROCOPY =
  "Free initial conversation · No obligation · Usually replies within one working day";

export function CTASection({
  heading = "Ready to talk about your project?",
  sub = "All you need to start is your name and one way to contact you. A short description, postcode or a few photos help if you have them — but they're not required.",
  track = "contact-cta",
  // Bottom-of-page panels use Sean's "Book a free consultation" (owner-approved
  // 2026-09-12); nav / hero / mobile bar keep cta.primary.
  primaryLabel = cta.consultation.label,
  ctaHref = cta.consultation.href,
}: {
  heading?: string;
  sub?: string;
  /** Conversion label for the primary button (e.g. service-cta / area-cta / guide-cta). */
  track?: string;
  /** Override the primary button label (e.g. "Ask Sean for an honest first view"). */
  primaryLabel?: string;
  /** Override the primary button href — e.g. "/contact?source=area&area=wallasey". */
  ctaHref?: string;
}) {
  return (
    <Section tone="ink">
      <Container className="text-center">
        <h2 className="mx-auto max-w-2xl text-balance text-3xl text-paper sm:text-4xl">
          {heading}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-paper/70">{sub}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <LinkButton href={ctaHref} variant="primary" size="lg" track={track}>
            {primaryLabel}
          </LinkButton>
          {/* Same size and same red as the primary, sitting alongside it —
              Sean's brief asks for this on every page. */}
          <LinkButton
            href={cta.visualiser.href}
            variant="primary"
            size="lg"
            track="visualiser-start"
          >
            {cta.visualiser.label}
          </LinkButton>
          <LinkButton
            href={whatsappLink(defaultWhatsAppMessage)}
            variant="light"
            size="lg"
            external
            track="whatsapp-click"
          >
            {cta.whatsapp.label}
          </LinkButton>
        </div>
        <p className="mt-5 text-sm text-paper/60">{CTA_MICROCOPY}</p>
      </Container>
    </Section>
  );
}
