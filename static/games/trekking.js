const TREKKING_TOKEN_LABELS = {
  person: "🧑",
  event: "📜",
  innovation: "⚙️",
  progress: "🌱",
  wild: "✨",
  crystal: "💎",
};
const TREKKING_TOKEN_NAMES = {
  person: "Person",
  event: "Event",
  innovation: "Innovation",
  progress: "Progress",
  wild: "Wild",
  crystal: "Crystal",
};
const TREKKING_COLUMN_LABELS = ["Person", "Event", "Innovation", "Progress"];
const TREKKING_SLOT_REWARDS = ["-", "person", "event", "innovation", "progress", "crystal"];

let trekkingSelectedSlot = null;
let trekkingLastDay = null;
let trekkingWildModalState = null;
let trekkingCrystalModalState = null;

let currentTrekkingView = null;

const trekkingHeaderActions = document.getElementById("trekkingHeaderActions");
const trekkingHelpBtn = document.getElementById("trekkingHelpBtn");
const trekkingExplainBtn = document.getElementById("trekkingExplainBtn");
const trekkingHelpModal = document.getElementById("trekkingHelpModal");
const trekkingHelpModalCloseBtn = document.getElementById("trekkingHelpModalCloseBtn");
const trekkingExplainModal = document.getElementById("trekkingExplainModal");
const trekkingExplainModalCloseBtn = document.getElementById("trekkingExplainModalCloseBtn");
const trekkingHelpContent = document.getElementById("trekkingHelpContent");
const trekkingExplainContent = document.getElementById("trekkingExplainContent");

const trekkingPanel = document.getElementById("trekkingPanel");
const trekkingDayLabel = document.getElementById("trekkingDay");
const trekkingTurnLabel = document.getElementById("trekkingTurn");
const trekkingWinnerLabel = document.getElementById("trekkingWinner");
const trekkingDeckCountLabel = document.getElementById("trekkingDeckCount");
const trekkingDeckTopLabel = document.getElementById("trekkingDeckTop");
const trekkingClock = document.getElementById("trekkingClock");
const trekkingMarket = document.getElementById("trekkingMarket");
const trekkingSelectedCardLabel = document.getElementById("trekkingSelectedCard");
const trekkingSelectedCostLabel = document.getElementById("trekkingSelectedCost");
const trekkingSelectedTokensLabel = document.getElementById("trekkingSelectedTokens");
const trekkingTakeCardWithCrystalBtn = document.getElementById("trekkingTakeCardWithCrystalBtn");
const trekkingTakeAncestorWithCrystalBtn = document.getElementById("trekkingTakeAncestorWithCrystalBtn");
const trekkingWildModal = document.getElementById("trekkingWildModal");
const trekkingWildPrompt = document.getElementById("trekkingWildPrompt");
const trekkingWildModalButtons = document.getElementById("trekkingWildModalButtons");
const trekkingWildCancelBtn = document.getElementById("trekkingWildCancel");
const trekkingCrystalModal = document.getElementById("trekkingCrystalModal");
const trekkingCrystalPrompt = document.getElementById("trekkingCrystalPrompt");
const trekkingCrystalSelect = document.getElementById("trekkingCrystalSelect");
const trekkingCrystalConfirmBtn = document.getElementById("trekkingCrystalConfirm");
const trekkingCrystalCancelBtn = document.getElementById("trekkingCrystalCancel");
const trekkingScoreModal = document.getElementById("trekkingScoreModal");
const trekkingScoreCloseBtn = document.getElementById("trekkingScoreCloseBtn");
const trekkingTakeCardBtn = document.getElementById("trekkingTakeCardBtn");
const trekkingTakeAncestorBtn = document.getElementById("trekkingTakeAncestorBtn");
const trekkingPlayers = document.getElementById("trekkingPlayers");

const TREKKING_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Score the most points after 3 days.</p>

  <h3>Turn</h3>
  <ul>
    <li>Choose one action: take a market card or take an ancestor.</li>
    <li>Pay time equal to the cost (you may spend crystals to reduce it, minimum 1).</li>
    <li>Gain the card tokens plus the slot reward.</li>
  </ul>

  <h3>Market & Slot Rewards</h3>
  <ul>
    <li>Slot 1 gives no reward.</li>
    <li>Slots 2-5 give a token; slot 6 gives a crystal.</li>
  </ul>

  <h3>Tokens & Itinerary</h3>
  <ul>
    <li>Tokens fill your itinerary columns (Person/Event/Innovation/Progress).</li>
    <li>Wild tokens let you choose the column.</li>
    <li>Swirls and gems grant immediate bonuses; completing a row grants its reward.</li>
  </ul>

  <h3>Treks & Scoring</h3>
  <ul>
    <li>Cards with non-decreasing years stay in the same trek. Earlier years start a new trek.</li>
    <li>Each trek scores by length. Crystals add +1 each at game end.</li>
  </ul>

  <h3>Days</h3>
  <p>A day ends when all players reach time 12. There are 3 days total.</p>
