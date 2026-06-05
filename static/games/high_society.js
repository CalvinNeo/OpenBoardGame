let currentHighSocietyView = null;
let highSocietySelectedMoney = [];
let highSocietyExplainMode = false;

const highSocietyRoundLabel = document.getElementById("highSocietyRound");
const highSocietyPhaseLabel = document.getElementById("highSocietyPhase");
const highSocietyDeckCountLabel = document.getElementById("highSocietyDeckCount");
const highSocietyTimerLabel = document.getElementById("highSocietyTimer");
const highSocietyNotice = document.getElementById("highSocietyNotice");
const highSocietyNoticeTitle = document.getElementById("highSocietyNoticeTitle");
const highSocietyNoticeBody = document.getElementById("highSocietyNoticeBody");
const highSocietyFinalResults = document.getElementById("highSocietyFinalResults");
const highSocietyCurrentCard = document.getElementById("highSocietyCurrentCard");
const highSocietyTurnLabel = document.getElementById("highSocietyTurn");
const highSocietyStartLabel = document.getElementById("highSocietyStart");
const highSocietyHighBidLabel = document.getElementById("highSocietyHighBid");
const highSocietyHighBidderLabel = document.getElementById("highSocietyHighBidder");
const highSocietyHand = document.getElementById("highSocietyHand");
const highSocietySelectedTotalLabel = document.getElementById("highSocietySelectedTotal");
const highSocietyBidBtn = document.getElementById("highSocietyBidBtn");
const highSocietyPassBtn = document.getElementById("highSocietyPassBtn");
const highSocietyNextBtn = document.getElementById("highSocietyNextBtn");
const highSocietyFauxPasBox = document.getElementById("highSocietyFauxPasBox");
const highSocietyFauxPasChoices = document.getElementById("highSocietyFauxPasChoices");
const highSocietyPlayers = document.getElementById("highSocietyPlayers");
const highSocietyHeaderActions = document.getElementById("highSocietyHeaderActions");
const highSocietyHelpBtn = document.getElementById("highSocietyHelpBtn");
const highSocietyExplainBtn = document.getElementById("highSocietyExplainBtn");
const highSocietyHelpModal = document.getElementById("highSocietyHelpModal");
const highSocietyHelpCloseBtn = document.getElementById("highSocietyHelpCloseBtn");
const highSocietyHelpContent = document.querySelector(".high-society-help-content");
const highSocietyExplainModal = document.getElementById("highSocietyExplainModal");
const highSocietyExplainCloseBtn = document.getElementById("highSocietyExplainCloseBtn");
const highSocietyExplainContent = document.getElementById("highSocietyExplainContent");

const HIGH_SOCIETY_BUTTON_EXPLANATIONS = {
  highSocietyBidBtn:
    "Bid with the selected money cards. Your new table total must be higher than the current high bid; selected money is added to money already on your table.",
  highSocietyPassBtn:
    "Pass for this auction. In normal auctions you take your table money back and leave the auction; in disgrace auctions you immediately take the bad card.",
  highSocietyNextBtn:
    "Confirm that you have reviewed the round summary. The next round starts only after every player confirms.",
};

const HIGH_SOCIETY_HELP_HTML = `
  <p>Bid for Luxury and Prestige cards, and bid to avoid Disgrace cards. Money cards are fixed denominations and spent money is gone for the rest of the game.</p>
  <p><strong>Normal auction:</strong> players raise the bid or pass. Passing returns your table money. The last remaining player takes the card and discards their table money.</p>
  <p><strong>Disgrace auction:</strong> the first player to pass takes the Disgrace card and gets their table money back. Everyone else discards their table money.</p>
  <p>The fourth timer card ends the game immediately. Timer cards are the three Prestige cards and Scandale.</p>
  <p>At game end, the player or players with the least remaining money are cast out before scoring. Remaining players score Luxury values, apply Passe, multiply by Prestige cards, then apply Scandale.</p>
`;

function formatHighSocietyMoney(value) {
  if (value === null || value === undefined) {
    return "-";
  }
  return `$${Number(value).toLocaleString()}`;
}

