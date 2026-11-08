// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const impressionFlowerHelpButton = document.getElementById("impressionFlowerHelpBtn");
const impressionFlowerExplainButton = document.getElementById("impressionFlowerExplainBtn");

const IMPRESSION_FLOWER_HELP_CONFIG = {
  gameId: "impression_flower",
  title: { zh: "印象花语 · Impression Flower", en: "Impression Flower" },
  basic: {
    win: {
      zh: "当每位玩家都当过一次猜题者(Guesser)之后游戏结束，此时分数最高的人赢得整局。",
      en: "The game ends once every player has been the guesser, and whoever holds the highest score at that point wins."
    },
    turn: {
      zh: "轮到你时，你要么作为出题者(Setter)用有限的印章把自己的词画出来，要么作为猜题者(Guesser)把词库里的词条配到对应的画上。",
      en: "On your turn you either act as a setter and stamp a picture of the word you were given, or act as the guesser and pair the words from the bank with the drawings."
    },
    key: {
      zh: "你手里只有几枚印章(Stamp)，画得太直白会被人一眼看穿，画得太抽象又会让猜题者(Guesser)配错，所以分寸全在落笔的位置和角度上。",
      en: "You only get a handful of stamps, so a picture that is too literal gives itself away while one that is too abstract gets mismatched, and the whole game lives in where and how you place them."
    }
  },
  sections: [
    {
      id: "roles",
      label: { zh: "角色与轮次", en: "Roles and rounds" },
      html: {
        zh: "<p>每一轮有一个人当猜题者(Guesser)，其余的人都是出题者(Setter)。猜题者这一轮不画画，只等着看别人的作品。</p>"
          + "<p>系统会给每位出题者发一个只有他自己知道的词，同时额外抽两个干扰词，它们会和出题者的词一起进入词库。</p>"
          + "<p>同一位猜题者要连闯数关，每闯完一关印章数量就会减少，全部闯完之后猜题者的位置传给下一位玩家。</p>"
          + "<p>轮完所有玩家游戏就结束，中途也可以在结算画面直接结束整局。</p>",
        en: "<p>Each round has one guesser and everyone else is a setter. The guesser does not draw this round and simply waits to see the finished pictures.</p>"
          + "<p>The system hands every setter a word that only they can see, then draws two extra decoy words that join the setters' words in the word bank.</p>"
          + "<p>One guesser plays several rounds in a row, the stamp allowance shrinks after each of them, and the guesser role then passes to the next player.</p>"
          + "<p>Once everyone has been the guesser the game is over, and you can also end it early from the round summary.</p>"
      }
    },
    {
      id: "stamps",
      label: { zh: "印章作画", en: "Stamping" },
      html: {
        zh: "<p>在画布上按住不放会先出现一个预览印章(Stamp)，按住的时间越长它越不透明，最长半秒就能达到最浓的效果，松手才真正盖下去。</p>"
          + "<p>每盖一个印章，你的 Stamps Left 就少一个，所以每一枚都要花在最能暗示那个词的地方。</p>"
          + "<p>形状和颜色是绑定的，默认圆形(Circle)是红色(🔴)，三角(Triangle)是绿色(🟢)，方形(Square)是蓝色(🔵)，长条(Bar)是黄色(🟡)。</p>"
          + "<p>刚盖下的印章处于选中状态，用左旋(◀)和右旋(▶)可以按住持续旋转它，也可以直接把它拖到别的位置。</p>"
          + "<p>按 Undo 会撤掉最后一枚印章并把它还给你，让你在按下 Submit Drawing 之前还有反悔的机会。</p>",
        en: "<p>Press and hold on the canvas to see a preview stamp. The longer you hold the more opaque it becomes, reaching full strength after half a second, and it is only placed when you let go.</p>"
          + "<p>Every stamp placed costs one from your Stamps Left, so spend each of them where it hints at your word best.</p>"
          + "<p>Shapes and colours are tied together. By default Circle is red (🔴), Triangle is green (🟢), Square is blue (🔵), and Bar is yellow (🟡).</p>"
          + "<p>The stamp you just placed stays selected, so you can hold the rotate left (◀) or rotate right (▶) button to spin it, or drag it somewhere else.</p>"
          + "<p>Undo removes the last stamp and gives it back to you, which leaves room to change your mind before pressing Submit Drawing.</p>"
      }
    },
    {
      id: "mask",
      label: { zh: "废纸遮罩", en: "The mask" },
      html: {
        zh: "<p>按下 Mask 会取出一张废纸遮罩，它是一块可以拖动的方框，代表你希望从印章上挖掉的部分。</p>"
          + "<p>遮罩打开时盖下的印章会被它挖空一块，因此同一个印章既能留下完整形状，也能只留下边缘的一圈痕迹。</p>"
          + "<p>Mask Rotation 决定挖空的角度，Mask Scale 决定挖空的大小，两者都只影响接下来盖下的印章。</p>"
          + "<p>如果此时正好有一枚还没被遮罩处理过的印章处于选中状态，遮罩会直接作用在它身上。</p>",
        en: "<p>Pressing Mask pulls out a waste paper mask, a draggable square that marks the part you want cut away from your stamps.</p>"
          + "<p>Any stamp placed while the mask is open gets a piece removed by it, so one shape can be left whole or reduced to a thin rim.</p>"
          + "<p>Mask Rotation sets the angle of the cut and Mask Scale sets its size, and both only affect the stamps you place next.</p>"
          + "<p>If a stamp that has not been masked yet is selected at that moment, the mask is applied to that stamp right away.</p>"
      }
    },
    {
      id: "matching",
      label: { zh: "配对与计分", en: "Matching and scoring" },
      html: {
        zh: "<p>所有出题者交稿之后进入配对阶段，猜题者(Guesser)会看到全部的画和一个词库，词库里既有真词也有干扰词。</p>"
          + "<p>配对时可以先点一个词再点画上的虚线框，也可以直接把词拖进框里，每张画都必须配一个词，而且同一个词不能用两次。</p>"
          + "<p>配错或者想换词时，点一下画上已经放好的词就能把它退回词库。</p>"
          + "<p>每一对配对成功，猜题者和那幅画的作者都会得到同样的分数，默认等于当前是第几关。</p>"
          + "<p>配对阶段的作者是公开的，所以猜题者既要看画，也要琢磨是谁画的。</p>",
        en: "<p>Once every setter has submitted, the guess phase begins and the guesser sees all the drawings together with a word bank that mixes real words and decoys.</p>"
          + "<p>To match, either click a word and then the dashed box on a drawing, or drag the word straight into the box. Every drawing needs a word and no word may be used twice.</p>"
          + "<p>If you change your mind, click the word already sitting on a drawing to send it back to the bank.</p>"
          + "<p>Each correct pair scores the same number of points for the guesser and for the author of that drawing, equal to the current round number by default.</p>"
          + "<p>Authors are not hidden during matching, so the guesser reads both the picture and who drew it.</p>"
      }
    },
    {
      id: "review",
      label: { zh: "回顾与评价", en: "Review and votes" },
      html: {
        zh: "<p>结算之后所有人都能在 Review 里看到每一幅画，它的真实词是什么，以及猜题者(Guesser)给它配了哪个词。</p>"
          + "<p>配对正确的画会显示绿色边框，配错的显示红色边框。</p>"
          + "<p>如果房间开启了评价功能，你可以给别人的画按 Up 或 Down，每一张赞或者踩都会直接改变作者的分数，你不能评价自己的画。</p>"
          + "<p>所有人都按下 Continue 之后才会进入下一关，想就此收工则按 End Game。</p>",
        en: "<p>After scoring, everyone can look through Review to see each drawing, the word it really stood for, and the word the guesser gave it.</p>"
          + "<p>A correct match is framed in green and a wrong one in red.</p>"
          + "<p>When the room enables review votes you may press Up or Down on somebody else's drawing, and each vote changes that author's score directly. You cannot vote on your own drawing.</p>"
          + "<p>The next round only starts once everyone has pressed Continue, and End Game closes the whole game instead.</p>"
      }
    }
  ]
};

