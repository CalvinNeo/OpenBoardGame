let currentCriminalDanceView = null;
let criminalDanceSelectedCardId = null;
let criminalDanceExplainMode = false;

const criminalDanceConfigBox = document.getElementById("criminalDanceConfigBox");
const criminalDanceDetectiveRuleSelect = document.getElementById("criminalDanceDetectiveRuleSelect");
const criminalDanceDogFailSelect = document.getElementById("criminalDanceDogFailSelect");
const criminalDanceBoyToggle = document.getElementById("criminalDanceBoyToggle");
const criminalDanceChiefToggle = document.getElementById("criminalDanceChiefToggle");
const criminalDanceScoringToggle = document.getElementById("criminalDanceScoringToggle");
const criminalDanceBoyVisibilitySelect = document.getElementById("criminalDanceBoyVisibilitySelect");

const criminalDanceHeaderActions = document.getElementById("criminalDanceHeaderActions");
const criminalDanceHelpBtn = document.getElementById("criminalDanceHelpBtn");
const criminalDanceExplainBtn = document.getElementById("criminalDanceExplainBtn");
const criminalDanceHelpModal = document.getElementById("criminalDanceHelpModal");
const criminalDanceHelpContent = document.getElementById("criminalDanceHelpContent");
const criminalDanceHelpModalCloseBtn = document.getElementById("criminalDanceHelpModalCloseBtn");
const criminalDanceExplainModal = document.getElementById("criminalDanceExplainModal");
const criminalDanceExplainContent = document.getElementById("criminalDanceExplainContent");
const criminalDanceExplainModalCloseBtn = document.getElementById("criminalDanceExplainModalCloseBtn");

const criminalDanceRoundEl = document.getElementById("criminalDanceRound");
const criminalDanceTurnEl = document.getElementById("criminalDanceTurn");
const criminalDanceSummaryEl = document.getElementById("criminalDanceSummary");
const criminalDancePlayersEl = document.getElementById("criminalDancePlayers");
const criminalDanceHandEl = document.getElementById("criminalDanceHand");
const criminalDanceCardDetailEl = document.getElementById("criminalDanceCardDetail");
const criminalDanceControlsEl = document.getElementById("criminalDanceControls");
const criminalDancePlayedEl = document.getElementById("criminalDancePlayed");
const criminalDancePrivateEl = document.getElementById("criminalDancePrivate");

function criminalDanceCardLabel(cardType) {
  const map = {
    first_finder: "🥇 First Finder",
    criminal: "🕵️ Criminal",
    detective: "🔍 Detective",
    alibi: "🧾 Alibi",
    dog: "🐶 Dog",
    accomplice: "😈 Accomplice",
    witness: "👀 Witness",
    info_control: "↩️ Info Control",
    rumor: "🗣️ Rumor",
    trade: "🤝 Trade",
    boy: "🧒 Boy",
    civilian: "🙂 Civilian",
    chief: "👮 Chief",
  };
  return map[cardType] || cardType || "-";
}

function criminalDanceCardInfo(cardType) {
  const map = {
    first_finder: "Must be your first played card in a round if you still hold it.",
    criminal: "You can only play this as your last hand card. If you do, criminal team wins the round.",
    detective: "Pick one player to accuse. If they hold Criminal and cannot block with Alibi, you win instantly.",
    alibi: "Passive defense against Detective accusation while this card remains in your hand.",
    dog: "Pick one player, reveal a random card from their hand. If Criminal is revealed, you win instantly.",
    accomplice: "After playing this card, you join the criminal team for criminal-win scoring.",
    witness: "Pick one player and secretly see their full hand.",
    info_control: "All players pass one random hand card to the left at the same time.",
    rumor: "All players draw one random card from the right player's hand at the same time.",
    trade: "Pick one player and trade one card with them.",
    boy: "At round start, Boy gets hidden identity info about the Criminal.",
    civilian: "No effect.",
    chief: "Mark one player. If that player is Criminal at round end, Chief scores as a catch win.",
  };
  return map[cardType] || "No card description.";
}

const CRIMINAL_DANCE_EXPLAIN = {
  play_card: {
    name: "Play Card",
    description: "Play your selected card and resolve its effect immediately.",
  },
  pick_card: {
    name: "Pick Hand Card",
    description: "Select one card from your hand. Click blank area to unselect.",
  },
  pick_target: {
    name: "Pick Target",
    description: "Choose another player for cards like Detective / Dog / Witness / Trade / Chief.",
  },
  play_again: {
    name: "Play Again",
    description: "Start next round while keeping total scores.",
  },
};

function markCriminalDanceExplainable(el, key) {
  if (!el || !key) return;
  el.dataset.criminalDanceExplainKey = key;
  if (criminalDanceExplainMode) el.classList.add("has-explanation");
}

