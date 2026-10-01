// Rain Later: the WV Roofing Weather Report. Roof Cam forecast share card.
//
// Builds one portrait picture (1080 x 1350) a visitor can send to a friend:
// their house before and after, split along a diagonal cold front, with the
// roof's name in broadcast type underneath. Everything is drawn on a canvas
// on this device: nothing is uploaded and nothing is fetched.
//
// Nothing in here animates, so there is no calm-mode work to do. All of the
// layout maths lives in small pure functions (exported) so it can be tested
// without a browser, and the file only touches the page inside the functions
// that need it, so it can be imported anywhere.

const INK = "#0B1220";
const CREAM = "#F5F0E8";
const AMBER = "#C9A84C";
const RAIN = "#8FD4F4";
const MUTED = "#A9B4C8";
const FRONT_SHADOW = "rgba(11, 18, 32, 0.35)";

const HEADLINE_STACK = "'Big Shoulders Display', Impact, 'Arial Narrow', sans-serif";
const MONO_STACK = "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace";
const SMALL_PRINT = "WV ROOFING \u00B7 CONCEPT \u00B7 APPROXIMATE PREVIEW \u00B7 DRAWN ON THIS DEVICE";
const FONT_TIMEOUT_MS = 1500;

const LINE_HEIGHT = 0.9; // headline line pitch, as a share of the type size
const HEADLINE_CAP = 0.72; // capital height of the headline face when it cannot be measured
const MONO_CAP = 0.7; // capital height of the mono face, as a share of the type size
const TRACKING = 0.08; // mono letter-spacing, in em
const EYEBROW_PX = 24;
const COLOUR_PX = 30;
const SMALL_PX = 20;
const SMALL_PITCH = 28;
const CHIP_PX = 22;
const CHIP_HEIGHT = 46;
const CHIP_INSET = 28;
const CHIP_BAR = 6;
const CHIP_PAD = 14;
const TOP_PAD = 28; // amber rule to the top of the eyebrow
const GAP = 20; // eyebrow to headline, headline to colour name
const GAP_SMALL = 22; // colour name to small print, at the very least
const CHEVRON_WIDTH = 64;
const CHEVRON_STROKE = 8;
const CHEVRON_RISE = 22;
const CHEVRON_GAP = 24;

/** The card's fixed measurements, in card pixels. */
export const CARD = Object.freeze({
  width: 1080,
  height: 1350,
  pictureHeight: 1000,
  lowerHeight: 350,
  padX: 64,
  padBottom: 40,
  rule: 6,
  lean: 12,
  lineWidth: 5,
  toothSpacing: 72,
  toothBase: 30,
  toothHeight: 22,
  headlineStart: 128,
  headlineMin: 40,
  headlineStep: 4,
  filename: "wv-roof-cam.jpg",
});

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), Math.max(low, high));
}

function capOrDefault(capRatio) {
  return Number.isFinite(capRatio) && capRatio > 0 ? clamp(capRatio, 0.55, 0.9) : HEADLINE_CAP;
}

/**
 * Which part of a picture to draw so it covers a box without stretching.
 * The crop is centred on `focus` when given (source pixels) and always stays
 * inside the picture.
 * @param {number} srcW picture width
 * @param {number} srcH picture height
 * @param {number} dstW box width
 * @param {number} dstH box height
 * @param {{x:number,y:number}} [focus] point to keep in the middle, in source pixels
 * @returns {{sx:number,sy:number,sw:number,sh:number}} source rectangle for drawImage
 */
export function coverCrop(srcW, srcH, dstW, dstH, focus) {
  if (!(srcW > 0) || !(srcH > 0) || !(dstW > 0) || !(dstH > 0)) {
    return { sx: 0, sy: 0, sw: srcW > 0 ? srcW : 0, sh: srcH > 0 ? srcH : 0 };
  }
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const sw = Math.min(srcW, dstW / scale);
  const sh = Math.min(srcH, dstH / scale);
  const fx = focus && Number.isFinite(focus.x) ? focus.x : srcW / 2;
  const fy = focus && Number.isFinite(focus.y) ? focus.y : srcH / 2;
  return {
    sx: clamp(fx - sw / 2, 0, srcW - sw),
    sy: clamp(fy - sh / 2, 0, srcH - sh),
    sw,
    sh,
  };
}

