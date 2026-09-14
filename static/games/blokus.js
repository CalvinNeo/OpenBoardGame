const blokusStatusLabel = document.getElementById("blokusStatus");
const blokusTurnLabel = document.getElementById("blokusTurn");
const blokusWinnerLabel = document.getElementById("blokusWinner");
const blokusSelectedPieceLabel = document.getElementById("blokusSelectedPiece");
const blokusOriginLabel = document.getElementById("blokusOrigin");
const blokusPlaceBtn = document.getElementById("blokusPlaceBtn");
const blokusGiveUpBtn = document.getElementById("blokusGiveUpBtn");
const blokusBoardControls = document.getElementById("blokusBoardControls");
const blokusPivot = document.getElementById("blokusPivot");
const blokusRotateLeftBtn = document.getElementById("blokusRotateLeftBtn");
const blokusRotateRightBtn = document.getElementById("blokusRotateRightBtn");
const blokusFlipBtn = document.getElementById("blokusFlipBtn");
const blokusNudgeUpBtn = document.getElementById("blokusNudgeUpBtn");
const blokusNudgeLeftBtn = document.getElementById("blokusNudgeLeftBtn");
const blokusNudgeDownBtn = document.getElementById("blokusNudgeDownBtn");
const blokusNudgeRightBtn = document.getElementById("blokusNudgeRightBtn");
const blokusBoard = document.getElementById("blokusBoard");
const blokusPieces = document.getElementById("blokusPieces");
const blokusPlayers = document.getElementById("blokusPlayers");
const blokusHeaderActions = document.getElementById("blokusHeaderActions");
const blokusHelpBtn = document.getElementById("blokusHelpBtn");
const blokusExplainBtn = document.getElementById("blokusExplainBtn");
const blokusHelpModal = document.getElementById("blokusHelpModal");
const blokusHelpModalCloseBtn = document.getElementById("blokusHelpModalCloseBtn");
const blokusExplainModal = document.getElementById("blokusExplainModal");
const blokusExplainModalCloseBtn = document.getElementById("blokusExplainModalCloseBtn");
const blokusExplainContent = document.getElementById("blokusExplainContent");

let currentBlokusView = null;

let blokusSelectedPieceId = null;
let blokusSelectedOrigin = null;
let blokusRotation = 0;
let blokusFlip = false;
let blokusDragState = null;
let blokusExplainMode = false;
let blokusExplainSuppressNextClick = false;

const BLOKUS_DRAG_THRESHOLD = 6;
const BLOKUS_ADJACENT_OFFSETS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const BLOKUS_DIAGONAL_OFFSETS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const BLOKUS_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Cover as much of the 20 × 20 board as possible with your color: 🔵 blue, 🟡 yellow, 🔴 red, or 🟢 green.</p>
  <h3>Placement rules</h3>
  <ul>
    <li>Your first piece must cover your color's starting corner.</li>
    <li>Later pieces must touch at least one of your pieces corner-to-corner.</li>
    <li>Your own pieces may not share an edge. Pieces of other colors may touch in any direction.</li>
    <li>Pieces may be rotated or flipped before placement.</li>
  </ul>
  <h3>Controls</h3>
  <ul>
    <li>Select a piece, then tap or drag on the board to position it.</li>
    <li>Use the arrow pad or keyboard arrow keys for one-cell adjustments.</li>
    <li>Use ↺ / ↻ or Q / E to rotate, ⇋ or F to flip, and Enter to place.</li>
    <li>The crosshair marks the selected piece's center of gravity, which stays as stable as the grid allows while transforming.</li>
  </ul>
  <h3>End and scoring</h3>
  <p>When no player can continue, each unplayed square is worth −1 point. Playing every piece earns +15; finishing with the single-square piece earns another +5. Highest score wins.</p>
