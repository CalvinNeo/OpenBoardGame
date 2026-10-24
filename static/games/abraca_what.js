const abracaHeaderActions = document.getElementById("abracaHeaderActions");
const abracaHelpBtn = document.getElementById("abracaHelpBtn");
const abracaExplainBtn = document.getElementById("abracaExplainBtn");
const abracaHelpModal = document.getElementById("abracaHelpModal");
const abracaHelpModalCloseBtn = document.getElementById("abracaHelpModalCloseBtn");
const abracaExplainModal = document.getElementById("abracaExplainModal");
const abracaExplainModalCloseBtn = document.getElementById("abracaExplainModalCloseBtn");
const abracaHelpContent = document.getElementById("abracaHelpContent");
const abracaExplainContent = document.getElementById("abracaExplainContent");
const abracaPhaseLabel = document.getElementById("abracaPhase");
const abracaRoundLabel = document.getElementById("abracaRound");
const abracaTurnLabel = document.getElementById("abracaTurn");
const abracaDeckLabel = document.getElementById("abracaDeck");
const abracaSecretPoolLabel = document.getElementById("abracaSecretPool");
const abracaDiscardLabel = document.getElementById("abracaDiscard");
const abracaChainMinLabel = document.getElementById("abracaChainMin");
const abracaLastActionLabel = document.getElementById("abracaLastAction");
const abracaRoundResultLabel = document.getElementById("abracaRoundResult");
const abracaRoundNotice = document.getElementById("abracaRoundNotice");
const abracaRoundNoticeTitle = document.getElementById("abracaRoundNoticeTitle");
const abracaRoundNoticeBody = document.getElementById("abracaRoundNoticeBody");
const abracaPlayers = document.getElementById("abracaPlayers");
const abracaRollBtn = document.getElementById("abracaRollBtn");
const abracaSecretBtn = document.getElementById("abracaSecretBtn");
const abracaEndTurnBtn = document.getElementById("abracaEndTurnBtn");
const abracaNextRoundBtn = document.getElementById("abracaNextRoundBtn");
const abracaNewGameRow = document.getElementById("abracaNewGameRow");
const abracaNewGameBtn = document.getElementById("abracaNewGameBtn");
const abracaSpellButtonsContainer = document.getElementById("abracaSpellButtons");
const abracaSpellButtons = abracaSpellButtonsContainer
  ? Array.from(abracaSpellButtonsContainer.querySelectorAll("button[data-spell]"))
  : [];
const abracaCastConfirm = document.getElementById("abracaCastConfirm");
const abracaCastName = document.getElementById("abracaCastName");
const abracaCastDescription = document.getElementById("abracaCastDescription");
const abracaCastBtn = document.getElementById("abracaCastBtn");
const abracaCancelCastBtn = document.getElementById("abracaCancelCastBtn");
const abracaActionHint = document.getElementById("abracaActionHint");
const abracaActivitySummary = document.getElementById("abracaActivitySummary");
const abracaTooltip = document.getElementById("abracaTooltip");

const abracaSpellData = [
  {
    id: 0,
    number: 1,
    name: "Ancient Dragon",
    short: "Dragon",
    icon: "🐉",
    desc: "Roll 1-3. Others lose that many HP. Miscast: you lose that many HP.",
    total: 1,
  },
  {
    id: 1,
    number: 2,
    name: "Dark Ghost",
    short: "Ghost",
    icon: "👻",
    desc: "Others -1 HP. You +1 HP (max 6).",
    total: 2,
  },
  {
    id: 2,
    number: 3,
    name: "Sweet Dreams",
    short: "Dream",
    icon: "💤",
    desc: "Roll 1-3. You heal that many HP (max 6).",
    total: 3,
  },
  {
    id: 3,
    number: 4,
    name: "Owl",
    short: "Owl",
    icon: "🦉",
    desc: "Draw a secret card. Survive to score +1 per secret.",
    total: 4,
  },
  {
    id: 4,
    number: 5,
    name: "Lightning Storm",
    short: "Lightning",
    icon: "⚡",
    desc: "Left and right neighbors -1 HP (2 players: opponent -1 HP).",
    total: 5,
  },
  { id: 5, number: 6, name: "Blizzard", short: "Blizzard", icon: "❄️", desc: "Left neighbor -1 HP.", total: 6 },
  { id: 6, number: 7, name: "Fireball", short: "Fireball", icon: "🔥", desc: "Right neighbor -1 HP.", total: 7 },
  { id: 7, number: 8, name: "Magic Potion", short: "Potion", icon: "🧪", desc: "You +1 HP (max 6).", total: 8 },
];

