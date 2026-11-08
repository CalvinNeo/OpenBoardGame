// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const drawGuessHelpButton = document.getElementById("drawGuessHelpBtn");
const drawGuessExplainButton = document.getElementById("drawGuessExplainBtn");

const DRAW_GUESS_HELP_CONFIG = {
  gameId: "draw_guess",
  title: { zh: "你画我猜接力 · Draw & Guess", en: "Draw & Guess" },
  basic: {
    win: {
      zh: "这个游戏不记分数，比的是每本画册(📖)最后那句猜测离它开头的题目还有多近，最后一轮结束时所有画册会一起翻开。",
      en: "This game keeps no score. What you compare is how close the final guess in each book (📖) lands to the prompt it started with, and every book is opened at once when the last round ends."
    },
    turn: {
      zh: "每一轮所有人同时动手，轮到你画画时就照着画册上的那个词在画布(🖌️)上画一张图，轮到你猜词时就看着上一位玩家留下的画写下一个词。",
      en: "Every round everyone acts at the same time. In a drawing round you sketch the word written in your book on the canvas (🖌️), and in a guessing round you write one word for the drawing the previous player left behind."
    },
    key: {
      zh: "重点是接力，画册每轮往下家传一位，所以画的时候要让下一个人看得懂，猜的时候要尽量还原上一个词，信息才不会在中途断掉。",
      en: "The key is the relay, because each book moves one seat down every round. Draw so the next player can read it and guess so the previous word survives, otherwise the chain breaks halfway."
    }
  },
  sections: [
    {
      id: "books",
      label: { zh: "画册与轮数", en: "Books and rounds" },
      html: {
        zh: "<p>开局时每位玩家都拿到一本属于自己的画册(📖)，里面只写着一个题目词，只有本轮持有这本画册的人能看到它。</p>"
          + "<p>每过一轮画册就往下家传一位，所以你在第几轮拿到的画册，里面装的就是前几位玩家接力留下的东西。</p>"
          + "<p>总轮数等于玩家人数（人数为偶数）或人数减一（人数为奇数，最少两轮），这样每本画册都会被好几位玩家经手。</p>"
          + "<p>轮次按画画和猜词交替推进，一轮里所有人同时提交，全部交齐之后本轮才会结算并进入下一轮。</p>",
        en: "<p>At the start every player owns one book (📖) that holds a single prompt word, and only the player currently holding that book can see it.</p>"
          + "<p>Each round every book passes one seat down, so the book you hold in a later round already carries what several earlier players added to it.</p>"
          + "<p>The number of rounds equals the player count when it is even, or the player count minus one when it is odd, with two rounds as the minimum, so several players touch every book.</p>"
          + "<p>Rounds alternate between drawing and guessing. Everyone submits at the same time and the round only resolves once every player has handed something in.</p>"
      }
    },
    {
      id: "draw",
      label: { zh: "画画阶段", en: "Drawing round" },
      html: {
        zh: "<p>轮到你画画时，Prompt 会显示你这本画册当前的词，你要用画布(🖌️)把它画出来交给下一位玩家去猜。</p>"
          + "<p>Color 一排是九种颜色的画笔，Brush 一排的 S、M、L、XL 是四种笔刷粗细，Eraser 切换成橡皮，Clear 会把整张画布清空重来。</p>"
          + "<p>画好之后按 Submit Drawing 交卷，提交之前可以随便改，一旦提交就只能等其他玩家，本轮结束前不能再动笔。</p>",
        en: "<p>When it is your turn to draw, Prompt shows the word currently sitting in your book and you sketch it on the canvas (🖌️) for the next player to guess.</p>"
          + "<p>The Color row offers nine pen colours, the Brush row offers four stroke widths called S, M, L and XL, Eraser switches the pen to an eraser, and Clear wipes the whole canvas.</p>"
          + "<p>Press Submit Drawing when the picture is ready. You may keep editing until you submit, and after that you simply wait for the others.</p>"
      }
    },
    {
      id: "guess",
      label: { zh: "猜词阶段", en: "Guessing round" },
      html: {
        zh: "<p>轮到你猜词时，你会看到上一位玩家刚刚画好的那张图，你要猜出他画的到底是哪个词。</p>"
          + "<p>在输入框里写下答案再按 Submit Guess，你写的这个词会作为文字进入画册，变成下一位玩家要画的内容。</p>"
          + "<p>房间打开答案长度提示时，Display length 会告诉你那个词有几个字，这是猜词阶段唯一的额外线索。</p>",
        en: "<p>In a guessing round you are shown the picture the previous player has just drawn, and you have to work out which word it stands for.</p>"
          + "<p>Type your answer and press Submit Guess. Your word enters the book as text and becomes what the next player has to draw.</p>"
          + "<p>When the room enables the answer length option, Display length tells you how many characters the word has, and that is the only extra clue in this phase.</p>"
      }
    },
    {
      id: "review",
      label: { zh: "回顾与结局", en: "Review and ending" },
      html: {
        zh: "<p>最后一轮结束后游戏进入 Review，每本画册(📖)都会完整摊开：最初的题目、每一轮的画与猜、以及最后那句猜测。</p>"
          + "<p>如果最后那句猜测和最初的题目完全一致（忽略大小写和空格），这本画册会被标记成对上(match)。</p>"
          + "<p>这里没有输赢结算，大家比的是哪本画册在传递中变形得最有趣，以及哪本画册一路都没有跑题。</p>",
        en: "<p>After the last round the game moves to Review and every book (📖) is laid out in full: the original prompt, each round's drawing and guess, and the final guess.</p>"
          + "<p>A book is marked as a match when its final guess equals the original prompt once letter case and spacing are ignored.</p>"
          + "<p>Nothing is scored here. What everyone compares is which book warped into the funniest shape and which one stayed on topic the whole way.</p>"
      }
    },
    {
      id: "options",
      label: { zh: "房间设置", en: "Room options" },
      html: {
        zh: "<p>题库语言决定 Prompt 用中文还是英文出题，房间里所有玩家共用同一套题库。</p>"
          + "<p>Show answer length 打开之后，猜词阶段会额外显示答案的字数，让猜词轻松一些。</p>"
          + "<p>这些设置由房主在开局前的大厅里调整，开局之后就不会再变。</p>",
        en: "<p>The prompt language decides whether Prompt hands out Chinese or English words, and every player in the room draws from the same pool.</p>"
          + "<p>With Show answer length turned on, the guessing round also reveals how many characters the answer has, which makes guessing easier.</p>"
          + "<p>The host adjusts these options in the lobby before the game starts and they stay fixed once the game is running.</p>"
      }
    }
  ]
};

