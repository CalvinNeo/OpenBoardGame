let currentWordDecodeView = null;
let wordDecodeHintDrafts = ["", ""];
let wordDecodeBaseDraft = "";
let wordDecodeGuessDrafts = {};

const wordDecodePhaseLabel = document.getElementById("wordDecodePhase");
const wordDecodeRoundLabel = document.getElementById("wordDecodeRound");
const wordDecodeHiddenLabel = document.getElementById("wordDecodeHidden");
const wordDecodeHintsSubmittedLabel = document.getElementById("wordDecodeHintsSubmitted");
const wordDecodeGuessesSubmittedLabel = document.getElementById("wordDecodeGuessesSubmitted");

const wordDecodeHintArea = document.getElementById("wordDecodeHintArea");
const wordDecodeHint1Input = document.getElementById("wordDecodeHint1");
const wordDecodeHint2Input = document.getElementById("wordDecodeHint2");
const wordDecodeSubmitHintsBtn = document.getElementById("wordDecodeSubmitHintsBtn");

const wordDecodeGuessArea = document.getElementById("wordDecodeGuessArea");
const wordDecodeHintsList = document.getElementById("wordDecodeHintsList");
const wordDecodeBaseGuessInput = document.getElementById("wordDecodeBaseGuess");
const wordDecodeGuessList = document.getElementById("wordDecodeGuessList");
const wordDecodeSubmitGuessesBtn = document.getElementById("wordDecodeSubmitGuessesBtn");

const wordDecodeRoundEnd = document.getElementById("wordDecodeRoundEnd");
const wordDecodeSummary = document.getElementById("wordDecodeSummary");
const wordDecodeNextRoundBtn = document.getElementById("wordDecodeNextRoundBtn");
const wordDecodeEndGameBtn = document.getElementById("wordDecodeEndGameBtn");

const wordDecodePlayers = document.getElementById("wordDecodePlayers");

const wordDecodeHeaderActions = document.getElementById("wordDecodeHeaderActions");
const wordDecodeHelpBtn = document.getElementById("wordDecodeHelpBtn");
const wordDecodeExplainBtn = document.getElementById("wordDecodeExplainBtn");
const wordDecodeHelpModal = document.getElementById("wordDecodeHelpModal");
const wordDecodeHelpModalCloseBtn = document.getElementById("wordDecodeHelpModalCloseBtn");
const wordDecodeHelpContent = document.getElementById("wordDecodeHelpContent");
const wordDecodeExplainModal = document.getElementById("wordDecodeExplainModal");
const wordDecodeExplainModalCloseBtn = document.getElementById("wordDecodeExplainModalCloseBtn");
const wordDecodeExplainContent = document.getElementById("wordDecodeExplainContent");

const WORD_DECODE_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Earn points by guessing other players' hidden words and the shared base word.</p>

  <h3>Round Flow</h3>
  <ol>
    <li>Each player receives a hidden word.</li>
    <li>Write two hints. Each hint must be a single Chinese character that forms a common two-character word with your hidden word.</li>
    <li>After all hints are revealed, guess every other player's hidden word and the base word.</li>
  </ol>

  <h3>Scoring</h3>
  <ul>
    <li>Correct hidden word: +1 to the guesser, +1 to the hidden-word owner.</li>
    <li>Correct base word: +3 to the guesser.</li>
  </ul>

  <h3>End</h3>
  <p>Keep playing new rounds until the group decides to end the game.</p>