`;
const BLOKUS_BUTTON_EXPLANATIONS = {
  blokusRotateLeftBtn: {
    name: "Rotate Left ↺",
    description: "Rotate the selected piece 90° counterclockwise around its center of gravity. Shortcut: Q."
  },
  blokusFlipBtn: {
    name: "Flip ⇋",
    description: "Mirror the selected piece horizontally around its center of gravity. Shortcut: F."
  },
  blokusRotateRightBtn: {
    name: "Rotate Right ↻",
    description: "Rotate the selected piece 90° clockwise around its center of gravity. Shortcut: E."
  },
  blokusNudgeUpBtn: {
    name: "Move Up ↑",
    description: "Move the selected piece up by one board cell. Shortcut: Arrow Up."
  },
  blokusNudgeLeftBtn: {
    name: "Move Left ←",
    description: "Move the selected piece left by one board cell. Shortcut: Arrow Left."
  },
  blokusNudgeDownBtn: {
    name: "Move Down ↓",
    description: "Move the selected piece down by one board cell. Shortcut: Arrow Down."
  },
  blokusNudgeRightBtn: {
    name: "Move Right →",
    description: "Move the selected piece right by one board cell. Shortcut: Arrow Right."
  },
  blokusPlaceBtn: {
    name: "Place Piece",
    description: "Confirm the previewed placement. The button is enabled only when a piece and position are selected on your turn. Shortcut: Enter."
  },
  blokusGiveUpBtn: {
    name: "Give Up",
    description: "Permanently stop taking turns for the rest of this game. Use this only when you do not want to make another move."
  }
};

function clearBlokusState() {
  exitBlokusExplainMode();
  currentBlokusView = null;
  blokusSelectedPieceId = null;
  blokusSelectedOrigin = null;
  blokusRotation = 0;
  blokusFlip = false;
  blokusDragState = null;
  updateBlokusTransformButtonState();
  if (blokusStatusLabel) {
    blokusStatusLabel.textContent = "-";
  }

  if (blokusTurnLabel) {
    blokusTurnLabel.textContent = "-";
  }
  if (blokusWinnerLabel) {
    blokusWinnerLabel.textContent = "-";
  }
  if (blokusSelectedPieceLabel) {
    blokusSelectedPieceLabel.textContent = "-";
  }
  if (blokusOriginLabel) {
    blokusOriginLabel.textContent = "-";
  }
  if (blokusBoardControls) {
    blokusBoardControls.classList.add("hidden");
  }
  if (blokusPivot) {
    blokusPivot.classList.add("hidden");
    blokusPivot.style.left = "";
    blokusPivot.style.top = "";
  }
  if (blokusBoard) {
    blokusBoard.classList.remove("dragging");
    blokusBoard.innerHTML = "";
  }
  if (blokusPieces) {
    blokusPieces.innerHTML = "";
  }
  if (blokusPlayers) {
    blokusPlayers.innerHTML = "";
  }
  updateBlokusActionButton();
}

function normalizeBlokusCells(cells) {
  if (!cells.length) {
    return [];
  }
  let minX = cells[0][0];
  let minY = cells[0][1];
  cells.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  });
  return cells
    .map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
}

function rotateBlokusCells(cells) {
  return cells.map(([x, y]) => [y, -x]);
}

function flipBlokusCells(cells) {
  return cells.map(([x, y]) => [-x, y]);
}

function transformBlokusCells(cells, rotation, flip) {
  let coords = cells.map(([x, y]) => [x, y]);
  if (flip) {
    coords = flipBlokusCells(coords);
  }
  const turns = Math.floor(((rotation % 360) + 360) / 90) % 4;
  for (let i = 0; i < turns; i += 1) {
    coords = rotateBlokusCells(coords);
  }
  return normalizeBlokusCells(coords);
}

function getBlokusYou(view) {
  if (!view || !Array.isArray(view.players)) {
    return null;
  }
  return view.players.find((player) => player.player_id === view.you) || null;
}

function isBlokusFirstMove(view, you) {
  if (!view || !you) {
    return false;
  }
  const totalPieces = view.piece_defs ? Object.keys(view.piece_defs).length : 0;
  const remaining = Array.isArray(view.remaining_pieces) ? view.remaining_pieces.length : null;
  if (totalPieces && remaining !== null && remaining === totalPieces) {
    return true;
  }
  const color = you.color;
  const board = Array.isArray(view.board) ? view.board : [];
  if (!color || !board.length) {
    return false;
  }
  for (let y = 0; y < board.length; y += 1) {
    const row = board[y];
    if (!Array.isArray(row)) {
      continue;
    }
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === color) {
        return false;
      }
    }
  }
  return true;
}

function getBlokusLegalPlacements(view, pieceId, rotation, flip) {
  if (!view || !pieceId || !view.piece_defs) {
    return [];
  }
  const def = view.piece_defs[pieceId];
  if (!def || !Array.isArray(def.cells) || !def.cells.length) {
    return [];
  }
  const you = getBlokusYou(view);
  if (!you || !you.color || you.passed) {
    return [];
  }
  const coords = transformBlokusCells(def.cells, rotation, flip);
  if (!coords.length) {
    return [];
  }
  const size = view.board_size || 20;
  const board = Array.isArray(view.board) ? view.board : [];
  const width = Math.max(...coords.map(([x]) => x)) + 1;
  const height = Math.max(...coords.map(([, y]) => y)) + 1;
  const maxX = size - width;
  const maxY = size - height;
  if (maxX < 0 || maxY < 0) {
    return [];
  }
  const firstMove = isBlokusFirstMove(view, you);
  const startCorner = Array.isArray(you.start_corner) ? you.start_corner : null;
  const color = you.color;
  const placements = [];

  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= maxX; x += 1) {
      let hasDiagonal = false;
      let coversCorner = false;
      let blocked = false;
      for (let i = 0; i < coords.length; i += 1) {
        const [dx, dy] = coords[i];
        const cx = x + dx;
        const cy = y + dy;
        const row = board[cy];
        if (row && row[cx] != null) {
          blocked = true;
          break;
        }
        if (firstMove) {
          if (startCorner && cx === startCorner[0] && cy === startCorner[1]) {
            coversCorner = true;
          }
        } else {
          for (let j = 0; j < BLOKUS_ADJACENT_OFFSETS.length; j += 1) {
            const [ax, ay] = BLOKUS_ADJACENT_OFFSETS[j];
            const nx = cx + ax;
            const ny = cy + ay;
            if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
              const adjRow = board[ny];
              if (adjRow && adjRow[nx] === color) {
                blocked = true;
                break;
              }
            }
          }
          if (blocked) {
            break;
          }
          for (let j = 0; j < BLOKUS_DIAGONAL_OFFSETS.length; j += 1) {
            const [dx2, dy2] = BLOKUS_DIAGONAL_OFFSETS[j];
            const nx = cx + dx2;
            const ny = cy + dy2;
            if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
              const diagRow = board[ny];
              if (diagRow && diagRow[nx] === color) {
                hasDiagonal = true;
              }
            }
          }
        }
      }
      if (blocked) {
        continue;
      }
      if (firstMove) {
        if (!coversCorner) {
          continue;
        }
      } else if (!hasDiagonal) {
        continue;
      }
      placements.push({ x, y });
    }
  }
  return placements;
}

function getBlokusOrientationVariants(baseRotation, baseFlip) {
  const rotations = [0, 90, 180, 270];
  const flips = [false, true];
  const variants = [];
  const seen = new Set();
  const normalizeRotation = (rotation) => ((rotation % 360) + 360) % 360;
  const addVariant = (rotation, flip) => {
    const key = `${rotation}:${flip}`;
    if (seen.has(key)) {
      return;
    }
    variants.push({ rotation, flip });
    seen.add(key);
  };
  const normalizedBase = normalizeRotation(baseRotation);
  const base = rotations.includes(normalizedBase) ? normalizedBase : 0;
  addVariant(base, !!baseFlip);
  flips.forEach((flip) => {
    rotations.forEach((rotation) => {
      addVariant(rotation, flip);
    });
  });
  return variants;
}

function getNextBlokusAutoPlacement(view) {
  if (!view || !blokusSelectedPieceId) {
    return null;
  }
  const variants = getBlokusOrientationVariants(blokusRotation, blokusFlip);
  const placements = [];
  variants.forEach(({ rotation, flip }) => {
    const options = getBlokusLegalPlacements(view, blokusSelectedPieceId, rotation, flip);
    options.forEach(({ x, y }) => {
      placements.push({ x, y, rotation, flip });
    });
  });
  if (!placements.length) {
    return null;
  }
  if (blokusSelectedOrigin) {
    const currentRotation = ((blokusRotation % 360) + 360) % 360;
    const currentFlip = !!blokusFlip;
    const index = placements.findIndex(
      (placement) => placement.x === blokusSelectedOrigin.x
        && placement.y === blokusSelectedOrigin.y
        && placement.rotation === currentRotation
        && placement.flip === currentFlip,
    );
    if (index >= 0) {
      return placements[(index + 1) % placements.length];
    }
  }
  return placements[0];
}

function getBlokusFallbackOrigin(view, pieceId, rotation, flip) {
  if (!view || !pieceId || !view.piece_defs) {
    return null;
  }
  const def = view.piece_defs[pieceId];
  if (!def || !Array.isArray(def.cells) || !def.cells.length) {
    return null;
  }
  const coords = transformBlokusCells(def.cells, rotation, flip);
  if (!coords.length) {
    return null;
  }
  const size = view.board_size || 20;
  const width = Math.max(...coords.map(([x]) => x)) + 1;
  const height = Math.max(...coords.map(([, y]) => y)) + 1;
  if (size < width || size < height) {
    return null;
  }
  return { x: 0, y: 0 };
}

function getBlokusBoardMetrics() {
  if (!blokusBoard) {
    return { cell: 18, gap: 1, pad: 6 };
  }
  const style = window.getComputedStyle(blokusBoard);
  const readPx = (value, fallback) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const gap = readPx(style.getPropertyValue("--blokus-gap"), 1);
  const pad = readPx(style.getPropertyValue("--blokus-pad"), 6);
  let cell = readPx(style.getPropertyValue("--blokus-cell"), NaN);
  if (!Number.isFinite(cell)) {
    const rect = blokusBoard.getBoundingClientRect();
    if (Number.isFinite(rect.width) && rect.width > 0) {
      cell = (rect.width - (2 * pad) - (19 * gap)) / 20;
    }
  }
  return {
    cell: Number.isFinite(cell) ? cell : 18,
    gap,
    pad,
  };
}

function getBlokusPointerPoint(event) {
  if (!blokusBoard || !event) {
    return null;
  }
  const rect = blokusBoard.getBoundingClientRect();
  const clientX = event.clientX ?? (event.touches && event.touches[0] && event.touches[0].clientX);
  const clientY = event.clientY ?? (event.touches && event.touches[0] && event.touches[0].clientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return null;
  }
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

function getBlokusGridPoint(point, metrics) {
  if (!point || !metrics) {
    return null;
  }
  const span = metrics.cell + metrics.gap;
  if (!span) {
    return null;
  }
  return {
    x: (point.x - metrics.pad - metrics.cell / 2) / span,
    y: (point.y - metrics.pad - metrics.cell / 2) / span,
  };
}

function getBlokusPiecePlacement(view, pieceId, rotation, flip) {
  if (!view || !pieceId || !view.piece_defs) {
    return null;
  }
  const def = view.piece_defs[pieceId];
  if (!def || !Array.isArray(def.cells) || !def.cells.length) {
    return null;
  }
  const coords = transformBlokusCells(def.cells, rotation, flip);
  if (!coords.length) {
    return null;
  }
  let sumX = 0;
  let sumY = 0;
  coords.forEach(([x, y]) => {
    sumX += x;
    sumY += y;
  });
  const maxX = Math.max(...coords.map(([x]) => x));
  const maxY = Math.max(...coords.map(([, y]) => y));
  return {
    coords,
    width: maxX + 1,
    height: maxY + 1,
    anchorX: sumX / coords.length,
    anchorY: sumY / coords.length,
  };
}

function getBlokusSelectedPiecePlacement(view) {
  return getBlokusPiecePlacement(
    view,
    blokusSelectedPieceId,
    blokusRotation,
    blokusFlip,
  );
}

function clampBlokusValue(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateBlokusTransformButtonState() {
  if (!blokusFlipBtn) {
    return;
  }
  blokusFlipBtn.setAttribute("aria-pressed", String(blokusFlip));
  blokusFlipBtn.classList.toggle("tool-active", blokusFlip);
}

function transformBlokusSelection(rotation, flip) {
  const nextRotation = ((rotation % 360) + 360) % 360;
  const nextFlip = !!flip;
  const currentPlacement = getBlokusSelectedPiecePlacement(currentBlokusView);
  const nextPlacement = getBlokusPiecePlacement(
    currentBlokusView,
    blokusSelectedPieceId,
    nextRotation,
    nextFlip,
  );

  blokusRotation = nextRotation;
  blokusFlip = nextFlip;
  updateBlokusTransformButtonState();

  if (blokusSelectedOrigin && currentPlacement && nextPlacement) {
    const centerX = blokusSelectedOrigin.x + currentPlacement.anchorX;
    const centerY = blokusSelectedOrigin.y + currentPlacement.anchorY;
    const size = currentBlokusView.board_size || 20;
    const maxX = Math.max(0, size - nextPlacement.width);
    const maxY = Math.max(0, size - nextPlacement.height);
    const nextX = clampBlokusValue(
      Math.round(centerX - nextPlacement.anchorX),
      0,
      maxX,
    );
    const nextY = clampBlokusValue(
      Math.round(centerY - nextPlacement.anchorY),
      0,
      maxY,
    );
    setBlokusOrigin(nextX, nextY, true);
    return;
  }
  if (currentBlokusView) {
    renderBlokusBoard(currentBlokusView);
  }
  updateBlokusActionButton();
}

function getBlokusOriginFromPoint(point, alignToCenter) {
  if (!currentBlokusView || !point) {
    return null;
  }
  const metrics = getBlokusBoardMetrics();
  const gridPoint = getBlokusGridPoint(point, metrics);
  if (!gridPoint || !Number.isFinite(gridPoint.x) || !Number.isFinite(gridPoint.y)) {
    return null;
  }
  const placement = getBlokusSelectedPiecePlacement(currentBlokusView);
  const anchorX = alignToCenter && placement ? placement.anchorX : 0;
  const anchorY = alignToCenter && placement ? placement.anchorY : 0;
  const rawX = Math.round(gridPoint.x - anchorX);
  const rawY = Math.round(gridPoint.y - anchorY);
  const size = currentBlokusView.board_size || 20;
  const width = placement ? placement.width : 1;
  const height = placement ? placement.height : 1;
  const maxX = Math.max(0, size - width);
  const maxY = Math.max(0, size - height);
  return {
    x: clampBlokusValue(rawX, 0, maxX),
    y: clampBlokusValue(rawY, 0, maxY),
  };
}

function updateBlokusControlsVisibility(bounds) {
  if (!blokusBoardControls) {
    return;
  }
  if (!bounds) {
    blokusBoardControls.classList.add("hidden");
    return;
  }
  blokusBoardControls.classList.remove("hidden");
}

function positionBlokusPivot(center) {
  if (!blokusPivot) {
    return;
  }
  if (!center) {
    blokusPivot.classList.add("hidden");
    blokusPivot.style.left = "";
    blokusPivot.style.top = "";
    return;
  }
  const { cell, gap, pad } = getBlokusBoardMetrics();
  const span = cell + gap;
  blokusPivot.style.left = `${pad + center.x * span + cell / 2}px`;
  blokusPivot.style.top = `${pad + center.y * span + cell / 2}px`;
  blokusPivot.classList.remove("hidden");
}

function updateBlokusActionButton() {
  const legalActions = currentBlokusView && Array.isArray(currentBlokusView.legal_actions)
    ? currentBlokusView.legal_actions
    : [];
  if (blokusPlaceBtn) {
    const placeAllowed = legalActions.includes("place_piece");
    const placeEnabled = placeAllowed && !!blokusSelectedPieceId && !!blokusSelectedOrigin;
    blokusPlaceBtn.disabled = !placeEnabled;
    blokusPlaceBtn.classList.toggle("action-allowed", placeEnabled);
  }
  if (blokusGiveUpBtn) {
    const giveUpAllowed = legalActions.includes("give_up");
    blokusGiveUpBtn.disabled = !giveUpAllowed;
    blokusGiveUpBtn.classList.toggle("action-allowed", giveUpAllowed);
  }
}

function nudgeBlokusOrigin(dx, dy) {
  if (!currentBlokusView || currentBlokusView.game_over || !blokusSelectedOrigin) {
    return;
  }
  const placement = getBlokusSelectedPiecePlacement(currentBlokusView);
  const size = currentBlokusView.board_size || 20;
  const width = placement ? placement.width : 1;
  const height = placement ? placement.height : 1;
  const maxX = Math.max(0, size - width);
  const maxY = Math.max(0, size - height);
  const nextX = clampBlokusValue(blokusSelectedOrigin.x + dx, 0, maxX);
  const nextY = clampBlokusValue(blokusSelectedOrigin.y + dy, 0, maxY);
  setBlokusOrigin(nextX, nextY);
}

function handleBlokusKeyboardControls(event) {
  if (
    !currentBlokusView
    || blokusExplainMode
    || typeof currentGameType === "undefined"
    || currentGameType !== "blokus"
    || !blokusSelectedPieceId
    || !blokusSelectedOrigin
    || !blokusBoardControls
    || blokusBoardControls.classList.contains("hidden")
    || event.metaKey
    || event.ctrlKey
    || event.altKey
  ) {
    return;
  }
  const target = event.target;
  const tagName = target && target.tagName ? target.tagName.toLowerCase() : "";
  if (
    tagName === "input"
    || tagName === "textarea"
    || tagName === "select"
    || (target && target.isContentEditable)
  ) {
    return;
  }

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === "ArrowUp") {
    nudgeBlokusOrigin(0, -1);
  } else if (key === "ArrowLeft") {
    nudgeBlokusOrigin(-1, 0);
  } else if (key === "ArrowDown") {
    nudgeBlokusOrigin(0, 1);
  } else if (key === "ArrowRight") {
    nudgeBlokusOrigin(1, 0);
  } else if (key === "q") {
    transformBlokusSelection(blokusRotation - 90, blokusFlip);
  } else if (key === "e") {
    transformBlokusSelection(blokusRotation + 90, blokusFlip);
  } else if (key === "f") {
    transformBlokusSelection(blokusRotation, !blokusFlip);
  } else if (
    key === "Enter"
    && tagName !== "button"
    && blokusPlaceBtn
    && !blokusPlaceBtn.disabled
  ) {
    blokusPlaceBtn.click();
  } else {
    return;
  }
  event.preventDefault();
}

function handleBlokusPointerDown(event) {
  if (!currentBlokusView || currentBlokusView.game_over || !blokusBoard || blokusExplainMode) {
    return;
  }
  if (event.button !== undefined && event.button !== 0) {
    return;
  }
  if (event.isPrimary === false) {
    return;
  }
  const point = getBlokusPointerPoint(event);
  if (!point) {
    return;
  }
  const allowDrag = !!(event.target && event.target.classList && event.target.classList.contains("ghost"));
  blokusDragState = {
    pointerId: event.pointerId,
    startX: point.x,
    startY: point.y,
    dragged: false,
    allowDrag,
  };
  if (allowDrag && event.pointerId !== undefined && blokusBoard.setPointerCapture) {
    try {
      blokusBoard.setPointerCapture(event.pointerId);
    } catch (err) {
      // Ignore capture errors for unsupported browsers.
    }
  }
}

function handleBlokusPointerMove(event) {
  if (!blokusDragState || !blokusBoard) {
    return;
  }
  if (event.pointerId !== undefined && blokusDragState.pointerId !== event.pointerId) {
    return;
  }
  if (!blokusDragState.allowDrag) {
    return;
  }
  const point = getBlokusPointerPoint(event);
  if (!point) {
    return;
  }
  const dx = point.x - blokusDragState.startX;
  const dy = point.y - blokusDragState.startY;
  if (!blokusDragState.dragged) {
    if ((dx * dx + dy * dy) < (BLOKUS_DRAG_THRESHOLD * BLOKUS_DRAG_THRESHOLD)) {
      return;
    }
    blokusDragState.dragged = true;
    blokusBoard.classList.add("dragging");
  }
  const origin = getBlokusOriginFromPoint(point, true);
  if (origin) {
    setBlokusOrigin(origin.x, origin.y);
  }
  event.preventDefault();
}

function handleBlokusPointerUp(event) {
  if (!blokusDragState || !blokusBoard) {
    return;
  }
  if (event.pointerId !== undefined && blokusDragState.pointerId !== event.pointerId) {
    return;
  }
  const isCancel = event.type === "pointercancel";
  const point = getBlokusPointerPoint(event);
  const wasDragged = blokusDragState.dragged;
  if (!isCancel && !wasDragged && point) {
    const origin = getBlokusOriginFromPoint(point, false);
    if (origin) {
      setBlokusOrigin(origin.x, origin.y);
    }
  }
  if (blokusDragState.allowDrag && event.pointerId !== undefined && blokusBoard.releasePointerCapture) {
    try {
      blokusBoard.releasePointerCapture(event.pointerId);
    } catch (err) {
      // Ignore capture errors for unsupported browsers.
    }
  }
  blokusDragState = null;
  blokusBoard.classList.remove("dragging");
}

function setBlokusOrigin(x, y, forceUpdate = false) {
  if (!forceUpdate && blokusSelectedOrigin && blokusSelectedOrigin.x === x && blokusSelectedOrigin.y === y) {
    return;
  }
  blokusSelectedOrigin = { x, y };
  if (blokusOriginLabel) {
    blokusOriginLabel.textContent = `${x}, ${y}`;
  }
  updateBlokusActionButton();
  if (currentBlokusView) {
    renderBlokusBoard(currentBlokusView);
  }
}

function renderBlokusPieces(view) {
  if (!blokusPieces) {
    return;
  }
  blokusPieces.innerHTML = "";
  const remaining = Array.isArray(view.remaining_pieces) ? view.remaining_pieces : [];
  let selectionChanged = false;
  if (blokusSelectedPieceId && !remaining.includes(blokusSelectedPieceId)) {
    blokusSelectedPieceId = null;
    selectionChanged = true;
  }
  if (blokusSelectedPieceLabel) {
    blokusSelectedPieceLabel.textContent = blokusSelectedPieceId || "-";
  }
  if (!remaining.length) {
    const empty = document.createElement("div");
    empty.textContent = "No pieces remaining.";
    blokusPieces.appendChild(empty);
    updateBlokusActionButton();
    if (selectionChanged) {
      renderBlokusBoard(view);
    }
    return;
  }
  remaining.forEach((pieceId) => {
    const def = view.piece_defs ? view.piece_defs[pieceId] : null;
    const cells = def && Array.isArray(def.cells) ? def.cells : [];
    const piece = document.createElement("button");
    piece.type = "button";
    piece.className = "blokus-piece";
    if (pieceId === blokusSelectedPieceId) {
      piece.classList.add("selected");
    }
    piece.addEventListener("click", () => {
      const wasSelected = blokusSelectedPieceId === pieceId;
      blokusSelectedPieceId = pieceId;
      if (!wasSelected) {
        blokusSelectedOrigin = null;
      }
      if (blokusSelectedPieceLabel) {
        blokusSelectedPieceLabel.textContent = pieceId;
      }
      const placement = getNextBlokusAutoPlacement(view);
      if (placement) {
        const rotationChanged = blokusRotation !== placement.rotation || blokusFlip !== placement.flip;
        blokusRotation = placement.rotation;
        blokusFlip = placement.flip;
        setBlokusOrigin(placement.x, placement.y, rotationChanged);
      } else {
        const fallback = getBlokusFallbackOrigin(view, pieceId, blokusRotation, blokusFlip);
        if (fallback) {
          setBlokusOrigin(fallback.x, fallback.y);
        }
      }
      renderBlokusPieces(view);
    });

    if (cells.length) {
      const width = Math.max(...cells.map(([x]) => x)) + 1;
      const height = Math.max(...cells.map(([, y]) => y)) + 1;
      const grid = document.createElement("div");
      grid.className = "blokus-piece-grid";
      grid.style.gridTemplateColumns = `repeat(${width}, 10px)`;
      grid.style.gridTemplateRows = `repeat(${height}, 10px)`;
      cells.forEach(([x, y]) => {
        const cell = document.createElement("div");
        cell.className = "blokus-piece-cell";
        cell.style.gridColumn = `${x + 1}`;
        cell.style.gridRow = `${y + 1}`;
        grid.appendChild(cell);
      });
      piece.appendChild(grid);
    }

    const label = document.createElement("div");
    label.className = "blokus-piece-label";
    label.textContent = pieceId;
    piece.appendChild(label);
    blokusPieces.appendChild(piece);
  });
  updateBlokusActionButton();
  if (selectionChanged) {
    renderBlokusBoard(view);
  }
}

function renderBlokusBoard(view) {
  if (!blokusBoard) {
    return;
  }
  updateBlokusTransformButtonState();
  const size = view.board_size || 20;
  const board = Array.isArray(view.board) ? view.board : [];
  let ghostCells = null;
  let ghostColor = null;
  let ghostBounds = null;
  let ghostCenter = null;
  const canPlace = Array.isArray(view.legal_actions)
    && view.legal_actions.includes("place_piece");
  if (canPlace && blokusSelectedPieceId && blokusSelectedOrigin && view.piece_defs) {
    const def = view.piece_defs[blokusSelectedPieceId];
    if (def && Array.isArray(def.cells)) {
      const placement = getBlokusSelectedPiecePlacement(view);
      if (placement && placement.coords.length) {
        const { coords } = placement;
        ghostCells = new Set();
        const maxDx = Math.max(...coords.map(([x]) => x));
        const maxDy = Math.max(...coords.map(([, y]) => y));
        ghostBounds = {
          minX: blokusSelectedOrigin.x,
          minY: blokusSelectedOrigin.y,
          maxX: blokusSelectedOrigin.x + maxDx,
          maxY: blokusSelectedOrigin.y + maxDy,
        };
        ghostCenter = {
          x: blokusSelectedOrigin.x + placement.anchorX,
          y: blokusSelectedOrigin.y + placement.anchorY,
        };
        coords.forEach(([dx, dy]) => {
          const x = blokusSelectedOrigin.x + dx;
          const y = blokusSelectedOrigin.y + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) {
            ghostCells.add(`${x},${y}`);
          }
        });
        const you = (view.players || []).find((player) => player.player_id === view.you);
        ghostColor = you && you.color ? you.color : null;
      }
    }
  }
  blokusBoard.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (let y = 0; y < size; y += 1) {
    const row = Array.isArray(board[y]) ? board[y] : [];
    for (let x = 0; x < size; x += 1) {
      const cell = document.createElement("div");
      cell.className = "blokus-cell";
      const color = row[x];
      if (color) {
        cell.classList.add(color);
      }
      if (!color && ghostCells && ghostCells.has(`${x},${y}`)) {
        cell.classList.add("ghost");
        if (ghostColor) {
          cell.classList.add(ghostColor);
        }
      }
      if (canPlace && blokusSelectedOrigin && blokusSelectedOrigin.x === x && blokusSelectedOrigin.y === y) {
        cell.classList.add("selected");
      }
      fragment.appendChild(cell);
    }
  }
  blokusBoard.appendChild(fragment);
  updateBlokusControlsVisibility(ghostBounds);
  positionBlokusPivot(ghostCenter);
}

function renderBlokusPlayers(view) {
  if (!blokusPlayers) {
    return;
  }
  blokusPlayers.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  const youId = view.you;
  let orderedPlayers = players;
  if (youId) {
    const youPlayer = players.find((player) => player.player_id === youId);
    if (youPlayer) {
      orderedPlayers = [youPlayer, ...players.filter((player) => player.player_id !== youId)];
    }
  }

  orderedPlayers.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    if (player.passed) {
      card.classList.add("disabled");
    }

    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    const colorLabel = player.color ? ` (${player.color})` : "";
    name.textContent = `${player.name || player.player_id}${colorLabel}`;
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const pieces = document.createElement("span");
    pieces.className = "badge";
    pieces.textContent = `pieces ${player.remaining_pieces}`;
    badges.appendChild(pieces);
    const cells = document.createElement("span");
    cells.className = "badge";
    cells.textContent = `cells ${player.remaining_cells}`;
    badges.appendChild(cells);
    if (Number.isInteger(player.score)) {
      const score = document.createElement("span");
      score.className = "badge";
      score.textContent = `score ${player.score}`;
      badges.appendChild(score);
    }
    if (player.passed) {
      const passed = document.createElement("span");
      passed.className = "badge";
      passed.textContent = "passed";
      badges.appendChild(passed);
    }
    if (player.player_id === view.you) {
      const you = document.createElement("span");
      you.className = "badge highlight";
      you.textContent = "you";
      badges.appendChild(you);
    }
    if (player.is_bot) {
      const bot = document.createElement("span");
      bot.className = "badge";
      bot.textContent = "bot";
      badges.appendChild(bot);
    }
    header.appendChild(badges);
    card.appendChild(header);

    blokusPlayers.appendChild(card);
  });
}

function showBlokusHeaderActions(show) {
  if (blokusHeaderActions) {
    blokusHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitBlokusExplainMode();
  }
}

function showBlokusHelpModal() {
  if (!blokusHelpModal) {
    return;
  }
  const content = blokusHelpModal.querySelector(".blokus-help-content");
  if (content) {
    content.innerHTML = BLOKUS_HELP_TEXT;
  }
  setModalVisible(blokusHelpModal, true);
}

function closeBlokusHelpModal() {
  if (blokusHelpModal) {
    setModalVisible(blokusHelpModal, false);
  }
}

function updateBlokusExplainModeClasses(enabled) {
  Object.keys(BLOKUS_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.classList.toggle("has-explanation", enabled);
    }
  });
}

function findBlokusButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(BLOKUS_BUTTON_EXPLANATIONS)) {
    const button = document.getElementById(buttonId);
    if (!button) {
      continue;
    }
    const rect = button.getBoundingClientRect();
    if (
      rect.width > 0
      && rect.height > 0
      && x >= rect.left
      && x <= rect.right
      && y >= rect.top
      && y <= rect.bottom
    ) {
      return buttonId;
    }
  }
  return null;
}

function toggleBlokusExplainMode() {
  blokusExplainMode = !blokusExplainMode;
  document.body.classList.toggle("blokus-explain-mode", blokusExplainMode);
  updateBlokusExplainModeClasses(blokusExplainMode);
  if (blokusExplainBtn) {
    blokusExplainBtn.classList.toggle("active", blokusExplainMode);
    blokusExplainBtn.setAttribute("aria-pressed", blokusExplainMode ? "true" : "false");
  }
  if (blokusExplainMode) {
    blokusDragState = null;
    if (blokusBoard) {
      blokusBoard.classList.remove("dragging");
    }
  }
}

function exitBlokusExplainMode() {
  if (!blokusExplainMode) {
    return;
  }
  blokusExplainMode = false;
  document.body.classList.remove("blokus-explain-mode");
  updateBlokusExplainModeClasses(false);
  if (blokusExplainBtn) {
    blokusExplainBtn.classList.remove("active");
    blokusExplainBtn.setAttribute("aria-pressed", "false");
  }
}

function showBlokusButtonExplanation(buttonId) {
  const explanation = BLOKUS_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !blokusExplainContent || !blokusExplainModal) {
    return;
  }
  blokusExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
  `;
  setModalVisible(blokusExplainModal, true);
}

