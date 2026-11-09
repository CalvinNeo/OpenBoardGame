// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const aidixitHelpButton = document.getElementById("aidixitHelpBtn");
const aidixitExplainButton = document.getElementById("aidixitExplainBtn");

const AIDIXIT_HELP_CONFIG = {
  gameId: "aidixit",
  title: { zh: "🖼️ AI 画物语 · AI Dixit", en: "🖼️ AI Dixit" },
  basic: {
    win: {
      zh: "谁先把分数累积到目标分数（默认 30 分）谁就赢下整局。",
      en: "The first player to reach the target score, 30 points by default, wins the whole game."
    },
    turn: {
      zh: "轮到你时，你要么作为讲述者(🗣️)选一张手牌并写一句线索，要么按线索交出一张手牌，要么在投票阶段指认哪张牌属于讲述者(🗣️)。",
      en: "On your turn you either act as the Storyteller(🗣️) and pair one hand card with a written clue, or answer the clue with one card from your own hand, or point out which face-up card belongs to the Storyteller(🗣️)."
    },
    key: {
      zh: "线索必须拿捏在太直白和太晦涩之间，因为只有一部分人猜中时讲述者(🗣️)才拿得到分数。",
      en: "Your clue has to sit between too obvious and too obscure, because the Storyteller(🗣️) only scores when some of the guessers find the card."
    }
  },
  sections: [
    {
      id: "flow",
      label: { zh: "回合流程", en: "Round flow" },
      html: {
        zh: "<p>每一轮分成三步。第一步由讲述者(🗣️)从手牌里挑一张不公开的牌，然后在 Your Clue(✍️) 里写一句线索，线索可以是单词、句子、拟声词，甚至是只有你们才懂的梗。</p>"
          + "<p>第二步其他玩家各自从手牌里挑一张最贴合线索的牌，点开这张牌后按 Play Card(🃏) 交上去。系统收齐所有牌后会把它们打乱，然后一起亮在 Pool(🎴) 里。</p>"
          + "<p>第三步除了讲述者(🗣️)以外的每个人都要投票，点开 Pool(🎴) 里的牌再按 Vote(🗳️) 指认哪一张是讲述者的牌。三步走完就结算分数，讲述者再顺时针轮换到下一位。</p>",
        en: "<p>Every round has three steps. First the Storyteller(🗣️) picks one card from their hand without revealing it, then writes a clue in Your Clue(✍️). The clue can be a word, a sentence, a sound, or a joke only your group understands.</p>"
          + "<p>Second, every other player picks the hand card that fits the clue best and confirms it with Play Card(🃏). Once all cards are in, the system shuffles them and lays them face up in the Pool(🎴).</p>"
          + "<p>Third, everyone except the Storyteller(🗣️) votes with Vote(🗳️) for the card they believe is the storyteller's. The round is scored right after the last vote, and the storyteller role passes clockwise.</p>"
      }
    },
    {
      id: "scoring",
      label: { zh: "计分规则", en: "Scoring" },
      html: {
        zh: "<p>结算时只看一件事，那就是有多少人投中了讲述者(🗣️)的牌。</p>"
          + "<p>如果所有人都猜中，说明线索太直白，讲述者一分不得，其他每人加 2 分。</p>"
          + "<p>如果没有人猜中，说明线索太晦涩，讲述者同样一分不得，其他每人加 2 分。</p>"
          + "<p>只要猜中的人数落在这两者之间，讲述者和每一个猜中的人都加 3 分，这才是最理想的结果。</p>"
          + "<p>另外只要本轮不是所有人都猜中，别人投给你那张混淆牌的每一票，都会让你额外加 1 分，结算面板里的 +1 就来自这里。</p>",
        en: "<p>Scoring looks at one thing only, namely how many players voted for the Storyteller(🗣️) card.</p>"
          + "<p>If everybody guessed it the clue was too obvious, so the storyteller scores nothing and every other player gains 2 points.</p>"
          + "<p>If nobody guessed it the clue was too obscure, so the storyteller again scores nothing and every other player gains 2 points.</p>"
          + "<p>When the number of correct votes falls between those extremes, the storyteller and every correct guesser gain 3 points, which is the result you want.</p>"
          + "<p>On top of that, whenever the round is not a clean sweep, each vote your decoy card receives gives you 1 extra point, and that is where the small bonus in the result panel comes from.</p>"
      }
    },
    {
      id: "cards",
      label: { zh: "手牌与牌库", en: "Cards and deck" },
      html: {
        zh: "<p>开局时每位玩家拿到 6 张手牌，每轮结束时系统会自动把每个人的手牌补回 6 张。</p>"
          + "<p>本轮亮出来的所有牌在结算后都会进入弃牌堆，所以 Deck(🃏) 表示牌库还剩多少张，Discard(🗑️) 表示弃牌堆已经积攒了多少张。</p>"
          + "<p>牌库抽空时会按房间设置决定要不要把弃牌堆洗回去重新使用，因此打到后期也不必担心没有牌可发。</p>"
          + "<p>任何玩家达到 Target(🎯) 分数时游戏立刻结束，如果有几个人分数并列最高，他们会一起被记为获胜者。</p>",
        en: "<p>Every player starts with 6 cards in hand, and the system refills each hand back to 6 cards at the end of every round.</p>"
          + "<p>All cards revealed this round move to the discard pile after scoring, so Deck(🃏) tells you how many cards the deck still holds and Discard(🗑️) tells you how many have been used.</p>"
          + "<p>When the deck runs out the room setting decides whether the discard pile is shuffled back into play, so a long game never runs short of cards.</p>"
          + "<p>The game ends the moment a player reaches the Target(🎯) score, and anyone tied for the highest score is recorded as a winner.</p>"
      }
    },
    {
      id: "voting",
      label: { zh: "投票规则", en: "Voting" },
      html: {
        zh: "<p>投票阶段所有人都能看到打乱后的牌面，讲述者(🗣️)不参与投票，其他每个人都必须投出一票。</p>"
          + "<p>你不能投给自己交上去的那张牌，那张牌会带着 Yours(🔹) 标记，系统会直接拒绝这样的投票。</p>"
          + "<p>投票是公开的，每张牌下方会直接列出投给它的玩家名字，所以你能看着别人的选择再决定自己要投谁。</p>"
          + "<p>票投出去之后不能更改，等最后一个人投完，本轮立刻结算并把结果展示在 Last Round(📜) 里。</p>",
        en: "<p>During voting everyone sees the shuffled cards. The Storyteller(🗣️) does not vote, while every other player has to cast exactly one vote.</p>"
          + "<p>You may not vote for the card you submitted yourself. That card carries the Yours(🔹) mark and the system rejects such a vote outright.</p>"
          + "<p>Votes are public. The names listed under each card are the players who voted for it, so you can watch other choices before making your own.</p>"
          + "<p>A vote cannot be changed once it is cast, and the round settles the moment the last player votes, with the result shown under Last Round(📜).</p>"
      }
    },
    {
      id: "clue",
      label: { zh: "线索的分寸", en: "Balancing the clue" },
      html: {
        zh: "<p>好的线索不是让所有人都看懂，而是让一部分人产生联想。如果所有人都猜中，你作为讲述者(🗣️)一分都拿不到。</p>"
          + "<p>作为其他玩家时，你的任务是既猜中讲述者的牌，又用自己那张混淆牌去骗到别人的票，因为骗到的每一票都值 1 分。</p>"
          + "<p>所以看牌的时候既要猜讲述者在想什么，也要留意别人的牌为什么摆在那里。卡面太小的时候可以按 Zoom(🔍) 放大看清楚。</p>",
        en: "<p>A good clue does not speak to everybody. It only has to spark an idea in some players, because if every single one of them guesses your card you score nothing as the Storyteller(🗣️).</p>"
          + "<p>As a guesser your job is twofold. Find the storyteller's card, and make your own decoy tempting enough to steal votes, since every stolen vote is worth 1 point.</p>"
          + "<p>Read the table with both questions in mind, what the storyteller was thinking, and why the other cards are sitting there. Press Zoom(🔍) whenever a card is too small to read.</p>"
      }
    }
  ]
};