/**
 * The cold front: a line through the middle of a box, leaning from vertical
 * with its top to the right of centre and its bottom to the left, plus the
 * teeth that sit on it and point at the AFTER (right-hand) side.
 * @param {number} width box width
 * @param {number} height box height
 * @param {number} [leanDeg] lean from vertical in degrees (default 12)
 * @param {number} [spacing] distance between teeth along the line (default 72)
 * @param {number} [toothBase] length of a tooth's base on the line (default 30)
 * @param {number} [toothHeight] height of a tooth (default 22)
 * @returns {{
 *   top:{x:number,y:number}, bottom:{x:number,y:number}, centre:{x:number,y:number},
 *   dir:{x:number,y:number}, normal:{x:number,y:number}, length:number,
 *   teeth:Array<{a:{x:number,y:number},b:{x:number,y:number},tip:{x:number,y:number}}>,
 *   beforeClip:Array<{x:number,y:number}>
 * }} `dir` runs top to bottom, `normal` points at the AFTER side, `beforeClip`
 *   is the outline of everything left of the line
 */
export function frontLine(width, height, leanDeg, spacing, toothBase, toothHeight) {
  const lean = ((Number.isFinite(leanDeg) ? leanDeg : CARD.lean) * Math.PI) / 180;
  const gap = spacing > 0 ? spacing : CARD.toothSpacing;
  const base = toothBase > 0 ? toothBase : CARD.toothBase;
  const tall = toothHeight > 0 ? toothHeight : CARD.toothHeight;
  const shift = (height / 2) * Math.tan(lean);
  const top = { x: width / 2 + shift, y: 0 };
  const bottom = { x: width / 2 - shift, y: height };
  const dir = { x: -Math.sin(lean), y: Math.cos(lean) };
  const normal = { x: Math.cos(lean), y: Math.sin(lean) };
  const length = height / Math.cos(lean);
  const count = length >= base ? Math.floor((length - base) / gap) + 1 : 0;
  const first = (length - (count - 1) * gap) / 2;
  const teeth = [];
  for (let i = 0; i < count; i++) {
    const along = first + i * gap;
    const mx = top.x + dir.x * along;
    const my = top.y + dir.y * along;
    teeth.push({
      a: { x: mx - (dir.x * base) / 2, y: my - (dir.y * base) / 2 },
      b: { x: mx + (dir.x * base) / 2, y: my + (dir.y * base) / 2 },
      tip: { x: mx + normal.x * tall, y: my + normal.y * tall },
    });
  }
  return {
    top,
    bottom,
    centre: { x: width / 2, y: height / 2 },
    dir,
    normal,
    length,
    teeth,
    beforeClip: [{ x: 0, y: 0 }, top, bottom, { x: 0, y: height }],
  };
}

/**
 * Turn a caller's start and minimum type sizes into a safe pair of positive,
 * finite numbers, so the fitting loops can never stall on a NaN, an omitted
 * argument or a zero size (which would "fit" the text at 0 px).
 * @param {*} startPx first (largest) size asked for
 * @param {*} minPx last (smallest) size asked for
 * @returns {{start:number, low:number}} `low` is never above `start`
 */
export function sizeRange(startPx, minPx) {
  const start = Number.isFinite(startPx) && startPx > 0 ? startPx : CARD.headlineStart;
  const floor = Number.isFinite(minPx) && minPx > 0 ? minPx : Math.min(start, CARD.headlineMin);
  return { start, low: Math.min(start, floor) };
}

function evenSplit(measure, words, px) {
  let best = null;
  for (let k = 1; k < words.length; k++) {
    const first = words.slice(0, k).join(" ");
    const second = words.slice(k).join(" ");
    const widest = Math.max(measure(first, px), measure(second, px));
    if (best === null || widest < best.widest) best = { lines: [first, second], widest };
  }
  return best;
}