const IMPRESSION_FLOWER_EXPLAIN = {
  phase: { zh: "当前阶段。draw 是出题者作画，guess 是猜题者配对，round_end 是本轮结算。", en: "Current phase. draw is the setters painting, guess is the guesser matching, round_end is the round summary." },
  round: { zh: "当前是这位猜题者(Guesser)的第几关，以及他一共要闯几关。", en: "Which round of the current guesser's run is being played, and how many rounds that run lasts." },
  guesser: { zh: "本轮的猜题者(Guesser)，他不作画，只负责把词配到画上。", en: "This round's guesser, who does not draw and only pairs words with the pictures." },
  role: { zh: "你本轮的角色。Guesser 是猜题者，Setter 是出题者。", en: "Your role this round. Guesser means you match words, Setter means you draw." },
  stamps_left: { zh: "你本轮还剩几枚印章(Stamp)，每盖一枚就少一枚。", en: "How many stamps you may still place this round. Each stamp placed costs one." },
  score: { zh: "你当前的分数。", en: "Your current score." },
  prompt: { zh: "系统分配给你的词，只有你知道，你要用印章(Stamp)把它画出来。", en: "The word the system gave you. Only you can see it, and you have to draw it with stamps." },
  canvas: { zh: "画布。按住不放会出现预览印章(Stamp)，按得越久印章越不透明，松手才真正盖下去。", en: "The canvas. Press and hold to preview a stamp, hold longer for a more opaque stamp, and release to place it." },
  mask_overlay: { zh: "废纸遮罩，拖动它可以决定下一个印章(Stamp)被挖掉哪一块。", en: "The waste paper mask. Drag it to choose which part of the next stamp gets cut away." },
  rotate_left: { zh: "左旋(◀)，按住可以持续逆时针旋转选中的印章(Stamp)。", en: "Rotate left (◀). Hold it to keep turning the selected stamp counterclockwise." },
  rotate_right: { zh: "右旋(▶)，按住可以持续顺时针旋转选中的印章(Stamp)。", en: "Rotate right (▶). Hold it to keep turning the selected stamp clockwise." },
  shape: { zh: "选择印章(Stamp)的形状，每个形状都固定绑定一种颜色。", en: "Pick the shape of your stamp. Every shape is tied to one fixed colour." },
  color_hint: { zh: "颜色跟着形状走，所以选定形状的同时颜色也就定下来了。", en: "Colours follow shapes, so choosing a shape also chooses its colour." },
  undo: { zh: "撤掉最后盖下的印章(Stamp)，并把这枚印章还给你。", en: "Remove the last stamp you placed and get that stamp back." },
  mask_toggle: { zh: "打开或关闭废纸遮罩，遮罩打开时盖下的印章会被挖掉一块。", en: "Open or close the waste paper mask. Stamps placed while it is open lose a piece of themselves." },
  submit_drawing: { zh: "提交你的画，等所有人都交完之后进入配对阶段。", en: "Submit your picture. The matching phase starts once everyone has submitted." },
  mask_rotation: { zh: "旋转废纸遮罩，决定挖空部分的角度。", en: "Rotate the waste paper mask to set the angle of the cut." },
  mask_scale: { zh: "缩放废纸遮罩，决定挖空部分的大小。", en: "Scale the waste paper mask to set the size of the cut." },
  word_bank: { zh: "词库，里面既有每位出题者(Setter)的真词，也有两个干扰词。", en: "The word bank, holding every setter's real word plus two decoys." },
  word_chip: { zh: "一个候选词。点一下选中它再点画上的虚线框，或者直接把它拖进框里。", en: "One candidate word. Click it and then the dashed box on a drawing, or drag it straight into the box." },
  drawings: { zh: "本轮所有出题者(Setter)交上来的画，猜题者(Guesser)要把词配上去。", en: "All the pictures the setters handed in this round. The guesser has to match words to them." },
  drawing: { zh: "一张画。猜题阶段不隐藏作者，所以你能看到它是谁画的。", en: "One picture. Authors are not hidden during matching, so you can see who drew it." },
  drawing_author: { zh: "这幅画的作者，猜题阶段作者是公开的。", en: "The author of this picture, which stays public during the matching phase." },
  dropzone: { zh: "配对框。先在词库里选好一个词再点这里，或者直接把词拖进来。", en: "The matching box. Select a word in the bank and click here, or drag a word straight in." },
  assigned_word: { zh: "你已经配上去的词，点一下就能把它退回词库重新分配。", en: "The word you already assigned. Click it to send it back to the bank." },
  submit_matches: { zh: "提交全部配对，每一张画都配好词之后才能按下。", en: "Submit every pairing. It only unlocks once each drawing has a word." },
  round_notice: { zh: "本轮结算区，所有人确认之后才会开始下一关。", en: "The round summary. The next round only starts after everyone confirms." },
  round_result: { zh: "本轮配对的结果，包括猜对的数量和每个人得到的分数。", en: "This round's outcome, with the number of correct pairs and the points each player earned." },
  continue_game: { zh: "继续下一关，所有人都按下之后才会真正开始。", en: "Move on to the next round, which starts once everyone has pressed it." },
  end_game: { zh: "立刻结束整局游戏，当前分数就是最终成绩。", en: "End the whole game right away and keep the current scores as the final result." },
  review: { zh: "回顾区，可以逐张查看本轮每幅画的真实词和被配上的词。", en: "The review area, where you can check the real word and the guessed word of every picture." },
  review_card: { zh: "一幅画的回顾，绿色边框表示配对正确，红色边框表示配错。", en: "One picture under review. A green frame means the match was right and a red frame means it was wrong." },
  review_words: { zh: "这幅画的真实词和猜题者(Guesser)给它配上的词。", en: "The real word of this picture and the word the guesser gave it." },
  review_up: { zh: "Up 按钮，给这幅画点赞，作者会因此加 1 分。", en: "The Up button. It praises the picture and adds 1 point to its author." },
  review_down: { zh: "Down 按钮，给这幅画点踩，作者会因此减 1 分。", en: "The Down button. It criticises the picture and costs its author 1 point." },
  review_counts: { zh: "这幅画收到的赞和踩的数量，以及它们合计带来的分数变化。", en: "How many up and down votes this picture received and the score change they add up to." },
  players: { zh: "所有玩家的分数和状态，当前的猜题者(Guesser)会被标出来。", en: "All players with their scores and status. The current guesser is marked." }
};

let impressionFlowerHelpWidget = null;
let impressionFlowerExplainWidget = null;

function initImpressionFlowerHelpExplain() {
  if (impressionFlowerHelpWidget || typeof window.obgCreateHelp !== "function") return;
  impressionFlowerHelpWidget = window.obgCreateHelp(IMPRESSION_FLOWER_HELP_CONFIG);
  impressionFlowerExplainWidget = window.obgCreateExplain({
    gameId: "impression_flower",
    attribute: "data-impression-flower-explain",
    explanations: IMPRESSION_FLOWER_EXPLAIN,
    button: impressionFlowerExplainButton,
    root: () => document.getElementById("impressionFlowerPanel"),
    bypass: ["#impressionFlowerHelpBtn", "#impressionFlowerExplainBtn"]
  });
  impressionFlowerHelpButton?.addEventListener("click", () => {
    impressionFlowerExplainWidget?.exit();
    impressionFlowerHelpWidget.open();
  });
  impressionFlowerExplainButton?.addEventListener("click", () => impressionFlowerExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initImpressionFlowerHelpExplain);
} else {
  initImpressionFlowerHelpExplain();
}

const impressionConfigBox = document.getElementById("impressionConfigBox");
const impressionVoteRow = document.getElementById("impressionVoteRow");
const impressionVoteToggle = document.getElementById("impressionVoteToggle");

const impressionFlowerPanel = document.getElementById("impressionFlowerPanel");
const impressionPhaseLabel = document.getElementById("impressionPhase");
const impressionRoundLabel = document.getElementById("impressionRound");
const impressionRoundsPerGuesserLabel = document.getElementById("impressionRoundsPerGuesser");
const impressionGuesserLabel = document.getElementById("impressionGuesser");
const impressionRoleLabel = document.getElementById("impressionRole");
const impressionStampsLeftLabel = document.getElementById("impressionStampsLeft");
const impressionScoreLabel = document.getElementById("impressionScore");
const impressionPromptRow = document.getElementById("impressionPromptRow");
const impressionPromptLabel = document.getElementById("impressionPrompt");
const impressionDrawArea = document.getElementById("impressionDrawArea");
const impressionGuessArea = document.getElementById("impressionGuessArea");
const impressionRoundEnd = document.getElementById("impressionRoundEnd");
const impressionRoundResult = document.getElementById("impressionRoundResult");
const impressionReview = document.getElementById("impressionReview");
const impressionReviewList = document.getElementById("impressionReviewList");
const impressionPlayers = document.getElementById("impressionPlayers");
const impressionCanvas = document.getElementById("impressionCanvas");
const impressionCtx = impressionCanvas ? impressionCanvas.getContext("2d") : null;
const impressionShapeButtons = document.getElementById("impressionShapeButtons");
const impressionRotationInput = document.getElementById("impressionRotation");
const impressionRotateControls = document.getElementById("impressionRotateControls");
const impressionRotateLeftBtn = document.getElementById("impressionRotateLeftBtn");
const impressionRotateRightBtn = document.getElementById("impressionRotateRightBtn");
const impressionUndoBtn = document.getElementById("impressionUndoBtn");
const impressionMaskBtn = document.getElementById("impressionMaskBtn");
const impressionMask = document.getElementById("impressionMask");
const impressionMaskControls = document.getElementById("impressionMaskControls");
const impressionMaskRotationInput = document.getElementById("impressionMaskRotation");
const impressionMaskScaleInput = document.getElementById("impressionMaskScale");
const impressionSubmitDrawBtn = document.getElementById("impressionSubmitDrawBtn");
const impressionWordBank = document.getElementById("impressionWordBank");
const impressionDrawings = document.getElementById("impressionDrawings");
const impressionSubmitMatchesBtn = document.getElementById("impressionSubmitMatchesBtn");
const impressionContinueBtn = document.getElementById("impressionContinueBtn");
const impressionEndBtn = document.getElementById("impressionEndBtn");

