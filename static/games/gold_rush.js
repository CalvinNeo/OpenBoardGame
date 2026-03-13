let currentGoldRushView = null;
let goldRushSelectedHandIndex = null;

const goldRushHeaderActions = document.getElementById("goldRushHeaderActions");
const goldRushHelpBtn = document.getElementById("goldRushHelpBtn");
const goldRushExplainBtn = document.getElementById("goldRushExplainBtn");
const goldRushHelpModal = document.getElementById("goldRushHelpModal");
const goldRushHelpModalCloseBtn = document.getElementById("goldRushHelpModalCloseBtn");
const goldRushExplainModal = document.getElementById("goldRushExplainModal");
const goldRushExplainModalCloseBtn = document.getElementById("goldRushExplainModalCloseBtn");
const goldRushHelpContent = document.getElementById("goldRushHelpContent");
const goldRushExplainContent = document.getElementById("goldRushExplainContent");

const GOLD_RUSH_COLOR_PALETTE = {
  red: "#d14343",
  brown: "#8b5e34",
  blue: "#2563eb",
  gray: "#6b7280",
  green: "#2f9e44",
  gold: "#d4a017",
};
const GOLD_RUSH_LIGHT_TEXT = "#f9fafb";
const GOLD_RUSH_DARK_TEXT = "#111827";

const goldRushPhaseLabel = document.getElementById("goldRushPhase");
const goldRushModeLabel = document.getElementById("goldRushMode");
const goldRushTurnLabel = document.getElementById("goldRushTurn");
const goldRushDeckLabel = document.getElementById("goldRushDeck");
const goldRushWinnerLabel = document.getElementById("goldRushWinner");
const goldRushHand = document.getElementById("goldRushHand");
const goldRushSelectedCardLabel = document.getElementById("goldRushSelectedCard");
const goldRushClearSelectionBtn = document.getElementById("goldRushClearSelection");
const goldRushPlayCardBtn = document.getElementById("goldRushPlayCardBtn");
const goldRushDrawCardBtn = document.getElementById("goldRushDrawCardBtn");
const goldRushInvestYesBtn = document.getElementById("goldRushInvestYesBtn");
const goldRushInvestNoBtn = document.getElementById("goldRushInvestNoBtn");
const goldRushPlayAgainBtn = document.getElementById("goldRushPlayAgainBtn");
const goldRushMines = document.getElementById("goldRushMines");
const goldRushPlayers = document.getElementById("goldRushPlayers");
const goldRushScoreBreakdown = document.getElementById("goldRushScoreBreakdown");

const GOLD_RUSH_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Score the most gold when the deck runs out.</p>

  <h3>Turn</h3>
  <ul>
    <li>Classic mode: draw the top card and resolve it.</li>
    <li>Hand mode: play one card from your hand.</li>
  </ul>
  <p>Card types:</p>
  <ul>
    <li><strong>Miner</strong>: place it in its matching mine. You may invest a token in that mine.</li>
    <li><strong>Gold</strong>: choose any mine with space (max 6 gold cards) and place it.</li>
  </ul>

  <h3>Investing</h3>
  <p>Each player starts with 3 ownership tokens. You can only invest right after placing a miner in that mine.</p>

  <h3>Scoring</h3>
  <ul>
    <li>For each mine, total gold is divided by total tokens (floor).</li>
    <li>Each player gains (tokens in mine) × (share per token).</li>
    <li>Remainders are discarded.</li>
    <li>Highest total score wins (ties break by most unused tokens).</li>
  </ul>
