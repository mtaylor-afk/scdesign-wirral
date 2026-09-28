# WV Roofing: privacy record (v1, 2026-09-28, concept draft)

This record sits behind the privacy notice at `/WVROOFING/privacy/`. It covers what is processed, on which
lawful basis, by whom and where, for how long, and how requests are handled. It is a **concept draft**: WV
Roofing isn't trading, the controller's name and address are still placeholders, and the record must be
reviewed, with a legal and privacy review, before launch.

## 1. What is processed

| Data | From | Why | Stored |
|---|---|---|---|
| **House photo** | The customer, uploaded | To show roof options on it, and to prepare a quote if they ask | The original with its metadata (GPS, camera details, comments) removed, and a working copy. Private Vercel Blob, London |
| **Roof outline** | Drawn by the customer | To limit the change to the roof | Neon, London |
| **Photo-real renders** | OpenAI, from the photo and outline, only with consent | To show the finish | Private Vercel Blob |
| **Address** | The customer chooses one (Ideal Postcodes) or types it | So the roofer can prepare a quote or survey | Only the chosen address is kept: lines, UPRN, coordinates and where they came from. Neon |
| **Property answers** | The customer; the operator may add a correction | Scope of the roof | Neon. Corrections are added as new records, never overwrites |
| **Contact details** (name, phone and/or email, message) | Enquiry forms | To reply and prepare a quote | Neon, and the roofer's email |
| **Technical data** | The browser | Security and abuse limits | Rate-limit counters keyed by a daily HMAC of the IP address; the IP itself is never stored. Browser family |
| **Operator records** | The operator | Security, and an audit trail of changes | Neon: sessions, login attempts, history |

No special category data is asked for.

- Photos from the street can show people or number plates, and the photo tips say to avoid them.
- The sample houses are stock photographs, with number plates and house numbers blurred.

## 2. Lawful bases

| Processing | Basis | Notes |
|---|---|---|
| The visualiser: the photo, outline, address and answers, kept for 30 days | Legitimate interests (section 3) | The customer starts it, and can delete it at any time |
| Photo-real renders: sending the photo and outline to OpenAI | Consent | An off-by-default switch. Withdrawing it cancels renders not yet sent. Recorded as `consent_ai_at` |
| Enquiries: storing them, emailing the roofer, preparing a quote | Steps taken at the customer's request before entering into a contract | `lawful_basis = steps_before_contract` on every enquiry |
| Security: rate limits, abuse controls, operator login records | Legitimate interests (security of the service) | Keyed hashes only |
| Marketing | Not done | No form asks. The database field `marketing_opt_in` stays false |

Cookies (PECR): none are set.

- The customer's project key and the operator's session key are kept in `sessionStorage`. Each is strictly
  necessary for the service the person asked for, and goes when the tab closes.
- There are no analytics or advertising cookies, so there is no banner.

## 3. Legitimate interests assessment (the visualiser)

- **Purpose.** Let a visitor see roof finishes on a photo of their own house, and pick the job up again in
  the same tab. This is a service the visitor asks for, and a normal first step in getting a roofing quote.
- **Necessity.**
  - The photo has to be processed to show the roof, and kept while the visitor is using the tool.
  - Uploading it to private storage lets the server make photo-real renders (when asked) and attach the
    photo to an enquiry.
  - Only the chosen address is kept, never a whole list of addresses.
  - A browser-only design was the concept's first version. It can't make server renders or keep a job
    across a reload.
- **Balancing.**
  - The visitor starts it and chooses what to upload.
  - No account and no contact details are needed.
  - Metadata is stripped when the photo arrives.
  - Storage is private and deleted after 30 days.
  - "Delete my photo and project" works at any time.
  - Nothing is used for marketing or shared except with the processors listed.
  - A visitor using a roof visualiser would reasonably expect their photo to be processed and briefly kept
    in this way.
  - The main residual risk is a photo showing other people, which the photo tips address.
- **Outcome.** Legitimate interests is appropriate for the visualiser. Sending the photo to OpenAI, a
  processor in the US, remains separate and optional, on consent.

**DPIA screening.** There is no special category data, no systematic monitoring and no large-scale
profiling, and the processing is small in scale. A full DPIA doesn't appear to be required. Re-screen before
launch, and if the measurement features (Release B) change what is collected.

