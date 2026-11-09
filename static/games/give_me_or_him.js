// 给我！还是他？ / Give Me! Or Him? — browser client.
// Help & Explain follow designs/task40.md via the shared widgets.
// Rules: designs/task190.md

const giveMeOrHimPanel = document.getElementById("giveMeOrHimPanel");
const giveMeOrHimHeader = document.getElementById("giveMeOrHimHeaderActions");
const giveMeOrHimHelpButton = document.getElementById("giveMeOrHimHelpBtn");
const giveMeOrHimExplainButton = document.getElementById("giveMeOrHimExplainBtn");

const GIVE_ME_OR_HIM_HELP_CONFIG = {
  gameId: "give_me_or_him",
  title: { zh: "给我！还是他？", en: "Give Me! Or Him?" },
  basic: {
    win: {
      zh: "这是一个全队合作的游戏，只要在三个金色问号(❓)全部碎掉之前让每个人都猜出自己的词，全队就一起获胜。",
      en: "This is a fully cooperative game. If everybody guesses their own word before the three golden question marks (❓) are all shattered, the whole team wins together."
    },
    turn: {
      zh: "轮到你时只能二选一，要么打出一张提示卡(🃏)给卡背编号对应的人写一个提示词(✍️)，要么拿一个金色问号(❓)点名任意一人立刻猜词。",
      en: "On your turn you do exactly one of two things. Either you play a hint card (🃏) and write a hint (✍️) for the player whose number is printed on its back, or you take a golden question mark (❓) and name any one player to guess right now."
    },
    key: {
      zh: "你的词就插在面前的立牌上，所有人都看得见，只有你自己看不见，所以真正的玩法是从桌上一堆匿名提示里推理出哪几条是给你的。",
      en: "Your word sits on the stand in front of you where the whole table can read it and you cannot, so the real game is working out which of the anonymous hints on the table were meant for you."
    }
  },
  sections: [
    {
      id: "setup",
      label: { zh: "开局", en: "Setup" },
      html: {
        zh: "<p>每位玩家拿到一块编号立牌(🔢)，编号按座位顺序从 1 开始。</p>"
          + "<p>每人随机抽一张词语卡插在自己的立牌上，卡面朝向其他人，背朝自己，所以你永远看不到自己的词。</p>"
          + "<p>提示卡(🃏)的背面印着玩家编号，每个编号各有 3 张。开局洗匀之后全部发完，每人 3 张，打出之后不再补牌。</p>"
          + "<p>桌子中央摆好 3 个金色问号(❓)，这是全队共享的容错次数。</p>",
        en: "<p>Every player takes a numbered stand (🔢), numbered from 1 in seating order.</p>"
          + "<p>Each player draws a word card at random and slots it into their own stand facing outwards, so you can never see your own word.</p>"
          + "<p>The back of a hint card (🃏) carries a player number and there are three cards per number. The whole deck is dealt out at setup, three cards each, and hands are never refilled.</p>"
          + "<p>Three golden question marks (❓) sit in the middle of the table as the team's shared margin for error.</p>"
      }
    },
    {
      id: "turn",
      label: { zh: "回合行动", en: "Your turn" },
      html: {
        zh: "<p><strong>行动一，写一个提示(✍️)：</strong>打出一张手牌，卡背的编号决定这张牌写给谁。写好之后牌面朝上摊在桌子中央，提示词所有人都看得见，但写给谁始终保密。</p>"
          + "<p>如果卡背的编号正好是你自己，或者那位玩家已经通关，这张牌就变成万能提示卡，可以写给任意一位还没通关的玩家。</p>"
          + "<p><strong>行动二，点名猜词(❓)：</strong>从中央拿一个金色问号放到任意一位还没通关的玩家面前，也可以放给自己，那个人必须立刻根据桌上的全部提示猜出自己的词。</p>"
          + "<p>行动结束后轮到下一位玩家，已经通关的玩家依然正常轮到自己，可以继续写提示，也可以点名让别人猜。</p>",
        en: "<p><strong>Action one, write a hint (✍️):</strong> play a card from your hand and the number on its back decides who it is for. The card goes face up into the middle of the table so everybody reads the hint, while who it was meant for stays secret.</p>"
          + "<p>If the number on the back is your own, or if that player has already guessed their word, the card becomes wild and may be aimed at any player who is still guessing.</p>"
          + "<p><strong>Action two, name a guesser (❓):</strong> take a golden question mark and put it in front of any player who has not guessed yet, yourself included, and that player must immediately guess their word from the hints on the table.</p>"
          + "<p>Play then passes to the next seat. Players who already guessed still take normal turns and may keep writing hints or naming others.</p>"
      }
    },
    {
      id: "hints",
      label: { zh: "提示的禁忌", en: "Hint rules" },
      html: {
        zh: "<p>写提示时有五条禁忌：不能交流提示卡是给谁的，不能用高关联词也就是近义词提示，不能用符号提示，不能用外语单词提示，不能用场上可见字提示。</p>"
          + "<p>线上版会自动拦下其中能机器判定的部分：提示词不能为空或只用符号，不能等于场上任何一位玩家的词，不能含有场上任何词语里出现过的字，也不能和桌上已有的提示词重复。</p>"
          + "<p>近义词和口头交流这两条没法由服务器判断，仍然要靠玩家自觉。</p>",
        en: "<p>Five things are forbidden in a hint. You may not discuss who a card is for, you may not use a close synonym, you may not use symbols, you may not use a foreign word, and you may not reuse a character that is visible on the table.</p>"
          + "<p>The online build enforces the machine-checkable half of that list. A hint cannot be empty or pure symbols, cannot equal any player's word, cannot contain a character that appears in any word on the table, and cannot repeat a hint already lying on the table.</p>"
          + "<p>Synonyms and spoken table talk cannot be judged by the server and still rely on the players themselves.</p>"
      }
    },
    {
      id: "guess",
      label: { zh: "猜词与胜负", en: "Guessing and winning" },
      html: {
        zh: "<p>猜对就把立牌翻到打勾(✔)那一面，金色问号(❓)回到桌子中央，可以再次使用。</p>"
          + "<p>猜错则永久碎掉一个金色问号(❓)，这位玩家还没有通关，之后仍然会收到提示，也仍然会被点名。</p>"
          + "<p>每次猜词结算之后会暂停，所有人按下 Continue 才继续下一位玩家的回合。</p>"
          + "<p>所有人都猜出自己的词，全队获胜(🏆)。三个金色问号全部碎掉而还有人没猜出来，则挑战失败。</p>",
        en: "<p>A correct guess flips your stand to the tick (✔) side and the golden question mark (❓) returns to the middle of the table to be used again.</p>"
          + "<p>A wrong guess shatters one golden question mark (❓) for good. That player is not through yet, still collects hints, and can still be named again.</p>"
          + "<p>Every guess is followed by a pause, and play only continues once everybody has pressed Continue.</p>"
          + "<p>When every player has guessed their word the team wins (🏆). If all three golden question marks shatter while somebody is still guessing, the challenge is lost.</p>"
      }
    },
    {
      id: "online",
      label: { zh: "线上操作", en: "Playing online" },
      html: {
        zh: "<p>轮到你时点一张手牌，卡片上会盖上一层蒙版，在蒙版里填好提示词(✍️)并确认即可打出，万能提示卡还要先选一位接收者。点击面板空白处可以取消选择。</p>"
          + "<p>点名猜词时先点托盘里的按钮，再点要指名的玩家卡片，卡片上的蒙版会请你确认。</p>"
          + "<p>轮到你猜词时会弹出一个对话框，里面会重新列出桌面上的全部提示。按 Dock 可以把它收成一条横幅，方便你边看牌桌边想，随时点横幅就能展开，Esc 同样可以收起。</p>"
          + "<p>按 Explain 之后再点任意控件可以查看它的说明，Explain 模式下不会执行任何游戏操作，再按一次 Explain 或按 Esc 退出。</p>",
        en: "<p>On your turn tap a card in your hand and a layer slides over it. Type the hint (✍️) inside that layer and confirm to play it, and a wild card also asks you to pick a receiver first. Tapping empty space cancels the selection.</p>"
          + "<p>To name a guesser, press the button in the tray first and then tap that player's card, and the layer over the card asks you to confirm.</p>"
          + "<p>When it is your turn to guess a dialog opens and repeats every hint on the table. Press Dock to collapse it into a banner so you can study the board while you think, tap the banner to bring it back, and Esc collapses it as well.</p>"
          + "<p>Press Explain and then any control to read its description. Explain never performs a game action, and a second press or Esc leaves the mode.</p>"
      }
    }
  ]
};

