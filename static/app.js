const socket = io();

let playerId = null;
let roomId = null;
let currentCaboView = null;
let currentSkullView = null;
let currentCoyoteView = null;
let currentDecryptoView = null;
let currentDrawGuessView = null;
let currentSplendorView = null;
let currentAbracaView = null;
let currentGameType = null;
let abracaLastRoundNotice = null;
let selectedSlots = [];
let currentRoomState = null;
let selectedTarget = null;
let skullSelectedCardIndex = null;
let skullSelectedCardType = null;
let skullSelectedTarget = null;
let drawGuessLastRound = null;
let drawGuessLastPhase = null;
let drawGuessIsDrawing = false;
let drawGuessHasDrawn = false;
let drawGuessIsErasing = false;
let drawGuessBrushColor = "#000000";
let drawGuessBrushSize = 3;
let splendorSelectedMarket = null;
let splendorSelectedReserved = null;
let splendorSelectedNoble = null;
let splendorTokenSelection = {};
let splendorDiscardSelection = {};
let splendorNobleCatalog = {};
let createRoomPending = false;
let pendingReadyAfterJoin = false;
let pendingReadyRoomId = null;
let decryptoWordPacks = [];
let decryptoPackSelections = new Set(["basic"]);
let decryptoPacksLoaded = false;
let decryptoBotStrategies = [];
let decryptoBotStrategiesLoaded = false;
let decryptoBotStrategyId = "native";
let decryptoBotClueDirectness = 0.6;

const nameInput = document.getElementById("nameInput");
const connectionInfo = document.getElementById("connectionInfo");
const roomListEl = document.getElementById("roomList");
const refreshRoomsBtn = document.getElementById("refreshRoomsBtn");
const roomIdLabel = document.getElementById("roomIdLabel");
const roomStatus = document.getElementById("roomStatus");
const gameTypeLabel = document.getElementById("gameTypeLabel");
const playersList = document.getElementById("playersList");
const gameSelect = document.getElementById("gameSelect");
const createBtn = document.getElementById("createBtn");
const createGameRow = document.getElementById("createGameRow");
const leaveBtn = document.getElementById("leaveBtn");
const removeBotBtn = document.getElementById("removeBotBtn");
const logoutBtn = document.getElementById("logoutBtn");
const drawGuessLanguageRow = document.getElementById("drawGuessLanguageRow");
const drawGuessLanguageSelect = document.getElementById("drawGuessLanguageSelect");
const drawGuessGuessMethodRow = document.getElementById("drawGuessGuessMethodRow");
const drawGuessGuessMethodSelect = document.getElementById("drawGuessGuessMethodSelect");
const decryptoPackRow = document.getElementById("decryptoPackRow");
const decryptoPackOptions = document.getElementById("decryptoPackOptions");
const decryptoBotRow = document.getElementById("decryptoBotRow");
const decryptoBotSelect = document.getElementById("decryptoBotSelect");
const decryptoBotClueRow = document.getElementById("decryptoBotClueRow");
const decryptoBotClueSelect = document.getElementById("decryptoBotClueSelect");
const caboPanel = document.getElementById("caboPanel");
const skullPanel = document.getElementById("skullPanel");
const coyotePanel = document.getElementById("coyotePanel");
const decryptoPanel = document.getElementById("decryptoPanel");
const drawGuessPanel = document.getElementById("drawGuessPanel");

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

const skullPhaseLabel = document.getElementById("skullPhase");
const skullRoundLabel = document.getElementById("skullRound");
const skullTurnLabel = document.getElementById("skullTurn");
const skullBidLabel = document.getElementById("skullBid");
const skullBidderLabel = document.getElementById("skullBidder");
const skullPassedLabel = document.getElementById("skullPassed");
const skullRosesLabel = document.getElementById("skullRoses");
const skullLastRevealLabel = document.getElementById("skullLastReveal");
const skullWinnerLabel = document.getElementById("skullWinner");
const skullHand = document.getElementById("skullHand");
const skullSelectedCardLabel = document.getElementById("skullSelectedCard");
const skullTargetSelection = document.getElementById("skullTargetSelection");
const skullTargets = document.getElementById("skullTargets");
const skullPlayers = document.getElementById("skullPlayers");
const skullBidInput = document.getElementById("skullBidInput");
const skullPlayBtn = document.getElementById("skullPlayBtn");
const skullStartBidBtn = document.getElementById("skullStartBidBtn");
const skullRaiseBidBtn = document.getElementById("skullRaiseBidBtn");
const skullPassBidBtn = document.getElementById("skullPassBidBtn");
const skullRevealBtn = document.getElementById("skullRevealBtn");
const skullClearSelectionBtn = document.getElementById("skullClearSelection");

const coyotePhaseLabel = document.getElementById("coyotePhase");
const coyoteRoundLabel = document.getElementById("coyoteRound");
const coyoteTurnLabel = document.getElementById("coyoteTurn");
const coyoteBidLabel = document.getElementById("coyoteBid");
const coyoteBidderLabel = document.getElementById("coyoteBidder");
const coyoteWinnerLabel = document.getElementById("coyoteWinner");
const coyoteRoundNotice = document.getElementById("coyoteRoundNotice");
const coyoteRoundNoticeTitle = document.getElementById("coyoteRoundNoticeTitle");
const coyoteRoundNoticeBody = document.getElementById("coyoteRoundNoticeBody");
const coyoteBidInput = document.getElementById("coyoteBidInput");
const coyoteBidMinusBtn = document.getElementById("coyoteBidMinusBtn");
const coyoteBidPlusBtn = document.getElementById("coyoteBidPlusBtn");
const coyoteBidBtn = document.getElementById("coyoteBidBtn");
const coyoteChallengeBtn = document.getElementById("coyoteChallengeBtn");
const coyoteResetBtn = document.getElementById("coyoteResetBtn");
const coyotePlayers = document.getElementById("coyotePlayers");

const decryptoPhaseLabel = document.getElementById("decryptoPhase");
const decryptoRoundLabel = document.getElementById("decryptoRound");
const decryptoMaxRoundsLabel = document.getElementById("decryptoMaxRounds");
const decryptoWinnerLabel = document.getElementById("decryptoWinner");
const decryptoYourTeamLabel = document.getElementById("decryptoYourTeam");
const decryptoYourRoleLabel = document.getElementById("decryptoYourRole");
const decryptoCurrentCodeLabel = document.getElementById("decryptoCurrentCode");
const decryptoStatus = document.getElementById("decryptoStatus");
const decryptoStatusBody = document.getElementById("decryptoStatusBody");
const decryptoTeams = document.getElementById("decryptoTeams");
const decryptoCurrentClues = document.getElementById("decryptoCurrentClues");
const decryptoHistory = document.getElementById("decryptoHistory");
const decryptoSummary = document.getElementById("decryptoSummary");
const decryptoSummaryBody = document.getElementById("decryptoSummaryBody");
const decryptoEncryptionArea = document.getElementById("decryptoEncryptionArea");
const decryptoGuessArea = document.getElementById("decryptoGuessArea");
const decryptoClue1 = document.getElementById("decryptoClue1");
const decryptoClue2 = document.getElementById("decryptoClue2");
const decryptoClue3 = document.getElementById("decryptoClue3");
const decryptoSubmitCluesBtn = document.getElementById("decryptoSubmitCluesBtn");
const decryptoDecryptInput = document.getElementById("decryptoDecryptInput");
const decryptoSubmitDecryptBtn = document.getElementById("decryptoSubmitDecryptBtn");
const decryptoInterceptInput = document.getElementById("decryptoInterceptInput");
const decryptoSubmitInterceptBtn = document.getElementById("decryptoSubmitInterceptBtn");

const drawGuessPhaseLabel = document.getElementById("drawGuessPhase");
const drawGuessRoundLabel = document.getElementById("drawGuessRound");
const drawGuessTotalRoundsLabel = document.getElementById("drawGuessTotalRounds");
const drawGuessSubmittedLabel = document.getElementById("drawGuessSubmitted");
const drawGuessPromptRow = document.getElementById("drawGuessPromptRow");
const drawGuessPromptLabel = document.getElementById("drawGuessPrompt");
const drawGuessDrawArea = document.getElementById("drawGuessDrawArea");
const drawGuessGuessArea = document.getElementById("drawGuessGuessArea");
const drawGuessCanvas = document.getElementById("drawGuessCanvas");
const drawGuessClearBtn = document.getElementById("drawGuessClearBtn");
const drawGuessEraserBtn = document.getElementById("drawGuessEraserBtn");
const drawGuessSubmitDrawBtn = document.getElementById("drawGuessSubmitDrawBtn");
const drawGuessImage = document.getElementById("drawGuessImage");
const drawGuessInput = document.getElementById("drawGuessInput");
const drawGuessSubmitGuessBtn = document.getElementById("drawGuessSubmitGuessBtn");
const drawGuessPlayers = document.getElementById("drawGuessPlayers");
const drawGuessReview = document.getElementById("drawGuessReview");
const drawGuessBooks = document.getElementById("drawGuessBooks");
const drawGuessRestartBtn = document.getElementById("drawGuessRestartBtn");
const drawGuessColorPalette = document.getElementById("drawGuessColorPalette");
const drawGuessColorButtons = drawGuessColorPalette
  ? Array.from(drawGuessColorPalette.querySelectorAll("button[data-color]"))
  : [];
const drawGuessBrushSizes = document.getElementById("drawGuessBrushSizes");
const drawGuessBrushButtons = drawGuessBrushSizes
  ? Array.from(drawGuessBrushSizes.querySelectorAll("button[data-size]"))
  : [];
const drawGuessCtx = drawGuessCanvas ? drawGuessCanvas.getContext("2d") : null;

const splendorPanel = document.getElementById("splendorPanel");
const splendorPhaseLabel = document.getElementById("splendorPhase");
const splendorTurnLabel = document.getElementById("splendorTurn");
const splendorFinalRoundLabel = document.getElementById("splendorFinalRound");
const splendorWinnerLabel = document.getElementById("splendorWinner");
const splendorSupply = document.getElementById("splendorSupply");
const splendorMarketTier1 = document.getElementById("splendorMarketTier1");
const splendorMarketTier2 = document.getElementById("splendorMarketTier2");
const splendorMarketTier3 = document.getElementById("splendorMarketTier3");
const splendorNobles = document.getElementById("splendorNobles");
const splendorSelectedMarketLabel = document.getElementById("splendorSelectedMarket");
const splendorSelectedReservedLabel = document.getElementById("splendorSelectedReserved");
const splendorSelectedNobleLabel = document.getElementById("splendorSelectedNoble");
const splendorClearSelectionBtn = document.getElementById("splendorClearSelection");
const splendorReserveTierSelect = document.getElementById("splendorReserveTier");
const splendorTokenSelectionEl = document.getElementById("splendorTokenSelection");
const splendorDiscardSelectionRow = document.getElementById("splendorDiscardSelectionRow");
const splendorDiscardSelectionEl = document.getElementById("splendorDiscardSelection");
const splendorDiscardHint = document.getElementById("splendorDiscardHint");
const splendorTakeThreeBtn = document.getElementById("splendorTakeThreeBtn");
const splendorTakeTwoBtn = document.getElementById("splendorTakeTwoBtn");
const splendorReserveMarketBtn = document.getElementById("splendorReserveMarketBtn");
const splendorReserveDeckBtn = document.getElementById("splendorReserveDeckBtn");
const splendorBuyMarketBtn = document.getElementById("splendorBuyMarketBtn");
const splendorBuyReservedBtn = document.getElementById("splendorBuyReservedBtn");
const splendorDiscardBtn = document.getElementById("splendorDiscardBtn");
const splendorChooseNobleBtn = document.getElementById("splendorChooseNobleBtn");
const splendorReserved = document.getElementById("splendorReserved");
const splendorPlayers = document.getElementById("splendorPlayers");

const abracaPanel = document.getElementById("abracaPanel");
const abracaPhaseLabel = document.getElementById("abracaPhase");
const abracaRoundLabel = document.getElementById("abracaRound");
const abracaTurnLabel = document.getElementById("abracaTurn");
const abracaDeckLabel = document.getElementById("abracaDeck");
const abracaSecretPoolLabel = document.getElementById("abracaSecretPool");
const abracaDiscardLabel = document.getElementById("abracaDiscard");
const abracaChainMinLabel = document.getElementById("abracaChainMin");
const abracaLastActionLabel = document.getElementById("abracaLastAction");
const abracaRoundResultLabel = document.getElementById("abracaRoundResult");
const abracaRoundNotice = document.getElementById("abracaRoundNotice");
const abracaRoundNoticeTitle = document.getElementById("abracaRoundNoticeTitle");
const abracaRoundNoticeBody = document.getElementById("abracaRoundNoticeBody");
const abracaSpells = document.getElementById("abracaSpells");
const abracaPlayers = document.getElementById("abracaPlayers");
const abracaRollBtn = document.getElementById("abracaRollBtn");
const abracaSecretBtn = document.getElementById("abracaSecretBtn");
const abracaEndTurnBtn = document.getElementById("abracaEndTurnBtn");
const abracaNextRoundBtn = document.getElementById("abracaNextRoundBtn");
const abracaNewGameRow = document.getElementById("abracaNewGameRow");
const abracaNewGameBtn = document.getElementById("abracaNewGameBtn");
const abracaSpellButtonsContainer = document.getElementById("abracaSpellButtons");
const abracaSpellButtons = abracaSpellButtonsContainer
  ? Array.from(abracaSpellButtonsContainer.querySelectorAll("button[data-spell]"))
  : [];

const actionButtons = {
  initial_peek: document.getElementById("peekBtn"),
  draw_deck: document.getElementById("drawDeckBtn"),
  draw_discard: document.getElementById("drawDiscardBtn"),
  replace_card: document.getElementById("replaceBtn"),
  discard_drawn: document.getElementById("discardDrawnBtn"),
  attempt_match: document.getElementById("matchBtn"),
  call_cabo: document.getElementById("callCaboBtn"),
  use_choice_action: document.getElementById("choiceBtn"),
  next_round: document.getElementById("nextRoundBtn"),
};

const skullActionButtons = {
  play_card: skullPlayBtn,
  start_bid: skullStartBidBtn,
  raise_bid: skullRaiseBidBtn,
  pass_bid: skullPassBidBtn,
  reveal_card: skullRevealBtn,
};

const coyoteActionButtons = {
  bid: coyoteBidBtn,
  challenge: coyoteChallengeBtn,
};

const decryptoActionButtons = {
  submit_clues: decryptoSubmitCluesBtn,
  submit_decrypt: decryptoSubmitDecryptBtn,
  submit_intercept: decryptoSubmitInterceptBtn,
};

const drawGuessActionButtons = {
  submit_drawing: drawGuessSubmitDrawBtn,
  submit_guess: drawGuessSubmitGuessBtn,
};

const splendorActionButtons = {
  take_tokens: splendorTakeThreeBtn,
  take_tokens_same: splendorTakeTwoBtn,
  reserve_market: splendorReserveMarketBtn,
  reserve_deck: splendorReserveDeckBtn,
  buy_market: splendorBuyMarketBtn,
  buy_reserved: splendorBuyReservedBtn,
  discard_tokens: splendorDiscardBtn,
  choose_noble: splendorChooseNobleBtn,
};

const splendorBaseColors = ["white", "blue", "green", "red", "black"];
const splendorColors = [...splendorBaseColors, "gold"];
const splendorColorLabels = {
  white: "W",
  blue: "B",
  green: "G",
  red: "R",
  black: "K",
  gold: "Gold",
};

const abracaSpellData = [
  {
    id: 0,
    number: 1,
    name: "Ancient Dragon",
    short: "Dragon",
    desc: "Roll 1-3. Others lose that many HP. Miscast: you lose that many HP.",
    total: 1,
  },
  {
    id: 1,
    number: 2,
    name: "Dark Ghost",
    short: "Ghost",
    desc: "Others -1 HP. You +1 HP (max 6).",
    total: 2,
  },
  {
    id: 2,
    number: 3,
    name: "Sweet Dreams",
    short: "Dream",
    desc: "Roll 1-3. You heal that many HP (max 6).",
    total: 3,
  },
  {
    id: 3,
    number: 4,
    name: "Owl",
    short: "Owl",
    desc: "Draw a secret card. Survive to score +1 per secret.",
    total: 4,
  },
  {
    id: 4,
    number: 5,
    name: "Lightning Storm",
    short: "Lightning",
    desc: "Left and right neighbors -1 HP (2 players: opponent -1 HP).",
    total: 5,
  },
  { id: 5, number: 6, name: "Blizzard", short: "Blizzard", desc: "Left neighbor -1 HP.", total: 6 },
  { id: 6, number: 7, name: "Fireball", short: "Fireball", desc: "Right neighbor -1 HP.", total: 7 },
  { id: 7, number: 8, name: "Magic Potion", short: "Potion", desc: "You +1 HP (max 6).", total: 8 },
];

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

