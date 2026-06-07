# Stage 0 — Discovery, Risk Review & Final Build Brief
## SC Design & Construction website + Extension Concept Visualiser

**Status:** Stage 0 deliverable. **No code written.** Awaiting client approval before Stage 1.
**Prepared:** June 2026. **Location of project:** `/sc/` only (independent of the TailoredQuote app in this repo).

---

## 0. Version & runtime verification (done before any reliance)

The brief rightly distrusts stale knowledge. I verified each assumption against current docs:

| Item | Verified finding (June 2026) | Impact on plan |
|---|---|---|
| Next.js | **16.2** is current stable. App Router + Turbopack default + React 19.2. `create-next-app` now ships App Router + TS + ESLint + Tailwind + `AGENTS.md` by default. | Use **Next 16.x**, not 14. No workaround needed. |
| Gemini image | `gemini-2.5-flash-image` ("Nano Banana") production-ready, ~**$0.039/image**, supports targeted natural-language edits that preserve the input image (true image-to-image). Newer `gemini-3-pro-image` (Pro, "Thinking", high fidelity) and `gemini-3.1-flash-image` also exist. | **Primary model = `gemini-2.5-flash-image`.** Consider `gemini-3-pro-image` for quality if budget allows — decide after the risk spike. |
| Sharp | **0.34** (Q1 2026). Native build works only on **Vercel Node runtime serverless**, never Edge. A WASM build exists but is 4–6× slower. | Confirms brief: visualiser route = **Node runtime** (`export const runtime = 'nodejs'`). |
| Replicate SDXL inpaint | Still available, ~**$0.0062/run**, mask-based inpainting. | **Defer.** Nano Banana is strong enough; a second model doubles integration + failure surface. Add only if the spike proves it necessary. |
| Supabase signed URLs / RLS | `createSignedUrl` works on private buckets; needs `objects` SELECT RLS for client paths; **service-role key bypasses RLS server-side**. | Confirms architecture: server route uses service-role key, returns short-lived signed URL to the browser. |

**Material change vs brief:** none that break the approach. Only refinement is Next 16 (not 14) and a recommendation to defer the Replicate fallback.

---

## 1. Business / legal facts still needed (confirm before launch)

These are **blockers** — most affect copy, legal exposure, or NAP and cannot be safely guessed:

