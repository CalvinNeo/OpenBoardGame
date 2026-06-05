let currentCenturyView = null;
let centuryExplainMode = false;

const centuryPanel = document.getElementById("centurySpiceRoadPanel");
const centuryPhase = document.getElementById("centuryPhase");
const centuryTurn = document.getElementById("centuryTurn");
const centuryDecks = document.getElementById("centuryDecks");
const centuryCoins = document.getElementById("centuryCoins");
const centuryPrompt = document.getElementById("centuryPrompt");
const centuryPointMarket = document.getElementById("centuryPointMarket");
const centuryMerchantMarket = document.getElementById("centuryMerchantMarket");
const centuryYou = document.getElementById("centuryYou");
const centuryActions = document.getElementById("centuryActions");
const centuryPlayers = document.getElementById("centuryPlayers");
const centuryHeaderActions = document.getElementById("centuryHeaderActions");
const centuryHelpBtn = document.getElementById("centuryHelpBtn");
const centuryExplainBtn = document.getElementById("centuryExplainBtn");
const centuryHelpModal = document.getElementById("centuryHelpModal");
const centuryHelpModalCloseBtn = document.getElementById("centuryHelpModalCloseBtn");
const centuryHelpContent = document.getElementById("centuryHelpContent");
const centuryExplainModal = document.getElementById("centuryExplainModal");
const centuryExplainModalCloseBtn = document.getElementById("centuryExplainModalCloseBtn");
const centuryExplainContent = document.getElementById("centuryExplainContent");

const CENTURY_SPICE_LABELS = {
  yellow: "🟨",
  red: "🟥",
  green: "🟩",
  brown: "🟫",
};

const CENTURY_HELP_HTML = `
  <h3>Goal</h3>
  <p>Build a spice engine, claim point cards, and finish with the highest total.</p>

  <h3>Turn</h3>
  <ul>
    <li><strong>Play</strong>: play one merchant card. Production gains spices, upgrade cards improve spices, trade cards may repeat.</li>
    <li><strong>Acquire</strong>: take one merchant card. Cards to its left each receive one spice from you.</li>
    <li><strong>Rest</strong>: return all played merchant cards to your hand.</li>
    <li><strong>Claim</strong>: pay spices for one point card. The first two slots may award 🪙 or ⚪.</li>
  </ul>

  <h3>Important</h3>
  <ul>
    <li>Your caravan holds 10 spices. If you exceed 10, you must discard down before the next turn.</li>
    <li>In 2-3 player games, the end triggers at 6 point cards. In 4-5 player games, it triggers at 5.</li>
    <li>Final score is point cards + 🪙x3 + ⚪x1 + every non-yellow spice.</li>
  </ul>
`;

function centuryCan(view, action) {
  return Array.isArray(view && view.legal_actions) && view.legal_actions.includes(action);
}

function centurySelf(view) {
  return (view && Array.isArray(view.players) ? view.players : []).find((player) => player.player_id === view.you) || null;
}

function centuryPlayerName(view, playerId) {
  const player = (view.players || []).find((entry) => entry.player_id === playerId);
  return player ? player.name || player.player_id : playerId || "-";
}

function centurySpiceText(counts, includeZeros = false) {
  const parts = [];
  Object.keys(CENTURY_SPICE_LABELS).forEach((color) => {
    const amount = Number((counts || {})[color] || 0);
    if (amount || includeZeros) {
      parts.push(`${CENTURY_SPICE_LABELS[color]}×${amount}`);
    }
  });
  return parts.length ? parts.join(" ") : "-";
}

function centuryCardCostText(card) {
  return centurySpiceText(card && card.cost);
}

function centuryCardGainText(card) {
  return centurySpiceText(card && card.gain);
}

function centuryExplain(node, title, description, details = []) {
  if (!node) return node;
  node.dataset.centuryExplain = "1";
  node.dataset.centuryExplainTitle = title || "Explanation";
  node.dataset.centuryExplainDescription = description || "";
  node.dataset.centuryExplainDetails = JSON.stringify(details);
  if (centuryExplainMode) node.classList.add("has-explanation");
  return node;
}