function performLogout() {
  if (roomId) {
    socket.emit("room:leave", { room_id: roomId });
  }
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
  const showSkull = gameType === "skull";
  const showCoyote = gameType === "coyote";
  const showDecrypto = gameType === "decrypto";
  const showDrawGuess = gameType === "draw_guess";
  const showSplendor = gameType === "splendor";
  const showAbraca = gameType === "abraca_what";
  caboPanel.classList.toggle("hidden", !showCabo);
  skullPanel.classList.toggle("hidden", !showSkull);
  if (coyotePanel) {
    coyotePanel.classList.toggle("hidden", !showCoyote);
  }
  if (decryptoPanel) {
    decryptoPanel.classList.toggle("hidden", !showDecrypto);
  }
  drawGuessPanel.classList.toggle("hidden", !showDrawGuess);
  if (splendorPanel) {
    splendorPanel.classList.toggle("hidden", !showSplendor);
  }
  if (abracaPanel) {
    abracaPanel.classList.toggle("hidden", !showAbraca);
  }
}

function updateDrawGuessLanguageRow() {
  const showRow = currentRoomState && currentGameType === "draw_guess" && currentRoomState.status === "lobby";
  if (drawGuessLanguageRow) {
    drawGuessLanguageRow.classList.toggle("hidden", !showRow);
  }
  if (drawGuessGuessMethodRow) {
    drawGuessGuessMethodRow.classList.toggle("hidden", !showRow);
  }
}

function updateDecryptoPackRow() {
  const showRow = currentRoomState && currentGameType === "decrypto" && currentRoomState.status === "lobby";
  if (decryptoPackRow) {
    decryptoPackRow.classList.toggle("hidden", !showRow);
    decryptoPackRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (showRow && !decryptoPacksLoaded) {
    fetchDecryptoPacks();
  }
}

function updateDecryptoBotRow() {
  const showRow = currentRoomState && currentGameType === "decrypto" && currentRoomState.status === "lobby";
  if (decryptoBotRow) {
    decryptoBotRow.classList.toggle("hidden", !showRow);
    decryptoBotRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (decryptoBotClueRow) {
    decryptoBotClueRow.classList.toggle("hidden", !showRow);
    decryptoBotClueRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (showRow && !decryptoBotStrategiesLoaded) {
    fetchDecryptoBotStrategies();
  }
}

function fetchDecryptoPacks() {
  if (!decryptoPackOptions) {
    return;
  }
  decryptoPackOptions.textContent = "Loading word packs...";
  fetch("/api/decrypto/word_packs")
    .then((response) => response.json())
    .then((data) => {
      decryptoWordPacks = Array.isArray(data.packs) ? data.packs : [];
      decryptoPacksLoaded = true;
      renderDecryptoPackOptions();
    })
    .catch(() => {
      decryptoPackOptions.textContent = "Failed to load word packs.";
      decryptoPacksLoaded = false;
    });
}

function fetchDecryptoBotStrategies() {
  if (!decryptoBotSelect) {
    return;
  }
  decryptoBotSelect.innerHTML = "";
  const option = document.createElement("option");
  option.value = "native";
  option.textContent = "native";
  decryptoBotSelect.appendChild(option);
  decryptoBotSelect.disabled = true;
  fetch("/api/decrypto/bot_strategies")
    .then((response) => response.json())
    .then((data) => {
      decryptoBotStrategies = Array.isArray(data.strategies) ? data.strategies : [];
      decryptoBotStrategiesLoaded = true;
      renderDecryptoBotStrategies();
    })
    .catch(() => {
      decryptoBotStrategiesLoaded = false;
      decryptoBotSelect.disabled = false;
    });
}

function renderDecryptoPackOptions() {
  if (!decryptoPackOptions) {
    return;
  }
  decryptoPackOptions.innerHTML = "";
  if (!decryptoWordPacks.length) {
    decryptoPackOptions.textContent = "No word packs available.";
    return;
  }
  const availablePackIds = new Set();
  decryptoWordPacks.forEach((pack) => {
    if (pack.pack_id) {
      availablePackIds.add(pack.pack_id);
    }
  });
  decryptoPackSelections = new Set(
    Array.from(decryptoPackSelections).filter((packId) => availablePackIds.has(packId))
  );
  if (decryptoPackSelections.size === 0) {
    availablePackIds.forEach((packId) => {
      decryptoPackSelections.add(packId);
    });
  }
  decryptoWordPacks.forEach((pack) => {
    const packId = pack.pack_id;
    if (!packId) {
      return;
    }
    const label = document.createElement("label");
    label.className = "decrypto-pack-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = packId;
    checkbox.checked = decryptoPackSelections.has(packId);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        decryptoPackSelections.add(packId);
      } else {
        decryptoPackSelections.delete(packId);
      }
    });
    const text = document.createElement("span");
    const name = pack.pack_name || packId;
    const language = pack.language ? ` · ${pack.language}` : "";
    const count = Number.isFinite(pack.total_count) ? ` (${pack.total_count})` : "";
    text.textContent = `${name}${language}${count}`;
    label.appendChild(checkbox);
    label.appendChild(text);
    decryptoPackOptions.appendChild(label);
  });
}

function renderDecryptoBotStrategies() {
  if (!decryptoBotSelect) {
    return;
  }
  decryptoBotSelect.innerHTML = "";
  if (!decryptoBotStrategies.length) {
    const fallback = document.createElement("option");
    fallback.value = "native";
    fallback.textContent = "native";
    decryptoBotSelect.appendChild(fallback);
    decryptoBotSelect.value = "native";
    decryptoBotStrategyId = "native";
    decryptoBotSelect.disabled = false;
    return;
  }
  const availableIds = new Set();
  decryptoBotStrategies.forEach((strategy) => {
    if (strategy.strategy_id) {
      availableIds.add(strategy.strategy_id);
    }
  });
  if (!availableIds.has(decryptoBotStrategyId)) {
    decryptoBotStrategyId = availableIds.has("native")
      ? "native"
      : Array.from(availableIds)[0] || "native";
  }
  decryptoBotStrategies.forEach((strategy) => {
    const strategyId = strategy.strategy_id;
    if (!strategyId) {
      return;
    }
    const option = document.createElement("option");
    option.value = strategyId;
    option.textContent = strategy.label || strategyId;
    if (strategy.description) {
      option.title = strategy.description;
    }
    decryptoBotSelect.appendChild(option);
  });
  decryptoBotSelect.value = decryptoBotStrategyId;
  decryptoBotSelect.disabled = false;
}

function getSelectedDecryptoPacks() {
  return Array.from(decryptoPackSelections);
}

function getSelectedDecryptoBotStrategy() {
  if (decryptoBotSelect && decryptoBotSelect.value) {
    decryptoBotStrategyId = decryptoBotSelect.value;
  }
  return decryptoBotStrategyId || "native";
}

function getSelectedDecryptoBotClueDirectness() {
  if (decryptoBotClueSelect && decryptoBotClueSelect.value) {
    const parsed = Number.parseFloat(decryptoBotClueSelect.value);
    if (Number.isFinite(parsed)) {
      decryptoBotClueDirectness = parsed;
    }
  }
  if (!Number.isFinite(decryptoBotClueDirectness)) {
    decryptoBotClueDirectness = 0.6;
  }
  return decryptoBotClueDirectness;
}

function requestRoomList() {
  socket.emit("room:list", {});
}

function attemptJoinRoom(rid, options = {}) {
  const name = getPlayerName();
  if (!name || !rid) {
    log("Name and room ID required");
    return;
  }
  if (options.readyAfterJoin) {
    pendingReadyAfterJoin = true;
    pendingReadyRoomId = rid;
  } else {
    pendingReadyAfterJoin = false;
    pendingReadyRoomId = null;
  }
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
    const canReconnect = auth && auth.player_id && auth.reconnect_token;
    const joinDisabled =
      room.status !== "lobby" || (maxPlayers !== null && (room.player_count || 0) >= maxPlayers);
    const joinBtn = document.createElement("button");
    joinBtn.type = "button";
    joinBtn.textContent = "Join";
    joinBtn.disabled = joinDisabled;
    joinBtn.addEventListener("click", () => {
      attemptJoinRoom(room.room_id);
    });
    joinActions.appendChild(joinBtn);

    const joinReadyBtn = document.createElement("button");
    joinReadyBtn.type = "button";
    joinReadyBtn.textContent = "Join Ready";
    joinReadyBtn.disabled = joinDisabled;
    joinReadyBtn.addEventListener("click", () => {
      attemptJoinRoom(room.room_id, { readyAfterJoin: true });
    });
    joinActions.appendChild(joinReadyBtn);

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
  roomIdLabel.textContent = "-";
  roomStatus.textContent = "-";
  gameTypeLabel.textContent = "-";
  playersList.innerHTML = "";
  clearCaboState();
  clearSkullState();
  clearCoyoteState();
  clearDecryptoState();
  clearDrawGuessState();
  clearSplendorState();
  clearAbracaState();
  setGamePanelVisibility(null);
  updateDrawGuessLanguageRow();
  updateDecryptoPackRow();
  updateDecryptoBotRow();
  if (drawGuessLanguageSelect) {
    drawGuessLanguageSelect.value = "zh";
  }
  if (drawGuessGuessMethodSelect) {
    drawGuessGuessMethodSelect.value = "normal";
  }
  if (decryptoBotSelect) {
    decryptoBotSelect.value = "native";
  }
  decryptoBotStrategyId = "native";
  if (decryptoBotClueSelect) {
    decryptoBotClueSelect.value = "0.6";
  }
  decryptoBotClueDirectness = 0.6;
  createRoomPending = false;
  setCreateGameRowVisible(false);
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
  selectedSlotsLabel.textContent = "-";
  targetSelection.textContent = "-";
  targetList.innerHTML = "";
  gamePlayers.innerHTML = "";
  updateActionButtons();
}

function clearSkullState() {
  currentSkullView = null;
  skullSelectedCardIndex = null;
  skullSelectedCardType = null;
  skullSelectedTarget = null;
  skullPhaseLabel.textContent = "-";
  skullRoundLabel.textContent = "-";
  skullTurnLabel.textContent = "-";
  skullBidLabel.textContent = "-";
  skullBidderLabel.textContent = "-";
  skullPassedLabel.textContent = "-";
  skullRosesLabel.textContent = "-";
  skullLastRevealLabel.textContent = "-";
  skullWinnerLabel.textContent = "-";
  skullHand.innerHTML = "";
  skullSelectedCardLabel.textContent = "-";
  skullTargetSelection.textContent = "-";
  skullTargets.innerHTML = "";
  skullPlayers.innerHTML = "";
  updateSkullActionButtons();
}

function clearCoyoteState() {
  currentCoyoteView = null;
  coyotePhaseLabel.textContent = "-";
  coyoteRoundLabel.textContent = "-";
  coyoteTurnLabel.textContent = "-";
  coyoteBidLabel.textContent = "-";
  coyoteBidderLabel.textContent = "-";
  coyoteWinnerLabel.textContent = "-";
  if (coyoteRoundNotice) {
    coyoteRoundNotice.classList.add("hidden");
  }
  if (coyoteRoundNoticeBody) {
    coyoteRoundNoticeBody.textContent = "-";
  }
  if (coyoteBidInput) {
    coyoteBidInput.value = "";
  }
  if (coyoteResetBtn) {
    coyoteResetBtn.disabled = true;
  }
  coyotePlayers.innerHTML = "";
  updateCoyoteActionButtons();
}

function clearDecryptoState() {
  currentDecryptoView = null;
  if (decryptoPhaseLabel) {
    decryptoPhaseLabel.textContent = "-";
  }
  if (decryptoRoundLabel) {
    decryptoRoundLabel.textContent = "-";
  }
  if (decryptoMaxRoundsLabel) {
    decryptoMaxRoundsLabel.textContent = "-";
  }
  if (decryptoWinnerLabel) {
    decryptoWinnerLabel.textContent = "-";
  }
  if (decryptoYourTeamLabel) {
    decryptoYourTeamLabel.textContent = "-";
  }
  if (decryptoYourRoleLabel) {
    decryptoYourRoleLabel.textContent = "-";
  }
  if (decryptoCurrentCodeLabel) {
    decryptoCurrentCodeLabel.textContent = "-";
  }
  if (decryptoTeams) {
    decryptoTeams.innerHTML = "";
  }
  if (decryptoCurrentClues) {
    decryptoCurrentClues.innerHTML = "";
  }
  if (decryptoHistory) {
    decryptoHistory.innerHTML = "";
  }
  if (decryptoSummary) {
    decryptoSummary.classList.add("hidden");
  }
  if (decryptoSummaryBody) {
    decryptoSummaryBody.textContent = "-";
  }
  if (decryptoClue1) {
    decryptoClue1.value = "";
  }
  if (decryptoClue2) {
    decryptoClue2.value = "";
  }
  if (decryptoClue3) {
    decryptoClue3.value = "";
  }
  if (decryptoDecryptInput) {
    decryptoDecryptInput.value = "";
  }
  if (decryptoInterceptInput) {
    decryptoInterceptInput.value = "";
  }
  updateDecryptoActionButtons();
}

function clearDrawGuessState() {
  currentDrawGuessView = null;
  drawGuessLastRound = null;
  drawGuessLastPhase = null;
  drawGuessIsDrawing = false;
  drawGuessHasDrawn = false;
  drawGuessBrushColor = "#000000";
  drawGuessBrushSize = 3;
  setDrawGuessTool(false);
  updateDrawGuessColorButtons();
  updateDrawGuessBrushButtons();
  drawGuessPhaseLabel.textContent = "-";
  drawGuessRoundLabel.textContent = "-";
  drawGuessTotalRoundsLabel.textContent = "-";
  drawGuessSubmittedLabel.textContent = "-";
  drawGuessPromptLabel.textContent = "-";
  drawGuessPlayers.innerHTML = "";
  drawGuessBooks.innerHTML = "";
  drawGuessReview.classList.add("hidden");
  drawGuessDrawArea.classList.add("hidden");
  drawGuessGuessArea.classList.add("hidden");
  drawGuessPromptRow.classList.remove("hidden");
  if (drawGuessInput) {
    drawGuessInput.value = "";
  }
  if (drawGuessImage) {
    drawGuessImage.removeAttribute("src");
  }
  clearDrawGuessCanvas();
  updateDrawGuessButtons();
}

function resetSplendorTokenSelection() {
  splendorTokenSelection = {};
  splendorColors.forEach((color) => {
    splendorTokenSelection[color] = 0;
  });
}

function resetSplendorDiscardSelection() {
  splendorDiscardSelection = {};
  splendorColors.forEach((color) => {
    splendorDiscardSelection[color] = 0;
  });
}

function clearSplendorState() {
  currentSplendorView = null;
  splendorSelectedMarket = null;
  splendorSelectedReserved = null;
  splendorSelectedNoble = null;
  splendorNobleCatalog = {};
  resetSplendorTokenSelection();
  resetSplendorDiscardSelection();
  if (splendorDiscardSelectionRow) {
    splendorDiscardSelectionRow.classList.add("hidden");
  }
  if (splendorDiscardHint) {
    splendorDiscardHint.textContent = "";
    splendorDiscardHint.classList.add("hidden");
  }
  if (splendorPhaseLabel) {
    splendorPhaseLabel.textContent = "-";
  }
  if (splendorTurnLabel) {
    splendorTurnLabel.textContent = "-";
  }
  if (splendorFinalRoundLabel) {
    splendorFinalRoundLabel.textContent = "-";
  }
  if (splendorWinnerLabel) {
    splendorWinnerLabel.textContent = "-";
  }
  if (splendorSupply) {
    splendorSupply.innerHTML = "";
  }
  if (splendorMarketTier1) {
    splendorMarketTier1.innerHTML = "";
  }
  if (splendorMarketTier2) {
    splendorMarketTier2.innerHTML = "";
  }
  if (splendorMarketTier3) {
    splendorMarketTier3.innerHTML = "";
  }
  if (splendorNobles) {
    splendorNobles.innerHTML = "";
  }
  if (splendorReserved) {
    splendorReserved.innerHTML = "";
  }
  if (splendorPlayers) {
    splendorPlayers.innerHTML = "";
  }
  updateSplendorSelectionLabels();
  updateSplendorActionButtons();
}

