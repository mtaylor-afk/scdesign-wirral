// WV Roofing v2 — how much weather this device gets, and whether it gets any.
// "Calm" is the page's off switch for motion: the visitor's own toggle wins,
// otherwise the operating system's reduced-motion setting or the browser's
// data saver decides. The quality probe looks at the device (cores, memory,
// screen density) and times about forty frames, then picks a budget.
// Every browser feature is checked before use, so this file also loads in Node.

const CALM_KEY = "wvr2.calm";
const CALM_ATTR = "data-calm";
const CALM_EVENT = "wvr2:calm";
const TIERS = ["low", "mid", "high"];
const PROBE_FRAMES = 40;
const PROBE_WARMUP = 4;
const PROBE_TIMEOUT_MS = 4000;

/** Particle and cloud-layer budgets for each quality tier. */
export const BUDGETS = Object.freeze({
  high: Object.freeze({ particles: 900, clouds: 2 }),
  mid: Object.freeze({ particles: 450, clouds: 1 }),
  low: Object.freeze({ particles: 200, clouds: 0 }),
});

let probeCache = null;
let followingSystem = false;

function rootElement() {
  return typeof document !== "undefined" && document.documentElement ? document.documentElement : null;
}

function readStored() {
  try {
    if (typeof localStorage === "undefined" || !localStorage) return null;
    const v = localStorage.getItem(CALM_KEY);
    return v === "1" || v === "0" ? v : null;
  } catch {
    return null;
  }
}

/** Remember a choice ("1" calm, "0" weather on), or forget it (null). */
function writeStored(value) {
  try {
    if (typeof localStorage === "undefined" || !localStorage) return;
    if (value === null) localStorage.removeItem(CALM_KEY);
    else localStorage.setItem(CALM_KEY, value);
  } catch {
    // Private mode or storage switched off: the choice lasts for this page only.
  }
}

function reducedMotionQuery() {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
    return window.matchMedia("(prefers-reduced-motion: reduce)");
  } catch {
    return null;
  }
}

function systemWantsCalm() {
  const q = reducedMotionQuery();
  if (q && q.matches) return true;
  try {
    const c = typeof navigator !== "undefined" && navigator ? navigator.connection : null;
    return Boolean(c && c.saveData === true);
  } catch {
    return false;
  }
}

/** Set or remove the attribute; true when that changed anything. */
function applyAttr(on) {
  const root = rootElement();
  if (!root) return false;
  const had = root.hasAttribute(CALM_ATTR);
  if (on && !had) root.setAttribute(CALM_ATTR, "");
  else if (!on && had) root.removeAttribute(CALM_ATTR);
  return had !== on;
}

function announce(calm) {
  try {
    if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
    if (typeof CustomEvent !== "function") return;
    window.dispatchEvent(new CustomEvent(CALM_EVENT, { detail: { calm } }));
  } catch {
    // Nothing to tell.
  }
}

/**
 * Decide at page load whether the page is calm, and mark <html> to match.
 * A stored choice ("wvr2.calm" = "1" or "0") wins; otherwise the page is calm
 * when the system asks for reduced motion or the browser is saving data.
 * While there is no stored choice the page also follows the system setting if
 * it changes. The "wvr2:calm" event is sent only if the attribute changed.
 * assets/js/calm-early.js applies the same rule before the first paint (keep
 * the two in step), so normally nothing changes here.
 * @returns {boolean} true when the page is calm
 */
export function initCalm() {
  const stored = readStored();
  const calm = stored !== null ? stored === "1" : systemWantsCalm();
  if (applyAttr(calm)) announce(calm);
  if (!followingSystem) {
    const q = reducedMotionQuery();
    if (q && typeof q.addEventListener === "function") {
      followingSystem = true;
      q.addEventListener("change", () => {
        if (readStored() !== null) return;
        const next = systemWantsCalm();
        if (applyAttr(next)) announce(next);
      });
    }
  }
  return calm;
}

/**
 * Is the page calm right now?
 * @returns {boolean}
 */
export function isCalm() {
  const root = rootElement();
  return Boolean(root && root.hasAttribute(CALM_ATTR));
}

/**
 * Switch calm on or off and tell the page (window CustomEvent "wvr2:calm"
 * with detail { calm }). The choice is remembered only when it differs from
 * what the device asks for (reduced motion or data saver); a choice that
 * matches it is forgotten, so the page goes back to following the device,
 * at load and if the setting changes mid-visit.
 * assets/js/calm-early.js reads the same key before the first paint.
 * @param {boolean} on
 * @returns {boolean} the new value
 */
