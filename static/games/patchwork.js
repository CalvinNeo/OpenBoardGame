let currentPatchworkView = null;
let patchworkSelectedPatchId = null;
let patchworkRotation = 0;
let patchworkFlip = false;
let patchworkAnchor = null;
let patchworkExplainMode = false;

const patchworkPanel = document.getElementById("patchworkPanel");
const patchworkHeaderActions = document.getElementById("patchworkHeaderActions");
const patchworkHelpBtn = document.getElementById("patchworkHelpBtn");
const patchworkExplainBtn = document.getElementById("patchworkExplainBtn");
const patchworkHelpModal = document.getElementById("patchworkHelpModal");
const patchworkHelpModalCloseBtn = document.getElementById("patchworkHelpModalCloseBtn");
const patchworkExplainModal = document.getElementById("patchworkExplainModal");
const patchworkExplainModalCloseBtn = document.getElementById("patchworkExplainModalCloseBtn");
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
const patchworkMarket = document.getElementById("patchworkMarket");
const patchworkPlayers = document.getElementById("patchworkPlayers");
const patchworkPreview = document.getElementById("patchworkPreview");
const patchworkYourBoard = document.getElementById("patchworkYourBoard");
const patchworkOtherBoards = document.getElementById("patchworkOtherBoards");
const patchworkSelectionHint = document.getElementById("patchworkSelectionHint");
const patchworkRotateLeftBtn = document.getElementById("patchworkRotateLeftBtn");
const patchworkRotateRightBtn = document.getElementById("patchworkRotateRightBtn");
const patchworkFlipBtn = document.getElementById("patchworkFlipBtn");
const patchworkAdvanceBtn = document.getElementById("patchworkAdvanceBtn");
const patchworkBuyBtn = document.getElementById("patchworkBuyBtn");

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
    <li>Use rotate / flip to set its orientation.</li>
    <li>Click your quilt to choose the top-left anchor of the preview, then confirm with <strong>Buy Selected Patch</strong>.</li>
    <li>When a leather patch is pending, click any empty square on your quilt to place it.</li>
  </ul>
`;

const PATCHWORK_EXPLANATIONS = {
  track: {
    name: "Time Track",
    description: "Shows button-income markers, leather markers, and both player positions from 0 to 53.",
  },
  marketCard: {
    name: "Patch Market",
    description: "The first three cards are buyable. The rest show the upcoming circle order after the neutral marker.",
  },
  yourBoard: {
    name: "Your Quilt Board",
    description: "Click to choose the top-left anchor for the selected patch preview. During a leather bonus, click any empty square to place the 1x1 tile.",
  },
  otherBoard: {
    name: "Opponent Quilt",
    description: "Shows the current filled pattern, empty spaces, and score pressure on the other player.",
  },
  preview: {
    name: "Preview",
    description: "Shows the selected patch, its current orientation, and the transformed cell footprint you are about to place.",
  },
  patchworkRotateLeftBtn: {
    name: "Rotate Left",
    description: "Rotate the selected patch 90 degrees counterclockwise.",
  },
  patchworkRotateRightBtn: {
    name: "Rotate Right",
    description: "Rotate the selected patch 90 degrees clockwise.",
  },
  patchworkFlipBtn: {
    name: "Flip",
    description: "Mirror the selected patch horizontally before placement.",
  },
  patchworkAdvanceBtn: {
    name: "Advance + Buttons",
    description: "Skip buying and move ahead of the opponent, gaining one button per space moved.",
  },
  patchworkBuyBtn: {
    name: "Buy Selected Patch",
    description: "Confirm the currently selected patch, orientation, and anchor on your board.",
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
  if (patchworkMarket) patchworkMarket.innerHTML = "";
  if (patchworkPlayers) patchworkPlayers.innerHTML = "";
  if (patchworkPreview) patchworkPreview.innerHTML = "";
  if (patchworkYourBoard) patchworkYourBoard.innerHTML = "";
  if (patchworkOtherBoards) patchworkOtherBoards.innerHTML = "";
  if (patchworkSelectionHint) {
    patchworkSelectionHint.textContent = "Select one of the first three patches, then click your board.";
  }
  if (patchworkNotice) {
    patchworkNotice.classList.add("hidden");
    patchworkNotice.setAttribute("aria-hidden", "true");
  }
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
    return;
  }
  if (patchworkAnchor && !patchworkHasSelectionPlacement(view)) {
    const you = patchworkYou(view);
    if (
      !you ||
      !patchworkCanPlace(
        view,
        you.quilt_board || [],
        patchworkSelectedCells(view),
        patchworkAnchor.x,
        patchworkAnchor.y,
      )
    ) {
      patchworkAnchor = null;
    }
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
  patchworkExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
  `;
  setModalVisible(patchworkExplainModal, true);
}

