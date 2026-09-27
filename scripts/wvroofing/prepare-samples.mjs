// WV Roofing — prepares the demo "sample house" photos for the Roof Visualiser.
//
// Usage: node scripts/wvroofing/prepare-samples.mjs <folder-with-originals>
//
// Sources (download the originals into one folder first):
//   semi-1930s.jpg               https://unsplash.com/photos/yXBeuNhmbNY  (?w=1600)
//   detached-modern.jpg          https://www.pexels.com/photo/37943926/   (w=1600)
//   detached-1930s-clay-3200.jpg https://unsplash.com/photos/WUEGFIcfwK4  (w=3200)
//
// Originals are licence-clean stock photos (Unsplash / Pexels licence) and are
// NOT committed. This script crops, blurs number plates / house numbers,
// strips all metadata (sharp drops EXIF/GPS by default) and writes web-sized
// JPEGs to public/WVROOFING/samples/. Re-run it if a sample is replaced.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../../public/WVROOFING/samples");
const srcDir = process.argv[2];
if (!srcDir) {
  console.error("Pass the folder that holds the original downloads.");
  process.exit(1);
}

// crop: region of the original to keep; blur: rects in ORIGINAL pixels.
const SAMPLES = [
  {
    id: "semi-1930s",
    file: "semi-1930s.jpg",
    blur: [{ x: 826, y: 1042, w: 54, h: 46 }], // number plate
  },
  {
    id: "detached-modern",
    file: "detached-modern.jpg",
    crop: { left: 0, top: 400, width: 1600, height: 2000 },
  },
  {
    id: "detached-clay",
    file: "detached-1930s-clay-3200.jpg",
    crop: { left: 0, top: 560, width: 2000, height: 1500 },
  },
];

const MAX_EDGE = 1600;

for (const s of SAMPLES) {
  const input = path.join(srcDir, s.file);
  let base = sharp(input).rotate();
  const meta = await sharp(input).metadata();
  let buf = await base.toBuffer();

  // Blur each rect by compositing a blurred copy of just that region.
  if (s.blur) {
    const overlays = [];
    for (const r of s.blur) {
      const left = Math.max(0, r.x);
      const top = Math.max(0, r.y);
      const width = Math.min(r.w, meta.width - left);
      const height = Math.min(r.h, meta.height - top);
      const patch = await sharp(buf)
        .extract({ left, top, width, height })
        .resize(Math.max(2, Math.round(width / 8)), Math.max(2, Math.round(height / 8)))
        .resize(width, height, { kernel: "cubic" })
        .blur(3)
        .toBuffer();
      overlays.push({ input: patch, left, top });
    }
    buf = await sharp(buf).composite(overlays).toBuffer();
  }

  let pipe = sharp(buf);
  if (s.crop) pipe = pipe.extract(s.crop);
  const out = path.join(outDir, s.id + ".jpg");
  const info = await pipe
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(out);
  console.log(`${s.id}: ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)} KB -> ${out}`);
}
