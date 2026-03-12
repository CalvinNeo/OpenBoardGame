function updateMismatchButtons(view) {
  if (!mismatchRevealBtn || !mismatchNextRoundBtn || !mismatchPlayAgainBtn) {
    return;
  }
  const actions = view && Array.isArray(view.legal_actions) ? view.legal_actions : [];
  const revealAllowed = actions.includes("reveal");
  mismatchRevealBtn.disabled = !revealAllowed;
  mismatchRevealBtn.classList.toggle("action-allowed", revealAllowed);
  const nextAllowed = actions.includes("next_round");
  mismatchNextRoundBtn.disabled = !nextAllowed;
  mismatchNextRoundBtn.classList.toggle("action-allowed", nextAllowed);
  const playAllowed = actions.includes("play_again");
  mismatchPlayAgainBtn.disabled = !playAllowed;
  mismatchPlayAgainBtn.classList.toggle("action-allowed", playAllowed);
}

function renderMismatchWords(view) {
  if (!mismatchWords) {
    return;
  }
  mismatchWords.innerHTML = "";
  const words = Array.isArray(view.words) ? view.words : [];
  const canGuess = Array.isArray(view.legal_actions) && view.legal_actions.includes("submit_guess");
  const yourGuess = view.your_guess;
  words.forEach((word, index) => {
    const card = document.createElement("div");
    card.className = "mismatch-word-card";
    if (yourGuess && yourGuess.choice === index) {
      card.classList.add("guessed");
    }
    if (view.target_index === index) {
      card.classList.add("target");
    }

    const title = document.createElement("div");
    title.className = "mismatch-word-title";
    title.textContent = `${index + 1}. ${word}`;
    card.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "mismatch-word-actions";
    const guessBtn = document.createElement("button");
    guessBtn.type = "button";
    guessBtn.textContent = "Guess";
    guessBtn.disabled = !canGuess || !!yourGuess;
    guessBtn.addEventListener("click", () => {
      sendAction({ type: "submit_guess", choice_index: index });
    });
    actions.appendChild(guessBtn);

    if (yourGuess && yourGuess.choice === index) {
      const locked = document.createElement("span");
      const order = Number.isInteger(yourGuess.order) ? `#${yourGuess.order}` : "#-";
      locked.textContent = `Locked ${order}`;
      actions.appendChild(locked);
    }

    card.appendChild(actions);
    mismatchWords.appendChild(card);
  });
}

const MISMATCH_SLIDER_LEFT_COLOR = [220, 38, 38];
const MISMATCH_SLIDER_RIGHT_COLOR = [37, 99, 235];

function getMismatchSliderColor(ratio) {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const r = Math.round(
    MISMATCH_SLIDER_LEFT_COLOR[0] +
      (MISMATCH_SLIDER_RIGHT_COLOR[0] - MISMATCH_SLIDER_LEFT_COLOR[0]) * clamped
  );
  const g = Math.round(
    MISMATCH_SLIDER_LEFT_COLOR[1] +
      (MISMATCH_SLIDER_RIGHT_COLOR[1] - MISMATCH_SLIDER_LEFT_COLOR[1]) * clamped
  );
  const b = Math.round(
    MISMATCH_SLIDER_LEFT_COLOR[2] +
      (MISMATCH_SLIDER_RIGHT_COLOR[2] - MISMATCH_SLIDER_LEFT_COLOR[2]) * clamped
  );
  return `rgb(${r}, ${g}, ${b})`;
}

function updateMismatchSliderColor(input) {
  if (!input) {
    return;
  }
  const rawValue = Number.parseInt(input.value, 10);
  const rawMin = Number.parseInt(input.min, 10);
  const rawMax = Number.parseInt(input.max, 10);
  const minValue = Number.isInteger(rawMin) ? rawMin : 0;
  const maxValue = Number.isInteger(rawMax) ? rawMax : 10;
  const fallback = minValue + (maxValue - minValue) / 2;
  const value = Number.isInteger(rawValue) ? rawValue : fallback;
  const clampedValue = Math.min(Math.max(value, minValue), maxValue);
  const ratio = maxValue > minValue ? (clampedValue - minValue) / (maxValue - minValue) : 0.5;
  input.style.setProperty("--mismatch-slider-color", getMismatchSliderColor(ratio));
}

