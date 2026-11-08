// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const blitzSketchHelpButton = document.getElementById("blitzSketchHelpBtn");
const blitzSketchExplainButton = document.getElementById("blitzSketchExplainBtn");

const BLITZ_SKETCH_HELP_CONFIG = {
  gameId: "blitz_sketch",
  title: { zh: "闪电速写 · Blitz Sketch", en: "Blitz Sketch" },
  basic: {
    win: {
      zh: "每猜对一张自己画的图就得 1 分，把要猜的图全部猜完后，分数最高的人赢下这一局。",
      en: "Every one of your own drawings you name correctly is worth one point, and whoever holds the highest score after the last drawing wins the game."
    },
    turn: {
      zh: "作画阶段你在极短的倒计时里一张接一张地照着词画图，时间一到画布(🖌️)自动交卷，猜词阶段你再凭记忆写出自己刚才画过的词。",
      en: "In the drawing phase you sketch one word after another against a very short countdown and the canvas (🖌️) submits itself when time runs out, and in the guessing phase you write down those same words from memory."
    },
    key: {
      zh: "重点是趁画的时候把词记住，因为你猜的全都是自己刚画的图，画得越有辨识度、记得越牢，猜起来就越快。",
      en: "The key is to memorise the word while you draw, because every picture you guess is one you drew yourself, so a distinctive sketch and a sharp memory pay off twice."
    }
  },
  sections: [
    {
      id: "flow",
      label: { zh: "流程与设置", en: "Flow and setup" },
      html: {
        zh: "<p>一局分三个阶段：Draw 限时作画、Guess 回忆作答、Review 回顾，作答完毕就进入回顾并结束游戏。</p>"
          + "<p>所有人同时进行，你画完自己的全部词只代表你个人的进度，要等所有人都画完才会一起进入猜词阶段。</p>"
          + "<p>房主可以设置作画张数（默认 20 张）、要猜的张数（默认 10 张，并且不会超过作画张数）、每张画的时间以及跳过后揭示答案的时间。</p>"
          + "<p>游戏支持一个人独自练习，也支持最多 8 人同场比拼。</p>",
        en: "<p>A game runs through three phases: Draw for the timed sketching, Guess for the memory round, and Review for the final look back.</p>"
          + "<p>Everyone plays at the same time. Finishing all of your own drawings only advances your own progress, and the guessing phase starts once every player is done.</p>"
          + "<p>The host sets how many drawings each player makes (20 by default), how many of them come back for guessing (10 by default and never more than the drawing count), how long each drawing lasts, and how long a skipped answer stays on screen.</p>"
          + "<p>The game works solo for practice and supports up to eight players competing together.</p>"
      }
    },
    {
      id: "draw",
      label: { zh: "限时作画", en: "Timed drawing" },
      html: {
        zh: "<p>Prompt 显示当前要画的词，你用画布(🖌️)把它画出来，画笔固定是黑色细线，没有颜色也没有橡皮。</p>"
          + "<p>Time 是这一张剩下的秒数，倒数到零时画布会自动提交，你来不及再做修改。</p>"
          + "<p>交卷后立刻换成下一个词，画布自动清空，Draw 后面的数字记录你已经画完几张。</p>"
          + "<p>时间非常短，所以画出轮廓和最有辨识度的那个特征就够了，不必追求细节。</p>",
        en: "<p>Prompt shows the word you have to draw and you sketch it on the canvas (🖌️). The pen is a fixed thin black line with no colours and no eraser.</p>"
          + "<p>Time counts down the seconds left for this picture. When it hits zero the canvas submits itself and there is no chance to touch it up.</p>"
          + "<p>A new word appears right after each submission and the canvas clears itself, while the number behind Draw tracks how many pictures you have finished.</p>"
          + "<p>The clock is short, so an outline plus the single most recognisable feature is enough. Detail is not the point.</p>"
      }
    },
    {
      id: "guess",
      label: { zh: "回忆作答", en: "Guessing from memory" },
      html: {
        zh: "<p>进入猜词阶段后，系统打乱顺序抽出你刚画过的一部分图，一次只给你看一张，你要写出当初那个词。</p>"
          + "<p>答案要和原词完全一致（空格会被忽略）才算答对，答对得 1 分并自动跳到下一张。</p>"
          + "<p>答错会提示你不对，但这张图不会跳过，你可以改了再答，直到答对为止。</p>"
          + "<p>Guess 后面的数字是你已经猜完的张数，Score 是你当前的得分。</p>",
        en: "<p>When the guessing phase starts, the game shuffles a subset of the pictures you just drew and shows them one at a time, and you write the word each one came from.</p>"
          + "<p>An answer counts only when it matches the original word exactly, with spaces ignored. A correct answer scores one point and moves straight to the next picture.</p>"
          + "<p>A wrong answer tells you it is wrong but keeps the same picture on screen, so you can edit your answer and try again until it lands.</p>"
          + "<p>The number behind Guess is how many pictures you have finished, and Score is your current total.</p>"
      }
    },
    {
      id: "skip",
      label: { zh: "跳过与揭示", en: "Skipping and reveals" },
      html: {
        zh: "<p>实在想不起词时可以按我跳过，这张图不算分，直接进入下一张。</p>"
          + "<p>跳过之后系统会把正确答案显示出来几秒，同时把这张图再放一遍，方便你对照。</p>"
          + "<p>揭示的这几秒里不能作答，时间结束后自动跳到下一张。</p>",
        en: "<p>When a word will not come back to you, press the skip button. That picture scores nothing and the game moves on.</p>"
          + "<p>After a skip the game shows the correct answer for a few seconds and puts the same picture back on screen so you can compare them.</p>"
          + "<p>You cannot answer during that reveal, and the next picture arrives automatically once the reveal ends.</p>"
      }
    },
    {
      id: "review",
      label: { zh: "回顾与胜负", en: "Review and winning" },
      html: {
        zh: "<p>所有人都猜完之后进入回顾，每位玩家的全部作品会连同当时的词和猜测一起列出来。</p>"
          + "<p>猜对的条目和跳过的条目分别标记，你一眼就能看出哪些词自己记得最牢。</p>"
          + "<p>最终比较 Score，得分最高的人获胜，同分则并列。</p>",
        en: "<p>Once everyone has finished guessing, the review lists every drawing each player made together with its word and the guess that was made.</p>"
          + "<p>Correct answers and skips are marked separately, so you can see at a glance which words stuck with you.</p>"
          + "<p>The final comparison is Score. The highest total wins, and players on the same total share the win.</p>"
      }
    }
  ]
};

