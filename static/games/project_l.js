const projectLUpgradeModal = document.getElementById("projectLUpgradeModal");
const projectLUpgradeModalCloseBtn = document.getElementById("projectLUpgradeModalCloseBtn");
const projectLUpgradeFromLabel = document.getElementById("projectLUpgradeFromLabel");
const projectLUpgradeOptions = document.getElementById("projectLUpgradeOptions");

const projectLPanel = document.getElementById("projectLPanel");
const projectLPhaseLabel = document.getElementById("projectLPhase");
const projectLApLabel = document.getElementById("projectLAp");
const projectLTurnLabel = document.getElementById("projectLTurn");
const projectLMasterUsedLabel = document.getElementById("projectLMasterUsed");
const projectLWhiteRemainingLabel = document.getElementById("projectLWhiteRemaining");
const projectLBlackRemainingLabel = document.getElementById("projectLBlackRemaining");
const projectLEndTriggeredLabel = document.getElementById("projectLEndTriggered");
const projectLWinnerLabel = document.getElementById("projectLWinner");
const projectLSelectedMarketLabel = document.getElementById("projectLSelectedMarket");
const projectLSelectedPuzzleLabel = document.getElementById("projectLSelectedPuzzle");
const projectLSelectedPieceLabel = document.getElementById("projectLSelectedPiece");
const projectLSelectedOriginLabel = document.getElementById("projectLSelectedOrigin");
const projectLSelectedRotationLabel = document.getElementById("projectLSelectedRotation");
const projectLSelectedFlipLabel = document.getElementById("projectLSelectedFlip");
const projectLRotateLeftBtn = document.getElementById("projectLRotateLeftBtn");
const projectLRotateRightBtn = document.getElementById("projectLRotateRightBtn");
const projectLFlipBtn = document.getElementById("projectLFlipBtn");
const projectLMarketWhite = document.getElementById("projectLMarketWhite");
const projectLMarketBlack = document.getElementById("projectLMarketBlack");
const projectLTakeMarketBtn = document.getElementById("projectLTakeMarketBtn");
const projectLDrawWhiteBtn = document.getElementById("projectLDrawWhiteBtn");
const projectLDrawBlackBtn = document.getElementById("projectLDrawBlackBtn");
const projectLTakeLevel1Btn = document.getElementById("projectLTakeLevel1Btn");
const projectLActivePuzzles = document.getElementById("projectLActivePuzzles");
const projectLCompletedPuzzles = document.getElementById("projectLCompletedPuzzles");
const projectLInventory = document.getElementById("projectLInventory");
const projectLUpgradeFromSelect = document.getElementById("projectLUpgradeFrom");
const projectLUpgradeBtn = document.getElementById("projectLUpgradeBtn");
const projectLPlaceBtn = document.getElementById("projectLPlaceBtn");
const projectLQueueMasterBtn = document.getElementById("projectLQueueMasterBtn");
const projectLClearMasterBtn = document.getElementById("projectLClearMasterBtn");
const projectLUseMasterBtn = document.getElementById("projectLUseMasterBtn");
const projectLMasterQueue = document.getElementById("projectLMasterQueue");
const projectLFinishingPlaceBtn = document.getElementById("projectLFinishingPlaceBtn");
const projectLFinishingDoneBtn = document.getElementById("projectLFinishingDoneBtn");
const projectLPlayers = document.getElementById("projectLPlayers");

let currentProjectLView = null;

let projectLSelectedMarket = null;
let projectLSelectedPuzzleIndex = null;
let projectLSelectedPieceId = null;
let projectLSelectedOrigin = null;
let projectLRotation = 0;
let projectLFlip = false;
let projectLMasterQueueItems = [];
let projectLLastMarketTap = null;
let projectLLastMarketTakeAt = 0;

function closeProjectLUpgradeModal() {
  setModalVisible(projectLUpgradeModal, false);
}

function renderProjectLUpgradeModal(view) {
  if (!projectLUpgradeOptions || !projectLUpgradeFromLabel) {
    return;
  }
  projectLUpgradeOptions.innerHTML = "";
  const fromPiece = getProjectLUpgradeFrom(view);
  if (!fromPiece) {
    projectLUpgradeFromLabel.textContent = "Select a piece from Inventory first.";
    return;
  }
  projectLUpgradeFromLabel.textContent = `From: ${fromPiece}`;
  const pieceDefs = view && view.piece_defs ? view.piece_defs : {};
  const allPieces = Object.keys(pieceDefs).sort((a, b) => {
    const la = pieceDefs[a].level;
    const lb = pieceDefs[b].level;
    if (la !== lb) {
      return la - lb;
    }
    return a.localeCompare(b);
  });
  allPieces.forEach((pieceId) => {
    const pieceDef = pieceDefs[pieceId];
    const canUpgrade = projectLCanUpgrade(pieceDefs, fromPiece, pieceId);
    const option = document.createElement("button");
    option.type = "button";
    option.className = "project-l-upgrade-piece";
    if (!canUpgrade) {
      option.classList.add("disabled");
      option.disabled = true;
    }
    const grid = document.createElement("div");
    grid.className = "project-l-upgrade-piece-grid";
    grid.style.gridTemplateColumns = `repeat(${pieceDef.shape[0].length}, 14px)`;
    grid.style.gridAutoRows = "14px";
    pieceDef.shape.forEach((row) => {
      row.forEach((value) => {
        if (!value) {
          const spacer = document.createElement("div");
          spacer.style.width = "14px";
          spacer.style.height = "14px";
          grid.appendChild(spacer);
          return;
        }
        const cell = document.createElement("div");
        cell.className = "project-l-upgrade-piece-cell";
        if (pieceDef.color) {
          cell.style.background = pieceDef.color;
        }
        grid.appendChild(cell);
      });
    });
    option.appendChild(grid);
    const label = document.createElement("div");
    label.className = "project-l-piece-label";
    label.textContent = pieceId;
    option.appendChild(label);
    if (canUpgrade) {
      option.addEventListener("click", () => {
        sendAction({ type: "upgrade_piece", from_piece_id: fromPiece, to_piece_id: pieceId });
        closeProjectLUpgradeModal();
      });
    }
    projectLUpgradeOptions.appendChild(option);
  });
}

function openProjectLUpgradeModal(view) {
  if (!projectLUpgradeModal || !view) {
    return;
  }
  renderProjectLUpgradeModal(view);
  setModalVisible(projectLUpgradeModal, true);
}

