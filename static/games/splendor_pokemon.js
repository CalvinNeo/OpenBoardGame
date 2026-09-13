const pokemonSplendorHeaderActions = document.getElementById("pokemonSplendorHeaderActions");
const pokemonSplendorHelpBtn = document.getElementById("pokemonSplendorHelpBtn");
const pokemonSplendorExplainBtn = document.getElementById("pokemonSplendorExplainBtn");
const pokemonSplendorHelpModal = document.getElementById("pokemonSplendorHelpModal");
const pokemonSplendorHelpModalCloseBtn = document.getElementById("pokemonSplendorHelpModalCloseBtn");
const pokemonSplendorExplainModal = document.getElementById("pokemonSplendorExplainModal");
const pokemonSplendorExplainModalCloseBtn = document.getElementById("pokemonSplendorExplainModalCloseBtn");
const pokemonSplendorHelpContent = document.getElementById("pokemonSplendorHelpContent");
const pokemonSplendorExplainContent = document.getElementById("pokemonSplendorExplainContent");
const pokemonSplendorTokenModal = document.getElementById("pokemonSplendorTokenModal");
const pokemonSplendorTokenModalCloseBtn = document.getElementById("pokemonSplendorTokenModalCloseBtn");
const pokemonSplendorTokenPool = document.getElementById("pokemonSplendorTokenPool");
const pokemonSplendorTokenPicked = document.getElementById("pokemonSplendorTokenPicked");
const pokemonSplendorTokenHint = document.getElementById("pokemonSplendorTokenHint");
const pokemonSplendorDiscardSelectionModalRow = document.getElementById("pokemonSplendorDiscardSelectionModalRow");
const pokemonSplendorDiscardSelectionModal = document.getElementById("pokemonSplendorDiscardSelectionModal");
const pokemonSplendorDiscardHintModal = document.getElementById("pokemonSplendorDiscardHintModal");

const pokemonSplendorPanel = document.getElementById("pokemonSplendorPanel");
const pokemonSplendorPrompt = document.getElementById("pokemonSplendorPrompt");
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
const pokemonSplendorDiscardSelectionRow = document.getElementById("pokemonSplendorDiscardSelectionRow");
const pokemonSplendorDiscardSelectionEl = document.getElementById("pokemonSplendorDiscardSelection");
const pokemonSplendorDiscardHint = document.getElementById("pokemonSplendorDiscardHint");
const pokemonSplendorTakeTokensBtn = document.getElementById("pokemonSplendorTakeTokensBtn");
const pokemonSplendorReserveMarketBtn = document.getElementById("pokemonSplendorReserveMarketBtn");
const pokemonSplendorReserveDeckBtn = document.getElementById("pokemonSplendorReserveDeckBtn");
const pokemonSplendorBuyMarketBtn = document.getElementById("pokemonSplendorBuyMarketBtn");
const pokemonSplendorBuyReservedBtn = document.getElementById("pokemonSplendorBuyReservedBtn");
const pokemonSplendorEvolveBtn = document.getElementById("pokemonSplendorEvolveBtn");
const pokemonSplendorSkipEvolveBtn = document.getElementById("pokemonSplendorSkipEvolveBtn");
const pokemonSplendorDiscardBtn = document.getElementById("pokemonSplendorDiscardBtn");
const pokemonSplendorConfirmThreeBtn = document.getElementById("pokemonSplendorConfirmThreeBtn");
const pokemonSplendorConfirmTwoBtn = document.getElementById("pokemonSplendorConfirmTwoBtn");
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
const pokemonSplendorTierLabels = {
  lv1: "LV1",
  lv2: "LV2",
  lv3: "LV3",
  rare: "Rare",
  legendary: "Legendary",
};

function createPokemonSplendorColorDot(color) {
  const dot = document.createElement("span");
  dot.className = `pokemon-color-dot pokemon-color-${color}`;
  dot.setAttribute("aria-hidden", "true");
  return dot;
}

function appendPokemonSplendorColorValue(container, color, value, options = {}) {
  container.appendChild(createPokemonSplendorColorDot(color));
  const text = document.createElement("span");
  const label = pokemonSplendorColorLabels[color] || color;
  text.textContent = options.includeLabel ? `${label}: ${value}` : String(value);
  container.appendChild(text);
  container.setAttribute("aria-label", `${label}: ${value}`);
}

function pokemonSplendorCardDisplayName(card, bilingual = false) {
  if (!card) {
    return "-";
  }
  const nameEn = card.name_en || card.name || card.id || "Pokemon";
  const nameZh = card.name && card.name !== card.name_en ? card.name : "";
  if (bilingual && nameZh) {
    return `${nameZh} (${nameEn})`;
  }
  return nameZh || nameEn;
}