const GIVE_ME_OR_HIM_EXPLAIN = {
  lives: {
    zh: "金色问号(❓)是全队共享的容错次数，开局 3 个。猜对会把它放回中央继续用，猜错则永久碎掉一个。",
    en: "The golden question marks (❓) are the team's shared margin for error, three at the start. A correct guess returns one to the middle, a wrong guess shatters one for good."
  },
  stage: {
    zh: "当前阶段与轮到谁。写提示和点名猜词都只在轮到你时出现。",
    en: "The current stage and whose turn it is. Writing a hint and naming a guesser only appear on your own turn."
  },
  banner: {
    zh: "结算与胜负提示。猜词结束后所有人按下 Continue 才会继续。",
    en: "Result and outcome messages. After a guess everybody presses Continue before play resumes."
  },
  board: {
    zh: "每位玩家的立牌。编号(🔢)就是提示卡背面印的数字，词位对别人显示词语、对你自己显示问号，通关后翻成打勾(✔)并公开词语。",
    en: "One stand per player. The number (🔢) is what the back of a hint card prints, the word slot shows the word to everyone else and a question mark to its owner, and a solved stand flips to the tick (✔) and reveals the word."
  },
  seat: {
    zh: "一位玩家的立牌。点它可以在点名猜词时选中这个人。",
    en: "One player's stand. Tap it to pick this player when you are naming a guesser."
  },
  word: {
    zh: "这位玩家的词语卡。卡面朝向其他人，所以只有词的主人自己看不到。",
    en: "This player's word card. It faces outwards, so only its owner cannot read it."
  },
  table: {
    zh: "桌面中央的提示区。每条提示都写明了是谁写的，但永远不会显示写给谁，这正是推理的原料。",
    en: "The hints lying in the middle of the table. Each one names its author and never names its target, which is exactly the material you reason from."
  },
  tray: {
    zh: "手牌与行动区。轮到你时这里会出现提示卡和点名猜词的按钮。",
    en: "Your hand and your actions. On your turn the hint cards and the name-a-guesser button appear here."
  },
  hand_card: {
    zh: "一张提示卡。背面的编号决定它必须写给谁，如果那个编号是你自己或者对方已经通关，它就是万能提示卡。",
    en: "A hint card. The number on its back decides who it must be written for, and it becomes wild when that number is your own or that player has already guessed."
  },
  call: {
    zh: "点名猜词。选它之后再点一位还没通关的玩家，那个人必须立刻猜词。",
    en: "Name a guesser. Pick it and then tap a player who has not guessed yet, and that player must guess immediately."
  },
  guess_dialog: {
    zh: "轮到你猜词。桌面上所有提示都列在这里，填入你认为自己头上的那个词。",
    en: "It is your turn to guess. Every hint on the table is listed here, and you type the word you believe is on your own head."
  },
  continue: {
    zh: "结算暂停。所有人按下 Continue 之后才会进入下一位玩家的回合。",
    en: "The result pause. Play only moves to the next player once everybody has pressed Continue."
  },
  log: {
    zh: "行动日志，记录每一次打出的提示、点名与猜词结果。",
    en: "The action log, listing every hint played, every player named and every guess result."
  }
};