const ABRACA_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Be the first player to reach 8 points.</p>

  <h3>Setup</h3>
  <ul>
    <li>Each player starts with 6 HP and a score marker at 0.</li>
    <li>Set aside secret cards: 12 (2p), 6 (3p), 4 (4-5p).</li>
    <li>Shuffle the rest, deal 5 cards to each player (others can see them, you cannot).</li>
  </ul>

  <h3>Turn</h3>
  <ol>
    <li>Cast at least 1 spell. Announce a spell number.</li>
    <li>If you have it, play the card and resolve the effect.</li>
    <li>If you do not, lose 1 HP and your turn ends immediately.</li>
    <li>You may keep casting, but each next spell number must be >= the previous spell.</li>
  </ol>
  <p>When you stop or fail, draw back up to 5 cards.</p>

  <h3>Round End & Scoring</h3>
  <ul>
    <li>If a player reaches 0 HP: caster +3, other survivors +1. Self-death: survivors +1.</li>
    <li>If a player empties their hand with successful casts: that player +3.</li>
    <li>Secret cards: +1 point each if you survive the round.</li>
  </ul>

  <h3>Hidden Info</h3>
  <p>You cannot see your own hand; other players can. Secret cards are private.</p>

  <h3>Spells</h3>
  <ul>
    ${abracaSpellData.map((spell) => `<li>${spell.number} ${spell.name} (${spell.icon}): ${spell.desc}</li>`).join("")}
  </ul>
  <h3>Symbols & Controls</h3>
  <p>Health (❤️) is shown out of a maximum of 6. Score (⭐) counts toward the target score. Secrets (🔒) score if you survive. Deck (🃏) refills hands; Discarded (♻️) counts spent spells. Roll Dice (🎲) resolves a pending roll. Chain minimum (↑ / Cast ≥) is the lowest spell number you may cast.</p>
  <p>Each spell shows used / total copies. Used counts discarded cards, not cards in hands or the secret pool. Dimmed spells cannot currently be cast; Explain still describes them.</p>
  <p>Select a spell, then Cast or Cancel in place. Click empty space or press Esc to cancel. End Turn and Next Round act immediately. Hover a symbol or card for details; on a phone, tap for a three-second tip. Activity holds the last action and round result. Help shows these rules; Explain lets you inspect controls without playing.</p>
