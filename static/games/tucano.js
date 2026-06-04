let currentTucanoView = null;
let tucanoExplainMode = false;
let tucanoSelection = null;

const tucanoPhaseLabel = document.getElementById("tucanoPhase");
const tucanoTurnLabel = document.getElementById("tucanoTurn");
const tucanoDeckLabel = document.getElementById("tucanoDeck");
const tucanoWinnerLabel = document.getElementById("tucanoWinner");
const tucanoNotice = document.getElementById("tucanoNotice");
const tucanoNoticeTitle = document.getElementById("tucanoNoticeTitle");
const tucanoNoticeBody = document.getElementById("tucanoNoticeBody");
const tucanoColumns = document.getElementById("tucanoColumns");
const tucanoPlayers = document.getElementById("tucanoPlayers");
const tucanoSelectionLabel = document.getElementById("tucanoSelection");
const tucanoFlipBtn = document.getElementById("tucanoFlipBtn");
const tucanoSkipBtn = document.getElementById("tucanoSkipBtn");
const tucanoHelpBtn = document.getElementById("tucanoHelpBtn");
const tucanoExplainBtn = document.getElementById("tucanoExplainBtn");
const tucanoHelpModal = document.getElementById("tucanoHelpModal");
const tucanoHelpModalCloseBtn = document.getElementById("tucanoHelpModalCloseBtn");
const tucanoHelpContent = document.getElementById("tucanoHelpContent");
const tucanoExplainModal = document.getElementById("tucanoExplainModal");
const tucanoExplainModalCloseBtn = document.getElementById("tucanoExplainModalCloseBtn");
const tucanoExplainContent = document.getElementById("tucanoExplainContent");

const TUCANO_TOUCAN_LABELS = {
  give: "🎁 Give",
  steal: "🪶 Steal",
  flip: "🛡️ Flip",
};

const TUCANO_EXPLAIN = {
  tucanoColumns: "Choose one non-empty column on your draft turn. You take every card in that column.",
  tucanoPlayers: "Face-up fruit can be given or stolen. Protected face-down cards are counted but cannot be targeted.",
  tucanoFlipBtn: "Resolve a Flip toucan by moving all of your face-up fruit into protected face-down storage.",
  tucanoSkipBtn: "Skip is available only when the active Give or Steal toucan has no legal target.",
};

const TUCANO_HELP_HTML = `
  <div class="tucano-help">
    <p><strong>Goal.</strong> Collect fruit for the best final score. Bad sets can be handed to opponents with toucans.</p>
    <p><strong>Turn.</strong> Take one full column, immediately resolve any toucan cards you took, then each column receives one new card while the deck has cards.</p>
    <p><strong>Toucans.</strong> 🎁 Give one of your face-up fruit to another player. 🪶 Steal one face-up fruit from another player. 🛡️ Flip protects all your face-up fruit face down.</p>
    <p><strong>End.</strong> When the deck is empty and only one column remains, the game ends and the final column is discarded. Jokers are assigned automatically to the highest scoring fruit for their owner.</p>
    <p><strong>Data note.</strong> This implementation uses a proxy fruit distribution and scoring table because task75 notes the exact published card list and scoring matrix were unavailable.</p>
  </div>
`;

function tucanoFruitLabel(view, fruit) {
  if (fruit === "joker") {
    return "🌈 Joker";
  }
  const spec = view && view.fruit_defs ? view.fruit_defs[fruit] : null;
  if (!spec) {
    return fruit || "-";
  }
  return `${spec.emoji || ""} ${spec.name || fruit}`;
}

function tucanoCardText(view, card) {
  if (!card) {
    return "-";
  }
  if (card.type === "toucan") {
    return TUCANO_TOUCAN_LABELS[card.toucan] || `🪶 ${card.toucan}`;
  }
  return tucanoFruitLabel(view, card.fruit);
}

function tucanoScoreEffect(spec) {
  if (!spec) {
    return "";
  }
  if (spec.majority) {
    return `Most +${spec.majority.win}/card · else -${spec.majority.lose}/card`;
  }
  if (spec.score) {
    const keys = Object.keys(spec.score)
      .map((key) => Number.parseInt(key, 10))
      .filter((key) => Number.isInteger(key))
      .sort((a, b) => a - b);
    const values = keys.map((key) => spec.score[key]);
    const range = keys.length ? `${keys[0]}-${keys[keys.length - 1]}` : "Score";
    return `${range}: ${values.join("/")}`;
  }
  return "";
}

