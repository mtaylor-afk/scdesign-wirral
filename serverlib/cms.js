/**
 * SC Design Wirral — projects CMS: schema, content rules and the publish
 * path allow-list.
 *
 * ONE source of truth, deliberately. The same checks run in two places:
 *   1. api/sc-admin-projects.js  — so Sean sees the problem while he is typing.
 *   2. scripts/sync-cms-projects.mjs (prebuild) — so the rules still hold even
 *      if the admin is bypassed, and hostile or malformed content fails the
 *      BUILD rather than reaching the live site.
 *
 * Plain CJS (`require`-able by the Vercel functions, `import`-able by the ESM
 * build script). Only dependency is zod, already in package.json.
 *
 * The rules below are not arbitrary — each one encodes a written site rule that
 * predates this CMS. See the `rule` field on every check for where it comes from.
 */

const { z } = require("zod");
const {
  SERVICE_SLUGS,
  AREA_SLUGS,
  STAGES,
  IMAGE_KINDS,
  RESERVED_SLUGS,
} = require("./cms-vocab");

/* ------------------------------------------------------------------ *
 * Schema                                                              *
 * ------------------------------------------------------------------ */

const slug = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lower-case words separated by single hyphens");

/**
 * An image as the CMS stores it. Note there is no width/height: the build reads
 * the real dimensions off the committed file with sharp rather than trusting a
 * number in the JSON, which both guarantees the explicit width/height the site
 * needs (images.unoptimized) and catches a truncated or swapped file.
 */
const imageSchema = z
  .object({
    file: z
      .string()
      .regex(
        /^[a-z0-9][a-z0-9-]*\.(jpg|png)$/,
        "a safe lower-case filename ending .jpg or .png, no directories"
      ),
    kind: z.enum(IMAGE_KINDS),
    // Alt text is mandatory. The site currently has zero missing alt across 518
    // images and that must not regress the moment Sean starts uploading.
    alt: z.string().min(10).max(300),
    caption: z.string().max(300).optional(),
    cover: z.boolean().optional(),
  })
  .strict();

const beforeAfterSchema = z
  .object({
    label: z.string().min(3).max(120),
    before: z.string().optional(),
    drawing: z.string().optional(),
    after: z.string(),
    /** Same viewpoint → the drag-to-compare slider is meaningful. Sean's call. */
    aligned: z.boolean().optional(),
  })
  .strict();

const projectSchema = z
  .object({
    slug,
    title: z.string().min(8).max(120),
    town: z.string().min(2).max(60),
    propertyType: z.string().min(3).max(80),
    projectType: z.string().min(3).max(80),
    stage: z.enum(STAGES),
    status: z.enum(["draft", "published"]),
    summary: z.string().min(20).max(400),
    brief: z.string().min(20).max(2000),
    challenge: z.string().max(2000).optional(),
    designResponse: z.string().max(4000).optional(),
    planningRoute: z.string().max(2000).optional(),
    buildingRegsRoute: z.string().max(2000).optional(),
    outcome: z.string().max(2000).optional(),
    drawings: z.array(z.string().min(3).max(200)).max(40).default([]),
    homeownerPermissionConfirmed: z.boolean(),
    relatedServices: z.array(z.enum(SERVICE_SLUGS)).max(6).default([]),
    relatedAreas: z.array(z.enum(AREA_SLUGS)).max(6).default([]),
    seoTitle: z.string().max(70).optional(),
    metaDescription: z.string().max(160).optional(),
    /** Month + year the copy was last checked, e.g. "September 2026". */
    reviewed: z.string().regex(/^[A-Z][a-z]+ 20\d{2}$/, 'e.g. "September 2026"'),
    images: z.array(imageSchema).min(1).max(40),
    beforeAfter: beforeAfterSchema.optional(),
  })
  .strict();

/* ------------------------------------------------------------------ *
 * Content rules                                                       *
 * ------------------------------------------------------------------ */

/**
 * The bare title is protected — Sean is a chartered architectural technologist,
 * not a registered architect, and "architect"/"architects" alone is a statement
 * the business must not make. "architectural" and "architecture" are fine, so the
 * pattern is anchored with \b on both sides.
 */
const BARE_ARCHITECT = /\barchitects?\b/i;

