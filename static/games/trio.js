// 回忆三重奏 / Trio — browser client.
// Help & Explain follow designs/task40.md via the shared widgets.
// Rules: designs/task191.md

const trioPanel = document.getElementById("trioPanel");
const trioHeader = document.getElementById("trioHeaderActions");
const trioHelpButton = document.getElementById("trioHelpBtn");
const trioExplainButton = document.getElementById("trioExplainBtn");

const TRIO_HELP_CONFIG = {
  gameId: "trio",
  title: { zh: "回忆三重奏", en: "Trio" },
  basic: {
    win: {
      zh: "翻出三张数字相同的牌就收成一套三重奏(🌟)。简易模式下先收满 3 套，或者直接收走三张 7，立刻获胜。",
      en: "Reveal three cards of the same number and you keep them as a trio (🌟). In Simple mode the first player to hold three trios wins, and taking all three 7s wins on the spot."
    },
    turn: {
      zh: "轮到你时可以连续翻三次牌，每一次要么翻开桌面中央的一张暗牌(🎴)，要么要求任意一位玩家亮出手牌(✋)里最小或最大的那一张。",
      en: "On your turn you reveal up to three cards, one at a time. Each reveal either flips a face down card (🎴) in the middle or asks any player to show the lowest or highest card of their hand (✋)."
    },
    key: {
      zh: "每个人的手牌都按数字从小到大排好，所以你只能看到每人的两端，赢的关键是记住翻开过的牌现在压在哪个人手下的第几层。",
      en: "Every hand stays sorted from low to high, so you only ever see the two ends of a hand. Winning is about remembering where each card you have seen is now sitting and how deep it is buried."
    }
  },
  sections: [
    {
      id: "setup",
      label: { zh: "开局", en: "Setup" },
      html: {
        zh: "<p>牌堆一共 36 张，数字 1 到 12 各三张，洗匀之后按人数发牌，剩下的全部面朝下摊在桌子中央成为暗牌(🎴)。</p>"
          + "<p>3 人局每人 9 张手牌、桌面 9 张，4 人局每人 7 张、桌面 8 张，5 人局每人 6 张、桌面 6 张，6 人局每人 5 张、桌面 6 张。</p>"
          + "<p>拿到手牌(✋)后必须按数字从小到大排列，并且整局都要保持这个顺序，因为别人随时可以要求你亮出最小或最大的那一张。</p>"
          + "<p>线上版按座位顺序从 1 号座位开始行动，之后顺时针轮流。</p>",
        en: "<p>The deck holds 36 cards, three copies of every number from 1 to 12. Shuffle, deal by player count, and lay whatever is left face down in the middle as the table cards (🎴).</p>"
          + "<p>With 3 players each hand holds 9 cards and 9 stay on the table, with 4 players it is 7 and 8, with 5 players 6 and 6, and with 6 players 5 and 6.</p>"
          + "<p>Sort your hand (✋) from low to high and keep it that way for the whole game, because anyone may ask you for your lowest or highest card at any moment.</p>"
          + "<p>The online build starts with seat 1 and then passes clockwise.</p>"
      }
    },
    {
      id: "turn",
      label: { zh: "回合行动", en: "Your turn" },
      html: {
        zh: "<p>轮到你时连续行动，最多翻三次牌，每次二选一。</p>"
          + "<p><strong>翻暗牌(🎴)：</strong>翻开桌面中央任意一张面朝下的牌，桌面牌没有大小限制。</p>"
          + "<p><strong>要求亮手牌(✋)：</strong>指定任意一位玩家，包括你自己，亮出他当前最小或最大的那张牌，亮出来的牌会面朝上摆在他面前，这一回合剩下的时间里他手上就少了一张。</p>"
          + "<p>同一个人的同一端可以连续要求，所以连问两次最小，就等于把他手牌最左边的两张依次翻出来。</p>"
          + "<p>只要新翻出的数字和本回合已经翻出的数字不一样，回合立刻结束，这一回合翻开的牌全部复原，桌面牌重新盖好，手牌回到原来的位置，轮到下一位玩家。</p>",
        en: "<p>On your turn you act up to three times, and every action is one of two things.</p>"
          + "<p><strong>Flip a table card (🎴):</strong> turn over any face down card in the middle. Table cards carry no low or high restriction.</p>"
          + "<p><strong>Ask for a hand card (✋):</strong> name any player, yourself included, and ask for their lowest or their highest remaining card. That card goes face up in front of them and leaves their hand for the rest of the turn.</p>"
          + "<p>You may ask the same end twice, so two lowest requests in a row walk two cards deep into that hand.</p>"
          + "<p>The moment a reveal shows a different number from the cards already revealed this turn, your turn ends. Everything you revealed goes back exactly where it was and play passes on.</p>"
      }
    },
    {
      id: "trio",
      label: { zh: "三重奏与胜负", en: "Trios and winning" },
      html: {
        zh: "<p>三次翻牌数字全部相同就算成功，这三张牌收成一套三重奏(🌟)摆在你面前，然后所有人按下 Continue 才继续下一位玩家的回合。</p>"
          + "<p>简易模式下先收满 3 套三重奏的玩家获胜。</p>"
          + "<p>数字 7 是最中间的数字，开局很难拿到，所以三张 7 组成的那一套是特殊胜利条件，谁收走谁立刻获胜，不管他已经收了几套。</p>"
          + "<p>游戏结束时所有人的手牌和剩下的暗牌都会公开。</p>",
        en: "<p>Three reveals of the same number is a success. Those cards become a trio (🌟) in front of you, and everybody presses Continue before the next player starts.</p>"
          + "<p>In Simple mode the first player to hold three trios wins.</p>"
          + "<p>Seven is the middle number and the hardest to reach early, so the trio of 7s is a special win. Whoever takes it wins immediately, no matter how many other trios they hold.</p>"
          + "<p>When the game ends every hand and every remaining table card is revealed.</p>"
      }
    },
    {
      id: "spicy",
      label: { zh: "辣味模式", en: "Spicy mode" },
      html: {
        zh: "<p>辣味模式(🌶️)把胜利条件改成两套相连的三重奏，收满三套反而不够。</p>"
          + "<p>两个数字相差 7 或者相加等于 7 就算相连，例如 1 连 6 和 8，2 连 5 和 9，3 连 4 和 10。</p>"
          + "<p>三张 7 的即时胜利在辣味模式里同样有效。</p>",
        en: "<p>Spicy mode (🌶️) replaces the win condition with two connected trios, so simply collecting three of anything is no longer enough.</p>"
          + "<p>Two numbers are connected when they differ by 7 or add up to 7. For example 1 connects to 6 and 8, 2 connects to 5 and 9, and 3 connects to 4 and 10.</p>"
          + "<p>The instant win from the trio of 7s still applies in Spicy mode.</p>"
      }
    },
    {
      id: "online",
      label: { zh: "线上操作", en: "Playing online" },
      html: {
        zh: "<p>轮到你时，可以点的目标会亮起来，桌面上的暗牌(🎴)和每位玩家手牌(✋)两端都可以点。</p>"
          + "<p>点中之后目标上会盖一层蒙版，在蒙版里按 Reveal 才会真的翻牌，按 Cancel 或者点面板空白处取消选择。</p>"
          + "<p>你只看得到自己的手牌数字，别人手上只显示张数，翻开的牌在这一回合里对所有人明牌。</p>"
          + "<p>收成三重奏(🌟)之后会暂停，所有人按 Continue 才继续。分出胜负之后按 Play again 可以原班人马再来一局。</p>"
          + "<p>按 Explain 之后再点任意控件可以查看它的说明，Explain 模式下不会执行任何游戏操作，再按一次 Explain 或按 Esc 退出。</p>",
        en: "<p>On your turn every legal target lights up. Table cards (🎴) and both ends of each hand (✋) can be tapped.</p>"
          + "<p>Tapping a target lays a layer over it. Press Reveal inside that layer to actually flip, or press Cancel or tap empty space to drop the selection.</p>"
          + "<p>You see the numbers in your own hand only. Other hands show a card count, and anything revealed this turn is face up for everybody.</p>"
          + "<p>Claiming a trio (🌟) pauses the game until everyone presses Continue. After a result, Play again restarts with the same table.</p>"
          + "<p>Press Explain and then any control to read its description. Explain never performs a game action, and a second press or Esc leaves the mode.</p>"
      }
    }
  ]
};

