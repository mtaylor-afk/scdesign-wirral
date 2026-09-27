// WV Roofing Roof Visualiser — photo intake. Everything here runs on the
// visitor's device: the photo is decoded, oriented from its EXIF tag, shrunk to
// a working size and re-drawn on a canvas, which also drops every metadata
// block (including GPS). Ported from public/admin/image-prep.js.
import { ROOT } from "../config.js";

export const WORK_EDGE = 1600;
const MAX_FILE_BYTES = 30 * 1024 * 1024;

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
      reject(
        new PhotoError(
          "This photo couldn't be opened. If it came from an iPhone it may be a HEIC file: share it to yourself as a JPEG (or set the camera to \"Most Compatible\") and try again."
        )
      );
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
 * @param {File} file
 * @returns {Promise<{canvas:HTMLCanvasElement,w:number,h:number,name:string,originalW:number,originalH:number}>}
 */
export async function preparePhoto(file) {
  if (!file) throw new PhotoError("No photo was chosen.");
  const type = (file.type || "").toLowerCase();
  const name = file.name || "photo";
  if (type && !type.startsWith("image/")) throw new PhotoError("That file isn't a photo. Please choose a JPG or PNG image.");
  if (file.size > MAX_FILE_BYTES) throw new PhotoError("That photo is very large (over 30 MB). Please choose a smaller copy.");
  const src = await decode(file);
  const sw = src.naturalWidth || src.width;
  const sh = src.naturalHeight || src.height;
  if (!sw || !sh) throw new PhotoError("This photo has no readable size.");
  const canvas = toCanvas(src, sw, sh);
  return { canvas, w: canvas.width, h: canvas.height, name, originalW: sw, originalH: sh };
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
