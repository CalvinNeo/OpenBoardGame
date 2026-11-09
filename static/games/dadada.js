// 哒哒哒 / DADADA — browser client.
// Help & Explain follow designs/task40.md via the shared widgets.
// Rules: designs/task192.md

const dadadaPanel = document.getElementById("dadadaPanel");
const dadadaHeader = document.getElementById("dadadaHeaderActions");
const dadadaHelpButton = document.getElementById("dadadaHelpBtn");
const dadadaExplainButton = document.getElementById("dadadaExplainBtn");

const DADADA_HELP_CONFIG = {
  gameId: "dadada",
  title: { zh: "哒哒哒", en: "DADADA" },
  basic: {
    win: {
      zh: "这是一个全队合作的游戏。你们先用几个音节造出一门只有你们懂的语言，再用这门语言把图卡说出来，全队猜对的次数越多越好，攒够两张Say What(🤔)就提前收工。",
      en: "This is a fully cooperative game. First you invent a language only your table speaks, then you use it to name picture cards, and the more rounds the team guesses right the better. Two Say What cards(🤔) end the game early."
    },
    turn: {
      zh: "造词期轮到你时，点一张图卡再点一个音节，把它归进那个音节名下，其他人用同意(👍)和不同意(👎)表态。试词期轮到的那个人悄悄挑一张图，只用这门语言说出它的名字，其他人各自点一张图指出自己猜的是哪张。",
      en: "During Creation your turn is to tap a picture and then a syllable to file it under that sound, and everyone else answers with agree(👍) or disagree(👎). During Communication the player on turn secretly picks a picture and names it using nothing but your new language, and everyone else taps the picture they think was meant."
    },
    key: {
      zh: "这门语言没有词典，音节的含义完全由你们当场约定，所以真正要赢的是让全桌对同一个音节的理解保持一致，而不是把词造得多漂亮。",
      en: "Your language has no dictionary, because what each syllable means is whatever the table agrees on right now, so winning is really about keeping everyone's understanding of a syllable aligned rather than about inventing elegant words."
    }
  },
  sections: [
    {
      id: "setup",
      label: { zh: "开局", en: "Setup" },
      html: {
        zh: "<p>牌堆有两副，一副是音节(🗣️)牌，每张只有一个没有意义的音节，例如PU、PEH、BONG，另一副是图卡(🃏)，画的都是看得见的具体东西。</p>"
          + "<p>开局洗匀音节牌并抽出五张，其中两张正面朝上进入语言区，剩下三张扣着当储备。音节最多只能翻到五张，翻完就没有了。</p>"
          + "<p>同时翻开十三张图卡摊在图卡池里，造词期要处理的就是这十三张。</p>",
        en: "<p>There are two decks. The sound(🗣️) deck holds single nonsense syllables such as PU, PEH and BONG, and the picture(🃏) deck holds concrete everyday things.</p>"
          + "<p>Shuffle the sound deck and deal five cards. Two start face up in the language area and the other three stay face down as the reserve. Five is the hard ceiling, so once every card is flipped there are no more.</p>"
          + "<p>Thirteen picture cards are laid out at the same time, and those thirteen are what Creation has to sort.</p>"
      }
    },
    {
      id: "create",
      label: { zh: "造词期", en: "Creation" },
      html: {
        zh: "<p>按座位顺时针轮流。轮到你时先点图卡池里的一张图，再点语言区的一个音节，就等于提议这张图归到这个音节名下。也可以点那张扣着的储备牌，这样会翻开一个全新音节并直接归给它。</p>"
          + "<p>提议之后其他人逐个表态。超过半数同意，这张图就正式归入该音节名下，轮到下一位。超过半数不同意，则由你重新提议一次。</p>"
          + "<p>同一张图连续两次提议都没通过，它就进入无名区，本局不再参与归类。十三张图全部处理完，造词期结束。</p>",
        en: "<p>Play passes clockwise. On your turn you tap a picture in the pool and then a syllable in the language area, which proposes filing that picture under that sound. You may instead tap the face down reserve card, which flips a brand new syllable and files the picture there straight away.</p>"
          + "<p>Everyone else then votes. If more than half agree, the picture officially joins that syllable and play passes on. If more than half disagree, you propose again for the same picture.</p>"
          + "<p>A picture that fails twice in a row drops into the unnamed area and never gets sorted this game. Creation ends once all thirteen pictures have been dealt with.</p>"
      }
    },
    {
      id: "speak",
      label: { zh: "试词期", en: "Communication" },
      html: {
        zh: "<p>每轮先从图卡堆翻出六张新图摊在桌面上，轮到的那个人是命名者。命名者悄悄选定其中一张作为目标，只有他自己知道是哪张。</p>"
          + "<p>然后他点击语言区的音节，把它们拼成一个词，最长五个音节，例如PU-PEH-PEH，说出来之后就再也不能改动。</p>"
          + "<p>其他人各自点一张自己认为的图。这一轮大家猜的图都不公开，避免互相抄答案。</p>",
        en: "<p>Each round flips six fresh pictures onto the table, and the player on turn is the communicator. The communicator quietly chooses one of them as the target and is the only person who knows which.</p>"
          + "<p>They then tap syllables in the language area to build a word of up to five sounds, for example PU-PEH-PEH, and once spoken the word can no longer change.</p>"
          + "<p>Everyone else taps the picture they believe was meant. Individual guesses stay hidden during the round so nobody can copy an answer.</p>"
      }
    },
    {
      id: "guess",
      label: { zh: "结算与胜负", en: "Scoring" },
      html: {
        zh: "<p>只有当票数最高的那张图唯一而且正是目标时才算猜对，命中就加一分并把这张图放进已理解(✅)堆。如果最高票并列，说明全桌根本没谈拢，这一轮直接算失败。</p>"
          + "<p>失败时目标图进入Say What(🤔)堆。攒到两张Say What(🤔)游戏立刻结束。</p>"
          + "<p>每位玩家都当过一次命名者之后游戏也会正常结束，结束后会完整展示你们的语言并给出评价。</p>",
        en: "<p>The round only counts when the single most voted picture really is the target. A hit scores a point and the picture joins the understood(✅) pile. A tied top vote means the table never agreed, and that round simply fails.</p>"
          + "<p>A failed round sends the target into the Say What(🤔) pile, and two Say What cards(🤔) end the game immediately.</p>"
          + "<p>The game also ends normally once every player has been communicator once, and the ending shows your whole language together with a rating.</p>"
      }
    },
    {
      id: "online",
      label: { zh: "线上操作", en: "Playing online" },
      html: {
        zh: "<p>语言区常驻在界面上方，每个音节下面列着已经归给它的图，这是你们随时可以回看的词典。</p>"
          + "<p>轮到你造词时，点了图卡之后语言区里所有音节都会亮起来，直接点其中一个即可提交提议，点击面板空白处取消选择。</p>"
          + "<p>轮到你命名时，先点六张候选图中的一张锁定目标，再点音节拼词，下方的说出按钮负责提交。</p>"
          + "<p>游戏中的图标和区域都可以解释。按Explain之后再点任意控件可以查看它的说明，Explain模式下不会执行任何游戏操作，再按一次Explain或按Esc退出。</p>",
        en: "<p>The language area stays pinned at the top and lists the pictures already filed under each syllable, which is the dictionary you keep coming back to.</p>"
          + "<p>On your Creation turn, tapping a picture lights up every syllable in the language area and tapping one of them submits the proposal. Tapping empty space cancels the selection.</p>"
          + "<p>When you are the communicator, tap one of the six candidates to lock your target, tap syllables to build the word, and the Speak button below submits it.</p>"
          + "<p>Every icon and area can explain itself. Press Explain and then any control to read its description, and Explain never performs a game action. A second press or Esc leaves the mode.</p>"
      }
    }
  ]
};

