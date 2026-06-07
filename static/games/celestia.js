let currentCelestiaView = null;
let celestiaSelectedCardId = null;
let celestiaSelectedTreasureId = null;
let celestiaSelectedTargetPlayerId = null;
let celestiaSelectedDiceIndexes = [];
let celestiaExplainMode = false;
let celestiaSuppressClickButtonId = null;

const celestiaHeaderActions = document.getElementById("celestiaHeaderActions");
const celestiaHelpBtn = document.getElementById("celestiaHelpBtn");
const celestiaExplainBtn = document.getElementById("celestiaExplainBtn");
const celestiaHelpModal = document.getElementById("celestiaHelpModal");
const celestiaHelpModalCloseBtn = document.getElementById("celestiaHelpModalCloseBtn");
const celestiaHelpContent = document.getElementById("celestiaHelpContent");
const celestiaExplainModal = document.getElementById("celestiaExplainModal");
const celestiaExplainModalCloseBtn = document.getElementById("celestiaExplainModalCloseBtn");
const celestiaExplainContent = document.getElementById("celestiaExplainContent");

const celestiaPhaseLabel = document.getElementById("celestiaPhase");
const celestiaJourneyLabel = document.getElementById("celestiaJourney");
const celestiaCaptainLabel = document.getElementById("celestiaCaptain");
const celestiaCurrentCityLabel = document.getElementById("celestiaCurrentCity");
const celestiaNextCityLabel = document.getElementById("celestiaNextCity");
const celestiaRequiredDiceLabel = document.getElementById("celestiaRequiredDice");
const celestiaYourScoreLabel = document.getElementById("celestiaYourScore");
const celestiaReadyCountLabel = document.getElementById("celestiaReadyCount");
const celestiaWinnerLabel = document.getElementById("celestiaWinner");
const celestiaSummary = document.getElementById("celestiaSummary");
const celestiaSummaryBody = document.getElementById("celestiaSummaryBody");
const celestiaSummaryRewards = document.getElementById("celestiaSummaryRewards");
const celestiaRoute = document.getElementById("celestiaRoute");
const celestiaDice = document.getElementById("celestiaDice");
const celestiaHand = document.getElementById("celestiaHand");
const celestiaTreasures = document.getElementById("celestiaTreasures");
const celestiaSelection = document.getElementById("celestiaSelection");
const celestiaRollBtn = document.getElementById("celestiaRollBtn");
const celestiaSoloLeaveBtn = document.getElementById("celestiaSoloLeaveBtn");
const celestiaStayBtn = document.getElementById("celestiaStayBtn");
const celestiaLeaveBtn = document.getElementById("celestiaLeaveBtn");
const celestiaPlayPowerBtn = document.getElementById("celestiaPlayPowerBtn");
const celestiaPassSpecialBtn = document.getElementById("celestiaPassSpecialBtn");
const celestiaResolveCardsBtn = document.getElementById("celestiaResolveCardsBtn");
const celestiaResolveTelescopeBtn = document.getElementById("celestiaResolveTelescopeBtn");
const celestiaCrashBtn = document.getElementById("celestiaCrashBtn");
const celestiaJetpackUseBtn = document.getElementById("celestiaJetpackUseBtn");
const celestiaJetpackSkipBtn = document.getElementById("celestiaJetpackSkipBtn");
const celestiaNextJourneyBtn = document.getElementById("celestiaNextJourneyBtn");
const celestiaPlayAgainBtn = document.getElementById("celestiaPlayAgainBtn");
const celestiaPlayers = document.getElementById("celestiaPlayers");

const CELESTIA_DICE_ICONS = {
  cloud: "☁️",
  lightning: "⚡",
  bird: "🐦",
  pirate: "🏴‍☠️",
  blank: "⬜",
};

const CELESTIA_EQUIPMENT_FOR_HAZARD = {
  cloud: "compass",
  lightning: "lightning_rod",
  bird: "foghorn",
  pirate: "cannon",
};

const CELESTIA_PHASE_LABELS = {
  roll: "Roll Dice",
  reroll_window: "Reroll Window",
  passenger_choice: "Passenger Choice",
  ejection_window: "Ejection Window",
  captain_action: "Captain Action",
  jetpack_window: "Jetpack Window",
  journey_end: "Journey End",
  game_over: "Game Over",
};

