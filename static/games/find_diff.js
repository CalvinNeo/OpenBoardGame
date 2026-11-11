// 大家来找茬 / Spot the Difference — browser client (independent time trial).
// Help & Explain follow designs/task40.md via the shared widgets.
// Rules: designs/task194.md

const findDiffPanel = document.getElementById("findDiffPanel");
const findDiffHeader = document.getElementById("findDiffHeaderActions");
const findDiffHelpButton = document.getElementById("findDiffHelpBtn");
const findDiffExplainButton = document.getElementById("findDiffExplainBtn");

const FIND_DIFF_COLORS = [
  "#22d3ee", "#f97316", "#a3e635", "#f472b6",
  "#facc15", "#60a5fa", "#fb7185", "#34d399"
];

const FIND_DIFF_HELP_CONFIG = {
  gameId: "find_diff",
  title: { zh: "大家来找茬", en: "Spot the Difference" },
  basic: {
    win: {
      zh: "这是一场计时赛。一局随机抽 5 张图，每张随机抽 3 处差异，所有人跑的是同一套题，谁用最短时间找完全部 15 处谁赢。",
      en: "This is a time trial. One game draws five random pictures and three random differences on each, everybody races the exact same set, and whoever clears all fifteen differences fastest wins."
    },
    turn: {
      zh: "没有回合顺序，任何时候你都可以在自己的题板上点一下。找齐当前这张图的 3 处之后会自动换到下一张，全程不用等任何人。",
      en: "There is no turn order. Tap your own board whenever you like, and the moment you clear the three differences on the current picture it rolls straight on to the next one without waiting for anybody."
    },
    key: {
      zh: "每个人有自己的一份题板和一只自己的表，别人点中的地方不会从你这里消失，所以这里没有抢、没有运气，纯粹比谁看得快。",
      en: "Everyone has their own board and their own clock, and a spot somebody else found never disappears from yours, so there is no racing for the same click and no luck involved, only who spots things faster."
    }
  },
  sections: [
    {
      id: "play",
      label: { zh: "怎么玩", en: "How to play" },
      html: {
        zh: "<p>每张图左右并排两张照片，左边是原图(🅰️)，右边是被改过的图(🅱️)，两张构图完全一致，只有 <strong>3 处</strong>物件不一样。</p>"
          + "<p>在<strong>任意一张</strong>图上点你认为是差异的位置都可以，点 A 或点 B 效果一样。点中之后那个位置会在两边同时框出来。</p>"
          + "<p>找齐这张图的 3 处就立刻换下一张。一局一共 5 张图，也就是 15 处差异。</p>"
          + "<p>手机上两张图默认<strong>上下排列</strong>，右上角的按钮可以切换成<strong>左右并排</strong>。</p>",
        en: "<p>Each picture shows two photos: the original(🅰️) on the left and the edited one(🅱️) on the right, identical apart from <strong>three</strong> objects.</p>"
          + "<p>Tap the spot you believe differs on <strong>either</strong> picture, because A and B are equivalent. A hit frames that spot on both at once.</p>"
          + "<p>Clearing all three rolls you straight on to the next picture. A game is five pictures, so fifteen differences in total.</p>"
          + "<p>On phones the two photos are <strong>stacked</strong> by default and the button at the top right switches to <strong>side by side</strong>.</p>"
      }
    },
    {
      id: "timing",
      label: { zh: "计时与排名", en: "Clock and ranking" },
      html: {
        zh: "<p>你的计时器从开跑那一刻起就走，一直走到你找完第 5 张图的最后一处为止，中间不暂停，所以犹豫和点错都在算在你的时间里。</p>"
          + "<p>点错一次会被<strong>锁住 2 秒</strong>不能继续点，这 2 秒照常计入你的用时，所以乱扫整张图反而更慢。</p>"
          + "<p>排名只看时间：先完成的排在前面，用时越短越靠前。没跑完的人排在所有完赛者之后，按已经找到的处数从多到少排。</p>",
        en: "<p>Your clock starts the moment the race begins and runs until you find the last difference on the fifth picture. It never pauses, so hesitating and missing both count against you.</p>"
          + "<p>A miss locks you out for <strong>two seconds</strong>, and those two seconds still count towards your time, which is why spraying taps everywhere is slower rather than faster.</p>"
          + "<p>Ranking is purely by time: finishers come first, shortest time at the top. Anyone who has not finished sits behind every finisher, ordered by how many differences they found.</p>"
      }
    },
    {
      id: "deadline",
      label: { zh: "时限与结束", en: "Deadline and ending" },
      html: {
        zh: "<p>一局有<strong>总时限</strong>（默认 10 分钟）。时限之内<strong>不能跳过</strong>任何一张图，找不到就只能继续找。</p>"
          + "<p>所有人跑完，或者总时限到，这局就结束，画面会<strong>停下来</strong>公布每个人的成绩和每张图的答案。</p>"
          + "<p>所有人点了 <strong>Continue</strong> 之后才进入最终结算。结算后可以点 Play Again 重开一局，会重新随机抽 5 张图和各自的 3 处差异。</p>",
        en: "<p>A game has an <strong>overall deadline</strong>, ten minutes by default. You <strong>cannot skip</strong> a picture inside it, so if you cannot find something you simply keep looking.</p>"
          + "<p>The game ends once everybody finishes or the deadline arrives, and the table then <strong>pauses</strong> to show every result along with the answers for each picture.</p>"
          + "<p>It moves on to the final standings only after everybody presses <strong>Continue</strong>, and Play Again then deals a fresh random set of five pictures and their differences.</p>"
      }
    },
    {
      id: "tips",
      label: { zh: "找茬技巧", en: "Tips" },
      html: {
        zh: "<p>差异只会有四种形态：某个东西<strong>多了一个</strong>（复制到旁边）、<strong>颜色变了</strong>、<strong>镜像翻转</strong>了、或者<strong>变大</strong>了。知道只有这四种之后，扫描时会更快锁定。</p>"
          + "<p>颜色变化最容易发现，可以先扫一遍大面积的色块；镜像和变大比较隐蔽，通常藏在有明显朝向或明显大小的物件上。</p>"
          + "<p>因为不能跳过一整张图，卡在某一张上时与其死盯一处，不如把整张图重新扫一遍，漏掉的往往在余光区域。</p>",
        en: "<p>There are only four kinds of difference: something <strong>duplicated</strong> next to the original, something <strong>recoloured</strong>, something <strong>mirrored</strong>, and something <strong>made bigger</strong>. Knowing that shortens the search a lot.</p>"
          + "<p>Colour changes are the easiest to catch, so sweep large colour blocks first. Mirrors and size changes are sneakier and usually sit on objects with an obvious facing or an obvious size.</p>"
          + "<p>Because you cannot skip a picture, staring harder at one corner rarely helps. Sweeping the whole frame again usually works better, since what you missed tends to sit where you were not looking.</p>"
      }
    }
  ]
};