`;

const WORD_DECODE_BUTTON_EXPLANATIONS = {
  wordDecodeSubmitHintsBtn: {
    name: "Submit Hints",
    description: "Send your two hint words for the current round.",
    note: "Hints are revealed only after everyone submits.",
  },
  wordDecodeSubmitGuessesBtn: {
    name: "Submit Guesses",
    description: "Submit your guesses for every other player's hidden word and the base word.",
  },
  wordDecodeNextRoundBtn: {
    name: "Next Round",
    description: "Start a new round with a fresh base word and new hidden words.",
  },
  wordDecodeEndGameBtn: {
    name: "End Game",
    description: "Finish the game and lock in the current scores.",
  },
};

const wordDecodeActionButtons = {
  submit_hints: wordDecodeSubmitHintsBtn,
  submit_guesses: wordDecodeSubmitGuessesBtn,
  next_round: wordDecodeNextRoundBtn,
  end_game: wordDecodeEndGameBtn,
};

function formatWordDecodePhase(phase) {
  const map = {
    hint: "Hints",
    guess: "Guess",
    round_end: "Round End",
    game_over: "Game Over",
  };
  return map[phase] || phase || "-";
}

function isSingleChineseChar(value) {
  const trimmed = value ? value.trim() : "";
  const chars = Array.from(trimmed);
  if (chars.length !== 1) {
    return false;
  }
  const code = chars[0].codePointAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x20000 && code <= 0x2a6df) ||
    (code >= 0x2a700 && code <= 0x2b73f) ||
    (code >= 0x2b740 && code <= 0x2b81f) ||
    (code >= 0x2b820 && code <= 0x2ceaf) ||
    (code >= 0x2ceb0 && code <= 0x2ebef) ||
    (code >= 0x30000 && code <= 0x3134f)
  );
}

function resetWordDecodeDrafts() {
  wordDecodeHintDrafts = ["", ""];
  wordDecodeBaseDraft = "";
  wordDecodeGuessDrafts = {};
}

function captureWordDecodeDrafts() {
  if (wordDecodeHint1Input) {
    wordDecodeHintDrafts[0] = wordDecodeHint1Input.value || "";
  }
  if (wordDecodeHint2Input) {
    wordDecodeHintDrafts[1] = wordDecodeHint2Input.value || "";
  }
  if (wordDecodeBaseGuessInput) {
    wordDecodeBaseDraft = wordDecodeBaseGuessInput.value || "";
  }
  if (wordDecodeGuessList) {
    const inputs = wordDecodeGuessList.querySelectorAll("input[data-target]");
    inputs.forEach((input) => {
      const targetId = input.getAttribute("data-target");
      if (targetId) {
        wordDecodeGuessDrafts[targetId] = input.value || "";
      }
    });
  }
}

function renderWordDecodeHintsList(view) {
  if (!wordDecodeHintsList) {
    return;
  }
  wordDecodeHintsList.innerHTML = "";
  if (!view.hints) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "Hints will appear after everyone submits.";
    wordDecodeHintsList.appendChild(hint);
    return;
  }
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "word-decode-hint-card";
    const header = document.createElement("div");
    header.className = "word-decode-hint-header";
    header.textContent = player.name;
    card.appendChild(header);
    const hintRow = document.createElement("div");
    hintRow.className = "word-decode-hint-chips";
    const hints = view.hints[player.player_id] || ["-", "-"];
    hints.forEach((hintText) => {
      const chip = document.createElement("span");
      chip.className = "word-decode-hint-chip";
      chip.textContent = hintText || "-";
      hintRow.appendChild(chip);
    });
    card.appendChild(hintRow);
    wordDecodeHintsList.appendChild(card);
  });
}

function renderWordDecodeGuessList(view) {
  if (!wordDecodeGuessList) {
    return;
  }
  wordDecodeGuessList.innerHTML = "";
  const canSubmit = Array.isArray(view.legal_actions) && view.legal_actions.includes("submit_guesses");
  const targets = view.players.filter((player) => player.player_id !== view.you);
  targets.forEach((player) => {
    const row = document.createElement("div");
    row.className = "word-decode-guess-row";

    const label = document.createElement("div");
    label.className = "word-decode-guess-label";
    label.textContent = player.name;
    row.appendChild(label);

    const hintWrap = document.createElement("div");
    hintWrap.className = "word-decode-guess-hints";
    const hints = view.hints ? view.hints[player.player_id] : null;
    if (hints && hints.length) {
      hints.forEach((hintText) => {
        const chip = document.createElement("span");
        chip.className = "word-decode-hint-chip";
        chip.textContent = hintText || "-";
        hintWrap.appendChild(chip);
      });
    } else {
      const chip = document.createElement("span");
      chip.className = "word-decode-hint-chip muted";
      chip.textContent = "Hints pending";
      hintWrap.appendChild(chip);
    }
    row.appendChild(hintWrap);

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Guess ${player.name}`;
    input.setAttribute("data-target", player.player_id);
    input.value = wordDecodeGuessDrafts[player.player_id] || "";
    input.disabled = !canSubmit;
    input.addEventListener("input", () => {
      wordDecodeGuessDrafts[player.player_id] = input.value || "";
      updateWordDecodeActionButtons();
    });
    row.appendChild(input);

    wordDecodeGuessList.appendChild(row);
  });
}

