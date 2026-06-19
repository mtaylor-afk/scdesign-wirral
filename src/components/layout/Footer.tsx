import Link from "next/link";
import { ReviewCta } from "@/components/ui/ReviewCta";
import { site, whatsappLink, defaultWhatsAppMessage } from "@/lib/site";
import {
  footerDesignServices,
  footerPlanningServices,
  footerLegalLinks,
  exploreLinks,
  type NavLink,
} from "@/lib/nav";

function LinkCol({ heading, links }: { heading: string; links: NavLink[] }) {
  return (
    <nav aria-label={heading}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-paper/50">{heading}</h2>
      <ul className="mt-4 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-paper/80 hover:text-white">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-6 lg:grid-cols-5 lg:px-8">
        <div className="lg:col-span-1">
          <div className="font-display text-xl">SC Design Wirral</div>
          <p className="mt-3 max-w-xs text-sm text-paper/60">{site.positioning}</p>
          <p className="mt-4 max-w-xs text-sm text-paper/50">
            An independent architectural{" "}
            <strong className="font-medium text-paper/70">design &amp; drawing service</strong> — we
            prepare your plans and work with trusted, certified builders to bring them to life.
          </p>
          <div className="mt-4 flex gap-4 text-sm">
            {site.socials.instagram && (
              <a
                href={site.socials.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-paper/80 hover:text-white"
              >
                Instagram
              </a>
            )}
            {site.socials.facebook && (
              <a
                href={site.socials.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="text-paper/80 hover:text-white"
              >
                Facebook
              </a>
            )}
          </div>

          <ReviewCta tone="footer" />
        </div>

        <LinkCol heading="Design services" links={footerDesignServices} />
        <LinkCol heading="Planning & approval" links={footerPlanningServices} />
        <LinkCol heading="Explore" links={exploreLinks} />

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-paper/50">
            Get in touch
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a
                href={`tel:${site.phoneE164}`}
                data-conversion="phone-click"
                className="text-paper/80 hover:text-white"
              >
                {site.phoneDisplay}
              </a>
            </li>
            <li>
              <a
                href={whatsappLink(defaultWhatsAppMessage)}
                data-conversion="whatsapp-click"
                target="_blank"
                rel="noopener noreferrer"
                className="text-paper/80 hover:text-white"
              >
                WhatsApp Sean
              </a>
            </li>
            <li>
              <a
                href={`mailto:${site.email}`}
                data-conversion="email-click"
                className="break-all text-paper/80 hover:text-white"
              >
                {site.email}
              </a>
            </li>
            <li className="pt-1 text-paper/60">Architectural design across {site.serviceArea}.</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-5 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 text-xs text-paper/50 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {year} {site.name}. Architectural design only — we do not carry out construction.
            </p>
            <ul className="flex flex-wrap gap-4">
              {footerLegalLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-xs text-paper/50">
            {site.name} · Registered in England &amp; Wales no. {site.companiesHouseNumber} ·
            Registered office: {site.registeredOffice}.
          </p>
          <p className="mt-4 text-center text-xs text-paper/50">
            <a
              href="https://tailoredquote.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-paper/60 hover:underline"
            >
              Visualised images powered by{" "}
              <span className="font-semibold text-paper">Tailored</span>
              <span className="font-semibold text-[#7aa2f7]">Quote</span>
              <span className="font-semibold text-paper/50">.co.uk</span>
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
