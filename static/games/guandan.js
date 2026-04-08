let currentGuandanView = null;
let guandanSelected = [];
let guandanExplainMode = false;
let guandanPiles = [];
let guandanLastSfKey = null;
let guandanHandLayout = "cascade";
let guandanCascadeLayoutFrame = null;

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

function clearGuandanState() {
  currentGuandanView = null;
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
      guandanSelected = group.cards.map((card) => card.id);
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
  const rows = view.players
    .map((player) => {
      const entry = playsById.get(player.player_id);
      const cards = entry && Array.isArray(entry.cards) && entry.cards.length ? entry.cards.join(" ") : "-";
      return `
        <tr>
          <td>${player.name || player.player_id}</td>
          <td>${player.hand_count ?? "-"}</td>
          <td>${cards}</td>
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
}

function renderGuandanTribute(view) {
  if (!guandanTributeLabel) return;
  if (!view.tribute) {
    guandanTributeLabel.textContent = "-";
    return;
  }
  const tribute = view.tribute;
  guandanTributeLabel.textContent = `${tribute.stage} ${tribute.type} | payers: ${tribute.payers.join(
    ", "
  )} | receivers: ${tribute.receivers.join(", ")}`;
}

function renderGuandanGameState(data) {
  const view = data.view;
  if (!view) return;
  currentGuandanView = view;
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
    if (guandanLastSfKey) {
      const found = list.findIndex((entry) => entry.key === guandanLastSfKey);
      if (found >= 0) {
        idx = (found + 1) % list.length;
      }
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