function clearProjectLState() {
  currentProjectLView = null;
  projectLSelectedMarket = null;
  projectLSelectedPuzzleIndex = null;
  projectLSelectedPieceId = null;
  projectLSelectedOrigin = null;
  projectLRotation = 0;
  projectLFlip = false;
  projectLMasterQueueItems = [];
  if (projectLPhaseLabel) {
    projectLPhaseLabel.textContent = "-";
  }
  if (projectLApLabel) {
    projectLApLabel.textContent = "-";
  }
  if (projectLTurnLabel) {
    projectLTurnLabel.textContent = "-";
  }
  if (projectLMasterUsedLabel) {
    projectLMasterUsedLabel.textContent = "-";
  }
  if (projectLWhiteRemainingLabel) {
    projectLWhiteRemainingLabel.textContent = "-";
  }
  if (projectLBlackRemainingLabel) {
    projectLBlackRemainingLabel.textContent = "-";
  }
  if (projectLEndTriggeredLabel) {
    projectLEndTriggeredLabel.textContent = "-";
  }
  if (projectLWinnerLabel) {
    projectLWinnerLabel.textContent = "-";
  }
  if (projectLSelectedMarketLabel) {
    projectLSelectedMarketLabel.textContent = "-";
  }
  if (projectLSelectedPuzzleLabel) {
    projectLSelectedPuzzleLabel.textContent = "-";
  }
  if (projectLSelectedPieceLabel) {
    projectLSelectedPieceLabel.textContent = "-";
  }
  if (projectLSelectedOriginLabel) {
    projectLSelectedOriginLabel.textContent = "-";
  }
  if (projectLSelectedRotationLabel) {
    projectLSelectedRotationLabel.textContent = "0";
  }
  if (projectLSelectedFlipLabel) {
    projectLSelectedFlipLabel.textContent = "No";
  }
  if (projectLMarketWhite) {
    projectLMarketWhite.innerHTML = "";
  }
  if (projectLMarketBlack) {
    projectLMarketBlack.innerHTML = "";
  }
  if (projectLActivePuzzles) {
    projectLActivePuzzles.innerHTML = "";
  }
  if (projectLCompletedPuzzles) {
    projectLCompletedPuzzles.innerHTML = "";
  }
  if (projectLInventory) {
    projectLInventory.innerHTML = "";
  }
  if (projectLUpgradeFromSelect) {
    projectLUpgradeFromSelect.innerHTML = "";
  }
  if (projectLMasterQueue) {
    projectLMasterQueue.innerHTML = "";
  }
  if (projectLPlayers) {
    projectLPlayers.innerHTML = "";
  }
  updateProjectLActionButtons();
}

function getProjectLYou(view) {
  if (!view) {
    return null;
  }
  return (view.players || []).find((player) => player.player_id === view.you) || null;
}

function projectLRotateMatrix(matrix) {
  if (!Array.isArray(matrix) || !matrix.length) {
    return [];
  }
  const height = matrix.length;
  const width = matrix[0].length;
  const rotated = Array.from({ length: width }, () => Array.from({ length: height }, () => 0));
  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width; c += 1) {
      rotated[c][height - 1 - r] = matrix[r][c];
    }
  }
  return rotated;
}

function projectLFlipMatrix(matrix) {
  return matrix.map((row) => row.slice().reverse());
}

function projectLTransformMatrix(matrix, rotation, flip) {
  let transformed = matrix;
  if (flip) {
    transformed = projectLFlipMatrix(transformed);
  }
  const turns = ((rotation % 360) + 360) % 360 / 90;
  for (let i = 0; i < turns; i += 1) {
    transformed = projectLRotateMatrix(transformed);
  }
  return transformed;
}

function projectLMatrixCells(matrix) {
  const cells = [];
  if (!Array.isArray(matrix)) {
    return cells;
  }
  matrix.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value) {
        cells.push([r, c]);
      }
    });
  });
  return cells;
}

function projectLPlacementCells(pieceDef, rotation, flip, row, col) {
  if (!pieceDef || !Array.isArray(pieceDef.shape)) {
    return [];
  }
  const transformed = projectLTransformMatrix(pieceDef.shape, rotation, flip);
  return projectLMatrixCells(transformed).map(([r, c]) => [row + r, col + c]);
}

function projectLOccupiedCells(puzzleState, pieceDefs) {
  const occupied = new Map();
  if (!puzzleState || !Array.isArray(puzzleState.placed)) {
    return occupied;
  }
  puzzleState.placed.forEach((placement) => {
    const def = pieceDefs ? pieceDefs[placement.piece_id] : null;
    if (!def) {
      return;
    }
    const cells = projectLPlacementCells(
      def,
      placement.rotation,
      placement.flip,
      placement.row,
      placement.col,
    );
    cells.forEach(([r, c]) => {
      occupied.set(`${r},${c}`, placement.piece_id);
    });
  });
  return occupied;
}

function projectLValidatePlacement(view, puzzleIndex, pieceId, rotation, flip, row, col) {
  const you = getProjectLYou(view);
  if (!you) {
    return { ok: false, reason: "no player" };
  }
  if (!Number.isInteger(puzzleIndex) || puzzleIndex < 0 || puzzleIndex >= you.active_puzzles.length) {
    return { ok: false, reason: "invalid puzzle" };
  }
  const puzzleState = you.active_puzzles[puzzleIndex];
  const puzzleDef = view.puzzle_defs ? view.puzzle_defs[puzzleState.card_id] : null;
  const pieceDef = view.piece_defs ? view.piece_defs[pieceId] : null;
  if (!puzzleDef || !pieceDef) {
    return { ok: false, reason: "missing data" };
  }
  if (![0, 90, 180, 270].includes(rotation)) {
    return { ok: false, reason: "invalid rotation" };
  }
  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return { ok: false, reason: "invalid origin" };
  }
  const transformed = projectLTransformMatrix(pieceDef.shape, rotation, flip);
  const height = transformed.length;
  const width = height ? transformed[0].length : 0;
  if (row < 0 || col < 0 || row + height > puzzleDef.height || col + width > puzzleDef.width) {
    return { ok: false, reason: "out of bounds", cells: projectLMatrixCells(transformed).map(([r, c]) => [row + r, col + c]) };
  }
  const occupied = projectLOccupiedCells(puzzleState, view.piece_defs);
  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width; c += 1) {
      if (!transformed[r][c]) {
        continue;
      }
      const gr = row + r;
      const gc = col + c;
      if (!puzzleDef.grid[gr] || puzzleDef.grid[gr][gc] !== 1) {
        return { ok: false, reason: "invalid cell" };
      }
      if (occupied.has(`${gr},${gc}`)) {
        return { ok: false, reason: "occupied" };
      }
    }
  }
  return { ok: true, puzzleState, puzzleDef };
}