let giveMeOrHimHelpWidget = null;
let giveMeOrHimExplainWidget = null;
let gmohView = null;
let gmohSelectedCard = null;
let gmohHintTarget = null;
let gmohHintText = "";
let gmohCalling = false;
let gmohPending = false;
let gmohPendingTimer = null;
let gmohSignature = null;
let gmohDocked = false;
let gmohTipTimer = null;
let gmohLastPointerType = "mouse";

const gmohEsc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
));

function gmohMe() {
  return gmohView?.players.find((player) => player.player_id === gmohView.you) || null;
}

function gmohPlayer(id) {
  return gmohView?.players.find((player) => player.player_id === id) || null;
}

function gmohName(id) {
  return gmohPlayer(id)?.name || "—";
}

function gmohLegal(action) {
  return !gmohPending && !!gmohView?.legal_actions?.includes(action);
}

function gmohEligibleTargets() {
  return (gmohView?.players || []).filter((player) => !player.solved);
}

function initGiveMeOrHimHelpExplain() {
  if (giveMeOrHimHelpWidget || typeof window.obgCreateHelp !== "function") return;
  giveMeOrHimHelpWidget = window.obgCreateHelp(GIVE_ME_OR_HIM_HELP_CONFIG);
  giveMeOrHimExplainWidget = window.obgCreateExplain({
    gameId: "give_me_or_him",
    attribute: "data-gmoh-explain",
    explanations: GIVE_ME_OR_HIM_EXPLAIN,
    button: giveMeOrHimExplainButton,
    root: () => document.getElementById("giveMeOrHimPanel"),
    bypass: ["#giveMeOrHimHelpBtn", "#giveMeOrHimExplainBtn", "#giveMeOrHimGuessDialog"]
  });
}

