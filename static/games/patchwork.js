let currentPatchworkView = null;
let patchworkSelectedPatchId = null;
let patchworkRotation = 0;
let patchworkFlip = false;
let patchworkAnchor = null;
let patchworkExplainMode = false;
const PATCHWORK_PREVIEW_JEWELS = [
  { fillTop: "#fb7185", fillBottom: "#be123c", border: "#881337", glow: "rgba(244, 63, 94, 0.28)" },
  { fillTop: "#60a5fa", fillBottom: "#1d4ed8", border: "#1e3a8a", glow: "rgba(37, 99, 235, 0.28)" },
  { fillTop: "#34d399", fillBottom: "#047857", border: "#065f46", glow: "rgba(16, 185, 129, 0.28)" },
  { fillTop: "#c084fc", fillBottom: "#7e22ce", border: "#581c87", glow: "rgba(147, 51, 234, 0.26)" },
  { fillTop: "#fbbf24", fillBottom: "#b45309", border: "#78350f", glow: "rgba(245, 158, 11, 0.28)" },
  { fillTop: "#22d3ee", fillBottom: "#0f766e", border: "#134e4a", glow: "rgba(6, 182, 212, 0.26)" },
  { fillTop: "#f472b6", fillBottom: "#be185d", border: "#831843", glow: "rgba(236, 72, 153, 0.26)" },
  { fillTop: "#a3e635", fillBottom: "#4d7c0f", border: "#365314", glow: "rgba(132, 204, 22, 0.24)" },
  { fillTop: "#fdba74", fillBottom: "#c2410c", border: "#7c2d12", glow: "rgba(249, 115, 22, 0.24)" },
  { fillTop: "#93c5fd", fillBottom: "#4f46e5", border: "#312e81", glow: "rgba(99, 102, 241, 0.24)" },
];

const patchworkPanel = document.getElementById("patchworkPanel");
const patchworkHeaderActions = document.getElementById("patchworkHeaderActions");
const patchworkHelpBtn = document.getElementById("patchworkHelpBtn");
const patchworkExplainBtn = document.getElementById("patchworkExplainBtn");
const patchworkHelpModal = document.getElementById("patchworkHelpModal");
const patchworkHelpModalCloseBtn = document.getElementById("patchworkHelpModalCloseBtn");
const patchworkExplainModal = document.getElementById("patchworkExplainModal");
const patchworkExplainModalCloseBtn = document.getElementById("patchworkExplainModalCloseBtn");
const patchworkQuiltModal = document.getElementById("patchworkQuiltModal");
const patchworkQuiltModalCloseBtn = document.getElementById("patchworkQuiltModalCloseBtn");
const patchworkQuiltModalTitle = document.getElementById("patchworkQuiltModalTitle");
const patchworkQuiltModalMeta = document.getElementById("patchworkQuiltModalMeta");
const patchworkQuiltModalBoard = document.getElementById("patchworkQuiltModalBoard");
const patchworkHelpContent = document.getElementById("patchworkHelpContent");
const patchworkExplainContent = document.getElementById("patchworkExplainContent");

const patchworkTurnLabel = document.getElementById("patchworkTurn");
const patchworkSelectedPatchLabel = document.getElementById("patchworkSelectedPatch");
const patchworkRotationLabel = document.getElementById("patchworkRotation");
const patchworkFlipLabel = document.getElementById("patchworkFlip");
const patchworkAnchorLabel = document.getElementById("patchworkAnchor");
const patchworkSpecialTileLabel = document.getElementById("patchworkSpecialTile");
const patchworkFirstFinishLabel = document.getElementById("patchworkFirstFinish");
const patchworkWinnerLabel = document.getElementById("patchworkWinner");
const patchworkNotice = document.getElementById("patchworkNotice");
const patchworkNoticeTitle = document.getElementById("patchworkNoticeTitle");
const patchworkNoticeBody = document.getElementById("patchworkNoticeBody");
const patchworkBoardArt = document.getElementById("patchworkBoardArt");
const patchworkTrack = document.getElementById("patchworkTrack");
const patchworkMarketLegend = document.getElementById("patchworkMarketLegend");
const patchworkMarketTop = document.getElementById("patchworkMarketTop");
const patchworkMarketRight = document.getElementById("patchworkMarketRight");
const patchworkMarketBottom = document.getElementById("patchworkMarketBottom");
const patchworkMarketLeft = document.getElementById("patchworkMarketLeft");
const patchworkMarketMobile = document.getElementById("patchworkMarketMobile");
const patchworkPlayers = document.getElementById("patchworkPlayers");
const patchworkPreview = document.getElementById("patchworkPreview");
const patchworkYourBoard = document.getElementById("patchworkYourBoard");
const patchworkSelectionHint = document.getElementById("patchworkSelectionHint");
const patchworkPlacementActions = document.getElementById("patchworkPlacementActions");
const patchworkPlacementStatus = document.getElementById("patchworkPlacementStatus");
const patchworkConfirmBuyBtn = document.getElementById("patchworkConfirmBuyBtn");
const patchworkTransformActions = document.getElementById("patchworkTransformActions");
const patchworkRotateBtn = document.getElementById("patchworkRotateBtn");
const patchworkFlipBtn = document.getElementById("patchworkFlipBtn");
const patchworkAdvanceBtn = document.getElementById("patchworkAdvanceBtn");
const patchworkAdvanceGain = document.getElementById("patchworkAdvanceGain");
const PATCHWORK_BOARD_WIDTH = 1000;
const PATCHWORK_BOARD_HEIGHT = 999;

const PATCHWORK_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Finish with the best score: remaining buttons count as points, each empty quilt square is worth -2 points, and the first player to complete a 7x7 filled area gains +7.</p>

  <h3>Turn Order</h3>
  <p>The player who is farther behind on the time track acts. If both tokens share a space, the one who arrived later acts again.</p>

  <h3>Actions</h3>
  <ul>
    <li><strong>Advance</strong>: move to one step in front of the opponent and gain buttons equal to spaces moved.</li>
    <li><strong>Buy Patch</strong>: choose one of the first three patches after the neutral marker, pay its cost, place it on your 9x9 quilt, then move on the time track.</li>
  </ul>

  <h3>Track Rewards</h3>
  <ul>
    <li><strong>Button income</strong>: when you cross a button marker, gain buttons equal to your current income.</li>
    <li><strong>Leather patch</strong>: the first player to cross a leather marker must immediately place a 1x1 bonus square.</li>
  </ul>

  <h3>Interface</h3>
  <ul>
    <li>Select one of the first three market patches.</li>
    <li>Use the compact rotate / flip controls beside your quilt to set its orientation.</li>
    <li>Click any quilt square to preview the patch there, even when it overlaps or extends past the board.</li>
    <li>Use <strong>Confirm Purchase</strong> below the quilt once the complete patch is on empty squares and you can afford it.</li>
    <li>Press Esc or click open space to clear your selection.</li>
    <li>When a leather patch is pending, click any empty square on your quilt to place it.</li>
  </ul>