/**
 * Pick the biggest type size at which a headline fits the width in at most
 * two lines, wrapping on spaces. Starts at `startPx` and shrinks in steps.
 * One line is preferred over two at the same size, and a two-line split is
 * the most even one. If nothing fits even at `minPx` the result has
 * `fits: false` and the caller should squeeze each line to the width.
 * @param {(line:string, px:number) => number} measure width of `line` set at `px`
 * @param {string} text the headline
 * @param {number} maxWidth widest a line may be
 * @param {number} [startPx] first (largest) size to try; anything that is not
 *   a positive finite number falls back to 128
 * @param {number} [minPx] last (smallest) size to try; anything that is not a
 *   positive finite number falls back to 40 (or `startPx` if that is smaller)
 * @param {{step?:number, maxTwoLinePx?:number}} [options] `step` is the shrink
 *   step (default 4); `maxTwoLinePx` is the largest size at which two lines
 *   are allowed (default: no limit), for when height is tight
 * @returns {{px:number, lines:string[], fits:boolean}}
 */
export function fitHeadline(measure, text, maxWidth, startPx, minPx, options) {
  const step = options && Number.isFinite(options.step) && options.step > 0 ? options.step : CARD.headlineStep;
  const twoLineMax = options && options.maxTwoLinePx > 0 ? options.maxTwoLinePx : Infinity;
  const clean = String(text === null || text === undefined ? "" : text)
    .replace(/\s+/g, " ")
    .trim();
  const sizes = sizeRange(startPx, minPx);
  const low = sizes.low;
  if (!clean) return { px: sizes.start, lines: [], fits: true };
  const words = clean.split(" ");
  let px = sizes.start;
  for (;;) {
    if (measure(clean, px) <= maxWidth) return { px, lines: [clean], fits: true };
    if (words.length > 1 && px <= twoLineMax) {
      const split = evenSplit(measure, words, px);
      if (split.widest <= maxWidth) return { px, lines: split.lines, fits: true };
    }
    // Written so a NaN can never keep the loop alive: !(NaN > low) is true.
    if (!(px > low)) break;
    px = Math.max(low, px - step);
  }
  if (words.length > 1 && low <= twoLineMax) {
    return { px: low, lines: evenSplit(measure, words, low).lines, fits: false };
  }
  return { px: low, lines: [clean], fits: false };
}

/**
 * Pick the biggest type size (whole pixels, from `startPx` down to `minPx`)
 * at which one line of text fits the width.
 * @param {(line:string, px:number) => number} measure width of `line` set at `px`
 * @param {string} text the line
 * @param {number} maxWidth widest the line may be
 * @param {number} [startPx] first (largest) size to try (falls back as in fitHeadline)
 * @param {number} [minPx] last (smallest) size to try (falls back as in fitHeadline)
 * @returns {{px:number, fits:boolean}}
 */
export function fitLine(measure, text, maxWidth, startPx, minPx) {
  const sizes = sizeRange(startPx, minPx);
  const low = sizes.low;
  for (let px = sizes.start; px > low; px -= 1) {
    if (measure(text, px) <= maxWidth) return { px, fits: true };
  }
  return { px: low, fits: measure(text, low) <= maxWidth };
}

/**
 * Tidy a label before it goes on the card: one line, trimmed, capped in
 * length, and with anything that looks like a price or a phone number taken
 * out, because the card must never carry either.
 * @param {*} text the label
 * @param {number} [maxLength] longest label kept (default 60 characters)
 * @returns {string}
 */
export function cleanLabel(text, maxLength) {
  const limit = maxLength > 0 ? maxLength : 60;
  let out = String(text === null || text === undefined ? "" : text);
  out = out.replace(/[\u00A3\u20AC$]\s*\d[\d,.]*\s*(?:k|m|bn)?\b/gi, " ");
  out = out.replace(/\b\d[\d,.]*\s*(?:gbp|pounds?|quid|eur|euros?|usd|dollars?)\b/gi, " ");
  out = out.replace(/\+?\d(?:[\s().-]*\d){8,}/g, " ");
  out = out.replace(/[\u00A3\u20AC$]/g, " ");
  out = out.replace(/\s+/g, " ").trim();
  if (out.length > limit) out = out.slice(0, limit).trim();
  return out;
}

function smallPrintBaselines(hasCredit) {
  const last = CARD.height - CARD.padBottom;
  return hasCredit ? [last - SMALL_PITCH, last] : [last];
}

function eyebrowBaseline() {
  return CARD.pictureHeight + CARD.rule + TOP_PAD + Math.round(EYEBROW_PX * MONO_CAP);
}