const CELESTIA_HELP_TEXT = `
<h3>Goal</h3>
<p>Collect treasures across journeys. When a player reaches the target score after a journey ends, the highest score wins.</p>

<h3>Journey</h3>
<ol>
  <li>The captain rolls dice for the next city.</li>
  <li>Passengers choose to stay on the airship or leave and take treasure from the current city.</li>
  <li>The captain must cover each hazard with matching equipment, Turbo cards, or a Magic Spyglass when legal.</li>
  <li>If the captain cannot resolve the hazards, the ship crashes and only Jetpack users can still take treasure.</li>
</ol>

<h3>Power Cards</h3>
<p>Alternative Route rerolls selected dice for the captain. Wind Gust rerolls all blanks. Ejection removes a passenger and gives them current-city treasure. Jetpack can save you after a crash.</p>
`;

const CELESTIA_BUTTON_EXPLANATIONS = {
  celestiaRollBtn: {
    name: "Roll Dice",
    description: "Roll dice as the captain to reveal the hazards for the next city.",
  },
  celestiaSoloLeaveBtn: {
    name: "Solo Leave",
    description: "Leave safely when you are the only player still on the ship and take current-city treasure.",
  },
  celestiaStayBtn: {
    name: "Stay",
    description: "Stay on the ship as the pending passenger and continue toward the next city.",
  },
  celestiaLeaveBtn: {
    name: "Leave",
    description: "Leave the ship now and take a treasure from the current city.",
  },
  celestiaPlayPowerBtn: {
    name: "Play Selected Power",
    description: "Play the selected power card. Alternative Route also needs selected dice; Ejection needs a selected target player.",
  },
  celestiaPassSpecialBtn: {
    name: "Pass",
    description: "Pass during a special-card window without playing a power card.",
  },
  celestiaResolveCardsBtn: {
    name: "Use Cards",
    description: "Resolve all hazards with matching equipment cards and Turbo cards.",
  },
  celestiaResolveTelescopeBtn: {
    name: "Use Telescope",
    description: "Resolve hazards with a selected or available Magic Spyglass treasure when normal cards are not enough.",
  },
  celestiaCrashBtn: {
    name: "Crash",
    description: "Declare that the captain cannot resolve the hazards. The ship crashes and normal passengers get no treasure.",
  },
  celestiaJetpackSkipBtn: {
    name: "Skip Jetpack",
    description: "Decline to use Jetpack after a crash and take no treasure from that crash.",
  },
  celestiaNextJourneyBtn: {
    name: "Next Journey",
    description: "Mark yourself ready after a journey ends. The next journey starts after all players are ready.",
  },
  celestiaPlayAgainBtn: {
    name: "Play Again",
    description: "Restart the game after the game is over.",
  },
};

const celestiaActionButtons = {
  roll_dice: celestiaRollBtn,
  solo_leave: celestiaSoloLeaveBtn,
  pass_special: celestiaPassSpecialBtn,
  captain_resolve_cards: celestiaResolveCardsBtn,
  captain_resolve_telescope: celestiaResolveTelescopeBtn,
  captain_fail: celestiaCrashBtn,
  jetpack_use: celestiaJetpackUseBtn,
  jetpack_skip: celestiaJetpackSkipBtn,
  next_journey: celestiaNextJourneyBtn,
  play_again: celestiaPlayAgainBtn,
};

const CELESTIA_DYNAMIC_EXPLANATIONS = {
  jetpack_card: {
    name: "Jetpack Card",
    description: "Play this Jetpack after a crash to take a treasure from the current city.",
  },
};

function formatCelestiaPhase(phase) {
  return CELESTIA_PHASE_LABELS[phase] || phase || "-";
}

function celestiaHasAction(actionType) {
  return !!(
    currentCelestiaView &&
    Array.isArray(currentCelestiaView.legal_actions) &&
    currentCelestiaView.legal_actions.includes(actionType)
  );
}

function isCelestiaJetpackPlayable(card) {
  return !!(card && card.kind === "jetpack" && celestiaHasAction("jetpack_decision"));
}