const AIDIXIT_EXPLAIN = {
  prompt: { zh: "行动提示条。它告诉你现在轮到你做什么，或者你正在等谁。整条变成金色边框时说明该你出手了。", en: "The action banner. It tells you what to do now, or who you are waiting for. A gold border means it is your move." },
  clue: { zh: "线索条。讲述者(🗣️)本轮写下的线索，提交阶段和投票阶段所有人都能看到它。", en: "The clue bar. The clue the Storyteller(🗣️) wrote this round, visible to everybody during the submit and vote phases." },
  players: { zh: "计分板。每一位玩家一个胶囊，左边是他专属颜色的圆点，中间是名字，右边是当前分数。", en: "The scoreboard. One pill per player, with their own colour dot on the left, their name in the middle, and their current score on the right." },
  seat: { zh: "一位玩家的计分胶囊。", en: "One player's score pill." },
  score: { zh: "这位玩家的当前分数，格式是 已得分/目标分。", en: "This player's current score, written as earned over target." },
  storyteller_tag: { zh: "皇冠(👑)标记，表示这位玩家是本轮的讲述者(🗣️)。", en: "The crown(👑) marks this player as the Storyteller(🗣️) for the current round." },
  round: { zh: "当前是第几轮，每轮结束后讲述者(🗣️)顺时针轮换。", en: "Which round is being played. The Storyteller(🗣️) role rotates clockwise after each round." },
  phase: { zh: "当前阶段。story 是讲述者出题，submit 是其他玩家出牌，vote 是投票。", en: "Current phase. story is the storyteller's clue, submit is the other players picking cards, vote is the guessing round." },
  storyteller: { zh: "本轮的讲述者(🗣️)，由他出题并且不参与投票。", en: "This round's Storyteller(🗣️), who gives the clue and never votes." },
  target: { zh: "获胜所需的目标分数 Target(🎯)，默认是 30 分。", en: "The Target(🎯) score needed to win, 30 points by default." },
  deck: { zh: "牌库 Deck(🃏)里还剩多少张可以发的牌。", en: "How many cards are left in the Deck(🃏) to deal." },
  discard: { zh: "弃牌堆 Discard(🗑️)里已经用过的牌，牌库抽空时可能会被洗回去。", en: "Cards already used this game, held in the Discard(🗑️) pile. They may be shuffled back once the deck runs out." },
  submitted: { zh: "你本轮是否已经交出牌。", en: "Whether you have already submitted a card this round." },
  voted: { zh: "你本轮是否已经投票，投完之后不能改票。右边的数字是本轮已经投出的票数。", en: "Whether you have already voted this round. A vote cannot be changed. The number beside it counts the votes cast so far." },
  winner: { zh: "整局游戏的获胜者，分数并列时会一起显示。", en: "The winners of the whole game. Tied players are listed together." },
  clue_input: { zh: "在这里写下你的线索，可以是单词、句子或者一个梗，只有轮到你当讲述者(🗣️)时才能输入。", en: "Write your clue here. It can be a word, a sentence, or an inside joke, and only the Storyteller(🗣️) may type in it." },
  hand: { zh: "你的手牌，每轮结束时会被补回 6 张。", en: "Your hand, which is refilled to 6 cards at the end of every round." },
  hand_card: { zh: "一张手牌。点它会盖上一层确认蒙版，在蒙版上选 Play Card(🃏) 或 Tell Story(🗣️) 才真正出牌。", en: "One hand card. Tapping it lays a confirmation shade over the card, and you commit with Play Card(🃏) or Tell Story(🗣️) on that shade." },
  pool: { zh: "本轮所有玩家交上来的牌，打乱后一起亮在这里。", en: "Every card submitted this round, shuffled and revealed together." },
  pool_card: { zh: "一张候选牌。点它会盖上确认蒙版，在蒙版上按 Vote(🗳️) 才真正投票。", en: "One candidate card. Tapping it lays a confirmation shade over the card, and you commit with Vote(🗳️) on that shade." },
  zoom: { zh: "放大镜 Zoom(🔍)按钮，点开可以看清这张牌的细节。", en: "The Zoom(🔍) button opens a larger view so you can study the card." },
  vote_count: { zh: "这张牌收到的票数。", en: "How many votes this card received." },
  story_badge: { zh: "Story 标记，表示这张牌就是讲述者(🗣️)出的那张。", en: "The Story badge marks the card the Storyteller(🗣️) actually played." },
  own_card: { zh: "Yours(🔹) 标记，表示这张牌是你自己交上去的，你不能投它。", en: "The Yours(🔹) mark shows this is the card you submitted yourself, and you may not vote for it." },
  result_card: { zh: "上一轮的一张牌，右上角的数字是它得到的票数，左上角的 Story(👑) 表示它就是讲述者的牌，下方列出投给它的玩家。", en: "One card from last round. The number at the top right is its vote count, the Story(👑) mark at the top left means it was the storyteller's card, and the voters are listed underneath." },
  voters: { zh: "投给这张牌的玩家，直接写出名字，名字前面的圆点是他专属的颜色。", en: "The players who voted for this card, listed by name. The dot in front of a name is that player's own colour." },
  round_notice: { zh: "上一轮的结算记录，点标题可以折叠或者展开，会一直保留到本轮结束。", en: "The scoring summary of the previous round. Tap the header to collapse or expand it. It is kept until the current round ends." },
  round_result: { zh: "上一轮的结果，包括结算类型、讲述者、线索以及猜中的人。", en: "Last round's outcome, including the scoring case, the storyteller, the clue, and who guessed correctly." },
  score_delta: { zh: "上一轮每个人的分数变化，绿色数字是本轮拿到的分数。", en: "How every player's score changed last round. The green number is what they earned." },
  zoom_close: { zh: "关闭放大的卡牌详情，也可以按 Esc 退出。", en: "Close the enlarged card view. Escape works too." }
};

let aidixitHelpWidget = null;
let aidixitExplainWidget = null;

function initAidixitHelpExplain() {
  if (aidixitHelpWidget || typeof window.obgCreateHelp !== "function") return;
  aidixitHelpWidget = window.obgCreateHelp(AIDIXIT_HELP_CONFIG);
  aidixitExplainWidget = window.obgCreateExplain({
    gameId: "aidixit",
    attribute: "data-aidixit-explain",
    explanations: AIDIXIT_EXPLAIN,
    button: aidixitExplainButton,
    root: () => document.getElementById("aidixitPanel"),
    bypass: ["#aidixitHelpBtn", "#aidixitExplainBtn"]
  });
  aidixitHelpButton?.addEventListener("click", () => {
    aidixitExplainWidget?.exit();
    aidixitHelpWidget.open();
  });
  aidixitExplainButton?.addEventListener("click", () => aidixitExplainWidget?.toggle());
}

