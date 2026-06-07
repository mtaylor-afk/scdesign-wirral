import { Container, Section, Card, LinkButton } from "@/components/ui";
import { site, whatsappLink, defaultWhatsAppMessage } from "@/lib/site";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Thank You",
  description: "Thanks for getting in touch. Sean will review your message and come back to you.",
  path: "/contact/thank-you",
  noindex: true,
});

export default function ThankYouPage() {
  return (
    <>
      <Section tone="card" className="pt-16">
        <Container className="max-w-2xl">
          <h1 className="text-balance text-4xl sm:text-5xl">Thanks — message received</h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            Sean will read your message and any details you sent, and come back to you with an honest
            first view of the likely design route — with no obligation.
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="max-w-2xl space-y-6">
          <Card>
            <h2 className="text-lg">What happens next</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
              <li>Sean reviews your message, postcode and any photos.</li>
              <li>We come back to you with an honest first view.</li>
              <li>If it&apos;s a fit, we talk through the design approach and what&apos;s involved.</li>
            </ol>
          </Card>

          <Card>
            <h2 className="text-lg">Prefer to talk now?</h2>
            <p className="mt-2 text-sm text-muted">
              You&apos;re welcome to call or WhatsApp — sending a few photos by WhatsApp is the
              quickest way to give us a feel for your project.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <LinkButton href={`tel:${site.phoneE164}`}>Call {site.phoneDisplay}</LinkButton>
              <LinkButton href={whatsappLink(defaultWhatsAppMessage)} variant="ghost" external>
                WhatsApp Sean
              </LinkButton>
            </div>
          </Card>

          <div className="flex flex-wrap gap-3">
            <LinkButton href="/" variant="ghost">
              Back to home
            </LinkButton>
            <LinkButton href="/guides" variant="ghost">
              Read our guides
            </LinkButton>
          </div>
        </Container>
      </Section>
    </>
  );
}