function formatCelestiaHazards(view) {
  const counts = (view && view.hazard_counts) || {};
  const parts = ["cloud", "lightning", "bird", "pirate"]
    .filter((hazard) => (counts[hazard] || 0) > 0)
    .map((hazard) => `${CELESTIA_DICE_ICONS[hazard] || ""} ${counts[hazard]}`);
  return parts.length ? parts.join(" · ") : "No hazards";
}

function renderCelestiaRoute(view) {
  if (!celestiaRoute) {
    return;
  }
  celestiaRoute.innerHTML = "";
  for (let city = 1; city <= 9; city += 1) {
    const tile = document.createElement("div");
    tile.className = "celestia-city";
    if (city === view.current_city) {
      tile.classList.add("current");
    }
    if (city === view.next_city) {
      tile.classList.add("next");
    }

    const name = document.createElement("div");
    name.className = "celestia-city-name";
    name.textContent = `City ${city}`;
    tile.appendChild(name);

    const meta = document.createElement("div");
    meta.className = "celestia-city-meta";
    const treasureCount = view.treasure_counts ? view.treasure_counts[String(city)] : null;
    meta.textContent = `Treasure ${treasureCount ?? "-"} · Dice ${city <= 4 ? 2 : city <= 7 ? 3 : 4}`;
    tile.appendChild(meta);

    celestiaRoute.appendChild(tile);
  }
}

function renderCelestiaDice(view) {
  if (!celestiaDice) {
    return;
  }
  celestiaDice.innerHTML = "";
  const dice = Array.isArray(view.dice_results) ? view.dice_results : [];
  if (!dice.length) {
    const empty = document.createElement("div");
    empty.className = "celestia-empty";
    empty.textContent = "No dice";
    celestiaDice.appendChild(empty);
    return;
  }
  dice.forEach((face, index) => {
    const die = document.createElement("button");
    die.type = "button";
    die.className = "celestia-die";
    if (celestiaSelectedDiceIndexes.includes(index)) {
      die.classList.add("selected");
    }
    die.textContent = `${CELESTIA_DICE_ICONS[face] || "?"} ${face}`;
    die.addEventListener("click", () => {
      if (celestiaSelectedDiceIndexes.includes(index)) {
        celestiaSelectedDiceIndexes = celestiaSelectedDiceIndexes.filter((item) => item !== index);
      } else {
        celestiaSelectedDiceIndexes = [...celestiaSelectedDiceIndexes, index];
      }
      renderCelestiaDice(currentCelestiaView);
      updateCelestiaSelection();
      updateCelestiaActionButtons();
    });
    celestiaDice.appendChild(die);
  });
}

function renderCelestiaHand(view) {
  if (!celestiaHand) {
    return;
  }
  celestiaHand.innerHTML = "";
  const hand = Array.isArray(view.your_hand) ? view.your_hand : [];
  if (!hand.length) {
    const empty = document.createElement("div");
    empty.className = "celestia-empty";
    empty.textContent = "No hand cards";
    celestiaHand.appendChild(empty);
    return;
  }
  hand.forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `celestia-card ${card.category || ""}`;
    const jetpackPlayable = isCelestiaJetpackPlayable(card);
    if (jetpackPlayable) {
      button.classList.add("action-allowed");
      button.dataset.celestiaExplainId = "jetpack_card";
      if (celestiaExplainMode) {
        button.classList.add("has-explanation");
      }
    } else if (card.id === celestiaSelectedCardId) {
      button.classList.add("selected");
    }

    const title = document.createElement("div");
    title.className = "celestia-card-title";
    title.textContent = `${card.symbol || ""} ${card.label || card.kind || "Card"}`;
    button.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "celestia-card-meta";
    meta.textContent = jetpackPlayable ? "Play after crash" : card.category || "-";
    button.appendChild(meta);

    button.addEventListener("click", () => {
      if (jetpackPlayable) {
        sendAction({ type: "jetpack_decision", use: true });
        return;
      }
      celestiaSelectedCardId = celestiaSelectedCardId === card.id ? null : card.id;
      renderCelestiaHand(currentCelestiaView);
      updateCelestiaSelection();
      updateCelestiaActionButtons();
    });
    celestiaHand.appendChild(button);
  });
}

