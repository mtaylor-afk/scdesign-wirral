import Link from "next/link";
import { withBase } from "@/lib/base";
import { cn } from "@/lib/utils";
import type { WorkImage } from "@/lib/media";
import { KindTag } from "./WorkGallery";

/**
 * Service card. With `image` it becomes a photo card (Sean's brief: "click on an
 * example photo … with a breakdown of the service") — the whole card links to
 * the service page. Renders/drawings carry a visible kind label.
 */
export function ServiceCard({
  title,
  blurb,
  href,
  image,
  compact = false,
}: {
  title: string;
  blurb?: string;
  href: string;
  image?: WorkImage;
  compact?: boolean;
}) {
  return (
    <Link href={href} className="group block h-full" data-conversion="service-cta">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-paper-card shadow-card transition-shadow hover:shadow-card-hover">
        {image && (
          <div
            className={cn(
              "relative aspect-[4/3] w-full overflow-hidden",
              image.kind === "drawing" ? "bg-white" : "bg-paper"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={withBase(image.src)}
              alt={image.alt}
              width={image.width}
              height={image.height}
              loading="lazy"
              decoding="async"
              className={cn(
                "absolute inset-0 h-full w-full transition-transform duration-300 group-hover:scale-[1.03]",
                image.kind === "drawing" ? "object-contain p-2" : "object-cover"
              )}
            />
            <KindTag kind={image.kind} />
          </div>
        )}
        <div className={cn("flex flex-1 flex-col", compact ? "p-5" : "p-6")}>
          <h3 className={compact ? "text-lg" : "text-xl"}>{title}</h3>
          {blurb && <p className="mt-3 flex-1 text-pretty text-muted">{blurb}</p>}
          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong transition-[gap] group-hover:gap-2.5">
            Explore this service
            <span aria-hidden>→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
