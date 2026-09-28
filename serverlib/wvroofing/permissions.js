// WV Roofing — permissions record: what each outside provider's terms let us do.
//
// This file is the source of truth for docs/wvroofing/permissions-record.md.
// capabilities.js refuses to enable an operation unless every right it needs
// is "yes" here, so an unresolved licence question switches the feature off
// rather than being quietly ignored (brief §7).
//
// Rights, from WV Roofing's side:
//   display       show the provider's content (or figures derived from it) to customers
//   processing    send our data to / use the provider for this purpose
//   derivation    derive new data (geometry, measurements) from the provider's content
//   retention     keep the provider's content or results in our own storage
//   export        pass the content on to third parties (emails, downloads, reports)
//   attribution   attribution is required and must be shown ("yes") or is not required ("no")
//   thirdPartyAI  send the provider's content to another AI service
// Values: "yes" | "no" | "unresolved" | "n/a".
"use strict";

/** @typedef {"yes" | "no" | "unresolved" | "n/a"} Right */
/**
 * @typedef {object} ProviderRecord
 * @property {string} name
 * @property {string} role
 * @property {Right} display
 * @property {Right} processing
 * @property {Right} derivation
 * @property {Right} retention
 * @property {Right} export
 * @property {Right} attribution
 * @property {Right} thirdPartyAI
 * @property {string[]} sources
 * @property {string} checked  ISO date the terms were last read
 * @property {string} notes
 */

