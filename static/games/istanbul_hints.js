(() => {
    "use strict";

    const controllers = new WeakMap();
    let nextId = 0;
    const selector = "[data-istanbul-tip]";

    function installStyles() {
        if (document.getElementById("istanbulHintStyles")) return;
        const style = document.createElement("style");
        style.id = "istanbulHintStyles";
        style.textContent = `
            #istanbulPanel [data-istanbul-tip] { cursor: help; }
            #istanbulPanel [data-istanbul-tip]:focus-visible {
                outline: 3px solid #2563eb;
                outline-offset: 3px;
                border-radius: 6px;
            }
            body.istanbul-explain-mode #istanbulPanel [data-istanbul-tip] {
                outline: 2px dashed #2563eb;
                outline-offset: 2px;
            }
            .istanbul-instant-hint {
                position: fixed;
                z-index: 1200;
                box-sizing: border-box;
                width: max-content;
                max-width: min(340px, calc(100vw - 24px));
                max-height: calc(100dvh - 32px);
                overflow: auto;
                padding: 12px 15px;
                border: 1px solid #d4b887;
                border-radius: 12px;
                background: #fffaf0;
                color: #352b25;
                font: 500 14px/1.55 system-ui, sans-serif;
                text-align: left;
                white-space: normal;
                overflow-wrap: anywhere;
                box-shadow: 0 8px 30px #352b2533;
                margin-top: env(safe-area-inset-top, 0px);
                margin-bottom: env(safe-area-inset-bottom, 0px);
            }
            .istanbul-instant-hint[hidden] { display: none; }
            .istanbul-instant-hint.istanbul-hint-banner {
                pointer-events: none;
                border-left: 4px solid #a76d26;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Dedicated info targets only: place data-istanbul-tip on resource badges or
     * on an explicit info control beside an action, never on the whole action.
     * refresh() prepares targets inserted by a render. onExplain(text) should
     * leave Explain mode and open the game's explanation dialog.
     */
    window.createIstanbulHints = function ({ panel, isExplaining = () => false, onExplain = () => {} } = {}) {
        if (!panel) return { refresh() {}, hide() {}, destroy() {} };
        controllers.get(panel)?.destroy();
        installStyles();

        const id = `istanbulInstantHint${++nextId}`;
        const popup = document.createElement("div");
        popup.id = id;
        popup.className = "istanbul-instant-hint";
        popup.hidden = true;
        popup.setAttribute("aria-atomic", "true");
        document.body.appendChild(popup);

        let target = null;
        let mode = null;
        let timer = null;
        let leaveTimer = null;
        let gesture = null;
        let lastTouch = null;
        let dismissClick = null;
        let consumeExplainClick = false;
        let destroyed = false;
        const listeners = [];
        const suppliedLabels = new WeakMap();

        function listen(node, name, handler, options = true) {
            node.addEventListener(name, handler, options);
            listeners.push(() => node.removeEventListener(name, handler, options));
        }

        function targetFrom(node) {
            const element = node instanceof Element ? node.closest(selector) : null;
            return element && panel.contains(element) ? element : null;
        }

        function isVisible(element) {
            return element.isConnected && !element.closest(".hidden, [hidden], [aria-hidden='true']")
                && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
        }

        function available() {
            if (destroyed || !isVisible(panel)) return false;
            return !Array.from(document.querySelectorAll(".modal:not(.hidden), [role='dialog'][aria-modal='true'], dialog[open]"))
                .some(isVisible);
        }

        function dismissPopup() {
            clearTimeout(timer);
            clearTimeout(leaveTimer);
            timer = null;
            leaveTimer = null;
            if (target) {
                const descriptions = (target.getAttribute("aria-describedby") || "").split(/\s+/)
                    .filter(value => value && value !== id);
                if (descriptions.length) target.setAttribute("aria-describedby", descriptions.join(" "));
                else target.removeAttribute("aria-describedby");
            }
            popup.hidden = true;
            popup.textContent = "";
            target = null;
            mode = null;
        }

        function hide() {
            dismissPopup();
            gesture = null;
        }

        function position() {
            if (!target || popup.hidden) return;
            const viewport = window.visualViewport;
            const leftEdge = (viewport?.offsetLeft || 0) + 12;
            const topEdge = (viewport?.offsetTop || 0) + 12;
            const width = viewport?.width || document.documentElement.clientWidth;
            const height = viewport?.height || window.innerHeight;
            const rightEdge = leftEdge + width - 24;
            popup.style.maxWidth = `${Math.max(1, Math.min(340, width - 24))}px`;
            const popupStyle = getComputedStyle(popup);
            const safeTop = parseFloat(popupStyle.marginTop) || 0;
            const safeBottom = parseFloat(popupStyle.marginBottom) || 0;
            const bottomEdge = topEdge + height - 24 - safeBottom;
            popup.style.maxHeight = `${Math.max(1, height - 24 - safeTop - safeBottom)}px`;
            const rect = target.getBoundingClientRect();
            const popupWidth = popup.offsetWidth;
            const popupHeight = popup.offsetHeight;
            let left = Math.max(leftEdge, Math.min(rect.left + (rect.width - popupWidth) / 2, rightEdge - popupWidth));
            let top = rect.bottom + 8;
            if (mode === "banner") {
                left = leftEdge + Math.max(0, (width - 24 - popupWidth) / 2);
                // Prefer the top edge so bottom action controls remain usable.
                top = topEdge;
                if (rect.top < topEdge + popupHeight + safeTop + 8 && rect.bottom > topEdge) {
                    top = bottomEdge - popupHeight - safeTop;
                }
            } else if (top + popupHeight + safeTop > bottomEdge) {
                top = rect.top - popupHeight - safeTop - 8;
            }
            popup.style.left = `${left}px`;
            popup.style.top = `${Math.max(topEdge, Math.min(top, bottomEdge - popupHeight - safeTop))}px`;
        }

        function show(element, nextMode) {
            if (!available() || isExplaining() || !isVisible(element)) return;
            const text = element.dataset.istanbulTip?.trim();
            if (!text) return;
            dismissPopup();
            target = element;
            mode = nextMode;
            popup.classList.toggle("istanbul-hint-banner", mode === "banner");
            popup.setAttribute("role", mode === "banner" ? "status" : "tooltip");
            popup.setAttribute("aria-live", mode === "banner" ? "polite" : "off");
            popup.hidden = false;
            popup.textContent = text;
            if (mode === "tooltip") {
                const descriptions = (target.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
                target.setAttribute("aria-describedby", [...descriptions, id].join(" "));
            }
            position();
            if (mode === "banner") timer = setTimeout(hide, 3000);
        }

        function activate(element, nextMode) {
            if (!available()) return;
            if (isExplaining()) {
                const text = element.dataset.istanbulTip?.trim();
                hide();
                if (text) onExplain(text);
            } else {
                show(element, nextMode);
            }
        }

        function scheduleLeave() {
            clearTimeout(leaveTimer);
            leaveTimer = setTimeout(() => {
                if (mode === "tooltip" && !popup.matches(":hover")
                    && !target?.matches(":hover, :focus-visible")) dismissPopup();
            }, 160);
        }

        function onPointerDown(event) {
            // A fresh physical gesture is never a compatibility click from the
            // previous one, even when that earlier gesture emitted no click.
            consumeExplainClick = false;
            const element = targetFrom(event.target);
            if (!element) {
                if (target && !popup.contains(event.target)) {
                    dismissClick = { node: event.target, time: Date.now() };
                    hide();
                }
                return;
            }
            if (!available()) return;
            if (event.pointerType === "touch") {
                gesture = {
                    target: element, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
                    time: Date.now(), moved: false,
                };
            }
            // Explain's ordinary controls use pointerdown. Its dedicated hint
            // target must be resolved before a surrounding card is inspected.
            // No preventDefault: native touch scrolling continues normally.
            if (isExplaining()) event.stopPropagation();
        }

        function onPointerMove(event) {
            if (!gesture || event.pointerId !== gesture.pointerId) return;
            if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10) gesture.moved = true;
        }

        function onPointerUp(event) {
            if (!gesture || event.pointerId !== gesture.pointerId) return;
            const tap = gesture;
            gesture = null;
            const hit = targetFrom(document.elementFromPoint(event.clientX, event.clientY));
            const moved = tap.moved || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 10;
            lastTouch = { target: tap.target, time: Date.now() };
            if (!moved && Date.now() - tap.time < 650 && hit === tap.target) {
                consumeExplainClick = isExplaining() && available();
                activate(tap.target, "banner");
            }
        }

        function onPointerCancel(event) {
            if (gesture?.pointerId !== event.pointerId) return;
            lastTouch = { target: gesture.target, time: Date.now() };
            gesture = null;
        }

        function onClick(event) {
            if (consumeExplainClick) {
                // Opening a dialog during touch pointerup can retarget the
                // browser's subsequent click to its new backdrop. Consume that
                // click regardless of target, so it cannot close the dialog.
                consumeExplainClick = false;
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            const element = targetFrom(event.target);
            if (!element) {
                if (dismissClick && Date.now() - dismissClick.time < 1000 && dismissClick.node === event.target) {
                    event.istanbulTipDismissed = true;
                }
                dismissClick = null;
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            // Touch is handled only after a short, stationary pointer sequence.
            // Its compatibility click must never open a second hint or action.
            if (event.pointerType === "touch" || (lastTouch?.target === element && Date.now() - lastTouch.time < 1000)) return;
            activate(element, "tooltip");
        }

        function onKeyDown(event) {
            consumeExplainClick = false;
            if (event.key === "Escape" && target) {
                event.preventDefault();
                event.stopImmediatePropagation();
                hide();
                return;
            }
            const element = targetFrom(event.target);
            if (!element || (event.key !== "Enter" && event.key !== " ")) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            activate(element, "tooltip");
        }

        function refresh() {
            if (destroyed) return;
            if (!available() || isExplaining() || (target && !isVisible(target))) hide();
            panel.querySelectorAll(selector).forEach(element => {
                if (!element.hasAttribute("tabindex")) element.tabIndex = 0;
                if (!element.hasAttribute("role") && !element.matches("button, a[href], input, select, textarea")) {
                    element.setAttribute("role", "button");
                }
                if (!suppliedLabels.has(element)) suppliedLabels.set(element, element.hasAttribute("aria-label"));
                if (!suppliedLabels.get(element)) element.setAttribute("aria-label", element.dataset.istanbulTip || "Info");
            });
        }

        listen(window, "pointerdown", onPointerDown);
        listen(window, "pointermove", onPointerMove, { capture: true, passive: true });
        listen(window, "pointerup", onPointerUp);
        listen(window, "pointercancel", onPointerCancel);
        listen(window, "click", onClick);
        listen(window, "keydown", onKeyDown);
        listen(window, "pointerover", event => {
            if (event.pointerType === "touch") return;
            const element = targetFrom(event.target);
            if (element && element !== target) show(element, "tooltip");
            if (element === target || popup.contains(event.target)) clearTimeout(leaveTimer);
        });
        listen(window, "pointerout", event => {
            if (event.pointerType !== "touch" && targetFrom(event.target) === target && mode === "tooltip") scheduleLeave();
        });
        listen(popup, "pointerenter", () => clearTimeout(leaveTimer));
        listen(popup, "pointerleave", scheduleLeave);
        listen(window, "focusin", event => {
            const element = targetFrom(event.target);
            if (element && !gesture && !(lastTouch?.target === element && Date.now() - lastTouch.time < 1000)) show(element, "tooltip");
        });
        listen(window, "focusout", event => {
            if (targetFrom(event.target) === target && mode === "tooltip") dismissPopup();
        });
        listen(window, "scroll", () => {
            if (mode === "tooltip") dismissPopup();
            else position();
        }, { capture: true, passive: true });
        listen(window, "resize", position, { passive: true });
        if (window.visualViewport) {
            listen(window.visualViewport, "resize", position, { passive: true });
            listen(window.visualViewport, "scroll", position, { passive: true });
        }
        const observer = new MutationObserver(() => {
            if ((target || gesture) && (!available() || isExplaining() || (target && !isVisible(target)))) hide();
        });
        observer.observe(document.body, {
            childList: true, subtree: true, attributes: true,
            attributeFilter: ["class", "style", "hidden", "aria-hidden", "open"],
        });

        const controller = {
            refresh,
            hide,
            destroy() {
                if (destroyed) return;
                hide();
                destroyed = true;
                observer.disconnect();
                listeners.forEach(remove => remove());
                popup.remove();
                if (controllers.get(panel) === controller) controllers.delete(panel);
            },
        };
        controllers.set(panel, controller);
        refresh();
        return controller;
    };
})();