const DRAW_GUESS_EXPLAIN = {
  game_title: { zh: "你画我猜接力(🎨)，画册在玩家之间一轮轮传递的画画猜词游戏。", en: "Draw & Guess (🎨), a drawing and guessing relay where the books pass from player to player." },
  phase: { zh: "当前阶段。draw 是画画，guess 是猜词，review 是回顾画册。", en: "The current phase: draw means sketching, guess means naming the drawing, and review means reading the finished books." },
  round: { zh: "当前是第几轮，以及这一局一共有多少轮。", en: "Which round is running and how many rounds this game lasts in total." },
  submitted: { zh: "你本轮是否已经交卷。所有人交齐之后本轮才会结算。", en: "Whether you have already handed in this round. The round only resolves once everyone has submitted." },
  prompt: { zh: "你这本画册(📖)当前要处理的词，画画阶段照着它画，猜词阶段不看它。", en: "The word currently sitting in your book (📖). You draw it in a drawing round and you never see it in a guessing round." },
  canvas: { zh: "画布(🖌️)。按住鼠标或用手指在上面拖动就能画线，画完按 Submit Drawing 交卷。", en: "The canvas (🖌️). Drag with the mouse or a finger to draw lines, then press Submit Drawing to hand it in." },
  colors: { zh: "画笔颜色一共九种，点其中一个色块就把画笔换成那种颜色。", en: "There are nine pen colours, and clicking a swatch switches the pen to that colour." },
  color_black: { zh: "黑色画笔，画出来的线是黑色，也是默认的画笔。", en: "The black pen, which draws black lines and is the pen you start with." },
  color_red: { zh: "红色画笔，画出来的线是红色。", en: "The red pen, which draws red lines." },
  color_orange: { zh: "橙色画笔，画出来的线是橙色。", en: "The orange pen, which draws orange lines." },
  color_yellow: { zh: "黄色画笔，画出来的线是黄色。", en: "The yellow pen, which draws yellow lines." },
  color_bright_yellow: { zh: "亮黄色画笔，比普通黄色更浅更亮。", en: "The bright yellow pen, a lighter and brighter yellow than the plain one." },
  color_green: { zh: "绿色画笔，画出来的线是绿色。", en: "The green pen, which draws green lines." },
  color_blue: { zh: "蓝色画笔，画出来的线是蓝色。", en: "The blue pen, which draws blue lines." },
  color_purple: { zh: "紫色画笔，画出来的线是紫色。", en: "The purple pen, which draws purple lines." },
  color_brown: { zh: "棕色画笔，画出来的线是棕色。", en: "The brown pen, which draws brown lines." },
  brush: { zh: "笔刷粗细一共四档，S 最细，XL 最粗，选中哪一档就一直用哪一档画。", en: "There are four brush widths, from the thinnest S to the thickest XL, and the selected one is used for every stroke." },
  brush_s: { zh: "最细的笔刷(S)，适合勾细节和写小字。", en: "The thinnest brush (S), good for details and small marks." },
  brush_m: { zh: "中等粗细的笔刷(M)，日常画线用这一档最顺手。", en: "The medium brush (M), the easiest width for ordinary lines." },
  brush_l: { zh: "较粗的笔刷(L)，适合画轮廓和大块的形。", en: "The large brush (L), useful for outlines and bigger shapes." },
  brush_xl: { zh: "最粗的笔刷(XL)，适合大面积涂抹。", en: "The extra large brush (XL), useful for broad strokes." },
  clear: { zh: "清空整张画布重新画，点了会先问一次确认。", en: "Wipe the whole canvas and start over. It asks for confirmation first." },
  eraser: { zh: "切换橡皮，橡皮擦过的地方会变回白色，再点一次换回画笔。", en: "Switch to the eraser, which rubs strokes back to white. Press it again to return to the pen." },
  submit_drawing: { zh: "把画布(🖌️)上现在的图交出去，交给下一位玩家去猜，交完不能再改。", en: "Hand in whatever is on the canvas (🖌️) right now. It goes to the next player to guess and cannot be changed afterwards." },
  image: { zh: "上一位玩家画好的图，你要看着它猜出原本的词。", en: "The picture the previous player drew. You have to work out the original word from it." },
  answer_length: { zh: "答案的字数提示，只有房间打开这个选项时才会出现。", en: "The character count of the answer. It only appears when the room enables that option." },
  guess_input: { zh: "写下你猜的词，猜词阶段结束后它会变成下一位玩家要画的内容。", en: "Type the word you guessed. Once the round resolves it becomes what the next player has to draw." },
  submit_guess: { zh: "提交你写的猜测，提交后本轮就等其他人了。", en: "Submit the guess you typed. After that you wait for the rest of the round." },
  players: { zh: "所有玩家的状态，submitted 表示这一轮他已经交卷。", en: "Every player and their state, where submitted means that player has already handed in this round." },
  books: { zh: "回顾阶段展开的全部画册(📖)，每本都按顺序列出题目、画和猜。", en: "Every book (📖) opened during the review, each listing its prompt, drawings and guesses in order." },
  restart: { zh: "用同一个房间再开一局，画册和题目都会重新发。", en: "Start another game in the same room. Books and prompts are dealt again from scratch." }
};

