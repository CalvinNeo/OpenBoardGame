const socket = io();

let playerId = null;
let roomId = null;
let currentCaboView = null;
let currentSkullView = null;
let currentDrawGuessView = null;
let currentSplendorView = null;
let currentGameType = null;
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
let splendorSelectedMarket = null;
let splendorSelectedReserved = null;
let splendorSelectedNoble = null;
let splendorTokenSelection = {};

const connectionInfo = document.getElementById("connectionInfo");
const roomIdLabel = document.getElementById("roomIdLabel");
const roomStatus = document.getElementById("roomStatus");
const gameTypeLabel = document.getElementById("gameTypeLabel");
const playersList = document.getElementById("playersList");
const gameSelect = document.getElementById("gameSelect");
const leaveBtn = document.getElementById("leaveBtn");
const drawGuessLanguageRow = document.getElementById("drawGuessLanguageRow");
const drawGuessLanguageSelect = document.getElementById("drawGuessLanguageSelect");
const caboPanel = document.getElementById("caboPanel");
const skullPanel = document.getElementById("skullPanel");
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
const drawGuessSubmitDrawBtn = document.getElementById("drawGuessSubmitDrawBtn");
const drawGuessImage = document.getElementById("drawGuessImage");
const drawGuessInput = document.getElementById("drawGuessInput");
const drawGuessSubmitGuessBtn = document.getElementById("drawGuessSubmitGuessBtn");
const drawGuessPlayers = document.getElementById("drawGuessPlayers");
const drawGuessReview = document.getElementById("drawGuessReview");
const drawGuessBooks = document.getElementById("drawGuessBooks");
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

