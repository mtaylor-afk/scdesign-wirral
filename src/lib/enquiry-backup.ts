/**
 * Best-effort enquiry backup.
 *
 * Sends a copy of a form submission to the SC-isolated analytics API so there's
 * a durable database record even if the email send is missed. This NEVER changes
 * or blocks the real submission: it's fire-and-forget, wrapped in try/catch, and
 * any failure is swallowed. The primary email workflow (QCbuild1 endpoint /
 * mailto) is untouched.
 *
 * Uses a text/plain body so the cross-origin POST is CORS-simple (no preflight)
 * and `keepalive` so it still completes if the page navigates straight after.
 */

const BASE =
  process.env.NEXT_PUBLIC_SC_ANALYTICS_BASE || "https://scdesign-wirral.vercel.app";
const ENDPOINT = `${BASE}/api/sc-enquiry-backup`;

export function backupEnquiry(form: string, fields: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    const u = new URL(window.location.href);
    const q = (k: string) => u.searchParams.get(k) || undefined;
    const payload = {
      form,
      fields,
      page: window.location.href,
      ref: document.referrer || undefined,
      lang: navigator.language,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      utm: {
        source: q("utm_source"),
        medium: q("utm_medium"),
        campaign: q("utm_campaign"),
        term: q("utm_term"),
        content: q("utm_content"),
      },
    };
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
      keepalive: true,
      mode: "cors",
      credentials: "omit",
    }).catch(() => {});
  } catch {
    /* never let the backup interfere with the real submission */
  }
}
