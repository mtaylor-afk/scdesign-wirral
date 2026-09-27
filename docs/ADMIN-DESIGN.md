# SC Design admin — layout and navigation

The design rules the admin panel follows, and why. Written when the panel was
reorganised from 17 flat destinations into 11 grouped ones (Sept 2026).

The reference is Apple's Human Interface Guidelines. Not its *look* — this panel
keeps the website's own warm paper, accent red, Playfair and Inter, and copying
macOS chrome on top of that would produce something that belongs nowhere. What is
borrowed is how Apple **structures** an app: what goes in a sidebar, how deep it
may go, what earns colour, and how hierarchy is expressed.

---

## 1. The rules, and what each one changed

| HIG guidance | What it meant here |
|---|---|
| "In general, show no more than two levels of hierarchy in a sidebar." | Group label + item. Nothing nests deeper. Where a third level was wanted, it became tabs inside the destination. |
| "Use succinct, descriptive labels to title each group… omit unnecessary words." | `WORK`, `AUDIENCE`, `RESULTS`, `SYSTEM`. Not "Website traffic" or "System diagnostics". |
| "Make sure any sidebar icon colors serve a clear purpose… used sparingly, fixed colors can help draw attention." (the Mail VIP example) | Every sidebar icon is monochrome. **The only colour in the sidebar is a badge**, and a badge only appears when something actually needs a person. |
| "Avoid putting critical information or actions at the bottom of a sidebar." | Only Log out sits at the bottom. Nothing you need to *notice* is down there — badges are on the items themselves, which is why they can be seen without scrolling. |
| "Avoid hiding the sidebar by default to ensure that it remains discoverable." | It is always visible on desktop. There is no collapse control, because at 12 items there is nothing to gain by hiding it. |
| "Order content by relative importance… place the most important items near the top." | Leads are first. Diagnostics are last. The landing page is Today, not a traffic chart. |
| "Group related items… use negative space, container shapes, or separator lines." | Grouping is done with space and a single hairline. No boxes inside boxes. |
| "Use progressive disclosure to make layouts cleaner." | Seven traffic reports became seven tabs behind one destination. |
| "Differentiate controls from content." | The toolbar is its own surface, pinned, with a hairline against the scrolling content beneath it. |
| "Adjust font weight, size, and color… to visualize hierarchy." | Four type roles, distinguished as much by weight and colour as by size. |
| macOS: default 13pt, minimum 10pt. "Avoid light font weights." | Body is 13px. Nothing is below 11px. No weight under 400. |

---

## 2. Information architecture

Before: **17 destinations in 7 groups**, nine of them under "Traffic".
After: **11 destinations in 4 groups**, with tabs inside the three heavy ones.

```
  Today                      ← the landing page: what needs a person today
  ─── WORK ───
  Enquiries        ⬤ 6       badge = leads not yet dealt with
  Projects
  ─── AUDIENCE ───
  Visitors                   Overview · Trends · Pages · Sources ·
                             Locations · Devices · Engagement
  Journeys                   Journeys · Path flow
  Live
  ─── RESULTS ───
  Conversions                Events · Visualiser
  ─── SYSTEM ───
  Health           ⬤         badge = something is misconfigured
  Errors           ⬤         badge = errors since you last downloaded
  Sign-ins
  Reference
```

Nothing was removed. Every one of the 17 old views is still reachable; seven of
them are now tabs.

### Why those groupings

They follow the **question being asked**, not the data's shape:

- **WORK** — things with a person on the other end waiting for something.
- **AUDIENCE** — who came and what they did.
- **RESULTS** — whether any of it worked.
- **SYSTEM** — whether the machine is healthy. Last, because on a good day you
  never open it.

### Why tabs, specifically

It is not only tidiness. Those seven Visitors reports **all render from one
fetch** (`state.data`, from a single `sc-admin-stats` call). As separate sidebar
items, every click threw that away and re-downloaded the whole event history.
As tabs they reuse it, so switching is instant.

**The trade, stated plainly:** the code used to guarantee "the admin can never
show a stale response". Tab switches now reuse a bundle that may be a minute old.
Refresh, the date range and the bots toggle still force a full refetch, and the
toolbar shows the real age of what you are looking at, so nothing is silently
stale — you can always see how old it is.

---

## 3. The visual system

