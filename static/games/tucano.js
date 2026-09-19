let currentTucanoView = null;
let tucanoExplainMode = false;
let tucanoSelection = null;
let tucanoExplainClickPending = false;
let tucanoModalTrigger = null;
const tucanoOpenScores = new Set();

const tucanoPhaseLabel = document.getElementById("tucanoPhase");
const tucanoRoot = document.getElementById("tucanoPanel");
const tucanoTurnLabel = document.getElementById("tucanoTurn");
const tucanoDeckLabel = document.getElementById("tucanoDeck");
const tucanoWinnerLabel = document.getElementById("tucanoWinner");
const tucanoNotice = document.getElementById("tucanoNotice");
const tucanoNoticeTitle = document.getElementById("tucanoNoticeTitle");
const tucanoNoticeBody = document.getElementById("tucanoNoticeBody");
const tucanoColumns = document.getElementById("tucanoColumns");
const tucanoMarket = document.querySelector("#tucanoPanel .tucano-market");
const tucanoPlayers = document.getElementById("tucanoPlayers");
const tucanoActions = document.getElementById("tucanoActions");
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
  tucanoScores: "Expand Scores to inspect each fruit set. During play, only face-up fruit is scored here; protected fruit and jokers are included in the final score. Majority fruit is settled at the end.",
  tucanoFlipBtn: "Resolve a Flip toucan by moving all of your face-up fruit into protected face-down storage.",
  tucanoSkipBtn: "Skip is available only when the active Give or Steal toucan has no legal target.",
};