function showCenturyExplanationFromNode(node) {
  if (!node || !centuryExplainModal || !centuryExplainContent) return;
  const details = JSON.parse(node.dataset.centuryExplainDetails || "[]");
  centuryExplainContent.innerHTML = `
    <h4>${node.dataset.centuryExplainTitle || "Explanation"}</h4>
    <p>${node.dataset.centuryExplainDescription || ""}</p>
    ${details.length ? `<ul>${details.map((item) => `<li>${item}</li>`).join("")}</ul>` : ""}
  `;
  setModalVisible(centuryExplainModal, true);
}

function updateCenturyExplainClasses() {
  if (!centuryPanel) return;
  centuryPanel.querySelectorAll("[data-century-explain]").forEach((node) => {
    node.classList.toggle("has-explanation", centuryExplainMode);
  });
}

function toggleCenturyExplainMode() {
  centuryExplainMode = !centuryExplainMode;
  document.body.classList.toggle("century-explain-mode", centuryExplainMode);
  if (centuryExplainBtn) centuryExplainBtn.classList.toggle("active", centuryExplainMode);
  updateCenturyExplainClasses();
}

function showCenturyHeaderActions(show) {
  if (centuryHeaderActions) centuryHeaderActions.style.display = show ? "flex" : "none";
  if (!show) {
    centuryExplainMode = false;
    document.body.classList.remove("century-explain-mode");
    if (centuryExplainBtn) centuryExplainBtn.classList.remove("active");
    if (centuryHelpModal) setModalVisible(centuryHelpModal, false);
    if (centuryExplainModal) setModalVisible(centuryExplainModal, false);
  }
}

function clearCenturyState() {
  currentCenturyView = null;
  centuryExplainMode = false;
  document.body.classList.remove("century-explain-mode");
  if (centuryExplainBtn) centuryExplainBtn.classList.remove("active");
  if (centuryPhase) centuryPhase.textContent = "-";
  if (centuryTurn) centuryTurn.textContent = "-";
  if (centuryDecks) centuryDecks.textContent = "-";
  if (centuryCoins) centuryCoins.textContent = "-";
  if (centuryPrompt) centuryPrompt.textContent = "Waiting for state…";
  if (centuryPointMarket) centuryPointMarket.innerHTML = "";
  if (centuryMerchantMarket) centuryMerchantMarket.innerHTML = "";
  if (centuryYou) centuryYou.innerHTML = "";
  if (centuryActions) centuryActions.innerHTML = "";
  if (centuryPlayers) centuryPlayers.innerHTML = "";
  if (centuryHelpModal) setModalVisible(centuryHelpModal, false);
  if (centuryExplainModal) setModalVisible(centuryExplainModal, false);
}

function centuryButton(text, onClick, disabled = false, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.disabled = disabled;
  if (className) button.className = className;
  button.addEventListener("click", onClick);
  return button;
}

function centuryNumberInput(value, min, max) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.value = String(value);
  input.className = "century-number";
  return input;
}

function renderCenturyPointMarket(view) {
  centuryPointMarket.innerHTML = "";
  (view.point_market || []).forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "century-card century-point-card";
    const bonus = view.gold_remaining > 0 && index === 0
      ? "🪙"
      : view.gold_remaining > 0 && index === 1 && view.silver_remaining > 0
        ? "⚪"
        : view.gold_remaining <= 0 && index === 0 && view.silver_remaining > 0
          ? "⚪"
          : "";
    button.innerHTML = `
      <strong>${card.points} VP ${bonus}</strong>
      <span>${centuryCardCostText(card)}</span>
      <small>Slot ${index + 1}</small>
    `;
    button.disabled = !centuryCan(view, "claim");
    button.addEventListener("click", () => sendAction({ type: "claim", index }));
    centuryExplain(button, "Point Card", "Claim this card by paying its spice cost.", [
      `Cost: ${centuryCardCostText(card)}`,
      `Printed value: ${card.points} VP`,
      bonus ? `This slot awards ${bonus}.` : "This slot has no coin bonus.",
    ]);
    centuryPointMarket.appendChild(button);
  });
}