let currentImpressionView = null;

let impressionConfig = null;
let impressionConfigSignature = null;
let impressionStampHistory = [];
let impressionStampsLeft = 0;
let impressionStampsMax = 0;
let impressionShapeColorMap = {};
let impressionCurrentShape = null;
let impressionCurrentColor = null;
let impressionRotation = 0;
let impressionPressStart = null;
let impressionPreviewPosition = null;
let impressionPreviewStamp = null;
let impressionPreviewRaf = null;
let impressionActiveStampIndex = null;
let impressionDraggingStamp = null;
let impressionMaskTarget = null;
let impressionMaskActive = false;
let impressionMaskState = null;
let impressionMaskDrag = null;
let impressionRotateHold = null;
let impressionSelectedWord = null;
let impressionMatches = {};
let impressionLastRound = null;
let impressionLastPhase = null;
let impressionShapeButtonEls = [];
const IMPRESSION_SELECTION_PADDING = 6;
const IMPRESSION_ROTATE_BUTTON_OFFSET = 8;
const IMPRESSION_ROTATE_STEP_DEG = 5;
const IMPRESSION_ROTATE_HOLD_SPEED = 120;

const impressionActionButtons = {
  submit_drawing: impressionSubmitDrawBtn,
  submit_matches: impressionSubmitMatchesBtn,
  continue_game: impressionContinueBtn,
  end_game: impressionEndBtn,
};

function updateImpressionConfigRow() {
  const showRow = currentRoomState && currentGameType === "impression_flower" && currentRoomState.status === "lobby";
  if (impressionConfigBox) {
    impressionConfigBox.classList.toggle("hidden", !showRow);
    impressionConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (impressionVoteRow) {
    impressionVoteRow.classList.toggle("hidden", !showRow);
    impressionVoteRow.setAttribute("aria-hidden", (!showRow).toString());
  }
}

function clearImpressionFlowerState() {
  currentImpressionView = null;
  impressionConfig = null;
  impressionConfigSignature = null;
  impressionStampHistory = [];
  impressionStampsLeft = 0;
  impressionStampsMax = 0;
  impressionShapeColorMap = {};
  impressionCurrentShape = null;
  impressionCurrentColor = null;
  impressionRotation = 0;
  impressionPressStart = null;
  impressionActiveStampIndex = null;
  impressionDraggingStamp = null;
  impressionMaskTarget = null;
  impressionMaskActive = false;
  impressionMaskState = null;
  impressionMaskDrag = null;
  impressionSelectedWord = null;
  impressionMatches = {};
  impressionLastRound = null;
  impressionLastPhase = null;
  impressionShapeButtonEls = [];
  if (impressionPhaseLabel) {
    impressionPhaseLabel.textContent = "-";
  }
  if (impressionRoundLabel) {
    impressionRoundLabel.textContent = "-";
  }
  if (impressionRoundsPerGuesserLabel) {
    impressionRoundsPerGuesserLabel.textContent = "-";
  }
  if (impressionGuesserLabel) {
    impressionGuesserLabel.textContent = "-";
  }
  if (impressionRoleLabel) {
    impressionRoleLabel.textContent = "-";
  }
  if (impressionStampsLeftLabel) {
    impressionStampsLeftLabel.textContent = "-";
  }
  if (impressionScoreLabel) {
    impressionScoreLabel.textContent = "-";
  }
  if (impressionPromptLabel) {
    impressionPromptLabel.textContent = "-";
  }
  if (impressionRoundResult) {
    impressionRoundResult.textContent = "-";
  }
  if (impressionPromptRow) {
    impressionPromptRow.classList.add("hidden");
  }
  if (impressionDrawArea) {
    impressionDrawArea.classList.add("hidden");
  }
  if (impressionGuessArea) {
    impressionGuessArea.classList.add("hidden");
  }
  if (impressionRoundEnd) {
    impressionRoundEnd.classList.add("hidden");
  }
  if (impressionWordBank) {
    impressionWordBank.innerHTML = "";
  }
  if (impressionDrawings) {
    impressionDrawings.innerHTML = "";
  }
  if (impressionReview) {
    impressionReview.classList.add("hidden");
  }
  if (impressionReviewList) {
    impressionReviewList.innerHTML = "";
  }
  if (impressionPlayers) {
    impressionPlayers.innerHTML = "";
  }
  if (impressionMask) {
    impressionMask.classList.add("hidden");
  }
  if (impressionMaskControls) {
    impressionMaskControls.classList.add("hidden");
  }
  stopImpressionRotateHold();
  stopImpressionPreviewLoop();
  clearImpressionCanvas();
  updateImpressionRotateControls();
  updateImpressionButtons();
}

function impressionConfigKey(config) {
  if (!config) {
    return "";
  }
  return JSON.stringify(config);
}

function applyImpressionConfig(config) {
  if (!config || !impressionCanvas || !impressionCtx) {
    return;
  }
  const key = impressionConfigKey(config);
  if (key && key === impressionConfigSignature) {
    return;
  }
  impressionConfigSignature = key;
  impressionConfig = config;
  const canvasSize = Number.parseInt(config.canvas_size, 10) || 600;
  impressionCanvas.width = canvasSize;
  impressionCanvas.height = canvasSize;
  impressionRotation = 0;
  if (impressionRotationInput) {
    impressionRotationInput.value = "0";
  }

  const shapes = Array.isArray(config.stamp_shapes) && config.stamp_shapes.length
    ? config.stamp_shapes
    : ["circle", "triangle", "square", "bar"];
  const colors = Array.isArray(config.stamp_colors) && config.stamp_colors.length
    ? config.stamp_colors
    : ["#ef4444", "#22c55e", "#3b82f6", "#eab308"];
  impressionShapeColorMap = {};
  shapes.forEach((shape, index) => {
    impressionShapeColorMap[shape] = colors[index] || colors[0] || "#111827";
  });

  if (impressionShapeButtons) {
    impressionShapeButtons.innerHTML = "";
    impressionShapeButtonEls = [];
    shapes.forEach((shape) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "impression-shape-btn";
      button.dataset.shape = shape;
      button.dataset.impressionFlowerExplain = "shape";
      const swatch = document.createElement("span");
      swatch.className = "impression-shape-swatch";
      swatch.style.background = impressionShapeColorMap[shape] || "#111827";
      const label = shape === "circle"
        ? "Circle"
        : shape === "square"
          ? "Square"
          : shape === "triangle"
            ? "Triangle"
            : "Bar";
      button.appendChild(swatch);
      button.appendChild(document.createTextNode(label));
      button.addEventListener("click", () => setImpressionShape(shape));
      impressionShapeButtons.appendChild(button);
      impressionShapeButtonEls.push(button);
    });
  }

  if (!impressionCurrentShape || !shapes.includes(impressionCurrentShape)) {
    impressionCurrentShape = shapes[0];
  }
  impressionCurrentColor = impressionShapeColorMap[impressionCurrentShape] || colors[0] || "#111827";

  impressionStampHistory = [];
  impressionStampsLeft = 0;
  impressionStampsMax = 0;
  impressionActiveStampIndex = null;
  impressionMaskTarget = null;
  clearImpressionCanvas();
  renderImpressionCanvas();
  resetImpressionMaskState();
  updateImpressionShapeButtons();
}

