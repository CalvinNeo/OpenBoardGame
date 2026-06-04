let currentWitchsBrewView = null;
let witchsBrewExplainMode = false;
let witchsBrewSelectedRoles = new Set();

const witchsBrewPhase = document.getElementById("witchsBrewPhase");
const witchsBrewCurrent = document.getElementById("witchsBrewCurrent");
const witchsBrewRole = document.getElementById("witchsBrewRole");
const witchsBrewSpell = document.getElementById("witchsBrewSpell");
const witchsBrewRavens = document.getElementById("witchsBrewRavens");
const witchsBrewWinner = document.getElementById("witchsBrewWinner");
const witchsBrewNotice = document.getElementById("witchsBrewNotice");
const witchsBrewNoticeTitle = document.getElementById("witchsBrewNoticeTitle");
const witchsBrewNoticeBody = document.getElementById("witchsBrewNoticeBody");
const witchsBrewPublicCards = document.getElementById("witchsBrewPublicCards");
const witchsBrewHand = document.getElementById("witchsBrewHand");
const witchsBrewActions = document.getElementById("witchsBrewActions");
const witchsBrewPlayers = document.getElementById("witchsBrewPlayers");
const witchsBrewHelpBtn = document.getElementById("witchsBrewHelpBtn");
const witchsBrewExplainBtn = document.getElementById("witchsBrewExplainBtn");
const witchsBrewHelpModal = document.getElementById("witchsBrewHelpModal");
const witchsBrewHelpModalCloseBtn = document.getElementById("witchsBrewHelpModalCloseBtn");
const witchsBrewHelpContent = document.getElementById("witchsBrewHelpContent");
const witchsBrewExplainModal = document.getElementById("witchsBrewExplainModal");
const witchsBrewExplainModalCloseBtn = document.getElementById("witchsBrewExplainModalCloseBtn");
const witchsBrewExplainContent = document.getElementById("witchsBrewExplainContent");

const WITCHS_BREW_RES = {
  red: "🔴",
  green: "🟢",
  white: "⚪",
  gold: "🟡",
  vial: "🧴",
};

const WITCHS_BREW_ALL_ROLES = [
  "wolf_keeper",
  "snake_hunter",
  "herb_collector",
  "alchemist",
  "fortune_teller",
  "assistant",
  "wizard",
  "witch",
  "druid",
  "warlock",
  "cutpurse",
  "begging_monk",
];

const WITCHS_BREW_EXPLAIN = {
  witchsBrewPublicCards: "Shows the available cauldrons, shelves, stored payments, and current spell.",
  witchsBrewHand: "Your private role cards for this set. During selection choose exactly 5 roles.",
  witchsBrewActions: "Only legal controls are enabled. Use this area to claim, take favors, resolve payments, and advance paused rounds.",
  witchsBrewPlayers: "Resources are public. Selected roles stay hidden, but played roles and collected cards are visible.",
};

const WITCHS_BREW_HELP_HTML = `
  <div class="witchs-brew-help">
    <p><strong>Goal.</strong> Score cauldrons, shelves, and 🧴 vials. The game ends at the end of a set when collected raven cards total 4 or more.</p>
    <p><strong>Set.</strong> Everyone secretly selects 5 of 12 roles. The start player plays one role as a full action.</p>
    <p><strong>Challenge.</strong> In seat order, every other player with that role must play it and either claim the full action or take the weaker favor. A later full claim replaces the previous claimant.</p>
    <p><strong>Cards.</strong> 🧙 buys copper, 🧪 buys iron, 🍃 buys silver. Shelves collect stolen 🟡 gold or ingredients until their threshold is met.</p>
    <p><strong>Pause.</strong> After each role resolves, all players press Next Round before play continues.</p>
  </div>
`;

function witchsBrewName(view, playerId) {
  const player = view && Array.isArray(view.players) ? view.players.find((p) => p.player_id === playerId) : null;
  return player ? player.name || player.player_id : playerId || "-";
}

function witchsBrewRoleInfo(view, role) {
  const defs = view && view.role_defs ? view.role_defs : {};
  return defs[role] || { name: role || "-", emoji: "❔", full: "", favor: "" };
}

