// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const coyoteHelpButton = document.getElementById("coyoteHelpBtn");
const coyoteExplainButton = document.getElementById("coyoteExplainBtn");

const COYOTE_HELP_CONFIG = {
  gameId: "coyote",
  title: { zh: "郊狼 · Coyote", en: "Coyote" },
  basic: {
    win: {
      zh: "每轮质疑结算之后会有一方记一次惩罚，惩罚累计到上限就被淘汰，最后仍留在场上的那位玩家赢下整局。",
      en: "Every showdown gives one penalty to the losing side, and reaching the penalty limit knocks a player out, so the last player left in the game wins it all."
    },
    turn: {
      zh: "轮到你时，你要么报一个比当前数字更大的价来赌总和足够大，要么在已经有人报价之后直接质疑他。",
      en: "On your turn you either name a number higher than the current bid to bet that the total is big enough, or you challenge the player who bid before you."
    },
    key: {
      zh: "你只看得见自己面前的那一张牌，必须靠别人报出的数字去推断所有人的牌加起来究竟是多少。",
      en: "You can only see the single card in front of you, so you have to read the bids around the table to work out what every card really adds up to."
    }
  },
  sections: [
    {
      id: "cards",
      label: { zh: "牌与信息", en: "Cards and information" },
      html: {
        zh: "<p>牌堆里绝大多数是数字牌：0 到 5 各四张，10 三张，15 两张，20 一张，另外还有 -5 两张和 -10 一张，所以总和既可能被抬高也可能被压低。</p>"
          + "<p>每轮开始时，仍在场上的每位玩家都会拿到一张牌，牌面朝向别人而背朝向你，也就是说你只看得到自己的那一张。</p>"
          + "<p>牌堆里还混着三张特殊牌：Max->0、? 和 x2，它们只有在质疑结算时才会露面。</p>",
        en: "<p>The deck is mostly number cards: four each of 0 through 5, three 10s, two 15s, one 20, plus two -5s and one -10, so the total can be pushed up or pulled down.</p>"
          + "<p>At the start of a round every surviving player is dealt one card facing outward, which means the only card you can read is your own.</p>"
          + "<p>Three special cards are shuffled in as well, namely Max->0, ? and x2, and they only show themselves when a challenge is settled.</p>"
      }
    },
    {
      id: "bidding",
      label: { zh: "报价与质疑", en: "Bidding and challenging" },
      html: {
        zh: "<p>第一位行动的玩家必须先开价，因为场上还没有任何数字可供质疑。</p>"
          + "<p>此后轮到的每位玩家都有两个选择：报出一个比当前更大的数字，或者按下 Challenge 质疑上一个报价。</p>"
          + "<p>报价没有硬性上限，但数字越夸张，被质疑时输掉的机会也越大。</p>"
          + "<p>郊狼(🐺)的全部乐趣就在这里，你要在虚张声势和见好就收之间反复权衡。</p>",
        en: "<p>The first player to act has to open with a bid, because there is no number on the table to challenge yet.</p>"
          + "<p>Every player after that faces exactly two options: name a number higher than the current bid, or press Challenge against the bid before them.</p>"
          + "<p>There is no hard ceiling on a bid, but the more outrageous the number, the more likely you lose when someone calls it.</p>"
          + "<p>That tension is the whole of Coyote(🐺), a constant balance between bluffing big and settling early.</p>"
      }
    },
    {
      id: "specials",
      label: { zh: "三张特殊牌", en: "The three special cards" },
      html: {
        zh: "<p>Max->0 会把当前总和里最大的那个正数直接抹掉，每有一张就抹掉一个，已经没有正数时它什么也不做。</p>"
          + "<p>? 会从牌堆里再翻一张牌并立刻结算它，如果翻到的还是 ?，就继续往下翻，直到翻出别的牌为止。</p>"
          + "<p>x2 会把最后算出的总和翻倍，场上出现两张 x2 时总和会变成四倍。</p>"
          + "<p>这三张牌在下注阶段完全看不见，所以任何一次报价都带着它们带来的不确定性。</p>",
        en: "<p>Max->0 wipes the largest positive number out of the running total, once for each copy on the table, and does nothing when no positive number is left.</p>"
          + "<p>? draws one more card from the deck and resolves it immediately, and if that card is another ? it keeps drawing until something else turns up.</p>"
          + "<p>x2 doubles the final total, so two copies on the table make the total four times as large.</p>"
          + "<p>None of the three is visible while you are bidding, which is why every bid carries their uncertainty with it.</p>"
      }
    },
    {
      id: "total",
      label: { zh: "总和怎么算", en: "How the total is counted" },
      html: {
        zh: "<p>质疑发生后，所有还在场上的玩家的牌同时公开，并按一个固定顺序算出真实总和。</p>"
          + "<p>先把所有数字牌相加，再按 Max->0 的张数依次抹掉最大的正数，接着结算 ? 翻出来的每一张牌，最后才乘上 x2 的倍数。</p>"
          + "<p>如果真实总和小于被质疑的报价，质疑成功，报价的人受罚。只要总和达到或者超过报价，质疑的人受罚。</p>"
          + "<p>Last Round 面板会把这轮的总和、每张牌和特殊牌的效果全部列出来。</p>",
        en: "<p>Once a challenge happens, every surviving player's card is revealed at the same time and the true total is counted in a fixed order.</p>"
          + "<p>First all number cards are added up, then Max->0 removes the largest positive numbers one by one, then every card drawn by ? is resolved, and only at the end is the total multiplied by x2.</p>"
          + "<p>If the true total is lower than the bid being challenged, the challenge succeeds and the bidder is punished. If the total reaches or beats the bid, the challenger is punished instead.</p>"
          + "<p>The Last Round panel lists the total, every card, and what each special card did.</p>"
      }
    },
    {
      id: "penalty",
      label: { zh: "惩罚与淘汰", en: "Penalties and elimination" },
      html: {
        zh: "<p>输掉的一方立刻记一次惩罚，默认上限是三次惩罚，Players 里的 penalties 会显示当前的进度。</p>"
          + "<p>惩罚达到上限的玩家被淘汰，之后他的牌不再参与任何一轮的总和计算。</p>"
          + "<p>下一轮由输掉的一方先行动，如果他刚被淘汰，就改由他的下家开始。</p>"
          + "<p>当场上只剩一位玩家时整局结束，他就是 Winner。</p>",
        en: "<p>The losing side immediately takes one penalty, the limit is three by default, and the penalties counter on each player card shows how far along you are.</p>"
          + "<p>A player who reaches the limit is eliminated, and from then on their card never counts toward a total again.</p>"
          + "<p>The next round is opened by the player who lost, or by the next player in seat order when that loser has just been eliminated.</p>"
          + "<p>As soon as a single player remains, the game ends and that player is the Winner.</p>"
      }
    }
  ]
};

