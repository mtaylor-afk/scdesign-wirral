"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui";
import { track } from "@/components/Analytics";
import { backupEnquiry } from "@/lib/enquiry-backup";
import { reportError } from "@/lib/error-report";
import { withBase } from "@/lib/base";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Single-page website enquiry form — "capture first, qualify second".
 *
 * The only things genuinely needed are a name and ONE way to reply (phone OR
 * email) + consent. Everything else (project type, postcode, message) is
 * optional. No multi-step journey, no progress bar, no "Continue".
 *
 * Posts to the isolated serverless endpoint (QCbuild1 `api/sc-enquiry`) which
 * emails Sean INSTANTLY to BOTH recipients (reply-to = the enquirer, handled
 * server-side) and sends the enquirer an auto-acknowledgement. Every submission
 * is also copied to the SC Supabase `sc_enquiries` table (durable record). If
 * the POST fails for any reason, we fall back to a pre-filled mailto so a
 * genuine lead is never lost.
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = "idle" | "submitting" | "success-mailto";
type Errors = { name?: string; contact?: string; email?: string; consent?: string };

export function EnquiryForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const [projectType, setProjectType] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});

  // Non-sensitive source context captured from the URL (set by service/area/
  // guide/cost-estimate CTAs). Stored as metadata only — never trusted.
  const sourceRef = useRef<Record<string, string>>({});

  const turnstileKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Prefill from query params after mount (avoids any SSR/hydration mismatch).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const get = (k: string) => u.searchParams.get(k) || "";
    const src: Record<string, string> = {};
    [
      "source_type",
      "source_page",
      "project_type",
      "area",
      "calculator_project",
      "calculator_area_m2",
      "calculator_finish",
      "calculator_estimate_range",
    ].forEach((k) => {
      const v = get(k);
      if (v) src[k] = v;
    });
    sourceRef.current = src;

    // Map an incoming project_type to a chip if it matches one.
    if (src.project_type) {
      const match = projectTypes.find(
        (t) => t.toLowerCase() === src.project_type.toLowerCase()
      );
      // Legitimate one-shot init of form state from the URL query string (an
      // external system), guarded to run only on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (match) setProjectType(match);
    }

    // Pre-fill the (optional) message with cost-estimate context so the enquiry
    // email and the SQL record carry it without the user retyping anything.
    if (src.source_type === "cost_estimate" && src.calculator_project) {
      const msgEl = formRef.current?.elements.namedItem("message") as
        | HTMLTextAreaElement
        | null;
      if (msgEl && !msgEl.value) {
        const parts = [
          `I used the cost estimate for: ${src.calculator_project}`,
          src.calculator_area_m2 ? `approx ${src.calculator_area_m2} m²` : "",
          src.calculator_finish ? `${src.calculator_finish} finish` : "",
          src.calculator_estimate_range ? `estimated ${src.calculator_estimate_range}` : "",
        ].filter(Boolean);
        msgEl.value = `${parts.join(", ")}. Could you sense-check this for my project?`;
      }
    }
  }, []);

  // Focus the success heading when the mailto-fallback view appears.
  useEffect(() => {
    if (status === "success-mailto") successRef.current?.focus();
  }, [status]);

  function read(name: string): string {
    const el = formRef.current?.elements.namedItem(name) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    return el ? String(el.value || "").trim() : "";
  }

  function validate(): Errors {
    const next: Errors = {};
    const name = read("name");
    const phone = read("phone");
    const email = read("email");
    const consentEl = formRef.current?.elements.namedItem("consent") as
      | HTMLInputElement
      | null;

    if (!name) next.name = "Please enter your name so Sean knows who to reply to.";
    if (!phone && !email)
      next.contact =
        "Please enter either a phone number or email address so Sean can reply.";
    else if (email && !EMAIL_RE.test(email))
      next.email = "Please enter an email address in the format name@example.com.";
    if (!consentEl?.checked)
      next.consent = "Please confirm Sean can use your details to respond to your enquiry.";

    return next;
  }

  function focusFirstError(errs: Errors) {
    const order: Array<[keyof Errors, string]> = [
      ["name", "name"],
      ["contact", "phone"],
      ["email", "email"],
      ["consent", "consent"],
    ];
    for (const [key, fieldId] of order) {
      if (errs[key]) {
        document.getElementById(fieldId)?.focus();
        return;
      }
    }
  }

  function collect() {
    return {
      name: read("name"),
      email: read("email"),
      phone: read("phone"),
      postcode: read("postcode"),
      projectType,
      message: read("message"),
      consent: "on",
      company: read("company"), // honeypot
      "cf-turnstile-response": read("cf-turnstile-response"),
      page: typeof window !== "undefined" ? window.location.href : "",
      ...sourceRef.current,
    };
  }

  function mailtoFallback(p: ReturnType<typeof collect>) {
    const body =
      `Name: ${p.name}\nPhone: ${p.phone}\nEmail: ${p.email}\nPostcode: ${p.postcode}\n` +
      `Project: ${p.projectType}\n\n${p.message}`;
    // Address the first recipient in To and the rest as CC, so mail clients show
    // them as distinct addresses (a single comma-joined To string is mishandled
    // by some clients).
    const [to, ...cc] = site.formRecipients;
    const ccPart = cc.length ? `cc=${encodeURIComponent(cc.join(","))}&` : "";
    window.location.href =
      `mailto:${to}?${ccPart}subject=${encodeURIComponent(
        "Website enquiry — " + (p.projectType || "project")
      )}&body=${encodeURIComponent(body)}`;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      track("contact_form_validation_error", { reason: Object.keys(errs).join(",") });
      // Announce + move focus: summary first, then the first invalid field.
      requestAnimationFrame(() => {
        summaryRef.current?.focus();
        focusFirstError(errs);
      });
      return;
    }
    setErrors({});

    const payload = collect();

    // Honeypot tripped — silently treat as success without contacting anyone.
    if (payload.company) {
      router.push("/contact/thank-you");
      return;
    }

    setStatus("submitting");
    track("contact_form_submitted", { project_type: payload.projectType || "unspecified" });

    // Durable backup: stores in SQL AND emails Sean server-side (both addresses,
    // Reply-To = enquirer). Started now; only awaited if the primary endpoint
    // doesn't succeed, so the happy path stays fast.
    const backupPromise = backupEnquiry("contact", payload);

    // Primary path: the external endpoint (also sends the enquirer an auto-ack).
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
      /* fall through to the backup result */
    }

    if (primaryOk) {
      track("contact_form_success", { mode: "online" });
      formRef.current?.reset();
      router.push("/contact/thank-you");
      return;
    }

    // Primary failed → rely on the server-side backup email (no local mail app).
    let backup = { stored: false, emailed: false };
    try {
      backup = await backupPromise;
    } catch {
      /* keep defaults */
    }

    if (backup.emailed) {
      track("contact_form_success", { mode: "backup_email" });
      formRef.current?.reset();
      router.push("/contact/thank-you");
      return;
    }

    // Last resort only (both server paths failed): pre-filled email to Sean.
    // Log it — a contact form falling back to mailto is a real lost-lead risk.
    track("contact_form_success", { mode: "mailto_fallback" });
    reportError({
      type: "form_error",
      severity: "error",
      message: "Contact form: primary endpoint and server backup both failed — fell back to mailto",
      props: {
        form: "contact",
        primaryOk: false,
        backupStored: backup.stored,
        backupEmailed: backup.emailed,
        endpoint: ENQUIRY_ENDPOINT,
        projectType: payload.projectType || "",
      },
    });
    mailtoFallback(payload);
    setStatus("success-mailto");
  }

  if (status === "success-mailto") {
    return (
      <div className="rounded-lg border border-line bg-paper-card p-6 shadow-card">
        <h2 ref={successRef} tabIndex={-1} className="text-xl text-ink outline-none">
          Almost there — just press send
        </h2>
        <p className="mt-2 text-muted">
          Your email app should have opened with your enquiry ready to go. Press send and Sean will
          come back to you. If it didn&apos;t open, you can call or WhatsApp instead:
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <a
            href={`tel:${site.phoneE164}`}
            data-conversion="phone-click"
            className="font-medium text-accent-strong"
          >
            Call {site.phoneDisplay}
          </a>
        </div>
      </div>
    );
  }

  const errorList = Object.values(errors).filter(Boolean) as string[];

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-6" noValidate>
      {turnstileKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
        />
      )}

      <div>
        <h2 className="text-lg font-semibold text-ink">Quick project enquiry</h2>
        <p className="mt-1 text-sm text-muted">
          This takes about 60 seconds. Only your name and one contact method are needed — the rest is
          optional.
        </p>
      </div>

      {/* Error summary (focus target on failed submit). */}
      {errorList.length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/5 p-4 outline-none"
        >
          <p className="text-sm font-semibold text-danger">
            Please check the following so Sean can reply:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-danger">
            {errorList.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Honeypot — hidden from humans, bots tend to fill it. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Contact details — the only required part. */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Your name"
          htmlFor="name"
          required
          error={errors.name}
        >
          <Input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
        </Field>
        <Field
          label="Phone"
          htmlFor="phone"
          hint="A phone or email is enough — whichever you prefer."
          error={errors.contact}
        >
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            aria-invalid={!!errors.contact}
            aria-describedby={cn("phone-hint", errors.contact && "phone-error")}
          />
        </Field>
      </div>

      <Field
        label="Email"
        htmlFor="email"
        optional
        hint="Add an email if you'd rather Sean replied that way."
        error={errors.email}
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={!!errors.email}
          aria-describedby={cn("email-hint", errors.email && "email-error")}
        />
      </Field>

      {/* Optional project context. */}
      <fieldset className="border-0 p-0">
        <legend className="text-sm font-medium text-ink">
          What are you thinking of doing?{" "}
          <span className="text-xs font-normal text-muted">(optional)</span>
        </legend>
        <div role="group" aria-label="Project type" className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {projectTypes.map((t) => {
            const selected = projectType === t;
            return (
              <button
                type="button"
                key={t}
                aria-pressed={selected}
                onClick={() => setProjectType((cur) => (cur === t ? "" : t))}
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
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Property postcode"
          htmlFor="postcode"
          optional
          hint="Helps Sean check your local planning context — not required to start."
        >
          <Input
            id="postcode"
            name="postcode"
            type="text"
            autoComplete="postal-code"
            aria-describedby="postcode-hint"
          />
        </Field>
      </div>

      <Field
        label="Anything you'd like to add?"
        htmlFor="message"
        optional
        hint="A sentence is plenty — you can send photos by WhatsApp or email afterwards."
      >
        <Textarea id="message" name="message" rows={5} aria-describedby="message-hint" />
      </Field>

      <label className="flex items-start gap-3 text-sm text-muted">
        <input
          id="consent"
          type="checkbox"
          name="consent"
          required
          aria-invalid={!!errors.consent}
          aria-describedby={errors.consent ? "consent-error" : undefined}
          className="mt-1 h-4 w-4"
        />
        <span>
          I&apos;m happy for {site.shortName} to use these details to respond to my enquiry, in line
          with the{" "}
          <a href={withBase("/privacy-policy")} className="underline">
            Privacy Policy
          </a>
          . <span className="text-xs text-muted">(required)</span>
        </span>
      </label>
      {errors.consent && (
        <p id="consent-error" role="alert" className="text-sm text-danger">
          {errors.consent}
        </p>
      )}

      {turnstileKey && <div className="cf-turnstile" data-sitekey={turnstileKey} data-theme="light" />}

      <div className="pt-1">
        <Button
          type="submit"
          size="lg"
          disabled={status === "submitting"}
          data-conversion="contact-submit"
        >
          {status === "submitting" ? "Sending…" : "Send enquiry to Sean"}
        </Button>
      </div>

      <p className="text-xs text-muted">
        No obligation — we design only and reply with an honest first view. Prefer to talk now?{" "}
        <a
          href={`tel:${site.phoneE164}`}
          data-conversion="phone-click"
          className="font-medium text-accent-strong"
        >
          Call {site.phoneDisplay}
        </a>
        .
      </p>
    </form>
  );
}
