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
const abracaSpells = document.getElementById("abracaSpells");
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

const abracaSpellData = [
  {
    id: 0,
    number: 1,
    name: "Ancient Dragon",
    short: "Dragon",
    desc: "Roll 1-3. Others lose that many HP. Miscast: you lose that many HP.",
    total: 1,
  },
  {
    id: 1,
    number: 2,
    name: "Dark Ghost",
    short: "Ghost",
    desc: "Others -1 HP. You +1 HP (max 6).",
    total: 2,
  },
  {
    id: 2,
    number: 3,
    name: "Sweet Dreams",
    short: "Dream",
    desc: "Roll 1-3. You heal that many HP (max 6).",
    total: 3,
  },
  {
    id: 3,
    number: 4,
    name: "Owl",
    short: "Owl",
    desc: "Draw a secret card. Survive to score +1 per secret.",
    total: 4,
  },
  {
    id: 4,
    number: 5,
    name: "Lightning Storm",
    short: "Lightning",
    desc: "Left and right neighbors -1 HP (2 players: opponent -1 HP).",
    total: 5,
  },
  { id: 5, number: 6, name: "Blizzard", short: "Blizzard", desc: "Left neighbor -1 HP.", total: 6 },
  { id: 6, number: 7, name: "Fireball", short: "Fireball", desc: "Right neighbor -1 HP.", total: 7 },
  { id: 7, number: 8, name: "Magic Potion", short: "Potion", desc: "You +1 HP (max 6).", total: 8 },
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
    <li>1 Ancient Dragon: roll 1-3, others lose that many HP. Miscast: you lose that many.</li>
    <li>2 Dark Ghost: others -1 HP, you +1 HP (max 6).</li>
    <li>3 Sweet Dreams: roll 1-3, you heal that many HP (max 6).</li>
    <li>4 Owl: draw a secret card. Survive to score +1 per secret.</li>
    <li>5 Lightning Storm: left and right neighbors -1 HP (2p: opponent -1).</li>
    <li>6 Blizzard: left neighbor -1 HP.</li>
    <li>7 Fireball: right neighbor -1 HP.</li>
    <li>8 Magic Potion: you +1 HP (max 6).</li>
  </ul>
`;

const ABRACA_BUTTON_EXPLANATIONS = {
  abracaRollBtn: {
    name: "Roll Dice",
    description: "Roll a 1-3 die to resolve spell effects that require a dice result.",
  },
  abracaSecretBtn: {
    name: "Take Secret",
    description: "Draw a secret card into your private pool (Owl effect).",
    note: "Secret cards score +1 each if you survive the round.",
  },
  abracaEndTurnBtn: {
    name: "End Turn",
    description: "Stop casting spells and end your turn.",
    note: "After ending, you draw back up to 5 cards.",
  },
  abracaNextRoundBtn: {
    name: "Start Next Round",
    description: "Begin the next round after a round has ended.",
  },
  abracaNewGameBtn: {
    name: "Start New Game",
    description: "Restart the game after someone reaches 8 points.",
  },
};

abracaSpellData.forEach((spell) => {
  const buttonId = `abracaSpellBtn${spell.id}`;
  ABRACA_BUTTON_EXPLANATIONS[buttonId] = {
    name: `${spell.number}. ${spell.name}`,
    description: spell.desc,
    note: "You can only cast spells allowed by the current chain minimum.",
  };
});

let currentAbracaView = null;
let abracaLastRoundNotice = null;

function toggleAbracaSpellBubble(anchor, message) {
  if (!anchor || !message) {
    return;
  }
  const existing = anchor.querySelector(".abraca-spell-bubble");
  if (existing) {
    existing.remove();
    return;
  }
  const table = anchor.closest(".abraca-spell-table");
  if (table) {
    table.querySelectorAll(".abraca-spell-bubble").forEach((bubble) => bubble.remove());
  }
  const bubble = document.createElement("div");
  bubble.className = "abraca-spell-bubble";
  bubble.textContent = message;
  bubble.addEventListener("click", (event) => {
    event.stopPropagation();
    bubble.remove();
  });
  anchor.appendChild(bubble);
  requestAnimationFrame(() => {
    bubble.classList.add("show");
  });
}

function clearAbracaState() {
  currentAbracaView = null;
  abracaLastRoundNotice = null;
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
  if (abracaSpells) {
    abracaSpells.innerHTML = "";
  }
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
  let notice = null;
  let title = "Round Result";
  let isFresh = false;
  if (view.round_result) {
    notice = formatAbracaRoundNotice(view, view.round_result);
    if (notice) {
      abracaLastRoundNotice = notice;
    }
    if (view.game_over) {
      title = "Game Over";
    } else if (view.phase === "round_end") {
      title = "Round Over";
    }
    isFresh = true;
  } else if (abracaLastRoundNotice) {
    if (Number.isInteger(view.round) && Number.isInteger(abracaLastRoundNotice.round)) {
      if (view.round === abracaLastRoundNotice.round + 1) {
        notice = abracaLastRoundNotice;
        title = "Last Round Result";
      }
    }
  }

  if (notice && notice.text) {
    abracaRoundNoticeBody.textContent = notice.text;
    if (abracaRoundNoticeTitle) {
      abracaRoundNoticeTitle.textContent = title;
    }
    abracaRoundNotice.classList.toggle("muted", !isFresh);
    abracaRoundNotice.classList.remove("hidden");
  } else {
    abracaRoundNotice.classList.add("hidden");
  }
}

function renderAbracaSpells(view) {
  if (!abracaSpells) {
    return;
  }
  abracaSpells.innerHTML = "";
  const discardCounts = Array.isArray(view.discard_counts) ? view.discard_counts : [];
  const table = document.createElement("table");
  table.className = "abraca-spell-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const headers = ["Spell", "Used", "Total"];
  headers.forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  abracaSpellData.forEach((spell) => {
    const row = document.createElement("tr");
    row.className = "abraca-spell-row";
    row.dataset.spell = String(spell.id);

    const name = document.createElement("td");
    name.className = "abraca-spell-name";
    name.textContent = `${spell.number}. ${spell.name}`;
    name.tabIndex = 0;
    name.setAttribute("role", "button");
    name.setAttribute("aria-label", `${spell.number}. ${spell.name} details`);
    name.addEventListener("click", () => {
      toggleAbracaSpellBubble(name, spell.desc);
    });
    name.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleAbracaSpellBubble(name, spell.desc);
      }
    });

    const used = discardCounts[spell.id] ?? 0;
    const usedCell = document.createElement("td");
    usedCell.className = "abraca-spell-count";
    usedCell.textContent = String(used);

    const totalCell = document.createElement("td");
    totalCell.className = "abraca-spell-total";
    totalCell.textContent = String(spell.total);

    row.appendChild(name);
    row.appendChild(usedCell);
    row.appendChild(totalCell);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  abracaSpells.appendChild(table);
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
      slot.title = "Hidden card";
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
    slot.appendChild(numberEl);
    slot.appendChild(nameEl);
    slot.title = `${number}. ${fullName}`;
    return slot;
  };
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }

    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id;
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const score = document.createElement("span");
    score.className = "badge";
    score.textContent = `score ${player.score}`;
    badges.appendChild(score);
    const hp = document.createElement("span");
    hp.className = "badge";
    hp.textContent = `hp ${player.hp}/6`;
    badges.appendChild(hp);
    const secrets = document.createElement("span");
    secrets.className = "badge";
    secrets.textContent = `secret ${player.secret_count}`;
    badges.appendChild(secrets);
    if (player.player_id === view.you) {
      const you = document.createElement("span");
      you.className = "badge";
      you.textContent = "you";
      badges.appendChild(you);
    }
    if (player.is_bot) {
      const bot = document.createElement("span");
      bot.className = "badge";
      bot.textContent = "bot";
      badges.appendChild(bot);
    }
    if (player.player_id === view.current_turn) {
      const turn = document.createElement("span");
      turn.className = "badge highlight";
      turn.textContent = "turn";
      badges.appendChild(turn);
    }
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
      label.textContent = "Secret cards";
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
    { type: "roll_dice", el: abracaRollBtn },
    { type: "take_secret", el: abracaSecretBtn },
    { type: "end_turn", el: abracaEndTurnBtn },
    { type: "start_next_round", el: abracaNextRoundBtn },
  ];
  buttonMap.forEach(({ type, el }) => {
    if (!el) {
      return;
    }
    const allowed = isAbracaActionAvailable(type);
    el.disabled = !allowed;
    el.classList.toggle("action-allowed", allowed);
  });
}

function updateAbracaNewGameRow(view) {
  if (!abracaNewGameRow) {
    return;
  }
  abracaNewGameRow.classList.toggle("hidden", !(view && view.game_over));
}

function renderAbracaGameState(data) {
  const view = data.view;
  currentAbracaView = view;
  if (currentGameType !== "abraca_what") {
    currentGameType = "abraca_what";
    setGamePanelVisibility("abraca_what");
  }

  if (abracaPhaseLabel) {
    abracaPhaseLabel.textContent = view.phase || "-";
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
      abracaChainMinLabel.textContent = "-";
    }
  }
  if (abracaLastActionLabel) {
    abracaLastActionLabel.textContent = formatAbracaLastAction(view);
  }
  if (abracaRoundResultLabel) {
    abracaRoundResultLabel.textContent = formatAbracaRoundResult(view);
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
  setModalVisible(abracaHelpModal, true);
}

function closeAbracaHelpModal() {
  if (abracaHelpModal) {
    setModalVisible(abracaHelpModal, false);
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

function findAbracaButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(ABRACA_BUTTON_EXPLANATIONS)) {
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  return null;
}

function toggleAbracaExplainMode() {
  abracaExplainMode = !abracaExplainMode;
  document.body.classList.toggle("abraca-explain-mode", abracaExplainMode);
  updateAbracaExplainModeClasses(abracaExplainMode);
  if (abracaExplainBtn) {
    abracaExplainBtn.classList.toggle("active", abracaExplainMode);
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
  setModalVisible(abracaExplainModal, true);
}

function closeAbracaExplainModal() {
  if (abracaExplainModal) {
    setModalVisible(abracaExplainModal, false);
  }
}

if (abracaSpellButtons.length) {
  abracaSpellButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const spellType = Number.parseInt(button.dataset.spell, 10);
      if (!Number.isInteger(spellType)) {
        return;
      }
      sendAction({ type: "cast_spell", spell_type: spellType });
    });
  });
}

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

document.addEventListener("pointerdown", (e) => {
  if (!abracaExplainMode) return;

  const buttonId = findAbracaButtonAtPoint(e.clientX, e.clientY);
  if (buttonId) {
    e.preventDefault();
    e.stopPropagation();
    showAbracaButtonExplanation(buttonId);
    exitAbracaExplainMode();
    return;
  }

  const button = e.target.closest("button");
  if (button === abracaExplainBtn || button === abracaHelpBtn) return;
  if (button === abracaHelpModalCloseBtn || button === abracaExplainModalCloseBtn) return;

  if (button) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

document.addEventListener("click", (e) => {
  if (!abracaExplainMode) return;

  const button = e.target.closest("button");
  if (!button) return;

  if (button === abracaExplainBtn || button === abracaHelpBtn) return;
  if (button === abracaHelpModalCloseBtn || button === abracaExplainModalCloseBtn) return;

  e.preventDefault();
  e.stopPropagation();
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && abracaExplainMode) {
    exitAbracaExplainMode();
  }
});