const TRIO_EXPLAIN = {
  mode: {
    zh: "当前玩法。简易模式(🍃)先收满 3 套三重奏(🌟)获胜，辣味模式(🌶️)需要两套相连的三重奏。",
    en: "The mode in play. Simple (🍃) is a race to three trios (🌟), while Spicy (🌶️) needs two connected trios."
  },
  goal: {
    zh: "本局还要收几套三重奏(🌟)才能赢。三张 7 组成的特殊胜利任何时候都直接算赢。",
    en: "How many trios (🌟) this mode needs for the win. The special trio of 7s always wins instantly."
  },
  turn: {
    zh: "当前是第几个回合以及轮到谁。只有轮到你的时候，桌面暗牌(🎴)和其他人手牌(✋)的两端才可以点。",
    en: "The turn number and whose turn it is. Table cards (🎴) and the ends of every hand (✋) only respond on your own turn."
  },
  banner: {
    zh: "当前提示。轮到谁、刚刚翻牌成功还是失败、以及收成三重奏(🌟)后的暂停和最终胜负都写在这里。",
    en: "The live message. It says whose turn it is, whether the last reveal succeeded or failed, and it hosts the pause after a trio (🌟) plus the final result."
  },
  table: {
    zh: "桌面中央的暗牌(🎴)。这些牌面朝下，没有大小限制，轮到你时可以翻任意一张。翻开的牌在这一回合内对所有人明牌，失败后重新盖回去。",
    en: "The face down cards (🎴) in the middle. They carry no low or high restriction, so you may flip any of them on your turn. A flipped card is public for the rest of the turn and goes face down again after a failure."
  },
  table_card: {
    zh: "一张暗牌(🎴)。点它会盖上蒙版，在蒙版里确认才会翻开。已经被收走的格子会留空。",
    en: "One face down card (🎴). Tapping it lays a layer over it, and only confirming inside that layer flips it. A slot emptied by a claimed trio stays blank."
  },
  reveal: {
    zh: "本回合已经翻开的牌。最多三张，数字全部相同就能收成一套三重奏(🌟)，出现不同数字则立刻失败并全部复原。",
    en: "The cards revealed so far this turn. Three matching numbers become a trio (🌟), and a single different number ends the turn and puts everything back."
  },
  players: {
    zh: "每位玩家一行。左边是名字和已经收成的三重奏(🌟)，右边是手牌(✋)。你只看得到自己的数字，别人只显示张数。",
    en: "One row per player. The name and collected trios (🌟) sit on the left and the hand (✋) on the right. You read your own numbers while other hands only show a count."
  },
  hand_end: {
    zh: "手牌(✋)的一端。所有人手牌都按数字排序，所以能要求别人的只有最左边的最小牌和最右边的最大牌，连问两次就会往里多翻一层。",
    en: "One end of a hand (✋). Hands stay sorted, so the only legal asks are the leftmost lowest card and the rightmost highest card. Asking the same end twice walks one card deeper."
  },
  trio_chip: {
    zh: "一套已经收成的三重奏(🌟)，数字就是这三张牌的数字。三张 7 的那一套会直接赢下这一局。",
    en: "One trio (🌟) already collected, labelled with its number. The trio of 7s wins the game outright."
  },
  continue: {
    zh: "结算暂停。收成三重奏(🌟)之后所有人按下 Continue，才会进入下一位玩家的回合。",
    en: "The pause after a result. Play only moves to the next player once everybody has pressed Continue."
  },
  again: {
    zh: "再来一局。所有人按下 Play again 之后，会用同样的座位和玩法重新洗牌开局。",
    en: "Play again. Once everybody presses it, the same seats and mode are reshuffled into a fresh game."
  },
  log: {
    zh: "行动日志，记录发牌、每一次翻牌成功或失败，以及收成的三重奏(🌟)。",
    en: "The action log, listing the deal, every reveal that succeeded or failed, and each trio (🌟) claimed."
  }
};

