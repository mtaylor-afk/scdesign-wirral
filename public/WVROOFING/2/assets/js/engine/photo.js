// WV Roofing v2 — opening a photo on the visitor's device.
// This is the whole photo pipeline: the visitor's own photo is opened here
// (turned the right way up and cut to the working size) and never leaves the
// device. Sample houses are opened the same way. There is no server.
//
// A phone photo can be very large (some camera modes save 50, 108 or 200
// megapixels), and opening one at full size can take hundreds of megabytes,
// more than a mid-range phone will give a web page. So the photo's pixel size
// is read from its header first. Anything over MAX_PIXELS is turned away with
// a plain message. The rest is decoded straight to the working size where the
// browser can do that, the result is checked, and otherwise it is decoded in
// full and scaled down, as before.

export const WORK_EDGE = 1600;

/** The largest photo that is opened: about 40 megapixels. */
export const MAX_PIXELS = 40e6;

/** A problem with the photo; its message is a plain sentence for the visitor. */
export class PhotoError extends Error {
  constructor(message) {
    super(message);
    this.name = "PhotoError";
  }
}

// ---- The photo's size, from its header ------------------------------------------

const WINDOW = 64 * 1024; // bytes read from the file at a time
const MAX_SCAN = 4 * 1024 * 1024; // stop looking for a JPEG's frame header this far in

// JPEG frame headers (SOF0 to SOF15, leaving out DHT, JPG and DAC).
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/** Read bytes from a Blob, a window at a time. Resolves null past the end. */
function byteReader(blob) {
  let base = 0;
  let buf = new Uint8Array(0);
  return async (start, length) => {
    if (start < 0 || length < 0 || start + length > blob.size) return null;
    if (start < base || start + length > base + buf.length) {
      buf = new Uint8Array(await blob.slice(start, start + Math.max(length, WINDOW)).arrayBuffer());
      base = start;
      if (start + length > base + buf.length) return null;
    }
    return buf.subarray(start - base, start - base + length);
  };
}

/** The Orientation tag (1 to 8) from the TIFF block inside a JPEG's EXIF; 1 if there is none. */
function exifOrientation(t) {
  if (t.length < 8) return 1;
  const little = t[0] === 0x49 && t[1] === 0x49;
  if (!little && !(t[0] === 0x4d && t[1] === 0x4d)) return 1;
  const u16 = (o) => (little ? t[o] | (t[o + 1] << 8) : (t[o] << 8) | t[o + 1]);
  const u32 = (o) => (little ? t[o] + t[o + 1] * 256 + t[o + 2] * 65536 + t[o + 3] * 16777216 : t[o] * 16777216 + t[o + 1] * 65536 + t[o + 2] * 256 + t[o + 3]);
  if (u16(2) !== 42) return 1;
  const ifd = u32(4);
  if (ifd + 2 > t.length) return 1;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > t.length) break;
    if (u16(e) === 0x0112) {
      const v = u16(e + 8);
      return v >= 1 && v <= 8 ? v : 1;
    }
  }
  return 1;
}

