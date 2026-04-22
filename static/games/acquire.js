let currentAcquireView = null;
let acquireBuyQueue = [];
let acquireExplainMode = false;

const acquireHeaderActions = document.getElementById("acquireHeaderActions");
const acquirePanelEl = document.getElementById("acquirePanel");
const acquireTurnLabel = document.getElementById("acquireTurn");
const acquireStageLabel = document.getElementById("acquireStage");
const acquireLastTileLabel = document.getElementById("acquireLastTile");
const acquireWinnerLabel = document.getElementById("acquireWinner");
const acquireHelpBtn = document.getElementById("acquireHelpBtn");
const acquireExplainBtn = document.getElementById("acquireExplainBtn");
const acquireHelpModal = document.getElementById("acquireHelpModal");
const acquireHelpModalCloseBtn = document.getElementById("acquireHelpModalCloseBtn");
const acquireHelpContent = document.getElementById("acquireHelpContent");
const acquireExplainModal = document.getElementById("acquireExplainModal");
const acquireExplainModalCloseBtn = document.getElementById("acquireExplainModalCloseBtn");
const acquireExplainContent = document.getElementById("acquireExplainContent");
const acquireClearBuyBtn = document.getElementById("acquireClearBuyBtn");
const acquireSubmitBuyBtn = document.getElementById("acquireSubmitBuyBtn");
const acquireEndTurnBtn = document.getElementById("acquireEndTurnBtn");
const acquireEndGameBtn = document.getElementById("acquireEndGameBtn");
const acquirePending = document.getElementById("acquirePending");
const acquireBoard = document.getElementById("acquireBoard");
const acquireHand = document.getElementById("acquireHand");
const acquireBuyQueueLabel = document.getElementById("acquireBuyQueue");
const acquireActions = document.getElementById("acquireActions");
const acquireChains = document.getElementById("acquireChains");
const acquirePlayers = document.getElementById("acquirePlayers");

const ACQUIRE_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Finish with the most cash after all chain bonuses and stock sales are resolved.</p>

  <h3>Turn Flow</h3>
  <ul>
    <li><strong>Play 1 tile</strong>: place a tile from your hand onto the 12 x 9 board.</li>
    <li><strong>Resolve result</strong>: the tile may stay orphaned, found a chain, expand a chain, or trigger a merger.</li>
    <li><strong>Buy up to 3 shares</strong>: only active chains may be bought.</li>
    <li><strong>End turn</strong>: draw back to 6 tiles automatically. If an end condition is met, you may declare the end of the game.</li>
  </ul>

  <h3>Founding</h3>
  <p>If your tile touches only orphan tiles, choose any inactive chain. The founder gets 1 free share if the bank still has one.</p>

  <h3>Mergers</h3>
  <ul>
    <li>The largest chain survives. If survival is tied, the current player chooses.</li>
    <li>Defunct chains pay majority / minority bonuses before stock disposal.</li>
    <li>Each holder then resolves the defunct stock in order: <strong>sell</strong>, <strong>trade 2:1</strong>, or <strong>hold</strong>.</li>
  </ul>

  <h3>Dead Tiles</h3>
  <p>A tile that would connect two safe chains cannot be played.</p>

  <h3>End Game</h3>
  <p>You may end the game when a chain reaches size 41+, or every active chain is safe. All active chains then pay bonuses and all remaining shares are sold automatically.</p>