/**
 * A real street name, not the ordinary word. Matching "drive" or "close" on its
 * own would reject legitimate copy ("the drive was resurfaced"), so this looks
 * for the shape of an address: a capitalised word followed by a capitalised
 * street suffix — "Grove Road", "Warren Drive", "Sea Bank Road".
 */
const STREET_NAME =
  /\b[A-Z][a-z]+\s+(Road|Street|Avenue|Drive|Close|Lane|Crescent|Terrace|Place|Court|Gardens|Parade)\b/;

/** An invented planning reference is worse than none. */
const PLANNING_REF = /\b(?:APP|DC|OUT|FUL|LBC|HHA)\s*\/\s*\d|\b\d{2}\/\d{4,5}\b/i;

/** Words that would present a design visualisation as a finished building. */
const BUILT_CLAIM = /\b(completed|complete|finished|as[- ]built|newly built|built)\b/i;

/** Fields whose prose is checked for the wording rules. */
const PROSE_FIELDS = [
  "title",
  "town",
  "propertyType",
  "projectType",
  "summary",
  "brief",
  "challenge",
  "designResponse",
  "planningRoute",
  "buildingRegsRoute",
  "outcome",
  "seoTitle",
  "metaDescription",
];

/**
 * Apply the content rules to an already-schema-valid project.
 * Returns `[{ field, rule, message }]` — empty means it may publish.
 */
function lintProject(p) {
  const problems = [];
  const fail = (field, rule, message) => problems.push({ field, rule, message });

  // A slug already used by a hand-authored case study is a BUILD-BREAKING
  // collision, not a cosmetic clash: sync-cms-projects.mjs treats a slug living
  // in both places as a hard error, so publishing one would make every
  // subsequent Cloudflare build fail and freeze the whole website. Caught here
  // it is just a sentence in the form, so this runs on save as well as publish.
  if (RESERVED_SLUGS.includes(p.slug))
    fail(
      "slug",
      "slug-taken",
      `There is already a case study at /projects/${p.slug}/. Choose a different web address — try adding the town or the type of work.`
    );

  const texts = [];
  for (const f of PROSE_FIELDS) if (typeof p[f] === "string" && p[f]) texts.push([f, p[f]]);
  for (const [i, d] of (p.drawings || []).entries()) texts.push([`drawings[${i}]`, d]);
  for (const [i, img] of (p.images || []).entries()) {
    texts.push([`images[${i}].alt`, img.alt]);
    if (img.caption) texts.push([`images[${i}].caption`, img.caption]);
  }
  if (p.beforeAfter) texts.push(["beforeAfter.label", p.beforeAfter.label]);

  for (const [field, text] of texts) {
    if (BARE_ARCHITECT.test(text))
      fail(
        field,
        "protected-title",
        'Remove the word "architect" — write "architectural designer" or "architectural design".'
      );
    if (STREET_NAME.test(text))
      fail(
        field,
        "general-area-only",
        `Looks like a street name ("${text.match(STREET_NAME)[0]}"). Use the town or general area only.`
      );
    if (PLANNING_REF.test(text))
      fail(
        field,
        "no-invented-refs",
        `Looks like a planning reference ("${text.match(PLANNING_REF)[0]}"). Leave planning references out.`
      );
  }

  // A render must never read as a photograph of a finished building.
  for (const [i, img] of (p.images || []).entries()) {
    if (img.kind !== "render") continue;
    for (const key of ["alt", "caption"]) {
      const v = img[key];
      if (v && BUILT_CLAIM.test(v))
        fail(
          `images[${i}].${key}`,
          "render-not-a-build",
          `This image is a design visualisation but the text says "${v.match(BUILT_CLAIM)[0]}". Describe the proposed design, not a finished build.`
        );
    }
  }

  // Exactly one cover, and it must be one of this project's own images.
  const covers = (p.images || []).filter((i) => i.cover);
  if (covers.length !== 1)
    fail("images", "one-cover", `Pick exactly one cover image (currently ${covers.length}).`);

  // A completed project led by a render is misleading on the hub card.
  if (p.stage === "completed" && covers[0] && covers[0].kind === "render")
    fail(
      "images",
      "render-not-a-build",
      'A "Completed" project should not lead with a design visualisation — choose a photograph as the cover, or set the stage to match.'
    );

  // Before/after must reference real files in this project.
  if (p.beforeAfter) {
    const names = new Set((p.images || []).map((i) => i.file));
    for (const key of ["before", "drawing", "after"]) {
      const v = p.beforeAfter[key];
      if (v && !names.has(v))
        fail(`beforeAfter.${key}`, "missing-image", `"${v}" is not one of this project's images.`);
    }
  }

  // Publishing asserts the homeowner agreed. Drafts may sit without it.
  if (p.status === "published" && !p.homeownerPermissionConfirmed)
    fail(
      "homeownerPermissionConfirmed",
      "homeowner-permission",
      "Confirm the homeowner has agreed to their project appearing on the website before publishing."
    );

  return problems;
}

