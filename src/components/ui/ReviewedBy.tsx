import { site } from "@/lib/site";

/**
 * Reusable "Reviewed by Sean Corser" attribution for guide pages. SAFE wording
 * only — no ARB/RIBA, qualifications, memberships or insurance claims (those stay
 * owner-TODOs until verified; see /about). Optional `date` shows last review.
 */
export function ReviewedBy({ date }: { date?: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-line bg-paper-card p-4 text-sm">
      <p className="text-pretty text-muted">
        <span className="font-medium text-ink">
          Reviewed by {site.contactName}, {site.shortName}.
        </span>{" "}
        {site.contactName} helps Wirral homeowners with architectural design and drawing packs for
        extensions, loft conversions, planning and building regulations.
      </p>
      {date && <p className="mt-1 text-xs text-muted-soft">Last reviewed {date}</p>}
    </div>
  );
}