## 4. Processors, other recipients and transfers

| Recipient | Role | What they receive | Where | Basis for any transfer | Status |
|---|---|---|---|---|---|
| **Vercel** (functions, Blob) | Processor | Everything the API handles; the stored files | Blob: London. Functions: Washington DC (`iad1`) unless the region pin to London is accepted | Vercel's DPA. Processing in the US is a restricted transfer | Check Vercel's DPA and its transfer mechanism (Data Privacy Framework / UK Extension or IDTA) before launch |
| **Neon** (via the Vercel Marketplace) | Processor | The database rows | London (`aws-eu-west-2`) | Neon's DPA | Review the DPA before launch |
| **OpenAI** | Processor | The photo, outline and a fixed prompt; only with consent | Processed in the US | OpenAI's DPA with its UK Addendum, plus a short transfer risk assessment. The UK Addendum was seen only in search results; read the DPA before launch | API data isn't used for training by default. Abuse-monitoring copies are kept up to 30 days |
| **Ideal Postcodes** | Processor | The postcode | UK | none | Review its terms |
| **Google Maps Platform** | Provides the satellite image, which the customer's browser loads directly | The location of the address and the viewer's IP address | Google | Google's terms; the notice says so | Display only. Nothing is stored, traced or sent on |
| **Apple iCloud Mail** | Email delivery | The enquiry email and up to two images | Apple | Apple's terms | Consider a business mailbox with a DPA before launch |
| **Cloudflare** | Hosts the static pages | IP addresses in request logs | Global | Cloudflare's DPA | Shared SC Design hosting until WV has its own domain |
| **Google Fonts** | Serves the Inter typeface | IP address | Google | The notice says so | Could be self-hosted to remove this |

## 5. Retention

See `retention.md`. In short:

- Visualiser projects: 30 days.
- Enquiries and their projects: 12 months.
- Operator history: 12 months.
- Security records: 7 days to 48 hours.
- Cost records, with no personal data once the project is gone: 13 months.
- Provider copies: Neon history 6 hours; Blob cache 60 seconds; OpenAI up to 30 days.

## 6. Requests from customers

| Request | How it's handled |
|---|---|
| **Access** | Operator screen, then search by name, email, phone, postcode or reference, then open the enquiry. It shows everything held. **Get the original file** gives the photo; renders open full size. A copy is sent to the customer by email. |
| **Rectification** | The kind of property: **Correct the scope**, which keeps a history. Contact details can't be edited on the screen yet: note the correction in the reply, or delete the enquiry and ask the customer to send it again. This is a known gap. |
| **Erasure** | **Delete the enquiry and its project**, or **Delete the photo and project only**. Also delete the roofer's email copies. Provider copies expire as in section 5. |
| **Objection** | Treated as erasure for the visualiser. |
| **Withdrawing consent (OpenAI)** | The switch in the visualiser. The operator can't make renders for a customer who has withdrawn. |

Every operator action is recorded with before and after (`wvr_operator_actions`) and kept for 12 months.

## 7. Security measures (summary)

- **Customer access.**
  - A project key (256-bit, stored hashed) in `sessionStorage`, opening one project only.
  - A key for another project gets a 404.
  - Images are streamed through the API with the key and never cached (`private, no-store`).
  - Customers never get storage links.
- **Operator access.**
  - A scrypt password hash in an environment variable.
  - 12-hour sessions stored hashed. Logging out or a new password ends them.
  - Lockouts after 5 failures from one visitor, or 20 in all.
  - Every change audited.
- **Browser protection.**
  - A content security policy on every WV Roofing page, with no inline scripts except one hashed line.
  - Customer text is always shown as text.
  - Uploads: an allow-list of types, magic-byte checks, pixel limits, metadata stripped, random server-side
    names, and private storage.
- **Abuse controls.** Rate limits on every paid call, a daily budget, and a kill switch (`WVR_ENABLED=0`).

## 8. Open items before launch

1. The controller's name and address, and a contact for privacy requests (the notice has placeholders).
2. A legal review of this record and the notice, including reading the OpenAI and Vercel DPAs.
3. Decide the function region (London needs the region pin; see the handover).
4. A business mailbox with a DPA for enquiry emails.
5. Confirm the retention periods (`retention.md`).
