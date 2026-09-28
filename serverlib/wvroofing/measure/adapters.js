// WV Roofing — automatic roof measurement, as honest stubs (B4; plan D11, brief §3).
//
// No automatic measurement provider can be used for this site today: each one
// either doesn't license its data for showing derived figures to customers, or
// won't say (permissions.js). So each adapter answers "unsupported" with its
// reasons and is never called over the network. The auto_measurement capability
// stays disabled whatever keys are set (capabilities.js).
//
// To make one of these real, three things have to happen first: the provider's
// written permission (display and derivation), a completed permissions record,
// and a validation pilot the roofer has agreed. See docs/wvroofing/supplier-enquiries.md.
"use strict";

// The areas this site covers (the home page's lists): the Wirral and Liverpool.
const SERVICE_DISTRICTS = [
  ...[41, 42, 43, 44, 45, 46, 47, 48, 49, 60, 61, 62, 63, 64].map((n) => "CH" + n),
  ...Array.from({ length: 38 }, (_, i) => "L" + (i + 1)),
];

/** The postcode's district ("CH45 1AB" -> "CH45"), or null. @param {unknown} postcode */
function district(postcode) {
  const m = /^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/.exec(String(postcode || "").toUpperCase().trim());
  return m ? m[1] : null;
}

/** @param {unknown} postcode */
function inServiceArea(postcode) {
  const d = district(postcode);
  return !!d && SERVICE_DISTRICTS.includes(d);
}

/**
 * @typedef {{ uprn?: string | null, postcode?: string | null, lat?: number | null, lng?: number | null, coordSource?: string | null }} Located
 * @typedef {{ provider: string, status: "unsupported", reasons: string[], why: string }} AutomaticResult
 */

/**
 * @param {string} provider
 * @param {string} why  in plain words, for the operator
 * @returns {{ provider: string, measure: (a: Located) => Promise<AutomaticResult> }}
 */
function stub(provider, why) {
  return {
    provider,
    async measure(a) {
      /** @type {string[]} */
      const reasons = [];
      if (!inServiceArea(a && a.postcode)) reasons.push("geography_unsupported");
      reasons.push("licence_unresolved");
      return { provider, status: "unsupported", reasons, why };
    },
  };
}

const ADAPTERS = [
  stub("google_solar", "Google's Solar API has the right roof data for Merseyside, but its terms limit it to energy systems; re-roofing needs Google's written permission."),
  stub("vexcel", "Vexcel covers Liverpool, but sells by subscription with no published terms for showing figures on a website."),
  stub("bluesky", "Bluesky's standard licence forbids showing its data on the web or selling what's derived from it; a bespoke licence is needed."),
];

/**
 * What every automatic provider says about a property: always unsupported, with reasons.
 * @param {Located} a
 * @returns {Promise<AutomaticResult[]>}
 */
async function automatic(a) {
  return Promise.all(ADAPTERS.map((x) => x.measure(a)));
}

module.exports = { ADAPTERS, automatic, inServiceArea, district, SERVICE_DISTRICTS };
