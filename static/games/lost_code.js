let currentLostCodeView = null;
let lostCodeSelectedDieIndex = 0;
let lostCodeSelectedWheelId = null;
let lostCodeSelectedRangeCenter = null;
let lostCodeShortcutGuesses = new Set();

const lostCodeConfigBox = document.getElementById("lostCodeConfigBox");
const lostCodeModeSelect = document.getElementById("lostCodeModeSelect");
const lostCodeShortcutToggle = document.getElementById("lostCodeShortcutToggle");
const lostCodeCurseToggle = document.getElementById("lostCodeCurseToggle");

const lostCodeHeaderActions = document.getElementById("lostCodeHeaderActions");
const lostCodeHelpBtn = document.getElementById("lostCodeHelpBtn");
const lostCodeExplainBtn = document.getElementById("lostCodeExplainBtn");
const lostCodeHelpModal = document.getElementById("lostCodeHelpModal");
const lostCodeHelpModalCloseBtn = document.getElementById("lostCodeHelpModalCloseBtn");
const lostCodeHelpContent = document.getElementById("lostCodeHelpContent");
const lostCodeExplainModal = document.getElementById("lostCodeExplainModal");
const lostCodeExplainModalCloseBtn = document.getElementById("lostCodeExplainModalCloseBtn");
const lostCodeExplainContent = document.getElementById("lostCodeExplainContent");

const lostCodePhaseLabel = document.getElementById("lostCodePhase");
const lostCodeRoundLabel = document.getElementById("lostCodeRound");
const lostCodeTurnLabel = document.getElementById("lostCodeTurn");
const lostCodeModeLabel = document.getElementById("lostCodeModeLabel");
const lostCodeDiceEl = document.getElementById("lostCodeDice");
const lostCodePlayersEl = document.getElementById("lostCodePlayers");
const lostCodeLogsEl = document.getElementById("lostCodeLogs");
const lostCodeHintEl = document.getElementById("lostCodeHint");
const lostCodeControlsEl = document.getElementById("lostCodeControls");
const lostCodeTokenEl = document.getElementById("lostCodeTokenStatus");
const lostCodeGuessesEl = document.getElementById("lostCodeGuesses");

const LOST_CODE_HELP_HTML = `
  <h3>Goal</h3>
  <p>Read clues and score the most points by predicting your hidden code.</p>

  <h3>Round Flow</h3>
  <ol>
    <li>Roll 3 symbol dice.</li>
    <li>Roller may modify one die (Intro mode must replace all red bears).</li>
    <li>From trailing to leading, each player picks one wheel and submits a range.</li>
    <li>Correct range gains points; wrong players replace one stone of a symbol that still has pile cards.</li>
  </ol>

  <h3>Visibility</h3>
  <ul>
    <li>You cannot see your own current stone values.</li>
    <li>You can see other players and neutral logs.</li>
    <li>Discarded stones are public.</li>
  </ul>
`;

const LOST_CODE_BUTTON_EXPLANATIONS = {
  dice_pick: {
    name: "Pick Die",
    description: "Choose which die slot will be modified.",
    cost: "No cost",
    costType: "free",
  },
  roll_dice: {
    name: "Roll Dice",
    description: "Roll 3 symbol dice to start the round.",
    cost: "Start round",
    costType: "ap",
  },
  modify_symbol: {
    name: "Modify Die Symbol",
    description: "Change the selected die into this symbol.",
    cost: "1 die change",
    costType: "ap",
  },
  confirm_dice: {
    name: "Confirm Dice",
    description: "Lock current dice and move to wheel selection.",
    cost: "Confirm",
    costType: "end",
  },
  shortcut_number_toggle: {
    name: "Toggle Shortcut Number",
    description: "Select or unselect a number for Deadly Shortcut commit.",
    cost: "No cost",
    costType: "free",
  },
  shortcut_pass: {
    name: "Pass Shortcut",
    description: "Decline the shortcut token offer for this symbol.",
    cost: "Pass",
    costType: "end",
  },
  shortcut_take: {
    name: "Take Shortcut Token",
    description: "Take token and lock in 1-3 numbers for this symbol.",
    cost: "Commit now",
    costType: "ap",
  },
  wheel_submit: {
    name: "Submit Range Guess",
    description: "Submit contiguous range matching selected wheel width.",
    cost: "Submit",
    costType: "end",
  },
  exchange_symbol: {
    name: "Replace Symbol Stone",
    description: "Discard current stone and draw same-symbol replacement.",
    cost: "Forced after wrong guess",
    costType: "penalty",
  },
  exchange_skip: {
    name: "Skip Exchange",
    description: "Only legal when no symbol piles can provide replacement.",
    cost: "No move",
    costType: "end",
  },
  final_submit: {
    name: "Submit Final Guesses",
    description: "Submit final number guesses for unresolved symbols.",
    cost: "Finalize",
    costType: "end",
  },
};

