(() => {
  const panel = document.getElementById("subtextPanel");
  const configBox = document.getElementById("subtextConfigBox");
  const wordColumnSelect = document.getElementById("subtextWordColumnSelect");
  const headerActions = document.getElementById("subtextHeaderActions");
  const helpBtn = document.getElementById("subtextHelpBtn");
  const explainBtn = document.getElementById("subtextExplainBtn");
  const drawingConfirm = document.getElementById("subtextDrawingConfirm");
  const confirmDrawingBtn = document.getElementById("subtextConfirmDrawingBtn");
  const cancelDrawingBtn = document.getElementById("subtextCancelDrawingBtn");
  const drawingSubmitted = document.getElementById("subtextDrawingSubmitted");
  const previewDialog = document.getElementById("subtextPreviewDialog");
  const previewCanvas = document.getElementById("subtextPreviewCanvas");
  const previewTitle = document.getElementById("subtextPreviewTitle");
  const tooltip = document.getElementById("subtextTooltip");

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

  const helpConfig = {
    gameId: "subtext",
    title: { zh: "Subtext · 画外之意", en: "Subtext" },
    basic: {
      win: { zh: "完成规定轮数后累计得分最高者获胜，并列者共同获胜。", en: "Score the most points over the scheduled rounds to win, sharing victory on a tie." },
      turn: { zh: "每轮同时为秘密词画提示，然后秘密选择与主持人表达相同词语的画。", en: "Each round, draw a clue for your secret word, then secretly choose the drawing that shares the Dealer's word." },
      key: { zh: "让未知同伴读懂你的画，但不要让所有人都猜中。", en: "Make your clue clear enough for your hidden partner, but not so obvious that everyone understands it." },
    },
    sections: [
      { id: "round", label: { zh: "流程", en: "Round flow" }, html: {
        zh: "<p>4–8 人同时游戏。主持人与恰好一名未知同伴拿到相同的词，其他人各有不同的干扰词。秘密词(🔒)只有你自己可见，系统不会提前告知谁是同伴。</p><p>所有人同时绘画(✏️)，保持安静(🤫)，禁止写字母、数字或讨论题目。只可用黑色自由线条作画。</p><p>全员提交后，主持人的画单独展示，其余画匿名编号 A–G。所有人都要猜哪张是同伴的画，非主持人可以选自己的画。Yours 仅标记你自己的画，不代表同伴。</p>",
        en: "<p>For 4–8 players. The Dealer and exactly one unknown Partner receive the same word. Everyone else gets a different decoy. Your secret word (🔒) is private, and neither member is told who the Partner is.</p><p>Everyone draws (✏️) at the same time. Keep quiet (🤫), use only black freehand lines, and do not write letters or numbers or discuss the word.</p><p>Once everyone submits, the Dealer's drawing appears separately and other drawings are anonymous A–G cards. Everyone guesses the Partner card. Non-Dealers may choose their own drawing. Yours identifies only your own work, not the Partner.</p>",
      } },
      { id: "scoring", label: { zh: "计分", en: "Scoring" }, html: {
        zh: "<p>错误人数是本轮猜错的玩家数。只有主持人与同伴两人都猜中同伴画作时，两人才各得错误人数分，否则两人都得零分。</p><p>其他玩家只要猜中，就得错误人数加一分，猜错得零分。例如六人局中，主持人、同伴和一名普通玩家猜对，前两人各得三分，普通玩家得四分。</p><p>若所有人都猜对，主持人与同伴各得零分，其他玩家各得一分。4–5 人各当两次主持人，6–8 人各当一次主持人。最后总分最高者获胜(🏆)，并列时共享胜利。</p>",
        en: "<p>Misses means the number of incorrect guesses. The Dealer and Partner each score that many points only if both correctly identify the Partner card. Otherwise both score zero.</p><p>Every correct outsider scores misses + 1, independently of the pair. An incorrect outsider scores zero. For example, in a six-player round with three correct guesses, a successful pair scores three each and a correct outsider scores four.</p><p>If everyone guesses correctly, the pair scores zero and each outsider scores one. With 4–5 players everyone deals twice, and with 6–8 players everyone deals once. The highest total wins (🏆), sharing victory if tied.</p>",
      } },
      { id: "controls", label: { zh: "操作", en: "Controls" }, html: {
        zh: "<p>Undo(↶) 撤销最后一笔，Reset Canvas 清空本地画布。Submit Drawing 在画布内显示确认，Confirm 锁定作品，Keep Drawing、点击周围空白或 Esc 取消。提交后不能修改，等待其他人完成。</p><p>点画作选择，再点 Submit Guess 锁定。点候选区空白或 Esc 取消未提交的选择。候选区可以独立滚动，选图不会跳回顶部，Zoom 可以放大而不改变选择。放大窗口可用 Close、遮罩或 Esc 关闭。</p><p>揭晓后所有人都点击 Next Round 才开始下一轮。Play Again 重置分数，保留题目难度。Help 可切换中英文和章节，Explain 开启后点画作、指标或按钮查看含义，禁用按钮也可解释，Esc 退出。</p>",
        en: "<p>Undo (↶) removes the last stroke and Reset Canvas clears your draft. Submit Drawing opens an inline confirmation. Confirm locks it, while Keep Drawing, surrounding blank space or Esc cancels. A submitted drawing cannot be edited.</p><p>Select a drawing, then use Submit Guess to lock it. Click empty candidate space or press Esc to deselect an unlocked card. Scroll candidates without losing your position. Zoom enlarges a drawing without selecting it. Close previews with Close, the backdrop or Esc.</p><p>After the reveal, everyone must press Next Round before play continues. Play Again resets scores with the same word difficulty. Help offers language and chapter buttons. Explain describes drawings, indicators and controls, including disabled buttons, without performing their actions. Press Esc to leave it.</p>",
      } },
    ],
  };
  const explanations = {
    phase: "Drawing: sketch privately. Secret Guess: choose the shared-word drawing. Round Reveal: review scores before everyone readies. Game Over: highest score wins.",
    dealer: "The Dealer shares a word with exactly one unknown Partner. Identify the Partner's anonymous drawing to score. The pair only scores if both guess correctly.",
    word: "Your secret word (🔒) is visible only to you. Draw an indirect clue. You are not told whether you are the hidden Partner.",
    canvas: "Draw (✏️) with black freehand strokes. Keep quiet (🤫), with no letters, numbers or discussion. Your draft stays local until submission.",
    undo: "Undo (↶) removes your most recent stroke before submission.",
    reset: "Erase your local canvas and start again. Nothing is sent until you confirm submission.",
    submitDrawing: "Review and confirm this drawing on the canvas. A confirmed drawing is locked for this round.",
    submitGuess: "Lock the selected A–G card as your secret guess. No one sees your choice until everyone submits.",
    nextRound: "Confirm you finished reviewing. The next round starts only when everyone is ready. This button needs no second confirmation.",
    playAgain: "Start a new game with the same word difficulty and reset every score.",
    zoom: "Enlarge this drawing without selecting it or changing your guess. Close the preview with Close, the backdrop or Esc.",
    scoring: "The pair must both guess correctly to score the number of misses. Correct outsiders score misses + 1. Highest total wins (🏆).",
    players: "Shows cumulative points and each player's public submission or readiness status. You is your seat. No private words or guesses are exposed here.",
  };

  let currentView = null;
  let localStrokes = [];
  let activeStroke = null;
  let selectedSlot = null;
  let activeRoundKey = "";
  let explainMode = false;
  let helpWidget = null;
  let explainWidget = null;
  let confirmingDrawing = false;
  let tooltipTimer = null;
  let tooltipGesture = null;
  let activePointerId = null;

  function setVisible(element, visible) {
    if (!element) {
      return;
    }
    element.classList.toggle("hidden", !visible);
    element.setAttribute("aria-hidden", (!visible).toString());
  }

  function closeDrawingConfirmation() {
    confirmingDrawing = false;
    setVisible(drawingConfirm, false);
  }

  function openPreview(label, drawing) {
    if (!previewDialog || explainMode) return;
    previewTitle.textContent = label;
    drawDrawing(previewCanvas, drawing);
    if (!previewDialog.open) previewDialog.showModal();
  }

  function hideTooltip() {
    window.clearTimeout(tooltipTimer);
    setVisible(tooltip, false);
  }

  function showTooltip(target) {
    if (!tooltip || explainMode) return;
    hideTooltip();
    tooltip.textContent = target.dataset.subtextTip;
    setVisible(tooltip, true);
    const bounds = target.getBoundingClientRect();
    const tipBounds = tooltip.getBoundingClientRect();
    tooltip.style.left = Math.max(12, Math.min(bounds.left, window.innerWidth - tipBounds.width - 12)) + "px";
    tooltip.style.top = Math.max(12, Math.min(bounds.bottom + 6, window.innerHeight - tipBounds.height - 12)) + "px";
    tooltipTimer = window.setTimeout(hideTooltip, 3000);
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

  function drawDrawing(targetCanvas, drawing) {
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
    context.fillStyle = "#fffef9";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#202020";
    context.fillStyle = context.strokeStyle;
    context.lineWidth = 5;
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
    const horizontal = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const vertical = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    return [Number(horizontal.toFixed(5)), Number(vertical.toFixed(5))];
  }

  function redrawLocalCanvas() {
    drawDrawing(canvas, localStrokes);
  }

  function beginStroke(event) {
    if (!hasLegalAction("submit_drawing") || explainMode || confirmingDrawing || !canvas
      || event.button !== 0 || event.isPrimary === false || activeStroke) {
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
    activePointerId = event.pointerId;
    activeStroke = [point];
    localStrokes.push(activeStroke);
    if (typeof canvas.setPointerCapture === "function") {
      canvas.setPointerCapture(event.pointerId);
    }
    redrawLocalCanvas();
    updateActionButtons();
  }

  function extendStroke(event) {
    if (!activeStroke || event.pointerId !== activePointerId || !hasLegalAction("submit_drawing") || explainMode) {
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
    if (!activeStroke || event.pointerId !== activePointerId) {
      return;
    }
    activeStroke = null;
    activePointerId = null;
    if (canvas && typeof canvas.releasePointerCapture === "function") {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch (error) {
      }
    }
    updateActionButtons();
  }

  function createDrawingCard(label, drawing, options) {
    const settings = options || {};
    const card = document.createElement("div");
    card.className = "subtext-drawing-card";
    if (settings.selected) {
      card.classList.add("selected");
    }
    if (settings.partner) {
      card.classList.add("partner");
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
    const zoom = document.createElement("button");
    zoom.type = "button";
    zoom.className = "subtext-zoom-btn";
    zoom.textContent = "Zoom";
    zoom.setAttribute("aria-label", "Enlarge " + label + " drawing");
    zoom.setAttribute("data-subtext-explain", "zoom");
    zoom.addEventListener("click", () => openPreview(label, drawing));
    heading.appendChild(zoom);
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "subtext-choice";
    choice.setAttribute("aria-label", (settings.interactive ? "Select drawing " : "Enlarge drawing ") + label);
    if (settings.interactive) {
      choice.disabled = !!settings.disabled;
      choice.setAttribute("aria-pressed", String(!!settings.selected));
      choice.setAttribute("data-subtext-explain", "candidate");
    } else {
      choice.setAttribute("data-subtext-explain", "zoom");
      choice.addEventListener("click", () => openPreview(label, drawing));
    }
    const drawingCanvas = document.createElement("canvas");
    drawingCanvas.width = 640;
    drawingCanvas.height = 480;
    drawingCanvas.setAttribute("aria-label", label + " drawing");
    choice.appendChild(drawingCanvas);
    card.append(heading, choice);
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
      score.dataset.subtextTip = "Cumulative score in points.";
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
      if (player.is_bot && tags.length && !tags.includes("Bot")) {
        meta.textContent += " · Bot";
      }
      card.append(name, score, meta);
      playersContainer.appendChild(card);
    });
    const playerCount = document.getElementById("subtextPlayerCount");
    if (playerCount) playerCount.textContent = String((view.players || []).length);
  }

  function updateActionButtons() {
    const canDraw = hasLegalAction("submit_drawing");
    if (canvas) {
      canvas.classList.toggle("locked", !canDraw);
      canvas.setAttribute("aria-disabled", (!canDraw).toString());
    }
    if (undoBtn) {
      undoBtn.disabled = !canDraw || confirmingDrawing || !localStrokes.length;
    }
    if (resetBtn) {
      resetBtn.disabled = !canDraw || confirmingDrawing || !localStrokes.length;
    }
    if (submitDrawingBtn) {
      submitDrawingBtn.disabled = !canDraw || confirmingDrawing || totalLocalPoints() === 0;
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
    const needsAction = canDraw || canGuess || hasLegalAction("next_round");
    document.body.classList.toggle("subtext-needs-action", needsAction && !panel?.classList.contains("hidden"));
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
    const submitted = !hasLegalAction("submit_drawing");
    drawingArea.classList.toggle("submitted", submitted);
    setVisible(drawingSubmitted, submitted);
    if (submitted) closeDrawingConfirmation();
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
    drawDrawing(dealerCanvas, view.dealer_drawing);
    if (guessCounter) {
      guessCounter.textContent = String(view.guess_progress.done) + "/" + String(view.guess_progress.total) + " voted";
    }
    if (candidateGrid) {
      const scrollTop = candidateGrid.scrollTop;
      const focusedSlot = document.activeElement?.closest("[data-slot-id]")?.dataset.slotId;
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
        const choice = card.querySelector(".subtext-choice");
        const explanationKey = "candidate" + candidate.slot_id;
        explanations[explanationKey] = "Drawing " + candidate.slot_id
          + (candidate.is_yours ? " is your own drawing. This does not identify you as the Partner." : " is anonymous. The author is hidden until the reveal.")
          + " Select the drawing you think shares the Dealer's word, then Submit Guess to lock it.";
        choice.setAttribute("data-subtext-explain", explanationKey);
        choice.addEventListener("click", () => {
          if (explainMode || !hasLegalAction("submit_guess")) {
            return;
          }
          selectedSlot = candidate.slot_id;
          syncGuessSelection();
        });
        candidateGrid.appendChild(card);
      });
      candidateGrid.scrollTop = scrollTop;
      if (focusedSlot) {
        const card = Array.from(candidateGrid.children).find((entry) => entry.dataset.slotId === focusedSlot);
        card?.querySelector(".subtext-choice")?.focus({ preventScroll: true });
      }
    }
    syncGuessSelection();
  }

  function syncGuessSelection() {
    candidateGrid?.querySelectorAll("[data-slot-id]").forEach((card) => {
      const selected = selectedSlot === card.dataset.slotId;
      card.classList.toggle("selected", selected);
      card.querySelector(".subtext-choice")?.setAttribute("aria-pressed", String(selected));
    });
    if (selectedGuessLabel) {
      selectedGuessLabel.textContent = selectedSlot
        ? (hasLegalAction("submit_guess") ? "Selected: " : "Locked: ") + selectedSlot
        : "Choose a drawing";
    }
    updateActionButtons();
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
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = "The shared word was “" + String(summary.target_word || "-") + "”";
      const detail = document.createElement("span");
      detail.textContent = playerName(view, summary.dealer_id) + " and "
        + playerName(view, summary.partner_id) + " were the hidden pair · "
        + String(summary.wrong_count || 0) + " miss"
        + (Number(summary.wrong_count || 0) === 1 ? "" : "es");
      copy.append(title, detail);
      resultBanner.append(copy);
    }
    if (resultDrawings) {
      resultDrawings.innerHTML = "";
      const dealerCard = createDrawingCard("Dealer · " + playerName(view, summary.dealer_id), summary.dealer_drawing, {
          badge: "Shared word",
        });
      dealerCard.classList.add("dealer");
      resultDrawings.appendChild(dealerCard);
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
        if (player.player_id === view.you) row.classList.add("self");
        if (player.player_id === summary.dealer_id || player.player_id === summary.partner_id) {
          row.classList.add("shared-pair");
        }
        const values = [
          (player.name || player.player_id || "-") + (player.player_id === view.you ? " (You)" : ""),
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
      activePointerId = null;
      selectedSlot = null;
      closeDrawingConfirmation();
      previewDialog?.close();
    }
    if (currentView && currentView.phase !== view.phase) {
      closeDrawingConfirmation();
      previewDialog?.close();
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
    activePointerId = null;
    closeDrawingConfirmation();
    previewDialog?.close();
    hideTooltip();
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
    explainWidget?.exit();
    helpWidget?.close();
    updateActionButtons();
  }

  function showHeaderActions(show) {
    if (headerActions) {
      headerActions.style.display = show ? "flex" : "none";
    }
    if (!show) {
      explainWidget?.exit();
      helpWidget?.close();
      previewDialog?.close();
      hideTooltip();
      document.body.classList.remove("subtext-needs-action");
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

  if (canvas) {
    canvas.addEventListener("pointerdown", beginStroke);
    canvas.addEventListener("pointermove", extendStroke);
    canvas.addEventListener("pointerup", finishStroke);
    canvas.addEventListener("pointercancel", finishStroke);
    canvas.addEventListener("lostpointercapture", finishStroke);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      if (!hasLegalAction("submit_drawing") || explainMode || confirmingDrawing) {
        return;
      }
      localStrokes.pop();
      redrawLocalCanvas();
      updateActionButtons();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (!hasLegalAction("submit_drawing") || explainMode || confirmingDrawing) {
        return;
      }
      localStrokes = [];
      activeStroke = null;
      activePointerId = null;
      redrawLocalCanvas();
      updateActionButtons();
    });
  }

  if (submitDrawingBtn) {
    submitDrawingBtn.addEventListener("click", () => {
      if (!hasLegalAction("submit_drawing") || explainMode || !totalLocalPoints()) {
        return;
      }
      activeStroke = null;
      activePointerId = null;
      confirmingDrawing = true;
      setVisible(drawingConfirm, true);
      updateActionButtons();
      confirmDrawingBtn?.focus({ preventScroll: true });
    });
  }

  cancelDrawingBtn?.addEventListener("click", () => {
    closeDrawingConfirmation();
    updateActionButtons();
    submitDrawingBtn?.focus({ preventScroll: true });
  });

  confirmDrawingBtn?.addEventListener("click", () => {
    if (confirmingDrawing && hasLegalAction("submit_drawing") && !explainMode && totalLocalPoints()) {
      closeDrawingConfirmation();
      sendAction({
        type: "submit_drawing",
        drawing: localStrokes.map((stroke) => stroke.map((point) => point.slice())),
      });
      updateActionButtons();
    }
  });

  if (candidateGrid) {
    candidateGrid.addEventListener("click", (event) => {
      if (
        event.target === candidateGrid
        && hasLegalAction("submit_guess")
        && !explainMode
        && selectedSlot
      ) {
        selectedSlot = null;
        syncGuessSelection();
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

  document.getElementById("subtextZoomDealerBtn")?.addEventListener("click", () => {
    openPreview("Dealer · " + playerName(currentView, currentView?.dealer_id), currentView?.dealer_drawing);
  });
  document.getElementById("subtextPreviewCloseBtn")?.addEventListener("click", () => previewDialog?.close());
  previewDialog?.addEventListener("click", (event) => {
    if (event.target === previewDialog) previewDialog.close();
  });

  panel?.addEventListener("pointerover", (event) => {
    const target = event.target.closest("[data-subtext-tip]");
    if (target && event.pointerType === "mouse") showTooltip(target);
  });
  panel?.addEventListener("pointerout", (event) => {
    if (event.target.closest("[data-subtext-tip]")) hideTooltip();
  });
  panel?.addEventListener("pointerdown", (event) => {
    const target = event.target.closest("[data-subtext-tip]");
    tooltipGesture = target ? { target, horizontal: event.clientX, vertical: event.clientY } : null;
  });
  panel?.addEventListener("pointerup", (event) => {
    if (tooltipGesture && event.target.closest("[data-subtext-tip]") === tooltipGesture.target
      && Math.hypot(event.clientX - tooltipGesture.horizontal, event.clientY - tooltipGesture.vertical) < 10) {
      showTooltip(tooltipGesture.target);
    }
    tooltipGesture = null;
  });
  panel?.addEventListener("pointercancel", () => { tooltipGesture = null; });
  document.addEventListener("scroll", hideTooltip, true);
  panel?.addEventListener("click", (event) => {
    if (confirmingDrawing && !event.target.closest(".subtext-inline-confirm, button")) {
      closeDrawingConfirmation();
      updateActionButtons();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) {
      return;
    }
    if (previewDialog?.open || helpWidget?.isOpen() || document.querySelector(".obg-explain-dialog[open]")) {
      return;
    }
    if (explainMode) {
      explainWidget?.exit();
      return;
    }
    explainWidget?.exit();
    helpWidget?.close();
    closeDrawingConfirmation();
    previewDialog?.close();
    hideTooltip();
    if (currentView && currentView.phase === "guessing" && hasLegalAction("submit_guess") && selectedSlot) {
      selectedSlot = null;
      syncGuessSelection();
    }
    updateActionButtons();
  });

  function initializeHelp() {
    if (typeof window.obgCreateHelp !== "function" || helpWidget) return;
    helpWidget = window.obgCreateHelp(helpConfig);
    explainWidget = window.obgCreateExplain({
      gameId: "subtext",
      attribute: "data-subtext-explain",
      explanations: explanations,
      button: explainBtn,
      root: () => panel,
      bypass: ["#subtextHelpBtn", "#subtextExplainBtn"],
      onChange: (active) => {
        explainMode = active;
        activeStroke = null;
        activePointerId = null;
        closeDrawingConfirmation();
        hideTooltip();
        updateActionButtons();
      },
    });
    helpBtn?.addEventListener("click", () => {
      explainWidget.exit();
      closeDrawingConfirmation();
      updateActionButtons();
      helpWidget.open();
    });
    explainBtn?.addEventListener("click", () => explainWidget.toggle());
  }

  window.renderSubtextGameState = renderGameState;
  window.clearSubtextState = clearState;
  window.showSubtextHeaderActions = showHeaderActions;
  window.updateSubtextConfigRow = updateConfigRow;
  window.getSubtextRoomConfig = getRoomConfig;

  clearState();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeHelp);
  } else {
    initializeHelp();
  }
  updateConfigRow();
  if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "subtext") {
    renderGameState(lastGameStatePayload);
  }
})();
