const socket = io();

let playerId = null;
let roomId = null;
let currentGameType = null;
let currentRoomState = null;
let lastGameStatePayload = null;
let actionLog = [];
const ACTION_LOG_MAX = 500;
const ACTION_LOG_TRUNCATE_AT = 500;
let roomControlsGameActive = false;
let roomControlsAutoCollapsed = false;
let roomControlsExplainButton = null;
let roomControlsExplainAnchor = null;
let createRoomPending = false;
let pendingReadyAfterJoin = false;
let pendingReadyRoomId = null;
let cachedGameList = null;
let gameListRequest = null;
let gameFilterRevision = 0;
let roomSessionReady = false;
let pendingRoomRequest = null;
let roomFeedbackMessage = "";
let roomFeedbackIsError = false;
const ROOM_REQUEST_TIMEOUT = 15000;
const roomStorageCache = new Map();
const roomConnectionLog = [];
let currentRoomList = [];
let pendingSeatClaimRoomId = null;
let pendingSeatClaimSourceId = null;
let pendingReopenRoomId = null;
let reopenConfirmReturnFocus = null;
let catanStarfarersSelectedLanguage = null;
let playerName = "";
let pendingPlayerNameAction = null;
let pendingJoinRequest = null;
const roomEntryReturnFocus = new WeakMap();
const selectedGameTagIds = new Set();
const roomControlsDockQuery = window.matchMedia("(max-width: 900px)");

const nameInput = document.getElementById("nameInput");
const playerNameModal = document.getElementById("playerNameModal");
const playerNameForm = document.getElementById("playerNameForm");
const playerNameError = document.getElementById("playerNameError");
const joinRoomModal = document.getElementById("joinRoomModal");
const joinRoomForm = document.getElementById("joinRoomForm");
const roomIdInput = document.getElementById("roomIdInput");
const joinRoomError = document.getElementById("joinRoomError");
const connectionInfo = document.getElementById("connectionInfo");
const roomActionStatus = document.getElementById("roomActionStatus");
const createRoomStatus = document.getElementById("createRoomStatus");
const gameListRetryBtn = document.getElementById("gameListRetryBtn");
const roomListEl = document.getElementById("roomList");
const refreshRoomsBtn = document.getElementById("refreshRoomsBtn");
const cleanupEmptyRoomsBtn = document.getElementById("cleanupEmptyRoomsBtn");
const loadBtn = document.getElementById("loadBtn");
const roomIdLabel = document.getElementById("roomIdLabel");
const roomStatus = document.getElementById("roomStatus");
const gameTypeLabel = document.getElementById("gameTypeLabel");
const playersList = document.getElementById("playersList");
const gameSelect = document.getElementById("gameSelect");
const createBtn = document.getElementById("createBtn");
const createGameRow = document.getElementById("createGameRow");
const leaveBtn = document.getElementById("leaveBtn");
const reopenBtn = document.getElementById("reopenBtn");
const downloadMemoriesBtn = document.getElementById("downloadMemoriesBtn");
const removeBotBtn = document.getElementById("removeBotBtn");
const logoutBtn = document.getElementById("logoutBtn");
const autoSaveRow = document.getElementById("autoSaveRow");
const autoSaveToggle = document.getElementById("autoSaveToggle");
const logEl = document.getElementById("log");
const logPanel = document.getElementById("logPanel");
const logCloseBtn = document.getElementById("logCloseBtn");
const logOpenBtn = document.getElementById("logOpenBtn");
const skipValidationToggle = document.getElementById("skipValidationToggle");
const copyStateBtn = document.getElementById("copyStateBtn");
const copyActLogBtn = document.getElementById("copyActLogBtn");
const loadModal = document.getElementById("loadModal");
const loadModalCloseBtn = document.getElementById("loadModalCloseBtn");
const loadList = document.getElementById("loadList");
const loadEmpty = document.getElementById("loadEmpty");
const loadAutoSaveToggle = document.getElementById("loadAutoSaveToggle");
const createRoomModal = document.getElementById("createRoomModal");
const createRoomModalTitle = document.getElementById("createRoomModalTitle");
const createRoomModalCloseBtn = document.getElementById("createRoomModalCloseBtn");
const reopenConfirmModal = document.getElementById("reopenConfirmModal");
const reopenConfirmCancelBtn = document.getElementById("reopenConfirmCancelBtn");
const reopenConfirmBtn = document.getElementById("reopenConfirmBtn");
const createRoomGameStep = document.getElementById("createRoomGameStep");
const gameSearchInput = document.getElementById("gameSearchInput");
const playerCountFilter = document.getElementById("playerCountFilter");
const gameSortSelect = document.getElementById("gameSortSelect");
const gameTypeFilterDetails = document.getElementById("gameTypeFilterDetails");
const gameTypeFilterSummary = document.getElementById("gameTypeFilterSummary");
const gameTypeFilters = document.getElementById("gameTypeFilters");
const gameListCount = document.getElementById("gameListCount");
const gameListEl = document.getElementById("gameList");
const gameListEmpty = document.getElementById("gameListEmpty");
const forestShuffleLanguageStep = document.getElementById("forestShuffleLanguageStep");
const forestShuffleLanguageBackBtn = document.getElementById("forestShuffleLanguageBackBtn");
const forestShuffleEnglishBtn = document.getElementById("forestShuffleEnglishBtn");
const forestShuffleChineseBtn = document.getElementById("forestShuffleChineseBtn");
const forestShuffleRoomLanguageRow = document.getElementById("forestShuffleRoomLanguageRow");
const forestShuffleRoomLanguage = document.getElementById("forestShuffleRoomLanguage");
const catanStarfarersSetupStep = document.getElementById("catanStarfarersSetupStep");
const catanStarfarersSetupBackBtn = document.getElementById("catanStarfarersSetupBackBtn");
const catanStarfarersLanguageButtons = document.querySelectorAll("[data-catan-starfarers-language]");
const catanStarfarersSetupButtons = document.querySelectorAll("[data-catan-starfarers-setup]");
const catanStarfarersRoomSetupRow = document.getElementById("catanStarfarersRoomSetupRow");
const catanStarfarersRoomSetup = document.getElementById("catanStarfarersRoomSetup");
const catanStarfarersRoomLanguage = document.getElementById("catanStarfarersRoomLanguage");
const seatClaimModal = document.getElementById("seatClaimModal");
const seatClaimCloseBtn = document.getElementById("seatClaimCloseBtn");
const seatClaimNameHint = document.getElementById("seatClaimNameHint");
const seatClaimRoomLabel = document.getElementById("seatClaimRoomLabel");
const seatClaimList = document.getElementById("seatClaimList");
const seatClaimEmpty = document.getElementById("seatClaimEmpty");
const roomControlsPanel = document.getElementById("roomControlsPanel");
const roomControlsToggleBtn = document.getElementById("roomControlsToggleBtn");
const mobileExplainSlot = document.getElementById("mobileExplainSlot");
const gameReconnectBtn = document.getElementById("gameReconnectBtn");

const ROOM_AUTH_KEY = "openboardgame:room_auth";
const NAME_STORAGE_KEY = "openboardgame:name";
const LAST_ROOM_ID_KEY = "openboardgame:last_room_id";

// Private browsing or a storage quota must not interrupt a live room session.
function readRoomStorage(key) {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) roomStorageCache.set(key, value);
    return value ?? roomStorageCache.get(key) ?? null;
  } catch {
    return roomStorageCache.get(key) ?? null;
  }
}

function writeRoomStorage(key, value) {
  roomStorageCache.set(key, value);
  try { localStorage.setItem(key, value); } catch {}
}

function removeRoomStorage(key) {
  roomStorageCache.delete(key);
  try { localStorage.removeItem(key); } catch {}
}

