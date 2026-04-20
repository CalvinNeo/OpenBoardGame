let currentGuandanView = null;
let guandanSelected = [];
let guandanExplainMode = false;
let guandanPiles = [];
let guandanLastSfKey = null;
let guandanHandLayout = "cascade";
let guandanCascadeLayoutFrame = null;
let guandanBotExplainPlayerId = null;
let guandanBotExplainHistoryIndex = -1;
let guandanBotProgressStatus = null;
let guandanBotProgressTimer = null;
const GUANDAN_DEFAULT_BOT_MODE = "auto";
const GUANDAN_DEFAULT_NN_CHECKPOINT = "assets/guandan/checkpoints/guandan_nn.pt";

const guandanConfigBox = document.getElementById("guandanConfigBox");
const guandanBotModeRow = document.getElementById("guandanBotModeRow");
const guandanBotModeSelect = document.getElementById("guandanBotModeSelect");
const guandanNnCheckpointRow = document.getElementById("guandanNnCheckpointRow");
const guandanNnCheckpointSelect = document.getElementById("guandanNnCheckpointSelect");
let guandanCheckpointOptions = [];
let guandanCheckpointOptionsLoaded = false;
let guandanCheckpointOptionsLoading = false;
let guandanCheckpointOptionsFailed = false;

const guandanPhaseLabel = document.getElementById("guandanPhase");
const guandanRoundLabel = document.getElementById("guandanRound");
const guandanTurnLabel = document.getElementById("guandanTurn");
const guandanDealerLabel = document.getElementById("guandanDealer");
const guandanLevelLabel = document.getElementById("guandanLevel");
const guandanTrickLabel = document.getElementById("guandanTrick");
const guandanTrickPlaysLabel = document.getElementById("guandanTrickPlays");
const guandanTributeLabel = document.getElementById("guandanTribute");
const guandanHandEl = document.getElementById("guandanHand");
const guandanPileEl = document.getElementById("guandanPile");
const guandanPlayersEl = document.getElementById("guandanPlayers");
const guandanPanelEl = document.getElementById("guandanPanel");
const guandanHeaderActions = document.getElementById("guandanHeaderActions");
const guandanHelpBtn = document.getElementById("guandanHelpBtn");
const guandanExplainBtn = document.getElementById("guandanExplainBtn");
const guandanHelpModal = document.getElementById("guandanHelpModal");
const guandanHelpModalCloseBtn = document.getElementById("guandanHelpModalCloseBtn");
const guandanExplainModal = document.getElementById("guandanExplainModal");
const guandanExplainModalCloseBtn = document.getElementById("guandanExplainModalCloseBtn");
const guandanExplainContent = document.getElementById("guandanExplainContent");
const guandanBotExplainModal = document.getElementById("guandanBotExplainModal");
const guandanBotExplainModalCloseBtn = document.getElementById("guandanBotExplainModalCloseBtn");
const guandanBotExplainContent = document.getElementById("guandanBotExplainContent");
const guandanPlayBtn = document.getElementById("guandanPlayBtn");
const guandanPassBtn = document.getElementById("guandanPassBtn");
const guandanHintBtn = document.getElementById("guandanHintBtn");
const guandanCascadeSelect = document.getElementById("guandanCascadeSelect");
const guandanFindSfBtn = document.getElementById("guandanFindSfBtn");
const guandanPileBtn = document.getElementById("guandanPileBtn");
const guandanTributeBtn = document.getElementById("guandanTributeBtn");
const guandanReturnBtn = document.getElementById("guandanReturnBtn");
const guandanNextRoundBtn = document.getElementById("guandanNextRoundBtn");
const guandanPlayAgainBtn = document.getElementById("guandanPlayAgainBtn");

if (guandanCascadeSelect) {
  guandanCascadeSelect.value = guandanHandLayout;
}

function renderGuandanCheckpointOptions() {
  if (!guandanNnCheckpointSelect) {
    return;
  }
  const currentValue = guandanNnCheckpointSelect.value || GUANDAN_DEFAULT_NN_CHECKPOINT;
  guandanNnCheckpointSelect.innerHTML = "";
  if (guandanCheckpointOptionsLoading && !guandanCheckpointOptionsLoaded) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Loading checkpoints...";
    guandanNnCheckpointSelect.appendChild(option);
    guandanNnCheckpointSelect.disabled = true;
    return;
  }
  if (guandanCheckpointOptionsFailed) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Failed to load checkpoints";
    guandanNnCheckpointSelect.appendChild(option);
    guandanNnCheckpointSelect.disabled = true;
    return;
  }
  if (!guandanCheckpointOptions.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No checkpoints found";
    guandanNnCheckpointSelect.appendChild(option);
    guandanNnCheckpointSelect.disabled = true;
    return;
  }
  guandanCheckpointOptions.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.path;
    option.textContent = entry.label || entry.path;
    guandanNnCheckpointSelect.appendChild(option);
  });
  const availableValues = new Set(guandanCheckpointOptions.map((entry) => entry.path));
  if (availableValues.has(currentValue)) {
    guandanNnCheckpointSelect.value = currentValue;
  } else if (availableValues.has(GUANDAN_DEFAULT_NN_CHECKPOINT)) {
    guandanNnCheckpointSelect.value = GUANDAN_DEFAULT_NN_CHECKPOINT;
  } else {
    guandanNnCheckpointSelect.value = guandanCheckpointOptions[0].path;
  }
  guandanNnCheckpointSelect.disabled = false;
}

function fetchGuandanCheckpointOptions() {
  if (!guandanNnCheckpointSelect || guandanCheckpointOptionsLoading) {
    return;
  }
  guandanCheckpointOptionsLoading = true;
  guandanCheckpointOptionsFailed = false;
  renderGuandanCheckpointOptions();
  fetch("/api/guandan/checkpoints")
    .then((response) => response.json())
    .then((data) => {
      guandanCheckpointOptions = Array.isArray(data.checkpoints) ? data.checkpoints : [];
      guandanCheckpointOptionsLoaded = true;
      guandanCheckpointOptionsLoading = false;
      guandanCheckpointOptionsFailed = false;
      renderGuandanCheckpointOptions();
    })
    .catch(() => {
      guandanCheckpointOptionsLoaded = false;
      guandanCheckpointOptionsLoading = false;
      guandanCheckpointOptionsFailed = true;
      renderGuandanCheckpointOptions();
    });
}

