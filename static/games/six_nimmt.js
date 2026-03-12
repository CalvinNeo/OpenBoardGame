let currentSixNimmtView = null;
let sixNimmtCountdownTimer = null;
let sixNimmtServerOffsetMs = 0;
let sixNimmtLastTimeoutAt = null;
let sixNimmtSummaryAckSent = false;

const sixNimmtPanel = document.getElementById("sixNimmtPanel");
const sixNimmtPhaseLabel = document.getElementById("sixNimmtPhase");
const sixNimmtRoundLabel = document.getElementById("sixNimmtRound");
const sixNimmtTurnLabel = document.getElementById("sixNimmtTurn");
const sixNimmtTimerLabel = document.getElementById("sixNimmtTimer");
const sixNimmtWaitingLabel = document.getElementById("sixNimmtWaiting");
const sixNimmtSelectedLabel = document.getElementById("sixNimmtSelected");
const sixNimmtWinnersLabel = document.getElementById("sixNimmtWinners");
const sixNimmtNotice = document.getElementById("sixNimmtNotice");
const sixNimmtNoticeBody = document.getElementById("sixNimmtNoticeBody");
const sixNimmtReveal = document.getElementById("sixNimmtReveal");
const sixNimmtRows = document.getElementById("sixNimmtRows");
const sixNimmtHand = document.getElementById("sixNimmtHand");
const sixNimmtPlayers = document.getElementById("sixNimmtPlayers");
const sixNimmtSummaryModal = document.getElementById("sixNimmtSummaryModal");
const sixNimmtSummaryStatus = document.getElementById("sixNimmtSummaryStatus");
const sixNimmtSummaryMeta = document.getElementById("sixNimmtSummaryMeta");
const sixNimmtSummaryList = document.getElementById("sixNimmtSummaryList");
const sixNimmtSummaryCloseBtn = document.getElementById("sixNimmtSummaryCloseBtn");

function clearSixNimmtState() {
  currentSixNimmtView = null;
  if (sixNimmtCountdownTimer) {
    clearInterval(sixNimmtCountdownTimer);
    sixNimmtCountdownTimer = null;
  }
  sixNimmtLastTimeoutAt = null;
  sixNimmtServerOffsetMs = 0;
  if (sixNimmtPhaseLabel) {
    sixNimmtPhaseLabel.textContent = "-";
  }
  if (sixNimmtRoundLabel) {
    sixNimmtRoundLabel.textContent = "-";
  }
  if (sixNimmtTurnLabel) {
    sixNimmtTurnLabel.textContent = "-";
  }
  if (sixNimmtTimerLabel) {
    sixNimmtTimerLabel.textContent = "-";
  }
  if (sixNimmtWaitingLabel) {
    sixNimmtWaitingLabel.textContent = "-";
  }
  if (sixNimmtSelectedLabel) {
    sixNimmtSelectedLabel.textContent = "-";
  }
  if (sixNimmtWinnersLabel) {
    sixNimmtWinnersLabel.textContent = "-";
  }
  if (sixNimmtNotice) {
    sixNimmtNotice.classList.add("hidden");
  }
  if (sixNimmtNoticeBody) {
    sixNimmtNoticeBody.textContent = "-";
  }
  if (sixNimmtReveal) {
    sixNimmtReveal.innerHTML = "";
  }
  if (sixNimmtSummaryList) {
    sixNimmtSummaryList.innerHTML = "";
  }
  if (sixNimmtSummaryMeta) {
    sixNimmtSummaryMeta.textContent = "-";
  }
  if (sixNimmtSummaryStatus) {
    sixNimmtSummaryStatus.textContent = "-";
  }
  if (sixNimmtSummaryCloseBtn) {
    sixNimmtSummaryCloseBtn.disabled = false;
    sixNimmtSummaryCloseBtn.textContent = "Continue";
  }
  if (sixNimmtSummaryModal) {
    sixNimmtSummaryModal.classList.add("hidden");
    sixNimmtSummaryModal.setAttribute("aria-hidden", "true");
  }
  sixNimmtSummaryAckSent = false;
  if (sixNimmtRows) {
    sixNimmtRows.innerHTML = "";
  }
  if (sixNimmtHand) {
    sixNimmtHand.innerHTML = "";
  }
  if (sixNimmtPlayers) {
    sixNimmtPlayers.innerHTML = "";
  }
}

function formatSixNimmtBulls(count) {
  const value = Number.isInteger(count) ? count : 0;
  if (value <= 0) {
    return "-";
  }
  return "🐮".repeat(value);
}