const FIND_DIFF_EXPLAIN = {
  clock: {
    zh: "你自己用掉的真实时间，从开跑算起一直走到你找完最后一处，中途不会暂停。找完后这个数字就是你的成绩。",
    en: "Your own elapsed time, running from the start until you find the final difference and never pausing. Once you finish, this number is your result."
  },
  progress: {
    zh: "你已经进行到第几张图，以及这一局一共有几张图。",
    en: "Which picture you are on, out of the total in this game."
  },
  remaining: {
    zh: "当前这张图上还剩几处差异没被你找到。归零就会自动换到下一张。",
    en: "How many differences are still unfound on the current picture. At zero you roll on to the next one."
  },
  deadline: {
    zh: "这一局剩下的总时限。时间到时还没跑完的人按已找到的处数排在所有完赛者之后。",
    en: "Time left in this game overall. Whoever has not finished by zero is ranked behind every finisher by how much they found."
  },
  scene: {
    zh: "当前这张图的主题，仅作说明，不影响玩法。",
    en: "The theme of the current picture. It is descriptive only and does not affect play."
  },
  scores: {
    zh: "所有玩家的实时进度：完成了第几张图、当前图上找到几处。别人找到的地方不会从你这里消失，所以这里只是给你看谁快谁慢。",
    en: "Live progress for every player: which picture they are on and how many differences they found there. What somebody else found never disappears from your board, so this is purely so you can see who is ahead."
  },
  picture: {
    zh: "你当前的题板。A(🅰️) 是原图，B(🅱️) 是被改过的图，两张只有 3 处不同。在任意一张上点你认为是差异的位置即可。这是你自己的一份，别人动不到。",
    en: "Your own board. A(🅰️) is the original and B(🅱️) the edited one, and they differ in exactly three places. Tap the spot you think differs on either picture. This board is yours alone and nobody else can touch it."
  },
  hint: {
    zh: "状态提示：现在能不能点、被锁住还剩几秒、或者你已经跑完在等别人。",
    en: "Status line: whether you can tap right now, how much of a lockout is left, or whether you have finished and are waiting for the others."
  },
  log: {
    zh: "本局的文字记录，按时间列出谁跑完了、谁点错了。",
    en: "A text record of the game: who finished and who missed, in order."
  }
};