`;

const ABRACA_BUTTON_EXPLANATIONS = {
  abracaRollBtn: {
    name: "Roll Dice (🎲)",
    description: "Roll a 1-3 die to resolve spell effects that require a dice result.",
  },
  abracaSecretBtn: {
    name: "Take Secret (🔒)",
    description: "Draw a secret card into your private pool (Owl effect).",
    note: "Secret cards score +1 each if you survive the round.",
  },
  abracaEndTurnBtn: {
    name: "End Turn",
    description: "Stop casting spells and end your turn.",
    note: "After ending, you draw back up to 5 cards.",
  },
  abracaNextRoundBtn: {
    name: "Next Round",
    description: "Begin the next round after a round has ended.",
  },
  abracaNewGameBtn: {
    name: "Start New Game",
    description: "Restart the game after someone reaches 8 points.",
  },
  abracaCastBtn: {
    name: "Cast",
    description: "Confirm the selected spell. A successful cast resolves its effect; a miscast costs health.",
  },
  abracaCancelCastBtn: {
    name: "Cancel",
    description: "Dismiss the selection without casting a spell.",
  },
};

abracaSpellData.forEach((spell) => {
  const buttonId = `abracaSpellBtn${spell.id}`;
  ABRACA_BUTTON_EXPLANATIONS[buttonId] = {
    name: `${spell.number}. ${spell.name} (${spell.icon})`,
    description: spell.desc,
    note: "You can only cast spells allowed by the current chain minimum.",
  };
});

let currentAbracaView = null;
let abracaLastRoundNotice = null;
let abracaSelectedSpell = null;
let abracaTooltipTimer = null;
let abracaTooltipAnchor = null;
let abracaPointerGesture = null;
let abracaIgnoreClickUntil = 0;
let abracaModalReturnFocus = null;

function setAbracaTip(element, message) {
  element.dataset.abracaTip = message;
  element.tabIndex = 0;
  element.setAttribute("aria-label", message);
}

function hideAbracaTooltip() {
  clearTimeout(abracaTooltipTimer);
  abracaTooltip?.classList.add("hidden");
  abracaTooltipAnchor?.removeAttribute("aria-describedby");
  abracaTooltipAnchor = null;
}

function showAbracaTooltip(anchor) {
  if (!abracaTooltip || !anchor?.dataset.abracaTip || anchor.closest("button")) return;
  hideAbracaTooltip();
  abracaTooltip.textContent = anchor.dataset.abracaTip;
  abracaTooltip.classList.remove("hidden");
  abracaTooltipAnchor = anchor;
  anchor.setAttribute("aria-describedby", "abracaTooltip");
  const target = anchor.getBoundingClientRect();
  const bubble = abracaTooltip.getBoundingClientRect();
  const left = Math.max(8, Math.min(target.left + target.width / 2 - bubble.width / 2, innerWidth - bubble.width - 8));
  const top = target.top >= bubble.height + 14 ? target.top - bubble.height - 6 : target.bottom + 6;
  abracaTooltip.style.left = `${left}px`;
  abracaTooltip.style.top = `${Math.max(8, Math.min(top, innerHeight - bubble.height - 8))}px`;
  abracaTooltipTimer = setTimeout(hideAbracaTooltip, 3000);
}

function clearAbracaCastSelection(restoreFocus = false) {
  const previous = abracaSelectedSpell;
  abracaSelectedSpell = null;
  abracaCastConfirm?.classList.add("hidden");
  if (abracaSpellButtonsContainer) abracaSpellButtonsContainer.inert = false;
  abracaSpellButtons.forEach((button) => button.setAttribute("aria-pressed", "false"));
  if (restoreFocus && previous !== null) abracaSpellButtons[previous]?.focus({ preventScroll: true });
}

function selectAbracaSpell(spellType) {
  if (!isAbracaActionAvailable("cast_spell", spellType) || !abracaCastConfirm) return;
  const spell = abracaSpellData[spellType];
  hideAbracaTooltip();
  abracaSelectedSpell = spellType;
  abracaCastName.textContent = `${spell.number} ${spell.name} (${spell.icon})`;
  abracaCastDescription.textContent = spell.desc;
  abracaSpellButtons.forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.spell) === spellType)));
  abracaCastConfirm.classList.remove("hidden");
  abracaSpellButtonsContainer.inert = true;
  abracaCastBtn.focus({ preventScroll: true });
}

function clearAbracaState() {
  currentAbracaView = null;
  abracaLastRoundNotice = null;
  abracaPointerGesture = null;
  abracaIgnoreClickUntil = 0;
  clearAbracaCastSelection();
  hideAbracaTooltip();
  if (abracaPhaseLabel) {
    abracaPhaseLabel.textContent = "-";
  }
  if (abracaRoundLabel) {
    abracaRoundLabel.textContent = "-";
  }
  if (abracaTurnLabel) {
    abracaTurnLabel.textContent = "-";
  }
  if (abracaDeckLabel) {
    abracaDeckLabel.textContent = "-";
  }
  if (abracaSecretPoolLabel) {
    abracaSecretPoolLabel.textContent = "-";
  }
  if (abracaDiscardLabel) {
    abracaDiscardLabel.textContent = "-";
  }
  if (abracaChainMinLabel) {
    abracaChainMinLabel.textContent = "-";
  }
  if (abracaLastActionLabel) {
    abracaLastActionLabel.textContent = "-";
  }
  if (abracaRoundResultLabel) {
    abracaRoundResultLabel.textContent = "-";
  }
  if (abracaRoundNoticeTitle) {
    abracaRoundNoticeTitle.textContent = "Round Result";
  }
  if (abracaRoundNoticeBody) {
    abracaRoundNoticeBody.textContent = "-";
  }
  if (abracaRoundNotice) {
    abracaRoundNotice.classList.remove("muted");
    abracaRoundNotice.classList.add("hidden");
  }
  renderAbracaSpells({});
  if (abracaActivitySummary) abracaActivitySummary.textContent = "No spells cast yet";
  document.getElementById("abracaActivity")?.removeAttribute("open");
  if (abracaPlayers) {
    abracaPlayers.innerHTML = "";
  }
  if (abracaNewGameRow) {
    abracaNewGameRow.classList.add("hidden");
  }
  updateAbracaActionButtons();
}

function formatAbracaLastAction(view) {
  const last = view.last_action;
  if (!last || typeof last.spell_type !== "number") {
    return "-";
  }
  const actor = last.player_id ? findPlayerName(view, last.player_id) : "Unknown";
  const spell = abracaSpellData.find((item) => item.id === last.spell_type);
  const label = spell ? `${spell.number}. ${spell.name}` : `Spell ${last.spell_type + 1}`;
  const result = last.success ? "success" : "fail";
  const dice = Number.isInteger(last.dice) ? ` (dice ${last.dice})` : "";
  return `${actor}: ${label} ${result}${dice}`;
}

function formatAbracaRoundResult(view) {
  const result = view.round_result;
  if (!result) {
    return "-";
  }
  const typeMap = {
    kill: "Kill",
    self_death: "Self Death",
    empty_hand: "Empty Hand",
  };
  const actor = result.actor_id ? findPlayerName(view, result.actor_id) : null;
  let text = typeMap[result.type] || result.type;
  if (actor) {
    text += ` by ${actor}`;
  }
  const addScores = result.add_scores || {};
  const gains = Object.keys(addScores).map((pid) => {
    const gain = addScores[pid];
    return `${findPlayerName(view, pid)} +${gain}`;
  });
  if (gains.length) {
    text += ` | ${gains.join(", ")}`;
  }
  if (Array.isArray(view.winner) && view.winner.length) {
    const winners = view.winner.map((pid) => findPlayerName(view, pid)).join(", ");
    text += ` | Winner: ${winners}`;
  }
  return text;
}

function getAbracaRoundWinners(view, result) {
  const addScores = result && result.add_scores ? result.add_scores : {};
  let maxGain = null;
  const winners = [];
  Object.keys(addScores).forEach((pid) => {
    const gain = Number(addScores[pid]) || 0;
    if (maxGain === null || gain > maxGain) {
      maxGain = gain;
      winners.length = 0;
      winners.push({ pid, gain });
    } else if (gain === maxGain) {
      winners.push({ pid, gain });
    }
  });
  return winners;
}

function formatAbracaRoundNotice(view, result) {
  if (!result) {
    return null;
  }
  const winners = getAbracaRoundWinners(view, result);
  let winnersText = "-";
  if (winners.length) {
    winnersText = winners
      .map((entry) => `${findPlayerName(view, entry.pid)} +${entry.gain}`)
      .join(", ");
  } else if (result.actor_id) {
    winnersText = findPlayerName(view, result.actor_id);
  }
  const label = winners.length === 1 ? "Winner" : "Winners";
  const roundNumber = Number.isInteger(view.round) ? view.round : null;
  const text = roundNumber ? `Round ${roundNumber} ${label}: ${winnersText}` : `${label}: ${winnersText}`;
  return { round: roundNumber, text };
}

function updateAbracaRoundNotice(view) {
  if (!abracaRoundNotice || !abracaRoundNoticeBody) {
    return;
  }
  const notice = view.round_result ? formatAbracaRoundNotice(view, view.round_result) : null;
  if (notice?.text) {
    abracaLastRoundNotice = notice;
    abracaRoundNoticeBody.textContent = notice.text;
    if (abracaRoundNoticeTitle) {
      abracaRoundNoticeTitle.textContent = view.game_over ? "Game Over" : "Round Over";
    }
    abracaRoundNotice.classList.remove("hidden");
  } else {
    abracaRoundNotice.classList.add("hidden");
  }
}

function renderAbracaSpells(view) {
  const discardCounts = Array.isArray(view.discard_counts) ? view.discard_counts : [];
  abracaSpellButtons.forEach((button) => {
    const spell = abracaSpellData[Number(button.dataset.spell)];
    const used = discardCounts[spell.id] ?? 0;
    if (!button.querySelector(".abraca-spell-used")) {
      button.innerHTML = `<span class="abraca-spell-symbol" aria-hidden="true">${spell.number} ${spell.icon}</span><span class="abraca-spell-label">${spell.short}</span><span class="abraca-spell-used"></span>`;
    }
    button.querySelector(".abraca-spell-used").textContent = `${used} / ${spell.total}`;
    button.setAttribute("aria-label", `${spell.number}. ${spell.name} (${spell.icon}). Used ${used} of ${spell.total}. ${spell.desc}`);
  });
}

function renderAbracaPlayers(view) {
  if (!abracaPlayers) {
    return;
  }
  abracaPlayers.innerHTML = "";
  const buildAbracaCardSlot = (cardInfo, { compact = false } = {}) => {
    const slot = document.createElement("div");
    slot.className = "player-slot abraca-card";
    if (compact) {
      slot.classList.add("abraca-card-compact");
    }
    if (!cardInfo || cardInfo.hidden) {
      slot.classList.add("abraca-card-hidden");
      slot.textContent = "?";
      setAbracaTip(slot, "Hidden card (?): other players can see this spell, but you cannot.");
      return slot;
    }

    const rawSpell = Number.isInteger(cardInfo.spell)
      ? cardInfo.spell
      : Number.isInteger(cardInfo.number)
      ? cardInfo.number - 1
      : null;
    const spellType = Number.isInteger(rawSpell) ? rawSpell : null;
    if (spellType !== null) {
      slot.dataset.spell = String(spellType);
    }
    const spell = spellType !== null ? abracaSpellData.find((item) => item.id === spellType) : null;
    const number = Number.isInteger(cardInfo.number) ? cardInfo.number : (spellType ?? 0) + 1;
    const shortName = spell ? spell.short || spell.name : cardInfo.name || "Spell";
    const fullName = spell ? spell.name : cardInfo.name || shortName;

    const numberEl = document.createElement("div");
    numberEl.className = "abraca-card-number";
    numberEl.textContent = String(number);
    const nameEl = document.createElement("div");
    nameEl.className = "abraca-card-name";
    nameEl.textContent = shortName;
    const iconEl = document.createElement("span");
    iconEl.className = "abraca-card-icon";
    iconEl.textContent = spell?.icon || "✨";
    iconEl.setAttribute("aria-hidden", "true");
    slot.appendChild(numberEl);
    slot.appendChild(iconEl);
    slot.appendChild(nameEl);
    setAbracaTip(slot, `${number}. ${fullName} (${spell?.icon || "✨"}). ${spell?.desc || ""}`);
    return slot;
  };
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
      card.setAttribute("aria-current", "true");
    }

    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id;
    const labels = [];
    if (player.player_id === view.you) labels.push("You");
    if (player.is_bot) labels.push("Bot");
    if (player.player_id === view.current_turn && !view.game_over && view.phase !== "round_end") labels.push("Turn");
    if (labels.length) {
      const tag = document.createElement("span");
      tag.className = "abraca-player-tag";
      tag.textContent = labels.join(" · ");
      name.appendChild(tag);
    }
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const score = document.createElement("span");
    score.className = "badge";
    score.textContent = `⭐ ${player.score}`;
    setAbracaTip(score, `Score (⭐): ${player.score} / ${view.config?.target_score || 8} points.`);
    badges.appendChild(score);
    const hp = document.createElement("span");
    hp.className = "badge abraca-hp";
    hp.textContent = `❤️ ${player.hp}`;
    setAbracaTip(hp, `Health (❤️): ${player.hp} / 6. Reaching 0 ends the round.`);
    badges.appendChild(hp);
    const secrets = document.createElement("span");
    secrets.className = "badge";
    secrets.textContent = `🔒 ${player.secret_count}`;
    setAbracaTip(secrets, `Secrets (🔒): ${player.secret_count}. Each scores 1 point if this player survives.`);
    badges.appendChild(secrets);
    header.appendChild(badges);
    card.appendChild(header);

    const handRow = document.createElement("div");
    handRow.className = "player-hand";
    if (Array.isArray(player.hand) && player.hand.length) {
      player.hand.forEach((cardInfo) => {
        const slot = buildAbracaCardSlot(cardInfo);
        handRow.appendChild(slot);
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "player-slot empty";
      empty.textContent = "-";
      handRow.appendChild(empty);
    }
    card.appendChild(handRow);

    if (player.player_id === view.you && Array.isArray(player.secret_cards) && player.secret_cards.length) {
      const meta = document.createElement("div");
      meta.className = "player-meta abraca-secret-meta";
      const label = document.createElement("div");
      label.className = "abraca-secret-label";
      label.textContent = "Your secrets";
      const list = document.createElement("div");
      list.className = "abraca-secret-list";
      player.secret_cards.forEach((cardInfo) => {
        list.appendChild(buildAbracaCardSlot(cardInfo, { compact: true }));
      });
      meta.appendChild(label);
      meta.appendChild(list);
      card.appendChild(meta);
    }

    abracaPlayers.appendChild(card);
  });
}

function isAbracaActionAvailable(actionType, spellType) {
  if (!currentAbracaView || !Array.isArray(currentAbracaView.legal_actions)) {
    return false;
  }
  if (!currentAbracaView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "cast_spell") {
    if (!Array.isArray(currentAbracaView.allowed_spells)) {
      return false;
    }
    return currentAbracaView.allowed_spells.includes(spellType);
  }
  return true;
}

function updateAbracaActionButtons() {
  if (abracaSpellButtons.length) {
    abracaSpellButtons.forEach((button) => {
      const spellType = Number.parseInt(button.dataset.spell, 10);
      const allowed = isAbracaActionAvailable("cast_spell", spellType);
      button.disabled = !allowed;
      button.classList.toggle("action-allowed", allowed);
    });
  }
  const buttonMap = [
    { type: "roll_dice", el: abracaRollBtn, phases: ["wait_dice"] },
    { type: "take_secret", el: abracaSecretBtn, phases: ["wait_see"] },
    { type: "end_turn", el: abracaEndTurnBtn, phases: ["wait_goon", "wait_draw"] },
    { type: "start_next_round", el: abracaNextRoundBtn, phases: ["round_end"] },
  ];
  buttonMap.forEach(({ type, el, phases }) => {
    if (!el) {
      return;
    }
    const allowed = isAbracaActionAvailable(type);
    el.disabled = !allowed;
    el.classList.toggle("action-allowed", allowed);
    el.classList.toggle("hidden", !phases.includes(currentAbracaView?.phase));
  });
  if (abracaSelectedSpell !== null && !isAbracaActionAvailable("cast_spell", abracaSelectedSpell)) {
    clearAbracaCastSelection();
  }
  if (abracaActionHint) {
    const hints = {
      wait_use: "Choose a spell to cast",
      wait_goon: "Cast again or end turn",
      wait_dice: "Roll to resolve the spell",
      wait_see: "Take your secret card",
      wait_draw: "End turn to refill",
      round_end: "Review the round result",
      game_over: "Final scores",
    };
    const view = currentAbracaView;
    abracaActionHint.textContent = !view ? "Waiting for the game"
      : view.phase === "round_end" || view.game_over || view.current_turn === view.you
      ? hints[view.phase] || "Waiting"
      : "Watching the current turn";
  }
}

function updateAbracaNewGameRow(view) {
  if (!abracaNewGameRow) {
    return;
  }
  abracaNewGameRow.classList.toggle("hidden", !(view && view.game_over));
}

function renderAbracaGameState(data) {
  const view = data.view;
  const previous = currentAbracaView;
  if (previous && (previous.round !== view.round || previous.phase !== view.phase || previous.current_turn !== view.current_turn ||
      previous.discard_total !== view.discard_total ||
      JSON.stringify(previous.last_action) !== JSON.stringify(view.last_action))) {
    clearAbracaCastSelection();
  }
  hideAbracaTooltip();
  currentAbracaView = view;
  if (currentGameType !== "abraca_what") {
    currentGameType = "abraca_what";
    setGamePanelVisibility("abraca_what");
  }

  if (abracaPhaseLabel) {
    const phases = {
      wait_use: "Cast", wait_goon: "Chain", wait_dice: "Roll dice",
      wait_see: "Take secret", wait_draw: "Refill", round_end: "Round over", game_over: "Game over",
    };
    abracaPhaseLabel.textContent = phases[view.phase] || view.phase || "-";
  }
  if (abracaRoundLabel) {
    abracaRoundLabel.textContent = view.round ?? "-";
  }
  if (abracaTurnLabel) {
    const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
    abracaTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (abracaDeckLabel) {
    abracaDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (abracaSecretPoolLabel) {
    abracaSecretPoolLabel.textContent = view.secret_pool_count ?? "-";
  }
  if (abracaDiscardLabel) {
    abracaDiscardLabel.textContent = view.discard_total ?? "-";
  }
  if (abracaChainMinLabel) {
    if (Number.isInteger(view.min_spell)) {
      abracaChainMinLabel.textContent = String(view.min_spell + 1);
    } else {
      abracaChainMinLabel.textContent = "1";
    }
  }
  if (abracaLastActionLabel) {
    abracaLastActionLabel.textContent = formatAbracaLastAction(view);
  }
  if (abracaRoundResultLabel) {
    abracaRoundResultLabel.textContent = view.round_result ? formatAbracaRoundResult(view) : abracaLastRoundNotice?.text || "-";
  }
  if (abracaActivitySummary) {
    const last = view.last_action;
    const spell = abracaSpellData[last?.spell_type];
    abracaActivitySummary.textContent = spell ? `${spell.number} ${spell.short} · ${last.success ? "Success" : "Miscast"}` : "No spells cast yet";
  }
  updateAbracaRoundNotice(view);
  updateAbracaNewGameRow(view);

  renderAbracaSpells(view);
  renderAbracaPlayers(view);
  logGameEvents(data);
  updateAbracaActionButtons();
}

let abracaExplainMode = false;

function showAbracaHeaderActions(show) {
  if (abracaHeaderActions) {
    abracaHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    clearAbracaCastSelection();
    hideAbracaTooltip();
    exitAbracaExplainMode();
    closeAbracaHelpModal();
    closeAbracaExplainModal();
  }
}

function showAbracaHelpModal() {
  if (!abracaHelpModal) {
    return;
  }
  if (abracaHelpContent) {
    abracaHelpContent.innerHTML = ABRACA_HELP_TEXT;
  }
  exitAbracaExplainMode();
  hideAbracaTooltip();
  abracaModalReturnFocus = document.activeElement;
  setModalVisible(abracaHelpModal, true);
  abracaHelpModalCloseBtn?.focus({ preventScroll: true });
}

function closeAbracaHelpModal() {
  if (abracaHelpModal && !abracaHelpModal.classList.contains("hidden")) {
    setModalVisible(abracaHelpModal, false);
    abracaModalReturnFocus?.focus({ preventScroll: true });
  }
}

function updateAbracaExplainModeClasses(enabled) {
  Object.keys(ABRACA_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
}

function findAbracaButtonAtPoint(clientX, clientY) {
  for (const buttonId of Object.keys(ABRACA_BUTTON_EXPLANATIONS)) {
    const btn = document.getElementById(buttonId);
    if (!btn || !btn.getClientRects().length || btn.closest("[inert]")) continue;
    const rect = btn.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      return buttonId;
    }
  }
  return null;
}

function toggleAbracaExplainMode() {
  hideAbracaTooltip();
  abracaExplainMode = !abracaExplainMode;
  document.body.classList.toggle("abraca-explain-mode", abracaExplainMode);
  updateAbracaExplainModeClasses(abracaExplainMode);
  if (abracaExplainBtn) {
    abracaExplainBtn.classList.toggle("active", abracaExplainMode);
    abracaExplainBtn.setAttribute("aria-pressed", String(abracaExplainMode));
  }
}

function exitAbracaExplainMode() {
  if (!abracaExplainMode) {
    return;
  }
  abracaExplainMode = false;
  document.body.classList.remove("abraca-explain-mode");
  updateAbracaExplainModeClasses(false);
  if (abracaExplainBtn) {
    abracaExplainBtn.classList.remove("active");
    abracaExplainBtn.setAttribute("aria-pressed", "false");
  }
}

function showAbracaButtonExplanation(buttonId) {
  const explanation = ABRACA_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !abracaExplainContent || !abracaExplainModal) {
    return;
  }
  const note = explanation.note ? `<div class="hint">${explanation.note}</div>` : "";
  abracaExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    ${note}
  `;
  abracaModalReturnFocus = document.activeElement;
  setModalVisible(abracaExplainModal, true);
  abracaExplainModalCloseBtn?.focus({ preventScroll: true });
}