function formatHighSocietyScore(score) {
  if (score === null || score === undefined) {
    return "-";
  }
  if (Number.isInteger(Number(score))) {
    return String(Number(score));
  }
  return Number(score).toFixed(1);
}

function getHighSocietyCardLabel(view, card) {
  if (!card) {
    return "-";
  }
  if (view && view.card_labels && view.card_labels[card.id]) {
    return view.card_labels[card.id];
  }
  if (card.type === "luxury") {
    return `Luxury ${card.value}`;
  }
  if (card.type === "prestige") {
    return "Prestige x2";
  }
  return card.id || "-";
}

function highSocietyPlayerName(view, playerId) {
  if (!playerId) {
    return "-";
  }
  const player = (view.players || []).find((item) => item.player_id === playerId);
  return player ? player.name || player.player_id : playerId;
}

function isHighSocietyActionAvailable(actionType) {
  if (!currentHighSocietyView || !Array.isArray(currentHighSocietyView.legal_actions)) {
    return false;
  }
  return currentHighSocietyView.legal_actions.includes(actionType);
}

function updateHighSocietyButtons() {
  const canBid = isHighSocietyActionAvailable("bid");
  const canPass = isHighSocietyActionAvailable("pass");
  const canNext = isHighSocietyActionAvailable("next_round");
  const selectedTotal = highSocietySelectedMoney.reduce((sum, value) => sum + Number(value), 0);
  const self = currentHighSocietyView
    ? (currentHighSocietyView.players || []).find((player) => player.player_id === currentHighSocietyView.you)
    : null;
  const tableTotal = self ? Number(self.table_total || 0) : 0;
  const highBid = currentHighSocietyView ? Number(currentHighSocietyView.current_high_bid || 0) : 0;
  if (highSocietySelectedTotalLabel) {
    const newTotal = tableTotal + selectedTotal;
    highSocietySelectedTotalLabel.textContent = `${formatHighSocietyMoney(selectedTotal)} · New total ${formatHighSocietyMoney(newTotal)}`;
  }
  if (highSocietyBidBtn) {
    highSocietyBidBtn.disabled = !canBid || !highSocietySelectedMoney.length || tableTotal + selectedTotal <= highBid;
    highSocietyBidBtn.classList.toggle("action-allowed", !highSocietyBidBtn.disabled);
  }
  if (highSocietyPassBtn) {
    highSocietyPassBtn.disabled = !canPass;
    highSocietyPassBtn.classList.toggle("action-allowed", canPass);
  }
  if (highSocietyNextBtn) {
    highSocietyNextBtn.disabled = !canNext;
    highSocietyNextBtn.classList.toggle("action-allowed", canNext);
  }
}

function showHighSocietyHeaderActions(show) {
  if (highSocietyHeaderActions) {
    highSocietyHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitHighSocietyExplainMode();
  }
}

function openHighSocietyModal(modal) {
  if (!modal) {
    return;
  }
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeHighSocietyModal(modal) {
  if (!modal) {
    return;
  }
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function enterHighSocietyExplainMode() {
  highSocietyExplainMode = true;
  Object.keys(HIGH_SOCIETY_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.classList.add("has-explanation");
    }
  });
  if (highSocietyFauxPasChoices) {
    highSocietyFauxPasChoices.querySelectorAll("button").forEach((button) => {
      button.classList.add("has-explanation");
    });
  }
}

function exitHighSocietyExplainMode() {
  highSocietyExplainMode = false;
  Object.keys(HIGH_SOCIETY_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.classList.remove("has-explanation");
    }
  });
  if (highSocietyFauxPasChoices) {
    highSocietyFauxPasChoices.querySelectorAll("button").forEach((button) => {
      button.classList.remove("has-explanation");
    });
  }
}

function showHighSocietyExplanation(text) {
  if (highSocietyExplainContent) {
    highSocietyExplainContent.textContent = text;
  }
  openHighSocietyModal(highSocietyExplainModal);
}

