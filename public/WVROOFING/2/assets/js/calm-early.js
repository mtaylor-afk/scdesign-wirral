// WV Roofing v2 — settle Calm before the first paint.
// A classic script, loaded synchronously in every page's head, so a visitor
// who chose Calm (or whose device asks for reduced motion or is saving data)
// never sees the ticker or the pulses move while the page's modules load.
// It uses exactly the rule quality.js initCalm() uses, which runs later and
// then finds nothing to change: a stored choice in localStorage "wvr2.calm"
// ("1" calm, "0" weather on) wins; otherwise the page is calm when the device
// asks for reduced motion or the browser is saving data.
(function () {
  try {
    const root = document.documentElement;
    let stored = null;
    try {
      stored = window.localStorage ? window.localStorage.getItem("wvr2.calm") : null;
    } catch {
      stored = null;
    }
    let calm = false;
    if (stored === "1" || stored === "0") {
      calm = stored === "1";
    } else {
      const q = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
      const c = navigator.connection;
      calm = Boolean((q && q.matches) || (c && c.saveData === true));
    }
    if (calm) root.setAttribute("data-calm", "");
    else root.removeAttribute("data-calm");
  } catch {
    // Nothing decided here: quality.js decides once the page's modules load.
  }
})();
