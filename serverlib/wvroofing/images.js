// WV Roofing — server-side image handling (brief §9-10, OWASP file uploads).
//
// Only JPEG and PNG are accepted, recognised by their magic bytes, never by the
// name or the declared type. Dimensions are read from the file header BEFORE any
// decoding, so a small file that claims to be enormous is refused without being
// decompressed. Metadata (EXIF incl. GPS, XMP, IPTC, comments, trailing data) is
// removed losslessly: the compressed pixel data is copied byte for byte and only
// a minimal orientation tag is put back, so the stored original stays immutable
// and shows the right way up. The working copy is a lossless PNG, oriented and at
// most WORK_EDGE px on the long edge; the roof outline, renders and composites
// all use its exact pixel grid.
"use strict";

const zlib = require("zlib");
const { HttpError, jpegSize, crc32 } = require("./core.js");

const LIMITS = Object.freeze({
  maxUploadBytes: 20 * 1024 * 1024,
  maxPixels: 60 * 1000 * 1000,
  maxEdge: 12000,
  minShortEdge: 480,
  warnShortEdge: 600,
  workEdge: 1600,
  maskMaxBytes: 512 * 1024,
});

/** @type {import("sharp") | null} */
let sharpLib = null;

/**
 * sharp, locked down: only the JPEG and PNG loaders are allowed. Everything we
 * decode has already been sniffed as JPEG or PNG; blocking the other libvips
 * loaders (GIF, TIFF, VIPS, HEIF, SVG, PDF... several carried CVEs in 2026) is
 * defence in depth. This is process-wide, which is fine in the WV function.
 */
function sharp() {
  if (!sharpLib) {
    const s = require("sharp");
    s.block({ operation: ["VipsForeignLoad"] });
    s.unblock({ operation: ["VipsForeignLoadJpegBuffer", "VipsForeignLoadPngBuffer", "VipsForeignLoadJpegFile", "VipsForeignLoadPngFile"] });
    sharpLib = s;
  }
  return sharpLib;
}

/**
 * What a file really is, from its first bytes.
 * @param {Buffer} buf
 * @returns {"jpeg" | "png" | "heic" | "avif" | "webp" | "gif" | "tiff" | null}
 */
function sniff(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "png";
  if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (/^avi[fs]$/.test(brand)) return "avif";
    if (/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand)) return "heic";
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.toString("ascii", 0, 6))) return "gif";
  if (buf.length >= 4 && ["49492a00", "4d4d002a"].includes(buf.toString("hex", 0, 4))) return "tiff";
  return null;
}

/**
 * The PNG header (IHDR), without decoding anything.
 * @param {Buffer} buf
 */
function pngHeader(buf) {
  if (buf.length < 33 || buf.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  if (buf.readUInt32BE(8) !== 13 || buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), depth: buf[24], ctype: buf[25], interlace: buf[28] };
}

/**
 * Orientation (1-8) from a TIFF/EXIF structure, or null.
 * @param {Buffer} tiff  starts with "II*\0" or "MM\0*"
 */
function tiffOrientation(tiff) {
  if (tiff.length < 8) return null;
  const le = tiff.toString("ascii", 0, 2) === "II";
  if (!le && tiff.toString("ascii", 0, 2) !== "MM") return null;
  /** @param {number} o */
  const u16 = (o) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  /** @param {number} o */
  const u32 = (o) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  if (u16(2) !== 42) return null;
  const ifd = u32(4);
  if (ifd + 2 > tiff.length) return null;
  const n = u16(ifd);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > tiff.length) return null;
    if (u16(e) === 0x0112 && u16(e + 2) === 3) {
      const v = u16(e + 8);
      return v >= 1 && v <= 8 ? v : null;
    }
  }
  return null;
}

/**
 * A minimal little-endian TIFF/EXIF block holding only the orientation tag.
 * @param {number} orientation
 */
function minimalExifTiff(orientation) {
  const b = Buffer.alloc(26);
  b.write("II", 0, "ascii");
  b.writeUInt16LE(42, 2);
  b.writeUInt32LE(8, 4);
  b.writeUInt16LE(1, 8); // one IFD entry
  b.writeUInt16LE(0x0112, 10); // Orientation
  b.writeUInt16LE(3, 12); // SHORT
  b.writeUInt32LE(1, 14); // count
  b.writeUInt16LE(orientation, 18);
  b.writeUInt16LE(0, 20);
  b.writeUInt32LE(0, 22); // no next IFD
  return b;
}

const damaged = () => new HttpError(400, "invalid_image", "This photo file seems to be damaged. Please try another copy.");

