let currentInAGroveView = null;
let inAGroveExplainMode = false;
let inAGroveSelectedPeekIndexes = [];
let inAGroveSelectedTargetIndex = null;

const inAGrovePanelEl = document.getElementById("inAGrovePanel");
const inAGroveHeaderActions = document.getElementById("inAGroveHeaderActions");
const inAGroveHelpBtn = document.getElementById("inAGroveHelpBtn");
const inAGroveExplainBtn = document.getElementById("inAGroveExplainBtn");
const inAGroveHelpModal = document.getElementById("inAGroveHelpModal");
const inAGroveHelpModalCloseBtn = document.getElementById("inAGroveHelpModalCloseBtn");
const inAGroveExplainModal = document.getElementById("inAGroveExplainModal");
const inAGroveExplainModalCloseBtn = document.getElementById("inAGroveExplainModalCloseBtn");
const inAGroveHelpContent = document.getElementById("inAGroveHelpContent");
const inAGroveExplainContent = document.getElementById("inAGroveExplainContent");
const inAGrovePhaseLabel = document.getElementById("inAGrovePhase");
const inAGroveRoundLabel = document.getElementById("inAGroveRound");
const inAGroveTurnLabel = document.getElementById("inAGroveTurn");
const inAGroveFirstPlayerLabel = document.getElementById("inAGroveFirstPlayer");
const inAGroveBlockedLabel = document.getElementById("inAGroveBlocked");
const inAGroveWinnerLabel = document.getElementById("inAGroveWinner");
const inAGroveYourTiles = document.getElementById("inAGroveYourTiles");
const inAGrovePublicAlibi = document.getElementById("inAGrovePublicAlibi");
const inAGroveTable = document.getElementById("inAGroveTable");
const inAGroveVictim = document.getElementById("inAGroveVictim");
const inAGroveSuspects = document.getElementById("inAGroveSuspects");
const inAGrovePlayers = document.getElementById("inAGrovePlayers");
const inAGroveRoundSummary = document.getElementById("inAGroveRoundSummary");
const inAGroveRoundSummaryBody = document.getElementById("inAGroveRoundSummaryBody");
const inAGrovePeekBtn = document.getElementById("inAGrovePeekBtn");
const inAGroveSwapBtn = document.getElementById("inAGroveSwapBtn");
const inAGroveSkipSwapBtn = document.getElementById("inAGroveSkipSwapBtn");
const inAGroveBetBtn = document.getElementById("inAGroveBetBtn");
const inAGroveNextRoundBtn = document.getElementById("inAGroveNextRoundBtn");
const inAGrovePlayAgainBtn = document.getElementById("inAGrovePlayAgainBtn");

const IN_A_GROVE_HELP_HTML = `
  <h3>Goal</h3>
  <p>Finish the game with the fewest penalty chips.</p>

  <h3>Round Flow</h3>
  <ul>
    <li>Each player secretly knows two innocent tiles: their own tile and the tile passed from the left.</li>
    <li>The first player secretly checks 2 suspects, may swap 1 of them with the victim, then places 1 accusation chip.</li>
    <li>Later players also check 2 suspects, but cannot inspect the suspect blocked by the unseen marker.</li>
    <li>Everyone places exactly 1 accusation chip each round.</li>
  </ul>

  <h3>Who Is Guilty</h3>
  <ul>
    <li>If the revealed suspects include <strong>5</strong>, the murderer is the <strong>smallest numbered</strong> suspect.</li>
    <li>Otherwise, the murderer is the <strong>largest numbered</strong> suspect.</li>
    <li><strong>X</strong> is always innocent.</li>
  </ul>

  <h3>Scoring</h3>
  <ul>
    <li>All chips on the murderer leave the game.</li>
    <li>For each innocent suspect, the <strong>top chip</strong> owner takes the entire stack as penalties.</li>
    <li>The next first player is the one who took the most penalties this round.</li>
    <li>The game ends when someone reaches 8 penalties or runs out of chips in hand.</li>
  </ul>
`;