function updateCriminalDanceExplainClasses(enabled) {
  const nodes = document.querySelectorAll("[data-criminal-dance-explain-key]");
  nodes.forEach((node) => node.classList.toggle("has-explanation", enabled));
}

function showCriminalDanceExplain(key) {
  if (!criminalDanceExplainModal || !criminalDanceExplainContent) return;
  if (typeof key === "string" && key.startsWith("card:")) {
    const cardType = key.slice(5);
    criminalDanceExplainContent.innerHTML = `
      <h3>${criminalDanceCardLabel(cardType)}</h3>
      <p>${criminalDanceCardInfo(cardType)}</p>
    `;
    setModalVisible(criminalDanceExplainModal, true);
    return;
  }
  const item = CRIMINAL_DANCE_EXPLAIN[key];
  if (!item) return;
  criminalDanceExplainContent.innerHTML = `<h3>${item.name}</h3><p>${item.description}</p>`;
  setModalVisible(criminalDanceExplainModal, true);
}

function exitCriminalDanceExplainMode() {
  if (!criminalDanceExplainMode) return;
  criminalDanceExplainMode = false;
  document.body.classList.remove("criminal-dance-explain-mode");
  if (criminalDanceExplainBtn) criminalDanceExplainBtn.classList.remove("active");
  updateCriminalDanceExplainClasses(false);
}

function toggleCriminalDanceExplainMode() {
  criminalDanceExplainMode = !criminalDanceExplainMode;
  document.body.classList.toggle("criminal-dance-explain-mode", criminalDanceExplainMode);
  if (criminalDanceExplainBtn) criminalDanceExplainBtn.classList.toggle("active", criminalDanceExplainMode);
  updateCriminalDanceExplainClasses(criminalDanceExplainMode);
}

function clearCriminalDanceState() {
  exitCriminalDanceExplainMode();
  currentCriminalDanceView = null;
  criminalDanceSelectedCardId = null;
  if (criminalDanceRoundEl) criminalDanceRoundEl.textContent = "-";
  if (criminalDanceTurnEl) criminalDanceTurnEl.textContent = "-";
  if (criminalDanceSummaryEl) criminalDanceSummaryEl.textContent = "-";
  if (criminalDancePlayersEl) criminalDancePlayersEl.innerHTML = "";
  if (criminalDanceHandEl) criminalDanceHandEl.innerHTML = "";
  if (criminalDanceCardDetailEl) criminalDanceCardDetailEl.textContent = "-";
  if (criminalDanceControlsEl) criminalDanceControlsEl.innerHTML = "";
  if (criminalDancePlayedEl) criminalDancePlayedEl.innerHTML = "";
  if (criminalDancePrivateEl) criminalDancePrivateEl.innerHTML = "";
  if (criminalDanceHelpModal) setModalVisible(criminalDanceHelpModal, false);
  if (criminalDanceExplainModal) setModalVisible(criminalDanceExplainModal, false);
}

function showCriminalDanceHeaderActions(show) {
  if (!criminalDanceHeaderActions) return;
  criminalDanceHeaderActions.style.display = show ? "flex" : "none";
}

function updateCriminalDanceConfigRow() {
  const show = currentRoomState && currentGameType === "criminal_dance" && currentRoomState.status === "lobby";
  if (!criminalDanceConfigBox) return;
  criminalDanceConfigBox.classList.toggle("hidden", !show);
  criminalDanceConfigBox.setAttribute("aria-hidden", (!show).toString());
}

function renderCriminalDancePlayers(view) {
  if (!criminalDancePlayersEl) return;
  criminalDancePlayersEl.innerHTML = "";
  (view.players || []).forEach((player) => {
    const row = document.createElement("div");
    row.className = "criminal-dance-player";
    const tags = [];
    if (player.you) tags.push("you");
    if (player.player_id === view.current_player_id && !view.game_over) tags.push("turn");
    if (player.is_accomplice) tags.push("😈");
    row.textContent = `${player.name} (${player.score} pts) · 🃏 ${player.hand_count}${tags.length ? ` · ${tags.join(" ")}` : ""}`;
    criminalDancePlayersEl.appendChild(row);
  });
}

function renderCriminalDanceHand(view) {
  if (!criminalDanceHandEl) return;
  criminalDanceHandEl.innerHTML = "";
  const me = (view.players || []).find((item) => item.you);
  const hand = me && Array.isArray(me.hand) ? me.hand : [];
  hand.forEach((card) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "criminal-dance-card";
    if (card.id === criminalDanceSelectedCardId) btn.classList.add("selected");
    btn.textContent = criminalDanceCardLabel(card.type);
    markCriminalDanceExplainable(btn, `card:${card.type}`);
    btn.addEventListener("click", () => {
      criminalDanceSelectedCardId = card.id === criminalDanceSelectedCardId ? null : card.id;
      renderCriminalDanceHand(view);
      renderCriminalDanceCardDetail(view);
      renderCriminalDanceControls(view);
    });
    criminalDanceHandEl.appendChild(btn);
  });
  criminalDanceHandEl.onclick = (event) => {
    if (event.target === criminalDanceHandEl) {
      criminalDanceSelectedCardId = null;
      renderCriminalDanceHand(view);
      renderCriminalDanceCardDetail(view);
      renderCriminalDanceControls(view);
    }
  };
}