let trioHelpWidget = null;
let trioExplainWidget = null;
let trioView = null;
let trioPicked = null;
let trioPending = false;
let trioPendingTimer = null;
let trioSignature = null;
// The shared Explain widget leaves explain mode on pointerup, so by the time the
// click event arrives `isActive()` is already false. Remember the state at press
// time instead, otherwise explaining a control would also trigger it.
let trioExplainPress = false;

const TRIO_HUE_STEP = 30;

const trioEsc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
));

function trioPlayer(id) {
  return trioView?.players.find((player) => player.player_id === id) || null;
}

function trioName(id) {
  return trioPlayer(id)?.name || "—";
}

function trioMe() {
  return trioPlayer(trioView?.you);
}

function trioLegal(action) {
  return !trioPending && !!trioView?.legal_actions?.includes(action);
}

function trioHue(number) {
  return (Number(number) - 1) * TRIO_HUE_STEP;
}

function trioCardHTML(number, extra = "") {
  return '<div class="trio-card ' + extra + '" style="--trio-hue:' + trioHue(number) + '">'
    + trioEsc(number) + "</div>";
}

function trioBackHTML(extra = "") {
  return '<div class="trio-card is-back ' + extra + '">🎴</div>';
}

/* --- legal targets ---------------------------------------------------- */

