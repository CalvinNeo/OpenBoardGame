// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const aidixitHelpButton = document.getElementById("aidixitHelpBtn");
const aidixitExplainButton = document.getElementById("aidixitExplainBtn");

const AIDIXIT_HELP_CONFIG = {
  gameId: "aidixit",
  title: { zh: "AI 画物语 · AI Dixit", en: "AI Dixit" },
  basic: {
    win: {
      zh: "谁先把分数累积到目标分数（默认 30 分）谁就赢下整局。",
      en: "The first player to reach the target score, 30 points by default, wins the whole game."
    },
    turn: {
      zh: "轮到你时，你要么作为讲述者(Storyteller)选一张手牌并写一句线索，要么按线索交出一张手牌，要么在投票阶段指认哪张牌属于讲述者。",
      en: "On your turn you either act as the storyteller and pair one hand card with a written clue, or answer the clue with one card from your own hand, or point out which face-up card belongs to the storyteller."
    },
    key: {
      zh: "线索必须拿捏在太直白和太晦涩之间，因为只有一部分人猜中时讲述者(Storyteller)才拿得到分数。",
      en: "Your clue has to sit between too obvious and too obscure, because the storyteller only scores when some of the guessers find the card."
    }
  },
  sections: [
    {
      id: "flow",
      label: { zh: "回合流程", en: "Round flow" },
      html: {
        zh: "<p>每一轮分成三步。第一步由讲述者(Storyteller)从手牌里挑一张不公开的牌，然后在 Your Clue 里写一句线索，线索可以是单词、句子、拟声词，甚至是只有你们才懂的梗。</p>"
          + "<p>第二步其他玩家各自从手牌里挑一张最贴合线索的牌，按下 Submit Card 交上去。系统收齐所有牌后会把它们打乱，然后一起亮在 Pool 里。</p>"
          + "<p>第三步除了讲述者以外的每个人都要投票，指认哪一张是讲述者的牌。三步走完就结算分数，讲述者再顺时针轮换到下一位。</p>",
        en: "<p>Every round has three steps. First the storyteller picks one card from their hand without revealing it, then writes a clue in Your Clue. The clue can be a word, a sentence, a sound, or a joke only your group understands.</p>"
          + "<p>Second, every other player picks the hand card that fits the clue best and presses Submit Card. Once all cards are in, the system shuffles them and lays them face up in the Pool.</p>"
          + "<p>Third, everyone except the storyteller votes for the card they believe is the storyteller's. The round is scored right after the last vote, and the storyteller role passes clockwise.</p>"
      }
    },
    {
      id: "scoring",
      label: { zh: "计分规则", en: "Scoring" },
      html: {
        zh: "<p>结算时只看一件事，那就是有多少人投中了讲述者的牌。</p>"
          + "<p>如果所有人都猜中，说明线索太直白，讲述者(Storyteller)一分不得，其他每人加 2 分。</p>"
          + "<p>如果没有人猜中，说明线索太晦涩，讲述者同样一分不得，其他每人加 2 分。</p>"
          + "<p>只要猜中的人数落在这两者之间，讲述者和每一个猜中的人都加 3 分，这才是最理想的结果。</p>"
          + "<p>另外只要本轮不是所有人都猜中，别人投给你那张混淆牌的每一票，都会让你额外加 1 分。</p>",
        en: "<p>Scoring looks at one thing only, namely how many players voted for the storyteller's card.</p>"
          + "<p>If everybody guessed it the clue was too obvious, so the storyteller scores nothing and every other player gains 2 points.</p>"
          + "<p>If nobody guessed it the clue was too obscure, so the storyteller again scores nothing and every other player gains 2 points.</p>"
          + "<p>When the number of correct votes falls between those extremes, the storyteller and every correct guesser gain 3 points, which is the result you want.</p>"
          + "<p>On top of that, whenever the round is not a clean sweep, each vote your decoy card receives gives you 1 extra point.</p>"
      }
    },
    {
      id: "cards",
      label: { zh: "手牌与牌库", en: "Cards and deck" },
      html: {
        zh: "<p>开局时每位玩家拿到 6 张手牌，每轮结束时系统会自动把每个人的手牌补回 6 张。</p>"
          + "<p>本轮亮出来的所有牌在结算后都会进入弃牌堆，所以 Deck 表示牌库还剩多少张，Discard 表示弃牌堆已经积攒了多少张。</p>"
          + "<p>牌库抽空时会按房间设置决定要不要把弃牌堆洗回去重新使用，因此打到后期也不必担心没有牌可发。</p>"
          + "<p>任何玩家达到目标分数时游戏立刻结束，如果有几个人分数并列最高，他们会一起被记为获胜者。</p>",
        en: "<p>Every player starts with 6 cards in hand, and the system refills each hand back to 6 cards at the end of every round.</p>"
          + "<p>All cards revealed this round move to the discard pile after scoring, so Deck tells you how many cards the deck still holds and Discard tells you how many have been used.</p>"
          + "<p>When the deck runs out the room setting decides whether the discard pile is shuffled back into play, so a long game never runs short of cards.</p>"
          + "<p>The game ends the moment a player reaches the target score, and anyone tied for the highest score is recorded as a winner.</p>"
      }
    },
    {
      id: "voting",
      label: { zh: "投票规则", en: "Voting" },
      html: {
        zh: "<p>投票阶段所有人都能看到打乱后的牌面，讲述者(Storyteller)不参与投票，其他每个人都必须投出一票。</p>"
          + "<p>你不能投给自己交上去的那张牌，系统会直接拒绝这样的投票。</p>"
          + "<p>投票是公开的，牌旁边的彩色圆点(●)会显示已经投给它的玩家，所以你能看着别人的选择再决定自己要投谁。</p>"
          + "<p>票投出去之后不能更改，等最后一个人投完，本轮立刻结算并把结果展示在 Last Round 里。</p>",
        en: "<p>During voting everyone sees the shuffled cards. The storyteller does not vote, while every other player has to cast exactly one vote.</p>"
          + "<p>You may not vote for the card you submitted yourself, and the system rejects such a vote outright.</p>"
          + "<p>Votes are public. The colour dots (●) next to a card show who already voted for it, so you can watch other choices before making your own.</p>"
          + "<p>A vote cannot be changed once it is cast, and the round settles the moment the last player votes, with the result shown under Last Round.</p>"
      }
    },
    {
      id: "clue",
      label: { zh: "线索的分寸", en: "Balancing the clue" },
      html: {
        zh: "<p>好的线索不是让所有人都看懂，而是让一部分人产生联想。如果所有人都猜中，你作为讲述者(Storyteller)一分都拿不到。</p>"
          + "<p>作为其他玩家时，你的任务是既猜中讲述者的牌，又用自己那张混淆牌去骗到别人的票，因为骗到的每一票都值 1 分。</p>"
          + "<p>所以看牌的时候既要猜讲述者在想什么，也要留意别人的牌为什么摆在那里。</p>",
        en: "<p>A good clue does not speak to everybody. It only has to spark an idea in some players, because if every single one of them guesses your card you score nothing as the storyteller.</p>"
          + "<p>As a guesser your job is twofold. Find the storyteller's card, and make your own decoy tempting enough to steal votes, since every stolen vote is worth 1 point.</p>"
          + "<p>Read the table with both questions in mind, what the storyteller was thinking, and why the other cards are sitting there.</p>"
      }
    }
  ]
};

