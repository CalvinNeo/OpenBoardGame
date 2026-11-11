// 大家来找茬 / Spot the Difference — browser client.
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
      zh: "每一轮所有人同时看同一对照片，两张图只有 5 处不一样，谁先点中一处就归谁，轮末分数最高的人赢。",
      en: "Every round everyone looks at the same pair of photos that differ in exactly five places, and whoever taps a difference first claims it. The highest score at the end wins."
    },
    turn: {
      zh: "没有回合顺序，任何时候你都可以在任意一张图上点一下你认为不同的地方，点中记分，点错扣分并被锁住两秒。",
      en: "There is no turn order. At any moment you may tap the spot you think differs on either picture: a hit scores, a miss costs a point and locks you out for two seconds."
    },
    key: {
      zh: "两张图内容完全一致，只有被改动的物件不一样，所以与其逐块扫描，不如先扫一遍整张图的轮廓和颜色块，那里最容易藏差异。",
      en: "The two pictures are identical apart from the edited objects, so instead of scanning block by block it pays to sweep the whole frame for odd silhouettes and colour patches, which is where differences hide."
    }
  },
  sections: [
    {
      id: "play",
      label: { zh: "怎么玩", en: "How to play" },
      html: {
        zh: "<p>每轮开始时两边各出现一张照片，左边是原图(🅰️)，右边是被改过的图(🅱️)，两张尺寸和构图完全相同，只有 <strong>5 处</strong>物件不一样。</p>"
          + "<p>在<strong>任意一张</strong>图上点你认为是差异的位置都可以，点 A 或点 B 效果一样。点中之后那个位置会在两边同时框出来，并标上是谁找到的。</p>"
          + "<p>已经被别人找到的差异会一直显示在图上，所以你只需要找还没被框住的地方。已经找到的位置再点一次不会有惩罚。</p>",
        en: "<p>Each round shows two photos side by side: the original(🅰️) on the left and the edited one(🅱️) on the right. They share the same size and framing and differ in exactly <strong>five</strong> objects.</p>"
          + "<p>Tap the spot you believe differs on <strong>either</strong> picture, because A and B are equivalent. A hit frames that spot on both pictures at once and labels who found it.</p>"
          + "<p>A difference somebody else already claimed stays marked, so keep hunting the unmarked areas. Tapping an already claimed spot costs nothing.</p>"
      }
    },
    {
      id: "score",
      label: { zh: "计分", en: "Scoring" },
      html: {
        zh: "<p>每<strong>第一个</strong>点中一处差异的人得 <strong>3 分</strong>。一处差异只有一次分，后来的人点同一个地方不会得分。</p>"
          + "<p>点错（点在不是差异的地方）<strong>扣 1 分</strong>，分数不会低于 0，并且你会被<strong>锁住 2 秒</strong>不能继续点，界面下方会显示剩余锁定时间。</p>"
          + "<p>所以乱扫整张图并不是好策略：每错一次就要停两秒，而别人可以继续找。</p>",
        en: "<p>The <strong>first</strong> player to tap a difference scores <strong>3 points</strong>. Each difference pays out once, so tapping a spot someone already claimed earns nothing.</p>"
          + "<p>A miss (tapping somewhere that is not a difference) costs <strong>1 point</strong>, never dropping below zero, and locks you out for <strong>2 seconds</strong>. The remaining lock time is shown under the pictures.</p>"
          + "<p>Spraying taps across the picture is therefore a bad plan: every miss costs you two seconds while everyone else keeps hunting.</p>"
      }
    },
    {
      id: "rounds",
      label: { zh: "回合与结束", en: "Rounds and ending" },
      html: {
        zh: "<p>一轮在<strong>5 处全部被找到</strong>时立刻结束。如果时间先到（默认每轮 120 秒），本轮同样会结束，并公布剩下没被找到的位置。</p>"
          + "<p>本轮结束后画面会<strong>停下来</strong>，图上会补齐全部 5 处位置（没被找到的用红色虚线框标出），下方列出每个人找到了几处。</p>"
          + "<p>所有人点了 <strong>Next Round</strong> 之后才会进入下一轮。跑完设定的轮数后按总分排名，第一名为赢家，同分则并列。</p>",
        en: "<p>A round ends the moment <strong>all five</strong> differences are claimed. If the clock runs out first (120 seconds by default) the round also ends and the unfound spots are revealed.</p>"
          + "<p>When the round ends the table <strong>pauses</strong>: all five spots appear on the pictures (anything nobody found gets a red dashed frame) and a summary below lists how many each player claimed.</p>"
          + "<p>The next round only starts once everybody has pressed <strong>Next Round</strong>. After the configured number of rounds the highest total score wins, and ties share the win.</p>"
      }
    },
    {
      id: "tips",
      label: { zh: "找茬技巧", en: "Tips" },
      html: {
        zh: "<p>差异只会有四种形态：某个东西<strong>多了一个</strong>（复制到旁边）、<strong>颜色变了</strong>、<strong>镜像翻转</strong>了、或者<strong>变大</strong>了。知道只有这四种之后，扫描时会更快锁定。</p>"
          + "<p>颜色变化最容易发现，可以先扫一遍大面积的色块。镜像和变大比较隐蔽，通常藏在有明显朝向或明显大小的物件上。</p>"
          + "<p>手机上两张图默认<strong>上下排列</strong>，可以用右上角的按钮切换成<strong>左右并排</strong>，哪种更容易对比就用哪种。</p>",
        en: "<p>There are only four kinds of difference: something <strong>duplicated</strong> next to the original, something <strong>recoloured</strong>, something <strong>mirrored</strong>, and something <strong>made bigger</strong>. Knowing that shortens the search a lot.</p>"
          + "<p>Colour changes are the easiest to catch, so sweep large colour blocks first. Mirrors and size changes are sneakier and usually sit on objects with an obvious facing or an obvious size.</p>"
          + "<p>On phones the two pictures are <strong>stacked</strong> by default, and the button at the top right switches to <strong>side by side</strong>, so use whichever is easier for you to compare.</p>"
      }
    }
  ]
};