function trioOpenTargets() {
  const open = new Set();
  if (!trioLegal("reveal")) return open;
  (trioView.table || []).forEach((slot) => {
    if (!slot.empty && !slot.face_up) open.add("table:" + slot.index);
  });
  (trioView.players || []).forEach((player) => {
    if (player.hand_count > 0) open.add("hand:" + player.player_id + ":low");
    if (player.hand_count > 1) open.add("hand:" + player.player_id + ":high");
  });
  return open;
}

function trioPickLabel(key) {
  const parts = key.split(":");
  if (parts[0] === "table") return "Reveal";
  return parts[2] === "low" ? "Lowest" : "Highest";
}

// A single card is far too small to hold two buttons on a phone, so the mask
// covers a container that is big enough (DEV_GUIDE) and leaves the picked item
// itself uncovered and outlined.
function trioMaskHTML(key, variant) {
  return '<div class="trio-mask ' + variant + '">'
    + '<button type="button" class="trio-go" data-trio-go="' + trioEsc(key) + '">'
    + trioPickLabel(key) + "</button>"
    + '<button type="button" data-trio-cancel="1">Cancel</button>'
    + "</div>";
}

function trioTableCols() {
  return (trioView.table || []).length === 8 ? 4 : 3;
}

/* --- renderers -------------------------------------------------------- */

function trioTableHTML(open) {
  const slots = trioView.table || [];
  const cols = trioTableCols();
  const picking = trioPicked !== null;
  const pickedIndex = trioPicked && trioPicked.startsWith("table:")
    ? Number(trioPicked.split(":")[1])
    : null;
  const cells = slots.map((slot) => {
    const key = "table:" + slot.index;
    const canOpen = open.has(key);
    const picked = trioPicked === key;
    const classes = ["trio-slot"];
    if (canOpen) classes.push("is-open");
    if (picked) classes.push("is-picked");
    else if (picking && canOpen) classes.push("is-dimmed");
    let card;
    if (slot.empty) card = '<div class="trio-card is-empty">·</div>';
    else if (slot.number !== null && slot.number !== undefined) {
      card = trioCardHTML(slot.number, slot.face_up ? "is-face" : "");
    } else card = trioBackHTML();
    const attrs = canOpen ? ' data-trio-pick="' + key + '"' : "";
    return '<div class="' + classes.join(" ") + '"' + attrs
      + ' data-trio-explain="table_card">' + card + "</div>";
  }).join("");
  if (pickedIndex === null) return cells;
  // Park the confirmation band in a row the picked card does not sit in, so the
  // card stays readable above the mask instead of hiding behind the buttons.
  const rows = Math.ceil(slots.length / cols);
  const band = Math.floor(pickedIndex / cols) >= rows - 1 ? "is-top" : "is-bottom";
  return cells + trioMaskHTML(trioPicked, "trio-mask--table " + band);
}

function trioRevealNote() {
  const revealed = trioView.revealed || [];
  if (!revealed.length) {
    return trioView.current_player === trioView.you ? "选择一张暗牌或某人手上的一端" : "";
  }
  const need = 3 - revealed.length;
  return "还需 " + need + " 张 " + revealed[0].number;
}

function trioRevealHTML() {
  const revealed = trioView.revealed || [];
  if (!revealed.length) {
    return '<span class="trio-reveal-empty">本回合还没有翻牌</span>';
  }
  return revealed.map((entry) => {
    const from = entry.source === "table"
      ? "桌面"
      : trioName(entry.player) + (entry.end === "low" ? " 最小" : " 最大");
    return '<div class="trio-reveal-card">' + trioCardHTML(entry.number, "is-face")
      + '<span class="trio-reveal-from">' + trioEsc(from) + "</span></div>";
  }).join("");
}

