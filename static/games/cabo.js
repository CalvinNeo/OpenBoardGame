// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const caboHelpButton = document.getElementById("caboHelpBtn");
const caboExplainButton = document.getElementById("caboExplainBtn");

const CABO_HELP_CONFIG = {
  gameId: "cabo",
  title: { zh: "卡波 · Cabo", en: "Cabo" },
  basic: {
    win: {
      zh: "每位玩家都要避免成为总分最高的人，因为任何人的总分累计到 100 分时游戏立刻结束，此时总分最低的玩家赢下整局。",
      en: "Everyone is trying to avoid a high total, because the game ends the moment anybody reaches 100 points and the player with the lowest score at that moment wins."
    },
    turn: {
      zh: "轮到你时你要么从牌堆抽一张牌，要么拿走弃牌堆顶的那张明牌并替换掉自己的一张手牌，也可以一张都不抽就直接喊 Cabo。",
      en: "On your turn you either draw one card from the deck, or take the face-up card on the discard pile to replace one of your own cards, or skip drawing entirely and call Cabo."
    },
    key: {
      zh: "你要用手上看过的信息判断哪几张牌点数大、哪一张换掉最安全，赶在别人把分数拉开之前把自己四张手牌的总点数压到最低。",
      en: "Use the cards you have already seen to judge which ones are expensive and which one is safest to replace, then push the total value of your four cards below everyone else's before the scores run away."
    }
  },
  sections: [
    {
      id: "cards",
      label: { zh: "牌与目标", en: "Cards and goal" },
      html: {
        zh: "<p>牌堆由 0 到 13 的数字牌组成，每个数字各四张，点数越小越好。每位玩家在每一轮开始时拿到四张面朝下的手牌。</p>"
          + "<p>每轮开局先做 Initial Peek，你挑自己的两张牌看一眼并记住点数，之后它们会重新盖回去。</p>"
          + "<p>一轮结束时所有人的手牌都会亮开，把四张牌的点数加起来就是这一轮的分数，数字越小越有利。</p>",
        en: "<p>The deck is made of the numbers 0 to 13 with four copies of each, and low numbers are always better. Every player receives four face-down cards at the start of a round.</p>"
          + "<p>Each round opens with the Initial Peek, where you choose two of your own cards, look at them and memorise their values before they are turned back over.</p>"
          + "<p>At the end of a round every hand is revealed and the four values are added together, so a small total is exactly what you are playing for.</p>"
      }
    },
    {
      id: "turn",
      label: { zh: "抽牌与喊 Cabo", en: "Drawing and calling Cabo" },
      html: {
        zh: "<p>按 Draw Deck 从牌堆抽一张，这张牌只有你自己能看到。牌堆摸空时，弃牌堆会自动洗回去继续用。</p>"
          + "<p>你也可以点弃牌堆顶的那张明牌，它会换掉你选中的一张手牌，被换掉的旧牌进入弃牌堆，而这张新牌对所有人都是公开的。</p>"
          + "<p>如果你觉得自己的点数已经够低，按 Call Cabo 就能结束这一轮，从你之后每位玩家还各有一次行动机会。</p>",
        en: "<p>Press Draw Deck to take one card that only you get to see. When the deck runs out, the discard pile is shuffled back in and play continues.</p>"
          + "<p>You may also click the face-up card on top of the discard pile, which replaces one selected card in your hand. The old card goes onto the discard pile and the new one becomes public knowledge.</p>"
          + "<p>If you think your total is already low enough, press Call Cabo to close the round, which leaves every other player exactly one more turn.</p>"
      }
    },
    {
      id: "drawn",
      label: { zh: "抽到牌之后", en: "After drawing" },
      html: {
        zh: "<p>抽到牌之后有三种处理方式。选中自己的一张手牌再按 Replace / Match，新牌会换上去，旧牌进入弃牌堆。</p>"
          + "<p>按 Discard Drawn 则把这张牌直接丢进弃牌堆，你手上的牌一张都不会变。</p>"
          + "<p>如果你手上已经有几张点数相同的牌，可以同时选中两到四张再按 Replace / Match 尝试配对。配对成功时这些手牌连同刚抽到的牌一起进入弃牌堆，你的手牌就变少了。配对失败时被选中的牌会全部亮给所有人看，并且刚抽到的牌会塞进你的手牌，等于白白多拿一张。</p>",
        en: "<p>Once the card is in your hand you have three ways to deal with it. Select one of your own cards and press Replace / Match to swap the new card in and send the old one to the discard pile.</p>"
          + "<p>Press Discard Drawn to throw the new card straight onto the discard pile and leave your hand completely untouched.</p>"
          + "<p>If several of your cards share a value you can select two to four of them and press Replace / Match to attempt a match. A successful match sends those cards and the drawn card to the discard pile, which shrinks your hand. A failed match reveals every selected card to the table and adds the drawn card to your hand, so you end up holding one card more than before.</p>"
      }
    },
    {
      id: "powers",
      label: { zh: "能力牌", en: "Power cards" },
      html: {
        zh: "<p>7 和 8 带 Peek，抽到并弃掉它时可以偷看自己的一张手牌。</p>"
          + "<p>9 和 10 带 Spy，可以偷看任意一位对手的一张手牌，看完只有你自己知道。</p>"
          + "<p>11 和 12 带 Swap，可以把自己的一张手牌和对手的一张手牌对调，交换之后双方都不知道手里换成了什么。</p>"
          + "<p>能力必须在你抽到这张牌的同一个回合里发动，而且这张牌会被弃掉。你可以直接按 Use Choice 立刻发动，也可以先按 Discard Drawn 弃牌再决定，按 Skip Choice 则放弃这次能力。</p>",
        en: "<p>The 7 and 8 carry Peek, which lets you look at one card in your own hand.</p>"
          + "<p>The 9 and 10 carry Spy, which lets you look at one card in any opponent's hand, and only you learn what you saw.</p>"
          + "<p>The 11 and 12 carry Swap, which exchanges one of your cards with one of an opponent's cards, leaving both of you unsure about what you now hold.</p>"
          + "<p>A power only works on the turn you drew the card, and using it sends that card to the discard pile. Press Use Choice to trigger it right away, or press Discard Drawn first and decide afterwards, while Skip Choice lets the power go unused.</p>"
      }
    },
    {
      id: "scoring",
      label: { zh: "结算与胜负", en: "Scoring and winning" },
      html: {
        zh: "<p>按 Call Cabo 之后倒数的行动次数归零，本轮立刻结束并亮牌。</p>"
          + "<p>计分时手牌点数最小的玩家本轮加 0 分，其他人都要把自己的手牌点数加到总分上。</p>"
          + "<p>如果喊 Cabo 的人不是点数最小的那位，他还要额外再加 5 分，所以喊之前一定要有把握。</p>"
          + "<p>任何人的总分累计到 100 分时游戏结束，此时总分最低的玩家赢得整局。</p>",
        en: "<p>The round ends and every hand is revealed as soon as the countdown after Call Cabo reaches zero.</p>"
          + "<p>When scoring, the player with the lowest hand total adds nothing this round while everyone else adds their own hand total to their running score.</p>"
          + "<p>If the player who called Cabo does not hold the lowest total, they take 5 extra points on top, so only call it when you are confident.</p>"
          + "<p>The game ends as soon as anyone's score reaches 100, and the player with the lowest score at that moment wins.</p>"
      }
    }
  ]
};

