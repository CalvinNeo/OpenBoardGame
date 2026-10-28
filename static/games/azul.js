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
const azulWinnerStatus = document.getElementById("azulWinnerStatus");
const azulGamePanelElement = document.getElementById("azulPanel");

const azulSelectedSourceLabel = document.getElementById("azulSelectedSource");
const azulSelectedColorLabel = document.getElementById("azulSelectedColor");
const azulSelectedRowLabel = document.getElementById("azulSelectedRow");

const azulFactories = document.getElementById("azulFactories");
const azulCenter = document.getElementById("azulCenter");
const azulYourBoard = document.getElementById("azulYourBoard");
const azulPlayers = document.getElementById("azulPlayers");
const azulPlayersDetails = document.getElementById("azulPlayersDetails");
const azulScoreBanner = document.getElementById("azulScoreBanner");
const azulMarket = document.querySelector("#azulPanel .azul-market");
let azulPlayersDetailsInitialized = false;
let azulScoreBannerTimer = null;

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
  blue: "Blue (🟦)",
  yellow: "Yellow (🟨)",
  red: "Red (🟥)",
  black: "Black (⬛)",
  white: "White (🔹)",
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
    <li>Take all tiles of one color from a factory or the Center (🏛️). Center counts (×N) show how many tiles you take.</li>
    <li>If you are the first to take from the center, you also take the First Player token (1st). It occupies a floor space and makes you start the next round. A star (★) marks its holder.</li>
    <li>Tap a legal numbered pattern line or Floor. Confirm the inline message, which spells out how many tiles go to each destination. Extra tiles overflow to the floor.</li>
  </ol>

  <h3>Controls &amp; tiles</h3>
  <p>Select a color, then tap a legal numbered pattern line or Floor. An inline confirmation tells you how many tiles will be placed and where; confirm or cancel there. Tap empty space or press Esc to cancel your selection.</p>
  <p>Tile colors: Blue (🟦), Yellow (🟨), Red (🟥), Black (⬛), and White (🔹, a turquoise diamond on white). Faded wall spaces are empty; solid spaces are filled. Player summaries show each line as row: filled/capacity; pts means points.</p>

  <h3>Scoring</h3>
  <p>Click any player's name and score in Players to see the current score components. The banner disappears automatically.</p>
  <ul>
    <li>When all factories and the center are empty, move one tile from each full pattern line to the wall and score.</li>
    <li>New tile scores 1 if isolated, otherwise score connected row + column lengths.</li>
    <li>Floor penalties: -1, -1, -2, -2, -2, -3, -3.</li>
  </ul>

  <h3>End</h3>
  <p>Game ends after any player completes a horizontal row. Bonuses: +2 per full row, +7 per full column, +10 per full color.</p>