`;

const GOLD_RUSH_BUTTON_EXPLANATIONS = {
  goldRushMine: {
    name: "Mine",
    description: "Place a gold card into the selected mine during gold placement.",
    note: "Only available when you are placing gold and the mine has space.",
  },
  goldRushClearSelection: {
    name: "Clear",
    description: "Clear the selected card from your hand.",
  },
  goldRushPlayCardBtn: {
    name: "Play Card",
    description: "Play the selected card from your hand.",
    note: "Miner cards may trigger an Invest decision. Gold cards must be placed in a mine.",
  },
  goldRushDrawCardBtn: {
    name: "Draw Card",
    description: "Draw the top card (Classic mode) and resolve it.",
  },
  goldRushInvestYesBtn: {
    name: "Invest",
    description: "Place one ownership token in the current mine.",
  },
  goldRushInvestNoBtn: {
    name: "Skip",
    description: "Skip investing this time and end the decision.",
  },
  goldRushPlayAgainBtn: {
    name: "Play Again",
    description: "Restart the game after scoring.",
  },
};

function getGoldRushHand(view) {
  if (!view || !Array.isArray(view.players)) {
    return [];
  }
  const you = view.players.find((player) => player.player_id === view.you);
  return you && Array.isArray(you.hand) ? you.hand : [];
}

function resolveGoldRushColor(color) {
  if (!color) {
    return null;
  }
  const key = String(color).trim().toLowerCase();
  return GOLD_RUSH_COLOR_PALETTE[key] || color;
}

function parseGoldRushHexColor(color) {
  if (typeof color !== "string") {
    return null;
  }
  let hex = color.trim();
  if (!hex.startsWith("#")) {
    return null;
  }
  hex = hex.slice(1);
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
  }
  if (hex.length !== 6) {
    return null;
  }
  const value = Number.parseInt(hex, 16);
  if (Number.isNaN(value)) {
    return null;
  }
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function goldRushIsDarkColor(color) {
  const rgb = parseGoldRushHexColor(color);
  if (!rgb) {
    return false;
  }
  const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return luminance < 140;
}

function goldRushSoftColor(color) {
  const rgb = parseGoldRushHexColor(color);
  if (!rgb) {
    return null;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`;
}

function applyGoldRushColorStyles(element, color) {
  if (!element) {
    return;
  }
  const resolved = resolveGoldRushColor(color);
  if (!resolved) {
    element.style.removeProperty("--gold-rush-color");
    element.style.removeProperty("--gold-rush-color-contrast");
    element.style.removeProperty("--gold-rush-color-soft");
    return;
  }
  element.style.setProperty("--gold-rush-color", resolved);
  const contrast = goldRushIsDarkColor(resolved) ? GOLD_RUSH_LIGHT_TEXT : GOLD_RUSH_DARK_TEXT;
  element.style.setProperty("--gold-rush-color-contrast", contrast);
  const soft = goldRushSoftColor(resolved);
  if (soft) {
    element.style.setProperty("--gold-rush-color-soft", soft);
  } else {
    element.style.removeProperty("--gold-rush-color-soft");
  }
}

function getGoldRushMineColors(view) {
  const colors = {};
  if (!view || !Array.isArray(view.mines)) {
    return colors;
  }
  view.mines.forEach((mine) => {
    const resolved = resolveGoldRushColor(mine.color);
    if (resolved) {
      colors[mine.id] = resolved;
    }
  });
  return colors;
}

function getGoldRushSelectedMineId(view) {
  const hand = getGoldRushHand(view);
  if (Number.isInteger(goldRushSelectedHandIndex)) {
    const selected = hand[goldRushSelectedHandIndex];
    if (selected && selected.type === "miner" && Number.isInteger(selected.mine_id)) {
      return selected.mine_id;
    }
  }
  const pending = view && view.pending_card;
  if (pending && pending.type === "miner" && Number.isInteger(pending.mine_id)) {
    return pending.mine_id;
  }
  return null;
}

function getGoldRushCardColor(card, mineColors) {
  if (!card) {
    return null;
  }
  if (card.type === "miner" && Number.isInteger(card.mine_id)) {
    return mineColors[card.mine_id] || null;
  }
  if (card.type === "gold") {
    return GOLD_RUSH_COLOR_PALETTE.gold;
  }
  return null;
}

function goldRushCardLabel(card, mineNames) {
  if (!card) {
    return "-";
  }
  if (card.type === "gold") {
    return `$${card.value ?? 0}`;
  }
  if (card.type === "miner") {
    const mineName = mineNames && Number.isInteger(card.mine_id) ? mineNames[card.mine_id] : null;
    return mineName ? `${mineName} Miner` : `Miner ${card.mine_id ?? "-"}`;
  }
  return "Unknown";
}

function goldRushMineHighlight(view, mine) {
  if (!view || view.phase !== "awaiting_gold_placement") {
    return null;
  }
  if (view.current_turn !== view.you) {
    return null;
  }
  if (mine.gold_count >= (view.max_gold_cards ?? 6)) {
    return null;
  }
  const tokens = mine.tokens_by_player || {};
  const entries = Object.entries(tokens).map(([pid, count]) => [pid, Number(count) || 0]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) {
    return { className: "gold-rush-highlight-neutral", icon: "-" };
  }
  const maxTokens = Math.max(...entries.map(([, count]) => count));
  const leaders = entries.filter(([, count]) => count === maxTokens && count > 0).map(([pid]) => pid);
  if (leaders.length > 1) {
    return { className: "gold-rush-highlight-contested", icon: "=" };
  }
  if (leaders[0] === view.you) {
    return { className: "gold-rush-highlight-safe", icon: "OK" };
  }
  return { className: "gold-rush-highlight-danger", icon: "X" };
}

