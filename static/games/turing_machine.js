const TURING_MACHINE_PRESETS = [
  { preset_id: "calibration-easy-01", name: "Calibration 01", difficulty: "easy" },
  { preset_id: "calibration-easy-02", name: "Calibration 02", difficulty: "easy" },
  { preset_id: "calibration-easy-03", name: "Calibration 03", difficulty: "easy" },
  { preset_id: "relay-standard-01", name: "Relay 01", difficulty: "standard" },
  { preset_id: "relay-standard-02", name: "Relay 02", difficulty: "standard" },
  { preset_id: "relay-standard-03", name: "Relay 03", difficulty: "standard" },
  { preset_id: "circuit-hard-01", name: "Circuit 01", difficulty: "hard" },
  { preset_id: "circuit-hard-02", name: "Circuit 02", difficulty: "hard" },
  { preset_id: "circuit-hard-03", name: "Circuit 03", difficulty: "hard" },
  { preset_id: "omega-expert-01", name: "Omega 01", difficulty: "expert" },
  { preset_id: "omega-expert-02", name: "Omega 02", difficulty: "expert" },
  { preset_id: "omega-expert-03", name: "Omega 03", difficulty: "expert" },
];

const TURING_MACHINE_NOTE_CYCLE = ["unknown", "exclude", "keep", "confirm"];
const TURING_MACHINE_NOTE_LABELS = {
  unknown: "·",
  exclude: "✖",
  keep: "○",
  confirm: "★",
};
const TURING_MACHINE_SLOT_INFO = [
  { key: "yellow", label: "🟨 Yellow ▲" },
  { key: "blue", label: "🟦 Blue ■" },
  { key: "purple", label: "🟣 Purple ●" },
];
const TURING_MACHINE_DIFFICULTY_NAMES = {
  easy: "Easy",
  standard: "Standard",
  hard: "Hard",
  expert: "Expert",
};

let currentTuringMachineView = null;
let turingMachineDraftCode = [1, 1, 1];
let turingMachineDeductionExpanded = false;
let turingMachineClueHistoryExpanded = false;
let turingMachineNotesExpanded = false;
let turingMachinePendingAction = null;
let turingMachineTooltipTimer = null;
let turingMachineHelpWidget = null;
let turingMachineExplainWidget = null;
let turingMachineNotebookOpen = false;
let turingMachineTouchStart = null;
let turingMachineTouchMoved = false;

const turingMachineConfigBox = document.getElementById("turingMachineConfigBox");
const turingMachineModeSelect = document.getElementById("turingMachineModeSelect");
const turingMachineSourceSelect = document.getElementById("turingMachineSourceSelect");
const turingMachineDifficultySelect = document.getElementById("turingMachineDifficultySelect");
const turingMachinePresetRow = document.getElementById("turingMachinePresetRow");
const turingMachinePresetSelect = document.getElementById("turingMachinePresetSelect");
const turingMachineSeedRow = document.getElementById("turingMachineSeedRow");
const turingMachineSeedInput = document.getElementById("turingMachineSeedInput");

const turingMachineHeaderActions = document.getElementById("turingMachineHeaderActions");
const turingMachineHelpBtn = document.getElementById("turingMachineHelpBtn");
const turingMachineExplainBtn = document.getElementById("turingMachineExplainBtn");
const turingMachinePanelNode = document.getElementById("turingMachinePanel");
const turingMachineNotebook = document.getElementById("turingMachineNotebook");
const turingMachineNotebookToggle = document.getElementById("turingMachineNotebookToggle");
const turingMachineNotebookClose = document.getElementById("turingMachineNotebookClose");
const turingMachineTooltip = document.getElementById("turingMachineTooltip");
const turingMachineConfirmation = document.getElementById("turingMachineConfirmation");
const turingMachineConfirmationText = document.getElementById("turingMachineConfirmationText");
const turingMachineConfirmBtn = document.getElementById("turingMachineConfirmBtn");
const turingMachineCancelBtn = document.getElementById("turingMachineCancelBtn");

const turingMachinePhaseLabel = document.getElementById("turingMachinePhase");
const turingMachineRoundLabel = document.getElementById("turingMachineRound");
const turingMachineModeLabel = document.getElementById("turingMachineMode");
const turingMachineDifficultyLabel = document.getElementById("turingMachineDifficulty");
const turingMachineScenarioLabel = document.getElementById("turingMachineScenario");
const turingMachineSeedLabel = document.getElementById("turingMachineSeed");
const turingMachineStatusLabel = document.getElementById("turingMachineStatus");
const turingMachineBlockingLabel = document.getElementById("turingMachineBlocking");
const turingMachineWinnersLabel = document.getElementById("turingMachineWinners");
const turingMachineCodeBuilder = document.getElementById("turingMachineCodeBuilder");
const turingMachineCurrentProposal = document.getElementById("turingMachineCurrentProposal");
const turingMachineTestsRemaining = document.getElementById("turingMachineTestsRemaining");
const turingMachineUseCodeBtn = document.getElementById("turingMachineUseCodeBtn");
const turingMachineGuessBtn = document.getElementById("turingMachineGuessBtn");
const turingMachineEndRoundBtn = document.getElementById("turingMachineEndRoundBtn");
const turingMachineGiveUpBtn = document.getElementById("turingMachineGiveUpBtn");
const turingMachineCurrentTests = document.getElementById("turingMachineCurrentTests");
const turingMachineCriteria = document.getElementById("turingMachineCriteria");
const turingMachineDeductionPanel = document.getElementById("turingMachineDeductionPanel");
const turingMachineDeductionToggle = document.getElementById("turingMachineDeductionToggle");
const turingMachineDeductionContent = document.getElementById("turingMachineDeductionContent");
const turingMachineCandidateCount = document.getElementById("turingMachineCandidateCount");
const turingMachineCandidateGrid = document.getElementById("turingMachineCandidateGrid");
const turingMachineDigitStats = document.getElementById("turingMachineDigitStats");
const turingMachineVariantStats = document.getElementById("turingMachineVariantStats");
const turingMachineNotesPanel = document.getElementById("turingMachineNotesPanel");
const turingMachineNotesToggle = document.getElementById("turingMachineNotesToggle");
const turingMachineNotesContent = document.getElementById("turingMachineNotesContent");
const turingMachineNotes = document.getElementById("turingMachineNotes");
const turingMachineClueHistoryPanel = document.getElementById("turingMachineClueHistoryPanel");
const turingMachineClueHistoryToggle = document.getElementById("turingMachineClueHistoryToggle");
const turingMachineClueHistoryContent = document.getElementById("turingMachineClueHistoryContent");
const turingMachineClueHistory = document.getElementById("turingMachineClueHistory");
const turingMachineGuessHistory = document.getElementById("turingMachineGuessHistory");
const turingMachinePublicLog = document.getElementById("turingMachinePublicLog");
const turingMachinePlayers = document.getElementById("turingMachinePlayers");
const turingMachineSolutionRow = document.getElementById("turingMachineSolutionRow");
const turingMachineSolutionLabel = document.getElementById("turingMachineSolution");

