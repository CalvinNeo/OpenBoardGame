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

function updateSkullSelectedCard() {
  skullSelectedCardLabel.textContent = skullSelectedCardType || "-";
}

function updateSkullTargetSelection() {
  if (!skullSelectedTarget || !currentSkullView) {
    skullTargetSelection.textContent = "-";
    return;
  }
  const player = currentSkullView.players.find((p) => p.player_id === skullSelectedTarget);
  skullTargetSelection.textContent = player ? player.name : skullSelectedTarget;
}

function clearSkullSelection() {
  skullSelectedCardIndex = null;
  skullSelectedCardType = null;
  skullSelectedTarget = null;
  updateSkullSelectedCard();
  updateSkullTargetSelection();
  updateSkullActionButtons();
  if (currentSkullView) {
    renderSkullHand(currentSkullView);
    renderSkullTargets(currentSkullView);
  }
}

function updateSelectedSlots() {
  if (selectedSlotsLabel) {
    selectedSlotsLabel.textContent = selectedSlots.length ? selectedSlots.join(", ") : "-";
  }
}

function updateTargetSelection() {
  if (!targetSelection) {
    return;
  }
  if (!selectedTarget || !currentCaboView) {
    targetSelection.textContent = "-";
    return;
  }
  const player = currentCaboView.players.find((p) => p.player_id === selectedTarget.playerId);
  if (!player) {
    targetSelection.textContent = "-";
    return;
  }
  targetSelection.textContent = `${player.name} #${selectedTarget.slot}`;
}

function clearTargetSelection() {
  selectedTarget = null;
  updateTargetSelection();
  updateActionButtons();
  if (currentCaboView) {
    renderGamePlayers(currentCaboView);
  }
}

function clearFlip7TargetSelection() {
  flip7SelectedTarget = null;
  if (currentFlip7View) {
    updateFlip7TargetSelection(currentFlip7View);
    renderFlip7Players(currentFlip7View);
  } else {
    updateFlip7TargetSelection(null);
  }
  updateFlip7ActionButtons();
}

function isActionAvailable(actionType) {
  if (!currentCaboView || !Array.isArray(currentCaboView.legal_actions)) {
    return false;
  }
  if (actionType === "replace_or_match") {
    const canReplace = currentCaboView.legal_actions.includes("replace_card");
    const canMatch = currentCaboView.legal_actions.includes("attempt_match");
    if (selectedSlots.length >= 2) {
      return canMatch;
    }
    return selectedSlots.length >= 1 && canReplace;
  }
  if (!currentCaboView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "initial_peek") {
    return selectedSlots.length === 2;
  }
  if (actionType === "draw_discard") {
    return selectedSlots.length >= 1;
  }
  if (actionType === "use_choice_action") {
    if (!currentCaboView.pending_choice) {
      return false;
    }
    const choiceType = currentCaboView.pending_choice.type;
    if (choiceType === "peek") {
      return selectedSlots.length >= 1;
    }
    if (choiceType === "spy") {
      return !!selectedTarget;
    }
    if (choiceType === "swap") {
      return !!selectedTarget && selectedSlots.length >= 1;
    }
  }
  return true;
}

