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
