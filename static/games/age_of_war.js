let currentAgeOfWarView = null;

const ageOfWarHeaderActions = document.getElementById("ageOfWarHeaderActions");
const ageOfWarHelpBtn = document.getElementById("ageOfWarHelpBtn");
const ageOfWarExplainBtn = document.getElementById("ageOfWarExplainBtn");
const ageOfWarHelpModal = document.getElementById("ageOfWarHelpModal");
const ageOfWarHelpModalCloseBtn = document.getElementById("ageOfWarHelpModalCloseBtn");
const ageOfWarHelpContent = document.getElementById("ageOfWarHelpContent");
const ageOfWarExplainModal = document.getElementById("ageOfWarExplainModal");
const ageOfWarExplainModalCloseBtn = document.getElementById("ageOfWarExplainModalCloseBtn");
const ageOfWarExplainContent = document.getElementById("ageOfWarExplainContent");

const ageOfWarPhaseLabel = document.getElementById("ageOfWarPhase");
const ageOfWarTurnLabel = document.getElementById("ageOfWarTurn");
const ageOfWarTargetLabel = document.getElementById("ageOfWarTarget");
const ageOfWarDiceLeftLabel = document.getElementById("ageOfWarDiceLeft");
const ageOfWarWinnerLabel = document.getElementById("ageOfWarWinner");
const ageOfWarDice = document.getElementById("ageOfWarDice");
const ageOfWarRollBtn = document.getElementById("ageOfWarRollBtn");
const ageOfWarPlayAgainBtn = document.getElementById("ageOfWarPlayAgainBtn");
const ageOfWarTargetLines = document.getElementById("ageOfWarTargetLines");
const ageOfWarCentral = document.getElementById("ageOfWarCentral");
const ageOfWarPlayers = document.getElementById("ageOfWarPlayers");

const AGE_OF_WAR_HELP_TEXT = `
<h3>Goal</h3>
<p>Score the most points from castles and completed clan bonuses when the central supply runs out.</p>

<h3>Turn</h3>
<ol>
  <li>Roll all remaining dice, then choose a target castle from the center or an unlocked opponent castle.</li>
  <li>Once you select a target, you must continue the attack against that target for the rest of the turn.</li>
  <li>Assign dice to fill one battle line. Infantry dice add up to meet or exceed the sum; other types must match exactly.</li>
  <li>If you cannot or choose not to fill a line, discard one die and reroll the rest.</li>
</ol>

<h3>Capture</h3>
<p>Fill all lines to capture the castle. If attacking a player, you must also complete an extra Daimyo line.</p>

<h3>Clan Lock</h3>
<p>When you own all castles of a clan, that clan locks. Locked clans score their set bonus instead of the sum of castle points.</p>

<h3>Game End</h3>
<p>The game ends immediately when the last central castle is captured.</p>
`;

const AGE_OF_WAR_BUTTON_EXPLANATIONS = {
  ageOfWarRollBtn: {
    name: "Roll Dice",
    description: "Roll all remaining dice. You can roll before choosing a target.",
  },
  ageOfWarPlayAgainBtn: {
    name: "Play Again",
    description: "Restart the game after it ends.",
  },
};

const AGE_OF_WAR_ICONS = {
  infantry: "⚔️",
  archery: "🏹",
  cavalry: "🐎",
  daimyo: "👑",
};

const AGE_OF_WAR_PHASE_LABELS = {
  select_target: "Select Target",
  roll: "Roll Dice",
  assign: "Assign Dice",
  game_over: "Game Over",
};

let ageOfWarExplainMode = false;

function parseAgeOfWarDie(code) {
  if (typeof code !== "string") {
    return { type: "infantry", value: 1 };
  }
  const trimmed = code.trim().toUpperCase();
  if (trimmed.startsWith("I")) {
    const value = Number.parseInt(trimmed.slice(1), 10);
    return { type: "infantry", value: Number.isFinite(value) ? value : 1 };
  }
  if (trimmed === "A") {
    return { type: "archery", value: 1 };
  }
  if (trimmed === "C") {
    return { type: "cavalry", value: 1 };
  }
  if (trimmed === "D") {
    return { type: "daimyo", value: 1 };
  }
  return { type: "infantry", value: 1 };
}

