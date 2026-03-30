let currentSkyeView = null;
let skyeSelectedBuildTileId = null;
let skyeSelectedRotation = 0;
let skyePricingDraft = null;
let skyeExplainMode = false;

const skyeHeaderActions = document.getElementById("skyeHeaderActions");
const skyeHelpBtn = document.getElementById("skyeHelpBtn");
const skyeExplainBtn = document.getElementById("skyeExplainBtn");
const skyeHelpModal = document.getElementById("skyeHelpModal");
const skyeHelpModalCloseBtn = document.getElementById("skyeHelpModalCloseBtn");
const skyeExplainModal = document.getElementById("skyeExplainModal");
const skyeExplainModalCloseBtn = document.getElementById("skyeExplainModalCloseBtn");
const skyeHelpContent = document.getElementById("skyeHelpContent");
const skyeExplainContent = document.getElementById("skyeExplainContent");

const skyeRoundLabel = document.getElementById("skyeRound");
const skyePhaseLabel = document.getElementById("skyePhase");
const skyeTurnLabel = document.getElementById("skyeTurn");
const skyeStartPlayerLabel = document.getElementById("skyeStartPlayer");
const skyeBagCountLabel = document.getElementById("skyeBagCount");
const skyeWinnerLabel = document.getElementById("skyeWinner");
const skyeImplementationNote = document.getElementById("skyeImplementationNote");
const skyeSelectionHint = document.getElementById("skyeSelectionHint");

const skyeSubmitPricingBtn = document.getElementById("skyeSubmitPricingBtn");
const skyePassBuyBtn = document.getElementById("skyePassBuyBtn");
const skyeRotateLeftBtn = document.getElementById("skyeRotateLeftBtn");
const skyeRotateRightBtn = document.getElementById("skyeRotateRightBtn");
const skyeReturnSelectedBtn = document.getElementById("skyeReturnSelectedBtn");
const skyeFinishBuildBtn = document.getElementById("skyeFinishBuildBtn");

const skyeBoard = document.getElementById("skyeBoard");
const skyePhaseTitle = document.getElementById("skyePhaseTitle");
const skyePhasePanel = document.getElementById("skyePhasePanel");
const skyeScoringTiles = document.getElementById("skyeScoringTiles");
const skyeBuildQueue = document.getElementById("skyeBuildQueue");
const skyeBuildQueueSection = document.getElementById("skyeBuildQueueSection");
const skyePlayers = document.getElementById("skyePlayers");
const skyeRoundRecap = document.getElementById("skyeRoundRecap");

const SKYE_TERRAIN_META = {
  pasture: { label: "Grassland", emoji: "🌿", className: "pasture" },
  mountain: { label: "Mountain", emoji: "⛰️", className: "mountain" },
  water: { label: "Ocean", emoji: "🌊", className: "water" },
};

const SKYE_ICON_META = {
  castle: { emoji: "🏰", label: "Castle" },
  whisky: { emoji: "🥃", label: "Whisky" },
  sheep: { emoji: "🐑", label: "Sheep" },
  cattle: { emoji: "🐂", label: "Cattle" },
  ship: { emoji: "⛵", label: "Ship" },
  broch: { emoji: "🗼", label: "Broch" },
  farm: { emoji: "🏠", label: "Farm" },
  lighthouse: { emoji: "💡", label: "Lighthouse" },
  scroll: { emoji: "📜", label: "Scroll" },
};

const SKYE_PHASE_LABELS = {
  price_secret: "Pricing",
  buy: "Buying",
  build: "Building",
  ended: "Finished",
};

function skyeSvgTileUrl(tileId) {
  return `/static/isle_of_skye/${encodeURIComponent(tileId)}.svg`;
}

const SKYE_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Build the highest-scoring clan territory after 6 rounds. Each round uses a different mix of scoring tiles, then final scoring adds scroll points and 1 VP per 5 gold.</p>

  <h3>Round Flow</h3>
  <ul>
    <li><strong>Income</strong>: already applied automatically at the start of each round.</li>
    <li><strong>Pricing</strong>: you draw 3 tiles, choose 1 to discard, and secretly price the other 2.</li>
    <li><strong>Buying</strong>: in turn order, each player may buy 1 tile from another player or pass.</li>
    <li><strong>Building</strong>: place every tile you gained this round into your territory. Illegal leftovers return to the bag.</li>
    <li><strong>Scoring</strong>: the highlighted round scoring tiles are resolved automatically.</li>
  </ul>

  <h3>Placement Rules</h3>
  <ul>
    <li>New tiles must touch your existing territory orthogonally.</li>
    <li>Adjacent terrain edges must match exactly.</li>
    <li>Roads and bridges do not need to connect for placement, but they matter for income and some scoring tiles.</li>
    <li>The tile faces are generated as semantic SVGs from the current Skye tile draft, but the per-tile data still needs validation against the source art.</li>
  </ul>

  <h3>Tile Icon Legend</h3>
  <ul>
    <li>🏠 Farm, 🐑 Sheep, 🐂 Cattle, 🥃 Whisky, ⛵ Ship, 🗼 Broch, 💡 Lighthouse, 📜 Scroll, 🏰 Castle.</li>
    <li>Icons with a number mean quantity, e.g. 🐑2 means two sheep on that tile.</li>
    <li>Road summary uses 🛣️ for ordinary roads and 🌉 for bridges, followed by edge letters (N/E/S/W).</li>
    <li>Edge terrain summary shows N/E/S/W with terrain emojis: 🌿 pasture, ⛰️ mountain, 🌊 water.</li>
  </ul>