function trioHandCellHTML(player, index, count, known, open) {
  const isLow = index === 0;
  const isHigh = index === count - 1;
  const end = isLow ? "low" : (isHigh ? "high" : null);
  const key = end ? "hand:" + player.player_id + ":" + end : null;
  const canOpen = key ? open.has(key) : false;
  const classes = ["trio-card"];
  if (!known) classes.push("is-back");
  if (end) classes.push("is-end");
  if (canOpen) classes.push("is-open");
  if (key && trioPicked === key) classes.push("is-picked");
  const attrs = [];
  if (canOpen) attrs.push('data-trio-pick="' + key + '"');
  if (end) attrs.push('data-trio-explain="hand_end"');
  if (known) attrs.push('style="--trio-hue:' + trioHue(known[index].number) + '"');
  const face = known ? trioEsc(known[index].number) : "🎴";
  return '<div class="' + classes.join(" ") + '"' + (attrs.length ? " " + attrs.join(" ") : "")
    + ">" + face + "</div>";
}

function trioHandHTML(player, open) {
  const known = Array.isArray(player.hand) ? player.hand : null;
  const count = player.hand_count;
  if (!count) return '<span class="trio-hand-count">手上没有牌</span>';
  const cells = [];
  for (let index = 0; index < count; index += 1) {
    cells.push(trioHandCellHTML(player, index, count, known, open));
  }
  return '<div class="trio-hand">'
    + '<span class="trio-hand-arrow">◀</span>'
    + cells.join("")
    + '<span class="trio-hand-arrow">▶</span>'
    + "</div>";
}

function trioPlayersHTML(open) {
  return (trioView.players || []).map((player) => {
    const classes = ["trio-player"];
    if (player.is_current) classes.push("is-current");
    if (player.is_you) classes.push("is-you");
    const trios = player.trios.length
      ? player.trios.map((number) => (
        '<span class="trio-trio-chip" data-trio-explain="trio_chip" style="--trio-hue:'
        + trioHue(number) + '">' + trioEsc(number) + "</span>"
      )).join("")
      : '<span class="trio-trio-none">—</span>';
    const pickedHere = trioPicked && trioPicked.startsWith("hand:" + player.player_id + ":");
    const mask = pickedHere
      ? trioMaskHTML(trioPicked, "trio-mask--row " + (trioPicked.endsWith(":low") ? "is-low" : "is-high"))
      : "";
    return '<div class="' + classes.join(" ") + '" data-trio-explain="players">'
      + '<div class="trio-who"><span class="trio-name">' + trioEsc(player.name)
      + (player.is_you ? " (你)" : "") + "</span>"
      + '<div class="trio-trios">' + trios + "</div></div>"
      + trioHandHTML(player, open)
      + mask
      + "</div>";
  }).join("");
}

function trioBannerHTML() {
  const view = trioView;
  if (view.game_over) {
    const won = view.winner && view.winner === view.you;
    const head = view.winner
      ? (won ? "🏆 你赢下了这一局！" : "🏆 " + trioEsc(trioName(view.winner)) + " 获胜")
      : "本局平局，没有人能再凑出三重奏";
    const ready = (view.rematch_ready || []).includes(view.you);
    return { cls: "is-shown " + (view.winner ? "is-good" : ""), html: head
      + '<div class="trio-banner-actions">'
      + '<button type="button" class="trio-primary" data-trio-again="1" data-trio-explain="again"'
      + (ready ? " disabled" : "") + ">" + (ready ? "等待其他玩家" : "Play again") + "</button></div>" };
  }
  if (view.stage === "reveal") {
    const result = view.last_result;
    const who = result ? trioEsc(trioName(result.player)) : "";
    const ready = (view.continue_ready || []).includes(view.you);
    return { cls: "is-shown is-good", html: "🌟 " + who + " 收走了 " + trioEsc(result?.number)
      + " 的三重奏"
      + '<div class="trio-banner-actions">'
      + '<button type="button" class="trio-primary" data-trio-continue="1" data-trio-explain="continue"'
      + (ready ? " disabled" : "") + ">" + (ready ? "等待其他玩家" : "Continue") + "</button></div>" };
  }
  const revealed = view.revealed || [];
  const result = view.last_result;
  const mine = view.current_player === view.you;
  if (!revealed.length && result && !result.success && result.turn === view.turn - 1) {
    return { cls: "is-shown is-bad", html: "✘ " + trioEsc(trioName(result.player))
      + " 翻出 " + trioEsc((result.cards || []).join(" · ")) + "，数字不同，回合结束" };
  }
  if (revealed.length) {
    const who = mine ? "你" : trioEsc(trioName(view.current_player));
    return { cls: "is-shown", html: who + "正在翻第 " + (revealed.length + 1)
      + " 张，需要数字 " + trioEsc(revealed[0].number) };
  }
  if (mine) {
    return { cls: "is-shown", html: "轮到你行动，翻三张相同数字的牌" };
  }
  return { cls: "is-shown", html: "等待 " + trioEsc(trioName(view.current_player)) + " 行动" };
}

