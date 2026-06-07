# Extension Concept Visualiser — standalone demo (zero infrastructure)

`extension-visualiser.html` is a **single self-contained file**. No build, no server,
no API keys, no Supabase, no database. It runs entirely in the browser and the
photo never leaves the device.

## How to use it on a phone
1. Open `extension-visualiser.html` in any mobile browser, **or** tap **Use sample house**.
2. (Optional) Tap the photo box to **take or choose a photo** of the back/side of a house.
3. Pick an **extension style** + **position**, then tap **Create before & after**.
4. Drag the slider to compare **before ↔ after**, and **Download the after image**.

Once this branch is published via GitHub Pages, it is also reachable at:
`https://tailoredquote.co.uk/sc/demo/extension-visualiser.html`

## What it is / isn't
- It is an **illustrative concept overlay** drawn with the HTML canvas — a tasteful
  glazed/rendered/brick extension composited onto the photo, with a warm grade and
  a watermark ("Concept visualisation by SC Design & Construction · powered by TailoredQuote").
- It is **not** a photoreal AI render, an architectural drawing, or planning advice.
  (Real AI generation needs the Gemini-backed `/visualiser` route in the main app,
  which requires API keys + Supabase — deliberately not needed here.)

## Sample output (pre-rendered, no input required)
- `sample-before.png` — a house, before
- `sample-after.png` — the same house with a modern glazed extension concept
- `sample-before-after.png` — the two side by side