const TURING_MACHINE_HELP_CONFIG = {
  gameId: "turing_machine",
  title: { zh: "图灵机 · Turing Machine", en: "Turing Machine" },
  basic: {
    win: { zh: "推导出唯一的三位密码，多人都答对时，验证总次数最少者获胜。", en: "Find the unique three-digit code, with the fewest total verifier checks breaking ties between solvers." },
    turn: { zh: "每轮锁定一个密码，最多验证三张不同的法则卡，完成后点击 Next Round 等待所有仍在解题的玩家。", en: "Lock one code per round, test up to three different verifiers, then choose Next Round and wait for all active players." },
    key: { zh: "对照法则卡的不同条件排除不可能的密码，绿色勾号只代表符合一条隐藏条件，而不是猜中了答案。", en: "Compare each card’s possible rules to eliminate codes, remembering that a green check confirms one hidden rule, not the final answer." }
  },
  sections: [
    { id: "verifiers", label: { zh: "密码与验证", en: "Codes & verifiers" }, html: {
      zh: "<p>密码按黄色三角形(🟨 ▲)、蓝色方形(🟦 ■)、紫色圆形(🟣 ●)排列，每位数字都是 1 到 5，共有 125 种组合。点击数字设置草稿，再用 Lock code 锁定本轮密码。锁定后，草稿仍可用于最终猜测，不会改变本轮验证密码。</p><p>每张法则卡会秘密选定 A、B、C 等选项中的一条条件。点击 Test，以本轮锁定的密码验证该卡。符合(✔)与不符合(✖)只针对这条隐藏条件，每轮最多验证三张不同的卡。点击没有操作功能的条件可查看完整解释。</p>",
      en: "<p>Read the code as Yellow triangle(🟨 ▲), Blue square(🟦 ■), Purple circle(🟣 ●). Every digit is 1 to 5, giving 125 possible codes. Select digits and choose Lock code. Changing the draft afterward only changes a potential final guess, not the locked round code.</p><p>Each verifier secretly selects one of its listed rules A, B, C and so on. Test checks the locked round code against that hidden rule. Pass(✔) and fail(✖) refer to this rule alone. You may test up to three different cards per round. Tap passive rule text for its full meaning.</p>"
    } },
    { id: "notebook", label: { zh: "笔记与辅助", en: "Notebook" }, html: {
      zh: "<p>桌面端笔记位于主板右侧，手机端用 Notebook 打开，用 Dock 或 Escape 收起。数字笔记依次循环：未知(·)、排除(✖)、保留(○)、确认(★)。法则笔记可选择你认为正确的完整条件，或选择 Uncertain。笔记仅自己可见并保存在房间中。</p><p>Simple 模式额外提供候选密码、各数字出现次数和法则可能性，展开 Auto deduction 查看。Expert 模式不显示自动推理。验证历史按回合和密码归组，长列表可在内部滚动。悬停或轻触非操作性信息查看提示，手机提示三秒后消失。</p>",
      en: "<p>The notebook sits beside the board on desktop. On mobile, open Notebook and use Dock or Escape to close it. Digit notes cycle through unknown(·), exclude(✖), keep(○), and confirm(★). Verifier notes let you select a full rule or Uncertain. Notes are private and saved in the room.</p><p>Simple mode adds candidate codes, digit frequencies and possible hidden rules under Auto deduction. Expert mode has manual notes only. Verifier history groups checks by round and code. Long lists scroll internally. Hover or tap passive information for a tip that disappears after three seconds on mobile.</p>"
    } },
    { id: "finish", label: { zh: "轮次与胜负", en: "Rounds & results" }, html: {
      zh: "<p>点击 Next Round 表示本轮已完成，所有仍在解题的玩家都确认后才进入下一轮。不需要额外确认。已答对、淘汰或放弃的玩家不会阻挡进度。</p><p>任何时候都可用 Final guess 提交当前草稿。原地确认会显示将提交的密码，猜错立即出局。猜对后记录验证总次数，其他玩家继续解题或放弃。所有人结束后，验证总次数最少的答对者获胜，相同则共享胜利。终局保留答案、玩家验证次数、完成轮次以及答对时的统计。</p><p>模式、难度与固定关卡或随机种子仅在 Room 开局前选择。Puzzle details 可查看并分享本局种子。Help 提供双语分页，Explain 会解释卡片当前条件和灰色按钮，但不会执行操作。Escape 可关闭窗口、取消确认或退出解释。</p>",
      en: "<p>Next Round marks you ready to advance. Play pauses until every still-active solver has chosen it, with no extra confirmation. Solved, eliminated and conceded players do not block the next round.</p><p>Use Final guess at any time to submit your draft. An inline confirmation shows the exact code. A wrong guess eliminates you immediately. A correct guess records your total checks while others continue or concede. Once everyone finishes, the solver with the fewest checks wins. Ties share victory. The final board keeps the solution, each player’s checks, completed rounds and solve statistics visible.</p><p>Choose assist mode, difficulty, presets or a random seed in Room before starting. Puzzle details keeps the share seed available. Help has bilingual tabs. Explain describes the actual card rules and disabled buttons without running actions. Escape closes dialogs, cancels confirmation or exits Explain.</p>"
    } }
  ]
};

const TURING_MACHINE_EXPLANATIONS = {
  console: { zh: "按黄色三角形(🟨 ▲)、蓝色方形(🟦 ■)、紫色圆形(🟣 ●)选择 1 到 5 的数字。草稿可以更改，本轮验证始终使用已锁定的密码。", en: "Choose digits 1 to 5 for Yellow triangle(🟨 ▲), Blue square(🟦 ■), Purple circle(🟣 ●). The draft is editable, but tests always use the locked round code." },
  lock: { zh: "将草稿锁定为本轮唯一的验证密码，锁定后本轮不可更改。", en: "Lock this draft as the round’s only test code. It cannot be replaced during this round." },
  guess: { zh: "用草稿提交最终答案，原地确认后才会发送。猜错立即出局。", en: "Submit the draft as your final answer after inline confirmation. A wrong answer immediately eliminates you." },
  next: { zh: "完成本轮并等待。所有仍在解题的玩家点击 Next Round 后才会继续。", en: "Finish this round and wait. The next round begins only when every active solver chooses Next Round." },
  give_up: { zh: "放弃本局解题，原地确认后退出竞争，其他玩家仍可继续。", en: "Concede after inline confirmation. Other players may continue solving." },
  code_digit: { zh: "设置草稿的一位数字，不会改变已经锁定的本轮密码。", en: "Set one draft digit without changing the already locked round code." },
  test_card: { zh: "用本轮锁定密码验证这张卡的隐藏条件。每轮最多验证三张不同的卡。", en: "Test the locked code against this card’s hidden rule. You may check up to three different cards per round." },
  note_chip: { zh: "循环标记：未知(·)、排除(✖)、保留(○)、确认(★)。标记是私人笔记，不会自动排除候选。", en: "Cycle through unknown(·), exclude(✖), keep(○), confirm(★). These private notes do not automatically filter candidates." },
  verifier_note_select: { zh: "选择你认为正确的完整条件，或 Uncertain。这是私人记录，不是服务器给出的答案。", en: "Select the full rule you believe is true, or Uncertain. This is your private note, not a revealed answer." }
};

function describeTuringMachineNode(node, key, description, passive = true) {
  if (description) TURING_MACHINE_EXPLANATIONS[key] = { zh: description, en: description };
  node.dataset.turingMachineExplain = key;
  if (passive) {
    node.dataset.turingMachineTip = key;
    node.tabIndex = 0;
  }
}

function hideTuringMachineTooltip() {
  clearTimeout(turingMachineTooltipTimer);
  turingMachineTooltip?.classList.add("hidden");
}