/** @type {Readonly<Record<string, Readonly<ProviderRecord>>>} */
const PROVIDERS = Object.freeze({
  openai: Object.freeze({
    name: "OpenAI (Images API)",
    role: "Photo-real roof renders from the customer's photo and roof mask",
    display: "yes",
    processing: "yes",
    derivation: "n/a",
    retention: "yes",
    export: "yes",
    attribution: "no",
    thirdPartyAI: "n/a",
    sources: [
      "https://developers.openai.com/api/docs/guides/your-data",
      "https://developers.openai.com/api/docs/guides/image-generation",
      "https://openai.com/policies/data-processing-addendum/",
    ],
    checked: "2026-09-27",
    notes:
      "API data is not used for training; abuse-monitoring logs are kept up to 30 days. Processing happens in the US (or EU/UAE with data residency). The DPA's UK Addendum was seen only in search snippets (openai.com blocks automated fetches) - Matthew to read the DPA before launch. Renders are labelled as AI concept images, never as completed work.",
  }),
  ideal_postcodes: Object.freeze({
    name: "Ideal Postcodes (Royal Mail PAF, UPRN, rooftop coordinates)",
    role: "Postcode -> address list; stores only the address the customer picks",
    display: "yes",
    processing: "yes",
    derivation: "no",
    retention: "yes",
    export: "no",
    attribution: "n/a",
    thirdPartyAI: "no",
    sources: [
      "https://docs.ideal-postcodes.co.uk/docs/api/postcodes/",
      "https://docs.ideal-postcodes.co.uk/docs/data/paf/",
      "https://terms.ideal-postcodes.co.uk/third-party-licences/royal-mail/",
      "https://terms.ideal-postcodes.co.uk/extended-terms-of-service/uprn-rooftop-geolocation",
    ],
    checked: "2026-09-27",
    notes:
      "Display is allowed 'for the purposes of capturing or confirming address details'. Extracted data must not be supplied to third parties, and there is no express permission to cache whole lookup responses, so only the selected address is kept.",
  }),
  google_static_maps: Object.freeze({
    name: "Google Maps Static API (satellite)",
    role: "A satellite picture of the chosen address so the customer can confirm the house",
    display: "yes",
    processing: "yes",
    derivation: "no",
    retention: "no",
    export: "no",
    attribution: "yes",
    thirdPartyAI: "no",
    sources: [
      "https://cloud.google.com/maps-platform/terms",
      "https://cloud.google.com/maps-platform/terms/maps-service-terms",
      "https://developers.google.com/maps/billing-and-pricing/sku-details",
    ],
    checked: "2026-09-28",
    notes:
      "Terms 3.2.3(a) forbid export/scraping, 3.2.3(c) forbid creating content from Google Maps Content (e.g. tracing building outlines from satellite imagery), (e) forbid use with a non-Google map, and (c)(vii) forbid improving ML/AI models. So the image is display-only: never stored, proxied, traced or sent to OpenAI, and Google's attribution stays visible.",
  }),
  esri_world_imagery: Object.freeze({
    name: "Esri World Imagery (ArcGIS Location Platform)",
    role: "Alternative interactive aerial view (not configured)",
    display: "yes",
    processing: "yes",
    derivation: "no",
    retention: "no",
    export: "no",
    attribution: "yes",
    thirdPartyAI: "no",
    sources: ["https://location.arcgis.com/pricing/", "https://www.esri.com/content/dam/esrisites/en-us/media/legal/platform/platform-legal.pdf"],
    checked: "2026-09-27",
    notes: "'Only use Resultant Output for visualization purposes'. Requires an API key; the keyless tiles used in the old research notes are not licensed for a commercial site.",
  }),
  os_ngd: Object.freeze({
    name: "Ordnance Survey NGD API - Features (Buildings)",
    role: "Operator-only reference: footprint, heights, roof shape and aspect areas",
    display: "unresolved",
    processing: "yes",
    derivation: "unresolved",
    retention: "unresolved",
    export: "unresolved",
    attribution: "yes",
    thirdPartyAI: "unresolved",
    sources: ["https://docs.os.uk/osngd/data-structure/buildings/building-features/building-part", "https://osdatahub.os.uk/support/faqs/plans", "https://osdatahub.os.uk/support/legal/api-terms"],
    checked: "2026-09-27",
    notes: "Premium data (first GBP 1,000/month free). Whether figures derived from it may be shown to customers is unverified, so it is operator-only until the OS API terms are read.",
  }),
  os_linked_identifiers: Object.freeze({
    name: "Ordnance Survey Linked Identifiers API",
    role: "UPRN <-> TOID lookup (operator reference)",
    display: "yes",
    processing: "yes",
    derivation: "yes",
    retention: "yes",
    export: "yes",
    attribution: "yes",
    thirdPartyAI: "n/a",
    sources: ["https://docs.os.uk/os-apis/accessing-os-apis/os-linked-identifiers-api"],
    checked: "2026-09-27",
    notes: "A free OpenData product; OS attribution required.",
  }),
  ea_lidar: Object.freeze({
    name: "Environment Agency National LIDAR Programme",
    role: "Height data for the optional operator desk-measure tool (B5)",
    display: "unresolved",
    processing: "unresolved",
    derivation: "unresolved",
    retention: "unresolved",
    export: "unresolved",
    attribution: "yes",
    thirdPartyAI: "unresolved",
    sources: ["https://data.gov.uk/dataset/f0db0249-f17b-4036-9e65-309148c97ce4/national-lidar-programme", "https://ckan.publishing.service.gov.uk/dataset/lidar-composite-first-return-digital-surface-model-fz-dsm-1m"],
    checked: "2026-09-27",
    notes: "The programme page says Open Government Licence but one CKAN record says 'No Licence Provided'. Reconcile before relying on it.",
  }),
  google_solar: Object.freeze({
    name: "Google Solar API",
    role: "Roof-segment pitch and area (not used)",
    display: "no",
    processing: "no",
    derivation: "no",
    retention: "no",
    export: "no",
    attribution: "yes",
    thirdPartyAI: "no",
    sources: ["https://cloud.google.com/maps-platform/terms/maps-service-terms"],
    checked: "2026-09-28",
    notes: "Service terms 20.1 limit use to energy-system feasibility, design and proposals; a re-roofing estimate is not one of them. Needs Google's written confirmation before any use.",
  }),
  bluesky: Object.freeze({
    name: "Bluesky International (imagery, DSM, 3D building models)",
    role: "Candidate licensed imagery/height data (not used)",
    display: "no",
    processing: "unresolved",
    derivation: "no",
    retention: "unresolved",
    export: "no",
    attribution: "yes",
    thirdPartyAI: "unresolved",
    sources: ["https://bluesky-world.com/geostream-subscription-service/", "https://www.emapsite.com/licenses/bluesky/Bluesky_Data_Licence_Agreement.pdf"],
    checked: "2026-09-27",
    notes: "The standard data licence prohibits display on the World Wide Web and derivation for sale or supply; a bespoke licence and price are needed.",
  }),
  getmapping: Object.freeze({
    name: "Getmapping (aerial imagery, height data)",
    role: "Candidate licensed imagery/height data (not used)",
    display: "no",
    processing: "unresolved",
    derivation: "unresolved",
    retention: "unresolved",
    export: "no",
    attribution: "yes",
    thirdPartyAI: "unresolved",
    sources: ["https://www1.getmapping.com/Webshop/Licences/IElicence.htm", "https://www.getmapping.co.uk/faqs/"],
    checked: "2026-09-27",
    notes: "The standard licence is for internal use only and excludes publishing on the internet; a bespoke licence is needed.",
  }),
  vexcel: Object.freeze({
    name: "Vexcel Data Program",
    role: "Candidate imagery/DSM covering Liverpool (not used)",
    display: "unresolved",
    processing: "unresolved",
    derivation: "unresolved",
    retention: "unresolved",
    export: "unresolved",
    attribution: "yes",
    thirdPartyAI: "unresolved",
    sources: ["https://vexceldata.com/countries/united-kingdom/", "https://vexceldata.com/platform/"],
    checked: "2026-09-27",
    notes: "Subscription only; no public price or web-display terms.",
  }),
  hover: Object.freeze({
    name: "Hover (photo-based roof reports)",
    role: "Roof reports the roofer may order and enter by hand (assisted route)",
    display: "no",
    processing: "yes",
    derivation: "yes",
    retention: "yes",
    export: "no",
    attribution: "n/a",
    thirdPartyAI: "no",
    sources: ["https://hover.to/terms-of-use/", "https://hover.to/pricing/", "https://www.nmbs.co.uk/hover-2/"],
    checked: "2026-09-27",
    notes: "Hover data is 'solely for your personal or internal business purposes', so Hover figures stay operator-only (customer_visible = false) unless Hover's UK terms say otherwise.",
  }),
  vercel: Object.freeze({
    name: "Vercel (functions, Blob storage)",
    role: "Runs the API and stores photos and renders (private store)",
    display: "n/a",
    processing: "yes",
    derivation: "n/a",
    retention: "yes",
    export: "n/a",
    attribution: "n/a",
    thirdPartyAI: "n/a",
    sources: ["https://vercel.com/docs/vercel-blob/private-storage", "https://vercel.com/docs/limits/fair-use-guidelines"],
    checked: "2026-09-28",
    notes: "Hobby plans are restricted to non-commercial personal use: a commercial launch needs Pro (or a separate Pro project).",
  }),
  neon: Object.freeze({
    name: "Neon Postgres (via the Vercel Marketplace)",
    role: "The database for projects, jobs and enquiries",
    display: "n/a",
    processing: "yes",
    derivation: "n/a",
    retention: "yes",
    export: "n/a",
    attribution: "n/a",
    thirdPartyAI: "n/a",
    sources: ["https://neon.com/docs/introduction/plans", "https://neon.com/docs/introduction/regions"],
    checked: "2026-09-27",
    notes: "London region (aws-eu-west-2) chosen at creation.",
  }),
  apple_icloud_mail: Object.freeze({
    name: "Apple iCloud Mail (SMTP)",
    role: "Sends the enquiry notification to the roofer",
    display: "n/a",
    processing: "yes",
    derivation: "n/a",
    retention: "n/a",
    export: "n/a",
    attribution: "n/a",
    thirdPartyAI: "n/a",
    sources: [],
    checked: "2026-09-27",
    notes: "Existing SMTP account; sender name is always 'WV Roofing'. A business mailbox with a data processing agreement is recommended before launch (privacy-record.md).",
  }),
  cloudflare: Object.freeze({
    name: "Cloudflare Pages",
    role: "Hosts the static pages (shared with SC Design until WV Roofing has its own domain)",
    display: "n/a",
    processing: "yes",
    derivation: "n/a",
    retention: "n/a",
    export: "n/a",
    attribution: "n/a",
    thirdPartyAI: "n/a",
    sources: ["https://developers.cloudflare.com/pages/configuration/headers/", "https://www.cloudflare.com/cloudflare-customer-dpa/"],
    checked: "2026-09-28",
    notes: "Receives visitors' IP addresses in its request logs; covered by Cloudflare's data processing addendum. No customer data is stored there: pages only.",
  }),
  google_fonts: Object.freeze({
    name: "Google Fonts",
    role: "Serves the Inter typeface to devices without Apple's system font",
    display: "n/a",
    processing: "yes",
    derivation: "n/a",
    retention: "n/a",
    export: "n/a",
    attribution: "n/a",
    thirdPartyAI: "n/a",
    sources: ["https://developers.google.com/fonts/faq/privacy"],
    checked: "2026-09-28",
    notes: "The visitor's browser fetches the font from Google, so Google receives the IP address; the privacy notice says so. Self-hosting the font would remove this.",
  }),
});