let drawGuessHelpWidget = null;
let drawGuessExplainWidget = null;

function initDrawGuessHelpExplain() {
  if (drawGuessHelpWidget || typeof window.obgCreateHelp !== "function") return;
  drawGuessHelpWidget = window.obgCreateHelp(DRAW_GUESS_HELP_CONFIG);
  drawGuessExplainWidget = window.obgCreateExplain({
    gameId: "draw_guess",
    attribute: "data-draw-guess-explain",
    explanations: DRAW_GUESS_EXPLAIN,
    button: drawGuessExplainButton,
    root: () => document.getElementById("drawGuessPanel"),
    bypass: ["#drawGuessHelpBtn", "#drawGuessExplainBtn"]
  });
  drawGuessHelpButton?.addEventListener("click", () => {
    drawGuessExplainWidget?.exit();
    drawGuessHelpWidget.open();
  });
  drawGuessExplainButton?.addEventListener("click", () => drawGuessExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDrawGuessHelpExplain);
} else {
  initDrawGuessHelpExplain();
}

const drawGuessConfigBox = document.getElementById("drawGuessConfigBox");
const drawGuessLanguageRow = document.getElementById("drawGuessLanguageRow");
const drawGuessLanguageSelect = document.getElementById("drawGuessLanguageSelect");
const drawGuessGuessMethodRow = document.getElementById("drawGuessGuessMethodRow");
const drawGuessGuessMethodSelect = document.getElementById("drawGuessGuessMethodSelect");
const drawGuessAnswerLengthOptionRow = document.getElementById("drawGuessAnswerLengthOptionRow");
const drawGuessAnswerLengthToggle = document.getElementById("drawGuessAnswerLengthToggle");