function showTuringMachineTooltip(node) {
  if (!node || !turingMachineTooltip || turingMachineExplainWidget?.isActive() || turingMachineHelpWidget?.isOpen()) return;
  const entry = TURING_MACHINE_EXPLANATIONS[node.dataset.turingMachineTip];
  if (!entry) return;
  turingMachineTooltip.textContent = entry[window.obgHelpLang?.() === "en" ? "en" : "zh"];
  turingMachineTooltip.classList.remove("hidden");
  const bounds = node.getBoundingClientRect();
  turingMachineTooltip.style.left = Math.max(12, Math.min(bounds.left, innerWidth - turingMachineTooltip.offsetWidth - 12)) + "px";
  turingMachineTooltip.style.top = Math.max(12, Math.min(bounds.bottom + 6, innerHeight - turingMachineTooltip.offsetHeight - 12)) + "px";
  clearTimeout(turingMachineTooltipTimer);
  turingMachineTooltipTimer = setTimeout(hideTuringMachineTooltip, 3000);
}

function syncTuringMachineNotebook() {
  const mobile = window.matchMedia("(max-width: 760px)").matches;
  turingMachineNotebook?.classList.toggle("is-open", turingMachineNotebookOpen);
  turingMachineNotebook?.setAttribute("aria-hidden", String(mobile && !turingMachineNotebookOpen));
  turingMachineNotebookToggle?.setAttribute("aria-expanded", String(!mobile || turingMachineNotebookOpen));
}

function setTuringMachineNotebook(open) {
  turingMachineNotebookOpen = open;
  syncTuringMachineNotebook();
  hideTuringMachineTooltip();
  if (open) turingMachineNotebookClose?.focus();
  else if (window.matchMedia("(max-width: 760px)").matches) turingMachineNotebookToggle?.focus();
}

function cancelTuringMachineConfirmation() {
  turingMachinePendingAction = null;
  turingMachineConfirmation?.classList.add("hidden");
  turingMachineConfirmation?.setAttribute("aria-hidden", "true");
}

function confirmTuringMachineAction(type) {
  if (!turingMachineCan(currentTuringMachineView, type)) return;
  const anchor = type === "give_up" ? turingMachineGiveUpBtn.closest(".tm-bottom-bar") : turingMachineGuessBtn.closest(".tm-console-footer");
  anchor.after(turingMachineConfirmation);
  turingMachinePendingAction = { type };
  if (type === "submit_guess") turingMachinePendingAction.code = turingMachineDraftCode.slice();
  turingMachineConfirmationText.textContent = type === "submit_guess"
    ? "Submit " + turingMachineCodeLabel(turingMachinePendingAction.code) + "? A wrong guess eliminates you."
    : "Give up this puzzle? You will leave the competition.";
  turingMachineConfirmation.classList.remove("hidden");
  turingMachineConfirmation.setAttribute("aria-hidden", "false");
  turingMachineConfirmation.scrollIntoView({ block: "nearest", behavior: "auto" });
  turingMachineCancelBtn.focus({ preventScroll: true });
}

function turingMachineCan(view, action) {
  return Array.isArray(view && view.legal_actions) && view.legal_actions.includes(action);
}

function turingMachineCodeLabel(code) {
  if (!Array.isArray(code) || code.length !== 3) {
    return "—";
  }
  return `🟨${code[0]} · 🟦${code[1]} · 🟣${code[2]}`;
}

function turingMachineVariantText(card, variant) {
  const label = String((variant || {}).label || "").trim();
  const description = String((variant || {}).description || "").trim();
  const hasSharedContext = !!String((card || {}).prompt || (card || {}).title || "").trim();
  if (hasSharedContext && label && label.length <= 32) {
    return label;
  }
  return description || label || "—";
}

function setTuringMachineCollapsibleExpanded(panel, toggle, content, expanded) {
  const isExpanded = !!expanded;
  if (panel) {
    panel.classList.toggle("is-expanded", isExpanded);
  }
  if (toggle) {
    toggle.setAttribute("aria-expanded", isExpanded.toString());
    const icon = toggle.querySelector(".tm-section-toggle-icon");
    if (icon) icon.textContent = isExpanded ? "⌃" : "⌄";
  }
  if (content) {
    content.classList.toggle("hidden", !isExpanded);
    content.setAttribute("aria-hidden", (!isExpanded).toString());
  }
}

function setTuringMachineDeductionExpanded(expanded) {
  turingMachineDeductionExpanded = !!expanded;
  setTuringMachineCollapsibleExpanded(
    turingMachineDeductionPanel,
    turingMachineDeductionToggle,
    turingMachineDeductionContent,
    turingMachineDeductionExpanded,
  );
}

function setTuringMachineClueHistoryExpanded(expanded) {
  turingMachineClueHistoryExpanded = !!expanded;
  setTuringMachineCollapsibleExpanded(
    turingMachineClueHistoryPanel,
    turingMachineClueHistoryToggle,
    turingMachineClueHistoryContent,
    turingMachineClueHistoryExpanded,
  );
}

function setTuringMachineNotesExpanded(expanded) {
  turingMachineNotesExpanded = !!expanded;
  setTuringMachineCollapsibleExpanded(
    turingMachineNotesPanel,
    turingMachineNotesToggle,
    turingMachineNotesContent,
    turingMachineNotesExpanded,
  );
}

function turingMachineCloneNotes(notes) {
  return JSON.parse(JSON.stringify(notes || {}));
}

function turingMachineNextMark(mark) {
  const index = TURING_MACHINE_NOTE_CYCLE.indexOf(mark);
  return TURING_MACHINE_NOTE_CYCLE[(index + 1 + TURING_MACHINE_NOTE_CYCLE.length) % TURING_MACHINE_NOTE_CYCLE.length];
}

function populateTuringMachinePresetSelect() {
  if (!turingMachinePresetSelect) {
    return;
  }
  const difficulty = turingMachineDifficultySelect ? turingMachineDifficultySelect.value || "standard" : "standard";
  const previous = turingMachinePresetSelect.value;
  turingMachinePresetSelect.innerHTML = "";
  const options = TURING_MACHINE_PRESETS.filter((preset) => preset.difficulty === difficulty);
  options.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.preset_id;
    option.textContent = preset.name;
    turingMachinePresetSelect.appendChild(option);
  });
  if (options.some((preset) => preset.preset_id === previous)) {
    turingMachinePresetSelect.value = previous;
  } else if (options.length) {
    turingMachinePresetSelect.value = options[0].preset_id;
  }
}

function updateTuringMachineConfigRowsFromSource() {
  const source = turingMachineSourceSelect ? turingMachineSourceSelect.value || "random" : "random";
  const showPreset = source === "preset";
  const showSeed = source === "random";
  if (turingMachinePresetRow) {
    turingMachinePresetRow.classList.toggle("hidden", !showPreset);
    turingMachinePresetRow.setAttribute("aria-hidden", (!showPreset).toString());
  }
  if (turingMachineSeedRow) {
    turingMachineSeedRow.classList.toggle("hidden", !showSeed);
    turingMachineSeedRow.setAttribute("aria-hidden", (!showSeed).toString());
  }
}