function updateGuandanConfigRow() {
  const showRow = currentRoomState && currentGameType === "guandan" && currentRoomState.status === "lobby";
  const mode = guandanBotModeSelect ? guandanBotModeSelect.value || GUANDAN_DEFAULT_BOT_MODE : GUANDAN_DEFAULT_BOT_MODE;
  const showCheckpoint = showRow && mode === "nn";
  if (guandanConfigBox) {
    guandanConfigBox.classList.toggle("hidden", !showRow);
    guandanConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (guandanBotModeRow) {
    guandanBotModeRow.classList.toggle("hidden", !showRow);
    guandanBotModeRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (guandanNnCheckpointRow) {
    guandanNnCheckpointRow.classList.toggle("hidden", !showCheckpoint);
    guandanNnCheckpointRow.setAttribute("aria-hidden", (!showCheckpoint).toString());
  }
  if (showCheckpoint && !guandanCheckpointOptionsLoaded && !guandanCheckpointOptionsLoading) {
    fetchGuandanCheckpointOptions();
  }
}

function getGuandanRoomConfig() {
  const rawMode = guandanBotModeSelect ? guandanBotModeSelect.value || GUANDAN_DEFAULT_BOT_MODE : GUANDAN_DEFAULT_BOT_MODE;
  const botMode = ["auto", "heuristic", "nn"].includes(rawMode) ? rawMode : GUANDAN_DEFAULT_BOT_MODE;
  const checkpoint = guandanNnCheckpointSelect ? guandanNnCheckpointSelect.value || "" : "";
  const config = { bot_mode: botMode };
  if (checkpoint) {
    config.bot_nn_checkpoint = checkpoint;
  }
  return config;
}

function resetGuandanRoomConfig() {
  if (guandanBotModeSelect) {
    guandanBotModeSelect.value = GUANDAN_DEFAULT_BOT_MODE;
  }
  if (guandanNnCheckpointSelect) {
    guandanNnCheckpointSelect.value = GUANDAN_DEFAULT_NN_CHECKPOINT;
  }
  renderGuandanCheckpointOptions();
  updateGuandanConfigRow();
}

function clearGuandanState() {
  currentGuandanView = null;
  guandanBotProgressStatus = null;
  stopGuandanBotProgressTimer();
  guandanSelected = [];
  guandanPiles = [];
  guandanLastSfKey = null;
  guandanHandLayout = "cascade";
  if (guandanCascadeSelect) {
    guandanCascadeSelect.value = guandanHandLayout;
  }
  updateGuandanSelected();
  if (guandanTrickPlaysLabel) {
    guandanTrickPlaysLabel.textContent = "-";
  }
  if (guandanHandEl) {
    guandanHandEl.textContent = "-";
    guandanHandEl.classList.remove("guandan-cascade-hand");
  }
  if (guandanPileEl) {
    guandanPileEl.textContent = "-";
  }
  if (guandanPlayersEl) {
    guandanPlayersEl.textContent = "-";
  }
}

function updateGuandanSelected() {
  return;
}

function scheduleGuandanCascadeLayout() {
  if (guandanHandLayout !== "compact" || !guandanHandEl) return;
  if (guandanCascadeLayoutFrame) {
    cancelAnimationFrame(guandanCascadeLayoutFrame);
  }
  guandanCascadeLayoutFrame = requestAnimationFrame(() => {
    guandanCascadeLayoutFrame = null;
    layoutGuandanCascade();
  });
}

function layoutGuandanCascade() {
  if (guandanHandLayout !== "compact" || !guandanHandEl) return;
  const cols = Array.from(guandanHandEl.querySelectorAll(".guandan-cascade-col"));
  if (!cols.length) return;
  const styles = window.getComputedStyle(guandanHandEl);
  const gap = parseFloat(styles.getPropertyValue("--guandan-cascade-gap")) || 12;
  const widthCandidates = cols.map((col) => Math.ceil(col.getBoundingClientRect().width)).filter((w) => w > 0);
  const fallbackSlot = guandanHandEl.querySelector(".slot") || guandanHandEl.querySelector(".guandan-cascade-select");
  if (fallbackSlot) {
    widthCandidates.push(Math.ceil(fallbackSlot.getBoundingClientRect().width));
  }
  const colWidth = Math.max(48, ...widthCandidates);
  const containerWidth = guandanHandEl.clientWidth;
  const lanes = Math.max(1, Math.floor((containerWidth + gap) / (colWidth + gap)));
  const heights = new Array(lanes).fill(0);
  cols.forEach((col) => {
    col.style.width = `${colWidth}px`;
    let colHeight = Math.ceil(col.getBoundingClientRect().height);
    if (!colHeight) {
      colHeight = Math.ceil(col.scrollHeight);
    }
    let targetLane = 0;
    for (let i = 1; i < lanes; i += 1) {
      if (heights[i] < heights[targetLane]) {
        targetLane = i;
      }
    }
    const left = targetLane * (colWidth + gap);
    const top = heights[targetLane];
    col.style.left = `${left}px`;
    col.style.top = `${top}px`;
    heights[targetLane] = top + colHeight + gap;
  });
  const maxHeight = heights.reduce((max, h) => (h > max ? h : max), 0);
  guandanHandEl.style.height = maxHeight ? `${maxHeight - gap}px` : "";
}

function guandanOptionKey(cards) {
  return [...cards].sort((a, b) => a - b).join("-");
}

function getGuandanHintOptions(view) {
  if (!view) return [];
  if (Array.isArray(view.hint_options) && view.hint_options.length) {
    return view.hint_options;
  }
  if (Array.isArray(view.hint_cards) && view.hint_cards.length) {
    return [view.hint_cards];
  }
  return [];
}

function updateGuandanButtons() {
  if (!currentGuandanView) {
    [
      guandanPlayBtn,
      guandanPassBtn,
      guandanHintBtn,
      guandanCascadeSelect,
      guandanFindSfBtn,
      guandanPileBtn,
      guandanTributeBtn,
      guandanReturnBtn,
      guandanNextRoundBtn,
      guandanPlayAgainBtn,
    ].forEach((btn) => {
      if (btn) btn.disabled = true;
    });
    if (guandanTributeBtn) guandanTributeBtn.classList.add("hidden");
    if (guandanReturnBtn) guandanReturnBtn.classList.add("hidden");
    if (guandanPlayAgainBtn) guandanPlayAgainBtn.classList.add("hidden");
    return;
  }
  const legal = Array.isArray(currentGuandanView.legal_actions) ? currentGuandanView.legal_actions : [];
  const hintOptions = getGuandanHintOptions(currentGuandanView);
  const sfCandidates = Array.isArray(currentGuandanView.sf_candidates)
    ? currentGuandanView.sf_candidates
    : [];
  if (guandanPlayBtn) {
    guandanPlayBtn.disabled = !(legal.includes("play") && guandanSelected.length >= 1);
  }
  if (guandanPassBtn) {
    guandanPassBtn.disabled = !legal.includes("pass");
  }
  if (guandanHintBtn) {
    guandanHintBtn.disabled = !hintOptions.length;
  }
  if (guandanCascadeSelect) {
    guandanCascadeSelect.disabled = false;
  }
  if (guandanFindSfBtn) {
    guandanFindSfBtn.disabled = !sfCandidates.length;
  }
  if (guandanPileBtn) {
    guandanPileBtn.disabled = guandanSelected.length < 1;
  }
  if (guandanTributeBtn) {
    const showTribute = legal.includes("tribute_select");
    guandanTributeBtn.disabled = !(showTribute && guandanSelected.length === 1);
    guandanTributeBtn.classList.toggle("hidden", !showTribute);
  }
  if (guandanReturnBtn) {
    const showReturn = legal.includes("return_select");
    guandanReturnBtn.disabled = !(showReturn && guandanSelected.length === 1);
    guandanReturnBtn.classList.toggle("hidden", !showReturn);
  }
  if (guandanNextRoundBtn) {
    guandanNextRoundBtn.disabled = !legal.includes("next_round");
  }
  if (guandanPlayAgainBtn) {
    const showPlayAgain = legal.includes("play_again");
    guandanPlayAgainBtn.disabled = !showPlayAgain;
    guandanPlayAgainBtn.classList.toggle("hidden", !showPlayAgain);
  }
}

function renderGuandanHand(view) {
  if (!guandanHandEl) return;
  guandanHandEl.innerHTML = "";
  const cascadeActive = guandanHandLayout !== "normal";
  guandanHandEl.classList.toggle("guandan-cascade-hand", cascadeActive);
  guandanHandEl.classList.toggle("guandan-compact-hand", guandanHandLayout === "compact");
  if (guandanHandLayout !== "compact") {
    guandanHandEl.style.height = "";
  }
  const you = Array.isArray(view.players) ? view.players.find((p) => p.player_id === view.you) : null;
  if (!you || !Array.isArray(you.hand)) {
    guandanHandEl.textContent = "-";
    return;
  }
  const handIds = new Set(you.hand.map((card) => card.id));
  guandanPiles = guandanPiles
    .map((row) => row.filter((cid) => handIds.has(cid)))
    .filter((row) => row.length);
  guandanSelected = guandanSelected.filter((cid) => handIds.has(cid));
  const piledIds = new Set(guandanPiles.flat());
  const available = you.hand.filter((card) => !piledIds.has(card.id));
  if (guandanHandLayout === "normal") {
    available.forEach((card) => {
      const div = document.createElement("div");
      div.className = "slot";
      if (card.is_wild) div.classList.add("wild-card");
      if (guandanSelected.includes(card.id)) div.classList.add("selected");
      div.textContent = card.label;
      div.addEventListener("click", () => {
        if (guandanSelected.includes(card.id)) {
          guandanSelected = guandanSelected.filter((cid) => cid !== card.id);
        } else {
          guandanSelected.push(card.id);
        }
        updateGuandanSelected();
        updateGuandanButtons();
        renderGuandanHand(view);
      });
      guandanHandEl.appendChild(div);
    });
    return;
  }

  const groups = [];
  const groupMap = new Map();
  available.forEach((card) => {
    let key = "";
    if (card.joker) {
      key = `joker-${card.joker}`;
    } else if (card.rank != null) {
      key = `rank-${card.rank}`;
    } else {
      key = `label-${card.label}`;
    }
    let group = groupMap.get(key);
    if (!group) {
      group = { key, cards: [] };
      groupMap.set(key, group);
      groups.push(group);
    }
    group.cards.push(card);
  });
  groups.forEach((group) => {
    const col = document.createElement("div");
    col.className = "guandan-cascade-col";
    if (guandanHandLayout !== "compact") {
      col.style.left = "";
      col.style.top = "";
      col.style.width = "";
    }
    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.className = "guandan-cascade-select";
    selectBtn.textContent = "↓";
    selectBtn.addEventListener("click", () => {
      const addIds = group.cards.map((card) => card.id);
      const existing = new Set(guandanSelected);
      const allSelected = addIds.every((cid) => existing.has(cid));
      if (allSelected) {
        guandanSelected = guandanSelected.filter((cid) => !addIds.includes(cid));
      } else {
        const merged = [...guandanSelected];
        addIds.forEach((cid) => {
          if (!existing.has(cid)) {
            merged.push(cid);
          }
        });
        guandanSelected = merged;
      }
      updateGuandanSelected();
      updateGuandanButtons();
      renderGuandanHand(view);
    });
    col.appendChild(selectBtn);
    group.cards.forEach((card) => {
      const div = document.createElement("div");
      div.className = "slot";
      if (card.is_wild) div.classList.add("wild-card");
      if (guandanSelected.includes(card.id)) div.classList.add("selected");
      div.textContent = card.label;
      div.addEventListener("click", () => {
        if (guandanSelected.includes(card.id)) {
          guandanSelected = guandanSelected.filter((cid) => cid !== card.id);
        } else {
          guandanSelected.push(card.id);
        }
        updateGuandanSelected();
        updateGuandanButtons();
        renderGuandanHand(view);
      });
      col.appendChild(div);
    });
    guandanHandEl.appendChild(col);
  });
  scheduleGuandanCascadeLayout();
}

function renderGuandanPile(view) {
  if (!guandanPileEl) return;
  guandanPileEl.innerHTML = "";
  const you = Array.isArray(view.players) ? view.players.find((p) => p.player_id === view.you) : null;
  if (!you || !Array.isArray(you.hand) || !guandanPiles.length) {
    guandanPileEl.textContent = "-";
    return;
  }
  const lookup = new Map(you.hand.map((card) => [card.id, card]));
  guandanPiles.forEach((row, rowIndex) => {
    const rowEl = document.createElement("div");
    rowEl.className = "guandan-pile-row";
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "guandan-pile-clear";
    clearBtn.textContent = "↑";
    clearBtn.addEventListener("click", () => {
      guandanPiles = guandanPiles.filter((_, idx) => idx !== rowIndex);
      updateGuandanSelected();
      updateGuandanButtons();
      renderGuandanHand(view);
      renderGuandanPile(view);
    });
    rowEl.appendChild(clearBtn);
    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.className = "guandan-pile-select";
    selectBtn.textContent = "A";
    selectBtn.addEventListener("click", () => {
      guandanSelected = [...row];
      updateGuandanSelected();
      updateGuandanButtons();
      renderGuandanHand(view);
      renderGuandanPile(view);
    });
    rowEl.appendChild(selectBtn);
    let added = 0;
    row.forEach((cid) => {
      const card = lookup.get(cid);
      if (!card) return;
      const div = document.createElement("div");
      div.className = "slot";
      if (card.is_wild) div.classList.add("wild-card");
      if (guandanSelected.includes(card.id)) div.classList.add("selected");
      div.textContent = card.label;
      div.addEventListener("click", () => {
        guandanPiles = guandanPiles
          .map((pile, idx) => (idx === rowIndex ? pile.filter((pid) => pid !== card.id) : pile))
          .filter((pile) => pile.length);
        guandanSelected = guandanSelected.filter((pid) => pid !== card.id);
        updateGuandanSelected();
        updateGuandanButtons();
        renderGuandanHand(view);
        renderGuandanPile(view);
      });
      rowEl.appendChild(div);
      added += 1;
    });
    if (added) {
      guandanPileEl.appendChild(rowEl);
    }
  });
}

function renderGuandanPlayers(view) {
  if (!guandanPlayersEl) return;
  guandanPlayersEl.innerHTML = "";
  if (!Array.isArray(view.players)) {
    guandanPlayersEl.textContent = "-";
    return;
  }
  view.players.forEach((player) => {
    const div = document.createElement("div");
    div.className = "guandan-player";
    const turnTag = player.player_id === view.current_turn ? " (turn)" : "";
    const finishedTag = player.finished ? ` #${player.finish_rank}` : "";
    div.textContent = `${player.name} [${player.team}] cards:${player.hand_count}${finishedTag}${turnTag}`;
    guandanPlayersEl.appendChild(div);
  });
}

function renderGuandanTrick(view) {
  if (!guandanTrickLabel) return;
  if (!view.current_trick) {
    guandanTrickLabel.textContent = "-";
    return;
  }
  const trick = view.current_trick;
  const owner = Array.isArray(view.players)
    ? view.players.find((p) => p.player_id === trick.player_id)
    : null;
  const ownerName = owner ? owner.name : trick.player_id;
  guandanTrickLabel.textContent = `${trick.type} by ${ownerName} (size ${trick.size})`;
}

function renderGuandanTrickPlays(view) {
  if (!guandanTrickPlaysLabel) return;
  if (!Array.isArray(view.players) || !view.players.length) {
    guandanTrickPlaysLabel.textContent = "-";
    return;
  }
  const playsById = new Map();
  if (Array.isArray(view.trick_plays)) {
    view.trick_plays.forEach((entry) => {
      if (!entry) return;
      playsById.set(entry.player_id, entry);
    });
  }
  const botExplain = view.bot_explain || {};
  const botExplainHistory = view.bot_explain_history || {};
  const rows = view.players
    .map((player) => {
      const entry = playsById.get(player.player_id);
      const cards = entry && Array.isArray(entry.cards) && entry.cards.length ? entry.cards.join(" ") : "-";
      const explain = botExplain[player.player_id];
      const history = Array.isArray(botExplainHistory[player.player_id]) ? botExplainHistory[player.player_id] : [];
      const hasExplain = !!explain || history.length > 0;
      const rowClass = player.player_id === view.current_turn ? "guandan-current-turn-row" : "";
      let playerCell = player.name || player.player_id;
      if (player.is_bot && hasExplain) {
        playerCell = `<button type="button" class="guandan-bot-explain-btn" data-player="${player.player_id}">${playerCell}</button>`;
      }
      const progress = getGuandanBotProgressMarkup(player.player_id);
      const playerCellContent = `
        <div class="guandan-player-cell">
          <span class="guandan-player-name">${playerCell}</span>
          ${progress}
        </div>
      `;
      let trickCell = cards;
      if (player.is_bot && explain && cards !== "-") {
        trickCell = `<button type="button" class="guandan-bot-explain-btn" data-player="${player.player_id}">${cards}</button>`;
      }
      return `
        <tr class="${rowClass}">
          <td>${playerCellContent}</td>
          <td>${player.hand_count ?? "-"}</td>
          <td>${trickCell}</td>
        </tr>
      `;
    })
    .join("");
  guandanTrickPlaysLabel.innerHTML = `
    <table class="guandan-trick-plays-table">
      <thead>
        <tr>
          <th>Player</th>
          <th>Cards Left</th>
          <th>Trick</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
  const explainBtns = guandanTrickPlaysLabel.querySelectorAll(".guandan-bot-explain-btn");
  explainBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const playerId = btn.getAttribute("data-player");
      if (playerId) {
        showGuandanBotExplain(playerId);
      }
    });
  });
}

function stopGuandanBotProgressTimer() {
  if (guandanBotProgressTimer) {
    window.clearInterval(guandanBotProgressTimer);
    guandanBotProgressTimer = null;
  }
}

function getGuandanBotProgressValue() {
  const status = guandanBotProgressStatus;
  if (!status || !status.running || !status.player_id) {
    return null;
  }
  if (typeof status.progress === "number" && Number.isFinite(status.progress)) {
    return Math.max(0.0, Math.min(0.99, status.progress));
  }
  const startedAt = Number(status.started_at_ms || 0);
  const thinkBudget = Math.max(40, Number(status.think_budget_ms || 320));
  if (!startedAt) {
    return 0.08;
  }
  const elapsed = Math.max(0, Date.now() - startedAt);
  const ratio = elapsed / thinkBudget;
  if (ratio <= 0) return 0.08;
  if (ratio < 0.85) return Math.max(0.08, ratio * 0.88);
  if (ratio < 1.4) return 0.75 + (ratio - 0.85) / 0.55 * 0.15;
  if (ratio < 2.5) return 0.9 + (ratio - 1.4) / 1.1 * 0.06;
  return 0.96;
}

function getGuandanBotProgressMarkup(playerId) {
  const status = guandanBotProgressStatus;
  if (!status || !status.running || status.player_id !== playerId) {
    return "";
  }
  const progress = getGuandanBotProgressValue();
  if (progress == null) {
    return "";
  }
  const percent = Math.max(1, Math.min(99, Math.round(progress * 100)));
  const title = [status.stage || "thinking", status.detail || "AI thinking"]
    .filter(Boolean)
    .join(": ");
  return `
    <span class="guandan-bot-progress" aria-label="AI thinking ${percent}%" title="${title}">
      <span class="guandan-bot-progress-bar">
        <span class="guandan-bot-progress-fill" style="width:${percent}%"></span>
      </span>
      <span class="guandan-bot-progress-text">${percent}%</span>
    </span>
  `;
}

function syncGuandanBotProgress(status) {
  guandanBotProgressStatus = status && status.running ? { ...status } : null;
  stopGuandanBotProgressTimer();
  if (!guandanBotProgressStatus || !currentGuandanView) {
    return;
  }
  guandanBotProgressTimer = window.setInterval(() => {
    if (!guandanBotProgressStatus || !currentGuandanView) {
      stopGuandanBotProgressTimer();
      return;
    }
    renderGuandanTrickPlays(currentGuandanView);
  }, 120);
}

function renderGuandanBotProgress(status) {
  syncGuandanBotProgress(status || null);
  if (currentGuandanView) {
    renderGuandanTrickPlays(currentGuandanView);
  }
}

function renderGuandanTribute(view) {
  if (!guandanTributeLabel) return;
  if (!view.tribute) {
    guandanTributeLabel.textContent = "-";
    return;
  }
  const tribute = view.tribute;
  const parts = [];
  parts.push(`${tribute.stage} ${tribute.type}`);
  if (Array.isArray(tribute.payers) && tribute.payers.length) {
    parts.push(`payers: ${tribute.payers.join(", ")}`);
  }
  if (Array.isArray(tribute.receivers) && tribute.receivers.length) {
    parts.push(`receivers: ${tribute.receivers.join(", ")}`);
  }
  if (tribute.tribute_cards && typeof tribute.tribute_cards === "object") {
    const entries = Object.entries(tribute.tribute_cards);
    if (entries.length) {
      const labels = entries.map(([name, card]) => `${name}: ${card}`);
      parts.push(`tribute cards: ${labels.join(", ")}`);
    }
  }
  if (tribute.return_cards && typeof tribute.return_cards === "object") {
    const entries = Object.entries(tribute.return_cards);
    if (entries.length) {
      const labels = entries.map(([name, card]) => `${name}: ${card}`);
      parts.push(`return cards: ${labels.join(", ")}`);
    }
  }
  guandanTributeLabel.textContent = parts.join(" | ");
}

function renderGuandanGameState(data) {
  const view = data.view;
  if (!view) return;
  currentGuandanView = view;
  syncGuandanBotProgress(data.bot_status || null);
  if (guandanPhaseLabel) guandanPhaseLabel.textContent = view.phase || "-";
  if (guandanRoundLabel) guandanRoundLabel.textContent = view.round_number || "-";
  if (guandanTurnLabel) {
    const current = Array.isArray(view.players)
      ? view.players.find((p) => p.player_id === view.current_turn)
      : null;
    guandanTurnLabel.textContent = current ? current.name : view.current_turn || "-";
  }
  if (guandanDealerLabel) guandanDealerLabel.textContent = view.dealer_team || "-";
  if (guandanLevelLabel) guandanLevelLabel.textContent = view.level_rank || "-";
  renderGuandanTrick(view);
  renderGuandanTrickPlays(view);
  renderGuandanTribute(view);
  renderGuandanHand(view);
  renderGuandanPile(view);
  renderGuandanPlayers(view);
  updateGuandanSelected();
  updateGuandanButtons();
}

const GUANDAN_HELP_TEXT = `
<h3>Overview</h3>
<p>Guandan is a 4-player partnership climbing game using two decks. You and your partner try to go out first and level up.</p>

<h3>Key Concepts</h3>
<ul>
  <li><strong>Level Rank</strong> (主牌): current rank that is stronger than normal ranks.</li>
  <li><strong>Wild Card</strong>: the level card in ♥️ can substitute for any non-joker card when forming combos.</li>
  <li><strong>Jokers</strong>: 🃏B (big) is highest, 🃏S (small) is next.</li>
</ul>

<h3>Common Combos</h3>
<ul>
  <li>Single, Pair, Three of a Kind</li>
  <li>Full House (3 + 2)</li>
  <li>Straight (5 cards), Three Consecutive Pairs, Steel Plate (two consecutive triples)</li>
  <li>Bombs (4+ of a kind), Straight Flush, Heavenly (🃏B🃏B🃏S🃏S)</li>
</ul>

<h3>Round Flow</h3>
<ul>
  <li>First round starts with the player who receives the marked visible card.</li>
  <li>Players take turns following the lead or passing.</li>
  <li>When three players pass, the last player to play leads the next trick.</li>
</ul>

<h3>Tribute</h3>
<ul>
  <li>Based on last round’s finishing order, losers may tribute their highest card (excluding ♥️ level card).</li>
  <li>Receivers return a card ≤ 10 if possible.</li>
  <li>Two 🃏B in hand cancels tribute.</li>
</ul>
`;

const GUANDAN_BUTTON_EXPLANATIONS = {
  guandanPlayBtn: {
    name: "Play",
    description: "Play the selected cards as a valid combo. The combo must beat the current trick if there is one.",
    cost: "Your Turn",
    costType: "free",
  },
  guandanPassBtn: {
    name: "Pass",
    description: "Skip your turn when you cannot or do not want to beat the current trick.",
    cost: "Your Turn",
    costType: "free",
  },
  guandanHintBtn: {
    name: "Hint",
    description: "Auto-select the next playable combo based on the current trick.",
    cost: "Assist",
    costType: "free",
  },
  guandanFindSfBtn: {
    name: "Find SF",
    description: "Cycle through available straight flush selections in your hand.",
    cost: "Assist",
    costType: "free",
  },
  guandanPileBtn: {
    name: "Pile",
    description: "Move the selected cards into a personal pile to organize your hand.",
    cost: "Organize",
    costType: "free",
  },
  guandanTributeBtn: {
    name: "Tribute",
    description: "Give your highest eligible card to the winner (♥️ level card is protected).",
    cost: "Required",
    costType: "end",
  },
  guandanReturnBtn: {
    name: "Return",
    description: "Return a card (≤ 10 if possible) to the tribute payer.",
    cost: "Required",
    costType: "end",
  },
  guandanNextRoundBtn: {
    name: "Next Round",
    description: "Start the next round after the current round ends.",
    cost: "Start Round",
    costType: "free",
  },
  guandanPlayAgainBtn: {
    name: "Play Again",
    description: "Restart the match with the same players and configuration.",
    cost: "Restart",
    costType: "end",
  },
};

function showGuandanHeaderActions(show) {
  if (guandanHeaderActions) {
    guandanHeaderActions.style.display = show ? "flex" : "none";
  }
}

function showGuandanHelpModal() {
  if (!guandanHelpModal) return;
  const content = guandanHelpModal.querySelector(".guandan-help-content");
  if (content) {
    content.innerHTML = GUANDAN_HELP_TEXT;
  }
  setModalVisible(guandanHelpModal, true);
}

function closeGuandanHelpModal() {
  if (guandanHelpModal) {
    setModalVisible(guandanHelpModal, false);
  }
}

function updateGuandanExplainClasses(enabled) {
  Object.keys(GUANDAN_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
}

function findGuandanButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(GUANDAN_BUTTON_EXPLANATIONS)) {
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  return null;
}

function toggleGuandanExplainMode() {
  guandanExplainMode = !guandanExplainMode;
  document.body.classList.toggle("guandan-explain-mode", guandanExplainMode);
  updateGuandanExplainClasses(guandanExplainMode);
  if (guandanExplainBtn) {
    guandanExplainBtn.classList.toggle("active", guandanExplainMode);
  }
}

function exitGuandanExplainMode() {
  if (!guandanExplainMode) return;
  guandanExplainMode = false;
  document.body.classList.remove("guandan-explain-mode");
  updateGuandanExplainClasses(false);
  if (guandanExplainBtn) {
    guandanExplainBtn.classList.remove("active");
  }
}

function showGuandanButtonExplanation(buttonId) {
  const explanation = GUANDAN_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !guandanExplainContent || !guandanExplainModal) {
    return;
  }
  let costClass = "free";
  if (explanation.costType === "end") costClass = "end";
  guandanExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    <span class="explain-cost ${costClass}">${explanation.cost}</span>
  `;
  setModalVisible(guandanExplainModal, true);
}

function closeGuandanExplainModal() {
  if (guandanExplainModal) {
    setModalVisible(guandanExplainModal, false);
  }
}

const GUANDAN_BOT_COMPONENT_LABELS = {
  protect_teammate: "Protect teammate",
  hand_pressure: "Hand pressure",
  team_finish: "Team finish",
  play_cards: "Play size",
  shape_value: "Shape value",
  finish_bonus: "Finish bonus",
  bomb_bonus: "Bomb bonus",
  wild_penalty: "Wild penalty",
  opp_block: "Opp likely blocked",
  opp_risk: "Opp likely beats",
  avoid_overtrick: "Avoid overtrick",
  seize_tempo: "Seize tempo",
  pass_opportunity_cost: "Pass opportunity cost",
  lead_finish_bonus: "Lead finish",
  remaining_penalty: "Remaining penalty",
  mcts_avg: "MCTS avg",
  mcts_std: "MCTS std",
  mcts_win_rate: "MCTS win rate",
  mcts_min: "MCTS min",
  mcts_max: "MCTS max",
};

function formatGuandanBotComponents(components) {
  if (!components) return "-";
  const entries = Object.entries(components)
    .filter(([key, value]) => key.startsWith("mcts_") || Math.abs(value) > 0.001)
    .map(([key, value]) => {
      const label = GUANDAN_BOT_COMPONENT_LABELS[key] || key;
      if (key === "mcts_win_rate") {
        const percent = Math.round(value * 100);
        return `<span>${label}: ${percent}%</span>`;
      }
      const rounded = Math.round(value * 10) / 10;
      return `<span>${label}: ${rounded}</span>`;
    });
  if (!entries.length) return "-";
  return `<div class="guandan-bot-explain-components">${entries.join("")}</div>`;
}

function formatGuandanBotComponentsText(components) {
  if (!components) return "-";
  const entries = Object.entries(components)
    .filter(([key, value]) => key.startsWith("mcts_") || Math.abs(value) > 0.001)
    .map(([key, value]) => {
      if (key === "mcts_win_rate") {
        return `${key}=${Math.round(value * 100)}%`;
      }
      const rounded = Math.round(value * 10) / 10;
      return `${key}=${rounded}`;
    });
  return entries.length ? entries.join(", ") : "-";
}

function getGuandanPlayerName(view, playerId) {
  if (!view || !Array.isArray(view.players)) return playerId || "-";
  const player = view.players.find((entry) => entry.player_id === playerId);
  return player ? player.name || player.player_id : playerId || "-";
}

function getGuandanCurrentTrickCards(view) {
  if (!view || !view.current_trick) return "-";
  if (Array.isArray(view.trick_plays)) {
    const entry = view.trick_plays.find((play) => play && play.player_id === view.current_trick.player_id);
    if (entry && Array.isArray(entry.cards) && entry.cards.length) {
      return entry.cards.join(" ");
    }
  }
  return `${view.current_trick.type || "-"} (size ${view.current_trick.size ?? "-"})`;
}

function getGuandanBotExplainTargetText(view) {
  if (!view || !view.current_trick) return "Lead / no target";
  const comboType = view.current_trick.type || "-";
  const leader = getGuandanPlayerName(view, view.current_trick.player_id);
  const cards = getGuandanCurrentTrickCards(view);
  return `${comboType} by ${leader}: ${cards}`;
}

async function copyGuandanBotExplainToClipboard(text) {
  if (typeof copyTextToClipboard === "function") {
    return copyTextToClipboard(text);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      return false;
    }
  }
  return false;
}

function buildGuandanRoundHistoryClipboardText(view) {
  if (!view || !Array.isArray(view.round_history) || !view.round_history.length) {
    return "";
  }
  const sections = [];
  view.round_history.forEach((roundEntry) => {
    const roundNumber = roundEntry && roundEntry.round_number != null ? roundEntry.round_number : "-";
    const headerBits = [`Round ${roundNumber}`];
    if (roundEntry && roundEntry.dealer_team) {
      headerBits.push(`dealer=${roundEntry.dealer_team}`);
    }
    if (roundEntry && roundEntry.level_rank != null) {
      headerBits.push(`level=${roundEntry.level_rank}`);
    }
    if (roundEntry && roundEntry.status) {
      headerBits.push(`status=${roundEntry.status}`);
    }
    sections.push(headerBits.join(" "));
    const tricks = Array.isArray(roundEntry && roundEntry.tricks) ? roundEntry.tricks : [];
    if (!tricks.length) {
      sections.push("No tricks yet.");
      return;
    }
    tricks.forEach((trick) => {
      const leader = getGuandanPlayerName(view, trick && trick.leader_id);
      const winner = getGuandanPlayerName(view, trick && trick.winner_id);
      sections.push(
        `Trick ${trick && trick.index != null ? trick.index : "-"} leader=${leader} winner=${winner} status=${(trick && trick.status) || "-"}`
      );
      const actions = Array.isArray(trick && trick.actions) ? trick.actions : [];
      if (!actions.length) {
        sections.push("  (no actions)");
        return;
      }
      actions.forEach((action, index) => {
        const actor = getGuandanPlayerName(view, action && action.player_id);
        if (action && action.type === "play") {
          const cards = Array.isArray(action.cards) && action.cards.length ? action.cards.join(" ") : "-";
          const notes = [];
          if (action.combo_type) {
            notes.push(`combo=${action.combo_type}`);
          }
          if (action.combo_size != null) {
            notes.push(`size=${action.combo_size}`);
          }
          if (action.hand_count_after != null) {
            notes.push(`left=${action.hand_count_after}`);
          }
          if (action.finished_rank != null) {
            notes.push(`finish#${action.finished_rank}`);
          }
          sections.push(`${index + 1}. ${actor}: ${cards}${notes.length ? ` (${notes.join(", ")})` : ""}`);
          return;
        }
        const notes = [];
        if (action && action.hand_count_after != null) {
          notes.push(`left=${action.hand_count_after}`);
        }
        if (action && action.finished_rank != null) {
          notes.push(`finish#${action.finished_rank}`);
        }
        sections.push(`${index + 1}. ${actor}: Pass${notes.length ? ` (${notes.join(", ")})` : ""}`);
      });
    });
  });
  return sections.join("\n");
}

function buildGuandanBotExplainClipboardText(playerId, explain) {
  const view = currentGuandanView;
  if (!view || !explain) return "";
  const context = explain.decision || view;
  const chosen = explain.chosen || {};
  const chosenCards = Array.isArray(chosen.cards) ? chosen.cards : [];
  const remainingHand = Array.isArray(explain.hand) ? explain.hand : [];
  const handBeforeAction = Array.isArray(explain.hand_before) ? explain.hand_before : remainingHand;
  const players = Array.isArray(context.players) ? context.players : [];
  const trickPlays = Array.isArray(context.trick_plays) ? context.trick_plays : [];
  const top = Array.isArray(explain.top) ? explain.top : [];
  const methodDetails = explain.method_details || {};
  const playerLine = players
    .map((player) => {
      const tags = [];
      if (player.player_id === playerId) tags.push("bot");
      if (player.player_id === context.current_turn) tags.push("turn");
      if (player.finished) tags.push(`finish#${player.finish_rank ?? "-"}`);
      const suffix = tags.length ? `(${tags.join(",")})` : "";
      return `${player.name || player.player_id}[${player.team || "-"}]:${player.hand_count ?? "-"}${suffix}`;
    })
    .join(" | ");
  const countLine = players
    .map((player) => `${player.name || player.player_id}:${player.hand_count ?? "-"}`)
    .join(" | ");
  const trickLine = trickPlays.length
    ? trickPlays
        .map((entry) => `${entry.name || getGuandanPlayerName(context, entry.player_id)}:${(entry.cards || []).join(" ") || "-"}`)
        .join(" | ")
    : "-";
  const topLines = top.length
    ? top
        .map((entry, index) => {
          const cards = Array.isArray(entry.cards) ? entry.cards.join(" ") : "-";
          const score = typeof entry.score === "number" ? Math.round(entry.score * 10) / 10 : "-";
          return `${index + 1}) ${cards} @${score} :: ${formatGuandanBotComponentsText(entry.components)}`;
        })
        .join("\n")
    : "-";
  const detailBits = [];
  if (typeof methodDetails.sims_per_action === "number") {
    detailBits.push(`sims=${methodDetails.sims_per_action}`);
  }
  if (typeof methodDetails.depth === "number") {
    detailBits.push(`depth=${methodDetails.depth}`);
  }
  if (typeof methodDetails.candidates === "number") {
    detailBits.push(`cand=${methodDetails.candidates}`);
  }
  if (typeof methodDetails.tree_ply === "number") {
    detailBits.push(`tree=${methodDetails.tree_ply}`);
  }
  if (typeof methodDetails.reply_width === "number") {
    detailBits.push(`reply=${methodDetails.reply_width}`);
  }
  if (typeof methodDetails.risk_lambda === "number") {
    detailBits.push(`risk=${methodDetails.risk_lambda}`);
  }
  const trickSummary = context.current_trick
    ? `${context.current_trick.type || "-"}:${getGuandanPlayerName(context, context.current_trick.player_id)}:${getGuandanCurrentTrickCards(context)}`
    : "-";
  const targetSummary = getGuandanBotExplainTargetText(context);
  return [
    "guandan_bot_review",
    `bot=${getGuandanPlayerName(context, playerId)} method=${explain.method || "heuristic"} ${detailBits.join(" ")}`.trim(),
    `phase=${context.phase || "-"} round=${context.round_number ?? "-"} dealer=${context.dealer_team ?? "-"} level=${context.level_rank ?? "-"} turn=${getGuandanPlayerName(context, context.current_turn)}`,
    `trick=${trickSummary}`,
    `target=${targetSummary}`,
    `players=${playerLine || "-"}`,
    `counts=${countLine || "-"}`,
    `trick_plays=${trickLine}`,
    `hand_before=${handBeforeAction.join(" ") || "-"}`,
    `hand_after=${remainingHand.join(" ") || "-"}`,
    `chosen=${chosenCards.join(" ") || "-"} score=${typeof chosen.score === "number" ? Math.round(chosen.score * 10) / 10 : "-"} comps=${formatGuandanBotComponentsText(chosen.components)}`,
    "top=",
    topLines,
  ].join("\n");
}

function buildGuandanBotExplainVerboseClipboardText(playerId, explain) {
  const base = buildGuandanBotExplainClipboardText(playerId, explain);
  const history = buildGuandanRoundHistoryClipboardText(currentGuandanView);
  if (!history) {
    return base;
  }
  return `${base}\n=====\n${history}`;
}

function getGuandanBotExplainEntries(playerId) {
  if (!currentGuandanView || !playerId) return [];
  const historyByBot = currentGuandanView.bot_explain_history || {};
  const entries = Array.isArray(historyByBot[playerId]) ? historyByBot[playerId].slice() : [];
  const latest = currentGuandanView.bot_explain ? currentGuandanView.bot_explain[playerId] : null;
  const latestChosen = Array.isArray(latest && latest.chosen && latest.chosen.cards)
    ? latest.chosen.cards.join("|")
    : "";
  const tail = entries.length ? entries[entries.length - 1] : null;
  const tailExplain = tail && tail.explain ? tail.explain : null;
  const tailChosen = Array.isArray(tailExplain && tailExplain.chosen && tailExplain.chosen.cards)
    ? tailExplain.chosen.cards.join("|")
    : "";
  const sameLatest =
    !!latest &&
    !!tailExplain &&
    tailChosen === latestChosen &&
    (tail.round_number ?? null) === (currentGuandanView.round_number ?? null) &&
    (tail.action_type || "") ===
      (Array.isArray(latest.chosen && latest.chosen.cards) && latest.chosen.cards[0] === "Pass" ? "pass" : "play");
  if (latest && !sameLatest) {
    entries.push({
      round_number: currentGuandanView.round_number,
      phase: currentGuandanView.phase,
      action_type: Array.isArray(latest.chosen && latest.chosen.cards) && latest.chosen.cards[0] === "Pass" ? "pass" : "play",
      card_ids: [],
      explain: latest,
    });
  }
  return entries;
}

function showGuandanBotExplain(playerId, historyIndex = null) {
  if (!guandanBotExplainModal || !guandanBotExplainContent || !currentGuandanView) return;
  const entries = getGuandanBotExplainEntries(playerId);
  const safeIndex =
    historyIndex == null ? entries.length - 1 : Math.max(0, Math.min(historyIndex, entries.length - 1));
  const entry = entries[safeIndex] || null;
  const explain = entry && entry.explain ? entry.explain : currentGuandanView.bot_explain ? currentGuandanView.bot_explain[playerId] : null;
  if (!explain) {
    guandanBotExplainContent.textContent = "No explanation available.";
    setModalVisible(guandanBotExplainModal, true);
    return;
  }
  guandanBotExplainPlayerId = playerId;
  guandanBotExplainHistoryIndex = safeIndex;
  const method = explain.method || "heuristic";
  const methodDetails = explain.method_details || null;
  const context = explain.decision || currentGuandanView;
  const chosen = explain.chosen || {};
  const chosenCards = Array.isArray(chosen.cards) ? chosen.cards.join(" ") : "-";
  const chosenScore = typeof chosen.score === "number" ? Math.round(chosen.score * 10) / 10 : "-";
  const chosenComponents = formatGuandanBotComponents(chosen.components);
  const targetSummary = getGuandanBotExplainTargetText(context);
  const hand = Array.isArray(explain.hand) ? explain.hand : [];
  const handItems = hand.map((card) => `<span class="guandan-bot-hand-card">${card}</span>`).join("");
  const navButtons =
    entries.length > 1
      ? `
      <button type="button" class="guandan-bot-explain-nav" data-dir="-1" ${safeIndex <= 0 ? "disabled" : ""}>&lt;</button>
      <span class="hint">Action ${safeIndex + 1} / ${entries.length}</span>
      <button type="button" class="guandan-bot-explain-nav" data-dir="1" ${safeIndex >= entries.length - 1 ? "disabled" : ""}>&gt;</button>
    `
      : "";
  const contextBits = [];
  if (entry && entry.round_number != null) {
    contextBits.push(`Round ${entry.round_number}`);
  }
  if (entry && entry.phase) {
    contextBits.push(entry.phase);
  }
  if (entry && entry.action_type) {
    contextBits.push(entry.action_type);
  }
  const actionsRow = `
    <div class="guandan-bot-hand-row guandan-bot-explain-actions">
      ${navButtons}
      <button type="button" class="guandan-bot-explain-copy" data-player="${playerId}">Copy</button>
      <button type="button" class="guandan-bot-explain-copy guandan-bot-explain-copy-verbose" data-player="${playerId}">Copy Verbose</button>
      ${hand.length ? `<button type="button" class="guandan-bot-hand-toggle">View Hand</button>` : ""}
      <span class="guandan-bot-copy-status" aria-live="polite"></span>
    </div>
  `;
  const handBlock = hand.length ? `<div class="guandan-bot-hand hidden">${handItems}</div>` : "";
  const top = Array.isArray(explain.top) ? explain.top : [];
  const rows = top
    .map((entry, index) => {
      const cards = Array.isArray(entry.cards) ? entry.cards.join(" ") : "-";
      const score = typeof entry.score === "number" ? Math.round(entry.score * 10) / 10 : "-";
      const comps = formatGuandanBotComponents(entry.components);
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${cards}</td>
          <td>${score}</td>
          <td>${comps}</td>
        </tr>
      `;
    })
    .join("");
  const detailParts = [];
  if (methodDetails && typeof methodDetails.sims_per_action === "number") {
    detailParts.push(`Rollouts/action ${methodDetails.sims_per_action}`);
  }
  if (methodDetails && typeof methodDetails.depth === "number") {
    detailParts.push(`Depth ${methodDetails.depth}`);
  }
  if (methodDetails && typeof methodDetails.candidates === "number") {
    detailParts.push(`Candidates ${methodDetails.candidates}`);
  }
  const detailLine = detailParts.length ? `<div class="hint">${detailParts.join(" · ")}</div>` : "";
  const contextLine = contextBits.length ? `<div class="hint">${contextBits.join(" · ")}</div>` : "";
  const mctsLine =
    explain.score_model === "mcts"
      ? `<div class="hint">MCTS avg is the mean rollout score. Win rate is rollouts with positive score.</div>`
      : "";
  guandanBotExplainContent.innerHTML = `
    ${actionsRow}
    <div><strong>Method:</strong> ${method}</div>
    ${contextLine}
    ${detailLine}
    ${mctsLine}
    ${handBlock}
    <div><strong>Target:</strong> ${targetSummary}</div>
    <div><strong>Chosen:</strong> ${chosenCards} <span class="hint">(score ${chosenScore})</span></div>
    <div><strong>Score Breakdown:</strong> ${chosenComponents}</div>
    <table class="guandan-bot-explain-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Cards</th>
          <th>Score</th>
          <th>Components</th>
        </tr>
      </thead>
      <tbody>
        ${rows || ""}
      </tbody>
    </table>
  `;
  const copyBtn = guandanBotExplainContent.querySelector(".guandan-bot-explain-copy");
  const copyVerboseBtn = guandanBotExplainContent.querySelector(".guandan-bot-explain-copy-verbose");
  const copyStatus = guandanBotExplainContent.querySelector(".guandan-bot-copy-status");
  const navBtns = guandanBotExplainContent.querySelectorAll(".guandan-bot-explain-nav");
  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const delta = Number(btn.getAttribute("data-dir") || "0");
      if (!delta || !guandanBotExplainPlayerId) return;
      showGuandanBotExplain(guandanBotExplainPlayerId, guandanBotExplainHistoryIndex + delta);
    });
  });
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const text = buildGuandanBotExplainClipboardText(playerId, explain);
      const ok = await copyGuandanBotExplainToClipboard(text);
      copyBtn.textContent = ok ? "Copied" : "Copy Failed";
      if (copyStatus) {
        copyStatus.textContent = ok ? "Bot context copied." : "Clipboard unavailable.";
      }
      window.setTimeout(() => {
        copyBtn.textContent = "Copy";
        if (copyStatus) {
          copyStatus.textContent = "";
        }
      }, 1400);
    });
  }
  if (copyVerboseBtn) {
    copyVerboseBtn.addEventListener("click", async () => {
      const text = buildGuandanBotExplainVerboseClipboardText(playerId, explain);
      const ok = await copyGuandanBotExplainToClipboard(text);
      copyVerboseBtn.textContent = ok ? "Copied" : "Copy Failed";
      if (copyStatus) {
        copyStatus.textContent = ok ? "Verbose bot context copied." : "Clipboard unavailable.";
      }
      window.setTimeout(() => {
        copyVerboseBtn.textContent = "Copy Verbose";
        if (copyStatus) {
          copyStatus.textContent = "";
        }
      }, 1400);
    });
  }
  if (hand.length) {
    const toggleBtn = guandanBotExplainContent.querySelector(".guandan-bot-hand-toggle");
    const handContainer = guandanBotExplainContent.querySelector(".guandan-bot-hand");
    if (toggleBtn && handContainer) {
      toggleBtn.addEventListener("click", () => {
        const isHidden = handContainer.classList.toggle("hidden");
        toggleBtn.textContent = isHidden ? "View Hand" : "Hide Hand";
      });
    }
  }
  setModalVisible(guandanBotExplainModal, true);
}

function applyGuandanSelection(cardIds) {
  if (!Array.isArray(cardIds) || !cardIds.length || !currentGuandanView) {
    return;
  }
  guandanSelected = [...cardIds];
  updateGuandanSelected();
  renderGuandanHand(currentGuandanView);
  renderGuandanPile(currentGuandanView);
  updateGuandanButtons();
}

if (guandanPlayBtn) {
  guandanPlayBtn.addEventListener("click", () => {
    if (!guandanSelected.length) return;
    sendAction({ type: "play", card_ids: guandanSelected });
    guandanSelected = [];
    updateGuandanSelected();
    if (currentGuandanView) {
      renderGuandanHand(currentGuandanView);
      renderGuandanPile(currentGuandanView);
      updateGuandanButtons();
    }
  });
}

if (guandanPassBtn) {
  guandanPassBtn.addEventListener("click", () => {
    sendAction({ type: "pass" });
  });
}

if (guandanHintBtn) {
  guandanHintBtn.addEventListener("click", () => {
    if (!currentGuandanView) return;
    const options = getGuandanHintOptions(currentGuandanView);
    if (!options.length) return;
    const optionKeys = options.map((cards) => guandanOptionKey(cards));
    const selectedKey = guandanSelected.length ? guandanOptionKey(guandanSelected) : "";
    let idx = -1;
    if (selectedKey) {
      idx = optionKeys.indexOf(selectedKey);
    }
    const nextCards = options[(idx + 1) % options.length];
    applyGuandanSelection(nextCards || []);
  });
}

if (guandanCascadeSelect) {
  guandanCascadeSelect.addEventListener("change", () => {
    const value = guandanCascadeSelect.value;
    if (value === "normal" || value === "cascade" || value === "compact") {
      guandanHandLayout = value;
    } else {
      guandanHandLayout = "cascade";
      guandanCascadeSelect.value = guandanHandLayout;
    }
    if (currentGuandanView) {
      renderGuandanHand(currentGuandanView);
      updateGuandanButtons();
    }
  });
}

if (guandanBotModeSelect) {
  guandanBotModeSelect.addEventListener("change", () => {
    updateGuandanConfigRow();
  });
}

window.addEventListener("resize", () => {
  if (guandanHandLayout === "compact") {
    scheduleGuandanCascadeLayout();
  }
});

if (guandanFindSfBtn) {
  guandanFindSfBtn.addEventListener("click", () => {
    if (!currentGuandanView) return;
    const list = Array.isArray(currentGuandanView.sf_candidates) ? currentGuandanView.sf_candidates : [];
    if (!list.length) return;
    let idx = 0;
    const selectedKey = guandanSelected.length ? guandanOptionKey(guandanSelected) : "";
    let found = -1;
    if (selectedKey) {
      found = list.findIndex((entry) => entry.key === selectedKey);
    }
    if (found < 0 && guandanLastSfKey) {
      found = list.findIndex((entry) => entry.key === guandanLastSfKey);
    }
    if (found >= 0) {
      idx = (found + 1) % list.length;
    }
    const chosen = list[idx];
    guandanLastSfKey = chosen.key;
    applyGuandanSelection(chosen.cards || []);
  });
}

if (guandanPileBtn) {
  guandanPileBtn.addEventListener("click", () => {
    if (!currentGuandanView || !guandanSelected.length) return;
    const newRow = [...guandanSelected];
    guandanPiles = guandanPiles
      .map((row) => row.filter((cid) => !newRow.includes(cid)))
      .filter((row) => row.length);
    guandanPiles.push(newRow);
    guandanSelected = [];
    updateGuandanSelected();
    renderGuandanHand(currentGuandanView);
    renderGuandanPile(currentGuandanView);
    updateGuandanButtons();
  });
}

if (guandanTributeBtn) {
  guandanTributeBtn.addEventListener("click", () => {
    if (guandanSelected.length !== 1) return;
    sendAction({ type: "tribute_select", card_id: guandanSelected[0] });
    guandanSelected = [];
    updateGuandanSelected();
    if (currentGuandanView) {
      renderGuandanHand(currentGuandanView);
      renderGuandanPile(currentGuandanView);
      updateGuandanButtons();
    }
  });
}

if (guandanReturnBtn) {
  guandanReturnBtn.addEventListener("click", () => {
    if (guandanSelected.length !== 1) return;
    sendAction({ type: "return_select", card_id: guandanSelected[0] });
    guandanSelected = [];
    updateGuandanSelected();
    if (currentGuandanView) {
      renderGuandanHand(currentGuandanView);
      renderGuandanPile(currentGuandanView);
      updateGuandanButtons();
    }
  });
}

if (guandanNextRoundBtn) {
  guandanNextRoundBtn.addEventListener("click", () => {
    sendAction({ type: "next_round" });
  });
}

if (guandanPlayAgainBtn) {
  guandanPlayAgainBtn.addEventListener("click", () => {
    sendAction({ type: "play_again" });
  });
}

if (guandanPanelEl) {
  guandanPanelEl.addEventListener("click", (e) => {
    if (guandanExplainMode) return;
    if (e.target.closest("button") || e.target.closest(".slot")) return;
    guandanSelected = [];
    updateGuandanSelected();
    if (currentGuandanView) {
      renderGuandanHand(currentGuandanView);
      renderGuandanPile(currentGuandanView);
      updateGuandanButtons();
    }
  });
}

if (guandanHelpBtn) {
  guandanHelpBtn.addEventListener("click", () => {
    showGuandanHelpModal();
  });
}

if (guandanHelpModalCloseBtn) {
  guandanHelpModalCloseBtn.addEventListener("click", closeGuandanHelpModal);
}

if (guandanExplainBtn) {
  guandanExplainBtn.addEventListener("click", () => {
    toggleGuandanExplainMode();
  });
}

if (guandanExplainModalCloseBtn) {
  guandanExplainModalCloseBtn.addEventListener("click", closeGuandanExplainModal);
}

if (guandanBotExplainModalCloseBtn) {
  guandanBotExplainModalCloseBtn.addEventListener("click", () => {
    if (guandanBotExplainModal) {
      setModalVisible(guandanBotExplainModal, false);
    }
  });
}

document.addEventListener("pointerdown", (e) => {
  if (!guandanExplainMode) return;

  const buttonId = findGuandanButtonAtPoint(e.clientX, e.clientY);
  if (buttonId) {
    e.preventDefault();
    e.stopPropagation();
    showGuandanButtonExplanation(buttonId);
    exitGuandanExplainMode();
    return;
  }

  const button = e.target.closest("button");
  if (button === guandanExplainBtn || button === guandanHelpBtn) return;
  if (button === guandanHelpModalCloseBtn || button === guandanExplainModalCloseBtn) return;

  if (button) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

document.addEventListener("click", (e) => {
  if (!guandanExplainMode) return;
  const button = e.target.closest("button");
  if (!button) return;
  if (button === guandanExplainBtn || button === guandanHelpBtn) return;
  if (button === guandanHelpModalCloseBtn || button === guandanExplainModalCloseBtn) return;
  e.preventDefault();
  e.stopPropagation();
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && guandanExplainMode) {
    exitGuandanExplainMode();
  }
});