let lostCodeExplainMode = false;

function lostCodeWheelMeaning(wheelId) {
  const map = {
    W1: { windowSize: 1, vp: 5, summary: "Single exact value. Highest reward, highest risk." },
    W2: { windowSize: 2, vp: 4, summary: "2-number range. Very sharp guess with strong reward." },
    W3: { windowSize: 3, vp: 3, summary: "3-number range. Balanced precision and reward." },
    W4: { windowSize: 4, vp: 3, summary: "4-number range. Slightly safer than W3, same VP." },
    W5: { windowSize: 5, vp: 2, summary: "5-number range. Stable medium-safety option." },
    W6: { windowSize: 7, vp: 2, summary: "7-number range. Broad safety net, still 2 VP." },
    W7: { windowSize: 10, vp: 1, summary: "10-number range. Safest and widest, lowest VP." },
  };
  return map[wheelId] || null;
}

function lostCodeCan(action) {
  return Array.isArray(currentLostCodeView && currentLostCodeView.legal_actions)
    && currentLostCodeView.legal_actions.includes(action);
}

function lostCodeFindPlayerName(playerId) {
  if (!currentLostCodeView || !Array.isArray(currentLostCodeView.players)) {
    return playerId || "-";
  }
  const player = currentLostCodeView.players.find((item) => item.player_id === playerId);
  return player && player.name ? player.name : (playerId || "-");
}

function lostCodeSymbolLabel(symbol) {
  const map = {
    bird_blue: "🐦🔵",
    jaguar_yellow: "🐆🟡",
    chameleon_purple: "🦎🟣",
    snake_green: "🐍🟢",
    human_pink: "🧍🩷",
    bear_red: "🐻🔴",
  };
  return map[symbol] || symbol || "-";
}

function updateLostCodeExplainModeClasses(enabled) {
  const elements = document.querySelectorAll("[data-lost-code-explain-key]");
  elements.forEach((el) => {
    el.classList.toggle("has-explanation", enabled);
  });
}

function markLostCodeExplainable(button, explainKey) {
  if (!button || !explainKey) return;
  button.dataset.lostCodeExplainKey = explainKey;
  if (lostCodeExplainMode) {
    button.classList.add("has-explanation");
  }
}

function findLostCodeExplainButtonAtPoint(x, y) {
  const elements = document.querySelectorAll("[data-lost-code-explain-key]");
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return el;
    }
  }
  return null;
}

function showLostCodeButtonExplanation(explainKey) {
  if (typeof explainKey === "string" && explainKey.startsWith("wheel_pick:")) {
    const wheelId = explainKey.split(":")[1] || "";
    const meaning = lostCodeWheelMeaning(wheelId);
    if (meaning && lostCodeExplainModal && lostCodeExplainContent) {
      lostCodeExplainContent.innerHTML = `
        <div class="project-l-explain-card">
          <h3>${wheelId} · Wheel Meaning</h3>
          <p>${meaning.summary}</p>
          <ul>
            <li><strong>Window size:</strong> ${meaning.windowSize} (you must submit exactly ${meaning.windowSize} contiguous numbers)</li>
            <li><strong>Reward:</strong> +${meaning.vp} VP if your actual sum falls in the chosen range</li>
            <li><strong>Trade-off:</strong> narrower window = harder hit, higher reward</li>
          </ul>
        </div>
      `;
      setModalVisible(lostCodeExplainModal, true);
      return;
    }
  }
  const entry = LOST_CODE_BUTTON_EXPLANATIONS[explainKey];
  if (!entry || !lostCodeExplainModal || !lostCodeExplainContent) return;
  let costClass = "free";
  if (entry.costType === "ap") costClass = "ap";
  else if (entry.costType === "penalty") costClass = "penalty";
  else if (entry.costType === "end") costClass = "end";
  const phaseText = currentLostCodeView && currentLostCodeView.phase_detail
    ? currentLostCodeView.phase_detail
    : "-";
  lostCodeExplainContent.innerHTML = `
    <div class="project-l-explain-card">
      <h3>${entry.name}</h3>
      <p>${entry.description}</p>
      <div class="project-l-explain-cost ${costClass}">${entry.cost}</div>
      <div class="hint">Current phase: ${phaseText}</div>
    </div>
  `;
  setModalVisible(lostCodeExplainModal, true);
}