function renderWordDecodeSummary(view) {
  if (!wordDecodeSummary) {
    return;
  }
  wordDecodeSummary.innerHTML = "";
  const summary = view.round_summary;
  if (!summary) {
    wordDecodeSummary.textContent = "-";
    return;
  }
  const baseLine = document.createElement("div");
  baseLine.className = "word-decode-summary-line";
  baseLine.textContent = `Base word: ${summary.base || "-"}`;
  wordDecodeSummary.appendChild(baseLine);

  const baseCorrect = Array.isArray(summary.base_correct) ? summary.base_correct : [];
  const baseGuessers = baseCorrect.map((pid) => findPlayerName(view, pid));
  const baseGuessLine = document.createElement("div");
  baseGuessLine.className = "word-decode-summary-line";
  baseGuessLine.textContent = `Base guessed by: ${baseGuessers.length ? baseGuessers.join(", ") : "-"}`;
  wordDecodeSummary.appendChild(baseGuessLine);

  const list = document.createElement("div");
  list.className = "word-decode-summary-list";
  view.players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "word-decode-summary-row";
    const title = document.createElement("div");
    title.className = "word-decode-summary-name";
    title.textContent = player.name;
    row.appendChild(title);

    const hidden = summary.assignments ? summary.assignments[player.player_id] : null;
    const hiddenLine = document.createElement("div");
    hiddenLine.className = "word-decode-summary-detail";
    hiddenLine.textContent = `Hidden: ${hidden || "-"}`;
    row.appendChild(hiddenLine);

    const hintList = summary.hints ? summary.hints[player.player_id] : null;
    const hintsLine = document.createElement("div");
    hintsLine.className = "word-decode-summary-detail";
    hintsLine.textContent = `Hints: ${(hintList || []).join(" / ") || "-"}`;
    row.appendChild(hintsLine);

    const hiddenCorrect = summary.hidden_correct ? summary.hidden_correct[player.player_id] : [];
    const correctNames = (hiddenCorrect || []).map((pid) => findPlayerName(view, pid));
    const correctLine = document.createElement("div");
    correctLine.className = "word-decode-summary-detail";
    correctLine.textContent = `Guessed by: ${correctNames.length ? correctNames.join(", ") : "-"}`;
    row.appendChild(correctLine);

    const guessHeader = document.createElement("div");
    guessHeader.className = "word-decode-summary-detail";
    guessHeader.textContent = "Guesses:";
    row.appendChild(guessHeader);

    const guessList = document.createElement("div");
    guessList.className = "word-decode-summary-guess-list";
    view.players.forEach((guesser) => {
      const guessRow = document.createElement("div");
      guessRow.className = "word-decode-summary-guess-line";
      const guessName = document.createElement("span");
      guessName.className = "word-decode-summary-guess-name";
      guessName.textContent = `${guesser.name}:`;
      const guessValue = document.createElement("span");
      guessValue.className = "word-decode-summary-guess-value";
      const guessData = summary.guesses ? summary.guesses[guesser.player_id] : null;
      const hiddenGuesses = guessData ? guessData.hidden_guesses : null;
      const guessText = hiddenGuesses ? hiddenGuesses[player.player_id] : "";
      guessValue.textContent = guessText || "-";
      guessRow.appendChild(guessName);
      guessRow.appendChild(guessValue);
      guessList.appendChild(guessRow);
    });
    row.appendChild(guessList);

    list.appendChild(row);
  });
  wordDecodeSummary.appendChild(list);

  const scoreHeader = document.createElement("div");
  scoreHeader.className = "word-decode-summary-line";
  scoreHeader.textContent = "Score Changes:";
  wordDecodeSummary.appendChild(scoreHeader);

  const scoreList = document.createElement("div");
  scoreList.className = "word-decode-summary-scores";
  view.players.forEach((player) => {
    const delta = summary.scores_delta ? summary.scores_delta[player.player_id] : 0;
    const line = document.createElement("div");
    line.textContent = `${player.name} ${delta >= 0 ? "+" : ""}${delta} (total ${player.score})`;
    scoreList.appendChild(line);
  });
  wordDecodeSummary.appendChild(scoreList);
}

