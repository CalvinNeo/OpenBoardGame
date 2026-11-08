// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const splendorHelpButton = document.getElementById("splendorHelpBtn");
const splendorExplainButton = document.getElementById("splendorExplainBtn");

const SPLENDOR_HELP_CONFIG = {
  gameId: "splendor",
  title: { zh: "璀璨宝石 · Splendor", en: "Splendor" },
  basic: {
    win: {
      zh: "先把声望点数堆到 15 分并撑过最后一轮的玩家获胜，而声望来自买下的发展卡和自动到访的贵族。",
      en: "The player who reaches 15 prestige points and survives the final round wins, and that prestige comes from the development cards you buy and the nobles who visit you."
    },
    turn: {
      zh: "轮到你时只能做一件事，要么拿取宝石，要么保留一张发展卡并换来黄金，要么买下一张市场或保留区里的发展卡。",
      en: "On your turn you do exactly one thing: take gems, reserve a development card to earn gold, or buy a development card from the market or your reserved area."
    },
    key: {
      zh: "每张买下的发展卡都会永久提供对应颜色的折扣，所以先用便宜的低层卡铺开折扣再去冲高层卡，远比一直攒宝石更快。",
      en: "Every card you buy permanently discounts its colour, so spreading cheap low-tier cards first and only then chasing expensive ones beats hoarding gems."
    }
  },
  sections: [
    {
      id: "tokens",
      label: { zh: "宝石与拿取", en: "Gems and taking" },
      html: {
        zh: "<p>场上有五种颜色宝石和一种万能的黄金(Gold)。界面上颜色用缩写表示，分别是白(W)、蓝(B)、绿(G)、红(R)、黑(K)，黄金直接写作 Gold。</p>"
          + "<p>按 Take 3 Different 可以一次拿走三种不同颜色各一枚，按 Take 2 Same 可以拿走同一颜色两枚，但要求该颜色在场上至少还剩四枚。</p>"
          + "<p>黄金不能主动拿取，只有保留发展卡时才会得到它，它可以代替任意一种颜色付款。</p>"
          + "<p>你手上的宝石总数不能超过十枚。一旦超过，你必须按 Discard Tokens 先弃回十枚以内，这一回合才算结束。</p>",
        en: "<p>The table holds five colours of gems plus wild Gold. The colours appear as short labels, white (W), blue (B), green (G), red (R) and black (K), while gold is written as Gold.</p>"
          + "<p>Take 3 Different grabs one gem of three different colours, and Take 2 Same grabs two gems of a single colour as long as at least four of that colour are still in the supply.</p>"
          + "<p>Gold can never be taken directly. You only receive it by reserving a development card, and it pays for any colour you happen to be short of.</p>"
          + "<p>You may never hold more than ten gems. If a take pushes you over the limit you must press Discard Tokens and drop back to ten before your turn can end.</p>"
      }
    },
    {
      id: "cards",
      label: { zh: "发展卡与折扣", en: "Development cards" },
      html: {
        zh: "<p>市场分成 Tier 1、Tier 2、Tier 3 三层，每层摆四张明牌，被买走或保留之后会立刻补上新卡。</p>"
          + "<p>卡名后括号里的数字是这张卡的声望点数，Bonus 表示买下它以后你会永久获得哪个颜色的折扣。</p>"
          + "<p>付款时先扣掉你已经拥有的同色折扣，剩下的部分才用宝石支付，缺哪一种颜色就用黄金(Gold)顶上。</p>"
          + "<p>零分的白板卡同样值得买，因为它提供的折扣会一直生效，让后面越来越贵的卡变得负担得起。</p>",
        en: "<p>The market is split into Tier 1, Tier 2 and Tier 3, each showing four face-up cards that refill the instant a card is bought or reserved.</p>"
          + "<p>The number in brackets after the card name is its prestige points, and Bonus tells you which colour this card discounts forever once you own it.</p>"
          + "<p>When paying you first subtract the discounts you already own, then spend gems on whatever remains, and any colour you are missing can be covered with Gold.</p>"
          + "<p>A card worth zero points is still worth buying, because its discount applies to every future purchase and makes the expensive cards affordable.</p>"
      }
    },
    {
      id: "reserve",
      label: { zh: "保留与黄金", en: "Reserving and gold" },
      html: {
        zh: "<p>按 Reserve Market 可以把选中的市场卡收进自己的保留区，同时立刻获得一枚黄金(Gold)，前提是场上还有黄金。</p>"
          + "<p>按 Reserve Deck 则是盲保留，先在下拉框里选好层数，再从那一层的牌堆顶拿走一张自己看不见的牌，同样会得到黄金。</p>"
          + "<p>保留区最多放三张卡，之后要用 Buy Reserved 才能把里面的牌买下来，所以随手保留会占住宝贵的位置。</p>"
          + "<p>保留最常见的用途是卡住对手想要的关键卡，或者提前锁定一张你现在买不起但很快就会需要的牌。</p>",
        en: "<p>Reserve Market moves the selected market card into your reserved area and immediately gives you one Gold, as long as any gold is left in the supply.</p>"
          + "<p>Reserve Deck is the blind version, where you pick a tier in the dropdown and take the unseen top card of that deck, again receiving gold.</p>"
          + "<p>You may hold at most three reserved cards, and each one only becomes yours through Buy Reserved, so careless reserving ties up your slots.</p>"
          + "<p>Reserving is the usual way to deny a key card to an opponent or to park a card you cannot afford yet but will need soon.</p>"
      }
    },
    {
      id: "nobles",
      label: { zh: "贵族", en: "Nobles" },
      html: {
        zh: "<p>贵族是开局就摆在桌上的奖励板块，数量比玩家人数多一张。</p>"
          + "<p>每位贵族都写着一组颜色要求，只要你在回合结束时拥有的同色折扣数量达标，他就会自动来到你这里。</p>"
          + "<p>如果你同时满足多位贵族的要求，游戏会让你按 Choose Noble 亲自挑一位，不会替你决定。</p>"
          + "<p>每位贵族值 3 点声望而且不花任何宝石，因此朝着某位贵族的颜色去凑折扣往往是最有效率的得分路线。</p>",
        en: "<p>Nobles are the reward tiles laid out from the start, always one more than the number of players.</p>"
          + "<p>Each noble lists a set of colour requirements, and as soon as your permanent discounts in those colours are high enough at the end of your turn, that noble comes to you automatically.</p>"
          + "<p>If you qualify for several nobles at once the game asks you to press Choose Noble and pick one yourself, so the decision is never made for you.</p>"
          + "<p>Every noble is worth 3 prestige points and costs no gems at all, which makes building your discounts towards a noble one of the most efficient ways to score.</p>"
      }
    },
    {
      id: "ending",
      label: { zh: "终局与胜负", en: "Ending and winning" },
      html: {
        zh: "<p>当你的声望点数在回合结束时达到 15 分，最后一轮立刻开始，从你之后每位玩家还有一次行动机会。</p>"
          + "<p>行动轮回到你这里时游戏结束，此时声望点数最高的玩家获胜。</p>"
          + "<p>如果点数打平，则由已购买发展卡数量更少的玩家胜出，因为他的分数来得更高效。</p>",
        en: "<p>The moment your prestige reaches 15 at the end of your turn the final round begins, and every other player gets one last turn.</p>"
          + "<p>The game ends when play comes back around to you, and the player holding the most prestige points wins.</p>"
          + "<p>If players tie on points, the one who owns fewer development cards wins, because those points were earned more efficiently.</p>"
      }
    }
  ]
};