function loadStoredName() {
  try {
    return readRoomStorage(NAME_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function saveStoredName(name) {
  const nextName = typeof name === "string" ? name.trim() : "";
  if (!nextName) {
    clearStoredName();
    return;
  }
  playerName = nextName;
  updateRoomControlsName();
  writeRoomStorage(NAME_STORAGE_KEY, nextName);
}

function clearStoredName() {
  playerName = "";
  updateRoomControlsName();
  removeRoomStorage(NAME_STORAGE_KEY);
}

function updateRoomControlsName() {
  const fullTitle = roomControlsPanel.querySelector(".room-controls-title-full");
  const shortTitle = roomControlsPanel.querySelector(".room-controls-title-short");
  fullTitle.textContent = playerName || "Room Controls";
  shortTitle.textContent = playerName || "RC";
  fullTitle.title = playerName;
  shortTitle.title = playerName;
}

function loadRoomAuthMap() {
  try {
    const raw = readRoomStorage(ROOM_AUTH_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveRoomAuthMap(map) {
  writeRoomStorage(ROOM_AUTH_KEY, JSON.stringify(map));
}

function setRoomAuth(roomId, auth) {
  if (!roomId || !auth) {
    return;
  }
  const map = loadRoomAuthMap();
  map[roomId] = auth;
  saveRoomAuthMap(map);
  if (auth.name) {
    saveStoredName(auth.name);
  }
  writeRoomStorage(LAST_ROOM_ID_KEY, roomId);
  updateGameReconnectButton();
}

function getRoomAuth(roomId) {
  const map = loadRoomAuthMap();
  return map[roomId] || null;
}

function clearRoomAuth(roomId) {
  const map = loadRoomAuthMap();
  if (map[roomId]) {
    delete map[roomId];
    saveRoomAuthMap(map);
  }
}

function clearAllRoomAuth() {
  removeRoomStorage(ROOM_AUTH_KEY);
  removeRoomStorage(LAST_ROOM_ID_KEY);
  updateGameReconnectButton();
}

function getQuickReconnectRoomId() {
  if (roomId) {
    return roomId;
  }
  const authMap = loadRoomAuthMap();
  const storedRoomId = readRoomStorage(LAST_ROOM_ID_KEY);
  if (storedRoomId && authMap[storedRoomId]) {
    return storedRoomId;
  }
  const savedRoomIds = Object.keys(authMap);
  return savedRoomIds.length ? savedRoomIds[savedRoomIds.length - 1] : null;
}

function updateGameReconnectButton() {
  if (!gameReconnectBtn) {
    return;
  }
  const reconnectRoomId = getQuickReconnectRoomId();
  const auth = reconnectRoomId ? getRoomAuth(reconnectRoomId) : null;
  const canReconnect = Boolean(auth && auth.player_id && auth.reconnect_token && !pendingRoomRequest);
  gameReconnectBtn.disabled = !canReconnect;
  gameReconnectBtn.title = canReconnect
    ? `Reconnect to room ${reconnectRoomId}`
    : "No saved reconnect information";
  gameReconnectBtn.setAttribute("aria-label", gameReconnectBtn.title);
}

function log(message) {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = message;
  logEl.prepend(entry);
}

function shouldRedactResource(value) {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  const lowered = trimmed.slice(0, 64).toLowerCase();
  if (lowered.startsWith("data:image/")) {
    return true;
  }
  if (lowered.startsWith("data:") && lowered.includes(";base64,")) {
    return true;
  }
  return false;
}

function redactResources(value) {
  const seen = new WeakMap();
  let picIndex = 0;

  function walk(node) {
    if (typeof node === "string") {
      if (shouldRedactResource(node)) {
        const placeholder = `<pic_${picIndex}>`;
        picIndex += 1;
        return placeholder;
      }
      return node;
    }
    if (!node || typeof node !== "object") {
      return node;
    }
    if (seen.has(node)) {
      return seen.get(node);
    }
    if (Array.isArray(node)) {
      const arr = [];
      seen.set(node, arr);
      node.forEach((item, index) => {
        arr[index] = walk(item);
      });
      return arr;
    }
    const obj = {};
    seen.set(node, obj);
    Object.entries(node).forEach(([key, val]) => {
      obj[key] = walk(val);
    });
    return obj;
  }

  return walk(value);
}

function buildGameStateSnapshot() {
  const meta = {
    generated_at: new Date().toISOString(),
    room_id:
      roomId ||
      (currentRoomState && currentRoomState.room_id) ||
      (lastGameStatePayload && lastGameStatePayload.room_id) ||
      null,
    player_id: playerId || null,
    game_type:
      currentGameType ||
      (currentRoomState && currentRoomState.game_type) ||
      (lastGameStatePayload && lastGameStatePayload.game_type) ||
      null,
    room_status:
      (currentRoomState && currentRoomState.status) ||
      (lastGameStatePayload && lastGameStatePayload.room_status) ||
      null,
    state_version: lastGameStatePayload ? lastGameStatePayload.state_version : null,
    skip_validation: shouldSkipValidation(),
  };

  const snapshot = {
    meta,
    connection: {
      connected: socket.connected,
      room_session_ready: roomSessionReady,
      transport: socket.io.engine?.transport?.name || null,
      events: [...roomConnectionLog],
    },
    room_state: currentRoomState,
    game_state: lastGameStatePayload,
  };

  return redactResources(snapshot);
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Fall back to execCommand below.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  let success = false;
  try {
    success = document.execCommand("copy");
  } catch (error) {
    success = false;
  }
  document.body.removeChild(textarea);
  return success;
}

async function copyGameStateSnapshot() {
  const snapshot = buildGameStateSnapshot();
  const text = JSON.stringify(snapshot);
  const ok = await copyTextToClipboard(text);
  if (ok) {
    log("Game state copied to clipboard.");
  } else {
    log("Failed to copy game state.");
  }
}

function sanitizeActionLogValue(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    if (value.length > ACTION_LOG_TRUNCATE_AT) {
      return `${value.slice(0, ACTION_LOG_TRUNCATE_AT)}...(truncated ${value.length} chars)`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeActionLogValue(entry));
  }
  if (typeof value === "object") {
    const sanitized = {};
    Object.keys(value).forEach((key) => {
      sanitized[key] = sanitizeActionLogValue(value[key]);
    });
    return sanitized;
  }
  return value;
}

function recordActionLog(payload) {
  const timestamp = new Date().toISOString();
  const logPayload = {
    timestamp,
    room_id: payload ? payload.room_id : roomId,
    player_id: playerId || null,
    game_type: currentGameType || null,
    skip_validation: payload ? payload.skip_validation === true : shouldSkipValidation(),
    action: payload ? payload.action : null,
  };
  const sanitizedPayload = sanitizeActionLogValue(logPayload);
  const line = JSON.stringify(sanitizedPayload);
  actionLog.push(line);
  if (actionLog.length > ACTION_LOG_MAX) {
    actionLog.splice(0, actionLog.length - ACTION_LOG_MAX);
  }
}

async function copyActionLogSnapshot() {
  if (!actionLog.length) {
    log("No action log entries to copy.");
    return;
  }
  const text = actionLog.join("\n");
  const ok = await copyTextToClipboard(text);
  if (ok) {
    log(`Action log copied to clipboard (${actionLog.length} entries).`);
  } else {
    log("Failed to copy action log.");
  }
}

function describeBlockingPlayers(players) {
  if (!Array.isArray(players) || players.length === 0) {
    return "";
  }
  return players
    .map((player) => {
      if (typeof player === "string") {
        const trimmed = player.trim();
        return trimmed || "?";
      }
      if (!player || typeof player !== "object") {
        return "?";
      }
      const name = player.name ? String(player.name).trim() : "?";
      if (player.connected === false) {
        return `${name} (offline)`;
      }
      return name;
    })
    .filter(Boolean)
    .join(", ");
}

function findRoomListItem(roomId) {
  if (!roomListEl || !roomId) {
    return null;
  }
  return roomListEl.querySelector(`.room-item[data-room-id="${roomId}"]`);
}

function showRoomListBubble(wrapper, message) {
  if (!wrapper || !message) {
    return;
  }
  const existing = wrapper.querySelector(".room-bubble");
  if (existing) {
    existing.remove();
  }
  const bubble = document.createElement("div");
  bubble.className = "room-bubble";
  bubble.textContent = message;
  wrapper.appendChild(bubble);
  requestAnimationFrame(() => {
    bubble.classList.add("show");
  });
  window.setTimeout(() => {
    bubble.classList.remove("show");
    window.setTimeout(() => {
      bubble.remove();
    }, 200);
  }, 2200);
}

function setModalVisible(modalEl, visible) {
  if (!modalEl) {
    return;
  }
  modalEl.classList.toggle("hidden", !visible);
  modalEl.setAttribute("aria-hidden", (!visible).toString());
}

function openRoomEntryModal(modal, input, error) {
  roomEntryReturnFocus.set(modal, document.activeElement);
  error.textContent = "";
  error.classList.add("hidden");
  input.removeAttribute("aria-invalid");
  setModalVisible(modal, true);
  input.focus();
  input.select();
}

function closeRoomEntryModal(modal) {
  if (modal.classList.contains("hidden")) {
    return;
  }
  setModalVisible(modal, false);
  if (modal === playerNameModal) {
    pendingPlayerNameAction = null;
    nameInput.value = "";
  }
  const returnFocus = roomEntryReturnFocus.get(modal);
  if (returnFocus && returnFocus.isConnected) {
    returnFocus.focus();
  }
  roomEntryReturnFocus.delete(modal);
}

function requirePlayerName(action, message = "") {
  if (getPlayerName() && !message) {
    action();
    return;
  }
  pendingPlayerNameAction = action;
  nameInput.value = getPlayerName();
  openRoomEntryModal(playerNameModal, nameInput, playerNameError);
  if (message) {
    showRoomEntryError(nameInput, playerNameError, message);
  }
}

function showRoomEntryError(input, error, message) {
  error.textContent = message;
  error.classList.remove("hidden");
  input.setAttribute("aria-invalid", "true");
  input.focus();
}

function markPendingSeatClaim(roomId, sourceRoomId) {
  pendingSeatClaimRoomId = roomId || null;
  pendingSeatClaimSourceId = sourceRoomId || null;
}

function clearPendingSeatClaim(roomId) {
  if (!pendingSeatClaimRoomId) {
    return;
  }
  if (roomId && pendingSeatClaimRoomId !== roomId) {
    return;
  }
  pendingSeatClaimRoomId = null;
  pendingSeatClaimSourceId = null;
}

function requestSeatClaim(roomId, sourceRoomId, openImmediately = true) {
  if (!roomId) {
    return;
  }
  if (openImmediately && !getPlayerName()) {
    requirePlayerName(() => requestSeatClaim(roomId, sourceRoomId, openImmediately));
    return;
  }
  markPendingSeatClaim(roomId, sourceRoomId);
  if (openImmediately) {
    if (seatClaimNameHint) {
      const name = getPlayerName();
      seatClaimNameHint.textContent = name ? `Using name: ${name}` : "Set your name to claim a seat.";
    }
    if (seatClaimRoomLabel) {
      const sourceLabel = sourceRoomId ? `Loaded from ${sourceRoomId}` : "Loaded room";
    seatClaimRoomLabel.textContent = `Room ${roomId} · ${sourceLabel}`;
    }
    if (seatClaimList) {
      seatClaimList.innerHTML = "";
    }
    if (seatClaimEmpty) {
      seatClaimEmpty.textContent = "Loading seats...";
      seatClaimEmpty.classList.remove("hidden");
    }
    setModalVisible(seatClaimModal, true);
  }
  socket.emit("room:seat_list", { room_id: roomId });
}

function openLoadModal() {
  setModalVisible(loadModal, true);
}

function closeLoadModal() {
  setModalVisible(loadModal, false);
}

async function fetchGameList() {
  if (cachedGameList) {
    return cachedGameList;
  }
  if (gameListRequest) return gameListRequest;
  gameListRequest = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ROOM_REQUEST_TIMEOUT);
    try {
      const response = await fetch("/api/games", { signal: controller.signal });
      if (!response.ok) throw new Error(`Game list request failed (${response.status})`);
      const games = await response.json();
      if (!Array.isArray(games) || !games.length || games.some((game) =>
        !game || typeof game.game_id !== "string" || typeof game.name !== "string")) {
        throw new Error("Invalid game list response");
      }
      cachedGameList = games;
      updateRoomActionButtons();
      return games;
    } finally {
      clearTimeout(timer);
      gameListRequest = null;
    }
  })();
  return gameListRequest;
}

function getGameTags(game) {
  return game && Array.isArray(game.tags)
    ? game.tags.filter((tag) => tag && typeof tag.id === "string")
    : [];
}

function filterGames(games, searchText, playerCount, selectedTagIds = []) {
  const normalizedSearch = searchText.toLowerCase();
  const selectedTags =
    selectedTagIds instanceof Set ? selectedTagIds : new Set(selectedTagIds || []);
  return games.filter((g) => {
    const tags = getGameTags(g);
    const tagSearchText = tags
      .map((tag) => `${tag.label || ""} ${tag.id}`)
      .join(" ")
      .toLowerCase();
    const matchesSearch =
      !searchText ||
      g.name.toLowerCase().includes(normalizedSearch) ||
      (g.name_zh || "").toLowerCase().includes(normalizedSearch) ||
      g.game_id.toLowerCase().includes(normalizedSearch) ||
      tagSearchText.includes(normalizedSearch);
    const matchesPlayers =
      !playerCount || (Array.isArray(g.player_counts)
        ? g.player_counts.includes(playerCount)
        : (g.min_players <= playerCount && playerCount <= g.max_players));
    const matchesType = [...selectedTags].every((tagId) =>
      tags.some((tag) => tag.id === tagId)
    );
    return matchesSearch && matchesPlayers && matchesType;
  });
}

function collectGameTags(games) {
  const tagsById = new Map();
  games.forEach((game) => {
    getGameTags(game).forEach((tag) => {
      if (!tagsById.has(tag.id)) {
        tagsById.set(tag.id, tag);
      }
    });
  });
  return [...tagsById.values()].sort((a, b) => {
    const aOrder = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.MAX_SAFE_INTEGER;
    const bOrder = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder || String(a.label || a.id).localeCompare(String(b.label || b.id));
  });
}

function syncGameTypeFilterButtons() {
  if (gameTypeFilterSummary) {
    gameTypeFilterSummary.textContent = selectedGameTagIds.size
      ? `${selectedGameTagIds.size} selected · Match all`
      : "Match all selected";
  }
  if (!gameTypeFilters) {
    return;
  }
  gameTypeFilters.querySelectorAll(".game-type-filter-chip").forEach((button) => {
    const isActive = selectedGameTagIds.has(button.dataset.tagId);
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive.toString());
  });
}

function renderGameTypeFilters(games) {
  if (!gameTypeFilters) {
    return;
  }
  gameTypeFilters.innerHTML = "";
  collectGameTags(games).forEach((tag) => {
    const count = games.filter((game) => getGameTags(game).some((item) => item.id === tag.id)).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "game-type-filter-chip";
    button.dataset.tagId = tag.id;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `${tag.label || tag.id}, ${count} games`);
    if (tag.description) {
      button.title = tag.description;
    }

    const label = document.createElement("span");
    label.className = "game-type-filter-label";
    const icon = document.createElement("span");
    icon.className = "game-type-filter-icon";
    icon.textContent = tag.emoji || "🏷️";
    icon.setAttribute("aria-hidden", "true");
    const labelText = document.createElement("span");
    labelText.className = "game-type-filter-text";
    labelText.textContent = tag.label || tag.id;
    label.appendChild(icon);
    label.appendChild(labelText);
    const countEl = document.createElement("span");
    countEl.className = "game-type-filter-count";
    countEl.textContent = String(count);
    countEl.setAttribute("aria-hidden", "true");
    button.appendChild(label);
    button.appendChild(countEl);
    button.addEventListener("click", () => {
      if (selectedGameTagIds.has(tag.id)) {
        selectedGameTagIds.delete(tag.id);
      } else {
        selectedGameTagIds.add(tag.id);
      }
      syncGameTypeFilterButtons();
      applyGameFilters();
    });
    gameTypeFilters.appendChild(button);
  });
  gameTypeFilters.dataset.ready = "true";
  syncGameTypeFilterButtons();
}