`;

const ACQUIRE_EXPLANATIONS = {
  board: {
    name: "Board",
    description: "Shows the full 12 x 9 grid. Empty cells keep their coordinate, orphan tiles are gray, and chain tiles are color-coded.",
  },
  hand: {
    name: "Your Hand",
    description: "Click a legal tile to play it. Dead tiles stay visible and are marked in red so you can understand why they cannot be placed.",
  },
  handTile: {
    name: "Playable Tile",
    description: "Play this tile onto the matching board coordinate. In explain mode even disabled tiles can be inspected without triggering a move.",
  },
  pending: {
    name: "Pending Resolution",
    description: "Shows founding prompts, merger tie-break choices, and stock disposal steps that must be resolved before the turn can continue.",
  },
  actionArea: {
    name: "Pending Actions",
    description: "Contains temporary actions created by the current state, such as choosing a new chain or resolving defunct shares in a merger.",
  },
  chooseChainBtn: {
    name: "Choose Chain",
    description: "Use this button to found a specific inactive chain, pick a surviving chain in a tie, or choose the next defunct chain in a multi-merge.",
  },
  disposeControls: {
    name: "Dispose Stock Controls",
    description: "Set how many defunct shares to sell, trade, or hold. The counts must add up to your current holding in that defunct chain.",
  },
  confirmDisposalBtn: {
    name: "Confirm Disposal",
    description: "Submit your sell / trade / hold decision for the current defunct chain.",
  },
  chains: {
    name: "Chains",
    description: "Each chain card shows whether the chain is active, its size, safety status, market price, and how many shares remain in the bank.",
  },
  chainCard: {
    name: "Chain Card",
    description: "Summarizes one hotel chain. Active chains can be bought during the buy step if the bank still has shares.",
  },
  queueBuyBtn: {
    name: "Queue Buy",
    description: "Add one share of this active chain to your buy queue. You may queue up to 3 shares total before confirming.",
  },
  buyQueue: {
    name: "Buy Queue",
    description: "Shows the shares you plan to buy this turn before you confirm the purchase.",
  },
  acquireClearBuyBtn: {
    name: "Clear Buys",
    description: "Clear the queued stock purchases for this turn.",
  },
  acquireSubmitBuyBtn: {
    name: "Confirm Buys",
    description: "Buy every share currently listed in the queue, up to 3 total, then advance to the end-turn step.",
  },
  acquireEndTurnBtn: {
    name: "End Turn",
    description: "Finish the current turn without ending the game.",
  },
  acquireEndGameBtn: {
    name: "End + Score",
    description: "Declare the end of the game when an end condition is met. All bonuses and remaining shares will be settled automatically.",
  },
  players: {
    name: "Players",
    description: "Shows each player's cash, starting tile, and public stock holdings. The active player is highlighted.",
  },
  playerCard: {
    name: "Player Summary",
    description: "Summarizes one player's current cash position and public stock portfolio.",
  },
};

const ACQUIRE_CHAIN_THEME = {
  worldwide: { bg: "#dbeafe", fg: "#1d4ed8" },
  sackson: { bg: "#dcfce7", fg: "#15803d" },
  festival: { bg: "#fef3c7", fg: "#b45309" },
  imperial: { bg: "#fee2e2", fg: "#b91c1c" },
  american: { bg: "#ede9fe", fg: "#6d28d9" },
  continental: { bg: "#e0f2fe", fg: "#0369a1" },
  tower: { bg: "#fce7f3", fg: "#be185d" },
};

function acquireChainName(chainId) {
  if (!currentAcquireView || !Array.isArray(currentAcquireView.chains)) {
    return chainId || "-";
  }
  const chain = currentAcquireView.chains.find((entry) => entry.chain_id === chainId);
  return chain ? chain.name : chainId || "-";
}

function acquirePlayerName(playerId) {
  if (!currentAcquireView || !Array.isArray(currentAcquireView.players)) {
    return playerId || "-";
  }
  const player = currentAcquireView.players.find((entry) => entry.player_id === playerId);
  return player ? player.name || playerId : playerId || "-";
}

function showAcquireHeaderActions(show) {
  if (acquireHeaderActions) {
    acquireHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitAcquireExplainMode();
    closeAcquireHelpModal();
    closeAcquireExplainModal();
  }
}

function showAcquireHelpModal() {
  if (!acquireHelpModal || !acquireHelpContent) {
    return;
  }
  acquireHelpContent.innerHTML = ACQUIRE_HELP_TEXT;
  setModalVisible(acquireHelpModal, true);
}

function closeAcquireHelpModal() {
  if (acquireHelpModal) {
    setModalVisible(acquireHelpModal, false);
  }
}

function showAcquireExplainModal(explainId) {
  const explanation = ACQUIRE_EXPLANATIONS[explainId];
  if (!explanation || !acquireExplainContent || !acquireExplainModal) {
    return;
  }
  acquireExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
  `;
  setModalVisible(acquireExplainModal, true);
}