function updateTuringMachineConfigRow() {
  const showRow = currentRoomState && currentGameType === "turing_machine" && currentRoomState.status === "lobby";
  if (turingMachineConfigBox) {
    turingMachineConfigBox.classList.toggle("hidden", !showRow);
    turingMachineConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (showRow) {
    populateTuringMachinePresetSelect();
    updateTuringMachineConfigRowsFromSource();
  }
}

function clearTuringMachineState() {
  cancelTuringMachineConfirmation();
  hideTuringMachineTooltip();
  turingMachineNotebookOpen = false;
  syncTuringMachineNotebook();
  currentTuringMachineView = null;
  turingMachineDraftCode = [1, 1, 1];
  setTuringMachineDeductionExpanded(false);
  setTuringMachineClueHistoryExpanded(false);
  setTuringMachineNotesExpanded(false);
  if (turingMachinePhaseLabel) turingMachinePhaseLabel.textContent = "-";
  if (turingMachineRoundLabel) turingMachineRoundLabel.textContent = "-";
  if (turingMachineModeLabel) turingMachineModeLabel.textContent = "-";
  if (turingMachineDifficultyLabel) turingMachineDifficultyLabel.textContent = "-";
  if (turingMachineScenarioLabel) turingMachineScenarioLabel.textContent = "-";
  if (turingMachineSeedLabel) turingMachineSeedLabel.textContent = "-";
  if (turingMachineStatusLabel) turingMachineStatusLabel.textContent = "-";
  if (turingMachineBlockingLabel) turingMachineBlockingLabel.textContent = "-";
  if (turingMachineWinnersLabel) turingMachineWinnersLabel.textContent = "-";
  if (turingMachineCurrentProposal) turingMachineCurrentProposal.textContent = "-";
  if (turingMachineTestsRemaining) turingMachineTestsRemaining.textContent = "-";
  if (turingMachineCodeBuilder) turingMachineCodeBuilder.innerHTML = "";
  if (turingMachineCurrentTests) turingMachineCurrentTests.innerHTML = "";
  if (turingMachineCriteria) turingMachineCriteria.innerHTML = "";
  if (turingMachineCandidateCount) turingMachineCandidateCount.textContent = "-";
  if (turingMachineCandidateGrid) turingMachineCandidateGrid.innerHTML = "";
  if (turingMachineDigitStats) turingMachineDigitStats.innerHTML = "";
  if (turingMachineVariantStats) turingMachineVariantStats.innerHTML = "";
  if (turingMachineNotes) turingMachineNotes.innerHTML = "";
  if (turingMachineClueHistory) turingMachineClueHistory.innerHTML = "";
  if (turingMachineGuessHistory) turingMachineGuessHistory.innerHTML = "";
  if (turingMachinePublicLog) turingMachinePublicLog.innerHTML = "";
  if (turingMachinePlayers) turingMachinePlayers.innerHTML = "";
  if (turingMachineSolutionLabel) turingMachineSolutionLabel.textContent = "-";
  if (turingMachineSolutionRow) {
    turingMachineSolutionRow.classList.add("hidden");
    turingMachineSolutionRow.setAttribute("aria-hidden", "true");
  }
  if (turingMachineHelpModal) setModalVisible(turingMachineHelpModal, false);
  if (turingMachineExplainModal) setModalVisible(turingMachineExplainModal, false);
  exitTuringMachineExplainMode();
}

function renderTuringMachineCodeBuilder(view) {
  if (!turingMachineCodeBuilder) {
    return;
  }
  turingMachineCodeBuilder.innerHTML = "";
  TURING_MACHINE_SLOT_INFO.forEach((slotInfo, slotIndex) => {
    const column = document.createElement("div");
    column.className = "tm-code-column";
    column.dataset.slot = slotInfo.key;
    const title = document.createElement("div");
    title.className = "tm-code-column-title";
    title.textContent = slotInfo.label;
    describeTuringMachineNode(title, `digit_${slotInfo.key}`, `${slotInfo.label}: select a digit from 1 to 5. Color and shape identify this position in every code.`);
    column.appendChild(title);
    const buttons = document.createElement("div");
    buttons.className = "tm-code-buttons";
    for (let value = 1; value <= 5; value += 1) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tm-code-btn";
      if (turingMachineDraftCode[slotIndex] === value) {
        btn.classList.add("active");
      }
      btn.dataset.turingMachineExplain = "code_digit";
      btn.textContent = String(value);
      btn.setAttribute("aria-label", `${slotInfo.label}: ${value}`);
      btn.setAttribute("aria-pressed", String(turingMachineDraftCode[slotIndex] === value));
      btn.addEventListener("click", () => {
        cancelTuringMachineConfirmation();
        turingMachineDraftCode[slotIndex] = value;
        buttons.querySelectorAll("button").forEach((button) => {
          const selected = button === btn;
          button.classList.toggle("active", selected);
          button.setAttribute("aria-pressed", String(selected));
        });
      });
      buttons.appendChild(btn);
    }
    column.appendChild(buttons);
    turingMachineCodeBuilder.appendChild(column);
  });
}

function renderTuringMachineCurrentTests(view) {
  if (!turingMachineCurrentTests) {
    return;
  }
  turingMachineCurrentTests.innerHTML = "";
  const tests = (((view || {}).current_round || {}).tests) || [];
  if (!tests.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No verifier checks this round.";
    turingMachineCurrentTests.appendChild(empty);
    return;
  }
  tests.forEach((test) => {
    const chip = document.createElement("div");
    chip.className = `tm-test-chip ${test.result ? "is-pass" : "is-fail"}`;
    chip.textContent = `${test.slot}: ${turingMachineCodeLabel(test.proposal)} ${test.result ? "✔" : "✖"}`;
    describeTuringMachineNode(chip, `test_${test.slot}`, `Verifier ${test.slot}: ${test.result ? "✔ Pass" : "✖ Fail"}. Code ${turingMachineCodeLabel(test.proposal)} in Yellow triangle, Blue square, Purple circle order. A pass confirms only this verifier’s hidden rule.`);
    turingMachineCurrentTests.appendChild(chip);
  });
}

