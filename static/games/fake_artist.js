const fakeArtistConfigBox = document.getElementById("fakeArtistConfigBox");
const fakeArtistRoundsRow = document.getElementById("fakeArtistRoundsRow");
const fakeArtistRoundsSelect = document.getElementById("fakeArtistRoundsSelect");
const fakeArtistTurnTimeRow = document.getElementById("fakeArtistTurnTimeRow");
const fakeArtistTurnTimeSelect = document.getElementById("fakeArtistTurnTimeSelect");

const fakeArtistPhaseLabel = document.getElementById("fakeArtistPhase");
const fakeArtistRoundLabel = document.getElementById("fakeArtistRound");
const fakeArtistTotalRoundsLabel = document.getElementById("fakeArtistTotalRounds");
const fakeArtistTurnLabel = document.getElementById("fakeArtistTurn");
const fakeArtistTimerLabel = document.getElementById("fakeArtistTimer");
const fakeArtistRoleLabel = document.getElementById("fakeArtistRole");
const fakeArtistCategoryLabel = document.getElementById("fakeArtistCategory");
const fakeArtistWordLabel = document.getElementById("fakeArtistWord");
const fakeArtistColorSelect = document.getElementById("fakeArtistColorSelect");
const fakeArtistColorPalette = document.getElementById("fakeArtistColorPalette");
const fakeArtistDrawArea = document.getElementById("fakeArtistDrawArea");
const fakeArtistCanvas = document.getElementById("fakeArtistCanvas");
const fakeArtistDrawHint = document.getElementById("fakeArtistDrawHint");
const fakeArtistVoteArea = document.getElementById("fakeArtistVoteArea");
const fakeArtistVoteHint = document.getElementById("fakeArtistVoteHint");
const fakeArtistVoteList = document.getElementById("fakeArtistVoteList");
const fakeArtistLastGuessArea = document.getElementById("fakeArtistLastGuessArea");
const fakeArtistLastGuessHint = document.getElementById("fakeArtistLastGuessHint");
const fakeArtistLastGuessControls = document.getElementById("fakeArtistLastGuessControls");
const fakeArtistLastGuessInput = document.getElementById("fakeArtistLastGuessInput");
const fakeArtistLastGuessBtn = document.getElementById("fakeArtistLastGuessBtn");
const fakeArtistResult = document.getElementById("fakeArtistResult");
const fakeArtistResultText = document.getElementById("fakeArtistResultText");
const fakeArtistVoteResult = document.getElementById("fakeArtistVoteResult");
const fakeArtistPlayAgainBtn = document.getElementById("fakeArtistPlayAgainBtn");
const fakeArtistPlayers = document.getElementById("fakeArtistPlayers");
const fakeArtistCtx = fakeArtistCanvas ? fakeArtistCanvas.getContext("2d") : null;

const fakeArtistHelpBtn = document.getElementById("fakeArtistHelpBtn");
const fakeArtistExplainBtn = document.getElementById("fakeArtistExplainBtn");
const fakeArtistHelpModal = document.getElementById("fakeArtistHelpModal");
const fakeArtistHelpModalCloseBtn = document.getElementById("fakeArtistHelpModalCloseBtn");
const fakeArtistExplainModal = document.getElementById("fakeArtistExplainModal");
const fakeArtistExplainModalCloseBtn = document.getElementById("fakeArtistExplainModalCloseBtn");
const fakeArtistHelpContent = document.getElementById("fakeArtistHelpContent");
const fakeArtistExplainContent = document.getElementById("fakeArtistExplainContent");

let currentFakeArtistView = null;
let fakeArtistIsDrawing = false;
let fakeArtistStrokePoints = [];
let fakeArtistTimer = null;
let fakeArtistDeadline = null;

const FAKE_ARTIST_LINE_WIDTH = 4;

