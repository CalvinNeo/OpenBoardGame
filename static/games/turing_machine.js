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
let turingMachineExplainMode = false;

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
const turingMachineHelpModal = document.getElementById("turingMachineHelpModal");
const turingMachineHelpModalCloseBtn = document.getElementById("turingMachineHelpModalCloseBtn");
const turingMachineHelpContent = document.getElementById("turingMachineHelpContent");
const turingMachineExplainModal = document.getElementById("turingMachineExplainModal");
const turingMachineExplainModalCloseBtn = document.getElementById("turingMachineExplainModalCloseBtn");
const turingMachineExplainContent = document.getElementById("turingMachineExplainContent");

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
const turingMachineCandidateCount = document.getElementById("turingMachineCandidateCount");
const turingMachineCandidateGrid = document.getElementById("turingMachineCandidateGrid");
const turingMachineDigitStats = document.getElementById("turingMachineDigitStats");
const turingMachineVariantStats = document.getElementById("turingMachineVariantStats");
const turingMachineNotes = document.getElementById("turingMachineNotes");
const turingMachineClueHistory = document.getElementById("turingMachineClueHistory");
const turingMachineGuessHistory = document.getElementById("turingMachineGuessHistory");
const turingMachinePublicLog = document.getElementById("turingMachinePublicLog");
const turingMachinePlayers = document.getElementById("turingMachinePlayers");
const turingMachineSolutionRow = document.getElementById("turingMachineSolutionRow");
const turingMachineSolutionLabel = document.getElementById("turingMachineSolution");

const TURING_MACHINE_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Find the hidden 3-digit code in color order: 🟨 Yellow, 🟦 Blue, 🟣 Purple. Each digit ranges from 1 to 5.</p>

  <h3>Verifiers</h3>
  <ul>
    <li>Each verifier card shows a public criterion and several possible hidden truths labeled A / B / C / D.</li>
    <li>The room secretly binds exactly one truth on each card. A test returns only ✔ or ✖.</li>
    <li>A ✔ means your proposed code matches that verifier's hidden truth. It does <strong>not</strong> mean your code is the final answer.</li>
  </ul>

  <h3>Round Flow</h3>
  <ol>
    <li>Pick one round code.</li>
    <li>Test up to 3 different verifier cards with that same code.</li>
    <li>When you are done, click <strong>Next Round</strong>. The next round starts only after every still-active player clicks it.</li>
  </ol>

  <h3>Final Guess</h3>
  <ul>
    <li>You may submit a final guess at any time, even mid-round.</li>
    <li>A wrong final guess eliminates you immediately.</li>
    <li>A correct final guess locks in your verifier count, but other players may continue playing or give up.</li>
    <li>If multiple players solve it, the winner is the one with the fewest total verifier checks. Ties share the win.</li>
  </ul>

  <h3>Modes</h3>
  <ul>
    <li><strong>Simple</strong>: shows live candidate filtering, digit frequencies, and possible hidden truths.</li>
    <li><strong>Expert</strong>: keeps the board close to the physical puzzle, with only manual notes.</li>
  </ul>

  <h3>Sources</h3>
  <ul>
    <li><strong>Preset</strong>: choose an internal scenario by difficulty.</li>
    <li><strong>Random</strong>: generate a fresh puzzle from a shareable seed.</li>
  </ul>
