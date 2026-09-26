# Projects CMS — how Sean publishes case studies himself

Sean signs in at **https://scdesignwirral.co.uk/admin/ → Content → Projects**,
writes a case study, uploads photos, and publishes. Each published project
becomes its own page at `/projects/<slug>/`, with its own title, meta
description, breadcrumbs and `Article` schema, and is linked automatically from
the matching service and area pages. He can also take a page back down, or
delete it outright.

This file is the operator's runbook: what it is, how to set it up, how to
verify it, and what to do when it breaks.

---

## 1. How it works

Two platforms are involved, and the split is the whole design:

```
Sean → /admin/ (Cloudflare, static)
         │  photos resized + EXIF/GPS stripped + house numbers redacted IN THE BROWSER
         ▼
     api/sc-admin-projects.js   (Vercel)  →  Supabase  — drafts + staged photos
         │
         │  Sean presses Publish
         ▼
     api/sc-admin-publish.js    (Vercel)  →  ONE commit on main via the GitHub API
                                              content/projects/<slug>.json
                                              public/work/cms/<slug>/*.jpg
         ▼
     Cloudflare Pages rebuilds:  npm run build
         ├─ prebuild: scripts/sync-cms-projects.mjs  (validate → generate TypeScript)
         └─ next build → out/  →  LIVE, fully prerendered
```

**Supabase is the workbench, not the website.** Drafts, staged photos and the
audit trail live there. Publishing commits the content into the git repo, and
the static build reads *those files*. The live site never queries Supabase for
project content — that is what keeps every case study prerendered and indexable,
which is the entire point of this site.

**So publishing is not instant.** Commit → Cloudflare build → live takes roughly
one to three minutes. The admin says the site is rebuilding rather than claiming
the page is already up. That delay is the price of the SEO, and it is worth it:
fetching projects in the browser instead would make every new case study
invisible to Google.

### Why the content is committed as JSON, never as TypeScript

The admin commits inert `content/projects/<slug>.json`. Content typed by a
person must never be written straight into a `.ts` file that the build then
executes — that would be a code-injection path into the deploy. The prebuild
step re-validates every file with zod and *generates* the TypeScript. Malformed
or hostile content fails the build instead of shipping, and Cloudflare keeps the
previous good deploy live.

---

## 2. One-time setup

Nothing works until all four are done.

### 2.1 Confirm the existing Vercel env vars

In the **`scdesign-wirral`** Vercel project, confirm these are set:

- `SC_SUPABASE_URL`
- `SC_SUPABASE_SERVICE_ROLE_KEY`
- `SC_ADMIN_SESSION_SECRET`
- `SC_ADMIN_USER` / `SC_ADMIN_PASS`

Do this **first**. These already gate the analytics, enquiries and error-log
views, and whether they are set in production has never actually been verified.
If any is missing, the existing admin is already partly broken and this feature
cannot work either.

> The admin becomes **write-capable** with this feature. Until now a guessed
> password leaked analytics; from here it can publish to and delete from the
> live site. Set a strong `SC_ADMIN_PASS`. The damage is bounded — the path
> allow-list confines writes to project content and every change is a revertable
> commit — but it is no longer a read-only console.

### 2.2 Create the Supabase tables

Run [`db/sc_projects.sql`](../db/sc_projects.sql) **once**, by hand, in the
`sc-analytics` Supabase SQL editor (project ref `yxapzkiodjecladjziom`). Same
one-time manual step `sc_errors` needed. It creates:

- `public.sc_projects` — one row per case study (drafts and published)
- `public.sc_project_events` — the audit trail
- the private `project-media` storage bucket

### 2.3 Create the GitHub token

A **fine-grained** personal access token:

- Resource owner: `mtaylor-afk`, **only** the `scdesign-wirral` repository
- Permissions: **Contents → Read and write**, nothing else
- Set an expiry you are willing to diary

Set in the `scdesign-wirral` Vercel project:

```
SC_GITHUB_TOKEN=github_pat_…
SC_GITHUB_REPO=mtaylor-afk/scdesign-wirral
SC_GITHUB_BRANCH=main
```

