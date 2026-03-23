let currentTagironView = null;
let tagironGuessDrafts = [];

const tagironHeaderActions = document.getElementById("tagironHeaderActions");
const tagironHelpBtn = document.getElementById("tagironHelpBtn");
const tagironExplainBtn = document.getElementById("tagironExplainBtn");
const tagironHelpModal = document.getElementById("tagironHelpModal");
const tagironHelpModalCloseBtn = document.getElementById("tagironHelpModalCloseBtn");
const tagironHelpContent = document.getElementById("tagironHelpContent");
const tagironExplainModal = document.getElementById("tagironExplainModal");
const tagironExplainModalCloseBtn = document.getElementById("tagironExplainModalCloseBtn");
const tagironExplainContent = document.getElementById("tagironExplainContent");

const tagironPhaseLabel = document.getElementById("tagironPhase");
const tagironRoundLabel = document.getElementById("tagironRound");
const tagironTurnLabel = document.getElementById("tagironTurn");
const tagironGuessTargetLabel = document.getElementById("tagironGuessTarget");
const tagironCentralCountLabel = document.getElementById("tagironCentralCount");
const tagironWinnersLabel = document.getElementById("tagironWinners");

const tagironYourTiles = document.getElementById("tagironYourTiles");
const tagironQuestionPool = document.getElementById("tagironQuestionPool");
const tagironGuessForm = document.getElementById("tagironGuessForm");
const tagironGuessBtn = document.getElementById("tagironGuessBtn");
const tagironLog = document.getElementById("tagironLog");
const tagironPlayers = document.getElementById("tagironPlayers");

const TAGIRON_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Deduce the hidden sequence of colors and numbers by asking questions and reasoning.</p>

  <h3>Setup</h3>
  <ul>
    <li>The system shuffles and deals tiles, then auto-sorts each hand by number ascending (red before blue when equal).</li>
    <li>The question pool always shows 6 available cards.</li>
  </ul>

  <h3>On Your Turn</h3>
  <ol>
    <li><strong>Ask</strong>: Choose a question card. The system computes and broadcasts answers.</li>
    <li><strong>Guess</strong>: Submit a full ordered sequence of color+number.</li>
  </ol>

  <h3>Who Answers</h3>
  <ul>
    <li><strong>Shared cards</strong>: All players, including the asker.</li>
    <li><strong>Non-Shared cards</strong>: In 2/3 player games only opponents answer; in 4 players everyone answers.</li>
  </ul>

  <h3>Guess Outcome</h3>
  <ul>
    <li>2 players: a wrong guess ends your turn but the game continues.</li>
    <li>3/4 players: a wrong guess eliminates you (you still answer questions).</li>
    <li>A correct guess starts round-end countdown; finish the round, then winners are resolved.</li>
  </ul>
`;

const TAGIRON_BUTTON_EXPLANATIONS = {
  tagironGuessBtn: {
    name: "Submit Guess",
    description: "Submit your full ordered guess (color + number per position). A correct guess triggers round-end countdown; a wrong guess may eliminate you.",
  },
};

const TAGIRON_DYNAMIC_EXPLANATIONS = {
  ask_question: {
    name: "Ask Question",
    description: "Choose a question card and submit it. The system computes and broadcasts the answers.",
  },
};

function clearTagironState() {
  currentTagironView = null;
  tagironGuessDrafts = [];
  if (tagironYourTiles) tagironYourTiles.innerHTML = "";
  if (tagironQuestionPool) tagironQuestionPool.innerHTML = "";
  if (tagironGuessForm) tagironGuessForm.innerHTML = "";
  if (tagironLog) tagironLog.innerHTML = "";
  if (tagironPlayers) tagironPlayers.innerHTML = "";
  if (tagironHelpModal) setModalVisible(tagironHelpModal, false);
  if (tagironExplainModal) setModalVisible(tagironExplainModal, false);
}

function ensureTagironGuessDrafts(count) {
  const next = [];
  for (let i = 0; i < count; i += 1) {
    const existing = tagironGuessDrafts[i] || {};
    next.push({ value: existing.value ?? "" });
  }
  tagironGuessDrafts = next;
}

function formatTagironTile(tile) {
  if (!tile) return "-";
  const color = tile.color || "?";
  const number = tile.number ?? "?";
  const prefix = color === "red" ? "R" : color === "blue" ? "B" : "G";
  return `${prefix}${number}`;
}

function renderTagironYourTiles(view) {
  if (!tagironYourTiles) return;
  tagironYourTiles.innerHTML = "";
  const tiles = Array.isArray(view.your_tiles) ? view.your_tiles : [];
  if (!tiles.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No tiles.";
    tagironYourTiles.appendChild(empty);
    return;
  }
  tiles.forEach((tile) => {
    const chip = document.createElement("div");
    chip.className = `tagiron-tile tagiron-${tile.color || "unknown"}`;
    const label = document.createElement("div");
    label.className = "tagiron-tile-number";
    label.textContent = String(tile.number ?? "?");
    const pos = document.createElement("div");
    pos.className = "tagiron-tile-pos";
    pos.textContent = `#${tile.position}`;
    chip.appendChild(label);
    chip.appendChild(pos);
    tagironYourTiles.appendChild(chip);
  });
}

