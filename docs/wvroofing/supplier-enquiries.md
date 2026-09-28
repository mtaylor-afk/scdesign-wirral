# WV Roofing: draft supplier enquiries (B4, 2026-09-28)

**For Matthew to send, if and when you want to pursue automatic roof measurement.** Nothing here has
been sent: Claude doesn't send messages on your behalf.

**Why these four.**

- **Bluesky, Getmapping and Vexcel** hold UK aerial imagery and height data. Their standard licences
  either forbid showing derived figures on a website, or say nothing about it.
- **Google's Solar API** has exactly the right roof data for Merseyside, but its terms limit it to energy
  systems.

Until one of them agrees in writing, automatic measurement stays off: the plan's decision D11 and the
`auto_measurement` capability.

**Before sending:**

- Add your name, phone and email.
- Say plainly that WV Roofing is a business being set up and isn't trading yet.
- Send each through the supplier's own contact route (listed below). These drafts don't guess email
  addresses.

---

## 1. Bluesky International

**Where:** the contact form on bluesky-world.com (or the GeoStream sales contact).

> **Subject: Licence to show roof measurements derived from your data to homeowners (Wirral and Liverpool)**
>
> Hello,
>
> I'm setting up a roofing business covering the Wirral and Liverpool (not yet trading). Our website lets
> a homeowner see new roof finishes on a photo of their house, and we'd like it to give them an
> indicative roof area and material estimate before a survey.
>
> Could you tell us:
>
> 1. whether you offer per-property roof data (roof facets with plan area, pitch and aspect, or a 3D
>    building model we could measure from) for postcodes CH41–CH49, CH60–CH64 and L1–L38;
> 2. whether a licence is available that allows (a) deriving roof areas and pitches from your data, and
>    (b) showing those derived figures to the property's owner on our website and in written quotations
>    (not the imagery itself);
> 3. how data is supplied (API per property, or an area extract), how current it is for these postcodes,
>    and what it would cost for around 100 properties a month;
> 4. any attribution or retention conditions.
>
> Your standard data licence appears to exclude display on the web and derived products for supply, which
> is why I'm asking about a bespoke licence.
>
> Thank you,
> [name], WV Roofing (in set-up), [phone], [email]

## 2. Getmapping

**Where:** the enquiry form on getmapping.co.uk.

> **Subject: Licence for roof measurements shown to homeowners online (Wirral and Liverpool)**
>
> Hello,
>
> I'm setting up a roofing business in the Wirral and Liverpool (not yet trading). We'd like our website
> to give homeowners an indicative roof area before a survey, measured from licensed aerial or height
> data.
>
> Could you let us know:
>
> 1. whether your imagery, surface models or building data can give per-property roof areas and pitches
>    for postcodes CH41–CH49, CH60–CH64 and L1–L38, and how recent it is there;
> 2. whether you can licence (a) deriving those measurements and (b) showing the derived figures, not
>    the imagery, to the property's owner on our website and in quotations. Your standard licence
>    appears to be for internal use only;
> 3. how it's delivered (per property or by area) and the likely cost for about 100 properties a month;
> 4. any attribution, retention or audit conditions.
>
> Many thanks,
> [name], WV Roofing (in set-up), [phone], [email]

## 3. Vexcel Data Program

**Where:** the contact form on vexceldata.com.

> **Subject: Roof measurements for homeowners in Liverpool and the Wirral: coverage and web-display terms**
>
> Hello,
>
> I'm setting up a roofing business covering Liverpool and the Wirral (not yet trading). Your coverage
> page lists Liverpool. We're looking for per-property roof data (facet areas and pitches, or a surface
> model to measure from) to give homeowners an indicative roof area on our website before a survey.
>
> Could you tell us:
>
> 1. whether your UK coverage includes the Wirral (CH41–CH49, CH60–CH64) as well as Liverpool
>    (L1–L38), and the capture dates;
> 2. whether your terms allow showing figures derived from your data, but not the imagery, to the
>    property's owner on a public website and in written quotations;
> 3. the pricing for a small business (roughly 100 properties a month) and how data is accessed (API);
> 4. any attribution or retention conditions.
>
> Thank you,
> [name], WV Roofing (in set-up), [phone], [email]

## 4. Google Maps Platform (Solar API)

**Where:** Google Maps Platform's "Contact sales" form, or the Google Cloud account team.

> **Subject: Solar API building insights for re-roofing estimates: permitted use?**
>
> Hello,
>
> I'm setting up a roofing business in the Wirral and Liverpool (not yet trading). The Solar API's
> building insights (roof segment pitch, azimuth and area) cover our area and would let us give
> homeowners an indicative roof area before a survey.
>
> The Maps Service Specific Terms (section 20.1) appear to limit Solar API use to solar and energy
> systems. Could Google confirm in writing whether using Solar API roof-segment data to prepare a
> re-roofing estimate for the property's owner is permitted, and on what conditions (including the
> 30-day caching limit and attribution)?
>
> Thank you,
> [name], WV Roofing (in set-up), [phone], [email]

---

## If a supplier says yes

1. **The permissions record.** Update the supplier's entry in `serverlib/wvroofing/permissions.js`:
   display and derivation "yes", with the written permission as a source and the date. Then regenerate
   the record with `node scripts/wvroofing/gen-docs.mjs`.
2. **The adapter.** Replace its stub in `serverlib/wvroofing/measure/adapters.js` with a real call.
   - Results go in as measurements with that source. They are always flagged `needs_review` until
     validated.
   - Record the source's date.
3. **The pilot.** Run it on 20–30 properties the roofer has measured independently. Agree the tolerances
   in writing first, then record coverage, failures, area error, bias and how often review was needed.
4. **Switching on.** Only then add an owner switch for `auto_measurement` and turn it on. It stays
   disabled in code until all of the above is done.