function renderCenturyMerchantMarket(view) {
  centuryMerchantMarket.innerHTML = "";
  (view.merchant_market || []).forEach((slot, index) => {
    const card = slot.card;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "century-card century-merchant-card";
    button.innerHTML = `
      <strong>${card.label}</strong>
      <span>On card: ${centurySpiceText(slot.spices)}</span>
      <small>Cost: ${index === 0 ? "Free" : `${index} spice`}</small>
    `;
    button.disabled = !centuryCan(view, "acquire");
    button.addEventListener("click", () => renderCenturyAcquireForm(view, index));
    centuryExplain(button, "Merchant Card", "Acquire this card into your hand. Cards farther right cost more spices.", [
      `Acquire cost: ${index === 0 ? "Free" : `${index} total spice placed on cards to the left.`}`,
      `Effect: ${card.label}`,
      `Spices waiting on this card: ${centurySpiceText(slot.spices)}`,
    ]);
    centuryMerchantMarket.appendChild(button);
  });
}

function renderCenturyYou(view) {
  const you = centurySelf(view);
  if (!you) {
    centuryYou.innerHTML = "";
    return;
  }
  centuryYou.innerHTML = `
    <div class="century-player-header">
      <strong>${you.name || "You"}</strong>
      <span>${centurySpiceText(you.spices, true)} (${Object.values(you.spices || {}).reduce((a, b) => a + Number(b || 0), 0)}/10)</span>
    </div>
    <div>Coins: 🪙×${you.gold} ⚪×${you.silver} · Score now: ${you.score}</div>
    <div>Claimed: ${(you.claimed_points || []).map((card) => `${card.points}VP`).join(", ") || "-"}</div>
    <h4>Hand</h4>
    <div class="century-card-row century-hand"></div>
    <h4>Played</h4>
    <div class="century-card-row century-played"></div>
  `;
  const hand = centuryYou.querySelector(".century-hand");
  (you.hand || []).forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "century-card century-hand-card";
    button.innerHTML = `<strong>${card.label}</strong><small>${card.type}</small>`;
    button.disabled = !centuryCan(view, "play");
    button.addEventListener("click", () => renderCenturyPlayForm(view, card));
    centuryExplain(button, "Hand Card", "Play one merchant card as your turn action.", [`Effect: ${card.label}`]);
    hand.appendChild(button);
  });
  const played = centuryYou.querySelector(".century-played");
  (you.played_cards || []).forEach((card) => {
    const div = document.createElement("div");
    div.className = "century-card century-played-card";
    div.innerHTML = `<strong>${card.label}</strong><small>${card.type}</small>`;
    played.appendChild(div);
  });
}

function renderCenturyPlayers(view) {
  centuryPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const div = document.createElement("div");
    div.className = "century-player-card";
    if (player.player_id === view.current_turn) div.classList.add("current");
    if (player.player_id === view.you) div.classList.add("self");
    div.innerHTML = `
      <div class="century-player-header">
        <strong>${player.name || player.player_id}</strong>
        <span>${player.score} pts</span>
      </div>
      <div>${centurySpiceText(player.spices, true)}</div>
      <div>Hand ${player.hand_count} · Played ${(player.played_cards || []).length} · Claimed ${(player.claimed_points || []).length}</div>
      <div>🪙×${player.gold} ⚪×${player.silver}</div>
    `;
    centuryExplain(div, "Player Summary", "Public player information.", [
      "Hands are hidden from other players except for card count.",
      "Played cards, spices, coins, claimed cards, and current score are public here.",
    ]);
    centuryPlayers.appendChild(div);
  });
}

function maxCenturyTradeTimes(player, card) {
  let maxTimes = Infinity;
  Object.keys(CENTURY_SPICE_LABELS).forEach((color) => {
    const need = Number((card.cost || {})[color] || 0);
    if (need > 0) {
      maxTimes = Math.min(maxTimes, Math.floor(Number((player.spices || {})[color] || 0) / need));
    }
  });
  return maxTimes === Infinity ? 0 : maxTimes;
}