function updateImpressionShapeButtons() {
  impressionShapeButtonEls.forEach((button) => {
    const isActive = button.dataset.shape === impressionCurrentShape;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function getImpressionActiveStamp() {
  if (impressionActiveStampIndex === null) {
    return null;
  }
  if (impressionActiveStampIndex < 0 || impressionActiveStampIndex >= impressionStampHistory.length) {
    return null;
  }
  return impressionStampHistory[impressionActiveStampIndex] || null;
}

function normalizeImpressionDegrees(value) {
  let normalized = Number.parseFloat(value);
  if (!Number.isFinite(normalized)) {
    normalized = 0;
  }
  normalized %= 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return normalized;
}

function setImpressionRotationValue(value, applyToActive) {
  const normalized = normalizeImpressionDegrees(value);
  impressionRotation = normalized;
  if (impressionRotationInput) {
    impressionRotationInput.value = `${Math.round(normalized)}`;
  }
  if (applyToActive) {
    const stamp = getImpressionActiveStamp();
    if (stamp) {
      stamp.rotation = (normalized * Math.PI) / 180;
      renderImpressionCanvas();
    }
  } else if (impressionPressStart !== null && impressionPreviewStamp) {
    renderImpressionCanvas();
  }
}

function setImpressionActiveStampIndex(index) {
  if (index === null || index < 0 || index >= impressionStampHistory.length) {
    impressionActiveStampIndex = null;
    return;
  }
  impressionActiveStampIndex = index;
  const stamp = getImpressionActiveStamp();
  if (stamp) {
    const deg = (stamp.rotation * 180) / Math.PI;
    setImpressionRotationValue(deg, false);
  }
}

function rotateImpressionActiveStamp(deltaDeg) {
  const stamp = getImpressionActiveStamp();
  if (stamp && impressionPressStart === null && !impressionDraggingStamp) {
    const currentDeg = (stamp.rotation * 180) / Math.PI;
    setImpressionRotationValue(currentDeg + deltaDeg, true);
    return;
  }
  setImpressionRotationValue(impressionRotation + deltaDeg, false);
}

function startImpressionRotateHold(direction) {
  if (!direction || !isImpressionActionAvailable("submit_drawing")) {
    return;
  }
  stopImpressionRotateHold();
  const state = {
    direction: direction < 0 ? -1 : 1,
    lastTime: null,
    rafId: null,
  };
  impressionRotateHold = state;
  rotateImpressionActiveStamp(state.direction * IMPRESSION_ROTATE_STEP_DEG);
  const tick = (time) => {
    if (!impressionRotateHold || impressionRotateHold !== state) {
      return;
    }
    if (!isImpressionActionAvailable("submit_drawing")) {
      stopImpressionRotateHold();
      return;
    }
    if (state.lastTime !== null) {
      const deltaSeconds = (time - state.lastTime) / 1000;
      rotateImpressionActiveStamp(deltaSeconds * IMPRESSION_ROTATE_HOLD_SPEED * state.direction);
    }
    state.lastTime = time;
    state.rafId = requestAnimationFrame(tick);
  };
  state.rafId = requestAnimationFrame(tick);
}

function stopImpressionRotateHold() {
  if (!impressionRotateHold) {
    return;
  }
  if (impressionRotateHold.rafId) {
    cancelAnimationFrame(impressionRotateHold.rafId);
  }
  impressionRotateHold = null;
}

function bindImpressionRotateButton(button, direction) {
  if (!button) {
    return;
  }
  const start = (event) => {
    if (event && typeof event.button === "number" && event.button !== 0) {
      return;
    }
    if (event && event.cancelable) {
      event.preventDefault();
    }
    if (event && event.pointerId !== undefined && button.setPointerCapture) {
      button.setPointerCapture(event.pointerId);
    }
    startImpressionRotateHold(direction);
  };
  const stop = () => {
    stopImpressionRotateHold();
  };
  if (window.PointerEvent) {
    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("pointerleave", stop);
    button.addEventListener("lostpointercapture", stop);
  } else {
    button.addEventListener("mousedown", start);
    button.addEventListener("mouseup", stop);
    button.addEventListener("mouseleave", stop);
    button.addEventListener("touchstart", start, { passive: false });
    button.addEventListener("touchend", stop);
    button.addEventListener("touchcancel", stop);
  }
  button.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    rotateImpressionActiveStamp((direction < 0 ? -1 : 1) * IMPRESSION_ROTATE_STEP_DEG);
  });
}

function setImpressionShape(shape) {
  if (!shape) {
    return;
  }
  impressionCurrentShape = shape;
  impressionCurrentColor = impressionShapeColorMap[shape] || impressionCurrentColor;
  updateImpressionShapeButtons();
}

function clearImpressionCanvas() {
  if (!impressionCtx || !impressionCanvas) {
    return;
  }
  impressionCtx.save();
  impressionCtx.globalCompositeOperation = "source-over";
  impressionCtx.fillStyle = "#fff";
  impressionCtx.fillRect(0, 0, impressionCanvas.width, impressionCanvas.height);
  impressionCtx.restore();
}

function renderImpressionCanvas() {
  if (!impressionCtx || !impressionCanvas) {
    return;
  }
  clearImpressionCanvas();
  impressionStampHistory.forEach((stamp) => {
    drawImpressionStamp(stamp);
  });
  if (impressionPreviewStamp) {
    drawImpressionStamp(impressionPreviewStamp);
  }
  drawImpressionSelection(getImpressionActiveStamp());
  updateImpressionRotateControls();
}

function drawImpressionStamp(stamp) {
  if (!impressionCtx || !impressionCanvas || !stamp) {
    return;
  }
  impressionCtx.save();
  if (stamp.mask) {
    impressionCtx.beginPath();
    impressionCtx.rect(0, 0, impressionCanvas.width, impressionCanvas.height);
    impressionCtx.save();
    impressionCtx.translate(stamp.x, stamp.y);
    impressionCtx.rotate(stamp.rotation);
    impressionCtx.translate(stamp.mask.offset_x, stamp.mask.offset_y);
    impressionCtx.rotate(stamp.mask.rotation);
    impressionCtx.rect(-stamp.mask.size / 2, -stamp.mask.size / 2, stamp.mask.size, stamp.mask.size);
    impressionCtx.restore();
    impressionCtx.clip("evenodd");
  }
  impressionCtx.translate(stamp.x, stamp.y);
  impressionCtx.rotate(stamp.rotation);
  impressionCtx.globalAlpha = stamp.alpha;
  impressionCtx.fillStyle = stamp.color;
  const size = stamp.size;
  if (stamp.shape === "circle") {
    impressionCtx.beginPath();
    impressionCtx.arc(0, 0, size / 2, 0, Math.PI * 2);
    impressionCtx.fill();
  } else if (stamp.shape === "square") {
    impressionCtx.fillRect(-size / 2, -size / 2, size, size);
  } else if (stamp.shape === "triangle") {
    const height = size * 0.866;
    impressionCtx.beginPath();
    impressionCtx.moveTo(0, -height * 2 / 3);
    impressionCtx.lineTo(-size / 2, height / 3);
    impressionCtx.lineTo(size / 2, height / 3);
    impressionCtx.closePath();
    impressionCtx.fill();
  } else if (stamp.shape === "bar") {
    const barRatio = Number.parseFloat(impressionConfig && impressionConfig.bar_ratio) || 0.25;
    const height = size * barRatio;
    impressionCtx.fillRect(-size / 2, -height / 2, size, height);
  }
  impressionCtx.restore();
}

function drawImpressionSelection(stamp) {
  if (!impressionCtx || !impressionCanvas || !stamp) {
    return;
  }
  if (impressionPressStart !== null) {
    return;
  }
  const size = (stamp.size || 0) + IMPRESSION_SELECTION_PADDING * 2;
  impressionCtx.save();
  impressionCtx.translate(stamp.x, stamp.y);
  impressionCtx.rotate(stamp.rotation);
  impressionCtx.strokeStyle = "rgba(15, 23, 42, 0.6)";
  impressionCtx.lineWidth = 1;
  impressionCtx.setLineDash([4, 4]);
  impressionCtx.strokeRect(-size / 2, -size / 2, size, size);
  impressionCtx.restore();
}

function hideImpressionRotateControls() {
  stopImpressionRotateHold();
  if (!impressionRotateControls) {
    return;
  }
  impressionRotateControls.classList.add("hidden");
  impressionRotateControls.classList.remove("dragging");
}

function updateImpressionRotateControls() {
  if (!impressionRotateControls || !impressionCanvas) {
    return;
  }
  const stamp = getImpressionActiveStamp();
  if (!impressionStampHistory.length) {
    hideImpressionRotateControls();
    return;
  }
  if (!stamp || impressionPressStart !== null) {
    hideImpressionRotateControls();
    return;
  }
  if (!isImpressionActionAvailable("submit_drawing")) {
    hideImpressionRotateControls();
    return;
  }
  const rect = impressionCanvas.getBoundingClientRect();
  const scaleX = rect.width ? rect.width / impressionCanvas.width : 1;
  const scaleY = rect.height ? rect.height / impressionCanvas.height : 1;
  const half = (stamp.size || 0) / 2 + IMPRESSION_SELECTION_PADDING;
  impressionRotateControls.classList.remove("hidden");
  impressionRotateControls.classList.toggle("dragging", !!impressionDraggingStamp);
  const controlsWidth = impressionRotateControls.offsetWidth;
  const controlsHeight = impressionRotateControls.offsetHeight;
  const centerX = stamp.x * scaleX;
  const aboveY = (stamp.y - half) * scaleY - IMPRESSION_ROTATE_BUTTON_OFFSET - controlsHeight;
  const belowY = (stamp.y + half) * scaleY + IMPRESSION_ROTATE_BUTTON_OFFSET;
  let top = aboveY < 0 ? belowY : aboveY;
  if (top + controlsHeight > rect.height) {
    top = Math.max(0, rect.height - controlsHeight);
  }
  let left = centerX - controlsWidth / 2;
  left = Math.max(0, Math.min(left, rect.width - controlsWidth));
  top = Math.max(0, Math.min(top, rect.height - controlsHeight));
  impressionRotateControls.style.left = `${left}px`;
  impressionRotateControls.style.top = `${top}px`;
}

function impressionAlphaForDuration(durationMs) {
  const clamped = Math.min(Math.max(durationMs, 0), 500);
  return 0.2 + (clamped / 500) * 0.8;
}

function getImpressionPosition(event) {
  if (!impressionCanvas) {
    return null;
  }
  const rect = impressionCanvas.getBoundingClientRect();
  const point = event.touches ? event.touches[0] : event;
  const scaleX = rect.width ? impressionCanvas.width / rect.width : 1;
  const scaleY = rect.height ? impressionCanvas.height / rect.height : 1;
  return {
    x: (point.clientX - rect.left) * scaleX,
    y: (point.clientY - rect.top) * scaleY,
  };
}

function buildImpressionMask(position, stampRotation) {
  if (!position || !impressionMaskState || !impressionConfig) {
    return null;
  }
  const maskSize = (Number.parseInt(impressionConfig.mask_size, 10) || 180) * impressionMaskState.scale;
  const maskRotation = (Math.PI / 180) * impressionMaskState.rotation;
  const dx = impressionMaskState.x - position.x;
  const dy = impressionMaskState.y - position.y;
  const cos = Math.cos(-stampRotation);
  const sin = Math.sin(-stampRotation);
  return {
    offset_x: dx * cos - dy * sin,
    offset_y: dx * sin + dy * cos,
    size: maskSize,
    rotation: maskRotation - stampRotation,
  };
}

function buildImpressionStamp(position, alpha, useMask) {
  if (!position || !impressionConfig || !impressionCurrentShape) {
    return null;
  }
  const color = impressionShapeColorMap[impressionCurrentShape] || impressionCurrentColor;
  if (!color) {
    return null;
  }
  const size = Number.parseInt(impressionConfig && impressionConfig.stamp_size, 10) || 64;
  const rotation = (Math.PI / 180) * (Number.parseFloat(impressionRotation) || 0);
  const shouldMask = useMask === undefined ? impressionMaskActive : useMask;
  let mask = null;
  if (shouldMask) {
    mask = buildImpressionMask(position, rotation);
  }
  return {
    shape: impressionCurrentShape,
    color,
    alpha,
    x: position.x,
    y: position.y,
    size,
    rotation,
    mask,
  };
}

function isImpressionPointOnStamp(position, stamp) {
  if (!position || !stamp) {
    return false;
  }
  const half = (stamp.size || 0) / 2;
  const dx = position.x - stamp.x;
  const dy = position.y - stamp.y;
  return Math.abs(dx) <= half && Math.abs(dy) <= half;
}

function findImpressionStampIndex(position) {
  if (!position) {
    return null;
  }
  const lastIndex = impressionStampHistory.length - 1;
  if (lastIndex < 0) {
    return null;
  }
  if (isImpressionPointOnStamp(position, impressionStampHistory[lastIndex])) {
    return lastIndex;
  }
  return null;
}

function startImpressionDrag(event) {
  if (!impressionCanvas || !impressionCtx) {
    return false;
  }
  if (impressionPressStart !== null) {
    return false;
  }
  const position = getImpressionPosition(event);
  if (!position) {
    return false;
  }
  const stampIndex = findImpressionStampIndex(position);
  if (stampIndex === null) {
    return false;
  }
  const stamp = impressionStampHistory[stampIndex];
  if (!stamp) {
    return false;
  }
  if (event.cancelable) {
    event.preventDefault();
  }
  stopImpressionPreviewLoop();
  setImpressionActiveStampIndex(stampIndex);
  impressionDraggingStamp = {
    index: stampIndex,
    offsetX: position.x - stamp.x,
    offsetY: position.y - stamp.y,
  };
  renderImpressionCanvas();
  return true;
}

function updateImpressionDrag(event) {
  if (!impressionDraggingStamp || !impressionCanvas) {
    return;
  }
  const stamp = impressionStampHistory[impressionDraggingStamp.index];
  if (!stamp) {
    return;
  }
  const position = getImpressionPosition(event);
  if (!position) {
    return;
  }
  if (event.cancelable) {
    event.preventDefault();
  }
  const half = (stamp.size || 0) / 2;
  const nextX = position.x - impressionDraggingStamp.offsetX;
  const nextY = position.y - impressionDraggingStamp.offsetY;
  stamp.x = Math.max(half, Math.min(impressionCanvas.width - half, nextX));
  stamp.y = Math.max(half, Math.min(impressionCanvas.height - half, nextY));
  renderImpressionCanvas();
}

function endImpressionDrag() {
  impressionDraggingStamp = null;
  renderImpressionCanvas();
}

function startImpressionPreviewLoop() {
  if (impressionPreviewRaf) {
    return;
  }
  const tick = () => {
    if (impressionPressStart === null || !impressionPreviewPosition) {
      impressionPreviewRaf = null;
      return;
    }
    const alpha = impressionAlphaForDuration(Date.now() - impressionPressStart);
    impressionPreviewStamp = buildImpressionStamp(
      impressionPreviewPosition,
      alpha,
      impressionMaskActive && impressionMaskTarget !== "active"
    );
    renderImpressionCanvas();
    impressionPreviewRaf = requestAnimationFrame(tick);
  };
  impressionPreviewRaf = requestAnimationFrame(tick);
}

function stopImpressionPreviewLoop() {
  if (impressionPreviewRaf) {
    cancelAnimationFrame(impressionPreviewRaf);
    impressionPreviewRaf = null;
  }
  impressionPreviewStamp = null;
  impressionPreviewPosition = null;
}

function startImpressionPress(event) {
  if (!impressionCanvas || !impressionCtx) {
    return;
  }
  if (!isImpressionActionAvailable("submit_drawing")) {
    return;
  }
  if (impressionStampsLeft <= 0) {
    return;
  }
  if (impressionMaskActive && impressionMaskTarget === "active") {
    impressionMaskTarget = "next";
  }
  if (event.cancelable) {
    event.preventDefault();
  }
  const position = getImpressionPosition(event);
  if (!position) {
    return;
  }
  impressionPressStart = Date.now();
  impressionPreviewPosition = position;
  const preview = buildImpressionStamp(
    position,
    impressionAlphaForDuration(0),
    impressionMaskActive && impressionMaskTarget !== "active"
  );
  if (!preview) {
    impressionPressStart = null;
    impressionPreviewPosition = null;
    return;
  }
  impressionPreviewStamp = preview;
  renderImpressionCanvas();
  startImpressionPreviewLoop();
}

function updateImpressionPreviewPosition(event) {
  if (impressionPressStart === null) {
    return;
  }
  const position = getImpressionPosition(event);
  if (!position) {
    return;
  }
  if (event.cancelable) {
    event.preventDefault();
  }
  impressionPreviewPosition = position;
  if (!impressionPreviewRaf) {
    startImpressionPreviewLoop();
  }
}

function handleImpressionPointerDown(event) {
  if (startImpressionDrag(event)) {
    return;
  }
  startImpressionPress(event);
}

function handleImpressionPointerMove(event) {
  if (impressionDraggingStamp) {
    updateImpressionDrag(event);
    return;
  }
  updateImpressionPreviewPosition(event);
}

function handleImpressionPointerUp(event) {
  if (impressionDraggingStamp) {
    if (event.cancelable) {
      event.preventDefault();
    }
    endImpressionDrag();
    return;
  }
  endImpressionPress(event);
}

function handleImpressionPointerCancel(event) {
  if (impressionDraggingStamp) {
    endImpressionDrag();
    return;
  }
  cancelImpressionPress(event);
}

function endImpressionPress(event) {
  if (!impressionCanvas || !impressionCtx) {
    return;
  }
  if (impressionPressStart === null) {
    return;
  }
  if (event.cancelable) {
    event.preventDefault();
  }
  if (impressionStampsLeft <= 0) {
    impressionPressStart = null;
    return;
  }
  if (!impressionCurrentShape || !impressionConfig) {
    impressionPressStart = null;
    return;
  }
  const position = impressionPreviewPosition || getImpressionPosition(event);
  if (!position) {
    impressionPressStart = null;
    return;
  }
  const duration = Date.now() - impressionPressStart;
  const alpha = impressionAlphaForDuration(duration);
  const stamp = buildImpressionStamp(position, alpha, impressionMaskActive && impressionMaskTarget !== "active");
  if (!stamp) {
    impressionPressStart = null;
    stopImpressionPreviewLoop();
    renderImpressionCanvas();
    return;
  }
  stamp.mask_used = !!stamp.mask;
  impressionStampHistory.push(stamp);
  setImpressionActiveStampIndex(impressionStampHistory.length - 1);
  impressionStampsLeft = Math.max(0, impressionStampsLeft - 1);
  if (impressionStampsLeftLabel) {
    impressionStampsLeftLabel.textContent = `${impressionStampsLeft}`;
  }
  stopImpressionPreviewLoop();
  impressionPressStart = null;
  renderImpressionCanvas();
  if (impressionMaskActive) {
    setImpressionMaskActive(false);
    impressionMaskTarget = null;
  }
  updateImpressionButtons();
}

function cancelImpressionPress(event) {
  if (event && event.cancelable) {
    event.preventDefault();
  }
  impressionPressStart = null;
  stopImpressionPreviewLoop();
  renderImpressionCanvas();
}

function resetImpressionMaskState() {
  if (!impressionCanvas) {
    return;
  }
  impressionMaskState = {
    x: impressionCanvas.width / 2,
    y: impressionCanvas.height / 2,
    rotation: 0,
    scale: 1,
  };
  if (impressionMaskRotationInput) {
    impressionMaskRotationInput.value = "0";
  }
  if (impressionMaskScaleInput) {
    impressionMaskScaleInput.value = "1";
  }
  updateImpressionMaskElement();
}

function updateImpressionMaskElement() {
  if (!impressionMask || !impressionCanvas || !impressionMaskState || !impressionConfig) {
    return;
  }
  const rect = impressionCanvas.getBoundingClientRect();
  const scaleX = rect.width ? rect.width / impressionCanvas.width : 1;
  const scaleY = rect.height ? rect.height / impressionCanvas.height : 1;
  const baseSize = Number.parseInt(impressionConfig.mask_size, 10) || 180;
  const size = baseSize * impressionMaskState.scale;
  impressionMask.style.width = `${size * scaleX}px`;
  impressionMask.style.height = `${size * scaleY}px`;
  impressionMask.style.left = `${impressionMaskState.x * scaleX}px`;
  impressionMask.style.top = `${impressionMaskState.y * scaleY}px`;
  impressionMask.style.transform = `translate(-50%, -50%) rotate(${impressionMaskState.rotation}deg)`;
}

function applyImpressionMaskToActiveStamp() {
  const stamp = getImpressionActiveStamp();
  if (!stamp || stamp.mask_used) {
    return;
  }
  const mask = buildImpressionMask({ x: stamp.x, y: stamp.y }, stamp.rotation || 0);
  if (!mask) {
    return;
  }
  stamp.mask = mask;
  stamp.mask_used = true;
  renderImpressionCanvas();
}

function setImpressionMaskActive(active) {
  impressionMaskActive = active;
  if (impressionMask) {
    impressionMask.classList.toggle("hidden", !active);
  }
  if (impressionMaskControls) {
    impressionMaskControls.classList.toggle("hidden", !active);
  }
  if (impressionMaskBtn) {
    impressionMaskBtn.classList.toggle("tool-active", active);
  }
  if (active && !impressionMaskState) {
    resetImpressionMaskState();
  }
  updateImpressionMaskElement();
}

function startImpressionMaskDrag(event) {
  if (!impressionMaskActive || !impressionMaskState || !impressionCanvas) {
    return;
  }
  event.preventDefault();
  const point = event.touches ? event.touches[0] : event;
  const rect = impressionCanvas.getBoundingClientRect();
  impressionMaskDrag = {
    startX: point.clientX,
    startY: point.clientY,
    originX: impressionMaskState.x,
    originY: impressionMaskState.y,
    rect,
  };
  document.addEventListener("mousemove", onImpressionMaskDrag);
  document.addEventListener("mouseup", endImpressionMaskDrag);
  document.addEventListener("touchmove", onImpressionMaskDrag, { passive: false });
  document.addEventListener("touchend", endImpressionMaskDrag, { passive: false });
}

function onImpressionMaskDrag(event) {
  if (!impressionMaskDrag || !impressionCanvas || !impressionMaskState) {
    return;
  }
  event.preventDefault();
  const point = event.touches ? event.touches[0] : event;
  const scaleX = impressionMaskDrag.rect.width ? impressionCanvas.width / impressionMaskDrag.rect.width : 1;
  const scaleY = impressionMaskDrag.rect.height ? impressionCanvas.height / impressionMaskDrag.rect.height : 1;
  const dx = (point.clientX - impressionMaskDrag.startX) * scaleX;
  const dy = (point.clientY - impressionMaskDrag.startY) * scaleY;
  impressionMaskState.x = Math.max(0, Math.min(impressionCanvas.width, impressionMaskDrag.originX + dx));
  impressionMaskState.y = Math.max(0, Math.min(impressionCanvas.height, impressionMaskDrag.originY + dy));
  updateImpressionMaskElement();
}

function endImpressionMaskDrag() {
  impressionMaskDrag = null;
  document.removeEventListener("mousemove", onImpressionMaskDrag);
  document.removeEventListener("mouseup", endImpressionMaskDrag);
  document.removeEventListener("touchmove", onImpressionMaskDrag);
  document.removeEventListener("touchend", endImpressionMaskDrag);
}

function impressionMatchesComplete(view) {
  const drawings = Array.isArray(view && view.drawings) ? view.drawings : [];
  if (!drawings.length) {
    return false;
  }
  return drawings.every((drawing) => impressionMatches[drawing.drawing_id]);
}

function isImpressionActionAvailable(actionType) {
  if (currentGameType !== "impression_flower" || !currentImpressionView) {
    return false;
  }
  if (!Array.isArray(currentImpressionView.legal_actions)) {
    return false;
  }
  if (!currentImpressionView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "submit_matches") {
    return impressionMatchesComplete(currentImpressionView);
  }
  return true;
}

function updateImpressionButtons() {
  if (currentGameType !== "impression_flower") {
    stopImpressionRotateHold();
    Object.values(impressionActionButtons).forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    impressionShapeButtonEls.forEach((button) => {
      button.disabled = true;
    });
    if (impressionUndoBtn) {
      impressionUndoBtn.disabled = true;
    }
    if (impressionMaskBtn) {
      impressionMaskBtn.disabled = true;
    }
    if (impressionRotationInput) {
      impressionRotationInput.disabled = true;
    }
    if (impressionRotateLeftBtn) {
      impressionRotateLeftBtn.disabled = true;
    }
    if (impressionRotateRightBtn) {
      impressionRotateRightBtn.disabled = true;
    }
    return;
  }
  Object.entries(impressionActionButtons).forEach(([actionType, button]) => {
    if (!button) {
      return;
    }
    const allowed = isImpressionActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
  const canDraw = isImpressionActionAvailable("submit_drawing");
  if (!canDraw) {
    stopImpressionRotateHold();
  }
  impressionShapeButtonEls.forEach((button) => {
    button.disabled = !canDraw;
  });
  if (impressionUndoBtn) {
    impressionUndoBtn.disabled = !canDraw || impressionStampHistory.length === 0;
  }
  if (impressionMaskBtn) {
    impressionMaskBtn.disabled = !canDraw;
  }
  if (impressionRotationInput) {
    impressionRotationInput.disabled = !canDraw;
  }
  if (impressionRotateLeftBtn) {
    impressionRotateLeftBtn.disabled = !canDraw;
  }
  if (impressionRotateRightBtn) {
    impressionRotateRightBtn.disabled = !canDraw;
  }
}

function assignImpressionWordToDrawing(view, drawingId, word) {
  if (!word || drawingId === undefined || drawingId === null) {
    return;
  }
  Object.keys(impressionMatches).forEach((key) => {
    if (impressionMatches[key] === word) {
      delete impressionMatches[key];
    }
  });
  impressionMatches[drawingId] = word;
  impressionSelectedWord = null;
  renderImpressionWordBank(view);
  renderImpressionDrawings(view);
  updateImpressionButtons();
}

function renderImpressionWordBank(view) {
  if (!impressionWordBank) {
    return;
  }
  impressionWordBank.innerHTML = "";
  const words = Array.isArray(view.word_bank) ? view.word_bank : [];
  if (!words.length) {
    impressionSelectedWord = null;
    impressionWordBank.textContent = "Waiting for guesser...";
    return;
  }
  const assignedWords = new Set(Object.values(impressionMatches));
  if (impressionSelectedWord && assignedWords.has(impressionSelectedWord)) {
    impressionSelectedWord = null;
  }
  words.forEach((word) => {
    const chip = document.createElement("div");
    chip.className = "impression-word";
    chip.dataset.impressionFlowerExplain = "word_chip";
    chip.textContent = word;
    const isAssigned = assignedWords.has(word);
    if (isAssigned) {
      chip.classList.add("assigned");
      chip.draggable = false;
    } else {
      chip.draggable = true;
      chip.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", word);
        event.dataTransfer.effectAllowed = "move";
      });
      chip.addEventListener("click", () => {
        impressionSelectedWord = impressionSelectedWord === word ? null : word;
        renderImpressionWordBank(view);
        renderImpressionDrawings(view);
      });
    }
    if (impressionSelectedWord === word) {
      chip.classList.add("selected");
    }
    impressionWordBank.appendChild(chip);
  });
}

function renderImpressionDrawings(view) {
  if (!impressionDrawings) {
    return;
  }
  impressionDrawings.innerHTML = "";
  const drawings = Array.isArray(view.drawings) ? view.drawings : [];
  if (!drawings.length) {
    impressionDrawings.textContent = "Waiting for guesser...";
    return;
  }
  drawings.forEach((drawing) => {
    const card = document.createElement("div");
    card.className = "impression-drawing";
    const author = document.createElement("div");
    author.dataset.impressionFlowerExplain = "drawing_author";
    author.textContent = drawing.author_name ? `By ${drawing.author_name}` : "By ?";
    const media = document.createElement("div");
    media.className = "impression-drawing-media";
    const image = document.createElement("img");
    image.dataset.impressionFlowerExplain = "drawing";
    image.src = drawing.image_data;
    image.alt = "drawing";
    const dropzone = document.createElement("div");
    dropzone.className = "impression-dropzone";
    const assignedWord = impressionMatches[drawing.drawing_id];
    if (assignedWord) {
      const assigned = document.createElement("span");
      assigned.className = "impression-assigned-word";
      assigned.dataset.impressionFlowerExplain = "assigned_word";
      assigned.textContent = assignedWord;
      assigned.title = "Click to clear";
      assigned.addEventListener("click", () => {
        delete impressionMatches[drawing.drawing_id];
        renderImpressionWordBank(view);
        renderImpressionDrawings(view);
        updateImpressionButtons();
      });
      dropzone.innerHTML = "";
      dropzone.appendChild(assigned);
    } else {
      dropzone.dataset.impressionFlowerExplain = "dropzone";
      dropzone.textContent = "Drop word here";
      dropzone.addEventListener("click", () => {
        if (!impressionSelectedWord) {
          return;
        }
        assignImpressionWordToDrawing(view, drawing.drawing_id, impressionSelectedWord);
      });
    }
    dropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropzone.classList.add("active");
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("active");
    });
    dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropzone.classList.remove("active");
      const word = event.dataTransfer.getData("text/plain");
      if (!word) {
        return;
      }
      assignImpressionWordToDrawing(view, drawing.drawing_id, word);
    });
    media.appendChild(dropzone);
    media.appendChild(image);
    card.appendChild(author);
    card.appendChild(media);
    impressionDrawings.appendChild(card);
  });
}

