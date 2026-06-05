let currentRebelView = null;
let rebelSelectedCardIds = [];
let rebelSelectedSuit = null;

const rebelSuitEmoji = {
  queen: "👑",
  fairy: "🪄",
  pet: "🐸",
  prince: "🤴",
};

const rebelSuitName = {
  queen: "Queen",
  fairy: "Fairy",
  pet: "Pet",
  prince: "Prince",
};

const rebelPanel = document.getElementById("rebelPrincessPanel");
const rebelRoundTitle = document.getElementById("rebelRoundTitle");
const rebelRoundSummary = document.getElementById("rebelRoundSummary");
const rebelPhase = document.getElementById("rebelPhase");
const rebelRound = document.getElementById("rebelRound");
const rebelLeader = document.getElementById("rebelLeader");
const rebelTurn = document.getElementById("rebelTurn");
const rebelLeadSuit = document.getElementById("rebelLeadSuit");
const rebelRequiredSuit = document.getElementById("rebelRequiredSuit");
const rebelPrinceStatus = document.getElementById("rebelPrinceStatus");
const rebelTricks = document.getElementById("rebelTricks");
const rebelTrick = document.getElementById("rebelTrick");
const rebelPlayers = document.getElementById("rebelPlayers");
const rebelPrincess = document.getElementById("rebelPrincess");
const rebelHand = document.getElementById("rebelHand");
const rebelSelectedCards = document.getElementById("rebelSelectedCards");
const rebelSelectedSuitLabel = document.getElementById("rebelSelectedSuit");
const rebelSelectedTarget = document.getElementById("rebelSelectedTarget");
const rebelSuitButtons = document.getElementById("rebelSuitButtons");
const rebelTargetSelect = document.getElementById("rebelTargetSelect");
const rebelTrickCardSelect = document.getElementById("rebelTrickCardSelect");
const rebelSnowWhiteToggle = document.getElementById("rebelSnowWhiteToggle");
const rebelPeaToggle = document.getElementById("rebelPeaToggle");
const rebelSubmitBtn = document.getElementById("rebelSubmitBtn");
const rebelPrincessBtn = document.getElementById("rebelPrincessBtn");
const rebelSkipBtn = document.getElementById("rebelSkipBtn");
const rebelNextRoundBtn = document.getElementById("rebelNextRoundBtn");
const rebelSummary = document.getElementById("rebelSummary");
const rebelSummaryBody = document.getElementById("rebelSummaryBody");
const rebelLog = document.getElementById("rebelLog");

function clearRebelPrincessState() {
  currentRebelView = null;
  rebelSelectedCardIds = [];
  rebelSelectedSuit = null;
}

function rebelPlayerName(id) {
  const p = currentRebelView && Array.isArray(currentRebelView.players)
    ? currentRebelView.players.find((item) => item.player_id === id)
    : null;
  return p ? p.name : id || "-";
}

function formatRebelSuit(suit) {
  if (!suit) return "-";
  return `${rebelSuitEmoji[suit] || ""} ${rebelSuitName[suit] || suit}`;
}

function formatRebelCard(card) {
  if (!card) return "Hidden";
  if (card.is_frog) return "🐸 8";
  return `${rebelSuitEmoji[card.suit] || ""} ${card.rank}`;
}

function rebelLegalCardSet(view) {
  return new Set((view.legal_cards || []).map((card) => card.id));
}

function updateRebelSelectionLabels() {
  if (rebelSelectedCards) {
    rebelSelectedCards.textContent = rebelSelectedCardIds.length ? rebelSelectedCardIds.join(", ") : "-";
  }
  if (rebelSelectedSuitLabel) {
    rebelSelectedSuitLabel.textContent = formatRebelSuit(rebelSelectedSuit);
  }
  if (rebelSelectedTarget) {
    rebelSelectedTarget.textContent = rebelTargetSelect && rebelTargetSelect.value ? rebelPlayerName(rebelTargetSelect.value) : "-";
  }
}

