"use client";

import { useState } from "react";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui";
import { track } from "@/components/Analytics";
import { IS_STATIC } from "@/lib/base";
import { site } from "@/lib/site";

export function SendConceptForm({ resultId, resultUrl }: { resultId: string; resultUrl: string }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());

    // Static export (no server) → open the user's email client pre-filled.
    if (IS_STATIC) {
      const body =
        `Name: ${data.name || ""}\nContact: ${data.contact || ""}\nPostcode: ${data.postcode || ""}\n` +
        `Concept ref: ${resultId}\n\n${data.notes || ""}`;
      window.location.href = `mailto:${site.formRecipients.join(",")}?subject=${encodeURIComponent(
        "My extension concept"
      )}&body=${encodeURIComponent(body)}`;
      track("visualiser_send_concept", { mode: "static_mailto" });
      setStatus("success");
      return;
    }

    try {
      const res = await fetch("/api/visualise/send-concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, resultId, resultUrl }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Something went wrong");
      track("visualiser_send_concept");
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-5">
        <p className="font-medium text-ink">Sent to Sean — thank you.</p>
        <p className="mt-1 text-sm text-muted">
          He&apos;ll take a look at your concept and come back to you to talk about the real thing.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="hidden" aria-hidden>
        <input name="company" tabIndex={-1} autoComplete="off" />
      </div>
      <Field label="Your name" htmlFor="sc-name" required>
        <Input id="sc-name" name="name" required autoComplete="name" />
      </Field>
      <Field label="Phone or email" htmlFor="sc-contact" required>
        <Input id="sc-contact" name="contact" required />
      </Field>
      <Field label="Postcode" htmlFor="sc-postcode">
        <Input id="sc-postcode" name="postcode" autoComplete="postal-code" />
      </Field>
      <Field label="Anything to add?" htmlFor="sc-notes">
        <Textarea id="sc-notes" name="notes" rows={3} />
      </Field>
      {status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={status === "submitting"} data-conversion="visualiser-submit">
        {status === "submitting" ? "Sending…" : "Send this concept to Sean"}
      </Button>
    </form>
  );
}
