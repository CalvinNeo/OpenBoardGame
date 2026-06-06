let currentFelixView = null;
let felixSelectedCardId = null;
let felixExplainMode = false;

const felixRoundLabel = document.getElementById("felixRound");
const felixPhaseLabel = document.getElementById("felixPhase");
const felixTurnLabel = document.getElementById("felixTurn");
const felixStartLabel = document.getElementById("felixStart");
const felixBidLabel = document.getElementById("felixBid");
const felixBidderLabel = document.getElementById("felixBidder");
const felixBankLabel = document.getElementById("felixBank");
const felixMouseCards = document.getElementById("felixMouseCards");
const felixTableSlots = document.getElementById("felixTableSlots");
const felixHand = document.getElementById("felixHand");
const felixPlayers = document.getElementById("felixPlayers");
const felixBidInput = document.getElementById("felixBidInput");
const felixBidBtn = document.getElementById("felixBidBtn");
const felixPassBtn = document.getElementById("felixPassBtn");
const felixBuyOneBtn = document.getElementById("felixBuyOneBtn");
const felixNextBtn = document.getElementById("felixNextBtn");
const felixNotice = document.getElementById("felixNotice");
const felixNoticeTitle = document.getElementById("felixNoticeTitle");
const felixNoticeBody = document.getElementById("felixNoticeBody");
const felixFinalResults = document.getElementById("felixFinalResults");
const felixHeaderActions = document.getElementById("felixHeaderActions");
const felixHelpBtn = document.getElementById("felixHelpBtn");
const felixExplainBtn = document.getElementById("felixExplainBtn");
const felixHelpModal = document.getElementById("felixHelpModal");
const felixHelpCloseBtn = document.getElementById("felixHelpCloseBtn");
const felixHelpContent = document.querySelector(".felix-help-content");
const felixExplainModal = document.getElementById("felixExplainModal");
const felixExplainCloseBtn = document.getElementById("felixExplainCloseBtn");
const felixExplainContent = document.getElementById("felixExplainContent");

const FELIX_BUTTON_EXPLANATIONS = {
  felixBidBtn: "Bid more mice than the current high bid. You only pay if you win the bag.",
  felixPassBtn: "Leave this auction. You take the lowest available mouse card and reveal the next hidden animal.",
  felixBuyOneBtn: "When everyone else passed before any bid, buy the fully revealed bag for 1 mouse.",
  felixNextBtn: "Confirm that you reviewed the round result. The next round starts after all players confirm.",
};

const FELIX_HELP_HTML = `
  <p>Each player has nine animal cards after one random card is secretly removed. Play one card into the bag each round, then bid with mice to take the bag.</p>
  <p>Passing returns your bid and gives you the lowest available mouse card. Each pass reveals one more hidden animal.</p>
  <p>Good cats score positive points, bad cats score negative points, rabbits score zero, and mice left at the end are points.</p>
  <p>One big dog removes the highest positive cat, or the lowest negative cat if no positive cat exists. One small dog removes the lowest negative cat, or the lowest positive cat if no negative cat exists. Two or more dogs remove only the dogs.</p>
  <p>If nobody bids, the last player sees the full bag and may buy it for 1 mouse or pass. If they pass too, the bag is discarded and mouse cards are not refilled.</p>
`;

function showFelixHeaderActions(show) {
  if (felixHeaderActions) {
    felixHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitFelixExplainMode();
  }
}

function openFelixModal(modal) {
  if (!modal) {
    return;
  }
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeFelixModal(modal) {
  if (!modal) {
    return;
  }
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function enterFelixExplainMode() {
  felixExplainMode = true;
  Object.keys(FELIX_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.classList.add("has-explanation");
    }
  });
}

function exitFelixExplainMode() {
  felixExplainMode = false;
  Object.keys(FELIX_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.classList.remove("has-explanation");
    }
  });
}

function showFelixExplanation(text) {
  if (felixExplainContent) {
    felixExplainContent.textContent = text;
  }
  openFelixModal(felixExplainModal);
}