function pokemonSplendorTierLabel(tier) {
  return pokemonSplendorTierLabels[tier] || tier || "";
}

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
  pokemonSplendorTakeTokensBtn: {
    name: "Take Tokens",
    description: "Open the token picker to choose either 3 different colors or 2 of the same color.",
  },
  pokemonSplendorReserveMarketBtn: {
    name: "Reserve Market",
    description: "Reserve the selected LV1/LV2/LV3 market card. Gain 1 Master Ball if available.",
  },
  pokemonSplendorReserveDeckBtn: {
    name: "Reserve Deck",
    description: "Reserve a blind card from the deck. Choose LV1/LV2/LV3 after clicking.",
  },
  pokemonSplendorConfirmThreeBtn: {
    name: "Take 3 Different",
    description: "Confirm taking 1 each of different colors (or all remaining colors if fewer than 3 exist).",
  },
  pokemonSplendorConfirmTwoBtn: {
    name: "Take 2 Same",
    description: "Confirm taking 2 of one color (only if 4+ remain in supply).",
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
    description: "Tap to adjust tokens you want to discard.",
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
  closePokemonSplendorTokenModal();
  closePokemonSplendorReserveMenu();
  if (pokemonSplendorDiscardSelectionRow) {
    pokemonSplendorDiscardSelectionRow.classList.add("hidden");
  }
  if (pokemonSplendorDiscardHint) {
    pokemonSplendorDiscardHint.textContent = "";
    pokemonSplendorDiscardHint.classList.add("hidden");
  }
  if (pokemonSplendorDiscardSelectionModalRow) {
    pokemonSplendorDiscardSelectionModalRow.classList.add("hidden");
  }
  if (pokemonSplendorDiscardHintModal) {
    pokemonSplendorDiscardHintModal.textContent = "";
    pokemonSplendorDiscardHintModal.classList.add("hidden");
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
  if (pokemonSplendorPrompt) {
    pokemonSplendorPrompt.textContent = "Waiting for the game state.";
    pokemonSplendorPrompt.dataset.tone = "neutral";
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
    const card = getPokemonSplendorSelectedMarketCard(currentPokemonSplendorView);
    pokemonSplendorSelectedMarketLabel.textContent = card
      ? `${pokemonSplendorCardDisplayName(card)} · ${pokemonSplendorTierLabel(card.tier)}`
      : "-";
  }
  if (pokemonSplendorSelectedReservedLabel) {
    const card = getPokemonSplendorSelectedReservedCard(currentPokemonSplendorView);
    pokemonSplendorSelectedReservedLabel.textContent = card ? pokemonSplendorCardDisplayName(card) : "-";
  }
  if (pokemonSplendorSelectedBaseLabel) {
    const baseCard = findPokemonSplendorCapturedById(currentPokemonSplendorView, pokemonSplendorSelectedBase);
    pokemonSplendorSelectedBaseLabel.textContent = baseCard ? pokemonSplendorCardDisplayName(baseCard) : "-";
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
  if (
    view.legal_actions &&
    view.legal_actions.includes("reserve_deck") &&
    pokemonSplendorReserveMenu &&
    !pokemonSplendorReserveMenu.classList.contains("hidden")
  ) {
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
    if (pokemonSplendorDiscardHintModal) {
      pokemonSplendorDiscardHintModal.textContent = `Discard ${excess} token${excess === 1 ? "" : "s"} to stay at 10.`;
      pokemonSplendorDiscardHintModal.classList.remove("hidden");
    }
    if (pokemonSplendorDiscardSelectionModalRow) {
      pokemonSplendorDiscardSelectionModalRow.classList.remove("hidden");
    }
  } else {
    pokemonSplendorDiscardHint.textContent = "";
    pokemonSplendorDiscardHint.classList.add("hidden");
    if (pokemonSplendorDiscardSelectionRow) {
      pokemonSplendorDiscardSelectionRow.classList.add("hidden");
    }
    if (pokemonSplendorDiscardHintModal) {
      pokemonSplendorDiscardHintModal.textContent = "";
      pokemonSplendorDiscardHintModal.classList.add("hidden");
    }
    if (pokemonSplendorDiscardSelectionModalRow) {
      pokemonSplendorDiscardSelectionModalRow.classList.add("hidden");
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
  renderPokemonSplendorTokenModal(currentPokemonSplendorView);
  renderPokemonSplendorDiscardSelection();
  updatePokemonSplendorDiscardHint(currentPokemonSplendorView);
  updatePokemonSplendorActionButtons();
  closePokemonSplendorTokenModal();
  closePokemonSplendorReserveMenu();
  if (currentPokemonSplendorView) {
    renderPokemonSplendorMarket(currentPokemonSplendorView);
    renderPokemonSplendorReserved(currentPokemonSplendorView);
    renderPokemonSplendorCaptured(currentPokemonSplendorView);
  }
  updatePokemonSplendorPrompt(currentPokemonSplendorView);
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
      if (sendPokemonSplendorReserveDeck(tier)) {
        closePokemonSplendorReserveMenu();
      }
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
  updatePokemonSplendorDiscardHint(currentPokemonSplendorView);
  updatePokemonSplendorPrompt(currentPokemonSplendorView);
}

function closePokemonSplendorReserveMenu() {
  if (!pokemonSplendorReserveMenu) {
    return;
  }
  pokemonSplendorReserveMenu.classList.add("hidden");
  updatePokemonSplendorDiscardHint(currentPokemonSplendorView);
  updatePokemonSplendorPrompt(currentPokemonSplendorView);
}

function sendPokemonSplendorReserveDeck(tier) {
  const view = currentPokemonSplendorView;
  if (!view) {
    return false;
  }
  const legal = view.legal_actions || [];
  if (!legal.includes("reserve_deck")) {
    log("Reserve deck is not available");
    return false;
  }
  const discard = pokemonSplendorDiscardPayloadForAction(view, "reserve_deck");
  if (discard === null && (getPokemonSplendorPendingDiscardRequirement(view) || {}).excess > 0) {
    log("Select discard tokens to stay at 10");
    return false;
  }
  const action = { type: "reserve_deck", tier };
  if (discard) {
    action.discard = discard;
  }
  sendAction(action);
  clearPokemonSplendorSelection();
  return true;
}

function adjustPokemonSplendorTokenSelection(color, delta) {
  if (!pokemonSplendorTokenSelection[color]) {
    pokemonSplendorTokenSelection[color] = 0;
  }
  pokemonSplendorTokenSelection[color] = Math.max(0, pokemonSplendorTokenSelection[color] + delta);
  renderPokemonSplendorTokenModal(currentPokemonSplendorView);
  updatePokemonSplendorDiscardHint(currentPokemonSplendorView);
  updatePokemonSplendorActionButtons();
}

function adjustPokemonSplendorDiscardSelection(color, delta) {
  const requirement = getPokemonSplendorPendingDiscardRequirement(currentPokemonSplendorView);
  if (!requirement || requirement.excess <= 0) {
    return;
  }
  const player = findPokemonSplendorPlayer(currentPokemonSplendorView, currentPokemonSplendorView.you);
  const held = (player && player.tokens && player.tokens[color]) || 0;
  const gained = (requirement.gain && requirement.gain[color]) || 0;
  const available = held + gained;
  const current = pokemonSplendorDiscardSelection[color] || 0;
  const selectedElsewhere = pokemonSplendorDiscardSelectionTotal() - current;
  const maxForColor = Math.min(available, Math.max(0, requirement.excess - selectedElsewhere));
  pokemonSplendorDiscardSelection[color] = Math.min(maxForColor, Math.max(0, current + delta));
  renderPokemonSplendorDiscardSelection();
  updatePokemonSplendorActionButtons();
  updatePokemonSplendorPrompt(currentPokemonSplendorView);
}

function openPokemonSplendorTokenModal() {
  if (!pokemonSplendorTokenModal) {
    return;
  }
  resetPokemonSplendorTokenSelection();
  renderPokemonSplendorTokenModal(currentPokemonSplendorView);
  updatePokemonSplendorDiscardHint(currentPokemonSplendorView);
  updatePokemonSplendorActionButtons();
  setModalVisible(pokemonSplendorTokenModal, true);
}

function closePokemonSplendorTokenModal() {
  if (!pokemonSplendorTokenModal) {
    return;
  }
  setModalVisible(pokemonSplendorTokenModal, false);
  resetPokemonSplendorTokenSelection();
  renderPokemonSplendorTokenModal(currentPokemonSplendorView);
  updatePokemonSplendorDiscardHint(currentPokemonSplendorView);
  updatePokemonSplendorActionButtons();
}

function pokemonSplendorTokenRemaining(view, color) {
  const supply = (view && view.tokens_supply) || {};
  const selected = pokemonSplendorTokenSelection[color] || 0;
  return Math.max(0, (supply[color] || 0) - selected);
}

function pokemonSplendorHasPairSelection() {
  return pokemonSplendorBaseColors.some((color) => (pokemonSplendorTokenSelection[color] || 0) === 2);
}

function pokemonSplendorCanAddToken(view, color) {
  if (!view) {
    return false;
  }
  if (!pokemonSplendorBaseColors.includes(color)) {
    return false;
  }
  const remaining = pokemonSplendorTokenRemaining(view, color);
  if (remaining <= 0) {
    return false;
  }
  const current = pokemonSplendorTokenSelection[color] || 0;
  const total = pokemonSplendorTokenSelectionTotal();
  if (total >= 3) {
    return false;
  }
  if (current >= 2) {
    return false;
  }
  if (current + 1 === 2 && (view.tokens_supply || {})[color] < 4) {
    return false;
  }
  if (pokemonSplendorHasPairSelection() && current === 0) {
    return false;
  }
  if (total + 1 === 3) {
    if (current + 1 > 1) {
      return false;
    }
    if (pokemonSplendorBaseColors.some((c) => (pokemonSplendorTokenSelection[c] || 0) > 1)) {
      return false;
    }
  }
  return true;
}

function renderPokemonSplendorTokenModal(view) {
  if (pokemonSplendorTokenSelection.purple) {
    pokemonSplendorTokenSelection.purple = 0;
  }
  if (!pokemonSplendorTokenPool || !pokemonSplendorTokenPicked) {
    return;
  }
  pokemonSplendorTokenPool.innerHTML = "";
  pokemonSplendorTokenPicked.innerHTML = "";

  pokemonSplendorBaseColors.forEach((color) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `pokemon-token-btn gem-${color}`;
    const remaining = pokemonSplendorTokenRemaining(view, color);
    appendPokemonSplendorColorValue(btn, color, remaining, { includeLabel: true });
    btn.title = `Add ${pokemonSplendorColorLabels[color]} token`;
    btn.disabled = !pokemonSplendorCanAddToken(view, color);
    btn.addEventListener("click", () => {
      if (!pokemonSplendorCanAddToken(view, color)) {
        return;
      }
      adjustPokemonSplendorTokenSelection(color, 1);
    });
    pokemonSplendorTokenPool.appendChild(btn);
  });

  let pickedCount = 0;
  pokemonSplendorBaseColors.forEach((color) => {
    const count = pokemonSplendorTokenSelection[color] || 0;
    for (let idx = 0; idx < count; idx += 1) {
      pickedCount += 1;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `pokemon-token-chip gem-${color}`;
      chip.appendChild(createPokemonSplendorColorDot(color));
      const removeText = document.createElement("span");
      removeText.textContent = pokemonSplendorColorLabels[color];
      chip.appendChild(removeText);
      chip.setAttribute("aria-label", `Remove ${pokemonSplendorColorLabels[color]} token`);
      chip.title = "Click to remove";
      chip.addEventListener("click", () => {
        adjustPokemonSplendorTokenSelection(color, -1);
      });
      pokemonSplendorTokenPicked.appendChild(chip);
    }
  });
  if (!pickedCount) {
    const empty = document.createElement("div");
    empty.className = "pokemon-token-empty";
    empty.textContent = "None";
    pokemonSplendorTokenPicked.appendChild(empty);
  }

  if (pokemonSplendorTokenHint) {
    const canTakeDifferent = Boolean(pokemonSplendorTokenGainForAction(view, "take_tokens"));
    const canTakePair = Boolean(pokemonSplendorTokenGainForAction(view, "take_tokens_same"));
    if (canTakeDifferent) {
      pokemonSplendorTokenHint.textContent = "Ready: take the selected different colors.";
      pokemonSplendorTokenHint.dataset.state = "ready";
    } else if (canTakePair) {
      pokemonSplendorTokenHint.textContent = "Ready: take two tokens of this color.";
      pokemonSplendorTokenHint.dataset.state = "ready";
    } else if (pickedCount) {
      pokemonSplendorTokenHint.textContent = "Keep picking, or click a picked token to remove it.";
      pokemonSplendorTokenHint.dataset.state = "picking";
    } else {
      pokemonSplendorTokenHint.textContent = "Pick three different colors, or pick the same color twice.";
      pokemonSplendorTokenHint.dataset.state = "picking";
    }
  }

  updatePokemonSplendorTokenConfirmButtons(view);
}

function updatePokemonSplendorTokenConfirmButtons(view) {
  const legal = (view && view.legal_actions) || [];
  if (pokemonSplendorConfirmThreeBtn) {
    const gain = pokemonSplendorTokenGainForAction(view, "take_tokens");
    pokemonSplendorConfirmThreeBtn.disabled = !legal.includes("take_tokens") || !gain;
  }
  if (pokemonSplendorConfirmTwoBtn) {
    const gain = pokemonSplendorTokenGainForAction(view, "take_tokens_same");
    pokemonSplendorConfirmTwoBtn.disabled = !legal.includes("take_tokens_same") || !gain;
  }
}

function renderPokemonSplendorDiscardSelection() {
  renderPokemonSplendorDiscardSelectionInto(pokemonSplendorDiscardSelectionEl);
  renderPokemonSplendorDiscardSelectionInto(pokemonSplendorDiscardSelectionModal);
}

function renderPokemonSplendorDiscardSelectionInto(container) {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  pokemonSplendorColors.forEach((color) => {
    const wrapper = document.createElement("div");
    wrapper.className = `token-picker gem-${color}`;
    const requirement = getPokemonSplendorPendingDiscardRequirement(currentPokemonSplendorView);
    const player = currentPokemonSplendorView
      ? findPokemonSplendorPlayer(currentPokemonSplendorView, currentPokemonSplendorView.you)
      : null;
    const held = (player && player.tokens && player.tokens[color]) || 0;
    const gained = (requirement && requirement.gain && requirement.gain[color]) || 0;
    const available = held + gained;
    const selected = pokemonSplendorDiscardSelection[color] || 0;
    const selectedTotal = pokemonSplendorDiscardSelectionTotal();
    const label = document.createElement("span");
    label.className = "pokemon-discard-label";
    label.appendChild(createPokemonSplendorColorDot(color));
    const labelText = document.createElement("span");
    labelText.textContent = pokemonSplendorColorLabels[color];
    label.appendChild(labelText);
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", `Discard one fewer ${pokemonSplendorColorLabels[color]} token`);
    minus.disabled = selected <= 0;
    minus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustPokemonSplendorDiscardSelection(color, -1);
    });
    const count = document.createElement("span");
    count.className = "pokemon-discard-count";
    count.textContent = `${selected} / ${available}`;
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", `Discard one more ${pokemonSplendorColorLabels[color]} token`);
    plus.disabled =
      !requirement ||
      requirement.excess <= 0 ||
      selected >= available ||
      selectedTotal >= requirement.excess;
    plus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustPokemonSplendorDiscardSelection(color, 1);
    });
    wrapper.appendChild(label);
    wrapper.appendChild(minus);
    wrapper.appendChild(count);
    wrapper.appendChild(plus);
    container.appendChild(wrapper);
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
    appendPokemonSplendorColorValue(chip, color, value);
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
    return null;
  }
  const row = document.createElement("div");
  row.className = "pokemon-card-requirements";
  const label = document.createElement("span");
  label.textContent = "Needs";
  row.appendChild(label);
  entries.forEach(([color, value]) => {
    const chip = document.createElement("span");
    chip.className = `pokemon-requirement-chip gem-${color}`;
    appendPokemonSplendorColorValue(chip, color, value);
    row.appendChild(chip);
  });
  return row;
}

