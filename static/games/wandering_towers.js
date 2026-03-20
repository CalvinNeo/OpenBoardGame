let currentWanderingView = null;
let wanderingSelectedCardIndex = null;
let wanderingSelectedWizardId = null;
let wanderingSelectedTowerId = null;

const wanderingTowersHeaderActions = document.getElementById("wanderingTowersHeaderActions");
const wanderingTowersHelpBtn = document.getElementById("wanderingTowersHelpBtn");
const wanderingTowersExplainBtn = document.getElementById("wanderingTowersExplainBtn");
const wanderingTowersHelpModal = document.getElementById("wanderingTowersHelpModal");
const wanderingTowersHelpModalCloseBtn = document.getElementById("wanderingTowersHelpModalCloseBtn");
const wanderingTowersHelpContent = document.getElementById("wanderingTowersHelpContent");
const wanderingTowersExplainModal = document.getElementById("wanderingTowersExplainModal");
const wanderingTowersExplainModalCloseBtn = document.getElementById("wanderingTowersExplainModalCloseBtn");
const wanderingTowersExplainContent = document.getElementById("wanderingTowersExplainContent");

const wanderingTurnLabel = document.getElementById("wanderingTurn");
const wanderingCardsLabel = document.getElementById("wanderingCards");
const wanderingDeckLabel = document.getElementById("wanderingDeck");
const wanderingDiscardLabel = document.getElementById("wanderingDiscard");
const wanderingPendingLabel = document.getElementById("wanderingPending");
const wanderingFinalRoundLabel = document.getElementById("wanderingFinalRound");
const wanderingWinnerLabel = document.getElementById("wanderingWinner");
const wanderingSoloResultLabel = document.getElementById("wanderingSoloResult");
const wanderingSoloScoreLabel = document.getElementById("wanderingSoloScore");

const wanderingBoard = document.getElementById("wanderingBoard");
const wanderingHand = document.getElementById("wanderingHand");
const wanderingWizards = document.getElementById("wanderingWizards");
const wanderingTowers = document.getElementById("wanderingTowers");
const wanderingPlayers = document.getElementById("wanderingPlayers");
const wanderingSelection = document.getElementById("wanderingSelection");
const wanderingSelectionLabel = document.getElementById("wanderingSelectionLabel");

const wanderingPlayCardBtn = document.getElementById("wanderingPlayCardBtn");
const wanderingDiscardBtn = document.getElementById("wanderingDiscardBtn");
const wanderingRerollBtn = document.getElementById("wanderingRerollBtn");
const wanderingAcceptRollBtn = document.getElementById("wanderingAcceptRollBtn");
const wanderingResolveBtn = document.getElementById("wanderingResolveBtn");
const wanderingSpellWizardBtn = document.getElementById("wanderingSpellWizardBtn");
const wanderingSpellTowerBtn = document.getElementById("wanderingSpellTowerBtn");

const WANDERING_ICONS = {
  wizard: String.fromCodePoint(0x1f9d9),
  tower: String.fromCodePoint(0x1f5fc),
  shield: String.fromCodePoint(0x1f6e1),
  castle: String.fromCodePoint(0x1f3f0),
  dice: String.fromCodePoint(0x1f3b2),
};

const WANDERING_HELP_TEXT = `
<h3>Goal</h3>
<p>Guide all of your wizards into Ravenskeep and fill all your potion flasks (no empty flasks remaining). When someone finishes, the round ends after the player to the right of the start player completes their turn.</p>

<h3>Turn</h3>
<ol>
  <li>Choose one main action: play 2 cards (1 in solo) or discard your whole hand to move a tower 1 step.</li>
  <li>Cards move your own visible wizard or any tower by the shown steps. Dice cards roll 1-6; if multiple dice icons, you may reroll up to that many minus one.</li>
  <li>You may cast spells at any time in your turn (even between cards). Spells cost full potions.</li>
</ol>

<h3>Movement</h3>
<p>All movement is clockwise. Wizards cannot move if they would create more than 6 visible wizards on the destination plane. Towers can never land on Ravenskeep.</p>

<h3>Ravenskeep</h3>
<p>If any wizard lands exactly on Ravenskeep, they enter it and the turn ends immediately. Ravenskeep then moves clockwise to the first empty space or the first topmost tower with a raven shield, skipping any space with wizards.</p>

<h3>Potions</h3>
<p>Whenever you move a tower and it lands on visible wizards, you may fill exactly 1 empty potion. Spent potions are removed from the game.</p>
`;