`;

let azulConfirmTargetRow = null;

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

function formatAzulScoreComponent(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) {
    return "0";
  }
  return amount > 0 ? `+${amount}` : `−${Math.abs(amount)}`;
}

function formatAzulWallRoundDetails(breakdown) {
  const rounds = Array.isArray(breakdown && breakdown.wall_points_by_round)
    ? breakdown.wall_points_by_round.filter(
        (entry) =>
          entry &&
          Number.isFinite(Number(entry.round)) &&
          Number.isFinite(Number(entry.points)),
      )
    : [];
  if (rounds.length) {
    return `Wall: ${rounds
      .map((entry) => `Round ${Number(entry.round)} ${formatAzulScoreComponent(entry.points)}`)
      .join(" · ")}`;
  }
  const total = Number(breakdown && breakdown.wall_points);
  if (Number.isFinite(total)) {
    return `Wall tiles ${formatAzulScoreComponent(total)}`;
  }
  return "Wall: no completed rounds yet";
}

function hideAzulScoreBanner() {
  if (!azulScoreBanner) {
    return;
  }
  window.clearTimeout(azulScoreBannerTimer);
  azulScoreBannerTimer = null;
  azulScoreBanner.classList.remove("is-visible");
  window.setTimeout(() => {
    if (!azulScoreBanner.classList.contains("is-visible")) {
      azulScoreBanner.hidden = true;
    }
  }, 180);
}

function showAzulScoreBanner(player) {
  if (!azulScoreBanner || !player) {
    return;
  }
  window.clearTimeout(azulScoreBannerTimer);
  azulScoreBannerTimer = null;

  const title = document.createElement("strong");
  title.className = "azul-score-banner-title";
  title.textContent = `${player.name || "Player"} · ${Number(player.score) || 0} pts`;
  azulScoreBanner.replaceChildren(title);

  const breakdown = player.score_breakdown;
  if (breakdown && typeof breakdown === "object") {
    const wallDetails = document.createElement("div");
    wallDetails.className = "azul-score-banner-wall";
    wallDetails.textContent = formatAzulWallRoundDetails(breakdown);
    azulScoreBanner.appendChild(wallDetails);

    const parts = [
      ["Floor penalties", breakdown.floor_penalty],
      ["Zero-score protection", breakdown.floor_clamp],
      ["Rows", breakdown.row_bonus],
      ["Columns", breakdown.column_bonus],
      ["Colors", breakdown.color_bonus],
    ];
    const details = document.createElement("div");
    details.className = "azul-score-banner-details";
    details.textContent = parts
      .map(([label, value]) => `${label} ${formatAzulScoreComponent(value)}`)
      .join(" · ");
    azulScoreBanner.appendChild(details);

    const pendingPenalty = Number(breakdown.pending_floor_penalty);
    if (Number.isFinite(pendingPenalty) && pendingPenalty < 0) {
      const pending = document.createElement("div");
      pending.className = "azul-score-banner-pending";
      pending.textContent = `Current floor (pending) ${formatAzulScoreComponent(pendingPenalty)}`;
      azulScoreBanner.appendChild(pending);
    }
    if (breakdown.legacy) {
      const legacy = document.createElement("div");
      legacy.className = "azul-score-banner-pending";
      legacy.textContent = "Earlier scoring is grouped under Wall tiles.";
      azulScoreBanner.appendChild(legacy);
    }
  } else {
    const unavailable = document.createElement("div");
    unavailable.className = "azul-score-banner-pending";
    unavailable.textContent = "Detailed score components are unavailable for this saved game.";
    azulScoreBanner.appendChild(unavailable);
  }

  azulScoreBanner.hidden = false;
  azulScoreBanner.classList.remove("is-visible");
  window.requestAnimationFrame(() => azulScoreBanner.classList.add("is-visible"));
  azulScoreBannerTimer = window.setTimeout(hideAzulScoreBanner, 4200);
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
  azulConfirmTargetRow = null;
  updateAzulSelectionLabels();
  if (currentAzulView) {
    renderAzulFactories(currentAzulView);
    renderAzulCenter(currentAzulView);
    renderAzulYourBoard(currentAzulView);
  }
}

function getAzulSelfPlayer(view) {
  if (!view || !Array.isArray(view.players)) {
    return null;
  }
  return view.players.find((player) => player.player_id === view.you) || null;
}

function isAzulRowPlaceable(view, rowIndex, color) {
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex > 4 || !color) {
    return false;
  }
  const you = getAzulSelfPlayer(view);
  if (!you || !Array.isArray(you.pattern_lines) || !Array.isArray(you.wall)) {
    return false;
  }
  const line = you.pattern_lines[rowIndex];
  if (!line) {
    return false;
  }
  if (line.color && line.color !== color) {
    return false;
  }
  if (line.count >= line.capacity) {
    return false;
  }
  const colIndex = AZUL_WALL_PATTERN[rowIndex].indexOf(color);
  if (colIndex < 0) {
    return false;
  }
  if (you.wall[rowIndex] && you.wall[rowIndex][colIndex]) {
    return false;
  }
  return true;
}

function getAzulSelectedTileCount(view) {
  if (!view || !azulSelectedSource || !azulSelectedColor) {
    return 0;
  }
  const tiles = azulSelectedSource.type === "center"
    ? (Array.isArray(view.center) ? view.center : [])
    : (Array.isArray(view.factories?.[azulSelectedSource.index]) ? view.factories[azulSelectedSource.index] : []);
  return tiles.filter((tile) => tile === azulSelectedColor).length;
}

function getAzulTargetLabel(rowIndex) {
  return rowIndex < 0 ? "Floor" : `Row ${rowIndex + 1}`;
}

function getAzulPlacementSummary(view, rowIndex) {
  const count = getAzulSelectedTileCount(view);
  const targetLabel = getAzulTargetLabel(rowIndex);
  if (rowIndex < 0) {
    return { count, placed: 0, overflow: count, targetLabel };
  }
  const you = getAzulSelfPlayer(view);
  const line = you && Array.isArray(you.pattern_lines) ? you.pattern_lines[rowIndex] : null;
  const filled = line && Number.isFinite(Number(line.count)) ? Number(line.count) : 0;
  const free = Math.max(0, rowIndex + 1 - filled);
  const placed = Math.min(free, count);
  return { count, placed, overflow: Math.max(0, count - placed), targetLabel };
}

function getAzulConfirmationLabel(view, rowIndex) {
  const summary = getAzulPlacementSummary(view, rowIndex);
  const color = azulSelectedColor ? azulColorLabel(azulSelectedColor) : "tile";
  const tileWord = (value) => `tile${value === 1 ? "" : "s"}`;
  const firstPlayerSuffix = azulSelectedSource?.type === "center" && view?.center_token
    ? " · + First Player token → Floor"
    : "";
  if (rowIndex < 0) {
    return `Send ${summary.count} ${color} ${tileWord(summary.count)} → Floor${firstPlayerSuffix}`;
  }
  const placedText = `Place ${summary.placed} ${color} ${tileWord(summary.placed)} → ${summary.targetLabel}`;
  if (summary.overflow > 0) {
    return `${placedText} · ${summary.overflow} overflow → Floor${firstPlayerSuffix}`;
  }
  return `${placedText}${firstPlayerSuffix}`;
}

function submitAzulTarget(rowIndex) {
  if (!isAzulActionAvailable("take_tiles") || !azulSelectedSource || !azulSelectedColor) {
    return;
  }
  if (rowIndex >= 0 && !isAzulRowPlaceable(currentAzulView, rowIndex, azulSelectedColor)) {
    clearAzulSelection();
    return;
  }
  const action = {
    type: "take_tiles",
    source: azulSelectedSource.type,
    color: azulSelectedColor,
    target_row: rowIndex,
  };
  if (azulSelectedSource.type === "factory") {
    action.source_index = azulSelectedSource.index;
  }
  sendAction(action);
  clearAzulSelection();
}

function requestAzulTargetConfirmation(rowIndex) {
  if (!isAzulActionAvailable("take_tiles") || !azulSelectedSource || !azulSelectedColor) {
    return;
  }
  if (rowIndex >= 0 && !isAzulRowPlaceable(currentAzulView, rowIndex, azulSelectedColor)) {
    return;
  }
  azulSelectedRow = rowIndex;
  azulConfirmTargetRow = rowIndex;
  updateAzulSelectionLabels();
  renderAzulYourBoard(currentAzulView);
}

function buildAzulInlineConfirmation(rowIndex) {
  const confirmationLabel = getAzulConfirmationLabel(currentAzulView, rowIndex);
  const confirmWrap = document.createElement("div");
  confirmWrap.className = "azul-inline-confirm";
  confirmWrap.setAttribute("role", "group");
  confirmWrap.setAttribute("aria-label", confirmationLabel);
  confirmWrap.hidden = azulConfirmTargetRow !== rowIndex;

  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.className = "azul-confirm-button";
  confirmButton.textContent = confirmationLabel;
  setAzulTip(confirmButton, `Confirm: ${confirmationLabel}. This takes the selected tiles from the source.`);
  confirmButton.addEventListener("click", (event) => {
    event.stopPropagation();
    submitAzulTarget(rowIndex);
  });

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "azul-cancel-button";
  cancelButton.textContent = "Cancel";
  setAzulTip(cancelButton, "Cancel this destination and keep the selected tiles ready for another target.");
  cancelButton.addEventListener("click", (event) => {
    event.stopPropagation();
    azulSelectedRow = null;
    azulConfirmTargetRow = null;
    updateAzulSelectionLabels();
    renderAzulYourBoard(currentAzulView);
  });

  confirmWrap.append(confirmButton, cancelButton);
  return confirmWrap;
}

function syncAzulSelection(view) {
  if (!view) {
    clearAzulSelection();
    return;
  }
  if (!isAzulActionAvailable("take_tiles")) {
    azulSelectedSource = null;
    azulSelectedColor = null;
    azulSelectedRow = null;
    azulConfirmTargetRow = null;
  }
  if (azulSelectedSource) {
    if (azulSelectedSource.type === "factory") {
      const idx = azulSelectedSource.index;
      const factory = Array.isArray(view.factories) ? view.factories[idx] : null;
      if (!factory || !factory.length) {
        azulSelectedSource = null;
        azulSelectedColor = null;
        azulSelectedRow = null;
        azulConfirmTargetRow = null;
      } else if (azulSelectedColor && !factory.includes(azulSelectedColor)) {
        azulSelectedColor = null;
        azulSelectedRow = null;
        azulConfirmTargetRow = null;
      }
    }
    if (azulSelectedSource && azulSelectedSource.type === "center") {
      const center = Array.isArray(view.center) ? view.center : [];
      if (!center.length) {
        azulSelectedSource = null;
        azulSelectedColor = null;
        azulSelectedRow = null;
        azulConfirmTargetRow = null;
      } else if (azulSelectedColor && !center.includes(azulSelectedColor)) {
        azulSelectedColor = null;
        azulSelectedRow = null;
        azulConfirmTargetRow = null;
      }
    }
  }
  if (azulSelectedRow !== null && azulSelectedRow !== undefined) {
    if (!Number.isInteger(azulSelectedRow) || azulSelectedRow < -1 || azulSelectedRow > 4) {
      azulSelectedRow = null;
      azulConfirmTargetRow = null;
    }
  }
  if (
    azulSelectedRow !== null &&
    azulSelectedRow >= 0 &&
    azulSelectedColor &&
    !isAzulRowPlaceable(view, azulSelectedRow, azulSelectedColor)
  ) {
    azulSelectedRow = null;
    azulConfirmTargetRow = null;
  }
  updateAzulSelectionLabels();
}

function isAzulActionAvailable(actionType) {
  if (!currentAzulView || !Array.isArray(currentAzulView.legal_actions)) {
    return false;
  }
  return currentAzulView.legal_actions.includes(actionType);
}

function setAzulTip(element, message) {
  element.dataset.azulTip = message;
  element.setAttribute("aria-label", message);
}

function selectAzulTiles(source, color) {
  if (!isAzulActionAvailable("take_tiles")) return;
  azulSelectedSource = source;
  azulSelectedColor = color;
  azulSelectedRow = null;
  azulConfirmTargetRow = null;
  syncAzulSelection(currentAzulView);
  renderAzulFactories(currentAzulView);
  renderAzulCenter(currentAzulView);
  renderAzulYourBoard(currentAzulView);
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

function renderAzulFactories(view) {
  if (!azulFactories) {
    return;
  }
  azulFactories.innerHTML = "";
  const factories = Array.isArray(view.factories) ? view.factories : [];
  const factoryCount = String(factories.length);
  azulFactories.dataset.factoryCount = factoryCount;
  if (azulMarket) {
    azulMarket.dataset.factoryCount = factoryCount;
  }
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
        const count = factory.filter((tileColor) => tileColor === color).length;
        setAzulTip(tile, `${azulColorLabel(color)}: take all ${count} from Factory ${idx + 1}. Other colors move to the Center (🏛️).`);
        tile.setAttribute("aria-pressed", String(tile.classList.contains("selected")));
        tile.setAttribute("aria-disabled", String(!isAzulActionAvailable("take_tiles")));
        tile.addEventListener("click", () => selectAzulTiles({ type: "factory", index: idx }, color));
        tiles.appendChild(tile);
      });
    }
    wrapper.appendChild(tiles);
    azulFactories.appendChild(wrapper);
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
    token.tabIndex = 0;
    setAzulTip(token, "First Player token (1st): taking from the Center (🏛️) puts this on your floor. You start the next round.");
    wrap.appendChild(token);
  }
  if (!centerTiles.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "Empty";
    wrap.appendChild(empty);
  } else {
    Object.keys(AZUL_COLOR_LABELS).forEach((color) => {
      const count = centerTiles.filter((tileColor) => tileColor === color).length;
      if (!count) return;
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "azul-center-choice";
      const chip = document.createElement("span");
      chip.className = `azul-tile ${color}`;
      chip.setAttribute("aria-hidden", "true");
      tile.appendChild(chip);
      const quantity = document.createElement("span");
      quantity.textContent = `×${count}`;
      tile.appendChild(quantity);
      if (azulSelectedSource && azulSelectedSource.type === "center" && azulSelectedColor === color) {
        tile.classList.add("selected");
      }
      setAzulTip(tile, `${azulColorLabel(color)} ×${count}: take all ${count} from the Center (🏛️).${view.center_token ? " Also take the First Player token (1st)." : ""}`);
      tile.setAttribute("aria-pressed", String(tile.classList.contains("selected")));
      tile.setAttribute("aria-disabled", String(!isAzulActionAvailable("take_tiles")));
      tile.addEventListener("click", () => selectAzulTiles({ type: "center" }, color));
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
      cell.tabIndex = 0;
      setAzulTip(cell, `Wall row ${row + 1}, ${azulColorLabel(color)}: ${cell.classList.contains("filled") ? "filled" : "empty"}. A full matching pattern line places one tile here.`);
      grid.appendChild(cell);
    }
  }
  return grid;
}

function buildAzulPatternLine(line, rowIndex, interactive, canSelect = true) {
  const lineWrap = document.createElement(interactive ? "button" : "div");
  if (interactive) lineWrap.type = "button";
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
  setAzulTip(lineWrap, `Pattern line ${rowIndex + 1}: ${count}/${capacity} tiles${color ? `, ${azulColorLabel(color)}` : ""}.${canSelect ? " Choose this line for your tiles." : " This line cannot take your selected tiles."}`);
  lineWrap.setAttribute("aria-pressed", String(azulSelectedRow === rowIndex));
  lineWrap.setAttribute("aria-disabled", String(!canSelect));
  if (count >= capacity) {
    lineWrap.classList.add("full");
  }
  for (let i = 0; i < capacity; i += 1) {
    const slot = document.createElement("div");
    slot.className = "azul-pattern-slot";
    if (i === 0) slot.style.gridColumnStart = String(6 - capacity);
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
    if (canSelect) {
      lineWrap.addEventListener("click", () => {
        requestAzulTargetConfirmation(rowIndex);
      });
    } else {
      lineWrap.classList.add("disabled");
    }
  }
  const targetWrap = document.createElement("div");
  targetWrap.className = "azul-target-wrap";
  targetWrap.append(lineWrap);
  if (canSelect && azulSelectedSource && azulSelectedColor) {
    targetWrap.appendChild(buildAzulInlineConfirmation(rowIndex));
  }
  return targetWrap;
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
  const headings = document.createElement("div");
  headings.className = "azul-board-headings";
  headings.innerHTML = "<span>Pattern lines</span><span>Wall</span>";
  board.appendChild(headings);
  const main = document.createElement("div");
  main.className = "azul-board-main";
  const patternCol = document.createElement("div");
  patternCol.className = "azul-pattern-column";
  you.pattern_lines.forEach((line, idx) => {
    const canSelectRow = isAzulActionAvailable("take_tiles") && !!azulSelectedSource && !!azulSelectedColor && isAzulRowPlaceable(view, idx, azulSelectedColor);
    const lineWrap = buildAzulPatternLine(line, idx, true, canSelectRow);
    if (azulSelectedRow === idx) {
      lineWrap.querySelector(".azul-pattern-line")?.classList.add("selected");
    }
    patternCol.appendChild(lineWrap);
  });
  main.appendChild(patternCol);
  const wallGrid = buildAzulWallGrid(you.wall, false);
  main.appendChild(wallGrid);
  board.appendChild(main);
  const floorTargetWrap = document.createElement("div");
  floorTargetWrap.className = "azul-target-wrap azul-floor-target-wrap";
  const floorWrap = document.createElement("button");
  const canSelectFloor = isAzulActionAvailable("take_tiles") && !!azulSelectedSource && !!azulSelectedColor;
  floorWrap.type = "button";
  floorWrap.className = "azul-floor";
  if (!canSelectFloor) {
    floorWrap.classList.add("disabled");
  }
  setAzulTip(floorWrap, "Floor: choose this destination, then confirm. Each occupied space loses the points shown above it at round end.");
  floorWrap.setAttribute("aria-pressed", String(azulSelectedRow === -1));
  floorWrap.setAttribute("aria-disabled", String(!canSelectFloor));
  if (azulSelectedRow === -1) {
    floorWrap.classList.add("selected");
  }
  floorWrap.addEventListener("click", () => {
    if (!canSelectFloor) return;
    requestAzulTargetConfirmation(-1);
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
    const penaltyValue = AZUL_FLOOR_PENALTIES[i] ?? 0;
    const penaltyText = document.createElement("span");
    penaltyText.className = "azul-floor-slot-penalty";
    penaltyText.textContent = String(penaltyValue);
    slot.appendChild(penaltyText);
    const tile = you.floor && you.floor[i] ? you.floor[i] : null;
    if (tile === "first_player") {
      const token = document.createElement("div");
      token.className = "azul-token small";
      token.textContent = "1st";
      setAzulTip(token, "First Player token (1st): you start the next round. This floor space still costs its displayed penalty.");
      slot.appendChild(token);
    } else if (tile) {
      const chip = document.createElement("div");
      chip.className = "azul-tile sm";
      chip.classList.add(tile);
      setAzulTip(chip, `${azulColorLabel(tile)} on the floor: ${penaltyValue} points at round end.`);
      slot.appendChild(chip);
    } else {
      slot.classList.add("empty");
    }
    slots.appendChild(slot);
  }
  floorWrap.appendChild(slots);
  floorTargetWrap.appendChild(floorWrap);
  if (azulSelectedSource && azulSelectedColor) {
    floorTargetWrap.appendChild(buildAzulInlineConfirmation(-1));
  }
  board.appendChild(floorTargetWrap);
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
    const header = document.createElement("button");
    header.type = "button";
    header.className = "azul-player-name azul-player-score-trigger";
    const tokenMark = player.has_first_player_token ? " ★" : "";
    const playerName = player.name || "Player";
    header.textContent = `${playerName} · ${player.score} pts${tokenMark}`;
    header.setAttribute("aria-label", `Show ${playerName}'s score breakdown`);
    header.addEventListener("click", () => showAzulScoreBanner(player));
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
      chip.tabIndex = 0;
      setAzulTip(chip, `Pattern line ${idx + 1}: ${line.count} of ${line.capacity} spaces filled${line.color ? ` with ${azulColorLabel(line.color)}` : ""}.`);
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
  hideAzulTip();
  if (azulPlayersDetails && !azulPlayersDetailsInitialized) {
    azulPlayersDetails.open = !window.matchMedia("(max-width: 720px)").matches;
    azulPlayersDetailsInitialized = true;
  }
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
  if (azulWinnerStatus) {
    azulWinnerStatus.classList.toggle("hidden", !currentAzulView.game_over);
  }

  updateAzulSelectionLabels();
  renderAzulFactories(currentAzulView);
  renderAzulCenter(currentAzulView);
  renderAzulYourBoard(currentAzulView);
  renderAzulPlayers(currentAzulView);
}