`;

const SKYE_EXPLANATIONS = {
  skyeSubmitPricingBtn: {
    name: "Submit Prices",
    description: "Lock in your discard choice and the two sale prices for the tiles you drew this round.",
  },
  skyePassBuyBtn: {
    name: "Pass Buy",
    description: "Skip your one purchase for this round. You cannot buy later in the same round.",
  },
  skyeRotateLeftBtn: {
    name: "Rotate Left",
    description: "Rotate the selected build tile 90 degrees counterclockwise before placing it.",
  },
  skyeRotateRightBtn: {
    name: "Rotate Right",
    description: "Rotate the selected build tile 90 degrees clockwise before placing it.",
  },
  skyeReturnSelectedBtn: {
    name: "Return Selected",
    description: "Send the selected tile back to the bag if it currently has no legal placement.",
  },
  skyeFinishBuildBtn: {
    name: "Finish Build",
    description: "Confirm you are done building this round. This only works when your build queue is empty.",
  },
  skyeBoard: {
    name: "Your Territory",
    description: "Click a highlighted empty cell to place the selected tile with its current rotation.",
  },
  skyePhaseCard: {
    name: "Phase Card",
    description: "Shows the phase-specific UI: price your tiles, inspect the buy market, or follow final scoring.",
  },
  skyeScoringTiles: {
    name: "Round Scoring",
    description: "The bright scoring cards are active this round. The others may score in later rounds.",
  },
  skyeBuildQueue: {
    name: "Build Queue",
    description: "Tiles you still need to place this round. Click one to select it for placement.",
  },
  skyePlayers: {
    name: "Players",
    description: "Each player card shows score, total gold, available gold after reserved prices, and build status.",
  },
};

function clearSkyeState() {
  currentSkyeView = null;
  skyeSelectedBuildTileId = null;
  skyeSelectedRotation = 0;
  skyePricingDraft = null;
  if (skyeRoundLabel) skyeRoundLabel.textContent = "-";
  if (skyePhaseLabel) skyePhaseLabel.textContent = "-";
  if (skyeTurnLabel) skyeTurnLabel.textContent = "-";
  if (skyeStartPlayerLabel) skyeStartPlayerLabel.textContent = "-";
  if (skyeBagCountLabel) skyeBagCountLabel.textContent = "-";
  if (skyeWinnerLabel) skyeWinnerLabel.textContent = "-";
  if (skyeImplementationNote) skyeImplementationNote.textContent = "";
  if (skyeSelectionHint) {
    skyeSelectionHint.textContent = "Select a build tile, rotate it if needed, then click a highlighted empty cell on your territory.";
  }
  if (skyePhaseTitle) skyePhaseTitle.textContent = "Phase";
  if (skyePhasePanel) skyePhasePanel.innerHTML = "";
  if (skyeScoringTiles) skyeScoringTiles.innerHTML = "";
  if (skyeBuildQueue) skyeBuildQueue.innerHTML = "";
  if (skyeBuildQueueSection) skyeBuildQueueSection.classList.add("hidden");
  if (skyePlayers) skyePlayers.innerHTML = "";
  if (skyeBoard) {
    skyeBoard.innerHTML = "";
    skyeBoard.style.gridTemplateColumns = "";
  }
  if (skyeRoundRecap) skyeRoundRecap.innerHTML = "";
  updateSkyeActionButtons();
}

function skyePlayerById(view, playerId) {
  return (view.players || []).find((player) => player.player_id === playerId) || null;
}

function skyeYou(view) {
  return skyePlayerById(view, view.you);
}

function skyeRotateEdge(edge, turns) {
  const edges = ["N", "E", "S", "W"];
  const index = edges.indexOf(edge);
  return edges[(index + turns + edges.length) % edges.length];
}

function skyeRotatedTileDef(view, tileId, rotation) {
  if (!view || !view.tile_defs || !view.tile_defs[tileId]) {
    return null;
  }
  const base = view.tile_defs[tileId];
  const turns = ((((rotation || 0) % 360) + 360) % 360) / 90;
  const edges = {};
  Object.entries(base.edges || {}).forEach(([edge, terrain]) => {
    edges[skyeRotateEdge(edge, turns)] = terrain;
  });
  const roadExits = Array.isArray(base.road_exits) ? base.road_exits.map((edge) => skyeRotateEdge(edge, turns)) : [];
  const bridgeExits = Array.isArray(base.bridge_exits) ? base.bridge_exits.map((edge) => skyeRotateEdge(edge, turns)) : [];
  return {
    ...base,
    edges,
    road_exits: roadExits,
    bridge_exits: bridgeExits,
  };
}

function skyeIconSummary(icons) {
  const parts = [];
  (icons || []).forEach((icon) => {
    const meta = SKYE_ICON_META[icon.type];
    if (!meta) return;
    const count = Number.isInteger(icon.count) && icon.count > 1 ? `×${icon.count}` : "";
    let suffix = "";
    if (icon.type === "scroll" && icon.scroll_type) {
      suffix = icon.scroll_type.replace("per_", "").replaceAll("_", " ");
    }
    parts.push(`${meta.emoji}${count}${suffix ? ` ${suffix}` : ""}`);
  });
  return parts.join(" ");
}

function skyeRoadSummary(tileDef) {
  const roadExits = Array.isArray(tileDef.road_exits) ? tileDef.road_exits : [];
  const bridgeSet = new Set(Array.isArray(tileDef.bridge_exits) ? tileDef.bridge_exits : []);
  const normalRoads = roadExits.filter((edge) => !bridgeSet.has(edge));
  const bridges = roadExits.filter((edge) => bridgeSet.has(edge));
  const parts = [];
  if (normalRoads.length) {
    parts.push(`🛣️ ${normalRoads.join("")}`);
  }
  if (bridges.length) {
    parts.push(`🌉 ${bridges.join("")}`);
  }
  return parts.join(" / ");
}

function createSkyeTileFace(view, tileId, rotation, compact = false) {
  const tileDef = skyeRotatedTileDef(view, tileId, rotation);
  if (!tileDef) {
    const fallback = document.createElement("div");
    fallback.className = `skye-tile${compact ? " compact" : ""}`;
    fallback.textContent = tileId;
    return fallback;
  }

  const tile = document.createElement("div");
  tile.className = `skye-tile${compact ? " compact" : ""}`;
  tile.title = tileDef.display_name || tileId;
  const iconSummary = skyeIconSummary(tileDef.icons);
  const roadSummary = skyeRoadSummary(tileDef);
  const art = document.createElement("div");
  art.className = "skye-tile-art";
  art.style.backgroundImage = `url(${skyeSvgTileUrl(tileId)})`;
  art.style.transform = `rotate(${rotation}deg)`;
  tile.appendChild(art);

  const meta = document.createElement("div");
  meta.className = "skye-tile-meta";
  meta.textContent = [
    iconSummary || "·",
    roadSummary,
    `N${SKYE_TERRAIN_META[tileDef.edges.N].emoji} E${SKYE_TERRAIN_META[tileDef.edges.E].emoji} S${SKYE_TERRAIN_META[tileDef.edges.S].emoji} W${SKYE_TERRAIN_META[tileDef.edges.W].emoji}`,
  ].filter(Boolean).join(" · ");
  tile.appendChild(meta);

  return tile;
}

function createSkyeTileCard(view, tileId, options = {}) {
  const rotation = options.rotation || 0;
  const selected = !!options.selected;
  const compact = !!options.compact;
  const card = document.createElement("div");
  card.className = `skye-tile-card${selected ? " selected" : ""}${compact ? " compact" : ""}`;

  const title = document.createElement("div");
  title.className = "skye-tile-title";
  title.textContent = options.label || tileId;
  card.appendChild(title);

  if (Number.isInteger(options.price)) {
    const badge = document.createElement("div");
    badge.className = "skye-price-badge";
    badge.textContent = `💰 ${options.price}`;
    card.appendChild(badge);
  }

  card.appendChild(createSkyeTileFace(view, tileId, rotation, compact));
  return card;
}

function skyeEnsurePricingDraft(view) {
  const me = skyeYou(view);
  if (!me || !Array.isArray(me.drawn_tile_ids) || me.drawn_tile_ids.length !== 3 || me.pricing_submitted) {
    skyePricingDraft = null;
    return;
  }
  const key = me.drawn_tile_ids.join("|");
  if (skyePricingDraft && skyePricingDraft.key === key) {
    return;
  }
  const discardTileId = me.drawn_tile_ids[2];
  const prices = {};
  me.drawn_tile_ids.forEach((tileId, index) => {
    if (index < 2) {
      prices[tileId] = 1;
    }
  });
  skyePricingDraft = {
    key,
    discardTileId,
    prices,
  };
}

function skyeUpdateDraftForDiscard(view, discardTileId) {
  skyeEnsurePricingDraft(view);
  if (!skyePricingDraft) return;
  skyePricingDraft.discardTileId = discardTileId;
  const me = skyeYou(view);
  (me.drawn_tile_ids || []).forEach((tileId) => {
    if (tileId === discardTileId) {
      delete skyePricingDraft.prices[tileId];
    } else if (!Number.isInteger(skyePricingDraft.prices[tileId])) {
      skyePricingDraft.prices[tileId] = 1;
    }
  });
}

function skyeCanSubmitPricing(view) {
  const me = skyeYou(view);
  if (!me || !skyePricingDraft) return false;
  const drawn = me.drawn_tile_ids || [];
  if (!drawn.includes(skyePricingDraft.discardTileId)) return false;
  const pricedTileIds = drawn.filter((tileId) => tileId !== skyePricingDraft.discardTileId);
  if (pricedTileIds.length !== 2) return false;
  let reserved = 0;
  for (const tileId of pricedTileIds) {
    const price = Number.parseInt(skyePricingDraft.prices[tileId], 10);
    if (!Number.isInteger(price) || price < 1) {
      return false;
    }
    reserved += price;
  }
  return reserved <= (me.gold || 0);
}

function skyeSelectedTileIsQueued(view) {
  const me = skyeYou(view);
  const queue = me && Array.isArray(me.build_queue) ? me.build_queue : [];
  return !!(skyeSelectedBuildTileId && queue.includes(skyeSelectedBuildTileId));
}

function skyeSyncBuildSelection(view) {
  const me = skyeYou(view);
  const queue = me && Array.isArray(me.build_queue) ? me.build_queue : [];
  if (!queue.includes(skyeSelectedBuildTileId)) {
    skyeSelectedBuildTileId = null;
    skyeSelectedRotation = 0;
  }
}

function skyeCanPlace(view, player, tileId, x, y, rotation) {
  if (!player || !Array.isArray(player.territory)) {
    return false;
  }
  const territory = new Map();
  (player.territory || []).forEach((placedTile) => {
    territory.set(`${placedTile.x},${placedTile.y}`, placedTile);
  });
  if (territory.has(`${x},${y}`)) {
    return false;
  }
  const tileDef = skyeRotatedTileDef(view, tileId, rotation);
  if (!tileDef) {
    return false;
  }
  let adjacent = false;
  const edges = ["N", "E", "S", "W"];
  const deltas = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  const opposite = { N: "S", E: "W", S: "N", W: "E" };
  for (const edge of edges) {
    const [dx, dy] = deltas[edge];
    const neighbor = territory.get(`${x + dx},${y + dy}`);
    if (!neighbor) continue;
    adjacent = true;
    const neighborDef = skyeRotatedTileDef(view, neighbor.tile_id, neighbor.rotation);
    if (!neighborDef || tileDef.edges[edge] !== neighborDef.edges[opposite[edge]]) {
      return false;
    }
  }
  return adjacent;
}

function skyeFindAnyLegalPlacement(view, player, tileId) {
  if (!player || !Array.isArray(player.territory) || !player.territory.length) {
    return null;
  }
  const xs = player.territory.map((tile) => tile.x);
  const ys = player.territory.map((tile) => tile.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  for (const rotation of [0, 90, 180, 270]) {
    for (let y = minY - 1; y <= maxY + 1; y += 1) {
      for (let x = minX - 1; x <= maxX + 1; x += 1) {
        if (skyeCanPlace(view, player, tileId, x, y, rotation)) {
          return { x, y, rotation };
        }
      }
    }
  }
  return null;
}

function renderSkyeSummary(view) {
  if (skyeRoundLabel) skyeRoundLabel.textContent = `${view.round} / ${view.round_limit}`;
  if (skyePhaseLabel) skyePhaseLabel.textContent = SKYE_PHASE_LABELS[view.phase] || view.phase || "-";
  if (skyeTurnLabel) {
    skyeTurnLabel.textContent = view.current_turn ? (skyePlayerById(view, view.current_turn)?.name || view.current_turn) : "-";
  }
  if (skyeStartPlayerLabel) {
    skyeStartPlayerLabel.textContent = view.start_player_id ? (skyePlayerById(view, view.start_player_id)?.name || view.start_player_id) : "-";
  }
  if (skyeBagCountLabel) skyeBagCountLabel.textContent = String(view.bag_count ?? "-");
  if (skyeWinnerLabel) {
    if (Array.isArray(view.winner) && view.winner.length) {
      skyeWinnerLabel.textContent = view.winner.map((playerId) => skyePlayerById(view, playerId)?.name || playerId).join(", ");
    } else {
      skyeWinnerLabel.textContent = "-";
    }
  }
  if (skyeImplementationNote) {
    skyeImplementationNote.textContent = view.implementation_note || "";
  }
}

function renderSkyeScoringTilesPanel(view) {
  if (!skyeScoringTiles) return;
  skyeScoringTiles.innerHTML = "";
  const activeSet = new Set(view.active_scoring_slots || []);
  ["A", "B", "C", "D"].forEach((slot) => {
    const tile = view.scoring_slots ? view.scoring_slots[slot] : null;
    if (!tile) return;
    const card = document.createElement("div");
    card.className = `skye-scoring-card${activeSet.has(slot) ? " active" : ""}`;
    card.innerHTML = `
      <div class="skye-scoring-slot">${slot}</div>
      <div class="skye-scoring-name">${tile.slot_name}</div>
      <div class="skye-scoring-desc">${tile.description}</div>
    `;
    skyeScoringTiles.appendChild(card);
  });
}

function renderSkyePlayersPanel(view) {
  if (!skyePlayers) return;
  skyePlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    const isTurn = view.current_turn === player.player_id;
    const isYou = view.you === player.player_id;
    card.className = `skye-player-card${isTurn ? " current-turn" : ""}${isYou ? " you" : ""}`;
    const buildSummary = view.phase === "build"
      ? (player.build_done ? "Done" : `${(player.build_queue || []).length} left`)
      : "-";
    card.innerHTML = `
      <div class="skye-player-name">${player.name || player.player_id}${isYou ? " · You" : ""}</div>
      <div class="skye-player-meta">⭐ ${player.score} · 💰 ${player.gold} · 👜 ${player.available_gold}</div>
      <div class="skye-player-meta">🔒 ${player.reserved_gold} · 🧱 ${player.territory_size} · Build ${buildSummary}</div>
    `;
    skyePlayers.appendChild(card);
  });
}

function renderSkyeRoundRecap(view) {
  if (!skyeRoundRecap) return;
  skyeRoundRecap.innerHTML = "";

  if (view.game_over && view.final_scoring) {
    Object.entries(view.final_scoring).forEach(([playerId, detail]) => {
      const playerName = skyePlayerById(view, playerId)?.name || playerId;
      const card = document.createElement("div");
      card.className = "skye-recap-card";
      card.innerHTML = `
        <div class="skye-recap-title">${playerName}</div>
        <div>📜 ${detail.scroll_points} · 💰→⭐ ${detail.coin_points} · Final ${detail.final_score}</div>
      `;
      skyeRoundRecap.appendChild(card);
    });
    return;
  }

  if (!view.last_scoring || !view.last_scoring.details) {
    skyeRoundRecap.textContent = "No scoring yet.";
    return;
  }

  Object.entries(view.last_scoring.details).forEach(([playerId, entries]) => {
    const playerName = skyePlayerById(view, playerId)?.name || playerId;
    const card = document.createElement("div");
    card.className = "skye-recap-card";
    const lines = Array.isArray(entries) && entries.length
      ? entries.map((entry) => `<div>${entry.slot}: ${entry.name} · ⭐ ${entry.points}</div>`).join("")
      : "<div>No points this round.</div>";
    card.innerHTML = `
      <div class="skye-recap-title">${playerName}</div>
      ${lines}
    `;
    skyeRoundRecap.appendChild(card);
  });
}

function renderSkyePricingPanel(view) {
  if (!skyePhasePanel || !skyePhaseTitle) return;
  skyePhaseTitle.textContent = "Pricing 💰";
  skyePhasePanel.innerHTML = "";
  const me = skyeYou(view);
  if (!me) {
    skyePhasePanel.textContent = "Spectator view.";
    return;
  }
  skyeEnsurePricingDraft(view);
  if (me.pricing_submitted) {
    const reserved = me.reserved_gold || 0;
    skyePhasePanel.innerHTML = `<div class="hint">Prices locked. Waiting for the other players to finish. Reserved gold: 💰 ${reserved}</div>`;
    return;
  }

  const info = document.createElement("div");
  info.className = "skye-phase-info";
  const reservedPreview = skyePricingDraft
    ? (me.drawn_tile_ids || [])
        .filter((tileId) => tileId !== skyePricingDraft.discardTileId)
        .reduce((total, tileId) => total + (Number.parseInt(skyePricingDraft.prices[tileId], 10) || 0), 0)
    : 0;
  info.textContent = `Your gold: 💰 ${me.gold}. Reserve preview: ${reservedPreview}.`;
  skyePhasePanel.appendChild(info);

  const tiles = document.createElement("div");
  tiles.className = "skye-tile-list skye-pricing-tile-list";
  (me.drawn_tile_ids || []).forEach((tileId) => {
    const wrapper = document.createElement("div");
    wrapper.className = "skye-phase-tile";
    const card = createSkyeTileCard(view, tileId);
    wrapper.appendChild(card);

    const controls = document.createElement("div");
    controls.className = "skye-pricing-controls";

    const discardLabel = document.createElement("label");
    discardLabel.className = "skye-discard-label";
    const discardInput = document.createElement("input");
    discardInput.type = "radio";
    discardInput.name = "skyeDiscardTile";
    discardInput.checked = skyePricingDraft && skyePricingDraft.discardTileId === tileId;
    discardInput.addEventListener("change", () => {
      skyeUpdateDraftForDiscard(view, tileId);
      renderSkyeGameState({ view: currentSkyeView });
    });
    discardLabel.appendChild(discardInput);
    discardLabel.appendChild(document.createTextNode("Discard"));
    controls.appendChild(discardLabel);

    if (!skyePricingDraft || skyePricingDraft.discardTileId !== tileId) {
      const priceLabel = document.createElement("label");
      priceLabel.className = "skye-price-select";
      priceLabel.textContent = "Price";
      const select = document.createElement("select");
      const maxPrice = Math.max(me.gold || 5, 10);
      for (let price = 1; price <= maxPrice; price += 1) {
        const option = document.createElement("option");
        option.value = String(price);
        option.textContent = String(price);
        if (Number.parseInt(skyePricingDraft.prices[tileId], 10) === price) {
          option.selected = true;
        }
        select.appendChild(option);
      }
      select.addEventListener("change", () => {
        skyePricingDraft.prices[tileId] = Number.parseInt(select.value, 10) || 1;
        updateSkyeActionButtons();
        renderSkyePricingPanel(currentSkyeView);
      });
      priceLabel.appendChild(select);
      controls.appendChild(priceLabel);
    }

    wrapper.appendChild(controls);
    tiles.appendChild(wrapper);
  });
  skyePhasePanel.appendChild(tiles);
}

function renderSkyeBuyPanel(view) {
  if (!skyePhasePanel || !skyePhaseTitle) return;
  skyePhaseTitle.textContent = "Buying 🛍️";
  skyePhasePanel.innerHTML = "";

  const me = skyeYou(view);
  const info = document.createElement("div");
  info.className = "skye-phase-info";
  info.textContent = `Current buyer: ${view.current_turn ? (skyePlayerById(view, view.current_turn)?.name || view.current_turn) : "-"}. Available gold: 💰 ${me ? me.available_gold : 0}.`;
  skyePhasePanel.appendChild(info);

  const groups = document.createElement("div");
  groups.className = "skye-market-groups";
  (view.players || []).forEach((player) => {
    if (!Array.isArray(player.sale_tiles) || !player.sale_tiles.length) return;
    const group = document.createElement("div");
    group.className = "skye-market-group";
    const title = document.createElement("div");
    title.className = "skye-market-title";
    title.textContent = player.player_id === view.you ? "Your Sale Tiles" : `${player.name}'s Sale Tiles`;
    group.appendChild(title);

    const list = document.createElement("div");
    list.className = "skye-tile-list";
    player.sale_tiles.forEach((saleTile) => {
      if (saleTile.sold) return;
      const wrapper = document.createElement("div");
      wrapper.className = "skye-market-entry";
      wrapper.appendChild(createSkyeTileCard(view, saleTile.tile_id, { price: saleTile.price }));
      if (view.current_turn === view.you && player.player_id !== view.you) {
        const buyBtn = document.createElement("button");
        buyBtn.type = "button";
        buyBtn.textContent = `Buy for ${saleTile.price}`;
        buyBtn.disabled = (me ? me.available_gold : 0) < saleTile.price;
        buyBtn.addEventListener("click", () => {
          sendAction({ type: "buy_tile", seller_id: player.player_id, tile_id: saleTile.tile_id });
        });
        wrapper.appendChild(buyBtn);
      }
      list.appendChild(wrapper);
    });
    group.appendChild(list);
    groups.appendChild(group);
  });
  if (!groups.childNodes.length) {
    groups.textContent = "No sale tiles remain.";
  }
  skyePhasePanel.appendChild(groups);
}