function renderTagironQuestionPool(view) {
  if (!tagironQuestionPool) return;
  tagironQuestionPool.innerHTML = "";
  const pool = Array.isArray(view.question_pool) ? view.question_pool : [];
  const canAsk = Array.isArray(view.legal_actions) && view.legal_actions.includes("ask_question");
  if (!pool.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No questions available.";
    tagironQuestionPool.appendChild(empty);
    return;
  }
  pool.forEach((question) => {
    const card = document.createElement("div");
    card.className = "tagiron-question-card";
    const text = document.createElement("div");
    text.className = "tagiron-question-text";
    text.textContent = question.text || "-";
    if (question.shared_info) {
      const tag = document.createElement("span");
      tag.className = "tagiron-shared-tag";
      tag.textContent = "Shared";
      text.appendChild(tag);
    }
    card.appendChild(text);
    const actions = document.createElement("div");
    actions.className = "tagiron-question-actions";
    const choices = Array.isArray(question.choices) ? question.choices : [];
    if (choices.length) {
      choices.forEach((choice) => {
        const btn = document.createElement("button");
        btn.textContent = `Ask ${choice}`;
        btn.dataset.tagironExplain = "ask_question";
        btn.disabled = !canAsk;
        btn.addEventListener("click", () => {
          sendAction({ type: "ask_question", question_id: question.id, choice });
        });
        actions.appendChild(btn);
      });
    } else {
      const btn = document.createElement("button");
      btn.textContent = "Ask";
      btn.dataset.tagironExplain = "ask_question";
      btn.disabled = !canAsk;
      btn.addEventListener("click", () => {
        sendAction({ type: "ask_question", question_id: question.id });
      });
      actions.appendChild(btn);
    }
    card.appendChild(actions);
    tagironQuestionPool.appendChild(card);
  });
}

function renderTagironGuessForm(view) {
  if (!tagironGuessForm) return;
  tagironGuessForm.innerHTML = "";
  const target = view.guess_target || {};
  const count = Number.isInteger(target.count) ? target.count : 0;
  ensureTagironGuessDrafts(count);
  if (!count) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No guess target.";
    tagironGuessForm.appendChild(empty);
    return;
  }
  const numberOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const optionList = [];
  numberOptions.forEach((num) => {
    if (num === 5) {
      optionList.push({ value: "green:5", label: "🟢 5", color: "#2e6b46" });
      return;
    }
    optionList.push({ value: `red:${num}`, label: `🔴 ${num}`, color: "#b62f2f" });
    optionList.push({ value: `blue:${num}`, label: `🔵 ${num}`, color: "#1f4b8f" });
  });

  for (let i = 0; i < count; i += 1) {
    const row = document.createElement("div");
    row.className = "tagiron-guess-row";
    const label = document.createElement("div");
    label.className = "tagiron-guess-label";
    label.textContent = `Pos ${i + 1}`;
    row.appendChild(label);

    const select = document.createElement("select");
    select.className = "tagiron-guess-tile";
    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "Select tile";
    select.appendChild(emptyOpt);
    optionList.forEach((optData) => {
      const opt = document.createElement("option");
      opt.value = optData.value;
      opt.textContent = optData.label;
      if (optData.color) {
        opt.style.color = optData.color;
        opt.style.fontWeight = "600";
      }
      select.appendChild(opt);
    });
    select.value = tagironGuessDrafts[i].value ?? "";
    select.addEventListener("change", (event) => {
      tagironGuessDrafts[i].value = event.target.value;
      updateTagironGuessButton();
    });
    row.appendChild(select);

    tagironGuessForm.appendChild(row);
  }
}

function formatTagironAnswer(answer) {
  if (!answer || typeof answer !== "object") return "-";
  if (answer.kind === "number") return String(answer.value ?? "-");
  if (answer.kind === "boolean") return answer.value ? "Yes" : "No";
  if (answer.kind === "positions") {
    const positions = Array.isArray(answer.positions) ? answer.positions : [];
    return positions.length ? positions.join(", ") : "None";
  }
  if (answer.kind === "pairs") {
    const pairs = Array.isArray(answer.pairs) ? answer.pairs : [];
    return pairs.length ? pairs.map((pair) => pair.join("-")).join(", ") : "None";
  }
  return "-";
}