const DADADA_EXPLAIN = {
  stage: {
    zh: "当前阶段和轮到谁。造词期与试词期都由座位顺时针推进，只有轮到你时才出现可以点的操作。",
    en: "The current phase and whose turn it is. Creation and Communication both move clockwise, and controls only light up on your own turn."
  },
  round: {
    zh: "试词期的轮次(🔁)。每位玩家都当过一次命名者之后游戏就正常结束，所以总分母等于人数。",
    en: "The Communication round(🔁). The game ends normally once every player has been communicator once, so the total always equals the player count."
  },
  score: {
    zh: "全队猜对的次数(✅)。猜对一次加一分，分母是已经进行的轮数。",
    en: "How many rounds the team has read correctly(✅). Every hit scores one point against the number of rounds played so far."
  },
  say_what: {
    zh: "Say What(🤔)是失败计数。某一轮没猜对就把目标图放进来，攒到两张游戏立刻结束。",
    en: "Say What(🤔) counts your failures. A round nobody guessed right drops its target in here, and two of them end the game immediately."
  },
  banner: {
    zh: "当前最重要的一件事，例如谁正在提议归类、谁正在命名、大家猜得对不对。",
    en: "The single most important thing right now, such as who is proposing a grouping, who is naming a picture, and whether the table read it correctly."
  },
  language: {
    zh: "语言区(🗣️)。每个卡片是一个音节，下面列出已经归给它的图。这就是你们的词典，造词和试词全都围绕它进行。",
    en: "The language area(🗣️). Each card is one syllable and lists the pictures filed under it. This is your dictionary and both phases revolve around it."
  },
  sound: {
    zh: "一个音节。造词期点它可以把你选中的图归到它名下，试词期点它可以把音节加进正在拼的词里。",
    en: "One syllable. During Creation tapping it files your selected picture under it, and during Communication tapping it appends the syllable to the word you are building."
  },
  reserve: {
    zh: "扣着的储备音节。点它会翻开一个全新音节，最多只能翻到第五张，翻完就固定了。",
    en: "A face down reserve syllable. Tapping it flips a brand new sound into the language, and five is the hard ceiling."
  },
  stagearea: {
    zh: "主操作区。造词期显示待归类的图卡池，试词期显示六张候选图，结算时显示答案和所有人的选择。",
    en: "The main play area. It shows the unsorted picture pool during Creation, the six candidates during Communication, and the answer with everyone's picks at scoring time."
  },
  pool: {
    zh: "图卡池。造词期要把这十三张图逐一归到音节名下，已经归好的会自动离开这里。",
    en: "The picture pool. Creation works through all thirteen one at a time, and pictures move out as soon as they have a name."
  },
  tile: {
    zh: "一张图卡。造词期点它会选中它并点亮所有音节，试词期点它代表你的猜测或你选定的目标。",
    en: "One picture card. Tapping it during Creation selects it and lights up every syllable, and during Communication it marks your guess or your chosen target."
  },
  word: {
    zh: "命名者拼出的词。只能由语言区里已有的音节组成，最长五个，提交之后不能改。",
    en: "The word the communicator built. It may only use syllables that already exist in your language, tops out at five, and cannot change once submitted."
  },
  candidates: {
    zh: "这一轮的六张候选图(🃏)。命名者从中悄悄选定一张作为目标，其他人要从这六张里指出自己猜的是哪张。",
    en: "The six candidates(🃏) for this round. The communicator quietly picks one as the target and everyone else has to point at the one they think it is."
  },
  result: {
    zh: "本轮结算。命中要求票数最高的那张图唯一而且正是目标，并列最高票就算没谈拢。",
    en: "The round result. A hit needs a single top voted picture that really is the target, and a tied top vote counts as never agreeing."
  },
  recap: {
    zh: "终局复盘。完整展示你们这门语言的每个音节及其含义，以及最终的命中次数与评价。",
    en: "The closing recap. It lays out every syllable of the language you invented with its meaning, plus the final hit count and rating."
  },
  tray: {
    zh: "行动区。轮到你时这里会出现投票、拼词或者说出的按钮，轮不到你时这里显示正在等谁。",
    en: "Your action area. On your turn it holds the voting, word building or Speak buttons, and otherwise it says who the table is waiting for."
  },
  log: {
    zh: "行动日志，记录每一次归类提议、投票结果、说出的词和结算。",
    en: "The action log, listing every grouping proposal, vote result, spoken word and score."
  }
};

