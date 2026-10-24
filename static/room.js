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
let roomControlsPopoverOpen = false;
let roomControlsDockSide = "left";
let roomControlsDragState = null;
let roomControlsExplainDockDeferred = false;
let roomControlsExplainButton = null;
let roomControlsExplainAnchor = null;
let createRoomPending = false;
let pendingReadyAfterJoin = false;
let pendingReadyRoomId = null;
let cachedGameList = null;
let gameListRequest = null;
let gameFilterRevision = 0;
let pendingGameSetupSelection = null;
let roomSessionReady = false;
let pendingRoomRequest = null;
let roomFeedbackMessage = "";
let roomFeedbackIsError = false;
let roomFeedbackTooltipTimer = null;
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
let pendingPlayerNameRoomId = null;
let pendingJoinRequest = null;
let logoutCopyRequest = null;
let logReturnFocus = null;
const roomEntryReturnFocus = new WeakMap();
const selectedGameTagIds = new Set();
const roomControlsDockQuery = window.matchMedia("(max-width: 900px)");
const ROOM_CONTROLS_DOCK_KEY = "openboardgame:room_controls_dock";

const nameInput = document.getElementById("nameInput");
const playerNameModal = document.getElementById("playerNameModal");
const playerNameForm = document.getElementById("playerNameForm");
const playerNameError = document.getElementById("playerNameError");
const playerNameModeBtn = document.getElementById("playerNameModeBtn");
const playerAccessKeyModeBtn = document.getElementById("playerAccessKeyModeBtn");
const accessKeyInput = document.getElementById("accessKeyInput");
const joinRoomModal = document.getElementById("joinRoomModal");
const joinRoomForm = document.getElementById("joinRoomForm");
const roomIdInput = document.getElementById("roomIdInput");
const joinRoomError = document.getElementById("joinRoomError");
const connectionInfo = document.getElementById("connectionInfo");
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");
const disableDoubleTapZoomToggle = document.getElementById("disableDoubleTapZoomToggle");
const turnSoundToggle = document.getElementById("turnSoundToggle");
const roomActionStatus = document.getElementById("roomActionStatus");
const roomFeedbackTooltip = document.getElementById("roomFeedbackTooltip");
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
const removeBotBtn = document.getElementById("removeBotBtn");
const logoutBtn = document.getElementById("logoutBtn");
const logoutModal = document.getElementById("logoutModal");
const logoutConfirmBtn = document.getElementById("logoutConfirmBtn");
const logoutCopyBtn = document.getElementById("logoutCopyBtn");
const logoutError = document.getElementById("logoutError");
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
const roomControlsCollapseBtn = document.getElementById("roomControlsCollapseBtn");
const roomControlsBackdrop = document.getElementById("roomControlsBackdrop");
const roomControlsDragHandle = document.getElementById("roomControlsDragHandle");
const roomControlsMain = document.querySelector(".layout > .main");
const mobileExplainSlot = document.getElementById("mobileExplainSlot");
const gameReconnectBtn = document.getElementById("gameReconnectBtn");

const ROOM_AUTH_KEY = "openboardgame:room_auth";
const NAME_STORAGE_KEY = "openboardgame:name";
const LAST_ROOM_ID_KEY = "openboardgame:last_room_id";
const GAME_SORT_KEY = "openboardgame:game_sort";
const RECENT_GAMES_KEY = "openboardgame:recent_games";
const DISABLE_DOUBLE_TAP_ZOOM_KEY = "openboardgame:disable_double_tap_zoom";
const TURN_SOUND_KEY = "openboardgame:turn_sound";
const RECENT_GAMES_LIMIT = 50;
const PLAYER_ACCESS_KEY_MAX_LENGTH = 1048576;
const GAME_SORT_KEYS = new Set(["alpha", "recent", "dev_order", "difficulty_asc", "difficulty_desc"]);

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

function applyDoubleTapZoomPreference(disabled) {
  document.documentElement.classList.toggle("disable-double-tap-zoom", disabled);
  disableDoubleTapZoomToggle.checked = disabled;
}

applyDoubleTapZoomPreference(readRoomStorage(DISABLE_DOUBLE_TAP_ZOOM_KEY) !== "false");

disableDoubleTapZoomToggle.addEventListener("change", () => {
  const disabled = disableDoubleTapZoomToggle.checked;
  applyDoubleTapZoomPreference(disabled);
  writeRoomStorage(DISABLE_DOUBLE_TAP_ZOOM_KEY, String(disabled));
});

let roomTurnSoundEnabled = readRoomStorage(TURN_SOUND_KEY) === "true";
let roomTurnSoundContext = null;
let roomTurnSoundState = null;
let roomTurnSoundRequest = 0;
turnSoundToggle.checked = roomTurnSoundEnabled;

function resetRoomTurnSound() {
  roomTurnSoundState = null;
  roomTurnSoundRequest += 1;
}

// Create/resume audio during a user gesture, including after a saved preference is restored.
function unlockRoomTurnSound() {
  if (!roomTurnSoundEnabled) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!roomTurnSoundContext || roomTurnSoundContext.state === "closed") {
      roomTurnSoundContext = new AudioContextClass();
    }
    if (roomTurnSoundContext.state !== "running") {
      roomTurnSoundContext.resume().catch(() => {});
    }
  } catch {
    // Audio support or autoplay restrictions must never interrupt play.
  }
}

turnSoundToggle.addEventListener("change", () => {
  roomTurnSoundEnabled = turnSoundToggle.checked;
  writeRoomStorage(TURN_SOUND_KEY, String(roomTurnSoundEnabled));
  roomTurnSoundRequest += 1;
  if (roomTurnSoundEnabled) unlockRoomTurnSound();
});
document.addEventListener("pointerdown", unlockRoomTurnSound, { capture: true, passive: true });
document.addEventListener("keydown", unlockRoomTurnSound, { capture: true });

async function playRoomTurnSound(request) {
  const context = roomTurnSoundContext;
  if (!context || !roomTurnSoundEnabled) return;
  try {
    if (context.state !== "running") await context.resume();
    // A delayed resume must not play an old turn after leaving, muting, or acting.
    if (context.state !== "running" || request !== roomTurnSoundRequest
        || !roomTurnSoundEnabled || !roomTurnSoundState?.canAct || !roomSessionReady || !socket.connected) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.012);
    gain.gain.linearRampToValueAtTime(0, now + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(now);
    oscillator.stop(now + 0.17);
  } catch {
    // A missing device or a browser audio suspension is non-fatal.
  }
}

function getRoomTurnSoundActor(view) {
  // Acquire temporarily hands control to shareholders during a merger.
  const actor = view.pending?.current_player ?? view.pending_action?.player_id
    ?? view.current_turn ?? view.current_player ?? view.active_player_id;
  return actor && typeof actor === "object" ? (actor.player_id ?? actor.playerId ?? actor.id) : actor;
}

function canActForRoomTurnSound(view, gameType, viewer) {
  const actions = view.legal_actions ?? view.actions ?? view.options;
  if (Array.isArray(actions)) {
    // Optional communication and undo controls can remain available while waiting.
    return actions.some((action) => {
      const type = typeof action === "string" ? action : action?.action?.type ?? action?.type;
      return type && !["communicate", "unready", "undo_plan", "play_again"].includes(type);
    });
  }
  if (gameType === "aidixit") {
    const storyteller = view.storyteller_id === viewer;
    return (view.phase === "story" && storyteller && !view.submitted)
      || (view.phase === "submit" && !storyteller && !view.submitted)
      || (view.phase === "vote" && !storyteller && !view.voted);
  }
  if (gameType === "cyber_pictures") {
    return (view.phase === "crafting" && !view.submitted)
      || (view.phase === "guessing" && !view.guessed);
  }
  return getRoomTurnSoundActor(view) === viewer;
}