const IN_A_GROVE_BUTTON_EXPLANATIONS = {
  inAGrovePeekBtn: {
    name: "Peek Selected",
    description: "Secretly inspect the 2 selected suspects.",
    note: "The blocked suspect cannot be chosen.",
  },
  inAGroveSwapBtn: {
    name: "Swap with Victim",
    description: "As the first player, swap the selected viewed suspect with the hidden victim tile.",
    note: "After swapping, the new suspect tile stays unknown to you.",
  },
  inAGroveSkipSwapBtn: {
    name: "Skip Swap",
    description: "Keep the victim where it is and continue to betting.",
  },
  inAGroveBetBtn: {
    name: "Place Bet",
    description: "Put 1 accusation chip on the selected suspect.",
    note: "Stacks matter. The last chip on an innocent suspect takes the whole pile.",
  },
  inAGroveNextRoundBtn: {
    name: "Next Round",
    description: "Confirm that you have finished reviewing the revealed round result.",
    note: "The next round starts only after every player has clicked this button. Bots confirm immediately.",
  },
  inAGrovePlayAgainBtn: {
    name: "Start New Game",
    description: "Restart the room with a fresh In a Grove game.",
  },
};

function showInAGroveHeaderActions(show) {
  if (inAGroveHeaderActions) {
    inAGroveHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitInAGroveExplainMode();
    if (inAGroveHelpModal) setModalVisible(inAGroveHelpModal, false);
    if (inAGroveExplainModal) setModalVisible(inAGroveExplainModal, false);
  }
}

function inAGroveHasLegalAction(actionType) {
  return (
    currentInAGroveView &&
    Array.isArray(currentInAGroveView.legal_actions) &&
    currentInAGroveView.legal_actions.includes(actionType)
  );
}

function clearInAGroveSelection() {
  inAGroveSelectedPeekIndexes = [];
  inAGroveSelectedTargetIndex = null;
}

function trySubmitInAGrovePeekSelection() {
  if (!inAGroveHasLegalAction("peek_suspects")) {
    return false;
  }
  if (inAGroveSelectedPeekIndexes.length !== 2) {
    return false;
  }
  sendAction({ type: "peek_suspects", suspect_indexes: [...inAGroveSelectedPeekIndexes] });
  return true;
}

function trySubmitInAGroveBetSelection() {
  if (!inAGroveHasLegalAction("place_bet")) {
    return false;
  }
  if (!Number.isInteger(inAGroveSelectedTargetIndex)) {
    return false;
  }
  sendAction({ type: "place_bet", suspect_index: inAGroveSelectedTargetIndex });
  return true;
}

function clearInAGroveState() {
  currentInAGroveView = null;
  clearInAGroveSelection();
  if (inAGrovePhaseLabel) inAGrovePhaseLabel.textContent = "-";
  if (inAGroveRoundLabel) inAGroveRoundLabel.textContent = "-";
  if (inAGroveTurnLabel) inAGroveTurnLabel.textContent = "-";
  if (inAGroveFirstPlayerLabel) inAGroveFirstPlayerLabel.textContent = "-";
  if (inAGroveBlockedLabel) inAGroveBlockedLabel.textContent = "-";
  if (inAGroveWinnerLabel) inAGroveWinnerLabel.textContent = "-";
  if (inAGroveYourTiles) inAGroveYourTiles.innerHTML = "";
  if (inAGrovePublicAlibi) inAGrovePublicAlibi.textContent = "-";
  if (inAGroveVictim) inAGroveVictim.textContent = "-";
  if (inAGroveSuspects) inAGroveSuspects.innerHTML = "";
  if (inAGrovePlayers) inAGrovePlayers.innerHTML = "";
  if (inAGroveRoundSummary) inAGroveRoundSummary.classList.add("hidden");
  if (inAGroveRoundSummaryBody) inAGroveRoundSummaryBody.textContent = "-";
  updateInAGroveActionButtons();
}

function inAGrovePlayerColor(playerId) {
  if (!currentInAGroveView || !Array.isArray(currentInAGroveView.players)) {
    return "#64748b";
  }
  const index = currentInAGroveView.players.findIndex((player) => player.player_id === playerId);
  const hue = index >= 0 ? (index * 61) % 360 : 210;
  return `hsl(${hue} 62% 44%)`;
}