function renderImpressionPlayers(view) {
  if (!impressionPlayers) {
    return;
  }
  impressionPlayers.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  players.forEach((player) => {
    const line = document.createElement("div");
    const tags = [];
    if (player.is_guesser) tags.push("guesser");
    if (player.submitted) tags.push("submitted");
    if (player.player_id === view.you) tags.push("you");
    const score = player.score ?? 0;
    line.textContent = `${(player.seat ?? 0) + 1}. ${player.name} (${tags.join(", ") || "player"}) - ${score}`;
    impressionPlayers.appendChild(line);
  });
}

function renderImpressionRoundResult(view) {
  if (!impressionRoundResult) {
    return;
  }
  const result = view.last_result;
  if (!result) {
    impressionRoundResult.textContent = "-";
    return;
  }
  const total = result.matches ? Object.keys(result.matches).length : 0;
  const correct = Array.isArray(result.correct) ? result.correct.length : 0;
  const scoreParts = [];
  const players = Array.isArray(view.players) ? view.players : [];
  if (result.scores_delta) {
    Object.entries(result.scores_delta).forEach(([pid, delta]) => {
      const player = players.find((p) => p.player_id === pid);
      scoreParts.push(`${player ? player.name : pid} +${delta}`);
    });
  }
  const scoresText = scoreParts.length ? ` | ${scoreParts.join(", ")}` : "";
  impressionRoundResult.textContent = `Matched ${correct}/${total}${scoresText}`;
}

