const HANABI_COLORS = ["red", "yellow", "green", "blue", "white"];
const HANABI_RANKS = [1, 2, 3, 4, 5];
const HANABI_COLOR_LABELS = {
  red: "Red",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  white: "White",
};
const HANABI_COLOR_SHORT = {
  red: "R",
  yellow: "Y",
  green: "G",
  blue: "B",
  white: "W",
};

let hanabiSelectedCardIndex = null;
let hanabiSelectedTargetId = null;
let hanabiSelectedClueType = "color";
let hanabiSelectedClueValue = null;

let currentHanabiView = null;

const hanabiConfigBox = document.getElementById("hanabiConfigBox");
const hanabiFinalRoundRow = document.getElementById("hanabiFinalRoundRow");
const hanabiFinalRoundToggle = document.getElementById("hanabiFinalRoundToggle");
const hanabiPanel = document.getElementById("hanabiPanel");
const hanabiTurnLabel = document.getElementById("hanabiTurn");
const hanabiCluesLabel = document.getElementById("hanabiClues");
const hanabiFusesLabel = document.getElementById("hanabiFuses");
const hanabiDeckLabel = document.getElementById("hanabiDeck");
const hanabiScoreLabel = document.getElementById("hanabiScore");
const hanabiFinalTurnsLabel = document.getElementById("hanabiFinalTurns");
const hanabiEndReasonLabel = document.getElementById("hanabiEndReason");
const hanabiTableau = document.getElementById("hanabiTableau");
const hanabiDiscardStats = document.getElementById("hanabiDiscardStats");
const hanabiHand = document.getElementById("hanabiHand");
const hanabiSelectedCardLabel = document.getElementById("hanabiSelectedCard");
const hanabiClearSelectionBtn = document.getElementById("hanabiClearSelection");
const hanabiPlayBtn = document.getElementById("hanabiPlayBtn");
const hanabiDiscardBtn = document.getElementById("hanabiDiscardBtn");
const hanabiTargetSelect = document.getElementById("hanabiTargetSelect");
const hanabiClueTypeSelect = document.getElementById("hanabiClueTypeSelect");
const hanabiClueValueSelect = document.getElementById("hanabiClueValueSelect");
const hanabiClueBtn = document.getElementById("hanabiClueBtn");
const hanabiPlayers = document.getElementById("hanabiPlayers");
const hanabiLog = document.getElementById("hanabiLog");