/** Schema + content rules in one call. */
function validateProject(input) {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((i) => ({
        // Bracket notation for array indexes — `images[0].alt`, not zod's
        // default `images.0.alt`. lintProject already emits the bracket form and
        // the admin parses that shape to highlight the offending field, so a
        // dotted index silently lost both the label and the highlight and Sean
        // saw an unattached error message.
        field:
          i.path.reduce(
            (acc, seg) =>
              typeof seg === "number" ? `${acc}[${seg}]` : acc ? `${acc}.${seg}` : String(seg),
            ""
          ) || "(root)",
        rule: "schema",
        message: i.message,
      })),
    };
  }
  const problems = lintProject(parsed.data);
  return problems.length ? { ok: false, problems, project: parsed.data } : { ok: true, project: parsed.data };
}

/* ------------------------------------------------------------------ *
 * Publish path allow-list                                             *
 * ------------------------------------------------------------------ */

/**
 * The publish function commits to the live deploy branch, so the set of paths it
 * may touch is closed rather than filtered. A compromised admin password must
 * not be able to write source, config or workflow files — only project content.
 */
const ALLOWED_PATHS = [
  /^content\/projects\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/,
  /^public\/work\/cms\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9][a-z0-9-]*\.(?:jpg|png)$/,
  /**
   * ONE fixed filename, matched literally end to end — not a `content/.*\.json`
   * pattern. Deleting or unpublishing a case study takes its page out of the
   * build, so the URL would start 404ing; this tombstone file records the slug
   * and `scripts/sync-cms-projects.mjs` turns it into a 301 to the hub. The
   * admin writes ONLY this inert list of slugs.
   *
   * What stays deliberately outside the allow-list, and why:
   *   - public/_redirects   site-wide routing. The trusted build script is the
   *                         only thing that writes it, so a compromised admin
   *                         password cannot point the site's URLs anywhere.
   *   - src/**              executed at build time — a write here is code
   *                         injection into the deploy, not content.
   *   - package.json        dependencies and scripts; same reasoning.
   *   - .github/**          CI workflows run with repo credentials.
   */
  /^content\/removed-projects\.json$/,
];

function isAllowedPath(p) {
  if (typeof p !== "string" || !p) return false;
  // Reject anything that could escape or resolve differently: traversal,
  // absolute paths, backslashes, doubled or trailing separators, NUL.
  if (p.includes("..") || p.includes("\\") || p.includes("//") || p.includes("\0")) return false;
  if (p.startsWith("/") || p.startsWith(".")) return false;
  return ALLOWED_PATHS.some((re) => re.test(p));
}

