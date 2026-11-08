// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const mismatchHelpButton = document.getElementById("mismatchHelpBtn");
const mismatchExplainButton = document.getElementById("mismatchExplainBtn");

const MISMATCH_HELP_CONFIG = {
  gameId: "perfect_mismatch",
  title: { zh: "完美错位 · Perfect Mismatch", en: "Perfect Mismatch" },
  basic: {
    win: {
      zh: "每位玩家轮流当一次队长(Leader)，一整圈轮完之后游戏结束，总分最高的那位玩家获胜。",
      en: "Every player takes one turn as the Leader, and once the circle is complete the game ends with the highest total score winning."
    },
    turn: {
      zh: "当队长时你要按顺序设置每一条滑块的数值，不当队长时你要在五个词里挑一个提交自己的猜测。",
      en: "As the Leader you set the value of every slider one after another, and as a guesser you pick one of the five words and submit your guess."
    },
    key: {
      zh: "队长要用滑块把大家引向目标词(🎯)，猜词者则要抢在别人前面猜中，因为越早猜中拿到的分数越高。",
      en: "The Leader steers everyone toward the target word(🎯) with the sliders, while the guessers race to be first, because guessing early is worth far more points."
    }
  },
  sections: [
    {
      id: "words",
      label: { zh: "任务卡与目标词", en: "The task card and the target" },
      html: {
        zh: "<p>每一轮会翻开一张任务卡，上面并排写着五个词，其中一个被秘密指定为本轮的目标词(🎯)。</p>"
          + "<p>队长知道哪一个是目标词，其他玩家只能看到这五个词本身。</p>"
          + "<p>Words 区域按顺序列出这五个词，Target 一栏在揭示之前只对队长显示。</p>",
        en: "<p>Each round reveals a task card carrying five words side by side, and one of them is secretly marked as this round's target word(🎯).</p>"
          + "<p>The Leader knows which one is the target, while every other player only sees the five words themselves.</p>"
          + "<p>The Words area lists those five words in order, and the Target field stays visible to the Leader alone until the reveal.</p>"
      }
    },
    {
      id: "sliders",
      label: { zh: "滑块怎么设", en: "Setting the sliders" },
      html: {
        zh: "<p>每一轮会有若干条滑块，每条滑块的两端各是一个属性词，例如 危险的 和 可靠的，它们构成一对相反的评价。</p>"
          + "<p>滑块的取值范围是 0 到 10，0 表示完全贴近左边的属性，10 表示完全贴近右边的属性，中间的数值表示偏向某一侧的程度。</p>"
          + "<p>队长必须按顺序一条一条地设置，每次按下 Set 提交当前这一条之后，下一条才会解锁。</p>"
          + "<p>第一条滑块提交之后猜测阶段就同时开始，猜词者不必等队长把全部滑块设完。</p>",
        en: "<p>Each round deals a number of sliders, and every slider sits between two attribute words such as dangerous and reliable that form one opposing pair.</p>"
          + "<p>A slider runs from 0 to 10, where 0 sits entirely on the left attribute, 10 sits entirely on the right one, and the values in between describe how far it leans.</p>"
          + "<p>The Leader has to set them in order, and the next slider only unlocks after the current one is submitted with Set.</p>"
          + "<p>Guessing opens as soon as the first slider is submitted, so the guessers never have to wait for the Leader to finish all of them.</p>"
      }
    },
    {
      id: "guessing",
      label: { zh: "猜测与抢答", en: "Guessing and turn order" },
      html: {
        zh: "<p>不是队长的每位玩家可以提交一次猜测，在 Words 里按下对应词条的 Guess 就视为锁定，之后不能再更改。</p>"
          + "<p>提交的先后顺序会被记录下来，Players 面板和词条上的 #序号 就是你抢答的顺位。</p>"
          + "<p>队长本人不参与猜测，他的全部工作就是让滑块的暗示恰到好处。</p>",
        en: "<p>Every player other than the Leader may submit a single guess, and pressing Guess on a word in the Words area locks it in with no way to change it afterwards.</p>"
          + "<p>The order of submission is recorded, and the #number shown on the player list and on the word card is the place you grabbed in that queue.</p>"
          + "<p>The Leader never guesses, because their whole job is making the sliders hint well enough to be read.</p>"
      }
    },
    {
      id: "scoring",
      label: { zh: "计分规则", en: "Scoring" },
      html: {
        zh: "<p>队长按下 Reveal 之后本轮结算。猜中目标词的玩家按抢答顺序拿分，第一个猜中得 3 分，第二个猜中得 2 分，之后猜中的都得 1 分。</p>"
          + "<p>队长的得分等于猜中的人数。如果一个人都没猜中，队长反而要扣 1 分。如果所有人都猜中了，队长在人数之外再加 1 分。</p>"
          + "<p>这就要求队长把暗示拿捏在中间，太隐晦会颗粒无收，太直白又会让所有人一起得分。</p>",
        en: "<p>The round is scored when the Leader presses Reveal. Players who hit the target word score by the order they guessed in, with 3 points for the first correct guess, 2 for the second and 1 for every correct guess after that.</p>"
          + "<p>The Leader scores one point for each correct guesser. If nobody guessed right the Leader loses a point instead, and if everybody guessed right the Leader gains one extra point on top of the count.</p>"
          + "<p>That is what forces the Leader to aim for the middle, since a hint too obscure scores nothing and a hint too obvious hands the same points to everyone.</p>"
      }
    },
    {
      id: "rotation",
      label: { zh: "轮换与结束", en: "Rotation and the end" },
      html: {
        zh: "<p>结算之后由队长按下 Next Round 进入下一轮，队长换成座位上的下一位玩家。</p>"
          + "<p>每位玩家都当过一次队长之后整局结束，Round Summary 会列出每个人的选择、抢答顺位和得分。</p>"
          + "<p>分出胜负之后按 Play Again 可以用同一批玩家重新开一局。</p>",
        en: "<p>After scoring, the Leader presses Next Round to move on and the role of Leader passes to the next player in seat order.</p>"
          + "<p>Once every player has been Leader exactly once the game ends, and the Round Summary lists what each player chose, their place in the guessing queue and their points.</p>"
          + "<p>When a winner has been decided, Play Again starts a fresh game with the same group of players.</p>"
      }
    }
  ]
};

