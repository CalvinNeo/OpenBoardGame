(() => {
  "use strict";
  const GAME = "twelve_rivers";
  const byId = suffix => document.getElementById("twelveRivers" + suffix);
  const panel = byId("Panel");
  if (!panel) return;
  const map = byId("Map"), frame = byId("MapFrame"), overlay = byId("SlotOverlay");

  // ------------------------------------------------------------ board layout
  const W = 1000, H = 646;
  const RIVER_X0 = 96, RIVER_W = 71;
  const ROW_Y = {1: 40, 2: 118, 3: 196, 4: 274, 5: 352};
  const BAND_H = 62;
  const PEARL_Y = 16, SLOT_Y = 44;
  const SEA = {x: 500, y: 486, rx: 150, ry: 38};
  const VILLAGE_Y = 556, VILLAGE_X0 = 168, VILLAGE_W = 112;

  const SEAT_COLORS = ["#d9534f", "#3f7cc0", "#3f8f5a", "#d9a520"];
  const PEARL_HEX = {
    green: "#5fbf5f", blue: "#4fb6e8", pink: "#f2749f",
    purple: "#9a6fd0", white: "#f3f0e4",
  };
  const PEARL_EMOJI = {green: "🟢", blue: "🔵", pink: "🌸", purple: "🟣", white: "⚪"};
  const RAINBOW_HEX = "conic-gradient(#f2749f, #f3f0e4, #5fbf5f, #4fb6e8, #9a6fd0, #f2749f)";
  const RAINBOW = "rainbow";

  const CARD_EMOJI = {banner: "🚩", lantern: "🏮", supplies: "🎒", net: "🎣", instrument: "🎵"};
  const FAIRY_EMOJI = {fire: "🔥", earth: "⛰️", wind: "🌬️", light: "💡", water: "💧"};
  const EXPLORE_PAIRS = ["banner", "lantern", "supplies"];

  const NS = "http://www.w3.org/2000/svg";
  const el = (name, attrs) => {
    const node = document.createElementNS(NS, name);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    return node;
  };

  let view = null, pending = false, signature = "";
  let selection = null;      // {space, pay:{}, fire, wind, pairs:[], pendingPair}
  let chosen = null;         // {pearls:[], swap:[], net, water}
  let delivery = null;       // {alpaca:index|null}
  let tipTimer = null, tipTarget = null;
  let helpWidget = null, explainWidget = null;
  let vb = {x: 0, y: 0, w: W, h: H};
  let drag = null, userZoomed = false;

  const active = () => !panel.classList.contains("hidden") && currentGameType === GAME;
  const available = type => !pending && !!view && (view.legal_actions || []).includes(type);
  const me = () => (view ? view.players.find(p => p.player_id === view.you) : null);
  const catalog = () => (view ? view.catalog : null);
  const isMyTurn = () => !!view && view.current_actor === view.you;

  function send(action) {
    if (!action || pending) return;
    pending = true;
    render();
    if (typeof sendAction === "function") sendAction(action);
  }

  // -------------------------------------------------------------- geometry
  const riverX = index => RIVER_X0 + (index - 1) * RIVER_W;
  function stretchBox(stretch) {
    const first = stretch.rivers[0], last = stretch.rivers[stretch.rivers.length - 1];
    const x = riverX(first) + 4;
    const width = (last - first + 1) * RIVER_W - 8;
    return {x, y: ROW_Y[stretch.row], width, height: BAND_H};
  }
  function slotPos(stretch, slot) {
    const box = stretchBox(stretch);
    const n = stretch.slots;
    return {x: box.x + box.width * (slot - 0.5) / n, y: box.y + SLOT_Y};
  }
  function villagePos(index) {
    return {x: VILLAGE_X0 + VILLAGE_W * index + VILLAGE_W / 2, y: VILLAGE_Y + 46};
  }

  function toScreen(x, y) {
    const rect = frame.getBoundingClientRect();
    const s = Math.min(rect.width / vb.w, rect.height / vb.h);
    return {
      x: (rect.width - vb.w * s) / 2 + (x - vb.x) * s,
      y: (rect.height - vb.h * s) / 2 + (y - vb.y) * s,
    };
  }

  // ------------------------------------------------------------------ zoom
  function applyViewBox() {
    map.setAttribute("viewBox", vb.x + " " + vb.y + " " + vb.w + " " + vb.h);
  }
  function fitMap() { vb = {x: 0, y: 0, w: W, h: H}; applyViewBox(); }
  // A phone screen is far taller than the board is wide, so covering the frame
  // keeps the rivers readable instead of letterboxing them into a thin strip.
  function fillMap() {
    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) { fitMap(); return; }
    const aspect = rect.width / rect.height;
    let w, h;
    if (aspect < W / H) { h = H; w = H * aspect; } else { w = W; h = W / aspect; }
    // Anchor a horizontal crop to the left edge so the cost rail - the reference
    // every placement decision is made against - is always on screen.
    vb = {x: aspect < W / H ? 0 : (W - w) / 2, y: (H - h) / 2, w, h};
    applyViewBox();
  }
  function defaultView() {
    userZoomed = false;
    if (window.innerWidth <= 900) fillMap(); else fitMap();
  }
  function zoomBy(factor, cx, cy) {
    const w = Math.min(W * 1.6, Math.max(W * 0.28, vb.w * factor));
    const h = w * (H / W);
    const fx = cx === undefined ? 0.5 : cx;
    const fy = cy === undefined ? 0.5 : cy;
    vb = {
      x: vb.x + (vb.w - w) * fx,
      y: vb.y + (vb.h - h) * fy,
      w, h,
    };
    vb.x = Math.max(-40, Math.min(W - vb.w + 40, vb.x));
    vb.y = Math.max(-40, Math.min(H - vb.h + 40, vb.y));
    applyViewBox();
  }
  function pointerToSvg(event) {
    const rect = frame.getBoundingClientRect();
    const s = Math.min(rect.width / vb.w, rect.height / vb.h);
    const ox = (rect.width - vb.w * s) / 2, oy = (rect.height - vb.h * s) / 2;
    return {
      x: vb.x + (event.clientX - rect.left - ox) / s,
      y: vb.y + (event.clientY - rect.top - oy) / s,
    };
  }

  // Pointer capture is taken only once a drag actually starts: capturing on
  // pointerdown would retarget the following click to the frame and every board
  // slot would stop responding. Move and release are tracked on window so a
  // gesture that leaves the map still ends cleanly.
  let suppressClick = false;
  frame.addEventListener("pointerdown", event => {
    if (event.target.closest(".tr12-slot-card")) return;
    drag = {
      x: event.clientX, y: event.clientY, vb: {...vb},
      moved: false, id: event.pointerId, captured: false,
    };
  });
  window.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dx) + Math.abs(dy) <= 5) return;
      drag.moved = true;
      userZoomed = true;
      frame.classList.add("dragging");
      try { frame.setPointerCapture(drag.id); drag.captured = true; } catch (error) { /* ignore */ }
    }
    const rect = frame.getBoundingClientRect();
    const s = Math.min(rect.width / drag.vb.w, rect.height / drag.vb.h) || 1;
    vb.x = Math.max(-40, Math.min(W - vb.w + 40, drag.vb.x - dx / s));
    vb.y = Math.max(-40, Math.min(H - vb.h + 40, drag.vb.y - dy / s));
    applyViewBox();
  });
  const endDrag = event => {
    if (!drag) return;
    if (event && event.pointerId !== undefined && event.pointerId !== drag.id) return;
    if (drag.moved && event && event.type === "pointerup") suppressClick = true;
    if (drag.captured) {
      try { frame.releasePointerCapture(drag.id); } catch (error) { /* ignore */ }
    }
    drag = null;
    frame.classList.remove("dragging");
  };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
  frame.addEventListener("click", event => {
    if (suppressClick) { suppressClick = false; event.stopPropagation(); }
  }, true);
  frame.addEventListener("wheel", event => {
    event.preventDefault();
    userZoomed = true;
    const rect = frame.getBoundingClientRect();
    zoomBy(event.deltaY > 0 ? 1.12 : 0.89,
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height);
  }, {passive: false});

  // ------------------------------------------------------------- rendering
  function text(id, value) {
    const node = byId(id);
    if (node) node.textContent = value;
  }

  function render() {
    if (!view) return;
    renderHeader();
    renderBoard();
    renderTrack();
    renderDock();
    renderOffer();
    renderPlayers();
    renderReview();
    renderLog();
  }

  function phaseLabel() {
    if (view.game_over) return "Game over";
    if (view.phase === "exploration") return "Exploration · place your family markers";
    if (view.phase === "collection") {
      if (view.stage === "river") return "Collection · pearls roll down the rivers";
      if (view.stage === "sea") return "Collection · the sea";
      if (view.stage === "village") return "Collection · befriend a Markaya";
      if (view.stage === "deliver") return "Deliver pearls to your Markaya";
    }
    if (view.phase === "round_end") return "Round scored · review the table";
    return "";
  }

  function renderHeader() {
    text("Round", "Round " + view.round + " / " + view.total_rounds);
    let status = phaseLabel();
    if (view.game_over) {
      const winners = view.final_results.filter(r => view.winner_ids.includes(r.player_id));
      status = winners.length > 1
        ? "Shared victory: " + winners.map(r => r.name).join(", ")
        : (winners[0] ? winners[0].name + " wins" : "Game over");
    } else if (isMyTurn()) {
      status = "Your turn · " + status;
    } else if (view.current_actor) {
      const actor = view.players.find(p => p.player_id === view.current_actor);
      status = (actor ? actor.name : "Someone") + " · " + status;
    }
    text("Status", status);
    const next = byId("Next");
    const showNext = available("next_round");
    next.classList.toggle("hidden", !showNext);
  }

  function renderBoard() {
    map.replaceChildren();
    const board = view.board;
    const stretchById = {};
    board.stretches.forEach(s => { stretchById[s.id] = s; });

    map.appendChild(el("rect", {x: 0, y: 0, width: W, height: H, fill: "transparent"}));

    // cost rail
    [1, 2, 3, 4, 5].forEach(row => {
      const stretch = board.stretches.find(s => s.row === row);
      if (!stretch) return;
      const label = stretch.cost > 0 ? "−" + stretch.cost : (stretch.cost < 0 ? "+1" : "0");
      const node = el("text", {x: 46, y: ROW_Y[row] + 38, class: "tr12-cost", "text-anchor": "middle"});
      node.textContent = label;
      map.appendChild(node);
    });
    const riverLabel = el("text", {x: 500, y: 24, class: "tr12-area-label", "text-anchor": "middle"});
    riverLabel.textContent = "RIVER AREA · " + view.active_rivers + " ACTIVE RIVERS";
    map.appendChild(riverLabel);

    // stretches, pearls and slots
    const collectSpace = myRiverSpace();
    const collectStretch = collectSpace ? collectSpace.split("#")[0] : null;
    board.stretches.forEach(stretch => {
      const box = stretchBox(stretch);
      map.appendChild(el("rect", {
        x: box.x, y: box.y, width: box.width, height: box.height, rx: 10,
        class: "tr12-stretch" + (stretch.active ? "" : " inactive"),
      }));
      const pearls = view.pools[stretch.id] || [];
      const pickable = collectStretch === stretch.id && available("take_pearl");
      pearls.forEach((color, index) => {
        const cx = box.x + 16 + index * 20;
        if (cx > box.x + box.width - 10) return;
        const taken = pickable && chosen && chosen.pearls.includes(color)
          && chosen.pearls.filter(c => c === color).length
             > pearls.slice(0, index).filter(c => c === color).length;
        const node = el("circle", {
          cx, cy: box.y + PEARL_Y, r: pickable ? 10 : 8,
          fill: PEARL_HEX[color],
          stroke: taken ? "#ffd98a" : "rgba(0,0,0,0.3)",
          "stroke-width": taken ? 3 : 1,
        });
        if (pickable) {
          node.style.cursor = "pointer";
          node.addEventListener("click", event => {
            event.stopPropagation();
            if (suppressClick) return;
            onRiverPearl(color);
          });
        }
        map.appendChild(node);
      });
      for (let slot = 1; slot <= stretch.slots; slot += 1) {
        const pos = slotPos(stretch, slot);
        const spaceId = stretch.id + "#" + slot;
        drawSlot(spaceId, pos.x, pos.y, stretch.active, 13);
      }
      // fairy bank for this stretch
      (board.fairy_spots || []).forEach(spot => {
        if (spot.stretch !== stretch.id) return;
        const stack = view.fairy_spots[spot.id] || [];
        const fx = box.x - 15;
        const dot = el("circle", {
          cx: fx, cy: box.y + 30, r: 11,
          class: "tr12-fairy-dot",
          fill: stack.length ? "#ffe08a" : "rgba(255,255,255,0.14)",
        });
        dot.dataset.fairySpot = spot.id;
        dot.style.cursor = stack.length ? "pointer" : "default";
        dot.addEventListener("click", event => {
          event.stopPropagation();
          if (suppressClick) return;
          onFairySpot(spot.id);
        });
        map.appendChild(dot);
        if (stack.length) {
          const glyph = el("text", {
            x: fx, y: box.y + 35, "text-anchor": "middle", "font-size": 13,
          });
          glyph.textContent = stack.length > 1
            ? FAIRY_EMOJI[stack[0]] + stack.length : FAIRY_EMOJI[stack[0]];
          glyph.style.pointerEvents = "none";
          map.appendChild(glyph);
        }
      });
    });

    // sea
    map.appendChild(el("ellipse", {
      cx: SEA.x, cy: SEA.y, rx: SEA.rx, ry: SEA.ry,
      fill: "rgba(120,190,235,0.22)", stroke: "rgba(255,255,255,0.4)",
    }));
    const seaLabel = el("text", {x: SEA.x, y: SEA.y - SEA.ry - 12, class: "tr12-area-label", "text-anchor": "middle"});
    seaLabel.textContent = "SEA · cost 0 · take any number";
    map.appendChild(seaLabel);
    (view.sea || []).forEach((color, index) => {
      const row = Math.floor(index / 10), col = index % 10;
      const cx = SEA.x - 130 + col * 28 + (row % 2) * 12;
      const cy = SEA.y - 14 + row * 20;
      const pearl = el("circle", {
        cx, cy, r: 10, fill: PEARL_HEX[color],
        stroke: "rgba(0,0,0,0.3)", "stroke-width": 1,
      });
      pearl.dataset.seaIndex = String(index);
      pearl.style.cursor = available("take_sea_pearls") ? "pointer" : "default";
      pearl.addEventListener("click", event => {
        event.stopPropagation();
        if (suppressClick) return;
        onSeaPearl(color);
      });
      map.appendChild(pearl);
    });
    drawSlot("sea", SEA.x, SEA.y + 18, true, 15);

    // village
    const villageLabel = el("text", {x: 500, y: VILLAGE_Y - 8, class: "tr12-area-label", "text-anchor": "middle"});
    villageLabel.textContent = "VILLAGE · befriend a Markaya";
    map.appendChild(villageLabel);
    board.village.forEach((cost, index) => {
      const pos = villagePos(index);
      const costNode = el("text", {
        x: pos.x, y: VILLAGE_Y + 22, class: "tr12-cost", "text-anchor": "middle", "font-size": 13,
      });
      costNode.textContent = cost > 0 ? "−" + cost : "0";
      map.appendChild(costNode);
      drawSlot("v" + (index + 1), pos.x, pos.y, true, 16);
    });

    renderSlotOverlay();
  }

  function drawSlot(spaceId, x, y, isActive, radius) {
    const placement = view.placements[spaceId];
    const canPlace = available("place_marker") && !placement && isActive && !selection?.pendingPair;
    const group = el("g", {});
    const circle = el("circle", {
      cx: x, cy: y, r: radius,
      class: "tr12-slot" + (isActive ? "" : " inactive")
        + (placement ? " occupied" : "")
        + (canPlace ? " open" : "")
        + (selection && selection.space === spaceId ? " target" : ""),
    });
    circle.dataset.space = spaceId;
    if (canPlace) {
      circle.addEventListener("click", event => {
        event.stopPropagation();
        if (suppressClick) return;
        onSlotClick(spaceId, x, y);
      });
    } else if (selection && selection.pendingPair === "supplies-from" && placement
               && placement.pid === view.you) {
      circle.classList.add("target");
      circle.addEventListener("click", event => {
        event.stopPropagation();
        if (suppressClick) return;
        selection.pairFrom = spaceId;
        selection.pendingPair = "supplies-to";
        render();
      });
    } else if (selection && selection.pendingPair === "supplies-to" && !placement && isActive) {
      circle.classList.add("target");
      circle.addEventListener("click", event => {
        event.stopPropagation();
        if (suppressClick) return;
        selection.pairs.push({kind: "supplies", from: selection.pairFrom, to: spaceId});
        selection.pendingPair = null;
        render();
      });
    }
    group.appendChild(circle);
    if (placement) {
      const player = view.players.find(p => p.player_id === placement.pid);
      const color = SEAT_COLORS[player ? player.color : 0];
      group.appendChild(el("circle", {
        cx: x, cy: y, r: radius - 2, class: "tr12-marker", fill: color,
      }));
      const initial = el("text", {
        x, y: y + 4, "text-anchor": "middle", "font-size": 11,
        fill: "#fff", "font-weight": 700,
      });
      initial.style.pointerEvents = "none";
      initial.textContent = (player ? player.name : "?").slice(0, 1).toUpperCase();
      group.appendChild(initial);
      if (available("take_pearl") && placement.pid === view.you) {
        group.appendChild(el("circle", {
          cx: x, cy: y, r: radius + 5, fill: "none",
          stroke: "#ffd98a", "stroke-width": 3,
        }));
      }
    }
    map.appendChild(group);
  }

  // ------------------------------------------------------- current river slot
  function myRiverSpace() {
    if (!view || view.stage !== "river" || view.current_actor !== view.you) return null;
    for (const stretchId of view.board.order) {
      const stretch = view.board.stretches.find(s => s.id === stretchId);
      if (!stretch) continue;
      for (let slot = 1; slot <= stretch.slots; slot += 1) {
        const spaceId = stretchId + "#" + slot;
        const placement = view.placements[spaceId];
        if (placement) return placement.pid === view.you ? spaceId : null;
      }
    }
    return null;
  }
  function myVillageSpace() {
    if (!view || view.stage !== "village" || view.current_actor !== view.you) return null;
    for (let i = 1; i <= 6; i += 1) {
      const id = "v" + i;
      if (view.placements[id]) return view.placements[id].pid === view.you ? id : null;
    }
    return null;
  }

  // ------------------------------------------------------------ interactions
  function costOf(spaceId) {
    if (spaceId === "sea") return view.board.sea_cost;
    if (spaceId.startsWith("v")) return view.board.village[Number(spaceId.slice(1)) - 1];
    const stretch = view.board.stretches.find(s => s.id === spaceId.split("#")[0]);
    return stretch ? stretch.cost : 0;
  }

  function onSlotClick(spaceId, x, y) {
    if (!available("place_marker")) return;
    selection = {space: spaceId, x, y, pay: {}, fire: 0, wind: false, pairs: [], pendingPair: null};
    chosen = null;
    render();
  }

  function onFairySpot(spotId) {
    if (!selection || selection.pendingPair !== "lantern") return;
    if (!(view.fairy_spots[spotId] || []).length) return;
    selection.pairs.push({kind: "lantern", spot: spotId});
    selection.pendingPair = null;
    render();
  }

  function onRiverPearl(color) {
    if (!available("take_pearl")) return;
    if (!chosen) chosen = {pearls: [], net: false, water: false};
    const limit = pearlLimit();
    const at = chosen.pearls.indexOf(color);
    if (at >= 0) chosen.pearls.splice(at, 1);
    else if (chosen.pearls.length < limit) chosen.pearls.push(color);
    render();
  }

  function onSeaPearl(color) {
    if (!available("take_sea_pearls")) return;
    if (!chosen) chosen = {pearls: []};
    const at = chosen.pearls.indexOf(color);
    if (at >= 0) chosen.pearls.splice(at, 1);
    else chosen.pearls.push(color);
    render();
  }

  function pearlLimit() {
    const player = me();
    let limit = 1;
    if (chosen && chosen.net) limit += 1;
    if (chosen && chosen.water) limit += 1;
    return limit;
  }

  function autoSwap(count) {
    const player = me();
    const alpaca = player.alpaca.slice();
    const free = 6 - alpaca.length;
    const need = Math.max(0, count - free);
    const ranked = alpaca.slice().sort((a, b) => pearlScore(a) - pearlScore(b));
    return ranked.slice(0, need);
  }

  function pearlScore(color) {
    const cat = catalog();
    let score = cat.pearls[color].points;
    const player = me();
    (player.markaya || []).forEach(entry => {
      entry.spots.forEach(spot => {
        if (spot.pearl === null && (spot.color === color || spot.color === RAINBOW)) score += 2;
      });
    });
    return score;
  }

  function confirmPlacement() {
    const action = {type: "place_marker", space: selection.space};
    const cost = costOf(selection.space);
    const player = me();
    if (selection.wind) {
      action.wind = true;
    } else if (cost > 0) {
      const paid = Object.values(selection.pay).reduce((a, b) => a + b, 0);
      if (paid + selection.fire !== cost) return;
      action.pay = Object.fromEntries(Object.entries(selection.pay).filter(([, n]) => n > 0));
      if (selection.fire) action.fire = selection.fire;
    } else if (Object.keys(selection.pay).length || selection.fire) {
      return;
    }
    if (selection.pairs.length) action.pairs = selection.pairs;
    selection = null;
    send(action);
  }

  function cancelSelection() {
    selection = null;
    chosen = null;
    render();
  }

  // --------------------------------------------------------------- overlays
  function renderSlotOverlay() {
    overlay.replaceChildren();
    overlay.classList.add("hidden");
    const cards = [];
    if (selection) cards.push(placementCard());
    else if (available("take_pearl") && myRiverSpace()) cards.push(riverCard());
    else if (available("take_sea_pearls")) cards.push(seaCard());
    if (!cards.length) return;
    overlay.classList.remove("hidden");
    cards.forEach(card => overlay.appendChild(card));
  }

  function overlayCard(x, y, children) {
    const point = toScreen(x, y);
    const card = document.createElement("div");
    card.className = "tr12-slot-card";
    card.style.left = point.x + "px";
    card.style.top = Math.max(8, point.y - 54) + "px";
    children.forEach(child => card.appendChild(child));
    return card;
  }

  function button(label, className, handler) {
    const node = document.createElement("button");
    node.type = "button";
    node.textContent = label;
    if (className) node.className = className;
    node.addEventListener("click", event => { event.stopPropagation(); handler(); });
    return node;
  }

  function placementCard() {
    const cost = costOf(selection.space);
    const player = me();
    const paid = Object.values(selection.pay).reduce((a, b) => a + b, 0);
    const need = selection.wind ? 0 : Math.max(0, cost - selection.fire);
    const label = document.createElement("span");
    label.className = "cost";
    if (cost < 0) label.textContent = "+1 card";
    else if (selection.wind) label.textContent = "free (🌬️)";
    else label.textContent = "pay " + paid + " / " + need;
    const ready = cost < 0 || selection.wind || paid === need;
    const children = [label];
    if (selection.pendingPair) {
      const hint = document.createElement("span");
      hint.className = "cost";
      hint.textContent = selection.pendingPair === "lantern" ? "pick a fairy"
        : (selection.pendingPair === "supplies-from" ? "pick your marker" : "pick a space");
      children.push(hint);
    }
    children.push(button("Place", "", () => { if (ready) confirmPlacement(); }));
    children.push(button("Cancel", "cancel", cancelSelection));
    const card = overlayCard(selection.x, selection.y, children);
    if (!ready) card.querySelector("button").disabled = true;
    return card;
  }

  function riverCard() {
    const spaceId = myRiverSpace();
    const stretchId = spaceId.split("#")[0];
    const stretch = view.board.stretches.find(s => s.id === stretchId);
    const pos = slotPos(stretch, Number(spaceId.split("#")[1]));
    const pool = view.pools[stretchId] || [];
    const player = me();
    const children = [];
    const info = document.createElement("span");
    info.className = "cost";
    const free = 6 - player.alpaca.length;
    info.textContent = pool.length + " here · " + (chosen ? chosen.pearls.length : 0)
      + " picked · " + free + " free";
    children.push(info);
    const limit = pearlLimit();
    const ready = !chosen || chosen.pearls.length <= limit;
    children.push(button(chosen && chosen.pearls.length ? "Take" : "Pass", "", () => {
      const take = chosen ? chosen.pearls : [];
      const action = {type: "take_pearl", take, swap_out: autoSwap(take.length)};
      if (chosen && chosen.net) action.net = true;
      if (chosen && chosen.water) action.water = true;
      chosen = null;
      send(action);
    }));
    if (!ready) children[children.length - 1].disabled = true;
    return overlayCard(pos.x, pos.y, children);
  }

  function seaCard() {
    const player = me();
    const children = [];
    const info = document.createElement("span");
    info.className = "cost";
    info.textContent = (chosen ? chosen.pearls.length : 0) + " picked · "
      + (6 - player.alpaca.length) + " free";
    children.push(info);
    children.push(button("Take", "", () => {
      const take = chosen ? chosen.pearls : [];
      const action = {type: "take_sea_pearls", take, swap_out: autoSwap(take.length)};
      chosen = null;
      send(action);
    }));
    return overlayCard(SEA.x, SEA.y + 18, children);
  }

  // ------------------------------------------------------------------ track
  function renderTrack() {
    const host = byId("Track");
    host.replaceChildren();
    for (let i = 0; i < 12; i += 1) {
      const slot = document.createElement("div");
      slot.className = "tr12-track-slot";
      const entry = view.track[i];
      if (entry) {
        const player = view.players.find(p => p.player_id === entry.pid);
        slot.style.background = SEAT_COLORS[player ? player.color : 0];
        slot.textContent = (player ? player.name : "?").slice(0, 1).toUpperCase();
        slot.title = (player ? player.name : "?") + " · position " + (i + 1);
      }
      host.appendChild(slot);
    }
  }

  // ------------------------------------------------------------------- dock
  function pearlNode(color, size) {
    const node = document.createElement("span");
    node.className = "pearl";
    if (color === RAINBOW) node.style.background = RAINBOW_HEX;
    else node.style.background = PEARL_HEX[color];
    if (size) { node.style.width = size + "px"; node.style.height = size + "px"; }
    return node;
  }

  function renderDock() {
    const player = me();
    if (!player) return;
    text("AlpacaCount", player.alpaca.length + " / 6");
    text("HandCount", "(" + player.hand_count + ")");
    renderAlpaca(player);
    renderGoals(player);
    renderHand(player);
    renderFairies(player);
    renderMarkaya(player);
  }

  function renderAlpaca(player) {
    const host = byId("Alpaca");
    host.replaceChildren();
    const delivering = available("deliver");
    for (let i = 0; i < 6; i += 1) {
      const hole = document.createElement("button");
      hole.type = "button";
      hole.className = "tr12-hole";
      const color = player.alpaca[i];
      if (color) {
        hole.classList.add("filled");
        hole.appendChild(pearlNode(color));
        hole.title = catalog().pearls[color].zh;
      }
      if (delivering && color !== undefined) {
        if (delivery && delivery.alpaca === i) hole.classList.add("selected");
        hole.addEventListener("click", () => {
          delivery = delivery && delivery.alpaca === i ? null : {alpaca: i};
          render();
        });
      }
      host.appendChild(hole);
    }
    if (delivering) {
      const done = document.createElement("button");
      done.type = "button";
      done.className = "tr12-next";
      done.textContent = "Finish delivering";
      done.addEventListener("click", () => { delivery = null; send({type: "deliver", moves: []}); });
      host.appendChild(done);
    }
  }

  function renderGoals(player) {
    const host = byId("AlpacaGoals");
    host.replaceChildren();
    (catalog().alpaca_cards || []).forEach(card => {
      const owner = view.alpaca_cards[card.id];
      const node = document.createElement("span");
      node.className = "tr12-goal" + (owner === view.you ? " done" : (owner ? " taken" : ""));
      node.textContent = card.count + "×" + PEARL_EMOJI[card.color] + " = 4";
      node.title = "Hold " + card.count + " " + catalog().pearls[card.color].en
        + " on your alpaca at once";
      host.appendChild(node);
    });
  }

  function renderHand(player) {
    const host = byId("Hand");
    host.replaceChildren();
    const hand = player.hand || {};
    const cat = catalog().supplies;
    Object.keys(cat).forEach(kind => {
      const count = hand[kind] || 0;
      if (!count) return;
      const node = document.createElement("button");
      node.type = "button";
      node.className = "tr12-card";
      const picked = selection ? (selection.pay[kind] || 0) : 0;
      if (picked) node.classList.add("selected");
      node.innerHTML = "<span>" + cat[kind].emoji + "</span><span class='n'>"
        + (picked ? picked + "/" : "") + count + "</span>";
      node.title = cat[kind].zh + " · " + cat[kind].effect_zh;
      node.dataset.tr12Tip = cat[kind].zh + "：" + cat[kind].effect_zh;
      if (available("place_marker")) {
        node.addEventListener("click", () => {
          if (!selection) return;
          const current = selection.pay[kind] || 0;
          selection.pay[kind] = current + 1 > count ? 0 : current + 1;
          render();
        });
      }
      host.appendChild(node);
    });
    if (available("place_marker") && selection) {
      EXPLORE_PAIRS.forEach(kind => {
        if ((hand[kind] || 0) < 2) return;
        const already = selection.pairs.filter(p => p.kind === kind).length;
        if (already >= Math.floor((hand[kind] || 0) / 2)) return;
        const node = document.createElement("button");
        node.type = "button";
        node.className = "tr12-card pairable";
        node.textContent = "play " + cat[kind].emoji + " pair";
        node.addEventListener("click", () => {
          if (kind === "banner") selection.pairs.push({kind});
          else selection.pendingPair = kind === "lantern" ? "lantern" : "supplies-from";
          render();
        });
        host.appendChild(node);
      });
    }
  }

  function renderFairies(player) {
    const host = byId("Fairies");
    host.replaceChildren();
    const fairies = player.fairies || {};
    const cat = catalog().fairies;
    const keys = Object.keys(cat).filter(kind => (fairies[kind] || 0) > 0);
    if (!keys.length) {
      const none = document.createElement("span");
      none.className = "tr12-goal";
      none.textContent = "none yet";
      host.appendChild(none);
      return;
    }
    keys.forEach(kind => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "tr12-fairy";
      node.textContent = cat[kind].emoji + " ×" + fairies[kind];
      node.title = cat[kind].zh + " · " + cat[kind].effect_zh;
      node.dataset.tr12Tip = cat[kind].zh + "：" + cat[kind].effect_zh;
      if (selection && available("place_marker")) {
        if (kind === "wind") {
          if (selection.wind) node.classList.add("selected");
          node.addEventListener("click", () => { selection.wind = !selection.wind; render(); });
        } else if (kind === "fire") {
          if (selection.fire) node.classList.add("selected");
          node.addEventListener("click", () => {
            selection.fire = selection.fire >= fairies[kind] ? 0 : selection.fire + 1;
            render();
          });
        }
      } else if (available("take_pearl") && kind === "water" && chosen) {
        if (chosen.water) node.classList.add("selected");
        node.addEventListener("click", () => { chosen.water = !chosen.water; render(); });
      }
      host.appendChild(node);
    });
    if (available("take_pearl")) {
      const player2 = me();
      if ((player2.hand.net || 0) >= 2) {
        const node = document.createElement("button");
        node.type = "button";
        node.className = "tr12-fairy";
        node.textContent = "🥅 pair";
        if (chosen && chosen.net) node.classList.add("selected");
        node.addEventListener("click", () => {
          if (!chosen) chosen = {pearls: [], net: false, water: false};
          chosen.net = !chosen.net;
          render();
        });
        host.appendChild(node);
      }
    }
  }

  function markayaTile(tileId, entry, options) {
    const cat = catalog().markaya[tileId];
    const node = document.createElement("div");
    node.className = "tr12-tile" + (options.pickable ? " pickable" : "");
    const head = document.createElement("div");
    head.className = "tr12-tile-head";
    const name = document.createElement("span");
    name.textContent = cat.name_zh;
    const cards = document.createElement("span");
    cards.className = "cards";
    cards.textContent = cat.cards ? "🎴+" + cat.cards : "";
    head.append(name, cards);
    node.appendChild(head);
    const spots = document.createElement("div");
    spots.className = "tr12-tile-spots";
    cat.spots.forEach((color, index) => {
      const spot = entry ? entry.spots[index] : null;
      const hole = document.createElement("button");
      hole.type = "button";
      hole.className = "tr12-hole";
      if (spot && spot.pearl) {
        hole.classList.add("filled");
        hole.appendChild(pearlNode(spot.pearl));
      } else {
        const ring = document.createElement("span");
        ring.className = "pearl";
        ring.style.background = color === RAINBOW ? RAINBOW_HEX : PEARL_HEX[color];
        ring.style.opacity = "0.35";
        hole.appendChild(ring);
      }
      if (options.onSpot && spot && spot.pearl === null) {
        hole.addEventListener("click", () => options.onSpot(index));
      }
      spots.appendChild(hole);
    });
    node.appendChild(spots);
    const objective = document.createElement("div");
    objective.className = "tr12-tile-obj";
    objective.textContent = objectiveText(cat);
    node.appendChild(objective);
    if (options.onPick) node.addEventListener("click", options.onPick);
    return node;
  }

  function objectiveText(cat) {
    const meta = catalog().objectives[cat.objective];
    let label = meta ? meta.zh : cat.objective;
    if (cat.color) label = label.replace("{c}", catalog().pearls[cat.color].zh);
    if (cat.objective === "color_most" && cat.points) {
      label = label.replace("6 分", cat.points + " 分");
    }
    return label;
  }

  function renderMarkaya(player) {
    const host = byId("Markaya");
    host.replaceChildren();
    const delivering = available("deliver");
    player.markaya.forEach((entry, tileIndex) => {
      host.appendChild(markayaTile(entry.tile, entry, {
        onSpot: delivering ? spotIndex => {
          if (!delivery || delivery.alpaca === null) return;
          const color = player.alpaca[delivery.alpaca];
          const spot = entry.spots[spotIndex];
          const light = spot.color !== RAINBOW && spot.color !== color
            && (player.fairies.light || 0) > 0;
          if (spot.color !== RAINBOW && spot.color !== color && !light) return;
          const move = {tile: tileIndex, spot: spotIndex, pearl: delivery.alpaca};
          if (light) move.light = true;
          delivery = null;
          send({type: "deliver", moves: [move]});
        } : null,
      }));
    });
  }

  // ------------------------------------------------------------------ offer
  function renderOffer() {
    const host = byId("Offer");
    host.replaceChildren();
    const picking = available("befriend");
    view.markaya_display.forEach((tileId, index) => {
      host.appendChild(markayaTile(tileId, null, {
        pickable: picking,
        onPick: picking ? () => {
          const action = {type: "befriend", index};
          const player = me();
          if ((player.hand.instrument || 0) >= 2 && hasVillageRoom()) action.instrument = true;
          send(action);
        } : null,
      }));
    });
    text("DeckInfo", "🂠 " + view.markaya_deck_count + " left · 🎴 "
      + view.supply_deck_count + " camp cards · 🧚 " + view.fairy_supply_count);
  }

  function hasVillageRoom() {
    let seen = false;
    for (let i = 1; i <= 6; i += 1) {
      const id = "v" + i;
      if (view.placements[id]) { seen = true; continue; }
      if (seen) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- players
  function renderPlayers() {
    const host = byId("Players");
    host.replaceChildren();
    view.players.forEach(player => {
      const node = document.createElement("div");
      node.className = "tr12-player" + (player.player_id === view.current_actor ? " active" : "");
      node.style.borderLeftColor = SEAT_COLORS[player.color];
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = player.name + (player.is_bot ? " 🤖" : "")
        + (player.player_id === view.you ? " (you)" : "");
      const stats = document.createElement("span");
      stats.className = "stats";
      stats.textContent = "🦙 " + player.alpaca.length + "/6 · 🎴 " + player.hand_count
        + " · 🧚 " + player.fairy_count + " · 🏘️ " + player.markaya.length
        + " · 🎯 " + player.alpaca_cards.length;
      node.append(name, stats);
      host.appendChild(node);
    });
  }

  function renderReview() {
    const host = byId("Results");
    const section = byId("Review");
    if (!view.game_over) {
      section.classList.add("hidden");
      host.replaceChildren();
      return;
    }
    section.classList.remove("hidden");
    host.replaceChildren();
    view.final_results.forEach(row => {
      const node = document.createElement("div");
      node.className = "tr12-result" + (view.winner_ids.includes(row.player_id) ? " win" : "");
      const left = document.createElement("span");
      left.textContent = row.name;
      const right = document.createElement("span");
      right.textContent = row.total + " (🔮" + row.pearls + " · 🏘️" + row.bonuses
        + " · 🎯" + row.alpaca + ")";
      node.append(left, right);
      host.appendChild(node);
    });
  }

  function renderLog() {
    const host = byId("Log");
    host.replaceChildren();
    view.log.slice(-40).reverse().forEach(entry => {
      const item = document.createElement("li");
      item.textContent = "R" + entry.round + " · " + entry.text;
      host.appendChild(item);
    });
  }

  // ---------------------------------------------------------------- tooltips
  function showTip(target, message) {
    const node = byId("Tooltip");
    node.textContent = message;
    node.classList.remove("hidden");
    const rect = target.getBoundingClientRect();
    const width = node.offsetWidth, height = node.offsetHeight;
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(8, Math.min(window.innerWidth - width - 8, left));
    let top = rect.top - height - 8;
    if (top < 8) top = rect.bottom + 8;
    node.style.left = left + "px";
    node.style.top = top + "px";
    clearTimeout(tipTimer);
    tipTimer = setTimeout(hideTip, 3000);
  }
  function hideTip() {
    clearTimeout(tipTimer);
    byId("Tooltip").classList.add("hidden");
  }

  panel.addEventListener("pointerover", event => {
    const target = event.target.closest("[data-tr12-tip]");
    if (!target || target === tipTarget) return;
    tipTarget = target;
    showTip(target, target.dataset.tr12Tip);
  });
  panel.addEventListener("pointerout", event => {
    if (!event.target.closest("[data-tr12-tip]")) return;
    tipTarget = null;
    hideTip();
  });
  panel.addEventListener("click", event => {
    const target = event.target.closest("[data-tr12-tip]");
    if (!target) return;
    if (window.matchMedia("(hover: none)").matches) {
      event.stopPropagation();
      showTip(target, target.dataset.tr12Tip);
    }
  }, true);

  // ------------------------------------------------------------ help/explain
  const TWELVE_RIVERS_EXPLAIN = {
    round: {
      zh: "一共 5 轮。每轮依次是准备、探索、收集三个阶段，结束后会暂停让大家看盘面。",
      en: "Five rounds. Each has a preparation, exploration and collection phase, and pauses at the end so everyone can read the table.",
    },
    zoom: {
      zh: "加减号缩放，Fit 收起全图，1:1 按原始比例。拖动可以平移，手机端由版图自己接管触摸手势。",
      en: "Plus and minus zoom, Fit frames the whole valley, 1:1 shows native size. Drag to pan; on phones the board claims the touch gesture.",
    },
    dock: {
      zh: "打开你自己的营地：羊驼、营地卡、仙子和玛卡雅。手机端它会从右侧滑出，可以随时关掉去看版图。",
      en: "Open your own camp: alpaca, camp cards, fairies and Markaya. On phones it slides in from the right and can be closed to see the board.",
    },
    track: {
      zh: "顺位轨。探索阶段按从前到后的顺序行动；收集阶段每收回一枚标记就放到最后，所以越靠上游下轮越晚行动。",
      en: "Turn order track. Exploration runs front to back; every marker you retrieve goes to the back, so camping further upstream means acting later next round.",
    },
    alpaca: {
      zh: "羊驼只有 6 格，所有捞到的珍珠先放这里。满了以后可以拿新珍珠换掉旧的。羊驼上的珍珠终局 0 分。",
      en: "Your alpaca holds only 6 pearls and everything you catch lands here first. When it is full you may swap a new pearl for an old one. Pearls left here score nothing.",
    },
    hand: {
      zh: "营地卡既是钱也是行动。放置标记时按河段费用弃牌；成对打出才能触发效果，用过的牌进弃牌堆。",
      en: "Camp cards are both currency and actions. Placing a marker discards cards equal to the stretch cost, and only matching pairs trigger an effect.",
    },
    fairies: {
      zh: "仙子用掉就移出游戏。放在版图上的仙子，只要你在它左边那段河扎营就能全部拿走。",
      en: "Fairies leave the game once used. Camping in the stretch to the right of a bank sweeps up every fairy sitting there.",
    },
    markaya: {
      zh: "你结交的玛卡雅。只有放到玛卡雅存放孔里的珍珠才计分，彩虹孔可以放任意颜色。",
      en: "The Markaya you have befriended. Only pearls delivered into their storage spots score, and rainbow spots accept any colour.",
    },
    village: {
      zh: "本轮可以结交的玛卡雅，共 6 张。村庄空格越靠左越先挑，左边两格分别要付 2 张和 1 张营地卡。",
      en: "The six Markaya available this round. Village spaces further left pick first; the two leftmost cost 2 and 1 camp cards.",
    },
    board: {
      zh: "河谷版图：越靠上游费用越高但越先挑珍珠，最下面一段反而给你 1 张营地卡。每段的格子数就是那一段能挤几个人。",
      en: "The valley: the further upstream you camp the more you pay but the earlier you pick, while the last stretch actually hands you a camp card.",
    },
  };

  const TWELVE_RIVERS_HELP_CONFIG = {
    gameId: GAME,
    title: {zh: "十二河谷 · 12 Rivers", en: "12 Rivers"},
    basic: {
      win: {
        zh: "5 轮后总分最高的人获胜。总分 = 玛卡雅上的珍珠分 + 村民奖励目标 + 每张羊驼任务卡 4 分。",
        en: "After five rounds the highest total wins: pearls delivered to Markaya, plus Markaya bonus objectives, plus 4 per alpaca goal card.",
      },
      turn: {
        zh: "轮到你时，把顺位轨上最靠前的那枚族人标记放到版图上，按河段费用付营地卡，之后可以打对子。然后等开闸收珍珠。",
        en: "On your turn take your frontmost marker off the track, place it on the board and pay the stretch cost in camp cards, then optionally play pairs.",
      },
      key: {
        zh: "关键在于抢在别人前面拿到自己玛卡雅缺的颜色，同时别让羊驼被垃圾珍珠塞满——留在羊驼上的珍珠一分不值。",
        en: "The key is reaching the colours your Markaya still need before anyone else, without clogging your alpaca — pearls left on it are worth nothing.",
      },
    },
    sections: [
      {
        id: "setup",
        label: {zh: "组件与准备", en: "Setup"},
        html: {
          zh: "<p>2–4 人。每人 3 枚族人标记、一块 6 格的羊驼版图、6 张营地卡和 1 张起始玛卡雅。</p>"
            + "<p>珍珠共 65 颗：🟢 绿 ×17（1 分）、🔵 蓝 ×15（2 分）、🌸 粉 ×13（3 分）、🟣 紫 ×11（4 分）、⚪ 白 ×9（5 分）。</p>"
            + "<p>每人启用 3 条河：2 人用最左 6 条，3 人 9 条，4 人全部 12 条。</p>",
          en: "<p>2–4 players. Everyone gets 3 family markers, a 6-slot alpaca board, 6 camp cards and one starting Markaya.</p>"
            + "<p>65 pearls: 17 green (1), 15 blue (2), 13 pink (3), 11 purple (4), 9 white (5).</p>"
            + "<p>Three rivers per player are active: 6 for two players, 9 for three, all 12 for four.</p>",
        },
      },
      {
        id: "round",
        label: {zh: "一轮流程", en: "A round"},
        html: {
          zh: "<p><b>准备</b>：给每条激活河道补 1 颗珍珠，按人数放仙子（单数轮放树桩、双数轮放狐像），再换 6 张玛卡雅。</p>"
            + "<p><b>探索</b>：按顺位轨依次放置标记。河段费用从上到下是 −3 / −2 / −1 / 0 / +1（+1 表示白拿 1 张营地卡），海是 0，村庄从左到右是 −2 / −1 / 0 / 0 / 0 / 0。</p>"
            + "<p><b>收集</b>：开闸后珍珠滚下，按从上到下、从左到右结算，同段内靠上的格子先挑。每人每次拿 1 颗，拿完收回标记放到顺位轨最后。之后在海的人可以任意多拿，在村庄的人从左到右各挑 1 张玛卡雅，最后所有人同时把羊驼上的珍珠交付给玛卡雅。</p>",
          en: "<p><b>Preparation</b>: refill one pearl per active river, place fairies (stumps on odd rounds, fox statues on even), refresh six Markaya.</p>"
            + "<p><b>Exploration</b>: place markers in track order. River costs run −3 / −2 / −1 / 0 / +1 top to bottom, the sea is free, and the village is −2 / −1 / 0 / 0 / 0 / 0.</p>"
            + "<p><b>Collection</b>: pearls roll, resolving top to bottom and left to right, with the upper slot in a stretch picking first. Each marker takes one pearl and returns to the back of the track. Then the sea, then the village left to right, then everyone delivers simultaneously.</p>",
        },
      },
      {
        id: "cards",
        label: {zh: "营地卡", en: "Camp cards"},
        html: {
          zh: "<p>🚩 <b>旗帜</b>（探索）：把自己另一枚未放置的标记移到顺位轨最前。</p>"
            + "<p>🏮 <b>灯笼</b>（探索）：从版图上任意拿 1 枚仙子。</p>"
            + "<p>🎒 <b>补给</b>（探索）：把自己另一枚已放置的标记免费移到任意空格。</p>"
            + "<p>🥅 <b>渔网</b>（收集）：在河道收珠时多拿 1 颗。</p>"
            + "<p>🎵 <b>乐器</b>（收集）：结交玛卡雅后把标记右移一格再拿 1 张。</p>"
            + "<p>必须成对打出才生效。🔥 火仙子可以当 1 张任意营地卡，2 枚火仙子等于任意一组对子。</p>",
          en: "<p>🚩 <b>Banner</b> (exploration): move one of your unplaced markers to the front of the track.</p>"
            + "<p>🏮 <b>Lantern</b> (exploration): take any fairy from the board.</p>"
            + "<p>🎒 <b>Supplies</b> (exploration): move one of your placed markers anywhere for free.</p>"
            + "<p>🥅 <b>Fishing net</b> (collection): take one extra pearl at your marker.</p>"
            + "<p>🎵 <b>Instrument</b> (collection): after befriending, step right and take another Markaya.</p>"
            + "<p>Pairs only. A 🔥 fire fairy counts as one camp card, and two of them form any pair.</p>",
        },
      },
      {
        id: "fairies",
        label: {zh: "仙子", en: "Fairies"},
        html: {
          zh: "<p>🔥 <b>火</b>：当作 1 张营地卡。</p>"
            + "<p>⛰️ <b>土</b>：把至多 3 颗珍珠在羊驼与自己的玛卡雅之间移动。</p>"
            + "<p>🌬️ <b>风</b>：完全免除 1 次放置费用。</p>"
            + "<p>💡 <b>光</b>：交付时把 1 个存放孔变成彩虹孔。</p>"
            + "<p>💧 <b>水</b>：在河道收珠时拿 2 颗而不是 1 颗。</p>"
            + "<p>用掉的仙子移出游戏，也不再计入「未使用仙子」类目标。</p>",
          en: "<p>🔥 <b>Fire</b>: counts as one camp card.</p>"
            + "<p>⛰️ <b>Earth</b>: move up to 3 pearls between your alpaca and your Markaya.</p>"
            + "<p>🌬️ <b>Wind</b>: ignore one placement cost entirely.</p>"
            + "<p>💡 <b>Light</b>: turn one storage spot into a rainbow spot when delivering.</p>"
            + "<p>💧 <b>Water</b>: take 2 pearls instead of 1 from a river.</p>"
            + "<p>Spent fairies leave the game and stop counting for unused-fairy objectives.</p>",
        },
      },
      {
        id: "scoring",
        label: {zh: "计分", en: "Scoring"},
        html: {
          zh: "<p>玛卡雅上的珍珠按颜色计分（🟢1 🔵2 🌸3 🟣4 ⚪5），羊驼上的珍珠 0 分。</p>"
            + "<p>外向型目标不需要填满板块：每张填满的玛卡雅 3 分、自己所有玛卡雅上每颗指定色 2 分、每枚未使用仙子 2 分、每张手牌 1 分，以及「最多某色珍珠」「最多仙子」「最多手牌」等独占目标（并列不得分）。</p>"
            + "<p>内向型目标必须填满本板块：本板块填满 8 分、4 颗同色 6 分、5 颗 5 色 5 分。</p>"
            + "<p>每张羊驼任务卡 4 分。并列最高分共享胜利。</p>",
          en: "<p>Pearls on Markaya score by colour (1/2/3/4/5), and pearls on the alpaca score nothing.</p>"
            + "<p>Extroverted objectives do not need the tile filled: 3 per completed Markaya, 2 per pearl of a colour, 2 per unused fairy, 1 per card in hand, plus exclusive majorities (no points on a tie).</p>"
            + "<p>Introverted objectives need this tile full: 8 for a full tile, 6 for four of a colour, 5 for five different colours.</p>"
            + "<p>Each alpaca goal card is worth 4. Ties share the victory.</p>",
        },
      },
    ],
  };

  function initHelpExplain() {
    if (helpWidget || typeof window.obgCreateHelp !== "function") return;
    helpWidget = window.obgCreateHelp(TWELVE_RIVERS_HELP_CONFIG);
    explainWidget = window.obgCreateExplain({
      gameId: GAME,
      attribute: "data-tr12-explain",
      explanations: TWELVE_RIVERS_EXPLAIN,
      button: byId("ExplainBtn"),
      root: () => panel,
      bypass: ["#twelveRiversHelpBtn", "#twelveRiversExplainBtn"],
    });
    byId("HelpBtn").addEventListener("click", () => {
      explainWidget?.exit();
      helpWidget.open();
    });
    byId("ExplainBtn").addEventListener("click", () => explainWidget?.toggle());
  }

  // ------------------------------------------------------------------ wiring
  byId("Next").addEventListener("click", () => send({type: "next_round"}));
  byId("ZoomIn").addEventListener("click", () => { userZoomed = true; zoomBy(0.82); });
  byId("ZoomOut").addEventListener("click", () => { userZoomed = true; zoomBy(1.22); });
  byId("Fit").addEventListener("click", () => { userZoomed = true; fitMap(); });
  byId("Origin").addEventListener("click", () => { userZoomed = true; vb = {x: 0, y: 0, w: W, h: H}; applyViewBox(); });
  window.addEventListener("resize", () => { if (!userZoomed) defaultView(); });
  byId("DockBtn").addEventListener("click", () => byId("Dock").classList.toggle("open"));
  byId("DockClose").addEventListener("click", () => byId("Dock").classList.remove("open"));
  panel.addEventListener("click", event => {
    if (selection && !event.target.closest(".tr12-slot-card") && !event.target.closest(".tr12-slot")) {
      if (selection.pendingPair) return;
      cancelSelection();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && active()) {
      if (selection || chosen) cancelSelection();
      byId("Dock").classList.remove("open");
    }
  });

  function clearState() {
    view = null;
    selection = null;
    chosen = null;
    delivery = null;
    pending = false;
    signature = "";
    clearTimeout(tipTimer);
    hideTip();
    explainWidget?.exit();
    ["Track", "Alpaca", "AlpacaGoals", "Hand", "Fairies", "Markaya", "Offer",
     "Players", "Results", "Log", "Map"].forEach(id => byId(id)?.replaceChildren());
    overlay.replaceChildren();
    overlay.classList.add("hidden");
    byId("Review").classList.add("hidden");
    byId("Next").classList.add("hidden");
    byId("Dock").classList.remove("open");
    text("Status", "Waiting to start");
    defaultView();
  }

  window.renderTwelveRiversGameState = data => {
    if (data?.view?.game_id !== GAME || currentGameType !== GAME
        || (data.room_id && currentRoomState?.room_id !== data.room_id)) return;
    const next = data.view;
    const nextSignature = JSON.stringify([data.room_id, next.revision, next.phase,
      next.stage, next.current_actor, next.you]);
    if (nextSignature !== signature) {
      pending = false;
      selection = null;
      chosen = null;
      delivery = null;
      hideTip();
    }
    signature = nextSignature;
    view = next;
    window.currentTwelveRiversView = next;
    render();
  };
  window.showTwelveRiversHeaderActions = visible => {
    byId("HeaderActions").style.display = visible ? "flex" : "none";
    if (!visible) clearState();
  };
  window.clearTwelveRiversState = clearState;

  function sync() {
    initHelpExplain();
    if (typeof socket !== "undefined") {
      socket.on("system:error", () => { pending = false; if (view) render(); });
      socket.on("disconnect", () => { pending = false; if (view) render(); });
      socket.on("connect", () => { pending = false; });
      socket.on("room:state", room => {
        if (room.game_type !== GAME || room.status === "lobby") clearState();
      });
    }
    defaultView();
    if (typeof lastGameStatePayload !== "undefined"
        && lastGameStatePayload?.game_type === GAME) {
      window.renderTwelveRiversGameState(lastGameStatePayload);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true});
  else sync();
})();
