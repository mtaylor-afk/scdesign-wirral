# content/projects — case studies Sean publishes himself

One `<slug>.json` per case study, written here by the admin portal
(`/admin/` → Content → Projects), never by hand in normal use. Its images sit in
`public/work/cms/<slug>/`.

`scripts/sync-cms-projects.mjs` turns this folder into `src/lib/projects-cms.ts`,
which `src/lib/projects.ts` spreads in ahead of the hand-authored case studies.
It runs automatically as npm `prebuild`, so `npm run build` always regenerates
from whatever is here. Run it on its own with `npm run cms:sync`.

## Why JSON and not TypeScript

The admin commits **inert data**. Content typed by a person must never be written
straight into a `.ts` file that the build then executes — that would be a code
injection path into the deploy. Everything here is re-validated at build time
against the schema and content rules in `serverlib/cms.js`, so malformed or
hostile content fails the build and Cloudflare keeps the last good deploy live.

The same `serverlib/cms.js` runs in `api/sc-admin-projects.js` when Sean saves,
so he sees a problem while typing rather than after publishing. One set of rules,
enforced twice.

## What is checked

Schema: field types and lengths, `slug` format, `stage` and image `kind` from a
fixed list, `relatedServices` / `relatedAreas` restricted to slugs that really
exist, and no unexpected fields.

Content rules, each one an existing site rule rather than a new invention:

| Rule | Why |
|---|---|
| No bare "architect" / "architects" | Protected title — Sean is a Chartered Architectural Technologist. "architectural design/designer" is fine. |
| No street names (a capitalised word + Road/Drive/Close/…) | General area only, never a street address. The pattern needs the capitalised pair, so ordinary prose like "the drive was resurfaced" is fine. |
| Alt text on every image | The site has zero missing alt text across 500+ images and must not regress. |
| A `render` may not be described as completed/finished/built | A design visualisation is never presented as a finished building. |
| A `completed` project may not lead with a `render` cover | Same reason, on the hub card. |
| Exactly one cover image | — |
| `beforeAfter` must reference this project's own images | — |
| Nothing resembling a planning reference | Never invent planning references. |
| `homeownerPermissionConfirmed` must be true to publish | Real homes; the homeowner has to have agreed. |

Image dimensions are **measured from the committed file with sharp**, not taken
from the JSON — that guarantees the explicit width/height the site needs
(`images.unoptimized`) and catches a truncated or swapped file. Images must be
1600px or smaller, JPEG or PNG, and every file in the folder must be referenced
(an orphan stays publicly reachable while nothing on the site reviews it).

## Fields

`slug` `title` `town` `propertyType` `projectType` `stage` `status` `summary`
`brief` `reviewed` `homeownerPermissionConfirmed` `images` are required.
`challenge` `designResponse` `planningRoute` `buildingRegsRoute` `outcome`
`drawings` `relatedServices` `relatedAreas` `seoTitle` `metaDescription`
`beforeAfter` are optional.

`stage` is `completed` | `under-construction` | `in-planning` | `concept`.
`status` is `draft` | `published` — a draft is kept out of `publishedProjects`,
so it is not rendered, not in the sitemap and not linked anywhere.

Each entry in `images` is `{ file, kind, alt, caption?, cover? }` where `file` is
a bare lower-case `.jpg`/`.png` filename inside `public/work/cms/<slug>/` and
`kind` is `photo` | `drawing` | `render`.

`beforeAfter` is `{ label, before?, drawing?, after, aligned? }`, referencing
images by filename. Set `aligned: true` only when the two shots share a
viewpoint — that is what turns on the drag-to-compare slider, and mismatched
viewpoints look broken under the handle. It is a human judgement, so the admin
asks rather than guessing.

## Testing the pipeline

There is no fixture committed here on purpose — a placeholder case study would be
one push away from the live site. To exercise the path, write a temporary
`<slug>.json` with a matching `public/work/cms/<slug>/` folder, run
`npm run cms:sync`, then delete both.
