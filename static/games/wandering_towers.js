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
const wanderingPendingStatus = document.getElementById("wanderingPendingStatus");
const wanderingFinalRoundStatus = document.getElementById("wanderingFinalRoundStatus");
const wanderingWinnerStatus = document.getElementById("wanderingWinnerStatus");
const wanderingSoloStatus = document.getElementById("wanderingSoloStatus");

const wanderingBoard = document.getElementById("wanderingBoard");
const wanderingHand = document.getElementById("wanderingHand");
const wanderingPlayers = document.getElementById("wanderingPlayers");
const wanderingSelection = document.getElementById("wanderingSelection");
const wanderingSelectionLabel = document.getElementById("wanderingSelectionLabel");
const wanderingActionHint = document.getElementById("wanderingActionHint");

const wanderingPlayCardBtn = document.getElementById("wanderingPlayCardBtn");
const wanderingDiscardBtn = document.getElementById("wanderingDiscardBtn");
const wanderingRerollBtn = document.getElementById("wanderingRerollBtn");
const wanderingAcceptRollBtn = document.getElementById("wanderingAcceptRollBtn");
const wanderingSpellWizardBtn = document.getElementById("wanderingSpellWizardBtn");
const wanderingSpellTowerBtn = document.getElementById("wanderingSpellTowerBtn");

const WANDERING_ICONS = {
  wizard: String.fromCodePoint(0x1f9d9),
  tower: "♜",
  shield: String.fromCodePoint(0x1f6e1),
  castle: String.fromCodePoint(0x1f3f0),
  dice: String.fromCodePoint(0x1f3b2),
};

const WANDERING_HELP_TEXT = `
<h3>Goal</h3>
<p>Guide all of your wizards into Ravenskeep and fill all your potion flasks (no empty flasks remaining). When someone finishes, the round ends after the player to the right of the start player completes their turn.</p>

<h3>Icons</h3>
<ul>
  <li>${WANDERING_ICONS.wizard} Wizard (巫师)</li>
  <li>${WANDERING_ICONS.tower} Tower (飞塔)</li>
  <li>${WANDERING_ICONS.shield} Raven Shield (乌鸦盾)</li>
  <li>${WANDERING_ICONS.castle} Ravenskeep / Castle (乌鸦堡)</li>
  <li>${WANDERING_ICONS.dice} Dice (骰子)</li>
</ul>

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
    renderWanderingBoard(currentWanderingView);
    renderWanderingHand(currentWanderingView);
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
  wanderingSelectionLabel.textContent = parts.join(" · ") || "No selection";
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
  const displayLayers = layers.slice().reverse();
  const contents = [];
  const hasRaven = layers.some((layer) => layer.type === "ravenskeep");
  if (hasRaven) {
    contents.push(`${WANDERING_ICONS.castle} 乌鸦堡 (Ravenskeep)`);
  }
  displayLayers.forEach((layer) => {
    if (layer.type === "tower") {
      const shield = layer.has_shield ? ` ${WANDERING_ICONS.shield}` : "";
      contents.push(`${WANDERING_ICONS.tower} ${layer.tower_id}${shield}`);
      return;
    }
    if (layer.type === "wizards") {
      const ownerCounts = {};
      (layer.wizards || []).forEach((wiz) => {
        ownerCounts[wiz.owner_id] = (ownerCounts[wiz.owner_id] || 0) + 1;
      });
      Object.entries(ownerCounts).forEach(([ownerId, count]) => {
        const name = playerMap[ownerId]?.name || ownerId;
        contents.push(`${WANDERING_ICONS.wizard} ${name} x${count}`);
      });
      return;
    }
    if (layer.type === "ravenskeep") {
      contents.push(`${WANDERING_ICONS.castle} Ravenskeep`);
    }
  });
  if (!contents.length) {
    contents.push("Empty (空格)");
  }

  return `
    <h4>Board Space #${cell.index}</h4>
    <p>卡片顶部显示格子编号与${WANDERING_ICONS.castle}乌鸦堡位置。</p>
    <p>堆叠区从上到下显示该格子的所有实体：</p>
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

