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
    <div class="lost-code-help-language">
      <button id="lostCodeHelpLangZhBtn" type="button" ${isZh ? "class=\"active\"" : ""}>中文</button>
      <button id="lostCodeHelpLangEnBtn" type="button" ${isZh ? "" : "class=\"active\""}>English</button>
    </div>
    <h3>${isZh ? "符号与界面" : "Symbols & interface"}</h3>
    <p>${Object.entries(LOST_CODE_SYMBOLS).map(([symbol, entry]) => `${isZh ? entry.zh : entry.name} (${lostCodeSymbolLabel(symbol)})`).join(" · ")}</p>
    <p>${isZh ? "骰子 (🎲) 决定本轮总和；分数 (🏁) 为胜利分；诅咒 (🗿) 会改变计分；捷径 (⚡) 锁定终局猜测。密码线索 (🔎) 展示各日志；问号 (?) 为你的隐藏石头；弃石 (💎) 是已经公开的旧数值。" : "Dice (🎲) determine the round sum. Score (🏁) means victory points (VP). Curse (🗿) modifies scoring; Shortcut (⚡) locks final guesses. Code clues (🔎) compare logs; a question mark (?) is your hidden stone. Discards (💎) are public old values."}</p>
    <p>${isZh ? "轮盘 W1–W7 分别覆盖 1、2、3、4、5、7、10 个连续数字，猜中分别获得 5、4、3、3、2、2、1 分。选择轮盘，再点选区间中心，最后提交。终局每个符号选 1–3 个不同数字：猜中得 +5 / +2 / +1 分，猜错扣 2 分。" : "Wheels W1–W7 cover 1, 2, 3, 4, 5, 7 and 10 consecutive numbers, rewarding 5, 4, 3, 3, 2, 2 and 1 VP. Pick a wheel, then a range center, then submit. At final scoring, select 1–3 distinct numbers per symbol: a hit earns +5 / +2 / +1 VP; a miss loses 2 VP."}</p>
    <p>${isZh ? "手机可通过右侧 Clues 打开线索抽屉。悬停或点击图标查看简短说明；点 Explain 后再点按钮或区域查看详细说明。对话框可用 Esc 或点击背景关闭。" : "On mobile, Clues opens the side drawer. Hover or tap an icon for a short tooltip. Choose Explain, then a button or area for details. Press Esc or click outside a dialog to close it."}</p>
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
    description: "Discard your current stone (💎) and draw a replacement of the same symbol. The 'N left' label counts stones remaining in that draw pile. A disabled symbol has no replacement stones available.",
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

const LOST_CODE_SYMBOLS = {
  bird_blue: { icon: "🐦", color: "🔵", name: "Blue bird", short: "Bird", zh: "蓝鸟" },
  jaguar_yellow: { icon: "🐆", color: "🟡", name: "Yellow jaguar", short: "Jaguar", zh: "黄豹" },
  chameleon_purple: { icon: "🦎", color: "🟣", name: "Purple chameleon", short: "Lizard", zh: "紫变色龙" },
  snake_green: { icon: "🐍", color: "🟢", name: "Green snake", short: "Snake", zh: "绿蛇" },
  human_pink: { icon: "🧍", color: "🩷", name: "Pink human", short: "Human", zh: "粉人" },
  bear_red: { icon: "🐻", color: "🔴", name: "Red bear", short: "Bear", zh: "红熊" },
};
const LOST_CODE_AREA_EXPLANATIONS = {
  dice: ["Symbol dice (🎲)", "Add the values in your own log for these three symbols. Repeated symbols count again. Select a die to modify it when it is your turn."],
  code_clues: ["Code clues (🔎)", "Each column is a symbol; each row is a player's or neutral log. Your own values stay hidden (?). Compare the visible values and discarded stones (💎) to deduce yours."],
  discards: ["Discarded stones (💎)", "These old values are public and no longer in any log. The remaining count is the number of stones still in that symbol's draw pile."],
  scores: ["Score (🏁) & Curse (🗿)", "Score is measured in victory points (VP). The green player card marks the current turn. A cursed player gains extra points for others' misses when correct, but loses the wheel's points when wrong."],
  tokens: ["Shortcut tokens (⚡)", "A token locks 1–3 guesses for a symbol at final scoring. One, two or three locked numbers score +10, +4 or +2 on a hit; a miss scores −4. Removed tokens cannot be claimed."],
  guesses: ["Round guesses (📋)", "Compare each player's wheel and submitted range. A check (✅) is a correct range, a cross (❌) is a miss, and an hourglass (⏳) means the result is pending."],
  range_pick: ["Choose a range", "Tap the center of the range. Pale green numbers are included; the dark green number is the center. Disabled centers would extend the range below zero or above the maximum sum."],
  final_number: ["Final guesses", "Choose up to three distinct numbers for each symbol. One, two or three numbers score +5, +2 or +1 on a hit; a miss or an empty guess scores −2. Shortcut (⚡) guesses are already locked."],
};
let lostCodeExplainMode = false;
let lostCodeSuppressExplainClick = false;
let lostCodeTooltipTimer = null;
let lostCodeTooltipTarget = null;
let lostCodeSelectionKey = "";
let lostCodeFinalDraft = {};
const lostCodeModalReturnFocus = new WeakMap();
const lostCodePanelEl = document.getElementById("lostCodePanel");
const lostCodeCluesModal = document.getElementById("lostCodeCluesModal");
const lostCodeCluesBtn = document.getElementById("lostCodeCluesBtn");
const lostCodeTooltipEl = document.getElementById("lostCodeTooltip");