function formatAgeOfWarDieLabel(code) {
  const parsed = parseAgeOfWarDie(code);
  const icon = AGE_OF_WAR_ICONS[parsed.type] || "";
  if (parsed.type === "infantry") {
    return `${icon}${parsed.value}`;
  }
  return icon;
}

function formatAgeOfWarDieTitle(code) {
  const parsed = parseAgeOfWarDie(code);
  const typeName = parsed.type.charAt(0).toUpperCase() + parsed.type.slice(1);
  if (parsed.type === "infantry") {
    return `${typeName} ${parsed.value}`;
  }
  return typeName;
}

function formatAgeOfWarRequirement(req) {
  if (!req || typeof req !== "object") {
    return { text: "?", type: "unknown" };
  }
  const type = req.type || "infantry";
  const icon = AGE_OF_WAR_ICONS[type] || "";
  if (type === "infantry") {
    const rawSum = Number.isFinite(req.sum) ? req.sum : Number.parseInt(req.sum, 10);
    const sum = Number.isFinite(rawSum) ? rawSum : 0;
    return { text: `${icon}${sum}+`, type };
  }
  const rawCount = Number.isFinite(req.count) ? req.count : Number.parseInt(req.count, 10);
  const count = Number.isFinite(rawCount) ? rawCount : 1;
  const countLabel = count > 1 ? `×${count}` : "";
  return { text: `${icon}${countLabel}`, type };
}

function formatAgeOfWarCastleLabel(castle) {
  if (!castle) {
    return "Unknown";
  }
  const zh = castle.name_zh ? String(castle.name_zh).trim() : "";
  const en = castle.name ? String(castle.name).trim() : "";
  if (zh && en && zh !== en) {
    return `${zh} (${en})`;
  }
  return zh || en || castle.id || "Unknown";
}

function formatAgeOfWarClanLabel(castle) {
  if (!castle) {
    return "Unknown";
  }
  const zh = castle.clan_name_zh ? String(castle.clan_name_zh).trim() : "";
  const en = castle.clan_name ? String(castle.clan_name).trim() : "";
  if (zh && en && zh !== en) {
    return `${zh} (${en})`;
  }
  return zh || en || castle.clan || "Unknown";
}

function formatAgeOfWarPhase(phase) {
  if (!phase) {
    return "-";
  }
  return AGE_OF_WAR_PHASE_LABELS[phase] || phase;
}

function formatAgeOfWarWinner(view) {
  if (!view || !view.winner) {
    return "-";
  }
  const winner = view.winner;
  if (Array.isArray(winner)) {
    if (!winner.length) {
      return "-";
    }
    return winner.map((pid) => findPlayerName(view, pid)).join(", ");
  }
  return findPlayerName(view, winner) || winner;
}

function formatAgeOfWarTarget(view) {
  if (!view || !view.target) {
    if (view && view.phase === "select_target") {
      if (Array.isArray(view.dice_pool) && view.dice_pool.length) {
        return "Select a castle";
      }
      return "Roll dice or select a castle";
    }
    return "-";
  }
  const target = view.target;
  const castleLabel = formatAgeOfWarCastleLabel(target);
  if (target.target_type === "central") {
    return `Central: ${castleLabel}`;
  }
  if (target.target_type === "player") {
    const defenderName = findPlayerName(view, target.defender_id);
    return `Attack ${defenderName}: ${castleLabel}`;
  }
  return castleLabel;
}