function gmohHideTip() {
  const tip = document.getElementById("giveMeOrHimTip");
  if (tip) tip.hidden = true;
  window.clearTimeout(gmohTipTimer);
}

function gmohShowTip(text, anchor, touch) {
  if (!text || giveMeOrHimExplainWidget?.isActive()) return;
  let tip = document.getElementById("giveMeOrHimTip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "giveMeOrHimTip";
    tip.className = "gmoh-tip";
    tip.setAttribute("role", "status");
    document.body.append(tip);
  }
  window.clearTimeout(gmohTipTimer);
  tip.textContent = text;
  tip.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const bounds = tip.getBoundingClientRect();
  const x = touch ? (window.innerWidth - bounds.width) / 2 : rect.left;
  const y = rect.top > bounds.height + 16 ? rect.top - bounds.height - 8 : rect.bottom + 8;
  tip.style.left = Math.max(12, Math.min(window.innerWidth - bounds.width - 12, x)) + "px";
  tip.style.top = Math.max(12, Math.min(window.innerHeight - bounds.height - 12, y)) + "px";
  if (touch) gmohTipTimer = window.setTimeout(gmohHideTip, 3000);
}

function gmohSend(action) {
  if (gmohPending) return;
  gmohPending = true;
  window.clearTimeout(gmohPendingTimer);
  gmohPendingTimer = window.setTimeout(() => { gmohPending = false; gmohRender(); }, 8000);
  if (typeof sendAction === "function") sendAction(action);
  gmohSelectedCard = null;
  gmohHintTarget = null;
  gmohCalling = false;
  gmohRender();
}

function gmohCancelSelection() {
  if (!gmohSelectedCard && !gmohCalling) return;
  gmohSelectedCard = null;
  gmohHintTarget = null;
  gmohHintText = "";
  gmohCalling = false;
  gmohRender();
}

function gmohStageLine() {
  if (!gmohView) return "";
  if (gmohView.game_over) return gmohView.outcome === "win" ? "🏆 全队获胜" : "💔 挑战失败";
  if (gmohView.stage === "guessing") {
    return gmohView.guesser === gmohView.you ? "轮到你猜词" : "等待 " + gmohName(gmohView.guesser) + " 猜词";
  }
  if (gmohView.stage === "reveal") return "结算 · 等待所有人 Continue";
  return gmohView.current_player === gmohView.you ? "轮到你行动" : "等待 " + gmohName(gmohView.current_player);
}

function gmohSeatHTML(player) {
  const isMe = player.player_id === gmohView.you;
  const eligible = gmohCalling && gmohLegal("call_guess") && !player.solved;
  const chosen = gmohCalling && gmohHintTarget === player.player_id;
  const word = player.word
    ? '<span class="gmoh-word">' + gmohEsc(player.word) + "</span>"
    : '<span class="gmoh-word is-hidden">❓</span>';
  const mask = chosen
    ? '<div class="gmoh-mask"><button type="button" data-gmoh-call="' + gmohEsc(player.player_id) + '">让他猜</button>'
      + '<button type="button" data-gmoh-cancel="1">取消</button></div>'
    : "";
  return '<section class="gmoh-seat' + (isMe ? " is-me" : "") + (player.solved ? " is-solved" : "")
    + (eligible ? " is-target" : "") + (chosen ? " is-chosen" : "") + '"'
    + ' data-gmoh-seat="' + gmohEsc(player.player_id) + '"'
    + ' data-gmoh-tip="' + gmohEsc(GIVE_ME_OR_HIM_EXPLAIN.seat.zh) + '">'
    + '<header class="gmoh-seat-head"><span class="gmoh-number">🔢 ' + player.number + "</span>"
    + '<span class="gmoh-seat-name">' + gmohEsc(player.name) + (isMe ? " · 你" : "") + "</span>"
    + '<span class="gmoh-seat-state">' + (player.solved ? "✔" : "🃏 " + player.hand_count) + "</span></header>"
    + '<div class="gmoh-seat-word" data-gmoh-tip="' + gmohEsc(GIVE_ME_OR_HIM_EXPLAIN.word.zh) + '">' + word + "</div>"
    + '<div class="gmoh-seat-meta"><span>✍️ ' + player.hints + "</span>"
    + (player.wrong.length ? '<span class="gmoh-wrong">✘ ' + gmohEsc(player.wrong.join(" / ")) + "</span>" : "")
    + (player.ready ? '<span class="gmoh-ready">✅</span>' : "") + "</div>" + mask + "</section>";
}