function closeAcquireExplainModal() {
  if (acquireExplainModal) {
    setModalVisible(acquireExplainModal, false);
  }
}

function updateAcquireExplainClasses(enabled) {
  Object.keys(ACQUIRE_EXPLANATIONS).forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.classList.toggle("has-explanation", enabled);
    }
  });
  document.querySelectorAll("[data-acquire-explain]").forEach((node) => {
    node.classList.toggle("has-explanation", enabled);
  });
}

function toggleAcquireExplainMode() {
  acquireExplainMode = !acquireExplainMode;
  document.body.classList.toggle("acquire-explain-mode", acquireExplainMode);
  updateAcquireExplainClasses(acquireExplainMode);
  if (acquireExplainBtn) {
    acquireExplainBtn.classList.toggle("active", acquireExplainMode);
  }
}

function exitAcquireExplainMode() {
  if (!acquireExplainMode) {
    return;
  }
  acquireExplainMode = false;
  document.body.classList.remove("acquire-explain-mode");
  updateAcquireExplainClasses(false);
  if (acquireExplainBtn) {
    acquireExplainBtn.classList.remove("active");
  }
}

function findAcquireExplainTargetAtPoint(x, y) {
  for (const id of Object.keys(ACQUIRE_EXPLANATIONS)) {
    const direct = document.getElementById(id);
    if (direct) {
      const rect = direct.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return id;
      }
    }
  }
  const nodes = document.querySelectorAll("[data-acquire-explain]");
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return node.dataset.acquireExplain || null;
    }
  }
  return null;
}

function clearAcquireState() {
  currentAcquireView = null;
  acquireBuyQueue = [];
  exitAcquireExplainMode();
  closeAcquireHelpModal();
  closeAcquireExplainModal();
  if (acquireTurnLabel) acquireTurnLabel.textContent = "-";
  if (acquireStageLabel) acquireStageLabel.textContent = "-";
  if (acquireLastTileLabel) acquireLastTileLabel.textContent = "-";
  if (acquireWinnerLabel) acquireWinnerLabel.textContent = "-";
  if (acquirePending) acquirePending.textContent = "";
  if (acquireBoard) acquireBoard.innerHTML = "";
  if (acquireHand) acquireHand.innerHTML = "";
  if (acquireActions) acquireActions.innerHTML = "";
  if (acquireChains) acquireChains.innerHTML = "";
  if (acquirePlayers) acquirePlayers.innerHTML = "";
  if (acquireBuyQueueLabel) acquireBuyQueueLabel.textContent = "Queued buys: -";
}

function acquireCanAct() {
  return currentAcquireView && currentAcquireView.you === currentAcquireView.current_turn && !currentAcquireView.game_over;
}

function renderAcquireBuyQueue() {
  if (!acquireBuyQueueLabel) {
    return;
  }
  if (!acquireBuyQueue.length) {
    acquireBuyQueueLabel.textContent = "Queued buys: -";
    return;
  }
  acquireBuyQueueLabel.textContent = `Queued buys: ${acquireBuyQueue.map((chainId) => acquireChainName(chainId)).join(", ")}`;
}

