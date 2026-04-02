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

let lostCodeHelpLanguage = "zh";

const LOST_CODE_HELP_HTML_EN = `
  <h3>Goal</h3>
  <p>Read clues and score the most points by predicting your hidden code.</p>
  <p><strong>What exactly are you guessing?</strong></p>
  <ul>
    <li><strong>During each round:</strong> you guess a range for <strong>your own total</strong> from the 3 dice symbols. Your total is the sum of your hidden stone values for those symbols, counting repeats (example: A, A, B means <code>A + A + B</code>).</li>
    <li><strong>At final scoring:</strong> you guess the <strong>exact value</strong> of each symbol in your own hidden log (or use locked values from Deadly Shortcut if you took those tokens).</li>
  </ul>

  <h3>Setup (how many and what range)</h3>
  <ul>
    <li>This game uses <strong>stone values</strong> (not hand cards).</li>
    <li>Each player gets <strong>1 private log</strong> with <strong>1 stone per active symbol</strong>.</li>
    <li><strong>Standard / X-Race:</strong> 6 active symbols, so each player has <strong>6 hidden stones</strong> (one for each symbol).</li>
    <li><strong>Intro:</strong> 5 active symbols (no red bear), so each player has <strong>5 hidden stones</strong>.</li>
    <li><strong>Value range per symbol:</strong> Standard/Intro uses <strong>0-7</strong>; X-Race uses <strong>0-8</strong>.</li>
  </ul>

  <h3>Modes</h3>
  <ul>
    <li><strong>Standard</strong>: Six symbols on the dice; each symbol uses stone values <strong>0–7</strong> (three dice, max sum <strong>21</strong>). The roller may change <strong>one</strong> die to any symbol before guesses.</li>
    <li><strong>Intro</strong>: The red bear is removed—only <strong>five</strong> symbols are in play, so rolls never show bears. Otherwise the same as Standard (one die may still be changed).</li>
    <li><strong>X-Race</strong>: Same six symbols as Standard, but stones go up to <strong>8</strong> per symbol (max sum <strong>24</strong>). Wheel sizes and round flow are unchanged.</li>
  </ul>

  <h3>Round Flow</h3>
  <ol>
    <li>Roll 3 symbol dice (active symbol set depends on mode).</li>
    <li>If Deadly Shortcut is on, resolve shortcut offers using the <strong>rolled</strong> faces, then the roller may modify <strong>one</strong> die and confirms.</li>
    <li>From most behind to most ahead, each player picks one wheel and submits a sum range.</li>
    <li>Correct range scores wheel VP (plus curse bonuses if applicable); wrong players exchange one stone where the pile still has cards.</li>
  </ol>

  <h3>Visibility</h3>
  <ul>
    <li>You cannot see your own current stone values.</li>
    <li>You can see other players and neutral logs.</li>
    <li>Discarded stones are public.</li>
  </ul>

  <h3>Deadly Shortcut (expansion)</h3>
  <p>Extra tokens—one per symbol—can be claimed after a roll when the <strong>raw</strong> three-dice result shows a symbol <strong>twice or three times</strong>. Offers run <strong>before</strong> the roller modifies a die.</p>
  <ul>
    <li>Order is the same as wheel picking: from <strong>most behind</strong> on the score track to the leader (roller is the most-behind player for that round).</li>
    <li>For each triggered symbol, players in turn <strong>pass</strong> or <strong>take</strong>. Taking locks <strong>1–3</strong> numbers for that symbol for <strong>end-of-game scoring only</strong>; the commit cannot be changed.</li>
    <li>Each symbol’s token can be taken <strong>once per match</strong>. Starting <strong>three rounds before the end</strong>, unused tokens are removed.</li>
    <li>At final scoring for that symbol: hit <strong>+10</strong> / <strong>+4</strong> / <strong>+2</strong> if you locked 1 / 2 / 3 numbers and one of them is correct; miss <strong>−4</strong>. Mid-round wheel scoring is unchanged.</li>
  </ul>

  <h3>Curse of the Temple (expansion)</h3>
  <p>A single curse mark moves among players during the game.</p>
  <ul>
    <li>If no one is cursed, the <strong>first player to reach 7 VP or more</strong> immediately takes the curse.</li>
    <li>If you are cursed and your <strong>range guess is correct</strong>: you earn your wheel VP <strong>plus +1 VP for each other player who guessed wrong</strong> this round.</li>
    <li>If you are cursed and your <strong>guess is wrong</strong>: you <strong>lose VP equal to that wheel’s value</strong> (then still replace a stone like other wrong guesses).</li>
    <li>After each round: if <strong>anyone has 13+ VP</strong>, or it is the <strong>forced cut</strong> before the last round, the curse is removed. Otherwise it passes to the <strong>score leader</strong> (ties broken like the physical rules).</li>
  </ul>
`;

