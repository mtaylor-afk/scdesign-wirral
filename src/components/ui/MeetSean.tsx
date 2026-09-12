import Link from "next/link";
import { site } from "@/lib/site";
import { withBase } from "@/lib/base";
import { cn } from "@/lib/utils";

/**
 * Sean's own first-person introduction (from his brief) with his credentials.
 * Avatar = his headshot once `site.headshot` is set, otherwise the SC logo
 * roundel — so there is never a visible placeholder.
 */
export function MeetSean({
  showAboutLink = true,
  className,
}: {
  showAboutLink?: boolean;
  className?: string;
}) {
  const avatar = site.headshot ?? { src: site.logo, alt: `${site.shortName} logo` };
  return (
    <figure className={cn("grid items-start gap-6 sm:grid-cols-[auto_1fr] sm:gap-8", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBase(avatar.src)}
        alt={avatar.alt}
        width={160}
        height={160}
        loading="lazy"
        decoding="async"
        className="h-24 w-24 rounded-full border border-line bg-paper-card object-cover shadow-card sm:h-36 sm:w-36"
      />
      <div>
        <blockquote className="relative space-y-4 text-pretty text-lg text-ink-soft">
          <span
            aria-hidden
            className="absolute -top-6 -left-1 font-display text-6xl leading-none text-accent/30"
          >
            &ldquo;
          </span>
          {site.bioQuote.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </blockquote>
        <figcaption className="mt-5 text-sm">
          <span className="font-semibold text-ink">
            {site.contactName} {site.credentials.postNominals}
          </span>
          <span className="text-muted">
            {" "}
            · {site.credentials.jobTitle} · {site.credentials.degree}
          </span>
        </figcaption>
        {showAboutLink && (
          <Link
            href="/about"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong"
          >
            More about Sean <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </figure>
  );
}