const drawGuessPhaseLabel = document.getElementById("drawGuessPhase");
const drawGuessRoundLabel = document.getElementById("drawGuessRound");
const drawGuessTotalRoundsLabel = document.getElementById("drawGuessTotalRounds");
const drawGuessSubmittedLabel = document.getElementById("drawGuessSubmitted");
const drawGuessPromptRow = document.getElementById("drawGuessPromptRow");
const drawGuessPromptLabel = document.getElementById("drawGuessPrompt");
const drawGuessDrawArea = document.getElementById("drawGuessDrawArea");
const drawGuessGuessArea = document.getElementById("drawGuessGuessArea");
const drawGuessCanvas = document.getElementById("drawGuessCanvas");
const drawGuessClearBtn = document.getElementById("drawGuessClearBtn");
const drawGuessEraserBtn = document.getElementById("drawGuessEraserBtn");
const drawGuessSubmitDrawBtn = document.getElementById("drawGuessSubmitDrawBtn");
const drawGuessImage = document.getElementById("drawGuessImage");
const drawGuessAnswerLengthHintRow = document.getElementById("drawGuessAnswerLengthHintRow");
const drawGuessAnswerLengthLabel = document.getElementById("drawGuessAnswerLength");
const drawGuessInput = document.getElementById("drawGuessInput");
const drawGuessSubmitGuessBtn = document.getElementById("drawGuessSubmitGuessBtn");
const drawGuessPlayers = document.getElementById("drawGuessPlayers");
const drawGuessReview = document.getElementById("drawGuessReview");
const drawGuessBooks = document.getElementById("drawGuessBooks");
const drawGuessRestartBtn = document.getElementById("drawGuessRestartBtn");
const drawGuessColorPalette = document.getElementById("drawGuessColorPalette");
const drawGuessColorButtons = drawGuessColorPalette
  ? Array.from(drawGuessColorPalette.querySelectorAll("button[data-color]"))
  : [];
const drawGuessBrushSizes = document.getElementById("drawGuessBrushSizes");
const drawGuessBrushButtons = drawGuessBrushSizes
  ? Array.from(drawGuessBrushSizes.querySelectorAll("button[data-size]"))
  : [];
const drawGuessCtx = drawGuessCanvas ? drawGuessCanvas.getContext("2d") : null;

let currentDrawGuessView = null;

let drawGuessLastRound = null;
let drawGuessLastPhase = null;
let drawGuessIsDrawing = false;
let drawGuessHasDrawn = false;
let drawGuessIsErasing = false;
let drawGuessBrushColor = "#000000";
let drawGuessBrushSize = 3;

