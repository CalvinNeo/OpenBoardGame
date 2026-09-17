let currentCatInBoxView = null;
let catInBoxSelectedCard = null;
let catInBoxSelectedColor = null;

const catInBoxHeaderActions = document.getElementById("catInBoxHeaderActions");
const catInBoxHelpBtn = document.getElementById("catInBoxHelpBtn");
const catInBoxExplainBtn = document.getElementById("catInBoxExplainBtn");
const catInBoxHelpModal = document.getElementById("catInBoxHelpModal");
const catInBoxHelpModalCloseBtn = document.getElementById("catInBoxHelpModalCloseBtn");
const catInBoxExplainModal = document.getElementById("catInBoxExplainModal");
const catInBoxExplainModalCloseBtn = document.getElementById("catInBoxExplainModalCloseBtn");
const catInBoxHelpContent = document.getElementById("catInBoxHelpContent");
const catInBoxExplainContent = document.getElementById("catInBoxExplainContent");

const catInBoxPanel = document.getElementById("catInBoxPanel");
const catInBoxPhaseLabel = document.getElementById("catInBoxPhase");
const catInBoxRoundLabel = document.getElementById("catInBoxRound");
const catInBoxRoundsTotalLabel = document.getElementById("catInBoxRoundsTotal");
const catInBoxTurnLabel = document.getElementById("catInBoxTurn");
const catInBoxLeadLabel = document.getElementById("catInBoxLead");
const catInBoxTrumpLabel = document.getElementById("catInBoxTrump");
const catInBoxTricksPlayedLabel = document.getElementById("catInBoxTricksPlayed");
const catInBoxParadoxLabel = document.getElementById("catInBoxParadox");
const catInBoxWinnersLabel = document.getElementById("catInBoxWinners");
const catInBoxBoard = document.getElementById("catInBoxBoard");
const catInBoxTrick = document.getElementById("catInBoxTrick");
const catInBoxHand = document.getElementById("catInBoxHand");
const catInBoxSelectedCardLabel = document.getElementById("catInBoxSelectedCard");
const catInBoxSelectedColorLabel = document.getElementById("catInBoxSelectedColor");
const catInBoxSelection = catInBoxSelectedCardLabel
  ? catInBoxSelectedCardLabel.closest(".cat-box-selection")
  : null;
const catInBoxControlsTitle = document.getElementById("catInBoxControlsTitle");
const catInBoxPrompt = document.getElementById("catInBoxPrompt");
const catInBoxColorButtons = document.getElementById("catInBoxColorButtons");
const catInBoxColorRedBtn = document.getElementById("catInBoxColorRedBtn");
const catInBoxColorBlueBtn = document.getElementById("catInBoxColorBlueBtn");
const catInBoxColorYellowBtn = document.getElementById("catInBoxColorYellowBtn");
const catInBoxColorGreenBtn = document.getElementById("catInBoxColorGreenBtn");
const catInBoxDiscardBtn = document.getElementById("catInBoxDiscardBtn");
const catInBoxBid1Btn = document.getElementById("catInBoxBid1Btn");
const catInBoxBid2Btn = document.getElementById("catInBoxBid2Btn");
const catInBoxBid3Btn = document.getElementById("catInBoxBid3Btn");
const catInBoxPlayBtn = document.getElementById("catInBoxPlayBtn");
const catInBoxActions = document.getElementById("catInBoxActions");
const catInBoxPlayers = document.getElementById("catInBoxPlayers");
const catInBoxSummary = document.getElementById("catInBoxSummary");
const catInBoxSummaryBody = document.getElementById("catInBoxSummaryBody");
const catInBoxSummarySection = catInBoxSummary
  ? catInBoxSummary.closest(".cat-box-summary-section")
  : null;

const catInBoxColorEmoji = {
  red: "🟥",
  blue: "🟦",
  yellow: "🟨",
  green: "🟩",
};

