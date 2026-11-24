let currentAgeOfWarView = null;
let ageOfWarSelectedLine = null;
let ageOfWarSelectedDice = new Set();
let ageOfWarSelectionKey = null;
let ageOfWarHintTimer = null;
let ageOfWarSupplyTab = "central";
let ageOfWarHelpLanguage = "en";
let ageOfWarHelpSection = "basics";
let ageOfWarBrowseOpen = false;
let ageOfWarPointerStart = null;
let ageOfWarPointerMoved = false;
let ageOfWarExplainClickPending = false;

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
const ageOfWarDiscardBtn = document.getElementById("ageOfWarDiscardBtn");
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
  <li>Choose a highlighted battle line to preview a suggested dice combination. Click dice to select or deselect them, then click Place Dice to confirm. The preview uses the fewest dice: for Infantry (⚔️) 3, it prefers one ⚔️3 die over ⚔️1 + ⚔️2.</li>
  <li>Infantry (⚔️) dice add up to meet or exceed the required sum. Archery (🏹), Cavalry (🐎), and Daimyo (👑) must match the required counts exactly. Only the selected dice are used; reroll the remaining dice next.</li>
  <li>If you cannot or choose not to fill a line, select exactly one die and click Discard 1, then reroll the rest. Clicking a die only changes your selection.</li>
  <li>Click empty space or press Esc to cancel the selection.</li>
</ol>

<h3>Capture</h3>
<p>Fill all lines to capture the castle. If attacking a player, you must also complete an extra Daimyo (👑) line.</p>

<h3>Clan Lock</h3>
<p>When you own all castles of a clan, that clan locks (🔒) and cannot be attacked. Locked clans score their set bonus instead of the sum of castle points.</p>