function witchsBrewRoleLabel(view, role) {
  const info = witchsBrewRoleInfo(view, role);
  return `${info.emoji || ""} ${info.name || role}`;
}

function witchsBrewSpellLabel(view, spell) {
  const defs = view && view.spell_defs ? view.spell_defs : {};
  const info = defs[spell] || {};
  return spell ? `${info.name || spell}: ${info.text || ""}` : "-";
}

function witchsBrewCostText(cost) {
  if (!cost || typeof cost !== "object") {
    return "-";
  }
  const parts = [];
  ["red", "green", "white", "gold"].forEach((key) => {
    const count = Number.parseInt(cost[key] || 0, 10);
    if (count > 0) {
      parts.push(`${WITCHS_BREW_RES[key]}×${count}`);
    }
  });
  return parts.length ? parts.join(" ") : "free";
}

function witchsBrewResourcesText(resources) {
  return ["red", "green", "white", "gold", "vial"]
    .map((key) => `${WITCHS_BREW_RES[key]} ${Number.parseInt((resources || {})[key] || 0, 10)}`)
    .join(" ");
}

function witchsBrewRavenCount(view) {
  return (view.players || []).reduce((sum, player) => {
    const potions = Array.isArray(player.potions) ? player.potions : [];
    const shelves = Array.isArray(player.shelves) ? player.shelves : [];
    return sum + potions.filter((card) => card.raven).length + shelves.filter((card) => card.raven).length;
  }, 0);
}

function witchsBrewTopCard(cards) {
  return Array.isArray(cards) && cards.length ? cards[0] : null;
}

function witchsBrewButton(label, onClick, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = !!disabled;
  if (!button.disabled) {
    button.classList.add("action-allowed");
  }
  button.addEventListener("click", onClick);
  return button;
}

function witchsBrewNumberInput(id, value = 0) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.value = String(value);
  input.id = id;
  input.className = "witchs-brew-number";
  return input;
}

function witchsBrewIngredientInputs(prefix, amountHint) {
  const wrap = document.createElement("div");
  wrap.className = "witchs-brew-pay-grid";
  ["red", "green", "white"].forEach((key) => {
    const label = document.createElement("label");
    label.textContent = WITCHS_BREW_RES[key];
    const input = witchsBrewNumberInput(`${prefix}-${key}`, 0);
    input.dataset.resource = key;
    label.appendChild(input);
    wrap.appendChild(label);
  });
  if (amountHint) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = amountHint;
    wrap.appendChild(hint);
  }
  return wrap;
}

function witchsBrewReadIngredientInputs(container) {
  const result = { red: 0, green: 0, white: 0 };
  container.querySelectorAll("input[data-resource]").forEach((input) => {
    result[input.dataset.resource] = Math.max(0, Number.parseInt(input.value || "0", 10) || 0);
  });
  return result;
}

function clearWitchsBrewState() {
  currentWitchsBrewView = null;
  witchsBrewExplainMode = false;
  witchsBrewSelectedRoles = new Set();
  document.body.classList.remove("witchs-brew-explain-mode");
  if (witchsBrewExplainBtn) witchsBrewExplainBtn.classList.remove("active");
  [witchsBrewPhase, witchsBrewCurrent, witchsBrewRole, witchsBrewSpell, witchsBrewRavens, witchsBrewWinner].forEach((el) => {
    if (el) el.textContent = "-";
  });
  [witchsBrewPublicCards, witchsBrewHand, witchsBrewActions, witchsBrewPlayers].forEach((el) => {
    if (el) el.innerHTML = "";
  });
}

function showWitchsBrewHeaderActions(show) {
  if (witchsBrewHelpBtn) witchsBrewHelpBtn.classList.toggle("hidden", !show);
  if (witchsBrewExplainBtn) witchsBrewExplainBtn.classList.toggle("hidden", !show);
}