function showAidixitHeaderActions(show) {
  const slot = document.getElementById("aidixitHeaderActions");
  if (slot) slot.style.display = show ? "flex" : "none";
  if (!show) {
    aidixitExplainWidget?.exit();
    closeAidixitZoom();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAidixitHelpExplain);
} else {
  initAidixitHelpExplain();
}

// --- Lobby deck picker -------------------------------------------------
let aidixitDecksLoaded = false;
let aidixitDecks = [];
let aidixitDeckSelections = new Set();

let aidixitSelectedHandCardId = null;
let aidixitSelectedVoteCardId = null;
let aidixitSelectedCardEl = null;
let aidixitLastPhase = null;
let currentAidixitView = null;

const aidixitConfigBox = document.getElementById("aidixitConfigBox");
const aidixitDeckRow = document.getElementById("aidixitDeckRow");
const aidixitDeckOptions = document.getElementById("aidixitDeckOptions");

const aidixitRoot = document.getElementById("aidixitRoot");
const aidixitPromptBox = document.getElementById("aidixitPromptBox");
const aidixitPromptIcon = document.getElementById("aidixitPromptIcon");
const aidixitPrompt = document.getElementById("aidixitPrompt");
const aidixitClueBar = document.getElementById("aidixitClueBar");
const aidixitClueLabel = document.getElementById("aidixitClue");
const aidixitClueBy = document.getElementById("aidixitClueBy");
const aidixitPlayers = document.getElementById("aidixitPlayers");
const aidixitStage = document.getElementById("aidixitStage");
const aidixitHandBlock = document.getElementById("aidixitHandBlock");
const aidixitHandToggle = document.getElementById("aidixitHandToggle");
const aidixitComposer = document.getElementById("aidixitComposer");
const aidixitClueInput = document.getElementById("aidixitClueInput");
const aidixitHand = document.getElementById("aidixitHand");
const aidixitHandNote = document.getElementById("aidixitHandNote");
const aidixitPoolHead = document.getElementById("aidixitPoolHead");
const aidixitPool = document.getElementById("aidixitPool");
const aidixitPoolNote = document.getElementById("aidixitPoolNote");
const aidixitRoundNotice = document.getElementById("aidixitRoundNotice");
const aidixitResultToggle = document.getElementById("aidixitResultToggle");
const aidixitResultBody = document.getElementById("aidixitResultBody");
const aidixitRoundNoticeBody = document.getElementById("aidixitRoundNoticeBody");
const aidixitResultDeltas = document.getElementById("aidixitResultDeltas");
const aidixitRoundNoticeCards = document.getElementById("aidixitRoundNoticeCards");
const aidixitResultPeek = document.getElementById("aidixitResultPeek");
const aidixitGameOver = document.getElementById("aidixitGameOver");
const aidixitWinnerLabel = document.getElementById("aidixitWinner");
const aidixitPhaseLabel = document.getElementById("aidixitPhase");
const aidixitRoundLabel = document.getElementById("aidixitRound");
const aidixitStorytellerLabel = document.getElementById("aidixitStoryteller");
const aidixitTargetScoreLabel = document.getElementById("aidixitTargetScore");
const aidixitDeckCountLabel = document.getElementById("aidixitDeckCount");
const aidixitMeta = document.querySelector("#aidixitPanel .aidixit-meta");
const aidixitDiscardCountLabel = document.getElementById("aidixitDiscardCount");
const aidixitZoomModal = document.getElementById("aidixitZoomModal");
const aidixitZoomCloseBtn = document.getElementById("aidixitZoomCloseBtn");
const aidixitZoomImage = document.getElementById("aidixitZoomImage");

function updateAidixitDeckRow() {
  const showRow = currentRoomState && currentGameType === "aidixit" && currentRoomState.status === "lobby";
  if (aidixitConfigBox) {
    aidixitConfigBox.classList.toggle("hidden", !showRow);
    aidixitConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (aidixitDeckRow) {
    aidixitDeckRow.classList.toggle("hidden", !showRow);
    aidixitDeckRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (showRow && !aidixitDecksLoaded) {
    fetchAidixitDecks();
  }
}

function fetchAidixitDecks() {
  if (!aidixitDeckOptions) {
    return;
  }
  aidixitDeckOptions.textContent = "Loading decks...";
  fetch("/api/aidixit/decks")
    .then((response) => response.json())
    .then((data) => {
      aidixitDecks = Array.isArray(data.decks) ? data.decks : [];
      aidixitDecksLoaded = true;
      renderAidixitDeckOptions();
    })
    .catch(() => {
      aidixitDeckOptions.textContent = "Failed to load decks.";
      aidixitDecksLoaded = false;
    });
}

function renderAidixitDeckOptions() {
  if (!aidixitDeckOptions) {
    return;
  }
  aidixitDeckOptions.innerHTML = "";
  if (!aidixitDecks.length) {
    aidixitDeckOptions.textContent = "No decks available.";
    return;
  }
  const availableDeckIds = new Set();
  aidixitDecks.forEach((deck) => {
    if (deck.id) {
      availableDeckIds.add(deck.id);
    }
  });
  aidixitDeckSelections = new Set(
    Array.from(aidixitDeckSelections).filter((deckId) => availableDeckIds.has(deckId))
  );
  if (aidixitDeckSelections.size === 0) {
    availableDeckIds.forEach((deckId) => {
      aidixitDeckSelections.add(deckId);
    });
  }
  aidixitDecks.forEach((deck) => {
    const deckId = deck.id;
    if (!deckId) {
      return;
    }
    const label = document.createElement("label");
    label.className = "decrypto-pack-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = deckId;
    checkbox.checked = aidixitDeckSelections.has(deckId);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        aidixitDeckSelections.add(deckId);
      } else {
        aidixitDeckSelections.delete(deckId);
      }
    });
    const text = document.createElement("span");
    const name = deck.name || deckId;
    const count = Number.isFinite(deck.count) ? ` (${deck.count})` : "";
    text.textContent = `${name}${count}`;
    label.appendChild(checkbox);
    label.appendChild(text);
    aidixitDeckOptions.appendChild(label);
  });
}

function getSelectedAidixitDecks() {
  return Array.from(aidixitDeckSelections);
}

function openAidixitZoom(imageUrl, altText) {
  if (!aidixitZoomModal || !aidixitZoomImage || !imageUrl) {
    return;
  }
  aidixitZoomImage.src = imageUrl;
  aidixitZoomImage.alt = altText || "Card detail";
  setModalVisible(aidixitZoomModal, true);
}

function closeAidixitZoom() {
  if (!aidixitZoomModal || !aidixitZoomImage) {
    return;
  }
  if (aidixitZoomModal.classList.contains("hidden")) {
    return;
  }
  setModalVisible(aidixitZoomModal, false);
  aidixitZoomImage.src = "";
}

