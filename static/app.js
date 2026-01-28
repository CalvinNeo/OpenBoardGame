const socket = io();

let playerId = null;
let roomId = null;
let currentCaboView = null;
let currentSkullView = null;
let currentDrawGuessView = null;
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

const connectionInfo = document.getElementById("connectionInfo");
const roomIdLabel = document.getElementById("roomIdLabel");
const roomStatus = document.getElementById("roomStatus");
const gameTypeLabel = document.getElementById("gameTypeLabel");
const playersList = document.getElementById("playersList");
const gameSelect = document.getElementById("gameSelect");
const leaveBtn = document.getElementById("leaveBtn");
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

function log(message) {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = message;
  logEl.prepend(entry);
}

function setConnectionInfo(message) {
  connectionInfo.textContent = message;
}

function setGamePanelVisibility(gameType) {
  const showCabo = gameType === "cabo";
  const showSkull = gameType === "skull";
  const showDrawGuess = gameType === "draw_guess";
  caboPanel.classList.toggle("hidden", !showCabo);
  skullPanel.classList.toggle("hidden", !showSkull);
  drawGuessPanel.classList.toggle("hidden", !showDrawGuess);
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
  setGamePanelVisibility(null);
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
  }
  setGamePanelVisibility(currentGameType);
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
  socket.emit("room:start", { room_id: roomId });
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