function renderWitchsBrewPublicCards(view) {
  if (!witchsBrewPublicCards) return;
  witchsBrewPublicCards.innerHTML = "";
  witchsBrewPublicCards.classList.add("has-explanation");
  witchsBrewPublicCards.dataset.explainId = "witchsBrewPublicCards";

  [
    ["copper", "Copper", view.cauldrons && view.cauldrons.copper],
    ["iron", "Iron", view.cauldrons && view.cauldrons.iron],
    ["silver", "Silver", view.cauldrons && view.cauldrons.silver],
  ].forEach(([key, label, cards]) => {
    const card = witchsBrewTopCard(cards);
    const el = document.createElement("div");
    el.className = `witchs-brew-public-card cauldron-${key}`;
    el.innerHTML = `<strong>${label}</strong><span>${card ? `${witchsBrewCostText(card.cost)} · ${card.vp} VP ${card.raven ? "🐦‍⬛" : ""}` : "Empty"}</span><small>${cards ? cards.length : 0} left</small>`;
    witchsBrewPublicCards.appendChild(el);
  });

  [
    ["gold_shelf", "Gold Shelf", "threshold_gold"],
    ["ingredient_shelf", "Ingredient Shelf", "threshold_ingredients"],
  ].forEach(([key, label]) => {
    const cards = view.shelves ? view.shelves[key] : [];
    const card = witchsBrewTopCard(cards);
    const stored = view.shelf_stored ? view.shelf_stored[key] : {};
    const storedText = key === "gold_shelf" ? `${WITCHS_BREW_RES.gold} ${stored.gold || 0}` : witchsBrewCostText(stored);
    const el = document.createElement("div");
    el.className = "witchs-brew-public-card shelf";
    el.innerHTML = `<strong>${label}</strong><span>${card ? `Need ${card.threshold} · ${card.vp} VP ${card.raven ? "🐦‍⬛" : ""}` : "Empty"}</span><small>Stored: ${storedText}</small>`;
    witchsBrewPublicCards.appendChild(el);
  });
}

function renderWitchsBrewHand(view) {
  if (!witchsBrewHand) return;
  witchsBrewHand.innerHTML = "";
  witchsBrewHand.classList.add("has-explanation");
  witchsBrewHand.dataset.explainId = "witchsBrewHand";
  const roles = view.phase === "select_roles" ? WITCHS_BREW_ALL_ROLES : view.your_hand || [];
  roles.forEach((role) => {
    const info = witchsBrewRoleInfo(view, role);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "witchs-brew-role-card";
    const disabled = (view.disabled_roles || []).includes(role);
    button.disabled = disabled || (view.phase !== "select_roles" && view.phase !== "play_role");
    button.innerHTML = `<span>${info.emoji || ""}</span><strong>${info.name || role}</strong><small>Full: ${info.full || "-"}</small><small>Favor: ${info.favor || "-"}</small>`;
    if (witchsBrewSelectedRoles.has(role) || (view.your_selected || []).includes(role)) {
      button.classList.add("selected");
    }
    if (disabled) {
      button.title = "Disabled this set";
    }
    button.addEventListener("click", () => {
      if (view.phase === "select_roles" && !disabled && !(view.your_selected || []).length) {
        if (witchsBrewSelectedRoles.has(role)) witchsBrewSelectedRoles.delete(role);
        else if (witchsBrewSelectedRoles.size < 5) witchsBrewSelectedRoles.add(role);
        renderWitchsBrewGameState({ state: view });
      } else if (view.phase === "play_role" && view.legal_actions.includes("play_role")) {
        sendAction({ type: "play_role", role });
      }
    });
    witchsBrewHand.appendChild(button);
  });
}