const GAME_WEIGHT = {
  boomerang_australia: 1.53,
  ponzi_scheme: 2.44,
  abraca_what: 1.64,
  age_of_war: 1.15,
  aidixit: 1.1924453280318092,
  ark_nova: 3.80,
  azul: 1.78,
  blokus: 1.73,
  blitz_sketch: 1.0,
  bohnanza_dice: 1.17,
  emerald_skulls: 1.93,
  wriggle_roulette: 1.00,
  catan_starfarers: 2.60,
  castles_of_burgundy: 2.97,
  cabo: 1.4,
  carcassonne: 1.89,
  cat_in_box: 2.03,
  coyote: 1.3,
  cyber_pictures: 1.0340909090909092,
  decrypto: 1.82,
  draw_guess: 1.0698602794411178,
  dumb_questions: 1.00,
  nine_upper: null,
  fang_niao: 1.3142857142857143,
  flip7: 1.028056112224449,
  gold_rush: 1.1839080459770115,
  gizmos: 2.05,
  gaia_project: 4.40,
  halli_galli: 1.02,
  hanabi: 1.69,
  hot_streak: 1.23,
  incan_gold: 1.11,
  istanbul: 2.58,
  kobayakawa: 1.2,
  tucano: 1.09,
  perfect_mismatch: 1.0,
  point_salad: 1.15,
  project_l: 1.53,
  six_nimmt: 1.19,
  skull: 1.12,
  splendor: 1.78,
  splendor_pokemon: 1.851063829787234,
  texas_holdem: 2.430830039525692,
  the_gang: 1.58,
  trekking_history: 1.76,
  turing_machine: 2.41,
  kronologic: 2.05,
  wandering_towers: 1.59,
  yahtzee: 1.17,
  fake_artist: 1.09,
  manila: 2.04,
  impression_flower: 1.00,
  isle_of_skye: 2.25,
  tagiron: 1.71,
  citadels: 2.05,
  forest_shuffle: 2.21,
  things_in_rings: 1.33,
  patchwork: 1.60,
  scout: 1.39,
  davinci_code: 1.48,
  lost_code: 2.38,
  criminal_dance: 1.16,
  wavelength: 1.11,
  word_decode: null,
  guandan: 2.33,
  acquire: 2.49,
  ra: 2.31,
  rebel_princess: 1.86,
  in_a_grove: 1.42,
  celestia: 1.32,
  witchs_brew: 1.87,
  century_spice_road: 1.80,
  high_society: 1.48,
  poison: 1.19,
  bomb_busters: 2.01,
  felix: 1.40,
  tacta: 1.34,
  subtext: 1.29,
};

function getGameWeight(gameId) {
  const weight = GAME_WEIGHT[gameId];
  return Number.isFinite(weight) ? weight : null;
}

function formatGameWeight(gameId) {
  const weight = getGameWeight(gameId);
  if (Number.isFinite(weight)) {
    return weight.toFixed(2);
  }
  return Object.prototype.hasOwnProperty.call(GAME_WEIGHT, gameId) ? "N/A" : "?";
}

function getGameSortKey() {
  if (!gameSortSelect) {
    return "alpha";
  }
  return gameSortSelect.value || "alpha";
}

function getGameDevOrder(game) {
  const order = Number(game && game.dev_order);
  return Number.isFinite(order) ? order : null;
}