### Spacing

One scale, 4px-based: `4 · 8 · 12 · 16 · 24 · 32 · 48`. Exposed as
`--s1`…`--s7`. Nothing should use an off-scale value without a reason at the line.

### Type

Four roles. Hierarchy comes from weight and colour as much as size, so the sizes
stay close together and the page keeps its density.

| Role | Token | Used for |
|---|---|---|
| Title | 22px Playfair 600 | the page title, and only that |
| Heading | 15px Inter 700 | card headings |
| Body | 13px Inter 400 | everything you actually read |
| Caption | 11.5px Inter 400, muted | supporting lines under a heading |
| Label | 11px Inter 600, uppercase, tracked | group labels, table headers |

Floor: **11px**. The old 9.5px chart labels went up to 10px — the platform
minimum — and nothing else goes near it.

### Colour

The accent red earns its place three ways and no others:

1. the selected sidebar item,
2. a badge that needs attention,
3. data marks in charts.

Everything else is ink, muted ink, and paper. A page where nothing is wrong should
have **no red on it at all** except the selection.

Status colours are semantic and used only in status roles: green `--success` for
working, amber for check, red `--danger` for broken.

### Surfaces

- **Sidebar** — dark ink, its own surface, always visible on desktop.
- **Toolbar** — paper, pinned to the top, hairline underneath, holds title +
  contextual controls + tabs. Controls live here; content never does.
- **Content** — cards on paper, 12px radius, hairline border, the existing
  shadow. Cards group; they do not nest.

### Icons

16×16, inline SVG, `stroke: currentColor`, 1.5 stroke, round caps and joins.
Drawn for this panel — SF Symbols is not licensed for the web and bitmaps would
not take the selection colour. They inherit colour from the row, which is what
keeps the sidebar monochrome by default.

---

## 4. The toolbar is contextual

The date range and "Show bots" used to render on all 17 views, including the ten
where they do nothing — and still triggered a full reload when touched.

Each destination now declares what it needs:

```js
{ id: "visitors", range: true, bots: true }   // controls shown
{ id: "enquiries" }                            // controls hidden
```

If a control cannot change what you are looking at, it is not on the screen.

---

## 5. Routing

Each destination and tab has an address: `#/visitors`, `#/visitors/pages`,
`#/enquiries`. Refresh keeps your place, Back steps between views, and a link can
be sent to someone.

Three things this had to get right:

1. **No double render.** `setView` writes the hash and the `hashchange` listener
   calls `setView`, so both ends compare against current state and stop early.
   Without it every click renders twice and fetches twice.
2. **`boot()` had to change.** It deliberately bypassed `renderView()` to avoid a
   double stats load, which meant it never fired the per-view loaders. A deep link
   to `#/enquiries` would have sat on "Loading…" for ever.
3. **Identifiers stay out of the hash.** `error-capture.js` sends the full URL
   with every client error, so anything in a route ends up in `sc_errors`.
   `#/enquiries` is fine; `#/enquiries/<customer>` would not be.

---

## 6. Things that must not be broken

Hard-won, and each one is load-bearing:

- **`STATS_VIEWS`** gates whether a fetched bundle is painted. Rename a view id
  without updating it and the fetch succeeds while the paint is skipped —
  a permanent "Loading…" with no error anywhere.
- **`clearRt()`** is the first line of `renderView()` and stops the 15-second Live
  poller. Any path that changes view without going through it leaks the timer,
  which then repaints over whatever you are looking at.
- **Row ids are page-relative indexes** (`enqd-0`, `errd-0`). Two expandable lists
  in one DOM would collide, so only one renders at a time.
- **`renderView()` deliberately preserves** `trendMetric`, `journeyFilter`,
  `flowPage`, `errBots`, `errParty`, `loginKind`, the three page numbers,
  `errOnlyNew`, and the download watermark. It resets the rest. Keep that split.
- **`loadStats()` doubles as the auth probe** — its 401 is how an expired session
  reaches the login screen.
- **`projects.js` owns its own DOM.** It keeps the open editor in a private `S`,
  mirrors drafts to `localStorage`, refuses to refetch over an open editor, and
  restores the caret and selection on repaint. The shell drives it only through
  `window.SCProjects` (`title/view/load/onClick/onChange/reset`) and must never
  re-render it from outside.