const WANDERING_BUTTON_EXPLANATIONS = {
  wanderingPlayCardBtn: {
    name: "Play Card",
    description: "Play the selected card and resolve its movement (roll dice if needed).",
  },
  wanderingDiscardBtn: {
    name: "Discard + Move Tower",
    description: "Discard your entire hand and move any tower 1 step clockwise.",
  },
  wanderingRerollBtn: {
    name: "Reroll",
    description: "Reroll the dice if the card allows it (rerolls replace the previous roll).",
  },
  wanderingAcceptRollBtn: {
    name: "Accept Roll",
    description: "Accept a roll with no legal targets to fizzle the card.",
  },
  wanderingResolveBtn: {
    name: "Resolve Move",
    description: "Resolve the pending card by moving the selected wizard or tower.",
  },
  wanderingSpellWizardBtn: {
    name: "Spell: Move Wizard",
    description: "Spend 2 full potions to move any visible wizard 1 step.",
  },
  wanderingSpellTowerBtn: {
    name: "Spell: Move Tower",
    description: "Spend 1 full potion to move any tower 2 steps.",
  },
};

const WANDERING_COLOR_PALETTE = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

let wanderingExplainMode = false;

function getWanderingPlayerMap(view) {
  const map = {};
  if (!view || !Array.isArray(view.players)) {
    return map;
  }
  view.players.forEach((p) => {
    map[p.player_id] = p;
  });
  return map;
}

function getWanderingColorMap(view) {
  const map = {};
  if (!view || !Array.isArray(view.players)) {
    return map;
  }
  view.players.forEach((p) => {
    const seat = Number.isFinite(p.seat) ? p.seat : 0;
    map[p.player_id] = WANDERING_COLOR_PALETTE[seat % WANDERING_COLOR_PALETTE.length];
  });
  return map;
}

function formatWanderingCard(card) {
  if (!card) {
    return "-";
  }
  const target = card.target || "either";
  const targetLabel =
    target === "wizard"
      ? `${WANDERING_ICONS.wizard}`
      : target === "tower"
        ? `${WANDERING_ICONS.tower}`
        : `${WANDERING_ICONS.wizard}/${WANDERING_ICONS.tower}`;
  if (card.dice) {
    return `${targetLabel} ${WANDERING_ICONS.dice}x${card.dice}`;
  }
  const steps = Number.isFinite(card.value) ? card.value : "?";
  return `${targetLabel} +${steps}`;
}

function formatWanderingPending(view) {
  if (!view || !view.pending) {
    return "-";
  }
  const pending = view.pending;
  const cardLabel = formatWanderingCard(pending.card);
  if (pending.roll) {
    return `${cardLabel} | roll ${pending.roll} | rerolls ${pending.rerolls_left ?? 0}`;
  }
  if (pending.steps) {
    return `${cardLabel} | steps ${pending.steps}`;
  }
  return cardLabel;
}

function clearWanderingSelection() {
  wanderingSelectedCardIndex = null;
  wanderingSelectedWizardId = null;
  wanderingSelectedTowerId = null;
  updateWanderingSelectionLabel();
  updateWanderingActionButtons();
  if (currentWanderingView) {
    renderWanderingHand(currentWanderingView);
    renderWanderingWizards(currentWanderingView);
    renderWanderingTowers(currentWanderingView);
  }
}

function updateWanderingSelectionLabel() {
  if (!wanderingSelectionLabel) {
    return;
  }
  const parts = [];
  if (wanderingSelectedCardIndex !== null && currentWanderingView) {
    const card = currentWanderingView.hand[wanderingSelectedCardIndex];
    if (card) {
      parts.push(`Card ${wanderingSelectedCardIndex + 1}: ${formatWanderingCard(card)}`);
    } else {
      parts.push(`Card ${wanderingSelectedCardIndex + 1}`);
    }
  }
  if (wanderingSelectedWizardId && currentWanderingView) {
    parts.push(`Wizard ${formatWanderingWizardLabel(currentWanderingView, wanderingSelectedWizardId)}`);
  }
  if (wanderingSelectedTowerId) {
    parts.push(`Tower ${wanderingSelectedTowerId}`);
  }
  wanderingSelectionLabel.textContent = parts.join(" | ") || "-";
}