function renderSkyeBuildPhasePanel(view) {
  if (!skyePhasePanel || !skyePhaseTitle) return;
  skyePhaseTitle.textContent = "Building 🧱";
  skyePhasePanel.innerHTML = "";
  const me = skyeYou(view);
  if (!me) {
    skyePhasePanel.textContent = "Spectator view.";
    return;
  }
  const selected = skyeSelectedTileIsQueued(view) ? skyeSelectedBuildTileId : null;
  const info = document.createElement("div");
  info.className = "skye-phase-info";
  if (me.build_done) {
    info.textContent = "You have finished building. Waiting for the other players.";
  } else if (!selected) {
    info.textContent = "Choose a tile from your build queue, then place it on a highlighted cell.";
  } else {
    const legalPlacement = skyeFindAnyLegalPlacement(view, me, selected);
    info.textContent = legalPlacement
      ? `Selected ${selected} at ${skyeSelectedRotation}°. Legal cells are highlighted on your board.`
      : `Selected ${selected} has no legal placement right now.`;
  }
  skyePhasePanel.appendChild(info);

  if (selected) {
    const previewCard = document.createElement("div");
    previewCard.className = "skye-selected-preview";
    previewCard.appendChild(createSkyeTileCard(view, selected, { rotation: skyeSelectedRotation, selected: true }));
    skyePhasePanel.appendChild(previewCard);
  }
}

