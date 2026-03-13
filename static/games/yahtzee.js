let currentYahtzeeView = null;

const yahtzeePhaseLabel = document.getElementById("yahtzeePhase");
const yahtzeeRoundLabel = document.getElementById("yahtzeeRound");
const yahtzeeTurnLabel = document.getElementById("yahtzeeTurn");
const yahtzeeRollsLabel = document.getElementById("yahtzeeRolls");
const yahtzeeWinnerLabel = document.getElementById("yahtzeeWinner");
const yahtzeeJokerNotice = document.getElementById("yahtzeeJokerNotice");
const yahtzeeJokerBody = document.getElementById("yahtzeeJokerBody");
const yahtzeeDice = document.getElementById("yahtzeeDice");
const yahtzeeRollBtn = document.getElementById("yahtzeeRollBtn");
const yahtzeeScorecards = document.getElementById("yahtzeeScorecards");

function formatYahtzeeCategoryLabel(view, category) {
  if (view && view.category_labels && view.category_labels[category]) {
    return view.category_labels[category];
  }
  return category || "-";
}

function isYahtzeeActionAvailable(actionType) {
  if (!currentYahtzeeView || !Array.isArray(currentYahtzeeView.legal_actions)) {
    return false;
  }
  return currentYahtzeeView.legal_actions.includes(actionType);
}

function updateYahtzeeActionButtons() {
  if (!yahtzeeRollBtn) {
    return;
  }
  if (currentGameType !== "yahtzee") {
    yahtzeeRollBtn.classList.remove("action-allowed");
    yahtzeeRollBtn.disabled = true;
    return;
  }
  const allowed = isYahtzeeActionAvailable("roll");
  if (allowed) {
    yahtzeeRollBtn.classList.add("action-allowed");
  } else {
    yahtzeeRollBtn.classList.remove("action-allowed");
  }
  yahtzeeRollBtn.disabled = !allowed;
}

function renderYahtzeeDice(view) {
  if (!yahtzeeDice) {
    return;
  }
  yahtzeeDice.innerHTML = "";
  const dice = Array.isArray(view.dice) ? view.dice : [];
  const locked = Array.isArray(view.locked) ? view.locked : [];
  const canToggle = isYahtzeeActionAvailable("toggle_lock");
  for (let idx = 0; idx < 5; idx += 1) {
    const value = Number.isInteger(dice[idx]) ? dice[idx] : 0;
    const die = document.createElement("button");
    die.type = "button";
    die.className = "yahtzee-die";
    if (locked[idx]) {
      die.classList.add("locked");
    }
    const valueEl = document.createElement("span");
    valueEl.className = "yahtzee-die-value";
    valueEl.textContent = value > 0 ? String(value) : "-";
    const lockEl = document.createElement("span");
    lockEl.className = "yahtzee-die-lock";
    lockEl.textContent = "LOCKED";
    die.appendChild(valueEl);
    die.appendChild(lockEl);
    const dieIndex = idx + 1;
    if (locked[idx]) {
      die.setAttribute("aria-pressed", "true");
      die.setAttribute("aria-label", `Die ${dieIndex} locked; will not roll.`);
      die.title = "Locked: will not roll.";
    } else {
      die.setAttribute("aria-pressed", "false");
      die.setAttribute("aria-label", `Die ${dieIndex} unlocked; click to lock.`);
      die.title = "Click to lock (will not roll).";
    }
    if (!canToggle) {
      die.classList.add("disabled");
      die.disabled = true;
    } else {
      die.addEventListener("click", () => {
        sendAction({ type: "toggle_lock", index: idx });
      });
    }
    yahtzeeDice.appendChild(die);
  }
}

