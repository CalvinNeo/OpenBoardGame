let currentYahtzeeView = null;
let yahtzeeConfigSignature = null;

const yahtzeeConfigBox = document.getElementById("yahtzeeConfigBox");
const yahtzeeBotStrategySelect = document.getElementById("yahtzeeBotStrategySelect");
const yahtzeeBotStrategyHint = document.getElementById("yahtzeeBotStrategyHint");

const yahtzeePhaseLabel = document.getElementById("yahtzeePhase");
const yahtzeeRoundLabel = document.getElementById("yahtzeeRound");
const yahtzeeTurnLabel = document.getElementById("yahtzeeTurn");
const yahtzeeRollsLabel = document.getElementById("yahtzeeRolls");
const yahtzeeWinnerLabel = document.getElementById("yahtzeeWinner");
const yahtzeeJokerNotice = document.getElementById("yahtzeeJokerNotice");
const yahtzeeJokerBody = document.getElementById("yahtzeeJokerBody");
const yahtzeeDice = document.getElementById("yahtzeeDice");
const yahtzeeRollBtn = document.getElementById("yahtzeeRollBtn");
const yahtzeeScorecards = document.getElementById("yahtzeeScorecards");

function getYahtzeeConfig() {
  return {
    bot_strategy: yahtzeeBotStrategySelect.value === "dynamic_programming" ? "dynamic_programming" : "classic",
  };
}

function updateYahtzeeConfigHint() {
  yahtzeeBotStrategyHint.textContent = getYahtzeeConfig().bot_strategy === "dynamic_programming"
    ? "DP = dynamic programming. Plans for the highest expected final score. All bots."
    : "Original AI: random rerolls and immediate scores. All bots.";
}

function updateYahtzeeConfigRow() {
  const visible = Boolean(currentRoomState && currentGameType === "yahtzee");
  yahtzeeConfigBox.classList.toggle("hidden", !visible);
  yahtzeeConfigBox.setAttribute("aria-hidden", String(!visible));
  if (!visible) {
    yahtzeeConfigSignature = null;
    yahtzeeBotStrategySelect.value = "classic";
    return;
  }
  const config = currentRoomState.status !== "lobby" && currentYahtzeeView
    ? currentYahtzeeView.config || {}
    : currentRoomState.game_config || {};
  const signature = JSON.stringify([currentRoomState.room_id, config.bot_strategy || "classic"]);
  if (signature !== yahtzeeConfigSignature) {
    yahtzeeBotStrategySelect.value = config.bot_strategy === "dynamic_programming" ? "dynamic_programming" : "classic";
    yahtzeeConfigSignature = signature;
  }
  yahtzeeBotStrategySelect.disabled = !["lobby", "game_over"].includes(currentRoomState.status);
  updateYahtzeeConfigHint();
}

function formatYahtzeeCategoryLabel(view, category) {
  if (view && view.category_labels && view.category_labels[category]) {
    return view.category_labels[category];
  }
  return category || "-";
}

function isYahtzeeActionAvailable(actionType) {
  if (!currentYahtzeeView || !Array.isArray(currentYahtzeeView.legal_actions)) {
    return false;
  }
  return currentYahtzeeView.legal_actions.includes(actionType);
}

function updateYahtzeeActionButtons() {
  if (!yahtzeeRollBtn) {
    return;
  }
  if (currentGameType !== "yahtzee") {
    yahtzeeRollBtn.classList.remove("action-allowed");
    yahtzeeRollBtn.disabled = true;
    return;
  }
  const allowed = isYahtzeeActionAvailable("roll");
  if (allowed) {
    yahtzeeRollBtn.classList.add("action-allowed");
  } else {
    yahtzeeRollBtn.classList.remove("action-allowed");
  }
  yahtzeeRollBtn.disabled = !allowed;
}

