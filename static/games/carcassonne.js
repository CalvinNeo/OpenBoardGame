const carcHeaderActions = document.getElementById("carcassonneHeaderActions");
const carcHelpBtn = document.getElementById("carcHelpBtn");
const carcExplainBtn = document.getElementById("carcExplainBtn");
const carcHelpModal = document.getElementById("carcHelpModal");
const carcHelpModalCloseBtn = document.getElementById("carcHelpModalCloseBtn");
const carcExplainModal = document.getElementById("carcExplainModal");
const carcExplainModalCloseBtn = document.getElementById("carcExplainModalCloseBtn");
const carcHelpContent = document.getElementById("carcHelpContent");
const carcExplainContent = document.getElementById("carcExplainContent");

const carcPhaseLabel = document.getElementById("carcPhase");
const carcTurnLabel = document.getElementById("carcTurn");
const carcRemainingLabel = document.getElementById("carcRemaining");
const carcWinnerLabel = document.getElementById("carcWinner");
const carcPendingLabel = document.getElementById("carcPendingLabel");
const carcRotationLabel = document.getElementById("carcRotationLabel");
const carcRotateLeftBtn = document.getElementById("carcRotateLeftBtn");
const carcRotateRightBtn = document.getElementById("carcRotateRightBtn");
const carcSkipMeepleBtn = document.getElementById("carcSkipMeepleBtn");
const carcBoard = document.getElementById("carcBoard");
const carcPendingTile = document.getElementById("carcPendingTile");
const carcMeepleOptions = document.getElementById("carcMeepleOptions");
const carcMeepleHint = document.getElementById("carcMeepleHint");
const carcMeepleSelection = document.getElementById("carcMeepleSelection");
const carcConfirmMeepleBtn = document.getElementById("carcConfirmMeepleBtn");
const carcClearMeepleBtn = document.getElementById("carcClearMeepleBtn");
const carcPlayers = document.getElementById("carcPlayers");

let currentCarcassonneView = null;

let carcTemplateData = null;
let carcTemplatePromise = null;
let carcTemplateCache = {};
let carcCellMap = new Map();
let carcHoverTiles = new Set();
let carcHoverKey = null;
let carcSelectedTiles = new Set();
let carcSelectedMeeple = null;
let carcSegmentImageCache = new Map();
let carcMeepleOptionSet = new Set();

let carcRotation = 0;
let carcPendingType = null;

function clearCarcassonneState() {
  currentCarcassonneView = null;
  carcRotation = 0;
  carcPendingType = null;
  carcCellMap.clear();
  carcHoverTiles.clear();
  carcHoverKey = null;
  if (carcPhaseLabel) {
    carcPhaseLabel.textContent = "-";
  }
  if (carcTurnLabel) {
    carcTurnLabel.textContent = "-";
  }
  if (carcRemainingLabel) {
    carcRemainingLabel.textContent = "-";
  }
  if (carcWinnerLabel) {
    carcWinnerLabel.textContent = "-";
  }
  if (carcPendingLabel) {
    carcPendingLabel.textContent = "-";
  }
  if (carcRotationLabel) {
    carcRotationLabel.textContent = "0°";
  }
  if (carcBoard) {
    carcBoard.innerHTML = "";
  }
  if (carcPendingTile) {
    carcPendingTile.innerHTML = "";
  }
  if (carcMeepleOptions) {
    carcMeepleOptions.innerHTML = "";
  }
  if (carcMeepleHint) {
    carcMeepleHint.textContent = "-";
  }
  if (carcMeepleSelection) {
    carcMeepleSelection.textContent = "Selected: -";
  }
  if (carcPlayers) {
    carcPlayers.innerHTML = "";
  }
  carcMeepleOptionSet.clear();
  clearCarcassonneSelection();
}

function updateCarcassonneRotationLabel() {
  if (carcRotationLabel) {
    carcRotationLabel.textContent = `${carcRotation}°`;
  }
}

function normalizeCarcassonnePositions(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item) => {
    if (Array.isArray(item)) {
      return { x: item[0], y: item[1] };
    }
    if (item && typeof item === "object") {
      return { x: item.x, y: item.y };
    }
    return null;
  }).filter(Boolean);
}

const CARC_SIDES = ["N", "E", "S", "W"];
const CARC_OPPOSITE_SIDE = { N: "S", S: "N", E: "W", W: "E" };
const CARC_SLOT_ROTATE_90 = {
  N0: "E0",
  N1: "E1",
  E0: "S1",
  E1: "S0",
  S0: "W0",
  S1: "W1",
  W0: "N1",
  W1: "N0",
};
const CARC_OPPOSITE_SLOT = {
  N0: "S0",
  N1: "S1",
  S0: "N0",
  S1: "N1",
  E0: "W0",
  E1: "W1",
  W0: "E0",
  W1: "E1",
};
const CARC_SIDE_DELTAS = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