const FAKE_ARTIST_HELP_TEXT = `
  <p>所有人共同完成一幅画，但其中有一名 <strong>伪装艺术家</strong> 并不知道具体词汇。</p>
  <h3>流程</h3>
  <ul>
    <li>每位玩家选择一支独特的画笔颜色。</li>
    <li>每一轮系统都会随机指定 1 名伪装艺术家（与上一轮不同），其余是真艺术家。</li>
    <li>真艺术家看到「类别 + 词汇」，伪装艺术家只看到「类别」。</li>
    <li>按顺序每人画一笔，重复 X 轮。</li>
    <li>完成后进行投票，找出伪装艺术家。</li>
    <li>若伪装艺术家被投出，可进行一次最终猜测。</li>
    <li>若出现平票，将重投一次；仍平票则伪装艺术家获胜。</li>
  </ul>
  <h3>胜利条件</h3>
  <ul>
    <li>真艺术家：成功投出伪装艺术家，且伪装艺术家未猜中。</li>
    <li>伪装艺术家：未被投出，或最终猜测正确。</li>
  </ul>
`;

const FAKE_ARTIST_BUTTON_EXPLANATIONS = {
  fakeArtistLastGuessBtn: {
    name: "Submit Final Guess",
    description: "Submit the Fake Artist's final guess after being voted out.",
    cost: "End Round",
    costType: "end",
  },
  fakeArtistPlayAgainBtn: {
    name: "Play Again",
    description: "Start a new round with a fresh word while keeping the current scores.",
    cost: "New Round",
    costType: "end",
  },
};

let fakeArtistExplainMode = false;

function showFakeArtistHeaderActions(show) {
  const header = document.getElementById("fakeArtistHeaderActions");
  if (header) {
    header.style.display = show ? "flex" : "none";
  }
}