function toggleLostCodeExplainMode() {
  lostCodeExplainMode = !lostCodeExplainMode;
  document.body.classList.toggle("lost-code-explain-mode", lostCodeExplainMode);
  updateLostCodeExplainModeClasses(lostCodeExplainMode);
  if (lostCodeExplainBtn) {
    lostCodeExplainBtn.classList.toggle("active", lostCodeExplainMode);
  }
}

function exitLostCodeExplainMode() {
  if (!lostCodeExplainMode) return;
  lostCodeExplainMode = false;
  document.body.classList.remove("lost-code-explain-mode");
  updateLostCodeExplainModeClasses(false);
  if (lostCodeExplainBtn) {
    lostCodeExplainBtn.classList.remove("active");
  }
}

function clearLostCodeState() {
  exitLostCodeExplainMode();
  currentLostCodeView = null;
  lostCodeSelectedDieIndex = 0;
  lostCodeSelectedWheelId = null;
  lostCodeSelectedRangeCenter = null;
  lostCodeShortcutGuesses = new Set();
  if (lostCodePhaseLabel) lostCodePhaseLabel.textContent = "-";
  if (lostCodeRoundLabel) lostCodeRoundLabel.textContent = "-";
  if (lostCodeTurnLabel) lostCodeTurnLabel.textContent = "-";
  if (lostCodeModeLabel) lostCodeModeLabel.textContent = "-";
  if (lostCodeDiceEl) lostCodeDiceEl.innerHTML = "";
  if (lostCodePlayersEl) lostCodePlayersEl.innerHTML = "";
  if (lostCodeLogsEl) lostCodeLogsEl.innerHTML = "";
  if (lostCodeHintEl) lostCodeHintEl.textContent = "-";
  if (lostCodeControlsEl) lostCodeControlsEl.innerHTML = "";
  if (lostCodeTokenEl) lostCodeTokenEl.innerHTML = "";
  if (lostCodeGuessesEl) lostCodeGuessesEl.innerHTML = "";
  if (lostCodeHelpModal) setModalVisible(lostCodeHelpModal, false);
  if (lostCodeExplainModal) setModalVisible(lostCodeExplainModal, false);
}

