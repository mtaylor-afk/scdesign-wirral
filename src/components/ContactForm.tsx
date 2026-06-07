"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Field, Input, Textarea, Select } from "@/components/ui/form";
import { Button } from "@/components/ui";
import { track } from "@/components/Analytics";
import { IS_STATIC, withBase } from "@/lib/base";
import { site } from "@/lib/site";

const projectTypes = [
  "House extension",
  "Loft conversion",
  "Garage conversion",
  "Internal reconfiguration",
  "Planning drawings",
  "Building regulations drawings",
  "Conservation area property",
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

type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const router = useRouter();
  const turnstileKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  function buildMessage(d: Record<string, FormDataEntryValue>) {
    const lines = [
      d.area ? `Area / town: ${d.area}` : "",
      d.projectStage ? `Project stage: ${d.projectStage}` : "",
      d.hasBuilder ? `Has a builder: ${d.hasBuilder}` : "",
      d.timescale ? `Timescale: ${d.timescale}` : "",
      d.budget ? `Budget: ${d.budget}` : "",
      d.preferredContact ? `Preferred contact: ${d.preferredContact}` : "",
    ].filter(Boolean);
    const header = lines.length ? lines.join("\n") + "\n\n" : "";
    return header + String(d.message || "");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    // Client-side validation (the form sets noValidate, so enforce it here).
    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim();
    const phone = String(data.phone || "").trim();
    const postcode = String(data.postcode || "").trim();
    const consent = data.consent === "on";
    if (!name) return fail("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Please enter a valid email address.");
    if (!phone) return fail("Please enter a phone number so Sean can reach you.");
    if (!postcode) return fail("Please add your property postcode so we can confirm we cover you.");
    if (!consent) return fail("Please tick the box so we can reply to your enquiry.");

    function fail(msg: string) {
      setStatus("error");
      setError(msg);
    }

    const composedMessage = buildMessage(data);
    const payload = {
      name,
      email,
      phone,
      postcode,
      projectType: String(data.projectType || ""),
      message: composedMessage,
      consent: "on",
      company: String(data.company || ""),
      "cf-turnstile-response": String(data["cf-turnstile-response"] || ""),
    };

    // Static export (no server) → open the user's email client pre-filled.
    if (IS_STATIC) {
      const body = `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nPostcode: ${postcode}\nProject: ${payload.projectType}\n\n${composedMessage}`;
      window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(
        "Website enquiry"
      )}&body=${encodeURIComponent(body)}`;
      track("contact_submit", { project_type: payload.projectType, mode: "static_mailto" });
      setStatus("success");
      form.reset();
      return;
    }

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Something went wrong");
      track("contact_submit", { project_type: payload.projectType });
      form.reset();
      router.push("/contact/thank-you");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-6">
        <h2 className="text-xl text-ink">Thank you — message ready to send</h2>
        <p className="mt-2 text-muted">
          Your email app should have opened with your enquiry pre-filled — just press send and Sean
          will come back to you. If it didn&apos;t open, you can WhatsApp or call instead.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {turnstileKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
        />
      )}

      {/* Honeypot — hidden from humans, bots tend to fill it. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

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
        <Field label="Property postcode" htmlFor="postcode" required hint="Helps us confirm we cover your area">
          <Input id="postcode" name="postcode" required autoComplete="postal-code" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Area / town" htmlFor="area">
          <Input id="area" name="area" placeholder="e.g. Wallasey, Heswall…" />
        </Field>
        <Field label="Project type" htmlFor="projectType">
          <Select id="projectType" name="projectType" defaultValue="">
            <option value="" disabled>
              Choose one…
            </option>
            {projectTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      </div>

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

      <label className="flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" name="consent" required className="mt-1 h-4 w-4" />
        <span>
          I&apos;m happy for SC Design &amp; Construction to use these details to respond to my
          enquiry, in line with the{" "}
          <a href={withBase("/privacy-policy")} className="underline">
            Privacy Policy
          </a>
          .
        </span>
      </label>

      {turnstileKey && (
        <div className="cf-turnstile" data-sitekey={turnstileKey} data-theme="light" />
      )}

      {status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Send Sean your project idea"}
      </Button>
    </form>
  );
}