function renderMismatchSliders(view) {
  if (!mismatchSliders) {
    return;
  }
  mismatchSliders.innerHTML = "";
  const sliders = Array.isArray(view.sliders) ? view.sliders : [];
  const isLeader = view.leader_id === view.you;
  const canSet = Array.isArray(view.legal_actions) && view.legal_actions.includes("set_slider");
  const activeIndex = Number.isInteger(view.active_slider_index) ? view.active_slider_index : 0;

  sliders.forEach((slider, index) => {
    const row = document.createElement("div");
    row.className = "mismatch-slider-row";

    const left = document.createElement("div");
    left.className = "mismatch-slider-label left";
    left.textContent = slider.left_attr || "-";

    const right = document.createElement("div");
    right.className = "mismatch-slider-label right";
    right.textContent = slider.right_attr || "-";

    const valueLabel = document.createElement("div");
    valueLabel.className = "mismatch-slider-value";
    const value = Number.isInteger(slider.value) ? slider.value : null;
    valueLabel.textContent = value === null ? "?" : String(value);

    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "10";
    input.step = "1";
    input.value = value === null ? "5" : String(value);
    input.className = "mismatch-slider";
    if (value === null) {
      input.classList.add("pending");
    }
    const isActive = isLeader && canSet && index === activeIndex;
    input.disabled = !isActive;
    updateMismatchSliderColor(input);
    input.addEventListener("input", () => {
      updateMismatchSliderColor(input);
    });

    const setBtn = document.createElement("button");
    setBtn.type = "button";
    setBtn.textContent = "Set";
    setBtn.className = "mismatch-slider-set";
    setBtn.disabled = !isActive;
    setBtn.addEventListener("click", () => {
      const rawValue = Number.parseInt(input.value, 10);
      const sliderValue = Number.isInteger(rawValue) ? rawValue : 5;
      sendAction({ type: "set_slider", slider_index: index, value: sliderValue });
    });

    const sliderLine = document.createElement("div");
    sliderLine.className = "mismatch-slider-line";
    sliderLine.appendChild(input);
    sliderLine.appendChild(valueLabel);

    const labelsLine = document.createElement("div");
    labelsLine.className = "mismatch-slider-labels";
    labelsLine.appendChild(left);
    labelsLine.appendChild(setBtn);
    labelsLine.appendChild(right);

    row.appendChild(sliderLine);
    row.appendChild(labelsLine);
    mismatchSliders.appendChild(row);
  });
}

function renderMismatchPlayers(view) {
  if (!mismatchPlayers) {
    return;
  }
  mismatchPlayers.innerHTML = "";
  view.players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "player-row";
    const tags = [];
    if (player.player_id === view.leader_id) {
      tags.push("leader");
    }
    if (player.is_bot) {
      tags.push("bot");
    }
    if (player.guessed) {
      const order = Number.isInteger(player.guess_order) ? `#${player.guess_order}` : "#-";
      tags.push(`guessed ${order}`);
    }
    const suffix = tags.length ? ` (${tags.join(", ")})` : "";
    row.textContent = `${player.name} - ${player.score} pts${suffix}`;
    mismatchPlayers.appendChild(row);
  });
}

function renderMismatchSummary(view) {
  if (!mismatchRoundSummary || !mismatchRoundSummaryBody || !mismatchRoundSummaryGuesses) {
    return;
  }
  const summary = view.last_round_summary;
  if (!summary) {
    mismatchRoundSummary.classList.add("hidden");
    mismatchRoundSummaryBody.textContent = "-";
    mismatchRoundSummaryGuesses.innerHTML = "";
    return;
  }

  const leaderName = findPlayerName(view, summary.leader_id);
  const leaderDelta = summary.leader_delta;
  const deltaLabel = leaderDelta >= 0 ? `+${leaderDelta}` : String(leaderDelta);
  const correctLabel = `${summary.correct_count}/${summary.guess_count}`;
  mismatchRoundSummaryBody.textContent = `${leaderName} target: ${summary.target_word} | correct ${correctLabel} | leader ${deltaLabel}`;

  mismatchRoundSummaryGuesses.innerHTML = "";
  const words = Array.isArray(summary.words) ? summary.words : [];
  const guesses = Array.isArray(summary.guesses) ? summary.guesses : [];
  guesses.forEach((entry) => {
    const line = document.createElement("div");
    const choiceLabel =
      Number.isInteger(entry.choice_index) && words[entry.choice_index]
        ? `${entry.choice_index + 1}. ${words[entry.choice_index]}`
        : "-";
    const orderLabel = Number.isInteger(entry.order) ? `#${entry.order}` : "-";
    const resultLabel = entry.correct ? "correct" : "wrong";
    const pointsLabel = entry.points ? `+${entry.points}` : "0";
    line.textContent = `${entry.name}: ${choiceLabel} (${orderLabel}, ${resultLabel}, ${pointsLabel})`;
    mismatchRoundSummaryGuesses.appendChild(line);
  });

  mismatchRoundSummary.classList.remove("hidden");
}