const BLITZ_SKETCH_EXPLAIN = {
  game_title: { zh: "闪电速写(⚡)，在几秒钟内画完一个词、再凭记忆把它答回来的游戏。", en: "Blitz Sketch (⚡), where you sketch a word in a few seconds and then recall it from memory." },
  phase: { zh: "当前阶段。draw 是限时作画，guess 是回忆作答，review 是回顾。", en: "The current phase: draw is the timed sketching, guess is the memory round, and review is the final look back." },
  draw_progress: { zh: "你已经画完几张，以及这一局一共要画几张。", en: "How many drawings you have finished and how many this game asks for." },
  guess_progress: { zh: "你已经猜完几张，以及一共要猜几张。要猜的张数不会超过作画张数。", en: "How many pictures you have guessed and how many you must guess. The guess count never exceeds the drawing count." },
  score: { zh: "你当前的得分，每答对一张自己画的图加 1 分。", en: "Your current score. Each of your own drawings you name correctly adds one point." },
  prompt: { zh: "当前要画的词。趁画的时候把它记住，猜词阶段还要用。", en: "The word you have to draw right now. Memorise it while you sketch, because the guessing phase will ask for it." },
  timer: { zh: "这一张画剩下的秒数，归零时画布(🖌️)会自动交卷。", en: "The seconds left for this picture. The canvas (🖌️) submits itself the moment it reaches zero." },
  canvas: { zh: "画布(🖌️)。按住鼠标或手指拖动就能画，笔是固定的黑色细线，没有颜色和橡皮。", en: "The canvas (🖌️). Drag with the mouse or a finger to draw. The pen is a fixed thin black line with no colours and no eraser." },
  image: { zh: "现在要猜的图，它是你自己在作画阶段画的，你要写出当时的词。", en: "The picture you have to name. You drew it yourself during the drawing phase and now you must recall its word." },
  guess_input: { zh: "写下你记得的词，答案要和原词一致（空格忽略），按回车也能提交。", en: "Type the word you remember. It must match the original word with spaces ignored, and Enter submits it too." },
  submit_guess: { zh: "提交你的答案。答对得 1 分并跳到下一张，答错可以改了再答。", en: "Submit your answer. A correct one scores a point and moves on, and a wrong one lets you edit and try again." },
  skip: { zh: "放弃这一张，不计分直接进入下一张，同时会揭示正确答案。", en: "Give up on this picture. It scores nothing, the game moves on, and the correct answer is revealed." },
  feedback: { zh: "上一答案的反馈，答对会恭喜你，答错会提示再试。", en: "Feedback on your last answer, congratulating a correct one and telling you to retry a wrong one." },
  reveal: { zh: "跳过之后显示的正确答案，只停留几秒，这段时间不能作答。", en: "The correct answer shown after a skip. It stays for a few seconds and you cannot answer while it is up." },
  players: { zh: "所有玩家的作画进度、猜词进度和当前得分。", en: "Every player with their drawing progress, guessing progress and current score." },
  review: { zh: "回顾阶段的全部作品，每张都标出词语和你当时的猜测。", en: "Every drawing from the review, each labelled with its word and the guess you made." }
};

let blitzSketchHelpWidget = null;
let blitzSketchExplainWidget = null;

function initBlitzSketchHelpExplain() {
  if (blitzSketchHelpWidget || typeof window.obgCreateHelp !== "function") return;
  blitzSketchHelpWidget = window.obgCreateHelp(BLITZ_SKETCH_HELP_CONFIG);
  blitzSketchExplainWidget = window.obgCreateExplain({
    gameId: "blitz_sketch",
    attribute: "data-blitz-sketch-explain",
    explanations: BLITZ_SKETCH_EXPLAIN,
    button: blitzSketchExplainButton,
    root: () => document.getElementById("blitzSketchPanel"),
    bypass: ["#blitzSketchHelpBtn", "#blitzSketchExplainBtn"]
  });
  blitzSketchHelpButton?.addEventListener("click", () => {
    blitzSketchExplainWidget?.exit();
    blitzSketchHelpWidget.open();
  });
  blitzSketchExplainButton?.addEventListener("click", () => blitzSketchExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBlitzSketchHelpExplain);
} else {
  initBlitzSketchHelpExplain();
}

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