/**
 * Which rights each capability needs, as [provider, right] pairs. A capability
 * with an empty list uses only our own and the customer's data.
 * @type {Readonly<Record<string, ReadonlyArray<readonly [string, keyof ProviderRecord]>>>}
 */
const REQUIREMENTS = Object.freeze({
  address_lookup: [
    ["ideal_postcodes", "processing"],
    ["ideal_postcodes", "display"],
    ["ideal_postcodes", "retention"],
  ],
  aerial_display: [
    ["google_static_maps", "processing"],
    ["google_static_maps", "display"],
  ],
  image_generation: [
    ["openai", "processing"],
    ["openai", "retention"],
  ],
  enquiry_storage: [
    ["vercel", "processing"],
    ["vercel", "retention"],
    ["neon", "processing"],
    ["neon", "retention"],
  ],
  enquiry_delivery: [["apple_icloud_mail", "processing"]],
  assisted_measurement: [],
  os_reference: [["os_ngd", "processing"]],
  desk_measure: [
    ["os_ngd", "processing"],
    ["ea_lidar", "processing"],
    ["ea_lidar", "derivation"],
  ],
  auto_measurement: [],
});

/**
 * Check that every right a capability needs is "yes".
 * @param {string} capability
 * @returns {{ ok: boolean, missing: string[] }}
 */
