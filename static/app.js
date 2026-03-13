
const fangNiaoPanel = document.getElementById("fangNiaoPanel");
const fangNiaoPhaseLabel = document.getElementById("fangNiaoPhase");
const fangNiaoTurnLabel = document.getElementById("fangNiaoTurn");
const fangNiaoDeckLabel = document.getElementById("fangNiaoDeck");
const fangNiaoDiscardLabel = document.getElementById("fangNiaoDiscard");
const fangNiaoWinnerLabel = document.getElementById("fangNiaoWinner");
const fangNiaoLastActionLabel = document.getElementById("fangNiaoLastAction");
const fangNiaoRows = document.getElementById("fangNiaoRows");
const fangNiaoHand = document.getElementById("fangNiaoHand");
const fangNiaoSelectedBirdLabel = document.getElementById("fangNiaoSelectedBird");
const fangNiaoSelectedRowLabel = document.getElementById("fangNiaoSelectedRow");
const fangNiaoSelectedSideLabel = document.getElementById("fangNiaoSelectedSide");
const fangNiaoClearSelectionBtn = document.getElementById("fangNiaoClearSelection");
const fangNiaoPlayBtn = document.getElementById("fangNiaoPlayBtn");
const fangNiaoBankBtn = document.getElementById("fangNiaoBankBtn");
const fangNiaoEndBtn = document.getElementById("fangNiaoEndBtn");
const fangNiaoPlayers = document.getElementById("fangNiaoPlayers");
const carcassonnePanel = document.getElementById("carcassonnePanel");
const socket = io();

let playerId = null;
let roomId = null;
let currentCaboView = null;
let currentFangNiaoView = null;
let currentGameType = null;
let selectedSlots = [];
let currentRoomState = null;
let lastGameStatePayload = null;
let actionLog = [];
const ACTION_LOG_MAX = 500;
const ACTION_LOG_TRUNCATE_AT = 500;
let roomControlsGameActive = false;
let roomControlsAutoCollapsed = false;
let selectedTarget = null;
let fangNiaoSelectedBird = null;
let fangNiaoSelectedRow = null;
let fangNiaoSelectedSide = null;
const FANG_NIAO_BIRD_META = {
  flamingo: { name: "\u706b\u70c8\u9e1f", emoji: "\ud83e\udda9", color: "#fb7185" },
  owl: { name: "\u732b\u5934\u9e70", emoji: "\ud83e\udd89", color: "#f59e0b" },
  toucan: { name: "\u5927\u5634\u9e1f", emoji: "\ud83e\udd9a", color: "#0ea5e9" },
  duck: { name: "\u9e2d\u5b50", emoji: "\ud83e\udd86", color: "#facc15" },
  pelican: { name: "\u9e48\u9e55", emoji: "\ud83e\udda2", color: "#93c5fd" },
  parrot: { name: "\u9e66\u9e49", emoji: "\ud83e\udd9c", color: "#4ade80" },
  sparrow: { name: "\u9ebb\u96c0", emoji: "\ud83d\udc26", color: "#d1d5db" },
  magpie: { name: "\u559c\u9e4a", emoji: "\ud83e\udeb6", color: "#a3a3a3" },
};
const MEMORIES_SUPPORTED_GAMES = new Set([
  "draw_guess",
  "impression_flower",
  "cyber_pictures",
  "decrypto",
  "blitz_sketch",
  "carcassonne",
]);
let createRoomPending = false;
let pendingReadyAfterJoin = false;
let pendingReadyRoomId = null;
let cachedGameList = null;
let currentRoomList = [];
let pendingSeatClaimRoomId = null;
let pendingSeatClaimSourceId = null;
const roomControlsDockQuery = window.matchMedia("(max-width: 900px)");

const nameInput = document.getElementById("nameInput");
const connectionInfo = document.getElementById("connectionInfo");
const roomListEl = document.getElementById("roomList");
const refreshRoomsBtn = document.getElementById("refreshRoomsBtn");
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
const goldRushConfigBox = document.getElementById("goldRushConfigBox");
const goldRushModeRow = document.getElementById("goldRushModeRow");
const goldRushModeSelect = document.getElementById("goldRushModeSelect");
const texasHoldemConfigBox = document.getElementById("texasHoldemConfigBox");
const texasStartingChipsInput = document.getElementById("texasStartingChipsInput");
const texasSmallBlindInput = document.getElementById("texasSmallBlindInput");
const texasBigBlindInput = document.getElementById("texasBigBlindInput");
const mismatchConfigBox = document.getElementById("mismatchConfigBox");
const mismatchSliderCount = document.getElementById("mismatchSliderCount");
const autoSaveRow = document.getElementById("autoSaveRow");
const autoSaveToggle = document.getElementById("autoSaveToggle");
const caboPanel = document.getElementById("caboPanel");
const flip7Panel = document.getElementById("flip7Panel");
const yahtzeePanel = document.getElementById("yahtzeePanel");
const goldRushPanel = document.getElementById("goldRushPanel");
const incanGoldPanel = document.getElementById("incanGoldPanel");
const kobayakawaPanel = document.getElementById("kobayakawaPanel");
const skullPanel = document.getElementById("skullPanel");
const mismatchPanel = document.getElementById("mismatchPanel");
const coyotePanel = document.getElementById("coyotePanel");
const texasHoldemPanel = document.getElementById("texasHoldemPanel");
const halliPanel = document.getElementById("halliPanel");
const drawGuessPanel = document.getElementById("drawGuessPanel");
const cyberPicturesPanel = document.getElementById("cyberPicturesPanel");

const phaseLabel = document.getElementById("phaseLabel");
const roundLabel = document.getElementById("roundLabel");
const turnLabel = document.getElementById("turnLabel");
const deckCount = document.getElementById("deckCount");
const discardTop = document.getElementById("discardTop");
const lastDrawn = document.getElementById("lastDrawn");
const caboBy = document.getElementById("caboBy");
const caboLeft = document.getElementById("caboLeft");
const pendingChoice = document.getElementById("pendingChoice");

const handSlots = document.getElementById("handSlots");
const selectedSlotsLabel = document.getElementById("selectedSlots");
const targetSelection = document.getElementById("targetSelection");
const targetList = document.getElementById("targetList");
const clearTargetBtn = document.getElementById("clearTarget");
const gamePlayers = document.getElementById("gamePlayers");
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
const createRoomModalCloseBtn = document.getElementById("createRoomModalCloseBtn");
const gameSearchInput = document.getElementById("gameSearchInput");
const playerCountFilter = document.getElementById("playerCountFilter");
const gameListEl = document.getElementById("gameList");
const gameListEmpty = document.getElementById("gameListEmpty");
const seatClaimModal = document.getElementById("seatClaimModal");
const seatClaimCloseBtn = document.getElementById("seatClaimCloseBtn");
const seatClaimNameHint = document.getElementById("seatClaimNameHint");
const seatClaimRoomLabel = document.getElementById("seatClaimRoomLabel");
const seatClaimList = document.getElementById("seatClaimList");
const seatClaimEmpty = document.getElementById("seatClaimEmpty");
const roomControlsPanel = document.getElementById("roomControlsPanel");
const roomControlsToggleBtn = document.getElementById("roomControlsToggleBtn");
const abracaPanel = document.getElementById("abracaPanel");