function projectLGetSelectedPlacement(view) {
  if (!view || !Number.isInteger(projectLSelectedPuzzleIndex)) {
    return null;
  }
  if (!projectLSelectedPieceId || !projectLSelectedOrigin) {
    return null;
  }
  const you = getProjectLYou(view);
  if (!you || !you.inventory.includes(projectLSelectedPieceId)) {
    return { ok: false, reason: "missing piece" };
  }
  const rotation = ((projectLRotation % 360) + 360) % 360;
  const flip = !!projectLFlip;
  const row = projectLSelectedOrigin.row;
  const col = projectLSelectedOrigin.col;
  const result = projectLValidatePlacement(view, projectLSelectedPuzzleIndex, projectLSelectedPieceId, rotation, flip, row, col);
  return {
    ok: result.ok,
    reason: result.reason,
    puzzle_index: projectLSelectedPuzzleIndex,
    piece_id: projectLSelectedPieceId,
    rotation,
    flip,
    row,
    col,
  };
}

function projectLInventoryCounts(inventory) {
  const counts = {};
  (inventory || []).forEach((pieceId) => {
    counts[pieceId] = (counts[pieceId] || 0) + 1;
  });
  return counts;
}

function projectLCanUpgrade(pieceDefs, fromPiece, toPiece) {
  if (!pieceDefs || !pieceDefs[fromPiece] || !pieceDefs[toPiece]) {
    return false;
  }
  if (fromPiece === toPiece) {
    return false;
  }
  const fromLevel = pieceDefs[fromPiece].level;
  const toLevel = pieceDefs[toPiece].level;
  if (fromLevel === 4) {
    return toLevel === 4;
  }
  if (toLevel === fromLevel + 1) {
    return true;
  }
  if (toLevel === fromLevel && fromLevel >= 3) {
    return true;
  }
  return false;
}

function updateProjectLSelectionLabels(view) {
  const activeView = view || currentProjectLView;
  const you = getProjectLYou(activeView);
  if (projectLSelectedMarketLabel) {
    if (projectLSelectedMarket) {
      let suffix = "";
      if (activeView && activeView.market && activeView.market[projectLSelectedMarket.deck]) {
        const cardId = activeView.market[projectLSelectedMarket.deck][projectLSelectedMarket.index];
        if (cardId) {
          suffix = ` (#${cardId})`;
        }
      }
      projectLSelectedMarketLabel.textContent = `${projectLSelectedMarket.deck} ${projectLSelectedMarket.index + 1}${suffix}`;
    } else {
      projectLSelectedMarketLabel.textContent = "-";
    }
  }
  if (projectLSelectedPuzzleLabel) {
    if (you && Number.isInteger(projectLSelectedPuzzleIndex) && you.active_puzzles[projectLSelectedPuzzleIndex]) {
      const cardId = you.active_puzzles[projectLSelectedPuzzleIndex].card_id;
      projectLSelectedPuzzleLabel.textContent = `#${cardId}`;
    } else {
      projectLSelectedPuzzleLabel.textContent = "-";
    }
  }
  if (projectLSelectedPieceLabel) {
    projectLSelectedPieceLabel.textContent = projectLSelectedPieceId || "-";
  }
  if (projectLSelectedOriginLabel) {
    if (projectLSelectedOrigin) {
      projectLSelectedOriginLabel.textContent = `${projectLSelectedOrigin.row}, ${projectLSelectedOrigin.col}`;
    } else {
      projectLSelectedOriginLabel.textContent = "-";
    }
  }
  if (projectLSelectedRotationLabel) {
    projectLSelectedRotationLabel.textContent = `${((projectLRotation % 360) + 360) % 360}`;
  }
  if (projectLSelectedFlipLabel) {
    projectLSelectedFlipLabel.textContent = projectLFlip ? "Yes" : "No";
  }
}

function syncProjectLSelections(view) {
  if (!view) {
    projectLSelectedMarket = null;
    projectLSelectedPuzzleIndex = null;
    projectLSelectedPieceId = null;
    projectLSelectedOrigin = null;
    projectLMasterQueueItems = [];
    return;
  }
  const you = getProjectLYou(view);
  if (!you) {
    return;
  }
  if (Number.isInteger(projectLSelectedPuzzleIndex)) {
    if (!you.active_puzzles[projectLSelectedPuzzleIndex]) {
      projectLSelectedPuzzleIndex = null;
      projectLSelectedOrigin = null;
    }
  }
  if (projectLSelectedPieceId && !you.inventory.includes(projectLSelectedPieceId)) {
    projectLSelectedPieceId = null;
    projectLSelectedOrigin = null;
  }
  if (projectLSelectedOrigin && Number.isInteger(projectLSelectedPuzzleIndex)) {
    const puzzleState = you.active_puzzles[projectLSelectedPuzzleIndex];
    const puzzleDef = puzzleState && view.puzzle_defs ? view.puzzle_defs[puzzleState.card_id] : null;
    if (
      !puzzleDef
      || projectLSelectedOrigin.row < 0
      || projectLSelectedOrigin.col < 0
      || projectLSelectedOrigin.row >= puzzleDef.height
      || projectLSelectedOrigin.col >= puzzleDef.width
    ) {
      projectLSelectedOrigin = null;
    }
  }
  if (projectLSelectedMarket) {
    const deck = view.market ? view.market[projectLSelectedMarket.deck] : null;
    if (!deck || deck[projectLSelectedMarket.index] == null) {
      projectLSelectedMarket = null;
    }
  }
  projectLMasterQueueItems = projectLMasterQueueItems.filter((placement) => {
    if (!Number.isInteger(placement.puzzle_index)) {
      return false;
    }
    if (!you.active_puzzles[placement.puzzle_index]) {
      return false;
    }
    return you.inventory.includes(placement.piece_id);
  });
}

function getProjectLUpgradeFrom(view) {
  if (projectLUpgradeFromSelect) {
    return projectLUpgradeFromSelect.value || null;
  }
  const you = getProjectLYou(view);
  if (!you) {
    return null;
  }
  if (projectLSelectedPieceId && you.inventory.includes(projectLSelectedPieceId)) {
    return projectLSelectedPieceId;
  }
  return null;
}