const LOST_CODE_HELP_HTML_ZH = `
  <h3>目标</h3>
  <p>通过观察线索，尽可能准确推测自己的隐藏密码并获得最高分。</p>
  <p><strong>你到底在猜什么？</strong></p>
  <ul>
    <li><strong>每一轮：</strong>你要猜的是 <strong>你自己的总和区间</strong>。总和由 3 个骰子符号决定：把你日志里对应符号的隐藏数值相加；如果符号重复就重复加（例如 A、A、B 就是 <code>A + A + B</code>）。</li>
    <li><strong>终局结算：</strong>你要猜自己日志里每个符号的 <strong>精确数值</strong>（若拿过 Deadly Shortcut，则该符号按你锁定的数字结算）。</li>
  </ul>

  <h3>开局信息（数量与范围）</h3>
  <ul>
    <li>这个游戏使用的是 <strong>石头数值</strong>，不是手牌。</li>
    <li>每位玩家有 <strong>1 本私有日志</strong>，每个启用符号对应 <strong>1 颗石头</strong>。</li>
    <li><strong>Standard / X-Race：</strong>共有 6 种符号，所以每人有 <strong>6 颗隐藏石头</strong>。</li>
    <li><strong>Intro：</strong>去掉红熊，只用 5 种符号，所以每人有 <strong>5 颗隐藏石头</strong>。</li>
    <li><strong>每个符号的数值范围：</strong>Standard / Intro 为 <strong>0-7</strong>；X-Race 为 <strong>0-8</strong>。</li>
  </ul>

  <h3>模式</h3>
  <ul>
    <li><strong>Standard</strong>：6 种符号；每种符号石头数值 <strong>0-7</strong>（3 颗骰子的总和上限 <strong>21</strong>）。掷骰者在猜测前可把 <strong>1</strong> 颗骰子改成任意符号。</li>
    <li><strong>Intro</strong>：移除红熊，只用 <strong>5</strong> 种符号，掷骰不会出现熊。其余与 Standard 相同（仍可改 <strong>1</strong> 颗骰子）。</li>
    <li><strong>X-Race</strong>：符号同 Standard，但每种符号数值上限为 <strong>8</strong>（总和上限 <strong>24</strong>）。轮盘和回合流程不变。</li>
  </ul>

  <h3>每轮流程</h3>
  <ol>
    <li>掷 3 颗符号骰（可用符号受模式影响）。</li>
    <li>若开启 Deadly Shortcut，先按 <strong>原始掷骰结果</strong> 处理 token 抢夺，再由掷骰者改 <strong>1</strong> 颗骰并确认。</li>
    <li>从落后到领先，玩家依次选择一个轮盘并提交总和区间。</li>
    <li>猜中得轮盘分（若有诅咒再加成/惩罚）；猜错者需在可抽堆中选择一个符号换石头。</li>
  </ol>

  <h3>可见信息</h3>
  <ul>
    <li>你看不到自己当前石头的数值。</li>
    <li>你能看到其他玩家日志和中立日志。</li>
    <li>被弃掉的石头是公开信息。</li>
  </ul>

  <h3>Deadly Shortcut（扩展）</h3>
  <p>每个符号各有一个额外 token。若原始 3 颗骰子结果中某符号出现 <strong>2 次或 3 次</strong>，会触发该符号的 token 抢夺流程。此流程发生在掷骰者改骰子之前。</p>
  <ul>
    <li>顺序与选轮盘相同：从 <strong>当前最落后</strong> 到领先者（该轮掷骰者视为最落后）。</li>
    <li>对每个触发符号，玩家依次选择 <strong>pass</strong> 或 <strong>take</strong>。拿取后需为该符号锁定 <strong>1-3</strong> 个数字，仅用于 <strong>终局结算</strong>，且不可更改。</li>
    <li>每个符号 token 整局只能被拿一次。距离终局还剩 <strong>3 轮</strong> 时，未被拿走的 token 会移除。</li>
    <li>终局该符号结算：若命中，锁 1/2/3 个数字分别得 <strong>+10/+4/+2</strong>；未命中则 <strong>-4</strong>。不影响回合内轮盘得分逻辑。</li>
  </ul>

  <h3>Curse of the Temple（扩展）</h3>
  <p>游戏中会有一个诅咒标记在玩家之间流转。</p>
  <ul>
    <li>若当前无人被诅咒，<strong>第一个到达 7 分及以上</strong> 的玩家会立刻获得诅咒。</li>
    <li>被诅咒玩家若本轮 <strong>猜中区间</strong>：除轮盘分外，再获得 <strong>每位猜错玩家 +1 分</strong>。</li>
    <li>被诅咒玩家若本轮 <strong>猜错</strong>：会 <strong>扣除该轮盘对应分值</strong>（之后仍照常执行换石头）。</li>
    <li>每轮结束后：若 <strong>有人 13 分以上</strong>，或到达最终轮前的强制清除节点，诅咒移除；否则转移给 <strong>当前领先者</strong>（平分按实体规则的顺位处理）。</li>
  </ul>
`;