function renderCelestiaTreasures(view) {
  if (!celestiaTreasures) {
    return;
  }
  celestiaTreasures.innerHTML = "";
  const treasures = Array.isArray(view.your_treasures) ? view.your_treasures : [];
  if (!treasures.length) {
    const empty = document.createElement("div");
    empty.className = "celestia-empty";
    empty.textContent = "No treasures";
    celestiaTreasures.appendChild(empty);
    return;
  }
  treasures.forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "celestia-card treasure";
    if (card.id === celestiaSelectedTreasureId) {
      button.classList.add("selected");
    }
    const title = document.createElement("div");
    title.className = "celestia-card-title";
    title.textContent = card.label || `Treasure ${card.points ?? 0}`;
    button.appendChild(title);
    const meta = document.createElement("div");
    meta.className = "celestia-card-meta";
    meta.textContent = `City ${card.city ?? "-"} · ${card.kind || "points"}`;
    button.appendChild(meta);
    button.addEventListener("click", () => {
      celestiaSelectedTreasureId = celestiaSelectedTreasureId === card.id ? null : card.id;
      renderCelestiaTreasures(currentCelestiaView);
      updateCelestiaSelection();
      updateCelestiaActionButtons();
    });
    celestiaTreasures.appendChild(button);
  });
}

function renderCelestiaPlayers(view) {
  if (!celestiaPlayers) {
    return;
  }
  celestiaPlayers.innerHTML = "";
  if (!Array.isArray(view.players)) {
    return;
  }
  view.players.forEach((player) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "celestia-player";
    if (player.player_id === celestiaSelectedTargetPlayerId) {
      button.classList.add("selected");
    }

    const name = document.createElement("div");
    name.className = "celestia-player-name";
    const tags = [];
    if (player.player_id === view.you) {
      tags.push("you");
    }
    if (player.player_id === view.captain) {
      tags.push("captain");
    }
    tags.push(player.on_ship ? "ship" : "left");
    name.textContent = `${player.name || player.player_id}${tags.length ? ` (${tags.join(", ")})` : ""}`;
    button.appendChild(name);

    const meta = document.createElement("div");
    meta.className = "celestia-player-meta";
    const score = player.score_hidden ? "hidden" : player.score ?? 0;
    meta.textContent = `Hand ${player.hand_count ?? 0} · Treasures ${player.treasure_count ?? 0} · Score ${score}`;
    button.appendChild(meta);

    button.addEventListener("click", () => {
      celestiaSelectedTargetPlayerId =
        celestiaSelectedTargetPlayerId === player.player_id ? null : player.player_id;
      renderCelestiaPlayers(currentCelestiaView);
      updateCelestiaSelection();
      updateCelestiaActionButtons();
    });
    celestiaPlayers.appendChild(button);
  });
}

function renderCelestiaSummary(view) {
  if (!celestiaSummary || !celestiaSummaryBody || !celestiaSummaryRewards) {
    return;
  }
  const summary = view.journey_summary;
  if (!summary || !summary.reason) {
    celestiaSummary.classList.add("hidden");
    celestiaSummary.setAttribute("aria-hidden", "true");
    celestiaSummaryBody.textContent = "-";
    celestiaSummaryRewards.innerHTML = "";
    return;
  }
  celestiaSummary.classList.remove("hidden");
  celestiaSummary.setAttribute("aria-hidden", "false");
  const reason = String(summary.reason).replace(/_/g, " ");
  const captain = summary.captain ? findPlayerName(view, summary.captain) : "-";
  celestiaSummaryBody.textContent = `${reason} at City ${summary.city ?? "-"} · Captain ${captain}`;
  celestiaSummaryRewards.innerHTML = "";
  (summary.rewards || []).forEach((reward) => {
    const item = document.createElement("div");
    item.className = "celestia-card treasure";
    const playerName = findPlayerName(view, reward.player_id);
    const treasure = reward.treasure ? reward.treasure.label || `Treasure ${reward.treasure.points ?? 0}` : "No treasure";
    item.textContent = `${playerName}: ${treasure}`;
    celestiaSummaryRewards.appendChild(item);
  });
}