`;

const PATCHWORK_EXPLANATIONS = {
  track: {
    name: "Time Track",
    description: "Shows both player markers directly on the stitched time-board path from 0 to 53.",
  },
  marketCard: {
    name: "Patch Market",
    description: "The first three cards are selectable. Cost, time, income, and exact square footprint are shown on every patch; the rest show the upcoming circle order.",
  },
  yourBoard: {
    name: "Your Quilt Board",
    description: "Click to choose the top-left anchor for the selected patch preview. Invalid previews stay visible in red but cannot be confirmed. During a leather bonus, click any empty square to place the 1x1 tile.",
  },
  preview: {
    name: "Preview",
    description: "Shows the selected patch, its current orientation, and the transformed cell footprint you are about to place.",
  },
  players: {
    name: "Players",
    description: "Each player card summarizes the current standing. Click a player card to open that player's quilt in a popup.",
    details: [
      "🔘 Buttons: current currency and final positive points.",
      "⏳ Time: current position on the time track.",
      "Income 🔘: buttons gained whenever crossing a button marker.",
      "⬜ Empty: unfilled quilt squares, each worth -2 at the end.",
      "⭐ Special: 7 if the player claimed the 7x7 bonus, otherwise 0.",
      "🏁 Score: current score preview after buttons, bonus, and empty-space penalty.",
    ],
  },
  patchworkRotateBtn: {
    name: "Rotate",
    description: "Rotate the selected patch 90 degrees clockwise.",
  },
  patchworkFlipBtn: {
    name: "Flip",
    description: "Mirror the selected patch horizontally before placement.",
  },
  patchworkConfirmBuyBtn: {
    name: "Confirm Purchase",
    description: "Pay for the selected patch only when its full red-or-green preview fits on empty quilt squares. Invalid previews remain visible but this button stays disabled.",
  },
  patchworkAdvanceBtn: {
    name: "Advance + Buttons",
    description: "Skip buying and move ahead of the opponent, gaining one button per space moved.",
  },
};

function patchworkPlayerName(view, playerId) {
  const player = (view.players || []).find((entry) => entry.player_id === playerId);
  return player ? player.name || player.player_id : playerId || "-";
}

function patchworkYou(view) {
  return (view.players || []).find((player) => player.player_id === view.you) || null;
}

function patchworkOthers(view) {
  return (view.players || []).filter((player) => player.player_id !== view.you);
}

function patchworkClearSelection() {
  patchworkSelectedPatchId = null;
  patchworkRotation = 0;
  patchworkFlip = false;
  patchworkAnchor = null;
}

function clearPatchworkState() {
  currentPatchworkView = null;
  patchworkClearSelection();
  if (patchworkTurnLabel) patchworkTurnLabel.textContent = "-";
  if (patchworkSelectedPatchLabel) patchworkSelectedPatchLabel.textContent = "-";
  if (patchworkRotationLabel) patchworkRotationLabel.textContent = "0°";
  if (patchworkFlipLabel) patchworkFlipLabel.textContent = "No";
  if (patchworkAnchorLabel) patchworkAnchorLabel.textContent = "-";
  if (patchworkSpecialTileLabel) patchworkSpecialTileLabel.textContent = "-";
  if (patchworkFirstFinishLabel) patchworkFirstFinishLabel.textContent = "-";
  if (patchworkWinnerLabel) patchworkWinnerLabel.textContent = "-";
  if (patchworkTrack) patchworkTrack.innerHTML = "";
  if (patchworkMarketLegend) patchworkMarketLegend.innerHTML = "";
  [patchworkMarketTop, patchworkMarketRight, patchworkMarketBottom, patchworkMarketLeft, patchworkMarketMobile].forEach((node) => {
    if (node) {
      node.innerHTML = "";
    }
  });
  if (patchworkPlayers) patchworkPlayers.innerHTML = "";
  if (patchworkPreview) patchworkPreview.innerHTML = "";
  if (patchworkYourBoard) patchworkYourBoard.innerHTML = "";
  if (patchworkQuiltModalBoard) patchworkQuiltModalBoard.innerHTML = "";
  if (patchworkQuiltModalMeta) patchworkQuiltModalMeta.textContent = "-";
  if (patchworkSelectionHint) {
    patchworkSelectionHint.textContent = "Select one of the first three patches, then click your board.";
  }
  if (patchworkPlacementActions) patchworkPlacementActions.hidden = true;
  if (patchworkPlacementStatus) patchworkPlacementStatus.textContent = "";
  if (patchworkNotice) {
    patchworkNotice.classList.add("hidden");
    patchworkNotice.setAttribute("aria-hidden", "true");
  }
  closePatchworkQuiltModal();
  updatePatchworkActionButtons();
}

function patchworkNormalizeCells(cells) {
  let minX = Infinity;
  let minY = Infinity;
  cells.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  });
  return cells
    .map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
}

function patchworkRotateCells(cells) {
  return cells.map(([x, y]) => [y, -x]);
}

function patchworkFlipCells(cells) {
  return cells.map(([x, y]) => [-x, y]);
}

function patchworkTransformCells(cells, rotation, flip) {
  let next = Array.isArray(cells) ? cells.map((cell) => [cell[0], cell[1]]) : [];
  if (flip) {
    next = patchworkFlipCells(next);
  }
  const turns = ((rotation % 360) + 360) % 360 / 90;
  for (let index = 0; index < turns; index += 1) {
    next = patchworkRotateCells(next);
  }
  return patchworkNormalizeCells(next);
}

function patchworkPlacementCells(cells, anchorX, anchorY) {
  return cells.map(([x, y]) => [anchorX + x, anchorY + y]);
}

function patchworkBoardSize(view) {
  return Number.isInteger(view && view.board_size) ? view.board_size : 9;
}

function patchworkSelectedDef(view) {
  if (!view || !patchworkSelectedPatchId || !view.patch_defs) {
    return null;
  }
  return view.patch_defs[patchworkSelectedPatchId] || null;
}

function patchworkSelectedCells(view) {
  const def = patchworkSelectedDef(view);
  if (!def) {
    return [];
  }
  return patchworkTransformCells(def.cells || [], patchworkRotation, patchworkFlip);
}

function patchworkCanPlace(view, board, cells, anchorX, anchorY) {
  if (!view || !Array.isArray(board) || !Array.isArray(cells) || cells.length === 0) {
    return false;
  }
  const size = patchworkBoardSize(view);
  const occupied = patchworkPlacementCells(cells, anchorX, anchorY);
  return occupied.every(([x, y]) => (
    x >= 0 &&
    x < size &&
    y >= 0 &&
    y < size &&
    board[y] &&
    board[y][x] === null
  ));
}

function patchworkHasSelectionPlacement(view) {
  const you = patchworkYou(view);
  if (!you || !patchworkAnchor || !patchworkSelectedPatchId) {
    return false;
  }
  return patchworkCanPlace(
    view,
    you.quilt_board || [],
    patchworkSelectedCells(view),
    patchworkAnchor.x,
    patchworkAnchor.y,
  );
}

function patchworkSelectedAffordable(view) {
  const you = patchworkYou(view);
  const def = patchworkSelectedDef(view);
  if (!you || !def) {
    return false;
  }
  return you.buttons >= def.cost_buttons;
}

function patchworkCanBuySelected(view) {
  const selectable = view && Array.isArray(view.selectable_patches)
    ? new Set(view.selectable_patches)
    : new Set();
  return !!(
    view &&
    !view.game_over &&
    !view.pending_special_patch &&
    view.current_turn === view.you &&
    selectable.has(patchworkSelectedPatchId) &&
    patchworkSelectedAffordable(view) &&
    patchworkHasSelectionPlacement(view)
  );
}

function patchworkAdvanceButtonGain(view) {
  const you = patchworkYou(view);
  const opponent = patchworkOthers(view)[0];
  if (!you || !opponent) {
    return 0;
  }
  const trackEnd = Number.isInteger(view.track_end) ? view.track_end : 53;
  const target = Math.min(trackEnd, Number(opponent.time_position || 0) + 1);
  return Math.max(0, target - Number(you.time_position || 0));
}

function patchworkSubmitSelectedPurchase() {
  if (!currentPatchworkView || !patchworkSelectedPatchId || !patchworkAnchor) {
    return;
  }
  if (!patchworkCanBuySelected(currentPatchworkView)) {
    log("Invalid patch placement");
    return;
  }
  sendAction({
    type: "buy_patch",
    patch_id: patchworkSelectedPatchId,
    rotation: patchworkRotation,
    flip: patchworkFlip,
    x: patchworkAnchor.x,
    y: patchworkAnchor.y,
  });
}

function patchworkColorForKey(key) {
  if (!key) {
    return null;
  }
  if (String(key).startsWith("leather_")) {
    return { background: "#8b5a3c", border: "#5f3b24" };
  }
  const match = String(key).match(/(\d+)/);
  const value = match ? Number.parseInt(match[1], 10) : 0;
  const hue = (value * 37) % 360;
  return {
    background: `hsl(${hue} 68% 72%)`,
    border: `hsl(${hue} 55% 40%)`,
  };
}

function patchworkPreviewPaletteForKey(key) {
  if (!key) {
    return PATCHWORK_PREVIEW_JEWELS[0];
  }
  if (String(key).startsWith("leather_") || key === "leather_patch") {
    return {
      fillTop: "#d6a97b",
      fillBottom: "#a16207",
      border: "#7c4a2c",
      glow: "rgba(161, 98, 7, 0.24)",
    };
  }
  let hash = 0;
  for (const char of String(key)) {
    hash = ((hash * 33) + char.charCodeAt(0)) >>> 0;
  }
  return PATCHWORK_PREVIEW_JEWELS[hash % PATCHWORK_PREVIEW_JEWELS.length];
}

function patchworkBuildMiniGrid(cells, extraClass) {
  const wrapper = document.createElement("div");
  wrapper.className = `patchwork-mini-grid${extraClass ? ` ${extraClass}` : ""}`;
  if (!cells || !cells.length) {
    return wrapper;
  }
  const width = cells.reduce((max, [x]) => Math.max(max, x), 0) + 1;
  const height = cells.reduce((max, [, y]) => Math.max(max, y), 0) + 1;
  wrapper.style.setProperty("--patchwork-mini-cols", String(width));
  wrapper.style.setProperty("--patchwork-mini-rows", String(height));
  cells.forEach(([x, y]) => {
    const cell = document.createElement("div");
    cell.className = "patchwork-mini-cell";
    cell.style.setProperty("--col", String(x));
    cell.style.setProperty("--row", String(y));
    wrapper.appendChild(cell);
  });
  return wrapper;
}

function patchworkCellDimensions(cells) {
  if (!Array.isArray(cells) || cells.length === 0) {
    return { width: 0, height: 0 };
  }
  return {
    width: cells.reduce((max, [x]) => Math.max(max, x), 0) + 1,
    height: cells.reduce((max, [, y]) => Math.max(max, y), 0) + 1,
  };
}

function patchworkBuildPreviewShape(cells, key, fixedCellSize = null, balanceMass = false) {
  const wrapper = document.createElement("div");
  wrapper.className = "patchwork-preview-shape";
  if (!cells || !cells.length) {
    return wrapper;
  }
  const { width, height } = patchworkCellDimensions(cells);
  const cellSize = fixedCellSize || Math.max(18, Math.min(34, Math.floor(Math.min(176 / width, 136 / height))));
  const palette = patchworkPreviewPaletteForKey(key);
  wrapper.style.setProperty("--patchwork-preview-cols", String(width));
  wrapper.style.setProperty("--patchwork-preview-rows", String(height));
  wrapper.style.setProperty("--patchwork-preview-cell", `${cellSize}px`);
  wrapper.style.setProperty("--patchwork-preview-fill-top", palette.fillTop);
  wrapper.style.setProperty("--patchwork-preview-fill-bottom", palette.fillBottom);
  wrapper.style.setProperty("--patchwork-preview-border", palette.border);
  wrapper.style.setProperty("--patchwork-preview-glow", palette.glow);
  if (balanceMass) {
    const centerX = cells.reduce((sum, [x]) => sum + x + 0.5, 0) / cells.length;
    const centerY = cells.reduce((sum, [, y]) => sum + y + 0.5, 0) / cells.length;
    const offsetX = ((width / 2) - centerX) * cellSize;
    const offsetY = ((height / 2) - centerY) * cellSize;
    wrapper.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  }
  cells.forEach(([x, y]) => {
    const cell = document.createElement("div");
    cell.className = "patchwork-preview-shape-cell";
    cell.style.setProperty("--col", String(x));
    cell.style.setProperty("--row", String(y));
    wrapper.appendChild(cell);
  });
  return wrapper;
}

function patchworkBuildIncomePips(count) {
  const pips = document.createElement("div");
  pips.className = "patchwork-income-pips";
  pips.setAttribute("aria-hidden", "true");
  for (let index = 0; index < Number(count || 0); index += 1) {
    const pip = document.createElement("span");
    pip.className = "patchwork-income-pip";
    pips.appendChild(pip);
  }
  return pips;
}

function patchworkPatchLabel(patchId) {
  const match = String(patchId || "").match(/(\d+)$/);
  return match ? `Patch ${Number.parseInt(match[1], 10)}` : String(patchId || "Patch");
}

function patchworkSyncSelection(view) {
  if (!view) {
    patchworkClearSelection();
    return;
  }
  if (view.pending_special_patch) {
    patchworkClearSelection();
    return;
  }
  const defs = view.patch_defs || {};
  if (!patchworkSelectedPatchId || !defs[patchworkSelectedPatchId]) {
    patchworkClearSelection();
    return;
  }
  const selectable = new Set(view.selectable_patches || []);
  if (!selectable.has(patchworkSelectedPatchId)) {
    patchworkClearSelection();
  }
}

function patchworkExplainIdForElement(node) {
  const target = node && node.closest ? node.closest("[data-patchwork-explain]") : null;
  return target ? target.getAttribute("data-patchwork-explain") : null;
}

function showPatchworkHeaderActions(show) {
  if (patchworkHeaderActions) {
    patchworkHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitPatchworkExplainMode();
    closePatchworkHelpModal();
    closePatchworkExplainModal();
  }
}

function showPatchworkHelpModal() {
  if (!patchworkHelpModal) {
    return;
  }
  if (patchworkHelpContent) {
    patchworkHelpContent.innerHTML = PATCHWORK_HELP_TEXT;
  }
  setModalVisible(patchworkHelpModal, true);
}

function closePatchworkHelpModal() {
  if (patchworkHelpModal) {
    setModalVisible(patchworkHelpModal, false);
  }
}

function showPatchworkExplanation(explainId) {
  const explanation = PATCHWORK_EXPLANATIONS[explainId];
  if (!explanation || !patchworkExplainContent || !patchworkExplainModal) {
    return;
  }
  const details = Array.isArray(explanation.details) && explanation.details.length
    ? `<ul>${explanation.details.map((line) => `<li>${line}</li>`).join("")}</ul>`
    : "";
  patchworkExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    ${details}
  `;
  setModalVisible(patchworkExplainModal, true);
}