function projectLTakeMarketCard(deckName, index) {
  if (!currentProjectLView) {
    return;
  }
  if (!isProjectLActionAvailable("take_puzzle")) {
    log("Not your turn");
    return;
  }
  const now = Date.now();
  if (now - projectLLastMarketTakeAt < 350) {
    return;
  }
  projectLLastMarketTakeAt = now;
  sendAction({ type: "take_puzzle", source: "market", deck: deckName, index });
  projectLSelectedMarket = null;
  projectLLastMarketTap = null;
  updateProjectLSelectionLabels();
  if (currentProjectLView) {
    renderProjectLMarket(currentProjectLView);
  }
  updateProjectLActionButtons();
}


function setProjectLSelectedMarket(deck, index) {
  projectLSelectedMarket = { deck, index };
  updateProjectLSelectionLabels();
  if (currentProjectLView) {
    renderProjectLMarket(currentProjectLView);
  }
  updateProjectLActionButtons();
}

function setProjectLSelectedPuzzle(index) {
  projectLSelectedPuzzleIndex = index;
  projectLSelectedOrigin = null;
  updateProjectLSelectionLabels();
  if (currentProjectLView) {
    renderProjectLActivePuzzles(currentProjectLView);
  }
  updateProjectLActionButtons();
}

function setProjectLSelectedPiece(pieceId) {
  projectLSelectedPieceId = pieceId;
  projectLSelectedOrigin = null;
  updateProjectLSelectionLabels();
  if (currentProjectLView) {
    renderProjectLInventory(currentProjectLView);
    renderProjectLActivePuzzles(currentProjectLView);
  }
  updateProjectLActionButtons();
}

function setProjectLSelectedOrigin(row, col) {
  projectLSelectedOrigin = { row, col };
  updateProjectLSelectionLabels();
  if (currentProjectLView) {
    renderProjectLActivePuzzles(currentProjectLView);
  }
  updateProjectLActionButtons();
}

function setProjectLSelectedPuzzleAndOrigin(index, row, col) {
  projectLSelectedPuzzleIndex = index;
  projectLSelectedOrigin = { row, col };
  updateProjectLSelectionLabels();
  if (currentProjectLView) {
    renderProjectLActivePuzzles(currentProjectLView);
  }
  updateProjectLActionButtons();
}

function clearProjectLSelection() {
  projectLSelectedMarket = null;
  projectLSelectedPuzzleIndex = null;
  projectLSelectedPieceId = null;
  projectLSelectedOrigin = null;
  projectLRotation = 0;
  projectLFlip = false;
  projectLLastMarketTap = null;
  updateProjectLSelectionLabels();
  if (currentProjectLView) {
    renderProjectLMarket(currentProjectLView);
    renderProjectLInventory(currentProjectLView);
    renderProjectLActivePuzzles(currentProjectLView);
  }
  updateProjectLActionButtons();
}

function buildProjectLReward(pieceId, pieceDefs, cellSize, labelPrefix) {
  const wrapper = document.createElement("div");
  wrapper.className = "project-l-reward-row";
  const label = document.createElement("div");
  label.className = "project-l-reward-label";
  label.textContent = labelPrefix ? `${labelPrefix} ${pieceId}` : pieceId;
  wrapper.appendChild(label);

  const pieceDef = pieceDefs ? pieceDefs[pieceId] : null;
  if (!pieceDef) {
    return wrapper;
  }
  const grid = document.createElement("div");
  grid.className = "project-l-reward-piece";
  grid.style.gridTemplateColumns = `repeat(${pieceDef.shape[0].length}, ${cellSize}px)`;
  grid.style.gridAutoRows = `${cellSize}px`;
  pieceDef.shape.forEach((row) => {
    row.forEach((value) => {
      if (!value) {
        const spacer = document.createElement("div");
        spacer.style.width = `${cellSize}px`;
        spacer.style.height = `${cellSize}px`;
        grid.appendChild(spacer);
        return;
      }
      const cell = document.createElement("div");
      cell.className = "project-l-reward-cell";
      if (pieceDef.color) {
        cell.style.background = pieceDef.color;
      }
      grid.appendChild(cell);
    });
  });
  wrapper.appendChild(grid);
  return wrapper;
}

function buildProjectLCard(cardDef, pieceDefs) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "project-l-card";
  if (!cardDef) {
    card.classList.add("disabled");
    card.disabled = true;
    card.textContent = "Empty";
    return card;
  }
  const header = document.createElement("div");
  header.className = "project-l-card-header";
  const idLabel = document.createElement("div");
  idLabel.textContent = `#${cardDef.id}`;
  const points = document.createElement("div");
  points.textContent = `${cardDef.points} pts`;
  header.appendChild(idLabel);
  header.appendChild(points);
  card.appendChild(header);

  const reward = buildProjectLReward(cardDef.reward_piece_id, pieceDefs, 8, "Reward:");
  reward.classList.add("project-l-card-meta");
  card.appendChild(reward);

  const imageWrap = document.createElement("div");
  imageWrap.className = "project-l-card-image-wrap";
  const image = document.createElement("img");
  image.className = "project-l-card-image";
  const cardId = String(cardDef.id).padStart(2, "0");
  image.src = `/static/project_l/project_l_puzzles_svg/card_${cardId}.svg`;
  image.alt = `Puzzle ${cardDef.id}`;
  const cellSize = 12;
  const imageWidth = cardDef.width * cellSize;
  const imageHeight = cardDef.height * cellSize;
  imageWrap.style.width = `${imageWidth}px`;
  imageWrap.style.height = `${imageHeight}px`;
  imageWrap.style.setProperty("--project-l-card-cell", `${cellSize}px`);
  image.style.width = "100%";
  image.style.height = "100%";
  imageWrap.appendChild(image);
  card.appendChild(imageWrap);
  return card;
}

function renderProjectLMarket(view) {
  const renderDeck = (container, deckName) => {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    const cards = (view.market && view.market[deckName]) || [];
    cards.forEach((cardId, index) => {
      const def = view.puzzle_defs ? view.puzzle_defs[cardId] : null;
      const card = buildProjectLCard(def, view.piece_defs);
      if (projectLSelectedMarket && projectLSelectedMarket.deck === deckName && projectLSelectedMarket.index === index) {
        card.classList.add("selected");
      }
      if (!card.disabled) {
        card.addEventListener("click", () => {
          const now = Date.now();
          const alreadySelected = projectLSelectedMarket
            && projectLSelectedMarket.deck === deckName
            && projectLSelectedMarket.index === index;
          const isDoubleTap = projectLLastMarketTap
            && projectLLastMarketTap.deck === deckName
            && projectLLastMarketTap.index === index
            && now - projectLLastMarketTap.time < 350;
          if (alreadySelected || isDoubleTap) {
            projectLLastMarketTap = null;
            projectLTakeMarketCard(deckName, index);
            return;
          }
          projectLLastMarketTap = { deck: deckName, index, time: now };
          setProjectLSelectedMarket(deckName, index);
        });
        card.addEventListener("dblclick", () => {
          projectLTakeMarketCard(deckName, index);
        });
      }
      container.appendChild(card);
    });
    if (!cards.length) {
      const empty = document.createElement("div");
      empty.className = "project-l-card disabled";
      empty.textContent = "Empty";
      container.appendChild(empty);
    }
  };

  renderDeck(projectLMarketWhite, "white");
  renderDeck(projectLMarketBlack, "black");
}