const TUCANO_HELP_HTML = `
  <div class="tucano-help">
    <p><strong>Goal.</strong> Collect fruit for the best final score. Bad sets can be handed to opponents with toucans.</p>
    <p><strong>Turn.</strong> Take one full column, immediately resolve any toucan cards you took, then each column receives one new card while the deck has cards.</p>
    <p><strong>Toucans.</strong> 🎁 Give one of your face-up fruit to another player. 🪶 Steal one face-up fruit from another player. 🛡️ Flip protects all your face-up fruit face down.</p>
    <p><strong>End.</strong> When the deck is empty and only one column remains, the game ends and the final column is discarded. Jokers are assigned automatically to the highest scoring fruit for their owner.</p>
    <p><strong>Reading cards.</strong> The numbers below each fruit are the total points for collecting 1, 2, 3… cards of that fruit. Orange numbers are negative. Use Explain to inspect a card or fruit stack, including unavailable actions.</p>
    <p><strong>Controls.</strong> Scroll inside a tall column to see every card, then use Take all. For Give, tap your fruit and then a recipient. Tap the selected fruit again or empty space to cancel. Press Esc or tap outside a dialog to close it.</p>
    <p><strong>Scoring variant.</strong> This game uses a simplified fruit distribution and scoring table. The values shown on the cards are the rules used for this game.</p>
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
  cardEl.className = `tucano-card tucano-card-${card.type} has-explanation`;
  cardEl.dataset.explainTitle = info.title;
  cardEl.dataset.explainText = `${info.title}: ${info.effect}. ${card.type === "fruit" ? "Scores are totals for the number of cards in your set." : "Resolve toucans immediately; jokers score at the end."}`;

  const icon = document.createElement("div");
  icon.className = "tucano-card-icon";
  icon.textContent = info.icon;

  const title = document.createElement("div");
  title.className = "tucano-card-name";
  title.textContent = info.title;

  const effect = document.createElement("div");
  effect.className = "tucano-card-effect";
  const spec = view.fruit_defs && view.fruit_defs[card.fruit];
  if (spec && spec.score) {
    const entries = Object.entries(spec.score).sort(([a], [b]) => Number(a) - Number(b));
    const range = document.createElement("div");
    range.textContent = `${entries[0][0]}–${entries[entries.length - 1][0]} cards`;
    const scale = document.createElement("div");
    scale.className = "tucano-score-scale";
    entries.forEach(([count, points]) => {
      const value = document.createElement("span");
      value.textContent = points;
      value.title = `${count} cards: ${points} points`;
      value.classList.toggle("is-negative", points < 0);
      scale.appendChild(value);
    });
    effect.append(range, scale);
  } else {
    effect.textContent = info.effect;
  }

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
  updateTucanoSelectionLabel();
}

function updateTucanoSelectionLabel() {
  if (!tucanoSelectionLabel) {
    return;
  }
  if (!tucanoSelection || !currentTucanoView) {
    tucanoSelectionLabel.textContent = "";
    tucanoSelectionLabel.classList.add("hidden");
    return;
  }
  const fruit = tucanoFruitLabel(currentTucanoView, tucanoSelection.fruit);
  tucanoSelectionLabel.classList.remove("hidden");
  tucanoSelectionLabel.textContent = `${fruit} selected → choose a recipient below.`;
}

function clearTucanoState() {
  currentTucanoView = null;
  tucanoExplainMode = false;
  tucanoExplainClickPending = false;
  tucanoOpenScores.clear();
  if (tucanoRoot) {
    delete tucanoRoot.dataset.phase;
  }
  clearTucanoSelection();
  document.body.classList.remove("tucano-explain-mode");
  if (tucanoExplainBtn) {
    tucanoExplainBtn.classList.remove("active");
    tucanoExplainBtn.setAttribute("aria-pressed", "false");
  }
  [tucanoPhaseLabel, tucanoTurnLabel, tucanoDeckLabel, tucanoWinnerLabel].forEach((el) => {
    if (el) {
      el.textContent = "-";
    }
  });
  if (tucanoColumns) {
    tucanoColumns.innerHTML = "";
  }
  if (tucanoMarket) {
    tucanoMarket.classList.remove("hidden");
  }
  if (tucanoPlayers) {
    tucanoPlayers.innerHTML = "";
  }
  if (tucanoNotice) {
    tucanoNotice.classList.add("hidden");
    tucanoNotice.setAttribute("aria-hidden", "true");
  }
  if (tucanoWinnerLabel) {
    tucanoWinnerLabel.classList.add("hidden");
  }
  closeTucanoModal(tucanoHelpModal);
  closeTucanoModal(tucanoExplainModal);
  updateTucanoActionButtons();
}

function showTucanoHeaderActions(show) {
  if (!show) {
    exitTucanoExplainMode();
    closeTucanoModal(tucanoHelpModal);
    closeTucanoModal(tucanoExplainModal);
  }
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
    tucanoFlipBtn.classList.toggle("hidden", activeToucan !== "flip");
  }
  if (tucanoSkipBtn) {
    tucanoSkipBtn.disabled = !(currentGameType === "tucano" && isTucanoActionAvailable("skip_toucan"));
    tucanoSkipBtn.classList.toggle("action-allowed", !tucanoSkipBtn.disabled);
    tucanoSkipBtn.classList.toggle("hidden", tucanoSkipBtn.disabled);
  }
  if (tucanoActions) {
    tucanoActions.classList.toggle("hidden", activeToucan !== "flip" && !isTucanoActionAvailable("skip_toucan"));
  }
}

function renderTucanoNotice(view) {
  if (!tucanoNotice || !tucanoNoticeTitle || !tucanoNoticeBody) {
    return;
  }
  const yourTurn = view.current_turn === view.you && !view.game_over;
  tucanoNotice.classList.remove("hidden");
  tucanoNotice.setAttribute("aria-hidden", "false");
  tucanoNotice.classList.toggle("is-your-turn", yourTurn);
  tucanoNotice.classList.toggle("is-toucan", view.phase === "toucan");
  if (view.game_over) {
    tucanoNoticeTitle.textContent = "Game Over";
    tucanoNoticeBody.textContent = "Final scores are shown on each player board.";
    return;
  }
  if (view.phase !== "toucan" || !view.active_toucan) {
    tucanoNoticeTitle.textContent = yourTurn ? "Your turn" : "Waiting for the next pick";
    tucanoNoticeBody.textContent = yourTurn ? "Choose a column and tap Take all." : `${findPlayerName(view, view.current_turn)} is choosing a column.`;
    return;
  }
  const active = view.active_toucan;
  tucanoNotice.classList.remove("hidden");
  tucanoNotice.setAttribute("aria-hidden", "false");
  tucanoNoticeTitle.textContent = TUCANO_TOUCAN_LABELS[active] || "Toucan";
  if (!yourTurn) {
    tucanoNoticeBody.textContent = `${findPlayerName(view, view.current_turn)} is resolving this toucan.`;
    return;
  }
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
    const columnEl = document.createElement("div");
    columnEl.className = "tucano-column";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tucano-column-select has-explanation";
    button.dataset.explainId = "tucanoColumns";
    button.disabled = !(view.phase === "draft" && isTucanoActionAvailable("draft_column") && column.length);
    if (!button.disabled) {
      button.classList.add("action-allowed");
      columnEl.classList.add("is-available");
    }
    button.textContent = column.length ? "Take all" : "Empty";
    button.setAttribute("aria-label", `Take column ${index + 1}, ${column.length} cards`);
    const title = document.createElement("h4");
    title.className = "tucano-column-title";
    const number = document.createElement("span");
    number.textContent = `Pile ${index + 1}`;
    const count = document.createElement("span");
    count.className = "tucano-column-count";
    count.textContent = `${column.length} ${column.length === 1 ? "card" : "cards"}`;
    title.append(number, count);
    const cards = document.createElement("div");
    cards.className = "tucano-card-list";
    cards.tabIndex = 0;
    cards.setAttribute("role", "region");
    cards.setAttribute("aria-label", `Column ${index + 1} cards, scroll to inspect`);
    if (!column.length) {
      const empty = document.createElement("div");
      empty.className = "tucano-empty";
      empty.textContent = "No cards";
      cards.appendChild(empty);
    } else {
      column.forEach((card) => {
        cards.appendChild(renderTucanoCardFace(view, card));
      });
    }
    columnEl.append(title, cards, button);
    button.addEventListener("click", () => {
      if (!button.disabled) {
        sendAction({ type: "draft_column", column: index });
      }
    });
    tucanoColumns.appendChild(columnEl);
  });
}

function renderTucanoFruitStack(view, player, fruit, count) {
  const activeToucan = view.active_toucan;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tucano-fruit-chip has-explanation";
  const info = tucanoCardInfo(view, { type: "fruit", fruit });
  const icon = document.createElement("span");
  icon.className = "tucano-fruit-icon";
  icon.textContent = info.icon;
  icon.setAttribute("aria-hidden", "true");
  const quantity = document.createElement("strong");
  quantity.textContent = `×${count}`;
  button.append(icon, quantity);
  button.title = `${info.title} ×${count}`;
  button.setAttribute("aria-label", button.title);
  button.dataset.explainTitle = button.title;
  button.dataset.explainText = `${info.title}: ${info.effect}. Face-up fruit can be given or stolen; protected fruit cannot.`;
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
  const selected = !!(tucanoSelection && tucanoSelection.fruit === fruit && isSelf);
  button.setAttribute("aria-pressed", String(selected));
  if (selected) {
    button.classList.add("selected");
  }
  button.addEventListener("click", () => {
    if (button.disabled) {
      return;
    }
    if (activeToucan === "give") {
      tucanoSelection = selected ? null : { fruit };
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
  const details = document.createElement("details");
  details.className = "tucano-score-details";
  details.open = view.game_over || tucanoOpenScores.has(player.player_id);
  details.addEventListener("toggle", () => {
    if (!details.isConnected) {
      return;
    }
    if (details.open) {
      tucanoOpenScores.add(player.player_id);
    } else {
      tucanoOpenScores.delete(player.player_id);
    }
  });
  const breakdown = document.createElement("div");
  breakdown.className = "tucano-score-breakdown";

  const title = document.createElement("summary");
  title.className = "has-explanation";
  title.dataset.explainId = "tucanoScores";
  title.textContent = player.score == null ? "Scores · face-up fruit" : `Scores · ${player.score} pts`;
  details.append(title, breakdown);

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
    empty.className = "tucano-empty";
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

  return details;
}

function renderTucanoPlayers(view) {
  if (!tucanoPlayers) {
    return;
  }
  tucanoPlayers.innerHTML = "";
  tucanoPlayers.classList.add("has-explanation");
  tucanoPlayers.dataset.explainId = "tucanoPlayers";
  const players = [...(view.players || [])].sort((a, b) => Number(b.player_id === view.you) - Number(a.player_id === view.you));
  players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "tucano-player-card";
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }

    const header = document.createElement("div");
    header.className = "tucano-player-header";
    const name = document.createElement("div");
    name.className = "tucano-player-heading";
    const nameText = document.createElement("strong");
    nameText.className = "tucano-player-name";
    nameText.textContent = player.name || player.player_id || "-";
    const badges = document.createElement("div");
    badges.className = "tucano-player-badges";
    if (player.player_id === view.you) {
      const badge = document.createElement("span");
      badge.textContent = "You";
      badges.appendChild(badge);
    }
    if (player.player_id === view.current_turn && !view.game_over) {
      const badge = document.createElement("span");
      badge.textContent = "Turn";
      badges.appendChild(badge);
    }
    name.append(nameText, badges);
    const meta = document.createElement("div");
    meta.className = "tucano-player-meta";
    const score = player.score == null ? "" : ` · ${player.score} pts`;
    meta.textContent = `🌈 ${player.jokers || 0} wild · 🛡️ ${player.protected_count || 0} protected${score}`;
    header.append(name, meta);

    const fruits = document.createElement("div");
    fruits.className = "tucano-fruit-grid";
    const entries = Object.entries(player.face_up || {}).filter(([, count]) => count > 0);
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "tucano-empty";
      empty.textContent = "No face-up fruit.";
      fruits.appendChild(empty);
    } else {
      entries.forEach(([fruit, count]) => {
        fruits.appendChild(renderTucanoFruitStack(view, player, fruit, count));
      });
    }

    if (view.phase === "toucan" && view.active_toucan === "give" && isTucanoActionAvailable("resolve_toucan") && player.player_id !== view.you && tucanoSelection && tucanoSelection.fruit) {
      const giveTarget = document.createElement("button");
      giveTarget.type = "button";
      giveTarget.className = "tucano-target-btn action-allowed has-explanation";
      giveTarget.dataset.explainText = "Give one card of your selected fruit to this player.";
      giveTarget.textContent = `🎁 Give ${tucanoFruitLabel(view, tucanoSelection.fruit)} to ${player.name || player.player_id}`;
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
  clearTucanoSelection();
  currentTucanoView = view;
  if (tucanoRoot) {
    tucanoRoot.dataset.phase = view.phase || "draft";
  }
  if (currentGameType !== "tucano") {
    currentGameType = "tucano";
    setGamePanelVisibility("tucano");
  }
  if (tucanoPhaseLabel) {
    tucanoPhaseLabel.textContent = view.game_over ? "Finished" : view.phase === "toucan" ? "🪶 Toucan" : "🍃 Draft";
  }
  if (tucanoTurnLabel) {
    tucanoTurnLabel.textContent = view.game_over ? "—" : view.current_turn === view.you ? "You" : findPlayerName(view, view.current_turn) || "-";
  }
  if (tucanoDeckLabel) {
    tucanoDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (tucanoWinnerLabel) {
    tucanoWinnerLabel.textContent = `🏆 Winner: ${formatTucanoWinner(view)}`;
    tucanoWinnerLabel.classList.toggle("hidden", !view.game_over);
  }
  if (tucanoMarket) {
    tucanoMarket.classList.toggle("hidden", view.game_over);
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
  const reference = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Fruit scoring reference";
  const fruits = document.createElement("div");
  fruits.className = "tucano-help-fruits";
  Object.entries(currentTucanoView ? currentTucanoView.fruit_defs || {} : {}).forEach(([fruit, spec]) => {
    const row = document.createElement("p");
    row.textContent = `${tucanoFruitLabel(currentTucanoView, fruit)} — ${tucanoScoreEffect(spec)}`;
    fruits.appendChild(row);
  });
  reference.append(summary, fruits);
  tucanoHelpContent.appendChild(reference);
  exitTucanoExplainMode();
  openTucanoModal(tucanoHelpModal);
}

function openTucanoModal(modal) {
  tucanoModalTrigger = document.activeElement;
  setModalVisible(modal, true);
  const closeButton = modal.querySelector("button");
  if (closeButton) {
    closeButton.focus({ preventScroll: true });
  }
}

function closeTucanoModal(modal) {
  if (!modal || modal.classList.contains("hidden")) {
    return;
  }
  setModalVisible(modal, false);
  if (tucanoModalTrigger && tucanoModalTrigger.isConnected) {
    tucanoModalTrigger.focus({ preventScroll: true });
  }
  tucanoModalTrigger = null;
}

function exitTucanoExplainMode() {
  tucanoExplainMode = false;
  document.body.classList.remove("tucano-explain-mode");
  if (tucanoExplainBtn) {
    tucanoExplainBtn.classList.remove("active");
    tucanoExplainBtn.setAttribute("aria-pressed", "false");
  }
}

function showTucanoExplanation(element) {
  if (!tucanoExplainModal || !tucanoExplainContent) {
    return;
  }
  const explainId = element.dataset.explainId || element.id;
  const title = document.getElementById("tucanoExplainTitle");
  if (title) {
    title.textContent = element.dataset.explainTitle || "Tucano Explain";
  }
  const paragraph = document.createElement("p");
  paragraph.textContent = element.dataset.explainText || TUCANO_EXPLAIN[explainId] || "No explanation available.";
  tucanoExplainContent.replaceChildren(paragraph);
  openTucanoModal(tucanoExplainModal);
}

if (tucanoFlipBtn) {
  tucanoFlipBtn.classList.add("has-explanation");
  tucanoFlipBtn.dataset.explainId = "tucanoFlipBtn";
  tucanoFlipBtn.addEventListener("click", () => {
    if (isTucanoActionAvailable("resolve_toucan") && currentTucanoView.active_toucan === "flip") {
      sendAction({ type: "resolve_toucan" });
    }
  });
}

if (tucanoSkipBtn) {
  tucanoSkipBtn.classList.add("has-explanation");
  tucanoSkipBtn.dataset.explainId = "tucanoSkipBtn";
  tucanoSkipBtn.addEventListener("click", () => {
    if (isTucanoActionAvailable("skip_toucan")) {
      sendAction({ type: "skip_toucan" });
    }
  });
}

if (tucanoHelpBtn) {
  tucanoHelpBtn.addEventListener("click", showTucanoHelp);
}

if (tucanoHelpModalCloseBtn) {
  tucanoHelpModalCloseBtn.addEventListener("click", () => closeTucanoModal(tucanoHelpModal));
}

if (tucanoExplainBtn) {
  tucanoExplainBtn.addEventListener("click", () => {
    tucanoExplainMode = !tucanoExplainMode;
    document.body.classList.toggle("tucano-explain-mode", tucanoExplainMode);
    tucanoExplainBtn.classList.toggle("active", tucanoExplainMode);
    tucanoExplainBtn.setAttribute("aria-pressed", String(tucanoExplainMode));
  });
}

if (tucanoExplainModalCloseBtn) {
  tucanoExplainModalCloseBtn.addEventListener("click", () => closeTucanoModal(tucanoExplainModal));
}

[tucanoHelpModal, tucanoExplainModal].forEach((modal) => {
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeTucanoModal(modal);
      }
    });
  }
});

function isTucanoExplainControl(target) {
  return !!target.closest("#tucanoHelpBtn, #tucanoExplainBtn, .modal");
}

// Capture pointer events so disabled buttons can be inspected too. The following
// click is swallowed even after opening the explanation exits Explain mode.
document.addEventListener("pointerdown", (event) => {
  tucanoExplainClickPending = false;
  if (currentGameType !== "tucano" || !tucanoExplainMode || isTucanoExplainControl(event.target)) {
    return;
  }
  const explainable = document.elementsFromPoint(event.clientX, event.clientY)
    .map((element) => element.closest("#tucanoPanel .has-explanation"))
    .find(Boolean);
  if (!explainable && !event.target.closest("button, summary, a, input, select")) {
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  tucanoExplainClickPending = true;
  if (explainable) {
    showTucanoExplanation(explainable);
    exitTucanoExplainMode();
  }
}, true);

document.addEventListener("click", (event) => {
  if (currentGameType !== "tucano") {
    return;
  }
  if (tucanoExplainClickPending) {
    tucanoExplainClickPending = false;
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (!tucanoExplainMode || isTucanoExplainControl(event.target)) {
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  const explainable = event.target.closest("#tucanoPanel .has-explanation");
  if (explainable) {
    showTucanoExplanation(explainable);
    exitTucanoExplainMode();
  }
}, true);

document.addEventListener("click", (event) => {
  if (currentGameType !== "tucano" || tucanoExplainMode) {
    return;
  }
  if (!tucanoSelection) {
    return;
  }
  const insideTucano = event.target.closest("#tucanoPanel");
  const onSelectable = event.target.closest("button, summary, .modal");
  if (insideTucano && !onSelectable) {
    clearTucanoSelection();
    if (currentTucanoView) {
      renderTucanoPlayers(currentTucanoView);
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (currentGameType !== "tucano") {
    return;
  }
  const modal = [tucanoHelpModal, tucanoExplainModal].find((element) => element && !element.classList.contains("hidden"));
  if (modal && event.key === "Tab") {
    const controls = Array.from(modal.querySelectorAll("button, summary, a[href], [tabindex='0']"));
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  if (event.key !== "Escape") {
    return;
  }
  tucanoExplainClickPending = false;
  if (modal) {
    closeTucanoModal(modal);
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
