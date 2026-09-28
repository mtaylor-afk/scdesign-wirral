# WV Roofing permissions record

Generated from `serverlib/wvroofing/permissions.js` (do not edit by hand). A capability is only enabled when every right it needs is `yes`.

| Provider | Role | display | processing | derivation | retention | export | attribution | thirdPartyAI | Checked |
|---|---|---|---|---|---|---|---|---|---|
| OpenAI (Images API) | Photo-real roof renders from the customer's photo and roof mask | yes | yes | n/a | yes | yes | no | n/a | 2026-09-27 |
| Ideal Postcodes (Royal Mail PAF, UPRN, rooftop coordinates) | Postcode -> address list; stores only the address the customer picks | yes | yes | no | yes | no | n/a | no | 2026-09-27 |
| Google Maps Static API (satellite) | A satellite picture of the chosen address so the customer can confirm the house | yes | yes | no | no | no | yes | no | 2026-09-28 |
| Esri World Imagery (ArcGIS Location Platform) | Alternative interactive aerial view (not configured) | yes | yes | no | no | no | yes | no | 2026-09-27 |
| Ordnance Survey NGD API - Features (Buildings) | Operator-only reference: footprint, heights, roof shape and aspect areas | unresolved | yes | unresolved | unresolved | unresolved | yes | unresolved | 2026-09-27 |
| Ordnance Survey Linked Identifiers API | UPRN <-> TOID lookup (operator reference) | yes | yes | yes | yes | yes | yes | n/a | 2026-09-27 |
| Environment Agency National LIDAR Programme | Height data for the optional operator desk-measure tool (B5) | unresolved | unresolved | unresolved | unresolved | unresolved | yes | unresolved | 2026-09-27 |
| Google Solar API | Roof-segment pitch and area (not used) | no | no | no | no | no | yes | no | 2026-09-28 |
| Bluesky International (imagery, DSM, 3D building models) | Candidate licensed imagery/height data (not used) | no | unresolved | no | unresolved | no | yes | unresolved | 2026-09-27 |
| Getmapping (aerial imagery, height data) | Candidate licensed imagery/height data (not used) | no | unresolved | unresolved | unresolved | no | yes | unresolved | 2026-09-27 |
| Vexcel Data Program | Candidate imagery/DSM covering Liverpool (not used) | unresolved | unresolved | unresolved | unresolved | unresolved | yes | unresolved | 2026-09-27 |
| Hover (photo-based roof reports) | Roof reports the roofer may order and enter by hand (assisted route) | no | yes | yes | yes | no | n/a | no | 2026-09-27 |
| Vercel (functions, Blob storage) | Runs the API and stores photos and renders (private store) | n/a | yes | n/a | yes | n/a | n/a | n/a | 2026-09-28 |
| Neon Postgres (via the Vercel Marketplace) | The database for projects, jobs and enquiries | n/a | yes | n/a | yes | n/a | n/a | n/a | 2026-09-27 |
| Apple iCloud Mail (SMTP) | Sends the enquiry notification to the roofer | n/a | yes | n/a | n/a | n/a | n/a | n/a | 2026-09-27 |

## Notes and sources

**OpenAI (Images API).** API data is not used for training; abuse-monitoring logs are kept up to 30 days. Processing happens in the US (or EU/UAE with data residency). The DPA's UK Addendum was seen only in search snippets (openai.com blocks automated fetches) - Matthew to read the DPA before launch. Renders are labelled as AI concept images, never as completed work. Sources: https://developers.openai.com/api/docs/guides/your-data, https://developers.openai.com/api/docs/guides/image-generation, https://openai.com/policies/data-processing-addendum/

**Ideal Postcodes (Royal Mail PAF, UPRN, rooftop coordinates).** Display is allowed 'for the purposes of capturing or confirming address details'. Extracted data must not be supplied to third parties, and there is no express permission to cache whole lookup responses, so only the selected address is kept. Sources: https://docs.ideal-postcodes.co.uk/docs/api/postcodes/, https://docs.ideal-postcodes.co.uk/docs/data/paf/, https://terms.ideal-postcodes.co.uk/third-party-licences/royal-mail/, https://terms.ideal-postcodes.co.uk/extended-terms-of-service/uprn-rooftop-geolocation