function renderYahtzeeScorecards(view) {
  if (!yahtzeeScorecards) {
    return;
  }
  yahtzeeScorecards.innerHTML = "";
  const categories = Array.isArray(view.category_order) ? view.category_order : [];
  const possibleScores = view.possible_scores || {};
  const allowed = new Set(view.allowed_categories || []);
  const canScore = isYahtzeeActionAvailable("score");
  const isViewerTurn = view.you && view.you === view.current_player;

  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "yahtzee-scorecard player-card";
    if (player.player_id === view.current_player) {
      card.classList.add("current");
    }
    if (player.player_id === view.you) {
      card.classList.add("self");
    }

    const header = document.createElement("div");
    header.className = "yahtzee-scorecard-header";
    const nameEl = document.createElement("div");
    const nameLabel = player.name || player.player_id || "-";
    nameEl.textContent = player.player_id === view.you ? `${nameLabel} (You)` : nameLabel;
    const totalEl = document.createElement("div");
    const totalValue = Number.isInteger(player.total) ? player.total : 0;
    const upperTotal = Number.isInteger(player.upper_total) ? player.upper_total : 0;
    const lowerTotal = Number.isInteger(player.lower_total) ? player.lower_total : 0;
    const upperBonus = Number.isInteger(player.upper_bonus) ? player.upper_bonus : 0;
    const yahtzeeBonus = Number.isInteger(player.yahtzee_bonus) ? player.yahtzee_bonus : 0;
    totalEl.textContent = `Total: ${totalValue}`;
    const note = document.createElement("span");
    note.className = "yahtzee-score-note";
    note.textContent = `U ${upperTotal} + B ${upperBonus} + L ${lowerTotal} + Y ${yahtzeeBonus}`;
    totalEl.appendChild(note);
    header.appendChild(nameEl);
    header.appendChild(totalEl);
    card.appendChild(header);

    const rows = document.createElement("div");
    rows.className = "yahtzee-score-rows";
    categories.forEach((category, idx) => {
      const row = document.createElement("div");
      row.className = "yahtzee-score-row";
      if (idx < 6) {
        row.classList.add("upper");
      } else {
        row.classList.add("lower");
      }
      const label = document.createElement("div");
      label.textContent = formatYahtzeeCategoryLabel(view, category);
      const valueEl = document.createElement("div");
      valueEl.className = "yahtzee-score-value";

      const scoreSheet = player.score_sheet || {};
      const actual = scoreSheet[category];
      if (actual !== null && actual !== undefined) {
        row.classList.add("filled");
        valueEl.textContent = String(actual);
      } else {
        const isActivePlayer = player.player_id === view.current_player;
        const possible = isActivePlayer && allowed.has(category) ? possibleScores[category] : null;
        if (possible !== null && possible !== undefined) {
          valueEl.textContent = String(possible);
        } else {
          valueEl.textContent = "-";
        }
        const canSelect = isActivePlayer && isViewerTurn && canScore && allowed.has(category);
        if (canSelect) {
          row.classList.add("possible");
          row.addEventListener("click", () => {
            sendAction({ type: "score", category });
          });
        }
      }

      row.appendChild(label);
      row.appendChild(valueEl);
      rows.appendChild(row);
    });

    card.appendChild(rows);
    yahtzeeScorecards.appendChild(card);
  });
}

function clearYahtzeeState() {
  currentYahtzeeView = null;
  if (yahtzeePhaseLabel) {
    yahtzeePhaseLabel.textContent = "-";
  }
  if (yahtzeeRoundLabel) {
    yahtzeeRoundLabel.textContent = "-";
  }
  if (yahtzeeTurnLabel) {
    yahtzeeTurnLabel.textContent = "-";
  }
  if (yahtzeeRollsLabel) {
    yahtzeeRollsLabel.textContent = "-";
  }
  if (yahtzeeWinnerLabel) {
    yahtzeeWinnerLabel.textContent = "-";
  }
  if (yahtzeeDice) {
    yahtzeeDice.innerHTML = "";
  }
  if (yahtzeeScorecards) {
    yahtzeeScorecards.innerHTML = "";
  }
  if (yahtzeeJokerBody) {
    yahtzeeJokerBody.textContent = "-";
  }
  if (yahtzeeJokerNotice) {
    yahtzeeJokerNotice.classList.add("hidden");
  }
  updateYahtzeeActionButtons();
}

function renderYahtzeeGameState(data) {
  const view = data.view;
  currentYahtzeeView = view;
  if (currentGameType !== "yahtzee") {
    currentGameType = "yahtzee";
    setGamePanelVisibility("yahtzee");
  }
  if (yahtzeePhaseLabel) {
    yahtzeePhaseLabel.textContent = view.phase || "-";
  }
  if (yahtzeeRoundLabel) {
    yahtzeeRoundLabel.textContent = view.current_round ?? "-";
  }
  if (yahtzeeTurnLabel) {
    yahtzeeTurnLabel.textContent = view.current_player
      ? findPlayerName(view, view.current_player)
      : "-";
  }
  if (yahtzeeRollsLabel) {
    const rolls = Number.isInteger(view.roll_count) ? view.roll_count : 0;
    yahtzeeRollsLabel.textContent = `${rolls}/3`;
  }
  if (yahtzeeWinnerLabel) {
    if (Array.isArray(view.winner) && view.winner.length) {
      yahtzeeWinnerLabel.textContent = view.winner.map((pid) => findPlayerName(view, pid)).join(", ");
    } else {
      yahtzeeWinnerLabel.textContent = "-";
    }
  }

  if (yahtzeeJokerNotice && yahtzeeJokerBody) {
    let jokerMessage = null;
    if (view.joker && view.current_player) {
      const mode = view.joker.mode;
      if (mode === "forced_upper") {
        const label = formatYahtzeeCategoryLabel(view, view.joker.forced_category);
        jokerMessage = `Must score ${label}.`;
      } else if (mode === "lower_choice") {
        jokerMessage = "Joker active: choose any lower category.";
      } else if (mode === "forced_zero") {
        jokerMessage = "Joker active: lower filled, must take 0 in upper.";
      }
    }
    if (jokerMessage) {
      yahtzeeJokerBody.textContent = jokerMessage;
      yahtzeeJokerNotice.classList.remove("hidden");
    } else {
      yahtzeeJokerBody.textContent = "-";
      yahtzeeJokerNotice.classList.add("hidden");
    }
  }

  renderYahtzeeDice(view);
  renderYahtzeeScorecards(view);
  logGameEvents(data);
  updateYahtzeeActionButtons();
}

if (yahtzeeRollBtn) {
  yahtzeeRollBtn.addEventListener("click", () => {
    sendAction({ type: "roll" });
  });
}

window.clearYahtzeeState = clearYahtzeeState;
window.renderYahtzeeGameState = renderYahtzeeGameState;
