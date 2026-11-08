/* Shared Help & Explain widgets for every game.
 * Contract: designs/task40.md, rollout plan: designs/task185.md
 * Exposes window.obgCreateHelp / window.obgCreateExplain / window.obgHelpLang.
 */
(function () {
  "use strict";

  const LANG_KEY = "obgHelpLang";
  const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

  let lang = "zh";
  try {
    lang = localStorage.getItem(LANG_KEY) === "en" ? "en" : "zh";
  } catch (error) {
    lang = "zh";
  }

  function setLang(next) {
    lang = next === "en" ? "en" : "zh";
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (error) {
      /* storage unavailable, keep in-memory language */
    }
    document.dispatchEvent(new CustomEvent("obg:help-lang", { detail: { lang } }));
  }

  // Localised lookup: accepts a plain string or a { zh, en } pair.
  function pick(value) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    return value[lang] ?? value.zh ?? value.en ?? "";
  }

  const UI = {
    zh: { help: "帮助", explain: "解释", close: "关闭", basic: "基本规则", win: "靠什么赢", turn: "每回合做什么", key: "重点" },
    en: { help: "Help", explain: "Explain", close: "Close", basic: "Basics", win: "How you win", turn: "Your turn", key: "The key" }
  };
  const ui = () => UI[lang];

  /* ------------------------------------------------------------------ *
   * Help dialog
   * ------------------------------------------------------------------ */

  function obgCreateHelp(config) {
    const gameId = config.gameId;
    if (!gameId) throw new Error("obgCreateHelp requires gameId");

    let dialog = null;
    let activeSection = null;

    function basicSection() {
      const basic = config.basic;
      if (!basic) return null;
      const t = ui();
      const row = (label, value) =>
        '<div class="obg-help-basic-row"><dt>' + esc(label) + "</dt><dd>" + esc(pick(value)) + "</dd></div>";
      return {
        id: "__basic",
        label: { zh: UI.zh.basic, en: UI.en.basic },
        html:
          '<dl class="obg-help-basic">'
          + row(t.win, basic.win)
          + row(t.turn, basic.turn)
          + row(t.key, basic.key)
          + "</dl>"
      };
    }

    function sections() {
      const list = [];
      const basic = basicSection();
      if (basic) list.push(basic);
      (config.sections || []).forEach((section) => list.push(section));
      return list;
    }

    function renderBody() {
      const list = sections();
      const useTabs = list.length >= 3;
      if (!activeSection || !list.some((entry) => entry.id === activeSection)) {
        activeSection = list.length ? list[0].id : null;
      }

      const tabs = useTabs
        ? '<div class="obg-help-tabs" role="tablist">'
          + list.map((entry) =>
            '<button type="button" role="tab" class="obg-help-tab'
            + (entry.id === activeSection ? " is-active" : "") + '" data-obg-help-tab="'
            + esc(entry.id) + '" aria-selected="' + (entry.id === activeSection) + '">'
            + esc(pick(entry.label)) + "</button>").join("")
          + "</div>"
        : "";

      const visible = useTabs ? list.filter((entry) => entry.id === activeSection) : list;
      const body = visible.map((entry) =>
        '<section class="obg-help-section" data-obg-help-section="' + esc(entry.id) + '">'
        + (useTabs ? "" : "<h3>" + esc(pick(entry.label)) + "</h3>")
        + pick(entry.html)
        + "</section>").join("");

      return tabs + '<div class="obg-help-body">' + body + "</div>";
    }

    function render() {
      if (!dialog) return;
      const t = ui();
      dialog.querySelector(".obg-help-title").textContent = pick(config.title) || gameId;
      dialog.querySelector(".obg-help-close").textContent = t.close;
      dialog.querySelectorAll("[data-obg-help-lang]").forEach((button) => {
        const on = button.dataset.obgHelpLang === lang;
        button.classList.toggle("is-active", on);
        button.setAttribute("aria-pressed", String(on));
      });
      dialog.querySelector(".obg-help-content").innerHTML = renderBody();
    }

    function build() {
      dialog = document.createElement("dialog");
      dialog.className = "obg-help-dialog";
      dialog.dataset.obgHelpGame = gameId;
      dialog.innerHTML =
        '<div class="obg-help-head">'
        + '<strong class="obg-help-title"></strong>'
        + '<div class="obg-help-lang" role="group" aria-label="Language">'
        + '<button type="button" data-obg-help-lang="zh">中文</button>'
        + '<button type="button" data-obg-help-lang="en">EN</button>'
        + "</div>"
        + '<button type="button" class="obg-help-close"></button>'
        + "</div>"
        + '<div class="obg-help-content"></div>';

      dialog.addEventListener("click", (event) => {
        const langButton = event.target.closest("[data-obg-help-lang]");
        if (langButton) {
          setLang(langButton.dataset.obgHelpLang);
          render();
          return;
        }
        const tab = event.target.closest("[data-obg-help-tab]");
        if (tab) {
          activeSection = tab.dataset.obgHelpTab;
          render();
          return;
        }
        if (event.target === dialog) dialog.close();
      });
      dialog.addEventListener("close", () => {
        config.onClose?.();
      });
      document.body.appendChild(dialog);
    }

    function open() {
      if (!dialog) build();
      render();
      if (!dialog.open) dialog.showModal();
    }

    function close() {
      if (dialog?.open) dialog.close();
    }

    document.addEventListener("obg:help-lang", () => {
      if (dialog?.open) render();
    });

    return { open, close, isOpen: () => !!dialog?.open, element: () => dialog };
  }

  /* ------------------------------------------------------------------ *
   * Explain mode
   * ------------------------------------------------------------------ */

  function obgCreateExplain(config) {
    const gameId = config.gameId;
    if (!gameId) throw new Error("obgCreateExplain requires gameId");
    const attribute = config.attribute || "data-" + gameId.replace(/_/g, "-") + "-explain";
    const selector = "[" + attribute + "]";
    const bypass = config.bypass || [];
    const root = () => (typeof config.root === "function" ? config.root() : config.root) || document;
    let active = false;
    let dialog = null;

    function described(node) {
      const key = node?.getAttribute?.(attribute);
      if (!key) return null;
      const entry = config.explanations?.[key];
      return entry == null ? null : pick(entry);
    }

    function targets() {
      return Array.from(root().querySelectorAll(selector)).filter((node) => described(node));
    }

    function isBypass(node) {
      return bypass.some((sel) => {
        try {
          return node.closest?.(sel);
        } catch (error) {
          return false;
        }
      });
    }

    function sync() {
      targets().forEach((node) => node.classList.toggle("obg-has-explanation", active));
      document.body.classList.toggle("obg-explaining", active);
      config.button?.setAttribute?.("aria-pressed", String(active));
      if (!active) {
        root().querySelectorAll(".obg-has-explanation").forEach((node) => node.classList.remove("obg-has-explanation"));
      }
    }

    function show(description) {
      if (!dialog) {
        dialog = document.createElement("dialog");
        dialog.className = "obg-help-dialog obg-explain-dialog";
        dialog.innerHTML =
          '<div class="obg-help-head"><strong class="obg-help-title"></strong>'
          + '<button type="button" class="obg-help-close"></button></div>'
          + '<div class="obg-help-content"><p class="obg-explain-text"></p></div>';
        dialog.addEventListener("click", (event) => {
          if (event.target === dialog || event.target.closest(".obg-help-close")) dialog.close();
        });
        document.body.appendChild(dialog);
      }
      dialog.querySelector(".obg-help-title").textContent = ui().explain;
      dialog.querySelector(".obg-help-close").textContent = ui().close;
      dialog.querySelector(".obg-explain-text").textContent = description;
      if (!dialog.open) dialog.showModal();
    }

    // pointerdown + hit test, so disabled controls stay explainable.
    function atPoint(x, y) {
      return targets().find((node) => {
        const box = node.getBoundingClientRect();
        return box.width && box.height
          && x >= box.left && x <= box.right
          && y >= box.top && y <= box.bottom;
      }) || null;
    }

    function onPointerDown(event) {
      if (!active) return;
      if (isBypass(event.target)) return;
      const node = atPoint(event.clientX, event.clientY);
      if (!node) return;
      event.preventDefault();
      event.stopPropagation();
      const description = described(node);
      setActive(false);
      if (description) show(description);
    }

    // Capture-phase guard: explain mode must never trigger a real action.
    function onClick(event) {
      if (!active) return;
      if (isBypass(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
    }

    function onKeyDown(event) {
      if (active && event.key === "Escape") {
        event.preventDefault();
        setActive(false);
      }
    }

    function setActive(next) {
      if (active === next) return;
      active = next;
      sync();
      config.onChange?.(active);
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("obg:help-lang", () => {
      if (dialog?.open) show(dialog.querySelector(".obg-explain-text").textContent);
    });

    const observer = new MutationObserver(() => {
      if (active) sync();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return {
      enter: () => setActive(true),
      exit: () => setActive(false),
      toggle: () => setActive(!active),
      isActive: () => active,
      refresh: sync
    };
  }

  window.obgCreateHelp = obgCreateHelp;
  window.obgCreateExplain = obgCreateExplain;
  window.obgHelpLang = () => lang;
  window.obgHelpSetLang = setLang;
})();