function makePokemonSplendorCardInteractive(cardEl, onSelect) {
  if (!cardEl || typeof onSelect !== "function") {
    return;
  }
  const trigger = cardEl.querySelector(".pokemon-card-select-trigger");
  if (trigger) {
    trigger.addEventListener("click", onSelect);
  }
}

function focusPokemonSplendorCardAction() {
  if (!pokemonSplendorPanel) {
    return;
  }
  const action = pokemonSplendorPanel.querySelector(
    ".pokemon-card.has-action-layer .pokemon-card-action:not(:disabled), .pokemon-card.has-action-layer .pokemon-card-select-trigger"
  );
  if (action) {
    action.focus({ preventScroll: true });
  }
}

function addPokemonSplendorEvolutionHighlight(cardEl, label) {
  if (!cardEl) {
    return;
  }
  const meta = cardEl.querySelector(".card-meta");
  if (meta) {
    const badge = document.createElement("span");
    badge.className = "pokemon-card-evolution-label";
    badge.textContent = label;
    meta.appendChild(badge);
  }
  const currentLabel = cardEl.getAttribute("aria-label") || "Pokemon card";
  cardEl.setAttribute("aria-label", `${currentLabel}. ${label}`);
  const trigger = cardEl.querySelector(".pokemon-card-select-trigger");
  if (trigger) {
    const triggerLabel = trigger.getAttribute("aria-label") || currentLabel;
    trigger.setAttribute("aria-label", `${triggerLabel}. ${label}`);
  }
}