/** A JPEG's stored size (from its frame header) and EXIF orientation. */
async function jpegSize(read, size) {
  let orientation = 1;
  let seenExif = false;
  let off = 2;
  const end = Math.min(size, MAX_SCAN);
  while (off + 4 <= end) {
    const b = await read(off, 4);
    if (!b || b[0] !== 0xff) return null;
    const marker = b[1];
    if (marker === 0xff) {
      off += 1; // padding before a marker
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      off += 2; // markers without a length
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // the picture data starts (or ends) before any frame header
    const len = (b[2] << 8) | b[3];
    if (len < 2) return null;
    if (SOF.has(marker)) {
      const f = await read(off + 4, 5); // precision, height, width
      if (!f) return null;
      const h = (f[1] << 8) | f[2];
      const w = (f[3] << 8) | f[4];
      return w && h ? { w, h, orientation } : null;
    }
    if (marker === 0xe1 && !seenExif && len >= 16) {
      const id = await read(off + 4, 6);
      if (id && id[0] === 0x45 && id[1] === 0x78 && id[2] === 0x69 && id[3] === 0x66 && id[4] === 0 && id[5] === 0) {
        seenExif = true;
        const tiff = await read(off + 10, len - 8);
        if (tiff) orientation = exifOrientation(tiff);
      }
    }
    off += 2 + len;
  }
  return null;
}

/** A PNG's size, from its IHDR chunk. */
async function pngSize(read) {
  const b = await read(0, 24);
  if (!b || b[12] !== 0x49 || b[13] !== 0x48 || b[14] !== 0x44 || b[15] !== 0x52) return null;
  const w = b[16] * 16777216 + b[17] * 65536 + b[18] * 256 + b[19];
  const h = b[20] * 16777216 + b[21] * 65536 + b[22] * 256 + b[23];
  return w && h ? { w, h, orientation: 1 } : null;
}

/**
 * The photo's size the right way up (EXIF orientations 5 to 8 turn it on its
 * side), read from the first bytes of a JPEG or a PNG, without decoding it.
 * @param {Blob} blob
 * @returns {Promise<{w:number, h:number, orientation:number}|null>} null for
 *   other formats, or when the header can't be read
 */
export async function headerSize(blob) {
  try {
    if (!blob || !(blob.size > 0) || typeof blob.slice !== "function") return null;
    const read = byteReader(blob);
    const sig = await read(0, 8);
    if (!sig) return null;
    let found = null;
    if (sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff) found = await jpegSize(read, blob.size);
    else if (sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47 && sig[4] === 0x0d && sig[5] === 0x0a) found = await pngSize(read);
    if (!found) return null;
    const turned = found.orientation >= 5;
    return { w: turned ? found.h : found.w, h: turned ? found.w : found.h, orientation: found.orientation };
  } catch (err) {
    return null; // an unreadable header is left to the decoder to judge
  }
}

// ---- Decoding -----------------------------------------------------------------

function decodeViaImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      // A plain error, not a PhotoError: the page then gives its own advice
      // about which formats work (a JPG or PNG), which is what helps here.
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

function release(bitmap) {
  if (bitmap && bitmap.close) {
    try {
      bitmap.close();
    } catch (err) {
      /* nothing to release */
    }
  }
}

function fit(w, h, edge) {
  const s = Math.min(1, edge / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

const near = (a, b) => Math.abs(a - b) <= 1;

/**
 * Decode the photo, straight to the working size when the header gave its
 * size and the browser can resize while decoding.
 * @returns {Promise<{source:ImageBitmap|HTMLImageElement, out:{w:number,h:number}|null}>}
 *   `out` is the working size when it is already known
 */
async function decode(blob, head) {
  if (typeof createImageBitmap !== "function") return { source: await decodeViaImg(blob), out: null };
  if (head) {
    const target = fit(head.w, head.h, WORK_EDGE);
    if (target.w < head.w || target.h < head.h) {
      // Only the width is asked for, so the browser keeps the proportions. A
      // browser that resized before turning the picture the right way up (or
      // didn't turn it at all) then gives the wrong shape, which is caught here.
      try {
        const bmp = await createImageBitmap(blob, { imageOrientation: "from-image", resizeWidth: target.w, resizeQuality: "high" });
        if (near(bmp.width, target.w) && near(bmp.height, target.h)) return { source: bmp, out: target };
        // A browser without the resize options decodes in full: that will do.
        if (bmp.width === head.w && bmp.height === head.h) return { source: bmp, out: target };
        release(bmp);
      } catch (err) {
        /* try the full decode */
      }
    }
  }
  try {
    return { source: await createImageBitmap(blob, { imageOrientation: "from-image" }), out: null };
  } catch (err) {
    return { source: await decodeViaImg(blob), out: null };
  }
}

function toCanvas(source, srcW, srcH, size) {
  const out = size || fit(srcW, srcH, WORK_EDGE);
  const c = document.createElement("canvas");
  c.width = out.w;
  c.height = out.h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.w, out.h);
  ctx.drawImage(source, 0, 0, srcW, srcH, 0, 0, out.w, out.h);
  release(source);
  return c;
}

/**
 * Open the visitor's photo on this device: turned the right way up and at
 * most WORK_EDGE px on its long edge, on a canvas at that exact size (so the
 * roof outline lines up pixel for pixel).
 * @param {Blob} blob
 * @returns {Promise<HTMLCanvasElement>}
 * @throws {PhotoError} with a plain message, e.g. when the photo is too large
 *   to open safely; other errors mean the browser couldn't decode it
 */
export async function blobToCanvas(blob) {
  const head = await headerSize(blob);
  if (head && head.w * head.h > MAX_PIXELS) {
    const mp = Math.round((head.w * head.h) / 1e6);
    throw new PhotoError("This photo is too large to open safely on this device (about " + mp + " megapixels). Please choose a smaller copy of it, or take the photo in your camera's standard mode.");
  }
  const { source, out } = await decode(blob, head);
  const w = source.naturalWidth || source.width;
  const h = source.naturalHeight || source.height;
  return toCanvas(source, w, h, out);
}

/**
 * Load a sample house: from sample.url when it is given, otherwise from
 * base + sample.src.
 */
export async function loadSample(sample, base) {
  const img = new Image();
  img.decoding = "async";
  img.src = sample.url || (base || "") + sample.src;
  await img.decode();
  const canvas = toCanvas(img, img.naturalWidth, img.naturalHeight);
  return { canvas, w: canvas.width, h: canvas.height, name: sample.title, originalW: img.naturalWidth, originalH: img.naturalHeight };
}

/**
 * Friendly warnings about photos that will give poor results.
 * @param {{canvas:HTMLCanvasElement, w:number, h:number, originalW:number, originalH:number,
 *          pixels?:{data:Uint8ClampedArray}}} photo  pass `pixels` (the canvas's ImageData)
 *   when it has already been read, to save reading the canvas again
 */
export function photoWarnings(photo) {
  const out = [];
  const shortEdge = Math.min(photo.originalW, photo.originalH);
  if (shortEdge < 600) out.push("This photo is quite small, so results may look soft. A larger photo will work better.");
  const d = photo.pixels && photo.pixels.data ? photo.pixels.data : photo.canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, photo.w, photo.h).data;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4 * 53) {
    sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    n++;
  }
  const mean = sum / Math.max(1, n);
  if (mean < 55) out.push("This photo is quite dark. A daylight photo gives the most realistic roofs.");
  if (mean > 215) out.push("This photo is very bright or washed out, so roof colours may look pale.");
  return out;
}