let dadadaHelpWidget = null;
let dadadaExplainWidget = null;
let dadaView = null;
let dadaSelected = null;
let dadaTarget = null;
let dadaWord = [];
let dadaPending = false;
let dadaPendingTimer = null;
let dadaSignature = null;
let dadaTipTimer = null;
let dadaLastPointerType = "mouse";

const dadaEsc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
));

function dadaName(id) {
  return dadaView?.players.find((player) => player.player_id === id)?.name || "—";
}

function dadaLegal(action) {
  return !dadaPending && !!dadaView?.legal_actions?.includes(action);
}

function dadaIsMyCreateTurn() {
  return dadaView?.stage === "create" && dadaView.current_player === dadaView.you && !dadaView.pending;
}

function dadaIsNaming() {
  return dadaView?.stage === "speak" && dadaView.communicator === dadaView.you;
}

function dadaArmed() {
  if (!dadaView) return false;
  if (dadaIsMyCreateTurn()) return !!dadaSelected;
  if (dadaIsNaming()) return dadaWord.length < dadaView.word_max;
  return false;
}

function dadaWordLabel(parts) {
  return parts.map((id) => dadaView?.sounds.find((s) => s.id === id)?.syllable || id).join("-");
}

function dadaRank(score, total) {
  if (!total) return "🗣️ 语言尚未诞生";
  const ratio = score / total;
  if (ratio >= 1) return "🏆 全员完全互相听懂";
  if (ratio >= 0.75) return "🌟 这门语言相当可靠";
  if (ratio >= 0.5) return "👍 大半能沟通";
  if (ratio > 0) return "🤏 勉强能猜到一点";
  return "🤔 各说各话";
}

function initDadadaHelpExplain() {
  if (dadadaHelpWidget || typeof window.obgCreateHelp !== "function") return;
  dadadaHelpWidget = window.obgCreateHelp(DADADA_HELP_CONFIG);
  dadadaExplainWidget = window.obgCreateExplain({
    gameId: "dadada",
    attribute: "data-dada-explain",
    explanations: DADADA_EXPLAIN,
    button: dadadaExplainButton,
    root: () => document.getElementById("dadadaPanel"),
    bypass: ["#dadadaHelpBtn", "#dadadaExplainBtn"]
  });
}