function closePatchworkExplainModal() {
  if (patchworkExplainModal) {
    setModalVisible(patchworkExplainModal, false);
  }
}

function showPatchworkQuiltModal(view, player) {
  if (!patchworkQuiltModal || !patchworkQuiltModalBoard || !view || !player) {
    return;
  }
  if (patchworkQuiltModalTitle) {
    patchworkQuiltModalTitle.textContent = `${player.name}'s Quilt`;
  }
  if (patchworkQuiltModalMeta) {
    const score = view.scores && Object.prototype.hasOwnProperty.call(view.scores, player.player_id)
      ? view.scores[player.player_id]
      : player.score_preview;
    patchworkQuiltModalMeta.textContent = `Buttons 🔘 ${player.buttons}  ·  Time ⏳ ${player.time_position}  ·  Income 🔘 ${player.button_income}  ·  Empty ⬜ ${player.empty_spaces}  ·  Score ${score}`;
  }
  renderPatchworkBoard(patchworkQuiltModalBoard, view, player, false);
  setModalVisible(patchworkQuiltModal, true);
}

function closePatchworkQuiltModal() {
  if (patchworkQuiltModal) {
    setModalVisible(patchworkQuiltModal, false);
  }
}

function updatePatchworkExplainModeClasses(enabled) {
  document.querySelectorAll("[data-patchwork-explain]").forEach((node) => {
    node.classList.toggle("has-explanation", enabled);
  });
}

