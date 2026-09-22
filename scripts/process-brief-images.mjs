#!/usr/bin/env node
/**
 * Process the project images from Sean's website briefs into web-ready assets.
 *
 *   node scripts/process-brief-images.mjs <word/media folder>            (single source)
 *   node scripts/process-brief-images.mjs jun=<folder> sep=<folder>      (named sources)
 *
 * Driven by scripts/brief-images.json. For each entry: rotate (Word showed some
 * photos rotated) -> white-out boxes (drawing "WORK IN PROGRESS" stamps) ->
 * blur boxes (house numbers) -> resize to max 1600px -> write to public/<out>
 * (photos/renders = mozjpeg q80, drawings = palette PNG). Then regenerates
 * src/lib/work-images.ts with real width/height for every image.
 *
 * MULTIPLE BRIEFS: each brief is a separate .docx with its own word/media folder,
 * and the filenames COLLIDE (both contain image14.jpeg etc). So an entry may set
 * `"dir": "<alias>"` to say which source folder its `src` comes from, and the
 * aliases are supplied on the command line as `alias=path`. An entry with no
 * `dir` uses the default source (a bare path argument, or the first alias given).
 *
 * The original .docx files and their unprocessed media are NOT committed
 * (uncropped, unblurred) — keep them outside the repo and pass the folders in.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

/** Parse `alias=path` / bare-path arguments into { sources, defaultDir }. */
const sources = {};
let defaultDir = null;
for (const arg of process.argv.slice(2)) {
  const eq = arg.indexOf("=");
  // A bare Windows path ("C:\...") has an "=" nowhere; an alias never contains a separator.
  if (eq > 0 && !/[\\/]/.test(arg.slice(0, eq))) {
    const alias = arg.slice(0, eq);
    sources[alias] = arg.slice(eq + 1);
    if (!defaultDir) defaultDir = sources[alias];
  } else {
    defaultDir = arg;
  }
}
if (!defaultDir) {
  console.error("Usage: node scripts/process-brief-images.mjs [alias=]<word/media folder> ...");
  process.exit(1);
}
for (const [alias, dir] of Object.entries({ "(default)": defaultDir, ...sources })) {
  if (!fs.existsSync(dir)) {
    console.error(`Source folder for ${alias} does not exist: ${dir}`);
    process.exit(1);
  }
}

/**
 * Absolute path to an entry's source file, or null when that brief's folder was
 * not supplied on this run. Each brief lives in its own .docx, and you often
 * only have one of them to hand — so an entry whose source is unavailable is
 * REUSED from the already-processed file in public/ rather than failing the run
 * (see the reuse branch below). That keeps work-images.ts complete either way.
 */
function sourceFor(e) {
  const dir = e.dir ? sources[e.dir] : defaultDir;
  if (!dir) return null;
  return path.join(dir, e.src);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "scripts/brief-images.json"), "utf8"));
const MAX = 1600;