/* --- Floating tips ----------------------------------------------------- */

function dadaHideTip() {
  const tip = document.getElementById("dadadaTip");
  if (tip) tip.hidden = true;
  window.clearTimeout(dadaTipTimer);
}

function dadaShowTip(text, anchor, touch) {
  if (!text || dadadaExplainWidget?.isActive()) return;
  let tip = document.getElementById("dadadaTip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "dadadaTip";
    tip.className = "dada-tip";
    tip.setAttribute("role", "status");
    document.body.append(tip);
  }
  window.clearTimeout(dadaTipTimer);
  tip.textContent = text;
  tip.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const bounds = tip.getBoundingClientRect();
  const x = touch ? (window.innerWidth - bounds.width) / 2 : rect.left;
  const y = rect.top > bounds.height + 16 ? rect.top - bounds.height - 8 : rect.bottom + 8;
  tip.style.left = Math.max(12, Math.min(window.innerWidth - bounds.width - 12, x)) + "px";
  tip.style.top = Math.max(12, Math.min(window.innerHeight - bounds.height - 12, y)) + "px";
  if (touch) dadaTipTimer = window.setTimeout(dadaHideTip, 3000);
}

function dadaTip(key) {
  return dadaEsc(DADADA_EXPLAIN[key]?.zh || "");
}

function dadaSend(action) {
  if (dadaPending) return;
  dadaPending = true;
  window.clearTimeout(dadaPendingTimer);
  dadaPendingTimer = window.setTimeout(() => { dadaPending = false; dadaRender(); }, 8000);
  if (typeof sendAction === "function") sendAction(action);
  dadaSelected = null;
  dadaTarget = null;
  dadaWord = [];
  dadaRender();
}

function dadaCancelSelection() {
  if (!dadaSelected && !dadaTarget && !dadaWord.length) return;
  dadaSelected = null;
  dadaTarget = null;
  dadaWord = [];
  dadaRender();
}

/* --- Rendering ---------------------------------------------------------- */

function dadaTileHTML(picture, options = {}) {
  const classes = ["dada-tile"];
  if (options.selected) classes.push("is-selected");
  if (options.pending) classes.push("is-pending");
  if (options.target) classes.push("is-target");
  if (options.mine) classes.push("is-mine");
  const badge = options.badge ? '<span class="dada-tile-badge">' + options.badge + "</span>" : "";
  const votes = options.votes ? '<span class="dada-tile-votes">' + options.votes + "</span>" : "";
  const base = ' data-dada-tile="' + dadaEsc(picture.id) + '"'
    + ' data-dada-role="' + dadaEsc(options.role || "") + '"'
    + ' data-dada-explain="tile" data-dada-tip="' + dadaTip("tile") + '"';
  const inner = '<span class="dada-tile-emoji">' + picture.emoji + "</span>"
    + '<span class="dada-tile-name">' + dadaEsc(picture.zh) + "</span>" + badge + votes;
  return options.disabled
    ? '<div class="' + classes.join(" ") + '"' + base + ">" + inner + "</div>"
    : '<button type="button" class="' + classes.join(" ") + '"' + base + ">" + inner + "</button>";
}

function dadaSoundsHTML() {
  const view = dadaView;
  const armed = dadaArmed();
  const canFlip = armed && view.stage === "create" && view.reserve_count > 0;
  let html = view.sounds.map((sound) => {
    const proposed = view.pending && view.pending.sound === sound.id;
    const classes = ["dada-sound"];
    if (armed) classes.push("is-armed");
    if (proposed) classes.push("is-proposed");
    const images = sound.images.length
      ? sound.images.map((picture) => "<span>" + picture.emoji + "</span>").join("")
      : '<span class="dada-sound-empty">还没有词</span>';
    const inner = '<span class="dada-syllable">' + dadaEsc(sound.syllable) + "</span>"
      + '<span class="dada-sound-images">' + images + "</span>";
    const attrs = ' data-dada-explain="sound" data-dada-tip="' + dadaTip("sound") + '"';
    return armed
      ? '<button type="button" class="' + classes.join(" ") + '" data-dada-sound="' + dadaEsc(sound.id) + '"' + attrs + ">" + inner + "</button>"
      : '<div class="' + classes.join(" ") + '"' + attrs + ">" + inner + "</div>";
  }).join("");
  if (view.reserve_count > 0) {
    const classes = ["dada-sound", "is-new"];
    if (canFlip) classes.push("is-armed");
    const inner = '<span class="dada-syllable">?</span>'
      + '<span class="dada-sound-images"><span class="dada-sound-empty">翻开新音节 ×'
      + view.reserve_count + "</span></span>";
    const attrs = ' data-dada-explain="reserve" data-dada-tip="' + dadaTip("reserve") + '"';
    html += canFlip
      ? '<button type="button" class="' + classes.join(" ") + '" data-dada-sound="new"' + attrs + ">" + inner + "</button>"
      : '<div class="' + classes.join(" ") + '"' + attrs + ">" + inner + "</div>";
  }
  return html;
}

