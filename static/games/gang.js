let gangCountdownTimer = null;
let gangServerOffsetMs = 0;
let gangAutoLockSent = false;
let gangSelectedSpyTarget = null;
let gangLastLockAt = null;
let gangLastDeadline = null;

let currentGangView = null;

const gangHeaderActions = document.getElementById("gangHeaderActions");
const gangHelpBtn = document.getElementById("gangHelpBtn");
const gangExplainBtn = document.getElementById("gangExplainBtn");
const gangHelpModal = document.getElementById("gangHelpModal");
const gangHelpModalCloseBtn = document.getElementById("gangHelpModalCloseBtn");
const gangExplainModal = document.getElementById("gangExplainModal");
const gangExplainModalCloseBtn = document.getElementById("gangExplainModalCloseBtn");
const gangHelpContent = document.getElementById("gangHelpContent");
const gangExplainContent = document.getElementById("gangExplainContent");

const gangConfigBox = document.getElementById("gangConfigBox");
const gangModeSelect = document.getElementById("gangModeSelect");
const gangTimeSelect = document.getElementById("gangTimeSelect");
const gangPanel = document.getElementById("theGangPanel");
const gangPhaseLabel = document.getElementById("gangPhase");
const gangLevelLabel = document.getElementById("gangLevel");
const gangLivesLabel = document.getElementById("gangLives");
const gangTokensLabel = document.getElementById("gangTokens");
const gangModeLabel = document.getElementById("gangMode");
const gangMissionLabel = document.getElementById("gangMission");
const gangTimerLabel = document.getElementById("gangTimer");
const gangLockLabel = document.getElementById("gangLockTimer");
const gangCommunity = document.getElementById("gangCommunity");
const gangRanking = document.getElementById("gangRanking");
const gangRevealBtn = document.getElementById("gangRevealBtn");
const gangReadyBtn = document.getElementById("gangReadyBtn");
const gangLockBtn = document.getElementById("gangLockBtn");
const gangMulliganBtn = document.getElementById("gangMulliganBtn");
const gangSpyTargetSelect = document.getElementById("gangSpyTargetSelect");
const gangSpyBtn = document.getElementById("gangSpyBtn");
const gangNextRoundBtn = document.getElementById("gangNextRoundBtn");
const gangPlayAgainBtn = document.getElementById("gangPlayAgainBtn");
const gangRoundSummary = document.getElementById("gangRoundSummary");
const gangRoundSummaryTitle = document.getElementById("gangRoundSummaryTitle");
const gangRoundSummaryBody = document.getElementById("gangRoundSummaryBody");
const gangRoundSummaryList = document.getElementById("gangRoundSummaryList");
const gangPlayers = document.getElementById("gangPlayers");

const GANG_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Work together to order all players from strongest to weakest poker hand using only the public cards and your own hole cards. Clear levels before the team runs out of lives.</p>

  <h3>Round Flow</h3>
  <ol>
    <li><strong>Preflop</strong>: everyone receives 2 hole cards. You may spend 1 token on <em>Mulligan</em> to redeal all hole cards.</li>
    <li><strong>Flop / Turn / River</strong>: everyone clicks Reveal Next to advance (3, then 1, then 1). After each reveal, adjust the ranking track.</li>
    <li><strong>Ready & Lock</strong>: on the river, each player clicks Ready. When all are ready, a short countdown starts and the order locks (a round timer can also auto-lock).</li>
    <li><strong>Showdown</strong>: all hole cards are revealed and the prediction is checked.</li>
  </ol>

  <h3>Lives, Tokens, Missions</h3>
  <ul>
    <li><strong>Lives</strong> are shared. A failed round costs 1 life and you replay the level; every 5 levels restores 1 life (up to the max).</li>
    <li><strong>Tokens</strong> power <em>Mulligan</em> (preflop redeal) and <em>Spy</em> (reveal a random hole card). A perfect clear may award a token.</li>
    <li><strong>Expert Mode</strong> adds a mission requirement shown under Mission.</li>
  </ul>

  <h3>Modes</h3>
  <ul>
    <li><strong>Novice</strong>: small placement errors are tolerated and your win odds are shown.</li>
    <li><strong>Normal</strong>: exact order required (tied hands can be in any order).</li>
    <li><strong>Expert</strong>: no hand hints, plus missions.</li>
  </ul>

  <h3>UI Tips</h3>
  <ul>
    <li>Ranking Track slots run from 1st (best) to last (worst). Use the dropdowns to assign players.</li>
    <li>Your hand hint and highlighted best cards appear only outside Expert mode.</li>
  </ul>