const CAT_IN_BOX_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Score the most points after one round per player.</p>

  <h3>Setup</h3>
  <ul>
    <li>Deck numbers range by player count (2p: 1-5, 3p: 1-6, 4p: 1-8, 5p: 1-9).</li>
    <li>Each number appears five times.</li>
    <li>Each round you receive a hand (10 cards, 9 in 5p).</li>
    <li>In 3+ players, discard 1 card before bidding.</li>
  </ul>

  <h3>Phases</h3>
  <ol>
    <li>Discard: if required, discard one card.</li>
    <li>Bidding: choose 1-3 tricks you aim to win.</li>
    <li>Tricks: play cards by choosing a number and a color.</li>
  </ol>

  <h3>Trick Rules</h3>
  <ul>
    <li>First played color is the lead color.</li>
    <li>Red is trump.</li>
    <li>You must play a legal slot: the color is still available to you and the board slot is empty.</li>
    <li>If you play off the lead color, you lose that lead color for the rest of the round.</li>
  </ul>

  <h3>Scoring</h3>
  <ul>
    <li>Score = tricks won.</li>
    <li>If your bid equals your tricks, add bonus = largest connected group of your markers.</li>
    <li>Paradox: if you have no legal move, round ends and you lose points equal to your tricks.</li>
  </ul>