function renderTuringMachineCriteria(view) {
  if (!turingMachineCriteria) {
    return;
  }
  turingMachineCriteria.innerHTML = "";
  const cards = Array.isArray(view.criteria_cards) ? view.criteria_cards : [];
  if (!cards.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No verifier cards.";
    turingMachineCriteria.appendChild(empty);
    return;
  }
  const canTest = turingMachineCan(view, "test_criterion");
  cards.forEach((card) => {
    const wrap = document.createElement("div");
    wrap.className = "tm-verifier-card";

    const slot = document.createElement("div");
    slot.className = "tm-verifier-slot";
    slot.textContent = `Verifier ${card.slot}`;
    describeTuringMachineNode(slot, `card_${card.slot}`, `${card.title}. ${card.prompt} ${card.variants.map((variant) => `${variant.variant_id}: ${variant.description || variant.label}`).join(". ")}`);
    wrap.appendChild(slot);

    const title = document.createElement("div");
    title.className = "tm-verifier-title";
    title.textContent = card.title || "-";
    wrap.appendChild(title);

    const prompt = document.createElement("div");
    prompt.className = "tm-verifier-prompt";
    prompt.textContent = card.prompt || "-";
    wrap.appendChild(prompt);

    const variantList = document.createElement("div");
    variantList.className = "tm-verifier-variants";
    variantList.setAttribute("role", "list");
    const variants = Array.isArray(card.variants) ? card.variants : [];
    variants.forEach((variant) => {
      const row = document.createElement("div");
      row.className = "tm-verifier-variant";
      row.setAttribute("role", "listitem");
      const compactText = turingMachineVariantText(card, variant);
      const description = String(variant.description || "").trim();
      row.setAttribute("aria-label", `${variant.variant_id}: ${description || compactText}`);
      describeTuringMachineNode(row, `variant_${card.slot}_${variant.variant_id}`, `${card.title}. ${variant.variant_id}: ${description || compactText}`);
      const variantId = document.createElement("span");
      variantId.className = "tm-verifier-variant-id";
      variantId.textContent = variant.variant_id;
      row.appendChild(variantId);
      const variantLabel = document.createElement("span");
      variantLabel.className = "tm-verifier-variant-label";
      variantLabel.textContent = compactText;
      row.appendChild(variantLabel);
      variantList.appendChild(row);
    });
    wrap.appendChild(variantList);

    const footer = document.createElement("div");
    footer.className = "tm-verifier-footer";
    const result = document.createElement("div");
    result.className = `tm-verifier-result ${card.last_result === true ? "is-pass" : card.last_result === false ? "is-fail" : ""}`;
    if (card.last_result === true) {
      result.textContent = "This round: ✔";
    } else if (card.last_result === false) {
      result.textContent = "This round: ✖";
    } else {
      result.textContent = "This round: —";
    }
    describeTuringMachineNode(result, `result_${card.slot}`, `Verifier ${card.slot}: ${card.last_result === true ? "✔ Pass. The locked code matches this verifier’s hidden rule, not necessarily the solution." : card.last_result === false ? "✖ Fail. The locked code does not match this verifier’s hidden rule." : "Not tested this round."}`);
    footer.appendChild(result);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = card.tested_this_round ? "Checked" : "Test";
    btn.disabled = !canTest || card.tested_this_round;
    btn.dataset.turingMachineExplain = "test_card";
    btn.setAttribute("aria-label", `Test verifier ${card.slot}`);
    btn.addEventListener("click", () => {
      sendAction({ type: "test_criterion", slot: card.slot });
    });
    footer.appendChild(btn);
    wrap.appendChild(footer);
    turingMachineCriteria.appendChild(wrap);
  });
}

function renderTuringMachineDeduction(view) {
  if (!turingMachineDeductionPanel || !turingMachineDeductionContent || !turingMachineCandidateCount || !turingMachineCandidateGrid || !turingMachineDigitStats || !turingMachineVariantStats) {
    return;
  }
  const deduction = view.deduction;
  const show = !!deduction;
  turingMachineDeductionPanel.classList.toggle("hidden", !show);
  turingMachineDeductionPanel.setAttribute("aria-hidden", (!show).toString());
  if (!show) {
    setTuringMachineDeductionExpanded(false);
    turingMachineCandidateCount.textContent = "-";
    turingMachineCandidateGrid.innerHTML = "";
    turingMachineDigitStats.innerHTML = "";
    turingMachineVariantStats.innerHTML = "";
    return;
  }

  setTuringMachineDeductionExpanded(turingMachineDeductionExpanded);

  turingMachineCandidateCount.textContent = String(deduction.candidate_count ?? 0);
  turingMachineCandidateGrid.innerHTML = "";
  const candidates = Array.isArray(deduction.candidates) ? deduction.candidates : [];
  if (!candidates.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No candidate codes remain.";
    turingMachineCandidateGrid.appendChild(empty);
  } else {
    candidates.forEach((candidate) => {
      const chip = document.createElement("div");
      chip.className = "tm-candidate-chip";
      chip.textContent = turingMachineCodeLabel(candidate);
      describeTuringMachineNode(chip, "candidate_code", "A code still compatible with your verifier results. Order: Yellow triangle(🟨 ▲), Blue square(🟦 ■), Purple circle(🟣 ●).");
      turingMachineCandidateGrid.appendChild(chip);
    });
  }

  turingMachineDigitStats.innerHTML = "";
  const digitStats = deduction.slot_digit_counts || {};
  TURING_MACHINE_SLOT_INFO.forEach((slotInfo) => {
    const card = document.createElement("div");
    card.className = "tm-stat-card";
    const title = document.createElement("div");
    title.className = "tm-stat-title";
    title.textContent = slotInfo.label;
    card.appendChild(title);
    const values = document.createElement("div");
    values.className = "tm-stat-values";
    (digitStats[slotInfo.key] || []).forEach((entry) => {
      const chip = document.createElement("div");
      chip.className = "tm-stat-chip";
      chip.textContent = `${entry.value}: ${entry.count}`;
      describeTuringMachineNode(chip, `digit_count_${slotInfo.key}_${entry.value}`, `${slotInfo.label}: ${entry.count} remaining candidate codes have digit ${entry.value} at this position.`);
      values.appendChild(chip);
    });
    card.appendChild(values);
    turingMachineDigitStats.appendChild(card);
  });

  turingMachineVariantStats.innerHTML = "";
  const variantStats = Array.isArray(deduction.variant_stats) ? deduction.variant_stats : [];
  variantStats.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "tm-stat-card";
    const title = document.createElement("div");
    title.className = "tm-stat-title";
    title.textContent = `Verifier ${entry.slot}`;
    card.appendChild(title);
    const values = document.createElement("div");
    values.className = "tm-stat-values";
    (entry.options || []).forEach((option) => {
      const chip = document.createElement("div");
      chip.className = `tm-stat-chip ${option.status || ""}`;
      chip.textContent = `${option.variant_id}: ${option.count}`;
      describeTuringMachineNode(chip, `variant_count_${entry.slot}_${option.variant_id}`, `Verifier ${entry.slot}, option ${option.variant_id}: ${option.count} remaining codes. Status: ${option.status || "possible"}.`);
      values.appendChild(chip);
    });
    card.appendChild(values);
    turingMachineVariantStats.appendChild(card);
  });
}