function log(message) {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = message;
  logEl.prepend(entry);
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

function setGamePanelVisibility(gameType) {
  const showCabo = gameType === "cabo";
  const showSkull = gameType === "skull";
  const showDrawGuess = gameType === "draw_guess";
  const showSplendor = gameType === "splendor";
  caboPanel.classList.toggle("hidden", !showCabo);
  skullPanel.classList.toggle("hidden", !showSkull);
  drawGuessPanel.classList.toggle("hidden", !showDrawGuess);
  if (splendorPanel) {
    splendorPanel.classList.toggle("hidden", !showSplendor);
  }
}

function updateDrawGuessLanguageRow() {
  if (!drawGuessLanguageRow) {
    return;
  }
  const showRow = currentRoomState && currentGameType === "draw_guess" && currentRoomState.status === "lobby";
  drawGuessLanguageRow.classList.toggle("hidden", !showRow);
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
  clearDrawGuessState();
  clearSplendorState();
  setGamePanelVisibility(null);
  updateDrawGuessLanguageRow();
  if (drawGuessLanguageSelect) {
    drawGuessLanguageSelect.value = "en";
  }
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

function clearDrawGuessState() {
  currentDrawGuessView = null;
  drawGuessLastRound = null;
  drawGuessLastPhase = null;
  drawGuessIsDrawing = false;
  drawGuessHasDrawn = false;
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

function clearSplendorState() {
  currentSplendorView = null;
  splendorSelectedMarket = null;
  splendorSelectedReserved = null;
  splendorSelectedNoble = null;
  resetSplendorTokenSelection();
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

function clearSplendorSelection() {
  splendorSelectedMarket = null;
  splendorSelectedReserved = null;
  splendorSelectedNoble = null;
  resetSplendorTokenSelection();
  updateSplendorSelectionLabels();
  renderSplendorTokenSelection();
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

function renderSplendorTokenSelection() {
  if (!splendorTokenSelectionEl) {
    return;
  }
  splendorTokenSelectionEl.innerHTML = "";
  splendorColors.forEach((color) => {
    const wrapper = document.createElement("div");
    wrapper.className = `token-picker gem-${color}`;
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
    minus.addEventListener("click", () => adjustSplendorTokenSelection(color, -1));
    plus.addEventListener("click", () => adjustSplendorTokenSelection(color, 1));
    wrapper.appendChild(label);
    wrapper.appendChild(minus);
    wrapper.appendChild(count);
    wrapper.appendChild(plus);
    splendorTokenSelectionEl.appendChild(wrapper);
  });
}

function adjustSplendorTokenSelection(color, delta) {
  const current = splendorTokenSelection[color] || 0;
  const next = Math.max(0, Math.min(20, current + delta));
  splendorTokenSelection[color] = next;
  renderSplendorTokenSelection();
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

function renderRoomState(state) {
  currentRoomState = state;
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
    clearDrawGuessState();
    clearSplendorState();
  }
  setGamePanelVisibility(currentGameType);
  updateDrawGuessLanguageRow();
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

function clearDrawGuessCanvas() {
  if (!drawGuessCtx || !drawGuessCanvas) {
    return;
  }
  drawGuessCtx.fillStyle = "#fff";
  drawGuessCtx.fillRect(0, 0, drawGuessCanvas.width, drawGuessCanvas.height);
  drawGuessHasDrawn = false;
}

function getDrawGuessPosition(event) {
  const rect = drawGuessCanvas.getBoundingClientRect();
  const point = event.touches ? event.touches[0] : event;
  return {
    x: point.clientX - rect.left,
    y: point.clientY - rect.top,
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
  drawGuessCtx.lineWidth = 3;
  drawGuessCtx.lineCap = "round";
  drawGuessCtx.strokeStyle = "#000";
  clearDrawGuessCanvas();

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
  drawGuessClearBtn.disabled = !isDrawGuessActionAvailable("submit_drawing");
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
  const selectionTotal = splendorTokenSelectionTotal();
  if (actionType === "take_tokens") {
    const selected = splendorBaseColors.filter((color) => splendorTokenSelection[color] === 1);
    const hasGold = (splendorTokenSelection.gold || 0) > 0;
    return selected.length === 3 && selectionTotal === 3 && !hasGold;
  }
  if (actionType === "take_tokens_same") {
    const selected = splendorBaseColors.filter((color) => splendorTokenSelection[color] === 2);
    const hasOther = splendorBaseColors.some((color) => {
      const val = splendorTokenSelection[color] || 0;
      return val !== 0 && val !== 2;
    });
    const hasGold = (splendorTokenSelection.gold || 0) > 0;
    return selected.length === 1 && selectionTotal === 2 && !hasGold && !hasOther;
  }
  if (actionType === "reserve_market" || actionType === "buy_market") {
    if (!splendorSelectedMarket) {
      return false;
    }
    if (actionType === "buy_market") {
      const card = getSelectedMarketCard(currentSplendorView);
      return !!(card && card.affordable);
    }
    return true;
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
      selectionTotal > 0 &&
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

function createSplendorCard(card, selected) {
  const wrapper = document.createElement("div");
  wrapper.className = "splendor-card";
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

function createSplendorNobleCard(noble, selected) {
  const wrapper = document.createElement("div");
  wrapper.className = "splendor-card";
  if (selected) {
    wrapper.classList.add("selected");
  }
  if (noble.eligible) {
    wrapper.classList.add("affordable");
  }
  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = `${noble.id} (${noble.points})`;
  wrapper.appendChild(title);

  const costRow = document.createElement("div");
  costRow.className = "card-cost";
  formatSplendorCost(noble.requirement).forEach((entry) => {
    const chip = document.createElement("div");
    chip.className = `cost-chip gem-${entry.color}`;
    chip.textContent = `${splendorColorLabels[entry.color] || entry.color}${entry.count}`;
    costRow.appendChild(chip);
  });
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

    const tokens = splendorColors
      .map((color) => `${splendorColorLabels[color] || color}${(player.tokens && player.tokens[color]) || 0}`)
      .join(" ");
    const bonuses = splendorBaseColors
      .map((color) => `${splendorColorLabels[color] || color}${(player.bonuses && player.bonuses[color]) || 0}`)
      .join(" ");
    const nobles = player.nobles && player.nobles.length ? player.nobles.join(", ") : "-";

    const meta = document.createElement("div");
    meta.className = "player-meta";
    meta.textContent = `Tokens: ${tokens} | Bonuses: ${bonuses} | Reserved: ${player.reserved_count} | Purchased: ${player.purchased_count} | Nobles: ${nobles}`;
    card.appendChild(meta);
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

  logGameEvents(data);
  updateSplendorActionButtons();
}

function logGameEvents(data) {
  if (!data.events || !data.events.length) {
    return;
  }
  data.events.forEach((evt) => {
    if (evt.type === "bot:action") {
      const payload = evt.payload || {};
      const name = payload.name || "Bot";
      log(`Bot ${name}: ${JSON.stringify(payload.action)}`);
    } else {
      log(`${evt.type}`);
    }
  });
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
  if (gameType === "draw_guess") {
    renderDrawGuessGameState(data);
    return;
  }
  if (gameType === "splendor") {
    renderSplendorGameState(data);
  }
}

socket.on("system:info", (data) => {
  if (data.player_id) {
    playerId = data.player_id;
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

socket.on("game:state", (data) => {
  renderGameState(data);
});

// UI actions

document.getElementById("createBtn").addEventListener("click", () => {
  const name = document.getElementById("nameInput").value.trim();
  if (!name) {
    log("Name required");
    return;
  }
  const gameType = gameSelect ? gameSelect.value : "cabo";
  socket.emit("room:create", { name, game_type: gameType });
});

document.getElementById("joinBtn").addEventListener("click", () => {
  const name = document.getElementById("nameInput").value.trim();
  const rid = document.getElementById("roomIdInput").value.trim();
  if (!name || !rid) {
    log("Name and room ID required");
    return;
  }
  socket.emit("room:join", { name, room_id: rid });
});

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
  const payload = { room_id: roomId };
  if (currentGameType === "draw_guess" && drawGuessLanguageSelect) {
    payload.config = { language: drawGuessLanguageSelect.value || "en" };
  }
  socket.emit("room:start", payload);
});

document.getElementById("addBotBtn").addEventListener("click", () => {
  socket.emit("room:add_bot", { room_id: roomId });
});

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

drawGuessClearBtn.addEventListener("click", () => {
  clearDrawGuessCanvas();
});

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
    sendAction({ type: "take_tokens", colors });
    resetSplendorTokenSelection();
    renderSplendorTokenSelection();
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
    sendAction({ type: "take_tokens_same", color: colors[0] });
    resetSplendorTokenSelection();
    renderSplendorTokenSelection();
    updateSplendorActionButtons();
  });
}

if (splendorReserveMarketBtn) {
  splendorReserveMarketBtn.addEventListener("click", () => {
    if (!splendorSelectedMarket) {
      log("Select a market card to reserve");
      return;
    }
    sendAction({
      type: "reserve_market",
      tier: splendorSelectedMarket.tier,
      index: splendorSelectedMarket.index,
    });
    splendorSelectedMarket = null;
    updateSplendorSelectionLabels();
    updateSplendorActionButtons();
  });
}

if (splendorReserveDeckBtn) {
  splendorReserveDeckBtn.addEventListener("click", () => {
    const tier = splendorReserveTierSelect ? splendorReserveTierSelect.value : "tier1";
    sendAction({ type: "reserve_deck", tier });
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
    renderSplendorTokenSelection();
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
