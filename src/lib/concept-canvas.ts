/**
 * In-browser concept renderer — zero infrastructure.
 *
 * Produces a tasteful before/after "extension concept" entirely client-side
 * using the Canvas API. No API keys, no Supabase, no server round-trip — so the
 * visualiser works on any deployment (including static hosting) with nothing to
 * configure. It is an illustrative concept overlay, NOT a photoreal AI render.
 *
 * The real Gemini-backed route (`/api/visualise`) remains available as an
 * optional HD upgrade when API keys + storage are configured.
 */

import { pickNativeSize } from "./visualiser-options";

export type ConceptOpts = {
  projectType: string; // rear | side | wraparound | loft-dormer | general
  storeys: string; // single | two | unsure
  style: string; // modern | warm | rendered | brick | ...
};

const WM = "Concept visualisation by SC Design & Construction · powered by TailoredQuote";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function palette(style: string) {
  switch (style) {
    case "traditional":
    case "warm-contemporary":
    case "warm":
      return {
        wall: "#caa97e",
        frame: "#5a4631",
        glass1: "#e9eef0",
        glass2: "#cdd9dd",
        edge: "#3f3322",
      };
    case "rendered":
      return {
        wall: "#f1efe9",
        frame: "#cfcabd",
        glass1: "#dfe8ec",
        glass2: "#c4d2d8",
        edge: "#b6b1a4",
      };
    case "brick-match":
    case "brick":
      return {
        wall: "#b06a4f",
        frame: "#4a3a30",
        glass1: "#e4ebee",
        glass2: "#c6d4d9",
        edge: "#3a2c24",
      };
    default:
      return {
        wall: "#3c4147",
        frame: "#23272b",
        glass1: "#dfeaf0",
        glass2: "#aebfc9",
        edge: "#1a1d20",
      }; // modern / glass-steel
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function watermark(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const fs = Math.max(12, Math.round(w / 62));
  ctx.font = `600 ${fs}px -apple-system, Arial, sans-serif`;
  const tw = ctx.measureText(WM).width;
  const pad = Math.round(w * 0.018);
  const bw = Math.min(w - pad * 2, tw + pad * 2);
  const bh = fs * 1.9;
  const bx = w - pad - bw;
  const by = h - pad - bh;
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = "#000";
  roundRect(ctx, bx, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(WM, bx + bw - pad, by + bh / 2);
  ctx.restore();
}

function grade(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.globalAlpha = 0.1;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#ffd9a0");
  g.addColorStop(1, "#7a5a32");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawDormer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: ReturnType<typeof palette>
) {
  // Loft dormer sits in the upper third of the frame.
  const dw = w * 0.3;
  const dh = h * 0.2;
  const x0 = w * 0.36;
  const y0 = h * 0.16;
  ctx.fillStyle = p.wall;
  ctx.fillRect(x0, y0, dw, dh);
  ctx.fillStyle = p.edge;
  ctx.fillRect(x0 - 6, y0 - 8, dw + 12, 10);
  // window
  const gx = x0 + dw * 0.12,
    gy = y0 + dh * 0.22,
    gw = dw * 0.76,
    gh = dh * 0.6;
  const glass = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh);
  glass.addColorStop(0, p.glass1);
  glass.addColorStop(1, p.glass2);
  ctx.fillStyle = glass;
  ctx.fillRect(gx, gy, gw, gh);
  ctx.strokeStyle = p.frame;
  ctx.lineWidth = Math.max(2, dw * 0.02);
  ctx.strokeRect(gx, gy, gw, gh);
  ctx.beginPath();
  ctx.moveTo(gx + gw / 2, gy);
  ctx.lineTo(gx + gw / 2, gy + gh);
  ctx.stroke();
}

function drawExtension(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: ConceptOpts,
  p: ReturnType<typeof palette>
) {
  const two = opts.storeys === "two";
  const extH = h * (two ? 0.52 : 0.34);
  const topY = h - extH - h * 0.04;
  const botY = h - h * 0.05;

  let extW: number, x0: number;
  if (opts.projectType === "wraparound") {
    extW = w * 0.8;
    x0 = w * 0.1;
  } else if (opts.projectType === "rear" || opts.projectType === "general") {
    extW = w * 0.74;
    x0 = (w - extW) / 2;
  } else if (opts.projectType === "side") {
    extW = w * 0.46;
    x0 = w * 0.49;
  } else {
    extW = w * 0.5;
    x0 = w * 0.46;
  }
  const x1 = x0 + extW;

  // ground shadow
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(x0 + extW * 0.52, botY + 8, extW * 0.56, h * 0.03, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // wall body
  ctx.fillStyle = p.wall;
  ctx.fillRect(x0, topY, extW, botY - topY);

  // flat-roof fascia
  ctx.fillStyle = p.edge;
  ctx.fillRect(x0, topY, extW, Math.max(8, h * 0.018));

  // glazing
  const gpad = extW * 0.06;
  const gx0 = x0 + gpad;
  const gx1 = x1 - gpad;
  const gTop = topY + extH * (two ? 0.55 : 0.16);
  const gBot = botY - extH * 0.1;
  const glass = ctx.createLinearGradient(gx0, gTop, gx1, gBot);
  glass.addColorStop(0, p.glass1);
  glass.addColorStop(0.55, p.glass2);
  glass.addColorStop(1, p.glass1);
  ctx.fillStyle = glass;
  ctx.fillRect(gx0, gTop, gx1 - gx0, gBot - gTop);

  ctx.strokeStyle = p.frame;
  ctx.lineWidth = Math.max(2, extW * 0.012);
  ctx.strokeRect(gx0, gTop, gx1 - gx0, gBot - gTop);
  const panels = opts.projectType === "wraparound" ? 6 : 4;
  for (let i = 1; i < panels; i++) {
    const mx = gx0 + (gx1 - gx0) * (i / panels);
    ctx.beginPath();
    ctx.moveTo(mx, gTop);
    ctx.lineTo(mx, gBot);
    ctx.stroke();
  }
  const ty = gTop + (gBot - gTop) * 0.32;
  ctx.beginPath();
  ctx.moveTo(gx0, ty);
  ctx.lineTo(gx1, ty);
  ctx.stroke();

  // upper-storey windows for two-storey
  if (two) {
    const uy = topY + extH * 0.12;
    const uh = extH * 0.3;
    for (let i = 0; i < 3; i++) {
      const uw = extW * 0.2;
      const ux = x0 + extW * (0.08 + i * 0.31);
      ctx.fillStyle = glass;
      ctx.fillRect(ux, uy, uw, uh);
      ctx.strokeRect(ux, uy, uw, uh);
    }
  }

  // glass reflection
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(gx0, gTop);
  ctx.lineTo(gx0 + (gx1 - gx0) * 0.4, gTop);
  ctx.lineTo(gx0 + (gx1 - gx0) * 0.18, gBot);
  ctx.lineTo(gx0, gBot);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Cover-fit a source image to a gpt-image-1 native size BEFORE upload.
 *
 * This (a) keeps the payload tiny (~0.3–1 MB JPEG, well under serverless body
 * limits) and (b) makes the input aspect ratio match the model's output size,
 * which prevents the model inventing surrounding space and shrinking the house.
 * The returned `dataUrl` is what we both send to the API AND show as the
 * "before" image, so the side-by-side comparison uses the same crop the model
 * actually saw.
 */
export async function presizeToNative(
  srcUrl: string
): Promise<{ dataUrl: string; size: "1024x1024" | "1536x1024" | "1024x1536"; mime: "image/jpeg" }> {
  const img = await loadImage(srcUrl);
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  const { size, w, h } = pickNativeSize(sw, sh);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // Cover-fit: scale to fill the target, centre, crop the overflow.
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);

  return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), size, mime: "image/jpeg" };
}

/**
 * Composite the SC watermark onto a finished render and return a JPEG data URL.
 * Used at download time for the AI result (the on-screen render is shown clean;
 * the downloaded file carries the watermark).
 */
export async function addWatermark(srcUrl: string): Promise<string> {
  const img = await loadImage(srcUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  watermark(ctx, w, h);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Render before + after as JPEG data URLs. */
export async function renderConcept(
  srcUrl: string,
  opts: ConceptOpts
): Promise<{ before: string; after: string }> {
  const img = await loadImage(srcUrl);
  const maxW = 1280;
  const scale = Math.min(1, maxW / (img.naturalWidth || img.width));
  const w = Math.round((img.naturalWidth || img.width) * scale);
  const h = Math.round((img.naturalHeight || img.height) * scale);

  const beforeCanvas = document.createElement("canvas");
  beforeCanvas.width = w;
  beforeCanvas.height = h;
  const bctx = beforeCanvas.getContext("2d")!;
  bctx.drawImage(img, 0, 0, w, h);

  const afterCanvas = document.createElement("canvas");
  afterCanvas.width = w;
  afterCanvas.height = h;
  const actx = afterCanvas.getContext("2d")!;
  actx.drawImage(img, 0, 0, w, h);

  const p = palette(opts.style);
  if (opts.projectType === "loft-dormer") {
    drawDormer(actx, w, h, p);
  } else {
    drawExtension(actx, w, h, opts, p);
  }
  grade(actx, w, h);
  watermark(actx, w, h);

  return {
    before: beforeCanvas.toDataURL("image/jpeg", 0.92),
    after: afterCanvas.toDataURL("image/jpeg", 0.92),
  };
}