function highSocietyExplanationForButton(button) {
  if (!button) {
    return null;
  }
  if (button.id && HIGH_SOCIETY_BUTTON_EXPLANATIONS[button.id]) {
    return HIGH_SOCIETY_BUTTON_EXPLANATIONS[button.id];
  }
  if (button.classList.contains("high-society-faux-choice")) {
    return "Discard this Luxury card to satisfy Faux Pas. Faux Pas cannot discard Prestige or other Disgrace cards.";
  }
  return null;
}

function findHighSocietyExplainButtonAtPoint(x, y) {
  const candidates = [
    ...Object.keys(HIGH_SOCIETY_BUTTON_EXPLANATIONS).map((buttonId) => document.getElementById(buttonId)),
    ...(highSocietyFauxPasChoices ? Array.from(highSocietyFauxPasChoices.querySelectorAll("button")) : []),
  ].filter(Boolean);
  return candidates.find((button) => {
    const rect = button.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
}

function renderHighSocietyStatusCard(view, card) {
  const node = document.createElement("div");
  node.className = "high-society-card-face";
  if (!card) {
    node.textContent = "-";
    return node;
  }
  node.classList.add(`type-${card.type}`);
  const title = document.createElement("div");
  title.className = "high-society-card-title";
  title.textContent = getHighSocietyCardLabel(view, card);
  const detail = document.createElement("div");
  detail.className = "high-society-card-detail";
  if (card.type === "luxury") {
    detail.textContent = `Status ${card.value}`;
  } else if (card.type === "prestige") {
    detail.textContent = "Doubles status · timer";
  } else if (card.id === "faux_pas") {
    detail.textContent = "Discard a luxury";
  } else if (card.id === "passe") {
    detail.textContent = "-5 status";
  } else if (card.id === "scandale") {
    detail.textContent = "Halve status · timer";
  } else {
    detail.textContent = card.type || "";
  }
  node.append(title, detail);
  return node;
}

function renderHighSocietyHand(view) {
  if (!highSocietyHand) {
    return;
  }
  highSocietyHand.innerHTML = "";
  const hand = Array.isArray(view.your_hand_money) ? view.your_hand_money : [];
  if (!hand.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No money cards left.";
    highSocietyHand.appendChild(empty);
    return;
  }
  hand.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "high-society-money-card";
    button.textContent = formatHighSocietyMoney(value);
    if (highSocietySelectedMoney.includes(value)) {
      button.classList.add("selected");
    }
    button.addEventListener("click", () => {
      const idx = highSocietySelectedMoney.indexOf(value);
      if (idx >= 0) {
        highSocietySelectedMoney.splice(idx, 1);
      } else {
        highSocietySelectedMoney.push(value);
      }
      renderHighSocietyHand(view);
      updateHighSocietyButtons();
    });
    highSocietyHand.appendChild(button);
  });
}

function renderHighSocietyPlayers(view) {
  if (!highSocietyPlayers) {
    return;
  }
  highSocietyPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card high-society-player-card";
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (player.eliminated) {
      card.classList.add("eliminated");
    }

    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id || "-";

    const meta = document.createElement("div");
    meta.className = "high-society-player-meta";
    const tableMoney = Array.isArray(player.table_money) ? player.table_money : [];
    meta.textContent = `Hand ${player.hand_count ?? 0} · Table ${formatHighSocietyMoney(player.table_total || 0)}`;
    if (view.game_over) {
      meta.textContent += ` · Cash ${formatHighSocietyMoney(player.final_money_total || 0)} · Score ${formatHighSocietyScore(player.final_status_score)}`;
      if (player.eliminated) {
        meta.textContent += " · Cast out";
      }
    }

    const table = document.createElement("div");
    table.className = "high-society-table-money";
    if (tableMoney.length) {
      tableMoney.forEach((value) => {
        const chip = document.createElement("span");
        chip.className = "high-society-money-chip";
        chip.textContent = formatHighSocietyMoney(value);
        table.appendChild(chip);
      });
    } else {
      table.textContent = "No table money.";
      table.classList.add("hint");
    }

    const statuses = document.createElement("div");
    statuses.className = "high-society-card-list";
    const statusCards = Array.isArray(player.status_cards) ? player.status_cards : [];
    if (statusCards.length) {
      statusCards.forEach((statusCard) => {
        statuses.appendChild(renderHighSocietyStatusCard(view, statusCard));
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "No status cards.";
      statuses.appendChild(empty);
    }

    card.append(name, meta, table, statuses);
    highSocietyPlayers.appendChild(card);
  });
}