/**
 * Copy a JPEG without its metadata. Keeps the coding segments, JFIF (APP0), an ICC
 * colour profile (APP2 "ICC_PROFILE") and Adobe (APP14); drops EXIF/XMP (APP1),
 * other APPn (incl. MPF), comments and anything after the image's end marker
 * (e.g. appended secondary images). Compressed scan data is copied byte for byte.
 * @param {Buffer} buf
 * @returns {{ data: Buffer, orientation: number }}
 */
function stripJpeg(buf) {
  if (!(buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8)) throw damaged();
  /** @type {Buffer[]} */
  const head = [];
  /** @type {Buffer[]} */
  const body = [];
  let orientation = 1;
  let i = 2;
  let inScan = false;
  let ended = false;
  while (i < buf.length) {
    if (inScan) {
      // entropy-coded data: runs until a marker other than stuffing (FF00) or restart (FFD0-D7)
      let k = i;
      while (k + 1 < buf.length && !(buf[k] === 0xff && buf[k + 1] !== 0x00 && !(buf[k + 1] >= 0xd0 && buf[k + 1] <= 0xd7))) k++;
      if (k + 1 >= buf.length) throw damaged();
      body.push(buf.subarray(i, k));
      i = k;
      inScan = false;
      continue;
    }
    if (buf[i] !== 0xff) throw damaged();
    let j = i;
    while (j < buf.length && buf[j] === 0xff) j++; // fill bytes
    if (j >= buf.length) throw damaged();
    const marker = buf[j];
    if (marker === 0xd9) {
      body.push(Buffer.from([0xff, 0xd9]));
      ended = true;
      break; // end of image: anything after it is discarded
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      body.push(Buffer.from([0xff, marker]));
      i = j + 1;
      continue;
    }
    if (j + 2 >= buf.length) throw damaged();
    const len = buf.readUInt16BE(j + 1);
    const end = j + 1 + len;
    if (len < 2 || end > buf.length) throw damaged();
    const payload = buf.subarray(j + 3, end);
    const segment = Buffer.concat([Buffer.from([0xff, marker]), buf.subarray(j + 1, end)]);
    const isApp = marker >= 0xe0 && marker <= 0xef;
    if (marker === 0xe1) {
      if (payload.toString("ascii", 0, 6) === "Exif\u0000\u0000") {
        const o = tiffOrientation(payload.subarray(6));
        if (o) orientation = o;
      }
    } else if (marker === 0xe0) {
      if (payload.toString("ascii", 0, 5) === "JFIF\u0000") head.push(segment);
    } else if (marker === 0xe2) {
      if (payload.toString("ascii", 0, 12) === "ICC_PROFILE\u0000") (body.length ? body : head).push(segment);
    } else if (marker === 0xee) {
      if (payload.toString("ascii", 0, 5) === "Adobe") (body.length ? body : head).push(segment);
    } else if (!isApp && marker !== 0xfe) {
      body.push(segment); // DQT, DHT, SOFn, DRI, SOS, DNL...
      if (marker === 0xda) inScan = true;
    }
    i = end;
  }
  if (!ended) throw damaged();
  /** @type {Buffer[]} */
  const exif = [];
  if (orientation !== 1) {
    const tiff = minimalExifTiff(orientation);
    const len = Buffer.alloc(2);
    len.writeUInt16BE(2 + 6 + tiff.length);
    exif.push(Buffer.concat([Buffer.from([0xff, 0xe1]), len, Buffer.from("Exif\u0000\u0000", "ascii"), tiff]));
  }
  // SOI, JFIF (if any), the orientation-only EXIF, ICC/Adobe, then the coding segments
  const jfif = head.filter((s) => s[1] === 0xe0);
  const rest = head.filter((s) => s[1] !== 0xe0);
  return { data: Buffer.concat([Buffer.from([0xff, 0xd8]), ...jfif, ...exif, ...rest, ...body]), orientation };
}

const PNG_KEEP = new Set(["IHDR", "PLTE", "IDAT", "IEND", "cHRM", "gAMA", "iCCP", "sBIT", "sRGB", "bKGD", "pHYs", "tRNS", "cICP", "mDCV", "cLLI"]);

/**
 * Copy a PNG without its metadata: keeps the image and colour chunks, drops text
 * (tEXt, zTXt, iTXt), eXIf, tIME, unknown chunks and anything after IEND.
 * @param {Buffer} buf
 * @returns {{ data: Buffer, orientation: number }}
 */