function updateFakeArtistConfigRow() {
  const showRow = currentRoomState && currentGameType === "fake_artist" && currentRoomState.status === "lobby";
  if (fakeArtistConfigBox) {
    fakeArtistConfigBox.classList.toggle("hidden", !showRow);
    fakeArtistConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (fakeArtistRoundsRow) {
    fakeArtistRoundsRow.classList.toggle("hidden", !showRow);
    fakeArtistRoundsRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (fakeArtistTurnTimeRow) {
    fakeArtistTurnTimeRow.classList.toggle("hidden", !showRow);
    fakeArtistTurnTimeRow.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function clearFakeArtistState() {
  currentFakeArtistView = null;
  fakeArtistIsDrawing = false;
  fakeArtistStrokePoints = [];
  stopFakeArtistTimer();
  if (fakeArtistPhaseLabel) fakeArtistPhaseLabel.textContent = "-";
  if (fakeArtistRoundLabel) fakeArtistRoundLabel.textContent = "-";
  if (fakeArtistTotalRoundsLabel) fakeArtistTotalRoundsLabel.textContent = "-";
  if (fakeArtistTurnLabel) fakeArtistTurnLabel.textContent = "-";
  if (fakeArtistTimerLabel) fakeArtistTimerLabel.textContent = "-";
  if (fakeArtistRoleLabel) fakeArtistRoleLabel.textContent = "-";
  if (fakeArtistCategoryLabel) fakeArtistCategoryLabel.textContent = "-";
  if (fakeArtistWordLabel) fakeArtistWordLabel.textContent = "-";
  if (fakeArtistDrawHint) fakeArtistDrawHint.textContent = "";
  if (fakeArtistVoteHint) fakeArtistVoteHint.textContent = "";
  if (fakeArtistColorPalette) fakeArtistColorPalette.innerHTML = "";
  if (fakeArtistVoteList) fakeArtistVoteList.innerHTML = "";
  if (fakeArtistLastGuessHint) fakeArtistLastGuessHint.textContent = "";
  if (fakeArtistLastGuessInput) fakeArtistLastGuessInput.value = "";
  if (fakeArtistLastGuessArea) fakeArtistLastGuessArea.classList.add("hidden");
  if (fakeArtistLastGuessControls) fakeArtistLastGuessControls.classList.add("hidden");
  if (fakeArtistResultText) fakeArtistResultText.textContent = "";
  if (fakeArtistVoteResult) fakeArtistVoteResult.innerHTML = "";
  if (fakeArtistPlayers) fakeArtistPlayers.innerHTML = "";
  if (fakeArtistColorSelect) fakeArtistColorSelect.classList.add("hidden");
  if (fakeArtistVoteArea) fakeArtistVoteArea.classList.add("hidden");
  if (fakeArtistResult) fakeArtistResult.classList.add("hidden");
  clearFakeArtistCanvas();
}

function fakeArtistActions() {
  return currentFakeArtistView ? currentFakeArtistView.actions || [] : [];
}

function isFakeArtistActionAvailable(action) {
  return fakeArtistActions().includes(action);
}

function clearFakeArtistCanvas() {
  if (!fakeArtistCtx || !fakeArtistCanvas) {
    return;
  }
  fakeArtistCtx.fillStyle = "#ffffff";
  fakeArtistCtx.fillRect(0, 0, fakeArtistCanvas.width, fakeArtistCanvas.height);
  fakeArtistCtx.beginPath();
}

function drawFakeArtistStroke(stroke) {
  if (!fakeArtistCtx || !stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) {
    return;
  }
  fakeArtistCtx.strokeStyle = stroke.color || "#111827";
  fakeArtistCtx.lineWidth = FAKE_ARTIST_LINE_WIDTH;
  fakeArtistCtx.lineCap = "round";
  fakeArtistCtx.lineJoin = "round";
  fakeArtistCtx.beginPath();
  const [firstX, firstY] = stroke.points[0];
  fakeArtistCtx.moveTo(firstX, firstY);
  stroke.points.slice(1).forEach(([x, y]) => {
    fakeArtistCtx.lineTo(x, y);
  });
  fakeArtistCtx.stroke();
}

function renderFakeArtistCanvas(view) {
  if (!view || !fakeArtistCanvas) {
    return;
  }
  const canvasConfig = view.canvas || {};
  const width = Number.parseInt(canvasConfig.width, 10) || 640;
  const height = Number.parseInt(canvasConfig.height, 10) || 480;
  if (fakeArtistCanvas.width !== width || fakeArtistCanvas.height !== height) {
    fakeArtistCanvas.width = width;
    fakeArtistCanvas.height = height;
  }
  clearFakeArtistCanvas();
  const strokes = Array.isArray(view.strokes) ? view.strokes : [];
  strokes.forEach((stroke) => drawFakeArtistStroke(stroke));
}

function getFakeArtistPosition(event) {
  const rect = fakeArtistCanvas.getBoundingClientRect();
  const point = event.touches ? event.touches[0] : event;
  const scaleX = rect.width ? fakeArtistCanvas.width / rect.width : 1;
  const scaleY = rect.height ? fakeArtistCanvas.height / rect.height : 1;
  return {
    x: (point.clientX - rect.left) * scaleX,
    y: (point.clientY - rect.top) * scaleY,
  };
}

function startFakeArtistDraw(event) {
  if (!fakeArtistCtx || !fakeArtistCanvas || !isFakeArtistActionAvailable("submit_stroke")) {
    return;
  }
  event.preventDefault();
  fakeArtistIsDrawing = true;
  fakeArtistStrokePoints = [];
  const pos = getFakeArtistPosition(event);
  fakeArtistStrokePoints.push([pos.x, pos.y]);
  fakeArtistCtx.strokeStyle = currentFakeArtistView?.your_color || "#111827";
  fakeArtistCtx.lineWidth = FAKE_ARTIST_LINE_WIDTH;
  fakeArtistCtx.lineCap = "round";
  fakeArtistCtx.lineJoin = "round";
  fakeArtistCtx.beginPath();
  fakeArtistCtx.moveTo(pos.x, pos.y);
}

function moveFakeArtistDraw(event) {
  if (!fakeArtistIsDrawing || !fakeArtistCtx) {
    return;
  }
  event.preventDefault();
  const pos = getFakeArtistPosition(event);
  fakeArtistStrokePoints.push([pos.x, pos.y]);
  fakeArtistCtx.lineTo(pos.x, pos.y);
  fakeArtistCtx.stroke();
}

function endFakeArtistDraw(event) {
  if (!fakeArtistIsDrawing) {
    return;
  }
  event.preventDefault();
  fakeArtistIsDrawing = false;
  if (fakeArtistCtx) {
    fakeArtistCtx.beginPath();
  }
  if (!fakeArtistStrokePoints.length) {
    return;
  }
  sendAction({ type: "submit_stroke", points: fakeArtistStrokePoints });
  fakeArtistStrokePoints = [];
}

function stopFakeArtistTimer() {
  if (fakeArtistTimer) {
    clearInterval(fakeArtistTimer);
    fakeArtistTimer = null;
  }
  fakeArtistDeadline = null;
}

function updateFakeArtistTimer() {
  if (!fakeArtistTimerLabel) {
    return;
  }
  if (!fakeArtistDeadline) {
    fakeArtistTimerLabel.textContent = "-";
    return;
  }
  const remainingMs = Math.max(0, fakeArtistDeadline - Date.now());
  const seconds = (remainingMs / 1000).toFixed(1);
  fakeArtistTimerLabel.textContent = `${seconds}s`;
}

function startFakeArtistTimer(deadlineMs) {
  if (!deadlineMs) {
    stopFakeArtistTimer();
    updateFakeArtistTimer();
    return;
  }
  if (fakeArtistDeadline === deadlineMs) {
    updateFakeArtistTimer();
    return;
  }
  fakeArtistDeadline = deadlineMs;
  updateFakeArtistTimer();
  stopFakeArtistTimer();
  fakeArtistTimer = setInterval(updateFakeArtistTimer, 200);
}

function renderFakeArtistColorPalette(view) {
  if (!fakeArtistColorPalette) {
    return;
  }
  fakeArtistColorPalette.innerHTML = "";
  const colors = Array.isArray(view.colors) ? view.colors : [];
  const players = Array.isArray(view.players) ? view.players : [];
  const colorOwners = new Map();
  players.forEach((player) => {
    if (player.color) {
      colorOwners.set(player.color, player);
    }
  });
  colors.forEach((color) => {
    const owner = colorOwners.get(color);
    const isMine = view.your_color && view.your_color === color;
    const isTaken = owner && !isMine;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fake-artist-color-btn";
    btn.style.background = color;
    btn.disabled = isTaken || !isFakeArtistActionAvailable("choose_color");
    if (isMine) {
      btn.classList.add("selected");
    }
    const titleName = owner ? owner.name || "Player" : "Available";
    btn.title = isTaken ? `${titleName} picked` : "Pick this color";
    btn.setAttribute("aria-label", btn.title);
    btn.addEventListener("click", () => {
      sendAction({ type: "choose_color", color });
    });
    fakeArtistColorPalette.appendChild(btn);
  });
}

function renderFakeArtistVoteList(view) {
  if (!fakeArtistVoteList) {
    return;
  }
  fakeArtistVoteList.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  const canVote = isFakeArtistActionAvailable("submit_vote");
  players.forEach((player) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fake-artist-vote-btn";
    btn.disabled = !canVote;
    if (view.your_vote && view.your_vote === player.player_id) {
      btn.classList.add("selected");
    }
    const label = document.createElement("div");
    const seatLabel = Number.isInteger(player.seat) ? player.seat + 1 : "?";
    label.textContent = `${seatLabel}. ${player.name || "Player"}`;
    const color = document.createElement("div");
    color.className = "fake-artist-color-dot";
    color.style.background = player.color || "#e5e7eb";
    btn.appendChild(color);
    btn.appendChild(label);
    btn.addEventListener("click", () => {
      sendAction({ type: "submit_vote", target_id: player.player_id });
    });
    fakeArtistVoteList.appendChild(btn);
  });
}

function submitFakeArtistLastGuess() {
  if (!fakeArtistLastGuessInput || !isFakeArtistActionAvailable("submit_final_guess")) {
    return;
  }
  const text = fakeArtistLastGuessInput.value.trim();
  if (!text) {
    return;
  }
  sendAction({ type: "submit_final_guess", text });
  fakeArtistLastGuessInput.value = "";
}

function renderFakeArtistLastGuessArea(view) {
  if (!fakeArtistLastGuessArea) {
    return;
  }
  const isLastGuess = view.phase === "last_guess";
  fakeArtistLastGuessArea.classList.toggle("hidden", !isLastGuess);
  if (!isLastGuess) {
    if (fakeArtistLastGuessHint) fakeArtistLastGuessHint.textContent = "";
    if (fakeArtistLastGuessInput) fakeArtistLastGuessInput.value = "";
    return;
  }
  const isFake = view.your_role === "fake";
  if (fakeArtistLastGuessHint) {
    fakeArtistLastGuessHint.textContent = isFake
      ? "You were voted out. Enter your final guess."
      : "Waiting for the Fake Artist's final guess...";
  }
  if (fakeArtistLastGuessControls) {
    fakeArtistLastGuessControls.classList.toggle("hidden", !isFake);
  }
  const canGuess = isFake && isFakeArtistActionAvailable("submit_final_guess");
  if (fakeArtistLastGuessInput) {
    fakeArtistLastGuessInput.disabled = !canGuess;
  }
  if (fakeArtistLastGuessBtn) {
    fakeArtistLastGuessBtn.disabled = !canGuess;
  }
}

function renderFakeArtistPlayers(view) {
  if (!fakeArtistPlayers) {
    return;
  }
  fakeArtistPlayers.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "fake-artist-player";
    const left = document.createElement("div");
    left.className = "fake-artist-player-left";
    const dot = document.createElement("span");
    dot.className = "fake-artist-color-dot";
    dot.style.background = player.color || "#e5e7eb";
    const name = document.createElement("span");
    name.className = "fake-artist-player-name";
    const suffix = player.player_id === playerId ? " (you)" : "";
    const seatLabel = Number.isInteger(player.seat) ? player.seat + 1 : "?";
    name.textContent = `${seatLabel}. ${player.name || "Player"}${suffix}`;
    left.appendChild(dot);
    left.appendChild(name);
    if (view.current_turn && view.current_turn.player_id === player.player_id) {
      const badge = document.createElement("span");
      badge.className = "fake-artist-badge turn";
      badge.textContent = player.player_id === playerId ? "Your Turn" : "Turn";
      left.appendChild(badge);
    }
    if (player.voted) {
      const badge = document.createElement("span");
      badge.className = "fake-artist-badge voted";
      badge.textContent = "Voted";
      left.appendChild(badge);
    }
    if (player.is_fake) {
      const badge = document.createElement("span");
      badge.className = "fake-artist-badge fake";
      badge.textContent = "Fake";
      left.appendChild(badge);
    }
    const score = document.createElement("div");
    score.textContent = `Score: ${player.score ?? 0}`;
    row.appendChild(left);
    row.appendChild(score);
    fakeArtistPlayers.appendChild(row);
  });
}

function renderFakeArtistResult(view) {
  if (!fakeArtistResult || !fakeArtistResultText || !fakeArtistVoteResult) {
    return;
  }
  const winner = view.winner_side;
  const winnerLabel = winner === "real" ? "Real Artists Win" : "Fake Artist Wins";
  const fakePlayer = (view.players || []).find((player) => player.player_id === view.fake_player_id);
  const fakeName = fakePlayer ? fakePlayer.name || "Player" : "-";
  const revealWord = view.word || "-";
  let guessSegment = "";
  if (view.last_guess) {
    const guessOutcome =
      view.last_guess_correct === true ? "Correct" : view.last_guess_correct === false ? "Wrong" : "-";
    guessSegment = ` · Final Guess: ${view.last_guess} (${guessOutcome})`;
  }
  fakeArtistResultText.textContent = `${winnerLabel} · Fake Artist: ${fakeName} · Word: ${revealWord}${guessSegment}`;
  const counts = view.vote_counts || {};
  const rows = [];
  (view.players || []).forEach((player) => {
    const count = counts[player.player_id] ?? 0;
    rows.push(`${player.name || "Player"}: ${count}`);
  });
  fakeArtistVoteResult.innerHTML = rows.map((row) => `<div>${row}</div>`).join("");
  fakeArtistResult.classList.remove("hidden");
}

function renderFakeArtistGameState(data) {
  if (!data || !data.view) {
    return;
  }
  if (currentGameType !== "fake_artist") {
    currentGameType = "fake_artist";
    setGamePanelVisibility("fake_artist");
  }
  const view = data.view;
  currentFakeArtistView = view;

  if (fakeArtistPhaseLabel) {
    const phaseLabel =
      view.phase === "color_select"
        ? "Color Select"
        : view.phase === "draw"
          ? "Drawing"
          : view.phase === "vote"
            ? "Vote"
            : view.phase === "revote"
              ? "Revote"
              : view.phase === "last_guess"
                ? "Final Guess"
              : view.phase === "result"
                ? "Result"
                : view.phase || "-";
    fakeArtistPhaseLabel.textContent = phaseLabel;
  }
  if (fakeArtistRoundLabel) fakeArtistRoundLabel.textContent = view.round ?? "-";
  if (fakeArtistTotalRoundsLabel) fakeArtistTotalRoundsLabel.textContent = view.total_rounds ?? "-";
  if (fakeArtistTurnLabel) {
    fakeArtistTurnLabel.textContent = view.current_turn && view.current_turn.name ? view.current_turn.name : "-";
  }
  if (fakeArtistRoleLabel) {
    const roleLabel =
      view.your_role === "fake"
        ? "Fake Artist"
        : view.your_role === "real"
          ? "Real Artist"
          : "-";
    fakeArtistRoleLabel.textContent = roleLabel;
  }
  if (fakeArtistCategoryLabel) fakeArtistCategoryLabel.textContent = view.category || "-";
  if (fakeArtistWordLabel) {
    fakeArtistWordLabel.textContent = view.word || view.mask_word || "-";
  }

  if (fakeArtistColorSelect) {
    fakeArtistColorSelect.classList.toggle("hidden", view.phase !== "color_select");
  }
  if (fakeArtistDrawArea) {
    const showDraw = view.phase !== "color_select";
    fakeArtistDrawArea.classList.toggle("hidden", !showDraw);
  }
  if (fakeArtistVoteArea) {
    fakeArtistVoteArea.classList.toggle("hidden", !(view.phase === "vote" || view.phase === "revote"));
  }
  renderFakeArtistLastGuessArea(view);
  if (fakeArtistResult) {
    fakeArtistResult.classList.toggle("hidden", !view.game_over);
  }

  const canDraw = isFakeArtistActionAvailable("submit_stroke");
  if (fakeArtistCanvas) {
    fakeArtistCanvas.style.pointerEvents = canDraw ? "auto" : "none";
  }
  if (fakeArtistDrawHint) {
    if (view.phase === "draw") {
      if (canDraw) {
        fakeArtistDrawHint.textContent = "Your turn: draw one stroke.";
      } else if (view.current_turn && view.current_turn.name) {
        fakeArtistDrawHint.textContent = `Waiting for ${view.current_turn.name}...`;
      } else {
        fakeArtistDrawHint.textContent = "Waiting...";
      }
    } else {
      fakeArtistDrawHint.textContent = "";
    }
  }

  if (fakeArtistVoteHint) {
    if (view.phase === "vote" || view.phase === "revote") {
      const total = Array.isArray(view.players) ? view.players.length : 0;
      const submitted = view.votes_submitted ?? 0;
      const label = view.phase === "revote" ? "Revote" : "Vote";
      fakeArtistVoteHint.textContent = `${label}: ${submitted}/${total} submitted.`;
    } else {
      fakeArtistVoteHint.textContent = "";
    }
  }

  renderFakeArtistColorPalette(view);
  renderFakeArtistCanvas(view);
  renderFakeArtistVoteList(view);
  renderFakeArtistPlayers(view);

  if (view.game_over) {
    renderFakeArtistResult(view);
  }

  if (fakeArtistPlayAgainBtn) {
    fakeArtistPlayAgainBtn.disabled = !isFakeArtistActionAvailable("play_again");
  }

  startFakeArtistTimer(view.phase === "draw" ? view.turn_deadline_ms : null);
  logGameEvents(data);
}

if (fakeArtistCanvas) {
  fakeArtistCanvas.addEventListener("pointerdown", startFakeArtistDraw);
  fakeArtistCanvas.addEventListener("pointermove", moveFakeArtistDraw);
  fakeArtistCanvas.addEventListener("pointerup", endFakeArtistDraw);
  fakeArtistCanvas.addEventListener("pointerleave", endFakeArtistDraw);
}

if (fakeArtistPlayAgainBtn) {
  fakeArtistPlayAgainBtn.addEventListener("click", () => {
    if (!isFakeArtistActionAvailable("play_again")) {
      return;
    }
    sendAction({ type: "play_again" });
  });
}

if (fakeArtistLastGuessBtn) {
  fakeArtistLastGuessBtn.addEventListener("click", () => {
    submitFakeArtistLastGuess();
  });
}

if (fakeArtistLastGuessInput) {
  fakeArtistLastGuessInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitFakeArtistLastGuess();
    }
  });
}