function renderInAGroveYourTiles(view) {
  if (!inAGroveYourTiles) {
    return;
  }
  inAGroveYourTiles.innerHTML = "";
  (view.your_tiles || []).forEach((entry) => {
    const pill = document.createElement("div");
    pill.className = "in-a-grove-alibi";
    pill.innerHTML = `<strong>${entry.label}</strong><span>${entry.source}</span>`;
    inAGroveYourTiles.appendChild(pill);
  });
}

function renderInAGroveVictim(view) {
  if (!inAGroveVictim) {
    return;
  }
  inAGroveVictim.textContent = "🎭 Hidden";
}

function buildInAGroveStack(stack) {
  const wrap = document.createElement("div");
  wrap.className = "in-a-grove-stack";
  if (!Array.isArray(stack) || !stack.length) {
    const empty = document.createElement("div");
    empty.className = "in-a-grove-chip empty";
    empty.textContent = "Empty";
    wrap.appendChild(empty);
    return wrap;
  }
  [...stack].reverse().forEach((playerId, index) => {
    const chip = document.createElement("div");
    chip.className = "in-a-grove-chip";
    if (index === 0) {
      chip.classList.add("top");
    }
    chip.style.setProperty("--chip-color", inAGrovePlayerColor(playerId));
    chip.textContent = findPlayerName(currentInAGroveView, playerId);
    wrap.appendChild(chip);
  });
  return wrap;
}

function renderInAGroveSuspects(view) {
  if (!inAGroveSuspects) {
    return;
  }
  inAGroveSuspects.innerHTML = "";
  (view.suspects || []).forEach((suspect) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "in-a-grove-suspect";
    card.dataset.index = String(suspect.index);
    if (suspect.blocked) {
      card.classList.add("blocked");
    }
    const isPeekSelected = inAGroveSelectedPeekIndexes.includes(suspect.index);
    const isTargetSelected = inAGroveSelectedTargetIndex === suspect.index;
    if (isPeekSelected || isTargetSelected) {
      card.classList.add("selected");
    }
    const canPeek = inAGroveHasLegalAction("peek_suspects");
    const canTarget = inAGroveHasLegalAction("swap_with_victim") || inAGroveHasLegalAction("place_bet");
    if ((canPeek || canTarget) && !inAGroveExplainMode) {
      card.classList.add("interactive");
    }
    const face = document.createElement("div");
    face.className = "in-a-grove-suspect-face";
    face.textContent = suspect.label ? `🎍 ${suspect.label}` : "🎍 Hidden";
    const status = document.createElement("div");
    status.className = "in-a-grove-suspect-status";
    if (currentInAGroveView && currentInAGroveView.phase === "round_end") {
      const readyCount = (currentInAGroveView.players || []).filter((player) => player.round_ready).length;
      const totalCount = (currentInAGroveView.players || []).length;
      status.textContent = `📣 Revealed • ${readyCount}/${totalCount} ready`;
    } else {
      status.textContent = suspect.blocked ? "🚫 Unseen marker" : "Open to inspect";
    }
    card.append(face, status, buildInAGroveStack(suspect.stack));
    card.addEventListener("click", () => {
      if (inAGroveExplainMode) {
        return;
      }
      if (inAGroveHasLegalAction("peek_suspects")) {
        const idx = inAGroveSelectedPeekIndexes.indexOf(suspect.index);
        if (idx >= 0) {
          inAGroveSelectedPeekIndexes.splice(idx, 1);
        } else if (!suspect.blocked) {
          if (inAGroveSelectedPeekIndexes.length >= 2) {
            inAGroveSelectedPeekIndexes.shift();
          }
          inAGroveSelectedPeekIndexes.push(suspect.index);
        }
        renderInAGroveSuspects(view);
        updateInAGroveActionButtons();
        if (trySubmitInAGrovePeekSelection()) {
          return;
        }
      } else if (inAGroveHasLegalAction("swap_with_victim") || inAGroveHasLegalAction("place_bet")) {
        inAGroveSelectedTargetIndex = inAGroveSelectedTargetIndex === suspect.index ? null : suspect.index;
        renderInAGroveSuspects(view);
        updateInAGroveActionButtons();
        if (inAGroveHasLegalAction("place_bet") && trySubmitInAGroveBetSelection()) {
          return;
        }
      }
      renderInAGroveSuspects(view);
      updateInAGroveActionButtons();
    });
    inAGroveSuspects.appendChild(card);
  });
}