function sendImpressionReviewVote(drawingId, vote) {
  if (!drawingId) {
    return;
  }
  sendAction({ type: "review_vote", drawing_id: drawingId, vote });
}

function renderImpressionReview(view) {
  if (!impressionReviewList) {
    return;
  }
  impressionReviewList.innerHTML = "";
  const reviewDrawings = Array.isArray(view.review_drawings) ? view.review_drawings : [];
  if (!reviewDrawings.length) {
    impressionReviewList.textContent = "No review data.";
    return;
  }
  const votesEnabled = !!(view.config && view.config.allow_review_votes);
  reviewDrawings.forEach((drawing) => {
    const card = document.createElement("div");
    card.className = "impression-drawing impression-review-card";
    if (drawing.is_correct === true) {
      card.classList.add("correct");
    } else if (drawing.is_correct === false) {
      card.classList.add("incorrect");
    }

    const author = document.createElement("div");
    author.dataset.impressionFlowerExplain = "drawing_author";
    author.textContent = drawing.author_name ? `By ${drawing.author_name}` : "By ?";

    const image = document.createElement("img");
    image.dataset.impressionFlowerExplain = "review_card";
    image.src = drawing.image_data;
    image.alt = "drawing";

    const words = document.createElement("div");
    words.className = "impression-review-words";
    words.dataset.impressionFlowerExplain = "review_words";
    const actual = document.createElement("div");
    actual.textContent = `Actual: ${drawing.actual_word ?? "-"}`;
    const guessed = document.createElement("div");
    guessed.textContent = `Guessed: ${drawing.guessed_word ?? "-"}`;
    words.appendChild(actual);
    words.appendChild(guessed);

    card.appendChild(author);
    card.appendChild(image);
    card.appendChild(words);

    if (votesEnabled) {
      const votesRow = document.createElement("div");
      votesRow.className = "impression-review-votes";
      const yourVote = Number(drawing.your_vote) || 0;
      const upCount = Number(drawing.votes_up) || 0;
      const downCount = Number(drawing.votes_down) || 0;
      const total = Number(drawing.vote_total) || 0;

      const canVote =
        view.phase === "round_end" && !view.game_over && drawing.author_id && drawing.author_id !== view.you;

      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "impression-review-vote-btn";
      upBtn.dataset.impressionFlowerExplain = "review_up";
      upBtn.textContent = "Up";
      upBtn.disabled = !canVote;
      if (yourVote === 1) {
        upBtn.classList.add("active");
      }
      upBtn.addEventListener("click", () => {
        const nextVote = yourVote === 1 ? 0 : 1;
        sendImpressionReviewVote(drawing.drawing_id, nextVote);
      });

      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "impression-review-vote-btn";
      downBtn.dataset.impressionFlowerExplain = "review_down";
      downBtn.textContent = "Down";
      downBtn.disabled = !canVote;
      if (yourVote === -1) {
        downBtn.classList.add("active");
      }
      downBtn.addEventListener("click", () => {
        const nextVote = yourVote === -1 ? 0 : -1;
        sendImpressionReviewVote(drawing.drawing_id, nextVote);
      });

      const counts = document.createElement("span");
      counts.className = "impression-review-vote-count";
      counts.dataset.impressionFlowerExplain = "review_counts";
      const totalLabel = `${total >= 0 ? "+" : ""}${total}`;
      counts.textContent = `Up ${upCount} / Down ${downCount} (Total ${totalLabel})`;

      votesRow.appendChild(upBtn);
      votesRow.appendChild(downBtn);
      votesRow.appendChild(counts);
      card.appendChild(votesRow);
    }

    impressionReviewList.appendChild(card);
  });
}