/**
 * How much height the lower third leaves for the headline, and so how big
 * the type may be on one line and on two.
 * @param {number} capRatio capital height of the headline face, as a share of its size
 * @param {boolean} hasCredit whether the small print has a second (credit) line
 * @returns {{top:number, bottom:number, height:number, oneLineMaxPx:number, twoLineMaxPx:number}}
 *   `top` is where the first line's capitals start, `bottom` the lowest the
 *   last baseline may sit
 */
export function headlineRoom(capRatio, hasCredit) {
  const cap = capOrDefault(capRatio);
  const top = eyebrowBaseline() + GAP;
  const smallTop = smallPrintBaselines(hasCredit)[0] - Math.round(SMALL_PX * MONO_CAP);
  const bottom = smallTop - GAP_SMALL - Math.round(COLOUR_PX * MONO_CAP) - GAP;
  const height = bottom - top;
  return {
    top,
    bottom,
    height,
    oneLineMaxPx: Math.floor(height / cap),
    twoLineMaxPx: Math.floor(height / (cap + LINE_HEIGHT)),
  };
}

/**
 * Where everything in the lower third sits (baselines are in card pixels).
 * @param {number} lineCount headline lines: 0, 1 or 2
 * @param {number} headlinePx headline type size
 * @param {number} capRatio capital height of the headline face, as a share of its size
 * @param {boolean} hasCredit whether the small print has a second (credit) line
 * @returns {{
 *   left:number, maxWidth:number, eyebrowBaseline:number, headlineBaselines:number[],
 *   colourBaseline:number, smallBaselines:number[], smallMaxWidth:number,
 *   chevron:{left:{x:number,y:number}, apex:{x:number,y:number}, right:{x:number,y:number}, stroke:number}
 * }}
 */
export function lowerThirdLayout(lineCount, headlinePx, capRatio, hasCredit) {
  const cap = capOrDefault(capRatio);
  const room = headlineRoom(cap, hasCredit);
  const eyebrow = eyebrowBaseline();
  const headlineBaselines = [];
  for (let i = 0; i < lineCount; i++) {
    headlineBaselines.push(Math.round(room.top + cap * headlinePx + i * LINE_HEIGHT * headlinePx));
  }
  const above = lineCount > 0 ? headlineBaselines[lineCount - 1] : eyebrow;
  const maxWidth = CARD.width - CARD.padX * 2;
  const chevronRight = CARD.width - CARD.padX - CHEVRON_STROKE / 2;
  const chevronLeft = chevronRight - (CHEVRON_WIDTH - CHEVRON_STROKE);
  const chevronBase = CARD.height - CARD.padBottom - CHEVRON_STROKE / 2;
  return {
    left: CARD.padX,
    maxWidth,
    eyebrowBaseline: eyebrow,
    headlineBaselines,
    colourBaseline: above + GAP + Math.round(COLOUR_PX * MONO_CAP),
    smallBaselines: smallPrintBaselines(hasCredit),
    smallMaxWidth: maxWidth - CHEVRON_WIDTH - CHEVRON_GAP,
    chevron: {
      left: { x: chevronLeft, y: chevronBase },
      apex: { x: (chevronLeft + chevronRight) / 2, y: chevronBase - CHEVRON_RISE },
      right: { x: chevronRight, y: chevronBase },
      stroke: CHEVRON_STROKE,
    },
  };
}

/**
 * The box for a BEFORE / AFTER label chip in the picture area.
 * @param {number} textWidth measured width of the label
 * @param {"left"|"right"} side which top corner the chip sits in
 * @returns {{x:number, y:number, w:number, h:number, bar:number, textX:number, baseline:number}}
 */
export function chipBox(textWidth, side) {
  const w = Math.ceil(CHIP_BAR + CHIP_PAD + textWidth + CHIP_PAD);
  const x = side === "right" ? CARD.width - CHIP_INSET - w : CHIP_INSET;
  const y = CHIP_INSET;
  return {
    x,
    y,
    w,
    h: CHIP_HEIGHT,
    bar: CHIP_BAR,
    textX: x + CHIP_BAR + CHIP_PAD,
    baseline: y + Math.round((CHIP_HEIGHT + CHIP_PX * MONO_CAP) / 2),
  };
}