function renderCriminalDanceCardDetail(view) {
  if (!criminalDanceCardDetailEl) return;
  const me = (view.players || []).find((item) => item.you);
  const hand = me && Array.isArray(me.hand) ? me.hand : [];
  const selectedCard = hand.find((card) => card.id === criminalDanceSelectedCardId) || null;
  if (!selectedCard) {
    criminalDanceCardDetailEl.textContent = "Select a card to view what it does.";
    return;
  }
  criminalDanceCardDetailEl.textContent = `${criminalDanceCardLabel(selectedCard.type)}: ${criminalDanceCardInfo(selectedCard.type)}`;
}

function renderCriminalDancePlayed(view) {
  if (!criminalDancePlayedEl) return;
  criminalDancePlayedEl.innerHTML = "";
  (view.played || []).slice(-8).forEach((entry) => {
    const row = document.createElement("div");
    row.className = "criminal-dance-public";
    markCriminalDanceExplainable(row, `card:${entry.card.type}`);
    const name = (view.players || []).find((p) => p.player_id === entry.player_id)?.name || entry.player_id;
    row.textContent = `${name}: ${criminalDanceCardLabel(entry.card.type)} - ${criminalDanceCardInfo(entry.card.type)}`;
    criminalDancePlayedEl.appendChild(row);
  });
}

function renderCriminalDancePrivate(view) {
  if (!criminalDancePrivateEl) return;
  criminalDancePrivateEl.innerHTML = "";
  const me = (view.players || []).find((item) => item.you);
  const notes = me && Array.isArray(me.private_log) ? me.private_log : [];
  notes.slice(-6).forEach((text) => {
    const row = document.createElement("div");
    row.className = "criminal-dance-private";
    row.textContent = `🔒 ${text}`;
    criminalDancePrivateEl.appendChild(row);
  });
}

function renderCriminalDanceControls(view) {
  if (!criminalDanceControlsEl) return;
  criminalDanceControlsEl.innerHTML = "";
  const legal = Array.isArray(view.legal_actions) ? view.legal_actions : [];
  if (legal.includes("play_again")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Play Again";
    markCriminalDanceExplainable(btn, "play_again");
    btn.addEventListener("click", () => sendAction({ type: "play_again" }));
    criminalDanceControlsEl.appendChild(btn);
    return;
  }
  if (!legal.includes("play_card")) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = view.game_over ? "Round over. Wait for next action." : "Waiting for current player.";
    criminalDanceControlsEl.appendChild(hint);
    return;
  }

  const me = (view.players || []).find((item) => item.you);
  const hand = me && Array.isArray(me.hand) ? me.hand : [];
  const selectedCard = hand.find((card) => card.id === criminalDanceSelectedCardId) || null;
  const needsTarget = selectedCard && ["detective", "dog", "witness", "trade", "chief"].includes(selectedCard.type);
  const needsYourTradeCard = selectedCard && selectedCard.type === "trade";

  let targetSelect = null;
  if (needsTarget) {
    const row = document.createElement("div");
    row.className = "row compact-row";
    const label = document.createElement("label");
    label.textContent = "Target";
    targetSelect = document.createElement("select");
    markCriminalDanceExplainable(targetSelect, "pick_target");
    (view.players || [])
      .filter((p) => !p.you)
      .forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.player_id;
        opt.textContent = p.name;
        targetSelect.appendChild(opt);
      });
    row.appendChild(label);
    row.appendChild(targetSelect);
    criminalDanceControlsEl.appendChild(row);
  }

  let tradeSelect = null;
  if (needsYourTradeCard) {
    const row = document.createElement("div");
    row.className = "row compact-row";
    const label = document.createElement("label");
    label.textContent = "Your Trade Card";
    tradeSelect = document.createElement("select");
    hand
      .filter((c) => c.id !== selectedCard.id)
      .forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = criminalDanceCardLabel(c.type);
        tradeSelect.appendChild(opt);
      });
    row.appendChild(label);
    row.appendChild(tradeSelect);
    criminalDanceControlsEl.appendChild(row);
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Play Card";
  markCriminalDanceExplainable(btn, "play_card");
  btn.disabled = !selectedCard;
  btn.addEventListener("click", () => {
    if (!selectedCard) return;
    const payload = { type: "play_card", card_id: selectedCard.id };
    if (needsTarget && targetSelect) {
      payload.target_player_id = targetSelect.value;
    }
    if (needsYourTradeCard && tradeSelect && tradeSelect.value) {
      payload.your_card_id = tradeSelect.value;
    }
    sendAction(payload);
  });
  criminalDanceControlsEl.appendChild(btn);
}