function updateHanabiConfigRow() {
  const showRow = currentRoomState && currentGameType === "hanabi" && currentRoomState.status === "lobby";
  if (hanabiConfigBox) {
    hanabiConfigBox.classList.toggle("hidden", !showRow);
    hanabiConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (hanabiFinalRoundRow) {
    hanabiFinalRoundRow.classList.toggle("hidden", !showRow);
    hanabiFinalRoundRow.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function clearHanabiState() {
  currentHanabiView = null;
  hanabiSelectedCardIndex = null;
  hanabiSelectedTargetId = null;
  hanabiSelectedClueType = "color";
  hanabiSelectedClueValue = null;
  if (hanabiTurnLabel) {
    hanabiTurnLabel.textContent = "-";
  }
  if (hanabiCluesLabel) {
    hanabiCluesLabel.textContent = "-";
  }
  if (hanabiFusesLabel) {
    hanabiFusesLabel.textContent = "-";
  }
  if (hanabiDeckLabel) {
    hanabiDeckLabel.textContent = "-";
  }
  if (hanabiScoreLabel) {
    hanabiScoreLabel.textContent = "-";
  }
  if (hanabiFinalTurnsLabel) {
    hanabiFinalTurnsLabel.textContent = "-";
  }
  if (hanabiEndReasonLabel) {
    hanabiEndReasonLabel.textContent = "-";
  }
  if (hanabiTableau) {
    hanabiTableau.innerHTML = "";
  }
  if (hanabiDiscardStats) {
    hanabiDiscardStats.innerHTML = "";
  }
  if (hanabiHand) {
    hanabiHand.innerHTML = "";
  }
  if (hanabiSelectedCardLabel) {
    hanabiSelectedCardLabel.textContent = "-";
  }
  if (hanabiTargetSelect) {
    hanabiTargetSelect.innerHTML = "";
  }
  if (hanabiClueTypeSelect) {
    hanabiClueTypeSelect.value = "color";
  }
  if (hanabiClueValueSelect) {
    hanabiClueValueSelect.innerHTML = "";
  }
  if (hanabiPlayers) {
    hanabiPlayers.innerHTML = "";
  }
  if (hanabiLog) {
    hanabiLog.innerHTML = "";
  }
  updateHanabiActionButtons();
}

function formatHanabiColor(color) {
  return HANABI_COLOR_LABELS[color] || color || "-";
}

function formatHanabiColorShort(color) {
  return HANABI_COLOR_SHORT[color] || (color ? color[0].toUpperCase() : "?");
}

function getHanabiYou(view) {
  if (!view || !Array.isArray(view.players)) {
    return null;
  }
  return view.players.find((p) => p.player_id === view.you) || null;
}

function getHanabiPossibleColors(card) {
  if (!card) {
    return [];
  }
  if (card.known_color) {
    return [card.known_color];
  }
  const notColors = Array.isArray(card.not_colors) ? card.not_colors : [];
  return HANABI_COLORS.filter((color) => !notColors.includes(color));
}

function getHanabiPossibleRanks(card) {
  if (!card) {
    return [];
  }
  if (Number.isInteger(card.known_rank)) {
    return [card.known_rank];
  }
  const notRanks = Array.isArray(card.not_ranks) ? card.not_ranks : [];
  return HANABI_RANKS.filter((rank) => !notRanks.includes(rank));
}

function isHanabiCardDefinitelyUnplayable(view, cardIndex) {
  const you = getHanabiYou(view);
  if (!you || !Array.isArray(you.hand)) {
    return false;
  }
  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= you.hand.length) {
    return false;
  }
  const card = you.hand[cardIndex];
  const colors = getHanabiPossibleColors(card);
  const ranks = getHanabiPossibleRanks(card);
  if (!colors.length || !ranks.length) {
    return false;
  }
  for (const color of colors) {
    const current = Number.isInteger(view.tableau?.[color]) ? view.tableau[color] : 0;
    for (const rank of ranks) {
      if (rank === current + 1) {
        return false;
      }
    }
  }
  return true;
}

function createHanabiCardElement(card, options = {}) {
  const cardEl = document.createElement("div");
  cardEl.className = "hanabi-card";
  const displayColor = card.color || card.known_color;
  if (displayColor) {
    cardEl.dataset.color = displayColor;
  }
  if (!card.color) {
    cardEl.classList.add("unknown");
  }
  if (options.selected) {
    cardEl.classList.add("selected");
  }

  const title = document.createElement("div");
  title.className = "hanabi-card-title";
  if (card.color && Number.isInteger(card.rank)) {
    title.textContent = `${formatHanabiColor(card.color)} ${card.rank}`;
  } else {
    title.textContent = "Unknown";
  }
  cardEl.appendChild(title);

  const known = document.createElement("div");
  known.className = "hanabi-card-known";
  const knownColor = card.known_color ? formatHanabiColorShort(card.known_color) : "?";
  const knownRank = Number.isInteger(card.known_rank) ? card.known_rank : "?";
  known.textContent = `Known: ${knownColor} ${knownRank}`;
  cardEl.appendChild(known);

  const notes = document.createElement("div");
  notes.className = "hanabi-card-notes";
  const notColors = Array.isArray(card.not_colors) ? card.not_colors : [];
  const notRanks = Array.isArray(card.not_ranks) ? card.not_ranks : [];
  const notesParts = [];
  if (notColors.length) {
    const colorsLabel = notColors.map((color) => formatHanabiColorShort(color)).join(" ");
    notesParts.push(`Not colors: ${colorsLabel}`);
  }
  if (notRanks.length) {
    notesParts.push(`Not ranks: ${notRanks.join(" ")}`);
  }
  notes.textContent = notesParts.length ? notesParts.join(" | ") : "Not: -";
  cardEl.appendChild(notes);

  return cardEl;
}

function renderHanabiHand(view) {
  if (!hanabiHand) {
    return;
  }
  hanabiHand.innerHTML = "";
  const you = getHanabiYou(view);
  if (!you || !Array.isArray(you.hand)) {
    hanabiHand.textContent = "-";
    return;
  }
  you.hand.forEach((card, idx) => {
    const cardEl = createHanabiCardElement(card, { selected: idx === hanabiSelectedCardIndex });
    cardEl.addEventListener("click", () => {
      if (hanabiSelectedCardIndex === idx) {
        hanabiSelectedCardIndex = null;
      } else {
        hanabiSelectedCardIndex = idx;
      }
      renderHanabiHand(view);
      updateHanabiSelectedCardLabel(view);
      updateHanabiActionButtons();
    });
    hanabiHand.appendChild(cardEl);
  });
}

function renderHanabiPlayers(view) {
  if (!hanabiPlayers) {
    return;
  }
  hanabiPlayers.innerHTML = "";
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
    name.textContent = player.name;
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    if (player.player_id === view.you) {
      const youBadge = document.createElement("span");
      youBadge.className = "badge";
      youBadge.textContent = "you";
      badges.appendChild(youBadge);
    }
    if (player.is_bot) {
      const bot = document.createElement("span");
      bot.className = "badge";
      bot.textContent = "bot";
      badges.appendChild(bot);
    }
    if (player.player_id === view.current_turn) {
      const turn = document.createElement("span");
      turn.className = "badge highlight";
      turn.textContent = "turn";
      badges.appendChild(turn);
    }
    header.appendChild(badges);
    card.appendChild(header);

    const handRow = document.createElement("div");
    handRow.className = "player-hand";
    if (Array.isArray(player.hand) && player.hand.length) {
      player.hand.forEach((cardData) => {
        const slot = createHanabiCardElement(cardData);
        handRow.appendChild(slot);
      });
    } else {
      const slot = document.createElement("div");
      slot.className = "player-slot empty";
      slot.textContent = "-";
      handRow.appendChild(slot);
    }
    card.appendChild(handRow);

    const meta = document.createElement("div");
    meta.className = "player-meta";
    meta.textContent = `cards ${player.hand_count}`;
    card.appendChild(meta);

    hanabiPlayers.appendChild(card);
  });
}