function renderSkyeEndPanel(view) {
  if (!skyePhasePanel || !skyePhaseTitle) return;
  skyePhaseTitle.textContent = "Final Scoring 🏁";
  skyePhasePanel.innerHTML = "";
  if (!view.final_scoring) {
    skyePhasePanel.textContent = "Final scoring not available.";
    return;
  }
  Object.entries(view.final_scoring).forEach(([playerId, detail]) => {
    const playerName = skyePlayerById(view, playerId)?.name || playerId;
    const card = document.createElement("div");
    card.className = "skye-final-card";
    card.innerHTML = `
      <div class="skye-recap-title">${playerName}</div>
      <div>📜 Scrolls: ${detail.scroll_points}</div>
      <div>💰 Gold bonus: ${detail.coin_points}</div>
      <div>⭐ Final score: ${detail.final_score}</div>
    `;
    skyePhasePanel.appendChild(card);
  });
}

function renderSkyePhase(view) {
  if (!skyePhasePanel) return;
  if (view.phase === "price_secret") {
    renderSkyePricingPanel(view);
    return;
  }
  if (view.phase === "buy") {
    renderSkyeBuyPanel(view);
    return;
  }
  if (view.phase === "build") {
    renderSkyeBuildPhasePanel(view);
    return;
  }
  renderSkyeEndPanel(view);
}

