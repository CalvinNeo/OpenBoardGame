let currentTexasHoldemView = null;

const texasPhaseLabel = document.getElementById("texasPhase");
const texasHandLabel = document.getElementById("texasHand");
const texasTurnLabel = document.getElementById("texasTurn");
const texasPotLabel = document.getElementById("texasPot");
const texasCurrentBetLabel = document.getElementById("texasCurrentBet");
const texasToCallLabel = document.getElementById("texasToCall");
const texasBlindsLabel = document.getElementById("texasBlinds");
const texasMinBetLabel = document.getElementById("texasMinBet");
const texasMinRaiseToLabel = document.getElementById("texasMinRaiseTo");
const texasMaxRaiseToLabel = document.getElementById("texasMaxRaiseTo");
const texasCommunityCards = document.getElementById("texasCommunityCards");
const texasYourHand = document.getElementById("texasYourHand");
const texasFoldBtn = document.getElementById("texasFoldBtn");
const texasCheckBtn = document.getElementById("texasCheckBtn");
const texasCallBtn = document.getElementById("texasCallBtn");
const texasAllInBtn = document.getElementById("texasAllInBtn");
const texasBetInput = document.getElementById("texasBetInput");
const texasBetBtn = document.getElementById("texasBetBtn");
const texasRaiseBtn = document.getElementById("texasRaiseBtn");
const texasNextHandBtn = document.getElementById("texasNextHandBtn");
const texasRebuyBtn = document.getElementById("texasRebuyBtn");
const texasSummary = document.getElementById("texasSummary");
const texasSummaryBody = document.getElementById("texasSummaryBody");
const texasSummaryList = document.getElementById("texasSummaryList");
const texasPlayers = document.getElementById("texasPlayers");

function getTexasBetAmount() {
  if (!texasBetInput) {
    return null;
  }
  const amount = Number.parseInt(texasBetInput.value, 10);
  if (!Number.isInteger(amount) || amount <= 0) {
    return null;
  }
  return amount;
}

function isTexasHoldemActionAvailable(actionType) {
  if (!currentTexasHoldemView || !Array.isArray(currentTexasHoldemView.legal_actions)) {
    return false;
  }
  if (!currentTexasHoldemView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "bet" || actionType === "raise") {
    const amount = getTexasBetAmount();
    if (!amount) {
      return false;
    }
    const info = currentTexasHoldemView.action_info || {};
    const maxRaiseTo = Number.isInteger(info.max_raise_to) ? info.max_raise_to : null;
    const minBet = Number.isInteger(info.min_bet) ? info.min_bet : null;
    const minRaiseTo = Number.isInteger(info.min_raise_to) ? info.min_raise_to : null;
    if (maxRaiseTo !== null && amount > maxRaiseTo) {
      return false;
    }
    if (actionType === "bet" && minBet !== null && amount < minBet && amount !== maxRaiseTo) {
      return false;
    }
    if (actionType === "raise" && minRaiseTo !== null && amount < minRaiseTo && amount !== maxRaiseTo) {
      return false;
    }
  }
  return true;
}