function renderInAGrovePlayers(view) {
  if (!inAGrovePlayers) {
    return;
  }
  inAGrovePlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card in-a-grove-player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name;
    const stats = document.createElement("div");
    stats.className = "player-meta";
    stats.innerHTML = `
      <div>🎯 Hand chips: <strong>${player.hand_count}</strong></div>
      <div>⚠️ Penalties: <strong>${player.penalty_count}</strong></div>
    `;
    if (view.phase === "round_end") {
      const ready = document.createElement("div");
      ready.className = "in-a-grove-player-ready";
      ready.textContent = player.round_ready ? "✅ Ready" : "⏳ Waiting";
      stats.appendChild(ready);
    }
    card.append(name, stats);
    inAGrovePlayers.appendChild(card);
  });
}

function renderInAGroveSummary(view) {
  if (!inAGroveRoundSummary || !inAGroveRoundSummaryBody) {
    return;
  }
  const summary = view.last_round_summary;
  if (!summary) {
    inAGroveRoundSummary.classList.add("hidden");
    return;
  }
  inAGroveRoundSummary.classList.remove("hidden");
  const pieces = [];
  (summary.suspects || []).forEach((entry) => {
    const title = entry.is_murderer ? `Suspect ${entry.index + 1}: ${entry.label} murderer` : `Suspect ${entry.index + 1}: ${entry.label}`;
    if (entry.is_murderer) {
      pieces.push(`${title}, ${entry.stack.length} chip(s) removed`);
      return;
    }
    if (entry.penalty_receiver) {
      pieces.push(`${title}, ${findPlayerName(view, entry.penalty_receiver)} took ${entry.penalty_count} penalty chip(s)`);
      return;
    }
    pieces.push(`${title}, no chips`);
  });
  if (view.game_over && Array.isArray(view.final_ranking) && view.final_ranking.length) {
    const ranking = view.final_ranking
      .map((entry, index) => `${index + 1}. ${findPlayerName(view, entry.player_id)} (${entry.penalty_count})`)
      .join(" | ");
    pieces.push(`Ranking: ${ranking}`);
  }
  inAGroveRoundSummaryBody.textContent = pieces.join(" | ");
}

function showInAGroveHelpModal() {
  if (!inAGroveHelpModal || !inAGroveHelpContent) {
    return;
  }
  inAGroveHelpContent.innerHTML = IN_A_GROVE_HELP_HTML;
  setModalVisible(inAGroveHelpModal, true);
}

function closeInAGroveHelpModal() {
  if (inAGroveHelpModal) {
    setModalVisible(inAGroveHelpModal, false);
  }
}

function updateInAGroveExplainClasses(enabled) {
  Object.keys(IN_A_GROVE_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const button = document.getElementById(buttonId);
    if (!button) {
      return;
    }
    button.classList.toggle("has-explanation", enabled);
  });
}

function exitInAGroveExplainMode() {
  inAGroveExplainMode = false;
  document.body.classList.remove("in-a-grove-explain-mode");
  updateInAGroveExplainClasses(false);
  if (inAGroveExplainBtn) {
    inAGroveExplainBtn.classList.remove("active");
  }
}

function toggleInAGroveExplainMode() {
  inAGroveExplainMode = !inAGroveExplainMode;
  document.body.classList.toggle("in-a-grove-explain-mode", inAGroveExplainMode);
  updateInAGroveExplainClasses(inAGroveExplainMode);
  if (inAGroveExplainBtn) {
    inAGroveExplainBtn.classList.toggle("active", inAGroveExplainMode);
  }
}

function showInAGroveExplainModal(buttonId) {
  if (!inAGroveExplainModal || !inAGroveExplainContent) {
    return;
  }
  const info = IN_A_GROVE_BUTTON_EXPLANATIONS[buttonId];
  if (!info) {
    return;
  }
  const note = info.note ? `<p>${info.note}</p>` : "";
  inAGroveExplainContent.innerHTML = `<h3>${info.name}</h3><p>${info.description}</p>${note}`;
  setModalVisible(inAGroveExplainModal, true);
}

function closeInAGroveExplainModal() {
  if (inAGroveExplainModal) {
    setModalVisible(inAGroveExplainModal, false);
  }
}

function findInAGroveExplainButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(IN_A_GROVE_BUTTON_EXPLANATIONS)) {
    const button = document.getElementById(buttonId);
    if (!button) {
      continue;
    }
    const rect = button.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  return null;
}

function updateInAGroveActionButtons() {
  const canPeek = inAGroveHasLegalAction("peek_suspects") && inAGroveSelectedPeekIndexes.length === 2;
  const canSwap =
    inAGroveHasLegalAction("swap_with_victim") &&
    Number.isInteger(inAGroveSelectedTargetIndex) &&
    Array.isArray(currentInAGroveView && currentInAGroveView.peeked_indexes) &&
    currentInAGroveView.peeked_indexes.includes(inAGroveSelectedTargetIndex);
  const canSkipSwap = inAGroveHasLegalAction("skip_swap");
  const canBet =
    inAGroveHasLegalAction("place_bet") && Number.isInteger(inAGroveSelectedTargetIndex);
  const canNextRound = inAGroveHasLegalAction("next_round");
  if (inAGrovePeekBtn) inAGrovePeekBtn.disabled = !canPeek;
  if (inAGroveSwapBtn) inAGroveSwapBtn.disabled = !canSwap;
  if (inAGroveSkipSwapBtn) inAGroveSkipSwapBtn.disabled = !canSkipSwap;
  if (inAGroveBetBtn) inAGroveBetBtn.disabled = !canBet;
  if (inAGroveNextRoundBtn) {
    inAGroveNextRoundBtn.disabled = !canNextRound;
    if (currentInAGroveView && currentInAGroveView.phase === "round_end") {
      inAGroveNextRoundBtn.textContent = canNextRound ? "Next Round" : "Waiting...";
    } else {
      inAGroveNextRoundBtn.textContent = "Next Round";
    }
  }
  if (inAGrovePlayAgainBtn) {
    inAGrovePlayAgainBtn.disabled = !(currentInAGroveView && currentInAGroveView.game_over);
  }
}

function renderInAGroveGameState(data) {
  const view = data.view;
  currentInAGroveView = view;
  if (currentGameType !== "in_a_grove") {
    currentGameType = "in_a_grove";
    setGamePanelVisibility("in_a_grove");
  }
  if (inAGrovePhaseLabel) inAGrovePhaseLabel.textContent = view.phase || "-";
  if (inAGroveRoundLabel) inAGroveRoundLabel.textContent = view.round ?? "-";
  if (inAGroveTurnLabel) inAGroveTurnLabel.textContent = view.current_turn ? findPlayerName(view, view.current_turn) : "-";
  if (inAGroveFirstPlayerLabel) inAGroveFirstPlayerLabel.textContent = view.first_player ? findPlayerName(view, view.first_player) : "-";
  if (inAGroveBlockedLabel) {
    inAGroveBlockedLabel.textContent =
      Number.isInteger(view.blocked_suspect_index) ? `Suspect ${view.blocked_suspect_index + 1}` : "-";
  }
  if (inAGroveWinnerLabel) {
    const winners = Array.isArray(view.winner_ids) ? view.winner_ids : [];
    inAGroveWinnerLabel.textContent = winners.length ? winners.map((playerId) => findPlayerName(view, playerId)).join(", ") : "-";
  }
  if (inAGrovePublicAlibi) {
    inAGrovePublicAlibi.textContent = view.public_alibi ? `🪪 ${view.public_alibi}` : "-";
  }

  if (!inAGroveHasLegalAction("peek_suspects")) {
    inAGroveSelectedPeekIndexes = [];
  }
  if (!(inAGroveHasLegalAction("swap_with_victim") || inAGroveHasLegalAction("place_bet"))) {
    inAGroveSelectedTargetIndex = null;
  }

  renderInAGroveYourTiles(view);
  renderInAGroveVictim(view);
  renderInAGroveSuspects(view);
  renderInAGrovePlayers(view);
  renderInAGroveSummary(view);
  logGameEvents(data);
  updateInAGroveActionButtons();
}

if (inAGrovePeekBtn) {
  inAGrovePeekBtn.addEventListener("click", () => {
    if (inAGroveSelectedPeekIndexes.length !== 2) {
      log("Select 2 suspects first.");
      return;
    }
    trySubmitInAGrovePeekSelection();
  });
}