const AIDIXIT_EXPLAIN = {
  phase: { zh: "当前阶段。story 是讲述者出题，submit 是其他玩家出牌，vote 是投票。", en: "Current phase. story is the storyteller's clue, submit is the other players picking cards, vote is the guessing round." },
  round: { zh: "当前是第几轮，每轮结束后讲述者顺时针轮换。", en: "Which round is being played. The storyteller role rotates clockwise after each round." },
  storyteller: { zh: "本轮的讲述者(Storyteller)，由他出题并且不参与投票。", en: "This round's storyteller, who gives the clue and never votes." },
  clue: { zh: "讲述者本轮写下的线索，所有人都能看到它。", en: "The clue the storyteller wrote this round. Everybody can read it." },
  target: { zh: "获胜所需的目标分数，默认是 30 分。", en: "The score needed to win, 30 points by default." },
  deck: { zh: "牌库里还剩多少张可以发的牌。", en: "How many cards are left in the deck to deal." },
  discard: { zh: "弃牌堆里已经用过的牌，牌库抽空时可能会被洗回去。", en: "Cards already used this game. They may be shuffled back once the deck runs out." },
  submitted: { zh: "你本轮是否已经交出牌。", en: "Whether you have already submitted a card this round." },
  voted: { zh: "你本轮是否已经投票，投完之后不能改票。", en: "Whether you have already voted this round. A vote cannot be changed." },
  winner: { zh: "整局游戏的获胜者，分数并列时会一起显示。", en: "The winners of the whole game. Tied players are listed together." },
  clue_input: { zh: "在这里写下你的线索，可以是单词、句子或者一个梗，只有轮到你当讲述者(Storyteller)时才能输入。", en: "Write your clue here. It can be a word, a sentence, or an inside joke, and only the storyteller may type in it." },
  submit_story: { zh: "把选中的手牌和线索一起提交，本轮你的牌不会公开。", en: "Submit the selected hand card together with your clue. Your card stays hidden this round." },
  submit_card: { zh: "交出选中的手牌去混淆视听，系统收齐所有人的牌后会打乱展示。", en: "Submit the selected hand card as your decoy. All cards are shuffled and revealed once everyone has submitted." },
  submit_vote: { zh: "把票投给选中的牌，指认它是讲述者(Storyteller)的那张。", en: "Vote for the selected card, claiming it is the storyteller's card." },
  hand: { zh: "你的手牌，每轮结束时会被补回 6 张。", en: "Your hand, which is refilled to 6 cards at the end of every round." },
  hand_card: { zh: "一张手牌。点击选中它，然后按 Submit Story 或 Submit Card 把它交出去。", en: "One hand card. Click to select it, then press Submit Story or Submit Card to play it." },
  pool: { zh: "本轮所有玩家交上来的牌，打乱后一起亮在这里。", en: "Every card submitted this round, shuffled and revealed together." },
  pool_card: { zh: "一张候选牌。点击选中它再按 Vote 投票，你不能投给自己交的那张。", en: "One candidate card. Click to select it and press Vote. You cannot vote for your own card." },
  zoom: { zh: "放大镜(🔍)按钮，点开可以看清这张牌的细节。", en: "The magnifier (🔍) button opens a larger view so you can study the card." },
  vote_count: { zh: "这张牌收到的票数。", en: "How many votes this card received." },
  story_badge: { zh: "Story 标记，表示这张牌就是讲述者(Storyteller)出的那张。", en: "The Story badge marks the card the storyteller actually played." },
  result_card: { zh: "上一轮的一张牌，上面的数字是它得到的票数，下方的彩色圆点(●)是投给它的玩家。", en: "One card from last round. The number is its vote count and the colour dots (●) below are the players who voted for it." },
  vote_dots: { zh: "投给这张牌的玩家，用他们各自的颜色圆点(●)表示。", en: "The players who voted for this card, shown as colour dots (●) in their own colours." },
  round_notice: { zh: "上一轮的结算记录，会一直保留到本轮结束。", en: "The scoring summary of the previous round, kept until the current round ends." },
  round_result: { zh: "上一轮的结果，包括讲述者、线索、猜中的人以及每个人的得分变化。", en: "Last round's outcome, including the storyteller, the clue, who guessed correctly, and every score change." },
  players: { zh: "所有玩家的当前分数，讲述者(Storyteller)会被标出来。", en: "All players with their current scores. The storyteller is marked." },
  zoom_close: { zh: "关闭放大的卡牌详情。", en: "Close the enlarged card view." }
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAidixitHelpExplain);
} else {
  initAidixitHelpExplain();
}

