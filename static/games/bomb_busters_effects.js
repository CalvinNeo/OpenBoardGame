(function () {
  "use strict";

  let timer = null;

  function clear() {
    if (timer) window.clearTimeout(timer);
    timer = null;
    const root = document.getElementById("bombBustersFailureEffect");
    if (!root) return;
    root.classList.add("hidden");
    root.querySelector(".bomb-busters-failure-rain").replaceChildren();
  }

  function play(name, reason) {
    clear();
    const root = document.getElementById("bombBustersFailureEffect");
    if (!root) return;
    void root.offsetWidth;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    root.classList.toggle("is-reduced", Boolean(reduced));
    root.querySelector(".bomb-busters-failure-name").textContent = name;
    root.querySelector(".bomb-busters-failure-caption").textContent = reason === "red_wire"
      ? "💥 Red wire · Mission failed" : "💥 Final failure";
    const rain = root.querySelector(".bomb-busters-failure-rain");
    for (let index = 0; index < 21; index += 1) {
      const drop = document.createElement("span");
      drop.textContent = "💩";
      drop.style.setProperty("--bomb-drop-left", `${8 + index * 37 % 80}%`);
      drop.style.setProperty("--bomb-drop-delay", `${index * 110}ms`);
      drop.style.setProperty("--bomb-drop-size", `${30 + index % 3 * 10}px`);
      rain.appendChild(drop);
    }
    root.classList.remove("hidden");
    timer = window.setTimeout(clear, reduced ? 1600 : 4400);
  }

  window.bombBustersFailureEffectUI = {play, clear};
})();