function renderProjectLPuzzleGrid(puzzleDef, puzzleState, puzzleIndex, options) {
  const grid = document.createElement("div");
  grid.className = "project-l-puzzle-grid";
  const cellSize = 20;
  grid.style.setProperty("--project-l-cell", `${cellSize}px`);
  grid.style.width = `${puzzleDef.width * cellSize}px`;
  grid.style.height = `${puzzleDef.height * cellSize}px`;
  const cardId = String(puzzleDef.id).padStart(2, "0");
  const image = document.createElement("img");
  image.className = "project-l-puzzle-image";
  image.src = `/static/project_l/project_l_puzzles_svg/card_${cardId}.svg`;
  image.alt = `Puzzle ${puzzleDef.id}`;
  grid.appendChild(image);

  const overlay = document.createElement("div");
  overlay.className = "project-l-puzzle-overlay";
  grid.appendChild(overlay);

  const occupied = projectLOccupiedCells(puzzleState, currentProjectLView ? currentProjectLView.piece_defs : null);
  const ghostCells = options && options.ghostCells ? options.ghostCells : null;
  const ghostInvalid = options && options.ghostInvalid;

  for (let r = 0; r < puzzleDef.height; r += 1) {
    for (let c = 0; c < puzzleDef.width; c += 1) {
      const cell = document.createElement("div");
      cell.className = "project-l-cell";
      cell.style.setProperty("--row", r);
      cell.style.setProperty("--col", c);
      if (puzzleDef.grid[r][c] === 1) {
        cell.classList.add("slot");
      } else {
        cell.classList.add("off");
      }
      const key = `${r},${c}`;
      if (occupied.has(key)) {
        const pieceId = occupied.get(key);
        const def = currentProjectLView && currentProjectLView.piece_defs
          ? currentProjectLView.piece_defs[pieceId]
          : null;
        if (def && def.color) {
          cell.style.background = def.color;
        } else {
          cell.style.background = "#111827";
        }
      }
      if (ghostCells && ghostCells.has(key)) {
        cell.classList.add("ghost");
        if (ghostInvalid) {
          cell.classList.add("invalid");
        }
      }
      if (puzzleDef.grid[r][c] === 1) {
        cell.addEventListener("click", (event) => {
          event.stopPropagation();
          setProjectLSelectedPuzzleAndOrigin(puzzleIndex, r, c);
        });
      }
      overlay.appendChild(cell);
    }
  }
  return grid;
}

function renderProjectLActivePuzzles(view) {
  if (!projectLActivePuzzles) {
    return;
  }
  const you = getProjectLYou(view);
  projectLActivePuzzles.innerHTML = "";
  if (!you || !Array.isArray(you.active_puzzles) || !you.active_puzzles.length) {
    const empty = document.createElement("div");
    empty.textContent = "No active puzzles.";
    projectLActivePuzzles.appendChild(empty);
    return;
  }
  you.active_puzzles.forEach((puzzleState, index) => {
    const puzzleDef = view.puzzle_defs ? view.puzzle_defs[puzzleState.card_id] : null;
    if (!puzzleDef) {
      return;
    }
    const card = document.createElement("div");
    card.className = "project-l-puzzle-card";
    if (projectLSelectedPuzzleIndex === index) {
      card.classList.add("selected");
    }
    card.addEventListener("click", () => {
      setProjectLSelectedPuzzle(index);
    });

    const header = document.createElement("div");
    header.className = "project-l-card-header";
    header.textContent = `#${puzzleDef.id} - ${puzzleDef.points} pts`;
    card.appendChild(header);

    const reward = buildProjectLReward(puzzleDef.reward_piece_id, view.piece_defs, 10, "Reward:");
    reward.classList.add("project-l-card-meta");
    card.appendChild(reward);

    let ghostCells = null;
    let ghostInvalid = false;
    if (
      Number.isInteger(projectLSelectedPuzzleIndex)
      && projectLSelectedPuzzleIndex === index
      && projectLSelectedPieceId
      && projectLSelectedOrigin
    ) {
      const pieceDef = view.piece_defs ? view.piece_defs[projectLSelectedPieceId] : null;
      if (pieceDef) {
        const transformed = projectLTransformMatrix(pieceDef.shape, projectLRotation, projectLFlip);
        const cells = projectLMatrixCells(transformed).map(([r, c]) => [
          projectLSelectedOrigin.row + r,
          projectLSelectedOrigin.col + c,
        ]);
        ghostCells = new Set();
        cells.forEach(([r, c]) => {
          if (r >= 0 && c >= 0 && r < puzzleDef.height && c < puzzleDef.width) {
            ghostCells.add(`${r},${c}`);
          }
        });
        const validation = projectLValidatePlacement(
          view,
          projectLSelectedPuzzleIndex,
          projectLSelectedPieceId,
          projectLRotation,
          projectLFlip,
          projectLSelectedOrigin.row,
          projectLSelectedOrigin.col,
        );
        ghostInvalid = !validation.ok;
      }
    }

    const grid = renderProjectLPuzzleGrid(puzzleDef, puzzleState, index, { ghostCells, ghostInvalid });
    card.appendChild(grid);
    projectLActivePuzzles.appendChild(card);
  });
}

function renderProjectLCompleted(view) {
  if (!projectLCompletedPuzzles) {
    return;
  }
  projectLCompletedPuzzles.innerHTML = "";
  const you = getProjectLYou(view);
  const completed = you ? you.completed_puzzles : [];
  if (!completed || !completed.length) {
    projectLCompletedPuzzles.textContent = "-";
    return;
  }
  completed.forEach((cardId) => {
    const chip = document.createElement("div");
    chip.className = "project-l-completed-chip";
    chip.textContent = `#${cardId}`;
    projectLCompletedPuzzles.appendChild(chip);
  });
}