const SPLENDOR_EXPLAIN = {
  phase: { zh: "当前阶段。turn 是正常行动，discard_tokens 是宝石超过十枚必须先弃牌，choose_noble 是要你在多位贵族中挑一位，game_over 是本局结束。", en: "Current phase: turn is a normal action, discard_tokens means you are over ten gems and must discard, choose_noble asks you to pick between several nobles, and game_over means the game has finished." },
  turn: { zh: "现在轮到谁行动。只有轮到自己时这些按钮才会亮起。", en: "Whose turn it is right now. The action buttons only light up on your own turn." },
  final_round: { zh: "最后一轮是否已经开始。有人达到 15 分之后，其他玩家各自还有最后一次行动机会。", en: "Whether the final round has started. Once somebody reaches 15 points, every other player gets one last turn." },
  winner: { zh: "本局的获胜者。点数打平时由发展卡更少的人胜出。", en: "The winner of the game. Ties on points are broken in favour of the player with fewer development cards." },
  supply: { zh: "场上每种宝石还剩多少枚，包括黄金(Gold)。颜色缩写是白(W)、蓝(B)、绿(G)、红(R)、黑(K)。", en: "How many gems of each colour are left in the supply, including Gold. The colours are labelled white (W), blue (B), green (G), red (R) and black (K)." },
  market_tier3: { zh: "第三层市场，这里是分数最高也最贵的发展卡。点击一张卡来选中它。", en: "The third market row, holding the highest scoring and most expensive development cards. Click a card to select it." },
  market_tier2: { zh: "第二层市场，卡的分数和价格都居中。点击一张卡来选中它。", en: "The second market row, where cards sit in the middle for both points and price. Click a card to select it." },
  market_tier1: { zh: "第一层市场，便宜而且大多只有折扣没有分数，是铺开折扣的起点。点击一张卡来选中它。", en: "The first market row, cheap cards that mostly give discounts rather than points and are the usual place to start an engine. Click a card to select it." },
  nobles: { zh: "桌上的贵族板块。只要你的同色折扣数量达到要求，回合结束时他就会自动归你。点击一位贵族可以选中他。", en: "The noble tiles on the table. A noble comes to you automatically at the end of a turn once your discounts meet its requirement. Click a noble to select it." },
  selected_market: { zh: "你当前选中的市场卡。买下或保留都会用掉这张卡。", en: "The market card you currently have selected. Buying or reserving will use this card." },
  selected_reserved: { zh: "你当前选中的保留卡。保留区里的牌只能用 Buy Reserved 买下。", en: "The reserved card you currently have selected. Cards in your reserved area can only be bought with Buy Reserved." },
  selected_noble: { zh: "你当前选中的贵族，在需要挑选贵族时才会用到。", en: "The noble you currently have selected, which matters when the game asks you to choose one." },
  clear: { zh: "取消当前选中的市场卡、保留卡、贵族和宝石数量。", en: "Clear the selected market card, reserved card, noble and gem counts." },
  reserve_tier: { zh: "选择 Reserve Deck 要盲保留哪一层的牌。层数越高，牌越贵也越强。", en: "Choose which tier Reserve Deck draws from blindly. Higher tiers hold stronger and more expensive cards." },
  token_selection: { zh: "在这里调整你要拿取或支付的宝石数量。点加号和减号，或者直接点色块左右两侧。", en: "Adjust how many gems of each colour you want to take or pay. Use the plus and minus buttons, or click the left and right half of a gem." },
  discard_selection: { zh: "当这次拿取会让你超过十枚宝石时，在这里选择要弃掉哪些。", en: "When a take would push you past ten gems, choose here which ones you give back." },
  discard_hint: { zh: "提示你还必须弃掉多少枚宝石才能回到十枚以内。", en: "Tells you how many more gems you must discard to get back to ten." },
  take_three: { zh: "拿走三种不同颜色各一枚宝石。先在 Token Selection 里把这三种颜色各点到 1。", en: "Take one gem of three different colours. Set those three colours to 1 in Token Selection first." },
  take_two: { zh: "拿走同一颜色的两枚宝石，要求该颜色在场上至少还剩四枚。", en: "Take two gems of one colour, which requires at least four of that colour still in the supply." },
  reserve_market: { zh: "把选中的市场卡收进保留区，并立刻获得一枚黄金(Gold)。保留区最多三张。", en: "Move the selected market card into your reserved area and immediately gain one Gold. You may hold at most three reserved cards." },
  reserve_deck: { zh: "从下拉框选中的那一层牌堆顶盲保留一张牌，同样会得到一枚黄金(Gold)。", en: "Blindly reserve the top card of the tier chosen in the dropdown, which also grants you one Gold." },
  buy_market: { zh: "买下选中的市场卡。付款会先扣掉你的同色折扣，不够的部分用黄金(Gold)补。", en: "Buy the selected market card. Your matching discounts apply first and Gold covers anything still missing." },
  buy_reserved: { zh: "买下选中的一张保留卡，付款规则和市场卡完全一样。", en: "Buy the selected reserved card, following exactly the same payment rules as a market card." },
  discard_tokens: { zh: "把选中的宝石退回场上。手牌超过十枚时必须先弃到十枚以内才能结束回合。", en: "Return the selected gems to the supply. When you hold more than ten gems you must discard down to ten before the turn can end." },
  choose_noble: { zh: "在多位同时达标的贵族中挑一位归入自己名下，每位值 3 点声望。", en: "Pick one of the nobles you qualify for at the same time. Each noble is worth 3 prestige points." },
  reserved: { zh: "你的保留区，最多三张。点击一张来选中它，再用 Buy Reserved 买下。", en: "Your reserved area, holding at most three cards. Click one to select it, then use Buy Reserved to buy it." },
  players: { zh: "所有玩家的宝石、折扣、已购卡和声望点数，是你判断该抢哪张卡的主要依据。", en: "Every player with their gems, discounts, purchased cards and prestige, which is what you use to decide which card to contest." }
};