`;

const TURING_MACHINE_BUTTON_EXPLANATIONS = {
  turingMachineUseCodeBtn: {
    name: "Use As Round Code",
    description: "Lock the draft code as this round's single testing code. Once you start testing, that round code cannot be changed.",
  },
  turingMachineGuessBtn: {
    name: "Submit Final Guess",
    description: "Submit the draft code as your final answer. A wrong guess eliminates you immediately.",
  },
  turingMachineEndRoundBtn: {
    name: "Next Round",
    description: "Finish your current round and wait. The next round starts only after every still-active player clicks Next Round.",
  },
  turingMachineGiveUpBtn: {
    name: "Give Up",
    description: "Leave the puzzle and concede this game.",
  },
};

const TURING_MACHINE_DYNAMIC_EXPLANATIONS = {
  code_digit: {
    name: "Draft Digits",
    description: "These buttons set the draft code. You can use the same draft to lock a round code or submit a final guess.",
  },
  test_card: {
    name: "Test Verifier",
    description: "Run the current round code against that verifier. Each round allows at most 3 different verifier checks.",
  },
  note_chip: {
    name: "Manual Note",
    description: "Click to cycle the note mark: unknown, exclude, keep, confirm. Notes are personal and saved to the room state.",
  },
};

function turingMachineCan(view, action) {
  return Array.isArray(view && view.legal_actions) && view.legal_actions.includes(action);
}

function turingMachineCodeLabel(code) {
  if (!Array.isArray(code) || code.length !== 3) {
    return "—";
  }
  return `🟨${code[0]} · 🟦${code[1]} · 🟣${code[2]}`;
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
  const source = turingMachineSourceSelect ? turingMachineSourceSelect.value || "preset" : "preset";
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
  currentTuringMachineView = null;
  turingMachineDraftCode = [1, 1, 1];
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
    const title = document.createElement("div");
    title.className = "tm-code-column-title";
    title.textContent = slotInfo.label;
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
      btn.addEventListener("click", () => {
        turingMachineDraftCode[slotIndex] = value;
        renderTuringMachineCodeBuilder(view);
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
    const variants = Array.isArray(card.variants) ? card.variants : [];
    variants.forEach((variant) => {
      const row = document.createElement("div");
      row.className = "tm-verifier-variant";
      row.textContent = `${variant.variant_id}. ${variant.description}`;
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
    footer.appendChild(result);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = card.tested_this_round ? "Checked" : "Test";
    btn.disabled = !canTest || card.tested_this_round;
    btn.dataset.turingMachineExplain = "test_card";
    btn.addEventListener("click", () => {
      sendAction({ type: "test_criterion", slot: card.slot });
    });
    footer.appendChild(btn);
    wrap.appendChild(footer);
    turingMachineCriteria.appendChild(wrap);
  });
}

function renderTuringMachineDeduction(view) {
  if (!turingMachineDeductionPanel || !turingMachineCandidateCount || !turingMachineCandidateGrid || !turingMachineDigitStats || !turingMachineVariantStats) {
    return;
  }
  const deduction = view.deduction;
  const show = !!deduction;
  turingMachineDeductionPanel.classList.toggle("hidden", !show);
  turingMachineDeductionPanel.setAttribute("aria-hidden", (!show).toString());
  if (!show) {
    turingMachineCandidateCount.textContent = "-";
    turingMachineCandidateGrid.innerHTML = "";
    turingMachineDigitStats.innerHTML = "";
    turingMachineVariantStats.innerHTML = "";
    return;
  }

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
  turingMachineNotes.innerHTML = "";
  const notes = view.notes || {};
  const digitMarks = notes.digit_marks || {};
  const variantMarks = notes.variant_marks || {};

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
      btn.addEventListener("click", () => {
        const nextNotes = turingMachineCloneNotes(notes);
        nextNotes.digit_marks[slotInfo.key][index] = turingMachineNextMark(mark);
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
    row.className = "tm-note-row";
    const label = document.createElement("div");
    label.className = "tm-note-label";
    label.textContent = `Verifier ${card.slot}`;
    row.appendChild(label);

    const marksWrap = document.createElement("div");
    marksWrap.className = "tm-note-chip-row";
    const marks = Array.isArray(variantMarks[card.slot]) ? variantMarks[card.slot] : (card.variants || []).map(() => "unknown");
    marks.forEach((mark, index) => {
      const variant = (card.variants || [])[index];
      if (!variant) {
        return;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `tm-note-chip is-${mark}`;
      btn.dataset.turingMachineExplain = "note_chip";
      btn.textContent = `${variant.variant_id} ${TURING_MACHINE_NOTE_LABELS[mark] || "·"}`;
      btn.addEventListener("click", () => {
        const nextNotes = turingMachineCloneNotes(notes);
        nextNotes.variant_marks[card.slot][index] = turingMachineNextMark(mark);
        sendAction({ type: "update_notes", notes: nextNotes });
      });
      marksWrap.appendChild(btn);
    });
    row.appendChild(marksWrap);
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
  clues.forEach((clue) => {
    const row = document.createElement("div");
    row.className = `tm-history-row ${clue.result ? "is-pass" : "is-fail"}`;
    row.textContent = `R${clue.round} · ${clue.slot} · ${turingMachineCodeLabel(clue.proposal)} · ${clue.result ? "✔" : "✖"}`;
    turingMachineClueHistory.appendChild(row);
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
    name.textContent = player.name || player.player_id;
    card.appendChild(name);
    const meta = document.createElement("div");
    meta.className = "tm-player-meta";
    meta.textContent = `${player.status || "-"} · checks ${player.question_count ?? 0} · rounds ${player.rounds_completed ?? 0}`;
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

  if (turingMachineUseCodeBtn) turingMachineUseCodeBtn.disabled = !turingMachineCan(view, "set_proposal");
  if (turingMachineGuessBtn) turingMachineGuessBtn.disabled = !turingMachineCan(view, "submit_guess");
  if (turingMachineEndRoundBtn) turingMachineEndRoundBtn.disabled = !turingMachineCan(view, "next_round");
  if (turingMachineGiveUpBtn) turingMachineGiveUpBtn.disabled = !turingMachineCan(view, "give_up");

  if (turingMachineExplainMode) {
    updateTuringMachineExplainClasses(true);
  }
}

function showTuringMachineHeaderActions(show) {
  if (turingMachineHeaderActions) {
    turingMachineHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    closeTuringMachineHelpModal();
    closeTuringMachineExplainModal();
    exitTuringMachineExplainMode();
  }
}

function showTuringMachineHelpModal() {
  if (!turingMachineHelpModal || !turingMachineHelpContent) {
    return;
  }
  turingMachineHelpContent.innerHTML = TURING_MACHINE_HELP_TEXT;
  setModalVisible(turingMachineHelpModal, true);
}

function closeTuringMachineHelpModal() {
  if (turingMachineHelpModal) {
    setModalVisible(turingMachineHelpModal, false);
  }
}

function updateTuringMachineExplainClasses(enabled) {
  Object.keys(TURING_MACHINE_BUTTON_EXPLANATIONS).forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.classList.toggle("has-explanation", enabled);
    }
  });
  document.querySelectorAll("[data-turing-machine-explain]").forEach((node) => {
    node.classList.toggle("has-explanation", enabled);
  });
}

function findTuringMachineExplainTargetAtPoint(x, y) {
  for (const id of Object.keys(TURING_MACHINE_BUTTON_EXPLANATIONS)) {
    const button = document.getElementById(id);
    if (!button) continue;
    const rect = button.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return { type: "button", key: id };
    }
  }
  const nodes = document.querySelectorAll("[data-turing-machine-explain]");
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return { type: "dynamic", key: node.dataset.turingMachineExplain };
    }
  }
  return null;
}

function showTuringMachineButtonExplanation(target) {
  let explanation = null;
  if (target.type === "button") {
    explanation = TURING_MACHINE_BUTTON_EXPLANATIONS[target.key];
  } else if (target.type === "dynamic") {
    explanation = TURING_MACHINE_DYNAMIC_EXPLANATIONS[target.key];
  }
  if (!explanation || !turingMachineExplainContent || !turingMachineExplainModal) {
    return;
  }
  turingMachineExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
  `;
  setModalVisible(turingMachineExplainModal, true);
}