const MISMATCH_EXPLAIN = {
  phase: { zh: "当前阶段。leader_set 是队长正在设滑块，guessing 是猜测开放，reveal 是等待进入下一轮，game_over 表示整局结束。", en: "Current phase: leader_set is the Leader working through the sliders, guessing means guesses are open, reveal waits for the next round, and game_over means the game has ended." },
  round: { zh: "当前是第几轮。每一轮换一位玩家当队长。", en: "Which round is being played. The role of Leader moves to a new player every round." },
  leader: { zh: "本轮的队长(Leader)。他设置全部滑块并且不参与猜测。", en: "This round's Leader, who sets every slider and never guesses." },
  target: { zh: "本轮的目标词(🎯)。只有队长看得到，揭示之后才对所有人显示。", en: "This round's target word(🎯). Only the Leader can see it until the reveal." },
  guessing: { zh: "猜测是否开放。第一条滑块提交之后就变成 open，所有人都猜完之后变回 closed。", en: "Whether guessing is open. It turns to open once the first slider is submitted and back to closed after everyone has guessed." },
  winner: { zh: "整局结束时总分最高的玩家，同分时会并列显示。", en: "The player with the highest total score when the game ends, shown together when several players tie." },
  word: { zh: "任务卡上的一个词。五个词之中只有一个是本轮的目标词，你要判断队长给的暗示指向哪一个。", en: "One word on the task card. Only one of the five is this round's target, and your job is judging which one the Leader's hints point at." },
  guess: { zh: "把猜测锁定在这个词上。每人只能猜一次，锁定之后不能更改，而且越早猜中得分越高。", en: "Lock your guess onto this word. Everyone guesses only once, the choice cannot be changed, and guessing correctly earlier is worth more points." },
  your_guess: { zh: "你已经提交的猜测，括号里的 #序号 是你的抢答顺位。", en: "The guess you already submitted, with the #number showing the place you took in the guessing queue." },
  slider_input: { zh: "拖动这条滑块来选择 0 到 10 之间的数值，0 贴近左边的属性词，10 贴近右边的属性词。", en: "Drag this slider to pick a value from 0 to 10, where 0 hugs the attribute word on the left and 10 hugs the one on the right." },
  slider_value: { zh: "这条滑块当前的数值。显示 ? 表示队长还没有设置它。", en: "The current value of this slider. A ? means the Leader has not set it yet." },
  slider_set: { zh: "提交这条滑块的数值。只有当前这一条可以提交，提交之后下一条才会解锁。", en: "Submit this slider's value. Only the active slider can be submitted, and doing so unlocks the next one." },
  slider_attrs: { zh: "这条滑块两端的一对相反属性词。队长要让这些词共同指向目标词(🎯)。", en: "The opposing pair of attribute words at the two ends of this slider. The Leader makes these pairs point together at the target word(🎯)." },
  reveal: { zh: "公布目标词并结算本轮分数。要求全部滑块都已经设置完成，并且所有人都已经提交猜测。", en: "Reveal the target word and score the round. It requires every slider to be set and every player to have guessed." },
  next_round: { zh: "进入下一轮，队长换成下一位玩家。", en: "Move to the next round with a new Leader." },
  play_again: { zh: "整局结束后用同一批玩家重新开一局。", en: "Start a fresh game with the same players once the game is over." },
  round_summary: { zh: "上一轮的结算结果，包括目标词、猜中的人数、队长的得分变化，以及每个人选了什么词。", en: "The previous round's result, with the target word, how many players guessed right, how the Leader scored, and what each player picked." },
  players: { zh: "所有玩家的总分和状态。括号里的 leader 表示本轮队长，guessed 后面的 #序号 是他的抢答顺位。", en: "Every player's total score and state. The leader tag marks this round's Leader, and the #number after guessed is that player's place in the guessing queue." }
};