function buildAgeOfWarClanLookup(view) {
  const lookup = {};
  const addCastle = (castle) => {
    if (!castle || !castle.clan) {
      return;
    }
    lookup[castle.clan] = {
      clan: castle.clan,
      name: castle.clan_name || castle.clan,
      name_zh: castle.clan_name_zh || "",
    };
  };
  if (!view) {
    return lookup;
  }
  (view.central_castles || []).forEach(addCastle);
  (view.players || []).forEach((player) => {
    (player.castles || []).forEach(addCastle);
  });
  if (view.target) {
    addCastle(view.target);
  }
  return lookup;
}

function formatAgeOfWarLockedClans(lockedClans, clanLookup) {
  if (!Array.isArray(lockedClans) || !lockedClans.length) {
    return "None";
  }
  return lockedClans
    .map((clanId) => {
      const meta = clanLookup[clanId];
      if (!meta) {
        return clanId;
      }
      const zh = meta.name_zh ? String(meta.name_zh).trim() : "";
      const en = meta.name ? String(meta.name).trim() : "";
      if (zh && en && zh !== en) {
        return `${zh} (${en})`;
      }
      return zh || en || clanId;
    })
    .join(", ");
}

function isAgeOfWarActionAvailable(actionType) {
  if (!currentAgeOfWarView || !Array.isArray(currentAgeOfWarView.legal_actions)) {
    return false;
  }
  return currentAgeOfWarView.legal_actions.includes(actionType);
}

function updateAgeOfWarActionButtons() {
  const buttons = [
    { el: ageOfWarRollBtn, allowed: isAgeOfWarActionAvailable("roll") },
    { el: ageOfWarPlayAgainBtn, allowed: isAgeOfWarActionAvailable("play_again") },
  ];
  buttons.forEach(({ el, allowed }) => {
    if (!el) {
      return;
    }
    if (currentGameType !== "age_of_war") {
      el.classList.remove("action-allowed");
      el.disabled = true;
      return;
    }
    if (allowed) {
      el.classList.add("action-allowed");
    } else {
      el.classList.remove("action-allowed");
    }
    el.disabled = !allowed;
  });
}

function clearAgeOfWarState() {
  currentAgeOfWarView = null;
  if (ageOfWarPhaseLabel) {
    ageOfWarPhaseLabel.textContent = "-";
  }
  if (ageOfWarTurnLabel) {
    ageOfWarTurnLabel.textContent = "-";
  }
  if (ageOfWarTargetLabel) {
    ageOfWarTargetLabel.textContent = "-";
  }
  if (ageOfWarDiceLeftLabel) {
    ageOfWarDiceLeftLabel.textContent = "-";
  }
  if (ageOfWarWinnerLabel) {
    ageOfWarWinnerLabel.textContent = "-";
  }
  if (ageOfWarDice) {
    ageOfWarDice.innerHTML = "";
  }
  if (ageOfWarTargetLines) {
    ageOfWarTargetLines.innerHTML = "";
  }
  if (ageOfWarCentral) {
    ageOfWarCentral.innerHTML = "";
  }
  if (ageOfWarPlayers) {
    ageOfWarPlayers.innerHTML = "";
  }
  updateAgeOfWarActionButtons();
}

function renderAgeOfWarDice(view) {
  if (!ageOfWarDice) {
    return;
  }
  ageOfWarDice.innerHTML = "";
  const dicePool = view && Array.isArray(view.dice_pool) ? view.dice_pool : [];
  if (!dicePool.length) {
    const empty = document.createElement("div");
    empty.className = "age-of-war-empty";
    empty.textContent = "No dice rolled yet.";
    ageOfWarDice.appendChild(empty);
    return;
  }
  const canDiscard = isAgeOfWarActionAvailable("discard_die");
  dicePool.forEach((code, index) => {
    const die = document.createElement("button");
    die.type = "button";
    const parsed = parseAgeOfWarDie(code);
    die.className = `age-of-war-die ${parsed.type}`;
    die.textContent = formatAgeOfWarDieLabel(code);
    die.title = formatAgeOfWarDieTitle(code);
    if (canDiscard) {
      die.classList.add("clickable");
      die.addEventListener("click", () => {
        if (ageOfWarExplainMode) {
          return;
        }
        if (!isAgeOfWarActionAvailable("discard_die")) {
          return;
        }
        sendAction({ type: "discard_die", die_index: index });
      });
    } else {
      die.disabled = true;
    }
    ageOfWarDice.appendChild(die);
  });
  if (canDiscard) {
    const hint = document.createElement("div");
    hint.className = "age-of-war-hint";
    hint.textContent = "Tip: click a die to discard it.";
    ageOfWarDice.appendChild(hint);
  }
}

