const socket = io();

let playerId = null;
let roomId = null;
let currentView = null;
let selectedSlots = [];
let currentRoomState = null;

const connectionInfo = document.getElementById("connectionInfo");
const roomIdLabel = document.getElementById("roomIdLabel");
const roomStatus = document.getElementById("roomStatus");
const playersList = document.getElementById("playersList");

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
const targetPlayer = document.getElementById("targetPlayer");
const targetSlot = document.getElementById("targetSlot");
const selfSlot = document.getElementById("selfSlot");
const gamePlayers = document.getElementById("gamePlayers");
const logEl = document.getElementById("log");

function log(message) {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = message;
  logEl.prepend(entry);
}

function setConnectionInfo(message) {
  connectionInfo.textContent = message;
}

function updateSelectedSlots() {
  selectedSlotsLabel.textContent = selectedSlots.length ? selectedSlots.join(", ") : "-";
}

function clearSelection() {
  selectedSlots = [];
  updateSelectedSlots();
  document.querySelectorAll(".slot").forEach((el) => {
    el.classList.remove("selected");
  });
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
  roomIdLabel.textContent = state.room_id;
  roomStatus.textContent = state.status;
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
    });
    handSlots.appendChild(div);
  });
}

function renderGamePlayers(view) {
  gamePlayers.innerHTML = "";
  view.players.forEach((p) => {
    const line = document.createElement("div");
    line.className = "player-card";
    const hand = p.hand
      .map((slot, idx) => {
        if (slot.empty) return `#${idx}: empty`;
        return `#${idx}: ${slot.known ? slot.value : "?"}`;
      })
      .join(" | ");
    const tags = [];
    if (p.player_id === view.current_turn) tags.push("turn");
    if (p.player_id === view.you) tags.push("you");
    line.textContent = `${p.name} (score ${p.score}) [${tags.join(", ")}] :: ${hand}`;
    gamePlayers.appendChild(line);
  });
}

function renderTargets(view) {
  targetPlayer.innerHTML = "";
  view.players
    .filter((p) => p.player_id !== view.you)
    .forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.player_id;
      opt.textContent = p.name;
      targetPlayer.appendChild(opt);
    });
}

function renderGameState(data) {
  const view = data.view;
  currentView = view;

  phaseLabel.textContent = view.phase;
  roundLabel.textContent = view.round;
  const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
  turnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn;
  deckCount.textContent = view.deck_count;
  discardTop.textContent = view.discard_top === null ? "-" : view.discard_top;
  lastDrawn.textContent = view.last_drawn === null ? "-" : view.last_drawn;
  const caboCaller = view.players.find((p) => p.player_id === view.cabo_called_by);
  caboBy.textContent = caboCaller ? caboCaller.name : view.cabo_called_by || "-";
  caboLeft.textContent = view.cabo_turns_left || "-";
  pendingChoice.textContent = view.pending_choice ? view.pending_choice.type : "-";

  renderHand(view);
  renderGamePlayers(view);
  renderTargets(view);

  if (data.events && data.events.length) {
    data.events.forEach((evt) => {
      log(`${evt.type}`);
    });
  }

  if (view.last_round_summary) {
    const summary = view.last_round_summary;
    log(`Round summary: scores ${JSON.stringify(summary.round_scores)}`);
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
  socket.emit("room:create", { name, game_type: "cabo" });
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

document.getElementById("clearSelection").addEventListener("click", () => {
  clearSelection();
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

document.getElementById("choiceBtn").addEventListener("click", () => {
  if (!currentView || !currentView.pending_choice) {
    log("No pending choice");
    return;
  }
  const choiceType = currentView.pending_choice.type;
  if (choiceType === "peek") {
    const slot = selectedSlots.length ? selectedSlots[0] : Number(selfSlot.value);
    sendAction({
      type: "use_choice_action",
      choice_type: "peek",
      target: { slot },
    });
  } else if (choiceType === "spy") {
    const targetId = targetPlayer.value;
    const slot = Number(targetSlot.value);
    sendAction({
      type: "use_choice_action",
      choice_type: "spy",
      target: { player_id: targetId, slot },
    });
  } else if (choiceType === "swap") {
    const targetId = targetPlayer.value;
    const slot = Number(targetSlot.value);
    const self = selectedSlots.length ? selectedSlots[0] : Number(selfSlot.value);
    sendAction({
      type: "use_choice_action",
      choice_type: "swap",
      target: { player_id: targetId, slot, self_slot: self },
    });
  }
  clearSelection();
});