let splendorHelpWidget = null;
let splendorExplainWidget = null;

function initSplendorHelpExplain() {
  if (splendorHelpWidget || typeof window.obgCreateHelp !== "function") return;
  splendorHelpWidget = window.obgCreateHelp(SPLENDOR_HELP_CONFIG);
  splendorExplainWidget = window.obgCreateExplain({
    gameId: "splendor",
    attribute: "data-splendor-explain",
    explanations: SPLENDOR_EXPLAIN,
    button: splendorExplainButton,
    root: () => document.getElementById("splendorPanel"),
    bypass: ["#splendorHelpBtn", "#splendorExplainBtn"]
  });
  splendorHelpButton?.addEventListener("click", () => {
    splendorExplainWidget?.exit();
    splendorHelpWidget.open();
  });
  splendorExplainButton?.addEventListener("click", () => splendorExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSplendorHelpExplain);
} else {
  initSplendorHelpExplain();
}

const splendorPanel = document.getElementById("splendorPanel");
const splendorPhaseLabel = document.getElementById("splendorPhase");
const splendorTurnLabel = document.getElementById("splendorTurn");
const splendorFinalRoundLabel = document.getElementById("splendorFinalRound");
const splendorWinnerLabel = document.getElementById("splendorWinner");
const splendorSupply = document.getElementById("splendorSupply");
const splendorMarketTier1 = document.getElementById("splendorMarketTier1");
const splendorMarketTier2 = document.getElementById("splendorMarketTier2");
const splendorMarketTier3 = document.getElementById("splendorMarketTier3");
const splendorNobles = document.getElementById("splendorNobles");
const splendorSelectedMarketLabel = document.getElementById("splendorSelectedMarket");
const splendorSelectedReservedLabel = document.getElementById("splendorSelectedReserved");
const splendorSelectedNobleLabel = document.getElementById("splendorSelectedNoble");
const splendorClearSelectionBtn = document.getElementById("splendorClearSelection");
const splendorReserveTierSelect = document.getElementById("splendorReserveTier");
const splendorTokenSelectionEl = document.getElementById("splendorTokenSelection");
const splendorDiscardSelectionRow = document.getElementById("splendorDiscardSelectionRow");
const splendorDiscardSelectionEl = document.getElementById("splendorDiscardSelection");
const splendorDiscardHint = document.getElementById("splendorDiscardHint");
const splendorTakeThreeBtn = document.getElementById("splendorTakeThreeBtn");
const splendorTakeTwoBtn = document.getElementById("splendorTakeTwoBtn");
const splendorReserveMarketBtn = document.getElementById("splendorReserveMarketBtn");
const splendorReserveDeckBtn = document.getElementById("splendorReserveDeckBtn");
const splendorBuyMarketBtn = document.getElementById("splendorBuyMarketBtn");
const splendorBuyReservedBtn = document.getElementById("splendorBuyReservedBtn");
const splendorDiscardBtn = document.getElementById("splendorDiscardBtn");
const splendorChooseNobleBtn = document.getElementById("splendorChooseNobleBtn");
const splendorReserved = document.getElementById("splendorReserved");
const splendorPlayers = document.getElementById("splendorPlayers");

let currentSplendorView = null;

let splendorSelectedMarket = null;
let splendorSelectedReserved = null;
let splendorSelectedNoble = null;
let splendorTokenSelection = {};
let splendorDiscardSelection = {};
let splendorNobleCatalog = {};

const splendorActionButtons = {
  take_tokens: splendorTakeThreeBtn,
  take_tokens_same: splendorTakeTwoBtn,
  reserve_market: splendorReserveMarketBtn,
  reserve_deck: splendorReserveDeckBtn,
  buy_market: splendorBuyMarketBtn,
  buy_reserved: splendorBuyReservedBtn,
  discard_tokens: splendorDiscardBtn,
  choose_noble: splendorChooseNobleBtn,
};

const splendorBaseColors = ["white", "blue", "green", "red", "black"];
const splendorColors = [...splendorBaseColors, "gold"];
const splendorColorLabels = {
  white: "W",
  blue: "B",
  green: "G",
  red: "R",
  black: "K",
  gold: "Gold",
};

function resetSplendorTokenSelection() {
  splendorTokenSelection = {};
  splendorColors.forEach((color) => {
    splendorTokenSelection[color] = 0;
  });
}

function resetSplendorDiscardSelection() {
  splendorDiscardSelection = {};
  splendorColors.forEach((color) => {
    splendorDiscardSelection[color] = 0;
  });
}

function clearSplendorState() {
  currentSplendorView = null;
  splendorSelectedMarket = null;
  splendorSelectedReserved = null;
  splendorSelectedNoble = null;
  splendorNobleCatalog = {};
  resetSplendorTokenSelection();
  resetSplendorDiscardSelection();
  if (splendorDiscardSelectionRow) {
    splendorDiscardSelectionRow.classList.add("hidden");
  }
  if (splendorDiscardHint) {
    splendorDiscardHint.textContent = "";
    splendorDiscardHint.classList.add("hidden");
  }
  if (splendorPhaseLabel) {
    splendorPhaseLabel.textContent = "-";
  }
  if (splendorTurnLabel) {
    splendorTurnLabel.textContent = "-";
  }
  if (splendorFinalRoundLabel) {
    splendorFinalRoundLabel.textContent = "-";
  }
  if (splendorWinnerLabel) {
    splendorWinnerLabel.textContent = "-";
  }
  if (splendorSupply) {
    splendorSupply.innerHTML = "";
  }
  if (splendorMarketTier1) {
    splendorMarketTier1.innerHTML = "";
  }
  if (splendorMarketTier2) {
    splendorMarketTier2.innerHTML = "";
  }
  if (splendorMarketTier3) {
    splendorMarketTier3.innerHTML = "";
  }
  if (splendorNobles) {
    splendorNobles.innerHTML = "";
  }
  if (splendorReserved) {
    splendorReserved.innerHTML = "";
  }
  if (splendorPlayers) {
    splendorPlayers.innerHTML = "";
  }
  updateSplendorSelectionLabels();
  updateSplendorActionButtons();
}