function felixPlayerName(view, playerId) {
  if (!playerId) {
    return "-";
  }
  const player = (view.players || []).find((item) => item.player_id === playerId);
  return player ? player.name || player.player_id : playerId;
}

function felixActionAvailable(actionType) {
  return !!currentFelixView && Array.isArray(currentFelixView.legal_actions) && currentFelixView.legal_actions.includes(actionType);
}

function felixCardEmoji(card) {
  if (!card) {
    return "❔";
  }
  if (card.kind === "cat") {
    return Number(card.value || 0) < 0 ? "😾" : "🐱";
  }
  if (card.kind === "rabbit") {
    return "🐰";
  }
  if (card.kind === "big_dog") {
    return "🐕";
  }
  if (card.kind === "small_dog") {
    return "🐶";
  }
  return "❔";
}

function felixCardLabel(card) {
  if (!card) {
    return "Hidden";
  }
  if (card.kind === "cat") {
    const value = Number(card.value || 0);
    return `${felixCardEmoji(card)} ${value > 0 ? "+" : ""}${value}`;
  }
  if (card.kind === "rabbit") {
    return "🐰 0";
  }
  if (card.kind === "big_dog") {
    return "🐕 Big Dog";
  }
  if (card.kind === "small_dog") {
    return "🐶 Small Dog";
  }
  return card.label || "-";
}

function renderFelixAnimalCard(card, options = {}) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = "felix-card";
  if (options.static) {
    node.disabled = true;
  }
  if (!card) {
    node.classList.add("face-down");
    node.innerHTML = `<span class="felix-card-emoji">🎒</span><span>Hidden</span>`;
    return node;
  }
  node.classList.add(`kind-${card.kind || "unknown"}`);
  if (card.id === felixSelectedCardId) {
    node.classList.add("selected");
  }
  const emoji = document.createElement("span");
  emoji.className = "felix-card-emoji";
  emoji.textContent = felixCardEmoji(card);
  const label = document.createElement("span");
  label.className = "felix-card-label";
  label.textContent = felixCardLabel(card).replace(`${felixCardEmoji(card)} `, "");
  node.append(emoji, label);
  return node;
}

function renderFelixMouseCards(view) {
  if (!felixMouseCards) {
    return;
  }
  felixMouseCards.innerHTML = "";
  const bag = document.createElement("div");
  bag.className = "felix-mouse-card bag";
  bag.innerHTML = `<span>🎒</span><strong>Bag</strong>`;
  felixMouseCards.appendChild(bag);
  (view.mouse_cards || []).forEach((card) => {
    const node = document.createElement("div");
    node.className = "felix-mouse-card";
    node.innerHTML = `<span>🐭</span><strong>${card.value}</strong><small>${card.mice || 0} on card</small>`;
    felixMouseCards.appendChild(node);
  });
}

function renderFelixTable(view) {
  if (!felixTableSlots) {
    return;
  }
  felixTableSlots.innerHTML = "";
  (view.table_slots || []).forEach((slot) => {
    const wrap = document.createElement("div");
    wrap.className = "felix-slot";
    if (slot.resolution) {
      wrap.classList.add(`resolution-${slot.resolution}`);
    }
    const owner = document.createElement("div");
    owner.className = "felix-slot-owner";
    owner.textContent = slot.source === "dummy" ? "Dummy" : felixPlayerName(view, slot.player_id);
    const card = renderFelixAnimalCard(slot.face_up ? slot.card : null, { static: true });
    const status = document.createElement("div");
    status.className = "felix-slot-status";
    if (slot.resolution === "removed") {
      status.textContent = "Removed";
    } else if (slot.resolution === "awarded") {
      status.textContent = "Awarded";
    } else {
      status.textContent = slot.face_up ? "Revealed" : "Hidden";
    }
    wrap.append(owner, card, status);
    felixTableSlots.appendChild(wrap);
  });
}