function dadaWordHTML(parts, placeholder) {
  if (!parts.length) {
    return '<div class="dada-word is-empty"><span class="dada-word-hint">' + dadaEsc(placeholder) + "</span></div>";
  }
  const body = parts.map((id) => (
    '<span class="dada-word-part">' + dadaEsc(dadaWordLabel([id])) + "</span>"
  )).join('<span class="dada-word-dash">-</span>');
  return '<div class="dada-word" data-dada-explain="word" data-dada-tip="' + dadaTip("word") + '">' + body + "</div>";
}

function dadaBannerHTML() {
  const view = dadaView;
  if (!view || view.game_over) return "";
  if (view.pending) {
    const mine = view.pending.by === view.you;
    return "<b>" + dadaEsc(dadaName(view.pending.by)) + "</b> 提议把 " + view.pending.image.emoji
      + " " + dadaEsc(view.pending.image.zh) + " 叫作 <b>" + dadaEsc(view.pending.syllable) + "</b>"
      + (mine ? "，等待大家表态。" : "，同意吗？");
  }
  if (view.stage === "speak") {
    return "<b>" + dadaEsc(dadaName(view.communicator)) + "</b> 正在选目标并拼词"
      + (view.you === view.communicator ? "，轮到你说。" : "。");
  }
  if (view.stage === "guess") {
    return "命名者说出 <b>" + dadaEsc(view.word_label) + "</b>，指的是哪一张？";
  }
  if (view.stage === "reveal") {
    const result = view.result;
    if (!result) return "";
    return result.correct
      ? "✅ 猜对了，" + dadaEsc(result.word_label) + " 就是 " + result.target_picture.emoji + " " + dadaEsc(result.target_picture.zh) + "。"
      : "🤔 没谈拢，目标是 " + result.target_picture.emoji + " " + dadaEsc(result.target_picture.zh) + "。";
  }
  return "";
}

function dadaAreaHTML() {
  const view = dadaView;

  if (view.stage === "create") {
    const pool = view.table.map((picture) => {
      const isPending = view.pending?.image.id === picture.id;
      const selectable = dadaIsMyCreateTurn() || isPending;
      return dadaTileHTML(picture, {
        role: "pool",
        selected: dadaSelected === picture.id,
        pending: isPending,
        disabled: !selectable
      });
    }).join("");
    const unnamed = view.unnamed.length
      ? '<div class="dada-unnamed"><span>无名区</span>'
        + view.unnamed.map((picture) => '<span class="dada-unnamed-emoji">' + picture.emoji + "</span>").join("")
        + "</div>"
      : "";
    return '<div class="dada-grid" data-dada-explain="pool" data-dada-tip="' + dadaTip("pool") + '">'
      + (pool || '<div class="dada-empty">图卡池已经空了。</div>') + "</div>" + unnamed;
  }

  if (view.stage === "speak" || view.stage === "guess" || view.stage === "reveal") {
    const result = view.result;
    const naming = view.stage === "speak" && view.you === view.communicator;
    const guessing = view.stage === "guess" && view.you !== view.communicator;
    const tiles = view.candidates.map((picture) => {
      const isTarget = !!result && result.target === picture.id;
      const locked = naming && dadaTarget === picture.id;
      const myGuess = !result && view.your_guess === picture.id;
      let votes = "";
      if (result) {
        const count = result.tally[picture.id] || 0;
        if (count) votes = "👤".repeat(count);
      }
      return dadaTileHTML(picture, {
        role: "candidate",
        target: isTarget || locked,
        mine: myGuess,
        badge: isTarget ? "🎯" : (locked ? "🔒" : (myGuess ? "👆" : "")),
        votes,
        disabled: !(naming || guessing)
      });
    }).join("");
    const word = view.stage === "speak" && view.you === view.communicator
      ? dadaWordHTML(dadaWord, "点音节拼出这个词")
      : (view.word_label ? dadaWordHTML(view.word, "还没有说话") : "");
    return word + '<div class="dada-grid is-wide" data-dada-explain="candidates" data-dada-tip="'
      + dadaTip("candidates") + '">' + tiles + "</div>";
  }

  if (view.stage === "game_over") {
    const piles = '<div class="dada-piles">'
      + '<span class="dada-pile">✅ 已理解 ' + view.defined.map((p) => '<span class="dada-pile-emoji">' + p.emoji + "</span>").join("") + "</span>"
      + '<span class="dada-pile">🤔 Say What ' + view.say_what.map((p) => '<span class="dada-pile-emoji">' + p.emoji + "</span>").join("") + "</span>"
      + "</div>";
    return '<div class="dada-result" data-dada-explain="recap" data-dada-tip="' + dadaTip("recap") + '">'
      + '<div class="dada-final"><div class="dada-final-score">' + view.score + " / " + view.rounds_total + "</div>"
      + '<div class="dada-final-rank">' + dadaRank(view.score, view.rounds_total) + "</div></div>"
      + piles + "</div>";
  }
  return "";
}

