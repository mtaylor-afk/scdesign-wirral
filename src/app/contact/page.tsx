import Link from "next/link";
import { Container, Section, Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EnquiryForm } from "@/components/EnquiryForm";
import { ReviewCta } from "@/components/ui/ReviewCta";
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
            Minimum needed: your name and one way to contact you. Project details are optional — a
            postcode, a few photos or a short description help if you have them, but you don&apos;t
            need anything prepared to start. No obligation; we design only and don&apos;t carry out
            the building work.
          </p>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <EnquiryForm />
            </div>

            <aside className="space-y-5">
              <Card>
                <h2 className="text-lg">Quick contact</h2>
                <ul className="mt-4 space-y-3 text-sm">
                  <li>
                    <a
                      href={`tel:${site.phoneE164}`}
                      data-conversion="phone-click"
                      className="font-medium text-accent-strong"
                    >
                      Call {site.phoneDisplay}
                    </a>
                  </li>
                  <li>
                    <a
                      href={whatsappLink(defaultWhatsAppMessage)}
                      data-conversion="whatsapp-click"
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
                      data-conversion="email-click"
                      className="break-all font-medium text-accent-strong"
                    >
                      {site.email}
                    </a>
                  </li>
                </ul>
              </Card>

              <Card>
                <h2 className="text-lg">Where we work</h2>
                <p className="mt-2 text-sm text-muted">
                  A service-area practice covering {site.serviceArea} — we come to your property, so
                  there&apos;s no office to visit.
                </p>
                <p className="mt-2 text-xs text-muted">
                  {site.name} · registered in England &amp; Wales no. {site.companiesHouseNumber}.
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

              <Card>
                <h2 className="text-lg">Not sure what to send?</h2>
                <p className="mt-2 text-sm text-muted">
                  Our quick guide explains exactly what helps — and what you don&apos;t need to worry
                  about yet.
                </p>
                <Link
                  href="/guides/how-to-brief-architectural-designer-extension"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong"
                >
                  How to brief a designer <span aria-hidden>→</span>
                </Link>
              </Card>

              <ReviewCta />
            </aside>
          </div>
        </Container>
      </Section>
    </>
  );
}