function formatWanderingWizardLabel(view, wizardId) {
  const playerMap = getWanderingPlayerMap(view);
  const wizard = Array.isArray(view.wizards)
    ? view.wizards.find((w) => w.wizard_id === wizardId)
    : null;
  if (!wizard) {
    return wizardId;
  }
  const owner = playerMap[wizard.owner_id];
  const name = owner ? owner.name : wizard.owner_id;
  const pos = Number.isFinite(wizard.position) ? `@${wizard.position}` : "@Ravenskeep";
  return `${name} ${pos}`;
}

function getWanderingLegalTargets(view) {
  if (!view || !view.pending || !view.pending.legal_targets) {
    return { wizard: [], tower: [] };
  }
  return {
    wizard: view.pending.legal_targets.wizard || [],
    tower: view.pending.legal_targets.tower || [],
  };
}

function getWanderingSpellTargets(view, spellId) {
  if (!view || !view.spell_targets) {
    return { wizard: [], tower: [] };
  }
  const entry = view.spell_targets[spellId];
  if (!entry) {
    return { wizard: [], tower: [] };
  }
  return {
    wizard: entry.wizard || [],
    tower: entry.tower || [],
  };
}

function isWanderingTowerMoveLegal(view, towerId, steps) {
  if (!view || !Array.isArray(view.towers) || !towerId) {
    return false;
  }
  const tower = view.towers.find((t) => t.tower_id === towerId);
  if (!tower || !Number.isFinite(tower.position)) {
    return false;
  }
  const dest = (tower.position + steps) % 16;
  return dest !== view.ravenskeep_pos;
}

function buildWanderingCellExplanation(view, cell) {
  const playerMap = getWanderingPlayerMap(view);
  const layers = Array.isArray(cell.layers) ? cell.layers : [];
  const contents = [];
  const hasRaven = layers.some((layer) => layer.type === "ravenskeep");
  if (hasRaven) {
    contents.push(`${WANDERING_ICONS.castle} 乌鸦堡 (Ravenskeep)`);
  }
  layers
    .filter((layer) => layer.type === "tower")
    .forEach((layer) => {
      const shield = layer.has_shield ? ` ${WANDERING_ICONS.shield}` : "";
      contents.push(`${WANDERING_ICONS.tower} ${layer.tower_id}${shield}`);
    });
  layers
    .filter((layer) => layer.type === "wizards")
    .forEach((layer) => {
      const ownerCounts = {};
      (layer.wizards || []).forEach((wiz) => {
        ownerCounts[wiz.owner_id] = (ownerCounts[wiz.owner_id] || 0) + 1;
      });
      Object.entries(ownerCounts).forEach(([ownerId, count]) => {
        const name = playerMap[ownerId]?.name || ownerId;
        contents.push(`${WANDERING_ICONS.wizard} ${name} x${count}`);
      });
    });
  if (!contents.length) {
    contents.push("Empty (空格)");
  }

  return `
    <h4>Board Space #${cell.index}</h4>
    <p>卡片顶部显示格子编号与${WANDERING_ICONS.castle}乌鸦堡位置。</p>
    <p>堆叠区从下到上显示该格子的所有实体：</p>
    <ul>
      <li>${WANDERING_ICONS.tower} + ID：飞塔（${WANDERING_ICONS.shield} 表示带乌鸦盾）。</li>
      <li>${WANDERING_ICONS.wizard} 玩家巫师：按玩家颜色显示，xN 表示该层可见巫师数量。</li>
      <li>${WANDERING_ICONS.castle} Ravenskeep：乌鸦堡位置。</li>
      <li>Empty：空格。</li>
    </ul>
    <p><strong>当前内容：</strong> ${contents.join("，")}</p>
  `;
}

function showWanderingCellExplanation(view, cell) {
  if (!wanderingTowersExplainContent || !wanderingTowersExplainModal) {
    return;
  }
  wanderingTowersExplainContent.innerHTML = buildWanderingCellExplanation(view, cell);
  setModalVisible(wanderingTowersExplainModal, true);
}