> ⚠ **Fine-grained PATs expire — one year maximum.** When it lapses, publishing
> stops with "the publishing token is invalid or has expired" and Sean cannot
> update the site until it is replaced. The admin surfaces the expiry date when
> GitHub reports one. A GitHub App installation token does not expire and is the
> better long-term answer if this becomes load-bearing.
>
> The token must **never** be committed. This repo is public: a committed token
> is published and auto-revoked. `.gitignore` covers the local helper files.

### 2.4 Confirm Cloudflare Pages rebuilds on push

The publish button only works if a commit to `main` triggers a Pages build.
Confirm the Pages project is **git-connected** to the repo and runs
`npm run build`. A commit pushed through the GitHub API fires the push webhook
exactly like a normal push, so a connected project will build — but a
direct-upload project will not, and publishing would then commit successfully
while the page never appears.

Also confirm **Vercel Deployment Protection stays off**, or the admin cannot
reach its own API.

---

## 3. What Sean can and cannot do

**Can:** create, edit, reorder, publish, unpublish and delete project case
studies; upload, caption, reorder and redact photos; set the stage (Completed /
Under construction / In planning / Concept design); choose which services and
areas each project links to; write its SEO title and description.

**Cannot, by design:** create arbitrary new page types. Service, guide and area
pages stay in code — their bespoke layout, FAQs, schema and internal linking are
what make them rank, and a generic page builder would produce thin pages that
dilute the site.

### The rules the form enforces

These are not new inventions; each encodes a rule this site already had. They
are checked when Sean saves **and again at build time**, so they hold even if
the admin is bypassed.

| Rule | Why |
|---|---|
| No bare "architect" / "architects" | Protected title — Sean is a Chartered Architectural Technologist. "architectural design/designer" is fine. |
| No street names (a capitalised word + Road/Drive/Close/…) | General area only, never a street address. Ordinary prose like "the drive was resurfaced" is unaffected. |
| Alt text on every image | The site has zero missing alt text across 500+ images and must not regress. |
| A design visualisation may not be described as completed or built | A render is never presented as a finished building. |
| A "Completed" project may not lead with a render | Same rule, on the hub card. |
| Exactly one cover image | — |
| Nothing resembling a planning reference | Never invent planning references. |
| Homeowner permission ticked before publishing | These are real people's homes. |

The checks catch **wording, not truth.** They cannot verify that a homeowner
really consented or that a claim is accurate. The tick records the assertion; it
does not prove it.

---

## 4. Photos

Photos are prepared **in the browser** before upload, which matters for three
reasons:

1. **Privacy.** Re-encoding through a canvas discards every metadata block,
   including the GPS coordinates a phone writes into a photo of someone's house.
   Those coordinates never leave Sean's machine.
2. **Size.** A phone photo is 3–12 MB; the upload limit is well under that.
   Resizing to 1600px first turns it into roughly 300 KB.
3. **Redaction.** Sean drags a box over a house number and it is destroyed
   *before* upload — so the unredacted version is never stored at all.

Redaction resolves the boxed region to at most four cells on its longer edge and
scales back up with nearest-neighbour, so a house number becomes flat blocks
rather than a soft blur. This is deliberate: a gaussian blur can be partially
inverted, and an earlier version that merely blurred left a two-digit number
plainly readable. "White out" paints the box solid instead.

**There is no automatic detection.** Sean must draw the box himself. The form
shows a reminder.

HEIC files (iPhone "High Efficiency") cannot be decoded by Windows browsers. The
form says so and tells him to set the camera to "Most Compatible" or share the
photo so it converts to JPEG.

---

## 5. Removing a page

**Unpublish** takes the page off the site but keeps the draft and the staged
photos, so Sean can fix something and republish.

**Delete** removes it entirely — the committed files, the database row and the
staged photos.

Both add the slug to `content/removed-projects.json`, and the build turns that
into a **301 redirect** from the old address to `/projects/`. Without it the old
URL would 404 for anyone holding a link and for anything Google indexed.