function formatSixNimmtCardText(card) {
  if (!card || typeof card.value !== "number") {
    return "-";
  }
  return `${card.value} ${formatSixNimmtBulls(card.bulls)}`;
}

function buildSixNimmtCard(card, { asButton = false, selected = false } = {}) {
  const el = document.createElement(asButton ? "button" : "div");
  if (asButton) {
    el.type = "button";
  }
  el.className = "six-nimmt-card";
  if (selected) {
    el.classList.add("selected");
  }
  if (card && Number.isInteger(card.bulls)) {
    el.dataset.bulls = String(card.bulls);
  }
  const valueEl = document.createElement("div");
  valueEl.className = "six-nimmt-card-value";
  valueEl.textContent = card && typeof card.value === "number" ? String(card.value) : "-";
  const bullsEl = document.createElement("div");
  bullsEl.className = "six-nimmt-card-bulls";
  if (card && Number.isInteger(card.bulls)) {
    const count = card.bulls;
    if (count === 7) {
      const topLine = document.createElement("div");
      topLine.className = "six-nimmt-card-bulls-line";
      topLine.textContent = "🐮".repeat(4);
      const bottomLine = document.createElement("div");
      bottomLine.className = "six-nimmt-card-bulls-line";
      bottomLine.textContent = "🐮".repeat(3);
      bullsEl.append(topLine, bottomLine);
    } else if (count === 6) {
      const topLine = document.createElement("div");
      topLine.className = "six-nimmt-card-bulls-line";
      topLine.textContent = "🐮".repeat(3);
      const bottomLine = document.createElement("div");
      bottomLine.className = "six-nimmt-card-bulls-line";
      bottomLine.textContent = "🐮".repeat(3);
      bullsEl.append(topLine, bottomLine);
    } else if (count === 5) {
      const topLine = document.createElement("div");
      topLine.className = "six-nimmt-card-bulls-line";
      topLine.textContent = "🐮".repeat(3);
      const bottomLine = document.createElement("div");
      bottomLine.className = "six-nimmt-card-bulls-line";
      bottomLine.textContent = "🐮".repeat(2);
      bullsEl.append(topLine, bottomLine);
    } else if (count > 5) {
      const firstLine = document.createElement("div");
      firstLine.className = "six-nimmt-card-bulls-line";
      firstLine.textContent = "🐮".repeat(5);
      const secondLine = document.createElement("div");
      secondLine.className = "six-nimmt-card-bulls-line";
      secondLine.textContent = "🐮".repeat(count - 5);
      bullsEl.append(firstLine, secondLine);
    } else {
      const line = document.createElement("div");
      line.className = "six-nimmt-card-bulls-line";
      line.textContent = "🐮".repeat(count);
      bullsEl.appendChild(line);
    }
  } else {
    bullsEl.textContent = "-";
  }
  el.appendChild(valueEl);
  el.appendChild(bullsEl);
  return el;
}

function renderSixNimmtReveal(view) {
  if (!sixNimmtReveal) {
    return;
  }
  sixNimmtReveal.innerHTML = "";
  const reveal = Array.isArray(view.reveal_order) ? view.reveal_order : [];
  if (!reveal.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No reveal yet.";
    sixNimmtReveal.appendChild(empty);
    return;
  }
  reveal.forEach((entry) => {
    const line = document.createElement("div");
    const name = entry && entry.name ? entry.name : findPlayerName(view, entry.player_id);
    line.textContent = `${name || "-"}: ${formatSixNimmtCardText(entry.card)}`;
    sixNimmtReveal.appendChild(line);
  });
}