function renderTuringMachineNotes(view) {
  if (!turingMachineNotes) {
    return;
  }
  const notes = view.notes || {};
  const digitMarks = notes.digit_marks || {};
  const variantMarks = notes.variant_marks || {};
  const signature = JSON.stringify((view.criteria_cards || []).map((card) => [card.slot, card.variants]));
  if (turingMachineNotes.dataset.signature === signature && turingMachineNotes.childElementCount) {
    TURING_MACHINE_SLOT_INFO.forEach((slotInfo) => {
      const marks = digitMarks[slotInfo.key] || [];
      marks.forEach((mark, index) => {
        const button = turingMachineNotes.querySelector(`[data-turing-machine-focus="${slotInfo.key}_${index}"]`);
        if (!button) return;
        button.className = `tm-note-chip is-${mark}`;
        button.textContent = `${index + 1} ${TURING_MACHINE_NOTE_LABELS[mark] || "·"}`;
        button.setAttribute("aria-label", `${slotInfo.label} ${index + 1}: ${mark}`);
      });
    });
    (view.criteria_cards || []).forEach((card) => {
      const select = document.getElementById(`turingMachineVerifierNote${card.slot}`);
      const marks = variantMarks[card.slot] || [];
      let selected = marks.indexOf("confirm");
      if (selected < 0 && marks.filter((mark) => mark === "keep").length === 1) selected = marks.indexOf("keep");
      select.value = selected >= 0 ? String(selected) : "";
      select.classList.toggle("has-selection", select.value !== "");
    });
    return;
  }
  turingMachineNotes.innerHTML = "";
  turingMachineNotes.dataset.signature = signature;

  const digitSection = document.createElement("div");
  digitSection.className = "tm-notes-section";
  const digitTitle = document.createElement("div");
  digitTitle.className = "tm-notes-title";
  digitTitle.textContent = "Digit Notes";
  digitSection.appendChild(digitTitle);

  TURING_MACHINE_SLOT_INFO.forEach((slotInfo) => {
    const row = document.createElement("div");
    row.className = "tm-note-row";
    const label = document.createElement("div");
    label.className = "tm-note-label";
    label.textContent = slotInfo.label;
    describeTuringMachineNode(label, `digit_${slotInfo.key}`, `${slotInfo.label}: this color and shape identify the digit’s position in the code.`);
    row.appendChild(label);

    const marksWrap = document.createElement("div");
    marksWrap.className = "tm-note-chip-row";
    const marks = Array.isArray(digitMarks[slotInfo.key]) ? digitMarks[slotInfo.key] : ["unknown", "unknown", "unknown", "unknown", "unknown"];
    marks.forEach((mark, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `tm-note-chip is-${mark}`;
      btn.dataset.turingMachineExplain = "note_chip";
      btn.textContent = `${index + 1} ${TURING_MACHINE_NOTE_LABELS[mark] || "·"}`;
      btn.setAttribute("aria-label", `${slotInfo.label} ${index + 1}: ${mark}`);
      btn.dataset.turingMachineFocus = `${slotInfo.key}_${index}`;
      btn.addEventListener("click", () => {
        const nextNotes = turingMachineCloneNotes(currentTuringMachineView?.notes);
        nextNotes.digit_marks = nextNotes.digit_marks || {};
        const currentMarks = nextNotes.digit_marks[slotInfo.key] || Array(5).fill("unknown");
        nextNotes.digit_marks[slotInfo.key] = currentMarks;
        currentMarks[index] = turingMachineNextMark(currentMarks[index]);
        sendAction({ type: "update_notes", notes: nextNotes });
      });
      marksWrap.appendChild(btn);
    });
    row.appendChild(marksWrap);
    digitSection.appendChild(row);
  });
  turingMachineNotes.appendChild(digitSection);

  const variantSection = document.createElement("div");
  variantSection.className = "tm-notes-section";
  const variantTitle = document.createElement("div");
  variantTitle.className = "tm-notes-title";
  variantTitle.textContent = "Verifier Notes";
  variantSection.appendChild(variantTitle);

  const cards = Array.isArray(view.criteria_cards) ? view.criteria_cards : [];
  cards.forEach((card) => {
    const row = document.createElement("div");
    row.className = "tm-note-row tm-verifier-note-row";
    const label = document.createElement("label");
    label.className = "tm-note-label";
    label.textContent = `Verifier ${card.slot}`;
    const selectId = `turingMachineVerifierNote${card.slot}`;
    label.htmlFor = selectId;
    row.appendChild(label);

    const variants = Array.isArray(card.variants) ? card.variants : [];
    const marks = Array.isArray(variantMarks[card.slot]) ? variantMarks[card.slot] : variants.map(() => "unknown");
    let selectedIndex = marks.findIndex((mark) => mark === "confirm");
    if (selectedIndex < 0) {
      const possibleIndexes = marks
        .map((mark, index) => (mark === "keep" ? index : -1))
        .filter((index) => index >= 0);
      if (possibleIndexes.length === 1) {
        [selectedIndex] = possibleIndexes;
      }
    }

    const select = document.createElement("select");
    select.id = selectId;
    select.className = "tm-verifier-note-select";
    select.dataset.turingMachineExplain = "verifier_note_select";
    select.setAttribute("aria-label", `Verifier ${card.slot} note`);

    const uncertainOption = document.createElement("option");
    uncertainOption.value = "";
    uncertainOption.textContent = "Uncertain";
    select.appendChild(uncertainOption);

    variants.forEach((variant, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      const description = String(variant.description || variant.label || "—").trim();
      option.textContent = `${variant.variant_id} · ${description}`;
      select.appendChild(option);
    });

    select.value = selectedIndex >= 0 && selectedIndex < variants.length ? String(selectedIndex) : "";
    select.classList.toggle("has-selection", select.value !== "");
    select.addEventListener("change", () => {
      const nextNotes = turingMachineCloneNotes(currentTuringMachineView?.notes);
      if (!nextNotes.variant_marks || typeof nextNotes.variant_marks !== "object") {
        nextNotes.variant_marks = {};
      }
      const nextIndex = Number.parseInt(select.value, 10);
      const hasSelection = Number.isInteger(nextIndex) && nextIndex >= 0 && nextIndex < variants.length;
      nextNotes.variant_marks[card.slot] = variants.map((_, index) => {
        if (!hasSelection) {
          return "unknown";
        }
        return index === nextIndex ? "confirm" : "exclude";
      });
      sendAction({ type: "update_notes", notes: nextNotes });
    });
    row.appendChild(select);
    variantSection.appendChild(row);
  });
  turingMachineNotes.appendChild(variantSection);
}

function renderTuringMachineClueHistory(view) {
  if (!turingMachineClueHistory) {
    return;
  }
  turingMachineClueHistory.innerHTML = "";
  const clues = Array.isArray(view.clue_history) ? view.clue_history : [];
  if (!clues.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No verifier history yet.";
    turingMachineClueHistory.appendChild(empty);
    return;
  }
  const groups = [];
  const groupsByRoundCode = new Map();
  clues.forEach((clue) => {
    const round = clue.round ?? "?";
    const code = turingMachineCodeLabel(clue.proposal);
    const key = `${round}|${code}`;
    if (!groupsByRoundCode.has(key)) {
      const group = { round, code, clues: [] };
      groupsByRoundCode.set(key, group);
      groups.push(group);
    }
    groupsByRoundCode.get(key).clues.push(clue);
  });

  groups.forEach((group) => {
    const wrap = document.createElement("section");
    wrap.className = "tm-history-group";

    const header = document.createElement("div");
    header.className = "tm-history-group-header";
    const roundLabel = document.createElement("span");
    roundLabel.className = "tm-history-round";
    roundLabel.textContent = `Round ${group.round}`;
    header.appendChild(roundLabel);
    const codeLabel = document.createElement("span");
    codeLabel.className = "tm-history-code";
    codeLabel.textContent = group.code;
    describeTuringMachineNode(codeLabel, "history_code", "The code tested in this round, in Yellow triangle(🟨 ▲), Blue square(🟦 ■), Purple circle(🟣 ●) order.");
    header.appendChild(codeLabel);
    wrap.appendChild(header);

    const checks = document.createElement("div");
    checks.className = "tm-history-checks";
    group.clues.forEach((clue) => {
      const check = document.createElement("div");
      check.className = `tm-history-check ${clue.result ? "is-pass" : "is-fail"}`;
      check.textContent = `Verifier ${clue.slot} ${clue.result ? "✔" : "✖"}`;
      describeTuringMachineNode(check, `history_${group.round}_${clue.slot}`, `Verifier ${clue.slot} ${clue.result ? "✔ Pass: this tested code matched the hidden rule." : "✖ Fail: this tested code did not match the hidden rule."}`);
      checks.appendChild(check);
    });
    wrap.appendChild(checks);
    turingMachineClueHistory.appendChild(wrap);
  });
}