That tombstone file is the only reason the admin can write outside
`content/projects/` and `public/work/cms/`. The trusted build script is the
**only** thing that touches `public/_redirects` — keeping site-wide routing out
of the publish allow-list means a compromised admin password cannot rewrite
where the site's URLs point.

**Nothing is truly unrecoverable.** Every change is a commit, so
`git revert <sha>` restores a deleted project, files and all.

---

## 6. Verifying it works

After setup, with a throwaway project rather than real work:

1. Sign in, create a draft, save it. → row appears in `sc_projects`, nothing on the live site.
2. Upload a photo. → object appears in the `project-media` bucket, thumbnail renders.
3. Try to publish with the permission box unticked. → refused, with the reason shown.
4. Type a street name into the brief. → refused, naming the matched text.
5. Publish. → one commit on `main` touching only `content/projects/…` and `public/work/cms/…`; Cloudflare build starts; page live in 1–3 minutes with the right title, description and sitemap entry.
6. Unpublish. → page gone, old URL 301s to `/projects/`.
7. Delete. → row, storage objects and committed files all gone.
8. `git revert` the publish commit. → project returns.

---

## 7. When it breaks

| Symptom | Cause | Fix |
|---|---|---|
| "Supabase not configured." | `SC_SUPABASE_URL` / `SC_SUPABASE_SERVICE_ROLE_KEY` missing in Vercel | §2.1 |
| Everything 502s on the Projects tab | Tables not created | §2.2 |
| "Publishing is not configured" | `SC_GITHUB_TOKEN` missing | §2.3 |
| "The publishing token is invalid or has expired" | PAT lapsed or revoked | New PAT, §2.3 |
| "The token is missing the Contents: Read and write permission" | Wrong scope | Re-issue with Contents write |
| A GitHub 404 | **A permissions problem, not a missing repo.** GitHub returns 404 for resources a token cannot see | Check the token's repository selection and resource owner |
| Commit lands but the page never appears | Cloudflare not git-connected, or its build failed | §2.4, then the Pages build log |
| **The whole site stops updating** | The prebuild validator is failing | Run `node scripts/sync-cms-projects.mjs` locally — it names the offending file and rule |
| Signed out mid-edit | Session is 12 hours with no renewal | Sign in again; the editor keeps a local draft |

The **audit trail** is the first place to look when a page appears or disappears
unexpectedly: `sc_project_events` records every publish, unpublish and delete
attempt — including refusals and failures — with the commit SHA, the reason and
a cookieless identifier.

---

## 8. Limits worth knowing

- **Publishing takes 1–3 minutes.** Inherent to a static site; it is what buys the SEO.
- **No byte-exact preview** without a build. Save as a draft, publish when happy.
- **Roughly 40 photos per project**, bounded by the 30-second function limit. Larger projects are refused with a clear message rather than timing out mid-commit.
- **Cloudflare Pages free tier is 500 builds/month** — about 16 publishes a day.
- **Supabase free tier**: 1 GB storage, 500 MB database. Staged photos are disposable once published.
- **The repo grows** by roughly 1 MB per project, permanently in git history.
- **Cost: £0** on the current Vercel Hobby / Cloudflare Pages / Supabase free tiers.

## 9. The files

| Path | What it is |
|---|---|
| `public/admin/projects.js` | The whole admin section |
| `public/admin/image-prep.js` | Browser-side resize, EXIF strip, redaction |
| `api/sc-admin-projects.js` | List, get, save, upload, delete-media, reorder |
| `api/sc-admin-publish.js` | Publish, unpublish, delete — the only code that changes the live site |
| `serverlib/cms.js` | Schema, content rules, path allow-list |
| `serverlib/cms-vocab.js` | Service/area/stage vocabularies |
| `serverlib/github.js` | Atomic multi-file commit client |
| `serverlib/common.js` | Supabase + Storage helpers (`sb*`) |
| `scripts/sync-cms-projects.mjs` | Prebuild: validate → generate TypeScript → redirects |
| `content/projects/` | The committed case studies ([format](../content/projects/README.md)) |
| `db/sc_projects.sql` | Canonical schema record |
