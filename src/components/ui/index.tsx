import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ---------------- Layout ---------------- */

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8", className)}>{children}</div>
  );
}

export function Section({
  children,
  className,
  tone = "paper",
  id,
}: {
  children: ReactNode;
  className?: string;
  tone?: "paper" | "card" | "mist" | "fog" | "ink";
  id?: string;
}) {
  const tones = {
    paper: "bg-paper text-ink",
    card: "bg-paper-card text-ink",
    mist: "bg-mist text-ink",
    fog: "bg-fog text-ink",
    ink: "bg-ink text-paper",
  } as const;
  return (
    <section id={id} className={cn("py-section", tones[tone], className)}>
      {children}
    </section>
  );
}

/* ---------------- Buttons ---------------- */

type Variant = "primary" | "secondary" | "ghost" | "light";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-accent-strong text-white hover:bg-accent-deep",
  secondary: "bg-ink text-paper hover:bg-ink-soft",
  ghost: "bg-transparent text-ink border border-line hover:bg-paper-card",
  light: "bg-white text-ink hover:bg-paper border border-line",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-6 text-sm",
  lg: "h-14 px-8 text-base",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...rest
}: {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
  external,
  track,
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  external?: boolean;
  /** Optional passive conversion hook, rendered as data-conversion="…". */
  track?: string;
}) {
  const cls = cn(base, variants[variant], sizes[size], className);
  if (
    external ||
    href.startsWith("http") ||
    href.startsWith("tel:") ||
    href.startsWith("mailto:")
  ) {
    return (
      <a
        href={href}
        className={cls}
        data-conversion={track}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} data-conversion={track}>
      {children}
    </Link>
  );
}

/* ---------------- Cards & misc ---------------- */

export function Card({
  children,
  className,
  hover,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-paper-card p-6 shadow-card",
        hover && "transition-shadow hover:shadow-card-hover",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-medium uppercase tracking-wide text-accent-strong",
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-4xl text-ink sm:text-5xl">{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      data-reveal
      className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}
    >
      {eyebrow && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent-strong">
          {eyebrow}
        </p>
      )}
      <h2 className="text-balance text-4xl sm:text-5xl">{title}</h2>
      {intro && <p className="mt-4 text-pretty text-lg text-muted">{intro}</p>}
    </div>
  );
}

/* ---------------- Bento (Apple-style tile grid) ---------------- */

/** Responsive bento grid wrapper — a 6-col grid on lg, tiles set their own span. */
export function Bento({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-6", className)}>
      {children}
    </div>
  );
}

type TileTone = "card" | "paper" | "mist" | "ink" | "accent";

const tileTones: Record<TileTone, string> = {
  card: "bg-paper-card text-ink border border-line",
  paper: "bg-paper text-ink border border-line",
  mist: "bg-mist text-ink border border-line",
  ink: "bg-ink text-paper",
  accent: "bg-accent-strong text-white",
};

/** One bento tile. `span`/`rowSpan` are lg-and-up column/row spans (of 6). */
export function BentoTile({
  children,
  className,
  span = 3,
  rowSpan = 1,
  tone = "card",
  href,
  track,
  reveal = true,
}: {
  children: ReactNode;
  className?: string;
  /** lg column span out of 6 (1–6). */
  span?: number;
  /** lg row span. */
  rowSpan?: number;
  tone?: TileTone;
  href?: string;
  /** data-conversion value when the tile is a link. */
  track?: string;
  reveal?: boolean;
}) {
  const spanCls: Record<number, string> = {
    1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3",
    4: "lg:col-span-4", 5: "lg:col-span-5", 6: "lg:col-span-6",
  };
  const rowCls: Record<number, string> = { 1: "", 2: "lg:row-span-2", 3: "lg:row-span-3" };
  const base = cn(
    "group relative flex flex-col overflow-hidden rounded-[var(--radius-xl)] shadow-tile transition-shadow",
    tileTones[tone],
    spanCls[span] ?? "lg:col-span-3",
    rowCls[rowSpan] ?? "",
    href && "hover:shadow-tile-hover",
    "col-span-2 sm:col-span-1",
    className
  );
  const revealProps = reveal ? { "data-reveal": true } : {};
  if (href) {
    return (
      <Link href={href} data-conversion={track} className={base} {...revealProps}>
        {children}
      </Link>
    );
  }
  return (
    <div className={base} {...revealProps}>
      {children}
    </div>
  );
}