function addPokemonSplendorCardActionLayer(cardEl, label, actions) {
  if (!cardEl || !Array.isArray(actions) || !actions.length) {
    return;
  }
  cardEl.classList.add("has-action-layer");
  const selectTrigger = cardEl.querySelector(".pokemon-card-select-trigger");
  if (selectTrigger) {
    selectTrigger.setAttribute("aria-expanded", "true");
  }

  const layer = document.createElement("div");
  layer.className = "pokemon-card-action-layer";
  layer.setAttribute("role", "group");
  layer.setAttribute("aria-label", "Card actions");

  const prompt = document.createElement("strong");
  prompt.className = "pokemon-card-action-prompt";
  prompt.textContent = label;
  layer.appendChild(prompt);

  const actionRow = document.createElement("div");
  actionRow.className = "pokemon-card-action-row";
  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pokemon-card-action${action.primary ? " primary" : ""}`;
    button.textContent = action.label;
    button.disabled = !action.enabled;
    if (action.title) {
      button.title = action.title;
    }
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!button.disabled && typeof action.run === "function") {
        action.run();
      }
    });
    actionRow.appendChild(button);
  });
  layer.appendChild(actionRow);

  const closeHint = document.createElement("button");
  closeHint.type = "button";
  closeHint.className = "pokemon-card-action-close-hint";
  closeHint.textContent = "Close";
  closeHint.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (selectTrigger) {
      selectTrigger.click();
    }
  });
  layer.appendChild(closeHint);
  cardEl.appendChild(layer);
}

function createPokemonSplendorCard(card, selected, options = {}) {
  const interactive = Boolean(card) && options.interactive !== false;
  const wrapper = document.createElement("article");
  if (interactive) {
    wrapper.dataset.interactive = "true";
  }
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
    wrapper.textContent = "No cards";
    wrapper.setAttribute("aria-label", "No cards available");
    return wrapper;
  }

  const tier = card.tier || options.tier;
  if (pokemonSplendorTierLabels[tier]) {
    wrapper.classList.add(`pokemon-card-tier-${tier}`);
  }
  if (options.disabled) {
    wrapper.classList.add("pokemon-card-disabled");
    wrapper.setAttribute("aria-disabled", "true");
  }

  const heading = document.createElement("div");
  heading.className = "pokemon-card-heading";

  const title = document.createElement("div");
  title.className = "card-title";
  const nameEn = card.name_en || card.name || card.id;
  const nameZh = card.name && card.name !== card.name_en ? card.name : "";
  const primaryName = document.createElement("strong");
  primaryName.textContent = nameZh || nameEn;
  title.appendChild(primaryName);
  if (nameZh) {
    const secondaryName = document.createElement("span");
    secondaryName.textContent = nameEn;
    title.appendChild(secondaryName);
  }
  heading.appendChild(title);

  const tierBadge = document.createElement("span");
  tierBadge.className = "pokemon-card-tier-badge";
  tierBadge.textContent = card.tier_label || pokemonSplendorTierLabel(tier);
  heading.appendChild(tierBadge);
  wrapper.appendChild(heading);

  const meta = document.createElement("div");
  meta.className = "card-meta";
  const points = typeof card.points === "number" ? card.points : 0;
  const pointsEl = document.createElement("span");
  pointsEl.className = "pokemon-card-points";
  pointsEl.textContent = `VP ${points}`;
  meta.appendChild(pointsEl);
  if (card.bonus) {
    const bonusEl = document.createElement("span");
    bonusEl.className = `pokemon-card-bonus gem-${card.bonus}`;
    appendPokemonSplendorColorValue(bonusEl, card.bonus, "Bonus", { includeLabel: false });
    bonusEl.querySelector("span:last-child").textContent = "Bonus";
    bonusEl.setAttribute("aria-label", `${pokemonSplendorColorLabels[card.bonus]} bonus`);
    meta.appendChild(bonusEl);
  }
  if (card.affordable) {
    const affordable = document.createElement("span");
    affordable.className = "pokemon-card-affordable-label";
    affordable.textContent = "Catchable";
    meta.appendChild(affordable);
  }
  wrapper.appendChild(meta);

  if (card.evolution && card.evolution.targets && card.evolution.targets.length) {
    const evo = document.createElement("div");
    evo.className = "pokemon-card-evo";
    const evoLabel = document.createElement("span");
    evoLabel.className = "pokemon-card-evo-label";
    evoLabel.textContent = "Evolves to";
    evo.appendChild(evoLabel);
    const targets = document.createElement("span");
    targets.className = "pokemon-card-evo-targets";
    const targetsZh = Array.isArray(card.evolution.targets_zh) ? card.evolution.targets_zh : [];
    targets.textContent = card.evolution.targets
      .map((target, index) => (targetsZh[index] ? `${targetsZh[index]} (${target})` : target))
      .join(" / ");
    evo.appendChild(targets);
    const requirements = createPokemonSplendorRequirements(card.evolution.requirements);
    if (requirements) {
      evo.appendChild(requirements);
    }
    wrapper.appendChild(evo);
  }

  wrapper.appendChild(createPokemonSplendorCostRow(card.cost || {}));
  const accessibleLabel = `${pokemonSplendorCardDisplayName(card, true)}, ${
    card.tier_label || pokemonSplendorTierLabel(tier)
  }, ${points} victory points`;
  wrapper.setAttribute("aria-label", accessibleLabel);
  if (interactive) {
    const selectTrigger = document.createElement("button");
    selectTrigger.type = "button";
    selectTrigger.className = "pokemon-card-select-trigger";
    selectTrigger.setAttribute("aria-label", `Select ${accessibleLabel}`);
    selectTrigger.setAttribute("aria-pressed", selected ? "true" : "false");
    selectTrigger.setAttribute("aria-expanded", selected ? "true" : "false");
    selectTrigger.disabled = Boolean(options.disabled);
    wrapper.appendChild(selectTrigger);
  }
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
    appendPokemonSplendorColorValue(token, color, count, { includeLabel: true });
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
      const empty = createPokemonSplendorCard(null, false, { compact: false, interactive: false });
      empty.classList.add("pokemon-card-empty");
      container.appendChild(empty);
      return;
    }
    cards.forEach((card, index) => {
      const selected =
        pokemonSplendorSelectedMarket && pokemonSplendorSelectedMarket.tier === tier && pokemonSplendorSelectedMarket.index === index;
      const legal = view.legal_actions || [];
      const isYourTurn = view.current_turn === view.you;
      const evolutionMode = isYourTurn && view.phase === "evolution" && legal.includes("skip_evolution");
      const turnMode = isYourTurn && view.phase === "turn";
      const targetOptions = pokemonSplendorEvolutionOptionsForTarget(view, "market", tier, index);
      const interactive = turnMode || (evolutionMode && targetOptions.length > 0);
      const cardEl = createPokemonSplendorCard(card, selected, { interactive });
      cardEl.classList.add("pokemon-market-card");
      if (evolutionMode && targetOptions.length) {
        cardEl.classList.add("pokemon-evolution-target-option");
        const matchesSelectedBase =
          pokemonSplendorSelectedBase && targetOptions.some((option) => option.base_id === pokemonSplendorSelectedBase);
        if (matchesSelectedBase) {
          cardEl.classList.add("pokemon-evolution-target-match");
        }
        addPokemonSplendorEvolutionHighlight(cardEl, matchesSelectedBase ? "Ready target" : "Evolution target");
      } else if (evolutionMode) {
        cardEl.classList.add("pokemon-card-unavailable");
      }
      if (selected && turnMode) {
        const canCatch = legal.includes("buy_market") && Boolean(card.affordable);
        const reservableTier = ["lv1", "lv2", "lv3"].includes(tier);
        const actions = [
          {
            label: "Catch",
            enabled: canCatch,
            primary: true,
            title: canCatch ? "Catch this Pokemon." : "You cannot afford this Pokemon yet.",
            run: () => pokemonSplendorBuyMarketBtn && pokemonSplendorBuyMarketBtn.click(),
          },
        ];
        if (reservableTier) {
          const canReserve = legal.includes("reserve_market");
          actions.push({
            label: "Reserve",
            enabled: canReserve,
            title: canReserve ? "Reserve this Pokemon." : "You cannot reserve another Pokemon now.",
            run: () => pokemonSplendorReserveMarketBtn && pokemonSplendorReserveMarketBtn.click(),
          });
        }
        addPokemonSplendorCardActionLayer(cardEl, "Choose action", actions);
      } else if (selected && evolutionMode) {
        const canEvolve = legal.includes("evolve") && Boolean(findPokemonSplendorEvolutionOption(view));
        addPokemonSplendorCardActionLayer(
          cardEl,
          canEvolve ? "Evolution ready" : "Choose a highlighted base",
          [
            {
              label: "Evolve",
              enabled: canEvolve,
              primary: true,
              title: canEvolve ? "Confirm this evolution." : "Choose a matching captured Pokemon first.",
              run: () => pokemonSplendorEvolveBtn && pokemonSplendorEvolveBtn.click(),
            },
          ]
        );
      }
      if (!interactive) {
        container.appendChild(cardEl);
        return;
      }
      makePokemonSplendorCardInteractive(cardEl, () => {
        const wasSelected =
          pokemonSplendorSelectedMarket &&
          pokemonSplendorSelectedMarket.tier === tier &&
          pokemonSplendorSelectedMarket.index === index;
        pokemonSplendorSelectedMarket = wasSelected ? null : { tier, index, cardId: card.id };
        pokemonSplendorSelectedReserved = null;
        resetPokemonSplendorDiscardSelection();
        if (!wasSelected && evolutionMode) {
          const selectedBaseOption = targetOptions.find((option) => option.base_id === pokemonSplendorSelectedBase);
          if (selectedBaseOption) {
            pokemonSplendorSelectedBase = selectedBaseOption.base_id;
          } else if (targetOptions.length === 1) {
            pokemonSplendorSelectedBase = targetOptions[0].base_id;
          } else {
            pokemonSplendorSelectedBase = null;
          }
        }
        refreshPokemonSplendorSelectionUI(view);
        focusPokemonSplendorCardAction();
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
    const legal = view.legal_actions || [];
    const isYourTurn = view.current_turn === view.you;
    const evolutionMode = isYourTurn && view.phase === "evolution" && legal.includes("skip_evolution");
    const turnMode = isYourTurn && view.phase === "turn";
    const targetOptions = pokemonSplendorEvolutionOptionsForTarget(view, "reserved", null, index);
    const interactive = turnMode || (evolutionMode && targetOptions.length > 0);
    const cardEl = createPokemonSplendorCard(card, selected, { interactive });
    cardEl.classList.add("pokemon-reserved-card");
    if (evolutionMode && targetOptions.length) {
      cardEl.classList.add("pokemon-evolution-target-option");
      const matchesSelectedBase =
        pokemonSplendorSelectedBase && targetOptions.some((option) => option.base_id === pokemonSplendorSelectedBase);
      if (matchesSelectedBase) {
        cardEl.classList.add("pokemon-evolution-target-match");
      }
      addPokemonSplendorEvolutionHighlight(cardEl, matchesSelectedBase ? "Ready target" : "Evolution target");
    } else if (evolutionMode) {
      cardEl.classList.add("pokemon-card-unavailable");
    }
    if (selected && turnMode) {
      const canCatch = legal.includes("buy_reserved") && Boolean(card.affordable);
      addPokemonSplendorCardActionLayer(cardEl, "Reserved Pokemon", [
        {
          label: "Catch",
          enabled: canCatch,
          primary: true,
          title: canCatch ? "Catch this reserved Pokemon." : "You cannot afford this Pokemon yet.",
          run: () => pokemonSplendorBuyReservedBtn && pokemonSplendorBuyReservedBtn.click(),
        },
      ]);
    } else if (selected && evolutionMode) {
      const canEvolve = legal.includes("evolve") && Boolean(findPokemonSplendorEvolutionOption(view));
      addPokemonSplendorCardActionLayer(
        cardEl,
        canEvolve ? "Evolution ready" : "Choose a highlighted base",
        [
          {
            label: "Evolve",
            enabled: canEvolve,
            primary: true,
            title: canEvolve ? "Confirm this evolution." : "Choose a matching captured Pokemon first.",
            run: () => pokemonSplendorEvolveBtn && pokemonSplendorEvolveBtn.click(),
          },
        ]
      );
    }
    if (!interactive) {
      pokemonSplendorReserved.appendChild(cardEl);
      return;
    }
    makePokemonSplendorCardInteractive(cardEl, () => {
      const wasSelected = pokemonSplendorSelectedReserved === index;
      pokemonSplendorSelectedReserved = wasSelected ? null : index;
      pokemonSplendorSelectedMarket = null;
      resetPokemonSplendorDiscardSelection();
      if (!wasSelected && evolutionMode) {
        const selectedBaseOption = targetOptions.find((option) => option.base_id === pokemonSplendorSelectedBase);
        if (selectedBaseOption) {
          pokemonSplendorSelectedBase = selectedBaseOption.base_id;
        } else if (targetOptions.length === 1) {
          pokemonSplendorSelectedBase = targetOptions[0].base_id;
        } else {
          pokemonSplendorSelectedBase = null;
        }
      }
      refreshPokemonSplendorSelectionUI(view);
      focusPokemonSplendorCardAction();
    });
    pokemonSplendorReserved.appendChild(cardEl);
  });
  if (!cards.length) {
    const empty = createPokemonSplendorCard(null, false, { compact: false, interactive: false });
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
    const legal = view.legal_actions || [];
    const evolutionMode =
      view.current_turn === view.you && view.phase === "evolution" && legal.includes("skip_evolution");
    const evolutionOptions = pokemonSplendorEvolutionOptionsForBase(view, card.id);
    const interactive = evolutionMode && evolutionOptions.length > 0;
    const cardEl = createPokemonSplendorCard(card, selected, { compact: true, interactive });
    cardEl.classList.add("pokemon-captured-card");
    if (interactive) {
      cardEl.classList.add("pokemon-evolution-base-option");
      addPokemonSplendorEvolutionHighlight(cardEl, "Can evolve");
    } else if (evolutionMode) {
      cardEl.classList.add("pokemon-card-unavailable");
    }
    if (
      selected &&
      evolutionMode &&
      !pokemonSplendorSelectedMarket &&
      pokemonSplendorSelectedReserved === null
    ) {
      addPokemonSplendorCardActionLayer(cardEl, "Choose a highlighted target", [
        {
          label: "Evolve",
          enabled: false,
          primary: true,
          title: "Choose a matching market or reserved Pokemon next.",
        },
      ]);
    }
    if (!interactive) {
      pokemonSplendorCaptured.appendChild(cardEl);
      return;
    }
    makePokemonSplendorCardInteractive(cardEl, () => {
      const wasSelected = pokemonSplendorSelectedBase === card.id;
      if (wasSelected) {
        pokemonSplendorSelectedBase = null;
        pokemonSplendorSelectedMarket = null;
        pokemonSplendorSelectedReserved = null;
      } else {
        pokemonSplendorSelectedBase = card.id;
        if (!findPokemonSplendorEvolutionOption(view)) {
          pokemonSplendorSelectedMarket = null;
          pokemonSplendorSelectedReserved = null;
        }
      }
      refreshPokemonSplendorSelectionUI(view);
      focusPokemonSplendorCardAction();
    });
    pokemonSplendorCaptured.appendChild(cardEl);
  });
  if (!cards.length) {
    const empty = createPokemonSplendorCard(null, false, { compact: true, interactive: false });
    empty.classList.add("pokemon-card-empty");
    pokemonSplendorCaptured.appendChild(empty);
  }
}

function refreshPokemonSplendorSelectionUI(view) {
  renderPokemonSplendorMarket(view);
  renderPokemonSplendorReserved(view);
  renderPokemonSplendorCaptured(view);
  updatePokemonSplendorSelectionLabels();
  renderPokemonSplendorDiscardSelection();
  updatePokemonSplendorDiscardHint(view);
  updatePokemonSplendorActionButtons();
  updatePokemonSplendorPrompt(view);
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
    name.textContent = `${player.name || player.player_id}${youTag}`;
    if (player.player_id === view.starting_player) {
      const kantoTag = document.createElement("span");
      kantoTag.className = "pokemon-first-player-badge";
      kantoTag.textContent = "Kanto";
      name.appendChild(kantoTag);
    }
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
      appendPokemonSplendorColorValue(token, color, count);
      tokensLine.appendChild(token);
    });

    const bonusLine = document.createElement("div");
    bonusLine.className = "pokemon-player-bonuses";
    const bonusesLabel = document.createElement("span");
    bonusesLabel.textContent = "Bonuses";
    bonusLine.appendChild(bonusesLabel);
    pokemonSplendorBaseColors.forEach((color) => {
      const bonus = document.createElement("span");
      bonus.className = `pokemon-player-bonus gem-${color}`;
      appendPokemonSplendorColorValue(bonus, color, (player.bonuses && player.bonuses[color]) || 0);
      bonusLine.appendChild(bonus);
    });

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
        const cardEl = createPokemonSplendorCard(cardData, false, { compact: true, interactive: false });
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
  const card = cards[pokemonSplendorSelectedMarket.index] || null;
  if (card && pokemonSplendorSelectedMarket.cardId && card.id !== pokemonSplendorSelectedMarket.cardId) {
    return null;
  }
  return card;
}

function getPokemonSplendorSelectedReservedCard(view) {
  if (pokemonSplendorSelectedReserved === null || !view) {
    return null;
  }
  const cards = view.your_reserved || [];
  return cards[pokemonSplendorSelectedReserved] || null;
}

function pokemonSplendorEvolutionOptionsForBase(view, baseId) {
  if (!view || !baseId || !Array.isArray(view.evolution_options)) {
    return [];
  }
  return view.evolution_options.filter((option) => option.base_id === baseId);
}

function pokemonSplendorEvolutionOptionsForTarget(view, source, tier, index) {
  if (!view || !Array.isArray(view.evolution_options)) {
    return [];
  }
  return view.evolution_options.filter((option) => {
    if (option.source !== source) {
      return false;
    }
    if (source === "market") {
      return option.tier === tier && option.index === index;
    }
    return option.reserved_index === index;
  });
}

function selectPokemonSplendorEvolutionOption(option, view) {
  if (!option || !view) {
    return;
  }
  pokemonSplendorSelectedBase = option.base_id;
  if (option.source === "market") {
    const card = ((view.market && view.market[option.tier]) || [])[option.index];
    pokemonSplendorSelectedMarket = {
      tier: option.tier,
      index: option.index,
      cardId: card ? card.id : option.target_id,
    };
    pokemonSplendorSelectedReserved = null;
  } else {
    pokemonSplendorSelectedReserved = option.reserved_index;
    pokemonSplendorSelectedMarket = null;
  }
}

function reconcilePokemonSplendorSelections(view) {
  if (!view) {
    return;
  }
  if (pokemonSplendorSelectedMarket && !getPokemonSplendorSelectedMarketCard(view)) {
    pokemonSplendorSelectedMarket = null;
  }
  if (pokemonSplendorSelectedReserved !== null && !getPokemonSplendorSelectedReservedCard(view)) {
    pokemonSplendorSelectedReserved = null;
  }
  if (pokemonSplendorSelectedBase && !findPokemonSplendorCapturedById(view, pokemonSplendorSelectedBase)) {
    pokemonSplendorSelectedBase = null;
  }
  if (view.phase !== "evolution") {
    pokemonSplendorSelectedBase = null;
    return;
  }
  if (pokemonSplendorSelectedMarket) {
    const options = pokemonSplendorEvolutionOptionsForTarget(
      view,
      "market",
      pokemonSplendorSelectedMarket.tier,
      pokemonSplendorSelectedMarket.index
    );
    if (!options.length || (pokemonSplendorSelectedBase && !options.some((option) => option.base_id === pokemonSplendorSelectedBase))) {
      pokemonSplendorSelectedMarket = null;
    }
  }
  if (pokemonSplendorSelectedReserved !== null) {
    const options = pokemonSplendorEvolutionOptionsForTarget(view, "reserved", null, pokemonSplendorSelectedReserved);
    if (!options.length || (pokemonSplendorSelectedBase && !options.some((option) => option.base_id === pokemonSplendorSelectedBase))) {
      pokemonSplendorSelectedReserved = null;
    }
  }
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
  const isYourTurn = Boolean(view && view.current_turn === view.you && !view.game_over);
  const showTurnActions = isYourTurn && view.phase === "turn";
  const showEvolutionActions = isYourTurn && view.phase === "evolution";
  const showDiscardAction = isYourTurn && view.phase === "discard_tokens";

  [pokemonSplendorTakeTokensBtn, pokemonSplendorReserveDeckBtn, pokemonSplendorBuyMarketBtn, pokemonSplendorReserveMarketBtn, pokemonSplendorBuyReservedBtn].forEach(
    (button) => {
      if (button) {
        button.classList.toggle("hidden", !showTurnActions);
      }
    }
  );
  [pokemonSplendorEvolveBtn, pokemonSplendorSkipEvolveBtn].forEach((button) => {
    if (button) {
      button.classList.toggle("hidden", !showEvolutionActions);
    }
  });
  if (pokemonSplendorDiscardBtn) {
    pokemonSplendorDiscardBtn.classList.toggle("hidden", !showDiscardAction);
  }

  if (pokemonSplendorTakeTokensBtn) {
    pokemonSplendorTakeTokensBtn.disabled = !legal.includes("take_tokens") && !legal.includes("take_tokens_same");
    pokemonSplendorTakeTokensBtn.title = pokemonSplendorTakeTokensBtn.disabled ? "Token taking is not available." : "Choose tokens.";
  }
  if (
    !legal.includes("take_tokens") &&
    !legal.includes("take_tokens_same") &&
    pokemonSplendorTokenModal &&
    !pokemonSplendorTokenModal.classList.contains("hidden")
  ) {
    closePokemonSplendorTokenModal();
  }
  if (pokemonSplendorReserveMarketBtn) {
    const canReserveMarket =
      legal.includes("reserve_market") &&
      pokemonSplendorSelectedMarket &&
      ["lv1", "lv2", "lv3"].includes(pokemonSplendorSelectedMarket.tier);
    pokemonSplendorReserveMarketBtn.disabled = !canReserveMarket;
    pokemonSplendorReserveMarketBtn.textContent = selectedMarketCard
      ? `Reserve ${pokemonSplendorCardDisplayName(selectedMarketCard)}`
      : "Reserve Selected";
    pokemonSplendorReserveMarketBtn.title = canReserveMarket
      ? "Reserve this market Pokemon and take a Master token if available."
      : "Select an LV1, LV2, or LV3 market Pokemon first.";
  }
  if (pokemonSplendorReserveDeckBtn) {
    pokemonSplendorReserveDeckBtn.disabled = !legal.includes("reserve_deck");
    pokemonSplendorReserveDeckBtn.title = pokemonSplendorReserveDeckBtn.disabled
      ? "You cannot reserve from a deck now."
      : "Choose an LV1, LV2, or LV3 deck.";
  }
  if (!legal.includes("reserve_deck")) {
    closePokemonSplendorReserveMenu();
  }
  if (pokemonSplendorBuyMarketBtn) {
    pokemonSplendorBuyMarketBtn.disabled =
      !legal.includes("buy_market") || !selectedMarketCard || !selectedMarketCard.affordable;
    pokemonSplendorBuyMarketBtn.textContent = selectedMarketCard
      ? `Catch ${pokemonSplendorCardDisplayName(selectedMarketCard)}`
      : "Catch Selected";
    pokemonSplendorBuyMarketBtn.title = pokemonSplendorBuyMarketBtn.disabled
      ? "Select a market Pokemon you can afford."
      : "Catch the selected market Pokemon.";
  }
  if (pokemonSplendorBuyReservedBtn) {
    pokemonSplendorBuyReservedBtn.disabled =
      !legal.includes("buy_reserved") || !selectedReservedCard || !selectedReservedCard.affordable;
    pokemonSplendorBuyReservedBtn.textContent = selectedReservedCard
      ? `Catch ${pokemonSplendorCardDisplayName(selectedReservedCard)}`
      : "Catch Reserved";
    pokemonSplendorBuyReservedBtn.title = pokemonSplendorBuyReservedBtn.disabled
      ? "Select a reserved Pokemon you can afford."
      : "Catch the selected reserved Pokemon.";
  }
  if (pokemonSplendorEvolveBtn) {
    const evolveOption = findPokemonSplendorEvolutionOption(view);
    pokemonSplendorEvolveBtn.disabled = !legal.includes("evolve") || !evolveOption;
    const baseCard = findPokemonSplendorCapturedById(view, pokemonSplendorSelectedBase);
    const targetCard = selectedMarketCard || selectedReservedCard;
    pokemonSplendorEvolveBtn.textContent =
      evolveOption && baseCard && targetCard
        ? `Evolve ${pokemonSplendorCardDisplayName(baseCard)} → ${pokemonSplendorCardDisplayName(targetCard)}`
        : "Evolve";
    pokemonSplendorEvolveBtn.title = pokemonSplendorEvolveBtn.disabled
      ? "Choose a highlighted base and evolution target."
      : "Confirm this evolution.";
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

function updatePokemonSplendorPrompt(view) {
  if (!pokemonSplendorPrompt) {
    return;
  }
  let message = "Waiting for the game state.";
  let tone = "neutral";
  const currentPlayer = view ? findPokemonSplendorPlayer(view, view.current_turn) : null;
  const currentName = currentPlayer ? currentPlayer.name || currentPlayer.player_id : "the current player";

  if (!view) {
    // Keep the default waiting message.
  } else if (view.game_over) {
    const winnerNames = (view.winner || []).map((playerId) => {
      const player = findPokemonSplendorPlayer(view, playerId);
      return player ? player.name || player.player_id : playerId;
    });
    message = winnerNames.length ? `Game over. Winner: ${winnerNames.join(", ")}.` : "Game over.";
    tone = "done";
  } else if (view.current_turn !== view.you) {
    message = `Waiting for ${currentName}. You can review the market while they play.`;
    tone = "waiting";
  } else if (view.phase === "discard_tokens") {
    const requirement = getPokemonSplendorPendingDiscardRequirement(view);
    const excess = requirement ? requirement.excess : 0;
    const selected = pokemonSplendorDiscardSelectionTotal();
    message = `Choose ${excess} token${excess === 1 ? "" : "s"} to return (${selected}/${excess} selected).`;
    tone = selected === excess && excess > 0 ? "ready" : "warning";
  } else if (view.phase === "evolution") {
    const baseCard = findPokemonSplendorCapturedById(view, pokemonSplendorSelectedBase);
    const targetCard = getPokemonSplendorSelectedMarketCard(view) || getPokemonSplendorSelectedReservedCard(view);
    const option = findPokemonSplendorEvolutionOption(view);
    if (option && baseCard && targetCard) {
      message = `${pokemonSplendorCardDisplayName(baseCard)} → ${pokemonSplendorCardDisplayName(targetCard)} is ready. Confirm or skip evolution.`;
      tone = "ready";
    } else if (baseCard) {
      message = `${pokemonSplendorCardDisplayName(baseCard)} selected. Choose a highlighted evolution target.`;
      tone = "action";
    } else if (targetCard) {
      message = `${pokemonSplendorCardDisplayName(targetCard)} selected. Choose a highlighted base Pokemon.`;
      tone = "action";
    } else {
      message = "Evolution is available. Choose a highlighted captured Pokemon and its highlighted target, or skip.";
      tone = "action";
    }
  } else {
    const marketCard = getPokemonSplendorSelectedMarketCard(view);
    const reservedCard = getPokemonSplendorSelectedReservedCard(view);
    if (marketCard) {
      const actions = [];
      if (marketCard.affordable) {
        actions.push("catch it");
      }
      if (["lv1", "lv2", "lv3"].includes(marketCard.tier) && (view.legal_actions || []).includes("reserve_market")) {
        actions.push("reserve it");
      }
      message = actions.length
        ? `${pokemonSplendorCardDisplayName(marketCard)} selected — ${actions.join(" or ")}.`
        : `${pokemonSplendorCardDisplayName(marketCard)} selected, but it cannot be caught or reserved now.`;
      tone = actions.length ? "ready" : "warning";
    } else if (reservedCard) {
      message = reservedCard.affordable
        ? `${pokemonSplendorCardDisplayName(reservedCard)} selected — ready to catch.`
        : `${pokemonSplendorCardDisplayName(reservedCard)} selected, but you cannot afford it yet.`;
      tone = reservedCard.affordable ? "ready" : "warning";
    } else {
      message = "Choose one action: take tokens, select a Pokemon to catch or reserve, or reserve from a deck.";
      tone = "action";
    }
  }

  pokemonSplendorPrompt.textContent = message;
  pokemonSplendorPrompt.dataset.tone = tone;
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

  reconcilePokemonSplendorSelections(view);

  if (pokemonSplendorPhaseLabel) {
    const phaseLabels = {
      turn: "Main action",
      evolution: "Evolution",
      discard_tokens: "Discard",
      game_over: "Game over",
    };
    pokemonSplendorPhaseLabel.textContent = phaseLabels[view.phase] || view.phase || "-";
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
  renderPokemonSplendorTokenModal(view);
  renderPokemonSplendorDiscardSelection();
  updatePokemonSplendorDiscardHint(view);
  updatePokemonSplendorActionButtons();
  updatePokemonSplendorPrompt(view);
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
      !event.target.closest("#pokemonSplendorReserveDeckBtn") &&
      !event.target.closest(".pokemon-discard-row")
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
      event.target.closest(".splendor-card")
    ) {
      return;
    }
    clearPokemonSplendorSelection();
  });
}

if (pokemonSplendorTakeTokensBtn) {
  pokemonSplendorTakeTokensBtn.addEventListener("click", () => {
    if (pokemonSplendorTakeTokensBtn.disabled) {
      return;
    }
    openPokemonSplendorTokenModal();
  });
}

if (pokemonSplendorConfirmThreeBtn) {
  pokemonSplendorConfirmThreeBtn.addEventListener("click", () => {
    const view = currentPokemonSplendorView;
    if (!view) {
      return;
    }
    const gain = pokemonSplendorTokenGainForAction(view, "take_tokens");
    if (!gain) {
      log("Pick valid different colors");
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
    closePokemonSplendorTokenModal();
    clearPokemonSplendorSelection();
  });
}

if (pokemonSplendorConfirmTwoBtn) {
  pokemonSplendorConfirmTwoBtn.addEventListener("click", () => {
    const view = currentPokemonSplendorView;
    if (!view) {
      return;
    }
    const gain = pokemonSplendorTokenGainForAction(view, "take_tokens_same");
    if (!gain) {
      log("Pick 2 of the same color");
      return;
    }
    const color = pokemonSplendorBaseColors.find((c) => gain[c] === 2);
    if (!color) {
      log("Pick a color to take 2 tokens");
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
    closePokemonSplendorTokenModal();
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
  closePokemonSplendorTokenModal();
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

if (pokemonSplendorHelpModal) {
  pokemonSplendorHelpModal.addEventListener("click", (event) => {
    if (event.target === pokemonSplendorHelpModal) {
      closePokemonSplendorHelpModal();
    }
  });
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

if (pokemonSplendorExplainModal) {
  pokemonSplendorExplainModal.addEventListener("click", (event) => {
    if (event.target === pokemonSplendorExplainModal) {
      closePokemonSplendorExplainModal();
    }
  });
}

if (pokemonSplendorTokenModalCloseBtn) {
  pokemonSplendorTokenModalCloseBtn.addEventListener("click", closePokemonSplendorTokenModal);
}

if (pokemonSplendorTokenModal) {
  pokemonSplendorTokenModal.addEventListener("click", (event) => {
    if (event.target === pokemonSplendorTokenModal) {
      closePokemonSplendorTokenModal();
    }
  });
}

document.addEventListener(
  "click",
  (event) => {
    if (!pokemonSplendorExplainMode) {
      return;
    }
    const tokenPicker = event.target.closest(".token-picker");
    const card = event.target.closest(".pokemon-market-card, .pokemon-reserved-card, .pokemon-captured-card");
    const button = event.target.closest("button");
    const target = tokenPicker || card || button;
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
  if (event.target.closest(".pokemon-discard-row")) {
    return;
  }
  closePokemonSplendorReserveMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  let handled = false;
  if (pokemonSplendorReserveMenu && !pokemonSplendorReserveMenu.classList.contains("hidden")) {
    closePokemonSplendorReserveMenu();
    handled = true;
  }
  if (pokemonSplendorTokenModal && !pokemonSplendorTokenModal.classList.contains("hidden")) {
    closePokemonSplendorTokenModal();
    handled = true;
  }
  if (pokemonSplendorHelpModal && !pokemonSplendorHelpModal.classList.contains("hidden")) {
    closePokemonSplendorHelpModal();
    handled = true;
  }
  if (pokemonSplendorExplainModal && !pokemonSplendorExplainModal.classList.contains("hidden")) {
    closePokemonSplendorExplainModal();
    handled = true;
  }
  if (pokemonSplendorExplainMode) {
    exitPokemonSplendorExplainMode();
    handled = true;
  }
  if (
    !handled &&
    (pokemonSplendorSelectedMarket || pokemonSplendorSelectedReserved !== null || pokemonSplendorSelectedBase)
  ) {
    clearPokemonSplendorSelection();
  }
});
