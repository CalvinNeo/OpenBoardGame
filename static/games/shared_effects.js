/* Shared cross-game visual effects.
 *
 * Loaded once from static/index.html, so any game can use these without
 * registering anything in GAME_ASSETS and without shipping its own art.
 *
 * window.obgPlayPoopSplash({ name, caption, durationMs, announce })
 *   A poop flies in and splats on a cartoon person's face. The person's body
 *   carries a badge with `name`, so every viewer sees who made the mistake.
 *   Calls are queued and never overlap. Returns a Promise that resolves when
 *   the effect finished, so a caller can await it before continuing.
 */
(function () {
  "use strict";

  const ROOT_ID = "obgPoopSplashRoot";
  const DEFAULT_DURATION_MS = 2900;
  const REDUCED_DURATION_MS = 1500;
  const MAX_QUEUED = 3;

  let rootEl = null;
  let chain = Promise.resolve();
  let queued = 0;

  function prefersReducedMotion() {
    return typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function ensureRoot() {
    if (rootEl && rootEl.isConnected) return rootEl;
    rootEl = document.getElementById(ROOT_ID);
    if (rootEl) return rootEl;
    rootEl = document.createElement("div");
    rootEl.id = ROOT_ID;
    rootEl.className = "obg-poop-root";
    document.body.appendChild(rootEl);
    return rootEl;
  }

  function ensureLiveRegion(root) {
    let region = root.querySelector(".obg-poop-live");
    if (region) return region;
    region = document.createElement("div");
    region.className = "obg-poop-live sr-only";
    region.setAttribute("aria-live", "assertive");
    region.setAttribute("aria-atomic", "true");
    root.appendChild(region);
    return region;
  }

  function buildStage(options, reduced) {
    const stage = document.createElement("div");
    stage.className = "obg-poop-stage";
    stage.setAttribute("aria-hidden", "true");
    if (reduced) stage.classList.add("is-reduced");

    const bits = [
      [-78, -46], [-52, -74], [56, -70], [84, -34],
      [-88, 22], [92, 26], [-30, -88], [34, -84],
    ]
      .map(([dx, dy], index) =>
        '<span class="obg-poop-bit" style="--obg-poop-dx:' + dx + 'px;--obg-poop-dy:' + dy
        + 'px;--obg-poop-delay:' + (index % 4) * 40 + 'ms"></span>')
      .join("");

    stage.innerHTML =
      '<div class="obg-poop-inner">'
      + '<div class="obg-poop-person">'
      + '<span class="obg-poop-arm obg-poop-arm-left"></span>'
      + '<span class="obg-poop-arm obg-poop-arm-right"></span>'
      + '<div class="obg-poop-head">'
      + '<span class="obg-poop-eye obg-poop-eye-left"></span>'
      + '<span class="obg-poop-eye obg-poop-eye-right"></span>'
      + '<span class="obg-poop-mouth"></span>'
      + '<span class="obg-poop-splat"></span>'
      + '<span class="obg-poop-drip"></span>'
      + "</div>"
      + '<div class="obg-poop-torso">'
      + '<span class="obg-poop-badge">💩</span>'
      + '<span class="obg-poop-name"></span>'
      + "</div>"
      + "</div>"
      + '<div class="obg-poop-flight"><span class="obg-poop-poop">💩</span></div>'
      + '<div class="obg-poop-burst">' + bits + "</div>"
      + '<p class="obg-poop-caption"></p>'
      + "</div>";

    const nameEl = stage.querySelector(".obg-poop-name");
    nameEl.textContent = options.name;
    nameEl.title = options.name;
    stage.querySelector(".obg-poop-caption").textContent = options.caption;
    return stage;
  }

  function runOnce(options) {
    return new Promise((resolve) => {
      if (!document.body) {
        resolve();
        return;
      }
      const reduced = prefersReducedMotion();
      const duration = options.durationMs || (reduced ? REDUCED_DURATION_MS : DEFAULT_DURATION_MS);
      const root = ensureRoot();
      const stage = buildStage(options, reduced);
      root.appendChild(stage);

      if (options.announce) {
        const region = ensureLiveRegion(root);
        region.textContent = "";
        window.setTimeout(() => {
          region.textContent = options.announce;
        }, 20);
      }

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.clearTimeout(fadeTimer);
        window.clearTimeout(removeTimer);
        if (stage.isConnected) stage.remove();
        resolve();
      };

      const fadeTimer = window.setTimeout(() => {
        stage.classList.add("is-leaving");
      }, Math.max(0, duration - 500));
      const removeTimer = window.setTimeout(finish, duration);
      // Only the fade-out ends the effect. The fade-in finishes long before the
      // splash does, so listening for it would tear the stage down early.
      stage.addEventListener("animationend", (event) => {
        if (event.animationName === "obgPoopLeave") finish();
      });
    });
  }

  function play(options) {
    const source = options || {};
    const name = String(source.name == null ? "" : source.name).trim() || "?";
    const resolved = {
      name,
      caption: String(source.caption == null ? "💥 Splat!" : source.caption),
      durationMs: Number.isFinite(source.durationMs) && source.durationMs > 0
        ? Math.round(source.durationMs)
        : null,
      announce: source.announce ? String(source.announce) : "",
    };
    if (queued >= MAX_QUEUED) return chain;
    queued += 1;
    const step = () => runOnce(resolved).then(() => {
      queued = Math.max(0, queued - 1);
    });
    chain = chain.then(step, step);
    return chain;
  }

  window.obgPlayPoopSplash = play;
})();