function renderSkyeBuildQueuePanel(view) {
  if (!skyeBuildQueue || !skyeBuildQueueSection) return;
  const buildPhase = view.phase === "build";
  skyeBuildQueueSection.classList.toggle("hidden", !buildPhase);
  if (!buildPhase) {
    skyeBuildQueue.innerHTML = "";
    return;
  }
  skyeBuildQueue.innerHTML = "";
  const me = skyeYou(view);
  const queue = me && Array.isArray(me.build_queue) ? me.build_queue : [];
  if (!queue.length) {
    skyeBuildQueue.textContent = "No tiles left to place.";
    return;
  }
  queue.forEach((tileId) => {
    const card = createSkyeTileCard(view, tileId, {
      rotation: skyeSelectedBuildTileId === tileId ? skyeSelectedRotation : 0,
      selected: skyeSelectedBuildTileId === tileId,
      compact: false,
    });
    card.addEventListener("click", () => {
      if (skyeSelectedBuildTileId === tileId) {
        skyeSelectedBuildTileId = null;
        skyeSelectedRotation = 0;
      } else {
        skyeSelectedBuildTileId = tileId;
        skyeSelectedRotation = 0;
      }
      renderSkyeGameState({ view: currentSkyeView });
    });
    skyeBuildQueue.appendChild(card);
  });
}