function dadaTrayHTML() {
  const view = dadaView;

  if (view.game_over) {
    const ready = view.rematch_ready.includes(view.you);
    return '<div class="dada-tray-line">本局结束，想再来一门新语言就一起按 Play Again。</div>'
      + '<div class="dada-actions"><button type="button" class="dada-btn is-primary" data-dada-again="1"'
      + (ready ? " disabled" : "") + ">" + (ready ? "等待其他玩家" : "Play Again") + "</button></div>";
  }

  if (view.stage === "reveal") {
    const ready = view.continue_ready.includes(view.you);
    const result = view.result;
    const picks = result
      ? '<div class="dada-picks" data-dada-explain="result" data-dada-tip="' + dadaTip("result") + '">'
        + view.guessers.map((g) => {
          const pick = result.guesses[g.player_id];
          const picture = view.candidates.find((c) => c.id === pick);
          return '<span class="dada-pick' + (pick === result.target ? " is-hit" : "") + '">'
            + dadaEsc(g.name) + " " + (picture ? picture.emoji : "—") + "</span>";
        }).join("") + "</div>"
      : "";
    return '<div class="dada-tray-line">' + (result?.correct ? "这一轮全队听懂了。" : "这一轮没能谈到一起。") + "</div>"
      + picks
      + '<div class="dada-actions"><button type="button" class="dada-btn is-primary" data-dada-continue="1"'
      + (ready ? " disabled" : "") + ">" + (ready ? "等待其他玩家" : "Continue") + "</button></div>";
  }

  if (view.stage === "guess") {
    if (view.you === view.communicator) {
      return '<div class="dada-tray-line">你已经说完了，等待其他人指认。</div>'
        + '<div class="dada-tray-line">已指认 ' + view.guessers.filter((g) => g.done).length + "/" + view.guessers.length + "</div>";
    }
    const picked = view.your_guess;
    const picture = picked ? view.candidates.find((c) => c.id === picked) : null;
    return '<div class="dada-tray-line">'
      + (picture ? "你指的是 " + picture.emoji + " " + dadaEsc(picture.zh) + "，还可以改。" : "点上面六张图里的一张，指认你认为的目标。")
      + "</div>"
      + '<div class="dada-tray-line">已指认 ' + view.guessers.filter((g) => g.done).length + "/" + view.guessers.length + "</div>";
  }

  if (view.stage === "speak") {
    if (view.you !== view.communicator) {
      return '<div class="dada-tray-line">等待 <b>' + dadaEsc(dadaName(view.communicator)) + "</b> 选定目标并说出这个词。</div>";
    }
    const picked = dadaTarget ? view.candidates.find((c) => c.id === dadaTarget) : null;
    const ready = !!picked && dadaWord.length > 0;
    return '<div class="dada-tray-line">'
      + (picked ? "目标已锁定 " + picked.emoji + " " + dadaEsc(picked.zh) + "。" : "先点一张候选图锁定目标。")
      + "</div>"
      + '<div class="dada-actions">'
      + '<button type="button" class="dada-btn is-small" data-dada-pop="1"' + (dadaWord.length ? "" : " disabled") + ">退一格</button>"
      + '<button type="button" class="dada-btn is-small" data-dada-clear="1"' + (dadaWord.length ? "" : " disabled") + ">清空</button>"
      + '<button type="button" class="dada-btn is-primary" data-dada-speak="1"' + (ready ? "" : " disabled") + ">说出来</button>"
      + "</div>";
  }

  // Creation
  if (view.pending) {
    if (view.pending.by === view.you) {
      return '<div class="dada-tray-line">等待其他人表决，已表态 ' + Object.keys(view.pending.votes).length
        + "/" + (view.player_count - 1) + "。</div>";
    }
    if (view.you in view.pending.votes) {
      return '<div class="dada-tray-line">你已经表态，等待其他人。</div>';
    }
    return '<div class="dada-tray-line">把 ' + view.pending.image.emoji + " " + dadaEsc(view.pending.image.zh)
      + " 叫作 <b>" + dadaEsc(view.pending.syllable) + "</b>，你同意吗？</div>"
      + '<div class="dada-actions">'
      + '<button type="button" class="dada-btn is-yes" data-dada-vote="1">👍 同意</button>'
      + '<button type="button" class="dada-btn is-no" data-dada-vote="0">👎 不同意</button>'
      + "</div>";
  }
  if (view.current_player !== view.you) {
    return '<div class="dada-tray-line">等待 <b>' + dadaEsc(dadaName(view.current_player)) + "</b> 给一张图命名。</div>";
  }
  const selected = view.table.find((picture) => picture.id === dadaSelected);
  return '<div class="dada-tray-line">'
    + (selected
      ? "已选 " + selected.emoji + " " + dadaEsc(selected.zh) + "，现在点语言区的一个音节。"
      : "轮到你造词：先点图卡池里的一张图。")
    + "</div>";
}