function updateActionButtons() {
  if (currentGameType !== "cabo") {
    Object.values(actionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(actionButtons).forEach(([actionType, button]) => {
    const allowed = isActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
}

function clearSelection() {
  selectedSlots = [];
  updateSelectedSlots();
  document.querySelectorAll(".slot").forEach((el) => {
    el.classList.remove("selected");
  });
  updateActionButtons();
}

function shouldSkipValidation() {
  return !!(skipValidationToggle && skipValidationToggle.checked);
}

function attachSkipValidation(payload) {
  if (skipValidationToggle) {
    payload.skip_validation = shouldSkipValidation();
  }
}

function sendAction(action) {
  if (!roomId) {
    log("Not in a room");
    return;
  }
  const payload = { room_id: roomId, action };
  attachSkipValidation(payload);
  recordActionLog(payload);
  socket.emit("game:action", payload);
}

function emitSeatMove(direction) {
  if (!roomId) {
    log("Not in a room");
    return;
  }
  socket.emit("room:move_seat", { room_id: roomId, direction });
}

function emitRoomStart() {
  if (!roomId) {
    log("Not in a room");
    return;
  }
  const payload = { room_id: roomId };
  attachSkipValidation(payload);
  if (currentGameType === "draw_guess") {
    const language = drawGuessLanguageSelect ? drawGuessLanguageSelect.value || "zh" : "zh";
    const guessMethod = drawGuessGuessMethodSelect ? drawGuessGuessMethodSelect.value || "normal" : "normal";
    const showAnswerLength = drawGuessAnswerLengthToggle ? drawGuessAnswerLengthToggle.checked : false;
    payload.config = { language, guess_method: guessMethod, show_answer_length: showAnswerLength };
  } else if (currentGameType === "cyber_pictures") {
    const allowDuplicates = cyberPicturesDuplicateToggle ? cyberPicturesDuplicateToggle.checked : false;
    const disabledTools = Array.from(cyberPicturesDisabledTools);
    if (disabledTools.length >= CYBER_TOOL_KEYS.length) {
      log("Select at least one tool");
      return;
    }
    payload.config = {
      allow_duplicate_targets: allowDuplicates,
      disabled_tools: disabledTools,
    };
  } else if (currentGameType === "aidixit") {
    const decks = getSelectedAidixitDecks();
    if (!decks.length) {
      log("Select at least one deck");
      return;
    }
    payload.config = { selected_decks: decks };
  } else if (currentGameType === "decrypto") {
    const packs = getSelectedDecryptoPacks();
    if (!packs.length) {
      log("Select at least one word pack");
      return;
    }
    const config = { word_packs: packs };
    if (roomHasBots()) {
      const botStrategy = getSelectedDecryptoBotStrategy();
      const botClueDirectness = getSelectedDecryptoBotClueDirectness();
      config.bot_strategy = botStrategy;
      config.bot_clue_directness = botClueDirectness;
    }
    payload.config = config;
  } else if (currentGameType === "halli_galli") {
    const deckMode = halliDeckSelect ? halliDeckSelect.value || "base" : "base";
    payload.config = { deck_mode: deckMode };
  } else if (currentGameType === "gold_rush") {
    const mode = goldRushModeSelect ? goldRushModeSelect.value || "hand" : "hand";
    payload.config = { mode };
  } else if (currentGameType === "hanabi") {
    const finalRoundCountdown = hanabiFinalRoundToggle ? hanabiFinalRoundToggle.checked : false;
    payload.config = { final_round_countdown: finalRoundCountdown };
  } else if (currentGameType === "texas_holdem") {
    const rawStarting = texasStartingChipsInput ? Number.parseInt(texasStartingChipsInput.value, 10) : NaN;
    const rawSmall = texasSmallBlindInput ? Number.parseInt(texasSmallBlindInput.value, 10) : NaN;
    const rawBig = texasBigBlindInput ? Number.parseInt(texasBigBlindInput.value, 10) : NaN;
    const startingChips = Number.isInteger(rawStarting) && rawStarting > 0 ? rawStarting : 1000;
    const smallBlind = Number.isInteger(rawSmall) && rawSmall > 0 ? rawSmall : 5;
    const bigBlind = Number.isInteger(rawBig) && rawBig > 0 ? rawBig : 10;
    if (smallBlind > bigBlind) {
      log("Small blind must be <= big blind");
      return;
    }
    payload.config = { starting_chips: startingChips, small_blind: smallBlind, big_blind: bigBlind };
  } else if (currentGameType === "perfect_mismatch") {
    const rawCount = mismatchSliderCount ? Number.parseInt(mismatchSliderCount.value, 10) : NaN;
    const sliderCount = Number.isInteger(rawCount) ? rawCount : 3;
    payload.config = { slider_count: sliderCount };
  } else if (currentGameType === "the_gang") {
    const mode = gangModeSelect ? gangModeSelect.value || "normal" : "normal";
    const rawLimit = gangTimeSelect ? Number.parseInt(gangTimeSelect.value, 10) : 0;
    const roundTimeLimit = Number.isInteger(rawLimit) ? rawLimit : 0;
    payload.config = { mode, round_time_limit_sec: roundTimeLimit };
  } else if (currentGameType === "impression_flower") {
    const allowReviewVotes = impressionVoteToggle ? impressionVoteToggle.checked : false;
    payload.config = { allow_review_votes: allowReviewVotes };
  } else if (currentGameType === "blitz_sketch") {
    const rawTime = blitzSketchDrawTimeSelect ? Number.parseFloat(blitzSketchDrawTimeSelect.value) : NaN;
    const drawTime = Number.isFinite(rawTime) && rawTime > 0 ? rawTime : 3;
    payload.config = { draw_time_sec: drawTime };
  }
  socket.emit("room:start", payload);
}

function renderRoomState(state) {
  currentRoomState = state;
  createRoomPending = false;
  setCreateGameRowVisible(false);
  roomId = state.room_id;
  clearPendingSeatClaim(state.room_id);
  const previousGame = currentGameType;
  currentGameType = state.game_type || null;
  roomIdLabel.textContent = state.room_id;
  roomStatus.textContent = state.status;
  gameTypeLabel.textContent = state.game_type || "-";
  updateRoomControlsForStatus(state.status);
  if (previousGame !== currentGameType) {
    clearSelection();
    clearTargetSelection();
    clearSkullSelection();
    clearCaboState();
    clearFlip7State();
    clearYahtzeeState();
    clearSkullState();
    clearCatInBoxState();
    clearGangState();
    clearMismatchState();
    clearDecryptoState();
    clearDrawGuessState();
    clearBlitzSketchState();
    clearAidixitState();
    clearImpressionFlowerState();
    clearSplendorState();
    clearAbracaState();
    clearBlokusState();
    clearCarcassonneState();
    clearHalliState();
    clearGoldRushState();
    clearIncanGoldState();
    clearHanabiState();
    clearTexasHoldemState();
    clearSixNimmtState();
  }
  setGamePanelVisibility(currentGameType);
  updateDrawGuessLanguageRow();
  updateCyberPicturesConfigRow();
  updateDecryptoPackRow();
  updateDecryptoBotRow();
  updateAidixitDeckRow();
  updateHalliConfigRow();
  updateGoldRushConfigRow();
  updateHanabiConfigRow();
  updateTexasHoldemConfigRow();
  updateMismatchConfigRow();
  updateGangConfigRow();
  updateImpressionConfigRow();
  updateBlitzSketchConfigRow();
  updateAutoSaveRow();
  updateReopenButton();
  playersList.innerHTML = "";
  const orderedPlayers = Array.isArray(state.players)
    ? [...state.players].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
    : [];
  orderedPlayers.forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "player-row";
    const line = document.createElement("div");
    const tags = [];
    if (p.is_bot) tags.push("bot");
    if (p.ready) tags.push("ready");
    if (!p.connected) tags.push("offline");
    if (p.player_id === playerId) tags.push("you");
    line.textContent = `${p.seat + 1}. ${p.name} (${tags.join(", ") || "human"})`;
    row.appendChild(line);
    if (state.status === "lobby" && p.player_id === playerId) {
      const controls = document.createElement("div");
      controls.className = "player-controls";
      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.textContent = "^";
      upBtn.title = "Move up";
      upBtn.disabled = idx === 0;
      upBtn.addEventListener("click", () => emitSeatMove("up"));
      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.textContent = "v";
      downBtn.title = "Move down";
      downBtn.disabled = idx === orderedPlayers.length - 1;
      downBtn.addEventListener("click", () => emitSeatMove("down"));
      controls.appendChild(upBtn);
      controls.appendChild(downBtn);
      row.appendChild(controls);
    }
    playersList.appendChild(row);
  });

  if (pendingReadyAfterJoin && pendingReadyRoomId === state.room_id) {
    pendingReadyAfterJoin = false;
    pendingReadyRoomId = null;
    if (state.status === "lobby") {
      const me = playerId ? state.players.find((p) => p.player_id === playerId) : null;
      if (!me || !me.ready) {
        socket.emit("room:ready", { room_id: state.room_id, ready: true });
      }
    }
  }
}

function renderHand(view) {
  handSlots.innerHTML = "";
  const you = view.players.find((p) => p.player_id === view.you);
  if (!you) {
    handSlots.textContent = "-";
    return;
  }
  you.hand.forEach((slot, idx) => {
    const div = document.createElement("div");
    div.className = "slot";
    if (slot.empty) div.classList.add("empty");
    div.dataset.slot = idx;
    let label = "?";
    if (slot.empty) {
      label = "Empty";
    } else if (slot.known) {
      label = String(slot.value);
    }
    div.textContent = `#${idx} ${label}`;
    if (selectedSlots.includes(idx)) div.classList.add("selected");
    div.addEventListener("click", () => {
      if (selectedSlots.includes(idx)) {
        selectedSlots = selectedSlots.filter((s) => s !== idx);
        div.classList.remove("selected");
      } else {
        selectedSlots.push(idx);
        div.classList.add("selected");
      }
      updateSelectedSlots();
      updateActionButtons();
    });
    handSlots.appendChild(div);
  });
}

function renderGamePlayers(view) {
  gamePlayers.innerHTML = "";
  const canSelectTarget =
    view.pending_choice &&
    (view.pending_choice.type === "spy" || view.pending_choice.type === "swap");
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }

    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name;
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const score = document.createElement("span");
    score.className = "badge";
    score.textContent = `score ${p.score}`;
    badges.appendChild(score);
    if (p.player_id === view.you) {
      const you = document.createElement("span");
      you.className = "badge";
      you.textContent = "you";
      badges.appendChild(you);
    }
    if (p.is_bot) {
      const bot = document.createElement("span");
      bot.className = "badge";
      bot.textContent = "bot";
      badges.appendChild(bot);
    }
    if (p.player_id === view.current_turn) {
      const turn = document.createElement("span");
      turn.className = "badge highlight";
      turn.textContent = "turn";
      badges.appendChild(turn);
    }
    header.appendChild(badges);

    const handRow = document.createElement("div");
    handRow.className = "player-hand";
    p.hand.forEach((slot, idx) => {
      const slotEl = document.createElement("div");
      slotEl.className = "player-slot";
      const isTargetPlayer = p.player_id !== view.you;
      const isSelectableTarget = canSelectTarget && isTargetPlayer && !slot.empty;
      if (slot.empty) {
        slotEl.classList.add("empty");
      }
      const label = slot.empty ? "Empty" : slot.known ? slot.value : "?";
      slotEl.textContent = `#${idx} ${label}`;
      if (
        selectedTarget &&
        selectedTarget.playerId === p.player_id &&
        selectedTarget.slot === idx
      ) {
        slotEl.classList.add("target-selected");
      }
      if (isSelectableTarget) {
        slotEl.classList.add("target-selectable");
        slotEl.addEventListener("click", () => {
          const isSameTarget =
            selectedTarget &&
            selectedTarget.playerId === p.player_id &&
            selectedTarget.slot === idx;
          selectedTarget = isSameTarget ? null : { playerId: p.player_id, slot: idx };
          updateActionButtons();
          renderGamePlayers(view);
        });
      }
      handRow.appendChild(slotEl);
    });

    const meta = document.createElement("div");
    meta.className = "player-meta";
    meta.textContent = `cards ${p.hand_count}`;

    card.appendChild(header);
    card.appendChild(handRow);
    card.appendChild(meta);
    gamePlayers.appendChild(card);
  });
}