function renderWordDecodePlayers(view) {
  if (!wordDecodePlayers) {
    return;
  }
  wordDecodePlayers.innerHTML = "";
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card word-decode-player-card";
    if (player.player_id === view.you) {
      card.classList.add("current");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name;
    const meta = document.createElement("div");
    meta.className = "player-meta word-decode-player-meta";
    const scoreLine = document.createElement("div");
    scoreLine.textContent = `Score: ${player.score}`;
    const statusLine = document.createElement("div");
    const hintStatus = player.submitted_hints ? "✅" : "⏳";
    const guessStatus = player.submitted_guesses ? "✅" : "⏳";
    statusLine.textContent = `📝 ${hintStatus}  🔍 ${guessStatus}`;
    meta.appendChild(scoreLine);
    meta.appendChild(statusLine);
    card.appendChild(name);
    card.appendChild(meta);
    wordDecodePlayers.appendChild(card);
  });
}

function isWordDecodeActionAvailable(actionType) {
  if (!currentWordDecodeView || !Array.isArray(currentWordDecodeView.legal_actions)) {
    return false;
  }
  if (!currentWordDecodeView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "submit_hints") {
    const hint1 = wordDecodeHint1Input ? wordDecodeHint1Input.value.trim() : "";
    const hint2 = wordDecodeHint2Input ? wordDecodeHint2Input.value.trim() : "";
    return isSingleChineseChar(hint1) && isSingleChineseChar(hint2);
  }
  if (actionType === "submit_guesses") {
    const baseGuess = wordDecodeBaseGuessInput ? wordDecodeBaseGuessInput.value.trim() : "";
    if (!baseGuess) {
      return false;
    }
    if (!wordDecodeGuessList) {
      return false;
    }
    const inputs = wordDecodeGuessList.querySelectorAll("input[data-target]");
    if (!inputs.length) {
      return false;
    }
    for (const input of inputs) {
      if (!input.value.trim()) {
        return false;
      }
    }
    return true;
  }
  return true;
}

function updateWordDecodeActionButtons() {
  Object.entries(wordDecodeActionButtons).forEach(([actionType, button]) => {
    if (!button) {
      return;
    }
    const allowed = isWordDecodeActionAvailable(actionType);
    button.disabled = !allowed;
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
  });
}

function clearWordDecodeState() {
  currentWordDecodeView = null;
  resetWordDecodeDrafts();
  if (wordDecodePhaseLabel) wordDecodePhaseLabel.textContent = "-";
  if (wordDecodeRoundLabel) wordDecodeRoundLabel.textContent = "-";
  if (wordDecodeHiddenLabel) wordDecodeHiddenLabel.textContent = "-";
  if (wordDecodeHintsSubmittedLabel) wordDecodeHintsSubmittedLabel.textContent = "-";
  if (wordDecodeGuessesSubmittedLabel) wordDecodeGuessesSubmittedLabel.textContent = "-";
  if (wordDecodeHintsList) wordDecodeHintsList.innerHTML = "";
  if (wordDecodeGuessList) wordDecodeGuessList.innerHTML = "";
  if (wordDecodeSummary) wordDecodeSummary.textContent = "-";
  if (wordDecodePlayers) wordDecodePlayers.innerHTML = "";
  if (wordDecodeHint1Input) wordDecodeHint1Input.value = "";
  if (wordDecodeHint2Input) wordDecodeHint2Input.value = "";
  if (wordDecodeBaseGuessInput) wordDecodeBaseGuessInput.value = "";
  updateWordDecodeActionButtons();
}