function renderTagironLog(view) {
  if (!tagironLog) return;
  tagironLog.innerHTML = "";
  const entries = Array.isArray(view.log) ? view.log : [];
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No log entries yet.";
    tagironLog.appendChild(empty);
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "tagiron-log-entry";
    if (entry.type === "question") {
      const asker = findPlayerName(view, entry.asker);
      const title = document.createElement("div");
      title.className = "tagiron-log-title";
      const choiceText = entry.choice !== null && entry.choice !== undefined ? ` (choose ${entry.choice})` : "";
      title.textContent = `T${entry.turn} ${asker} asked: ${entry.question_text || "-"}${choiceText}`;
      row.appendChild(title);
      const answers = entry.answers || {};
      Object.keys(answers).forEach((pid) => {
        const line = document.createElement("div");
        line.className = "tagiron-log-line";
        const name = findPlayerName(view, pid);
        line.textContent = `${name}: ${formatTagironAnswer(answers[pid])}`;
        row.appendChild(line);
      });
    } else if (entry.type === "guess") {
      const name = findPlayerName(view, entry.player_id);
      const tiles = Array.isArray(entry.tiles) ? entry.tiles.map(formatTagironTile).join(", ") : "-";
      const text = document.createElement("div");
      text.className = "tagiron-log-title";
      text.textContent = `T${entry.turn} ${name} guessed (${entry.target}): ${tiles}`;
      row.appendChild(text);
      const result = document.createElement("div");
      result.className = `tagiron-log-line ${entry.correct ? "tagiron-correct" : "tagiron-wrong"}`;
      result.textContent = entry.correct ? "Correct" : "Wrong";
      row.appendChild(result);
    }
    tagironLog.appendChild(row);
  });
}

function renderTagironPlayers(view) {
  if (!tagironPlayers) return;
  tagironPlayers.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card tagiron-player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (player.eliminated) {
      card.classList.add("disabled");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id;
    const meta = document.createElement("div");
    meta.className = "player-meta";
    meta.textContent = `tiles ${player.tile_count}`;
    card.appendChild(name);
    card.appendChild(meta);

    if (view.revealed && view.revealed.players && view.revealed.players[player.player_id]) {
      const reveal = document.createElement("div");
      reveal.className = "tagiron-reveal";
      const tiles = view.revealed.players[player.player_id].map(formatTagironTile).join(", ");
      reveal.textContent = tiles || "-";
      card.appendChild(reveal);
    }
    tagironPlayers.appendChild(card);
  });
  if (view.revealed && view.revealed.center && view.revealed.center.length) {
    const center = document.createElement("div");
    center.className = "tagiron-center-reveal";
    center.textContent = `Center: ${view.revealed.center.map(formatTagironTile).join(", ")}`;
    tagironPlayers.appendChild(center);
  }
}

function updateTagironGuessButton() {
  if (!tagironGuessBtn || !currentTagironView) return;
  const canGuess =
    Array.isArray(currentTagironView.legal_actions) &&
    currentTagironView.legal_actions.includes("guess_tiles");
  const ready =
    tagironGuessDrafts.length &&
    tagironGuessDrafts.every((entry) => entry.value);
  tagironGuessBtn.disabled = !(canGuess && ready);
}

let tagironExplainMode = false;

function showTagironHeaderActions(show) {
  if (tagironHeaderActions) {
    tagironHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitTagironExplainMode();
    closeTagironHelpModal();
    closeTagironExplainModal();
  }
}

function showTagironHelpModal() {
  if (!tagironHelpModal) return;
  if (tagironHelpContent) {
    tagironHelpContent.innerHTML = TAGIRON_HELP_TEXT;
  }
  setModalVisible(tagironHelpModal, true);
}

function closeTagironHelpModal() {
  if (tagironHelpModal) {
    setModalVisible(tagironHelpModal, false);
  }
}

function updateTagironExplainClasses(enabled) {
  Object.keys(TAGIRON_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
  document.querySelectorAll("[data-tagiron-explain]").forEach((node) => {
    node.classList.toggle("has-explanation", enabled);
  });
}

function findTagironExplainTargetAtPoint(x, y) {
  for (const buttonId of Object.keys(TAGIRON_BUTTON_EXPLANATIONS)) {
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return { type: "button", key: buttonId };
    }
  }
  const nodes = document.querySelectorAll("[data-tagiron-explain]");
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return { type: "dynamic", key: node.dataset.tagironExplain };
    }
  }
  return null;
}

