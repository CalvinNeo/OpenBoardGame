(() => {
  const panel = document.getElementById("subtextPanel");
  const configBox = document.getElementById("subtextConfigBox");
  const wordColumnSelect = document.getElementById("subtextWordColumnSelect");
  const headerActions = document.getElementById("subtextHeaderActions");
  const helpBtn = document.getElementById("subtextHelpBtn");
  const explainBtn = document.getElementById("subtextExplainBtn");
  const helpModal = document.getElementById("subtextHelpModal");
  const helpCloseBtn = document.getElementById("subtextHelpCloseBtn");
  const helpContent = document.getElementById("subtextHelpContent");
  const explainModal = document.getElementById("subtextExplainModal");
  const explainCloseBtn = document.getElementById("subtextExplainCloseBtn");
  const explainContent = document.getElementById("subtextExplainContent");

  const roundLabel = document.getElementById("subtextRound");
  const totalRoundsLabel = document.getElementById("subtextTotalRounds");
  const phaseLabel = document.getElementById("subtextPhase");
  const dealerLabel = document.getElementById("subtextDealer");
  const progressLabel = document.getElementById("subtextProgress");
  const statusBox = document.getElementById("subtextStatus");
  const statusIcon = statusBox ? statusBox.querySelector(".subtext-status-icon") : null;
  const statusBody = document.getElementById("subtextStatusBody");
  const wordCard = document.getElementById("subtextWordCard");
  const yourWord = document.getElementById("subtextYourWord");

  const drawingArea = document.getElementById("subtextDrawingArea");
  const canvas = document.getElementById("subtextCanvas");
  const drawingCounter = document.getElementById("subtextDrawingCounter");
  const undoBtn = document.getElementById("subtextUndoBtn");
  const resetBtn = document.getElementById("subtextResetBtn");
  const submitDrawingBtn = document.getElementById("subtextSubmitDrawingBtn");

  const guessingArea = document.getElementById("subtextGuessingArea");
  const dealerCanvas = document.getElementById("subtextDealerCanvas");
  const dealerDrawingName = document.getElementById("subtextDealerDrawingName");
  const guessCounter = document.getElementById("subtextGuessCounter");
  const candidateGrid = document.getElementById("subtextCandidateGrid");
  const submitGuessBtn = document.getElementById("subtextSubmitGuessBtn");
  const selectedGuessLabel = document.getElementById("subtextSelectedGuess");

  const resultArea = document.getElementById("subtextResultArea");
  const resultBanner = document.getElementById("subtextResultBanner");
  const resultDrawings = document.getElementById("subtextResultDrawings");
  const resultTableBody = document.getElementById("subtextResultTableBody");
  const nextRoundRow = document.getElementById("subtextNextRoundRow");
  const readyStatus = document.getElementById("subtextReadyStatus");
  const nextRoundBtn = document.getElementById("subtextNextRoundBtn");
  const gameOverActions = document.getElementById("subtextGameOverActions");
  const winnerText = document.getElementById("subtextWinnerText");
  const playAgainBtn = document.getElementById("subtextPlayAgainBtn");
  const playersContainer = document.getElementById("subtextPlayers");

  const buttonExplanations = {
    subtextUndoBtn: "Remove your most recent stroke. This is available only before you submit the drawing.",
    subtextResetBtn: "Erase your local canvas and start the current clue again. Nothing is sent until submission.",
    subtextSubmitDrawingBtn: "Lock your drawing for this round. A submitted drawing cannot be changed.",
    subtextSubmitGuessBtn: "Lock the highlighted anonymous card as your secret guess.",
    subtextNextRoundBtn: "Confirm that you finished reviewing the reveal. The next round starts after everyone confirms.",
    subtextPlayAgainBtn: "Start a fresh game with the same word-set difficulty and reset every score.",
  };

  const helpHtml = [
    "<p><strong>Subtext</strong>（画外之意）is a 4–8 player drawing game about finding one hidden partner.</p>",
    "<h3>Round flow</h3>",
    "<ol>",
    "<li>The Dealer and exactly one unknown Partner receive the same secret word. Everyone else receives a different word.</li>",
    "<li>Everyone draws at the same time. Do not use letters or numbers, and do not discuss your word.</li>",
    "<li>The Dealer's clue is shown separately. All other clues appear anonymously as A–G.</li>",
    "<li>Everyone secretly selects the clue they believe shares the Dealer's word. A non-Dealer may select their own drawing.</li>",
    "</ol>",
    "<h3>Scoring</h3>",
    "<p>Let misses be the number of incorrect guesses. The Dealer and Partner each score that many points only if both identify the Partner card. Every correct outsider scores misses + 1. Incorrect outsiders score 0.</p>",
    "<p>If everyone guesses correctly, the shared-word pair scores 0 and each correct outsider scores 1. Highest total score after the scheduled rounds wins; ties are shared.</p>",
    "<p>Four and five player games use two Dealer cycles. Games with six to eight players use one cycle.</p>",
  ].join("");

  let currentView = null;
  let localStrokes = [];
  let activeStroke = null;
  let selectedSlot = null;
  let activeRoundKey = "";
  let explainMode = false;

  function setVisible(element, visible) {
    if (!element) {
      return;
    }
    element.classList.toggle("hidden", !visible);
    element.setAttribute("aria-hidden", (!visible).toString());
  }

  function setModalVisibleLocal(modal, visible) {
    setVisible(modal, visible);
  }

  function playerName(view, playerId) {
    const player = (view && Array.isArray(view.players) ? view.players : []).find(
      (entry) => entry && entry.player_id === playerId,
    );
    return player ? player.name || player.player_id : playerId || "-";
  }

  function hasLegalAction(actionType) {
    return !!(
      currentView
      && Array.isArray(currentView.legal_actions)
      && currentView.legal_actions.includes(actionType)
    );
  }

  function ownPlayer(view) {
    return (view.players || []).find((entry) => entry.player_id === view.you) || null;
  }

  function phaseText(phase) {
    const labels = {
      drawing: "Drawing",
      guessing: "Secret Guess",
      round_result: "Round Reveal",
      game_over: "Game Over",
    };
    return labels[phase] || phase || "-";
  }

  function drawDrawing(targetCanvas, drawing, options) {
    if (!targetCanvas) {
      return;
    }
    const context = targetCanvas.getContext("2d");
    if (!context) {
      return;
    }
    const width = targetCanvas.width;
    const height = targetCanvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = options && options.paper ? options.paper : "#fffdf5";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = options && options.color ? options.color : "#172554";
    context.fillStyle = context.strokeStyle;
    context.lineWidth = options && options.width ? options.width : 5;
    context.lineCap = "round";
    context.lineJoin = "round";
    (Array.isArray(drawing) ? drawing : []).forEach((stroke) => {
      if (!Array.isArray(stroke) || !stroke.length) {
        return;
      }
      const points = stroke.filter(
        (point) => Array.isArray(point) && point.length === 2
          && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])),
      );
      if (!points.length) {
        return;
      }
      if (points.length === 1) {
        context.beginPath();
        context.arc(Number(points[0][0]) * width, Number(points[0][1]) * height, 2.5, 0, Math.PI * 2);
        context.fill();
        return;
      }
      context.beginPath();
      context.moveTo(Number(points[0][0]) * width, Number(points[0][1]) * height);
      points.slice(1).forEach((point) => {
        context.lineTo(Number(point[0]) * width, Number(point[1]) * height);
      });
      context.stroke();
    });
  }

  function totalLocalPoints() {
    return localStrokes.reduce((total, stroke) => total + stroke.length, 0);
  }

  function normalizedPointerPoint(event) {
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    return [Number(x.toFixed(5)), Number(y.toFixed(5))];
  }

  function redrawLocalCanvas() {
    drawDrawing(canvas, localStrokes);
  }

  function beginStroke(event) {
    if (!hasLegalAction("submit_drawing") || explainMode || !canvas) {
      return;
    }
    if (localStrokes.length >= 100 || totalLocalPoints() >= 4000) {
      return;
    }
    const point = normalizedPointerPoint(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    activeStroke = [point];
    localStrokes.push(activeStroke);
    if (typeof canvas.setPointerCapture === "function") {
      canvas.setPointerCapture(event.pointerId);
    }
    redrawLocalCanvas();
    updateActionButtons();
  }

  function extendStroke(event) {
    if (!activeStroke || !hasLegalAction("submit_drawing") || explainMode) {
      return;
    }
    if (activeStroke.length >= 300 || totalLocalPoints() >= 4000) {
      return;
    }
    const point = normalizedPointerPoint(event);
    if (!point) {
      return;
    }
    const previous = activeStroke[activeStroke.length - 1];
    const distance = Math.abs(point[0] - previous[0]) + Math.abs(point[1] - previous[1]);
    if (distance < 0.002) {
      return;
    }
    event.preventDefault();
    activeStroke.push(point);
    redrawLocalCanvas();
  }

  function finishStroke(event) {
    if (!activeStroke) {
      return;
    }
    activeStroke = null;
    if (canvas && typeof canvas.releasePointerCapture === "function") {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch (error) {
        // The pointer may already have been released by the browser.
      }
    }
    updateActionButtons();
  }

  function createDrawingCard(label, drawing, options) {
    const settings = options || {};
    const card = document.createElement(settings.interactive ? "button" : "div");
    if (settings.interactive) {
      card.type = "button";
    }
    card.className = "subtext-drawing-card";
    if (settings.selected) {
      card.classList.add("selected");
    }
    if (settings.partner) {
      card.classList.add("partner");
    }
    if (settings.interactive && settings.disabled) {
      card.disabled = true;
    }
    const heading = document.createElement("div");
    heading.className = "subtext-drawing-label";
    const labelNode = document.createElement("strong");
    labelNode.textContent = label;
    heading.appendChild(labelNode);
    if (settings.badge) {
      const badge = document.createElement("span");
      badge.className = "subtext-card-badge";
      badge.textContent = settings.badge;
      heading.appendChild(badge);
    }
    const drawingCanvas = document.createElement("canvas");
    drawingCanvas.width = 640;
    drawingCanvas.height = 480;
    drawingCanvas.setAttribute("aria-label", label + " drawing");
    card.append(heading, drawingCanvas);
    drawDrawing(drawingCanvas, drawing);
    if (settings.footer) {
      const footer = document.createElement("div");
      footer.className = "subtext-drawing-footer";
      footer.textContent = settings.footer;
      card.appendChild(footer);
    }
    return card;
  }

  function renderPlayerCards(view) {
    if (!playersContainer) {
      return;
    }
    playersContainer.innerHTML = "";
    (view.players || []).forEach((player) => {
      const card = document.createElement("div");
      card.className = "subtext-player-card";
      if (player.player_id === view.you) {
        card.classList.add("self");
      }
      if (player.player_id === view.dealer_id) {
        card.classList.add("dealer");
      }
      if ((view.winner_ids || []).includes(player.player_id)) {
        card.classList.add("winner");
      }
      const name = document.createElement("strong");
      name.textContent = player.name || player.player_id || "-";
      const score = document.createElement("span");
      score.className = "subtext-player-score";
      score.textContent = String(player.score || 0) + " pts";
      const tags = [];
      if (player.player_id === view.you) {
        tags.push("You");
      }
      if (player.player_id === view.dealer_id) {
        tags.push("Dealer");
      }
      if (view.phase === "drawing") {
        tags.push(player.drawing_submitted ? "Drawing ready" : "Drawing…");
      } else if (view.phase === "guessing") {
        tags.push(player.guess_submitted ? "Vote locked" : "Choosing…");
      } else if (view.phase === "round_result") {
        tags.push(player.next_round_ready ? "Ready" : "Reviewing");
      } else if ((view.winner_ids || []).includes(player.player_id)) {
        tags.push("Winner");
      }
      const meta = document.createElement("small");
      meta.textContent = tags.join(" · ") || (player.is_bot ? "Bot" : "Player");
      if (player.is_bot && !tags.includes("Bot")) {
        meta.textContent += " · Bot";
      }
      card.append(name, score, meta);
      playersContainer.appendChild(card);
    });
  }

  function updateActionButtons() {
    const canDraw = hasLegalAction("submit_drawing");
    if (canvas) {
      canvas.classList.toggle("locked", !canDraw);
      canvas.setAttribute("aria-disabled", (!canDraw).toString());
    }
    if (undoBtn) {
      undoBtn.disabled = !canDraw || !localStrokes.length;
    }
    if (resetBtn) {
      resetBtn.disabled = !canDraw || !localStrokes.length;
    }
    if (submitDrawingBtn) {
      submitDrawingBtn.disabled = !canDraw || totalLocalPoints() === 0;
      submitDrawingBtn.textContent = canDraw ? "Submit Drawing" : "Drawing Locked";
    }
    const canGuess = hasLegalAction("submit_guess");
    if (submitGuessBtn) {
      submitGuessBtn.disabled = !canGuess || !selectedSlot;
      submitGuessBtn.textContent = canGuess ? "Submit Guess" : "Guess Locked";
    }
    if (nextRoundBtn) {
      nextRoundBtn.disabled = !hasLegalAction("next_round");
      nextRoundBtn.textContent = hasLegalAction("next_round") ? "Next Round" : "Ready ✓";
    }
    if (playAgainBtn) {
      playAgainBtn.disabled = !hasLegalAction("play_again");
    }
  }

  function renderHeader(view) {
    if (roundLabel) {
      roundLabel.textContent = String(view.round || "-");
    }
    if (totalRoundsLabel) {
      totalRoundsLabel.textContent = String(view.total_rounds || "-");
    }
    if (phaseLabel) {
      phaseLabel.textContent = phaseText(view.phase);
    }
    if (dealerLabel) {
      dealerLabel.textContent = playerName(view, view.dealer_id);
    }
    let progress = "-";
    if (view.phase === "drawing") {
      progress = String(view.drawing_progress.done) + "/" + String(view.drawing_progress.total) + " drawings";
    } else if (view.phase === "guessing") {
      progress = String(view.guess_progress.done) + "/" + String(view.guess_progress.total) + " guesses";
    } else if (view.phase === "round_result") {
      progress = String(view.next_round_progress.done) + "/" + String(view.next_round_progress.total) + " ready";
    } else if (view.phase === "game_over") {
      progress = String(view.total_rounds || view.round || "-") + " rounds complete";
    }
    if (progressLabel) {
      progressLabel.textContent = progress;
    }
  }

  function renderStatus(view) {
    if (!statusBody || !statusBox) {
      return;
    }
    const me = ownPlayer(view);
    statusBox.classList.remove("waiting", "ready", "reveal");
    if (view.phase === "drawing") {
      if (hasLegalAction("submit_drawing")) {
        statusBody.textContent = "Sketch an indirect clue for your secret word, then submit it.";
        if (statusIcon) {
          statusIcon.textContent = "✏️";
        }
      } else {
        statusBody.textContent = "Your drawing is locked. Waiting for everyone else.";
        statusBox.classList.add("waiting");
        if (statusIcon) {
          statusIcon.textContent = "⏳";
        }
      }
    } else if (view.phase === "guessing") {
      if (hasLegalAction("submit_guess")) {
        statusBody.textContent = "Select the anonymous clue that shares the Dealer's word.";
        if (statusIcon) {
          statusIcon.textContent = "🔎";
        }
      } else {
        statusBody.textContent = "Your guess is locked and remains secret until everyone votes.";
        statusBox.classList.add("waiting");
        if (statusIcon) {
          statusIcon.textContent = "🔒";
        }
      }
    } else if (view.phase === "round_result") {
      if (me && me.next_round_ready) {
        statusBody.textContent = "You are ready. The next round begins after everyone confirms.";
        statusBox.classList.add("ready");
        if (statusIcon) {
          statusIcon.textContent = "✅";
        }
      } else {
        statusBody.textContent = "Review the reveal and scoring, then confirm Next Round.";
        statusBox.classList.add("reveal");
        if (statusIcon) {
          statusIcon.textContent = "💡";
        }
      }
    } else if (view.phase === "game_over") {
      statusBody.textContent = "The final scores are in. Review the last reveal or start another game.";
      statusBox.classList.add("reveal");
      if (statusIcon) {
        statusIcon.textContent = "🏆";
      }
    }
  }

  function renderDrawingStage(view) {
    const visible = view.phase === "drawing";
    setVisible(drawingArea, visible);
    if (!visible) {
      activeStroke = null;
      return;
    }
    if (!localStrokes.length && Array.isArray(view.your_drawing)) {
      localStrokes = view.your_drawing;
    }
    if (drawingCounter) {
      drawingCounter.textContent = String(view.drawing_progress.done) + "/" + String(view.drawing_progress.total) + " ready";
    }
    redrawLocalCanvas();
  }

  function renderGuessingStage(view) {
    const visible = view.phase === "guessing";
    setVisible(guessingArea, visible);
    if (!visible) {
      return;
    }
    if (view.your_guess) {
      selectedSlot = view.your_guess;
    }
    const validSlots = new Set((view.candidates || []).map((candidate) => candidate.slot_id));
    if (selectedSlot && !validSlots.has(selectedSlot)) {
      selectedSlot = null;
    }
    if (dealerDrawingName) {
      dealerDrawingName.textContent = playerName(view, view.dealer_id);
    }
    drawDrawing(dealerCanvas, view.dealer_drawing, { color: "#7c3aed" });
    if (guessCounter) {
      guessCounter.textContent = String(view.guess_progress.done) + "/" + String(view.guess_progress.total) + " voted";
    }
    if (candidateGrid) {
      candidateGrid.innerHTML = "";
      (view.candidates || []).forEach((candidate) => {
        const badge = candidate.is_yours ? "Yours" : "";
        const card = createDrawingCard(candidate.slot_id, candidate.drawing, {
          interactive: true,
          selected: selectedSlot === candidate.slot_id,
          disabled: !hasLegalAction("submit_guess"),
          badge: badge,
        });
        card.dataset.slotId = candidate.slot_id;
        card.addEventListener("click", () => {
          if (explainMode || !hasLegalAction("submit_guess")) {
            return;
          }
          selectedSlot = candidate.slot_id;
          renderGuessingStage(currentView);
          updateActionButtons();
        });
        candidateGrid.appendChild(card);
      });
    }
    if (selectedGuessLabel) {
      selectedGuessLabel.textContent = selectedSlot
        ? "Selected: " + selectedSlot
        : "No drawing selected";
    }
  }

  function renderResultStage(view) {
    const visible = view.phase === "round_result" || view.phase === "game_over";
    setVisible(resultArea, visible);
    if (!visible) {
      return;
    }
    const summary = view.last_round_summary;
    if (!summary) {
      if (resultBanner) {
        resultBanner.textContent = "Waiting for the round reveal…";
      }
      return;
    }
    if (resultBanner) {
      resultBanner.innerHTML = "";
      const icon = document.createElement("span");
      icon.className = "subtext-result-icon";
      icon.textContent = "💡";
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = "The shared word was “" + String(summary.target_word || "-") + "”";
      const detail = document.createElement("span");
      detail.textContent = playerName(view, summary.dealer_id) + " and "
        + playerName(view, summary.partner_id) + " were the hidden pair · "
        + String(summary.wrong_count || 0) + " miss"
        + (Number(summary.wrong_count || 0) === 1 ? "" : "es");
      copy.append(title, detail);
      resultBanner.append(icon, copy);
    }
    if (resultDrawings) {
      resultDrawings.innerHTML = "";
      resultDrawings.appendChild(
        createDrawingCard("Dealer · " + playerName(view, summary.dealer_id), summary.dealer_drawing, {
          badge: "Shared word",
        }),
      );
      (summary.slots || []).forEach((slot) => {
        const guessers = Object.keys(summary.guesses || {}).filter(
          (playerId) => summary.guesses[playerId].slot_id === slot.slot_id,
        );
        const footer = guessers.length
          ? "Chosen by " + guessers.map((playerId) => playerName(view, playerId)).join(", ")
          : "No guesses";
        resultDrawings.appendChild(
          createDrawingCard(
            slot.slot_id + " · " + playerName(view, slot.player_id),
            slot.drawing,
            {
              partner: slot.player_id === summary.partner_id,
              badge: slot.player_id === summary.partner_id ? "Partner" : "",
              footer: footer,
            },
          ),
        );
      });
    }
    if (resultTableBody) {
      resultTableBody.innerHTML = "";
      (view.players || []).forEach((player) => {
        const guess = (summary.guesses || {})[player.player_id] || {};
        const row = document.createElement("tr");
        if (player.player_id === summary.dealer_id || player.player_id === summary.partner_id) {
          row.classList.add("shared-pair");
        }
        const values = [
          player.name || player.player_id || "-",
          guess.slot_id || "-",
          guess.correct ? "✓" : "—",
          String((summary.round_points || {})[player.player_id] || 0),
          String((summary.scores_after_round || {})[player.player_id] || 0),
        ];
        values.forEach((value, index) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          if (index === 2) {
            cell.className = guess.correct ? "correct" : "incorrect";
          }
          row.appendChild(cell);
        });
        resultTableBody.appendChild(row);
      });
    }
    const showingReady = view.phase === "round_result";
    setVisible(nextRoundRow, showingReady);
    setVisible(gameOverActions, view.phase === "game_over");
    if (readyStatus) {
      readyStatus.textContent = "Ready " + String(view.next_round_progress.done)
        + "/" + String(view.next_round_progress.total);
    }
    if (winnerText && view.phase === "game_over") {
      const winners = (view.winner_ids || []).map((playerId) => playerName(view, playerId));
      winnerText.textContent = winners.length > 1
        ? "🏆 Shared winners: " + winners.join(", ")
        : "🏆 Winner: " + (winners[0] || "-");
    }
  }

  function renderWordCard(view) {
    const visible = (view.phase === "drawing" || view.phase === "guessing") && !!view.your_word;
    setVisible(wordCard, visible);
    if (yourWord) {
      yourWord.textContent = visible ? view.your_word : "-";
    }
  }

  function renderGameState(data) {
    const view = data && data.view ? data.view : data;
    if (!view || typeof view !== "object") {
      return;
    }
    const roundKey = String(view.game_index || 1) + ":" + String(view.round || 1);
    if (roundKey !== activeRoundKey) {
      activeRoundKey = roundKey;
      localStrokes = [];
      activeStroke = null;
      selectedSlot = null;
    }
    currentView = view;
    renderHeader(view);
    renderStatus(view);
    renderWordCard(view);
    renderDrawingStage(view);
    renderGuessingStage(view);
    renderResultStage(view);
    renderPlayerCards(view);
    updateActionButtons();
  }

  function clearState() {
    currentView = null;
    localStrokes = [];
    activeStroke = null;
    selectedSlot = null;
    activeRoundKey = "";
    setVisible(wordCard, false);
    setVisible(drawingArea, false);
    setVisible(guessingArea, false);
    setVisible(resultArea, false);
    setVisible(nextRoundRow, false);
    setVisible(gameOverActions, false);
    if (candidateGrid) {
      candidateGrid.innerHTML = "";
    }
    if (resultDrawings) {
      resultDrawings.innerHTML = "";
    }
    if (resultTableBody) {
      resultTableBody.innerHTML = "";
    }
    if (playersContainer) {
      playersContainer.innerHTML = "";
    }
    if (roundLabel) {
      roundLabel.textContent = "-";
    }
    if (totalRoundsLabel) {
      totalRoundsLabel.textContent = "-";
    }
    if (phaseLabel) {
      phaseLabel.textContent = "-";
    }
    if (dealerLabel) {
      dealerLabel.textContent = "-";
    }
    if (progressLabel) {
      progressLabel.textContent = "-";
    }
    if (statusBody) {
      statusBody.textContent = "Waiting for game state…";
    }
    drawDrawing(canvas, []);
    drawDrawing(dealerCanvas, []);
    exitExplainMode();
    setModalVisibleLocal(helpModal, false);
    setModalVisibleLocal(explainModal, false);
    updateActionButtons();
  }

  function showHeaderActions(show) {
    if (headerActions) {
      headerActions.style.display = show ? "flex" : "none";
    }
    if (!show) {
      exitExplainMode();
      setModalVisibleLocal(helpModal, false);
      setModalVisibleLocal(explainModal, false);
    }
  }

  function updateConfigRow() {
    const visible = typeof currentRoomState !== "undefined"
      && currentRoomState
      && typeof currentGameType !== "undefined"
      && currentGameType === "subtext"
      && currentRoomState.status === "lobby";
    setVisible(configBox, !!visible);
  }

  function getRoomConfig() {
    const parsed = wordColumnSelect ? Number.parseInt(wordColumnSelect.value, 10) : 1;
    return { word_column: Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 1 };
  }

  function enterExplainMode() {
    explainMode = true;
    document.body.classList.add("subtext-explain-mode");
    Object.keys(buttonExplanations).forEach((buttonId) => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.classList.add("has-explanation");
      }
    });
    if (explainBtn) {
      explainBtn.setAttribute("aria-pressed", "true");
    }
  }

  function exitExplainMode() {
    explainMode = false;
    document.body.classList.remove("subtext-explain-mode");
    Object.keys(buttonExplanations).forEach((buttonId) => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.classList.remove("has-explanation");
      }
    });
    if (explainBtn) {
      explainBtn.setAttribute("aria-pressed", "false");
    }
  }

  function showExplanation(buttonId) {
    if (explainContent) {
      explainContent.textContent = buttonExplanations[buttonId] || "No explanation is available.";
    }
    setModalVisibleLocal(explainModal, true);
  }

  function findDisabledExplainedButton(x, y) {
    const ids = Object.keys(buttonExplanations);
    for (let index = 0; index < ids.length; index += 1) {
      const button = document.getElementById(ids[index]);
      if (!button || !button.disabled) {
        continue;
      }
      const rect = button.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return ids[index];
      }
    }
    return null;
  }

  if (canvas) {
    canvas.addEventListener("pointerdown", beginStroke);
    canvas.addEventListener("pointermove", extendStroke);
    canvas.addEventListener("pointerup", finishStroke);
    canvas.addEventListener("pointercancel", finishStroke);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      if (!hasLegalAction("submit_drawing") || explainMode) {
        return;
      }
      localStrokes.pop();
      redrawLocalCanvas();
      updateActionButtons();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (!hasLegalAction("submit_drawing") || explainMode) {
        return;
      }
      localStrokes = [];
      activeStroke = null;
      redrawLocalCanvas();
      updateActionButtons();
    });
  }

  if (submitDrawingBtn) {
    submitDrawingBtn.addEventListener("click", () => {
      if (!hasLegalAction("submit_drawing") || explainMode || !totalLocalPoints()) {
        return;
      }
      sendAction({
        type: "submit_drawing",
        drawing: localStrokes.map((stroke) => stroke.map((point) => point.slice())),
      });
    });
  }

  if (candidateGrid) {
    candidateGrid.addEventListener("click", (event) => {
      if (
        event.target === candidateGrid
        && hasLegalAction("submit_guess")
        && !explainMode
        && selectedSlot
      ) {
        selectedSlot = null;
        renderGuessingStage(currentView);
        updateActionButtons();
      }
    });
  }

  if (submitGuessBtn) {
    submitGuessBtn.addEventListener("click", () => {
      if (!hasLegalAction("submit_guess") || explainMode || !selectedSlot) {
        return;
      }
      sendAction({ type: "submit_guess", slot_id: selectedSlot });
    });
  }

  if (nextRoundBtn) {
    nextRoundBtn.addEventListener("click", () => {
      if (hasLegalAction("next_round") && !explainMode) {
        sendAction({ type: "next_round" });
      }
    });
  }

  if (playAgainBtn) {
    playAgainBtn.addEventListener("click", () => {
      if (hasLegalAction("play_again") && !explainMode) {
        sendAction({ type: "play_again" });
      }
    });
  }

  if (helpBtn) {
    helpBtn.addEventListener("click", () => {
      if (helpContent) {
        helpContent.innerHTML = helpHtml;
      }
      setModalVisibleLocal(helpModal, true);
    });
  }

  if (helpCloseBtn) {
    helpCloseBtn.addEventListener("click", () => setModalVisibleLocal(helpModal, false));
  }

  if (explainBtn) {
    explainBtn.addEventListener("click", () => {
      if (explainMode) {
        exitExplainMode();
      } else {
        enterExplainMode();
      }
    });
  }

  if (explainCloseBtn) {
    explainCloseBtn.addEventListener("click", () => setModalVisibleLocal(explainModal, false));
  }

  [helpModal, explainModal].forEach((modal) => {
    if (!modal) {
      return;
    }
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        setModalVisibleLocal(modal, false);
      }
    });
  });

  document.addEventListener(
    "click",
    (event) => {
      if (!explainMode) {
        return;
      }
      const button = event.target.closest("button");
      if (!button) {
        return;
      }
      if (
        button === helpBtn
        || button === explainBtn
        || button === helpCloseBtn
        || button === explainCloseBtn
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (buttonExplanations[button.id]) {
        showExplanation(button.id);
        exitExplainMode();
      }
    },
    true,
  );

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!explainMode) {
        return;
      }
      const buttonId = findDisabledExplainedButton(event.clientX, event.clientY);
      if (!buttonId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      showExplanation(buttonId);
      exitExplainMode();
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    exitExplainMode();
    setModalVisibleLocal(helpModal, false);
    setModalVisibleLocal(explainModal, false);
    if (currentView && currentView.phase === "guessing" && hasLegalAction("submit_guess") && selectedSlot) {
      selectedSlot = null;
      renderGuessingStage(currentView);
      updateActionButtons();
    }
  });

  window.renderSubtextGameState = renderGameState;
  window.clearSubtextState = clearState;
  window.showSubtextHeaderActions = showHeaderActions;
  window.updateSubtextConfigRow = updateConfigRow;
  window.getSubtextRoomConfig = getRoomConfig;

  clearState();
})();