function updateTexasHoldemActionButtons() {
  const actionButtons = {
    fold: texasFoldBtn,
    check: texasCheckBtn,
    call: texasCallBtn,
    bet: texasBetBtn,
    raise: texasRaiseBtn,
    all_in: texasAllInBtn,
    next_hand: texasNextHandBtn,
    rebuy: texasRebuyBtn,
  };
  if (currentGameType !== "texas_holdem") {
    Object.values(actionButtons).forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(actionButtons).forEach(([actionType, button]) => {
    if (!button) {
      return;
    }
    const allowed = isTexasHoldemActionAvailable(actionType);
    button.disabled = !allowed;
    button.classList.toggle("action-allowed", allowed);
  });
  if (texasCallBtn && currentTexasHoldemView) {
    const toCall = currentTexasHoldemView.action_info?.to_call;
    texasCallBtn.textContent = Number.isInteger(toCall) && toCall > 0 ? `Call ${toCall}` : "Call";
  }
}

function clearTexasHoldemState() {
  currentTexasHoldemView = null;
  if (texasPhaseLabel) {
    texasPhaseLabel.textContent = "-";
  }
  if (texasHandLabel) {
    texasHandLabel.textContent = "-";
  }
  if (texasTurnLabel) {
    texasTurnLabel.textContent = "-";
  }
  if (texasPotLabel) {
    texasPotLabel.textContent = "-";
  }
  if (texasCurrentBetLabel) {
    texasCurrentBetLabel.textContent = "-";
  }
  if (texasToCallLabel) {
    texasToCallLabel.textContent = "-";
  }
  if (texasBlindsLabel) {
    texasBlindsLabel.textContent = "-";
  }
  if (texasMinBetLabel) {
    texasMinBetLabel.textContent = "-";
  }
  if (texasMinRaiseToLabel) {
    texasMinRaiseToLabel.textContent = "-";
  }
  if (texasMaxRaiseToLabel) {
    texasMaxRaiseToLabel.textContent = "-";
  }
  if (texasCommunityCards) {
    texasCommunityCards.innerHTML = "";
  }
  if (texasYourHand) {
    texasYourHand.innerHTML = "";
  }
  if (texasPlayers) {
    texasPlayers.innerHTML = "";
  }
  if (texasBetInput) {
    texasBetInput.value = "";
  }
  if (texasCallBtn) {
    texasCallBtn.textContent = "Call";
  }
  if (texasSummary) {
    texasSummary.classList.add("hidden");
    texasSummary.setAttribute("aria-hidden", "true");
  }
  if (texasSummaryBody) {
    texasSummaryBody.textContent = "-";
  }
  if (texasSummaryList) {
    texasSummaryList.innerHTML = "";
  }
  updateTexasHoldemActionButtons();
}

function renderTexasCards(container, cards) {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  if (!Array.isArray(cards) || !cards.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "-";
    container.appendChild(empty);
    return;
  }
  cards.forEach((card) => {
    const el = document.createElement("div");
    el.className = "texas-card";
    if (card && card.hidden) {
      el.classList.add("hidden");
    } else if (card && card.color) {
      el.classList.add(card.color);
    }
    el.textContent = card && card.label ? card.label : "-";
    container.appendChild(el);
  });
}

function renderTexasPlayers(view) {
  if (!texasPlayers) {
    return;
  }
  texasPlayers.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  if (!players.length) {
    texasPlayers.textContent = "-";
    return;
  }
  players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "texas-player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("active");
    }

    const header = document.createElement("div");
    header.className = "texas-player-header";
    const name = document.createElement("div");
    name.className = "texas-player-name";
    name.textContent = player.name || player.player_id;
    header.appendChild(name);

    const tags = document.createElement("div");
    tags.className = "texas-player-tags";
    const addTag = (label, className) => {
      const tag = document.createElement("span");
      tag.className = `texas-tag ${className || ""}`.trim();
      tag.textContent = label;
      tags.appendChild(tag);
    };
    if (player.is_dealer) {
      addTag("D", "role");
    }
    if (player.is_sb) {
      addTag("SB", "role");
    }
    if (player.is_bb) {
      addTag("BB", "role");
    }
    if (player.player_id === view.you) {
      addTag("You", "role");
    }
    if (player.status === "all_in") {
      addTag("All-in", "all-in");
    }
    if (player.status === "folded") {
      addTag("Folded", "folded");
    }
    if (player.status === "out") {
      addTag("Out", "folded");
    }
    header.appendChild(tags);
    card.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "texas-player-meta";
    const chipsLine = document.createElement("div");
    chipsLine.textContent = `Chips: ${player.chips ?? 0}`;
    const betLine = document.createElement("div");
    betLine.textContent = `Bet: ${player.current_bet ?? 0}`;
    meta.appendChild(chipsLine);
    meta.appendChild(betLine);
    card.appendChild(meta);

    const holeRow = document.createElement("div");
    holeRow.className = "texas-cards";
    renderTexasCards(holeRow, player.hole_cards);
    card.appendChild(holeRow);

    texasPlayers.appendChild(card);
  });
}

function renderTexasSummary(view) {
  if (!texasSummary || !texasSummaryBody || !texasSummaryList) {
    return;
  }
  const summary = view.last_hand_summary;
  if (!summary) {
    texasSummary.classList.add("hidden");
    texasSummary.setAttribute("aria-hidden", "true");
    texasSummaryBody.textContent = "-";
    texasSummaryList.innerHTML = "";
    return;
  }
  texasSummary.classList.remove("hidden");
  texasSummary.setAttribute("aria-hidden", "false");
  const potTotal = Number.isInteger(summary.pot_total) ? summary.pot_total : 0;
  const reason = summary.reason === "fold" ? "Won by fold" : "Showdown";
  texasSummaryBody.textContent = `${reason} · Pot ${potTotal}`;
  texasSummaryList.innerHTML = "";

  const payouts = summary.payouts || {};
  const hands = summary.hands || {};
  const payoutPlayers = Array.isArray(view.players) ? view.players.filter((p) => (payouts[p.player_id] || 0) > 0) : [];
  if (!payoutPlayers.length) {
    const line = document.createElement("div");
    line.textContent = "No winners recorded.";
    texasSummaryList.appendChild(line);
    return;
  }
  payoutPlayers.forEach((player) => {
    const line = document.createElement("div");
    const pid = player.player_id;
    const payout = Number.isInteger(payouts[pid]) ? payouts[pid] : 0;
    const handName = hands[pid] && hands[pid].hand_name ? hands[pid].hand_name : "";
    const name = player.name || pid;
    line.textContent = `${name}: +${payout}${handName ? ` · ${handName}` : ""}`;
    texasSummaryList.appendChild(line);
  });
}

