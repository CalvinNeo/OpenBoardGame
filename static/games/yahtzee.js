let currentYahtzeeView = null;
let yahtzeeConfigSignature = null;

const yahtzeeConfigBox = document.getElementById("yahtzeeConfigBox");
const yahtzeeBotStrategySelect = document.getElementById("yahtzeeBotStrategySelect");
const yahtzeeBotStrategyHint = document.getElementById("yahtzeeBotStrategyHint");

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

function getYahtzeeConfig() {
  return {
    bot_strategy: yahtzeeBotStrategySelect.value === "dynamic_programming" ? "dynamic_programming" : "classic",
  };
}

function updateYahtzeeConfigHint() {
  yahtzeeBotStrategyHint.textContent = getYahtzeeConfig().bot_strategy === "dynamic_programming"
    ? "DP = dynamic programming. Plans for the highest expected final score. All bots."
    : "Original AI: random rerolls and immediate scores. All bots.";
}

function updateYahtzeeConfigRow() {
  const visible = Boolean(currentRoomState && currentGameType === "yahtzee");
  yahtzeeConfigBox.classList.toggle("hidden", !visible);
  yahtzeeConfigBox.setAttribute("aria-hidden", String(!visible));
  if (!visible) {
    yahtzeeConfigSignature = null;
    yahtzeeBotStrategySelect.value = "classic";
    return;
  }
  const config = currentRoomState.status !== "lobby" && currentYahtzeeView
    ? currentYahtzeeView.config || {}
    : currentRoomState.game_config || {};
  const signature = JSON.stringify([currentRoomState.room_id, config.bot_strategy || "classic"]);
  if (signature !== yahtzeeConfigSignature) {
    yahtzeeBotStrategySelect.value = config.bot_strategy === "dynamic_programming" ? "dynamic_programming" : "classic";
    yahtzeeConfigSignature = signature;
  }
  yahtzeeBotStrategySelect.disabled = !["lobby", "game_over"].includes(currentRoomState.status);
  updateYahtzeeConfigHint();
}

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
    die.dataset.yahtzeeExplain = "die";
    die.dataset.yahtzeeDie = String(idx);
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
    totalEl.className = "yahtzee-score-summary";
    const totalValue = Number.isInteger(player.total) ? player.total : 0;
    const upperTotal = Number.isInteger(player.upper_total) ? player.upper_total : 0;
    const lowerTotal = Number.isInteger(player.lower_total) ? player.lower_total : 0;
    const upperBonus = Number.isInteger(player.upper_bonus) ? player.upper_bonus : 0;
    const yahtzeeBonus = Number.isInteger(player.yahtzee_bonus) ? player.yahtzee_bonus : 0;
    const totalLabel = document.createElement("span");
    totalLabel.textContent = `Total: ${totalValue}`;
    totalLabel.tabIndex = 0;
    totalLabel.dataset.yahtzeeExplain = "total";
    totalEl.appendChild(totalLabel);
    const note = document.createElement("span");
    note.className = "yahtzee-score-note";
    [
      ["U", upperTotal, "upper", "Upper subtotal: Ones through Sixes."],
      ["B", upperBonus, "bonus", "Upper bonus: +35 when U reaches 63."],
      ["L", lowerTotal, "lower", "Lower subtotal: Three of a Kind through Chance."],
      ["Y", yahtzeeBonus, "yahtzee_bonus", "Extra Yahtzee bonuses: +100 each after a scored 50."],
    ].forEach(([label, value, key, tip], idx) => {
      if (idx) note.appendChild(document.createTextNode(" + "));
      const part = document.createElement("span");
      part.className = "yahtzee-score-part";
      part.textContent = `${label} ${value}`;
      part.tabIndex = 0;
      part.dataset.yahtzeeExplain = key;
      part.dataset.yahtzeeTip = `${label} — ${tip}`;
      note.appendChild(part);
    });
    totalEl.appendChild(note);
    header.appendChild(nameEl);
    header.appendChild(totalEl);
    card.appendChild(header);

    const rows = document.createElement("div");
    rows.className = "yahtzee-score-rows";
    categories.forEach((category, idx) => {
      const row = document.createElement("div");
      row.className = "yahtzee-score-row";
      row.dataset.yahtzeeExplain = "category";
      row.dataset.yahtzeeCategory = category;
      row.dataset.yahtzeePlayer = player.player_id;
      row.tabIndex = 0;
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
          row.setAttribute("role", "button");
          row.addEventListener("click", () => {
            sendAction({ type: "score", category });
          });
          row.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              row.click();
            }
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
  yahtzeeGuide.reset();
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
  yahtzeeGuide.hideTip();
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
  updateYahtzeeConfigRow();
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

yahtzeeBotStrategySelect.addEventListener("change", updateYahtzeeConfigHint);
// Assets can load after the room's first Socket.IO state has already arrived.
updateYahtzeeConfigRow();