function dadaStageLine() {
  const view = dadaView;
  if (!view) return "";
  if (view.game_over) return "🗣️ 本局结束";
  if (view.stage === "create") {
    return view.current_player === view.you ? "造词 · 轮到你" : "造词 · 等待 " + dadaName(view.current_player);
  }
  if (view.stage === "speak") {
    return view.communicator === view.you ? "命名 · 轮到你" : "命名 · " + dadaName(view.communicator);
  }
  if (view.stage === "guess") {
    return view.communicator === view.you ? "指认 · 等待大家" : "指认 · 轮到你";
  }
  return "结算 · 等待所有人 Continue";
}

function dadaRender() {
  if (!dadadaPanel) return;
  if (!dadaView) { dadadaPanel.innerHTML = ""; return; }
  const view = dadaView;

  const stage = document.getElementById("dadadaStage");
  if (stage) {
    const mine = view.current_player === view.you || view.communicator === view.you;
    stage.textContent = dadaStageLine();
    stage.classList.toggle("is-you", mine && !view.game_over && view.stage !== "reveal");
  }
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set("dadadaRound", view.round);
  set("dadadaRounds", view.rounds_total);
  set("dadadaScore", view.score);
  set("dadadaSayWhat", view.say_what.length);
  set("dadadaSayWhatLimit", view.say_what_limit);
  set("dadadaReserve", view.reserve_count > 0 ? "还有 " + view.reserve_count + " 张音节扣着" : "五个音节全部翻开");

  const banner = document.getElementById("dadadaBanner");
  if (banner) {
    banner.innerHTML = dadaBannerHTML();
    banner.classList.toggle("is-warn", view.stage === "guess" || !!view.pending);
  }

  const sounds = document.getElementById("dadadaSounds");
  if (sounds) sounds.innerHTML = dadaSoundsHTML();

  const titles = {
    create: ["🃏 图卡池", "还剩 " + view.table.length + " 张待命名"],
    speak: ["🃏 候选图", view.target && view.you === view.communicator ? "目标已锁定" : "悄悄选定一张"],
    guess: ["🃏 候选图", "点一张你认为对的"],
    reveal: ["🎯 本轮答案", ""],
    game_over: ["📖 语言复盘", ""]
  };
  const [title, note] = titles[view.stage] || ["—", ""];
  set("dadadaAreaTitle", title);
  set("dadadaAreaNote", note);

  const area = document.getElementById("dadadaArea");
  if (area) area.innerHTML = dadaAreaHTML();

  const tray = document.getElementById("dadadaTray");
  if (tray) tray.innerHTML = dadaTrayHTML();

  const log = document.getElementById("dadadaLog");
  if (log) log.innerHTML = view.log.slice(-30).map((line) => "<div>" + dadaEsc(line) + "</div>").join("");

  if (dadadaExplainWidget?.isActive()) dadadaExplainWidget.refresh();
}

/* --- Interaction -------------------------------------------------------- */