function renderTargets(view) {
  if (!targetList) {
    updateTargetSelection();
    return;
  }
  targetList.innerHTML = "";
  view.players
    .filter((p) => p.player_id !== view.you)
    .forEach((p) => {
      const wrapper = document.createElement("div");
      wrapper.className = "target-player";
      const title = document.createElement("div");
      title.textContent = p.name;
      wrapper.appendChild(title);

      const slotsRow = document.createElement("div");
      slotsRow.className = "target-slots";
      p.hand.forEach((slot, idx) => {
        const slotEl = document.createElement("div");
        slotEl.className = "target-slot";
        const label = slot.empty ? "Empty" : slot.known ? slot.value : "?";
        slotEl.textContent = `#${idx} ${label}`;
        if (
          selectedTarget &&
          selectedTarget.playerId === p.player_id &&
          selectedTarget.slot === idx
        ) {
          slotEl.classList.add("selected");
        }
        slotEl.addEventListener("click", () => {
          if (slot.empty) {
            log("Target slot is empty");
            return;
          }
          selectedTarget = { playerId: p.player_id, slot: idx };
          updateTargetSelection();
          updateActionButtons();
          renderTargets(view);
        });
        slotsRow.appendChild(slotEl);
      });
      wrapper.appendChild(slotsRow);
      targetList.appendChild(wrapper);
    });
  updateTargetSelection();
}

function updateFlip7TargetSelection(view) {
  if (!flip7TargetSelection) {
    return;
  }
  if (!flip7SelectedTarget || !view) {
    flip7TargetSelection.textContent = "-";
    return;
  }
  const target = view.players.find((p) => p.player_id === flip7SelectedTarget);
  flip7TargetSelection.textContent = target ? target.name : "-";
}

function renderFlip7Tableau(view) {
  if (!flip7Tableau) {
    return;
  }
  flip7Tableau.innerHTML = "";
  const you = view.players.find((p) => p.player_id === view.you);
  if (!you || !Array.isArray(you.tableau) || !you.tableau.length) {
    flip7Tableau.textContent = "-";
    return;
  }
  you.tableau.forEach((card) => {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.textContent = card.label || "?";
    flip7Tableau.appendChild(slot);
  });
}

function renderFlip7Players(view) {
  if (!flip7Players) {
    return;
  }
  flip7Players.innerHTML = "";
  const pending = view.pending_action;
  const eligible = new Set((pending && pending.eligible_targets) || []);
  const isPendingActor = pending && view.you && pending.actor_id === view.you;
  if (flip7SelectedTarget && !eligible.has(flip7SelectedTarget)) {
    flip7SelectedTarget = null;
  }
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    const isEligible = eligible.has(player.player_id);
    if (pending && isEligible) {
      card.classList.add("flip7-target-eligible");
    }
    if (pending && isEligible && isPendingActor) {
      card.classList.add("flip7-target-selectable");
      card.addEventListener("click", () => {
        flip7SelectedTarget = player.player_id;
        updateFlip7TargetSelection(view);
        updateFlip7ActionButtons();
        renderFlip7Players(view);
        sendAction({ type: "choose_target", target_player_id: player.player_id });
      });
    }
    if (flip7SelectedTarget === player.player_id) {
      card.classList.add("flip7-target-selected");
    }
    if (player.status !== "active") {
      card.classList.add("disabled");
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
    const status = document.createElement("span");
    status.className = "badge";
    const isBusted = player.status === "out" && player.round_score === 0;
    const displayStatus =
      isBusted ? "busted" : (player.status === "out" ? "out" : (player.status || "-"));
    status.textContent = displayStatus;
    if (isBusted) {
      status.classList.add("danger");
    }
    badges.appendChild(status);
    if (player.round_score !== null && player.round_score !== undefined) {
      const roundScore = document.createElement("span");
      roundScore.className = "badge";
      roundScore.textContent = `round ${player.round_score}`;
      badges.appendChild(roundScore);
    }
    if (player.flip7) {
      const flip7 = document.createElement("span");
      flip7.className = "badge highlight";
      flip7.textContent = "flip7flash";
      badges.appendChild(flip7);
    }
    if (player.has_second_chance) {
      const chance = document.createElement("span");
      chance.className = "badge";
      chance.textContent = "second chance";
      badges.appendChild(chance);
    }
    if (player.player_id === view.you) {
      const you = document.createElement("span");
      you.className = "badge";
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

    const tableauRow = document.createElement("div");
    tableauRow.className = "player-hand";
    if (Array.isArray(player.tableau) && player.tableau.length) {
      player.tableau.forEach((cardData) => {
        const slot = document.createElement("div");
        slot.className = "player-slot";
        slot.textContent = cardData.label || "?";
        tableauRow.appendChild(slot);
      });
    } else {
      const slot = document.createElement("div");
      slot.className = "player-slot empty";
      slot.textContent = "-";
      tableauRow.appendChild(slot);
    }

    const meta = document.createElement("div");
    meta.className = "player-meta";
    meta.textContent = `numbers ${player.numbers_count ?? 0}`;

    card.appendChild(header);
    card.appendChild(tableauRow);
    card.appendChild(meta);
    if (player.player_id === view.you) {
      const actionsRow = document.createElement("div");
      actionsRow.className = "flip7-player-actions row actions";
      if (flip7FlipBtn) {
        actionsRow.appendChild(flip7FlipBtn);
      }
      if (flip7StayBtn) {
        actionsRow.appendChild(flip7StayBtn);
      }
      if (actionsRow.children.length) {
        card.appendChild(actionsRow);
      }
    }
    flip7Players.appendChild(card);
  });
}

function renderFlip7LastRound(view) {
  if (!flip7LastRound) {
    return;
  }
  flip7LastRound.innerHTML = "";
  const summary = view.last_round_summary;
  if (!summary) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No previous round yet.";
    flip7LastRound.appendChild(empty);
    return;
  }

  const meta = document.createElement("div");
  meta.className = "hint";
  const roundText = Number.isInteger(summary.round) ? `Round ${summary.round}` : "Last round";
  const reasonText = summary.reason ? ` (${summary.reason})` : "";
  meta.textContent = `${roundText}${reasonText}`;
  flip7LastRound.appendChild(meta);

  const flipsByPlayer = summary.flips || {};
  const statusByPlayer = summary.status || {};
  const roundScoresByPlayer = summary.round_scores || {};
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";

    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id;
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const status = statusByPlayer[player.player_id] || "-";
    const roundScore = roundScoresByPlayer[player.player_id];
    const isBusted = status === "out" && roundScore === 0;
    const displayStatus = isBusted ? "busted" : status;
    const statusBadge = document.createElement("span");
    statusBadge.className = "badge";
    statusBadge.textContent = displayStatus;
    if (isBusted) {
      statusBadge.classList.add("danger");
    }
    badges.appendChild(statusBadge);
    if (summary.flip7_winner === player.player_id) {
      const flip7 = document.createElement("span");
      flip7.className = "badge highlight";
      flip7.textContent = "flip7flash";
      badges.appendChild(flip7);
    }
    header.appendChild(badges);
    card.appendChild(header);

    const flipsRow = document.createElement("div");
    flipsRow.className = "player-hand";
    const flips = Array.isArray(flipsByPlayer[player.player_id])
      ? flipsByPlayer[player.player_id]
      : [];
    if (flips.length) {
      flips.forEach((flip) => {
        const slot = document.createElement("div");
        slot.className = "player-slot";
        const label = typeof flip === "string" ? flip : flip.label;
        slot.textContent = label || "?";
        flipsRow.appendChild(slot);
      });
    } else {
      const slot = document.createElement("div");
      slot.className = "player-slot empty";
      slot.textContent = "-";
      flipsRow.appendChild(slot);
    }

    card.appendChild(flipsRow);
    flip7LastRound.appendChild(card);
  });
}