function updateSplendorSelectionLabels() {
  if (splendorSelectedMarketLabel) {
    if (splendorSelectedMarket) {
      splendorSelectedMarketLabel.textContent = `${splendorSelectedMarket.tier}:${splendorSelectedMarket.index + 1}`;
    } else {
      splendorSelectedMarketLabel.textContent = "-";
    }
  }
  if (splendorSelectedReservedLabel) {
    splendorSelectedReservedLabel.textContent = splendorSelectedReserved !== null ? `${splendorSelectedReserved + 1}` : "-";
  }
  if (splendorSelectedNobleLabel) {
    splendorSelectedNobleLabel.textContent = splendorSelectedNoble || "-";
  }
}

function updateSplendorDiscardHint(view) {
  if (!splendorDiscardHint) {
    return;
  }
  const requirement = getSplendorPendingDiscardRequirement(view);
  const excess = requirement ? requirement.excess : 0;
  if (excess > 0) {
    splendorDiscardHint.textContent = `Discard ${excess} token${excess === 1 ? "" : "s"} to stay at 10.`;
    splendorDiscardHint.classList.remove("hidden");
    if (splendorDiscardSelectionRow) {
      splendorDiscardSelectionRow.classList.remove("hidden");
    }
  } else {
    splendorDiscardHint.textContent = "";
    splendorDiscardHint.classList.add("hidden");
    if (splendorDiscardSelectionRow) {
      splendorDiscardSelectionRow.classList.add("hidden");
    }
    resetSplendorDiscardSelection();
    renderSplendorDiscardSelection();
  }
}

function clearSplendorSelection() {
  splendorSelectedMarket = null;
  splendorSelectedReserved = null;
  splendorSelectedNoble = null;
  resetSplendorTokenSelection();
  resetSplendorDiscardSelection();
  updateSplendorSelectionLabels();
  renderSplendorTokenSelection();
  renderSplendorDiscardSelection();
  updateSplendorDiscardHint(currentSplendorView);
  updateSplendorActionButtons();
}

function splendorTokenSelectionTotal() {
  return splendorColors.reduce((sum, color) => sum + (splendorTokenSelection[color] || 0), 0);
}

function splendorDiscardSelectionTotal() {
  return splendorColors.reduce((sum, color) => sum + (splendorDiscardSelection[color] || 0), 0);
}

function splendorTotalTokens(tokens) {
  return splendorColors.reduce((sum, color) => sum + ((tokens && tokens[color]) || 0), 0);
}

function splendorTokenGainForAction(view, actionType) {
  const gain = {};
  splendorColors.forEach((color) => {
    gain[color] = 0;
  });
  if (actionType === "take_tokens") {
    const selected = splendorBaseColors.filter((color) => splendorTokenSelection[color] === 1);
    const hasGold = (splendorTokenSelection.gold || 0) > 0;
    if (selected.length !== 3 || splendorTokenSelectionTotal() !== 3 || hasGold) {
      return null;
    }
    selected.forEach((color) => {
      gain[color] = 1;
    });
    return gain;
  }
  if (actionType === "take_tokens_same") {
    const selected = splendorBaseColors.filter((color) => splendorTokenSelection[color] === 2);
    const hasOther = splendorBaseColors.some((color) => {
      const val = splendorTokenSelection[color] || 0;
      return val !== 0 && val !== 2;
    });
    const hasGold = (splendorTokenSelection.gold || 0) > 0;
    if (selected.length !== 1 || splendorTokenSelectionTotal() !== 2 || hasGold || hasOther) {
      return null;
    }
    gain[selected[0]] = 2;
    return gain;
  }
  if (actionType === "reserve_market" || actionType === "reserve_deck") {
    if (view && view.tokens_supply && view.tokens_supply.gold > 0) {
      gain.gold = 1;
    }
    return gain;
  }
  return null;
}

function splendorDiscardRequirement(view, gain) {
  if (!view || !gain) {
    return null;
  }
  const you = getSplendorYou(view);
  if (!you) {
    return null;
  }
  const currentTotal = splendorTotalTokens(you.tokens);
  const gainTotal = splendorColors.reduce((sum, color) => sum + (gain[color] || 0), 0);
  const excess = currentTotal + gainTotal - 10;
  if (excess <= 0) {
    return { excess: 0, available: null };
  }
  const available = {};
  splendorColors.forEach((color) => {
    available[color] = ((you.tokens && you.tokens[color]) || 0) + (gain[color] || 0);
  });
  return { excess, available };
}

function splendorIsDiscardSelectionValid(requirement) {
  if (!requirement || requirement.excess <= 0) {
    return true;
  }
  if (splendorDiscardSelectionTotal() !== requirement.excess) {
    return false;
  }
  return splendorColors.every(
    (color) => (splendorDiscardSelection[color] || 0) <= ((requirement.available && requirement.available[color]) || 0)
  );
}

function splendorDiscardSelectionPayload(requirement) {
  if (!requirement || requirement.excess <= 0) {
    return null;
  }
  const payload = {};
  splendorColors.forEach((color) => {
    const value = splendorDiscardSelection[color] || 0;
    if (value > 0) {
      payload[color] = value;
    }
  });
  return Object.keys(payload).length ? payload : null;
}

function splendorDiscardPayloadForAction(view, actionType) {
  const gain = splendorTokenGainForAction(view, actionType);
  const requirement = splendorDiscardRequirement(view, gain);
  if (!splendorIsDiscardSelectionValid(requirement)) {
    return null;
  }
  return splendorDiscardSelectionPayload(requirement);
}

function getSplendorPendingDiscardRequirement(view) {
  if (!view) {
    return null;
  }
  if (splendorTokenSelectionTotal() > 0) {
    if (view.legal_actions && view.legal_actions.includes("take_tokens")) {
      const gain = splendorTokenGainForAction(view, "take_tokens");
      if (gain) {
        return splendorDiscardRequirement(view, gain);
      }
    }
    if (view.legal_actions && view.legal_actions.includes("take_tokens_same")) {
      const gain = splendorTokenGainForAction(view, "take_tokens_same");
      if (gain) {
        return splendorDiscardRequirement(view, gain);
      }
    }
  }
  if (splendorSelectedMarket && view.legal_actions && view.legal_actions.includes("reserve_market")) {
    const gain = splendorTokenGainForAction(view, "reserve_market");
    return splendorDiscardRequirement(view, gain);
  }
  return null;
}