function renderAcquireBoard(view) {
  if (!acquireBoard) {
    return;
  }
  acquireBoard.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "acquire-board-grid";
  const corner = document.createElement("div");
  corner.className = "acquire-board-corner";
  grid.appendChild(corner);
  for (let col = 1; col <= 12; col += 1) {
    const header = document.createElement("div");
    header.className = "acquire-board-header";
    header.textContent = String(col);
    grid.appendChild(header);
  }
  (view.board_rows || []).forEach((row, rowIndex) => {
    const rowLabel = document.createElement("div");
    rowLabel.className = "acquire-board-header";
    rowLabel.textContent = "ABCDEFGHI"[rowIndex];
    grid.appendChild(rowLabel);
    row.forEach((cell) => {
      const node = document.createElement("div");
      node.className = "acquire-cell";
      const owner = cell.owner;
      if (!owner) {
        node.classList.add("acquire-empty");
        node.textContent = cell.tile;
      } else if (owner === "orphan") {
        node.classList.add("acquire-orphan");
        node.textContent = cell.tile;
      } else {
        node.classList.add("acquire-chain-cell");
        node.dataset.chainId = owner;
        node.textContent = `${cell.tile}\n${acquireChainName(owner).slice(0, 3).toUpperCase()}`;
        const theme = ACQUIRE_CHAIN_THEME[owner];
        if (theme) {
          node.style.background = theme.bg;
          node.style.color = theme.fg;
        }
      }
      grid.appendChild(node);
    });
  });
  acquireBoard.appendChild(grid);
}

function renderAcquireHand(view) {
  if (!acquireHand) {
    return;
  }
  acquireHand.innerHTML = "";
  const me = (view.players || []).find((player) => player.player_id === view.you);
  (me && me.hand_status ? me.hand_status : []).forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "acquire-hand-tile";
    button.textContent = entry.tile;
    button.dataset.status = entry.status;
    button.dataset.acquireExplain = "handTile";
    if (entry.status !== "legal" || view.turn_stage !== "play_tile" || !acquireCanAct() || view.pending) {
      button.disabled = true;
    }
    if (entry.status === "dead") {
      button.title = "Dead tile";
    }
    button.addEventListener("click", () => {
      sendAction({ type: "play_tile", tile: entry.tile });
    });
    acquireHand.appendChild(button);
  });
}

function renderAcquireChains(view) {
  if (!acquireChains) {
    return;
  }
  acquireChains.innerHTML = "";
  (view.chains || []).forEach((chain) => {
    const card = document.createElement("div");
    card.className = "acquire-chain-card";
    card.dataset.acquireExplain = "chainCard";
    const title = document.createElement("div");
    title.className = "acquire-chain-title";
    title.textContent = chain.name;
    const meta = document.createElement("div");
    meta.className = "acquire-chain-meta";
    meta.textContent = chain.active
      ? `Tier ${chain.tier} · Size ${chain.size}${chain.safe ? " · Safe" : ""}`
      : `Tier ${chain.tier} · Inactive`;
    const bank = document.createElement("div");
    bank.className = "acquire-chain-meta";
    bank.textContent = `Share ${chain.price || "-"} · Bank ${chain.available_shares}`;
    const buyBtn = document.createElement("button");
    buyBtn.type = "button";
    buyBtn.dataset.acquireExplain = "queueBuyBtn";
    buyBtn.textContent = chain.active ? `Queue Buy (${chain.price})` : "Inactive";
    const canQueue =
      acquireCanAct() &&
      view.turn_stage === "buy" &&
      !view.pending &&
      chain.active &&
      chain.available_shares > 0 &&
      acquireBuyQueue.length < 3;
    buyBtn.disabled = !canQueue;
    buyBtn.addEventListener("click", () => {
      acquireBuyQueue.push(chain.chain_id);
      renderAcquireBuyQueue();
      updateAcquireButtons(view);
    });
    const theme = ACQUIRE_CHAIN_THEME[chain.chain_id];
    if (theme) {
      card.style.borderColor = theme.fg;
      title.style.color = theme.fg;
    }
    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(bank);
    card.appendChild(buyBtn);
    acquireChains.appendChild(card);
  });
}