if (inAGroveSwapBtn) {
  inAGroveSwapBtn.addEventListener("click", () => {
    if (!Number.isInteger(inAGroveSelectedTargetIndex)) {
      log("Select 1 viewed suspect to swap.");
      return;
    }
    sendAction({ type: "swap_with_victim", suspect_index: inAGroveSelectedTargetIndex });
  });
}

if (inAGroveSkipSwapBtn) {
  inAGroveSkipSwapBtn.addEventListener("click", () => {
    sendAction({ type: "skip_swap" });
  });
}

if (inAGroveBetBtn) {
  inAGroveBetBtn.addEventListener("click", () => {
    if (!Number.isInteger(inAGroveSelectedTargetIndex)) {
      log("Select a suspect to accuse.");
      return;
    }
    trySubmitInAGroveBetSelection();
  });
}

if (inAGrovePlayAgainBtn) {
  inAGrovePlayAgainBtn.addEventListener("click", () => {
    emitRoomStart();
  });
}

if (inAGroveNextRoundBtn) {
  inAGroveNextRoundBtn.addEventListener("click", () => {
    sendAction({ type: "next_round" });
  });
}

if (inAGroveHelpBtn) {
  inAGroveHelpBtn.addEventListener("click", showInAGroveHelpModal);
}

if (inAGroveExplainBtn) {
  inAGroveExplainBtn.addEventListener("click", toggleInAGroveExplainMode);
}

if (inAGroveHelpModalCloseBtn) {
  inAGroveHelpModalCloseBtn.addEventListener("click", closeInAGroveHelpModal);
}

if (inAGroveExplainModalCloseBtn) {
  inAGroveExplainModalCloseBtn.addEventListener("click", closeInAGroveExplainModal);
}

if (inAGroveHelpModal) {
  inAGroveHelpModal.addEventListener("click", (event) => {
    if (event.target === inAGroveHelpModal) {
      closeInAGroveHelpModal();
    }
  });
}

if (inAGroveExplainModal) {
  inAGroveExplainModal.addEventListener("click", (event) => {
    if (event.target === inAGroveExplainModal) {
      closeInAGroveExplainModal();
    }
  });
}

if (inAGroveTable) {
  inAGroveTable.addEventListener("click", (event) => {
    if (inAGroveExplainMode) {
      return;
    }
    if (event.target !== inAGroveTable) {
      return;
    }
    clearInAGroveSelection();
    if (currentInAGroveView) {
      renderInAGroveSuspects(currentInAGroveView);
    }
    updateInAGroveActionButtons();
  });
}

document.addEventListener(
  "click",
  (event) => {
    if (!inAGroveExplainMode || currentGameType !== "in_a_grove") {
      return;
    }
    const button = event.target.closest("button");
    if (!button) {
      return;
    }
    if (
      button === inAGroveHelpBtn ||
      button === inAGroveExplainBtn ||
      button === inAGroveHelpModalCloseBtn ||
      button === inAGroveExplainModalCloseBtn
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (IN_A_GROVE_BUTTON_EXPLANATIONS[button.id]) {
      showInAGroveExplainModal(button.id);
      exitInAGroveExplainMode();
    }
  },
  true,
);

document.addEventListener(
  "pointerdown",
  (event) => {
    if (!inAGroveExplainMode || currentGameType !== "in_a_grove") {
      return;
    }
    const buttonId = findInAGroveExplainButtonAtPoint(event.clientX, event.clientY);
    if (!buttonId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    showInAGroveExplainModal(buttonId);
    exitInAGroveExplainMode();
  },
  true,
);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  if (inAGroveExplainMode) {
    exitInAGroveExplainMode();
    return;
  }
  if (inAGroveHelpModal && !inAGroveHelpModal.classList.contains("hidden")) {
    closeInAGroveHelpModal();
    return;
  }
  if (inAGroveExplainModal && !inAGroveExplainModal.classList.contains("hidden")) {
    closeInAGroveExplainModal();
  }
});

window.renderInAGroveGameState = renderInAGroveGameState;
window.showInAGroveHeaderActions = showInAGroveHeaderActions;
window.clearInAGroveState = clearInAGroveState;