function tucanoCardInfo(view, card) {
  if (!card) {
    return { icon: "?", title: "-", effect: "" };
  }
  if (card.type === "toucan") {
    if (card.toucan === "give") {
      return { icon: "🎁", title: "Give", effect: "Give 1 fruit" };
    }
    if (card.toucan === "steal") {
      return { icon: "🪶", title: "Steal", effect: "Take 1 fruit" };
    }
    if (card.toucan === "flip") {
      return { icon: "🛡️", title: "Flip", effect: "Protect yours" };
    }
    return { icon: "🪶", title: "Toucan", effect: "Resolve now" };
  }
  if (card.type === "joker") {
    return { icon: "🌈", title: "Joker", effect: "Wild at end" };
  }
  const spec = view && view.fruit_defs ? view.fruit_defs[card.fruit] : null;
  return {
    icon: spec && spec.emoji ? spec.emoji : "🍈",
    title: spec && spec.name ? spec.name : card.fruit || "Fruit",
    effect: tucanoScoreEffect(spec),
  };
}

function renderTucanoCardFace(view, card) {
  const info = tucanoCardInfo(view, card);
  const cardEl = document.createElement("div");
  cardEl.className = `tucano-card tucano-card-${card.type}`;

  const icon = document.createElement("div");
  icon.className = "tucano-card-icon";
  icon.textContent = info.icon;

  const title = document.createElement("div");
  title.className = "tucano-card-name";
  title.textContent = info.title;

  const effect = document.createElement("div");
  effect.className = "tucano-card-effect";
  effect.textContent = info.effect;

  cardEl.title = `${info.title}: ${info.effect}`;
  cardEl.append(icon, title, effect);
  return cardEl;
}

function isTucanoActionAvailable(actionType) {
  return !!(
    currentTucanoView &&
    Array.isArray(currentTucanoView.legal_actions) &&
    currentTucanoView.legal_actions.includes(actionType)
  );
}

function clearTucanoSelection() {
  tucanoSelection = null;
  if (tucanoSelectionLabel) {
    tucanoSelectionLabel.textContent = "Selected: -";
  }
}

function updateTucanoSelectionLabel() {
  if (!tucanoSelectionLabel) {
    return;
  }
  if (!tucanoSelection || !currentTucanoView) {
    tucanoSelectionLabel.textContent = "Selected: -";
    return;
  }
  const fruit = tucanoFruitLabel(currentTucanoView, tucanoSelection.fruit);
  const target = tucanoSelection.targetPlayer ? findPlayerName(currentTucanoView, tucanoSelection.targetPlayer) : "-";
  tucanoSelectionLabel.textContent = `Selected: ${fruit} → ${target}`;
}

function clearTucanoState() {
  currentTucanoView = null;
  tucanoExplainMode = false;
  clearTucanoSelection();
  document.body.classList.remove("tucano-explain-mode");
  if (tucanoExplainBtn) {
    tucanoExplainBtn.classList.remove("active");
  }
  [tucanoPhaseLabel, tucanoTurnLabel, tucanoDeckLabel, tucanoWinnerLabel].forEach((el) => {
    if (el) {
      el.textContent = "-";
    }
  });
  if (tucanoColumns) {
    tucanoColumns.innerHTML = "";
  }
  if (tucanoPlayers) {
    tucanoPlayers.innerHTML = "";
  }
  if (tucanoNotice) {
    tucanoNotice.classList.add("hidden");
    tucanoNotice.setAttribute("aria-hidden", "true");
  }
  updateTucanoActionButtons();
}

function showTucanoHeaderActions(show) {
  if (tucanoHelpBtn) {
    tucanoHelpBtn.classList.toggle("hidden", !show);
  }
  if (tucanoExplainBtn) {
    tucanoExplainBtn.classList.toggle("hidden", !show);
  }
}