`;

const TREKKING_BUTTON_EXPLANATIONS = {
  trekkingTakeCardBtn: {
    name: "Take Selected Card",
    description: "Take the selected market card, pay its time cost, and gain its tokens plus the slot reward.",
    note: "Wild tokens require you to choose a column.",
  },
  trekkingTakeAncestorBtn: {
    name: "Take Ancestor",
    description: "Gain an Ancestor card and a wild token. Costs 3 time (before crystal discounts).",
  },
  trekkingTakeCardWithCrystalBtn: {
    name: "Take Selected Card With 💎",
    description: "Spend crystals to reduce the card time cost (minimum 1).",
  },
  trekkingTakeAncestorWithCrystalBtn: {
    name: "Take Ancestor With 💎",
    description: "Spend crystals to reduce the ancestor time cost (minimum 1).",
  },
  trekkingWildCancelBtn: {
    name: "Cancel Wild Choice",
    description: "Cancel choosing wild slots and return to the action.",
  },
  trekkingCrystalConfirmBtn: {
    name: "Confirm Crystal Spend",
    description: "Confirm the selected crystal spend and continue.",
  },
  trekkingCrystalCancelBtn: {
    name: "Cancel Crystal Spend",
    description: "Cancel spending crystals and return.",
  },
  trekkingScoreCloseBtn: {
    name: "Close Score Rules",
    description: "Close the score rules panel.",
  },
};

function clearTrekkingSelections() {
  trekkingSelectedSlot = null;
}

function clearTrekkingState() {
  currentTrekkingView = null;
  trekkingLastDay = null;
  clearTrekkingSelections();
  closeTrekkingWildModal();
  closeTrekkingCrystalModal();
  closeTrekkingScoreRules();
  if (trekkingDayLabel) {
    trekkingDayLabel.textContent = "-";
  }
  if (trekkingTurnLabel) {
    trekkingTurnLabel.textContent = "-";
  }
  if (trekkingWinnerLabel) {
    trekkingWinnerLabel.textContent = "-";
  }
  if (trekkingDeckCountLabel) {
    trekkingDeckCountLabel.textContent = "-";
  }
  if (trekkingDeckTopLabel) {
    trekkingDeckTopLabel.textContent = "-";
  }
  if (trekkingSelectedCardLabel) {
    trekkingSelectedCardLabel.textContent = "-";
  }
  if (trekkingSelectedCostLabel) {
    trekkingSelectedCostLabel.textContent = "-";
  }
  if (trekkingSelectedTokensLabel) {
    trekkingSelectedTokensLabel.textContent = "-";
  }
  if (trekkingMarket) {
    trekkingMarket.innerHTML = "";
  }
  if (trekkingClock) {
    trekkingClock.innerHTML = "";
  }
  if (trekkingPlayers) {
    trekkingPlayers.innerHTML = "";
  }
  updateTrekkingActionButtons();
}

function getTrekkingYou(view) {
  if (!view) {
    return null;
  }
  return (view.players || []).find((player) => player.player_id === view.you) || null;
}

function trekkingTokenIcon(token) {
  return TREKKING_TOKEN_LABELS[token] || token;
}

function trekkingTokenName(token) {
  return TREKKING_TOKEN_NAMES[token] || token;
}

function trekkingTokensText(tokens) {
  return (tokens || []).map((token) => trekkingTokenIcon(token)).join(" ");
}

function formatTrekkingYear(year) {
  if (year === null || year === undefined) {
    return "-";
  }
  if (Math.abs(year) > 1000000) {
    return "-";
  }
  if (year < 0) {
    return `${Math.abs(year)} BCE`;
  }
  return `${year} CE`;
}

function trekkingWildNeeded(tokens) {
  return (tokens || []).filter((token) => token === "wild").length;
}

function openTrekkingWildModal(stepIndex, total) {
  if (!trekkingWildModal || !trekkingWildPrompt || !trekkingWildModalButtons) {
    return Promise.resolve(null);
  }
  if (trekkingWildModalState) {
    return Promise.reject(new Error("wild modal already open"));
  }
  trekkingWildModal.classList.remove("hidden");
  const state = {
    stepIndex,
    total,
    resolve: null,
    reject: null,
  };
  const promise = new Promise((resolve, reject) => {
    state.resolve = resolve;
    state.reject = reject;
  });
  trekkingWildModalState = state;
  updateTrekkingWildPrompt();
  return promise;
}

function closeTrekkingWildModal() {
  if (!trekkingWildModal) {
    trekkingWildModalState = null;
    return;
  }
  trekkingWildModal.classList.add("hidden");
  trekkingWildModalState = null;
}

function updateTrekkingWildPrompt() {
  if (!trekkingWildModalState || !trekkingWildPrompt) {
    return;
  }
  const { stepIndex, total } = trekkingWildModalState;
  if (total <= 1) {
    trekkingWildPrompt.textContent = "Select 1 slot";
  } else {
    trekkingWildPrompt.textContent = `Select slot (${stepIndex}/${total})`;
  }
}

async function collectTrekkingWildChoices(total) {
  const choices = [];
  for (let i = 0; i < total; i += 1) {
    const col = await openTrekkingWildModal(i + 1, total);
    if (!Number.isInteger(col)) {
      throw new Error("wild selection canceled");
    }
    choices.push(col);
  }
  return choices;
}

function openTrekkingCrystalModal(options, label) {
  if (!trekkingCrystalModal || !trekkingCrystalSelect || !trekkingCrystalPrompt) {
    return Promise.reject(new Error("crystal modal unavailable"));
  }
  if (trekkingCrystalModalState) {
    return Promise.reject(new Error("crystal modal already open"));
  }
  trekkingCrystalSelect.innerHTML = "";
  options.forEach((value) => {
    const opt = document.createElement("option");
    opt.value = String(value);
    opt.textContent = String(value);
    trekkingCrystalSelect.appendChild(opt);
  });
  trekkingCrystalPrompt.textContent = label || `Choose 1 - ${options[options.length - 1]} crystals`;
  trekkingCrystalModal.classList.remove("hidden");
  const state = { resolve: null, reject: null };
  const promise = new Promise((resolve, reject) => {
    state.resolve = resolve;
    state.reject = reject;
  });
  trekkingCrystalModalState = state;
  return promise;
}

function closeTrekkingCrystalModal() {
  if (trekkingCrystalModal) {
    trekkingCrystalModal.classList.add("hidden");
  }
  trekkingCrystalModalState = null;
}

function openTrekkingScoreRules() {
  if (!trekkingScoreModal) {
    return;
  }
  setModalVisible(trekkingScoreModal, true);
}

function closeTrekkingScoreRules() {
  if (!trekkingScoreModal) {
    return;
  }
  setModalVisible(trekkingScoreModal, false);
}

function trekkingSlotReward(view, index) {
  const rewards = view && Array.isArray(view.slot_rewards) ? view.slot_rewards : TREKKING_SLOT_REWARDS;
  return rewards[index] || null;
}

function trekkingCardMaxSpend(view, card) {
  const you = getTrekkingYou(view);
  const crystals = you ? Number(you.crystals) || 0 : 0;
  if (!card) {
    return 0;
  }
  const cost = Number(card.cost) || 0;
  return Math.max(0, Math.min(crystals, cost - 1));
}

function trekkingAncestorMaxSpend(view) {
  const you = getTrekkingYou(view);
  const crystals = you ? Number(you.crystals) || 0 : 0;
  return Math.max(0, Math.min(crystals, 2));
}

function syncTrekkingSelection(view) {
  if (!view) {
    clearTrekkingSelections();
    return;
  }
  if (trekkingLastDay !== view.day) {
    clearTrekkingSelections();
    trekkingLastDay = view.day;
  }
  if (trekkingSelectedSlot !== null) {
    const card = (view.market || [])[trekkingSelectedSlot];
    if (!card) {
      trekkingSelectedSlot = null;
    }
  }
}

function updateTrekkingSelectionLabels(view) {
  if (!view) {
    return;
  }
  const card = trekkingSelectedSlot !== null ? (view.market || [])[trekkingSelectedSlot] : null;
  if (trekkingSelectedCardLabel) {
    trekkingSelectedCardLabel.textContent = card ? `${card.year_label || card.year} ${card.title}` : "-";
  }
  if (trekkingSelectedCostLabel) {
    trekkingSelectedCostLabel.textContent = card ? `${card.cost}` : "-";
  }
  if (trekkingSelectedTokensLabel) {
    trekkingSelectedTokensLabel.textContent = card ? trekkingTokensText(card.tokens) : "-";
  }
}

function updateTrekkingActionButtons() {
  if (!trekkingTakeCardBtn || !trekkingTakeAncestorBtn) {
    return;
  }
  if (currentGameType !== "trekking_history" || !currentTrekkingView) {
    trekkingTakeCardBtn.disabled = true;
    trekkingTakeAncestorBtn.disabled = true;
    if (trekkingTakeCardWithCrystalBtn) {
      trekkingTakeCardWithCrystalBtn.disabled = true;
    }
    if (trekkingTakeAncestorWithCrystalBtn) {
      trekkingTakeAncestorWithCrystalBtn.disabled = true;
    }
    return;
  }
  const view = currentTrekkingView;
  const legal = view.legal_actions || [];
  const card = trekkingSelectedSlot !== null ? (view.market || [])[trekkingSelectedSlot] : null;
  const cardMaxSpend = trekkingCardMaxSpend(view, card);
  const ancestorMaxSpend = trekkingAncestorMaxSpend(view);

  const canTakeCard = legal.includes("take_card") && !!card;
  const canTakeAncestor = legal.includes("take_ancestor");

  trekkingTakeCardBtn.disabled = !canTakeCard;
  trekkingTakeAncestorBtn.disabled = !canTakeAncestor;

  if (trekkingTakeCardWithCrystalBtn) {
    trekkingTakeCardWithCrystalBtn.disabled = !(legal.includes("take_card") && card && cardMaxSpend >= 1);
  }
  if (trekkingTakeAncestorWithCrystalBtn) {
    trekkingTakeAncestorWithCrystalBtn.disabled = !(legal.includes("take_ancestor") && ancestorMaxSpend >= 1);
  }
}

function renderTrekkingMarket(view) {
  if (!trekkingMarket) {
    return;
  }
  trekkingMarket.innerHTML = "";
  (view.market || []).forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "trekking-card";
    if (trekkingSelectedSlot === index) {
      button.classList.add("selected");
    }
    if (!card) {
      button.classList.add("empty");
      button.disabled = true;
    }

    const year = document.createElement("div");
    year.className = "trekking-card-year";
    year.textContent = card ? (card.year_label || card.year) : "Empty";
    button.appendChild(year);

    const title = document.createElement("div");
    title.className = "trekking-card-title";
    title.textContent = card ? card.title : "-";
    button.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "trekking-card-meta";
    if (card) {
      meta.textContent = `⏳ ${card.cost} | ${trekkingTokensText(card.tokens)}`;
    } else {
      meta.textContent = "-";
    }
    button.appendChild(meta);

    const reward = trekkingSlotReward(view, index);
    const rewardLabel = reward ? trekkingTokenIcon(reward) : "-";
    const slot = document.createElement("div");
    slot.className = "trekking-card-slot";
    slot.textContent = `Slot ${index + 1} Reward: ${rewardLabel}`;
    button.appendChild(slot);

    if (card) {
      button.addEventListener("click", () => {
        trekkingSelectedSlot = index;
        updateTrekkingSelectionLabels(view);
        renderTrekkingMarket(view);
        updateTrekkingActionButtons();
      });
    }
    trekkingMarket.appendChild(button);
  });
}

function renderTrekkingClock(view) {
  if (!trekkingClock) {
    return;
  }
  trekkingClock.innerHTML = "";
  const maxTime = 12;
  const grid = document.createElement("div");
  grid.className = "trekking-clock-grid";

  const buckets = Array.from({ length: maxTime + 1 }, () => []);
  (view.players || []).forEach((player) => {
    const time = Number(player.time) || 0;
    const index = Math.min(Math.max(time, 0), maxTime);
    buckets[index].push(player);
  });

  buckets.forEach((bucket) => {
    bucket.sort((a, b) => {
      const aOrder = Number(a.time_order) || 0;
      const bOrder = Number(b.time_order) || 0;
      if (aOrder !== bOrder) {
        return bOrder - aOrder;
      }
      const aSeat = Number(a.seat) || 0;
      const bSeat = Number(b.seat) || 0;
      if (aSeat !== bSeat) {
        return aSeat - bSeat;
      }
      const aName = a.name || a.player_id || "";
      const bName = b.name || b.player_id || "";
      return String(aName).localeCompare(String(bName));
    });
  });

  for (let i = 0; i <= maxTime; i += 1) {
    const slot = document.createElement("div");
    slot.className = "trekking-clock-slot";
    const label = document.createElement("div");
    label.className = "trekking-clock-slot-label";
    label.textContent = i === maxTime ? "12+" : String(i);
    slot.appendChild(label);
    const cell = document.createElement("div");
    cell.className = "trekking-clock-cell";
    buckets[i].forEach((player) => {
      const name = document.createElement("div");
      name.className = "trekking-clock-name";
      if (player.player_id === view.current_turn) {
        name.classList.add("current");
      }
      if (player.player_id === view.you) {
        name.classList.add("self");
      }
      name.textContent = player.name || player.player_id;
      cell.appendChild(name);
    });
    slot.appendChild(cell);
    grid.appendChild(slot);
  }
  trekkingClock.appendChild(grid);
}

function renderTrekkingPlayers(view) {
  if (!trekkingPlayers) {
    return;
  }
  trekkingPlayers.innerHTML = "";
  const templates = new Map((view.itinerary_templates || []).map((tpl) => [tpl.id, tpl]));
  const dayIndex = Number(view.day) ? Number(view.day) - 1 : 0;
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "trekking-player";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (player.player_id === view.you) {
      card.classList.add("self");
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
    const time = document.createElement("span");
    time.className = "badge";
    time.textContent = `time ${player.time ?? 0}`;
    badges.appendChild(time);
    const crystals = document.createElement("span");
    crystals.className = "badge";
    crystals.textContent = `💎 ${player.crystals ?? 0}`;
    badges.appendChild(crystals);
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

    const trekInfo = document.createElement("div");
    trekInfo.className = "trekking-player-meta";
    const lengths = player.trek_lengths && player.trek_lengths.length ? player.trek_lengths.join(", ") : "-";
    const lastYear = formatTrekkingYear(player.current_trek_last_year);
    trekInfo.textContent = `Treks: ${lengths} | Last Year: ${lastYear}`;
    card.appendChild(trekInfo);

    const trekScores = document.createElement("div");
    trekScores.className = "trekking-player-meta trekking-player-scores";
    const currentScore = Number.isFinite(player.current_trek_score) ? player.current_trek_score : 0;
    const totalScore = Number.isFinite(player.treks_total_score) ? player.treks_total_score : 0;
    const scoreText = document.createElement("span");
    scoreText.textContent = `Trek Score: ${currentScore} | Treks Total: ${totalScore}`;
    trekScores.appendChild(scoreText);
    const scoreLink = document.createElement("a");
    scoreLink.href = "#";
    scoreLink.className = "trekking-score-link";
    scoreLink.textContent = "得分规则";
    trekScores.appendChild(scoreLink);
    card.appendChild(trekScores);

    const itinerary = (player.itineraries || [])[dayIndex];
    if (itinerary) {
      const template = templates.get(itinerary.template_id);
      const nameRow = document.createElement("div");
      nameRow.className = "trekking-itinerary-name";
      nameRow.textContent = `Itinerary: ${itinerary.template_id || "-"}`;
      card.appendChild(nameRow);
      if (template && Array.isArray(template.grid)) {
        const grid = template.grid;
        const filled = itinerary.filled || [];
        const rowRewards = template.row_rewards || {};
        const rewardClaimed = itinerary.row_rewards_claimed || [];
        const header = document.createElement("div");
        header.className = "trekking-itinerary-header";
        TREKKING_COLUMN_LABELS.forEach((label, colIdx) => {
          const cell = document.createElement("div");
          cell.className = "trekking-itinerary-header-cell";
          cell.dataset.col = `${colIdx}`;
          const icon = document.createElement("div");
          icon.className = "trekking-itinerary-header-icon";
          icon.textContent = trekkingTokenIcon(TREKKING_SLOT_REWARDS[colIdx + 1] || "");
          const text = document.createElement("div");
          text.className = "trekking-itinerary-header-text";
          text.textContent = label;
          cell.appendChild(icon);
          cell.appendChild(text);
          header.appendChild(cell);
        });
        const spacer = document.createElement("div");
        spacer.className = "trekking-itinerary-header-spacer";
        header.appendChild(spacer);
        card.appendChild(header);
        const gridEl = document.createElement("div");
        gridEl.className = "trekking-itinerary-grid";
        for (let row = 0; row < grid.length; row += 1) {
          const rowData = grid[row] || [];
          for (let col = 0; col < rowData.length; col += 1) {
            const cellData = rowData[col];
            const cell = document.createElement("div");
            if (!cellData) {
              cell.className = "trekking-cell none";
            } else {
              cell.className = "trekking-cell";
              cell.dataset.col = `${col}`;
              const isFilled = filled[row] && filled[row][col] === true;
              if (isFilled) {
                cell.classList.add("filled");
              } else if (cellData.type === "swirl") {
                cell.textContent = `+${cellData.value || 0}`;
              } else if (cellData.type === "gem") {
                cell.textContent = "💎";
              }
            }
            gridEl.appendChild(cell);
          }
          const rewardValue = rowRewards[String(row)];
          const rewardCell = document.createElement("div");
          rewardCell.className = "trekking-row-reward";
          if (rewardValue !== undefined) {
            rewardCell.textContent = `+${rewardValue}`;
            if (rewardClaimed[row]) {
              rewardCell.classList.add("claimed");
            }
          } else {
            rewardCell.classList.add("empty");
            rewardCell.textContent = "";
          }
          gridEl.appendChild(rewardCell);
        }
        card.appendChild(gridEl);
      }
    }

    trekkingPlayers.appendChild(card);
  });
}

function renderTrekkingGameState(data) {
  const view = data.view;
  currentTrekkingView = view;
  if (currentGameType !== "trekking_history") {
    currentGameType = "trekking_history";
    setGamePanelVisibility("trekking_history");
  }

  syncTrekkingSelection(view);
  updateTrekkingSelectionLabels(view);

  if (trekkingDayLabel) {
    trekkingDayLabel.textContent = view.day || "-";
  }
  const currentPlayer = (view.players || []).find((player) => player.player_id === view.current_turn);
  if (trekkingTurnLabel) {
    trekkingTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (trekkingWinnerLabel) {
    if (view.winner && view.winner.length) {
      trekkingWinnerLabel.textContent = view.winner.map((pid) => findPlayerName(view, pid)).join(", ");
    } else {
      trekkingWinnerLabel.textContent = "-";
    }
  }
  if (trekkingDeckCountLabel) {
    trekkingDeckCountLabel.textContent = `${view.deck_count ?? 0}`;
  }
  if (trekkingDeckTopLabel) {
    if (view.deck_top) {
      trekkingDeckTopLabel.textContent = `${view.deck_top.year_label || view.deck_top.year} ${view.deck_top.title}`;
    } else {
      trekkingDeckTopLabel.textContent = "-";
    }
  }

  renderTrekkingClock(view);
  renderTrekkingMarket(view);
  renderTrekkingPlayers(view);

  logGameEvents(data);
  updateTrekkingActionButtons();
}

if (trekkingScoreCloseBtn) {
  trekkingScoreCloseBtn.addEventListener("click", () => {
    closeTrekkingScoreRules();
  });
}

if (trekkingScoreModal) {
  trekkingScoreModal.addEventListener("click", (event) => {
    if (event.target === trekkingScoreModal) {
      closeTrekkingScoreRules();
    }
  });
}

if (trekkingPanel) {
  trekkingPanel.addEventListener("click", (event) => {
    if (!currentTrekkingView || currentGameType !== "trekking_history") {
      return;
    }
    if (!trekkingPanel.contains(event.target)) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest(".trekking-card")) {
      return;
    }
    if (target.closest(".trekking-modal")) {
      return;
    }
    const scoreLink = target.closest(".trekking-score-link");
    if (scoreLink) {
      event.preventDefault();
      openTrekkingScoreRules();
      return;
    }
    if (target.closest("button") || target.closest("select") || target.closest("input") || target.closest("label") || target.closest("a")) {
      return;
    }
    clearTrekkingSelections();
    updateTrekkingSelectionLabels(currentTrekkingView);
    renderTrekkingMarket(currentTrekkingView);
    updateTrekkingActionButtons();
  });
}


if (trekkingWildModalButtons) {
  trekkingWildModalButtons.addEventListener("click", (event) => {
    const target = event.target;
    if (!trekkingWildModalState || !target || !target.dataset) {
      return;
    }
    const col = Number(target.dataset.col);
    if (!Number.isInteger(col)) {
      return;
    }
    const resolve = trekkingWildModalState.resolve;
    closeTrekkingWildModal();
    if (resolve) {
      resolve(col);
    }
  });
}

if (trekkingWildCancelBtn) {
  trekkingWildCancelBtn.addEventListener("click", () => {
    if (!trekkingWildModalState) {
      return;
    }
    const reject = trekkingWildModalState.reject;
    closeTrekkingWildModal();
    if (reject) {
      reject(new Error("cancel"));
    }
  });
}

if (trekkingCrystalConfirmBtn) {
  trekkingCrystalConfirmBtn.addEventListener("click", () => {
    if (!trekkingCrystalModalState || !trekkingCrystalSelect) {
      return;
    }
    const value = Number(trekkingCrystalSelect.value);
    const resolve = trekkingCrystalModalState.resolve;
    closeTrekkingCrystalModal();
    if (resolve) {
      resolve(value);
    }
  });
}

if (trekkingCrystalCancelBtn) {
  trekkingCrystalCancelBtn.addEventListener("click", () => {
    if (!trekkingCrystalModalState) {
      return;
    }
    const reject = trekkingCrystalModalState.reject;
    closeTrekkingCrystalModal();
    if (reject) {
      reject(new Error("cancel"));
    }
  });
}

if (trekkingTakeCardBtn) {
  trekkingTakeCardBtn.addEventListener("click", () => {
    if (!currentTrekkingView) {
      return;
    }
    if (trekkingSelectedSlot === null) {
      log("Select a card to take");
      return;
    }
    const card = (currentTrekkingView.market || [])[trekkingSelectedSlot];
    if (!card) {
      log("Selected card is not available");
      return;
    }
    const spend = 0;
    const wildNeeded = trekkingWildNeeded(card.tokens);
    const sendWithChoices = (choices) => {
      const action = {
        type: "take_card",
        slot_index: trekkingSelectedSlot,
        spend_crystals: spend,
        wild_choices: choices,
      };
      sendAction(action);
      clearTrekkingSelections();
      updateTrekkingSelectionLabels(currentTrekkingView);
      updateTrekkingActionButtons();
    };
    if (wildNeeded > 0) {
      collectTrekkingWildChoices(wildNeeded)
        .then((choices) => {
          sendWithChoices(choices);
        })
        .catch(() => {
          updateTrekkingSelectionLabels(currentTrekkingView);
          updateTrekkingActionButtons();
        });
      return;
    }
    sendWithChoices([]);
  });
}

if (trekkingTakeAncestorBtn) {
  trekkingTakeAncestorBtn.addEventListener("click", () => {
    if (!currentTrekkingView) {
      return;
    }
    const spend = 0;
    const sendWithChoices = (choices) => {
      const action = {
        type: "take_ancestor",
        spend_crystals: spend,
        wild_choices: choices,
      };
      sendAction(action);
      clearTrekkingSelections();
      updateTrekkingSelectionLabels(currentTrekkingView);
      updateTrekkingActionButtons();
    };
    collectTrekkingWildChoices(1)
      .then((choices) => {
        sendWithChoices(choices);
      })
      .catch(() => {
        updateTrekkingSelectionLabels(currentTrekkingView);
        updateTrekkingActionButtons();
      });
  });
}

if (trekkingTakeCardWithCrystalBtn) {
  trekkingTakeCardWithCrystalBtn.addEventListener("click", () => {
    if (!currentTrekkingView) {
      return;
    }
    if (trekkingSelectedSlot === null) {
      log("Select a card to take");
      return;
    }
    const card = (currentTrekkingView.market || [])[trekkingSelectedSlot];
    if (!card) {
      log("Selected card is not available");
      return;
    }
    const maxSpend = trekkingCardMaxSpend(currentTrekkingView, card);
    if (maxSpend < 1) {
      log("No crystals can be spent on this card");
      return;
    }
    const options = Array.from({ length: maxSpend }, (_, i) => i + 1);
    openTrekkingCrystalModal(options, `Spend crystals (1 - ${maxSpend})`)
      .then((spend) => {
        const wildNeeded = trekkingWildNeeded(card.tokens);
        const sendWithChoices = (choices) => {
          const action = {
            type: "take_card",
            slot_index: trekkingSelectedSlot,
            spend_crystals: spend,
            wild_choices: choices,
          };
          sendAction(action);
          clearTrekkingSelections();
          updateTrekkingSelectionLabels(currentTrekkingView);
          updateTrekkingActionButtons();
        };
        if (wildNeeded > 0) {
          return collectTrekkingWildChoices(wildNeeded).then(sendWithChoices);
        }
        sendWithChoices([]);
        return null;
      })
      .catch(() => {
        updateTrekkingSelectionLabels(currentTrekkingView);
        updateTrekkingActionButtons();
      });
  });
}

if (trekkingTakeAncestorWithCrystalBtn) {
  trekkingTakeAncestorWithCrystalBtn.addEventListener("click", () => {
    if (!currentTrekkingView) {
      return;
    }
    const maxSpend = trekkingAncestorMaxSpend(currentTrekkingView);
    if (maxSpend < 1) {
      log("No crystals can be spent on ancestor");
      return;
    }
    const options = Array.from({ length: maxSpend }, (_, i) => i + 1);
    openTrekkingCrystalModal(options, `Spend crystals (1 - ${maxSpend})`)
      .then((spend) => {
        const sendWithChoices = (choices) => {
          const action = {
            type: "take_ancestor",
            spend_crystals: spend,
            wild_choices: choices,
          };
          sendAction(action);
          clearTrekkingSelections();
          updateTrekkingSelectionLabels(currentTrekkingView);
          updateTrekkingActionButtons();
        };
        return collectTrekkingWildChoices(1).then(sendWithChoices);
      })
      .catch(() => {
        updateTrekkingSelectionLabels(currentTrekkingView);
        updateTrekkingActionButtons();
      });
  });
}

let trekkingExplainMode = false;

function showTrekkingHeaderActions(show) {
  if (trekkingHeaderActions) {
    trekkingHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitTrekkingExplainMode();
    closeTrekkingHelpModal();
    closeTrekkingExplainModal();
  }
}

function showTrekkingHelpModal() {
  if (!trekkingHelpModal) {
    return;
  }
  if (trekkingHelpContent) {
    trekkingHelpContent.innerHTML = TREKKING_HELP_TEXT;
  }
  setModalVisible(trekkingHelpModal, true);
}

function closeTrekkingHelpModal() {
  if (trekkingHelpModal) {
    setModalVisible(trekkingHelpModal, false);
  }
}

function updateTrekkingExplainModeClasses(enabled) {
  Object.keys(TREKKING_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
}

function findTrekkingButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(TREKKING_BUTTON_EXPLANATIONS)) {
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  return null;
}

function toggleTrekkingExplainMode() {
  trekkingExplainMode = !trekkingExplainMode;
  document.body.classList.toggle("trekking-explain-mode", trekkingExplainMode);
  updateTrekkingExplainModeClasses(trekkingExplainMode);
  if (trekkingExplainBtn) {
    trekkingExplainBtn.classList.toggle("active", trekkingExplainMode);
  }
}

function exitTrekkingExplainMode() {
  if (!trekkingExplainMode) {
    return;
  }
  trekkingExplainMode = false;
  document.body.classList.remove("trekking-explain-mode");
  updateTrekkingExplainModeClasses(false);
  if (trekkingExplainBtn) {
    trekkingExplainBtn.classList.remove("active");
  }
}

function showTrekkingButtonExplanation(buttonId) {
  const explanation = TREKKING_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !trekkingExplainContent || !trekkingExplainModal) {
    return;
  }
  const note = explanation.note ? `<div class="hint">${explanation.note}</div>` : "";
  trekkingExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    ${note}
  `;
  setModalVisible(trekkingExplainModal, true);
}

