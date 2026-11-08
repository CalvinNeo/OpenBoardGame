// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const skullHelpButton = document.getElementById("skullHelpBtn");
const skullExplainButton = document.getElementById("skullExplainBtn");

const SKULL_HELP_CONFIG = {
  gameId: "skull",
  title: { zh: "骷髅与玫瑰 · Skull", en: "Skull" },
  basic: {
    win: {
      zh: "率先赢下两轮的玩家获得整局胜利。",
      en: "The first player to win two rounds wins the game."
    },
    turn: {
      zh: "轮到你时，你可以从手牌打出一张扣到自己面前的牌堆，或者在条件满足时开口竞价。",
      en: "On your turn you either play one card face down onto your own pile, or open the bidding once the conditions allow it."
    },
    key: {
      zh: "你要猜出场上总共扣着多少张玫瑰(🌹)，并用一个刚好能兑现的竞价把自己推上挑战者的位置。",
      en: "Guess how many roses (🌹) are hidden on the table, then bid exactly the number you can actually deliver to become the challenger."
    }
  },
  sections: [
    {
      id: "cards",
      label: { zh: "牌与目标", en: "Cards and goal" },
      html: {
        zh: "<p>每位玩家开局持有四张牌：三张玫瑰(🌹)和一张骷髅(💀)。这些牌会一直重复使用，不会被洗回牌库。</p>"
          + "<p>每轮结束时，所有玩家扣下的牌都会收回手中，因此你的牌只会因为翻到骷髅(💀)而永久减少。</p>"
          + "<p>赢下一轮记一次胜利，先拿到两次胜利的玩家结束整局。如果某位玩家的牌全部输光，他会立即被淘汰。</p>",
        en: "<p>Every player starts with four cards: three roses (🌹) and one skull (💀). These cards are reused and are never shuffled back into a deck.</p>"
          + "<p>At the end of each round every face-down card returns to its owner's hand, so your cards only disappear when you reveal a skull (💀).</p>"
          + "<p>Winning a round scores one victory. The first player to reach two victories ends the game. A player who loses every card is eliminated at once.</p>"
      }
    },
    {
      id: "playing",
      label: { zh: "放牌阶段", en: "Playing cards" },
      html: {
        zh: "<p>轮到你时，从手牌选一张并按下 Play Card，它会面朝下扣在你自己的牌堆上。其他玩家只能看到你扣了几张，看不到内容。</p>"
          + "<p>你也可以不继续放牌，直接开口竞价。竞价的条件是场上至少已经扣了一张牌，并且要么所有存活玩家都已经放过牌，要么你自己的手牌已经打空。</p>"
          + "<p>一旦有人开口竞价，放牌阶段立刻结束，没有人能再补扣牌。</p>",
        en: "<p>On your turn, select a card from your hand and press Play Card to place it face down on your own pile. Other players only see how many cards you stacked, never what they are.</p>"
          + "<p>Instead of stacking another card you may open the bidding. Bidding requires at least one card on the table and either every surviving player has already played, or your own hand is empty.</p>"
          + "<p>The moment someone opens the bidding, the playing phase ends and nobody may stack another card.</p>"
      }
    },
    {
      id: "bidding",
      label: { zh: "竞价阶段", en: "Bidding" },
      html: {
        zh: "<p>开口竞价的人报出一个数字，表示他承诺能翻出这么多张玫瑰(🌹)。之后按座位顺序轮流表态。</p>"
          + "<p>轮到你时只有两个选择：Raise Bid 报出一个更大的数字，或者 Pass 退出本轮竞价。</p>"
          + "<p>加价的上限是场上扣着的牌的总数，因为你不可能翻出比所有牌更多的玫瑰(🌹)。</p>"
          + "<p>当只剩下一个人没有 Pass 时，竞价结束，这个人成为挑战者，进入翻牌阶段。</p>",
        en: "<p>The player who opens the bidding names a number, promising to reveal that many roses (🌹). Play then continues clockwise.</p>"
          + "<p>On your turn you have exactly two options: Raise Bid with a higher number, or Pass and drop out of this round.</p>"
          + "<p>The maximum bid equals the total number of face-down cards on the table, because you cannot reveal more roses (🌹) than there are cards.</p>"
          + "<p>When only one player has not passed, the bidding ends and that player becomes the challenger.</p>"
      }
    },
    {
      id: "reveal",
      label: { zh: "翻牌阶段", en: "Revealing" },
      html: {
        zh: "<p>挑战者必须先把自己牌堆上的牌全部翻完，然后才能去翻别人的牌堆。</p>"
          + "<p>先在 Targets 中选中一名玩家，再按 Reveal，翻开他牌堆最上面的一张。每翻到一张玫瑰(🌹)，计数就加一。</p>"
          + "<p>当你翻出的玫瑰(🌹)数量达到竞价数字时，本轮立刻成功，你获得一次胜利，并且由你开始下一轮。</p>"
          + "<p>翻谁完全由你决定，因此把骷髅(💀)藏在别人堆里的玩家，往往正是你要提防的人。</p>",
        en: "<p>The challenger must reveal every card on their own pile before touching anyone else's pile.</p>"
          + "<p>Select a player under Targets and press Reveal to turn over the top card of that pile. Each rose (🌹) adds one to your count.</p>"
          + "<p>As soon as your revealed roses (🌹) reach the bid, the round succeeds immediately, you score a victory, and you start the next round.</p>"
          + "<p>You alone choose whose pile to flip, so the players who hid a skull (💀) under your nose are exactly the ones to watch.</p>"
      }
    },
    {
      id: "penalty",
      label: { zh: "失败与淘汰", en: "Failing and elimination" },
      html: {
        zh: "<p>只要翻到一张骷髅(💀)，本轮立刻失败，无论你已经翻出了多少张玫瑰(🌹)。</p>"
          + "<p>失败的挑战者会随机永久失去自己的一张牌，可能来自手牌、自己的牌堆，或者本轮已经翻开的牌。</p>"
          + "<p>如果这次失去让他一张牌都不剩，他就被淘汰出局。下一轮由他的下家开始。</p>"
          + "<p>因此高竞价是一场赌博：报得越高，你必须翻开的牌就越多，撞上骷髅(💀)的机会也越大。</p>",
        en: "<p>Revealing a single skull (💀) ends the round in failure, no matter how many roses (🌹) you had already turned over.</p>"
          + "<p>A failed challenger permanently loses one random card of their own. It may come from the hand, the pile, or the cards already revealed this round.</p>"
          + "<p>If that loss leaves the player with no cards at all, they are eliminated. The next round then starts with the player after them.</p>"
          + "<p>A high bid is therefore a gamble: the higher you bid, the more cards you must reveal, and the more likely you hit a skull (💀).</p>"
      }
    }
  ]
};