function renderProjectLInventory(view) {
  if (!projectLInventory) {
    return;
  }
  projectLInventory.innerHTML = "";
  const you = getProjectLYou(view);
  if (!you || !Array.isArray(you.inventory) || !you.inventory.length) {
    const empty = document.createElement("div");
    empty.textContent = "No pieces.";
    projectLInventory.appendChild(empty);
    return;
  }
  const counts = projectLInventoryCounts(you.inventory);
  const queueCounts = projectLInventoryCounts(projectLMasterQueueItems.map((entry) => entry.piece_id));
  const pieceIds = Object.keys(counts).sort((a, b) => {
    const la = view.piece_defs[a].level;
    const lb = view.piece_defs[b].level;
    if (la !== lb) {
      return la - lb;
    }
    return a.localeCompare(b);
  });
  pieceIds.forEach((pieceId) => {
    const pieceDef = view.piece_defs[pieceId];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-l-piece";
    if (projectLSelectedPieceId === pieceId) {
      button.classList.add("selected");
    }
    button.addEventListener("click", () => {
      setProjectLSelectedPiece(pieceId);
    });

    const grid = document.createElement("div");
    grid.className = "project-l-piece-grid";
    grid.style.gridTemplateColumns = `repeat(${pieceDef.shape[0].length}, 10px)`;
    grid.style.gridAutoRows = "10px";
    pieceDef.shape.forEach((row, r) => {
      row.forEach((value, c) => {
        if (!value) {
          const spacer = document.createElement("div");
          spacer.style.width = "10px";
          spacer.style.height = "10px";
          grid.appendChild(spacer);
          return;
        }
        const cell = document.createElement("div");
        cell.className = "project-l-piece-cell";
        if (pieceDef.color) {
          cell.style.background = pieceDef.color;
        }
        grid.appendChild(cell);
      });
    });
    button.appendChild(grid);

    const label = document.createElement("div");
    label.className = "project-l-piece-label";
    label.textContent = pieceId;
    button.appendChild(label);

    const count = document.createElement("div");
    count.className = "project-l-piece-count";
    count.textContent = `x${counts[pieceId]}`;
    button.appendChild(count);

    const remaining = Math.max(0, counts[pieceId] - (queueCounts[pieceId] || 0));
    const remainingLine = document.createElement("div");
    remainingLine.className = "project-l-piece-remaining";
    remainingLine.textContent = `left ${remaining}`;
    button.appendChild(remainingLine);

    projectLInventory.appendChild(button);
  });
}

function renderProjectLMasterQueue(view) {
  if (!projectLMasterQueue) {
    return;
  }
  projectLMasterQueue.innerHTML = "";
  if (!projectLMasterQueueItems.length) {
    projectLMasterQueue.textContent = "-";
    return;
  }
  const you = getProjectLYou(view);
  projectLMasterQueueItems.forEach((placement, index) => {
    const item = document.createElement("div");
    item.className = "project-l-queue-item";
    const label = document.createElement("div");
    let cardLabel = "";
    if (you && you.active_puzzles && you.active_puzzles[placement.puzzle_index]) {
      cardLabel = ` (#${you.active_puzzles[placement.puzzle_index].card_id})`;
    }
    label.textContent = `P${placement.puzzle_index + 1}${cardLabel} ${placement.piece_id} @ ${placement.row},${placement.col} r${placement.rotation} ${placement.flip ? "flip" : ""}`;
    item.appendChild(label);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "project-l-queue-remove";
    remove.textContent = "x";
    remove.addEventListener("click", () => {
      projectLMasterQueueItems.splice(index, 1);
      renderProjectLMasterQueue(view);
      renderProjectLInventory(view);
      updateProjectLActionButtons();
    });
    item.appendChild(remove);
    projectLMasterQueue.appendChild(item);
  });
}

function renderProjectLPlayers(view) {
  if (!projectLPlayers) {
    return;
  }
  projectLPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id;
    header.appendChild(name);
    const badges = document.createElement("div");
    badges.className = "player-badges";
    const score = document.createElement("span");
    score.className = "badge";
    score.textContent = `score ${player.score ?? 0}`;
    badges.appendChild(score);
    const completed = document.createElement("span");
    completed.className = "badge";
    completed.textContent = `completed ${player.completed_puzzles ? player.completed_puzzles.length : 0}`;
    badges.appendChild(completed);
    const inventory = document.createElement("span");
    inventory.className = "badge";
    inventory.textContent = `pieces ${player.inventory ? player.inventory.length : 0}`;
    badges.appendChild(inventory);
    if (Number.isInteger(player.finishing_placed)) {
      const penalty = document.createElement("span");
      penalty.className = "badge";
      penalty.textContent = `penalty ${player.finishing_placed}`;
      badges.appendChild(penalty);
    }
    if (player.finishing_done) {
      const done = document.createElement("span");
      done.className = "badge";
      done.textContent = "done";
      badges.appendChild(done);
    }
    if (player.is_bot) {
      const bot = document.createElement("span");
      bot.className = "badge";
      bot.textContent = "bot";
      badges.appendChild(bot);
    }
    if (player.player_id === view.you) {
      const youBadge = document.createElement("span");
      youBadge.className = "badge highlight";
      youBadge.textContent = "you";
      badges.appendChild(youBadge);
    }
    header.appendChild(badges);
    card.appendChild(header);
    projectLPlayers.appendChild(card);
  });
}

function isProjectLActionAvailable(actionType) {
  if (!currentProjectLView || !Array.isArray(currentProjectLView.legal_actions)) {
    return false;
  }
  return currentProjectLView.legal_actions.includes(actionType);
}