<h3>Game End</h3>
<p>The game ends immediately when the last central castle is captured.</p>
`;

const AGE_OF_WAR_HELP_BASICS = {
  en: `<h3>Win with castles</h3><p>Have the most points when the last central castle is captured.</p>
    <h3>Your turn</h3><p>Roll your dice, choose a castle, and fill one battle line per roll until you capture it or run out of dice.</p>
    <h3>What matters</h3><p>Save dice for the remaining lines and collect complete clans for protected bonus points.</p>
    <p>Choose a castle, then confirm Attack on that card. Choose a highlighted line, adjust the suggested dice, and confirm Place Dice beside it. Select one die and Discard 1 if you cannot fill a line.</p>
    <p>Use Central and Players to browse targets without leaving your dice. The arrows show more central castles on phones. Tap empty space or press Escape to cancel a selection.</p>`,
  zh: `<h3>如何获胜</h3><p>中央最后一座城池被攻占时，总分最高的玩家获胜。</p>
    <h3>每回合做什么</h3><p>掷骰后选择城池，每次掷骰填一条战线，直到攻占城池或耗尽骰子。</p>
    <h3>游戏重点</h3><p>尽量节省骰子应付剩余战线，并集齐家族获得不会被夺取的奖励分。</p>
    <p>点城池后，在卡牌上按 Attack 确认。点高亮战线预选骰子，可以调整后按 Place Dice 放置。无法填线时，选择一颗骰子再按 Discard 1 弃掉。</p>
    <p>用 Central 和 Players 切换中央城池与玩家城池，手机上用箭头翻页，骰子和战线始终留在附近。点击空白或按 Escape 取消选择。</p>`,
};

const AGE_OF_WAR_HELP_DETAILS_ZH = `<h3>骰子与战线</h3>
  <p>步兵（⚔️）有 1、2、3 点战力，多颗可以相加，达到或超过战线要求即可。弓箭（🏹）、骑兵（🐎）和大名（👑）必须精确匹配数量。预选组合优先使用最少颗骰子。</p>
  <p>每次只能完成一条战线，使用的骰子移出本回合，剩余骰子需要重新掷。也可以主动弃掉一颗骰子后重掷。目标选定后，本回合不能更换。</p>
  <h3>夺城与锁定</h3><p>攻击对手未锁定的城池，需要额外完成一条大名（👑）战线。集齐家族后立即锁定（🔒），不能再被夺取。该家族按整套奖励总分计分，取代其单卡分数。</p>
  <h3>终局与 AI</h3><p>中央最后一座城被攻占时立即计分，同分玩家共同获胜。AI 先掷骰再选择目标，比较攻城概率、家族奖励与夺取领先玩家城池的收益。</p>`;

const AGE_OF_WAR_BUTTON_EXPLANATIONS = {
  ageOfWarRollBtn: {
    name: "Roll Dice",
    description: "Roll all remaining dice. You can roll before choosing a target.",
  },
  ageOfWarPlayAgainBtn: {
    name: "Play Again",
    description: "Restart the game after it ends.",
  },
  ageOfWarDiscardBtn: {
    name: "Discard 1",
    description: "Select exactly one die, then discard it and reroll the rest. Clicking a die only selects it; it does not discard it.",
  },
  ageOfWarPlaceDiceBtn: {
    name: "Place Dice",
    description: "Fill the chosen battle line using exactly the highlighted dice. Click any die to change the suggestion before confirming. Infantry (⚔️) must meet or exceed the total; Archery (🏹), Cavalry (🐎), and Daimyo (👑) must match their counts exactly.",
  },
  ageOfWarCentralTab: { name: "Central castles", description: "Browse unclaimed castles. Capturing the last one ends the game immediately." },
  ageOfWarPlayersTab: { name: "Players", description: "Inspect scores and owned castles. Unlocked opponent castles can be attacked, but require an extra Daimyo (👑) line. Locked clans (🔒) are protected and score their set total instead of individual castle points." },
  ageOfWarBrowseBtn: { name: "Inspect castles", description: "Expand or collapse the castle browser on phones while keeping this attack and dice selection unchanged." },
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
    return `${typeName} (${AGE_OF_WAR_ICONS[parsed.type]}) ${parsed.value}`;
  }
  return `${typeName} (${AGE_OF_WAR_ICONS[parsed.type]})`;
}

function addAgeOfWarSymbolHint(element, text) {
  element.title = text;
  element.setAttribute("aria-label", text);
  element.addEventListener("click", (event) => {
    if (event.pointerType !== "touch" || ageOfWarExplainMode || ageOfWarPointerMoved) return;
    if (element.closest("button, [role='button'], .age-of-war-castle-card.selectable")) return;
    let hint = document.getElementById("ageOfWarSymbolHint");
    if (!hint) {
      hint = document.createElement("div");
      hint.id = "ageOfWarSymbolHint";
      hint.className = "age-of-war-symbol-hint";
      hint.setAttribute("role", "status");
      document.body.appendChild(hint);
    }
    hint.textContent = text;
    hint.hidden = false;
    clearTimeout(ageOfWarHintTimer);
    ageOfWarHintTimer = setTimeout(() => { hint.hidden = true; }, 3000);
  });
}

function formatAgeOfWarRequirementTitle(req) {
  const type = req.type || "infantry";
  const name = type.charAt(0).toUpperCase() + type.slice(1);
  const amount = type === "infantry" ? `${req.sum}+ total` : `exactly ${req.count ?? 1}`;
  return `${name} (${AGE_OF_WAR_ICONS[type] || ""}): ${amount}`;
}

function isAgeOfWarSelectionValid(line) {
  if (!line || line.filled || !line.can_fill || !ageOfWarSelectedDice.size) return false;
  const required = { infantry: 0, archery: 0, cavalry: 0, daimyo: 0 };
  (line.requirements || []).forEach((req) => {
    required[req.type] += Number(req.type === "infantry" ? req.sum : (req.count ?? 1));
  });
  const selected = { infantry: 0, archery: 0, cavalry: 0, daimyo: 0 };
  for (const index of ageOfWarSelectedDice) {
    const code = currentAgeOfWarView?.dice_pool?.[index];
    if (!code) return false;
    const die = parseAgeOfWarDie(code);
    selected[die.type] += die.value;
  }
  return Object.keys(required).every((type) =>
    type === "infantry" && required[type] > 0
      ? selected[type] >= required[type]
      : selected[type] === required[type]
  );
}

function resetAgeOfWarSelection() {
  ageOfWarSelectedLine = null;
  ageOfWarSelectedDice.clear();
}

function refreshAgeOfWarSelection() {
  renderAgeOfWarDice(currentAgeOfWarView);
  renderAgeOfWarTargetLines(currentAgeOfWarView);
  updateAgeOfWarActionButtons();
  updateAgeOfWarExplainModeClasses(ageOfWarExplainMode);
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

function appendAgeOfWarBilingualLabel(container, primaryValue, secondaryValue, fallback) {
  const primary = primaryValue ? String(primaryValue).trim() : "";
  const secondary = secondaryValue ? String(secondaryValue).trim() : "";
  const primaryLabel = document.createElement("span");
  primaryLabel.className = "age-of-war-label-primary";
  primaryLabel.textContent = primary || secondary || fallback;
  container.appendChild(primaryLabel);

  if (primary && secondary && primary !== secondary) {
    const secondaryLabel = document.createElement("span");
    secondaryLabel.className = "age-of-war-label-secondary";
    secondaryLabel.textContent = ` (${secondary})`;
    container.appendChild(secondaryLabel);
  }
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
    { el: ageOfWarDiscardBtn, allowed: isAgeOfWarActionAvailable("discard_die") && ageOfWarSelectedDice.size === 1 },
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
  ageOfWarSupplyTab = "central";
  ageOfWarBrowseOpen = false;
  resetAgeOfWarSelection();
  ageOfWarSelectionKey = null;
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
  const canSelect = isAgeOfWarActionAvailable("fill_line") || isAgeOfWarActionAvailable("discard_die");
  dicePool.forEach((code, index) => {
    const die = document.createElement(canSelect ? "button" : "span");
    if (canSelect) die.type = "button";
    const parsed = parseAgeOfWarDie(code);
    die.className = `age-of-war-die ${parsed.type}`;
    die.textContent = formatAgeOfWarDieLabel(code);
    addAgeOfWarSymbolHint(die, formatAgeOfWarDieTitle(code));
    die.dataset.dieIndex = index;
    die.dataset.ageOfWarExplanationTitle = formatAgeOfWarDieTitle(code);
    die.dataset.ageOfWarExplanationBody = "Select or deselect this die for the chosen battle line. Only the selected dice are spent when you confirm Place Dice. Select exactly one die to discard it instead.";
    die.classList.toggle("selected", ageOfWarSelectedDice.has(index));
    die.setAttribute("aria-pressed", String(ageOfWarSelectedDice.has(index)));
    if (canSelect) {
      die.classList.add("clickable");
      die.addEventListener("click", () => {
        if (ageOfWarExplainMode || ageOfWarPointerMoved) {
          return;
        }
        if (!isAgeOfWarActionAvailable("fill_line") && !isAgeOfWarActionAvailable("discard_die")) {
          return;
        }
        if (ageOfWarSelectedDice.has(index)) {
          ageOfWarSelectedDice.delete(index);
        } else {
          ageOfWarSelectedDice.add(index);
        }
        refreshAgeOfWarSelection();
        ageOfWarDice.querySelector(`[data-die-index="${index}"]`)?.focus({ preventScroll: true });
      });
    }
    ageOfWarDice.appendChild(die);
  });
  if (canSelect) {
    const hint = document.createElement("div");
    hint.className = "age-of-war-hint";
    hint.textContent = ageOfWarSelectedLine === null
      ? "Choose a battle line to preview dice, or select one die to discard."
      : "Click dice to change the selection, then confirm with Place Dice.";
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
    row.dataset.lineIndex = line.index;
    row.dataset.ageOfWarExplanationTitle = `Battle line ${line.index + 1}`;
    row.dataset.ageOfWarExplanationBody = `${(line.requirements || []).map(formatAgeOfWarRequirementTitle).join(" + ")}. ${line.filled ? "Already completed." : line.can_fill ? "Your current dice can fill this line. Choose it to preview the fewest dice, adjust them, and confirm Place Dice." : "Your current dice cannot fill this line."} ${line.bonus ? "This extra Daimyo (👑) is required because you are attacking another player." : "Complete every line to capture the castle."}`;
    const selected = ageOfWarSelectedLine === line.index;
    row.classList.toggle("selected", selected);
    if (line.filled) {
      row.classList.add("filled");
    }
    if (line.bonus) {
      row.classList.add("bonus");
    }
    const fillable = canFill && line.can_fill && !line.filled;
    if (fillable) {
      row.classList.add("fillable");
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("aria-pressed", String(selected));
      row.setAttribute("aria-label", `Choose battle line ${line.index + 1}: ${(line.requirements || []).map(formatAgeOfWarRequirementTitle).join(", ")}`);
    }

    const reqs = document.createElement("div");
    reqs.className = "age-of-war-line-reqs";
    (line.requirements || []).forEach((req) => {
      const formatted = formatAgeOfWarRequirement(req);
      const chip = document.createElement("span");
      chip.className = `age-of-war-req ${formatted.type}`;
      chip.textContent = formatted.text;
      addAgeOfWarSymbolHint(chip, formatAgeOfWarRequirementTitle(req));
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
    } else if (fillable) {
      const choose = document.createElement("span");
      choose.className = "age-of-war-badge";
      choose.textContent = selected ? "Selected" : "Choose Dice";
      badges.appendChild(choose);
    }
    if (badges.children.length) {
      row.appendChild(badges);
    }

    if (fillable) {
      const chooseLine = () => {
        if (ageOfWarExplainMode || ageOfWarPointerMoved) {
          return;
        }
        if (!isAgeOfWarActionAvailable("fill_line")) {
          return;
        }
        if (ageOfWarSelectedLine !== line.index) {
          ageOfWarSelectedLine = line.index;
          ageOfWarSelectedDice = new Set(line.suggested_dice || []);
          refreshAgeOfWarSelection();
          ageOfWarTargetLines.querySelector(`[data-line-index="${line.index}"]`)?.focus({ preventScroll: true });
        }
      };
      row.addEventListener("click", chooseLine);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          chooseLine();
        }
      });
    }

    ageOfWarTargetLines.appendChild(row);
    if (selected && fillable) {
      const preview = document.createElement("div");
      preview.className = "age-of-war-placement";
      const summary = document.createElement("div");
      summary.className = "age-of-war-placement-summary";
      summary.setAttribute("role", "status");
      const indices = [...ageOfWarSelectedDice].sort((a, b) => a - b);
      const diceLabels = indices.map((index) => formatAgeOfWarDieLabel(view.dice_pool[index]));
      const valid = isAgeOfWarSelectionValid(line);
      summary.textContent = indices.length
        ? `Selected: ${diceLabels.join(" + ")} · ${indices.length} ${indices.length === 1 ? "die" : "dice"} · ${view.dice_pool.length - indices.length} left`
        : "Select the dice you want to use.";
      preview.appendChild(summary);
      if (!valid && indices.length) {
        const warning = document.createElement("div");
        warning.className = "age-of-war-selection-warning";
        warning.textContent = "These dice do not match this line. Adjust your selection.";
        preview.appendChild(warning);
      }
      const place = document.createElement("button");
      place.type = "button";
      place.id = "ageOfWarPlaceDiceBtn";
      place.textContent = "Place Dice";
      place.disabled = !valid;
      place.classList.toggle("action-allowed", valid);
      place.addEventListener("click", () => {
        if (ageOfWarExplainMode || !isAgeOfWarActionAvailable("fill_line") || !isAgeOfWarSelectionValid(line)) return;
        const dieIndices = [...ageOfWarSelectedDice].sort((a, b) => a - b);
        sendAction({ type: "fill_line", line_index: line.index, die_indices: dieIndices });
        resetAgeOfWarSelection();
        refreshAgeOfWarSelection();
      });
      preview.appendChild(place);
      ageOfWarTargetLines.appendChild(preview);
    }
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
    addAgeOfWarSymbolHint(lineRow, (line || []).map(formatAgeOfWarRequirementTitle).join("; "));
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

  card.dataset.ageOfWarExplanationTitle = formatAgeOfWarCastleLabel(castle);
  card.dataset.ageOfWarExplanationBody = `${formatAgeOfWarClanLabel(castle)} · ${castle.points} points. Battle lines: ${(castle.battle_lines || []).map((line) => line.map(formatAgeOfWarRequirementTitle).join(" + ")).join(" / ")}. ${castle.locked ? "This clan is locked (🔒) and cannot be attacked." : castle.owner_id ? "Attacking this castle requires an extra Daimyo (👑) line." : "Capturing the last central castle ends the game."}`;

  const title = document.createElement("div");
  title.className = "age-of-war-castle-title";
  title.title = formatAgeOfWarCastleLabel(castle);
  appendAgeOfWarBilingualLabel(title, castle.name_zh, castle.name, castle.id || "Unknown");
  card.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "age-of-war-castle-meta";
  meta.title = formatAgeOfWarClanLabel(castle);
  const clan = document.createElement("span");
  clan.className = "age-of-war-castle-clan";
  appendAgeOfWarBilingualLabel(
    clan,
    castle.clan_name_zh,
    castle.clan_name,
    castle.clan || "Unknown",
  );
  meta.appendChild(clan);

  const points = Number.isFinite(castle.points) ? castle.points : "-";
  const pointsLabel = document.createElement("span");
  pointsLabel.className = "age-of-war-castle-points";
  pointsLabel.textContent = `${points} pts`;
  meta.appendChild(pointsLabel);
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

  if (options.action) {
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Attack ${formatAgeOfWarCastleLabel(castle)}`);
    const choose = () => {
      if (ageOfWarExplainMode || ageOfWarPointerMoved || !isAgeOfWarActionAvailable("select_target")) return;
      if (card.querySelector(".age-of-war-confirm")) return;
      closeAgeOfWarCastleConfirmation();
      const confirmation = document.createElement("div");
      confirmation.className = "age-of-war-confirm";
      const label = document.createElement("strong");
      label.textContent = castle.name_zh || castle.name;
      confirmation.appendChild(label);
      const attack = document.createElement("button");
      attack.type = "button";
      attack.textContent = "Attack";
      attack.dataset.ageOfWarExplanationTitle = "Confirm attack";
      attack.dataset.ageOfWarExplanationBody = "Commit to this castle for the rest of this turn. Use dice to fill all of its battle lines to capture it.";
      attack.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!ageOfWarExplainMode && isAgeOfWarActionAvailable("select_target")) sendAction(options.action);
      });
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", (event) => {
        event.stopPropagation();
        closeAgeOfWarCastleConfirmation();
        card.focus({ preventScroll: true });
      });
      confirmation.append(attack, cancel);
      card.appendChild(confirmation);
      card.setAttribute("aria-expanded", "true");
      updateAgeOfWarExplainModeClasses(ageOfWarExplainMode);
    };
    card.addEventListener("click", choose);
    card.addEventListener("keydown", (event) => {
      if (event.target !== card || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      ageOfWarPointerMoved = false;
      choose();
    });
  }

  return card;
}

