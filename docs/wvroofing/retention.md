# WV Roofing: retention record (v1, 2026-09-28)

**Where the periods live.** Every period below is defined once, in `serverlib/wvroofing/retention.js`.
`scripts/wvroofing/tests/retention.test.mjs` checks this record, the privacy notice and the visualiser's
photo notice against those numbers. Changing a period is a code change, made together with the privacy
notice; that is why the periods aren't environment variables.

**How deletion happens.** A daily tidy-up does the deleting (`GET /api/wvroofing/cron/daily`, run by
Vercel once a day).

- It needs `CRON_SECRET`.
- Each run is recorded in `wvr_retention_runs`.
- The operator screen's **Costs** tab shows the last run.
- Each run deletes whatever is due, so a missed or repeated run does no harm.

## What we keep, and for how long

| What | Where | Kept for | Setting | How it goes |
|---|---|---|---|---|
| A visualiser project with no enquiry: the photo (original and working copy), roof outline, photo-real renders, address, property answers, plans and drawings the customer added, and the roofer's measurements | Neon rows, Vercel Blob files | 30 days from when it was started | `projectDays` | Daily tidy-up: files first, then the rows, which cascade |
| An enquiry, and the project it's about | Neon, Vercel Blob | 12 months | `enquiryMonths` | Daily tidy-up. Sending an enquiry pushes the project's expiry out to match |
| Files of renders that were never shown (failed, cancelled, set aside) | Vercel Blob | 7 days after the render ended | `unusedRenderFileDays` | Daily tidy-up |
| Uploads started but never finished, with their file; records of finished uploads | Neon, Vercel Blob | 24 hours | `uploadHours` | Daily tidy-up |
| Rate-limit counters (keyed hashes, never an IP address) | Neon | 48 hours | `rateLimitHours` | Daily tidy-up |
| Operator sessions, once ended (logged out or expired) | Neon | 7 days | `operatorSessionDays` | Daily tidy-up |
| Operator login attempts | Neon | 7 days | `loginAttemptDays` | Daily tidy-up |
| The operator history: who changed what, with before and after | Neon | 12 months | `operatorHistoryMonths` | Daily tidy-up |
| The paid-call log (provider, cost, status; its project link is cleared when the project goes) | Neon | 13 months | `providerCallMonths` | Daily tidy-up |
| The daily render budget ledger | Neon | 13 months | `budgetDayMonths` | Daily tidy-up |
| The daily tidy-up's own record | Neon | 90 days | `retentionRunDays` | Daily tidy-up |

**Keys held in browsers**

- **The customer's project key** is kept in `sessionStorage` for that tab only. It goes when the tab closes,
  and it stops working after 30 days, even while an enquiry keeps the project.
- **The operator's session key** is kept the same way. It goes when the tab closes, and stops working
  after 12 hours, at logout, or when the operator password changes.

**Nothing is cached in browsers.** Every image the API streams is sent `Cache-Control: private, no-store`,
so no copy is left on the customer's or operator's device.

## Deleting on request

- **Customers.** "Delete my photo and project" in the visualiser deletes the photo, outline, renders,
  address and answers at once. An enquiry already sent stays, with the contact details, until the roofer
  deletes it or it reaches 12 months.
- **The operator.**
  - Search the enquiry list by name, email, phone, postcode, address or reference to find everything from
    one person.
  - Then choose **Delete the photo and project only**, or **Delete the enquiry and its project**. The
    history keeps the reference and what was done, not the contact details.
- **Emails.** Emails already delivered to the roofer can't be recalled. For an erasure request, delete them
  from the mailbox, including sent and deleted items.

## Copies outside our control (checked 28 September 2026)

| Provider | What may remain after we delete | For how long | Source |
|---|---|---|---|
| Neon (Free plan) | Point-in-time restore history (the database's write-ahead log) | 6 hours. This is fixed on Free; Launch keeps up to 7 days and Scale up to 30 | neon.com/docs/introduction/plans |
| Vercel Blob | A cached copy in Vercel's CDN, readable only with our store's credentials, so only by our own function, which checks the database first | "may take up to 60 seconds" after a delete | vercel.com/docs/vercel-blob (Caching) |
| Vercel Blob | Backups of deleted files | Vercel's docs describe none. Storage is on Amazon S3 | vercel.com/docs/vercel-blob |
| OpenAI | The render request (photo, outline, prompt), kept for abuse monitoring | Up to 30 days under OpenAI's current terms; zero data retention is available on request | OpenAI platform docs, "Your data" |
| Apple iCloud Mail | The enquiry emails (and any attached images) in the roofer's mailbox | Until the roofer deletes them | n/a |
| Ideal Postcodes | Its own records of our lookups (the postcode) | Not checked; see its terms | terms.ideal-postcodes.co.uk |
| Google Maps Platform | Its own records of satellite image loads (location, the viewer's IP address) | Not checked; see Google's terms | cloud.google.com/maps-platform/terms |

## Not yet decided (before launch)

- **The periods themselves.** 30 days and 12 months are this concept's choices. The business should
  confirm them, and the enquiry period in particular should be checked against how long quotes and
  complaints need records.
- **Neon's history window.** A paid Neon plan keeps restorable history for longer: up to 7 or 30 days. If
  the project moves to one, this record and the privacy notice must say so.