**Google Maps Static API (satellite).** Terms 3.2.3(a) forbid export/scraping, 3.2.3(c) forbid creating content from Google Maps Content (e.g. tracing building outlines from satellite imagery), (e) forbid use with a non-Google map, and (c)(vii) forbid improving ML/AI models. So the image is display-only: never stored, proxied, traced or sent to OpenAI, and Google's attribution stays visible. Sources: https://cloud.google.com/maps-platform/terms, https://cloud.google.com/maps-platform/terms/maps-service-terms, https://developers.google.com/maps/billing-and-pricing/sku-details

**Esri World Imagery (ArcGIS Location Platform).** 'Only use Resultant Output for visualization purposes'. Requires an API key; the keyless tiles used in the old research notes are not licensed for a commercial site. Sources: https://location.arcgis.com/pricing/, https://www.esri.com/content/dam/esrisites/en-us/media/legal/platform/platform-legal.pdf

**Ordnance Survey NGD API - Features (Buildings).** Premium data (first GBP 1,000/month free). Whether figures derived from it may be shown to customers is unverified, so it is operator-only until the OS API terms are read. Sources: https://docs.os.uk/osngd/data-structure/buildings/building-features/building-part, https://osdatahub.os.uk/support/faqs/plans, https://osdatahub.os.uk/support/legal/api-terms

**Ordnance Survey Linked Identifiers API.** A free OpenData product; OS attribution required. Sources: https://docs.os.uk/os-apis/accessing-os-apis/os-linked-identifiers-api

**Environment Agency National LIDAR Programme.** The programme page says Open Government Licence but one CKAN record says 'No Licence Provided'. Reconcile before relying on it. Sources: https://data.gov.uk/dataset/f0db0249-f17b-4036-9e65-309148c97ce4/national-lidar-programme, https://ckan.publishing.service.gov.uk/dataset/lidar-composite-first-return-digital-surface-model-fz-dsm-1m

**Google Solar API.** Service terms 20.1 limit use to energy-system feasibility, design and proposals; a re-roofing estimate is not one of them. Needs Google's written confirmation before any use. Sources: https://cloud.google.com/maps-platform/terms/maps-service-terms

**Bluesky International (imagery, DSM, 3D building models).** The standard data licence prohibits display on the World Wide Web and derivation for sale or supply; a bespoke licence and price are needed. Sources: https://bluesky-world.com/geostream-subscription-service/, https://www.emapsite.com/licenses/bluesky/Bluesky_Data_Licence_Agreement.pdf

**Getmapping (aerial imagery, height data).** The standard licence is for internal use only and excludes publishing on the internet; a bespoke licence is needed. Sources: https://www1.getmapping.com/Webshop/Licences/IElicence.htm, https://www.getmapping.co.uk/faqs/

**Vexcel Data Program.** Subscription only; no public price or web-display terms. Sources: https://vexceldata.com/countries/united-kingdom/, https://vexceldata.com/platform/

**Hover (photo-based roof reports).** Hover data is 'solely for your personal or internal business purposes', so Hover figures stay operator-only (customer_visible = false) unless Hover's UK terms say otherwise. Sources: https://hover.to/terms-of-use/, https://hover.to/pricing/, https://www.nmbs.co.uk/hover-2/

**Vercel (functions, Blob storage).** Hobby plans are restricted to non-commercial personal use: a commercial launch needs Pro (or a separate Pro project). Sources: https://vercel.com/docs/vercel-blob/private-storage, https://vercel.com/docs/limits/fair-use-guidelines

**Neon Postgres (via the Vercel Marketplace).** London region (aws-eu-west-2) chosen at creation. Sources: https://neon.com/docs/introduction/plans, https://neon.com/docs/introduction/regions

**Apple iCloud Mail (SMTP).** Existing SMTP account; sender name is always 'WV Roofing'.

