"use client";

import { withBase } from "@/lib/base";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <h1 className="text-3xl">Something went wrong</h1>
      <p className="mt-4 text-muted">
        Sorry — an unexpected error occurred. Please try again, or contact Sean directly if it keeps
        happening.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center rounded-full bg-accent-strong px-5 text-sm font-medium text-white hover:bg-accent-deep"
        >
          Try again
        </button>
        <a
          href={withBase("/contact")}
          className="inline-flex h-11 items-center rounded-full border border-line px-5 text-sm font-medium text-ink hover:bg-paper-card"
        >
          Contact Sean
        </a>
      </div>
    </div>
  );
}