function renderSkyeBoardPanel(view) {
  if (!skyeBoard) return;
  skyeBoard.innerHTML = "";
  const me = skyeYou(view);
  const territory = me && Array.isArray(me.territory) ? me.territory : [];
  if (!territory.length) {
    return;
  }

  const xs = territory.map((tile) => tile.x);
  const ys = territory.map((tile) => tile.y);
  const minX = Math.min(...xs) - 2;
  const maxX = Math.max(...xs) + 2;
  const minY = Math.min(...ys) - 2;
  const maxY = Math.max(...ys) + 2;
  const columns = maxX - minX + 1;
  skyeBoard.style.gridTemplateColumns = `repeat(${columns}, minmax(78px, 1fr))`;

  const territoryMap = new Map();
  territory.forEach((tile) => {
    territoryMap.set(`${tile.x},${tile.y}`, tile);
  });

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const cell = document.createElement("div");
      cell.className = "skye-board-cell";
      const placedTile = territoryMap.get(`${x},${y}`);
      if (placedTile) {
        const card = createSkyeTileCard(view, placedTile.tile_id, {
          rotation: placedTile.rotation,
          compact: true,
          label: `(${x}, ${y})`,
        });
        card.classList.add("on-board");
        cell.appendChild(card);
      } else {
        cell.classList.add("empty");
        const canPlace = (
          view.phase === "build" &&
          me &&
          !me.build_done &&
          skyeSelectedTileIsQueued(view) &&
          skyeCanPlace(view, me, skyeSelectedBuildTileId, x, y, skyeSelectedRotation)
        );
        if (canPlace) {
          cell.classList.add("legal");
          cell.title = `Place at (${x}, ${y})`;
          cell.addEventListener("click", () => {
            sendAction({
              type: "place_tile",
              tile_id: skyeSelectedBuildTileId,
              x,
              y,
              rotation: skyeSelectedRotation,
            });
          });
        }
        const coord = document.createElement("div");
        coord.className = "skye-cell-coord";
        coord.textContent = `${x},${y}`;
        cell.appendChild(coord);
      }
      skyeBoard.appendChild(cell);
    }
  }
}

