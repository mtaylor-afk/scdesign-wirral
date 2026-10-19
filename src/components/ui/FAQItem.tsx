"use client";

import { useId, useState } from "react";
import Link from "next/link";

/** Optional "Read: ..." follow-on link under an answer (not part of FAQ JSON-LD). */
export type FaqRead = { href: string; label: string };

export function FAQItem({ q, a, read }: { q: string; a: string; read?: FaqRead }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="border-b border-line">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-4 py-5 text-left text-lg font-medium text-ink"
        >
          <span>{q}</span>
          <span
            aria-hidden
            className="shrink-0 text-accent-strong transition-transform duration-200"
            style={{ transform: open ? "rotate(45deg)" : "none" }}
          >
            +
          </span>
        </button>
      </h3>
      <div id={id} hidden={!open} className="pb-5 text-pretty text-muted">
        {a}
        {read && (
          <p className="mt-3 text-sm">
            Read:{" "}
            <Link href={read.href} className="font-medium text-accent-strong underline">
              {read.label}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export function FAQList({ faqs }: { faqs: { q: string; a: string; read?: FaqRead }[] }) {
  return (
    <div className="divide-y divide-line border-t border-line">
      {faqs.map((f) => (
        <FAQItem key={f.q} q={f.q} a={f.a} read={f.read} />
      ))}
    </div>
  );
}