function clearAzulState() {
  currentAzulView = null;
  azulPlayersDetailsInitialized = false;
  hideAzulTip();
  hideAzulScoreBanner();
  clearAzulSelection();
  if (azulPhaseLabel) azulPhaseLabel.textContent = "-";
  if (azulRoundLabel) azulRoundLabel.textContent = "-";
  if (azulTurnLabel) azulTurnLabel.textContent = "-";
  if (azulBagLabel) azulBagLabel.textContent = "-";
  if (azulDiscardLabel) azulDiscardLabel.textContent = "-";
  if (azulWinnerLabel) azulWinnerLabel.textContent = "-";
  if (azulWinnerStatus) azulWinnerStatus.classList.add("hidden");
  if (azulFactories) azulFactories.innerHTML = "";
  if (azulCenter) azulCenter.innerHTML = "";
  if (azulYourBoard) azulYourBoard.innerHTML = "";
  if (azulPlayers) azulPlayers.innerHTML = "";
}

let azulExplainMode = false;
let azulExplainPointerHandled = false;
let azulTipTimer = null;
let azulTipTarget = null;

function hideAzulTip() {
  window.clearTimeout(azulTipTimer);
  azulTipTimer = null;
  if (azulTipTarget) azulTipTarget.removeAttribute("aria-describedby");
  azulTipTarget = null;
  const tip = document.getElementById("azulTip");
  if (tip) tip.hidden = true;
}