function setupImpressionCanvas() {
  if (!impressionCanvas || !impressionCtx) {
    return;
  }
  impressionCanvas.addEventListener("mousedown", handleImpressionPointerDown);
  impressionCanvas.addEventListener("mousemove", handleImpressionPointerMove);
  impressionCanvas.addEventListener("mouseup", handleImpressionPointerUp);
  impressionCanvas.addEventListener("mouseleave", handleImpressionPointerCancel);
  impressionCanvas.addEventListener("touchstart", handleImpressionPointerDown, { passive: false });
  impressionCanvas.addEventListener("touchmove", handleImpressionPointerMove, { passive: false });
  impressionCanvas.addEventListener("touchend", handleImpressionPointerUp, { passive: false });
  impressionCanvas.addEventListener("touchcancel", handleImpressionPointerCancel, { passive: false });
  if (impressionMask) {
    impressionMask.addEventListener("mousedown", startImpressionMaskDrag);
    impressionMask.addEventListener("touchstart", startImpressionMaskDrag, { passive: false });
  }
  window.addEventListener("resize", () => {
    updateImpressionMaskElement();
    updateImpressionRotateControls();
  });
}

function renderImpressionGameState(data) {
  const view = data.view;
  currentImpressionView = view;
  if (currentGameType !== "impression_flower") {
    currentGameType = "impression_flower";
    setGamePanelVisibility("impression_flower");
  }
  hideImpressionRotateControls();

  if (view && view.config) {
    applyImpressionConfig(view.config);
  }

  if (impressionPhaseLabel) {
    impressionPhaseLabel.textContent = view.phase || "-";
  }
  if (impressionRoundLabel) {
    impressionRoundLabel.textContent = view.round ?? "-";
  }
  if (impressionRoundsPerGuesserLabel) {
    impressionRoundsPerGuesserLabel.textContent = view.rounds_per_guesser ?? "-";
  }
  if (impressionGuesserLabel) {
    impressionGuesserLabel.textContent = view.guesser_name || "-";
  }

  const isGuesser = view.guesser_id && view.you === view.guesser_id;
  if (impressionRoleLabel) {
    impressionRoleLabel.textContent = isGuesser ? "Guesser" : "Setter";
  }

  let yourScore = "-";
  if (view.scores && view.you && view.scores[view.you] !== undefined) {
    yourScore = view.scores[view.you];
  } else if (Array.isArray(view.players)) {
    const you = view.players.find((p) => p.player_id === view.you);
    if (you && you.score !== undefined) {
      yourScore = you.score;
    }
  }
  if (impressionScoreLabel) {
    impressionScoreLabel.textContent = yourScore;
  }

  if (impressionPromptRow) {
    impressionPromptRow.classList.toggle("hidden", !view.prompt_word);
  }
  if (impressionPromptLabel) {
    impressionPromptLabel.textContent = view.prompt_word || "-";
  }

  const newRound = impressionLastRound !== view.round;
  const phaseChanged = impressionLastPhase !== view.phase;

  if (view.phase === "draw") {
    if (impressionDrawArea) {
      impressionDrawArea.classList.remove("hidden");
    }
    if (impressionGuessArea) {
      impressionGuessArea.classList.add("hidden");
    }
    if (impressionRoundEnd) {
      impressionRoundEnd.classList.add("hidden");
    }
    if (impressionReview) {
      impressionReview.classList.add("hidden");
    }
    if (impressionReviewList) {
      impressionReviewList.innerHTML = "";
    }
    if (newRound || impressionLastPhase !== "draw") {
      impressionStampHistory = [];
      impressionStampsMax = Number.parseInt(view.stamps_this_round, 10) || 0;
      impressionStampsLeft = impressionStampsMax;
      clearImpressionCanvas();
      renderImpressionCanvas();
      setImpressionMaskActive(false);
      impressionMaskTarget = null;
      setImpressionActiveStampIndex(null);
    }
    if (impressionStampsLeftLabel) {
      impressionStampsLeftLabel.textContent = isGuesser ? "-" : `${impressionStampsLeft}`;
    }
    if (impressionCanvas) {
      impressionCanvas.style.pointerEvents = isImpressionActionAvailable("submit_drawing") ? "auto" : "none";
    }
  } else if (view.phase === "guess") {
    stopImpressionPreviewLoop();
    if (impressionDrawArea) {
      impressionDrawArea.classList.add("hidden");
    }
    if (impressionGuessArea) {
      impressionGuessArea.classList.remove("hidden");
    }
    if (impressionRoundEnd) {
      impressionRoundEnd.classList.add("hidden");
    }
    if (impressionReview) {
      impressionReview.classList.add("hidden");
    }
    if (impressionReviewList) {
      impressionReviewList.innerHTML = "";
    }
    if (phaseChanged) {
      impressionMatches = {};
      impressionSelectedWord = null;
    }
    renderImpressionWordBank(view);
    renderImpressionDrawings(view);
    if (impressionStampsLeftLabel) {
      impressionStampsLeftLabel.textContent = "-";
    }
  } else if (view.phase === "round_end") {
    stopImpressionPreviewLoop();
    if (impressionDrawArea) {
      impressionDrawArea.classList.add("hidden");
    }
    if (impressionGuessArea) {
      impressionGuessArea.classList.add("hidden");
    }
    if (impressionRoundEnd) {
      impressionRoundEnd.classList.remove("hidden");
    }
    if (impressionReview) {
      impressionReview.classList.remove("hidden");
    }
    renderImpressionRoundResult(view);
    renderImpressionReview(view);
    if (impressionStampsLeftLabel) {
      impressionStampsLeftLabel.textContent = "-";
    }
  } else if (view.phase === "game_over") {
    stopImpressionPreviewLoop();
    if (impressionDrawArea) {
      impressionDrawArea.classList.add("hidden");
    }
    if (impressionGuessArea) {
      impressionGuessArea.classList.add("hidden");
    }
    if (impressionRoundEnd) {
      impressionRoundEnd.classList.remove("hidden");
    }
    if (impressionReview) {
      impressionReview.classList.remove("hidden");
    }
    renderImpressionRoundResult(view);
    renderImpressionReview(view);
    if (impressionStampsLeftLabel) {
      impressionStampsLeftLabel.textContent = "-";
    }
  } else {
    stopImpressionPreviewLoop();
    if (impressionDrawArea) {
      impressionDrawArea.classList.add("hidden");
    }
    if (impressionGuessArea) {
      impressionGuessArea.classList.add("hidden");
    }
    if (impressionRoundEnd) {
      impressionRoundEnd.classList.add("hidden");
    }
    if (impressionReview) {
      impressionReview.classList.add("hidden");
    }
    if (impressionReviewList) {
      impressionReviewList.innerHTML = "";
    }
  }

  renderImpressionPlayers(view);
  logGameEvents(data);
  impressionLastRound = view.round;
  impressionLastPhase = view.phase;
  updateImpressionRotateControls();
  updateImpressionButtons();
}

