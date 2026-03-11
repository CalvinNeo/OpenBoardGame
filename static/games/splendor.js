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

let currentSplendorView = null;

let splendorSelectedMarket = null;
let splendorSelectedReserved = null;
let splendorSelectedNoble = null;
let splendorTokenSelection = {};
let splendorDiscardSelection = {};
let splendorNobleCatalog = {};

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
