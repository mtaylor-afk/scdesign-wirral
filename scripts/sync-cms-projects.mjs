#!/usr/bin/env node
/**
 * Generate src/lib/projects-cms.ts from the committed CMS content.
 *
 *   node scripts/sync-cms-projects.mjs        (runs automatically as npm "prebuild")
 *
 * Reads every content/projects/<slug>.json, validates it against the shared
 * schema and content rules in serverlib/cms.js, measures the real dimensions of
 * each committed image with sharp, and writes a typed TypeScript module that
 * src/lib/projects.ts spreads in alongside the hand-authored case studies.
 *
 * WHY A GENERATOR, AND WHY JSON: the admin publishes inert JSON, never
 * TypeScript. Content typed by a person must not be written into a .ts file that
 * the build then executes — that would be a code-injection path straight into
 * the deploy. Everything here re-validates that JSON, so malformed or hostile
 * content fails the BUILD instead of reaching the live site. Same reason the
 * checks are shared with the API rather than reimplemented: one set of rules.
 *
 * This mirrors scripts/process-brief-images.mjs, which generates work-images.ts
 * the same way. Do not hand-edit the output.
 *
 * Exits non-zero with a readable report on any problem, which fails the
 * Cloudflare build and leaves the previous good deploy live.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import cms from "../serverlib/cms.js";

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")),
  ".."
);

const CONTENT_DIR = path.join(root, "content/projects");
const MEDIA_DIR = path.join(root, "public/work/cms");
const OUT_FILE = path.join(root, "src/lib/projects-cms.ts");
const REMOVED_FILE = path.join(root, "content/removed-projects.json");
const REDIRECTS_FILE = path.join(root, "public/_redirects");

// The generated block in public/_redirects is replaced between these markers;
// everything a human wrote outside them is left exactly as it is.
const REDIRECT_BEGIN = "# BEGIN generated — removed CMS projects (scripts/sync-cms-projects.mjs)";
const REDIRECT_END = "# END generated — removed CMS projects";

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

/**
 * JSON.parse rejects a leading byte-order mark, and every Windows editor and
 * PowerShell's own `Set-Content -Encoding utf8` writes one. The admin commits
 * clean UTF-8, but the README invites hand-writing a file to test the pipeline —
 * so strip it rather than leave a baffling "Unexpected token" on a file that
 * looks perfectly fine.
 */
function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, "utf8").replace(/^﻿/, ""));
}

/* ------------------------------------------------------------------ *
 * 1. Drift guard                                                      *
 *                                                                     *
 * serverlib/cms-vocab.js duplicates the service and area slugs because *
 * the real lists live in TypeScript the Vercel functions cannot read.  *
 * Re-derive them here and fail loudly rather than let a CMS project    *
 * quietly point at a service or area that no longer exists.           *
 * ------------------------------------------------------------------ */
/**
 * services.ts mixes bare and quoted keys (`slug:` for the first six entries,
 * `"slug":` from line 593 on), so BOTH forms must match. Reading only the bare
 * form found six of the eleven services and, because cms-vocab.js had been
 * written from that same too-narrow pattern, the guard compared two copies of
 * the same mistake and passed. Hence the tolerant pattern and the independent
 * cross-check below.
 */
const SLUG_LINE = /^\s*"?slug"?\s*:\s*"([^"]+)"/gm;

function slugsFrom(relPath, arrayName) {
  const src = fs.readFileSync(path.join(root, relPath), "utf8");
  // Narrow to the exported array so unrelated slug-ish lines cannot leak in.
  const start = src.indexOf(`export const ${arrayName}`);
  if (start === -1) throw new Error(`${relPath}: could not find "export const ${arrayName}"`);
  return [...src.slice(start).matchAll(SLUG_LINE)].map((m) => m[1]);
}

/**
 * A second, independent reading of the service list: the hand-maintained
 * /services/<slug> links in the navigation. A pattern bug in slugsFrom would
 * have to be mirrored here to go unnoticed, which is what makes this worth
 * having rather than just trusting one regex.
 */