function decodeCarcassonneMap(payload) {
  if (!payload || typeof payload !== "string") {
    return null;
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function prepareCarcassonneTemplates(data) {
  if (!data || !data.tiles) {
    return null;
  }
  const tiles = data.tiles;
  Object.keys(tiles).forEach((tileType) => {
    const tile = tiles[tileType];
    tile._roadMap = decodeCarcassonneMap(tile.road_map);
    tile._cityMap = decodeCarcassonneMap(tile.city_map);
    tile._fieldMap = decodeCarcassonneMap(tile.field_map);
    tile._monasteryMap = decodeCarcassonneMap(tile.monastery_map);
    tile._roadSegments = Array.isArray(tile.road_segments) ? tile.road_segments : [];
    tile._citySegments = Array.isArray(tile.city_segments) ? tile.city_segments : [];
    tile._fieldSegments = Array.isArray(tile.field_segments) ? tile.field_segments : [];
  });
  carcTemplateCache = {};
  carcSegmentImageCache = new Map();
  return data;
}

function loadCarcassonneTemplates() {
  if (carcTemplatePromise) {
    return carcTemplatePromise;
  }
  carcTemplatePromise = fetch("/api/carcassonne/templates")
    .then((resp) => (resp.ok ? resp.json() : null))
    .then((data) => {
      carcTemplateData = prepareCarcassonneTemplates(data);
      return carcTemplateData;
    })
    .catch((err) => {
      console.warn("Failed to load Carcassonne templates", err);
      carcTemplateData = null;
      return null;
    });
  return carcTemplatePromise;
}

function rotateCarcassonneSide(side, rotation) {
  const turns = ((rotation % 360) + 360) % 360 / 90;
  const idx = CARC_SIDES.indexOf(side);
  if (idx === -1) {
    return side;
  }
  return CARC_SIDES[(idx + turns) % 4];
}

function rotateCarcassonneSlot(slot, rotation) {
  let result = slot;
  const turns = ((rotation % 360) + 360) % 360 / 90;
  for (let i = 0; i < turns; i += 1) {
    result = CARC_SLOT_ROTATE_90[result] || result;
  }
  return result;
}

function rotateCarcassonnePointToBase(x, y, rotation) {
  let px = x;
  let py = y;
  const turns = ((rotation % 360) + 360) % 360 / 90;
  for (let i = 0; i < turns; i += 1) {
    const nx = py;
    const ny = 1 - px;
    px = nx;
    py = ny;
  }
  return { x: px, y: py };
}

function buildCarcassonneSegmentMask(tileType, rotation, feature, segment) {
  if (!carcTemplateData || !carcTemplateData.tiles) {
    return null;
  }
  const tile = carcTemplateData.tiles[tileType];
  if (!tile) {
    return null;
  }
  let sourceMap = null;
  if (feature === "road") {
    sourceMap = tile._roadMap;
  } else if (feature === "city") {
    sourceMap = tile._cityMap;
  } else if (feature === "field") {
    sourceMap = tile._fieldMap;
  } else if (feature === "monastery") {
    sourceMap = tile._monasteryMap;
    segment = 0;
  }
  if (!sourceMap) {
    return null;
  }
  const size = carcTemplateData.grid_size || 100;
  const mask = new Uint8Array(size * size);
  const turns = ((rotation % 360) + 360) % 360;
  if (turns === 0) {
    for (let idx = 0; idx < sourceMap.length; idx += 1) {
      if (sourceMap[idx] === segment) {
        mask[idx] = 1;
      }
    }
    return mask;
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      const base = rotateCarcassonnePointToBase(nx, ny, rotation);
      const bx = Math.max(0, Math.min(size - 1, Math.floor(base.x * size)));
      const by = Math.max(0, Math.min(size - 1, Math.floor(base.y * size)));
      const bidx = by * size + bx;
      if (sourceMap[bidx] === segment) {
        mask[y * size + x] = 1;
      }
    }
  }
  return mask;
}

function getCarcassonneSegmentImage(tileType, rotation, feature, segment) {
  const key = `${tileType}:${rotation}:${feature}:${segment}`;
  if (carcSegmentImageCache.has(key)) {
    return carcSegmentImageCache.get(key);
  }
  const mask = buildCarcassonneSegmentMask(tileType, rotation, feature, segment);
  if (!mask || !carcTemplateData) {
    return null;
  }
  const size = carcTemplateData.grid_size || 100;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.imageSmoothingEnabled = false;
  let fill = "rgba(14, 116, 144, 0.18)";
  let stroke = "rgba(14, 116, 144, 0.9)";
  if (feature === "road") {
    fill = "rgba(217, 119, 6, 0.22)";
    stroke = "rgba(217, 119, 6, 0.95)";
  } else if (feature === "city") {
    fill = "rgba(71, 85, 105, 0.25)";
    stroke = "rgba(71, 85, 105, 0.95)";
  } else if (feature === "field") {
    fill = "rgba(34, 197, 94, 0.2)";
    stroke = "rgba(34, 197, 94, 0.95)";
  }
  ctx.fillStyle = fill;
  for (let y = 0; y < size; y += 1) {
    let rowStart = y * size;
    for (let x = 0; x < size; x += 1) {
      if (mask[rowStart + x]) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  ctx.fillStyle = stroke;
  const thickness = 4;
  const radius = Math.floor(thickness / 2);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = y * size + x;
      if (!mask[idx]) {
        continue;
      }
      const north = y === 0 ? 0 : mask[idx - size];
      const south = y === size - 1 ? 0 : mask[idx + size];
      const west = x === 0 ? 0 : mask[idx - 1];
      const east = x === size - 1 ? 0 : mask[idx + 1];
      if (north && south && west && east) {
        continue;
      }
      for (let dy = -radius; dy <= radius; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= size) {
          continue;
        }
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= size) {
            continue;
          }
          ctx.fillRect(nx, ny, 1, 1);
        }
      }
    }
  }
  const url = canvas.toDataURL("image/png");
  carcSegmentImageCache.set(key, url);
  return url;
}

