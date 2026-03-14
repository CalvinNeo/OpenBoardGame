let pointSaladSelectedPile = null;
let pointSaladSelectedMarket = [];
let pointSaladSelectedFlips = new Set();

let currentPointSaladView = null;

const pointSaladHeaderActions = document.getElementById("pointSaladHeaderActions");
const pointSaladHelpBtn = document.getElementById("pointSaladHelpBtn");
const pointSaladExplainBtn = document.getElementById("pointSaladExplainBtn");
const pointSaladHelpModal = document.getElementById("pointSaladHelpModal");
const pointSaladHelpModalCloseBtn = document.getElementById("pointSaladHelpModalCloseBtn");
const pointSaladExplainModal = document.getElementById("pointSaladExplainModal");
const pointSaladExplainModalCloseBtn = document.getElementById("pointSaladExplainModalCloseBtn");
const pointSaladHelpContent = document.getElementById("pointSaladHelpContent");
const pointSaladExplainContent = document.getElementById("pointSaladExplainContent");

const pointSaladPanel = document.getElementById("pointSaladPanel");
const pointSaladTurnLabel = document.getElementById("pointSaladTurn");
const pointSaladWinnerLabel = document.getElementById("pointSaladWinner");
const pointSaladPiles = document.getElementById("pointSaladPiles");
const pointSaladMarket = document.getElementById("pointSaladMarket");
const pointSaladSelectedPileLabel = document.getElementById("pointSaladSelectedPile");
const pointSaladSelectedVeggiesLabel = document.getElementById("pointSaladSelectedVeggies");
const pointSaladSelectedFlipsLabel = document.getElementById("pointSaladSelectedFlips");
const pointSaladClearSelectionBtn = document.getElementById("pointSaladClearSelectionBtn");
const pointSaladClearFlipsBtn = document.getElementById("pointSaladClearFlipsBtn");
const pointSaladTakePointBtn = document.getElementById("pointSaladTakePointBtn");
const pointSaladTakeVeggiesBtn = document.getElementById("pointSaladTakeVeggiesBtn");
const pointSaladPlayers = document.getElementById("pointSaladPlayers");

const POINT_SALAD_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Score the most points when all cards are taken.</p>

  <h3>Setup</h3>
  <ul>
    <li>Three point-card piles (A/B/C) are face-up.</li>
    <li>Six veggie cards form a 2x3 market.</li>
  </ul>

  <h3>Turn (Choose One)</h3>
  <ul>
    <li><strong>Take Point Card</strong>: choose the top card of one pile and keep it as a point card.</li>
    <li><strong>Take Veggies</strong>: take any 2 veggie cards from the market (if only 1 is left, take 1).</li>
  </ul>

  <h3>Free Action: Flip</h3>
  <p>You may flip any of your point cards to its veggie side at any time. Flips are one-way.</p>

  <h3>End & Scoring</h3>
  <p>When all piles and the market are empty, score all point cards based on your veggie collection.</p>