function togglePatchworkExplainMode() {
  patchworkExplainMode = !patchworkExplainMode;
  document.body.classList.toggle("patchwork-explain-mode", patchworkExplainMode);
  updatePatchworkExplainModeClasses(patchworkExplainMode);
  if (patchworkExplainBtn) {
    patchworkExplainBtn.classList.toggle("active", patchworkExplainMode);
  }
}

function exitPatchworkExplainMode() {
  if (!patchworkExplainMode) {
    return;
  }
  patchworkExplainMode = false;
  document.body.classList.remove("patchwork-explain-mode");
  updatePatchworkExplainModeClasses(false);
  if (patchworkExplainBtn) {
    patchworkExplainBtn.classList.remove("active");
  }
}

function renderPatchworkSummary(view) {
  if (!view) {
    return;
  }
  const selectedDef = patchworkSelectedDef(view);
  if (patchworkTurnLabel) {
    patchworkTurnLabel.textContent = patchworkPlayerName(view, view.current_turn);
  }
  if (patchworkSelectedPatchLabel) {
    patchworkSelectedPatchLabel.textContent = selectedDef ? patchworkPatchLabel(patchworkSelectedPatchId) : "-";
  }
  if (patchworkRotationLabel) {
    patchworkRotationLabel.textContent = `${patchworkRotation}°`;
  }
  if (patchworkFlipLabel) {
    patchworkFlipLabel.textContent = patchworkFlip ? "Yes" : "No";
  }
  if (patchworkAnchorLabel) {
    patchworkAnchorLabel.textContent = patchworkAnchor ? `${patchworkAnchor.x}, ${patchworkAnchor.y}` : "-";
  }
  if (patchworkSpecialTileLabel) {
    patchworkSpecialTileLabel.textContent = view.special_tile_available ? "Available" : "Claimed";
  }
  if (patchworkFirstFinishLabel) {
    patchworkFirstFinishLabel.textContent = patchworkPlayerName(view, view.first_to_finish);
  }
  if (patchworkWinnerLabel) {
    const winners = Array.isArray(view.winner) ? view.winner : [];
    patchworkWinnerLabel.textContent = winners.length ? winners.map((id) => patchworkPlayerName(view, id)).join(", ") : "-";
  }

  if (!patchworkNotice || !patchworkNoticeTitle || !patchworkNoticeBody) {
    return;
  }
  const pending = view.pending_special_patch;
  if (pending) {
    patchworkNotice.classList.remove("hidden");
    patchworkNotice.setAttribute("aria-hidden", "false");
    patchworkNoticeTitle.textContent = "Bonus Patch";
    patchworkNoticeBody.textContent = `${patchworkPlayerName(view, pending.player_id)} must place a 1x1 leather patch.`;
    return;
  }
  if (view.game_over) {
    patchworkNotice.classList.remove("hidden");
    patchworkNotice.setAttribute("aria-hidden", "false");
    patchworkNoticeTitle.textContent = "Game Over";
    const winners = Array.isArray(view.winner) ? view.winner : [];
    const winnerText = winners.length
      ? ` Winner: ${winners.map((id) => patchworkPlayerName(view, id)).join(", ")}.`
      : "";
    patchworkNoticeBody.textContent = `Final scores are shown in the player panel.${winnerText}`;
    return;
  }
  patchworkNotice.classList.add("hidden");
  patchworkNotice.setAttribute("aria-hidden", "true");
}