function getCarcassonneTileAt(view, worldX, worldY) {
  if (!view || !Array.isArray(view.board)) {
    return null;
  }
  const origin = view.board_origin || { x: 0, y: 0 };
  const row = view.board[worldY - origin.y];
  if (!row) {
    return null;
  }
  return row[worldX - origin.x] || null;
}

function getCarcassonneRotatedMeta(tileType, rotation) {
  if (!carcTemplateData || !carcTemplateData.tiles) {
    return null;
  }
  const key = `${tileType}:${rotation}`;
  if (carcTemplateCache[key]) {
    return carcTemplateCache[key];
  }
  const tile = carcTemplateData.tiles[tileType];
  if (!tile) {
    return null;
  }
  const roadSegments = tile._roadSegments.map((edges) => edges.map((side) => rotateCarcassonneSide(side, rotation)));
  const citySegments = tile._citySegments.map((edges) => edges.map((side) => rotateCarcassonneSide(side, rotation)));
  const fieldSegments = tile._fieldSegments.map((slots) => slots.map((slot) => rotateCarcassonneSlot(slot, rotation)));
  const edgeToRoad = {};
  roadSegments.forEach((edges, idx) => {
    edges.forEach((side) => {
      edgeToRoad[side] = idx;
    });
  });
  const edgeToCity = {};
  citySegments.forEach((edges, idx) => {
    edges.forEach((side) => {
      edgeToCity[side] = idx;
    });
  });
  const slotToField = {};
  fieldSegments.forEach((slots, idx) => {
    slots.forEach((slot) => {
      slotToField[slot] = idx;
    });
  });
  const meta = {
    roadSegments,
    citySegments,
    fieldSegments,
    edgeToRoad,
    edgeToCity,
    slotToField,
  };
  carcTemplateCache[key] = meta;
  return meta;
}

function getCarcassonneHoverFeature(tileType, rotation, x, y) {
  if (!carcTemplateData || !carcTemplateData.tiles) {
    return null;
  }
  const tile = carcTemplateData.tiles[tileType];
  if (!tile || !tile._roadMap || !tile._cityMap || !tile._fieldMap) {
    return null;
  }
  const base = rotateCarcassonnePointToBase(x, y, rotation);
  const size = carcTemplateData.grid_size || 100;
  const noneValue = carcTemplateData.none_value ?? 255;
  const gx = Math.max(0, Math.min(size - 1, Math.floor(base.x * size)));
  const gy = Math.max(0, Math.min(size - 1, Math.floor(base.y * size)));
  const idx = gy * size + gx;
  const roadSeg = tile._roadMap[idx];
  if (roadSeg !== noneValue) {
    return { feature: "road", segment: roadSeg };
  }
  const citySeg = tile._cityMap[idx];
  if (citySeg !== noneValue) {
    return { feature: "city", segment: citySeg };
  }
  if (tile._monasteryMap) {
    const monSeg = tile._monasteryMap[idx];
    if (monSeg !== noneValue) {
      return { feature: "monastery", segment: null };
    }
  }
  const fieldSeg = tile._fieldMap[idx];
  if (fieldSeg !== noneValue) {
    return { feature: "field", segment: fieldSeg };
  }
  return null;
}

function collectCarcassonneConnectedNodes(view, startX, startY, feature, segment) {
  const nodesByTile = new Map();
  if (feature === "monastery") {
    nodesByTile.set(`${startX},${startY}`, new Set([0]));
    return nodesByTile;
  }
  const visited = new Set();
  const queue = [{ x: startX, y: startY, seg: segment }];
  while (queue.length) {
    const current = queue.pop();
    const nodeKey = `${current.x},${current.y},${current.seg}`;
    if (visited.has(nodeKey)) {
      continue;
    }
    visited.add(nodeKey);
    const tile = getCarcassonneTileAt(view, current.x, current.y);
    if (!tile) {
      continue;
    }
    const tileKey = `${current.x},${current.y}`;
    if (!nodesByTile.has(tileKey)) {
      nodesByTile.set(tileKey, new Set());
    }
    nodesByTile.get(tileKey).add(current.seg);
    const meta = getCarcassonneRotatedMeta(tile.type, tile.rotation || 0);
    if (!meta) {
      continue;
    }
    if (feature === "road") {
      const edges = meta.roadSegments[current.seg] || [];
      edges.forEach((side) => {
        const delta = CARC_SIDE_DELTAS[side];
        if (!delta) {
          return;
        }
        const nx = current.x + delta.x;
        const ny = current.y + delta.y;
        const neighbor = getCarcassonneTileAt(view, nx, ny);
        if (!neighbor) {
          return;
        }
        const neighborMeta = getCarcassonneRotatedMeta(neighbor.type, neighbor.rotation || 0);
        if (!neighborMeta) {
          return;
        }
        const nseg = neighborMeta.edgeToRoad[CARC_OPPOSITE_SIDE[side]];
        if (Number.isInteger(nseg)) {
          queue.push({ x: nx, y: ny, seg: nseg });
        }
      });
    } else if (feature === "city") {
      const edges = meta.citySegments[current.seg] || [];
      edges.forEach((side) => {
        const delta = CARC_SIDE_DELTAS[side];
        if (!delta) {
          return;
        }
        const nx = current.x + delta.x;
        const ny = current.y + delta.y;
        const neighbor = getCarcassonneTileAt(view, nx, ny);
        if (!neighbor) {
          return;
        }
        const neighborMeta = getCarcassonneRotatedMeta(neighbor.type, neighbor.rotation || 0);
        if (!neighborMeta) {
          return;
        }
        const nseg = neighborMeta.edgeToCity[CARC_OPPOSITE_SIDE[side]];
        if (Number.isInteger(nseg)) {
          queue.push({ x: nx, y: ny, seg: nseg });
        }
      });
    } else if (feature === "field") {
      const slots = meta.fieldSegments[current.seg] || [];
      slots.forEach((slot) => {
        const side = slot ? slot[0] : null;
        const delta = side ? CARC_SIDE_DELTAS[side] : null;
        if (!delta) {
          return;
        }
        const nx = current.x + delta.x;
        const ny = current.y + delta.y;
        const neighbor = getCarcassonneTileAt(view, nx, ny);
        if (!neighbor) {
          return;
        }
        const neighborMeta = getCarcassonneRotatedMeta(neighbor.type, neighbor.rotation || 0);
        if (!neighborMeta) {
          return;
        }
        const oppositeSlot = CARC_OPPOSITE_SLOT[slot];
        const nseg = neighborMeta.slotToField[oppositeSlot];
        if (Number.isInteger(nseg)) {
          queue.push({ x: nx, y: ny, seg: nseg });
        }
      });
    }
  }
  return nodesByTile;
}

