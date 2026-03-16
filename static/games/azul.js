let currentAzulView = null;
let azulSelectedSource = null;
let azulSelectedColor = null;
let azulSelectedRow = null;

const azulPhaseLabel = document.getElementById("azulPhase");
const azulRoundLabel = document.getElementById("azulRound");
const azulTurnLabel = document.getElementById("azulTurn");
const azulBagLabel = document.getElementById("azulBagCount");
const azulDiscardLabel = document.getElementById("azulDiscardCount");
const azulWinnerLabel = document.getElementById("azulWinner");

const azulSelectedSourceLabel = document.getElementById("azulSelectedSource");
const azulSelectedColorLabel = document.getElementById("azulSelectedColor");
const azulSelectedRowLabel = document.getElementById("azulSelectedRow");

const azulFactoriesTop = document.getElementById("azulFactoriesTop");
const azulFactoriesBottom = document.getElementById("azulFactoriesBottom");
const azulCenter = document.getElementById("azulCenter");
const azulYourBoard = document.getElementById("azulYourBoard");
const azulPlayers = document.getElementById("azulPlayers");

const azulClearSelectionBtn = document.getElementById("azulClearSelectionBtn");
const azulFloorBtn = document.getElementById("azulFloorBtn");
const azulTakeBtn = document.getElementById("azulTakeBtn");

const azulHeaderActions = document.getElementById("azulHeaderActions");
const azulHelpBtn = document.getElementById("azulHelpBtn");
const azulExplainBtn = document.getElementById("azulExplainBtn");
const azulHelpModal = document.getElementById("azulHelpModal");
const azulHelpModalCloseBtn = document.getElementById("azulHelpModalCloseBtn");
const azulHelpContent = document.getElementById("azulHelpContent");
const azulExplainModal = document.getElementById("azulExplainModal");
const azulExplainModalCloseBtn = document.getElementById("azulExplainModalCloseBtn");
const azulExplainContent = document.getElementById("azulExplainContent");

const AZUL_COLOR_LABELS = {
  blue: "Blue",
  yellow: "Yellow",
  red: "Red",
  black: "Black",
  white: "White",
};

const AZUL_WALL_PATTERN = [
  ["blue", "yellow", "red", "black", "white"],
  ["white", "blue", "yellow", "red", "black"],
  ["black", "white", "blue", "yellow", "red"],
  ["red", "black", "white", "blue", "yellow"],
  ["yellow", "red", "black", "white", "blue"],
];

const AZUL_FLOOR_PENALTIES = [-1, -1, -2, -2, -2, -3, -3];

const AZUL_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Score the most points by completing rows, columns, and colors on your wall.</p>

  <h3>Turn</h3>
  <ol>
    <li>Take all tiles of one color from a factory or the center.</li>
    <li>If you are the first to take from the center, you also take the First Player token (counts as -1).</li>
    <li>Place the tiles into one pattern line (same color) or send all to the floor line. Extra tiles overflow to the floor.</li>
  </ol>

  <h3>Scoring</h3>
  <ul>
    <li>When all factories and the center are empty, move one tile from each full pattern line to the wall and score.</li>
    <li>New tile scores 1 if isolated, otherwise score connected row + column lengths.</li>
    <li>Floor penalties: -1, -1, -2, -2, -2, -3, -3.</li>
  </ul>

  <h3>End</h3>
  <p>Game ends after any player completes a horizontal row. Bonuses: +2 per full row, +7 per full column, +10 per full color.</p>