function gmohTableHTML() {
  if (!gmohView.table.length) {
    return '<div class="gmoh-table-empty">桌面中央还没有提示，先打出第一张提示卡(🃏)吧。</div>';
  }
  return gmohView.table.map((entry) => (
    '<div class="gmoh-hint"><span class="gmoh-hint-text">' + gmohEsc(entry.text) + "</span>"
    + '<span class="gmoh-hint-by">' + gmohEsc(gmohName(entry.by)) + "</span></div>"
  )).join("");
}

function gmohHandCardHTML(card) {
  const selected = gmohSelectedCard === card.id;
  const label = card.wild ? "万能 · 任意未通关玩家" : "写给 " + gmohEsc(card.target_name || "");
  let mask = "";
  if (selected) {
    const options = gmohEligibleTargets().map((player) => (
      '<button type="button" class="gmoh-chip-btn' + (gmohHintTarget === player.player_id ? " is-on" : "")
      + '" data-gmoh-target="' + gmohEsc(player.player_id) + '">' + gmohEsc(player.name) + "</button>"
    )).join("");
    mask = '<div class="gmoh-mask is-form">'
      + (card.wild ? '<div class="gmoh-mask-row">' + options + "</div>" : "")
      + '<input class="gmoh-hint-input" id="giveMeOrHimHintInput" type="text" maxlength="12" autocomplete="off" placeholder="提示词" aria-label="提示词" value="' + gmohEsc(gmohHintText) + '">'
      + '<div class="gmoh-mask-row"><button type="button" data-gmoh-play="1">打出提示</button>'
      + '<button type="button" data-gmoh-cancel="1">取消</button></div></div>';
  }
  return '<div class="gmoh-card' + (selected ? " is-selected" : "") + (card.wild ? " is-wild" : "") + '"'
    + ' data-gmoh-card="' + gmohEsc(card.id) + '"'
    + ' data-gmoh-tip="' + gmohEsc(GIVE_ME_OR_HIM_EXPLAIN.hand_card.zh) + '">'
    + '<span class="gmoh-card-number">' + card.number + "</span>"
    + '<span class="gmoh-card-label">' + label + "</span>" + mask + "</div>";
}