const CABO_EXPLAIN = {
  phase: { zh: "当前阶段。initial_peek 是开局记牌，turn 是抽牌或喊 Cabo，drawn 是处理刚抽到的牌，choice_pending 是等待你发动能力，round_end 是本轮结算。", en: "Current phase: initial_peek memorises cards, turn is for drawing or calling Cabo, drawn is for handling the card you just took, choice_pending waits for a power, and round_end scores the round." },
  round: { zh: "当前是第几轮。", en: "Which round is being played." },
  turn: { zh: "现在轮到谁行动。", en: "Whose turn it is right now." },
  deck: { zh: "牌堆里还剩多少张牌。牌堆摸空之后弃牌堆会自动洗回去。", en: "How many cards are left in the deck. When it runs out the discard pile is shuffled back in." },
  cabo_called: { zh: "本轮是谁喊了 Cabo。喊过之后其他玩家每人只剩一次行动机会。", en: "Who called Cabo this round. After the call every other player has only one turn left." },
  cabo_left: { zh: "喊 Cabo 之后还剩几次行动机会，倒数到 0 时本轮结束并亮牌。", en: "How many turns remain after the Cabo call. The round ends and hands are revealed when this reaches zero." },
  pending_choice: { zh: "当前等待你发动的能力。peek 是看自己的牌，spy 是看对手的牌，swap 是和对手换牌。", en: "The power waiting to be used: peek looks at your own card, spy looks at an opponent's card, and swap exchanges cards with an opponent." },
  choice_hint: { zh: "针对当前这一步的操作提示，会跟着你手上的能力一起变化。", en: "A hint for the step you are on, updated to match the power you are holding." },
  hand: { zh: "你的四张手牌。数字是你已经知道的点数，问号表示你还没看过这张牌。点击一张牌就能选中它。", en: "Your four cards. A number is a value you already know and a question mark is a card you have not seen. Click a card to select it." },
  cancel: { zh: "取消当前的选牌和选目标。", en: "Clear the cards and targets you have selected." },
  last_drawn: { zh: "你刚刚抽到的那张牌，只有你自己能看到。如果它带能力，这里会标出 peek、spy 或 swap。", en: "The card you just drew, which only you can see. If it carries a power, peek, spy or swap is named here." },
  discard_drawn: { zh: "把刚抽到的牌直接弃掉。如果这张牌带能力，弃掉之后你还可以决定要不要发动。", en: "Discard the card you just drew. If it carries a power you may still decide to use it afterwards." },
  discard_top: { zh: "弃牌堆顶的那张明牌。选中自己的一张手牌再点它，就能用这张牌替换掉选中的手牌。", en: "The face-up card on top of the discard pile. Select one of your own cards and click here to replace it with this card." },
  initial_peek: { zh: "开局记牌。选中自己的两张手牌再按下它，你就能看到这两张牌的点数。", en: "The opening peek. Select two of your own cards and press this to learn their values." },
  draw_deck: { zh: "从牌堆抽一张牌，只有你自己知道它是什么。", en: "Draw one card from the deck. Only you get to see it." },
  replace_match: { zh: "选一张手牌时它会用刚抽到的牌替换这张手牌。选两到四张时它会尝试配对消牌，点数全部相同才算成功。", en: "With one card selected it swaps the drawn card into that slot. With two to four selected it attempts a match, which only succeeds when all of those cards share the same value." },
  call_cabo: { zh: "宣布本轮即将结束，之后其他玩家每人还有一次行动机会。如果你的点数不是最小的，你会额外加 5 分。", en: "Announce that the round is ending, leaving every other player one final turn. If your total is not the lowest you take 5 extra points." },
  use_choice: { zh: "发动刚抽到的牌的能力。按钮会变成 Peek、Spy 或 Swap，选好目标之后再按它。", en: "Trigger the power on the card you just drew. The button renames itself to Peek, Spy or Swap, and you select a target before pressing it." },
  skip_choice: { zh: "放弃当前这次能力，直接进入下一步。", en: "Give up the current power and move on." },
  next_round: { zh: "确认你已经看完本轮结算。所有玩家都按下之后才会开始下一轮。", en: "Confirm that you have read the round result. The next round only starts once every player has pressed it." },
  players: { zh: "所有玩家的手牌、手牌数量和总分。手牌上的问号表示你还不知道那是什么，就绪(✅ ready)表示他已经确认结算，等待(⏳ waiting)表示他还在看结果。", en: "Every player with their hand, hand size and total score. A question mark means you do not know that card, the ready badge (✅ ready) means the player confirmed the round result and the waiting badge (⏳ waiting) means they have not yet." }
};