function closePatchworkExplainModal() {
  if (patchworkExplainModal) {
    setModalVisible(patchworkExplainModal, false);
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
    patchworkSelectedPatchLabel.textContent = selectedDef ? patchworkSelectedPatchId : "-";
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
    patchworkNoticeBody.textContent = "Final scores are shown in the player panel.";
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

  const rail = document.createElement("div");
  rail.className = "patchwork-track-rail";
  patchworkTrack.appendChild(rail);

  const markerLayer = document.createElement("div");
  markerLayer.className = "patchwork-track-marker-layer";
  patchworkTrack.appendChild(markerLayer);

  const chipLayer = document.createElement("div");
  chipLayer.className = "patchwork-track-chip-layer";
  patchworkTrack.appendChild(chipLayer);

  const trackEnd = Number.isInteger(view.track_end) ? view.track_end : 53;
  const positionPct = (position) => `${(position / Math.max(trackEnd, 1)) * 100}%`;

  [0, trackEnd].forEach((position) => {
    const tick = document.createElement("div");
    tick.className = "patchwork-track-tick";
    tick.style.left = positionPct(position);
    tick.textContent = String(position);
    patchworkTrack.appendChild(tick);
  });

  (view.button_markers || []).forEach((position) => {
    const marker = document.createElement("div");
    marker.className = "patchwork-track-marker income";
    marker.style.left = positionPct(position);
    marker.textContent = "🔘";
    marker.title = `Income at ${position}`;
    markerLayer.appendChild(marker);
  });

  const claimed = new Set(view.claimed_leathers || []);
  (view.leather_markers || []).forEach((position) => {
    const marker = document.createElement("div");
    marker.className = "patchwork-track-marker leather";
    if (claimed.has(position)) {
      marker.classList.add("claimed");
    }
    marker.style.left = positionPct(position);
    marker.textContent = "🟫";
    marker.title = claimed.has(position) ? `Leather at ${position} (claimed)` : `Leather at ${position}`;
    markerLayer.appendChild(marker);
  });

  (view.players || []).forEach((player, index) => {
    const chip = document.createElement("div");
    chip.className = `patchwork-track-chip seat-${player.seat ?? index}`;
    chip.style.left = positionPct(player.time_position || 0);
    chip.style.top = `${index * 30 + 14}px`;
    chip.title = `${player.name}: ${player.time_position}`;
    chip.textContent = (player.name || "?").slice(0, 1).toUpperCase();
    chipLayer.appendChild(chip);
  });
}

function renderPatchworkMarket(view) {
  if (!patchworkMarket || !view) {
    return;
  }
  patchworkMarket.innerHTML = "";
  const you = patchworkYou(view);
  const selectable = new Set(view.selectable_patches || []);

  (view.patch_circle || []).forEach((entry) => {
    const def = view.patch_defs ? view.patch_defs[entry.patch_id] : null;
    if (!def) {
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "patchwork-market-card";
    button.dataset.patchId = def.id;
    button.setAttribute("data-patchwork-explain", "marketCard");
    if (selectable.has(def.id)) {
      button.classList.add("selectable");
    } else {
      button.classList.add("upcoming");
    }
    if (patchworkSelectedPatchId === def.id) {
      button.classList.add("selected");
    }
    if (you && you.buttons < def.cost_buttons) {
      button.classList.add("unaffordable");
    }

    const order = document.createElement("div");
    order.className = "patchwork-market-order";
    order.textContent = entry.offset < 3 ? `#${entry.offset + 1}` : `+${entry.offset}`;

    const image = document.createElement("img");
    image.className = "patchwork-market-image";
    image.src = def.svg_url;
    image.alt = def.id;

    const meta = document.createElement("div");
    meta.className = "patchwork-market-meta";
    meta.innerHTML = `
      <span>🔘 ${def.cost_buttons}</span>
      <span>⏳ ${def.cost_time}</span>
      <span>🪙 ${def.income_buttons}</span>
      <span>◼︎ ${def.cell_count}</span>
    `;

    const label = document.createElement("div");
    label.className = "patchwork-market-label";
    label.textContent = def.id;

    button.appendChild(order);
    button.appendChild(image);
    button.appendChild(meta);
    button.appendChild(label);
    button.addEventListener("click", () => {
      if (!selectable.has(def.id) || view.pending_special_patch) {
        return;
      }
      if (patchworkSelectedPatchId === def.id) {
        patchworkClearSelection();
      } else {
        patchworkSelectedPatchId = def.id;
        patchworkRotation = 0;
        patchworkFlip = false;
        patchworkAnchor = null;
      }
      renderPatchworkGameState({ view });
    });
    patchworkMarket.appendChild(button);
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
    note.className = "patchwork-preview-note";
    note.innerHTML = `
      <div class="patchwork-preview-title">Leather Patch Pending</div>
      <p>Click any empty square on your quilt to place a 1x1 leather patch.</p>
    `;
    note.appendChild(patchworkBuildMiniGrid([[0, 0]], "leather"));
    patchworkPreview.appendChild(note);
    return;
  }

  const def = patchworkSelectedDef(view);
  if (!def) {
    const empty = document.createElement("div");
    empty.className = "patchwork-preview-note";
    empty.innerHTML = "<p>Select a patch from the first three market cards to preview it here.</p>";
    patchworkPreview.appendChild(empty);
    return;
  }

  const title = document.createElement("div");
  title.className = "patchwork-preview-title";
  title.textContent = def.id;

  const image = document.createElement("img");
  image.className = "patchwork-preview-image";
  image.src = def.svg_url;
  image.alt = def.id;

  const meta = document.createElement("div");
  meta.className = "patchwork-preview-meta";
  meta.innerHTML = `
    <span>🔘 ${def.cost_buttons}</span>
    <span>⏳ ${def.cost_time}</span>
    <span>🪙 ${def.income_buttons}</span>
    <span>Anchor ${patchworkAnchor ? `${patchworkAnchor.x}, ${patchworkAnchor.y}` : "-"}</span>
  `;

  patchworkPreview.appendChild(title);
  patchworkPreview.appendChild(image);
  patchworkPreview.appendChild(patchworkBuildMiniGrid(patchworkSelectedCells(view)));
  patchworkPreview.appendChild(meta);
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
  if (!patchworkPlayers || !patchworkOtherBoards || !view) {
    return;
  }
  patchworkPlayers.innerHTML = "";
  patchworkOtherBoards.innerHTML = "";

  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "patchwork-player-card";
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
        <span>🪙 ${player.button_income}</span>
        <span>⬜ ${player.empty_spaces}</span>
        <span>⭐ ${player.has_special_tile ? "7" : "0"}</span>
        <span>🏁 ${score}</span>
      </div>
    `;
    patchworkPlayers.appendChild(card);

    if (player.player_id !== view.you) {
      const wrapper = document.createElement("div");
      wrapper.className = "patchwork-opponent-card";
      const title = document.createElement("div");
      title.className = "patchwork-opponent-title";
      title.textContent = `${player.name}'s Quilt`;
      const board = document.createElement("div");
      renderPatchworkBoard(board, view, player, false);
      wrapper.appendChild(title);
      wrapper.appendChild(board);
      patchworkOtherBoards.appendChild(wrapper);
    }
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
  const buyEnabled = !!(
    view &&
    !view.pending_special_patch &&
    legal.has("buy_patch") &&
    patchworkSelectedAffordable(view) &&
    patchworkHasSelectionPlacement(view)
  );

  if (patchworkRotateLeftBtn) {
    patchworkRotateLeftBtn.disabled = !hasPatch || !!(view && view.pending_special_patch);
  }
  if (patchworkRotateRightBtn) {
    patchworkRotateRightBtn.disabled = !hasPatch || !!(view && view.pending_special_patch);
  }
  if (patchworkFlipBtn) {
    patchworkFlipBtn.disabled = !hasPatch || !!(view && view.pending_special_patch);
  }
  if (patchworkAdvanceBtn) {
    patchworkAdvanceBtn.disabled = !(view && legal.has("advance"));
  }
  if (patchworkBuyBtn) {
    patchworkBuyBtn.disabled = !buyEnabled;
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
      patchworkSelectionHint.textContent = "Current anchor is invalid for this orientation.";
    } else if (patchworkSelectedPatchId && patchworkAnchor) {
      patchworkSelectionHint.textContent = "Placement looks valid. Confirm with Buy Selected Patch.";
    } else if (patchworkSelectedPatchId) {
      patchworkSelectionHint.textContent = "Now click your quilt to choose the patch anchor.";
    } else {
      patchworkSelectionHint.textContent = "Select one of the first three patches, then click your board.";
    }
  }
  updatePatchworkActionButtons();
  if (patchworkExplainMode) {
    updatePatchworkExplainModeClasses(true);
  }
}

if (patchworkRotateLeftBtn) {
  patchworkRotateLeftBtn.addEventListener("click", () => {
    if (!currentPatchworkView || !patchworkSelectedPatchId) {
      return;
    }
    patchworkRotation = (patchworkRotation + 270) % 360;
    renderPatchworkGameState({ view: currentPatchworkView });
  });
}

if (patchworkRotateRightBtn) {
  patchworkRotateRightBtn.addEventListener("click", () => {
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

if (patchworkAdvanceBtn) {
  patchworkAdvanceBtn.addEventListener("click", () => {
    sendAction({ type: "advance" });
  });
}

if (patchworkBuyBtn) {
  patchworkBuyBtn.addEventListener("click", () => {
    if (!currentPatchworkView || !patchworkSelectedPatchId || !patchworkAnchor) {
      return;
    }
    if (!patchworkHasSelectionPlacement(currentPatchworkView)) {
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

if (patchworkPanel) {
  patchworkPanel.addEventListener("pointerdown", (event) => {
    if (patchworkExplainMode || !currentPatchworkView || currentPatchworkView.pending_special_patch) {
      return;
    }
    const target = event.target;
    if (target.closest(".patchwork-market-card, .patchwork-board-cell, button, .modal")) {
      return;
    }
    if (!target.closest(".patchwork-preview")) {
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
  }
});