const COYOTE_EXPLAIN = {
  phase: { zh: "当前阶段。bidding 是报价阶段，game_over 表示整局已经结束。", en: "Current phase: bidding is the auction, game_over means the whole game has ended." },
  round: { zh: "当前是第几轮。每一次质疑结算之后就会进入新一轮。", en: "Which round is being played. Every settled challenge starts a new round." },
  turn: { zh: "现在轮到谁报价或者质疑。", en: "Whose turn it is to bid or to challenge." },
  round_notice: { zh: "上一轮的结算结果，包括报价、真实总和、输家以及特殊牌的效果，最下面还会提醒你上轮自己那张牌是什么。", en: "The previous round's result with the bid, the true total, the loser and every special card effect, plus a reminder of what your own card was." },
  players: { zh: "所有玩家围坐在牌桌上。card 是这位玩家面前的牌，你只能看见自己的，其余显示为 Hidden。penalties 是他已经吃到的惩罚次数，达到上限就会被淘汰。", en: "Every player seated at the table. The card line shows the card in front of them, and you can only read your own while the rest stay Hidden. The penalties line counts the punishments taken so far, and hitting the limit means elimination." },
  last_bid: { zh: "当前场上的最高报价，也就是所有人正在赌的那个总和数字。", en: "The highest bid on the table, meaning the total that everyone is currently betting on." },
  bidder: { zh: "报出这个数字的玩家。质疑成功时受罚的就是他。", en: "The player who named that number. He is the one punished when a challenge succeeds." },
  winner: { zh: "整局游戏最后的获胜者，也就是唯一没有被淘汰的玩家。", en: "The winner of the whole game, meaning the only player never eliminated." },
  bid_minus: { zh: "把输入框里的报价减一，最低只能减到当前报价加一。", en: "Lower the bid in the input by one, never below the current bid plus one." },
  bid_input: { zh: "输入你要报出的数字，必须比当前报价更大。", en: "Type the number you want to bid. It has to be higher than the current bid." },
  bid_plus: { zh: "把输入框里的报价加一。", en: "Raise the bid in the input by one." },
  bid: { zh: "确认报价。你的报价会被所有人看到，并且成为别人质疑的目标。", en: "Confirm the bid. Everyone sees your number, and it becomes the target of the next challenge." },
  challenge: { zh: "质疑上一个报价，立刻公开所有人的牌并结算总和。猜小了由报价者受罚，猜大了由你受罚。", en: "Challenge the last bid, which reveals every card and counts the total at once. If the total is lower the bidder is punished, and if it is high enough you are punished." },
  reset: { zh: "整局结束后用同一批玩家重新开一局。", en: "Start a fresh game with the same players once the game is over." }
};