function renderSplendorTokenSelection() {
  if (!splendorTokenSelectionEl) {
    return;
  }
  splendorTokenSelectionEl.innerHTML = "";
  splendorColors.forEach((color) => {
    const wrapper = document.createElement("div");
    wrapper.className = `token-picker gem-${color}`;
    wrapper.addEventListener("click", (event) => {
      if (event.shiftKey || event.altKey) {
        adjustSplendorTokenSelection(color, -1);
        return;
      }
      const rect = wrapper.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      if (event.clientX < midpoint) {
        adjustSplendorTokenSelection(color, -1);
      } else {
        adjustSplendorTokenSelection(color, 1);
      }
    });
    wrapper.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      adjustSplendorTokenSelection(color, -1);
    });
    const label = document.createElement("span");
    label.textContent = splendorColorLabels[color] || color;
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "-";
    const count = document.createElement("span");
    count.textContent = String(splendorTokenSelection[color] || 0);
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    minus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustSplendorTokenSelection(color, -1);
    });
    plus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustSplendorTokenSelection(color, 1);
    });
    wrapper.appendChild(label);
    wrapper.appendChild(minus);
    wrapper.appendChild(count);
    wrapper.appendChild(plus);
    splendorTokenSelectionEl.appendChild(wrapper);
  });
}

function renderSplendorDiscardSelection() {
  if (!splendorDiscardSelectionEl) {
    return;
  }
  splendorDiscardSelectionEl.innerHTML = "";
  splendorColors.forEach((color) => {
    const wrapper = document.createElement("div");
    wrapper.className = `token-picker gem-${color}`;
    wrapper.addEventListener("click", (event) => {
      if (event.shiftKey || event.altKey) {
        adjustSplendorDiscardSelection(color, -1);
        return;
      }
      const rect = wrapper.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      if (event.clientX < midpoint) {
        adjustSplendorDiscardSelection(color, -1);
      } else {
        adjustSplendorDiscardSelection(color, 1);
      }
    });
    wrapper.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      adjustSplendorDiscardSelection(color, -1);
    });
    const label = document.createElement("span");
    label.textContent = splendorColorLabels[color] || color;
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "-";
    const count = document.createElement("span");
    count.textContent = String(splendorDiscardSelection[color] || 0);
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    minus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustSplendorDiscardSelection(color, -1);
    });
    plus.addEventListener("click", (event) => {
      event.stopPropagation();
      adjustSplendorDiscardSelection(color, 1);
    });
    wrapper.appendChild(label);
    wrapper.appendChild(minus);
    wrapper.appendChild(count);
    wrapper.appendChild(plus);
    splendorDiscardSelectionEl.appendChild(wrapper);
  });
}

function adjustSplendorTokenSelection(color, delta) {
  const current = splendorTokenSelection[color] || 0;
  const next = Math.max(0, Math.min(20, current + delta));
  splendorTokenSelection[color] = next;
  renderSplendorTokenSelection();
  updateSplendorDiscardHint(currentSplendorView);
  updateSplendorActionButtons();
}

function adjustSplendorDiscardSelection(color, delta) {
  const current = splendorDiscardSelection[color] || 0;
  const next = Math.max(0, Math.min(20, current + delta));
  splendorDiscardSelection[color] = next;
  renderSplendorDiscardSelection();
  updateSplendorDiscardHint(currentSplendorView);
  updateSplendorActionButtons();
}

function getSplendorPlayer(view, pid) {
  if (!view || !Array.isArray(view.players)) {
    return null;
  }
  return view.players.find((p) => p.player_id === pid) || null;
}

function getSplendorYou(view) {
  return getSplendorPlayer(view, view && view.you);
}

function splendorRequiredCost(card, bonuses) {
  const required = {};
  splendorBaseColors.forEach((color) => {
    const base = (card.cost && card.cost[color]) || 0;
    const discount = (bonuses && bonuses[color]) || 0;
    required[color] = Math.max(0, base - discount);
  });
  return required;
}

function splendorCanAfford(card, player) {
  if (!card || !player) {
    return false;
  }
  const required = splendorRequiredCost(card, player.bonuses || {});
  const total = splendorBaseColors.reduce((sum, color) => sum + required[color], 0);
  const colored = splendorBaseColors.reduce((sum, color) => {
    const available = (player.tokens && player.tokens[color]) || 0;
    return sum + Math.min(required[color], available);
  }, 0);
  const gold = (player.tokens && player.tokens.gold) || 0;
  return gold >= total - colored;
}

function splendorAutoPayment(card, player) {
  if (!card || !player) {
    return null;
  }
  const required = splendorRequiredCost(card, player.bonuses || {});
  const payment = {};
  let paid = 0;
  splendorBaseColors.forEach((color) => {
    const available = (player.tokens && player.tokens[color]) || 0;
    const pay = Math.min(required[color], available);
    payment[color] = pay;
    paid += pay;
  });
  const total = splendorBaseColors.reduce((sum, color) => sum + required[color], 0);
  const remaining = total - paid;
  const gold = (player.tokens && player.tokens.gold) || 0;
  if (remaining > gold) {
    return null;
  }
  payment.gold = remaining;
  return payment;
}

function getSelectedMarketCard(view) {
  if (!view || !splendorSelectedMarket) {
    return null;
  }
  const tier = splendorSelectedMarket.tier;
  const index = splendorSelectedMarket.index;
  const cards = view.market && view.market[tier];
  if (!Array.isArray(cards) || index < 0 || index >= cards.length) {
    return null;
  }
  return cards[index];
}

function getSelectedReservedCard(view) {
  if (!view || splendorSelectedReserved === null) {
    return null;
  }
  const cards = view.your_reserved || [];
  if (splendorSelectedReserved < 0 || splendorSelectedReserved >= cards.length) {
    return null;
  }
  return cards[splendorSelectedReserved];
}