function clearCarcassonneHighlight(kind) {
  const targetSet = kind === "selected" ? carcSelectedTiles : carcHoverTiles;
  if (!targetSet.size) {
    if (kind === "hover") {
      carcHoverKey = null;
    }
    return;
  }
  targetSet.forEach((key) => {
    const cell = carcCellMap.get(key);
    if (!cell) {
      return;
    }
    cell.classList.remove(kind === "selected" ? "carc-selected" : "carc-hover");
    const selector = kind === "selected" ? ".carc-selected-shape" : ".carc-hover-shape";
    cell.querySelectorAll(selector).forEach((el) => el.remove());
  });
  targetSet.clear();
  if (kind === "hover") {
    carcHoverKey = null;
  }
}

function applyCarcassonneHighlight(feature, nodesByTile, kind) {
  clearCarcassonneHighlight(kind);
  const newSet = new Set();
  nodesByTile.forEach((segments, key) => {
    const cell = carcCellMap.get(key);
    if (!cell) {
      return;
    }
    cell.classList.add(kind === "selected" ? "carc-selected" : "carc-hover");
    const tileType = cell.dataset.tileType;
    const rotation = Number(cell.dataset.rotation || 0);
    segments.forEach((seg) => {
      const image = getCarcassonneSegmentImage(tileType, rotation, feature, seg);
      if (!image) {
        return;
      }
      const overlay = document.createElement("div");
      overlay.className = `carc-highlight-shape ${kind === "selected" ? "carc-selected-shape" : "carc-hover-shape"}`;
      overlay.style.backgroundImage = `url(${image})`;
      cell.appendChild(overlay);
    });
    newSet.add(key);
  });
  if (kind === "selected") {
    carcSelectedTiles = newSet;
  } else {
    carcHoverTiles = newSet;
  }
}

function handleCarcassonneHover(event) {
  if (!currentCarcassonneView || !carcTemplateData) {
    return;
  }
  const cell = event.target.closest(".carc-cell.occupied");
  if (!cell || !carcBoard || !carcBoard.contains(cell)) {
    clearCarcassonneHighlight("hover");
    return;
  }
  const rect = cell.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  const localX = (event.clientX - rect.left) / rect.width;
  const localY = (event.clientY - rect.top) / rect.height;
  if (localX < 0 || localX > 1 || localY < 0 || localY > 1) {
    clearCarcassonneHighlight();
    return;
  }
  const tileType = cell.dataset.tileType;
  const rotation = Number(cell.dataset.rotation || 0);
  const worldX = Number(cell.dataset.worldX);
  const worldY = Number(cell.dataset.worldY);
  if (!tileType || !Number.isInteger(worldX) || !Number.isInteger(worldY)) {
    clearCarcassonneHighlight();
    return;
  }
  const featureInfo = getCarcassonneHoverFeature(tileType, rotation, localX, localY);
  if (!featureInfo) {
    clearCarcassonneHighlight("hover");
    return;
  }
  const key = `${worldX},${worldY}:${featureInfo.feature}:${featureInfo.segment}`;
  if (key === carcHoverKey) {
    return;
  }
  const nodes = collectCarcassonneConnectedNodes(
    currentCarcassonneView,
    worldX,
    worldY,
    featureInfo.feature,
    featureInfo.segment,
  );
  applyCarcassonneHighlight(featureInfo.feature, nodes, "hover");
  carcHoverKey = key;
}

function getMeepleOptionKey(feature, segment) {
  return `${feature}:${segment === null || segment === undefined ? "null" : segment}`;
}

function isMeepleOptionAvailable(feature, segment) {
  return carcMeepleOptionSet.has(getMeepleOptionKey(feature, segment));
}