function closeBlokusExplainModal() {
  if (blokusExplainModal) {
    setModalVisible(blokusExplainModal, false);
  }
}

function renderBlokusGameState(data) {
  const view = data.view;
  currentBlokusView = view;
  if (currentGameType !== "blokus") {
    currentGameType = "blokus";
    setGamePanelVisibility("blokus");
  }
  if (blokusStatusLabel) {
    blokusStatusLabel.textContent = view.game_over ? "game over" : "in progress";
  }
  if (blokusTurnLabel) {
    const currentPlayer = (view.players || []).find((p) => p.player_id === view.current_turn);
    blokusTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (blokusWinnerLabel) {
    if (view.winner && view.winner.length) {
      const names = view.winner.map((pid) => findPlayerName(view, pid));
      blokusWinnerLabel.textContent = names.join(", ");
    } else {
      blokusWinnerLabel.textContent = "-";
    }
  }
  if (!blokusSelectedOrigin && blokusOriginLabel) {
    blokusOriginLabel.textContent = "-";
  }

  renderBlokusBoard(view);
  renderBlokusPieces(view);
  renderBlokusPlayers(view);
  logGameEvents(data);
  updateBlokusActionButton();
}

if (blokusRotateLeftBtn) {
  blokusRotateLeftBtn.addEventListener("click", () => {
    transformBlokusSelection(blokusRotation - 90, blokusFlip);
  });
}

if (blokusRotateRightBtn) {
  blokusRotateRightBtn.addEventListener("click", () => {
    transformBlokusSelection(blokusRotation + 90, blokusFlip);
  });
}

if (blokusFlipBtn) {
  blokusFlipBtn.addEventListener("click", () => {
    transformBlokusSelection(blokusRotation, !blokusFlip);
  });
}

if (blokusNudgeUpBtn) {
  blokusNudgeUpBtn.addEventListener("click", () => {
    nudgeBlokusOrigin(0, -1);
  });
}

if (blokusNudgeLeftBtn) {
  blokusNudgeLeftBtn.addEventListener("click", () => {
    nudgeBlokusOrigin(-1, 0);
  });
}

if (blokusNudgeDownBtn) {
  blokusNudgeDownBtn.addEventListener("click", () => {
    nudgeBlokusOrigin(0, 1);
  });
}

if (blokusNudgeRightBtn) {
  blokusNudgeRightBtn.addEventListener("click", () => {
    nudgeBlokusOrigin(1, 0);
  });
}

if (blokusBoard) {
  blokusBoard.addEventListener("pointerdown", handleBlokusPointerDown);
  blokusBoard.addEventListener("pointermove", handleBlokusPointerMove);
  blokusBoard.addEventListener("pointerup", handleBlokusPointerUp);
  blokusBoard.addEventListener("pointercancel", handleBlokusPointerUp);
}

document.addEventListener("pointerup", handleBlokusPointerUp);
document.addEventListener("pointercancel", handleBlokusPointerUp);
document.addEventListener("keydown", handleBlokusKeyboardControls);

if (blokusPlaceBtn) {
  blokusPlaceBtn.addEventListener("click", () => {
    if (!currentBlokusView || !Array.isArray(currentBlokusView.legal_actions)) {
      return;
    }
    if (!currentBlokusView.legal_actions.includes("place_piece")) {
      log("Not your turn");
      return;
    }
    if (!blokusSelectedPieceId) {
      log("Select a piece");
      return;
    }
    if (!blokusSelectedOrigin) {
      log("Select an origin cell");
      return;
    }
    sendAction({
      type: "place_piece",
      piece_id: blokusSelectedPieceId,
      rotation: blokusRotation,
      flip: blokusFlip,
      x: blokusSelectedOrigin.x,
      y: blokusSelectedOrigin.y,
    });
    blokusSelectedOrigin = null;
    if (blokusOriginLabel) {
      blokusOriginLabel.textContent = "-";
    }
    if (currentBlokusView) {
      renderBlokusBoard(currentBlokusView);
    }
    updateBlokusActionButton();
  });
}

if (blokusGiveUpBtn) {
  blokusGiveUpBtn.addEventListener("click", () => {
    if (!currentBlokusView || !Array.isArray(currentBlokusView.legal_actions)) {
      return;
    }
    if (!currentBlokusView.legal_actions.includes("give_up")) {
      log("Not your turn");
      return;
    }
    sendAction({ type: "give_up" });
    updateBlokusActionButton();
  });
}

if (blokusHelpBtn) {
  blokusHelpBtn.addEventListener("click", () => {
    exitBlokusExplainMode();
    showBlokusHelpModal();
  });
}

if (blokusExplainBtn) {
  blokusExplainBtn.addEventListener("click", toggleBlokusExplainMode);
}

if (blokusHelpModalCloseBtn) {
  blokusHelpModalCloseBtn.addEventListener("click", closeBlokusHelpModal);
}

if (blokusExplainModalCloseBtn) {
  blokusExplainModalCloseBtn.addEventListener("click", closeBlokusExplainModal);
}

document.addEventListener("pointerdown", (event) => {
  if (!blokusExplainMode) {
    return;
  }

  const buttonId = findBlokusButtonAtPoint(event.clientX, event.clientY);
  if (buttonId) {
    event.preventDefault();
    event.stopPropagation();
    blokusExplainSuppressNextClick = true;
    window.setTimeout(() => {
      blokusExplainSuppressNextClick = false;
    }, 0);
    showBlokusButtonExplanation(buttonId);
    exitBlokusExplainMode();
    return;
  }

  const button = event.target.closest("button");
  if (
    !button
    || button === blokusHelpBtn
    || button === blokusExplainBtn
    || button === blokusHelpModalCloseBtn
    || button === blokusExplainModalCloseBtn
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
}, true);

document.addEventListener("click", (event) => {
  if (blokusExplainSuppressNextClick) {
    blokusExplainSuppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (!blokusExplainMode) {
    return;
  }
  const button = event.target.closest("button");
  if (
    !button
    || button === blokusHelpBtn
    || button === blokusExplainBtn
    || button === blokusHelpModalCloseBtn
    || button === blokusExplainModalCloseBtn
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
}, true);

[blokusHelpModal, blokusExplainModal].forEach((modal) => {
  if (!modal) {
    return;
  }
  modal.addEventListener("click", (event) => {
    if (event.target !== modal) {
      return;
    }
    if (modal === blokusHelpModal) {
      closeBlokusHelpModal();
    } else {
      closeBlokusExplainModal();
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  const helpOpen = blokusHelpModal && !blokusHelpModal.classList.contains("hidden");
  const explanationOpen = blokusExplainModal && !blokusExplainModal.classList.contains("hidden");
  if (!blokusExplainMode && !helpOpen && !explanationOpen) {
    return;
  }
  event.preventDefault();
  exitBlokusExplainMode();
  closeBlokusHelpModal();
  closeBlokusExplainModal();
});
