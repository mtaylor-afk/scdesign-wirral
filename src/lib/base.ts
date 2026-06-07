/**
 * Base-path + static-export helpers.
 *
 * For the GitHub Pages static export the site is served under a sub-path
 * (e.g. /sc/site) and there is no server, so:
 *  - raw asset/anchor paths must be prefixed with the basePath, and
 *  - the contact + send-concept forms fall back to email/WhatsApp.
 *
 * In the normal (Vercel) build both are empty/false, so behaviour is unchanged.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const IS_STATIC = process.env.NEXT_PUBLIC_STATIC === "1";

/**
 * Explicit search-indexing kill switch, DECOUPLED from IS_STATIC on purpose.
 * The live own-domain deploy (scdesignwirral.co.uk) leaves this unset and is
 * fully indexable. Set NEXT_PUBLIC_NOINDEX="1" only for preview / non-production
 * builds you want kept out of search.
 */
export const NOINDEX = process.env.NEXT_PUBLIC_NOINDEX === "1";

/** Prefix an absolute internal path ("/x") with the basePath. Leaves
 *  data: URLs, http(s), mailto:, tel: and hash links untouched. */
export function withBase(path: string): string {
  if (!path) return path;
  return path.startsWith("/") && !path.startsWith("//") ? BASE_PATH + path : path;
}