function describeCarcassonneSelection(view, feature, segment) {
  if (feature === "monastery") {
    return "Monastery";
  }
  if (!view || !view.last_placed) {
    return `${feature} ${segment + 1}`;
  }
  const tile = getCarcassonneTileAt(view, view.last_placed.x, view.last_placed.y);
  if (!tile) {
    return `${feature} ${segment + 1}`;
  }
  const meta = getCarcassonneRotatedMeta(tile.type, tile.rotation || 0);
  if (!meta) {
    return `${feature} ${segment + 1}`;
  }
  if (feature === "road") {
    const edges = meta.roadSegments[segment] || [];
    return `Road · ${edges.join("+") || segment + 1}`;
  }
  if (feature === "city") {
    const edges = meta.citySegments[segment] || [];
    return `City · ${edges.join("+") || segment + 1}`;
  }
  if (feature === "field") {
    const slots = meta.fieldSegments[segment] || [];
    return `Field · ${slots.join("+") || segment + 1}`;
  }
  return `${feature} ${segment + 1}`;
}

function updateCarcassonneMeepleSelectionLabel(view) {
  if (!carcMeepleSelection) {
    return;
  }
  if (!carcSelectedMeeple) {
    carcMeepleSelection.textContent = "Selected: -";
    return;
  }
  const label = describeCarcassonneSelection(view, carcSelectedMeeple.feature, carcSelectedMeeple.segment);
  carcMeepleSelection.textContent = `Selected: ${label}`;
}

function clearCarcassonneSelection() {
  carcSelectedMeeple = null;
  clearCarcassonneHighlight("selected");
  if (currentCarcassonneView) {
    updateCarcassonneMeepleSelectionLabel(currentCarcassonneView);
    updateCarcassonneControls(currentCarcassonneView);
  } else if (carcMeepleSelection) {
    carcMeepleSelection.textContent = "Selected: -";
  }
}

function selectCarcassonneMeeple(view, feature, segment, worldX, worldY) {
  if (!view || !view.last_placed) {
    return;
  }
  if (!isMeepleOptionAvailable(feature, segment)) {
    log("That feature is not available for meeple placement.");
    return;
  }
  const nodes = collectCarcassonneConnectedNodes(view, worldX, worldY, feature, segment);
  applyCarcassonneHighlight(feature, nodes, "selected");
  carcSelectedMeeple = { feature, segment, x: worldX, y: worldY };
  updateCarcassonneMeepleSelectionLabel(view);
  updateCarcassonneControls(view);
}

function handleCarcassonneMeepleSelect(event) {
  if (!currentCarcassonneView || !carcTemplateData) {
    return;
  }
  const actions = Array.isArray(currentCarcassonneView.legal_actions)
    ? currentCarcassonneView.legal_actions
    : [];
  if (!actions.includes("place_meeple")) {
    return;
  }
  const last = currentCarcassonneView.last_placed;
  if (!last) {
    return;
  }
  const cell = event.target.closest(".carc-cell.occupied");
  if (!cell || !carcBoard || !carcBoard.contains(cell)) {
    return;
  }
  const worldX = Number(cell.dataset.worldX);
  const worldY = Number(cell.dataset.worldY);
  if (worldX !== last.x || worldY !== last.y) {
    log("Meeple must be placed on the last placed tile.");
    return;
  }
  const rect = cell.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  const localX = (event.clientX - rect.left) / rect.width;
  const localY = (event.clientY - rect.top) / rect.height;
  if (localX < 0 || localX > 1 || localY < 0 || localY > 1) {
    return;
  }
  const tileType = cell.dataset.tileType;
  const rotation = Number(cell.dataset.rotation || 0);
  const featureInfo = getCarcassonneHoverFeature(tileType, rotation, localX, localY);
  if (!featureInfo) {
    log("No feature found at that point.");
    return;
  }
  selectCarcassonneMeeple(currentCarcassonneView, featureInfo.feature, featureInfo.segment, worldX, worldY);
}

function getCarcassonneLegalSet(view, rotation) {
  const positions = view && view.legal_positions ? (view.legal_positions[rotation] || view.legal_positions[String(rotation)]) : [];
  const normalized = normalizeCarcassonnePositions(positions);
  const set = new Set();
  normalized.forEach((pos) => {
    if (Number.isInteger(pos.x) && Number.isInteger(pos.y)) {
      set.add(`${pos.x},${pos.y}`);
    }
  });
  return set;
}