let caboHelpWidget = null;
let caboExplainWidget = null;

function initCaboHelpExplain() {
  if (caboHelpWidget || typeof window.obgCreateHelp !== "function") return;
  caboHelpWidget = window.obgCreateHelp(CABO_HELP_CONFIG);
  caboExplainWidget = window.obgCreateExplain({
    gameId: "cabo",
    attribute: "data-cabo-explain",
    explanations: CABO_EXPLAIN,
    button: caboExplainButton,
    root: () => document.getElementById("caboPanel"),
    bypass: ["#caboHelpBtn", "#caboExplainBtn"]
  });
  caboHelpButton?.addEventListener("click", () => {
    caboExplainWidget?.exit();
    caboHelpWidget.open();
  });
  caboExplainButton?.addEventListener("click", () => caboExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCaboHelpExplain);
} else {
  initCaboHelpExplain();
}

const phaseLabel = document.getElementById("phaseLabel");
const roundLabel = document.getElementById("roundLabel");
const turnLabel = document.getElementById("turnLabel");
const deckCount = document.getElementById("deckCount");
const discardTop = document.getElementById("discardTop");
const lastDrawn = document.getElementById("lastDrawn");
const caboBy = document.getElementById("caboBy");
const caboLeft = document.getElementById("caboLeft");
const pendingChoice = document.getElementById("pendingChoice");
const caboChoiceHint = document.getElementById("caboChoiceHint");