function toggleRebelCard(cardId, maxCards) {
  const idx = rebelSelectedCardIds.indexOf(cardId);
  if (idx >= 0) {
    rebelSelectedCardIds.splice(idx, 1);
  } else {
    if (Number.isInteger(maxCards) && maxCards > 0 && rebelSelectedCardIds.length >= maxCards) {
      rebelSelectedCardIds.shift();
    }
    rebelSelectedCardIds.push(cardId);
  }
  updateRebelSelectionLabels();
  renderRebelHand(currentRebelView);
}

function renderRebelSuitButtons(view) {
  if (!rebelSuitButtons) return;
  rebelSuitButtons.innerHTML = "";
  (view.suits || ["queen", "fairy", "pet", "prince"]).forEach((suit) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = formatRebelSuit(suit);
    btn.className = rebelSelectedSuit === suit ? "selected" : "";
    btn.addEventListener("click", () => {
      rebelSelectedSuit = rebelSelectedSuit === suit ? null : suit;
      renderRebelSuitButtons(currentRebelView);
      updateRebelSelectionLabels();
    });
    rebelSuitButtons.appendChild(btn);
  });
}

function renderRebelTargets(view) {
  if (!rebelTargetSelect) return;
  const old = rebelTargetSelect.value;
  rebelTargetSelect.innerHTML = "";
  (view.players || []).forEach((p) => {
    const option = document.createElement("option");
    option.value = p.player_id;
    option.textContent = p.name;
    rebelTargetSelect.appendChild(option);
  });
  if (old && Array.from(rebelTargetSelect.options).some((opt) => opt.value === old)) {
    rebelTargetSelect.value = old;
  }
  updateRebelSelectionLabels();
}

function renderRebelTrickCardSelect(view) {
  if (!rebelTrickCardSelect) return;
  rebelTrickCardSelect.innerHTML = "";
  const cards = view.pending_haggle && Array.isArray(view.pending_haggle.trick_cards)
    ? view.pending_haggle.trick_cards
    : view.phase === "sleeping_beauty_keep" && Array.isArray(view.sleeping_beauty_pool)
      ? view.sleeping_beauty_pool.map((item) => item.card)
      : view.scheherazade_drawn && view.scheherazade_drawn.card
        ? [view.scheherazade_drawn.card]
    : [];
  cards.forEach((card) => {
      const option = document.createElement("option");
      option.value = card.id;
      option.textContent = formatRebelCard(card);
    rebelTrickCardSelect.appendChild(option);
  });
}

function renderRebelHand(view) {
  if (!rebelHand) return;
  rebelHand.innerHTML = "";
  const legal = rebelLegalCardSet(view || {});
  const phase = view ? view.phase : "";
  const maxByPhase = {
    pass: view ? view.pass_required : 1,
    split_hand: view ? Math.floor((view.hand || []).length / 2) : 1,
  };
  const maxCards = maxByPhase[phase] || 1;
  (view.hand || []).forEach((card) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rebel-card";
    btn.textContent = formatRebelCard(card);
    if (card.suit) btn.dataset.suit = card.suit;
    if (rebelSelectedCardIds.includes(card.id)) btn.classList.add("selected");
    if (phase === "trick" && view.current_turn === view.you && legal.size && !legal.has(card.id)) {
      btn.disabled = true;
    }
    btn.addEventListener("click", () => toggleRebelCard(card.id, maxCards));
    rebelHand.appendChild(btn);
  });
  if (!view.hand || !view.hand.length) {
    rebelHand.textContent = "-";
  }
}

function renderRebelPlayers(view) {
  if (!rebelPlayers) return;
  rebelPlayers.innerHTML = "";
  (view.players || []).forEach((p) => {
    const row = document.createElement("div");
    row.className = "rebel-player-row";
    if (p.player_id === view.you) row.classList.add("you");
    const status = [];
    if (p.princess_used) status.push("used");
    if (p.passed) status.push("submitted");
    if (p.ready_next) status.push("ready");
    row.innerHTML = `
      <div class="rebel-player-main">
        <strong>${p.name}</strong>
        <span>${p.princess ? p.princess.name : "-"}</span>
      </div>
      <div class="rebel-player-stats">
        <span>Hand ${p.hand_count}</span>
        <span>Won ${p.won_count}</span>
        <span>Score ${p.score}</span>
        <span>${status.join(", ") || "-"}</span>
      </div>
    `;
    if (Array.isArray(p.revealed_cards) && p.revealed_cards.length) {
      const revealed = document.createElement("div");
      revealed.className = "rebel-revealed";
      revealed.textContent = `${formatRebelSuit(p.revealed_suit)}: ${p.revealed_cards.map(formatRebelCard).join(" ")}`;
      row.appendChild(revealed);
    }
    rebelPlayers.appendChild(row);
  });
}