function gmohTrayHTML() {
  if (gmohView.game_over) {
    const ready = gmohView.rematch_ready.includes(gmohView.you);
    return '<div class="gmoh-tray-head">' + (gmohView.outcome === "win" ? "🏆 全队获胜" : "💔 挑战失败") + "</div>"
      + '<div class="gmoh-final">' + gmohView.players.map((player) => (
        '<div class="gmoh-final-row"><span>' + gmohEsc(player.name) + '</span><span class="gmoh-final-word">'
        + gmohEsc(player.word || "—") + "</span><span>" + (player.solved ? "✔" : "✘") + "</span></div>"
      )).join("") + "</div>"
      + '<div class="gmoh-actions"><button type="button" data-gmoh-again="1"' + (ready ? " disabled" : "") + ">"
      + (ready ? "等待其他玩家" : "Play Again") + "</button></div>";
  }
  if (gmohView.stage === "reveal") {
    const ready = gmohView.continue_ready.includes(gmohView.you);
    const result = gmohView.result;
    const head = result
      ? (result.correct
        ? "✔ " + gmohEsc(gmohName(result.player_id)) + " 猜对了，答案是「" + gmohEsc(result.word) + "」"
        : "✘ " + gmohEsc(gmohName(result.player_id)) + " 猜「" + gmohEsc(result.text) + "」猜错了，碎掉一个金色问号")
      : "结算";
    return '<div class="gmoh-tray-head">' + head + "</div>"
      + '<div class="gmoh-actions"><button type="button" data-gmoh-continue="1"'
      + ' data-gmoh-explain="' + gmohEsc(GIVE_ME_OR_HIM_EXPLAIN.continue.zh) + '"' + (ready ? " disabled" : "") + ">"
      + (ready ? "等待其他玩家" : "Continue") + "</button></div>";
  }
  if (gmohView.stage === "guessing") {
    if (gmohView.guesser === gmohView.you) {
      return '<div class="gmoh-tray-head">' + (gmohDocked ? "轮到你猜词" : "猜词窗口已打开") + "</div>"
        + '<div class="gmoh-actions"><button type="button" data-gmoh-open="1">'
        + (gmohDocked ? "展开猜词窗口" : "重新打开猜词窗口") + "</button></div>";
    }
    return '<div class="gmoh-tray-head">等待 ' + gmohEsc(gmohName(gmohView.guesser)) + " 猜词</div>";
  }
  if (gmohView.current_player !== gmohView.you) {
    return '<div class="gmoh-tray-head">等待 ' + gmohEsc(gmohName(gmohView.current_player)) + " 行动</div>";
  }
  return '<div class="gmoh-tray-head">' + (gmohCalling ? "点一位还没通关的玩家，把金色问号给他" : "打出一张提示卡(🃏)，或者点名猜词(❓)") + "</div>"
    + '<div class="gmoh-hand">' + gmohView.hand.map(gmohHandCardHTML).join("") + "</div>"
    + '<div class="gmoh-actions">'
    + (gmohCalling
      ? '<button type="button" data-gmoh-cancel="1">取消点名</button>'
      : '<button type="button" data-gmoh-calling="1" data-gmoh-explain="' + gmohEsc(GIVE_ME_OR_HIM_EXPLAIN.call.zh) + '">'
        + "点名猜词(❓)</button>")
    + "</div>";
}

function gmohBannerHTML() {
  if (!gmohView) return "";
  if (gmohView.game_over) return "";
  if (gmohView.stage === "guessing" && gmohView.guesser !== gmohView.you) {
    return "❓ " + gmohEsc(gmohName(gmohView.caller)) + " 把金色问号交给了 " + gmohEsc(gmohName(gmohView.guesser));
  }
  return "";
}

function gmohRender() {
  if (!giveMeOrHimPanel) return;
  if (!gmohView) { giveMeOrHimPanel.innerHTML = ""; return; }
  const lives = "❓".repeat(gmohView.lives) + "·".repeat(Math.max(0, gmohView.lives_max - gmohView.lives));
  const stage = document.getElementById("giveMeOrHimStage");
  if (stage) stage.textContent = gmohStageLine();
  const livesEl = document.getElementById("giveMeOrHimLives");
  if (livesEl) livesEl.textContent = lives;
  const banner = document.getElementById("giveMeOrHimBanner");
  if (banner) banner.innerHTML = gmohBannerHTML();
  const board = document.getElementById("giveMeOrHimBoard");
  if (board) board.innerHTML = gmohView.players.map(gmohSeatHTML).join("");
  const table = document.getElementById("giveMeOrHimTable");
  if (table) table.innerHTML = gmohTableHTML();
  const tray = document.getElementById("giveMeOrHimTray");
  if (tray) tray.innerHTML = gmohTrayHTML();
  const log = document.getElementById("giveMeOrHimLog");
  if (log) log.innerHTML = gmohView.log.slice(-30).map((line) => "<div>" + gmohEsc(line) + "</div>").join("");
  gmohSyncGuessDialog();
}

function gmohSyncGuessDialog() {
  const dialog = document.getElementById("giveMeOrHimGuessDialog");
  if (!dialog || !gmohView) return;
  const mine = gmohView.stage === "guessing" && gmohView.guesser === gmohView.you;
  if (!mine) {
    gmohDocked = false;
    if (dialog.open) dialog.close();
    return;
  }
  const hints = document.getElementById("giveMeOrHimGuessHints");
  if (hints) {
    hints.innerHTML = gmohView.table.length
      ? gmohView.table.map((entry) => (
        '<span class="gmoh-hint-pill">' + gmohEsc(entry.text)
        + '<small>' + gmohEsc(gmohName(entry.by)) + "</small></span>"
      )).join("")
      : '<span class="gmoh-hint-pill is-empty">桌面上还没有提示</span>';
  }
  const note = document.getElementById("giveMeOrHimGuessHint");
  if (note) note.textContent = "❓ " + gmohName(gmohView.caller) + " 点名你猜词。哪几条提示是给你的？";
  if (!gmohDocked && !dialog.open) {
    dialog.showModal();
    const input = document.getElementById("giveMeOrHimGuessInput");
    if (input) { input.value = ""; input.focus(); }
  }
}

