const pokemonSplendorHeaderActions = document.getElementById("pokemonSplendorHeaderActions");
const pokemonSplendorHelpBtn = document.getElementById("pokemonSplendorHelpBtn");
const pokemonSplendorExplainBtn = document.getElementById("pokemonSplendorExplainBtn");
const pokemonSplendorHelpModal = document.getElementById("pokemonSplendorHelpModal");
const pokemonSplendorHelpModalCloseBtn = document.getElementById("pokemonSplendorHelpModalCloseBtn");
const pokemonSplendorExplainModal = document.getElementById("pokemonSplendorExplainModal");
const pokemonSplendorExplainModalCloseBtn = document.getElementById("pokemonSplendorExplainModalCloseBtn");
const pokemonSplendorHelpContent = document.getElementById("pokemonSplendorHelpContent");
const pokemonSplendorExplainContent = document.getElementById("pokemonSplendorExplainContent");

const pokemonSplendorPanel = document.getElementById("pokemonSplendorPanel");
const pokemonSplendorPhaseLabel = document.getElementById("pokemonSplendorPhase");
const pokemonSplendorTurnLabel = document.getElementById("pokemonSplendorTurn");
const pokemonSplendorFinalRoundLabel = document.getElementById("pokemonSplendorFinalRound");
const pokemonSplendorStartLabel = document.getElementById("pokemonSplendorStart");
const pokemonSplendorWinnerLabel = document.getElementById("pokemonSplendorWinner");
const pokemonSplendorSupply = document.getElementById("pokemonSplendorSupply");
const pokemonSplendorMarketLegendary = document.getElementById("pokemonSplendorMarketLegendary");
const pokemonSplendorMarketRare = document.getElementById("pokemonSplendorMarketRare");
const pokemonSplendorMarketLv3 = document.getElementById("pokemonSplendorMarketLv3");
const pokemonSplendorMarketLv2 = document.getElementById("pokemonSplendorMarketLv2");
const pokemonSplendorMarketLv1 = document.getElementById("pokemonSplendorMarketLv1");
const pokemonSplendorSelectedMarketLabel = document.getElementById("pokemonSplendorSelectedMarket");
const pokemonSplendorSelectedReservedLabel = document.getElementById("pokemonSplendorSelectedReserved");
const pokemonSplendorSelectedBaseLabel = document.getElementById("pokemonSplendorSelectedBase");
const pokemonSplendorTokenSelectionEl = document.getElementById("pokemonSplendorTokenSelection");
const pokemonSplendorDiscardSelectionRow = document.getElementById("pokemonSplendorDiscardSelectionRow");
const pokemonSplendorDiscardSelectionEl = document.getElementById("pokemonSplendorDiscardSelection");
const pokemonSplendorDiscardHint = document.getElementById("pokemonSplendorDiscardHint");
const pokemonSplendorTakeThreeBtn = document.getElementById("pokemonSplendorTakeThreeBtn");
const pokemonSplendorTakeTwoBtn = document.getElementById("pokemonSplendorTakeTwoBtn");
const pokemonSplendorReserveMarketBtn = document.getElementById("pokemonSplendorReserveMarketBtn");
const pokemonSplendorReserveDeckBtn = document.getElementById("pokemonSplendorReserveDeckBtn");
const pokemonSplendorBuyMarketBtn = document.getElementById("pokemonSplendorBuyMarketBtn");
const pokemonSplendorBuyReservedBtn = document.getElementById("pokemonSplendorBuyReservedBtn");
const pokemonSplendorEvolveBtn = document.getElementById("pokemonSplendorEvolveBtn");
const pokemonSplendorSkipEvolveBtn = document.getElementById("pokemonSplendorSkipEvolveBtn");
const pokemonSplendorDiscardBtn = document.getElementById("pokemonSplendorDiscardBtn");
const pokemonSplendorReserved = document.getElementById("pokemonSplendorReserved");
const pokemonSplendorCaptured = document.getElementById("pokemonSplendorCaptured");
const pokemonSplendorPlayers = document.getElementById("pokemonSplendorPlayers");

let currentPokemonSplendorView = null;
let pokemonSplendorSelectedMarket = null;
let pokemonSplendorSelectedReserved = null;
let pokemonSplendorSelectedBase = null;
let pokemonSplendorTokenSelection = {};
let pokemonSplendorDiscardSelection = {};
let pokemonSplendorReserveMenu = null;

const pokemonSplendorBaseColors = ["red", "blue", "yellow", "green", "pink"];
const pokemonSplendorColors = [...pokemonSplendorBaseColors, "purple"];
const pokemonSplendorColorLabels = {
  red: "Red",
  blue: "Blue",
  yellow: "Yellow",
  green: "Green",
  pink: "Pink",
  purple: "Master",
};
const pokemonSplendorColorEmoji = {
  red: "🔴",
  blue: "🔵",
  yellow: "🟡",
  green: "🟢",
  pink: "🩷",
  purple: "🟣",
};

const POKEMON_SPLENDOR_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Reach 18+ points to trigger the final round. Highest score wins. Ties go to most evolved Pokemon. If still tied, share victory.</p>

  <h3>Turn Flow</h3>
  <ol>
    <li>Main action (choose 1)</li>
    <li>Evolution (optional, at most 1)</li>
    <li>Token limit check (max 10)</li>
  </ol>

  <h3>Main Actions</h3>
  <ul>
    <li><strong>Take 3 Different</strong>: take 1 each of up to 3 different regular balls. If only 1-2 colors remain, take those.</li>
    <li><strong>Take 2 Same</strong>: take 2 of the same color (only if 4+ remain in supply).</li>
    <li><strong>Reserve</strong>: reserve 1 LV1/LV2/LV3 card (face-up or blind). Gain 1 Master Ball if available.</li>
    <li><strong>Catch</strong>: catch 1 card from the market or your reserved cards.</li>
  </ul>

  <h3>Evolution</h3>
  <ul>
    <li>Base Pokemon must be in your captured area.</li>
    <li>The evolution target must be in the market or your reserved cards.</li>
    <li>Only permanent bonuses (no tokens) count for requirements.</li>
    <li>The base card's bonus counts before it evolves.</li>
  </ul>

  <h3>Other Rules</h3>
  <ul>
    <li>Rare/Legendary cards cannot be reserved.</li>
    <li>Master Ball is a wildcard. Some Legendary costs require Master Balls.</li>
    <li>Token hand limit: 10 total.</li>
  </ul>