function aidixitCardUrl(cardId) {
  if (!cardId) {
    return "";
  }
  const idx = cardId.indexOf("/");
  if (idx <= 0) {
    return "";
  }
  const deck = cardId.slice(0, idx);
  const file = cardId.slice(idx + 1);
  if (!deck || !file) {
    return "";
  }
  return `/api/aidixit/card?deck=${encodeURIComponent(deck)}&file=${encodeURIComponent(file)}`;
}

function aidixitIsStoryteller(view) {
  return !!view && view.storyteller_id === view.you;
}

function aidixitClueText() {
  return aidixitClueInput ? aidixitClueInput.value.trim() : "";
}

// --- Selection ---------------------------------------------------------
// Selection is applied to the live DOM instead of re-rendering the grid, so
// tapping a card never scrolls the list back to the top (DEV_GUIDE).

function clearAidixitSelection() {
  if (aidixitSelectedCardEl) {
    aidixitSelectedCardEl.classList.remove("is-selected");
    aidixitSelectedCardEl.querySelector(".aidixit-card-overlay")?.remove();
  }
  aidixitSelectedCardEl = null;
  aidixitSelectedHandCardId = null;
  aidixitSelectedVoteCardId = null;
  syncAidixitComposer();
}

function selectAidixitCard(cardEl, cardId, kind) {
  if (aidixitSelectedCardEl === cardEl) {
    clearAidixitSelection();
    return;
  }
  clearAidixitSelection();
  aidixitSelectedCardEl = cardEl;
  if (kind === "hand") {
    aidixitSelectedHandCardId = cardId;
  } else {
    aidixitSelectedVoteCardId = cardId;
  }
  cardEl.classList.add("is-selected");
  cardEl.appendChild(buildAidixitOverlay(kind));
  syncAidixitComposer();
  syncAidixitOverlay();
}

function buildAidixitOverlay(kind) {
  const view = currentAidixitView;
  const overlay = document.createElement("div");
  overlay.className = "aidixit-card-overlay";

  const hint = document.createElement("div");
  hint.className = "aidixit-overlay-hint";
  hint.hidden = true;
  hint.textContent = "Write a clue first";

  const actions = document.createElement("div");
  actions.className = "aidixit-overlay-actions";

  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = "aidixit-overlay-btn is-primary";
  confirm.textContent = kind === "vote" ? "🗳️ Vote" : (aidixitIsStoryteller(view) ? "🗣️ Tell Story" : "🃏 Play Card");
  confirm.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    commitAidixitSelection(kind);
  });

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "aidixit-overlay-btn is-ghost";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearAidixitSelection();
  });

  actions.appendChild(confirm);
  actions.appendChild(cancel);
  overlay.appendChild(hint);
  overlay.appendChild(actions);
  overlay.addEventListener("click", (event) => event.stopPropagation());
  return overlay;
}

function syncAidixitOverlay() {
  if (!aidixitSelectedCardEl) {
    return;
  }
  const overlay = aidixitSelectedCardEl.querySelector(".aidixit-card-overlay");
  if (!overlay) {
    return;
  }
  const needsClue = !!aidixitSelectedHandCardId && aidixitIsStoryteller(currentAidixitView);
  const ready = !needsClue || aidixitClueText().length > 0;
  const confirm = overlay.querySelector(".is-primary");
  const hint = overlay.querySelector(".aidixit-overlay-hint");
  if (confirm) confirm.disabled = !ready;
  if (hint) hint.hidden = ready;
}

function syncAidixitComposer() {
  if (!aidixitComposer) {
    return;
  }
  const waiting = !!aidixitSelectedHandCardId && aidixitClueText().length === 0;
  aidixitComposer.classList.toggle("needs-clue", waiting);
}

function commitAidixitSelection(kind) {
  const view = currentAidixitView;
  if (!view) {
    log("Game not ready");
    return;
  }
  if (kind === "vote") {
    const cardId = aidixitSelectedVoteCardId;
    if (!cardId) {
      log("Select a card to vote");
      return;
    }
    if (cardId === view.your_submission) {
      log("Cannot vote for your own card");
      return;
    }
    sendAction({ type: "submit_vote", card_id: cardId });
    clearAidixitSelection();
    return;
  }
  const cardId = aidixitSelectedHandCardId;
  if (!cardId) {
    log("Select a card");
    return;
  }
  if (aidixitIsStoryteller(view)) {
    const clue = aidixitClueText();
    if (!clue) {
      log("Enter a clue");
      return;
    }
    sendAction({ type: "submit_story", card_id: cardId, clue });
    if (aidixitClueInput) {
      aidixitClueInput.value = "";
    }
  } else {
    sendAction({ type: "submit_card", card_id: cardId });
  }
  clearAidixitSelection();
}

// --- Card rendering ----------------------------------------------------

function createAidixitCardElement(card, options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "aidixit-card";
  if (options.locked) wrapper.classList.add("is-locked");
  if (options.story) wrapper.classList.add("is-story");
  if (options.mine) wrapper.classList.add("is-mine");

  const img = document.createElement("img");
  img.className = "aidixit-card-img";
  const cardId = card.card_id || "";
  img.src = card.image_url || aidixitCardUrl(cardId);
  img.alt = cardId || "card";
  img.loading = "lazy";
  if (options.explain) {
    img.dataset.aidixitExplain = options.explain;
  }

  // Badges live inside the picture frame, never over the voter list below it.
  // They are appended before the image so Explain mode resolves the smallest
  // element under the pointer instead of the whole card.
  const frame = document.createElement("div");
  frame.className = "aidixit-card-frame";
  if (options.story) {
    frame.appendChild(buildAidixitBadge("aidixit-card-story", "story_badge", "👑 Story"));
  }
  if (options.mine) {
    frame.appendChild(buildAidixitBadge("aidixit-card-mine", "own_card", "🔹 Yours"));
  }
  if (options.count !== undefined) {
    frame.appendChild(buildAidixitBadge("aidixit-card-votes", "vote_count", `🗳️ ${options.count}`));
  }
  if (options.zoomable) {
    const zoomBtn = document.createElement("button");
    zoomBtn.type = "button";
    zoomBtn.className = "aidixit-zoom-btn";
    zoomBtn.setAttribute("aria-label", "Zoom card");
    zoomBtn.title = "Zoom";
    zoomBtn.textContent = "🔍";
    zoomBtn.dataset.aidixitExplain = "zoom";
    zoomBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openAidixitZoom(img.src, img.alt);
    });
    frame.appendChild(zoomBtn);
  }
  frame.appendChild(img);
  wrapper.appendChild(frame);

  if (Array.isArray(options.votes) && options.votes.length) {
    wrapper.appendChild(buildAidixitVoters(options.votes));
  }
  if (options.onSelect) {
    wrapper.addEventListener("click", () => options.onSelect(wrapper, cardId));
  }
  return wrapper;
}

function buildAidixitBadge(className, explainKey, text) {
  const badge = document.createElement("div");
  badge.className = `aidixit-card-badge ${className}`;
  badge.dataset.aidixitExplain = explainKey;
  badge.textContent = text;
  return badge;
}

