import Link from "next/link";
import { Card } from "./index";

export function ServiceCard({
  title,
  blurb,
  href,
}: {
  title: string;
  blurb: string;
  href: string;
}) {
  return (
    <Link href={href} className="group block focus-visible:outline-none">
      <Card hover className="flex h-full flex-col">
        <h3 className="text-xl">{title}</h3>
        <p className="mt-3 flex-1 text-pretty text-muted">{blurb}</p>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong group-hover:gap-2.5 transition-[gap]">
          Explore this service
          <span aria-hidden>→</span>
        </span>
      </Card>
    </Link>
  );
}