let aidixitDecksLoaded = false;
let aidixitDecks = [];
let aidixitDeckSelections = new Set();
let aidixitSelectedHandCardId = null;
let aidixitSelectedVoteCardId = null;

let currentAidixitView = null;

const aidixitConfigBox = document.getElementById("aidixitConfigBox");
const aidixitDeckRow = document.getElementById("aidixitDeckRow");
const aidixitDeckOptions = document.getElementById("aidixitDeckOptions");
const aidixitPanel = document.getElementById("aidixitPanel");
const aidixitPhaseLabel = document.getElementById("aidixitPhase");
const aidixitRoundLabel = document.getElementById("aidixitRound");
const aidixitStorytellerLabel = document.getElementById("aidixitStoryteller");
const aidixitClueLabel = document.getElementById("aidixitClue");
const aidixitTargetScoreLabel = document.getElementById("aidixitTargetScore");
const aidixitDeckCountLabel = document.getElementById("aidixitDeckCount");
const aidixitDiscardCountLabel = document.getElementById("aidixitDiscardCount");
const aidixitSubmittedLabel = document.getElementById("aidixitSubmitted");
const aidixitVotedLabel = document.getElementById("aidixitVoted");
const aidixitWinnerLabel = document.getElementById("aidixitWinner");
const aidixitClueInput = document.getElementById("aidixitClueInput");
const aidixitSubmitStoryBtn = document.getElementById("aidixitSubmitStoryBtn");
const aidixitSubmitCardBtn = document.getElementById("aidixitSubmitCardBtn");
const aidixitSubmitVoteBtn = document.getElementById("aidixitSubmitVoteBtn");
const aidixitHand = document.getElementById("aidixitHand");
const aidixitPool = document.getElementById("aidixitPool");
const aidixitRoundNotice = document.getElementById("aidixitRoundNotice");
const aidixitRoundNoticeBody = document.getElementById("aidixitRoundNoticeBody");
const aidixitRoundNoticeCards = document.getElementById("aidixitRoundNoticeCards");
const aidixitPlayers = document.getElementById("aidixitPlayers");
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
  setModalVisible(aidixitZoomModal, false);
  aidixitZoomImage.src = "";
}