function updateTucanoActionButtons() {
  const activeToucan = currentTucanoView ? currentTucanoView.active_toucan : null;
  if (tucanoFlipBtn) {
    tucanoFlipBtn.disabled = !(currentGameType === "tucano" && activeToucan === "flip" && isTucanoActionAvailable("resolve_toucan"));
    tucanoFlipBtn.classList.toggle("action-allowed", !tucanoFlipBtn.disabled);
  }
  if (tucanoSkipBtn) {
    tucanoSkipBtn.disabled = !(currentGameType === "tucano" && isTucanoActionAvailable("skip_toucan"));
    tucanoSkipBtn.classList.toggle("action-allowed", !tucanoSkipBtn.disabled);
  }
}

function renderTucanoNotice(view) {
  if (!tucanoNotice || !tucanoNoticeTitle || !tucanoNoticeBody) {
    return;
  }
  if (view.game_over) {
    tucanoNotice.classList.remove("hidden");
    tucanoNotice.setAttribute("aria-hidden", "false");
    tucanoNoticeTitle.textContent = "Game Over";
    tucanoNoticeBody.textContent = "Final scores are shown on each player board.";
    return;
  }
  if (view.phase !== "toucan" || !view.active_toucan) {
    tucanoNotice.classList.add("hidden");
    tucanoNotice.setAttribute("aria-hidden", "true");
    return;
  }
  const active = view.active_toucan;
  tucanoNotice.classList.remove("hidden");
  tucanoNotice.setAttribute("aria-hidden", "false");
  tucanoNoticeTitle.textContent = TUCANO_TOUCAN_LABELS[active] || "Toucan";
  if (active === "give") {
    tucanoNoticeBody.textContent = "Choose one of your face-up fruit, then choose a different player.";
  } else if (active === "steal") {
    tucanoNoticeBody.textContent = "Choose another player's face-up fruit to take it.";
  } else {
    tucanoNoticeBody.textContent = "Protect all of your face-up fruit.";
  }
}

function renderTucanoColumns(view) {
  if (!tucanoColumns) {
    return;
  }
  tucanoColumns.innerHTML = "";
  tucanoColumns.classList.add("has-explanation");
  tucanoColumns.dataset.explainId = "tucanoColumns";
  (view.columns || []).forEach((column, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tucano-column";
    button.disabled = !(view.phase === "draft" && isTucanoActionAvailable("draft_column") && column.length);
    if (!button.disabled) {
      button.classList.add("action-allowed");
    }
    const title = document.createElement("div");
    title.className = "tucano-column-title";
    title.textContent = `Column ${index + 1}`;
    const cards = document.createElement("div");
    cards.className = "tucano-card-list";
    if (!column.length) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "Empty";
      cards.appendChild(empty);
    } else {
      column.forEach((card) => {
        cards.appendChild(renderTucanoCardFace(view, card));
      });
    }
    button.append(title, cards);
    button.addEventListener("click", () => {
      if (!button.disabled) {
        sendAction({ type: "draft_column", column: index });
      }
    });
    tucanoColumns.appendChild(button);
  });
}

function renderTucanoFruitStack(view, player, fruit, count) {
  const activeToucan = view.active_toucan;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tucano-fruit-chip";
  button.textContent = `${tucanoFruitLabel(view, fruit)} ×${count}`;
  const isSelf = player.player_id === view.you;
  let selectable = false;
  if (view.phase === "toucan" && activeToucan === "give" && isSelf && isTucanoActionAvailable("resolve_toucan")) {
    selectable = true;
  }
  if (view.phase === "toucan" && activeToucan === "steal" && !isSelf && isTucanoActionAvailable("resolve_toucan")) {
    selectable = true;
  }
  button.disabled = !selectable;
  if (selectable) {
    button.classList.add("action-allowed");
  }
  if (tucanoSelection && tucanoSelection.fruit === fruit && tucanoSelection.targetPlayer === player.player_id) {
    button.classList.add("selected");
  }
  button.addEventListener("click", () => {
    if (button.disabled) {
      return;
    }
    if (activeToucan === "give") {
      tucanoSelection = { fruit, targetPlayer: null };
      updateTucanoSelectionLabel();
      renderTucanoPlayers(view);
      return;
    }
    sendAction({ type: "resolve_toucan", fruit, target_player: player.player_id });
  });
  return button;
}