function renderCenturyPlayForm(view, card) {
  const you = centurySelf(view);
  centuryActions.innerHTML = "";
  const form = document.createElement("div");
  form.className = "century-action-form";
  form.innerHTML = `<div class="century-action-title">Play: <strong>${card.label}</strong></div>`;
  if (card.type === "upgrade") {
    const wrap = document.createElement("div");
    wrap.className = "century-pay-grid";
    const upgrades = [];
    const preview = { ...(you.spices || {}) };
    const sequenceLabel = document.createElement("div");
    sequenceLabel.className = "century-selection-label";
    const refreshUpgradeButtons = () => {
      sequenceLabel.textContent = `Sequence: ${upgrades.map((color) => CENTURY_SPICE_LABELS[color]).join(" → ") || "-"}`;
      wrap.querySelectorAll("button[data-upgrade-color]").forEach((button) => {
        const color = button.dataset.upgradeColor;
        button.disabled = upgrades.length >= Number(card.upgrade_steps || 0) || Number(preview[color] || 0) <= 0;
      });
    };
    ["yellow", "red", "green"].forEach((color) => {
      const button = centuryButton(`${CENTURY_SPICE_LABELS[color]} Up`, () => {
        if (upgrades.length >= Number(card.upgrade_steps || 0) || Number(preview[color] || 0) <= 0) return;
        const nextColor = Object.keys(CENTURY_SPICE_LABELS)[Object.keys(CENTURY_SPICE_LABELS).indexOf(color) + 1];
        preview[color] = Number(preview[color] || 0) - 1;
        preview[nextColor] = Number(preview[nextColor] || 0) + 1;
        upgrades.push(color);
        refreshUpgradeButtons();
      });
      button.dataset.upgradeColor = color;
      wrap.appendChild(button);
    });
    const resetBtn = centuryButton("Reset", () => renderCenturyPlayForm(view, card));
    wrap.appendChild(resetBtn);
    form.appendChild(wrap);
    form.appendChild(sequenceLabel);
    refreshUpgradeButtons();
    form.appendChild(centuryButton("Play", () => {
      sendAction({ type: "play", card_id: card.id, upgrades });
    }));
  } else if (card.type === "trade") {
    const maxTimes = maxCenturyTradeTimes(you, card);
    const label = document.createElement("label");
    label.className = "century-inline";
    const input = centuryNumberInput(Math.min(1, maxTimes), 0, maxTimes);
    label.append(`Times (0-${maxTimes})`);
    label.appendChild(input);
    form.appendChild(label);
    form.appendChild(centuryButton("Play", () => {
      sendAction({ type: "play", card_id: card.id, times: Number(input.value || 0) });
    }));
  } else {
    form.appendChild(centuryButton("Play", () => sendAction({ type: "play", card_id: card.id })));
  }
  centuryActions.appendChild(form);
}

function renderCenturyAcquireForm(view, index) {
  const you = centurySelf(view);
  centuryActions.innerHTML = "";
  const form = document.createElement("div");
  form.className = "century-action-form";
  form.innerHTML = `<div class="century-action-title">Acquire merchant card in slot ${index + 1}</div>`;
  const selects = [];
  if (index > 0) {
    const wrap = document.createElement("div");
    wrap.className = "century-pay-grid";
    for (let i = 0; i < index; i += 1) {
      const label = document.createElement("label");
      label.append(`Left slot ${i + 1}`);
      const select = document.createElement("select");
      Object.keys(CENTURY_SPICE_LABELS).forEach((color) => {
        const option = document.createElement("option");
        option.value = color;
        option.textContent = `${CENTURY_SPICE_LABELS[color]} ${color}`;
        option.disabled = Number((you.spices || {})[color] || 0) <= 0;
        select.appendChild(option);
      });
      selects.push(select);
      label.appendChild(select);
      wrap.appendChild(label);
    }
    form.appendChild(wrap);
  }
  form.appendChild(centuryButton("Acquire", () => {
    sendAction({ type: "acquire", index, payments: selects.map((select) => select.value) });
  }));
  centuryActions.appendChild(form);
}

