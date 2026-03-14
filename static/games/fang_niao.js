const fangNiaoHeaderActions = document.getElementById("fangNiaoHeaderActions");
const fangNiaoHelpBtn = document.getElementById("fangNiaoHelpBtn");
const fangNiaoExplainBtn = document.getElementById("fangNiaoExplainBtn");
const fangNiaoHelpModal = document.getElementById("fangNiaoHelpModal");
const fangNiaoHelpModalCloseBtn = document.getElementById("fangNiaoHelpModalCloseBtn");
const fangNiaoExplainModal = document.getElementById("fangNiaoExplainModal");
const fangNiaoExplainModalCloseBtn = document.getElementById("fangNiaoExplainModalCloseBtn");
const fangNiaoHelpContent = document.getElementById("fangNiaoHelpContent");
const fangNiaoExplainContent = document.getElementById("fangNiaoExplainContent");

const fangNiaoPhaseLabel = document.getElementById("fangNiaoPhase");
const fangNiaoTurnLabel = document.getElementById("fangNiaoTurn");
const fangNiaoDeckLabel = document.getElementById("fangNiaoDeck");
const fangNiaoDiscardLabel = document.getElementById("fangNiaoDiscard");
const fangNiaoWinnerLabel = document.getElementById("fangNiaoWinner");
const fangNiaoLastActionLabel = document.getElementById("fangNiaoLastAction");
const fangNiaoRows = document.getElementById("fangNiaoRows");
const fangNiaoHand = document.getElementById("fangNiaoHand");
const fangNiaoSelectedBirdLabel = document.getElementById("fangNiaoSelectedBird");
const fangNiaoSelectedRowLabel = document.getElementById("fangNiaoSelectedRow");
const fangNiaoSelectedSideLabel = document.getElementById("fangNiaoSelectedSide");
const fangNiaoClearSelectionBtn = document.getElementById("fangNiaoClearSelection");
const fangNiaoPlayBtn = document.getElementById("fangNiaoPlayBtn");
const fangNiaoBankBtn = document.getElementById("fangNiaoBankBtn");
const fangNiaoEndBtn = document.getElementById("fangNiaoEndBtn");
const fangNiaoPlayers = document.getElementById("fangNiaoPlayers");

const FANG_NIAO_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Win by either collecting 7 different birds or getting two bird types to 3+ in your collection.</p>

  <h3>Setup</h3>
  <ul>
    <li>Each of 4 rows starts with 3 different birds.</li>
    <li>Players draw 8 cards and also start with 1 bird already in their collection.</li>
  </ul>

  <h3>Turn</h3>
  <ol>
    <li><strong>Lay birds</strong>: choose one bird type and play all of that type to a row and side.</li>
    <li><strong>Capture</strong>: scan from that side to the first matching bird.
      If there are cards in between, take those cards into your hand.
      If no match or no cards in between, you draw 2 cards instead.</li>
    <li><strong>Bank (optional)</strong>: if you have enough of a bird, keep 1 (small flock) or 2 (big flock)
      and discard the rest to your collection.</li>
  </ol>

  <h3>End of Turn</h3>
  <p>If your hand is empty, everyone discards their hand and all players draw 8 new cards.</p>