function renderYahtzeeDice(view) {
  if (!yahtzeeDice) {
    return;
  }
  yahtzeeDice.innerHTML = "";
  const dice = Array.isArray(view.dice) ? view.dice : [];
  const locked = Array.isArray(view.locked) ? view.locked : [];
  const canToggle = isYahtzeeActionAvailable("toggle_lock");
  for (let idx = 0; idx < 5; idx += 1) {
    const value = Number.isInteger(dice[idx]) ? dice[idx] : 0;
    const die = document.createElement("button");
    die.type = "button";
    die.className = "yahtzee-die";
    die.dataset.yahtzeeExplain = "die";
    die.dataset.yahtzeeDie = String(idx);
    if (locked[idx]) {
      die.classList.add("locked");
    }
    const valueEl = document.createElement("span");
    valueEl.className = "yahtzee-die-value";
    valueEl.textContent = value > 0 ? String(value) : "-";
    const lockEl = document.createElement("span");
    lockEl.className = "yahtzee-die-lock";
    lockEl.textContent = "LOCKED";
    die.appendChild(valueEl);
    die.appendChild(lockEl);
    const dieIndex = idx + 1;
    if (locked[idx]) {
      die.setAttribute("aria-pressed", "true");
      die.setAttribute("aria-label", `Die ${dieIndex} locked; will not roll.`);
      die.title = "Locked: will not roll.";
    } else {
      die.setAttribute("aria-pressed", "false");
      die.setAttribute("aria-label", `Die ${dieIndex} unlocked; click to lock.`);
      die.title = "Click to lock (will not roll).";
    }
    if (!canToggle) {
      die.classList.add("disabled");
      die.disabled = true;
    } else {
      die.addEventListener("click", () => {
        sendAction({ type: "toggle_lock", index: idx });
      });
    }
    yahtzeeDice.appendChild(die);
  }
}

function renderYahtzeeScorecards(view) {
  if (!yahtzeeScorecards) {
    return;
  }
  yahtzeeScorecards.innerHTML = "";
  const categories = Array.isArray(view.category_order) ? view.category_order : [];
  const possibleScores = view.possible_scores || {};
  const allowed = new Set(view.allowed_categories || []);
  const canScore = isYahtzeeActionAvailable("score");
  const isViewerTurn = view.you && view.you === view.current_player;

  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "yahtzee-scorecard player-card";
    if (player.player_id === view.current_player) {
      card.classList.add("current");
    }
    if (player.player_id === view.you) {
      card.classList.add("self");
    }

    const header = document.createElement("div");
    header.className = "yahtzee-scorecard-header";
    const nameEl = document.createElement("div");
    nameEl.className = "yahtzee-player-name";
    const nameLabel = player.name || player.player_id || "-";
    nameEl.textContent = player.player_id === view.you ? `${nameLabel} (You)` : nameLabel;
    nameEl.tabIndex = 0;
    nameEl.dataset.yahtzeeTip = nameEl.textContent;
    const totalEl = document.createElement("div");
    totalEl.className = "yahtzee-score-summary";
    const totalValue = Number.isInteger(player.total) ? player.total : 0;
    const upperTotal = Number.isInteger(player.upper_total) ? player.upper_total : 0;
    const lowerTotal = Number.isInteger(player.lower_total) ? player.lower_total : 0;
    const upperBonus = Number.isInteger(player.upper_bonus) ? player.upper_bonus : 0;
    const yahtzeeBonus = Number.isInteger(player.yahtzee_bonus) ? player.yahtzee_bonus : 0;
    const totalLabel = document.createElement("span");
    totalLabel.textContent = `Total: ${totalValue}`;
    totalLabel.tabIndex = 0;
    totalLabel.dataset.yahtzeeExplain = "total";
    totalEl.appendChild(totalLabel);
    const note = document.createElement("span");
    note.className = "yahtzee-score-note";
    [
      ["U", upperTotal, "upper", "Upper subtotal: Ones through Sixes."],
      ["B", upperBonus, "bonus", "Upper bonus: +35 when U reaches 63."],
      ["L", lowerTotal, "lower", "Lower subtotal: Three of a Kind through Chance."],
      ["Y", yahtzeeBonus, "yahtzee_bonus", "Extra Yahtzee bonuses: +100 each after a scored 50."],
    ].forEach(([label, value, key, tip], idx) => {
      if (idx) note.appendChild(document.createTextNode(" + "));
      const part = document.createElement("span");
      part.className = "yahtzee-score-part";
      part.textContent = `${label} ${value}`;
      part.tabIndex = 0;
      part.dataset.yahtzeeExplain = key;
      part.dataset.yahtzeeTip = `${label} — ${tip}`;
      note.appendChild(part);
    });
    totalEl.appendChild(note);
    header.appendChild(nameEl);
    header.appendChild(totalEl);
    card.appendChild(header);

    const rows = document.createElement("div");
    rows.className = "yahtzee-score-rows";
    categories.forEach((category, idx) => {
      const row = document.createElement("div");
      row.className = "yahtzee-score-row";
      row.dataset.yahtzeeExplain = "category";
      row.dataset.yahtzeeCategory = category;
      row.dataset.yahtzeePlayer = player.player_id;
      row.tabIndex = 0;
      if (idx < 6) {
        row.classList.add("upper");
      } else {
        row.classList.add("lower");
      }
      const label = document.createElement("div");
      label.textContent = formatYahtzeeCategoryLabel(view, category);
      const valueEl = document.createElement("div");
      valueEl.className = "yahtzee-score-value";

      const scoreSheet = player.score_sheet || {};
      const actual = scoreSheet[category];
      if (actual !== null && actual !== undefined) {
        row.classList.add("filled");
        valueEl.textContent = String(actual);
      } else {
        const isActivePlayer = player.player_id === view.current_player;
        const possible = isActivePlayer && allowed.has(category) ? possibleScores[category] : null;
        if (possible !== null && possible !== undefined) {
          valueEl.textContent = String(possible);
        } else {
          valueEl.textContent = "-";
        }
        const canSelect = isActivePlayer && isViewerTurn && canScore && allowed.has(category);
        if (canSelect) {
          row.classList.add("possible");
          row.setAttribute("role", "button");
          row.addEventListener("click", () => {
            sendAction({ type: "score", category });
          });
          row.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              row.click();
            }
          });
        }
      }

      row.appendChild(label);
      row.appendChild(valueEl);
      rows.appendChild(row);
    });

    card.appendChild(rows);
    yahtzeeScorecards.appendChild(card);
  });
}