function updateLostCodeConfigRow() {
  const showRow = currentRoomState && currentGameType === "lost_code" && currentRoomState.status === "lobby";
  if (lostCodeConfigBox) {
    lostCodeConfigBox.classList.toggle("hidden", !showRow);
    lostCodeConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (showRow) {
    renderLostCodeRoomState(currentRoomState);
  }
}

function showLostCodeHeaderActions(show) {
  if (!lostCodeHeaderActions) return;
  lostCodeHeaderActions.style.display = show ? "flex" : "none";
  if (!show) {
    exitLostCodeExplainMode();
    if (lostCodeHelpModal) setModalVisible(lostCodeHelpModal, false);
    if (lostCodeExplainModal) setModalVisible(lostCodeExplainModal, false);
  }
}

function renderLostCodeRoomState(state) {
  if (!state || currentGameType !== "lost_code" || state.status !== "lobby") {
    return;
  }
  const mode = lostCodeModeSelect ? (lostCodeModeSelect.value || "standard") : "standard";
  const withShortcut = !!(lostCodeShortcutToggle && lostCodeShortcutToggle.checked);
  const withCurse = !!(lostCodeCurseToggle && lostCodeCurseToggle.checked);
  if (lostCodePhaseLabel) lostCodePhaseLabel.textContent = "lobby";
  if (lostCodeRoundLabel) lostCodeRoundLabel.textContent = "-";
  if (lostCodeTurnLabel) lostCodeTurnLabel.textContent = "Not started";
  if (lostCodeModeLabel) lostCodeModeLabel.textContent = mode;
  if (lostCodeHintEl) {
    lostCodeHintEl.textContent = `Config: ${mode}${withShortcut ? " + Deadly Shortcut" : ""}${withCurse ? " + Curse of the Temple" : ""}.`;
  }
  if (lostCodeControlsEl) {
    lostCodeControlsEl.innerHTML = "";
    const note = document.createElement("div");
    note.className = "hint";
    note.textContent = "Set mode/options in Room Controls, ready up, then Start Game.";
    lostCodeControlsEl.appendChild(note);
  }
}

function renderLostCodeDice(view) {
  if (!lostCodeDiceEl) return;
  lostCodeDiceEl.innerHTML = "";
  const dice = Array.isArray(view.dice_symbols) ? view.dice_symbols : [];
  dice.forEach((symbol, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lost-code-chip";
    btn.textContent = `${index + 1}. ${lostCodeSymbolLabel(symbol)}`;
    markLostCodeExplainable(btn, "dice_pick");
    if (index === lostCodeSelectedDieIndex) {
      btn.classList.add("selected");
    }
    if (lostCodeCan("modify_die")) {
      btn.addEventListener("click", () => {
        lostCodeSelectedDieIndex = index;
        renderLostCodeDice(view);
      });
    } else {
      btn.disabled = true;
    }
    lostCodeDiceEl.appendChild(btn);
  });
}

function renderLostCodePlayers(view) {
  if (!lostCodePlayersEl) return;
  lostCodePlayersEl.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "lost-code-player-row";
    const role = [];
    if (player.you) role.push("You");
    if (player.player_id === view.cursed_player_id) role.push("🗿 Cursed");
    const left = document.createElement("div");
    left.textContent = `${player.name || player.player_id}${role.length ? ` (${role.join(" · ")})` : ""}`;
    const right = document.createElement("div");
    right.textContent = `🏁 ${player.score}`;
    row.appendChild(left);
    row.appendChild(right);
    lostCodePlayersEl.appendChild(row);
  });
}

function renderLostCodeLogs(view) {
  if (!lostCodeLogsEl) return;
  lostCodeLogsEl.innerHTML = "";
  const logs = Array.isArray(view.logs) ? view.logs : [];
  logs.forEach((log) => {
    const card = document.createElement("section");
    card.className = "lost-code-log-card";
    const title = document.createElement("div");
    title.className = "lost-code-log-title";
    title.textContent = log.owner_player_id
      ? `${lostCodeFindPlayerName(log.owner_player_id)} Log`
      : "Neutral Log";
    card.appendChild(title);
    const slots = document.createElement("div");
    slots.className = "lost-code-slot-grid";
    (log.slots || []).forEach((slot) => {
      const item = document.createElement("div");
      item.className = "lost-code-slot";
      const symbol = document.createElement("div");
      symbol.textContent = lostCodeSymbolLabel(slot.symbol);
      const value = document.createElement("div");
      value.className = "lost-code-slot-value";
      value.textContent = slot.hidden_from_viewer ? "❓" : String(slot.value);
      item.appendChild(symbol);
      item.appendChild(value);
      slots.appendChild(item);
    });
    card.appendChild(slots);
    lostCodeLogsEl.appendChild(card);
  });
}

function renderLostCodeTokenStatus(view) {
  if (!lostCodeTokenEl) return;
  lostCodeTokenEl.innerHTML = "";
  const tokens = view.deadly_shortcut_tokens || {};
  const symbols = Array.isArray(view.active_symbols) ? view.active_symbols : [];
  symbols.forEach((symbol) => {
    const token = tokens[symbol] || {};
    const line = document.createElement("div");
    line.className = "lost-code-token-line";
    let text = `${lostCodeSymbolLabel(symbol)}: `;
    if (token.removed) {
      text += "removed";
    } else if (token.taken_by) {
      text += `taken by ${lostCodeFindPlayerName(token.taken_by)}`;
    } else {
      text += "available";
    }
    line.textContent = text;
    lostCodeTokenEl.appendChild(line);
  });
}

