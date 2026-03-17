const blitzSketchConfigBox = document.getElementById("blitzSketchConfigBox");
const blitzSketchDrawTimeRow = document.getElementById("blitzSketchDrawTimeRow");
const blitzSketchDrawTimeSelect = document.getElementById("blitzSketchDrawTimeSelect");

const blitzSketchPanel = document.getElementById("blitzSketchPanel");

const blitzSketchPhaseLabel = document.getElementById("blitzSketchPhase");
const blitzSketchDrawProgressLabel = document.getElementById("blitzSketchDrawProgress");
const blitzSketchGuessProgressLabel = document.getElementById("blitzSketchGuessProgress");
const blitzSketchScoreLabel = document.getElementById("blitzSketchScore");
const blitzSketchPromptLabel = document.getElementById("blitzSketchPrompt");
const blitzSketchTimerLabel = document.getElementById("blitzSketchTimer");
const blitzSketchDrawArea = document.getElementById("blitzSketchDrawArea");
const blitzSketchGuessArea = document.getElementById("blitzSketchGuessArea");
const blitzSketchCanvas = document.getElementById("blitzSketchCanvas");
const blitzSketchImage = document.getElementById("blitzSketchImage");
const blitzSketchInput = document.getElementById("blitzSketchInput");
const blitzSketchSubmitGuessBtn = document.getElementById("blitzSketchSubmitGuessBtn");
const blitzSketchSkipBtn = document.getElementById("blitzSketchSkipBtn");
const blitzSketchFeedback = document.getElementById("blitzSketchFeedback");
const blitzSketchRevealRow = document.getElementById("blitzSketchRevealRow");
const blitzSketchRevealAnswer = document.getElementById("blitzSketchRevealAnswer");
const blitzSketchPlayers = document.getElementById("blitzSketchPlayers");
const blitzSketchReview = document.getElementById("blitzSketchReview");
const blitzSketchReviewGrid = document.getElementById("blitzSketchReviewGrid");
const blitzSketchCtx = blitzSketchCanvas ? blitzSketchCanvas.getContext("2d") : null;

let currentBlitzSketchView = null;

let blitzSketchIsDrawing = false;
let blitzSketchDrawDeadline = null;
let blitzSketchDrawTimer = null;
let blitzSketchCountdownTimer = null;
let blitzSketchActiveDrawIndex = null;
let blitzSketchSubmittedDrawIndex = null;
let blitzSketchRevealTimer = null;
let blitzSketchRevealUntil = null;