function renderPatchworkTrack(view) {
  if (!patchworkTrack || !view) {
    return;
  }
  patchworkTrack.innerHTML = "";
  patchworkTrack.setAttribute("data-patchwork-explain", "track");

  const positions = patchworkBuildTrackPositions(view);
  const stacks = new Map();
  (view.players || []).forEach((player) => {
    const key = String(player.time_position || 0);
    const bucket = stacks.get(key) || [];
    bucket.push(player.player_id);
    stacks.set(key, bucket);
  });
  (view.players || []).forEach((player, index) => {
    const point = positions[player.time_position || 0] || positions[0];
    if (!point) {
      return;
    }
    const bucket = stacks.get(String(player.time_position || 0)) || [];
    const stackIndex = bucket.indexOf(player.player_id);
    const stackOffset = bucket.length > 1 ? (stackIndex - (bucket.length - 1) / 2) * 16 : 0;
    const chip = document.createElement("div");
    chip.className = `patchwork-track-chip seat-${player.seat ?? index}`;
    if (player.player_id === view.current_turn) {
      chip.classList.add("active");
    }
    chip.style.left = `${((point[0] + stackOffset) / PATCHWORK_BOARD_WIDTH) * 100}%`;
    chip.style.top = `${(point[1] / PATCHWORK_BOARD_HEIGHT) * 100}%`;
    chip.title = `${player.name}: ${player.time_position}`;
    chip.dataset.pos = String(player.time_position || 0);
    chip.textContent = (player.name || "?").slice(0, 1).toUpperCase();
    patchworkTrack.appendChild(chip);
  });
}

function patchworkClonePoints(points) {
  return (points || []).map((point) => [point[0], point[1]]);
}

function patchworkReversePoints(points) {
  return patchworkClonePoints(points).reverse();
}

function patchworkAppendPolyline(target, points) {
  if (!Array.isArray(points) || points.length === 0) {
    return;
  }
  points.forEach((point, index) => {
    if (target.length > 0) {
      const prev = target[target.length - 1];
      if (prev[0] === point[0] && prev[1] === point[1]) {
        return;
      }
    }
    if (index === 0 && target.length > 0) {
      const prev = target[target.length - 1];
      if (prev[0] !== point[0] || prev[1] !== point[1]) {
        target.push([point[0], point[1]]);
      }
      return;
    }
    target.push([point[0], point[1]]);
  });
}

function patchworkPathLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [x1, y1] = points[index - 1];
    const [x2, y2] = points[index];
    total += Math.hypot(x2 - x1, y2 - y1);
  }
  return total;
}

function patchworkPointAtDistance(points, distance) {
  if (!Array.isArray(points) || points.length === 0) {
    return null;
  }
  if (distance <= 0) {
    return points[0];
  }
  let remaining = distance;
  for (let index = 1; index < points.length; index += 1) {
    const [x1, y1] = points[index - 1];
    const [x2, y2] = points[index];
    const segmentLength = Math.hypot(x2 - x1, y2 - y1);
    if (remaining <= segmentLength) {
      const ratio = segmentLength === 0 ? 0 : remaining / segmentLength;
      return [
        x1 + (x2 - x1) * ratio,
        y1 + (y2 - y1) * ratio,
      ];
    }
    remaining -= segmentLength;
  }
  return points[points.length - 1];
}

function patchworkBuildTrackPolyline(view) {
  const layout = view && view.board_visual_layout ? view.board_visual_layout : null;
  const segments = layout && Array.isArray(layout.track_segments) ? layout.track_segments : [];
  if (segments.length < 5) {
    return [];
  }
  const polyline = [];
  const connectorA = [[858, 619], [858, 740]];
  const connectorB = [[142, 740], [262, 619]];
  const connectorC = [[740, 740], [619, 619]];
  const connectorD = [[381, 619], [500, 619]];

  patchworkAppendPolyline(polyline, patchworkClonePoints(segments[0]));
  patchworkAppendPolyline(polyline, connectorA);
  patchworkAppendPolyline(polyline, patchworkReversePoints(segments[1]));
  patchworkAppendPolyline(polyline, connectorB);
  patchworkAppendPolyline(polyline, patchworkClonePoints(segments[2]));
  patchworkAppendPolyline(polyline, connectorC);
  patchworkAppendPolyline(polyline, patchworkReversePoints(segments[3]));
  patchworkAppendPolyline(polyline, connectorD);
  patchworkAppendPolyline(polyline, patchworkClonePoints(segments[4]));

  return polyline;
}

function patchworkBoardCellCenters() {
  const gridX = [24, 144, 262, 381, 500, 619, 740, 859, 978];
  const gridY = [19, 139, 260, 380, 500, 619, 740, 860, 976];
  const blocked = new Set(["3,3", "3,4", "4,3", "4,4", "7,5", "7,6", "7,7"]);
  const centers = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if (blocked.has(`${row},${col}`)) {
        continue;
      }
      centers.push([
        (gridX[col] + gridX[col + 1]) / 2,
        (gridY[row] + gridY[row + 1]) / 2,
      ]);
    }
  }
  return centers;
}

function patchworkSpiralTrackCenters() {
  const gridX = [24, 144, 262, 381, 500, 619, 740, 859, 978];
  const gridY = [19, 139, 260, 380, 500, 619, 740, 860, 976];
  const blocked = new Set(["3,3", "3,4", "4,3", "4,4", "7,5", "7,6", "7,7"]);
  const cells = [];

  for (let ring = 0; ring < 3; ring += 1) {
    const top = ring;
    const left = ring;
    const bottom = 7 - ring;
    const right = 7 - ring;

    for (let col = right; col >= left; col -= 1) {
      const key = `${bottom},${col}`;
      if (!blocked.has(key)) {
        cells.push([bottom, col]);
      }
    }
    for (let row = bottom - 1; row >= top; row -= 1) {
      const key = `${row},${left}`;
      if (!blocked.has(key)) {
        cells.push([row, left]);
      }
    }
    for (let col = left + 1; col <= right; col += 1) {
      const key = `${top},${col}`;
      if (!blocked.has(key)) {
        cells.push([top, col]);
      }
    }
    for (let row = top + 1; row < bottom; row += 1) {
      const key = `${row},${right}`;
      if (!blocked.has(key)) {
        cells.push([row, right]);
      }
    }
  }

  return cells.map(([row, col]) => [
    (gridX[col] + gridX[col + 1]) / 2,
    (gridY[row] + gridY[row + 1]) / 2,
  ]);
}

