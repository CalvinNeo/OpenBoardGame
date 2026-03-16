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
const createRoomModalCloseBtn = document.getElementById("createRoomModalCloseBtn");
const gameSearchInput = document.getElementById("gameSearchInput");
const playerCountFilter = document.getElementById("playerCountFilter");
const gameSortSelect = document.getElementById("gameSortSelect");
const gameListCount = document.getElementById("gameListCount");
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

const GAME_WEIGHT = {
  abraca_what: 1.64,
  aidixit: 1.19,
  azul: 1.78,
  blokus: 1.73,
  cabo: 1.4,
  carcassonne: 1.89,
  cat_in_box: 2.03,
  coyote: 1.3,
  decrypto: 1.82,
  flip7: 1.03,
  halli_galli: 1.02,
  hanabi: 1.69,
  incan_gold: 1.11,
  kobayakawa: 1.2,
  perfect_mismatch: 1.0,
  point_salad: 1.15,
  project_l: 1.53,
  six_nimmt: 1.19,
  skull: 1.12,
  splendor: 1.78,
  the_gang: 1.58,
  trekking_history: 1.76,
  yahtzee: 1.17,
};

function getGameWeight(gameId) {
  const weight = GAME_WEIGHT[gameId];
  return Number.isFinite(weight) ? weight : null;
}

function formatGameWeight(gameId) {
  const weight = getGameWeight(gameId);
  return Number.isFinite(weight) ? weight.toFixed(2) : "?";
}

function getGameSortKey() {
  if (!gameSortSelect) {
    return "alpha";
  }
  return gameSortSelect.value || "alpha";
}

function sortGames(games, sortKey) {
  const ordered = [...games];
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
    gameListEmpty.classList.remove("hidden");
    return;
  }
  gameListEmpty.classList.add("hidden");
  games.forEach((g) => {
    const item = document.createElement("div");
    item.className = "game-item";
    item.dataset.gameId = g.game_id;
    const weightLabel = formatGameWeight(g.game_id);
    item.title = `BGG Weight: ${weightLabel}`;
    const nameEl = document.createElement("span");
    nameEl.className = "game-item-name";
    nameEl.textContent = `${g.name} (${weightLabel})`;
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

function updateGameListCount(count) {
  if (!gameListCount) {
    return;
  }
  const safeCount = Number.isFinite(count) && count >= 0 ? count : 0;
  const label = safeCount === 1 ? "game" : "games";
  gameListCount.textContent = `Showing ${safeCount} ${label}`;
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
  const sortKey = getGameSortKey();
  const sorted = sortGames(filtered, sortKey);
  updateGameListCount(sorted.length);
  renderGameList(sorted);
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
  if (gameSortSelect) {
    gameSortSelect.value = "alpha";
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
