// @ts-nocheck -- browser ES module shared with the server (serverlib/wvroofing/compose.js); outside the JSDoc type check.
// WV Roofing Roof Visualiser — the size of the photo sent for a photo-real render,
// and how much the roof mask is grown for it. Pure maths: the server builds the
// actual photo and mask from these (serverlib/wvroofing/compose.js).
import { clamp } from "./mask-ops.js";

export const FIXED_SIZES = [
  [1024, 1024],
  [1536, 1024],
  [1024, 1536],
];
const MIN_PX = 655360;
const TARGET_MAX_PX = 1572864; // ~1536x1024: the cost sweet spot
const HARD_MAX_PX = 2359296;

const round16 = (v) => Math.max(16, Math.round(v / 16) * 16);

/**
 * Pick the canvas size for the AI edit.
 * flex (gpt-image-2 family): keep the photo's own shape, multiples of 16.
 * legacy: nearest fixed size, letterboxed.
 * @returns {{W:number,H:number,mode:"stretch"|"letterbox",rect?:{x:number,y:number,w:number,h:number}}}
 */
export function chooseAiSize(w, h, flex) {
  const ar = w / h;
  if (flex) {
    const A = clamp(w * h, MIN_PX, TARGET_MAX_PX);
    const arc = clamp(ar, 1 / 3, 3);
    let W = round16(Math.sqrt(A * arc));
    let H = round16(Math.sqrt(A / arc));
    let guard = 0;
    while (W * H < MIN_PX && guard++ < 200) {
      W += 16;
      H = round16(W / arc);
    }
    guard = 0;
    while (W * H > HARD_MAX_PX && guard++ < 200) {
      W -= 16;
      H = round16(W / arc);
    }
    // rounding can nudge an extreme shape just past 3:1 - pull it back inside
    if (W / H > 3) W = Math.floor((H * 3) / 16) * 16;
    if (H / W > 3) H = Math.floor((W * 3) / 16) * 16;
    if (Math.abs(arc - ar) < 1e-6) return { W, H, mode: "stretch" };
    // Extreme panoramas: letterbox inside the clamped shape.
    const s = Math.min(W / w, H / h);
    const rw = Math.round(w * s);
    const rh = Math.round(h * s);
    return { W, H, mode: "letterbox", rect: { x: Math.floor((W - rw) / 2), y: Math.floor((H - rh) / 2), w: rw, h: rh } };
  }
  let best = FIXED_SIZES[0];
  let bestErr = Infinity;
  for (const s of FIXED_SIZES) {
    const e = Math.abs(Math.log(ar) - Math.log(s[0] / s[1]));
    if (e < bestErr) {
      bestErr = e;
      best = s;
    }
  }
  const [W, H] = best;
  const sc = Math.min(W / w, H / h);
  const rw = Math.round(w * sc);
  const rh = Math.round(h * sc);
  return { W, H, mode: "letterbox", rect: { x: Math.floor((W - rw) / 2), y: Math.floor((H - rh) / 2), w: rw, h: rh } };
}

/** The mask sent to the model is grown slightly so it redraws the roof edges. */
export function aiMaskDilation(w, h) {
  return Math.max(2, Math.round(0.012 * Math.min(w, h)));
}