function renderAgeOfWarTargetLines(view) {
  if (!ageOfWarTargetLines) {
    return;
  }
  ageOfWarTargetLines.innerHTML = "";
  const lines = view && Array.isArray(view.target_lines) ? view.target_lines : [];
  if (!lines.length) {
    const empty = document.createElement("div");
    empty.className = "age-of-war-empty";
    if (view && view.phase === "select_target" && Array.isArray(view.dice_pool) && view.dice_pool.length) {
      empty.textContent = "Select a target to see its battle lines.";
    } else if (view && view.phase === "select_target") {
      empty.textContent = "Roll dice or select a target to see battle lines.";
    } else {
      empty.textContent = "Select a target to see its battle lines.";
    }
    ageOfWarTargetLines.appendChild(empty);
    return;
  }
  const canFill = isAgeOfWarActionAvailable("fill_line");
  lines.forEach((line) => {
    const row = document.createElement("div");
    row.className = "age-of-war-line";
    if (line.filled) {
      row.classList.add("filled");
    }
    if (line.bonus) {
      row.classList.add("bonus");
    }
    const fillable = canFill && line.can_fill && !line.filled;
    if (fillable) {
      row.classList.add("fillable");
    }

    const reqs = document.createElement("div");
    reqs.className = "age-of-war-line-reqs";
    (line.requirements || []).forEach((req) => {
      const formatted = formatAgeOfWarRequirement(req);
      const chip = document.createElement("span");
      chip.className = `age-of-war-req ${formatted.type}`;
      chip.textContent = formatted.text;
      reqs.appendChild(chip);
    });
    row.appendChild(reqs);

    const badges = document.createElement("div");
    badges.className = "age-of-war-line-badges";
    if (line.bonus) {
      const bonus = document.createElement("span");
      bonus.className = "age-of-war-badge bonus";
      bonus.textContent = "Bonus Daimyo";
      badges.appendChild(bonus);
    }
    if (line.filled) {
      const done = document.createElement("span");
      done.className = "age-of-war-badge filled";
      done.textContent = "Filled";
      badges.appendChild(done);
    }
    if (badges.children.length) {
      row.appendChild(badges);
    }

    if (fillable) {
      row.addEventListener("click", () => {
        if (ageOfWarExplainMode) {
          return;
        }
        if (!isAgeOfWarActionAvailable("fill_line")) {
          return;
        }
        sendAction({ type: "fill_line", line_index: line.index });
      });
    }

    ageOfWarTargetLines.appendChild(row);
  });
}

function renderAgeOfWarCastleLines(container, battleLines) {
  const lines = Array.isArray(battleLines) ? battleLines : [];
  if (!lines.length) {
    const empty = document.createElement("div");
    empty.className = "age-of-war-castle-line empty";
    empty.textContent = "No battle lines";
    container.appendChild(empty);
    return;
  }
  lines.forEach((line) => {
    const lineRow = document.createElement("div");
    lineRow.className = "age-of-war-castle-line";
    const parts = (line || []).map((req) => formatAgeOfWarRequirement(req).text);
    lineRow.textContent = parts.join(" + ");
    container.appendChild(lineRow);
  });
}