function updateCelestiaSelection() {
  if (!celestiaSelection) {
    return;
  }
  const hand = (currentCelestiaView && currentCelestiaView.your_hand) || [];
  const treasures = (currentCelestiaView && currentCelestiaView.your_treasures) || [];
  const selectedCard = hand.find((card) => card.id === celestiaSelectedCardId);
  const selectedTreasure = treasures.find((card) => card.id === celestiaSelectedTreasureId);
  const selectedTarget = currentCelestiaView && celestiaSelectedTargetPlayerId
    ? findPlayerName(currentCelestiaView, celestiaSelectedTargetPlayerId)
    : null;
  const parts = [];
  if (selectedCard) {
    parts.push(`Card: ${selectedCard.label || selectedCard.kind}`);
  }
  if (selectedTreasure) {
    parts.push(`Treasure: ${selectedTreasure.label || selectedTreasure.kind}`);
  }
  if (celestiaSelectedDiceIndexes.length) {
    parts.push(`Dice: ${celestiaSelectedDiceIndexes.map((idx) => idx + 1).join(", ")}`);
  }
  if (selectedTarget) {
    parts.push(`Target: ${selectedTarget}`);
  }
  celestiaSelection.textContent = parts.length ? `Selected: ${parts.join(" · ")}` : "Selected: -";
}

function canPlaySelectedCelestiaPower() {
  if (!celestiaHasAction("play_power")) {
    return false;
  }
  const hand = (currentCelestiaView && currentCelestiaView.your_hand) || [];
  const card = hand.find((item) => item.id === celestiaSelectedCardId);
  if (!card || card.category !== "power") {
    return false;
  }
  if (card.kind === "alternative_route") {
    return celestiaSelectedDiceIndexes.length > 0;
  }
  if (card.kind === "ejection") {
    return !!celestiaSelectedTargetPlayerId;
  }
  return card.kind === "wind_gust";
}

function getCelestiaHandCounts() {
  const counts = {};
  const hand = (currentCelestiaView && currentCelestiaView.your_hand) || [];
  hand.forEach((card) => {
    counts[card.kind] = (counts[card.kind] || 0) + 1;
  });
  return counts;
}

function celestiaNormalResolutionPossible() {
  const counts = getCelestiaHandCounts();
  const hazards = (currentCelestiaView && currentCelestiaView.hazard_counts) || {};
  return ["cloud", "lightning", "bird", "pirate"].every((hazard) => {
    const need = hazards[hazard] || 0;
    return (counts[CELESTIA_EQUIPMENT_FOR_HAZARD[hazard]] || 0) >= need;
  });
}

function celestiaFullResolutionPossible() {
  const counts = getCelestiaHandCounts();
  let turboLeft = counts.turbo || 0;
  const hazards = (currentCelestiaView && currentCelestiaView.hazard_counts) || {};
  return ["cloud", "lightning", "bird", "pirate"].every((hazard) => {
    const need = hazards[hazard] || 0;
    const normal = Math.min(counts[CELESTIA_EQUIPMENT_FOR_HAZARD[hazard]] || 0, need);
    turboLeft -= Math.max(0, need - normal);
    return turboLeft >= 0;
  });
}

function canResolveWithTelescope() {
  if (!celestiaHasAction("captain_resolve")) {
    return false;
  }
  if (celestiaNormalResolutionPossible()) {
    return false;
  }
  const treasures = (currentCelestiaView && currentCelestiaView.your_treasures) || [];
  return treasures.some((card) => card.kind === "telescope");
}

function canResolveWithCards() {
  return celestiaHasAction("captain_resolve") && celestiaFullResolutionPossible();
}