function renderCarcassonneBoard(view) {
  if (!carcBoard) {
    return;
  }
  const board = Array.isArray(view.board) ? view.board : [];
  const rows = board.length;
  const cols = rows ? board[0].length : 0;
  carcBoard.style.gridTemplateColumns = cols ? `repeat(${cols}, var(--carc-cell))` : "none";
  if (cols) {
    const maxWidth = Math.max(240, window.innerWidth - 80);
    const gap = 2;
    const pad = 12;
    const span = Math.max(rows, cols);
    const rawSize = Math.floor((maxWidth - (span - 1) * gap - pad) / span);
    const cellSize = Math.max(28, Math.min(64, rawSize));
    carcBoard.style.setProperty("--carc-cell", `${cellSize}px`);
  }
  carcBoard.innerHTML = "";
  carcCellMap.clear();
  carcHoverTiles.clear();
  carcHoverKey = null;
  if (!rows || !cols) {
    return;
  }
  const origin = view.board_origin || { x: 0, y: 0 };
  const actions = Array.isArray(view.legal_actions) ? view.legal_actions : [];
  const canPlace = actions.includes("place_tile") && view.pending_tile;
  const legalSet = canPlace ? getCarcassonneLegalSet(view, carcRotation) : new Set();

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const cell = document.createElement("div");
      cell.className = "carc-cell";
      const worldX = origin.x + x;
      const worldY = origin.y + y;
      const tile = board[y][x];
      if (tile) {
        cell.classList.add("occupied");
        cell.dataset.worldX = worldX;
        cell.dataset.worldY = worldY;
        cell.dataset.tileType = tile.type;
        cell.dataset.rotation = tile.rotation || 0;
        carcCellMap.set(`${worldX},${worldY}`, cell);
        const tileEl = document.createElement("div");
        tileEl.className = "carc-tile";
        tileEl.style.backgroundImage = `url(/static/carcassonne/${tile.type}.svg)`;
        tileEl.style.transform = `rotate(${tile.rotation || 0}deg)`;
        cell.appendChild(tileEl);
        if (tile.meeple) {
          const meeple = document.createElement("div");
          meeple.className = `carc-meeple ${tile.meeple.color || ""}`;
          const label = (tile.meeple.feature || "").slice(0, 1);
          meeple.textContent = label ? label.toUpperCase() : "";
          if (tile.meeple.pos && typeof tile.meeple.pos.x === "number" && typeof tile.meeple.pos.y === "number") {
            meeple.style.left = `${tile.meeple.pos.x * 100}%`;
            meeple.style.top = `${tile.meeple.pos.y * 100}%`;
          }
          cell.appendChild(meeple);
        }
      } else if (legalSet.has(`${worldX},${worldY}`)) {
        cell.classList.add("legal");
        cell.addEventListener("click", () => {
          if (!canPlace) {
            return;
          }
          sendAction({ type: "place_tile", x: worldX, y: worldY, rotation: carcRotation });
        });
      }
      carcBoard.appendChild(cell);
    }
  }
  if (carcSelectedMeeple && carcTemplateData) {
    const last = view.last_placed;
    if (last && carcSelectedMeeple.x === last.x && carcSelectedMeeple.y === last.y) {
      const nodes = collectCarcassonneConnectedNodes(
        view,
        carcSelectedMeeple.x,
        carcSelectedMeeple.y,
        carcSelectedMeeple.feature,
        carcSelectedMeeple.segment,
      );
      applyCarcassonneHighlight(carcSelectedMeeple.feature, nodes, "selected");
    } else {
      clearCarcassonneSelection();
    }
  }
}

function renderCarcassonnePendingTile(view) {
  if (!carcPendingTile) {
    return;
  }
  carcPendingTile.innerHTML = "";
  if (!view.pending_tile) {
    carcPendingTile.textContent = "-";
    return;
  }
  const tile = document.createElement("div");
  tile.className = "carc-tile";
  tile.style.backgroundImage = `url(/static/carcassonne/${view.pending_tile.type}.svg)`;
  tile.style.transform = `rotate(${carcRotation}deg)`;
  carcPendingTile.appendChild(tile);
}

function renderCarcassonneMeepleOptions(view) {
  if (!carcMeepleOptions) {
    return;
  }
  carcMeepleOptions.innerHTML = "";
  const options = Array.isArray(view.meeple_options) ? view.meeple_options : [];
  carcMeepleOptionSet = new Set();
  if (!options.length) {
    carcMeepleOptions.textContent = "-";
    return;
  }
  options.forEach((option) => {
    carcMeepleOptionSet.add(getMeepleOptionKey(option.feature, option.segment));
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = option.label || option.feature || "-";
    btn.addEventListener("click", () => {
      const last = view.last_placed;
      if (!last) {
        return;
      }
      selectCarcassonneMeeple(view, option.feature, option.segment ?? null, last.x, last.y);
    });
    carcMeepleOptions.appendChild(btn);
  });
}

function renderCarcassonnePlayers(view) {
  if (!carcPlayers) {
    return;
  }
  carcPlayers.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "carc-player-row";
    if (player.player_id === view.you) {
      row.classList.add("player-you");
    }
    const left = document.createElement("div");
    left.className = "carc-player-left";
    const marker = player.player_id === view.current_turn ? "▶ " : "";
    const nameSpan = document.createElement("span");
    nameSpan.className = "carc-player-name";
    if (player.color) {
      nameSpan.classList.add(`carc-color-${player.color}`);
    }
    nameSpan.textContent = `${marker}${player.name || player.player_id}`;
    const metaSpan = document.createElement("span");
    metaSpan.className = "carc-player-meta";
    metaSpan.textContent = ` (${player.color || "-"})`;
    left.appendChild(nameSpan);
    left.appendChild(metaSpan);
    const right = document.createElement("div");
    right.textContent = `${player.score ?? 0} pts · ${player.meeples ?? 0} meeples`;
    row.appendChild(left);
    row.appendChild(right);
    carcPlayers.appendChild(row);
  });
}