function renderRebelTrick(view) {
  if (!rebelTrick) return;
  rebelTrick.innerHTML = "";
  (view.current_trick || []).forEach((entry) => {
    const item = document.createElement("div");
    item.className = "rebel-trick-card";
    item.innerHTML = `<span>${entry.name}</span><strong>${entry.hidden ? "🂠" : formatRebelCard(entry.card)}</strong>`;
    if (entry.was_void) item.title = "Void play";
    if (entry.snow_zero) item.title = "Counts as 0";
    rebelTrick.appendChild(item);
  });
  if (view.gift_count) {
    const gift = document.createElement("div");
    gift.className = "rebel-trick-card";
    gift.innerHTML = `<span>Gift</span><strong>🎁 x${view.gift_count}</strong>`;
    rebelTrick.appendChild(gift);
  }
  if (!rebelTrick.children.length) {
    rebelTrick.textContent = "-";
  }
}

function renderRebelSummary(view) {
  if (!rebelSummary || !rebelSummaryBody) return;
  const summary = view.last_round_summary;
  rebelSummary.classList.toggle("hidden", !summary);
  if (!summary) return;
  const rows = Object.entries(summary.round_scores || {}).map(([pid, score]) => {
    const total = summary.total_scores ? summary.total_scores[pid] : "";
    return `<div>${rebelPlayerName(pid)}: ${score} proposals, total ${total}</div>`;
  });
  rebelSummaryBody.innerHTML = rows.join("");
}

function updateRebelActions(view) {
  const actions = new Set(view.legal_actions || []);
  const phase = view.phase;
  if (rebelSubmitBtn) {
    rebelSubmitBtn.disabled = !(
      actions.has("pass_cards") ||
      actions.has("setup_choice") ||
      actions.has("choose_card") ||
      actions.has("play_card")
    );
    if (phase === "pass") rebelSubmitBtn.textContent = `Pass ${view.pass_required}`;
    else if (phase === "gift") rebelSubmitBtn.textContent = "Place Gift";
    else if (phase === "trick_pass") rebelSubmitBtn.textContent = "Pass Card";
    else if (phase === "sleeping_beauty_collect") rebelSubmitBtn.textContent = "Give Card";
    else if (phase === "trick") rebelSubmitBtn.textContent = "Play Card";
    else rebelSubmitBtn.textContent = "Submit";
  }
  if (rebelPrincessBtn) rebelPrincessBtn.disabled = !actions.has("use_princess");
  if (rebelSkipBtn) rebelSkipBtn.disabled = !actions.has("skip");
  if (rebelNextRoundBtn) rebelNextRoundBtn.disabled = !actions.has("next_round_ready");
  if (rebelSnowWhiteToggle) {
    const princess = view.your_princess ? view.your_princess.id : "";
    rebelSnowWhiteToggle.disabled = !(phase === "trick" && princess === "snow_white");
  }
  if (rebelPeaToggle) {
    const princess = view.your_princess ? view.your_princess.id : "";
    rebelPeaToggle.disabled = !(phase === "trick" && princess === "pea_princess");
  }
}