if (impressionRotationInput) {
  impressionRotationInput.addEventListener("input", () => {
    const value = Number.parseFloat(impressionRotationInput.value);
    const stamp = getImpressionActiveStamp();
    const applyToActive = !!stamp && impressionPressStart === null && !impressionDraggingStamp;
    setImpressionRotationValue(value, applyToActive);
  });
}

bindImpressionRotateButton(impressionRotateLeftBtn, -1);
bindImpressionRotateButton(impressionRotateRightBtn, 1);

if (impressionMaskBtn) {
  impressionMaskBtn.addEventListener("click", () => {
    if (!isImpressionActionAvailable("submit_drawing")) {
      return;
    }
    const activeStamp = getImpressionActiveStamp();
    const canApplyToActive =
      !!activeStamp && !activeStamp.mask_used && impressionPressStart === null && !impressionDraggingStamp;
    if (impressionMaskActive) {
      if (impressionMaskTarget === "active" && canApplyToActive) {
        applyImpressionMaskToActiveStamp();
      }
      setImpressionMaskActive(false);
      impressionMaskTarget = null;
      updateImpressionButtons();
      return;
    }
    if (canApplyToActive) {
      impressionMaskTarget = "active";
    } else {
      impressionMaskTarget = "next";
    }
    setImpressionMaskActive(true);
  });
}

if (impressionMaskRotationInput) {
  impressionMaskRotationInput.addEventListener("input", () => {
    if (!impressionMaskState) {
      return;
    }
    impressionMaskState.rotation = Number.parseFloat(impressionMaskRotationInput.value) || 0;
    updateImpressionMaskElement();
  });
}

if (impressionMaskScaleInput) {
  impressionMaskScaleInput.addEventListener("input", () => {
    if (!impressionMaskState) {
      return;
    }
    const scale = Number.parseFloat(impressionMaskScaleInput.value);
    impressionMaskState.scale = Number.isFinite(scale) ? scale : 1;
    updateImpressionMaskElement();
  });
}

if (impressionUndoBtn) {
  impressionUndoBtn.addEventListener("click", () => {
    if (!impressionStampHistory.length) {
      return;
    }
    impressionStampHistory.pop();
    setImpressionActiveStampIndex(impressionStampHistory.length - 1);
    impressionStampsLeft = Math.min(impressionStampsLeft + 1, impressionStampsMax);
    if (impressionStampsLeftLabel) {
      impressionStampsLeftLabel.textContent = `${impressionStampsLeft}`;
    }
    renderImpressionCanvas();
    updateImpressionButtons();
  });
}

if (impressionSubmitDrawBtn) {
  impressionSubmitDrawBtn.addEventListener("click", () => {
    if (!impressionCanvas) {
      return;
    }
    sendAction({ type: "submit_drawing", image_data: impressionCanvas.toDataURL("image/png") });
  });
}

if (impressionSubmitMatchesBtn) {
  impressionSubmitMatchesBtn.addEventListener("click", () => {
    if (!currentImpressionView) {
      return;
    }
    const drawings = Array.isArray(currentImpressionView.drawings) ? currentImpressionView.drawings : [];
    if (!drawings.length) {
      log("No drawings to match");
      return;
    }
    if (!impressionMatchesComplete(currentImpressionView)) {
      log("Match all drawings before submitting");
      return;
    }
    const matches = drawings.map((drawing) => ({
      drawing_id: drawing.drawing_id,
      word: impressionMatches[drawing.drawing_id],
    }));
    sendAction({ type: "submit_matches", matches });
  });
}

if (impressionContinueBtn) {
  impressionContinueBtn.addEventListener("click", () => {
    sendAction({ type: "continue_game" });
  });
}

if (impressionEndBtn) {
  impressionEndBtn.addEventListener("click", () => {
    sendAction({ type: "end_game" });
  });
}

setupImpressionCanvas();