function findPlayerName(view, playerId) {
  const player = view.players.find((p) => p.player_id === playerId);
  return player ? player.name : playerId;
}

function renderSkullHand(view) {
  skullHand.innerHTML = "";
  if (!Array.isArray(view.hand) || !view.hand.length) {
    skullHand.textContent = "-";
    updateSkullSelectedCard();
    return;
  }
  view.hand.forEach((card, idx) => {
    const div = document.createElement("div");
    div.className = "slot";
    div.textContent = card;
    if (idx === skullSelectedCardIndex) {
      div.classList.add("selected");
    }
    div.addEventListener("click", () => {
      skullSelectedCardIndex = idx;
      skullSelectedCardType = card;
      updateSkullSelectedCard();
      updateSkullActionButtons();
      renderSkullHand(view);
    });
    skullHand.appendChild(div);
  });
}

function getSkullRevealTargets(view) {
  if (view.phase !== "reveal" || view.you !== view.bidder) {
    return [];
  }
  const you = view.players.find((p) => p.player_id === view.you);
  if (you && you.pile_count > 0) {
    return [view.you];
  }
  return view.players
    .filter((p) => !p.eliminated && p.pile_count > 0)
    .map((p) => p.player_id);
}

function renderSkullTargets(view) {
  skullTargets.innerHTML = "";
  const allowedTargets = getSkullRevealTargets(view);
  view.players.forEach((p) => {
    if (p.eliminated) {
      return;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "target-player";
    if (allowedTargets.includes(p.player_id)) {
      wrapper.classList.add("selectable");
    } else {
      wrapper.classList.add("disabled");
    }
    if (skullSelectedTarget === p.player_id) {
      wrapper.classList.add("selected");
    }
    wrapper.textContent = `${p.name} (pile ${p.pile_count})`;
    wrapper.addEventListener("click", () => {
      if (!allowedTargets.includes(p.player_id)) {
        return;
      }
      skullSelectedTarget = p.player_id;
      updateSkullTargetSelection();
      updateSkullActionButtons();
      renderSkullTargets(view);
    });
    skullTargets.appendChild(wrapper);
  });
  updateSkullTargetSelection();
}

function renderSkullPlayers(view) {
  skullPlayers.innerHTML = "";
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (p.eliminated) {
      card.classList.add("disabled");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name;
    const meta = document.createElement("div");
    meta.className = "player-meta";
    const status = p.eliminated ? "out" : "in";
    meta.textContent = `hand ${p.hand_count} | pile ${p.pile_count} | wins ${p.rounds_won} | ${status}`;
    card.appendChild(name);
    card.appendChild(meta);
    skullPlayers.appendChild(card);
  });
}

const catInBoxColorEmoji = {
  red: "🟥",
  blue: "🟦",
  yellow: "🟨",
  green: "🟩",
};

function formatCatInBoxColor(color) {
  if (!color) {
    return "-";
  }
  const emoji = catInBoxColorEmoji[color] || "";
  const name = color.charAt(0).toUpperCase() + color.slice(1);
  return emoji ? `${emoji} ${name}` : name;
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
    if (catInBoxSelectedColor === color) {
      button.classList.add("selected");
    } else {
      button.classList.remove("selected");
    }
  });
}