function showAbracaInfoExplanation(element) {
  abracaExplainContent.replaceChildren();
  const text = document.createElement("p");
  text.textContent = element.dataset.abracaTip;
  abracaExplainContent.appendChild(text);
  abracaModalReturnFocus = document.activeElement;
  setModalVisible(abracaExplainModal, true);
  abracaExplainModalCloseBtn?.focus({ preventScroll: true });
}

function closeAbracaExplainModal() {
  if (abracaExplainModal && !abracaExplainModal.classList.contains("hidden")) {
    setModalVisible(abracaExplainModal, false);
    abracaModalReturnFocus?.focus({ preventScroll: true });
  }
}

if (abracaSpellButtons.length) {
  abracaSpellButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const spellType = Number.parseInt(button.dataset.spell, 10);
      if (!Number.isInteger(spellType)) {
        return;
      }
      selectAbracaSpell(spellType);
    });
  });
}

abracaCastBtn?.addEventListener("click", () => {
  const spellType = abracaSelectedSpell;
  if (spellType === null || !isAbracaActionAvailable("cast_spell", spellType)) return;
  clearAbracaCastSelection(true);
  sendAction({ type: "cast_spell", spell_type: spellType });
});

abracaCancelCastBtn?.addEventListener("click", () => clearAbracaCastSelection(true));