export function setCalm(on) {
  const calm = Boolean(on);
  applyAttr(calm);
  writeStored(calm === systemWantsCalm() ? null : calm ? "1" : "0");
  announce(calm);
  return calm;
}

/**
 * Be told whenever calm changes.
 * @param {(calm: boolean) => void} fn
 * @returns {() => void} call it to stop listening
 */
export function onCalmChange(fn) {
  if (typeof fn !== "function" || typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => {};
  }
  const handler = (e) => {
    const d = e && e.detail;
    fn(d && typeof d.calm === "boolean" ? d.calm : isCalm());
  };
  window.addEventListener(CALM_EVENT, handler);
  return () => window.removeEventListener(CALM_EVENT, handler);
}

/**
 * The tier the device itself suggests, before any timing: 0 low, 1 mid, 2 high.
 * deviceMemory is missing in Safari and Firefox, so 0 means "not known".
 * @param {number} cores navigator.hardwareConcurrency (0 when unknown)
 * @param {number} memory navigator.deviceMemory in GB (0 when unknown)
 * @param {number} dpr window.devicePixelRatio
 * @returns {number}
 */
export function deviceTier(cores, memory, dpr) {
  const c = cores > 0 ? cores : 4;
  const m = memory > 0 ? memory : 0;
  const d = dpr > 0 ? dpr : 1;
  if (c <= 2 || (m > 0 && m <= 2)) return 0;
  let tier = 1;
  if (c >= 8 && (m === 0 || m >= 8)) tier = 2;
  else if (c >= 6 && (m === 0 || m >= 4) && d <= 2) tier = 2;
  // A very dense screen on a modest chip is a mid-range phone: hold it at mid.
  if (tier === 2 && d >= 3 && m > 0 && m < 8) tier = 1;
  return tier;
}

/**
 * The tier the frame timing allows: 0 low, 1 mid, 2 high.
 * @param {number} meanMs mean time between frames in milliseconds
 * @returns {number}
 */
export function timingTier(meanMs) {
  if (!(meanMs > 0)) return 0;
  if (meanMs <= 20) return 2;
  if (meanMs <= 30) return 1;
  return 0;
}

/**
 * Measure the device once and pick a budget.
 * When the frames can't be timed (the page is calm, the tab is hidden, or the
 * timing doesn't finish in time) it resolves the device's own hint, held at
 * "mid" at most, and does not remember it. Pages keep the tier they are given
 * for the whole visit and the weather doesn't run while calm or hidden anyway,
 * so answering "low" there would only strip the clouds once it does run.
 * Resolves "low" when there is no browser. A real measurement is cached.
 * @returns {Promise<"high"|"mid"|"low">}
 */
export function probeQuality() {
  if (probeCache) return probeCache;
  if (typeof window === "undefined" || typeof document === "undefined") return Promise.resolve("low");
  if (typeof requestAnimationFrame !== "function") return Promise.resolve("low");

  const nav = typeof navigator !== "undefined" && navigator ? navigator : {};
  const hint = deviceTier(Number(nav.hardwareConcurrency) || 0, Number(nav.deviceMemory) || 0, Number(window.devicePixelRatio) || 1);
  const untimed = Math.min(1, hint);
  if (isCalm() || document.hidden) return Promise.resolve(TIERS[untimed]);

  const attempt = new Promise((resolve) => {
    let frames = 0;
    let first = 0;
    let last = 0;
    let raf = 0;
    let timer = 0;
    let done = false;

    const finish = (tier, keep) => {
      if (done) return;
      done = true;
      if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHide);
      if (!keep) probeCache = null;
      resolve(TIERS[tier]);
    };
    const onHide = () => {
      if (document.hidden) finish(untimed, false);
    };
    const frame = (now) => {
      raf = 0;
      if (done) return;
      if (isCalm() || document.hidden) {
        finish(untimed, false);
        return;
      }
      frames += 1;
      if (frames === PROBE_WARMUP) first = now;
      last = now;
      if (frames >= PROBE_FRAMES) {
        const mean = (last - first) / (PROBE_FRAMES - PROBE_WARMUP);
        finish(Math.min(hint, timingTier(mean)), true);
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    document.addEventListener("visibilitychange", onHide);
    timer = setTimeout(() => finish(untimed, false), PROBE_TIMEOUT_MS);
    raf = requestAnimationFrame(frame);
  });

  probeCache = attempt;
  return attempt;
}