function updateRoomTurnSound(data) {
  if (!data || !roomSessionReady || !socket.connected || !roomId || data.room_id !== roomId
      || data.game_type !== currentGameType) return;
  const view = data.view;
  const viewer = view && (Object.hasOwn(view, "you") ? view.you : playerId);
  if (!viewer || viewer !== playerId || (data.room_status && data.room_status !== "in_game") || view.game_over) {
    resetRoomTurnSound();
    return;
  }
  const scope = `${roomId}:${currentGameType}:${viewer}`;
  const canAct = canActForRoomTurnSound(view, currentGameType, viewer);
  const ownsTurn = getRoomTurnSoundActor(view) === viewer;
  const previous = roomTurnSoundState;
  const newTurn = canAct && (previous?.scope !== scope || !previous.canAct || (ownsTurn && !previous.ownsTurn));
  roomTurnSoundState = { scope, canAct, ownsTurn };
  if (!canAct) roomTurnSoundRequest += 1;
  if (newTurn && roomTurnSoundEnabled) void playRoomTurnSound(++roomTurnSoundRequest);
}

const ROOM_CONTROLS_DOCK_SIDES = new Set(["left", "right", "top", "bottom"]);

function normalizeRoomControlsDockSide(side) {
  return ROOM_CONTROLS_DOCK_SIDES.has(side) ? side : "left";
}

function readRoomControlsDockSide() {
  return normalizeRoomControlsDockSide(readRoomStorage(ROOM_CONTROLS_DOCK_KEY));
}

function isDesktopRoomControlsDock() {
  return !roomControlsDockQuery.matches;
}

function applyRoomControlsDockSide(side, persist = false) {
  roomControlsDockSide = normalizeRoomControlsDockSide(side);
  if (roomControlsPanel) roomControlsPanel.dataset.dockSide = roomControlsDockSide;
  document.body.classList.remove(
    "room-controls-dock-left",
    "room-controls-dock-right",
    "room-controls-dock-top",
    "room-controls-dock-bottom",
  );
  document.body.classList.add(`room-controls-dock-${roomControlsDockSide}`);
  if (persist) writeRoomStorage(ROOM_CONTROLS_DOCK_KEY, roomControlsDockSide);
}

function roomControlsDockSideAtPoint(clientX, clientY) {
  const distances = {
    left: clientX,
    right: Math.max(0, window.innerWidth - clientX),
    top: clientY,
    bottom: Math.max(0, window.innerHeight - clientY),
  };
  return Object.entries(distances).sort((a, b) => a[1] - b[1])[0][0];
}

function finishRoomControlsDrag(event, persist = true) {
  const drag = roomControlsDragState;
  if (!drag) return;
  roomControlsDragState = null;
  document.body.classList.remove("room-controls-dragging");
  roomControlsPanel?.classList.remove("is-dragging");
  if (roomControlsDragHandle?.hasPointerCapture?.(drag.pointerId)) {
    roomControlsDragHandle.releasePointerCapture(drag.pointerId);
  }
  if (persist) applyRoomControlsDockSide(drag.side, true);
  if (event) event.preventDefault();
}

function startRoomControlsDrag(event) {
  if (!isDesktopRoomControlsDock() || event.button !== 0 || !roomControlsDragHandle) return;
  roomControlsDragState = {
    pointerId: event.pointerId,
    side: roomControlsDockSide,
    moved: false,
  };
  roomControlsDragHandle.setPointerCapture?.(event.pointerId);
  roomControlsPanel?.classList.add("is-dragging");
  document.body.classList.add("room-controls-dragging");
  event.preventDefault();
}

function moveRoomControlsDrag(event) {
  const drag = roomControlsDragState;
  if (!drag || event.pointerId !== drag.pointerId) return;
  const nextSide = roomControlsDockSideAtPoint(event.clientX, event.clientY);
  drag.moved = drag.moved || nextSide !== drag.side;
  if (nextSide !== drag.side) {
    drag.side = nextSide;
    applyRoomControlsDockSide(nextSide);
  }
  event.preventDefault();
}

if (roomControlsPanel) {
  roomControlsDockSide = readRoomControlsDockSide();
  applyRoomControlsDockSide(roomControlsDockSide);
}

function openSettingsModal() {
  setModalVisible(settingsModal, true);
  settingsBtn.setAttribute("aria-expanded", "true");
  document.body.classList.add("settings-open");
  document.querySelector(".container").inert = true;
  settingsCloseBtn.focus({ preventScroll: true });
}

function closeSettingsModal() {
  if (settingsModal.classList.contains("hidden")) return;
  setModalVisible(settingsModal, false);
  settingsBtn.setAttribute("aria-expanded", "false");
  document.body.classList.remove("settings-open");
  document.querySelector(".container").inert = false;
  settingsBtn.focus({ preventScroll: true });
}

settingsBtn.addEventListener("click", openSettingsModal);
settingsCloseBtn.addEventListener("click", closeSettingsModal);
settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) closeSettingsModal();
});

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

function loadStoredGameSort() {
  const value = readRoomStorage(GAME_SORT_KEY);
  return GAME_SORT_KEYS.has(value) ? value : "alpha";
}

function saveStoredGameSort(sortKey) {
  if (!GAME_SORT_KEYS.has(sortKey)) return;
  writeRoomStorage(GAME_SORT_KEY, sortKey);
}

// Most recent first; a game appears at most once.
function loadRecentGames() {
  try {
    const parsed = JSON.parse(readRoomStorage(RECENT_GAMES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string" && id) : [];
  } catch {
    return [];
  }
}

function recordRecentGame(gameId) {
  if (typeof gameId !== "string" || !gameId) return;
  const recent = loadRecentGames();
  if (recent[0] === gameId) return;
  const next = [gameId, ...recent.filter((id) => id !== gameId)].slice(0, RECENT_GAMES_LIMIT);
  writeRoomStorage(RECENT_GAMES_KEY, JSON.stringify(next));
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

function normalizeRoomAccessAuth(rid, auth) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(rid) || ["__proto__", "constructor", "prototype"].includes(rid)
      || !auth || typeof auth !== "object" || Array.isArray(auth)
      || ![auth.player_id, auth.reconnect_token].every(value => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value))
      || (auth.name !== undefined && typeof auth.name !== "string")) {
    return null;
  }
  return { player_id: auth.player_id, reconnect_token: auth.reconnect_token, ...(auth.name !== undefined ? { name: auth.name } : {}) };
}

function parsePlayerAccessKey(value) {
  if (typeof value !== "string" || value.length > PLAYER_ACCESS_KEY_MAX_LENGTH) return null;
  const key = value.trim();
  const legacy = /^obg1:([A-Za-z0-9_-]{1,64}):([A-Za-z0-9_-]{1,128}):([A-Za-z0-9_-]{1,128})$/.exec(key);
  if (legacy) {
    const auth = normalizeRoomAccessAuth(legacy[1], { player_id: legacy[2], reconnect_token: legacy[3] });
    return auth ? { rooms: { [legacy[1]]: auth }, last_room_id: legacy[1] } : null;
  }
  if (!/^obg2:[A-Za-z0-9_-]+$/.test(key)) return null;
  try {
    const bytes = Uint8Array.from(atob(key.slice(5).replace(/-/g, "+").replace(/_/g, "/")), character => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!payload || typeof payload !== "object" || !payload.rooms || typeof payload.rooms !== "object" || Array.isArray(payload.rooms)) return null;
    const rooms = {};
    for (const [rid, value] of Object.entries(payload.rooms)) {
      const auth = normalizeRoomAccessAuth(rid, value);
      if (!auth) return null;
      rooms[rid] = auth;
    }
    const roomIds = Object.keys(rooms);
    if (!roomIds.length || typeof payload.last_room_id !== "string" || !Object.hasOwn(rooms, payload.last_room_id)) return null;
    return { rooms, last_room_id: payload.last_room_id };
  } catch {
    return null;
  }
}