function renderWitchsBrewResolveAction(view) {
  const pending = view.pending_action || {};
  const role = pending.role;
  const strength = pending.strength;
  const info = witchsBrewRoleInfo(view, role);
  const form = document.createElement("div");
  form.className = "witchs-brew-action-form";
  const title = document.createElement("div");
  title.className = "witchs-brew-action-title";
  title.textContent = `${witchsBrewRoleLabel(view, role)} · ${strength === "full" ? "Full action" : "Favor"}`;
  form.appendChild(title);

  const sendResolve = (extra = {}) => sendAction({ type: "resolve_action", ...extra });
  const skip = witchsBrewButton("Skip Action", () => sendResolve({ skip: true }));
  form.appendChild(skip);

  if (role === "cutpurse") {
    const label = document.createElement("label");
    label.className = "witchs-brew-inline";
    label.textContent = "Add gold ";
    label.appendChild(witchsBrewNumberInput("witchs-brew-augment-gold", 0));
    form.appendChild(label);
    form.appendChild(witchsBrewButton("Resolve", () => sendResolve({ augment_gold: Number.parseInt((form.querySelector("#witchs-brew-augment-gold") || {}).value || "0", 10) || 0 })));
  } else if (["wolf_keeper", "snake_hunter", "herb_collector", "fortune_teller"].includes(role) || (role === "warlock" && strength !== "full")) {
    form.appendChild(witchsBrewButton("Resolve", () => sendResolve({ augment_gold: Number.parseInt((form.querySelector("#witchs-brew-augment-gold") || {}).value || "0", 10) || 0 })));
  } else if (role === "alchemist") {
    ["red", "green", "white"].forEach((color) => form.appendChild(witchsBrewButton(`Pay ${WITCHS_BREW_RES[color]}`, () => sendResolve({ pay_ingredient: color }))));
  } else if (role === "assistant" || (role === "warlock" && view.spell === "copia")) {
    const need = role === "assistant" && strength !== "full" ? 1 : 3;
    const inputs = witchsBrewIngredientInputs("witchs-brew-gain", `Choose exactly ${need}.`);
    form.appendChild(inputs);
    form.appendChild(witchsBrewButton("Gain Ingredients", () => sendResolve({ gain_ingredients: witchsBrewReadIngredientInputs(inputs) })));
  } else if (["wizard", "witch", "druid"].includes(role)) {
    const checkbox = document.createElement("label");
    checkbox.className = "witchs-brew-inline";
    const select = document.createElement("select");
    select.id = "witchs-brew-extra";
    ["", "red", "green", "white"].forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value ? `Extra ${WITCHS_BREW_RES[value]} for 🧴` : "No extra vial";
      select.appendChild(option);
    });
    checkbox.append("After buying: ", select);
    form.appendChild(checkbox);
    form.appendChild(witchsBrewButton("Buy Cauldron", () => sendResolve({ extra_ingredient: select.value || undefined })));
  } else if (role === "warlock") {
    renderWitchsBrewSpellForm(view, form, sendResolve);
  } else if (role === "begging_monk") {
    const inputs = witchsBrewIngredientInputs("witchs-brew-augment", "Optional ingredients to add to the shelf.");
    form.appendChild(inputs);
    form.appendChild(witchsBrewButton("Resolve Monk", () => sendResolve({ augment_ingredients: witchsBrewReadIngredientInputs(inputs) })));
  }
  witchsBrewActions.appendChild(form);
}

function renderWitchsBrewSpellForm(view, form, sendResolve) {
  const spell = view.spell;
  if (["herba", "lupus", "serpens"].includes(spell)) {
    form.appendChild(witchsBrewButton("Cast Spell", () => sendResolve({})));
  } else if (spell === "optio") {
    ["copper", "iron", "silver"].forEach((stack) => form.appendChild(witchsBrewButton(`Buy ${stack}`, () => sendResolve({ stack }))));
  } else if (["magus", "sanatio", "strix"].includes(spell)) {
    const inputs = witchsBrewIngredientInputs("witchs-brew-payment", "Pay any colors with matching total count.");
    form.appendChild(inputs);
    form.appendChild(witchsBrewButton("Cast Spell", () => sendResolve({ payment: witchsBrewReadIngredientInputs(inputs) })));
  }
}