function renderTuringMachineGuessHistory(view) {
  if (!turingMachineGuessHistory) {
    return;
  }
  turingMachineGuessHistory.innerHTML = "";
  const guesses = Array.isArray(view.guess_history) ? view.guess_history : [];
  if (!guesses.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No final guesses yet.";
    turingMachineGuessHistory.appendChild(empty);
    return;
  }
  guesses.forEach((guess) => {
    const row = document.createElement("div");
    row.className = `tm-history-row ${guess.correct ? "is-pass" : "is-fail"}`;
    row.textContent = `R${guess.round} · ${turingMachineCodeLabel(guess.guess)} · ${guess.correct ? "Correct" : "Wrong"}`;
    describeTuringMachineNode(row, `guess_${guess.round}`, `Final guess in round ${guess.round}, Yellow triangle(🟨 ▲), Blue square(🟦 ■), Purple circle(🟣 ●) order. ${guess.correct ? "Correct: your check count is locked in." : "Wrong: you are eliminated."}`);
    turingMachineGuessHistory.appendChild(row);
  });
}

function renderTuringMachinePublicLog(view) {
  if (!turingMachinePublicLog) {
    return;
  }
  turingMachinePublicLog.innerHTML = "";
  const entries = Array.isArray(view.public_log) ? view.public_log : [];
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No public events yet.";
    turingMachinePublicLog.appendChild(empty);
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "tm-history-row";
    row.textContent = entry.message || entry.type || "-";
    turingMachinePublicLog.appendChild(row);
  });
}

function renderTuringMachinePlayers(view) {
  if (!turingMachinePlayers) {
    return;
  }
  turingMachinePlayers.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  players.forEach((player) => {
    const card = document.createElement("div");
    card.className = `tm-player-card status-${player.status || "unknown"}`;
    if (player.you) {
      card.classList.add("you");
    }
    const name = document.createElement("div");
    name.className = "tm-player-name";
    name.textContent = `${player.name || "Player"}${player.you ? " · You" : ""}`;
    card.appendChild(name);
    const meta = document.createElement("div");
    meta.className = "tm-player-meta";
    meta.textContent = `${player.status || "-"} · ${player.question_count ?? 0} checks · ${player.rounds_completed ?? 0} rounds completed`;
    card.appendChild(meta);
    if (player.solved_at_round) {
      const solved = document.createElement("div");
      solved.className = "tm-player-meta";
      solved.textContent = `Solved R${player.solved_at_round} · ${player.solved_at_question_count ?? 0} checks`;
      card.appendChild(solved);
    }
    turingMachinePlayers.appendChild(card);
  });
}

function renderTuringMachineGameState(data) {
  if (!data || data.game_type !== "turing_machine") {
    return;
  }
  const view = data.view || {};
  if (turingMachinePendingAction && (!turingMachineCan(view, turingMachinePendingAction.type) || view.round !== currentTuringMachineView?.round)) cancelTuringMachineConfirmation();
  currentTuringMachineView = view;

  if (turingMachinePhaseLabel) turingMachinePhaseLabel.textContent = view.phase || "-";
  if (turingMachineRoundLabel) turingMachineRoundLabel.textContent = view.round ?? "-";
  if (turingMachineModeLabel) turingMachineModeLabel.textContent = view.mode || "-";
  if (turingMachineDifficultyLabel) {
    turingMachineDifficultyLabel.textContent = TURING_MACHINE_DIFFICULTY_NAMES[view.difficulty] || view.difficulty || "-";
  }
  if (turingMachineScenarioLabel) turingMachineScenarioLabel.textContent = view.scenario_name || "-";
  if (turingMachineSeedLabel) turingMachineSeedLabel.textContent = view.share_seed || "-";
  if (turingMachineStatusLabel) turingMachineStatusLabel.textContent = view.status_detail || view.status || "-";
  if (turingMachineBlockingLabel) {
    const blockers = Array.isArray(view.blocking_players) ? view.blocking_players : [];
    turingMachineBlockingLabel.textContent = blockers.length ? blockers.join(", ") : "None";
  }
  if (turingMachineWinnersLabel) {
    const winners = Array.isArray(view.winners) ? view.winners : [];
    turingMachineWinnersLabel.textContent = winners.length ? winners.join(", ") : "-";
  }
  if (turingMachineCurrentProposal) {
    const proposal = (((view || {}).current_round || {}).proposal) || null;
    turingMachineCurrentProposal.textContent = proposal ? turingMachineCodeLabel(proposal) : "Not locked";
  }
  if (turingMachineTestsRemaining) {
    turingMachineTestsRemaining.textContent = String((((view || {}).current_round || {}).tests_remaining) ?? 3);
  }

  const notebookBody = turingMachineNotebook?.querySelector(".tm-notebook-body");
  const scrollPositions = [notebookBody, turingMachineCandidateGrid, turingMachineClueHistory, turingMachineGuessHistory, turingMachinePublicLog]
    .filter(Boolean).map((node) => [node, node.scrollTop]);
  const focused = turingMachineNotes?.contains(document.activeElement) ? document.activeElement : null;
  const focusSelector = focused?.id ? `#${focused.id}` : focused?.dataset.turingMachineFocus ? `[data-turing-machine-focus="${focused.dataset.turingMachineFocus}"]` : null;
  if (turingMachineSolutionRow && turingMachineSolutionLabel) {
    const showSolution = Array.isArray(view.solution) && view.solution.length === 3;
    turingMachineSolutionRow.classList.toggle("hidden", !showSolution);
    turingMachineSolutionRow.setAttribute("aria-hidden", (!showSolution).toString());
    turingMachineSolutionLabel.textContent = showSolution ? turingMachineCodeLabel(view.solution) : "-";
  }

  if (!Array.isArray(turingMachineDraftCode) || turingMachineDraftCode.length !== 3) {
    turingMachineDraftCode = [1, 1, 1];
  }
  renderTuringMachineCodeBuilder(view);
  renderTuringMachineCurrentTests(view);
  renderTuringMachineCriteria(view);
  renderTuringMachineDeduction(view);
  renderTuringMachineNotes(view);
  renderTuringMachineClueHistory(view);
  renderTuringMachineGuessHistory(view);
  renderTuringMachinePublicLog(view);
  renderTuringMachinePlayers(view);
  if (focusSelector) turingMachineNotes.querySelector(focusSelector)?.focus({ preventScroll: true });
  scrollPositions.forEach(([node, scrollTop]) => { node.scrollTop = scrollTop; });

  if (turingMachineUseCodeBtn) turingMachineUseCodeBtn.disabled = !turingMachineCan(view, "set_proposal");
  if (turingMachineGuessBtn) turingMachineGuessBtn.disabled = !turingMachineCan(view, "submit_guess");
  if (turingMachineEndRoundBtn) {
    turingMachineEndRoundBtn.disabled = !turingMachineCan(view, "next_round");
    turingMachineEndRoundBtn.textContent = view.current_round?.ended ? "Waiting…" : "Next Round";
  }
  if (turingMachineGiveUpBtn) turingMachineGiveUpBtn.disabled = !turingMachineCan(view, "give_up");

  document.getElementById("turingMachinePlayersTitle").textContent = view.phase === "game_over" ? "Final standings · Fewest checks wins" : "Players";
  turingMachineExplainWidget?.refresh();
}