let findDiffView = null;
let findDiffHelpWidget = null;
let findDiffExplainWidget = null;
let findDiffTicker = null;
let findDiffClockSkew = 0;
let findDiffLoadedLevel = null;
let findDiffLayout = null;
let findDiffLastStage = null;
let findDiffReadySent = false;

function findDiffEl(id) {
  return document.getElementById(id);
}

function findDiffServerNow() {
  return Date.now() - findDiffClockSkew;
}

function findDiffColorFor(playerId) {
  const view = findDiffView;
  if (!view) return FIND_DIFF_COLORS[0];
  const index = view.players.findIndex((p) => p.player_id === playerId);
  return FIND_DIFF_COLORS[(index < 0 ? 0 : index) % FIND_DIFF_COLORS.length];
}

function findDiffFormat(ms, tenths) {
  const total = Math.max(0, ms);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const base = minutes + ":" + String(seconds).padStart(2, "0");
  if (!tenths) return base;
  return base + "." + Math.floor((total % 1000) / 100);
}

function findDiffInitHelpExplain() {
  if (findDiffHelpWidget || typeof window.obgCreateHelp !== "function") return;
  findDiffHelpWidget = window.obgCreateHelp(FIND_DIFF_HELP_CONFIG);
  findDiffExplainWidget = window.obgCreateExplain({
    gameId: "find_diff",
    attribute: "data-find-diff-explain",
    explanations: FIND_DIFF_EXPLAIN,
    button: findDiffExplainButton,
    root: () => findDiffEl("findDiffPanel"),
    bypass: ["#findDiffHelpBtn", "#findDiffExplainBtn"]
  });
}

function findDiffEffectiveStacked() {
  if (findDiffLayout === "stack") return true;
  if (findDiffLayout === "split") return false;
  return window.innerWidth <= 760;
}

function findDiffApplyLayout() {
  const stage = findDiffEl("findDiffStage");
  const button = findDiffEl("findDiffLayoutBtn");
  if (!stage) return;
  const stacked = findDiffEffectiveStacked();
  stage.classList.toggle("is-stacked", stacked);
  stage.classList.toggle("is-split", !stacked);
  if (button) {
    // Label what the click does, not the current mode.
    button.textContent = stacked ? "⬌ Side by side" : "⬍ Stack";
    button.title = stacked ? "Switch to side-by-side pictures" : "Switch to stacked pictures";
  }
}