function renderWordDecodeGameState(data) {
  const view = data.view;
  const previousView = currentWordDecodeView;
  captureWordDecodeDrafts();
  currentWordDecodeView = view;
  if (currentGameType !== "word_decode") {
    currentGameType = "word_decode";
    setGamePanelVisibility("word_decode");
  }

  if (!previousView || previousView.round !== view.round) {
    resetWordDecodeDrafts();
  }

  if (wordDecodePhaseLabel) {
    wordDecodePhaseLabel.textContent = formatWordDecodePhase(view.phase);
  }
  if (wordDecodeRoundLabel) {
    wordDecodeRoundLabel.textContent = view.round ?? "-";
  }
  if (wordDecodeHiddenLabel) {
    wordDecodeHiddenLabel.textContent = view.your_hidden_word || "-";
  }

  const hintCount = view.players.filter((p) => p.submitted_hints).length;
  const guessCount = view.players.filter((p) => p.submitted_guesses).length;
  if (wordDecodeHintsSubmittedLabel) {
    wordDecodeHintsSubmittedLabel.textContent = `${hintCount}/${view.players.length}`;
  }
  if (wordDecodeGuessesSubmittedLabel) {
    wordDecodeGuessesSubmittedLabel.textContent = `${guessCount}/${view.players.length}`;
  }

  if (wordDecodeHintArea) {
    wordDecodeHintArea.classList.toggle("hidden", view.phase !== "hint");
  }
  if (wordDecodeGuessArea) {
    wordDecodeGuessArea.classList.toggle("hidden", view.phase !== "guess");
  }
  if (wordDecodeRoundEnd) {
    const showSummary = view.phase === "round_end" || view.phase === "game_over";
    wordDecodeRoundEnd.classList.toggle("hidden", !showSummary);
  }

  const canSubmitHints = Array.isArray(view.legal_actions) && view.legal_actions.includes("submit_hints");
  if (wordDecodeHint1Input) {
    wordDecodeHint1Input.disabled = !canSubmitHints;
    wordDecodeHint1Input.value = wordDecodeHintDrafts[0] || "";
  }
  if (wordDecodeHint2Input) {
    wordDecodeHint2Input.disabled = !canSubmitHints;
    wordDecodeHint2Input.value = wordDecodeHintDrafts[1] || "";
  }
  if (wordDecodeBaseGuessInput) {
    wordDecodeBaseGuessInput.disabled = !Array.isArray(view.legal_actions) || !view.legal_actions.includes("submit_guesses");
    wordDecodeBaseGuessInput.value = wordDecodeBaseDraft || "";
  }

  renderWordDecodeHintsList(view);
  if (view.phase === "guess") {
    renderWordDecodeGuessList(view);
  } else if (wordDecodeGuessList) {
    wordDecodeGuessList.innerHTML = "";
  }
  renderWordDecodeSummary(view);
  renderWordDecodePlayers(view);
  logGameEvents(data);
  updateWordDecodeActionButtons();
}

if (wordDecodeHint1Input) {
  wordDecodeHint1Input.addEventListener("input", () => {
    wordDecodeHintDrafts[0] = wordDecodeHint1Input.value || "";
    updateWordDecodeActionButtons();
  });
}

if (wordDecodeHint2Input) {
  wordDecodeHint2Input.addEventListener("input", () => {
    wordDecodeHintDrafts[1] = wordDecodeHint2Input.value || "";
    updateWordDecodeActionButtons();
  });
}

if (wordDecodeBaseGuessInput) {
  wordDecodeBaseGuessInput.addEventListener("input", () => {
    wordDecodeBaseDraft = wordDecodeBaseGuessInput.value || "";
    updateWordDecodeActionButtons();
  });
}

if (wordDecodeSubmitHintsBtn) {
  wordDecodeSubmitHintsBtn.addEventListener("click", () => {
    const hint1 = wordDecodeHint1Input ? wordDecodeHint1Input.value.trim() : "";
    const hint2 = wordDecodeHint2Input ? wordDecodeHint2Input.value.trim() : "";
    if (!isSingleChineseChar(hint1) || !isSingleChineseChar(hint2)) {
      log("Each hint must be a single Chinese character");
      return;
    }
    sendAction({ type: "submit_hints", hints: [hint1, hint2] });
  });
}

if (wordDecodeSubmitGuessesBtn) {
  wordDecodeSubmitGuessesBtn.addEventListener("click", () => {
    const baseGuess = wordDecodeBaseGuessInput ? wordDecodeBaseGuessInput.value.trim() : "";
    if (!baseGuess) {
      log("Enter base word guess");
      return;
    }
    if (!wordDecodeGuessList) {
      return;
    }
    const inputs = wordDecodeGuessList.querySelectorAll("input[data-target]");
    const guesses = [];
    for (const input of inputs) {
      const targetId = input.getAttribute("data-target");
      const guess = input.value.trim();
      if (!targetId || !guess) {
        log("Fill all guesses");
        return;
      }
      guesses.push({ target_player_id: targetId, guess });
    }
    sendAction({ type: "submit_guesses", base_guess: baseGuess, hidden_guesses: guesses });
  });
}

if (wordDecodeNextRoundBtn) {
  wordDecodeNextRoundBtn.addEventListener("click", () => {
    sendAction({ type: "next_round" });
  });
}