function renderAcquirePlayers(view) {
  if (!acquirePlayers) {
    return;
  }
  acquirePlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "acquire-player-card";
    card.dataset.acquireExplain = "playerCard";
    if (player.player_id === view.current_turn) {
      card.classList.add("active");
    }
    const title = document.createElement("div");
    title.className = "acquire-player-title";
    title.textContent = `${player.name}${player.player_id === view.you ? " (You)" : ""}`;
    const money = document.createElement("div");
    money.className = "acquire-player-line";
    money.textContent = `💵 ${player.money} · Start ${player.start_tile || "-"}`;
    const stocks = document.createElement("div");
    stocks.className = "acquire-player-line";
    const stockParts = [];
    Object.entries(player.stocks || {}).forEach(([chainId, count]) => {
      if (count > 0) {
        stockParts.push(`${acquireChainName(chainId)} ${count}`);
      }
    });
    stocks.textContent = stockParts.length ? stockParts.join(" · ") : "No shares";
    card.appendChild(title);
    card.appendChild(money);
    card.appendChild(stocks);
    acquirePlayers.appendChild(card);
  });
}

function acquireBuildChoiceButtons(options, label) {
  const wrap = document.createElement("div");
  wrap.className = "acquire-choice-wrap";
  const title = document.createElement("div");
  title.className = "acquire-action-title";
  title.textContent = label;
  wrap.appendChild(title);
  options.forEach((chainId) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "acquire-choice-btn";
    button.dataset.acquireExplain = "chooseChainBtn";
    button.textContent = acquireChainName(chainId);
    button.addEventListener("click", () => sendAction({ type: "choose_chain", chain_id: chainId }));
    wrap.appendChild(button);
  });
  return wrap;
}

function acquireBuildDisposeControls(view, pending) {
  const wrap = document.createElement("div");
  wrap.className = "acquire-dispose-wrap";
  const playerId = pending.current_player;
  const me = (view.players || []).find((player) => player.player_id === view.you);
  const holdings = me && me.stocks ? me.stocks[pending.current_defunct] || 0 : 0;
  const tradeCap = Math.min(Math.floor(holdings / 2), (() => {
    const acquirer = (view.chains || []).find((chain) => chain.chain_id === pending.acquirer);
    return acquirer ? acquirer.available_shares : 0;
  })());
  const title = document.createElement("div");
  title.className = "acquire-action-title";
  title.textContent = `Dispose ${acquireChainName(pending.current_defunct)} shares`;
  wrap.appendChild(title);
  if (playerId !== view.you) {
    const waiting = document.createElement("div");
    waiting.className = "hint";
    waiting.textContent = `Waiting for ${acquirePlayerName(playerId)}.`;
    wrap.appendChild(waiting);
    return wrap;
  }
  const controls = document.createElement("div");
  controls.className = "acquire-dispose-controls";
  controls.dataset.acquireExplain = "disposeControls";
  const tradeLabel = document.createElement("label");
  tradeLabel.textContent = "Trade";
  const tradeInput = document.createElement("input");
  tradeInput.type = "number";
  tradeInput.min = "0";
  tradeInput.max = String(tradeCap);
  tradeInput.value = "0";
  const sellLabel = document.createElement("label");
  sellLabel.textContent = "Sell";
  const sellInput = document.createElement("input");
  sellInput.type = "number";
  sellInput.min = "0";
  sellInput.max = String(holdings);
  sellInput.value = String(holdings);
  const holdLabel = document.createElement("label");
  holdLabel.textContent = "Hold";
  const holdInput = document.createElement("input");
  holdInput.type = "number";
  holdInput.min = "0";
  holdInput.max = String(holdings);
  holdInput.value = "0";
  const sync = (changed) => {
    const trade = Math.max(0, Math.min(tradeCap, Number.parseInt(tradeInput.value || "0", 10) || 0));
    let sell = Math.max(0, Number.parseInt(sellInput.value || "0", 10) || 0);
    let hold = Math.max(0, Number.parseInt(holdInput.value || "0", 10) || 0);
    const remaining = holdings - trade * 2;
    if (changed === "sell") {
      hold = Math.max(0, remaining - sell);
    } else if (changed === "hold") {
      sell = Math.max(0, remaining - hold);
    } else {
      sell = remaining;
      hold = 0;
    }
    if (sell + hold > remaining) {
      hold = Math.max(0, remaining - sell);
    }
    tradeInput.value = String(trade);
    sellInput.value = String(Math.max(0, sell));
    holdInput.value = String(Math.max(0, hold));
  };
  tradeInput.addEventListener("input", () => sync("trade"));
  sellInput.addEventListener("input", () => sync("sell"));
  holdInput.addEventListener("input", () => sync("hold"));
  controls.appendChild(tradeLabel);
  controls.appendChild(tradeInput);
  controls.appendChild(sellLabel);
  controls.appendChild(sellInput);
  controls.appendChild(holdLabel);
  controls.appendChild(holdInput);
  const submit = document.createElement("button");
  submit.type = "button";
  submit.dataset.acquireExplain = "confirmDisposalBtn";
  submit.textContent = "Confirm Disposal";
  submit.addEventListener("click", () => {
    sendAction({
      type: "dispose_stock",
      trade: Number.parseInt(tradeInput.value || "0", 10) || 0,
      sell: Number.parseInt(sellInput.value || "0", 10) || 0,
      hold: Number.parseInt(holdInput.value || "0", 10) || 0,
    });
  });
  wrap.appendChild(controls);
  wrap.appendChild(submit);
  return wrap;
}