const FIND_DIFF_EXPLAIN = {
  round: {
    zh: "当前是第几轮 / 本局一共几轮。每轮一对新照片。",
    en: "The current round out of the total. Every round brings a new pair of photos."
  },
  timer: {
    zh: "本轮剩余时间。时间归零时本轮结束，没找到的差异会被公布。",
    en: "Time left in this round. At zero the round ends and anything unfound is revealed."
  },
  remaining: {
    zh: "还剩几处差异没被找到。归零时本轮立刻结束。",
    en: "How many differences are still unclaimed. At zero the round ends immediately."
  },
  scene: {
    zh: "本轮照片的主题，仅作说明，不影响玩法。",
    en: "The theme of this round's photo. It is descriptive only and does not affect play."
  },
  scores: {
    zh: "所有玩家的当前总分与各自的点错次数。左侧色条对应图上标记框的颜色。",
    en: "Every player's total score and miss count. The colour bar matches that player's marker colour on the pictures."
  },
  picture: {
    zh: "本轮的照片对。A(🅰️) 是原图，B(🅱️) 是被改过的图，两张只有 5 处不同。在任意一张上点你认为是差异的位置即可。",
    en: "This round's pair of photos. A(🅰️) is the original and B(🅱️) is the edited one, and they differ in exactly five places. Tap the spot you think differs on either picture."
  },
  hint: {
    zh: "状态提示：告诉你现在能不能点、被锁住还剩几秒、或者本轮已经结束。",
    en: "Status line: whether you can tap right now, how much of a lockout is left, or whether the round has ended."
  },
  log: {
    zh: "本局的文字记录，按时间列出谁找到了什么、谁点错了。",
    en: "A text record of the game: who found what, and who missed, in order."
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
// Optimistic lock so a double tap cannot queue two continue/play_again actions.
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
    button.title = stacked
      ? "Switch to side-by-side pictures"
      : "Switch to stacked pictures";
  }
}

function findDiffFormatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ":" + String(s).padStart(2, "0");
}

function findDiffTick() {
  const view = findDiffView;
  if (!view) return;
  const timer = findDiffEl("findDiffTimer");
  const hint = findDiffEl("findDiffHint");
  if (timer) {
    const left = view.stage === "playing" ? view.deadline_ms - findDiffServerNow() : 0;
    timer.textContent = findDiffFormatClock(left);
    const chip = timer.closest(".find-diff-chip");
    if (chip) chip.classList.toggle("is-urgent", view.stage === "playing" && left <= 15000);
  }
  if (hint && view.stage === "playing") {
    const lock = view.cooldown_until_ms - findDiffServerNow();
    if (lock > 0) {
      hint.textContent = "Missed — locked for " + (lock / 1000).toFixed(1) + "s";
      hint.classList.add("is-locked");
    } else {
      hint.textContent = "Tap a difference on either picture. First to tap it scores "
        + view.points_per_find + ".";
      hint.classList.remove("is-locked");
    }
  }
}

function findDiffAppendMark(host, entry, missed) {
  const color = missed ? null : findDiffColorFor(entry.player_id);
  const box = document.createElement("div");
  box.className = "find-diff-mark" + (missed ? " is-missed" : "");
  box.style.left = (entry.box[0] * 100) + "%";
  box.style.top = (entry.box[1] * 100) + "%";
  box.style.width = ((entry.box[2] - entry.box[0]) * 100) + "%";
  box.style.height = ((entry.box[3] - entry.box[1]) * 100) + "%";
  if (color) box.style.setProperty("--fd-color", color);
  host.appendChild(box);

  const tag = document.createElement("span");
  tag.className = "find-diff-tag" + (missed ? " is-missed" : "");
  tag.textContent = missed ? "missed" : entry.player_name;
  tag.style.left = (entry.box[0] * 100) + "%";
  tag.style.top = (entry.box[1] * 100) + "%";
  if (color) tag.style.setProperty("--fd-color", color);
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
  const summary = view.round_summary;
  const missed = summary && summary.missed ? summary.missed : [];
  [marksA, marksB].forEach((host) => {
    view.found.forEach((entry) => findDiffAppendMark(host, entry, false));
    missed.forEach((entry) => findDiffAppendMark(host, entry, true));
    findDiffClampTags(host);
  });
}