function renderWanderingBoard(view) {
  if (!wanderingBoard) {
    return;
  }
  wanderingBoard.innerHTML = "";
  if (!view || !Array.isArray(view.board)) {
    wanderingBoard.textContent = "-";
    return;
  }
  const colorMap = getWanderingColorMap(view);
  view.board.forEach((cell) => {
    const cellEl = document.createElement("div");
    cellEl.className = "wandering-cell";
    if (wanderingExplainMode) {
      cellEl.classList.add("has-explanation");
    }
    const header = document.createElement("div");
    header.className = "wandering-cell-header";
    const index = document.createElement("span");
    index.textContent = `#${cell.index}`;
    const hasRaven = Array.isArray(cell.layers)
      ? cell.layers.some((layer) => layer.type === "ravenskeep")
      : false;
    const raven = document.createElement("span");
    raven.className = "wandering-raven";
    raven.textContent = hasRaven ? WANDERING_ICONS.castle : "";
    header.appendChild(index);
    header.appendChild(raven);
    cellEl.appendChild(header);

    const stack = document.createElement("div");
    stack.className = "wandering-stack";
    if (Array.isArray(cell.layers) && cell.layers.length) {
      cell.layers.forEach((layer) => {
        const layerEl = document.createElement("div");
        layerEl.className = "wandering-layer";
        if (layer.type === "tower") {
          layerEl.classList.add("tower-layer");
          layerEl.textContent = `${WANDERING_ICONS.tower} ${layer.tower_id}`;
          if (layer.has_shield) {
            const shield = document.createElement("span");
            shield.className = "wandering-shield";
            shield.textContent = WANDERING_ICONS.shield;
            layerEl.appendChild(shield);
          }
        } else if (layer.type === "ravenskeep") {
          layerEl.classList.add("raven-layer");
          layerEl.textContent = `${WANDERING_ICONS.castle} Ravenskeep`;
        } else if (layer.type === "wizards") {
          layerEl.classList.add("wizard-layer");
          const ownerCounts = {};
          (layer.wizards || []).forEach((wiz) => {
            ownerCounts[wiz.owner_id] = (ownerCounts[wiz.owner_id] || 0) + 1;
          });
          Object.entries(ownerCounts).forEach(([ownerId, count]) => {
            const badge = document.createElement("span");
            badge.className = "wandering-wizard-chip";
            badge.style.setProperty("--wizard-color", colorMap[ownerId] || "#111");
            const name = getWanderingPlayerMap(view)[ownerId]?.name || ownerId;
            badge.textContent = `${WANDERING_ICONS.wizard} ${name} x${count}`;
            layerEl.appendChild(badge);
          });
        }
        stack.appendChild(layerEl);
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "wandering-layer empty";
      empty.textContent = "Empty";
      stack.appendChild(empty);
    }
    cellEl.appendChild(stack);
    cellEl.addEventListener("click", (e) => {
      if (!wanderingExplainMode) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      showWanderingCellExplanation(view, cell);
      exitWanderingExplainMode();
    });

    wanderingBoard.appendChild(cellEl);
  });
}

function renderWanderingHand(view) {
  if (!wanderingHand) {
    return;
  }
  wanderingHand.innerHTML = "";
  if (!view || !Array.isArray(view.hand) || !view.hand.length) {
    wanderingHand.textContent = "-";
    return;
  }
  view.hand.forEach((card, idx) => {
    const cardEl = document.createElement("div");
    cardEl.className = "wandering-card";
    if (idx === wanderingSelectedCardIndex) {
      cardEl.classList.add("selected");
    }
    cardEl.textContent = formatWanderingCard(card);
    cardEl.addEventListener("click", () => {
      wanderingSelectedCardIndex = idx;
      updateWanderingSelectionLabel();
      updateWanderingActionButtons();
      renderWanderingHand(view);
    });
    wanderingHand.appendChild(cardEl);
  });
}

function renderWanderingWizards(view) {
  if (!wanderingWizards) {
    return;
  }
  wanderingWizards.innerHTML = "";
  if (!view || !Array.isArray(view.wizards)) {
    wanderingWizards.textContent = "-";
    return;
  }
  const legal = getWanderingLegalTargets(view);
  const spellTargets = getWanderingSpellTargets(view, "move_wizard");
  const allowed = new Set([...(legal.wizard || []), ...(spellTargets.wizard || [])]);
  const visibleWizards = view.wizards.filter((wiz) => wiz.visible);
  if (!visibleWizards.length) {
    wanderingWizards.textContent = "-";
    return;
  }
  visibleWizards.forEach((wiz) => {
    const item = document.createElement("div");
    item.className = "wandering-item";
    const label = document.createElement("span");
    label.textContent = formatWanderingWizardLabel(view, wiz.wizard_id);
    item.appendChild(label);
    const isAllowed = allowed.has(wiz.wizard_id);
    if (!isAllowed && currentWanderingView?.pending) {
      item.classList.add("disabled");
    }
    if (wanderingSelectedWizardId === wiz.wizard_id) {
      item.classList.add("selected");
    }
    item.addEventListener("click", () => {
      if (currentWanderingView?.pending && !isAllowed) {
        return;
      }
      wanderingSelectedWizardId = wiz.wizard_id;
      wanderingSelectedTowerId = null;
      updateWanderingSelectionLabel();
      updateWanderingActionButtons();
      renderWanderingWizards(view);
      renderWanderingTowers(view);
    });
    wanderingWizards.appendChild(item);
  });
}

function renderWanderingTowers(view) {
  if (!wanderingTowers) {
    return;
  }
  wanderingTowers.innerHTML = "";
  if (!view || !Array.isArray(view.towers)) {
    wanderingTowers.textContent = "-";
    return;
  }
  const legal = getWanderingLegalTargets(view);
  const spellTargets = getWanderingSpellTargets(view, "move_tower");
  const allowed = new Set([...(legal.tower || []), ...(spellTargets.tower || [])]);
  view.towers.forEach((tower) => {
    const item = document.createElement("div");
    item.className = "wandering-item";
    const shield = tower.has_shield ? ` ${WANDERING_ICONS.shield}` : "";
    item.textContent = `${WANDERING_ICONS.tower} ${tower.tower_id} @${tower.position}${shield}`;
    const isAllowed = allowed.has(tower.tower_id);
    if (!isAllowed && currentWanderingView?.pending) {
      item.classList.add("disabled");
    }
    if (wanderingSelectedTowerId === tower.tower_id) {
      item.classList.add("selected");
    }
    item.addEventListener("click", () => {
      if (currentWanderingView?.pending && !isAllowed) {
        return;
      }
      wanderingSelectedTowerId = tower.tower_id;
      wanderingSelectedWizardId = null;
      updateWanderingSelectionLabel();
      updateWanderingActionButtons();
      renderWanderingTowers(view);
      renderWanderingWizards(view);
    });
    wanderingTowers.appendChild(item);
  });
}

function renderWanderingPlayers(view) {
  if (!wanderingPlayers) {
    return;
  }
  wanderingPlayers.innerHTML = "";
  if (!view || !Array.isArray(view.players)) {
    wanderingPlayers.textContent = "-";
    return;
  }
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "wandering-player-card";
    if (p.player_id === view.current_player) {
      card.classList.add("current");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name || p.player_id;
    const meta = document.createElement("div");
    meta.className = "player-meta";
    const potions = p.potions || { empty: 0, full: 0, spent: 0 };
    meta.textContent = `hand ${p.hand_count} | wizards ${p.wizards_in_ravenskeep}/${p.wizards_total} | potions E${potions.empty} F${potions.full} S${potions.spent}`;
    card.appendChild(name);
    card.appendChild(meta);
    wanderingPlayers.appendChild(card);
  });
}

function isWanderingActionAvailable(actionType) {
  if (currentGameType !== "wandering_towers" || !currentWanderingView) {
    return false;
  }
  if (!Array.isArray(currentWanderingView.legal_actions)) {
    return false;
  }
  if (!currentWanderingView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "play_card") {
    return wanderingSelectedCardIndex !== null;
  }
  if (actionType === "discard_move") {
    return (
      !!wanderingSelectedTowerId &&
      isWanderingTowerMoveLegal(currentWanderingView, wanderingSelectedTowerId, 1)
    );
  }
  if (actionType === "choose_target") {
    const legal = getWanderingLegalTargets(currentWanderingView);
    if (wanderingSelectedWizardId && legal.wizard.includes(wanderingSelectedWizardId)) {
      return true;
    }
    if (wanderingSelectedTowerId && legal.tower.includes(wanderingSelectedTowerId)) {
      return true;
    }
    return false;
  }
  return true;
}

function isWanderingSpellAvailable(spellId) {
  if (currentGameType !== "wandering_towers" || !currentWanderingView) {
    return false;
  }
  if (!Array.isArray(currentWanderingView.legal_actions)) {
    return false;
  }
  if (!currentWanderingView.legal_actions.includes("cast_spell")) {
    return false;
  }
  const targets = getWanderingSpellTargets(currentWanderingView, spellId);
  if (spellId === "move_wizard") {
    return !!wanderingSelectedWizardId && targets.wizard.includes(wanderingSelectedWizardId);
  }
  if (spellId === "move_tower") {
    return (
      !!wanderingSelectedTowerId &&
      targets.tower.includes(wanderingSelectedTowerId) &&
      isWanderingTowerMoveLegal(currentWanderingView, wanderingSelectedTowerId, 2)
    );
  }
  return false;
}

function updateWanderingActionButtons() {
  const buttons = [
    wanderingPlayCardBtn,
    wanderingDiscardBtn,
    wanderingRerollBtn,
    wanderingAcceptRollBtn,
    wanderingResolveBtn,
    wanderingSpellWizardBtn,
    wanderingSpellTowerBtn,
  ];
  if (currentGameType !== "wandering_towers") {
    buttons.forEach((btn) => {
      if (!btn) return;
      btn.classList.remove("action-allowed");
      btn.disabled = true;
    });
    return;
  }
  if (wanderingPlayCardBtn) {
    const allowed = isWanderingActionAvailable("play_card");
    wanderingPlayCardBtn.disabled = !allowed;
    wanderingPlayCardBtn.classList.toggle("action-allowed", allowed);
  }
  if (wanderingDiscardBtn) {
    const allowed = isWanderingActionAvailable("discard_move");
    wanderingDiscardBtn.disabled = !allowed;
    wanderingDiscardBtn.classList.toggle("action-allowed", allowed);
  }
  if (wanderingRerollBtn) {
    const allowed = isWanderingActionAvailable("reroll_dice");
    wanderingRerollBtn.disabled = !allowed;
    wanderingRerollBtn.classList.toggle("action-allowed", allowed);
  }
  if (wanderingAcceptRollBtn) {
    const allowed = isWanderingActionAvailable("accept_roll");
    wanderingAcceptRollBtn.disabled = !allowed;
    wanderingAcceptRollBtn.classList.toggle("action-allowed", allowed);
  }
  if (wanderingResolveBtn) {
    const allowed = isWanderingActionAvailable("choose_target");
    wanderingResolveBtn.disabled = !allowed;
    wanderingResolveBtn.classList.toggle("action-allowed", allowed);
  }
  if (wanderingSpellWizardBtn) {
    const allowed = isWanderingSpellAvailable("move_wizard");
    wanderingSpellWizardBtn.disabled = !allowed;
    wanderingSpellWizardBtn.classList.toggle("action-allowed", allowed);
  }
  if (wanderingSpellTowerBtn) {
    const allowed = isWanderingSpellAvailable("move_tower");
    wanderingSpellTowerBtn.disabled = !allowed;
    wanderingSpellTowerBtn.classList.toggle("action-allowed", allowed);
  }
}

function renderWanderingTowersGameState(data) {
  const view = data.view;
  currentWanderingView = view;
  if (!view) {
    return;
  }
  const playerMap = getWanderingPlayerMap(view);
  if (wanderingTurnLabel) {
    wanderingTurnLabel.textContent = playerMap[view.current_player]?.name || view.current_player || "-";
  }
  if (wanderingCardsLabel) {
    wanderingCardsLabel.textContent = `${view.cards_played ?? 0}/${view.cards_per_turn ?? 2}`;
  }
  if (wanderingDeckLabel) {
    wanderingDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (wanderingDiscardLabel) {
    wanderingDiscardLabel.textContent = view.discard_count ?? "-";
  }
  if (wanderingPendingLabel) {
    wanderingPendingLabel.textContent = formatWanderingPending(view);
  }
  if (wanderingFinalRoundLabel) {
    wanderingFinalRoundLabel.textContent = view.final_round ? "Yes" : "No";
  }
  if (wanderingWinnerLabel) {
    const winners = Array.isArray(view.winner) ? view.winner : [];
    const winnerNames = winners.map((pid) => playerMap[pid]?.name || pid);
    wanderingWinnerLabel.textContent = winnerNames.length ? winnerNames.join(", ") : "-";
  }
  if (wanderingSoloResultLabel) {
    wanderingSoloResultLabel.textContent = view.solo_result || "-";
  }
  if (wanderingSoloScoreLabel) {
    wanderingSoloScoreLabel.textContent = Number.isFinite(view.solo_score) ? view.solo_score : "-";
  }

  if (wanderingSelectedCardIndex !== null) {
    if (!view.hand || wanderingSelectedCardIndex >= view.hand.length) {
      wanderingSelectedCardIndex = null;
    }
  }
  if (wanderingSelectedWizardId) {
    const exists = Array.isArray(view.wizards)
      ? view.wizards.some((w) => w.wizard_id === wanderingSelectedWizardId && w.visible)
      : false;
    if (!exists) {
      wanderingSelectedWizardId = null;
    }
  }
  if (wanderingSelectedTowerId) {
    const exists = Array.isArray(view.towers)
      ? view.towers.some((t) => t.tower_id === wanderingSelectedTowerId)
      : false;
    if (!exists) {
      wanderingSelectedTowerId = null;
    }
  }

  updateWanderingSelectionLabel();
  renderWanderingBoard(view);
  renderWanderingHand(view);
  renderWanderingWizards(view);
  renderWanderingTowers(view);
  renderWanderingPlayers(view);
  updateWanderingActionButtons();
}

function clearWanderingTowersState() {
  currentWanderingView = null;
  wanderingSelectedCardIndex = null;
  wanderingSelectedWizardId = null;
  wanderingSelectedTowerId = null;
  if (wanderingTurnLabel) wanderingTurnLabel.textContent = "-";
  if (wanderingCardsLabel) wanderingCardsLabel.textContent = "-";
  if (wanderingDeckLabel) wanderingDeckLabel.textContent = "-";
  if (wanderingDiscardLabel) wanderingDiscardLabel.textContent = "-";
  if (wanderingPendingLabel) wanderingPendingLabel.textContent = "-";
  if (wanderingFinalRoundLabel) wanderingFinalRoundLabel.textContent = "-";
  if (wanderingWinnerLabel) wanderingWinnerLabel.textContent = "-";
  if (wanderingSoloResultLabel) wanderingSoloResultLabel.textContent = "-";
  if (wanderingSoloScoreLabel) wanderingSoloScoreLabel.textContent = "-";
  if (wanderingBoard) wanderingBoard.textContent = "";
  if (wanderingHand) wanderingHand.textContent = "";
  if (wanderingWizards) wanderingWizards.textContent = "";
  if (wanderingTowers) wanderingTowers.textContent = "";
  if (wanderingPlayers) wanderingPlayers.textContent = "";
  updateWanderingSelectionLabel();
  updateWanderingActionButtons();
}

function showWanderingTowersHeaderActions(show) {
  if (wanderingTowersHeaderActions) {
    wanderingTowersHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitWanderingExplainMode();
    closeWanderingHelpModal();
    closeWanderingExplainModal();
  }
}

function showWanderingHelpModal() {
  if (!wanderingTowersHelpModal) {
    return;
  }
  if (wanderingTowersHelpContent) {
    wanderingTowersHelpContent.innerHTML = WANDERING_HELP_TEXT;
  }
  setModalVisible(wanderingTowersHelpModal, true);
}

function closeWanderingHelpModal() {
  if (wanderingTowersHelpModal) {
    setModalVisible(wanderingTowersHelpModal, false);
  }
}

function updateWanderingExplainModeClasses(enabled) {
  Object.keys(WANDERING_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
  if (wanderingBoard) {
    wanderingBoard.querySelectorAll(".wandering-cell").forEach((cell) => {
      cell.classList.toggle("has-explanation", enabled);
    });
  }
}

function findWanderingButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(WANDERING_BUTTON_EXPLANATIONS)) {
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  return null;
}

function toggleWanderingExplainMode() {
  wanderingExplainMode = !wanderingExplainMode;
  document.body.classList.toggle("wandering-towers-explain-mode", wanderingExplainMode);
  updateWanderingExplainModeClasses(wanderingExplainMode);
  if (wanderingTowersExplainBtn) {
    wanderingTowersExplainBtn.classList.toggle("active", wanderingExplainMode);
  }
}

function exitWanderingExplainMode() {
  if (!wanderingExplainMode) {
    return;
  }
  wanderingExplainMode = false;
  document.body.classList.remove("wandering-towers-explain-mode");
  updateWanderingExplainModeClasses(false);
  if (wanderingTowersExplainBtn) {
    wanderingTowersExplainBtn.classList.remove("active");
  }
}

function showWanderingButtonExplanation(buttonId) {
  const explanation = WANDERING_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !wanderingTowersExplainContent || !wanderingTowersExplainModal) {
    return;
  }
  wanderingTowersExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
  `;
  setModalVisible(wanderingTowersExplainModal, true);
}

function closeWanderingExplainModal() {
  if (wanderingTowersExplainModal) {
    setModalVisible(wanderingTowersExplainModal, false);
  }
}

if (wanderingPlayCardBtn) {
  wanderingPlayCardBtn.addEventListener("click", () => {
    if (!isWanderingActionAvailable("play_card")) {
      return;
    }
    sendAction({ type: "play_card", card_index: wanderingSelectedCardIndex });
  });
}

if (wanderingDiscardBtn) {
  wanderingDiscardBtn.addEventListener("click", () => {
    if (!isWanderingActionAvailable("discard_move")) {
      return;
    }
    sendAction({ type: "discard_move", tower_id: wanderingSelectedTowerId });
  });
}

if (wanderingRerollBtn) {
  wanderingRerollBtn.addEventListener("click", () => {
    if (!isWanderingActionAvailable("reroll_dice")) {
      return;
    }
    sendAction({ type: "reroll_dice" });
  });
}

if (wanderingAcceptRollBtn) {
  wanderingAcceptRollBtn.addEventListener("click", () => {
    if (!isWanderingActionAvailable("accept_roll")) {
      return;
    }
    sendAction({ type: "accept_roll" });
  });
}

if (wanderingResolveBtn) {
  wanderingResolveBtn.addEventListener("click", () => {
    if (!isWanderingActionAvailable("choose_target")) {
      return;
    }
    if (wanderingSelectedWizardId) {
      sendAction({
        type: "choose_target",
        target_type: "wizard",
        target_id: wanderingSelectedWizardId,
      });
      return;
    }
    if (wanderingSelectedTowerId) {
      sendAction({
        type: "choose_target",
        target_type: "tower",
        target_id: wanderingSelectedTowerId,
      });
    }
  });
}

if (wanderingSpellWizardBtn) {
  wanderingSpellWizardBtn.addEventListener("click", () => {
    if (!isWanderingSpellAvailable("move_wizard")) {
      return;
    }
    sendAction({ type: "cast_spell", spell: "move_wizard", target_id: wanderingSelectedWizardId });
  });
}

if (wanderingSpellTowerBtn) {
  wanderingSpellTowerBtn.addEventListener("click", () => {
    if (!isWanderingSpellAvailable("move_tower")) {
      return;
    }
    sendAction({ type: "cast_spell", spell: "move_tower", target_id: wanderingSelectedTowerId });
  });
}

if (wanderingSelection) {
  wanderingSelection.addEventListener("click", (e) => {
    if (e.target === wanderingSelection || e.target === wanderingSelectionLabel) {
      clearWanderingSelection();
    }
  });
}

if (wanderingTowersHelpBtn) {
  wanderingTowersHelpBtn.addEventListener("click", () => {
    showWanderingHelpModal();
  });
}

if (wanderingTowersHelpModalCloseBtn) {
  wanderingTowersHelpModalCloseBtn.addEventListener("click", closeWanderingHelpModal);
}

if (wanderingTowersExplainBtn) {
  wanderingTowersExplainBtn.addEventListener("click", () => {
    toggleWanderingExplainMode();
  });
}

if (wanderingTowersExplainModalCloseBtn) {
  wanderingTowersExplainModalCloseBtn.addEventListener("click", closeWanderingExplainModal);
}

// Capture pointer events in explain mode (works on disabled buttons too)
document.addEventListener(
  "pointerdown",
  (e) => {
    if (!wanderingExplainMode) return;

    const buttonId = findWanderingButtonAtPoint(e.clientX, e.clientY);
    if (buttonId) {
      e.preventDefault();
      e.stopPropagation();
      showWanderingButtonExplanation(buttonId);
      exitWanderingExplainMode();
      return;
    }

    const button = e.target.closest("button");
    if (button === wanderingTowersExplainBtn || button === wanderingTowersHelpBtn) return;
    if (button === wanderingTowersHelpModalCloseBtn || button === wanderingTowersExplainModalCloseBtn) return;

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
    if (!wanderingExplainMode) return;

    const button = e.target.closest("button");
    if (!button) return;

    if (button === wanderingTowersExplainBtn || button === wanderingTowersHelpBtn) return;
    if (button === wanderingTowersHelpModalCloseBtn || button === wanderingTowersExplainModalCloseBtn) return;

    e.preventDefault();
    e.stopPropagation();
  },
  true
);

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") {
    return;
  }
  if (wanderingExplainMode) {
    exitWanderingExplainMode();
    e.preventDefault();
    return;
  }
  let closed = false;
  if (wanderingTowersHelpModal && !wanderingTowersHelpModal.classList.contains("hidden")) {
    closeWanderingHelpModal();
    closed = true;
  }
  if (wanderingTowersExplainModal && !wanderingTowersExplainModal.classList.contains("hidden")) {
    closeWanderingExplainModal();
    closed = true;
  }
  if (closed) {
    e.preventDefault();
  }
});