function closeAgeOfWarCastleConfirmation() {
  document.querySelectorAll("#ageOfWarPanel .age-of-war-confirm").forEach((element) => {
    element.parentElement.setAttribute("aria-expanded", "false");
    element.remove();
  });
}

function updateAgeOfWarSupply() {
  ageOfWarCentral.hidden = ageOfWarSupplyTab !== "central";
  ageOfWarPlayers.hidden = ageOfWarSupplyTab !== "players";
  document.getElementById("ageOfWarCentralTab").setAttribute("aria-pressed", String(ageOfWarSupplyTab === "central"));
  document.getElementById("ageOfWarPlayersTab").setAttribute("aria-pressed", String(ageOfWarSupplyTab === "players"));
  const panel = document.getElementById("ageOfWarPanel");
  panel.classList.toggle("has-target", Boolean(currentAgeOfWarView?.target));
  panel.classList.toggle("supply-open", ageOfWarBrowseOpen);
  panel.classList.toggle("game-over", Boolean(currentAgeOfWarView?.game_over));
  document.getElementById("ageOfWarBrowseBtn").setAttribute("aria-expanded", String(ageOfWarBrowseOpen));
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
      action: selectable ? { type: "select_target", target_type: "central", castle_id: castle.id } : null,
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
    const castles = Array.isArray(player.castles) ? player.castles : [];
    const card = document.createElement("div");
    card.className = "player-card age-of-war-player-card";
    card.classList.toggle("has-castles", castles.length > 0);
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
    const castleCount = castles.length;
    meta.textContent = `Castles ${castleCount}`;
    card.appendChild(meta);

    const locked = document.createElement("div");
    locked.className = "age-of-war-player-locked";
    locked.classList.toggle(
      "is-empty",
      !Array.isArray(player.locked_clans) || !player.locked_clans.length,
    );
    locked.textContent = `Locked clans: ${formatAgeOfWarLockedClans(player.locked_clans, clanLookup)}`;
    card.appendChild(locked);

    const castlesWrap = document.createElement("div");
    castlesWrap.className = "age-of-war-player-castles";
    castlesWrap.classList.toggle("is-empty", !castles.length);
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
          action: selectable ? {
            type: "select_target", target_type: "player", defender_id: player.player_id, castle_id: castle.id,
          } : null,
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
  if (view?.target?.id !== currentAgeOfWarView?.target?.id) ageOfWarBrowseOpen = false;
  const selectionKey = JSON.stringify(view && [
    view.you, view.current_player, view.phase, view.target, view.dice_pool,
    view.target_lines, view.legal_actions,
  ]);
  if (selectionKey !== ageOfWarSelectionKey) {
    resetAgeOfWarSelection();
    ageOfWarSelectionKey = selectionKey;
  }
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
  document.getElementById("ageOfWarWinnerRow").hidden = !view.game_over;
  ageOfWarRollBtn.hidden = !view.legal_actions.includes("roll");
  ageOfWarDiscardBtn.hidden = view.phase !== "assign";
  ageOfWarPlayAgainBtn.hidden = !view.game_over;
  const scores = document.getElementById("ageOfWarScores");
  scores.replaceChildren();
  (view.players || []).forEach((player) => {
    const score = document.createElement("span");
    score.className = "age-of-war-score";
    score.classList.toggle("current", player.player_id === view.current_player);
    score.textContent = `${player.name || player.player_id}${player.player_id === view.you ? " (you)" : ""} ${player.is_bot ? "🤖 " : ""}${player.score} pts`;
    addAgeOfWarSymbolHint(score, `${player.castles.length} castles · ${player.locked_clans.length} locked clans (🔒). Clan set totals replace individual castle points.`);
    scores.appendChild(score);
  });

  renderAgeOfWarDice(view);
  renderAgeOfWarTargetLines(view);
  renderAgeOfWarCentral(view);
  renderAgeOfWarPlayers(view);
  updateAgeOfWarSupply();
  updateAgeOfWarActionButtons();
  updateAgeOfWarExplainModeClasses(ageOfWarExplainMode);
}