function renderFelixHand(view) {
  if (!felixHand) {
    return;
  }
  felixHand.innerHTML = "";
  const hand = Array.isArray(view.your_hand) ? view.your_hand : [];
  if (!hand.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No cards left.";
    felixHand.appendChild(empty);
    return;
  }
  hand.forEach((card) => {
    const button = renderFelixAnimalCard(card);
    button.disabled = !felixActionAvailable("choose_card");
    button.addEventListener("click", () => {
      if (felixExplainMode || !felixActionAvailable("choose_card")) {
        return;
      }
      felixSelectedCardId = card.id;
      sendAction({ type: "choose_card", card_id: card.id });
    });
    felixHand.appendChild(button);
  });
}

function renderFelixPlayers(view) {
  if (!felixPlayers) {
    return;
  }
  felixPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card felix-player-card";
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (player.passed) {
      card.classList.add("passed");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id || "-";
    const meta = document.createElement("div");
    meta.className = "felix-player-meta";
    const mice = player.mice_hidden ? "Secret" : `${player.mice ?? 0} 🐭`;
    meta.textContent = `Hand ${player.hand_count ?? 0} · Mice ${mice} · Bid ${player.round_bid || 0} · Won ${player.won_count || 0}`;
    if (player.passed) {
      meta.textContent += " · Passed";
    }
    if (view.game_over) {
      meta.textContent += ` · Cats ${player.final_cat_score || 0} · Score ${player.final_score || 0}`;
    }
    const won = document.createElement("div");
    won.className = "felix-won-row";
    if (Array.isArray(player.won_cards) && player.won_cards.length) {
      player.won_cards.forEach((wonCard) => won.appendChild(renderFelixAnimalCard(wonCard, { static: true })));
    } else {
      won.textContent = view.game_over ? "No won cards." : "Won cards hidden.";
      won.classList.add("hint");
    }
    card.append(name, meta, won);
    felixPlayers.appendChild(card);
  });
}

function renderFelixNotice(view) {
  if (!felixNotice || !felixNoticeTitle || !felixNoticeBody) {
    return;
  }
  const summary = view.last_round_summary;
  felixNotice.classList.toggle("hidden", !summary && !view.game_over);
  if (!summary && !view.game_over) {
    if (felixFinalResults) {
      felixFinalResults.innerHTML = "";
    }
    return;
  }
  felixNoticeTitle.textContent = view.game_over ? "Game Over" : "Round Summary";
  if (view.game_over) {
    const winners = Array.isArray(view.winner) ? view.winner : [];
    felixNoticeBody.textContent = winners.length ? `Winner: ${winners.map((pid) => felixPlayerName(view, pid)).join(", ")}` : "No winner.";
  } else if (summary.result === "won") {
    const winner = felixPlayerName(view, summary.winner);
    const wonLabels = (summary.won_cards || []).map(felixCardLabel).join(", ") || "nothing";
    const removedLabels = (summary.removed_cards || []).map(felixCardLabel).join(", ") || "nothing";
    felixNoticeBody.textContent = `${winner} paid ${summary.paid || 0} 🐭 and won ${wonLabels}. Removed: ${removedLabels}.`;
  } else if (summary.result === "no_sale") {
    felixNoticeBody.textContent = "Everyone passed. The bag was discarded and mouse cards will not refill.";
  } else {
    felixNoticeBody.textContent = summary.result || "-";
  }
  if (felixFinalResults) {
    felixFinalResults.innerHTML = "";
    if (view.game_over) {
      (view.players || []).forEach((player) => {
        const row = document.createElement("div");
        row.className = "felix-result-row";
        row.textContent = `${player.name || player.player_id}: cats ${player.final_cat_score || 0}, mice ${player.mice || 0}, score ${player.final_score || 0}`;
        felixFinalResults.appendChild(row);
      });
    }
  }
}

