(() => {
  "use strict";
  const GAME = "twelve_rivers";
  const byId = suffix => document.getElementById("twelveRivers" + suffix);
  const panel = byId("Panel");
  if (!panel) return;
  const map = byId("Map"), frame = byId("MapFrame"), overlay = byId("SlotOverlay");

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

  const element = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  };

  let view = null, pending = false, signature = "";
  let selection = null;      // {space, pay:{}, fire, wind, pairs:[], pendingPair}
  let chosen = null;         // {pearls:[], swap:[], net, water}
  let delivery = null;       // {alpaca:index|null}
  let tipTimer = null, tipTarget = null;
  let helpWidget = null, explainWidget = null;

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

  let gesture = null, suppressClick = false;
  frame.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, moved: false};
  });
  window.addEventListener("pointermove", event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) gesture.moved = true;
  });
  const endGesture = event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    suppressClick = gesture.moved || event.type === "pointercancel";
    gesture = null;
  };
  window.addEventListener("pointerup", endGesture);
  window.addEventListener("pointercancel", endGesture);
  frame.addEventListener("click", event => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

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
    map.style.setProperty("--tr12-rivers", view.active_rivers);
    const board = view.board;
    const currentSpace = myRiverSpace();
    const currentStretch = currentSpace ? currentSpace.split("#")[0] : null;
    const corner = element("span", "tr12-flow", "→");
    corner.title = "Rivers flow left to right, from upstream to downstream";
    corner.dataset.tr12Tip = corner.title;
    map.appendChild(corner);
    for (let row = 1; row <= 5; row += 1) {
      const stretch = board.stretches.find(entry => entry.row === row);
      const cost = element("span", "tr12-cost", costLabel(stretch.cost));
      cost.style.gridColumn = row + 1;
      cost.dataset.tr12Tip = stretch.cost < 0 ? "Gain 1 camp card when placing here"
        : "Placement cost: " + stretch.cost + " camp cards";
      cost.title = cost.dataset.tr12Tip;
      map.appendChild(cost);
    }
    for (let river = 1; river <= view.active_rivers; river += 1) {
      const label = element("span", "tr12-river-number", river);
      label.style.gridRow = river + 1;
      label.title = "River " + river;
      label.dataset.tr12Tip = label.title;
      map.appendChild(label);
    }
    board.stretches.filter(stretch => stretch.active).forEach(stretch => {
      const first = stretch.rivers[0];
      const last = Math.min(view.active_rivers, stretch.rivers[stretch.rivers.length - 1]);
      const region = element("div", "tr12-stretch");
      region.dataset.stretch = stretch.id;
      region.style.gridColumn = stretch.row + 1;
      region.style.gridRow = (first + 1) + " / span " + (last - first + 1);
      region.setAttribute("aria-label", "Rivers " + first + " to " + last + ", " + costLabel(stretch.cost));
      const pool = element("div", "tr12-pool");
      const pickable = currentStretch === stretch.id && available("take_pearl");
      region.classList.toggle("collecting", pickable);
      (view.pools[stretch.id] || []).forEach((color, index, pearls) => {
        const taken = pickable && chosen && chosen.pearls.filter(entry => entry === color).length
          > pearls.slice(0, index).filter(entry => entry === color).length;
        pool.appendChild(boardPearl(color, pickable, taken, () => onRiverPearl(color)));
      });
      const slots = element("div", "tr12-slot-list");
      for (let slot = 1; slot <= stretch.slots; slot += 1) {
        slots.appendChild(drawSlot(stretch.id + "#" + slot));
      }
      region.append(pool, slots);
      (board.fairy_spots || []).filter(spot => spot.stretch === stretch.id).forEach(spot => {
        const stack = view.fairy_spots[spot.id] || [];
        if (!stack.length) return;
        const fairy = button("",
          "tr12-fairy-bank", () => onFairySpot(spot.id));
        fairy.appendChild(element("span", "", FAIRY_EMOJI[stack[0]]));
        if (stack.length > 1) fairy.appendChild(element("span", "", stack.length));
        fairy.dataset.fairySpot = spot.id;
        fairy.setAttribute("aria-label", stack.length + " " + stack[0] + " fairies");
        fairy.setAttribute("aria-disabled", String(selection?.pendingPair !== "lantern"));
        pool.appendChild(fairy);
      });
      map.appendChild(region);
    });
    const sea = byId("SeaPearls");
    sea.replaceChildren();
    (view.sea || []).forEach((color, index) => {
      const taken = chosen && chosen.pearls.filter(entry => entry === color).length
        > view.sea.slice(0, index).filter(entry => entry === color).length;
      const pearl = boardPearl(color, available("take_sea_pearls"), taken, () => onSeaPearl(color));
      pearl.dataset.seaIndex = index;
      sea.appendChild(pearl);
    });
    byId("SeaSlot").replaceChildren(drawSlot("sea"));
    const village = byId("Village");
    village.replaceChildren();
    board.village.forEach((cost, index) => {
      const space = element("div", "tr12-village-space");
      const label = element("span", "tr12-cost", costLabel(cost));
      label.title = "Placement cost: " + cost + " camp cards";
      label.dataset.tr12Tip = label.title;
      space.append(label, drawSlot("v" + (index + 1)));
      village.appendChild(space);
    });
    renderSlotOverlay();
  }

  function costLabel(cost) {
    return cost > 0 ? "−" + cost : cost < 0 ? "+1" : "0";
  }

  function boardPearl(color, pickable, selected, handler) {
    const node = element(pickable ? "button" : "span", "tr12-board-pearl" + (selected ? " selected" : ""));
    const label = catalog().pearls[color].en;
    node.style.setProperty("--tr12-pearl", PEARL_HEX[color]);
    node.title = label;
    if (pickable) {
      node.type = "button";
      node.setAttribute("aria-label", label);
      node.setAttribute("aria-pressed", String(!!selected));
      node.addEventListener("click", event => { event.stopPropagation(); handler(); });
    } else node.dataset.tr12Tip = label;
    return node;
  }

  function drawSlot(spaceId) {
    const placement = view.placements[spaceId];
    const canPlace = available("place_marker") && !placement && !selection?.pendingPair;
    const movingFrom = selection?.pendingPair === "supplies-from" && placement?.pid === view.you;
    const movingTo = selection?.pendingPair === "supplies-to" && !placement;
    const selected = selection?.space === spaceId || movingFrom || movingTo;
    const node = element("button", "tr12-slot" + (placement ? " occupied" : "")
      + (canPlace ? " open" : "") + (selected ? " target" : ""));
    node.type = "button";
    node.dataset.space = spaceId;
    node.setAttribute("aria-pressed", String(!!selected));
    node.setAttribute("aria-disabled", String(!(canPlace || movingFrom || movingTo)));
    node.title = "Space " + spaceId;
    if (placement) {
      const player = view.players.find(entry => entry.player_id === placement.pid);
      node.style.setProperty("--tr12-seat", SEAT_COLORS[player ? player.color : 0]);
      node.textContent = (player ? player.name : "?").slice(0, 1).toUpperCase();
      node.title = (player ? player.name : "?") + " · " + spaceId;
      if (available("take_pearl") && placement.pid === view.you) node.classList.add("collecting");
    } else if (spaceId.startsWith("v")) node.textContent = spaceId.slice(1);
    node.setAttribute("aria-label", node.title);
    node.addEventListener("click", event => {
      event.stopPropagation();
      if (canPlace) onSlotClick(spaceId);
      else if (movingFrom) {
        selection.pairFrom = spaceId;
        selection.pendingPair = "supplies-to";
        render();
      } else if (movingTo) {
        selection.pairs.push({kind: "supplies", from: selection.pairFrom, to: spaceId});
        selection.pendingPair = null;
        render();
      }
    });
    return node;
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

  function onSlotClick(spaceId) {
    if (!available("place_marker")) return;
    selection = {space: spaceId, pay: {}, fire: 0, wind: false, pairs: [], pendingPair: null};
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
    positionSlotOverlay();
  }

  function overlayCard(spaceId, children) {
    const card = document.createElement("div");
    card.className = "tr12-slot-card";
    card.dataset.anchorSpace = spaceId;
    children.forEach(child => card.appendChild(child));
    return card;
  }

  function positionSlotOverlay() {
    overlay.querySelectorAll(".tr12-slot-card").forEach(card => {
      const anchor = [...frame.querySelectorAll(".tr12-slot")]
        .find(node => node.dataset.space === card.dataset.anchorSpace);
      if (!anchor) return;
      const box = anchor.getBoundingClientRect(), bounds = frame.getBoundingClientRect();
      const collectionPool = selection ? null : anchor.closest(".tr12-stretch, .tr12-sea-area")
        ?.querySelector(".tr12-pool");
      const region = (collectionPool?.children.length ? collectionPool : anchor).getBoundingClientRect();
      const point = {x: box.left - bounds.left + box.width / 2, y: region.top - bounds.top};
      const width = card.offsetWidth, height = card.offsetHeight;
      const top = point.y - height - 8;
      card.style.left = Math.max(8, Math.min(frame.clientWidth - width - 8, point.x - width / 2)) + "px";
      card.style.top = Math.max(8, Math.min(frame.clientHeight - height - 8,
        top < 8 ? region.bottom - bounds.top + 8 : top)) + "px";
    });
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
    const card = overlayCard(selection.space, children);
    if (!ready) card.querySelector("button").disabled = true;
    return card;
  }

  function riverCard() {
    const spaceId = myRiverSpace();
    const stretchId = spaceId.split("#")[0];
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
    return overlayCard(spaceId, children);
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
    return overlayCard("sea", children);
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
      } else slot.title = "Turn order · empty position " + (i + 1);
      slot.dataset.tr12Tip = slot.title;
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
    const scrollTop = byId("Dock").scrollTop;
    text("AlpacaCount", player.alpaca.length + " / 6");
    text("HandCount", "(" + player.hand_count + ")");
    renderAlpaca(player);
    renderGoals(player);
    renderHand(player);
    renderFairies(player);
    renderMarkaya(player);
    byId("Dock").scrollTop = scrollTop;
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
      node.dataset.tr12Tip = node.title;
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
    if (event.pointerType === "touch" || !window.matchMedia("(hover: hover)").matches) return;
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
    if (!target || target.closest("button")) return;
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
      zh: "本轮可以结交的玛卡雅，共 6 张。村庄按从左到右的顺序挑选，最先的两格分别付 2 张和 1 张营地卡。",
      en: "The six Markaya available this round. Village spaces pick from left to right. The first two cost 2 and 1 camp cards.",
    },
    board: {
      zh: "河谷版图：越靠上游费用越高但越先挑珍珠，最右侧一段反而给你 1 张营地卡。每段的格子数就是那一段能挤几个人。",
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
        id: "board",
        label: {zh: "版图操作", en: "Board controls"},
        html: {
          zh: "<p>河谷按屏宽直接排版，不需要缩放或拖动。河流编号从上到下递增，五档河段从左往右汇流，费用依次为 −3、−2、−1、0、+1。同段的族人标记从上往下结算，海洋和村庄位于河谷下方，村庄从左往右挑选玛卡雅。</p>"
            + "<p>点击空位后在原地确认，点击空白处取消。My camp 打开可关闭的营地抽屉，付费时点选营地卡，再回到版图确认。直接在地图上滑动可正常滚动页面，不会放置标记。</p>",
          en: "<p>The valley reflows to the available width without zooming or panning. River numbers increase from top to bottom. Five columns merge from left to right, costing −3, −2, −1, 0, +1. Markers in a stretch resolve from top to bottom. The sea and village sit below the rivers, and village markers choose Markaya from left to right.</p>"
            + "<p>Tap a space for its confirmation, or blank space to cancel. My camp opens a closable drawer. Choose camp cards there to pay, then return to the board to confirm. Swipe on the board to scroll the page without placing a marker.</p>",
        },
      },
      {
        id: "setup",
        label: {zh: "组件与准备", en: "Setup"},
        html: {
          zh: "<p>2–4 人。每人 3 枚族人标记、一块 6 格的羊驼版图、6 张营地卡和 1 张起始玛卡雅。</p>"
            + "<p>珍珠共 65 颗：🟢 绿 ×17（1 分）、🔵 蓝 ×15（2 分）、🌸 粉 ×13（3 分）、🟣 紫 ×11（4 分）、⚪ 白 ×9（5 分）。</p>"
            + "<p>每人启用 3 条河：2 人用编号 1–6，3 人用编号 1–9，4 人用全部 12 条。</p>",
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
            + "<p><b>探索</b>：按顺位轨依次放置标记。河段费用从左到右是 −3 / −2 / −1 / 0 / +1（+1 表示白拿 1 张营地卡），海是 0，村庄从左到右是 −2 / −1 / 0 / 0 / 0 / 0。</p>"
            + "<p><b>收集</b>：珍珠从左往右汇流，按河段列从左到右、同列从上到下结算，同段内靠上的格子先挑。每人每次拿 1 颗，拿完收回标记放到顺位轨最后。之后在海的人可以任意多拿，在村庄的人从左到右各挑 1 张玛卡雅，最后所有人同时把羊驼上的珍珠交付给玛卡雅。</p>",
          en: "<p><b>Preparation</b>: refill one pearl per active river, place fairies (stumps on odd rounds, fox statues on even), refresh six Markaya.</p>"
            + "<p><b>Exploration</b>: place markers in track order. River costs run −3 / −2 / −1 / 0 / +1 left to right, the sea is free, and the village is −2 / −1 / 0 / 0 / 0 / 0.</p>"
            + "<p><b>Collection</b>: pearls flow left to right. Resolve columns from left to right and stretches within each column from top to bottom, with the upper slot in a stretch picking first. Each marker takes one pearl and returns to the back of the track. Then the sea, then the village left to right, then everyone delivers simultaneously.</p>",
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
  window.addEventListener("resize", positionSlotOverlay);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(positionSlotOverlay).observe(frame);
  function toggleDock(open) {
    byId("Dock").classList.toggle("open", open);
    byId("DockBtn").setAttribute("aria-expanded", String(open));
  }
  byId("DockBtn").addEventListener("click", () => toggleDock(!byId("Dock").classList.contains("open")));
  byId("DockClose").addEventListener("click", () => toggleDock(false));
  panel.addEventListener("click", event => {
    if (selection && !event.target.closest("button, .tr12-slot-card, .tr12-slot-group, .tr12-dock")) {
      if (selection.pendingPair) return;
      cancelSelection();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && active()) {
      if (selection || chosen) cancelSelection();
      toggleDock(false);
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
     "Players", "Results", "Log", "Map", "SeaPearls", "SeaSlot", "Village"].forEach(id => byId(id)?.replaceChildren());
    overlay.replaceChildren();
    overlay.classList.add("hidden");
    byId("Review").classList.add("hidden");
    byId("Next").classList.add("hidden");
    toggleDock(false);
    text("Status", "Waiting to start");
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
    if (typeof lastGameStatePayload !== "undefined"
        && lastGameStatePayload?.game_type === GAME) {
      window.renderTwelveRiversGameState(lastGameStatePayload);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true});
  else sync();
})();