function renderLostCodeGuesses(view) {
  if (!lostCodeGuessesEl) return;
  lostCodeGuessesEl.innerHTML = "";
  const guesses = view.guesses || {};
  const players = Array.isArray(view.players) ? view.players : [];
  players.forEach((player) => {
    const guess = guesses[player.player_id];
    if (!guess) return;
    const row = document.createElement("div");
    row.className = "lost-code-guess-line";
    const wheel = guess.wheel_id || "-";
    const range = guess.min !== undefined && guess.max !== undefined ? `[${guess.min}-${guess.max}]` : "-";
    const result = guess.result || "pending";
    row.textContent = `${player.name || player.player_id}: ${wheel} ${range} -> ${result}`;
    lostCodeGuessesEl.appendChild(row);
  });
}

function renderLostCodeModifyControls(view, host) {
  const symbolWrap = document.createElement("div");
  symbolWrap.className = "lost-code-chip-wrap";
  (view.active_symbols || []).forEach((symbol) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lost-code-chip";
    btn.textContent = lostCodeSymbolLabel(symbol);
    markLostCodeExplainable(btn, "modify_symbol");
    btn.addEventListener("click", () => {
      sendAction({
        type: "modify_die",
        die_index: lostCodeSelectedDieIndex,
        symbol,
      });
    });
    symbolWrap.appendChild(btn);
  });
  host.appendChild(symbolWrap);
  if (lostCodeCan("confirm_dice")) {
    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.textContent = "Confirm Dice";
    markLostCodeExplainable(confirmBtn, "confirm_dice");
    confirmBtn.addEventListener("click", () => sendAction({ type: "confirm_dice" }));
    host.appendChild(confirmBtn);
  }
}

function renderLostCodeShortcutControls(view, host) {
  const symbol = view.shortcut_offer && view.shortcut_offer.symbol
    ? view.shortcut_offer.symbol
    : "?";
  const title = document.createElement("div");
  title.className = "hint";
  title.textContent = `Shortcut offer: ${lostCodeSymbolLabel(symbol)}. Choose 1-3 numbers, or pass.`;
  host.appendChild(title);

  const numbers = document.createElement("div");
  numbers.className = "lost-code-chip-wrap";
  for (let value = 0; value <= Number(view.max_symbol_value || 7); value += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lost-code-chip";
    btn.textContent = String(value);
    markLostCodeExplainable(btn, "shortcut_number_toggle");
    if (lostCodeShortcutGuesses.has(value)) btn.classList.add("selected");
    btn.addEventListener("click", () => {
      if (lostCodeShortcutGuesses.has(value)) {
        lostCodeShortcutGuesses.delete(value);
      } else if (lostCodeShortcutGuesses.size < 3) {
        lostCodeShortcutGuesses.add(value);
      }
      renderLostCodeControls(view);
    });
    numbers.appendChild(btn);
  }
  host.appendChild(numbers);

  const actionRow = document.createElement("div");
  actionRow.className = "row actions";
  const passBtn = document.createElement("button");
  passBtn.type = "button";
  passBtn.textContent = "Pass";
  markLostCodeExplainable(passBtn, "shortcut_pass");
  passBtn.addEventListener("click", () => sendAction({ type: "pass_shortcut" }));
  actionRow.appendChild(passBtn);

  const takeBtn = document.createElement("button");
  takeBtn.type = "button";
  takeBtn.textContent = "Take Token";
  markLostCodeExplainable(takeBtn, "shortcut_take");
  takeBtn.disabled = lostCodeShortcutGuesses.size < 1 || lostCodeShortcutGuesses.size > 3;
  takeBtn.addEventListener("click", () => {
    const guesses = Array.from(lostCodeShortcutGuesses).sort((a, b) => a - b);
    sendAction({ type: "take_shortcut", guesses });
  });
  actionRow.appendChild(takeBtn);
  host.appendChild(actionRow);
}