function rightsFor(capability) {
  const reqs = REQUIREMENTS[capability] || [];
  const missing = [];
  for (const [provider, right] of reqs) {
    const rec = PROVIDERS[provider];
    const v = rec ? rec[right] : "unresolved";
    if (v !== "yes") missing.push(provider + "." + String(right) + "=" + String(v || "unresolved"));
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Render the record as Markdown (docs/wvroofing/permissions-record.md).
 * @returns {string}
 */
function toMarkdown() {
  const cols = ["display", "processing", "derivation", "retention", "export", "attribution", "thirdPartyAI"];
  const lines = [
    "# WV Roofing permissions record",
    "",
    "Generated from `serverlib/wvroofing/permissions.js` (do not edit by hand). A capability is only enabled when every right it needs is `yes`.",
    "",
    "| Provider | Role | " + cols.join(" | ") + " | Checked |",
    "|---|---|" + cols.map(() => "---").join("|") + "|---|",
  ];
  for (const rec of Object.values(PROVIDERS)) {
    lines.push("| " + rec.name + " | " + rec.role + " | " + cols.map((c) => String(rec[/** @type {keyof ProviderRecord} */ (c)])).join(" | ") + " | " + rec.checked + " |");
  }
  lines.push("", "## Notes and sources", "");
  for (const rec of Object.values(PROVIDERS)) {
    lines.push("**" + rec.name + ".** " + rec.notes + (rec.sources.length ? " Sources: " + rec.sources.join(", ") : ""), "");
  }
  return lines.join("\n");
}

module.exports = { PROVIDERS, REQUIREMENTS, rightsFor, toMarkdown };