function tucanoScoreRowText(view, fruit, count, row) {
  const spec = view && view.fruit_defs ? view.fruit_defs[fruit] : null;
  const label = tucanoFruitLabel(view, fruit);
  if (row) {
    return `${label} ×${row.count}: ${row.points}`;
  }
  if (!spec) {
    return `${label} ×${count}: ?`;
  }
  if (spec.majority) {
    return `${label} ×${count}: majority`;
  }
  const table = spec.score || {};
  const keys = Object.keys(table).map((key) => Number.parseInt(key, 10)).filter((key) => Number.isInteger(key));
  const capped = Math.min(count, Math.max(...keys));
  const points = table[capped];
  return `${label} ×${count}: ${points}`;
}

function renderTucanoScoreBreakdown(view, player) {
  const breakdown = document.createElement("div");
  breakdown.className = "tucano-score-breakdown";

  const title = document.createElement("div");
  title.className = "tucano-score-title";
  title.textContent = player.score == null ? "Visible score" : `Score: ${player.score}`;
  breakdown.appendChild(title);

  const rows = player.score_breakdown || null;
  const counts = player.score_counts || player.face_up || {};
  const entries = Object.entries(rows || counts).filter(([, value]) => {
    if (rows) {
      return value && (value.count || value.points);
    }
    return Number(value) > 0;
  });

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = player.score == null ? "No visible scoring fruit." : "No scoring fruit.";
    breakdown.appendChild(empty);
  } else {
    entries.forEach(([fruit, value]) => {
      const item = document.createElement("div");
      item.className = "tucano-score-row";
      item.textContent = rows ? tucanoScoreRowText(view, fruit, value.count || 0, value) : tucanoScoreRowText(view, fruit, Number(value), null);
      breakdown.appendChild(item);
    });
  }

  if (player.protected_count && player.score == null) {
    const protectedRow = document.createElement("div");
    protectedRow.className = "tucano-score-row";
    protectedRow.textContent = `🛡️ ${player.protected_count}: hidden until final`;
    breakdown.appendChild(protectedRow);
  }

  const jokerAssignment = Object.entries(player.joker_assignment || {})
    .map(([fruit, count]) => `${tucanoFruitLabel(view, fruit)} ×${count}`)
    .join(", ");
  if (jokerAssignment) {
    const joker = document.createElement("div");
    joker.className = "tucano-score-row";
    joker.textContent = `🌈 ${jokerAssignment}`;
    breakdown.appendChild(joker);
  } else if (player.jokers && player.score == null) {
    const joker = document.createElement("div");
    joker.className = "tucano-score-row";
    joker.textContent = `🌈 ${player.jokers}: wild at end`;
    breakdown.appendChild(joker);
  }

  return breakdown;
}

function renderTucanoPlayers(view) {
  if (!tucanoPlayers) {
    return;
  }
  tucanoPlayers.innerHTML = "";
  tucanoPlayers.classList.add("has-explanation");
  tucanoPlayers.dataset.explainId = "tucanoPlayers";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card tucano-player-card";
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }

    const header = document.createElement("div");
    header.className = "tucano-player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id || "-";
    const meta = document.createElement("div");
    meta.className = "tucano-player-meta";
    const score = player.score == null ? "" : ` · ${player.score} pts`;
    meta.textContent = `🌈 ${player.jokers || 0} · 🛡️ ${player.protected_count || 0}${score}`;
    header.append(name, meta);

    const fruits = document.createElement("div");
    fruits.className = "tucano-fruit-grid";
    const entries = Object.entries(player.face_up || {}).filter(([, count]) => count > 0);
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "No face-up fruit.";
      fruits.appendChild(empty);
    } else {
      entries.forEach(([fruit, count]) => {
        fruits.appendChild(renderTucanoFruitStack(view, player, fruit, count));
      });
    }

    if (view.phase === "toucan" && view.active_toucan === "give" && player.player_id !== view.you && tucanoSelection && tucanoSelection.fruit) {
      const giveTarget = document.createElement("button");
      giveTarget.type = "button";
      giveTarget.className = "tucano-target-btn action-allowed";
      giveTarget.textContent = `Give to ${player.name || player.player_id}`;
      giveTarget.addEventListener("click", () => {
        sendAction({ type: "resolve_toucan", fruit: tucanoSelection.fruit, target_player: player.player_id });
      });
      card.append(header, fruits, giveTarget);
    } else {
      card.append(header, fruits);
    }

    card.appendChild(renderTucanoScoreBreakdown(view, player));

    tucanoPlayers.appendChild(card);
  });
}