function renderCenturyDiscardForm(view) {
  const you = centurySelf(view);
  centuryActions.innerHTML = "";
  const form = document.createElement("div");
  form.className = "century-action-form";
  form.innerHTML = `<div class="century-action-title">Discard ${view.discard_needed} spice</div>`;
  const inputs = {};
  const wrap = document.createElement("div");
  wrap.className = "century-pay-grid";
  Object.keys(CENTURY_SPICE_LABELS).forEach((color) => {
    const label = document.createElement("label");
    const input = centuryNumberInput(0, 0, Number((you.spices || {})[color] || 0));
    inputs[color] = input;
    label.append(`${CENTURY_SPICE_LABELS[color]}`);
    label.appendChild(input);
    wrap.appendChild(label);
  });
  form.appendChild(wrap);
  form.appendChild(centuryButton("Discard", () => {
    const spices = {};
    Object.keys(CENTURY_SPICE_LABELS).forEach((color) => {
      spices[color] = Number(inputs[color].value || 0);
    });
    sendAction({ type: "discard", spices });
  }));
  centuryActions.appendChild(form);
}

function renderCenturyDefaultActions(view) {
  if (view.phase === "discard" && view.discard_player === view.you) {
    renderCenturyDiscardForm(view);
    return;
  }
  centuryActions.innerHTML = "";
  if (centuryCan(view, "rest")) {
    const restBtn = centuryButton("Rest", () => sendAction({ type: "rest" }));
    centuryExplain(restBtn, "Rest", "Return all played merchant cards to your hand.");
    centuryActions.appendChild(restBtn);
  }
  if (!centuryActions.children.length) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = view.current_turn === view.you ? "Choose a card or market slot above." : "Waiting for another player.";
    centuryActions.appendChild(hint);
  }
}

function renderCenturyGameState(payload) {
  const view = payload.view || payload.state || payload;
  currentCenturyView = view;
  const currentName = centuryPlayerName(view, view.current_turn);
  if (centuryPhase) centuryPhase.textContent = view.phase || "-";
  if (centuryTurn) centuryTurn.textContent = currentName;
  if (centuryDecks) centuryDecks.textContent = `Merchants ${view.merchant_deck_count}, Points ${view.point_deck_count}`;
  if (centuryCoins) centuryCoins.textContent = `🪙×${view.gold_remaining} ⚪×${view.silver_remaining}`;
  if (centuryPrompt) {
    if (view.game_over) {
      centuryPrompt.textContent = `Game over. Winner: ${(view.winner || []).map((pid) => centuryPlayerName(view, pid)).join(", ") || "-"}`;
    } else if (view.phase === "discard") {
      centuryPrompt.textContent = `${centuryPlayerName(view, view.discard_player)} must discard ${view.discard_needed} spice.`;
    } else if (view.end_triggered) {
      centuryPrompt.textContent = `Final round is active. Last player: ${centuryPlayerName(view, view.final_player)}.`;
    } else {
      centuryPrompt.textContent = `${currentName} chooses one action.`;
    }
  }
  renderCenturyPointMarket(view);
  renderCenturyMerchantMarket(view);
  renderCenturyYou(view);
  renderCenturyPlayers(view);
  renderCenturyDefaultActions(view);
  updateCenturyExplainClasses();
}

if (centuryHelpBtn) {
  centuryHelpBtn.addEventListener("click", () => {
    if (centuryHelpContent) centuryHelpContent.innerHTML = CENTURY_HELP_HTML;
    if (centuryHelpModal) setModalVisible(centuryHelpModal, true);
  });
}
if (centuryHelpModalCloseBtn) {
  centuryHelpModalCloseBtn.addEventListener("click", () => setModalVisible(centuryHelpModal, false));
}
if (centuryExplainBtn) {
  centuryExplainBtn.addEventListener("click", toggleCenturyExplainMode);
}
if (centuryExplainModalCloseBtn) {
  centuryExplainModalCloseBtn.addEventListener("click", () => setModalVisible(centuryExplainModal, false));
}
if (centuryPanel) {
  centuryPanel.addEventListener("click", (event) => {
    if (!centuryExplainMode) return;
    const target = event.target && event.target.closest ? event.target.closest("[data-century-explain]") : null;
    if (!target || target === centuryExplainBtn || target === centuryHelpBtn) return;
    event.preventDefault();
    event.stopPropagation();
    showCenturyExplanationFromNode(target);
  }, true);
}