// Colour dots alone do not say who voted, so every voter is named.
function buildAidixitVoters(votes) {
  const row = document.createElement("div");
  row.className = "aidixit-votes";
  row.dataset.aidixitExplain = "voters";
  const you = currentAidixitView ? currentAidixitView.you : null;
  votes.forEach((vote) => {
    const chip = document.createElement("span");
    chip.className = "aidixit-voter";
    if (vote && vote.player_id && vote.player_id === you) {
      chip.classList.add("is-you");
    }
    const dot = document.createElement("span");
    dot.className = "aidixit-voter-dot";
    if (vote && vote.color) {
      dot.style.backgroundColor = vote.color;
    }
    const name = document.createElement("span");
    name.className = "aidixit-voter-name";
    name.textContent = (vote && vote.name) || "Someone";
    chip.appendChild(dot);
    chip.appendChild(name);
    row.appendChild(chip);
  });
  return row;
}

function aidixitEmptyNote(text) {
  const note = document.createElement("div");
  note.className = "aidixit-empty";
  note.textContent = text;
  return note;
}

// --- Section renderers -------------------------------------------------

function renderAidixitPrompt(view) {
  if (!aidixitPromptBox || !aidixitPrompt || !aidixitPromptIcon) {
    return;
  }
  const state = aidixitPromptState(view);
  aidixitPromptIcon.textContent = state.icon;
  aidixitPrompt.textContent = state.text;
  aidixitPromptBox.classList.toggle("is-you", !!state.yours);
}

function aidixitPromptState(view) {
  const storyteller = view.storyteller_name || findPlayerName(view, view.storyteller_id) || "the storyteller";
  if (view.game_over) {
    return { icon: "🏆", text: "Game over. Final scores are on the scoreboard.", yours: false };
  }
  const mine = aidixitIsStoryteller(view);
  if (view.phase === "story") {
    return mine
      ? { icon: "🗣️", text: "You are the Storyteller. Pick a card, write a clue, then confirm on the card.", yours: true }
      : { icon: "⏳", text: `Waiting for ${storyteller} to give a clue.`, yours: false };
  }
  if (view.phase === "submit") {
    if (mine) {
      return { icon: "⏳", text: "Clue is out. Waiting for the others to submit their cards.", yours: false };
    }
    return view.submitted
      ? { icon: "✅", text: "Card submitted. Waiting for the others.", yours: false }
      : { icon: "🃏", text: "Pick the hand card that matches the clue, then confirm on the card.", yours: true };
  }
  if (view.phase === "vote") {
    if (mine) {
      return { icon: "👀", text: "Cards are on the table. Watch how the votes come in.", yours: false };
    }
    return view.voted
      ? { icon: "✅", text: "Vote locked in. Waiting for the others.", yours: false }
      : { icon: "🗳️", text: "Tap the card you believe is the Storyteller's, then confirm.", yours: true };
  }
  return { icon: "🎭", text: "-", yours: false };
}

function renderAidixitClue(view) {
  if (!aidixitClueBar || !aidixitClueLabel) {
    return;
  }
  const clue = view.clue || "";
  const show = !!clue && !view.game_over;
  aidixitClueBar.classList.toggle("hidden", !show);
  aidixitClueLabel.textContent = clue ? `“${clue}”` : "-";
  if (aidixitClueBy) {
    const name = view.storyteller_name || findPlayerName(view, view.storyteller_id);
    aidixitClueBy.textContent = show && name ? `— ${name}` : "";
  }
}

function renderAidixitScores(view) {
  if (!aidixitPlayers) {
    return;
  }
  aidixitPlayers.innerHTML = "";
  const target = view.target_score ?? "-";
  (view.players || []).forEach((player) => {
    const seat = document.createElement("div");
    seat.className = "aidixit-seat";
    seat.dataset.aidixitExplain = "seat";
    const isStoryteller = player.player_id === view.storyteller_id;
    if (isStoryteller) seat.classList.add("is-storyteller");
    if (player.player_id === view.you) seat.classList.add("is-you");

    const dot = document.createElement("span");
    dot.className = "aidixit-seat-dot";
    dot.style.backgroundColor = player.color || "#9ca3af";
    seat.appendChild(dot);

    const name = document.createElement("span");
    name.className = "aidixit-seat-name";
    name.textContent = player.name || "?";
    name.title = player.name || "";
    seat.appendChild(name);

    const score = document.createElement("span");
    score.className = "aidixit-seat-score";
    score.dataset.aidixitExplain = "score";
    score.textContent = `${player.score}/${target}`;
    seat.appendChild(score);

    if (isStoryteller) {
      const tag = document.createElement("span");
      tag.className = "aidixit-seat-tag";
      tag.dataset.aidixitExplain = "storyteller_tag";
      tag.textContent = "👑";
      seat.appendChild(tag);
    }
    if (player.is_bot) {
      const tag = document.createElement("span");
      tag.className = "aidixit-seat-tag";
      tag.textContent = "🤖";
      tag.title = "Bot";
      seat.appendChild(tag);
    }
    aidixitPlayers.appendChild(seat);
  });
}

function renderAidixitHand(view) {
  if (!aidixitHand) {
    return;
  }
  aidixitHand.innerHTML = "";
  const hand = Array.isArray(view.hand) ? view.hand : [];
  if (aidixitHandNote) {
    const foldable = aidixitHandFoldable(view);
    const folded = foldable && (aidixitHandFoldOverride === null ? true : aidixitHandFoldOverride);
    let note = `${hand.length} cards`;
    if (foldable) {
      note = folded ? `${hand.length} cards · tap to open` : `${hand.length} cards · tap to fold`;
    } else if (view.phase === "submit" && !aidixitIsStoryteller(view)) {
      note = view.submitted ? "✅ Submitted" : "⏳ Not submitted yet";
    } else if (view.phase === "story" && aidixitIsStoryteller(view)) {
      note = "Pick one, it stays hidden";
    }
    aidixitHandNote.textContent = view.game_over ? "" : note;
  }
  if (!hand.length) {
    aidixitHand.appendChild(aidixitEmptyNote("No cards in hand."));
    return;
  }
  const mine = aidixitIsStoryteller(view);
  const canAct = !view.game_over
    && ((view.phase === "story" && mine) || (view.phase === "submit" && !mine && !view.submitted));
  hand.forEach((card) => {
    const cardEl = createAidixitCardElement(card, {
      locked: !canAct,
      zoomable: true,
      explain: "hand_card",
      onSelect: canAct
        ? (element, cardId) => selectAidixitCard(element, cardId, "hand")
        : null,
    });
    aidixitHand.appendChild(cardEl);
  });
}

function renderAidixitPool(view) {
  if (!aidixitPool || !aidixitPoolHead) {
    return;
  }
  aidixitPool.innerHTML = "";
  const inVote = view.phase === "vote" && !view.game_over;
  aidixitPoolHead.classList.toggle("hidden", !inVote);
  if (aidixitStage) aidixitStage.classList.toggle("is-voting", inVote);
  if (!inVote) {
    if (aidixitPoolNote) aidixitPoolNote.textContent = "";
    return;
  }
  const pool = Array.isArray(view.pool_cards) ? view.pool_cards : [];
  const votesByCard = view.votes_by_card || {};
  const mine = aidixitIsStoryteller(view);
  const cast = Object.values(votesByCard).reduce((total, list) => total + (list?.length || 0), 0);
  const expected = Math.max(0, (view.players?.length || 1) - 1);
  if (aidixitPoolNote) {
    const progress = `${cast}/${expected} votes in`;
    aidixitPoolNote.textContent = mine ? progress : `${view.voted ? "✅ Voted" : "⏳ Not voted"} · ${progress}`;
  }
  if (!pool.length) {
    aidixitPool.appendChild(aidixitEmptyNote("Waiting for the cards to be revealed."));
    return;
  }
  pool.forEach((card) => {
    const cardId = card.card_id;
    const isOwn = view.your_submission === cardId;
    const canAct = !mine && !view.voted && !isOwn;
    const cardEl = createAidixitCardElement(card, {
      locked: !canAct,
      mine: isOwn,
      zoomable: true,
      explain: "pool_card",
      votes: votesByCard[cardId] || [],
      onSelect: canAct
        ? (element, id) => selectAidixitCard(element, id, "vote")
        : null,
    });
    aidixitPool.appendChild(cardEl);
  });
}

