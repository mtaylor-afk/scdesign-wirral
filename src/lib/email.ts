/**
 * Email provider abstraction. Default implementation = Resend, but the rest of
 * the app only calls `sendEmail(...)`, so the provider can be swapped freely.
 * Degrades gracefully (logs + returns ok:false) when not configured.
 */

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export async function sendEmail(
  input: SendEmailInput
): Promise<{ ok: boolean; id?: string; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL || "SC Design & Construction <onboarding@resend.dev>";

  if (!apiKey) {
    // Dev/preview without email configured — do not throw, just no-op.
    console.warn("[email] RESEND_API_KEY not set — email send skipped");
    return { ok: false, skipped: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[email] resend error", res.status, body);
      return { ok: false, error: `resend_${res.status}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    console.error("[email] send failed", err);
    return { ok: false, error: "send_failed" };
  }
}

export const LEAD_NOTIFICATION_EMAIL =
  process.env.LEAD_NOTIFICATION_EMAIL || "scdesignandconstruction1@gmail.com";

/** Minimal HTML escaping for values interpolated into notification emails. */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