function renderWitchsBrewActions(view) {
  if (!witchsBrewActions) return;
  witchsBrewActions.innerHTML = "";
  witchsBrewActions.classList.add("has-explanation");
  witchsBrewActions.dataset.explainId = "witchsBrewActions";
  const legal = view.legal_actions || [];
  if (legal.includes("select_roles")) {
    const count = witchsBrewSelectedRoles.size;
    const label = document.createElement("div");
    label.className = "witchs-brew-selection-label";
    label.textContent = `Selected ${count}/5`;
    witchsBrewActions.appendChild(label);
    witchsBrewActions.appendChild(witchsBrewButton("Confirm Roles", () => sendAction({ type: "select_roles", roles: Array.from(witchsBrewSelectedRoles) }), count !== 5));
  } else if (legal.includes("respond")) {
    witchsBrewActions.appendChild(witchsBrewButton("Claim Full Action", () => sendAction({ type: "respond", response: "claim_full" })));
    witchsBrewActions.appendChild(witchsBrewButton("Take Favor", () => sendAction({ type: "respond", response: "take_favor" })));
  } else if (legal.includes("resolve_action")) {
    renderWitchsBrewResolveAction(view);
  } else if (legal.includes("choose_loss")) {
    const pending = view.monk_resolution && view.monk_resolution.pending_losses ? view.monk_resolution.pending_losses[0] : null;
    const amount = pending ? pending.amount : 0;
    const inputs = witchsBrewIngredientInputs("witchs-brew-loss", `Choose exactly ${amount} ingredients to lose.`);
    witchsBrewActions.appendChild(inputs);
    witchsBrewActions.appendChild(witchsBrewButton("Confirm Loss", () => sendAction({ type: "choose_loss", loss: witchsBrewReadIngredientInputs(inputs) })));
  } else if (legal.includes("next_round")) {
    witchsBrewActions.appendChild(witchsBrewButton("Next Round", () => sendAction({ type: "next_round" })));
  } else {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = view.phase === "select_roles" ? "Waiting for all players to select roles." : "Waiting for the current player.";
    witchsBrewActions.appendChild(hint);
  }
}

function renderWitchsBrewPlayers(view) {
  if (!witchsBrewPlayers) return;
  witchsBrewPlayers.innerHTML = "";
  witchsBrewPlayers.classList.add("has-explanation");
  witchsBrewPlayers.dataset.explainId = "witchsBrewPlayers";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "witchs-brew-player-card";
    if (player.player_id === view.you) card.classList.add("self");
    if (player.player_id === view.current_player) card.classList.add("current");
    const score = view.scores && view.scores[player.player_id] ? ` · ${view.scores[player.player_id].total} VP` : "";
    const played = (player.played_roles || []).map((role) => witchsBrewRoleInfo(view, role).emoji || role).join(" ");
    const potions = (player.potions || []).map((p) => `${p.vp}${p.raven ? "🐦‍⬛" : ""}`).join(" ");
    const shelves = (player.shelves || []).map((s) => `${s.vp}${s.raven ? "🐦‍⬛" : ""}`).join(" ");
    card.innerHTML = `
      <div class="witchs-brew-player-header"><strong>${player.name || player.player_id}</strong><span>${player.hand_count} cards${score}</span></div>
      <div>${witchsBrewResourcesText(player.resources)}</div>
      <div class="witchs-brew-player-meta">Selected: ${player.selected_ready ? "ready" : `${player.selected_count}/5`} · Played: ${played || "-"}</div>
      <div class="witchs-brew-player-meta">Potions: ${potions || "-"} · Shelves: ${shelves || "-"}</div>
    `;
    witchsBrewPlayers.appendChild(card);
  });
}

function renderWitchsBrewNotice(view) {
  if (!witchsBrewNotice || !witchsBrewNoticeTitle || !witchsBrewNoticeBody) return;
  if (view.phase === "round_pause" && view.last_round) {
    witchsBrewNotice.classList.remove("hidden");
    witchsBrewNotice.setAttribute("aria-hidden", "false");
    witchsBrewNoticeTitle.textContent = `${witchsBrewRoleLabel(view, view.last_round.role)} Resolved`;
    witchsBrewNoticeBody.textContent = `${witchsBrewName(view, view.last_round.claimant)} ${view.last_round.summary || ""}`;
    return;
  }
  if (view.phase === "game_over") {
    witchsBrewNotice.classList.remove("hidden");
    witchsBrewNotice.setAttribute("aria-hidden", "false");
    witchsBrewNoticeTitle.textContent = "Game Over";
    witchsBrewNoticeBody.textContent = "Final scores are shown on player boards.";
    return;
  }
  witchsBrewNotice.classList.add("hidden");
  witchsBrewNotice.setAttribute("aria-hidden", "true");
}