function renderHighSocietyNotice(view) {
  if (!highSocietyNotice || !highSocietyNoticeBody || !highSocietyNoticeTitle) {
    return;
  }
  const summary = view.last_round_summary;
  const finalResults = view.final_results;
  if (!summary && !view.game_over) {
    highSocietyNotice.classList.add("hidden");
    if (highSocietyFinalResults) {
      highSocietyFinalResults.innerHTML = "";
    }
    return;
  }
  highSocietyNotice.classList.remove("hidden");
  highSocietyNoticeTitle.textContent = view.game_over ? "Game Over" : "Round Summary";
  if (view.game_over) {
    const winners = Array.isArray(view.winner) ? view.winner : [];
    if (winners.length) {
      highSocietyNoticeBody.textContent = `Winner: ${winners.map((pid) => highSocietyPlayerName(view, pid)).join(", ")}`;
    } else {
      highSocietyNoticeBody.textContent = "No winner: all players were cast out.";
    }
  } else if (summary.result === "normal_win") {
    const winner = highSocietyPlayerName(view, summary.winner);
    const label = getHighSocietyCardLabel(view, summary.card);
    highSocietyNoticeBody.textContent = `${winner} gained ${label} for ${formatHighSocietyMoney(summary.paid_total || 0)}.`;
  } else if (summary.result === "disgrace_taken") {
    const taker = highSocietyPlayerName(view, summary.taker);
    const label = getHighSocietyCardLabel(view, summary.card);
    highSocietyNoticeBody.textContent = `${taker} took ${label}. Other table money discarded: ${formatHighSocietyMoney(summary.discarded_total || 0)}.`;
  } else {
    highSocietyNoticeBody.textContent = summary.result || "-";
  }
  if (highSocietyFinalResults) {
    highSocietyFinalResults.innerHTML = "";
    if (view.game_over && finalResults) {
      (view.players || []).forEach((player) => {
        const row = document.createElement("div");
        row.className = "high-society-result-row";
        row.textContent = `${player.name || player.player_id}: cash ${formatHighSocietyMoney(player.final_money_total || 0)}, score ${formatHighSocietyScore(player.final_status_score)}${player.eliminated ? " · cast out" : ""}`;
        highSocietyFinalResults.appendChild(row);
      });
    }
  }
}

function renderHighSocietyFauxPas(view) {
  if (!highSocietyFauxPasBox || !highSocietyFauxPasChoices) {
    return;
  }
  highSocietyFauxPasChoices.innerHTML = "";
  const canChoose = isHighSocietyActionAvailable("choose_faux_pas_discard");
  highSocietyFauxPasBox.classList.toggle("hidden", !canChoose);
  if (!canChoose) {
    return;
  }
  const self = (view.players || []).find((player) => player.player_id === view.you);
  const luxuries = self ? (self.status_cards || []).filter((card) => card.type === "luxury") : [];
  luxuries.forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "high-society-faux-choice";
    button.appendChild(renderHighSocietyStatusCard(view, card));
    button.addEventListener("click", () => {
      if (highSocietyExplainMode) {
        return;
      }
      sendAction({ type: "choose_faux_pas_discard", card_id: card.id });
    });
    highSocietyFauxPasChoices.appendChild(button);
  });
}

