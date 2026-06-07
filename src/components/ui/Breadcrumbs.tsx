import Link from "next/link";

export type Crumb = { name: string; path: string };

/**
 * Visible breadcrumb trail. Pair with `breadcrumbJsonLd(items)` (same items)
 * for the structured-data equivalent. The final item is the current page and
 * is not linked.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={it.path} className="flex items-center gap-1.5">
              {last ? (
                <span className="text-ink" aria-current="page">
                  {it.name}
                </span>
              ) : (
                <>
                  <Link href={it.path} className="hover:text-accent-strong">
                    {it.name}
                  </Link>
                  <span aria-hidden className="text-muted-soft">
                    /
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