let mismatchHelpWidget = null;
let mismatchExplainWidget = null;

function initMismatchHelpExplain() {
  if (mismatchHelpWidget || typeof window.obgCreateHelp !== "function") return;
  mismatchHelpWidget = window.obgCreateHelp(MISMATCH_HELP_CONFIG);
  mismatchExplainWidget = window.obgCreateExplain({
    gameId: "perfect_mismatch",
    attribute: "data-mismatch-explain",
    explanations: MISMATCH_EXPLAIN,
    button: mismatchExplainButton,
    root: () => document.getElementById("mismatchPanel"),
    bypass: ["#mismatchHelpBtn", "#mismatchExplainBtn"]
  });
  mismatchHelpButton?.addEventListener("click", () => {
    mismatchExplainWidget?.exit();
    mismatchHelpWidget.open();
  });
  mismatchExplainButton?.addEventListener("click", () => mismatchExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMismatchHelpExplain);
} else {
  initMismatchHelpExplain();
}

let currentMismatchView = null;

const mismatchPhaseLabel = document.getElementById("mismatchPhase");
const mismatchRoundLabel = document.getElementById("mismatchRound");
const mismatchLeaderLabel = document.getElementById("mismatchLeader");
const mismatchTargetLabel = document.getElementById("mismatchTarget");
const mismatchGuessingLabel = document.getElementById("mismatchGuessing");
const mismatchWinnerLabel = document.getElementById("mismatchWinner");
const mismatchWords = document.getElementById("mismatchWords");
const mismatchYourGuessLabel = document.getElementById("mismatchYourGuess");
const mismatchSliders = document.getElementById("mismatchSliders");
const mismatchRevealBtn = document.getElementById("mismatchRevealBtn");
const mismatchNextRoundBtn = document.getElementById("mismatchNextRoundBtn");
const mismatchPlayAgainBtn = document.getElementById("mismatchPlayAgainBtn");
const mismatchRoundSummary = document.getElementById("mismatchRoundSummary");
const mismatchRoundSummaryBody = document.getElementById("mismatchRoundSummaryBody");
const mismatchRoundSummaryGuesses = document.getElementById("mismatchRoundSummaryGuesses");
const mismatchPlayers = document.getElementById("mismatchPlayers");

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
    title.setAttribute("data-mismatch-explain", "word");
    title.textContent = `${index + 1}. ${word}`;
    card.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "mismatch-word-actions";
    const guessBtn = document.createElement("button");
    guessBtn.type = "button";
    guessBtn.textContent = "Guess";
    guessBtn.setAttribute("data-mismatch-explain", "guess");
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
    left.setAttribute("data-mismatch-explain", "slider_attrs");
    left.textContent = slider.left_attr || "-";

    const right = document.createElement("div");
    right.className = "mismatch-slider-label right";
    right.setAttribute("data-mismatch-explain", "slider_attrs");
    right.textContent = slider.right_attr || "-";

    const valueLabel = document.createElement("div");
    valueLabel.className = "mismatch-slider-value";
    valueLabel.setAttribute("data-mismatch-explain", "slider_value");
    const value = Number.isInteger(slider.value) ? slider.value : null;
    valueLabel.textContent = value === null ? "?" : String(value);

    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "10";
    input.step = "1";
    input.value = value === null ? "5" : String(value);
    input.className = "mismatch-slider";
    input.setAttribute("data-mismatch-explain", "slider_input");
    if (value === null) {
      input.classList.add("pending");
    }
    const isActive = isLeader && canSet && index === activeIndex;
    input.disabled = !isActive;
    if (isActive) {
      valueLabel.textContent = String(input.value);
    }
    updateMismatchSliderColor(input);
    input.addEventListener("input", () => {
      updateMismatchSliderColor(input);
      valueLabel.textContent = String(input.value);
    });

    const setBtn = document.createElement("button");
    setBtn.type = "button";
    setBtn.textContent = "Set";
    setBtn.className = "mismatch-slider-set";
    setBtn.setAttribute("data-mismatch-explain", "slider_set");
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