function updateFelixButtons() {
  const canBid = felixActionAvailable("bid");
  const canPass = felixActionAvailable("pass");
  const canBuy = felixActionAvailable("buy_for_one");
  const canNext = felixActionAvailable("next_round");
  if (felixBidInput && currentFelixView) {
    const minBid = Number(currentFelixView.current_bid || 0) + 1;
    felixBidInput.min = String(minBid);
    if (!felixBidInput.value || Number(felixBidInput.value) < minBid) {
      felixBidInput.value = String(minBid);
    }
    felixBidInput.disabled = !canBid;
  }
  if (felixBidBtn) {
    felixBidBtn.disabled = !canBid;
    felixBidBtn.classList.toggle("action-allowed", canBid);
  }
  if (felixPassBtn) {
    felixPassBtn.disabled = !canPass;
    felixPassBtn.classList.toggle("action-allowed", canPass);
  }
  if (felixBuyOneBtn) {
    felixBuyOneBtn.disabled = !canBuy;
    felixBuyOneBtn.classList.toggle("action-allowed", canBuy);
  }
  if (felixNextBtn) {
    felixNextBtn.disabled = !canNext;
    felixNextBtn.classList.toggle("action-allowed", canNext);
  }
}

function renderFelixGameState(data) {
  const view = data.view;
  currentFelixView = view;
  if (currentGameType !== "felix") {
    currentGameType = "felix";
    setGamePanelVisibility("felix");
  }
  if (felixRoundLabel) {
    felixRoundLabel.textContent = view.round ?? "-";
  }
  if (felixPhaseLabel) {
    felixPhaseLabel.textContent = view.phase || "-";
  }
  if (felixTurnLabel) {
    felixTurnLabel.textContent = felixPlayerName(view, view.current_turn);
  }
  if (felixStartLabel) {
    felixStartLabel.textContent = felixPlayerName(view, view.start_player);
  }
  if (felixBidLabel) {
    felixBidLabel.textContent = view.current_bid ?? 0;
  }
  if (felixBidderLabel) {
    felixBidderLabel.textContent = felixPlayerName(view, view.current_bidder);
  }
  if (felixBankLabel) {
    felixBankLabel.textContent = view.bank_mice ?? 0;
  }
  renderFelixNotice(view);
  renderFelixMouseCards(view);
  renderFelixTable(view);
  renderFelixHand(view);
  renderFelixPlayers(view);
  updateFelixButtons();
  logGameEvents(data);
}

if (felixBidBtn) {
  felixBidBtn.addEventListener("click", () => {
    const amount = Number(felixBidInput ? felixBidInput.value : 0);
    if (!Number.isInteger(amount) || amount < 1) {
      return;
    }
    sendAction({ type: "bid", amount });
  });
}

if (felixPassBtn) {
  felixPassBtn.addEventListener("click", () => {
    sendAction({ type: "pass" });
  });
}

if (felixBuyOneBtn) {
  felixBuyOneBtn.addEventListener("click", () => {
    sendAction({ type: "buy_for_one" });
  });
}

if (felixNextBtn) {
  felixNextBtn.addEventListener("click", () => {
    sendAction({ type: "next_round" });
  });
}

if (felixHelpBtn) {
  felixHelpBtn.addEventListener("click", () => {
    if (felixHelpContent) {
      felixHelpContent.innerHTML = FELIX_HELP_HTML;
    }
    openFelixModal(felixHelpModal);
  });
}

if (felixHelpCloseBtn) {
  felixHelpCloseBtn.addEventListener("click", () => closeFelixModal(felixHelpModal));
}

if (felixExplainBtn) {
  felixExplainBtn.addEventListener("click", () => {
    if (felixExplainMode) {
      exitFelixExplainMode();
    } else {
      enterFelixExplainMode();
    }
  });
}

if (felixExplainCloseBtn) {
  felixExplainCloseBtn.addEventListener("click", () => closeFelixModal(felixExplainModal));
}

document.addEventListener(
  "click",
  (event) => {
    if (!felixExplainMode) {
      return;
    }
    const button = event.target.closest("button");
    if (!button || !button.closest("#felixPanel")) {
      return;
    }
    if (button === felixHelpBtn || button === felixExplainBtn) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const explanation = FELIX_BUTTON_EXPLANATIONS[button.id];
    if (explanation) {
      showFelixExplanation(explanation);
      exitFelixExplainMode();
    }
  },
  true
);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    exitFelixExplainMode();
    closeFelixModal(felixHelpModal);
    closeFelixModal(felixExplainModal);
  }
});