function findDiffRenderScores() {
  const view = findDiffView;
  const box = findDiffEl("findDiffScores");
  if (!box) return;
  box.innerHTML = "";
  view.players.forEach((player, index) => {
    const node = document.createElement("span");
    node.className = "find-diff-score";
    node.style.setProperty("--fd-color", FIND_DIFF_COLORS[index % FIND_DIFF_COLORS.length]);
    node.innerHTML = "<span>" + player.name + "</span><b>" + player.score + "</b>"
      + '<span class="find-diff-miss">✗' + player.misses + "</span>";
    box.appendChild(node);
  });
}

function findDiffRenderResult() {
  const view = findDiffView;
  const panel = findDiffEl("findDiffResult");
  if (!panel) return;
  if (view.stage === "playing") {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }
  panel.hidden = false;
  const summary = view.round_summary;
  const parts = [];
  if (view.stage === "game_over") {
    const ranked = view.players.slice().sort((a, b) => b.score - a.score);
    parts.push("<h3>Game Over</h3>");
    parts.push("<ul>" + ranked.map((p, i) =>
      "<li>" + (i + 1) + ". " + p.name + " — " + p.score + " pts ("
      + p.misses + " misses)</li>").join("") + "</ul>");
    const ready = view.rematch_ready.includes(findDiffMyId()) || findDiffReadySent;
    parts.push('<div class="find-diff-result-actions">'
      + '<button type="button" class="find-diff-btn" id="findDiffPlayAgain"'
      + (ready ? " disabled" : "") + ">Play Again</button>"
      + '<span class="find-diff-waiting">Ready ' + view.rematch_ready.length
      + "/" + view.continue_target + "</span></div>");
  } else {
    const found = summary ? summary.found : [];
    const missed = summary ? summary.missed : [];
    parts.push("<h3>Round " + summary.round + " — " + summary.title + "</h3>");
    const lines = found.map((entry) =>
      "<li>" + entry.player_name + " found #" + (entry.index + 1) + "</li>");
    missed.forEach((entry) => {
      lines.push("<li>Nobody found #" + (entry.index + 1) + "</li>");
    });
    parts.push("<ul>" + (lines.join("") || "<li>No differences were found.</li>") + "</ul>");
    const ready = view.continue_ready.includes(findDiffMyId()) || findDiffReadySent;
    parts.push('<div class="find-diff-result-actions">'
      + '<button type="button" class="find-diff-btn" id="findDiffNextRound"'
      + (ready ? " disabled" : "") + ">"
      + (view.round >= view.rounds ? "Finish" : "Next Round") + "</button>"
      + '<span class="find-diff-waiting">Ready ' + view.continue_ready.length
      + "/" + view.continue_target + "</span></div>");
  }
  panel.innerHTML = parts.join("");
  const next = findDiffEl("findDiffNextRound");
  if (next) {
    next.addEventListener("click", () => {
      if (findDiffReadySent) return;
      findDiffReadySent = true;
      next.disabled = true;
      findDiffSend({ type: "continue", round: view.round });
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
  if (!view || view.stage !== "playing") return;
  if (findDiffExplainWidget?.isActive()) return;
  if (view.cooldown_until_ms > findDiffServerNow()) return;
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
    round: view.round,
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
  window.setTimeout(() => dot.remove(), 650);
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

  const round = findDiffEl("findDiffRound");
  const rounds = findDiffEl("findDiffRounds");
  const remaining = findDiffEl("findDiffRemaining");
  const scene = findDiffEl("findDiffScene");
  if (round) round.textContent = view.round;
  if (rounds) rounds.textContent = view.rounds;
  if (remaining) remaining.textContent = view.remaining;
  if (scene) scene.textContent = view.level.title || "";

  const imageA = findDiffEl("findDiffImageA");
  const imageB = findDiffEl("findDiffImageB");
  if (view.level.id && findDiffLoadedLevel !== view.level.id) {
    findDiffLoadedLevel = view.level.id;
    if (imageA) imageA.src = view.level.a_url;
    if (imageB) imageB.src = view.level.b_url;
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
    if (view.stage !== "playing") {
      const panel = findDiffEl("findDiffResult");
      if (panel) panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  if (!findDiffTicker) findDiffTicker = window.setInterval(findDiffTick, 250);
}

function clearFindDiffState() {
  findDiffView = null;
  findDiffLoadedLevel = null;
  findDiffLastStage = null;
  findDiffReadySent = false;
  window.clearInterval(findDiffTicker);
  findDiffTicker = null;
  const panel = findDiffEl("findDiffPanel");
  if (panel) {
    const marksA = findDiffEl("findDiffMarksA");
    const marksB = findDiffEl("findDiffMarksB");
    if (marksA) marksA.innerHTML = "";
    if (marksB) marksB.innerHTML = "";
  }
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
