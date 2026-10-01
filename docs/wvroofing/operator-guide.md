# WV Roofing: operator guide (v1, 2026-09-28)

This guide is for the roofer, or Matthew, using the operator screen. The screen shows every enquiry with
the customer's photo, renders and property details, and records everything done to them.

**Address:** `https://scdesignwirral.co.uk/WVROOFING/operator/`. It isn't linked from anywhere and search
engines are told not to index it, so bookmark it.

## Setting the password (Matthew, once)

1. On your own computer, in the repository folder, run:
   `node scripts/wvroofing/operator-hash.mjs`
2. Type the password twice. Nothing shows while you type.
   - It needs at least 12 characters; a few unrelated words work well.
   - It prints one line starting `scrypt:`. That line is a hash, not the password.
3. In Vercel, go to project **scdesign-wirral**, then **Settings**, then **Environment Variables**.
4. Set `WVR_OPERATOR_PASSWORD_HASH` to that line for **Production**, then **Redeploy**.

To change the password, do the same again. Everyone logged in with the old password is logged out.

Until a hash is set, the login says "The operator login isn't set up yet."

## Logging in

- **Session length.** You stay logged in for up to 12 hours, in that browser tab only. Closing the tab logs
  you out. **Log out** also ends the session on the server.
- **Lockout.** Five wrong passwords from one connection, or twenty from anywhere, within 15 minutes lock the
  login for 15 minutes. Even the right password waits.

## Enquiries

- **The list** shows the newest first, up to 200. The buttons at the top filter it by status.
- **Find** searches by name, email, phone (digits only; spaces don't matter), postcode, address or
  reference. Use it when someone asks to see or delete their data: it finds every enquiry from them.
- **"Check scope first"** means the customer's answers leave the roof's extent unclear. One of these applies:
  - the roof is shared (a semi or a terrace);
  - it's a flat;
  - the address has only a postcode-area location;
  - the pin wasn't confirmed;
  - the kind of property is unclear.
- **"Email failed" or "Email may not have arrived"** means the notification to the roofer may not have got
  through. The enquiry itself is always saved first.

## Inside an enquiry

**Status**

- The stages are New, Contacted, Survey requested, Quoted and Closed. Spam suspected is also available.
- Automatic email retries only happen while an enquiry is **New**.
- **Request a survey** marks the enquiry with today's date. It doesn't contact the customer; arrange the visit
  with them yourself.

**Send the email again**

- Sends the roofer's notification now, after you confirm.
- If the first one did arrive, it will arrive twice.
- Use it when the email failed or may not have arrived.

**Customer**

- Name, phone and email, which you can tap to call or write.
- Their roof choice and message.
- Whether they asked for their images to be attached to the email.

**Property**

- **Address.** Shows the address and where its location came from:
  - "Rooftop" means the property's own UPRN;
  - "Postcode area only" means no exact location;
  - "None" means the customer typed the address in.
- **Show the satellite view.** Loads the Google image of the address.
  - Each load is a paid call, so it only loads when you ask.
  - Look only. Google's terms don't allow measuring or tracing from it.
- **What was confirmed.** The kind of property and the pin answer, with the full history underneath.
- **Correct the scope.** Choose the right kind of property and say why. This adds a new record: the
  customer's answer stays in the history, and what they sent in their enquiry never changes.

**Photo and renders**

- Click the photo or a render to see it full size.
- **Get the original file** gives a download link that works for 5 minutes. Each download is recorded.
- Each photo-real render shows its state, what it cost, and a seam score. The seam score is how well the
  render's edges meet the photo; lower is better.

**Paid calls** lists what this project cost in outside services. These are estimates recorded at the time
of each call; the providers' own bills are the final word.

**What's been done** records every change made here, with what it was before.

## Measuring the roof

Each enquiry has a **Roof measurement** card. Customers see a roof's size only once you've measured it,
approved it and allowed it to be shown.

**Adding a measurement.** Open **Add a measurement** and fill in:

- **How it was measured:** a site survey, the property's drawings, plans or photos from the customer, a
  Hover report, or a desk estimate.
- **The date measured.**
- **Each roof face:** its plan area and pitch, or the area on the slope if your source gives it. An area on
  the slope is never adjusted again. Leave a value empty if you don't know it.
- **Faces not being re-roofed** (a garage, say): untick **In scope**.
- **Edge lengths** (ridge, hips, valleys, eaves, verges, abutments): only ones you've measured. They're
  never worked out from the areas.
- **For a Hover report:** choose **Hover report** and type in its summary, in metres or feet. Its total area
  (on the slope), its pitch (in degrees, or as "8/12") and its lengths are turned into the measurement.

**Checking it.** The card shows:

- the full-precision area, and the rounded figure the customer would see;
- anything flagged, for example a shared roof when you measured from drawings, a face with no pitch, or a
  source over 5 years old.

**Approving.** **Approve** once you've checked it. If it was flagged, you're asked to confirm.

**What the customer sees.**

- **Site surveys, drawings and customer plans** are shown to the customer as soon as you approve them.
  They see "About 98 m² of roof", who measured it from what and when, and the disclaimer.
- **Hover reports and desk estimates** stay hidden, because those sources' terms don't allow showing their
  figures to customers. The customer sees that the roof has been measured and the figures will come with
  the quotation.
- **Hide from the customer / Show to the customer** changes this later.

**Correcting it.** Add a new measurement. The old one is kept in **Earlier measurements**, and the new one
waits for your approval. If you correct the property's scope, the current measurement goes back for review
and is hidden until you approve it again.

**Rejecting it.** **Reject** removes it from the customer's view. It stays in the history.

**Quantities.** The card lists what each product for the customer's chosen roof would need.

- The figures come from the manufacturers' datasheets and are marked **Draft**.
- Customers never see draft figures. They see quantities only for products you've verified: check the
  datasheet, then set the product's specification to verified with your name and the date.

**Plans and drawings.** Files the customer added (plans, drawings, extra photos) are listed under **The
customer's plans and drawings**.

- **Open** gives a link that works for 5 minutes. Opening a file is recorded.
- When you measure from one, tick it in the form.

## Photos (both versions of the site)

Added 2026-10-01. Every photo a customer has added, on either site, newest first, whether or not they
sent an enquiry:

- **Version 1 · Visualiser**: photos uploaded in the Roof Visualiser (`/WVROOFING/visualiser/`).
- **Version 2 · Roof Cam**: photos added in the Roof Cam (`/WVROOFING/2/roof-cam/`), saved in the
  background while the customer finds their roof.

Filter by site, and by **With an enquiry** or **No enquiry yet**. Each card shows when the photo arrived,
the enquiry it led to (reference and name), how many previews it has, and how long it's kept.
**Show more** loads the next 48.

Open a card to see:

- the photo, full size (click it to open it in a new tab), and **Get the original file** (a 5-minute link);
  a photo turned into a JPEG on the customer's phone first (an iPhone HEIC, a WebP or a very large photo)
  says so;
- any **earlier photos** from the same session (a customer who changed photo);
- **Previews from the customer's device**: the roof they chose, drawn on their phone or computer and sent
  with their enquiry. They're approximate, not renders;
- photo-real renders, if there are any;
- the **enquiry**, with **Open the enquiry**, or a note that there isn't one (there are then no contact
  details: only the photo);
