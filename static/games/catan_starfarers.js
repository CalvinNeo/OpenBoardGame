(() => {
  "use strict";

  const RESOURCE_META = {
    ore: { emoji: "🔴⛏️", label: "Ore", color: "#ef5b5b" },
    fuel: { emoji: "🟠⛽", label: "Fuel", color: "#f59f45" },
    carbon: { emoji: "🔵💠", label: "Carbon", color: "#50a8e8" },
    food: { emoji: "🟢🌿", label: "Food", color: "#62c98b" },
    goods: { emoji: "🟣📦", label: "Goods", color: "#b384df" },
  };
  const RESOURCE_IDS = Object.keys(RESOURCE_META);
  const PLAYER_COLORS = ["#64d8ff", "#ff8b75", "#9fe870", "#d9a4ff"];
  const PHASE_LABELS = {
    production: "Production",
    seven_discard: "Tribute",
    seven_steal: "Tribute",
    trade_build: "Trade & Build",
    encounter_reader: "Encounter",
    encounter_choice: "Encounter",
    encounter_reveal: "Encounter",
    flight: "Flight",
    friendship_choice: "Friendship",
    turn_review: "Turn Review",
    game_over: "Game Over",
  };

  let view = null;
  let pending = false;
  let pendingTimer = null;
  let selectedShipId = null;
  let explainMode = false;
  let draftKey = "";
  let discardDraft = blankBundle();
  let offerGiveDraft = blankBundle();
  let offerWantDraft = blankBundle();

  const panel = document.getElementById("catanStarfarersPanel");
  const headerActions = document.getElementById("catanStarfarersHeaderActions");
  const helpBtn = document.getElementById("catanStarfarersHelpBtn");
  const explainBtn = document.getElementById("catanStarfarersExplainBtn");
  const helpModal = document.getElementById("catanStarfarersHelpModal");
  const explainModal = document.getElementById("catanStarfarersExplainModal");
  const helpCloseBtn = document.getElementById("catanStarfarersHelpCloseBtn");
  const explainCloseBtn = document.getElementById("catanStarfarersExplainCloseBtn");
  const helpContent = document.getElementById("catanStarfarersHelpContent");
  const explainContent = document.getElementById("catanStarfarersExplainContent");
  const turnEl = document.getElementById("catanStarfarersTurn");
  const phaseEl = document.getElementById("catanStarfarersPhase");
  const setupEl = document.getElementById("catanStarfarersSetup");
  const statusEl = document.getElementById("catanStarfarersStatus");
  const playersEl = document.getElementById("catanStarfarersPlayers");
  const mapEl = document.getElementById("catanStarfarersMap");
  const mapHintEl = document.getElementById("catanStarfarersMapHint");
  const mothershipEl = document.getElementById("catanStarfarersMothership");
  const handEl = document.getElementById("catanStarfarersHand");
  const reserveEl = document.getElementById("catanStarfarersReserveCount");
  const actionHeadingEl = document.getElementById("catanStarfarersActionHeading");
  const actionHintEl = document.getElementById("catanStarfarersActionHint");
  const actionsEl = document.getElementById("catanStarfarersActions");
  const logEl = document.getElementById("catanStarfarersLog");
  const liveEl = document.getElementById("catanStarfarersLiveRegion");

  const EXPLANATIONS = {
    status: ["Turn Status", "The active captain and current server phase appear here. The server, not the browser, decides every random result and legal transition."],
    players: ["Captain Boards", "Each board shows public VP, total hand size, physical upgrades, Fame, friendship cards, active status, and review readiness. Exact opponent resources remain private."],
    map: ["Star Map", "Lines are legal movement edges. Select one of your ships, then choose a glowing adjacent node. Hidden sectors reveal only when reached in Explorer or Wild Space."],
    mothership: ["Mothership", "Two balls set flight speed: Blue 1, Yellow 2, Red 3. Black triggers an encounter and uses base speed 3. Boosters and Scientist abilities add speed."],
    resources: ["Your Hold", "Only you see the exact mix in your hold. Opponents see its total size. Resource cards are conserved between player holds, Earth Reserve, and the public supply."],
    actions: ["Command Console", "Only actions legal in the current phase are enabled. Costs and targets are rechecked by the server when you click."],
    production: ["Production", "Roll 2d6. Matching Colonies and Spaceports each produce one card. Earth then sends 2 cards at 4–7 VP, 1 at 8–9 VP, and none at 10+ VP."],
    tribute: ["A Roll of 7", "Players above their hand limit secretly discard half, the active captain steals one random card, other captains draw one reserve card, then the active captain takes normal reserve aid."],
    trade: ["Trading", "The active captain may open a structured offer, finalize one response, or trade with the public supply. Goods normally trade 2:1; other resources trade 3:1 unless a friendship card improves the rate."],
    build: ["Build", "Ships launch from one of your Spaceports. Colony Ships carry a Colony; Trade Ships carry a Trade Station. Upgrades improve every ship in your fleet."],
    ships: ["Ships & Movement", "Each unfinished ship may move up to the displayed speed. Movement is sent one edge at a time so discoveries resolve before the next step."],
    encounter: ["Encounter Reader", "The captain on the active player's left privately sees the full encounter. They read the prompt, the active player chooses, then the Reader reveals the server-defined result."],
    friendship: ["Friendship Card", "Establishing a Trade Station grants one remaining card from that civilization. The player with a strict station majority holds its 2 VP Friendship Marker; ties keep the current holder."],
    review: ["Turn Review", "The board pauses after every flight. Every human and Bot seat must confirm before the next captain begins Production."],
    log: ["Flight Log", "The log contains only public outcomes. Hidden card types, unrevealed sectors, future random results, and private encounter branches never appear."],
  };

  const HELP_HTML = `
    <div class="catan-starfarers-rules">
      <p><strong>Reach 15 VP during your own turn.</strong> Expand from the Catanian home systems, explore the frontier, meet alien civilizations, and earn Fame.</p>
      <h3>Turn sequence</h3>
      <ol>
        <li><strong>Production:</strong> roll 2d6, resolve matching worlds, then draw from Earth Reserve according to your VP.</li>
        <li><strong>Trade &amp; Build:</strong> trade with the active captain or supply, build ships and Spaceports, and install upgrades.</li>
        <li><strong>Flight:</strong> shake the Mothership, resolve a Black-ball encounter, then move each ship up to the shared speed.</li>
        <li><strong>Turn Review:</strong> all seats inspect the final map and click <em>Next Turn</em>.</li>
      </ol>
      <h3>Resources &amp; costs</h3>
      <table><thead><tr><th>Build</th><th>Cost</th></tr></thead><tbody>
        <tr><td>🚀 Colony Ship</td><td>1 Ore + 1 Fuel + 1 Carbon + 1 Food</td></tr>
        <tr><td>🛸 Trade Ship</td><td>1 Ore + 1 Fuel + 2 Goods</td></tr>
        <tr><td>🛰️ Spaceport</td><td>3 Carbon + 2 Food</td></tr>
        <tr><td>🚀 Booster</td><td>2 Fuel</td></tr>
        <tr><td>💥 Cannon</td><td>2 Carbon</td></tr>
        <tr><td>📦 Freight Pod</td><td>2 Ore</td></tr>
      </tbody></table>
      <h3>Production and 7</h3>
      <p>Every Colony or Spaceport on the rolled number produces one matching resource; a Spaceport does not double production. If the supply cannot satisfy an entire resource type, nobody receives that type. On 7, every player above the limit secretly returns half their cards, then the active captain steals one random card.</p>
      <h3>Exploration</h3>
      <p>Entering a hidden sector discovers it. Entering an unexplored system reveals its production number. Pirate bases need effective Cannons; ice worlds need physical Freight Pods. Clearing either grants a permanent 1 VP medal.</p>
      <h3>Ships and destinations</h3>
      <p>A Colony Ship may settle an open, cleared system. A Trade Ship may establish a station at an outpost when your physical Freight count is greater than the stations already there. Ships may pass through occupied nodes, but invalid destination types cannot be used to finish a move.</p>
      <h3>Friendship &amp; scoring</h3>
      <p>Friendship cards are permanent public abilities. A civilization's Friendship Marker is worth 2 VP. Colonies are 1 VP, Spaceports 2 VP, Trade Stations 1 VP, permanent medals 1 VP, and each pair of Fame pieces 1 VP.</p>
      <h3>Privacy and digital rulings</h3>
      <p>The server keeps hands, reserve order, encounters, and hidden sectors private. Movement is submitted edge by edge. A disconnected Reader pauses an encounter until they return. General controls use English; game resources combine color, icon, and text.</p>
    </div>`;

  function blankBundle() {
    return { ore: 0, fuel: 0, carbon: 0, food: 0, goods: 0 };
  }

  function hasAction(type) {
    return Boolean(view && (view.legal_actions || []).includes(type));
  }

  function playerById(playerId) {
    return (view && view.players || []).find((item) => item.player_id === playerId) || null;
  }

  function playerName(playerId) {
    const item = playerById(playerId);
    return item ? item.name || item.player_id : playerId || "-";
  }

  function playerColor(playerId) {
    const item = playerById(playerId);
    const seat = item && Number.isFinite(Number(item.seat)) ? Number(item.seat) : 0;
    return PLAYER_COLORS[((seat % PLAYER_COLORS.length) + PLAYER_COLORS.length) % PLAYER_COLORS.length];
  }

  function setModal(modal, visible, returnFocus = null) {
    if (!modal) return;
    modal.classList.toggle("hidden", !visible);
    modal.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible) {
      const close = modal.querySelector("button");
      if (close) window.setTimeout(() => close.focus(), 0);
    } else if (returnFocus && typeof returnFocus.focus === "function") {
      returnFocus.focus();
    }
  }

  function setExplainMode(enabled) {
    explainMode = Boolean(enabled);
    if (panel) panel.classList.toggle("is-explaining", explainMode);
    if (explainBtn) explainBtn.setAttribute("aria-pressed", explainMode ? "true" : "false");
  }

  function openExplanation(key) {
    const entry = EXPLANATIONS[key];
    if (!entry || !explainContent) return;
    const heading = document.createElement("h3");
    heading.textContent = entry[0];
    const copy = document.createElement("p");
    copy.textContent = entry[1];
    explainContent.replaceChildren(heading, copy);
    setExplainMode(false);
    setModal(explainModal, true);
  }

  function dispatch(action) {
    if (pending || !action) return;
    pending = true;
    if (pendingTimer) window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => {
      pending = false;
      pendingTimer = null;
      if (view) renderActions();
    }, 2600);
    if (typeof sendAction === "function") sendAction(action);
    renderActions();
  }

  function createButton(label, action, options = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (options.className) button.className = options.className;
    if (options.explain) button.dataset.catanStarfarersExplain = options.explain;
    button.disabled = pending || options.disabled === true;
    if (options.title) button.title = options.title;
    if (action) button.addEventListener("click", () => dispatch(action));
    return button;
  }

  function bundleTotal(bundle) {
    return RESOURCE_IDS.reduce((sum, resource) => sum + Number(bundle[resource] || 0), 0);
  }

  function formatBundle(bundle) {
    const values = RESOURCE_IDS
      .filter((resource) => Number(bundle && bundle[resource] || 0) > 0)
      .map((resource) => `${RESOURCE_META[resource].emoji} ${Number(bundle[resource])}`);
    return values.join(" · ") || "nothing";
  }

  function formatCost(cost) {
    return formatBundle(cost || {});
  }

  function canPay(cost) {
    return RESOURCE_IDS.every((resource) => (
      Number(view && view.your_hand && view.your_hand[resource] || 0)
        >= Number(cost && cost[resource] || 0)
    ));
  }

  function resetDraftsIfNeeded(nextView) {
    const key = `${nextView.game_index}:${nextView.turn_no}:${nextView.phase}:${nextView.production && nextView.production.pending_discard_count || 0}`;
    if (key === draftKey) return;
    draftKey = key;
    discardDraft = blankBundle();
    if (nextView.phase !== "trade_build") {
      offerGiveDraft = blankBundle();
      offerWantDraft = blankBundle();
    }
  }

  function renderStatus() {
    if (!view || !statusEl) return;
    const activeName = playerName(view.active_player_id);
    let copy = `${activeName} is resolving ${PHASE_LABELS[view.phase] || view.phase}.`;
    statusEl.className = "catan-starfarers-status";
    if (view.game_over) {
      copy = `${(view.winner_ids || []).map(playerName).join(" & ")} won the frontier.`;
    } else if (view.phase === "turn_review") {
      copy = `Flight complete · ${Number(view.review_progress.done || 0)} / ${Number(view.review_progress.total || 0)} seats ready.`;
    } else if (view.phase === "seven_discard") {
      copy = view.production.pending_discard_count
        ? `Tribute due: secretly return exactly ${view.production.pending_discard_count} cards.`
        : "Waiting for every affected captain to pay tribute.";
      statusEl.classList.add("is-danger");
    } else if (view.active_player_id === view.you) {
      copy = `Your turn · ${PHASE_LABELS[view.phase] || view.phase}.`;
      statusEl.classList.add("is-your-turn");
    }
    statusEl.textContent = copy;
    if (turnEl) turnEl.textContent = String(view.turn_no || "-");
    if (phaseEl) phaseEl.textContent = PHASE_LABELS[view.phase] || view.phase || "-";
    if (setupEl) setupEl.textContent = String(view.setup_mode || "beginner").replaceAll("_", " ");
  }

  function renderPlayers() {
    if (!playersEl || !view) return;
    playersEl.innerHTML = "";
    (view.players || []).forEach((item) => {
      const card = document.createElement("article");
      card.className = "catan-starfarers-player";
      card.style.setProperty("--player-color", playerColor(item.player_id));
      card.classList.toggle("is-you", item.player_id === view.you);
      card.classList.toggle("is-active", item.player_id === view.active_player_id);

      const heading = document.createElement("div");
      heading.className = "catan-starfarers-player-heading";
      const name = document.createElement("strong");
      name.textContent = `${item.is_bot ? "🤖 " : ""}${item.name || item.player_id}${item.player_id === view.you ? " · You" : ""}`;
      name.title = item.name || item.player_id;
      const vp = document.createElement("span");
      vp.textContent = `⭐ ${Number(item.vp || 0)}`;
      heading.append(name, vp);

      const stats = document.createElement("div");
      stats.className = "catan-starfarers-player-stats";
      stats.innerHTML = `<span>🃏 ${Number(item.hand_count || 0)}</span><span>🏅 ${Number(item.fame_pieces || 0)}</span><span>🎖️ ${(item.permanent_medals || []).length}</span>${item.ready ? "<span>✓ Ready</span>" : ""}`;
      const upgrades = document.createElement("div");
      upgrades.className = "catan-starfarers-player-upgrades";
      upgrades.innerHTML = `<span>🚀 ${Number(item.upgrades && item.upgrades.booster || 0)}</span><span>💥 ${Number(item.upgrades && item.upgrades.cannon || 0)}</span><span>📦 ${Number(item.upgrades && item.upgrades.freight || 0)}</span>`;
      (item.friendship_cards || []).slice(0, 2).forEach((friendship) => {
        const chip = document.createElement("span");
        chip.textContent = `🤝 ${friendship.name}`;
        chip.title = friendship.description || friendship.name;
        upgrades.appendChild(chip);
      });
      card.append(heading, stats, upgrades);
      playersEl.appendChild(card);
    });
  }

  function svgElement(name, attrs = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  }

  function nodeCopy(node, sector) {
    if (node.kind === "home") return { kind: "home", icon: RESOURCE_META[node.resource].emoji.slice(0, 2), number: node.number, label: "Home" };
    if (!sector) return { kind: node.kind === "space" ? "space" : "void", icon: "·", number: "", label: "" };
    if (sector.kind === "hidden") return { kind: "hidden", icon: "?", number: "", label: "Unknown" };
    if (sector.kind === "system") {
      const resource = RESOURCE_META[sector.resource] || { emoji: "🪐" };
      const obstacle = sector.obstacle && !sector.obstacle_cleared
        ? sector.obstacle.kind === "pirate" ? "☠️" : "🧊"
        : resource.emoji.slice(0, 2);
      return { kind: "system", icon: obstacle, number: sector.number == null ? "?" : sector.number, label: sector.name };
    }
    if (sector.kind === "outpost") return { kind: "outpost", icon: "🤝", number: "", label: sector.name };
    if (sector.kind === "empty") return { kind: "empty", icon: "✦", number: "", label: sector.name };
    return { kind: "void", icon: "·", number: "", label: "Void" };
  }

  function renderMap() {
    if (!mapEl || !view) return;
    mapEl.innerHTML = "";
    const nodes = new Map((view.board.nodes || []).map((node) => [node.id, node]));
    const sectors = new Map((view.board.sectors || []).map((sector) => [sector.node_id, sector]));
    const legalTargets = new Set(selectedShipId && view.legal_move_targets
      ? view.legal_move_targets[selectedShipId] || []
      : []);
    if (selectedShipId && !(view.board.ships || []).some((ship) => ship.id === selectedShipId)) {
      selectedShipId = null;
      legalTargets.clear();
    }

    const edgeLayer = svgElement("g", { "aria-hidden": "true" });
    (view.board.edges || []).forEach(([firstId, secondId]) => {
      const first = nodes.get(firstId);
      const second = nodes.get(secondId);
      if (!first || !second) return;
      edgeLayer.appendChild(svgElement("line", {
        x1: first.x * 1000, y1: first.y * 650, x2: second.x * 1000, y2: second.y * 650,
        class: "catan-starfarers-edge",
      }));
    });
    mapEl.appendChild(edgeLayer);

    const nodeLayer = svgElement("g");
    (view.board.nodes || []).forEach((node) => {
      const sector = sectors.get(node.id);
      const copy = nodeCopy(node, sector);
      const x = node.x * 1000;
      const y = node.y * 650;
      const group = svgElement("g", {
        class: `catan-starfarers-node is-${copy.kind}${legalTargets.has(node.id) ? " is-target" : ""}`,
        role: legalTargets.has(node.id) ? "button" : "img",
        tabindex: legalTargets.has(node.id) ? "0" : "-1",
        "aria-label": `${copy.label || "Space node"}${copy.number !== "" ? `, number ${copy.number}` : ""}${legalTargets.has(node.id) ? ", legal movement target" : ""}`,
        "data-catan-starfarers-explain": "map",
      });
      const radius = copy.kind === "space" ? 8 : copy.kind === "home" ? 24 : 29;
      group.appendChild(svgElement("circle", { cx: x, cy: y, r: radius, class: "catan-starfarers-node-core" }));
      group.appendChild(svgElement("circle", { cx: x, cy: y, r: 38, class: "catan-starfarers-node-hit" }));
      if (copy.kind !== "space") {
        const icon = svgElement("text", { x, y: y + 6 });
        icon.textContent = copy.icon;
        group.appendChild(icon);
        if (copy.number !== "") {
          const number = svgElement("text", { x: x + 25, y: y - 19, class: "catan-starfarers-node-label" });
          number.textContent = String(copy.number);
          group.appendChild(number);
        }
        const label = svgElement("text", { x, y: y + 43, class: "catan-starfarers-node-label" });
        label.textContent = String(copy.label || "").slice(0, 18);
        group.appendChild(label);
      }
      const move = () => {
        if (selectedShipId && legalTargets.has(node.id)) {
          dispatch({ type: "move_ship_step", ship_id: selectedShipId, node_id: node.id });
        }
      };
      group.addEventListener("click", move);
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          move();
        }
      });
      nodeLayer.appendChild(group);
    });
    mapEl.appendChild(nodeLayer);

    const pieceLayer = svgElement("g");
    const buildingOffsets = new Map();
    (view.board.buildings || []).forEach((building) => {
      const node = nodes.get(building.node_id);
      if (!node) return;
      const offset = buildingOffsets.get(building.node_id) || 0;
      buildingOffsets.set(building.node_id, offset + 1);
      const x = node.x * 1000 - 30 + offset * 13;
      const y = node.y * 650 + 24;
      let shape;
      if (building.kind === "spaceport") {
        shape = svgElement("circle", { cx: x, cy: y, r: 9, fill: playerColor(building.player_id), class: "catan-starfarers-building" });
        shape.setAttribute("stroke-dasharray", "3 2");
      } else if (building.kind === "trade_station") {
        shape = svgElement("polygon", { points: `${x},${y - 10} ${x + 9},${y} ${x},${y + 10} ${x - 9},${y}`, fill: playerColor(building.player_id), class: "catan-starfarers-building" });
      } else {
        shape = svgElement("rect", { x: x - 7, y: y - 7, width: 14, height: 14, rx: 3, fill: playerColor(building.player_id), class: "catan-starfarers-building" });
      }
      const title = svgElement("title");
      title.textContent = `${playerName(building.player_id)} · ${building.kind.replace("_", " ")}`;
      shape.appendChild(title);
      pieceLayer.appendChild(shape);
    });

    const shipOffsets = new Map();
    (view.board.ships || []).forEach((ship) => {
      const node = nodes.get(ship.node_id);
      if (!node) return;
      const offset = shipOffsets.get(ship.node_id) || 0;
      shipOffsets.set(ship.node_id, offset + 1);
      const x = node.x * 1000 + 25 + offset * 18;
      const y = node.y * 650 - 22;
      const group = svgElement("g", {
        class: `catan-starfarers-ship${ship.id === selectedShipId ? " is-selected" : ""}`,
        role: "button",
        tabindex: ship.player_id === view.you ? "0" : "-1",
        "aria-label": `${playerName(ship.player_id)} ${ship.kind} ship${ship.id === selectedShipId ? ", selected" : ""}`,
        "data-catan-starfarers-explain": "ships",
      });
      group.style.setProperty("--ship-color", playerColor(ship.player_id));
      group.appendChild(svgElement("circle", { cx: x, cy: y, r: 15 }));
      const label = svgElement("text", { x, y: y + 5 });
      label.textContent = ship.kind === "colony" ? "C" : "T";
      group.appendChild(label);
      const select = (event) => {
        if (event) event.stopPropagation();
        if (ship.player_id !== view.you || view.phase !== "flight") return;
        selectedShipId = selectedShipId === ship.id ? null : ship.id;
        renderMap();
        renderActions();
      };
      group.addEventListener("click", select);
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select(event);
        }
      });
      pieceLayer.appendChild(group);
    });
    mapEl.appendChild(pieceLayer);
    if (mapHintEl) {
      if (selectedShipId) {
        const remaining = view.flight && view.flight.movement_remaining
          ? Number(view.flight.movement_remaining[selectedShipId] || 0)
          : 0;
        mapHintEl.textContent = `${selectedShipId} selected · ${remaining} movement remaining · choose a glowing adjacent node.`;
      } else {
        mapHintEl.textContent = view.phase === "flight"
          ? "Select one of your ships to plot its next edge. Click blank space to cancel selection."
          : "The map remains fully inspectable while other phases resolve.";
      }
    }
  }

  function renderMothership() {
    if (!mothershipEl || !view) return;
    const flight = view.flight;
    if (!flight || !Array.isArray(flight.balls)) {
      mothershipEl.textContent = "No flight roll";
      return;
    }
    const icon = { yellow: "🟡", blue: "🔵", red: "🔴", black: "⚫" };
    mothershipEl.textContent = `${flight.balls.map((ball) => icon[ball] || ball).join(" + ")} · Speed ${Number(flight.speed || 0)}`;
  }

  function renderHand() {
    if (!handEl || !view) return;
    handEl.innerHTML = "";
    RESOURCE_IDS.forEach((resource) => {
      const item = document.createElement("div");
      item.className = "catan-starfarers-resource";
      item.style.borderColor = `${RESOURCE_META[resource].color}66`;
      const icon = document.createElement("span");
      icon.textContent = RESOURCE_META[resource].emoji;
      const count = document.createElement("strong");
      count.textContent = String(Number(view.your_hand && view.your_hand[resource] || 0));
      const label = document.createElement("small");
      label.textContent = RESOURCE_META[resource].label;
      item.append(icon, count, label);
      handEl.appendChild(item);
    });
    if (reserveEl) reserveEl.textContent = `Earth Reserve · ${Number(view.reserve_count || 0)}`;
  }

  function addSubheading(text) {
    const heading = document.createElement("div");
    heading.className = "catan-starfarers-subheading";
    heading.textContent = text;
    actionsEl.appendChild(heading);
    return heading;
  }

  function addStepperGrid(bundle, maximums, onChange, explain = "trade") {
    const grid = document.createElement("div");
    grid.className = "catan-starfarers-stepper-grid";
    RESOURCE_IDS.forEach((resource) => {
      const row = document.createElement("div");
      row.className = "catan-starfarers-stepper";
      row.dataset.catanStarfarersExplain = explain;
      const label = document.createElement("span");
      label.textContent = `${RESOURCE_META[resource].emoji} ${RESOURCE_META[resource].label}`;
      const minus = createButton("−", null, { disabled: pending || Number(bundle[resource] || 0) <= 0, explain });
      const output = document.createElement("output");
      output.textContent = String(Number(bundle[resource] || 0));
      const plus = createButton("+", null, { disabled: pending || Number(bundle[resource] || 0) >= Number(maximums[resource] || 0), explain });
      minus.addEventListener("click", (event) => {
        event.stopImmediatePropagation();
        if (minus.disabled) return;
        bundle[resource] = Math.max(0, Number(bundle[resource] || 0) - 1);
        onChange();
      });
      plus.addEventListener("click", (event) => {
        event.stopImmediatePropagation();
        if (plus.disabled) return;
        bundle[resource] = Math.min(Number(maximums[resource] || 0), Number(bundle[resource] || 0) + 1);
        onChange();
      });
      row.append(label, minus, output, plus);
      grid.appendChild(row);
    });
    actionsEl.appendChild(grid);
  }

  function renderProductionActions() {
    actionHeadingEl.textContent = "Production";
    actionHintEl.textContent = hasAction("roll_production")
      ? "Roll two production dice. Earth Reserve aid follows automatically."
      : `Waiting for ${playerName(view.active_player_id)} to roll.`;
    actionsEl.appendChild(createButton("🎲 Roll Production", { type: "roll_production" }, {
      className: "is-primary", disabled: !hasAction("roll_production"), explain: "production",
    }));
  }

  function renderTributeActions() {
    const needed = Number(view.production.pending_discard_count || 0);
    actionHeadingEl.textContent = "Tribute on 7";
    if (view.phase === "seven_discard") {
      actionHintEl.textContent = needed
        ? `Return exactly ${needed} cards. Your selection stays private.`
        : "Waiting for affected captains to finish their private discards.";
      if (!needed) return;
      addStepperGrid(discardDraft, view.your_hand || blankBundle(), renderActions, "tribute");
      const selected = bundleTotal(discardDraft);
      actionsEl.appendChild(createButton(`Return ${selected} / ${needed}`, {
        type: "discard_resources", resources: { ...discardDraft },
      }, { className: "is-danger", disabled: !hasAction("discard_resources") || selected !== needed, explain: "tribute" }));
      return;
    }
    actionHintEl.textContent = hasAction("choose_steal_target")
      ? "Choose one captain; the server takes one of their cards uniformly at random."
      : "Waiting for the active captain to complete tribute.";
    const grid = document.createElement("div");
    grid.className = "catan-starfarers-button-grid";
    (view.production.steal_targets || []).forEach((playerId) => {
      grid.appendChild(createButton(`🃏 ${playerName(playerId)}`, {
        type: "choose_steal_target", target_player_id: playerId,
      }, { disabled: !hasAction("choose_steal_target"), explain: "tribute" }));
    });
    actionsEl.appendChild(grid);
  }

  function buildCard(label, detail, action, disabled = false) {
    const card = document.createElement("div");
    card.className = "catan-starfarers-build-card";
    card.dataset.catanStarfarersExplain = "build";
    const strong = document.createElement("strong");
    strong.textContent = label;
    const small = document.createElement("small");
    small.textContent = detail;
    const button = createButton("Build", action, { disabled, explain: "build" });
    card.append(strong, small, button);
    return card;
  }

  function renderBuildGrid() {
    addSubheading("Build");
    const grid = document.createElement("div");
    grid.className = "catan-starfarers-build-grid";
    const port = (view.your_spaceports || [])[0];
    const colony = (view.your_colonies || [])[0];
    const shipSupply = view.your_supply || {};
    const upgradeSupply = view.upgrade_supply || {};
    grid.appendChild(buildCard("🚀 Colony Ship", formatCost(view.build_costs.colony_ship), {
      type: "build_ship", ship_type: "colony", spaceport_id: port && port.id,
    }, !hasAction("build_ship") || !port || !canPay(view.build_costs.colony_ship)
      || Number(shipSupply.transports || 0) < 1 || Number(shipSupply.colonies || 0) < 1));
    grid.appendChild(buildCard("🛸 Trade Ship", formatCost(view.build_costs.trade_ship), {
      type: "build_ship", ship_type: "trade", spaceport_id: port && port.id,
    }, !hasAction("build_ship") || !port || !canPay(view.build_costs.trade_ship)
      || Number(shipSupply.transports || 0) < 1 || Number(shipSupply.trade_stations || 0) < 1));
    grid.appendChild(buildCard("🛰️ Spaceport", formatCost(view.build_costs.spaceport), {
      type: "build_spaceport", colony_id: colony && colony.id,
    }, !hasAction("build_spaceport") || !colony || !canPay(view.build_costs.spaceport)
      || Number(shipSupply.shipyards || 0) < 1));
    [
      ["booster", "🚀 Booster"], ["cannon", "💥 Cannon"], ["freight", "📦 Freight"],
    ].forEach(([upgrade, label]) => {
      grid.appendChild(buildCard(label, formatCost(view.build_costs[upgrade]), {
        type: "build_upgrade", upgrade_type: upgrade,
      }, !hasAction("build_upgrade") || !canPay(view.build_costs[upgrade])
        || Number(upgradeSupply[upgrade] || 0) < 1));
    });
    actionsEl.appendChild(grid);
  }

  function renderSupplyTrade() {
    addSubheading("Supply trade");
    const box = document.createElement("div");
    box.className = "catan-starfarers-trade-box";
    box.dataset.catanStarfarersExplain = "trade";
    const row = document.createElement("div");
    row.className = "catan-starfarers-trade-row";
    const give = document.createElement("select");
    const receive = document.createElement("select");
    RESOURCE_IDS.forEach((resource, index) => {
      const giveOption = document.createElement("option");
      giveOption.value = resource;
      giveOption.textContent = `${RESOURCE_META[resource].emoji} ${RESOURCE_META[resource].label} ${view.bank_rates[resource]}:1`;
      give.appendChild(giveOption);
      const receiveOption = document.createElement("option");
      receiveOption.value = resource;
      receiveOption.textContent = `${RESOURCE_META[resource].emoji} ${RESOURCE_META[resource].label}`;
      if (index === 1) receiveOption.selected = true;
      receive.appendChild(receiveOption);
    });
    const trade = createButton("Trade", null, { disabled: true, explain: "trade" });
    const syncTrade = () => {
      const rate = Number(view.bank_rates[give.value] || 0);
      trade.disabled = pending || !hasAction("trade_with_supply") || give.value === receive.value
        || Number(view.your_hand[give.value] || 0) < rate
        || Number(view.resource_supply[receive.value] || 0) < 1;
      trade.title = trade.disabled
        ? "Choose different resources and make sure your hold covers the displayed rate."
        : `Trade ${rate} ${give.value} for 1 ${receive.value}`;
    };
    trade.addEventListener("click", (event) => {
      event.stopImmediatePropagation();
      if (trade.disabled) return;
      dispatch({ type: "trade_with_supply", give_resource: give.value, receive_resource: receive.value });
    });
    give.addEventListener("change", syncTrade);
    receive.addEventListener("change", syncTrade);
    syncTrade();
    row.append(give, receive, trade);
    box.appendChild(row);
    actionsEl.appendChild(box);
  }

  function renderOpenOffer() {
    const offer = view.trade && view.trade.offer;
    addSubheading("Captain trade");
    if (offer) {
      const summary = document.createElement("div");
      summary.className = "catan-starfarers-offer";
      summary.textContent = `${playerName(offer.owner_id)} gives ${formatBundle(offer.give)} · wants ${formatBundle(offer.want)}`;
      actionsEl.appendChild(summary);
      if (offer.owner_id === view.you) {
        Object.entries(view.trade.responses || {}).forEach(([playerId, response]) => {
          const terms = response.kind === "accept"
            ? `Accepts terms`
            : `Gives ${formatBundle(response.give)} · wants ${formatBundle(response.want)}`;
          actionsEl.appendChild(createButton(`Finalize · ${playerName(playerId)} · ${terms}`, {
            type: "accept_trade_response", response_player_id: playerId,
          }, { disabled: !hasAction("accept_trade_response"), explain: "trade" }));
        });
        actionsEl.appendChild(createButton("Cancel Offer", { type: "cancel_trade_offer" }, {
          disabled: !hasAction("cancel_trade_offer"), explain: "trade",
        }));
      } else {
        actionsEl.appendChild(createButton("Accept Terms", { type: "submit_trade_response", response: "accept" }, {
          className: "is-primary",
          disabled: !hasAction("submit_trade_response") || !canPay(offer.want),
          explain: "trade",
          title: canPay(offer.want) ? "Accept the displayed terms." : "Your hold cannot cover the requested resources.",
        }));
        if (hasAction("withdraw_trade_response")) {
          actionsEl.appendChild(createButton("Withdraw Response", { type: "withdraw_trade_response" }, { explain: "trade" }));
        }
      }
      return;
    }
    if (view.active_player_id !== view.you) return;
    const maxGive = { ...view.your_hand };
    const maxWant = { ore: 20, fuel: 20, carbon: 20, food: 20, goods: 20 };
    addSubheading("You give");
    addStepperGrid(offerGiveDraft, maxGive, renderActions, "trade");
    addSubheading("You want");
    addStepperGrid(offerWantDraft, maxWant, renderActions, "trade");
    const valid = bundleTotal(offerGiveDraft) > 0 && bundleTotal(offerWantDraft) > 0;
    actionsEl.appendChild(createButton("Open Offer", {
      type: "open_trade_offer", give: { ...offerGiveDraft }, want: { ...offerWantDraft },
    }, { disabled: !hasAction("open_trade_offer") || !valid, explain: "trade" }));
  }

  function renderTradeBuildActions() {
    actionHeadingEl.textContent = "Trade & Build";
    if (view.active_player_id !== view.you) {
      actionHintEl.textContent = view.trade && view.trade.offer
        ? "The active captain opened a structured offer."
        : `Waiting for ${playerName(view.active_player_id)}. You may respond if an offer opens.`;
      renderOpenOffer();
      return;
    }
    actionHintEl.textContent = "Build any number of affordable items, trade, then launch Flight.";
    renderBuildGrid();
    renderSupplyTrade();
    renderOpenOffer();
    addSubheading("Depart");
    actionsEl.appendChild(createButton("🪐 Start Flight", { type: "start_flight" }, {
      className: "is-primary", disabled: !hasAction("start_flight"), explain: "mothership",
    }));
  }

  function renderEncounterActions() {
    actionHeadingEl.textContent = "Encounter";
    const encounter = view.encounter;
    if (!encounter) {
      actionHintEl.textContent = "Waiting for the encounter signal.";
      return;
    }
    const reader = playerName(encounter.reader_id);
    if (view.phase === "encounter_reader") {
      actionHintEl.textContent = encounter.reader_id === view.you
        ? "You are the Reader. Review the private encounter, then read its public prompt."
        : `${reader} is privately reading the encounter.`;
      actionsEl.appendChild(createButton("Read Prompt", { type: "read_encounter_prompt" }, {
        className: "is-primary", disabled: !hasAction("read_encounter_prompt"), explain: "encounter",
      }));
      return;
    }
    const prompt = document.createElement("div");
    prompt.className = "catan-starfarers-offer";
    prompt.textContent = encounter.prompt || "Encounter prompt pending.";
    actionsEl.appendChild(prompt);
    if (view.phase === "encounter_choice") {
      actionHintEl.textContent = view.active_player_id === view.you
        ? "Choose one available response. The hidden result is revealed by the Reader."
        : `${playerName(view.active_player_id)} is choosing a response.`;
      const grid = document.createElement("div");
      grid.className = "catan-starfarers-choice-grid";
      (encounter.options || []).forEach((option) => {
        const card = document.createElement("div");
        card.className = "catan-starfarers-choice-card";
        card.dataset.catanStarfarersExplain = "encounter";
        const strong = document.createElement("strong");
        strong.textContent = option.label;
        const small = document.createElement("small");
        small.textContent = option.result || (option.available ? "Requirements met" : "Requirements not met");
        const choose = createButton("Choose", { type: "choose_encounter", choice: option.id }, {
          disabled: !hasAction("choose_encounter") || !option.available, explain: "encounter",
        });
        card.append(strong, small, choose);
        grid.appendChild(card);
      });
      actionsEl.appendChild(grid);
      return;
    }
    actionHintEl.textContent = encounter.reader_id === view.you
      ? "Reveal the selected branch and apply its server-defined effects."
      : `${reader} will reveal the result.`;
    actionsEl.appendChild(createButton("Reveal Result", { type: "reveal_encounter_result" }, {
      className: "is-primary", disabled: !hasAction("reveal_encounter_result"), explain: "encounter",
    }));
  }

  function renderFlightActions() {
    actionHeadingEl.textContent = "Flight";
    if (view.active_player_id !== view.you) {
      actionHintEl.textContent = `${playerName(view.active_player_id)} is plotting ship movement.`;
      return;
    }
    actionHintEl.textContent = "Select a ship on the map, move one edge at a time, then settle or finish it.";
    const box = document.createElement("div");
    box.className = "catan-starfarers-flight-box";
    box.dataset.catanStarfarersExplain = "ships";
    const grid = document.createElement("div");
    grid.className = "catan-starfarers-button-grid";
    (view.board.ships || []).filter((ship) => ship.player_id === view.you).forEach((ship) => {
      const remaining = Number(view.flight && view.flight.movement_remaining && view.flight.movement_remaining[ship.id] || 0);
      const finished = Boolean(view.flight && (view.flight.finished_ship_ids || []).includes(ship.id));
      const label = `${ship.kind === "colony" ? "🚀 C" : "🛸 T"} · ${finished ? "Done" : `${remaining} move`}`;
      const button = createButton(label, null, { disabled: finished, explain: "ships" });
      button.classList.toggle("is-primary", ship.id === selectedShipId);
      button.addEventListener("click", (event) => {
        event.stopImmediatePropagation();
        if (button.disabled) return;
        selectedShipId = selectedShipId === ship.id ? null : ship.id;
        renderMap();
        renderActions();
      });
      grid.appendChild(button);
    });
    box.appendChild(grid);
    actionsEl.appendChild(box);
    if (selectedShipId) {
      const actionGrid = document.createElement("div");
      actionGrid.className = "catan-starfarers-button-grid";
      actionGrid.appendChild(createButton("🏠 Establish Colony", { type: "establish_colony", ship_id: selectedShipId }, {
        disabled: !(view.settleable_ship_ids || []).includes(selectedShipId), explain: "ships",
      }));
      actionGrid.appendChild(createButton("🤝 Establish Station", { type: "establish_trade_station", ship_id: selectedShipId }, {
        disabled: !(view.stationable_ship_ids || []).includes(selectedShipId), explain: "friendship",
      }));
      actionGrid.appendChild(createButton("Finish This Ship", { type: "finish_ship_move", ship_id: selectedShipId }, {
        disabled: !hasAction("finish_ship_move"), explain: "ships",
      }));
      actionsEl.appendChild(actionGrid);
    }
    actionsEl.appendChild(createButton("End Flight", { type: "end_flight" }, {
      className: "is-primary", disabled: !hasAction("end_flight"), explain: "review",
    }));
  }

  function renderFriendshipActions() {
    actionHeadingEl.textContent = "Choose Friendship";
    const pendingChoice = view.pending_friendship;
    actionHintEl.textContent = pendingChoice
      ? `Choose one remaining ${String(pendingChoice.civilization || "").replaceAll("_", " ")} card.`
      : `Waiting for ${playerName(view.active_player_id)} to choose a friendship card.`;
    if (!pendingChoice) return;
    const cards = view.friendship_available[pendingChoice.civilization] || [];
    const grid = document.createElement("div");
    grid.className = "catan-starfarers-choice-grid";
    cards.forEach((card) => {
      const item = document.createElement("div");
      item.className = "catan-starfarers-choice-card";
      item.dataset.catanStarfarersExplain = "friendship";
      const name = document.createElement("strong");
      name.textContent = `🤝 ${card.name}`;
      const detail = document.createElement("small");
      detail.textContent = card.description;
      const choose = createButton("Choose", { type: "choose_friendship_card", card_id: card.id }, {
        disabled: !hasAction("choose_friendship_card"), explain: "friendship",
      });
      item.append(name, detail, choose);
      grid.appendChild(item);
    });
    actionsEl.appendChild(grid);
  }

  function renderReviewActions() {
    actionHeadingEl.textContent = view.game_over ? "Frontier Complete" : "Turn Review";
    const summary = document.createElement("div");
    summary.className = "catan-starfarers-offer";
    const lines = view.turn_summary || [];
    summary.textContent = lines.length ? lines.slice(-5).join(" · ") : "Review the current map and public player boards.";
    actionsEl.appendChild(summary);
    actionHintEl.textContent = view.game_over
      ? `${(view.winner_ids || []).map(playerName).join(" & ")} reached ${view.winning_vp} VP. Every seat may confirm a rematch.`
      : `${Number(view.review_progress.done || 0)} / ${Number(view.review_progress.total || 0)} seats ready.`;
    const type = view.game_over ? "play_again" : "next_turn";
    const allowed = hasAction(type);
    actionsEl.appendChild(createButton(allowed ? (view.game_over ? "Play Again" : "Next Turn") : "Ready · Waiting for Others…", { type }, {
      className: "is-primary", disabled: !allowed, explain: "review",
    }));
  }

  function renderActions() {
    if (!actionsEl || !view) return;
    actionsEl.innerHTML = "";
    switch (view.phase) {
      case "production": renderProductionActions(); break;
      case "seven_discard":
      case "seven_steal": renderTributeActions(); break;
      case "trade_build": renderTradeBuildActions(); break;
      case "encounter_reader":
      case "encounter_choice":
      case "encounter_reveal": renderEncounterActions(); break;
      case "flight": renderFlightActions(); break;
      case "friendship_choice": renderFriendshipActions(); break;
      case "turn_review":
      case "game_over": renderReviewActions(); break;
      default:
        actionHeadingEl.textContent = "Waiting";
        actionHintEl.textContent = "Waiting for the server to advance the game.";
    }
  }

  function renderLog() {
    if (!logEl || !view) return;
    const activity = [...(view.activity || [])].reverse();
    if (!activity.length) {
      logEl.textContent = "No actions yet.";
      return;
    }
    logEl.innerHTML = "";
    activity.forEach((item) => {
      const row = document.createElement("div");
      row.className = "catan-starfarers-log-entry";
      row.textContent = item.message || item.type || "Frontier update";
      logEl.appendChild(row);
    });
  }

  function render(payload) {
    view = payload && payload.view ? payload.view : payload;
    if (!view || view.game_id !== "catan_starfarers") return;
    pending = false;
    if (pendingTimer) window.clearTimeout(pendingTimer);
    pendingTimer = null;
    resetDraftsIfNeeded(view);
    if (view.phase !== "flight") selectedShipId = null;
    renderStatus();
    renderPlayers();
    renderMothership();
    renderMap();
    renderHand();
    renderActions();
    renderLog();
    if (liveEl) {
      const announcement = statusEl ? statusEl.textContent : "Game updated";
      if (liveEl.textContent !== announcement) liveEl.textContent = announcement;
    }
  }

  function showHeaderActions(visible) {
    if (headerActions) headerActions.style.display = visible ? "flex" : "none";
    if (!visible) {
      setExplainMode(false);
      setModal(helpModal, false);
      setModal(explainModal, false);
      selectedShipId = null;
    }
  }

  function clear() {
    view = null;
    pending = false;
    selectedShipId = null;
    draftKey = "";
    discardDraft = blankBundle();
    offerGiveDraft = blankBundle();
    offerWantDraft = blankBundle();
    setExplainMode(false);
    setModal(helpModal, false);
    setModal(explainModal, false);
    if (mapEl) mapEl.innerHTML = "";
    if (playersEl) playersEl.innerHTML = "";
    if (actionsEl) actionsEl.innerHTML = "";
    if (logEl) logEl.textContent = "No actions yet.";
  }

  if (helpContent) helpContent.innerHTML = HELP_HTML;
  if (helpBtn) helpBtn.addEventListener("click", () => setModal(helpModal, true));
  if (helpCloseBtn) helpCloseBtn.addEventListener("click", () => setModal(helpModal, false, helpBtn));
  if (explainBtn) explainBtn.addEventListener("click", () => setExplainMode(!explainMode));
  if (explainCloseBtn) explainCloseBtn.addEventListener("click", () => setModal(explainModal, false, explainBtn));
  [helpModal, explainModal].forEach((modal) => {
    if (!modal) return;
    modal.addEventListener("click", (event) => {
      if (event.target === modal) setModal(modal, false);
    });
  });
  if (mapEl) {
    mapEl.addEventListener("click", (event) => {
      if (event.target === mapEl) {
        selectedShipId = null;
        renderMap();
        renderActions();
      }
    });
  }

  document.addEventListener("pointerdown", (event) => {
    if (!explainMode) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    if (!hit) return;
    if (hit === explainBtn || explainBtn && explainBtn.contains(hit)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setExplainMode(false);
      return;
    }
    const target = hit.closest && hit.closest("[data-catan-starfarers-explain]");
    event.preventDefault();
    event.stopImmediatePropagation();
    if (target) openExplanation(target.dataset.catanStarfarersExplain);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (explainMode) {
      event.preventDefault();
      setExplainMode(false);
      if (explainBtn) explainBtn.focus();
      return;
    }
    if (explainModal && !explainModal.classList.contains("hidden")) {
      event.preventDefault();
      setModal(explainModal, false, explainBtn);
      return;
    }
    if (helpModal && !helpModal.classList.contains("hidden")) {
      event.preventDefault();
      setModal(helpModal, false, helpBtn);
      return;
    }
    if (selectedShipId) {
      event.preventDefault();
      selectedShipId = null;
      renderMap();
      renderActions();
    }
  });

  window.CatanStarfarersUI = { render, showHeaderActions, clear };
})();

function renderCatanStarfarersGameState(data) {
  window.CatanStarfarersUI.render(data);
}

function showCatanStarfarersHeaderActions(visible) {
  window.CatanStarfarersUI.showHeaderActions(visible);
}

function clearCatanStarfarersState() {
  window.CatanStarfarersUI.clear();
}
