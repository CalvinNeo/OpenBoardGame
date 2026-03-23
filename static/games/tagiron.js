let currentTagironView = null;
let tagironGuessDrafts = [];

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

function clearTagironState() {
  currentTagironView = null;
  tagironGuessDrafts = [];
  if (tagironYourTiles) tagironYourTiles.innerHTML = "";
  if (tagironQuestionPool) tagironQuestionPool.innerHTML = "";
  if (tagironGuessForm) tagironGuessForm.innerHTML = "";
  if (tagironLog) tagironLog.innerHTML = "";
  if (tagironPlayers) tagironPlayers.innerHTML = "";
}

function ensureTagironGuessDrafts(count) {
  const next = [];
  for (let i = 0; i < count; i += 1) {
    const existing = tagironGuessDrafts[i] || {};
    next.push({ color: existing.color ?? "", number: existing.number ?? "" });
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
        btn.disabled = !canAsk;
        btn.addEventListener("click", () => {
          sendAction({ type: "ask_question", question_id: question.id, choice });
        });
        actions.appendChild(btn);
      });
    } else {
      const btn = document.createElement("button");
      btn.textContent = "Ask";
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
  for (let i = 0; i < count; i += 1) {
    const row = document.createElement("div");
    row.className = "tagiron-guess-row";
    const label = document.createElement("div");
    label.className = "tagiron-guess-label";
    label.textContent = `Pos ${i + 1}`;
    row.appendChild(label);

    const numberSelect = document.createElement("select");
    numberSelect.className = "tagiron-guess-number";
    const emptyNum = document.createElement("option");
    emptyNum.value = "";
    emptyNum.textContent = "Number";
    numberSelect.appendChild(emptyNum);
    for (let n = 0; n <= 9; n += 1) {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      numberSelect.appendChild(opt);
    }
    numberSelect.value = tagironGuessDrafts[i].number ?? "";
    numberSelect.addEventListener("change", (event) => {
      tagironGuessDrafts[i].number = event.target.value;
      updateTagironGuessButton();
    });
    row.appendChild(numberSelect);

    const colorSelect = document.createElement("select");
    colorSelect.className = "tagiron-guess-color";
    const emptyColor = document.createElement("option");
    emptyColor.value = "";
    emptyColor.textContent = "Color";
    colorSelect.appendChild(emptyColor);
    ["red", "blue", "green"].forEach((color) => {
      const opt = document.createElement("option");
      opt.value = color;
      opt.textContent = color;
      colorSelect.appendChild(opt);
    });
    colorSelect.value = tagironGuessDrafts[i].color ?? "";
    colorSelect.addEventListener("change", (event) => {
      tagironGuessDrafts[i].color = event.target.value;
      updateTagironGuessButton();
    });
    row.appendChild(colorSelect);

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
    tagironGuessDrafts.every((entry) => entry.color && entry.number !== "");
  tagironGuessBtn.disabled = !(canGuess && ready);
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
}

if (tagironGuessBtn) {
  tagironGuessBtn.addEventListener("click", () => {
    if (!currentTagironView) return;
    const tiles = tagironGuessDrafts.map((entry) => ({
      color: entry.color,
      number: Number.parseInt(entry.number, 10),
    }));
    sendAction({ type: "guess_tiles", tiles });
  });
}