if (abracaRollBtn) {
  abracaRollBtn.addEventListener("click", () => {
    sendAction({ type: "roll_dice" });
  });
}

if (abracaSecretBtn) {
  abracaSecretBtn.addEventListener("click", () => {
    sendAction({ type: "take_secret" });
  });
}

if (abracaEndTurnBtn) {
  abracaEndTurnBtn.addEventListener("click", () => {
    sendAction({ type: "end_turn" });
  });
}

if (abracaNextRoundBtn) {
  abracaNextRoundBtn.addEventListener("click", () => {
    sendAction({ type: "start_next_round" });
  });
}

if (abracaNewGameBtn) {
  abracaNewGameBtn.addEventListener("click", () => {
    emitRoomStart();
  });
}

if (abracaHelpBtn) {
  abracaHelpBtn.addEventListener("click", () => {
    showAbracaHelpModal();
  });
}

if (abracaHelpModalCloseBtn) {
  abracaHelpModalCloseBtn.addEventListener("click", closeAbracaHelpModal);
}

if (abracaExplainBtn) {
  abracaExplainBtn.addEventListener("click", () => {
    toggleAbracaExplainMode();
  });
}

if (abracaExplainModalCloseBtn) {
  abracaExplainModalCloseBtn.addEventListener("click", closeAbracaExplainModal);
}