function findDiffTick() {
  const view = findDiffView;
  if (!view) return;
  const you = view.you;
  const clock = findDiffEl("findDiffClock");
  if (clock) {
    const elapsed = you.finished
      ? you.elapsed_ms
      : findDiffServerNow() - view.started_ms;
    clock.textContent = findDiffFormat(elapsed, true);
    const chip = clock.closest(".find-diff-chip");
    if (chip) chip.classList.toggle("is-done", !!you.finished);
  }
  const deadline = findDiffEl("findDiffDeadline");
  if (deadline) {
    const left = view.deadline_ms - findDiffServerNow();
    deadline.textContent = findDiffFormat(Math.max(0, left), false);
    const chip = deadline.closest(".find-diff-chip");
    if (chip) {
      chip.classList.toggle("is-urgent", view.stage === "racing" && left <= 60000);
    }
  }
  const hint = findDiffEl("findDiffHint");
  if (hint) {
    if (view.stage !== "racing") {
      hint.textContent = "";
      hint.classList.remove("is-locked");
    } else if (you.finished) {
      hint.textContent = "You finished. Waiting for the other players to catch up.";
      hint.classList.remove("is-locked");
    } else {
      const lock = you.cooldown_until_ms - findDiffServerNow();
      if (lock > 0) {
        hint.textContent = "Missed — locked for " + (lock / 1000).toFixed(1) + "s";
        hint.classList.add("is-locked");
      } else {
        hint.textContent = "Tap a difference on either picture. Clear all "
          + view.diffs_per_level + " to move on.";
        hint.classList.remove("is-locked");
      }
    }
  }
}

// One difference, expressed as a rectangle of the clean base replaced by a
// small lossless patch. Positioned in percent so it tracks the frame exactly
// however the picture is scaled.
function findDiffPatchNode(patch, baseSize) {
  const node = document.createElement("img");
  node.src = patch.url;
  node.alt = "";
  node.draggable = false;
  const width = baseSize[0] || 1;
  const height = baseSize[1] || 1;
  node.style.left = (patch.at[0] / width * 100) + "%";
  node.style.top = (patch.at[1] / height * 100) + "%";
  node.style.width = (patch.size[0] / width * 100) + "%";
  node.style.height = (patch.size[1] / height * 100) + "%";
  return node;
}

function findDiffRenderPatches(level) {
  const host = findDiffEl("findDiffPatchesB");
  if (!host) return;
  host.innerHTML = "";
  if (!level || !level.patches) return;
  level.patches.forEach((patch) => {
    host.appendChild(findDiffPatchNode(patch, level.base_size || [1600, 1200]));
  });
}

function findDiffAppendMark(host, entry, color, label) {
  const box = document.createElement("div");
  box.className = "find-diff-mark";
  box.style.left = (entry.box[0] * 100) + "%";
  box.style.top = (entry.box[1] * 100) + "%";
  box.style.width = ((entry.box[2] - entry.box[0]) * 100) + "%";
  box.style.height = ((entry.box[3] - entry.box[1]) * 100) + "%";
  box.style.setProperty("--fd-color", color);
  host.appendChild(box);

  const tag = document.createElement("span");
  tag.className = "find-diff-tag";
  tag.textContent = label;
  tag.style.left = (entry.box[0] * 100) + "%";
  tag.style.top = (entry.box[1] * 100) + "%";
  tag.style.setProperty("--fd-color", color);
  host.appendChild(tag);
}

// A label on a mark near the right edge would be cut off by the frame, so pull
// it back inside. Measured after layout, and again on resize.
function findDiffClampTags(host) {
  const limit = host.clientWidth;
  if (!limit) return;
  host.querySelectorAll(".find-diff-tag").forEach((tag) => {
    tag.style.transform = "translateY(-2px)";
    const left = tag.offsetLeft;
    const right = left + tag.offsetWidth;
    let shift = 0;
    if (right > limit - 2) shift = limit - 2 - right;
    if (left + shift < 2) shift = 2 - left;
    if (shift) tag.style.transform = "translate(" + Math.round(shift) + "px, -2px)";
  });
}

function findDiffRenderMarks() {
  const view = findDiffView;
  const marksA = findDiffEl("findDiffMarksA");
  const marksB = findDiffEl("findDiffMarksB");
  if (!marksA || !marksB) return;
  marksA.innerHTML = "";
  marksB.innerHTML = "";
  const color = findDiffColorFor(findDiffMyId());
  [marksA, marksB].forEach((host) => {
    view.you.found.forEach((entry, index) => {
      findDiffAppendMark(host, entry, color, "#" + (index + 1));
    });
    findDiffClampTags(host);
  });
}