function showTuringMachineHeaderActions(show) {
  if (turingMachineHeaderActions) turingMachineHeaderActions.style.display = show ? "flex" : "none";
  if (!show) {
    turingMachineHelpWidget?.close();
    turingMachineExplainWidget?.exit();
    hideTuringMachineTooltip();
    cancelTuringMachineConfirmation();
    turingMachineNotebookOpen = false;
    syncTuringMachineNotebook();
  }
}

function initTuringMachineInterface() {
  if (turingMachineHelpWidget || typeof window.obgCreateHelp !== "function") return;
  turingMachineHelpWidget = window.obgCreateHelp(TURING_MACHINE_HELP_CONFIG);
  turingMachineExplainWidget = window.obgCreateExplain({
    gameId: "turing_machine",
    attribute: "data-turing-machine-explain",
    explanations: TURING_MACHINE_EXPLANATIONS,
    button: turingMachineExplainBtn,
    root: () => turingMachinePanelNode,
    bypass: ["#turingMachineHelpBtn", "#turingMachineExplainBtn"]
  });
  turingMachineHelpBtn?.addEventListener("click", () => {
    turingMachineExplainWidget.exit();
    hideTuringMachineTooltip();
    turingMachineHelpWidget.open();
  });
  turingMachineExplainBtn?.addEventListener("click", () => {
    hideTuringMachineTooltip();
    turingMachineExplainWidget.toggle();
  });
  describeTuringMachineNode(turingMachineCurrentProposal, "round_code", "Yellow triangle(🟨 ▲), Blue square(🟦 ■), Purple circle(🟣 ●). This is the locked code used by all tests this round, not the editable draft.");
  describeTuringMachineNode(turingMachineSolutionLabel, "solution_code", "The revealed solution, in Yellow triangle(🟨 ▲), Blue square(🟦 ■), Purple circle(🟣 ●) order.");
  setTuringMachineNotesExpanded(true);
  syncTuringMachineNotebook();
  updateTuringMachineConfigRow();
  if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "turing_machine") renderTuringMachineGameState(lastGameStatePayload);
}

if (turingMachineSourceSelect) {
  turingMachineSourceSelect.addEventListener("change", () => {
    updateTuringMachineConfigRowsFromSource();
  });
}

if (turingMachineDifficultySelect) {
  turingMachineDifficultySelect.addEventListener("change", () => {
    populateTuringMachinePresetSelect();
  });
}

if (turingMachineUseCodeBtn) {
  turingMachineUseCodeBtn.addEventListener("click", () => {
    sendAction({ type: "set_proposal", code: turingMachineDraftCode.slice(0, 3) });
  });
}

if (turingMachineGuessBtn) {
  turingMachineGuessBtn.addEventListener("click", () => {
    confirmTuringMachineAction("submit_guess");
  });
}

if (turingMachineEndRoundBtn) {
  turingMachineEndRoundBtn.addEventListener("click", () => {
    sendAction({ type: "next_round" });
  });
}

if (turingMachineGiveUpBtn) {
  turingMachineGiveUpBtn.addEventListener("click", () => {
    confirmTuringMachineAction("give_up");
  });
}

if (turingMachineDeductionToggle) {
  turingMachineDeductionToggle.addEventListener("click", () => {
    setTuringMachineDeductionExpanded(!turingMachineDeductionExpanded);
  });
}

if (turingMachineClueHistoryToggle) {
  turingMachineClueHistoryToggle.addEventListener("click", () => {
    setTuringMachineClueHistoryExpanded(!turingMachineClueHistoryExpanded);
  });
}

if (turingMachineNotesToggle) {
  turingMachineNotesToggle.addEventListener("click", () => {
    setTuringMachineNotesExpanded(!turingMachineNotesExpanded);
  });
}

turingMachineNotebookToggle?.addEventListener("click", () => setTuringMachineNotebook(!turingMachineNotebookOpen));
turingMachineNotebookClose?.addEventListener("click", () => setTuringMachineNotebook(false));
turingMachineCancelBtn?.addEventListener("click", cancelTuringMachineConfirmation);
turingMachineConfirmBtn?.addEventListener("click", () => {
  const action = turingMachinePendingAction;
  cancelTuringMachineConfirmation();
  if (action && turingMachineCan(currentTuringMachineView, action.type)) sendAction(action);
});

window.addEventListener("resize", () => {
  syncTuringMachineNotebook();
  hideTuringMachineTooltip();
});
window.addEventListener("scroll", hideTuringMachineTooltip, true);

turingMachinePanelNode?.addEventListener("pointerover", (event) => {
  if (event.pointerType === "mouse") showTuringMachineTooltip(event.target.closest("[data-turing-machine-tip]"));
});
turingMachinePanelNode?.addEventListener("pointerout", (event) => {
  if (event.pointerType === "mouse") hideTuringMachineTooltip();
});
turingMachinePanelNode?.addEventListener("focusin", (event) => showTuringMachineTooltip(event.target.closest("[data-turing-machine-tip]")));
turingMachinePanelNode?.addEventListener("focusout", hideTuringMachineTooltip);
turingMachinePanelNode?.addEventListener("pointerdown", (event) => {
  turingMachineTouchStart = { x: event.clientX, y: event.clientY };
  turingMachineTouchMoved = false;
}, true);
document.addEventListener("pointermove", (event) => {
  if (turingMachineTouchStart && Math.hypot(event.clientX - turingMachineTouchStart.x, event.clientY - turingMachineTouchStart.y) > 8) {
    turingMachineTouchMoved = true;
    hideTuringMachineTooltip();
  }
}, true);
document.addEventListener("pointerup", () => { turingMachineTouchStart = null; }, true);
document.addEventListener("pointercancel", () => {
  turingMachineTouchStart = null;
  turingMachineTouchMoved = true;
}, true);
turingMachinePanelNode?.addEventListener("click", (event) => {
  if (turingMachineTouchMoved) {
    event.preventDefault();
    event.stopImmediatePropagation();
    turingMachineTouchMoved = false;
    return;
  }
  if (event.target.closest("button, select, summary, a")) return;
  if (turingMachinePendingAction && !event.target.closest("#turingMachineConfirmation")) cancelTuringMachineConfirmation();
  showTuringMachineTooltip(event.target.closest("[data-turing-machine-tip]"));
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || currentGameType !== "turing_machine") return;
  hideTuringMachineTooltip();
  if (document.querySelector("dialog[open]") || turingMachineExplainWidget?.isActive()) return;
  if (turingMachinePendingAction) cancelTuringMachineConfirmation();
  else if (turingMachineNotebookOpen) setTuringMachineNotebook(false);
});

populateTuringMachinePresetSelect();
updateTuringMachineConfigRowsFromSource();
setTuringMachineDeductionExpanded(false);
setTuringMachineClueHistoryExpanded(false);
setTuringMachineNotesExpanded(false);

window.updateTuringMachineConfigRow = updateTuringMachineConfigRow;
window.updateTuringMachineConfigRowsFromSource = updateTuringMachineConfigRowsFromSource;
window.populateTuringMachinePresetSelect = populateTuringMachinePresetSelect;
window.clearTuringMachineState = clearTuringMachineState;
window.renderTuringMachineGameState = renderTuringMachineGameState;
window.showTuringMachineHeaderActions = showTuringMachineHeaderActions;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTuringMachineInterface);
} else {
  initTuringMachineInterface();
}