function renderGoldRushHand(view, mineNames) {
  if (!goldRushHand) {
    return;
  }
  goldRushHand.innerHTML = "";
  const hand = getGoldRushHand(view);
  const mineColors = getGoldRushMineColors(view);
  if (!hand.length) {
    const empty = document.createElement("div");
    empty.className = "gold-rush-empty";
    empty.textContent = view.mode === "classic" ? "Classic mode (no hand)" : "No cards";
    goldRushHand.appendChild(empty);
    return;
  }
  hand.forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gold-rush-card";
    if (index === goldRushSelectedHandIndex) {
      button.classList.add("selected");
    }
    button.textContent = goldRushCardLabel(card, mineNames);
    applyGoldRushColorStyles(button, getGoldRushCardColor(card, mineColors));
    button.addEventListener("click", () => {
      goldRushSelectedHandIndex = index;
      renderGoldRushHand(view, mineNames);
      updateGoldRushSelectionLabel(view, mineNames);
      renderGoldRushMines(view);
      updateGoldRushActionButtons();
    });
    goldRushHand.appendChild(button);
  });
}

function updateGoldRushSelectionLabel(view, mineNames) {
  if (!goldRushSelectedCardLabel) {
    return;
  }
  let resolvedMineNames = mineNames;
  if (!resolvedMineNames && view && Array.isArray(view.mines)) {
    resolvedMineNames = {};
    view.mines.forEach((mine) => {
      resolvedMineNames[mine.id] = mine.name;
    });
  }
  const hand = getGoldRushHand(view);
  if (
    !Number.isInteger(goldRushSelectedHandIndex) ||
    goldRushSelectedHandIndex < 0 ||
    goldRushSelectedHandIndex >= hand.length
  ) {
    goldRushSelectedHandIndex = null;
    goldRushSelectedCardLabel.textContent = "-";
    return;
  }
  goldRushSelectedCardLabel.textContent = goldRushCardLabel(hand[goldRushSelectedHandIndex], resolvedMineNames);
}

function renderGoldRushMines(view) {
  if (!goldRushMines) {
    return;
  }
  goldRushMines.innerHTML = "";
  if (!view || !Array.isArray(view.mines)) {
    return;
  }
  const players = Array.isArray(view.players) ? view.players : [];
  const mineNames = {};
  const selectedMineId = getGoldRushSelectedMineId(view);
  view.mines.forEach((mine) => {
    mineNames[mine.id] = mine.name;
  });
  view.mines.forEach((mine) => {
    const canPlace =
      view.legal_actions &&
      view.legal_actions.includes("place_gold") &&
      view.current_turn === view.you &&
      mine.gold_count < (view.max_gold_cards ?? 6);
    const wrapper = document.createElement("button");
    wrapper.type = "button";
    wrapper.className = "gold-rush-mine";
    wrapper.disabled = !canPlace;
    applyGoldRushColorStyles(wrapper, mine.color);
    if (Number.isInteger(selectedMineId) && mine.id === selectedMineId) {
      wrapper.classList.add("selected");
    }

    const highlight = goldRushMineHighlight(view, mine);
    if (highlight) {
      wrapper.classList.add(highlight.className);
      const icon = document.createElement("div");
      icon.className = "gold-rush-highlight-icon";
      icon.textContent = highlight.icon;
      wrapper.appendChild(icon);
    }

    const title = document.createElement("div");
    title.className = "gold-rush-mine-title";
    title.textContent = mine.name || `Mine ${mine.id}`;
    wrapper.appendChild(title);

    const miners = document.createElement("div");
    miners.className = "gold-rush-mine-row";
    miners.textContent = `Miners: ${mine.miners_count ?? 0}`;
    wrapper.appendChild(miners);

    const gold = document.createElement("div");
    gold.className = "gold-rush-mine-row";
    const maxGold = view.max_gold_cards ?? 6;
    gold.textContent = `Gold: ${mine.gold_count ?? 0}/${maxGold} (Total ${mine.gold_total ?? 0})`;
    wrapper.appendChild(gold);

    const tokensRow = document.createElement("div");
    tokensRow.className = "gold-rush-mine-row";
    const tokens = mine.tokens_by_player || {};
    const tokenEntries = players
      .map((player) => {
        const count = tokens[player.player_id] || 0;
        if (!count) {
          return null;
        }
        return `${player.name || player.player_id}: ${count}`;
      })
      .filter(Boolean);
    tokensRow.textContent = tokenEntries.length ? `Tokens: ${tokenEntries.join(", ")}` : "Tokens: -";
    wrapper.appendChild(tokensRow);

    if (canPlace) {
      wrapper.classList.add("action-allowed");
      wrapper.addEventListener("click", () => {
        sendAction({ type: "place_gold", mine_id: mine.id });
      });
    }

    goldRushMines.appendChild(wrapper);
  });
  if (goldRushExplainMode) {
    updateGoldRushExplainModeClasses(true);
  }
}

