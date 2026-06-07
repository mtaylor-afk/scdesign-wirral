import type { ReactNode } from "react";
import { Container, Section } from "./index";

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <Section className="pt-16">
      <Container className="max-w-3xl">
        <h1 className="text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-muted">Last updated: {updated}</p>
        <div className="mt-4 rounded-[var(--radius)] border border-accent-soft bg-accent-soft/40 p-4 text-sm text-ink-soft">
          This policy explains how SC Design &amp; Construction handles website enquiries,
          cookies and visualiser use. It is reviewed periodically as the website and services
          evolve, and is provided for information — it is not legal advice.
        </div>
        <div className="legal mt-8 space-y-5 text-pretty text-muted [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:text-ink [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:text-ink [&_a]:text-accent-strong [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1">
          {children}
        </div>
      </Container>
    </Section>
  );
}