function serviceSlugsFromNav() {
  const src = fs.readFileSync(path.join(root, "src/lib/nav.ts"), "utf8");
  return [...new Set([...src.matchAll(/"\/services\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
}

function checkDrift(label, actual, declared) {
  const missing = actual.filter((s) => !declared.includes(s));
  const stale = declared.filter((s) => !actual.includes(s));
  if (missing.length || stale.length) {
    const parts = [];
    if (missing.length) parts.push(`missing ${missing.join(", ")}`);
    if (stale.length) parts.push(`no longer exist: ${stale.join(", ")}`);
    fail(
      "serverlib/cms-vocab.js",
      `${label} list is out of date (${parts.join("; ")}). Update cms-vocab.js to match.`
    );
  }
}

const serviceSlugs = slugsFrom("src/lib/services.ts", "services");
checkDrift("SERVICE_SLUGS", serviceSlugs, cms.SERVICE_SLUGS);
checkDrift("AREA_SLUGS", slugsFrom("src/lib/locations.ts", "locations"), cms.AREA_SLUGS);

// Independent cross-check: every service the nav links to must be in the vocab.
for (const s of serviceSlugsFromNav()) {
  if (!cms.SERVICE_SLUGS.includes(s))
    fail(
      "serverlib/cms-vocab.js",
      `nav.ts links to /services/${s} but SERVICE_SLUGS does not list it — the service list was read incompletely.`
    );
}

/* ------------------------------------------------------------------ *
 * 2. Slugs already taken by the hand-authored case studies            *
 * ------------------------------------------------------------------ */
const existingSlugs = new Set();
for (const rel of ["src/lib/projects.ts", "src/lib/projects-brief2.ts"]) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  for (const m of src.matchAll(SLUG_LINE)) existingSlugs.add(m[1]);
}

// The admin refuses a slug that a hand-authored case study already owns, using
// RESERVED_SLUGS in cms-vocab.js — the Vercel functions cannot read TypeScript.
// If someone adds a case study to projects-brief2.ts without updating that list,
// the admin would start accepting a slug the build rejects, and the first
// publish of it would freeze every later deploy. So fail here instead, loudly,
// while it is still just a build error on someone's machine.
checkDrift("RESERVED_SLUGS", [...existingSlugs], cms.RESERVED_SLUGS);

/* ------------------------------------------------------------------ *
 * 3. Read, validate and measure                                       *
 * ------------------------------------------------------------------ */
const files = fs.existsSync(CONTENT_DIR)
  ? fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".json")).sort()
  : [];

const projects = [];

for (const file of files) {
  const full = path.join(CONTENT_DIR, file);
  let raw;
  try {
    raw = readJson(full);
  } catch (err) {
    fail(file, `not valid JSON — ${err.message}`);
    continue;
  }

  const result = cms.validateProject(raw);
  if (!result.ok) {
    for (const p of result.problems) fail(file, `${p.field} — ${p.message}`);
    continue;
  }
  const p = result.project;

  // The filename is the slug, so one project cannot masquerade as another.
  if (`${p.slug}.json` !== file) {
    fail(file, `slug "${p.slug}" does not match the filename (expected ${p.slug}.json)`);
    continue;
  }
  if (existingSlugs.has(p.slug)) {
    fail(file, `slug "${p.slug}" is already used by a hand-authored case study`);
    continue;
  }

  // Measure every image off the committed file. Explicit width/height is
  // required site-wide (images.unoptimized), and reading it here rather than
  // trusting the JSON also catches a truncated, swapped or missing file.
  const byFile = new Map();
  for (const img of p.images) {
    const abs = path.join(MEDIA_DIR, p.slug, img.file);
    if (!fs.existsSync(abs)) {
      fail(file, `image not committed: public/work/cms/${p.slug}/${img.file}`);
      continue;
    }
    const bytes = fs.readFileSync(abs);
    if (!cms.sniffImage(bytes)) {
      fail(file, `${img.file} is not a valid JPEG or PNG`);
      continue;
    }
    let meta;
    try {
      meta = await sharp(bytes).metadata();
    } catch (err) {
      fail(file, `${img.file} could not be read by sharp — ${err.message}`);
      continue;
    }
    if (!meta.width || !meta.height) {
      fail(file, `${img.file} has no readable dimensions`);
      continue;
    }
    if (meta.width > 1600 || meta.height > 1600)
      fail(file, `${img.file} is ${meta.width}x${meta.height} — larger than the 1600px limit`);

    byFile.set(img.file, {
      src: `/work/cms/${p.slug}/${img.file}`,
      width: meta.width,
      height: meta.height,
      kind: img.kind,
      alt: img.alt,
      ...(img.caption ? { caption: img.caption } : {}),
    });
  }

  // An orphaned file is a privacy question, not just clutter: it stays publicly
  // reachable at its URL while nothing on the site reviews it.
  const dir = path.join(MEDIA_DIR, p.slug);
  if (fs.existsSync(dir)) {
    const declared = new Set(p.images.map((i) => i.file));
    for (const f of fs.readdirSync(dir)) {
      if (!declared.has(f)) fail(file, `public/work/cms/${p.slug}/${f} is not referenced — remove it`);
    }
  }

  const cover = p.images.find((i) => i.cover);
  projects.push({ meta: p, images: byFile, cover: cover && byFile.get(cover.file) });
}

/* ------------------------------------------------------------------ *
 * 4. Removed projects → 301s                                          *
 *                                                                     *
 * Deleting a published case study takes its page out of the build, so  *
 * the URL would start returning 404 — a dead end for anyone holding a  *
 * link and for anything Google already indexed. content/removed-       *
 * projects.json records those slugs and this step turns them into      *
 * redirects to the hub.                                                *
 *                                                                     *
 * The admin only ever writes the JSON. This trusted script is the ONLY *
 * thing that touches public/_redirects, which is site-wide routing —   *
 * keeping that file out of the publish allow-list means a compromised  *
 * admin password cannot rewrite where the site's URLs point.           *
 * ------------------------------------------------------------------ */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
let removedSlugs = [];

if (fs.existsSync(REMOVED_FILE)) {
  let raw;
  try {
    raw = readJson(REMOVED_FILE);
  } catch (err) {
    fail("content/removed-projects.json", `not valid JSON — ${err.message}`);
    raw = null;
  }
  if (raw) {
    if (!Array.isArray(raw.slugs)) {
      fail("content/removed-projects.json", 'expected { "slugs": ["…"] }');
    } else {
      const live = new Set(projects.map((p) => p.meta.slug));
      for (const s of raw.slugs) {
        // Re-validate every slug rather than trusting the file: these become
        // lines in a routing config, so nothing shaped like anything else gets in.
        if (typeof s !== "string" || !SLUG_RE.test(s)) {
          fail("content/removed-projects.json", `"${String(s).slice(0, 60)}" is not a valid slug`);
          continue;
        }
        if (live.has(s)) {
          fail(
            "content/removed-projects.json",
            `"${s}" is listed as removed but content/projects/${s}.json still exists — a slug cannot be both`
          );
          continue;
        }
        if (existingSlugs.has(s)) {
          fail(
            "content/removed-projects.json",
            `"${s}" is a hand-authored case study, not a CMS one — remove it from this file`
          );
          continue;
        }
        removedSlugs.push(s);
      }
      removedSlugs = [...new Set(removedSlugs)].sort();
    }
  }
}

/**
 * Rewrite only the generated block in public/_redirects.
 *
 * Both the bare and trailing-slash forms are emitted. That is not belt-and-
 * braces: the site builds with trailingSlash:true so the indexed URL carries
 * the slash, and Cloudflare Pages matches the path exactly — the existing
 * /before-and-after entry in this file documents that listing only the bare
 * path returned a 404 in production.
 */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function writeRedirects() {
  if (!fs.existsSync(REDIRECTS_FILE)) return;
  const current = fs.readFileSync(REDIRECTS_FILE, "utf8");

  // Match the existing file's line endings. The working tree here is CRLF while
  // git stores LF, so emitting "\n" rewrote every line in the file — no content
  // change, but a spurious "modified" flag and a needlessly noisy commit.
  const eol = current.includes("\r\n") ? "\r\n" : "\n";

  const block = removedSlugs.length
    ? [
        REDIRECT_BEGIN,
        "# Case studies Sean removed in the admin. Do not edit by hand — this block",
        "# is regenerated from content/removed-projects.json on every build.",
        ...removedSlugs.flatMap((s) => [
          `/projects/${s}    /projects/   301`,
          `/projects/${s}/   /projects/   301`,
        ]),
        REDIRECT_END,
      ].join(eol)
    : "";

  // Lift out any existing generated block together with the blank line that
  // separates it from the hand-written rules above, and touch nothing else —
  // the rest of this file is maintained by a person.
  const blockRe = new RegExp(
    `(?:\\r?\\n)*${escapeRe(REDIRECT_BEGIN)}[\\s\\S]*?${escapeRe(REDIRECT_END)}[^\\S\\r\\n]*`
  );
  const stripped = current.replace(blockRe, "");
  const trimmed = stripped.replace(/(?:\r?\n)+$/, "");
  const next = block ? `${trimmed}${eol}${eol}${block}${eol}` : `${trimmed}${eol}`;

  if (next !== current) {
    fs.writeFileSync(REDIRECTS_FILE, next);
    console.log(
      removedSlugs.length
        ? `Updated public/_redirects (${removedSlugs.length} removed project redirect(s))`
        : "Updated public/_redirects (removed the generated block)"
    );
  }
}

/* ------------------------------------------------------------------ *
 * 5. Report or write                                                  *
 * ------------------------------------------------------------------ */
if (errors.length) {
  console.error(`\nCMS content is not valid — ${errors.length} problem(s), nothing written:\n`);
  for (const e of errors) console.error(`  • ${e}`);
  console.error("\nFix the content above (or the admin that produced it) and build again.\n");
  process.exit(1);
}

const q = (v) => JSON.stringify(v);

/** An inline WorkImage literal — CMS images are not in work-images.ts. */
function imgLit(i, indent) {
  const pad = " ".repeat(indent);
  const parts = [
    `src: ${q(i.src)}`,
    `width: ${i.width}`,
    `height: ${i.height}`,
    `kind: ${q(i.kind)}`,
    `alt: ${q(i.alt)}`,
  ];
  if (i.caption) parts.push(`caption: ${q(i.caption)}`);
  return `{\n${pad}  ${parts.join(`,\n${pad}  `)},\n${pad}}`;
}

function projectLit({ meta: p, images, cover }) {
  const L = [];
  const add = (k, v) => L.push(`    ${k}: ${v},`);

  add("slug", q(p.slug));
  add("title", q(p.title));
  add("town", q(p.town));
  add("propertyType", q(p.propertyType));
  add("projectType", q(p.projectType));
  add("stage", q(p.stage));
  add("status", q(p.status));
  add("summary", q(p.summary));
  add("brief", q(p.brief));
  for (const k of ["challenge", "designResponse", "planningRoute", "buildingRegsRoute", "outcome"])
    if (p[k]) add(k, q(p[k]));
  add("drawings", p.drawings.length ? `[\n${p.drawings.map((d) => `      ${q(d)},`).join("\n")}\n    ]` : "[]");
  add("homeownerPermissionConfirmed", String(p.homeownerPermissionConfirmed));
  if (p.relatedServices.length)
    add("relatedServices", `[${p.relatedServices.map(q).join(", ")}]`);
  if (p.relatedAreas.length) add("relatedAreas", `[${p.relatedAreas.map(q).join(", ")}]`);
  if (p.seoTitle) add("seoTitle", q(p.seoTitle));
  if (p.metaDescription) add("metaDescription", q(p.metaDescription));
  add("reviewed", q(p.reviewed));

  if (cover) add("cover", imgLit(cover, 4));

  // Gallery = every image in authoring order, cover included (the hand-authored
  // case studies do the same, so the hero also appears in the gallery strip).
  const gallery = p.images.map((i) => images.get(i.file)).filter(Boolean);
  if (gallery.length)
    add("gallery", `[\n${gallery.map((i) => `      ${imgLit(i, 6)},`).join("\n")}\n    ]`);

  if (p.beforeAfter) {
    const ba = p.beforeAfter;
    const rows = [`      label: ${q(ba.label)},`];
    for (const k of ["before", "drawing", "after"]) {
      const i = ba[k] && images.get(ba[k]);
      if (i) rows.push(`      ${k}: ${imgLit(i, 6)},`);
    }
    if (ba.aligned) rows.push(`      aligned: true,`);
    add("beforeAfter", `{\n${rows.join("\n")}\n    }`);
  }

  return `  {\n${L.join("\n")}\n  }`;
}

const body = projects.length
  ? `[\n${projects.map(projectLit).join(",\n")},\n]`
  : "[]";

const ts = `/**
 * GENERATED by scripts/sync-cms-projects.mjs from content/projects/*.json
 * — do not edit by hand. Re-run the script (or just \`npm run build\`, which
 * runs it as "prebuild") after changing the content.
 *
 * These are the case studies Sean publishes himself through the admin portal at
 * /admin/ → Content → Projects. They are validated against the schema and
 * content rules in serverlib/cms.js at publish time AND again here at build
 * time, so the same rules that govern the hand-authored case studies in
 * projects.ts and projects-brief2.ts apply to these: genuine SC Design work
 * only, general area and never a street address, nothing invented, and a design
 * visualisation is never presented as a completed build.
 *
 * Images live in public/work/cms/<slug>/ and their width and height are measured
 * from the committed files, not taken on trust from the content.
 */
import type { Project } from "./projects";

export const cmsProjects: Project[] = ${body};
`;

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
const previous = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, "utf8") : null;
if (previous === ts) {
  console.log(`projects-cms.ts unchanged (${projects.length} CMS project(s))`);
} else {
  fs.writeFileSync(OUT_FILE, ts);
  console.log(`Wrote src/lib/projects-cms.ts (${projects.length} CMS project(s))`);
}
writeRedirects();

for (const { meta } of projects)
  console.log(`  ${meta.status === "published" ? "published" : "draft    "}  ${meta.slug}  (${meta.images.length} image(s))`);
for (const s of removedSlugs) console.log(`  removed    ${s}  → /projects/ (301)`);