const handSlots = document.getElementById("handSlots");
const selectedSlotsLabel = document.getElementById("selectedSlots");
const targetSelection = document.getElementById("targetSelection");
const targetList = document.getElementById("targetList");
const clearTargetBtn = document.getElementById("clearTarget");
const gamePlayers = document.getElementById("gamePlayers");

const actionButtons = {
  initial_peek: document.getElementById("peekBtn"),
  draw_deck: document.getElementById("drawDeckBtn"),
  draw_discard: discardTop,
  replace_or_match: document.getElementById("replaceBtn"),
  discard_drawn: document.getElementById("discardDrawnBtn"),
  call_cabo: document.getElementById("callCaboBtn"),
  use_choice_action: document.getElementById("choiceBtn"),
  skip_choice: document.getElementById("skipChoiceBtn"),
  next_round: document.getElementById("nextRoundBtn"),
};

const clearSelectionBtn = document.getElementById("clearSelection");

let currentCaboView = null;
let selectedSlots = [];
let selectedTarget = null;

const caboChoiceByValue = Object.freeze({
  7: "peek",
  8: "peek",
  9: "spy",
  10: "spy",
  11: "swap",
  12: "swap",
});

function getCaboActiveChoiceType(view = currentCaboView) {
  if (!view) {
    return null;
  }
  const canUseChoice =
    Array.isArray(view.legal_actions) && view.legal_actions.includes("use_choice_action");
  if (!canUseChoice) {
    return null;
  }
  if (view.pending_choice && view.pending_choice.type) {
    return view.pending_choice.type;
  }
  if (view.phase === "drawn") {
    return caboChoiceByValue[view.last_drawn] || null;
  }
  return null;
}

function updateCaboChoicePrompt() {
  const choiceType = getCaboActiveChoiceType();
  const buttonLabels = {
    peek: "Peek at Selected Card",
    spy: "Spy on Selected Card",
    swap: "Swap Selected Cards",
  };
  actionButtons.use_choice_action.textContent = buttonLabels[choiceType] || "Use Choice";

  if (!caboChoiceHint) {
    return;
  }
  const discardNote =
    currentCaboView && currentCaboView.phase === "drawn"
      ? "The drawn card will be discarded automatically, or press Discard Drawn to choose later."
      : "The choice card has already been discarded. Press Skip Choice to pass on it.";
  const promptByType = {
    peek: `Peek is ready: select one of your cards, then use Peek. ${discardNote}`,
    spy: `Spy is ready: select one highlighted opponent card, then use Spy. ${discardNote}`,
    swap: `Swap is ready: select one of your cards and one highlighted opponent card, then use Swap. ${discardNote}`,
  };
  const prompt = promptByType[choiceType] || "";
  caboChoiceHint.textContent = prompt;
  caboChoiceHint.classList.toggle("hidden", !prompt);
}