function renderAidixitResult(view) {
  if (!aidixitRoundNotice || !aidixitRoundNoticeBody) {
    return;
  }
  const result = view.last_result;
  if (!result) {
    aidixitResultKey = null;
    aidixitRoundNotice.classList.add("hidden");
    aidixitRoundNoticeBody.innerHTML = "";
    if (aidixitResultDeltas) aidixitResultDeltas.innerHTML = "";
    if (aidixitRoundNoticeCards) aidixitRoundNoticeCards.innerHTML = "";
    return;
  }
  aidixitRoundNotice.classList.remove("hidden");
  const caseMap = {
    all: { text: "Everyone guessed", fail: true },
    none: { text: "Nobody guessed", fail: true },
    partial: { text: "Some guessed", fail: false },
  };
  const info = caseMap[result.case] || { text: result.case || "Round", fail: false };
  syncAidixitResultFold(view);
  const correctNames = Array.isArray(result.correct_voters) && result.correct_voters.length
    ? result.correct_voters.map((pid) => findPlayerName(view, pid)).join(", ")
    : "nobody";
  const storytellerName = result.storyteller_id ? findPlayerName(view, result.storyteller_id) : "-";
  const clue = result.clue || "-";

  aidixitRoundNoticeBody.innerHTML = "";
  const badge = document.createElement("span");
  badge.className = "aidixit-result-case" + (info.fail ? " is-fail" : "");
  badge.textContent = info.text;
  aidixitRoundNoticeBody.appendChild(badge);
  aidixitRoundNoticeBody.appendChild(
    aidixitResultChunk("🗣️ Storyteller", storytellerName)
  );
  aidixitRoundNoticeBody.appendChild(
    aidixitResultChunk("💬 Clue", `“${clue}”`)
  );
  aidixitRoundNoticeBody.appendChild(
    aidixitResultChunk("🎯 Correct", correctNames)
  );
  if (aidixitResultPeek) {
    const wide = window.matchMedia("(min-width: 1080px)").matches;
    aidixitResultPeek.textContent = wide ? `${info.text} · 🗣️ ${storytellerName}` : info.text;
  }

  if (aidixitResultDeltas) {
    aidixitResultDeltas.innerHTML = "";
    const deltas = result.scores_delta || {};
    (view.players || []).forEach((player) => {
      if (!(player.player_id in deltas)) {
        return;
      }
      const delta = deltas[player.player_id] || 0;
      const chip = document.createElement("span");
      chip.className = "aidixit-delta" + (player.player_id === view.you ? " is-you" : "");
      const dot = document.createElement("span");
      dot.className = "aidixit-seat-dot";
      dot.style.backgroundColor = player.color || "#9ca3af";
      chip.appendChild(dot);
      const name = document.createElement("span");
      name.textContent = player.name || "?";
      chip.appendChild(name);
      const value = document.createElement("b");
      value.textContent = delta > 0 ? `+${delta}` : "0";
      if (delta <= 0) value.classList.add("is-zero");
      chip.appendChild(value);
      aidixitResultDeltas.appendChild(chip);
    });
  }

  if (aidixitRoundNoticeCards) {
    aidixitRoundNoticeCards.innerHTML = "";
    const voteCounts = result.vote_counts || {};
    const votesByCard = result.votes_by_card || {};
    let cardIds = Array.isArray(result.pool_cards) ? result.pool_cards.slice() : [];
    if (!cardIds.length) {
      cardIds = Object.keys(voteCounts);
    }
    if (result.story_card && !cardIds.includes(result.story_card)) {
      cardIds = [...cardIds, result.story_card];
    }
    cardIds.forEach((cardId) => {
      const count = voteCounts[cardId];
      const cardEl = createAidixitCardElement({ card_id: cardId, image_url: aidixitCardUrl(cardId) }, {
        locked: true,
        story: cardId === result.story_card,
        count: typeof count === "number" ? count : 0,
        zoomable: true,
        explain: "result_card",
        votes: votesByCard[cardId] || [],
      });
      aidixitRoundNoticeCards.appendChild(cardEl);
    });
  }
}

function aidixitResultChunk(label, value) {
  const chunk = document.createElement("span");
  chunk.append(`${label} `);
  const strong = document.createElement("b");
  strong.textContent = value;
  chunk.appendChild(strong);
  return chunk;
}

function renderAidixitMeta(view) {
  if (aidixitRoundLabel) aidixitRoundLabel.textContent = view.round ?? "-";
  if (aidixitPhaseLabel) aidixitPhaseLabel.textContent = view.phase || "-";
  if (aidixitStorytellerLabel) {
    aidixitStorytellerLabel.textContent = view.storyteller_name
      || (view.storyteller_id ? findPlayerName(view, view.storyteller_id) : "-");
  }
  if (aidixitTargetScoreLabel) aidixitTargetScoreLabel.textContent = view.target_score ?? "-";
  if (aidixitDeckCountLabel) aidixitDeckCountLabel.textContent = view.deck_count ?? "-";
  if (aidixitDiscardCountLabel) aidixitDiscardCountLabel.textContent = view.discard_count ?? "-";
}

function renderAidixitGameOver(view) {
  if (!aidixitGameOver || !aidixitWinnerLabel) {
    return;
  }
  const winners = Array.isArray(view.winner) ? view.winner : [];
  const show = !!view.game_over && winners.length > 0;
  aidixitGameOver.classList.toggle("hidden", !show);
  if (show) {
    const names = winners.map((pid) => findPlayerName(view, pid)).join(", ");
    aidixitWinnerLabel.textContent = `${names} win${winners.length > 1 ? "" : "s"} the game`;
  } else {
    aidixitWinnerLabel.textContent = "-";
  }
}

function renderAidixitComposer(view) {
  if (!aidixitComposer || !aidixitClueInput) {
    return;
  }
  const canEdit = !view.game_over && view.phase === "story" && aidixitIsStoryteller(view);
  aidixitComposer.classList.toggle("hidden", !canEdit);
  aidixitClueInput.disabled = !canEdit;
  if (!canEdit) {
    aidixitClueInput.value = "";
  }
}

// --- Screen fitting ----------------------------------------------------
// DEV_GUIDE asks the layout to fill the screen instead of shrinking into a
// clump, so the column count is derived from the height that is actually
// left over. Fewer columns mean bigger cards, so the search walks upwards
// and keeps the first layout that both fits and stays under the size cap.