`;

const CAT_IN_BOX_BUTTON_EXPLANATIONS = {
  catInBoxColorRedBtn: {
    name: "Red",
    description: "Choose red as the color for your selected number.",
  },
  catInBoxColorBlueBtn: {
    name: "Blue",
    description: "Choose blue as the color for your selected number.",
  },
  catInBoxColorYellowBtn: {
    name: "Yellow",
    description: "Choose yellow as the color for your selected number.",
  },
  catInBoxColorGreenBtn: {
    name: "Green",
    description: "Choose green as the color for your selected number.",
  },
  catInBoxDiscardBtn: {
    name: "Discard",
    description: "Discard one card during the discard phase.",
  },
  catInBoxBid1Btn: {
    name: "Bid 1",
    description: "Bid that you will win exactly 1 trick this round.",
  },
  catInBoxBid2Btn: {
    name: "Bid 2",
    description: "Bid that you will win exactly 2 tricks this round.",
  },
  catInBoxBid3Btn: {
    name: "Bid 3",
    description: "Bid that you will win exactly 3 tricks this round.",
  },
  catInBoxPlayBtn: {
    name: "Play Card",
    description: "Play the selected number in the selected color.",
    note: "You must pick a number and color that is legal on the board.",
  },
};

function formatCatInBoxColor(color) {
  if (!color) {
    return "-";
  }
  const emoji = catInBoxColorEmoji[color] || "";
  const name = color.charAt(0).toUpperCase() + color.slice(1);
  return emoji ? `${emoji} ${name}` : name;
}

function formatCatInBoxPhase(phase) {
  const labels = {
    discard: "Discard",
    bidding: "Bidding",
    trick: "Trick",
    game_over: "Game Over",
  };
  return labels[phase] || phase || "-";
}

function setCatInBoxPhaseElementVisible(element, visible) {
  if (!element) {
    return;
  }
  element.classList.toggle("cat-box-phase-hidden", !visible);
  element.setAttribute("aria-hidden", visible ? "false" : "true");
}

function updateCatInBoxPhasePresentation(view, legalActions) {
  if (!catInBoxPanel) {
    return;
  }
  const legal = Array.isArray(legalActions) ? legalActions : [];
  const phase = view && view.phase ? view.phase : "idle";
  const canDiscard = legal.includes("discard");
  const canBid = legal.includes("bid");
  const canPlay = legal.includes("play_card");
  const actionCount = canBid ? 3 : canDiscard || canPlay ? 1 : 0;

  catInBoxPanel.dataset.phase = phase;
  const playerCount = view && Array.isArray(view.players) ? view.players.length : 1;
  catInBoxPanel.style.setProperty("--cat-box-player-count", String(Math.max(playerCount, 1)));
  if (catInBoxActions) {
    catInBoxActions.style.setProperty("--cat-box-action-count", String(Math.max(actionCount, 1)));
    setCatInBoxPhaseElementVisible(catInBoxActions, actionCount > 0);
  }
  setCatInBoxPhaseElementVisible(catInBoxDiscardBtn, canDiscard);
  setCatInBoxPhaseElementVisible(catInBoxBid1Btn, canBid);
  setCatInBoxPhaseElementVisible(catInBoxBid2Btn, canBid);
  setCatInBoxPhaseElementVisible(catInBoxBid3Btn, canBid);
  setCatInBoxPhaseElementVisible(catInBoxPlayBtn, canPlay);
  setCatInBoxPhaseElementVisible(catInBoxColorButtons, canPlay);

  if (catInBoxControlsTitle) {
    if (phase === "discard") {
      catInBoxControlsTitle.textContent = "Discard";
    } else if (phase === "bidding") {
      catInBoxControlsTitle.textContent = "Your Bid";
    } else if (phase === "game_over") {
      catInBoxControlsTitle.textContent = "Game Over";
    } else {
      catInBoxControlsTitle.textContent = "Your Hand";
    }
  }

  if (!catInBoxPrompt) {
    return;
  }
  if (canDiscard) {
    catInBoxPrompt.textContent = "Choose one number to discard";
  } else if (canBid) {
    catInBoxPrompt.textContent = "How many tricks will you win?";
  } else if (canPlay) {
    catInBoxPrompt.textContent = "Choose a number, then a color";
  } else if (phase === "game_over") {
    catInBoxPrompt.textContent = "Final scores are below";
  } else if (view && view.current_turn) {
    catInBoxPrompt.textContent = `Waiting for ${findPlayerName(view, view.current_turn)}`;
  } else if (view) {
    catInBoxPrompt.textContent = "Waiting for the other players";
  } else {
    catInBoxPrompt.textContent = "Waiting for the game to start";
  }
}

function updateCatInBoxStatusVisibility() {
  if (!catInBoxPanel) {
    return;
  }
  catInBoxPanel.querySelectorAll("[data-cat-box-status]").forEach((item) => {
    const key = item.dataset.catBoxStatus;
    let empty = false;
    if (key === "round") {
      empty = catInBoxRoundLabel.textContent === "-" && catInBoxRoundsTotalLabel.textContent === "-";
    } else {
      const value = item.querySelector("strong");
      empty = !value || !value.textContent.trim() || value.textContent.trim() === "-";
    }
    item.classList.toggle("is-empty", empty);
  });
}

function catInBoxSlotEmpty(view, color, value) {
  if (!view || !Array.isArray(view.colors) || !Array.isArray(view.board)) {
    return false;
  }
  const row = view.colors.indexOf(color);
  if (row < 0 || row >= view.board.length) {
    return false;
  }
  const col = value - 1;
  if (!Array.isArray(view.board[row]) || col < 0 || col >= view.board[row].length) {
    return false;
  }
  return view.board[row][col] === null;
}

function catInBoxIsSelectionLegal(view, value, color) {
  if (!view || !Number.isInteger(value) || !color) {
    return false;
  }
  if (!Array.isArray(view.hand) || !view.hand.includes(value)) {
    return false;
  }
  const yourColors = view.your_colors || {};
  if (yourColors[color] === false) {
    return false;
  }
  return catInBoxSlotEmpty(view, color, value);
}

function updateCatInBoxSelectionLabels() {
  if (catInBoxSelectedCardLabel) {
    catInBoxSelectedCardLabel.textContent = Number.isInteger(catInBoxSelectedCard)
      ? String(catInBoxSelectedCard)
      : "-";
  }
  if (catInBoxSelectedColorLabel) {
    catInBoxSelectedColorLabel.textContent = catInBoxSelectedColor
      ? formatCatInBoxColor(catInBoxSelectedColor)
      : "-";
  }
  if (catInBoxSelection) {
    catInBoxSelection.classList.toggle(
      "is-empty",
      !Number.isInteger(catInBoxSelectedCard) && !catInBoxSelectedColor
    );
  }
  if (catInBoxDiscardBtn) {
    catInBoxDiscardBtn.textContent = Number.isInteger(catInBoxSelectedCard)
      ? `Discard ${catInBoxSelectedCard}`
      : "Discard";
  }
  if (catInBoxPlayBtn) {
    const colorEmoji = catInBoxColorEmoji[catInBoxSelectedColor] || "";
    catInBoxPlayBtn.textContent =
      Number.isInteger(catInBoxSelectedCard) && colorEmoji
        ? `Play ${colorEmoji} ${catInBoxSelectedCard}`
        : "Play Card";
  }
}

function updateCatInBoxColorButtons(view) {
  if (!catInBoxColorButtons) {
    return;
  }
  const buttons = Array.from(catInBoxColorButtons.querySelectorAll("button[data-color]"));
  buttons.forEach((button) => {
    const color = button.dataset.color;
    let enabled = false;
    if (view && Number.isInteger(catInBoxSelectedCard) && color) {
      enabled = catInBoxIsSelectionLegal(view, catInBoxSelectedCard, color);
    }
    button.disabled = !enabled;
    const selected = catInBoxSelectedColor === color;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function renderCatInBoxHand(view) {
  if (!catInBoxHand) {
    return;
  }
  catInBoxHand.innerHTML = "";
  const legalActions = Array.isArray(view.legal_actions) ? view.legal_actions : [];
  const canSelectCard = legalActions.includes("discard") || legalActions.includes("play_card");
  if (!Array.isArray(view.hand) || !view.hand.length) {
    catInBoxHand.style.setProperty("--cat-box-hand-count", "1");
    catInBoxHand.textContent = "-";
    updateCatInBoxSelectionLabels();
    return;
  }
  catInBoxHand.style.setProperty("--cat-box-hand-count", String(view.hand.length));
  view.hand.forEach((value) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "slot";
    btn.textContent = String(value);
    btn.disabled = !canSelectCard;
    btn.setAttribute("aria-label", `Number ${value}`);
    const selected = catInBoxSelectedCard === value;
    btn.classList.toggle("selected", selected);
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
    btn.addEventListener("click", () => {
      if (catInBoxSelectedCard === value) {
        catInBoxSelectedCard = null;
        catInBoxSelectedColor = null;
      } else {
        catInBoxSelectedCard = value;
        if (catInBoxSelectedColor && !catInBoxIsSelectionLegal(view, value, catInBoxSelectedColor)) {
          catInBoxSelectedColor = null;
        }
      }
      updateCatInBoxSelectionLabels();
      renderCatInBoxBoard(view);
      updateCatInBoxActionButtons();
      renderCatInBoxHand(view);
    });
    catInBoxHand.appendChild(btn);
  });
}

function renderCatInBoxBoard(view) {
  if (!catInBoxBoard) {
    return;
  }
  catInBoxBoard.innerHTML = "";
  const maxNumber = Number.isInteger(view.max_number) ? view.max_number : 0;
  catInBoxBoard.style.setProperty("--cat-box-cols", Math.max(maxNumber, 1));

  const headerSpacer = document.createElement("div");
  headerSpacer.className = "cat-box-header";
  headerSpacer.textContent = "";
  catInBoxBoard.appendChild(headerSpacer);
  for (let value = 1; value <= maxNumber; value += 1) {
    const header = document.createElement("div");
    header.className = "cat-box-header";
    header.textContent = String(value);
    catInBoxBoard.appendChild(header);
  }

  const colors = Array.isArray(view.colors) ? view.colors : [];
  colors.forEach((color, rowIndex) => {
    const label = document.createElement("div");
    label.className = "cat-box-row-label";
    label.setAttribute("aria-label", formatCatInBoxColor(color));
    label.title = formatCatInBoxColor(color);
    const emoji = document.createElement("span");
    emoji.className = "cat-box-row-emoji";
    emoji.setAttribute("aria-hidden", "true");
    emoji.textContent = catInBoxColorEmoji[color] || "";
    const colorName = document.createElement("span");
    colorName.className = "cat-box-row-name";
    colorName.textContent = color.charAt(0).toUpperCase() + color.slice(1);
    label.appendChild(emoji);
    label.appendChild(colorName);
    catInBoxBoard.appendChild(label);
    for (let value = 1; value <= maxNumber; value += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cat-box-cell";
      cell.dataset.color = color;
      cell.dataset.value = String(value);
      let occupant = null;
      if (Array.isArray(view.board) && Array.isArray(view.board[rowIndex])) {
        occupant = view.board[rowIndex][value - 1];
      }
      if (occupant) {
        const name = findPlayerName(view, occupant);
        cell.textContent = name ? name.charAt(0).toUpperCase() : "?";
        cell.setAttribute("aria-label", `${formatCatInBoxColor(color)} ${value}, occupied by ${name}`);
        if (name) {
          cell.title = name;
        }
        cell.classList.add("occupied");
        cell.disabled = true;
      } else {
        cell.textContent = String(value);
        cell.setAttribute("aria-label", `${formatCatInBoxColor(color)} ${value}`);
      }

      const isLegal =
        Number.isInteger(catInBoxSelectedCard) &&
        catInBoxSelectedCard === value &&
        catInBoxIsSelectionLegal(view, value, color);
      if (isLegal) {
        cell.classList.add("legal");
      } else if (Number.isInteger(catInBoxSelectedCard) && catInBoxSelectedCard === value) {
        cell.classList.add("disabled");
      }
      if (catInBoxSelectedCard === value && catInBoxSelectedColor === color) {
        cell.classList.add("selected");
      }
      if (!occupant) {
        cell.disabled = !isLegal;
      }
      if (isLegal) {
        cell.addEventListener("click", () => {
          catInBoxSelectedColor = catInBoxSelectedColor === color ? null : color;
          updateCatInBoxSelectionLabels();
          updateCatInBoxActionButtons();
          renderCatInBoxBoard(view);
        });
      }
      catInBoxBoard.appendChild(cell);
    }
  });
}

function renderCatInBoxTrick(view) {
  if (!catInBoxTrick) {
    return;
  }
  catInBoxTrick.innerHTML = "";
  const trick = Array.isArray(view.current_trick) ? view.current_trick : [];
  if (!trick.length) {
    catInBoxTrick.textContent = "—";
    return;
  }
  trick.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "cat-box-trick-card";
    const name = entry.name || findPlayerName(view, entry.player_id);
    card.title = `${name}: ${formatCatInBoxColor(entry.color)} ${entry.value}`;
    card.setAttribute("aria-label", card.title);
    const player = document.createElement("span");
    player.className = "cat-box-trick-player";
    player.textContent = name;
    const play = document.createElement("strong");
    play.className = "cat-box-trick-play";
    play.textContent = `${catInBoxColorEmoji[entry.color] || ""} ${entry.value}`.trim();
    card.appendChild(player);
    card.appendChild(play);
    catInBoxTrick.appendChild(card);
  });
}

function renderCatInBoxPlayers(view) {
  if (!catInBoxPlayers) {
    return;
  }
  catInBoxPlayers.innerHTML = "";
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (p.player_id === view.you) {
      card.classList.add("self");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name || p.player_id;
    const meta = document.createElement("div");
    meta.className = "player-meta";
    const bidLabel = Number.isInteger(p.bid) ? p.bid : "-";
    meta.textContent = `Bid ${bidLabel} · ${p.tricks_won ?? 0} tricks · ${p.score ?? 0} pts`;
    const voids = Array.isArray(p.void_colors) ? p.void_colors : [];
    if (voids.length) {
      const voidLine = document.createElement("div");
      voidLine.className = "player-meta";
      const voidLabels = voids.map((color) => formatCatInBoxColor(color)).join(" ");
      voidLine.textContent = `Void ${voidLabels}`;
      card.appendChild(name);
      card.appendChild(meta);
      card.appendChild(voidLine);
    } else {
      card.appendChild(name);
      card.appendChild(meta);
    }
    catInBoxPlayers.appendChild(card);
  });
}

function renderCatInBoxSummary(view) {
  if (!catInBoxSummary || !catInBoxSummaryBody) {
    return;
  }
  const summary = view.last_round_summary;
  if (!summary) {
    if (catInBoxSummarySection) {
      catInBoxSummarySection.classList.add("hidden");
    }
    catInBoxSummary.classList.add("hidden");
    catInBoxSummaryBody.textContent = "-";
    return;
  }
  if (catInBoxSummarySection) {
    catInBoxSummarySection.classList.remove("hidden");
  }
  catInBoxSummary.classList.remove("hidden");
  while (catInBoxSummaryBody.firstChild) {
    catInBoxSummaryBody.removeChild(catInBoxSummaryBody.firstChild);
  }
  const roundLine = document.createElement("div");
  const roundLabel = Number.isInteger(summary.round) ? `Round ${summary.round}` : "Round";
  const paradoxName = summary.paradox_player
    ? findPlayerName(view, summary.paradox_player)
    : "none";
  roundLine.textContent = `${roundLabel} | paradox ${paradoxName}`;
  catInBoxSummaryBody.appendChild(roundLine);

  const roundPoints = summary.round_points || {};
  const tricks = summary.tricks || {};
  const bids = summary.bids || {};
  const bonus = summary.bonus || {};
  view.players.forEach((player) => {
    const pid = player.player_id;
    const delta = roundPoints[pid];
    const deltaText =
      typeof delta === "number" && Number.isFinite(delta)
        ? delta >= 0
          ? `+${delta}`
          : String(delta)
        : "-";
    const line = document.createElement("div");
    const label = player.name || player.player_id;
    line.textContent = `${label}: T${tricks[pid] ?? "-"} / B${bids[pid] ?? "-"} / Bonus ${
      bonus[pid] ?? "-"
    } => ${deltaText}`;
    catInBoxSummaryBody.appendChild(line);
  });
}

function updateCatInBoxActionButtons() {
  if (currentGameType !== "cat_in_box") {
    updateCatInBoxPhasePresentation(null, []);
    const buttons = [catInBoxDiscardBtn, catInBoxBid1Btn, catInBoxBid2Btn, catInBoxBid3Btn, catInBoxPlayBtn];
    buttons.forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    updateCatInBoxColorButtons(null);
    updateCatInBoxSelectionLabels();
    return;
  }
  const view = currentCatInBoxView;
  const legal = view && Array.isArray(view.legal_actions) ? view.legal_actions : [];
  updateCatInBoxPhasePresentation(view, legal);
  const canDiscard = legal.includes("discard") && Number.isInteger(catInBoxSelectedCard);
  const canBid = legal.includes("bid");
  const canPlay =
    legal.includes("play_card") &&
    catInBoxIsSelectionLegal(view, catInBoxSelectedCard, catInBoxSelectedColor);

  if (catInBoxDiscardBtn) {
    catInBoxDiscardBtn.disabled = !canDiscard;
    catInBoxDiscardBtn.classList.toggle("action-allowed", canDiscard);
  }
  if (catInBoxBid1Btn) {
    catInBoxBid1Btn.disabled = !canBid;
    catInBoxBid1Btn.classList.toggle("action-allowed", canBid);
  }
  if (catInBoxBid2Btn) {
    catInBoxBid2Btn.disabled = !canBid;
    catInBoxBid2Btn.classList.toggle("action-allowed", canBid);
  }
  if (catInBoxBid3Btn) {
    catInBoxBid3Btn.disabled = !canBid;
    catInBoxBid3Btn.classList.toggle("action-allowed", canBid);
  }
  if (catInBoxPlayBtn) {
    catInBoxPlayBtn.disabled = !canPlay;
    catInBoxPlayBtn.classList.toggle("action-allowed", canPlay);
  }
  updateCatInBoxColorButtons(view);
  updateCatInBoxSelectionLabels();
}

function clearCatInBoxState() {
  currentCatInBoxView = null;
  catInBoxSelectedCard = null;
  catInBoxSelectedColor = null;
  if (catInBoxPhaseLabel) {
    catInBoxPhaseLabel.textContent = "-";
  }
  if (catInBoxRoundLabel) {
    catInBoxRoundLabel.textContent = "-";
  }
  if (catInBoxRoundsTotalLabel) {
    catInBoxRoundsTotalLabel.textContent = "-";
  }
  if (catInBoxTurnLabel) {
    catInBoxTurnLabel.textContent = "-";
  }
  if (catInBoxLeadLabel) {
    catInBoxLeadLabel.textContent = "-";
  }
  if (catInBoxTrumpLabel) {
    catInBoxTrumpLabel.textContent = "-";
  }
  if (catInBoxTricksPlayedLabel) {
    catInBoxTricksPlayedLabel.textContent = "-";
  }
  if (catInBoxParadoxLabel) {
    catInBoxParadoxLabel.textContent = "-";
  }
  if (catInBoxWinnersLabel) {
    catInBoxWinnersLabel.textContent = "-";
  }
  if (catInBoxBoard) {
    catInBoxBoard.innerHTML = "";
  }
  if (catInBoxTrick) {
    catInBoxTrick.innerHTML = "";
  }
  if (catInBoxHand) {
    catInBoxHand.innerHTML = "";
  }
  if (catInBoxSelectedCardLabel) {
    catInBoxSelectedCardLabel.textContent = "-";
  }
  if (catInBoxSelectedColorLabel) {
    catInBoxSelectedColorLabel.textContent = "-";
  }
  if (catInBoxPlayers) {
    catInBoxPlayers.innerHTML = "";
  }
  if (catInBoxSummary) {
    catInBoxSummary.classList.add("hidden");
  }
  if (catInBoxSummarySection) {
    catInBoxSummarySection.classList.add("hidden");
  }
  if (catInBoxSummaryBody) {
    catInBoxSummaryBody.textContent = "-";
  }
  updateCatInBoxStatusVisibility();
  updateCatInBoxActionButtons();
}

function renderCatInBoxGameState(data) {
  const view = data.view;
  currentCatInBoxView = view;
  if (currentGameType !== "cat_in_box") {
    currentGameType = "cat_in_box";
    setGamePanelVisibility("cat_in_box");
  }

  if (
    Number.isInteger(catInBoxSelectedCard) &&
    (!Array.isArray(view.hand) || !view.hand.includes(catInBoxSelectedCard))
  ) {
    catInBoxSelectedCard = null;
    catInBoxSelectedColor = null;
  }
  if (catInBoxSelectedColor && !catInBoxIsSelectionLegal(view, catInBoxSelectedCard, catInBoxSelectedColor)) {
    catInBoxSelectedColor = null;
  }

  if (catInBoxPhaseLabel) {
    catInBoxPhaseLabel.textContent = formatCatInBoxPhase(view.phase);
  }
  if (catInBoxRoundLabel) {
    catInBoxRoundLabel.textContent = Number.isInteger(view.round) ? String(view.round) : "-";
  }
  if (catInBoxRoundsTotalLabel) {
    catInBoxRoundsTotalLabel.textContent = Number.isInteger(view.rounds_total) ? String(view.rounds_total) : "-";
  }
  if (catInBoxTurnLabel) {
    const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
    catInBoxTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (catInBoxLeadLabel) {
    catInBoxLeadLabel.textContent = formatCatInBoxColor(view.lead_color);
  }
  if (catInBoxTrumpLabel) {
    catInBoxTrumpLabel.textContent = formatCatInBoxColor(view.trump_color);
  }
  if (catInBoxTricksPlayedLabel) {
    catInBoxTricksPlayedLabel.textContent =
      view.tricks_played !== null && view.tricks_played !== undefined ? String(view.tricks_played) : "-";
  }
  if (catInBoxParadoxLabel) {
    const paradoxPlayer = view.last_round_summary ? view.last_round_summary.paradox_player : null;
    catInBoxParadoxLabel.textContent = paradoxPlayer ? findPlayerName(view, paradoxPlayer) : "-";
  }
  if (catInBoxWinnersLabel) {
    if (view.game_over && Array.isArray(view.winners) && view.winners.length) {
      const names = view.winners.map((pid) => findPlayerName(view, pid));
      catInBoxWinnersLabel.textContent = names.join(", ");
    } else {
      catInBoxWinnersLabel.textContent = "-";
    }
  }

  updateCatInBoxStatusVisibility();
  updateCatInBoxSelectionLabels();
  renderCatInBoxBoard(view);
  renderCatInBoxTrick(view);
  renderCatInBoxHand(view);
  renderCatInBoxPlayers(view);
  renderCatInBoxSummary(view);
  updateCatInBoxActionButtons();
  logGameEvents(data);
}

if (catInBoxColorButtons) {
  catInBoxColorButtons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-color]");
    if (!button || button.disabled) {
      return;
    }
    const color = button.dataset.color || null;
    catInBoxSelectedColor = catInBoxSelectedColor === color ? null : color;
    updateCatInBoxSelectionLabels();
    if (currentCatInBoxView) {
      renderCatInBoxBoard(currentCatInBoxView);
    }
    updateCatInBoxActionButtons();
  });
}

if (catInBoxDiscardBtn) {
  catInBoxDiscardBtn.addEventListener("click", () => {
    if (!currentCatInBoxView) {
      log("Game not ready");
      return;
    }
    if (!Number.isInteger(catInBoxSelectedCard)) {
      log("Select a card to discard");
      return;
    }
    sendAction({ type: "discard", card_value: catInBoxSelectedCard });
    catInBoxSelectedCard = null;
    catInBoxSelectedColor = null;
    updateCatInBoxSelectionLabels();
    if (currentCatInBoxView) {
      renderCatInBoxBoard(currentCatInBoxView);
      renderCatInBoxHand(currentCatInBoxView);
    }
    updateCatInBoxActionButtons();
  });
}

if (catInBoxBid1Btn) {
  catInBoxBid1Btn.addEventListener("click", () => {
    sendAction({ type: "bid", bid: 1 });
  });
}

if (catInBoxBid2Btn) {
  catInBoxBid2Btn.addEventListener("click", () => {
    sendAction({ type: "bid", bid: 2 });
  });
}

if (catInBoxBid3Btn) {
  catInBoxBid3Btn.addEventListener("click", () => {
    sendAction({ type: "bid", bid: 3 });
  });
}

if (catInBoxPlayBtn) {
  catInBoxPlayBtn.addEventListener("click", () => {
    if (!currentCatInBoxView) {
      log("Game not ready");
      return;
    }
    if (!catInBoxIsSelectionLegal(currentCatInBoxView, catInBoxSelectedCard, catInBoxSelectedColor)) {
      log("Select a legal card and color");
      return;
    }
    const lead = currentCatInBoxView.lead_color;
    const yourColors = currentCatInBoxView.your_colors || {};
    if (lead && catInBoxSelectedColor !== lead && yourColors[lead] !== false) {
      const proceed = window.confirm(
        `Declare void on ${formatCatInBoxColor(lead)} by playing ${formatCatInBoxColor(
          catInBoxSelectedColor
        )}?`
      );
      if (!proceed) {
        return;
      }
    }
    sendAction({ type: "play_card", card_value: catInBoxSelectedCard, color: catInBoxSelectedColor });
    catInBoxSelectedCard = null;
    catInBoxSelectedColor = null;
    updateCatInBoxSelectionLabels();
    if (currentCatInBoxView) {
      renderCatInBoxBoard(currentCatInBoxView);
      renderCatInBoxHand(currentCatInBoxView);
    }
    updateCatInBoxActionButtons();
  });
}

let catInBoxExplainMode = false;

function showCatInBoxHeaderActions(show) {
  document.body.classList.toggle("cat-in-box-active", show);
  if (catInBoxHeaderActions) {
    catInBoxHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitCatInBoxExplainMode();
    closeCatInBoxHelpModal();
    closeCatInBoxExplainModal();
  }
}

function showCatInBoxHelpModal() {
  if (!catInBoxHelpModal) {
    return;
  }
  if (catInBoxHelpContent) {
    catInBoxHelpContent.innerHTML = CAT_IN_BOX_HELP_TEXT;
  }
  setModalVisible(catInBoxHelpModal, true);
}

function closeCatInBoxHelpModal() {
  if (catInBoxHelpModal) {
    setModalVisible(catInBoxHelpModal, false);
  }
}

function updateCatInBoxExplainModeClasses(enabled) {
  Object.keys(CAT_IN_BOX_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
}

function findCatInBoxButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(CAT_IN_BOX_BUTTON_EXPLANATIONS)) {
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  return null;
}

function toggleCatInBoxExplainMode() {
  catInBoxExplainMode = !catInBoxExplainMode;
  document.body.classList.toggle("cat-in-box-explain-mode", catInBoxExplainMode);
  updateCatInBoxExplainModeClasses(catInBoxExplainMode);
  if (catInBoxExplainBtn) {
    catInBoxExplainBtn.classList.toggle("active", catInBoxExplainMode);
  }
}

function exitCatInBoxExplainMode() {
  if (!catInBoxExplainMode) {
    return;
  }
  catInBoxExplainMode = false;
  document.body.classList.remove("cat-in-box-explain-mode");
  updateCatInBoxExplainModeClasses(false);
  if (catInBoxExplainBtn) {
    catInBoxExplainBtn.classList.remove("active");
  }
}

function showCatInBoxButtonExplanation(buttonId) {
  const explanation = CAT_IN_BOX_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !catInBoxExplainContent || !catInBoxExplainModal) {
    return;
  }
  const note = explanation.note ? `<div class="hint">${explanation.note}</div>` : "";
  catInBoxExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    ${note}
  `;
  setModalVisible(catInBoxExplainModal, true);
}