function clearAidixitState() {
  currentAidixitView = null;
  aidixitSelectedHandCardId = null;
  aidixitSelectedVoteCardId = null;
  if (aidixitPhaseLabel) {
    aidixitPhaseLabel.textContent = "-";
  }
  if (aidixitRoundLabel) {
    aidixitRoundLabel.textContent = "-";
  }
  if (aidixitStorytellerLabel) {
    aidixitStorytellerLabel.textContent = "-";
  }
  if (aidixitClueLabel) {
    aidixitClueLabel.textContent = "-";
  }
  if (aidixitTargetScoreLabel) {
    aidixitTargetScoreLabel.textContent = "-";
  }
  if (aidixitDeckCountLabel) {
    aidixitDeckCountLabel.textContent = "-";
  }
  if (aidixitDiscardCountLabel) {
    aidixitDiscardCountLabel.textContent = "-";
  }
  if (aidixitSubmittedLabel) {
    aidixitSubmittedLabel.textContent = "-";
  }
  if (aidixitVotedLabel) {
    aidixitVotedLabel.textContent = "-";
  }
  if (aidixitWinnerLabel) {
    aidixitWinnerLabel.textContent = "-";
  }
  if (aidixitClueInput) {
    aidixitClueInput.value = "";
    aidixitClueInput.disabled = true;
  }
  if (aidixitHand) {
    aidixitHand.innerHTML = "";
  }
  if (aidixitPool) {
    aidixitPool.innerHTML = "";
  }
  if (aidixitRoundNotice) {
    aidixitRoundNotice.classList.add("hidden");
  }
  if (aidixitRoundNoticeBody) {
    aidixitRoundNoticeBody.textContent = "-";
  }
  if (aidixitRoundNoticeCards) {
    aidixitRoundNoticeCards.innerHTML = "";
  }
  if (aidixitPlayers) {
    aidixitPlayers.innerHTML = "";
  }
  updateAidixitButtons();
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

function createAidixitCardElement(card, options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "aidixit-card";
  if (options.selected) {
    wrapper.classList.add("selected");
  }
  if (options.disabled) {
    wrapper.classList.add("disabled");
  }
  if (options.story) {
    wrapper.classList.add("story");
  }
  const img = document.createElement("img");
  const cardId = card.card_id || "";
  img.src = card.image_url || aidixitCardUrl(cardId);
  img.alt = cardId || "card";
  if (options.explain) {
    img.dataset.aidixitExplain = options.explain;
  }
  // Overlays are appended before the image so Explain mode resolves the
  // smallest element under the pointer instead of the whole card.
  if (options.zoomable) {
    const zoomBtn = document.createElement("button");
    zoomBtn.type = "button";
    zoomBtn.className = "aidixit-zoom-btn";
    zoomBtn.setAttribute("aria-label", "Zoom card");
    zoomBtn.title = "Zoom";
    zoomBtn.dataset.aidixitExplain = "zoom";
    zoomBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openAidixitZoom(img.src, img.alt);
    });
    wrapper.appendChild(zoomBtn);
  }
  if (options.count !== undefined) {
    const badge = document.createElement("div");
    badge.className = "aidixit-card-count";
    badge.dataset.aidixitExplain = "vote_count";
    badge.textContent = String(options.count);
    wrapper.appendChild(badge);
  }
  if (options.story) {
    const label = document.createElement("div");
    label.className = "aidixit-card-story";
    label.dataset.aidixitExplain = "story_badge";
    label.textContent = "Story";
    wrapper.appendChild(label);
  }
  wrapper.appendChild(img);
  return wrapper;
}