function renderTexasHoldemGameState(data) {
  const view = data.view;
  currentTexasHoldemView = view;
  if (currentGameType !== "texas_holdem") {
    currentGameType = "texas_holdem";
    setGamePanelVisibility("texas_holdem");
  }

  if (texasPhaseLabel) {
    texasPhaseLabel.textContent = view.phase || "-";
  }
  if (texasHandLabel) {
    texasHandLabel.textContent = view.hand_number ?? "-";
  }
  if (texasTurnLabel) {
    const currentPlayer = Array.isArray(view.players)
      ? view.players.find((p) => p.player_id === view.current_turn)
      : null;
    texasTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (texasPotLabel) {
    texasPotLabel.textContent = Number.isInteger(view.pot_total) ? view.pot_total : "-";
  }
  if (texasCurrentBetLabel) {
    texasCurrentBetLabel.textContent = Number.isInteger(view.current_bet) ? view.current_bet : "-";
  }
  if (texasToCallLabel) {
    const toCall = view.action_info ? view.action_info.to_call : null;
    texasToCallLabel.textContent = Number.isInteger(toCall) ? toCall : "-";
  }
  if (texasBlindsLabel && view.config) {
    const sb = view.config.small_blind ?? "-";
    const bb = view.config.big_blind ?? "-";
    texasBlindsLabel.textContent = `SB ${sb} / BB ${bb}`;
  }
  if (texasMinBetLabel) {
    const minBet = view.action_info ? view.action_info.min_bet : null;
    texasMinBetLabel.textContent = Number.isInteger(minBet) ? minBet : "-";
  }
  if (texasMinRaiseToLabel) {
    const minRaiseTo = view.action_info ? view.action_info.min_raise_to : null;
    texasMinRaiseToLabel.textContent = Number.isInteger(minRaiseTo) ? minRaiseTo : "-";
  }
  if (texasMaxRaiseToLabel) {
    const maxRaiseTo = view.action_info ? view.action_info.max_raise_to : null;
    texasMaxRaiseToLabel.textContent = Number.isInteger(maxRaiseTo) ? maxRaiseTo : "-";
  }

  renderTexasCards(texasCommunityCards, view.community_cards);
  const youEntry = Array.isArray(view.players) ? view.players.find((p) => p.player_id === view.you) : null;
  renderTexasCards(texasYourHand, youEntry ? youEntry.hole_cards : []);
  renderTexasPlayers(view);
  renderTexasSummary(view);

  if (texasBetInput && view.action_info) {
    const minAmount = Number.isInteger(view.action_info.min_raise_to)
      ? view.action_info.min_raise_to
      : Number.isInteger(view.action_info.min_bet)
        ? view.action_info.min_bet
        : 1;
    const maxAmount = Number.isInteger(view.action_info.max_raise_to) ? view.action_info.max_raise_to : null;
    texasBetInput.min = String(minAmount);
    texasBetInput.placeholder = `Min ${minAmount}`;
    if (maxAmount !== null) {
      texasBetInput.max = String(maxAmount);
    } else {
      texasBetInput.removeAttribute("max");
    }
  }

  logGameEvents(data);
  updateTexasHoldemActionButtons();
}

if (texasBetInput) {
  texasBetInput.addEventListener("input", () => {
    updateTexasHoldemActionButtons();
  });
}

if (texasFoldBtn) {
  texasFoldBtn.addEventListener("click", () => {
    sendAction({ type: "fold" });
  });
}

if (texasCheckBtn) {
  texasCheckBtn.addEventListener("click", () => {
    sendAction({ type: "check" });
  });
}

if (texasCallBtn) {
  texasCallBtn.addEventListener("click", () => {
    sendAction({ type: "call" });
  });
}

if (texasAllInBtn) {
  texasAllInBtn.addEventListener("click", () => {
    sendAction({ type: "all_in" });
  });
}

if (texasBetBtn) {
  texasBetBtn.addEventListener("click", () => {
    const amount = getTexasBetAmount();
    if (!amount) {
      log("Enter a bet amount");
      return;
    }
    sendAction({ type: "bet", amount });
  });
}

if (texasRaiseBtn) {
  texasRaiseBtn.addEventListener("click", () => {
    const amount = getTexasBetAmount();
    if (!amount) {
      log("Enter a raise amount");
      return;
    }
    sendAction({ type: "raise", amount });
  });
}

if (texasNextHandBtn) {
  texasNextHandBtn.addEventListener("click", () => {
    sendAction({ type: "next_hand" });
  });
}

if (texasRebuyBtn) {
  texasRebuyBtn.addEventListener("click", () => {
    sendAction({ type: "rebuy" });
  });
}