function updateSkyeActionButtons() {
  const view = currentSkyeView;
  const me = view ? skyeYou(view) : null;
  const phase = view ? view.phase : null;

  if (skyeSubmitPricingBtn) {
    const visible = phase === "price_secret";
    skyeSubmitPricingBtn.classList.toggle("hidden", !visible);
    skyeSubmitPricingBtn.disabled = !visible || !skyeCanSubmitPricing(view);
  }
  if (skyePassBuyBtn) {
    const visible = phase === "buy";
    skyePassBuyBtn.classList.toggle("hidden", !visible);
    skyePassBuyBtn.disabled = !visible || !view || view.current_turn !== view.you;
  }
  const buildVisible = phase === "build";
  [skyeRotateLeftBtn, skyeRotateRightBtn, skyeReturnSelectedBtn, skyeFinishBuildBtn].forEach((button) => {
    if (button) {
      button.classList.toggle("hidden", !buildVisible);
    }
  });
  if (skyeRotateLeftBtn) {
    skyeRotateLeftBtn.disabled = !buildVisible || !skyeSelectedTileIsQueued(view);
  }
  if (skyeRotateRightBtn) {
    skyeRotateRightBtn.disabled = !buildVisible || !skyeSelectedTileIsQueued(view);
  }
  if (skyeReturnSelectedBtn) {
    skyeReturnSelectedBtn.disabled = !buildVisible || !skyeSelectedTileIsQueued(view);
  }
  if (skyeFinishBuildBtn) {
    const queue = me && Array.isArray(me.build_queue) ? me.build_queue : [];
    skyeFinishBuildBtn.disabled = !buildVisible || !me || me.build_done || queue.length > 0;
  }
}

function renderSkyeGameState(data) {
  const view = data && data.view ? data.view : data;
  if (!view) {
    clearSkyeState();
    return;
  }
  currentSkyeView = view;
  skyeEnsurePricingDraft(view);
  skyeSyncBuildSelection(view);
  renderSkyeSummary(view);
  renderSkyeScoringTilesPanel(view);
  renderSkyePlayersPanel(view);
  renderSkyePhase(view);
  renderSkyeBuildQueuePanel(view);
  renderSkyeBoardPanel(view);
  renderSkyeRoundRecap(view);

  const me = skyeYou(view);
  if (skyeSelectionHint) {
    if (view.phase === "price_secret") {
      skyeSelectionHint.textContent = me && me.pricing_submitted
        ? "Your prices are locked. Waiting for everyone else."
        : "Choose 1 discard tile, set prices for the other 2 tiles, then submit.";
    } else if (view.phase === "buy") {
      skyeSelectionHint.textContent = view.current_turn === view.you
        ? "Buy 1 tile from another player or pass."
        : `Waiting for ${skyePlayerById(view, view.current_turn)?.name || view.current_turn} to buy.`;
    } else if (view.phase === "build") {
      if (me && me.build_done) {
        skyeSelectionHint.textContent = "You are done building this round.";
      } else if (skyeSelectedTileIsQueued(view)) {
        skyeSelectionHint.textContent = "Click a highlighted empty cell on your territory to place the selected tile.";
      } else {
        skyeSelectionHint.textContent = "Select a build tile, rotate it if needed, then click a highlighted empty cell on your territory.";
      }
    } else {
      skyeSelectionHint.textContent = "The game is finished.";
    }
  }

  updateSkyeActionButtons();
  if (skyeExplainMode) {
    updateSkyeExplainModeClasses(true);
  }
}

function showSkyeHeaderActions(show) {
  if (skyeHeaderActions) {
    skyeHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitSkyeExplainMode();
    closeSkyeHelpModal();
    closeSkyeExplainModal();
  }
}

function showSkyeHelpModal() {
  if (!skyeHelpModal) return;
  if (skyeHelpContent) {
    skyeHelpContent.innerHTML = SKYE_HELP_TEXT;
  }
  setModalVisible(skyeHelpModal, true);
}

function closeSkyeHelpModal() {
  if (skyeHelpModal) {
    setModalVisible(skyeHelpModal, false);
  }
}

function updateSkyeExplainModeClasses(enabled) {
  document.querySelectorAll("[data-skye-explain]").forEach((element) => {
    element.classList.toggle("has-explanation", enabled);
  });
}

function findSkyeExplainTargetAtPoint(x, y) {
  const explainable = Array.from(document.querySelectorAll("[data-skye-explain]"));
  for (const element of explainable) {
    const rect = element.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return element.getAttribute("data-skye-explain");
    }
  }
  return null;
}