`;

const FANG_NIAO_BUTTON_EXPLANATIONS = {
  fangNiaoClearSelection: {
    name: "Clear",
    description: "Clear the selected bird, row, and side.",
  },
  fangNiaoPlayBtn: {
    name: "Play Birds",
    description: "Play all cards of the selected bird type to the chosen row and side.",
  },
  fangNiaoBankBtn: {
    name: "Bank",
    description: "Score a flock if you have enough of the selected bird type.",
  },
  fangNiaoEndBtn: {
    name: "End Turn",
    description: "Finish your turn after banking (or skipping bank).",
  },
  fangNiaoRowSide: {
    name: "Row Side",
    description: "Choose which row and side to place your birds.",
  },
  fangNiaoHand: {
    name: "Hand Bird",
    description: "Select a bird type from your hand to play or bank.",
  },
};

const FANG_NIAO_BIRD_META = {
  flamingo: { name: "火烈鸟", emoji: "🦩", color: "#fb7185" },
  owl: { name: "猫头鹰", emoji: "🦉", color: "#f59e0b" },
  toucan: { name: "大嘴鸟", emoji: "🦚", color: "#0ea5e9" },
  duck: { name: "鸭子", emoji: "🦆", color: "#facc15" },
  pelican: { name: "鹈鹕", emoji: "🦢", color: "#93c5fd" },
  parrot: { name: "鹦鹉", emoji: "🦜", color: "#4ade80" },
  sparrow: { name: "麻雀", emoji: "🐦", color: "#d1d5db" },
  magpie: { name: "喜鹊", emoji: "🪶", color: "#a3a3a3" },
};

let currentFangNiaoView = null;
let fangNiaoSelectedBird = null;
let fangNiaoSelectedRow = null;
let fangNiaoSelectedSide = null;

function clearFangNiaoState() {
  currentFangNiaoView = null;
  fangNiaoSelectedBird = null;
  fangNiaoSelectedRow = null;
  fangNiaoSelectedSide = null;
  if (fangNiaoPhaseLabel) {
    fangNiaoPhaseLabel.textContent = "-";
  }
  if (fangNiaoTurnLabel) {
    fangNiaoTurnLabel.textContent = "-";
  }
  if (fangNiaoDeckLabel) {
    fangNiaoDeckLabel.textContent = "-";
  }
  if (fangNiaoDiscardLabel) {
    fangNiaoDiscardLabel.textContent = "-";
  }
  if (fangNiaoWinnerLabel) {
    fangNiaoWinnerLabel.textContent = "-";
  }
  if (fangNiaoLastActionLabel) {
    fangNiaoLastActionLabel.textContent = "-";
  }
  if (fangNiaoRows) {
    fangNiaoRows.innerHTML = "";
  }
  if (fangNiaoHand) {
    fangNiaoHand.innerHTML = "";
  }
  if (fangNiaoPlayers) {
    fangNiaoPlayers.innerHTML = "";
  }
  updateFangNiaoSelectionLabels();
  updateFangNiaoActionButtons();
}

function getFangNiaoConfig(view) {
  return view && Array.isArray(view.bird_config) ? view.bird_config : [];
}

function getFangNiaoConfigMap(view) {
  const map = {};
  getFangNiaoConfig(view).forEach((item) => {
    if (item && item.id) {
      map[item.id] = item;
    }
  });
  return map;
}

function countFangNiaoCards(hand) {
  const counts = {};
  (hand || []).forEach((card) => {
    counts[card] = (counts[card] || 0) + 1;
  });
  return counts;
}

function formatFangNiaoBirdLabel(view, birdType) {
  const meta = FANG_NIAO_BIRD_META[birdType] || {};
  const configMap = getFangNiaoConfigMap(view);
  const cfg = configMap[birdType] || {};
  const name = meta.name || cfg.name || birdType || "-";
  const emoji = meta.emoji || "🐦";
  return `${emoji} ${name}`;
}

function isFangNiaoBankable(view, birdType) {
  if (!view || !birdType) {
    return false;
  }
  const configMap = getFangNiaoConfigMap(view);
  const cfg = configMap[birdType];
  if (!cfg) {
    return false;
  }
  const counts = countFangNiaoCards(Array.isArray(view.hand) ? view.hand : []);
  const count = counts[birdType] || 0;
  const small = Number(cfg.small);
  if (Number.isFinite(small)) {
    return count >= small;
  }
  return count > 0;
}

function updateFangNiaoSelectionLabels() {
  if (fangNiaoSelectedBirdLabel) {
    if (fangNiaoSelectedBird) {
      fangNiaoSelectedBirdLabel.textContent = formatFangNiaoBirdLabel(currentFangNiaoView, fangNiaoSelectedBird);
    } else {
      fangNiaoSelectedBirdLabel.textContent = "-";
    }
  }
  if (fangNiaoSelectedRowLabel) {
    fangNiaoSelectedRowLabel.textContent =
      Number.isInteger(fangNiaoSelectedRow) ? `Row ${fangNiaoSelectedRow + 1}` : "-";
  }
  if (fangNiaoSelectedSideLabel) {
    if (fangNiaoSelectedSide === "left") {
      fangNiaoSelectedSideLabel.textContent = "Left ⬅️";
    } else if (fangNiaoSelectedSide === "right") {
      fangNiaoSelectedSideLabel.textContent = "Right ➡️";
    } else {
      fangNiaoSelectedSideLabel.textContent = "-";
    }
  }
}

function selectFangNiaoRow(rowIndex, side) {
  fangNiaoSelectedRow = rowIndex;
  fangNiaoSelectedSide = side;
  updateFangNiaoSelectionLabels();
  updateFangNiaoActionButtons();
  if (currentFangNiaoView) {
    renderFangNiaoRows(currentFangNiaoView);
  }
}

function renderFangNiaoRows(view) {
  if (!fangNiaoRows) {
    return;
  }
  fangNiaoRows.innerHTML = "";
  const rows = Array.isArray(view.rows) ? view.rows : [];
  if (!rows.length) {
    fangNiaoRows.textContent = "-";
    return;
  }
  rows.forEach((row, idx) => {
    const isSelectedRow = idx === fangNiaoSelectedRow;
    const hasPreview =
      isSelectedRow && !!fangNiaoSelectedBird && (fangNiaoSelectedSide === "left" || fangNiaoSelectedSide === "right");
    const captureIndices = [];
    if (hasPreview && Array.isArray(row) && row.length) {
      let matchIndex = -1;
      if (fangNiaoSelectedSide === "left") {
        matchIndex = row.findIndex((birdType) => birdType === fangNiaoSelectedBird);
        if (matchIndex > 0) {
          for (let i = 0; i < matchIndex; i += 1) {
            captureIndices.push(i);
          }
        }
      } else if (fangNiaoSelectedSide === "right") {
        for (let i = row.length - 1; i >= 0; i -= 1) {
          if (row[i] === fangNiaoSelectedBird) {
            matchIndex = i;
            break;
          }
        }
        if (matchIndex >= 0 && matchIndex < row.length - 1) {
          for (let i = matchIndex + 1; i < row.length; i += 1) {
            captureIndices.push(i);
          }
        }
      }
    }

    const rowEl = document.createElement("div");
    rowEl.className = "fang-niao-row";
    if (isSelectedRow) {
      rowEl.classList.add("selected");
    }

    const labelEl = document.createElement("div");
    labelEl.className = "fang-niao-row-label";
    labelEl.textContent = `Row ${idx + 1}`;

    const leftBtn = document.createElement("button");
    leftBtn.type = "button";
    leftBtn.className = "fang-niao-side-btn";
    leftBtn.textContent = "⬅️";
    if (idx === fangNiaoSelectedRow && fangNiaoSelectedSide === "left") {
      leftBtn.classList.add("selected");
    }
    leftBtn.addEventListener("click", () => selectFangNiaoRow(idx, "left"));

    const rightBtn = document.createElement("button");
    rightBtn.type = "button";
    rightBtn.className = "fang-niao-side-btn";
    rightBtn.textContent = "➡️";
    if (idx === fangNiaoSelectedRow && fangNiaoSelectedSide === "right") {
      rightBtn.classList.add("selected");
    }
    rightBtn.addEventListener("click", () => selectFangNiaoRow(idx, "right"));

    const cardsEl = document.createElement("div");
    cardsEl.className = "fang-niao-row-cards";
    if (!Array.isArray(row) || !row.length) {
      const empty = document.createElement("span");
      empty.className = "fang-niao-card";
      empty.textContent = "-";
      cardsEl.appendChild(empty);
    } else {
      row.forEach((birdType, cardIndex) => {
        const meta = FANG_NIAO_BIRD_META[birdType] || {};
        const name = meta.name || birdType;
        const emoji = meta.emoji || "🐦";
        const chip = document.createElement("span");
        chip.className = "fang-niao-card";
        chip.textContent = `${emoji} ${name}`;
        chip.title = name;
        if (cardIndex === 0 || cardIndex === row.length - 1) {
          chip.classList.add("fang-niao-card-end");
        }
        if (hasPreview && captureIndices.includes(cardIndex)) {
          chip.classList.add("fang-niao-card-capture");
        }
        if (meta.color) {
          chip.style.backgroundColor = meta.color;
        }
        cardsEl.appendChild(chip);
      });
    }

    if (hasPreview) {
      const previewTag = document.createElement("span");
      previewTag.className = "fang-niao-capture-preview";
      if (captureIndices.length) {
        previewTag.classList.add("ok");
        previewTag.textContent = `可吃 ${captureIndices.length} 张`;
      } else {
        previewTag.classList.add("none");
        previewTag.textContent = "无可吃";
      }
      cardsEl.appendChild(previewTag);
    }

    rowEl.appendChild(labelEl);
    rowEl.appendChild(leftBtn);
    rowEl.appendChild(cardsEl);
    rowEl.appendChild(rightBtn);
    fangNiaoRows.appendChild(rowEl);
  });
  if (fangNiaoExplainMode) {
    updateFangNiaoExplainModeClasses(true);
  }
}

function renderFangNiaoHand(view) {
  if (!fangNiaoHand) {
    return;
  }
  fangNiaoHand.innerHTML = "";
  const hand = Array.isArray(view.hand) ? view.hand : [];
  if (!hand.length) {
    fangNiaoHand.textContent = "-";
    return;
  }
  const counts = countFangNiaoCards(hand);
  const configList = getFangNiaoConfig(view);
  const configMap = getFangNiaoConfigMap(view);
  const order = configList.length ? configList.map((cfg) => cfg.id) : Object.keys(counts);
  order.forEach((birdType) => {
    const count = counts[birdType] || 0;
    if (!count) {
      return;
    }
    const meta = FANG_NIAO_BIRD_META[birdType] || {};
    const cfg = configMap[birdType] || {};
    const labelName = meta.name || cfg.name || birdType;
    const labelEmoji = meta.emoji || "🐦";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fang-niao-hand-btn";
    if (birdType === fangNiaoSelectedBird) {
      btn.classList.add("selected");
    }
    const small = Number(cfg.small);
    if (Number.isFinite(small) && count >= small) {
      btn.classList.add("bankable");
    }
    const titleSpan = document.createElement("span");
    titleSpan.className = "fang-niao-hand-title";
    titleSpan.textContent = `${labelEmoji} ${labelName} ×${count}`;
    btn.appendChild(titleSpan);
    const big = Number(cfg.big);
    if (Number.isFinite(small)) {
      const thresholdSpan = document.createElement("span");
      thresholdSpan.className = "fang-niao-hand-threshold";
      thresholdSpan.textContent = `小${cfg.small} / 大${Number.isFinite(big) ? cfg.big : "-"}`;
      btn.appendChild(thresholdSpan);
    }
    btn.title = Number.isFinite(small) ? `S${cfg.small} / B${cfg.big || "-"}` : "";
    if (meta.color) {
      btn.style.borderColor = meta.color;
    }
    btn.addEventListener("click", () => {
      fangNiaoSelectedBird = birdType;
      updateFangNiaoSelectionLabels();
      updateFangNiaoActionButtons();
      renderFangNiaoRows(view);
      renderFangNiaoHand(view);
    });
    fangNiaoHand.appendChild(btn);
  });
  if (fangNiaoExplainMode) {
    updateFangNiaoExplainModeClasses(true);
  }
}

function renderFangNiaoPlayers(view) {
  if (!fangNiaoPlayers) {
    return;
  }
  fangNiaoPlayers.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  const configList = getFangNiaoConfig(view);
  const order = configList.length ? configList.map((cfg) => cfg.id) : [];
  players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "fang-niao-player";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    const header = document.createElement("div");
    header.className = "fang-niao-player-header";
    const handCount = Number.isInteger(player.hand_count) ? player.hand_count : (player.hand_count ?? "-");
    header.textContent = `${player.name || player.player_id} · Hand ${handCount}`;
    card.appendChild(header);

    const collection = document.createElement("div");
    collection.className = "fang-niao-collection";
    const entries = player.collection || {};
    let hasChip = false;
    const birdOrder = order.length ? order : Object.keys(entries);
    birdOrder.forEach((birdType) => {
      const count = entries[birdType];
      if (!count) {
        return;
      }
      hasChip = true;
      const meta = FANG_NIAO_BIRD_META[birdType] || {};
      const chip = document.createElement("div");
      chip.className = "fang-niao-collection-chip";
      chip.textContent = `${meta.emoji || "🐦"} ${meta.name || birdType} ×${count}`;
      if (meta.color) {
        chip.style.backgroundColor = meta.color;
      }
      collection.appendChild(chip);
    });
    if (!hasChip) {
      collection.textContent = "-";
    }
    card.appendChild(collection);
    fangNiaoPlayers.appendChild(card);
  });
}

function formatFangNiaoLastAction(view) {
  const last = view.last_action;
  if (!last || !last.type) {
    return "-";
  }
  const actor = last.player_id ? findPlayerName(view, last.player_id) : "Unknown";
  if (last.type === "play") {
    const bird = formatFangNiaoBirdLabel(view, last.bird_type);
    const rowLabel = Number.isInteger(last.row_index) ? `Row ${last.row_index + 1}` : "Row ?";
    const sideLabel = last.side === "left" ? "Left ⬅️" : last.side === "right" ? "Right ➡️" : "-";
    const captured = Number.isInteger(last.captured) ? `, captured ${last.captured}` : "";
    const drew = Number.isInteger(last.drew) && last.drew > 0 ? `, drew ${last.drew}` : "";
    return `${actor}: ${bird} → ${rowLabel} ${sideLabel}${captured}${drew}`;
  }
  if (last.type === "bank") {
    const bird = formatFangNiaoBirdLabel(view, last.bird_type);
    const kept = Number.isInteger(last.kept) ? last.kept : "-";
    const discarded = Number.isInteger(last.discarded) ? last.discarded : "-";
    return `${actor}: bank ${bird} (keep ${kept}, discard ${discarded})`;
  }
  if (last.type === "end") {
    return last.reset ? `${actor}: end turn (reset)` : `${actor}: end turn`;
  }
  return `${actor}: ${last.type}`;
}

function updateFangNiaoActionButtons() {
  if (!fangNiaoPlayBtn && !fangNiaoBankBtn && !fangNiaoEndBtn) {
    return;
  }
  const view = currentFangNiaoView;
  const legal = view && Array.isArray(view.legal_actions) ? view.legal_actions : [];
  const canPlay =
    legal.includes("play_birds") &&
    fangNiaoSelectedBird &&
    Number.isInteger(fangNiaoSelectedRow) &&
    !!fangNiaoSelectedSide;
  const canBank =
    legal.includes("bank_birds") &&
    fangNiaoSelectedBird &&
    isFangNiaoBankable(view, fangNiaoSelectedBird);
  const canEnd = legal.includes("end_turn");

  if (fangNiaoPlayBtn) {
    fangNiaoPlayBtn.disabled = !canPlay;
  }
  if (fangNiaoBankBtn) {
    fangNiaoBankBtn.disabled = !canBank;
  }
  if (fangNiaoEndBtn) {
    fangNiaoEndBtn.disabled = !canEnd;
  }
}

function renderFangNiaoGameState(data) {
  const view = data.view;
  currentFangNiaoView = view;
  if (currentGameType !== "fang_niao") {
    currentGameType = "fang_niao";
    setGamePanelVisibility("fang_niao");
  }

  if (fangNiaoSelectedBird && (!Array.isArray(view.hand) || !view.hand.includes(fangNiaoSelectedBird))) {
    fangNiaoSelectedBird = null;
  }
  if (Number.isInteger(fangNiaoSelectedRow)) {
    if (!Array.isArray(view.rows) || fangNiaoSelectedRow >= view.rows.length) {
      fangNiaoSelectedRow = null;
      fangNiaoSelectedSide = null;
    }
  }
  if (!Number.isInteger(fangNiaoSelectedRow)) {
    fangNiaoSelectedSide = null;
  }

  if (fangNiaoPhaseLabel) {
    fangNiaoPhaseLabel.textContent = view.phase || "-";
  }
  if (fangNiaoTurnLabel) {
    const currentPlayer = (view.players || []).find((p) => p.player_id === view.current_turn);
    fangNiaoTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (fangNiaoDeckLabel) {
    fangNiaoDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (fangNiaoDiscardLabel) {
    fangNiaoDiscardLabel.textContent = view.discard_count ?? "-";
  }
  if (fangNiaoWinnerLabel) {
    fangNiaoWinnerLabel.textContent = view.winner ? findPlayerName(view, view.winner) : "-";
  }
  if (fangNiaoLastActionLabel) {
    fangNiaoLastActionLabel.textContent = formatFangNiaoLastAction(view);
  }

  renderFangNiaoRows(view);
  renderFangNiaoHand(view);
  renderFangNiaoPlayers(view);
  updateFangNiaoSelectionLabels();
  updateFangNiaoActionButtons();
  logGameEvents(data);
}

if (fangNiaoClearSelectionBtn) {
  fangNiaoClearSelectionBtn.addEventListener("click", () => {
    fangNiaoSelectedBird = null;
    fangNiaoSelectedRow = null;
    fangNiaoSelectedSide = null;
    updateFangNiaoSelectionLabels();
    updateFangNiaoActionButtons();
    if (currentFangNiaoView) {
      renderFangNiaoRows(currentFangNiaoView);
      renderFangNiaoHand(currentFangNiaoView);
    }
  });
}

if (fangNiaoPlayBtn) {
  fangNiaoPlayBtn.addEventListener("click", () => {
    if (!currentFangNiaoView || !Array.isArray(currentFangNiaoView.legal_actions)) {
      return;
    }
    if (!currentFangNiaoView.legal_actions.includes("play_birds")) {
      log("Not your turn");
      return;
    }
    if (!fangNiaoSelectedBird) {
      log("Select a bird");
      return;
    }
    if (!Number.isInteger(fangNiaoSelectedRow)) {
      log("Select a row");
      return;
    }
    if (!fangNiaoSelectedSide) {
      log("Select a side");
      return;
    }
    sendAction({
      type: "play_birds",
      bird_type: fangNiaoSelectedBird,
      row_index: fangNiaoSelectedRow,
      side: fangNiaoSelectedSide,
    });
  });
}

if (fangNiaoBankBtn) {
  fangNiaoBankBtn.addEventListener("click", () => {
    if (!currentFangNiaoView || !Array.isArray(currentFangNiaoView.legal_actions)) {
      return;
    }
    if (!currentFangNiaoView.legal_actions.includes("bank_birds")) {
      log("Not your turn");
      return;
    }
    if (!fangNiaoSelectedBird) {
      log("Select a bird");
      return;
    }
    if (!isFangNiaoBankable(currentFangNiaoView, fangNiaoSelectedBird)) {
      log("Not enough birds to bank");
      return;
    }
    sendAction({ type: "bank_birds", bird_type: fangNiaoSelectedBird });
  });
}

if (fangNiaoEndBtn) {
  fangNiaoEndBtn.addEventListener("click", () => {
    if (!currentFangNiaoView || !Array.isArray(currentFangNiaoView.legal_actions)) {
      return;
    }
    if (!currentFangNiaoView.legal_actions.includes("end_turn")) {
      log("Not your turn");
      return;
    }
    sendAction({ type: "end_turn" });
  });
}

let fangNiaoExplainMode = false;

function showFangNiaoHeaderActions(show) {
  if (fangNiaoHeaderActions) {
    fangNiaoHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitFangNiaoExplainMode();
    closeFangNiaoHelpModal();
    closeFangNiaoExplainModal();
  }
}

function showFangNiaoHelpModal() {
  if (!fangNiaoHelpModal) {
    return;
  }
  if (fangNiaoHelpContent) {
    fangNiaoHelpContent.innerHTML = FANG_NIAO_HELP_TEXT;
  }
  setModalVisible(fangNiaoHelpModal, true);
}

function closeFangNiaoHelpModal() {
  if (fangNiaoHelpModal) {
    setModalVisible(fangNiaoHelpModal, false);
  }
}

function updateFangNiaoExplainModeClasses(enabled) {
  Object.keys(FANG_NIAO_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    if (buttonId === "fangNiaoRowSide" || buttonId === "fangNiaoHand") {
      return;
    }
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
  document.querySelectorAll(".fang-niao-side-btn").forEach((btn) => {
    btn.classList.toggle("has-explanation", enabled);
  });
  document.querySelectorAll(".fang-niao-hand-btn").forEach((btn) => {
    btn.classList.toggle("has-explanation", enabled);
  });
}

function findFangNiaoButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(FANG_NIAO_BUTTON_EXPLANATIONS)) {
    if (buttonId === "fangNiaoRowSide" || buttonId === "fangNiaoHand") {
      continue;
    }
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  const sideButtons = Array.from(document.querySelectorAll(".fang-niao-side-btn"));
  for (const btn of sideButtons) {
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return "fangNiaoRowSide";
    }
  }
  const handButtons = Array.from(document.querySelectorAll(".fang-niao-hand-btn"));
  for (const btn of handButtons) {
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return "fangNiaoHand";
    }
  }
  return null;
}

function toggleFangNiaoExplainMode() {
  fangNiaoExplainMode = !fangNiaoExplainMode;
  document.body.classList.toggle("fang-niao-explain-mode", fangNiaoExplainMode);
  updateFangNiaoExplainModeClasses(fangNiaoExplainMode);
  if (fangNiaoExplainBtn) {
    fangNiaoExplainBtn.classList.toggle("active", fangNiaoExplainMode);
  }
}

function exitFangNiaoExplainMode() {
  if (!fangNiaoExplainMode) {
    return;
  }
  fangNiaoExplainMode = false;
  document.body.classList.remove("fang-niao-explain-mode");
  updateFangNiaoExplainModeClasses(false);
  if (fangNiaoExplainBtn) {
    fangNiaoExplainBtn.classList.remove("active");
  }
}

function showFangNiaoButtonExplanation(buttonId) {
  const explanation = FANG_NIAO_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !fangNiaoExplainContent || !fangNiaoExplainModal) {
    return;
  }
  const note = explanation.note ? `<div class="hint">${explanation.note}</div>` : "";
  fangNiaoExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    ${note}
  `;
  setModalVisible(fangNiaoExplainModal, true);
}