function showAgeOfWarHeaderActions(show) {
  if (ageOfWarHeaderActions) {
    ageOfWarHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    resetAgeOfWarSelection();
    const hint = document.getElementById("ageOfWarSymbolHint");
    if (hint) hint.hidden = true;
    exitAgeOfWarExplainMode();
    closeAgeOfWarHelpModal();
    closeAgeOfWarExplainModal();
  }
}

function showAgeOfWarHelpModal() {
  if (!ageOfWarHelpModal) {
    return;
  }
  renderAgeOfWarHelp();
  setModalVisible(ageOfWarHelpModal, true);
}

function renderAgeOfWarHelp() {
  ageOfWarHelpContent.innerHTML = ageOfWarHelpSection === "basics" ? AGE_OF_WAR_HELP_BASICS[ageOfWarHelpLanguage]
    : ageOfWarHelpLanguage === "zh" ? AGE_OF_WAR_HELP_DETAILS_ZH : AGE_OF_WAR_HELP_TEXT;
  ageOfWarHelpContent.scrollTop = 0;
  [["English", ageOfWarHelpLanguage === "en"], ["Chinese", ageOfWarHelpLanguage === "zh"],
    ["Basics", ageOfWarHelpSection === "basics"], ["Details", ageOfWarHelpSection === "details"]].forEach(([key, active]) => {
    document.getElementById(`ageOfWarHelp${key}Btn`).setAttribute("aria-pressed", String(active));
  });
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
  document.querySelectorAll("#ageOfWarPanel [data-age-of-war-explanation-body]").forEach((element) => {
    element.classList.toggle("has-explanation", enabled);
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

if (ageOfWarDiscardBtn) {
  ageOfWarDiscardBtn.addEventListener("click", () => {
    if (ageOfWarExplainMode || !isAgeOfWarActionAvailable("discard_die") || ageOfWarSelectedDice.size !== 1) return;
    sendAction({ type: "discard_die", die_index: [...ageOfWarSelectedDice][0] });
    resetAgeOfWarSelection();
    refreshAgeOfWarSelection();
  });
}

document.addEventListener("click", (event) => {
  if (currentGameType !== "age_of_war" || ageOfWarExplainMode) return;
  if (event.target.closest("button, .age-of-war-die, .age-of-war-line, .age-of-war-placement, .age-of-war-castle-card, .modal")) return;
  closeAgeOfWarCastleConfirmation();
  if (ageOfWarSelectedLine === null && !ageOfWarSelectedDice.size) return;
  resetAgeOfWarSelection();
  refreshAgeOfWarSelection();
});

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

document.addEventListener("pointerdown", (event) => {
  if (currentGameType !== "age_of_war") return;
  ageOfWarExplainClickPending = false;
  ageOfWarPointerStart = { x: event.clientX, y: event.clientY };
  ageOfWarPointerMoved = false;
}, true);

document.addEventListener(
  "pointerdown",
  (e) => {
    if (!ageOfWarExplainMode) return;

    const dynamic = e.target.closest("[data-age-of-war-explanation-body]");
    if (dynamic) {
      e.preventDefault();
      e.stopPropagation();
      ageOfWarExplainClickPending = true;
      showAgeOfWarElementExplanation(dynamic);
      exitAgeOfWarExplainMode();
      return;
    }

    const buttonId = findAgeOfWarButtonAtPoint(e.clientX, e.clientY);
    if (buttonId) {
      e.preventDefault();
      e.stopPropagation();
      ageOfWarExplainClickPending = true;
      showAgeOfWarButtonExplanation(buttonId);
      exitAgeOfWarExplainMode();
      return;
    }

    const button = e.target.closest("button");
    if (button === ageOfWarExplainBtn || button === ageOfWarHelpBtn) return;
    if (button === ageOfWarHelpModalCloseBtn || button === ageOfWarExplainModalCloseBtn) return;
    if (button?.closest("#ageOfWarHelpModal")) return;

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
    if (ageOfWarExplainClickPending) {
      ageOfWarExplainClickPending = false;
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (!ageOfWarExplainMode) return;

    const dynamic = e.target.closest("[data-age-of-war-explanation-body]");
    if (dynamic) {
      e.preventDefault();
      e.stopPropagation();
      showAgeOfWarElementExplanation(dynamic);
      exitAgeOfWarExplainMode();
      return;
    }

    const button = e.target.closest("button");
    if (!button) return;

    if (button === ageOfWarExplainBtn || button === ageOfWarHelpBtn) return;
    if (button === ageOfWarHelpModalCloseBtn || button === ageOfWarExplainModalCloseBtn) return;
    if (button.closest("#ageOfWarHelpModal")) return;

    e.preventDefault();
    e.stopPropagation();
    if (AGE_OF_WAR_BUTTON_EXPLANATIONS[button.id]) {
      showAgeOfWarButtonExplanation(button.id);
      exitAgeOfWarExplainMode();
    }
  },
  true
);

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") {
    return;
  }
  if (currentGameType === "age_of_war") closeAgeOfWarCastleConfirmation();
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
    return;
  }
  if (currentGameType === "age_of_war" && (ageOfWarSelectedLine !== null || ageOfWarSelectedDice.size)) {
    resetAgeOfWarSelection();
    refreshAgeOfWarSelection();
    e.preventDefault();
  }
});

