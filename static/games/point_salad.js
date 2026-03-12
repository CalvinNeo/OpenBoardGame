let pointSaladSelectedPile = null;
let pointSaladSelectedMarket = [];
let pointSaladSelectedFlips = new Set();

let currentPointSaladView = null;

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