function patchworkSampleTrackCenters(points, targetCount) {
  if (!Array.isArray(points) || points.length <= targetCount) {
    return Array.isArray(points) ? points.slice() : [];
  }
  const sampled = [];
  for (let index = 0; index < targetCount; index += 1) {
    const sourceIndex = Math.round(index * (points.length - 1) / Math.max(targetCount - 1, 1));
    sampled.push(points[sourceIndex]);
  }
  return sampled;
}

function patchworkBuildTrackPositions(view) {
  const trackEnd = Number.isInteger(view && view.track_end) ? view.track_end : 53;
  const startStripCenter = [798.5, 918];
  const spiralCenters = patchworkSpiralTrackCenters();
  const remaining = patchworkSampleTrackCenters(spiralCenters, trackEnd);
  return [startStripCenter, ...remaining];
}

function patchworkMarketSelectionStatus(view, def) {
  const you = patchworkYou(view);
  if (view.game_over) {
    return "Game finished";
  }
  if (!you || view.current_turn !== view.you) {
    return "Wait for your turn";
  }
  if (you.buttons < def.cost_buttons) {
    return `Need ${def.cost_buttons - you.buttons} more 🔘`;
  }
  if (!patchworkAnchor) {
    return "Click any square to preview it";
  }
  if (!patchworkHasSelectionPlacement(view)) {
    return "Does not fit — adjust before confirming";
  }
  return `Fits · Pay ${def.cost_buttons} 🔘 · Gain ${def.income_buttons} income`;
}

function patchworkBuildMarketCard(view, entry, selectable, you) {
  const def = view.patch_defs ? view.patch_defs[entry.patch_id] : null;
  if (!def) {
    return null;
  }

  const card = document.createElement("div");
  const isSelectable = selectable.has(def.id);
  const isSelected = patchworkSelectedPatchId === def.id;
  card.className = "patchwork-market-card";
  card.dataset.patchId = def.id;
  card.setAttribute("data-patchwork-explain", "marketCard");
  card.classList.toggle("selectable", isSelectable);
  card.classList.toggle("upcoming", !isSelectable);
  card.classList.toggle("selected", isSelected);
  card.classList.toggle("unaffordable", !!(you && you.buttons < def.cost_buttons));

  const selectButton = document.createElement("button");
  selectButton.type = "button";
  selectButton.className = "patchwork-market-card-hitarea";
  selectButton.disabled = !isSelectable || !!view.pending_special_patch;
  selectButton.setAttribute("aria-pressed", isSelected ? "true" : "false");
  selectButton.setAttribute(
    "aria-label",
    `${def.id}: ${def.cost_buttons} buttons, ${def.cost_time} time, ${def.income_buttons} income${isSelectable ? ". Select patch" : ". Upcoming patch"}`,
  );

  const header = document.createElement("div");
  header.className = "patchwork-market-card-header";

  const label = document.createElement("div");
  label.className = "patchwork-market-label";
  label.textContent = patchworkPatchLabel(def.id);

  const order = document.createElement("div");
  order.className = "patchwork-market-order";
  order.textContent = entry.offset < 3 ? `#${entry.offset + 1}` : `+${entry.offset}`;
  header.appendChild(label);
  header.appendChild(order);

  const image = document.createElement("div");
  image.className = "patchwork-market-image";
  image.appendChild(patchworkBuildPreviewShape(def.cells || [], def.id, 11, true));
  image.appendChild(patchworkBuildIncomePips(def.income_buttons));

  const meta = document.createElement("div");
  meta.className = "patchwork-market-meta";
  meta.innerHTML = `
    <span title="Button cost">Cost <b>${def.cost_buttons}</b></span>
    <span title="Time cost">Time <b>${def.cost_time}</b></span>
    <span title="Button income">Income <b>${def.income_buttons}</b></span>
    <span title="Covered squares">Squares <b>${def.cell_count}</b></span>
  `;

  selectButton.appendChild(header);
  selectButton.appendChild(image);
  selectButton.appendChild(meta);
  selectButton.addEventListener("click", () => {
    if (!isSelectable || view.pending_special_patch) {
      return;
    }
    patchworkSelectedPatchId = def.id;
    patchworkRotation = 0;
    patchworkFlip = false;
    patchworkAnchor = null;
    renderPatchworkGameState({ view });
  });
  card.appendChild(selectButton);

  return card;
}

function renderPatchworkMarket(view) {
  if (!view || !patchworkMarketMobile) {
    return;
  }
  [patchworkMarketTop, patchworkMarketRight, patchworkMarketBottom, patchworkMarketLeft, patchworkMarketMobile].forEach((node) => {
    if (node) {
      node.innerHTML = "";
    }
  });
  const you = patchworkYou(view);
  const selectable = new Set(view.selectable_patches || []);
  const entries = Array.isArray(view.patch_circle) ? view.patch_circle : [];

  if (patchworkMarketLegend) {
    const orderedPlayers = [...(view.players || [])].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
    patchworkMarketLegend.innerHTML = "";
    orderedPlayers.forEach((player, index) => {
      const badge = document.createElement("div");
      badge.className = `patchwork-order-badge seat-${player.seat ?? index}`;
      if (player.player_id === view.current_turn) {
        badge.classList.add("active");
      }
      badge.textContent = `${index + 1}. ${player.name || player.player_id}`;
      patchworkMarketLegend.appendChild(badge);
    });
  }

  entries.forEach((entry) => {
    const card = patchworkBuildMarketCard(view, entry, selectable, you);
    if (card) {
      patchworkMarketMobile.appendChild(card);
    }
  });
}