function renderLostCodeWheelControls(view, host) {
  const wheelRow = document.createElement("div");
  wheelRow.className = "lost-code-chip-wrap";
  const wheels = Array.isArray(view.wheels) ? view.wheels : [];
  const available = new Set(view.available_wheel_ids || []);
  wheels.forEach((wheel) => {
    if (!available.has(wheel.id)) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lost-code-chip";
    if (wheel.id === lostCodeSelectedWheelId) btn.classList.add("selected");
    btn.textContent = `${wheel.id} (${wheel.window_size} / +${wheel.victory_points})`;
    markLostCodeExplainable(btn, `wheel_pick:${wheel.id}`);
    btn.addEventListener("click", () => {
      lostCodeSelectedWheelId = wheel.id;
      lostCodeSelectedRangeCenter = null;
      renderLostCodeControls(view);
    });
    wheelRow.appendChild(btn);
  });
  host.appendChild(wheelRow);

  const wheel = wheels.find((item) => item.id === lostCodeSelectedWheelId);
  const maxSum = Number(view.max_sum || 21);
  if (!wheel) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "Select a wheel first.";
    host.appendChild(hint);
    return;
  }

  const windowSize = Number(wheel.window_size || 1);
  const leftSpan = Math.floor((windowSize - 1) / 2);
  const rightSpan = windowSize - 1 - leftSpan;
  const minCenter = leftSpan;
  const maxCenter = maxSum - rightSpan;
  const defaultCenter = minCenter <= maxCenter ? minCenter : 0;
  if (!Number.isInteger(lostCodeSelectedRangeCenter) || lostCodeSelectedRangeCenter < minCenter || lostCodeSelectedRangeCenter > maxCenter) {
    lostCodeSelectedRangeCenter = defaultCenter;
  }

  const strip = document.createElement("div");
  strip.className = "lost-code-range-strip";
  for (let value = 0; value <= maxSum; value += 1) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "lost-code-range-cell";
    cell.textContent = String(value);
    const selectable = value >= minCenter && value <= maxCenter;
    if (!selectable) {
      cell.disabled = true;
      cell.classList.add("edge-disabled");
    } else {
      cell.addEventListener("click", () => {
        lostCodeSelectedRangeCenter = value;
        renderLostCodeControls(view);
      });
    }
    if (value === lostCodeSelectedRangeCenter) {
      cell.classList.add("center");
    }
    const rangeMin = Number(lostCodeSelectedRangeCenter) - leftSpan;
    const rangeMax = Number(lostCodeSelectedRangeCenter) + rightSpan;
    if (value >= rangeMin && value <= rangeMax) {
      cell.classList.add("in-range");
    }
    strip.appendChild(cell);
  }
  host.appendChild(strip);

  const preview = document.createElement("div");
  preview.className = "hint";
  const min = Number(lostCodeSelectedRangeCenter) - leftSpan;
  const max = Number(lostCodeSelectedRangeCenter) + rightSpan;
  preview.textContent = `Range preview: [${min}-${max}] (center ${lostCodeSelectedRangeCenter}, width ${windowSize})`;
  host.appendChild(preview);

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.textContent = "Submit Guess";
  markLostCodeExplainable(submitBtn, "wheel_submit");
  submitBtn.disabled = !(Number.isInteger(lostCodeSelectedRangeCenter) && minCenter <= maxCenter);
  submitBtn.addEventListener("click", () => {
    if (!wheel || !Number.isInteger(lostCodeSelectedRangeCenter)) return;
    const submitMin = Number(lostCodeSelectedRangeCenter) - leftSpan;
    const submitMax = Number(lostCodeSelectedRangeCenter) + rightSpan;
    sendAction({ type: "submit_guess", wheel_id: wheel.id, min: submitMin, max: submitMax });
  });
  host.appendChild(submitBtn);
}

function renderLostCodeExchangeControls(view, host) {
  const counts = view.draw_pile_counts || {};
  const row = document.createElement("div");
  row.className = "lost-code-chip-wrap";
  (view.active_symbols || []).forEach((symbol) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lost-code-chip";
    btn.textContent = `${lostCodeSymbolLabel(symbol)} (${counts[symbol] || 0})`;
    markLostCodeExplainable(btn, "exchange_symbol");
    btn.disabled = !Number(counts[symbol] || 0);
    btn.addEventListener("click", () => sendAction({ type: "replace_stone", symbol }));
    row.appendChild(btn);
  });
  host.appendChild(row);
  if (lostCodeCan("skip_exchange")) {
    const skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.textContent = "Skip Exchange";
    markLostCodeExplainable(skipBtn, "exchange_skip");
    skipBtn.addEventListener("click", () => sendAction({ type: "skip_exchange" }));
    host.appendChild(skipBtn);
  }
}