function confirmWanderingTarget(targetType, targetId) {
  if (!isWanderingActionAvailable("choose_target")) {
    return;
  }
  const selectedId =
    targetType === "wizard" ? wanderingSelectedWizardId : wanderingSelectedTowerId;
  if (selectedId !== targetId) {
    return;
  }
  clearWanderingSelection();
  sendAction({
    type: "choose_target",
    target_type: targetType,
    target_id: targetId,
  });
}

function createWanderingTargetConfirmation(targetType, targetId, targetLabel) {
  const overlay = document.createElement("div");
  overlay.className = "wandering-target-confirmation";
  overlay.setAttribute("role", "group");
  overlay.setAttribute("aria-label", `Confirm moving ${targetLabel}`);

  const moveBtn = document.createElement("button");
  moveBtn.type = "button";
  moveBtn.className = "wandering-target-confirm wandering-target-move";
  moveBtn.textContent = "Move";
  moveBtn.setAttribute("aria-label", `Move ${targetLabel}`);
  moveBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    confirmWanderingTarget(targetType, targetId);
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "wandering-target-confirm wandering-target-cancel";
  cancelBtn.textContent = "Cancel";
  cancelBtn.setAttribute("aria-label", `Cancel moving ${targetLabel}`);
  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearWanderingSelection();
  });

  overlay.addEventListener("click", (e) => e.stopPropagation());
  overlay.appendChild(moveBtn);
  overlay.appendChild(cancelBtn);
  return overlay;
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
  const playerMap = getWanderingPlayerMap(view);
  const visibleWizardIds = new Set(
    (view.wizards || []).filter((wizard) => wizard.visible).map((wizard) => wizard.wizard_id)
  );
  const pendingTargets = view.pending ? getWanderingLegalTargets(view) : null;
  const canConfirmTarget =
    Array.isArray(view.legal_actions) && view.legal_actions.includes("choose_target");
  view.board.forEach((cell) => {
    const layers = Array.isArray(cell.layers) ? cell.layers : [];
    const towerCount = layers.filter((layer) => layer.type === "tower").length;
    const hasRaven = layers.some((layer) => layer.type === "ravenskeep");
    const cellEl = document.createElement("div");
    cellEl.className = "wandering-cell";
    cellEl.dataset.cellIndex = String(cell.index);
    cellEl.classList.toggle("has-ravenskeep", hasRaven);
    cellEl.classList.toggle("is-empty", layers.length === 0);
    cellEl.setAttribute(
      "aria-label",
      `Board space ${cell.index}: ${layers.length} ${layers.length === 1 ? "layer" : "layers"}, ${towerCount} ${towerCount === 1 ? "tower" : "towers"}`
    );
    if (wanderingExplainMode) {
      cellEl.classList.add("has-explanation");
    }
    const header = document.createElement("div");
    header.className = "wandering-cell-header";
    const index = document.createElement("span");
    index.className = "wandering-position-number";
    index.textContent = cell.index;
    index.title = `Board space ${cell.index}`;
    const layerCount = document.createElement("span");
    layerCount.className = "wandering-stack-count";
    layerCount.title = `${layers.length} stacked ${layers.length === 1 ? "layer" : "layers"} (${towerCount} ${towerCount === 1 ? "tower" : "towers"})`;
    const layerIcon = document.createElement("span");
    layerIcon.setAttribute("aria-hidden", "true");
    layerIcon.textContent = "▥";
    const layerNumber = document.createElement("strong");
    layerNumber.textContent = String(layers.length);
    layerCount.appendChild(layerIcon);
    layerCount.appendChild(layerNumber);
    const raven = document.createElement("span");
    raven.className = "wandering-raven";
    raven.textContent = hasRaven ? WANDERING_ICONS.castle : "";
    raven.title = hasRaven ? "Ravenskeep is here" : "";
    header.appendChild(index);
    header.appendChild(layerCount);
    header.appendChild(raven);
    cellEl.appendChild(header);

    const stack = document.createElement("div");
    stack.className = "wandering-stack";
    if (layers.length) {
      const displayLayers = layers.slice().reverse();
      displayLayers.forEach((layer, displayIndex) => {
        const layerEl = document.createElement(layer.type === "tower" ? "button" : "div");
        let renderedLayer = layerEl;
        layerEl.className = "wandering-layer";
        const sourceDepth = layers.length - displayIndex;
        const depthLabel = document.createElement("span");
        depthLabel.className = "wandering-layer-index";
        depthLabel.textContent = `L${sourceDepth}`;
        depthLabel.setAttribute("aria-hidden", "true");
        if (layer.type === "tower") {
          layerEl.type = "button";
          layerEl.classList.add("tower-layer");
          layerEl.setAttribute("aria-label", `Tower ${layer.tower_id}, layer ${sourceDepth}${layer.has_shield ? ", raven shield" : ""}`);
          const selected = layer.tower_id === wanderingSelectedTowerId;
          if (selected) {
            layerEl.classList.add("selected");
          }
          if (pendingTargets) {
            const legalTarget = pendingTargets.tower.includes(layer.tower_id);
            layerEl.classList.toggle("legal-target", legalTarget);
            layerEl.disabled = !legalTarget;
          }
          const towerFigure = document.createElement("span");
          towerFigure.className = "wandering-tower-figure";
          towerFigure.setAttribute("aria-hidden", "true");
          const towerId = document.createElement("span");
          towerId.className = "wandering-tower-id";
          towerId.textContent = layer.tower_id;
          layerEl.appendChild(towerFigure);
          layerEl.appendChild(towerId);
          if (layer.has_shield) {
            const shield = document.createElement("span");
            shield.className = "wandering-shield";
            shield.textContent = WANDERING_ICONS.shield;
            shield.title = "Raven shield";
            layerEl.appendChild(shield);
          }
          layerEl.addEventListener("click", (e) => {
            if (wanderingExplainMode) {
              return;
            }
            e.stopPropagation();
            if (currentWanderingView?.pending) {
              const legal = getWanderingLegalTargets(currentWanderingView);
              if (!legal.tower.includes(layer.tower_id)) {
                return;
              }
            }
            wanderingSelectedTowerId = layer.tower_id;
            wanderingSelectedWizardId = null;
            wanderingSelectedCardIndex = null;
            updateWanderingSelectionLabel();
            updateWanderingActionButtons();
            renderWanderingBoard(view);
          });
          const shell = document.createElement("div");
          shell.className = "wandering-target-shell wandering-tower-target-shell";
          shell.appendChild(layerEl);
          if (selected && canConfirmTarget && pendingTargets?.tower.includes(layer.tower_id)) {
            shell.classList.add("has-confirmation");
            shell.appendChild(
              createWanderingTargetConfirmation("tower", layer.tower_id, `tower ${layer.tower_id}`)
            );
          }
          renderedLayer = shell;
        } else if (layer.type === "ravenskeep") {
          layerEl.classList.add("raven-layer");
          const castle = document.createElement("span");
          castle.className = "wandering-ravenskeep-icon";
          castle.textContent = WANDERING_ICONS.castle;
          castle.setAttribute("aria-hidden", "true");
          const castleName = document.createElement("span");
          castleName.className = "wandering-ravenskeep-name";
          castleName.textContent = "Ravenskeep";
          layerEl.appendChild(castle);
          layerEl.appendChild(castleName);
          layerEl.setAttribute("aria-label", `Ravenskeep, layer ${sourceDepth}`);
        } else if (layer.type === "wizards") {
          layerEl.classList.add("wizard-layer");
          const ownerWizards = {};
          (layer.wizards || []).forEach((wiz) => {
            if (!ownerWizards[wiz.owner_id]) {
              ownerWizards[wiz.owner_id] = [];
            }
            ownerWizards[wiz.owner_id].push(wiz);
          });
          Object.entries(ownerWizards).forEach(([ownerId, wizards]) => {
            const badge = document.createElement("button");
            badge.type = "button";
            badge.className = "wandering-wizard-chip";
            badge.style.setProperty("--wizard-color", colorMap[ownerId] || "#111");
            const name = playerMap[ownerId]?.name || ownerId;
            const wizardId = wizards.find((wizard) => visibleWizardIds.has(wizard.wizard_id))?.wizard_id || null;
            const isTrapped = !wizardId;
            const wizardFigure = document.createElement("span");
            wizardFigure.className = "wandering-wizard-figure";
            wizardFigure.textContent = WANDERING_ICONS.wizard;
            wizardFigure.setAttribute("aria-hidden", "true");
            const wizardName = document.createElement("span");
            wizardName.className = "wandering-wizard-name";
            wizardName.textContent = name;
            const wizardCount = document.createElement("span");
            wizardCount.className = "wandering-wizard-count";
            wizardCount.textContent = `×${wizards.length}`;
            badge.appendChild(wizardFigure);
            badge.appendChild(wizardName);
            badge.appendChild(wizardCount);
            badge.setAttribute(
              "aria-label",
              `${name}: ${wizards.length} ${wizards.length === 1 ? "wizard" : "wizards"}, layer ${sourceDepth}${isTrapped ? ", trapped" : ", visible"}`
            );
            badge.title = `${name} ×${wizards.length}${isTrapped ? " · trapped under a tower" : " · visible"}`;
            if (isTrapped) {
              badge.classList.add("trapped");
              badge.disabled = true;
            }
            if (pendingTargets && wizardId) {
              const legalTarget = pendingTargets.wizard.includes(wizardId);
              badge.classList.toggle("legal-target", legalTarget);
              badge.disabled = !legalTarget;
            }
            const selected = Boolean(wizardId) && wizardId === wanderingSelectedWizardId;
            if (selected) {
              badge.classList.add("selected");
            }
            badge.addEventListener("click", (e) => {
              if (wanderingExplainMode) {
                return;
              }
              e.stopPropagation();
              if (!wizardId) {
                return;
              }
              if (currentWanderingView?.pending) {
                const legal = getWanderingLegalTargets(currentWanderingView);
                if (!legal.wizard.includes(wizardId)) {
                  return;
                }
              }
              wanderingSelectedWizardId = wizardId;
              wanderingSelectedTowerId = null;
              wanderingSelectedCardIndex = null;
              updateWanderingSelectionLabel();
              updateWanderingActionButtons();
              renderWanderingBoard(view);
            });
            const shell = document.createElement("div");
            shell.className = "wandering-target-shell wandering-wizard-target-shell";
            shell.appendChild(badge);
            if (selected && canConfirmTarget && pendingTargets?.wizard.includes(wizardId)) {
              shell.classList.add("has-confirmation");
              shell.appendChild(
                createWanderingTargetConfirmation("wizard", wizardId, `${name}'s wizard`)
              );
            }
            layerEl.appendChild(shell);
          });
        }
        layerEl.appendChild(depthLabel);
        stack.appendChild(renderedLayer);
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "wandering-layer empty";
      empty.textContent = "·";
      empty.setAttribute("aria-label", "Empty space");
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
  window.requestAnimationFrame(() => {
    const confirmation = wanderingBoard.querySelector(
      ".wandering-target-shell.has-confirmation"
    );
    const stack = confirmation?.closest(".wandering-stack");
    if (!confirmation || !stack) {
      return;
    }
    const confirmationRect = confirmation.getBoundingClientRect();
    const stackRect = stack.getBoundingClientRect();
    if (confirmationRect.bottom > stackRect.bottom) {
      stack.scrollTop += confirmationRect.bottom - stackRect.bottom;
    } else if (confirmationRect.top < stackRect.top) {
      stack.scrollTop -= stackRect.top - confirmationRect.top;
    }
  });
}

function renderWanderingHand(view) {
  if (!wanderingHand) {
    return;
  }
  wanderingHand.innerHTML = "";
  if (!view || !Array.isArray(view.hand) || !view.hand.length) {
    wanderingHand.textContent = "No cards";
    return;
  }
  const canChooseCard = Array.isArray(view.legal_actions) && view.legal_actions.includes("play_card");
  view.hand.forEach((card, idx) => {
    const cardEl = document.createElement("button");
    cardEl.type = "button";
    cardEl.className = "wandering-card";
    if (idx === wanderingSelectedCardIndex) {
      cardEl.classList.add("selected");
    }
    cardEl.disabled = !canChooseCard;
    const target = card.target || "either";
    const targetIcons =
      target === "wizard"
        ? WANDERING_ICONS.wizard
        : target === "tower"
          ? WANDERING_ICONS.tower
          : `${WANDERING_ICONS.wizard}${WANDERING_ICONS.tower}`;
    const targetName =
      target === "wizard" ? "wizard" : target === "tower" ? "tower" : "wizard or tower";
    const movement = card.dice ? `${WANDERING_ICONS.dice}×${card.dice}` : `+${card.value ?? "?"}`;
    const targetEl = document.createElement("span");
    targetEl.className = "wandering-card-target";
    targetEl.textContent = targetIcons;
    targetEl.setAttribute("aria-hidden", "true");
    const moveEl = document.createElement("span");
    moveEl.className = "wandering-card-move";
    moveEl.textContent = movement;
    moveEl.setAttribute("aria-hidden", "true");
    const numberEl = document.createElement("span");
    numberEl.className = "wandering-card-number";
    numberEl.textContent = String(idx + 1);
    numberEl.setAttribute("aria-hidden", "true");
    cardEl.appendChild(targetEl);
    cardEl.appendChild(moveEl);
    cardEl.appendChild(numberEl);
    cardEl.setAttribute(
      "aria-label",
      `Card ${idx + 1}: move ${targetName} ${card.dice ? `by a roll with ${card.dice} ${card.dice === 1 ? "die" : "dice"}` : `${card.value ?? "unknown"} steps`}`
    );
    cardEl.addEventListener("click", () => {
      wanderingSelectedCardIndex = idx;
      wanderingSelectedWizardId = null;
      wanderingSelectedTowerId = null;
      updateWanderingSelectionLabel();
      updateWanderingActionButtons();
      renderWanderingHand(view);
    });
    wanderingHand.appendChild(cardEl);
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
  const colorMap = getWanderingColorMap(view);
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "wandering-player-card";
    card.style.setProperty("--player-color", colorMap[p.player_id] || "#64748b");
    if (p.player_id === view.current_player) {
      card.classList.add("current");
    }
    if (p.player_id === view.you) {
      card.classList.add("self");
    }
    const marker = document.createElement("span");
    marker.className = "wandering-wizard-figure wandering-player-marker";
    marker.style.setProperty("--wizard-color", colorMap[p.player_id] || "#64748b");
    marker.textContent = WANDERING_ICONS.wizard;
    marker.setAttribute("aria-hidden", "true");
    const name = document.createElement("div");
    name.className = "wandering-player-name";
    name.textContent = p.name || p.player_id;
    const meta = document.createElement("div");
    meta.className = "wandering-player-meta";
    const potions = p.potions || { empty: 0, full: 0, spent: 0 };
    const hand = document.createElement("span");
    hand.textContent = `🃏 ${p.hand_count}`;
    hand.title = `${p.hand_count} cards in hand`;
    const wizards = document.createElement("span");
    wizards.textContent = `🏰 ${p.wizards_in_ravenskeep}/${p.wizards_total}`;
    wizards.title = `${p.wizards_in_ravenskeep} of ${p.wizards_total} wizards in Ravenskeep`;
    const potion = document.createElement("span");
    potion.textContent = `🧪 ${potions.full} · ○${potions.empty}`;
    potion.title = `${potions.full} full, ${potions.empty} empty, ${potions.spent} spent potions`;
    meta.appendChild(hand);
    meta.appendChild(wizards);
    meta.appendChild(potion);
    card.appendChild(marker);
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
    wanderingSpellWizardBtn,
    wanderingSpellTowerBtn,
  ];
  if (currentGameType !== "wandering_towers") {
    buttons.forEach((btn) => {
      if (!btn) return;
      btn.classList.remove("action-allowed");
      btn.classList.remove("is-relevant");
      btn.disabled = true;
    });
    updateWanderingActionHint();
    return;
  }
  const legalActions = Array.isArray(currentWanderingView?.legal_actions)
    ? currentWanderingView.legal_actions
    : [];
  if (wanderingPlayCardBtn) {
    const allowed = isWanderingActionAvailable("play_card");
    wanderingPlayCardBtn.disabled = !allowed;
    wanderingPlayCardBtn.classList.toggle("action-allowed", allowed);
    wanderingPlayCardBtn.classList.toggle("is-relevant", legalActions.includes("play_card"));
  }
  if (wanderingDiscardBtn) {
    const allowed = isWanderingActionAvailable("discard_move");
    wanderingDiscardBtn.disabled = !allowed;
    wanderingDiscardBtn.classList.toggle("action-allowed", allowed);
    wanderingDiscardBtn.classList.toggle("is-relevant", legalActions.includes("discard_move"));
  }
  if (wanderingRerollBtn) {
    const allowed = isWanderingActionAvailable("reroll_dice");
    wanderingRerollBtn.disabled = !allowed;
    wanderingRerollBtn.classList.toggle("action-allowed", allowed);
    wanderingRerollBtn.classList.toggle("is-relevant", legalActions.includes("reroll_dice"));
  }
  if (wanderingAcceptRollBtn) {
    const allowed = isWanderingActionAvailable("accept_roll");
    wanderingAcceptRollBtn.disabled = !allowed;
    wanderingAcceptRollBtn.classList.toggle("action-allowed", allowed);
    wanderingAcceptRollBtn.classList.toggle("is-relevant", legalActions.includes("accept_roll"));
  }
  if (wanderingSpellWizardBtn) {
    const allowed = isWanderingSpellAvailable("move_wizard");
    const targets = getWanderingSpellTargets(currentWanderingView, "move_wizard");
    const relevant = legalActions.includes("cast_spell") && targets.wizard.length > 0;
    wanderingSpellWizardBtn.disabled = !allowed;
    wanderingSpellWizardBtn.classList.toggle("action-allowed", allowed);
    wanderingSpellWizardBtn.classList.toggle("is-relevant", relevant);
  }
  if (wanderingSpellTowerBtn) {
    const allowed = isWanderingSpellAvailable("move_tower");
    const targets = getWanderingSpellTargets(currentWanderingView, "move_tower");
    const relevant = legalActions.includes("cast_spell") && targets.tower.length > 0;
    wanderingSpellTowerBtn.disabled = !allowed;
    wanderingSpellTowerBtn.classList.toggle("action-allowed", allowed);
    wanderingSpellTowerBtn.classList.toggle("is-relevant", relevant);
  }
  updateWanderingActionHint();
}

function updateWanderingActionHint() {
  if (!wanderingActionHint) {
    return;
  }
  const view = currentWanderingView;
  if (currentGameType !== "wandering_towers" || !view) {
    wanderingActionHint.textContent = "Waiting for game state…";
    return;
  }
  const playerMap = getWanderingPlayerMap(view);
  const currentName = playerMap[view.current_player]?.name || view.current_player || "the next player";
  if (view.game_over) {
    wanderingActionHint.textContent = "Game over.";
    return;
  }
  if (view.you !== view.current_player) {
    wanderingActionHint.textContent = `Waiting for ${currentName}.`;
    return;
  }
  if (view.pending) {
    const legal = getWanderingLegalTargets(view);
    if (wanderingSelectedWizardId || wanderingSelectedTowerId) {
      wanderingActionHint.textContent = "Target selected — choose Move or Cancel on it.";
    } else if (legal.wizard.length || legal.tower.length) {
      wanderingActionHint.textContent = "Choose a highlighted wizard or tower.";
    } else if (view.pending.rerolls_left > 0) {
      wanderingActionHint.textContent = "No legal target — reroll the die.";
    } else {
      wanderingActionHint.textContent = "No legal target — keep the roll to continue.";
    }
    return;
  }
  if (wanderingSelectedCardIndex !== null) {
    wanderingActionHint.textContent = "Card selected — play it to reveal legal targets.";
    return;
  }
  if (wanderingSelectedTowerId) {
    wanderingActionHint.textContent = "Tower selected — discard your hand or cast a spell.";
    return;
  }
  if (wanderingSelectedWizardId) {
    wanderingActionHint.textContent = "Wizard selected — cast a spell if available.";
    return;
  }
  wanderingActionHint.textContent = "Choose a card, or tap a tower for the discard move.";
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
  if (wanderingPendingStatus) {
    wanderingPendingStatus.classList.toggle("hidden", !view.pending);
  }
  if (wanderingFinalRoundLabel) {
    wanderingFinalRoundLabel.textContent = view.final_round ? "Active" : "-";
  }
  if (wanderingFinalRoundStatus) {
    wanderingFinalRoundStatus.classList.toggle("hidden", !view.final_round);
  }
  if (wanderingWinnerLabel) {
    const winners = Array.isArray(view.winner) ? view.winner : [];
    const winnerNames = winners.map((pid) => playerMap[pid]?.name || pid);
    wanderingWinnerLabel.textContent = winnerNames.length ? winnerNames.join(", ") : "-";
    if (wanderingWinnerStatus) {
      wanderingWinnerStatus.classList.toggle("hidden", winnerNames.length === 0);
    }
  }
  if (wanderingSoloResultLabel) {
    wanderingSoloResultLabel.textContent = view.solo_result || "-";
  }
  if (wanderingSoloScoreLabel) {
    wanderingSoloScoreLabel.textContent = Number.isFinite(view.solo_score) ? view.solo_score : "-";
  }
  if (wanderingSoloStatus) {
    const hasSoloResult = Boolean(view.solo_result) || Number.isFinite(view.solo_score);
    wanderingSoloStatus.classList.toggle("hidden", !hasSoloResult);
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
  if (wanderingPendingStatus) wanderingPendingStatus.classList.add("hidden");
  if (wanderingFinalRoundStatus) wanderingFinalRoundStatus.classList.add("hidden");
  if (wanderingWinnerStatus) wanderingWinnerStatus.classList.add("hidden");
  if (wanderingSoloStatus) wanderingSoloStatus.classList.add("hidden");
  if (wanderingBoard) wanderingBoard.textContent = "";
  if (wanderingHand) wanderingHand.textContent = "";
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
    const cardIndex = wanderingSelectedCardIndex;
    wanderingSelectedCardIndex = null;
    updateWanderingSelectionLabel();
    updateWanderingActionButtons();
    renderWanderingHand(currentWanderingView);
    sendAction({ type: "play_card", card_index: cardIndex });
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

if (wanderingBoard) {
  wanderingBoard.addEventListener("click", (e) => {
    if (wanderingExplainMode) {
      return;
    }
    if (e.target.closest(".wandering-layer") || e.target.closest(".wandering-wizard-chip")) {
      return;
    }
    if (e.target.closest(".wandering-cell") || e.target === wanderingBoard) {
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

    const boardCell = e.target.closest(".wandering-cell");
    if (boardCell && wanderingBoard?.contains(boardCell)) {
      const cellIndex = Number(boardCell.dataset.cellIndex);
      const cell = currentWanderingView?.board?.find((entry) => entry.index === cellIndex);
      if (cell) {
        e.preventDefault();
        e.stopPropagation();
        showWanderingCellExplanation(currentWanderingView, cell);
        exitWanderingExplainMode();
        return;
      }
    }

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
    return;
  }
  if (
    wanderingSelectedCardIndex !== null ||
    wanderingSelectedWizardId ||
    wanderingSelectedTowerId
  ) {
    clearWanderingSelection();
    e.preventDefault();
  }
});