function sortGames(games, sortKey) {
  const ordered = [...games];
  if (sortKey === "dev_order") {
    ordered.sort((a, b) => {
      const aOrder = getGameDevOrder(a);
      const bOrder = getGameDevOrder(b);
      if (Number.isFinite(aOrder) && Number.isFinite(bOrder)) {
        const diff = aOrder - bOrder;
        if (diff !== 0) return diff;
      } else if (Number.isFinite(aOrder)) {
        return -1;
      } else if (Number.isFinite(bOrder)) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
    return ordered;
  }
  if (sortKey === "difficulty_asc") {
    ordered.sort((a, b) => {
      const aWeight = getGameWeight(a.game_id);
      const bWeight = getGameWeight(b.game_id);
      if (Number.isFinite(aWeight) && Number.isFinite(bWeight)) {
        const diff = aWeight - bWeight;
        if (diff !== 0) return diff;
      } else if (Number.isFinite(aWeight)) {
        return -1;
      } else if (Number.isFinite(bWeight)) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
    return ordered;
  }
  if (sortKey === "difficulty_desc") {
    ordered.sort((a, b) => {
      const aWeight = getGameWeight(a.game_id);
      const bWeight = getGameWeight(b.game_id);
      if (Number.isFinite(aWeight) && Number.isFinite(bWeight)) {
        const diff = bWeight - aWeight;
        if (diff !== 0) return diff;
      } else if (Number.isFinite(aWeight)) {
        return -1;
      } else if (Number.isFinite(bWeight)) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
    return ordered;
  }
  ordered.sort((a, b) => a.name.localeCompare(b.name));
  return ordered;
}

function renderGameList(games) {
  if (!gameListEl || !gameListEmpty) {
    return;
  }
  gameListEl.innerHTML = "";
  if (!games || !games.length) {
    gameListEl.classList.add("hidden");
    gameListEmpty.classList.remove("hidden");
    return;
  }
  gameListEl.classList.remove("hidden");
  gameListEmpty.classList.add("hidden");
  games.forEach((g) => {
    const item = document.createElement("button");
    item.className = "game-item";
    item.type = "button";
    item.dataset.gameId = g.game_id;
    const weightLabel = formatGameWeight(g.game_id);
    const playerLabel =
      Array.isArray(g.player_counts) ? `${g.player_counts.join(" or ")} players` : g.min_players === g.max_players
        ? `${g.min_players} ${g.min_players === 1 ? "player" : "players"}`
        : `${g.min_players}-${g.max_players} players`;
    const chineseName = typeof g.name_zh === "string" ? g.name_zh.trim() : "";
    const displayName = chineseName && chineseName !== g.name ? `${g.name} · ${chineseName}` : g.name;
    item.title = `${displayName} · BGG Weight: ${weightLabel} · ${playerLabel}`;
    item.setAttribute("aria-label", item.title);
    const nameEl = document.createElement("span");
    nameEl.className = "game-item-name";
    const englishNameEl = document.createElement("span");
    englishNameEl.className = "game-item-name-en";
    englishNameEl.textContent = g.name;
    nameEl.appendChild(englishNameEl);
    if (chineseName && chineseName !== g.name) {
      const chineseNameEl = document.createElement("span");
      chineseNameEl.className = "game-item-name-zh";
      chineseNameEl.lang = "zh-CN";
      chineseNameEl.textContent = chineseName;
      nameEl.appendChild(chineseNameEl);
    }
    const metaEl = document.createElement("span");
    metaEl.className = "game-item-meta";
    const weightEl = document.createElement("span");
    weightEl.className = "game-item-weight";
    weightEl.textContent = `⚖️ ${weightLabel}`;
    weightEl.setAttribute("aria-hidden", "true");
    const playersEl = document.createElement("span");
    playersEl.className = "game-item-players";
    playersEl.textContent = `👥 ${
      Array.isArray(g.player_counts) ? g.player_counts.join(" / ") : g.min_players === g.max_players ? g.min_players : `${g.min_players}-${g.max_players}`
    }`;
    playersEl.setAttribute("aria-hidden", "true");
    metaEl.appendChild(weightEl);
    metaEl.appendChild(playersEl);
    item.appendChild(nameEl);
    item.appendChild(metaEl);
    item.addEventListener("click", () => {
      selectGameFromModal(g.game_id);
    });
    gameListEl.appendChild(item);
  });
}

function updateGameListCount(count) {
  if (!gameListCount) {
    return;
  }
  const safeCount = Number.isFinite(count) && count >= 0 ? count : 0;
  const label = safeCount === 1 ? "game" : "games";
  gameListCount.textContent = `Showing ${safeCount} ${label}`;
}

function createRoomForGame(gameId, config = null) {
  const name = getPlayerName();
  if (!name) {
    closeCreateRoomModal();
    requirePlayerName(() => createRoomForGame(gameId, config));
    return;
  }
  const payload = { name, game_type: gameId };
  if (config && typeof config === "object") {
    payload.config = config;
  }
  sendRoomRequest("room:create", payload, "Creating room...", false);
}

function showCreateRoomGameStep() {
  if (createRoomModalTitle) {
    createRoomModalTitle.textContent = "Select Game";
  }
  if (createRoomGameStep) {
    createRoomGameStep.classList.remove("hidden");
    createRoomGameStep.setAttribute("aria-hidden", "false");
  }
  if (forestShuffleLanguageStep) {
    forestShuffleLanguageStep.classList.add("hidden");
    forestShuffleLanguageStep.setAttribute("aria-hidden", "true");
  }
  if (catanStarfarersSetupStep) {
    catanStarfarersSetupStep.classList.add("hidden");
    catanStarfarersSetupStep.setAttribute("aria-hidden", "true");
  }
}

function showForestShuffleLanguageStep() {
  if (createRoomModalTitle) {
    createRoomModalTitle.textContent = "Forest Shuffle";
  }
  if (createRoomGameStep) {
    createRoomGameStep.classList.add("hidden");
    createRoomGameStep.setAttribute("aria-hidden", "true");
  }
  if (forestShuffleLanguageStep) {
    forestShuffleLanguageStep.classList.remove("hidden");
    forestShuffleLanguageStep.setAttribute("aria-hidden", "false");
  }
  if (catanStarfarersSetupStep) {
    catanStarfarersSetupStep.classList.add("hidden");
    catanStarfarersSetupStep.setAttribute("aria-hidden", "true");
  }
  if (forestShuffleEnglishBtn) {
    forestShuffleEnglishBtn.focus();
  }
}

function setCatanStarfarersSetupLanguage(language) {
  const nextLanguage = language === "zh" ? "zh" : language === "en" ? "en" : null;
  catanStarfarersSelectedLanguage = nextLanguage;
  catanStarfarersLanguageButtons.forEach((button) => {
    const selected = Boolean(nextLanguage && button.dataset.catanStarfarersLanguage === nextLanguage);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  const setupCopy = {
    beginner: {
      en: ["🌟 Beginner", "Fixed, fully revealed frontier"],
      zh: ["🌟 新手", "固定且完全公开的边疆"],
    },
    strategic: {
      en: ["🧭 Strategic", "Visible sectors, hidden production numbers"],
      zh: ["🧭 战略", "星区公开，生产点数隐藏"],
    },
    explorer: {
      en: ["🔭 Explorer", "Discover sectors while flying"],
      zh: ["🔭 探索", "在飞行途中发现星区"],
    },
    wild_space: {
      en: ["🌀 Wild Space", "Shuffled sectors and one unknown omission"],
      zh: ["🌀 未知宇宙", "随机星区，并移除一个未知星区"],
    },
  };
  catanStarfarersSetupButtons.forEach((button) => {
    button.disabled = !nextLanguage;
    button.title = nextLanguage ? "" : "Choose a language first.";
    const mode = button.dataset.catanStarfarersSetup || "beginner";
    const copy = setupCopy[mode] && setupCopy[mode][nextLanguage || "en"];
    if (!copy) return;
    const strong = button.querySelector("strong");
    const small = button.querySelector("small");
    if (strong) strong.textContent = copy[0];
    if (small) small.textContent = copy[1];
  });
  const setupHint = document.getElementById("catanStarfarersSetupHint");
  if (setupHint) {
    setupHint.textContent = nextLanguage === "zh" ? "2. 选择星域布局" : "2. Choose frontier setup";
  }
}

function showCatanStarfarersSetupStep() {
  if (createRoomModalTitle) {
    createRoomModalTitle.textContent = "CATAN: Starfarers";
  }
  if (createRoomGameStep) {
    createRoomGameStep.classList.add("hidden");
    createRoomGameStep.setAttribute("aria-hidden", "true");
  }
  if (forestShuffleLanguageStep) {
    forestShuffleLanguageStep.classList.add("hidden");
    forestShuffleLanguageStep.setAttribute("aria-hidden", "true");
  }
  if (catanStarfarersSetupStep) {
    catanStarfarersSetupStep.classList.remove("hidden");
    catanStarfarersSetupStep.setAttribute("aria-hidden", "false");
  }
  setCatanStarfarersSetupLanguage(null);
  const first = catanStarfarersLanguageButtons && catanStarfarersLanguageButtons[0];
  if (first) first.focus();
}

function selectGameFromModal(gameId) {
  if (gameId === "forest_shuffle" && forestShuffleLanguageStep) {
    showForestShuffleLanguageStep();
    return;
  }
  if (gameId === "catan_starfarers" && catanStarfarersSetupStep) {
    showCatanStarfarersSetupStep();
    return;
  }
  createRoomForGame(gameId);
}

async function applyGameFilters() {
  const revision = ++gameFilterRevision;
  gameListRetryBtn.classList.add("hidden");
  if (!cachedGameList) {
    gameListCount.textContent = "Loading games...";
    gameListEl.classList.add("hidden");
    gameListEmpty.classList.add("hidden");
  }
  let games;
  try {
    games = await fetchGameList();
  } catch {
    if (revision !== gameFilterRevision) return;
    gameListCount.textContent = "Could not load games. Check your connection and retry.";
    gameListRetryBtn.classList.remove("hidden");
    return;
  }
  if (revision !== gameFilterRevision) return;
  if (gameTypeFilters && gameTypeFilters.dataset.ready !== "true") {
    renderGameTypeFilters(games);
  }
  const searchText = gameSearchInput ? gameSearchInput.value.trim() : "";
  const playerCount = playerCountFilter ? parseInt(playerCountFilter.value, 10) || 0 : 0;
  const filtered = filterGames(games, searchText, playerCount, selectedGameTagIds);
  const sortKey = getGameSortKey();
  const sorted = sortGames(filtered, sortKey);
  updateGameListCount(sorted.length);
  renderGameList(sorted);
}

async function openCreateRoomModal() {
  if (!createRoomModal) {
    return;
  }
  setRoomFeedback();
  if (gameSearchInput) {
    gameSearchInput.value = "";
  }
  if (playerCountFilter) {
    playerCountFilter.value = "";
  }
  if (gameSortSelect) {
    gameSortSelect.value = "alpha";
  }
  selectedGameTagIds.clear();
  if (gameTypeFilterDetails) {
    gameTypeFilterDetails.open = false;
  }
  if (gameTypeFilters) {
    gameTypeFilters.innerHTML = "";
    delete gameTypeFilters.dataset.ready;
  }
  syncGameTypeFilterButtons();
  showCreateRoomGameStep();
  setModalVisible(createRoomModal, true);
  await applyGameFilters();
}

function closeCreateRoomModal() {
  createRoomPending = false;
  setModalVisible(createRoomModal, false);
  showCreateRoomGameStep();
}

function openSeatClaimModal(roomId, sourceRoomId) {
  requestSeatClaim(roomId, sourceRoomId, true);
}

function closeSeatClaimModal() {
  clearPendingSeatClaim();
  setModalVisible(seatClaimModal, false);
}

async function downloadSaveFile(sourceRoomId) {
  if (!sourceRoomId) {
    log("Missing source room id");
    return;
  }
  await downloadRoomFile(`/api/room/save?source_room_id=${encodeURIComponent(sourceRoomId)}`, "application/json");
}

async function downloadRoomFile(url, expectedType) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ROOM_REQUEST_TIMEOUT);
  const status = document.getElementById("loadDownloadStatus");
  status.textContent = "Preparing download...";
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `Request failed (${response.status})`);
    }
    const filename = parseDownloadFilename(response.headers.get("Content-Disposition"));
    if (response.redirected || !filename || !response.headers.get("Content-Type")?.includes(expectedType)) {
      throw new Error("The server did not return a download file. Please try again.");
    }
    const blob = await response.blob();
    if (expectedType === "application/json") {
      try {
        const save = JSON.parse(await blob.text());
        if (!save || typeof save !== "object") throw new Error("Invalid save");
      } catch {
        throw new Error("The server did not return a valid JSON save.");
      }
    }
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    // iOS may open a download instead; keep the live game in its original tab.
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    status.textContent = "Download ready.";
    setRoomFeedback("Download ready.");
  } catch (error) {
    const message = error.name === "AbortError" ? "Download timed out. Please try again." : `Download failed: ${error.message}`;
    status.textContent = message;
    setRoomFeedback(message, true);
  } finally {
    clearTimeout(timer);
  }
}

function parseDownloadFilename(headerValue) {
  if (!headerValue) {
    return null;
  }
  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]).replace(/^\"|\"$/g, "");
    } catch {
      return utf8Match[1].replace(/^\"|\"$/g, "");
    }
  }
  const match = headerValue.match(/filename=([^;]+)/i);
  if (!match) {
    return null;
  }
  return match[1].trim().replace(/^\"|\"$/g, "");
}

async function downloadMemoriesFile(activeRoomId) {
  if (!activeRoomId) {
    log("Not in a room");
    return;
  }
  const url = `/api/room/memories?room_id=${encodeURIComponent(activeRoomId)}`;
  const originalLabel = downloadMemoriesBtn ? downloadMemoriesBtn.textContent : "";
  try {
    if (downloadMemoriesBtn) {
      downloadMemoriesBtn.disabled = true;
      downloadMemoriesBtn.textContent = "Preparing...";
    }
    await downloadRoomFile(url, "text/html");
  } finally {
    if (downloadMemoriesBtn) {
      downloadMemoriesBtn.textContent = originalLabel || "Download Memories";
      updateRoomActionButtons();
    }
  }
}

function renderLoadList(saves) {
  if (!loadList || !loadEmpty) {
    return;
  }
  loadList.innerHTML = "";
  if (!Array.isArray(saves) || saves.length === 0) {
    loadEmpty.textContent = "No saves found.";
    loadEmpty.classList.remove("hidden");
    return;
  }
  loadEmpty.classList.add("hidden");
  const ordered = [...saves].sort((a, b) => {
    const aTime = Number(a.saved_at) || 0;
    const bTime = Number(b.saved_at) || 0;
    return bTime - aTime;
  });
  ordered.forEach((save) => {
    const wrapper = document.createElement("div");
    wrapper.className = "load-item";

    const header = document.createElement("div");
    header.className = "load-item-header";
    const title = document.createElement("div");
    title.textContent = save.source_room_id || "-";
    const game = document.createElement("div");
    game.textContent = save.game_type || "-";
    header.appendChild(title);
    header.appendChild(game);

    const meta = document.createElement("div");
    meta.className = "load-item-meta";
    const savedAt = Number(save.saved_at);
    const timeValue = Number.isFinite(savedAt) ? new Date(savedAt * 1000).toLocaleString() : "-";
    const versionValue = Number(save.state_version);
    const version = Number.isFinite(versionValue) ? `v${versionValue}` : "v-";
    meta.textContent = `${timeValue} \\u00b7 ${version}`;

    const players = document.createElement("div");
    players.className = "load-item-meta";
    const names = (save.players || [])
      .map((player) => {
        if (!player) {
          return "?";
        }
        const name = player.name || "?";
        return player.is_bot ? `${name} (bot)` : name;
      })
      .join(", ");
    players.textContent = names ? `Players: ${names}` : "Players: -";

    const actions = document.createElement("div");
    actions.className = "load-item-actions";
    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.textContent = "Load";
    loadButton.addEventListener("click", () => {
      if (!save.source_room_id) {
        log("Missing source room id");
        return;
      }
      const autoSave = loadAutoSaveToggle ? loadAutoSaveToggle.checked : false;
      socket.emit("room:load", { source_room_id: save.source_room_id, auto_save: autoSave });
    });
    actions.appendChild(loadButton);
    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.textContent = "Download";
    downloadButton.addEventListener("click", async () => {
      downloadButton.disabled = true;
      try {
        await downloadSaveFile(save.source_room_id);
      } finally {
        downloadButton.disabled = false;
      }
    });
    actions.appendChild(downloadButton);

    wrapper.appendChild(header);
    wrapper.appendChild(meta);
    wrapper.appendChild(players);
    wrapper.appendChild(actions);
    loadList.appendChild(wrapper);
  });
}

function renderSeatList(payload) {
  if (!seatClaimList || !seatClaimEmpty) {
    return;
  }
  seatClaimList.innerHTML = "";
  const seats = Array.isArray(payload.seats) ? payload.seats : [];
  const ordered = [...seats].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
  let available = 0;
  ordered.forEach((seat) => {
    const wrapper = document.createElement("div");
    wrapper.className = "seat-item";

    const row = document.createElement("div");
    row.className = "seat-item-row";
    const label = document.createElement("div");
    const seatNumber = Number.isFinite(seat.seat) ? seat.seat + 1 : "-";
    const name = seat.name || "?";
    label.textContent = `${seatNumber}. ${name}`;
    const meta = document.createElement("div");
    meta.className = "seat-item-meta";
    const tags = [];
    const claimed = Boolean(seat.seat_claimed) || seat.connected;
    if (seat.is_bot) tags.push("bot");
    if (!seat.is_bot && claimed) tags.push("claimed");
    meta.textContent = tags.join(" \\u00b7 ") || "available";
    row.appendChild(label);
    row.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "seat-item-actions";
    const claimButton = document.createElement("button");
    claimButton.type = "button";
    claimButton.textContent = "Claim";
    const disabled = seat.is_bot || claimed;
    if (!disabled) {
      available += 1;
    }
    claimButton.disabled = disabled;
    claimButton.addEventListener("click", () => {
      requirePlayerName(() => {
        socket.emit("room:claim_seat", { room_id: payload.room_id, seat: seat.seat, name: getPlayerName() });
      });
    });
    actions.appendChild(claimButton);

    wrapper.appendChild(row);
    wrapper.appendChild(actions);
    seatClaimList.appendChild(wrapper);
  });
  if (available === 0) {
    seatClaimEmpty.textContent = "No seats available.";
    seatClaimEmpty.classList.remove("hidden");
  } else {
    seatClaimEmpty.classList.add("hidden");
  }
}

function performLogout() {
  pendingJoinRequest = null;
  if (roomId) {
    socket.emit("room:leave", { room_id: roomId });
  }
  closeLoadModal();
  closeSeatClaimModal();
  closeRoomEntryModal(joinRoomModal);
  closeRoomEntryModal(playerNameModal);
  clearAllRoomAuth();
  clearStoredName();
  playerId = null;
  resetRoomState();
  if (nameInput) {
    nameInput.value = "";
  }
  setConnectionInfo("logged out");
  requestRoomList();
  log("Logged out");
}

function isTypingTarget(target) {
  if (!target) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function setLogPanelVisible(visible) {
  if (!logPanel) {
    return;
  }
  logPanel.classList.toggle("hidden", !visible);
  logPanel.setAttribute("aria-hidden", (!visible).toString());
  document.body.classList.toggle("log-open", visible);
}

function toggleLogPanel() {
  if (!logPanel) {
    return;
  }
  setLogPanelVisible(logPanel.classList.contains("hidden"));
}

function setConnectionInfo(message) {
  connectionInfo.textContent = message;
}

function setRoomFeedback(message = "", isError = false) {
  roomFeedbackMessage = message;
  roomFeedbackIsError = isError;
  setConnectionInfo(message || (roomSessionReady && roomId ? `Connected to room ${roomId}.` : ""));
  updateRoomActionButtons();
  if (isError) {
    log(message);
    setRoomControlsCollapsed(false);
  }
}

function getRoomStartReason() {
  if (!currentRoomState) return "Create or join a room first.";
  if (!socket.connected) return "Connection lost. Reconnecting...";
  if (!roomSessionReady) return "Reconnect to the room before playing.";
  if (currentRoomState.status !== "lobby") return "Game already started.";
  const players = currentRoomState.players || [];
  const gameMeta = cachedGameList?.find((game) => game.game_id === currentGameType);
  const minPlayers = currentRoomState.min_players ?? gameMeta?.min_players;
  const playerCounts = currentRoomState.player_counts ?? gameMeta?.player_counts;
  if (!Number.isFinite(minPlayers)) return "Loading room details...";
  if (players.length < minPlayers) return `Need at least ${minPlayers} players. Add a bot or invite a friend.`;
  if (Array.isArray(playerCounts) && !playerCounts.includes(players.length)) {
    return `This game needs ${playerCounts.join(" or ")} players.`;
  }
  if (players.some((player) => !player.is_bot && !player.ready)) return "All players must be ready.";
  return "";
}

function updateRoomActionButtons() {
  const busy = Boolean(pendingRoomRequest);
  const available = socket.connected && roomSessionReady && Boolean(roomId) && !busy;
  const inLobby = currentRoomState?.status === "lobby";
  const players = currentRoomState?.players || [];
  const gameMeta = cachedGameList?.find((game) => game.game_id === currentGameType);
  const maxPlayers = currentRoomState?.max_players ?? gameMeta?.max_players;
  const reason = getRoomStartReason();
  const startBtn = document.getElementById("startBtn");
  startBtn.disabled = !available || Boolean(reason);
  startBtn.title = reason;
  startBtn.textContent = pendingRoomRequest?.event === "room:start" ? "Starting..." : "Start Game";
  document.getElementById("readyBtn").disabled = !available || !inLobby;
  const addBotBtn = document.getElementById("addBotBtn");
  addBotBtn.disabled = !available || !inLobby || !Number.isFinite(maxPlayers) || players.length >= maxPlayers;
  addBotBtn.textContent = pendingRoomRequest?.event === "room:add_bot" ? "Adding..." : "Add Bot";
  removeBotBtn.disabled = !available || !inLobby || !players.some((player) => player.is_bot);
  leaveBtn.disabled = !roomId || busy;
  reopenBtn.disabled = !available || !["in_game", "game_over"].includes(currentRoomState?.status);
  autoSaveToggle.disabled = !available || Boolean(currentRoomState?.auto_save);
  downloadMemoriesBtn.disabled = !available || !currentRoomState?.supports_memories || inLobby;
  createBtn.disabled = busy;
  createBtn.textContent = pendingRoomRequest?.event === "room:create" ? "Creating..." : "Create Room";
  document.querySelectorAll("#createRoomModal .game-item, #forestShuffleEnglishBtn, #forestShuffleChineseBtn, [data-catan-starfarers-setup]")
    .forEach((button) => { button.disabled = busy; });
  roomActionStatus.textContent = roomFeedbackMessage || (inLobby ? reason || "Ready to start." : "");
  roomActionStatus.classList.toggle("room-feedback-error", roomFeedbackIsError);
  createRoomStatus.textContent = roomFeedbackMessage;
  createRoomStatus.classList.toggle("room-feedback-error", roomFeedbackIsError);
  updateGameReconnectButton();
}

function ensureRoomConnection(requiresRoom = true) {
  if (!socket.connected) {
    setRoomFeedback("Connection lost. Reconnecting... Please try again when connected.", true);
    socket.connect();
    return false;
  }
  if (requiresRoom && (!roomId || !roomSessionReady)) {
    setRoomFeedback(roomId ? "Reconnect to the room before playing." : "Create or join a room first.", true);
    return false;
  }
  return !pendingRoomRequest;
}

function finishRoomRequest() {
  pendingRoomRequest = null;
  updateRoomActionButtons();
}

function sendRoomRequest(event, payload, message, requiresRoom = true) {
  if (!ensureRoomConnection(requiresRoom)) return false;
  const request = { event, roomId: payload.room_id };
  pendingRoomRequest = request;
  setRoomFeedback(message);
  // Do not buffer room mutations while offline or replay them after reconnect.
  socket.timeout(ROOM_REQUEST_TIMEOUT).emit(event, payload, (error) => {
    if (pendingRoomRequest !== request) return;
    finishRoomRequest();
    if (error) {
      roomSessionReady = false;
      setRoomFeedback("No response from the server. Reconnect to check the room before trying again.", true);
    } else {
      setRoomFeedback();
    }
  });
  return true;
}

function getPlayerName() {
  return playerName;
}

function setCreateGameRowVisible(visible) {
  if (!createGameRow) {
    return;
  }
  createGameRow.classList.toggle("hidden", !visible);
  createGameRow.setAttribute("aria-hidden", (!visible).toString());
}

function showCreateGamePicker() {
  if (!gameSelect || !createGameRow) {
    return;
  }
  setCreateGameRowVisible(true);
  gameSelect.value = "";
  requestAnimationFrame(() => {
    if (typeof gameSelect.showPicker === "function") {
      gameSelect.showPicker();
    } else {
      gameSelect.focus();
    }
  });
}

function updateAutoSaveRow() {
  const showRow =
    currentRoomState &&
    (currentRoomState.status === "lobby" ||
      currentRoomState.status === "in_game" ||
      currentRoomState.status === "game_over");
  if (autoSaveRow) {
    autoSaveRow.classList.toggle("hidden", !showRow);
    autoSaveRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (autoSaveToggle) {
    const autoSaveEnabled = Boolean(currentRoomState && currentRoomState.auto_save);
    autoSaveToggle.checked = autoSaveEnabled;
    autoSaveToggle.disabled = !showRow || autoSaveEnabled;
  }
}

function updateReopenButton() {
  if (!reopenBtn) {
    return;
  }
  const showButton =
    currentRoomState && (currentRoomState.status === "in_game" || currentRoomState.status === "game_over");
  reopenBtn.classList.toggle("hidden", !showButton);
  reopenBtn.setAttribute("aria-hidden", (!showButton).toString());
  reopenBtn.disabled = !showButton;
}

function closeReopenConfirmModal(restoreFocus = true) {
  setModalVisible(reopenConfirmModal, false);
  const returnFocus = reopenConfirmReturnFocus;
  pendingReopenRoomId = null;
  reopenConfirmReturnFocus = null;
  if (restoreFocus && returnFocus && document.contains(returnFocus)) {
    returnFocus.focus();
  }
}

function openReopenConfirmModal(activeRoomId, returnFocus) {
  pendingReopenRoomId = activeRoomId;
  reopenConfirmReturnFocus = returnFocus || reopenBtn;
  setModalVisible(reopenConfirmModal, true);
  if (reopenConfirmBtn) {
    requestAnimationFrame(() => reopenConfirmBtn.focus());
  }
}

function emitRoomReopen(activeRoomId) {
  if (!activeRoomId) {
    log("Not in a room");
    return;
  }
  sendRoomRequest("room:reopen", { room_id: activeRoomId }, "Reopening room...");
}

function requestRoomReopen(event) {
  const activeRoomId = roomId || (currentRoomState && currentRoomState.room_id);
  if (!activeRoomId || !currentRoomState) {
    log("Not in a room");
    return;
  }
  if (currentRoomState.status === "game_over") {
    emitRoomReopen(activeRoomId);
    return;
  }
  openReopenConfirmModal(activeRoomId, event && event.currentTarget);
}

function updateRoomControlsDock() {
  if (!roomControlsPanel) {
    return;
  }
  const isCollapsed = roomControlsPanel.classList.contains("collapsed");
  const shouldDock =
    roomControlsDockQuery.matches &&
    roomControlsPanel.classList.contains("compact") &&
    isCollapsed;
  const shouldCloseDesktopDrawer = !roomControlsDockQuery.matches && isCollapsed;
  document.body.classList.toggle("room-controls-docked", shouldDock);
  document.body.classList.toggle("room-controls-drawer-closed", shouldCloseDesktopDrawer);
  if (shouldDock) {
    const height = roomControlsPanel.getBoundingClientRect().height;
    document.documentElement.style.setProperty("--room-controls-bar-height", `${height}px`);
  } else {
    document.documentElement.style.removeProperty("--room-controls-bar-height");
  }
}

function restoreRoomControlsExplainButton() {
  if (!roomControlsExplainButton) {
    return;
  }
  roomControlsExplainButton.classList.remove("room-controls-mobile-explain");
  if (roomControlsExplainAnchor && roomControlsExplainAnchor.parentNode) {
    roomControlsExplainAnchor.parentNode.insertBefore(roomControlsExplainButton, roomControlsExplainAnchor);
    roomControlsExplainAnchor.remove();
  } else {
    roomControlsExplainButton.remove();
  }
  roomControlsExplainButton = null;
  roomControlsExplainAnchor = null;
}

function roomControlsExplainSourceIsVisible() {
  if (!roomControlsExplainButton || !roomControlsExplainAnchor) {
    return false;
  }
  const sourceContainer = roomControlsExplainAnchor.parentElement;
  return (
    sourceContainer &&
    sourceContainer.getClientRects().length > 0 &&
    !roomControlsExplainButton.hidden &&
    !roomControlsExplainButton.classList.contains("hidden")
  );
}

function syncRoomControlsExplainButton() {
  if (!mobileExplainSlot || !roomControlsDockQuery.matches) {
    restoreRoomControlsExplainButton();
    updateRoomControlsDock();
    return;
  }
  if (roomControlsExplainSourceIsVisible()) {
    updateRoomControlsDock();
    return;
  }

  restoreRoomControlsExplainButton();
  const explainButton = Array.from(
    document.querySelectorAll('.game-panel button[id$="ExplainBtn"]')
  ).find((button) => (
    !button.hidden &&
    !button.classList.contains("hidden") &&
    button.getClientRects().length > 0
  ));
  if (explainButton && explainButton.parentNode) {
    roomControlsExplainAnchor = document.createComment("mobile Explain button anchor");
    explainButton.parentNode.insertBefore(roomControlsExplainAnchor, explainButton);
    explainButton.classList.add("room-controls-mobile-explain");
    mobileExplainSlot.appendChild(explainButton);
    roomControlsExplainButton = explainButton;
  }
  updateRoomControlsDock();
}

function setRoomControlsCollapsed(collapsed, { auto = false } = {}) {
  if (!roomControlsPanel) {
    return;
  }
  roomControlsPanel.classList.toggle("collapsed", collapsed);
  if (roomControlsToggleBtn) {
    roomControlsToggleBtn.textContent = collapsed ? "Show" : "Hide";
    roomControlsToggleBtn.setAttribute("aria-expanded", (!collapsed).toString());
  }
  if (auto) {
    roomControlsAutoCollapsed = collapsed;
  }
  updateRoomControlsDock();
}

function updateRoomControlsForStatus(status) {
  if (!roomControlsPanel) {
    return;
  }
  const isInGame = status === "in_game";
  roomControlsPanel.classList.toggle("compact", isInGame);
  if (isInGame && !roomControlsGameActive) {
    const wasCollapsed = roomControlsPanel.classList.contains("collapsed");
    if (!wasCollapsed) {
      setRoomControlsCollapsed(true, { auto: true });
    }
  }
  if (!isInGame && roomControlsGameActive) {
    if (roomControlsAutoCollapsed) {
      setRoomControlsCollapsed(false, { auto: true });
    }
    roomControlsAutoCollapsed = false;
  }
  roomControlsGameActive = isInGame;
  updateRoomControlsDock();
}

function requestRoomList() {
  socket.emit("room:list", {});
}

function requestLoadList() {
  if (loadList) {
    loadList.innerHTML = "";
  }
  if (loadEmpty) {
    loadEmpty.textContent = "Loading saves...";
    loadEmpty.classList.remove("hidden");
  }
  if (loadAutoSaveToggle) {
    loadAutoSaveToggle.checked = false;
  }
  openLoadModal();
  socket.emit("room:load_list", {});
}

function getRoomSummary(roomId) {
  if (!roomId || !Array.isArray(currentRoomList)) {
    return null;
  }
  return currentRoomList.find((room) => room.room_id === roomId) || null;
}

function attemptJoinRoom(rid, options = {}) {
  const name = getPlayerName();
  if (!rid) {
    log("Room ID required");
    return;
  }
  if (!name) {
    requirePlayerName(() => attemptJoinRoom(rid, options));
    return;
  }
  const summary = getRoomSummary(rid);
  const sourceRoomId =
    summary && typeof summary.source_room_id === "string" ? summary.source_room_id.trim() : "";
  if (summary && sourceRoomId) {
    requestSeatClaim(summary.room_id, sourceRoomId, true);
    return;
  }
  if (options.readyAfterJoin) {
    pendingReadyAfterJoin = true;
    pendingReadyRoomId = rid;
  } else {
    pendingReadyAfterJoin = false;
    pendingReadyRoomId = null;
  }
  markPendingSeatClaim(rid, null);
  pendingJoinRequest = { rid, options };
  sendRoomRequest("room:join", { name, room_id: rid }, "Joining room...", false);
}

function attemptReconnect(rid, auth) {
  if (!rid || !auth) {
    log("Reconnect info missing");
    return;
  }
  if (roomSessionReady && socket.connected && rid === roomId) {
    setRoomFeedback("Connected to room.");
    return;
  }
  sendRoomRequest("room:reconnect", {
    room_id: rid,
    player_id: auth.player_id,
    reconnect_token: auth.reconnect_token,
  }, "Reconnecting to room...", false);
}

function startCreateRoomFlow() {
  const name = getPlayerName();
  if (!name) {
    requirePlayerName(startCreateRoomFlow);
    return;
  }
  if (createRoomModal) {
    createRoomPending = true;
    openCreateRoomModal();
    return;
  }
  if (!gameSelect || !createGameRow) {
    createRoomForGame("cabo");
    return;
  }
  createRoomPending = true;
  showCreateGamePicker();
}

function renderRoomList(rooms) {
  if (!roomListEl) {
    return;
  }
  currentRoomList = Array.isArray(rooms) ? rooms : [];
  roomListEl.innerHTML = "";
  if (!rooms || !rooms.length) {
    roomListEl.textContent = "No rooms";
    return;
  }
  rooms.forEach((room) => {
    const wrapper = document.createElement("div");
    wrapper.className = "room-item";
    wrapper.dataset.roomId = room.room_id || "";

    const header = document.createElement("div");
    header.className = "room-item-header";
    const title = document.createElement("div");
    title.textContent = room.room_id || "-";
    const status = document.createElement("div");
    status.className = "room-pill";
    status.textContent = room.status || "-";
    header.appendChild(title);
    header.appendChild(status);

    const meta = document.createElement("div");
    meta.className = "room-item-meta";
    const maxPlayers = Number.isFinite(room.max_players) ? room.max_players : null;
    const count = `${room.player_count || 0}/${maxPlayers !== null ? maxPlayers : "-"}`;
    meta.textContent = `${room.game_type || "-"} · ${count}`;

    const players = document.createElement("div");
    players.className = "room-item-players";
    (room.players || []).forEach((player) => {
      const pill = document.createElement("span");
      pill.className = "room-pill";
      if (!player.connected) {
        pill.classList.add("offline");
      }
      const suffix = player.is_bot ? " (bot)" : "";
      pill.textContent = `${player.name || "?"}${suffix}`;
      players.appendChild(pill);
    });

    const actions = document.createElement("div");
    actions.className = "room-item-actions";
    const auth = getRoomAuth(room.room_id);
    const isLoaded = Boolean(room.source_room_id);
    const canReconnect = auth && auth.player_id && auth.reconnect_token;
    const claimableSeats = (room.players || []).filter(
      (player) => !player.is_bot && !(player.seat_claimed || player.connected),
    );
    const joinDisabled = isLoaded
      ? claimableSeats.length === 0
      : room.status !== "lobby" || (maxPlayers !== null && (room.player_count || 0) >= maxPlayers);
    const joinBtn = document.createElement("button");
    joinBtn.type = "button";
    joinBtn.textContent = isLoaded ? "Claim Seat" : "Join";
    joinBtn.disabled = joinDisabled;
    joinBtn.addEventListener("click", () => {
      if (isLoaded) {
        requestSeatClaim(room.room_id, room.source_room_id, true);
      } else {
        attemptJoinRoom(room.room_id);
      }
    });
    actions.appendChild(joinBtn);

    if (!isLoaded) {
      const joinReadyBtn = document.createElement("button");
      joinReadyBtn.type = "button";
      joinReadyBtn.textContent = "Join Ready";
      joinReadyBtn.title = "Join room and mark ready";
      joinReadyBtn.disabled = joinDisabled;
      joinReadyBtn.addEventListener("click", () => {
        attemptJoinRoom(room.room_id, { readyAfterJoin: true });
      });
      actions.appendChild(joinReadyBtn);
    }

    if (canReconnect) {
      const reconnectBtn = document.createElement("button");
      reconnectBtn.type = "button";
      reconnectBtn.className = "room-reconnect-btn";
      reconnectBtn.textContent = "🔄";
      reconnectBtn.setAttribute("aria-label", "Reconnect to room");
      reconnectBtn.title = "Reconnect to room";
      reconnectBtn.addEventListener("click", () => {
        attemptReconnect(room.room_id, auth);
      });
      actions.appendChild(reconnectBtn);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "room-delete-btn";
    deleteBtn.textContent = "🗑️";
    deleteBtn.setAttribute("aria-label", "Delete room");
    deleteBtn.title = "Delete room";
    deleteBtn.addEventListener("click", () => {
      if (!room.room_id) {
        return;
      }
      const blockingPlayers = (room.players || []).filter((player) => !player.is_bot && player.connected);
      if (blockingPlayers.length) {
        const names = describeBlockingPlayers(blockingPlayers);
        const message = names ? `Still in room: ${names}` : "Room has human players";
        showRoomListBubble(wrapper, message);
        return;
      }
      socket.emit("room:delete", { room_id: room.room_id });
    });
    actions.appendChild(deleteBtn);

    wrapper.appendChild(header);
    wrapper.appendChild(meta);
    if (isLoaded) {
      const source = document.createElement("div");
      source.className = "room-item-meta";
      source.textContent = `Loaded from ${room.source_room_id}`;
      wrapper.appendChild(source);
    }
    if (players.childNodes.length) {
      wrapper.appendChild(players);
    }
    wrapper.appendChild(actions);
    roomListEl.appendChild(wrapper);
  });
}

function resetRoomState() {
  roomSessionReady = false;
  closeReopenConfirmModal(false);
  roomId = null;
  currentRoomState = null;
  currentGameType = null;
  lastGameStatePayload = null;
  roomIdLabel.textContent = "-";
  roomStatus.textContent = "-";
  gameTypeLabel.textContent = "-";
  if (forestShuffleRoomLanguageRow) {
    forestShuffleRoomLanguageRow.classList.add("hidden");
  }
  if (forestShuffleRoomLanguage) {
    forestShuffleRoomLanguage.textContent = "-";
  }
  if (catanStarfarersRoomSetupRow) {
    catanStarfarersRoomSetupRow.classList.add("hidden");
  }
  if (catanStarfarersRoomSetup) {
    catanStarfarersRoomSetup.textContent = "-";
  }
  if (catanStarfarersRoomLanguage) {
    catanStarfarersRoomLanguage.textContent = "-";
  }
  playersList.innerHTML = "";
  if (typeof clearArkNovaState === "function") {
    clearArkNovaState();
  }
  clearCaboState();
  clearFlip7State();
  if (typeof clearHotStreakState === "function") {
    clearHotStreakState();
  }
  if (typeof clearPoisonState === "function") {
    clearPoisonState();
  }
  if (typeof clearBohnanzaDiceState === "function") {
    clearBohnanzaDiceState();
  }
  if (typeof clearWriggleRouletteState === "function") {
    clearWriggleRouletteState();
  }
  if (typeof clearCatanStarfarersState === "function") {
    clearCatanStarfarersState();
  }
  if (typeof clearTakeTimeState === "function") clearTakeTimeState();
  if (typeof clearEternalDecksState === "function") clearEternalDecksState();
  if (typeof clearPonziSchemeState === "function") clearPonziSchemeState();
  if (typeof clearRedDoorsState === "function") clearRedDoorsState();
  if (typeof clearCryptidState === "function") clearCryptidState();
  if (typeof clearSpiritIslandState === "function") clearSpiritIslandState();
  if (typeof clearBoomerangAustraliaState === "function") clearBoomerangAustraliaState();
  if (typeof clearBombBustersState === "function") {
    clearBombBustersState();
  }
  clearYahtzeeState();
  if (typeof clearAcquireState === "function") {
    clearAcquireState();
  }
  if (typeof clearLostCodeState === "function") {
    clearLostCodeState();
  }
  if (typeof clearCriminalDanceState === "function") {
    clearCriminalDanceState();
  }
  clearIstanbulState();
  if (typeof clearGaiaProjectState === "function") {
    clearGaiaProjectState();
  }
  clearGoldRushState();
  clearIncanGoldState();
  if (typeof clearCelestiaState === "function") {
    clearCelestiaState();
  }
  clearKobayakawaState();
  if (typeof clearTucanoState === "function") {
    clearTucanoState();
  }
  if (typeof clearRaState === "function") {
    clearRaState();
  }
  if (typeof clearCenturyState === "function") {
    clearCenturyState();
  }
  clearSkullState();
  clearCatInBoxState();
  clearGangState();
  clearMismatchState();
  clearCoyoteState();
  if (typeof clearInAGroveState === "function") {
    clearInAGroveState();
  }
  if (typeof clearTuringMachineState === "function") {
    clearTuringMachineState();
  }
  if (typeof clearKronologicState === "function") {
    clearKronologicState();
  }
  if (typeof clearTactaState === "function") {
    clearTactaState();
  }
  if (typeof clearSubtextState === "function") {
    clearSubtextState();
  }
  clearTexasHoldemState();
  clearSixNimmtState();
  clearHalliState();
  clearDecryptoState();
    if (typeof clearWavelengthState === "function") {
      clearWavelengthState();
    }
    if (typeof clearDumbQuestionsState === "function") {
      clearDumbQuestionsState();
    }
    clearDrawGuessState();
  clearBlitzSketchState();
  clearCyberState();
  clearAidixitState();
  clearImpressionFlowerState();
  clearSplendorState();
  clearPointSaladState();
  clearTrekkingState();
  clearAbracaState();
  clearBlokusState();
  if (typeof clearPatchworkState === "function") {
    clearPatchworkState();
  }
  clearProjectLState();
  clearCarcassonneState();
  clearFangNiaoState();
  setGamePanelVisibility(null);
  updateDrawGuessLanguageRow();
  updateCyberPicturesConfigRow();
  updateDecryptoPackRow();
  updateDecryptoBotRow();
  updateAidixitDeckRow();
  updateHalliConfigRow();
  updateGoldRushConfigRow();
  updateBombBustersConfigRow();
  if (typeof updateTakeTimeConfigRow === "function") updateTakeTimeConfigRow();
  if (typeof updateEternalDecksConfigRow === "function") updateEternalDecksConfigRow();
  if (typeof updatePonziSchemeConfigRow === "function") updatePonziSchemeConfigRow();
  if (typeof updateCryptidConfigRow === "function") updateCryptidConfigRow();
  if (typeof updateBoomerangAustraliaConfigUI === "function") updateBoomerangAustraliaConfigUI();
  if (typeof updateInAGroveConfigRow === "function") updateInAGroveConfigRow();
  updateHanabiConfigRow();
  updateTexasHoldemConfigRow();
  updateMismatchConfigRow();
  updateGangConfigRow();
  if (typeof updateWordDecodeConfigRow === "function") {
    updateWordDecodeConfigRow();
  }
  updateImpressionConfigRow();
  updateBlitzSketchConfigRow();
  if (typeof updateTuringMachineConfigRow === "function") {
    updateTuringMachineConfigRow();
  }
  if (typeof updateKronologicConfigRow === "function") {
    updateKronologicConfigRow();
  }
  if (typeof updateLostCodeConfigRow === "function") {
    updateLostCodeConfigRow();
  }
  if (typeof updateCriminalDanceConfigRow === "function") {
    updateCriminalDanceConfigRow();
  }
  if (typeof updateGuandanConfigRow === "function") {
    updateGuandanConfigRow();
  }
  if (typeof updateTactaConfigRow === "function") {
    updateTactaConfigRow();
  }
  if (typeof updateSubtextConfigRow === "function") {
    updateSubtextConfigRow();
  }
  updateAutoSaveRow();
  updateReopenButton();
  if (drawGuessLanguageSelect) {
    drawGuessLanguageSelect.value = "zh";
  }
  if (drawGuessGuessMethodSelect) {
    drawGuessGuessMethodSelect.value = "normal";
  }
  if (blitzSketchDrawTimeSelect) {
    blitzSketchDrawTimeSelect.value = "3";
  }
  if (drawGuessAnswerLengthToggle) {
    drawGuessAnswerLengthToggle.checked = false;
  }
  if (cyberPicturesDuplicateToggle) {
    cyberPicturesDuplicateToggle.checked = false;
  }
  cyberPicturesDisabledTools = new Set();
  if (decryptoBotSelect) {
    decryptoBotSelect.value = "native";
  }
  decryptoBotStrategyId = "native";
  if (decryptoBotClueSelect) {
    decryptoBotClueSelect.value = "0.5";
  }
  decryptoBotClueDirectness = 0.5;
  if (halliDeckSelect) {
    halliDeckSelect.value = "base";
  }
  if (goldRushModeSelect) {
    goldRushModeSelect.value = "hand";
  }
  if (bombBustersPresetSelect) {
    bombBustersPresetSelect.value = "standard_practice";
  }
  if (hanabiFinalRoundToggle) {
    hanabiFinalRoundToggle.checked = false;
  }
  if (mismatchSliderCount) {
    mismatchSliderCount.value = "3";
  }
  if (gangModeSelect) {
    gangModeSelect.value = "normal";
  }
  if (gangTimeSelect) {
    gangTimeSelect.value = "0";
  }
  if (wordDecodeGuessTimeSelect) {
    wordDecodeGuessTimeSelect.value = "0";
  }
  if (impressionVoteToggle) {
    impressionVoteToggle.checked = false;
  }
  if (turingMachineModeSelect) {
    turingMachineModeSelect.value = "simple";
  }
  if (turingMachineSourceSelect) {
    turingMachineSourceSelect.value = "random";
  }
  if (turingMachineDifficultySelect) {
    turingMachineDifficultySelect.value = "standard";
  }
  if (typeof populateTuringMachinePresetSelect === "function") {
    populateTuringMachinePresetSelect();
  }
  if (turingMachinePresetSelect) {
    turingMachinePresetSelect.value = "relay-standard-01";
  }
  if (turingMachineSeedInput) {
    turingMachineSeedInput.value = "";
  }
  if (lostCodeModeSelect) {
    lostCodeModeSelect.value = "standard";
  }
  if (lostCodeShortcutToggle) {
    lostCodeShortcutToggle.checked = false;
  }
  if (lostCodeCurseToggle) {
    lostCodeCurseToggle.checked = false;
  }
  if (criminalDanceDetectiveRuleSelect) {
    criminalDanceDetectiveRuleSelect.value = "hand_leq_3";
  }
  if (criminalDanceDogFailSelect) {
    criminalDanceDogFailSelect.value = "discard";
  }
  if (criminalDanceBoyToggle) {
    criminalDanceBoyToggle.checked = true;
  }
  if (criminalDanceChiefToggle) {
    criminalDanceChiefToggle.checked = false;
  }
  if (criminalDanceScoringToggle) {
    criminalDanceScoringToggle.checked = true;
  }
  if (criminalDanceBoyVisibilitySelect) {
    criminalDanceBoyVisibilitySelect.value = "boy_knows_criminal";
  }
  if (typeof resetGuandanRoomConfig === "function") {
    resetGuandanRoomConfig();
  }
  if (typeof updateTuringMachineConfigRowsFromSource === "function") {
    updateTuringMachineConfigRowsFromSource();
  }
  if (typeof resetKronologicRoomConfig === "function") {
    resetKronologicRoomConfig();
  }
  createRoomPending = false;
  setCreateGameRowVisible(false);
  updateRoomControlsForStatus(null);
  updateGameReconnectButton();
  updateRoomActionButtons();
}

socket.on("connect", () => {
  recordRoomConnectionEvent("connected");
  roomSessionReady = false;
  finishRoomRequest();
  requestRoomList();
  const rid = roomId || readRoomStorage(LAST_ROOM_ID_KEY);
  const auth = rid ? getRoomAuth(rid) : null;
  if (auth?.player_id && auth?.reconnect_token) {
    attemptReconnect(rid, auth);
  } else {
    setRoomFeedback("Connected. Select a game to create a room.");
  }
});

socket.on("connect_error", (error) => {
  recordRoomConnectionEvent("connect_error", error.message);
  roomSessionReady = false;
  finishRoomRequest();
  setRoomFeedback("Cannot connect to the server. Retrying...", true);
});

socket.on("system:info", (data) => {
  if (data.player_id) {
    playerId = data.player_id;
  }
  if (data.reconnect_token && data.room_id && data.player_id) {
    roomSessionReady = true;
    pendingJoinRequest = null;
    const nameValue = data.name || getPlayerName();
    setRoomAuth(data.room_id, {
      player_id: data.player_id,
      reconnect_token: data.reconnect_token,
      name: nameValue,
    });
    closeCreateRoomModal();
    finishRoomRequest();
    setRoomFeedback();
    // The room snapshot arrives before identity, so refresh the player's controls.
    if (currentRoomState) renderRoomState(currentRoomState);
  }
  if (data.message && data.message !== "connected") {
    setConnectionInfo(data.message);
    log(data.message);
  }
});

socket.on("system:error", (data) => {
  const failedRequest = pendingRoomRequest;
  finishRoomRequest();
  if (failedRequest?.event === "room:reconnect" &&
      ["room not found", "player not found", "invalid reconnect token"].includes(data.message)) {
    clearRoomAuth(failedRequest.roomId);
    removeRoomStorage(LAST_ROOM_ID_KEY);
    resetRoomState();
  }
  const joinRequest = pendingJoinRequest;
  pendingJoinRequest = null;
  if (joinRequest && ["name already in use", "player offline (use reconnect)"].includes(data.message)) {
    const auth = getRoomAuth(joinRequest.rid);
    if (data.message === "player offline (use reconnect)" && auth && auth.player_id && auth.reconnect_token) {
      attemptReconnect(joinRequest.rid, auth);
    } else {
      requirePlayerName(
        () => attemptJoinRoom(joinRequest.rid, joinRequest.options),
        "That name is already taken in this room. Choose another name.",
      );
    }
  }
  setRoomFeedback(`Error: ${data.message}`, true);
  if (currentGameType === "ark_nova" && typeof window.showArkNovaError === "function") {
    window.showArkNovaError(data.message);
  }
});

socket.on("room:session_replaced", () => {
  roomSessionReady = false;
  finishRoomRequest();
  setRoomFeedback("This room is open in another connection. Use Reconnect to return here.", true);
});

socket.on("room:state", (state) => {
  renderRoomState(state);
  if (pendingRoomRequest?.event === "room:start" && state.status === "in_game") {
    finishRoomRequest();
    setRoomFeedback();
  }
});

socket.on("room:list", (data) => {
  renderRoomList((data || {}).rooms || []);
});

socket.on("room:list_update", (data) => {
  renderRoomList((data || {}).rooms || []);
});

socket.on("room:load_list", (data) => {
  renderLoadList((data || {}).saves || []);
  openLoadModal();
});

socket.on("room:load_result", (data) => {
  if (!data || !data.ok) {
    const message = data && data.message ? String(data.message) : "Load failed";
    log(message);
    return;
  }
  closeLoadModal();
  log(`Loaded save into room: ${data.room_id}`);
});

socket.on("room:seat_list", (data) => {
  if (!data || !data.room_id) {
    return;
  }
  if (pendingSeatClaimRoomId && pendingSeatClaimRoomId !== data.room_id) {
    return;
  }
  if (!pendingSeatClaimRoomId) {
    return;
  }
  pendingSeatClaimRoomId = data.room_id;
  pendingSeatClaimSourceId = data.source_room_id || null;
  if (seatClaimNameHint) {
    const name = getPlayerName();
    seatClaimNameHint.textContent = name ? `Using name: ${name}` : "Set your name to claim a seat.";
  }
  if (seatClaimRoomLabel) {
    const sourceLabel = data.source_room_id ? `Loaded from ${data.source_room_id}` : "Loaded room";
    seatClaimRoomLabel.textContent = `Room ${data.room_id} · ${sourceLabel}`;
  }
  setModalVisible(seatClaimModal, true);
  renderSeatList(data);
});

socket.on("room:claim_result", (data) => {
  if (!data || !data.ok) {
    const message = data && data.message ? String(data.message) : "Seat claim failed";
    log(message);
    return;
  }
  if (data.player_id) {
    playerId = data.player_id;
  }
  closeSeatClaimModal();
});

socket.on("room:delete_result", (data) => {
  if (!data || data.ok) {
    return;
  }
  const messageFromServer = data.message ? String(data.message).trim() : "";
  const blocking = describeBlockingPlayers(data.blocking_players || []);
  const message = blocking
    ? `Still in room: ${blocking}`
    : messageFromServer || "Room could not be deleted";
  const wrapper = findRoomListItem(data.room_id);
  if (wrapper) {
    showRoomListBubble(wrapper, message);
  } else if (message) {
    log(message);
  }
});

socket.on("room:cleanup_empty_result", (data) => {
  cleanupEmptyRoomsBtn.disabled = false;
  const count = data && data.deleted_count;
  const message = data && data.ok
    ? (count ? `Cleared ${count} empty room${count === 1 ? "" : "s"}.` : "No empty rooms to clear.")
    : ((data && data.message) || "Could not clear empty rooms.");
  setConnectionInfo(message);
  log(message);
});

socket.on("game:state", (data) => {
  lastGameStatePayload = data;
  renderGameState(data);
});

socket.on("game:bot_progress", (data) => {
  if (!data || !lastGameStatePayload) {
    return;
  }
  if (data.room_id !== lastGameStatePayload.room_id || data.game_type !== lastGameStatePayload.game_type) {
    return;
  }
  lastGameStatePayload.bot_status = data.bot_status || null;
  if (data.state_version != null) {
    lastGameStatePayload.state_version = data.state_version;
  }
  if (currentGameType === "guandan" && typeof renderGuandanBotProgress === "function") {
    renderGuandanBotProgress(data.bot_status || null);
  }
});

// UI actions

playerName = loadStoredName().trim();
updateRoomControlsName();
updateGameReconnectButton();

playerNameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    showRoomEntryError(nameInput, playerNameError, "Enter your name to continue.");
    return;
  }
  const action = pendingPlayerNameAction;
  saveStoredName(name);
  closeRoomEntryModal(playerNameModal);
  if (action) {
    action();
  }
});

joinRoomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const rid = roomIdInput.value.trim().toLowerCase();
  if (!rid) {
    showRoomEntryError(roomIdInput, joinRoomError, "Enter a room ID to continue.");
    return;
  }
  closeRoomEntryModal(joinRoomModal);
  attemptJoinRoom(rid);
});