function showAzulTip(target, timed = false) {
  if (azulExplainMode || !target.dataset.azulTip) return;
  hideAzulTip();
  let tip = document.getElementById("azulTip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "azulTip";
    tip.className = "azul-tip";
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
  }
  tip.textContent = target.dataset.azulTip;
  tip.hidden = false;
  azulTipTarget = target;
  target.setAttribute("aria-describedby", tip.id);
  const rect = target.getBoundingClientRect();
  const box = tip.getBoundingClientRect();
  tip.style.left = `${Math.max(12, Math.min(window.innerWidth - box.width - 12, rect.left))}px`;
  const top = rect.top - box.height - 8;
  tip.style.top = `${Math.max(12, Math.min(window.innerHeight - box.height - 12, top >= 12 ? top : rect.bottom + 8))}px`;
  if (timed) azulTipTimer = window.setTimeout(hideAzulTip, 3000);
}

if (azulGamePanelElement) {
  azulGamePanelElement.addEventListener("pointerover", (event) => {
    if (event.pointerType !== "mouse") return;
    const target = event.target.closest("[data-azul-tip]");
    if (target) showAzulTip(target);
  });
  azulGamePanelElement.addEventListener("pointerout", (event) => {
    if (event.pointerType === "mouse" && azulTipTarget && !azulTipTarget.contains(event.relatedTarget)) hideAzulTip();
  });
  azulGamePanelElement.addEventListener("focusin", (event) => {
    if (window.matchMedia("(hover: none)").matches) return;
    const target = event.target.closest("[data-azul-tip]");
    if (target) showAzulTip(target);
  });
  azulGamePanelElement.addEventListener("focusout", () => {
    if (!window.matchMedia("(hover: none)").matches) hideAzulTip();
  });
  // Capture the tapped tile before selection redraws its factory or board.
  azulGamePanelElement.addEventListener("click", (event) => {
    if (azulExplainMode) return;
    const target = event.target.closest("[data-azul-tip]");
    const isInteractive = target && event.target.closest("button, a, summary, input, select, textarea");
    if (target && !isInteractive && (event.pointerType === "touch" || window.matchMedia("(hover: none)").matches)) {
      showAzulTip(target, true);
    }
    if (!event.target.closest("button, [data-azul-tip], summary, a, input, select, textarea")) {
      hideAzulTip();
      clearAzulSelection();
    }
  }, true);
}

