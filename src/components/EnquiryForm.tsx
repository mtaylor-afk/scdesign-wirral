"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Field, Input, Textarea, Select } from "@/components/ui/form";
import { Button } from "@/components/ui";
import { track } from "@/components/Analytics";
import { withBase } from "@/lib/base";
import { site, cta } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Multi-step website enquiry form (WS4 — the conversion backbone).
 *
 * Posts to the isolated serverless endpoint (QCbuild1 `api/sc-enquiry`) which
 * emails Sean INSTANTLY (reply-to = the enquirer) and sends the enquirer an
 * auto-acknowledgement. If the POST fails for any reason, we fall back to a
 * pre-filled mailto so a genuine lead is never lost.
 *
 * Accessibility: all three steps stay mounted (values persist); only the active
 * step is shown. On step change we move focus to the step heading and announce
 * progress via an aria-live region. Validation is enforced per step.
 */

const ENQUIRY_ENDPOINT =
  process.env.NEXT_PUBLIC_SC_ENQUIRY_ENDPOINT ||
  "https://q-cbuild1.vercel.app/api/sc-enquiry";

const projectTypes = [
  "House extension",
  "Loft conversion",
  "Garage conversion",
  "Garden room",
  "Porch",
  "Internal reconfiguration",
  "Planning drawings",
  "Building regulations drawings",
  "Change of use",
  "Not sure yet",
];

const projectStages = [
  "Just an idea",
  "Need drawings for planning",
  "Need drawings for builder quotes",
  "Builder requested drawings",
  "Planning refused / need redesign",
  "Building control requested drawings",
];