function renderAcquirePending(view) {
  if (!acquirePending || !acquireActions) {
    return;
  }
  const pending = view.pending;
  acquirePending.textContent = "";
  acquireActions.innerHTML = "";
  if (!pending) {
    acquirePending.textContent = view.turn_stage === "buy" ? "Buy up to 3 shares, then end your turn." : "";
    return;
  }
  if (pending.type === "founding") {
    acquirePending.textContent = "Choose which hotel chain to found.";
    acquireActions.appendChild(acquireBuildChoiceButtons(pending.options || [], "Founding Choice"));
    return;
  }
  if (pending.type === "merge") {
    const chainList = (pending.chains || []).map((chainId) => acquireChainName(chainId)).join(", ");
    acquirePending.textContent = `Merge triggered by ${pending.tile}: ${chainList}`;
    if (pending.choice === "acquirer") {
      acquireActions.appendChild(acquireBuildChoiceButtons(pending.options || [], "Choose Surviving Chain"));
      return;
    }
    if (pending.choice === "defunct") {
      acquireActions.appendChild(acquireBuildChoiceButtons(pending.options || [], "Choose Next Defunct Chain"));
      return;
    }
    if (pending.current_defunct) {
      acquireActions.appendChild(acquireBuildDisposeControls(view, pending));
    }
  }
}

function updateAcquireButtons(view) {
  if (acquireClearBuyBtn) {
    acquireClearBuyBtn.disabled = !acquireBuyQueue.length;
  }
  if (acquireSubmitBuyBtn) {
    acquireSubmitBuyBtn.disabled = !(acquireCanAct() && view.turn_stage === "buy");
  }
  if (acquireEndTurnBtn) {
    acquireEndTurnBtn.disabled = !(acquireCanAct() && view.turn_stage === "end_turn");
  }
  if (acquireEndGameBtn) {
    acquireEndGameBtn.disabled = !(acquireCanAct() && view.turn_stage === "end_turn" && view.can_end_game);
  }
  if (acquireExplainMode) {
    updateAcquireExplainClasses(true);
  }
}

function renderAcquireGameState(data) {
  const view = data && data.view ? data.view : null;
  currentAcquireView = view;
  if (!view) {
    clearAcquireState();
    return;
  }
  if (view.turn_stage !== "buy") {
    acquireBuyQueue = [];
  }
  if (acquireTurnLabel) acquireTurnLabel.textContent = acquirePlayerName(view.current_turn);
  if (acquireStageLabel) acquireStageLabel.textContent = view.turn_stage || "-";
  if (acquireLastTileLabel) acquireLastTileLabel.textContent = view.last_played_tile || "-";
  if (acquireWinnerLabel) {
    acquireWinnerLabel.textContent = (view.winner || []).map((playerId) => acquirePlayerName(playerId)).join(", ") || "-";
  }
  renderAcquireBoard(view);
  renderAcquireHand(view);
  renderAcquireChains(view);
  renderAcquirePlayers(view);
  renderAcquirePending(view);
  renderAcquireBuyQueue();
  updateAcquireButtons(view);
}