function toggleSkyeExplainMode() {
  skyeExplainMode = !skyeExplainMode;
  document.body.classList.toggle("skye-explain-mode", skyeExplainMode);
  updateSkyeExplainModeClasses(skyeExplainMode);
  if (skyeExplainBtn) {
    skyeExplainBtn.classList.toggle("active", skyeExplainMode);
  }
}

function exitSkyeExplainMode() {
  if (!skyeExplainMode) {
    return;
  }
  skyeExplainMode = false;
  document.body.classList.remove("skye-explain-mode");
  updateSkyeExplainModeClasses(false);
  if (skyeExplainBtn) {
    skyeExplainBtn.classList.remove("active");
  }
}

function showSkyeExplanation(explanationId) {
  const explanation = SKYE_EXPLANATIONS[explanationId];
  if (!explanation || !skyeExplainContent || !skyeExplainModal) {
    return;
  }
  skyeExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
  `;
  setModalVisible(skyeExplainModal, true);
}

function closeSkyeExplainModal() {
  if (skyeExplainModal) {
    setModalVisible(skyeExplainModal, false);
  }
}

if (skyeSubmitPricingBtn) {
  skyeSubmitPricingBtn.addEventListener("click", () => {
    if (!currentSkyeView || !skyeCanSubmitPricing(currentSkyeView)) {
      return;
    }
    const me = skyeYou(currentSkyeView);
    const pricedTileIds = (me.drawn_tile_ids || []).filter((tileId) => tileId !== skyePricingDraft.discardTileId);
    sendAction({
      type: "submit_prices",
      discard_tile_id: skyePricingDraft.discardTileId,
      priced_tiles: pricedTileIds.map((tileId) => ({
        tile_id: tileId,
        price: Number.parseInt(skyePricingDraft.prices[tileId], 10) || 1,
      })),
    });
  });
}

if (skyePassBuyBtn) {
  skyePassBuyBtn.addEventListener("click", () => {
    sendAction({ type: "pass_buy" });
  });
}

if (skyeRotateLeftBtn) {
  skyeRotateLeftBtn.addEventListener("click", () => {
    if (!skyeSelectedTileIsQueued(currentSkyeView)) return;
    skyeSelectedRotation = (skyeSelectedRotation + 270) % 360;
    renderSkyeGameState({ view: currentSkyeView });
  });
}

if (skyeRotateRightBtn) {
  skyeRotateRightBtn.addEventListener("click", () => {
    if (!skyeSelectedTileIsQueued(currentSkyeView)) return;
    skyeSelectedRotation = (skyeSelectedRotation + 90) % 360;
    renderSkyeGameState({ view: currentSkyeView });
  });
}

if (skyeReturnSelectedBtn) {
  skyeReturnSelectedBtn.addEventListener("click", () => {
    if (!skyeSelectedTileIsQueued(currentSkyeView)) return;
    sendAction({ type: "return_tile", tile_id: skyeSelectedBuildTileId });
  });
}

if (skyeFinishBuildBtn) {
  skyeFinishBuildBtn.addEventListener("click", () => {
    sendAction({ type: "finish_build" });
  });
}

if (skyeHelpBtn) {
  skyeHelpBtn.addEventListener("click", showSkyeHelpModal);
}

if (skyeHelpModalCloseBtn) {
  skyeHelpModalCloseBtn.addEventListener("click", closeSkyeHelpModal);
}

if (skyeExplainBtn) {
  skyeExplainBtn.addEventListener("click", toggleSkyeExplainMode);
}

if (skyeExplainModalCloseBtn) {
  skyeExplainModalCloseBtn.addEventListener("click", closeSkyeExplainModal);
}

if (skyeHelpModal) {
  skyeHelpModal.addEventListener("click", (event) => {
    if (event.target === skyeHelpModal) {
      closeSkyeHelpModal();
    }
  });
}

if (skyeExplainModal) {
  skyeExplainModal.addEventListener("click", (event) => {
    if (event.target === skyeExplainModal) {
      closeSkyeExplainModal();
    }
  });
}

if (skyeBoard) {
  skyeBoard.addEventListener("click", (event) => {
    if (event.target === skyeBoard) {
      skyeSelectedBuildTileId = null;
      skyeSelectedRotation = 0;
      renderSkyeGameState({ view: currentSkyeView });
    }
  });
}

document.addEventListener("pointerdown", (event) => {
  if (!skyeExplainMode) return;
  const explanationId = findSkyeExplainTargetAtPoint(event.clientX, event.clientY);
  if (explanationId) {
    event.preventDefault();
    event.stopPropagation();
    showSkyeExplanation(explanationId);
    exitSkyeExplainMode();
    return;
  }

  const button = event.target.closest("button");
  if (button === skyeExplainBtn || button === skyeHelpBtn) return;
  if (button === skyeHelpModalCloseBtn || button === skyeExplainModalCloseBtn) return;
  if (button) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

document.addEventListener("click", (event) => {
  if (!skyeExplainMode) return;
  const button = event.target.closest("button");
  if (!button) return;
  if (button === skyeExplainBtn || button === skyeHelpBtn) return;
  if (button === skyeHelpModalCloseBtn || button === skyeExplainModalCloseBtn) return;
  event.preventDefault();
  event.stopPropagation();
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (skyeExplainMode) {
      exitSkyeExplainMode();
      return;
    }
    if (skyeHelpModal && !skyeHelpModal.classList.contains("hidden")) {
      closeSkyeHelpModal();
      return;
    }
    if (skyeExplainModal && !skyeExplainModal.classList.contains("hidden")) {
      closeSkyeExplainModal();
    }
  }
});