function trioRender() {
  if (!trioPanel) return;
  if (!trioView) { trioPanel.innerHTML = ""; return; }
  const open = trioOpenTargets();
  const mode = document.getElementById("trioMode");
  if (mode) {
    mode.textContent = trioView.mode === "spicy" ? "🌶️ 辣味" : "🍃 简易";
  }
  const goal = document.getElementById("trioGoal");
  if (goal) {
    goal.textContent = "目标 " + trioView.trios_to_win + " 套"
      + (trioView.mode === "spicy" ? "相连" : "");
  }
  const turn = document.getElementById("trioTurn");
  if (turn) {
    const mine = trioView.current_player === trioView.you;
    let who;
    if (trioView.game_over) who = "本局结束";
    else if (trioView.stage === "reveal") who = trioName(trioView.last_result?.player) + " 收牌";
    else who = mine ? "轮到你" : trioName(trioView.current_player);
    turn.textContent = "第 " + trioView.turn + " 回合 · " + who;
    turn.classList.toggle("is-you", mine && !trioView.game_over);
  }
  const banner = document.getElementById("trioBanner");
  if (banner) {
    const built = trioBannerHTML();
    banner.className = "trio-banner " + built.cls;
    banner.innerHTML = built.html;
  }
  const tableNote = document.getElementById("trioTableNote");
  if (tableNote) {
    const left = (trioView.table || []).filter((slot) => !slot.empty).length;
    tableNote.textContent = left + " 张暗牌";
  }
  const table = document.getElementById("trioTable");
  if (table) {
    table.style.setProperty("--trio-cols", String(trioTableCols()));
    table.innerHTML = trioTableHTML(open);
  }
  const revealNote = document.getElementById("trioRevealNote");
  if (revealNote) revealNote.textContent = trioRevealNote();
  const reveal = document.getElementById("trioReveal");
  if (reveal) reveal.innerHTML = trioRevealHTML();
  const playersNote = document.getElementById("trioPlayersNote");
  if (playersNote) {
    const me = trioMe();
    playersNote.textContent = me ? "你已收 " + me.trios.length + " 套" : "";
  }
  const players = document.getElementById("trioPlayers");
  if (players) players.innerHTML = trioPlayersHTML(open);
  const log = document.getElementById("trioLog");
  if (log) {
    log.innerHTML = (trioView.log || []).slice(-30)
      .map((line) => "<div>" + trioEsc(line) + "</div>").join("");
    log.scrollTop = log.scrollHeight;
  }
  trioPlaceRowMask();
}

// The row mask has to stop short of the picked end tile, and that tile sits
// after the name column, whose width changes per breakpoint. Measure it instead
// of hard coding an offset, so the two never overlap at any width.
function trioPlaceRowMask() {
  const mask = trioPanel?.querySelector(".trio-mask--row");
  if (!mask) return;
  const row = mask.parentElement;
  const tile = row?.querySelector(".trio-hand .trio-card.is-picked");
  if (!row || !tile) return;
  const rowRect = row.getBoundingClientRect();
  const tileRect = tile.getBoundingClientRect();
  const gap = 6;
  if (mask.classList.contains("is-low")) {
    mask.style.left = Math.max(0, Math.round(tileRect.right - rowRect.left + gap)) + "px";
    mask.style.right = "0px";
  } else {
    mask.style.right = Math.max(0, Math.round(rowRect.right - tileRect.left + gap)) + "px";
    mask.style.left = "0px";
  }
}

/* --- actions ---------------------------------------------------------- */

function trioSend(action) {
  if (trioPending) return;
  trioPending = true;
  window.clearTimeout(trioPendingTimer);
  trioPendingTimer = window.setTimeout(() => { trioPending = false; trioRender(); }, 8000);
  if (typeof sendAction === "function") sendAction(action);
  trioPicked = null;
  trioRender();
}