`;

const AZUL_BUTTON_EXPLANATIONS = {
  azulClearSelectionBtn: {
    name: "Clear Selection",
    description: "Reset your chosen source, color, and target row.",
  },
  azulFloorBtn: {
    name: "Send to Floor",
    description: "Choose the floor line as the destination (all tiles go to penalties).",
  },
  azulTakeBtn: {
    name: "Take Tiles",
    description: "Take the selected color from the chosen source and place it into the selected row.",
  },
};

function azulColorLabel(color) {
  return AZUL_COLOR_LABELS[color] || color || "-";
}

function azulSourceLabel(source) {
  if (!source) {
    return "-";
  }
  if (source.type === "center") {
    return "Center";
  }
  if (source.type === "factory") {
    return `Factory ${Number.isInteger(source.index) ? source.index + 1 : "-"}`;
  }
  return "-";
}

function azulRowLabel(row) {
  if (row === null || row === undefined) {
    return "-";
  }
  if (row < 0) {
    return "Floor";
  }
  return `Row ${row + 1}`;
}

function updateAzulSelectionLabels() {
  if (azulSelectedSourceLabel) {
    azulSelectedSourceLabel.textContent = azulSourceLabel(azulSelectedSource);
  }
  if (azulSelectedColorLabel) {
    azulSelectedColorLabel.textContent = azulSelectedColor ? azulColorLabel(azulSelectedColor) : "-";
  }
  if (azulSelectedRowLabel) {
    azulSelectedRowLabel.textContent = azulRowLabel(azulSelectedRow);
  }
}

function clearAzulSelection() {
  azulSelectedSource = null;
  azulSelectedColor = null;
  azulSelectedRow = null;
  updateAzulSelectionLabels();
  updateAzulActionButtons();
  if (currentAzulView) {
    renderAzulFactories(currentAzulView);
    renderAzulCenter(currentAzulView);
    renderAzulYourBoard(currentAzulView);
  }
}

function syncAzulSelection(view) {
  if (!view) {
    clearAzulSelection();
    return;
  }
  if (azulSelectedSource) {
    if (azulSelectedSource.type === "factory") {
      const idx = azulSelectedSource.index;
      const factory = Array.isArray(view.factories) ? view.factories[idx] : null;
      if (!factory || !factory.length) {
        azulSelectedSource = null;
        azulSelectedColor = null;
      } else if (azulSelectedColor && !factory.includes(azulSelectedColor)) {
        azulSelectedColor = null;
      }
    }
    if (azulSelectedSource.type === "center") {
      const center = Array.isArray(view.center) ? view.center : [];
      if (!center.length) {
        azulSelectedSource = null;
        azulSelectedColor = null;
      } else if (azulSelectedColor && !center.includes(azulSelectedColor)) {
        azulSelectedColor = null;
      }
    }
  }
  if (azulSelectedRow !== null && azulSelectedRow !== undefined) {
    if (!Number.isInteger(azulSelectedRow) || azulSelectedRow < -1 || azulSelectedRow > 4) {
      azulSelectedRow = null;
    }
  }
  updateAzulSelectionLabels();
}

function isAzulActionAvailable(actionType) {
  if (!currentAzulView || !Array.isArray(currentAzulView.legal_actions)) {
    return false;
  }
  return currentAzulView.legal_actions.includes(actionType);
}

function updateAzulActionButtons() {
  if (!azulTakeBtn) {
    return;
  }
  const canTake =
    isAzulActionAvailable("take_tiles") &&
    azulSelectedSource &&
    azulSelectedColor &&
    typeof azulSelectedRow === "number";
  azulTakeBtn.disabled = !canTake;
  if (azulFloorBtn) {
    azulFloorBtn.disabled = !isAzulActionAvailable("take_tiles");
  }
}

function makeAzulTile(color, sizeClass = "") {
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "azul-tile";
  if (sizeClass) {
    tile.classList.add(sizeClass);
  }
  if (color) {
    tile.classList.add(color);
    tile.setAttribute("aria-label", azulColorLabel(color));
  }
  return tile;
}

const AZUL_FACTORIES_TOP_LIMIT = 3;

function renderAzulFactories(view) {
  if (!azulFactoriesTop || !azulFactoriesBottom) {
    return;
  }
  azulFactoriesTop.innerHTML = "";
  azulFactoriesBottom.innerHTML = "";
  const factories = Array.isArray(view.factories) ? view.factories : [];
  const topCount = Math.min(AZUL_FACTORIES_TOP_LIMIT, factories.length);
  factories.forEach((factory, idx) => {
    const wrapper = document.createElement("div");
    wrapper.className = "azul-factory";
    if (azulSelectedSource && azulSelectedSource.type === "factory" && azulSelectedSource.index === idx) {
      wrapper.classList.add("selected");
    }
    const title = document.createElement("div");
    title.className = "azul-factory-title";
    title.textContent = `Factory ${idx + 1}`;
    wrapper.appendChild(title);
    const tiles = document.createElement("div");
    tiles.className = "azul-tiles";
    if (!factory || factory.length === 0) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "Empty";
      tiles.appendChild(empty);
    } else {
      factory.forEach((color) => {
        const tile = makeAzulTile(color, "lg");
        if (
          azulSelectedSource &&
          azulSelectedSource.type === "factory" &&
          azulSelectedSource.index === idx &&
          azulSelectedColor === color
        ) {
          tile.classList.add("selected");
        }
        tile.addEventListener("click", () => {
          azulSelectedSource = { type: "factory", index: idx };
          azulSelectedColor = color;
          updateAzulSelectionLabels();
          updateAzulActionButtons();
          renderAzulFactories(view);
          renderAzulCenter(view);
        });
        tiles.appendChild(tile);
      });
    }
    wrapper.appendChild(tiles);
    const target = idx < topCount ? azulFactoriesTop : azulFactoriesBottom;
    target.appendChild(wrapper);
  });
}

function renderAzulCenter(view) {
  if (!azulCenter) {
    return;
  }
  azulCenter.innerHTML = "";
  const centerTiles = Array.isArray(view.center) ? view.center : [];
  const wrap = document.createElement("div");
  wrap.className = "azul-center-wrap";
  if (azulSelectedSource && azulSelectedSource.type === "center") {
    wrap.classList.add("selected");
  }
  if (view.center_token) {
    const token = document.createElement("div");
    token.className = "azul-token";
    token.textContent = "1st";
    wrap.appendChild(token);
  }
  if (!centerTiles.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "Empty";
    wrap.appendChild(empty);
  } else {
    centerTiles.forEach((color) => {
      const tile = makeAzulTile(color, "lg");
      if (azulSelectedSource && azulSelectedSource.type === "center" && azulSelectedColor === color) {
        tile.classList.add("selected");
      }
      tile.addEventListener("click", () => {
        azulSelectedSource = { type: "center" };
        azulSelectedColor = color;
        updateAzulSelectionLabels();
        updateAzulActionButtons();
        renderAzulFactories(view);
        renderAzulCenter(view);
      });
      wrap.appendChild(tile);
    });
  }
  azulCenter.appendChild(wrap);
}

function buildAzulWallGrid(wall, compact) {
  const grid = document.createElement("div");
  grid.className = "azul-wall-grid";
  if (compact) {
    grid.classList.add("compact");
  }
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const cell = document.createElement("div");
      cell.className = "azul-wall-cell";
      const color = AZUL_WALL_PATTERN[row][col];
      if (color) {
        cell.classList.add(color);
      }
      if (wall && wall[row] && wall[row][col]) {
        cell.classList.add("filled");
      }
      grid.appendChild(cell);
    }
  }
  return grid;
}

function buildAzulPatternLine(line, rowIndex, interactive) {
  const lineWrap = document.createElement("div");
  lineWrap.className = "azul-pattern-line";
  const label = document.createElement("div");
  label.className = "azul-row-label";
  label.textContent = `${rowIndex + 1}`;
  lineWrap.appendChild(label);
  const slots = document.createElement("div");
  slots.className = "azul-pattern-slots";
  const capacity = rowIndex + 1;
  const count = line ? line.count : 0;
  const color = line ? line.color : null;
  for (let i = 0; i < capacity; i += 1) {
    const slot = document.createElement("div");
    slot.className = "azul-pattern-slot";
    if (i < count && color) {
      slot.classList.add("filled", color);
    }
    if (!color && i >= count) {
      slot.classList.add("empty");
    }
    slots.appendChild(slot);
  }
  lineWrap.appendChild(slots);
  if (interactive) {
    lineWrap.classList.add("selectable");
    lineWrap.addEventListener("click", () => {
      azulSelectedRow = rowIndex;
      updateAzulSelectionLabels();
      updateAzulActionButtons();
      renderAzulYourBoard(currentAzulView);
    });
  }
  return lineWrap;
}

function renderAzulYourBoard(view) {
  if (!azulYourBoard) {
    return;
  }
  azulYourBoard.innerHTML = "";
  if (!view || !Array.isArray(view.players)) {
    return;
  }
  const you = view.players.find((p) => p.player_id === view.you);
  if (!you) {
    return;
  }
  const board = document.createElement("div");
  board.className = "azul-board-grid";
  const main = document.createElement("div");
  main.className = "azul-board-main";
  const patternCol = document.createElement("div");
  patternCol.className = "azul-pattern-column";
  you.pattern_lines.forEach((line, idx) => {
    const lineWrap = buildAzulPatternLine(line, idx, true);
    if (azulSelectedRow === idx) {
      lineWrap.classList.add("selected");
    }
    patternCol.appendChild(lineWrap);
  });
  main.appendChild(patternCol);
  const wallGrid = buildAzulWallGrid(you.wall, false);
  main.appendChild(wallGrid);
  board.appendChild(main);
  const floorWrap = document.createElement("div");
  floorWrap.className = "azul-floor";
  if (azulSelectedRow === -1) {
    floorWrap.classList.add("selected");
  }
  floorWrap.addEventListener("click", () => {
    azulSelectedRow = -1;
    updateAzulSelectionLabels();
    updateAzulActionButtons();
    renderAzulYourBoard(view);
  });
  const floorLabel = document.createElement("div");
  floorLabel.className = "azul-floor-label";
  floorLabel.textContent = "Floor";
  floorWrap.appendChild(floorLabel);
  const slots = document.createElement("div");
  slots.className = "azul-floor-slots";
  for (let i = 0; i < 7; i += 1) {
    const slot = document.createElement("div");
    slot.className = "azul-floor-slot";
    const tile = you.floor && you.floor[i] ? you.floor[i] : null;
    if (tile === "first_player") {
      const token = document.createElement("div");
      token.className = "azul-token small";
      token.textContent = "1st";
      slot.appendChild(token);
    } else if (tile) {
      const chip = document.createElement("div");
      chip.className = "azul-tile sm";
      chip.classList.add(tile);
      slot.appendChild(chip);
    } else {
      slot.classList.add("empty");
    }
    slots.appendChild(slot);
  }
  floorWrap.appendChild(slots);
  const penalty = document.createElement("div");
  penalty.className = "azul-floor-penalty";
  penalty.textContent = `Penalties: ${AZUL_FLOOR_PENALTIES.join(" ")}`;
  floorWrap.appendChild(penalty);
  board.appendChild(floorWrap);
  azulYourBoard.appendChild(board);
}

function renderAzulPlayers(view) {
  if (!azulPlayers) {
    return;
  }
  azulPlayers.innerHTML = "";
  if (!view || !Array.isArray(view.players)) {
    return;
  }
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card azul-player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    const header = document.createElement("div");
    header.className = "azul-player-name";
    const tokenMark = player.has_first_player_token ? " ★" : "";
    header.textContent = `${player.name} · ${player.score} pts${tokenMark}`;
    card.appendChild(header);

    const patternSummary = document.createElement("div");
    patternSummary.className = "azul-pattern-summary";
    player.pattern_lines.forEach((line, idx) => {
      const chip = document.createElement("div");
      chip.className = "azul-pattern-chip";
      if (line.color) {
        chip.classList.add(line.color);
      }
      chip.textContent = `${idx + 1}: ${line.count}/${line.capacity}`;
      patternSummary.appendChild(chip);
    });
    card.appendChild(patternSummary);

    const wallGrid = buildAzulWallGrid(player.wall, true);
    card.appendChild(wallGrid);

    const floorInfo = document.createElement("div");
    floorInfo.className = "azul-floor-info";
    floorInfo.textContent = `Floor tiles: ${player.floor.length}`;
    card.appendChild(floorInfo);

    azulPlayers.appendChild(card);
  });
}

function renderAzulGameState(data) {
  if (!data || !data.view) {
    return;
  }
  currentAzulView = data.view;
  syncAzulSelection(currentAzulView);

  if (azulPhaseLabel) {
    azulPhaseLabel.textContent = currentAzulView.phase || "-";
  }
  if (azulRoundLabel) {
    azulRoundLabel.textContent = currentAzulView.round ?? "-";
  }
  if (azulTurnLabel) {
    azulTurnLabel.textContent = currentAzulView.current_turn ? findPlayerName(currentAzulView, currentAzulView.current_turn) : "-";
  }
  if (azulBagLabel) {
    azulBagLabel.textContent = Number.isInteger(currentAzulView.bag_count) ? String(currentAzulView.bag_count) : "-";
  }
  if (azulDiscardLabel) {
    azulDiscardLabel.textContent = Number.isInteger(currentAzulView.discard_count) ? String(currentAzulView.discard_count) : "-";
  }
  if (azulWinnerLabel) {
    if (currentAzulView.game_over && Array.isArray(currentAzulView.winner) && currentAzulView.winner.length > 0) {
      const names = currentAzulView.winner.map((pid) => findPlayerName(currentAzulView, pid));
      azulWinnerLabel.textContent = names.join(", ");
    } else {
      azulWinnerLabel.textContent = "-";
    }
  }

  updateAzulSelectionLabels();
  renderAzulFactories(currentAzulView);
  renderAzulCenter(currentAzulView);
  renderAzulYourBoard(currentAzulView);
  renderAzulPlayers(currentAzulView);
  updateAzulActionButtons();
}

function clearAzulState() {
  currentAzulView = null;
  clearAzulSelection();
  if (azulPhaseLabel) azulPhaseLabel.textContent = "-";
  if (azulRoundLabel) azulRoundLabel.textContent = "-";
  if (azulTurnLabel) azulTurnLabel.textContent = "-";
  if (azulBagLabel) azulBagLabel.textContent = "-";
  if (azulDiscardLabel) azulDiscardLabel.textContent = "-";
  if (azulWinnerLabel) azulWinnerLabel.textContent = "-";
  if (azulFactoriesTop) azulFactoriesTop.innerHTML = "";
  if (azulFactoriesBottom) azulFactoriesBottom.innerHTML = "";
  if (azulCenter) azulCenter.innerHTML = "";
  if (azulYourBoard) azulYourBoard.innerHTML = "";
  if (azulPlayers) azulPlayers.innerHTML = "";
  updateAzulActionButtons();
}

if (azulClearSelectionBtn) {
  azulClearSelectionBtn.addEventListener("click", () => {
    clearAzulSelection();
  });
}

if (azulFloorBtn) {
  azulFloorBtn.addEventListener("click", () => {
    azulSelectedRow = -1;
    updateAzulSelectionLabels();
    updateAzulActionButtons();
    renderAzulYourBoard(currentAzulView);
  });
}

if (azulTakeBtn) {
  azulTakeBtn.addEventListener("click", () => {
    if (!azulSelectedSource || !azulSelectedColor || typeof azulSelectedRow !== "number") {
      log("Select a source, color, and target row first");
      return;
    }
    const action = {
      type: "take_tiles",
      source: azulSelectedSource.type,
      color: azulSelectedColor,
      target_row: azulSelectedRow,
    };
    if (azulSelectedSource.type === "factory") {
      action.source_index = azulSelectedSource.index;
    }
    sendAction(action);
    clearAzulSelection();
  });
}

let azulExplainMode = false;

function showAzulHeaderActions(show) {
  if (azulHeaderActions) {
    azulHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitAzulExplainMode();
    closeAzulHelpModal();
    closeAzulExplainModal();
  }
}

function showAzulHelpModal() {
  if (!azulHelpModal) {
    return;
  }
  if (azulHelpContent) {
    azulHelpContent.innerHTML = AZUL_HELP_TEXT;
  }
  setModalVisible(azulHelpModal, true);
}

function closeAzulHelpModal() {
  if (azulHelpModal) {
    setModalVisible(azulHelpModal, false);
  }
}

function updateAzulExplainModeClasses(enabled) {
  Object.keys(AZUL_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
}

function findAzulButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(AZUL_BUTTON_EXPLANATIONS)) {
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  return null;
}

function toggleAzulExplainMode() {
  azulExplainMode = !azulExplainMode;
  document.body.classList.toggle("azul-explain-mode", azulExplainMode);
  updateAzulExplainModeClasses(azulExplainMode);
  if (azulExplainBtn) {
    azulExplainBtn.classList.toggle("active", azulExplainMode);
  }
}

function exitAzulExplainMode() {
  if (!azulExplainMode) {
    return;
  }
  azulExplainMode = false;
  document.body.classList.remove("azul-explain-mode");
  updateAzulExplainModeClasses(false);
  if (azulExplainBtn) {
    azulExplainBtn.classList.remove("active");
  }
}

function showAzulButtonExplanation(buttonId) {
  const explanation = AZUL_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !azulExplainContent || !azulExplainModal) {
    return;
  }
  const note = explanation.note ? `<div class=\"hint\">${explanation.note}</div>` : "";
  azulExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    ${note}
  `;
  setModalVisible(azulExplainModal, true);
}

function closeAzulExplainModal() {
  if (azulExplainModal) {
    setModalVisible(azulExplainModal, false);
  }
}

if (azulHelpBtn) {
  azulHelpBtn.addEventListener("click", () => {
    showAzulHelpModal();
  });
}

if (azulHelpModalCloseBtn) {
  azulHelpModalCloseBtn.addEventListener("click", closeAzulHelpModal);
}

if (azulExplainBtn) {
  azulExplainBtn.addEventListener("click", () => {
    toggleAzulExplainMode();
  });
}

if (azulExplainModalCloseBtn) {
  azulExplainModalCloseBtn.addEventListener("click", closeAzulExplainModal);
}

document.addEventListener("pointerdown", (e) => {
  if (!azulExplainMode) return;

  const buttonId = findAzulButtonAtPoint(e.clientX, e.clientY);
  if (buttonId) {
    e.preventDefault();
    e.stopPropagation();
    showAzulButtonExplanation(buttonId);
    exitAzulExplainMode();
    return;
  }

  const button = e.target.closest("button");
  if (button === azulExplainBtn || button === azulHelpBtn) return;
  if (button === azulHelpModalCloseBtn || button === azulExplainModalCloseBtn) return;

  if (button) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

document.addEventListener("click", (e) => {
  if (!azulExplainMode) return;

  const button = e.target.closest("button");
  if (!button) return;

  if (button === azulExplainBtn || button === azulHelpBtn) return;
  if (button === azulHelpModalCloseBtn || button === azulExplainModalCloseBtn) return;

  e.preventDefault();
  e.stopPropagation();
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && azulExplainMode) {
    exitAzulExplainMode();
  }
});