function clearAbracaState() {
  currentAbracaView = null;
  abracaLastRoundNotice = null;
  if (abracaPhaseLabel) {
    abracaPhaseLabel.textContent = "-";
  }
  if (abracaRoundLabel) {
    abracaRoundLabel.textContent = "-";
  }
  if (abracaTurnLabel) {
    abracaTurnLabel.textContent = "-";
  }
  if (abracaDeckLabel) {
    abracaDeckLabel.textContent = "-";
  }
  if (abracaSecretPoolLabel) {
    abracaSecretPoolLabel.textContent = "-";
  }
  if (abracaDiscardLabel) {
    abracaDiscardLabel.textContent = "-";
  }
  if (abracaChainMinLabel) {
    abracaChainMinLabel.textContent = "-";
  }
  if (abracaLastActionLabel) {
    abracaLastActionLabel.textContent = "-";
  }
  if (abracaRoundResultLabel) {
    abracaRoundResultLabel.textContent = "-";
  }
  if (abracaRoundNoticeTitle) {
    abracaRoundNoticeTitle.textContent = "Round Result";
  }
  if (abracaRoundNoticeBody) {
    abracaRoundNoticeBody.textContent = "-";
  }
  if (abracaRoundNotice) {
    abracaRoundNotice.classList.remove("muted");
    abracaRoundNotice.classList.add("hidden");
  }
  if (abracaSpells) {
    abracaSpells.innerHTML = "";
  }
  if (abracaPlayers) {
    abracaPlayers.innerHTML = "";
  }
  if (abracaNewGameRow) {
    abracaNewGameRow.classList.add("hidden");
  }
  updateAbracaActionButtons();
}

function updateSplendorSelectionLabels() {
  if (splendorSelectedMarketLabel) {
    if (splendorSelectedMarket) {
      splendorSelectedMarketLabel.textContent = `${splendorSelectedMarket.tier}:${splendorSelectedMarket.index + 1}`;
    } else {
      splendorSelectedMarketLabel.textContent = "-";
    }
  }
  if (splendorSelectedReservedLabel) {
    splendorSelectedReservedLabel.textContent = splendorSelectedReserved !== null ? `${splendorSelectedReserved + 1}` : "-";
  }
  if (splendorSelectedNobleLabel) {
    splendorSelectedNobleLabel.textContent = splendorSelectedNoble || "-";
  }
}

function updateSplendorDiscardHint(view) {
  if (!splendorDiscardHint) {
    return;
  }
  const requirement = getSplendorPendingDiscardRequirement(view);
  const excess = requirement ? requirement.excess : 0;
  if (excess > 0) {
    splendorDiscardHint.textContent = `Discard ${excess} token${excess === 1 ? "" : "s"} to stay at 10.`;
    splendorDiscardHint.classList.remove("hidden");
    if (splendorDiscardSelectionRow) {
      splendorDiscardSelectionRow.classList.remove("hidden");
    }
  } else {
    splendorDiscardHint.textContent = "";
    splendorDiscardHint.classList.add("hidden");
    if (splendorDiscardSelectionRow) {
      splendorDiscardSelectionRow.classList.add("hidden");
    }
    resetSplendorDiscardSelection();
    renderSplendorDiscardSelection();
  }
}

function clearSplendorSelection() {
  splendorSelectedMarket = null;
  splendorSelectedReserved = null;
  splendorSelectedNoble = null;
  resetSplendorTokenSelection();
  resetSplendorDiscardSelection();
  updateSplendorSelectionLabels();
  renderSplendorTokenSelection();
  renderSplendorDiscardSelection();
  updateSplendorDiscardHint(currentSplendorView);
  updateSplendorActionButtons();
}

function updateSkullSelectedCard() {
  skullSelectedCardLabel.textContent = skullSelectedCardType || "-";
}

function updateSkullTargetSelection() {
  if (!skullSelectedTarget || !currentSkullView) {
    skullTargetSelection.textContent = "-";
    return;
  }
  const player = currentSkullView.players.find((p) => p.player_id === skullSelectedTarget);
  skullTargetSelection.textContent = player ? player.name : skullSelectedTarget;
}

function clearSkullSelection() {
  skullSelectedCardIndex = null;
  skullSelectedCardType = null;
  skullSelectedTarget = null;
  updateSkullSelectedCard();
  updateSkullTargetSelection();
  updateSkullActionButtons();
  if (currentSkullView) {
    renderSkullHand(currentSkullView);
    renderSkullTargets(currentSkullView);
  }
}

function updateSelectedSlots() {
  selectedSlotsLabel.textContent = selectedSlots.length ? selectedSlots.join(", ") : "-";
}

function updateTargetSelection() {
  if (!selectedTarget || !currentCaboView) {
    targetSelection.textContent = "-";
    return;
  }
  const player = currentCaboView.players.find((p) => p.player_id === selectedTarget.playerId);
  if (!player) {
    targetSelection.textContent = "-";
    return;
  }
  targetSelection.textContent = `${player.name} #${selectedTarget.slot}`;
}

function clearTargetSelection() {
  selectedTarget = null;
  updateTargetSelection();
  updateActionButtons();
  if (currentCaboView) {
    renderTargets(currentCaboView);
  }
}

function splendorTokenSelectionTotal() {
  return splendorColors.reduce((sum, color) => sum + (splendorTokenSelection[color] || 0), 0);
}

function splendorDiscardSelectionTotal() {
  return splendorColors.reduce((sum, color) => sum + (splendorDiscardSelection[color] || 0), 0);
}

function splendorTotalTokens(tokens) {
  return splendorColors.reduce((sum, color) => sum + ((tokens && tokens[color]) || 0), 0);
}

function splendorTokenGainForAction(view, actionType) {
  const gain = {};
  splendorColors.forEach((color) => {
    gain[color] = 0;
  });
  if (actionType === "take_tokens") {
    const selected = splendorBaseColors.filter((color) => splendorTokenSelection[color] === 1);
    const hasGold = (splendorTokenSelection.gold || 0) > 0;
    if (selected.length !== 3 || splendorTokenSelectionTotal() !== 3 || hasGold) {
      return null;
    }
    selected.forEach((color) => {
      gain[color] = 1;
    });
    return gain;
  }
  if (actionType === "take_tokens_same") {
    const selected = splendorBaseColors.filter((color) => splendorTokenSelection[color] === 2);
    const hasOther = splendorBaseColors.some((color) => {
      const val = splendorTokenSelection[color] || 0;
      return val !== 0 && val !== 2;
    });
    const hasGold = (splendorTokenSelection.gold || 0) > 0;
    if (selected.length !== 1 || splendorTokenSelectionTotal() !== 2 || hasGold || hasOther) {
      return null;
    }
    gain[selected[0]] = 2;
    return gain;
  }
  if (actionType === "reserve_market" || actionType === "reserve_deck") {
    if (view && view.tokens_supply && view.tokens_supply.gold > 0) {
      gain.gold = 1;
    }
    return gain;
  }
  return null;
}

function splendorDiscardRequirement(view, gain) {
  if (!view || !gain) {
    return null;
  }
  const you = getSplendorYou(view);
  if (!you) {
    return null;
  }
  const currentTotal = splendorTotalTokens(you.tokens);
  const gainTotal = splendorColors.reduce((sum, color) => sum + (gain[color] || 0), 0);
  const excess = currentTotal + gainTotal - 10;
  if (excess <= 0) {
    return { excess: 0, available: null };
  }
  const available = {};
  splendorColors.forEach((color) => {
    available[color] = ((you.tokens && you.tokens[color]) || 0) + (gain[color] || 0);
  });
  return { excess, available };
}

function splendorIsDiscardSelectionValid(requirement) {
  if (!requirement || requirement.excess <= 0) {
    return true;
  }
  if (splendorDiscardSelectionTotal() !== requirement.excess) {
    return false;
  }
  return splendorColors.every(
    (color) => (splendorDiscardSelection[color] || 0) <= ((requirement.available && requirement.available[color]) || 0)
  );
}

function splendorDiscardSelectionPayload(requirement) {
  if (!requirement || requirement.excess <= 0) {
    return null;
  }
  const payload = {};
  splendorColors.forEach((color) => {
    const value = splendorDiscardSelection[color] || 0;
    if (value > 0) {
      payload[color] = value;
    }
  });
  return Object.keys(payload).length ? payload : null;
}

function splendorDiscardPayloadForAction(view, actionType) {
  const gain = splendorTokenGainForAction(view, actionType);
  const requirement = splendorDiscardRequirement(view, gain);
  if (!splendorIsDiscardSelectionValid(requirement)) {
    return null;
  }
  return splendorDiscardSelectionPayload(requirement);
}

function getSplendorPendingDiscardRequirement(view) {
  if (!view) {
    return null;
  }
  if (splendorTokenSelectionTotal() > 0) {
    if (view.legal_actions && view.legal_actions.includes("take_tokens")) {
      const gain = splendorTokenGainForAction(view, "take_tokens");
      if (gain) {
        return splendorDiscardRequirement(view, gain);
      }
    }
    if (view.legal_actions && view.legal_actions.includes("take_tokens_same")) {
      const gain = splendorTokenGainForAction(view, "take_tokens_same");
      if (gain) {
        return splendorDiscardRequirement(view, gain);
      }
    }
  }
  if (splendorSelectedMarket && view.legal_actions && view.legal_actions.includes("reserve_market")) {
    const gain = splendorTokenGainForAction(view, "reserve_market");
    return splendorDiscardRequirement(view, gain);
  }
  return null;
}

function renderSplendorTokenSelection() {
  if (!splendorTokenSelectionEl) {
    return;
  }
  splendorTokenSelectionEl.innerHTML = "";
  splendorColors.forEach((color) => {
    const wrapper = document.createElement("div");
    wrapper.className = `token-picker gem-${color}`;
    wrapper.addEventListener("click", (event) => {
      if (event.shiftKey || event.altKey) {
        adjustSplendorTokenSelection(color, -1);
        return;
      }
      const rect = wrapper.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      if (event.clientX < midpoint) {
        adjustSplendorTokenSelection(color, -1);
      } else {
        adjustSplendorTokenSelection(color, 1);
      }
    });
    wrapper.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      adjustSplendorTokenSelection(color, -1);
    });
    const label = document.createElement("span");
    label.textContent = splendorColorLabels[color] || color;
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "-";
    const count = document.createElement("span");
    count.textContent = String(splendorTokenSelection[color] || 0);
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    minus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustSplendorTokenSelection(color, -1);
    });
    plus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustSplendorTokenSelection(color, 1);
    });
    wrapper.appendChild(label);
    wrapper.appendChild(minus);
    wrapper.appendChild(count);
    wrapper.appendChild(plus);
    splendorTokenSelectionEl.appendChild(wrapper);
  });
}

function renderSplendorDiscardSelection() {
  if (!splendorDiscardSelectionEl) {
    return;
  }
  splendorDiscardSelectionEl.innerHTML = "";
  splendorColors.forEach((color) => {
    const wrapper = document.createElement("div");
    wrapper.className = `token-picker gem-${color}`;
    wrapper.addEventListener("click", (event) => {
      if (event.shiftKey || event.altKey) {
        adjustSplendorDiscardSelection(color, -1);
        return;
      }
      const rect = wrapper.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      if (event.clientX < midpoint) {
        adjustSplendorDiscardSelection(color, -1);
      } else {
        adjustSplendorDiscardSelection(color, 1);
      }
    });
    wrapper.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      adjustSplendorDiscardSelection(color, -1);
    });
    const label = document.createElement("span");
    label.textContent = splendorColorLabels[color] || color;
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "-";
    const count = document.createElement("span");
    count.textContent = String(splendorDiscardSelection[color] || 0);
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    minus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustSplendorDiscardSelection(color, -1);
    });
    plus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustSplendorDiscardSelection(color, 1);
    });
    wrapper.appendChild(label);
    wrapper.appendChild(minus);
    wrapper.appendChild(count);
    wrapper.appendChild(plus);
    splendorDiscardSelectionEl.appendChild(wrapper);
  });
}

function adjustSplendorTokenSelection(color, delta) {
  const current = splendorTokenSelection[color] || 0;
  const next = Math.max(0, Math.min(20, current + delta));
  splendorTokenSelection[color] = next;
  renderSplendorTokenSelection();
  updateSplendorDiscardHint(currentSplendorView);
  updateSplendorActionButtons();
}

function adjustSplendorDiscardSelection(color, delta) {
  const current = splendorDiscardSelection[color] || 0;
  const next = Math.max(0, Math.min(20, current + delta));
  splendorDiscardSelection[color] = next;
  renderSplendorDiscardSelection();
  updateSplendorDiscardHint(currentSplendorView);
  updateSplendorActionButtons();
}

function isActionAvailable(actionType) {
  if (!currentCaboView || !Array.isArray(currentCaboView.legal_actions)) {
    return false;
  }
  if (!currentCaboView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "initial_peek") {
    return selectedSlots.length === 2;
  }
  if (actionType === "draw_discard" || actionType === "replace_card") {
    return selectedSlots.length >= 1;
  }
  if (actionType === "attempt_match") {
    return selectedSlots.length >= 2;
  }
  if (actionType === "use_choice_action") {
    if (!currentCaboView.pending_choice) {
      return false;
    }
    const choiceType = currentCaboView.pending_choice.type;
    if (choiceType === "peek") {
      return selectedSlots.length >= 1;
    }
    if (choiceType === "spy") {
      return !!selectedTarget;
    }
    if (choiceType === "swap") {
      return !!selectedTarget && selectedSlots.length >= 1;
    }
  }
  return true;
}