function lostCodeNode(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function lostCodeCan(action) {
  return !!currentLostCodeView?.legal_actions?.includes(action);
}

function lostCodeFindPlayerName(playerId) {
  return currentLostCodeView?.players?.find((item) => item.player_id === playerId)?.name || playerId || "—";
}

function lostCodeSymbolLabel(symbol) {
  const entry = LOST_CODE_SYMBOLS[symbol];
  return entry ? entry.icon + entry.color : symbol || "—";
}

function lostCodeSymbolName(symbol) {
  return LOST_CODE_SYMBOLS[symbol]?.name || symbol || "Unknown symbol";
}

function lostCodeTip(el, text) {
  el.dataset.lostCodeTip = text;
  el.setAttribute("aria-label", text);
  if (!el.matches("button, select, summary")) el.tabIndex = 0;
  return el;
}

function lostCodeSymbol(symbol, interactive = false) {
  const el = lostCodeNode("span", "lost-code-symbol", LOST_CODE_SYMBOLS[symbol]?.icon || "?");
  el.dataset.symbol = symbol;
  if (interactive) el.setAttribute("aria-hidden", "true");
  else {
    lostCodeTip(el, `${lostCodeSymbolName(symbol)} (${lostCodeSymbolLabel(symbol)})`);
    markLostCodeExplainable(el, `symbol:${symbol}`);
  }
  return el;
}

function lostCodeButton(text, explainKey, onClick, className = "") {
  const button = lostCodeNode("button", className, text);
  button.type = "button";
  markLostCodeExplainable(button, explainKey);
  button.addEventListener("click", onClick);
  return button;
}

function lostCodeControlLabel(host, text) {
  host.appendChild(lostCodeNode("div", "lost-code-control-label", text));
}

function markLostCodeExplainable(el, explainKey) {
  if (!el || !explainKey) return;
  el.dataset.lostCodeExplainKey = explainKey;
  el.classList.toggle("has-explanation", lostCodeExplainMode);
}

function updateLostCodeExplainModeClasses(enabled) {
  document.querySelectorAll("[data-lost-code-explain-key]").forEach((el) => el.classList.toggle("has-explanation", enabled));
}

function findLostCodeExplainButtonAtPoint(x, y) {
  for (const el of document.elementsFromPoint(x, y)) {
    const target = el.closest("[data-lost-code-explain-key]");
    if (target) return target;
  }
  return null;
}

function lostCodeSetModal(modal, visible) {
  if (!modal) return;
  hideLostCodeTooltip();
  if (visible === !modal.classList.contains("hidden")) return;
  if (visible) lostCodeModalReturnFocus.set(modal, document.activeElement);
  setModalVisible(modal, visible);
  document.body.classList.toggle("lost-code-dialog-open", [lostCodeHelpModal, lostCodeExplainModal, lostCodeCluesModal].some((item) => item && !item.classList.contains("hidden")));
  if (visible) modal.querySelector("button")?.focus({ preventScroll: true });
  else {
    const previous = lostCodeModalReturnFocus.get(modal);
    if (previous?.isConnected) previous.focus({ preventScroll: true });
    lostCodeModalReturnFocus.delete(modal);
  }
}

function showLostCodeButtonExplanation(explainKey) {
  if (!lostCodeExplainContent) return;
  let entry = LOST_CODE_BUTTON_EXPLANATIONS[explainKey];
  const area = LOST_CODE_AREA_EXPLANATIONS[explainKey];
  if (area) entry = { name: area[0], description: area[1] };
  if (explainKey.startsWith("symbol:")) {
    const symbol = explainKey.slice(7);
    entry = { name: `${lostCodeSymbolName(symbol)} (${lostCodeSymbolLabel(symbol)})`, description: `This symbol has one stone in each log. Its value is between 0 and ${currentLostCodeView?.max_symbol_value ?? 7}. Matching dice (🎲) use your own hidden value.` };
  }
  if (explainKey.startsWith("wheel_pick:")) {
    const wheel = currentLostCodeView?.wheels?.find((item) => item.id === explainKey.slice(11));
    if (wheel) entry = {
      name: `${wheel.id} · Range wheel`,
      description: `Covers ${wheel.window_size} consecutive number${wheel.window_size === 1 ? "" : "s"} and scores +${wheel.victory_points} VP (🏁) on a hit. A narrower range is harder to hit. Each wheel can be taken once per round.`,
      cost: currentLostCodeView.available_wheel_ids.includes(wheel.id) ? "Available" : "Already taken",
    };
  }
  if (!entry) return;
  lostCodeExplainContent.replaceChildren(
    lostCodeNode("h3", "", entry.name),
    lostCodeNode("p", "", entry.description)
  );
  if (entry.cost) lostCodeExplainContent.appendChild(lostCodeNode("div", "lost-code-explain-cost", entry.cost));
  lostCodeSetModal(lostCodeExplainModal, true);
}

function toggleLostCodeExplainMode() {
  lostCodeExplainMode = !lostCodeExplainMode;
  hideLostCodeTooltip();
  document.body.classList.toggle("lost-code-explain-mode", lostCodeExplainMode);
  updateLostCodeExplainModeClasses(lostCodeExplainMode);
  lostCodeExplainBtn?.classList.toggle("active", lostCodeExplainMode);
  lostCodeExplainBtn?.setAttribute("aria-pressed", String(lostCodeExplainMode));
}

function exitLostCodeExplainMode() {
  if (!lostCodeExplainMode) return;
  toggleLostCodeExplainMode();
}

function hideLostCodeTooltip() {
  window.clearTimeout(lostCodeTooltipTimer);
  lostCodeTooltipTarget?.removeAttribute("aria-describedby");
  lostCodeTooltipTarget = null;
  lostCodeTooltipEl?.classList.add("hidden");
}

function showLostCodeTooltip(el) {
  if (lostCodeExplainMode || !lostCodeTooltipEl || !el?.dataset.lostCodeTip) return;
  hideLostCodeTooltip();
  lostCodeTooltipTarget = el;
  el.setAttribute("aria-describedby", "lostCodeTooltip");
  lostCodeTooltipEl.textContent = el.dataset.lostCodeTip;
  lostCodeTooltipEl.classList.remove("hidden");
  const rect = el.getBoundingClientRect();
  const box = lostCodeTooltipEl.getBoundingClientRect();
  const left = Math.max(12, Math.min(rect.left + rect.width / 2 - box.width / 2, window.innerWidth - box.width - 12));
  const top = rect.top >= box.height + 16 ? rect.top - box.height - 8 : Math.min(rect.bottom + 8, window.innerHeight - box.height - 12);
  lostCodeTooltipEl.style.left = `${left}px`;
  lostCodeTooltipEl.style.top = `${Math.max(12, top)}px`;
  lostCodeTooltipTimer = window.setTimeout(hideLostCodeTooltip, 3000);
}

function setLostCodeCluesOpen(open) {
  const content = document.getElementById("lostCodeClueContent");
  const host = document.getElementById(open ? "lostCodeCluesDockHost" : "lostCodeCluesHome");
  if (!content || !host || !lostCodeCluesModal) return;
  host.appendChild(content);
  lostCodeCluesBtn?.setAttribute("aria-expanded", String(open));
  lostCodeSetModal(lostCodeCluesModal, open);
}

function clearLostCodeState() {
  exitLostCodeExplainMode();
  hideLostCodeTooltip();
  setLostCodeCluesOpen(false);
  currentLostCodeView = null;
  lostCodeSelectedDieIndex = 0;
  lostCodeSelectedWheelId = null;
  lostCodeSelectedRangeCenter = null;
  lostCodeShortcutGuesses = new Set();
  lostCodeFinalDraft = {};
  lostCodeSelectionKey = "";
  [lostCodePhaseLabel, lostCodeRoundLabel, lostCodeTurnLabel, lostCodeModeLabel].forEach((el) => { if (el) el.textContent = "—"; });
  [lostCodeDiceEl, lostCodePlayersEl, lostCodeLogsEl, lostCodeControlsEl, lostCodeTokenEl, lostCodeGuessesEl, document.getElementById("lostCodeDiscards")].forEach((el) => el?.replaceChildren());
  if (lostCodeHintEl) lostCodeHintEl.textContent = "";
  lostCodeCluesBtn?.classList.add("hidden");
  document.getElementById("lostCodeTokenDetails")?.classList.add("hidden");
  [lostCodeHelpModal, lostCodeExplainModal].forEach((modal) => { if (modal) setModalVisible(modal, false); });
  document.body.classList.remove("lost-code-dialog-open");
}

function updateLostCodeConfigRow() {
  const showRow = currentRoomState && currentGameType === "lost_code" && currentRoomState.status === "lobby";
  lostCodeConfigBox?.classList.toggle("hidden", !showRow);
  lostCodeConfigBox?.setAttribute("aria-hidden", String(!showRow));
  if (showRow) renderLostCodeRoomState(currentRoomState);
}

function showLostCodeHeaderActions(show) {
  if (lostCodeHeaderActions) lostCodeHeaderActions.style.display = show ? "flex" : "none";
  if (!show) {
    exitLostCodeExplainMode();
    hideLostCodeTooltip();
    setLostCodeCluesOpen(false);
    [lostCodeHelpModal, lostCodeExplainModal].forEach((modal) => { if (modal) setModalVisible(modal, false); });
    document.body.classList.remove("lost-code-dialog-open");
  }
}

function renderLostCodeRoomState(state) {
  if (!state || currentGameType !== "lost_code" || state.status !== "lobby") return;
  clearLostCodeState();
  const mode = lostCodeModeSelect?.value || "standard";
  lostCodePhaseLabel.textContent = "Lobby";
  lostCodeRoundLabel.textContent = "—";
  lostCodeTurnLabel.textContent = "Not started";
  lostCodeModeLabel.textContent = { standard: "Standard", intro: "Intro", x_race: "X-Race" }[mode] || mode;
  document.getElementById("lostCodeActionTitle").textContent = "🎲 Get ready";
  document.getElementById("lostCodeTurnBadge").textContent = "Lobby";
  document.getElementById("lostCodeValueRange").textContent = mode === "x_race" ? "Values 0–8" : "Values 0–7";
  document.getElementById("lostCodeDiscardCount").textContent = "0";
  document.getElementById("lostCodeGuessCount").textContent = "0";
  lostCodeHintEl.textContent = "Choose your options in Room Controls, then ready up.";
  renderLostCodeDice({ dice_symbols: [] });
  lostCodeLogsEl.appendChild(lostCodeNode("div", "lost-code-empty", "Your code clues appear when the game starts."));
  lostCodeGuessesEl.appendChild(lostCodeNode("div", "lost-code-empty", "No guesses yet."));
}

function renderLostCodeDice(view) {
  lostCodeDiceEl.replaceChildren();
  const dice = view.dice_symbols || [];
  if (!dice.length) {
    lostCodeDiceEl.appendChild(lostCodeNode("div", "lost-code-dice-empty", "🎲  Three dice, one hidden sum"));
    return;
  }
  const canModify = lostCodeCan("modify_die");
  dice.forEach((symbol, index) => {
    if (index) lostCodeDiceEl.appendChild(lostCodeNode("span", "lost-code-dice-op", "+"));
    const die = canModify
      ? lostCodeButton("", "dice_pick", () => {
        lostCodeSelectedDieIndex = index;
        renderLostCodeDice(currentLostCodeView);
      }, "lost-code-die")
      : lostCodeNode("div", "lost-code-die");
    if (canModify) {
      die.classList.toggle("selected", index === lostCodeSelectedDieIndex);
      die.setAttribute("aria-pressed", String(index === lostCodeSelectedDieIndex));
      die.setAttribute("aria-label", `Die ${index + 1}: ${lostCodeSymbolName(symbol)}. Select to change.`);
    } else {
      lostCodeTip(die, `Die ${index + 1}: ${lostCodeSymbolName(symbol)} (${lostCodeSymbolLabel(symbol)})`);
      markLostCodeExplainable(die, "dice");
    }
    die.append(lostCodeSymbol(symbol, true), lostCodeNode("span", "lost-code-die-index", `DIE ${index + 1}`));
    lostCodeDiceEl.appendChild(die);
  });
  lostCodeDiceEl.appendChild(lostCodeTip(lostCodeNode("span", "lost-code-dice-op", "= ?"), "Your total: add your hidden values for these three symbols, counting repeats."));
}

function renderLostCodePlayers(view) {
  lostCodePlayersEl.replaceChildren();
  (view.players || []).forEach((player) => {
    const row = lostCodeNode("div", "lost-code-player-row");
    row.classList.toggle("is-current", player.player_id === view.current_actor);
    const name = lostCodeNode("div", "lost-code-player-name", player.name || player.player_id);
    const tags = [];
    if (player.you) tags.push("You");
    if (player.player_id === view.current_actor) tags.push("Playing");
    if (view.winner_ids?.includes(player.player_id)) tags.push("Winner");
    if (tags.length) name.appendChild(lostCodeNode("span", "lost-code-player-tag", tags.join(" · ")));
    row.appendChild(name);
    if (player.player_id === view.cursed_player_id) row.appendChild(lostCodeTip(lostCodeNode("span", "", "🗿"), "Cursed: bonus points for a hit; lose your wheel's VP on a miss."));
    row.appendChild(lostCodeTip(lostCodeNode("span", "lost-code-score", `🏁 ${player.score}`), `Score: ${player.score} victory points (VP).`));
    markLostCodeExplainable(row, "scores");
    lostCodePlayersEl.appendChild(row);
  });
}

function renderLostCodeLogs(view) {
  lostCodeLogsEl.replaceChildren();
  const table = lostCodeNode("table", "lost-code-log-table");
  table.setAttribute("aria-label", "Visible and hidden symbol values by log");
  const head = document.createElement("thead");
  const heading = document.createElement("tr");
  const label = lostCodeNode("th", "", "Log");
  label.scope = "col";
  heading.appendChild(label);
  (view.active_symbols || []).forEach((symbol) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.appendChild(lostCodeSymbol(symbol));
    heading.appendChild(cell);
  });
  head.appendChild(heading);
  table.appendChild(head);
  const body = document.createElement("tbody");
  let neutral = 0;
  (view.logs || []).forEach((log) => {
    const self = !!log.owner_player_id && log.owner_player_id === view.you;
    const row = document.createElement("tr");
    row.classList.toggle("is-you", self);
    const owner = log.owner_player_id ? (self ? "You" : lostCodeFindPlayerName(log.owner_player_id)) : `Neutral ${++neutral}`;
    const name = lostCodeNode("th", "", owner);
    name.scope = "row";
    if (self && !view.game_over) name.appendChild(lostCodeNode("small", "", "Hidden code"));
    row.appendChild(name);
    (view.active_symbols || []).forEach((symbol) => {
      const slot = (log.slots || []).find((item) => item.symbol === symbol);
      const hidden = !slot || slot.hidden_from_viewer;
      const cell = lostCodeNode("td", hidden ? "lost-code-hidden-value" : "", hidden ? "?" : String(slot.value));
      lostCodeTip(cell, `${owner} · ${lostCodeSymbolName(symbol)}: ${hidden ? "hidden from you" : slot.value}`);
      markLostCodeExplainable(cell, "code_clues");
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
  table.appendChild(body);
  lostCodeLogsEl.appendChild(table);
  lostCodeLogsEl.appendChild(lostCodeNode("div", "lost-code-log-caption", view.game_over ? "All codes revealed." : "Your ? values are hidden. Compare each symbol column."));
  renderLostCodeDiscards(view);
}

function renderLostCodeDiscards(view) {
  const host = document.getElementById("lostCodeDiscards");
  const scroll = host.scrollTop;
  host.replaceChildren();
  const discards = view.discarded_stones || [];
  document.getElementById("lostCodeDiscardCount").textContent = String(discards.length);
  (view.active_symbols || []).forEach((symbol) => {
    const values = discards.filter((item) => item.symbol === symbol).map((item) => item.old_stone?.value).filter(Number.isInteger).sort((a, b) => a - b);
    const row = lostCodeNode("div", "lost-code-discard-line");
    row.appendChild(lostCodeSymbol(symbol));
    const numbers = lostCodeNode("div", "", values.length ? values.join(", ") : "—");
    numbers.appendChild(lostCodeNode("small", "", `${view.draw_pile_counts?.[symbol] ?? 0} remaining`));
    row.appendChild(numbers);
    host.appendChild(row);
  });
  host.scrollTop = scroll;
}

function renderLostCodeTokenStatus(view) {
  lostCodeTokenEl.replaceChildren();
  const tokens = view.deadly_shortcut_tokens || {};
  const relevant = Object.values(tokens).some((token) => !token.removed || token.taken_by);
  document.getElementById("lostCodeTokenDetails").classList.toggle("hidden", !relevant);
  if (!relevant) return;
  (view.active_symbols || []).forEach((symbol) => {
    const token = tokens[symbol] || {};
    const line = lostCodeNode("div", "lost-code-token-line");
    line.appendChild(lostCodeSymbol(symbol));
    const owner = token.taken_by ? lostCodeFindPlayerName(token.taken_by) : token.removed ? "Removed" : "Available";
    const text = lostCodeNode("div", "", owner);
    const self = view.players?.find((player) => player.you);
    const commit = self?.shortcut_commits?.[symbol];
    if (commit) text.appendChild(lostCodeNode("div", "", `🔒 ${commit.join(", ")}`));
    line.appendChild(text);
    lostCodeTokenEl.appendChild(line);
  });
}

function renderLostCodeGuesses(view) {
  const scroll = lostCodeGuessesEl.scrollTop;
  lostCodeGuessesEl.replaceChildren();
  let count = 0;
  const appendGuess = (playerId, guess) => {
    count += 1;
    const row = lostCodeNode("div", "lost-code-guess-line");
    const name = lostCodeNode("span", "", lostCodeFindPlayerName(playerId));
    const range = guess.min != null && guess.max != null ? `${guess.min}–${guess.max}` : "—";
    const correct = guess.result === "correct";
    const wrong = ["wrong", "wrong_low", "wrong_high"].includes(guess.result);
    const result = lostCodeNode("span", `lost-code-guess-result ${correct ? "correct" : wrong ? "wrong" : ""}`, correct ? "✅ Hit" : wrong ? "❌ Miss" : "⏳");
    lostCodeTip(result, correct ? "The submitted range was correct." : wrong ? "The submitted range missed." : "Waiting for the round result.");
    row.append(name, lostCodeNode("span", "", `${guess.wheel_id || "—"} · ${range}`), result);
    lostCodeGuessesEl.appendChild(row);
  };
  const guesses = Object.entries(view.guesses || {});
  if (guesses.length) {
    lostCodeGuessesEl.appendChild(lostCodeNode("div", "lost-code-control-label", `Round ${view.round}`));
    guesses.forEach(([playerId, guess]) => appendGuess(playerId, guess));
  }
  const summary = view.last_round_summary || {};
  // During exchange the current guesses already contain this same round.
  if (summary.entries?.length && (summary.round !== view.round || !guesses.length)) {
    const heading = lostCodeNode("div", "lost-code-control-label", `Round ${summary.round} · Resolved`);
    lostCodeGuessesEl.appendChild(heading);
    const dice = lostCodeNode("div", "lost-code-chip-wrap");
    (summary.dice_symbols || []).forEach((symbol) => dice.appendChild(lostCodeSymbol(symbol)));
    lostCodeGuessesEl.appendChild(dice);
    summary.entries.forEach((entry) => appendGuess(entry.player_id, entry));
  }
  if (!count) lostCodeGuessesEl.appendChild(lostCodeNode("div", "lost-code-empty", "Guesses appear as players submit."));
  document.getElementById("lostCodeGuessCount").textContent = String(count);
  lostCodeGuessesEl.scrollTop = scroll;
}

function renderLostCodeModifyControls(view, host) {
  if (lostCodeCan("modify_die")) {
    lostCodeControlLabel(host, "Change the selected die to");
    const symbols = lostCodeNode("div", "lost-code-symbol-options");
    (view.active_symbols || []).forEach((symbol) => {
      const button = lostCodeButton("", "modify_symbol", () => sendAction({ type: "modify_die", die_index: lostCodeSelectedDieIndex, symbol }), "lost-code-symbol-choice");
      button.setAttribute("aria-label", `Change selected die to ${lostCodeSymbolName(symbol)}`);
      button.append(lostCodeSymbol(symbol, true), lostCodeNode("span", "", LOST_CODE_SYMBOLS[symbol]?.short || symbol));
      symbols.appendChild(button);
    });
    host.appendChild(symbols);
  }
  if (lostCodeCan("confirm_dice")) host.appendChild(lostCodeButton("Confirm dice", "confirm_dice", () => sendAction({ type: "confirm_dice" }), "lost-code-primary"));
}

function renderLostCodeShortcutControls(view, host) {
  const symbol = view.shortcut_offer?.symbol;
  lostCodeControlLabel(host, `${lostCodeSymbolName(symbol)} (${lostCodeSymbolLabel(symbol)}) · Pick up to 3 numbers`);
  const numbers = lostCodeNode("div", "lost-code-number-options");
  const buttons = [];
  const update = () => {
    buttons.forEach((button, value) => {
      button.classList.toggle("selected", lostCodeShortcutGuesses.has(value));
      button.setAttribute("aria-pressed", String(lostCodeShortcutGuesses.has(value)));
    });
    take.disabled = lostCodeShortcutGuesses.size < 1 || !lostCodeCan("take_shortcut");
    take.textContent = lostCodeShortcutGuesses.size ? `Take token · ${lostCodeShortcutGuesses.size} picked` : "Take token";
  };
  for (let value = 0; value <= (view.max_symbol_value ?? 7); value += 1) {
    const button = lostCodeButton(String(value), "shortcut_number_toggle", () => {
      if (lostCodeShortcutGuesses.has(value)) lostCodeShortcutGuesses.delete(value);
      else if (lostCodeShortcutGuesses.size < 3) lostCodeShortcutGuesses.add(value);
      update();
    });
    buttons.push(button);
    numbers.appendChild(button);
  }
  const actions = lostCodeNode("div", "lost-code-actions");
  const pass = lostCodeButton("Pass", "shortcut_pass", () => sendAction({ type: "pass_shortcut" }));
  pass.disabled = !lostCodeCan("pass_shortcut");
  const take = lostCodeButton("Take token", "shortcut_take", () => sendAction({ type: "take_shortcut", guesses: [...lostCodeShortcutGuesses].sort((a, b) => a - b) }), "lost-code-primary");
  actions.append(pass, take);
  host.append(numbers, actions);
  numbers.addEventListener("click", (event) => {
    if (event.target !== numbers) return;
    lostCodeShortcutGuesses.clear();
    update();
  });
  update();
}

function renderLostCodeWheelControls(view, host) {
  const wheels = view.wheels || [];
  const available = new Set(view.available_wheel_ids || []);
  if (!available.has(lostCodeSelectedWheelId)) {
    lostCodeSelectedWheelId = view.available_wheel_ids?.[0] || null;
    lostCodeSelectedRangeCenter = null;
  }
  lostCodeControlLabel(host, "1 · Wheel range size (numbers)");
  const wheelRow = lostCodeNode("div", "lost-code-wheel-grid");
  wheels.forEach((wheel) => {
    const button = lostCodeButton("", `wheel_pick:${wheel.id}`, () => {
      lostCodeSelectedWheelId = wheel.id;
      lostCodeSelectedRangeCenter = null;
      renderLostCodeControls(currentLostCodeView);
      lostCodeControlsEl.querySelector(`[data-lost-code-wheel="${wheel.id}"]`)?.focus({ preventScroll: true });
    }, "lost-code-wheel");
    button.dataset.lostCodeWheel = wheel.id;
    button.disabled = !available.has(wheel.id);
    button.classList.toggle("selected", wheel.id === lostCodeSelectedWheelId);
    button.setAttribute("aria-pressed", String(wheel.id === lostCodeSelectedWheelId));
    button.setAttribute("aria-label", `${wheel.id}: ${wheel.window_size} numbers, +${wheel.victory_points} VP${button.disabled ? ", taken" : ""}`);
    button.append(
      lostCodeNode("span", "", wheel.id),
      lostCodeNode("strong", "", String(wheel.window_size)),
      lostCodeNode("span", "lost-code-wheel-reward", `+${wheel.victory_points} VP`)
    );
    wheelRow.appendChild(button);
  });
  host.appendChild(wheelRow);
  const wheel = wheels.find((item) => item.id === lostCodeSelectedWheelId);
  if (!wheel) return;
  lostCodeControlLabel(host, "2 · Tap your range center");
  const maxSum = view.max_sum ?? 21;
  const left = Math.floor((wheel.window_size - 1) / 2);
  const right = wheel.window_size - 1 - left;
  if (lostCodeSelectedRangeCenter < left || lostCodeSelectedRangeCenter > maxSum - right) lostCodeSelectedRangeCenter = null;
  const strip = lostCodeNode("div", "lost-code-range-strip");
  const cells = [];
  const preview = lostCodeNode("div", "lost-code-range-preview");
  const previewValue = lostCodeNode("strong", "", "—");
  const previewLabel = lostCodeNode("span", "", "Your sum range");
  preview.setAttribute("aria-live", "polite");
  preview.append(previewValue, previewLabel);
  const submit = lostCodeButton("Submit guess", "wheel_submit", () => {
    if (!Number.isInteger(lostCodeSelectedRangeCenter)) return;
    sendAction({ type: "submit_guess", wheel_id: wheel.id, min: lostCodeSelectedRangeCenter - left, max: lostCodeSelectedRangeCenter + right });
  }, "lost-code-primary");
  const update = () => {
    const selected = Number.isInteger(lostCodeSelectedRangeCenter);
    cells.forEach((cell, value) => {
      cell.classList.toggle("center", selected && value === lostCodeSelectedRangeCenter);
      cell.classList.toggle("in-range", selected && value >= lostCodeSelectedRangeCenter - left && value <= lostCodeSelectedRangeCenter + right);
      cell.setAttribute("aria-pressed", String(selected && value === lostCodeSelectedRangeCenter));
    });
    previewValue.textContent = selected ? `${lostCodeSelectedRangeCenter - left}–${lostCodeSelectedRangeCenter + right}` : "—";
    previewLabel.textContent = selected ? `${wheel.window_size} ${wheel.window_size === 1 ? "number" : "numbers"} · +${wheel.victory_points} VP` : "Choose a range";
    submit.disabled = !selected;
  };
  for (let value = 0; value <= maxSum; value += 1) {
    const cell = lostCodeButton(String(value), "range_pick", () => {
      lostCodeSelectedRangeCenter = value;
      update();
    }, "lost-code-range-cell");
    cell.disabled = value < left || value > maxSum - right;
    cell.setAttribute("aria-label", cell.disabled ? `Center ${value} is outside the allowed range` : `Choose range ${value - left} to ${value + right}`);
    cells.push(cell);
    strip.appendChild(cell);
  }
  strip.addEventListener("click", (event) => {
    if (event.target !== strip) return;
    lostCodeSelectedRangeCenter = null;
    update();
  });
  const actions = lostCodeNode("div", "lost-code-guess-submit");
  actions.append(preview, submit);
  host.append(strip, actions);
  update();
}

function renderLostCodeExchangeControls(view, host) {
  lostCodeControlLabel(host, "Choose a symbol to replace");
  const symbols = lostCodeNode("div", "lost-code-symbol-options");
  (view.active_symbols || []).forEach((symbol) => {
    const count = view.draw_pile_counts?.[symbol] || 0;
    const button = lostCodeButton("", "exchange_symbol", () => sendAction({ type: "replace_stone", symbol }), "lost-code-symbol-choice");
    button.disabled = !count;
    button.setAttribute("aria-label", `Replace ${lostCodeSymbolName(symbol)}: ${count} stones remaining`);
    const label = lostCodeNode("span", "", LOST_CODE_SYMBOLS[symbol]?.short || symbol);
    label.appendChild(lostCodeNode("small", "lost-code-player-tag", `${count} left`));
    button.append(lostCodeSymbol(symbol, true), label);
    symbols.appendChild(button);
  });
  host.appendChild(symbols);
  if (lostCodeCan("skip_exchange")) host.appendChild(lostCodeButton("Skip exchange", "exchange_skip", () => sendAction({ type: "skip_exchange" }), "lost-code-primary"));
}

function renderLostCodeFinalControls(view, host) {
  const commits = view.players?.find((player) => player.you)?.shortcut_commits || {};
  lostCodeControlLabel(host, "Choose up to 3 numbers per symbol");
  const form = lostCodeNode("div", "lost-code-final-form");
  (view.active_symbols || []).forEach((symbol) => {
    const row = lostCodeNode("div", "lost-code-final-row");
    const label = lostCodeNode("div", "lost-code-final-label");
    label.append(lostCodeSymbol(symbol), lostCodeNode("span", "", LOST_CODE_SYMBOLS[symbol]?.short || symbol));
    row.appendChild(label);
    if (commits[symbol]) {
      row.appendChild(lostCodeNode("div", "lost-code-final-locked", `🔒 ${commits[symbol].join(", ")} · Shortcut`));
    } else {
      if (!lostCodeFinalDraft[symbol]) lostCodeFinalDraft[symbol] = ["", "", ""];
      for (let index = 0; index < 3; index += 1) {
        const select = document.createElement("select");
        select.dataset.lostCodeField = `${symbol}-${index}`;
        select.setAttribute("aria-label", `${lostCodeSymbolName(symbol)}, guess ${index + 1}`);
        markLostCodeExplainable(select, "final_number");
        select.appendChild(new Option("—", ""));
        for (let value = 0; value <= (view.max_symbol_value ?? 7); value += 1) select.appendChild(new Option(String(value), String(value)));
        select.value = lostCodeFinalDraft[symbol][index];
        select.addEventListener("change", () => { lostCodeFinalDraft[symbol][index] = select.value; });
        row.appendChild(select);
      }
    }
    form.appendChild(row);
  });
  host.appendChild(form);
  host.appendChild(lostCodeButton("Submit final guesses", "final_submit", () => {
    const guesses = {};
    (view.active_symbols || []).forEach((symbol) => {
      if (!commits[symbol]) guesses[symbol] = [...new Set((lostCodeFinalDraft[symbol] || []).filter((value) => value !== "").map(Number))];
    });
    sendAction({ type: "submit_final_guesses", guesses });
  }, "lost-code-primary"));
}

function renderLostCodeControls(view) {
  if (!lostCodeControlsEl) return;
  const focusField = document.activeElement?.dataset.lostCodeField;
  lostCodeControlsEl.replaceChildren();
  if (lostCodeCan("roll_dice")) {
    lostCodeControlsEl.appendChild(lostCodeButton("🎲 Roll dice", "roll_dice", () => sendAction({ type: "roll_dice" }), "lost-code-primary"));
  } else if (lostCodeCan("pass_shortcut") || lostCodeCan("take_shortcut")) {
    renderLostCodeShortcutControls(view, lostCodeControlsEl);
  } else if (lostCodeCan("modify_die") || lostCodeCan("confirm_dice")) {
    renderLostCodeModifyControls(view, lostCodeControlsEl);
  } else if (lostCodeCan("submit_guess")) {
    renderLostCodeWheelControls(view, lostCodeControlsEl);
  } else if (lostCodeCan("replace_stone") || lostCodeCan("skip_exchange")) {
    renderLostCodeExchangeControls(view, lostCodeControlsEl);
  } else if (lostCodeCan("submit_final_guesses")) {
    renderLostCodeFinalControls(view, lostCodeControlsEl);
  }
  if (focusField) {
    // A room update must not discard an in-progress final guess or move focus.
    Array.from(lostCodeControlsEl.querySelectorAll("[data-lost-code-field]"))
      .find((el) => el.dataset.lostCodeField === focusField)?.focus({ preventScroll: true });
  }
}

function openLostCodeHelpModal() {
  exitLostCodeExplainMode();
  renderLostCodeHelpContent();
  lostCodeSetModal(lostCodeHelpModal, true);
}

function renderLostCodeGameState(data) {
  const view = data?.view;
  if (!view) { clearLostCodeState(); return; }
  currentLostCodeView = view;
  if (currentGameType !== "lost_code") {
    currentGameType = "lost_code";
    setGamePanelVisibility("lost_code");
  }
  const key = `${data.room_id || ""}:${view.you}:${view.round}:${view.phase}:${view.current_actor}:${view.shortcut_offer?.symbol || ""}`;
  if (key !== lostCodeSelectionKey) {
    lostCodeSelectionKey = key;
    lostCodeSelectedDieIndex = 0;
    lostCodeSelectedWheelId = null;
    lostCodeSelectedRangeCenter = null;
    lostCodeShortcutGuesses.clear();
    lostCodeFinalDraft = {};
  }
  const phaseNames = { roll_dice: "Roll dice", modify_die: "Adjust dice", offer_shortcut_token: "Shortcut", choose_wheels: "Choose range", exchange_stones: "Replace stone", final_guess_submit: "Final guesses", game_over: "Game over" };
  const isYourTurn = !!view.legal_actions?.length;
  lostCodePhaseLabel.textContent = phaseNames[view.phase] || view.phase || "—";
  lostCodeRoundLabel.textContent = `${view.round || "—"} / ${view.max_rounds || "—"}`;
  lostCodeTurnLabel.textContent = view.game_over ? "Finished" : view.current_actor_name || "—";
  lostCodeModeLabel.textContent = { standard: "Standard", intro: "Intro", x_race: "X-Race" }[view.mode] || view.mode || "—";
  document.getElementById("lostCodeTurnBadge").textContent = view.game_over ? "Finished" : isYourTurn ? "Your turn" : "Waiting";
  document.getElementById("lostCodeValueRange").textContent = `Values 0–${view.max_symbol_value ?? 7}`;
  document.getElementById("lostCodeActionTitle").textContent = view.game_over ? "🏁 Final scores" : `🎲 ${phaseNames[view.phase] || "Round dice"}`;
  let hint = view.phase_detail || "Waiting for the next move.";
  if (isYourTurn && view.phase === "modify_die") hint = lostCodeCan("modify_die") ? "Select a die and change its symbol, or keep this roll." : "Die changed. Confirm to continue.";
  if (isYourTurn && view.phase === "choose_wheels") hint = "Predict the sum of your own three hidden values.";
  for (const symbol of Object.keys(LOST_CODE_SYMBOLS)) hint = hint.replaceAll(symbol, `${lostCodeSymbolName(symbol)} (${lostCodeSymbolLabel(symbol)})`);
  lostCodeHintEl.textContent = hint;
  lostCodeCluesBtn?.classList.remove("hidden");
  renderLostCodeDice(view);
  renderLostCodePlayers(view);
  renderLostCodeLogs(view);
  renderLostCodeTokenStatus(view);
  renderLostCodeGuesses(view);
  renderLostCodeControls(view);
  logGameEvents(data);
}

function lostCodeExplainExempt(target) {
  return !!target.closest("#lostCodeHelpModal, #lostCodeExplainModal, #lostCodeHelpBtn, #lostCodeExplainBtn, #lostCodeCluesCloseBtn");
}

function lostCodeHandleExplain(event) {
  if (currentGameType !== "lost_code") return;
  if (event.type === "click" && lostCodeSuppressExplainClick) {
    lostCodeSuppressExplainClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (event.type === "pointerdown") lostCodeSuppressExplainClick = false;
  if (!lostCodeExplainMode || lostCodeExplainExempt(event.target)) return;
  const target = event.type === "pointerdown"
    ? findLostCodeExplainButtonAtPoint(event.clientX, event.clientY)
    : event.target.closest("[data-lost-code-explain-key]");
  if (target) {
    event.preventDefault();
    event.stopImmediatePropagation();
    lostCodeSuppressExplainClick = event.type === "pointerdown";
    exitLostCodeExplainMode();
    showLostCodeButtonExplanation(target.dataset.lostCodeExplainKey);
  } else if (event.target.closest("button, select, input, summary, a")) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

document.addEventListener("pointerdown", lostCodeHandleExplain, true);
document.addEventListener("click", lostCodeHandleExplain, true);
document.addEventListener("keydown", (event) => {
  if (currentGameType !== "lost_code") return;
  lostCodeSuppressExplainClick = false;
  const openModal = [lostCodeExplainModal, lostCodeHelpModal, lostCodeCluesModal].find((modal) => modal && !modal.classList.contains("hidden"));
  if (event.key === "Escape") {
    event.preventDefault();
    if (openModal === lostCodeCluesModal) setLostCodeCluesOpen(false);
    else if (openModal) lostCodeSetModal(openModal, false);
    else exitLostCodeExplainMode();
    hideLostCodeTooltip();
    return;
  }
  if (event.key === "Tab" && openModal) {
    const focusable = [...openModal.querySelectorAll('button:not(:disabled), select, summary, [tabindex="0"]')].filter((el) => el.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !openModal.contains(document.activeElement))) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !openModal.contains(document.activeElement))) {
      event.preventDefault(); first?.focus();
    }
  }
  if (lostCodeExplainMode && !lostCodeExplainExempt(event.target) && ["Enter", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const target = event.target.closest("[data-lost-code-explain-key]");
    if (target && ["Enter", " "].includes(event.key)) {
      exitLostCodeExplainMode();
      showLostCodeButtonExplanation(target.dataset.lostCodeExplainKey);
    }
  }
}, true);

lostCodeHelpBtn?.addEventListener("click", openLostCodeHelpModal);
lostCodeExplainBtn?.setAttribute("aria-pressed", "false");
lostCodeExplainBtn?.addEventListener("click", toggleLostCodeExplainMode);
lostCodeCluesBtn?.addEventListener("click", () => setLostCodeCluesOpen(true));
document.getElementById("lostCodeCluesCloseBtn")?.addEventListener("click", () => setLostCodeCluesOpen(false));
[[lostCodeHelpModal, lostCodeHelpModalCloseBtn], [lostCodeExplainModal, lostCodeExplainModalCloseBtn], [lostCodeCluesModal, null]].forEach(([modal, close]) => {
  const dismiss = () => modal === lostCodeCluesModal ? setLostCodeCluesOpen(false) : lostCodeSetModal(modal, false);
  close?.addEventListener("click", dismiss);
  modal?.addEventListener("click", (event) => { if (event.target === modal) dismiss(); });
});

lostCodePanelEl?.addEventListener("pointerover", (event) => {
  if (event.pointerType === "touch") return;
  const target = event.target.closest("[data-lost-code-tip]");
  if (target && !target.contains(event.relatedTarget)) showLostCodeTooltip(target);
});
lostCodePanelEl?.addEventListener("pointerout", (event) => {
  if (event.pointerType !== "touch" && event.target.closest("[data-lost-code-tip]") && !event.target.contains(event.relatedTarget)) hideLostCodeTooltip();
});
lostCodePanelEl?.addEventListener("click", (event) => {
  const target = event.target.closest("[data-lost-code-tip]");
  if (target && !target.closest("button, select, summary")) showLostCodeTooltip(target);
  else hideLostCodeTooltip();
});
lostCodePanelEl?.addEventListener("focusin", (event) => {
  if (event.target.dataset.lostCodeTip) showLostCodeTooltip(event.target);
});
lostCodePanelEl?.addEventListener("focusout", hideLostCodeTooltip);
window.addEventListener("scroll", hideLostCodeTooltip, true);
window.addEventListener("resize", () => {
  hideLostCodeTooltip();
  if (window.innerWidth > 680 && lostCodeCluesModal && !lostCodeCluesModal.classList.contains("hidden")) setLostCodeCluesOpen(false);
});

[["lostCodeLogs", "code_clues"], ["lostCodeClueTitle", "code_clues"], ["lostCodeActionTitle", "dice"], ["lostCodeDiscards", "discards"], ["lostCodeTokenStatus", "tokens"], ["lostCodeGuesses", "guesses"]].forEach(([id, key]) => markLostCodeExplainable(document.getElementById(id), key));
[lostCodeModeSelect, lostCodeShortcutToggle, lostCodeCurseToggle].forEach((el) => el?.addEventListener("change", () => {
  if (currentRoomState) renderLostCodeRoomState(currentRoomState);
}));

function initializeLostCodeUI() {
  if (typeof currentRoomState !== "undefined" && currentRoomState) renderLostCodeRoomState(currentRoomState);
  if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "lost_code") renderLostCodeGameState(lastGameStatePayload);
}
window.clearLostCodeState = clearLostCodeState;
window.renderLostCodeGameState = renderLostCodeGameState;
window.renderLostCodeRoomState = renderLostCodeRoomState;
window.updateLostCodeConfigRow = updateLostCodeConfigRow;
window.showLostCodeHeaderActions = showLostCodeHeaderActions;
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeLostCodeUI, { once: true });
else initializeLostCodeUI();