- **Delete this photo session**: the photos, previews, renders and anything else in the session. An
  enquiry and its contact details stay.

Photos without an enquiry are deleted automatically after 30 days; with an enquiry they're kept with it
for 12 months. The Enquiries tab can also be filtered by site, and each enquiry says which site it came
from.

## Renders to check

This tab lists photo-real renders from the last 30 days that **failed**, or that are **uncertain**.

- **Uncertain** means OpenAI didn't answer in time, so it may have charged for a render that never came back.
- Uncertain renders are never retried automatically.
- **Try again** makes a new render once you confirm, and it is charged again. A double click makes only one.
- Try again is refused if the customer has withdrawn their OK to use OpenAI, or has since changed their
  photo or roof outline.

## Costs

- **Today's render budget.** What photo-real renders have cost today, including renders in progress or
  uncertain, against the daily limit. At the limit, renders pause until midnight UTC.
- **The last 30 days.**
  - Enquiries, and how many were emailed.
  - Renders made, timed out (these may have been charged) or failed.
  - How many projects are held now.
  - Paid calls per service.
- **By month.** Paid calls per service for the last 12 months.
  - Figures are recorded at the time of each call, at the most it could cost.
  - The providers' own bills are the final word.
- **Daily tidy-up.** When it last ran and what it deleted.
  - It runs once a day and needs `CRON_SECRET`.
  - If it says it hasn't run for more than a day, check that variable in Vercel.

## Deleting

- **Delete the photo and project only.** Removes the photo, roof outline, renders, address and property
  answers. The enquiry and the contact details stay. Use this when a customer asks for their photo to be
  removed.
- **Delete the enquiry and its project.** Removes everything. Use this for a request to erase their data.
  - Emails the roofer has already received can't be recalled, so delete those from the inbox too.
  - The history keeps the reference and what was done, not the contact details.
- **Automatic deletion:**
  - projects with no enquiry after 30 days;
  - enquiries, with their projects, after 12 months;
  - the operator history after 12 months;
  - login records after 7 days.

## Not here yet

- **Verifying a product's specification** isn't on this screen yet. It's a change to
  `serverlib/wvroofing/products.json`.
- **Replying to customers** isn't on this screen; use their phone number or email.
- **Correcting contact details** isn't possible yet. Note the correction in your reply, or delete the
  enquiry and ask the customer to send it again.

## The local test environment

`node scripts/wvroofing/dev-server.mjs` serves the screen at `http://localhost:8772/WVROOFING/operator/`.

- Its login uses the throwaway `TEST_OPERATOR_PASSWORD` in `serverlib/wvroofing/auth.js`.
- That password is refused everywhere outside the test environment.
- Its enquiries, photos and emails are stand-ins that go nowhere.
