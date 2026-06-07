import { Container, Section, Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ContactForm } from "@/components/ContactForm";
import { JsonLd } from "@/components/JsonLd";
import { site, whatsappLink, defaultWhatsAppMessage } from "@/lib/site";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Contact Sean",
  description:
    "Send Sean your project idea, photos and postcode for an honest first view on your extension, loft conversion or planning drawing project. Architectural design across Wirral.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />
      <Section tone="card" className="pt-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: "Contact", path: "/contact" },
            ]}
          />
          <h1 className="text-balance text-4xl sm:text-5xl">Send Sean your project idea</h1>
          <p className="mt-5 text-pretty text-lg text-muted">
            Tell us what you&apos;re hoping to do, where the property is and what stage you&apos;re
            at. A few photos and a short description are enough for an honest first view — with no
            obligation. We design only; we don&apos;t carry out the building work.
          </p>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <ContactForm />
            </div>

            <aside className="space-y-5">
              <Card>
                <h2 className="text-lg">Quick contact</h2>
                <ul className="mt-4 space-y-3 text-sm">
                  <li>
                    <a href={`tel:${site.phoneE164}`} className="font-medium text-accent-strong">
                      Call {site.phoneDisplay}
                    </a>
                  </li>
                  <li>
                    <a
                      href={whatsappLink(defaultWhatsAppMessage)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-accent-strong"
                    >
                      WhatsApp Sean
                    </a>
                  </li>
                  <li>
                    <a
                      href={`mailto:${site.email}`}
                      className="break-all font-medium text-accent-strong"
                    >
                      {site.email}
                    </a>
                  </li>
                </ul>
              </Card>

              <Card>
                <h2 className="text-lg">Service area</h2>
                <p className="mt-2 text-sm text-muted">
                  Based in Wallasey, working across {site.serviceArea}. We work to your property, so
                  a postcode helps us confirm we cover you.
                </p>
              </Card>

              <Card>
                <h2 className="text-lg">What happens next</h2>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-muted">
                  <li>Sean reads your message and any photos.</li>
                  <li>We come back to you with an honest first view.</li>
                  <li>If it&apos;s a fit, we talk through the design approach.</li>
                </ol>
              </Card>
            </aside>
          </div>
        </Container>
      </Section>
    </>
  );
}