function trioRevealAction(key) {
  const parts = key.split(":");
  if (parts[0] === "table") {
    return { type: "reveal", turn: trioView.turn, source: "table", index: Number(parts[1]) };
  }
  return {
    type: "reveal",
    turn: trioView.turn,
    source: "hand",
    player: parts[1],
    end: parts[2],
  };
}

function trioBindPanel() {
  if (!trioPanel || trioPanel.dataset.trioBound === "1") return;
  trioPanel.dataset.trioBound = "1";
  document.addEventListener("pointerdown", () => {
    trioExplainPress = !!trioExplainWidget?.isActive();
  }, true);
  trioPanel.addEventListener("click", (event) => {
    if (trioExplainWidget?.isActive()) return;
    if (trioExplainPress) { trioExplainPress = false; return; }
    if (!trioView) return;
    const go = event.target.closest("[data-trio-go]");
    if (go) {
      const key = go.getAttribute("data-trio-go");
      if (trioLegal("reveal")) trioSend(trioRevealAction(key));
      return;
    }
    if (event.target.closest("[data-trio-cancel]")) { trioPicked = null; trioRender(); return; }
    const pick = event.target.closest("[data-trio-pick]");
    if (pick) {
      const key = pick.getAttribute("data-trio-pick");
      trioPicked = trioPicked === key ? null : key;
      trioRender();
      return;
    }
    if (event.target.closest("[data-trio-continue]")) {
      if (trioLegal("continue")) trioSend({ type: "continue", turn: trioView.turn });
      return;
    }
    if (event.target.closest("[data-trio-again]")) {
      if (trioLegal("play_again")) trioSend({ type: "play_again" });
      return;
    }
    if (!event.target.closest(".trio-mask")) { trioPicked = null; trioRender(); }
  });
}

function clearTrioState() {
  trioView = null;
  trioPicked = null;
  trioPending = false;
  trioSignature = null;
  window.clearTimeout(trioPendingTimer);
  if (trioPanel) trioPanel.innerHTML = "";
}

window.renderTrioGameState = (data) => {
  const next = data?.view || data;
  if (!next?.players || next.game_id !== "trio") return;
  const signature = JSON.stringify([data?.room_id, next.turn, next.stage, next.current_player, next.revealed?.length]);
  if (signature !== trioSignature) {
    trioPicked = null;
    trioPending = false;
    window.clearTimeout(trioPendingTimer);
  }
  trioSignature = signature;
  trioView = next;
  initTrioHelpExplain();
  trioBindPanel();
  trioRender();
};

window.showTrioHeaderActions = (visible) => {
  if (trioHeader) trioHeader.style.display = visible ? "flex" : "none";
  if (!visible) clearTrioState();
};
window.clearTrioState = clearTrioState;

function initTrioHelpExplain() {
  if (trioHelpWidget || typeof window.obgCreateHelp !== "function") return;
  trioHelpWidget = window.obgCreateHelp(TRIO_HELP_CONFIG);
  trioExplainWidget = window.obgCreateExplain({
    gameId: "trio",
    attribute: "data-trio-explain",
    explanations: TRIO_EXPLAIN,
    button: trioExplainButton,
    root: () => document.getElementById("trioPanel"),
    bypass: ["#trioHelpBtn", "#trioExplainBtn"]
  });
}

trioHelpButton?.addEventListener("click", () => {
  initTrioHelpExplain();
  trioHelpWidget?.open();
});
trioExplainButton?.addEventListener("click", () => {
  initTrioHelpExplain();
  trioExplainWidget?.toggle();
});

document.addEventListener("keydown", (event) => {
  if (!trioView || event.key !== "Escape") return;
  if (trioExplainWidget?.isActive()) return;
  if (!trioPicked) return;
  trioPicked = null;
  trioRender();
}, true);

// A rotation or a window resize moves the end tiles, so re-measure the mask.
window.addEventListener("resize", () => {
  if (trioView) trioPlaceRowMask();
});

function connectTrioEvents() {
  if (typeof socket === "undefined") return;
  socket.on("system:error", () => {
    if (trioPending) {
      trioPending = false;
      window.clearTimeout(trioPendingTimer);
      trioRender();
    }
  });
  if (typeof currentRoomState !== "undefined" && currentRoomState) {
    window.renderTrioGameState(currentRoomState);
  }
}
if (document.readyState === "loading" || typeof socket === "undefined") {
  window.addEventListener("DOMContentLoaded", connectTrioEvents, { once: true });
} else {
  connectTrioEvents();
}