const drawGuessActionButtons = {
  submit_drawing: drawGuessSubmitDrawBtn,
  submit_guess: drawGuessSubmitGuessBtn,
};

function updateDrawGuessLanguageRow() {
  const showRow = currentRoomState && currentGameType === "draw_guess" && currentRoomState.status === "lobby";
  if (drawGuessConfigBox) {
    drawGuessConfigBox.classList.toggle("hidden", !showRow);
    drawGuessConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (drawGuessLanguageRow) {
    drawGuessLanguageRow.classList.toggle("hidden", !showRow);
    drawGuessLanguageRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (drawGuessGuessMethodRow) {
    drawGuessGuessMethodRow.classList.toggle("hidden", !showRow);
    drawGuessGuessMethodRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (drawGuessAnswerLengthOptionRow) {
    drawGuessAnswerLengthOptionRow.classList.toggle("hidden", !showRow);
    drawGuessAnswerLengthOptionRow.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function clearDrawGuessState() {
  currentDrawGuessView = null;
  drawGuessLastRound = null;
  drawGuessLastPhase = null;
  drawGuessIsDrawing = false;
  drawGuessHasDrawn = false;
  drawGuessBrushColor = "#000000";
  drawGuessBrushSize = 3;
  setDrawGuessTool(false);
  updateDrawGuessColorButtons();
  updateDrawGuessBrushButtons();
  drawGuessPhaseLabel.textContent = "-";
  drawGuessRoundLabel.textContent = "-";
  drawGuessTotalRoundsLabel.textContent = "-";
  drawGuessSubmittedLabel.textContent = "-";
  drawGuessPromptLabel.textContent = "-";
  if (drawGuessAnswerLengthLabel) {
    drawGuessAnswerLengthLabel.textContent = "-";
  }
  if (drawGuessAnswerLengthHintRow) {
    drawGuessAnswerLengthHintRow.classList.add("hidden");
  }
  drawGuessPlayers.innerHTML = "";
  drawGuessBooks.innerHTML = "";
  drawGuessReview.classList.add("hidden");
  drawGuessDrawArea.classList.add("hidden");
  drawGuessGuessArea.classList.add("hidden");
  drawGuessPromptRow.classList.remove("hidden");
  if (drawGuessInput) {
    drawGuessInput.value = "";
  }
  if (drawGuessImage) {
    drawGuessImage.removeAttribute("src");
  }
  clearDrawGuessCanvas();
  updateDrawGuessButtons();
}

function updateDrawGuessColorButtons() {
  if (!drawGuessColorButtons.length) {
    return;
  }
  drawGuessColorButtons.forEach((button) => {
    const color = button.dataset.color;
    const isActive = color === drawGuessBrushColor;
    button.classList.toggle("color-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function updateDrawGuessBrushButtons() {
  if (!drawGuessBrushButtons.length) {
    return;
  }
  drawGuessBrushButtons.forEach((button) => {
    const size = Number.parseFloat(button.dataset.size);
    const isActive = Number.isFinite(size) && size === drawGuessBrushSize;
    button.classList.toggle("tool-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function getDrawGuessLineWidth() {
  const baseSize = Number.isFinite(drawGuessBrushSize) ? drawGuessBrushSize : 3;
  return drawGuessIsErasing ? baseSize * 4 : baseSize;
}

function setDrawGuessBrushSize(size) {
  const nextSize = Number.parseFloat(size);
  if (!Number.isFinite(nextSize) || nextSize <= 0) {
    return;
  }
  drawGuessBrushSize = nextSize;
  if (drawGuessCtx) {
    drawGuessCtx.lineWidth = getDrawGuessLineWidth();
  }
  updateDrawGuessBrushButtons();
}

function setDrawGuessColor(color) {
  if (typeof color !== "string" || !color.trim()) {
    return;
  }
  drawGuessBrushColor = color;
  if (drawGuessIsErasing) {
    setDrawGuessTool(false);
  } else if (drawGuessCtx) {
    drawGuessCtx.strokeStyle = drawGuessBrushColor;
  }
  updateDrawGuessColorButtons();
}

function setDrawGuessTool(isErasing) {
  drawGuessIsErasing = !!isErasing;
  if (drawGuessCtx) {
    drawGuessCtx.globalCompositeOperation = drawGuessIsErasing ? "destination-out" : "source-over";
    drawGuessCtx.strokeStyle = drawGuessIsErasing ? "rgba(0, 0, 0, 1)" : drawGuessBrushColor;
    drawGuessCtx.lineWidth = getDrawGuessLineWidth();
    drawGuessCtx.beginPath();
  }
  if (drawGuessEraserBtn) {
    drawGuessEraserBtn.classList.toggle("tool-active", drawGuessIsErasing);
  }
}

function clearDrawGuessCanvas() {
  if (!drawGuessCtx || !drawGuessCanvas) {
    return;
  }
  const previousComposite = drawGuessCtx.globalCompositeOperation;
  drawGuessCtx.globalCompositeOperation = "source-over";
  drawGuessCtx.fillStyle = "#fff";
  drawGuessCtx.fillRect(0, 0, drawGuessCanvas.width, drawGuessCanvas.height);
  drawGuessCtx.globalCompositeOperation = previousComposite;
  drawGuessCtx.beginPath();
  drawGuessHasDrawn = false;
}

function getDrawGuessPosition(event) {
  const rect = drawGuessCanvas.getBoundingClientRect();
  const point = event.touches ? event.touches[0] : event;
  const scaleX = rect.width ? drawGuessCanvas.width / rect.width : 1;
  const scaleY = rect.height ? drawGuessCanvas.height / rect.height : 1;
  return {
    x: (point.clientX - rect.left) * scaleX,
    y: (point.clientY - rect.top) * scaleY,
  };
}

function startDrawGuess(event) {
  if (!drawGuessCtx || !drawGuessCanvas) {
    return;
  }
  event.preventDefault();
  drawGuessIsDrawing = true;
  const pos = getDrawGuessPosition(event);
  drawGuessCtx.beginPath();
  drawGuessCtx.moveTo(pos.x, pos.y);
  drawGuessHasDrawn = true;
}

function moveDrawGuess(event) {
  if (!drawGuessIsDrawing || !drawGuessCtx) {
    return;
  }
  event.preventDefault();
  const pos = getDrawGuessPosition(event);
  drawGuessCtx.lineTo(pos.x, pos.y);
  drawGuessCtx.stroke();
}

function endDrawGuess(event) {
  if (!drawGuessIsDrawing || !drawGuessCtx) {
    return;
  }
  event.preventDefault();
  drawGuessIsDrawing = false;
  drawGuessCtx.beginPath();
}

function setupDrawGuessCanvas() {
  if (!drawGuessCanvas || !drawGuessCtx) {
    return;
  }
  drawGuessCtx.lineCap = "round";
  setDrawGuessTool(false);
  clearDrawGuessCanvas();
  updateDrawGuessColorButtons();
  updateDrawGuessBrushButtons();

  drawGuessCanvas.addEventListener("mousedown", startDrawGuess);
  drawGuessCanvas.addEventListener("mousemove", moveDrawGuess);
  drawGuessCanvas.addEventListener("mouseup", endDrawGuess);
  drawGuessCanvas.addEventListener("mouseleave", endDrawGuess);

  drawGuessCanvas.addEventListener("touchstart", startDrawGuess, { passive: false });
  drawGuessCanvas.addEventListener("touchmove", moveDrawGuess, { passive: false });
  drawGuessCanvas.addEventListener("touchend", endDrawGuess, { passive: false });
  drawGuessCanvas.addEventListener("touchcancel", endDrawGuess, { passive: false });
}

function isDrawGuessActionAvailable(actionType) {
  if (currentGameType !== "draw_guess" || !currentDrawGuessView) {
    return false;
  }
  if (!Array.isArray(currentDrawGuessView.legal_actions)) {
    return false;
  }
  if (!currentDrawGuessView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "submit_guess") {
    return !!drawGuessInput.value.trim();
  }
  return true;
}

function updateDrawGuessButtons() {
  if (currentGameType !== "draw_guess") {
    Object.values(drawGuessActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    drawGuessClearBtn.disabled = true;
    if (drawGuessEraserBtn) {
      drawGuessEraserBtn.disabled = true;
    }
    drawGuessColorButtons.forEach((button) => {
      button.disabled = true;
    });
    drawGuessBrushButtons.forEach((button) => {
      button.disabled = true;
    });
    return;
  }
  Object.entries(drawGuessActionButtons).forEach(([actionType, button]) => {
    const allowed = isDrawGuessActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
  const canDraw = isDrawGuessActionAvailable("submit_drawing");
  drawGuessClearBtn.disabled = !canDraw;
  if (drawGuessEraserBtn) {
    drawGuessEraserBtn.disabled = !canDraw;
  }
  drawGuessColorButtons.forEach((button) => {
    button.disabled = !canDraw;
  });
  drawGuessBrushButtons.forEach((button) => {
    button.disabled = !canDraw;
  });
}

function renderDrawGuessPlayers(view) {
  drawGuessPlayers.innerHTML = "";
  view.players.forEach((p) => {
    const line = document.createElement("div");
    const tags = [];
    if (p.player_id === view.you) {
      tags.push("you");
    }
    if (p.submitted) {
      tags.push("submitted");
    }
    if (p.is_bot) {
      tags.push("bot");
    }
    line.textContent = `${p.seat + 1}. ${p.name} (${tags.join(", ") || "waiting"})`;
    drawGuessPlayers.appendChild(line);
  });
}

function renderDrawGuessReview(view) {
  if (!view.review || !view.review.books) {
    drawGuessReview.classList.add("hidden");
    return;
  }
  drawGuessReview.classList.remove("hidden");
  drawGuessBooks.innerHTML = "";
  view.review.books.forEach((book) => {
    const wrapper = document.createElement("div");
    wrapper.className = "review-book";
    if (book.final_match) {
      wrapper.classList.add("match");
    }
    const title = document.createElement("div");
    title.textContent = `${book.owner_name || book.owner_id}`;
    const promptLine = document.createElement("div");
    promptLine.textContent = `Prompt: ${book.prompt || "-"}`;
    const finalLine = document.createElement("div");
    finalLine.textContent = `Final guess: ${book.final_guess || "-"}`;
    wrapper.appendChild(title);
    wrapper.appendChild(promptLine);
    wrapper.appendChild(finalLine);

    book.entries.forEach((entry) => {
      const entryEl = document.createElement("div");
      entryEl.className = "review-entry";
      const label = document.createElement("div");
      const authorName = entry.author_name || entry.author_id || "unknown";
      label.textContent = `Round ${entry.round} ${entry.type} by ${authorName}`;
      entryEl.appendChild(label);
      if (entry.type === "drawing") {
        const img = document.createElement("img");
        img.src = entry.image_data || "";
        img.alt = "drawing";
        entryEl.appendChild(img);
      } else {
        const text = document.createElement("div");
        text.textContent = entry.text || "-";
        entryEl.appendChild(text);
      }
      wrapper.appendChild(entryEl);
    });

    drawGuessBooks.appendChild(wrapper);
  });
}

function renderDrawGuessGameState(data) {
  const view = data.view;
  currentDrawGuessView = view;
  if (currentGameType !== "draw_guess") {
    currentGameType = "draw_guess";
    setGamePanelVisibility("draw_guess");
  }

  drawGuessPhaseLabel.textContent = view.phase || "-";
  drawGuessRoundLabel.textContent = view.round ?? "-";
  drawGuessTotalRoundsLabel.textContent = view.total_rounds ?? "-";
  drawGuessSubmittedLabel.textContent = view.submitted ? "yes" : "no";

  renderDrawGuessPlayers(view);
  logGameEvents(data);

  if (view.phase === "draw") {
    drawGuessPromptRow.classList.remove("hidden");
    drawGuessPromptLabel.textContent = view.current_prompt || "-";
    drawGuessDrawArea.classList.remove("hidden");
    drawGuessGuessArea.classList.add("hidden");
    drawGuessReview.classList.add("hidden");
    if (drawGuessAnswerLengthHintRow) {
      drawGuessAnswerLengthHintRow.classList.add("hidden");
    }
    drawGuessInput.disabled = true;
    if (drawGuessLastRound !== view.round) {
      clearDrawGuessCanvas();
      setDrawGuessTool(false);
    }
    drawGuessCanvas.style.pointerEvents = view.submitted ? "none" : "auto";
  } else if (view.phase === "guess") {
    drawGuessPromptRow.classList.add("hidden");
    drawGuessDrawArea.classList.add("hidden");
    drawGuessGuessArea.classList.remove("hidden");
    drawGuessReview.classList.add("hidden");
    if (drawGuessLastPhase !== view.phase) {
      drawGuessInput.value = "";
    }
    if (view.current_drawing) {
      drawGuessImage.src = view.current_drawing;
    } else {
      drawGuessImage.removeAttribute("src");
    }
    const hasAnswerLength = Number.isFinite(view.answer_length);
    if (drawGuessAnswerLengthLabel) {
      drawGuessAnswerLengthLabel.textContent = hasAnswerLength ? `${view.answer_length}` : "-";
    }
    if (drawGuessAnswerLengthHintRow) {
      drawGuessAnswerLengthHintRow.classList.toggle("hidden", !hasAnswerLength);
    }
    drawGuessInput.disabled = view.submitted;
    drawGuessCanvas.style.pointerEvents = "none";
  } else if (view.phase === "review") {
    drawGuessPromptRow.classList.add("hidden");
    drawGuessDrawArea.classList.add("hidden");
    drawGuessGuessArea.classList.add("hidden");
    if (drawGuessAnswerLengthHintRow) {
      drawGuessAnswerLengthHintRow.classList.add("hidden");
    }
    drawGuessInput.disabled = true;
    drawGuessCanvas.style.pointerEvents = "none";
    renderDrawGuessReview(view);
  } else {
    drawGuessDrawArea.classList.add("hidden");
    drawGuessGuessArea.classList.add("hidden");
    drawGuessReview.classList.add("hidden");
    if (drawGuessAnswerLengthHintRow) {
      drawGuessAnswerLengthHintRow.classList.add("hidden");
    }
    drawGuessCanvas.style.pointerEvents = "none";
  }

  drawGuessLastRound = view.round;
  drawGuessLastPhase = view.phase;
  updateDrawGuessButtons();
}

drawGuessClearBtn.addEventListener("click", () => {
  if (!confirm("确定删除吗？")) {
    return;
  }
  clearDrawGuessCanvas();
});

if (drawGuessEraserBtn) {
  drawGuessEraserBtn.addEventListener("click", () => {
    setDrawGuessTool(!drawGuessIsErasing);
  });
}

if (drawGuessColorButtons.length) {
  drawGuessColorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const color = button.dataset.color;
      if (color) {
        setDrawGuessColor(color);
      }
    });
  });
}

if (drawGuessBrushButtons.length) {
  drawGuessBrushButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const size = Number.parseFloat(button.dataset.size);
      if (Number.isFinite(size)) {
        setDrawGuessBrushSize(size);
      }
    });
  });
}

drawGuessSubmitDrawBtn.addEventListener("click", () => {
  if (!drawGuessCanvas) {
    return;
  }
  sendAction({ type: "submit_drawing", image_data: drawGuessCanvas.toDataURL("image/png") });
});

drawGuessSubmitGuessBtn.addEventListener("click", () => {
  const guess = drawGuessInput.value.trim();
  if (!guess) {
    log("Enter a guess");
    return;
  }
  sendAction({ type: "submit_guess", text: guess });
});

drawGuessInput.addEventListener("input", () => {
  updateDrawGuessButtons();
});

if (drawGuessRestartBtn) {
  drawGuessRestartBtn.addEventListener("click", () => {
    emitRoomStart();
  });
}

setupDrawGuessCanvas();
