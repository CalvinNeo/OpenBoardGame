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

const CENTURY_SPICE_META = {
  yellow: { name: "Yellow", spice: "Turmeric", short: "Y" },
  red: { name: "Red", spice: "Saffron", short: "R" },
  green: { name: "Green", spice: "Cardamom", short: "G" },
  brown: { name: "Brown", spice: "Cinnamon", short: "B" },
};
const CENTURY_SPICE_ORDER = Object.keys(CENTURY_SPICE_META);

const CENTURY_CARD_META = {
  spice: { label: "PRODUCE", className: "produce", hint: "Take spices" },
  trade: { label: "CONVERT", className: "convert", hint: "Repeatable recipe" },
  upgrade: { label: "WILD UPGRADE", className: "upgrade", hint: "Flexible steps" },
};

const CENTURY_HELP_HTML = `
  <h3>Goal</h3>
  <p>Build a spice engine, claim point cards, and finish with the highest total.</p>

  <h3>Turn</h3>
  <ul>
    <li><strong>Play</strong>: play one merchant card. <strong>Produce</strong> takes spices, <strong>Convert</strong> runs a repeatable recipe, and <strong>Wild Upgrade</strong> moves any spice up the value track.</li>
    <li><strong>Acquire</strong>: take one merchant card. Cards to its left each receive one spice from you.</li>
    <li><strong>Rest</strong>: return all played merchant cards to your hand.</li>
    <li><strong>Claim</strong>: pay spices for one point card. The first two slots may award a Gold or Silver coin.</li>
  </ul>

  <h3>Important</h3>
  <ul>
    <li>Your caravan holds 10 spices. If you exceed 10, you must discard down before the next turn.</li>
    <li>In 2-3 player games, the end triggers at 6 point cards. In 4-5 player games, it triggers at 5.</li>
    <li>Final score is point cards + Gold coins x3 + Silver coins x1 + every non-yellow spice.</li>
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

function centuryEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function centurySpicePlainText(counts, includeZeros = false) {
  const parts = [];
  CENTURY_SPICE_ORDER.forEach((color) => {
    const amount = Number((counts || {})[color] || 0);
    if (amount || includeZeros) {
      parts.push(`${CENTURY_SPICE_META[color].name} x${amount}`);
    }
  });
  return parts.length ? parts.join(" ") : "-";
}

function centurySpiceGemMarkup(color, extraClass = "") {
  const meta = CENTURY_SPICE_META[color];
  if (!meta) return "";
  return `<span class="century-spice-gem century-spice-gem--${color} ${extraClass}" aria-hidden="true">${meta.short}</span>`;
}

function centurySpiceMarkup(counts, includeZeros = false, extraClass = "") {
  const tokens = [];
  CENTURY_SPICE_ORDER.forEach((color) => {
    const amount = Number((counts || {})[color] || 0);
    if (!amount && !includeZeros) return;
    const meta = CENTURY_SPICE_META[color];
    tokens.push(`
      <span class="century-spice-token century-spice-token--${color} ${amount ? "" : "is-zero"}"
            title="${meta.spice} (${meta.name})" aria-label="${meta.name} spice, ${amount}">
        ${centurySpiceGemMarkup(color)}
        <span class="century-spice-count" aria-hidden="true">${amount}</span>
      </span>
    `);
  });
  if (!tokens.length) return '<span class="century-empty-value">None</span>';
  return `<span class="century-spice-list ${extraClass}">${tokens.join("")}</span>`;
}

function centuryScaleSpices(counts, multiplier) {
  const scaled = {};
  CENTURY_SPICE_ORDER.forEach((color) => {
    scaled[color] = Number((counts || {})[color] || 0) * Number(multiplier || 0);
  });
  return scaled;
}

function centuryCoinMarkup(kind, amount, showName = true) {
  const isGold = kind === "gold";
  const name = isGold ? "Gold" : "Silver";
  const count = Number(amount || 0);
  return `
    <span class="century-coin-token century-coin-token--${isGold ? "gold" : "silver"}" aria-label="${name} coins, ${count}">
      <span class="century-coin-mark" aria-hidden="true">${isGold ? "G" : "S"}</span>
      ${showName ? `<span class="century-coin-name">${name}</span>` : ""}
      <strong aria-hidden="true">x${count}</strong>
    </span>
  `;
}

function centuryCardTypeClass(card) {
  const meta = CENTURY_CARD_META[(card || {}).type] || CENTURY_CARD_META.trade;
  return `century-card--${meta.className}`;
}

function centuryMerchantPlainText(card) {
  if (!card) return "Merchant card";
  if (card.type === "spice") {
    return `Produce: take ${centurySpicePlainText(card.gain)}`;
  }
  if (card.type === "upgrade") {
    const steps = Number(card.upgrade_steps || 0);
    return `Wild Upgrade: use up to ${steps} flexible ${steps === 1 ? "step" : "steps"}`;
  }
  if (card.type === "trade") {
    return `Convert ${centurySpicePlainText(card.cost)} into ${centurySpicePlainText(card.gain)}`;
  }
  return "Merchant card";
}

function centuryUpgradeTrackMarkup() {
  return `
    <div class="century-upgrade-track" aria-label="Yellow upgrades to Red, then Green, then Brown">
      ${CENTURY_SPICE_ORDER.map((color, index) => `
        ${centurySpiceGemMarkup(color, "century-spice-gem--track")}
        ${index < CENTURY_SPICE_ORDER.length - 1 ? '<span class="century-track-arrow" aria-hidden="true"></span>' : ""}
      `).join("")}
    </div>
  `;
}

function centuryMerchantCardMarkup(card) {
  const meta = CENTURY_CARD_META[(card || {}).type] || CENTURY_CARD_META.trade;
  let effect = "";
  if (card.type === "spice") {
    effect = `
      <div class="century-card-effect century-produce-effect">
        <span class="century-effect-label">TAKE</span>
        ${centurySpiceMarkup(card.gain)}
      </div>
    `;
  } else if (card.type === "upgrade") {
    const steps = Number(card.upgrade_steps || 0);
    effect = `
      <div class="century-card-effect century-upgrade-effect">
        ${centuryUpgradeTrackMarkup()}
        <strong>${steps} flexible ${steps === 1 ? "step" : "steps"}</strong>
        <span>Move any spice one level per step</span>
      </div>
    `;
  } else {
    effect = `
      <div class="century-card-effect century-convert-effect">
        <div class="century-recipe-side century-recipe-cost">
          <span class="century-effect-label">GIVE</span>
          ${centurySpiceMarkup(card.cost)}
        </div>
        <span class="century-recipe-arrow" aria-hidden="true"></span>
        <div class="century-recipe-side century-recipe-gain">
          <span class="century-effect-label">GET</span>
          ${centurySpiceMarkup(card.gain)}
        </div>
      </div>
    `;
  }
  return `
    <div class="century-card-heading">
      <span class="century-card-kind"><span class="century-kind-mark" aria-hidden="true"></span>${meta.label}</span>
      <span class="century-card-hint">${meta.hint}</span>
    </div>
    ${effect}
  `;
}

function centuryPointBonus(view, index) {
  if (view.gold_remaining > 0 && index === 0) return "gold";
  if (view.gold_remaining > 0 && view.silver_remaining > 0 && index === 1) return "silver";
  if (view.gold_remaining <= 0 && view.silver_remaining > 0 && index === 0) return "silver";
  return null;
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
  setCenturyExplainMode(false);
}

function updateCenturyExplainClasses() {
  if (!centuryPanel) return;
  centuryPanel.querySelectorAll("[data-century-explain]").forEach((node) => {
    node.classList.toggle("has-explanation", centuryExplainMode);
  });
}

function setCenturyExplainMode(enabled) {
  centuryExplainMode = Boolean(enabled);
  document.body.classList.toggle("century-explain-mode", centuryExplainMode);
  if (centuryExplainBtn) {
    centuryExplainBtn.classList.toggle("active", centuryExplainMode);
    centuryExplainBtn.setAttribute("aria-pressed", String(centuryExplainMode));
  }
  updateCenturyExplainClasses();
}

function toggleCenturyExplainMode() {
  setCenturyExplainMode(!centuryExplainMode);
}

function showCenturyHeaderActions(show) {
  if (centuryHeaderActions) centuryHeaderActions.style.display = show ? "flex" : "none";
  if (!show) {
    setCenturyExplainMode(false);
    if (centuryHelpModal) setModalVisible(centuryHelpModal, false);
    if (centuryExplainModal) setModalVisible(centuryExplainModal, false);
  }
}

function clearCenturyState() {
  currentCenturyView = null;
  setCenturyExplainMode(false);
  if (centuryPhase) centuryPhase.textContent = "-";
  if (centuryTurn) centuryTurn.textContent = "-";
  if (centuryDecks) centuryDecks.textContent = "-";
  if (centuryCoins) centuryCoins.textContent = "-";
  if (centuryPrompt) centuryPrompt.textContent = "Waiting for state…";
  if (centuryPointMarket) centuryPointMarket.innerHTML = "";
  if (centuryMerchantMarket) centuryMerchantMarket.innerHTML = "";
  if (centuryYou) centuryYou.innerHTML = "";
  if (centuryActions) {
    centuryActions.innerHTML = "";
    centuryActions.hidden = true;
    centuryActions.classList.remove("is-open", "is-required");
  }
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

function centuryClearActionSelection() {
  if (!centuryPanel) return;
  centuryPanel.querySelectorAll('[aria-controls="centuryActions"]').forEach((node) => {
    node.classList.remove("is-selected");
    node.setAttribute("aria-expanded", "false");
  });
}

function centuryCloseActionDrawer() {
  centuryClearActionSelection();
  if (!centuryActions) return;
  centuryActions.innerHTML = "";
  centuryActions.hidden = true;
  centuryActions.classList.remove("is-open", "is-required");
  centuryActions.style.removeProperty("--century-drawer-pointer-x");
}

function centuryOpenActionDrawer(form, sourceButton = null, required = false) {
  if (!centuryActions || !form) return;
  centuryClearActionSelection();
  centuryActions.replaceChildren(form);
  centuryActions.hidden = false;
  centuryActions.classList.add("is-open");
  centuryActions.classList.toggle("is-required", required);
  if (sourceButton) {
    sourceButton.classList.add("is-selected");
    sourceButton.setAttribute("aria-expanded", "true");
    window.requestAnimationFrame(() => {
      const sourceBounds = sourceButton.getBoundingClientRect();
      const drawerBounds = centuryActions.getBoundingClientRect();
      const pointerX = sourceBounds.left + sourceBounds.width / 2 - drawerBounds.left;
      const clampedPointerX = Math.max(24, Math.min(drawerBounds.width - 24, pointerX));
      centuryActions.style.setProperty("--century-drawer-pointer-x", `${clampedPointerX}px`);
      const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      centuryActions.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
    });
  }
}

function centuryAddActionDrawerClose(form) {
  const title = form && form.querySelector(".century-action-title");
  if (!title) return;
  const closeButton = centuryButton("Close", centuryCloseActionDrawer, false, "century-drawer-close");
  closeButton.setAttribute("aria-label", "Close selected action");
  title.appendChild(closeButton);
}

function renderCenturyPointMarket(view) {
  centuryPointMarket.innerHTML = "";
  (view.point_market || []).forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "century-card century-point-card";
    const bonus = centuryPointBonus(view, index);
    button.innerHTML = `
      <div class="century-card-heading">
        <span class="century-card-kind"><span class="century-kind-mark" aria-hidden="true"></span>POINT CARD</span>
        <span class="century-slot-number">#${index + 1}</span>
      </div>
      <div class="century-point-value"><strong>${Number(card.points || 0)}</strong><span>VP</span></div>
      <div class="century-point-cost">
        <span class="century-effect-label">PAY</span>
        ${centurySpiceMarkup(card.cost)}
      </div>
      <div class="century-point-bonus ${bonus ? "" : "is-empty"}">
        ${bonus ? `${centuryCoinMarkup(bonus, 1)}<span>Slot bonus</span>` : "No coin bonus"}
      </div>
    `;
    button.setAttribute("aria-label", `Point card worth ${card.points} points. Cost: ${centurySpicePlainText(card.cost)}.`);
    button.disabled = !centuryCan(view, "claim");
    button.addEventListener("click", () => sendAction({ type: "claim", index }));
    centuryExplain(button, "Point Card", "Claim this card by paying its spice cost.", [
      `Cost: ${centurySpicePlainText(card.cost)}`,
      `Printed value: ${card.points} VP`,
      bonus ? `This slot awards one ${bonus === "gold" ? "Gold" : "Silver"} coin.` : "This slot has no coin bonus.",
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
    button.className = `century-card century-merchant-card ${centuryCardTypeClass(card)}`;
    const waitingSpices = Object.values(slot.spices || {}).some((amount) => Number(amount || 0) > 0);
    button.innerHTML = `
      ${centuryMerchantCardMarkup(card)}
      <div class="century-market-card-footer">
        <span class="century-acquire-cost ${index === 0 ? "is-free" : ""}">${index === 0 ? "FREE PICK" : `PAY ${index} ANY`}</span>
        <span class="century-waiting-spices ${waitingSpices ? "has-spices" : ""}">
          ${waitingSpices ? `BONUS ${centurySpiceMarkup(slot.spices)}` : "No bonus spices"}
        </span>
      </div>
    `;
    const acquireCostLabel = index === 0 ? "Free to acquire" : `Costs ${index} ${index === 1 ? "spice" : "spices"} to acquire`;
    button.setAttribute("aria-label", `${centuryMerchantPlainText(card)}. ${acquireCostLabel}.`);
    button.setAttribute("aria-controls", "centuryActions");
    button.setAttribute("aria-expanded", "false");
    button.disabled = !centuryCan(view, "acquire");
    button.addEventListener("click", () => renderCenturyAcquireForm(view, index, button));
    centuryExplain(button, "Merchant Card", "Acquire this card into your hand. Cards farther right cost more spices.", [
      `Acquire cost: ${index === 0 ? "Free" : `${index} total spice placed on cards to the left.`}`,
      `Effect: ${centuryMerchantPlainText(card)}`,
      `Spices waiting on this card: ${centurySpicePlainText(slot.spices)}`,
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
  const caravanCount = Object.values(you.spices || {}).reduce((total, amount) => total + Number(amount || 0), 0);
  centuryYou.innerHTML = `
    <div class="century-player-header">
      <div>
        <span class="century-eyebrow">YOUR CARAVAN</span>
        <strong>${centuryEscapeHtml(you.name || "You")}</strong>
      </div>
      <span class="century-capacity ${caravanCount > 10 ? "is-over" : ""}">${caravanCount} / 10 spices</span>
    </div>
    <div class="century-caravan-spices">${centurySpiceMarkup(you.spices, true)}</div>
    <div class="century-player-summary-row">
      <span class="century-coin-list">${centuryCoinMarkup("gold", you.gold)}${centuryCoinMarkup("silver", you.silver)}</span>
      <span class="century-score-chip"><strong>${Number(you.score || 0)}</strong> current points</span>
    </div>
    <div class="century-claimed-line"><strong>Claimed cards</strong><span>${(you.claimed_points || []).map((card) => `${Number(card.points || 0)} VP`).join(" · ") || "None"}</span></div>
    <div class="century-spice-key" aria-label="Spice value order">
      <span>LOW</span>${centuryUpgradeTrackMarkup()}<span>HIGH</span>
    </div>
    <div class="century-hand-heading">
      <h4>Hand</h4>
      <div class="century-hand-tools"></div>
    </div>
    <div class="century-card-row century-hand"></div>
    <div class="century-hand-action-slot"></div>
    <h4>Played</h4>
    <div class="century-card-row century-played"></div>
  `;
  const actionSlot = centuryYou.querySelector(".century-hand-action-slot");
  centuryCloseActionDrawer();
  if (actionSlot && centuryActions) actionSlot.appendChild(centuryActions);

  const handTools = centuryYou.querySelector(".century-hand-tools");
  const restButton = centuryButton("Rest", () => sendAction({ type: "rest" }), !centuryCan(view, "rest"), "century-rest-button");
  restButton.title = "Return all played merchant cards to your hand";
  centuryExplain(restButton, "Rest", "Return all played merchant cards to your hand.", [
    "Rest uses your whole turn.",
    "It becomes available after at least one merchant card has been played.",
  ]);
  if (handTools) handTools.appendChild(restButton);

  const hand = centuryYou.querySelector(".century-hand");
  (you.hand || []).forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `century-card century-hand-card ${centuryCardTypeClass(card)}`;
    button.innerHTML = centuryMerchantCardMarkup(card);
    button.setAttribute("aria-label", centuryMerchantPlainText(card));
    button.setAttribute("aria-controls", "centuryActions");
    button.setAttribute("aria-expanded", "false");
    button.disabled = !centuryCan(view, "play");
    button.addEventListener("click", () => renderCenturyPlayForm(view, card, button));
    centuryExplain(button, "Hand Card", "Play one merchant card as your turn action.", [`Effect: ${centuryMerchantPlainText(card)}`]);
    hand.appendChild(button);
  });
  const played = centuryYou.querySelector(".century-played");
  (you.played_cards || []).forEach((card) => {
    const div = document.createElement("div");
    div.className = `century-card century-played-card ${centuryCardTypeClass(card)}`;
    div.innerHTML = centuryMerchantCardMarkup(card);
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
        <strong>${centuryEscapeHtml(player.name || player.player_id)}</strong>
        <span class="century-score-chip"><strong>${Number(player.score || 0)}</strong> pts</span>
      </div>
      <div class="century-player-spices">${centurySpiceMarkup(player.spices, true)}</div>
      <div class="century-player-facts">
        <span>Hand <strong>${Number(player.hand_count || 0)}</strong></span>
        <span>Played <strong>${(player.played_cards || []).length}</strong></span>
        <span>Claimed <strong>${(player.claimed_points || []).length}</strong></span>
      </div>
      <div class="century-coin-list">${centuryCoinMarkup("gold", player.gold)}${centuryCoinMarkup("silver", player.silver)}</div>
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
  CENTURY_SPICE_ORDER.forEach((color) => {
    const need = Number((card.cost || {})[color] || 0);
    if (need > 0) {
      maxTimes = Math.min(maxTimes, Math.floor(Number((player.spices || {})[color] || 0) / need));
    }
  });
  return maxTimes === Infinity ? 0 : maxTimes;
}

function renderCenturyPlayForm(view, card, sourceButton = null) {
  const you = centurySelf(view);
  const form = document.createElement("div");
  const cardMeta = CENTURY_CARD_META[card.type] || CENTURY_CARD_META.trade;
  form.className = `century-action-form century-action-form--drawer century-action-form--${cardMeta.className}`;
  form.innerHTML = `
    <div class="century-action-title">
      <span>PLAY ${cardMeta.label}</span>
      <strong>${centuryMerchantPlainText(card)}</strong>
    </div>
  `;
  centuryAddActionDrawerClose(form);
  if (card.type === "upgrade") {
    const wrap = document.createElement("div");
    wrap.className = "century-upgrade-choices";
    const upgrades = [];
    const preview = { ...(you.spices || {}) };
    const sequenceLabel = document.createElement("div");
    sequenceLabel.className = "century-selection-label";
    const refreshUpgradeButtons = () => {
      const steps = upgrades.map((color, index) => {
        const nextColor = CENTURY_SPICE_ORDER[CENTURY_SPICE_ORDER.indexOf(color) + 1];
        return `
          <span class="century-planned-step">
            <b>${index + 1}</b>
            ${centurySpiceGemMarkup(color)}
            <span class="century-inline-arrow" aria-hidden="true"></span>
            ${centurySpiceGemMarkup(nextColor)}
          </span>
        `;
      }).join("");
      sequenceLabel.innerHTML = `
        <div class="century-selection-heading">
          <strong>Planned upgrades</strong>
          <span>${upgrades.length} / ${Number(card.upgrade_steps || 0)} steps</span>
        </div>
        <div class="century-planned-steps">${steps || '<span class="century-empty-value">Choose a conversion above. You may use fewer than the maximum.</span>'}</div>
        <div class="century-upgrade-preview"><span>Caravan after plan</span>${centurySpiceMarkup(preview, true)}</div>
      `;
      wrap.querySelectorAll("button[data-upgrade-color]").forEach((button) => {
        const color = button.dataset.upgradeColor;
        button.disabled = upgrades.length >= Number(card.upgrade_steps || 0) || Number(preview[color] || 0) <= 0;
      });
    };
    ["yellow", "red", "green"].forEach((color) => {
      const nextColor = CENTURY_SPICE_ORDER[CENTURY_SPICE_ORDER.indexOf(color) + 1];
      const button = centuryButton("", () => {
        if (upgrades.length >= Number(card.upgrade_steps || 0) || Number(preview[color] || 0) <= 0) return;
        preview[color] = Number(preview[color] || 0) - 1;
        preview[nextColor] = Number(preview[nextColor] || 0) + 1;
        upgrades.push(color);
        refreshUpgradeButtons();
      });
      button.className = "century-upgrade-choice";
      button.innerHTML = `
        <span>UPGRADE</span>
        <span class="century-upgrade-choice-path">${centurySpiceGemMarkup(color)}<span class="century-inline-arrow" aria-hidden="true"></span>${centurySpiceGemMarkup(nextColor)}</span>
      `;
      button.setAttribute("aria-label", `Upgrade ${CENTURY_SPICE_META[color].name} to ${CENTURY_SPICE_META[nextColor].name}`);
      button.dataset.upgradeColor = color;
      wrap.appendChild(button);
    });
    const resetBtn = centuryButton("Start over", () => renderCenturyPlayForm(view, card, sourceButton), false, "century-secondary-action");
    wrap.appendChild(resetBtn);
    form.appendChild(wrap);
    form.appendChild(sequenceLabel);
    refreshUpgradeButtons();
    form.appendChild(centuryButton("Play", () => {
      sendAction({ type: "play", card_id: card.id, upgrades });
    }, false, "century-primary-action"));
  } else if (card.type === "trade") {
    const maxTimes = maxCenturyTradeTimes(you, card);
    let selectedTimes = maxTimes > 0 ? 1 : 0;
    const chooser = document.createElement("div");
    chooser.className = "century-repeat-control";
    chooser.innerHTML = `
      <div class="century-repeat-heading">
        <strong>How many times?</strong>
        <span>Maximum ${maxTimes}</span>
      </div>
    `;
    const options = document.createElement("div");
    options.className = "century-repeat-options";
    options.setAttribute("role", "group");
    options.setAttribute("aria-label", `Choose recipe repetitions, maximum ${maxTimes}`);
    chooser.appendChild(options);
    const total = document.createElement("div");
    total.className = "century-trade-total";
    total.setAttribute("aria-live", "polite");
    const playButton = centuryButton("Play", () => {
      if (selectedTimes > 0) sendAction({ type: "play", card_id: card.id, times: selectedTimes });
    }, maxTimes <= 0, "century-primary-action");
    const refreshTradeTotal = () => {
      options.querySelectorAll("button[data-century-times]").forEach((button) => {
        const isSelected = Number(button.dataset.centuryTimes) === selectedTimes;
        button.classList.toggle("is-selected", isSelected);
        button.setAttribute("aria-pressed", String(isSelected));
      });
      playButton.textContent = selectedTimes > 0 ? `Play ${selectedTimes} ${selectedTimes === 1 ? "time" : "times"}` : "Cannot play";
      total.innerHTML = `
        ${selectedTimes > 0 ? `
          <span><small>TOTAL GIVE</small>${centurySpiceMarkup(centuryScaleSpices(card.cost, selectedTimes))}</span>
          <span class="century-total-arrow" aria-hidden="true"></span>
          <span><small>TOTAL GET</small>${centurySpiceMarkup(centuryScaleSpices(card.gain, selectedTimes))}</span>
        ` : '<div class="century-trade-unavailable">Not enough spices to use this recipe.</div>'}
      `;
    };
    for (let times = 1; times <= maxTimes; times += 1) {
      const option = centuryButton("", () => {
        selectedTimes = times;
        refreshTradeTotal();
      }, false, "century-repeat-option");
      option.dataset.centuryTimes = String(times);
      option.innerHTML = `<strong>${times}</strong><span>${times === 1 ? "time" : "times"}</span>`;
      option.setAttribute("aria-label", `Use recipe ${times} ${times === 1 ? "time" : "times"}`);
      options.appendChild(option);
    }
    form.appendChild(chooser);
    refreshTradeTotal();
    form.appendChild(total);
    form.appendChild(playButton);
  } else {
    form.appendChild(centuryButton("Play", () => sendAction({ type: "play", card_id: card.id }), false, "century-primary-action"));
  }
  centuryOpenActionDrawer(form, sourceButton);
}

function renderCenturyAcquireForm(view, index, sourceButton = null) {
  const you = centurySelf(view);
  const slot = (view.merchant_market || [])[index];
  const form = document.createElement("div");
  const cardMeta = CENTURY_CARD_META[(slot && slot.card && slot.card.type) || "trade"] || CENTURY_CARD_META.trade;
  form.className = `century-action-form century-action-form--drawer century-action-form--acquire century-action-form--${cardMeta.className}`;
  form.innerHTML = `
    <div class="century-action-title">
      <span>ACQUIRE SLOT ${index + 1}</span>
      <strong>${slot && slot.card ? centuryMerchantPlainText(slot.card) : "Merchant card"}</strong>
    </div>
  `;
  centuryAddActionDrawerClose(form);
  const selects = [];
  if (index > 0) {
    const wrap = document.createElement("div");
    wrap.className = "century-pay-grid";
    for (let i = 0; i < index; i += 1) {
      const label = document.createElement("label");
      label.append(`Left slot ${i + 1}`);
      const select = document.createElement("select");
      CENTURY_SPICE_ORDER.forEach((color) => {
        const option = document.createElement("option");
        option.value = color;
        option.textContent = `${CENTURY_SPICE_META[color].name} spice`;
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
  }, false, "century-primary-action"));
  centuryOpenActionDrawer(form, sourceButton);
}

function renderCenturyDiscardForm(view) {
  const you = centurySelf(view);
  const form = document.createElement("div");
  form.className = "century-action-form century-action-form--drawer century-action-form--compact century-action-form--limit";
  form.innerHTML = `
    <div class="century-action-title">
      <span>CARAVAN LIMIT</span>
      <strong>Discard ${view.discard_needed} spice</strong>
    </div>
  `;
  const inputs = {};
  const wrap = document.createElement("div");
  wrap.className = "century-pay-grid";
  CENTURY_SPICE_ORDER.forEach((color) => {
    const label = document.createElement("label");
    const input = centuryNumberInput(0, 0, Number((you.spices || {})[color] || 0));
    inputs[color] = input;
    label.innerHTML = `${centurySpiceGemMarkup(color)}<span>${CENTURY_SPICE_META[color].name}</span>`;
    label.appendChild(input);
    wrap.appendChild(label);
  });
  form.appendChild(wrap);
  form.appendChild(centuryButton("Discard", () => {
    const spices = {};
    CENTURY_SPICE_ORDER.forEach((color) => {
      spices[color] = Number(inputs[color].value || 0);
    });
    sendAction({ type: "discard", spices });
  }, false, "century-primary-action"));
  centuryOpenActionDrawer(form, null, true);
}

function renderCenturyDefaultActions(view) {
  if (view.phase === "discard" && view.discard_player === view.you) {
    renderCenturyDiscardForm(view);
    return;
  }
  centuryCloseActionDrawer();
}

function renderCenturyGameState(payload) {
  const view = payload.view || payload.state || payload;
  currentCenturyView = view;
  const currentName = centuryPlayerName(view, view.current_turn);
  if (centuryPhase) centuryPhase.textContent = view.phase || "-";
  if (centuryTurn) centuryTurn.textContent = currentName;
  if (centuryDecks) centuryDecks.textContent = `Merchants ${view.merchant_deck_count}, Points ${view.point_deck_count}`;
  if (centuryCoins) {
    centuryCoins.innerHTML = `${centuryCoinMarkup("gold", view.gold_remaining, false)}${centuryCoinMarkup("silver", view.silver_remaining, false)}`;
  }
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
  centuryPanel.addEventListener("pointerdown", (event) => {
    if (!centuryExplainMode) return;
    const target = event.target && event.target.closest ? event.target.closest("[data-century-explain]") : null;
    if (!target || !target.matches("button:disabled, input:disabled, select:disabled, textarea:disabled")) return;
    event.preventDefault();
    event.stopPropagation();
    showCenturyExplanationFromNode(target);
  }, true);

  centuryPanel.addEventListener("click", (event) => {
    if (!centuryExplainMode) return;
    const target = event.target && event.target.closest ? event.target.closest("[data-century-explain]") : null;
    const control = event.target && event.target.closest ? event.target.closest("button, input, select, textarea, a") : null;
    if (control === centuryExplainBtn || control === centuryHelpBtn) return;
    if (!target && !control) return;
    event.preventDefault();
    event.stopPropagation();
    if (target) showCenturyExplanationFromNode(target);
  }, true);
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !centuryPanel || centuryPanel.classList.contains("hidden")) return;
  let handled = false;
  if (centuryExplainMode) {
    setCenturyExplainMode(false);
    handled = true;
  }
  [centuryHelpModal, centuryExplainModal].forEach((modal) => {
    if (modal && !modal.classList.contains("hidden")) {
      setModalVisible(modal, false);
      handled = true;
    }
  });
  if (handled) event.preventDefault();
});