function closeTrekkingExplainModal() {
  if (trekkingExplainModal) {
    setModalVisible(trekkingExplainModal, false);
  }
}

if (trekkingHelpBtn) {
  trekkingHelpBtn.addEventListener("click", () => {
    showTrekkingHelpModal();
  });
}

if (trekkingHelpModalCloseBtn) {
  trekkingHelpModalCloseBtn.addEventListener("click", closeTrekkingHelpModal);
}

if (trekkingExplainBtn) {
  trekkingExplainBtn.addEventListener("click", () => {
    toggleTrekkingExplainMode();
  });
}

if (trekkingExplainModalCloseBtn) {
  trekkingExplainModalCloseBtn.addEventListener("click", closeTrekkingExplainModal);
}

document.addEventListener("pointerdown", (e) => {
  if (!trekkingExplainMode) return;

  const buttonId = findTrekkingButtonAtPoint(e.clientX, e.clientY);
  if (buttonId) {
    e.preventDefault();
    e.stopPropagation();
    showTrekkingButtonExplanation(buttonId);
    exitTrekkingExplainMode();
    return;
  }

  const button = e.target.closest("button");
  if (button === trekkingExplainBtn || button === trekkingHelpBtn) return;
  if (button === trekkingHelpModalCloseBtn || button === trekkingExplainModalCloseBtn) return;

  if (button) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

document.addEventListener("click", (e) => {
  if (!trekkingExplainMode) return;

  const button = e.target.closest("button");
  if (!button) return;

  if (button === trekkingExplainBtn || button === trekkingHelpBtn) return;
  if (button === trekkingHelpModalCloseBtn || button === trekkingExplainModalCloseBtn) return;

  e.preventDefault();
  e.stopPropagation();
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && trekkingExplainMode) {
    exitTrekkingExplainMode();
  }
});