1. **Domain name** (and who controls DNS).
2. **Repo + branch** — currently building under `/sc/` on branch `claude/sc-clause-file-9bP8D`. Confirm if a standalone repo is wanted later.
3. **Companies House number** — ~~there's a known ambiguity between a Liverpool-registered entity and the Wallasey-presented business~~ **[RESOLVED June 2026: Sean is a SOLE TRADER — there is no limited company and no Companies House number. Never display "Ltd"/"Limited" or a company number.]**
4. **CH45 6TR address** — publish full address, or present **service-area only**? (Affects NAP, schema, map, GBP alignment.)
5. **"Architect" / "architectural design" wording** — "architect" is a **legally protected title (UK Architects Act 1997)**. May Sean use "architectural design / architectural drawings", or must we use "design / design drawings / building design"? **Default to the safe wording unless confirmed.**
6. **Service stance** — design-only, construction-only, or **design-and-build**? This rewrites the positioning and every services page. (The brief's headline assumes design-and-build.)
7. **Testimonials/reviews** — may we reuse Facebook/Google reviews, and do we have permission + names?
8. **Accreditations / insurance / qualifications / trade memberships** — anything we may cite (or explicitly nothing)?
9. **Real project photos** — available now, or placeholders needed at launch? (Affects portfolio honesty rules.)
10. **Analytics choice** — Plausible/Umami (cookieless, simplest consent story) vs GA4-behind-consent. My recommendation: **Plausible or Umami** (privacy-friendly, lighter, simpler PECR posture).
11. **Email** — confirm **Resend** + the notification recipient address (the gmail, or a dedicated inbox).
12. **WhatsApp/phone** — confirm `+44 7749 456528` is correct for click-to-call + WhatsApp deep links.
13. **Spam protection** — OK to use **Cloudflare Turnstile** (free, privacy-friendly) on the contact form + visualiser?

---

## 2. Final positioning recommendation

Three options compared:

| Option | Strength | Weakness | Local-SEO fit | Conversion fit |
|---|---|---|---|---|
| **A. Design & Construction specialist ("first idea to planning-ready design and build")** | Broadest service capture; premium; differentiates from generic builders | Only valid if Sean genuinely does design **and** build support | Strong (covers many intents) | Strong (homeowners want one accountable partner) |
| **B. Extension & Loft Conversion specialist** | Matches highest-volume local search intent; concrete, easy to trust | Narrower; under-sells design/planning work | **Strongest for raw search volume** | Strong, very tangible |
| **C. Planning & design-drawings / building-regs support** | Clear niche; low-competition keywords | Smaller market; less "wow"; weaker for the visualiser story | Moderate | Moderate |

**Recommendation: Option A as the umbrella positioning, led visually by Option B's concrete services** — i.e. headline the *capability* (design-led extensions, lofts, planning support across Wirral) while the highest-intent **service + location pages do the SEO heavy lifting**. This is the strongest combination *provided Stage-0 answer #6 confirms design-and-build*. **If Sean is design-only**, pivot to a B/C hybrid ("Design-led extensions, lofts & planning drawings across Wirral") and strip all build/construction claims.

**Recommended homepage headline:** *"Design-led extensions, loft conversions and planning support across Wirral."* (Alternatives weighed in Stage 2; this one names service + place + design credibility in one line.)

---

## 3. SEO route map (proposed, pre-code)

```
/                         Homepage
/services                 Services overview
/services/house-extensions
/services/loft-conversions
/services/residential-design
/services/planning-building-regulations
/portfolio                Portfolio / Before & After
/process                  How we work
/about
/faqs
/contact
/visualiser               AI Extension Concept Visualiser
/privacy-policy
/cookie-policy
/visualiser-terms         AI Visualiser disclaimer / terms
/areas/{location}         12 location pages (template-driven, UNIQUE content each)
  wallasey, birkenhead, bebington, heswall, west-kirby, hoylake,
  bromborough, neston, ellesmere-port, liverpool, chester, crosby
```

**Rule enforced:** location pages must each carry unique intro, local emphasis, locally-relevant FAQs, internal links, and CTA — **no thin duplicates** (Critical SEO risk).

---

## 4. Conversion strategy

Conversion actions: call · WhatsApp · email · contact form · use visualiser · send visualiser concept to Sean.

**Recommended CTA hierarchy:**
- **Primary: "Send Sean your project idea"** — lowest friction, highest intent, captures a lead even from undecided homeowners.
- **Secondary: "WhatsApp Sean"** — local trades' preferred channel; instant, personal, mobile-native.
- **Tertiary / engagement hook: "Try the Extension Concept Visualiser"** — the differentiator + lead magnet, feeding back into "Send concept to Sean".

Justification: homeowners researching extensions are rarely ready to phone a stranger. A *low-commitment* "send your idea" + an *instant* WhatsApp route + an *impressive* visualiser together cover the full readiness spectrum. Phone/email remain present but not primary.

---

## 5. AI visualiser risk spike (feasibility) — READ THIS

This is the highest-risk component. Honest assessment:

| Concern | Assessment | Mitigation |
|---|---|---|
| **Model choice** | `gemini-2.5-flash-image` does genuine instruction-based edits preserving the source. Good for "add a rear extension to *this* house". | Primary = Nano Banana. Evaluate `gemini-3-pro-image` in the spike for quality. |
| **Image quality / consistency** | ⚠️ **Real risk.** Image models still occasionally hallucinate windows, warp rooflines, or restyle neighbours. Output is *concept-grade*, not reliable architectural rendering. | Strong prompts ("preserve existing structure, UK residential, no fantasy"); constrain to subtle changes; **never claim accuracy**; heavy disclaimer. |
| **Structure preservation** | Moderate risk — img-to-img helps but isn't guaranteed. | Bias prompts toward minimal change; consider conservative strength settings. |
| **Moderation / refusal** | Model may refuse some uploads. | Friendly failure UX; never expose raw errors. |
| **Cost** | ~$0.039/image (Nano Banana). Low per-image, but **abuse can multiply it**. | Per-IP + daily caps in a **shared store** (Supabase table), server-enforced. |
| **Latency** | Several seconds + Sharp processing. | Clear loading states; Node serverless with adequate `maxDuration`. |
| **Abuse / spam** | Open upload endpoint = cost + content risk. | Turnstile + rate limits + basic upload sanity checks + EXIF strip. |
| **Watermark** | Must be tasteful + non-destructive. | Server-side Sharp: *"Concept visualisation by SC Design & Construction · powered by TailoredQuote"*, bottom-right, semi-transparent. |
| **Storage / signed URLs** | Private bucket + short-lived signed URL. | Service-role key server-side; signed URL to client. |
| **Privacy / retention** | Uploads are user photos of their homes. | **Proposed default: delete the user's source image immediately after processing; expire generated results after 7 days; store only job metadata.** Confirm with client. |
| **Fallback model** | Likely unnecessary at launch. | **Defer Replicate SDXL**; add only if Nano Banana proves unreliable in the spike. |

**Explicit warning:** the visualiser **can produce inconsistent results** and must be framed as a *concept* lead-magnet, never as an architectural/planning deliverable. If the Stage-6 mock→real spike shows quality is too poor to be credible, the honest fallback is to ship it as "indicative inspiration" or pause it — better than shipping something that misleads. I'll gate the real-model wiring behind a working mock flow + a quality check.

---

## 6. Analytics & privacy plan (PECR + UK GDPR)

- **No non-essential analytics before consent.** Consent banner gates all tracking.
- **Recommended tool:** Plausible or Umami (cookieless/privacy-first → simplest lawful basis). GA4 only if the client specifically wants it (then strictly consent-gated).
- **Events to track (post-consent):** phone click, WhatsApp click, email click, contact submit, visualiser start / complete / fail, "send concept to Sean", service-CTA click, location-CTA click.
- **Policies:** Privacy Policy + Cookie Policy + Visualiser Terms, all drafted as *sensible defaults clearly marked "for legal review"*.
- **Data minimisation:** collect only what's needed; document retention (visualiser source deleted post-process; results expire; leads retained per policy).

---

## 7. Definition of "impressive" (acceptance criteria)

Premium architectural design · no generic-template feel · excellent mobile (320–430px first) · fast loading / good Core Web Vitals (target Lighthouse mobile 90+ where realistic) · clear CTA hierarchy · SEO-ready pages with valid schema · no broken links · no console errors · strong accessibility (semantic, keyboard, contrast, labels) · a *realistic* visualiser or an *honest* fallback · **no placeholder copy/images left at launch unless explicitly approved**.

---

## 8. Risk register

**Critical**
- Wrong public NAP → legal + trust + local-SEO damage. (No Companies House number applies — sole trader.)
- Implying "architect"/RIBA status when not registered (Architects Act 1997).
- Claiming services Sean doesn't provide (design vs build mismatch).
- Visualiser output presented as buildable/planning-ready.

**High**
- Thin/duplicate location pages → SEO penalty / no ranking.
- AI output inconsistency undermining credibility.
- Non-consented analytics (PECR breach).
- Placeholder content/images accidentally launching as "real projects".
- Frontend-only rate limiting → cost abuse on the visualiser.

**Medium**
- Contact-form spam without server-side protection.
- Slow image generation hurting UX.
- Sharp accidentally run on Edge runtime (would break).
- Mobile UX regressions on the visualiser/slider.

**Low**
- Favicon/OG placeholder polish.
- Minor copy tone tweaks.

---

## 9. Final recommended build order (Stage 0 → 7)

Broadly the brief's order, with these refinements:
1. **Stage 1** — Foundation: Next 16 + TS + Tailwind + tokens + primitives + nav/footer + shell + Vercel + quality gates.
2. **Stage 2** — Brand/content/conversion architecture + final sitemap.
3. **Stage 3** — Core marketing pages (placeholder-safe).
4. **Stage 4** — Local SEO layer (metadata, schema, sitemap/robots, location template + 12 pages, internal linking).
5. **Stage 5** — Contact backend, leads (Supabase), Resend, WhatsApp deep links, consent-aware analytics, cookie banner.
6. **Stage 6** — Visualiser: **mock flow first**, then risk-spike the real model, then wire Node route + Sharp watermark/EXIF + Supabase signed URLs + rate limits + send-to-Sean. **Gate real wiring on a quality check.**
7. **Stage 7** — Polish, performance, a11y, cross-device + link + form + SEO + visualiser QA, production deploy, GBP alignment, Search Console, 7-day monitoring.

Each implementation stage ends with the required validation report (build/lint/types/tests/manual/mobile/a11y/SEO/issues/risks/next).

---

## 10. Recommended summary

- **Stack:** Next.js **16.2** (App Router, TS, Tailwind, ESLint) · Vercel · Supabase (DB/Storage/rate-limit/leads, **service-role server-side only**) · **Resend** · **Plausible/Umami** (consent-gated) · **Cloudflare Turnstile** · Visualiser route on **Node runtime** with **Sharp 0.34** · AI = **`gemini-2.5-flash-image`** (Replicate fallback **deferred**).
- **Design:** minimalist architectural — charcoal / off-white / warm accent / muted greys · serif display + clean sans · heavy whitespace · subtle motion · strong focus states.
- **Visualiser architecture:** Browser → Node Route Handler → validate + Turnstile + shared-store rate limit → Supabase job record → Gemini image-edit → Sharp (resize/compress/watermark/EXIF strip) → Supabase Storage (private) → short-lived signed URL → result UI (before/after, download, send-to-Sean). Source image deleted post-process; results expire (proposed 7 days).

---

## 11. Assumptions I'm making (correct me if wrong)

- Sean offers **design-and-build support** (drives Option-A positioning). If not, positioning + service pages get revised.
- We may **not** use the word "architect"/"RIBA" → defaulting to "design / design drawings" wording.
- CH45 6TR treated as **service-area-only** until told otherwise (no public address/map by default).
- No verified testimonials/accreditations until supplied → trust band uses only safe facts (18+ years, Wirral focus, social links).
- Real project photos **not yet available** → premium, clearly-labelled replaceable placeholders, never shown as real projects.
- Email recipient = the gmail on file unless a dedicated inbox is given.
- Visualiser retention default = delete source immediately, results expire 7 days.

---

## 12. DECISIONS I NEED FROM YOU (answer in one go)

1. Domain name + DNS control?
2. Standalone repo wanted, or keep building under `/sc/` on this branch?
3. **Design-only, construction-only, or design-and-build?**
4. ~~Correct **Companies House number**?~~ [RESOLVED: sole trader — none.]
5. Publish CH45 6TR address, or **service-area only**?
6. May we use **"architectural design / drawings"**, or stick to **"design / building design"**?
7. Testimonials/reviews — usable? With names/permission?
8. Any accreditations / insurance / memberships to cite (or none)?
9. Real project photos now, or **placeholders at launch**?
10. Analytics: **Plausible/Umami** (recommended) or GA4?
11. Confirm **Resend** + the lead-notification email address.
12. Confirm phone/WhatsApp `+44 7749 456528`.
13. OK to use **Cloudflare Turnstile** for spam protection?
14. Visualiser data retention OK as proposed (delete source now, expire results 7 days)?
15. Visualiser model: start on **`gemini-2.5-flash-image`** (cheaper) or **`gemini-3-pro-image`** (higher quality, pricier)?

---

## ✅ Approval gate

**Do you approve proceeding to Stage 1 (Foundation)?**
I will not edit any project code or begin Stage 1 until you reply with your answers to §12 and an explicit "approved".