function renderPatchworkPreview(view) {
  if (!patchworkPreview || !view) {
    return;
  }
  patchworkPreview.innerHTML = "";
  patchworkPreview.setAttribute("data-patchwork-explain", "preview");

  if (view.pending_special_patch) {
    const note = document.createElement("div");
    note.className = "patchwork-preview-showcase patchwork-preview-showcase-special";
    note.innerHTML = `
      <div class="patchwork-preview-title">Leather Patch Pending</div>
      <div class="patchwork-preview-image patchwork-preview-image-special"></div>
      <div class="patchwork-preview-meta">
        <span>Place on any empty square</span>
        <span>1x1 bonus patch</span>
      </div>
    `;
    const art = note.querySelector(".patchwork-preview-image");
    if (art) {
      art.appendChild(patchworkBuildPreviewShape([[0, 0]], "leather_patch"));
    }
    patchworkPreview.appendChild(note);
    return;
  }

  const def = patchworkSelectedDef(view);
  if (!def) {
    const empty = document.createElement("div");
    empty.className = "patchwork-preview-showcase patchwork-preview-note";
    empty.innerHTML = `
      <div class="patchwork-preview-title">Preview Ready</div>
      <p>Select one of the first three market patches to inspect it here.</p>
    `;
    patchworkPreview.appendChild(empty);
    return;
  }

  const transformedCells = patchworkSelectedCells(view);
  const dimensions = patchworkCellDimensions(transformedCells);
  const showcase = document.createElement("div");
  showcase.className = "patchwork-preview-showcase";
  showcase.innerHTML = `
    <div class="patchwork-preview-title">${patchworkPatchLabel(def.id)}</div>
    <div class="patchwork-preview-image" aria-label="${def.id} preview"></div>
    <div class="patchwork-preview-meta">
      <span>Cost <strong>${def.cost_buttons}</strong> 🔘</span>
      <span>Time <strong>${def.cost_time}</strong> ⏳</span>
      <span>Income <strong>${def.income_buttons}</strong> 🔘</span>
      <span>${dimensions.width}×${dimensions.height} · ${def.cell_count} squares</span>
      <span>Anchor ${patchworkAnchor ? `${patchworkAnchor.x}, ${patchworkAnchor.y}` : "-"}</span>
    </div>
  `;
  const art = showcase.querySelector(".patchwork-preview-image");
  if (art) {
    art.appendChild(patchworkBuildPreviewShape(transformedCells, def.id));
    art.appendChild(patchworkBuildIncomePips(def.income_buttons));
  }
  patchworkPreview.appendChild(showcase);
}

function patchworkCreateCell(nodeName, occupiedKey) {
  const cell = document.createElement(nodeName);
  cell.className = "patchwork-board-cell";
  if (occupiedKey) {
    cell.classList.add("filled");
    const color = patchworkColorForKey(occupiedKey);
    if (color) {
      cell.style.setProperty("--patchwork-fill", color.background);
      cell.style.setProperty("--patchwork-stroke", color.border);
    }
  }
  return cell;
}

function renderPatchworkBoard(target, view, player, interactive) {
  if (!target || !view || !player) {
    return;
  }
  target.innerHTML = "";
  target.className = `patchwork-board${interactive ? " interactive" : " compact"}`;
  if (interactive) {
    target.setAttribute("data-patchwork-explain", "yourBoard");
  } else {
    target.setAttribute("data-patchwork-explain", "otherBoard");
  }

  const board = player.quilt_board || [];
  const previewCells = new Set();
  let previewValid = false;
  if (interactive && !view.pending_special_patch && patchworkSelectedPatchId && patchworkAnchor) {
    const cells = patchworkPlacementCells(patchworkSelectedCells(view), patchworkAnchor.x, patchworkAnchor.y);
    cells.forEach(([x, y]) => previewCells.add(`${x},${y}`));
    previewValid = patchworkHasSelectionPlacement(view);
  }

  for (let y = 0; y < patchworkBoardSize(view); y += 1) {
    for (let x = 0; x < patchworkBoardSize(view); x += 1) {
      const occupiedKey = board[y] ? board[y][x] : null;
      const cell = patchworkCreateCell(interactive ? "button" : "div", occupiedKey);
      cell.style.setProperty("--col", String(x));
      cell.style.setProperty("--row", String(y));
      if (interactive) {
        cell.type = "button";
      }
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      if (!occupiedKey && view.pending_special_patch && player.player_id === view.you) {
        cell.classList.add("bonus-target");
      }
      if (previewCells.has(`${x},${y}`)) {
        cell.classList.add("preview");
        cell.classList.toggle("invalid", !previewValid);
      }
      if (interactive) {
        cell.addEventListener("click", () => {
          if (view.pending_special_patch) {
            sendAction({ type: "place_bonus_patch", x, y });
            return;
          }
          if (!patchworkSelectedPatchId) {
            return;
          }
          patchworkAnchor = { x, y };
          renderPatchworkGameState({ view });
        });
      }
      target.appendChild(cell);
    }
  }
}

function renderPatchworkPlayers(view) {
  if (!patchworkPlayers || !view) {
    return;
  }
  patchworkPlayers.innerHTML = "";

  (view.players || []).forEach((player) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "patchwork-player-card";
    card.setAttribute("data-patchwork-explain", "players");
    card.classList.add(`seat-${player.seat ?? 0}`);
    if (player.player_id === view.you) {
      card.classList.add("you");
    }
    if (player.player_id === view.current_turn) {
      card.classList.add("active");
    }
    const score = view.scores && Object.prototype.hasOwnProperty.call(view.scores, player.player_id)
      ? view.scores[player.player_id]
      : player.score_preview;
    card.innerHTML = `
      <div class="patchwork-player-name">${player.name}${player.player_id === view.you ? " (You)" : ""}</div>
      <div class="patchwork-player-stats">
        <span>🔘 ${player.buttons}</span>
        <span>⏳ ${player.time_position}</span>
        <span>Income 🔘 ${player.button_income}</span>
        <span>⬜ ${player.empty_spaces}</span>
        <span>⭐ ${player.has_special_tile ? "7" : "0"}</span>
        <span>🏁 ${score}</span>
      </div>
    `;
    card.addEventListener("click", () => {
      showPatchworkQuiltModal(view, player);
    });
    patchworkPlayers.appendChild(card);
  });

  const you = patchworkYou(view);
  if (you) {
    renderPatchworkBoard(patchworkYourBoard, view, you, true);
  }
}