/**
 * The words that go on the card, tidied and in capitals.
 * @param {{finishName?:string, colourName?:string, conditionName?:string, credit?:string}} opts
 * @returns {{eyebrow:string, finish:string, colour:string, small:string, credit:string}}
 */
export function cardText(opts) {
  const o = opts || {};
  const condition = cleanLabel(o.conditionName, 28).toUpperCase();
  return {
    eyebrow: condition ? "ROOF CAM \u00B7 " + condition : "ROOF CAM",
    finish: cleanLabel(o.finishName, 60).toUpperCase(),
    colour: cleanLabel(o.colourName, 40).toUpperCase(),
    small: SMALL_PRINT,
    credit: cleanLabel(o.credit, 64).toUpperCase(),
  };
}

function headlineFont(px) {
  return "900 " + px + "px " + HEADLINE_STACK;
}

function monoFont(weight, px) {
  return weight + " " + px + "px " + MONO_STACK;
}

function setTracking(ctx, px) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = px.toFixed(2) + "px";
}

function setMono(ctx, weight, px) {
  ctx.font = monoFont(weight, px);
  setTracking(ctx, px * TRACKING);
}

function setHeadline(ctx, px) {
  ctx.font = headlineFont(px);
  setTracking(ctx, 0);
}

function settleWithin(promise, ms) {
  return new Promise((resolve) => {
    let timer = 0;
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    timer = setTimeout(finish, ms);
    Promise.resolve(promise).then(finish, finish);
  });
}

async function loadFonts(text) {
  if (typeof document === "undefined" || !document.fonts || typeof document.fonts.load !== "function") return;
  const mono = [text.eyebrow, text.colour, text.small, text.credit, "BEFORE AFTER"].join(" ");
  const faces = [
    ["900 96px \"Big Shoulders Display\"", text.finish || "ROOF"],
    ["500 24px \"IBM Plex Mono\"", mono],
    ["600 30px \"IBM Plex Mono\"", mono],
    ["400 20px \"IBM Plex Mono\"", mono],
  ];
  const waits = [];
  for (const face of faces) {
    try {
      waits.push(settleWithin(document.fonts.load(face[0], face[1]), FONT_TIMEOUT_MS));
    } catch (err) {
      /* the fallback faces will do */
    }
  }
  await Promise.all(waits);
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("The picture could not be saved on this device."));
        },
        type,
        quality
      );
    } catch (err) {
      reject(err);
    }
  });
}

function drawPicture(ctx, before, after, srcW, srcH, focus) {
  const w = CARD.width;
  const h = CARD.pictureHeight;
  const crop = coverCrop(srcW, srcH, w, h, focus);
  const front = frontLine(w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(after, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(front.beforeClip[0].x, front.beforeClip[0].y);
  for (let i = 1; i < front.beforeClip.length; i++) ctx.lineTo(front.beforeClip[i].x, front.beforeClip[i].y);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(before, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h);
  ctx.restore();
  return front;
}

function traceFront(ctx, front) {
  const over = 12; // run past both edges so the clipped ends are square to the picture
  ctx.beginPath();
  ctx.moveTo(front.top.x - front.dir.x * over, front.top.y - front.dir.y * over);
  ctx.lineTo(front.bottom.x + front.dir.x * over, front.bottom.y + front.dir.y * over);
}

function traceTeeth(ctx, front) {
  ctx.beginPath();
  for (const tooth of front.teeth) {
    ctx.moveTo(tooth.a.x, tooth.a.y);
    ctx.lineTo(tooth.tip.x, tooth.tip.y);
    ctx.lineTo(tooth.b.x, tooth.b.y);
    ctx.closePath();
  }
}

function drawFront(ctx, front) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CARD.width, CARD.pictureHeight);
  ctx.clip();
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  // A soft ink edge first, so the front still reads against a pale sky.
  ctx.strokeStyle = FRONT_SHADOW;
  ctx.lineWidth = 4;
  traceTeeth(ctx, front);
  ctx.stroke();
  ctx.lineWidth = CARD.lineWidth + 4;
  traceFront(ctx, front);
  ctx.stroke();
  ctx.fillStyle = AMBER;
  traceTeeth(ctx, front);
  ctx.fill();
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = CARD.lineWidth;
  traceFront(ctx, front);
  ctx.stroke();
  ctx.restore();
}