`;

const POINT_SALAD_BUTTON_EXPLANATIONS = {
  pointSaladClearSelectionBtn: {
    name: "Clear Selection",
    description: "Clear the selected pile and veggie choices.",
  },
  pointSaladClearFlipsBtn: {
    name: "Clear Flips",
    description: "Clear the selected point cards you plan to flip.",
  },
  pointSaladTakePointBtn: {
    name: "Take Point Card",
    description: "Take the top point card from the selected pile.",
  },
  pointSaladTakeVeggiesBtn: {
    name: "Take Veggies",
    description: "Take the selected veggie cards from the market.",
  },
  pointSaladPileCard: {
    name: "Point Pile Card",
    description: "Select a pile to take its top point card.",
  },
  pointSaladMarketCard: {
    name: "Market Veggie",
    description: "Select veggies to take (normally 2, or 1 if only one remains).",
  },
  pointSaladFlipCard: {
    name: "Flip Point Card",
    description: "Select a point card to flip into a veggie (one-way).",
  },
};

function clearPointSaladSelections() {
  pointSaladSelectedPile = null;
  pointSaladSelectedMarket = [];
}

function clearPointSaladFlips() {
  pointSaladSelectedFlips = new Set();
}

function clearPointSaladState() {
  currentPointSaladView = null;
  clearPointSaladSelections();
  clearPointSaladFlips();
  if (pointSaladTurnLabel) {
    pointSaladTurnLabel.textContent = "-";
  }
  if (pointSaladWinnerLabel) {
    pointSaladWinnerLabel.textContent = "-";
  }
  if (pointSaladSelectedPileLabel) {
    pointSaladSelectedPileLabel.textContent = "-";
  }
  if (pointSaladSelectedVeggiesLabel) {
    pointSaladSelectedVeggiesLabel.textContent = "-";
  }
  if (pointSaladSelectedFlipsLabel) {
    pointSaladSelectedFlipsLabel.textContent = "-";
  }
  if (pointSaladPiles) {
    pointSaladPiles.innerHTML = "";
  }
  if (pointSaladMarket) {
    pointSaladMarket.innerHTML = "";
  }
  if (pointSaladPlayers) {
    pointSaladPlayers.innerHTML = "";
  }
  updatePointSaladActionButtons();
}

function pointSaladPileLabel(index) {
  if (!Number.isInteger(index)) {
    return "-";
  }
  return String.fromCharCode(65 + index);
}

function pointSaladPlayerName(view, playerId) {
  const player = (view.players || []).find((entry) => entry.player_id === playerId);
  return player ? player.name || player.player_id : playerId || "-";
}

function syncPointSaladSelections(view) {
  if (!view) {
    clearPointSaladSelections();
    clearPointSaladFlips();
    return;
  }
  if (pointSaladSelectedPile !== null) {
    const pile = (view.piles || [])[pointSaladSelectedPile];
    if (!pile || !pile.top) {
      pointSaladSelectedPile = null;
    }
  }
  const market = view.market || [];
  pointSaladSelectedMarket = pointSaladSelectedMarket.filter((pos) => market[pos]);

  const you = (view.players || []).find((player) => player.player_id === view.you);
  const available = new Set((you && you.point_cards ? you.point_cards : []).map((card) => card.id));
  pointSaladSelectedFlips = new Set(
    Array.from(pointSaladSelectedFlips).filter((cardId) => available.has(cardId))
  );
}

function updatePointSaladSelectionLabels() {
  if (pointSaladSelectedPileLabel) {
    pointSaladSelectedPileLabel.textContent =
      pointSaladSelectedPile === null ? "-" : pointSaladPileLabel(pointSaladSelectedPile);
  }
  if (pointSaladSelectedVeggiesLabel) {
    if (!currentPointSaladView || pointSaladSelectedMarket.length === 0) {
      pointSaladSelectedVeggiesLabel.textContent = "-";
    } else {
      const labels = pointSaladSelectedMarket.map((pos) => {
        const card = currentPointSaladView.market[pos];
        const veg = card ? card.veggie : "empty";
        return `${veg} (${pos + 1})`;
      });
      pointSaladSelectedVeggiesLabel.textContent = labels.join(", ");
    }
  }
  if (pointSaladSelectedFlipsLabel) {
    if (!currentPointSaladView || pointSaladSelectedFlips.size === 0) {
      pointSaladSelectedFlipsLabel.textContent = "-";
    } else {
      const you = (currentPointSaladView.players || []).find(
        (player) => player.player_id === currentPointSaladView.you
      );
      const lookup = new Map(
        (you && you.point_cards ? you.point_cards : []).map((card) => [card.id, card.label || `#${card.id}`])
      );
      const labels = Array.from(pointSaladSelectedFlips).map((cardId) => lookup.get(cardId) || `#${cardId}`);
      pointSaladSelectedFlipsLabel.textContent = labels.join(", ");
    }
  }
}

function updatePointSaladActionButtons() {
  if (!pointSaladTakePointBtn || !pointSaladTakeVeggiesBtn) {
    return;
  }
  if (currentGameType !== "point_salad" || !currentPointSaladView) {
    pointSaladTakePointBtn.disabled = true;
    pointSaladTakeVeggiesBtn.disabled = true;
    return;
  }
  const legal = currentPointSaladView.legal_actions || [];
  const piles = currentPointSaladView.piles || [];
  const canTakePoint =
    legal.includes("take_point") &&
    pointSaladSelectedPile !== null &&
    piles[pointSaladSelectedPile] &&
    piles[pointSaladSelectedPile].top;
  pointSaladTakePointBtn.disabled = !canTakePoint;

  const market = currentPointSaladView.market || [];
  const availableCount = market.filter((card) => card).length;
  const required = availableCount === 1 ? 1 : 2;
  const validSelection =
    pointSaladSelectedMarket.length === required &&
    pointSaladSelectedMarket.every((pos) => market[pos]);
  const canTakeVeggies = legal.includes("take_veggies") && validSelection;
  pointSaladTakeVeggiesBtn.disabled = !canTakeVeggies;
}