function renderCriminalDanceRoomState() {
  if (criminalDanceSummaryEl) {
    criminalDanceSummaryEl.textContent = "Ready up and start. Criminal is hidden in hands.";
  }
}

function renderCriminalDanceGameState(data) {
  const view = data && data.view ? data.view : null;
  currentCriminalDanceView = view;
  if (!view) {
    clearCriminalDanceState();
    return;
  }
  if (currentGameType !== "criminal_dance") {
    currentGameType = "criminal_dance";
    setGamePanelVisibility("criminal_dance");
  }
  if (criminalDanceRoundEl) criminalDanceRoundEl.textContent = String(view.round_number || "-");
  if (criminalDanceTurnEl) criminalDanceTurnEl.textContent = view.current_player_name || "-";
  if (criminalDanceSummaryEl) criminalDanceSummaryEl.textContent = view.last_summary || "Play one card each turn.";
  renderCriminalDancePlayers(view);
  renderCriminalDanceHand(view);
  renderCriminalDanceCardDetail(view);
  renderCriminalDancePlayed(view);
  renderCriminalDancePrivate(view);
  renderCriminalDanceControls(view);
  logGameEvents(data);
}

const CRIMINAL_DANCE_HELP_HTML = `
  <h3>Goal</h3>
  <p>Catch the criminal with Detective 🔍 / Dog 🐶, or escape by playing Criminal 🕵️ as your final card.</p>
  <h3>Quick Rules</h3>
  <ul>
    <li>Each turn you play exactly one card.</li>
    <li>Criminal can only be played when it is your last hand card.</li>
    <li>Accomplice 😈 joins criminal team only after it is played.</li>
    <li>Witness 👀 reveals one player's full hand to you privately.</li>
    <li>Info Control ↩️ passes a random card to the left simultaneously.</li>
    <li>Rumor 🗣️ draws one random card from the right simultaneously.</li>
  </ul>
`;

function openCriminalDanceHelp() {
  if (!criminalDanceHelpModal || !criminalDanceHelpContent) return;
  criminalDanceHelpContent.innerHTML = CRIMINAL_DANCE_HELP_HTML;
  setModalVisible(criminalDanceHelpModal, true);
}

if (criminalDanceHelpBtn) {
  criminalDanceHelpBtn.addEventListener("click", openCriminalDanceHelp);
}
if (criminalDanceExplainBtn) {
  criminalDanceExplainBtn.addEventListener("click", toggleCriminalDanceExplainMode);
}
if (criminalDanceHelpModalCloseBtn) {
  criminalDanceHelpModalCloseBtn.addEventListener("click", () => setModalVisible(criminalDanceHelpModal, false));
}
if (criminalDanceExplainModalCloseBtn) {
  criminalDanceExplainModalCloseBtn.addEventListener("click", () => setModalVisible(criminalDanceExplainModal, false));
}
if (criminalDanceHelpModal) {
  criminalDanceHelpModal.addEventListener("click", (event) => {
    if (event.target === criminalDanceHelpModal) setModalVisible(criminalDanceHelpModal, false);
  });
}
if (criminalDanceExplainModal) {
  criminalDanceExplainModal.addEventListener("click", (event) => {
    if (event.target === criminalDanceExplainModal) setModalVisible(criminalDanceExplainModal, false);
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  exitCriminalDanceExplainMode();
  if (criminalDanceHelpModal && !criminalDanceHelpModal.classList.contains("hidden")) {
    setModalVisible(criminalDanceHelpModal, false);
  }
  if (criminalDanceExplainModal && !criminalDanceExplainModal.classList.contains("hidden")) {
    setModalVisible(criminalDanceExplainModal, false);
  }
});

document.addEventListener("pointerdown", (event) => {
  if (!criminalDanceExplainMode || currentGameType !== "criminal_dance") return;
  const explainable = event.target.closest("[data-criminal-dance-explain-key]");
  if (!explainable) return;
  event.preventDefault();
  event.stopPropagation();
  showCriminalDanceExplain(explainable.dataset.criminalDanceExplainKey);
  exitCriminalDanceExplainMode();
}, true);

window.clearCriminalDanceState = clearCriminalDanceState;
window.renderCriminalDanceGameState = renderCriminalDanceGameState;
window.updateCriminalDanceConfigRow = updateCriminalDanceConfigRow;
window.showCriminalDanceHeaderActions = showCriminalDanceHeaderActions;
window.renderCriminalDanceRoomState = renderCriminalDanceRoomState;
