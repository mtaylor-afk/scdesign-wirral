// WV Roofing Roof Visualiser — labelled, watermarked download copies.

/**
 * Draw a copy of `source` with a discreet label in the bottom-right corner.
 * @param {CanvasImageSource & {width:number,height:number}} source
 * @param {string} label  e.g. "AI concept render - not completed work"
 * @returns {HTMLCanvasElement}
 */
export function watermarked(source, label) {
  const w = source.width;
  const h = source.height;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(source, 0, 0, w, h);
  const s = Math.max(12, Math.round(Math.min(w, h) * 0.022));
  ctx.font = "600 " + s + "px Barlow, 'Segoe UI', system-ui, sans-serif";
  const line1 = "WV Roofing";
  const line2 = label;
  const tw = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width);
  const pad = Math.round(s * 0.7);
  const bw = tw + pad * 2;
  const bh = s * 2.6 + pad;
  const x = w - bw - pad;
  const y = h - bh - pad;
  ctx.fillStyle = "rgba(11, 20, 38, 0.72)";
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, Math.round(s * 0.4));
    ctx.fill();
  } else {
    ctx.fillRect(x, y, bw, bh);
  }
  ctx.fillStyle = "#c9a84c";
  ctx.textBaseline = "top";
  ctx.fillText(line1, x + pad, y + pad * 0.6);
  ctx.fillStyle = "#ffffff";
  ctx.font = "500 " + Math.round(s * 0.85) + "px Barlow, 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(line2, x + pad, y + pad * 0.6 + s * 1.25);
  return c;
}

export function downloadCanvas(canvas, filename) {
  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    },
    "image/jpeg",
    0.9
  );
}
