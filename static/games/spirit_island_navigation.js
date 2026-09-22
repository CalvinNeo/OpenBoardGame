(() => {
    "use strict";

    const copyBox = box => box ? {x: box.x, y: box.y, width: box.width, height: box.height} : null;
    const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
    const sameBox = (left, right) => !!left && !!right && ["x", "y", "width", "height"].every(key => Math.abs(left[key] - right[key]) < 0.001);
    function readBox(value) {
        const box = Array.isArray(value) ? {x: value[0], y: value[1], width: value[2], height: value[3]} : value;
        if (!box || ![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.width <= 0 || box.height <= 0) {
            throw new TypeError("Spirit Island map bounds require finite x, y, width and height.");
        }
        return copyBox(box);
    }

    /**
     * Own one SVG camera while the game replaces its DOM between updates.
     *
     * const nav = new SpiritIslandNavigation({isExplaining: () => explaining});
     * nav.attach(svg, {x: 0, y: 0, width: 1000, height: 800});
     * nav.fit(); nav.zoom(1.25); nav.focus(boardBounds);
     *
     * attach() preserves the camera for unchanged bounds. fit(), zoom(), focus()
     * and pointer gestures update viewBox directly; callbacks must not remount
     * the map during an active gesture. zoom's optional point uses client pixels.
     */
    class SpiritIslandNavigation {
        constructor(options = {}) {
            this.options = options;
            this.minZoom = Math.max(1, Number(options.minZoom) || 1);
            this.maxZoom = Math.max(this.minZoom, Number(options.maxZoom) || 8);
            this.svg = null;
            this.base = null;
            this.box = null;
            this.fitBox = null;
            this.pointers = new Map();
            this.gesture = null;
            this.suppressedUntil = 0;
            this.observer = null;
            this.savedStyle = null;
            this.handlers = {
                down: event => this._pointerDown(event),
                move: event => this._pointerMove(event),
                up: event => this._pointerEnd(event, false),
                cancel: event => this._pointerEnd(event, true),
                lost: event => { if (event.target === this.svg) this._pointerEnd(event, true); },
                wheel: event => this._wheel(event),
                blur: () => this._stopGesture(true),
                resize: () => this.refresh(),
            };
        }

        attach(svg, baseBounds) {
            const base = readBox(baseBounds);
            const changed = !sameBox(base, this.base);
            this.detach();
            this.svg = svg;
            this.base = base;
            this.savedStyle = {touchAction: svg.style.touchAction, userSelect: svg.style.userSelect};
            svg.style.touchAction = "none";
            svg.style.userSelect = "none";
            svg.addEventListener("pointerdown", this.handlers.down);
            svg.addEventListener("lostpointercapture", this.handlers.lost);
            svg.addEventListener("wheel", this.handlers.wheel, {passive: false});
            window.addEventListener("pointermove", this.handlers.move, {passive: false});
            window.addEventListener("pointerup", this.handlers.up);
            window.addEventListener("pointercancel", this.handlers.cancel);
            window.addEventListener("blur", this.handlers.blur);
            window.addEventListener("resize", this.handlers.resize);
            if (typeof ResizeObserver !== "undefined") {
                this.observer = new ResizeObserver(() => this.refresh());
                this.observer.observe(svg);
            }
            if (changed || !this.box) {
                this.fitBox = this._fitBounds(base);
                this._setBox(this.fitBox);
            } else {
                this.refresh();
            }
            return this;
        }

        detach() {
            this._stopGesture(true);
            this.observer?.disconnect();
            this.observer = null;
            if (this.svg) {
                this.svg.removeEventListener("pointerdown", this.handlers.down);
                this.svg.removeEventListener("lostpointercapture", this.handlers.lost);
                this.svg.removeEventListener("wheel", this.handlers.wheel);
                if (this.savedStyle) {
                    this.svg.style.touchAction = this.savedStyle.touchAction;
                    this.svg.style.userSelect = this.savedStyle.userSelect;
                }
                this.svg.classList.remove("is-dragging");
            }
            window.removeEventListener("pointermove", this.handlers.move);
            window.removeEventListener("pointerup", this.handlers.up);
            window.removeEventListener("pointercancel", this.handlers.cancel);
            window.removeEventListener("blur", this.handlers.blur);
            window.removeEventListener("resize", this.handlers.resize);
            this.svg = null;
            this.savedStyle = null;
            return this;
        }

        destroy() {
            this.detach();
            this.base = this.box = this.fitBox = null;
            this.suppressedUntil = 0;
        }

        getBox() { return copyBox(this.box); }
        getState() { return {box: this.getBox(), baseBounds: copyBox(this.base), zoom: this._zoomLevel()}; }
        gestureClickSuppressed() { return Date.now() < this.suppressedUntil || !!this.gesture?.moved; }
        isGesturing() { return this.pointers.size > 0; }

        setState(state) {
            if (!state?.box) return this;
            this._stopGesture(true);
            if (!this.base && state.baseBounds) this.base = readBox(state.baseBounds);
            const box = readBox(state.box);
            this.box = box;
            if (this.base) {
                this.fitBox = this._fitBounds(this.base);
                const zoom = Number.isFinite(state.zoom) ? state.zoom : this.fitBox.width / box.width;
                this._setAround(box.x + box.width / 2, box.y + box.height / 2, zoom);
            }
            return this;
        }

        fit() {
            if (!this.base) return this;
            this._stopGesture(true);
            this.fitBox = this._fitBounds(this.base);
            this._setBox(this.fitBox);
            return this;
        }

        zoom(factor, clientPoint = null) {
            if (!this.box || !Number.isFinite(factor) || factor <= 0) return this;
            this._stopGesture(true);
            const previous = this.box;
            const oldZoom = this._zoomLevel();
            const newZoom = clamp(oldZoom * factor, this.minZoom, this.maxZoom);
            const anchor = clientPoint ? this._worldPoint(clientPoint) : {x: previous.x + previous.width / 2, y: previous.y + previous.height / 2};
            const ratio = oldZoom / newZoom;
            this._setBox({
                x: anchor.x + (previous.x - anchor.x) * ratio,
                y: anchor.y + (previous.y - anchor.y) * ratio,
                width: previous.width * ratio,
                height: previous.height * ratio,
            });
            return this;
        }

        focus(bounds) {
            if (!this.base) return this;
            this._stopGesture(true);
            const target = readBox(bounds);
            const padding = Math.max(0, Number(this.options.focusPadding) || 0.12);
            const expanded = this._fitBounds({x: target.x - target.width * padding / 2, y: target.y - target.height * padding / 2,
                width: target.width * (1 + padding), height: target.height * (1 + padding)});
            this._setAround(target.x + target.width / 2, target.y + target.height / 2, this.fitBox.width / expanded.width);
            return this;
        }

        refresh() {
            if (!this.base || !this.svg) return this;
            const zoom = this._zoomLevel();
            const previous = this.box || this.base;
            const nextFit = this._fitBounds(this.base);
            if (this.gesture && !sameBox(nextFit, this.fitBox)) this._stopGesture(true);
            this.fitBox = nextFit;
            this._setAround(previous.x + previous.width / 2, previous.y + previous.height / 2, zoom);
            return this;
        }

        _explaining() { return !!this.options.isExplaining?.(); }
        _zoomLevel() { return this.box && this.fitBox ? this.fitBox.width / this.box.width : 1; }
        _rect() { return this.svg?.getBoundingClientRect() || {left: 0, top: 0, width: 0, height: 0}; }
        _fitBounds(bounds) {
            const rect = this._rect();
            const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : bounds.width / bounds.height;
            const width = Math.max(bounds.width, bounds.height * aspect);
            const height = width / aspect;
            return {x: bounds.x + (bounds.width - width) / 2, y: bounds.y + (bounds.height - height) / 2, width, height};
        }
        _setAround(x, y, zoom) {
            zoom = clamp(zoom, this.minZoom, this.maxZoom);
            const width = this.fitBox.width / zoom, height = this.fitBox.height / zoom;
            this._setBox({x: x - width / 2, y: y - height / 2, width, height});
        }
        _setBox(value) {
            if (!this.base || !this.fitBox) { this.box = copyBox(value); return; }
            const zoom = clamp(this.fitBox.width / value.width, this.minZoom, this.maxZoom);
            const width = this.fitBox.width / zoom, height = this.fitBox.height / zoom;
            const centerX = value.x + value.width / 2, centerY = value.y + value.height / 2;
            const x = width >= this.base.width ? this.base.x + (this.base.width - width) / 2 : clamp(centerX - width / 2, this.base.x, this.base.x + this.base.width - width);
            const y = height >= this.base.height ? this.base.y + (this.base.height - height) / 2 : clamp(centerY - height / 2, this.base.y, this.base.y + this.base.height - height);
            this.box = {x, y, width, height};
            this.svg?.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
            this.options.onChange?.(this.getBox());
        }
        _inverseMatrix() {
            try { return this.svg?.getScreenCTM()?.inverse() || null; } catch (_) { return null; }
        }
        _worldPoint(point) {
            const x = point.clientX ?? point.x, y = point.clientY ?? point.y;
            const matrix = this._inverseMatrix();
            if (matrix) return {x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f};
            const rect = this._rect();
            return {x: this.box.x + (x - rect.left) * this.box.width / Math.max(1, rect.width), y: this.box.y + (y - rect.top) * this.box.height / Math.max(1, rect.height)};
        }
        _beginGesture(moved = false) {
            const points = [...this.pointers.values()];
            if (!points.length) { this.gesture = null; return; }
            const midpoint = points.length > 1 ? {x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2} : {...points[0]};
            const rect = this._rect();
            const inverse = this._inverseMatrix() || {a: this.box.width / Math.max(1, rect.width), b: 0, c: 0, d: this.box.height / Math.max(1, rect.height)};
            this.gesture = {box: this.getBox(), zoom: this._zoomLevel(), midpoint,
                anchor: this._worldPoint(midpoint), inverse,
                distance: points.length > 1 ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) : 0,
                moved: moved || points.length > 1};
            this.svg?.classList.toggle("is-dragging", this.gesture.moved);
        }
        _pointerDown(event) {
            if (!this.svg || !this.box || this._explaining() || event.button > 0) return;
            this.pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
            // Preserve the original land as the click target for a short tap.
            // Capture only once a drag or pinch begins; window listeners cover
            // the initial few pixels and the map owns touch gestures via CSS.
            if (this.pointers.size > 1) this._capturePointers();
            this._beginGesture(!!this.gesture?.moved);
        }
        _pointerMove(event) {
            if (!this.pointers.has(event.pointerId) || !this.gesture) return;
            if (this._explaining()) { this._stopGesture(true); return; }
            this.pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
            const points = [...this.pointers.values()], gesture = this.gesture;
            const midpoint = points.length > 1 ? {x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2} : points[0];
            const dx = midpoint.x - gesture.midpoint.x, dy = midpoint.y - gesture.midpoint.y;
            if (!gesture.moved && Math.hypot(dx, dy) <= 5) return;
            gesture.moved = true;
            this._capturePointers();
            event.preventDefault();
            this.svg?.classList.add("is-dragging");
            this.suppressedUntil = Date.now() + 600;
            const delta = {x: gesture.inverse.a * dx + gesture.inverse.c * dy, y: gesture.inverse.b * dx + gesture.inverse.d * dy};
            if (points.length > 1 && gesture.distance > 1) {
                const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
                const zoom = clamp(gesture.zoom * distance / gesture.distance, this.minZoom, this.maxZoom);
                const width = this.fitBox.width / zoom, height = this.fitBox.height / zoom;
                const fractionX = (gesture.anchor.x + delta.x - gesture.box.x) / gesture.box.width;
                const fractionY = (gesture.anchor.y + delta.y - gesture.box.y) / gesture.box.height;
                this._setBox({x: gesture.anchor.x - fractionX * width, y: gesture.anchor.y - fractionY * height, width, height});
            } else {
                this._setBox({...gesture.box, x: gesture.box.x - delta.x, y: gesture.box.y - delta.y});
            }
        }
        _capturePointers() {
            for (const pointerId of this.pointers.keys()) {
                try { if (!this.svg.hasPointerCapture(pointerId)) this.svg.setPointerCapture(pointerId); } catch (_) { /* Window listeners still finish the gesture. */ }
            }
        }
        _release(pointerId) {
            try { if (this.svg?.hasPointerCapture(pointerId)) this.svg.releasePointerCapture(pointerId); } catch (_) { /* The SVG may have been replaced. */ }
        }
        _pointerEnd(event, cancelled) {
            if (!this.pointers.has(event.pointerId)) return;
            const moved = !!this.gesture?.moved;
            this.pointers.delete(event.pointerId);
            this._release(event.pointerId);
            if (moved || cancelled) this.suppressedUntil = Date.now() + 600;
            if (this.pointers.size) {
                this._beginGesture(true);
            } else {
                this.gesture = null;
                this.svg?.classList.remove("is-dragging");
                this.options.onGestureEnd?.({cancelled, moved, box: this.getBox()});
            }
        }
        _stopGesture(cancelled) {
            if (!this.pointers.size) return;
            const moved = !!this.gesture?.moved;
            const ids = [...this.pointers.keys()];
            this.pointers.clear();
            this.gesture = null;
            ids.forEach(id => this._release(id));
            this.svg?.classList.remove("is-dragging");
            this.suppressedUntil = Date.now() + 600;
            this.options.onGestureEnd?.({cancelled, moved, box: this.getBox()});
        }
        _wheel(event) {
            if (!this.svg || !this.box) return;
            event.preventDefault();
            if (this._explaining()) return;
            const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this._rect().height : 1;
            const factor = clamp(Math.exp(-event.deltaY * unit * 0.0015), 0.5, 2);
            this.zoom(factor, {x: event.clientX, y: event.clientY});
        }
    }

    window.SpiritIslandNavigation = SpiritIslandNavigation;
})();