let coyoteHelpWidget = null;
let coyoteExplainWidget = null;

function initCoyoteHelpExplain() {
  if (coyoteHelpWidget || typeof window.obgCreateHelp !== "function") return;
  coyoteHelpWidget = window.obgCreateHelp(COYOTE_HELP_CONFIG);
  coyoteExplainWidget = window.obgCreateExplain({
    gameId: "coyote",
    attribute: "data-coyote-explain",
    explanations: COYOTE_EXPLAIN,
    button: coyoteExplainButton,
    root: () => document.getElementById("coyotePanel"),
    bypass: ["#coyoteHelpBtn", "#coyoteExplainBtn"]
  });
  coyoteHelpButton?.addEventListener("click", () => {
    coyoteExplainWidget?.exit();
    coyoteHelpWidget.open();
  });
  coyoteExplainButton?.addEventListener("click", () => coyoteExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCoyoteHelpExplain);
} else {
  initCoyoteHelpExplain();
}

let currentCoyoteView = null;

const coyotePhaseLabel = document.getElementById("coyotePhase");
const coyoteRoundLabel = document.getElementById("coyoteRound");
const coyoteTurnLabel = document.getElementById("coyoteTurn");
const coyoteBidLabel = document.getElementById("coyoteBid");
const coyoteBidderLabel = document.getElementById("coyoteBidder");
const coyoteWinnerLabel = document.getElementById("coyoteWinner");
const coyoteRoundNotice = document.getElementById("coyoteRoundNotice");
const coyoteRoundNoticeTitle = document.getElementById("coyoteRoundNoticeTitle");
const coyoteRoundNoticeBody = document.getElementById("coyoteRoundNoticeBody");
const coyoteBidInput = document.getElementById("coyoteBidInput");
const coyoteBidMinusBtn = document.getElementById("coyoteBidMinusBtn");
const coyoteBidPlusBtn = document.getElementById("coyoteBidPlusBtn");
const coyoteBidBtn = document.getElementById("coyoteBidBtn");
const coyoteChallengeBtn = document.getElementById("coyoteChallengeBtn");
const coyoteResetBtn = document.getElementById("coyoteResetBtn");
const coyotePlayers = document.getElementById("coyotePlayers");

const coyoteActionButtons = {
  bid: coyoteBidBtn,
  challenge: coyoteChallengeBtn,
};

function formatCoyoteSummary(view) {
  const summary = view.last_round_summary;
  if (!summary) {
    return "-";
  }
  const bidder = findPlayerName(view, summary.bidder);
  const challenger = findPlayerName(view, summary.challenger);
  const loser = findPlayerName(view, summary.loser);
  const result = summary.success ? "challenge success" : "challenge fail";
  let text = `${result}: bid ${summary.bid}, total ${summary.actual_total}, loser ${loser}`;
  if (Array.isArray(summary.mystery_draws)) {
    const draws = summary.mystery_draws.filter((item) => item);
    if (draws.length) {
      text += ` | ? draws ${draws.join(", ")}`;
    }
  }
  if (Array.isArray(summary.max_zero_applied) && summary.max_zero_applied.length) {
    text += ` | max->0 ${summary.max_zero_applied.join(", ")}`;
  }
  if (summary.x2_count) {
    text += ` | x${2 ** summary.x2_count}`;
  }
  text += ` | bidder ${bidder}, challenger ${challenger}`;
  return text;
}

