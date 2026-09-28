# WV Roofing: cost model (v1, 2026-09-28)

Prices were checked on 27–28 September 2026 (sources in `decisions.md` section 2). What the site actually
spends is recorded at each paid call (`wvr_provider_calls`) and shown on the operator screen's **Costs**
tab. The providers' own bills are the final word.

## Unit costs

| Service | Price | Notes |
|---|---|---|
| **OpenAI photo-real render**, `gpt-image-2.5-sunburst` at `high` (the default) | About **$0.09** each at 1536×1024: $0.041 output (OpenAI's published figure) plus about $0.05 input, which is unverified | Real cost comes from the usage OpenAI reports and is checked against the dashboard in A8. Failed, uncertain and repeated renders all count |
| **Ideal Postcodes** address lookup | £0.028–£0.045 per successful lookup; a postcode that isn't found costs nothing | Recorded at £0.045, the most it can be |
| **Google Maps Static API** satellite image | Free for 10,000 loads a month, then $2 per 1,000 | Recorded at $0.002 per load, the rate beyond the free allowance |
| **Vercel** functions, **Blob**, **Neon** | Included on the free tiers (Hobby: 1 GB of Blob storage and 2,000 advanced operations a month; Neon: 0.5 GB) | A project uses about 7 Blob operations. Hobby blocks Blob for 30 days if its allowance is exceeded |
| **Email** (iCloud SMTP) | Nothing extra | |

## What the code allows (defaults; the variables are in `wvroofing.env.example`)

| Control | Default | Setting |
|---|---|---|
| Daily render budget, including renders still in flight | **$5 a day** | `WVR_DAILY_BUDGET_USD` |
| Budget held per render before it's sent (the most it could cost at 1536×1024, with a 25% margin) | about $0.13 | Worked out in `openai.js` |
| Renders per day | 200 in total, 40 per visitor, 12 per project | `WVR_DAILY_CAP`, `WVR_IP_DAILY`, `WVR_RENDERS_PER_PROJECT_DAILY` |
| Renders per minute sent to OpenAI | 5 (Tier 1) | `WVR_UPSTREAM_IPM` |
| Address lookups | 10 per project, 30 per visitor, 300 a day | `WVR_ADDRESS_LOOKUPS_*` |
| Satellite views | 20 per project, 60 per visitor, 300 a day | `WVR_MAP_VIEWS_*` |
| Photo uploads | 40 a day (protects the Hobby Blob allowance) | `WVR_DAILY_UPLOADS` |
| Enquiries | 5 per visitor an hour, 200 a day | `WVR_ENQUIRIES_*` |
| Everything paid | Off with `WVR_ENABLED=0` | Kill switch |

## Most the site could spend in a day at these defaults

| Service | Worst case |
|---|---|
| OpenAI | **$5.** The ledger refuses a render that would pass the budget. Also set a hard monthly budget on the OpenAI project itself |
| Ideal Postcodes | **£13.50** (300 × £0.045). For the concept phase, set a daily limit of about 50 lookups in Ideal Postcodes' dashboard (about £2.25 a day), or lower `WVR_ADDRESS_LOOKUPS_DAILY` |
| Google Static Maps | **$0.60** (300 × $0.002), and only once the 10,000 free loads a month are used up. Also set a daily quota and a budget alert in Google Cloud |

## Typical costs

- **Per customer project:**
  - one automatic render, plus one or two on request: about $0.10–$0.30;
  - one or two address lookups: about £0.04–£0.09;
  - two to four satellite views: about $0.
- **At 100 projects a month with 2 renders each:**
  - about $20 of OpenAI;
  - about £5 of lookups;
  - $0–5 for everything else.

## Before a commercial launch

- **Vercel Pro** at about $20 a month per seat. Hobby is for non-commercial use only. The SC Design
  functions on the same Vercel project are affected too.
- **Neon.** A paid Neon plan is only needed for more storage or history. The Free plan's 6-hour restore
  window is in `retention.md`.