function renderHanabiTableau(view) {
  if (!hanabiTableau) {
    return;
  }
  hanabiTableau.innerHTML = "";
  HANABI_COLORS.forEach((color) => {
    const stack = document.createElement("div");
    stack.className = "hanabi-stack";
    stack.dataset.color = color;
    const value = view.tableau && Number.isInteger(view.tableau[color]) ? view.tableau[color] : 0;
    stack.textContent = `${formatHanabiColor(color)} ${value}`;
    hanabiTableau.appendChild(stack);
  });
}

function renderHanabiDiscardStats(view) {
  if (!hanabiDiscardStats) {
    return;
  }
  hanabiDiscardStats.innerHTML = "";
  const table = document.createElement("table");
  table.className = "hanabi-discard-table";
  const headRow = document.createElement("tr");
  const headColor = document.createElement("th");
  headColor.textContent = "Color";
  headRow.appendChild(headColor);
  HANABI_RANKS.forEach((rank) => {
    const th = document.createElement("th");
    th.textContent = String(rank);
    headRow.appendChild(th);
  });
  table.appendChild(headRow);
  const stats = view.discard_stats || {};
  HANABI_COLORS.forEach((color) => {
    const row = document.createElement("tr");
    const colorCell = document.createElement("td");
    colorCell.textContent = formatHanabiColor(color);
    row.appendChild(colorCell);
    HANABI_RANKS.forEach((rank) => {
      const cell = document.createElement("td");
      const value = stats[color] && Number.isInteger(stats[color][rank]) ? stats[color][rank] : 0;
      cell.textContent = String(value);
      row.appendChild(cell);
    });
    table.appendChild(row);
  });
  hanabiDiscardStats.appendChild(table);
}