/** Throws on the first path outside the allow-list. Call before any GitHub write. */
function assertAllowedPaths(paths) {
  for (const p of paths) {
    if (!isAllowedPath(p)) {
      const err = new Error(`path not permitted: ${String(p).slice(0, 120)}`);
      err.code = "path_not_permitted";
      throw err;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Repo paths                                                          *
 *                                                                     *
 * Build every committed path through these rather than by concatenating *
 * strings at the call site, so the allow-list above and the paths the   *
 * publish function actually writes cannot drift apart: each builder     *
 * validates its inputs against the same schema the content uses, then   *
 * re-checks its own output with isAllowedPath.                          *
 * ------------------------------------------------------------------ */

/** The tombstone file. See the third ALLOWED_PATHS entry for what it is for. */
const REMOVED_PROJECTS_PATH = "content/removed-projects.json";

function pathError(message) {
  const err = new Error(message);
  err.code = "path_not_permitted";
  return err;
}

/** Validate against a zod piece, or throw a path_not_permitted error. */
function checked(schema, value, what) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw pathError(`${what}: ${String(value).slice(0, 120)}`);
  return parsed.data;
}

/** `content/projects/<slug>.json` — throws on anything that is not a slug. */
function contentPathFor(slugValue) {
  const s = checked(slug, slugValue, "not a valid project slug");
  const p = `content/projects/${s}.json`;
  if (!isAllowedPath(p)) throw pathError(`path not permitted: ${p}`);
  return p;
}

/**
 * `public/work/cms/<slug>/<file>` — throws on anything that is not a slug plus a
 * bare image filename. `file` is checked against the very field of imageSchema
 * that the content JSON is validated with, so the two can never disagree.
 */
function mediaPathFor(slugValue, file) {
  const s = checked(slug, slugValue, "not a valid project slug");
  const f = checked(imageSchema.shape.file, file, "not a valid image filename");
  const p = `public/work/cms/${s}/${f}`;
  if (!isAllowedPath(p)) throw pathError(`path not permitted: ${p}`);
  return p;
}

/* ------------------------------------------------------------------ *
 * Tombstone file contents                                             *
 * ------------------------------------------------------------------ */

/** Plenty for a lifetime of a one-man practice's removals; stops a runaway file. */
const MAX_REMOVED_SLUGS = 500;

/**
 * `{ "slugs": ["…"] }` and nothing else. Output is deduped and sorted so the
 * committed file has a stable, reviewable diff.
 */
const removedSlugsSchema = z
  .object({ slugs: z.array(slug).max(MAX_REMOVED_SLUGS) })
  .strict()
  .transform((v) => ({ slugs: [...new Set(v.slugs)].sort() }));

/**
 * Read the existing tombstone file defensively.
 *
 * The publish endpoint reads this file, adds or removes one slug and writes it
 * back, so whatever is already there must not be propagated on trust — every
 * entry becomes a line in a routing config. Anything that is not a valid slug is
 * dropped rather than thrown on: a malformed or hostile file must not be able to
 * wedge Sean out of deleting a project, and the rewrite then heals it. Returns
 * the entries that were discarded so the caller can log them.
 *
 * @param {unknown} raw parsed JSON, or null/undefined when the file is absent.
 * @returns {{ slugs: string[], dropped: string[] }}
 */
function parseRemovedSlugs(raw) {
  const strict = removedSlugsSchema.safeParse(raw);
  if (strict.success) return { slugs: strict.data.slugs, dropped: [] };

  const candidates = raw && typeof raw === "object" && Array.isArray(raw.slugs) ? raw.slugs : [];
  const kept = [];
  const dropped = [];
  for (const s of candidates) {
    if (slug.safeParse(s).success) kept.push(s);
    else dropped.push(String(s).slice(0, 60));
  }
  return { slugs: [...new Set(kept)].sort().slice(0, MAX_REMOVED_SLUGS), dropped };
}

/* ------------------------------------------------------------------ *
 * Uploads                                                             *
 * ------------------------------------------------------------------ */

/** Max bytes for one prepared image. The browser resizes to 1600px/q82 first. */
const MAX_IMAGE_BYTES = 1_200_000;

/**
 * Identify a real JPEG or PNG from its leading bytes. The browser is supposed to
 * hand us a canvas-encoded JPEG, but the server must not take its word for it.
 */
function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return "png";
  return null;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

module.exports = {
  projectSchema,
  imageSchema,
  validateProject,
  lintProject,
  isAllowedPath,
  assertAllowedPaths,
  ALLOWED_PATHS,
  contentPathFor,
  mediaPathFor,
  REMOVED_PROJECTS_PATH,
  removedSlugsSchema,
  parseRemovedSlugs,
  MAX_REMOVED_SLUGS,
  MAX_IMAGE_BYTES,
  sniffImage,
  slugify,
  SERVICE_SLUGS,
  AREA_SLUGS,
  STAGES,
  IMAGE_KINDS,
  RESERVED_SLUGS,
};