function renderLostCodeHelpContent() {
  if (!lostCodeHelpContent) return;
  const isZh = lostCodeHelpLanguage === "zh";
  const bodyHtml = isZh ? LOST_CODE_HELP_HTML_ZH : LOST_CODE_HELP_HTML_EN;
  lostCodeHelpContent.innerHTML = `
    <div class="row actions" style="justify-content:flex-end;gap:8px;margin-bottom:10px;">
      <button id="lostCodeHelpLangZhBtn" type="button" ${isZh ? "class=\"active\"" : ""}>中文</button>
      <button id="lostCodeHelpLangEnBtn" type="button" ${isZh ? "" : "class=\"active\""}>English</button>
    </div>
    ${bodyHtml}
  `;
  const zhBtn = document.getElementById("lostCodeHelpLangZhBtn");
  const enBtn = document.getElementById("lostCodeHelpLangEnBtn");
  if (zhBtn) {
    zhBtn.addEventListener("click", () => {
      if (lostCodeHelpLanguage !== "zh") {
        lostCodeHelpLanguage = "zh";
        renderLostCodeHelpContent();
      }
    });
  }
  if (enBtn) {
    enBtn.addEventListener("click", () => {
      if (lostCodeHelpLanguage !== "en") {
        lostCodeHelpLanguage = "en";
        renderLostCodeHelpContent();
      }
    });
  }
}

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
    description: "Change the selected die into this symbol. Active means this symbol is legal now; inactive means you cannot choose it in the current step.",
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
    description: "Discard current stone and draw same-symbol replacement. In the button label, (N) means how many stones remain in that symbol's draw pile. Active means you can replace with this symbol now; inactive means this symbol is currently unavailable (usually N = 0).",
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
            <li><strong>Button label format:</strong> ${wheelId} (${meaning.windowSize} / +${meaning.vp})</li>
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
  if (!dice.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "-";
    lostCodeDiceEl.appendChild(empty);
    return;
  }
  dice.forEach((symbol, index) => {
    if (index > 0) {
      const plus = document.createElement("span");
      plus.className = "lost-code-dice-op";
      plus.textContent = "+";
      lostCodeDiceEl.appendChild(plus);
    }
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
  const equals = document.createElement("span");
  equals.className = "lost-code-dice-op lost-code-dice-equals";
  equals.textContent = "= ?";
  lostCodeDiceEl.appendChild(equals);
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
  const formatResult = (result) => {
    if (result === "correct") return "correct ✅";
    if (result === "wrong" || result === "wrong_low" || result === "wrong_high") return "wrong ❌";
    return result || "pending";
  };

  const lastSummary = view.last_round_summary || {};
  const summaryEntries = Array.isArray(lastSummary.entries) ? lastSummary.entries : [];
  if (summaryEntries.length) {
    const title = document.createElement("div");
    title.className = "hint";
    const roundText = Number.isInteger(lastSummary.round) ? `Round ${lastSummary.round}` : "Previous Round";
    const dice = Array.isArray(lastSummary.dice_symbols)
      ? lastSummary.dice_symbols.map((symbol) => lostCodeSymbolLabel(symbol)).join(" ")
      : "";
    title.textContent = dice ? `${roundText} resolved (${dice})` : `${roundText} resolved`;
    lostCodeGuessesEl.appendChild(title);

    summaryEntries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "lost-code-guess-line";
      const wheel = entry.wheel_id || "-";
      const range = entry.min !== undefined && entry.max !== undefined ? `[${entry.min}-${entry.max}]` : "-";
      row.textContent = `${lostCodeFindPlayerName(entry.player_id)}: ${wheel} ${range} -> ${formatResult(entry.result)}`;
      lostCodeGuessesEl.appendChild(row);
    });
  }

  const guesses = view.guesses || {};
  const players = Array.isArray(view.players) ? view.players : [];
  const currentRows = [];
  players.forEach((player) => {
    const guess = guesses[player.player_id];
    if (!guess) return;
    const wheel = guess.wheel_id || "-";
    const range = guess.min !== undefined && guess.max !== undefined ? `[${guess.min}-${guess.max}]` : "-";
    currentRows.push(`${player.name || player.player_id}: ${wheel} ${range} -> ${formatResult(guess.result)}`);
  });
  if (currentRows.length) {
    if (summaryEntries.length) {
      const spacer = document.createElement("div");
      spacer.className = "hint";
      spacer.textContent = "Current round";
      lostCodeGuessesEl.appendChild(spacer);
    }
    currentRows.forEach((text) => {
      const row = document.createElement("div");
      row.className = "lost-code-guess-line";
      row.textContent = text;
      lostCodeGuessesEl.appendChild(row);
    });
  }

  if (!summaryEntries.length && !currentRows.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No resolved guesses yet.";
    lostCodeGuessesEl.appendChild(empty);
  }
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
  renderLostCodeHelpContent();
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