function renderHanabiLog(view) {
  if (!hanabiLog) {
    return;
  }
  hanabiLog.innerHTML = "";
  const entries = Array.isArray(view.log) ? view.log : [];
  if (!entries.length) {
    hanabiLog.textContent = "-";
    return;
  }
  [...entries].reverse().forEach((entry) => {
    const row = document.createElement("div");
    row.className = "hanabi-log-entry";
    row.textContent = entry;
    hanabiLog.appendChild(row);
  });
}

function updateHanabiSelectedCardLabel(view) {
  if (!hanabiSelectedCardLabel) {
    return;
  }
  const you = getHanabiYou(view);
  if (
    !you ||
    !Number.isInteger(hanabiSelectedCardIndex) ||
    hanabiSelectedCardIndex < 0 ||
    hanabiSelectedCardIndex >= you.hand.length
  ) {
    hanabiSelectedCardLabel.textContent = "-";
    return;
  }
  const card = you.hand[hanabiSelectedCardIndex];
  const knownColor = card.known_color ? formatHanabiColorShort(card.known_color) : "?";
  const knownRank = Number.isInteger(card.known_rank) ? card.known_rank : "?";
  hanabiSelectedCardLabel.textContent = `#${hanabiSelectedCardIndex} Known ${knownColor} ${knownRank}`;
}

function updateHanabiClueOptions(view) {
  if (!hanabiClueTypeSelect || !hanabiClueValueSelect) {
    return;
  }
  if (!view) {
    hanabiClueValueSelect.innerHTML = "";
    return;
  }
  const clueType = hanabiClueTypeSelect.value || "color";
  const targetId = hanabiTargetSelect ? hanabiTargetSelect.value : null;
  const target = view.players.find((p) => p.player_id === targetId);
  const available = new Set();
  if (target && Array.isArray(target.hand)) {
    target.hand.forEach((card) => {
      if (clueType === "color" && card.color) {
        available.add(card.color);
      }
      if (clueType === "rank" && Number.isInteger(card.rank)) {
        available.add(card.rank);
      }
    });
  }
  const sortedValues =
    clueType === "color"
      ? HANABI_COLORS.filter((color) => available.has(color))
      : HANABI_RANKS.filter((rank) => available.has(rank));
  const previousValue = hanabiClueValueSelect.value;
  hanabiClueValueSelect.innerHTML = "";
  sortedValues.forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = clueType === "color" ? formatHanabiColor(value) : String(value);
    hanabiClueValueSelect.appendChild(option);
  });
  if (sortedValues.length) {
    const targetValue = sortedValues.some((value) => String(value) === previousValue) ? previousValue : String(sortedValues[0]);
    hanabiClueValueSelect.value = targetValue;
    hanabiClueValueSelect.disabled = false;
    hanabiSelectedClueValue = hanabiClueValueSelect.value;
  } else {
    hanabiClueValueSelect.disabled = true;
    hanabiSelectedClueValue = null;
  }
}

function renderHanabiClueTargets(view) {
  if (!hanabiTargetSelect) {
    return;
  }
  const previous = hanabiTargetSelect.value;
  hanabiTargetSelect.innerHTML = "";
  const targets = Array.isArray(view.players)
    ? view.players.filter((p) => p.player_id !== view.you)
    : [];
  targets.forEach((player) => {
    const option = document.createElement("option");
    option.value = player.player_id;
    option.textContent = player.name;
    hanabiTargetSelect.appendChild(option);
  });
  if (!targets.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No targets";
    hanabiTargetSelect.appendChild(option);
    hanabiTargetSelect.disabled = true;
    hanabiSelectedTargetId = null;
    updateHanabiClueOptions(view);
    return;
  }
  hanabiTargetSelect.disabled = false;
  const targetIds = targets.map((player) => player.player_id);
  hanabiTargetSelect.value = targetIds.includes(previous) ? previous : targets[0].player_id;
  hanabiSelectedTargetId = hanabiTargetSelect.value;
  updateHanabiClueOptions(view);
}