if (wordDecodeEndGameBtn) {
  wordDecodeEndGameBtn.addEventListener("click", () => {
    sendAction({ type: "end_game" });
  });
}

let wordDecodeExplainMode = false;

function showWordDecodeHeaderActions(show) {
  if (wordDecodeHeaderActions) {
    wordDecodeHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitWordDecodeExplainMode();
    closeWordDecodeHelpModal();
    closeWordDecodeExplainModal();
  }
}

function showWordDecodeHelpModal() {
  if (!wordDecodeHelpModal) {
    return;
  }
  if (wordDecodeHelpContent) {
    wordDecodeHelpContent.innerHTML = WORD_DECODE_HELP_TEXT;
  }
  setModalVisible(wordDecodeHelpModal, true);
}

function closeWordDecodeHelpModal() {
  if (wordDecodeHelpModal) {
    setModalVisible(wordDecodeHelpModal, false);
  }
}

function updateWordDecodeExplainModeClasses(enabled) {
  Object.keys(WORD_DECODE_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
}

function findWordDecodeButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(WORD_DECODE_BUTTON_EXPLANATIONS)) {
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  return null;
}

function toggleWordDecodeExplainMode() {
  wordDecodeExplainMode = !wordDecodeExplainMode;
  document.body.classList.toggle("word-decode-explain-mode", wordDecodeExplainMode);
  updateWordDecodeExplainModeClasses(wordDecodeExplainMode);
  if (wordDecodeExplainBtn) {
    wordDecodeExplainBtn.classList.toggle("active", wordDecodeExplainMode);
  }
}

function exitWordDecodeExplainMode() {
  if (!wordDecodeExplainMode) {
    return;
  }
  wordDecodeExplainMode = false;
  document.body.classList.remove("word-decode-explain-mode");
  updateWordDecodeExplainModeClasses(false);
  if (wordDecodeExplainBtn) {
    wordDecodeExplainBtn.classList.remove("active");
  }
}

function showWordDecodeButtonExplanation(buttonId) {
  const explanation = WORD_DECODE_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !wordDecodeExplainContent || !wordDecodeExplainModal) {
    return;
  }
  const note = explanation.note ? `<div class="hint">${explanation.note}</div>` : "";
  wordDecodeExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    ${note}
  `;
  setModalVisible(wordDecodeExplainModal, true);
}

function closeWordDecodeExplainModal() {
  if (wordDecodeExplainModal) {
    setModalVisible(wordDecodeExplainModal, false);
  }
}

if (wordDecodeHelpBtn) {
  wordDecodeHelpBtn.addEventListener("click", () => {
    showWordDecodeHelpModal();
  });
}

if (wordDecodeHelpModalCloseBtn) {
  wordDecodeHelpModalCloseBtn.addEventListener("click", closeWordDecodeHelpModal);
}

if (wordDecodeExplainBtn) {
  wordDecodeExplainBtn.addEventListener("click", () => {
    toggleWordDecodeExplainMode();
  });
}

if (wordDecodeExplainModalCloseBtn) {
  wordDecodeExplainModalCloseBtn.addEventListener("click", closeWordDecodeExplainModal);
}

document.addEventListener("pointerdown", (e) => {
  if (!wordDecodeExplainMode) return;

  const buttonId = findWordDecodeButtonAtPoint(e.clientX, e.clientY);
  if (buttonId) {
    e.preventDefault();
    e.stopPropagation();
    showWordDecodeButtonExplanation(buttonId);
    exitWordDecodeExplainMode();
    return;
  }

  const button = e.target.closest("button");
  if (button === wordDecodeExplainBtn || button === wordDecodeHelpBtn) return;
  if (button === wordDecodeHelpModalCloseBtn || button === wordDecodeExplainModalCloseBtn) return;

  if (button) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

document.addEventListener("click", (e) => {
  if (!wordDecodeExplainMode) return;

  const button = e.target.closest("button");
  if (!button) return;

  if (button === wordDecodeExplainBtn || button === wordDecodeHelpBtn) return;
  if (button === wordDecodeHelpModalCloseBtn || button === wordDecodeExplainModalCloseBtn) return;

  e.preventDefault();
  e.stopPropagation();
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && wordDecodeExplainMode) {
    exitWordDecodeExplainMode();
  }
});