const SKULL_EXPLAIN = {
  phase: { zh: "当前阶段。playing 是放牌，bidding 是竞价，reveal 是翻牌。", en: "Current phase: playing stacks cards, bidding sets the challenge, reveal turns cards over." },
  round: { zh: "当前是第几轮。", en: "Which round is being played." },
  turn: { zh: "现在轮到谁行动。", en: "Whose turn it is right now." },
  bid: { zh: "当前的竞价数字，也就是挑战者承诺要翻出的玫瑰(🌹)数量。", en: "The current bid, meaning how many roses (🌹) the challenger promised to reveal." },
  bidder: { zh: "当前出价最高的玩家，也就是将要翻牌的挑战者。", en: "The highest bidder, who becomes the challenger that reveals cards." },
  passed: { zh: "已经退出本轮竞价的玩家。", en: "Players who already dropped out of this round's bidding." },
  roses: { zh: "本轮已经翻出的玫瑰(🌹)数量。达到竞价数字时本轮成功。", en: "Roses (🌹) revealed so far this round. Reaching the bid wins the round." },
  last_reveal: { zh: "最近一次翻开的牌属于谁、是什么牌。", en: "Who owned the most recently revealed card and what it was." },
  winner: { zh: "整局游戏的获胜者。", en: "The winner of the whole game." },
  hand: { zh: "你的手牌。点击一张牌来选中它，然后按 Play Card 扣到自己的牌堆。", en: "Your hand. Click a card to select it, then press Play Card to stack it on your pile." },
  selected: { zh: "你当前选中的手牌。", en: "The hand card you currently have selected." },
  clear: { zh: "取消当前的选牌和选目标。", en: "Clear the selected card and target." },
  bid_input: { zh: "输入你要报出的竞价数字，上限是场上扣着的牌的总数。", en: "Type the number you want to bid. It cannot exceed the total face-down cards on the table." },
  play_card: { zh: "把选中的手牌面朝下扣到自己的牌堆上。", en: "Place the selected hand card face down on your own pile." },
  start_bid: { zh: "开口竞价，结束放牌阶段。要求场上已有扣牌，并且所有人放过牌或你手牌已空。", en: "Open the bidding and end the playing phase. Requires cards on the table and either everyone has played or your hand is empty." },
  raise_bid: { zh: "报出比当前竞价更大的数字，继续留在竞价中。", en: "Bid a number higher than the current bid and stay in the auction." },
  pass_bid: { zh: "退出本轮竞价，把挑战者的位置让给别人。", en: "Drop out of this round's bidding and let someone else challenge." },
  reveal_card: { zh: "翻开选中目标牌堆最上面的一张牌。你必须先翻完自己的牌堆。", en: "Reveal the top card of the selected target's pile. You must clear your own pile first." },
  selected_target: { zh: "你当前选中要翻牌的目标玩家。", en: "The player whose pile you currently plan to reveal." },
  targets: { zh: "可以翻牌的目标玩家列表。点击一名玩家来选中他。", en: "Players whose piles you may reveal. Click one to select it." },
  players: { zh: "所有玩家的状态，包括扣牌数量和已获得的胜利次数。", en: "All players with their stacked card counts and rounds won." }
};