function updateCelestiaActionButtons() {
  Object.values(celestiaActionButtons).forEach((button) => {
    if (!button) {
      return;
    }
    button.classList.remove("action-allowed");
    button.disabled = true;
  });
  if (currentGameType !== "celestia" || !currentCelestiaView) {
    if (celestiaStayBtn) {
      celestiaStayBtn.disabled = true;
      celestiaStayBtn.classList.remove("action-allowed");
    }
    if (celestiaLeaveBtn) {
      celestiaLeaveBtn.disabled = true;
      celestiaLeaveBtn.classList.remove("action-allowed");
    }
    if (celestiaPlayPowerBtn) {
      celestiaPlayPowerBtn.disabled = true;
      celestiaPlayPowerBtn.classList.remove("action-allowed");
    }
    return;
  }

  const states = [
    { el: celestiaRollBtn, allowed: celestiaHasAction("roll_dice") },
    { el: celestiaSoloLeaveBtn, allowed: celestiaHasAction("solo_leave") },
    { el: celestiaStayBtn, allowed: celestiaHasAction("passenger_choice") },
    { el: celestiaLeaveBtn, allowed: celestiaHasAction("passenger_choice") },
    { el: celestiaPlayPowerBtn, allowed: canPlaySelectedCelestiaPower() },
    { el: celestiaPassSpecialBtn, allowed: celestiaHasAction("pass_special") },
    { el: celestiaResolveCardsBtn, allowed: canResolveWithCards() },
    { el: celestiaResolveTelescopeBtn, allowed: canResolveWithTelescope() },
    { el: celestiaCrashBtn, allowed: celestiaHasAction("captain_fail") },
    { el: celestiaJetpackSkipBtn, allowed: celestiaHasAction("jetpack_decision") },
    { el: celestiaNextJourneyBtn, allowed: celestiaHasAction("next_journey") },
    { el: celestiaPlayAgainBtn, allowed: celestiaHasAction("play_again") },
  ];
  states.forEach(({ el, allowed }) => {
    if (!el) {
      return;
    }
    el.disabled = !allowed;
    el.classList.toggle("action-allowed", allowed);
  });
  if (celestiaJetpackUseBtn) {
    celestiaJetpackUseBtn.classList.add("hidden");
    celestiaJetpackUseBtn.disabled = true;
    celestiaJetpackUseBtn.classList.remove("action-allowed", "has-explanation");
  }
}

function clearCelestiaState() {
  currentCelestiaView = null;
  celestiaSelectedCardId = null;
  celestiaSelectedTreasureId = null;
  celestiaSelectedTargetPlayerId = null;
  celestiaSelectedDiceIndexes = [];
  [
    celestiaPhaseLabel,
    celestiaJourneyLabel,
    celestiaCaptainLabel,
    celestiaCurrentCityLabel,
    celestiaNextCityLabel,
    celestiaRequiredDiceLabel,
    celestiaYourScoreLabel,
    celestiaReadyCountLabel,
    celestiaWinnerLabel,
  ].forEach((label) => {
    if (label) {
      label.textContent = "-";
    }
  });
  [celestiaRoute, celestiaDice, celestiaHand, celestiaTreasures, celestiaPlayers, celestiaSummaryRewards].forEach((el) => {
    if (el) {
      el.innerHTML = "";
    }
  });
  if (celestiaSummary) {
    celestiaSummary.classList.add("hidden");
    celestiaSummary.setAttribute("aria-hidden", "true");
  }
  updateCelestiaSelection();
  updateCelestiaActionButtons();
}

function renderCelestiaGameState(data) {
  const view = data.view || {};
  currentCelestiaView = view;
  if (currentGameType !== "celestia") {
    currentGameType = "celestia";
    setGamePanelVisibility("celestia");
  }

  if (celestiaPhaseLabel) {
    celestiaPhaseLabel.textContent = formatCelestiaPhase(view.phase);
  }
  if (celestiaJourneyLabel) {
    celestiaJourneyLabel.textContent = view.journey_no ?? "-";
  }
  if (celestiaCaptainLabel) {
    celestiaCaptainLabel.textContent = view.captain ? findPlayerName(view, view.captain) : "-";
  }
  if (celestiaCurrentCityLabel) {
    celestiaCurrentCityLabel.textContent = view.current_city ?? "-";
  }
  if (celestiaNextCityLabel) {
    celestiaNextCityLabel.textContent = view.next_city ?? "-";
  }
  if (celestiaRequiredDiceLabel) {
    celestiaRequiredDiceLabel.textContent = view.required_dice ?? "-";
  }
  if (celestiaYourScoreLabel) {
    celestiaYourScoreLabel.textContent = view.your_score ?? "-";
  }
  if (celestiaReadyCountLabel) {
    const ready = Array.isArray(view.next_ready) ? view.next_ready.length : 0;
    const total = Array.isArray(view.players) ? view.players.length : 0;
    celestiaReadyCountLabel.textContent = `${ready}/${total}`;
  }
  if (celestiaWinnerLabel) {
    celestiaWinnerLabel.textContent =
      Array.isArray(view.winner) && view.winner.length
        ? view.winner.map((pid) => findPlayerName(view, pid)).join(", ")
        : "-";
  }

  renderCelestiaSummary(view);
  renderCelestiaRoute(view);
  renderCelestiaDice(view);
  renderCelestiaHand(view);
  renderCelestiaTreasures(view);
  renderCelestiaPlayers(view);
  updateCelestiaSelection();
  updateCelestiaActionButtons();
  logGameEvents(data);
}