function updateSixNimmtSummaryModal(view) {
  if (!sixNimmtSummaryModal || !sixNimmtSummaryList) {
    return;
  }
  const show = !!view && view.phase === "turn_summary";
  sixNimmtSummaryModal.classList.toggle("hidden", !show);
  sixNimmtSummaryModal.setAttribute("aria-hidden", (!show).toString());
  if (!show) {
    sixNimmtSummaryList.innerHTML = "";
    if (sixNimmtSummaryMeta) {
      sixNimmtSummaryMeta.textContent = "-";
    }
    if (sixNimmtSummaryStatus) {
      sixNimmtSummaryStatus.textContent = "-";
    }
    if (sixNimmtSummaryCloseBtn) {
      sixNimmtSummaryCloseBtn.disabled = false;
      sixNimmtSummaryCloseBtn.textContent = "Continue";
    }
    sixNimmtSummaryAckSent = false;
    return;
  }

  const summary = view.last_turn_summary;
  const placements = summary && Array.isArray(summary.placements) ? summary.placements : [];
  sixNimmtSummaryList.innerHTML = "";
  if (!placements.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No summary available.";
    sixNimmtSummaryList.appendChild(empty);
  } else {
    placements.forEach((entry) => {
      const line = document.createElement("div");
      line.className = "six-nimmt-summary-item";
      const header = document.createElement("div");
      header.className = "six-nimmt-summary-header";
      const name = entry && entry.name ? entry.name : findPlayerName(view, entry.player_id);
      const rowLabel = Number.isInteger(entry.row_index) ? `Row ${entry.row_index + 1}` : "Row -";
      header.textContent = `${name || "-"}: ${formatSixNimmtCardText(entry.card)} -> ${rowLabel}`;
      line.appendChild(header);

      if (entry && entry.took_row) {
        const take = document.createElement("div");
        take.className = "six-nimmt-summary-take";
        const takenCards = Array.isArray(entry.taken_cards) ? entry.taken_cards : [];
        const takenText = takenCards.length
          ? takenCards.map((card) => formatSixNimmtCardText(card)).join("、")
          : "-";
        const penalty = Number.isInteger(entry.penalty) ? entry.penalty : 0;
        take.textContent = `吃牌: ${takenText} (罚分 ${penalty})`;
        line.appendChild(take);
      }
      sixNimmtSummaryList.appendChild(line);
    });
  }

  if (sixNimmtSummaryMeta) {
    const roundText = summary && Number.isInteger(summary.round) ? `Round ${summary.round}` : "Round -";
    const turnText = summary && Number.isInteger(summary.turn) ? `Turn ${summary.turn}` : "Turn -";
    sixNimmtSummaryMeta.textContent = `${roundText} · ${turnText}`;
  }

  const acked = Array.isArray(view.summary_ack) ? view.summary_ack : [];
  const players = Array.isArray(view.players) ? view.players : [];
  const waitingPlayers = players.filter((player) => !acked.includes(player.player_id));
  if (sixNimmtSummaryStatus) {
    if (!players.length) {
      sixNimmtSummaryStatus.textContent = "-";
    } else if (!waitingPlayers.length) {
      sixNimmtSummaryStatus.textContent = "All players ready.";
    } else if (waitingPlayers.length <= 3) {
      const names = waitingPlayers.map((player) =>
        player.player_id === view.you ? "You" : player.name || "-"
      );
      sixNimmtSummaryStatus.textContent = `Waiting: ${names.join(", ")}`;
    } else {
      sixNimmtSummaryStatus.textContent = `Waiting: ${waitingPlayers.length} players`;
    }
  }

  const youAcked = view.you && acked.includes(view.you);
  sixNimmtSummaryAckSent = !!youAcked;
  if (sixNimmtSummaryCloseBtn) {
    sixNimmtSummaryCloseBtn.disabled = !!youAcked;
    sixNimmtSummaryCloseBtn.textContent = youAcked ? "Waiting..." : "Continue";
  }
}

function renderSixNimmtRows(view) {
  if (!sixNimmtRows) {
    return;
  }
  sixNimmtRows.innerHTML = "";
  const rows = Array.isArray(view.rows) ? view.rows : [];
  const canChooseRow =
    Array.isArray(view.legal_actions) && view.legal_actions.includes("choose_row") && view.waiting_for;
  rows.forEach((row, index) => {
    const rowEl = document.createElement("div");
    rowEl.className = "six-nimmt-row";
    if (canChooseRow) {
      rowEl.classList.add("selectable");
      rowEl.setAttribute("role", "button");
      rowEl.setAttribute("tabindex", "0");
    }
    const header = document.createElement("div");
    header.className = "six-nimmt-row-header";
    const title = document.createElement("div");
    title.textContent = `Row ${index + 1}`;
    const total = document.createElement("div");
    total.className = "six-nimmt-row-total";
    total.textContent = `Total: ${Number.isInteger(row.bulls_total) ? row.bulls_total : "-"}`;
    header.appendChild(title);
    header.appendChild(total);
    const cards = document.createElement("div");
    cards.className = "six-nimmt-row-cards";
    const rowCards = Array.isArray(row.cards) ? row.cards : [];
    rowCards.forEach((card) => {
      const cardEl = buildSixNimmtCard(card);
      cards.appendChild(cardEl);
    });
    const slotsLeft = Math.max(0, 5 - rowCards.length);
    for (let i = 0; i < slotsLeft; i += 1) {
      const slot = document.createElement("div");
      slot.className = "six-nimmt-card six-nimmt-card-slot";
      slot.setAttribute("aria-hidden", "true");
      cards.appendChild(slot);
    }
    const limit = document.createElement("div");
    limit.className = "six-nimmt-card six-nimmt-card-danger";
    limit.textContent = "6!";
    limit.setAttribute("aria-hidden", "true");
    cards.appendChild(limit);
    rowEl.appendChild(header);
    rowEl.appendChild(cards);
    if (canChooseRow) {
      rowEl.addEventListener("click", () => {
        sendAction({ type: "choose_row", row_index: index });
      });
      rowEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          sendAction({ type: "choose_row", row_index: index });
        }
      });
    }
    sixNimmtRows.appendChild(rowEl);
  });
}

