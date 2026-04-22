let currentAcquireView = null;
let acquireBuyQueue = [];

const acquirePanelEl = document.getElementById("acquirePanel");
const acquireTurnLabel = document.getElementById("acquireTurn");
const acquireStageLabel = document.getElementById("acquireStage");
const acquireLastTileLabel = document.getElementById("acquireLastTile");
const acquireWinnerLabel = document.getElementById("acquireWinner");
const acquireHelpBtn = document.getElementById("acquireHelpBtn");
const acquireExplainBtn = document.getElementById("acquireExplainBtn");
const acquireClearBuyBtn = document.getElementById("acquireClearBuyBtn");
const acquireSubmitBuyBtn = document.getElementById("acquireSubmitBuyBtn");
const acquireEndTurnBtn = document.getElementById("acquireEndTurnBtn");
const acquireEndGameBtn = document.getElementById("acquireEndGameBtn");
const acquireHelpBox = document.getElementById("acquireHelpBox");
const acquireExplainBox = document.getElementById("acquireExplainBox");
const acquirePending = document.getElementById("acquirePending");
const acquireBoard = document.getElementById("acquireBoard");
const acquireHand = document.getElementById("acquireHand");
const acquireBuyQueueLabel = document.getElementById("acquireBuyQueue");
const acquireActions = document.getElementById("acquireActions");
const acquireChains = document.getElementById("acquireChains");
const acquirePlayers = document.getElementById("acquirePlayers");

const ACQUIRE_HELP_TEXT = `
  <strong>Goal</strong>: finish with the most money.
  <br />
  <strong>Turn</strong>: play 1 tile, resolve founding / merger if needed, buy up to 3 shares, then decide whether to end the game.
  <br />
  <strong>Founding</strong>: when your tile touches only orphan tiles, choose an inactive chain and take 1 free share if available.
  <br />
  <strong>Merge</strong>: the biggest chain survives. If tied, the current player chooses. Resolve bonuses, then each holder of the defunct chain chooses sell / trade / hold.
  <br />
  <strong>Dead Tile</strong>: a tile that would connect two safe chains cannot be played.
`;

const ACQUIRE_EXPLAIN_TEXT = `
  <strong>Board</strong>: empty spaces show coordinates; colored spaces show placed tiles and their chain.
  <br />
  <strong>Your Hand</strong>: click a legal tile to play it. Dead tiles are marked in red.
  <br />
  <strong>Chains</strong>: each card shows size, safety, price, and remaining bank shares.
  <br />
  <strong>Players</strong>: cash and public stock holdings.
  <br />
  <strong>Pending</strong>: merger tie-breaks, founding choices, and stock disposal all appear here.
`;

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

function clearAcquireState() {
  currentAcquireView = null;
  acquireBuyQueue = [];
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
  if (acquireHelpBox) {
    acquireHelpBox.classList.add("hidden");
    acquireHelpBox.innerHTML = ACQUIRE_HELP_TEXT;
  }
  if (acquireExplainBox) {
    acquireExplainBox.classList.add("hidden");
    acquireExplainBox.innerHTML = ACQUIRE_EXPLAIN_TEXT;
  }
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

if (acquireHelpBtn && acquireHelpBox) {
  acquireHelpBox.innerHTML = ACQUIRE_HELP_TEXT;
  acquireHelpBtn.addEventListener("click", () => {
    acquireHelpBox.classList.toggle("hidden");
  });
}

if (acquireExplainBtn && acquireExplainBox) {
  acquireExplainBox.innerHTML = ACQUIRE_EXPLAIN_TEXT;
  acquireExplainBtn.addEventListener("click", () => {
    acquireExplainBox.classList.toggle("hidden");
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