function stripPng(buf) {
  if (!pngHeader(buf)) throw damaged();
  /** @type {Buffer[]} */
  const out = [buf.subarray(0, 8)];
  let orientation = 1;
  let pos = 8;
  let ended = false;
  let firstIdat = -1;
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const end = pos + 12 + len;
    if (end > buf.length) throw damaged();
    if (type === "eXIf") {
      const o = tiffOrientation(buf.subarray(pos + 8, pos + 8 + len));
      if (o) orientation = o;
    }
    if (type === "IDAT" && firstIdat < 0) firstIdat = out.length;
    if (PNG_KEEP.has(type)) out.push(buf.subarray(pos, end));
    pos = end;
    if (type === "IEND") {
      ended = true;
      break;
    }
  }
  if (!ended || firstIdat < 0) throw damaged();
  if (orientation !== 1) {
    const tiff = minimalExifTiff(orientation);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(tiff.length);
    const td = Buffer.concat([Buffer.from("eXIf", "ascii"), tiff]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    out.splice(firstIdat, 0, Buffer.concat([len, td, crc])); // eXIf must precede IDAT
  }
  return { data: Buffer.concat(out), orientation };
}

/**
 * Validate an uploaded photo and produce everything that is stored for it.
 * @param {Buffer} buf  the bytes exactly as uploaded
 */
async function processUpload(buf) {
  if (!buf || !buf.length) throw new HttpError(400, "invalid_image", "The photo didn't arrive. Please try again.");
  if (buf.length > LIMITS.maxUploadBytes) throw new HttpError(413, "too_large", "That photo is over 20 MB. Please choose a smaller copy.");
  const kind = sniff(buf);
  if (kind === "heic" || kind === "avif") {
    throw new HttpError(400, "invalid_image", "This photo is in the iPhone HEIC format. Please choose it again from your photo library (your phone converts it to JPEG), or set the camera to \"Most Compatible\".");
  }
  if (kind !== "jpeg" && kind !== "png") throw new HttpError(400, "invalid_image", "Please choose a JPG or PNG photo.");

  // Dimensions from the header first: nothing is decoded until they are known to be sane.
  const dims = kind === "jpeg" ? jpegSize(buf) : pngHeader(buf);
  if (!dims || !dims.w || !dims.h) throw damaged();
  if (dims.w * dims.h > LIMITS.maxPixels || Math.max(dims.w, dims.h) > LIMITS.maxEdge) {
    throw new HttpError(400, "invalid_image", "That photo is too large in pixels. Please choose a copy under 60 megapixels.");
  }

  const stripped = kind === "jpeg" ? stripJpeg(buf) : stripPng(buf);
  const rotated = stripped.orientation >= 5;
  const uprightW = rotated ? dims.h : dims.w;
  const uprightH = rotated ? dims.w : dims.h;
  if (Math.min(uprightW, uprightH) < LIMITS.minShortEdge) {
    throw new HttpError(400, "invalid_image", "That photo is too small to work with. Please use one at least " + LIMITS.minShortEdge + " pixels on its shorter side.");
  }

  const s = sharp();
  // rotate() with no angle auto-orients from the orientation-only EXIF put back above.
  const pipeline = s(stripped.data, { limitInputPixels: LIMITS.maxPixels, failOn: "error" })
    .rotate()
    .resize({ width: LIMITS.workEdge, height: LIMITS.workEdge, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb");
  let working;
  try {
    working = await pipeline.png({ compressionLevel: 6 }).toBuffer({ resolveWithObject: true });
  } catch (err) {
    throw damaged();
  }
  const stats = await s(working.data).stats();
  const [r, g, b] = stats.channels;
  const meanLuma = 0.2126 * r.mean + 0.7152 * g.mean + 0.0722 * b.mean;
  /** @type {string[]} */
  const warnings = [];
  if (Math.min(uprightW, uprightH) < LIMITS.warnShortEdge) warnings.push("This photo is quite small, so results may look soft. A larger photo will work better.");
  if (meanLuma < 55) warnings.push("This photo is quite dark. A daylight photo gives the most realistic roofs.");
  if (meanLuma > 215) warnings.push("This photo is very bright or washed out, so roof colours may look pale.");

  return {
    kind,
    mime: kind === "jpeg" ? "image/jpeg" : "image/png",
    ext: kind === "jpeg" ? "jpg" : "png",
    original: stripped.data,
    orientation: stripped.orientation,
    origW: uprightW,
    origH: uprightH,
    working: working.data,
    workW: working.info.width,
    workH: working.info.height,
    quality: { shortEdge: Math.min(uprightW, uprightH), meanLuma: Math.round(meanLuma), warnings },
  };
}

/**
 * Delivery JPEG settings, shared by the photo's display copy and the render
 * composites. Plain libjpeg (no trellis quantisation) encodes every 16x16 block
 * from its own pixels alone, so areas a composite leaves untouched come out
 * identical to the display copy.
 */
const JPEG_OPTIONS = Object.freeze({ quality: 88, chromaSubsampling: "4:2:0", mozjpeg: false });

/**
 * JPEG for the browser, encoded from the lossless working copy.
 * @param {Buffer} workingPng
 */
function displayJpeg(workingPng) {
  return sharp()(workingPng).jpeg(JPEG_OPTIONS).toBuffer();
}

/**
 * Validate a roof-outline PNG (alpha 0 = roof). The header is checked against the
 * expected size BEFORE anything is inflated, and inflation is capped at exactly
 * the size a genuine mask needs, so a decompression bomb costs nothing.
 * @param {Buffer} buf
 * @param {number} W  expected width
 * @param {number} H  expected height
 * @returns {{ w: number, h: number, transparentFrac: number }}
 */
function maskInfo(buf, W, H) {
  const invalid = (/** @type {string} */ msg) => new HttpError(400, "invalid_mask", msg);
  const hdr = pngHeader(buf);
  if (!hdr) throw invalid("The roof outline must be a PNG.");
  if (hdr.w !== W || hdr.h !== H) throw invalid("The roof outline doesn't match the photo size.");
  if (hdr.depth !== 8 || hdr.interlace !== 0 || (hdr.ctype !== 6 && hdr.ctype !== 4)) throw invalid("The roof outline must be an 8-bit PNG with transparency.");
  const bpp = hdr.ctype === 6 ? 4 : 2;
  const stride = W * bpp;
  const expected = H * (stride + 1);
  /** @type {Buffer[]} */
  const idat = [];
  let pos = 8;
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    if (pos + 12 + len > buf.length) throw invalid("The roof outline file is damaged.");
    if (type === "IDAT") idat.push(buf.subarray(pos + 8, pos + 8 + len));
    if (type === "IEND") break;
    pos += 12 + len;
  }
  let raw;
  try {
    raw = zlib.inflateSync(Buffer.concat(idat), { maxOutputLength: expected });
  } catch (err) {
    throw invalid("The roof outline file is damaged.");
  }
  if (raw.length !== expected) throw invalid("The roof outline file is damaged.");
  let prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  let transparent = 0;
  for (let y = 0; y < H; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const bb = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += bb;
      else if (f === 3) v += (a + bb) >> 1;
      else if (f === 4) {
        const p = a + bb - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - bb);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? bb : c;
      } else if (f !== 0) throw invalid("The roof outline file is damaged.");
      cur[x] = v & 255;
    }
    for (let x = bpp - 1; x < stride; x += bpp) if (cur[x] === 0) transparent++;
    prev = Buffer.from(cur);
  }
  return { w: W, h: H, transparentFrac: transparent / (W * H) };
}