function buildAgeOfWarCastleCard(castle, options = {}) {
  const card = document.createElement("div");
  card.className = "age-of-war-castle-card";
  if (options.selectable) {
    card.classList.add("selectable");
  }
  if (options.selected) {
    card.classList.add("selected");
  }
  if (castle.locked) {
    card.classList.add("locked");
  }

  const title = document.createElement("div");
  title.className = "age-of-war-castle-title";
  title.textContent = formatAgeOfWarCastleLabel(castle);
  card.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "age-of-war-castle-meta";
  const clanLabel = formatAgeOfWarClanLabel(castle);
  const points = Number.isFinite(castle.points) ? castle.points : "-";
  meta.textContent = `${clanLabel} · ${points} pts`;
  card.appendChild(meta);

  const lines = document.createElement("div");
  lines.className = "age-of-war-castle-lines";
  renderAgeOfWarCastleLines(lines, castle.battle_lines);
  card.appendChild(lines);

  if (castle.locked) {
    const tag = document.createElement("div");
    tag.className = "age-of-war-castle-tag";
    tag.textContent = "🔒 Locked";
    card.appendChild(tag);
  }

  if (options.onClick) {
    card.addEventListener("click", options.onClick);
  }

  return card;
}

function renderAgeOfWarCentral(view) {
  if (!ageOfWarCentral) {
    return;
  }
  ageOfWarCentral.innerHTML = "";
  const castles = view && Array.isArray(view.central_castles) ? view.central_castles : [];
  if (!castles.length) {
    const empty = document.createElement("div");
    empty.className = "age-of-war-empty";
    empty.textContent = "No castles left in the center.";
    ageOfWarCentral.appendChild(empty);
    return;
  }
  const canSelect = isAgeOfWarActionAvailable("select_target");
  const selectedId = view && view.target ? view.target.id : null;
  castles.forEach((castle) => {
    const selectable = canSelect && castle.selectable;
    const selected = selectedId && selectedId === castle.id;
    const card = buildAgeOfWarCastleCard(castle, {
      selectable,
      selected,
      onClick: selectable
        ? () => {
            if (ageOfWarExplainMode) {
              return;
            }
            if (!isAgeOfWarActionAvailable("select_target")) {
              return;
            }
            sendAction({ type: "select_target", target_type: "central", castle_id: castle.id });
          }
        : null,
    });
    ageOfWarCentral.appendChild(card);
  });
}

function renderAgeOfWarPlayers(view) {
  if (!ageOfWarPlayers) {
    return;
  }
  ageOfWarPlayers.innerHTML = "";
  const players = view && Array.isArray(view.players) ? view.players : [];
  if (!players.length) {
    return;
  }
  const clanLookup = buildAgeOfWarClanLookup(view);
  const selectedId = view && view.target ? view.target.id : null;
  const selectedType = view && view.target ? view.target.target_type : null;
  const selectedDefender = view && view.target ? view.target.defender_id : null;
  const canSelect = isAgeOfWarActionAvailable("select_target");
  players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card age-of-war-player-card";
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    if (player.player_id === view.current_player) {
      card.classList.add("current");
    }

    const header = document.createElement("div");
    header.className = "age-of-war-player-header";
    const name = document.createElement("div");
    name.className = "age-of-war-player-name";
    const tags = [];
    if (player.player_id === view.you) {
      tags.push("you");
    }
    if (player.is_bot) {
      tags.push("bot");
    }
    name.textContent = `${player.name || player.player_id}${tags.length ? ` (${tags.join(", ")})` : ""}`;
    header.appendChild(name);

    const score = document.createElement("div");
    score.className = "age-of-war-player-score";
    score.textContent = `Score ${player.score ?? 0}`;
    header.appendChild(score);
    card.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "age-of-war-player-meta";
    const castleCount = Array.isArray(player.castles) ? player.castles.length : 0;
    meta.textContent = `Castles ${castleCount}`;
    card.appendChild(meta);

    const locked = document.createElement("div");
    locked.className = "age-of-war-player-locked";
    locked.textContent = `Locked clans: ${formatAgeOfWarLockedClans(player.locked_clans, clanLookup)}`;
    card.appendChild(locked);

    const castlesWrap = document.createElement("div");
    castlesWrap.className = "age-of-war-player-castles";
    const castles = Array.isArray(player.castles) ? player.castles : [];
    if (!castles.length) {
      const empty = document.createElement("div");
      empty.className = "age-of-war-empty";
      empty.textContent = "No castles yet.";
      castlesWrap.appendChild(empty);
    } else {
      castles.forEach((castle) => {
        const selectable = canSelect && castle.selectable;
        const selected =
          selectedType === "player" &&
          selectedDefender === player.player_id &&
          selectedId &&
          selectedId === castle.id;
        const cardEl = buildAgeOfWarCastleCard(castle, {
          selectable,
          selected,
          onClick: selectable
            ? () => {
                if (ageOfWarExplainMode) {
                  return;
                }
                if (!isAgeOfWarActionAvailable("select_target")) {
                  return;
                }
                sendAction({
                  type: "select_target",
                  target_type: "player",
                  defender_id: player.player_id,
                  castle_id: castle.id,
                });
              }
            : null,
        });
        castlesWrap.appendChild(cardEl);
      });
    }
    card.appendChild(castlesWrap);
    ageOfWarPlayers.appendChild(card);
  });
}