function findDiffRenderScores() {
  const view = findDiffView;
  const box = findDiffEl("findDiffScores");
  if (!box) return;
  const me = findDiffMyId();
  box.innerHTML = "";
  view.players.forEach((player, index) => {
    const node = document.createElement("span");
    node.className = "find-diff-score"
      + (player.player_id === me ? " is-me" : "")
      + (player.finished ? " is-done" : "");
    node.style.setProperty("--fd-color", FIND_DIFF_COLORS[index % FIND_DIFF_COLORS.length]);
    const right = player.finished
      ? '<span class="find-diff-time">' + findDiffFormat(player.elapsed_ms, true) + "</span>"
      : '<span class="find-diff-note">📷' + player.levels_done + "/" + view.levels_total
        + " 🎯" + player.level_found + "/" + view.diffs_per_level + "</span>";
    node.innerHTML = "<span>" + player.name + "</span>" + right;
    box.appendChild(node);
  });
}

function findDiffRankList(ranking) {
  const me = findDiffMyId();
  const items = ranking.map((row, index) => {
    const right = row.finished
      ? '<span class="find-diff-result-time">' + findDiffFormat(row.elapsed_ms, true) + "</span>"
      : '<span class="find-diff-note">found ' + row.found + "/" + row.total + "</span>";
    return '<li class="' + (row.player_id === me ? "is-me" : "") + '"'
      + ' style="--fd-color:' + FIND_DIFF_COLORS[index % FIND_DIFF_COLORS.length] + '">'
      + '<span class="find-diff-place">#' + row.place + "</span>"
      + '<span class="find-diff-who">' + row.name + "</span>"
      + right
      + '<span class="find-diff-note">✗' + row.misses + "</span>"
      + "</li>";
  });
  return '<ul class="find-diff-rank">' + items.join("") + "</ul>";
}

// The point of the pause is being able to see what you missed, so the review is
// a picture gallery with the answers boxed rather than a list of names.
function findDiffReviewGallery(review) {
  if (!review || !review.length) return "";
  const items = review.map((entry) => {
    const marks = entry.diffs.map((d) =>
      '<span class="find-diff-review-box" style="left:' + (d.box[0] * 100)
      + "%;top:" + (d.box[1] * 100)
      + "%;width:" + ((d.box[2] - d.box[0]) * 100)
      + "%;height:" + ((d.box[3] - d.box[1]) * 100) + '%"></span>').join("");
    const base = entry.base_size || [1600, 1200];
    const patches = (entry.patches || []).map((p) =>
      '<img src="' + p.url + '" alt="" style="position:absolute;left:'
      + (p.at[0] / base[0] * 100) + "%;top:" + (p.at[1] / base[1] * 100)
      + "%;width:" + (p.size[0] / base[0] * 100)
      + "%;height:" + (p.size[1] / base[1] * 100) + '%">').join("");
    return '<figure class="find-diff-review-item">'
      + '<div class="find-diff-review-pic"><img src="' + entry.a_url + '" alt="'
      + entry.title + '" loading="lazy">' + patches + marks + "</div>"
      + "<figcaption>" + (entry.index + 1) + ". " + entry.title + " — "
      + entry.diffs.map((d) => d.name + "(" + d.kind + ")").join(", ")
      + "</figcaption></figure>";
  });
  return '<div class="find-diff-review">' + items.join("") + "</div>";
}