function initGiveMeOrHimDialogs() {
  const dialog = document.getElementById("giveMeOrHimGuessDialog");
  if (!dialog || dialog.dataset.gmohReady === "1") return;
  dialog.dataset.gmohReady = "1";
  const form = document.getElementById("giveMeOrHimGuessForm");
  const dock = document.getElementById("giveMeOrHimGuessDock");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("giveMeOrHimGuessInput");
    const text = (input?.value || "").trim();
    if (!text || !gmohLegal("guess")) return;
    gmohDocked = false;
    dialog.close();
    gmohSend({ type: "guess", turn: gmohView.turn, text });
  });
  dock?.addEventListener("click", () => {
    gmohDocked = true;
    dialog.close();
    gmohRender();
  });
  dialog.addEventListener("close", () => {
    if (gmohView?.stage === "guessing" && gmohView.guesser === gmohView.you) {
      gmohDocked = true;
      gmohRender();
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      gmohDocked = true;
      dialog.close();
      gmohRender();
    }
  });
}

function gmohBindPanel() {
  if (!giveMeOrHimPanel || giveMeOrHimPanel.dataset.gmohBound === "1") return;
  giveMeOrHimPanel.dataset.gmohBound = "1";

  giveMeOrHimPanel.addEventListener("click", (event) => {
    if (giveMeOrHimExplainWidget?.isActive()) return;
    if (!gmohView) return;
    const cancel = event.target.closest("[data-gmoh-cancel]");
    if (cancel) { gmohCancelSelection(); return; }
    const play = event.target.closest("[data-gmoh-play]");
    if (play && gmohSelectedCard && gmohLegal("give_hint")) {
      const input = document.getElementById("giveMeOrHimHintInput");
      const text = (input?.value ?? gmohHintText).trim();
      const card = gmohView.hand.find((entry) => entry.id === gmohSelectedCard);
      const target = card?.wild ? gmohHintTarget : card?.target;
      if (!text || !target) { input?.focus(); return; }
      gmohHintText = "";
      gmohSend({ type: "give_hint", turn: gmohView.turn, card: gmohSelectedCard, target, text });
      return;
    }
    const target = event.target.closest("[data-gmoh-target]");
    if (target) { gmohHintTarget = target.getAttribute("data-gmoh-target"); gmohRender(); return; }
    const call = event.target.closest("[data-gmoh-call]");
    if (call && gmohLegal("call_guess")) {
      gmohSend({ type: "call_guess", turn: gmohView.turn, target: call.getAttribute("data-gmoh-call") });
      return;
    }
    const card = event.target.closest("[data-gmoh-card]");
    if (card && gmohLegal("give_hint")) {
      const id = card.getAttribute("data-gmoh-card");
      gmohSelectedCard = gmohSelectedCard === id ? null : id;
      gmohHintTarget = null;
      gmohCalling = false;
      gmohRender();
      const input = document.getElementById("giveMeOrHimHintInput");
      if (input) input.focus();
      return;
    }
    if (event.target.closest("[data-gmoh-calling]") && gmohLegal("call_guess")) {
      gmohCalling = true;
      gmohSelectedCard = null;
      gmohRender();
      return;
    }
    const seat = event.target.closest("[data-gmoh-seat]");
    if (seat && gmohCalling && gmohLegal("call_guess")) {
      const player = gmohPlayer(seat.getAttribute("data-gmoh-seat"));
      if (player && !player.solved) {
        gmohHintTarget = gmohHintTarget === player.player_id ? null : player.player_id;
        gmohRender();
      }
      return;
    }
    if (event.target.closest("[data-gmoh-continue]") && gmohLegal("continue")) {
      gmohSend({ type: "continue", turn: gmohView.turn });
      return;
    }
    if (event.target.closest("[data-gmoh-again]") && gmohLegal("play_again")) {
      gmohSend({ type: "play_again" });
      return;
    }
    if (event.target.closest("[data-gmoh-open]")) {
      gmohDocked = false;
      gmohSyncGuessDialog();
      return;
    }
    if (!event.target.closest(".gmoh-card, .gmoh-seat, .gmoh-actions, button, input")) gmohCancelSelection();
  });

  // Keep the half-typed hint across re-renders: picking a receiver or an
  // incoming state update must never wipe what the player already wrote.
  giveMeOrHimPanel.addEventListener("input", (event) => {
    if (event.target.id === "giveMeOrHimHintInput") gmohHintText = event.target.value;
  });

  giveMeOrHimPanel.addEventListener("pointerdown", (event) => {
    gmohLastPointerType = event.pointerType || "mouse";
    const anchor = event.target.closest("[data-gmoh-tip]");
    if (anchor && gmohLastPointerType !== "mouse") gmohShowTip(anchor.getAttribute("data-gmoh-tip"), anchor, true);
  }, true);
  giveMeOrHimPanel.addEventListener("pointerover", (event) => {
    if (gmohLastPointerType !== "mouse") return;
    const anchor = event.target.closest("[data-gmoh-tip]");
    if (anchor) gmohShowTip(anchor.getAttribute("data-gmoh-tip"), anchor, false);
  });
  giveMeOrHimPanel.addEventListener("pointerout", (event) => {
    if (gmohLastPointerType === "mouse" && event.target.closest("[data-gmoh-tip]")) gmohHideTip();
  });
}