function getInitialPeekInactiveReason() {
  if (!currentCaboView) {
    return "Initial Peek inactive: no game view";
  }
  if (!Array.isArray(currentCaboView.legal_actions)) {
    return "Initial Peek inactive: legal actions unavailable";
  }
  if (!currentCaboView.legal_actions.includes("initial_peek")) {
    if (currentCaboView.phase !== "initial_peek") {
      return `Initial Peek inactive: phase is ${currentCaboView.phase}`;
    }
    const self = Array.isArray(currentCaboView.players)
      ? currentCaboView.players.find((p) => p.player_id === currentCaboView.you)
      : null;
    if (self && self.initial_peek_done) {
      return "Initial Peek inactive: already completed";
    }
    return `Initial Peek inactive: legal actions are ${JSON.stringify(currentCaboView.legal_actions)}`;
  }
  if (selectedSlots.length < 2) {
    return `Initial Peek inactive: select 2 slots (current ${selectedSlots.length})`;
  }
  if (selectedSlots.length > 2) {
    return `Initial Peek inactive: select only 2 slots (current ${selectedSlots.length})`;
  }
  return null;
}

function updateSelectedSlots() {
  if (selectedSlotsLabel) {
    selectedSlotsLabel.textContent = selectedSlots.length ? selectedSlots.join(", ") : "-";
  }
}

function updateTargetSelection() {
  if (!targetSelection) {
    return;
  }
  if (!selectedTarget || !currentCaboView) {
    targetSelection.textContent = "-";
    return;
  }
  const player = currentCaboView.players.find((p) => p.player_id === selectedTarget.playerId);
  if (!player) {
    targetSelection.textContent = "-";
    return;
  }
  targetSelection.textContent = `${player.name} #${selectedTarget.slot}`;
}

function clearTargetSelection() {
  selectedTarget = null;
  updateTargetSelection();
  updateActionButtons();
  if (currentCaboView) {
    renderGamePlayers(currentCaboView);
  }
}

function isCaboActionAvailable(actionType) {
  if (!currentCaboView || !Array.isArray(currentCaboView.legal_actions)) {
    return false;
  }
  if (actionType === "replace_or_match") {
    const canReplace = currentCaboView.legal_actions.includes("replace_card");
    const canMatch = currentCaboView.legal_actions.includes("attempt_match");
    if (selectedSlots.length >= 2) {
      return canMatch;
    }
    return selectedSlots.length >= 1 && canReplace;
  }
  if (!currentCaboView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "initial_peek") {
    return !getInitialPeekInactiveReason();
  }
  if (actionType === "draw_discard") {
    return selectedSlots.length >= 1;
  }
  if (actionType === "use_choice_action") {
    const choiceType = getCaboActiveChoiceType();
    if (!choiceType) return false;
    if (choiceType === "peek") {
      return selectedSlots.length >= 1;
    }
    if (choiceType === "spy") {
      return !!selectedTarget;
    }
    if (choiceType === "swap") {
      return !!selectedTarget && selectedSlots.length >= 1;
    }
  }
  return true;
}