function renderLostCodeFinalControls(view, host) {
  const self = Array.isArray(view.players) ? view.players.find((player) => player.you) : null;
  const shortcutCommits = (self && self.shortcut_commits) ? self.shortcut_commits : {};
  const form = document.createElement("div");
  form.className = "lost-code-final-form";

  const selectors = {};
  (view.active_symbols || []).forEach((symbol) => {
    if (shortcutCommits[symbol]) {
      const fixed = document.createElement("div");
      fixed.className = "lost-code-final-row";
      fixed.textContent = `${lostCodeSymbolLabel(symbol)} locked by shortcut: ${shortcutCommits[symbol].join(", ")}`;
      form.appendChild(fixed);
      return;
    }
    const row = document.createElement("div");
    row.className = "lost-code-final-row";
    const label = document.createElement("div");
    label.textContent = lostCodeSymbolLabel(symbol);
    row.appendChild(label);
    selectors[symbol] = [];
    for (let idx = 0; idx < 3; idx += 1) {
      const select = document.createElement("select");
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "-";
      select.appendChild(blank);
      for (let value = 0; value <= Number(view.max_symbol_value || 7); value += 1) {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = String(value);
        select.appendChild(option);
      }
      selectors[symbol].push(select);
      row.appendChild(select);
    }
    form.appendChild(row);
  });
  host.appendChild(form);

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.textContent = "Submit Final Guesses";
  markLostCodeExplainable(submitBtn, "final_submit");
  submitBtn.addEventListener("click", () => {
    const guesses = {};
    Object.entries(selectors).forEach(([symbol, list]) => {
      const picked = list
        .map((select) => select.value)
        .filter((value) => value !== "")
        .map((value) => Number.parseInt(value, 10))
        .filter((value, index, arr) => Number.isInteger(value) && arr.indexOf(value) === index);
      guesses[symbol] = picked;
    });
    sendAction({ type: "submit_final_guesses", guesses });
  });
  host.appendChild(submitBtn);
}

function renderLostCodeControls(view) {
  if (!lostCodeControlsEl) return;
  lostCodeControlsEl.innerHTML = "";

  if (lostCodeCan("roll_dice")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Roll Dice";
    markLostCodeExplainable(btn, "roll_dice");
    btn.addEventListener("click", () => sendAction({ type: "roll_dice" }));
    lostCodeControlsEl.appendChild(btn);
    return;
  }
  if (lostCodeCan("pass_shortcut") || lostCodeCan("take_shortcut")) {
    renderLostCodeShortcutControls(view, lostCodeControlsEl);
    return;
  }
  if (lostCodeCan("modify_die") || lostCodeCan("confirm_dice")) {
    renderLostCodeModifyControls(view, lostCodeControlsEl);
    return;
  }
  if (lostCodeCan("submit_guess")) {
    if (!lostCodeSelectedWheelId) {
      const available = Array.isArray(view.available_wheel_ids) ? view.available_wheel_ids : [];
      lostCodeSelectedWheelId = available.length ? available[0] : null;
      lostCodeSelectedRangeCenter = null;
    }
    renderLostCodeWheelControls(view, lostCodeControlsEl);
    return;
  }
  if (lostCodeCan("replace_stone") || lostCodeCan("skip_exchange")) {
    renderLostCodeExchangeControls(view, lostCodeControlsEl);
    return;
  }
  if (lostCodeCan("submit_final_guesses")) {
    renderLostCodeFinalControls(view, lostCodeControlsEl);
    return;
  }

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = view.phase_detail || "Waiting for other players.";
  lostCodeControlsEl.appendChild(hint);
}

function openLostCodeHelpModal() {
  if (!lostCodeHelpModal || !lostCodeHelpContent) return;
  lostCodeHelpContent.innerHTML = LOST_CODE_HELP_HTML;
  setModalVisible(lostCodeHelpModal, true);
}

function renderLostCodeGameState(data) {
  const view = data && data.view ? data.view : null;
  currentLostCodeView = view;
  if (!view) {
    clearLostCodeState();
    return;
  }
  if (currentGameType !== "lost_code") {
    currentGameType = "lost_code";
    setGamePanelVisibility("lost_code");
  }
  if (lostCodePhaseLabel) lostCodePhaseLabel.textContent = view.phase || "-";
  if (lostCodeRoundLabel) lostCodeRoundLabel.textContent = `${view.round || "-"} / ${view.max_rounds || "-"}`;
  if (lostCodeTurnLabel) lostCodeTurnLabel.textContent = view.current_actor_name || "-";
  if (lostCodeModeLabel) lostCodeModeLabel.textContent = view.mode || "-";
  if (lostCodeHintEl) lostCodeHintEl.textContent = view.phase_detail || "-";

  renderLostCodeDice(view);
  renderLostCodePlayers(view);
  renderLostCodeLogs(view);
  renderLostCodeTokenStatus(view);
  renderLostCodeGuesses(view);
  renderLostCodeControls(view);
  logGameEvents(data);
}