function renderGoldRushPlayers(view) {
  if (!goldRushPlayers) {
    return;
  }
  goldRushPlayers.innerHTML = "";
  if (!view || !Array.isArray(view.players)) {
    return;
  }
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "gold-rush-player-card";
    const name = document.createElement("div");
    name.className = "gold-rush-player-name";
    name.textContent = player.name || player.player_id;
    card.appendChild(name);

    const meta = document.createElement("div");
    meta.className = "gold-rush-player-meta";
    const tags = [
      `score ${player.score ?? 0}`,
      `tokens ${player.tokens_available ?? 0}`,
      `hand ${player.hand_count ?? 0}`,
    ];
    if (player.player_id === view.current_turn) {
      tags.push("turn");
    }
    if (player.player_id === view.you) {
      tags.push("you");
    }
    if (player.is_bot) {
      tags.push("bot");
    }
    meta.textContent = tags.join(" · ");
    card.appendChild(meta);
    goldRushPlayers.appendChild(card);
  });
}

function renderGoldRushScoreBreakdown(view) {
  if (!goldRushScoreBreakdown) {
    return;
  }
  goldRushScoreBreakdown.innerHTML = "";
  if (!view || !view.game_over || !Array.isArray(view.score_breakdown)) {
    goldRushScoreBreakdown.textContent = "-";
    return;
  }
  const players = Array.isArray(view.players) ? view.players : [];
  view.score_breakdown.forEach((entry) => {
    const line = document.createElement("div");
    line.className = "gold-rush-score-line";
    const gains = entry.gains_by_player || {};
    const gainsText = players
      .map((player) => `${player.name || player.player_id}: ${gains[player.player_id] || 0}`)
      .join(", ");
    line.textContent = `${entry.mine_name || `Mine ${entry.mine_id}`}: pot ${entry.total_gold ?? 0}, tokens ${
      entry.total_tokens ?? 0
    }, share ${entry.share ?? 0}, remainder ${entry.remainder ?? 0}, gains ${gainsText}`;
    goldRushScoreBreakdown.appendChild(line);
  });
}

function isGoldRushActionAvailable(actionType) {
  if (!currentGoldRushView || !Array.isArray(currentGoldRushView.legal_actions)) {
    return false;
  }
  if (!currentGoldRushView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "play_card") {
    const hand = getGoldRushHand(currentGoldRushView);
    return (
      Number.isInteger(goldRushSelectedHandIndex) &&
      goldRushSelectedHandIndex >= 0 &&
      goldRushSelectedHandIndex < hand.length
    );
  }
  return true;
}

function updateGoldRushActionButtons() {
  const buttons = [
    { type: "play_card", el: goldRushPlayCardBtn },
    { type: "draw_card", el: goldRushDrawCardBtn },
    { type: "invest", el: goldRushInvestYesBtn },
    { type: "invest", el: goldRushInvestNoBtn },
    { type: "play_again", el: goldRushPlayAgainBtn },
  ];
  if (currentGameType !== "gold_rush") {
    buttons.forEach(({ el }) => {
      if (!el) {
        return;
      }
      el.classList.remove("action-allowed");
      el.disabled = true;
    });
    return;
  }
  buttons.forEach(({ type, el }) => {
    if (!el) {
      return;
    }
    const allowed = isGoldRushActionAvailable(type);
    if (allowed) {
      el.classList.add("action-allowed");
    } else {
      el.classList.remove("action-allowed");
    }
    el.disabled = !allowed;
  });
}