function closeCatInBoxExplainModal() {
  if (catInBoxExplainModal) {
    setModalVisible(catInBoxExplainModal, false);
  }
}

if (catInBoxHelpBtn) {
  catInBoxHelpBtn.addEventListener("click", () => {
    showCatInBoxHelpModal();
  });
}

if (catInBoxHelpModalCloseBtn) {
  catInBoxHelpModalCloseBtn.addEventListener("click", closeCatInBoxHelpModal);
}

if (catInBoxExplainBtn) {
  catInBoxExplainBtn.addEventListener("click", () => {
    toggleCatInBoxExplainMode();
  });
}

if (catInBoxExplainModalCloseBtn) {
  catInBoxExplainModalCloseBtn.addEventListener("click", closeCatInBoxExplainModal);
}

document.addEventListener("pointerdown", (e) => {
  if (!catInBoxExplainMode) return;

  const buttonId = findCatInBoxButtonAtPoint(e.clientX, e.clientY);
  if (buttonId) {
    e.preventDefault();
    e.stopPropagation();
    showCatInBoxButtonExplanation(buttonId);
    exitCatInBoxExplainMode();
    return;
  }

  const button = e.target.closest("button");
  if (button === catInBoxExplainBtn || button === catInBoxHelpBtn) return;
  if (button === catInBoxHelpModalCloseBtn || button === catInBoxExplainModalCloseBtn) return;

  if (button) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

document.addEventListener("click", (e) => {
  if (!catInBoxExplainMode) return;

  const button = e.target.closest("button");
  if (!button) return;

  if (button === catInBoxExplainBtn || button === catInBoxHelpBtn) return;
  if (button === catInBoxHelpModalCloseBtn || button === catInBoxExplainModalCloseBtn) return;

  e.preventDefault();
  e.stopPropagation();
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && catInBoxExplainMode) {
    exitCatInBoxExplainMode();
  }
});