if (acquireHelpBtn) {
  acquireHelpBtn.addEventListener("click", showAcquireHelpModal);
}

if (acquireHelpModalCloseBtn) {
  acquireHelpModalCloseBtn.addEventListener("click", closeAcquireHelpModal);
}

if (acquireExplainBtn) {
  acquireExplainBtn.addEventListener("click", toggleAcquireExplainMode);
}

if (acquireExplainModalCloseBtn) {
  acquireExplainModalCloseBtn.addEventListener("click", closeAcquireExplainModal);
}

if (acquireHelpModal) {
  acquireHelpModal.addEventListener("click", (event) => {
    if (event.target === acquireHelpModal) {
      closeAcquireHelpModal();
    }
  });
}

if (acquireExplainModal) {
  acquireExplainModal.addEventListener("click", (event) => {
    if (event.target === acquireExplainModal) {
      closeAcquireExplainModal();
    }
  });
}

if (acquireClearBuyBtn) {
  acquireClearBuyBtn.addEventListener("click", () => {
    acquireBuyQueue = [];
    renderAcquireBuyQueue();
    if (currentAcquireView) {
      updateAcquireButtons(currentAcquireView);
    }
  });
}

if (acquireSubmitBuyBtn) {
  acquireSubmitBuyBtn.addEventListener("click", () => {
    if (!currentAcquireView || currentAcquireView.turn_stage !== "buy") {
      return;
    }
    sendAction({ type: "buy_stocks", chain_ids: acquireBuyQueue.slice(0, 3) });
  });
}

if (acquireEndTurnBtn) {
  acquireEndTurnBtn.addEventListener("click", () => {
    sendAction({ type: "end_turn", declare_end: false });
  });
}

if (acquireEndGameBtn) {
  acquireEndGameBtn.addEventListener("click", () => {
    sendAction({ type: "end_turn", declare_end: true });
  });
}

document.addEventListener("pointerdown", (event) => {
  if (!acquireExplainMode || currentGameType !== "acquire") {
    return;
  }
  const explainId = findAcquireExplainTargetAtPoint(event.clientX, event.clientY);
  if (explainId) {
    event.preventDefault();
    event.stopPropagation();
    showAcquireExplainModal(explainId);
    exitAcquireExplainMode();
    return;
  }
  const button = event.target.closest("button");
  if (button === acquireExplainBtn || button === acquireHelpBtn) {
    return;
  }
  if (button === acquireHelpModalCloseBtn || button === acquireExplainModalCloseBtn) {
    return;
  }
  if (button) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

document.addEventListener("click", (event) => {
  if (!acquireExplainMode || currentGameType !== "acquire") {
    return;
  }
  const button = event.target.closest("button");
  if (!button) {
    return;
  }
  if (button === acquireExplainBtn || button === acquireHelpBtn) {
    return;
  }
  if (button === acquireHelpModalCloseBtn || button === acquireExplainModalCloseBtn) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || currentGameType !== "acquire") {
    return;
  }
  if (acquireExplainMode) {
    exitAcquireExplainMode();
    return;
  }
  if (acquireHelpModal && !acquireHelpModal.classList.contains("hidden")) {
    closeAcquireHelpModal();
    return;
  }
  if (acquireExplainModal && !acquireExplainModal.classList.contains("hidden")) {
    closeAcquireExplainModal();
  }
});

window.clearAcquireState = clearAcquireState;
window.renderAcquireGameState = renderAcquireGameState;
window.showAcquireHeaderActions = showAcquireHeaderActions;
