// WV Roofing — the aerial view the customer confirms their house on (A5; brief §7, plan D10).
//
// A Google Maps Static API satellite image, signed on the server (the URL-signing
// secret never leaves it). Display only: the image goes straight from Google to
// the customer's browser; it is never stored, proxied, traced or sent to OpenAI
// (Google's terms forbid deriving content from it). A pin is drawn only when the
// coordinates are rooftop-accurate; postcode centroids get a wider view and no pin.
// The labelled test environment uses a generated stand-in image.
"use strict";

const crypto = require("crypto");
const { isTest } = require("./capabilities.js");

const HOST = "https://maps.googleapis.com";
const PATH = "/maps/api/staticmap";

/**
 * @typedef {{ lat: number | null, lng: number | null, coordSource: string }} Located
 * @typedef {{ available: true, url: string, pin: boolean, provider: string, attribution: string } | { available: false, reason: string }} View
 */

/**
 * Sign a path-and-query for the Maps Static API: HMAC-SHA1 with the URL-safe
 * base64-decoded secret, result URL-safe base64 (Google's "digital signature").
 * @param {string} pathAndQuery  e.g. "/maps/api/staticmap?center=...&key=..."
 * @param {string} urlSafeSecret
 */
function signature(pathAndQuery, urlSafeSecret) {
  const key = Buffer.from(urlSafeSecret.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  return crypto.createHmac("sha1", key).update(pathAndQuery).digest("base64").replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * The signed satellite image URL for a location.
 * @param {{ lat: number, lng: number, rooftop: boolean }} at
 * @param {string} apiKey
 * @param {string} urlSafeSecret
 */
function staticMapUrl(at, apiKey, urlSafeSecret) {
  const centre = at.lat.toFixed(6) + "," + at.lng.toFixed(6);
  const q = new URLSearchParams({ center: centre, zoom: at.rooftop ? "20" : "18", size: "640x400", scale: "2", maptype: "satellite", format: "jpg" });
  if (at.rooftop) q.append("markers", "color:0x0071e3|" + centre);
  q.append("key", apiKey);
  const pathAndQuery = PATH + "?" + q.toString();
  return HOST + pathAndQuery + "&signature=" + signature(pathAndQuery, urlSafeSecret);
}

/**
 * TEST ENVIRONMENT ONLY: a plain drawn "aerial" (roofs on grass) as an SVG data URL.
 * @param {boolean} pin
 */
function fixtureImage(pin) {
  if (!isTest(process.env)) throw new Error("The imagery fixture exists only in the test environment.");
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">' +
    '<rect width="640" height="400" fill="#5f7a4f"/>' +
    '<rect x="0" y="330" width="640" height="70" fill="#8a8a86"/>' +
    [60, 200, 340, 480].map((x) => '<rect x="' + x + '" y="120" width="110" height="150" fill="#7a3f33"/><rect x="' + (x + 50) + '" y="120" width="10" height="150" fill="#5c2f26"/>').join("") +
    (pin ? '<circle cx="395" cy="190" r="14" fill="#0071e3" stroke="#fff" stroke-width="4"/>' : "") +
    '<text x="12" y="390" font-family="Arial" font-size="14" fill="#fff">Test imagery (test environment)</text></svg>';
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

/**
 * The aerial view for a stored address, or why there isn't one.
 * @param {Located} a
 * @param {boolean} enabled  the aerial_display capability
 * @returns {Promise<View>}
 */
async function view(a, enabled) {
  if (!enabled) return { available: false, reason: "not_configured" };
  if (a.lat === null || a.lng === null || a.coordSource === "none") return { available: false, reason: "no_coordinates" };
  const rooftop = a.coordSource === "rooftop";
  if (isTest(process.env)) {
    return { available: true, url: fixtureImage(rooftop), pin: rooftop, provider: "fixture", attribution: "Test imagery (test environment)" };
  }
  const key = process.env.WVR_GOOGLE_MAPS_STATIC_KEY || "";
  const secretValue = process.env.WVR_GOOGLE_MAPS_SIGNING_SECRET || "";
  if (!key || !secretValue) return { available: false, reason: "not_configured" };
  return { available: true, url: staticMapUrl({ lat: a.lat, lng: a.lng, rooftop }, key, secretValue), pin: rooftop, provider: "google_static_maps", attribution: "Imagery: Google" };
}

module.exports = { view, staticMapUrl, signature };