`;

const POKEMON_SPLENDOR_BUTTON_EXPLANATIONS = {
  pokemonSplendorTakeThreeBtn: {
    name: "Take 3 Different",
    description: "Take 1 each of different colors (or all remaining colors if fewer than 3 exist).",
  },
  pokemonSplendorTakeTwoBtn: {
    name: "Take 2 Same",
    description: "Take 2 of one color (only if 4+ remain in supply).",
  },
  pokemonSplendorReserveMarketBtn: {
    name: "Reserve Market",
    description: "Reserve the selected LV1/LV2/LV3 market card. Gain 1 Master Ball if available.",
  },
  pokemonSplendorReserveDeckBtn: {
    name: "Reserve Deck",
    description: "Reserve a blind card from the deck. Choose LV1/LV2/LV3 after clicking.",
  },
  pokemonSplendorBuyMarketBtn: {
    name: "Catch Market",
    description: "Catch the selected market card by paying its cost.",
  },
  pokemonSplendorBuyReservedBtn: {
    name: "Catch Reserved",
    description: "Catch the selected reserved card by paying its cost.",
  },
  pokemonSplendorEvolveBtn: {
    name: "Evolve",
    description: "Evolve the selected base Pokemon into the selected target (market or reserved).",
  },
  pokemonSplendorSkipEvolveBtn: {
    name: "Skip Evolution",
    description: "End the evolution step without evolving.",
  },
  pokemonSplendorDiscardBtn: {
    name: "Discard Tokens",
    description: "Discard tokens until you have 10 or fewer.",
  },
  pokemonSplendorMarketCard: {
    name: "Market Card",
    description: "Select a market card to catch or reserve. It can also be a target for evolution.",
  },
  pokemonSplendorReservedCard: {
    name: "Reserved Card",
    description: "Select a reserved card to catch or use as an evolution target.",
  },
  pokemonSplendorCapturedCard: {
    name: "Captured Pokemon",
    description: "Select a base Pokemon to evolve if its target is available and requirements are met.",
  },
  pokemonSplendorTokenPicker: {
    name: "Token Selection",
    description: "Tap to adjust tokens you want to take or discard.",
  },
};

function resetPokemonSplendorTokenSelection() {
  pokemonSplendorTokenSelection = {};
  pokemonSplendorColors.forEach((color) => {
    pokemonSplendorTokenSelection[color] = 0;
  });
}

function resetPokemonSplendorDiscardSelection() {
  pokemonSplendorDiscardSelection = {};
  pokemonSplendorColors.forEach((color) => {
    pokemonSplendorDiscardSelection[color] = 0;
  });
}

function clearPokemonSplendorState() {
  currentPokemonSplendorView = null;
  pokemonSplendorSelectedMarket = null;
  pokemonSplendorSelectedReserved = null;
  pokemonSplendorSelectedBase = null;
  resetPokemonSplendorTokenSelection();
  resetPokemonSplendorDiscardSelection();
  closePokemonSplendorReserveMenu();
  if (pokemonSplendorDiscardSelectionRow) {
    pokemonSplendorDiscardSelectionRow.classList.add("hidden");
  }
  if (pokemonSplendorDiscardHint) {
    pokemonSplendorDiscardHint.textContent = "";
    pokemonSplendorDiscardHint.classList.add("hidden");
  }
  if (pokemonSplendorPhaseLabel) {
    pokemonSplendorPhaseLabel.textContent = "-";
  }
  if (pokemonSplendorTurnLabel) {
    pokemonSplendorTurnLabel.textContent = "-";
  }
  if (pokemonSplendorFinalRoundLabel) {
    pokemonSplendorFinalRoundLabel.textContent = "-";
  }
  if (pokemonSplendorStartLabel) {
    pokemonSplendorStartLabel.textContent = "-";
  }
  if (pokemonSplendorWinnerLabel) {
    pokemonSplendorWinnerLabel.textContent = "-";
  }
  if (pokemonSplendorSupply) {
    pokemonSplendorSupply.innerHTML = "";
  }
  if (pokemonSplendorMarketLegendary) {
    pokemonSplendorMarketLegendary.innerHTML = "";
  }
  if (pokemonSplendorMarketRare) {
    pokemonSplendorMarketRare.innerHTML = "";
  }
  if (pokemonSplendorMarketLv3) {
    pokemonSplendorMarketLv3.innerHTML = "";
  }
  if (pokemonSplendorMarketLv2) {
    pokemonSplendorMarketLv2.innerHTML = "";
  }
  if (pokemonSplendorMarketLv1) {
    pokemonSplendorMarketLv1.innerHTML = "";
  }
  if (pokemonSplendorReserved) {
    pokemonSplendorReserved.innerHTML = "";
  }
  if (pokemonSplendorCaptured) {
    pokemonSplendorCaptured.innerHTML = "";
  }
  if (pokemonSplendorPlayers) {
    pokemonSplendorPlayers.innerHTML = "";
  }
  updatePokemonSplendorSelectionLabels();
  updatePokemonSplendorActionButtons();
}

function updatePokemonSplendorSelectionLabels() {
  if (pokemonSplendorSelectedMarketLabel) {
    if (pokemonSplendorSelectedMarket) {
      pokemonSplendorSelectedMarketLabel.textContent = `${pokemonSplendorSelectedMarket.tier}:${pokemonSplendorSelectedMarket.index + 1}`;
    } else {
      pokemonSplendorSelectedMarketLabel.textContent = "-";
    }
  }
  if (pokemonSplendorSelectedReservedLabel) {
    pokemonSplendorSelectedReservedLabel.textContent =
      pokemonSplendorSelectedReserved !== null ? `${pokemonSplendorSelectedReserved + 1}` : "-";
  }
  if (pokemonSplendorSelectedBaseLabel) {
    const baseCard = findPokemonSplendorCapturedById(currentPokemonSplendorView, pokemonSplendorSelectedBase);
    pokemonSplendorSelectedBaseLabel.textContent = baseCard ? baseCard.name_en || baseCard.name || baseCard.id : "-";
  }
}

function pokemonSplendorTokenSelectionTotal() {
  return pokemonSplendorBaseColors.reduce((sum, color) => sum + (pokemonSplendorTokenSelection[color] || 0), 0);
}

function pokemonSplendorDiscardSelectionTotal() {
  return pokemonSplendorColors.reduce((sum, color) => sum + (pokemonSplendorDiscardSelection[color] || 0), 0);
}

function pokemonSplendorTotalTokens(tokens) {
  return pokemonSplendorColors.reduce((sum, color) => sum + ((tokens && tokens[color]) || 0), 0);
}

function pokemonSplendorTokenGainForAction(view, actionType) {
  const gain = {};
  pokemonSplendorColors.forEach((color) => {
    gain[color] = 0;
  });
  if (!view) {
    return null;
  }
  if (actionType === "take_tokens") {
    const selected = pokemonSplendorBaseColors.filter((color) => pokemonSplendorTokenSelection[color] === 1);
    const hasOther = pokemonSplendorBaseColors.some((color) => {
      const val = pokemonSplendorTokenSelection[color] || 0;
      return val !== 0 && val !== 1;
    });
    const hasMaster = (pokemonSplendorTokenSelection.purple || 0) > 0;
    const available = pokemonSplendorBaseColors.filter((color) => (view.tokens_supply || {})[color] > 0);
    const requiredCount = Math.min(3, available.length);
    if (requiredCount === 0) {
      return null;
    }
    if (selected.length !== requiredCount || pokemonSplendorTokenSelectionTotal() !== requiredCount || hasMaster || hasOther) {
      return null;
    }
    const availableSet = new Set(available);
    if (!selected.every((color) => availableSet.has(color))) {
      return null;
    }
    if (available.length < 3) {
      if (selected.length !== available.length) {
        return null;
      }
      if (!available.every((color) => selected.includes(color))) {
        return null;
      }
    }
    selected.forEach((color) => {
      gain[color] = 1;
    });
    return gain;
  }
  if (actionType === "take_tokens_same") {
    const selected = pokemonSplendorBaseColors.filter((color) => pokemonSplendorTokenSelection[color] === 2);
    const hasOther = pokemonSplendorBaseColors.some((color) => {
      const val = pokemonSplendorTokenSelection[color] || 0;
      return val !== 0 && val !== 2;
    });
    const hasMaster = (pokemonSplendorTokenSelection.purple || 0) > 0;
    if (selected.length !== 1 || pokemonSplendorTokenSelectionTotal() !== 2 || hasMaster || hasOther) {
      return null;
    }
    if ((view.tokens_supply || {})[selected[0]] < 4) {
      return null;
    }
    gain[selected[0]] = 2;
    return gain;
  }
  if (actionType === "reserve_market" || actionType === "reserve_deck") {
    if ((view.tokens_supply || {}).purple > 0) {
      gain.purple = 1;
    }
    return gain;
  }
  return null;
}

function pokemonSplendorDiscardRequirement(view, gain) {
  if (!view || !gain) {
    return null;
  }
  const player = findPokemonSplendorPlayer(view, view.you);
  if (!player) {
    return null;
  }
  const total = pokemonSplendorTotalTokens(player.tokens) + pokemonSplendorTotalTokens(gain);
  const excess = total - 10;
  if (excess <= 0) {
    return { excess: 0, total, gain };
  }
  return { excess, total, gain };
}

function pokemonSplendorIsDiscardSelectionValid(requirement) {
  if (!requirement || requirement.excess <= 0) {
    return true;
  }
  return pokemonSplendorDiscardSelectionTotal() === requirement.excess;
}

function pokemonSplendorDiscardSelectionPayload(requirement) {
  if (!requirement || requirement.excess <= 0) {
    return null;
  }
  const payload = {};
  pokemonSplendorColors.forEach((color) => {
    const value = pokemonSplendorDiscardSelection[color] || 0;
    if (value > 0) {
      payload[color] = value;
    }
  });
  return Object.keys(payload).length ? payload : null;
}

function pokemonSplendorDiscardPayloadForAction(view, actionType) {
  const gain = pokemonSplendorTokenGainForAction(view, actionType);
  const requirement = pokemonSplendorDiscardRequirement(view, gain);
  if (!pokemonSplendorIsDiscardSelectionValid(requirement)) {
    return null;
  }
  return pokemonSplendorDiscardSelectionPayload(requirement);
}

function getPokemonSplendorPendingDiscardRequirement(view) {
  if (!view) {
    return null;
  }
  if (view.phase === "discard_tokens") {
    const player = findPokemonSplendorPlayer(view, view.you);
    if (!player) {
      return null;
    }
    const total = pokemonSplendorTotalTokens(player.tokens);
    const excess = total - 10;
    return { excess: Math.max(0, excess), total, gain: {} };
  }
  if (pokemonSplendorTokenSelectionTotal() > 0) {
    if (view.legal_actions && view.legal_actions.includes("take_tokens")) {
      const gain = pokemonSplendorTokenGainForAction(view, "take_tokens");
      if (gain) {
        return pokemonSplendorDiscardRequirement(view, gain);
      }
    }
    if (view.legal_actions && view.legal_actions.includes("take_tokens_same")) {
      const gain = pokemonSplendorTokenGainForAction(view, "take_tokens_same");
      if (gain) {
        return pokemonSplendorDiscardRequirement(view, gain);
      }
    }
  }
  if (pokemonSplendorSelectedMarket && view.legal_actions && view.legal_actions.includes("reserve_market")) {
    const gain = pokemonSplendorTokenGainForAction(view, "reserve_market");
    return pokemonSplendorDiscardRequirement(view, gain);
  }
  if (view.legal_actions && view.legal_actions.includes("reserve_deck")) {
    const gain = pokemonSplendorTokenGainForAction(view, "reserve_deck");
    return pokemonSplendorDiscardRequirement(view, gain);
  }
  return null;
}

function updatePokemonSplendorDiscardHint(view) {
  if (!pokemonSplendorDiscardHint) {
    return;
  }
  const requirement = getPokemonSplendorPendingDiscardRequirement(view);
  const excess = requirement ? requirement.excess : 0;
  if (excess > 0) {
    pokemonSplendorDiscardHint.textContent = `Discard ${excess} token${excess === 1 ? "" : "s"} to stay at 10.`;
    pokemonSplendorDiscardHint.classList.remove("hidden");
    if (pokemonSplendorDiscardSelectionRow) {
      pokemonSplendorDiscardSelectionRow.classList.remove("hidden");
    }
  } else {
    pokemonSplendorDiscardHint.textContent = "";
    pokemonSplendorDiscardHint.classList.add("hidden");
    if (pokemonSplendorDiscardSelectionRow) {
      pokemonSplendorDiscardSelectionRow.classList.add("hidden");
    }
    resetPokemonSplendorDiscardSelection();
    renderPokemonSplendorDiscardSelection();
  }
}

function clearPokemonSplendorSelection() {
  pokemonSplendorSelectedMarket = null;
  pokemonSplendorSelectedReserved = null;
  pokemonSplendorSelectedBase = null;
  resetPokemonSplendorTokenSelection();
  resetPokemonSplendorDiscardSelection();
  updatePokemonSplendorSelectionLabels();
  renderPokemonSplendorTokenSelection();
  renderPokemonSplendorDiscardSelection();
  updatePokemonSplendorDiscardHint(currentPokemonSplendorView);
  updatePokemonSplendorActionButtons();
  closePokemonSplendorReserveMenu();
}

function ensurePokemonSplendorReserveMenu() {
  if (pokemonSplendorReserveMenu) {
    return pokemonSplendorReserveMenu;
  }
  const menu = document.createElement("div");
  menu.className = "pokemon-reserve-menu hidden";
  const title = document.createElement("div");
  title.className = "pokemon-reserve-title";
  title.textContent = "Reserve Deck";
  menu.appendChild(title);
  ["lv1", "lv2", "lv3"].forEach((tier) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pokemon-reserve-option";
    btn.textContent = tier.toUpperCase();
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      sendPokemonSplendorReserveDeck(tier);
      closePokemonSplendorReserveMenu();
    });
    menu.appendChild(btn);
  });
  document.body.appendChild(menu);
  pokemonSplendorReserveMenu = menu;
  return menu;
}

function showPokemonSplendorReserveMenu(anchor) {
  const menu = ensurePokemonSplendorReserveMenu();
  if (!anchor) {
    return;
  }
  menu.classList.remove("hidden");
  menu.style.position = "fixed";
  const rect = anchor.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const padding = 8;
  let left = rect.left;
  if (left + menuRect.width + padding > window.innerWidth) {
    left = Math.max(padding, window.innerWidth - menuRect.width - padding);
  }
  let top = rect.bottom + 6;
  if (top + menuRect.height + padding > window.innerHeight) {
    top = Math.max(padding, rect.top - menuRect.height - 6);
  }
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function closePokemonSplendorReserveMenu() {
  if (!pokemonSplendorReserveMenu) {
    return;
  }
  pokemonSplendorReserveMenu.classList.add("hidden");
}

function sendPokemonSplendorReserveDeck(tier) {
  const view = currentPokemonSplendorView;
  if (!view) {
    return;
  }
  const legal = view.legal_actions || [];
  if (!legal.includes("reserve_deck")) {
    log("Reserve deck is not available");
    return;
  }
  const discard = pokemonSplendorDiscardPayloadForAction(view, "reserve_deck");
  if (discard === null && (getPokemonSplendorPendingDiscardRequirement(view) || {}).excess > 0) {
    log("Select discard tokens to stay at 10");
    return;
  }
  const action = { type: "reserve_deck", tier };
  if (discard) {
    action.discard = discard;
  }
  sendAction(action);
  clearPokemonSplendorSelection();
}

function adjustPokemonSplendorTokenSelection(color, delta) {
  if (!pokemonSplendorTokenSelection[color]) {
    pokemonSplendorTokenSelection[color] = 0;
  }
  pokemonSplendorTokenSelection[color] = Math.max(0, pokemonSplendorTokenSelection[color] + delta);
  renderPokemonSplendorTokenSelection();
  updatePokemonSplendorDiscardHint(currentPokemonSplendorView);
  updatePokemonSplendorActionButtons();
}

function adjustPokemonSplendorDiscardSelection(color, delta) {
  if (!pokemonSplendorDiscardSelection[color]) {
    pokemonSplendorDiscardSelection[color] = 0;
  }
  pokemonSplendorDiscardSelection[color] = Math.max(0, pokemonSplendorDiscardSelection[color] + delta);
  renderPokemonSplendorDiscardSelection();
  updatePokemonSplendorActionButtons();
}

function renderPokemonSplendorTokenSelection() {
  if (!pokemonSplendorTokenSelectionEl) {
    return;
  }
  if (pokemonSplendorTokenSelection.purple) {
    pokemonSplendorTokenSelection.purple = 0;
  }
  pokemonSplendorTokenSelectionEl.innerHTML = "";
  pokemonSplendorBaseColors.forEach((color) => {
    const wrapper = document.createElement("div");
    wrapper.className = `token-picker gem-${color}`;
    wrapper.dataset.explainId = "pokemonSplendorTokenPicker";
    wrapper.addEventListener("click", (event) => {
      if (event.shiftKey || event.altKey) {
        adjustPokemonSplendorTokenSelection(color, -1);
        return;
      }
      const rect = wrapper.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      if (event.clientX < midpoint) {
        adjustPokemonSplendorTokenSelection(color, -1);
      } else {
        adjustPokemonSplendorTokenSelection(color, 1);
      }
    });
    wrapper.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      adjustPokemonSplendorTokenSelection(color, -1);
    });
    const label = document.createElement("span");
    label.textContent = `${pokemonSplendorColorEmoji[color]} ${pokemonSplendorColorLabels[color]}`;
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "-";
    minus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustPokemonSplendorTokenSelection(color, -1);
    });
    const count = document.createElement("span");
    count.textContent = pokemonSplendorTokenSelection[color] || 0;
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustPokemonSplendorTokenSelection(color, 1);
    });
    wrapper.appendChild(label);
    wrapper.appendChild(minus);
    wrapper.appendChild(count);
    wrapper.appendChild(plus);
    pokemonSplendorTokenSelectionEl.appendChild(wrapper);
  });
}

function renderPokemonSplendorDiscardSelection() {
  if (!pokemonSplendorDiscardSelectionEl) {
    return;
  }
  pokemonSplendorDiscardSelectionEl.innerHTML = "";
  pokemonSplendorColors.forEach((color) => {
    const wrapper = document.createElement("div");
    wrapper.className = `token-picker gem-${color}`;
    wrapper.addEventListener("click", (event) => {
      if (event.shiftKey || event.altKey) {
        adjustPokemonSplendorDiscardSelection(color, -1);
        return;
      }
      const rect = wrapper.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      if (event.clientX < midpoint) {
        adjustPokemonSplendorDiscardSelection(color, -1);
      } else {
        adjustPokemonSplendorDiscardSelection(color, 1);
      }
    });
    wrapper.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      adjustPokemonSplendorDiscardSelection(color, -1);
    });
    const label = document.createElement("span");
    label.textContent = `${pokemonSplendorColorEmoji[color]} ${pokemonSplendorColorLabels[color]}`;
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "-";
    minus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustPokemonSplendorDiscardSelection(color, -1);
    });
    const count = document.createElement("span");
    count.textContent = pokemonSplendorDiscardSelection[color] || 0;
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustPokemonSplendorDiscardSelection(color, 1);
    });
    wrapper.appendChild(label);
    wrapper.appendChild(minus);
    wrapper.appendChild(count);
    wrapper.appendChild(plus);
    pokemonSplendorDiscardSelectionEl.appendChild(wrapper);
  });
}

function createPokemonSplendorCostRow(cost) {
  const costRow = document.createElement("div");
  costRow.className = "card-cost";
  pokemonSplendorColors.forEach((color) => {
    const value = (cost && cost[color]) || 0;
    if (!value) {
      return;
    }
    const chip = document.createElement("div");
    chip.className = `cost-chip gem-${color}`;
    chip.textContent = `${pokemonSplendorColorEmoji[color]} ${value}`;
    costRow.appendChild(chip);
  });
  if (!costRow.childNodes.length) {
    const chip = document.createElement("div");
    chip.className = "cost-chip";
    chip.textContent = "-";
    costRow.appendChild(chip);
  }
  return costRow;
}

function createPokemonSplendorRequirements(requirements) {
  const entries = Object.entries(requirements || {}).filter(([, value]) => value > 0);
  if (!entries.length) {
    return "";
  }
  return entries
    .map(([color, value]) => `${pokemonSplendorColorEmoji[color] || ""}${value}`)
    .join(" ");
}

function createPokemonSplendorCard(card, selected, options = {}) {
  const wrapper = document.createElement("button");
  wrapper.type = "button";
  wrapper.className = "splendor-card pokemon-card";
  if (options.compact) {
    wrapper.classList.add("compact");
  }
  if (selected) {
    wrapper.classList.add("selected");
  }
  if (card && card.affordable) {
    wrapper.classList.add("affordable");
  }
  if (!card) {
    wrapper.textContent = "-";
    wrapper.disabled = true;
    return wrapper;
  }

  const title = document.createElement("div");
  title.className = "card-title";
  const nameEn = card.name_en || card.name || card.id;
  const nameZh = card.name && card.name !== card.name_en ? card.name : "";
  title.textContent = nameZh ? `${nameZh} (${nameEn})` : nameEn;
  wrapper.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "card-meta";
  const tierLabel = card.tier_label || card.tier || "";
  const points = typeof card.points === "number" ? card.points : 0;
  const bonus = card.bonus ? `${pokemonSplendorColorEmoji[card.bonus]} ${pokemonSplendorColorLabels[card.bonus]}` : "-";
  meta.textContent = `${tierLabel} | VP ${points} | Bonus ${bonus}`;
  wrapper.appendChild(meta);

  if (card.evolution && card.evolution.targets && card.evolution.targets.length) {
    const evo = document.createElement("div");
    evo.className = "pokemon-card-evo";
    const req = createPokemonSplendorRequirements(card.evolution.requirements);
    evo.textContent = `Evo → ${card.evolution.targets.join(" / ")}${req ? ` | Need ${req}` : ""}`;
    wrapper.appendChild(evo);
  }

  wrapper.appendChild(createPokemonSplendorCostRow(card.cost || {}));
  return wrapper;
}

function renderPokemonSplendorSupply(view) {
  if (!pokemonSplendorSupply) {
    return;
  }
  pokemonSplendorSupply.innerHTML = "";
  pokemonSplendorColors.forEach((color) => {
    const token = document.createElement("div");
    token.className = `splendor-token gem-${color}`;
    const count = view.tokens_supply ? view.tokens_supply[color] : 0;
    token.textContent = `${pokemonSplendorColorEmoji[color]} ${pokemonSplendorColorLabels[color]}: ${count}`;
    pokemonSplendorSupply.appendChild(token);
  });
}

function renderPokemonSplendorMarket(view) {
  const tiers = {
    legendary: pokemonSplendorMarketLegendary,
    rare: pokemonSplendorMarketRare,
    lv3: pokemonSplendorMarketLv3,
    lv2: pokemonSplendorMarketLv2,
    lv1: pokemonSplendorMarketLv1,
  };
  Object.entries(tiers).forEach(([tier, container]) => {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    const cards = (view.market && view.market[tier]) || [];
    if (!cards.length) {
      const empty = createPokemonSplendorCard(null, false, { compact: false });
      empty.classList.add("pokemon-card-empty");
      container.appendChild(empty);
      return;
    }
    cards.forEach((card, index) => {
      const selected =
        pokemonSplendorSelectedMarket && pokemonSplendorSelectedMarket.tier === tier && pokemonSplendorSelectedMarket.index === index;
      const cardEl = createPokemonSplendorCard(card, selected);
      cardEl.classList.add("pokemon-market-card");
      cardEl.addEventListener("click", () => {
        pokemonSplendorSelectedMarket = { tier, index };
        pokemonSplendorSelectedReserved = null;
        updatePokemonSplendorSelectionLabels();
        renderPokemonSplendorMarket(view);
        renderPokemonSplendorReserved(view);
        updatePokemonSplendorDiscardHint(view);
        updatePokemonSplendorActionButtons();
      });
      container.appendChild(cardEl);
    });
  });
}

function renderPokemonSplendorReserved(view) {
  if (!pokemonSplendorReserved) {
    return;
  }
  pokemonSplendorReserved.innerHTML = "";
  const cards = view.your_reserved || [];
  cards.forEach((card, index) => {
    const selected = pokemonSplendorSelectedReserved === index;
    const cardEl = createPokemonSplendorCard(card, selected);
    cardEl.classList.add("pokemon-reserved-card");
    cardEl.addEventListener("click", () => {
      pokemonSplendorSelectedReserved = index;
      pokemonSplendorSelectedMarket = null;
      updatePokemonSplendorSelectionLabels();
      renderPokemonSplendorMarket(view);
      renderPokemonSplendorReserved(view);
      updatePokemonSplendorDiscardHint(view);
      updatePokemonSplendorActionButtons();
    });
    pokemonSplendorReserved.appendChild(cardEl);
  });
  if (!cards.length) {
    const empty = createPokemonSplendorCard(null, false, { compact: false });
    empty.classList.add("pokemon-card-empty");
    pokemonSplendorReserved.appendChild(empty);
  }
}

function renderPokemonSplendorCaptured(view) {
  if (!pokemonSplendorCaptured) {
    return;
  }
  pokemonSplendorCaptured.innerHTML = "";
  const player = findPokemonSplendorPlayer(view, view.you);
  const cards = player ? player.captured || [] : [];
  cards.forEach((card) => {
    const selected = pokemonSplendorSelectedBase === card.id;
    const cardEl = createPokemonSplendorCard(card, selected, { compact: true });
    cardEl.classList.add("pokemon-captured-card");
    cardEl.addEventListener("click", () => {
      pokemonSplendorSelectedBase = card.id;
      updatePokemonSplendorSelectionLabels();
      renderPokemonSplendorCaptured(view);
      updatePokemonSplendorActionButtons();
    });
    pokemonSplendorCaptured.appendChild(cardEl);
  });
  if (!cards.length) {
    const empty = createPokemonSplendorCard(null, false, { compact: true });
    empty.classList.add("pokemon-card-empty");
    pokemonSplendorCaptured.appendChild(empty);
  }
}

function renderPokemonSplendorPlayers(view) {
  if (!pokemonSplendorPlayers) {
    return;
  }
  pokemonSplendorPlayers.innerHTML = "";
  const orderedPlayers = orderPokemonSplendorPlayers(view);
  orderedPlayers.forEach((player) => {
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
    const kantoTag = player.player_id === view.starting_player ? " ★" : "";
    name.textContent = `${player.name || player.player_id}${youTag}${kantoTag}`;
    const score = document.createElement("div");
    score.className = "badge";
    score.textContent = `Score ${player.score}`;
    header.appendChild(name);
    header.appendChild(score);
    card.appendChild(header);

    const tokensLine = document.createElement("div");
    tokensLine.className = "splendor-token-row";
    pokemonSplendorColors.forEach((color) => {
      const token = document.createElement("div");
      token.className = `splendor-token gem-${color}`;
      const count = (player.tokens && player.tokens[color]) || 0;
      token.textContent = `${pokemonSplendorColorEmoji[color]}${count}`;
      tokensLine.appendChild(token);
    });

    const bonusLine = document.createElement("div");
    const bonuses = pokemonSplendorBaseColors
      .map((color) => `${pokemonSplendorColorEmoji[color]}${(player.bonuses && player.bonuses[color]) || 0}`)
      .join(" ");
    bonusLine.textContent = `Bonuses: ${bonuses}`;

    const countsLine = document.createElement("div");
    countsLine.textContent = `Reserved: ${player.reserved_count} | Captured: ${player.captured_count} | Evolved: ${
      player.evolved_count || 0
    }`;

    const meta = document.createElement("div");
    meta.className = "player-meta";
    meta.appendChild(tokensLine);
    meta.appendChild(bonusLine);
    meta.appendChild(countsLine);
    card.appendChild(meta);

    const capturedSection = document.createElement("div");
    capturedSection.className = "splendor-player-purchased";
    const capturedTitle = document.createElement("div");
    capturedTitle.className = "splendor-player-purchased-title";
    capturedTitle.textContent = "Captured";
    capturedSection.appendChild(capturedTitle);
    const capturedList = document.createElement("div");
    capturedList.className = "splendor-cards splendor-player-purchased-list";
    const capturedCards = Array.isArray(player.captured) ? player.captured : [];
    if (capturedCards.length) {
      capturedCards.forEach((cardData) => {
        const cardEl = createPokemonSplendorCard(cardData, false, { compact: true });
        capturedList.appendChild(cardEl);
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "splendor-player-empty";
      empty.textContent = "-";
      capturedList.appendChild(empty);
    }
    capturedSection.appendChild(capturedList);
    card.appendChild(capturedSection);

    pokemonSplendorPlayers.appendChild(card);
  });
}

function orderPokemonSplendorPlayers(view) {
  if (!view || !Array.isArray(view.players)) {
    return [];
  }
  const players = view.players.slice();
  const youId = view.you;
  const idx = players.findIndex((player) => player.player_id === youId);
  if (idx <= 0) {
    return players;
  }
  return players.slice(idx).concat(players.slice(0, idx));
}

function findPokemonSplendorPlayer(view, playerId) {
  if (!view || !Array.isArray(view.players)) {
    return null;
  }
  return view.players.find((player) => player.player_id === playerId) || null;
}

function findPokemonSplendorCapturedById(view, cardId) {
  if (!view || !cardId) {
    return null;
  }
  const player = findPokemonSplendorPlayer(view, view.you);
  if (!player || !Array.isArray(player.captured)) {
    return null;
  }
  return player.captured.find((card) => card.id === cardId) || null;
}

function getPokemonSplendorSelectedMarketCard(view) {
  if (!pokemonSplendorSelectedMarket || !view || !view.market) {
    return null;
  }
  const cards = view.market[pokemonSplendorSelectedMarket.tier] || [];
  return cards[pokemonSplendorSelectedMarket.index] || null;
}

function getPokemonSplendorSelectedReservedCard(view) {
  if (pokemonSplendorSelectedReserved === null || !view) {
    return null;
  }
  const cards = view.your_reserved || [];
  return cards[pokemonSplendorSelectedReserved] || null;
}

function findPokemonSplendorEvolutionOption(view) {
  if (!view || !Array.isArray(view.evolution_options)) {
    return null;
  }
  if (!pokemonSplendorSelectedBase) {
    return null;
  }
  if (pokemonSplendorSelectedMarket) {
    return (
      view.evolution_options.find(
        (opt) =>
          opt.base_id === pokemonSplendorSelectedBase &&
          opt.source === "market" &&
          opt.tier === pokemonSplendorSelectedMarket.tier &&
          opt.index === pokemonSplendorSelectedMarket.index
      ) || null
    );
  }
  if (pokemonSplendorSelectedReserved !== null) {
    return (
      view.evolution_options.find(
        (opt) =>
          opt.base_id === pokemonSplendorSelectedBase &&
          opt.source === "reserved" &&
          opt.reserved_index === pokemonSplendorSelectedReserved
      ) || null
    );
  }
  return null;
}

function updatePokemonSplendorActionButtons() {
  const view = currentPokemonSplendorView;
  const legal = (view && view.legal_actions) || [];
  const selectedMarketCard = getPokemonSplendorSelectedMarketCard(view);
  const selectedReservedCard = getPokemonSplendorSelectedReservedCard(view);

  if (pokemonSplendorTakeThreeBtn) {
    const gain = pokemonSplendorTokenGainForAction(view, "take_tokens");
    pokemonSplendorTakeThreeBtn.disabled = !legal.includes("take_tokens") || !gain;
  }
  if (pokemonSplendorTakeTwoBtn) {
    const gain = pokemonSplendorTokenGainForAction(view, "take_tokens_same");
    pokemonSplendorTakeTwoBtn.disabled = !legal.includes("take_tokens_same") || !gain;
  }
  if (pokemonSplendorReserveMarketBtn) {
    const canReserveMarket =
      legal.includes("reserve_market") &&
      pokemonSplendorSelectedMarket &&
      ["lv1", "lv2", "lv3"].includes(pokemonSplendorSelectedMarket.tier);
    pokemonSplendorReserveMarketBtn.disabled = !canReserveMarket;
  }
  if (pokemonSplendorReserveDeckBtn) {
    pokemonSplendorReserveDeckBtn.disabled = !legal.includes("reserve_deck");
  }
  if (!legal.includes("reserve_deck")) {
    closePokemonSplendorReserveMenu();
  }
  if (pokemonSplendorBuyMarketBtn) {
    pokemonSplendorBuyMarketBtn.disabled =
      !legal.includes("buy_market") || !selectedMarketCard || !selectedMarketCard.affordable;
  }
  if (pokemonSplendorBuyReservedBtn) {
    pokemonSplendorBuyReservedBtn.disabled =
      !legal.includes("buy_reserved") || !selectedReservedCard || !selectedReservedCard.affordable;
  }
  if (pokemonSplendorEvolveBtn) {
    const evolveOption = findPokemonSplendorEvolutionOption(view);
    pokemonSplendorEvolveBtn.disabled = !legal.includes("evolve") || !evolveOption;
  }
  if (pokemonSplendorSkipEvolveBtn) {
    pokemonSplendorSkipEvolveBtn.disabled = !legal.includes("skip_evolution");
  }
  if (pokemonSplendorDiscardBtn) {
    const requirement = getPokemonSplendorPendingDiscardRequirement(view);
    const validSelection = pokemonSplendorIsDiscardSelectionValid(requirement);
    pokemonSplendorDiscardBtn.disabled = !legal.includes("discard_tokens") || !validSelection;
  }
}

function renderPokemonSplendorGameState(data) {
  const view = data.view;
  currentPokemonSplendorView = view;
  if (currentGameType !== "splendor_pokemon") {
    return;
  }
  if (!view) {
    clearPokemonSplendorState();
    return;
  }

  if (pokemonSplendorPhaseLabel) {
    pokemonSplendorPhaseLabel.textContent = view.phase || "-";
  }
  if (pokemonSplendorTurnLabel) {
    const currentPlayer = findPokemonSplendorPlayer(view, view.current_turn);
    pokemonSplendorTurnLabel.textContent = currentPlayer ? currentPlayer.name || currentPlayer.player_id : "-";
  }
  if (pokemonSplendorFinalRoundLabel) {
    pokemonSplendorFinalRoundLabel.textContent = view.final_round && view.final_round.active ? "Yes" : "No";
  }
  if (pokemonSplendorStartLabel) {
    const startPlayer = findPokemonSplendorPlayer(view, view.starting_player);
    pokemonSplendorStartLabel.textContent = startPlayer ? startPlayer.name || startPlayer.player_id : "-";
  }
  if (pokemonSplendorWinnerLabel) {
    if (view.game_over && Array.isArray(view.winner) && view.winner.length) {
      const names = view.winner.map((pid) => {
        const player = findPokemonSplendorPlayer(view, pid);
        return player ? player.name || player.player_id : pid;
      });
      pokemonSplendorWinnerLabel.textContent = names.join(", ");
    } else {
      pokemonSplendorWinnerLabel.textContent = "-";
    }
  }

  renderPokemonSplendorSupply(view);
  renderPokemonSplendorMarket(view);
  renderPokemonSplendorReserved(view);
  renderPokemonSplendorCaptured(view);
  renderPokemonSplendorPlayers(view);
  updatePokemonSplendorSelectionLabels();
  renderPokemonSplendorTokenSelection();
  renderPokemonSplendorDiscardSelection();
  updatePokemonSplendorDiscardHint(view);
  updatePokemonSplendorActionButtons();
  if (pokemonSplendorExplainMode) {
    updatePokemonSplendorExplainModeClasses(true);
  }
}

if (pokemonSplendorPanel) {
  pokemonSplendorPanel.addEventListener("click", (event) => {
    if (
      pokemonSplendorReserveMenu &&
      !pokemonSplendorReserveMenu.classList.contains("hidden") &&
      !event.target.closest(".pokemon-reserve-menu") &&
      !event.target.closest("#pokemonSplendorReserveDeckBtn")
    ) {
      closePokemonSplendorReserveMenu();
    }
    if (
      event.target.closest("button") ||
      event.target.closest("input") ||
      event.target.closest("select") ||
      event.target.closest("textarea") ||
      event.target.closest(".pokemon-market-card") ||
      event.target.closest(".pokemon-reserved-card") ||
      event.target.closest(".pokemon-captured-card") ||
      event.target.closest(".token-picker") ||
      event.target.closest(".player-card") ||
      event.target.closest(".splendor-card")
    ) {
      return;
    }
    clearPokemonSplendorSelection();
  });
}

if (pokemonSplendorTakeThreeBtn) {
  pokemonSplendorTakeThreeBtn.addEventListener("click", () => {
    const view = currentPokemonSplendorView;
    if (!view) {
      return;
    }
    const gain = pokemonSplendorTokenGainForAction(view, "take_tokens");
    if (!gain) {
      log("Select valid different colors to take");
      return;
    }
    const colors = pokemonSplendorBaseColors.filter((color) => gain[color] > 0);
    const discard = pokemonSplendorDiscardPayloadForAction(view, "take_tokens");
    if (discard === null && (getPokemonSplendorPendingDiscardRequirement(view) || {}).excess > 0) {
      log("Select discard tokens to stay at 10");
      return;
    }
    const action = { type: "take_tokens", colors };
    if (discard) {
      action.discard = discard;
    }
    sendAction(action);
    clearPokemonSplendorSelection();
  });
}

if (pokemonSplendorTakeTwoBtn) {
  pokemonSplendorTakeTwoBtn.addEventListener("click", () => {
    const view = currentPokemonSplendorView;
    if (!view) {
      return;
    }
    const gain = pokemonSplendorTokenGainForAction(view, "take_tokens_same");
    if (!gain) {
      log("Select 2 tokens of the same color");
      return;
    }
    const color = pokemonSplendorBaseColors.find((c) => gain[c] === 2);
    if (!color) {
      log("Select a color to take 2 tokens");
      return;
    }
    const discard = pokemonSplendorDiscardPayloadForAction(view, "take_tokens_same");
    if (discard === null && (getPokemonSplendorPendingDiscardRequirement(view) || {}).excess > 0) {
      log("Select discard tokens to stay at 10");
      return;
    }
    const action = { type: "take_tokens_same", color };
    if (discard) {
      action.discard = discard;
    }
    sendAction(action);
    clearPokemonSplendorSelection();
  });
}

if (pokemonSplendorReserveMarketBtn) {
  pokemonSplendorReserveMarketBtn.addEventListener("click", () => {
    const view = currentPokemonSplendorView;
    if (!view || !pokemonSplendorSelectedMarket) {
      log("Select a market card to reserve");
      return;
    }
    const discard = pokemonSplendorDiscardPayloadForAction(view, "reserve_market");
    if (discard === null && (getPokemonSplendorPendingDiscardRequirement(view) || {}).excess > 0) {
      log("Select discard tokens to stay at 10");
      return;
    }
    const action = {
      type: "reserve_market",
      tier: pokemonSplendorSelectedMarket.tier,
      index: pokemonSplendorSelectedMarket.index,
    };
    if (discard) {
      action.discard = discard;
    }
    sendAction(action);
    clearPokemonSplendorSelection();
  });
}

if (pokemonSplendorReserveDeckBtn) {
  pokemonSplendorReserveDeckBtn.addEventListener("click", () => {
    if (pokemonSplendorReserveDeckBtn.disabled) {
      return;
    }
    if (pokemonSplendorReserveMenu && !pokemonSplendorReserveMenu.classList.contains("hidden")) {
      closePokemonSplendorReserveMenu();
      return;
    }
    showPokemonSplendorReserveMenu(pokemonSplendorReserveDeckBtn);
  });
}

if (pokemonSplendorBuyMarketBtn) {
  pokemonSplendorBuyMarketBtn.addEventListener("click", () => {
    const view = currentPokemonSplendorView;
    if (!view || !pokemonSplendorSelectedMarket) {
      log("Select a market card to catch");
      return;
    }
    const action = {
      type: "buy_market",
      tier: pokemonSplendorSelectedMarket.tier,
      index: pokemonSplendorSelectedMarket.index,
    };
    sendAction(action);
    clearPokemonSplendorSelection();
  });
}

if (pokemonSplendorBuyReservedBtn) {
  pokemonSplendorBuyReservedBtn.addEventListener("click", () => {
    const view = currentPokemonSplendorView;
    if (!view || pokemonSplendorSelectedReserved === null) {
      log("Select a reserved card to catch");
      return;
    }
    const action = { type: "buy_reserved", reserved_index: pokemonSplendorSelectedReserved };
    sendAction(action);
    clearPokemonSplendorSelection();
  });
}

if (pokemonSplendorEvolveBtn) {
  pokemonSplendorEvolveBtn.addEventListener("click", () => {
    const view = currentPokemonSplendorView;
    const option = findPokemonSplendorEvolutionOption(view);
    if (!option) {
      log("Select a base Pokemon and a valid target");
      return;
    }
    const action = { type: "evolve", base_id: option.base_id, target_id: option.target_id };
    sendAction(action);
    clearPokemonSplendorSelection();
  });
}

if (pokemonSplendorSkipEvolveBtn) {
  pokemonSplendorSkipEvolveBtn.addEventListener("click", () => {
    sendAction({ type: "skip_evolution" });
    clearPokemonSplendorSelection();
  });
}

if (pokemonSplendorDiscardBtn) {
  pokemonSplendorDiscardBtn.addEventListener("click", () => {
    const view = currentPokemonSplendorView;
    if (!view) {
      return;
    }
    const requirement = getPokemonSplendorPendingDiscardRequirement(view);
    if (!pokemonSplendorIsDiscardSelectionValid(requirement)) {
      log("Select tokens to discard");
      return;
    }
    const payload = pokemonSplendorDiscardSelectionPayload(requirement);
    if (!payload) {
      log("Select tokens to discard");
      return;
    }
    sendAction({ type: "discard_tokens", tokens: payload });
    clearPokemonSplendorSelection();
  });
}

let pokemonSplendorExplainMode = false;

function showPokemonSplendorHeaderActions(show) {
  if (pokemonSplendorHeaderActions) {
    pokemonSplendorHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitPokemonSplendorExplainMode();
    closePokemonSplendorHelpModal();
    closePokemonSplendorExplainModal();
  }
}

function showPokemonSplendorHelpModal() {
  if (!pokemonSplendorHelpModal) {
    return;
  }
  if (pokemonSplendorHelpContent) {
    pokemonSplendorHelpContent.innerHTML = POKEMON_SPLENDOR_HELP_TEXT;
  }
  setModalVisible(pokemonSplendorHelpModal, true);
}

function closePokemonSplendorHelpModal() {
  if (pokemonSplendorHelpModal) {
    setModalVisible(pokemonSplendorHelpModal, false);
  }
}

function showPokemonSplendorExplainModal(text) {
  if (!pokemonSplendorExplainModal) {
    return;
  }
  if (pokemonSplendorExplainContent) {
    pokemonSplendorExplainContent.innerHTML = text;
  }
  setModalVisible(pokemonSplendorExplainModal, true);
}

function closePokemonSplendorExplainModal() {
  if (pokemonSplendorExplainModal) {
    setModalVisible(pokemonSplendorExplainModal, false);
  }
}

function updatePokemonSplendorExplainModeClasses(enabled) {
  Object.keys(POKEMON_SPLENDOR_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
  document
    .querySelectorAll(
      "#pokemonSplendorPanel .pokemon-market-card, #pokemonSplendorPanel .pokemon-reserved-card, #pokemonSplendorPanel .pokemon-captured-card, #pokemonSplendorPanel .token-picker"
    )
    .forEach((btn) => {
      btn.classList.toggle("has-explanation", enabled);
    });
}

function enterPokemonSplendorExplainMode() {
  pokemonSplendorExplainMode = true;
  document.body.classList.add("pokemon-splendor-explain-mode");
  if (pokemonSplendorExplainBtn) {
    pokemonSplendorExplainBtn.classList.add("active");
  }
  closePokemonSplendorReserveMenu();
  updatePokemonSplendorExplainModeClasses(true);
}

function exitPokemonSplendorExplainMode() {
  pokemonSplendorExplainMode = false;
  document.body.classList.remove("pokemon-splendor-explain-mode");
  if (pokemonSplendorExplainBtn) {
    pokemonSplendorExplainBtn.classList.remove("active");
  }
  updatePokemonSplendorExplainModeClasses(false);
}

function getPokemonSplendorExplanationForElement(element) {
  if (!element) {
    return null;
  }
  const buttonId = element.getAttribute("id");
  if (buttonId && POKEMON_SPLENDOR_BUTTON_EXPLANATIONS[buttonId]) {
    return POKEMON_SPLENDOR_BUTTON_EXPLANATIONS[buttonId];
  }
  if (element.classList.contains("pokemon-market-card")) {
    return POKEMON_SPLENDOR_BUTTON_EXPLANATIONS.pokemonSplendorMarketCard;
  }
  if (element.classList.contains("pokemon-reserved-card")) {
    return POKEMON_SPLENDOR_BUTTON_EXPLANATIONS.pokemonSplendorReservedCard;
  }
  if (element.classList.contains("pokemon-captured-card")) {
    return POKEMON_SPLENDOR_BUTTON_EXPLANATIONS.pokemonSplendorCapturedCard;
  }
  if (element.classList.contains("token-picker")) {
    return POKEMON_SPLENDOR_BUTTON_EXPLANATIONS.pokemonSplendorTokenPicker;
  }
  return null;
}

function showPokemonSplendorExplanationForElement(element) {
  const info = getPokemonSplendorExplanationForElement(element);
  if (!info) {
    return false;
  }
  const html = `<strong>${info.name}</strong><p>${info.description}</p>`;
  showPokemonSplendorExplainModal(html);
  return true;
}

function findPokemonSplendorButtonAtPoint(x, y) {
  const ids = Object.keys(POKEMON_SPLENDOR_BUTTON_EXPLANATIONS);
  for (const buttonId of ids) {
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return btn;
    }
  }
  return null;
}

if (pokemonSplendorHelpBtn) {
  pokemonSplendorHelpBtn.addEventListener("click", () => {
    showPokemonSplendorHelpModal();
  });
}

if (pokemonSplendorHelpModalCloseBtn) {
  pokemonSplendorHelpModalCloseBtn.addEventListener("click", closePokemonSplendorHelpModal);
}

if (pokemonSplendorExplainBtn) {
  pokemonSplendorExplainBtn.addEventListener("click", () => {
    if (pokemonSplendorExplainMode) {
      exitPokemonSplendorExplainMode();
    } else {
      enterPokemonSplendorExplainMode();
    }
  });
}

if (pokemonSplendorExplainModalCloseBtn) {
  pokemonSplendorExplainModalCloseBtn.addEventListener("click", closePokemonSplendorExplainModal);
}

document.addEventListener(
  "click",
  (event) => {
    if (!pokemonSplendorExplainMode) {
      return;
    }
    const tokenPicker = event.target.closest(".token-picker");
    const button = event.target.closest("button");
    const target = tokenPicker || button;
    if (!target) {
      return;
    }
    if (button === pokemonSplendorExplainBtn || button === pokemonSplendorHelpBtn) {
      return;
    }
    if (button === pokemonSplendorHelpModalCloseBtn || button === pokemonSplendorExplainModalCloseBtn) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const explained = showPokemonSplendorExplanationForElement(target);
    if (explained) {
      exitPokemonSplendorExplainMode();
    }
  },
  true
);

document.addEventListener(
  "pointerdown",
  (event) => {
    if (!pokemonSplendorExplainMode) {
      return;
    }
    const button = findPokemonSplendorButtonAtPoint(event.clientX, event.clientY);
    if (!button) {
      return;
    }
    if (button === pokemonSplendorExplainBtn || button === pokemonSplendorHelpBtn) {
      return;
    }
    if (button === pokemonSplendorHelpModalCloseBtn || button === pokemonSplendorExplainModalCloseBtn) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const explained = showPokemonSplendorExplanationForElement(button);
    if (explained) {
      exitPokemonSplendorExplainMode();
    }
  },
  true
);

document.addEventListener("pointerdown", (event) => {
  if (!pokemonSplendorReserveMenu || pokemonSplendorReserveMenu.classList.contains("hidden")) {
    return;
  }
  if (event.target.closest(".pokemon-reserve-menu")) {
    return;
  }
  if (event.target.closest("#pokemonSplendorReserveDeckBtn")) {
    return;
  }
  closePokemonSplendorReserveMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  if (pokemonSplendorReserveMenu && !pokemonSplendorReserveMenu.classList.contains("hidden")) {
    closePokemonSplendorReserveMenu();
  }
  if (pokemonSplendorExplainMode) {
    exitPokemonSplendorExplainMode();
  }
});