const builderOptions = ["Yes", "No", "Speaking to builders"];
const timescales = ["ASAP", "1–3 months", "3–6 months", "Just researching"];
const contactMethods = ["Phone", "WhatsApp", "Email"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_TITLES = ["What are you planning?", "A few details", "Your contact details"];

type Status = "idle" | "submitting" | "success-online" | "success-mailto" | "error";

export function EnquiryForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const headingRefs = [
    useRef<HTMLParagraphElement>(null),
    useRef<HTMLParagraphElement>(null),
    useRef<HTMLParagraphElement>(null),
  ];

  const [step, setStep] = useState(0);
  const [projectType, setProjectType] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const turnstileKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Move focus to the step heading whenever the step changes (not on first mount),
  // and announce the step for screen-reader users.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    headingRefs[step].current?.focus();
    track("contact_form_step", { step: step + 1 });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  function read(name: string): string {
    const el = formRef.current?.elements.namedItem(name) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | null;
    return el ? String(el.value || "").trim() : "";
  }

  function fail(msg: string) {
    setStatus("error");
    setError(msg);
    track("contact_form_error", { reason: "validation" });
  }

  function clearError() {
    if (status === "error") {
      setStatus("idle");
      setError("");
    }
  }

  function validateStep(n: number): boolean {
    if (n === 0) {
      if (!projectType) {
        fail("Please choose the kind of project you have in mind.");
        return false;
      }
      if (!read("postcode")) {
        fail("Please add your property postcode so we can confirm we cover you.");
        return false;
      }
    }
    if (n === 2) {
      if (!read("name")) {
        fail("Please enter your name.");
        return false;
      }
      if (!read("phone")) {
        fail("Please enter a phone number so Sean can reach you.");
        return false;
      }
      if (!EMAIL_RE.test(read("email"))) {
        fail("Please enter a valid email address.");
        return false;
      }
      const consentEl = formRef.current?.elements.namedItem("consent") as HTMLInputElement | null;
      if (!consentEl?.checked) {
        fail("Please tick the box so we can reply to your enquiry.");
        return false;
      }
    }
    return true;
  }

  function next() {
    if (!validateStep(step)) return;
    clearError();
    setStep((s) => Math.min(2, s + 1));
  }

  function back() {
    clearError();
    setStep((s) => Math.max(0, s - 1));
  }

  function collect() {
    return {
      name: read("name"),
      email: read("email"),
      phone: read("phone"),
      postcode: read("postcode"),
      area: read("area"),
      projectType,
      projectStage: read("projectStage"),
      hasBuilder: read("hasBuilder"),
      timescale: read("timescale"),
      budget: read("budget"),
      preferredContact: read("preferredContact"),
      message: read("message"),
      consent: "on",
      company: read("company"), // honeypot
      "cf-turnstile-response": read("cf-turnstile-response"),
      page: typeof window !== "undefined" ? window.location.href : "",
    };
  }

  function mailtoFallback(p: ReturnType<typeof collect>) {
    const body =
      `Name: ${p.name}\nPhone: ${p.phone}\nEmail: ${p.email}\nPostcode: ${p.postcode}\n` +
      `Project: ${p.projectType}\nStage: ${p.projectStage}\nHas builder: ${p.hasBuilder}\n` +
      `Timescale: ${p.timescale}\nBudget: ${p.budget}\nPreferred contact: ${p.preferredContact}\n\n` +
      `${p.message}`;
    window.location.href = `mailto:${site.formRecipients.join(",")}?subject=${encodeURIComponent(
      "Website enquiry — " + (p.projectType || "project")
    )}&body=${encodeURIComponent(body)}`;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateStep(2)) return;

    const payload = collect();

    // Honeypot tripped — silently treat as success without contacting anyone.
    if (payload.company) {
      setStatus("success-online");
      return;
    }

    setStatus("submitting");
    setError("");
    track("contact_form_submit", { project_type: payload.projectType });

    try {
      const res = await fetch(ENQUIRY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "send_failed");
      track("contact_form_success", { project_type: payload.projectType, mode: "online" });
      formRef.current?.reset();
      router.push("/contact/thank-you");
    } catch {
      // Never lose a lead: fall back to a pre-filled email.
      track("contact_form_success", { project_type: payload.projectType, mode: "mailto_fallback" });
      mailtoFallback(payload);
      setStatus("success-mailto");
    }
  }

  if (status === "success-mailto") {
    return (
      <div className="rounded-lg border border-line bg-paper-card p-6 shadow-card">
        <h2 className="text-xl text-ink">Almost there — just press send</h2>
        <p className="mt-2 text-muted">
          Your email app should have opened with your enquiry ready to go. Press send and Sean will
          come back to you. If it didn&apos;t open, you can call or WhatsApp instead:
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <a href={`tel:${site.phoneE164}`} data-conversion="phone-click" className="font-medium text-accent-strong">
            Call {site.phoneDisplay}
          </a>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-6" noValidate>
      {turnstileKey && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      )}

      {/* Progress indicator */}
      <div>
        <div className="flex items-center justify-between text-xs font-medium text-muted">
          <span>
            Step {step + 1} of 3 — {STEP_TITLES[step]}
          </span>
          <span aria-hidden>{Math.round(((step + 1) / 3) * 100)}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
          <div
            className="h-full rounded-full bg-accent-strong transition-[width] duration-300"
            style={{ width: `${((step + 1) / 3) * 100}%` }}
          />
        </div>
        <p className="sr-only" aria-live="polite">
          Step {step + 1} of 3: {STEP_TITLES[step]}
        </p>
      </div>

      {/* Honeypot — hidden from humans, bots tend to fill it. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {/* STEP 1 — project type + location */}
      <fieldset hidden={step !== 0} className="space-y-5 border-0 p-0">
        <p
          ref={headingRefs[0]}
          tabIndex={-1}
          className="text-lg font-semibold text-ink outline-none"
        >
          What are you planning?
        </p>
        <div role="radiogroup" aria-label="Project type" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {projectTypes.map((t) => {
            const selected = projectType === t;
            return (
              <button
                type="button"
                key={t}
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setProjectType(t);
                  clearError();
                }}
                className={cn(
                  "rounded-[var(--radius)] border px-3 py-3 text-left text-sm transition-colors",
                  selected
                    ? "border-accent-strong bg-accent-soft/50 font-medium text-ink"
                    : "border-line bg-white text-muted hover:border-accent-soft hover:text-ink"
                )}
              >
                {t}
              </button>
            );
          })}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Property postcode" htmlFor="postcode" required hint="Helps us confirm we cover your area">
            <Input id="postcode" name="postcode" required autoComplete="postal-code" />
          </Field>
          <Field label="Area / town" htmlFor="area">
            <Input id="area" name="area" placeholder="e.g. West Kirby, Heswall…" />
          </Field>
        </div>
      </fieldset>

      {/* STEP 2 — project detail */}
      <fieldset hidden={step !== 1} className="space-y-5 border-0 p-0">
        <p
          ref={headingRefs[1]}
          tabIndex={-1}
          className="text-lg font-semibold text-ink outline-none"
        >
          A few details (all optional)
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Project stage" htmlFor="projectStage">
            <Select id="projectStage" name="projectStage" defaultValue="">
              <option value="">Choose one…</option>
              {projectStages.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Do you already have a builder?" htmlFor="hasBuilder">
            <Select id="hasBuilder" name="hasBuilder" defaultValue="">
              <option value="">Choose one…</option>
              {builderOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Timescale" htmlFor="timescale">
            <Select id="timescale" name="timescale" defaultValue="">
              <option value="">Choose one…</option>
              {timescales.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Budget (optional)" htmlFor="budget" hint="A rough range is fine">
            <Input id="budget" name="budget" placeholder="e.g. £40–60k" />
          </Field>
        </div>
        <Field
          label="Tell us about your project"
          htmlFor="message"
          hint="A short description is plenty — you can send photos by WhatsApp or email afterwards."
        >
          <Textarea id="message" name="message" rows={5} />
        </Field>
      </fieldset>

      {/* STEP 3 — contact details */}
      <fieldset hidden={step !== 2} className="space-y-5 border-0 p-0">
        <p
          ref={headingRefs[2]}
          tabIndex={-1}
          className="text-lg font-semibold text-ink outline-none"
        >
          Your contact details
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Your name" htmlFor="name" required>
            <Input id="name" name="name" required autoComplete="name" />
          </Field>
          <Field label="Phone" htmlFor="phone" required>
            <Input id="phone" name="phone" type="tel" required autoComplete="tel" inputMode="tel" />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" htmlFor="email" required>
            <Input id="email" name="email" type="email" required autoComplete="email" inputMode="email" />
          </Field>
          <Field label="Preferred contact method" htmlFor="preferredContact">
            <Select id="preferredContact" name="preferredContact" defaultValue="">
              <option value="">No preference</option>
              {contactMethods.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" name="consent" required className="mt-1 h-4 w-4" />
          <span>
            I&apos;m happy for {site.shortName} to use these details to respond to my enquiry, in line
            with the{" "}
            <a href={withBase("/privacy-policy")} className="underline">
              Privacy Policy
            </a>
            .
          </span>
        </label>

        {turnstileKey && <div className="cf-turnstile" data-sitekey={turnstileKey} data-theme="light" />}
      </fieldset>

      {status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 pt-1">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={back}>
            Back
          </Button>
        ) : (
          <span />
        )}

        {step < 2 ? (
          <Button type="button" size="lg" onClick={next}>
            Continue
          </Button>
        ) : (
          <Button type="submit" size="lg" disabled={status === "submitting"} data-conversion="contact-submit">
            {status === "submitting" ? "Sending…" : cta.primary.label}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted">
        No obligation — we design only and reply with an honest first view. Prefer to talk now?{" "}
        <a href={`tel:${site.phoneE164}`} data-conversion="phone-click" className="font-medium text-accent-strong">
          Call {site.phoneDisplay}
        </a>
        .
      </p>
    </form>
  );
}