let skullHelpWidget = null;
let skullExplainWidget = null;

function initSkullHelpExplain() {
  if (skullHelpWidget || typeof window.obgCreateHelp !== "function") return;
  skullHelpWidget = window.obgCreateHelp(SKULL_HELP_CONFIG);
  skullExplainWidget = window.obgCreateExplain({
    gameId: "skull",
    attribute: "data-skull-explain",
    explanations: SKULL_EXPLAIN,
    button: skullExplainButton,
    root: () => document.getElementById("skullPanel"),
    bypass: ["#skullHelpBtn", "#skullExplainBtn"]
  });
  skullHelpButton?.addEventListener("click", () => {
    skullExplainWidget?.exit();
    skullHelpWidget.open();
  });
  skullExplainButton?.addEventListener("click", () => skullExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSkullHelpExplain);
} else {
  initSkullHelpExplain();
}

let currentSkullView = null;
let skullSelectedCardIndex = null;
let skullSelectedCardType = null;
let skullSelectedTarget = null;

const skullPhaseLabel = document.getElementById("skullPhase");
const skullRoundLabel = document.getElementById("skullRound");
const skullTurnLabel = document.getElementById("skullTurn");
const skullBidLabel = document.getElementById("skullBid");
const skullBidderLabel = document.getElementById("skullBidder");
const skullPassedLabel = document.getElementById("skullPassed");
const skullRosesLabel = document.getElementById("skullRoses");
const skullLastRevealLabel = document.getElementById("skullLastReveal");
const skullWinnerLabel = document.getElementById("skullWinner");
const skullHand = document.getElementById("skullHand");
const skullSelectedCardLabel = document.getElementById("skullSelectedCard");
const skullTargetSelection = document.getElementById("skullTargetSelection");
const skullTargets = document.getElementById("skullTargets");
const skullPlayers = document.getElementById("skullPlayers");
const skullBidInput = document.getElementById("skullBidInput");
const skullPlayBtn = document.getElementById("skullPlayBtn");
const skullStartBidBtn = document.getElementById("skullStartBidBtn");
const skullRaiseBidBtn = document.getElementById("skullRaiseBidBtn");
const skullPassBidBtn = document.getElementById("skullPassBidBtn");
const skullRevealBtn = document.getElementById("skullRevealBtn");
const skullClearSelectionBtn = document.getElementById("skullClearSelection");

const skullActionButtons = {
  play_card: skullPlayBtn,
  start_bid: skullStartBidBtn,
  raise_bid: skullRaiseBidBtn,
  pass_bid: skullPassBidBtn,
  reveal_card: skullRevealBtn,
};

function updateSkullSelectedCard() {
  skullSelectedCardLabel.textContent = skullSelectedCardType || "-";
}