function dadaBindPanel() {
  if (!dadadaPanel || dadadaPanel.dataset.dadaBound === "1") return;
  dadadaPanel.dataset.dadaBound = "1";

  dadadaPanel.addEventListener("click", (event) => {
    if (dadadaExplainWidget?.isActive()) return;
    if (!dadaView) return;
    const view = dadaView;

    const vote = event.target.closest("[data-dada-vote]");
    if (vote && dadaLegal("vote")) {
      dadaSend({ type: "vote", turn: view.turn, approve: vote.getAttribute("data-dada-vote") === "1" });
      return;
    }
    if (event.target.closest("[data-dada-continue]") && dadaLegal("continue")) {
      dadaSend({ type: "continue", turn: view.turn });
      return;
    }
    if (event.target.closest("[data-dada-again]") && dadaLegal("play_again")) {
      dadaSend({ type: "play_again" });
      return;
    }

    const sound = event.target.closest("[data-dada-sound]");
    if (sound) {
      const id = sound.getAttribute("data-dada-sound");
      if (dadaIsMyCreateTurn() && dadaSelected && dadaLegal("propose")) {
        dadaSend({ type: "propose", turn: view.turn, image: dadaSelected, sound: id });
      } else if (dadaIsNaming() && dadaWord.length < view.word_max) {
        dadaWord = dadaWord.concat(id);
        dadaRender();
      }
      return;
    }

    if (event.target.closest("[data-dada-pop]")) {
      dadaWord = dadaWord.slice(0, -1);
      dadaRender();
      return;
    }
    if (event.target.closest("[data-dada-clear]")) {
      dadaWord = [];
      dadaRender();
      return;
    }
    if (event.target.closest("[data-dada-speak]") && dadaLegal("speak")) {
      if (!dadaTarget || !dadaWord.length) return;
      dadaSend({ type: "speak", turn: view.turn, target: dadaTarget, word: dadaWord.slice() });
      return;
    }

    const tile = event.target.closest("[data-dada-tile]");
    if (tile && !tile.disabled) {
      const id = tile.getAttribute("data-dada-tile");
      const role = tile.getAttribute("data-dada-role");
      if (role === "pool" && dadaIsMyCreateTurn()) {
        dadaSelected = dadaSelected === id ? null : id;
        dadaRender();
      } else if (role === "candidate") {
        if (dadaIsNaming()) {
          dadaTarget = dadaTarget === id ? null : id;
          dadaRender();
        } else if (view.stage === "guess" && dadaLegal("guess")) {
          dadaSend({ type: "guess", turn: view.turn, image: id });
        }
      }
      return;
    }

    if (!event.target.closest("button, .dada-sound, .dada-tile")) dadaCancelSelection();
  });

  dadadaPanel.addEventListener("pointerdown", (event) => {
    dadaLastPointerType = event.pointerType || "mouse";
    const anchor = event.target.closest("[data-dada-tip]");
    if (anchor && dadaLastPointerType !== "mouse") dadaShowTip(anchor.getAttribute("data-dada-tip"), anchor, true);
  }, true);
  dadadaPanel.addEventListener("pointerover", (event) => {
    if (dadaLastPointerType !== "mouse") return;
    const anchor = event.target.closest("[data-dada-tip]");
    if (anchor) dadaShowTip(anchor.getAttribute("data-dada-tip"), anchor, false);
  });
  dadadaPanel.addEventListener("pointerout", (event) => {
    if (dadaLastPointerType === "mouse" && event.target.closest("[data-dada-tip]")) dadaHideTip();
  });
}

function clearDadadaState() {
  dadaView = null;
  dadaSelected = null;
  dadaTarget = null;
  dadaWord = [];
  dadaPending = false;
  dadaSignature = null;
  window.clearTimeout(dadaPendingTimer);
  dadaHideTip();
  if (dadadaPanel) dadadaPanel.innerHTML = "";
}

window.renderDadadaGameState = (data) => {
  const next = data?.view || data;
  if (!next?.players || next.game_id !== "dadada") return;
  // Every broadcast means the server has processed something, so the submit lock
  // can always be released. Holding it until a "signature" changed used to strand
  // the player for 8s whenever their own action left turn and stage untouched,
  // which is exactly what changing a guess or re-proposing after a veto does.
  dadaPending = false;
  window.clearTimeout(dadaPendingTimer);
  const signature = JSON.stringify([data?.room_id, next.turn, next.stage,
    next.current_player, next.communicator, next.round]);
  if (signature !== dadaSignature) {
    dadaSelected = null;
    dadaTarget = null;
    dadaWord = [];
    dadaHideTip();
  }
  dadaSignature = signature;
  dadaView = next;
  initDadadaHelpExplain();
  dadaBindPanel();
  dadaRender();
};

window.showDadadaHeaderActions = (visible) => {
  if (dadadaHeader) dadadaHeader.style.display = visible ? "flex" : "none";
  if (!visible) clearDadadaState();
};
window.clearDadadaState = clearDadadaState;

dadadaHelpButton?.addEventListener("click", () => {
  initDadadaHelpExplain();
  dadadaHelpWidget?.open();
});
dadadaExplainButton?.addEventListener("click", () => {
  initDadadaHelpExplain();
  dadadaExplainWidget?.toggle();
});

document.addEventListener("keydown", (event) => {
  if (!dadaView || event.key !== "Escape") return;
  if (dadadaExplainWidget?.isActive()) return;
  dadaHideTip();
  dadaCancelSelection();
}, true);
window.addEventListener("resize", dadaHideTip);
window.addEventListener("blur", dadaHideTip);
document.addEventListener("scroll", dadaHideTip, true);

function connectDadadaEvents() {
  if (typeof socket === "undefined") return;
  socket.on("system:error", () => {
    if (dadaPending) {
      dadaPending = false;
      window.clearTimeout(dadaPendingTimer);
      dadaRender();
    }
  });
  if (typeof currentRoomState !== "undefined" && currentRoomState) {
    window.renderDadadaGameState(currentRoomState);
  }
}
if (document.readyState === "loading" || typeof socket === "undefined") {
  window.addEventListener("DOMContentLoaded", connectDadadaEvents, { once: true });
} else {
  connectDadadaEvents();
}