function formatTucanoWinner(view) {
  const winners = Array.isArray(view.winner) ? view.winner : view.winner ? [view.winner] : [];
  if (!winners.length) {
    return "-";
  }
  return winners.map((pid) => findPlayerName(view, pid)).join(", ");
}

function renderTucanoGameState(data) {
  const view = data.view;
  currentTucanoView = view;
  if (currentGameType !== "tucano") {
    currentGameType = "tucano";
    setGamePanelVisibility("tucano");
  }
  if (tucanoPhaseLabel) {
    tucanoPhaseLabel.textContent = view.phase || "-";
  }
  if (tucanoTurnLabel) {
    tucanoTurnLabel.textContent = findPlayerName(view, view.current_turn) || "-";
  }
  if (tucanoDeckLabel) {
    tucanoDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (tucanoWinnerLabel) {
    tucanoWinnerLabel.textContent = formatTucanoWinner(view);
  }
  renderTucanoNotice(view);
  renderTucanoColumns(view);
  renderTucanoPlayers(view);
  logGameEvents(data);
  updateTucanoSelectionLabel();
  updateTucanoActionButtons();
}

function showTucanoHelp() {
  if (!tucanoHelpModal || !tucanoHelpContent) {
    return;
  }
  tucanoHelpContent.innerHTML = TUCANO_HELP_HTML;
  setModalVisible(tucanoHelpModal, true);
}

function exitTucanoExplainMode() {
  tucanoExplainMode = false;
  document.body.classList.remove("tucano-explain-mode");
  if (tucanoExplainBtn) {
    tucanoExplainBtn.classList.remove("active");
  }
}

function showTucanoExplanation(explainId) {
  if (!tucanoExplainModal || !tucanoExplainContent) {
    return;
  }
  tucanoExplainContent.innerHTML = `<p>${TUCANO_EXPLAIN[explainId] || "No explanation available."}</p>`;
  setModalVisible(tucanoExplainModal, true);
}

if (tucanoFlipBtn) {
  tucanoFlipBtn.classList.add("has-explanation");
  tucanoFlipBtn.dataset.explainId = "tucanoFlipBtn";
  tucanoFlipBtn.addEventListener("click", () => {
    sendAction({ type: "resolve_toucan" });
  });
}

if (tucanoSkipBtn) {
  tucanoSkipBtn.classList.add("has-explanation");
  tucanoSkipBtn.dataset.explainId = "tucanoSkipBtn";
  tucanoSkipBtn.addEventListener("click", () => {
    sendAction({ type: "skip_toucan" });
  });
}

if (tucanoHelpBtn) {
  tucanoHelpBtn.addEventListener("click", showTucanoHelp);
}

if (tucanoHelpModalCloseBtn) {
  tucanoHelpModalCloseBtn.addEventListener("click", () => setModalVisible(tucanoHelpModal, false));
}

if (tucanoExplainBtn) {
  tucanoExplainBtn.addEventListener("click", () => {
    tucanoExplainMode = !tucanoExplainMode;
    document.body.classList.toggle("tucano-explain-mode", tucanoExplainMode);
    tucanoExplainBtn.classList.toggle("active", tucanoExplainMode);
  });
}

if (tucanoExplainModalCloseBtn) {
  tucanoExplainModalCloseBtn.addEventListener("click", () => setModalVisible(tucanoExplainModal, false));
}

document.addEventListener("click", (event) => {
  if (currentGameType !== "tucano") {
    return;
  }
  if (tucanoExplainMode) {
    const explainable = event.target.closest(".has-explanation");
    if (!explainable) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const explainId = explainable.dataset.explainId || explainable.id;
    showTucanoExplanation(explainId);
    exitTucanoExplainMode();
    return;
  }
  if (!tucanoSelection) {
    return;
  }
  const insideTucano = event.target.closest("#tucanoPanel");
  const onSelectable = event.target.closest(".tucano-fruit-chip, .tucano-target-btn");
  if (insideTucano && !onSelectable) {
    clearTucanoSelection();
    if (currentTucanoView) {
      renderTucanoPlayers(currentTucanoView);
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || currentGameType !== "tucano") {
    return;
  }
  if (tucanoExplainMode) {
    exitTucanoExplainMode();
  }
  if (tucanoSelection) {
    clearTucanoSelection();
    if (currentTucanoView) {
      renderTucanoPlayers(currentTucanoView);
    }
  }
});
