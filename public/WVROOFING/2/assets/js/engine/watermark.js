// WV Roofing v2 — labelled copies of the Roof Cam's picture, for "Save image".
// A saved picture can travel on without the page around it, so every copy
// carries its own label: that WV Roofing is a concept, what the picture is,
// and, for a sample house, whose stock photo it is.

const MONO = "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace";

// The label is set in IBM Plex Mono, which every page already loads. A canvas
// only draws a web font once it has arrived, so ask for the two weights used
// here straight away, long before anyone saves a picture.
if (typeof document !== "undefined" && document.fonts && typeof document.fonts.load === "function") {
  for (const face of ["600 16px 'IBM Plex Mono'", "500 16px 'IBM Plex Mono'"]) {
    try {
      document.fonts.load(face).catch(() => {});
    } catch (err) {
      /* the fallback face will do */
    }
  }
}

/**
 * Draw a copy of `source` with a discreet label in the bottom-right corner:
 * "WV Roofing · concept", then `label`, then `credit` when one is given.
 * @param {CanvasImageSource & {width:number,height:number}} source
 * @param {string} label  e.g. "Approximate preview, drawn on this device"
 * @param {string} [credit]  e.g. "Photo (stock): Unsplash", for a sample house
 * @returns {HTMLCanvasElement}
 */
export function watermarked(source, label, credit) {
  const w = source.width;
  const h = source.height;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(source, 0, 0, w, h);
  const s = Math.max(12, Math.round(Math.min(w, h) * 0.022));
  const lines = [
    { text: "WV Roofing · concept", font: "600 " + s + "px " + MONO, colour: "#c9a84c" },
    { text: String(label || ""), font: "500 " + Math.round(s * 0.85) + "px " + MONO, colour: "#ffffff" },
  ];
  if (credit) lines.push({ text: String(credit), font: "500 " + Math.round(s * 0.8) + "px " + MONO, colour: "#dfe5ee" });
  let tw = 0;
  for (const line of lines) {
    ctx.font = line.font;
    tw = Math.max(tw, ctx.measureText(line.text).width);
  }
  const pad = Math.round(s * 0.7);
  const pitch = s * 1.25;
  // On a very narrow picture the lines are squeezed rather than cut off.
  const maxText = Math.max(1, w - pad * 4);
  const bw = Math.min(tw, maxText) + pad * 2;
  const bh = s * 2.6 + pad + (lines.length - 2) * pitch;
  const x = w - bw - pad;
  const y = h - bh - pad;
  ctx.fillStyle = "rgba(11, 20, 38, 0.78)";
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, Math.round(s * 0.4));
    ctx.fill();
  } else {
    ctx.fillRect(x, y, bw, bh);
  }
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    ctx.font = line.font;
    ctx.fillStyle = line.colour;
    ctx.fillText(line.text, x + pad, y + pad * 0.6 + i * pitch, maxText);
  });
  return c;
}

/**
 * Save a canvas as a JPEG through a temporary link.
 * @param {HTMLCanvasElement} canvas
 * @param {string} filename
 * @returns {Promise<boolean>} true when the download was started; false when
 *   the picture couldn't be made (toBlob gave nothing) or the download couldn't start
 */
export function downloadCanvas(canvas, filename) {
  return new Promise((resolve) => {
    const save = (blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      let url = "";
      try {
        url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (err) {
        if (url) URL.revokeObjectURL(url);
        resolve(false);
        return;
      }
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      resolve(true);
    };
    try {
      canvas.toBlob(save, "image/jpeg", 0.9);
    } catch (err) {
      resolve(false); // e.g. a canvas with no pixels
    }
  });
}