function updateActionButtons() {
  updateCaboChoicePrompt();
  if (currentGameType !== "cabo") {
    Object.values(actionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(actionButtons).forEach(([actionType, button]) => {
    const allowed = isCaboActionAvailable(actionType);
    const inactiveReason = actionType === "initial_peek" ? getInitialPeekInactiveReason() : "";
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    if (actionType === "initial_peek" && currentGameType === "cabo") {
      button.disabled = false;
      button.title = inactiveReason || "";
    } else {
      button.disabled = !allowed;
      button.title = "";
    }
  });
}

function clearSelection() {
  selectedSlots = [];
  updateSelectedSlots();
  document.querySelectorAll(".slot").forEach((el) => {
    el.classList.remove("selected");
  });
  updateActionButtons();
}

function renderHand(view) {
  handSlots.innerHTML = "";
  const you = view.players.find((p) => p.player_id === view.you);
  const activeChoiceType = getCaboActiveChoiceType(view);
  const needsOwnChoiceCard = activeChoiceType === "peek" || activeChoiceType === "swap";
  if (!you) {
    handSlots.textContent = "-";
    return;
  }
  you.hand.forEach((slot, idx) => {
    const div = document.createElement("div");
    div.className = "slot";
    if (slot.empty) div.classList.add("empty");
    if (needsOwnChoiceCard && !slot.empty) {
      div.classList.add("cabo-choice-selectable");
      div.title =
        activeChoiceType === "peek" ? "Select this card to peek" : "Select this card to swap";
    }
    div.dataset.slot = idx;
    let label = "?";
    if (slot.empty) {
      label = "Empty";
    } else if (slot.known) {
      label = String(slot.value);
    }
    div.textContent = `#${idx} ${label}`;
    if (selectedSlots.includes(idx)) div.classList.add("selected");
    div.addEventListener("click", () => {
      if (slot.empty) {
        return;
      }
      if (selectedSlots.includes(idx)) {
        selectedSlots = selectedSlots.filter((s) => s !== idx);
        div.classList.remove("selected");
      } else {
        if (needsOwnChoiceCard && selectedSlots.length >= 1) {
          selectedSlots = [];
          handSlots.querySelectorAll(".slot.selected").forEach((slotElement) => {
            slotElement.classList.remove("selected");
          });
        } else if (
          currentCaboView &&
          currentCaboView.phase === "initial_peek" &&
          selectedSlots.length >= 2
        ) {
          selectedSlots = selectedSlots.slice(-1);
          handSlots.querySelectorAll(".slot.selected").forEach((slotElement) => {
            const slotIndex = Number(slotElement.dataset.slot);
            slotElement.classList.toggle("selected", selectedSlots.includes(slotIndex));
          });
        }
        selectedSlots.push(idx);
        div.classList.add("selected");
      }
      updateSelectedSlots();
      updateActionButtons();
    });
    handSlots.appendChild(div);
  });
}

function renderGamePlayers(view) {
  gamePlayers.innerHTML = "";
  const activeChoiceType = getCaboActiveChoiceType(view);
  const canSelectTarget = activeChoiceType === "spy" || activeChoiceType === "swap";
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }

    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name;
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const score = document.createElement("span");
    score.className = "badge";
    score.textContent = `score ${p.score}`;
    badges.appendChild(score);
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
    if (p.player_id === view.current_turn) {
      const turn = document.createElement("span");
      turn.className = "badge highlight";
      turn.textContent = "turn";
      badges.appendChild(turn);
    }
    if (view.phase === "round_end") {
      const ready = document.createElement("span");
      ready.className = "badge";
      ready.textContent = p.round_ready ? "✅ ready" : "⏳ waiting";
      badges.appendChild(ready);
    }
    header.appendChild(badges);

    const handRow = document.createElement("div");
    handRow.className = "player-hand";
    p.hand.forEach((slot, idx) => {
      const slotEl = document.createElement("div");
      slotEl.className = "player-slot";
      const isTargetPlayer = p.player_id !== view.you;
      const isSelectableTarget = canSelectTarget && isTargetPlayer && !slot.empty;
      if (slot.empty) {
        slotEl.classList.add("empty");
      }
      const label = slot.empty ? "Empty" : slot.known ? slot.value : "?";
      slotEl.textContent = `#${idx} ${label}`;
      if (
        selectedTarget &&
        selectedTarget.playerId === p.player_id &&
        selectedTarget.slot === idx
      ) {
        slotEl.classList.add("target-selected");
      }
      if (isSelectableTarget) {
        slotEl.classList.add("target-selectable");
        slotEl.title =
          activeChoiceType === "spy" ? "Select this card to spy" : "Select this card to swap";
        slotEl.addEventListener("click", () => {
          const isSameTarget =
            selectedTarget &&
            selectedTarget.playerId === p.player_id &&
            selectedTarget.slot === idx;
          selectedTarget = isSameTarget ? null : { playerId: p.player_id, slot: idx };
          updateTargetSelection();
          updateActionButtons();
          renderGamePlayers(view);
        });
      }
      handRow.appendChild(slotEl);
    });

    const meta = document.createElement("div");
    meta.className = "player-meta";
    meta.textContent = `cards ${p.hand_count}`;

    card.appendChild(header);
    card.appendChild(handRow);
    card.appendChild(meta);
    gamePlayers.appendChild(card);
  });
}

