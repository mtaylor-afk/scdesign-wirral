import { withBase } from "@/lib/base";
import { cn } from "@/lib/utils";
import { kindLabel, type WorkImage } from "@/lib/media";

/** Small pill that labels non-photo imagery ("Drawing" / "Design visualisation"). */
export function KindTag({ kind, className }: { kind: WorkImage["kind"]; className?: string }) {
  if (kind === "photo") return null;
  return (
    <span
      className={cn(
        "pointer-events-none absolute left-2 top-2 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-paper",
        className
      )}
    >
      {kindLabel[kind]}
    </span>
  );
}

/**
 * One labelled image in a fixed-ratio frame. Drawings are shown whole
 * (object-contain on white) so nothing is cropped; photos/renders fill the frame.
 * `zoom` wraps the image in a link to the full-size file (useful for drawings).
 */
export function WorkFigure({
  image,
  aspect = "4 / 3",
  zoom = false,
  priority = false,
  showCaption = true,
  className,
}: {
  image: WorkImage;
  aspect?: string;
  zoom?: boolean;
  priority?: boolean;
  showCaption?: boolean;
  className?: string;
}) {
  const contain = image.kind === "drawing";
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={withBase(image.src)}
      alt={image.alt}
      width={image.width}
      height={image.height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={cn(
        "absolute inset-0 h-full w-full",
        contain ? "object-contain p-2" : "object-cover"
      )}
    />
  );
  return (
    <figure
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-line bg-paper-card shadow-tile",
        className
      )}
    >
      <div
        className={cn("relative w-full", contain ? "bg-white" : "bg-paper")}
        style={{ aspectRatio: aspect }}
      >
        {zoom ? (
          <a
            href={withBase(image.src)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${image.alt} — open full-size image in a new tab`}
            className="absolute inset-0 block"
          >
            {img}
          </a>
        ) : (
          img
        )}
        <KindTag kind={image.kind} />
      </div>
      {showCaption && image.caption && (
        <figcaption className="px-3 py-2.5 text-sm text-muted">{image.caption}</figcaption>
      )}
    </figure>
  );
}

/** Responsive grid of labelled work images. Drawings open full-size on click. */
export function WorkGallery({
  images,
  className,
}: {
  images: WorkImage[];
  className?: string;
}) {
  return (
    <div className={cn("grid gap-5 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {images.map((im) => (
        <WorkFigure key={`${im.src}-${im.caption ?? ""}`} image={im} zoom={im.kind === "drawing"} />
      ))}
    </div>
  );
}