function renderAgeOfWarGameState(data) {
  const view = data && data.view ? data.view : data;
  currentAgeOfWarView = view;
  if (currentGameType !== "age_of_war") {
    currentGameType = "age_of_war";
    setGamePanelVisibility("age_of_war");
  }
  if (!view) {
    clearAgeOfWarState();
    return;
  }
  if (ageOfWarPhaseLabel) {
    ageOfWarPhaseLabel.textContent = formatAgeOfWarPhase(view.phase);
  }
  if (ageOfWarTurnLabel) {
    ageOfWarTurnLabel.textContent = view.current_player ? findPlayerName(view, view.current_player) : "-";
  }
  if (ageOfWarTargetLabel) {
    ageOfWarTargetLabel.textContent = formatAgeOfWarTarget(view);
  }
  if (ageOfWarDiceLeftLabel) {
    ageOfWarDiceLeftLabel.textContent = Number.isFinite(view.dice_remaining) ? view.dice_remaining : "-";
  }
  if (ageOfWarWinnerLabel) {
    ageOfWarWinnerLabel.textContent = formatAgeOfWarWinner(view);
  }

  renderAgeOfWarDice(view);
  renderAgeOfWarTargetLines(view);
  renderAgeOfWarCentral(view);
  renderAgeOfWarPlayers(view);
  updateAgeOfWarActionButtons();
}

function showAgeOfWarHeaderActions(show) {
  if (ageOfWarHeaderActions) {
    ageOfWarHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitAgeOfWarExplainMode();
    closeAgeOfWarHelpModal();
    closeAgeOfWarExplainModal();
  }
}

function showAgeOfWarHelpModal() {
  if (!ageOfWarHelpModal) {
    return;
  }
  if (ageOfWarHelpContent) {
    ageOfWarHelpContent.innerHTML = AGE_OF_WAR_HELP_TEXT;
  }
  setModalVisible(ageOfWarHelpModal, true);
}

function closeAgeOfWarHelpModal() {
  if (ageOfWarHelpModal) {
    setModalVisible(ageOfWarHelpModal, false);
  }
}

function updateAgeOfWarExplainModeClasses(enabled) {
  Object.keys(AGE_OF_WAR_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
}

function findAgeOfWarButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(AGE_OF_WAR_BUTTON_EXPLANATIONS)) {
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  return null;
}