if (lostCodeHelpBtn) {
  lostCodeHelpBtn.addEventListener("click", openLostCodeHelpModal);
}
if (lostCodeExplainBtn) {
  lostCodeExplainBtn.addEventListener("click", () => {
    toggleLostCodeExplainMode();
  });
}
if (lostCodeHelpModalCloseBtn) {
  lostCodeHelpModalCloseBtn.addEventListener("click", () => {
    if (lostCodeHelpModal) setModalVisible(lostCodeHelpModal, false);
  });
}
if (lostCodeExplainModalCloseBtn) {
  lostCodeExplainModalCloseBtn.addEventListener("click", () => {
    if (lostCodeExplainModal) setModalVisible(lostCodeExplainModal, false);
  });
}
if (lostCodeHelpModal) {
  lostCodeHelpModal.addEventListener("click", (event) => {
    if (event.target === lostCodeHelpModal) setModalVisible(lostCodeHelpModal, false);
  });
}
if (lostCodeExplainModal) {
  lostCodeExplainModal.addEventListener("click", (event) => {
    if (event.target === lostCodeExplainModal) setModalVisible(lostCodeExplainModal, false);
  });
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && lostCodeExplainMode) {
    exitLostCodeExplainMode();
    return;
  }
  if (event.key !== "Escape") return;
  if (lostCodeHelpModal && !lostCodeHelpModal.classList.contains("hidden")) {
    setModalVisible(lostCodeHelpModal, false);
  }
  if (lostCodeExplainModal && !lostCodeExplainModal.classList.contains("hidden")) {
    setModalVisible(lostCodeExplainModal, false);
  }
});

document.addEventListener("pointerdown", (event) => {
  if (!lostCodeExplainMode || currentGameType !== "lost_code") return;
  const explainable = findLostCodeExplainButtonAtPoint(event.clientX, event.clientY);
  if (explainable) {
    event.preventDefault();
    event.stopPropagation();
    const explainKey = explainable.dataset.lostCodeExplainKey;
    if (explainKey) {
      showLostCodeButtonExplanation(explainKey);
      exitLostCodeExplainMode();
    }
    return;
  }

  const button = event.target.closest("button");
  if (!button) return;
  if (button === lostCodeExplainBtn || button === lostCodeHelpBtn) return;
  if (button === lostCodeHelpModalCloseBtn || button === lostCodeExplainModalCloseBtn) return;
  event.preventDefault();
  event.stopPropagation();
}, true);

document.addEventListener("click", (event) => {
  if (!lostCodeExplainMode || currentGameType !== "lost_code") return;
  const button = event.target.closest("button");
  if (!button) return;
  if (button === lostCodeExplainBtn || button === lostCodeHelpBtn) return;
  if (button === lostCodeHelpModalCloseBtn || button === lostCodeExplainModalCloseBtn) return;
  event.preventDefault();
  event.stopPropagation();
}, true);

if (lostCodeModeSelect) {
  lostCodeModeSelect.addEventListener("change", () => {
    if (currentRoomState) renderLostCodeRoomState(currentRoomState);
  });
}
if (lostCodeShortcutToggle) {
  lostCodeShortcutToggle.addEventListener("change", () => {
    if (currentRoomState) renderLostCodeRoomState(currentRoomState);
  });
}
if (lostCodeCurseToggle) {
  lostCodeCurseToggle.addEventListener("change", () => {
    if (currentRoomState) renderLostCodeRoomState(currentRoomState);
  });
}

window.clearLostCodeState = clearLostCodeState;
window.renderLostCodeGameState = renderLostCodeGameState;
window.renderLostCodeRoomState = renderLostCodeRoomState;
window.updateLostCodeConfigRow = updateLostCodeConfigRow;
window.showLostCodeHeaderActions = showLostCodeHeaderActions;