/**
 * Validate the editor's shapes (integer working-copy pixel coordinates).
 * @param {unknown} shapes
 * @param {number} W
 * @param {number} H
 */
function cleanShapes(shapes, W, H) {
  const invalid = () => new HttpError(400, "invalid_mask", "The roof outline couldn't be read.");
  if (!Array.isArray(shapes) || shapes.length < 1 || shapes.length > 200) throw invalid();
  let points = 0;
  return shapes.map((s) => {
    if (!s || typeof s !== "object" || (s.mode !== "add" && s.mode !== "sub") || !Array.isArray(s.pts) || s.pts.length < 1 || s.pts.length > 2000) throw invalid();
    points += s.pts.length;
    if (points > 20000) throw invalid();
    const pts = s.pts.map((/** @type {unknown} */ p) => {
      if (!Array.isArray(p) || p.length !== 2) throw invalid();
      const [x, y] = p;
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < -2 || y < -2 || x > W + 2 || y > H + 2) throw invalid();
      return [Math.round(x), Math.round(y)];
    });
    /** @type {{ mode: string, pts: number[][], r?: number }} */
    const out = { mode: s.mode, pts };
    if (s.r !== undefined) {
      if (!Number.isFinite(s.r) || s.r <= 0 || s.r > 400) throw invalid();
      out.r = Math.round(s.r);
    }
    return out;
  });
}

module.exports = { LIMITS, JPEG_OPTIONS, sharp, sniff, pngHeader, tiffOrientation, minimalExifTiff, stripJpeg, stripPng, processUpload, displayJpeg, maskInfo, cleanShapes };