const AIDIXIT_MIN_CARD = 112;
const AIDIXIT_MAX_CARD = 420;
const AIDIXIT_CARD_RATIO = 0.75;
const AIDIXIT_STRETCH = 1.5;
// A layout that overshoots by a few pixels still beats dropping a whole
// column, which on a phone halves the size of every picture.
const AIDIXIT_FIT_SLACK = 1.06;
const AIDIXIT_FIT_SLACK_PX = 18;

function aidixitGridGap(grid) {
  const gap = parseFloat(getComputedStyle(grid).columnGap);
  return Number.isFinite(gap) ? gap : 8;
}

// Pick the column count that puts the largest possible picture on screen:
// every candidate is measured at its natural 4:3 size, then stretched into
// whatever height is left, and the widest resulting card area wins.
function aidixitBestColumns(count, width, height, gap, chrome) {
  if (!count || width <= 0) {
    return null;
  }
  let best = null;
  let fallback = null;
  for (let cols = 1; cols <= count; cols += 1) {
    const cardW = (width - gap * (cols - 1)) / cols;
    if (cardW < AIDIXIT_MIN_CARD) {
      break;
    }
    const rows = Math.ceil(count / cols);
    const naturalRow = cardW * AIDIXIT_CARD_RATIO + chrome;
    const natural = rows * naturalRow + gap * (rows - 1);
    const roomRow = (height - gap * (rows - 1)) / rows;
    const finalRow = Math.max(naturalRow, Math.min(naturalRow * AIDIXIT_STRETCH, roomRow));
    const entry = { cols, cardW, rows, naturalRow, natural, finalRow, area: cardW * finalRow };
    if (!fallback || entry.natural < fallback.natural) {
      fallback = entry;
    }
    if (natural > height * AIDIXIT_FIT_SLACK + AIDIXIT_FIT_SLACK_PX || cardW > AIDIXIT_MAX_CARD) {
      continue;
    }
    if (!best || entry.area > best.area) {
      best = entry;
    }
  }
  return best || fallback;
}

function fitAidixitStage() {
  const view = currentAidixitView;
  if (!aidixitStage || !view || currentGameType !== "aidixit") {
    return;
  }
  const poolCount = aidixitPool ? aidixitPool.childElementCount : 0;
  const handCount = aidixitHand ? aidixitHand.childElementCount : 0;
  const handFolded = !!aidixitHandBlock?.classList.contains("is-folded");
  const grids = [];
  if (view.phase === "vote" && !view.game_over && poolCount > 0) {
    grids.push({ el: aidixitPool, count: poolCount, chrome: 48 });
  }
  if (!handFolded && handCount > 0) {
    grids.push({ el: aidixitHand, count: handCount, chrome: 14 });
  }
  if (!grids.length) {
    return;
  }

  // Measure the real chrome instead of guessing: everything above the stage,
  // every block header, and whatever still sits below it on this screen.
  const wide = window.matchMedia("(min-width: 1080px)").matches;
  const rootGap = parseFloat(getComputedStyle(aidixitRoot).rowGap) || 9;
  const stageGap = parseFloat(getComputedStyle(aidixitStage).rowGap) || 11;
  const stageBox = aidixitStage.getBoundingClientRect();
  const panel = aidixitStage.closest(".game-panel");
  const panelPad = panel ? parseFloat(getComputedStyle(panel).paddingBottom) || 0 : 0;

  let below = 0;
  const resultVisible = !!aidixitRoundNotice && !aidixitRoundNotice.classList.contains("hidden");
  if (resultVisible) {
    below += aidixitRoundNotice.offsetHeight + stageGap;
  }
  if (!wide && aidixitMeta) {
    below += aidixitMeta.offsetHeight + rootGap;
  }

  let overhead = (grids.length - 1) * stageGap;
  grids.forEach((grid) => {
    const block = grid.el.closest(".aidixit-block");
    const blockBox = block?.getBoundingClientRect();
    grid.overhead = blockBox ? Math.max(0, grid.el.getBoundingClientRect().top - blockBox.top) : 0;
    overhead += grid.overhead;
  });

  const available = window.innerHeight - stageBox.top - below - panelPad - overhead - 16;
  layoutAidixitGrids(grids, Math.max(200, available));
}

// Columns come first, then the leftover height is shared out so the rows can
// grow past their 4:3 starting size without turning into tall slivers.
function layoutAidixitGrids(grids, budget) {
  const totalCards = grids.reduce((sum, grid) => sum + grid.count, 0);
  grids.forEach((grid) => {
    const width = grid.el.clientWidth;
    if (!width) {
      grid.skip = true;
      return;
    }
    const gap = aidixitGridGap(grid.el);
    const plan = aidixitBestColumns(grid.count, width, (budget * grid.count) / totalCards, gap, grid.chrome);
    if (!plan) {
      grid.skip = true;
      return;
    }
    Object.assign(grid, plan, { gap });
  });

  const live = grids.filter((grid) => !grid.skip);
  const leftover = budget - live.reduce((sum, grid) => sum + grid.natural, 0);
  if (leftover > 20) {
    const headroom = (grid) => Math.max(0, grid.rows * grid.naturalRow * AIDIXIT_STRETCH - grid.natural);
    const room = live.reduce((sum, grid) => sum + headroom(grid), 0);
    if (room > 0) {
      const take = Math.min(leftover, room);
      live.forEach((grid) => {
        const grown = grid.natural + (take * headroom(grid)) / room;
        grid.finalRow = Math.max(grid.naturalRow, (grown - grid.gap * (grid.rows - 1)) / grid.rows);
      });
    }
  }

  live.forEach((grid) => {
    grid.el.style.gridTemplateColumns = `repeat(${grid.cols}, minmax(0, 1fr))`;
    grid.el.style.gridAutoRows = `${Math.round(grid.finalRow)}px`;
    centerAidixitLastRow(grid);
  });
}

// A half filled last row looks like a mistake, so the leftovers are centred
// under the full rows instead of hugging the left edge.
function centerAidixitLastRow(grid) {
  const items = Array.from(grid.el.children);
  items.forEach((item) => {
    item.style.gridColumnStart = "";
  });
  const remainder = grid.count % grid.cols;
  if (!remainder || grid.cols < 2 || items.length !== grid.count) {
    return;
  }
  const firstOfLastRow = grid.count - remainder;
  const start = Math.floor((grid.cols - remainder) / 2) + 1;
  for (let index = firstOfLastRow; index < grid.count; index += 1) {
    items[index].style.gridColumnStart = String(start + (index - firstOfLastRow));
  }
}

let aidixitFitPending = false;

function scheduleAidixitFit() {
  if (aidixitFitPending) {
    return;
  }
  aidixitFitPending = true;
  requestAnimationFrame(() => {
    aidixitFitPending = false;
    syncAidixitResultFold(currentAidixitView);
    fitAidixitStage();
  });
}

// --- Hand folding ------------------------------------------------------
// Voting is about the pool, so the hand starts folded and the player can
// open it with one tap. Any other phase always shows the hand.

let aidixitHandFoldOverride = null;

function aidixitHandFoldable(view) {
  return !!view && view.phase === "vote" && !view.game_over;
}