function renderSixNimmtHand(view) {
  if (!sixNimmtHand) {
    return;
  }
  sixNimmtHand.innerHTML = "";
  const hand = Array.isArray(view.hand) ? view.hand : [];
  const canSelect = Array.isArray(view.legal_actions) && view.legal_actions.includes("select_card");
  if (!hand.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No cards.";
    sixNimmtHand.appendChild(empty);
    return;
  }
  hand.forEach((card) => {
    const cardEl = buildSixNimmtCard(card, { asButton: canSelect });
    if (canSelect) {
      cardEl.addEventListener("click", () => {
        sendAction({ type: "select_card", value: card.value });
      });
    } else if (cardEl instanceof HTMLButtonElement) {
      cardEl.disabled = true;
    }
    sixNimmtHand.appendChild(cardEl);
  });
}

function renderSixNimmtPlayers(view) {
  if (!sixNimmtPlayers) {
    return;
  }
  sixNimmtPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card six-nimmt-player-card";
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    if (view.waiting_for && player.player_id === view.waiting_for.player_id) {
      card.classList.add("current");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || "-";
    const meta = document.createElement("div");
    meta.className = "six-nimmt-player-meta";
    const score = document.createElement("div");
    score.textContent = `score ${player.score ?? 0}`;
    const handCount = document.createElement("div");
    handCount.textContent = `hand ${player.hand_count ?? 0}`;
    const selected = document.createElement("div");
    selected.textContent = player.selected ? "selected ✅" : "selected -";
    meta.append(score, handCount, selected);
    if (player.took_last_row) {
      const tookRow = document.createElement("div");
      tookRow.className = "badge danger six-nimmt-took-row";
      tookRow.textContent = "上一轮吃牌";
      meta.appendChild(tookRow);
      const takenCards = Array.isArray(player.took_last_row_cards) ? player.took_last_row_cards : [];
      if (takenCards.length > 0) {
        const takenText = takenCards.map((card) => formatSixNimmtCardText(card)).join("、");
        const tookRowCards = document.createElement("div");
        tookRowCards.className = "six-nimmt-took-row-cards";
        tookRowCards.textContent = `吃牌: ${takenText}`;
        meta.appendChild(tookRowCards);
      }
    }
    card.append(name, meta);
    sixNimmtPlayers.appendChild(card);
  });
}

function updateSixNimmtTimer(view) {
  if (sixNimmtCountdownTimer) {
    clearInterval(sixNimmtCountdownTimer);
    sixNimmtCountdownTimer = null;
  }
  if (!sixNimmtTimerLabel) {
    return;
  }
  const pending = view ? view.pending_timeout : null;
  const atMs = pending && Number.isFinite(pending.at_ms) ? pending.at_ms : null;
  if (!atMs) {
    sixNimmtTimerLabel.textContent = "-";
    sixNimmtLastTimeoutAt = null;
    return;
  }
  if (sixNimmtLastTimeoutAt !== atMs) {
    sixNimmtLastTimeoutAt = atMs;
  }
  const serverNow = Number.isFinite(view.server_time_ms) ? view.server_time_ms : Date.now();
  sixNimmtServerOffsetMs = serverNow - Date.now();
  const update = () => {
    const now = Date.now() + sixNimmtServerOffsetMs;
    const remaining = Math.max(0, atMs - now);
    sixNimmtTimerLabel.textContent = `${Math.ceil(remaining / 1000)}s`;
  };
  update();
  sixNimmtCountdownTimer = setInterval(update, 250);
}