function toggleTagironExplainMode() {
  tagironExplainMode = !tagironExplainMode;
  document.body.classList.toggle("tagiron-explain-mode", tagironExplainMode);
  updateTagironExplainClasses(tagironExplainMode);
  if (tagironExplainBtn) {
    tagironExplainBtn.classList.toggle("active", tagironExplainMode);
  }
}

function exitTagironExplainMode() {
  if (!tagironExplainMode) {
    return;
  }
  tagironExplainMode = false;
  document.body.classList.remove("tagiron-explain-mode");
  updateTagironExplainClasses(false);
  if (tagironExplainBtn) {
    tagironExplainBtn.classList.remove("active");
  }
}

function showTagironButtonExplanation(target) {
  let explanation = null;
  if (target.type === "button") {
    explanation = TAGIRON_BUTTON_EXPLANATIONS[target.key];
  } else if (target.type === "dynamic") {
    explanation = TAGIRON_DYNAMIC_EXPLANATIONS[target.key];
  }
  if (!explanation || !tagironExplainContent || !tagironExplainModal) {
    return;
  }
  tagironExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
  `;
  setModalVisible(tagironExplainModal, true);
}

function closeTagironExplainModal() {
  if (tagironExplainModal) {
    setModalVisible(tagironExplainModal, false);
  }
}

function renderTagironGameState(data) {
  if (!data || data.game_type !== "tagiron") return;
  const view = data.view || {};
  currentTagironView = view;

  if (tagironPhaseLabel) tagironPhaseLabel.textContent = view.phase || "-";
  if (tagironRoundLabel) tagironRoundLabel.textContent = view.round ?? "-";
  if (tagironTurnLabel) tagironTurnLabel.textContent = findPlayerName(view, view.current_turn) || "-";
  if (tagironGuessTargetLabel) {
    const target = view.guess_target || {};
    const label = target.type === "center" ? "Center" : "Opponent";
    tagironGuessTargetLabel.textContent = `${label} (${target.count ?? 0})`;
  }
  if (tagironCentralCountLabel) tagironCentralCountLabel.textContent = view.central_count ?? 0;
  if (tagironWinnersLabel) {
    const winners = Array.isArray(view.winners) ? view.winners : [];
    tagironWinnersLabel.textContent = winners.length
      ? winners.map((pid) => findPlayerName(view, pid)).join(", ")
      : "-";
  }

  renderTagironYourTiles(view);
  renderTagironQuestionPool(view);
  renderTagironGuessForm(view);
  renderTagironLog(view);
  renderTagironPlayers(view);
  updateTagironGuessButton();
  if (tagironExplainMode) {
    updateTagironExplainClasses(true);
  }
}

if (tagironGuessBtn) {
  tagironGuessBtn.addEventListener("click", () => {
    if (!currentTagironView) return;
    const tiles = tagironGuessDrafts.map((entry) => {
      const [color, numberRaw] = String(entry.value || "").split(":");
      return {
        color,
        number: Number.parseInt(numberRaw, 10),
      };
    });
    sendAction({ type: "guess_tiles", tiles });
  });
}

if (tagironHelpBtn) {
  tagironHelpBtn.addEventListener("click", () => {
    showTagironHelpModal();
  });
}

if (tagironHelpModalCloseBtn) {
  tagironHelpModalCloseBtn.addEventListener("click", closeTagironHelpModal);
}

if (tagironExplainBtn) {
  tagironExplainBtn.addEventListener("click", () => {
    toggleTagironExplainMode();
  });
}

if (tagironExplainModalCloseBtn) {
  tagironExplainModalCloseBtn.addEventListener("click", closeTagironExplainModal);
}

document.addEventListener("pointerdown", (e) => {
  if (!tagironExplainMode) return;

  const target = findTagironExplainTargetAtPoint(e.clientX, e.clientY);
  if (target) {
    e.preventDefault();
    e.stopPropagation();
    showTagironButtonExplanation(target);
    exitTagironExplainMode();
    return;
  }

  const button = e.target.closest("button");
  if (button === tagironExplainBtn || button === tagironHelpBtn) return;
  if (button === tagironHelpModalCloseBtn || button === tagironExplainModalCloseBtn) return;

  if (button) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

document.addEventListener("click", (e) => {
  if (!tagironExplainMode) return;

  const button = e.target.closest("button");
  if (!button) return;
  if (button === tagironExplainBtn || button === tagironHelpBtn) return;
  if (button === tagironHelpModalCloseBtn || button === tagironExplainModalCloseBtn) return;

  e.preventDefault();
  e.stopPropagation();
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && tagironExplainMode) {
    exitTagironExplainMode();
  }
});

window.showTagironHeaderActions = showTagironHeaderActions;