function updateHanabiActionButtons() {
  const buttons = [
    { type: "play", el: hanabiPlayBtn },
    { type: "discard", el: hanabiDiscardBtn },
    { type: "give_clue", el: hanabiClueBtn },
  ];
  if (currentGameType !== "hanabi" || !currentHanabiView) {
    buttons.forEach(({ el }) => {
      if (!el) {
        return;
      }
      el.classList.remove("action-allowed");
      el.disabled = true;
    });
    return;
  }
  const actions = Array.isArray(currentHanabiView.legal_actions) ? currentHanabiView.legal_actions : [];
  const you = getHanabiYou(currentHanabiView);
  const selectedCardValid =
    !!you &&
    Number.isInteger(hanabiSelectedCardIndex) &&
    hanabiSelectedCardIndex >= 0 &&
    hanabiSelectedCardIndex < you.hand.length;
  const clueTarget = hanabiTargetSelect ? hanabiTargetSelect.value : "";
  const clueValue = hanabiClueValueSelect ? hanabiClueValueSelect.value : "";
  const clueTargetValid = !!clueTarget && clueTarget !== currentHanabiView.you;
  const clueValueValid = !!clueValue;
  buttons.forEach(({ type, el }) => {
    if (!el) {
      return;
    }
    let allowed = actions.includes(type);
    if (type === "play" || type === "discard") {
      allowed = allowed && selectedCardValid;
    }
    if (type === "give_clue") {
      allowed = allowed && clueTargetValid && clueValueValid;
    }
    if (allowed) {
      el.classList.add("action-allowed");
    } else {
      el.classList.remove("action-allowed");
    }
    el.disabled = !allowed;
  });
}

