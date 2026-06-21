"use client";

import { useState } from "react";

/**
 * TEMPORARY — three buttons, each generating a different kind of error so the
 * error logging can be confirmed end-to-end. Delete with the parent folder once
 * testing is done.
 */
export function ErrorTestClient() {
  const [log, setLog] = useState<string[]>([]);
  const note = (s: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString("en-GB")} — ${s}`, ...l]);

  // 1) Uncaught JavaScript error — thrown from a timer so it reaches
  // window.onerror (a throw inside the click handler would be swallowed by React).
  function fireUncaught() {
    note("Fired link 1: uncaught JavaScript error → logs as type “JS error”");
    setTimeout(() => {
      throw new Error("TEST PAGE: uncaught JavaScript error (link 1)");
    }, 0);
  }

  // 2) Unhandled promise rejection — no .catch attached, on purpose.
  function fireRejection() {
    note("Fired link 2: unhandled promise rejection → logs as type “Promise”");
    Promise.reject(new Error("TEST PAGE: unhandled promise rejection (link 2)"));
  }

  // 3) Failed resource load — an image that 404s fires an error event.
  function fireResource() {
    note("Fired link 3: failed image load → logs as type “Resource”");
    const img = document.createElement("img");
    img.src = `/__error-test-missing__-${Date.now()}.png`;
    img.alt = "";
    img.style.display = "none";
    document.body.appendChild(img);
  }

  const cards = [
    {
      n: 1,
      title: "Generate a JavaScript error",
      desc: "Throws an uncaught error. Logs in Error logs as type “JS error”.",
      on: fireUncaught,
    },
    {
      n: 2,
      title: "Generate a promise rejection",
      desc: "Rejects a promise with no handler. Logs as type “Promise”.",
      on: fireRejection,
    },
    {
      n: 3,
      title: "Generate a failed resource",
      desc: "Loads an image that doesn’t exist (404). Logs as type “Resource”.",
      on: fireResource,
    },
  ];

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl text-ink">Error logging — test page</h1>
      <p className="mt-3 text-muted">
        Temporary page to confirm error logging works. Click each button below, then open the admin
        panel → <strong>System → Error logs</strong> (the default “Humans only” filter) and confirm
        three new entries appear. Each button generates a different kind of error.
      </p>

      <div className="mt-8 space-y-4">
        {cards.map((c) => (
          <button
            key={c.n}
            type="button"
            onClick={c.on}
            className="block w-full rounded-[var(--radius)] border border-line bg-paper-card p-5 text-left transition-colors hover:border-accent-strong"
          >
            <div className="text-lg font-semibold text-ink">
              {c.n}. {c.title}
            </div>
            <div className="mt-1 text-sm text-muted">{c.desc}</div>
          </button>
        ))}
      </div>

      {log.length > 0 && (
        <div className="mt-8 rounded-[var(--radius)] border border-line bg-white p-4">
          <div className="text-sm font-semibold text-ink">Fired this session:</div>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Errors send in the background — give it ~10 seconds, then refresh the Error logs page.
          </p>
        </div>
      )}
    </div>
  );
}