function closeTuringMachineExplainModal() {
  if (turingMachineExplainModal) {
    setModalVisible(turingMachineExplainModal, false);
  }
}

function toggleTuringMachineExplainMode() {
  turingMachineExplainMode = !turingMachineExplainMode;
  document.body.classList.toggle("turing-machine-explain-mode", turingMachineExplainMode);
  if (turingMachineExplainBtn) {
    turingMachineExplainBtn.classList.toggle("active", turingMachineExplainMode);
  }
  updateTuringMachineExplainClasses(turingMachineExplainMode);
}

function exitTuringMachineExplainMode() {
  if (!turingMachineExplainMode) {
    return;
  }
  turingMachineExplainMode = false;
  document.body.classList.remove("turing-machine-explain-mode");
  if (turingMachineExplainBtn) {
    turingMachineExplainBtn.classList.remove("active");
  }
  updateTuringMachineExplainClasses(false);
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
    sendAction({ type: "submit_guess", code: turingMachineDraftCode.slice(0, 3) });
  });
}

if (turingMachineEndRoundBtn) {
  turingMachineEndRoundBtn.addEventListener("click", () => {
    sendAction({ type: "next_round" });
  });
}

if (turingMachineGiveUpBtn) {
  turingMachineGiveUpBtn.addEventListener("click", () => {
    const confirmed = window.confirm("Give up this puzzle?");
    if (confirmed) {
      sendAction({ type: "give_up" });
    }
  });
}

if (turingMachineHelpBtn) {
  turingMachineHelpBtn.addEventListener("click", showTuringMachineHelpModal);
}

if (turingMachineHelpModalCloseBtn) {
  turingMachineHelpModalCloseBtn.addEventListener("click", closeTuringMachineHelpModal);
}

if (turingMachineExplainBtn) {
  turingMachineExplainBtn.addEventListener("click", toggleTuringMachineExplainMode);
}

if (turingMachineExplainModalCloseBtn) {
  turingMachineExplainModalCloseBtn.addEventListener("click", closeTuringMachineExplainModal);
}

document.addEventListener("pointerdown", (event) => {
  if (!turingMachineExplainMode) {
    return;
  }
  const target = findTuringMachineExplainTargetAtPoint(event.clientX, event.clientY);
  if (target) {
    event.preventDefault();
    event.stopPropagation();
    showTuringMachineButtonExplanation(target);
    exitTuringMachineExplainMode();
    return;
  }
  const button = event.target.closest("button");
  if (button === turingMachineExplainBtn || button === turingMachineHelpBtn) {
    return;
  }
  if (button === turingMachineHelpModalCloseBtn || button === turingMachineExplainModalCloseBtn) {
    return;
  }
  if (button) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

document.addEventListener("click", (event) => {
  if (!turingMachineExplainMode) {
    return;
  }
  const button = event.target.closest("button");
  if (!button) {
    return;
  }
  if (button === turingMachineExplainBtn || button === turingMachineHelpBtn) {
    return;
  }
  if (button === turingMachineHelpModalCloseBtn || button === turingMachineExplainModalCloseBtn) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && turingMachineExplainMode) {
    exitTuringMachineExplainMode();
  }
});

populateTuringMachinePresetSelect();
updateTuringMachineConfigRowsFromSource();

window.updateTuringMachineConfigRow = updateTuringMachineConfigRow;
window.updateTuringMachineConfigRowsFromSource = updateTuringMachineConfigRowsFromSource;
window.populateTuringMachinePresetSelect = populateTuringMachinePresetSelect;
window.clearTuringMachineState = clearTuringMachineState;
window.renderTuringMachineGameState = renderTuringMachineGameState;
window.showTuringMachineHeaderActions = showTuringMachineHeaderActions;
