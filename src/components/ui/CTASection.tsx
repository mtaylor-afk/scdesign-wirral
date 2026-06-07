import { Container, Section, LinkButton } from "./index";
import { cta, whatsappLink, defaultWhatsAppMessage } from "@/lib/site";

export function CTASection({
  heading = "Ready to talk about your project?",
  sub = "Send Sean a few photos and a short description of what you'd like to do. You'll get an honest first view with no obligation.",
}: {
  heading?: string;
  sub?: string;
}) {
  return (
    <Section tone="ink">
      <Container className="text-center">
        <h2 className="mx-auto max-w-2xl text-balance text-3xl text-paper sm:text-4xl">
          {heading}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-paper/70">{sub}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <LinkButton href={cta.primary.href} variant="primary" size="lg">
            {cta.primary.label}
          </LinkButton>
          <LinkButton
            href={whatsappLink(defaultWhatsAppMessage)}
            variant="light"
            size="lg"
            external
          >
            {cta.whatsapp.label}
          </LinkButton>
        </div>
      </Container>
    </Section>
  );
}
