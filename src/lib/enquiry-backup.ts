/**
 * Durable enquiry backup + server-side email.
 *
 * Sends a copy of every form submission to the SC-isolated serverless function
 * (`/api/sc-enquiry-backup`), which (1) stores it in Supabase `sc_enquiries` AND
 * (2) emails Sean a notification server-side (iCloud SMTP) to both of his
 * addresses, with the enquirer's email as Reply-To. This is independent of the
 * external q-cbuild1 enquiry endpoint, so a lead reaches Sean even if that
 * endpoint is unavailable.
 *
 * Returns `{ stored, emailed }` so the caller can decide whether a client-side
 * `mailto:` fallback is still needed (only when BOTH server paths failed). The
 * request stays CORS-simple (text/plain → no preflight); `keepalive` lets it
 * finish even if the page navigates straight after on the happy path.
 */

export type BackupResult = { stored: boolean; emailed: boolean };

const BASE =
  process.env.NEXT_PUBLIC_SC_ANALYTICS_BASE || "https://scdesign-wirral.vercel.app";
const ENDPOINT = `${BASE}/api/sc-enquiry-backup`;

export async function backupEnquiry(
  form: string,
  fields: Record<string, unknown>
): Promise<BackupResult> {
  if (typeof window === "undefined") return { stored: false, emailed: false };
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
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
      keepalive: true,
      mode: "cors",
      credentials: "omit",
    });
    if (!res.ok) return { stored: false, emailed: false };
    const json = (await res.json().catch(() => ({}))) as Partial<BackupResult>;
    return { stored: !!json.stored, emailed: !!json.emailed };
  } catch {
    /* never let the backup interfere with the real submission */
    return { stored: false, emailed: false };
  }
}
