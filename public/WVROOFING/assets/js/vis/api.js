// WV Roofing Roof Visualiser — what the server can do right now
// (/api/wvroofing/health: capability states and the render settings).
import { API_BASE } from "../config.js";

let healthPromise = null;

const OFFLINE = { reachable: false, caps: {}, renders: { live: false, test: false, auto: 1, budget: null } };

/**
 * Capabilities and render settings. Never throws: an unreachable API means
 * "nothing is available", so the quick previews still work.
 * renders.live: photo-real renders can be made (key, owner switch, storage).
 * renders.test: the labelled test environment's stand-in renderer.
 * renders.auto: how many finishes render automatically once agreed (0 = on tap).
 */
export function getHealth() {
  if (healthPromise) return healthPromise;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 7000);
  healthPromise = fetch(API_BASE + "/api/wvroofing/health", { cache: "no-store", signal: ctl.signal })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (!j || !j.ok) return OFFLINE;
      const caps = j.capabilities || {};
      const r = j.renders || {};
      const gen = caps.image_generation || {};
      const n = Number(r.autoRender);
      return {
        reachable: true,
        caps,
        renders: {
          live: gen.state === "enabled" && r.renderer === "ready",
          test: gen.reason === "test_environment",
          auto: Number.isFinite(n) ? Math.max(0, Math.min(8, Math.round(n))) : 1,
          budget: r.budget || null,
        },
      };
    })
    .catch(() => OFFLINE)
    .finally(() => clearTimeout(timer));
  return healthPromise;
}