`;

const GANG_BUTTON_EXPLANATIONS = {
  gangRevealBtn: {
    name: "Reveal Next",
    description: "Mark yourself ready to reveal. When all players click, the next community card(s) are revealed: flop (3), turn (1), river (1).",
  },
  gangReadyBtn: {
    name: "Ready / Cancel Ready",
    description: "Toggle your ready state. When all players are ready, a short countdown starts to lock in.",
  },
  gangMulliganBtn: {
    name: "Mulligan",
    description: "Spend 1 token to redeal all players' hole cards (preflop only).",
  },
  gangSpyTargetSelect: {
    name: "Spy Target",
    description: "Choose which player to reveal a random hole card from.",
  },
  gangSpyBtn: {
    name: "Spy",
    description: "Spend 1 token to reveal one random hole card from the selected player (public).",
  },
  gangRankingSlot: {
    name: "Ranking Track",
    description: "Assign each player to a position from strongest to weakest using the dropdowns.",
  },
  gangNextRoundBtn: {
    name: "Next Round",
    description: "Mark yourself ready for the next level. When everyone is ready, the next round starts.",
  },
  gangPlayAgainBtn: {
    name: "Play Again",
    description: "Restart the game after game over.",
  },
};

function updateGangConfigRow() {
  const showRow = currentRoomState && currentGameType === "the_gang" && currentRoomState.status === "lobby";
  if (gangConfigBox) {
    gangConfigBox.classList.toggle("hidden", !showRow);
    gangConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function clearGangState() {
  currentGangView = null;
  gangAutoLockSent = false;
  gangSelectedSpyTarget = null;
  gangLastLockAt = null;
  gangLastDeadline = null;
  if (gangCountdownTimer) {
    clearInterval(gangCountdownTimer);
    gangCountdownTimer = null;
  }
  if (gangPhaseLabel) {
    gangPhaseLabel.textContent = "-";
  }
  if (gangLevelLabel) {
    gangLevelLabel.textContent = "-";
  }
  if (gangLivesLabel) {
    gangLivesLabel.textContent = "-";
  }
  if (gangTokensLabel) {
    gangTokensLabel.textContent = "-";
  }
  if (gangModeLabel) {
    gangModeLabel.textContent = "-";
  }
  if (gangMissionLabel) {
    gangMissionLabel.textContent = "-";
  }
  if (gangTimerLabel) {
    gangTimerLabel.textContent = "-";
  }
  if (gangLockLabel) {
    gangLockLabel.textContent = "-";
  }
  if (gangCommunity) {
    gangCommunity.innerHTML = "";
  }
  if (gangRanking) {
    gangRanking.innerHTML = "";
  }
  if (gangPlayers) {
    gangPlayers.innerHTML = "";
  }
  if (gangSpyTargetSelect) {
    gangSpyTargetSelect.innerHTML = "";
  }
  if (gangRoundSummary) {
    gangRoundSummary.classList.add("hidden");
  }
  if (gangRoundSummaryBody) {
    gangRoundSummaryBody.textContent = "-";
  }
  if (gangRoundSummaryList) {
    gangRoundSummaryList.innerHTML = "";
  }
  updateGangActionButtons();
}

function formatGangCard(card) {
  if (!card || card.hidden) {
    return "??";
  }
  const rank = card.rank;
  const rankLabel = rank === 14 ? "A" : rank === 13 ? "K" : rank === 12 ? "Q" : rank === 11 ? "J" : String(rank);
  const suitMap = {
    S: "♠️",
    H: "♥️",
    D: "♦️",
    C: "♣️",
  };
  const rawSuit = typeof card.suit === "string" ? card.suit.trim() : "";
  const suitKey = rawSuit.toUpperCase();
  const suitEmoji = suitMap[suitKey];
  const suitLabel = suitEmoji || (rawSuit && !/^[SHDC]$/i.test(rawSuit) ? rawSuit : "?");
  return `${rankLabel}${suitLabel}`;
}

function createGangCardElement(card) {
  const div = document.createElement("div");
  div.className = "gang-card";
  if (card && card.hidden) {
    div.classList.add("hidden");
  }
  div.textContent = formatGangCard(card);
  return div;
}

function renderGangCommunity(view) {
  if (!gangCommunity) {
    return;
  }
  gangCommunity.innerHTML = "";
  const cards = Array.isArray(view.community_cards) ? view.community_cards : [];
  const youEntry = Array.isArray(view.players) ? view.players.find((p) => p.player_id === view.you) : null;
  const highlight = new Set();
  if (youEntry && youEntry.hand_hint && Array.isArray(youEntry.hand_hint.best_cards)) {
    youEntry.hand_hint.best_cards.forEach((card) => {
      if (card && card.rank && card.suit) {
        highlight.add(`${card.rank}-${card.suit}`);
      }
    });
  }
  if (!cards.length) {
    gangCommunity.textContent = "-";
    return;
  }
  cards.forEach((card) => {
    const cardEl = createGangCardElement(card);
    if (card && highlight.has(`${card.rank}-${card.suit}`)) {
      cardEl.classList.add("highlight");
    }
    gangCommunity.appendChild(cardEl);
  });
}

function renderGangRanking(view) {
  if (!gangRanking) {
    return;
  }
  gangRanking.innerHTML = "";
  const ranking = Array.isArray(view.ranking) ? view.ranking : [];
  const players = Array.isArray(view.players) ? view.players : [];
  const nameMap = new Map(players.map((p) => [p.player_id, p.name || p.player_id]));
  const readyMap = new Map(players.map((p) => [p.player_id, !!p.ready]));
  const canMove = Array.isArray(view.legal_actions) && view.legal_actions.includes("move_rank");

  ranking.forEach((pid, index) => {
    const row = document.createElement("div");
    row.className = "gang-slot";
    const label = document.createElement("div");
    label.className = "gang-slot-label";
    label.textContent = `${index + 1}.`;
    row.appendChild(label);

    const select = document.createElement("select");
    players.forEach((player) => {
      const option = document.createElement("option");
      option.value = player.player_id;
      option.textContent = nameMap.get(player.player_id) || player.player_id;
      select.appendChild(option);
    });
    if (pid) {
      select.value = pid;
    }
    const occupantReady = readyMap.get(pid);
    select.disabled = !canMove || (occupantReady && pid !== view.you);
    select.addEventListener("change", () => {
      sendAction({ type: "move_rank", player_id: select.value, to_index: index });
    });
    row.appendChild(select);

    if (occupantReady) {
      const badge = document.createElement("span");
      badge.className = "gang-badge";
      badge.textContent = "Ready";
      row.appendChild(badge);
    }
    gangRanking.appendChild(row);
  });
  if (gangExplainMode) {
    updateGangExplainModeClasses(true);
  }
}

function renderGangSpyTargets(view) {
  if (!gangSpyTargetSelect) {
    return;
  }
  const players = Array.isArray(view.players)
    ? view.players.filter((p) => p.player_id !== view.you)
    : [];
  gangSpyTargetSelect.innerHTML = "";
  if (!players.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No targets";
    gangSpyTargetSelect.appendChild(option);
    gangSpyTargetSelect.disabled = true;
    gangSelectedSpyTarget = null;
    return;
  }
  gangSpyTargetSelect.disabled = false;
  players.forEach((player) => {
    const option = document.createElement("option");
    option.value = player.player_id;
    option.textContent = player.name || player.player_id;
    gangSpyTargetSelect.appendChild(option);
  });
  if (gangSelectedSpyTarget && players.some((p) => p.player_id === gangSelectedSpyTarget)) {
    gangSpyTargetSelect.value = gangSelectedSpyTarget;
  } else {
    gangSelectedSpyTarget = players[0].player_id;
    gangSpyTargetSelect.value = gangSelectedSpyTarget;
  }
}

function renderGangPlayers(view) {
  if (!gangPlayers) {
    return;
  }
  gangPlayers.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  if (!players.length) {
    gangPlayers.textContent = "-";
    return;
  }
  const phase = view.phase;
  players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "gang-player-card";
    const showRevealReady = phase === "preflop" || phase === "flop" || phase === "turn";
    const showNextReady = phase === "showdown";
    const readyState = showRevealReady
      ? !!player.reveal_ready
      : showNextReady
        ? !!player.next_ready
        : !!player.ready;
    if (readyState) {
      card.classList.add("ready");
    }
    if (player.player_id === view.you) {
      card.classList.add("you");
    }

    const header = document.createElement("div");
    header.textContent = player.name || player.player_id;
    card.appendChild(header);

    const status = document.createElement("div");
    status.className = "gang-badge";
    if (showRevealReady) {
      status.textContent = readyState ? "Reveal Ready" : "Not Ready";
    } else if (showNextReady) {
      status.textContent = readyState ? "Next Ready" : "Not Ready";
    } else {
      status.textContent = readyState ? "Ready" : "Not Ready";
    }
    card.appendChild(status);

    const handRow = document.createElement("div");
    handRow.className = "gang-player-hand";
    const handCards = Array.isArray(player.hand) ? player.hand : [];
    handCards.forEach((slot) => {
      handRow.appendChild(createGangCardElement(slot));
    });
    card.appendChild(handRow);

    if (player.hand_hint) {
      const hint = document.createElement("div");
      hint.className = "gang-badge";
      hint.textContent = `Hint: ${player.hand_hint.hand_name}`;
      card.appendChild(hint);
    }
    if (Number.isFinite(player.hand_odds)) {
      const odds = document.createElement("div");
      odds.className = "gang-badge";
      odds.textContent = `Win Odds: ${Math.round(player.hand_odds * 100)}%`;
      card.appendChild(odds);
    }

    gangPlayers.appendChild(card);
  });
}

function renderGangSummary(view) {
  if (!gangRoundSummary || !gangRoundSummaryBody || !gangRoundSummaryList) {
    return;
  }
  const summary = view.round_summary;
  if (!summary) {
    gangRoundSummary.classList.add("hidden");
    gangRoundSummaryBody.textContent = "-";
    gangRoundSummaryList.innerHTML = "";
    return;
  }
  gangRoundSummary.classList.remove("hidden");
  const parts = [];
  parts.push(summary.success ? "Success" : "Failure");
  if (summary.perfect) {
    parts.push("Perfect Clear");
  }
  if (view.mission) {
    parts.push(summary.mission_success ? "Mission OK" : "Mission Failed");
  }
  gangRoundSummaryBody.textContent = parts.join(" | ");
  gangRoundSummaryList.innerHTML = "";

  const actualGroups = Array.isArray(summary.actual_groups) ? summary.actual_groups : [];
  const predicted = Array.isArray(summary.predicted_order) ? summary.predicted_order : [];
  if (actualGroups.length) {
    const actualLine = document.createElement("div");
    actualLine.textContent = `Actual: ${actualGroups
      .map((group) => group.map((pid) => findPlayerName(view, pid)).join(" = "))
      .join(" > ")}`;
    gangRoundSummaryList.appendChild(actualLine);
  }
  if (predicted.length) {
    const predictedLine = document.createElement("div");
    predictedLine.textContent = `Predicted: ${predicted.map((pid) => findPlayerName(view, pid)).join(" > ")}`;
    gangRoundSummaryList.appendChild(predictedLine);
  }

  const hands = Array.isArray(summary.hands) ? summary.hands : [];
  hands.forEach((entry) => {
    const line = document.createElement("div");
    const cards = Array.isArray(entry.best_cards) ? entry.best_cards.map((c) => formatGangCard(c)).join(" ") : "-";
    line.textContent = `${findPlayerName(view, entry.player_id)}: ${entry.hand_name} (${cards})`;
    gangRoundSummaryList.appendChild(line);
  });
}

function updateGangTimers(view) {
  if (gangCountdownTimer) {
    clearInterval(gangCountdownTimer);
    gangCountdownTimer = null;
  }
  if (!gangTimerLabel || !gangLockLabel) {
    return;
  }
  if (!view || view.phase !== "river") {
    gangTimerLabel.textContent = "-";
    gangLockLabel.textContent = "-";
    gangAutoLockSent = false;
    return;
  }

  const lockAt = Number.isFinite(view.lock_at_ms) ? view.lock_at_ms : null;
  const deadline = Number.isFinite(view.river_deadline_ms) ? view.river_deadline_ms : null;
  if (!lockAt && !deadline) {
    gangTimerLabel.textContent = "-";
    gangLockLabel.textContent = "-";
    gangAutoLockSent = false;
    return;
  }
  if (lockAt !== gangLastLockAt || deadline !== gangLastDeadline) {
    gangAutoLockSent = false;
    gangLastLockAt = lockAt;
    gangLastDeadline = deadline;
  }
  const serverNow = Number.isFinite(view.server_time_ms) ? view.server_time_ms : Date.now();
  gangServerOffsetMs = serverNow - Date.now();

  const update = () => {
    const now = Date.now() + gangServerOffsetMs;
    if (lockAt) {
      const remaining = Math.max(0, lockAt - now);
      gangLockLabel.textContent = `${Math.ceil(remaining / 1000)}s`;
    } else {
      gangLockLabel.textContent = "-";
    }
    if (deadline) {
      const remaining = Math.max(0, deadline - now);
      gangTimerLabel.textContent = `${Math.ceil(remaining / 1000)}s`;
    } else {
      gangTimerLabel.textContent = "-";
    }
    if (!gangAutoLockSent) {
      if ((lockAt && now >= lockAt) || (deadline && now >= deadline)) {
        gangAutoLockSent = true;
        sendAction({ type: "lock_in" });
      }
    }
  };
  update();
  gangCountdownTimer = setInterval(update, 250);
}

function updateGangActionButtons(view) {
  const actions = view && Array.isArray(view.legal_actions) ? view.legal_actions : [];
  const players = view && Array.isArray(view.players) ? view.players : [];
  const youEntry = view ? players.find((p) => p.player_id === view.you) : null;
  if (gangRevealBtn) {
    const allowed = actions.includes("reveal_next");
    const alreadyReady = !!(youEntry && youEntry.reveal_ready);
    gangRevealBtn.disabled = !allowed || alreadyReady;
    gangRevealBtn.classList.toggle("action-allowed", allowed);
    if (allowed && youEntry) {
      gangRevealBtn.textContent = alreadyReady ? "Reveal Ready" : "Reveal Next";
    } else {
      gangRevealBtn.textContent = "Reveal Next";
    }
  }
  if (gangReadyBtn) {
    const allowed = actions.includes("toggle_ready");
    gangReadyBtn.disabled = !allowed;
    gangReadyBtn.classList.toggle("action-allowed", allowed);
  }
  if (gangLockBtn) {
    const allowed = actions.includes("lock_in");
    gangLockBtn.disabled = !allowed;
    gangLockBtn.classList.toggle("action-allowed", allowed);
  }
  if (gangMulliganBtn) {
    const allowed = actions.includes("mulligan");
    gangMulliganBtn.disabled = !allowed;
    gangMulliganBtn.classList.toggle("action-allowed", allowed);
  }
  if (gangSpyBtn) {
    const allowed = actions.includes("spy");
    gangSpyBtn.disabled = !allowed;
    gangSpyBtn.classList.toggle("action-allowed", allowed);
  }
  if (gangSpyTargetSelect) {
    const allowed = actions.includes("spy");
    gangSpyTargetSelect.disabled = gangSpyTargetSelect.disabled || !allowed;
  }
  if (gangNextRoundBtn) {
    const allowed = actions.includes("next_round");
    const alreadyReady = !!(youEntry && youEntry.next_ready);
    gangNextRoundBtn.disabled = !allowed || alreadyReady;
    gangNextRoundBtn.classList.toggle("action-allowed", allowed);
    if (allowed && youEntry) {
      gangNextRoundBtn.textContent = alreadyReady ? "Next Ready" : "Next Round";
    } else {
      gangNextRoundBtn.textContent = "Next Round";
    }
  }
  if (gangPlayAgainBtn) {
    const allowed = actions.includes("play_again");
    gangPlayAgainBtn.disabled = !allowed;
    gangPlayAgainBtn.classList.toggle("action-allowed", allowed);
  }
}

function renderGangGameState(data) {
  const view = data.view;
  currentGangView = view;
  if (currentGameType !== "the_gang") {
    currentGameType = "the_gang";
    setGamePanelVisibility("the_gang");
  }

  if (gangPhaseLabel) {
    gangPhaseLabel.textContent = view.phase || "-";
  }
  if (gangLevelLabel) {
    gangLevelLabel.textContent = view.level ?? "-";
  }
  if (gangLivesLabel) {
    gangLivesLabel.textContent = `${view.lives ?? "-"} / ${view.max_lives ?? "-"}`;
  }
  if (gangTokensLabel) {
    gangTokensLabel.textContent = view.tokens ?? "-";
  }
  if (gangModeLabel) {
    gangModeLabel.textContent = view.mode || "-";
  }
  if (gangMissionLabel) {
    gangMissionLabel.textContent = view.mission ? view.mission.desc || view.mission.id : "-";
  }

  const youEntry = Array.isArray(view.players) ? view.players.find((p) => p.player_id === view.you) : null;
  if (gangReadyBtn) {
    gangReadyBtn.textContent = youEntry && youEntry.ready ? "Cancel Ready" : "Ready";
  }

  renderGangCommunity(view);
  renderGangRanking(view);
  renderGangSpyTargets(view);
  renderGangPlayers(view);
  renderGangSummary(view);
  updateGangTimers(view);
  logGameEvents(data);
  updateGangActionButtons(view);
}

let gangExplainMode = false;

function showGangHeaderActions(show) {
  if (gangHeaderActions) {
    gangHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitGangExplainMode();
    closeGangHelpModal();
    closeGangExplainModal();
  }
}

function showGangHelpModal() {
  if (!gangHelpModal) {
    return;
  }
  if (gangHelpContent) {
    gangHelpContent.innerHTML = GANG_HELP_TEXT;
  }
  setModalVisible(gangHelpModal, true);
}

function closeGangHelpModal() {
  if (gangHelpModal) {
    setModalVisible(gangHelpModal, false);
  }
}

function updateGangExplainModeClasses(enabled) {
  Object.keys(GANG_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    if (buttonId === "gangRankingSlot") {
      return;
    }
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
  document.querySelectorAll("#gangRanking select").forEach((select) => {
    select.classList.toggle("has-explanation", enabled);
  });
}

function findGangButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(GANG_BUTTON_EXPLANATIONS)) {
    if (buttonId === "gangRankingSlot") {
      continue;
    }
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  const rankSelects = Array.from(document.querySelectorAll("#gangRanking select"));
  for (const select of rankSelects) {
    const rect = select.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return "gangRankingSlot";
    }
  }
  return null;
}

function toggleGangExplainMode() {
  gangExplainMode = !gangExplainMode;
  document.body.classList.toggle("gang-explain-mode", gangExplainMode);
  updateGangExplainModeClasses(gangExplainMode);
  if (gangExplainBtn) {
    gangExplainBtn.classList.toggle("active", gangExplainMode);
  }
}

function exitGangExplainMode() {
  if (!gangExplainMode) {
    return;
  }
  gangExplainMode = false;
  document.body.classList.remove("gang-explain-mode");
  updateGangExplainModeClasses(false);
  if (gangExplainBtn) {
    gangExplainBtn.classList.remove("active");
  }
}

function showGangButtonExplanation(buttonId) {
  const explanation = GANG_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !gangExplainContent || !gangExplainModal) {
    return;
  }
  const note = explanation.note ? `<div class="hint">${explanation.note}</div>` : "";
  gangExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    ${note}
  `;
  setModalVisible(gangExplainModal, true);
}