function toggleAgeOfWarExplainMode() {
  ageOfWarExplainMode = !ageOfWarExplainMode;
  document.body.classList.toggle("age-of-war-explain-mode", ageOfWarExplainMode);
  updateAgeOfWarExplainModeClasses(ageOfWarExplainMode);
  if (ageOfWarExplainBtn) {
    ageOfWarExplainBtn.classList.toggle("active", ageOfWarExplainMode);
  }
}

function exitAgeOfWarExplainMode() {
  if (!ageOfWarExplainMode) {
    return;
  }
  ageOfWarExplainMode = false;
  document.body.classList.remove("age-of-war-explain-mode");
  updateAgeOfWarExplainModeClasses(false);
  if (ageOfWarExplainBtn) {
    ageOfWarExplainBtn.classList.remove("active");
  }
}

function showAgeOfWarButtonExplanation(buttonId) {
  const explanation = AGE_OF_WAR_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !ageOfWarExplainContent || !ageOfWarExplainModal) {
    return;
  }
  ageOfWarExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
  `;
  setModalVisible(ageOfWarExplainModal, true);
}

function closeAgeOfWarExplainModal() {
  if (ageOfWarExplainModal) {
    setModalVisible(ageOfWarExplainModal, false);
  }
}

if (ageOfWarRollBtn) {
  ageOfWarRollBtn.addEventListener("click", () => {
    if (!isAgeOfWarActionAvailable("roll")) {
      return;
    }
    sendAction({ type: "roll" });
  });
}

if (ageOfWarPlayAgainBtn) {
  ageOfWarPlayAgainBtn.addEventListener("click", () => {
    if (!isAgeOfWarActionAvailable("play_again")) {
      return;
    }
    sendAction({ type: "play_again" });
  });
}

if (ageOfWarHelpBtn) {
  ageOfWarHelpBtn.addEventListener("click", () => {
    showAgeOfWarHelpModal();
  });
}

if (ageOfWarHelpModalCloseBtn) {
  ageOfWarHelpModalCloseBtn.addEventListener("click", closeAgeOfWarHelpModal);
}

if (ageOfWarExplainBtn) {
  ageOfWarExplainBtn.addEventListener("click", () => {
    toggleAgeOfWarExplainMode();
  });
}

if (ageOfWarExplainModalCloseBtn) {
  ageOfWarExplainModalCloseBtn.addEventListener("click", closeAgeOfWarExplainModal);
}

// Capture pointer events in explain mode (works on disabled buttons too)
document.addEventListener(
  "pointerdown",
  (e) => {
    if (!ageOfWarExplainMode) return;

    const buttonId = findAgeOfWarButtonAtPoint(e.clientX, e.clientY);
    if (buttonId) {
      e.preventDefault();
      e.stopPropagation();
      showAgeOfWarButtonExplanation(buttonId);
      exitAgeOfWarExplainMode();
      return;
    }

    const button = e.target.closest("button");
    if (button === ageOfWarExplainBtn || button === ageOfWarHelpBtn) return;
    if (button === ageOfWarHelpModalCloseBtn || button === ageOfWarExplainModalCloseBtn) return;

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
    if (!ageOfWarExplainMode) return;

    const button = e.target.closest("button");
    if (!button) return;

    if (button === ageOfWarExplainBtn || button === ageOfWarHelpBtn) return;
    if (button === ageOfWarHelpModalCloseBtn || button === ageOfWarExplainModalCloseBtn) return;

    e.preventDefault();
    e.stopPropagation();
  },
  true
);

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") {
    return;
  }
  if (ageOfWarExplainMode) {
    exitAgeOfWarExplainMode();
    e.preventDefault();
    return;
  }
  let closed = false;
  if (ageOfWarHelpModal && !ageOfWarHelpModal.classList.contains("hidden")) {
    closeAgeOfWarHelpModal();
    closed = true;
  }
  if (ageOfWarExplainModal && !ageOfWarExplainModal.classList.contains("hidden")) {
    closeAgeOfWarExplainModal();
    closed = true;
  }
  if (closed) {
    e.preventDefault();
  }
});