function applyAidixitHandFold(view) {
  if (!aidixitHandBlock || !aidixitHandToggle) {
    return;
  }
  const foldable = aidixitHandFoldable(view);
  const folded = foldable && (aidixitHandFoldOverride === null ? true : aidixitHandFoldOverride);
  aidixitHandBlock.classList.toggle("is-folded", folded);
  aidixitHandToggle.setAttribute("aria-expanded", String(!folded));
}

function renderAidixitView() {
  const view = currentAidixitView;
  if (!view) {
    return;
  }
  renderAidixitPrompt(view);
  renderAidixitClue(view);
  renderAidixitScores(view);
  renderAidixitComposer(view);
  renderAidixitHand(view);
  renderAidixitPool(view);
  renderAidixitResult(view);
  renderAidixitGameOver(view);
  renderAidixitMeta(view);
  applyAidixitHandFold(view);
  syncAidixitComposer();
  syncAidixitOverlay();
  fitAidixitStage();
  aidixitExplainWidget?.refresh();
}

function clearAidixitState() {
  currentAidixitView = null;
  clearAidixitSelection();
  if (aidixitPrompt) aidixitPrompt.textContent = "-";
  if (aidixitPromptIcon) aidixitPromptIcon.textContent = "🎭";
  if (aidixitPromptBox) aidixitPromptBox.classList.remove("is-you");
  if (aidixitClueBar) aidixitClueBar.classList.add("hidden");
  if (aidixitPlayers) aidixitPlayers.innerHTML = "";
  if (aidixitComposer) aidixitComposer.classList.add("hidden");
  if (aidixitClueInput) {
    aidixitClueInput.value = "";
    aidixitClueInput.disabled = true;
  }
  if (aidixitHand) aidixitHand.innerHTML = "";
  if (aidixitHandNote) aidixitHandNote.textContent = "";
  if (aidixitPool) aidixitPool.innerHTML = "";
  if (aidixitPoolHead) aidixitPoolHead.classList.add("hidden");
  if (aidixitStage) aidixitStage.classList.remove("is-voting");
  if (aidixitHandBlock) aidixitHandBlock.classList.remove("is-folded");
  aidixitHandFoldOverride = null;
  aidixitLastPhase = null;
  if (aidixitPoolNote) aidixitPoolNote.textContent = "";
  if (aidixitRoundNotice) aidixitRoundNotice.classList.add("hidden");
  if (aidixitResultPeek) aidixitResultPeek.textContent = "";
  aidixitResultKey = null;
  aidixitResultWide = null;
  if (aidixitRoundNoticeBody) aidixitRoundNoticeBody.innerHTML = "";
  if (aidixitResultDeltas) aidixitResultDeltas.innerHTML = "";
  if (aidixitRoundNoticeCards) aidixitRoundNoticeCards.innerHTML = "";
  if (aidixitGameOver) aidixitGameOver.classList.add("hidden");
  if (aidixitWinnerLabel) aidixitWinnerLabel.textContent = "-";
  if (aidixitPhaseLabel) aidixitPhaseLabel.textContent = "-";
  if (aidixitRoundLabel) aidixitRoundLabel.textContent = "-";
  if (aidixitStorytellerLabel) aidixitStorytellerLabel.textContent = "-";
  if (aidixitTargetScoreLabel) aidixitTargetScoreLabel.textContent = "-";
  if (aidixitDeckCountLabel) aidixitDeckCountLabel.textContent = "-";
  if (aidixitDiscardCountLabel) aidixitDiscardCountLabel.textContent = "-";
}

function renderAidixitGameState(data) {
  const view = data.view;
  currentAidixitView = view;
  if (currentGameType !== "aidixit") {
    currentGameType = "aidixit";
    setGamePanelVisibility("aidixit");
  }
  const handIds = new Set((view.hand || []).map((card) => card.card_id));
  const poolIds = new Set((view.pool_cards || []).map((card) => card.card_id));
  if (view.phase !== aidixitLastPhase) {
    aidixitLastPhase = view.phase;
    aidixitHandFoldOverride = null;
  }
  const selectionLost = (aidixitSelectedHandCardId && !handIds.has(aidixitSelectedHandCardId))
    || (aidixitSelectedVoteCardId && !poolIds.has(aidixitSelectedVoteCardId))
    || (aidixitSelectedVoteCardId && view.phase !== "vote");
  if (selectionLost) {
    clearAidixitSelection();
  }
  renderAidixitView();
  logGameEvents(data);
}

// --- Wiring ------------------------------------------------------------

if (aidixitZoomCloseBtn) {
  aidixitZoomCloseBtn.addEventListener("click", () => closeAidixitZoom());
}

if (aidixitZoomModal) {
  aidixitZoomModal.addEventListener("click", (event) => {
    if (event.target === aidixitZoomModal) {
      closeAidixitZoom();
    }
  });
}

if (aidixitHandToggle) {
  aidixitHandToggle.addEventListener("click", () => {
    if (!aidixitHandFoldable(currentAidixitView)) {
      return;
    }
    const folded = !!aidixitHandBlock?.classList.contains("is-folded");
    aidixitHandFoldOverride = !folded;
    applyAidixitHandFold(currentAidixitView);
    renderAidixitHand(currentAidixitView);
    fitAidixitStage();
  });
}

let aidixitResultKey = null;
let aidixitResultWide = null;

// A phone has no room for the previous round on top of the live board, so the
// summary stays on the header and the cards wait behind one tap. Rotating the
// device across the breakpoint re-applies the default, an explicit tap does not.
function syncAidixitResultFold(view) {
  if (!aidixitResultToggle || !aidixitResultBody || !view || !view.last_result) {
    return;
  }
  const wide = window.matchMedia("(min-width: 1080px)").matches;
  const key = `${view.round}|${view.last_result.story_card || ""}`;
  if (key === aidixitResultKey && wide === aidixitResultWide) {
    return;
  }
  aidixitResultKey = key;
  aidixitResultWide = wide;
  setAidixitResultOpen(wide);
}

function setAidixitResultOpen(open) {
  if (!aidixitResultToggle || !aidixitResultBody) {
    return;
  }
  aidixitResultToggle.setAttribute("aria-expanded", String(open));
  aidixitResultBody.hidden = !open;
}

if (aidixitResultToggle && aidixitResultBody) {
  aidixitResultToggle.addEventListener("click", () => {
    setAidixitResultOpen(aidixitResultToggle.getAttribute("aria-expanded") !== "true");
    scheduleAidixitFit();
  });
}

window.addEventListener("resize", scheduleAidixitFit);
window.addEventListener("orientationchange", scheduleAidixitFit);

if (aidixitClueInput) {
  aidixitClueInput.addEventListener("input", () => {
    syncAidixitComposer();
    syncAidixitOverlay();
  });
}

// Tapping empty space cancels the pending selection, so no Clear Selection
// button is needed (DEV_GUIDE).
if (aidixitRoot) {
  aidixitRoot.addEventListener("click", (event) => {
    if (!aidixitSelectedCardEl) {
      return;
    }
    if (event.target.closest(".aidixit-card")) {
      return;
    }
    if (event.target.closest("button, input, label, a, select")) {
      return;
    }
    clearAidixitSelection();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  if (aidixitZoomModal && !aidixitZoomModal.classList.contains("hidden")) {
    closeAidixitZoom();
    return;
  }
  if (currentGameType === "aidixit" && aidixitSelectedCardEl) {
    clearAidixitSelection();
  }
});