function isAbracaUtilityButton(button) {
  return [abracaHelpBtn, abracaExplainBtn, abracaHelpModalCloseBtn, abracaExplainModalCloseBtn].includes(button);
}

document.addEventListener("pointerdown", (event) => {
  if (currentGameType !== "abraca_what" || !event.isPrimary || event.button !== 0) return;
  abracaIgnoreClickUntil = 0;
  abracaPointerGesture = {
    pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
    scrollX, scrollY, moved: false,
    explain: abracaExplainMode,
  };
}, true);

document.addEventListener("pointermove", (event) => {
  if (!abracaPointerGesture || event.pointerId !== abracaPointerGesture.pointerId) return;
  if (Math.hypot(event.clientX - abracaPointerGesture.clientX, event.clientY - abracaPointerGesture.clientY) > 10) {
    abracaPointerGesture.moved = true;
  }
}, true);

document.addEventListener("pointercancel", () => {
  if (!abracaPointerGesture) return;
  abracaIgnoreClickUntil = Date.now() + 600;
  abracaPointerGesture = null;
}, true);

document.addEventListener("pointerup", (event) => {
  const gesture = abracaPointerGesture;
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  abracaPointerGesture = null;
  if (gesture.moved || scrollX !== gesture.scrollX || scrollY !== gesture.scrollY ||
      Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY) > 10) {
    abracaIgnoreClickUntil = Date.now() + 600;
    return;
  }
  if (!gesture.explain || !abracaExplainMode || isAbracaUtilityButton(event.target.closest("button"))) return;
  const buttonId = findAbracaButtonAtPoint(event.clientX, event.clientY);
  const tip = event.target.closest("[data-abraca-tip]");
  if (buttonId || tip) {
    event.preventDefault();
    event.stopPropagation();
    abracaIgnoreClickUntil = Date.now() + 600;
    if (buttonId) showAbracaButtonExplanation(buttonId);
    else showAbracaInfoExplanation(tip);
    exitAbracaExplainMode();
  }
}, true);