function closeGangExplainModal() {
  if (gangExplainModal) {
    setModalVisible(gangExplainModal, false);
  }
}

if (gangHelpBtn) {
  gangHelpBtn.addEventListener("click", () => {
    showGangHelpModal();
  });
}

if (gangHelpModalCloseBtn) {
  gangHelpModalCloseBtn.addEventListener("click", closeGangHelpModal);
}

if (gangExplainBtn) {
  gangExplainBtn.addEventListener("click", () => {
    toggleGangExplainMode();
  });
}

if (gangExplainModalCloseBtn) {
  gangExplainModalCloseBtn.addEventListener("click", closeGangExplainModal);
}

document.addEventListener(
  "pointerdown",
  (e) => {
    if (!gangExplainMode) return;

    const buttonId = findGangButtonAtPoint(e.clientX, e.clientY);
    if (buttonId) {
      e.preventDefault();
      e.stopPropagation();
      showGangButtonExplanation(buttonId);
      exitGangExplainMode();
      return;
    }

    const button = e.target.closest("button");
    if (button === gangExplainBtn || button === gangHelpBtn) return;
    if (button === gangHelpModalCloseBtn || button === gangExplainModalCloseBtn) return;

    if (button) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  true
);

document.addEventListener(
  "click",
  (e) => {
    if (!gangExplainMode) return;

    const button = e.target.closest("button");
    if (!button) return;

    if (button === gangExplainBtn || button === gangHelpBtn) return;
    if (button === gangHelpModalCloseBtn || button === gangExplainModalCloseBtn) return;

    e.preventDefault();
    e.stopPropagation();
  },
  true
);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && gangExplainMode) {
    exitGangExplainMode();
  }
});

