// WV Roofing — before/after slider (a transparent range input over two images).
// Kept in its own module so pages and the visualiser share one instance.

/** Wire every .ba slider inside root (idempotent). */
export function initBeforeAfter(root) {
  (root || document).querySelectorAll(".ba").forEach((ba) => {
    const range = ba.querySelector(".ba-range");
    if (!range || range.dataset.wired) return;
    range.dataset.wired = "1";
    const update = () => {
      ba.style.setProperty("--pos", range.value + "%");
      range.setAttribute("aria-valuetext", range.value + "% before, " + (100 - range.value) + "% after");
    };
    range.addEventListener("input", update);
    update();
  });
}