function findDiffRenderResult() {
  const view = findDiffView;
  const panel = findDiffEl("findDiffResult");
  const stage = findDiffEl("findDiffStage");
  if (!panel) return;
  const you = view.you;

  if (view.stage === "racing" && !you.finished) {
    panel.hidden = true;
    panel.innerHTML = "";
    if (stage) stage.hidden = false;
    return;
  }

  panel.hidden = false;
  // Once the result panel is up the board has no context left (the player's
  // level is null), so the gallery inside the panel takes over the space.
  if (stage) stage.hidden = true;

  if (view.stage === "racing") {
    const waiting = view.players.filter((p) => !p.finished).length;
    panel.innerHTML = "<h3>🏁 You finished in " + findDiffFormat(you.elapsed_ms, true) + "</h3>"
      + "<p>Waiting for " + waiting + " more player" + (waiting === 1 ? "" : "s")
      + " to finish. The standings appear once everybody is done or the deadline hits.</p>";
    return;
  }

  const ranking = view.ranking || [];
  const parts = ["<h3>" + (view.stage === "game_over" ? "Final standings" : "Race results") + "</h3>"];
  parts.push(findDiffRankList(ranking));
  if (view.review) {
    parts.push("<p>The answers for this race:</p>");
    parts.push(findDiffReviewGallery(view.review));
  }
  const me = findDiffMyId();
  if (view.stage === "game_over") {
    const ready = view.rematch_ready.includes(me) || findDiffReadySent;
    parts.push('<div class="find-diff-result-actions">'
      + '<button type="button" class="find-diff-btn" id="findDiffPlayAgain"'
      + (ready ? " disabled" : "") + ">Play Again</button>"
      + '<span class="find-diff-waiting">Ready ' + view.rematch_ready.length
      + "/" + view.continue_target + "</span></div>");
  } else {
    const ready = view.continue_ready.includes(me) || findDiffReadySent;
    parts.push('<div class="find-diff-result-actions">'
      + '<button type="button" class="find-diff-btn" id="findDiffContinue"'
      + (ready ? " disabled" : "") + ">Continue</button>"
      + '<span class="find-diff-waiting">Ready ' + view.continue_ready.length
      + "/" + view.continue_target + "</span></div>");
  }
  panel.innerHTML = parts.join("");

  const cont = findDiffEl("findDiffContinue");
  if (cont) {
    cont.addEventListener("click", () => {
      if (findDiffReadySent) return;
      findDiffReadySent = true;
      cont.disabled = true;
      findDiffSend({ type: "continue" });
    });
  }
  const again = findDiffEl("findDiffPlayAgain");
  if (again) {
    again.addEventListener("click", () => {
      if (findDiffReadySent) return;
      findDiffReadySent = true;
      again.disabled = true;
      findDiffSend({ type: "play_again" });
    });
  }
}

function findDiffMyId() {
  // room.js owns the signed-in player's id as a top-level let.
  if (typeof playerId !== "undefined" && playerId) return playerId;
  if (typeof currentPlayerId !== "undefined" && currentPlayerId) return currentPlayerId;
  return null;
}

function findDiffSend(action) {
  if (typeof sendAction === "function") sendAction(action);
}

function findDiffGuess(frame, clientX, clientY) {
  const view = findDiffView;
  if (!view || view.stage !== "racing") return;
  const you = view.you;
  if (you.finished) return;
  if (findDiffExplainWidget?.isActive()) return;
  if (you.cooldown_until_ms > findDiffServerNow()) return;
  const img = frame.querySelector("img");
  if (!img) return;
  const rect = img.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return;
  findDiffShowTap(frame, x, y);
  findDiffSend({
    type: "guess",
    level: you.level_index + 1,
    x: Math.round(x * 10000) / 10000,
    y: Math.round(y * 10000) / 10000
  });
}

function findDiffShowTap(frame, x, y) {
  const host = frame.querySelector(".find-diff-marks");
  if (!host) return;
  const dot = document.createElement("div");
  dot.className = "find-diff-tap";
  dot.style.left = (x * 100) + "%";
  dot.style.top = (y * 100) + "%";
  host.appendChild(dot);
  window.setTimeout(() => dot.remove(), 660);
}

function findDiffBindStage() {
  const stage = findDiffEl("findDiffStage");
  if (!stage || stage.dataset.fdBound === "1") return;
  stage.dataset.fdBound = "1";
  let press = null;
  stage.addEventListener("pointerdown", (event) => {
    if (findDiffExplainWidget?.isActive()) return;
    if (!event.isPrimary || (event.button !== undefined && event.button !== 0)) return;
    const frame = event.target.closest(".find-diff-frame");
    if (!frame) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, at: Date.now(), frame };
  });
  // A press only counts as a tap when the finger stays put, so scrolling the page
  // never fires a guess (DEV_GUIDE).
  stage.addEventListener("pointermove", (event) => {
    if (!press || press.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 12) press = null;
  });
  stage.addEventListener("pointerup", (event) => {
    if (!press || press.id !== event.pointerId) return;
    const done = press;
    press = null;
    if (Date.now() - done.at > 900) return;
    findDiffGuess(done.frame, event.clientX, event.clientY);
  });
  stage.addEventListener("pointercancel", () => { press = null; });
  stage.addEventListener("pointerleave", () => { press = null; });
}