function showFakeArtistHelpModal() {
  if (fakeArtistHelpModal) {
    if (fakeArtistHelpContent) {
      fakeArtistHelpContent.innerHTML = FAKE_ARTIST_HELP_TEXT;
    }
    setModalVisible(fakeArtistHelpModal, true);
  }
}

function closeFakeArtistHelpModal() {
  if (fakeArtistHelpModal) {
    setModalVisible(fakeArtistHelpModal, false);
  }
}

function updateFakeArtistExplainModeClasses(enabled) {
  Object.keys(FAKE_ARTIST_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
}

function findFakeArtistButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(FAKE_ARTIST_BUTTON_EXPLANATIONS)) {
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  return null;
}

function toggleFakeArtistExplainMode() {
  fakeArtistExplainMode = !fakeArtistExplainMode;
  document.body.classList.toggle("fake-artist-explain-mode", fakeArtistExplainMode);
  updateFakeArtistExplainModeClasses(fakeArtistExplainMode);
  if (fakeArtistExplainBtn) {
    fakeArtistExplainBtn.classList.toggle("active", fakeArtistExplainMode);
  }
}

function exitFakeArtistExplainMode() {
  if (!fakeArtistExplainMode) {
    return;
  }
  fakeArtistExplainMode = false;
  document.body.classList.remove("fake-artist-explain-mode");
  updateFakeArtistExplainModeClasses(false);
  if (fakeArtistExplainBtn) {
    fakeArtistExplainBtn.classList.remove("active");
  }
}