[
  [joinRoomModal, "joinRoomCancelBtn"],
  [playerNameModal, "playerNameCancelBtn"],
].forEach(([modal, cancelId]) => {
  document.getElementById(cancelId).addEventListener("click", () => closeRoomEntryModal(modal));
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeRoomEntryModal(modal);
    }
  });
});

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    performLogout();
  });
}

if (gameReconnectBtn) {
  gameReconnectBtn.addEventListener("click", () => {
    const reconnectRoomId = getQuickReconnectRoomId();
    const auth = reconnectRoomId ? getRoomAuth(reconnectRoomId) : null;
    attemptReconnect(reconnectRoomId, auth);
  });
}

if (createBtn) {
  createBtn.addEventListener("click", () => {
    startCreateRoomFlow();
  });
}

if (gameSelect) {
  gameSelect.addEventListener("change", () => {
    if (!createRoomPending) {
      return;
    }
    const gameType = gameSelect.value;
    if (!gameType) {
      return;
    }
    createRoomPending = false;
    setCreateGameRowVisible(false);
    createRoomForGame(gameType);
  });
}

document.getElementById("joinBtn").addEventListener("click", () => {
  openRoomEntryModal(joinRoomModal, roomIdInput, joinRoomError);
});

cleanupEmptyRoomsBtn.addEventListener("click", () => {
  if (!socket.connected) {
    setConnectionInfo("Connect to the server before clearing rooms.");
    return;
  }
  cleanupEmptyRoomsBtn.disabled = true;
  socket.emit("room:cleanup_empty", {});
});