function renderWitchsBrewGameState(data) {
  const view = data.view || data.state || data;
  if (!view || view.game_id !== "witchs_brew") return;
  currentWitchsBrewView = view;
  if (view.phase !== "select_roles") {
    witchsBrewSelectedRoles = new Set();
  }
  if (witchsBrewPhase) witchsBrewPhase.textContent = view.phase || "-";
  if (witchsBrewCurrent) witchsBrewCurrent.textContent = witchsBrewName(view, view.current_player);
  if (witchsBrewRole) witchsBrewRole.textContent = view.active_role ? witchsBrewRoleLabel(view, view.active_role) : "-";
  if (witchsBrewSpell) witchsBrewSpell.textContent = witchsBrewSpellLabel(view, view.spell);
  if (witchsBrewRavens) witchsBrewRavens.textContent = `${witchsBrewRavenCount(view)}/4`;
  if (witchsBrewWinner) witchsBrewWinner.textContent = (view.winner || []).map((pid) => witchsBrewName(view, pid)).join(", ") || "-";
  renderWitchsBrewNotice(view);
  renderWitchsBrewPublicCards(view);
  renderWitchsBrewHand(view);
  renderWitchsBrewActions(view);
  renderWitchsBrewPlayers(view);
}

function openWitchsBrewHelp() {
  if (!witchsBrewHelpModal || !witchsBrewHelpContent) return;
  witchsBrewHelpContent.innerHTML = WITCHS_BREW_HELP_HTML;
  witchsBrewHelpModal.classList.remove("hidden");
  witchsBrewHelpModal.setAttribute("aria-hidden", "false");
}

function closeWitchsBrewHelp() {
  if (!witchsBrewHelpModal) return;
  witchsBrewHelpModal.classList.add("hidden");
  witchsBrewHelpModal.setAttribute("aria-hidden", "true");
}

function showWitchsBrewExplanation(id) {
  if (!witchsBrewExplainModal || !witchsBrewExplainContent) return;
  witchsBrewExplainContent.textContent = WITCHS_BREW_EXPLAIN[id] || "No explanation available.";
  witchsBrewExplainModal.classList.remove("hidden");
  witchsBrewExplainModal.setAttribute("aria-hidden", "false");
}

function exitWitchsBrewExplainMode() {
  witchsBrewExplainMode = false;
  document.body.classList.remove("witchs-brew-explain-mode");
  if (witchsBrewExplainBtn) witchsBrewExplainBtn.classList.remove("active");
}

function closeWitchsBrewExplainModal() {
  if (witchsBrewExplainModal) {
    witchsBrewExplainModal.classList.add("hidden");
    witchsBrewExplainModal.setAttribute("aria-hidden", "true");
  }
}

function findWitchsBrewExplainTargetAtPoint(x, y) {
  return Object.keys(WITCHS_BREW_EXPLAIN).find((id) => {
    const el = document.getElementById(id);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
}

if (witchsBrewHelpBtn) witchsBrewHelpBtn.addEventListener("click", openWitchsBrewHelp);
if (witchsBrewHelpModalCloseBtn) witchsBrewHelpModalCloseBtn.addEventListener("click", closeWitchsBrewHelp);
if (witchsBrewExplainModalCloseBtn) witchsBrewExplainModalCloseBtn.addEventListener("click", closeWitchsBrewExplainModal);
if (witchsBrewExplainBtn) {
  witchsBrewExplainBtn.addEventListener("click", () => {
    witchsBrewExplainMode = !witchsBrewExplainMode;
    document.body.classList.toggle("witchs-brew-explain-mode", witchsBrewExplainMode);
    witchsBrewExplainBtn.classList.toggle("active", witchsBrewExplainMode);
  });
}

document.addEventListener(
  "click",
  (event) => {
    if (!witchsBrewExplainMode || currentGameType !== "witchs_brew") return;
    const target = event.target.closest("[data-explain-id]");
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    showWitchsBrewExplanation(target.dataset.explainId);
    exitWitchsBrewExplainMode();
  },
  true
);

document.addEventListener(
  "pointerdown",
  (event) => {
    if (!witchsBrewExplainMode || currentGameType !== "witchs_brew") return;
    const id = findWitchsBrewExplainTargetAtPoint(event.clientX, event.clientY);
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    showWitchsBrewExplanation(id);
    exitWitchsBrewExplainMode();
  },
  true
);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeWitchsBrewHelp();
  closeWitchsBrewExplainModal();
  exitWitchsBrewExplainMode();
});