function renderAidixitHand(view) {
  if (!aidixitHand) {
    return;
  }
  aidixitHand.innerHTML = "";
  if (!Array.isArray(view.hand) || !view.hand.length) {
    aidixitHand.textContent = "-";
    return;
  }
  const isStoryteller = view.storyteller_id === view.you;
  const canSelect = (view.phase === "story" && isStoryteller) || (view.phase === "submit" && !isStoryteller);
  const locked = view.game_over || !canSelect || view.submitted;
  view.hand.forEach((card) => {
    const selected = aidixitSelectedHandCardId === card.card_id;
    const cardEl = createAidixitCardElement(card, { selected, disabled: locked, zoomable: true, explain: "hand_card" });
    if (!locked) {
      cardEl.addEventListener("click", () => {
        aidixitSelectedHandCardId = card.card_id;
        updateAidixitButtons();
        renderAidixitHand(view);
      });
    }
    aidixitHand.appendChild(cardEl);
  });
}

function renderAidixitPool(view) {
  if (!aidixitPool) {
    return;
  }
  aidixitPool.innerHTML = "";
  if (view.phase !== "vote") {
    aidixitPool.textContent = "-";
    return;
  }
  const isStoryteller = view.storyteller_id === view.you;
  const selectedVoteId = view.voted ? view.vote_card_id : aidixitSelectedVoteCardId;
  const disableAll = view.game_over || view.voted || isStoryteller;
  const poolCards = Array.isArray(view.pool_cards) ? view.pool_cards : [];
  if (!poolCards.length) {
    aidixitPool.textContent = "-";
    return;
  }
  poolCards.forEach((card) => {
    const isOwn = view.your_submission === card.card_id;
    const selected = selectedVoteId === card.card_id;
    const cardEl = createAidixitCardElement(card, {
      selected,
      disabled: disableAll || isOwn,
      zoomable: true,
      explain: "pool_card",
    });
    if (!disableAll && !isOwn) {
      cardEl.addEventListener("click", () => {
        aidixitSelectedVoteCardId = card.card_id;
        updateAidixitButtons();
        renderAidixitPool(view);
      });
    }
    aidixitPool.appendChild(cardEl);
  });
}