function getCoyoteMinBid(view) {
  if (!view || view.last_bid === null || view.last_bid === undefined) {
    return 1;
  }
  return Number(view.last_bid) + 1;
}

function updateCoyoteBidInput(view, previousView) {
  if (!coyoteBidInput) {
    return;
  }
  const minBid = getCoyoteMinBid(view);
  coyoteBidInput.min = String(minBid);
  const current = Number.parseInt(coyoteBidInput.value, 10);
  const newRound = !previousView || previousView.round !== view.round;
  const shouldUpdate = !Number.isInteger(current) || current < minBid || (newRound && current !== minBid);
  if (shouldUpdate && document.activeElement !== coyoteBidInput) {
    coyoteBidInput.value = minBid;
  }
}

function updateCoyoteBidControls(view) {
  if (!coyoteBidInput || !coyoteBidMinusBtn || !coyoteBidPlusBtn) {
    return;
  }
  const canEdit =
    view &&
    Array.isArray(view.legal_actions) &&
    view.legal_actions.includes("bid") &&
    view.phase !== "game_over";
  coyoteBidInput.disabled = !canEdit;
  coyoteBidMinusBtn.disabled = !canEdit;
  coyoteBidPlusBtn.disabled = !canEdit;
  if (canEdit) {
    const minBid = getCoyoteMinBid(view);
    const current = Number.parseInt(coyoteBidInput.value, 10);
    coyoteBidMinusBtn.disabled = !Number.isInteger(current) || current <= minBid;
  }
}

function adjustCoyoteBid(delta) {
  if (!coyoteBidInput) {
    return;
  }
  const minBid = getCoyoteMinBid(currentCoyoteView);
  let current = Number.parseInt(coyoteBidInput.value, 10);
  if (!Number.isInteger(current)) {
    current = minBid;
  }
  const next = Math.max(minBid, current + delta);
  coyoteBidInput.value = next;
  updateCoyoteActionButtons();
}

function renderCoyoteRoundNotice(view) {
  if (!coyoteRoundNotice || !coyoteRoundNoticeBody) {
    return;
  }
  coyoteRoundNotice.classList.remove("hidden");
  while (coyoteRoundNoticeBody.firstChild) {
    coyoteRoundNoticeBody.removeChild(coyoteRoundNoticeBody.firstChild);
  }
  const summaryText = view.last_round_summary ? formatCoyoteSummary(view) : "No previous round yet.";
  const summaryLine = document.createElement("div");
  summaryLine.textContent = summaryText;
  coyoteRoundNoticeBody.appendChild(summaryLine);

  const yourCard = view.your_card || "-";
  const cardLine = document.createElement("div");
  cardLine.textContent = `Your hidden card: ${yourCard}`;
  coyoteRoundNoticeBody.appendChild(cardLine);
}