function drawChip(ctx, label, side) {
  setMono(ctx, 500, CHIP_PX);
  const box = chipBox(ctx.measureText(label).width, side);
  ctx.fillStyle = INK;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = AMBER;
  ctx.fillRect(box.x, box.y, box.bar, box.h);
  ctx.fillStyle = CREAM;
  ctx.fillText(label, box.textX, box.baseline);
}

function drawMonoLine(ctx, line, x, baseline, weight, startPx, minPx, maxWidth, colour) {
  if (!line) return;
  const measure = (words, px) => {
    setMono(ctx, weight, px);
    return ctx.measureText(words).width;
  };
  const fit = fitLine(measure, line, maxWidth, startPx, minPx);
  setMono(ctx, weight, fit.px);
  ctx.fillStyle = colour;
  if (fit.fits) ctx.fillText(line, x, baseline);
  else ctx.fillText(line, x, baseline, maxWidth);
}

function headlineCapRatio(ctx) {
  setHeadline(ctx, 100);
  const metrics = ctx.measureText("H");
  const rise = metrics ? metrics.actualBoundingBoxAscent : 0;
  return capOrDefault(rise / 100);
}

function drawLowerThird(ctx, text) {
  const hasCredit = Boolean(text.credit);
  ctx.fillStyle = INK;
  ctx.fillRect(0, CARD.pictureHeight, CARD.width, CARD.lowerHeight);
  ctx.fillStyle = AMBER;
  ctx.fillRect(0, CARD.pictureHeight, CARD.width, CARD.rule);

  const cap = headlineCapRatio(ctx);
  const room = headlineRoom(cap, hasCredit);
  const measure = (line, px) => {
    setHeadline(ctx, px);
    return ctx.measureText(line).width;
  };
  const maxWidth = CARD.width - CARD.padX * 2;
  const startPx = Math.min(CARD.headlineStart, room.oneLineMaxPx);
  const fit = fitHeadline(measure, text.finish, maxWidth, startPx, CARD.headlineMin, {
    step: CARD.headlineStep,
    maxTwoLinePx: room.twoLineMaxPx,
  });
  const at = lowerThirdLayout(fit.lines.length, fit.px, cap, hasCredit);

  drawMonoLine(ctx, text.eyebrow, at.left, at.eyebrowBaseline, 500, EYEBROW_PX, 16, at.maxWidth, RAIN);

  setHeadline(ctx, fit.px);
  ctx.fillStyle = CREAM;
  for (let i = 0; i < fit.lines.length; i++) {
    if (fit.fits) ctx.fillText(fit.lines[i], at.left, at.headlineBaselines[i]);
    else ctx.fillText(fit.lines[i], at.left, at.headlineBaselines[i], at.maxWidth);
  }

  drawMonoLine(ctx, text.colour, at.left, at.colourBaseline, 600, COLOUR_PX, 18, at.maxWidth, AMBER);
  drawMonoLine(ctx, text.small, at.left, at.smallBaselines[0], 400, SMALL_PX, 14, at.smallMaxWidth, MUTED);
  if (hasCredit) {
    drawMonoLine(ctx, text.credit, at.left, at.smallBaselines[1], 400, SMALL_PX, 14, at.smallMaxWidth, MUTED);
  }

  ctx.beginPath();
  ctx.moveTo(at.chevron.left.x, at.chevron.left.y);
  ctx.lineTo(at.chevron.apex.x, at.chevron.apex.y);
  ctx.lineTo(at.chevron.right.x, at.chevron.right.y);
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = at.chevron.stroke;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

/**
 * Draw the forecast share card: before and after either side of a diagonal
 * cold front, with the roof's name underneath, at 1080 x 1350, saved as a
 * JPEG. The two pictures are copied onto the card at once, before anything
 * is awaited, so the card shows exactly what they held at the moment of the
 * call even if the page redraws them a moment later. Only then does it wait
 * (briefly) for the broadcast fonts and set the words.
 * @param {{
 *   before: CanvasImageSource, after: CanvasImageSource,
 *   width: number, height: number,
 *   finishName: string, colourName: string, conditionName: string,
 *   credit?: string, focus?: {x:number, y:number}
 * }} opts `before` and `after` are the same pixel size (`width` x `height`);
 *   `credit` is for a sample house and is left out for the visitor's own
 *   photo; `focus` is the centre of the roof in source pixels
 * @returns {Promise<{canvas: HTMLCanvasElement, blob: Blob, file: File}>} the
 *   blob is image/jpeg at quality 0.9 and the file is "wv-roof-cam.jpg"
 */
export async function buildShareCard(opts) {
  const o = opts || {};
  const srcW = Number(o.width);
  const srcH = Number(o.height);
  if (!o.before || !o.after) throw new TypeError("The share card needs a before and an after picture.");
  if (!(srcW > 0) || !(srcH > 0)) throw new TypeError("The share card needs the size of the pictures.");

  const text = cardText(o);

  const canvas = document.createElement("canvas");
  canvas.width = CARD.width;
  canvas.height = CARD.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("This device could not open a drawing surface.");
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, CARD.width, CARD.height);

  // The pictures first, with nothing awaited before them (see above).
  const front = drawPicture(ctx, o.before, o.after, srcW, srcH, o.focus);
  drawFront(ctx, front);

  await loadFonts(text);
  drawChip(ctx, "BEFORE", "left");
  drawChip(ctx, "AFTER", "right");
  drawLowerThird(ctx, text);

  const blob = await canvasToBlob(canvas, "image/jpeg", 0.9);
  const file = new File([blob], CARD.filename, { type: "image/jpeg", lastModified: Date.now() });
  return { canvas, blob, file };
}