function isSplendorActionAvailable(actionType) {
  if (!currentSplendorView || !Array.isArray(currentSplendorView.legal_actions)) {
    return false;
  }
  if (!currentSplendorView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "take_tokens") {
    const gain = splendorTokenGainForAction(currentSplendorView, "take_tokens");
    if (!gain) {
      return false;
    }
    const requirement = splendorDiscardRequirement(currentSplendorView, gain);
    return splendorIsDiscardSelectionValid(requirement);
  }
  if (actionType === "take_tokens_same") {
    const gain = splendorTokenGainForAction(currentSplendorView, "take_tokens_same");
    if (!gain) {
      return false;
    }
    const requirement = splendorDiscardRequirement(currentSplendorView, gain);
    return splendorIsDiscardSelectionValid(requirement);
  }
  if (actionType === "reserve_market" || actionType === "buy_market") {
    if (!splendorSelectedMarket) {
      return false;
    }
    if (actionType === "buy_market") {
      const card = getSelectedMarketCard(currentSplendorView);
      return !!(card && card.affordable);
    }
    const gain = splendorTokenGainForAction(currentSplendorView, "reserve_market");
    const requirement = splendorDiscardRequirement(currentSplendorView, gain);
    return splendorIsDiscardSelectionValid(requirement);
  }
  if (actionType === "reserve_deck") {
    const gain = splendorTokenGainForAction(currentSplendorView, "reserve_deck");
    const requirement = splendorDiscardRequirement(currentSplendorView, gain);
    return splendorIsDiscardSelectionValid(requirement);
  }
  if (actionType === "buy_reserved") {
    const card = getSelectedReservedCard(currentSplendorView);
    return !!(card && card.affordable);
  }
  if (actionType === "discard_tokens") {
    if (!currentSplendorView) {
      return false;
    }
    const you = getSplendorYou(currentSplendorView);
    if (!you) {
      return false;
    }
    return (
      splendorTokenSelectionTotal() > 0 &&
      splendorColors.every((color) => (splendorTokenSelection[color] || 0) <= ((you.tokens && you.tokens[color]) || 0))
    );
  }
  if (actionType === "choose_noble") {
    return !!splendorSelectedNoble;
  }
  return true;
}