function renderPointSaladPiles(view) {
  if (!pointSaladPiles) {
    return;
  }
  pointSaladPiles.innerHTML = "";
  (view.piles || []).forEach((pile, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "point-salad-card";
    if (pointSaladSelectedPile === index) {
      button.classList.add("selected");
    }
    if (!pile || !pile.top) {
      button.classList.add("disabled");
      button.disabled = true;
    }
    const title = document.createElement("div");
    title.className = "point-salad-card-title";
    title.textContent = `Pile ${pointSaladPileLabel(index)}`;
    const label = document.createElement("div");
    label.className = "point-salad-card-meta";
    label.textContent = pile && pile.top ? pile.top.label : "Empty";
    const count = document.createElement("div");
    count.className = "point-salad-card-meta";
    count.textContent = `Count: ${pile ? pile.count : 0}`;
    button.appendChild(title);
    button.appendChild(label);
    button.appendChild(count);
    if (pile && pile.top) {
      button.addEventListener("click", () => {
        pointSaladSelectedPile = index;
        updatePointSaladSelectionLabels();
        renderPointSaladPiles(view);
        updatePointSaladActionButtons();
      });
    }
    pointSaladPiles.appendChild(button);
  });
  if (pointSaladExplainMode) {
    updatePointSaladExplainModeClasses(true);
  }
}

function renderPointSaladMarket(view) {
  if (!pointSaladMarket) {
    return;
  }
  pointSaladMarket.innerHTML = "";
  (view.market || []).forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "point-salad-card";
    if (!card) {
      button.classList.add("disabled");
      button.disabled = true;
    }
    if (pointSaladSelectedMarket.includes(index)) {
      button.classList.add("selected");
    }
    const title = document.createElement("div");
    title.className = "point-salad-card-title";
    title.textContent = card ? card.veggie : "Empty";
    const meta = document.createElement("div");
    meta.className = "point-salad-card-meta";
    meta.textContent = `Slot ${index + 1}`;
    button.appendChild(title);
    button.appendChild(meta);
    if (card) {
      button.addEventListener("click", () => {
        const existing = pointSaladSelectedMarket.indexOf(index);
        if (existing >= 0) {
          pointSaladSelectedMarket.splice(existing, 1);
        } else if (pointSaladSelectedMarket.length < 2) {
          pointSaladSelectedMarket.push(index);
        }
        updatePointSaladSelectionLabels();
        renderPointSaladMarket(view);
        updatePointSaladActionButtons();
      });
    }
    pointSaladMarket.appendChild(button);
  });
  if (pointSaladExplainMode) {
    updatePointSaladExplainModeClasses(true);
  }
}

function renderPointSaladPlayers(view) {
  if (!pointSaladPlayers) {
    return;
  }
  pointSaladPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "point-salad-player";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id;
    header.appendChild(name);
    const badges = document.createElement("div");
    badges.className = "player-badges";
    const score = document.createElement("span");
    score.className = "badge";
    score.textContent = `score ${player.score ?? 0}`;
    badges.appendChild(score);
    if (player.player_id === view.you) {
      const you = document.createElement("span");
      you.className = "badge highlight";
      you.textContent = "you";
      badges.appendChild(you);
    }
    if (player.is_bot) {
      const bot = document.createElement("span");
      bot.className = "badge";
      bot.textContent = "bot";
      badges.appendChild(bot);
    }
    header.appendChild(badges);
    card.appendChild(header);

    const veggies = document.createElement("div");
    veggies.className = "point-salad-card-meta";
    const veggieLabels = (view.veggies || []).map((veg) => `${veg}:${player.veggies ? player.veggies[veg] || 0 : 0}`);
    veggies.textContent = veggieLabels.join(" | ");
    card.appendChild(veggies);

    const cards = document.createElement("div");
    cards.className = "point-salad-card-list";
    (player.point_cards || []).forEach((pointCard) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "point-salad-card-chip";
      const veggieSuffix = pointCard.veggie ? ` (${pointCard.veggie})` : "";
      chip.textContent = `${pointCard.label || `#${pointCard.id}`}${veggieSuffix}`;
      if (player.player_id === view.you && !view.game_over) {
        if (pointSaladSelectedFlips.has(pointCard.id)) {
          chip.classList.add("selected");
        }
        chip.addEventListener("click", () => {
          if (pointSaladSelectedFlips.has(pointCard.id)) {
            pointSaladSelectedFlips.delete(pointCard.id);
          } else {
            pointSaladSelectedFlips.add(pointCard.id);
          }
          updatePointSaladSelectionLabels();
          renderPointSaladPlayers(view);
          updatePointSaladActionButtons();
        });
      } else {
        chip.classList.add("readonly");
        chip.disabled = true;
      }
      cards.appendChild(chip);
    });
    card.appendChild(cards);
    pointSaladPlayers.appendChild(card);
  });
  if (pointSaladExplainMode) {
    updatePointSaladExplainModeClasses(true);
  }
}