/**
 * Whether this device can hand the file to its share sheet.
 * @param {File} file
 * @returns {boolean}
 */
export function canShareFile(file) {
  if (!file || typeof navigator === "undefined") return false;
  if (typeof navigator.canShare !== "function" || typeof navigator.share !== "function") return false;
  try {
    return navigator.canShare({ files: [file] }) === true;
  } catch (err) {
    return false;
  }
}

/**
 * Open the device's share sheet with the file. Call this straight from the
 * tap: nothing is awaited before navigator.share, so the tap still counts.
 * @param {File} file
 * @param {{title?: string, text?: string}} [data]
 * @returns {Promise<"shared"|"cancelled"|"unsupported"|"failed">}
 */
export async function shareFile(file, data) {
  if (!canShareFile(file)) return "unsupported";
  const payload = { files: [file] };
  if (data && typeof data.title === "string" && data.title) payload.title = data.title;
  if (data && typeof data.text === "string" && data.text) payload.text = data.text;
  let accepted = false;
  try {
    accepted = navigator.canShare(payload) === true;
  } catch (err) {
    accepted = false;
  }
  let pending = null;
  try {
    pending = navigator.share(accepted ? payload : { files: [file] });
  } catch (err) {
    return "failed";
  }
  try {
    await pending;
    return "shared";
  } catch (err) {
    return err && err.name === "AbortError" ? "cancelled" : "failed";
  }
}

/**
 * Save a blob to the device through a temporary link.
 * @param {Blob} blob
 * @param {string} filename
 * @returns {boolean} true when the download was started
 */
export function downloadBlob(blob, filename) {
  if (!blob || typeof document === "undefined" || typeof URL === "undefined") return false;
  let url = "";
  try {
    url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || CARD.filename;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    if (url) URL.revokeObjectURL(url);
    return false;
  }
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

/**
 * Copy the card to the clipboard as a PNG.
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<boolean>} true when the picture was copied; never throws
 */
export async function copyImage(canvas) {
  try {
    if (!canvas || typeof navigator === "undefined" || typeof ClipboardItem === "undefined") return false;
    if (!navigator.clipboard || typeof navigator.clipboard.write !== "function") return false;
    const png = canvasToBlob(canvas, "image/png");
    png.catch(() => {});
    let item = null;
    try {
      // Handing over the promise keeps the write inside the tap (Safari needs that).
      item = new ClipboardItem({ "image/png": png });
    } catch (err) {
      item = new ClipboardItem({ "image/png": await png });
    }
    await navigator.clipboard.write([item]);
    return true;
  } catch (err) {
    return false;
  }
}