function clearGoldRushState() {
  currentGoldRushView = null;
  goldRushSelectedHandIndex = null;
  if (goldRushPhaseLabel) {
    goldRushPhaseLabel.textContent = "-";
  }
  if (goldRushModeLabel) {
    goldRushModeLabel.textContent = "-";
  }
  if (goldRushTurnLabel) {
    goldRushTurnLabel.textContent = "-";
  }
  if (goldRushDeckLabel) {
    goldRushDeckLabel.textContent = "-";
  }
  if (goldRushWinnerLabel) {
    goldRushWinnerLabel.textContent = "-";
  }
  if (goldRushHand) {
    goldRushHand.innerHTML = "";
  }
  if (goldRushSelectedCardLabel) {
    goldRushSelectedCardLabel.textContent = "-";
  }
  if (goldRushMines) {
    goldRushMines.innerHTML = "";
  }
  if (goldRushPlayers) {
    goldRushPlayers.innerHTML = "";
  }
  if (goldRushScoreBreakdown) {
    goldRushScoreBreakdown.innerHTML = "";
  }
  updateGoldRushActionButtons();
}

function renderGoldRushGameState(data) {
  const view = data.view;
  currentGoldRushView = view;
  if (currentGameType !== "gold_rush") {
    currentGameType = "gold_rush";
    setGamePanelVisibility("gold_rush");
  }

  if (goldRushPhaseLabel) {
    goldRushPhaseLabel.textContent = view.phase || "-";
  }
  if (goldRushModeLabel) {
    goldRushModeLabel.textContent = view.mode || "-";
  }
  if (goldRushTurnLabel) {
    const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
    goldRushTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (goldRushDeckLabel) {
    goldRushDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (goldRushWinnerLabel) {
    if (Array.isArray(view.winner) && view.winner.length) {
      const names = view.winner.map((pid) => findPlayerName(view, pid));
      goldRushWinnerLabel.textContent = names.join(", ");
    } else {
      goldRushWinnerLabel.textContent = "-";
    }
  }

  const mineNames = {};
  if (Array.isArray(view.mines)) {
    view.mines.forEach((mine) => {
      mineNames[mine.id] = mine.name;
    });
  }

  const hand = getGoldRushHand(view);
  if (goldRushSelectedHandIndex !== null && goldRushSelectedHandIndex >= hand.length) {
    goldRushSelectedHandIndex = null;
  }

  renderGoldRushHand(view, mineNames);
  updateGoldRushSelectionLabel(view, mineNames);
  renderGoldRushMines(view);
  renderGoldRushPlayers(view);
  renderGoldRushScoreBreakdown(view);
  logGameEvents(data);
  updateGoldRushActionButtons();
}

if (goldRushClearSelectionBtn) {
  goldRushClearSelectionBtn.addEventListener("click", () => {
    goldRushSelectedHandIndex = null;
    updateGoldRushSelectionLabel(currentGoldRushView || {});
    renderGoldRushMines(currentGoldRushView || {});
    updateGoldRushActionButtons();
  });
}

if (goldRushPlayCardBtn) {
  goldRushPlayCardBtn.addEventListener("click", () => {
    const hand = getGoldRushHand(currentGoldRushView);
    if (!Number.isInteger(goldRushSelectedHandIndex) || goldRushSelectedHandIndex < 0 || goldRushSelectedHandIndex >= hand.length) {
      log("Select a card to play");
      return;
    }
    sendAction({ type: "play_card", hand_index: goldRushSelectedHandIndex });
    goldRushSelectedHandIndex = null;
    updateGoldRushSelectionLabel(currentGoldRushView || {});
    renderGoldRushMines(currentGoldRushView || {});
    updateGoldRushActionButtons();
  });
}

if (goldRushDrawCardBtn) {
  goldRushDrawCardBtn.addEventListener("click", () => {
    sendAction({ type: "draw_card" });
  });
}

if (goldRushInvestYesBtn) {
  goldRushInvestYesBtn.addEventListener("click", () => {
    sendAction({ type: "invest", invest: true });
  });
}

if (goldRushInvestNoBtn) {
  goldRushInvestNoBtn.addEventListener("click", () => {
    sendAction({ type: "invest", invest: false });
  });
}

if (goldRushPlayAgainBtn) {
  goldRushPlayAgainBtn.addEventListener("click", () => {
    sendAction({ type: "play_again" });
  });
}

let goldRushExplainMode = false;

function showGoldRushHeaderActions(show) {
  if (goldRushHeaderActions) {
    goldRushHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitGoldRushExplainMode();
    closeGoldRushHelpModal();
    closeGoldRushExplainModal();
  }
}

function showGoldRushHelpModal() {
  if (!goldRushHelpModal) {
    return;
  }
  if (goldRushHelpContent) {
    goldRushHelpContent.innerHTML = GOLD_RUSH_HELP_TEXT;
  }
  setModalVisible(goldRushHelpModal, true);
}

function closeGoldRushHelpModal() {
  if (goldRushHelpModal) {
    setModalVisible(goldRushHelpModal, false);
  }
}

function updateGoldRushExplainModeClasses(enabled) {
  Object.keys(GOLD_RUSH_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    if (buttonId === "goldRushMine") {
      return;
    }
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
  document.querySelectorAll(".gold-rush-mine").forEach((btn) => {
    btn.classList.toggle("has-explanation", enabled);
  });
}

function findGoldRushButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(GOLD_RUSH_BUTTON_EXPLANATIONS)) {
    if (buttonId === "goldRushMine") {
      continue;
    }
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  const mines = Array.from(document.querySelectorAll(".gold-rush-mine"));
  for (const mine of mines) {
    const rect = mine.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return "goldRushMine";
    }
  }
  return null;
}

function toggleGoldRushExplainMode() {
  goldRushExplainMode = !goldRushExplainMode;
  document.body.classList.toggle("gold-rush-explain-mode", goldRushExplainMode);
  updateGoldRushExplainModeClasses(goldRushExplainMode);
  if (goldRushExplainBtn) {
    goldRushExplainBtn.classList.toggle("active", goldRushExplainMode);
  }
}

function exitGoldRushExplainMode() {
  if (!goldRushExplainMode) {
    return;
  }
  goldRushExplainMode = false;
  document.body.classList.remove("gold-rush-explain-mode");
  updateGoldRushExplainModeClasses(false);
  if (goldRushExplainBtn) {
    goldRushExplainBtn.classList.remove("active");
  }
}

function showGoldRushButtonExplanation(buttonId) {
  const explanation = GOLD_RUSH_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !goldRushExplainContent || !goldRushExplainModal) {
    return;
  }
  const note = explanation.note ? `<div class="hint">${explanation.note}</div>` : "";
  goldRushExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    ${note}
  `;
  setModalVisible(goldRushExplainModal, true);
}

function closeGoldRushExplainModal() {
  if (goldRushExplainModal) {
    setModalVisible(goldRushExplainModal, false);
  }
}

if (goldRushHelpBtn) {
  goldRushHelpBtn.addEventListener("click", () => {
    showGoldRushHelpModal();
  });
}

if (goldRushHelpModalCloseBtn) {
  goldRushHelpModalCloseBtn.addEventListener("click", closeGoldRushHelpModal);
}

if (goldRushExplainBtn) {
  goldRushExplainBtn.addEventListener("click", () => {
    toggleGoldRushExplainMode();
  });
}

if (goldRushExplainModalCloseBtn) {
  goldRushExplainModalCloseBtn.addEventListener("click", closeGoldRushExplainModal);
}

document.addEventListener("pointerdown", (e) => {
  if (!goldRushExplainMode) return;

  const buttonId = findGoldRushButtonAtPoint(e.clientX, e.clientY);
  if (buttonId) {
    e.preventDefault();
    e.stopPropagation();
    showGoldRushButtonExplanation(buttonId);
    exitGoldRushExplainMode();
    return;
  }

  const button = e.target.closest("button");
  if (button === goldRushExplainBtn || button === goldRushHelpBtn) return;
  if (button === goldRushHelpModalCloseBtn || button === goldRushExplainModalCloseBtn) return;

  if (button) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

document.addEventListener("click", (e) => {
  if (!goldRushExplainMode) return;

  const button = e.target.closest("button");
  if (!button) return;

  if (button === goldRushExplainBtn || button === goldRushHelpBtn) return;
  if (button === goldRushHelpModalCloseBtn || button === goldRushExplainModalCloseBtn) return;

  e.preventDefault();
  e.stopPropagation();
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && goldRushExplainMode) {
    exitGoldRushExplainMode();
  }
});