function clearMismatchState() {
  currentMismatchView = null;
  if (mismatchPhaseLabel) {
    mismatchPhaseLabel.textContent = "-";
  }
  if (mismatchRoundLabel) {
    mismatchRoundLabel.textContent = "-";
  }
  if (mismatchLeaderLabel) {
    mismatchLeaderLabel.textContent = "-";
  }
  if (mismatchTargetLabel) {
    mismatchTargetLabel.textContent = "-";
  }
  if (mismatchGuessingLabel) {
    mismatchGuessingLabel.textContent = "-";
  }
  if (mismatchWinnerLabel) {
    mismatchWinnerLabel.textContent = "-";
  }
  if (mismatchYourGuessLabel) {
    mismatchYourGuessLabel.textContent = "-";
  }
  if (mismatchWords) {
    mismatchWords.innerHTML = "";
  }
  if (mismatchSliders) {
    mismatchSliders.innerHTML = "";
  }
  if (mismatchPlayers) {
    mismatchPlayers.innerHTML = "";
  }
  if (mismatchRoundSummary) {
    mismatchRoundSummary.classList.add("hidden");
  }
  if (mismatchRoundSummaryBody) {
    mismatchRoundSummaryBody.textContent = "-";
  }
  if (mismatchRoundSummaryGuesses) {
    mismatchRoundSummaryGuesses.innerHTML = "";
  }
  if (mismatchRevealBtn) {
    mismatchRevealBtn.disabled = true;
    mismatchRevealBtn.classList.remove("action-allowed");
  }
  if (mismatchNextRoundBtn) {
    mismatchNextRoundBtn.disabled = true;
    mismatchNextRoundBtn.classList.remove("action-allowed");
  }
  if (mismatchPlayAgainBtn) {
    mismatchPlayAgainBtn.disabled = true;
    mismatchPlayAgainBtn.classList.remove("action-allowed");
  }
}

function renderMismatchGameState(data) {
  const view = data.view;
  currentMismatchView = view;
  if (currentGameType !== "perfect_mismatch") {
    currentGameType = "perfect_mismatch";
    setGamePanelVisibility("perfect_mismatch");
  }

  if (mismatchPhaseLabel) {
    mismatchPhaseLabel.textContent = view.phase || "-";
  }
  if (mismatchRoundLabel) {
    mismatchRoundLabel.textContent = view.round ?? "-";
  }
  if (mismatchLeaderLabel) {
    mismatchLeaderLabel.textContent = view.leader_id ? findPlayerName(view, view.leader_id) : "-";
  }
  if (mismatchGuessingLabel) {
    mismatchGuessingLabel.textContent = view.phase === "guessing" ? "open" : "closed";
  }
  if (mismatchWinnerLabel) {
    if (view.game_over && Array.isArray(view.winner) && view.winner.length) {
      const names = view.winner.map((pid) => findPlayerName(view, pid));
      mismatchWinnerLabel.textContent = names.join(", ");
    } else {
      mismatchWinnerLabel.textContent = "-";
    }
  }
  if (mismatchTargetLabel) {
    if (Number.isInteger(view.target_index) && Array.isArray(view.words) && view.words[view.target_index]) {
      mismatchTargetLabel.textContent = `${view.target_index + 1}. ${view.words[view.target_index]}`;
    } else {
      mismatchTargetLabel.textContent = "-";
    }
  }
  if (mismatchYourGuessLabel) {
    if (view.your_guess && Number.isInteger(view.your_guess.choice)) {
      const order = Number.isInteger(view.your_guess.order) ? `#${view.your_guess.order}` : "#-";
      mismatchYourGuessLabel.textContent = `${view.your_guess.choice + 1}. ${order}`;
    } else {
      mismatchYourGuessLabel.textContent = "-";
    }
  }

  renderMismatchWords(view);
  renderMismatchSliders(view);
  renderMismatchPlayers(view);
  renderMismatchSummary(view);
  updateMismatchButtons(view);
  logGameEvents(data);
}

if (mismatchRevealBtn) {
  mismatchRevealBtn.addEventListener("click", () => {
    sendAction({ type: "reveal" });
  });
}

if (mismatchNextRoundBtn) {
  mismatchNextRoundBtn.addEventListener("click", () => {
    sendAction({ type: "next_round" });
  });
}

if (mismatchPlayAgainBtn) {
  mismatchPlayAgainBtn.addEventListener("click", () => {
    sendAction({ type: "play_again" });
  });
}