function showAgeOfWarElementExplanation(element) {
  ageOfWarExplainContent.replaceChildren();
  const title = document.createElement("h4");
  title.textContent = element.dataset.ageOfWarExplanationTitle;
  const body = document.createElement("p");
  body.textContent = element.dataset.ageOfWarExplanationBody;
  ageOfWarExplainContent.append(title, body);
  setModalVisible(ageOfWarExplainModal, true);
}

[["Central", "central"], ["Players", "players"]].forEach(([label, tab]) => {
  document.getElementById(`ageOfWar${label}Tab`).addEventListener("click", () => {
    closeAgeOfWarCastleConfirmation();
    ageOfWarSupplyTab = tab;
    updateAgeOfWarSupply();
  });
});
document.getElementById("ageOfWarBrowseBtn").addEventListener("click", () => {
  ageOfWarBrowseOpen = !ageOfWarBrowseOpen;
  updateAgeOfWarSupply();
});
[["English", "en"], ["Chinese", "zh"]].forEach(([label, language]) => {
  document.getElementById(`ageOfWarHelp${label}Btn`).addEventListener("click", () => {
    ageOfWarHelpLanguage = language;
    renderAgeOfWarHelp();
  });
});
["Basics", "Details"].forEach((section) => {
  document.getElementById(`ageOfWarHelp${section}Btn`).addEventListener("click", () => {
    ageOfWarHelpSection = section.toLowerCase();
    renderAgeOfWarHelp();
  });
});
document.addEventListener("pointermove", (event) => {
  if (!ageOfWarPointerStart) return;
  if (Math.hypot(event.clientX - ageOfWarPointerStart.x, event.clientY - ageOfWarPointerStart.y) > 9) {
    ageOfWarPointerMoved = true;
  }
}, true);
document.addEventListener("pointerup", () => { ageOfWarPointerStart = null; }, true);
document.addEventListener("pointercancel", () => {
  ageOfWarPointerStart = null;
  ageOfWarPointerMoved = true;
}, true);
window.addEventListener("resize", () => {
  if (currentAgeOfWarView && currentGameType === "age_of_war") updateAgeOfWarSupply();
});
document.addEventListener("keydown", (event) => {
  if (["Enter", " "].includes(event.key)) ageOfWarPointerMoved = false;
}, true);