function updateSkullTargetSelection() {
  if (!skullSelectedTarget || !currentSkullView) {
    skullTargetSelection.textContent = "-";
    return;
  }
  const player = currentSkullView.players.find((p) => p.player_id === skullSelectedTarget);
  skullTargetSelection.textContent = player ? player.name : skullSelectedTarget;
}

function clearSkullSelection() {
  skullSelectedCardIndex = null;
  skullSelectedCardType = null;
  skullSelectedTarget = null;
  updateSkullSelectedCard();
  updateSkullTargetSelection();
  updateSkullActionButtons();
  if (currentSkullView) {
    renderSkullHand(currentSkullView);
    renderSkullTargets(currentSkullView);
  }
}

function renderSkullHand(view) {
  skullHand.innerHTML = "";
  if (!Array.isArray(view.hand) || !view.hand.length) {
    skullHand.textContent = "-";
    updateSkullSelectedCard();
    return;
  }
  view.hand.forEach((card, idx) => {
    const div = document.createElement("div");
    div.className = "slot";
    div.textContent = card;
    if (idx === skullSelectedCardIndex) {
      div.classList.add("selected");
    }
    div.addEventListener("click", () => {
      skullSelectedCardIndex = idx;
      skullSelectedCardType = card;
      updateSkullSelectedCard();
      updateSkullActionButtons();
      renderSkullHand(view);
    });
    skullHand.appendChild(div);
  });
}

function getSkullRevealTargets(view) {
  if (view.phase !== "reveal" || view.you !== view.bidder) {
    return [];
  }
  const you = view.players.find((p) => p.player_id === view.you);
  if (you && you.pile_count > 0) {
    return [view.you];
  }
  return view.players
    .filter((p) => !p.eliminated && p.pile_count > 0)
    .map((p) => p.player_id);
}

function renderSkullTargets(view) {
  skullTargets.innerHTML = "";
  const allowedTargets = getSkullRevealTargets(view);
  view.players.forEach((p) => {
    if (p.eliminated) {
      return;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "target-player";
    if (allowedTargets.includes(p.player_id)) {
      wrapper.classList.add("selectable");
    } else {
      wrapper.classList.add("disabled");
    }
    if (skullSelectedTarget === p.player_id) {
      wrapper.classList.add("selected");
    }
    wrapper.textContent = `${p.name} (pile ${p.pile_count})`;
    wrapper.addEventListener("click", () => {
      if (!allowedTargets.includes(p.player_id)) {
        return;
      }
      skullSelectedTarget = p.player_id;
      updateSkullTargetSelection();
      updateSkullActionButtons();
      renderSkullTargets(view);
    });
    skullTargets.appendChild(wrapper);
  });
  updateSkullTargetSelection();
}

function renderSkullPlayers(view) {
  skullPlayers.innerHTML = "";
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
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
    meta.className = "player-meta";
    const status = p.eliminated ? "out" : "in";
    meta.textContent = `hand ${p.hand_count} | pile ${p.pile_count} | wins ${p.rounds_won} | ${status}`;
    card.appendChild(name);
    card.appendChild(meta);
    skullPlayers.appendChild(card);
  });
}

function isSkullActionAvailable(actionType) {
  if (!currentSkullView || !Array.isArray(currentSkullView.legal_actions)) {
    return false;
  }
  if (!currentSkullView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "play_card") {
    return !!skullSelectedCardType;
  }
  if (actionType === "start_bid" || actionType === "raise_bid") {
    const bid = Number.parseInt(skullBidInput.value, 10);
    return Number.isInteger(bid) && bid > 0;
  }
  if (actionType === "reveal_card") {
    const allowedTargets = getSkullRevealTargets(currentSkullView);
    return !!skullSelectedTarget && allowedTargets.includes(skullSelectedTarget);
  }
  return true;
}

