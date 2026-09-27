// WV Roofing — site configuration (plain ES module, no build step).

/**
 * Where the serverless API lives.
 * - On the Vercel copy (scdesign-wirral.vercel.app) and the local dev server the
 *   API is same-origin, so relative URLs work.
 * - On scdesignwirral.co.uk (Cloudflare Pages, static only) it is cross-origin.
 */
function resolveApiBase() {
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1" || h === "scdesign-wirral.vercel.app") return "";
  return "https://scdesign-wirral.vercel.app";
}

export const API_BASE = resolveApiBase();
export const ROOT = "/WVROOFING/";
export const IS_LOCAL = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

/**
 * Concept placeholders. The phone number is from Ofcom's range reserved for
 * drama (0151 496 0000-0999), so it can never ring a real person.
 */
export const CONTACT = {
  phone: "0151 496 0321",
  phoneHref: "tel:+441514960321",
  email: "hello@wvroofing.co.uk",
};