socket.on("disconnect", (reason) => {
  recordRoomConnectionEvent("disconnected", reason);
  roomSessionReady = false;
  finishRoomRequest();
  pendingJoinRequest = null;
  cleanupEmptyRoomsBtn.disabled = false;
  setRoomFeedback("Connection lost. Reconnecting...");
});

function recordRoomConnectionEvent(event, reason = "") {
  const entry = {
    time: new Date().toISOString(), event, reason,
    transport: socket.io.engine?.transport?.name || null,
    visibility: document.visibilityState,
    online: navigator.onLine,
  };
  roomConnectionLog.push(entry);
  if (roomConnectionLog.length > 30) roomConnectionLog.shift();
  log(`Connection: ${event}${reason ? ` (${reason})` : ""} · ${entry.visibility} · ${entry.transport || "connecting"}`);
}

if (refreshRoomsBtn) {
  refreshRoomsBtn.addEventListener("click", () => {
    requestRoomList();
  });
}

if (loadBtn) {
  loadBtn.addEventListener("click", () => {
    requestLoadList();
  });
}

if (loadModalCloseBtn) {
  loadModalCloseBtn.addEventListener("click", () => {
    closeLoadModal();
  });
}

if (createRoomModalCloseBtn) {
  createRoomModalCloseBtn.addEventListener("click", () => {
    closeCreateRoomModal();
  });
}