function updateActionButtons() {
  if (currentGameType !== "cabo") {
    Object.values(actionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(actionButtons).forEach(([actionType, button]) => {
    const allowed = isActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
}

function clearSelection() {
  selectedSlots = [];
  updateSelectedSlots();
  document.querySelectorAll(".slot").forEach((el) => {
    el.classList.remove("selected");
  });
  updateActionButtons();
}

function sendAction(action) {
  if (!roomId) {
    log("Not in a room");
    return;
  }
  socket.emit("game:action", { room_id: roomId, action });
}

function emitRoomStart() {
  if (!roomId) {
    log("Not in a room");
    return;
  }
  const payload = { room_id: roomId };
  if (currentGameType === "draw_guess") {
    const language = drawGuessLanguageSelect ? drawGuessLanguageSelect.value || "zh" : "zh";
    const guessMethod = drawGuessGuessMethodSelect ? drawGuessGuessMethodSelect.value || "normal" : "normal";
    payload.config = { language, guess_method: guessMethod };
  } else if (currentGameType === "decrypto") {
    const packs = getSelectedDecryptoPacks();
    if (!packs.length) {
      log("Select at least one word pack");
      return;
    }
    const botStrategy = getSelectedDecryptoBotStrategy();
    const botClueDirectness = getSelectedDecryptoBotClueDirectness();
    payload.config = {
      word_packs: packs,
      bot_strategy: botStrategy,
      bot_clue_directness: botClueDirectness,
    };
  }
  socket.emit("room:start", payload);
}

function renderRoomState(state) {
  currentRoomState = state;
  createRoomPending = false;
  setCreateGameRowVisible(false);
  roomId = state.room_id;
  const previousGame = currentGameType;
  currentGameType = state.game_type || null;
  roomIdLabel.textContent = state.room_id;
  roomStatus.textContent = state.status;
  gameTypeLabel.textContent = state.game_type || "-";
  if (previousGame !== currentGameType) {
    clearSelection();
    clearTargetSelection();
    clearSkullSelection();
    clearCaboState();
    clearSkullState();
    clearDecryptoState();
    clearDrawGuessState();
    clearSplendorState();
    clearAbracaState();
  }
  setGamePanelVisibility(currentGameType);
  updateDrawGuessLanguageRow();
  updateDecryptoPackRow();
  updateDecryptoBotRow();
  playersList.innerHTML = "";
  state.players.forEach((p) => {
    const line = document.createElement("div");
    const tags = [];
    if (p.is_bot) tags.push("bot");
    if (p.ready) tags.push("ready");
    if (!p.connected) tags.push("offline");
    if (p.player_id === playerId) tags.push("you");
    line.textContent = `${p.seat + 1}. ${p.name} (${tags.join(", ") || "human"})`;
    playersList.appendChild(line);
  });

  if (pendingReadyAfterJoin && pendingReadyRoomId === state.room_id) {
    pendingReadyAfterJoin = false;
    pendingReadyRoomId = null;
    if (state.status === "lobby") {
      const me = playerId ? state.players.find((p) => p.player_id === playerId) : null;
      if (!me || !me.ready) {
        socket.emit("room:ready", { room_id: state.room_id, ready: true });
      }
    }
  }
}

function renderHand(view) {
  handSlots.innerHTML = "";
  const you = view.players.find((p) => p.player_id === view.you);
  if (!you) {
    handSlots.textContent = "-";
    return;
  }
  you.hand.forEach((slot, idx) => {
    const div = document.createElement("div");
    div.className = "slot";
    if (slot.empty) div.classList.add("empty");
    div.dataset.slot = idx;
    let label = "?";
    if (slot.empty) {
      label = "Empty";
    } else if (slot.known) {
      label = String(slot.value);
    }
    div.textContent = `#${idx} ${label}`;
    if (selectedSlots.includes(idx)) div.classList.add("selected");
    div.addEventListener("click", () => {
      if (selectedSlots.includes(idx)) {
        selectedSlots = selectedSlots.filter((s) => s !== idx);
        div.classList.remove("selected");
      } else {
        selectedSlots.push(idx);
        div.classList.add("selected");
      }
      updateSelectedSlots();
      updateActionButtons();
    });
    handSlots.appendChild(div);
  });
}

function renderGamePlayers(view) {
  gamePlayers.innerHTML = "";
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }

    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name;
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const score = document.createElement("span");
    score.className = "badge";
    score.textContent = `score ${p.score}`;
    badges.appendChild(score);
    if (p.player_id === view.you) {
      const you = document.createElement("span");
      you.className = "badge";
      you.textContent = "you";
      badges.appendChild(you);
    }
    if (p.is_bot) {
      const bot = document.createElement("span");
      bot.className = "badge";
      bot.textContent = "bot";
      badges.appendChild(bot);
    }
    if (p.player_id === view.current_turn) {
      const turn = document.createElement("span");
      turn.className = "badge highlight";
      turn.textContent = "turn";
      badges.appendChild(turn);
    }
    header.appendChild(badges);

    const handRow = document.createElement("div");
    handRow.className = "player-hand";
    p.hand.forEach((slot, idx) => {
      const slotEl = document.createElement("div");
      slotEl.className = "player-slot";
      if (slot.empty) {
        slotEl.classList.add("empty");
      }
      const label = slot.empty ? "Empty" : slot.known ? slot.value : "?";
      slotEl.textContent = `#${idx} ${label}`;
      handRow.appendChild(slotEl);
    });

    const meta = document.createElement("div");
    meta.className = "player-meta";
    meta.textContent = `cards ${p.hand_count}`;

    card.appendChild(header);
    card.appendChild(handRow);
    card.appendChild(meta);
    gamePlayers.appendChild(card);
  });
}

function renderTargets(view) {
  targetList.innerHTML = "";
  view.players
    .filter((p) => p.player_id !== view.you)
    .forEach((p) => {
      const wrapper = document.createElement("div");
      wrapper.className = "target-player";
      const title = document.createElement("div");
      title.textContent = p.name;
      wrapper.appendChild(title);

      const slotsRow = document.createElement("div");
      slotsRow.className = "target-slots";
      p.hand.forEach((slot, idx) => {
        const slotEl = document.createElement("div");
        slotEl.className = "target-slot";
        const label = slot.empty ? "Empty" : slot.known ? slot.value : "?";
        slotEl.textContent = `#${idx} ${label}`;
        if (
          selectedTarget &&
          selectedTarget.playerId === p.player_id &&
          selectedTarget.slot === idx
        ) {
          slotEl.classList.add("selected");
        }
        slotEl.addEventListener("click", () => {
          if (slot.empty) {
            log("Target slot is empty");
            return;
          }
          selectedTarget = { playerId: p.player_id, slot: idx };
          updateTargetSelection();
          updateActionButtons();
          renderTargets(view);
        });
        slotsRow.appendChild(slotEl);
      });
      wrapper.appendChild(slotsRow);
      targetList.appendChild(wrapper);
    });
  updateTargetSelection();
}

function findPlayerName(view, playerId) {
  const player = view.players.find((p) => p.player_id === playerId);
  return player ? player.name : playerId;
}

function renderSkullHand(view) {
  skullHand.innerHTML = "";
  if (!Array.isArray(view.hand) || !view.hand.length) {
    skullHand.textContent = "-";
    updateSkullSelectedCard();
    return;
  }
  view.hand.forEach((card, idx) => {
    const div = document.createElement("div");
    div.className = "slot";
    div.textContent = card;
    if (idx === skullSelectedCardIndex) {
      div.classList.add("selected");
    }
    div.addEventListener("click", () => {
      skullSelectedCardIndex = idx;
      skullSelectedCardType = card;
      updateSkullSelectedCard();
      updateSkullActionButtons();
      renderSkullHand(view);
    });
    skullHand.appendChild(div);
  });
}

function getSkullRevealTargets(view) {
  if (view.phase !== "reveal" || view.you !== view.bidder) {
    return [];
  }
  const you = view.players.find((p) => p.player_id === view.you);
  if (you && you.pile_count > 0) {
    return [view.you];
  }
  return view.players
    .filter((p) => !p.eliminated && p.pile_count > 0)
    .map((p) => p.player_id);
}

function renderSkullTargets(view) {
  skullTargets.innerHTML = "";
  const allowedTargets = getSkullRevealTargets(view);
  view.players.forEach((p) => {
    if (p.eliminated) {
      return;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "target-player";
    if (allowedTargets.includes(p.player_id)) {
      wrapper.classList.add("selectable");
    } else {
      wrapper.classList.add("disabled");
    }
    if (skullSelectedTarget === p.player_id) {
      wrapper.classList.add("selected");
    }
    wrapper.textContent = `${p.name} (pile ${p.pile_count})`;
    wrapper.addEventListener("click", () => {
      if (!allowedTargets.includes(p.player_id)) {
        return;
      }
      skullSelectedTarget = p.player_id;
      updateSkullTargetSelection();
      updateSkullActionButtons();
      renderSkullTargets(view);
    });
    skullTargets.appendChild(wrapper);
  });
  updateSkullTargetSelection();
}

function renderSkullPlayers(view) {
  skullPlayers.innerHTML = "";
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (p.eliminated) {
      card.classList.add("disabled");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name;
    const meta = document.createElement("div");
    meta.className = "player-meta";
    const status = p.eliminated ? "out" : "in";
    meta.textContent = `hand ${p.hand_count} | pile ${p.pile_count} | wins ${p.rounds_won} | ${status}`;
    card.appendChild(name);
    card.appendChild(meta);
    skullPlayers.appendChild(card);
  });
}

function formatCoyoteSummary(view) {
  const summary = view.last_round_summary;
  if (!summary) {
    return "-";
  }
  const bidder = findPlayerName(view, summary.bidder);
  const challenger = findPlayerName(view, summary.challenger);
  const loser = findPlayerName(view, summary.loser);
  const result = summary.success ? "challenge success" : "challenge fail";
  let text = `${result}: bid ${summary.bid}, total ${summary.actual_total}, loser ${loser}`;
  if (Array.isArray(summary.mystery_draws)) {
    const draws = summary.mystery_draws.filter((item) => item);
    if (draws.length) {
      text += ` | ? draws ${draws.join(", ")}`;
    }
  }
  if (Array.isArray(summary.max_zero_applied) && summary.max_zero_applied.length) {
    text += ` | max->0 ${summary.max_zero_applied.join(", ")}`;
  }
  if (summary.x2_count) {
    text += ` | x${2 ** summary.x2_count}`;
  }
  text += ` | bidder ${bidder}, challenger ${challenger}`;
  return text;
}

function getCoyoteMinBid(view) {
  if (!view || view.last_bid === null || view.last_bid === undefined) {
    return 1;
  }
  return Number(view.last_bid) + 1;
}

function updateCoyoteBidInput(view, previousView) {
  if (!coyoteBidInput) {
    return;
  }
  const minBid = getCoyoteMinBid(view);
  coyoteBidInput.min = String(minBid);
  const current = Number.parseInt(coyoteBidInput.value, 10);
  const newRound = !previousView || previousView.round !== view.round;
  const shouldUpdate = !Number.isInteger(current) || current < minBid || (newRound && current !== minBid);
  if (shouldUpdate && document.activeElement !== coyoteBidInput) {
    coyoteBidInput.value = minBid;
  }
}

function updateCoyoteBidControls(view) {
  if (!coyoteBidInput || !coyoteBidMinusBtn || !coyoteBidPlusBtn) {
    return;
  }
  const canEdit =
    view &&
    Array.isArray(view.legal_actions) &&
    view.legal_actions.includes("bid") &&
    view.phase !== "game_over";
  coyoteBidInput.disabled = !canEdit;
  coyoteBidMinusBtn.disabled = !canEdit;
  coyoteBidPlusBtn.disabled = !canEdit;
  if (canEdit) {
    const minBid = getCoyoteMinBid(view);
    const current = Number.parseInt(coyoteBidInput.value, 10);
    coyoteBidMinusBtn.disabled = !Number.isInteger(current) || current <= minBid;
  }
}

function adjustCoyoteBid(delta) {
  if (!coyoteBidInput) {
    return;
  }
  const minBid = getCoyoteMinBid(currentCoyoteView);
  let current = Number.parseInt(coyoteBidInput.value, 10);
  if (!Number.isInteger(current)) {
    current = minBid;
  }
  const next = Math.max(minBid, current + delta);
  coyoteBidInput.value = next;
  updateCoyoteActionButtons();
}

function renderCoyoteRoundNotice(view) {
  if (!coyoteRoundNotice || !coyoteRoundNoticeBody) {
    return;
  }
  coyoteRoundNotice.classList.remove("hidden");
  while (coyoteRoundNoticeBody.firstChild) {
    coyoteRoundNoticeBody.removeChild(coyoteRoundNoticeBody.firstChild);
  }
  const summaryText = view.last_round_summary ? formatCoyoteSummary(view) : "No previous round yet.";
  const summaryLine = document.createElement("div");
  summaryLine.textContent = summaryText;
  coyoteRoundNoticeBody.appendChild(summaryLine);

  const yourCard = view.your_card || "-";
  const cardLine = document.createElement("div");
  cardLine.textContent = `Your hidden card: ${yourCard}`;
  coyoteRoundNoticeBody.appendChild(cardLine);
}

function renderCoyotePlayers(view) {
  coyotePlayers.innerHTML = "";
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (p.eliminated) {
      card.classList.add("disabled");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name;
    const meta = document.createElement("div");
    meta.className = "player-meta";
    let cardLabel = p.card;
    if (!cardLabel && p.card_hidden) {
      cardLabel = "Hidden";
    } else if (!cardLabel) {
      cardLabel = "-";
    }
    const maxPenalties = view.config ? view.config.max_penalties : "-";
    const status = p.eliminated ? "out" : "in";
    meta.textContent = `card ${cardLabel} | penalties ${p.penalties}/${maxPenalties} | ${status}`;
    card.appendChild(name);
    card.appendChild(meta);
    coyotePlayers.appendChild(card);
  });
}

function isSkullActionAvailable(actionType) {
  if (!currentSkullView || !Array.isArray(currentSkullView.legal_actions)) {
    return false;
  }
  if (!currentSkullView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "play_card") {
    return !!skullSelectedCardType;
  }
  if (actionType === "start_bid" || actionType === "raise_bid") {
    const bid = Number.parseInt(skullBidInput.value, 10);
    return Number.isInteger(bid) && bid > 0;
  }
  if (actionType === "reveal_card") {
    const allowedTargets = getSkullRevealTargets(currentSkullView);
    return !!skullSelectedTarget && allowedTargets.includes(skullSelectedTarget);
  }
  return true;
}