function showCelestiaHeaderActions(show) {
  if (celestiaHeaderActions) {
    celestiaHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitCelestiaExplainMode();
    closeCelestiaExplainModal();
  }
}

function openCelestiaHelp() {
  if (celestiaHelpContent) {
    celestiaHelpContent.innerHTML = CELESTIA_HELP_TEXT;
  }
  if (typeof setModalVisible === "function") {
    setModalVisible(celestiaHelpModal, true);
  }
}

function updateCelestiaExplainModeClasses(enabled) {
  Object.keys(CELESTIA_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.classList.toggle("has-explanation", enabled);
    }
  });
  const panel = document.getElementById("celestiaPanel");
  if (panel) {
    panel.querySelectorAll("[data-celestia-explain-id]").forEach((button) => {
      button.classList.toggle("has-explanation", enabled);
    });
  }
}

function findCelestiaExplainButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(CELESTIA_BUTTON_EXPLANATIONS)) {
    const button = document.getElementById(buttonId);
    if (!button || button.classList.contains("hidden")) {
      continue;
    }
    const rect = button.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  const panel = document.getElementById("celestiaPanel");
  if (panel) {
    const dynamicButtons = panel.querySelectorAll("[data-celestia-explain-id]");
    for (const button of dynamicButtons) {
      const rect = button.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return button.dataset.celestiaExplainId;
      }
    }
  }
  return null;
}

function toggleCelestiaExplainMode() {
  celestiaExplainMode = !celestiaExplainMode;
  document.body.classList.toggle("celestia-explain-mode", celestiaExplainMode);
  updateCelestiaExplainModeClasses(celestiaExplainMode);
  if (celestiaExplainBtn) {
    celestiaExplainBtn.classList.toggle("active", celestiaExplainMode);
  }
}

function exitCelestiaExplainMode() {
  if (!celestiaExplainMode) {
    return;
  }
  celestiaExplainMode = false;
  document.body.classList.remove("celestia-explain-mode");
  updateCelestiaExplainModeClasses(false);
  if (celestiaExplainBtn) {
    celestiaExplainBtn.classList.remove("active");
  }
}