function clearYahtzeeState() {
  yahtzeeGuide.reset();
  currentYahtzeeView = null;
  if (yahtzeePhaseLabel) {
    yahtzeePhaseLabel.textContent = "-";
  }
  if (yahtzeeRoundLabel) {
    yahtzeeRoundLabel.textContent = "-";
  }
  if (yahtzeeTurnLabel) {
    yahtzeeTurnLabel.textContent = "-";
  }
  if (yahtzeeRollsLabel) {
    yahtzeeRollsLabel.textContent = "-";
  }
  if (yahtzeeWinnerLabel) {
    yahtzeeWinnerLabel.textContent = "-";
  }
  if (yahtzeeDice) {
    yahtzeeDice.innerHTML = "";
  }
  if (yahtzeeScorecards) {
    yahtzeeScorecards.innerHTML = "";
  }
  if (yahtzeeJokerBody) {
    yahtzeeJokerBody.textContent = "-";
  }
  if (yahtzeeJokerNotice) {
    yahtzeeJokerNotice.classList.add("hidden");
  }
  updateYahtzeeActionButtons();
}

function renderYahtzeeGameState(data) {
  yahtzeeGuide.hideTip();
  const view = data.view;
  currentYahtzeeView = view;
  if (currentGameType !== "yahtzee") {
    currentGameType = "yahtzee";
    setGamePanelVisibility("yahtzee");
  }
  if (yahtzeePhaseLabel) {
    yahtzeePhaseLabel.textContent = view.phase || "-";
  }
  if (yahtzeeRoundLabel) {
    yahtzeeRoundLabel.textContent = view.current_round ?? "-";
  }
  if (yahtzeeTurnLabel) {
    yahtzeeTurnLabel.textContent = view.current_player
      ? findPlayerName(view, view.current_player)
      : "-";
  }
  if (yahtzeeRollsLabel) {
    const rolls = Number.isInteger(view.roll_count) ? view.roll_count : 0;
    yahtzeeRollsLabel.textContent = `${rolls}/3`;
  }
  if (yahtzeeWinnerLabel) {
    if (Array.isArray(view.winner) && view.winner.length) {
      yahtzeeWinnerLabel.textContent = view.winner.map((pid) => findPlayerName(view, pid)).join(", ");
    } else {
      yahtzeeWinnerLabel.textContent = "-";
    }
  }

  if (yahtzeeJokerNotice && yahtzeeJokerBody) {
    let jokerMessage = null;
    if (view.joker && view.current_player) {
      const mode = view.joker.mode;
      if (mode === "forced_upper") {
        const label = formatYahtzeeCategoryLabel(view, view.joker.forced_category);
        jokerMessage = `Must score ${label}.`;
      } else if (mode === "lower_choice") {
        jokerMessage = "Joker active: choose any lower category.";
      } else if (mode === "forced_zero") {
        jokerMessage = "Joker active: lower filled, must take 0 in upper.";
      }
    }
    if (jokerMessage) {
      yahtzeeJokerBody.textContent = jokerMessage;
      yahtzeeJokerNotice.classList.remove("hidden");
    } else {
      yahtzeeJokerBody.textContent = "-";
      yahtzeeJokerNotice.classList.add("hidden");
    }
  }

  renderYahtzeeDice(view);
  renderYahtzeeScorecards(view);
  updateYahtzeeConfigRow();
  logGameEvents(data);
  updateYahtzeeActionButtons();
}