function renderHanabiGameState(data) {
  const view = data.view;
  currentHanabiView = view;
  if (currentGameType !== "hanabi") {
    currentGameType = "hanabi";
    setGamePanelVisibility("hanabi");
  }

  const you = getHanabiYou(view);
  if (
    !you ||
    !Array.isArray(you.hand) ||
    (Number.isInteger(hanabiSelectedCardIndex) && hanabiSelectedCardIndex >= you.hand.length)
  ) {
    hanabiSelectedCardIndex = null;
  }
  if (hanabiSelectedTargetId && !view.players.find((p) => p.player_id === hanabiSelectedTargetId)) {
    hanabiSelectedTargetId = null;
  }

  if (hanabiTurnLabel) {
    const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
    hanabiTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (hanabiCluesLabel) {
    hanabiCluesLabel.textContent = `${view.clue_tokens ?? "-"}/${view.max_clue_tokens ?? "-"}`;
  }
  if (hanabiFusesLabel) {
    hanabiFusesLabel.textContent = `${view.fuse_tokens ?? "-"}/${view.max_fuse_tokens ?? "-"}`;
  }
  if (hanabiDeckLabel) {
    hanabiDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (hanabiScoreLabel) {
    hanabiScoreLabel.textContent = view.score_display || "-";
  }
  if (hanabiFinalTurnsLabel) {
    hanabiFinalTurnsLabel.textContent = Number.isInteger(view.final_rounds_remaining) ? view.final_rounds_remaining : "-";
  }
  if (hanabiEndReasonLabel) {
    hanabiEndReasonLabel.textContent = view.end_reason || "-";
  }

  renderHanabiTableau(view);
  renderHanabiDiscardStats(view);
  renderHanabiHand(view);
  renderHanabiPlayers(view);
  renderHanabiClueTargets(view);
  renderHanabiLog(view);
  updateHanabiSelectedCardLabel(view);
  logGameEvents(data);
  updateHanabiActionButtons();
}

if (hanabiClearSelectionBtn) {
  hanabiClearSelectionBtn.addEventListener("click", () => {
    hanabiSelectedCardIndex = null;
    if (currentHanabiView) {
      renderHanabiHand(currentHanabiView);
      updateHanabiSelectedCardLabel(currentHanabiView);
    } else if (hanabiSelectedCardLabel) {
      hanabiSelectedCardLabel.textContent = "-";
    }
    updateHanabiActionButtons();
  });
}

if (hanabiTargetSelect) {
  hanabiTargetSelect.addEventListener("change", () => {
    hanabiSelectedTargetId = hanabiTargetSelect.value || null;
    if (currentHanabiView) {
      updateHanabiClueOptions(currentHanabiView);
    }
    updateHanabiActionButtons();
  });
}

if (hanabiClueTypeSelect) {
  hanabiClueTypeSelect.addEventListener("change", () => {
    hanabiSelectedClueType = hanabiClueTypeSelect.value || "color";
    if (currentHanabiView) {
      updateHanabiClueOptions(currentHanabiView);
    }
    updateHanabiActionButtons();
  });
}

if (hanabiClueValueSelect) {
  hanabiClueValueSelect.addEventListener("change", () => {
    hanabiSelectedClueValue = hanabiClueValueSelect.value || null;
    updateHanabiActionButtons();
  });
}

if (hanabiPlayBtn) {
  hanabiPlayBtn.addEventListener("click", () => {
    if (!currentHanabiView) {
      log("Game not ready");
      return;
    }
    const you = getHanabiYou(currentHanabiView);
    if (
      !you ||
      !Number.isInteger(hanabiSelectedCardIndex) ||
      hanabiSelectedCardIndex < 0 ||
      hanabiSelectedCardIndex >= you.hand.length
    ) {
      log("Select a card to play");
      return;
    }
    if (isHanabiCardDefinitelyUnplayable(currentHanabiView, hanabiSelectedCardIndex)) {
      const proceed = window.confirm("This play is guaranteed to fail based on known info. Play anyway?");
      if (!proceed) {
        return;
      }
    }
    sendAction({ type: "play", card_index: hanabiSelectedCardIndex });
    hanabiSelectedCardIndex = null;
    renderHanabiHand(currentHanabiView);
    updateHanabiSelectedCardLabel(currentHanabiView);
    updateHanabiActionButtons();
  });
}

if (hanabiDiscardBtn) {
  hanabiDiscardBtn.addEventListener("click", () => {
    if (!currentHanabiView) {
      log("Game not ready");
      return;
    }
    const you = getHanabiYou(currentHanabiView);
    if (
      !you ||
      !Number.isInteger(hanabiSelectedCardIndex) ||
      hanabiSelectedCardIndex < 0 ||
      hanabiSelectedCardIndex >= you.hand.length
    ) {
      log("Select a card to discard");
      return;
    }
    sendAction({ type: "discard", card_index: hanabiSelectedCardIndex });
    hanabiSelectedCardIndex = null;
    renderHanabiHand(currentHanabiView);
    updateHanabiSelectedCardLabel(currentHanabiView);
    updateHanabiActionButtons();
  });
}

if (hanabiClueBtn) {
  hanabiClueBtn.addEventListener("click", () => {
    if (!currentHanabiView) {
      log("Game not ready");
      return;
    }
    const targetId = hanabiTargetSelect ? hanabiTargetSelect.value : null;
    const clueType = hanabiClueTypeSelect ? hanabiClueTypeSelect.value || "color" : "color";
    const clueValueRaw = hanabiClueValueSelect ? hanabiClueValueSelect.value : null;
    if (!targetId || !clueValueRaw) {
      log("Select a target and clue value");
      return;
    }
    let value = clueValueRaw;
    if (clueType === "rank") {
      const parsed = Number.parseInt(clueValueRaw, 10);
      if (!Number.isInteger(parsed)) {
        log("Select a clue number");
        return;
      }
      value = parsed;
    }
    sendAction({
      type: "give_clue",
      target_player_id: targetId,
      clue_type: clueType,
      value,
    });
  });
}