function renderCoyotePlayers(view) {
  if (!coyotePlayers) {
    return;
  }
  coyotePlayers.innerHTML = "";
  view.players.forEach((p, index) => {
    const card = document.createElement("div");
    card.className = "player-card coyote-player-card";
    const seatIndex = (index % 10) + 1;
    card.classList.add(`coyote-seat-${seatIndex}`);
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (p.eliminated) {
      card.classList.add("disabled");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name;
    const meta = document.createElement("div");
    meta.className = "player-meta coyote-player-meta";
    let cardLabel = p.card;
    if (!cardLabel && p.card_hidden) {
      cardLabel = "Hidden";
    } else if (!cardLabel) {
      cardLabel = "-";
    }
    const maxPenalties = view.config ? view.config.max_penalties : "-";
    const status = p.eliminated ? "out" : "in";
    const cardLine = document.createElement("div");
    cardLine.className = "coyote-player-meta-line";
    cardLine.append("card ");
    const cardValue = document.createElement("span");
    cardValue.textContent = cardLabel;
    if (cardLabel !== "-") {
      cardValue.className = "coyote-card-value";
    }
    cardLine.appendChild(cardValue);

    const penaltiesLine = document.createElement("div");
    penaltiesLine.className = "coyote-player-meta-line";
    penaltiesLine.textContent = `penalties ${p.penalties}/${maxPenalties}`;

    const statusLine = document.createElement("div");
    statusLine.className = "coyote-player-meta-line";
    statusLine.textContent = status;

    meta.append(cardLine, penaltiesLine, statusLine);
    card.appendChild(name);
    card.appendChild(meta);
    coyotePlayers.appendChild(card);
  });
}

function isCoyoteActionAvailable(actionType) {
  if (!currentCoyoteView || !Array.isArray(currentCoyoteView.legal_actions)) {
    return false;
  }
  if (!currentCoyoteView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "bid") {
    const bid = Number.parseInt(coyoteBidInput.value, 10);
    if (!Number.isInteger(bid) || bid < 1) {
      return false;
    }
    const lastBid = currentCoyoteView.last_bid;
    if (lastBid !== null && lastBid !== undefined && bid <= lastBid) {
      return false;
    }
  }
  return true;
}

function updateCoyoteActionButtons() {
  if (currentGameType !== "coyote") {
    Object.values(coyoteActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    updateCoyoteBidControls(null);
    return;
  }
  Object.entries(coyoteActionButtons).forEach(([actionType, button]) => {
    const allowed = isCoyoteActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
  updateCoyoteBidControls(currentCoyoteView);
}

function clearCoyoteState() {
  currentCoyoteView = null;
  coyotePhaseLabel.textContent = "-";
  coyoteRoundLabel.textContent = "-";
  coyoteTurnLabel.textContent = "-";
  coyoteBidLabel.textContent = "-";
  coyoteBidderLabel.textContent = "-";
  coyoteWinnerLabel.textContent = "-";
  if (coyoteRoundNotice) {
    coyoteRoundNotice.classList.add("hidden");
  }
  if (coyoteRoundNoticeBody) {
    coyoteRoundNoticeBody.textContent = "-";
  }
  if (coyoteBidInput) {
    coyoteBidInput.value = "";
  }
  if (coyoteResetBtn) {
    coyoteResetBtn.disabled = true;
  }
  coyotePlayers.innerHTML = "";
  updateCoyoteActionButtons();
}

function renderCoyoteGameState(data) {
  const view = data.view;
  const previousView = currentCoyoteView;
  currentCoyoteView = view;
  if (currentGameType !== "coyote") {
    currentGameType = "coyote";
    setGamePanelVisibility("coyote");
  }

  coyotePhaseLabel.textContent = view.phase || "-";
  coyoteRoundLabel.textContent = view.round ?? "-";
  const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
  coyoteTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  coyoteBidLabel.textContent = view.last_bid ?? "-";
  coyoteBidderLabel.textContent = view.last_bidder ? findPlayerName(view, view.last_bidder) : "-";
  coyoteWinnerLabel.textContent = view.winner ? findPlayerName(view, view.winner) : "-";

  if (coyoteRoundNoticeTitle) {
    coyoteRoundNoticeTitle.textContent = "Last Round";
  }
  renderCoyoteRoundNotice(view);
  updateCoyoteBidInput(view, previousView);
  updateCoyoteBidControls(view);

  renderCoyotePlayers(view);
  logGameEvents(data);
  updateCoyoteActionButtons();
  if (coyoteResetBtn) {
    coyoteResetBtn.disabled = !(view && view.game_over);
  }
}

if (coyoteBidInput) {
  coyoteBidInput.addEventListener("input", () => {
    updateCoyoteActionButtons();
  });
}

if (coyoteBidMinusBtn) {
  coyoteBidMinusBtn.addEventListener("click", () => {
    adjustCoyoteBid(-1);
  });
}

if (coyoteBidPlusBtn) {
  coyoteBidPlusBtn.addEventListener("click", () => {
    adjustCoyoteBid(1);
  });
}

if (coyoteBidBtn) {
  coyoteBidBtn.addEventListener("click", () => {
    const bid = Number.parseInt(coyoteBidInput.value, 10);
    if (!Number.isInteger(bid)) {
      log("Enter a bid number");
      return;
    }
    sendAction({ type: "bid", bid });
  });
}

if (coyoteChallengeBtn) {
  coyoteChallengeBtn.addEventListener("click", () => {
    sendAction({ type: "challenge" });
  });
}

if (coyoteResetBtn) {
  coyoteResetBtn.addEventListener("click", () => {
    emitRoomStart();
  });
}