function closeFangNiaoExplainModal() {
  if (fangNiaoExplainModal) {
    setModalVisible(fangNiaoExplainModal, false);
  }
}

if (fangNiaoHelpBtn) {
  fangNiaoHelpBtn.addEventListener("click", () => {
    showFangNiaoHelpModal();
  });
}

if (fangNiaoHelpModalCloseBtn) {
  fangNiaoHelpModalCloseBtn.addEventListener("click", closeFangNiaoHelpModal);
}

if (fangNiaoExplainBtn) {
  fangNiaoExplainBtn.addEventListener("click", () => {
    toggleFangNiaoExplainMode();
  });
}

if (fangNiaoExplainModalCloseBtn) {
  fangNiaoExplainModalCloseBtn.addEventListener("click", closeFangNiaoExplainModal);
}

document.addEventListener("pointerdown", (e) => {
  if (!fangNiaoExplainMode) return;

  const buttonId = findFangNiaoButtonAtPoint(e.clientX, e.clientY);
  if (buttonId) {
    e.preventDefault();
    e.stopPropagation();
    showFangNiaoButtonExplanation(buttonId);
    exitFangNiaoExplainMode();
    return;
  }

  const button = e.target.closest("button");
  if (button === fangNiaoExplainBtn || button === fangNiaoHelpBtn) return;
  if (button === fangNiaoHelpModalCloseBtn || button === fangNiaoExplainModalCloseBtn) return;

  if (button) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

document.addEventListener("click", (e) => {
  if (!fangNiaoExplainMode) return;

  const button = e.target.closest("button");
  if (!button) return;

  if (button === fangNiaoExplainBtn || button === fangNiaoHelpBtn) return;
  if (button === fangNiaoHelpModalCloseBtn || button === fangNiaoExplainModalCloseBtn) return;

  e.preventDefault();
  e.stopPropagation();
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && fangNiaoExplainMode) {
    exitFangNiaoExplainMode();
  }
});
