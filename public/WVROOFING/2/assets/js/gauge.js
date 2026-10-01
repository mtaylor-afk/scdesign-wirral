// Rain Later (WV Roofing v2): gauge.
// A barometer dial drawn as inline SVG. The station bar uses a small one as
// its scroll indicator and the Roof Cam uses a large one for render progress.
// The needle swings with a CSS transition and sits still when the page is calm.

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

const SWEEP_FROM = -120;
const SWEEP_TO = 120;
const DIVISIONS = 24;
const ZONE_GAP = 1;

const FRONT_RED = "#E2503F";
const AMBER = "#C9A84C";
const CLEAR_GREEN = "#3FB27F";

const NEEDLE_CLASS = "wvr2-gauge-needle";
const NEEDLE_STYLE =
  "transform: rotate(var(--needle, -120deg)); transform-origin: 50px 50px; " +
  "transition: transform 700ms cubic-bezier(0.34, 1.56, 0.64, 1)";
// The needle's transition is an inline style, so the calm rule needs !important.
const CALM_CSS = "html[data-calm] ." + NEEDLE_CLASS + " { transition: none !important; }";

const ZONES = [
  { word: "STORMY", from: -120, to: -40, colour: FRONT_RED },
  { word: "CHANGE", from: -40, to: 40, colour: AMBER },
  { word: "FAIR", from: 40, to: 120, colour: CLEAR_GREEN },
];

// All radii and widths are in viewBox units (the dial is 100 across). The
// small dial is drawn heavier so it still reads at the size of a toolbar icon.
const LAYOUTS = {
  small: {
    arcR: 44,
    arcW: 4,
    tickOuter: 38.5,
    tickShort: 34,
    tickLong: 29.5,
    tickShortW: 1.5,
    tickLongW: 2.2,
    needleTip: 39,
    needleHalf: 2.8,
    needleTail: 8,
    hubR: 5,
    pinR: 1.7,
    textR: 0,
  },
  large: {
    arcR: 46,
    arcW: 1.6,
    tickOuter: 43,
    tickShort: 40.5,
    tickLong: 37.5,
    tickShortW: 0.6,
    tickLongW: 0.9,
    needleTip: 41,
    needleHalf: 1.5,
    needleTail: 6,
    hubR: 3.2,
    pinR: 1,
    textR: 29.5,
  },
};

let serial = 0;

// Dial angles: 0 is straight up, positive is clockwise.
function dialX(deg, r) {
  return 50 + r * Math.sin((deg * Math.PI) / 180);
}

function dialY(deg, r) {
  return 50 - r * Math.cos((deg * Math.PI) / 180);
}

function num(n) {
  return String(Math.round(n * 100) / 100);
}

function arcPath(r, from, to) {
  return (
    "M" +
    num(dialX(from, r)) +
    " " +
    num(dialY(from, r)) +
    " A" +
    num(r) +
    " " +
    num(r) +
    " 0 " +
    (to - from > 180 ? "1" : "0") +
    " 1 " +
    num(dialX(to, r)) +
    " " +
    num(dialY(to, r))
  );
}

function tickPath(layout, long) {
  let d = "";
  for (let i = 0; i <= DIVISIONS; i++) {
    if ((i % 4 === 0) !== long) continue;
    const deg = SWEEP_FROM + ((SWEEP_TO - SWEEP_FROM) * i) / DIVISIONS;
    const inner = long ? layout.tickLong : layout.tickShort;
    d +=
      (d ? " " : "") +
      "M" +
      num(dialX(deg, layout.tickOuter)) +
      " " +
      num(dialY(deg, layout.tickOuter)) +
      " L" +
      num(dialX(deg, inner)) +
      " " +
      num(dialY(deg, inner));
  }
  return d;
}

function svgNode(doc, name, attrs) {
  const node = doc.createElementNS(SVG_NS, name);
  if (attrs) {
    for (const key in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, key)) node.setAttribute(key, attrs[key]);
    }
  }
  return node;
}

function zoneName(v) {
  if (v < 0.34) return "Stormy";
  if (v < 0.67) return "Change";
  return "Fair";
}

/**
 * Build a barometer dial inside `el` (whatever was in there is replaced).
 * The drawing is an aria-hidden inline SVG; `el` itself becomes the meter
 * (role="meter", aria-label, aria-valuemin 0, aria-valuemax 100). The dial
 * sweeps 240 degrees, from -120 (stormy) through 0 (straight up) to +120
 * (fair). Scale marks and lettering use currentColor, so the page themes the
 * dial by setting `color` on `el`.
 * @param {HTMLElement} el the element to fill
 * @param {{ label: string, size?: "small" | "large" }} opts label is the
 *   accessible name; size "large" also writes STORMY, CHANGE and FAIR along
 *   the arc (default "small")
 * @returns {{ set: (value: number, text?: string) => void }} set() moves the
 *   needle: value runs 0..1 (clamped); text, when given, is what screen
 *   readers announce instead of "Stormy" / "Change" / "Fair"
 */