function renderTargets(view) {
  if (!targetList) {
    updateTargetSelection();
    return;
  }
  targetList.innerHTML = "";
  view.players
    .filter((p) => p.player_id !== view.you)
    .forEach((p) => {
      const wrapper = document.createElement("div");
      wrapper.className = "target-player";
      const title = document.createElement("div");
      title.textContent = p.name;
      wrapper.appendChild(title);

      const slotsRow = document.createElement("div");
      slotsRow.className = "target-slots";
      p.hand.forEach((slot, idx) => {
        const slotEl = document.createElement("div");
        slotEl.className = "target-slot";
        const label = slot.empty ? "Empty" : slot.known ? slot.value : "?";
        slotEl.textContent = `#${idx} ${label}`;
        if (
          selectedTarget &&
          selectedTarget.playerId === p.player_id &&
          selectedTarget.slot === idx
        ) {
          slotEl.classList.add("selected");
        }
        slotEl.addEventListener("click", () => {
          if (slot.empty) {
            log("Target slot is empty");
            return;
          }
          selectedTarget = { playerId: p.player_id, slot: idx };
          updateTargetSelection();
          updateActionButtons();
          renderTargets(view);
        });
        slotsRow.appendChild(slotEl);
      });
      wrapper.appendChild(slotsRow);
      targetList.appendChild(wrapper);
    });
  updateTargetSelection();
}

function clearCaboState() {
  currentCaboView = null;
  selectedSlots = [];
  selectedTarget = null;
  phaseLabel.textContent = "-";
  roundLabel.textContent = "-";
  turnLabel.textContent = "-";
  deckCount.textContent = "-";
  discardTop.textContent = "-";
  lastDrawn.textContent = "-";
  caboBy.textContent = "-";
  caboLeft.textContent = "-";
  pendingChoice.textContent = "-";
  if (caboChoiceHint) {
    caboChoiceHint.textContent = "";
    caboChoiceHint.classList.add("hidden");
  }
  handSlots.innerHTML = "";
  if (selectedSlotsLabel) {
    selectedSlotsLabel.textContent = "-";
  }
  if (targetSelection) {
    targetSelection.textContent = "-";
  }
  if (targetList) {
    targetList.innerHTML = "";
  }
  gamePlayers.innerHTML = "";
  updateActionButtons();
}

function renderCaboGameState(data) {
  const view = data.view;
  currentCaboView = view;
  if (currentGameType !== "cabo") {
    currentGameType = "cabo";
    setGamePanelVisibility("cabo");
  }
  const activeChoiceType = getCaboActiveChoiceType(view);
  const needsTarget = activeChoiceType === "spy" || activeChoiceType === "swap";
  if (!needsTarget) {
    selectedTarget = null;
  } else if (selectedTarget) {
    const targetPlayer = view.players.find((p) => p.player_id === selectedTarget.playerId);
    const targetSlot =
      targetPlayer && Array.isArray(targetPlayer.hand)
        ? targetPlayer.hand[selectedTarget.slot]
        : null;
    if (!targetPlayer || !targetSlot || targetSlot.empty) {
      selectedTarget = null;
    }
  }

  phaseLabel.textContent = view.phase;
  roundLabel.textContent = view.round;
  const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
  turnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn;
  deckCount.textContent = view.deck_count;
  discardTop.textContent = view.discard_top === null ? "-" : view.discard_top;
  if (view.last_drawn === null || view.last_drawn === undefined) {
    lastDrawn.textContent = "-";
  } else {
    const choice = caboChoiceByValue[view.last_drawn];
    lastDrawn.textContent = choice ? `${view.last_drawn} (${choice})` : String(view.last_drawn);
  }
  const caboCaller = view.players.find((p) => p.player_id === view.cabo_called_by);
  caboBy.textContent = caboCaller ? caboCaller.name : view.cabo_called_by || "-";
  caboLeft.textContent = view.cabo_turns_left || "-";
  pendingChoice.textContent = view.pending_choice ? view.pending_choice.type : "-";

  renderHand(view);
  renderGamePlayers(view);

  logGameEvents(data);

  if (view.last_round_summary) {
    const summary = view.last_round_summary;
    log(`Round summary: scores ${JSON.stringify(summary.round_scores)}`);
  }

  updateActionButtons();
}