window.addEventListener("scroll", hideAzulTip, true);
window.addEventListener("resize", hideAzulTip);

function showAzulHeaderActions(show) {
  if (azulHeaderActions) {
    azulHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    hideAzulTip();
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
  hideAzulTip();
  setModalVisible(azulHelpModal, true);
}

function closeAzulHelpModal() {
  if (azulHelpModal) {
    setModalVisible(azulHelpModal, false);
  }
}

function updateAzulExplainModeClasses(enabled) {
  if (azulGamePanelElement) {
    azulGamePanelElement.querySelectorAll("[data-azul-tip]").forEach((element) => {
      element.classList.toggle("has-explanation", enabled);
    });
  }
}

function toggleAzulExplainMode() {
  hideAzulTip();
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

function showAzulExplanation(name, description) {
  if (!azulExplainContent || !azulExplainModal) return;
  hideAzulTip();
  const title = document.createElement("h4");
  title.textContent = name;
  const text = document.createElement("p");
  text.textContent = description;
  azulExplainContent.replaceChildren(title, text);
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
  azulExplainPointerHandled = false;
  if (!azulExplainMode) return;

  const button = e.target.closest("button");
  if (button === azulExplainBtn || button === azulHelpBtn) return;
  if (button === azulHelpModalCloseBtn || button === azulExplainModalCloseBtn) return;

  const target = e.target.closest("#azulPanel [data-azul-tip]");
  if (target) {
    azulExplainPointerHandled = true;
    e.preventDefault();
    e.stopPropagation();
    showAzulExplanation("Tiles & Board", target.dataset.azulTip);
    exitAzulExplainMode();
    return;
  }

  if (button || e.target.closest("summary")) {
    azulExplainPointerHandled = true;
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

document.addEventListener("click", (e) => {
  if (azulExplainPointerHandled) {
    azulExplainPointerHandled = false;
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (!azulExplainMode) return;

  const button = e.target.closest("button");
  if (button === azulExplainBtn || button === azulHelpBtn) return;
  if (button === azulHelpModalCloseBtn || button === azulExplainModalCloseBtn) return;

  const target = e.target.closest("#azulPanel [data-azul-tip]");
  if (button || target || e.target.closest("summary")) {
    e.preventDefault();
    e.stopPropagation();
    if (target) {
      showAzulExplanation("Tiles & Board", target.dataset.azulTip);
      exitAzulExplainMode();
    }
  }
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const modalOpen = (azulHelpModal && !azulHelpModal.classList.contains("hidden")) ||
    (azulExplainModal && !azulExplainModal.classList.contains("hidden"));
  const explaining = azulExplainMode;
  exitAzulExplainMode();
  closeAzulHelpModal();
  closeAzulExplainModal();
  hideAzulTip();
  if (!modalOpen && !explaining && azulGamePanelElement && !azulGamePanelElement.classList.contains("hidden")) clearAzulSelection();
});

[azulHelpModal, azulExplainModal].forEach((modal) => {
  if (!modal) return;
  modal.addEventListener("click", (event) => {
    if (event.target === modal) setModalVisible(modal, false);
  });
});