if (gangRevealBtn) {
  gangRevealBtn.addEventListener("click", () => {
    sendAction({ type: "reveal_next" });
  });
}

if (gangReadyBtn) {
  gangReadyBtn.addEventListener("click", () => {
    sendAction({ type: "toggle_ready" });
  });
}

if (gangLockBtn) {
  gangLockBtn.addEventListener("click", () => {
    sendAction({ type: "lock_in" });
  });
}

if (gangMulliganBtn) {
  gangMulliganBtn.addEventListener("click", () => {
    sendAction({ type: "mulligan" });
  });
}

if (gangSpyTargetSelect) {
  gangSpyTargetSelect.addEventListener("change", () => {
    gangSelectedSpyTarget = gangSpyTargetSelect.value || null;
  });
}

if (gangSpyBtn) {
  gangSpyBtn.addEventListener("click", () => {
    if (!gangSelectedSpyTarget) {
      log("Select a spy target");
      return;
    }
    sendAction({ type: "spy", target_player_id: gangSelectedSpyTarget });
  });
}

if (gangNextRoundBtn) {
  gangNextRoundBtn.addEventListener("click", () => {
    sendAction({ type: "next_round" });
  });
}

if (gangPlayAgainBtn) {
  gangPlayAgainBtn.addEventListener("click", () => {
    sendAction({ type: "play_again" });
  });
}