function updateProjectLActionButtons() {
  const view = currentProjectLView;
  if (!view) {
    return;
  }
  const selection = projectLGetSelectedPlacement(view);
  const canPlace = selection && selection.ok;

  if (projectLTakeLevel1Btn) {
    const allowed = isProjectLActionAvailable("take_level1");
    projectLTakeLevel1Btn.disabled = !allowed;
    projectLTakeLevel1Btn.classList.toggle("action-allowed", allowed);
  }
  if (projectLTakeMarketBtn) {
    const allowed = isProjectLActionAvailable("take_puzzle") && !!projectLSelectedMarket;
    projectLTakeMarketBtn.disabled = !allowed;
    projectLTakeMarketBtn.classList.toggle("action-allowed", allowed);
  }
  if (projectLDrawWhiteBtn) {
    const allowed = isProjectLActionAvailable("take_puzzle") && view.white_remaining > 0;
    projectLDrawWhiteBtn.disabled = !allowed;
    projectLDrawWhiteBtn.classList.toggle("action-allowed", allowed);
  }
  if (projectLDrawBlackBtn) {
    const allowed = isProjectLActionAvailable("take_puzzle") && view.black_remaining > 0;
    projectLDrawBlackBtn.disabled = !allowed;
    projectLDrawBlackBtn.classList.toggle("action-allowed", allowed);
  }
  if (projectLUpgradeBtn) {
    const fromPiece = getProjectLUpgradeFrom(view);
    const hasPiece = !!fromPiece;
    const canUpgradeNow = isProjectLActionAvailable("upgrade_piece") && hasPiece;
    projectLUpgradeBtn.disabled = !hasPiece;
    projectLUpgradeBtn.classList.toggle("action-allowed", canUpgradeNow);
  }
  if (projectLPlaceBtn) {
    const allowed = isProjectLActionAvailable("place_piece") && canPlace;
    projectLPlaceBtn.disabled = !allowed;
    projectLPlaceBtn.classList.toggle("action-allowed", allowed);
  }
  if (projectLQueueMasterBtn) {
    const allowed = isProjectLActionAvailable("master_action") && canPlace;
    projectLQueueMasterBtn.disabled = !allowed;
    projectLQueueMasterBtn.classList.toggle("action-allowed", allowed);
  }
  if (projectLClearMasterBtn) {
    const allowed = projectLMasterQueueItems.length > 0;
    projectLClearMasterBtn.disabled = !allowed;
    projectLClearMasterBtn.classList.toggle("action-allowed", allowed);
  }
  if (projectLUseMasterBtn) {
    let allowed = isProjectLActionAvailable("master_action") && projectLMasterQueueItems.length > 0;
    if (allowed) {
      const you = getProjectLYou(view);
      const counts = projectLInventoryCounts(you ? you.inventory : []);
      const queueCounts = projectLInventoryCounts(projectLMasterQueueItems.map((entry) => entry.piece_id));
      Object.keys(queueCounts).forEach((pieceId) => {
        if ((counts[pieceId] || 0) < queueCounts[pieceId]) {
          allowed = false;
        }
      });
      projectLMasterQueueItems.forEach((entry) => {
        const validation = projectLValidatePlacement(
          view,
          entry.puzzle_index,
          entry.piece_id,
          entry.rotation,
          entry.flip,
          entry.row,
          entry.col,
        );
        if (!validation.ok) {
          allowed = false;
        }
      });
    }
    projectLUseMasterBtn.disabled = !allowed;
    projectLUseMasterBtn.classList.toggle("action-allowed", allowed);
  }
  if (projectLFinishingPlaceBtn) {
    const allowed = isProjectLActionAvailable("finishing_place") && canPlace;
    projectLFinishingPlaceBtn.disabled = !allowed;
    projectLFinishingPlaceBtn.classList.toggle("action-allowed", allowed);
  }
  if (projectLFinishingDoneBtn) {
    const allowed = isProjectLActionAvailable("finishing_done");
    projectLFinishingDoneBtn.disabled = !allowed;
    projectLFinishingDoneBtn.classList.toggle("action-allowed", allowed);
  }
}

function renderProjectLGameState(data) {
  const view = data.view;
  currentProjectLView = view;
  if (currentGameType !== "project_l") {
    currentGameType = "project_l";
    setGamePanelVisibility("project_l");
  }
  syncProjectLSelections(view);
  if (projectLUpgradeModal && !projectLUpgradeModal.classList.contains("hidden")) {
    renderProjectLUpgradeModal(view);
  }

  if (projectLPhaseLabel) {
    projectLPhaseLabel.textContent = view.phase || "-";
  }
  if (projectLApLabel) {
    if (view.phase === "main" && Number.isInteger(view.ap_remaining)) {
      projectLApLabel.textContent = view.ap_remaining;
    } else {
      projectLApLabel.textContent = "-";
    }
  }
  if (projectLTurnLabel) {
    const currentPlayer = (view.players || []).find((p) => p.player_id === view.current_turn);
    projectLTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (projectLMasterUsedLabel) {
    projectLMasterUsedLabel.textContent = view.master_used ? "Yes" : "No";
  }
  if (projectLWhiteRemainingLabel) {
    projectLWhiteRemainingLabel.textContent = view.white_remaining ?? "-";
  }
  if (projectLBlackRemainingLabel) {
    projectLBlackRemainingLabel.textContent = view.black_remaining ?? "-";
  }
  if (projectLEndTriggeredLabel) {
    projectLEndTriggeredLabel.textContent = view.end_triggered ? "Yes" : "No";
  }
  if (projectLWinnerLabel) {
    if (view.winner && view.winner.length) {
      projectLWinnerLabel.textContent = view.winner.map((pid) => findPlayerName(view, pid)).join(", ");
    } else {
      projectLWinnerLabel.textContent = "-";
    }
  }

  updateProjectLSelectionLabels(view);
  renderProjectLMarket(view);
  renderProjectLActivePuzzles(view);
  renderProjectLCompleted(view);
  renderProjectLInventory(view);
  renderProjectLMasterQueue(view);
  renderProjectLPlayers(view);
  logGameEvents(data);
  updateProjectLActionButtons();
}

if (projectLUpgradeModalCloseBtn) {
  projectLUpgradeModalCloseBtn.addEventListener("click", () => {
    closeProjectLUpgradeModal();
  });
}

if (projectLUpgradeModal) {
  projectLUpgradeModal.addEventListener("click", (event) => {
    if (event.target === projectLUpgradeModal) {
      closeProjectLUpgradeModal();
    }
  });
}

if (projectLRotateLeftBtn) {
  projectLRotateLeftBtn.addEventListener("click", () => {
    projectLRotation = ((projectLRotation - 90) % 360 + 360) % 360;
    updateProjectLSelectionLabels();
    if (currentProjectLView) {
      renderProjectLActivePuzzles(currentProjectLView);
    }
    updateProjectLActionButtons();
  });
}

if (projectLRotateRightBtn) {
  projectLRotateRightBtn.addEventListener("click", () => {
    projectLRotation = (projectLRotation + 90) % 360;
    updateProjectLSelectionLabels();
    if (currentProjectLView) {
      renderProjectLActivePuzzles(currentProjectLView);
    }
    updateProjectLActionButtons();
  });
}

if (projectLFlipBtn) {
  projectLFlipBtn.addEventListener("click", () => {
    projectLFlip = !projectLFlip;
    updateProjectLSelectionLabels();
    if (currentProjectLView) {
      renderProjectLActivePuzzles(currentProjectLView);
    }
    updateProjectLActionButtons();
  });
}

if (projectLPanel) {
  projectLPanel.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest(
      "button, select, input, textarea, label, " +
      ".project-l-card, .project-l-puzzle-card, .project-l-piece, " +
      ".project-l-cell, .project-l-upgrade-piece, .project-l-queue-remove",
    )) {
      return;
    }
    clearProjectLSelection();
  });
}