function renderRebelPrincessGameState(data) {
  const view = data.view || data;
  currentRebelView = view;
  if (!rebelPanel) return;
  const card = view.round_card || {};
  if (rebelRoundTitle) rebelRoundTitle.textContent = `${card.letter || ""}. ${card.name || "-"}`;
  if (rebelRoundSummary) rebelRoundSummary.textContent = card.summary || "-";
  if (rebelPhase) rebelPhase.textContent = view.phase || "-";
  if (rebelRound) rebelRound.textContent = view.round || "-";
  if (rebelLeader) rebelLeader.textContent = rebelPlayerName(view.leader);
  if (rebelTurn) rebelTurn.textContent = rebelPlayerName(view.current_turn);
  if (rebelLeadSuit) rebelLeadSuit.textContent = formatRebelSuit(view.lead_suit);
  if (rebelRequiredSuit) rebelRequiredSuit.textContent = formatRebelSuit(view.current_required_suit);
  if (rebelPrinceStatus) rebelPrinceStatus.textContent = view.princes_sneaked_in ? "In" : "Out";
  if (rebelTricks) rebelTricks.textContent = String(view.tricks_played || 0);
  if (rebelPrincess) {
    const p = view.your_princess || {};
    rebelPrincess.innerHTML = `<strong>${p.name || "-"}</strong><span>${p.summary || ""}</span>`;
  }
  renderRebelSuitButtons(view);
  renderRebelTargets(view);
  renderRebelTrickCardSelect(view);
  renderRebelHand(view);
  renderRebelPlayers(view);
  renderRebelTrick(view);
  renderRebelSummary(view);
  updateRebelActions(view);
  updateRebelSelectionLabels();
  if (rebelLog) {
    rebelLog.innerHTML = (view.log || []).slice(-30).map((line) => `<div>${line}</div>`).join("");
  }
}

function submitRebelPrimaryAction() {
  const view = currentRebelView;
  if (!view) return;
  const phase = view.phase;
  if (phase === "pass") {
    sendAction({ type: "pass_cards", card_ids: rebelSelectedCardIds.slice() });
  } else if (phase === "reserve_last") {
    sendAction({ type: "setup_choice", card_id: rebelSelectedCardIds[0] });
  } else if (phase === "reveal_suit") {
    sendAction({ type: "setup_choice", suit: rebelSelectedSuit });
  } else if (phase === "split_hand") {
    sendAction({ type: "setup_choice", card_ids: rebelSelectedCardIds.slice() });
  } else if (phase === "gift" || phase === "trick_pass" || phase === "sleeping_beauty_collect") {
    sendAction({ type: "choose_card", card_id: rebelSelectedCardIds[0] });
  } else if (phase === "trick") {
    const action = { type: "play_card", card_id: rebelSelectedCardIds[0] };
    if (rebelSnowWhiteToggle && rebelSnowWhiteToggle.checked) action.use_snow_white = true;
    if (rebelPeaToggle && rebelPeaToggle.checked) action.use_pea_princess = true;
    sendAction(action);
  }
}

function submitRebelPrincessAction() {
  const view = currentRebelView;
  if (!view || !view.your_princess) return;
  const princess = view.your_princess.id;
  const action = { type: "use_princess" };
  if (princess === "little_mermaid") action.suit = rebelSelectedSuit;
  if (princess === "scheherazade") {
    action.target_player_id = rebelTargetSelect ? rebelTargetSelect.value : null;
    if (rebelSelectedCardIds[0]) action.give_card_id = rebelSelectedCardIds[0];
  }
  if (princess === "sleeping_beauty" && view.phase === "sleeping_beauty_keep") {
    action.keep_card_id = rebelTrickCardSelect ? rebelTrickCardSelect.value : null;
  }
  if (view.phase === "mulan") action.card_id = rebelSelectedCardIds[0];
  if (view.phase === "scheherazade_decide" && rebelSelectedCardIds[0]) {
    action.give_card_id = rebelSelectedCardIds[0];
  }
  if (view.phase === "haggle") {
    action.hand_card_id = rebelSelectedCardIds[0];
    action.trick_card_id = rebelTrickCardSelect ? rebelTrickCardSelect.value : null;
  }
  if (view.phase === "pocahontas") action.target_player_id = rebelTargetSelect ? rebelTargetSelect.value : null;
  sendAction(action);
}

if (rebelTargetSelect) {
  rebelTargetSelect.addEventListener("change", updateRebelSelectionLabels);
}
if (rebelSubmitBtn) {
  rebelSubmitBtn.addEventListener("click", submitRebelPrimaryAction);
}
if (rebelPrincessBtn) {
  rebelPrincessBtn.addEventListener("click", submitRebelPrincessAction);
}
if (rebelSkipBtn) {
  rebelSkipBtn.addEventListener("click", () => sendAction({ type: "skip" }));
}
if (rebelNextRoundBtn) {
  rebelNextRoundBtn.addEventListener("click", () => sendAction({ type: "next_round_ready" }));
}