function updateSplendorActionButtons() {
  if (currentGameType !== "splendor") {
    Object.values(splendorActionButtons).forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(splendorActionButtons).forEach(([actionType, button]) => {
    if (!button) {
      return;
    }
    const allowed = isSplendorActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
}

function formatSplendorCost(cost) {
  if (!cost) {
    return [];
  }
  return splendorBaseColors
    .filter((color) => cost[color])
    .map((color) => ({
      color,
      count: cost[color],
    }));
}

function createSplendorCard(card, selected, options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "splendor-card";
  if (options.compact) {
    wrapper.classList.add("compact");
  }
  if (selected) {
    wrapper.classList.add("selected");
  }
  if (card.affordable) {
    wrapper.classList.add("affordable");
  }
  const title = document.createElement("div");
  title.className = "card-title";
  const bonusLabel = splendorColorLabels[card.bonus] || card.bonus;
  title.textContent = `${card.id} (${card.points})`;
  wrapper.appendChild(title);

  const bonus = document.createElement("div");
  bonus.className = `cost-chip gem-${card.bonus}`;
  bonus.textContent = `Bonus ${bonusLabel}`;
  wrapper.appendChild(bonus);

  const costRow = document.createElement("div");
  costRow.className = "card-cost";
  formatSplendorCost(card.cost).forEach((entry) => {
    const chip = document.createElement("div");
    chip.className = `cost-chip gem-${entry.color}`;
    chip.textContent = `${splendorColorLabels[entry.color] || entry.color}${entry.count}`;
    costRow.appendChild(chip);
  });
  if (!costRow.childNodes.length) {
    const chip = document.createElement("div");
    chip.className = "cost-chip";
    chip.textContent = "-";
    costRow.appendChild(chip);
  }
  wrapper.appendChild(costRow);
  return wrapper;
}

function createSplendorNobleCard(noble, selected, options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "splendor-card";
  if (options.compact) {
    wrapper.classList.add("compact");
  }
  if (selected) {
    wrapper.classList.add("selected");
  }
  if (noble.eligible) {
    wrapper.classList.add("affordable");
  }
  const title = document.createElement("div");
  title.className = "card-title";
  const hasPoints = typeof noble.points === "number";
  title.textContent = hasPoints ? `${noble.id} (${noble.points})` : `${noble.id}`;
  wrapper.appendChild(title);

  const costRow = document.createElement("div");
  costRow.className = "card-cost";
  formatSplendorCost(noble.requirement).forEach((entry) => {
    const chip = document.createElement("div");
    chip.className = `cost-chip gem-${entry.color}`;
    chip.textContent = `${splendorColorLabels[entry.color] || entry.color}${entry.count}`;
    costRow.appendChild(chip);
  });
  if (!costRow.childNodes.length) {
    const chip = document.createElement("div");
    chip.className = "cost-chip";
    chip.textContent = "-";
    costRow.appendChild(chip);
  }
  wrapper.appendChild(costRow);
  return wrapper;
}

function renderSplendorSupply(view) {
  if (!splendorSupply) {
    return;
  }
  splendorSupply.innerHTML = "";
  splendorColors.forEach((color) => {
    const token = document.createElement("div");
    token.className = `splendor-token gem-${color}`;
    const count = view.tokens_supply ? view.tokens_supply[color] : 0;
    token.textContent = `${splendorColorLabels[color] || color}: ${count}`;
    splendorSupply.appendChild(token);
  });
}

function renderSplendorMarket(view) {
  const tiers = {
    tier3: splendorMarketTier3,
    tier2: splendorMarketTier2,
    tier1: splendorMarketTier1,
  };
  Object.entries(tiers).forEach(([tier, container]) => {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    const cards = (view.market && view.market[tier]) || [];
    cards.forEach((card, index) => {
      const selected = splendorSelectedMarket && splendorSelectedMarket.tier === tier && splendorSelectedMarket.index === index;
      const cardEl = createSplendorCard(card, selected);
      cardEl.addEventListener("click", () => {
        splendorSelectedMarket = { tier, index };
        splendorSelectedReserved = null;
        updateSplendorSelectionLabels();
        renderSplendorMarket(view);
        renderSplendorReserved(view);
        renderSplendorDiscardSelection();
        updateSplendorDiscardHint(view);
        updateSplendorActionButtons();
      });
      container.appendChild(cardEl);
    });
    if (!cards.length) {
      const empty = document.createElement("div");
      empty.className = "splendor-card";
      empty.textContent = "-";
      container.appendChild(empty);
    }
  });
}

function renderSplendorNobles(view) {
  if (!splendorNobles) {
    return;
  }
  splendorNobles.innerHTML = "";
  const nobles = view.nobles || [];
  nobles.forEach((noble) => {
    if (noble && noble.id) {
      splendorNobleCatalog[noble.id] = noble;
    }
    const selected = splendorSelectedNoble === noble.id;
    const nobleEl = createSplendorNobleCard(noble, selected);
    nobleEl.addEventListener("click", () => {
      splendorSelectedNoble = noble.id;
      updateSplendorSelectionLabels();
      renderSplendorNobles(view);
      updateSplendorActionButtons();
    });
    splendorNobles.appendChild(nobleEl);
  });
  if (!nobles.length) {
    const empty = document.createElement("div");
    empty.className = "splendor-card";
    empty.textContent = "-";
    splendorNobles.appendChild(empty);
  }
}

function renderSplendorReserved(view) {
  if (!splendorReserved) {
    return;
  }
  splendorReserved.innerHTML = "";
  const cards = view.your_reserved || [];
  cards.forEach((card, index) => {
    const selected = splendorSelectedReserved === index;
    const cardEl = createSplendorCard(card, selected);
    cardEl.addEventListener("click", () => {
      splendorSelectedReserved = index;
      splendorSelectedMarket = null;
      updateSplendorSelectionLabels();
      renderSplendorMarket(view);
      renderSplendorReserved(view);
      renderSplendorDiscardSelection();
      updateSplendorDiscardHint(view);
      updateSplendorActionButtons();
    });
    splendorReserved.appendChild(cardEl);
  });
  if (!cards.length) {
    const empty = document.createElement("div");
    empty.className = "splendor-card";
    empty.textContent = "-";
    splendorReserved.appendChild(empty);
  }
}

function renderSplendorPlayers(view) {
  if (!splendorPlayers) {
    return;
  }
  splendorPlayers.innerHTML = "";
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    const youTag = player.player_id === view.you ? " (you)" : "";
    name.textContent = `${player.name || player.player_id}${youTag}`;
    const score = document.createElement("div");
    score.className = "badge";
    score.textContent = `Score ${player.score}`;
    header.appendChild(name);
    header.appendChild(score);
    card.appendChild(header);

    const bonuses = splendorBaseColors
      .map((color) => `${splendorColorLabels[color] || color}${(player.bonuses && player.bonuses[color]) || 0}`)
      .join(" ");
    const playerNobles = Array.isArray(player.nobles) ? player.nobles : [];
    const noblesCount = playerNobles.length;

    const meta = document.createElement("div");
    meta.className = "player-meta";
    const tokensLine = document.createElement("div");
    tokensLine.className = "splendor-token-row";
    splendorColors.forEach((color) => {
      const token = document.createElement("div");
      token.className = `splendor-token gem-${color}`;
      const count = (player.tokens && player.tokens[color]) || 0;
      token.textContent = `${splendorColorLabels[color] || color}${count}`;
      tokensLine.appendChild(token);
    });
    const bonusesLine = document.createElement("div");
    bonusesLine.textContent = `Bonuses: ${bonuses}`;
    const purchasedCards = Array.isArray(player.purchased) ? player.purchased : [];
    const purchasedCount = typeof player.purchased_count === "number" ? player.purchased_count : purchasedCards.length;
    const countsLine = document.createElement("div");
    countsLine.textContent = `Reserved: ${player.reserved_count} | Purchased: ${purchasedCount} | Nobles: ${noblesCount}`;
    meta.appendChild(tokensLine);
    meta.appendChild(bonusesLine);
    meta.appendChild(countsLine);
    card.appendChild(meta);

    const purchasedSection = document.createElement("div");
    purchasedSection.className = "splendor-player-purchased";
    const purchasedTitle = document.createElement("div");
    purchasedTitle.className = "splendor-player-purchased-title";
    purchasedTitle.textContent = "Purchased Cards";
    purchasedSection.appendChild(purchasedTitle);
    const purchasedList = document.createElement("div");
    purchasedList.className = "splendor-cards splendor-player-purchased-list";
    if (purchasedCards.length) {
      purchasedCards.forEach((cardData) => {
        const cardEl = createSplendorCard(cardData, false, { compact: true });
        purchasedList.appendChild(cardEl);
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "splendor-player-empty";
      empty.textContent = "-";
      purchasedList.appendChild(empty);
    }
    purchasedSection.appendChild(purchasedList);
    card.appendChild(purchasedSection);

    const noblesSection = document.createElement("div");
    noblesSection.className = "splendor-player-purchased";
    const noblesTitle = document.createElement("div");
    noblesTitle.className = "splendor-player-purchased-title";
    noblesTitle.textContent = "Nobles";
    noblesSection.appendChild(noblesTitle);
    const noblesList = document.createElement("div");
    noblesList.className = "splendor-cards splendor-player-purchased-list";
    if (playerNobles.length) {
      playerNobles.forEach((nobleId) => {
        const nobleData = splendorNobleCatalog[nobleId] || { id: nobleId };
        const nobleEl = createSplendorNobleCard(nobleData, false, { compact: true });
        noblesList.appendChild(nobleEl);
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "splendor-player-empty";
      empty.textContent = "-";
      noblesList.appendChild(empty);
    }
    noblesSection.appendChild(noblesList);
    card.appendChild(noblesSection);
    splendorPlayers.appendChild(card);
  });
}

function renderSplendorGameState(data) {
  const view = data.view;
  currentSplendorView = view;
  if (currentGameType !== "splendor") {
    currentGameType = "splendor";
    setGamePanelVisibility("splendor");
  }

  if (splendorSelectedMarket && !getSelectedMarketCard(view)) {
    splendorSelectedMarket = null;
  }
  if (splendorSelectedReserved !== null && !getSelectedReservedCard(view)) {
    splendorSelectedReserved = null;
  }
  if (splendorSelectedNoble && !(view.nobles || []).some((noble) => noble.id === splendorSelectedNoble)) {
    splendorSelectedNoble = null;
  }

  if (splendorPhaseLabel) {
    splendorPhaseLabel.textContent = view.phase || "-";
  }
  const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
  if (splendorTurnLabel) {
    splendorTurnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn || "-";
  }
  if (splendorFinalRoundLabel) {
    if (view.final_round && view.final_round.active) {
      const triggerName = view.final_round.triggered_by ? findPlayerName(view, view.final_round.triggered_by) : "-";
      splendorFinalRoundLabel.textContent = `Yes (${triggerName})`;
    } else {
      splendorFinalRoundLabel.textContent = "No";
    }
  }
  if (splendorWinnerLabel) {
    if (view.winner && view.winner.length) {
      const names = view.winner.map((pid) => findPlayerName(view, pid));
      splendorWinnerLabel.textContent = names.join(", ");
    } else {
      splendorWinnerLabel.textContent = "-";
    }
  }

  updateSplendorSelectionLabels();
  renderSplendorSupply(view);
  renderSplendorMarket(view);
  renderSplendorNobles(view);
  renderSplendorReserved(view);
  renderSplendorPlayers(view);
  renderSplendorTokenSelection();
  renderSplendorDiscardSelection();
  updateSplendorDiscardHint(view);

  logGameEvents(data);
  updateSplendorActionButtons();
}

if (splendorClearSelectionBtn) {
  splendorClearSelectionBtn.addEventListener("click", () => {
    clearSplendorSelection();
  });
}

if (splendorTakeThreeBtn) {
  splendorTakeThreeBtn.addEventListener("click", () => {
    const colors = splendorBaseColors.filter((color) => splendorTokenSelection[color] === 1);
    if (colors.length !== 3 || splendorTokenSelectionTotal() !== 3) {
      log("Select exactly 3 different gem colors");
      return;
    }
    const action = { type: "take_tokens", colors };
    const discard = splendorDiscardPayloadForAction(currentSplendorView, "take_tokens");
    if (discard) {
      action.discard = discard;
    }
    sendAction(action);
    resetSplendorTokenSelection();
    resetSplendorDiscardSelection();
    renderSplendorTokenSelection();
    renderSplendorDiscardSelection();
    updateSplendorDiscardHint(currentSplendorView);
    updateSplendorActionButtons();
  });
}

if (splendorTakeTwoBtn) {
  splendorTakeTwoBtn.addEventListener("click", () => {
    const colors = splendorBaseColors.filter((color) => splendorTokenSelection[color] === 2);
    if (colors.length !== 1 || splendorTokenSelectionTotal() !== 2) {
      log("Select exactly 2 of the same gem color");
      return;
    }
    const action = { type: "take_tokens_same", color: colors[0] };
    const discard = splendorDiscardPayloadForAction(currentSplendorView, "take_tokens_same");
    if (discard) {
      action.discard = discard;
    }
    sendAction(action);
    resetSplendorTokenSelection();
    resetSplendorDiscardSelection();
    renderSplendorTokenSelection();
    renderSplendorDiscardSelection();
    updateSplendorDiscardHint(currentSplendorView);
    updateSplendorActionButtons();
  });
}

if (splendorReserveMarketBtn) {
  splendorReserveMarketBtn.addEventListener("click", () => {
    if (!splendorSelectedMarket) {
      log("Select a market card to reserve");
      return;
    }
    const action = {
      type: "reserve_market",
      tier: splendorSelectedMarket.tier,
      index: splendorSelectedMarket.index,
    };
    const discard = splendorDiscardPayloadForAction(currentSplendorView, "reserve_market");
    if (discard) {
      action.discard = discard;
    }
    sendAction(action);
    splendorSelectedMarket = null;
    resetSplendorDiscardSelection();
    renderSplendorDiscardSelection();
    updateSplendorDiscardHint(currentSplendorView);
    updateSplendorSelectionLabels();
    updateSplendorActionButtons();
  });
}

if (splendorReserveDeckBtn) {
  splendorReserveDeckBtn.addEventListener("click", () => {
    const tier = splendorReserveTierSelect ? splendorReserveTierSelect.value : "tier1";
    const action = { type: "reserve_deck", tier };
    const discard = splendorDiscardPayloadForAction(currentSplendorView, "reserve_deck");
    if (discard) {
      action.discard = discard;
    }
    sendAction(action);
    resetSplendorDiscardSelection();
    renderSplendorDiscardSelection();
    updateSplendorDiscardHint(currentSplendorView);
    updateSplendorActionButtons();
  });
}

if (splendorBuyMarketBtn) {
  splendorBuyMarketBtn.addEventListener("click", () => {
    const card = getSelectedMarketCard(currentSplendorView);
    if (!splendorSelectedMarket || !card) {
      log("Select a market card to buy");
      return;
    }
    const you = getSplendorYou(currentSplendorView);
    const payment = splendorAutoPayment(card, you);
    if (!payment) {
      log("Not enough tokens to buy this card");
      return;
    }
    sendAction({
      type: "buy_market",
      tier: splendorSelectedMarket.tier,
      index: splendorSelectedMarket.index,
      payment,
    });
    splendorSelectedMarket = null;
    updateSplendorSelectionLabels();
    updateSplendorActionButtons();
  });
}

if (splendorBuyReservedBtn) {
  splendorBuyReservedBtn.addEventListener("click", () => {
    const card = getSelectedReservedCard(currentSplendorView);
    if (splendorSelectedReserved === null || !card) {
      log("Select a reserved card to buy");
      return;
    }
    const you = getSplendorYou(currentSplendorView);
    const payment = splendorAutoPayment(card, you);
    if (!payment) {
      log("Not enough tokens to buy this card");
      return;
    }
    sendAction({
      type: "buy_reserved",
      reserved_index: splendorSelectedReserved,
      payment,
    });
    splendorSelectedReserved = null;
    updateSplendorSelectionLabels();
    updateSplendorActionButtons();
  });
}

if (splendorDiscardBtn) {
  splendorDiscardBtn.addEventListener("click", () => {
    if (splendorTokenSelectionTotal() <= 0) {
      log("Select tokens to discard");
      return;
    }
    sendAction({ type: "discard_tokens", tokens: { ...splendorTokenSelection } });
    resetSplendorTokenSelection();
    resetSplendorDiscardSelection();
    renderSplendorTokenSelection();
    renderSplendorDiscardSelection();
    updateSplendorDiscardHint(currentSplendorView);
    updateSplendorActionButtons();
  });
}

if (splendorChooseNobleBtn) {
  splendorChooseNobleBtn.addEventListener("click", () => {
    if (!splendorSelectedNoble) {
      log("Select a noble to take");
      return;
    }
    sendAction({ type: "choose_noble", noble_id: splendorSelectedNoble });
    splendorSelectedNoble = null;
    updateSplendorSelectionLabels();
    updateSplendorActionButtons();
  });
}