function showCelestiaButtonExplanation(buttonId) {
  const explanation = CELESTIA_BUTTON_EXPLANATIONS[buttonId] || CELESTIA_DYNAMIC_EXPLANATIONS[buttonId];
  if (!explanation || !celestiaExplainContent || !celestiaExplainModal) {
    return;
  }
  const hazards = currentCelestiaView ? `<p>Current hazards: ${formatCelestiaHazards(currentCelestiaView)}</p>` : "";
  celestiaExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    ${hazards}
  `;
  if (typeof setModalVisible === "function") {
    setModalVisible(celestiaExplainModal, true);
  }
}

function closeCelestiaExplainModal() {
  if (typeof setModalVisible === "function") {
    setModalVisible(celestiaExplainModal, false);
  }
}

if (celestiaHelpBtn) {
  celestiaHelpBtn.addEventListener("click", openCelestiaHelp);
}
if (celestiaHelpModalCloseBtn) {
  celestiaHelpModalCloseBtn.addEventListener("click", () => {
    if (typeof setModalVisible === "function") {
      setModalVisible(celestiaHelpModal, false);
    }
  });
}
if (celestiaExplainBtn) {
  celestiaExplainBtn.addEventListener("click", toggleCelestiaExplainMode);
}
if (celestiaExplainModalCloseBtn) {
  celestiaExplainModalCloseBtn.addEventListener("click", closeCelestiaExplainModal);
}

if (celestiaRollBtn) {
  celestiaRollBtn.addEventListener("click", () => sendAction({ type: "roll_dice" }));
}
if (celestiaSoloLeaveBtn) {
  celestiaSoloLeaveBtn.addEventListener("click", () => sendAction({ type: "solo_leave" }));
}
if (celestiaStayBtn) {
  celestiaStayBtn.addEventListener("click", () => sendAction({ type: "passenger_choice", choice: "stay" }));
}
if (celestiaLeaveBtn) {
  celestiaLeaveBtn.addEventListener("click", () => sendAction({ type: "passenger_choice", choice: "leave" }));
}
if (celestiaPlayPowerBtn) {
  celestiaPlayPowerBtn.addEventListener("click", () => {
    const action = { type: "play_power", card_id: celestiaSelectedCardId };
    const hand = (currentCelestiaView && currentCelestiaView.your_hand) || [];
    const card = hand.find((item) => item.id === celestiaSelectedCardId);
    if (card && card.kind === "alternative_route") {
      action.dice_indexes = celestiaSelectedDiceIndexes;
    }
    if (card && card.kind === "ejection") {
      action.target_player_id = celestiaSelectedTargetPlayerId;
    }
    sendAction(action);
  });
}
if (celestiaPassSpecialBtn) {
  celestiaPassSpecialBtn.addEventListener("click", () => sendAction({ type: "pass_special" }));
}
if (celestiaResolveCardsBtn) {
  celestiaResolveCardsBtn.addEventListener("click", () => sendAction({ type: "captain_resolve", method: "cards" }));
}
if (celestiaResolveTelescopeBtn) {
  celestiaResolveTelescopeBtn.addEventListener("click", () => {
    const treasures = (currentCelestiaView && currentCelestiaView.your_treasures) || [];
    const selected = treasures.find((card) => card.id === celestiaSelectedTreasureId && card.kind === "telescope");
    const firstTelescope = treasures.find((card) => card.kind === "telescope");
    sendAction({
      type: "captain_resolve",
      method: "telescope",
      treasure_id: (selected || firstTelescope || {}).id,
    });
  });
}
if (celestiaCrashBtn) {
  celestiaCrashBtn.addEventListener("click", () => sendAction({ type: "captain_fail" }));
}
if (celestiaJetpackUseBtn) {
  celestiaJetpackUseBtn.addEventListener("click", () => sendAction({ type: "jetpack_decision", use: true }));
}
if (celestiaJetpackSkipBtn) {
  celestiaJetpackSkipBtn.addEventListener("click", () => sendAction({ type: "jetpack_decision", use: false }));
}
if (celestiaNextJourneyBtn) {
  celestiaNextJourneyBtn.addEventListener("click", () => sendAction({ type: "next_journey" }));
}
if (celestiaPlayAgainBtn) {
  celestiaPlayAgainBtn.addEventListener("click", () => sendAction({ type: "play_again" }));
}

document.addEventListener("pointerdown", (event) => {
  if (!celestiaExplainMode || currentGameType !== "celestia") {
    return;
  }

  const buttonId = findCelestiaExplainButtonAtPoint(event.clientX, event.clientY);
  if (buttonId) {
    event.preventDefault();
    event.stopPropagation();
    celestiaSuppressClickButtonId = buttonId;
    setTimeout(() => {
      celestiaSuppressClickButtonId = null;
    }, 500);
    showCelestiaButtonExplanation(buttonId);
    exitCelestiaExplainMode();
    return;
  }

  const button = event.target.closest("button");
  if (!button) {
    return;
  }
  if (button === celestiaExplainBtn || button === celestiaHelpBtn) {
    return;
  }
  if (button === celestiaHelpModalCloseBtn || button === celestiaExplainModalCloseBtn) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
}, true);

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  const buttonExplainId = button ? button.id || button.dataset.celestiaExplainId : null;
  if (celestiaSuppressClickButtonId && buttonExplainId === celestiaSuppressClickButtonId) {
    celestiaSuppressClickButtonId = null;
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (!celestiaExplainMode || currentGameType !== "celestia") {
    return;
  }

  if (!button) {
    return;
  }
  if (button === celestiaExplainBtn || button === celestiaHelpBtn) {
    return;
  }
  if (button === celestiaHelpModalCloseBtn || button === celestiaExplainModalCloseBtn) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (celestiaExplainMode) {
      exitCelestiaExplainMode();
    }
    if (celestiaExplainModal && !celestiaExplainModal.classList.contains("hidden")) {
      closeCelestiaExplainModal();
    }
  }
});

window.showCelestiaHeaderActions = showCelestiaHeaderActions;
