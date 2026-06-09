"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SendConceptForm } from "./SendConceptForm";
import { track } from "@/components/Analytics";
import { withBase } from "@/lib/base";
import { renderConcept, presizeToNative, addWatermark } from "@/lib/concept-canvas";
import {
  PROJECT_TYPES,
  STOREYS,
  STYLES,
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
} from "@/lib/visualiser-options";

// Photoreal render backend. Lives on the TailoredQuote Vercel project (the only
// auto-deployed serverless host) and is called cross-origin from the static SC
// site — the same pattern the rest of the estate already uses. Overridable via
// env at build time; defaults to the deployed endpoint.
const VISUALISER_ENDPOINT =
  process.env.NEXT_PUBLIC_SC_VISUALISER_ENDPOINT ||
  "https://q-cbuild1.vercel.app/api/sc-visualise";

type Status = "upload" | "loading" | "result" | "error";
type Result = { id: string; url: string; before: string; mocked: boolean };

export function VisualiserApp() {
  const [status, setStatus] = useState<Status>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<Result | null>(null);
  const [opts, setOpts] = useState({
    projectType: "rear",
    storeys: "single",
    style: "modern",
    notes: "",
    email: "",
    phone: "",
  });
  const fileInput = useRef<HTMLInputElement>(null);
  // Separate input carrying `capture` so mobile devices open the camera app
  // directly (desktop browsers ignore `capture` and fall back to a file picker).
  const cameraInput = useRef<HTMLInputElement>(null);

  // Release the upload preview's object URL when the component unmounts (e.g. the
  // user navigates away mid-flow) so the blob isn't held in memory until the tab
  // closes. acceptFile/reset already revoke the previous URL on replacement.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Basic email format check — mirrors the server-side guard. The form will not
  // process without a valid email (that's where the result is emailed).
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function acceptFile(f: File | undefined) {
    if (!f) return;
    if (!ALLOWED_MIME.includes(f.type)) {
      setError("Please choose a JPEG, PNG or WebP image.");
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setError("That image is too large — please use one under 10 MB.");
      return;
    }
    setError("");
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  }

  async function generate() {
    if (!preview) {
      setError("Please choose a photo of your home, or try the sample.");
      return;
    }
    const email = opts.email.trim();
    if (!EMAIL_RE.test(email)) {
      setError("Please enter a valid email address — this is where your concept will be sent.");
      return;
    }
    setStatus("loading");
    setError("");
    track("visualiser_start", { project_type: opts.projectType });

    // Pre-size to a gpt-image-1 native size. This is both what we send to the
    // model and the "before" image we display, so the comparison uses the exact
    // crop the model saw, and the payload stays small.
    let presized: { dataUrl: string; size: string; mime: string } | null = null;
    try {
      presized = await presizeToNative(preview);
    } catch {
      presized = null;
    }

    // 1) Photoreal render via the server (reuses the existing OpenAI key —
    //    never exposed to the browser).
    if (presized) {
      try {
        const res = await fetch(VISUALISER_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: presized.dataUrl,
            mime: presized.mime,
            size: presized.size,
            projectType: opts.projectType,
            storeys: opts.storeys,
            style: opts.style,
            notes: opts.notes,
            email: opts.email.trim(),
            phone: opts.phone.trim(),
          }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json && json.ok && json.b64) {
          track("visualiser_complete", { mode: "ai" });
          setResult({
            id: `ai-${Date.now()}`,
            url: `data:${json.mime || "image/png"};base64,${json.b64}`,
            before: presized.dataUrl,
            mocked: false,
          });
          setStatus("result");
          return;
        }
        track("visualiser_error", { reason: (json && json.error) || "api" });
      } catch {
        track("visualiser_error", { reason: "network" });
      }
    }

    // 2) Fallback: in-browser concept overlay. Keeps the page working if the
    //    render endpoint is unavailable, rate-limited, or refuses the photo.
    try {
      const { before, after } = await renderConcept(preview, {
        projectType: opts.projectType,
        storeys: opts.storeys,
        style: opts.style,
      });
      track("visualiser_complete", { mode: "client_fallback" });
      setResult({ id: `local-${Date.now()}`, url: after, before, mocked: true });
      setStatus("result");
    } catch {
      track("visualiser_error", { reason: "client_render" });
      setError("We couldn't create your concept from that photo. Please try another image.");
      setStatus("error");
    }
  }

  async function downloadResult() {
    if (!result) return;
    track("visualiser_download");
    // The AI render is shown clean on screen; watermark it for the download.
    // The fallback overlay is already watermarked, so download it as-is.
    let href = result.url;
    if (!result.mocked) {
      try {
        href = await addWatermark(result.url);
      } catch {
        href = result.url;
      }
    }
    const a = document.createElement("a");
    a.href = href;
    a.download = `sc-extension-concept-${result.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
    setResult(null);
    setError("");
    setStatus("upload");
  }

  return (
    <div>
      {/* LOADING */}
      {status === "loading" && (
        <Card className="flex min-h-80 flex-col items-center justify-center text-center">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-accent"
            role="status"
            aria-label="Generating"
          />
          <p className="mt-5 text-lg text-ink">Creating your concept…</p>
          <p className="mt-1 text-sm text-muted">This can take up to a minute — please keep this page open.</p>
        </Card>
      )}

      {/* RESULT */}
      {status === "result" && result && (
        <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="grid gap-3 sm:grid-cols-2">
              <figure className="m-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.before}
                  alt="Your photo"
                  className="aspect-[3/2] w-full rounded-lg border border-line object-cover"
                />
                <figcaption className="mt-2 text-center text-sm text-muted">Your photo</figcaption>
              </figure>
              <figure className="m-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.url}
                  alt="Proposed extension concept"
                  className="aspect-[3/2] w-full rounded-lg border border-line object-cover"
                />
                <figcaption className="mt-2 text-center text-sm text-muted">
                  Proposed extension <span className="text-xs">(concept)</span>
                </figcaption>
              </figure>
            </div>
            <p className="mt-3 rounded-md bg-accent-soft/50 px-3 py-2 text-xs text-ink-soft">
              {result.mocked
                ? "Our live renderer was busy, so this is an instant in-browser concept overlay — an illustration of style and placement, not a photoreal render."
                : "This is an AI-generated concept visualisation — an impression of style and placement, not a measured drawing or a planning-approved design."}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={downloadResult}>Download concept</Button>
              <Button variant="ghost" onClick={reset}>
                Start again
              </Button>
            </div>
            <p className="mt-4 rounded-md border border-line bg-paper-card p-3 text-xs text-muted">
              This is a concept visualisation only. It is not an architectural drawing, planning
              application, structural design, building-regulations drawing or confirmation that the
              design can be built. SC Design &amp; Construction will review your property properly
              before giving advice.
            </p>
          </div>

          <Card>
            <h3 className="text-xl">Like it? Send it to Sean</h3>
            <p className="mt-1 text-sm text-muted">
              We&apos;ll take a look and come back to you about turning the idea into a real design.
            </p>
            <div className="mt-4">
              <SendConceptForm
                resultId={result.id}
                resultUrl={result.url.startsWith("data:") ? "" : result.url}
              />
            </div>
          </Card>
        </div>
      )}

      {/* UPLOAD + OPTIONS */}
      {(status === "upload" || status === "error") && (
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                acceptFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInput.current?.click()}
              className="flex aspect-[3/2] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-line bg-paper-card text-center transition-colors hover:border-accent"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
              aria-label="Upload a photo of your home"
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="Your uploaded home photo"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="px-6">
                  <p className="text-lg text-ink">Drag a photo here</p>
                  <p className="mt-1 text-sm text-muted">
                    or tap to take a photo or choose one — JPEG, PNG or WebP, up to 10&nbsp;MB
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept={ALLOWED_MIME.join(",")}
              className="hidden"
              onChange={(e) => acceptFile(e.target.files?.[0] || undefined)}
            />
            {/* Camera capture — opens the camera app on phones/tablets. */}
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => acceptFile(e.target.files?.[0] || undefined)}
            />
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                type="button"
                onClick={() => cameraInput.current?.click()}
                className="text-sm font-medium text-accent-strong underline"
              >
                Take a photo
              </button>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="text-sm font-medium text-accent-strong underline"
              >
                Choose from library
              </button>
            </div>
            <p className="mt-3 text-xs text-muted">
              By uploading you confirm you have the right to use this image. Your source photo is used
              only to create the concept and isn&apos;t stored afterwards; the concept itself is kept
              briefly so we can show and send it to you. See the{" "}
              <a href={withBase("/visualiser-terms")} className="underline">
                visualiser terms
              </a>
              .
            </p>
            <p className="mt-2 text-xs">
              <a
                href="https://tailoredquote.co.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted hover:underline"
              >
                Visualised images powered by{" "}
                <span className="font-semibold text-ink">Tailored</span>
                <span className="font-semibold text-[#2563eb]">Quote</span>
                <span className="font-semibold text-muted">.co.uk</span>
              </a>
            </p>
          </div>

          <div className="space-y-4">
            <Field label="Project type" htmlFor="v-project">
              <Select
                id="v-project"
                value={opts.projectType}
                onChange={(e) => setOpts({ ...opts, projectType: e.target.value })}
              >
                {PROJECT_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Storeys" htmlFor="v-storeys">
              <Select
                id="v-storeys"
                value={opts.storeys}
                onChange={(e) => setOpts({ ...opts, storeys: e.target.value })}
              >
                {STOREYS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Style" htmlFor="v-style">
              <Select
                id="v-style"
                value={opts.style}
                onChange={(e) => setOpts({ ...opts, style: e.target.value })}
              >
                {STYLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Give me more detail of what you want"
              htmlFor="v-notes"
              hint="e.g. bi-fold doors onto the garden, matching brick"
            >
              <Textarea
                id="v-notes"
                rows={3}
                value={opts.notes}
                maxLength={500}
                onChange={(e) => setOpts({ ...opts, notes: e.target.value })}
              />
            </Field>

            <Field
              label="Email address"
              htmlFor="v-email"
              required
              hint="This is where your results will be sent."
            >
              <Input
                id="v-email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={opts.email}
                onChange={(e) => setOpts({ ...opts, email: e.target.value })}
              />
            </Field>
            <Field label="Telephone (optional)" htmlFor="v-phone">
              <Input
                id="v-phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="e.g. 07700 900123"
                value={opts.phone}
                onChange={(e) => setOpts({ ...opts, phone: e.target.value })}
              />
            </Field>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <Button
              size="lg"
              onClick={generate}
              disabled={!preview}
              className="w-full sm:w-auto"
              data-conversion="visualiser-start"
            >
              Generate my concept
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