const blokusPanel = document.getElementById("blokusPanel");

const actionButtons = {
  initial_peek: document.getElementById("peekBtn"),
  draw_deck: document.getElementById("drawDeckBtn"),
  draw_discard: discardTop,
  replace_or_match: document.getElementById("replaceBtn"),
  discard_drawn: document.getElementById("discardDrawnBtn"),
  call_cabo: document.getElementById("callCaboBtn"),
  use_choice_action: document.getElementById("choiceBtn"),
  next_round: document.getElementById("nextRoundBtn"),
};

const ROOM_AUTH_KEY = "openboardgame:room_auth";
const NAME_STORAGE_KEY = "openboardgame:name";

function loadStoredName() {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) || "";
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
  localStorage.setItem(NAME_STORAGE_KEY, nextName);
}

function clearStoredName() {
  localStorage.removeItem(NAME_STORAGE_KEY);
}

function hydrateNameInput() {
  if (!nameInput) {
    return;
  }
  const storedName = loadStoredName();
  if (storedName && !nameInput.value.trim()) {
    nameInput.value = storedName;
  }
}

function loadRoomAuthMap() {
  try {
    const raw = localStorage.getItem(ROOM_AUTH_KEY);
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
  localStorage.setItem(ROOM_AUTH_KEY, JSON.stringify(map));
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
  localStorage.removeItem(ROOM_AUTH_KEY);
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
  if (!currentRoomState && !lastGameStatePayload) {
    log("No game state available to copy.");
    return;
  }
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
  try {
    const res = await fetch("/api/games");
    cachedGameList = await res.json();
    return cachedGameList;
  } catch (err) {
    console.error("Failed to fetch game list", err);
    return [];
  }
}

function filterGames(games, searchText, playerCount) {
  return games.filter((g) => {
    const matchesSearch =
      !searchText ||
      g.name.toLowerCase().includes(searchText.toLowerCase()) ||
      g.game_id.toLowerCase().includes(searchText.toLowerCase());
    const matchesPlayers =
      !playerCount || (g.min_players <= playerCount && playerCount <= g.max_players);
    return matchesSearch && matchesPlayers;
  });
}

function renderGameList(games) {
  if (!gameListEl || !gameListEmpty) {
    return;
  }
  gameListEl.innerHTML = "";
  if (!games || !games.length) {
    gameListEmpty.classList.remove("hidden");
    return;
  }
  gameListEmpty.classList.add("hidden");
  games.forEach((g) => {
    const item = document.createElement("div");
    item.className = "game-item";
    item.dataset.gameId = g.game_id;
    const nameEl = document.createElement("span");
    nameEl.className = "game-item-name";
    nameEl.textContent = g.name;
    const playersEl = document.createElement("span");
    playersEl.className = "game-item-players";
    playersEl.textContent =
      g.min_players === g.max_players
        ? `${g.min_players} players`
        : `${g.min_players}-${g.max_players} players`;
    item.appendChild(nameEl);
    item.appendChild(playersEl);
    item.addEventListener("click", () => {
      selectGameFromModal(g.game_id);
    });
    gameListEl.appendChild(item);
  });
}

function selectGameFromModal(gameId) {
  const name = getPlayerName();
  if (!name) {
    log("Name required");
    closeCreateRoomModal();
    if (nameInput) {
      nameInput.focus();
    }
    return;
  }
  closeCreateRoomModal();
  socket.emit("room:create", { name, game_type: gameId });
}

async function applyGameFilters() {
  const games = await fetchGameList();
  const searchText = gameSearchInput ? gameSearchInput.value.trim() : "";
  const playerCount = playerCountFilter ? parseInt(playerCountFilter.value, 10) || 0 : 0;
  const filtered = filterGames(games, searchText, playerCount);
  renderGameList(filtered);
}

async function openCreateRoomModal() {
  if (!createRoomModal) {
    return;
  }
  if (gameSearchInput) {
    gameSearchInput.value = "";
  }
  if (playerCountFilter) {
    playerCountFilter.value = "";
  }
  setModalVisible(createRoomModal, true);
  await applyGameFilters();
}

function closeCreateRoomModal() {
  createRoomPending = false;
  setModalVisible(createRoomModal, false);
}

function openSeatClaimModal(roomId, sourceRoomId) {
  requestSeatClaim(roomId, sourceRoomId, true);
}

function closeSeatClaimModal() {
  clearPendingSeatClaim();
  setModalVisible(seatClaimModal, false);
}

function downloadSaveFile(sourceRoomId) {
  if (!sourceRoomId) {
    log("Missing source room id");
    return;
  }
  const url = `/api/room/save?source_room_id=${encodeURIComponent(sourceRoomId)}`;
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function parseDownloadFilename(headerValue) {
  if (!headerValue) {
    return null;
  }
  const utf8Match = headerValue.match(/filename\\*=UTF-8''([^;]+)/i);
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
  if (!currentGameType || !MEMORIES_SUPPORTED_GAMES.has(currentGameType)) {
    log("not supported");
    return;
  }
  const url = `/api/room/memories?room_id=${encodeURIComponent(activeRoomId)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      let message = "Download failed.";
      try {
        const data = await response.json();
        message = data.detail || data.message || message;
      } catch {
        try {
          const text = await response.text();
          if (text) message = text;
        } catch {}
      }
      log(message);
      return;
    }
    const blob = await response.blob();
    const filename =
      parseDownloadFilename(response.headers.get("Content-Disposition")) || "memories.html";
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    log("Download failed.");
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
    meta.textContent = `${timeValue} · ${version}`;

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
    downloadButton.addEventListener("click", () => {
      downloadSaveFile(save.source_room_id);
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
    meta.textContent = tags.join(" · ") || "available";
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
      const name = getPlayerName();
      if (!name) {
        log("Name required");
        if (nameInput) {
          nameInput.focus();
        }
        return;
      }
      socket.emit("room:claim_seat", { room_id: payload.room_id, seat: seat.seat, name });
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
  if (roomId) {
    socket.emit("room:leave", { room_id: roomId });
  }
  closeLoadModal();
  closeSeatClaimModal();
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

function getPlayerName() {
  return (nameInput ? nameInput.value : "").trim();
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

function setGamePanelVisibility(gameType) {
  const showCabo = gameType === "cabo";
  const showFlip7 = gameType === "flip7";
  const showYahtzee = gameType === "yahtzee";
  const showGoldRush = gameType === "gold_rush";
  const showIncanGold = gameType === "incan_gold";
  const showKobayakawa = gameType === "kobayakawa";
  const showSkull = gameType === "skull";
  const showCatInBox = gameType === "cat_in_box";
  const showHanabi = gameType === "hanabi";
  const showGang = gameType === "the_gang";
  const showMismatch = gameType === "perfect_mismatch";
  const showCoyote = gameType === "coyote";
  const showTexasHoldem = gameType === "texas_holdem";
  const showSixNimmt = gameType === "six_nimmt";
  const showHalli = gameType === "halli_galli";
  const showDecrypto = gameType === "decrypto";
  const showDrawGuess = gameType === "draw_guess";
  const showBlitzSketch = gameType === "blitz_sketch";
  const showCyber = gameType === "cyber_pictures";
  const showAidixit = gameType === "aidixit";
  const showImpression = gameType === "impression_flower";
  const showSplendor = gameType === "splendor";
  const showPointSalad = gameType === "point_salad";
  const showAbraca = gameType === "abraca_what";
  const showTrekking = gameType === "trekking_history";
  const showBlokus = gameType === "blokus";
  const showProjectL = gameType === "project_l";
  const showCarcassonne = gameType === "carcassonne";
  const showFangNiao = gameType === "fang_niao";
  caboPanel.classList.toggle("hidden", !showCabo);
  if (flip7Panel) {
    flip7Panel.classList.toggle("hidden", !showFlip7);
  }
  if (yahtzeePanel) {
    yahtzeePanel.classList.toggle("hidden", !showYahtzee);
  }
  if (goldRushPanel) {
    goldRushPanel.classList.toggle("hidden", !showGoldRush);
  }
  if (incanGoldPanel) {
    incanGoldPanel.classList.toggle("hidden", !showIncanGold);
  }
  if (kobayakawaPanel) {
    kobayakawaPanel.classList.toggle("hidden", !showKobayakawa);
  }
  skullPanel.classList.toggle("hidden", !showSkull);
  if (catInBoxPanel) {
    catInBoxPanel.classList.toggle("hidden", !showCatInBox);
  }
  if (hanabiPanel) {
    hanabiPanel.classList.toggle("hidden", !showHanabi);
  }
  if (gangPanel) {
    gangPanel.classList.toggle("hidden", !showGang);
  }
  if (mismatchPanel) {
    mismatchPanel.classList.toggle("hidden", !showMismatch);
  }
  if (coyotePanel) {
    coyotePanel.classList.toggle("hidden", !showCoyote);
  }
  if (texasHoldemPanel) {
    texasHoldemPanel.classList.toggle("hidden", !showTexasHoldem);
  }
  if (sixNimmtPanel) {
    sixNimmtPanel.classList.toggle("hidden", !showSixNimmt);
  }
  if (halliPanel) {
    halliPanel.classList.toggle("hidden", !showHalli);
  }
  if (decryptoPanel) {
    decryptoPanel.classList.toggle("hidden", !showDecrypto);
  }
  drawGuessPanel.classList.toggle("hidden", !showDrawGuess);
  if (blitzSketchPanel) {
    blitzSketchPanel.classList.toggle("hidden", !showBlitzSketch);
  }
  if (cyberPicturesPanel) {
    cyberPicturesPanel.classList.toggle("hidden", !showCyber);
  }
  if (aidixitPanel) {
    aidixitPanel.classList.toggle("hidden", !showAidixit);
  }
  if (impressionFlowerPanel) {
    impressionFlowerPanel.classList.toggle("hidden", !showImpression);
  }
  if (splendorPanel) {
    splendorPanel.classList.toggle("hidden", !showSplendor);
  }
  if (pointSaladPanel) {
    pointSaladPanel.classList.toggle("hidden", !showPointSalad);
  }
  if (trekkingPanel) {
    trekkingPanel.classList.toggle("hidden", !showTrekking);
  }
  if (abracaPanel) {
    abracaPanel.classList.toggle("hidden", !showAbraca);
  }
  if (blokusPanel) {
    blokusPanel.classList.toggle("hidden", !showBlokus);
  }
  if (projectLPanel) {
    projectLPanel.classList.toggle("hidden", !showProjectL);
  }
  if (typeof showProjectLHeaderActions === "function") {
    showProjectLHeaderActions(showProjectL);
  }
  if (carcassonnePanel) {
    carcassonnePanel.classList.toggle("hidden", !showCarcassonne);
  }
  if (fangNiaoPanel) {
    fangNiaoPanel.classList.toggle("hidden", !showFangNiao);
  }
  document.body.classList.toggle("trekking-active", showTrekking);
}

function roomHasBots() {
  return (
    currentRoomState &&
    Array.isArray(currentRoomState.players) &&
    currentRoomState.players.some((player) => player && player.is_bot)
  );
}


function updateGoldRushConfigRow() {
  const showRow = currentRoomState && currentGameType === "gold_rush" && currentRoomState.status === "lobby";
  if (goldRushConfigBox) {
    goldRushConfigBox.classList.toggle("hidden", !showRow);
    goldRushConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (goldRushModeRow) {
    goldRushModeRow.classList.toggle("hidden", !showRow);
    goldRushModeRow.setAttribute("aria-hidden", (!showRow).toString());
  }
}


function updateTexasHoldemConfigRow() {
  const showRow = currentRoomState && currentGameType === "texas_holdem" && currentRoomState.status === "lobby";
  if (texasHoldemConfigBox) {
    texasHoldemConfigBox.classList.toggle("hidden", !showRow);
    texasHoldemConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function updateMismatchConfigRow() {
  const showRow = currentRoomState && currentGameType === "perfect_mismatch" && currentRoomState.status === "lobby";
  if (mismatchConfigBox) {
    mismatchConfigBox.classList.toggle("hidden", !showRow);
    mismatchConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
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

function updateRoomControlsDock() {
  if (!roomControlsPanel) {
    return;
  }
  const shouldDock =
    roomControlsDockQuery.matches &&
    roomControlsPanel.classList.contains("compact") &&
    roomControlsPanel.classList.contains("collapsed");
  document.body.classList.toggle("room-controls-docked", shouldDock);
  if (shouldDock) {
    const height = roomControlsPanel.getBoundingClientRect().height;
    document.documentElement.style.setProperty("--room-controls-bar-height", `${height}px`);
  } else {
    document.documentElement.style.removeProperty("--room-controls-bar-height");
  }
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
  if (isInGame && roomControlsDockQuery.matches && !roomControlsGameActive) {
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
  if (!name || !rid) {
    log("Name and room ID required");
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
  socket.emit("room:join", { name, room_id: rid });
}

function attemptReconnect(rid, auth) {
  if (!rid || !auth) {
    log("Reconnect info missing");
    return;
  }
  socket.emit("room:reconnect", {
    room_id: rid,
    player_id: auth.player_id,
    reconnect_token: auth.reconnect_token,
  });
}

function startCreateRoomFlow() {
  const name = getPlayerName();
  if (!name) {
    log("Name required");
    if (nameInput) {
      nameInput.focus();
    }
    return;
  }
  if (createRoomModal) {
    createRoomPending = true;
    openCreateRoomModal();
    return;
  }
  if (!gameSelect || !createGameRow) {
    socket.emit("room:create", { name, game_type: "cabo" });
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
    const joinActions = document.createElement("div");
    joinActions.className = "room-item-join-actions";
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
    joinActions.appendChild(joinBtn);

    if (!isLoaded) {
      const joinReadyBtn = document.createElement("button");
      joinReadyBtn.type = "button";
      joinReadyBtn.textContent = "Join Ready";
      joinReadyBtn.disabled = joinDisabled;
      joinReadyBtn.addEventListener("click", () => {
        attemptJoinRoom(room.room_id, { readyAfterJoin: true });
      });
      joinActions.appendChild(joinReadyBtn);
    }

    if (canReconnect) {
      const reconnectBtn = document.createElement("button");
      reconnectBtn.type = "button";
      reconnectBtn.textContent = "Reconnect";
      reconnectBtn.addEventListener("click", () => {
        attemptReconnect(room.room_id, auth);
      });
      joinActions.appendChild(reconnectBtn);
    }

    actions.appendChild(joinActions);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "room-delete-btn";
    deleteBtn.innerHTML = "&#128465;";
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
  roomId = null;
  currentRoomState = null;
  currentGameType = null;
  lastGameStatePayload = null;
  roomIdLabel.textContent = "-";
  roomStatus.textContent = "-";
  gameTypeLabel.textContent = "-";
  playersList.innerHTML = "";
  clearCaboState();
  clearFlip7State();
  clearYahtzeeState();
  clearGoldRushState();
  clearIncanGoldState();
  clearKobayakawaState();
  clearSkullState();
  clearCatInBoxState();
  clearGangState();
  clearMismatchState();
  clearCoyoteState();
  clearTexasHoldemState();
  clearSixNimmtState();
  clearHalliState();
  clearDecryptoState();
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
  updateHanabiConfigRow();
  updateTexasHoldemConfigRow();
  updateMismatchConfigRow();
  updateGangConfigRow();
  updateImpressionConfigRow();
  updateBlitzSketchConfigRow();
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
  if (impressionVoteToggle) {
    impressionVoteToggle.checked = false;
  }
  createRoomPending = false;
  setCreateGameRowVisible(false);
  updateRoomControlsForStatus(null);
}

function clearCaboState() {
  currentCaboView = null;
  selectedSlots = [];
  selectedTarget = null;
  phaseLabel.textContent = "-";
  roundLabel.textContent = "-";
  turnLabel.textContent = "-";
  deckCount.textContent = "-";
  discardTop.textContent = "-";
  lastDrawn.textContent = "-";
  caboBy.textContent = "-";
  caboLeft.textContent = "-";
  pendingChoice.textContent = "-";
  handSlots.innerHTML = "";
  if (selectedSlotsLabel) {
    selectedSlotsLabel.textContent = "-";
  }
  if (targetSelection) {
    targetSelection.textContent = "-";
  }
  if (targetList) {
    targetList.innerHTML = "";
  }
  gamePlayers.innerHTML = "";
  updateActionButtons();
}

function clearFangNiaoState() {
  currentFangNiaoView = null;
  fangNiaoSelectedBird = null;
  fangNiaoSelectedRow = null;
  fangNiaoSelectedSide = null;
  if (fangNiaoPhaseLabel) {
    fangNiaoPhaseLabel.textContent = "-";
  }
  if (fangNiaoTurnLabel) {
    fangNiaoTurnLabel.textContent = "-";
  }
  if (fangNiaoDeckLabel) {
    fangNiaoDeckLabel.textContent = "-";
  }
  if (fangNiaoDiscardLabel) {
    fangNiaoDiscardLabel.textContent = "-";
  }
  if (fangNiaoWinnerLabel) {
    fangNiaoWinnerLabel.textContent = "-";
  }
  if (fangNiaoLastActionLabel) {
    fangNiaoLastActionLabel.textContent = "-";
  }
  if (fangNiaoRows) {
    fangNiaoRows.innerHTML = "";
  }
  if (fangNiaoHand) {
    fangNiaoHand.innerHTML = "";
  }
  if (fangNiaoPlayers) {
    fangNiaoPlayers.innerHTML = "";
  }
  updateFangNiaoSelectionLabels();
  updateFangNiaoActionButtons();
}

function logGameEvents(data) {
  if (!data.events || !data.events.length) {
    return;
  }
  data.events.forEach((evt) => {
    if (evt.type === "bot:action" || evt.type === "player:action") {
      const payload = evt.payload || {};
      const isBot = evt.type === "bot:action";
      const label = isBot ? "Bot" : "Player";
      const name = payload.name || label;
      log(`${label} ${name}: ${JSON.stringify(payload.action)}`);
    } else {
      log(`${evt.type}`);
    }
  });
}

function getFangNiaoConfig(view) {
  return view && Array.isArray(view.bird_config) ? view.bird_config : [];
}

function getFangNiaoConfigMap(view) {
  const map = {};
  getFangNiaoConfig(view).forEach((item) => {
    if (item && item.id) {
      map[item.id] = item;
    }
  });
  return map;
}

function countFangNiaoCards(hand) {
  const counts = {};
  (hand || []).forEach((card) => {
    counts[card] = (counts[card] || 0) + 1;
  });
  return counts;
}

function formatFangNiaoBirdLabel(view, birdType) {
  const meta = FANG_NIAO_BIRD_META[birdType] || {};
  const configMap = getFangNiaoConfigMap(view);
  const cfg = configMap[birdType] || {};
  const name = meta.name || cfg.name || birdType || "-";
  const emoji = meta.emoji || "🐦";
  return `${emoji} ${name}`;
}

function isFangNiaoBankable(view, birdType) {
  if (!view || !birdType) {
    return false;
  }
  const configMap = getFangNiaoConfigMap(view);
  const cfg = configMap[birdType];
  if (!cfg) {
    return false;
  }
  const counts = countFangNiaoCards(Array.isArray(view.hand) ? view.hand : []);
  const count = counts[birdType] || 0;
  const small = Number(cfg.small);
  if (Number.isFinite(small)) {
    return count >= small;
  }
  return count > 0;
}

function updateFangNiaoSelectionLabels() {
  if (fangNiaoSelectedBirdLabel) {
    if (fangNiaoSelectedBird) {
      fangNiaoSelectedBirdLabel.textContent = formatFangNiaoBirdLabel(currentFangNiaoView, fangNiaoSelectedBird);
    } else {
      fangNiaoSelectedBirdLabel.textContent = "-";
    }
  }
  if (fangNiaoSelectedRowLabel) {
    fangNiaoSelectedRowLabel.textContent =
      Number.isInteger(fangNiaoSelectedRow) ? `Row ${fangNiaoSelectedRow + 1}` : "-";
  }
  if (fangNiaoSelectedSideLabel) {
    if (fangNiaoSelectedSide === "left") {
      fangNiaoSelectedSideLabel.textContent = "Left ⬅️";
    } else if (fangNiaoSelectedSide === "right") {
      fangNiaoSelectedSideLabel.textContent = "Right ➡️";
    } else {
      fangNiaoSelectedSideLabel.textContent = "-";
    }
  }
}

function selectFangNiaoRow(rowIndex, side) {
  fangNiaoSelectedRow = rowIndex;
  fangNiaoSelectedSide = side;
  updateFangNiaoSelectionLabels();
  updateFangNiaoActionButtons();
  if (currentFangNiaoView) {
    renderFangNiaoRows(currentFangNiaoView);
  }
}

function renderFangNiaoRows(view) {
  if (!fangNiaoRows) {
    return;
  }
  fangNiaoRows.innerHTML = "";
  const rows = Array.isArray(view.rows) ? view.rows : [];
  if (!rows.length) {
    fangNiaoRows.textContent = "-";
    return;
  }
  rows.forEach((row, idx) => {
    const isSelectedRow = idx === fangNiaoSelectedRow;
    const hasPreview =
      isSelectedRow && !!fangNiaoSelectedBird && (fangNiaoSelectedSide === "left" || fangNiaoSelectedSide === "right");
    const captureIndices = [];
    if (hasPreview && Array.isArray(row) && row.length) {
      let matchIndex = -1;
      if (fangNiaoSelectedSide === "left") {
        matchIndex = row.findIndex((birdType) => birdType === fangNiaoSelectedBird);
        if (matchIndex > 0) {
          for (let i = 0; i < matchIndex; i += 1) {
            captureIndices.push(i);
          }
        }
      } else if (fangNiaoSelectedSide === "right") {
        for (let i = row.length - 1; i >= 0; i -= 1) {
          if (row[i] === fangNiaoSelectedBird) {
            matchIndex = i;
            break;
          }
        }
        if (matchIndex >= 0 && matchIndex < row.length - 1) {
          for (let i = matchIndex + 1; i < row.length; i += 1) {
            captureIndices.push(i);
          }
        }
      }
    }

    const rowEl = document.createElement("div");
    rowEl.className = "fang-niao-row";
    if (isSelectedRow) {
      rowEl.classList.add("selected");
    }

    const labelEl = document.createElement("div");
    labelEl.className = "fang-niao-row-label";
    labelEl.textContent = `Row ${idx + 1}`;

    const leftBtn = document.createElement("button");
    leftBtn.type = "button";
    leftBtn.className = "fang-niao-side-btn";
    leftBtn.textContent = "⬅️";
    if (idx === fangNiaoSelectedRow && fangNiaoSelectedSide === "left") {
      leftBtn.classList.add("selected");
    }
    leftBtn.addEventListener("click", () => selectFangNiaoRow(idx, "left"));

    const rightBtn = document.createElement("button");
    rightBtn.type = "button";
    rightBtn.className = "fang-niao-side-btn";
    rightBtn.textContent = "➡️";
    if (idx === fangNiaoSelectedRow && fangNiaoSelectedSide === "right") {
      rightBtn.classList.add("selected");
    }
    rightBtn.addEventListener("click", () => selectFangNiaoRow(idx, "right"));

    const cardsEl = document.createElement("div");
    cardsEl.className = "fang-niao-row-cards";
    if (!Array.isArray(row) || !row.length) {
      const empty = document.createElement("span");
      empty.className = "fang-niao-card";
      empty.textContent = "-";
      cardsEl.appendChild(empty);
    } else {
      row.forEach((birdType, cardIndex) => {
        const meta = FANG_NIAO_BIRD_META[birdType] || {};
        const name = meta.name || birdType;
        const emoji = meta.emoji || "🐦";
        const chip = document.createElement("span");
        chip.className = "fang-niao-card";
        chip.textContent = `${emoji} ${name}`;
        chip.title = name;
        if (cardIndex === 0 || cardIndex === row.length - 1) {
          chip.classList.add("fang-niao-card-end");
        }
        if (hasPreview && captureIndices.includes(cardIndex)) {
          chip.classList.add("fang-niao-card-capture");
        }
        if (meta.color) {
          chip.style.backgroundColor = meta.color;
        }
        cardsEl.appendChild(chip);
      });
    }

    if (hasPreview) {
      const previewTag = document.createElement("span");
      previewTag.className = "fang-niao-capture-preview";
      if (captureIndices.length) {
        previewTag.classList.add("ok");
        previewTag.textContent = `可吃 ${captureIndices.length} 张`;
      } else {
        previewTag.classList.add("none");
        previewTag.textContent = "无可吃";
      }
      cardsEl.appendChild(previewTag);
    }

    rowEl.appendChild(labelEl);
    rowEl.appendChild(leftBtn);
    rowEl.appendChild(cardsEl);
    rowEl.appendChild(rightBtn);
    fangNiaoRows.appendChild(rowEl);
  });
}

function renderFangNiaoHand(view) {
  if (!fangNiaoHand) {
    return;
  }
  fangNiaoHand.innerHTML = "";
  const hand = Array.isArray(view.hand) ? view.hand : [];
  if (!hand.length) {
    fangNiaoHand.textContent = "-";
    return;
  }
  const counts = countFangNiaoCards(hand);
  const configList = getFangNiaoConfig(view);
  const configMap = getFangNiaoConfigMap(view);
  const order = configList.length ? configList.map((cfg) => cfg.id) : Object.keys(counts);
  order.forEach((birdType) => {
    const count = counts[birdType] || 0;
    if (!count) {
      return;
    }
    const meta = FANG_NIAO_BIRD_META[birdType] || {};
    const cfg = configMap[birdType] || {};
    const labelName = meta.name || cfg.name || birdType;
    const labelEmoji = meta.emoji || "🐦";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fang-niao-hand-btn";
    if (birdType === fangNiaoSelectedBird) {
      btn.classList.add("selected");
    }
    const small = Number(cfg.small);
    if (Number.isFinite(small) && count >= small) {
      btn.classList.add("bankable");
    }
    const titleSpan = document.createElement("span");
    titleSpan.className = "fang-niao-hand-title";
    titleSpan.textContent = `${labelEmoji} ${labelName} ×${count}`;
    btn.appendChild(titleSpan);
    const big = Number(cfg.big);
    if (Number.isFinite(small)) {
      const thresholdSpan = document.createElement("span");
      thresholdSpan.className = "fang-niao-hand-threshold";
      thresholdSpan.textContent = `小${cfg.small} / 大${Number.isFinite(big) ? cfg.big : "-"}`;
      btn.appendChild(thresholdSpan);
    }
    btn.title = Number.isFinite(small) ? `S${cfg.small} / B${cfg.big || "-"}` : "";
    if (meta.color) {
      btn.style.borderColor = meta.color;
    }
    btn.addEventListener("click", () => {
      fangNiaoSelectedBird = birdType;
      updateFangNiaoSelectionLabels();
      updateFangNiaoActionButtons();
      renderFangNiaoRows(view);
      renderFangNiaoHand(view);
    });
    fangNiaoHand.appendChild(btn);
  });
}

function renderFangNiaoPlayers(view) {
  if (!fangNiaoPlayers) {
    return;
  }
  fangNiaoPlayers.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  const configList = getFangNiaoConfig(view);
  const order = configList.length ? configList.map((cfg) => cfg.id) : [];
  players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "fang-niao-player";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    const header = document.createElement("div");
    header.className = "fang-niao-player-header";
    const handCount = Number.isInteger(player.hand_count) ? player.hand_count : (player.hand_count ?? "-");
    header.textContent = `${player.name || player.player_id} · Hand ${handCount}`;
    card.appendChild(header);

    const collection = document.createElement("div");
    collection.className = "fang-niao-collection";
    const entries = player.collection || {};
    let hasChip = false;
    const birdOrder = order.length ? order : Object.keys(entries);
    birdOrder.forEach((birdType) => {
      const count = entries[birdType];
      if (!count) {
        return;
      }
      hasChip = true;
      const meta = FANG_NIAO_BIRD_META[birdType] || {};
      const chip = document.createElement("div");
      chip.className = "fang-niao-collection-chip";
      chip.textContent = `${meta.emoji || "🐦"} ${meta.name || birdType} ×${count}`;
      if (meta.color) {
        chip.style.backgroundColor = meta.color;
      }
      collection.appendChild(chip);
    });
    if (!hasChip) {
      collection.textContent = "-";
    }
    card.appendChild(collection);
    fangNiaoPlayers.appendChild(card);
  });
}

function formatFangNiaoLastAction(view) {
  const last = view.last_action;
  if (!last || !last.type) {
    return "-";
  }
  const actor = last.player_id ? findPlayerName(view, last.player_id) : "Unknown";
  if (last.type === "play") {
    const bird = formatFangNiaoBirdLabel(view, last.bird_type);
    const rowLabel = Number.isInteger(last.row_index) ? `Row ${last.row_index + 1}` : "Row ?";
    const sideLabel = last.side === "left" ? "Left ⬅️" : last.side === "right" ? "Right ➡️" : "-";
    const captured = Number.isInteger(last.captured) ? `, captured ${last.captured}` : "";
    const drew = Number.isInteger(last.drew) && last.drew > 0 ? `, drew ${last.drew}` : "";
    return `${actor}: ${bird} → ${rowLabel} ${sideLabel}${captured}${drew}`;
  }
  if (last.type === "bank") {
    const bird = formatFangNiaoBirdLabel(view, last.bird_type);
    const kept = Number.isInteger(last.kept) ? last.kept : "-";
    const discarded = Number.isInteger(last.discarded) ? last.discarded : "-";
    return `${actor}: bank ${bird} (keep ${kept}, discard ${discarded})`;
  }
  if (last.type === "end") {
    return last.reset ? `${actor}: end turn (reset)` : `${actor}: end turn`;
  }
  return `${actor}: ${last.type}`;
}

function updateFangNiaoActionButtons() {
  if (!fangNiaoPlayBtn && !fangNiaoBankBtn && !fangNiaoEndBtn) {
    return;
  }
  const view = currentFangNiaoView;
  const legal = view && Array.isArray(view.legal_actions) ? view.legal_actions : [];
  const canPlay =
    legal.includes("play_birds") &&
    fangNiaoSelectedBird &&
    Number.isInteger(fangNiaoSelectedRow) &&
    !!fangNiaoSelectedSide;
  const canBank =
    legal.includes("bank_birds") &&
    fangNiaoSelectedBird &&
    isFangNiaoBankable(view, fangNiaoSelectedBird);
  const canEnd = legal.includes("end_turn");

  if (fangNiaoPlayBtn) {
    fangNiaoPlayBtn.disabled = !canPlay;
  }
  if (fangNiaoBankBtn) {
    fangNiaoBankBtn.disabled = !canBank;
  }
  if (fangNiaoEndBtn) {
    fangNiaoEndBtn.disabled = !canEnd;
  }
}

function renderFangNiaoGameState(data) {
  const view = data.view;
  currentFangNiaoView = view;
  if (currentGameType !== "fang_niao") {
    currentGameType = "fang_niao";
    setGamePanelVisibility("fang_niao");
  }

  if (fangNiaoSelectedBird && (!Array.isArray(view.hand) || !view.hand.includes(fangNiaoSelectedBird))) {
    fangNiaoSelectedBird = null;
  }
  if (Number.isInteger(fangNiaoSelectedRow)) {
    if (!Array.isArray(view.rows) || fangNiaoSelectedRow >= view.rows.length) {
      fangNiaoSelectedRow = null;
      fangNiaoSelectedSide = null;
    }
  }
  if (!Number.isInteger(fangNiaoSelectedRow)) {
    fangNiaoSelectedSide = null;
  }

  if (fangNiaoPhaseLabel) {
    fangNiaoPhaseLabel.textContent = view.phase || "-";
  }
  if (fangNiaoTurnLabel) {
    const currentPlayer = (view.players || []).find((p) => p.player_id === view.current_turn);
    fangNiaoTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (fangNiaoDeckLabel) {
    fangNiaoDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (fangNiaoDiscardLabel) {
    fangNiaoDiscardLabel.textContent = view.discard_count ?? "-";
  }
  if (fangNiaoWinnerLabel) {
    fangNiaoWinnerLabel.textContent = view.winner ? findPlayerName(view, view.winner) : "-";
  }
  if (fangNiaoLastActionLabel) {
    fangNiaoLastActionLabel.textContent = formatFangNiaoLastAction(view);
  }

  renderFangNiaoRows(view);
  renderFangNiaoHand(view);
  renderFangNiaoPlayers(view);
  updateFangNiaoSelectionLabels();
  updateFangNiaoActionButtons();
  logGameEvents(data);
}

function renderCaboGameState(data) {
  const view = data.view;
  currentCaboView = view;
  if (currentGameType !== "cabo") {
    currentGameType = "cabo";
    setGamePanelVisibility("cabo");
  }
  const needsTarget =
    view.pending_choice &&
    (view.pending_choice.type === "spy" || view.pending_choice.type === "swap");
  if (!needsTarget) {
    selectedTarget = null;
  } else if (selectedTarget) {
    const targetPlayer = view.players.find((p) => p.player_id === selectedTarget.playerId);
    const targetSlot =
      targetPlayer && Array.isArray(targetPlayer.hand)
        ? targetPlayer.hand[selectedTarget.slot]
        : null;
    if (!targetPlayer || !targetSlot || targetSlot.empty) {
      selectedTarget = null;
    }
  }

  phaseLabel.textContent = view.phase;
  roundLabel.textContent = view.round;
  const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
  turnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn;
  deckCount.textContent = view.deck_count;
  discardTop.textContent = view.discard_top === null ? "-" : view.discard_top;
  if (view.last_drawn === null || view.last_drawn === undefined) {
    lastDrawn.textContent = "-";
  } else {
    const choiceMap = {
      7: "peek",
      8: "peek",
      9: "spy",
      10: "spy",
      11: "swap",
      12: "swap",
    };
    const choice = choiceMap[view.last_drawn];
    lastDrawn.textContent = choice ? `${view.last_drawn} (${choice})` : String(view.last_drawn);
  }
  const caboCaller = view.players.find((p) => p.player_id === view.cabo_called_by);
  caboBy.textContent = caboCaller ? caboCaller.name : view.cabo_called_by || "-";
  caboLeft.textContent = view.cabo_turns_left || "-";
  pendingChoice.textContent = view.pending_choice ? view.pending_choice.type : "-";

  renderHand(view);
  renderGamePlayers(view);

  logGameEvents(data);

  if (view.last_round_summary) {
    const summary = view.last_round_summary;
    log(`Round summary: scores ${JSON.stringify(summary.round_scores)}`);
  }

  updateActionButtons();
}

function renderGameState(data) {
  const gameType = data.game_type || (currentRoomState && currentRoomState.game_type);
  if (gameType === "cabo") {
    renderCaboGameState(data);
    return;
  }
  if (gameType === "flip7") {
    renderFlip7GameState(data);
    return;
  }
  if (gameType === "yahtzee") {
    renderYahtzeeGameState(data);
    return;
  }
  if (gameType === "gold_rush") {
    renderGoldRushGameState(data);
    return;
  }
  if (gameType === "incan_gold") {
    renderIncanGoldGameState(data);
    return;
  }
  if (gameType === "kobayakawa") {
    renderKobayakawaGameState(data);
    return;
  }
  if (gameType === "skull") {
    renderSkullGameState(data);
    return;
  }
  if (gameType === "cat_in_box") {
    renderCatInBoxGameState(data);
    return;
  }
  if (gameType === "hanabi") {
    renderHanabiGameState(data);
    return;
  }
  if (gameType === "the_gang") {
    renderGangGameState(data);
    return;
  }
  if (gameType === "perfect_mismatch") {
    renderMismatchGameState(data);
    return;
  }
  if (gameType === "coyote") {
    renderCoyoteGameState(data);
    return;
  }
  if (gameType === "texas_holdem") {
    renderTexasHoldemGameState(data);
    return;
  }
  if (gameType === "six_nimmt") {
    renderSixNimmtGameState(data);
    return;
  }
  if (gameType === "halli_galli") {
    renderHalliGameState(data);
    return;
  }
  if (gameType === "aidixit") {
    renderAidixitGameState(data);
    return;
  }
  if (gameType === "decrypto") {
    renderDecryptoGameState(data);
    return;
  }
  if (gameType === "draw_guess") {
    renderDrawGuessGameState(data);
    return;
  }
  if (gameType === "blitz_sketch") {
    renderBlitzSketchGameState(data);
    return;
  }
  if (gameType === "cyber_pictures") {
    renderCyberPicturesGameState(data);
    return;
  }
  if (gameType === "impression_flower") {
    renderImpressionGameState(data);
    return;
  }
  if (gameType === "abraca_what") {
    renderAbracaGameState(data);
    return;
  }
  if (gameType === "blokus") {
    renderBlokusGameState(data);
    return;
  }
  if (gameType === "project_l") {
    renderProjectLGameState(data);
    return;
  }
  if (gameType === "carcassonne") {
    renderCarcassonneGameState(data);
    return;
  }
  if (gameType === "fang_niao") {
    renderFangNiaoGameState(data);
    return;
  }
  if (gameType === "point_salad") {
    renderPointSaladGameState(data);
    return;
  }
  if (gameType === "trekking_history") {
    renderTrekkingGameState(data);
    return;
  }
  if (gameType === "splendor") {
    renderSplendorGameState(data);
  }
}

socket.on("connect", () => {
  requestRoomList();
});

socket.on("system:info", (data) => {
  if (data.player_id) {
    playerId = data.player_id;
  }
  if (data.reconnect_token && data.room_id && data.player_id) {
    const nameValue = data.name || (nameInput ? nameInput.value.trim() : "");
    setRoomAuth(data.room_id, {
      player_id: data.player_id,
      reconnect_token: data.reconnect_token,
      name: nameValue,
    });
  }
  if (data.message) {
    setConnectionInfo(data.message);
    log(data.message);
  }
});

socket.on("system:error", (data) => {
  log(`Error: ${data.message}`);
});

socket.on("room:state", (state) => {
  renderRoomState(state);
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

socket.on("game:state", (data) => {
  lastGameStatePayload = data;
  renderGameState(data);
});

// UI actions

hydrateNameInput();
if (nameInput) {
  nameInput.addEventListener("input", () => {
    saveStoredName(nameInput.value);
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    performLogout();
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
    const name = getPlayerName();
    if (!name) {
      log("Name required");
      createRoomPending = false;
      setCreateGameRowVisible(false);
      return;
    }
    createRoomPending = false;
    setCreateGameRowVisible(false);
    socket.emit("room:create", { name, game_type: gameType });
  });
}

document.getElementById("joinBtn").addEventListener("click", () => {
  const rid = document.getElementById("roomIdInput").value.trim();
  attemptJoinRoom(rid);
});

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

document.getElementById("readyBtn").addEventListener("click", () => {
  let nextReady = true;
  if (currentRoomState && playerId) {
    const me = currentRoomState.players.find((p) => p.player_id === playerId);
    if (me) {
      nextReady = !me.ready;
    }
  }
  socket.emit("room:ready", { room_id: roomId, ready: nextReady });
});

document.getElementById("startBtn").addEventListener("click", () => {
  emitRoomStart();
});

if (reopenBtn) {
  reopenBtn.addEventListener("click", () => {
    if (!roomId || !currentRoomState) {
      log("Not in a room");
      return;
    }
    if (currentRoomState.status !== "game_over") {
      const proceed = window.confirm("Reopen will lose all progress, continue?");
      if (!proceed) {
        return;
      }
    }
    socket.emit("room:reopen", { room_id: roomId });
  });
}

if (downloadMemoriesBtn) {
  downloadMemoriesBtn.addEventListener("click", () => {
    const activeRoomId = roomId || (currentRoomState && currentRoomState.room_id);
    downloadMemoriesFile(activeRoomId);
  });
}

document.getElementById("addBotBtn").addEventListener("click", () => {
  socket.emit("room:add_bot", { room_id: roomId });
});

if (autoSaveToggle) {
  autoSaveToggle.addEventListener("change", () => {
    if (!roomId) {
      log("Not in a room");
      autoSaveToggle.checked = false;
      return;
    }
    socket.emit("room:auto_save", { room_id: roomId, auto_save: autoSaveToggle.checked });
  });
}

if (removeBotBtn) {
  removeBotBtn.addEventListener("click", () => {
    if (!roomId) {
      log("Not in a room");
      return;
    }
    socket.emit("room:remove_bot", { room_id: roomId });
  });
}

if (leaveBtn) {
  leaveBtn.addEventListener("click", () => {
    if (!roomId) {
      log("Not in a room");
      return;
    }
    socket.emit("room:leave", { room_id: roomId });
    resetRoomState();
    closeSeatClaimModal();
    log("Left room");
  });
}

document.getElementById("clearSelection").addEventListener("click", () => {
  clearSelection();
});

if (clearTargetBtn) {
  clearTargetBtn.addEventListener("click", () => {
    clearTargetSelection();
  });
}

document.getElementById("peekBtn").addEventListener("click", () => {
  if (selectedSlots.length !== 2) {
    log("Select two slots for initial peek");
    return;
  }
  sendAction({ type: "initial_peek", slots: selectedSlots.slice(0, 2) });
  clearSelection();
});

document.getElementById("drawDeckBtn").addEventListener("click", () => {
  sendAction({ type: "draw_deck" });
});

if (discardTop) {
  discardTop.addEventListener("click", () => {
    if (!selectedSlots.length) {
      log("Select a slot to replace from discard");
      return;
    }
    sendAction({ type: "draw_discard", slot: selectedSlots[0] });
    clearSelection();
  });
}

document.getElementById("replaceBtn").addEventListener("click", () => {
  if (!selectedSlots.length) {
    log("Select 1 slot to replace or 2-4 slots to match");
    return;
  }
  if (selectedSlots.length >= 2) {
    sendAction({ type: "attempt_match", slots: selectedSlots.slice(0, 4) });
  } else {
    sendAction({ type: "replace_card", slot: selectedSlots[0] });
  }
  clearSelection();
});

document.getElementById("discardDrawnBtn").addEventListener("click", () => {
  sendAction({ type: "discard_drawn" });
});

document.getElementById("callCaboBtn").addEventListener("click", () => {
  sendAction({ type: "call_cabo" });
});

document.getElementById("nextRoundBtn").addEventListener("click", () => {
  sendAction({ type: "next_round" });
});

document.getElementById("choiceBtn").addEventListener("click", () => {
  if (!currentCaboView || !currentCaboView.pending_choice) {
    log("No pending choice");
    return;
  }
  const choiceType = currentCaboView.pending_choice.type;
  if (choiceType === "peek") {
    if (!selectedSlots.length) {
      log("Select one of your slots to peek");
      return;
    }
    const slot = selectedSlots[0];
    sendAction({
      type: "use_choice_action",
      choice_type: "peek",
      target: { slot },
    });
  } else if (choiceType === "spy") {
    if (!selectedTarget) {
      log("Select a target slot to spy");
      return;
    }
    sendAction({
      type: "use_choice_action",
      choice_type: "spy",
      target: { player_id: selectedTarget.playerId, slot: selectedTarget.slot },
    });
  } else if (choiceType === "swap") {
    if (!selectedTarget || !selectedSlots.length) {
      log("Select one of your slots and a target slot to swap");
      return;
    }
    const self = selectedSlots[0];
    sendAction({
      type: "use_choice_action",
      choice_type: "swap",
      target: {
        player_id: selectedTarget.playerId,
        slot: selectedTarget.slot,
        self_slot: self,
      },
    });
  }
  clearSelection();
  clearTargetSelection();
});

if (fangNiaoClearSelectionBtn) {
  fangNiaoClearSelectionBtn.addEventListener("click", () => {
    fangNiaoSelectedBird = null;
    fangNiaoSelectedRow = null;
    fangNiaoSelectedSide = null;
    updateFangNiaoSelectionLabels();
    updateFangNiaoActionButtons();
    if (currentFangNiaoView) {
      renderFangNiaoRows(currentFangNiaoView);
      renderFangNiaoHand(currentFangNiaoView);
    }
  });
}

if (fangNiaoPlayBtn) {
  fangNiaoPlayBtn.addEventListener("click", () => {
    if (!currentFangNiaoView || !Array.isArray(currentFangNiaoView.legal_actions)) {
      return;
    }
    if (!currentFangNiaoView.legal_actions.includes("play_birds")) {
      log("Not your turn");
      return;
    }
    if (!fangNiaoSelectedBird) {
      log("Select a bird");
      return;
    }
    if (!Number.isInteger(fangNiaoSelectedRow)) {
      log("Select a row");
      return;
    }
    if (!fangNiaoSelectedSide) {
      log("Select a side");
      return;
    }
    sendAction({
      type: "play_birds",
      bird_type: fangNiaoSelectedBird,
      row_index: fangNiaoSelectedRow,
      side: fangNiaoSelectedSide,
    });
  });
}

if (fangNiaoBankBtn) {
  fangNiaoBankBtn.addEventListener("click", () => {
    if (!currentFangNiaoView || !Array.isArray(currentFangNiaoView.legal_actions)) {
      return;
    }
    if (!currentFangNiaoView.legal_actions.includes("bank_birds")) {
      log("Not your turn");
      return;
    }
    if (!fangNiaoSelectedBird) {
      log("Select a bird");
      return;
    }
    if (!isFangNiaoBankable(currentFangNiaoView, fangNiaoSelectedBird)) {
      log("Not enough birds to bank");
      return;
    }
    sendAction({ type: "bank_birds", bird_type: fangNiaoSelectedBird });
  });
}

if (fangNiaoEndBtn) {
  fangNiaoEndBtn.addEventListener("click", () => {
    if (!currentFangNiaoView || !Array.isArray(currentFangNiaoView.legal_actions)) {
      return;
    }
    if (!currentFangNiaoView.legal_actions.includes("end_turn")) {
      log("Not your turn");
      return;
    }
    sendAction({ type: "end_turn" });
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
      roomControlsAutoCollapsed = false;
      updateRoomControlsDock();
    }
  });
});

window.addEventListener("resize", () => {
  updateRoomControlsDock();
});

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

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
