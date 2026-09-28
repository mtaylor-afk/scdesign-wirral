// WV Roofing Roof Visualiser — photo decoding on the visitor's device.
// Sample houses and the server's prepared photo are decoded here onto a
// canvas at the working size. (Uploaded photos are checked, stripped of
// metadata and oriented on the server: see serverlib/wvroofing/images.js.)
import { ROOT } from "../config.js";

export const WORK_EDGE = 1600;

export class PhotoError extends Error {}

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
      reject(new PhotoError("This photo couldn't be opened. Please try again, or use a different photo."));
    };
    img.src = url;
  });
}

async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (err) {
      return decodeViaImg(file);
    }
  }
  return decodeViaImg(file);
}

function fit(w, h, edge) {
  const s = Math.min(1, edge / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

function toCanvas(source, srcW, srcH) {
  const out = fit(srcW, srcH, WORK_EDGE);
  const c = document.createElement("canvas");
  c.width = out.w;
  c.height = out.h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.w, out.h);
  ctx.drawImage(source, 0, 0, srcW, srcH, 0, 0, out.w, out.h);
  if (source.close) {
    try {
      source.close();
    } catch (err) {
      /* nothing to release */
    }
  }
  return c;
}

/**
 * The server's prepared photo (already oriented and at most WORK_EDGE px) onto
 * a canvas at its exact size, so the roof outline lines up pixel for pixel.
 * @param {Blob} blob
 */
export async function blobToCanvas(blob) {
  const src = await decode(blob);
  const w = src.naturalWidth || src.width;
  const h = src.naturalHeight || src.height;
  return toCanvas(src, w, h);
}

/** Load a demo house from samples/. */
export async function loadSample(sample) {
  const img = new Image();
  img.decoding = "async";
  img.src = ROOT + "samples/" + sample.src;
  await img.decode();
  const canvas = toCanvas(img, img.naturalWidth, img.naturalHeight);
  return { canvas, w: canvas.width, h: canvas.height, name: sample.title, originalW: img.naturalWidth, originalH: img.naturalHeight };
}

/** Friendly warnings about photos that will give poor results. */
export function photoWarnings(photo) {
  const out = [];
  const shortEdge = Math.min(photo.originalW, photo.originalH);
  if (shortEdge < 600) out.push("This photo is quite small, so results may look soft. A larger photo will work better.");
  const ctx = photo.canvas.getContext("2d", { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, photo.w, photo.h).data;
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