function updateSkullActionButtons() {
  if (currentGameType !== "skull") {
    Object.values(skullActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(skullActionButtons).forEach(([actionType, button]) => {
    const allowed = isSkullActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
}

function isCoyoteActionAvailable(actionType) {
  if (!currentCoyoteView || !Array.isArray(currentCoyoteView.legal_actions)) {
    return false;
  }
  if (!currentCoyoteView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "bid") {
    const bid = Number.parseInt(coyoteBidInput.value, 10);
    if (!Number.isInteger(bid) || bid < 1) {
      return false;
    }
    const lastBid = currentCoyoteView.last_bid;
    if (lastBid !== null && lastBid !== undefined && bid <= lastBid) {
      return false;
    }
  }
  return true;
}

function updateCoyoteActionButtons() {
  if (currentGameType !== "coyote") {
    Object.values(coyoteActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    updateCoyoteBidControls(null);
    return;
  }
  Object.entries(coyoteActionButtons).forEach(([actionType, button]) => {
    const allowed = isCoyoteActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
  updateCoyoteBidControls(currentCoyoteView);
}

function formatDecryptoTeamLabel(teamId) {
  if (teamId === "white") {
    return "White";
  }
  if (teamId === "black") {
    return "Black";
  }
  return teamId || "-";
}

function formatDecryptoCode(code) {
  if (!Array.isArray(code) || code.length !== 3) {
    return "-";
  }
  return code.join(".");
}

function formatDecryptoCodeWithKeywords(code, keywords) {
  if (!Array.isArray(code) || code.length !== 3) {
    return formatDecryptoCode(code);
  }
  if (!Array.isArray(keywords) || keywords.length < 4) {
    return formatDecryptoCode(code);
  }
  const words = code.map((index) => {
    const word = keywords[index - 1];
    if (typeof word !== "string") {
      return null;
    }
    const cleaned = word.trim();
    return cleaned ? cleaned : null;
  });
  if (words.some((word) => !word)) {
    return formatDecryptoCode(code);
  }
  return words.join(" / ");
}

function parseDecryptoCodeInput(value) {
  if (!value) {
    return null;
  }
  const digits = value.match(/[1-4]/g);
  if (!digits || digits.length !== 3) {
    return null;
  }
  const code = digits.map((digit) => Number.parseInt(digit, 10));
  if (new Set(code).size !== 3) {
    return null;
  }
  return code;
}

function setDecryptoStatusLines(lines) {
  if (!decryptoStatusBody) {
    return;
  }
  decryptoStatusBody.innerHTML = "";
  if (!Array.isArray(lines) || !lines.length) {
    decryptoStatusBody.textContent = "-";
    return;
  }
  lines.forEach((line) => {
    const row = document.createElement("div");
    row.className = "decrypto-status-line";
    row.textContent = line;
    decryptoStatusBody.appendChild(row);
  });
}

function getDecryptoPendingEvents(view) {
  const pending = [];
  if (!view || !view.teams) {
    return pending;
  }
  const viewerTeam = view.team_id;
  const labelForTeam = (teamId) => {
    if (viewerTeam && teamId === viewerTeam) {
      return "your team";
    }
    if (viewerTeam && teamId !== viewerTeam) {
      return "opponent team";
    }
    return `${formatDecryptoTeamLabel(teamId)} team`;
  };
  if (view.phase === "encryption") {
    ["white", "black"].forEach((teamId) => {
      const team = view.teams[teamId];
      if (team && !team.clues_submitted) {
        pending.push(`${labelForTeam(teamId)} clues`);
      }
    });
  } else if (view.phase === "guessing") {
    ["white", "black"].forEach((teamId) => {
      const team = view.teams[teamId];
      if (!team) {
        return;
      }
      if (!team.decrypt_submitted) {
        pending.push(`${labelForTeam(teamId)} decrypt guess`);
      }
      if (view.round > 1 && !team.intercept_submitted) {
        pending.push(`${labelForTeam(teamId)} intercept guess`);
      }
    });
  }
  return pending;
}

function getDecryptoActionLines(view) {
  const actions = Array.isArray(view.legal_actions) ? view.legal_actions : [];
  const lines = [];
  if (actions.includes("submit_clues")) {
    const clues = [decryptoClue1, decryptoClue2, decryptoClue3]
      .map((input) => (input ? input.value.trim() : ""))
      .filter((text) => text);
    const teamKeywords =
      view.team_id && view.teams && view.teams[view.team_id]
        ? view.teams[view.team_id].keywords
        : null;
    const codeText = view.current_code
      ? formatDecryptoCodeWithKeywords(view.current_code, teamKeywords)
      : "-";
    if (clues.length === 3) {
      lines.push(`Submit your clues for code ${codeText}.`);
    } else {
      lines.push(`Enter 3 clues for code ${codeText}, then submit.`);
    }
  }
  if (actions.includes("submit_decrypt")) {
    const guess = parseDecryptoCodeInput(decryptoDecryptInput ? decryptoDecryptInput.value : "");
    if (guess) {
      lines.push("Submit your team's decrypt guess.");
    } else {
      lines.push("Enter your team's decrypt guess (e.g., 1.2.3).");
    }
  }
  if (actions.includes("submit_intercept")) {
    const guess = parseDecryptoCodeInput(decryptoInterceptInput ? decryptoInterceptInput.value : "");
    if (guess) {
      lines.push("Submit an intercept guess for the opponent.");
    } else {
      lines.push("Enter an intercept guess for the opponent (e.g., 1.2.3).");
    }
  }
  return lines;
}

function updateDecryptoStatus() {
  if (!decryptoStatus || !decryptoStatusBody) {
    return;
  }
  if (currentGameType !== "decrypto" || !currentDecryptoView) {
    setDecryptoStatusLines(["-"]);
    decryptoStatus.classList.add("waiting");
    return;
  }
  const view = currentDecryptoView;
  if (view.game_over || view.phase === "game_over") {
    const winnerLabel =
      view.winner === "draw"
        ? "Draw"
        : view.winner
          ? formatDecryptoTeamLabel(view.winner)
          : "Unknown";
    setDecryptoStatusLines([
      `Game over. Winner: ${winnerLabel}.`,
      "Waiting for the host to start a new game.",
    ]);
    decryptoStatus.classList.add("waiting");
    return;
  }

  const actionLines = getDecryptoActionLines(view);
  if (actionLines.length) {
    setDecryptoStatusLines(actionLines);
    decryptoStatus.classList.remove("waiting");
    return;
  }

  const pending = getDecryptoPendingEvents(view);
  if (pending.length) {
    setDecryptoStatusLines([`Waiting for: ${pending.join(", ")}.`]);
  } else {
    setDecryptoStatusLines(["Waiting for next phase."]);
  }
  decryptoStatus.classList.add("waiting");
}

function isDecryptoActionAvailable(actionType) {
  if (!currentDecryptoView || !Array.isArray(currentDecryptoView.legal_actions)) {
    return false;
  }
  if (!currentDecryptoView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "submit_clues") {
    const clues = [decryptoClue1, decryptoClue2, decryptoClue3]
      .map((input) => (input ? input.value.trim() : ""))
      .filter((text) => text);
    return clues.length === 3;
  }
  if (actionType === "submit_decrypt") {
    return !!parseDecryptoCodeInput(decryptoDecryptInput ? decryptoDecryptInput.value : "");
  }
  if (actionType === "submit_intercept") {
    return !!parseDecryptoCodeInput(decryptoInterceptInput ? decryptoInterceptInput.value : "");
  }
  return true;
}

function updateDecryptoActionButtons() {
  if (currentGameType !== "decrypto") {
    Object.values(decryptoActionButtons).forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    updateDecryptoStatus();
    return;
  }
  Object.entries(decryptoActionButtons).forEach(([actionType, button]) => {
    if (!button) {
      return;
    }
    const allowed = isDecryptoActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
  updateDecryptoStatus();
}

function renderDecryptoTeams(view) {
  if (!decryptoTeams) {
    return;
  }
  decryptoTeams.innerHTML = "";
  ["white", "black"].forEach((teamId) => {
    const team = view.teams ? view.teams[teamId] : null;
    if (!team) {
      return;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "decrypto-team";

    const header = document.createElement("div");
    header.className = "decrypto-team-header";
    header.textContent = `${formatDecryptoTeamLabel(teamId)} Team`;
    wrapper.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "decrypto-team-meta";
    meta.textContent = `Intercepts ${team.intercepts} | Miscommunications ${team.miscommunications}`;
    wrapper.appendChild(meta);

    const encryptorName = team.encryptor_id ? findPlayerName(view, team.encryptor_id) : "-";
    const encryptorLine = document.createElement("div");
    encryptorLine.textContent = `Encryptor: ${encryptorName}`;
    wrapper.appendChild(encryptorLine);

    const playerNames = (team.players || []).map((p) => p.name || p.player_id).join(", ");
    const playersLine = document.createElement("div");
    playersLine.textContent = `Players: ${playerNames || "-"}`;
    wrapper.appendChild(playersLine);

    const interceptStatus = view.round > 1 ? (team.intercept_submitted ? "submitted" : "pending") : "n/a";
    const statusLine = document.createElement("div");
    statusLine.textContent = `Clues: ${team.clues_submitted ? "submitted" : "pending"} | Decrypt: ${
      team.decrypt_submitted ? "submitted" : "pending"
    } | Intercept: ${interceptStatus}`;
    wrapper.appendChild(statusLine);

    const keywordsLabel = document.createElement("div");
    keywordsLabel.textContent = "Keywords:";
    wrapper.appendChild(keywordsLabel);

    if (team.keywords && team.keywords.length) {
      const keywordRow = document.createElement("div");
      keywordRow.className = "decrypto-keywords";
      team.keywords.forEach((word, idx) => {
        const item = document.createElement("div");
        item.className = "decrypto-keyword";
        item.textContent = `${idx + 1}. ${word}`;
        keywordRow.appendChild(item);
      });
      wrapper.appendChild(keywordRow);
    } else {
      const hidden = document.createElement("div");
      hidden.textContent = "Hidden";
      wrapper.appendChild(hidden);
    }

    decryptoTeams.appendChild(wrapper);
  });
}

function renderDecryptoCurrentClues(view) {
  if (!decryptoCurrentClues) {
    return;
  }
  decryptoCurrentClues.innerHTML = "";
  ["white", "black"].forEach((teamId) => {
    const team = view.teams ? view.teams[teamId] : null;
    if (!team) {
      return;
    }
    const row = document.createElement("div");
    const label = document.createElement("strong");
    label.textContent = `${formatDecryptoTeamLabel(teamId)}: `;
    row.appendChild(label);

    const clues = team.current_clues;
    const clueText = Array.isArray(clues) && clues.length ? clues.join(" | ") : "-";
    const textNode = document.createElement("span");
    textNode.textContent = clueText;
    row.appendChild(textNode);
    decryptoCurrentClues.appendChild(row);
  });
}

function renderDecryptoHistory(view) {
  if (!decryptoHistory) {
    return;
  }
  decryptoHistory.innerHTML = "";
  ["white", "black"].forEach((teamId) => {
    const team = view.teams ? view.teams[teamId] : null;
    if (!team) {
      return;
    }
    const section = document.createElement("div");
    section.className = "decrypto-team";

    const header = document.createElement("div");
    header.className = "decrypto-team-header";
    header.textContent = `${formatDecryptoTeamLabel(teamId)} History`;
    section.appendChild(header);

    const table = document.createElement("table");
    table.className = "decrypto-history-table";
    const headRow = document.createElement("tr");
    for (let idx = 1; idx <= 4; idx += 1) {
      const th = document.createElement("th");
      th.textContent = `Keyword ${idx}`;
      headRow.appendChild(th);
    }
    table.appendChild(headRow);

    const dataRow = document.createElement("tr");
    for (let idx = 1; idx <= 4; idx += 1) {
      const td = document.createElement("td");
      const items = team.history_by_keyword ? team.history_by_keyword[String(idx)] : null;
      if (Array.isArray(items) && items.length) {
        td.textContent = items.join(", ");
      } else {
        td.textContent = "-";
      }
      dataRow.appendChild(td);
    }
    table.appendChild(dataRow);
    section.appendChild(table);
    decryptoHistory.appendChild(section);
  });
}

function renderDecryptoSummary(view) {
  if (!decryptoSummary || !decryptoSummaryBody) {
    return;
  }
  const summary = view.last_round_summary;
  if (!summary || !summary.teams) {
    decryptoSummary.classList.add("hidden");
    decryptoSummaryBody.textContent = "-";
    return;
  }
  decryptoSummary.classList.remove("hidden");
  while (decryptoSummaryBody.firstChild) {
    decryptoSummaryBody.removeChild(decryptoSummaryBody.firstChild);
  }
  ["white", "black"].forEach((teamId) => {
    const info = summary.teams[teamId];
    if (!info) {
      return;
    }
    const line = document.createElement("div");
    const decryptGuess = formatDecryptoCode(info.decrypt_guess);
    const decryptResult = info.decrypt_correct ? "correct" : "wrong";
    let interceptPart = "-";
    if (summary.round > 1) {
      const interceptGuess = formatDecryptoCode(info.intercept_guess);
      const interceptResult = info.intercept_correct ? "correct" : "wrong";
      interceptPart = `${interceptGuess} (${interceptResult})`;
    }
    const codeText = formatDecryptoCode(info.code);
    const clues = Array.isArray(info.clues) && info.clues.length ? info.clues.join(" | ") : "-";
    line.textContent = `${formatDecryptoTeamLabel(teamId)} code ${codeText} | clues ${clues} | decrypt ${decryptGuess} (${decryptResult}) | intercept ${interceptPart}`;
    decryptoSummaryBody.appendChild(line);
  });
}

function renderDecryptoGameState(data) {
  const view = data.view;
  currentDecryptoView = view;
  if (currentGameType !== "decrypto") {
    currentGameType = "decrypto";
    setGamePanelVisibility("decrypto");
  }

  if (decryptoPhaseLabel) {
    decryptoPhaseLabel.textContent = view.phase || "-";
  }
  if (decryptoRoundLabel) {
    decryptoRoundLabel.textContent = view.round ?? "-";
  }
  if (decryptoMaxRoundsLabel) {
    decryptoMaxRoundsLabel.textContent = view.max_rounds ?? "-";
  }
  if (decryptoWinnerLabel) {
    if (view.winner === "draw") {
      decryptoWinnerLabel.textContent = "Draw";
    } else if (view.winner) {
      decryptoWinnerLabel.textContent = formatDecryptoTeamLabel(view.winner);
    } else {
      decryptoWinnerLabel.textContent = "-";
    }
  }
  if (decryptoYourTeamLabel) {
    decryptoYourTeamLabel.textContent = view.team_id ? formatDecryptoTeamLabel(view.team_id) : "-";
  }
  if (decryptoYourRoleLabel) {
    if (!view.team_id) {
      decryptoYourRoleLabel.textContent = "-";
    } else {
      decryptoYourRoleLabel.textContent = view.is_encryptor ? "Encryptor" : "Teammate";
    }
  }
  if (decryptoCurrentCodeLabel) {
    decryptoCurrentCodeLabel.textContent = view.current_code ? formatDecryptoCode(view.current_code) : "-";
  }

  if (decryptoEncryptionArea) {
    decryptoEncryptionArea.classList.toggle("hidden", view.phase !== "encryption");
  }
  if (decryptoGuessArea) {
    decryptoGuessArea.classList.toggle("hidden", view.phase !== "guessing");
  }

  renderDecryptoTeams(view);
  renderDecryptoCurrentClues(view);
  renderDecryptoHistory(view);
  renderDecryptoSummary(view);

  logGameEvents(data);
  updateDecryptoActionButtons();
}

function updateDrawGuessColorButtons() {
  if (!drawGuessColorButtons.length) {
    return;
  }
  drawGuessColorButtons.forEach((button) => {
    const color = button.dataset.color;
    const isActive = color === drawGuessBrushColor;
    button.classList.toggle("color-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function updateDrawGuessBrushButtons() {
  if (!drawGuessBrushButtons.length) {
    return;
  }
  drawGuessBrushButtons.forEach((button) => {
    const size = Number.parseFloat(button.dataset.size);
    const isActive = Number.isFinite(size) && size === drawGuessBrushSize;
    button.classList.toggle("tool-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function getDrawGuessLineWidth() {
  const baseSize = Number.isFinite(drawGuessBrushSize) ? drawGuessBrushSize : 3;
  return drawGuessIsErasing ? baseSize * 4 : baseSize;
}

function setDrawGuessBrushSize(size) {
  const nextSize = Number.parseFloat(size);
  if (!Number.isFinite(nextSize) || nextSize <= 0) {
    return;
  }
  drawGuessBrushSize = nextSize;
  if (drawGuessCtx) {
    drawGuessCtx.lineWidth = getDrawGuessLineWidth();
  }
  updateDrawGuessBrushButtons();
}

function setDrawGuessColor(color) {
  if (typeof color !== "string" || !color.trim()) {
    return;
  }
  drawGuessBrushColor = color;
  if (drawGuessIsErasing) {
    setDrawGuessTool(false);
  } else if (drawGuessCtx) {
    drawGuessCtx.strokeStyle = drawGuessBrushColor;
  }
  updateDrawGuessColorButtons();
}

function setDrawGuessTool(isErasing) {
  drawGuessIsErasing = !!isErasing;
  if (drawGuessCtx) {
    drawGuessCtx.globalCompositeOperation = drawGuessIsErasing ? "destination-out" : "source-over";
    drawGuessCtx.strokeStyle = drawGuessIsErasing ? "rgba(0, 0, 0, 1)" : drawGuessBrushColor;
    drawGuessCtx.lineWidth = getDrawGuessLineWidth();
    drawGuessCtx.beginPath();
  }
  if (drawGuessEraserBtn) {
    drawGuessEraserBtn.classList.toggle("tool-active", drawGuessIsErasing);
  }
}

function clearDrawGuessCanvas() {
  if (!drawGuessCtx || !drawGuessCanvas) {
    return;
  }
  const previousComposite = drawGuessCtx.globalCompositeOperation;
  drawGuessCtx.globalCompositeOperation = "source-over";
  drawGuessCtx.fillStyle = "#fff";
  drawGuessCtx.fillRect(0, 0, drawGuessCanvas.width, drawGuessCanvas.height);
  drawGuessCtx.globalCompositeOperation = previousComposite;
  drawGuessCtx.beginPath();
  drawGuessHasDrawn = false;
}

function getDrawGuessPosition(event) {
  const rect = drawGuessCanvas.getBoundingClientRect();
  const point = event.touches ? event.touches[0] : event;
  const scaleX = rect.width ? drawGuessCanvas.width / rect.width : 1;
  const scaleY = rect.height ? drawGuessCanvas.height / rect.height : 1;
  return {
    x: (point.clientX - rect.left) * scaleX,
    y: (point.clientY - rect.top) * scaleY,
  };
}

function startDrawGuess(event) {
  if (!drawGuessCtx || !drawGuessCanvas) {
    return;
  }
  event.preventDefault();
  drawGuessIsDrawing = true;
  const pos = getDrawGuessPosition(event);
  drawGuessCtx.beginPath();
  drawGuessCtx.moveTo(pos.x, pos.y);
  drawGuessHasDrawn = true;
}

function moveDrawGuess(event) {
  if (!drawGuessIsDrawing || !drawGuessCtx) {
    return;
  }
  event.preventDefault();
  const pos = getDrawGuessPosition(event);
  drawGuessCtx.lineTo(pos.x, pos.y);
  drawGuessCtx.stroke();
}

function endDrawGuess(event) {
  if (!drawGuessIsDrawing || !drawGuessCtx) {
    return;
  }
  event.preventDefault();
  drawGuessIsDrawing = false;
  drawGuessCtx.beginPath();
}

function setupDrawGuessCanvas() {
  if (!drawGuessCanvas || !drawGuessCtx) {
    return;
  }
  drawGuessCtx.lineCap = "round";
  setDrawGuessTool(false);
  clearDrawGuessCanvas();
  updateDrawGuessColorButtons();
  updateDrawGuessBrushButtons();

  drawGuessCanvas.addEventListener("mousedown", startDrawGuess);
  drawGuessCanvas.addEventListener("mousemove", moveDrawGuess);
  drawGuessCanvas.addEventListener("mouseup", endDrawGuess);
  drawGuessCanvas.addEventListener("mouseleave", endDrawGuess);

  drawGuessCanvas.addEventListener("touchstart", startDrawGuess, { passive: false });
  drawGuessCanvas.addEventListener("touchmove", moveDrawGuess, { passive: false });
  drawGuessCanvas.addEventListener("touchend", endDrawGuess, { passive: false });
  drawGuessCanvas.addEventListener("touchcancel", endDrawGuess, { passive: false });
}

function isDrawGuessActionAvailable(actionType) {
  if (currentGameType !== "draw_guess" || !currentDrawGuessView) {
    return false;
  }
  if (!Array.isArray(currentDrawGuessView.legal_actions)) {
    return false;
  }
  if (!currentDrawGuessView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "submit_guess") {
    return !!drawGuessInput.value.trim();
  }
  return true;
}

function updateDrawGuessButtons() {
  if (currentGameType !== "draw_guess") {
    Object.values(drawGuessActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    drawGuessClearBtn.disabled = true;
    if (drawGuessEraserBtn) {
      drawGuessEraserBtn.disabled = true;
    }
    drawGuessColorButtons.forEach((button) => {
      button.disabled = true;
    });
    drawGuessBrushButtons.forEach((button) => {
      button.disabled = true;
    });
    return;
  }
  Object.entries(drawGuessActionButtons).forEach(([actionType, button]) => {
    const allowed = isDrawGuessActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
  const canDraw = isDrawGuessActionAvailable("submit_drawing");
  drawGuessClearBtn.disabled = !canDraw;
  if (drawGuessEraserBtn) {
    drawGuessEraserBtn.disabled = !canDraw;
  }
  drawGuessColorButtons.forEach((button) => {
    button.disabled = !canDraw;
  });
  drawGuessBrushButtons.forEach((button) => {
    button.disabled = !canDraw;
  });
}

function getSplendorPlayer(view, pid) {
  if (!view || !Array.isArray(view.players)) {
    return null;
  }
  return view.players.find((p) => p.player_id === pid) || null;
}

function getSplendorYou(view) {
  return getSplendorPlayer(view, view && view.you);
}

function splendorRequiredCost(card, bonuses) {
  const required = {};
  splendorBaseColors.forEach((color) => {
    const base = (card.cost && card.cost[color]) || 0;
    const discount = (bonuses && bonuses[color]) || 0;
    required[color] = Math.max(0, base - discount);
  });
  return required;
}

function splendorCanAfford(card, player) {
  if (!card || !player) {
    return false;
  }
  const required = splendorRequiredCost(card, player.bonuses || {});
  const total = splendorBaseColors.reduce((sum, color) => sum + required[color], 0);
  const colored = splendorBaseColors.reduce((sum, color) => {
    const available = (player.tokens && player.tokens[color]) || 0;
    return sum + Math.min(required[color], available);
  }, 0);
  const gold = (player.tokens && player.tokens.gold) || 0;
  return gold >= total - colored;
}

function splendorAutoPayment(card, player) {
  if (!card || !player) {
    return null;
  }
  const required = splendorRequiredCost(card, player.bonuses || {});
  const payment = {};
  let paid = 0;
  splendorBaseColors.forEach((color) => {
    const available = (player.tokens && player.tokens[color]) || 0;
    const pay = Math.min(required[color], available);
    payment[color] = pay;
    paid += pay;
  });
  const total = splendorBaseColors.reduce((sum, color) => sum + required[color], 0);
  const remaining = total - paid;
  const gold = (player.tokens && player.tokens.gold) || 0;
  if (remaining > gold) {
    return null;
  }
  payment.gold = remaining;
  return payment;
}

function getSelectedMarketCard(view) {
  if (!view || !splendorSelectedMarket) {
    return null;
  }
  const tier = splendorSelectedMarket.tier;
  const index = splendorSelectedMarket.index;
  const cards = view.market && view.market[tier];
  if (!Array.isArray(cards) || index < 0 || index >= cards.length) {
    return null;
  }
  return cards[index];
}

function getSelectedReservedCard(view) {
  if (!view || splendorSelectedReserved === null) {
    return null;
  }
  const cards = view.your_reserved || [];
  if (splendorSelectedReserved < 0 || splendorSelectedReserved >= cards.length) {
    return null;
  }
  return cards[splendorSelectedReserved];
}

function isSplendorActionAvailable(actionType) {
  if (!currentSplendorView || !Array.isArray(currentSplendorView.legal_actions)) {
    return false;
  }
  if (!currentSplendorView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "take_tokens") {
    const gain = splendorTokenGainForAction(currentSplendorView, "take_tokens");
    if (!gain) {
      return false;
    }
    const requirement = splendorDiscardRequirement(currentSplendorView, gain);
    return splendorIsDiscardSelectionValid(requirement);
  }
  if (actionType === "take_tokens_same") {
    const gain = splendorTokenGainForAction(currentSplendorView, "take_tokens_same");
    if (!gain) {
      return false;
    }
    const requirement = splendorDiscardRequirement(currentSplendorView, gain);
    return splendorIsDiscardSelectionValid(requirement);
  }
  if (actionType === "reserve_market" || actionType === "buy_market") {
    if (!splendorSelectedMarket) {
      return false;
    }
    if (actionType === "buy_market") {
      const card = getSelectedMarketCard(currentSplendorView);
      return !!(card && card.affordable);
    }
    const gain = splendorTokenGainForAction(currentSplendorView, "reserve_market");
    const requirement = splendorDiscardRequirement(currentSplendorView, gain);
    return splendorIsDiscardSelectionValid(requirement);
  }
  if (actionType === "reserve_deck") {
    const gain = splendorTokenGainForAction(currentSplendorView, "reserve_deck");
    const requirement = splendorDiscardRequirement(currentSplendorView, gain);
    return splendorIsDiscardSelectionValid(requirement);
  }
  if (actionType === "buy_reserved") {
    const card = getSelectedReservedCard(currentSplendorView);
    return !!(card && card.affordable);
  }
  if (actionType === "discard_tokens") {
    if (!currentSplendorView) {
      return false;
    }
    const you = getSplendorYou(currentSplendorView);
    if (!you) {
      return false;
    }
    return (
      splendorTokenSelectionTotal() > 0 &&
      splendorColors.every((color) => (splendorTokenSelection[color] || 0) <= ((you.tokens && you.tokens[color]) || 0))
    );
  }
  if (actionType === "choose_noble") {
    return !!splendorSelectedNoble;
  }
  return true;
}

function updateSplendorActionButtons() {
  if (currentGameType !== "splendor") {
    Object.values(splendorActionButtons).forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(splendorActionButtons).forEach(([actionType, button]) => {
    if (!button) {
      return;
    }
    const allowed = isSplendorActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
}

function renderDrawGuessPlayers(view) {
  drawGuessPlayers.innerHTML = "";
  view.players.forEach((p) => {
    const line = document.createElement("div");
    const tags = [];
    if (p.player_id === view.you) {
      tags.push("you");
    }
    if (p.submitted) {
      tags.push("submitted");
    }
    if (p.is_bot) {
      tags.push("bot");
    }
    line.textContent = `${p.seat + 1}. ${p.name} (${tags.join(", ") || "waiting"})`;
    drawGuessPlayers.appendChild(line);
  });
}

function renderDrawGuessReview(view) {
  if (!view.review || !view.review.books) {
    drawGuessReview.classList.add("hidden");
    return;
  }
  drawGuessReview.classList.remove("hidden");
  drawGuessBooks.innerHTML = "";
  view.review.books.forEach((book) => {
    const wrapper = document.createElement("div");
    wrapper.className = "review-book";
    if (book.final_match) {
      wrapper.classList.add("match");
    }
    const title = document.createElement("div");
    title.textContent = `${book.owner_name || book.owner_id}`;
    const promptLine = document.createElement("div");
    promptLine.textContent = `Prompt: ${book.prompt || "-"}`;
    const finalLine = document.createElement("div");
    finalLine.textContent = `Final guess: ${book.final_guess || "-"}`;
    wrapper.appendChild(title);
    wrapper.appendChild(promptLine);
    wrapper.appendChild(finalLine);

    book.entries.forEach((entry) => {
      const entryEl = document.createElement("div");
      entryEl.className = "review-entry";
      const label = document.createElement("div");
      const authorName = entry.author_name || entry.author_id || "unknown";
      label.textContent = `Round ${entry.round} ${entry.type} by ${authorName}`;
      entryEl.appendChild(label);
      if (entry.type === "drawing") {
        const img = document.createElement("img");
        img.src = entry.image_data || "";
        img.alt = "drawing";
        entryEl.appendChild(img);
      } else {
        const text = document.createElement("div");
        text.textContent = entry.text || "-";
        entryEl.appendChild(text);
      }
      wrapper.appendChild(entryEl);
    });

    drawGuessBooks.appendChild(wrapper);
  });
}

function formatSplendorCost(cost) {
  if (!cost) {
    return [];
  }
  return splendorBaseColors
    .filter((color) => cost[color])
    .map((color) => ({
      color,
      count: cost[color],
    }));
}

function createSplendorCard(card, selected, options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "splendor-card";
  if (options.compact) {
    wrapper.classList.add("compact");
  }
  if (selected) {
    wrapper.classList.add("selected");
  }
  if (card.affordable) {
    wrapper.classList.add("affordable");
  }
  const title = document.createElement("div");
  title.className = "card-title";
  const bonusLabel = splendorColorLabels[card.bonus] || card.bonus;
  title.textContent = `${card.id} (${card.points})`;
  wrapper.appendChild(title);

  const bonus = document.createElement("div");
  bonus.className = `cost-chip gem-${card.bonus}`;
  bonus.textContent = `Bonus ${bonusLabel}`;
  wrapper.appendChild(bonus);

  const costRow = document.createElement("div");
  costRow.className = "card-cost";
  formatSplendorCost(card.cost).forEach((entry) => {
    const chip = document.createElement("div");
    chip.className = `cost-chip gem-${entry.color}`;
    chip.textContent = `${splendorColorLabels[entry.color] || entry.color}${entry.count}`;
    costRow.appendChild(chip);
  });
  if (!costRow.childNodes.length) {
    const chip = document.createElement("div");
    chip.className = "cost-chip";
    chip.textContent = "-";
    costRow.appendChild(chip);
  }
  wrapper.appendChild(costRow);
  return wrapper;
}

function createSplendorNobleCard(noble, selected, options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "splendor-card";
  if (options.compact) {
    wrapper.classList.add("compact");
  }
  if (selected) {
    wrapper.classList.add("selected");
  }
  if (noble.eligible) {
    wrapper.classList.add("affordable");
  }
  const title = document.createElement("div");
  title.className = "card-title";
  const hasPoints = typeof noble.points === "number";
  title.textContent = hasPoints ? `${noble.id} (${noble.points})` : `${noble.id}`;
  wrapper.appendChild(title);

  const costRow = document.createElement("div");
  costRow.className = "card-cost";
  formatSplendorCost(noble.requirement).forEach((entry) => {
    const chip = document.createElement("div");
    chip.className = `cost-chip gem-${entry.color}`;
    chip.textContent = `${splendorColorLabels[entry.color] || entry.color}${entry.count}`;
    costRow.appendChild(chip);
  });
  if (!costRow.childNodes.length) {
    const chip = document.createElement("div");
    chip.className = "cost-chip";
    chip.textContent = "-";
    costRow.appendChild(chip);
  }
  wrapper.appendChild(costRow);
  return wrapper;
}

function renderSplendorSupply(view) {
  if (!splendorSupply) {
    return;
  }
  splendorSupply.innerHTML = "";
  splendorColors.forEach((color) => {
    const token = document.createElement("div");
    token.className = `splendor-token gem-${color}`;
    const count = view.tokens_supply ? view.tokens_supply[color] : 0;
    token.textContent = `${splendorColorLabels[color] || color}: ${count}`;
    splendorSupply.appendChild(token);
  });
}

function renderSplendorMarket(view) {
  const tiers = {
    tier3: splendorMarketTier3,
    tier2: splendorMarketTier2,
    tier1: splendorMarketTier1,
  };
  Object.entries(tiers).forEach(([tier, container]) => {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    const cards = (view.market && view.market[tier]) || [];
    cards.forEach((card, index) => {
      const selected = splendorSelectedMarket && splendorSelectedMarket.tier === tier && splendorSelectedMarket.index === index;
      const cardEl = createSplendorCard(card, selected);
      cardEl.addEventListener("click", () => {
        splendorSelectedMarket = { tier, index };
        splendorSelectedReserved = null;
        updateSplendorSelectionLabels();
        renderSplendorMarket(view);
        renderSplendorReserved(view);
        renderSplendorDiscardSelection();
        updateSplendorDiscardHint(view);
        updateSplendorActionButtons();
      });
      container.appendChild(cardEl);
    });
    if (!cards.length) {
      const empty = document.createElement("div");
      empty.className = "splendor-card";
      empty.textContent = "-";
      container.appendChild(empty);
    }
  });
}

function renderSplendorNobles(view) {
  if (!splendorNobles) {
    return;
  }
  splendorNobles.innerHTML = "";
  const nobles = view.nobles || [];
  nobles.forEach((noble) => {
    if (noble && noble.id) {
      splendorNobleCatalog[noble.id] = noble;
    }
    const selected = splendorSelectedNoble === noble.id;
    const nobleEl = createSplendorNobleCard(noble, selected);
    nobleEl.addEventListener("click", () => {
      splendorSelectedNoble = noble.id;
      updateSplendorSelectionLabels();
      renderSplendorNobles(view);
      updateSplendorActionButtons();
    });
    splendorNobles.appendChild(nobleEl);
  });
  if (!nobles.length) {
    const empty = document.createElement("div");
    empty.className = "splendor-card";
    empty.textContent = "-";
    splendorNobles.appendChild(empty);
  }
}

function renderSplendorReserved(view) {
  if (!splendorReserved) {
    return;
  }
  splendorReserved.innerHTML = "";
  const cards = view.your_reserved || [];
  cards.forEach((card, index) => {
    const selected = splendorSelectedReserved === index;
    const cardEl = createSplendorCard(card, selected);
    cardEl.addEventListener("click", () => {
      splendorSelectedReserved = index;
      splendorSelectedMarket = null;
      updateSplendorSelectionLabels();
      renderSplendorMarket(view);
      renderSplendorReserved(view);
      renderSplendorDiscardSelection();
      updateSplendorDiscardHint(view);
      updateSplendorActionButtons();
    });
    splendorReserved.appendChild(cardEl);
  });
  if (!cards.length) {
    const empty = document.createElement("div");
    empty.className = "splendor-card";
    empty.textContent = "-";
    splendorReserved.appendChild(empty);
  }
}

function renderSplendorPlayers(view) {
  if (!splendorPlayers) {
    return;
  }
  splendorPlayers.innerHTML = "";
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    const youTag = player.player_id === view.you ? " (you)" : "";
    name.textContent = `${player.name || player.player_id}${youTag}`;
    const score = document.createElement("div");
    score.className = "badge";
    score.textContent = `Score ${player.score}`;
    header.appendChild(name);
    header.appendChild(score);
    card.appendChild(header);

    const bonuses = splendorBaseColors
      .map((color) => `${splendorColorLabels[color] || color}${(player.bonuses && player.bonuses[color]) || 0}`)
      .join(" ");
    const playerNobles = Array.isArray(player.nobles) ? player.nobles : [];
    const noblesCount = playerNobles.length;

    const meta = document.createElement("div");
    meta.className = "player-meta";
    const tokensLine = document.createElement("div");
    tokensLine.className = "splendor-token-row";
    splendorColors.forEach((color) => {
      const token = document.createElement("div");
      token.className = `splendor-token gem-${color}`;
      const count = (player.tokens && player.tokens[color]) || 0;
      token.textContent = `${splendorColorLabels[color] || color}${count}`;
      tokensLine.appendChild(token);
    });
    const bonusesLine = document.createElement("div");
    bonusesLine.textContent = `Bonuses: ${bonuses}`;
    const purchasedCards = Array.isArray(player.purchased) ? player.purchased : [];
    const purchasedCount = typeof player.purchased_count === "number" ? player.purchased_count : purchasedCards.length;
    const countsLine = document.createElement("div");
    countsLine.textContent = `Reserved: ${player.reserved_count} | Purchased: ${purchasedCount} | Nobles: ${noblesCount}`;
    meta.appendChild(tokensLine);
    meta.appendChild(bonusesLine);
    meta.appendChild(countsLine);
    card.appendChild(meta);

    const purchasedSection = document.createElement("div");
    purchasedSection.className = "splendor-player-purchased";
    const purchasedTitle = document.createElement("div");
    purchasedTitle.className = "splendor-player-purchased-title";
    purchasedTitle.textContent = "Purchased Cards";
    purchasedSection.appendChild(purchasedTitle);
    const purchasedList = document.createElement("div");
    purchasedList.className = "splendor-cards splendor-player-purchased-list";
    if (purchasedCards.length) {
      purchasedCards.forEach((cardData) => {
        const cardEl = createSplendorCard(cardData, false, { compact: true });
        purchasedList.appendChild(cardEl);
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "splendor-player-empty";
      empty.textContent = "-";
      purchasedList.appendChild(empty);
    }
    purchasedSection.appendChild(purchasedList);
    card.appendChild(purchasedSection);

    const noblesSection = document.createElement("div");
    noblesSection.className = "splendor-player-purchased";
    const noblesTitle = document.createElement("div");
    noblesTitle.className = "splendor-player-purchased-title";
    noblesTitle.textContent = "Nobles";
    noblesSection.appendChild(noblesTitle);
    const noblesList = document.createElement("div");
    noblesList.className = "splendor-cards splendor-player-purchased-list";
    if (playerNobles.length) {
      playerNobles.forEach((nobleId) => {
        const nobleData = splendorNobleCatalog[nobleId] || { id: nobleId };
        const nobleEl = createSplendorNobleCard(nobleData, false, { compact: true });
        noblesList.appendChild(nobleEl);
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "splendor-player-empty";
      empty.textContent = "-";
      noblesList.appendChild(empty);
    }
    noblesSection.appendChild(noblesList);
    card.appendChild(noblesSection);
    splendorPlayers.appendChild(card);
  });
}

function renderSplendorGameState(data) {
  const view = data.view;
  currentSplendorView = view;
  if (currentGameType !== "splendor") {
    currentGameType = "splendor";
    setGamePanelVisibility("splendor");
  }

  if (splendorSelectedMarket && !getSelectedMarketCard(view)) {
    splendorSelectedMarket = null;
  }
  if (splendorSelectedReserved !== null && !getSelectedReservedCard(view)) {
    splendorSelectedReserved = null;
  }
  if (splendorSelectedNoble && !(view.nobles || []).some((noble) => noble.id === splendorSelectedNoble)) {
    splendorSelectedNoble = null;
  }

  if (splendorPhaseLabel) {
    splendorPhaseLabel.textContent = view.phase || "-";
  }
  const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
  if (splendorTurnLabel) {
    splendorTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (splendorFinalRoundLabel) {
    if (view.final_round && view.final_round.active) {
      const triggerName = view.final_round.triggered_by ? findPlayerName(view, view.final_round.triggered_by) : "-";
      splendorFinalRoundLabel.textContent = `Yes (${triggerName})`;
    } else {
      splendorFinalRoundLabel.textContent = "No";
    }
  }
  if (splendorWinnerLabel) {
    if (view.winner && view.winner.length) {
      const names = view.winner.map((pid) => findPlayerName(view, pid));
      splendorWinnerLabel.textContent = names.join(", ");
    } else {
      splendorWinnerLabel.textContent = "-";
    }
  }

  updateSplendorSelectionLabels();
  renderSplendorSupply(view);
  renderSplendorMarket(view);
  renderSplendorNobles(view);
  renderSplendorReserved(view);
  renderSplendorPlayers(view);
  renderSplendorTokenSelection();
  renderSplendorDiscardSelection();
  updateSplendorDiscardHint(view);

  logGameEvents(data);
  updateSplendorActionButtons();
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

function formatAbracaLastAction(view) {
  const last = view.last_action;
  if (!last || typeof last.spell_type !== "number") {
    return "-";
  }
  const actor = last.player_id ? findPlayerName(view, last.player_id) : "Unknown";
  const spell = abracaSpellData.find((item) => item.id === last.spell_type);
  const label = spell ? `${spell.number}. ${spell.name}` : `Spell ${last.spell_type + 1}`;
  const result = last.success ? "success" : "fail";
  const dice = Number.isInteger(last.dice) ? ` (dice ${last.dice})` : "";
  return `${actor}: ${label} ${result}${dice}`;
}

function formatAbracaRoundResult(view) {
  const result = view.round_result;
  if (!result) {
    return "-";
  }
  const typeMap = {
    kill: "Kill",
    self_death: "Self Death",
    empty_hand: "Empty Hand",
  };
  const actor = result.actor_id ? findPlayerName(view, result.actor_id) : null;
  let text = typeMap[result.type] || result.type;
  if (actor) {
    text += ` by ${actor}`;
  }
  const addScores = result.add_scores || {};
  const gains = Object.keys(addScores).map((pid) => {
    const gain = addScores[pid];
    return `${findPlayerName(view, pid)} +${gain}`;
  });
  if (gains.length) {
    text += ` | ${gains.join(", ")}`;
  }
  if (Array.isArray(view.winner) && view.winner.length) {
    const winners = view.winner.map((pid) => findPlayerName(view, pid)).join(", ");
    text += ` | Winner: ${winners}`;
  }
  return text;
}

function getAbracaRoundWinners(view, result) {
  const addScores = result && result.add_scores ? result.add_scores : {};
  let maxGain = null;
  const winners = [];
  Object.keys(addScores).forEach((pid) => {
    const gain = Number(addScores[pid]) || 0;
    if (maxGain === null || gain > maxGain) {
      maxGain = gain;
      winners.length = 0;
      winners.push({ pid, gain });
    } else if (gain === maxGain) {
      winners.push({ pid, gain });
    }
  });
  return winners;
}

function formatAbracaRoundNotice(view, result) {
  if (!result) {
    return null;
  }
  const winners = getAbracaRoundWinners(view, result);
  let winnersText = "-";
  if (winners.length) {
    winnersText = winners
      .map((entry) => `${findPlayerName(view, entry.pid)} +${entry.gain}`)
      .join(", ");
  } else if (result.actor_id) {
    winnersText = findPlayerName(view, result.actor_id);
  }
  const label = winners.length === 1 ? "Winner" : "Winners";
  const roundNumber = Number.isInteger(view.round) ? view.round : null;
  const text = roundNumber ? `Round ${roundNumber} ${label}: ${winnersText}` : `${label}: ${winnersText}`;
  return { round: roundNumber, text };
}

function updateAbracaRoundNotice(view) {
  if (!abracaRoundNotice || !abracaRoundNoticeBody) {
    return;
  }
  let notice = null;
  let title = "Round Result";
  let isFresh = false;
  if (view.round_result) {
    notice = formatAbracaRoundNotice(view, view.round_result);
    if (notice) {
      abracaLastRoundNotice = notice;
    }
    if (view.game_over) {
      title = "Game Over";
    } else if (view.phase === "round_end") {
      title = "Round Over";
    }
    isFresh = true;
  } else if (abracaLastRoundNotice) {
    if (Number.isInteger(view.round) && Number.isInteger(abracaLastRoundNotice.round)) {
      if (view.round === abracaLastRoundNotice.round + 1) {
        notice = abracaLastRoundNotice;
        title = "Last Round Result";
      }
    }
  }

  if (notice && notice.text) {
    abracaRoundNoticeBody.textContent = notice.text;
    if (abracaRoundNoticeTitle) {
      abracaRoundNoticeTitle.textContent = title;
    }
    abracaRoundNotice.classList.toggle("muted", !isFresh);
    abracaRoundNotice.classList.remove("hidden");
  } else {
    abracaRoundNotice.classList.add("hidden");
  }
}

function renderAbracaSpells(view) {
  if (!abracaSpells) {
    return;
  }
  abracaSpells.innerHTML = "";
  const discardCounts = Array.isArray(view.discard_counts) ? view.discard_counts : [];
  const table = document.createElement("table");
  table.className = "abraca-spell-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const headers = ["Spell", "Used", "Total", "Effect"];
  headers.forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  abracaSpellData.forEach((spell) => {
    const row = document.createElement("tr");
    row.className = "abraca-spell-row";
    row.dataset.spell = String(spell.id);

    const name = document.createElement("td");
    name.className = "abraca-spell-name";
    name.textContent = `${spell.number}. ${spell.name}`;

    const used = discardCounts[spell.id] ?? 0;
    const usedCell = document.createElement("td");
    usedCell.className = "abraca-spell-count";
    usedCell.textContent = String(used);

    const totalCell = document.createElement("td");
    totalCell.className = "abraca-spell-total";
    totalCell.textContent = String(spell.total);

    const desc = document.createElement("td");
    desc.className = "abraca-spell-desc";
    desc.textContent = spell.desc;

    row.appendChild(name);
    row.appendChild(usedCell);
    row.appendChild(totalCell);
    row.appendChild(desc);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  abracaSpells.appendChild(table);
}

function renderAbracaPlayers(view) {
  if (!abracaPlayers) {
    return;
  }
  abracaPlayers.innerHTML = "";
  const buildAbracaCardSlot = (cardInfo, { compact = false } = {}) => {
    const slot = document.createElement("div");
    slot.className = "player-slot abraca-card";
    if (compact) {
      slot.classList.add("abraca-card-compact");
    }
    if (!cardInfo || cardInfo.hidden) {
      slot.classList.add("abraca-card-hidden");
      slot.textContent = "?";
      slot.title = "Hidden card";
      return slot;
    }

    const rawSpell = Number.isInteger(cardInfo.spell)
      ? cardInfo.spell
      : Number.isInteger(cardInfo.number)
      ? cardInfo.number - 1
      : null;
    const spellType = Number.isInteger(rawSpell) ? rawSpell : null;
    if (spellType !== null) {
      slot.dataset.spell = String(spellType);
    }
    const spell = spellType !== null ? abracaSpellData.find((item) => item.id === spellType) : null;
    const number = Number.isInteger(cardInfo.number) ? cardInfo.number : (spellType ?? 0) + 1;
    const shortName = spell ? spell.short || spell.name : cardInfo.name || "Spell";
    const fullName = spell ? spell.name : cardInfo.name || shortName;

    const numberEl = document.createElement("div");
    numberEl.className = "abraca-card-number";
    numberEl.textContent = String(number);
    const nameEl = document.createElement("div");
    nameEl.className = "abraca-card-name";
    nameEl.textContent = shortName;
    slot.appendChild(numberEl);
    slot.appendChild(nameEl);
    slot.title = `${number}. ${fullName}`;
    return slot;
  };
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
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
    score.textContent = `score ${player.score}`;
    badges.appendChild(score);
    const hp = document.createElement("span");
    hp.className = "badge";
    hp.textContent = `hp ${player.hp}/6`;
    badges.appendChild(hp);
    const secrets = document.createElement("span");
    secrets.className = "badge";
    secrets.textContent = `secret ${player.secret_count}`;
    badges.appendChild(secrets);
    if (player.player_id === view.you) {
      const you = document.createElement("span");
      you.className = "badge";
      you.textContent = "you";
      badges.appendChild(you);
    }
    if (player.is_bot) {
      const bot = document.createElement("span");
      bot.className = "badge";
      bot.textContent = "bot";
      badges.appendChild(bot);
    }
    if (player.player_id === view.current_turn) {
      const turn = document.createElement("span");
      turn.className = "badge highlight";
      turn.textContent = "turn";
      badges.appendChild(turn);
    }
    header.appendChild(badges);
    card.appendChild(header);

    const handRow = document.createElement("div");
    handRow.className = "player-hand";
    if (Array.isArray(player.hand) && player.hand.length) {
      player.hand.forEach((cardInfo) => {
        const slot = buildAbracaCardSlot(cardInfo);
        handRow.appendChild(slot);
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "player-slot empty";
      empty.textContent = "-";
      handRow.appendChild(empty);
    }
    card.appendChild(handRow);

    if (player.player_id === view.you && Array.isArray(player.secret_cards) && player.secret_cards.length) {
      const meta = document.createElement("div");
      meta.className = "player-meta abraca-secret-meta";
      const label = document.createElement("div");
      label.className = "abraca-secret-label";
      label.textContent = "Secret cards";
      const list = document.createElement("div");
      list.className = "abraca-secret-list";
      player.secret_cards.forEach((cardInfo) => {
        list.appendChild(buildAbracaCardSlot(cardInfo, { compact: true }));
      });
      meta.appendChild(label);
      meta.appendChild(list);
      card.appendChild(meta);
    }

    abracaPlayers.appendChild(card);
  });
}

function isAbracaActionAvailable(actionType, spellType) {
  if (!currentAbracaView || !Array.isArray(currentAbracaView.legal_actions)) {
    return false;
  }
  if (!currentAbracaView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "cast_spell") {
    if (!Array.isArray(currentAbracaView.allowed_spells)) {
      return false;
    }
    return currentAbracaView.allowed_spells.includes(spellType);
  }
  return true;
}

function updateAbracaActionButtons() {
  if (abracaSpellButtons.length) {
    abracaSpellButtons.forEach((button) => {
      const spellType = Number.parseInt(button.dataset.spell, 10);
      const allowed = isAbracaActionAvailable("cast_spell", spellType);
      button.disabled = !allowed;
      button.classList.toggle("action-allowed", allowed);
    });
  }
  const buttonMap = [
    { type: "roll_dice", el: abracaRollBtn },
    { type: "take_secret", el: abracaSecretBtn },
    { type: "end_turn", el: abracaEndTurnBtn },
    { type: "start_next_round", el: abracaNextRoundBtn },
  ];
  buttonMap.forEach(({ type, el }) => {
    if (!el) {
      return;
    }
    const allowed = isAbracaActionAvailable(type);
    el.disabled = !allowed;
    el.classList.toggle("action-allowed", allowed);
  });
}

function updateAbracaNewGameRow(view) {
  if (!abracaNewGameRow) {
    return;
  }
  abracaNewGameRow.classList.toggle("hidden", !(view && view.game_over));
}

function renderAbracaGameState(data) {
  const view = data.view;
  currentAbracaView = view;
  if (currentGameType !== "abraca_what") {
    currentGameType = "abraca_what";
    setGamePanelVisibility("abraca_what");
  }

  if (abracaPhaseLabel) {
    abracaPhaseLabel.textContent = view.phase || "-";
  }
  if (abracaRoundLabel) {
    abracaRoundLabel.textContent = view.round ?? "-";
  }
  if (abracaTurnLabel) {
    const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
    abracaTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (abracaDeckLabel) {
    abracaDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (abracaSecretPoolLabel) {
    abracaSecretPoolLabel.textContent = view.secret_pool_count ?? "-";
  }
  if (abracaDiscardLabel) {
    abracaDiscardLabel.textContent = view.discard_total ?? "-";
  }
  if (abracaChainMinLabel) {
    if (Number.isInteger(view.min_spell)) {
      abracaChainMinLabel.textContent = String(view.min_spell + 1);
    } else {
      abracaChainMinLabel.textContent = "-";
    }
  }
  if (abracaLastActionLabel) {
    abracaLastActionLabel.textContent = formatAbracaLastAction(view);
  }
  if (abracaRoundResultLabel) {
    abracaRoundResultLabel.textContent = formatAbracaRoundResult(view);
  }
  updateAbracaRoundNotice(view);
  updateAbracaNewGameRow(view);

  renderAbracaSpells(view);
  renderAbracaPlayers(view);
  logGameEvents(data);
  updateAbracaActionButtons();
}

function renderCaboGameState(data) {
  const view = data.view;
  currentCaboView = view;
  if (currentGameType !== "cabo") {
    currentGameType = "cabo";
    setGamePanelVisibility("cabo");
  }
  if (
    selectedTarget &&
    !view.players.find((p) => p.player_id === selectedTarget.playerId)
  ) {
    selectedTarget = null;
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
  renderTargets(view);

  logGameEvents(data);

  if (view.last_round_summary) {
    const summary = view.last_round_summary;
    log(`Round summary: scores ${JSON.stringify(summary.round_scores)}`);
  }

  updateActionButtons();
}

function renderSkullGameState(data) {
  const view = data.view;
  currentSkullView = view;
  if (currentGameType !== "skull") {
    currentGameType = "skull";
    setGamePanelVisibility("skull");
  }
  if (skullSelectedTarget && !view.players.find((p) => p.player_id === skullSelectedTarget)) {
    skullSelectedTarget = null;
  }
  if (skullSelectedCardIndex !== null && (!view.hand || skullSelectedCardIndex >= view.hand.length)) {
    skullSelectedCardIndex = null;
    skullSelectedCardType = null;
  }

  skullPhaseLabel.textContent = view.phase;
  skullRoundLabel.textContent = view.round;
  const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
  skullTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  skullBidLabel.textContent = view.current_bid ?? "-";
  skullBidderLabel.textContent = view.bidder ? findPlayerName(view, view.bidder) : "-";
  if (Array.isArray(view.passed) && view.passed.length) {
    skullPassedLabel.textContent = view.passed.map((pid) => findPlayerName(view, pid)).join(", ");
  } else {
    skullPassedLabel.textContent = "-";
  }
  skullRosesLabel.textContent = view.roses_revealed ?? "-";
  if (view.last_reveal) {
    skullLastRevealLabel.textContent = `${findPlayerName(view, view.last_reveal.player_id)} -> ${view.last_reveal.card}`;
  } else {
    skullLastRevealLabel.textContent = "-";
  }
  skullWinnerLabel.textContent = view.winner ? findPlayerName(view, view.winner) : "-";

  renderSkullHand(view);
  renderSkullTargets(view);
  renderSkullPlayers(view);

  logGameEvents(data);

  if (view.last_round_summary) {
    const summary = view.last_round_summary;
    if (summary.result === "success") {
      log(`Round success: bidder ${findPlayerName(view, summary.bidder)} bid ${summary.bid}`);
    } else {
      log(`Round fail: bidder ${findPlayerName(view, summary.bidder)} hit ${findPlayerName(view, summary.skull_owner)}`);
    }
  }

  updateSkullSelectedCard();
  updateSkullTargetSelection();
  updateSkullActionButtons();
}

function renderCoyoteGameState(data) {
  const view = data.view;
  const previousView = currentCoyoteView;
  currentCoyoteView = view;
  if (currentGameType !== "coyote") {
    currentGameType = "coyote";
    setGamePanelVisibility("coyote");
  }

  coyotePhaseLabel.textContent = view.phase || "-";
  coyoteRoundLabel.textContent = view.round ?? "-";
  const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
  coyoteTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  coyoteBidLabel.textContent = view.last_bid ?? "-";
  coyoteBidderLabel.textContent = view.last_bidder ? findPlayerName(view, view.last_bidder) : "-";
  coyoteWinnerLabel.textContent = view.winner ? findPlayerName(view, view.winner) : "-";

  if (coyoteRoundNoticeTitle) {
    coyoteRoundNoticeTitle.textContent = "Last Round";
  }
  renderCoyoteRoundNotice(view);
  updateCoyoteBidInput(view, previousView);
  updateCoyoteBidControls(view);

  renderCoyotePlayers(view);
  logGameEvents(data);
  updateCoyoteActionButtons();
  if (coyoteResetBtn) {
    coyoteResetBtn.disabled = !(view && view.game_over);
  }
}

function renderDrawGuessGameState(data) {
  const view = data.view;
  currentDrawGuessView = view;
  if (currentGameType !== "draw_guess") {
    currentGameType = "draw_guess";
    setGamePanelVisibility("draw_guess");
  }

  drawGuessPhaseLabel.textContent = view.phase || "-";
  drawGuessRoundLabel.textContent = view.round ?? "-";
  drawGuessTotalRoundsLabel.textContent = view.total_rounds ?? "-";
  drawGuessSubmittedLabel.textContent = view.submitted ? "yes" : "no";

  renderDrawGuessPlayers(view);
  logGameEvents(data);

  if (view.phase === "draw") {
    drawGuessPromptRow.classList.remove("hidden");
    drawGuessPromptLabel.textContent = view.current_prompt || "-";
    drawGuessDrawArea.classList.remove("hidden");
    drawGuessGuessArea.classList.add("hidden");
    drawGuessReview.classList.add("hidden");
    drawGuessInput.disabled = true;
    if (drawGuessLastRound !== view.round) {
      clearDrawGuessCanvas();
      setDrawGuessTool(false);
    }
    drawGuessCanvas.style.pointerEvents = view.submitted ? "none" : "auto";
  } else if (view.phase === "guess") {
    drawGuessPromptRow.classList.add("hidden");
    drawGuessDrawArea.classList.add("hidden");
    drawGuessGuessArea.classList.remove("hidden");
    drawGuessReview.classList.add("hidden");
    if (drawGuessLastPhase !== view.phase) {
      drawGuessInput.value = "";
    }
    if (view.current_drawing) {
      drawGuessImage.src = view.current_drawing;
    } else {
      drawGuessImage.removeAttribute("src");
    }
    drawGuessInput.disabled = view.submitted;
    drawGuessCanvas.style.pointerEvents = "none";
  } else if (view.phase === "review") {
    drawGuessPromptRow.classList.add("hidden");
    drawGuessDrawArea.classList.add("hidden");
    drawGuessGuessArea.classList.add("hidden");
    drawGuessInput.disabled = true;
    drawGuessCanvas.style.pointerEvents = "none";
    renderDrawGuessReview(view);
  } else {
    drawGuessDrawArea.classList.add("hidden");
    drawGuessGuessArea.classList.add("hidden");
    drawGuessReview.classList.add("hidden");
    drawGuessCanvas.style.pointerEvents = "none";
  }

  drawGuessLastRound = view.round;
  drawGuessLastPhase = view.phase;
  updateDrawGuessButtons();
}

function renderGameState(data) {
  const gameType = data.game_type || (currentRoomState && currentRoomState.game_type);
  if (gameType === "cabo") {
    renderCaboGameState(data);
    return;
  }
  if (gameType === "skull") {
    renderSkullGameState(data);
    return;
  }
  if (gameType === "coyote") {
    renderCoyoteGameState(data);
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
  if (gameType === "abraca_what") {
    renderAbracaGameState(data);
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

document.getElementById("addBotBtn").addEventListener("click", () => {
  socket.emit("room:add_bot", { room_id: roomId });
});

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
    log("Left room");
  });
}

document.getElementById("clearSelection").addEventListener("click", () => {
  clearSelection();
});

clearTargetBtn.addEventListener("click", () => {
  clearTargetSelection();
});

skullClearSelectionBtn.addEventListener("click", () => {
  clearSkullSelection();
});

skullBidInput.addEventListener("input", () => {
  updateSkullActionButtons();
});

coyoteBidInput.addEventListener("input", () => {
  updateCoyoteActionButtons();
});

if (coyoteBidMinusBtn) {
  coyoteBidMinusBtn.addEventListener("click", () => {
    adjustCoyoteBid(-1);
  });
}

if (coyoteBidPlusBtn) {
  coyoteBidPlusBtn.addEventListener("click", () => {
    adjustCoyoteBid(1);
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

document.getElementById("drawDiscardBtn").addEventListener("click", () => {
  if (!selectedSlots.length) {
    log("Select a slot to replace from discard");
    return;
  }
  sendAction({ type: "draw_discard", slot: selectedSlots[0] });
  clearSelection();
});

document.getElementById("replaceBtn").addEventListener("click", () => {
  if (!selectedSlots.length) {
    log("Select a slot to replace");
    return;
  }
  sendAction({ type: "replace_card", slot: selectedSlots[0] });
  clearSelection();
});

document.getElementById("discardDrawnBtn").addEventListener("click", () => {
  sendAction({ type: "discard_drawn" });
});

document.getElementById("matchBtn").addEventListener("click", () => {
  if (selectedSlots.length < 2) {
    log("Select 2-4 slots for match");
    return;
  }
  sendAction({ type: "attempt_match", slots: selectedSlots.slice(0, 4) });
  clearSelection();
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

skullPlayBtn.addEventListener("click", () => {
  if (!skullSelectedCardType) {
    log("Select a card to play");
    return;
  }
  sendAction({ type: "play_card", card_type: skullSelectedCardType });
  clearSkullSelection();
});

skullStartBidBtn.addEventListener("click", () => {
  const bid = Number.parseInt(skullBidInput.value, 10);
  if (!Number.isInteger(bid)) {
    log("Enter a bid number");
    return;
  }
  sendAction({ type: "start_bid", bid });
});

skullRaiseBidBtn.addEventListener("click", () => {
  const bid = Number.parseInt(skullBidInput.value, 10);
  if (!Number.isInteger(bid)) {
    log("Enter a bid number");
    return;
  }
  sendAction({ type: "raise_bid", bid });
});

skullPassBidBtn.addEventListener("click", () => {
  sendAction({ type: "pass_bid" });
});

skullRevealBtn.addEventListener("click", () => {
  if (!skullSelectedTarget) {
    log("Select a reveal target");
    return;
  }
  sendAction({ type: "reveal_card", target_player_id: skullSelectedTarget });
  skullSelectedTarget = null;
  updateSkullTargetSelection();
  updateSkullActionButtons();
});

coyoteBidBtn.addEventListener("click", () => {
  const bid = Number.parseInt(coyoteBidInput.value, 10);
  if (!Number.isInteger(bid)) {
    log("Enter a bid number");
    return;
  }
  sendAction({ type: "bid", bid });
});

coyoteChallengeBtn.addEventListener("click", () => {
  sendAction({ type: "challenge" });
});

if (coyoteResetBtn) {
  coyoteResetBtn.addEventListener("click", () => {
    emitRoomStart();
  });
}

if (decryptoSubmitCluesBtn) {
  decryptoSubmitCluesBtn.addEventListener("click", () => {
    const clues = [decryptoClue1, decryptoClue2, decryptoClue3].map((input) =>
      input ? input.value.trim() : ""
    );
    if (clues.some((clue) => !clue)) {
      log("Enter three clues");
      return;
    }
    sendAction({ type: "submit_clues", clues });
  });
}

if (decryptoSubmitDecryptBtn) {
  decryptoSubmitDecryptBtn.addEventListener("click", () => {
    const code = parseDecryptoCodeInput(decryptoDecryptInput ? decryptoDecryptInput.value : "");
    if (!code) {
      log("Enter a decrypt code like 1.2.3");
      return;
    }
    sendAction({ type: "submit_decrypt", guess: code });
  });
}

if (decryptoSubmitInterceptBtn) {
  decryptoSubmitInterceptBtn.addEventListener("click", () => {
    const code = parseDecryptoCodeInput(decryptoInterceptInput ? decryptoInterceptInput.value : "");
    if (!code) {
      log("Enter an intercept code like 1.2.3");
      return;
    }
    sendAction({ type: "submit_intercept", guess: code });
  });
}

if (decryptoClue1) {
  decryptoClue1.addEventListener("input", () => updateDecryptoActionButtons());
}
if (decryptoClue2) {
  decryptoClue2.addEventListener("input", () => updateDecryptoActionButtons());
}
if (decryptoClue3) {
  decryptoClue3.addEventListener("input", () => updateDecryptoActionButtons());
}
if (decryptoDecryptInput) {
  decryptoDecryptInput.addEventListener("input", () => updateDecryptoActionButtons());
}
if (decryptoInterceptInput) {
  decryptoInterceptInput.addEventListener("input", () => updateDecryptoActionButtons());
}
if (decryptoBotSelect) {
  decryptoBotSelect.addEventListener("change", () => {
    decryptoBotStrategyId = decryptoBotSelect.value || "native";
  });
}
if (decryptoBotClueSelect) {
  decryptoBotClueSelect.addEventListener("change", () => {
    const parsed = Number.parseFloat(decryptoBotClueSelect.value);
    decryptoBotClueDirectness = Number.isFinite(parsed) ? parsed : 0.6;
  });
}

drawGuessClearBtn.addEventListener("click", () => {
  clearDrawGuessCanvas();
});

if (drawGuessEraserBtn) {
  drawGuessEraserBtn.addEventListener("click", () => {
    setDrawGuessTool(!drawGuessIsErasing);
  });
}

if (drawGuessColorButtons.length) {
  drawGuessColorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const color = button.dataset.color;
      if (color) {
        setDrawGuessColor(color);
      }
    });
  });
}

if (drawGuessBrushButtons.length) {
  drawGuessBrushButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const size = Number.parseFloat(button.dataset.size);
      if (Number.isFinite(size)) {
        setDrawGuessBrushSize(size);
      }
    });
  });
}

drawGuessSubmitDrawBtn.addEventListener("click", () => {
  if (!drawGuessCanvas) {
    return;
  }
  sendAction({ type: "submit_drawing", image_data: drawGuessCanvas.toDataURL("image/png") });
});

drawGuessSubmitGuessBtn.addEventListener("click", () => {
  const guess = drawGuessInput.value.trim();
  if (!guess) {
    log("Enter a guess");
    return;
  }
  sendAction({ type: "submit_guess", text: guess });
});

drawGuessInput.addEventListener("input", () => {
  updateDrawGuessButtons();
});

if (drawGuessRestartBtn) {
  drawGuessRestartBtn.addEventListener("click", () => {
    emitRoomStart();
  });
}

if (abracaSpellButtons.length) {
  abracaSpellButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const spellType = Number.parseInt(button.dataset.spell, 10);
      if (!Number.isInteger(spellType)) {
        return;
      }
      sendAction({ type: "cast_spell", spell_type: spellType });
    });
  });
}

if (abracaRollBtn) {
  abracaRollBtn.addEventListener("click", () => {
    sendAction({ type: "roll_dice" });
  });
}

if (abracaSecretBtn) {
  abracaSecretBtn.addEventListener("click", () => {
    sendAction({ type: "take_secret" });
  });
}

if (abracaEndTurnBtn) {
  abracaEndTurnBtn.addEventListener("click", () => {
    sendAction({ type: "end_turn" });
  });
}

if (abracaNextRoundBtn) {
  abracaNextRoundBtn.addEventListener("click", () => {
    sendAction({ type: "start_next_round" });
  });
}

if (abracaNewGameBtn) {
  abracaNewGameBtn.addEventListener("click", () => {
    emitRoomStart();
  });
}

if (splendorClearSelectionBtn) {
  splendorClearSelectionBtn.addEventListener("click", () => {
    clearSplendorSelection();
  });
}

if (splendorTakeThreeBtn) {
  splendorTakeThreeBtn.addEventListener("click", () => {
    const colors = splendorBaseColors.filter((color) => splendorTokenSelection[color] === 1);
    if (colors.length !== 3 || splendorTokenSelectionTotal() !== 3) {
      log("Select exactly 3 different gem colors");
      return;
    }
    const action = { type: "take_tokens", colors };
    const discard = splendorDiscardPayloadForAction(currentSplendorView, "take_tokens");
    if (discard) {
      action.discard = discard;
    }
    sendAction(action);
    resetSplendorTokenSelection();
    resetSplendorDiscardSelection();
    renderSplendorTokenSelection();
    renderSplendorDiscardSelection();
    updateSplendorDiscardHint(currentSplendorView);
    updateSplendorActionButtons();
  });
}

if (splendorTakeTwoBtn) {
  splendorTakeTwoBtn.addEventListener("click", () => {
    const colors = splendorBaseColors.filter((color) => splendorTokenSelection[color] === 2);
    if (colors.length !== 1 || splendorTokenSelectionTotal() !== 2) {
      log("Select exactly 2 of the same gem color");
      return;
    }
    const action = { type: "take_tokens_same", color: colors[0] };
    const discard = splendorDiscardPayloadForAction(currentSplendorView, "take_tokens_same");
    if (discard) {
      action.discard = discard;
    }
    sendAction(action);
    resetSplendorTokenSelection();
    resetSplendorDiscardSelection();
    renderSplendorTokenSelection();
    renderSplendorDiscardSelection();
    updateSplendorDiscardHint(currentSplendorView);
    updateSplendorActionButtons();
  });
}

if (splendorReserveMarketBtn) {
  splendorReserveMarketBtn.addEventListener("click", () => {
    if (!splendorSelectedMarket) {
      log("Select a market card to reserve");
      return;
    }
    const action = {
      type: "reserve_market",
      tier: splendorSelectedMarket.tier,
      index: splendorSelectedMarket.index,
    };
    const discard = splendorDiscardPayloadForAction(currentSplendorView, "reserve_market");
    if (discard) {
      action.discard = discard;
    }
    sendAction(action);
    splendorSelectedMarket = null;
    resetSplendorDiscardSelection();
    renderSplendorDiscardSelection();
    updateSplendorDiscardHint(currentSplendorView);
    updateSplendorSelectionLabels();
    updateSplendorActionButtons();
  });
}

if (splendorReserveDeckBtn) {
  splendorReserveDeckBtn.addEventListener("click", () => {
    const tier = splendorReserveTierSelect ? splendorReserveTierSelect.value : "tier1";
    const action = { type: "reserve_deck", tier };
    const discard = splendorDiscardPayloadForAction(currentSplendorView, "reserve_deck");
    if (discard) {
      action.discard = discard;
    }
    sendAction(action);
    resetSplendorDiscardSelection();
    renderSplendorDiscardSelection();
    updateSplendorDiscardHint(currentSplendorView);
    updateSplendorActionButtons();
  });
}

if (splendorBuyMarketBtn) {
  splendorBuyMarketBtn.addEventListener("click", () => {
    const card = getSelectedMarketCard(currentSplendorView);
    if (!splendorSelectedMarket || !card) {
      log("Select a market card to buy");
      return;
    }
    const you = getSplendorYou(currentSplendorView);
    const payment = splendorAutoPayment(card, you);
    if (!payment) {
      log("Not enough tokens to buy this card");
      return;
    }
    sendAction({
      type: "buy_market",
      tier: splendorSelectedMarket.tier,
      index: splendorSelectedMarket.index,
      payment,
    });
    splendorSelectedMarket = null;
    updateSplendorSelectionLabels();
    updateSplendorActionButtons();
  });
}

if (splendorBuyReservedBtn) {
  splendorBuyReservedBtn.addEventListener("click", () => {
    const card = getSelectedReservedCard(currentSplendorView);
    if (splendorSelectedReserved === null || !card) {
      log("Select a reserved card to buy");
      return;
    }
    const you = getSplendorYou(currentSplendorView);
    const payment = splendorAutoPayment(card, you);
    if (!payment) {
      log("Not enough tokens to buy this card");
      return;
    }
    sendAction({
      type: "buy_reserved",
      reserved_index: splendorSelectedReserved,
      payment,
    });
    splendorSelectedReserved = null;
    updateSplendorSelectionLabels();
    updateSplendorActionButtons();
  });
}

if (splendorDiscardBtn) {
  splendorDiscardBtn.addEventListener("click", () => {
    if (splendorTokenSelectionTotal() <= 0) {
      log("Select tokens to discard");
      return;
    }
    sendAction({ type: "discard_tokens", tokens: { ...splendorTokenSelection } });
    resetSplendorTokenSelection();
    resetSplendorDiscardSelection();
    renderSplendorTokenSelection();
    renderSplendorDiscardSelection();
    updateSplendorDiscardHint(currentSplendorView);
    updateSplendorActionButtons();
  });
}

if (splendorChooseNobleBtn) {
  splendorChooseNobleBtn.addEventListener("click", () => {
    if (!splendorSelectedNoble) {
      log("Select a noble to take");
      return;
    }
    sendAction({ type: "choose_noble", noble_id: splendorSelectedNoble });
    splendorSelectedNoble = null;
    updateSplendorSelectionLabels();
    updateSplendorActionButtons();
  });
}

setupDrawGuessCanvas();

document.querySelectorAll(".collapse-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const panel = btn.closest(".panel");
    if (!panel) {
      return;
    }
    const collapsed = panel.classList.toggle("collapsed");
    btn.textContent = collapsed ? "Show" : "Hide";
    btn.setAttribute("aria-expanded", (!collapsed).toString());
  });
});

if (logCloseBtn) {
  logCloseBtn.addEventListener("click", () => {
    setLogPanelVisible(false);
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
