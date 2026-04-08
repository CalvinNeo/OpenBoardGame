let currentGuandanView = null;
let guandanSelected = [];
let guandanExplainMode = false;

const guandanPhaseLabel = document.getElementById("guandanPhase");
const guandanRoundLabel = document.getElementById("guandanRound");
const guandanTurnLabel = document.getElementById("guandanTurn");
const guandanDealerLabel = document.getElementById("guandanDealer");
const guandanLevelLabel = document.getElementById("guandanLevel");
const guandanTrickLabel = document.getElementById("guandanTrick");
const guandanTributeLabel = document.getElementById("guandanTribute");
const guandanSelectedLabel = document.getElementById("guandanSelected");
const guandanHandEl = document.getElementById("guandanHand");
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
const guandanTributeBtn = document.getElementById("guandanTributeBtn");
const guandanReturnBtn = document.getElementById("guandanReturnBtn");
const guandanNextRoundBtn = document.getElementById("guandanNextRoundBtn");
const guandanPlayAgainBtn = document.getElementById("guandanPlayAgainBtn");

function clearGuandanState() {
  currentGuandanView = null;
  guandanSelected = [];
  updateGuandanSelected();
  if (guandanHandEl) {
    guandanHandEl.textContent = "-";
  }
  if (guandanPlayersEl) {
    guandanPlayersEl.textContent = "-";
  }
}

function updateGuandanSelected() {
  if (guandanSelectedLabel) {
    if (!guandanSelected.length) {
      guandanSelectedLabel.textContent = "-";
      return;
    }
    if (!currentGuandanView || !Array.isArray(currentGuandanView.players)) {
      guandanSelectedLabel.textContent = guandanSelected.join(", ");
      return;
    }
    const you = currentGuandanView.players.find((p) => p.player_id === currentGuandanView.you);
    if (!you || !Array.isArray(you.hand)) {
      guandanSelectedLabel.textContent = guandanSelected.join(", ");
      return;
    }
    const labelMap = new Map(you.hand.map((card) => [card.id, card.label]));
    const labels = guandanSelected.map((id) => labelMap.get(id) || id);
    guandanSelectedLabel.textContent = labels.join(", ");
  }
}

function updateGuandanButtons() {
  if (!currentGuandanView) {
    [guandanPlayBtn, guandanPassBtn, guandanTributeBtn, guandanReturnBtn, guandanNextRoundBtn, guandanPlayAgainBtn].forEach(
      (btn) => {
        if (btn) btn.disabled = true;
      }
    );
    return;
  }
  const legal = Array.isArray(currentGuandanView.legal_actions) ? currentGuandanView.legal_actions : [];
  if (guandanPlayBtn) {
    guandanPlayBtn.disabled = !(legal.includes("play") && guandanSelected.length >= 1);
  }
  if (guandanPassBtn) {
    guandanPassBtn.disabled = !legal.includes("pass");
  }
  if (guandanTributeBtn) {
    guandanTributeBtn.disabled = !(legal.includes("tribute_select") && guandanSelected.length === 1);
  }
  if (guandanReturnBtn) {
    guandanReturnBtn.disabled = !(legal.includes("return_select") && guandanSelected.length === 1);
  }
  if (guandanNextRoundBtn) {
    guandanNextRoundBtn.disabled = !legal.includes("next_round");
  }
  if (guandanPlayAgainBtn) {
    guandanPlayAgainBtn.disabled = !legal.includes("play_again");
  }
}

function renderGuandanHand(view) {
  if (!guandanHandEl) return;
  guandanHandEl.innerHTML = "";
  const you = Array.isArray(view.players) ? view.players.find((p) => p.player_id === view.you) : null;
  if (!you || !Array.isArray(you.hand)) {
    guandanHandEl.textContent = "-";
    return;
  }
  you.hand.forEach((card) => {
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
  renderGuandanTribute(view);
  renderGuandanHand(view);
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

if (guandanPlayBtn) {
  guandanPlayBtn.addEventListener("click", () => {
    if (!guandanSelected.length) return;
    sendAction({ type: "play", card_ids: guandanSelected });
    guandanSelected = [];
    updateGuandanSelected();
  });
}

if (guandanPassBtn) {
  guandanPassBtn.addEventListener("click", () => {
    sendAction({ type: "pass" });
  });
}

if (guandanTributeBtn) {
  guandanTributeBtn.addEventListener("click", () => {
    if (guandanSelected.length !== 1) return;
    sendAction({ type: "tribute_select", card_id: guandanSelected[0] });
    guandanSelected = [];
    updateGuandanSelected();
  });
}

if (guandanReturnBtn) {
  guandanReturnBtn.addEventListener("click", () => {
    if (guandanSelected.length !== 1) return;
    sendAction({ type: "return_select", card_id: guandanSelected[0] });
    guandanSelected = [];
    updateGuandanSelected();
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