function renderAidixitPlayers(view) {
  if (!aidixitPlayers) {
    return;
  }
  aidixitPlayers.innerHTML = "";
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (p.player_id === view.storyteller_id) {
      card.classList.add("current");
    }

    const header = document.createElement("div");
    header.className = "player-header";
    const nameRow = document.createElement("div");
    nameRow.className = "player-name";
    const colorDot = document.createElement("span");
    colorDot.className = "aidixit-color-dot";
    colorDot.style.backgroundColor = p.color || "#9ca3af";
    nameRow.appendChild(colorDot);
    const nameText = document.createElement("span");
    nameText.textContent = p.name;
    nameRow.appendChild(nameText);
    header.appendChild(nameRow);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const score = document.createElement("span");
    score.className = "badge";
    score.textContent = `score ${p.score}`;
    badges.appendChild(score);
    if (p.player_id === view.storyteller_id) {
      const storyteller = document.createElement("span");
      storyteller.className = "badge highlight";
      storyteller.textContent = "storyteller";
      badges.appendChild(storyteller);
    }
    if (p.player_id === view.you) {
      const you = document.createElement("span");
      you.className = "badge";
      you.textContent = "you";
      badges.appendChild(you);
    }
    if (p.is_bot) {
      const bot = document.createElement("span");
      bot.className = "badge";
      bot.textContent = "bot";
      badges.appendChild(bot);
    }
    header.appendChild(badges);

    card.appendChild(header);
    aidixitPlayers.appendChild(card);
  });
}

function renderAidixitRoundNotice(view) {
  if (!aidixitRoundNotice || !aidixitRoundNoticeBody) {
    return;
  }
  const result = view.last_result;
  if (!result) {
    aidixitRoundNotice.classList.add("hidden");
    if (aidixitRoundNoticeCards) {
      aidixitRoundNoticeCards.innerHTML = "";
    }
    return;
  }
  aidixitRoundNotice.classList.remove("hidden");
  const caseMap = {
    all: "All guessed (too obvious)",
    none: "None guessed (too obscure)",
    partial: "Some guessed",
  };
  const label = caseMap[result.case] || result.case || "Round";
  const correctNames = Array.isArray(result.correct_voters) && result.correct_voters.length
    ? result.correct_voters.map((pid) => findPlayerName(view, pid)).join(", ")
    : "none";
  const scoreEntries = result.scores_delta || {};
  const scoreSummary = Object.keys(scoreEntries)
    .map((pid) => {
      const delta = scoreEntries[pid];
      const sign = delta >= 0 ? "+" : "";
      return `${findPlayerName(view, pid)} ${sign}${delta}`;
    })
    .join(", ");
  const clue = result.clue || view.clue || "-";
  const storytellerName = result.storyteller_id ? findPlayerName(view, result.storyteller_id) : "-";
  aidixitRoundNoticeBody.textContent =
    `Storyteller: ${storytellerName} · Clue: ${clue} · ${label} · Correct: ${correctNames}` +
    (scoreSummary ? ` · Scores: ${scoreSummary}` : "");

  if (aidixitRoundNoticeCards) {
    aidixitRoundNoticeCards.innerHTML = "";
    const voteCounts = result.vote_counts || {};
    const votesByCard = result.votes_by_card || {};
    let cardIds = Array.isArray(result.pool_cards) ? result.pool_cards : [];
    if (!cardIds.length) {
      cardIds = Object.keys(voteCounts);
    }
    if (result.story_card && !cardIds.includes(result.story_card)) {
      cardIds = [...cardIds, result.story_card];
    }
    cardIds.forEach((cardId) => {
      const count = voteCounts[cardId];
      const card = { card_id: cardId, image_url: aidixitCardUrl(cardId) };
      const cardEl = createAidixitCardElement(card, {
        count: typeof count === "number" ? count : undefined,
        story: cardId === result.story_card,
        disabled: true,
        zoomable: true,
        explain: "result_card",
      });
      const votes = (votesByCard && votesByCard[cardId]) || [];
      if (votes.length) {
        const voteRow = document.createElement("div");
        voteRow.className = "aidixit-votes";
        voteRow.dataset.aidixitExplain = "vote_dots";
        votes.forEach((vote) => {
          const dot = document.createElement("span");
          dot.className = "aidixit-vote-dot";
          if (vote.color) {
            dot.style.backgroundColor = vote.color;
          }
          if (vote.name) {
            dot.title = vote.name;
          }
          voteRow.appendChild(dot);
        });
        cardEl.appendChild(voteRow);
      }
      aidixitRoundNoticeCards.appendChild(cardEl);
    });
  }
}