function updateSkullActionButtons() {
  if (currentGameType !== "skull") {
    Object.values(skullActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(skullActionButtons).forEach(([actionType, button]) => {
    const allowed = isSkullActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
}

function clearSkullState() {
  currentSkullView = null;
  skullSelectedCardIndex = null;
  skullSelectedCardType = null;
  skullSelectedTarget = null;
  skullPhaseLabel.textContent = "-";
  skullRoundLabel.textContent = "-";
  skullTurnLabel.textContent = "-";
  skullBidLabel.textContent = "-";
  skullBidderLabel.textContent = "-";
  skullPassedLabel.textContent = "-";
  skullRosesLabel.textContent = "-";
  skullLastRevealLabel.textContent = "-";
  skullWinnerLabel.textContent = "-";
  skullHand.innerHTML = "";
  skullSelectedCardLabel.textContent = "-";
  skullTargetSelection.textContent = "-";
  skullTargets.innerHTML = "";
  skullPlayers.innerHTML = "";
  updateSkullActionButtons();
}

function renderSkullGameState(data) {
  const view = data.view;
  currentSkullView = view;
  if (currentGameType !== "skull") {
    currentGameType = "skull";
    setGamePanelVisibility("skull");
  }
  if (skullSelectedTarget && !view.players.find((p) => p.player_id === skullSelectedTarget)) {
    skullSelectedTarget = null;
  }
  if (skullSelectedCardIndex !== null && (!view.hand || skullSelectedCardIndex >= view.hand.length)) {
    skullSelectedCardIndex = null;
    skullSelectedCardType = null;
  }

  skullPhaseLabel.textContent = view.phase;
  skullRoundLabel.textContent = view.round;
  const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
  skullTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  skullBidLabel.textContent = view.current_bid ?? "-";
  skullBidderLabel.textContent = view.bidder ? findPlayerName(view, view.bidder) : "-";
  if (Array.isArray(view.passed) && view.passed.length) {
    skullPassedLabel.textContent = view.passed.map((pid) => findPlayerName(view, pid)).join(", ");
  } else {
    skullPassedLabel.textContent = "-";
  }
  skullRosesLabel.textContent = view.roses_revealed ?? "-";
  if (view.last_reveal) {
    skullLastRevealLabel.textContent = `${findPlayerName(view, view.last_reveal.player_id)} -> ${view.last_reveal.card}`;
  } else {
    skullLastRevealLabel.textContent = "-";
  }
  skullWinnerLabel.textContent = view.winner ? findPlayerName(view, view.winner) : "-";

  renderSkullHand(view);
  renderSkullTargets(view);
  renderSkullPlayers(view);

  logGameEvents(data);

  if (view.last_round_summary) {
    const summary = view.last_round_summary;
    if (summary.result === "success") {
      log(`Round success: bidder ${findPlayerName(view, summary.bidder)} bid ${summary.bid}`);
    } else {
      log(`Round fail: bidder ${findPlayerName(view, summary.bidder)} hit ${findPlayerName(view, summary.skull_owner)}`);
    }
  }

  updateSkullSelectedCard();
  updateSkullTargetSelection();
  updateSkullActionButtons();
}

if (skullClearSelectionBtn) {
  skullClearSelectionBtn.addEventListener("click", () => {
    clearSkullSelection();
  });
}

if (skullBidInput) {
  skullBidInput.addEventListener("input", () => {
    updateSkullActionButtons();
  });
}

if (skullPlayBtn) {
  skullPlayBtn.addEventListener("click", () => {
    if (!skullSelectedCardType) {
      log("Select a card to play");
      return;
    }
    sendAction({ type: "play_card", card_type: skullSelectedCardType });
    clearSkullSelection();
  });
}

if (skullStartBidBtn) {
  skullStartBidBtn.addEventListener("click", () => {
    const bid = Number.parseInt(skullBidInput.value, 10);
    if (!Number.isInteger(bid)) {
      log("Enter a bid number");
      return;
    }
    sendAction({ type: "start_bid", bid });
  });
}

if (skullRaiseBidBtn) {
  skullRaiseBidBtn.addEventListener("click", () => {
    const bid = Number.parseInt(skullBidInput.value, 10);
    if (!Number.isInteger(bid)) {
      log("Enter a bid number");
      return;
    }
    sendAction({ type: "raise_bid", bid });
  });
}

if (skullPassBidBtn) {
  skullPassBidBtn.addEventListener("click", () => {
    sendAction({ type: "pass_bid" });
  });
}

if (skullRevealBtn) {
  skullRevealBtn.addEventListener("click", () => {
    if (!skullSelectedTarget) {
      log("Select a reveal target");
      return;
    }
    sendAction({ type: "reveal_card", target_player_id: skullSelectedTarget });
    skullSelectedTarget = null;
    updateSkullTargetSelection();
    updateSkullActionButtons();
  });
}