function renderSixNimmtNotice(view) {
  if (!sixNimmtNotice || !sixNimmtNoticeBody) {
    return;
  }
  sixNimmtNotice.classList.add("hidden");
  sixNimmtNoticeBody.textContent = "-";
  if (!view || view.game_over) {
    return;
  }
  if (Array.isArray(view.legal_actions) && view.legal_actions.includes("choose_row")) {
    sixNimmtNotice.classList.remove("hidden");
    sixNimmtNoticeBody.textContent = "Choose a row to take.";
    return;
  }
  if (Array.isArray(view.legal_actions) && view.legal_actions.includes("select_card")) {
    sixNimmtNotice.classList.remove("hidden");
    sixNimmtNoticeBody.textContent = "Select one card to play.";
  }
}

function renderSixNimmtGameState(data) {
  const view = data.view;
  currentSixNimmtView = view;
  if (currentGameType !== "six_nimmt") {
    currentGameType = "six_nimmt";
    setGamePanelVisibility("six_nimmt");
  }

  if (sixNimmtPhaseLabel) {
    sixNimmtPhaseLabel.textContent = view.phase || "-";
  }
  if (sixNimmtRoundLabel) {
    sixNimmtRoundLabel.textContent = view.round ?? "-";
  }
  if (sixNimmtTurnLabel) {
    sixNimmtTurnLabel.textContent = view.turn ?? "-";
  }
  if (sixNimmtSelectedLabel) {
    sixNimmtSelectedLabel.textContent = view.selected_card ? formatSixNimmtCardText(view.selected_card) : "-";
  }
  if (sixNimmtWinnersLabel) {
    if (view.game_over && Array.isArray(view.winner_names) && view.winner_names.length) {
      sixNimmtWinnersLabel.textContent = view.winner_names.filter(Boolean).join(", ");
    } else {
      sixNimmtWinnersLabel.textContent = "-";
    }
  }

  const waiting = view.waiting_for;
  if (sixNimmtWaitingLabel) {
    if (view.phase === "row_choice" && waiting) {
      const waitingName = waiting.player_id === view.you ? "You" : waiting.name || "-";
      sixNimmtWaitingLabel.textContent = `${waitingName} choosing row`;
    } else if (view.phase === "placement") {
      sixNimmtWaitingLabel.textContent = "Resolving";
    } else if (view.phase === "selection") {
      sixNimmtWaitingLabel.textContent = "Selecting";
    } else if (view.phase === "game_over") {
      sixNimmtWaitingLabel.textContent = "-";
    } else {
      sixNimmtWaitingLabel.textContent = "-";
    }
  }

  renderSixNimmtNotice(view);
  renderSixNimmtReveal(view);
  updateSixNimmtSummaryModal(view);
  renderSixNimmtRows(view);
  renderSixNimmtHand(view);
  renderSixNimmtPlayers(view);
  updateSixNimmtTimer(view);
  logGameEvents(data);
}

if (sixNimmtSummaryModal) {
  sixNimmtSummaryModal.addEventListener("click", (event) => {
    if (event.target !== sixNimmtSummaryModal) {
      return;
    }
    if (!currentSixNimmtView || currentSixNimmtView.phase !== "turn_summary") {
      return;
    }
    const actions = Array.isArray(currentSixNimmtView.legal_actions) ? currentSixNimmtView.legal_actions : [];
    if (!actions.includes("ack_turn_summary")) {
      return;
    }
    if (sixNimmtSummaryAckSent) {
      return;
    }
    sendAction({ type: "ack_turn_summary" });
    sixNimmtSummaryAckSent = true;
    if (sixNimmtSummaryCloseBtn) {
      sixNimmtSummaryCloseBtn.disabled = true;
      sixNimmtSummaryCloseBtn.textContent = "Waiting...";
    }
    if (sixNimmtSummaryStatus) {
      sixNimmtSummaryStatus.textContent = "Waiting for others...";
    }
  });
}

if (sixNimmtSummaryCloseBtn) {
  sixNimmtSummaryCloseBtn.addEventListener("click", () => {
    if (!currentSixNimmtView || currentSixNimmtView.phase !== "turn_summary") {
      return;
    }
    const actions = Array.isArray(currentSixNimmtView.legal_actions) ? currentSixNimmtView.legal_actions : [];
    if (!actions.includes("ack_turn_summary")) {
      return;
    }
    if (sixNimmtSummaryAckSent) {
      return;
    }
    sendAction({ type: "ack_turn_summary" });
    sixNimmtSummaryAckSent = true;
    sixNimmtSummaryCloseBtn.disabled = true;
    sixNimmtSummaryCloseBtn.textContent = "Waiting...";
    if (sixNimmtSummaryStatus) {
      sixNimmtSummaryStatus.textContent = "Waiting for others...";
    }
  });
}