function updateAidixitButtons() {
  if (!aidixitSubmitStoryBtn || !aidixitSubmitCardBtn || !aidixitSubmitVoteBtn) {
    return;
  }
  const view = currentAidixitView;
  if (!view || currentGameType !== "aidixit") {
    aidixitSubmitStoryBtn.disabled = true;
    aidixitSubmitCardBtn.disabled = true;
    aidixitSubmitVoteBtn.disabled = true;
    return;
  }
  const isStoryteller = view.storyteller_id === view.you;
  const clueReady = aidixitClueInput && aidixitClueInput.value.trim().length > 0;
  const canStory =
    !view.game_over &&
    view.phase === "story" &&
    isStoryteller &&
    !!aidixitSelectedHandCardId &&
    clueReady;
  const canSubmit =
    !view.game_over &&
    view.phase === "submit" &&
    !isStoryteller &&
    !view.submitted &&
    !!aidixitSelectedHandCardId;
  const canVote =
    !view.game_over &&
    view.phase === "vote" &&
    !isStoryteller &&
    !view.voted &&
    !!aidixitSelectedVoteCardId &&
    aidixitSelectedVoteCardId !== view.your_submission;
  aidixitSubmitStoryBtn.disabled = !canStory;
  aidixitSubmitCardBtn.disabled = !canSubmit;
  aidixitSubmitVoteBtn.disabled = !canVote;
}