function updateCarcassonneControls(view) {
  const actions = Array.isArray(view.legal_actions) ? view.legal_actions : [];
  const canPlace = actions.includes("place_tile");
  const canSkip = actions.includes("skip_meeple");
  const canPlaceMeeple = actions.includes("place_meeple");
  if (carcRotateLeftBtn) {
    carcRotateLeftBtn.disabled = !canPlace;
  }
  if (carcRotateRightBtn) {
    carcRotateRightBtn.disabled = !canPlace;
  }
  if (carcSkipMeepleBtn) {
    carcSkipMeepleBtn.disabled = !canSkip;
  }
  if (carcConfirmMeepleBtn) {
    carcConfirmMeepleBtn.disabled = !canPlaceMeeple || !carcSelectedMeeple;
  }
  if (carcClearMeepleBtn) {
    carcClearMeepleBtn.disabled = !carcSelectedMeeple;
  }
  if (carcMeepleHint) {
    carcMeepleHint.textContent = canPlaceMeeple ? "Click a feature on the last placed tile." : "-";
  }
}

function renderCarcassonneGameState(data) {
  const view = data.view;
  currentCarcassonneView = view;
  loadCarcassonneTemplates();
  const last = view.last_placed;
  if (!last || view.phase !== "place_meeple") {
    clearCarcassonneSelection();
  } else if (carcSelectedMeeple) {
    if (carcSelectedMeeple.x !== last.x || carcSelectedMeeple.y !== last.y) {
      clearCarcassonneSelection();
    }
  }
  if (currentGameType !== "carcassonne") {
    currentGameType = "carcassonne";
    setGamePanelVisibility("carcassonne");
  }
  if (carcPhaseLabel) {
    carcPhaseLabel.textContent = view.phase || "-";
  }
  if (carcTurnLabel) {
    const currentPlayer = (view.players || []).find((p) => p.player_id === view.current_turn);
    carcTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (carcRemainingLabel) {
    carcRemainingLabel.textContent = Number.isInteger(view.remaining_tiles) ? String(view.remaining_tiles) : "-";
  }
  if (carcWinnerLabel) {
    if (view.winner && view.winner.length) {
      const names = view.winner.map((pid) => findPlayerName(view, pid));
      carcWinnerLabel.textContent = names.join(", ");
    } else {
      carcWinnerLabel.textContent = "-";
    }
  }
  const pendingType = view.pending_tile ? view.pending_tile.type : null;
  if (pendingType !== carcPendingType) {
    carcPendingType = pendingType;
    carcRotation = 0;
  }
  if (carcPendingLabel) {
    carcPendingLabel.textContent = pendingType || "-";
  }
  updateCarcassonneRotationLabel();
  renderCarcassonneBoard(view);
  renderCarcassonnePendingTile(view);
  renderCarcassonneMeepleOptions(view);
  updateCarcassonneMeepleSelectionLabel(view);
  renderCarcassonnePlayers(view);
  updateCarcassonneControls(view);
  logGameEvents(data);
}

if (carcRotateLeftBtn) {
  carcRotateLeftBtn.addEventListener("click", () => {
    carcRotation = (carcRotation + 270) % 360;
    updateCarcassonneRotationLabel();
    if (currentCarcassonneView) {
      renderCarcassonneBoard(currentCarcassonneView);
      renderCarcassonnePendingTile(currentCarcassonneView);
    }
  });
}

if (carcRotateRightBtn) {
  carcRotateRightBtn.addEventListener("click", () => {
    carcRotation = (carcRotation + 90) % 360;
    updateCarcassonneRotationLabel();
    if (currentCarcassonneView) {
      renderCarcassonneBoard(currentCarcassonneView);
      renderCarcassonnePendingTile(currentCarcassonneView);
    }
  });
}

if (carcSkipMeepleBtn) {
  carcSkipMeepleBtn.addEventListener("click", () => {
    if (!currentCarcassonneView) {
      return;
    }
    const actions = Array.isArray(currentCarcassonneView.legal_actions)
      ? currentCarcassonneView.legal_actions
      : [];
    if (!actions.includes("skip_meeple")) {
      return;
    }
    clearCarcassonneSelection();
    sendAction({ type: "skip_meeple" });
  });
}

if (carcBoard) {
  carcBoard.addEventListener("mousemove", handleCarcassonneHover);
  carcBoard.addEventListener("mouseleave", () => clearCarcassonneHighlight("hover"));
  carcBoard.addEventListener("click", handleCarcassonneMeepleSelect);
}

if (carcConfirmMeepleBtn) {
  carcConfirmMeepleBtn.addEventListener("click", () => {
    if (!currentCarcassonneView || !carcSelectedMeeple) {
      return;
    }
    const actions = Array.isArray(currentCarcassonneView.legal_actions)
      ? currentCarcassonneView.legal_actions
      : [];
    if (!actions.includes("place_meeple")) {
      return;
    }
    sendAction({
      type: "place_meeple",
      feature: carcSelectedMeeple.feature,
      segment: carcSelectedMeeple.segment ?? null,
    });
    clearCarcassonneSelection();
  });
}

if (carcClearMeepleBtn) {
  carcClearMeepleBtn.addEventListener("click", () => {
    clearCarcassonneSelection();
  });
}

const CARC_HELP_TEXT = `
  <p>Goal: score the most points by building cities, roads, monasteries, and fields.</p>
  <h3>Turn</h3>
  <ol>
    <li>Draw and place a tile adjacent (orthogonal) to the board. All touching edges must match.</li>
    <li>Optionally place one meeple on the new tile if the connected feature is empty.</li>
    <li>Score any completed features and return those meeples (farmers stay).</li>
  </ol>
  <h3>Placement Rules</h3>
  <ul>
    <li>Tile must touch at least one existing tile.</li>
    <li>Edges must match: road-road, city-city, field-field.</li>
    <li>If no legal placement exists, the tile is discarded and you draw again.</li>
  </ul>
  <h3>Scoring</h3>
  <ul>
    <li>Road: 1 point per tile.</li>
    <li>City: 2 points per tile + 2 per shield; incomplete cities score 1 + 1 at game end.</li>
    <li>Monastery: 1 per surrounding tile (max 9).</li>
    <li>Field (farmers): game end only, 3 per completed adjacent city.</li>
  </ul>
  <h3>End Game</h3>
  <p>After the last tile is placed, score incomplete features and fields. Highest score wins (ties share).</p>
`;

const CARC_BUTTON_EXPLANATIONS = {
  carcRotateLeftBtn: {
    name: "Rotate Left",
    description: "Rotate the pending tile 90° counterclockwise before placing.",
    note: "Only affects the tile in the Pending Tile area.",
  },
  carcRotateRightBtn: {
    name: "Rotate Right",
    description: "Rotate the pending tile 90° clockwise before placing.",
    note: "Only affects the tile in the Pending Tile area.",
  },
  carcSkipMeepleBtn: {
    name: "Skip Meeple",
    description: "Finish the turn without placing a meeple on the last tile.",
    note: "Use this when you want to save meeples or no legal placement exists.",
  },
  carcConfirmMeepleBtn: {
    name: "Confirm Meeple",
    description: "Place a meeple on the selected feature of the last tile.",
    note: "Requires selecting a legal feature first.",
  },
  carcClearMeepleBtn: {
    name: "Clear Meeple",
    description: "Clear your current meeple selection on the last tile.",
    note: "Does not end your turn.",
  },
};

let carcExplainMode = false;

function showCarcassonneHeaderActions(show) {
  if (carcHeaderActions) {
    carcHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitCarcassonneExplainMode();
    closeCarcassonneHelpModal();
    closeCarcassonneExplainModal();
  }
}

function showCarcassonneHelpModal() {
  if (!carcHelpModal) {
    return;
  }
  if (carcHelpContent) {
    carcHelpContent.innerHTML = CARC_HELP_TEXT;
  }
  setModalVisible(carcHelpModal, true);
}

function closeCarcassonneHelpModal() {
  if (carcHelpModal) {
    setModalVisible(carcHelpModal, false);
  }
}

function updateCarcassonneExplainModeClasses(enabled) {
  Object.keys(CARC_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
}

function findCarcassonneButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(CARC_BUTTON_EXPLANATIONS)) {
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  return null;
}

function toggleCarcassonneExplainMode() {
  carcExplainMode = !carcExplainMode;
  document.body.classList.toggle("carcassonne-explain-mode", carcExplainMode);
  updateCarcassonneExplainModeClasses(carcExplainMode);
  if (carcExplainBtn) {
    carcExplainBtn.classList.toggle("active", carcExplainMode);
  }
}

function exitCarcassonneExplainMode() {
  if (!carcExplainMode) {
    return;
  }
  carcExplainMode = false;
  document.body.classList.remove("carcassonne-explain-mode");
  updateCarcassonneExplainModeClasses(false);
  if (carcExplainBtn) {
    carcExplainBtn.classList.remove("active");
  }
}

function showCarcassonneButtonExplanation(buttonId) {
  const explanation = CARC_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !carcExplainContent || !carcExplainModal) {
    return;
  }
  const note = explanation.note ? `<div class="hint">${explanation.note}</div>` : "";
  carcExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    ${note}
  `;
  setModalVisible(carcExplainModal, true);
}

function closeCarcassonneExplainModal() {
  if (carcExplainModal) {
    setModalVisible(carcExplainModal, false);
  }
}

if (carcHelpBtn) {
  carcHelpBtn.addEventListener("click", () => {
    showCarcassonneHelpModal();
  });
}

if (carcHelpModalCloseBtn) {
  carcHelpModalCloseBtn.addEventListener("click", closeCarcassonneHelpModal);
}

if (carcExplainBtn) {
  carcExplainBtn.addEventListener("click", () => {
    toggleCarcassonneExplainMode();
  });
}

if (carcExplainModalCloseBtn) {
  carcExplainModalCloseBtn.addEventListener("click", closeCarcassonneExplainModal);
}

document.addEventListener("pointerdown", (e) => {
  if (!carcExplainMode) return;

  const buttonId = findCarcassonneButtonAtPoint(e.clientX, e.clientY);
  if (buttonId) {
    e.preventDefault();
    e.stopPropagation();
    showCarcassonneButtonExplanation(buttonId);
    exitCarcassonneExplainMode();
    return;
  }

  const button = e.target.closest("button");
  if (button === carcExplainBtn || button === carcHelpBtn) return;
  if (button === carcHelpModalCloseBtn || button === carcExplainModalCloseBtn) return;

  if (button) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

document.addEventListener("click", (e) => {
  if (!carcExplainMode) return;

  const button = e.target.closest("button");
  if (!button) return;

  if (button === carcExplainBtn || button === carcHelpBtn) return;
  if (button === carcHelpModalCloseBtn || button === carcExplainModalCloseBtn) return;

  e.preventDefault();
  e.stopPropagation();
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && carcExplainMode) {
    exitCarcassonneExplainMode();
  }
});