if (forestShuffleLanguageBackBtn) {
  forestShuffleLanguageBackBtn.addEventListener("click", () => {
    showCreateRoomGameStep();
    const forestShuffleItem = gameListEl
      ? gameListEl.querySelector('[data-game-id="forest_shuffle"]')
      : null;
    if (forestShuffleItem) {
      forestShuffleItem.focus();
    }
  });
}

if (forestShuffleEnglishBtn) {
  forestShuffleEnglishBtn.addEventListener("click", () => {
    createRoomForGame("forest_shuffle", { language: "en" });
  });
}

if (forestShuffleChineseBtn) {
  forestShuffleChineseBtn.addEventListener("click", () => {
    createRoomForGame("forest_shuffle", { language: "zh" });
  });
}

if (catanStarfarersSetupBackBtn) {
  catanStarfarersSetupBackBtn.addEventListener("click", () => {
    showCreateRoomGameStep();
    const item = gameListEl ? gameListEl.querySelector('[data-game-id="catan_starfarers"]') : null;
    if (item) item.focus();
  });
}

catanStarfarersLanguageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setCatanStarfarersSetupLanguage(button.dataset.catanStarfarersLanguage);
    const firstSetupButton = catanStarfarersSetupButtons && catanStarfarersSetupButtons[0];
    if (firstSetupButton) firstSetupButton.focus();
  });
});

catanStarfarersSetupButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!catanStarfarersSelectedLanguage) return;
    const setupMode = button.dataset.catanStarfarersSetup || "beginner";
    createRoomForGame("catan_starfarers", {
      setup_mode: setupMode,
      language: catanStarfarersSelectedLanguage,
    });
  });
});

if (gameSearchInput) {
  gameSearchInput.addEventListener("input", () => {
    applyGameFilters();
  });
}

if (playerCountFilter) {
  playerCountFilter.addEventListener("change", () => {
    applyGameFilters();
  });
}

if (gameSortSelect) {
  gameSortSelect.addEventListener("change", () => {
    applyGameFilters();
  });
}

if (seatClaimCloseBtn) {
  seatClaimCloseBtn.addEventListener("click", () => {
    closeSeatClaimModal();
  });
}

if (createRoomModal) {
  createRoomModal.addEventListener("click", (event) => {
    if (event.target === createRoomModal) {
      closeCreateRoomModal();
    }
  });
}

if (reopenConfirmCancelBtn) {
  reopenConfirmCancelBtn.addEventListener("click", () => {
    closeReopenConfirmModal();
  });
}

if (reopenConfirmBtn) {
  reopenConfirmBtn.addEventListener("click", () => {
    const targetRoomId = pendingReopenRoomId;
    const activeRoomId = roomId || (currentRoomState && currentRoomState.room_id);
    closeReopenConfirmModal(false);
    if (!targetRoomId || targetRoomId !== activeRoomId) {
      log("Room changed before reopen confirmation");
      return;
    }
    emitRoomReopen(targetRoomId);
  });
}

if (reopenConfirmModal) {
  reopenConfirmModal.addEventListener("click", (event) => {
    if (event.target === reopenConfirmModal) {
      closeReopenConfirmModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  const entryModal = [playerNameModal, joinRoomModal].find((modal) => !modal.classList.contains("hidden"));
  if (entryModal) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeRoomEntryModal(entryModal);
    } else if (event.key === "Tab") {
      const controls = entryModal.querySelectorAll("input, button");
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    return;
  }
  if (event.key !== "Escape") {
    return;
  }
  if (reopenConfirmModal && !reopenConfirmModal.classList.contains("hidden")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeReopenConfirmModal();
    return;
  }
  if (!createRoomModal || createRoomModal.classList.contains("hidden")) {
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  closeCreateRoomModal();
  if (createBtn) {
    createBtn.focus();
  }
}, true);

document.getElementById("readyBtn").addEventListener("click", () => {
  let nextReady = true;
  if (currentRoomState && playerId) {
    const me = currentRoomState.players.find((p) => p.player_id === playerId);
    if (me) {
      nextReady = !me.ready;
    }
  }
  sendRoomRequest("room:ready", { room_id: roomId, ready: nextReady }, "Updating ready status...");
});

document.getElementById("startBtn").addEventListener("click", () => {
  emitRoomStart();
});

if (reopenBtn) {
  reopenBtn.addEventListener("click", requestRoomReopen);
}

if (downloadMemoriesBtn) {
  downloadMemoriesBtn.addEventListener("click", () => {
    const activeRoomId = roomId || (currentRoomState && currentRoomState.room_id);
    downloadMemoriesFile(activeRoomId);
  });
}

document.getElementById("addBotBtn").addEventListener("click", () => {
  sendRoomRequest("room:add_bot", { room_id: roomId }, "Adding bot...");
});

if (autoSaveToggle) {
  autoSaveToggle.addEventListener("change", () => {
    if (!roomId) {
      log("Not in a room");
      autoSaveToggle.checked = false;
      return;
    }
    sendRoomRequest("room:auto_save", { room_id: roomId, auto_save: autoSaveToggle.checked }, "Updating auto save...");
  });
}

if (removeBotBtn) {
  removeBotBtn.addEventListener("click", () => {
    if (!roomId) {
      log("Not in a room");
      return;
    }
    sendRoomRequest("room:remove_bot", { room_id: roomId }, "Removing bot...");
  });
}

if (leaveBtn) {
  leaveBtn.addEventListener("click", () => {
    if (!roomId) {
      log("Not in a room");
      return;
    }
    if (socket.connected) socket.emit("room:leave", { room_id: roomId });
    removeRoomStorage(LAST_ROOM_ID_KEY);
    resetRoomState();
    setRoomFeedback("Left room.");
    closeSeatClaimModal();
    log("Left room");
  });
}

document.querySelectorAll(".collapse-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const panel = btn.closest(".panel");
    if (!panel) {
      return;
    }
    const collapsed = panel.classList.toggle("collapsed");
    btn.textContent = collapsed ? "Show" : "Hide";
    btn.setAttribute("aria-expanded", (!collapsed).toString());
    if (panel.id === "roomControlsPanel") {
      btn.setAttribute("aria-label", collapsed ? "Open Room Controls" : "Hide Room Controls");
      btn.title = collapsed ? "Open Room Controls" : "Hide Room Controls";
      roomControlsAutoCollapsed = false;
      updateRoomControlsDock();
    }
  });
});

gameListRetryBtn.addEventListener("click", applyGameFilters);
updateRoomActionButtons();
// Start once at page load; filtering and opening the picker share this request.
fetchGameList().catch(() => {});

window.addEventListener("resize", syncRoomControlsExplainButton);

if (logCloseBtn) {
  logCloseBtn.addEventListener("click", () => {
    setLogPanelVisible(false);
  });
}

if (logOpenBtn) {
  logOpenBtn.addEventListener("click", () => {
    setLogPanelVisible(true);
  });
}

if (copyStateBtn) {
  copyStateBtn.addEventListener("click", () => {
    copyGameStateSnapshot();
  });
}

if (copyActLogBtn) {
  copyActLogBtn.addEventListener("click", () => {
    copyActionLogSnapshot();
  });
}

document.addEventListener("keydown", (event) => {
  if (!logPanel) {
    return;
  }
  if (event.key === "Escape") {
    if (!logPanel.classList.contains("hidden")) {
      event.preventDefault();
      setLogPanelVisible(false);
    }
    return;
  }
  if (event.key.toLowerCase() !== "l") {
    return;
  }
  if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  if (event.repeat || isTypingTarget(event.target)) {
    return;
  }
  toggleLogPanel();
});