function renderAidixitGameState(data) {
  const view = data.view;
  currentAidixitView = view;
  if (currentGameType !== "aidixit") {
    currentGameType = "aidixit";
    setGamePanelVisibility("aidixit");
  }
  if (
    aidixitSelectedHandCardId &&
    (!Array.isArray(view.hand) || !view.hand.some((card) => card.card_id === aidixitSelectedHandCardId))
  ) {
    aidixitSelectedHandCardId = null;
  }
  if (
    aidixitSelectedVoteCardId &&
    (!Array.isArray(view.pool_cards) || !view.pool_cards.some((card) => card.card_id === aidixitSelectedVoteCardId))
  ) {
    aidixitSelectedVoteCardId = null;
  }
  if (view.phase !== "vote") {
    aidixitSelectedVoteCardId = null;
  }

  if (aidixitPhaseLabel) {
    aidixitPhaseLabel.textContent = view.phase || "-";
  }
  if (aidixitRoundLabel) {
    aidixitRoundLabel.textContent = view.round ?? "-";
  }
  if (aidixitStorytellerLabel) {
    aidixitStorytellerLabel.textContent = view.storyteller_id
      ? findPlayerName(view, view.storyteller_id)
      : "-";
  }
  if (aidixitClueLabel) {
    aidixitClueLabel.textContent = view.clue || "-";
  }
  if (aidixitTargetScoreLabel) {
    aidixitTargetScoreLabel.textContent = view.target_score ?? "-";
  }
  if (aidixitDeckCountLabel) {
    aidixitDeckCountLabel.textContent = view.deck_count ?? "-";
  }
  if (aidixitDiscardCountLabel) {
    aidixitDiscardCountLabel.textContent = view.discard_count ?? "-";
  }
  if (aidixitSubmittedLabel) {
    aidixitSubmittedLabel.textContent = view.submitted ? "yes" : "no";
  }
  if (aidixitVotedLabel) {
    aidixitVotedLabel.textContent = view.voted ? "yes" : "no";
  }
  if (aidixitWinnerLabel) {
    if (Array.isArray(view.winner) && view.winner.length) {
      const names = view.winner.map((pid) => findPlayerName(view, pid));
      aidixitWinnerLabel.textContent = names.join(", ");
    } else {
      aidixitWinnerLabel.textContent = "-";
    }
  }

  const isStoryteller = view.storyteller_id === view.you;
  if (aidixitClueInput) {
    const canEdit = !view.game_over && view.phase === "story" && isStoryteller;
    aidixitClueInput.disabled = !canEdit;
    if (!canEdit) {
      aidixitClueInput.value = "";
    }
  }

  renderAidixitHand(view);
  renderAidixitPool(view);
  renderAidixitPlayers(view);
  renderAidixitRoundNotice(view);
  logGameEvents(data);
  updateAidixitButtons();
}

if (aidixitZoomCloseBtn) {
  aidixitZoomCloseBtn.addEventListener("click", () => {
    closeAidixitZoom();
  });
}

if (aidixitZoomModal) {
  aidixitZoomModal.addEventListener("click", (event) => {
    if (event.target === aidixitZoomModal) {
      closeAidixitZoom();
    }
  });
}

if (aidixitClueInput) {
  aidixitClueInput.addEventListener("input", () => updateAidixitButtons());
}

if (aidixitSubmitStoryBtn) {
  aidixitSubmitStoryBtn.addEventListener("click", () => {
    if (!currentAidixitView) {
      log("Game not ready");
      return;
    }
    const cardId = aidixitSelectedHandCardId;
    if (!cardId) {
      log("Select a card");
      return;
    }
    const clue = aidixitClueInput ? aidixitClueInput.value.trim() : "";
    if (!clue) {
      log("Enter a clue");
      return;
    }
    sendAction({ type: "submit_story", card_id: cardId, clue });
    aidixitSelectedHandCardId = null;
    if (aidixitClueInput) {
      aidixitClueInput.value = "";
    }
    updateAidixitButtons();
  });
}

if (aidixitSubmitCardBtn) {
  aidixitSubmitCardBtn.addEventListener("click", () => {
    if (!currentAidixitView) {
      log("Game not ready");
      return;
    }
    const cardId = aidixitSelectedHandCardId;
    if (!cardId) {
      log("Select a card");
      return;
    }
    sendAction({ type: "submit_card", card_id: cardId });
    aidixitSelectedHandCardId = null;
    updateAidixitButtons();
  });
}

if (aidixitSubmitVoteBtn) {
  aidixitSubmitVoteBtn.addEventListener("click", () => {
    if (!currentAidixitView) {
      log("Game not ready");
      return;
    }
    const cardId = aidixitSelectedVoteCardId;
    if (!cardId) {
      log("Select a card to vote");
      return;
    }
    if (cardId === currentAidixitView.your_submission) {
      log("Cannot vote for your own card");
      return;
    }
    sendAction({ type: "submit_vote", card_id: cardId });
    aidixitSelectedVoteCardId = null;
    updateAidixitButtons();
  });
}