function renderHighSocietyGameState(data) {
  const view = data.view;
  currentHighSocietyView = view;
  highSocietySelectedMoney = highSocietySelectedMoney.filter((value) =>
    Array.isArray(view.your_hand_money) && view.your_hand_money.includes(value)
  );
  if (currentGameType !== "high_society") {
    currentGameType = "high_society";
    setGamePanelVisibility("high_society");
  }
  if (highSocietyRoundLabel) {
    highSocietyRoundLabel.textContent = view.round ?? "-";
  }
  if (highSocietyPhaseLabel) {
    highSocietyPhaseLabel.textContent = view.phase || "-";
  }
  if (highSocietyDeckCountLabel) {
    highSocietyDeckCountLabel.textContent = view.status_deck_count ?? "-";
  }
  if (highSocietyTimerLabel) {
    highSocietyTimerLabel.textContent = view.end_marker_revealed_count ?? 0;
  }
  if (highSocietyCurrentCard) {
    highSocietyCurrentCard.innerHTML = "";
    highSocietyCurrentCard.appendChild(renderHighSocietyStatusCard(view, view.current_status));
  }
  if (highSocietyTurnLabel) {
    highSocietyTurnLabel.textContent = highSocietyPlayerName(view, view.current_turn);
  }
  if (highSocietyStartLabel) {
    highSocietyStartLabel.textContent = highSocietyPlayerName(view, view.start_player);
  }
  if (highSocietyHighBidLabel) {
    highSocietyHighBidLabel.textContent = formatHighSocietyMoney(view.current_high_bid || 0);
  }
  if (highSocietyHighBidderLabel) {
    highSocietyHighBidderLabel.textContent = highSocietyPlayerName(view, view.current_high_bidder);
  }
  renderHighSocietyNotice(view);
  renderHighSocietyHand(view);
  renderHighSocietyFauxPas(view);
  renderHighSocietyPlayers(view);
  logGameEvents(data);
  updateHighSocietyButtons();
}

if (highSocietyBidBtn) {
  highSocietyBidBtn.addEventListener("click", () => {
    if (!highSocietySelectedMoney.length) {
      return;
    }
    sendAction({ type: "bid", money_values: highSocietySelectedMoney.slice() });
    highSocietySelectedMoney = [];
  });
}

if (highSocietyPassBtn) {
  highSocietyPassBtn.addEventListener("click", () => {
    highSocietySelectedMoney = [];
    sendAction({ type: "pass" });
  });
}

if (highSocietyNextBtn) {
  highSocietyNextBtn.addEventListener("click", () => {
    highSocietySelectedMoney = [];
    sendAction({ type: "next_round" });
  });
}

if (highSocietyHelpBtn) {
  highSocietyHelpBtn.addEventListener("click", () => {
    if (highSocietyHelpContent) {
      highSocietyHelpContent.innerHTML = HIGH_SOCIETY_HELP_HTML;
    }
    openHighSocietyModal(highSocietyHelpModal);
  });
}

if (highSocietyHelpCloseBtn) {
  highSocietyHelpCloseBtn.addEventListener("click", () => closeHighSocietyModal(highSocietyHelpModal));
}

if (highSocietyExplainBtn) {
  highSocietyExplainBtn.addEventListener("click", () => {
    if (highSocietyExplainMode) {
      exitHighSocietyExplainMode();
    } else {
      enterHighSocietyExplainMode();
    }
  });
}

if (highSocietyExplainCloseBtn) {
  highSocietyExplainCloseBtn.addEventListener("click", () => closeHighSocietyModal(highSocietyExplainModal));
}

document.addEventListener(
  "pointerdown",
  (event) => {
    if (!highSocietyExplainMode) {
      return;
    }
    const button = findHighSocietyExplainButtonAtPoint(event.clientX, event.clientY);
    if (!button) {
      return;
    }
    const explanation = highSocietyExplanationForButton(button);
    if (!explanation) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    showHighSocietyExplanation(explanation);
    exitHighSocietyExplainMode();
  },
  true
);

document.addEventListener(
  "click",
  (event) => {
    if (!highSocietyExplainMode) {
      return;
    }
    const button = event.target.closest("button");
    if (!button || button === highSocietyHelpBtn || button === highSocietyExplainBtn || button === highSocietyHelpCloseBtn || button === highSocietyExplainCloseBtn) {
      return;
    }
    if (!button.closest("#highSocietyPanel")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const explanation = highSocietyExplanationForButton(button);
    if (explanation) {
      showHighSocietyExplanation(explanation);
      exitHighSocietyExplainMode();
    }
  },
  true
);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    exitHighSocietyExplainMode();
    closeHighSocietyModal(highSocietyHelpModal);
    closeHighSocietyModal(highSocietyExplainModal);
  }
});