document.addEventListener("click", (event) => {
  if (currentGameType !== "abraca_what") return;
  if (event.detail > 0 && Date.now() < abracaIgnoreClickUntil) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  const button = event.target.closest("button");
  const tip = event.target.closest("#abracaPanel [data-abraca-tip]");
  if (abracaExplainMode && !isAbracaUtilityButton(button)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button && ABRACA_BUTTON_EXPLANATIONS[button.id]) {
      showAbracaButtonExplanation(button.id);
      exitAbracaExplainMode();
    } else if (tip) {
      showAbracaInfoExplanation(tip);
      exitAbracaExplainMode();
    }
    return;
  }
  if (tip && !button) showAbracaTooltip(tip);
  else hideAbracaTooltip();
  if (abracaSelectedSpell !== null && !event.target.closest("#abracaSpells, button, summary, [data-abraca-tip], .modal")) {
    clearAbracaCastSelection();
  }
}, true);

abracaPanel?.addEventListener("pointerover", (event) => {
  if (event.pointerType !== "mouse" || abracaExplainMode) return;
  const target = event.target.closest("[data-abraca-tip]");
  if (target && !target.contains(event.relatedTarget)) showAbracaTooltip(target);
});

abracaPanel?.addEventListener("pointerout", (event) => {
  const target = event.target.closest("[data-abraca-tip]");
  if (target && !target.contains(event.relatedTarget)) hideAbracaTooltip();
});