function renderPointSaladGameState(data) {
  const view = data.view;
  currentPointSaladView = view;
  if (currentGameType !== "point_salad") {
    currentGameType = "point_salad";
    setGamePanelVisibility("point_salad");
  }

  syncPointSaladSelections(view);
  if (pointSaladTurnLabel) {
    pointSaladTurnLabel.textContent = pointSaladPlayerName(view, view.current_turn);
  }
  if (pointSaladWinnerLabel) {
    if (view.winner && view.winner.length) {
      pointSaladWinnerLabel.textContent = view.winner.map((pid) => pointSaladPlayerName(view, pid)).join(", ");
    } else {
      pointSaladWinnerLabel.textContent = "-";
    }
  }

  updatePointSaladSelectionLabels();
  renderPointSaladPiles(view);
  renderPointSaladMarket(view);
  renderPointSaladPlayers(view);

  logGameEvents(data);
  updatePointSaladActionButtons();
}

if (pointSaladClearSelectionBtn) {
  pointSaladClearSelectionBtn.addEventListener("click", () => {
    clearPointSaladSelections();
    updatePointSaladSelectionLabels();
    if (currentPointSaladView) {
      renderPointSaladPiles(currentPointSaladView);
      renderPointSaladMarket(currentPointSaladView);
    }
    updatePointSaladActionButtons();
  });
}

if (pointSaladClearFlipsBtn) {
  pointSaladClearFlipsBtn.addEventListener("click", () => {
    clearPointSaladFlips();
    updatePointSaladSelectionLabels();
    if (currentPointSaladView) {
      renderPointSaladPlayers(currentPointSaladView);
    }
    updatePointSaladActionButtons();
  });
}

if (pointSaladTakePointBtn) {
  pointSaladTakePointBtn.addEventListener("click", () => {
    if (pointSaladSelectedPile === null) {
      log("Select a pile to take");
      return;
    }
    const action = { type: "take_point", pile_index: pointSaladSelectedPile };
    if (pointSaladSelectedFlips.size) {
      action.flip_ids = Array.from(pointSaladSelectedFlips);
    }
    sendAction(action);
    clearPointSaladSelections();
    clearPointSaladFlips();
    updatePointSaladSelectionLabels();
    updatePointSaladActionButtons();
  });
}

if (pointSaladTakeVeggiesBtn) {
  pointSaladTakeVeggiesBtn.addEventListener("click", () => {
    if (!pointSaladSelectedMarket.length) {
      log("Select veggies to take");
      return;
    }
    const action = { type: "take_veggies", positions: [...pointSaladSelectedMarket] };
    if (pointSaladSelectedFlips.size) {
      action.flip_ids = Array.from(pointSaladSelectedFlips);
    }
    sendAction(action);
    clearPointSaladSelections();
    clearPointSaladFlips();
    updatePointSaladSelectionLabels();
    updatePointSaladActionButtons();
  });
}

let pointSaladExplainMode = false;

function showPointSaladHeaderActions(show) {
  if (pointSaladHeaderActions) {
    pointSaladHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitPointSaladExplainMode();
    closePointSaladHelpModal();
    closePointSaladExplainModal();
  }
}

function showPointSaladHelpModal() {
  if (!pointSaladHelpModal) {
    return;
  }
  if (pointSaladHelpContent) {
    pointSaladHelpContent.innerHTML = POINT_SALAD_HELP_TEXT;
  }
  setModalVisible(pointSaladHelpModal, true);
}

function closePointSaladHelpModal() {
  if (pointSaladHelpModal) {
    setModalVisible(pointSaladHelpModal, false);
  }
}