if (yahtzeeRollBtn) {
  yahtzeeRollBtn.addEventListener("click", () => {
    sendAction({ type: "roll" });
  });
}

window.clearYahtzeeState = clearYahtzeeState;
window.renderYahtzeeGameState = renderYahtzeeGameState;

const yahtzeeGuide = (() => {
  const header = document.getElementById("yahtzeeHeaderActions");
  const helpButton = document.getElementById("yahtzeeHelpBtn");
  const explainButton = document.getElementById("yahtzeeExplainBtn");
  const notice = document.getElementById("yahtzeeExplainNotice");
  const dialog = document.getElementById("yahtzeeDialog");
  const dialogTitle = document.getElementById("yahtzeeDialogTitle");
  const dialogBody = document.getElementById("yahtzeeDialogBody");
  const closeButton = document.getElementById("yahtzeeDialogCloseBtn");
  const tooltip = document.getElementById("yahtzeeTooltip");
  const categories = {
    ones: ["Ones", "Add only the dice showing 1. For example, three 1s score 3."],
    twos: ["Twos", "Add only the dice showing 2. For example, three 2s score 6."],
    threes: ["Threes", "Add only the dice showing 3. For example, three 3s score 9."],
    fours: ["Fours", "Add only the dice showing 4. For example, three 4s score 12."],
    fives: ["Fives", "Add only the dice showing 5. For example, three 5s score 15."],
    sixes: ["Sixes", "Add only the dice showing 6. For example, three 6s score 18."],
    three_kind: ["Three of a Kind", "At least three dice must match. Score the sum of all five dice; otherwise score 0."],
    four_kind: ["Four of a Kind", "At least four dice must match. Score the sum of all five dice; otherwise score 0."],
    full_house: ["Full House", "A triple and a pair score 25. In this game, five matching dice also score 25. Otherwise score 0."],
    small_straight: ["Small Straight", "Any four consecutive values score 30: 1–2–3–4, 2–3–4–5, or 3–4–5–6. The fifth die may duplicate another. Otherwise score 0."],
    large_straight: ["Large Straight", "Five consecutive values (1–2–3–4–5 or 2–3–4–5–6) score 40. Otherwise score 0."],
    yahtzee: ["Yahtzee", "Five matching dice score 50; otherwise score 0. Only a 50 in this box unlocks future extra Yahtzee bonuses and Joker rules."],
    chance: ["Chance", "Score the sum of all five dice, with no matching or sequence requirement."],
  };
  const details = {
    phase: ["Phase", "Rolling: roll, keep dice, or score after any roll. Scoring: all three rolls have been used, so choose a scoring category. Game over: all scorecards are complete."],
    round: ["Round", "Each player takes one turn per round and fills one of 13 scoring categories. After 13 rounds, every category has been filled."],
    turn: ["Current Turn", "Only this player may roll, keep dice, or score. Scoring ends the turn immediately and passes play to the next player. (You) marks your own scorecard."],
    rolls: ["Rolls", "Rolls used out of a maximum of 3 this turn. The first roll uses all five dice; later rolls change only unlocked dice. You can score after any roll."],
    winner: ["Winner", "After everyone fills all 13 categories, the highest Total wins. Equal highest totals share the win. With one player, aim to improve your own score."],
    roll: ["Roll", "Roll all five dice at the start of your turn. Afterward, Roll rerolls only unlocked dice and uses one of your remaining rolls. You may score early. Roll is disabled before the game starts, outside your turn, after your third roll, or after the game ends."],
    die: ["Keep a die", "After your first or second roll, click a die to lock or unlock it. LOCKED dice keep their values on the next roll; unlocked dice are rerolled. Dice cannot be changed before the first roll, after the third roll, or outside your turn."],
    total: ["Total", "Total = U + B + L + Y: upper subtotal, upper bonus, lower subtotal, and extra Yahtzee bonuses. Only recorded scores count; green previews are not included."],
    upper: ["Upper subtotal (U)", "U adds the scores in Ones through Sixes, marked with blue borders. Reach 63 to earn a 35-point upper bonus (B). Three of each face across these six boxes would total 63."],
    bonus: ["Upper bonus (B)", "B is 35 once the upper subtotal (U) reaches at least 63; otherwise it is 0. It is awarded once and added automatically to Total."],
    lower: ["Lower subtotal (L)", "L adds the seven categories from Three of a Kind through Chance, marked with orange borders. It includes the first 50-point Yahtzee, but not extra Yahtzee bonuses (Y)."],
    yahtzee_bonus: ["Extra Yahtzee bonuses (Y)", "After recording 50 in Yahtzee, scoring another five-of-a-kind adds 100 to Y and uses the Joker rules. Each later qualifying turn can add another 100. A 0 in the Yahtzee box disables both this bonus and Joker rules for the rest of the game."],
    joker: ["Joker", "Joker applies only when the dice are all equal and your Yahtzee box already holds 50. Scoring these dice adds an extra 100, plus the points in your chosen category.", "If the matching upper category is empty, you must use it. Otherwise choose an empty lower category: Full House scores 25, Small Straight 30, Large Straight 40, and Three of a Kind, Four of a Kind, or Chance score the dice sum. If all lower categories are filled, choose an empty upper category for 0. Only permitted categories are selectable."],
    ai: ["Bot AI (🤖)", "The room setting applies to every bot for the next game. Choose it before starting; it cannot be changed during a game.", "Classic (original) keeps the old AI: random rerolls, then the highest immediate category score.", "Strategic (DP) uses dynamic programming to choose keeps, rerolls, and scoring categories for the highest expected final score. It considers future category opportunities, the upper bonus, extra Yahtzees, and Joker rules. It optimizes expected points, not the probability of beating a particular opponent. Neither AI controls human turns."],
  };
  let visible = false;
  let explaining = false;
  let suppressPointerClick = false;
  let consumedKey = null;
  let returnFocus = null;
  let tipAnchor = null;
  let tipTimer = null;

  function hideTip() {
    clearTimeout(tipTimer);
    tooltip.hidden = true;
    if (tipAnchor) tipAnchor.removeAttribute("aria-describedby");
    tipAnchor = null;
  }

  function showTip(anchor, temporary = false) {
    if (!visible || explaining || dialog.open || !anchor?.dataset.yahtzeeTip) return;
    hideTip();
    tipAnchor = anchor;
    anchor.setAttribute("aria-describedby", tooltip.id);
    tooltip.textContent = anchor.dataset.yahtzeeTip;
    tooltip.hidden = false;
    const box = anchor.getBoundingClientRect();
    const size = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(box.left, innerWidth - size.width - 8))}px`;
    const top = box.top - size.height - 8;
    tooltip.style.top = `${Math.max(8, Math.min(top >= 8 ? top : box.bottom + 8, innerHeight - size.height - 8))}px`;
    if (temporary) tipTimer = setTimeout(hideTip, 3000);
  }

  function setExplain(enabled) {
    explaining = enabled;
    document.body.classList.toggle("yahtzee-explain-mode", enabled);
    explainButton.setAttribute("aria-pressed", String(enabled));
    explainButton.title = enabled ? "Exit Explain (Esc)" : "Explain";
    notice.hidden = !enabled;
    hideTip();
  }

  function appendText(tag, text, parent = dialogBody) {
    const node = document.createElement(tag);
    node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function openDialog(title, paragraphs, focusTarget = document.activeElement) {
    setExplain(false);
    returnFocus = focusTarget;
    dialogTitle.textContent = title;
    dialogBody.replaceChildren();
    paragraphs.forEach(text => appendText("p", text));
    if (!dialog.open) dialog.showModal();
    dialogBody.scrollTop = 0;
    closeButton.focus({ preventScroll: true });
  }

  function openHelp() {
    openDialog("Help · Yahtzee", ["1–8 players · 5 dice · 13 categories. Fill your scorecard to earn the highest Total."]);
    appendText("h3", "Your turn");
    const steps = document.createElement("ol");
    ["Roll all five dice. Click dice to keep them: a dark border and LOCKED label mean they will not roll again. Click a locked die to release it.",
      "Reroll unlocked dice up to twice more (3 rolls total), or score after any roll.",
      "Click a green, empty category on your own scorecard to record the shown score and end your turn immediately. You may have to take 0. Every category is used once; recorded scores cannot be changed."]
      .forEach(text => appendText("li", text, steps));
    dialogBody.appendChild(steps);
    appendText("h3", "Scoring categories");
    appendText("p", "Blue borders mark the upper section: Ones through Sixes add only dice of the named value. For example, 2–2–2–5–6 scores 6 in Twos. Orange borders mark the lower section:");
    const scoring = document.createElement("dl");
    Object.entries(categories).slice(6).forEach(([, [title, text]]) => {
      appendText("dt", title, scoring);
      appendText("dd", text, scoring);
    });
    dialogBody.appendChild(scoring);
    appendText("h3", "Bonuses & Joker");
    [details.bonus[1], details.yahtzee_bonus[1], ...details.joker.slice(1)].forEach(text => appendText("p", text));
    appendText("h3", "Reading the scorecard & winning");
    appendText("p", `${details.total[1]} U = Ones through Sixes; L = the seven lower categories. B = the 35-point upper bonus; Y = extra 100-point Yahtzee bonuses.`);
    appendText("p", "Green cells preview available scores and can be selected on your turn. Gray cells are already filled. A dash (–) means there is no current scoring preview. (You) marks your card; Current Turn names the player who may act.");
    appendText("p", details.winner[1]);
    appendText("h3", details.ai[0]);
    details.ai.slice(1).forEach(text => appendText("p", text));
    appendText("h3", "Help (?) & Explain (🔎)");
    appendText("p", "Help opens these rules. Explain highlights items with a dashed outline: select one to read its meaning, including disabled controls. Other buttons do not act while Explain is on. Selecting an explanation or pressing Esc exits Explain; Esc also closes this dialog. Hover over U, B, L, or Y for a short hint, or tap on a phone to show it for 3 seconds.");
  }

  function explain(element) {
    const key = element.dataset.yahtzeeExplain;
    let title, paragraphs;
    if (key === "category") {
      const category = element.dataset.yahtzeeCategory;
      const rule = categories[category];
      if (!rule) return;
      title = rule[0];
      paragraphs = [rule[1]];
      const view = currentYahtzeeView;
      const player = view?.players?.find(item => item.player_id === element.dataset.yahtzeePlayer);
      const actual = player?.score_sheet?.[category];
      if (actual !== null && actual !== undefined) {
        paragraphs.push(`This category is already filled with ${actual} points and cannot be used again.`);
      } else if (element.classList.contains("possible")) {
        paragraphs.push(`This cell currently offers ${view.possible_scores[category]} points. Selecting it outside Explain records that score permanently and ends your turn.`);
      } else {
        paragraphs.push("This category is empty. It is selectable only on your own turn after rolling, and only if permitted by any active Joker rule.");
      }
      if (view?.joker && player?.player_id === view.current_player && actual == null) {
        paragraphs.push(...details.joker.slice(1));
      }
    } else {
      const rule = details[key];
      if (!rule) return;
      title = rule[0];
      paragraphs = rule.slice(1);
      if (key === "die") {
        const index = Number(element.dataset.yahtzeeDie);
        const value = currentYahtzeeView?.dice?.[index];
        title = `Die ${index + 1}`;
        if (value > 0) paragraphs.push(`This die shows ${value} and is ${currentYahtzeeView.locked[index] ? "locked" : "unlocked"}.`);
      }
    }
    openDialog(`Explain · ${title}`, paragraphs, element);
  }

  const exempt = target => target.closest("#yahtzeeHelpBtn, #yahtzeeExplainBtn, #yahtzeeDialog");
  function explainTarget(event) {
    const control = event.target.closest("button, input, select, a, [role='button']");
    let target = control || event.target.closest("[data-yahtzee-explain]");
    if (event.type === "pointerdown") {
      // Disabled controls may not be the event target; test their visible bounds as well.
      const disabled = [...document.querySelectorAll(":disabled[data-yahtzee-explain]")].find(item => {
        if (!item.getClientRects().length) return false;
        const rect = item.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      });
      if (disabled) target = disabled;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (target?.dataset.yahtzeeExplain) {
      // Consume the rest of this gesture so opening a modal cannot click through.
      if (event.type === "pointerdown") suppressPointerClick = true;
      explain(target);
    }
  }

  document.addEventListener("pointerdown", event => {
    suppressPointerClick = false;
    if (explaining && !exempt(event.target)) explainTarget(event);
  }, true);
  document.addEventListener("click", event => {
    if (suppressPointerClick && event.detail > 0) {
      suppressPointerClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!visible) return;
    if (explaining && !exempt(event.target)) {
      explainTarget(event);
      return;
    }
    const anchor = event.target.closest("[data-yahtzee-tip]");
    if (anchor) showTip(anchor, true);
    else hideTip();
  }, true);
  document.addEventListener("keydown", event => {
    if (!visible) return;
    if (event.key === "Escape") {
      setExplain(false);
      return;
    }
    if (explaining && !exempt(event.target) && event.key !== "Tab" && !["Shift", "Control", "Alt", "Meta"].includes(event.key)) {
      if (event.key === "Enter" || event.key === " ") {
        consumedKey = event.key;
        explainTarget(event);
      } else if (event.target.closest("input, select, textarea, button, [role='button']")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    } else if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-yahtzee-tip]")) {
      event.preventDefault();
      showTip(event.target, true);
    }
  }, true);
  document.addEventListener("keyup", event => {
    if (event.key !== consumedKey) return;
    consumedKey = null;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  document.addEventListener("pointerover", event => {
    if (event.pointerType === "mouse") showTip(event.target.closest("[data-yahtzee-tip]"));
  });
  document.addEventListener("pointerout", event => {
    if (event.pointerType === "mouse" && tipAnchor && !tipAnchor.contains(event.relatedTarget)) hideTip();
  });
  document.addEventListener("focusin", event => showTip(event.target.closest("[data-yahtzee-tip]")));
  document.addEventListener("focusout", hideTip);
  document.addEventListener("scroll", hideTip, true);
  window.addEventListener("resize", hideTip);
  window.addEventListener("blur", hideTip);
  helpButton.addEventListener("click", openHelp);
  explainButton.addEventListener("click", () => setExplain(!explaining));
  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener("close", () => {
    if (!visible) return;
    const target = returnFocus?.isConnected && returnFocus.getClientRects().length && !returnFocus.disabled ? returnFocus : helpButton;
    target.focus({ preventScroll: true });
  });
  function reset() {
    setExplain(false);
    suppressPointerClick = false;
    consumedKey = null;
    returnFocus = null;
    if (dialog.open) dialog.close();
  }
  window.showYahtzeeHeaderActions = show => {
    visible = show;
    header.style.display = show ? "flex" : "none";
    if (!show) reset();
  };
  return { reset, hideTip };
})();

yahtzeeBotStrategySelect.addEventListener("change", updateYahtzeeConfigHint);
// Assets can load after the room's first Socket.IO state has already arrived.
updateYahtzeeConfigRow();
updateYahtzeeActionButtons();
window.showYahtzeeHeaderActions(Boolean(currentRoomState && currentGameType === "yahtzee"));