async function processOne(e) {
  let buf = await sharp(sourceFor(e)).rotate(e.rotate || 0).toBuffer();
  let meta = await sharp(buf).metadata();

  const overlays = [];
  for (const [left, top, width, height] of e.fill || []) {
    overlays.push({
      input: { create: { width, height, channels: 3, background: "#ffffff" } },
      left,
      top,
    });
  }
  for (const [left, top, width, height] of e.blur || []) {
    const patch = await sharp(buf).extract({ left, top, width, height }).blur(6).toBuffer();
    overlays.push({ input: patch, left, top });
  }
  if (overlays.length) buf = await sharp(buf).composite(overlays).toBuffer();

  // `crop: [w, h]` centre-crops to that aspect ratio. Used for drag-to-compare
  // pairs: BeforeAfterSlider frames both images in one aspect-[3/2] box with
  // object-cover, so a square "existing" photo and a 4:3 "concept" render would
  // be cropped differently and the two halves would not line up under the handle.
  if (e.crop) {
    const [aw, ah] = e.crop;
    const m = await sharp(buf).metadata();
    const srcRatio = m.width / m.height;
    const dstRatio = aw / ah;
    const w = srcRatio > dstRatio ? Math.round(m.height * dstRatio) : m.width;
    const h = srcRatio > dstRatio ? m.height : Math.round(m.width / dstRatio);
    buf = await sharp(buf)
      .extract({
        left: Math.round((m.width - w) / 2),
        top: Math.round((m.height - h) / 2),
        width: w,
        height: h,
      })
      .toBuffer();
    meta = await sharp(buf).metadata();
  }

  let img = sharp(buf);
  if ((meta.width || 0) > MAX) img = img.resize({ width: MAX, withoutEnlargement: true });
  const outPath = path.join(root, "public", e.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  if (e.out.endsWith(".png")) {
    await img.png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(outPath);
  } else {
    await img.flatten({ background: "#ffffff" }).jpeg({ quality: 80, mozjpeg: true }).toFile(outPath);
  }
  meta = await sharp(outPath).metadata();
  const size = fs.statSync(outPath).size;
  console.log(`${e.id.padEnd(28)} ${e.out.padEnd(52)} ${meta.width}x${meta.height}  ${(size / 1024).toFixed(0)} KB`);
  return { ...e, width: meta.width, height: meta.height };
}

const results = [];
for (const e of manifest.images) {
  if (e.publish === false) {
    // Held back (e.g. suspected Google Street View capture, third-party
    // copyright) — never output, and delete any stale file from an earlier run.
    const stale = path.join(root, "public", e.out);
    if (fs.existsSync(stale)) fs.unlinkSync(stale);
    console.log(`${e.id.padEnd(28)} HELD — ${e.note || "publish:false"}`);
    continue;
  }

  const src = sourceFor(e);
  const outPath = path.join(root, "public", e.out);
  if (!src || !fs.existsSync(src)) {
    // That brief's media folder wasn't passed this run. Keep the entry by
    // reading the already-processed asset; only fail if it's missing too.
    if (!fs.existsSync(outPath)) {
      console.error(
        `${e.id}: source unavailable (${e.dir ? `dir "${e.dir}"` : "default dir"}) and no existing public/${e.out}`
      );
      process.exit(1);
    }
    const meta = await sharp(outPath).metadata();
    results.push({ ...e, width: meta.width, height: meta.height });
    continue;
  }

  results.push(await processOne(e));
}

const lines = results.map(
  (r) =>
    `  ${r.id}: { src: ${JSON.stringify("/" + r.out)}, width: ${r.width}, height: ${r.height}, kind: ${JSON.stringify(r.kind)}, alt: ${JSON.stringify(r.alt)} },`
);
const ts = `/**
 * GENERATED by scripts/process-brief-images.mjs from scripts/brief-images.json
 * — do not edit by hand (re-run the script). Real project photos, drawings and
 * design visualisations from Sean's website briefs (Jun 2026 + Sep 2026).
 *
 * kind: "photo" = real photograph of a completed/in-progress build,
 *       "drawing" = Sean's technical/planning drawing,
 *       "render" = design visualisation (never presented as a completed build).
 */
export type WorkImageKind = "photo" | "drawing" | "render";

export type WorkImage = {
  src: string;
  width: number;
  height: number;
  kind: WorkImageKind;
  alt: string;
  caption?: string;
};

export const workImages = {
${lines.join("\n")}
} satisfies Record<string, WorkImage>;

export type WorkImageId = keyof typeof workImages;

/** A work image with an optional caption override. */
export function wi(id: WorkImageId, caption?: string): WorkImage {
  return caption ? { ...workImages[id], caption } : workImages[id];
}

/** Human label for the image kind (shown on cards/galleries for non-photos). */
export const kindLabel: Record<WorkImageKind, string> = {
  photo: "Project photo",
  drawing: "Drawing",
  render: "Design visualisation",
};
`;
fs.writeFileSync(path.join(root, "src/lib/work-images.ts"), ts);
console.log(`\nWrote src/lib/work-images.ts (${results.length} images)`);