function buildPlayerAccessKey() {
  const rooms = {};
  for (const [rid, value] of Object.entries(loadRoomAuthMap()).sort(([left], [right]) => left.localeCompare(right))) {
    const auth = normalizeRoomAccessAuth(rid, value);
    if (auth) rooms[rid] = auth;
  }
  const roomIds = Object.keys(rooms);
  if (!roomIds.length) return null;
  const preferredRoomId = getQuickReconnectRoomId();
  const lastRoomId = Object.hasOwn(rooms, preferredRoomId) ? preferredRoomId : roomIds[roomIds.length - 1];
  const bytes = new TextEncoder().encode(JSON.stringify({ rooms, last_room_id: lastRoomId }));
  const encoded = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));
  const key = `obg2:${encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
  return key.length <= PLAYER_ACCESS_KEY_MAX_LENGTH ? key : null;
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
    pendingPlayerNameRoomId = null;
    nameInput.value = "";
    accessKeyInput.value = "";
    if (pendingRoomRequest?.accessKeyEntry) {
      socket.disconnect();
      socket.connect();
    }
  }
  if (modal === logoutModal) {
    logoutCopyRequest = null;
  }
  const returnFocus = roomEntryReturnFocus.get(modal);
  if (returnFocus && returnFocus.isConnected) {
    returnFocus.focus();
  }
  roomEntryReturnFocus.delete(modal);
}

function requirePlayerName(action, message = "", targetRoomId = null) {
  if (getPlayerName() && !message) {
    action();
    return;
  }
  pendingPlayerNameAction = action;
  pendingPlayerNameRoomId = targetRoomId;
  setPlayerEntryMode(false);
  nameInput.value = getPlayerName();
  openRoomEntryModal(playerNameModal, nameInput, playerNameError);
  if (message) {
    showRoomEntryError(nameInput, playerNameError, message);
  }
}

function setPlayerEntryMode(useAccessKey) {
  playerNameModeBtn.setAttribute("aria-pressed", (!useAccessKey).toString());
  playerAccessKeyModeBtn.setAttribute("aria-pressed", useAccessKey.toString());
  document.getElementById("playerNameField").classList.toggle("hidden", useAccessKey);
  document.getElementById("playerAccessKeyField").classList.toggle("hidden", !useAccessKey);
  document.getElementById("playerAccessKeyHint").classList.toggle("hidden", !useAccessKey);
  document.getElementById("playerNameModalTitle").textContent = useAccessKey ? "Restore your rooms" : "Choose your name";
  playerNameForm.querySelector('button[type="submit"]').textContent = useAccessKey ? "Restore access" : "Continue";
  nameInput.disabled = useAccessKey;
  nameInput.required = !useAccessKey;
  accessKeyInput.disabled = !useAccessKey;
  accessKeyInput.required = useAccessKey;
  accessKeyInput.value = "";
  nameInput.removeAttribute("aria-invalid");
  accessKeyInput.removeAttribute("aria-invalid");
  playerNameError.textContent = "";
  playerNameError.classList.add("hidden");
  if (!playerNameModal.classList.contains("hidden")) {
    (useAccessKey ? accessKeyInput : nameInput).focus();
  }
}

function reconnectWithAccessKey() {
  const credentials = parsePlayerAccessKey(accessKeyInput.value);
  if (!credentials) {
    showRoomEntryError(accessKeyInput, playerNameError, "Enter the complete access key copied when logging out.");
    return;
  }
  if (!socket.connected) {
    showRoomEntryError(accessKeyInput, playerNameError, "Connect to the server, then try again.");
    socket.connect();
    return;
  }
  const roomIds = [...new Set([pendingPlayerNameRoomId, credentials.last_room_id, ...Object.keys(credentials.rooms).reverse()])]
    .filter(rid => typeof rid === "string" && Object.hasOwn(credentials.rooms, rid));
  reconnectImportedRoom({ rooms: credentials.rooms, roomIds });
}

function reconnectImportedRoom(accessKeyEntry) {
  const rid = accessKeyEntry.roomIds.shift();
  const auth = accessKeyEntry.rooms[rid];
  if (sendRoomRequest("room:reconnect", { room_id: rid, player_id: auth.player_id, reconnect_token: auth.reconnect_token }, "Restoring access to your rooms...", false)) {
    pendingRoomRequest.accessKeyEntry = accessKeyEntry;
    pendingJoinRequest = null;
    playerNameError.textContent = "";
    playerNameError.classList.add("hidden");
    accessKeyInput.removeAttribute("aria-invalid");
    updateRoomActionButtons();
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
      const response = await fetch("/api/games", { signal: controller.signal, cache: "no-store" });
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
  skull_king: 1.73,
  exploding_kittens: 1.08,
  gloomhaven: 3.92,
  night_of_the_ninja: 1.84,
  the_mind: 1.07,
  moshimo_yusha: 2.00,
  dnd_starter_set: null, // No matching BGG entry for Heroes of the Borderlands (2025) as of 2026-10-21.
  colt_express: 1.83,
  mall_of_horror: 1.94,
  startups: 1.58,
  natsumemo: 1.33,
  orloj: 3.61,
  challengers: 1.79,
  las_vegas: 1.17,
  for_sale: 1.25,
  cheaty_mages: 1.61,
  love_letter: 1.18,
  spirit_island: 4.08,
  red_doors: null, // BLACK MAZE DEEP has no BGG weight votes as of 2026-10-21.
  cryptid: 2.26,
  eternal_decks: 2.83,
  take_time: 1.77,
  terra_nova: 2.87,
  boomerang_australia: 1.53,
  ponzi_scheme: 2.44,
  abraca_what: 1.64,
  age_of_war: 1.15,
  aidixit: 1.1924453280318092,
  ark_nova: 3.80,
  azul: 1.78,
  sagrada: 1.92,
  dice_throne: 1.97,
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
  nine_upper: 1.33,
  fang_niao: 1.3142857142857143,
  flip7: 1.028056112224449,
  gold_rush: 1.1839080459770115,
  gizmos: 2.05,
  gaia_project: 4.40,
  halli_galli: 1.02,
  hanabi: 1.69,
  hive: 2.31,
  hot_streak: 1.23,
  incan_gold: 1.11,
  istanbul: 2.58,
  grand_austria_hotel: 3.19,
  kobayakawa: 1.2,
  tucano: 1.09,
  perfect_mismatch: 1.0,
  compress: 1.10,
  point_salad: 1.15,
  project_l: 1.53,
  six_nimmt: 1.19,
  skull: 1.12,
  splendor: 1.78,
  splendor_pokemon: 1.851063829787234,
  texas_holdem: 2.430830039525692,
  the_gang: 1.58,
  the_crew: 1.97,
  trekking_history: 1.76,
  turing_machine: 2.41,
  kronologic: 2.05,
  wandering_towers: 1.59,
  yahtzee: 1.17,
  fake_artist: 1.09,
  manila: 2.04,
  maskmen: 1.78,
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
  word_decode: null, // No BGG entry found as of 2026-10-21.
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
  a_feast_for_odin: 3.87,
  dune_imperium: 3.08,
  deception: 1.59,
  mind_the_lines: 1.10,
  no_thanks: 1.13,
  power_grid: 3.25,
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
  if (sortKey === "recent") {
    const recentRank = new Map(loadRecentGames().map((id, index) => [id, index]));
    ordered.sort((a, b) => {
      const aRank = recentRank.get(a.game_id);
      const bRank = recentRank.get(b.game_id);
      if (aRank !== undefined && bRank !== undefined) {
        return aRank - bRank;
      } else if (aRank !== undefined) {
        return -1;
      } else if (bRank !== undefined) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
    return ordered;
  }
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
  recordRecentGame(gameId);
  sendRoomRequest("room:create", payload, "Creating room...", false);
}

function showCreateRoomGameStep() {
  if (typeof hideGuandanSetup === "function") hideGuandanSetup();
  const theCrewSetup = document.getElementById("theCrewSetupStep");
  if (theCrewSetup) { theCrewSetup.classList.add("hidden"); theCrewSetup.setAttribute("aria-hidden", "true"); }
  if (pendingGameSetupSelection) {
    pendingGameSetupSelection = null;
    setRoomFeedback();
  }
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

async function selectGameFromModal(gameId) {
  pendingGameSetupSelection = null;
  setRoomFeedback();
  if (gameId === "guandan") {
    const selection = {};
    pendingGameSetupSelection = selection;
    setRoomFeedback("Loading game setup...");
    try {
      await ensureGameAssets("guandan");
    } catch {
      if (pendingGameSetupSelection !== selection || createRoomModal.classList.contains("hidden")) return;
      pendingGameSetupSelection = null;
      setRoomFeedback("Could not load game setup. Select Guandan to retry.", true);
      return;
    }
    if (pendingGameSetupSelection !== selection || createRoomModal.classList.contains("hidden")) return;
    pendingGameSetupSelection = null;
    setRoomFeedback();
    showGuandanSetup();
    return;
  }
  if (gameId === "the_crew") {
    const selection = {};
    pendingGameSetupSelection = selection;
    setRoomFeedback("Loading game setup...");
    try {
      await ensureGameAssets("the_crew");
    } catch {
      if (pendingGameSetupSelection !== selection || createRoomModal.classList.contains("hidden")) return;
      pendingGameSetupSelection = null;
      setRoomFeedback("Could not load game setup. Select The Crew to retry.", true);
      return;
    }
    if (pendingGameSetupSelection !== selection || createRoomModal.classList.contains("hidden")) return;
    pendingGameSetupSelection = null;
    setRoomFeedback();
    showTheCrewSetup();
    return;
  }
  if (gameId === "forest_shuffle" && forestShuffleLanguageStep) {
    showForestShuffleLanguageStep();
    return;
  }
  if (gameId === "catan_starfarers" && catanStarfarersSetupStep) {
    const selection = {};
    pendingGameSetupSelection = selection;
    setRoomFeedback("Loading game setup...");
    try {
      await Promise.all(GAME_ASSETS.catan_starfarers.styles.map((url) => loadGameResource(url, "style")));
    } catch {
      if (pendingGameSetupSelection !== selection || createRoomModal.classList.contains("hidden")) return;
      pendingGameSetupSelection = null;
      setRoomFeedback("Could not load game setup. Check your connection and select CATAN: Starfarers to retry.", true);
      return;
    }
    if (pendingGameSetupSelection !== selection || createRoomModal.classList.contains("hidden")) return;
    pendingGameSetupSelection = null;
    setRoomFeedback();
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
    gameSortSelect.value = loadStoredGameSort();
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
  // A server update may have added games since this page was first opened.
  cachedGameList = null;
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

async function downloadMemoriesFile(activeRoomId, button = null) {
  if (!activeRoomId) {
    log("Not in a room");
    return;
  }
  const url = `/api/room/memories?room_id=${encodeURIComponent(activeRoomId)}`;
  const originalLabel = button ? button.textContent : "";
  try {
    if (button) {
      button.disabled = true;
      button.textContent = "⏳";
    }
    await downloadRoomFile(url, "text/html");
  } finally {
    if (button && document.contains(button)) {
      button.textContent = originalLabel || "📜";
      button.disabled = false;
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

function openLogoutModal() {
  closeSettingsModal();
  roomEntryReturnFocus.set(logoutModal, document.activeElement);
  logoutError.textContent = "";
  logoutError.classList.add("hidden");
  logoutConfirmBtn.disabled = false;
  logoutCopyBtn.disabled = !buildPlayerAccessKey();
  document.getElementById("logoutKeyHint").textContent = logoutCopyBtn.disabled
    ? "No room credentials are available to copy."
    : "Includes all saved room credentials from this browser. Rooms and seats must still exist; this is not a permanent account.";
  setModalVisible(logoutModal, true);
  document.getElementById("logoutCancelBtn").focus();
}

async function copyAccessKeyAndLogout() {
  const key = buildPlayerAccessKey();
  if (!key || logoutCopyRequest) return;
  const request = {};
  logoutCopyRequest = request;
  logoutConfirmBtn.disabled = true;
  logoutCopyBtn.disabled = true;
  logoutError.classList.add("hidden");
  const copied = await copyTextToClipboard(key);
  if (logoutCopyRequest !== request) return;
  logoutCopyRequest = null;
  logoutConfirmBtn.disabled = false;
  logoutCopyBtn.disabled = false;
  if (!copied || key !== buildPlayerAccessKey()) {
    logoutError.textContent = !copied
      ? "Could not copy the access key. You are still logged in. Allow clipboard access and try again."
      : "Your room credentials changed while copying. Try again to copy the current access key.";
    logoutError.classList.remove("hidden");
    logoutCopyBtn.focus();
    return;
  }
  performLogout({ preserveSeat: true });
}

function performLogout({ preserveSeat = false } = {}) {
  pendingJoinRequest = null;
  if (preserveSeat) {
    socket.disconnect();
  } else if (roomId && socket.connected) {
    socket.emit("room:leave", { room_id: roomId });
  }
  closeRoomEntryModal(logoutModal);
  closeCreateRoomModal();
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
  if (socket.connected) {
    requestRoomList();
  } else {
    socket.connect();
  }
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
  if (visible && logPanel.classList.contains("hidden")) {
    closeSettingsModal();
    logReturnFocus = document.activeElement;
  }
  logPanel.classList.toggle("hidden", !visible);
  logPanel.setAttribute("aria-hidden", (!visible).toString());
  document.body.classList.toggle("log-open", visible);
  if (visible) {
    logCloseBtn.focus({ preventScroll: true });
  } else if (logReturnFocus?.isConnected) {
    logReturnFocus.focus({ preventScroll: true });
    logReturnFocus = null;
  }
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

function hasRoomGameStarted() {
  return ["in_game", "game_over"].includes(currentRoomState?.status);
}

function hideRoomFeedbackTooltip() {
  window.clearTimeout(roomFeedbackTooltipTimer);
  roomFeedbackTooltipTimer = null;
  roomFeedbackTooltip.hidePopover?.();
  roomFeedbackTooltip.hidden = true;
  roomFeedbackTooltip.textContent = "";
}

function showRoomFeedbackTooltip(message, isError) {
  hideRoomFeedbackTooltip();
  roomFeedbackTooltip.textContent = message;
  roomFeedbackTooltip.classList.toggle("room-feedback-tooltip-error", isError);
  roomFeedbackTooltip.hidden = false;
  roomFeedbackTooltip.showPopover?.();
  roomFeedbackTooltipTimer = window.setTimeout(hideRoomFeedbackTooltip, 1000);
}

function setRoomFeedback(message = "", isError = false) {
  const useTooltip = hasRoomGameStarted();
  // Gameplay feedback must not persist in, or open, Room Controls.
  roomFeedbackMessage = useTooltip ? "" : message;
  roomFeedbackIsError = !useTooltip && isError;
  setConnectionInfo(roomFeedbackMessage || (roomSessionReady && roomId ? `Connected to room ${roomId}.` : ""));
  updateRoomActionButtons();
  if (useTooltip && message) {
    showRoomFeedbackTooltip(message, isError);
  } else {
    hideRoomFeedbackTooltip();
  }
  if (isError) {
    log(message);
    if (!useTooltip) setRoomControlsCollapsed(false);
  }
}

function getRoomStartReason() {
  if (!currentRoomState) return "Create or join a room first.";
  if (!socket.connected) return "Connection lost. Reconnecting...";
  if (!roomSessionReady) return "Reconnect to the room before playing.";
  if (currentRoomState.status !== "lobby") return "Game already started.";
  if (currentRoomState.game_type === "the_crew" && currentRoomState.host_player_id !== playerId) {
    return "Waiting for the host to choose a mission.";
  }
  if (typeof isGameAssetsLoaded === "function" && !isGameAssetsLoaded(currentGameType)) {
    return "Loading game files...";
  }
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

function updateRoomCreateButtonLabel() {
  const creating = pendingRoomRequest?.event === "room:create";
  createBtn.textContent = creating ? "⏳" : "➕";
  const label = creating ? "Creating room..." : "Create room";
  createBtn.title = label;
  createBtn.setAttribute("aria-label", label);
}

function updateRoomActionButtons() {
  const busy = Boolean(pendingRoomRequest);
  const importingAccessKey = Boolean(pendingRoomRequest?.accessKeyEntry);
  playerNameModeBtn.disabled = importingAccessKey;
  playerAccessKeyModeBtn.disabled = importingAccessKey;
  accessKeyInput.readOnly = importingAccessKey;
  playerNameForm.querySelector('button[type="submit"]').disabled = importingAccessKey;
  logoutBtn.disabled = busy;
  const available = socket.connected && roomSessionReady && Boolean(roomId) && !busy;
  const inLobby = currentRoomState?.status === "lobby";
  const players = currentRoomState?.players || [];
  const gameMeta = cachedGameList?.find((game) => game.game_id === currentGameType);
  const maxPlayers = currentRoomState?.max_players ?? gameMeta?.max_players;
  const reason = getRoomStartReason();
  const startBtn = document.getElementById("startBtn");
  const starting = pendingRoomRequest?.event === "room:start";
  startBtn.disabled = !available || Boolean(reason);
  startBtn.textContent = starting ? "⏳" : "▶️";
  const startLabel = starting ? "Starting..." : reason || "Start Game";
  startBtn.title = startLabel;
  startBtn.setAttribute("aria-label", startLabel);
  const readyBtn = document.getElementById("readyBtn");
  const me = players.find((player) => player.player_id === playerId);
  const isReady = Boolean(me && me.ready);
  readyBtn.disabled = !available || !inLobby;
  readyBtn.classList.toggle("room-icon-btn-active", isReady);
  readyBtn.setAttribute("aria-pressed", isReady.toString());
  const readyLabel = pendingRoomRequest?.event === "room:ready" ? "Updating..." : isReady ? "Ready (click to unready)" : "Ready";
  readyBtn.title = readyLabel;
  readyBtn.setAttribute("aria-label", readyLabel);
  const addBotBtn = document.getElementById("addBotBtn");
  addBotBtn.disabled = !available || !inLobby || !Number.isFinite(maxPlayers) || players.length >= maxPlayers;
  addBotBtn.textContent = pendingRoomRequest?.event === "room:add_bot" ? "Adding..." : "Add Bot";
  removeBotBtn.disabled = !available || !inLobby || !players.some((player) => player.is_bot);
  leaveBtn.disabled = !roomId || busy;
  reopenBtn.disabled = !available || !["in_game", "game_over"].includes(currentRoomState?.status)
    || (currentRoomState?.game_type === "the_crew" && currentRoomState.host_player_id !== playerId);
  autoSaveToggle.disabled = !available || Boolean(currentRoomState?.auto_save);
  createBtn.disabled = busy;
  updateRoomCreateButtonLabel();
  document.querySelectorAll("#createRoomModal .game-item, #forestShuffleEnglishBtn, #forestShuffleChineseBtn, [data-catan-starfarers-setup], #theCrewSetupCreate, #guandanSetupCreateBtn")
    .forEach((button) => { button.disabled = busy; });
  roomActionStatus.textContent = hasRoomGameStarted() ? "" : roomFeedbackMessage || (inLobby ? reason || "Ready to start." : "");
  roomActionStatus.classList.toggle("room-feedback-error", !hasRoomGameStarted() && roomFeedbackIsError);
  createRoomStatus.textContent = roomFeedbackMessage;
  createRoomStatus.classList.toggle("room-feedback-error", roomFeedbackIsError);
  updateGameReconnectButton();
  if (typeof syncTheCrewRoomControls === "function") syncTheCrewRoomControls();
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
      if (request.accessKeyEntry && !playerNameModal.classList.contains("hidden")) {
        showRoomEntryError(accessKeyInput, playerNameError, "No response from the server. Try reconnecting again.");
      }
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
  const theCrew = currentRoomState?.game_type === "the_crew";
  const reopenLabel = theCrew ? "Restart" : "Reopen";
  reopenBtn.textContent = theCrew ? "🔁" : "↩️";
  reopenBtn.title = reopenLabel;
  reopenBtn.setAttribute("aria-label", reopenLabel);
  reopenBtn.disabled = !showButton || (theCrew && currentRoomState.host_player_id !== playerId);
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
  if (currentRoomState.game_type === "the_crew") {
    if (typeof openTheCrewMissionPicker === "function") openTheCrewMissionPicker("restart");
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
  const desktopDock = isDesktopRoomControlsDock();
  const drawerOpen = roomControlsDockQuery.matches && !isCollapsed;
  const desktopPopover = desktopDock && roomControlsPopoverOpen && !isCollapsed;
  const shouldCloseDesktopDrawer = desktopDock && isCollapsed;
  document.body.classList.add("room-controls-docked");
  document.body.classList.toggle("room-controls-drawer-open", drawerOpen);
  document.body.classList.toggle("room-controls-drawer-closed", shouldCloseDesktopDrawer);
  document.body.classList.toggle("room-controls-desktop-popover", desktopPopover);
  roomControlsToggleBtn.setAttribute("aria-expanded", (!isCollapsed).toString());
  roomControlsToggleBtn.setAttribute("aria-label", isCollapsed ? "Open Room Controls" : "Hide Room Controls");
  roomControlsToggleBtn.title = isCollapsed ? "Open Room Controls" : "Hide Room Controls";
  roomControlsMain.inert = drawerOpen;
  if (drawerOpen || desktopPopover) {
    roomControlsPanel.setAttribute("role", "dialog");
    roomControlsPanel.setAttribute("aria-modal", "true");
    if (drawerOpen && (roomControlsMain.contains(document.activeElement) || document.activeElement === roomControlsToggleBtn)) {
      roomControlsCollapseBtn.focus({ preventScroll: true });
    }
  } else {
    roomControlsPanel.removeAttribute("role");
    roomControlsPanel.removeAttribute("aria-modal");
    if (document.activeElement === roomControlsCollapseBtn) {
      roomControlsToggleBtn.focus({ preventScroll: true });
    }
  }
  if (roomControlsDockQuery.matches) {
    // Reserve only the top bar, so opening the drawer never shifts the game.
    const header = roomControlsPanel.querySelector(":scope > .panel-header");
    const style = getComputedStyle(roomControlsPanel);
    const height = header.getBoundingClientRect().height +
      parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) +
      parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
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
  const shouldDockExplain = roomControlsDockQuery.matches ||
    (!roomControlsExplainDockDeferred && (
    roomControlsPanel?.classList.contains("collapsed") ||
    document.body.classList.contains("room-controls-desktop-popover")
    ));
  if (!mobileExplainSlot || !shouldDockExplain) {
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

function setRoomControlsCollapsed(collapsed, { auto = false, user = false } = {}) {
  if (!roomControlsPanel) {
    return;
  }
  const restoreFocus = collapsed && roomControlsPanel.contains(document.activeElement);
  roomControlsPanel.classList.toggle("collapsed", collapsed);
  if (collapsed) {
    roomControlsPopoverOpen = false;
  } else if (user && isDesktopRoomControlsDock()) {
    roomControlsExplainDockDeferred = false;
    roomControlsPopoverOpen = true;
  } else if (auto) {
    roomControlsPopoverOpen = false;
  }
  if (roomControlsToggleBtn) {
    roomControlsToggleBtn.textContent = collapsed ? "Show RC" : "Hide";
    roomControlsToggleBtn.setAttribute("aria-expanded", (!collapsed).toString());
  }
  roomControlsAutoCollapsed = auto && collapsed;
  updateRoomControlsDock();
  syncRoomControlsExplainButton();
  if (restoreFocus) roomControlsToggleBtn.focus({ preventScroll: true });
}

function updateRoomControlsForStatus(status) {
  if (!["in_game", "game_over"].includes(status)) hideRoomFeedbackTooltip();
  if (!roomControlsPanel) {
    return;
  }
  const isInGame = status === "in_game";
  roomControlsPanel.classList.toggle("compact", isInGame);
  if (isInGame && !roomControlsGameActive) {
    setRoomFeedback();
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
  const auth = getRoomAuth(rid);
  if (auth?.player_id && auth?.reconnect_token) {
    attemptReconnect(rid, auth, options);
    return;
  }
  if (!name) {
    requirePlayerName(() => attemptJoinRoom(rid, options), "", rid);
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

function attemptReconnect(rid, auth, options = {}) {
  if (!rid || !auth) {
    log("Reconnect info missing");
    return;
  }
  if (roomSessionReady && socket.connected && rid === roomId) {
    if (options.readyAfterJoin && currentRoomState?.status === "lobby") {
      sendRoomRequest("room:ready", { room_id: rid, ready: true }, "Updating ready status...");
    } else {
      setRoomFeedback("Connected to room.");
    }
    return;
  }
  if (sendRoomRequest("room:reconnect", {
    room_id: rid,
    player_id: auth.player_id,
    reconnect_token: auth.reconnect_token,
  }, "Reconnecting to room...", false)) {
    pendingReadyAfterJoin = Boolean(options.readyAfterJoin);
    pendingReadyRoomId = pendingReadyAfterJoin ? rid : null;
  }
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
    const meta = document.createElement("div");
    meta.className = "room-item-meta";
    const maxPlayers = Number.isFinite(room.max_players) ? room.max_players : null;
    const count = `${room.player_count || 0}/${maxPlayers !== null ? maxPlayers : "-"}`;
    meta.textContent = `${room.game_type || "-"} · ${count}`;
    const status = document.createElement("div");
    status.className = "room-pill";
    status.textContent = room.status || "-";
    header.appendChild(title);
    header.appendChild(meta);
    header.appendChild(status);

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
    const joinDisabled = !canReconnect && (isLoaded
      ? claimableSeats.length === 0
      : room.status !== "lobby" || (maxPlayers !== null && (room.player_count || 0) >= maxPlayers));
    const joinBtn = document.createElement("button");
    joinBtn.type = "button";
    joinBtn.textContent = canReconnect ? "Reconnect" : isLoaded ? "Claim Seat" : "Join";
    joinBtn.disabled = joinDisabled;
    joinBtn.addEventListener("click", () => {
      if (canReconnect) {
        attemptReconnect(room.room_id, auth);
      } else if (isLoaded) {
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
      joinReadyBtn.disabled = joinDisabled || room.status !== "lobby";
      joinReadyBtn.addEventListener("click", () => {
        attemptJoinRoom(room.room_id, { readyAfterJoin: true });
      });
      actions.appendChild(joinReadyBtn);
    }

    const memoriesBtn = document.createElement("button");
    memoriesBtn.type = "button";
    memoriesBtn.className = "room-memories-btn";
    memoriesBtn.textContent = "📜";
    const memoriesAvailable = Boolean(room.supports_memories) && room.status !== "lobby";
    const memoriesLabel = !room.supports_memories
      ? "Memories not supported for this game"
      : room.status === "lobby"
        ? "Memories available once the game starts"
        : "Download Memories";
    memoriesBtn.disabled = !memoriesAvailable;
    memoriesBtn.title = memoriesLabel;
    memoriesBtn.setAttribute("aria-label", memoriesLabel);
    memoriesBtn.addEventListener("click", () => {
      downloadMemoriesFile(room.room_id, memoriesBtn);
    });
    actions.appendChild(memoriesBtn);

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
    if (isLoaded) {
      const source = document.createElement("div");
      source.className = "room-item-source";
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
  resetRoomTurnSound();
  hideRoomFeedbackTooltip();
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
  if (typeof clearMindTheLinesState === "function") clearMindTheLinesState();
  if (typeof clearCaboState === "function") clearCaboState();
  if (typeof clearFlip7State === "function") clearFlip7State();
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
  if (typeof clearTerraNovaState === "function") clearTerraNovaState();
  if (typeof clearBoomerangAustraliaState === "function") clearBoomerangAustraliaState();
  if (typeof clearBombBustersState === "function") {
    clearBombBustersState();
  }
  if (typeof clearYahtzeeState === "function") clearYahtzeeState();
  if (typeof clearAcquireState === "function") {
    clearAcquireState();
  }
  if (typeof clearLostCodeState === "function") {
    clearLostCodeState();
  }
  if (typeof clearCriminalDanceState === "function") {
    clearCriminalDanceState();
  }
  if (typeof clearIstanbulState === "function") clearIstanbulState();
  if (typeof clearGaiaProjectState === "function") {
    clearGaiaProjectState();
  }
  if (typeof clearGoldRushState === "function") clearGoldRushState();
  if (typeof clearIncanGoldState === "function") clearIncanGoldState();
  if (typeof clearCelestiaState === "function") {
    clearCelestiaState();
  }
  if (typeof clearKobayakawaState === "function") clearKobayakawaState();
  if (typeof clearTucanoState === "function") {
    clearTucanoState();
  }
  if (typeof clearRaState === "function") {
    clearRaState();
  }
  if (typeof clearCenturyState === "function") {
    clearCenturyState();
  }
  if (typeof clearSkullState === "function") clearSkullState();
  if (typeof clearCatInBoxState === "function") clearCatInBoxState();
  if (typeof clearGangState === "function") clearGangState();
  if (typeof clearMismatchState === "function") clearMismatchState();
  if (typeof clearCompressState === "function") clearCompressState();
  if (typeof clearCoyoteState === "function") clearCoyoteState();
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
  if (typeof clearTexasHoldemState === "function") clearTexasHoldemState();
  if (typeof clearSixNimmtState === "function") clearSixNimmtState();
  if (typeof clearHalliState === "function") clearHalliState();
  if (typeof clearDecryptoState === "function") clearDecryptoState();
  if (typeof clearWavelengthState === "function") {
    clearWavelengthState();
  }
  if (typeof clearDumbQuestionsState === "function") {
    clearDumbQuestionsState();
  }
  if (typeof clearDrawGuessState === "function") clearDrawGuessState();
  if (typeof clearBlitzSketchState === "function") clearBlitzSketchState();
  if (typeof clearCyberState === "function") clearCyberState();
  if (typeof clearAidixitState === "function") clearAidixitState();
  if (typeof clearImpressionFlowerState === "function") clearImpressionFlowerState();
  if (typeof clearSplendorState === "function") clearSplendorState();
  if (typeof clearPointSaladState === "function") clearPointSaladState();
  if (typeof clearTrekkingState === "function") clearTrekkingState();
  if (typeof clearAbracaState === "function") clearAbracaState();
  if (typeof clearBlokusState === "function") clearBlokusState();
  if (typeof clearPatchworkState === "function") {
    clearPatchworkState();
  }
  if (typeof clearProjectLState === "function") clearProjectLState();
  if (typeof clearCarcassonneState === "function") clearCarcassonneState();
  if (typeof clearFangNiaoState === "function") clearFangNiaoState();
  setGamePanelVisibility(null);
  if (typeof updateDrawGuessLanguageRow === "function") updateDrawGuessLanguageRow();
  if (typeof updateCyberPicturesConfigRow === "function") updateCyberPicturesConfigRow();
  if (typeof updateDecryptoPackRow === "function") updateDecryptoPackRow();
  if (typeof updateDecryptoBotRow === "function") updateDecryptoBotRow();
  if (typeof updateAidixitDeckRow === "function") updateAidixitDeckRow();
  if (typeof updateHalliConfigRow === "function") updateHalliConfigRow();
  updateGoldRushConfigRow();
  updateBombBustersConfigRow();
  if (typeof updateTakeTimeConfigRow === "function") updateTakeTimeConfigRow();
  if (typeof updateEternalDecksConfigRow === "function") updateEternalDecksConfigRow();
  if (typeof updateHiveConfigRow === "function") updateHiveConfigRow();
  if (typeof updatePonziSchemeConfigRow === "function") updatePonziSchemeConfigRow();
  if (typeof updateCryptidConfigRow === "function") updateCryptidConfigRow();
  if (typeof updateBoomerangAustraliaConfigUI === "function") updateBoomerangAustraliaConfigUI();
  if (typeof updateInAGroveConfigRow === "function") updateInAGroveConfigRow();
  if (typeof updateYahtzeeConfigRow === "function") updateYahtzeeConfigRow();
  if (typeof updateArkNovaConfigRow === "function") updateArkNovaConfigRow();
  if (typeof updateHanabiConfigRow === "function") updateHanabiConfigRow();
  updateTexasHoldemConfigRow();
  updateMismatchConfigRow();
  if (typeof updateGangConfigRow === "function") updateGangConfigRow();
  if (typeof updateWordDecodeConfigRow === "function") {
    updateWordDecodeConfigRow();
  }
  if (typeof updateImpressionConfigRow === "function") updateImpressionConfigRow();
  if (typeof updateBlitzSketchConfigRow === "function") updateBlitzSketchConfigRow();
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
  if (typeof drawGuessLanguageSelect !== "undefined" && drawGuessLanguageSelect) {
    drawGuessLanguageSelect.value = "zh";
  }
  if (typeof drawGuessGuessMethodSelect !== "undefined" && drawGuessGuessMethodSelect) {
    drawGuessGuessMethodSelect.value = "normal";
  }
  if (typeof blitzSketchDrawTimeSelect !== "undefined" && blitzSketchDrawTimeSelect) {
    blitzSketchDrawTimeSelect.value = "3";
  }
  if (typeof drawGuessAnswerLengthToggle !== "undefined" && drawGuessAnswerLengthToggle) {
    drawGuessAnswerLengthToggle.checked = false;
  }
  if (typeof cyberPicturesDuplicateToggle !== "undefined" && cyberPicturesDuplicateToggle) {
    cyberPicturesDuplicateToggle.checked = false;
  }
  if (typeof cyberPicturesDisabledTools !== "undefined") cyberPicturesDisabledTools = new Set();
  if (typeof decryptoBotSelect !== "undefined" && decryptoBotSelect) {
    decryptoBotSelect.value = "native";
  }
  if (typeof decryptoBotStrategyId !== "undefined") decryptoBotStrategyId = "native";
  if (typeof decryptoBotClueSelect !== "undefined" && decryptoBotClueSelect) {
    decryptoBotClueSelect.value = "0.5";
  }
  if (typeof decryptoBotClueDirectness !== "undefined") decryptoBotClueDirectness = 0.5;
  if (typeof halliDeckSelect !== "undefined" && halliDeckSelect) {
    halliDeckSelect.value = "base";
  }
  if (goldRushModeSelect) {
    goldRushModeSelect.value = "hand";
  }
  if (bombBustersPresetSelect) {
    bombBustersPresetSelect.value = "standard_practice";
  }
  if (typeof hanabiFinalRoundToggle !== "undefined" && hanabiFinalRoundToggle) {
    hanabiFinalRoundToggle.checked = false;
  }
  if (mismatchSliderCount) {
    mismatchSliderCount.value = "3";
  }
  if (typeof gangModeSelect !== "undefined" && gangModeSelect) {
    gangModeSelect.value = "normal";
  }
  if (typeof gangTimeSelect !== "undefined" && gangTimeSelect) {
    gangTimeSelect.value = "0";
  }
  if (typeof wordDecodeGuessTimeSelect !== "undefined" && wordDecodeGuessTimeSelect) {
    wordDecodeGuessTimeSelect.value = "0";
  }
  if (typeof impressionVoteToggle !== "undefined" && impressionVoteToggle) {
    impressionVoteToggle.checked = false;
  }
  if (typeof turingMachineModeSelect !== "undefined" && turingMachineModeSelect) {
    turingMachineModeSelect.value = "simple";
  }
  if (typeof turingMachineSourceSelect !== "undefined" && turingMachineSourceSelect) {
    turingMachineSourceSelect.value = "random";
  }
  if (typeof turingMachineDifficultySelect !== "undefined" && turingMachineDifficultySelect) {
    turingMachineDifficultySelect.value = "standard";
  }
  if (typeof populateTuringMachinePresetSelect === "function") {
    populateTuringMachinePresetSelect();
  }
  if (typeof turingMachinePresetSelect !== "undefined" && turingMachinePresetSelect) {
    turingMachinePresetSelect.value = "relay-standard-01";
  }
  if (typeof turingMachineSeedInput !== "undefined" && turingMachineSeedInput) {
    turingMachineSeedInput.value = "";
  }
  if (typeof lostCodeModeSelect !== "undefined" && lostCodeModeSelect) {
    lostCodeModeSelect.value = "standard";
  }
  if (typeof lostCodeShortcutToggle !== "undefined" && lostCodeShortcutToggle) {
    lostCodeShortcutToggle.checked = false;
  }
  if (typeof lostCodeCurseToggle !== "undefined" && lostCodeCurseToggle) {
    lostCodeCurseToggle.checked = false;
  }
  if (typeof criminalDanceDetectiveRuleSelect !== "undefined" && criminalDanceDetectiveRuleSelect) {
    criminalDanceDetectiveRuleSelect.value = "hand_leq_3";
  }
  if (typeof criminalDanceDogFailSelect !== "undefined" && criminalDanceDogFailSelect) {
    criminalDanceDogFailSelect.value = "discard";
  }
  if (typeof criminalDanceBoyToggle !== "undefined" && criminalDanceBoyToggle) {
    criminalDanceBoyToggle.checked = true;
  }
  if (typeof criminalDanceChiefToggle !== "undefined" && criminalDanceChiefToggle) {
    criminalDanceChiefToggle.checked = false;
  }
  if (typeof criminalDanceScoringToggle !== "undefined" && criminalDanceScoringToggle) {
    criminalDanceScoringToggle.checked = true;
  }
  if (typeof criminalDanceBoyVisibilitySelect !== "undefined" && criminalDanceBoyVisibilitySelect) {
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
    const importedAccessKey = pendingRoomRequest?.accessKeyEntry;
    if (importedAccessKey) {
      saveRoomAuthMap({ ...loadRoomAuthMap(), ...importedAccessKey.rooms });
    }
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
    if (importedAccessKey) {
      closeRoomEntryModal(playerNameModal);
      closeRoomEntryModal(joinRoomModal);
      renderRoomList(currentRoomList);
    }
    setRoomFeedback();
    // The room snapshot arrives before identity, so refresh the player's controls.
    if (currentRoomState) renderRoomState(currentRoomState);
    // Reconnect sends game:state before this identity event. Replay it now so an
    // enabled turn alert can announce the current turn after a mobile wake-up.
    if (lastGameStatePayload) updateRoomTurnSound(lastGameStatePayload);
  }
  if (data.message && data.message !== "connected") {
    setConnectionInfo(data.message);
    log(data.message);
  }
});

socket.on("system:error", (data) => {
  const failedRequest = pendingRoomRequest;
  finishRoomRequest();
  if (failedRequest?.accessKeyEntry) {
    if (["room not found", "player not found", "invalid reconnect token"].includes(data.message)) {
      delete failedRequest.accessKeyEntry.rooms[failedRequest.roomId];
      if (failedRequest.accessKeyEntry.roomIds.length) {
        reconnectImportedRoom(failedRequest.accessKeyEntry);
        return;
      }
    }
    const message = data.message === "room not found"
      ? "None of your saved rooms are available. A previous room no longer exists."
      : "Could not restore your saved seats. Check your access key and try again.";
    showRoomEntryError(accessKeyInput, playerNameError, message);
    setRoomFeedback(message, true);
    return;
  }
  if (failedRequest?.event === "room:reconnect" &&
      ["room not found", "player not found", "invalid reconnect token"].includes(data.message)) {
    clearRoomAuth(failedRequest.roomId);
    renderRoomList(currentRoomList);
    if (!roomId || roomId === failedRequest.roomId) {
      removeRoomStorage(LAST_ROOM_ID_KEY);
      resetRoomState();
    }
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
        joinRequest.rid,
      );
    }
  }
  setRoomFeedback(`Error: ${data.message}`, true);
});

socket.on("room:session_replaced", () => {
  resetRoomTurnSound();
  roomSessionReady = false;
  finishRoomRequest();
  setRoomFeedback("This room is open in another connection. Use Reconnect to return here.", true);
});

socket.on("room:state", (state) => {
  if (state.room_id !== roomId || state.game_type !== currentGameType || state.status !== "in_game") {
    resetRoomTurnSound();
  }
  renderRoomState(state);
  if (state && state.room_id) {
    recordRecentGame(state.game_type);
  }
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
  updateRoomTurnSound(data);
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
if (isDesktopRoomControlsDock() && roomControlsPanel && !roomControlsPanel.classList.contains("collapsed")) {
  roomControlsPanel.classList.add("collapsed");
  roomControlsToggleBtn.textContent = "Show RC";
}
updateRoomControlsDock();
syncRoomControlsExplainButton();

playerNameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!accessKeyInput.disabled) {
    reconnectWithAccessKey();
    return;
  }
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

playerNameModeBtn.addEventListener("click", () => setPlayerEntryMode(false));
playerAccessKeyModeBtn.addEventListener("click", () => setPlayerEntryMode(true));

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
  [logoutModal, "logoutCancelBtn"],
].forEach(([modal, cancelId]) => {
  document.getElementById(cancelId).addEventListener("click", () => closeRoomEntryModal(modal));
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeRoomEntryModal(modal);
    }
  });
});

if (logoutBtn) {
  logoutBtn.addEventListener("click", openLogoutModal);
}

logoutConfirmBtn.addEventListener("click", () => performLogout());
logoutCopyBtn.addEventListener("click", copyAccessKeyAndLogout);

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
  resetRoomTurnSound();
  if (pendingRoomRequest?.accessKeyEntry && !playerNameModal.classList.contains("hidden")) {
    showRoomEntryError(accessKeyInput, playerNameError, "Connection lost. Try reconnecting when the server is available.");
  }
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
    saveStoredGameSort(gameSortSelect.value);
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
  if (!settingsModal.classList.contains("hidden")) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeSettingsModal();
    } else if (event.key === "Tab") {
      const controls = settingsModal.querySelectorAll("input:not(:disabled), button:not(:disabled)");
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!settingsModal.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    }
    return;
  }
  const entryModal = [logoutModal, playerNameModal, joinRoomModal].find((modal) => !modal.classList.contains("hidden"));
  if (entryModal) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeRoomEntryModal(entryModal);
    } else if (event.key === "Tab") {
      const controls = entryModal.querySelectorAll("input:not(:disabled), button:not(:disabled)");
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

// Game panels may be inserted after the room controls have initialized.
document.addEventListener("click", (event) => {
  const btn = event.target.closest?.(".collapse-btn");
  const panel = btn?.closest(".panel");
  if (!panel) return;
  if (panel === roomControlsPanel) {
    setRoomControlsCollapsed(!panel.classList.contains("collapsed"), { user: true });
    return;
  }
  const collapsed = panel.classList.toggle("collapsed");
  btn.textContent = collapsed ? "Show" : "Hide";
  btn.setAttribute("aria-expanded", (!collapsed).toString());
});

roomControlsBackdrop.addEventListener("click", () => {
  setRoomControlsCollapsed(true);
});

roomControlsCollapseBtn.addEventListener("click", () => {
  setRoomControlsCollapsed(true);
});

// Explain needs access to the game immediately, even when used from the drawer.
mobileExplainSlot.addEventListener("click", (event) => {
  if (roomControlsDockQuery.matches && event.target.closest("button")) {
    setRoomControlsCollapsed(true);
  }
});

document.addEventListener("keydown", (event) => {
  if (!document.body.classList.contains("room-controls-drawer-open") || event.defaultPrevented) return;
  const overlayOpen = Array.from(document.querySelectorAll('.modal, dialog[open], [role="dialog"], .log-panel'))
    .some((element) => element !== roomControlsPanel && element.getClientRects().length > 0);
  if (overlayOpen) return;
  if (event.key === "Escape") {
    event.preventDefault();
    setRoomControlsCollapsed(true);
  } else if (event.key === "Tab") {
    const controls = Array.from(roomControlsPanel.querySelectorAll('button, input, select, textarea, a[href], [tabindex]'))
      .filter((element) => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!roomControlsPanel.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      first?.focus();
    }
  }
});

gameListRetryBtn.addEventListener("click", applyGameFilters);
updateRoomActionButtons();
// Start once at page load; filtering and opening the picker share this request.
fetchGameList().catch(() => {});

if (roomControlsDragHandle) {
  roomControlsDragHandle.addEventListener("pointerdown", startRoomControlsDrag);
  roomControlsDragHandle.addEventListener("pointermove", moveRoomControlsDrag);
  roomControlsDragHandle.addEventListener("pointerup", (event) => finishRoomControlsDrag(event));
  roomControlsDragHandle.addEventListener("pointercancel", (event) => finishRoomControlsDrag(event, false));
  roomControlsDragHandle.addEventListener("click", () => {
    if (!isDesktopRoomControlsDock()) {
      setRoomControlsCollapsed(!roomControlsPanel.classList.contains("collapsed"), { user: true });
    }
  });
  roomControlsDragHandle.addEventListener("keydown", (event) => {
    const sideByKey = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "top", ArrowDown: "bottom" };
    const side = sideByKey[event.key];
    if (!side) return;
    event.preventDefault();
    applyRoomControlsDockSide(side, true);
    updateRoomControlsDock();
  });
}

roomControlsDockQuery.addEventListener?.("change", () => {
  if (!isDesktopRoomControlsDock()) {
    roomControlsPopoverOpen = false;
    roomControlsExplainDockDeferred = false;
  } else {
    roomControlsExplainDockDeferred = true;
  }
  updateRoomControlsDock();
  syncRoomControlsExplainButton();
});

window.addEventListener("resize", syncRoomControlsExplainButton);
new ResizeObserver(updateRoomControlsDock).observe(roomControlsPanel.querySelector(":scope > .panel-header"));

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