function showFakeArtistButtonExplanation(buttonId) {
  const explanation = FAKE_ARTIST_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !fakeArtistExplainContent || !fakeArtistExplainModal) {
    return;
  }
  fakeArtistExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    <span class="explain-cost end">${explanation.cost}</span>
  `;
  setModalVisible(fakeArtistExplainModal, true);
}

function closeFakeArtistExplainModal() {
  if (fakeArtistExplainModal) {
    setModalVisible(fakeArtistExplainModal, false);
  }
}

if (fakeArtistHelpBtn) {
  fakeArtistHelpBtn.addEventListener("click", () => {
    showFakeArtistHelpModal();
  });
}

if (fakeArtistHelpModalCloseBtn) {
  fakeArtistHelpModalCloseBtn.addEventListener("click", closeFakeArtistHelpModal);
}

if (fakeArtistExplainBtn) {
  fakeArtistExplainBtn.addEventListener("click", () => {
    toggleFakeArtistExplainMode();
  });
}

if (fakeArtistExplainModalCloseBtn) {
  fakeArtistExplainModalCloseBtn.addEventListener("click", closeFakeArtistExplainModal);
}

document.addEventListener("pointerdown", (e) => {
  if (!fakeArtistExplainMode) return;

  const buttonId = findFakeArtistButtonAtPoint(e.clientX, e.clientY);
  if (buttonId) {
    e.preventDefault();
    e.stopPropagation();
    showFakeArtistButtonExplanation(buttonId);
    exitFakeArtistExplainMode();
    return;
  }

  const button = e.target.closest("button");
  if (button === fakeArtistExplainBtn || button === fakeArtistHelpBtn) return;
  if (button === fakeArtistHelpModalCloseBtn || button === fakeArtistExplainModalCloseBtn) return;

  if (button) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

document.addEventListener("click", (e) => {
  if (!fakeArtistExplainMode) return;
  const button = e.target.closest("button");
  if (!button) return;
  if (button === fakeArtistExplainBtn || button === fakeArtistHelpBtn) return;
  if (button === fakeArtistHelpModalCloseBtn || button === fakeArtistExplainModalCloseBtn) return;
  e.preventDefault();
  e.stopPropagation();
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && fakeArtistExplainMode) {
    exitFakeArtistExplainMode();
  }
});

window.renderFakeArtistGameState = renderFakeArtistGameState;
window.updateFakeArtistConfigRow = updateFakeArtistConfigRow;
window.clearFakeArtistState = clearFakeArtistState;
window.showFakeArtistHeaderActions = showFakeArtistHeaderActions;