function findDiffRender() {
  const view = findDiffView;
  if (!view || !findDiffEl("findDiffPanel")) return;
  findDiffClockSkew = Date.now() - view.server_now_ms;
  const you = view.you;

  const image = findDiffEl("findDiffImage");
  const images = findDiffEl("findDiffImages");
  const remaining = findDiffEl("findDiffRemaining");
  const scene = findDiffEl("findDiffScene");
  if (image) image.textContent = Math.min(you.level_index + 1, view.levels_total);
  if (images) images.textContent = view.levels_total;
  if (remaining) remaining.textContent = you.finished ? 0 : you.remaining;
  if (scene) scene.textContent = you.level ? you.level.title : "All pictures cleared";

  const imageA = findDiffEl("findDiffImageA");
  const imageB = findDiffEl("findDiffImageB");
  if (you.level && findDiffLoadedLevel !== you.level.id) {
    findDiffLoadedLevel = you.level.id;
    // Both frames show the same clean base; B gets the patches stacked on top.
    if (imageA) imageA.src = you.level.a_url;
    if (imageB) imageB.src = you.level.a_url;
    findDiffRenderPatches(you.level);
  }

  findDiffRenderScores();
  findDiffRenderMarks();
  findDiffRenderResult();
  findDiffApplyLayout();
  findDiffTick();

  const log = findDiffEl("findDiffLog");
  if (log) {
    log.innerHTML = view.log.slice().reverse()
      .map((entry) => "<div>" + entry.message + "</div>").join("");
  }

  if (findDiffLastStage !== view.stage) {
    findDiffLastStage = view.stage;
    if (view.stage !== "racing") {
      const panel = findDiffEl("findDiffResult");
      if (panel) panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  if (!findDiffTicker) findDiffTicker = window.setInterval(findDiffTick, 100);
}

function clearFindDiffState() {
  findDiffView = null;
  findDiffLoadedLevel = null;
  findDiffLastStage = null;
  findDiffReadySent = false;
  window.clearInterval(findDiffTicker);
  findDiffTicker = null;
  ["findDiffMarksA", "findDiffMarksB", "findDiffPatchesB"].forEach((id) => {
    const host = findDiffEl(id);
    if (host) host.innerHTML = "";
  });
}

window.renderFindDiffGameState = (data) => {
  const next = data?.view || data;
  if (!next?.players || next.game_id !== "find_diff") return;
  if (next.stage !== findDiffLastStage) findDiffReadySent = false;
  findDiffView = next;
  findDiffInitHelpExplain();
  findDiffBindStage();
  findDiffRender();
};

window.showFindDiffHeaderActions = (visible) => {
  if (findDiffHeader) findDiffHeader.style.display = visible ? "flex" : "none";
  if (!visible) clearFindDiffState();
};
window.clearFindDiffState = clearFindDiffState;

findDiffHelpButton?.addEventListener("click", () => {
  findDiffInitHelpExplain();
  findDiffHelpWidget?.open();
});
findDiffExplainButton?.addEventListener("click", () => {
  findDiffInitHelpExplain();
  findDiffExplainWidget?.toggle();
});

document.addEventListener("click", (event) => {
  if (event.target?.id === "findDiffLayoutBtn") {
    findDiffLayout = findDiffEffectiveStacked() ? "split" : "stack";
    findDiffApplyLayout();
  }
});

window.addEventListener("resize", () => {
  if (!findDiffView) return;
  findDiffApplyLayout();
  ["findDiffMarksA", "findDiffMarksB"].forEach((id) => {
    const host = findDiffEl(id);
    if (host) findDiffClampTags(host);
  });
});

function connectFindDiffEvents() {
  if (typeof socket === "undefined") return;
  if (typeof currentRoomState !== "undefined" && currentRoomState) {
    window.renderFindDiffGameState(currentRoomState);
  }
}
if (document.readyState === "loading" || typeof socket === "undefined") {
  document.addEventListener("DOMContentLoaded", connectFindDiffEvents);
} else {
  connectFindDiffEvents();
}