function updatePointSaladExplainModeClasses(enabled) {
  Object.keys(POINT_SALAD_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    if (buttonId === "pointSaladPileCard" || buttonId === "pointSaladMarketCard" || buttonId === "pointSaladFlipCard") {
      return;
    }
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
  document.querySelectorAll("#pointSaladPiles .point-salad-card").forEach((btn) => {
    btn.classList.toggle("has-explanation", enabled);
  });
  document.querySelectorAll("#pointSaladMarket .point-salad-card").forEach((btn) => {
    btn.classList.toggle("has-explanation", enabled);
  });
  document.querySelectorAll("#pointSaladPlayers .point-salad-card-chip").forEach((btn) => {
    btn.classList.toggle("has-explanation", enabled);
  });
}

function findPointSaladButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(POINT_SALAD_BUTTON_EXPLANATIONS)) {
    if (buttonId === "pointSaladPileCard" || buttonId === "pointSaladMarketCard" || buttonId === "pointSaladFlipCard") {
      continue;
    }
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  const pileButtons = Array.from(document.querySelectorAll("#pointSaladPiles .point-salad-card"));
  for (const btn of pileButtons) {
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return "pointSaladPileCard";
    }
  }
  const marketButtons = Array.from(document.querySelectorAll("#pointSaladMarket .point-salad-card"));
  for (const btn of marketButtons) {
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return "pointSaladMarketCard";
    }
  }
  const flipButtons = Array.from(document.querySelectorAll("#pointSaladPlayers .point-salad-card-chip"));
  for (const btn of flipButtons) {
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return "pointSaladFlipCard";
    }
  }
  return null;
}

function togglePointSaladExplainMode() {
  pointSaladExplainMode = !pointSaladExplainMode;
  document.body.classList.toggle("point-salad-explain-mode", pointSaladExplainMode);
  updatePointSaladExplainModeClasses(pointSaladExplainMode);
  if (pointSaladExplainBtn) {
    pointSaladExplainBtn.classList.toggle("active", pointSaladExplainMode);
  }
}

function exitPointSaladExplainMode() {
  if (!pointSaladExplainMode) {
    return;
  }
  pointSaladExplainMode = false;
  document.body.classList.remove("point-salad-explain-mode");
  updatePointSaladExplainModeClasses(false);
  if (pointSaladExplainBtn) {
    pointSaladExplainBtn.classList.remove("active");
  }
}

function showPointSaladButtonExplanation(buttonId) {
  const explanation = POINT_SALAD_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !pointSaladExplainContent || !pointSaladExplainModal) {
    return;
  }
  const note = explanation.note ? `<div class="hint">${explanation.note}</div>` : "";
  pointSaladExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    ${note}
  `;
  setModalVisible(pointSaladExplainModal, true);
}

function closePointSaladExplainModal() {
  if (pointSaladExplainModal) {
    setModalVisible(pointSaladExplainModal, false);
  }
}

if (pointSaladHelpBtn) {
  pointSaladHelpBtn.addEventListener("click", () => {
    showPointSaladHelpModal();
  });
}

if (pointSaladHelpModalCloseBtn) {
  pointSaladHelpModalCloseBtn.addEventListener("click", closePointSaladHelpModal);
}

if (pointSaladExplainBtn) {
  pointSaladExplainBtn.addEventListener("click", () => {
    togglePointSaladExplainMode();
  });
}

if (pointSaladExplainModalCloseBtn) {
  pointSaladExplainModalCloseBtn.addEventListener("click", closePointSaladExplainModal);
}

document.addEventListener("pointerdown", (e) => {
  if (!pointSaladExplainMode) return;

  const buttonId = findPointSaladButtonAtPoint(e.clientX, e.clientY);
  if (buttonId) {
    e.preventDefault();
    e.stopPropagation();
    showPointSaladButtonExplanation(buttonId);
    exitPointSaladExplainMode();
    return;
  }

  const button = e.target.closest("button");
  if (button === pointSaladExplainBtn || button === pointSaladHelpBtn) return;
  if (button === pointSaladHelpModalCloseBtn || button === pointSaladExplainModalCloseBtn) return;

  if (button) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

document.addEventListener("click", (e) => {
  if (!pointSaladExplainMode) return;

  const button = e.target.closest("button");
  if (!button) return;

  if (button === pointSaladExplainBtn || button === pointSaladHelpBtn) return;
  if (button === pointSaladHelpModalCloseBtn || button === pointSaladExplainModalCloseBtn) return;

  e.preventDefault();
  e.stopPropagation();
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && pointSaladExplainMode) {
    exitPointSaladExplainMode();
  }
});