function updatePatchworkActionButtons() {
  const view = currentPatchworkView;
  const legal = view && Array.isArray(view.legal_actions) ? new Set(view.legal_actions) : new Set();
  const hasPatch = !!(view && patchworkSelectedPatchId && patchworkSelectedDef(view));
  const selectedDef = hasPatch ? patchworkSelectedDef(view) : null;

  if (patchworkTransformActions) {
    patchworkTransformActions.hidden = !hasPatch || !!(view && view.pending_special_patch);
  }
  if (patchworkRotateBtn) {
    patchworkRotateBtn.disabled = !hasPatch || !!(view && view.pending_special_patch);
  }
  if (patchworkFlipBtn) {
    patchworkFlipBtn.disabled = !hasPatch || !!(view && view.pending_special_patch);
    patchworkFlipBtn.classList.toggle("active", hasPatch && patchworkFlip);
    patchworkFlipBtn.setAttribute("aria-pressed", hasPatch && patchworkFlip ? "true" : "false");
  }
  if (patchworkAdvanceBtn) {
    patchworkAdvanceBtn.disabled = !(view && legal.has("advance"));
    const gain = view ? patchworkAdvanceButtonGain(view) : 0;
    patchworkAdvanceBtn.setAttribute("aria-label", `Advance and gain ${gain} buttons`);
    if (patchworkAdvanceGain) {
      patchworkAdvanceGain.textContent = gain > 0 ? `+🔘 ${gain}` : "";
    }
  }
  if (patchworkPlacementActions) {
    patchworkPlacementActions.hidden = !hasPatch || !!(view && view.pending_special_patch);
    patchworkPlacementActions.classList.toggle("valid", hasPatch && patchworkCanBuySelected(view));
    patchworkPlacementActions.classList.toggle(
      "invalid",
      hasPatch && !!patchworkAnchor && !patchworkHasSelectionPlacement(view),
    );
  }
  if (patchworkPlacementStatus) {
    patchworkPlacementStatus.textContent = hasPatch && selectedDef
      ? patchworkMarketSelectionStatus(view, selectedDef)
      : "";
  }
  if (patchworkConfirmBuyBtn) {
    patchworkConfirmBuyBtn.disabled = !hasPatch || !patchworkCanBuySelected(view);
  }
}

function renderPatchworkGameState(data) {
  const view = data && data.view ? data.view : data;
  if (!view) {
    clearPatchworkState();
    return;
  }
  currentPatchworkView = view;
  patchworkSyncSelection(view);
  renderPatchworkSummary(view);
  renderPatchworkTrack(view);
  renderPatchworkMarket(view);
  renderPatchworkPlayers(view);
  renderPatchworkPreview(view);
  if (patchworkBoardArt && view.board_svg_url) {
    patchworkBoardArt.src = view.board_svg_url;
  }
  if (patchworkSelectionHint) {
    if (view.pending_special_patch) {
      patchworkSelectionHint.textContent = "Bonus patch pending: click an empty square on your quilt.";
    } else if (patchworkSelectedPatchId && patchworkAnchor && !patchworkHasSelectionPlacement(view)) {
      patchworkSelectionHint.textContent = "Preview stays here, but the complete patch must cover only empty quilt squares.";
    } else if (patchworkSelectedPatchId && patchworkAnchor) {
      patchworkSelectionHint.textContent = "This placement fits. Confirm the purchase below.";
    } else if (patchworkSelectedPatchId) {
      patchworkSelectionHint.textContent = "Click any quilt square to preview, even if the patch will not fit there.";
    } else {
      patchworkSelectionHint.textContent = "Select one of the first three patches, then click your board.";
    }
  }
  updatePatchworkActionButtons();
  if (patchworkExplainMode) {
    updatePatchworkExplainModeClasses(true);
  }
}

if (patchworkRotateBtn) {
  patchworkRotateBtn.addEventListener("click", () => {
    if (!currentPatchworkView || !patchworkSelectedPatchId) {
      return;
    }
    patchworkRotation = (patchworkRotation + 90) % 360;
    renderPatchworkGameState({ view: currentPatchworkView });
  });
}

if (patchworkFlipBtn) {
  patchworkFlipBtn.addEventListener("click", () => {
    if (!currentPatchworkView || !patchworkSelectedPatchId) {
      return;
    }
    patchworkFlip = !patchworkFlip;
    renderPatchworkGameState({ view: currentPatchworkView });
  });
}

if (patchworkConfirmBuyBtn) {
  patchworkConfirmBuyBtn.addEventListener("click", patchworkSubmitSelectedPurchase);
}

if (patchworkAdvanceBtn) {
  patchworkAdvanceBtn.addEventListener("click", () => {
    sendAction({ type: "advance" });
  });
}

if (patchworkHelpBtn) {
  patchworkHelpBtn.addEventListener("click", showPatchworkHelpModal);
}

if (patchworkHelpModalCloseBtn) {
  patchworkHelpModalCloseBtn.addEventListener("click", closePatchworkHelpModal);
}

if (patchworkExplainBtn) {
  patchworkExplainBtn.addEventListener("click", togglePatchworkExplainMode);
}

if (patchworkExplainModalCloseBtn) {
  patchworkExplainModalCloseBtn.addEventListener("click", closePatchworkExplainModal);
}

if (patchworkQuiltModalCloseBtn) {
  patchworkQuiltModalCloseBtn.addEventListener("click", closePatchworkQuiltModal);
}

if (patchworkPanel) {
  patchworkPanel.addEventListener("pointerdown", (event) => {
    if (
      patchworkExplainMode ||
      !currentPatchworkView ||
      currentPatchworkView.pending_special_patch ||
      !patchworkSelectedPatchId
    ) {
      return;
    }
    const target = event.target;
    if (target.closest(".patchwork-market-card, .patchwork-board, .patchwork-transform-actions, button, .modal")) {
      return;
    }
    patchworkClearSelection();
    renderPatchworkGameState({ view: currentPatchworkView });
  });
}

document.addEventListener("pointerdown", (event) => {
  if (!patchworkExplainMode || currentGameType !== "patchwork") {
    return;
  }
  const explainId = patchworkExplainIdForElement(event.target);
  if (explainId) {
    event.preventDefault();
    event.stopPropagation();
    showPatchworkExplanation(explainId);
    exitPatchworkExplainMode();
    return;
  }
  if (event.target.closest("button")) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

document.addEventListener("click", (event) => {
  if (!patchworkExplainMode || currentGameType !== "patchwork") {
    return;
  }
  if (event.target.closest("button")) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  if (patchworkExplainMode) {
    exitPatchworkExplainMode();
    return;
  }
  if (patchworkHelpModal && !patchworkHelpModal.classList.contains("hidden")) {
    closePatchworkHelpModal();
    return;
  }
  if (patchworkExplainModal && !patchworkExplainModal.classList.contains("hidden")) {
    closePatchworkExplainModal();
    return;
  }
  if (patchworkQuiltModal && !patchworkQuiltModal.classList.contains("hidden")) {
    closePatchworkQuiltModal();
    return;
  }
  if (currentGameType === "patchwork" && patchworkSelectedPatchId && currentPatchworkView) {
    patchworkClearSelection();
    renderPatchworkGameState({ view: currentPatchworkView });
  }
});