if (clearSelectionBtn) {
  clearSelectionBtn.addEventListener("click", () => {
    clearSelection();
  });
}

if (clearTargetBtn) {
  clearTargetBtn.addEventListener("click", () => {
    clearTargetSelection();
  });
}

if (actionButtons.initial_peek) {
  actionButtons.initial_peek.addEventListener("click", () => {
    const reason = getInitialPeekInactiveReason();
    if (reason) {
      log(reason);
      return;
    }
    sendAction({ type: "initial_peek", slots: selectedSlots.slice(0, 2) });
    clearSelection();
  });
}

if (actionButtons.draw_deck) {
  actionButtons.draw_deck.addEventListener("click", () => {
    sendAction({ type: "draw_deck" });
  });
}

if (discardTop) {
  discardTop.addEventListener("click", () => {
    if (!selectedSlots.length) {
      log("Select a slot to replace from discard");
      return;
    }
    sendAction({ type: "draw_discard", slot: selectedSlots[0] });
    clearSelection();
  });
}

if (actionButtons.replace_or_match) {
  actionButtons.replace_or_match.addEventListener("click", () => {
    if (!selectedSlots.length) {
      log("Select 1 slot to replace or 2-4 slots to match");
      return;
    }
    if (selectedSlots.length >= 2) {
      sendAction({ type: "attempt_match", slots: selectedSlots.slice(0, 4) });
    } else {
      sendAction({ type: "replace_card", slot: selectedSlots[0] });
    }
    clearSelection();
  });
}

if (actionButtons.discard_drawn) {
  actionButtons.discard_drawn.addEventListener("click", () => {
    sendAction({ type: "discard_drawn" });
  });
}

if (actionButtons.call_cabo) {
  actionButtons.call_cabo.addEventListener("click", () => {
    sendAction({ type: "call_cabo" });
  });
}

if (actionButtons.next_round) {
  actionButtons.next_round.addEventListener("click", () => {
    sendAction({ type: "next_round" });
  });
}

if (actionButtons.skip_choice) {
  actionButtons.skip_choice.addEventListener("click", () => {
    sendAction({ type: "skip_choice" });
    clearSelection();
    clearTargetSelection();
  });
}

if (actionButtons.use_choice_action) {
  actionButtons.use_choice_action.addEventListener("click", () => {
    const choiceType = getCaboActiveChoiceType();
    if (!choiceType) {
      log("No choice action is available");
      return;
    }
    if (choiceType === "peek") {
      if (!selectedSlots.length) {
        log("Select one of your slots to peek");
        return;
      }
      const slot = selectedSlots[0];
      sendAction({
        type: "use_choice_action",
        choice_type: "peek",
        target: { slot },
      });
    } else if (choiceType === "spy") {
      if (!selectedTarget) {
        log("Select a target slot to spy");
        return;
      }
      sendAction({
        type: "use_choice_action",
        choice_type: "spy",
        target: { player_id: selectedTarget.playerId, slot: selectedTarget.slot },
      });
    } else if (choiceType === "swap") {
      if (!selectedTarget || !selectedSlots.length) {
        log("Select one of your slots and a target slot to swap");
        return;
      }
      const self = selectedSlots[0];
      sendAction({
        type: "use_choice_action",
        choice_type: "swap",
        target: {
          player_id: selectedTarget.playerId,
          slot: selectedTarget.slot,
          self_slot: self,
        },
      });
    }
    clearSelection();
    clearTargetSelection();
  });
}