function clearGiveMeOrHimState() {
  gmohView = null;
  gmohSelectedCard = null;
  gmohHintTarget = null;
  gmohHintText = "";
  gmohCalling = false;
  gmohPending = false;
  gmohDocked = false;
  gmohSignature = null;
  window.clearTimeout(gmohPendingTimer);
  gmohHideTip();
  const dialog = document.getElementById("giveMeOrHimGuessDialog");
  if (dialog?.open) dialog.close();
  if (giveMeOrHimPanel) giveMeOrHimPanel.innerHTML = "";
}

window.renderGiveMeOrHimGameState = (data) => {
  const next = data?.view || data;
  if (!next?.players || next.game_id !== "give_me_or_him") return;
  const signature = JSON.stringify([data?.room_id, next.turn, next.stage, next.current_player, next.guesser]);
  if (signature !== gmohSignature) {
    gmohSelectedCard = null;
    gmohHintTarget = null;
    gmohHintText = "";
    gmohCalling = false;
    gmohPending = false;
    gmohHideTip();
    window.clearTimeout(gmohPendingTimer);
    if (next.stage !== "guessing") gmohDocked = false;
  }
  gmohSignature = signature;
  gmohView = next;
  initGiveMeOrHimHelpExplain();
  initGiveMeOrHimDialogs();
  gmohBindPanel();
  gmohRender();
};

window.showGiveMeOrHimHeaderActions = (visible) => {
  if (giveMeOrHimHeader) giveMeOrHimHeader.style.display = visible ? "flex" : "none";
  if (!visible) clearGiveMeOrHimState();
};
window.clearGiveMeOrHimState = clearGiveMeOrHimState;

giveMeOrHimHelpButton?.addEventListener("click", () => {
  initGiveMeOrHimHelpExplain();
  giveMeOrHimHelpWidget?.open();
});
giveMeOrHimExplainButton?.addEventListener("click", () => {
  initGiveMeOrHimHelpExplain();
  giveMeOrHimExplainWidget?.toggle();
});

document.addEventListener("keydown", (event) => {
  if (!gmohView || event.key !== "Escape") return;
  const dialog = document.getElementById("giveMeOrHimGuessDialog");
  if (dialog?.open) return;
  if (giveMeOrHimExplainWidget?.isActive()) return;
  gmohHideTip();
  gmohCancelSelection();
}, true);
window.addEventListener("resize", gmohHideTip);
window.addEventListener("blur", gmohHideTip);
document.addEventListener("scroll", gmohHideTip, true);

function connectGiveMeOrHimEvents() {
  if (typeof socket === "undefined") return;
  socket.on("system:error", () => {
    if (gmohPending) {
      gmohPending = false;
      window.clearTimeout(gmohPendingTimer);
      gmohRender();
    }
  });
  if (typeof currentRoomState !== "undefined" && currentRoomState) {
    window.renderGiveMeOrHimGameState(currentRoomState);
  }
}
if (document.readyState === "loading" || typeof socket === "undefined") {
  window.addEventListener("DOMContentLoaded", connectGiveMeOrHimEvents, { once: true });
} else {
  connectGiveMeOrHimEvents();
}