abracaPanel?.addEventListener("focusin", (event) => {
  if (!abracaExplainMode && event.target.matches("[data-abraca-tip]:focus-visible")) showAbracaTooltip(event.target);
});

abracaPanel?.addEventListener("focusout", hideAbracaTooltip);
window.addEventListener("resize", hideAbracaTooltip);
document.addEventListener("scroll", () => {
  hideAbracaTooltip();
  if (abracaPointerGesture) abracaPointerGesture.moved = true;
}, true);

[abracaHelpModal, abracaExplainModal].forEach((modal) => {
  modal?.addEventListener("click", (event) => {
    if (event.target !== modal) return;
    if (modal === abracaHelpModal) closeAbracaHelpModal();
    else closeAbracaExplainModal();
  });
});

document.addEventListener("keydown", (event) => {
  if (currentGameType !== "abraca_what") return;
  if (event.key === "Escape") {
    exitAbracaExplainMode();
    hideAbracaTooltip();
    closeAbracaHelpModal();
    closeAbracaExplainModal();
    clearAbracaCastSelection(true);
  }
  const modal = [abracaHelpModal, abracaExplainModal].find((element) => element && !element.classList.contains("hidden"));
  if (event.key === "Tab" && modal) {
    event.preventDefault();
    modal.querySelector("button")?.focus();
  }
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("#abracaPanel [data-abraca-tip]")) {
    event.preventDefault();
    if (abracaExplainMode) {
      showAbracaInfoExplanation(event.target);
      exitAbracaExplainMode();
    } else showAbracaTooltip(event.target);
  }
});

renderAbracaSpells({});
updateAbracaActionButtons();
abracaExplainBtn?.setAttribute("aria-pressed", "false");