function updateBlitzSketchConfigRow() {
  const showRow = currentRoomState && currentGameType === "blitz_sketch" && currentRoomState.status === "lobby";
  if (blitzSketchConfigBox) {
    blitzSketchConfigBox.classList.toggle("hidden", !showRow);
    blitzSketchConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (blitzSketchDrawTimeRow) {
    blitzSketchDrawTimeRow.classList.toggle("hidden", !showRow);
    blitzSketchDrawTimeRow.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function clearBlitzSketchState() {
  currentBlitzSketchView = null;
  blitzSketchIsDrawing = false;
  blitzSketchActiveDrawIndex = null;
  blitzSketchSubmittedDrawIndex = null;
  stopBlitzSketchTimers();
  if (blitzSketchPhaseLabel) {
    blitzSketchPhaseLabel.textContent = "-";
  }
  if (blitzSketchDrawProgressLabel) {
    blitzSketchDrawProgressLabel.textContent = "-";
  }
  if (blitzSketchGuessProgressLabel) {
    blitzSketchGuessProgressLabel.textContent = "-";
  }
  if (blitzSketchScoreLabel) {
    blitzSketchScoreLabel.textContent = "-";
  }
  if (blitzSketchPromptLabel) {
    blitzSketchPromptLabel.textContent = "-";
  }
  if (blitzSketchTimerLabel) {
    blitzSketchTimerLabel.textContent = "-";
  }
  if (blitzSketchFeedback) {
    blitzSketchFeedback.textContent = "";
  }
  if (blitzSketchRevealRow) {
    blitzSketchRevealRow.classList.add("hidden");
  }
  if (blitzSketchRevealAnswer) {
    blitzSketchRevealAnswer.textContent = "-";
  }
  if (blitzSketchPlayers) {
    blitzSketchPlayers.innerHTML = "";
  }
  if (blitzSketchReviewGrid) {
    blitzSketchReviewGrid.innerHTML = "";
  }
  if (blitzSketchReview) {
    blitzSketchReview.classList.add("hidden");
  }
  if (blitzSketchDrawArea) {
    blitzSketchDrawArea.classList.add("hidden");
  }
  if (blitzSketchGuessArea) {
    blitzSketchGuessArea.classList.add("hidden");
  }
  if (blitzSketchInput) {
    blitzSketchInput.value = "";
  }
  if (blitzSketchImage) {
    blitzSketchImage.removeAttribute("src");
  }
  clearBlitzSketchCanvas();
  updateBlitzSketchButtons();
}

function stopBlitzSketchDrawTimer() {
  if (blitzSketchDrawTimer) {
    clearTimeout(blitzSketchDrawTimer);
    blitzSketchDrawTimer = null;
  }
}

function stopBlitzSketchCountdown() {
  if (blitzSketchCountdownTimer) {
    clearInterval(blitzSketchCountdownTimer);
    blitzSketchCountdownTimer = null;
  }
  blitzSketchDrawDeadline = null;
}

function stopBlitzSketchDrawTimers() {
  stopBlitzSketchDrawTimer();
  stopBlitzSketchCountdown();
}

function stopBlitzSketchRevealTimer() {
  if (blitzSketchRevealTimer) {
    clearTimeout(blitzSketchRevealTimer);
    blitzSketchRevealTimer = null;
  }
  blitzSketchRevealUntil = null;
}

function stopBlitzSketchTimers() {
  stopBlitzSketchDrawTimers();
  stopBlitzSketchRevealTimer();
}

function clearBlitzSketchCanvas() {
  if (!blitzSketchCtx || !blitzSketchCanvas) {
    return;
  }
  blitzSketchCtx.fillStyle = "#fff";
  blitzSketchCtx.fillRect(0, 0, blitzSketchCanvas.width, blitzSketchCanvas.height);
  blitzSketchCtx.beginPath();
}

function getBlitzSketchPosition(event) {
  const rect = blitzSketchCanvas.getBoundingClientRect();
  const point = event.touches ? event.touches[0] : event;
  const scaleX = rect.width ? blitzSketchCanvas.width / rect.width : 1;
  const scaleY = rect.height ? blitzSketchCanvas.height / rect.height : 1;
  return {
    x: (point.clientX - rect.left) * scaleX,
    y: (point.clientY - rect.top) * scaleY,
  };
}

function isBlitzSketchDrawingAllowed() {
  return isBlitzSketchActionAvailable("submit_drawing");
}

function startBlitzSketch(event) {
  if (!blitzSketchCtx || !blitzSketchCanvas || !isBlitzSketchDrawingAllowed()) {
    return;
  }
  event.preventDefault();
  blitzSketchIsDrawing = true;
  const pos = getBlitzSketchPosition(event);
  blitzSketchCtx.beginPath();
  blitzSketchCtx.moveTo(pos.x, pos.y);
}

function moveBlitzSketch(event) {
  if (!blitzSketchIsDrawing || !blitzSketchCtx) {
    return;
  }
  event.preventDefault();
  const pos = getBlitzSketchPosition(event);
  blitzSketchCtx.lineTo(pos.x, pos.y);
  blitzSketchCtx.stroke();
}

function resetBlitzSketchDrawingState() {
  blitzSketchIsDrawing = false;
  if (blitzSketchCtx) {
    blitzSketchCtx.beginPath();
  }
}

function endBlitzSketch(event) {
  if (!blitzSketchIsDrawing || !blitzSketchCtx) {
    return;
  }
  event.preventDefault();
  resetBlitzSketchDrawingState();
}

function setupBlitzSketchCanvas() {
  if (!blitzSketchCanvas || !blitzSketchCtx) {
    return;
  }
  blitzSketchCtx.lineCap = "round";
  blitzSketchCtx.lineWidth = 3;
  blitzSketchCtx.strokeStyle = "#000000";
  blitzSketchCtx.globalCompositeOperation = "source-over";
  clearBlitzSketchCanvas();

  blitzSketchCanvas.addEventListener("mousedown", startBlitzSketch);
  blitzSketchCanvas.addEventListener("mousemove", moveBlitzSketch);
  blitzSketchCanvas.addEventListener("mouseup", endBlitzSketch);
  blitzSketchCanvas.addEventListener("mouseleave", endBlitzSketch);

  blitzSketchCanvas.addEventListener("touchstart", startBlitzSketch, { passive: false });
  blitzSketchCanvas.addEventListener("touchmove", moveBlitzSketch, { passive: false });
  blitzSketchCanvas.addEventListener("touchend", endBlitzSketch, { passive: false });
  blitzSketchCanvas.addEventListener("touchcancel", endBlitzSketch, { passive: false });
}

function setBlitzSketchTimer(deadlineMs) {
  if (!blitzSketchTimerLabel) {
    return;
  }
  if (!deadlineMs) {
    blitzSketchTimerLabel.textContent = "-";
    return;
  }
  const remaining = Math.max(0, deadlineMs - Date.now());
  blitzSketchTimerLabel.textContent = `${(remaining / 1000).toFixed(1)}s`;
}

function startBlitzSketchCountdown(deadlineMs) {
  stopBlitzSketchCountdown();
  blitzSketchDrawDeadline = deadlineMs;
  setBlitzSketchTimer(deadlineMs);
  blitzSketchCountdownTimer = setInterval(() => {
    if (!blitzSketchDrawDeadline) {
      stopBlitzSketchCountdown();
      return;
    }
    setBlitzSketchTimer(blitzSketchDrawDeadline);
    if (Date.now() >= blitzSketchDrawDeadline) {
      stopBlitzSketchCountdown();
    }
  }, 100);
}

function scheduleBlitzSketchAutoSubmit(view) {
  if (!view || view.phase !== "draw") {
    stopBlitzSketchDrawTimers();
    return;
  }
  if (!Number.isInteger(view.draw_index) || !Number.isInteger(view.draw_total)) {
    stopBlitzSketchDrawTimers();
    return;
  }
  if (view.draw_index >= view.draw_total) {
    stopBlitzSketchDrawTimers();
    return;
  }
  if (blitzSketchSubmittedDrawIndex === view.draw_index) {
    stopBlitzSketchDrawTimers();
    if (blitzSketchTimerLabel) {
      blitzSketchTimerLabel.textContent = "-";
    }
    return;
  }
  const isNewIndex = blitzSketchActiveDrawIndex !== view.draw_index;
  if (blitzSketchActiveDrawIndex === view.draw_index && blitzSketchDrawTimer) {
    return;
  }
  blitzSketchActiveDrawIndex = view.draw_index;
  if (isNewIndex) {
    resetBlitzSketchDrawingState();
    clearBlitzSketchCanvas();
  }
  const durationSec = Number.isFinite(view.draw_time_sec) ? view.draw_time_sec : 3;
  const durationMs = Math.max(500, durationSec * 1000);
  const deadline = Date.now() + durationMs;
  startBlitzSketchCountdown(deadline);
  blitzSketchDrawTimer = setTimeout(() => {
    blitzSketchDrawTimer = null;
    if (!blitzSketchCanvas || !isBlitzSketchActionAvailable("submit_drawing")) {
      return;
    }
    blitzSketchSubmittedDrawIndex = view.draw_index;
    sendAction({ type: "submit_drawing", image_data: blitzSketchCanvas.toDataURL("image/png"), index: view.draw_index });
  }, durationMs);
}

function scheduleBlitzSketchReveal(view) {
  stopBlitzSketchRevealTimer();
  if (!view || !view.reveal || !view.reveal.until_ms) {
    return;
  }
  const until = view.reveal.until_ms;
  if (!Number.isFinite(until) || until <= Date.now()) {
    return;
  }
  blitzSketchRevealUntil = until;
  blitzSketchRevealTimer = setTimeout(() => {
    blitzSketchRevealTimer = null;
    blitzSketchRevealUntil = null;
    if (lastGameStatePayload) {
      renderBlitzSketchGameState(lastGameStatePayload);
    }
  }, Math.max(0, until - Date.now()));
}

function isBlitzSketchActionAvailable(actionType) {
  if (currentGameType !== "blitz_sketch" || !currentBlitzSketchView) {
    return false;
  }
  const legal = Array.isArray(currentBlitzSketchView.legal_actions) ? currentBlitzSketchView.legal_actions : [];
  if (!legal.includes(actionType)) {
    const reveal = currentBlitzSketchView.reveal;
    const revealExpired =
      reveal && Number.isFinite(reveal.until_ms) ? reveal.until_ms <= Date.now() : false;
    if (!(revealExpired && (actionType === "submit_guess" || actionType === "skip_guess"))) {
      return false;
    }
  }
  if (actionType === "submit_guess") {
    return !!(blitzSketchInput && blitzSketchInput.value.trim());
  }
  return true;
}

function isBlitzSketchGuessAllowed() {
  if (currentGameType !== "blitz_sketch" || !currentBlitzSketchView) {
    return false;
  }
  if (currentBlitzSketchView.phase !== "guess") {
    return false;
  }
  const legal = Array.isArray(currentBlitzSketchView.legal_actions)
    ? currentBlitzSketchView.legal_actions
    : [];
  if (legal.includes("submit_guess") || legal.includes("skip_guess")) {
    return true;
  }
  const reveal = currentBlitzSketchView.reveal;
  if (reveal && Number.isFinite(reveal.until_ms)) {
    return reveal.until_ms <= Date.now();
  }
  return false;
}

function updateBlitzSketchButtons() {
  if (!blitzSketchSubmitGuessBtn || !blitzSketchSkipBtn) {
    return;
  }
  if (currentGameType !== "blitz_sketch") {
    blitzSketchSubmitGuessBtn.disabled = true;
    blitzSketchSkipBtn.disabled = true;
    return;
  }
  blitzSketchSubmitGuessBtn.disabled = !isBlitzSketchActionAvailable("submit_guess");
  blitzSketchSkipBtn.disabled = !isBlitzSketchActionAvailable("skip_guess");
}

function formatBlitzSketchGuess(entry) {
  if (!entry) {
    return "-";
  }
  if (entry.guess_text === null || entry.guess_text === undefined) {
    return "跳过";
  }
  if (typeof entry.guess_text === "string" && entry.guess_text.trim()) {
    return entry.guess_text;
  }
  return "-";
}

function renderBlitzSketchPlayers(view) {
  if (!blitzSketchPlayers) {
    return;
  }
  blitzSketchPlayers.innerHTML = "";
  (view.players || []).forEach((p) => {
    const line = document.createElement("div");
    const tags = [];
    if (p.player_id === view.you) {
      tags.push("you");
    }
    if (p.is_bot) {
      tags.push("bot");
    }
    const drawProgress = `${p.draw_count}/${p.draw_total}`;
    const guessProgress = `${p.guess_count}/${p.guess_total}`;
    line.textContent =
      `${p.seat + 1}. ${p.name || p.player_id} (${tags.join(", ") || "player"})` +
      ` · Draw ${drawProgress} · Guess ${guessProgress} · Score ${p.score}`;
    blitzSketchPlayers.appendChild(line);
  });
}

function renderBlitzSketchReview(view) {
  if (!blitzSketchReview || !blitzSketchReviewGrid) {
    return;
  }
  if (!view.review || !view.review.players) {
    blitzSketchReview.classList.add("hidden");
    blitzSketchReviewGrid.innerHTML = "";
    return;
  }
  blitzSketchReview.classList.remove("hidden");
  blitzSketchReviewGrid.innerHTML = "";
  view.review.players.forEach((player) => {
    const wrapper = document.createElement("div");
    wrapper.className = "blitz-sketch-review-player";
    const title = document.createElement("div");
    const name = player.name || player.player_id || "player";
    title.textContent = `${name} · Score ${player.score ?? 0}`;
    wrapper.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "blitz-sketch-grid";
    (player.drawings || []).forEach((entry) => {
      const cell = document.createElement("div");
      cell.className = "blitz-sketch-cell";
      const img = document.createElement("img");
      img.src = entry.image_data || "";
      img.alt = entry.prompt || "drawing";
      cell.appendChild(img);
      const word = document.createElement("div");
      word.className = "blitz-sketch-meta";
      word.textContent = `词语: ${entry.prompt || "-"}`;
      cell.appendChild(word);
      if (entry.guessed) {
        const guess = document.createElement("div");
        const correct = entry.correct === true;
        guess.className = `blitz-sketch-guess ${correct ? "correct" : "wrong"}`;
        guess.textContent = `猜测: ${formatBlitzSketchGuess(entry)}`;
        cell.appendChild(guess);
      }
      grid.appendChild(cell);
    });
    wrapper.appendChild(grid);
    blitzSketchReviewGrid.appendChild(wrapper);
  });
}

function renderBlitzSketchGameState(data) {
  const view = data.view;
  const previousView = currentBlitzSketchView;
  currentBlitzSketchView = view;
  if (currentGameType !== "blitz_sketch") {
    currentGameType = "blitz_sketch";
    setGamePanelVisibility("blitz_sketch");
  }

  if (blitzSketchPhaseLabel) {
    blitzSketchPhaseLabel.textContent = view.phase || "-";
  }
  if (blitzSketchDrawProgressLabel) {
    const drawIndex = Number.isInteger(view.draw_index) ? view.draw_index : 0;
    const drawTotal = Number.isInteger(view.draw_total) ? view.draw_total : 0;
    blitzSketchDrawProgressLabel.textContent = `${Math.min(drawIndex, drawTotal)}/${drawTotal || "-"}`;
  }
  if (blitzSketchGuessProgressLabel) {
    const guessIndex = Number.isInteger(view.guess_index) ? view.guess_index : 0;
    const guessTotal = Number.isInteger(view.guess_total) ? view.guess_total : 0;
    blitzSketchGuessProgressLabel.textContent = `${Math.min(guessIndex, guessTotal)}/${guessTotal || "-"}`;
  }
  if (blitzSketchScoreLabel) {
    blitzSketchScoreLabel.textContent = view.score ?? "-";
  }

  renderBlitzSketchPlayers(view);
  logGameEvents(data);

  if (view.phase === "draw") {
    if (!previousView || previousView.draw_index !== view.draw_index) {
      blitzSketchSubmittedDrawIndex = null;
    }
    if (blitzSketchDrawArea) {
      blitzSketchDrawArea.classList.remove("hidden");
    }
    if (blitzSketchGuessArea) {
      blitzSketchGuessArea.classList.add("hidden");
    }
    if (blitzSketchReview) {
      blitzSketchReview.classList.add("hidden");
    }
    if (blitzSketchPromptLabel) {
      blitzSketchPromptLabel.textContent = view.draw_prompt || "-";
    }
    if (blitzSketchFeedback) {
      blitzSketchFeedback.textContent = "";
    }
    if (blitzSketchRevealRow) {
      blitzSketchRevealRow.classList.add("hidden");
    }
    if (blitzSketchInput) {
      blitzSketchInput.value = "";
      blitzSketchInput.disabled = true;
    }
    if (blitzSketchCanvas) {
      blitzSketchCanvas.style.pointerEvents = isBlitzSketchActionAvailable("submit_drawing") ? "auto" : "none";
    }
    scheduleBlitzSketchAutoSubmit(view);
  } else if (view.phase === "guess") {
    resetBlitzSketchDrawingState();
    if (blitzSketchDrawArea) {
      blitzSketchDrawArea.classList.add("hidden");
    }
    if (blitzSketchGuessArea) {
      blitzSketchGuessArea.classList.remove("hidden");
    }
    if (blitzSketchReview) {
      blitzSketchReview.classList.add("hidden");
    }
    stopBlitzSketchDrawTimers();
    if (blitzSketchTimerLabel) {
      blitzSketchTimerLabel.textContent = "-";
    }
    if (blitzSketchImage) {
      const revealActive =
        view.reveal && Number.isFinite(view.reveal.until_ms) ? view.reveal.until_ms > Date.now() : !!view.reveal;
      const revealImage = revealActive && view.reveal && view.reveal.image_data ? view.reveal.image_data : null;
      if (revealImage) {
        blitzSketchImage.src = revealImage;
      } else if (view.current_image) {
        blitzSketchImage.src = view.current_image;
      } else {
        blitzSketchImage.removeAttribute("src");
      }
    }
    if (!previousView || previousView.guess_index !== view.guess_index) {
      if (blitzSketchInput) {
        blitzSketchInput.value = "";
      }
    }
    if (blitzSketchInput) {
      blitzSketchInput.disabled = !isBlitzSketchGuessAllowed();
    }
    if (blitzSketchFeedback) {
      blitzSketchFeedback.textContent = view.feedback ? view.feedback.message || "" : "";
    }
    if (blitzSketchRevealRow) {
      const revealActive =
        view.reveal && Number.isFinite(view.reveal.until_ms) ? view.reveal.until_ms > Date.now() : !!view.reveal;
      if (revealActive && view.reveal && view.reveal.answer) {
        blitzSketchRevealRow.classList.remove("hidden");
        if (blitzSketchRevealAnswer) {
          blitzSketchRevealAnswer.textContent = view.reveal.answer;
        }
      } else {
        blitzSketchRevealRow.classList.add("hidden");
      }
    }
    scheduleBlitzSketchReveal(view);
  } else if (view.phase === "review") {
    resetBlitzSketchDrawingState();
    if (blitzSketchDrawArea) {
      blitzSketchDrawArea.classList.add("hidden");
    }
    if (blitzSketchGuessArea) {
      blitzSketchGuessArea.classList.add("hidden");
    }
    if (blitzSketchTimerLabel) {
      blitzSketchTimerLabel.textContent = "-";
    }
    stopBlitzSketchTimers();
    renderBlitzSketchReview(view);
  } else {
    resetBlitzSketchDrawingState();
    if (blitzSketchDrawArea) {
      blitzSketchDrawArea.classList.add("hidden");
    }
    if (blitzSketchGuessArea) {
      blitzSketchGuessArea.classList.add("hidden");
    }
    if (blitzSketchReview) {
      blitzSketchReview.classList.add("hidden");
    }
    if (blitzSketchTimerLabel) {
      blitzSketchTimerLabel.textContent = "-";
    }
    stopBlitzSketchTimers();
  }

  updateBlitzSketchButtons();
}

if (blitzSketchSubmitGuessBtn) {
  blitzSketchSubmitGuessBtn.addEventListener("click", () => {
    if (!blitzSketchInput) {
      return;
    }
    const guess = blitzSketchInput.value.trim();
    if (!guess) {
      log("请输入答案");
      return;
    }
    sendAction({ type: "submit_guess", text: guess });
  });
}

if (blitzSketchSkipBtn) {
  blitzSketchSkipBtn.addEventListener("click", () => {
    sendAction({ type: "skip_guess" });
  });
}

if (blitzSketchInput) {
  blitzSketchInput.addEventListener("input", () => {
    updateBlitzSketchButtons();
  });
  blitzSketchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (blitzSketchSubmitGuessBtn && isBlitzSketchActionAvailable("submit_guess")) {
        blitzSketchSubmitGuessBtn.click();
      }
    }
  });
}

setupBlitzSketchCanvas();