function renderCatInBoxHand(view) {
  if (!catInBoxHand) {
    return;
  }
  catInBoxHand.innerHTML = "";
  if (!Array.isArray(view.hand) || !view.hand.length) {
    catInBoxHand.textContent = "-";
    updateCatInBoxSelectionLabels();
    return;
  }
  view.hand.forEach((value) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "slot";
    btn.textContent = String(value);
    if (catInBoxSelectedCard === value) {
      btn.classList.add("selected");
    }
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
    label.textContent = formatCatInBoxColor(color);
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
        if (name) {
          cell.title = name;
        }
        cell.classList.add("occupied");
        cell.disabled = true;
      } else {
        cell.textContent = String(value);
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
      if (!cell.disabled) {
        cell.addEventListener("click", () => {
          if (!Number.isInteger(catInBoxSelectedCard)) {
            log("Select a card first.");
            return;
          }
          if (!catInBoxIsSelectionLegal(view, value, color)) {
            log("That slot is not legal.");
            return;
          }
          catInBoxSelectedColor = color;
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
    catInBoxTrick.textContent = "-";
    return;
  }
  trick.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "cat-box-trick-card";
    const name = entry.name || findPlayerName(view, entry.player_id);
    card.textContent = `${name}: ${formatCatInBoxColor(entry.color)} ${entry.value}`;
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
    meta.textContent = `bid ${bidLabel} | tricks ${p.tricks_won ?? 0} | score ${p.score ?? 0}`;
    const voids = Array.isArray(p.void_colors) ? p.void_colors : [];
    if (voids.length) {
      const voidLine = document.createElement("div");
      voidLine.className = "player-meta";
      const voidLabels = voids.map((color) => formatCatInBoxColor(color)).join(" ");
      voidLine.textContent = `void ${voidLabels}`;
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
    catInBoxSummary.classList.add("hidden");
    catInBoxSummaryBody.textContent = "-";
    return;
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

function updateMismatchButtons(view) {
  if (!mismatchRevealBtn || !mismatchNextRoundBtn || !mismatchPlayAgainBtn) {
    return;
  }
  const actions = view && Array.isArray(view.legal_actions) ? view.legal_actions : [];
  const revealAllowed = actions.includes("reveal");
  mismatchRevealBtn.disabled = !revealAllowed;
  mismatchRevealBtn.classList.toggle("action-allowed", revealAllowed);
  const nextAllowed = actions.includes("next_round");
  mismatchNextRoundBtn.disabled = !nextAllowed;
  mismatchNextRoundBtn.classList.toggle("action-allowed", nextAllowed);
  const playAllowed = actions.includes("play_again");
  mismatchPlayAgainBtn.disabled = !playAllowed;
  mismatchPlayAgainBtn.classList.toggle("action-allowed", playAllowed);
}

function renderMismatchWords(view) {
  if (!mismatchWords) {
    return;
  }
  mismatchWords.innerHTML = "";
  const words = Array.isArray(view.words) ? view.words : [];
  const canGuess = Array.isArray(view.legal_actions) && view.legal_actions.includes("submit_guess");
  const yourGuess = view.your_guess;
  words.forEach((word, index) => {
    const card = document.createElement("div");
    card.className = "mismatch-word-card";
    if (yourGuess && yourGuess.choice === index) {
      card.classList.add("guessed");
    }
    if (view.target_index === index) {
      card.classList.add("target");
    }

    const title = document.createElement("div");
    title.className = "mismatch-word-title";
    title.textContent = `${index + 1}. ${word}`;
    card.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "mismatch-word-actions";
    const guessBtn = document.createElement("button");
    guessBtn.type = "button";
    guessBtn.textContent = "Guess";
    guessBtn.disabled = !canGuess || !!yourGuess;
    guessBtn.addEventListener("click", () => {
      sendAction({ type: "submit_guess", choice_index: index });
    });
    actions.appendChild(guessBtn);

    if (yourGuess && yourGuess.choice === index) {
      const locked = document.createElement("span");
      const order = Number.isInteger(yourGuess.order) ? `#${yourGuess.order}` : "#-";
      locked.textContent = `Locked ${order}`;
      actions.appendChild(locked);
    }

    card.appendChild(actions);
    mismatchWords.appendChild(card);
  });
}

const MISMATCH_SLIDER_LEFT_COLOR = [220, 38, 38];
const MISMATCH_SLIDER_RIGHT_COLOR = [37, 99, 235];

function getMismatchSliderColor(ratio) {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const r = Math.round(
    MISMATCH_SLIDER_LEFT_COLOR[0] +
      (MISMATCH_SLIDER_RIGHT_COLOR[0] - MISMATCH_SLIDER_LEFT_COLOR[0]) * clamped
  );
  const g = Math.round(
    MISMATCH_SLIDER_LEFT_COLOR[1] +
      (MISMATCH_SLIDER_RIGHT_COLOR[1] - MISMATCH_SLIDER_LEFT_COLOR[1]) * clamped
  );
  const b = Math.round(
    MISMATCH_SLIDER_LEFT_COLOR[2] +
      (MISMATCH_SLIDER_RIGHT_COLOR[2] - MISMATCH_SLIDER_LEFT_COLOR[2]) * clamped
  );
  return `rgb(${r}, ${g}, ${b})`;
}

function updateMismatchSliderColor(input) {
  if (!input) {
    return;
  }
  const rawValue = Number.parseInt(input.value, 10);
  const rawMin = Number.parseInt(input.min, 10);
  const rawMax = Number.parseInt(input.max, 10);
  const minValue = Number.isInteger(rawMin) ? rawMin : 0;
  const maxValue = Number.isInteger(rawMax) ? rawMax : 10;
  const fallback = minValue + (maxValue - minValue) / 2;
  const value = Number.isInteger(rawValue) ? rawValue : fallback;
  const clampedValue = Math.min(Math.max(value, minValue), maxValue);
  const ratio = maxValue > minValue ? (clampedValue - minValue) / (maxValue - minValue) : 0.5;
  input.style.setProperty("--mismatch-slider-color", getMismatchSliderColor(ratio));
}

function renderMismatchSliders(view) {
  if (!mismatchSliders) {
    return;
  }
  mismatchSliders.innerHTML = "";
  const sliders = Array.isArray(view.sliders) ? view.sliders : [];
  const isLeader = view.leader_id === view.you;
  const canSet = Array.isArray(view.legal_actions) && view.legal_actions.includes("set_slider");
  const activeIndex = Number.isInteger(view.active_slider_index) ? view.active_slider_index : 0;

  sliders.forEach((slider, index) => {
    const row = document.createElement("div");
    row.className = "mismatch-slider-row";

    const left = document.createElement("div");
    left.className = "mismatch-slider-label left";
    left.textContent = slider.left_attr || "-";

    const right = document.createElement("div");
    right.className = "mismatch-slider-label right";
    right.textContent = slider.right_attr || "-";

    const valueLabel = document.createElement("div");
    valueLabel.className = "mismatch-slider-value";
    const value = Number.isInteger(slider.value) ? slider.value : null;
    valueLabel.textContent = value === null ? "?" : String(value);

    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "10";
    input.step = "1";
    input.value = value === null ? "5" : String(value);
    input.className = "mismatch-slider";
    if (value === null) {
      input.classList.add("pending");
    }
    const isActive = isLeader && canSet && index === activeIndex;
    input.disabled = !isActive;
    updateMismatchSliderColor(input);
    input.addEventListener("input", () => {
      updateMismatchSliderColor(input);
    });

    const setBtn = document.createElement("button");
    setBtn.type = "button";
    setBtn.textContent = "Set";
    setBtn.className = "mismatch-slider-set";
    setBtn.disabled = !isActive;
    setBtn.addEventListener("click", () => {
      const rawValue = Number.parseInt(input.value, 10);
      const sliderValue = Number.isInteger(rawValue) ? rawValue : 5;
      sendAction({ type: "set_slider", slider_index: index, value: sliderValue });
    });

    const sliderLine = document.createElement("div");
    sliderLine.className = "mismatch-slider-line";
    sliderLine.appendChild(input);
    sliderLine.appendChild(valueLabel);

    const labelsLine = document.createElement("div");
    labelsLine.className = "mismatch-slider-labels";
    labelsLine.appendChild(left);
    labelsLine.appendChild(setBtn);
    labelsLine.appendChild(right);

    row.appendChild(sliderLine);
    row.appendChild(labelsLine);
    mismatchSliders.appendChild(row);
  });
}

function renderMismatchPlayers(view) {
  if (!mismatchPlayers) {
    return;
  }
  mismatchPlayers.innerHTML = "";
  view.players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "player-row";
    const tags = [];
    if (player.player_id === view.leader_id) {
      tags.push("leader");
    }
    if (player.is_bot) {
      tags.push("bot");
    }
    if (player.guessed) {
      const order = Number.isInteger(player.guess_order) ? `#${player.guess_order}` : "#-";
      tags.push(`guessed ${order}`);
    }
    const suffix = tags.length ? ` (${tags.join(", ")})` : "";
    row.textContent = `${player.name} - ${player.score} pts${suffix}`;
    mismatchPlayers.appendChild(row);
  });
}

function renderMismatchSummary(view) {
  if (!mismatchRoundSummary || !mismatchRoundSummaryBody || !mismatchRoundSummaryGuesses) {
    return;
  }
  const summary = view.last_round_summary;
  if (!summary) {
    mismatchRoundSummary.classList.add("hidden");
    mismatchRoundSummaryBody.textContent = "-";
    mismatchRoundSummaryGuesses.innerHTML = "";
    return;
  }

  const leaderName = findPlayerName(view, summary.leader_id);
  const leaderDelta = summary.leader_delta;
  const deltaLabel = leaderDelta >= 0 ? `+${leaderDelta}` : String(leaderDelta);
  const correctLabel = `${summary.correct_count}/${summary.guess_count}`;
  mismatchRoundSummaryBody.textContent = `${leaderName} target: ${summary.target_word} | correct ${correctLabel} | leader ${deltaLabel}`;

  mismatchRoundSummaryGuesses.innerHTML = "";
  const words = Array.isArray(summary.words) ? summary.words : [];
  const guesses = Array.isArray(summary.guesses) ? summary.guesses : [];
  guesses.forEach((entry) => {
    const line = document.createElement("div");
    const choiceLabel =
      Number.isInteger(entry.choice_index) && words[entry.choice_index]
        ? `${entry.choice_index + 1}. ${words[entry.choice_index]}`
        : "-";
    const orderLabel = Number.isInteger(entry.order) ? `#${entry.order}` : "-";
    const resultLabel = entry.correct ? "correct" : "wrong";
    const pointsLabel = entry.points ? `+${entry.points}` : "0";
    line.textContent = `${entry.name}: ${choiceLabel} (${orderLabel}, ${resultLabel}, ${pointsLabel})`;
    mismatchRoundSummaryGuesses.appendChild(line);
  });

  mismatchRoundSummary.classList.remove("hidden");
}

function formatCoyoteSummary(view) {
  const summary = view.last_round_summary;
  if (!summary) {
    return "-";
  }
  const bidder = findPlayerName(view, summary.bidder);
  const challenger = findPlayerName(view, summary.challenger);
  const loser = findPlayerName(view, summary.loser);
  const result = summary.success ? "challenge success" : "challenge fail";
  let text = `${result}: bid ${summary.bid}, total ${summary.actual_total}, loser ${loser}`;
  if (Array.isArray(summary.mystery_draws)) {
    const draws = summary.mystery_draws.filter((item) => item);
    if (draws.length) {
      text += ` | ? draws ${draws.join(", ")}`;
    }
  }
  if (Array.isArray(summary.max_zero_applied) && summary.max_zero_applied.length) {
    text += ` | max->0 ${summary.max_zero_applied.join(", ")}`;
  }
  if (summary.x2_count) {
    text += ` | x${2 ** summary.x2_count}`;
  }
  text += ` | bidder ${bidder}, challenger ${challenger}`;
  return text;
}

function getCoyoteMinBid(view) {
  if (!view || view.last_bid === null || view.last_bid === undefined) {
    return 1;
  }
  return Number(view.last_bid) + 1;
}

function updateCoyoteBidInput(view, previousView) {
  if (!coyoteBidInput) {
    return;
  }
  const minBid = getCoyoteMinBid(view);
  coyoteBidInput.min = String(minBid);
  const current = Number.parseInt(coyoteBidInput.value, 10);
  const newRound = !previousView || previousView.round !== view.round;
  const shouldUpdate = !Number.isInteger(current) || current < minBid || (newRound && current !== minBid);
  if (shouldUpdate && document.activeElement !== coyoteBidInput) {
    coyoteBidInput.value = minBid;
  }
}

function updateCoyoteBidControls(view) {
  if (!coyoteBidInput || !coyoteBidMinusBtn || !coyoteBidPlusBtn) {
    return;
  }
  const canEdit =
    view &&
    Array.isArray(view.legal_actions) &&
    view.legal_actions.includes("bid") &&
    view.phase !== "game_over";
  coyoteBidInput.disabled = !canEdit;
  coyoteBidMinusBtn.disabled = !canEdit;
  coyoteBidPlusBtn.disabled = !canEdit;
  if (canEdit) {
    const minBid = getCoyoteMinBid(view);
    const current = Number.parseInt(coyoteBidInput.value, 10);
    coyoteBidMinusBtn.disabled = !Number.isInteger(current) || current <= minBid;
  }
}

function adjustCoyoteBid(delta) {
  if (!coyoteBidInput) {
    return;
  }
  const minBid = getCoyoteMinBid(currentCoyoteView);
  let current = Number.parseInt(coyoteBidInput.value, 10);
  if (!Number.isInteger(current)) {
    current = minBid;
  }
  const next = Math.max(minBid, current + delta);
  coyoteBidInput.value = next;
  updateCoyoteActionButtons();
}

function renderCoyoteRoundNotice(view) {
  if (!coyoteRoundNotice || !coyoteRoundNoticeBody) {
    return;
  }
  coyoteRoundNotice.classList.remove("hidden");
  while (coyoteRoundNoticeBody.firstChild) {
    coyoteRoundNoticeBody.removeChild(coyoteRoundNoticeBody.firstChild);
  }
  const summaryText = view.last_round_summary ? formatCoyoteSummary(view) : "No previous round yet.";
  const summaryLine = document.createElement("div");
  summaryLine.textContent = summaryText;
  coyoteRoundNoticeBody.appendChild(summaryLine);

  const yourCard = view.your_card || "-";
  const cardLine = document.createElement("div");
  cardLine.textContent = `Your hidden card: ${yourCard}`;
  coyoteRoundNoticeBody.appendChild(cardLine);
}

function renderCoyotePlayers(view) {
  if (!coyotePlayers) {
    return;
  }
  coyotePlayers.innerHTML = "";
  view.players.forEach((p, index) => {
    const card = document.createElement("div");
    card.className = "player-card coyote-player-card";
    const seatIndex = (index % 10) + 1;
    card.classList.add(`coyote-seat-${seatIndex}`);
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (p.eliminated) {
      card.classList.add("disabled");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name;
    const meta = document.createElement("div");
    meta.className = "player-meta coyote-player-meta";
    let cardLabel = p.card;
    if (!cardLabel && p.card_hidden) {
      cardLabel = "Hidden";
    } else if (!cardLabel) {
      cardLabel = "-";
    }
    const maxPenalties = view.config ? view.config.max_penalties : "-";
    const status = p.eliminated ? "out" : "in";
    const cardLine = document.createElement("div");
    cardLine.className = "coyote-player-meta-line";
    cardLine.append("card ");
    const cardValue = document.createElement("span");
    cardValue.textContent = cardLabel;
    if (cardLabel !== "-") {
      cardValue.className = "coyote-card-value";
    }
    cardLine.appendChild(cardValue);

    const penaltiesLine = document.createElement("div");
    penaltiesLine.className = "coyote-player-meta-line";
    penaltiesLine.textContent = `penalties ${p.penalties}/${maxPenalties}`;

    const statusLine = document.createElement("div");
    statusLine.className = "coyote-player-meta-line";
    statusLine.textContent = status;

    meta.append(cardLine, penaltiesLine, statusLine);
    card.appendChild(name);
    card.appendChild(meta);
    coyotePlayers.appendChild(card);
  });
}

function formatHalliFruit(fruit) {
  if (!fruit) {
    return "?";
  }
  return halliFruitEmoji[fruit] || fruit;
}

function formatHalliFruitList(fruits, totals = null) {
  if (!Array.isArray(fruits) || !fruits.length) {
    return "-";
  }
  return fruits
    .map((fruit) => {
      const emoji = formatHalliFruit(fruit);
      if (totals && Object.prototype.hasOwnProperty.call(totals, fruit)) {
        return `${emoji} ${totals[fruit]}`;
      }
      return emoji;
    })
    .join(", ");
}

function formatHalliCard(card) {
  if (!card) {
    return "-";
  }
  if (Array.isArray(card.fruits) && card.fruits.length) {
    const parts = card.fruits.map((entry) => {
      if (!entry) {
        return "?";
      }
      const emoji = formatHalliFruit(entry.fruit);
      const count = Number.isFinite(entry.count) ? entry.count : null;
      return count !== null ? `${emoji} ${count}` : emoji;
    });
    return parts.join(" + ");
  }
  const emoji = formatHalliFruit(card.fruit);
  const count = Number.isFinite(card.count) ? card.count : null;
  if (count !== null) {
    return `${emoji} ${count}`;
  }
  return emoji;
}

function formatHalliLastAction(view) {
  const last = view ? view.last_action : null;
  if (!last) {
    return "-";
  }
  const actor = last.player_id ? findPlayerName(view, last.player_id) : "Unknown";
  if (last.type === "flip") {
    const card = last.card;
    const cardLabel = card ? formatHalliCard(card) : "card";
    return `${actor} flipped ${cardLabel}`;
  }
  if (last.type === "ring") {
    if (last.result === "success") {
      const fruits = formatHalliFruitList(last.bell_fruits);
      return `${actor} rang (success: ${fruits}, +${last.collected || 0} cards)`;
    }
    return `${actor} rang (false, penalty ${last.penalty_given || 0})`;
  }
  return "-";
}

function formatHalliLastRingResult(view) {
  const last = view ? view.last_ring_result : null;
  if (!last) {
    return "-";
  }
  const actor = last.player_id ? findPlayerName(view, last.player_id) : "Unknown";
  const fruits = formatHalliFruitList(last.fruits);
  if (last.result === "success") {
    return `${actor} success: ${fruits}`;
  }
  return `${actor} fail: ${fruits}`;
}

function halliNowMs() {
  return Date.now() + halliServerTimeOffsetMs;
}

function formatCountdownMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "Ready";
  }
  if (ms < 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.ceil(ms / 1000)}s`;
}

function resetHalliCountdownLabels() {
  if (halliFlipCountdownLabel) {
    halliFlipCountdownLabel.textContent = "-";
    halliFlipCountdownLabel.classList.remove("halli-countdown-active");
  }
  if (halliRingCountdownLabel) {
    halliRingCountdownLabel.textContent = "-";
    halliRingCountdownLabel.classList.remove("halli-countdown-active");
  }
}

function startHalliCountdownTimer() {
  if (halliCountdownTimer || (!halliFlipCountdownLabel && !halliRingCountdownLabel)) {
    return;
  }
  halliCountdownTimer = window.setInterval(() => {
    if (currentGameType !== "halli_galli") {
      stopHalliCountdownTimer();
      return;
    }
    updateHalliCountdownLabels();
  }, 200);
}

function stopHalliCountdownTimer() {
  if (!halliCountdownTimer) {
    return;
  }
  window.clearInterval(halliCountdownTimer);
  halliCountdownTimer = null;
}

function updateHalliCountdownState(view) {
  if (!view) {
    halliCountdownState = {
      flipReadyAtMs: 0,
      ringReadyAtMs: 0,
      ringPending: false,
      turnSwitchAtMs: 0,
      flipWaitMs: 0,
    };
    halliServerTimeOffsetMs = 0;
    stopHalliCountdownTimer();
    resetHalliCountdownLabels();
    return;
  }
  const serverNow = Number(view.server_now_ms);
  if (Number.isFinite(serverNow)) {
    halliServerTimeOffsetMs = serverNow - Date.now();
  }
  const flipReadyAtMs = Number(view.flip_ready_at_ms);
  const flipWaitMs = view.config ? Number(view.config.flip_wait_ms) : 0;
  const pending = view.pending_flip;
  const ringReadyAtMs = pending ? Number(pending.reveal_at_ms) : 0;
  const turnSwitchAtMs = Number(view.turn_switch_at_ms);
  halliCountdownState = {
    flipReadyAtMs: Number.isFinite(flipReadyAtMs) ? flipReadyAtMs : 0,
    ringReadyAtMs: Number.isFinite(ringReadyAtMs) ? ringReadyAtMs : 0,
    ringPending: !!pending,
    turnSwitchAtMs: Number.isFinite(turnSwitchAtMs) ? turnSwitchAtMs : 0,
    flipWaitMs: Number.isFinite(flipWaitMs) ? Math.max(flipWaitMs, 0) : 0,
  };
  startHalliCountdownTimer();
  updateHalliCountdownLabels();
}

function updateHalliCountdownLabels() {
  if (!currentHalliView || currentGameType !== "halli_galli") {
    resetHalliCountdownLabels();
    return;
  }
  const now = halliNowMs();
  const flipRemaining =
    halliCountdownState.flipReadyAtMs > 0 ? halliCountdownState.flipReadyAtMs - now : 0;
  const ringRemaining =
    halliCountdownState.ringReadyAtMs > 0 ? halliCountdownState.ringReadyAtMs - now : 0;
  const ringWindowRemaining =
    halliCountdownState.turnSwitchAtMs > 0 ? halliCountdownState.turnSwitchAtMs - now : 0;

  if (halliFlipCountdownLabel) {
    halliFlipCountdownLabel.textContent = "-";
    halliFlipCountdownLabel.classList.remove("halli-countdown-active");
  }

  if (halliRingCountdownLabel) {
    let label = "Ready";
    let active = false;
    if (halliCountdownState.ringPending && ringRemaining > 0) {
      label = formatCountdownMs(ringRemaining);
      active = true;
    }
    halliRingCountdownLabel.textContent = label;
    halliRingCountdownLabel.classList.toggle("halli-countdown-active", active);
  }
  if (halliBellCountdown) {
    const show = !halliCountdownState.ringPending && ringWindowRemaining > 0 && isHalliActionAvailable("ring");
    if (show) {
      halliBellCountdown.textContent = formatCountdownMs(ringWindowRemaining);
      halliBellCountdown.classList.remove("hidden");
    } else {
      halliBellCountdown.textContent = "-";
      halliBellCountdown.classList.add("hidden");
    }
  }
}

function renderHalliPlayers(view) {
  if (!halliPlayers) {
    return;
  }
  halliPlayers.innerHTML = "";
  view.players.forEach((p, index) => {
    const card = document.createElement("div");
    card.className = "player-card halli-player-card";
    card.dataset.playerId = String(p.player_id ?? "");
    const seatIndex = (index % 8) + 1;
    card.classList.add(`halli-seat-${seatIndex}`);
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (p.eliminated) {
      card.classList.add("disabled");
    }
    if (p.player_id === view.you) {
      const flipAllowed = currentGameType === "halli_galli" && isHalliActionAvailable("flip");
      card.classList.add("halli-self-seat");
      card.classList.toggle("halli-self-actionable", flipAllowed);
      card.classList.toggle("halli-self-disabled", !flipAllowed);
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", "Flip");
      card.setAttribute("aria-disabled", (!flipAllowed).toString());
      const triggerFlip = () => {
        if (!flipAllowed) {
          return;
        }
        sendAction({ type: "flip" });
      };
      card.addEventListener("click", triggerFlip);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          triggerFlip();
        }
      });
    }
    const info = document.createElement("div");
    info.className = "halli-player-info";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name;
    info.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges halli-player-badges";
    const handBadge = document.createElement("span");
    handBadge.className = "badge";
    handBadge.textContent = `hand ${p.hand_count}`;
    badges.appendChild(handBadge);
    const pileBadge = document.createElement("span");
    pileBadge.className = "badge";
    pileBadge.textContent = `pile ${p.pile_count}`;
    badges.appendChild(pileBadge);
    if (p.player_id === view.you) {
      const youBadge = document.createElement("span");
      youBadge.className = "badge";
      youBadge.textContent = "you";
      badges.appendChild(youBadge);
    }
    if (p.is_bot) {
      const botBadge = document.createElement("span");
      botBadge.className = "badge";
      botBadge.textContent = "bot";
      badges.appendChild(botBadge);
    }
    if (p.eliminated) {
      const outBadge = document.createElement("span");
      outBadge.className = "badge";
      outBadge.textContent = "out";
      badges.appendChild(outBadge);
    }

    info.appendChild(badges);
    card.appendChild(info);

    const topCard = document.createElement("div");
    topCard.className = "halli-player-topcard";
    topCard.textContent = formatHalliCard(p.top_card);
    card.appendChild(topCard);
    halliPlayers.appendChild(card);
  });
}

function isSkullActionAvailable(actionType) {
  if (!currentSkullView || !Array.isArray(currentSkullView.legal_actions)) {
    return false;
  }
  if (!currentSkullView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "play_card") {
    return !!skullSelectedCardType;
  }
  if (actionType === "start_bid" || actionType === "raise_bid") {
    const bid = Number.parseInt(skullBidInput.value, 10);
    return Number.isInteger(bid) && bid > 0;
  }
  if (actionType === "reveal_card") {
    const allowedTargets = getSkullRevealTargets(currentSkullView);
    return !!skullSelectedTarget && allowedTargets.includes(skullSelectedTarget);
  }
  return true;
}

function updateSkullActionButtons() {
  if (currentGameType !== "skull") {
    Object.values(skullActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(skullActionButtons).forEach(([actionType, button]) => {
    const allowed = isSkullActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
}

function updateCatInBoxActionButtons() {
  if (currentGameType !== "cat_in_box") {
    const buttons = [catInBoxDiscardBtn, catInBoxBid1Btn, catInBoxBid2Btn, catInBoxBid3Btn, catInBoxPlayBtn];
    buttons.forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    updateCatInBoxColorButtons(null);
    return;
  }
  const view = currentCatInBoxView;
  const legal = view && Array.isArray(view.legal_actions) ? view.legal_actions : [];
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
}

function isCoyoteActionAvailable(actionType) {
  if (!currentCoyoteView || !Array.isArray(currentCoyoteView.legal_actions)) {
    return false;
  }
  if (!currentCoyoteView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "bid") {
    const bid = Number.parseInt(coyoteBidInput.value, 10);
    if (!Number.isInteger(bid) || bid < 1) {
      return false;
    }
    const lastBid = currentCoyoteView.last_bid;
    if (lastBid !== null && lastBid !== undefined && bid <= lastBid) {
      return false;
    }
  }
  return true;
}

function updateCoyoteActionButtons() {
  if (currentGameType !== "coyote") {
    Object.values(coyoteActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    updateCoyoteBidControls(null);
    return;
  }
  Object.entries(coyoteActionButtons).forEach(([actionType, button]) => {
    const allowed = isCoyoteActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
  updateCoyoteBidControls(currentCoyoteView);
}

function getTexasBetAmount() {
  if (!texasBetInput) {
    return null;
  }
  const amount = Number.parseInt(texasBetInput.value, 10);
  if (!Number.isInteger(amount) || amount <= 0) {
    return null;
  }
  return amount;
}

function isTexasHoldemActionAvailable(actionType) {
  if (!currentTexasHoldemView || !Array.isArray(currentTexasHoldemView.legal_actions)) {
    return false;
  }
  if (!currentTexasHoldemView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "bet" || actionType === "raise") {
    const amount = getTexasBetAmount();
    if (!amount) {
      return false;
    }
    const info = currentTexasHoldemView.action_info || {};
    const maxRaiseTo = Number.isInteger(info.max_raise_to) ? info.max_raise_to : null;
    const minBet = Number.isInteger(info.min_bet) ? info.min_bet : null;
    const minRaiseTo = Number.isInteger(info.min_raise_to) ? info.min_raise_to : null;
    if (maxRaiseTo !== null && amount > maxRaiseTo) {
      return false;
    }
    if (actionType === "bet" && minBet !== null && amount < minBet && amount !== maxRaiseTo) {
      return false;
    }
    if (actionType === "raise" && minRaiseTo !== null && amount < minRaiseTo && amount !== maxRaiseTo) {
      return false;
    }
  }
  return true;
}

function updateTexasHoldemActionButtons() {
  const actionButtons = {
    fold: texasFoldBtn,
    check: texasCheckBtn,
    call: texasCallBtn,
    bet: texasBetBtn,
    raise: texasRaiseBtn,
    all_in: texasAllInBtn,
    next_hand: texasNextHandBtn,
    rebuy: texasRebuyBtn,
  };
  if (currentGameType !== "texas_holdem") {
    Object.values(actionButtons).forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(actionButtons).forEach(([actionType, button]) => {
    if (!button) {
      return;
    }
    const allowed = isTexasHoldemActionAvailable(actionType);
    button.disabled = !allowed;
    button.classList.toggle("action-allowed", allowed);
  });
  if (texasCallBtn && currentTexasHoldemView) {
    const toCall = currentTexasHoldemView.action_info?.to_call;
    texasCallBtn.textContent = Number.isInteger(toCall) && toCall > 0 ? `Call ${toCall}` : "Call";
  }
}

function isHalliActionAvailable(actionType) {
  if (!currentHalliView || !Array.isArray(currentHalliView.legal_actions)) {
    return false;
  }
  return currentHalliView.legal_actions.includes(actionType);
}

function updateHalliActionButtons() {
  if (currentGameType !== "halli_galli") {
    Object.values(halliActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    if (halliBellCenter) {
      halliBellCenter.classList.remove("halli-bell-center-actionable");
      halliBellCenter.classList.add("halli-bell-center-disabled");
      halliBellCenter.setAttribute("aria-disabled", "true");
    }
    return;
  }
  Object.entries(halliActionButtons).forEach(([actionType, button]) => {
    const allowed = isHalliActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
  if (halliBellCenter) {
    const ringAllowed = isHalliActionAvailable("ring");
    halliBellCenter.classList.toggle("halli-bell-center-actionable", ringAllowed);
    halliBellCenter.classList.toggle("halli-bell-center-disabled", !ringAllowed);
    halliBellCenter.setAttribute("aria-disabled", (!ringAllowed).toString());
  }
}

function isFlip7ActionAvailable(actionType) {
  if (!currentFlip7View || !Array.isArray(currentFlip7View.legal_actions)) {
    return false;
  }
  if (!currentFlip7View.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "choose_target") {
    return !!flip7SelectedTarget;
  }
  return true;
}

function updateFlip7ActionButtons() {
  if (currentGameType !== "flip7") {
    Object.values(flip7ActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(flip7ActionButtons).forEach(([actionType, button]) => {
    const allowed = isFlip7ActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
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

function isIncanGoldActionAvailable(actionType) {
  if (!currentIncanGoldView || !Array.isArray(currentIncanGoldView.legal_actions)) {
    return false;
  }
  return currentIncanGoldView.legal_actions.includes(actionType);
}

function updateIncanGoldActionButtons() {
  if (currentGameType !== "incan_gold") {
    Object.values(incanGoldActionButtons).forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  const canDecide = isIncanGoldActionAvailable("decide");
  const canNext = isIncanGoldActionAvailable("next_round");
  const canPlayAgain = isIncanGoldActionAvailable("play_again");
  const states = [
    { el: incanGoldContinueBtn, allowed: canDecide },
    { el: incanGoldLeaveBtn, allowed: canDecide },
    { el: incanGoldNextRoundBtn, allowed: canNext },
    { el: incanGoldPlayAgainBtn, allowed: canPlayAgain },
  ];
  states.forEach(({ el, allowed }) => {
    if (!el) {
      return;
    }
    if (allowed) {
      el.classList.add("action-allowed");
    } else {
      el.classList.remove("action-allowed");
    }
    el.disabled = !allowed;
  });
}

function isKobayakawaActionAvailable(actionType) {
  if (!currentKobayakawaView || !Array.isArray(currentKobayakawaView.legal_actions)) {
    return false;
  }
  return currentKobayakawaView.legal_actions.includes(actionType);
}

function updateKobayakawaActionButtons() {
  if (currentGameType !== "kobayakawa") {
    Object.values(kobayakawaActionButtons).forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(kobayakawaActionButtons).forEach(([actionType, button]) => {
    if (!button) {
      return;
    }
    const allowed = isKobayakawaActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
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
