"use client";

import { useRef, useState } from "react";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui";
import { track } from "@/components/Analytics";
import { backupEnquiry } from "@/lib/enquiry-backup";
import { withBase } from "@/lib/base";
import { site } from "@/lib/site";

/**
 * Visualiser concept handoff — the EXPLICIT, user-initiated "send this concept
 * to Sean" step. Generating a concept never contacts Sean; only this form does.
 *
 * Sends server-side to the same enquiry endpoint the contact form uses (emails
 * BOTH recipients, reply-to = the enquirer, handled server-side) + a durable
 * Supabase backup. The email body folds in the concept details so Sean sees
 * them even though the endpoint primarily keys off name/contact/message. The
 * visitor's email already came from the visualiser, so we reuse it rather than
 * asking again. A pre-filled mailto is the last-resort fallback so a lead is
 * never lost.
 */

const ENQUIRY_ENDPOINT =
  process.env.NEXT_PUBLIC_SC_ENQUIRY_ENDPOINT ||
  "https://q-cbuild1.vercel.app/api/sc-enquiry";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SendConceptForm({
  resultId,
  resultUrl,
  email,
  phone,
  projectType,
  storeys,
  style,
  notes,
}: {
  resultId: string;
  resultUrl: string;
  /** Reused from the visualiser step — the user already gave this to get the result. */
  email: string;
  phone?: string;
  projectType?: string;
  storeys?: string;
  style?: string;
  notes?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const knownEmail = (email || "").trim();
  const hasKnownEmail = EMAIL_RE.test(knownEmail);

  function read(name: string): string {
    const el = formRef.current?.elements.namedItem(name) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    return el ? String(el.value || "").trim() : "";
  }

  /** Human-readable summary of the concept so it always shows in the email. */
  function conceptSummary(userNote: string): string {
    const lines = [
      "Sent from the Extension Concept Visualiser.",
      projectType ? `Project type: ${projectType}` : "",
      storeys ? `Storeys: ${storeys}` : "",
      style ? `Style: ${style}` : "",
      notes ? `What they asked to see: ${notes}` : "",
      `Concept ref: ${resultId}`,
      resultUrl ? `Concept link: ${resultUrl}` : "",
      "",
      `Their note: ${userNote || "—"}`,
    ];
    return lines.filter((l) => l !== "").join("\n");
  }

  function buildPayload() {
    const name = read("name");
    const fallbackContact = read("contact"); // only present when email is unknown
    const usedEmail = hasKnownEmail ? knownEmail : fallbackContact.includes("@") ? fallbackContact : "";
    const usedPhone =
      (phone || "").trim() ||
      (!hasKnownEmail && fallbackContact && !fallbackContact.includes("@") ? fallbackContact : "");
    const userNote = read("notes");
    return {
      form: "visualiser_concept",
      name,
      email: usedEmail,
      phone: usedPhone,
      postcode: read("postcode"),
      projectType: projectType || "",
      message: conceptSummary(userNote),
      consent: "on",
      company: read("company"), // honeypot
      page: typeof window !== "undefined" ? window.location.href : "",
      source_type: "visualiser",
      visualiser_project_type: projectType || "",
      visualiser_storeys: storeys || "",
      visualiser_style: style || "",
      visualiser_concept_id: resultId,
    };
  }

  function mailtoFallback(p: ReturnType<typeof buildPayload>) {
    const body =
      `Name: ${p.name}\nEmail: ${p.email}\nPhone: ${p.phone}\nPostcode: ${p.postcode}\n\n${p.message}`;
    const [to, ...cc] = site.formRecipients;
    const ccPart = cc.length ? `cc=${encodeURIComponent(cc.join(","))}&` : "";
    window.location.href =
      `mailto:${to}?${ccPart}subject=${encodeURIComponent(
        "My extension concept"
      )}&body=${encodeURIComponent(body)}`;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const name = read("name");
    if (!name) {
      setStatus("error");
      setError("Please enter your name so Sean knows who to reply to.");
      return;
    }
    const payload = buildPayload();
    if (!payload.email && !payload.phone) {
      setStatus("error");
      setError("Please add a phone number or email address so Sean can reply.");
      return;
    }
    const consentEl = formRef.current?.elements.namedItem("consent") as HTMLInputElement | null;
    if (!consentEl?.checked) {
      setStatus("error");
      setError("Please confirm Sean can use these details and this concept to respond to you.");
      return;
    }

    // Honeypot tripped — pretend success without contacting anyone.
    if (payload.company) {
      setStatus("success");
      return;
    }

    setStatus("submitting");

    // Durable backup: SQL + server-side email to Sean (both addresses). Awaited
    // only if the primary endpoint doesn't succeed.
    const backupPromise = backupEnquiry("visualiser_concept", {
      ...payload,
      resultId,
      resultUrl,
    });

    let primaryOk = false;
    try {
      const res = await fetch(ENQUIRY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      primaryOk = !!(res.ok && json.ok);
    } catch {
      /* fall through to backup */
    }

    if (primaryOk) {
      track("visualiser_handoff_submitted", { mode: "online" });
      setStatus("success");
      return;
    }

    let backup = { stored: false, emailed: false };
    try {
      backup = await backupPromise;
    } catch {
      /* keep defaults */
    }

    if (backup.emailed) {
      track("visualiser_handoff_submitted", { mode: "backup_email" });
      setStatus("success");
      return;
    }

    // Last resort only (both server paths failed).
    track("visualiser_handoff_submitted", { mode: "mailto_fallback" });
    mailtoFallback(payload);
    setStatus("success");
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
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="hidden" aria-hidden>
        <input name="company" tabIndex={-1} autoComplete="off" />
      </div>

      <Field label="Your name" htmlFor="sc-name" required>
        <Input id="sc-name" name="name" type="text" required autoComplete="name" />
      </Field>

      {hasKnownEmail ? (
        <p className="text-sm text-muted">
          We&apos;ll reply to <span className="font-medium text-ink">{knownEmail}</span> (the email you
          used for your concept). Add a postcode or note below if you like — both optional.
        </p>
      ) : (
        <Field label="Phone or email" htmlFor="sc-contact" required>
          <Input id="sc-contact" name="contact" type="text" required />
        </Field>
      )}

      <Field label="Property postcode" htmlFor="sc-postcode" optional>
        <Input id="sc-postcode" name="postcode" type="text" autoComplete="postal-code" />
      </Field>

      <Field label="Anything to add?" htmlFor="sc-notes" optional>
        <Textarea id="sc-notes" name="notes" rows={3} />
      </Field>

      <label className="flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" name="consent" required className="mt-1 h-4 w-4" />
        <span>
          I&apos;m happy for {site.shortName} to use these details and this concept to respond to my
          enquiry, in line with the{" "}
          <a href={withBase("/privacy-policy")} className="underline">
            Privacy Policy
          </a>
          . <span className="text-xs text-muted">(required)</span>
        </span>
      </label>

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