if (projectLTakeMarketBtn) {
  projectLTakeMarketBtn.addEventListener("click", () => {
    if (!currentProjectLView || !projectLSelectedMarket) {
      return;
    }
    if (!isProjectLActionAvailable("take_puzzle")) {
      log("Not your turn");
      return;
    }
    sendAction({
      type: "take_puzzle",
      source: "market",
      deck: projectLSelectedMarket.deck,
      index: projectLSelectedMarket.index,
    });
    projectLSelectedMarket = null;
    updateProjectLSelectionLabels();
    if (currentProjectLView) {
      renderProjectLMarket(currentProjectLView);
    }
    updateProjectLActionButtons();
  });
}

if (projectLDrawWhiteBtn) {
  projectLDrawWhiteBtn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("take_puzzle")) {
      log("Not your turn");
      return;
    }
    sendAction({ type: "take_puzzle", source: "deck", deck: "white" });
  });
}

if (projectLDrawBlackBtn) {
  projectLDrawBlackBtn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("take_puzzle")) {
      log("Not your turn");
      return;
    }
    sendAction({ type: "take_puzzle", source: "deck", deck: "black" });
  });
}

if (projectLTakeLevel1Btn) {
  projectLTakeLevel1Btn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("take_level1")) {
      log("Not your turn");
      return;
    }
    sendAction({ type: "take_level1" });
  });
}

if (projectLUpgradeBtn) {
  projectLUpgradeBtn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("upgrade_piece")) {
      log("Not your turn");
      return;
    }
    const fromPiece = getProjectLUpgradeFrom(currentProjectLView);
    if (!fromPiece) {
      log("Select a piece from Inventory first");
      return;
    }
    openProjectLUpgradeModal(currentProjectLView);
  });
}

if (projectLPlaceBtn) {
  projectLPlaceBtn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("place_piece")) {
      log("Not your turn");
      return;
    }
    const placement = projectLGetSelectedPlacement(currentProjectLView);
    if (!placement || !placement.ok) {
      log("Select a valid placement");
      return;
    }
    sendAction({
      type: "place_piece",
      puzzle_index: placement.puzzle_index,
      piece_id: placement.piece_id,
      rotation: placement.rotation,
      flip: placement.flip,
      row: placement.row,
      col: placement.col,
    });
    projectLSelectedOrigin = null;
    updateProjectLSelectionLabels();
    if (currentProjectLView) {
      renderProjectLActivePuzzles(currentProjectLView);
    }
    updateProjectLActionButtons();
  });
}

if (projectLQueueMasterBtn) {
  projectLQueueMasterBtn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("master_action")) {
      log("Not your turn");
      return;
    }
    const placement = projectLGetSelectedPlacement(currentProjectLView);
    if (!placement || !placement.ok) {
      log("Select a valid placement");
      return;
    }
    const payload = {
      puzzle_index: placement.puzzle_index,
      piece_id: placement.piece_id,
      rotation: placement.rotation,
      flip: placement.flip,
      row: placement.row,
      col: placement.col,
    };
    const you = getProjectLYou(currentProjectLView);
    const counts = projectLInventoryCounts(you ? you.inventory : []);
    const queueCounts = projectLInventoryCounts(projectLMasterQueueItems.map((entry) => entry.piece_id));
    const existingIndex = projectLMasterQueueItems.findIndex(
      (entry) => entry.puzzle_index === payload.puzzle_index,
    );
    if (existingIndex >= 0) {
      const existingPiece = projectLMasterQueueItems[existingIndex].piece_id;
      queueCounts[existingPiece] = Math.max(0, (queueCounts[existingPiece] || 0) - 1);
    }
    if (existingIndex < 0 && you && projectLMasterQueueItems.length >= you.active_puzzles.length) {
      log("Master queue already full");
      return;
    }
    if ((queueCounts[payload.piece_id] || 0) >= (counts[payload.piece_id] || 0)) {
      log("Not enough pieces for this queue");
      return;
    }
    if (existingIndex >= 0) {
      projectLMasterQueueItems[existingIndex] = payload;
    } else {
      projectLMasterQueueItems.push(payload);
    }
    renderProjectLMasterQueue(currentProjectLView);
    renderProjectLInventory(currentProjectLView);
    updateProjectLActionButtons();
  });
}

if (projectLClearMasterBtn) {
  projectLClearMasterBtn.addEventListener("click", () => {
    projectLMasterQueueItems = [];
    renderProjectLMasterQueue(currentProjectLView);
    renderProjectLInventory(currentProjectLView);
    updateProjectLActionButtons();
  });
}

if (projectLUseMasterBtn) {
  projectLUseMasterBtn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("master_action")) {
      log("Not your turn");
      return;
    }
    if (!projectLMasterQueueItems.length) {
      log("Queue at least one placement");
      return;
    }
    sendAction({ type: "master_action", placements: projectLMasterQueueItems });
    projectLMasterQueueItems = [];
    renderProjectLMasterQueue(currentProjectLView);
    renderProjectLInventory(currentProjectLView);
    updateProjectLActionButtons();
  });
}

if (projectLFinishingPlaceBtn) {
  projectLFinishingPlaceBtn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("finishing_place")) {
      log("Not available");
      return;
    }
    const placement = projectLGetSelectedPlacement(currentProjectLView);
    if (!placement || !placement.ok) {
      log("Select a valid placement");
      return;
    }
    sendAction({
      type: "finishing_place",
      puzzle_index: placement.puzzle_index,
      piece_id: placement.piece_id,
      rotation: placement.rotation,
      flip: placement.flip,
      row: placement.row,
      col: placement.col,
    });
    projectLSelectedOrigin = null;
    updateProjectLSelectionLabels();
    renderProjectLActivePuzzles(currentProjectLView);
    updateProjectLActionButtons();
  });
}

if (projectLFinishingDoneBtn) {
  projectLFinishingDoneBtn.addEventListener("click", () => {
    if (!currentProjectLView) {
      return;
    }
    if (!isProjectLActionAvailable("finishing_done")) {
      return;
    }
    sendAction({ type: "finishing_done" });
  });
}