export function mountGauge(el, opts) {
  const o = opts || {};
  const size = o.size === "large" ? "large" : "small";
  const label = typeof o.label === "string" && o.label.trim() !== "" ? o.label : "Barometer";
  const layout = LAYOUTS[size];
  const doc = el.ownerDocument;
  serial += 1;

  const svg = svgNode(doc, "svg", {
    class: "wvr2-gauge wvr2-gauge--" + size,
    viewBox: "0 0 100 100",
    width: "100%",
    height: "100%",
    fill: "none",
    focusable: "false",
    "aria-hidden": "true",
  });

  const style = svgNode(doc, "style");
  style.textContent = CALM_CSS;
  svg.appendChild(style);

  // The three weather zones.
  for (let i = 0; i < ZONES.length; i++) {
    const zone = ZONES[i];
    const from = i === 0 ? zone.from : zone.from + ZONE_GAP;
    const to = i === ZONES.length - 1 ? zone.to : zone.to - ZONE_GAP;
    svg.appendChild(
      svgNode(doc, "path", {
        d: arcPath(layout.arcR, from, to),
        stroke: zone.colour,
        "stroke-width": num(layout.arcW),
      })
    );
  }

  // The scale: a mark every 10 degrees, every fourth one longer.
  svg.appendChild(
    svgNode(doc, "path", {
      d: tickPath(layout, false),
      stroke: "currentColor",
      "stroke-width": num(layout.tickShortW),
      "stroke-opacity": "0.55",
    })
  );
  svg.appendChild(
    svgNode(doc, "path", {
      d: tickPath(layout, true),
      stroke: "currentColor",
      "stroke-width": num(layout.tickLongW),
    })
  );

  if (size === "large") {
    const defs = svgNode(doc, "defs");
    const words = svgNode(doc, "text", {
      "font-family": '"IBM Plex Mono", monospace',
      "font-size": "7",
      "font-weight": "500",
      "letter-spacing": "0.08em",
      "text-anchor": "middle",
      fill: "currentColor",
    });
    for (let i = 0; i < ZONES.length; i++) {
      const zone = ZONES[i];
      const id = "wvr2-gauge-" + serial + "-" + zone.word.toLowerCase();
      defs.appendChild(
        svgNode(doc, "path", { id, d: arcPath(layout.textR, zone.from + 2, zone.to - 2) })
      );
      const run = svgNode(doc, "textPath", { href: "#" + id, startOffset: "50%" });
      run.setAttributeNS(XLINK_NS, "xlink:href", "#" + id);
      run.textContent = zone.word;
      words.appendChild(run);
    }
    svg.appendChild(defs);
    svg.appendChild(words);
  }

  // The needle is drawn pointing straight up and turned by --needle.
  const needle = svgNode(doc, "g", { class: NEEDLE_CLASS, style: NEEDLE_STYLE });
  needle.appendChild(
    svgNode(doc, "polygon", {
      points:
        "50," +
        num(50 - layout.needleTip) +
        " " +
        num(50 + layout.needleHalf) +
        ",50 50," +
        num(50 + layout.needleTail) +
        " " +
        num(50 - layout.needleHalf) +
        ",50",
      fill: AMBER,
    })
  );
  needle.appendChild(
    svgNode(doc, "circle", { cx: "50", cy: "50", r: num(layout.hubR), fill: AMBER })
  );
  needle.appendChild(
    svgNode(doc, "circle", { cx: "50", cy: "50", r: num(layout.pinR), fill: "currentColor" })
  );
  svg.appendChild(needle);

  while (el.firstChild) el.removeChild(el.firstChild);
  el.appendChild(svg);

  el.setAttribute("role", "meter");
  el.setAttribute("aria-label", label);
  el.setAttribute("aria-valuemin", "0");
  el.setAttribute("aria-valuemax", "100");

  // Remember what was last written so a scroll handler can call set() every
  // frame without touching the DOM when nothing has changed.
  let lastTenths = NaN;
  let lastNow = -1;
  let lastText = null;

  /**
   * Move the needle.
   * @param {number} value 0 (stormy) to 1 (fair); clamped
   * @param {string} [text] what screen readers announce for this value
   */
  function set(value, text) {
    const n = Number(value);
    const v = n > 0 ? (n < 1 ? n : 1) : 0;

    const tenths = Math.round((SWEEP_FROM + (SWEEP_TO - SWEEP_FROM) * v) * 10);
    if (tenths !== lastTenths) {
      lastTenths = tenths;
      el.style.setProperty("--needle", tenths / 10 + "deg");
    }

    const now = Math.round(v * 100);
    if (now !== lastNow) {
      lastNow = now;
      el.setAttribute("aria-valuenow", String(now));
    }

    const spoken = text !== undefined && text !== null && text !== "" ? String(text) : zoneName(v);
    if (spoken !== lastText) {
      lastText = spoken;
      el.setAttribute("aria-valuetext", spoken);
    }
  }

  set(0);
  return { set };
}
